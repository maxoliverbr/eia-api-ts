/**
 * examples/domains/coal.ts
 *
 * Coal — production, consumption, exports/imports, prices, shipments
 *
 * Run:  bun dev
 *       bun run examples/domains/coal.ts
 */
import { log, queryDomain, header, subheader, runExample } from '../shared'

async function main(): Promise<void> {
  header('Coal  — production, shipments, prices, exports/imports')

  subheader('1. Aggregate U.S. production 2015–2024')
  const prod = await queryDomain('coal', 'aggregate-production', {
    frequency: 'annual',
    start: '2015',
    end: '2024',
    sort: [{ column: 'period', direction: 'asc' }],
    length: 20,
  })
  log(`Total: ${prod.response.total}`)
  for (const row of prod.response.data) log(`  ${JSON.stringify(row)}`)

  subheader('2. Recent mine → plant shipments (first 5)')
  const ship = await queryDomain('coal', 'shipments/by-mine-by-plant', {
    frequency: 'annual',
    start: '2022',
    end: '2023',
    length: 5,
  })
  log(`Total: ${ship.response.total}`)
  for (const row of ship.response.data) log(`  ${JSON.stringify(row)}`)

  subheader('3. Coal price by rank (2023)')
  const price = await queryDomain('coal', 'price-by-rank', {
    frequency: 'annual',
    start: '2023',
    end: '2023',
    length: 5,
  })
  for (const row of price.response.data) log(`  ${JSON.stringify(row)}`)

  subheader('4. Coal exports (2023)')
  const exp = await queryDomain('coal', 'exports-imports-quantity-price', {
    frequency: 'annual',
    start: '2023',
    end: '2023',
    length: 5,
  })
  for (const row of exp.response.data) log(`  ${JSON.stringify(row)}`)
}

runExample(main)
