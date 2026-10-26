import { describe, expect, it } from 'bun:test'
import { searchDomains } from '../src/lib/search'
import { DOMAINS } from '../src/domains'

describe('searchDomains', () => {
  it('finds a domain by exact id keyword', () => {
    const r = searchDomains(DOMAINS, 'coal', 10)
    expect(r.hits.length).toBeGreaterThan(0)
    expect(r.hits[0]?.domain).toBe('coal')
  })

  it('finds sub-routes via summary', () => {
    const r = searchDomains(DOMAINS, 'aggregate production', 10)
    expect(r.hits.some((h) => h.subRouteId === 'aggregate-production')).toBe(true)
  })

  it('ranks more specific matches higher', () => {
    const r = searchDomains(DOMAINS, 'wood pellet', 10)
    expect(r.hits[0]?.domain).toBe('densified-biomass')
  })

  it('returns empty hits for nonsense', () => {
    const r = searchDomains(DOMAINS, 'zxqwerty12345', 10)
    expect(r.hits.length).toBe(0)
    expect(r.total).toBe(0)
  })

  it('respects limit', () => {
    const r = searchDomains(DOMAINS, 'state', 3)
    expect(r.hits.length).toBeLessThanOrEqual(3)
  })

  it('echoes the original query', () => {
    const r = searchDomains(DOMAINS, 'electricity', 10)
    expect(r.query).toBe('electricity')
  })
})
