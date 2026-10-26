/**
 * examples/domains/natural-gas.ts
 *
 * Natural Gas — 2-level routes (consumption, price, production, etc.)
 *
 * Run:  bun dev
 *       bun run examples/domains/natural-gas.ts
 */
import { log, queryDomain, header, subheader, runExample } from '../shared'

async function main(): Promise<void> {
  header('Natural Gas  — consumption, price, production, storage, trade')

  subheader('1. Consumption by end use (annual, 2020)')
  const cons = await queryDomain('natural-gas', 'cons/sum', {
    frequency: 'annual',
    start: '2020',
    end: '2020',
    length: 5,
  })
  log(`Total: ${cons.response.total}`)
  for (const row of cons.response.data) log(`  ${JSON.stringify(row)}`)

  subheader('2. Prices (annual, 2020)')
  const price = await queryDomain('natural-gas', 'pri/sum', {
    frequency: 'annual',
    start: '2020',
    end: '2020',
    length: 5,
  })
  for (const row of price.response.data) log(`  ${JSON.stringify(row)}`)

  subheader('3. Production (oilwell counts, 2020)')
  const prod = await queryDomain('natural-gas', 'prod/oilwells', {
    frequency: 'annual',
    start: '2020',
    end: '2020',
    length: 5,
  })
  for (const row of prod.response.data) log(`  ${JSON.stringify(row)}`)

  subheader('4. Weekly storage (latest week)')
  const stor = await queryDomain('natural-gas', 'stor/wkly', {
    frequency: 'weekly',
    start: '2024-01-01',
    end: '2024-01-07',
    length: 2,
  })
  for (const row of stor.response.data) log(`  ${JSON.stringify(row)}`)

  subheader('5. Imports (2020)')
  const imp = await queryDomain('natural-gas', 'move/impc', {
    frequency: 'annual',
    start: '2020',
    end: '2020',
    length: 3,
  })
  for (const row of imp.response.data) log(`  ${JSON.stringify(row)}`)
}

runExample(main)
