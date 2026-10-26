/**
 * examples/agents/02-trend-analysis.ts
 *
 * Realistic multi-step flow:
 *   1. Fetch monthly US total electricity primary consumption (ELETPUS) 2020-01 → 2024-12
 *   2. Aggregate to annual totals in-process (sum of 12 monthly values)
 *   3. Compute year-over-year change
 *   4. Print a tiny ASCII bar chart
 *
 * Run:  bun dev
 *       bun run examples/agents/02-trend-analysis.ts
 */
import { fetchJson, log, header, runExample } from '../shared'

type Row = { period: string; value: number | string; [k: string]: unknown }
type QueryResponse = { response: { data: Row[]; total: number; description?: string } }

const toNumber = (v: unknown): number | null => {
  if (typeof v === 'number') return v
  if (typeof v === 'string' && v.length > 0) {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

async function fetchMonthlySeries(): Promise<Row[]> {
  const r = await fetchJson<QueryResponse>('/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      domain: 'total-energy',
      route: 'data',
      data: ['value'],
      frequency: 'monthly',
      start: '2020-01',
      end: '2024-12',
      facets: { msn: ['ELETPUS'] },
      length: 100,
    }),
  })
  return r.response.data
}

function aggregateAnnual(rows: Row[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const r of rows) {
    const year = r.period.slice(0, 4)
    const v = toNumber(r.value)
    if (v === null) continue
    totals.set(year, (totals.get(year) ?? 0) + v)
  }
  return totals
}

function bar(value: number, max: number, width = 40): string {
  if (max === 0) return ''
  const n = Math.round((value / max) * width)
  return '█'.repeat(n)
}

async function main(): Promise<void> {
  header('Trend analysis: monthly → annual → YoY change')

  const monthly = await fetchMonthlySeries()
  log(`Fetched ${monthly.length} monthly rows`)

  const annual = aggregateAnnual(monthly)
  const years = [...annual.keys()].sort()
  const values = years.map((y) => annual.get(y) ?? 0)
  const max = Math.max(...values)

  log('\nAnnual totals (sum of 12 monthly observations per year, million kWh):')
  for (let i = 0; i < years.length; i++) {
    const y = years[i]
    const v = values[i]
    if (!y || v === undefined) continue

    let yoyStr: string
    if (i === 0) {
      yoyStr = '   —  '
    } else {
      const prev = values[i - 1] ?? 0
      const yoy = prev === 0 ? 0 : ((v - prev) / prev) * 100
      yoyStr = `${yoy >= 0 ? '+' : ''}${yoy.toFixed(1).padStart(5)}%`
    }
    log(`${y}  ${v.toFixed(2).padStart(10)}  ${yoyStr}  ${bar(v, max)}`)
  }
}

runExample(main)
