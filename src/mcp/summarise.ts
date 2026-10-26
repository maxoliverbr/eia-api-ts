/**
 * Per-series summary statistics over raw EIA query rows. Lifted from
 * examples/agents/06-mastra-ontology-electricity-carbon.ts so the MCP
 * `query_with_summary` tool returns the same shape as the mastra example.
 */

export type RawEiaRow = Record<string, unknown>

export type SummaryResult = {
  route: string
  totalSeries: number
  totalRows: number
  bySeries: {
    series: string
    description: string | undefined
    units: string | undefined
    periodRange: [string, string]
    count: number
    min: number
    max: number
    avg: number
    latest: { period: string; value: number }
    yoyChangePct: number | null
  }[]
  sampleRow?: RawEiaRow
}

const toNum = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.length > 0) {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

export const summarizeRows = (route: string, rows: RawEiaRow[]): SummaryResult => {
  const withValues = rows.filter((r) => toNum(r['value']) !== null)
  const bySeries = new Map<string, RawEiaRow[]>()
  for (const r of withValues) {
    const key = (r['series'] as string | undefined) ?? 'unknown'
    const arr = bySeries.get(key) ?? []
    arr.push(r)
    bySeries.set(key, arr)
  }
  const seriesOut = [...bySeries.entries()].map(([series, group]) => {
    const sorted = [...group].sort((a, b) =>
      String(a['period'] ?? '').localeCompare(String(b['period'] ?? '')),
    )
    const values = sorted.map((r) => toNum(r['value']) as number)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const avg = values.reduce((a, b) => a + b, 0) / values.length
    const last = sorted[sorted.length - 1]
    const prev = sorted[sorted.length - 2]
    const yoy =
      last && prev
        ? (((toNum(last['value']) as number) - (toNum(prev['value']) as number)) /
            Math.abs(toNum(prev['value']) as number)) *
          100
        : null
    return {
      series,
      description: last?.['series-description'] as string | undefined,
      units: last?.['units'] as string | undefined,
      periodRange: [String(sorted[0]?.['period'] ?? ''), String(last?.['period'] ?? '')] as [string, string],
      count: values.length,
      min,
      max,
      avg,
      latest: { period: String(last?.['period'] ?? ''), value: toNum(last?.['value']) as number },
      yoyChangePct: yoy,
    }
  })
  return {
    route,
    totalSeries: seriesOut.length,
    totalRows: rows.length,
    bySeries: seriesOut,
    sampleRow: rows[0],
  }
}
