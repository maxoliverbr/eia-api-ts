# Examples Index

All examples assume a server running on `http://localhost:3000` (`bun dev` in another terminal). Set `EIA_API_BASE` to override.

> **New to the API?** Start with [`agents/00-read-the-guide.ts`](./agents/00-read-the-guide.ts) — it fetches `/guide` (the full agent playbook) and shows you everything the API knows about itself.

## 🚀 Quick start

| File | What it shows |
|---|---|
| [`agent-usage.ts`](./agent-usage.ts) | Minimal fetch-based agent flow (40 lines) |
| [`shared.ts`](./shared.ts) | `fetchJson` helper + `EiaClientError` + log helpers used by every other example |

## 📡 Endpoint coverage (one file per group)

| File | Endpoints |
|---|---|
| [`01-meta.ts`](./01-meta.ts) | `GET /`, `GET /health`, `GET /version`, `GET /openapi`, `GET /openapi/json` |
| [`02-discovery.ts`](./02-discovery.ts) | `GET /domains`, `GET /domains/:id`, `GET /routes/*` |
| [`03-facets.ts`](./03-facets.ts) | `GET /routes/*/facet`, `GET /routes/*/facet/:id`, `GET /schema/*` |
| [`04-search.ts`](./04-search.ts) | `POST /search` (4 query styles + error handling) |
| [`05-query-get.ts`](./05-query-get.ts) | `GET /query` (simple, with date range, with columns) |
| [`06-query-post-basic.ts`](./06-query-post-basic.ts) | `POST /query` — basic + sort + pagination |
| [`07-query-post-facets.ts`](./07-query-post-facets.ts) | `POST /query` — with facet filters (the main pattern) |
| [`08-domains-overview.ts`](./08-domains-overview.ts) | One minimal query per domain (15 calls) |

## 🗂️ Per-domain query examples

See [`domains/README.md`](./domains/README.md) for per-domain gotchas.

One focused example per EIA domain:

| Domain | File |
|---|---|
| AEO | [`domains/aeo.ts`](./domains/aeo.ts) |
| IEO | [`domains/ieo.ts`](./domains/ieo.ts) |
| CO2 Emissions | [`domains/co2-emissions.ts`](./domains/co2-emissions.ts) |
| Coal | [`domains/coal.ts`](./domains/coal.ts) |
| Crude Oil Imports | [`domains/crude-oil-imports.ts`](./domains/crude-oil-imports.ts) |
| Densified Biomass | [`domains/densified-biomass.ts`](./domains/densified-biomass.ts) |
| Electricity | [`domains/electricity.ts`](./domains/electricity.ts) |
| International | [`domains/international.ts`](./domains/international.ts) |
| Natural Gas | [`domains/natural-gas.ts`](./domains/natural-gas.ts) |
| Nuclear Outages | [`domains/nuclear-outages.ts`](./domains/nuclear-outages.ts) |
| RTO | [`domains/rto.ts`](./domains/rto.ts) |
| SEDS | [`domains/seds.ts`](./domains/seds.ts) |
| State Electricity Profiles | [`domains/state-electricity-profiles.ts`](./domains/state-electricity-profiles.ts) |
| STEO | [`domains/steo.ts`](./domains/steo.ts) |
| Total Energy | [`domains/total-energy.ts`](./domains/total-energy.ts) |

## 🤖 Realistic agentic flows

| File | Doc | What it shows |
|---|---|---|
| [`agents/00-read-the-guide.ts`](./agents/00-read-the-guide.ts) | [doc](./agents/00-Read-The-Guide.md) | **Start here.** Fetches `/guide` (full playbook) and `/guide/coal` (domain slice); prints philosophy, workflow, anti-patterns, recipes, taskToRoute, and per-sub-route agentGuidance. |
| [`agents/01-discover-and-query.ts`](./agents/01-discover-and-query.ts) | [doc](./agents/01-Discover-And-Query.md) | search → inspect → facets → query (the canonical agent loop) |
| [`agents/02-trend-analysis.ts`](./agents/02-trend-analysis.ts) | [doc](./agents/02-Trend-Analysis.md) | multi-step: monthly → annual aggregation with ASCII bar chart |
| [`agents/03-multi-domain-comparison.ts`](./agents/03-multi-domain-comparison.ts) | [doc](./agents/03-Multi-Domain-Comparison.md) | cross-domain: state CO2 vs electricity net generation |
| [`agents/04-error-recovery.ts`](./agents/04-error-recovery.ts) | [doc](./agents/04-Error-Recovery.md) | handling 422 / 400 / 502 / 401 with retries |
| [`agents/05-mastra-wyoming-natural-gas.ts`](./agents/05-mastra-wyoming-natural-gas.ts) | [doc](./agents/05-Mastra-Wyoming-Natural-Gas.md) | [Mastra](https://mastra.ai) agent via [OpenRouter](https://openrouter.ai/) — 6 tools wrapping `/search`, `/domains`, `/facet`, `/query` to synthesise a Wyoming natural-gas insight report (opt-in: `bun add @mastra/core @ai-sdk/openai-compatible zod`) |
| [`agents/06-mastra-ontology-electricity-carbon.ts`](./agents/06-mastra-ontology-electricity-carbon.ts) | [doc](./agents/06-Ontology-Example.md) | Mastra agent guided by the energy ontology: which fuels produce electricity and emit CO2, then the matching data |
| [`agents/07-ontology-consumption-prediction.ts`](./agents/07-ontology-consumption-prediction.ts) | [doc](./agents/07-Ontology-Consumption-Prediction.md) | Ontology-guided consumption forecast |
| [`agents/08-mastra-mcp-client.ts`](./agents/08-mastra-mcp-client.ts) | [doc](./agents/08-Mastra-MCP-Client.md) | Mastra agent over `/mcp` via `@mastra/mcp`: tools and the `eia://guide` prompt discovered over the wire (needs `MCP_ENABLED=true bun dev`) |
| [`agents/09-mastra-mcp2-energy-prices.ts`](./agents/09-mastra-mcp2-energy-prices.ts) | [doc](./agents/09-Mastra-MCP2-Energy-Prices.md) | Mastra agent over the **MCP SDK v2 client** (protocol 2026-07-28): bridges `listTools()` into Mastra via `z.fromJSONSchema`, mixes in a local unit-conversion tool, and compares gas vs electric home-heating prices across electricity, natural-gas, and STEO (needs `MCP_ENABLED=true bun dev` + `OPENROUTER_API_KEY`) |

## 🐚 cURL

See [`curl/README.md`](./curl/README.md) for env vars and prerequisites.

| File | What it shows |
|---|---|
| [`curl/all-endpoints.sh`](./curl/all-endpoints.sh) | One `curl` invocation per endpoint, grouped by tag |
| [`curl/all-domains.sh`](./curl/all-domains.sh) | One `POST /query` per domain/route (~57 calls) |
| [`curl/ontology-insights.sh`](./curl/ontology-insights.sh) | The ontology insight loop: search → paths → relation evidence → facet bindings → comparability → a real `POST /query` built from a binding |

## 🧰 Optional: full type inference with Eden

See [`types/README.md`](./types/README.md).

| File | What it shows |
|---|---|
| [`types/eden.ts`](./types/eden.ts) | Every example above, rewritten with `@elysiajs/eden` for end-to-end typed calls |

```bash
bun add @elysiajs/eden
bun run examples/types/eden.ts
```

## ▶️ Running

```bash
# In one terminal:
bun dev

# In another:
bun run examples/agent-usage.ts
bun run examples/02-discovery.ts
bun run examples/agents/01-discover-and-query.ts
bash examples/curl/all-endpoints.sh
```

## 📖 See also

- [`EXAMPLES.md`](../EXAMPLES.md) — single Markdown doc with curl + TypeScript snippets per endpoint and per domain
- [`README.md`](../README.md) — project overview
