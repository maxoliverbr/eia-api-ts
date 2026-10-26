/**
 * examples/01-meta.ts
 *
 * Demonstrates:  GET /   ·   GET /health   ·   GET /version
 *
 * Run:
 *   bun dev          (in another terminal)
 *   bun run examples/01-meta.ts
 */
import { fetchJson, log, header, dump, runExample } from './shared'

async function main(): Promise<void> {
  header('GET /  — API root')
  const root = await fetchJson<{
    name: string
    version: string
    description: string
    endpoints: Record<string, string>
    quickStart: Record<string, string>
  }>('/')
  log('Name:', root.name)
  log('Version:', root.version)
  log('Endpoints:')
  for (const [k, v] of Object.entries(root.endpoints)) {
    log(`  ${k.padEnd(12)} ${v}`)
  }
  log('quickStart.query:', root.quickStart.query)

  header('GET /health  — liveness + upstream reachability')
  const health = await fetchJson<{ status: 'ok'; upstream: 'ok' | 'degraded'; timestamp: string }>(
    '/health',
  )
  log(health)
  if (health.upstream !== 'ok') {
    log('\nNote: upstream is "degraded" — your EIA_API_KEY may be invalid,')
    log('      or the upstream EIA API is unreachable. /health will still return 200.')
  }

  header('GET /version  — server + EIA API versions')
  const versions = await fetchJson<{ server: string; eiaApi: string | null }>('/version')
  log(versions)
  if (versions.eiaApi === null) {
    log('\nNote: eiaApi is null because the upstream EIA API was unreachable.')
  }

  header('GET /openapi  — Swagger UI (just print a couple of headers)')
  const ui = await fetch(`${process.env.EIA_API_BASE ?? 'http://localhost:3000'}/openapi`)
  log('Status:', ui.status)
  log('Content-Type:', ui.headers.get('content-type'))

  header('GET /openapi/json  — OpenAPI 3.x spec (just inspect the top-level shape)')
  const specRes = await fetch(`${process.env.EIA_API_BASE ?? 'http://localhost:3000'}/openapi/json`)
  const spec = (await specRes.json()) as { openapi: string; info: { title: string; version: string }; tags: unknown[] }
  dump(
    {
      openapi: spec.openapi,
      info: spec.info,
      tagCount: spec.tags.length,
      tagNames: spec.tags,
    },
    4000,
  )
}

runExample(main)
