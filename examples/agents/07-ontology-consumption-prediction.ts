/**
 * examples/agents/07-ontology-consumption-prediction.ts
 *
 * Ontology-driven consumption prediction.
 *
 * Distinct from example 06 (electricity generation + carbon footprint):
 *   - Topic:   consumption (not generation)
 *   - Horizon: short-term forecast vs recent history (not year-by-year CO2)
 *   - Style:   plain fetch + shared.ts helpers (no LLM dependency)
 *
 * End-to-end flow:
 *   1. GET /ontology                       — counts + endpoint index
 *   2. GET /ontology/classes?parentClass=Sector            — pick sectors
 *   3. GET /ontology/relations?predicate=consumes         — sector → fuel edges
 *   4. GET /ontology/relations?predicate=forecastedBy     — projection domains
 *   5. GET /ontology/domains/seds                          — historical bridge
 *   6. GET /ontology/domains/steo                          — forecast bridge
 *   7. POST /query  total-energy (annual 2020–2023)        — historical
 *   8. POST /query  steo         (monthly next 24 months)  — forecast
 *   9. Pretty-print a 6-row comparison table
 *
 * The ontology steps (1–6) hit the in-memory model — no upstream EIA call.
 * The data steps (7–8) hit the upstream EIA API and require a valid key.
 *
 * Run:  bun dev
 *       bun run examples/agents/07-ontology-consumption-prediction.ts
 *
 * Note on data shape: STEO publishes fuel-level U.S. forecasts, not broken
 * out by sector. The forecast mean is therefore the same across sectors of
 * the same fuel — that limitation is called out in the markdown companion
 * and reflected in the printed table by tagging forecast cells with the
 * source fuel id.
 */
import { fetchJson, log, header, subheader, runExample } from '../shared'
import type { OntologyClass, OntologyRelation, DomainOntologyMapping } from '../../src/schemas/ontology'

type QueryResponse = { response: { data: Record<string, unknown>[]; total: number } }
type ClassList = { total: number; classes: OntologyClass[] }
type RelationList = { total: number; relations: OntologyRelation[] }

type Sector = 'Residential' | 'Commercial' | 'Industrial'
type Fuel = 'NaturalGas' | 'Electricity'

// EIA MSN (Monthly State Name) codes for national consumption in
// total-energy. Each code = <2-letter fuel><2-letter sector> + "PUS".
// Verified against the live EIA API; the example degrades gracefully if
// any specific code stops publishing.
const HISTORICAL_MSN: Record<Sector, Record<Fuel, string>> = {
  Residential: { NaturalGas: 'NGRCPUS', Electricity: 'ESRCPUS' },
  Commercial:  { NaturalGas: 'NGCCPUS', Electricity: 'ESCCPUS' },
  Industrial:  { NaturalGas: 'NGICPUS', Electricity: 'ESICPUS' },
}

// STEO total U.S. consumption series, monthly, next ~24 months.
const FORECAST_SERIES: Record<Fuel, string> = {
  NaturalGas: 'NGTCPUS',
  Electricity: 'ELTCPUS',
}

const FUELS: Fuel[] = ['NaturalGas', 'Electricity']
const SECTORS: Sector[] = ['Residential', 'Commercial', 'Industrial']

const toNumber = (v: unknown): number | null => {
  if (typeof v === 'number') return v
  if (typeof v === 'string' && v.length > 0) {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

const mean = (rows: Record<string, unknown>[], key = 'value'): number | null => {
  const xs: number[] = []
  for (const r of rows) {
    const v = toNumber(r[key])
    if (v !== null) xs.push(v)
  }
  if (xs.length === 0) return null
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

async function pickSectors(): Promise<Sector[]> {
  const { classes } = await fetchJson<ClassList>('/ontology/classes?parentClass=Sector')
  const ids = new Set(classes.map((c) => c.id))
  return SECTORS.filter((s) => ids.has(s))
}

async function fuelsConsumedBy(sector: Sector): Promise<Fuel[]> {
  // The ontology encodes "Sector –consumes→ Fuel" edges.
  // We use those to confirm the (sector × fuel) pairs we plan to query
  // are actually supported by the conceptual model.
  const { relations } = await fetchJson<RelationList>('/ontology/relations?subject=' + sector)
  const consumed = relations
    .filter((r) => r.predicate === 'consumes')
    .map((r) => r.object)
  const out: Fuel[] = []
  for (const f of FUELS) if (consumed.includes(f)) out.push(f)
  return out
}

async function fetchHistorical(sector: Sector, fuel: Fuel): Promise<number | null> {
  const msn = HISTORICAL_MSN[sector][fuel]
  const r = await fetchJson<QueryResponse>('/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      domain: 'total-energy',
      route: 'data',
      frequency: 'annual',
      data: ['value'],
      start: '2020',
      end: '2023',
      facets: { msn: [msn] },
      length: 50,
    }),
  })
  return mean(r.response.data)
}

async function fetchForecast(fuel: Fuel): Promise<number | null> {
  const seriesId = FORECAST_SERIES[fuel]
  // Forecast window: STEO publishes the next ~24 months from the current
  // date. We use a wide window and rely on graceful trimming upstream.
  const now = new Date()
  const startYear = now.getFullYear()
  const endYear = startYear + 2
  const r = await fetchJson<QueryResponse>('/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      domain: 'steo',
      route: 'data',
      frequency: 'monthly',
      data: ['value'],
      start: `${startYear}-01`,
      end: `${endYear}-12`,
      facets: { seriesId: [seriesId] },
      length: 5000,
    }),
  })
  return mean(r.response.data)
}

async function main(): Promise<void> {
  header('Ontology-driven consumption prediction')

  // ---- 1. Ontology index ----
  subheader('1. GET /ontology  — index')
  const index = await fetchJson<{
    classCount: number
    relationCount: number
    domainMappingCount: number
  }>('/ontology')
  log(`  ${index.classCount} classes, ${index.relationCount} relations, ${index.domainMappingCount} domain mappings`)

  // ---- 2. Pick sectors from the Sector hierarchy ----
  subheader('2. GET /ontology/classes?parentClass=Sector  — pick 3 sectors')
  const sectors = await pickSectors()
  log(`  Available sectors: ${sectors.join(', ')}`)
  if (sectors.length < 3) throw new Error('Expected at least 3 sectors in the ontology')
  log(`  Using: ${sectors.join(', ')}`)

  // ---- 3. Sector → fuel consumption edges ----
  subheader('3. GET /ontology/relations?subject=<Sector>  — fuels consumed per sector')
  for (const s of sectors) {
    const fuels = await fuelsConsumedBy(s)
    log(`  ${s.padEnd(12)} consumes → ${fuels.join(', ')}`)
  }

  // ---- 4. Find projection domains ----
  subheader('4. GET /ontology/relations?predicate=forecastedBy  — projection domains')
  const { relations: forecastRels } = await fetchJson<RelationList>(
    '/ontology/relations?predicate=forecastedBy'
  )
  const evidence = new Set<string>()
  for (const r of forecastRels) for (const d of r.evidenceDomains) evidence.add(d)
  log(`  Projection domains (by evidence): ${[...evidence].join(', ')}`)
  if (!evidence.has('steo')) throw new Error('Expected STEO to appear as a projection domain')

  // ---- 5. Historical + forecast domain mappings ----
  subheader('5. GET /ontology/domains/{seds,steo}  — bridge ontology → EIA domains')
  const seds = await fetchJson<DomainOntologyMapping>('/ontology/domains/seds')
  log(`  seds: scope=${seds.geographyScope}  flows=[${seds.energyFlows.join(', ')}]  hasEmissions=${seds.hasEmissions}`)
  const steo = await fetchJson<DomainOntologyMapping>('/ontology/domains/steo')
  log(`  steo: scope=${steo.geographyScope}  flows=[${steo.energyFlows.join(', ')}]  isProjection=${steo.isProjection}`)
  log(`  steo temporalGranularities: ${steo.temporalGranularities.join(', ')}`)

  // ---- 6. Pull forecasts (once per fuel; STEO is fuel-level) ----
  subheader('6. POST /query  steo  — fetch forecast (next 24 months)')
  const forecastByFuel = new Map<Fuel, number | null>()
  for (const fuel of FUELS) {
    const m = await fetchForecast(fuel)
    forecastByFuel.set(fuel, m)
    log(`  ${fuel.padEnd(12)} forecast mean (24 mo) = ${m === null ? 'no data' : m.toFixed(2)}  [series=${FORECAST_SERIES[fuel]}]`)
  }

  // ---- 7. Pull historicals (per cell) ----
  subheader('7. POST /query  total-energy  — fetch historical (annual 2020–2023)')
  const historical = new Map<string, number | null>()
  for (const sector of sectors) {
    for (const fuel of FUELS) {
      const m = await fetchHistorical(sector, fuel)
      historical.set(`${sector}|${fuel}`, m)
      const tag = m === null ? 'no data' : m.toFixed(2)
      log(`  ${sector.padEnd(12)} × ${fuel.padEnd(12)} hist mean = ${tag}  [msn=${HISTORICAL_MSN[sector][fuel]}]`)
    }
  }

  // ---- 8. Print comparison table ----
  subheader('8. Comparison table: historical vs STEO forecast')
  log('')
  log('  ' + 'sector'.padEnd(13) + 'fuel'.padEnd(13) + 'historical'.padStart(13) + 'forecast'.padStart(13) + '   Δ%')
  log('  ' + '-'.repeat(13) + ' '.repeat(0) + '-'.repeat(13) + '-'.repeat(13) + '-'.repeat(13) + ' ' + '-'.repeat(7))
  for (const sector of sectors) {
    for (const fuel of FUELS) {
      const h = historical.get(`${sector}|${fuel}`) ?? null
      const f = forecastByFuel.get(fuel) ?? null
      const cell = (v: number | null): string => (v === null ? '   no data' : v.toFixed(2).padStart(11))
      let delta = '   —'
      if (h !== null && h !== 0 && f !== null) {
        const pct = ((f - h) / h) * 100
        const sign = pct >= 0 ? '+' : ''
        delta = `${sign}${pct.toFixed(1)}%`
      }
      log(`  ${sector.padEnd(13)}${fuel.padEnd(13)}${cell(h)}${cell(f)}  ${delta.padStart(7)}`)
    }
  }
  log('')
  log('  Forecast is fuel-level (STEO does not break out by sector);')
  log('  the same forecast mean is repeated across sectors of the same fuel.')
}

runExample(main)
