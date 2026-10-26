/**
 * examples/agents/01-discover-and-query.ts
 *
 * Realistic agent flow:
 *   1. /search        — find a domain by free-text
 *   2. /domains/:id   — inspect the matched domain
 *   3. /routes/.../facet   — list facet IDs
 *   4. /routes/.../facet/:facetId — pick a value
 *   5. POST /query    — execute the query
 *   6. pretty-print
 *
 * Run:  bun dev
 *       bun run examples/agents/01-discover-and-query.ts
 */
import { fetchJson, log, header, subheader, EiaClientError, runExample } from '../shared'
import type { DomainMeta, SearchResponse } from '../../src/schemas/domain'

type FacetList = { response: { facetOptions: string[] } }
type FacetValues = { response: { facets: { id: string; name?: string }[] } }
type QueryResponse = { response: { data: Record<string, unknown>[]; total: number; description?: string } }

async function main(): Promise<void> {
  header('Agent flow: discover → inspect → query')

  // 1. SEARCH
  subheader('Step 1: POST /search  — find a domain by intent')
  const query = 'electricity emissions by state'
  const search = await fetchJson<SearchResponse>('/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query }),
  })
  log(`Query "${query}" → ${search.total} hits`)
  const topHit = search.hits[0]
  if (!topHit) throw new Error('No hits')
  log(`Top hit: domain=${topHit.domain}  path=${topHit.path}`)
  log(`  title:   ${topHit.title}`)
  log(`  snippet: ${topHit.snippet}`)

  // 2. INSPECT DOMAIN
  subheader(`Step 2: GET /domains/${topHit.domain}  — inspect`)
  const domain = await fetchJson<DomainMeta>(`/domains/${topHit.domain}`)
  log(`${domain.name} — ${domain.subRoutes.length} sub-routes:`)
  for (const s of domain.subRoutes) log(`  - ${s.id}: ${s.summary}`)

  // Choose the first sub-route (or override here)
  const subRoute = domain.subRoutes[0]
  if (!subRoute) throw new Error('No sub-routes')
  const routePath = subRoute.path // e.g. "electricity/electric-power-operational-data"

  // 3. LIST FACETS
  subheader(`Step 3: GET /routes/${routePath}/facet  — list facet IDs`)
  const facets = await fetchJson<FacetList>(`/routes/${routePath}/facet`)
  log('Available facets:', facets.response.facetOptions)
  if (facets.response.facetOptions.length === 0) {
    log('No facets available for this route; running unfiltered query.')
  }

  // 4. PICK FACET VALUES
  const firstFacet = facets.response.facetOptions[0]
  let pickedFacetValues: string[] = []
  if (firstFacet) {
    subheader(`Step 4: GET /routes/${routePath}/facet/${firstFacet}  — pick a value`)
    const values = await fetchJson<FacetValues>(`/routes/${routePath}/facet/${firstFacet}`)
    pickedFacetValues = values.response.facets.slice(0, 2).map((f) => f.id)
    log(`Picked [${pickedFacetValues.join(', ')}] from "${firstFacet}"`)
  }

  // 5. QUERY
  subheader(`Step 5: POST /query  — execute`)
  const body: Record<string, unknown> = {
    domain: topHit.domain,
    route: subRoute.id,
    frequency: subRoute.typicalFrequency,
    start: subRoute.exampleQuery.start,
    end: subRoute.exampleQuery.end,
    length: 5,
  }
  if (firstFacet && pickedFacetValues.length > 0) {
    body.facets = { [firstFacet]: pickedFacetValues }
  }
  log('Request body:', JSON.stringify(body, null, 2))

  const result = await fetchJson<QueryResponse>('/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  log(`Total matching: ${result.response.total}`)
  for (const row of result.response.data) log(`  ${JSON.stringify(row)}`)

  // 6. ERROR HANDLING — if upstream is down
  subheader('Step 6 (bonus): how to detect a bad domain')
  try {
    await fetchJson<QueryResponse>('/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'nope', route: 'x' }),
    })
  } catch (err) {
    if (err instanceof EiaClientError) {
      log(`Got expected error: ${err.status}  ${err.errorCode ?? ''}  ${(err.body as { message?: string })?.message ?? ''}`)
    }
  }
}

runExample(main)
