import { t, type Static } from 'elysia'
import { DomainIdSchema } from './primitives'
import { FrequencyPresetSchema } from './domain'

// ---------------------------------------------------------------------------
// RelationPredicate — 11 typed edge predicates
// ---------------------------------------------------------------------------

export const RelationPredicateSchema = t.Union(
  [
    t.Literal('produces'),
    t.Literal('consumes'),
    t.Literal('imports'),
    t.Literal('exports'),
    t.Literal('stores'),
    t.Literal('transmits'),
    t.Literal('locatedIn'),
    t.Literal('measuredBy'),
    t.Literal('measuredAt'),
    t.Literal('forecastedBy'),
    t.Literal('emits'),
  ],
  { description: 'Typed predicate on an ontology edge.' }
)
export type RelationPredicate = Static<typeof RelationPredicateSchema>

// ---------------------------------------------------------------------------
// OntologyClass
// ---------------------------------------------------------------------------

export const OntologyClassSchema = t.Object({
  id: t.String({ description: 'Unique PascalCase identifier, e.g. "Coal".' }),
  name: t.String({ description: 'Human-readable label.' }),
  parentClass: t.Optional(t.String({ description: 'Parent class id (absent for top-level classes).' })),
  description: t.String(),
  sameAs: t.Optional(
    t.Array(t.String(), { description: 'Equivalent URIs (schema.org, DBpedia, Wikidata, etc.).' })
  ),
})
export type OntologyClass = Static<typeof OntologyClassSchema>

// ---------------------------------------------------------------------------
// OntologyRelation — RDF-style triple with EIA evidence
// ---------------------------------------------------------------------------

export const OntologyRelationSchema = t.Object({
  id: t.String({ description: 'Unique kebab-case identifier, e.g. "coal-produces-electricity".' }),
  subject: t.String({ description: 'Source class id.' }),
  predicate: RelationPredicateSchema,
  object: t.String({ description: 'Target class id.' }),
  description: t.Optional(t.String()),
  evidenceDomains: t.Array(DomainIdSchema, {
    description: 'EIA domain IDs that empirically exhibit this relation.',
  }),
})
export type OntologyRelation = Static<typeof OntologyRelationSchema>

// ---------------------------------------------------------------------------
// GeographyScope
// ---------------------------------------------------------------------------

export const GeographyScopeSchema = t.Union(
  [
    t.Literal('national'),
    t.Literal('state'),
    t.Literal('facility'),
    t.Literal('regional'),
    t.Literal('international'),
  ],
  { description: 'Finest geographic granularity available in this domain.' }
)
export type GeographyScope = Static<typeof GeographyScopeSchema>

// ---------------------------------------------------------------------------
// DomainOntologyMapping — links an EIA domain to its ontological entities
// ---------------------------------------------------------------------------

export const DomainOntologyMappingSchema = t.Object({
  domainId: DomainIdSchema,
  primaryClasses: t.Array(t.String(), {
    description: 'Ontology class ids primarily represented by this domain.',
  }),
  energyFlows: t.Array(t.String(), {
    description: 'EnergyFlow subclass ids found in this domain (e.g. "Production").',
  }),
  geographyScope: GeographyScopeSchema,
  temporalGranularities: t.Array(FrequencyPresetSchema, {
    description: 'Reporting frequencies available in this domain.',
  }),
  isProjection: t.Boolean({ description: 'True when this domain contains scenario forecasts.' }),
  hasEmissions: t.Boolean({ description: 'True when this domain includes CO2 or emission data.' }),
  relatedRelationIds: t.Array(t.String(), {
    description: 'Ontology relation IDs that this domain instantiates.',
  }),
})
export type DomainOntologyMapping = Static<typeof DomainOntologyMappingSchema>

// ---------------------------------------------------------------------------
// FacetBinding — semantic bridge from an ontology class to a concrete facet filter
// ---------------------------------------------------------------------------

export const FacetBindingSchema = t.Object({
  classId: t.String({ description: 'Ontology class id, e.g. "Coal".' }),
  domainId: DomainIdSchema,
  routeId: t.String({ description: 'Sub-route id usable as `route` in POST /query.' }),
  facetId: t.String({ description: 'Facet id, e.g. "fueltypeid".' }),
  values: t.Array(t.String(), {
    minItems: 1,
    description: 'Facet value codes to filter on, e.g. ["COL"].',
  }),
  note: t.Optional(t.String()),
})
export type FacetBinding = Static<typeof FacetBindingSchema>

// ---------------------------------------------------------------------------
// PathHop — one edge in a multi-hop ontology path
// ---------------------------------------------------------------------------

export const PathHopSchema = t.Object({
  from: t.String(),
  to: t.String(),
  predicate: t.Union([RelationPredicateSchema, t.Literal('subClassOf')]),
  direction: t.Union([t.Literal('forward'), t.Literal('reverse')], {
    description: '"reverse" means the underlying relation points to → from.',
  }),
  relationId: t.Union([t.String(), t.Null()], {
    description: 'Relation id, or null for subClassOf hops derived from parentClass.',
  }),
  evidenceDomains: t.Array(t.String()),
})
export type PathHop = Static<typeof PathHopSchema>

export const OntologyPathsResponseSchema = t.Object({
  from: t.String(),
  to: t.String(),
  maxDepth: t.Integer(),
  total: t.Integer(),
  paths: t.Array(t.Object({ length: t.Integer(), hops: t.Array(PathHopSchema) })),
})

// ---------------------------------------------------------------------------
// RelationEvidence — runnable data pointers per evidence domain of a relation
// ---------------------------------------------------------------------------

export const RelationEvidenceSchema = t.Object({
  relation: OntologyRelationSchema,
  evidence: t.Array(
    t.Object({
      domainId: DomainIdSchema,
      mapping: DomainOntologyMappingSchema,
      commonQueries: t.Array(
        t.Object({
          name: t.String(),
          description: t.String(),
          params: t.Any({ description: 'Runnable POST /query body.' }),
          expectedShape: t.Optional(t.String()),
        })
      ),
      subRoutes: t.Array(
        t.Object({
          id: t.String(),
          path: t.String(),
          summary: t.String(),
          exampleQuery: t.Any(),
          facetsHint: t.Optional(t.Array(t.String())),
        })
      ),
      facetBindings: t.Array(FacetBindingSchema),
    })
  ),
})

// ---------------------------------------------------------------------------
// ClassComparability — which domains sharing a class can be validly compared
// ---------------------------------------------------------------------------

export const ClassComparabilitySchema = t.Object({
  classId: t.String(),
  domains: t.Array(
    t.Object({
      domainId: DomainIdSchema,
      geographyScope: GeographyScopeSchema,
      temporalGranularities: t.Array(FrequencyPresetSchema),
      isProjection: t.Boolean(),
    })
  ),
  comparableGroups: t.Array(
    t.Object({
      geographyScope: GeographyScopeSchema,
      domainIds: t.Array(DomainIdSchema),
      sharedTemporalGranularities: t.Array(FrequencyPresetSchema),
      comparable: t.Boolean({ description: 'True when ≥2 domains share this geography scope.' }),
    })
  ),
})

// ---------------------------------------------------------------------------
// JSON-LD node (used by /ontology/export?format=jsonld)
// ---------------------------------------------------------------------------

export const JsonLdNodeSchema = t.Object({
  '@id': t.String(),
  '@type': t.Union([t.String(), t.Array(t.String())]),
  'rdfs:label': t.Optional(t.String()),
  'rdfs:comment': t.Optional(t.String()),
  'owl:sameAs': t.Optional(t.Union([t.String(), t.Array(t.String())])),
  'rdfs:subClassOf': t.Optional(t.String()),
  'rdfs:domain': t.Optional(t.String()),
  'rdfs:range': t.Optional(t.String()),
})
export type JsonLdNode = Static<typeof JsonLdNodeSchema>

export const JsonLdContextSchema = t.Object({
  '@context': t.Any(),
  '@graph': t.Array(JsonLdNodeSchema),
})
export type JsonLdContext = Static<typeof JsonLdContextSchema>

// ---------------------------------------------------------------------------
// Response schemas for /ontology/* routes
// ---------------------------------------------------------------------------

export const OntologyIndexSchema = t.Object({
  version: t.String(),
  classCount: t.Integer(),
  relationCount: t.Integer(),
  domainMappingCount: t.Integer(),
  endpoints: t.Object({
    classes: t.String(),
    relations: t.String(),
    graph: t.String(),
    search: t.String(),
    paths: t.String(),
    evidence: t.String(),
    comparability: t.String(),
    export: t.String(),
  }),
})

export const OntologyClassListSchema = t.Object({
  total: t.Integer(),
  classes: t.Array(OntologyClassSchema),
})

export const OntologyClassDetailSchema = t.Object({
  class: OntologyClassSchema,
  relations: t.Array(OntologyRelationSchema),
  subClasses: t.Array(OntologyClassSchema),
  facetBindings: t.Array(FacetBindingSchema),
})

export const OntologyRelationListSchema = t.Object({
  total: t.Integer(),
  relations: t.Array(OntologyRelationSchema),
})

export const OntologyGraphSchema = t.Object({
  classes: t.Array(OntologyClassSchema),
  relations: t.Array(OntologyRelationSchema),
  domainMappings: t.Array(DomainOntologyMappingSchema),
})

export const OntologySearchHitSchema = t.Object({
  type: t.Union([t.Literal('class'), t.Literal('relation')]),
  id: t.String({ description: 'Class or relation id.' }),
  title: t.String(),
  snippet: t.String(),
  score: t.Number(),
})
export type OntologySearchHit = Static<typeof OntologySearchHitSchema>

export const OntologySearchResponseSchema = t.Object({
  query: t.String(),
  total: t.Integer(),
  hits: t.Array(OntologySearchHitSchema),
})
export type OntologySearchResponse = Static<typeof OntologySearchResponseSchema>
