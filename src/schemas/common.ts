/**
 * Common reusable schemas: Sort and pagination.
 */
import { t, type Static } from 'elysia'

// ---------------------------------------------------------------------------
// Sort
// ---------------------------------------------------------------------------

export const SortSchema = t.Object({
  column: t.String({ description: 'Column name to sort by.' }),
  direction: t.Union([t.Literal('asc'), t.Literal('desc')], { description: 'Sort direction.' }),
})
export type Sort = Static<typeof SortSchema>

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export const PaginationSchema = t.Object({
  length: t.Optional(t.Integer({ minimum: 0, maximum: 5000, description: 'Max rows to return.' })),
  offset: t.Optional(t.Integer({ minimum: 0, description: 'Row offset for pagination.' })),
})
export type Pagination = Static<typeof PaginationSchema>
