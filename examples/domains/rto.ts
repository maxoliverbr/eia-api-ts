/**
 * examples/domains/rto.ts
 *
 * RTO — daily/regional operational data for U.S. RTOs (CAISO, ERCOT, MISO, …)
 *
 * Run:  bun dev
 *       bun run examples/domains/rto.ts
 */
import { log, queryDomain, header, subheader, runExample } from '../shared'

async function main(): Promise<void> {
  header('RTO  — Regional Transmission Organization operational data')

  subheader('1. Daily fuel-type data (PJM, 2024-01)')
  const fuel = await queryDomain('rto', 'daily-fuel-type-data', {
    frequency: 'daily',
    start: '2024-01-01',
    end: '2024-01-07',
    length: 5,
  })
  log(`Total: ${fuel.response.total}`)
  for (const row of fuel.response.data) log(`  ${JSON.stringify(row)}`)

  subheader('2. Daily region data (ERCOT, 2024-06)')
  const reg = await queryDomain('rto', 'daily-region-data', {
    frequency: 'daily',
    start: '2024-06-01',
    end: '2024-06-07',
    length: 5,
  })
  for (const row of reg.response.data) log(`  ${JSON.stringify(row)}`)

  subheader('3. Hourly interchange (first 5)')
  const inter = await queryDomain('rto', 'interchange-data', {
    frequency: 'hourly',
    start: '2024-01-01',
    end: '2024-01-01',
    length: 5,
  })
  for (const row of inter.response.data) log(`  ${JSON.stringify(row)}`)
}

runExample(main)
