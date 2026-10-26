/**
 * Discovery proxy routes. The upstream EIA API mirrors its entire route
 * tree under `/v2/...`, so a single wildcard handler in this wrapper is
 * enough to expose:
 *
 *   GET /routes/{domain}                     -> route listing under a domain
 *   GET /routes/{domain}/{route}             -> FinalRoute metadata for a leaf
 *   GET /routes/{domain}/{route}/facet       -> list of facet IDs for the leaf
 *   GET /routes/{domain}/{route}/facet/{id}  -> values for one facet
 *   GET /schema/{domain}/{route}             -> same as the leaf metadata, named
 *                                              distinctly for agent ergonomics
 *
 * The only thing we enforce here is that `{domain}` is a known EIA domain;
 * unknown domains get a clean 400 instead of a confusing 404 from upstream.
 *
 * Sub-routes for rto, state-electricity-profiles, aeo, ieo, and co2-emissions
 * have non-default upstream namespaces (e.g. rto lives under
 * `electricity/rto/...`). The wrapper looks the canonical path up in the
 * domain metadata so the proxy stays in sync with the actual upstream layout.
 */
import { Elysia, t } from 'elysia'
import { eia } from '../lib/eia-client'
import { getDomain, resolveUpstreamPath } from '../domains'
import { logRequestError } from '../lib/logger'
import { EiaApiError } from '../lib/errors'

const unknownDomainError = (domain: string) => ({
  error: 'validation_error' as const,
  message: `Unknown domain "${domain}". Call GET /domains to see available domains.`,
  domain,
})

const upstreamErrorSchema = t.Object({
  error: t.Literal('upstream_error'),
  message: t.String(),
  path: t.String(),
})

const validationError = t.Object({
  error: t.Literal('validation_error'),
  message: t.String(),
  domain: t.String(),
})

type ProxyResult = Record<string, unknown> | { error: 'upstream_error'; message: string; path: string }

interface ProxyCtx {
  domain: string
  tail: string
  requestPath: string
  method: string
  signal: AbortSignal
}

type ProxyOutcome = { status: number; body: ProxyResult; retryAfterSec?: number }

/** Apply a proxy outcome to the Elysia response. */
const send = (set: { status?: number | string; headers: Record<string, string | number> }, out: ProxyOutcome) => {
  set.status = out.status
  if (out.retryAfterSec !== undefined) set.headers['retry-after'] = String(out.retryAfterSec)
  return out.body
}

/**
 * Domain-validate, build the upstream URL, fetch through the cached,
 * rate-limited client, and translate errors into the wrapper's response
 * shape. Shared by `/routes/:domain`, `/routes/:domain/*`, and
 * `/schema/:domain/*`.
 */
async function proxyUpstream(ctx: ProxyCtx): Promise<ProxyOutcome> {
  const meta = getDomain(ctx.domain)
  if (!meta) {
    return { status: 400, body: unknownDomainError(ctx.domain) }
  }
  // Domains whose sub-routes live under a non-default upstream namespace
  // (rto, state-electricity-profiles) — `/v2/{domain}` returns 404 from
  // upstream, so synthesise the listing from local metadata.
  if (ctx.tail === '' && meta.subRoutes.some((s) => !s.path.startsWith(`${meta.id}/`))) {
    return {
      status: 200,
      body: {
        response: {
          id: meta.id,
          name: meta.name,
          description: meta.description,
          routes: meta.subRoutes.map((s) => ({ id: s.id, name: s.summary, description: s.description })),
        },
        request: { command: `/v2/${meta.id}/` },
        apiVersion: '2.1.12',
        ExcelAddInVersion: '2.1.0',
        __synthesized: true,
      },
    }
  }
  const upstream = buildProxyPath(ctx.domain, ctx.tail)
  try {
    const body = await eia.get<Record<string, unknown>>(upstream, undefined, ctx.signal)
    return { status: 200, body }
  } catch (err) {
    // Throttling (ours or EIA's) keeps its 429/503 + Retry-After so callers
    // back off; any other upstream failure is a 502.
    const retryAfterSec = err instanceof EiaApiError ? err.retryAfterSec : undefined
    const status = retryAfterSec !== undefined ? (err as EiaApiError).status : 502
    logRequestError({
      method: ctx.method,
      path: ctx.requestPath,
      status,
      error: err,
    })
    return {
      status,
      retryAfterSec,
      body: {
        error: 'upstream_error' as const,
        message: err instanceof Error ? err.message : 'Upstream EIA error',
        path: upstream,
      },
    }
  }
}

/**
 * Build the upstream URL for `/routes/{domain}/{tail}` (or `/schema/...`).
 * If the tail starts with a known sub-route id (possibly followed by more
 * segments), substitute the metadata `path` for the id; otherwise pass the
 * tail through verbatim. The domain prefix is dropped when we substitute.
 */
const buildProxyPath = (domain: string, tail: string): string => {
  if (tail === '') return `/v2/${domain}`
  // Tail may be `subRouteId`, `subRouteId/rest`, or a fully canonical
  // path like `electricity/rto/daily-fuel-type-data`. Split into
  // candidate sub-route id and the rest.
  const firstSlash = tail.indexOf('/')
  const candidateId = firstSlash === -1 ? tail : tail.slice(0, firstSlash)
  const rest = firstSlash === -1 ? '' : tail.slice(firstSlash + 1)
  const canonical = resolveUpstreamPath(domain, candidateId)
  // If the candidate is a known sub-route (canonical != "{domain}/{id}" fallback)
  // or the rest of the path would line up, use the canonical + rest.
  // The fallback path returned by resolveUpstreamPath is `${domain}/${id}`;
  // compare against that to decide whether the lookup actually matched.
  const fallback = `${domain}/${candidateId}`
  if (canonical !== fallback) {
    return rest ? `/v2/${canonical}/${rest}` : `/v2/${canonical}`
  }
  // For some domains (crude-oil-imports, international, seds, steo,
  // total-energy) the leaf path in metadata is the data endpoint itself
  // (e.g. `crude-oil-imports/data`). Upstream exposes the facet list at
  // the parent level (`crude-oil-imports/facet/{id}`), NOT under `/data`.
  // Detect a `/facet` request against a canonical that ends in `/data` and
  // strip the suffix so the proxy hits the right upstream path.
  if (rest.startsWith('facet/') && canonical.endsWith('/data')) {
    return `/v2/${canonical.slice(0, -'/data'.length)}/${rest}`
  }
  return `/v2/${domain}/${tail}`
}

/** Appended to every proxy route's OpenAPI description. */
const PROXY_NOTE =
  'Responses are cached (facet values 24 h, route listings 1 h). On `429` or `503`, wait for the `Retry-After` header (seconds) before retrying: `429` means EIA throttled the server and all upstream calls are paused, `503` means the upstream queue is full. Any other upstream failure is `502`.'

const proxyResponse = {
  response: {
    200: t.Any(),
    400: validationError,
    429: upstreamErrorSchema,
    502: upstreamErrorSchema,
    503: upstreamErrorSchema,
  },
}

export const facetRoutes = new Elysia({ tags: ['Facets'] })
  // ---------------------------------------------------------------------------
  // GET /routes/{domain} — bare-domain listing
  // (Separate route so the trailing-slash variant matches without a tail.)
  // ---------------------------------------------------------------------------
  .get('/routes/:domain', async ({ params, set, request }) => {
    return send(set, await proxyUpstream({
      domain: params.domain,
      tail: '',
      requestPath: new URL(request.url).pathname,
      method: request.method,
      signal: request.signal,
    }))
  }, {
    detail: {
      summary: 'EIA route tree for a domain (proxied, domain-validated)',
      description: [
        'Proxies the upstream EIA route listing at `/v2/{domain}/`. Synthesised from local metadata for domains with non-default upstream namespaces (rto, state-electricity-profiles).',
        '',
        '**Example**',
        '```bash',
        'curl http://localhost:3000/routes/coal',
        '```',
        '',
        '**Next steps** → `GET /routes/coal/aggregate-production/facet` to list facets, or `GET /schema/coal/aggregate-production` to read the upstream FinalRoute metadata.',
        '',
        PROXY_NOTE,
      ].join('\n'),
      tags: ['Facets'],
    },
    ...proxyResponse,
  })
  // ---------------------------------------------------------------------------
  // GET /routes/{domain}/...  (full EIA route tree under /v2/)
  // ---------------------------------------------------------------------------
  .get('/routes/:domain/*', async ({ params, set, request }) => {
    return send(set, await proxyUpstream({
      domain: params.domain,
      tail: (params as Record<string, string>)['*'] ?? '',
      requestPath: new URL(request.url).pathname,
      method: request.method,
      signal: request.signal,
    }))
  }, {
    detail: {
      summary: 'EIA route tree for a leaf (proxied, domain-validated)',
      description: [
        'Proxies the upstream EIA FinalRoute metadata for a leaf at `/v2/{domain}/{route}`. Returns the canonical column list, frequency options, and facet definitions.',
        '',
        '**Example**',
        '```bash',
        'curl http://localhost:3000/routes/coal/aggregate-production',
        '```',
        '',
        '**Next steps** → `/routes/coal/aggregate-production/facet` to list facet ids, or `POST /query` with that domain+route.',
        '',
        PROXY_NOTE,
      ].join('\n'),
      tags: ['Facets'],
    },
    ...proxyResponse,
  })
  // ---------------------------------------------------------------------------
  // GET /schema/{domain}/...
  // ---------------------------------------------------------------------------
  .get('/schema/:domain/*', async ({ params, set, request }) => {
    const tail = (params as Record<string, string>)['*'] ?? ''
    if (tail.length === 0) {
      set.status = 400
      return {
        error: 'validation_error' as const,
        message: `Path under /schema/${params.domain}/ must include the route, e.g. /schema/${params.domain}/aggregate-production.`,
        domain: params.domain,
      }
    }
    return send(set, await proxyUpstream({
      domain: params.domain,
      tail,
      requestPath: new URL(request.url).pathname,
      method: request.method,
      signal: request.signal,
    }))
  }, {
    detail: {
      summary: 'Schema for a route (domain-validated alias for /routes/...)',
      description:
        `Returns the FinalRoute metadata for a route at /v2/{domain}/{route}. Provided as a distinct, named entry point for agent ergonomics.\n\n${PROXY_NOTE}`,
      tags: ['Facets'],
    },
    ...proxyResponse,
  })
