import type { DomainOntologyMapping, GeographyScope } from '../schemas/ontology'
import type { FrequencyPreset } from '../schemas/domain'
import { DOMAINS } from '../domains'
import type { DomainMeta, SubRouteMeta } from '../schemas/domain'

// ---------------------------------------------------------------------------
// Derivation helpers
// ---------------------------------------------------------------------------

const GEOGRAPHY_SCOPE_FACETS: Array<[string[], GeographyScope]> = [
  [['countryregionid', 'origin', 'destinationOriginCountry'.toLowerCase()], 'international'],
  [['plantid', 'mineid', 'facilityid'], 'facility'],
  [['stateid', 'location', 'stateId'.toLowerCase(), 'minestate', 'plantstate'], 'state'],
]

function deriveGeographyScope(facetsHint: string[]): GeographyScope {
  const lower = facetsHint.map((f) => f.toLowerCase())
  for (const [keys, scope] of GEOGRAPHY_SCOPE_FACETS) {
    if (lower.some((f) => keys.includes(f))) return scope
  }
  return 'national'
}

const FLOW_TAG_MAP: Record<string, string> = {
  production: 'Production',
  consumption: 'Consumption',
  exports: 'Export',
  export: 'Export',
  imports: 'Import',
  import: 'Import',
  storage: 'Storage',
  interchange: 'Transmission',
  transmission: 'Transmission',
  retail: 'RetailSales',
  sales: 'RetailSales',
}

function deriveEnergyFlows(subRoutes: SubRouteMeta[]): string[] {
  const flows = new Set<string>()
  for (const sr of subRoutes) {
    for (const tag of sr.tags) {
      const mapped = FLOW_TAG_MAP[tag.toLowerCase()]
      if (mapped) flows.add(mapped)
    }
  }
  return [...flows]
}

function deriveTemporalGranularities(subRoutes: SubRouteMeta[]): FrequencyPreset[] {
  const freqs = new Set<FrequencyPreset>()
  for (const sr of subRoutes) {
    freqs.add(sr.typicalFrequency)
  }
  return [...freqs]
}

function deriveHasEmissions(domain: DomainMeta): boolean {
  if (domain.id === 'co2-emissions') return true
  return domain.subRoutes.some((sr) =>
    sr.tags.some((t) => t.toLowerCase().includes('emission'))
  )
}

function deriveIsProjection(domain: DomainMeta): boolean {
  return domain.tags.some((t) => t.toLowerCase().includes('projection') || t.toLowerCase().includes('outlook'))
}

// ---------------------------------------------------------------------------
// Hand-authored annotations (the parts derivation cannot infer)
// ---------------------------------------------------------------------------

interface Annotation {
  primaryClasses: string[]
  geographyScopeOverride?: GeographyScope
  relatedRelationIds: string[]
}

const ANNOTATIONS: Record<string, Annotation> = {
  aeo: {
    primaryClasses: ['LongTermProjection', 'EnergySource'],
    relatedRelationIds: ['longtermprojection-forecastedby-scenario'],
  },
  ieo: {
    primaryClasses: ['LongTermProjection', 'Country'],
    geographyScopeOverride: 'international',
    relatedRelationIds: ['longtermprojection-forecastedby-scenario'],
  },
  'co2-emissions': {
    primaryClasses: ['CO2Emissions', 'CarbonCoefficient'],
    relatedRelationIds: ['coal-emits-co2', 'naturalgas-emits-co2', 'petroleum-emits-co2'],
  },
  coal: {
    primaryClasses: ['Coal', 'Production', 'Consumption'],
    relatedRelationIds: [
      'coal-produces-electricity',
      'electricpower-consumes-coal',
      'coal-exports-customsdistrict',
      'coal-emits-co2',
      'facility-locatedin-state',
      'energyflow-measuredby-quantity',
      'energyflow-measuredat-annual',
    ],
  },
  'crude-oil-imports': {
    primaryClasses: ['Petroleum', 'Import'],
    geographyScopeOverride: 'international',
    relatedRelationIds: ['petroleum-imports-country', 'petroleum-emits-co2'],
  },
  'densified-biomass': {
    primaryClasses: ['DensifiedBiomass'],
    geographyScopeOverride: 'regional',
    relatedRelationIds: ['biomass-produces-electricity', 'biomass-exports-country'],
  },
  electricity: {
    primaryClasses: ['Electricity', 'ElectricPower'],
    relatedRelationIds: [
      'coal-produces-electricity',
      'naturalgas-produces-electricity',
      'nuclear-produces-electricity',
      'renewables-produces-electricity',
      'sector-consumes-electricity',
      'electricity-measuredby-capacity',
      'facility-locatedin-state',
    ],
  },
  international: {
    primaryClasses: ['Country', 'EnergySource'],
    geographyScopeOverride: 'international',
    relatedRelationIds: ['petroleum-imports-country', 'energyflow-measuredat-annual'],
  },
  'natural-gas': {
    primaryClasses: ['NaturalGas'],
    relatedRelationIds: [
      'naturalgas-produces-electricity',
      'residential-consumes-naturalgas',
      'naturalgas-imports-country',
      'naturalgas-stores-state',
      'naturalgas-emits-co2',
    ],
  },
  'nuclear-outages': {
    primaryClasses: ['Nuclear', 'Facility'],
    geographyScopeOverride: 'facility',
    relatedRelationIds: ['nuclear-produces-electricity', 'facility-locatedin-state'],
  },
  rto: {
    primaryClasses: ['Electricity', 'RTORegion'],
    geographyScopeOverride: 'regional',
    relatedRelationIds: [
      'electricity-transmits-rtoregion',
      'rtoregion-locatedin-state',
      'electricity-measuredat-hourly',
    ],
  },
  seds: {
    primaryClasses: ['Sector', 'State'],
    relatedRelationIds: [
      'sector-consumes-electricity',
      'residential-consumes-naturalgas',
      'energyflow-measuredby-quantity',
      'energyflow-measuredat-annual',
    ],
  },
  'state-electricity-profiles': {
    primaryClasses: ['Electricity', 'State'],
    // facetsHint on this domain holds tag-words, not facet ids, so derivation
    // can't see the stateid facet (EXAMPLES.md queries it) — override.
    geographyScopeOverride: 'state',
    relatedRelationIds: [
      'renewables-produces-electricity',
      'coal-emits-co2',
      'electricity-measuredby-capacity',
      'rtoregion-locatedin-state',
    ],
  },
  steo: {
    primaryClasses: ['ShortTermProjection'],
    relatedRelationIds: ['shorttermprojection-forecastedby-scenario'],
  },
  'total-energy': {
    primaryClasses: ['EnergySource'],
    geographyScopeOverride: 'national',
    relatedRelationIds: ['energyflow-measuredby-quantity', 'energyflow-measuredat-annual'],
  },
}

// ---------------------------------------------------------------------------
// Derive + merge into DomainOntologyMapping[]
// ---------------------------------------------------------------------------

export const DOMAIN_MAPPINGS: DomainOntologyMapping[] = DOMAINS.map((domain) => {
  const annotation = ANNOTATIONS[domain.id] ?? {
    primaryClasses: [],
    relatedRelationIds: [],
  }

  const allFacets = domain.subRoutes.flatMap((sr) => sr.facetsHint ?? [])

  return {
    domainId: domain.id,
    primaryClasses: annotation.primaryClasses,
    energyFlows: deriveEnergyFlows(domain.subRoutes),
    geographyScope: annotation.geographyScopeOverride ?? deriveGeographyScope(allFacets),
    temporalGranularities: deriveTemporalGranularities(domain.subRoutes),
    isProjection: deriveIsProjection(domain),
    hasEmissions: deriveHasEmissions(domain),
    relatedRelationIds: annotation.relatedRelationIds,
  }
})

export const getMappingForDomain = (id: string): DomainOntologyMapping | undefined =>
  DOMAIN_MAPPINGS.find((m) => m.domainId === id)
