/**
 * examples/04-search.ts
 *
 * Demonstrates:  POST /search
 *
 * Run:
 *   bun dev
 *   bun run examples/04-search.ts
 */
import { fetchJson, log, header, subheader, dump, EiaClientError, runExample } from './shared'
import type { SearchResponse } from '../src/schemas/domain'

async function main(): Promise<void> {
  header('POST /search  — basic keyword search')
  const r1 = await fetchJson<SearchResponse>('/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: 'coal production' }),
  })
  log(`Query "${r1.query}" returned ${r1.total} hits; top 5:`)
  for (const hit of r1.hits.slice(0, 5)) {
    log(`  [${hit.score.toFixed(1).padStart(5)}] ${hit.path}`)
    log(`           ${hit.title}`)
    log(`           ${hit.snippet.slice(0, 90)}…`)
  }

  subheader('POST /search  — with explicit limit')
  const r2 = await fetchJson<SearchResponse>('/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: 'electricity state emissions', limit: 3 }),
  })
  for (const hit of r2.hits) log(`  - ${hit.path}  (${hit.score.toFixed(1)})  ${hit.title}`)

  subheader('POST /search  — semantic-style multi-word query')
  const r3 = await fetchJson<SearchResponse>('/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: 'natural gas price monthly by state' }),
  })
  log(`Top 3:`)
  for (const hit of r3.hits.slice(0, 3)) log(`  - ${hit.path}  ${hit.title}`)

  subheader('POST /search  — empty result for nonsense')
  const r4 = await fetchJson<SearchResponse>('/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: 'xyzzy12345' }),
  })
  log(`Total: ${r4.total}, hits: ${r4.hits.length}`)

  subheader('POST /search  — error handling (empty q is a 422)')
  try {
    await fetchJson('/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: '' }),
    })
  } catch (err) {
    if (err instanceof EiaClientError) {
      log(`Got expected error: HTTP ${err.status}`)
      log(`Body (truncated): ${JSON.stringify(err.body).slice(0, 200)}…`)
    } else {
      throw err
    }
  }

  subheader('Bonus: combine /search with /domains to plan a query')
  const r5 = await fetchJson<SearchResponse>('/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: 'rto fuel type', limit: 1 }),
  })
  const top = r5.hits[0]
  if (top) {
    log(`Top hit: domain=${top.domain}, path=${top.path}`)
    log(`This is exactly what you'd pass to POST /query as { domain, route }`)
    dump(top, 400)
  }
}

runExample(main)
