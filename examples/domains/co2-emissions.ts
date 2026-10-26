/**
 * examples/domains/co2-emissions.ts
 *
 * CO2 Emissions — state-level aggregates and fuel coefficients
 *
 * Run:  bun dev
 *       bun run examples/domains/co2-emissions.ts
 */
import { log, queryDomain, header, subheader, runExample } from '../shared'

async function main(): Promise<void> {
  header('CO2 Emissions  — state-level aggregates & fuel coefficients')

  subheader('1. Aggregates by state (top producers, 2022)')
  const agg = await queryDomain('co2-emissions', 'co2-emissions-aggregates', {
    frequency: 'annual',
    start: '2022',
    end: '2022',
    facets: { sectorId: ['EC'] }, // electric power
    sort: [{ column: 'value', direction: 'desc' }],
    length: 10,
  })
  log(`Total: ${agg.response.total}`)
  for (const row of agg.response.data) log(`  ${JSON.stringify(row)}`)

  subheader('2. Carbon coefficients by fuel')
  const coef = await queryDomain('co2-emissions', 'co2-emissions-and-carbon-coefficients', {
    frequency: 'annual',
    start: '2022',
    end: '2022',
    length: 10,
  })
  log(`Total: ${coef.response.total}`)
  for (const row of coef.response.data) log(`  ${JSON.stringify(row)}`)
}

runExample(main)
