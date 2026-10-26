/**
 * examples/domains/nuclear-outages.ts
 *
 * Nuclear Outages — facility, generator, and U.S. summary
 *
 * Run:  bun dev
 *       bun run examples/domains/nuclear-outages.ts
 */
import { log, queryDomain, header, subheader, runExample } from '../shared'

async function main(): Promise<void> {
  header('Nuclear Outages  — facility, generator, and U.S. summary')

  subheader('1. Facility outages, 2024 (first 5)')
  const fac = await queryDomain('nuclear-outages', 'facility-nuclear-outages', {
    frequency: 'daily',
    start: '2024-01',
    end: '2024-12',
    length: 5,
  })
  log(`Total: ${fac.response.total}`)
  for (const row of fac.response.data) log(`  ${JSON.stringify(row)}`)

  subheader('2. Generator outages, 2024 (first 3)')
  const gen = await queryDomain('nuclear-outages', 'generator-nuclear-outages', {
    frequency: 'daily',
    start: '2024-06',
    end: '2024-06',
    length: 3,
  })
  for (const row of gen.response.data) log(`  ${JSON.stringify(row)}`)

  subheader('3. U.S. summary, 2024 Q1 (first 3)')
  const us = await queryDomain('nuclear-outages', 'us-nuclear-outages', {
    frequency: 'daily',
    start: '2024-01',
    end: '2024-03',
    length: 3,
  })
  for (const row of us.response.data) log(`  ${JSON.stringify(row)}`)
}

runExample(main)
