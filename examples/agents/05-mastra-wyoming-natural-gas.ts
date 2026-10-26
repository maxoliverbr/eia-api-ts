/**
 * examples/agents/05-mastra-wyoming-natural-gas.ts
 *
 * Realistic agent flow: a Mastra agent equipped with seven tools that wrap
 * the wrapper's endpoints (/search, /domains, /routes/.../facet, /query)
 * synthesises a brief insight report on natural gas in Wyoming.
 *
 * The agent has to reason about:
 *   1. Which domain + sub-routes cover Wyoming natural gas
 *   2. The duoarea facet value that represents the state of Wyoming.
 *      In the upstream EIA v2 natural-gas taxonomy, state-level duoarea
 *      codes follow the pattern "S" + 2-letter state postal code, so
 *      Wyoming is "SWY" (the agent still has to discover this from
 *      /routes/.../facet/duoarea).
 *   3. Running cons/sum, pri/sum, and prod/oilwells with that filter
 *   4. Turning the numbers into a written summary
 *
 * Run:
 *   bun dev
 *
 *   # In another terminal:
 *   bun add @mastra/core @ai-sdk/openai-compatible zod
 *   # Put OPENROUTER_API_KEY in .env (the loader below picks it up):
 *   echo 'OPENROUTER_API_KEY=sk-or-...' >> .env
 *   bun run examples/agents/05-mastra-wyoming-natural-gas.ts
 *
 * The repo is intentionally untouched — the three packages above are
 * listed as opt-in because the wrapper itself has no LLM dependency.
 */
// @ts-nocheck — opt-in deps, see header comment
import { Agent } from '@mastra/core/agent'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { z } from 'zod'
import { fetchJson, loadDotenv, log, header, runExample } from '../shared'

loadDotenv()

// ---------------------------------------------------------------------------
// Lightweight instrumentation — log every tool call so you can see the
// agent's reasoning path alongside its final answer.
// ---------------------------------------------------------------------------
const instrumented = <Args extends unknown[], R>(
  name: string,
  fn: (...args: Args) => Promise<R>,
): ((...args: Args) => Promise<R>) => {
  return async (...args: Args): Promise<R> => {
    log(`[tool:${name}]  in:  ${JSON.stringify(args[0])}`)
    const r = await fn(...args)
    const rows = (r as { response?: { data?: unknown[] } })?.response?.data
    const count = Array.isArray(rows) ? rows.length : 'n/a'
    log(`[tool:${name}]  out: ${count} rows`)
    return r
  }
}

// ---------------------------------------------------------------------------
// Tool 1 — search_datasets
// ---------------------------------------------------------------------------
const searchDatasets = {
  description:
    'Search EIA datasets by free-text query. Returns hits with domain, subRouteId, path, title, snippet, and score.',
  inputSchema: z.object({
    q: z.string().min(1).describe('Search keywords, e.g. "Wyoming natural gas".'),
    limit: z.number().int().min(1).max(100).optional().describe('Max hits to return (default 5).'),
  }),
  execute: instrumented('search_datasets', async ({ q, limit }: { q: string; limit?: number }) =>
    fetchJson('/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q, limit: limit ?? 5 }),
    }),
  ),
}

// ---------------------------------------------------------------------------
// Tool 2 — list_domains
// ---------------------------------------------------------------------------
const listDomains = {
  description: 'List all 15 EIA data domains with their metadata (id, name, sub-route count, use cases).',
  inputSchema: z.object({}),
  execute: instrumented('list_domains', async () => fetchJson('/domains')),
}

// ---------------------------------------------------------------------------
// Tool 3 — get_domain
// ---------------------------------------------------------------------------
const getDomain = {
  description:
    'Get full metadata for a single domain — sub-routes, tags, use cases, and a typical example query for each sub-route.',
  inputSchema: z.object({ domainId: z.string().describe('Domain id, e.g. "natural-gas".') }),
  execute: instrumented('get_domain', async ({ domainId }: { domainId: string }) =>
    fetchJson(`/domains/${domainId}`),
  ),
}

// ---------------------------------------------------------------------------
// Tool 4 — list_facets
// ---------------------------------------------------------------------------
const listFacets = {
  description: 'List facet IDs available for a given route (e.g. ["duoarea", "process"]).',
  inputSchema: z.object({
    domain: z.string().describe('Domain id, e.g. "natural-gas".'),
    route: z.string().describe('Sub-route id, e.g. "cons/sum" or "pri/sum".'),
  }),
  execute: instrumented('list_facets', async ({ domain, route }: { domain: string; route: string }) =>
    fetchJson(`/routes/${domain}/${route}/facet`),
  ),
}

// ---------------------------------------------------------------------------
// Tool 5 — get_facet_values — the key reasoning step
// ---------------------------------------------------------------------------
const getFacetValues = {
  description:
    "List possible values for a facet. Use this to discover the duoarea code for Wyoming. In the upstream natural-gas v2 taxonomy, state-level codes follow the pattern 'S' + 2-letter state postal code (e.g. 'SWY' for Wyoming, 'SCA' for California). Pick the entry whose id matches that pattern and whose name contains the state name.",
  inputSchema: z.object({
    domain: z.string().describe('Domain id.'),
    route: z.string().describe('Sub-route id.'),
    facetId: z.string().describe('Facet id, e.g. "duoarea".'),
  }),
  execute: instrumented(
    'get_facet_values',
    async ({ domain, route, facetId }: { domain: string; route: string; facetId: string }) =>
      fetchJson(`/routes/${domain}/${route}/facet/${facetId}`),
  ),
}

// ---------------------------------------------------------------------------
// Tool 6 — query_eia
// ---------------------------------------------------------------------------
const queryEia = {
  description:
    'Execute an EIA data query and return the rows. Pass domain + route plus any of the standard DataParams (frequency, start, end, facets, data, length, sort).',
  inputSchema: z.object({
    domain: z.string().describe('Domain id, e.g. "natural-gas".'),
    route: z.string().describe('Sub-route id, e.g. "cons/sum".'),
    frequency: z.string().optional().describe('"annual" | "monthly" | "quarterly" | "weekly" | "daily".'),
    start: z.string().optional().describe('Start period, e.g. "2020" or "2020-01".'),
    end: z.string().optional().describe('End period, e.g. "2024" or "2024-12".'),
    facets: z
      .record(z.string(), z.array(z.string()))
      .optional()
      .describe('Facet filters, e.g. { duoarea: ["SWY"] }.'),
    data: z.array(z.string()).optional().describe('Optional subset of columns to return. For numeric values pass ["value"].'),
    length: z.number().int().min(1).max(5000).optional().describe('Max rows to return.'),
    sort: z
      .array(z.object({ column: z.string(), direction: z.enum(['asc', 'desc']) }))
      .optional()
      .describe('Sort orders.'),
  }),
  execute: instrumented('query_eia', async (params: Record<string, unknown>) =>
    fetchJson('/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }),
  ),
}

// ---------------------------------------------------------------------------
// Tool 7 — query_with_summary
// The primary data tool for the agent. Same input shape as query_eia minus
// the `data` field, but we always inject `data: ["value"]` so the response
// contains numeric values, and we post-process the rows into a compact,
// per-series summary (count, min, max, avg, latest, yoy change, units).
// ---------------------------------------------------------------------------
type RawEiaRow = {
  period?: string
  series?: string
  'series-description'?: string
  value?: string | number
  units?: string
  [k: string]: unknown
}

type SummaryResult = {
  route: string
  totalSeries: number
  totalRows: number
  bySeries: {
    series: string
    description: string | undefined
    units: string | undefined
    periodRange: [string, string]
    count: number
    min: number
    max: number
    avg: number
    latest: { period: string; value: number }
    yoyChangePct: number | null
  }[]
  sampleRow?: Record<string, unknown>
}

const toNum = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.length > 0) {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

const summarizeRows = (route: string, rows: RawEiaRow[]): SummaryResult => {
  const withValues = rows.filter((r) => toNum(r.value) !== null)
  const bySeries = new Map<string, RawEiaRow[]>()
  for (const r of withValues) {
    const key = r.series ?? 'unknown'
    const arr = bySeries.get(key) ?? []
    arr.push(r)
    bySeries.set(key, arr)
  }
  const seriesOut = [...bySeries.entries()].map(([series, group]) => {
    const sorted = [...group].sort((a, b) =>
      String(a.period ?? '').localeCompare(String(b.period ?? '')),
    )
    const values = sorted.map((r) => toNum(r.value) as number)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const avg = values.reduce((a, b) => a + b, 0) / values.length
    const last = sorted[sorted.length - 1]
    const prev = sorted[sorted.length - 2]
    const yoy =
      last && prev
        ? (((toNum(last.value) as number) - (toNum(prev.value) as number)) /
            (toNum(prev.value) as number)) *
          100
        : null
    return {
      series,
      description: last?.['series-description'],
      units: last?.units,
      periodRange: [String(sorted[0]?.period ?? ''), String(last?.period ?? '')] as [string, string],
      count: values.length,
      min,
      max,
      avg,
      latest: { period: String(last?.period ?? ''), value: toNum(last?.value) as number },
      yoyChangePct: yoy,
    }
  })
  return {
    route,
    totalSeries: seriesOut.length,
    totalRows: rows.length,
    bySeries: seriesOut,
    sampleRow: rows[0],
  }
}

const queryWithSummary = {
  description:
    'Run an EIA query and return a compact per-series summary. Always injects data:["value"] so numeric values are present. Each series entry has: description, units, periodRange, count, min, max, avg, latest {period,value}, and yoyChangePct. Use this for the three target natural-gas routes. If bySeries is empty, broaden the query (drop a facet) and re-run.',
  inputSchema: z.object({
    domain: z.string().describe('Domain id, e.g. "natural-gas".'),
    route: z.string().describe('Sub-route id, e.g. "cons/sum".'),
    frequency: z.string().optional().describe('"annual" | "monthly" | "quarterly" | "weekly" | "daily".'),
    start: z.string().optional().describe('Start period, e.g. "2020" or "2020-01".'),
    end: z.string().optional().describe('End period, e.g. "2024" or "2024-12".'),
    facets: z
      .record(z.string(), z.array(z.string()))
      .optional()
      .describe('Facet filters, e.g. { duoarea: ["SWY"] }.'),
    length: z.number().int().min(1).max(5000).optional().describe('Max rows to return (default 200).'),
  }),
  execute: instrumented('query_with_summary', async (params: Record<string, unknown>) => {
    const body = { ...params, data: ['value'], length: (params.length as number) ?? 200 }
    const r = (await fetchJson('/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })) as { response?: { data?: RawEiaRow[] } }
    const rows = r.response?.data ?? []
    return summarizeRows(String(params.route), rows)
  }),
}

const SYSTEM_PROMPT = `You are an energy analyst with access to seven EIA v2 data tools that wrap a local HTTP wrapper.

GOAL: produce a ~200-word structured insight report on natural gas in the state of Wyoming. The report has three sections — Consumption by end use, Prices, and Production (well counts) — and each section must cite at least one concrete numerical fact (value + units + period) drawn from the tool responses.

TOOLS (use them in this order):
1. list_domains / get_domain — confirm the natural-gas domain and its sub-routes.
2. list_facets — on the natural-gas domain, confirm "duoarea" is a usable facet.
3. get_facet_values — call with facetId="duoarea" on any natural-gas route. Pick the entry whose id matches the pattern "S" + state postal code AND whose name contains "Wyoming" (id will be "SWY"). Do not guess — verify the id from the response.
4. query_with_summary — the PRIMARY data tool. Always pass domain, route, frequency, start, end, and facets with the duoarea code from step 3. Do NOT pass "data" — the tool injects it for you. Call it three times, once for each of these sub-routes:
     - cons/sum     (consumption by end use)
     - pri/sum      (price summary)
     - prod/oilwells (Wyoming: returns oil-well counts, not volumes)
   Use frequency: "annual", start: "2020", end: "2024", length: 200.
5. (Optional) query_eia — only if you need to inspect the raw response shape for debugging. The summary tool already does the heavy lifting.

INTERPRETATION RULES:
- prod/oilwells for Wyoming returns a single series of oil-well counts (units: COUNT). Report it as well counts, do not infer production volumes.
- If query_with_summary returns an empty bySeries array, drop a facet (e.g. remove the duoarea filter) and re-run once before giving up on that route.
- For each successful series, you have units, periodRange, min, max, avg, and latest — quote at least one of these in the report.

OUTPUT FORMAT:
  ## Wyoming natural gas, 2020–2024
  ### Consumption by end use
  ...
  ### Prices
  ...
  ### Production (well counts)
  ...
  Then a single closing sentence summarising the overall trend.`

const USER_PROMPT =
  'Give me a brief insight report on natural gas in Wyoming over the last 5 years: consumption by end use, prices, and well counts.'

async function main(): Promise<void> {
  header('Mastra agent: Wyoming natural-gas insights')

  if (!process.env.OPENROUTER_API_KEY) {
    log('OPENROUTER_API_KEY is not set.')
    log('Add it to .env at the repo root, then re-run:')
    log("  echo 'OPENROUTER_API_KEY=sk-or-...' >> .env")
    log('  bun run examples/agents/05-mastra-wyoming-natural-gas.ts')
    log('(Or export it in the current shell: export OPENROUTER_API_KEY=sk-or-...)')
    log('Get a key at https://openrouter.ai/keys.')
    log('(Any OpenRouter-routed model works; claude-3.5-sonnet and gpt-4o-mini are good defaults.)')
    return
  }

  const openrouter = createOpenAICompatible({
    name: 'openrouter',
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
  })

  const agent = new Agent({
    name: 'Wyoming-Natural-Gas-Analyst',
    instructions: SYSTEM_PROMPT,
    model: openrouter('minimax/minimax-m3'),
    tools: {
      search_datasets: searchDatasets,
      list_domains: listDomains,
      get_domain: getDomain,
      list_facets: listFacets,
      get_facet_values: getFacetValues,
      query_eia: queryEia,
      query_with_summary: queryWithSummary,
    },
  })

  log('\nUser prompt:')
  log(`  ${USER_PROMPT}`)
  log('\n— agent running —\n')

  const result = await agent.generate(USER_PROMPT)

  log('\n— final answer —\n')
  log(result.text)
}

runExample(main)
