/**
 * examples/domains/densified-biomass.ts
 *
 * Densified Biomass — wood pellet industry data
 *
 * Run:  bun dev
 *       bun run examples/domains/densified-biomass.ts
 */
import { log, queryDomain, header, subheader, runExample } from '../shared'

async function main(): Promise<void> {
  header('Densified Biomass  — wood pellets & biomass industry data')

  subheader('1. Production by region, 2023')
  const prod = await queryDomain('densified-biomass', 'production-by-region', {
    frequency: 'monthly',
    start: '2023-01',
    end: '2023-12',
    length: 5,
  })
  log(`Total: ${prod.response.total}`)
  for (const row of prod.response.data) log(`  ${JSON.stringify(row)}`)

  subheader('2. Sales & price by region, 2023')
  const sales = await queryDomain('densified-biomass', 'sales-and-price-by-region', {
    frequency: 'monthly',
    start: '2023-06',
    end: '2023-12',
    length: 5,
  })
  for (const row of sales.response.data) log(`  ${JSON.stringify(row)}`)

  subheader('3. Wood pellet plants (annual — wood-pellet-plants is annual-only)')
  const plants = await queryDomain('densified-biomass', 'wood-pellet-plants', {
    frequency: 'annual',
    start: '2023',
    end: '2023',
    length: 3,
  })
  for (const row of plants.response.data) log(`  ${JSON.stringify(row)}`)
}

runExample(main)
