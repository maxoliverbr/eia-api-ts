import { describe, expect, it } from 'bun:test'
import { DOMAINS, DOMAINS_BY_ID, getDomain } from '../src/domains'

describe('domains', () => {
  it('contains exactly 15 domains', () => {
    expect(DOMAINS.length).toBe(15)
  })

  it('has unique domain ids', () => {
    const ids = DOMAINS.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every domain has at least one sub-route', () => {
    for (const d of DOMAINS) {
      expect(d.subRoutes.length).toBeGreaterThan(0)
    }
  })

  it('every sub-route has a unique id within its domain', () => {
    for (const d of DOMAINS) {
      const ids = d.subRoutes.map((s) => s.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('every sub-route path is rooted at the domain or at a known parent (electricity/*)', () => {
    const validRoots = new Set(['coal', 'crude-oil-imports', 'co2-emissions', 'densified-biomass', 'international', 'natural-gas', 'nuclear-outages', 'seds', 'steo', 'total-energy'])
    for (const d of DOMAINS) {
      for (const s of d.subRoutes) {
        const ok = s.path.startsWith(d.id) || s.path === `${d.id}/{year}` || s.path === '{year}' || (d.id === 'rto' && s.path.startsWith('electricity/rto/')) || (d.id === 'state-electricity-profiles' && s.path.startsWith('electricity/state-electricity-profiles/'))
        if (!ok) throw new Error(`Path "${s.path}" not valid for domain "${d.id}"`)
        expect(ok).toBe(true)
      }
    }
  })

  it('every sub-route has non-empty summary and description', () => {
    for (const d of DOMAINS) {
      for (const s of d.subRoutes) {
        expect(s.summary.length).toBeGreaterThan(0)
        expect(s.description.length).toBeGreaterThan(0)
      }
    }
  })

  it('getDomain returns a known domain', () => {
    expect(getDomain('coal')?.name).toBe('Coal')
    expect(getDomain('not-a-domain')).toBeUndefined()
  })

  it('DOMAINS_BY_ID has the same entries as DOMAINS', () => {
    expect(Object.keys(DOMAINS_BY_ID).sort()).toEqual(DOMAINS.map((d) => d.id).sort())
  })

  it('all required EIA domains are present', () => {
    const required = [
      'aeo', 'ieo', 'co2-emissions', 'coal', 'crude-oil-imports', 'densified-biomass',
      'electricity', 'international', 'natural-gas', 'nuclear-outages', 'rto', 'seds',
      'state-electricity-profiles', 'steo', 'total-energy',
    ]
    for (const id of required) {
      expect(getDomain(id)).toBeDefined()
    }
  })
})
