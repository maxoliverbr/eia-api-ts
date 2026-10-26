/**
 * examples/agents/03-multi-domain-comparison.ts
 *
 * Realistic cross-domain agent flow:
 *   1. Fetch state CO2 emissions for 2022 (state-electricity-profiles / emissions-by-state-by-fuel)
 *   2. Fetch state net electricity generation for 2022 (electricity / electric-power-operational-data)
 *   3. Compute emissions intensity per state (metric tons CO2 per MWh)
 *   4. Print top-5 and bottom-5 states
 *
 * Run:  bun dev
 *       bun run examples/agents/03-multi-domain-comparison.ts
 */
import { fetchJson, log, header, subheader, runExample } from '../shared'

type Co2Row = { stateid: string; 'co2-thousand-metric-tons'?: number | string; [k: string]: unknown }
type GenRow = { location: string; generation?: number | string; [k: string]: unknown }

type Co2Response = { response: { data: Co2Row[]; total: number } }
type GenResponse = { response: { data: GenRow[]; total: number } }

const toNumber = (v: unknown): number | null => {
  if (typeof v === 'number') return v
  if (typeof v === 'string' && v.length > 0) {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

async function fetchCo2(year: string): Promise<Map<string, number>> {
  const r = await fetchJson<Co2Response>('/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      domain: 'state-electricity-profiles',
      route: 'emissions-by-state-by-fuel',
      data: ['co2-thousand-metric-tons'],
      frequency: 'annual',
      start: year,
      end: year,
      facets: { fuelid: ['ALL'] },
      length: 5000,
    }),
  })
  const m = new Map<string, number>()
  for (const row of r.response.data) {
    const co2 = toNumber(row['co2-thousand-metric-tons'])
    if (row.stateid && co2 !== null) m.set(row.stateid, co2)
  }
  return m
}

async function fetchGen(year: string): Promise<Map<string, number>> {
  const r = await fetchJson<GenResponse>('/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      domain: 'electricity',
      route: 'electric-power-operational-data',
      data: ['generation'],
      frequency: 'annual',
      start: year,
      end: year,
      facets: { fueltypeid: ['ALL'], sectorid: ['99'] },
      length: 5000,
    }),
  })
  const m = new Map<string, number>()
  for (const row of r.response.data) {
    const gen = toNumber(row.generation)
    if (row.location && gen !== null) m.set(row.location, gen)
  }
  return m
}

function joinByState(
  co2: Map<string, number>,
  gen: Map<string, number>,
): { state: string; co2: number; gen: number; intensity: number }[] {
  const out: { state: string; co2: number; gen: number; intensity: number }[] = []
  for (const [state, c] of co2) {
    const g = gen.get(state)
    // co2 is thousand metric tons; generation is thousand MWh — both share
    // a "thousand" prefix, so intensity below is in metric tons / MWh.
    if (g && g > 0) out.push({ state, co2: c, gen: g, intensity: c / g })
  }
  return out
}

async function main(): Promise<void> {
  header('Multi-domain comparison: CO2 intensity by state, 2022')

  subheader('1. Fetching state CO2 emissions (electric-power sector)…')
  const co2 = await fetchCo2('2022')
  log(`  Got data for ${co2.size} states`)

  subheader('2. Fetching state electricity generation…')
  const gen = await fetchGen('2022')
  log(`  Got data for ${gen.size} states`)

  subheader('3. Joining and computing intensity…')
  const rows = joinByState(co2, gen)
  log(`  Joined ${rows.length} states`)

  subheader('Top 5 — highest CO2 intensity (metric tons / MWh)')
  const top = [...rows].sort((a, b) => b.intensity - a.intensity).slice(0, 5)
  for (const r of top) {
    log(`  ${r.state}  CO2=${r.co2.toFixed(0).padStart(8)} kt  Gen=${r.gen.toFixed(0).padStart(10)} kMWh  Intensity=${r.intensity.toFixed(3)}`)
  }

  subheader('Bottom 5 — lowest CO2 intensity (metric tons / MWh)')
  const bot = [...rows].sort((a, b) => a.intensity - b.intensity).slice(0, 5)
  for (const r of bot) {
    log(`  ${r.state}  CO2=${r.co2.toFixed(0).padStart(8)} kt  Gen=${r.gen.toFixed(0).padStart(10)} kMWh  Intensity=${r.intensity.toFixed(3)}`)
  }
}

runExample(main)
