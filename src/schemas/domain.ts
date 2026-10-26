/**
 * Schemas for our domain metadata (the agent-friendly addition on top of EIA).
 *
 * These describe the rich DomainMeta we attach to every domain in
 * src/domains/*. They're the source of truth for /domains, /search, and
 * the OpenAPI doc strings.
 */
import { t, type Static } from 'elysia'
import { DataParamsSchema } from './data'
import { DomainIdSchema } from './primitives'

// ---------------------------------------------------------------------------
// FrequencyPreset (typed common frequencies)
// ---------------------------------------------------------------------------

export const FrequencyPresetSchema = t.Union(
  [
    t.Literal('annual'),
    t.Literal('monthly'),
    t.Literal('quarterly'),
    t.Literal('weekly'),
    t.Literal('daily'),
    t.Literal('hourly'),
    t.Literal('event'),
  ],
  { description: 'Typical reporting frequency for this sub-route.' }
)
export type FrequencyPreset = Static<typeof FrequencyPresetSchema>

// ---------------------------------------------------------------------------
// DateRange
// ---------------------------------------------------------------------------

export const DateRangeSchema = t.Object({
  start: t.Union([t.String(), t.Null()], { description: 'Earliest period, e.g. "1949".' }),
  end: t.Union([t.String(), t.Null()], { description: 'Latest period, e.g. "2024".' }),
})
export type DateRange = Static<typeof DateRangeSchema>

// ---------------------------------------------------------------------------
// SubRouteMeta
// ---------------------------------------------------------------------------

export const SubRouteMetaSchema = t.Object({
  id: t.String({ description: 'Identifier, e.g. "aggregate-production".' }),
  path: t.String({ description: 'Full EIA route path, e.g. "coal/aggregate-production".' }),
  summary: t.String(),
  description: t.String(),
  tags: t.Array(t.String()),
  typicalFrequency: FrequencyPresetSchema,
  dateRange: DateRangeSchema,
  exampleQuery: t.Object({
    frequency: t.Optional(t.String()),
    start: t.Optional(t.String()),
    end: t.Optional(t.String()),
    facets: t.Optional(t.Record(t.String(), t.Array(t.String()))),
    data: t.Optional(t.Array(t.String())),
    length: t.Optional(t.Integer()),
  }),
  facetsHint: t.Optional(t.Array(t.String(), { description: 'Common facet IDs for this route.' })),
  agentGuidance: t.Optional(
    t.String({ description: 'Free-form guidance for agents: when to use this route, gotchas, alternatives.' })
  ),
  columnDescriptions: t.Optional(
    t.Record(t.String(), t.String(), {
      description: 'Map of returned column name to a one-line human description (e.g. "process-name" → "Process label, e.g. \'Price Delivered to Residential Consumers\'").',
    })
  ),
  prerequisites: t.Optional(
    t.Object({
      apiCalls: t.Array(
        t.String(),
        {
          description:
            "Suggested upstream calls to make before querying this route (e.g. ['GET /routes/coal/aggregate-production/facet']).",
        }
      ),
    })
  ),
})
export type SubRouteMeta = Static<typeof SubRouteMetaSchema>

// ---------------------------------------------------------------------------
// DomainMeta
// ---------------------------------------------------------------------------

export const DomainMetaSchema = t.Object({
  id: DomainIdSchema,
  name: t.String(),
  description: t.String(),
  tags: t.Array(t.String()),
  useCases: t.Array(t.String()),
  subRoutes: t.Array(SubRouteMetaSchema),
  relatedDomains: t.Optional(t.Array(DomainIdSchema)),
  playbook: t.Optional(
    t.Object({
      steps: t.Array(
        t.Object({
          goal: t.String({ description: 'What the agent is trying to learn at this step.' }),
          route: t.String({ description: 'The API call that achieves this goal (e.g. "POST /search").' }),
          why: t.String({ description: 'Why this step exists in the flow.' }),
        }),
        { description: 'A canonical, multi-step agent workflow for this domain.' }
      ),
    })
  ),
  commonQueries: t.Optional(
    t.Array(
      t.Object({
        name: t.String({ description: 'Short recipe name.' }),
        description: t.String({ description: 'One-line description of what the recipe returns.' }),
        params: t.Any({ description: 'JSON body for POST /query, with domain+route filled in.' }),
        expectedShape: t.Optional(
          t.String({ description: 'One-line description of the response shape (columns, units).' })
        ),
      }),
      { description: 'A small set of canonical, copy-pasteable query recipes.' }
    )
  ),
  agentHints: t.Optional(
    t.Object({
      warnings: t.Array(
        t.String(),
        { description: 'Non-obvious things that can go wrong (e.g. namespace mismatches, weekly-only series).' }
      ),
      gotchas: t.Array(
        t.String(),
        { description: 'Tweaks that often surprise new agents (e.g. frequency strings, max length=5000).' }
      ),
      seeAlso: t.Optional(
        t.Array(t.String(), { description: 'Related routes or domains to look at next.' })
      ),
    })
  ),
  taskToRoute: t.Optional(
    t.Record(
      t.String(),
      t.String(),
      {
        description:
          'Map of common user intents to the best sub-route id, e.g. {"state coal production": "aggregate-production", "mine-level production": "mine-production"}.',
      }
    )
  ),
})
export type DomainMeta = Static<typeof DomainMetaSchema>

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export const SearchHitSchema = t.Object({
  domain: DomainIdSchema,
  subRouteId: t.Optional(t.String()),
  path: t.String(),
  title: t.String(),
  snippet: t.String(),
  score: t.Number(),
})
export type SearchHit = Static<typeof SearchHitSchema>

export const SearchRequestSchema = t.Object({
  q: t.String({ minLength: 1, description: 'Search query (keywords, e.g. "coal production").' }),
  limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 10 })),
})
export type SearchRequest = Static<typeof SearchRequestSchema>

export const SearchResponseSchema = t.Object({
  query: t.String(),
  total: t.Integer(),
  hits: t.Array(SearchHitSchema),
})
export type SearchResponse = Static<typeof SearchResponseSchema>

// Re-export so route files can import everything from one place if desired
export { DataParamsSchema }
