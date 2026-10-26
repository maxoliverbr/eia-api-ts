/**
 * GET /health — cheap liveness probe (does NOT hit the upstream).
 * GET /ready — readiness probe (upstream EIA reachability, cached 60s).
 * GET /version — server version + EIA API version (if reachable).
 */
import { Elysia, t } from 'elysia'
import { eia } from '../lib/eia-client'
import { logRequestError } from '../lib/logger'
import pkg from '../../package.json' with { type: 'json' }

export const metaRoutes = new Elysia({ tags: ['Meta'] })
  .get(
    '/health',
    () => ({
      status: 'ok' as const,
      timestamp: new Date().toISOString(),
    }),
    {
      detail: {
        summary: 'Liveness probe',
        description:
          'Returns 200 OK as long as the process is running. Does not contact the upstream EIA API, so it is safe to poll from liveness checks (k8s, load balancers, example preflights).',
        tags: ['Meta'],
      },
      response: t.Object({
        status: t.Literal('ok'),
        timestamp: t.String(),
      }),
    }
  )
  .get(
    '/ready',
    async () => {
      const upstreamOk = await eia.ping()
      return {
        status: 'ok' as const,
        upstream: upstreamOk ? ('ok' as const) : ('degraded' as const),
        timestamp: new Date().toISOString(),
      }
    },
    {
      detail: {
        summary: 'Readiness probe',
        description:
          'Returns 200 OK and reports upstream reachability (`ok` or `degraded`). The EIA check skips the request queue and runs at most once a minute however often this is polled; during a 429 cool-down it reports `degraded` without calling EIA. Use this from readiness checks; use /health for fast liveness.',
        tags: ['Meta'],
      },
      response: t.Object({
        status: t.Literal('ok'),
        upstream: t.Union([t.Literal('ok'), t.Literal('degraded')]),
        timestamp: t.String(),
      }),
    }
  )
  .get(
    '/version',
    async ({ request }) => {
      let eiaApiVersion: string | null = null
      try {
        const data = await eia.get<{ apiVersion?: string }>('/v2/')
        eiaApiVersion = data?.apiVersion ?? null
      } catch (err) {
        // /version is best-effort: surface a null EIA version on the
        // response, but emit a structured log line so the upstream
        // failure isn't swallowed silently.
        logRequestError({
          method: request.method,
          path: new URL(request.url).pathname,
          status: 502,
          error: err,
        })
        eiaApiVersion = null
      }
      return {
        server: pkg.version,
        eiaApi: eiaApiVersion,
      }
    },
    {
      detail: {
        summary: 'Versions',
        description: 'Returns the server version and the upstream EIA API version (if reachable).',
        tags: ['Meta'],
      },
      response: t.Object({
        server: t.String(),
        eiaApi: t.Union([t.String(), t.Null()]),
      }),
    }
  )
