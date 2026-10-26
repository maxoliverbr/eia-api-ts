/**
 * examples/domains/total-energy.ts
 *
 * Total Energy — U.S. aggregate production, consumption, trade
 *
 * Run:  bun dev
 *       bun run examples/domains/total-energy.ts
 */
import { fetchJson, log, queryDomain, header, subheader, runExample } from '../shared'

async function main(): Promise<void> {
  header('Total Energy  — U.S. aggregate energy data')

  subheader('1. List facets')
  const facets = await fetchJson<{ response: { facetOptions: string[] } }>('/routes/total-energy/facet')
  log('Available facets:', facets.response.facetOptions)

  subheader('2. MSN facet (first 10) — total-energy facets live at the domain level, not /data')
  const series = await fetchJson<{ response: { facets: { id: string; name?: string }[] } }>(
    '/routes/total-energy/facet/msn',
  )
  for (const f of series.response.facets.slice(0, 10)) {
    log(`  - ${f.id.padEnd(8)} ${f.name ?? ''}`)
  }

  subheader('3. Monthly total energy 2024 (first 5 rows)')
  const r = await queryDomain('total-energy', 'data', {
    frequency: 'monthly',
    start: '2024-01',
    end: '2024-12',
    length: 5,
  })
  log(`Total: ${r.response.total}`)
  for (const row of r.response.data) log(`  ${JSON.stringify(row)}`)
}

runExample(main)
