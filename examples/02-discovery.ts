/**
 * examples/02-discovery.ts
 *
 * Demonstrates:  GET /domains   ·   GET /domains/:id   ·   GET /routes/*
 *
 * Run:
 *   bun dev
 *   bun run examples/02-discovery.ts
 */
import { fetchJson, log, header, subheader, dump, runExample } from './shared'
import type { DomainMeta, SubRouteMeta } from '../src/schemas/domain'

async function main(): Promise<void> {
  header('GET /domains  — list all 15 domains')
  const { domains } = await fetchJson<{ domains: DomainMeta[] }>('/domains')
  log(`Discovered ${domains.length} domains:`)
  for (const d of domains) {
    log(`  - ${d.id.padEnd(28)} ${d.name.padEnd(34)} (${d.subRoutes.length} sub-routes)`)
  }

  header('GET /domains/coal  — single domain + sub-routes')
  const coal = await fetchJson<DomainMeta>('/domains/coal')
  log(`Name:        ${coal.name}`)
  log(`Tags:        ${coal.tags.join(', ')}`)
  log(`Use cases:`)
  for (const u of coal.useCases) log(`  - ${u}`)
  log(`Related:     ${coal.relatedDomains?.join(', ') ?? 'none'}`)
  log(`Sub-routes (${coal.subRoutes.length}):`)
  for (const s of coal.subRoutes) {
    log(`  - ${s.id.padEnd(38)} ${s.summary}`)
  }

  subheader('Example: read the first sub-route in full')
  const first = coal.subRoutes[0] as SubRouteMeta
  dump(first, 800)

  header('GET /domains/electricity  — another domain')
  const elec = await fetchJson<DomainMeta>('/domains/electricity')
  log(`${elec.name} — ${elec.subRoutes.length} sub-routes`)
  for (const s of elec.subRoutes) log(`  - ${s.id}: ${s.summary}`)

  header('GET /domains/nope  — 404 handling')
  try {
    await fetchJson('/domains/nope')
  } catch (err) {
    const e = err as { status: number; body: { error: string; message: string } }
    log(`Status: ${e.status}`)
    log(`Body:   ${JSON.stringify(e.body, null, 2)}`)
  }

  header('GET /routes/coal  — proxy to EIA route listing')
  const tree = await fetchJson<{ response: { routes: string[] } }>('/routes/coal')
  log('EIA reports these child routes under /v2/coal:')
  for (const r of tree.response.routes ?? []) log(`  - ${r}`)

  subheader('GET /routes/coal/aggregate-production  — leaf route summary (FinalRoute)')
  const leaf = await fetchJson<{ response: { id: string; name: string; frequency: unknown[]; facets: unknown[] } }>(
    '/routes/coal/aggregate-production',
  )
  log('id:', leaf.response.id)
  log('name:', leaf.response.name)
  log('frequencies:', leaf.response.frequency)
  log('facets count:', leaf.response.facets?.length)
}

runExample(main)
