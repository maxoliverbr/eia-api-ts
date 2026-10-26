/**
 * examples/domains/seds.ts
 *
 * SEDS — State Energy Data System
 *
 * Run:  bun dev
 *       bun run examples/domains/seds.ts
 */
import { fetchJson, log, queryDomain, header, subheader, runExample } from '../shared'

async function main(): Promise<void> {
  header('SEDS  — State Energy Data System')

  subheader('1. List facets (seds facets live at the domain level, not under /data)')
  const facets = await fetchJson<{ response: { facetOptions: string[] } }>('/routes/seds/facet')
  log('Available facets:', facets.response.facetOptions)

  subheader('2. State facet (first 5) — /routes/seds/facet/stateId')
  const states = await fetchJson<{ response: { facets: { id: string; name?: string }[] } }>(
    '/routes/seds/facet/stateId',
  )
  for (const f of states.response.facets.slice(0, 5)) log(`  - ${f.id.padEnd(6)} ${f.name ?? ''}`)

  subheader('3. Texas total energy consumption, 2020–2023')
  const tx = await queryDomain('seds', 'data', {
    frequency: 'annual',
    start: '2020',
    end: '2023',
    facets: { stateId: ['TX'] },
    length: 5,
  })
  log(`Total: ${tx.response.total}`)
  for (const row of tx.response.data) log(`  ${JSON.stringify(row)}`)

  subheader('4. California residential electricity, 2022 — seds/data has no `sectorId` facet')
  const ca = await queryDomain('seds', 'data', {
    frequency: 'annual',
    start: '2022',
    end: '2022',
    facets: { stateId: ['CA'], seriesId: ['ESRCP'] },
    length: 3,
  })
  for (const row of ca.response.data) log(`  ${JSON.stringify(row)}`)
}

runExample(main)
