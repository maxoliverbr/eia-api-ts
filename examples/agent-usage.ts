/**
 * examples/agent-usage.ts
 *
 * Quick-start: a minimal fetch-based example showing the typical agent flow.
 *
 *   bun dev          (in another terminal)
 *   bun run examples/agent-usage.ts
 *
 * For comprehensive examples see:
 *   - examples/01-meta.ts        — every Meta endpoint
 *   - examples/02-discovery.ts   — /domains, /domains/:id, /routes/...
 *   - examples/03-facets.ts      — /routes/.../facet, /schema/...
 *   - examples/04-search.ts      — POST /search
 *   - examples/05-query-get.ts   — GET /query
 *   - examples/06-query-post-basic.ts
 *   - examples/07-query-post-facets.ts
 *   - examples/08-domains-overview.ts — one query per domain
 *   - examples/domains/*.ts     — 15 per-domain examples
 *   - examples/agents/*.ts      — 5 realistic agentic flows (incl. one with Mastra + OpenRouter)
 *   - examples/curl/*.sh        — cURL for every endpoint
 *   - examples/types/eden.ts    — Eden Treaty (optional, fully typed)
 *   - EXAMPLES.md               — consolidated doc with curl + ts
 */
import { BASE, fetchJson, log, header, runExample } from './shared'
import type { DomainMeta, SearchResponse } from '../src/schemas/domain'

async function main(): Promise<void> {
  header('Quick start: discover → search → inspect → query')

  // 1. Health
  const health = await fetchJson<{ status: string; upstream: string }>('/health')
  log('Health:', health)

  // 2. Discover
  const { domains } = await fetchJson<{ domains: DomainMeta[] }>('/domains')
  log(`\nDiscovered ${domains.length} domains`)

  // 3. Search
  const search = await fetchJson<SearchResponse>('/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: 'coal production' }),
  })
  log(`\nSearch "coal production" → ${search.total} hits`)
  for (const hit of search.hits.slice(0, 3)) log(`  - ${hit.path}  (${hit.score.toFixed(1)})  ${hit.title}`)

  // 4. Inspect
  const coal = await fetchJson<DomainMeta>('/domains/coal')
  log(`\nCoal: ${coal.subRoutes.length} sub-routes`)
  for (const s of coal.subRoutes.slice(0, 5)) log(`  - ${s.id}: ${s.summary}`)

  // 5. Query (requires a valid EIA_API_KEY on the server)
  // const result = await fetchJson('/query', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({
  //     domain: 'coal',
  //     route: 'aggregate-production',
  //     frequency: 'annual',
  //     start: '2020',
  //     end: '2024',
  //     length: 5,
  //   }),
  // })
  // log('\nQuery result:', result)

  log(`\nServer: ${BASE}`)
  log('See examples/README.md for the full index.')
}

runExample(main)
