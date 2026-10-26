/**
 * examples/03-facets.ts
 *
 * Demonstrates:
 *   GET /routes/<path>/facet            — list of facet IDs available
 *   GET /routes/<path>/facet/:facetId   — possible values for one facet
 *   GET /schema/<path>                   — full FinalRoute metadata
 *
 * Run:
 *   bun dev
 *   bun run examples/03-facets.ts
 */
import { fetchJson, log, header, subheader, runExample } from './shared'

type FacetList = { response: { totalFacetOptions: number; facetOptions: string[] } }
type FacetDetails = { response: { totalFacets: number; facets: { id: string; name: string; alias?: string }[] } }
type FinalRoute = {
  response: {
    id: string
    name: string
    description: string
    frequency: { id: string; query: string; format: string; description: string }[]
    facets: { id: string; description: string }[]
    data: Record<string, unknown>
    startPeriod: string | null
    endPeriod: string | null
    defaultDateFormat: string
    defaultFrequency: string
  }
}

async function main(): Promise<void> {
  header('GET /routes/coal/aggregate-production/facet  — list facet IDs')
  const list = await fetchJson<FacetList>('/routes/coal/aggregate-production/facet')
  log(`Total: ${list.response.totalFacetOptions}`)
  log('Available facets:')
  for (const f of list.response.facetOptions) log(`  - ${f}`)

  subheader('GET /routes/coal/aggregate-production/facet/stateRegionId  — values for one facet')
  const stateValues = await fetchJson<FacetDetails>('/routes/coal/aggregate-production/facet/stateRegionId')
  log(`Total values: ${stateValues.response.totalFacets}`)
  log('First 10:')
  for (const f of stateValues.response.facets.slice(0, 10)) {
    log(`  - ${f.id.padEnd(6)} ${f.name ?? ''}`)
  }

  subheader('GET /routes/coal/aggregate-production/facet/coalRankId  — categorical facet')
  const rankValues = await fetchJson<FacetDetails>(
    '/routes/coal/aggregate-production/facet/coalRankId',
  )
  log(`Total coalRankId values: ${rankValues.response.totalFacets}`)
  log('All values:')
  for (const f of rankValues.response.facets) {
    log(`  - ${f.id} (${f.name ?? ''})`)
  }

  header('GET /schema/coal/aggregate-production  — full route metadata')
  const schema = await fetchJson<FinalRoute>('/schema/coal/aggregate-production')
  log('id:                ', schema.response.id)
  log('name:              ', schema.response.name)
  log('defaultFrequency:  ', schema.response.defaultFrequency)
  log('defaultDateFormat: ', schema.response.defaultDateFormat)
  log('startPeriod:       ', schema.response.startPeriod)
  log('endPeriod:         ', schema.response.endPeriod)
  log('frequencies:')
  for (const f of schema.response.frequency) {
    log(`  - ${f.id.padEnd(10)} query=${f.query} format=${f.format}`)
  }
  log('facets:')
  for (const f of schema.response.facets) {
    log(`  - ${f.id.padEnd(12)} ${f.description ?? ''}`)
  }
  log('data columns:')
  for (const [k, v] of Object.entries(schema.response.data ?? {})) {
    log(`  - ${k}: ${JSON.stringify(v)}`)
  }
}

runExample(main)
