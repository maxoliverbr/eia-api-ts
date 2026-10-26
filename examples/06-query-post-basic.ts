/**
 * examples/06-query-post-basic.ts
 *
 * Demonstrates:  POST /query  — basic patterns (with sort, with pagination)
 *
 * Run:
 *   bun dev
 *   bun run examples/06-query-post-basic.ts
 */
import { fetchJson, log, header, subheader, runExample } from './shared'

type QueryResponse = {
  response: { data: Record<string, unknown>[]; total: number; description?: string; frequency?: string }
}

async function main(): Promise<void> {
  header('POST /query  — basic call with column selection')
  const r1 = await fetchJson<QueryResponse>('/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      domain: 'coal',
      route: 'aggregate-production',
      frequency: 'annual',
      data: ['production'],
      start: '2020',
      end: '2024',
      length: 10,
    }),
  })
  log(`Description: ${r1.response.description}`)
  log(`Total:       ${r1.response.total}`)
  for (const row of r1.response.data) log(`  ${JSON.stringify(row)}`)

  subheader('POST /query  — with sort (period descending)')
  const r2 = await fetchJson<QueryResponse>('/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      domain: 'electricity',
      route: 'retail-sales',
      frequency: 'annual',
      start: '2020',
      end: '2024',
      sort: [{ column: 'period', direction: 'desc' }],
      length: 5,
    }),
  })
  for (const row of r2.response.data) log(`  ${JSON.stringify(row)}`)

  subheader('POST /query  — with pagination (offset)')
  const page1 = await fetchJson<QueryResponse>('/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      domain: 'international',
      route: 'data',
      frequency: 'annual',
      start: '2020',
      end: '2023',
      length: 3,
      offset: 0,
    }),
  })
  log(`Page 1 (offset=0, length=3): ${page1.response.data.length} rows`)

  const page2 = await fetchJson<QueryResponse>('/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      domain: 'international',
      route: 'data',
      frequency: 'annual',
      start: '2020',
      end: '2023',
      length: 3,
      offset: 3,
    }),
  })
  log(`Page 2 (offset=3, length=3): ${page2.response.data.length} rows`)
  for (const row of page2.response.data) log(`  ${JSON.stringify(row)}`)

  subheader('POST /query  — multiple sort columns')
  const r3 = await fetchJson<QueryResponse>('/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      domain: 'electricity',
      route: 'retail-sales',
      frequency: 'annual',
      start: '2022',
      end: '2023',
      sort: [
        { column: 'period', direction: 'desc' },
        { column: 'stateid', direction: 'asc' },
      ],
      length: 3,
    }),
  })
  for (const row of r3.response.data) log(`  ${JSON.stringify(row)}`)
}

runExample(main)
