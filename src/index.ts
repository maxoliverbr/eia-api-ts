/**
 * Server entry point.
 *
 *   bun dev       — hot reload
 *   bun start     — production
 *   bun run build — bundle to dist/
 */
import { env } from './config/env'
import { app } from '../elysia.config'

const port = env.PORT

if (env.EIA_API_KEY === 'DEMO_KEY') {
  // eslint-disable-next-line no-console
  console.warn('EIA_API_KEY not set: using the throttled DEMO_KEY. Set a real key for anything but local testing.')
}

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`EIA API for Agents running on http://localhost:${port}`)
  // eslint-disable-next-line no-console
  console.log(`  Docs:   http://localhost:${port}/openapi`)
  // eslint-disable-next-line no-console
  console.log(`  Spec:   http://localhost:${port}/openapi/json`)
  // eslint-disable-next-line no-console
  console.log(`  Domains: GET http://localhost:${port}/domains`)
})

export type { App } from '../elysia.config'
