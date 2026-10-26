/**
 * GET /ontology           — index / counts
 * GET /ontology/classes   — class registry (filterable by ?parentClass)
 * GET /ontology/classes/:classId — single class + relations + subclasses
 * GET /ontology/relations — relation registry (filterable by ?subject, ?predicate, ?object)
 * GET /ontology/relations/:relationId/evidence — runnable data pointers per evidence domain
 * GET /ontology/domains/:domainId — ontology mapping for one EIA domain
 * GET /ontology/classes/:classId/comparability — which domains sharing a class can be compared
 * GET /ontology/paths     — multi-hop paths between two classes (?from, ?to, ?maxDepth, ?limit)
 * GET /ontology/graph     — full in-memory model (classes + relations + mappings)
 * GET /ontology/search    — free-text search over classes and relations (?q, ?limit)
 * GET /ontology/export    — serialization (?format=jsonld or ?format=turtle)
 */
import { Elysia, t } from 'elysia'
import {
  ONTOLOGY,
  getOntologyClass,
  getSubClasses,
  getRelationsForClass,
  getMappingForDomain,
  getFacetBindingsForClass,
  FACET_BINDINGS,
  findOntologyPaths,
  buildJsonLdGraph,
  buildTurtleGraph,
} from '../ontology'
import {
  OntologyIndexSchema,
  OntologyClassListSchema,
  OntologyClassDetailSchema,
  OntologyRelationListSchema,
  OntologyGraphSchema,
  OntologySearchResponseSchema,
  OntologyPathsResponseSchema,
  RelationEvidenceSchema,
  ClassComparabilitySchema,
  DomainOntologyMappingSchema,
  RelationPredicateSchema,
} from '../schemas/ontology'
import { DomainIdSchema } from '../schemas/primitives'
import { searchOntology } from '../lib/search'
import { getDomain } from '../domains'
import pkg from '../../package.json' with { type: 'json' }

const notFound = (kind: string, id: string) => ({
  error: `${kind}_not_found` as const,
  message: `No ${kind} with id "${id}".`,
})

const NotFoundSchema = t.Object({
  error: t.String(),
  message: t.String(),
})

export const ontologyRoutes = new Elysia({ tags: ['Ontology'] })
  // ---------------------------------------------------------------------------
  // GET /ontology
  // ---------------------------------------------------------------------------
  .get(
    '/ontology',
    () => ({
      version: pkg.version,
      classCount: ONTOLOGY.classes.length,
      relationCount: ONTOLOGY.relations.length,
      domainMappingCount: ONTOLOGY.domainMappings.length,
      endpoints: {
        classes: '/ontology/classes',
        relations: '/ontology/relations',
        graph: '/ontology/graph',
        search: '/ontology/search',
        paths: '/ontology/paths',
        evidence: '/ontology/relations/:relationId/evidence',
        comparability: '/ontology/classes/:classId/comparability',
        export: '/ontology/export',
      },
    }),
    {
      detail: {
        summary: 'Ontology index',
        description: 'Returns counts and links for the EIA energy domain ontology.',
        tags: ['Ontology'],
      },
      response: OntologyIndexSchema,
    }
  )
  // ---------------------------------------------------------------------------
  // GET /ontology/classes
  // ---------------------------------------------------------------------------
  .get(
    '/ontology/classes',
    ({ query }) => {
      let classes = [...ONTOLOGY.classes]
      if (query.parentClass) {
        classes = classes.filter((c) => c.parentClass === query.parentClass)
      }
      return { total: classes.length, classes }
    },
    {
      query: t.Object({
        parentClass: t.Optional(t.String({ description: 'Filter by parent class id, e.g. "EnergySource".' })),
      }),
      detail: {
        summary: 'List ontology classes',
        description: 'Returns all classes in the energy ontology. Use `?parentClass=EnergySource` to filter.',
        tags: ['Ontology'],
      },
      response: OntologyClassListSchema,
    }
  )
  // ---------------------------------------------------------------------------
  // GET /ontology/classes/:classId
  // ---------------------------------------------------------------------------
  .get(
    '/ontology/classes/:classId',
    ({ params, status }) => {
      const cls = getOntologyClass(params.classId)
      if (!cls) return status(404, notFound('class', params.classId))
      return {
        class: cls,
        relations: getRelationsForClass(cls.id),
        subClasses: getSubClasses(cls.id),
        facetBindings: getFacetBindingsForClass(cls.id),
      }
    },
    {
      params: t.Object({ classId: t.String() }),
      detail: {
        summary: 'Get a single class',
        description: 'Returns the class definition, its direct subclasses, and all relations where it appears as subject or object.',
        tags: ['Ontology'],
      },
      response: {
        200: OntologyClassDetailSchema,
        404: NotFoundSchema,
      },
    }
  )
  // ---------------------------------------------------------------------------
  // GET /ontology/relations
  // ---------------------------------------------------------------------------
  .get(
    '/ontology/relations',
    ({ query }) => {
      let relations = [...ONTOLOGY.relations]
      if (query.subject) relations = relations.filter((r) => r.subject === query.subject)
      if (query.predicate) relations = relations.filter((r) => r.predicate === query.predicate)
      if (query.object) relations = relations.filter((r) => r.object === query.object)
      return { total: relations.length, relations }
    },
    {
      query: t.Object({
        subject: t.Optional(t.String({ description: 'Filter by subject class id, e.g. "Coal".' })),
        predicate: t.Optional(RelationPredicateSchema),
        object: t.Optional(t.String({ description: 'Filter by object class id, e.g. "CO2Emissions".' })),
      }),
      detail: {
        summary: 'List ontology relations',
        description: 'Returns all typed edges in the energy ontology. Supports filtering by subject, predicate, and object.',
        tags: ['Ontology'],
      },
      response: OntologyRelationListSchema,
    }
  )
  // ---------------------------------------------------------------------------
  // GET /ontology/relations/:relationId/evidence
  // ---------------------------------------------------------------------------
  .get(
    '/ontology/relations/:relationId/evidence',
    ({ params, status }) => {
      const rel = ONTOLOGY.relations.find((r) => r.id === params.relationId)
      if (!rel) return status(404, notFound('relation', params.relationId))
      return {
        relation: rel,
        evidence: rel.evidenceDomains.map((domainId) => {
          // evidenceDomains are validated against DOMAINS by the test suite
          const domain = getDomain(domainId)!
          return {
            domainId,
            mapping: getMappingForDomain(domainId)!,
            commonQueries: domain.commonQueries ?? [],
            subRoutes: domain.subRoutes.map((s) => ({
              id: s.id,
              path: s.path,
              summary: s.summary,
              exampleQuery: s.exampleQuery,
              ...(s.facetsHint ? { facetsHint: s.facetsHint } : {}),
            })),
            facetBindings: FACET_BINDINGS.filter(
              (b) => b.domainId === domainId && (b.classId === rel.subject || b.classId === rel.object)
            ),
          }
        }),
      }
    },
    {
      params: t.Object({ relationId: t.String() }),
      detail: {
        summary: 'Runnable evidence for a relation',
        description:
          'For each EIA domain that evidences this relation, returns the domain ontology mapping, copy-pasteable POST /query bodies (commonQueries), candidate sub-routes with example queries, and known facet-value bindings for the relation\'s subject/object classes. Use to jump from an abstract relation ("Coal emits CO2") straight to data.',
        tags: ['Ontology'],
      },
      response: {
        200: RelationEvidenceSchema,
        404: NotFoundSchema,
      },
    }
  )
  // ---------------------------------------------------------------------------
  // GET /ontology/classes/:classId/comparability
  // ---------------------------------------------------------------------------
  .get(
    '/ontology/classes/:classId/comparability',
    ({ params, status }) => {
      const cls = getOntologyClass(params.classId)
      if (!cls) return status(404, notFound('class', params.classId))
      const mappings = ONTOLOGY.domainMappings.filter((m) => m.primaryClasses.includes(cls.id))
      const byScope = new Map<(typeof mappings)[number]['geographyScope'], typeof mappings>()
      for (const m of mappings) {
        byScope.set(m.geographyScope, [...(byScope.get(m.geographyScope) ?? []), m])
      }
      return {
        classId: cls.id,
        domains: mappings.map((m) => ({
          domainId: m.domainId,
          geographyScope: m.geographyScope,
          temporalGranularities: m.temporalGranularities,
          isProjection: m.isProjection,
        })),
        comparableGroups: [...byScope.entries()].map(([geographyScope, ms]) => ({
          geographyScope,
          domainIds: ms.map((m) => m.domainId),
          sharedTemporalGranularities: ms
            .map((m) => m.temporalGranularities)
            .reduce((a, b) => a.filter((f) => b.includes(f))),
          comparable: ms.length >= 2,
        })),
      }
    },
    {
      params: t.Object({ classId: t.String() }),
      detail: {
        summary: 'Cross-domain comparability for a class',
        description:
          'Lists the EIA domains whose primaryClasses include this class, grouped by geography scope with the temporal granularities they share. Groups with `comparable: true` contain ≥2 domains whose data can be validly compared or joined (check isProjection to avoid mixing history with forecasts).',
        tags: ['Ontology'],
      },
      response: {
        200: ClassComparabilitySchema,
        404: NotFoundSchema,
      },
    }
  )
  // ---------------------------------------------------------------------------
  // GET /ontology/paths
  // ---------------------------------------------------------------------------
  .get(
    '/ontology/paths',
    ({ query, status }) => {
      if (!getOntologyClass(query.from)) return status(404, notFound('class', query.from))
      if (!getOntologyClass(query.to)) return status(404, notFound('class', query.to))
      const maxDepth = query.maxDepth ?? 4
      const paths = findOntologyPaths(query.from, query.to, maxDepth, query.limit ?? 5)
      return {
        from: query.from,
        to: query.to,
        maxDepth,
        total: paths.length,
        paths: paths.map((hops) => ({ length: hops.length, hops })),
      }
    },
    {
      query: t.Object({
        from: t.String({ description: 'Start class id, e.g. "Residential".' }),
        to: t.String({ description: 'Target class id, e.g. "CO2Emissions".' }),
        maxDepth: t.Optional(t.Integer({ minimum: 1, maximum: 6, default: 4 })),
        limit: t.Optional(t.Integer({ minimum: 1, maximum: 20, default: 5 })),
      }),
      detail: {
        summary: 'Find paths between two classes',
        description:
          'BFS over the ontology graph (relations traversed both directions, plus subClassOf hops from the class hierarchy). Returns up to `limit` paths, shortest first; each hop carries the relation predicate, direction, and the EIA domains that evidence it — i.e. which datasets can quantify each step of the chain.',
        tags: ['Ontology'],
      },
      response: {
        200: OntologyPathsResponseSchema,
        404: NotFoundSchema,
      },
    }
  )
  // ---------------------------------------------------------------------------
  // GET /ontology/domains/:domainId
  // ---------------------------------------------------------------------------
  .get(
    '/ontology/domains/:domainId',
    ({ params, status }) => {
      const mapping = getMappingForDomain(params.domainId)
      if (!mapping) return status(404, notFound('domain', params.domainId))
      return mapping
    },
    {
      params: t.Object({ domainId: DomainIdSchema }),
      detail: {
        summary: 'Get ontology mapping for a domain',
        description: 'Returns the ontological entities and relations associated with a specific EIA domain.',
        tags: ['Ontology'],
      },
      response: {
        200: DomainOntologyMappingSchema,
        404: NotFoundSchema,
      },
    }
  )
  // ---------------------------------------------------------------------------
  // GET /ontology/graph
  // ---------------------------------------------------------------------------
  .get(
    '/ontology/graph',
    () => ({
      classes: [...ONTOLOGY.classes],
      relations: [...ONTOLOGY.relations],
      domainMappings: [...ONTOLOGY.domainMappings],
    }),
    {
      detail: {
        summary: 'Full ontology graph',
        description: 'Returns all classes, relations, and domain mappings in one payload.',
        tags: ['Ontology'],
      },
      response: OntologyGraphSchema,
    }
  )
  // ---------------------------------------------------------------------------
  // GET /ontology/search
  // ---------------------------------------------------------------------------
  .get(
    '/ontology/search',
    ({ query }) =>
      searchOntology(ONTOLOGY.classes, ONTOLOGY.relations, query.q, query.limit ?? 10),
    {
      query: t.Object({
        q: t.String({ minLength: 1, description: 'Free-text query, e.g. "carbon emissions".' }),
        limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 10 })),
      }),
      detail: {
        summary: 'Search the ontology',
        description:
          'Free-text keyword search over ontology classes and relations. Returns ranked hits with type ("class" or "relation"), id, and a contextual snippet. Use when you do not know the exact PascalCase class id or kebab-case relation id.',
        tags: ['Ontology'],
      },
      response: OntologySearchResponseSchema,
    }
  )
  // ---------------------------------------------------------------------------
  // GET /ontology/export
  // ---------------------------------------------------------------------------
  .get(
    '/ontology/export',
    ({ query, set }) => {
      const format = query.format ?? 'jsonld'
      if (format === 'turtle') {
        set.headers['content-type'] = 'text/turtle; charset=utf-8'
        return buildTurtleGraph() as unknown as ReturnType<typeof buildJsonLdGraph>
      }
      set.headers['content-type'] = 'application/ld+json; charset=utf-8'
      return buildJsonLdGraph()
    },
    {
      query: t.Object({
        format: t.Optional(
          t.Union([t.Literal('jsonld'), t.Literal('turtle')], {
            description: 'Serialization format. Defaults to "jsonld".',
            default: 'jsonld',
          })
        ),
      }),
      detail: {
        summary: 'Export ontology',
        description: 'Serialize the ontology as JSON-LD (application/ld+json) or Turtle (text/turtle) for semantic web interoperability.',
        tags: ['Ontology'],
      },
      // Two distinct content-types (application/ld+json and text/turtle) cannot
      // share one TypeBox schema; skip response validation on this endpoint.
      response: t.Any(),
    }
  )
