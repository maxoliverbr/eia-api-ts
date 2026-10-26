/**
 * examples/domains/ieo.ts
 *
 * IEO — International Energy Outlook (long-term international projections)
 *
 * Note: ieo uses `{year}` as a placeholder for the publication year. Pick a
 * real year from the upstream route listing.
 *
 * Run:  bun dev
 *       bun run examples/domains/ieo.ts
 */
import { fetchJson, log, queryDomain, header, subheader, runExample } from '../shared'

async function main(): Promise<void> {
  header('IEO  — International Energy Outlook')

  // Discover the latest available IEO publication year.
  const ieoListing = await fetchJson<{ response: { routes: { id: string }[] } }>('/routes/ieo')
  const years = ieoListing.response.routes.map((r) => r.id).filter((y) => /^\d{4}$/.test(y))
  const year = years.sort().reverse()[0]
  if (!year) throw new Error('No IEO year found in upstream route listing')
  log(`Using IEO publication year: ${year}`)

  subheader(`1. Find facets (ieo/${year})`)
  const facets = await fetchJson<{ response: { facetOptions: string[] } }>(`/routes/ieo/${year}/facet`)
  log('Available facets:', facets.response.facetOptions)

  subheader(`2. Region facet values (first 10) — ieo/${year}/facet/regionId`)
  const countries = await fetchJson<{ response: { facets: { id: string; name?: string }[] } }>(
    `/routes/ieo/${year}/facet/regionId`,
  )
  for (const f of countries.response.facets.slice(0, 10)) {
    log(`  - ${f.id.padEnd(8)} ${f.name ?? ''}`)
  }

  subheader(`3. Query — annual projection 2025–2030 (top rows) for ieo/${year}`)
  const r = await queryDomain('ieo', year, {
    frequency: 'annual',
    start: '2025',
    end: '2030',
    length: 5,
  })
  log(`Total: ${r.response.total}`)
  for (const row of r.response.data) log(`  ${JSON.stringify(row)}`)
}

runExample(main)
