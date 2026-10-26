/**
 * examples/agents/08-mastra-mcp-client.ts
 *
 * The MCP counterpart to 05/06: those two examples hand-write their tools as
 * plain `{ description, inputSchema, execute }` objects that call the REST
 * API directly with `fetch`. This example never writes a tool schema at all.
 * It connects to this repo's own MCP server (`/mcp`, gated by
 * `MCP_ENABLED=true`) with Mastra's real MCP client, `@mastra/mcp`'s
 * `MCPClient`, and lets it discover everything over the wire:
 *
 *   - `mcp.listTools()`            → the server's 8 tools, namespaced
 *                                     `eia_<toolName>`, ready to hand to
 *                                     `new Agent({ tools })` as-is.
 *   - `mcp.resources.read(...)`    → the `eia://guide` resource, parsed and
 *                                     spliced into the system prompt, so the
 *                                     agent's instructions come from the
 *                                     server too — not hardcoded like 06.
 *
 * Same question-shape as 06 (ontology-guided energy analysis), but this time
 * about renewables instead of fossil fuels + carbon, so it isn't a rerun of
 * the same report:
 *
 *   "Which energy sources produce electricity via renewable means, and how
 *    has solar + wind generation trended 2020-2024?"
 *
 * Run:
 *   # Terminal 1 — server, with MCP mounted
 *   MCP_ENABLED=true bun dev
 *
 *   # Terminal 2
 *   bun add @mastra/core @mastra/mcp @ai-sdk/openai-compatible zod
 *   echo 'OPENROUTER_API_KEY=sk-or-...' >> .env
 *   bun run examples/agents/08-mastra-mcp-client.ts
 *
 * The repo has no LLM dependency; the packages above are opt-in.
 */
// @ts-nocheck — opt-in deps, see header comment
import { Agent } from '@mastra/core/agent'
import { MCPClient } from '@mastra/mcp'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { BASE, loadDotenv, preflight, log, header, runExample } from '../shared'

loadDotenv()

const MCP_URL = `${BASE}/mcp`

// ---------------------------------------------------------------------------
// The eia://guide resource, read live from the server. summary + philosophy
// double as the "why" section of the system prompt — no hardcoded ontology
// knowledge here, unlike 06.
// ---------------------------------------------------------------------------
function extractGuidePreamble(guideText: string): string {
  try {
    const guide = JSON.parse(guideText) as { summary?: string; philosophy?: string[] }
    const philosophy = (guide.philosophy ?? []).map((p) => `  - ${p}`).join('\n')
    return `${guide.summary ?? ''}\n\nPhilosophy (from the server's own guide):\n${philosophy}`
  } catch {
    return guideText.slice(0, 800)
  }
}

const USER_PROMPT =
  'Use the EIA energy ontology to identify which energy sources produce electricity via renewable means, then report how solar and wind generation have trended from 2020 to 2024.'

async function main(): Promise<void> {
  header('Mastra agent talking MCP: renewables generation trend')

  await preflight()

  if (!process.env.OPENROUTER_API_KEY) {
    log('OPENROUTER_API_KEY is not set.')
    log('Add it to .env at the repo root, then re-run:')
    log("  echo 'OPENROUTER_API_KEY=sk-or-...' >> .env")
    log('  bun run examples/agents/08-mastra-mcp-client.ts')
    log('(Or export it in the current shell: export OPENROUTER_API_KEY=sk-or-...)')
    log('Get a key at https://openrouter.ai/keys.')
    return
  }

  const mcp = new MCPClient({ servers: { eia: { url: new URL(MCP_URL) } } })

  try {
    log(`\nConnecting to MCP server at ${MCP_URL} ...`)

    let tools: Awaited<ReturnType<typeof mcp.listTools>>
    try {
      tools = await mcp.listTools()
    } catch (err) {
      log(`Could not reach the MCP endpoint at ${MCP_URL}.`)
      log('Most likely cause: the server was started without MCP_ENABLED=true.')
      log('Restart it with:')
      log('  MCP_ENABLED=true bun dev')
      log(`(underlying error: ${err instanceof Error ? err.message : String(err)})`)
      return
    }

    const toolNames = Object.keys(tools)
    log(`Discovered ${toolNames.length} tools over MCP (no local schemas written):`)
    for (const name of toolNames) log(`  - ${name}`)

    log('\nReading the eia://guide resource over MCP ...')
    const guide = await mcp.resources.read('eia', 'eia://guide')
    const guideText = guide.contents.find((c) => 'text' in c)?.text ?? ''
    const guidePreamble = extractGuidePreamble(guideText)

    const openrouter = createOpenAICompatible({
      name: 'openrouter',
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
    })

    const SYSTEM_PROMPT = `You are an energy analyst. Everything you know about this API comes from the guide below and the tools you were given — both fetched live over MCP, not hardcoded.

${guidePreamble}

GOAL: produce a ~200-word report titled "US Renewable Electricity Generation, 2020-2024" that identifies which energy sources produce electricity via renewable means and how solar + wind generation have trended over that period. Cite at least two concrete numerical facts (value + units + period).

MANDATORY WORKFLOW:
1. Browse ontology relations for predicate="produces", object="Electricity" to find every electricity-producing energy source. One of the subjects will be "Renewables" — a single umbrella class (do not assume separate "Solar" or "Wind" classes exist).
2. Get the class detail for the class named exactly "Renewables" to read its description (which specific fuels it covers).
3. Get the domain mapping for "electricity" to confirm the route and facet names.
4. List the facets on the electricity route to find the fuel-type facet, then resolve its values to find the solar and wind codes by name (their ids will not simply be "Solar"/"Wind") — do not guess them.
5. Run a summarized query for electricity generation, monthly, 2020-01 through 2024-12, filtered to the solar and wind codes you resolved in step 4.
6. Never mention tools, steps, or API calls in the report — only cite facts.

OUTPUT FORMAT:
  ## US Renewable Electricity Generation, 2020-2024

  ### Ontology Discovery
  (Which classes produce electricity, and which of those are renewable.)

  ### Generation Trend
  (Data from the electricity route, filtered to solar + wind.)

  ### Conclusion
  (One paragraph, citing at least two numbers.)`

    const agent = new Agent({
      name: 'EIA-MCP-Renewables-Analyst',
      instructions: SYSTEM_PROMPT,
      model: openrouter('anthropic/claude-sonnet-4-5'),
      tools,
    })

    log('\nUser prompt:')
    log(`  ${USER_PROMPT}`)
    log('\n— agent running —\n')

    const result = await agent.generate(USER_PROMPT)

    log('\n— final answer —\n')
    log(result.text)
  } finally {
    await mcp.disconnect()
  }
}

runExample(main)
