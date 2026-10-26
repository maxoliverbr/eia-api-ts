import type { JsonLdContext, JsonLdNode, PathHop } from '../schemas/ontology'
import { ONTOLOGY_CLASSES, ONTOLOGY_CLASSES_BY_ID, getOntologyClass, getSubClasses } from './classes'
import { ONTOLOGY_RELATIONS, getRelationsForClass } from './relations'
import { DOMAIN_MAPPINGS, getMappingForDomain } from './mappings'
import { FACET_BINDINGS, getFacetBindingsForClass, getFacetBindingsForDomain } from './facet-bindings'

export { ONTOLOGY_CLASSES, ONTOLOGY_CLASSES_BY_ID, getOntologyClass, getSubClasses }
export { ONTOLOGY_RELATIONS, getRelationsForClass }
export { DOMAIN_MAPPINGS, getMappingForDomain }
export { FACET_BINDINGS, getFacetBindingsForClass, getFacetBindingsForDomain }

export const ONTOLOGY = {
  classes: ONTOLOGY_CLASSES,
  relations: ONTOLOGY_RELATIONS,
  domainMappings: DOMAIN_MAPPINGS,
} as const

// ---------------------------------------------------------------------------
// Multi-hop path finding
// ---------------------------------------------------------------------------

// Adjacency built once at module load: every relation contributes a forward
// and a reverse arc; every parentClass link contributes subClassOf arcs both
// ways (without them, e.g. Residential → CO2Emissions is unreachable because
// relations attach at the Sector/NaturalGas level).
const ADJACENCY: Map<string, PathHop[]> = (() => {
  const adj = new Map<string, PathHop[]>()
  const add = (hop: PathHop) => {
    const list = adj.get(hop.from) ?? []
    list.push(hop)
    adj.set(hop.from, list)
  }
  for (const rel of ONTOLOGY_RELATIONS) {
    const base = { predicate: rel.predicate, relationId: rel.id, evidenceDomains: rel.evidenceDomains }
    add({ from: rel.subject, to: rel.object, direction: 'forward', ...base })
    add({ from: rel.object, to: rel.subject, direction: 'reverse', ...base })
  }
  for (const cls of ONTOLOGY_CLASSES) {
    if (!cls.parentClass) continue
    const base = { predicate: 'subClassOf' as const, relationId: null, evidenceDomains: [] }
    add({ from: cls.id, to: cls.parentClass, direction: 'forward', ...base })
    add({ from: cls.parentClass, to: cls.id, direction: 'reverse', ...base })
  }
  return adj
})()

// ponytail: naive path-enumeration BFS, fine at 45 nodes / ~140 arcs; revisit
// if the ontology grows 10x.
export function findOntologyPaths(
  from: string,
  to: string,
  maxDepth = 4,
  limit = 5
): PathHop[][] {
  const results: PathHop[][] = []
  const queue: Array<{ node: string; hops: PathHop[]; seen: Set<string> }> = [
    { node: from, hops: [], seen: new Set([from]) },
  ]
  while (queue.length > 0 && results.length < limit) {
    const { node, hops, seen } = queue.shift()!
    if (hops.length >= maxDepth) continue
    for (const hop of ADJACENCY.get(node) ?? []) {
      if (hop.to === to) {
        results.push([...hops, hop])
        if (results.length >= limit) break
      } else if (!seen.has(hop.to)) {
        queue.push({ node: hop.to, hops: [...hops, hop], seen: new Set(seen).add(hop.to) })
      }
    }
  }
  return results
}

// ---------------------------------------------------------------------------
// JSON-LD serializer
// ---------------------------------------------------------------------------

const JSON_LD_CONTEXT = {
  eia: 'https://api.eia.gov/ontology/',
  owl: 'http://www.w3.org/2002/07/owl#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
}

export function buildJsonLdGraph(): JsonLdContext {
  const graph: JsonLdNode[] = []

  for (const cls of ONTOLOGY_CLASSES) {
    const node: JsonLdNode = {
      '@id': `eia:${cls.id}`,
      '@type': 'owl:Class',
      'rdfs:label': cls.name,
      'rdfs:comment': cls.description,
    }
    if (cls.parentClass) {
      node['rdfs:subClassOf'] = `eia:${cls.parentClass}`
    }
    if (cls.sameAs && cls.sameAs.length > 0) {
      node['owl:sameAs'] = cls.sameAs.length === 1 ? cls.sameAs[0] : cls.sameAs
    }
    graph.push(node)
  }

  for (const rel of ONTOLOGY_RELATIONS) {
    graph.push({
      '@id': `eia:${rel.id}`,
      '@type': 'owl:ObjectProperty',
      'rdfs:label': rel.id,
      'rdfs:comment': rel.description,
      'rdfs:domain': `eia:${rel.subject}`,
      'rdfs:range': `eia:${rel.object}`,
    })
  }

  return { '@context': JSON_LD_CONTEXT, '@graph': graph }
}

// ---------------------------------------------------------------------------
// Turtle serializer
// ---------------------------------------------------------------------------

export function buildTurtleGraph(): string {
  const lines: string[] = [
    '@prefix eia: <https://api.eia.gov/ontology/> .',
    '@prefix owl: <http://www.w3.org/2002/07/owl#> .',
    '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .',
    '@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .',
    '',
  ]

  for (const cls of ONTOLOGY_CLASSES) {
    const triples: string[] = [`eia:${cls.id} a owl:Class`]
    triples.push(`  rdfs:label "${cls.name}"`)
    triples.push(`  rdfs:comment "${cls.description.replace(/"/g, '\\"')}"`)
    if (cls.parentClass) {
      triples.push(`  rdfs:subClassOf eia:${cls.parentClass}`)
    }
    if (cls.sameAs) {
      for (const uri of cls.sameAs) {
        triples.push(`  owl:sameAs <${uri}>`)
      }
    }
    lines.push(triples.join(' ;\n') + ' .')
    lines.push('')
  }

  for (const rel of ONTOLOGY_RELATIONS) {
    const desc = (rel.description ?? rel.id).replace(/"/g, '\\"')
    lines.push(
      `eia:${rel.id} a owl:ObjectProperty ;\n` +
      `  rdfs:label "${rel.id}" ;\n` +
      `  rdfs:comment "${desc}" ;\n` +
      `  rdfs:domain eia:${rel.subject} ;\n` +
      `  rdfs:range eia:${rel.object} .`
    )
    lines.push('')
  }

  return lines.join('\n')
}
