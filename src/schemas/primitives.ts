/**
 * TypeBox schemas for the typed ids used in route validation.
 */
import { t } from 'elysia'

export const DomainIdSchema = t.String({ minLength: 1, description: 'EIA domain identifier, e.g. "coal".' })

export const RoutePathSchema = t.String({
  minLength: 1,
  // Allow lowercase alphanumerics, dashes, slashes, and {curly} placeholders
  // (used by aeo/ieo routes like "{year}").
  pattern: '^[a-z0-9/{}-]+$',
  description: 'Slash-separated route path within EIA, e.g. "coal/aggregate-production" or "{year}".',
})
