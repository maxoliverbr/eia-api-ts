/**
 * examples/07-query-post-facets.ts
 *
 * Demonstrates:  POST /query  — with facet filters (the main pattern)
 *
 * Run:
 *   bun dev
 *   bun run examples/07-query-post-facets.ts
 */
import { fetchJson, log, header, subheader, runExample } from './shared'

type QueryResponse = {
  response: { data: Record<string, unknown>[]; total: number; description?: string }
}

async function main(): Promise<void> {
  header('POST /query  — single facet filter (electricity: NG only)')
  const r1 = await fetchJson<QueryResponse>('/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      domain: 'electricity',
      route: 'electric-power-operational-data',
      frequency: 'monthly',
      start: '2024-01',
      end: '2024-03',
      facets: { fueltypeid: ['NG'] },
      length: 5,
    }),
  })
  log(`Description: ${r1.response.description}`)
  log(`Total matching rows: ${r1.response.total}`)
  for (const row of r1.response.data) log(`  ${JSON.stringify(row)}`)

  subheader('POST /query  — multiple values in one facet (stateId = CA, TX, NY)')
  const r2 = await fetchJson<QueryResponse>('/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      domain: 'electricity',
      route: 'retail-sales',
      frequency: 'annual',
      start: '2022',
      end: '2023',
      facets: { stateid: ['CA', 'TX', 'NY'] },
      length: 10,
    }),
  })
  log(`Total: ${r2.response.total}`)
  for (const row of r2.response.data) log(`  ${JSON.stringify(row)}`)

  subheader('POST /query  — multiple facets AND-ed together')
  const r3 = await fetchJson<QueryResponse>('/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      domain: 'co2-emissions',
      route: 'co2-emissions-aggregates',
      frequency: 'annual',
      start: '2020',
      end: '2023',
      facets: {
        stateId: ['CA', 'TX'],
        sectorId: ['EC'], // electric power
      },
      length: 10,
    }),
  })
  log(`Total: ${r3.response.total}`)
  for (const row of r3.response.data) log(`  ${JSON.stringify(row)}`)

  subheader('POST /query  — combined: facets + sort + columns + pagination')
  const r4 = await fetchJson<QueryResponse>('/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      domain: 'coal',
      route: 'aggregate-production',
      frequency: 'annual',
      start: '2020',
      end: '2023',
      facets: { stateRegionId: ['IL'] },
      data: ['production', 'labor-hours'],
      sort: [{ column: 'period', direction: 'asc' }],
      length: 3,
      offset: 0,
    }),
  })
  log(`Total: ${r4.response.total}`)
  for (const row of r4.response.data) log(`  ${JSON.stringify(row)}`)
}

runExample(main)
