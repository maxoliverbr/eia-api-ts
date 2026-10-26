/**
 * Unified data query.
 *
 *   POST /query — JSON body with { domain, route, ...DataParams }
 *   GET  /query — same via query string (simpler for ad-hoc calls)
 *
 * The handler strips `domain` and `route` from the request and proxies
 * to the corresponding EIA /v2/{domain}/{route}/data endpoint.
 */
import { Elysia, t, type Static } from 'elysia'
import { eia } from '../lib/eia-client'
import { DataParamsQuerySchema, DataResponseContainerSchema } from '../schemas/data'
import { getDomain, resolveUpstreamPath } from '../domains'
import { EiaApiError } from '../lib/errors'
import { logRequestError } from '../lib/logger'

const QueryGetSchema = t.Object({
  domain: t.String({ minLength: 1 }),
  route: t.String({ minLength: 1 }),
  data: t.Optional(t.String({ description: 'Comma-separated data column list, e.g. "value,price".' })),
  frequency: t.Optional(t.String()),
  start: t.Optional(t.String()),
  end: t.Optional(t.String()),
  length: t.Optional(t.String()),
  offset: t.Optional(t.String()),
})

const upstreamErrorSchema = t.Object({
  error: t.Literal('upstream_error'),
  message: t.String(),
  path: t.String(),
  upstreamStatus: t.Optional(t.Integer()),
})

const validationErrorSchema = t.Object({
  error: t.Literal('validation_error'),
  message: t.String(),
  domain: t.String(),
})

type DataResponseContainer = Static<typeof DataResponseContainerSchema>

const buildUpstreamPath = (domain: string, route: string): string => {
  // Look up the sub-route's canonical upstream path from the domain metadata.
  // rto/state-electricity-profiles/aeo/ieo/co2-emissions have non-default
  // upstream namespaces (e.g. rto lives under `electricity/rto/...`). Falls
  // back to `{domain}/{route}` if the sub-route is unknown.
  const canonical = resolveUpstreamPath(domain, route)
  // The data endpoint is `/v2/{canonical}/data`. If `route` is already
  // "data" or already ends in "/data", skip the suffix to avoid
  // `/v2/{domain}/data/data` or `/v2/{canonical}/data/data`.
  if (route === 'data' || route.endsWith('/data') || canonical.endsWith('/data')) {
    return `/v2/${canonical}`
  }
  return `/v2/${canonical}/data`
}

const stripRouting = (input: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = { ...input }
  delete out['domain']
  delete out['route']
  return out
}

type PostResponse = DataResponseContainer | Static<typeof validationErrorSchema> | Static<typeof upstreamErrorSchema>
type GetResponse = PostResponse

/** Shared catch block for both /query handlers: set status, log, shape body. */
const handleQueryError = (
  err: unknown,
  upstream: string,
  set: { status?: number | string; headers: Record<string, string | number> },
  request: Request,
): Static<typeof upstreamErrorSchema> => {
  const status = err instanceof EiaApiError ? err.status : 502
  set.status = status
  if (err instanceof EiaApiError && err.retryAfterSec !== undefined) {
    set.headers['retry-after'] = String(err.retryAfterSec)
  }
  logRequestError({
    method: request.method,
    path: new URL(request.url).pathname,
    status,
    error: err,
  })
  if (err instanceof EiaApiError) {
    return {
      error: 'upstream_error' as const,
      message: err.message,
      path: upstream,
      ...(err.upstreamStatus !== undefined ? { upstreamStatus: err.upstreamStatus } : {}),
    }
  }
  return {
    error: 'upstream_error' as const,
    message: err instanceof Error ? err.message : 'Unknown upstream error',
    path: upstream,
  }
}

export const queryRoutes = new Elysia({ tags: ['Query'] })
  // ---------------------------------------------------------------------------
  // POST /query
  // ---------------------------------------------------------------------------
  .post(
    '/query',
    async ({ body, set, request }): Promise<PostResponse> => {
      const domainMeta = getDomain(body.domain)
      if (!domainMeta) {
        set.status = 400
        return {
          error: 'validation_error' as const,
          message: `Unknown domain "${body.domain}". Call GET /domains to see available domains.`,
          domain: body.domain,
        }
      }
      const upstream = buildUpstreamPath(body.domain, body.route)
      const params = stripRouting(body as Record<string, unknown>)
      try {
        return (await eia.post<DataResponseContainer>(upstream, params, request.signal)) as DataResponseContainer
      } catch (err) {
        return handleQueryError(err, upstream, set, request)
      }
    },
    {
      body: DataParamsQuerySchema,
      detail: {
        summary: 'Unified data query (POST)',
        description: [
          'Fetch any EIA dataset through a single, typesafe endpoint. The body is a DataParams object plus `domain` and `route` keys, both of which are stripped before the upstream call.',
          '',
          '**Example**',
          '```bash',
          'curl -X POST http://localhost:3000/query \\',
          '  -H "Content-Type: application/json" \\',
          '  -d \'{ "domain": "coal", "route": "aggregate-production", "frequency": "annual", "start": "2020", "end": "2024", "length": 50 }\'',
          '```',
          '',
          '**Sample response (truncated)**',
          '```json',
          '{ "response": { "total": 5, "dateFormat": "YYYY", "frequency": "annual", "data": [ { "period": "2020", "location": "UNITED STATES", "production": 535567, "production-units": "thousand short tons" } ] } }',
          '```',
          '',
          '**Tips**',
          '- Always read `/domains/:domain` first to get the right sub-route id and `exampleQuery` template.',
          '- Use facets (`{ "location": ["CALIFORNIA"] }`) to narrow rows; resolve ids with `/routes/.../facet/:id` first.',
          '- Cap a single request with `length` (≤ 5000) and paginate with `offset`.',
          '- Identical bodies are served from a 5-minute cache, so repeating a query is free.',
          '- On `429` or `503`, wait for the `Retry-After` header (seconds) before retrying. `429` means EIA throttled the server and all upstream calls are paused; `503` means the upstream queue is full.',
        ].join('\n'),
        tags: ['Query'],
      },
      response: {
        200: DataResponseContainerSchema,
        // 400 can be either our own validation (unknown domain/route)
        // or an upstream 400 (invalid data column, bad facet, etc.).
        // The body disambiguates via the `error` literal.
        400: t.Union([validationErrorSchema, upstreamErrorSchema]),
        401: upstreamErrorSchema,
        403: upstreamErrorSchema,
        404: upstreamErrorSchema,
        422: upstreamErrorSchema,
        429: upstreamErrorSchema,
        502: upstreamErrorSchema,
        503: upstreamErrorSchema,
      },
    }
  )
  // ---------------------------------------------------------------------------
  // GET /query
  // ---------------------------------------------------------------------------
  .get(
    '/query',
    async ({ query, set, request }): Promise<GetResponse> => {
      const domainMeta = getDomain(query.domain)
      if (!domainMeta) {
        set.status = 400
        return {
          error: 'validation_error' as const,
          message: `Unknown domain "${query.domain}".`,
          domain: query.domain,
        }
      }
      const upstream = buildUpstreamPath(query.domain, query.route)
      const params: Record<string, unknown> = {}
      if (query.data) params['data'] = query.data.split(',').map((s) => s.trim()).filter(Boolean)
      if (query.frequency) params['frequency'] = query.frequency
      if (query.start) params['start'] = query.start
      if (query.end) params['end'] = query.end
      if (query.length) params['length'] = Number(query.length)
      if (query.offset) params['offset'] = Number(query.offset)
      try {
        return (await eia.get<DataResponseContainer>(upstream, params, request.signal)) as DataResponseContainer
      } catch (err) {
        return handleQueryError(err, upstream, set, request)
      }
    },
    {
      query: QueryGetSchema,
      detail: {
        summary: 'Unified data query (GET)',
        description: [
          'Same as `POST /query` but via query string. Use this for simple cases; for facet filters prefer POST.',
          '',
          '**Example**',
          '```bash',
          "curl 'http://localhost:3000/query?domain=coal&route=aggregate-production&frequency=annual&start=2020&end=2024&length=10'",
          '```',
          '',
          'Cached and rate-limited exactly like `POST /query`: on `429` or `503`, wait for `Retry-After` before retrying.',
        ].join('\n'),
        tags: ['Query'],
      },
      response: {
        200: DataResponseContainerSchema,
        400: t.Union([validationErrorSchema, upstreamErrorSchema]),
        401: upstreamErrorSchema,
        403: upstreamErrorSchema,
        404: upstreamErrorSchema,
        422: upstreamErrorSchema,
        429: upstreamErrorSchema,
        502: upstreamErrorSchema,
        503: upstreamErrorSchema,
      },
    }
  )
