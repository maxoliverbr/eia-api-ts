import { describe, expect, it } from 'bun:test'
import { Value } from '@sinclair/typebox/value'
import { ONTOLOGY_CLASSES, ONTOLOGY_CLASSES_BY_ID, getOntologyClass, getSubClasses } from '../src/ontology/classes'
import { ONTOLOGY_RELATIONS, getRelationsForClass } from '../src/ontology/relations'
import { DOMAIN_MAPPINGS, getMappingForDomain } from '../src/ontology/mappings'
import { DOMAINS } from '../src/domains'
import { buildJsonLdGraph, buildTurtleGraph, findOntologyPaths } from '../src/ontology'
import { FACET_BINDINGS } from '../src/ontology/facet-bindings'
import { searchOntology } from '../src/lib/search'
import { FacetBindingSchema } from '../src/schemas/ontology'
import {
  OntologyClassSchema,
  OntologyRelationSchema,
  DomainOntologyMappingSchema,
} from '../src/schemas/ontology'
import { app } from '../elysia.config'

const get = (path: string) => app.handle(new Request(`http://localhost${path}`))

// ---------------------------------------------------------------------------
// Class structural invariants
// ---------------------------------------------------------------------------

describe('ontology classes (structural)', () => {
  it('has classes for all 8 top-level concepts', () => {
    const topLevelIds = ['EnergySource', 'Sector', 'Geography', 'EnergyFlow', 'Measurement', 'TemporalGranularity', 'Projection', 'EnvironmentalImpact']
    for (const id of topLevelIds) {
      expect(ONTOLOGY_CLASSES_BY_ID[id]).toBeDefined()
      expect(ONTOLOGY_CLASSES_BY_ID[id]!.parentClass).toBeUndefined()
    }
  })

  it('no duplicate class ids', () => {
    const ids = ONTOLOGY_CLASSES.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every parentClass references an existing class id', () => {
    for (const cls of ONTOLOGY_CLASSES) {
      if (cls.parentClass) {
        expect(ONTOLOGY_CLASSES_BY_ID[cls.parentClass]).toBeDefined()
      }
    }
  })

  it('getSubClasses returns only direct children', () => {
    const subs = getSubClasses('EnergySource')
    const ids = subs.map((c) => c.id)
    expect(ids).toContain('Coal')
    expect(ids).toContain('NaturalGas')
    expect(ids).toContain('Electricity')
    expect(ids).not.toContain('EnergySource')
  })

  it('getOntologyClass returns undefined for unknown ids', () => {
    expect(getOntologyClass('NotAClass')).toBeUndefined()
  })

  it('OntologyClassSchema validates each class', () => {
    for (const cls of ONTOLOGY_CLASSES) {
      expect(Value.Check(OntologyClassSchema, cls)).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// Relation structural invariants
// ---------------------------------------------------------------------------

describe('ontology relations (structural)', () => {
  it('no duplicate relation ids', () => {
    const ids = ONTOLOGY_RELATIONS.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every relation subject references an existing class id', () => {
    for (const rel of ONTOLOGY_RELATIONS) {
      expect(ONTOLOGY_CLASSES_BY_ID[rel.subject]).toBeDefined()
    }
  })

  it('every relation object references an existing class id', () => {
    for (const rel of ONTOLOGY_RELATIONS) {
      expect(ONTOLOGY_CLASSES_BY_ID[rel.object]).toBeDefined()
    }
  })

  it('every evidenceDomain references a real EIA domain', () => {
    const domainIds = new Set(DOMAINS.map((d) => d.id))
    for (const rel of ONTOLOGY_RELATIONS) {
      for (const ev of rel.evidenceDomains) {
        expect(domainIds.has(ev)).toBe(true)
      }
    }
  })

  it('getRelationsForClass returns relations where class appears', () => {
    const coalRelations = getRelationsForClass('Coal')
    expect(coalRelations.length).toBeGreaterThan(0)
    for (const r of coalRelations) {
      expect(r.subject === 'Coal' || r.object === 'Coal').toBe(true)
    }
  })

  it('OntologyRelationSchema validates each relation', () => {
    for (const rel of ONTOLOGY_RELATIONS) {
      expect(Value.Check(OntologyRelationSchema, rel)).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// Domain mapping structural invariants
// ---------------------------------------------------------------------------

describe('domain mappings (structural)', () => {
  it('has exactly one mapping per EIA domain', () => {
    expect(DOMAIN_MAPPINGS.length).toBe(DOMAINS.length)
    for (const d of DOMAINS) {
      expect(getMappingForDomain(d.id)).toBeDefined()
    }
  })

  it('every mapping primaryClass references an existing class id', () => {
    for (const m of DOMAIN_MAPPINGS) {
      for (const cls of m.primaryClasses) {
        expect(ONTOLOGY_CLASSES_BY_ID[cls]).toBeDefined()
      }
    }
  })

  it('every mapping relatedRelationId references an existing relation id', () => {
    const relationIds = new Set(ONTOLOGY_RELATIONS.map((r) => r.id))
    for (const m of DOMAIN_MAPPINGS) {
      for (const relId of m.relatedRelationIds) {
        expect(relationIds.has(relId)).toBe(true)
      }
    }
  })

  it('DomainOntologyMappingSchema validates each mapping', () => {
    for (const m of DOMAIN_MAPPINGS) {
      expect(Value.Check(DomainOntologyMappingSchema, m)).toBe(true)
    }
  })

  it('projection domains are flagged correctly', () => {
    expect(getMappingForDomain('aeo')?.isProjection).toBe(true)
    expect(getMappingForDomain('ieo')?.isProjection).toBe(true)
    expect(getMappingForDomain('steo')?.isProjection).toBe(true)
    expect(getMappingForDomain('coal')?.isProjection).toBe(false)
  })

  it('co2-emissions domain has hasEmissions=true', () => {
    expect(getMappingForDomain('co2-emissions')?.hasEmissions).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// JSON-LD / Turtle serializers
// ---------------------------------------------------------------------------

describe('serializers', () => {
  it('buildJsonLdGraph produces valid structure', () => {
    const graph = buildJsonLdGraph()
    expect(graph['@context']).toBeDefined()
    expect(Array.isArray(graph['@graph'])).toBe(true)
    expect(graph['@graph'].length).toBeGreaterThan(0)
    for (const node of graph['@graph']) {
      expect(node['@id']).toBeTruthy()
      expect(node['@type']).toBeTruthy()
    }
  })

  it('buildJsonLdGraph includes all classes and relations', () => {
    const graph = buildJsonLdGraph()
    const ids = graph['@graph'].map((n) => n['@id'])
    expect(ids).toContain('eia:Coal')
    expect(ids).toContain('eia:coal-produces-electricity')
  })

  it('buildJsonLdGraph sets rdfs:subClassOf for subclasses', () => {
    const graph = buildJsonLdGraph()
    const coal = graph['@graph'].find((n) => n['@id'] === 'eia:Coal')
    expect(coal?.['rdfs:subClassOf']).toBe('eia:EnergySource')
  })

  it('buildTurtleGraph produces non-empty Turtle text', () => {
    const turtle = buildTurtleGraph()
    expect(typeof turtle).toBe('string')
    expect(turtle).toContain('@prefix eia:')
    expect(turtle).toContain('owl:Class')
    expect(turtle).toContain('eia:Coal')
    expect(turtle).toContain('rdfs:subClassOf eia:EnergySource')
  })
})

// ---------------------------------------------------------------------------
// Facet bindings (structural)
// ---------------------------------------------------------------------------

describe('facet bindings (structural)', () => {
  it('every binding classId references an existing class id', () => {
    for (const b of FACET_BINDINGS) {
      expect(ONTOLOGY_CLASSES_BY_ID[b.classId]).toBeDefined()
    }
  })

  it('every binding domainId + routeId resolves to a real sub-route', () => {
    for (const b of FACET_BINDINGS) {
      const domain = DOMAINS.find((d) => d.id === b.domainId)
      expect(domain).toBeDefined()
      expect(domain!.subRoutes.map((s) => s.id)).toContain(b.routeId)
    }
  })

  it('FacetBindingSchema validates each binding', () => {
    for (const b of FACET_BINDINGS) {
      expect(Value.Check(FacetBindingSchema, b)).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// Path finding
// ---------------------------------------------------------------------------

describe('findOntologyPaths', () => {
  it('finds the direct Coal → CO2Emissions path first', () => {
    const paths = findOntologyPaths('Coal', 'CO2Emissions')
    expect(paths.length).toBeGreaterThanOrEqual(1)
    expect(paths[0]!.length).toBe(1)
    expect(paths[0]![0]!.relationId).toBe('coal-emits-co2')
  })

  it('hops chain correctly and anchor to from/to', () => {
    for (const path of findOntologyPaths('Residential', 'CO2Emissions')) {
      expect(path[0]!.from).toBe('Residential')
      expect(path[path.length - 1]!.to).toBe('CO2Emissions')
      for (let i = 1; i < path.length; i++) {
        expect(path[i]!.from).toBe(path[i - 1]!.to)
      }
    }
  })

  it('reaches CO2Emissions from Residential via subClassOf hops', () => {
    const paths = findOntologyPaths('Residential', 'CO2Emissions')
    expect(paths.length).toBeGreaterThanOrEqual(1)
    expect(paths.some((p) => p.some((h) => h.predicate === 'subClassOf'))).toBe(true)
  })

  it('returns [] for an unreachable target', () => {
    expect(findOntologyPaths('Coal', 'NotAClass')).toEqual([])
  })

  it('returns paths shortest-first and respects limit', () => {
    const paths = findOntologyPaths('Coal', 'Electricity', 4, 3)
    expect(paths.length).toBeLessThanOrEqual(3)
    for (let i = 1; i < paths.length; i++) {
      expect(paths[i]!.length).toBeGreaterThanOrEqual(paths[i - 1]!.length)
    }
  })
})

// ---------------------------------------------------------------------------
// Ontology search
// ---------------------------------------------------------------------------

describe('searchOntology', () => {
  it('finds the Coal class for "coal"', () => {
    const res = searchOntology(ONTOLOGY_CLASSES, ONTOLOGY_RELATIONS, 'coal', 10)
    expect(res.total).toBeGreaterThan(0)
    const classHit = res.hits.find((h) => h.type === 'class' && h.id === 'Coal')
    expect(classHit).toBeDefined()
  })

  it('finds emission relations for "emits"', () => {
    const res = searchOntology(ONTOLOGY_CLASSES, ONTOLOGY_RELATIONS, 'emits', 25)
    expect(res.hits.some((h) => h.type === 'relation' && h.id === 'coal-emits-co2')).toBe(true)
  })

  it('returns zero hits for garbage', () => {
    const res = searchOntology(ONTOLOGY_CLASSES, ONTOLOGY_RELATIONS, 'xyzzy quux', 10)
    expect(res.total).toBe(0)
    expect(res.hits.length).toBe(0)
  })

  it('respects the limit and sorts by score descending', () => {
    const res = searchOntology(ONTOLOGY_CLASSES, ONTOLOGY_RELATIONS, 'electricity', 3)
    expect(res.hits.length).toBe(3)
    expect(res.total).toBeGreaterThan(3)
    for (let i = 1; i < res.hits.length; i++) {
      expect(res.hits[i - 1]!.score).toBeGreaterThanOrEqual(res.hits[i]!.score)
    }
  })
})

// ---------------------------------------------------------------------------
// Route smoke tests
// ---------------------------------------------------------------------------

describe('GET /ontology (smoke)', () => {
  it('returns 200 with counts', async () => {
    const res = await get('/ontology')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.classCount).toBeGreaterThan(0)
    expect(body.relationCount).toBeGreaterThan(0)
    expect(body.domainMappingCount).toBe(15)
  })

  it('GET /ontology/classes returns all classes', async () => {
    const res = await get('/ontology/classes')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBe(ONTOLOGY_CLASSES.length)
    expect(body.classes.length).toBe(ONTOLOGY_CLASSES.length)
  })

  it('GET /ontology/classes?parentClass=EnergySource returns only energy sources', async () => {
    const res = await get('/ontology/classes?parentClass=EnergySource')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBeGreaterThan(0)
    for (const cls of body.classes) {
      expect(cls.parentClass).toBe('EnergySource')
    }
  })

  it('GET /ontology/classes/Coal returns Coal with relations and subclasses', async () => {
    const res = await get('/ontology/classes/Coal')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.class.id).toBe('Coal')
    expect(Array.isArray(body.relations)).toBe(true)
    expect(body.relations.length).toBeGreaterThan(0)
  })

  it('GET /ontology/classes/:classId returns 404 for unknown class', async () => {
    const res = await get('/ontology/classes/NotAClass')
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toContain('not_found')
  })

  it('GET /ontology/relations?predicate=emits returns emission relations', async () => {
    const res = await get('/ontology/relations?predicate=emits')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBeGreaterThan(0)
    for (const r of body.relations) {
      expect(r.predicate).toBe('emits')
    }
  })

  it('GET /ontology/relations?predicate=bogus returns 422', async () => {
    const res = await get('/ontology/relations?predicate=bogus')
    expect(res.status).toBe(422)
  })

  it('GET /ontology/search?q=coal returns ranked hits', async () => {
    const res = await get('/ontology/search?q=coal')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBeGreaterThan(0)
    expect(body.hits[0].id).toBeTruthy()
    expect(['class', 'relation']).toContain(body.hits[0].type)
  })

  it('GET /ontology/search without q returns 422', async () => {
    const res = await get('/ontology/search')
    expect(res.status).toBe(422)
  })

  it('GET /ontology/classes/Coal includes facetBindings', async () => {
    const res = await get('/ontology/classes/Coal')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.facetBindings.some((b: { facetId: string; values: string[] }) => b.facetId === 'fueltypeid' && b.values.includes('COL'))).toBe(true)
  })

  it('GET /ontology/relations/coal-produces-electricity/evidence returns runnable pointers', async () => {
    const res = await get('/ontology/relations/coal-produces-electricity/evidence')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.relation.id).toBe('coal-produces-electricity')
    expect(body.evidence.length).toBe(2)
    const electricity = body.evidence.find((e: { domainId: string }) => e.domainId === 'electricity')
    expect(electricity.commonQueries.length).toBeGreaterThan(0)
    expect(electricity.commonQueries[0].params.domain).toBe('electricity')
    expect(electricity.facetBindings.some((b: { values: string[] }) => b.values.includes('COL'))).toBe(true)
  })

  it('GET /ontology/relations/nope/evidence returns 404', async () => {
    const res = await get('/ontology/relations/nope/evidence')
    expect(res.status).toBe(404)
  })

  it('GET /ontology/paths?from=Coal&to=CO2Emissions returns paths', async () => {
    const res = await get('/ontology/paths?from=Coal&to=CO2Emissions')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBeGreaterThanOrEqual(1)
    expect(body.paths[0].hops[0].from).toBe('Coal')
  })

  it('GET /ontology/paths validates classes and query params', async () => {
    expect((await get('/ontology/paths?from=NotAClass&to=Coal')).status).toBe(404)
    expect((await get('/ontology/paths?to=Coal')).status).toBe(422)
    expect((await get('/ontology/paths?from=Coal&to=CO2Emissions&maxDepth=9')).status).toBe(422)
  })

  it('GET /ontology/classes/Electricity/comparability returns comparable groups', async () => {
    const res = await get('/ontology/classes/Electricity/comparability')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.domains.length).toBeGreaterThanOrEqual(3)
    for (const g of body.comparableGroups) {
      expect(Array.isArray(g.sharedTemporalGranularities)).toBe(true)
      expect(g.comparable).toBe(g.domainIds.length >= 2)
    }
  })

  it('GET /ontology/classes/State/comparability finds a comparable state-level pair', async () => {
    const res = await get('/ontology/classes/State/comparability')
    expect(res.status).toBe(200)
    const body = await res.json()
    const state = body.comparableGroups.find(
      (g: { geographyScope: string }) => g.geographyScope === 'state'
    )
    expect(state.comparable).toBe(true)
    expect(state.domainIds.sort()).toEqual(['seds', 'state-electricity-profiles'])
    expect(state.sharedTemporalGranularities).toContain('annual')
  })

  it('GET /ontology/classes/NotAClass/comparability returns 404', async () => {
    const res = await get('/ontology/classes/NotAClass/comparability')
    expect(res.status).toBe(404)
  })

  it('GET /ontology/domains/coal returns coal mapping', async () => {
    const res = await get('/ontology/domains/coal')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.domainId).toBe('coal')
    expect(body.primaryClasses).toContain('Coal')
  })

  it('GET /ontology/domains/nope returns 404', async () => {
    const res = await get('/ontology/domains/nope')
    expect(res.status).toBe(404)
  })

  it('GET /ontology/graph returns all three collections', async () => {
    const res = await get('/ontology/graph')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.classes.length).toBe(ONTOLOGY_CLASSES.length)
    expect(body.relations.length).toBe(ONTOLOGY_RELATIONS.length)
    expect(body.domainMappings.length).toBe(15)
  })

  it('GET /ontology/export returns JSON-LD by default', async () => {
    const res = await get('/ontology/export')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body['@context']).toBeDefined()
    expect(Array.isArray(body['@graph'])).toBe(true)
  })

  it('GET /ontology/export?format=turtle returns text', async () => {
    const res = await get('/ontology/export?format=turtle')
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain('@prefix eia:')
    expect(text).toContain('owl:Class')
  })
})
