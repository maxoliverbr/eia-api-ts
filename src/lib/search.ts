/**
 * Keyword search over our DomainMeta collection.
 *
 * Strategy: AND-style token matching with simple scoring. Each token
 * contributes points for matches in:
 *   - domain id and name           (+3)
 *   - tags                        (+2)
 *   - use cases                   (+2 per match)
 *   - sub-route id/name/path      (+3)
 *   - sub-route description/summary (+1 per match)
 *
 * This is intentionally simple — zero dependencies, fast, and good
 * enough for an agent to find "coal" or "state emissions" by name.
 */
import type { DomainMeta, SearchHit, SearchResponse } from '../schemas/domain'
import type {
  OntologyClass,
  OntologyRelation,
  OntologySearchHit,
  OntologySearchResponse,
} from '../schemas/ontology'

const tokenize = (s: string): string[] =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1)

const countOccurrences = (haystack: string, needle: string): number => {
  if (!needle) return 0
  let count = 0
  let idx = 0
  while ((idx = haystack.indexOf(needle, idx)) !== -1) {
    count++
    idx += needle.length
  }
  return count
}

const snippet = (text: string, tokens: string[], radius = 60): string => {
  if (!text) return ''
  const lower = text.toLowerCase()
  let bestIdx = -1
  for (const t of tokens) {
    const i = lower.indexOf(t)
    if (i !== -1 && (bestIdx === -1 || i < bestIdx)) bestIdx = i
  }
  if (bestIdx === -1) return text.slice(0, radius * 2) + (text.length > radius * 2 ? '…' : '')
  const start = Math.max(0, bestIdx - radius)
  const end = Math.min(text.length, bestIdx + radius)
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
}

export const searchDomains = (
  domains: readonly DomainMeta[],
  rawQuery: string,
  limit: number
): SearchResponse => {
  const query = rawQuery.trim()
  const tokens = tokenize(query)
  const hits: SearchHit[] = []

  for (const domain of domains) {
    // Domain-level match
    const domainIdText = `${domain.id} ${domain.name}`
    const domainDescText = `${domain.description} ${domain.tags.join(' ')} ${domain.useCases.join(' ')}`

    let domainScore = 0
    for (const t of tokens) {
      domainScore += countOccurrences(domainIdText, t) * 3
      domainScore += countOccurrences(domainDescText, t) * 2
    }

    if (domainScore > 0) {
      hits.push({
        domain: domain.id,
        path: domain.id,
        title: domain.name,
        snippet: snippet(`${domain.description} ${domain.useCases.join(' ')}`, tokens),
        score: domainScore,
      })
    }

    // Sub-route matches
    for (const sub of domain.subRoutes) {
      const subIdText = `${sub.id} ${sub.path} ${sub.summary}`
      const subDescText = `${sub.description} ${sub.tags.join(' ')} ${(sub.facetsHint ?? []).join(' ')}`
      let subScore = 0
      for (const t of tokens) {
        subScore += countOccurrences(subIdText, t) * 3
        subScore += countOccurrences(subDescText, t) * 1
      }
      // Tiny inheritance from domain match
      if (domainScore > 0 && subScore === 0) {
        // Sub-route inherits a small boost if its domain matches strongly
        subScore = domainScore * 0.2
      }
      if (subScore > 0) {
        hits.push({
          domain: domain.id,
          subRouteId: sub.id,
          path: sub.path,
          title: `${domain.name} → ${sub.summary}`,
          snippet: snippet(`${sub.summary}. ${sub.description}`, tokens),
          score: subScore,
        })
      }
    }
  }

  hits.sort((a, b) => b.score - a.score)
  const trimmed = hits.slice(0, limit)

  return {
    query,
    total: hits.length,
    hits: trimmed,
  }
}

/**
 * Same strategy as searchDomains, over the ontology: classes score on
 * id/name (+3) and description/parentClass (+1); relations score on
 * id/subject/predicate/object (+3) and description (+1).
 */
export const searchOntology = (
  classes: readonly OntologyClass[],
  relations: readonly OntologyRelation[],
  rawQuery: string,
  limit: number
): OntologySearchResponse => {
  const query = rawQuery.trim()
  const tokens = tokenize(query)
  const hits: OntologySearchHit[] = []

  for (const cls of classes) {
    const idText = `${cls.id} ${cls.name}`.toLowerCase()
    const descText = `${cls.description} ${cls.parentClass ?? ''}`.toLowerCase()
    let score = 0
    for (const t of tokens) {
      score += countOccurrences(idText, t) * 3
      score += countOccurrences(descText, t) * 1
    }
    if (score > 0) {
      hits.push({
        type: 'class',
        id: cls.id,
        title: cls.name,
        snippet: snippet(cls.description, tokens),
        score,
      })
    }
  }

  for (const rel of relations) {
    const idText = `${rel.id} ${rel.subject} ${rel.predicate} ${rel.object}`.toLowerCase()
    const descText = (rel.description ?? '').toLowerCase()
    let score = 0
    for (const t of tokens) {
      score += countOccurrences(idText, t) * 3
      score += countOccurrences(descText, t) * 1
    }
    if (score > 0) {
      hits.push({
        type: 'relation',
        id: rel.id,
        title: `${rel.subject} ${rel.predicate} ${rel.object}`,
        snippet: snippet(rel.description ?? '', tokens),
        score,
      })
    }
  }

  hits.sort((a, b) => b.score - a.score)

  return {
    query,
    total: hits.length,
    hits: hits.slice(0, limit),
  }
}
