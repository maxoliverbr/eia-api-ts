/**
 * examples/08-domains-overview.ts
 *
 * Demonstrates:  POST /query  — one minimal query per domain
 *
 * Run:
 *   bun dev
 *   bun run examples/08-domains-overview.ts
 */
import { fetchJson, log, queryDomain, header, dump, runExample } from './shared'
import { DOMAINS } from '../src/domains'

const ONE_QUERY_PER_DOMAIN: { domain: string; route: string; body: Record<string, unknown> }[] =
  DOMAINS.flatMap((d) => {
    const sub = d.subRoutes[0]
    if (!sub) return []
    // aeo and ieo use `{year}` as a placeholder route id; the loop can't
    // substitute a concrete year without extra logic, so skip them. The
    // dedicated per-domain examples cover them.
    if (sub.id === '{year}') return []
    return [
      {
        domain: d.id,
        route: sub.id,
        body: {
          frequency: sub.exampleQuery.frequency,
          start: sub.exampleQuery.start,
          end: sub.exampleQuery.end,
          length: 2,
        },
      },
    ]
  })

async function main(): Promise<void> {
  header('POST /query  — one minimal query per domain (15 total)')
  for (const { domain, route, body } of ONE_QUERY_PER_DOMAIN) {
    try {
      const r = await queryDomain(domain, route, body)
      const total = r.response.total
      const sample = r.response.data?.[0]
      log(`${domain.padEnd(28)} ${route.padEnd(40)} → ${String(total).padStart(6)} rows  ·  ${JSON.stringify(sample).slice(0, 80)}`)
    } catch (err) {
      const e = err as { status: number; body?: { error?: string; message?: string } }
      log(`${domain.padEnd(28)} ${route.padEnd(40)} → ERROR ${e.status} ${e.body?.error ?? ''} ${e.body?.message?.slice(0, 60) ?? ''}`)
    }
  }

  header('Raw sample of aeo (placeholder substitution example)')
  // aeo uses {year} as a placeholder route id; the wrapper doesn't substitute
  // it, so we have to pick a real year from the upstream route listing.
  // Hit /routes/aeo to discover the latest year, then query that.
  const aeoListing = await fetchJson<{ response: { routes: { id: string }[] } }>('/routes/aeo')
  const years = aeoListing.response.routes.map((r) => r.id).filter((y) => /^\d{4}$/.test(y))
  const latestYear = years.sort().reverse()[0]
  if (latestYear) {
    log(`Using latest available aeo year: ${latestYear}`)
    const sample = await queryDomain('aeo', latestYear, { frequency: 'annual', length: 2 })
    dump(sample, 1500)
  } else {
    log('No aeo year found in upstream route listing.')
  }
}

runExample(main)
