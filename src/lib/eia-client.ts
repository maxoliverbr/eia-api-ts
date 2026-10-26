/**
 * Typed HTTP client for the upstream EIA APIv2.
 *
 * Responsibilities:
 *   - Inject `api_key` automatically
 *   - Normalize errors into EiaApiError
 *   - Read-through the in-memory cache (GET and POST), with identical
 *     in-flight requests sharing one upstream call
 *   - Pause all upstream traffic after a 429 (honours `Retry-After`)
 *   - Provide a stable surface for the route layer to call
 */
import { env } from '../config/env'
import { EiaApiError } from './errors'
import { cache, ttlFor, TTLCache } from './cache'
import { logger } from './logger'
import { LimiterBusyError, RateLimiter } from './rate-limiter'

export type EiaClientOptions = {
  apiKey?: string
  baseUrl?: string
  /**
   * Test seam — production uses the global `fetch`. Tests inject a mock so
   * they can simulate upstream responses without touching the network.
   */
  fetchImpl?: typeof fetch
  /**
   * Max retries on transient upstream 5xx and network errors.
   * 0 = no retries (single attempt). Default: 2 → 3 total attempts.
   */
  maxRetries?: number
  /**
   * Base delay between retries in ms. The actual delay is
   * `retryDelayMs * attempt` (linear backoff). Default: 200ms.
   */
  retryDelayMs?: number
  /**
   * Minimum spacing between outbound EIA fetches — every physical attempt,
   * including retries and ping(), shares one FIFO queue. 0 disables.
   * Per-process scope. Default: env EIA_MIN_INTERVAL_MS (5000ms).
   */
  minIntervalMs?: number
  /**
   * Longest a call may wait in the queue (or behind a 429 cool-down) before
   * it is rejected with 503/429 + `Retry-After` instead. Default: 60s.
   */
  maxQueueWaitMs?: number
}

/** Cool-down after an upstream 429 that carries no usable `Retry-After`. */
const DEFAULT_COOLDOWN_MS = 60_000
/** How long a `ping()` result is reused, however often /ready is polled. */
const PING_TTL_MS = 60_000

/** Parse `Retry-After` (delta-seconds or HTTP-date) into milliseconds. */
const parseRetryAfter = (h: string | null): number | undefined => {
  if (!h) return undefined
  const secs = Number(h)
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000)
  const at = Date.parse(h)
  return Number.isNaN(at) ? undefined : Math.max(0, at - Date.now())
}

export class EiaClient {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch
  private readonly maxRetries: number
  private readonly retryDelayMs: number
  private readonly limiter: RateLimiter
  private readonly inflight = new Map<string, { promise: Promise<unknown>; waiters: number; ctrl: AbortController }>()
  private lastPing: { at: number; ok: Promise<boolean> } | null = null

  constructor(opts: EiaClientOptions = {}) {
    this.apiKey = opts.apiKey ?? env.EIA_API_KEY
    this.baseUrl = (opts.baseUrl ?? env.EIA_BASE_URL).replace(/\/+$/, '')
    this.fetchImpl = opts.fetchImpl ?? fetch
    this.maxRetries = opts.maxRetries ?? 2
    this.retryDelayMs = opts.retryDelayMs ?? 200
    this.limiter = new RateLimiter(opts.minIntervalMs ?? env.EIA_MIN_INTERVAL_MS, opts.maxQueueWaitMs)
  }

  /** Build a fully-qualified upstream URL with query params. */
  buildUrl(path: string, params?: Record<string, unknown>): string {
    const url = new URL(`${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`)
    url.searchParams.set('api_key', this.apiKey)
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null) continue
        if (Array.isArray(v)) {
          if (v.length === 0) continue
          const arr = v as unknown[]
          if (arr.every((x) => x !== null && typeof x === 'object' && !Array.isArray(x))) {
            // Array of objects, e.g. sort: [{column, direction}, ...]
            // EIA expects: sort[0][column]=period&sort[0][direction]=asc
            arr.forEach((item, i) => {
              const obj = item as Record<string, unknown>
              for (const [ok, ov] of Object.entries(obj)) {
                if (ov === undefined || ov === null) continue
                url.searchParams.set(`${k}[${i}][${ok}]`, String(ov))
              }
            })
          } else if (k === 'data') {
            // EIA v2 rejects the PHP-style bracket form for `data` with 400
            // (verified 2026-06: `data[]=period&data[]=production` → 400,
            // `data=period,production` → 200). Send a single comma-joined
            // value. See EXAMPLES.md > GET /query.
            url.searchParams.set('data', arr.map(String).join(','))
          } else {
            // Array of scalars, e.g. an unknown future param.
            // EIA expects the bracket form: k[]=v1&k[]=v2.
            for (const item of arr) url.searchParams.append(`${k}[]`, String(item))
          }
        } else if (typeof v === 'object') {
          // Object with array/scalar values, e.g. facets: {stateId: ['AK', 'WV']}
          // EIA expects: facets[stateId][]=AK&facets[stateId][]=WV
          const obj = v as Record<string, unknown>
          for (const [fk, fv] of Object.entries(obj)) {
            if (fv === undefined || fv === null) continue
            if (Array.isArray(fv)) {
              if (fv.length === 0) continue
              for (const fvv of fv) {
                url.searchParams.append(`facets[${fk}][]`, String(fvv))
              }
            } else {
              url.searchParams.set(`facets[${fk}][]`, String(fv))
            }
          }
        } else {
          url.searchParams.set(k, String(v))
        }
      }
    }
    return url.toString()
  }

  /**
   * Low-level GET; passes through cache. `signal` is the caller's request
   * signal: if every caller waiting on this request goes away before it
   * leaves the queue, the upstream call is skipped.
   */
  async get<T>(path: string, params?: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
    const url = this.buildUrl(path, params)
    return this.cached<T>(this.cacheKey('GET', path, params), path, signal, (s) =>
      this.request<T>('GET', url, path, undefined, s),
    )
  }

  /**
   * Low-level POST. The body is sent as JSON; arrays of objects/scalars
   * are passed through unchanged. Cached like GET, keyed on the body.
   */
  async post<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    const url = this.buildUrl(path)
    return this.cached<T>(this.cacheKey('POST', path, body), path, signal, (s) =>
      this.request<T>('POST', url, path, body, s),
    )
  }

  /**
   * Whether the upstream is reachable. Used by /ready. Bypasses the queue so
   * a probe never waits behind data requests, but the result is reused for
   * PING_TTL_MS, so probes cost at most one upstream call a minute. During
   * a 429 cool-down it reports unreachable without calling.
   */
  async ping(): Promise<boolean> {
    if (this.limiter.pausedFor > 0) return false
    const now = Date.now()
    if (!this.lastPing || now - this.lastPing.at > PING_TTL_MS) {
      const ok = this.fetchImpl(this.buildUrl('/v2/'), { method: 'GET', signal: AbortSignal.timeout(10_000) })
        .then((res) => {
          if (res.status === 429) this.limiter.pause(parseRetryAfter(res.headers.get('Retry-After')) ?? DEFAULT_COOLDOWN_MS)
          return res.ok || res.status === 400 // 400 = "missing api key or route" = reached upstream
        })
        .catch(() => false)
      this.lastPing = { at: now, ok }
    }
    return this.lastPing.ok
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private cacheKey(method: string, path: string, params?: unknown): string {
    return TTLCache.key({ m: method, p: path, q: params ?? null })
  }

  /**
   * Cache read-through plus in-flight dedupe: concurrent identical requests
   * share one upstream call. The shared call is abandoned only when every
   * caller that passed a signal has aborted (and none came without one).
   */
  private async cached<T>(
    key: string,
    path: string,
    signal: AbortSignal | undefined,
    run: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const hit = cache.get(key)
    if (hit !== undefined) return hit as T

    let entry = this.inflight.get(key)
    if (!entry) {
      const ctrl = new AbortController()
      const promise = run(ctrl.signal)
        .then((data) => {
          cache.set(key, data, ttlFor(path))
          return data
        })
        .finally(() => this.inflight.delete(key))
      entry = { promise, waiters: 0, ctrl }
      this.inflight.set(key, entry)
    }
    const e = entry
    if (!signal) {
      e.waiters = Number.POSITIVE_INFINITY
    } else if (!signal.aborted) {
      e.waiters++
      signal.addEventListener('abort', () => --e.waiters === 0 && e.ctrl.abort(), { once: true })
    }
    return e.promise as Promise<T>
  }

  private async request<T>(
    method: string,
    url: string,
    originalPath: string,
    body: unknown,
    signal: AbortSignal,
  ): Promise<T> {
    const maxAttempts = this.maxRetries + 1
    let lastErr: EiaApiError | null = null
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.attemptRequest<T>(method, url, originalPath, body, signal)
      } catch (err) {
        if (!(err instanceof EiaApiError)) throw err
        lastErr = err
        if (!this.shouldRetry(err, attempt, maxAttempts)) throw err
        // Surface transient upstream flakiness even when the eventual
        // call succeeds. The `attempt` is 1-indexed; attempt 1 failure
        // means we'll retry at most `maxAttempts - 1` more times.
        logger.warn('upstream retry', {
          method,
          path: originalPath,
          attempt,
          nextAttempt: attempt + 1,
          maxAttempts,
          errorCode: err.code,
          upstreamStatus: err.upstreamStatus,
          errorMessage: err.message,
        })
        // Linear backoff: 200ms, 400ms, 600ms, ...
        await new Promise((r) => setTimeout(r, this.retryDelayMs * attempt))
      }
    }
    throw lastErr
  }

  /**
   * Whether the given error is worth retrying on this attempt. Retries are
   * limited to transient upstream conditions:
   *   - upstream 5xx (500/502/503/504), which the wrapper surfaces as its
   *     own 502 with `code: 'upstream_non_2xx'`
   *   - network errors and timeouts
   * 429 is never retried here: it pauses the whole limiter instead, and
   * retrying per request would multiply traffic while EIA is throttling us.
   * Other 4xx upstream errors (400/401/403) are client errors and are
   * returned to the caller without retry.
   */
  private shouldRetry(err: EiaApiError, attempt: number, maxAttempts: number): boolean {
    if (attempt >= maxAttempts) return false
    if (err.code === 'upstream_non_2xx') {
      const s = err.upstreamStatus
      return s !== undefined && s >= 500
    }
    if (err.code === 'upstream_network' || err.code === 'upstream_timeout') return true
    return false
  }

  private async attemptRequest<T>(
    method: string,
    url: string,
    originalPath: string,
    body: unknown,
    signal: AbortSignal,
  ): Promise<T> {
    let res: Response
    try {
      res = await this.limiter.schedule(
        () =>
          this.fetchImpl(url, {
            method,
            headers: body ? { 'Content-Type': 'application/json' } : undefined,
            body: body ? JSON.stringify(body) : undefined,
          }),
        signal,
      )
    } catch (err) {
      // Every caller left while queued: not an upstream failure, don't retry.
      if (signal.aborted) throw err
      if (err instanceof LimiterBusyError) {
        throw new EiaApiError({
          message: `${err.message}; retry later`,
          code: 'rate_limited',
          status: err.paused ? 429 : 503,
          path: originalPath,
          retryAfterSec: Math.ceil(err.retryAfterMs / 1000),
        })
      }
      const isTimeout = err instanceof Error && /timeout|abort/i.test(err.message)
      throw new EiaApiError({
        message: isTimeout ? 'Upstream EIA timeout' : 'Upstream EIA network error',
        code: isTimeout ? 'upstream_timeout' : 'upstream_network',
        status: 502,
        path: originalPath,
        cause: err,
      })
    }

    // EIA echoes request params (api_key included) in `request.params`;
    // scrub the key from the raw body so no response, cache entry, error
    // body, or log line can carry it back to a caller.
    const raw = await res.text()
    const text = this.apiKey ? raw.replaceAll(this.apiKey, '[redacted]') : raw
    let parsed: unknown
    try {
      parsed = text.length > 0 ? JSON.parse(text) : null
    } catch (err) {
      throw new EiaApiError({
        message: 'Upstream returned non-JSON response',
        code: 'invalid_response',
        status: 502,
        path: originalPath,
        upstreamStatus: res.status,
        body: text.slice(0, 500),
        cause: err,
      })
    }

    if (!res.ok) {
      const upstreamStatus = res.status
      let code: EiaApiError['code'] = 'upstream_non_2xx'
      let retryAfterMs: number | undefined
      if (upstreamStatus === 401 || upstreamStatus === 403) code = 'unauthorized'
      else if (upstreamStatus === 429) {
        code = 'rate_limited'
        retryAfterMs = parseRetryAfter(res.headers.get('Retry-After')) ?? DEFAULT_COOLDOWN_MS
        this.limiter.pause(retryAfterMs)
      }

      // 4xx is a client error (bad data column, bad facet, etc.) — pass
      // the upstream status through unchanged so the caller can see the
      // real reason. Only 5xx / network failures become 502 "bad gateway".
      const status = code === 'unauthorized'
        ? 401
        : upstreamStatus >= 400 && upstreamStatus < 500
          ? upstreamStatus
          : 502

      throw new EiaApiError({
        message: `Upstream EIA returned ${upstreamStatus}`,
        code,
        status,
        path: originalPath,
        upstreamStatus,
        body: parsed,
        ...(retryAfterMs !== undefined ? { retryAfterSec: Math.ceil(retryAfterMs / 1000) } : {}),
      })
    }

    return parsed as T
  }
}

// Shared default instance
export const eia = new EiaClient()
