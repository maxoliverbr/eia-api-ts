import { describe, expect, it } from 'bun:test'
import { TTLCache, ttlFor } from '../src/lib/cache'

describe('TTLCache', () => {
  it('stores and retrieves values', () => {
    const c = new TTLCache<string>({ maxEntries: 10 })
    const k = TTLCache.key({ a: 1 })
    c.set(k, 'hello', 60_000)
    expect(c.get(k)).toBe('hello')
  })

  it('expires entries after TTL', async () => {
    const c = new TTLCache<string>()
    const k = TTLCache.key({ x: 1 })
    c.set(k, 'value', 5) // 5ms
    expect(c.get(k)).toBe('value')
    await new Promise((r) => setTimeout(r, 10))
    expect(c.get(k)).toBeUndefined()
  })

  it('produces stable keys regardless of key order', () => {
    const k1 = TTLCache.key({ a: 1, b: 2 })
    const k2 = TTLCache.key({ b: 2, a: 1 })
    expect(k1).toBe(k2)
  })

  it('evicts LRU when full', () => {
    const c = new TTLCache<number>({ maxEntries: 3 })
    c.set('a', 1, 60_000)
    c.set('b', 2, 60_000)
    c.set('c', 3, 60_000)
    // touch 'a' so it becomes most-recently-used
    c.get('a')
    c.set('d', 4, 60_000)
    expect(c.get('b')).toBeUndefined()
    expect(c.get('a')).toBe(1)
    expect(c.get('c')).toBe(3)
    expect(c.get('d')).toBe(4)
  })

  it('clears all entries', () => {
    const c = new TTLCache<number>()
    c.set('a', 1, 60_000)
    c.clear()
    expect(c.size).toBe(0)
    expect(c.get('a')).toBeUndefined()
  })
})

describe('ttlFor', () => {
  it('returns DATA TTL for /data paths', () => {
    expect(ttlFor('/coal/aggregate-production/data')).toBe(5 * 60 * 1000)
  })

  it('returns FACET TTL for /facet/{id}', () => {
    expect(ttlFor('/coal/aggregate-production/facet/stateId')).toBe(24 * 60 * 60 * 1000)
  })

  it('returns FACET TTL for /facet (no id)', () => {
    expect(ttlFor('/coal/aggregate-production/facet')).toBe(24 * 60 * 60 * 1000)
  })

  it('returns ROUTE_LISTING TTL for everything else', () => {
    expect(ttlFor('/coal')).toBe(60 * 60 * 1000)
    expect(ttlFor('/coal/aggregate-production')).toBe(60 * 60 * 1000)
  })
})
