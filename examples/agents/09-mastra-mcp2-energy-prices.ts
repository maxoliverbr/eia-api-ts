/**
 * examples/agents/09-mastra-mcp2-energy-prices.ts
 *
 * 08 talks to `/mcp` through `@mastra/mcp`'s `MCPClient`. This one skips that
 * adapter and uses the official MCP SDK v2 client (`@modelcontextprotocol/client`)
 * pinned to protocol 2026-07-28 — the same era the server was migrated to in
 * the mcp2 PR. The bridge into Mastra is ~15 lines:
 *
 *   client.listTools()        → JSON Schema per tool
 *   z.fromJSONSchema(schema)  → zod schema Mastra can hand to the model
 *   createTool({ execute })   → forwards to client.callTool()
 *
 * Plus one local tool (`to_usd_per_mmbtu`) so the model never does unit
 * conversion in its head — MCP tools and local tools mix freely.
 *
 * The question is a real household one:
 *
 *   "Is it cheaper to heat a US home with natural gas or electricity, how has
 *    that gap moved since 2020, and what does EIA's short-term outlook say
 *    for the coming winter?"
 *
 * That touches three domains: electricity/retail-sales (residential ¢/kWh),
 * natural-gas/pri/sum (residential $/Mcf), and steo/data (Henry Hub + retail
 * price forecasts).
 *
 * Run:
 *   # Terminal 1 — server, with MCP mounted (EIA_API_KEY needed for queries)
 *   MCP_ENABLED=true bun dev
 *
 *   # Terminal 2
 *   echo 'OPENROUTER_API_KEY=sk-or-...' >> .env
 *   bun run examples/agents/09-mastra-mcp2-energy-prices.ts
 */
import { Agent } from '@mastra/core/agent'
import { createTool } from '@mastra/core/tools'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { z } from 'zod'
import { BASE, loadDotenv, preflight, log, header, runExample } from '../shared'

loadDotenv()

const MCP_URL = `${BASE}/mcp`

// Energy content used to put both fuels on a $/MMBtu footing.
const BTU_PER_KWH = 3412
const MMBTU_PER_MCF = 1.038 // EIA average heat content of delivered natural gas

const toUsdPerMmbtu = createTool({
  id: 'to_usd_per_mmbtu',
  description:
    'Convert a retail energy price to US dollars per million Btu so electricity and natural gas can be compared directly. Use for every price you report side by side.',
  inputSchema: z.object({
    value: z.number().describe('Price as reported by EIA.'),
    unit: z.enum(['cents/kWh', 'usd/mcf', 'usd/mmbtu']),
  }),
  execute: async ({ value, unit }) => {
    const usd =
      unit === 'cents/kWh' ? value / 100 / (BTU_PER_KWH / 1e6) : unit === 'usd/mcf' ? value / MMBTU_PER_MCF : value
    return { usdPerMmbtu: Math.round(usd * 100) / 100 }
  },
})

/** Every tool the server lists, wrapped as a Mastra tool that calls back over MCP. */
async function mcpTools(client: Client) {
  const { tools } = await client.listTools()
  return Object.fromEntries(
    tools.map((t) => [
      t.name,
      createTool({
        id: t.name,
        description: t.description ?? t.name,
        inputSchema: z.fromJSONSchema(t.inputSchema as Parameters<typeof z.fromJSONSchema>[0]),
        execute: async (args) => {
          const res = await client.callTool({ name: t.name, arguments: args as Record<string, unknown> })
          const text = res.content.map((c) => (c.type === 'text' ? c.text : '')).join('\n')
          // Hand tool errors back to the model as data so it can retry with different args.
          return res.isError ? { error: text } : text
        },
      }),
    ]),
  )
}

const SYSTEM_PROMPT = `You are a residential energy analyst. You answer with EIA data only, fetched through the tools you were given.

GOAL: a ~250-word brief titled "Heating a US Home: Gas vs Electric" covering:
  (a) US-average residential electricity vs natural gas price, annual, 2020 through the latest full year;
  (b) both converted to $/MMBtu with to_usd_per_mmbtu, and the electric/gas price ratio per year;
  (c) EIA's short-term (STEO) outlook for this coming winter (Nov–Mar): Henry Hub spot, residential gas, residential electricity.

WORKFLOW (follow the guide's discover-before-query rule — never guess a facet code):
1. Electricity: domain "electricity", route "retail-sales". list_facets, then get_facet_values for stateid and sectorid to find the US-total and residential codes.
   The price column on this route is "price", not "value" — so use query_eia with data:["price"], frequency "annual". query_with_summary will come back empty here.
2. Natural gas: domain "natural-gas", route "pri/sum". get_facet_values for duoarea and process; pick the US-level area and the "delivered to residential consumers" process.
   Always filter on process. query_with_summary works here (value column), frequency "annual".
3. Outlook: domain "steo", route "data", frequency "monthly", facet seriesId. Known STEO series:
     NGHHUUS = Henry Hub spot ($/MMBtu), NGRCUUS = residential gas ($/Mcf), ESRCUUS = residential electricity (¢/kWh).
   Query from the current month through next March.
4. If a tool returns an error, read it, fix the arguments, and retry once before giving up on that series.
5. Convert every price with to_usd_per_mmbtu before comparing. Note that electric heat pumps deliver 2.5–3.5 units of heat per unit of electricity while gas furnaces deliver ~0.95 — mention what that does to the ratio.

OUTPUT: markdown with a small table (year | electricity $/MMBtu | gas $/MMBtu | ratio), then the outlook, then a 2–3 sentence takeaway. Cite units and periods. Never mention tools or API calls.`

const USER_PROMPT =
  'Is it cheaper to heat a US home with natural gas or electricity, how has the gap moved since 2020, and what does EIA expect for the coming winter?'

async function main(): Promise<void> {
  header('Mastra + MCP SDK v2: gas vs electric heating prices')

  await preflight()

  if (!process.env.OPENROUTER_API_KEY) {
    log('OPENROUTER_API_KEY is not set. Add it to .env at the repo root and re-run:')
    log("  echo 'OPENROUTER_API_KEY=sk-or-...' >> .env")
    return
  }

  const client = new Client(
    { name: 'eia-energy-prices-example', version: '0.1.0' },
    { versionNegotiation: { mode: { pin: '2026-07-28' } } },
  )

  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(MCP_URL)))
  } catch (err) {
    log(`Could not reach ${MCP_URL} — start the server with MCP_ENABLED=true bun dev`)
    log(`(underlying error: ${err instanceof Error ? err.message : String(err)})`)
    return
  }

  try {
    log(`Connected over MCP protocol ${client.getNegotiatedProtocolVersion()}`)

    const tools = { ...(await mcpTools(client)), to_usd_per_mmbtu: toUsdPerMmbtu }
    log(`Tools: ${Object.keys(tools).join(', ')}`)

    const openrouter = createOpenAICompatible({
      name: 'openrouter',
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
    })

    const agent = new Agent({
      id: 'eia-heating-price-analyst',
      name: 'EIA-Heating-Price-Analyst',
      instructions: `${SYSTEM_PROMPT}\n\nToday is ${new Date().toISOString().slice(0, 10)}.`,
      model: openrouter(process.env.OPENROUTER_MODEL ?? 'anthropic/claude-sonnet-4-5'),
      tools,
    })

    log(`\nUser prompt:\n  ${USER_PROMPT}\n\n— agent running —\n`)

    const result = await agent.generate(USER_PROMPT, {
      maxSteps: 25,
      onStepFinish: ({ toolCalls }) => {
        for (const c of toolCalls ?? []) log(`  → ${c.payload.toolName}(${JSON.stringify(c.payload.args)})`)
      },
    })

    log('\n— final answer —\n')
    log(result.text)
  } finally {
    await client.close()
  }
}

runExample(main)
