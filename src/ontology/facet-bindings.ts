/**
 * Hand-authored bindings from ontology classes to concrete facet filters —
 * the semantic bridge that lets an agent go from "Coal" straight to
 * `facets: { fueltypeid: ["COL"] }` on a runnable route.
 *
 * Every code here is evidenced by a working query elsewhere in this repo
 * (EXAMPLES.md, src/domains/*). Codes verified against repo metadata
 * July 2026 — confirm live via GET /routes/:domain/:route/facet/:facetId
 * before hard-coding new ones.
 */
import type { FacetBinding } from '../schemas/ontology'

export const FACET_BINDINGS: FacetBinding[] = [
  {
    classId: 'Coal',
    domainId: 'electricity',
    routeId: 'electric-power-operational-data',
    facetId: 'fueltypeid',
    values: ['COL'],
  },
  {
    classId: 'NaturalGas',
    domainId: 'electricity',
    routeId: 'electric-power-operational-data',
    facetId: 'fueltypeid',
    values: ['NG'],
  },
  {
    classId: 'Nuclear',
    domainId: 'electricity',
    routeId: 'electric-power-operational-data',
    facetId: 'fueltypeid',
    values: ['NUC'],
  },
  {
    classId: 'Renewables',
    domainId: 'electricity',
    routeId: 'electric-power-operational-data',
    facetId: 'fueltypeid',
    values: ['SUN', 'WND'],
    note: 'Partial: solar + wind only. Resolve the live facet for hydro/geothermal codes.',
  },
  {
    classId: 'NaturalGas',
    domainId: 'state-electricity-profiles',
    routeId: 'state-electricity-profiles/emissions-by-state-by-fuel',
    facetId: 'fuelid',
    values: ['NG'],
  },
  {
    classId: 'ElectricPower',
    domainId: 'co2-emissions',
    routeId: 'co2-emissions-aggregates',
    facetId: 'sectorId',
    values: ['EC'],
  },
  {
    classId: 'Electricity',
    domainId: 'total-energy',
    routeId: 'data',
    facetId: 'msn',
    values: ['ELETPUS'],
    note: 'US total electricity primary consumption series.',
  },
  {
    classId: 'Export',
    domainId: 'coal',
    routeId: 'exports-imports-quantity-price',
    facetId: 'destinationOrigin',
    values: ['EXPORT'],
  },
]

export const getFacetBindingsForClass = (classId: string): FacetBinding[] =>
  FACET_BINDINGS.filter((b) => b.classId === classId)

export const getFacetBindingsForDomain = (domainId: string): FacetBinding[] =>
  FACET_BINDINGS.filter((b) => b.domainId === domainId)
