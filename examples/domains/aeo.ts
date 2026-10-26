/**
 * examples/domains/aeo.ts
 *
 * AEO — Annual Energy Outlook (long-term U.S. projections)
 *
 * Note: aeo uses `{year}` as a placeholder for the publication year. Pick a
 * real year from the upstream route listing (e.g. the latest available).
 *
 * Run:  bun dev  (in another terminal)
 *       bun run examples/domains/aeo.ts
 */
import { fetchJson, log, queryDomain, header, subheader, runExample } from '../shared'

async function main(): Promise<void> {
  header('AEO  — Annual Energy Outlook')

  // Discover the latest available AEO publication year.
  const aeoListing = await fetchJson<{ response: { routes: { id: string }[] } }>('/routes/aeo')
  const years = aeoListing.response.routes.map((r) => r.id).filter((y) => /^\d{4}$/.test(y))
  const year = years.sort().reverse()[0]
  if (!year) throw new Error('No AEO year found in upstream route listing')
  log(`Using AEO publication year: ${year}`)

  subheader(`1. List aeo/${year} facets`)
  const facets = await fetchJson<{ response: { facetOptions: string[] } }>(`/routes/aeo/${year}/facet`)
  log('Available facets:', facets.response.facetOptions)

  subheader(`2. Get values for scenario facet (aeo/${year}/facet/scenario)`)
  const scenarios = await fetchJson<{ response: { facets: { id: string; name?: string }[] } }>(
    `/routes/aeo/${year}/facet/scenario`,
  )
  log('Scenarios (first 5):')
  for (const f of scenarios.response.facets.slice(0, 5)) {
    log(`  - ${f.id}${f.name ? ` (${f.name})` : ''}`)
  }

  subheader(`3. Query — annual projection 2025–2030 (limited sample) for aeo/${year}`)
  const r = await queryDomain('aeo', year, {
    frequency: 'annual',
    start: '2025',
    end: '2030',
    length: 5,
  })
  log(`Description: ${r.response.description}`)
  log(`Total:       ${r.response.total}`)
  for (const row of r.response.data) log(`  ${JSON.stringify(row)}`)
}

runExample(main)
