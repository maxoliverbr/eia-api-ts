/**
 * examples/domains/electricity.ts
 *
 * Electricity — facility fuel, generation, capacity, retail sales
 *
 * Run:  bun dev
 *       bun run examples/domains/electricity.ts
 */
import { log, queryDomain, header, subheader, runExample } from '../shared'

async function main(): Promise<void> {
  header('Electricity  — generation, capacity, retail sales')

  subheader('1. Operating generator capacity, 2023')
  const cap = await queryDomain('electricity', 'operating-generator-capacity', {
    frequency: 'monthly',
    start: '2023-01',
    end: '2023-12',
    length: 5,
  })
  log(`Total: ${cap.response.total}`)
  for (const row of cap.response.data) log(`  ${JSON.stringify(row)}`)

  subheader('2. Retail sales by state, 2022 (top 5 by revenue)')
  const retail = await queryDomain('electricity', 'retail-sales', {
    frequency: 'annual',
    start: '2022',
    end: '2022',
    sort: [{ column: 'revenue', direction: 'desc' }],
    length: 5,
  })
  for (const row of retail.response.data) log(`  ${JSON.stringify(row)}`)

  subheader('3. Electric power operational data — natural gas only (CA, 2024)')
  const op = await queryDomain('electricity', 'electric-power-operational-data', {
    frequency: 'monthly',
    start: '2024-01',
    end: '2024-03',
    facets: { fueltypeid: ['NG'], location: ['CA'] },
    length: 5,
  })
  for (const row of op.response.data) log(`  ${JSON.stringify(row)}`)
}

runExample(main)
