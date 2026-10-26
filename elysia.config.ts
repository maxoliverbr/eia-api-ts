/**
 * App factory.
 *
 * Composes plugins (OpenAPI, CORS) and route modules into a fully
 * typed Elysia instance. Eden Treaty consumers can import the *type*
 * of this factory to get an end-to-end-typed client.
 */
import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { openapiPlugin } from './src/openapi'
import { rootRoutes } from './src/routes/root'
import { metaRoutes } from './src/routes/meta'
import { discoveryRoutes } from './src/routes/discovery'
import { facetRoutes } from './src/routes/facets'
import { queryRoutes } from './src/routes/query'
import { searchRoutes } from './src/routes/search'
import { guideRoutes } from './src/routes/guide'
import { ontologyRoutes } from './src/routes/ontology'
import { mcpRoutes } from './src/routes/mcp'
import { logRequestError } from './src/lib/logger'

export const createApp = () => {
  const mcpEnabled = process.env['MCP_ENABLED'] === 'true'
  return new Elysia({ name: 'eia-api-ts' })
    .use(cors())
    .use(openapiPlugin)
    .use(rootRoutes)
    .use(metaRoutes)
    .use(facetRoutes)
    .use(discoveryRoutes)
    .use(guideRoutes)
    .use(queryRoutes)
    .use(searchRoutes)
    .use(ontologyRoutes)
    .use(mcpEnabled ? mcpRoutes : new Elysia({ name: 'mcp-disabled' }))
    .onError(({ code, error, set, request }) => {
      // EiaApiError (and anything shaped like it) carries its own status.
      const upstream =
        code !== 'VALIDATION' && error && typeof error === 'object' && 'code' in error && 'status' in error
          ? (error as { status?: number; message?: string })
          : null
      const status = code === 'VALIDATION' ? 400 : typeof upstream?.status === 'number' ? upstream.status : 500
      set.status = status

      // Always emit a single structured error log line so the source of any
      // failure is recoverable from server logs.
      let path = request.url
      try {
        path = new URL(request.url).pathname
      } catch {
        // request.url may be a relative path in some test harnesses; keep
        // the original value rather than throw here.
      }
      // Browser/crawler noise (favicon, robots, etc.) — skip the log so
      // the real failures stay visible.
      const isNoise404 = status === 404 && /^\/(favicon\.ico|robots\.txt|apple-touch-icon.*|\.well-known\/.*)$/.test(path)
      if (!isNoise404) {
        logRequestError({ method: request.method, path, elysiaCode: String(code), status, error })
      }

      if (code === 'VALIDATION') return { error: 'validation_error' as const, message: error.message }
      if (upstream) return { error: 'upstream_error' as const, message: upstream.message ?? 'Upstream error' }
      return {
        error: 'internal_error' as const,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    })
}

export const app = createApp()
export type App = typeof app
