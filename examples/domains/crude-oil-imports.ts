/**
 * examples/domains/crude-oil-imports.ts
 *
 * Crude Oil Imports — U.S. imports by origin, grade, customs district
 *
 * Run:  bun dev
 *       bun run examples/domains/crude-oil-imports.ts
 */
import { fetchJson, log, queryDomain, header, subheader, runExample } from '../shared'

async function main(): Promise<void> {
  header('Crude Oil Imports')

  subheader('1. List facets')
  const facets = await fetchJson<{ response: { facetOptions: string[] } }>('/routes/crude-oil-imports/facet')
  log('Available facets:', facets.response.facetOptions)

  subheader('2. Origin country facet (first 10)')
  const origins = await fetchJson<{ response: { facets: { id: string; name?: string }[] } }>(
    '/routes/crude-oil-imports/facet/originId',
  )
  for (const f of origins.response.facets.slice(0, 10)) {
    log(`  - ${f.id.padEnd(6)} ${f.name ?? ''}`)
  }

  subheader('3. Monthly imports 2023 (first 5 rows)')
  const r = await queryDomain('crude-oil-imports', 'data', {
    frequency: 'monthly',
    start: '2023-01',
    end: '2023-12',
    length: 5,
  })
  log(`Total: ${r.response.total}`)
  for (const row of r.response.data) log(`  ${JSON.stringify(row)}`)
}

runExample(main)
