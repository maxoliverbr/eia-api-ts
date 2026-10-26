# 05 — Mastra Agent: Wyoming Natural Gas Report

**File:** [`05-mastra-wyoming-natural-gas.ts`](./05-mastra-wyoming-natural-gas.ts)

## What this example is for

This is the first LLM-driven example. A [Mastra](https://mastra.ai) `Agent` (model via [OpenRouter](https://openrouter.ai/)) gets seven hand-written tools that wrap the wrapper's REST endpoints. From the request *"brief insight report on natural gas in Wyoming over the last 5 years"* it writes a ~200-word report with real numbers.

The hard part for the model is the **`duoarea` facet**. Wyoming is `SWY` ("S" + state postal code), and the prompt requires the agent to confirm that from `get_facet_values` instead of guessing.

---

## Tools (defined in the file)

| Tool | Wraps |
|---|---|
| `search_datasets` | `POST /search` |
| `list_domains` | `GET /domains` |
| `get_domain` | `GET /domains/:id` |
| `list_facets` | `GET /routes/{domain}/{route}/facet` |
| `get_facet_values` | `GET /routes/{domain}/{route}/facet/{facetId}` |
| `query_eia` | `POST /query`, raw rows |
| `query_with_summary` | `POST /query` + `summarizeRows()`: per-series min/max/avg/latest/YoY |

Every tool is wrapped in `instrumented()`, which logs its input and the number of rows returned, so you can follow the agent's steps above its final answer.

## The flow the prompt enforces

```
list_domains / get_domain   → confirm natural-gas + sub-routes
list_facets                 → confirm duoarea exists
get_facet_values(duoarea)   → resolve "SWY"
query_with_summary × 3      → cons/sum, pri/sum, prod/oilwells  (annual, 2020–2024, duoarea=SWY)
→ report: Consumption / Prices / Production (well counts)
```

## Things to notice

- **`query_with_summary` keeps the context small.** It returns per-series statistics instead of hundreds of rows. The MCP server's tool of the same name (`src/mcp/tools.ts`) started from this code.
- **`prod/oilwells` returns well counts, not volumes.** The prompt says so explicitly, because the model would otherwise report it as production.
- Tools are written as plain `{ description, inputSchema, execute }` objects. Compare [08](./08-Mastra-MCP-Client.md) and [09](./09-Mastra-MCP2-Energy-Prices.md), which get their tools over MCP instead.

---

## Running

```bash
bun dev                                                      # terminal 1
echo 'OPENROUTER_API_KEY=sk-or-...' >> .env
bun run examples/agents/05-mastra-wyoming-natural-gas.ts     # terminal 2
```

Requires `EIA_API_KEY` on the server. The model is set in the `openrouter('…')` call; any OpenRouter model with tool support works.
