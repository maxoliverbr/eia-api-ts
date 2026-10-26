/**
 * examples/domains/state-electricity-profiles.ts
 *
 * SEP — State Electricity Profiles
 *
 * Run:  bun dev
 *       bun run examples/domains/state-electricity-profiles.ts
 */
import { log, queryDomain, header, subheader, runExample } from '../shared'

async function main(): Promise<void> {
  header('State Electricity Profiles  — capability, emissions, efficiency, summary')

  subheader('1. Capability (all states, 2022, first 5)')
  const cap = await queryDomain('state-electricity-profiles', 'capability', {
    frequency: 'annual',
    start: '2022',
    end: '2022',
    length: 5,
  })
  log(`Total: ${cap.response.total}`)
  for (const row of cap.response.data) log(`  ${JSON.stringify(row)}`)

  subheader('2. Emissions by state by fuel (Texas, 2022, first 5)')
  const em = await queryDomain('state-electricity-profiles', 'emissions-by-state-by-fuel', {
    frequency: 'annual',
    start: '2022',
    end: '2022',
    facets: { stateid: ['TX'], fuelid: ['NG'] },
    length: 5,
  })
  log(`Total: ${em.response.total}`)
  for (const row of em.response.data) log(`  ${JSON.stringify(row)}`)

  subheader('3. Summary (CA + TX, 2022)  — state-electricity-profiles/summary uses `stateID` (capital ID)')
  const sum = await queryDomain('state-electricity-profiles', 'summary', {
    frequency: 'annual',
    start: '2022',
    end: '2022',
    facets: { stateID: ['CA', 'TX'] },
    length: 5,
  })
  log(`Total: ${sum.response.total}`)
  for (const row of sum.response.data) log(`  ${JSON.stringify(row)}`)
}

runExample(main)
