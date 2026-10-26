/**
 * Shared builder for `SubRouteMeta`. Each domain's metadata file defines a
 * local `sub()` for ergonomic call sites; this module replaces those with
 * one helper that handles every observed shape.
 */
import type { FrequencyPreset, SubRouteMeta } from '../schemas/domain'

export type SubRouteOpts = {
  id: string
  summary: string
  description: string
  tags?: string[]
  dateRange: { start: string; end: string | null }
  facetsHint?: string[]
  typicalFrequency?: FrequencyPreset
  /** Override the auto-generated `path = "{domain}/{id}"` (rare). */
  path?: string
  /** Override the auto-derived `start` in `exampleQuery`. */
  exampleStart?: string
  /** Override the auto-derived `end` in `exampleQuery`. */
  exampleEnd?: string
  agentGuidance?: string
  columnDescriptions?: Record<string, string>
  prerequisites?: string[]
}

export function buildSubRoute(domain: string, opts: SubRouteOpts): SubRouteMeta {
  const typicalFrequency = opts.typicalFrequency ?? 'annual'
  return {
    id: opts.id,
    path: opts.path ?? `${domain}/${opts.id}`,
    summary: opts.summary,
    description: opts.description,
    tags: opts.tags ?? [],
    typicalFrequency,
    dateRange: opts.dateRange,
    exampleQuery: {
      frequency: typicalFrequency,
      start: opts.exampleStart ?? opts.dateRange.start,
      end: opts.exampleEnd ?? opts.dateRange.end ?? new Date().getFullYear().toString(),
      length: 50,
    },
    facetsHint: opts.facetsHint ?? [],
    ...(opts.agentGuidance ? { agentGuidance: opts.agentGuidance } : {}),
    ...(opts.columnDescriptions ? { columnDescriptions: opts.columnDescriptions } : {}),
    ...(opts.prerequisites ? { prerequisites: { apiCalls: opts.prerequisites } } : {}),
  }
}
