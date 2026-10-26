/**
 * examples/agents/06-mastra-ontology-electricity-carbon.ts
 *
 * Ontology-native agent: uses the /ontology/* endpoints to drive its own
 * data-query strategy before touching a single EIA dataset.
 *
 * The agent must answer: "Which fossil fuels generate US electricity, and
 * what CO2 emissions are associated with them?"
 *
 * It cannot answer this from prior knowledge — it has to discover it:
 *   1. browse_relations(predicate="emits")         → Coal, NaturalGas, Petroleum emit CO2
 *   2. browse_relations(predicate="produces",       → Coal, NaturalGas, Nuclear, Renewables …
 *                       object="Electricity")         produce electricity
 *   3. Intersect: fossil electricity producers = Coal + NaturalGas
 *   4. get_domain_mapping("electricity")           → confirms domain, route, facet names
 *   5. get_domain_mapping("co2-emissions")         → confirms domain, route, facet names
 *   6. list_facets(…/electric-power-operational-data) → discovers actual fueltypeid codes
 *   7. query_with_summary(electricity, …)           → generation by fuel 2020–2024
 *   8. query_eia / query_with_summary(co2, …)       → emissions data 2020–2024
 *   9. Produce a structured carbon-fingerprint report
 *
 * Run:
 *   bun dev
 *
 *   # In another terminal:
 *   bun add @mastra/core @ai-sdk/openai-compatible zod
 *   # Put OPENROUTER_API_KEY in .env (the loader below picks it up):
 *   echo 'OPENROUTER_API_KEY=sk-or-...' >> .env
 *   bun run examples/agents/06-mastra-ontology-electricity-carbon.ts
 *
 * The repo has no LLM dependency; the three packages above are opt-in.
 */
// @ts-nocheck — opt-in deps, see header comment
import { Agent } from '@mastra/core/agent'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { z } from 'zod'
import { fetchJson, loadDotenv, preflight, log, header, runExample } from '../shared'

loadDotenv()

// ---------------------------------------------------------------------------
// Throttle — enforces a minimum gap between calls that hit the upstream
// EIA API. EIA allows bursts of up to 5 req/s; we target ~3 req/s
// (one call per 300 ms) to stay comfortably under the limit.
// The three ontology tools (/ontology/*) are served in-memory and bypass
// this — only the four data tools below use fetchThrottled.
// ---------------------------------------------------------------------------
const EIA_MIN_INTERVAL_MS = 1000
let lastEiaCallAt = 0

async function fetchThrottled<T>(path: string, init?: RequestInit): Promise<T> {
  const wait = EIA_MIN_INTERVAL_MS - (Date.now() - lastEiaCallAt)
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastEiaCallAt = Date.now()
  return fetchJson<T>(path, init)
}

// ---------------------------------------------------------------------------
// Instrumentation — log every tool call with a meaningful count.
// Handles both EIA data responses ({ response: { data: [...] } }) and
// ontology responses ({ total, classes/relations/domainMappings/... }).
// ---------------------------------------------------------------------------
const instrumented = <Args extends unknown[], R>(
  name: string,
  fn: (...args: Args) => Promise<R>,
): ((...args: Args) => Promise<R>) => {
  return async (...args: Args): Promise<R> => {
    log(`[tool:${name}]  in:  ${JSON.stringify(args[0])}`)
    const r = await fn(...args)
    const dataRows = (r as { response?: { data?: unknown[] } })?.response?.data
    const ontologyList =
      (r as Record<string, unknown>)?.classes ??
      (r as Record<string, unknown>)?.relations ??
      (r as Record<string, unknown>)?.domainMappings ??
      (r as Record<string, unknown>)?.facets ??
      (r as Record<string, unknown>)?.values
    const total = (r as { total?: number })?.total
    const count = Array.isArray(dataRows)
      ? `${dataRows.length} rows`
      : Array.isArray(ontologyList)
        ? `${ontologyList.length} items`
        : typeof total === 'number'
          ? `${total} total`
          : 'ok'
    log(`[tool:${name}]  out: ${count}`)
    return r
  }
}

// ---------------------------------------------------------------------------
// Tool 1 — browse_relations
// The primary ontology discovery tool. Filter by subject, predicate, or object.
// ---------------------------------------------------------------------------
const browseRelations = {
  description:
    'Browse relations in the EIA energy ontology. Filter by subject class id (e.g. "Coal"), predicate verb (e.g. "emits", "produces", "consumes"), or object class id (e.g. "Electricity", "CO2Emissions"). Returns matching RDF-style triples with evidenceDomains.',
  inputSchema: z.object({
    subject: z.string().optional().describe('Subject class id, e.g. "Coal" or "NaturalGas".'),
    predicate: z
      .string()
      .optional()
      .describe(
        'Predicate verb. One of: produces, consumes, imports, exports, stores, transmits, locatedIn, measuredBy, measuredAt, forecastedBy, emits, subClassOf.',
      ),
    object: z
      .string()
      .optional()
      .describe('Object class id, e.g. "Electricity" or "CO2Emissions".'),
  }),
  execute: instrumented(
    'browse_relations',
    async ({
      subject,
      predicate,
      object,
    }: {
      subject?: string
      predicate?: string
      object?: string
    }) => {
      const params = new URLSearchParams()
      if (subject) params.set('subject', subject)
      if (predicate) params.set('predicate', predicate)
      if (object) params.set('object', object)
      const qs = params.toString()
      return fetchJson(`/ontology/relations${qs ? `?${qs}` : ''}`)
    },
  ),
}

// ---------------------------------------------------------------------------
// Tool 2 — get_class_detail
// ---------------------------------------------------------------------------
const getClassDetail = {
  description:
    'Get full detail for an ontology class: its description, sameAs URIs, sub-classes, and all relations where it appears as subject or object. Use to understand a class before querying data.',
  inputSchema: z.object({
    classId: z
      .string()
      .describe(
        'Ontology class id (PascalCase), e.g. "Coal", "NaturalGas", "CO2Emissions", "Electricity".',
      ),
  }),
  execute: instrumented(
    'get_class_detail',
    async ({ classId }: { classId: string }) => fetchJson(`/ontology/classes/${classId}`),
  ),
}

// ---------------------------------------------------------------------------
// Tool 3 — get_domain_mapping
// ---------------------------------------------------------------------------
const getDomainMapping = {
  description:
    'Get the ontology mapping for a specific EIA domain: which ontology classes it covers, which energy flows it represents, its geography scope, available temporal granularities, and the related ontology relation ids. Use this to bridge from an ontology class to an EIA domain id and its routes.',
  inputSchema: z.object({
    domainId: z
      .string()
      .describe('EIA domain id, e.g. "electricity", "co2-emissions", "coal", "natural-gas".'),
  }),
  execute: instrumented(
    'get_domain_mapping',
    async ({ domainId }: { domainId: string }) => fetchJson(`/ontology/domains/${domainId}`),
  ),
}

// ---------------------------------------------------------------------------
// Tool 4 — list_facets
// ---------------------------------------------------------------------------
const listFacets = {
  description:
    'List the filterable facet IDs for a given domain + route (e.g. ["fueltypeid", "location", "sectorid"]). Call get_facet_values to resolve codes for a specific facet.',
  inputSchema: z.object({
    domain: z.string().describe('Domain id, e.g. "electricity" or "co2-emissions".'),
    route: z
      .string()
      .describe(
        'Sub-route id, e.g. "electric-power-operational-data" or "co2-emissions-aggregates".',
      ),
  }),
  execute: instrumented(
    'list_facets',
    async ({ domain, route }: { domain: string; route: string }) =>
      fetchThrottled(`/routes/${domain}/${route}/facet`),
  ),
}

// ---------------------------------------------------------------------------
// Tool 5 — get_facet_values
// ---------------------------------------------------------------------------
const getFacetValues = {
  description:
    'List all valid values for a facet (e.g. the fueltypeid codes available on an electricity route). Returns id + name pairs. Use this to discover the correct code for a fuel type before filtering.',
  inputSchema: z.object({
    domain: z.string().describe('Domain id.'),
    route: z.string().describe('Sub-route id.'),
    facetId: z.string().describe('Facet id, e.g. "fueltypeid" or "fuelId".'),
  }),
  execute: instrumented(
    'get_facet_values',
    async ({ domain, route, facetId }: { domain: string; route: string; facetId: string }) =>
      fetchThrottled(`/routes/${domain}/${route}/facet/${facetId}`),
  ),
}

// ---------------------------------------------------------------------------
// Tool 6 — query_eia
// Raw query, useful for inspecting column shapes in unfamiliar domains.
// ---------------------------------------------------------------------------
const queryEia = {
  description:
    'Execute an EIA data query and return raw rows. Use this to inspect the column shape of an unfamiliar domain before running query_with_summary. Pass domain + route plus optional DataParams.',
  inputSchema: z.object({
    domain: z.string().describe('Domain id.'),
    route: z.string().describe('Sub-route id.'),
    frequency: z.string().optional().describe('"annual" | "monthly" | "quarterly" | "weekly" | "daily".'),
    start: z.string().optional().describe('Start period, e.g. "2020" or "2020-01".'),
    end: z.string().optional().describe('End period, e.g. "2024" or "2024-12".'),
    facets: z
      .record(z.string(), z.array(z.string()))
      .optional()
      .describe('Facet filters, e.g. { fueltypeid: ["COL"] }.'),
    data: z.array(z.string()).optional().describe('Columns to return. Omit to get all columns.'),
    length: z.number().int().min(1).max(5000).optional().describe('Max rows (default 10 for inspection).'),
    sort: z
      .array(z.object({ column: z.string(), direction: z.enum(['asc', 'desc']) }))
      .optional(),
  }),
  execute: instrumented('query_eia', async (params: Record<string, unknown>) =>
    fetchThrottled('/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ length: 10, ...params }),
    }),
  ),
}

// ---------------------------------------------------------------------------
// Tool 7 — query_with_summary
// Post-processes rows into per-series statistics.
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
            Math.abs(toNum(prev.value) as number)) *
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
    'Run an EIA query and return compact per-series statistics. Always injects data:["value"] so numeric values are present. Each series entry has: description, units, periodRange, count, min, max, avg, latest {period, value}, and yoyChangePct. If bySeries is empty, the endpoint may use a different value column — fall back to query_eia to inspect the raw shape.',
  inputSchema: z.object({
    domain: z.string().describe('Domain id.'),
    route: z.string().describe('Sub-route id.'),
    frequency: z.string().optional().describe('"annual" | "monthly" | "quarterly".'),
    start: z.string().optional().describe('Start period.'),
    end: z.string().optional().describe('End period.'),
    facets: z
      .record(z.string(), z.array(z.string()))
      .optional()
      .describe('Facet filters, e.g. { fueltypeid: ["COL", "NG"] }.'),
    length: z.number().int().min(1).max(5000).optional().describe('Max rows (default 500).'),
  }),
  execute: instrumented('query_with_summary', async (params: Record<string, unknown>) => {
    const body = { ...params, data: ['value'], length: (params.length as number) ?? 500 }
    const r = (await fetchThrottled('/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })) as { response?: { data?: RawEiaRow[] } }
    const rows = r.response?.data ?? []
    return summarizeRows(String(params.route), rows)
  }),
}

// ---------------------------------------------------------------------------
// System prompt — the ontology discovery steps are mandatory
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are an energy analyst with access to seven tools: three ontology-navigation tools and four EIA data tools. Your mandate is to let the ontology drive your entire analysis — do not assume which fuels, domains, or routes to use.

GOAL: produce a ~250-word structured report titled "US Electricity Carbon Fingerprint" that identifies which fossil fuels generate US electricity and what CO2 emissions they produce. Cite at least two concrete numerical facts (value + units + period) from the data tools.

MANDATORY WORKFLOW — follow these steps in order:

Step 1 — browse_relations with predicate="emits"
  Discover which ontology classes emit CO2. Record the subject class ids.

Step 2 — browse_relations with predicate="produces" and object="Electricity"
  Discover which energy source classes produce electricity. Record the subject class ids.

Step 3 — Intersect the two sets in your reasoning.
  Classes that appear in BOTH lists are fossil electricity producers that emit CO2.
  Include this reasoning in the "Ontology Discovery" section of your report.

Step 4 — get_domain_mapping for "electricity"
  Use this to confirm the EIA domain, available routes, and facet hints for electricity data.

Step 5 — get_domain_mapping for "co2-emissions"
  Use this to confirm the EIA domain, available routes, and facet hints for CO2 data.

Step 6 — list_facets on domain="electricity", route="electric-power-operational-data"
  Identify the fueltypeid facet values available.

Step 7 — get_facet_values on domain="electricity", route="electric-power-operational-data", facetId="fueltypeid"
  Discover the actual code for coal (likely "COL") and natural gas (likely "NG") — do NOT guess.

Step 8 — query_with_summary for electricity generation
  domain="electricity", route="electric-power-operational-data"
  frequency="monthly", start="2020-01", end="2024-12"
  facets: { fueltypeid: [<coal code>, <ng code>] }, length=500
  If bySeries is empty, drop the facets filter and re-run once to check the data shape.

Step 9 — query_eia to inspect CO2 column shape
  domain="co2-emissions", route="co2-emissions-aggregates"
  frequency="annual", start="2020", end="2024", length=5
  Inspect sampleRow keys. If there is a "value" column, proceed to step 10.
  If not, report the raw rows as-is.

Step 10 — query_with_summary for CO2 emissions (only if step 9 confirmed a "value" column)
  domain="co2-emissions", route="co2-emissions-aggregates"
  frequency="annual", start="2020", end="2024", length=500

INTERPRETATION RULES:
- Quote at least one concrete number (with units and period) from each data query.
- If a query_with_summary returns empty bySeries, note it and report whatever raw rows step 9 returned.
- Never mention tools, steps, or API calls in the report — only cite facts.

OUTPUT FORMAT:
  ## US Electricity Carbon Fingerprint (Ontology-Guided)

  ### Ontology Discovery
  (What the knowledge graph revealed: which classes emit CO2, which produce electricity, which were in both sets, and which EIA domains they map to.)

  ### Electricity Generation — Fossil Fuels (2020–2024)
  (Data from electricity/electric-power-operational-data, filtered to fossil fuel codes.)

  ### CO2 Emissions (2020–2024)
  (Data from co2-emissions/co2-emissions-aggregates.)

  ### Conclusion
  (One paragraph tying the two datasets together, with at least one number from each.)`

const USER_PROMPT =
  'Use the EIA energy ontology to identify which fossil fuels generate US electricity and what CO2 emissions they produce. Produce a carbon fingerprint report for 2020–2024.'

async function main(): Promise<void> {
  header('Mastra agent: US electricity carbon fingerprint (ontology-guided)')

  await preflight()

  if (!process.env.OPENROUTER_API_KEY) {
    log('OPENROUTER_API_KEY is not set.')
    log('Add it to .env at the repo root, then re-run:')
    log("  echo 'OPENROUTER_API_KEY=sk-or-...' >> .env")
    log('  bun run examples/agents/06-mastra-ontology-electricity-carbon.ts')
    log('(Or export it in the current shell: export OPENROUTER_API_KEY=sk-or-...)')
    log('Get a key at https://openrouter.ai/keys.')
    return
  }

  const openrouter = createOpenAICompatible({
    name: 'openrouter',
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
  })

  const agent = new Agent({
    name: 'EIA-Ontology-Carbon-Analyst',
    instructions: SYSTEM_PROMPT,
    model: openrouter('anthropic/claude-sonnet-4-5'),
    tools: {
      browse_relations: browseRelations,
      get_class_detail: getClassDetail,
      get_domain_mapping: getDomainMapping,
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
