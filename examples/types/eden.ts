/**
 * examples/types/eden.ts
 *
 * OPTIONAL — end-to-end typed client using Eden Treaty.
 *
 * Eden is not a default dependency. To use this file:
 *
 *   bun add @elysiajs/eden
 *
 * After installing, every API call gets full type inference: request body
 * shape, response shape, and error structure. The same call signatures as
 * the fetch-based examples in the parent folder.
 */

import { treaty } from '@elysiajs/eden'
import type { app } from '../../elysia.config'
import { preflight, runExample } from '../shared'

// `treaty<typeof app>` gives you a client whose types are derived from
// the server's route definitions. As you add routes, this client updates.
const api = treaty<typeof app>('http://localhost:3000')

async function main(): Promise<void> {
  await preflight()
  // 1. /domains — fully typed response
  const domains = await api.domains.get()
  if (domains.error) throw domains.error
  // domains.data is { domains: DomainMeta[] } — fully inferred
  console.log(`Discovered ${domains.data?.domains.length} domains`)
  console.log('First three:')
  for (const d of domains.data?.domains.slice(0, 3) ?? []) {
    console.log(`  - ${d.id}: ${d.name}`)
  }

  // 2. /domains/:id — fully typed
  const coal = await api.domains({ domain: 'coal' }).get()
  if (coal.error) throw coal.error
  console.log(`\nCoal: ${coal.data?.subRoutes.length} sub-routes`)

  // 3. POST /query — body is checked, response is typed
  const query = await api.query.post({
    domain: 'coal',
    route: 'aggregate-production',
    frequency: 'annual',
    start: '2020',
    end: '2024',
    length: 5,
  })
  if (query.error) throw query.error
  // query.data is DataResponseContainer | ValidationError | UpstreamError
  console.log('\nQuery result rows:', query.data)

  // 4. POST /search
  const search = await api.search.post({ q: 'electricity emissions' })
  if (search.error) throw search.error
  for (const hit of search.data?.hits.slice(0, 3) ?? []) {
    console.log(`  - ${hit.path} (${hit.score.toFixed(1)})`)
  }

  // 5. /routes/:domain/*/facet — path params + wildcard tail.
  // `api.routes({ domain: 'coal' })` substitutes the :domain param at the
  // type level. The tail after `:domain` is matched server-side by the `*`
  // wildcard, so the eden client just navigates it as a literal segment.
  // The bracket access on `aggregate-production` (hyphenated id) builds the
  // URL `/routes/coal/aggregate-production/facet`, which the server
  // captures as `domain=coal, tail=aggregate-production/facet`. Eden 1.x
  // types don't model the wildcard slot, so we cast to `any` only at the
  // route group boundary; the subsequent `.facet.get()` is fully typed.
  // @ts-ignore — see comment above; eden types don't expose the wildcard.
  const coalRoute = api.routes({ domain: 'coal' }) as any
  const facets = await coalRoute['aggregate-production'].facet.get()
  if (facets.error) throw facets.error
  console.log('\nCoal aggregate-production facets:', facets.data)

  // 6. /routes/:domain/*/facet/:facetId
  const stateValues = await coalRoute['aggregate-production'].facet({ facetId: 'stateRegionId' }).get()
  if (stateValues.error) throw stateValues.error
  console.log('State facet values (first 5):', stateValues.data)

  // 7. /schema/:domain/*
  // @ts-ignore — see comment above; same wildcard limitation.
  const coalSchema = api.schema({ domain: 'coal' }) as any
  const schema = await coalSchema['aggregate-production'].get()
  if (schema.error) throw schema.error
  console.log('Schema frequencies:', schema.data)

  // 8. /health, /version
  const health = await api.health.get()
  console.log('\nHealth:', health.data)
  const version = await api.version.get()
  console.log('Version:', version.data)
}

runExample(main)
