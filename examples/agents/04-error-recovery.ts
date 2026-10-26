/**
 * examples/agents/04-error-recovery.ts
 *
 * Demonstrates how an agent should handle the four main error classes:
 *
 *   1. 422 — body validation failed  → fix and retry
 *   2. 400 — semantic validation     → fall back to /search
 *   3. 502 — upstream down           → graceful fallback
 *   4. 401 — bad EIA API key         → actionable error
 *
 * Run:  bun dev
 *       bun run examples/agents/04-error-recovery.ts
 */
import { fetchJson, log, header, subheader, EiaClientError, BASE, runExample } from '../shared'

async function safe<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof EiaClientError) {
      log(`[${label}] HTTP ${err.status}  code=${err.errorCode ?? '—'}  msg=${(err.body as { message?: string })?.message ?? err.message}`)
      if (err.upstreamStatus !== undefined) log(`[${label}]   upstreamStatus=${err.upstreamStatus}`)
    } else {
      log(`[${label}]`, err)
    }
    return null
  }
}

async function fallbackToSearch(badQuery: string): Promise<string | null> {
  log(`  Falling back to /search for "${badQuery}"…`)
  const r = await fetchJson<{ hits: { path: string; title: string }[] }>('/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: badQuery, limit: 1 }),
  })
  return r.hits[0]?.title ?? null
}

async function main(): Promise<void> {
  header('Error recovery patterns for agents')

  // ---------------------------------------------------------------------------
  // 1. 422 — body validation
  // ---------------------------------------------------------------------------
  subheader('1. 422 — POST /search with empty `q`')
  await safe('search/empty-q', () =>
    fetchJson('/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: '' }),
    })
  )
  log('  → Fix: ensure `q` is at least 1 character, or run validation client-side first.\n')

  // ---------------------------------------------------------------------------
  // 2. 400 — semantic validation (unknown domain)
  // ---------------------------------------------------------------------------
  subheader('2. 400 — POST /query with unknown domain')
  const result2 = await safe('query/unknown-domain', () =>
    fetchJson('/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'typo-domain', route: 'x', frequency: 'annual' }),
    })
  )
  if (result2 === null) {
    const suggestion = await fallbackToSearch('typ domai energy')
    log(`  → Recovery: suggest via /search → "${suggestion ?? '(no suggestion)'}"\n`)
  }

  // ---------------------------------------------------------------------------
  // 3. 502 — upstream down (or bad upstream path)
  // ---------------------------------------------------------------------------
  subheader('3. 502 — POST /query with invalid route (upstream 400 → we 502)')
  await safe('query/invalid-route', () =>
    fetchJson('/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'coal', route: 'no-such-subroute', frequency: 'annual' }),
    })
  )
  log('  → Fix: list valid sub-routes via GET /domains/coal first, then retry.\n')

  // ---------------------------------------------------------------------------
  // 4. 401 — bad EIA API key
  // ---------------------------------------------------------------------------
  subheader('4. 401 — direct call to upstream with bad key (simulated by calling a guarded endpoint)')
  log(`  (We can\'t easily simulate this from the wrapper, since the server holds the key.`)
  log(`   If you see a 401 from /query in real usage, the upstream EIA rejected the key.`)
  log(`   The wrapper will return a 502 with the upstream error attached.)`)
  log(`  → Action: check EIA_API_KEY in your .env, verify at https://www.eia.gov/opendata/.\n`)

  // ---------------------------------------------------------------------------
  // 5. Retry pattern with exponential backoff (demo, not real)
  // ---------------------------------------------------------------------------
  subheader('5. Retry with backoff (illustrative)')
  const fakeOp = async (attempt: number): Promise<void> => {
    if (attempt < 2) throw new Error('flake')
    log(`  attempt ${attempt} succeeded`)
  }
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await fakeOp(attempt)
      break
    } catch {
      const wait = 100 * 2 ** (attempt - 1)
      log(`  attempt ${attempt} failed, retrying in ${wait}ms…`)
      await new Promise((r) => setTimeout(r, wait))
    }
  }

  log(`\nAll done. Server: ${BASE}`)
}

runExample(main)
