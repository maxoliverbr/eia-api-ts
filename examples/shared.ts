/**
 * examples/shared.ts
 *
 * Single helper module used by every example in this folder.
 * Provides:
 *   - BASE  (server URL, override with EIA_API_BASE env var)
 *   - fetchJson<T>() — typed fetch with rich error body
 *   - EiaClientError — class so callers can switch on `status`
 *   - EiaServerNotRunningError — thrown by the preflight when the local
 *     wrapper at BASE can't be reached (connection refused, DNS, etc.)
 *   - EiaServerSlowError — thrown by the preflight when the server IS up
 *     but did not respond within the timeout (so the message doesn't
 *     wrongly suggest the server is down)
 *   - preflight() — memoized GET /health check; run automatically by
 *     fetchJson on first call. Successes are cached for the process
 *     lifetime; failures are retried on subsequent calls so a single
 *     slow probe does not poison every fetchJson in the script.
 *   - runExample(fn) — wraps an example's main() and prints a clean,
 *     single-line message (no stack trace) on server-down / slow
 *   - log  — short, prefixed console.log
 *   - header / subheader — section dividers for nicer output
 *   - loadDotenv() — load .env from the repo root or cwd into process.env
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const BASE = process.env.EIA_API_BASE ?? 'http://localhost:3000'

/** Minimal POST /query response shape used by the per-domain examples. */
export type QueryResponse = {
  response: { data: Record<string, unknown>[]; total: number; description?: string }
}

/** POST /query for a specific (domain, route). Used by the per-domain examples. */
export async function queryDomain(
  domain: string,
  route: string,
  body: Record<string, unknown>,
): Promise<QueryResponse> {
  return fetchJson<QueryResponse>('/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain, route, ...body }),
  })
}

export class EiaClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string,
  ) {
    super(message)
    this.name = 'EiaClientError'
  }

  /** Return the upstream `upstreamStatus` from our wrapper, if present. */
  get upstreamStatus(): number | undefined {
    if (this.body && typeof this.body === 'object' && 'upstreamStatus' in this.body) {
      const v = (this.body as { upstreamStatus?: unknown }).upstreamStatus
      return typeof v === 'number' ? v : undefined
    }
    return undefined
  }

  /** Return the error code from our wrapper, if present. */
  get errorCode(): string | undefined {
    if (this.body && typeof this.body === 'object' && 'error' in this.body) {
      const v = (this.body as { error?: unknown }).error
      return typeof v === 'string' ? v : undefined
    }
    return undefined
  }
}

/** Thrown when the local wrapper server at BASE is unreachable. */
export class EiaServerNotRunningError extends EiaClientError {
  constructor(base: string) {
    super(0, null, `Server not running at ${base}. Start it with: bun dev`)
    this.name = 'EiaServerNotRunningError'
  }
}

/** Thrown when the server is up but did not respond before PREFLIGHT_TIMEOUT_MS. */
export class EiaServerSlowError extends EiaClientError {
  constructor(base: string, timeoutMs: number) {
    super(
      0,
      null,
      `Server at ${base} did not respond within ${timeoutMs}ms. The server is running but /health is slow — try increasing PREFLIGHT_TIMEOUT_MS, or check the server logs.`,
    )
    this.name = 'EiaServerSlowError'
  }
}

const PREFLIGHT_TIMEOUT_MS = 2000
// After a failed preflight, do not retry again within this window. This
// stops a tight loop if the server is genuinely down while still allowing
// recovery from a one-off slow probe.
const PREFLIGHT_RETRY_MS = 1000

// Successful preflights are memoized for the life of the process.
// Failed preflights are stored only briefly (see PREFLIGHT_RETRY_MS) and
// a fresh attempt is made once that window elapses.
let preflightSuccess: Promise<void> | null = null
let preflightFailure: { at: number; error: Error } | null = null

/**
 * Verify the local wrapper server is reachable. Runs at most once per
 * process on success. Connection failures (refused, DNS, reset) become
 * EiaServerNotRunningError. Timeouts (AbortController fired before the
 * server responded) become EiaServerSlowError, so the caller can tell
 * "server is down" apart from "server is up but slow". A failed probe
 * is retried on the next call after PREFLIGHT_RETRY_MS elapses, so a
 * single slow probe does not poison every fetchJson in the script.
 */
export function preflight(): Promise<void> {
  if (preflightSuccess) return preflightSuccess
  if (preflightFailure && Date.now() - preflightFailure.at < PREFLIGHT_RETRY_MS) {
    return Promise.reject(preflightFailure.error)
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PREFLIGHT_TIMEOUT_MS)
  const probe = (async () => {
    try {
      const res = await fetch(`${BASE}/health`, { signal: controller.signal })
      if (!res.ok) {
        const text = await res.text()
        let body: unknown = text
        if (text.length > 0) {
          try {
            body = JSON.parse(text)
          } catch {
            // leave body as text
          }
        }
        throw new EiaClientError(res.status, body, `HTTP ${res.status} ${res.statusText} on /health`)
      }
      preflightFailure = null
    } catch (err) {
      const error =
        err instanceof EiaClientError
          ? err
          : controller.signal.aborted
            ? new EiaServerSlowError(BASE, PREFLIGHT_TIMEOUT_MS)
            : new EiaServerNotRunningError(BASE)
      preflightFailure = { at: Date.now(), error }
      preflightSuccess = null
      throw error
    } finally {
      clearTimeout(timer)
    }
  })()
  preflightSuccess = probe
  return probe
}

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  await preflight()
  const res = await fetch(`${BASE}${path}`, init)
  const text = await res.text()
  let body: unknown = text
  if (text.length > 0) {
    try {
      body = JSON.parse(text)
    } catch {
      // leave body as text
    }
  }
  if (!res.ok) {
    throw new EiaClientError(res.status, body, `HTTP ${res.status} ${res.statusText} on ${path}`)
  }
  return body as T
}

/** Run an example's main() with a graceful exit on server-down / slow. */
export async function runExample(fn: () => Promise<void>): Promise<void> {
  try {
    await fn()
  } catch (err) {
    if (err instanceof EiaServerNotRunningError || err instanceof EiaServerSlowError) {
      console.error(err.message)
    } else {
      console.error(err)
    }
    process.exit(1)
  }
}

export const log = (...args: unknown[]): void => {
  // eslint-disable-next-line no-console
  console.log('[eia]', ...args)
}

export const header = (text: string): void => {
  // eslint-disable-next-line no-console
  console.log(`\n\x1b[1m=== ${text} ===\x1b[0m`)
}

export const subheader = (text: string): void => {
  // eslint-disable-next-line no-console
  console.log(`\n--- ${text} ---`)
}

/** Tiny inline JSON pretty-printer (avoids a `jq` dep). */
export const dump = (value: unknown, max = 600): void => {
  const s = JSON.stringify(value, null, 2)
  // eslint-disable-next-line no-console
  console.log(s.length > max ? `${s.slice(0, max)}…` : s)
}

/**
 * Minimal .env loader. Looks in the repo root (relative to this file) then
 * the cwd; does not overwrite vars already present in the environment.
 * Used by examples that read LLM API keys from .env.
 */
export function loadDotenv(): void {
  const candidates = [
    join(dirname(import.meta.path), '..', '..', '.env'),
    join(process.cwd(), '.env'),
  ]
  for (const path of candidates) {
    if (!existsSync(path)) continue
    const text = readFileSync(path, 'utf8')
    for (const raw of text.split('\n')) {
      const line = raw.trim()
      if (line.length === 0 || line.startsWith('#')) continue
      const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i)
      if (!m) continue
      const [, key, rawValue] = m
      if (key === undefined || rawValue === undefined) continue
      if (process.env[key] !== undefined) continue
      const value = rawValue.replace(/^["']|["']$/g, '').trim()
      process.env[key] = value
    }
    return
  }
}
