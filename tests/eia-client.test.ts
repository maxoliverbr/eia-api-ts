import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { EiaClient } from '../src/lib/eia-client'
import { EiaApiError } from '../src/lib/errors'
import { cache } from '../src/lib/cache'

let stderrSpy: ReturnType<typeof spyOn> | null = null

beforeEach(() => {
  // The module-level `cache` singleton is shared across all EiaClient
  // instances, so clear it between tests to avoid one test's mock response
  // leaking into the next.
  cache.clear()
  stderrSpy = spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  stderrSpy?.mockRestore()
  stderrSpy = null
})

describe('EiaClient', () => {
  it('scrubs the api_key from the upstream request echo', async () => {
    const echo = { request: { command: '/v2/coal/', params: { api_key: 'SECRET-KEY' } }, response: { data: [] } }
    const c = new EiaClient({
      apiKey: 'SECRET-KEY',
      baseUrl: 'https://example.test/v2',
      minIntervalMs: 0,
      fetchImpl: (async () => Response.json(echo)) as unknown as typeof fetch,
    })
    const out = await c.get<typeof echo>('/coal')
    expect(JSON.stringify(out)).not.toContain('SECRET-KEY')
    expect(out.request.params.api_key).toBe('[redacted]')
  })

  it('builds a URL with api_key and a comma-joined `data` param', () => {
    const c = new EiaClient({ apiKey: 'TEST', baseUrl: 'https://example.test/v2' })
    const url = c.buildUrl('/coal/data', { data: ['production', 'price'] })
    expect(url).toContain('api_key=TEST')
    expect(url).toContain('data=production%2Cprice')
    // EIA v2 rejects the bracket form for `data` with 400 (verified live
    // 2026-06). Guard against regressing to data[]=… encoding.
    expect(url).not.toContain('data%5B%5D=')
    expect(url).not.toContain('data=production%2Cprice&data=price')
  })

  it('builds a URL with facets[facetId][]=...', () => {
    const c = new EiaClient({ apiKey: 'TEST', baseUrl: 'https://example.test/v2' })
    const url = c.buildUrl('/coal/data', { facets: { stateId: ['CA', 'TX'] } })
    expect(url).toContain('facets%5BstateId%5D%5B%5D=CA')
    expect(url).toContain('facets%5BstateId%5D%5B%5D=TX')
  })

  it('omits undefined/null params', () => {
    const c = new EiaClient({ apiKey: 'TEST', baseUrl: 'https://example.test/v2' })
    const url = c.buildUrl('/coal/data', { frequency: undefined, start: null, end: '2024' })
    expect(url).not.toContain('frequency=')
    expect(url).toContain('end=2024')
  })

  it('normalizes trailing slashes on baseUrl', () => {
    const c = new EiaClient({ apiKey: 'TEST', baseUrl: 'https://example.test/v2//' })
    const url = c.buildUrl('/coal/data')
    expect(url.startsWith('https://example.test/v2/coal/data')).toBe(true)
  })

  it('handles leading-slash-less paths', () => {
    const c = new EiaClient({ apiKey: 'TEST', baseUrl: 'https://example.test/v2' })
    const url = c.buildUrl('coal/data')
    expect(url).toContain('/v2/coal/data')
  })
})

describe('EiaClient retries', () => {
  /** Build a mock fetch that returns a sequence of status/body responses. */
  const mockFetch = (responses: Array<{ status: number; body: string }>): typeof fetch => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    let i = 0
    const fn = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init })
      const r = responses[i] ?? responses[responses.length - 1]!
      i++
      return new Response(r.body, { status: r.status, headers: { 'Content-Type': 'application/json' } })
    }) as unknown as typeof fetch
    return Object.assign(fn, { calls })
  }
  type TrackedFetch = typeof fetch & { calls: Array<{ url: string; init?: RequestInit }> }

  // The module-level `cache` singleton is cleared in `beforeEach` above.
  // minIntervalMs: 0 disables the rate limiter so retry tests stay fast;
  // spacing behavior has its own describe block below.
  const clientOpts = (fetchImpl: typeof fetch) => ({
    apiKey: 'TEST',
    baseUrl: 'https://example.test/v2',
    fetchImpl,
    maxRetries: 2,
    retryDelayMs: 1,
    minIntervalMs: 0,
  })

  it('retries on upstream 5xx and returns the eventual 2xx body', async () => {
    const fetch = mockFetch([
      { status: 500, body: '"Something unexpected happened."' },
      { status: 500, body: '"Something unexpected happened."' },
      { status: 200, body: '{"response":{"data":[],"total":0}}' },
    ]) as TrackedFetch
    const c = new EiaClient(clientOpts(fetch))
    const out = await c.get<{ response: { data: unknown[]; total: number } }>('/coal/data')
    expect(out.response.total).toBe(0)
    expect(fetch.calls.length).toBe(3)
  })

  it('surfaces upstream 5xx after exhausting retries', async () => {
    const fetch = mockFetch([
      { status: 500, body: '"x"' },
      { status: 502, body: '"y"' },
      { status: 503, body: '"z"' },
    ]) as TrackedFetch
    const c = new EiaClient(clientOpts(fetch))
    await expect(c.get('/coal/data')).rejects.toBeInstanceOf(EiaApiError)
    expect(fetch.calls.length).toBe(3)
  })

  it('does not retry an upstream 429; it surfaces 429 with Retry-After', async () => {
    const fetch = mockFetch([
      { status: 429, body: '{"error":"rate limited"}' },
      { status: 200, body: '{"ok":true}' },
    ]) as TrackedFetch
    const c = new EiaClient(clientOpts(fetch))
    const err = await c.get<never>('/coal/data').catch((e: EiaApiError) => e)
    expect(err).toBeInstanceOf(EiaApiError)
    expect(err.status).toBe(429)
    expect(err.retryAfterSec).toBe(60) // no Retry-After header → default cool-down
    expect(fetch.calls.length).toBe(1)
  })

  it('does not retry on upstream 4xx', async () => {
    const fetch = mockFetch([
      { status: 400, body: '{"error":"Invalid data"}' },
      { status: 400, body: '{"error":"Invalid data"}' },
      { status: 200, body: '{}' },
    ]) as TrackedFetch
    const c = new EiaClient(clientOpts(fetch))
    await expect(c.get('/coal/data')).rejects.toBeInstanceOf(EiaApiError)
    expect(fetch.calls.length).toBe(1)
  })

  it('passes upstream 4xx status through unchanged (not 502)', async () => {
    // Regression guard: previously the wrapper masked every non-2xx
    // upstream error as 502, which hid the real cause (e.g. an invalid
    // `data` column on a sub-route). 4xx is a client error and should
    // be surfaced with the upstream status.
    const fetch = mockFetch([
      { status: 400, body: '{"error":"Invalid data \'value\' provided. The only valid data are \'emissions\', and \'carbon-coefficient\'."}' },
    ]) as TrackedFetch
    const c = new EiaClient(clientOpts(fetch))
    try {
      await c.get('/co2-emissions/co2-emissions-and-carbon-coefficients/data')
      throw new Error('expected EiaApiError')
    } catch (err) {
      expect(err).toBeInstanceOf(EiaApiError)
      const e = err as EiaApiError
      expect(e.status).toBe(400)
      expect(e.upstreamStatus).toBe(400)
      expect(e.code).toBe('upstream_non_2xx')
    }
  })

  it('still maps upstream 5xx to 502 (bad gateway)', async () => {
    const fetch = mockFetch([
      { status: 503, body: '"Something unexpected happened."' },
    ]) as TrackedFetch
    const c = new EiaClient(clientOpts(fetch))
    try {
      await c.get('/coal/data')
      throw new Error('expected EiaApiError')
    } catch (err) {
      expect(err).toBeInstanceOf(EiaApiError)
      const e = err as EiaApiError
      expect(e.status).toBe(502)
      expect(e.upstreamStatus).toBe(503)
    }
  })

  it('retries on network errors', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    let attempt = 0
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init })
      attempt++
      if (attempt === 2) throw new TypeError('fetch failed')
      if (attempt === 1) {
        return new Response('"x"', { status: 500, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response('{"ok":true}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as unknown as typeof fetch
    const c = new EiaClient(clientOpts(fetchImpl))
    const out = await c.get<{ ok: boolean }>('/coal/data')
    expect(out.ok).toBe(true)
    expect(calls.length).toBe(3)
  })

  it('emits a warn log line on each upstream retry', async () => {
    // Re-spy with a capturing implementation. (Bun's
    // `spyOn(...).mockImplementation(...)` returns a new spy, so we
    // re-spy here instead of chaining — otherwise the original
    // implementation stays attached to console.error.)
    stderrSpy?.mockRestore()
    const warnCalls: unknown[][] = []
    stderrSpy = spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      warnCalls.push(args)
    })
    const fetch = mockFetch([
      { status: 503, body: '"upstream busy"' },
      { status: 200, body: '{"ok":true}' },
    ]) as TrackedFetch
    const c = new EiaClient(clientOpts(fetch))
    const out = await c.get('/coal/data')
    expect(out).toEqual({ ok: true })

    // At least one warn line for the retry, with the right shape.
    const warnLines = warnCalls
      .map((args) => {
        const line = args[0]
        if (typeof line !== 'string') return null
        try {
          return JSON.parse(line) as Record<string, unknown>
        } catch {
          return null
        }
      })
      .filter((x): x is Record<string, unknown> => x !== null)
      .filter((l) => l['message'] === 'upstream retry')
    expect(warnLines.length).toBeGreaterThanOrEqual(1)
    const line = warnLines[0]!
    expect(line['level']).toBe('warn')
    expect(line['method']).toBe('GET')
    expect(line['path']).toBe('/coal/data')
    expect(line['attempt']).toBe(1)
    expect(line['errorCode']).toBe('upstream_non_2xx')
    expect(line['upstreamStatus']).toBe(503)
  })
})

describe('EiaClient rate limiting', () => {
  /** Mock fetch that records the timestamp and url of every call. */
  const timedFetch = (body = '{"ok":true}', status = 200) => {
    const calls: Array<{ url: string; at: number }> = []
    const fn = (async (url: string | URL | Request) => {
      calls.push({ url: String(url), at: Date.now() })
      return new Response(body, { status, headers: { 'Content-Type': 'application/json' } })
    }) as unknown as typeof fetch
    return Object.assign(fn, { calls })
  }

  const opts = (fetchImpl: typeof fetch, minIntervalMs: number) => ({
    apiKey: 'TEST',
    baseUrl: 'https://example.test/v2',
    fetchImpl,
    maxRetries: 0,
    retryDelayMs: 1,
    minIntervalMs,
  })

  // Timer jitter can fire setTimeout slightly early, so assert gaps with a
  // small tolerance instead of exact equality.
  const INTERVAL = 40
  const MIN_GAP = INTERVAL - 5

  it('spaces concurrent calls by at least minIntervalMs, in FIFO order', async () => {
    const fetch = timedFetch()
    const c = new EiaClient(opts(fetch, INTERVAL))
    await Promise.all([c.get('/coal/data'), c.get('/petroleum/data'), c.get('/gas/data')])
    expect(fetch.calls.length).toBe(3)
    expect(fetch.calls.map((x) => x.url)).toEqual([
      expect.stringContaining('/coal/data'),
      expect.stringContaining('/petroleum/data'),
      expect.stringContaining('/gas/data'),
    ])
    for (let i = 1; i < fetch.calls.length; i++) {
      expect(fetch.calls[i]!.at - fetch.calls[i - 1]!.at).toBeGreaterThanOrEqual(MIN_GAP)
    }
  })

  it('spaces retry attempts too', async () => {
    const calls: number[] = []
    let attempt = 0
    const fetchImpl = (async () => {
      calls.push(Date.now())
      attempt++
      return new Response(attempt === 1 ? '"busy"' : '{"ok":true}', {
        status: attempt === 1 ? 500 : 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as unknown as typeof fetch
    const c = new EiaClient({ ...opts(fetchImpl, INTERVAL), maxRetries: 1 })
    await c.get('/coal/data')
    expect(calls.length).toBe(2)
    expect(calls[1]! - calls[0]!).toBeGreaterThanOrEqual(MIN_GAP)
  })

  it('does not delay cache hits', async () => {
    const fetch = timedFetch()
    const c = new EiaClient(opts(fetch, 200))
    await c.get('/coal/data')
    const t0 = Date.now()
    await c.get('/coal/data')
    expect(Date.now() - t0).toBeLessThan(100)
    expect(fetch.calls.length).toBe(1)
  })

  it('minIntervalMs: 0 disables spacing', async () => {
    const fetch = timedFetch()
    const c = new EiaClient(opts(fetch, 0))
    const t0 = Date.now()
    await Promise.all([c.get('/coal/data'), c.get('/petroleum/data'), c.get('/gas/data')])
    expect(fetch.calls.length).toBe(3)
    expect(Date.now() - t0).toBeLessThan(50)
  })

  it('ping bypasses the queue and reuses its result', async () => {
    const fetch = timedFetch()
    const c = new EiaClient(opts(fetch, 500))
    await c.get('/coal/data') // the next queued call would wait ~500ms
    const t0 = Date.now()
    expect(await c.ping()).toBe(true)
    expect(await c.ping()).toBe(true)
    expect(Date.now() - t0).toBeLessThan(100)
    expect(fetch.calls.length).toBe(2) // one data call + one ping
  })

  it('caches POST bodies like GETs', async () => {
    const fetch = timedFetch()
    const c = new EiaClient(opts(fetch, 0))
    await c.post('/coal/data', { frequency: 'annual', start: '2020' })
    await c.post('/coal/data', { start: '2020', frequency: 'annual' }) // same body, other key order
    await c.post('/coal/data', { frequency: 'annual', start: '2021' })
    expect(fetch.calls.length).toBe(2)
  })

  it('shares one upstream call between concurrent identical requests', async () => {
    const fetch = timedFetch()
    const c = new EiaClient(opts(fetch, 0))
    const results = await Promise.all([c.get('/coal/data'), c.get('/coal/data'), c.get('/coal/data')])
    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }])
    expect(fetch.calls.length).toBe(1)
  })

  it('skips a queued call once every caller has aborted', async () => {
    const fetch = timedFetch()
    const c = new EiaClient(opts(fetch, INTERVAL))
    await c.get('/warmup/data')
    const a = new AbortController()
    const b = new AbortController()
    const pa = c.get('/coal/data', undefined, a.signal).catch((e) => e)
    const pb = c.get('/coal/data', undefined, b.signal).catch((e) => e)
    a.abort()
    await new Promise((r) => setTimeout(r, INTERVAL / 4))
    b.abort()
    await Promise.all([pa, pb])
    expect(fetch.calls.length).toBe(1) // only the warmup
  })

  it('keeps a shared call alive while one caller is still waiting', async () => {
    const fetch = timedFetch()
    const c = new EiaClient(opts(fetch, INTERVAL))
    await c.get('/warmup/data')
    const a = new AbortController()
    const pa = c.get('/coal/data', undefined, a.signal).catch((e) => e)
    const pb = c.get('/coal/data', undefined, new AbortController().signal)
    a.abort()
    expect(await pb).toEqual({ ok: true })
    await pa
    expect(fetch.calls.length).toBe(2)
  })

  it('a 429 pauses all traffic: later calls fail fast without reaching EIA', async () => {
    let n = 0
    const fetchImpl = (async () => {
      n++
      return new Response('{"error":"rate limited"}', { status: 429, headers: { 'Retry-After': '120' } })
    }) as unknown as typeof fetch
    const c = new EiaClient({ ...opts(fetchImpl, 0), maxQueueWaitMs: 1_000 })
    const first = await c.get<never>('/coal/data').catch((e: EiaApiError) => e)
    expect(first.status).toBe(429)
    expect(first.retryAfterSec).toBe(120)
    const second = await c.get<never>('/gas/data').catch((e: EiaApiError) => e)
    expect(second).toBeInstanceOf(EiaApiError)
    expect(second.status).toBe(429)
    expect(second.retryAfterSec).toBeGreaterThan(100)
    expect(await c.ping()).toBe(false)
    expect(n).toBe(1)
  })

  it('rejects with 503 + Retry-After when the queue wait would exceed the cap', async () => {
    const fetch = timedFetch()
    const c = new EiaClient({ ...opts(fetch, 1_000), maxQueueWaitMs: 1_500 })
    const results = await Promise.all(
      ['/a/data', '/b/data', '/c/data', '/d/data'].map((p) => c.get<{ ok: boolean }>(p).catch((e: EiaApiError) => e)),
    )
    // /a starts now, /b waits ~1s, /c would wait ~2s and /d ~3s: both rejected.
    expect(results.slice(0, 2)).toEqual([{ ok: true }, { ok: true }])
    for (const e of results.slice(2) as EiaApiError[]) {
      expect(e).toBeInstanceOf(EiaApiError)
      expect(e.status).toBe(503)
      expect(e.retryAfterSec).toBeGreaterThanOrEqual(2)
    }
    expect(fetch.calls.length).toBe(2)
  })
})
