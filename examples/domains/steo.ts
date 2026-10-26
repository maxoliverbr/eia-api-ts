/**
 * examples/domains/steo.ts
 *
 * STEO — Short Term Energy Outlook (monthly forecasts)
 *
 * Run:  bun dev
 *       bun run examples/domains/steo.ts
 */
import { fetchJson, log, queryDomain, header, subheader, runExample } from '../shared'

async function main(): Promise<void> {
  header('STEO  — Short Term Energy Outlook')

  subheader('1. List facets')
  const facets = await fetchJson<{ response: { facetOptions: string[] } }>('/routes/steo/facet')
  log('Available facets:', facets.response.facetOptions)

  subheader('2. Series facet (first 10)')
  const series = await fetchJson<{ response: { facets: { id: string; name?: string }[] } }>(
    '/routes/steo/facet/seriesId',
  )
  for (const f of series.response.facets.slice(0, 10)) {
    log(`  - ${f.id.padEnd(8)} ${f.name ?? ''}`)
  }

  subheader('3. Monthly forecast 2024–2025 (first 5 rows)')
  const r = await queryDomain('steo', 'data', {
    frequency: 'monthly',
    start: '2024-01',
    end: '2025-06',
    length: 5,
  })
  log(`Total: ${r.response.total}`)
  for (const row of r.response.data) log(`  ${JSON.stringify(row)}`)
}

runExample(main)
