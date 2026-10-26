/**
 * examples/domains/international.ts
 *
 * International — energy data by country/region
 *
 * Run:  bun dev
 *       bun run examples/domains/international.ts
 */
import { fetchJson, log, queryDomain, header, subheader, runExample } from '../shared'

async function main(): Promise<void> {
  header('International  — global energy data by country/region')

  subheader('1. List facets')
  const facets = await fetchJson<{ response: { facetOptions: string[] } }>('/routes/international/facet')
  log('Available facets:', facets.response.facetOptions)

  subheader('2. Country/region facet (first 10)')
  const countries = await fetchJson<{ response: { facets: { id: string; name?: string }[] } }>(
    '/routes/international/facet/countryRegionId',
  )
  for (const f of countries.response.facets.slice(0, 10)) {
    log(`  - ${f.id.padEnd(6)} ${f.name ?? ''}`)
  }

  subheader('3. Annual data 2020–2022 (first 5 rows)')
  const r = await queryDomain('international', 'data', {
    frequency: 'annual',
    start: '2020',
    end: '2022',
    length: 5,
  })
  log(`Total: ${r.response.total}`)
  for (const row of r.response.data) log(`  ${JSON.stringify(row)}`)

  subheader('4. With facet: countryRegionId=CHN (China), 2022')
  const cn = await queryDomain('international', 'data', {
    frequency: 'annual',
    start: '2022',
    end: '2022',
    facets: { countryRegionId: ['CHN'] },
    length: 3,
  })
  for (const row of cn.response.data) log(`  ${JSON.stringify(row)}`)
}

runExample(main)
