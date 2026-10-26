/**
 * examples/05-query-get.ts
 *
 * Demonstrates:  GET /query
 *
 * Useful for ad-hoc calls; uses URL query string for simple params.
 * Facet filters are awkward in query strings — use POST /query for those.
 *
 * Run:
 *   bun dev
 *   bun run examples/05-query-get.ts
 */
import { fetchJson, log, header, subheader, dump, runExample } from './shared'

type QueryResponse = {
  response: {
    data: Record<string, unknown>[]
    total: number
    frequency?: string
    dateFormat?: string
    description?: string
  }
  request?: { command?: string[] }
}

async function main(): Promise<void> {
  header('GET /query  — simplest call: aggregate coal production, last 5 years')
  const r1 = await fetchJson<QueryResponse>(
    '/query?domain=coal&route=aggregate-production&frequency=annual' +
      '&start=2019&end=2024&data=period,production&length=10',
  )
  log(`Description: ${r1.response.description}`)
  log(`Total:       ${r1.response.total}`)
  log(`Frequency:   ${r1.response.frequency}`)
  log(`DateFormat:  ${r1.response.dateFormat}`)
  log('Rows:')
  for (const row of r1.response.data) {
    log(`  ${JSON.stringify(row)}`)
  }

  subheader('GET /query  — with sort and length')
  const r2 = await fetchJson<QueryResponse>(
    '/query?domain=total-energy&route=data&frequency=monthly' +
      '&start=2024-01&end=2024-06&length=3',
  )
  log(`Description: ${r2.response.description}`)
  for (const row of r2.response.data) log(`  ${JSON.stringify(row)}`)

  subheader('GET /query  — electricity retail sales, last 3 years')
  const r3 = await fetchJson<QueryResponse>(
    '/query?domain=electricity&route=retail-sales&frequency=annual' +
      '&start=2021&end=2023&data=price,revenue&length=5',
  )
  log('First 5 rows:')
  for (const row of r3.response.data.slice(0, 5)) log(`  ${JSON.stringify(row)}`)

  subheader('GET /query  — error: unknown domain (400)')
  try {
    await fetchJson('/query?domain=nope&route=x')
  } catch (err) {
    const e = err as { status: number; body: { error: string; message: string; domain: string } }
    log(`Status: ${e.status}`)
    log(`Error:  ${e.body.error}`)
    log(`Hint:   ${e.body.message}`)
  }
}

runExample(main)
