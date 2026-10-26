# 09 — Mastra + MCP SDK v2: Gas vs Electric Heating Prices

**File:** [`09-mastra-mcp2-energy-prices.ts`](./09-mastra-mcp2-energy-prices.ts)

## What this example is for

[08](./08-Mastra-MCP-Client.md) reaches `/mcp` through Mastra's own adapter (`@mastra/mcp`). This example uses the **official MCP SDK v2 client** (`@modelcontextprotocol/client`) pinned to protocol **2026-07-28**, the version the server moved to in the mcp2 migration. It connects that client to a Mastra agent itself, which takes about 15 lines.

The question is one many households ask:

> *Is it cheaper to heat a US home with natural gas or electricity, how has the gap moved since 2020, and what does EIA expect for the coming winter?*

Answering it takes three domains and a unit conversion, which makes it a good test of whether an agent can combine data correctly.

---

## The MCP → Mastra bridge

```ts
const { tools } = await client.listTools()          // JSON Schema per tool
createTool({
  id: t.name,
  inputSchema: z.fromJSONSchema(t.inputSchema),     // zod 4, no extra dependency
  execute: (args) => client.callTool({ name: t.name, arguments: args }),
})
```

Tool errors (`isError: true`) go back to the model as `{ error }` instead of throwing, so it can correct its arguments and retry (the pattern from [04](./04-Error-Recovery.md)).

A local tool, **`to_usd_per_mmbtu`**, sits next to the 9 MCP tools. It converts ¢/kWh and $/Mcf to $/MMBtu (3,412 Btu/kWh; 1.038 MMBtu/Mcf), so the model never has to do that arithmetic itself.

## Data the agent pulls

| What | Domain / route | Key facets | Notes |
|---|---|---|---|
| Residential electricity price | `electricity` / `retail-sales` | `stateid: US`, `sectorid: RES` | Column is **`price`**, not `value`, so `query_eia` with `data: ["price"]` is required; `query_with_summary` returns nothing |
| Residential gas price | `natural-gas` / `pri/sum` | US `duoarea`, residential `process` | Always filter on `process`, or you get every price type at once |
| Winter outlook | `steo` / `data` | `seriesId`: `NGHHUUS`, `NGRCUUS`, `ESRCUUS` | Henry Hub spot, residential gas, residential electricity; monthly, from now to March |

The prompt also has the agent account for appliance efficiency: a heat pump delivers 2.5–3.5 units of heat per unit of electricity, while a gas furnace delivers about 0.95. Comparing price per MMBtu alone overstates how expensive electric heat is.

## Output

A markdown brief with a table (year | electricity $/MMBtu | gas $/MMBtu | ratio), the STEO winter outlook, and a 2–3 sentence takeaway. Each tool call is logged as `→ tool(args)` while the agent runs.

---

## Running

```bash
MCP_ENABLED=true bun dev                                      # terminal 1
echo 'OPENROUTER_API_KEY=sk-or-...' >> .env
bun run examples/agents/09-mastra-mcp2-energy-prices.ts       # terminal 2
```

Requires `EIA_API_KEY` on the server. `OPENROUTER_MODEL` overrides the model (default `anthropic/claude-sonnet-4-5`).

## What to watch in the logs

- `Connected over MCP protocol 2026-07-28` confirms the v2 handshake. If you see `Could not reach …/mcp`, the server was started without `MCP_ENABLED=true`.
- `get_facet_values` calls before the first query show the agent following the discover-before-query rule.
- A `query_with_summary` on `retail-sales` that comes back empty, followed by a `query_eia` with `data: ["price"]`, is expected.

## Adapting

- **Pick a state:** change the prompt to use the state's `stateid` (electricity) and the `S`-prefixed `duoarea` (gas, e.g. `SNY`), the same pattern as [05](./05-Mastra-Wyoming-Natural-Gas.md).
- **Test the legacy protocol:** set `versionNegotiation: { mode: 'legacy' }` to connect with the 2025 handshake. The server supports both.
