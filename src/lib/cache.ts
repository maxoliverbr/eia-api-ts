/**
 * In-memory LRU + TTL cache.
 *
 * Used to reduce upstream EIA load:
 *   - route listings: 1h
 *   - facet option lists: 24h
 *   - facet values: 24h
 *   - data queries: 5m
 *
 * The cache key is a deterministic JSON of (method, path, params/body).
 */

type Entry<V> = {
  value: V
  expiresAt: number
  size: number
}

const estimateSize = (v: unknown): number => {
  // Rough JSON-byte estimate; avoids bringing in a size lib
  try {
    return JSON.stringify(v).length
  } catch {
    return 1
  }
}

export type CacheOptions = {
  maxEntries?: number
  maxBytes?: number
}

export class TTLCache<V = unknown> {
  private map = new Map<string, Entry<V>>()
  private currentBytes = 0
  private readonly maxEntries: number
  private readonly maxBytes: number

  constructor(opts: CacheOptions = {}) {
    this.maxEntries = opts.maxEntries ?? 1000
    this.maxBytes = opts.maxBytes ?? 50 * 1024 * 1024 // 50 MB
  }

  /**
   * Build a stable cache key from any set of parts. Objects are sorted
   * by key to ensure `{ a: 1, b: 2 }` and `{ b: 2, a: 1 }` share a key.
   */
  static key(parts: Record<string, unknown>): string {
    const sorted: Record<string, unknown> = {}
    for (const k of Object.keys(parts).sort()) {
      const v = (parts as Record<string, unknown>)[k]
      sorted[k] = v && typeof v === 'object' && !Array.isArray(v) ? TTLCache.key(v as Record<string, unknown>) : v
    }
    return JSON.stringify(sorted)
  }

  get(rawKey: string): V | undefined {
    const entry = this.map.get(rawKey)
    if (!entry) return undefined
    if (entry.expiresAt <= Date.now()) {
      this.map.delete(rawKey)
      this.currentBytes -= entry.size
      return undefined
    }
    // LRU bump
    this.map.delete(rawKey)
    this.map.set(rawKey, entry)
    return entry.value
  }

  set(rawKey: string, value: V, ttlMs: number): void {
    const existing = this.map.get(rawKey)
    if (existing) {
      this.currentBytes -= existing.size
      this.map.delete(rawKey)
    }

    const entry: Entry<V> = {
      value,
      expiresAt: Date.now() + ttlMs,
      size: estimateSize(value),
    }

    this.map.set(rawKey, entry)
    this.currentBytes += entry.size

    // Evict LRU until under both limits
    while (this.map.size > this.maxEntries || this.currentBytes > this.maxBytes) {
      const oldestKey = this.map.keys().next().value
      if (oldestKey === undefined) break
      const oldest = this.map.get(oldestKey)
      this.map.delete(oldestKey)
      if (oldest) this.currentBytes -= oldest.size
    }
  }

  clear(): void {
    this.map.clear()
    this.currentBytes = 0
  }

  get size(): number {
    return this.map.size
  }
}

// ---------------------------------------------------------------------------
// TTL presets (in milliseconds) keyed by path pattern
// ---------------------------------------------------------------------------

export const TTL = {
  ROUTE_LISTING: 60 * 60 * 1000, // 1h
  FACET: 24 * 60 * 60 * 1000, // 24h, facet listings and facet values
  DATA: 5 * 60 * 1000, // 5m
} as const

/**
 * Choose a TTL based on the EIA path being requested.
 */
export const ttlFor = (path: string): number => {
  // data endpoints
  if (/\/data$/.test(path)) return TTL.DATA
  // facet listing (/facet) and facet detail (/facet/{id})
  if (/\/facet(\/[^/]+)?$/.test(path)) return TTL.FACET
  // route listings (everything else, e.g. /coal, /coal/aggregate-production)
  return TTL.ROUTE_LISTING
}

// ---------------------------------------------------------------------------
// Shared singleton
// ---------------------------------------------------------------------------

export const cache = new TTLCache<unknown>()
