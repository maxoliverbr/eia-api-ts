/**
 * Schemas for /query (data) endpoints.
 *
 * Wraps the EIA DataParams / DataResponse / DataResponseContainer types in
 * TypeBox, plus a top-level DataParamsQuery that adds `domain` and `route`
 * so a single /query endpoint can route to the correct EIA resource.
 */
import { t, type Static } from 'elysia'
import { SortSchema, PaginationSchema } from './common'
import { DomainIdSchema, RoutePathSchema } from './primitives'

// ---------------------------------------------------------------------------
// DataParams (POST body for EIA /data endpoints, mirrored in our /query)
// ---------------------------------------------------------------------------

export const DataParamsSchema = t.Object({
  data: t.Optional(t.Array(t.String(), { description: 'Data columns to return.' })),
  facets: t.Optional(
    t.Record(t.String(), t.Array(t.String()), {
      description: 'Facet filters as `{ facetId: [values...] }`.',
    })
  ),
  frequency: t.Optional(t.String({ description: 'Frequency, e.g. "annual", "monthly", "daily".' })),
  start: t.Optional(t.String({ description: 'Start period, e.g. "2020" or "2020-01".' })),
  end: t.Optional(t.String({ description: 'End period, e.g. "2024" or "2024-12".' })),
  sort: t.Optional(t.Array(SortSchema, { description: 'Sort orders.' })),
  length: t.Optional(t.Integer({ minimum: 0, maximum: 5000 })),
  offset: t.Optional(t.Integer({ minimum: 0 })),
})
export type DataParams = Static<typeof DataParamsSchema>

/**
 * Same as DataParams but with explicit `domain` and `route` fields that
 * our /query endpoint uses to route to the correct EIA resource.
 */
export const DataParamsQuerySchema = t.Composite([
  DataParamsSchema,
  t.Object({
    domain: DomainIdSchema,
    route: RoutePathSchema,
  }),
])
export type DataParamsQuery = Static<typeof DataParamsQuerySchema>

// ---------------------------------------------------------------------------
// DataResponse (EIA response body shape; `data` is intentionally free-form)
// ---------------------------------------------------------------------------

export const DataResponseSchema = t.Object({
  data: t.Any({ description: 'Free-form array of data rows. Shape depends on the dataset.' }),
  dateFormat: t.Optional(t.String()),
  description: t.Optional(t.String()),
  frequency: t.Optional(t.String()),
  total: t.Optional(t.Integer()),
})
export type DataResponse = Static<typeof DataResponseSchema>

// ---------------------------------------------------------------------------
// RouteRequest (echoed in every response)
// ---------------------------------------------------------------------------

export const RouteRequestSchema = t.Object({
  command: t.Optional(t.String()),
  params: t.Optional(t.Any()),
})
export type RouteRequest = Static<typeof RouteRequestSchema>

// ---------------------------------------------------------------------------
// DataResponseContainer (envelope)
// ---------------------------------------------------------------------------

export const DataResponseContainerSchema = t.Object({
  apiVersion: t.Optional(t.String()),
  ExcelAddInVersion: t.Optional(t.String()),
  warnings: t.Optional(t.Array(t.Any())),
  request: t.Optional(RouteRequestSchema),
  response: DataResponseSchema,
})
export type DataResponseContainer = Static<typeof DataResponseContainerSchema>

// Re-export pagination for convenience
export { PaginationSchema }
export type { Pagination } from './common'
