# eia-api-ts

> Modern, fully-typed wrapper around the **EIA APIv2** for agentic projects.
> Built with **Bun**, **ElysiaJS**, and **OpenAPI**.

The U.S. Energy Information Administration (EIA) exposes a rich but sprawling REST API — 100+ endpoints across 15 data domains. This server wraps that surface in a small, uniform, **end-to-end typed** API designed for AI agents and modern TypeScript clients.

## Executive summary

**eia-api-ts** is a local HTTP service that makes U.S. Energy Information Administration (EIA) data practical for AI agents, analytics pipelines, and TypeScript applications. Instead of navigating EIA's large, domain-specific route tree directly, clients interact with a small, consistent surface: discover datasets, inspect facets, search by intent, and fetch data through a single `POST /query` endpoint.

The wrapper solves three problems that slow down agentic and programmatic energy work. First, **discovery** — EIA's API is powerful but hard to explore at runtime; this server adds `/domains`, `/search`, and facet endpoints with rich metadata (`useCases`, `exampleQuery`, `tags`) so agents can learn what to query without hard-coded domain knowledge. Second, **uniform access** — one query shape works across all 15 data domains (coal, electricity, natural gas, STEO, SEDS, and more), reducing bespoke integration code. Third, **operational fit** — the EIA API key stays server-side, responses are cached and upstream calls are rate-limited, errors are normalized, and an OpenAPI 3.1 spec is available out of the box for tooling and typed clients.

Built on **Bun**, **ElysiaJS**, and **TypeBox**, the project is end-to-end typed from schema to route to optional Eden Treaty client. It is framework-agnostic: use plain `fetch`, curl, Eden, or wire tools in Mastra/LangChain-style agents. Runnable examples cover every endpoint, every domain, and realistic multi-step agent flows (search → inspect → facet → query).

**In short:** eia-api-ts turns a sprawling government energy API into a self-describing, agent-ready backend you can run locally in minutes — one query endpoint, full discovery, strong types, and no LLM dependency in the server itself.

## ✨ Why

- **Unified `POST /query`** — fetch any EIA dataset through one endpoint.
- **Self-describing** — agents can call `/domains`, `/routes/*`, `/search` to learn the API dynamically.
- **Agent guide at `/guide`** — a machine-readable playbook (workflow, decision tree, anti-patterns, copy-pasteable recipes). Fetch once, use as a system prompt.
- **Energy ontology at `/ontology`** — an RDF-style knowledge graph of energy classes and typed relations that bridges abstract concepts ("Coal emits CO2") to concrete EIA domains. Lets agents reason about *what* to query without prior energy knowledge.
- **MCP server at `/mcp`** — the same surface, exposed as 9 tools + 2 resources for any Model Context Protocol client (Claude Desktop, Cursor, etc.). One-line opt-in with `MCP_ENABLED=true`.
- **End-to-end types** — TypeBox schemas flow into Elysia routes, into Eden Treaty clients, into your agent's code. Zero `any`.
- **Rich metadata** — every domain ships with `useCases`, `subRoutes`, `exampleQuery`, `tags`, `playbook`, `commonQueries`, `agentHints`, and `taskToRoute` to help agents reason about when to use it.
- **Smart caching** — in-memory LRU + TTL for GET and POST alike (route listings: 1h, facets: 24h, data: 5m); identical concurrent requests share one upstream call.
- **Built-in rate limiter** — spaces outbound EIA calls by `EIA_MIN_INTERVAL_MS` and backs off as a whole when EIA throttles. See [Rate limits](#-rate-limits).
- **OpenAPI 3.1 out of the box** — browse at `/openapi`, or import the spec into your tooling.

See [`DEPRECATIONS.md`](./DEPRECATIONS.md) for upstream routes and data series that EIA has flagged as deprecated (APIv1, CO2 emissions → SEDS).

## 🚀 Quick start

```bash
# 1. Install
bun install

# 2. Configure
cp .env.example .env
# Edit .env and set EIA_API_KEY (https://www.eia.gov/opendata/)

# 3. Run
bun dev
# Server: http://localhost:3000
# Docs:   http://localhost:3000/openapi
```

### Environment variables

| Var | Default | Purpose |
|---|---|---|
| `EIA_API_KEY` | `DEMO_KEY` (required when `NODE_ENV=production`) | Upstream EIA API key (held server-side; clients never see it) |
| `EIA_BASE_URL` | `https://api.eia.gov` | Upstream EIA API base |
| `PORT` | `3000` | Server port |
| `LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` |
| `EIA_MIN_INTERVAL_MS` | `5000` | Min spacing between outbound EIA fetches (`0` disables) |
| `MCP_ENABLED` | `false` | Mount `/mcp` (Model Context Protocol) |

## 🚦 Rate limits

EIA doesn't publish its limits (third-party reports put them around 5 requests/second in bursts), and an abused key gets suspended. The server protects the key like this:

- **Spacing.** Every outbound EIA call waits in one FIFO queue and starts at least `EIA_MIN_INTERVAL_MS` (default 5000 ms) after the previous one.
- **Caching first.** GET and POST responses are cached (data 5 min, facets 24 h, route listings 1 h), and identical concurrent requests share one upstream call. Cache hits never wait in the queue.
- **Back-off on 429.** EIA's `429` is not retried. It pauses *all* EIA traffic for the response's `Retry-After` (60 s if absent); during the pause requests fail fast with `429`.
- **Bounded queue.** A request that would wait more than 60 s gets `503` instead of hanging, and queued requests whose client disconnected are dropped without calling EIA.
- **Cheap health checks.** `/ready` skips the queue and calls EIA at most once a minute, however often it's polled.

| Status | Meaning | What to do |
|---|---|---|
| `429` | EIA throttled the server; all upstream calls are paused | Wait for the `Retry-After` header, then retry |
| `503` | The server's EIA queue is full | Wait for the `Retry-After` header, then retry |
| `502` | EIA failed or was unreachable (5xx and network errors are retried twice first) | Retry with backoff |

> [!WARNING]
> The queue, pause and cache are **per process**. Two replicas each run their own queue, so EIA sees twice the rate. Run a single instance, or raise `EIA_MIN_INTERVAL_MS` in proportion to the replica count.

## 🗺️ Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/` | API info |
| `GET`  | `/health` | Liveness probe (no upstream call) |
| `GET`  | `/ready`  | Readiness probe (checks EIA at most once a minute; never queued) |
| `GET`  | `/version` | Server + EIA API versions |
| `GET`  | `/openapi` | Swagger UI |
| `GET`  | `/openapi/json` | OpenAPI 3.1 spec |
| `GET`  | `/guide` | Full machine-readable agent playbook |
| `GET`  | `/guide/:domain` | Domain-specific guide slice |
| `GET`  | `/domains` | All 15 domains with metadata |
| `GET`  | `/domains/:domain` | Single domain + sub-routes |
| `GET`  | `/routes/:domain` | Route tree for a domain (proxied) |
| `GET`  | `/routes/:domain/*` | EIA route listing + leaf metadata (proxied) |
| `GET`  | `/routes/:domain/*/facet` | List facet IDs for a route |
| `GET`  | `/routes/:domain/*/facet/:facetId` | Possible values for one facet |
| `GET`  | `/schema/:domain/*` | Response shape for a route (alias) |
| `POST` | `/query` | Unified data query (JSON body) |
| `GET`  | `/query` | Same via query string |
| `POST` | `/search` | Keyword search across datasets |
| `GET`  | `/ontology` | Ontology index (class / relation / mapping counts) |
| `GET`  | `/ontology/classes` | All ontology classes (filter by `?parentClass=`) |
| `GET`  | `/ontology/classes/:classId` | Single class + relations + subclasses |
| `GET`  | `/ontology/relations` | All ontology relations (filter by subject / predicate / object) |
| `GET`  | `/ontology/domains/:domainId` | Ontology mapping for a single EIA domain |
| `GET`  | `/ontology/graph` | Full in-memory model (classes + relations + mappings) |
| `GET`  | `/ontology/export?format=jsonld\|turtle` | RDF serializations |
| `POST` / `GET` / `DELETE` | `/mcp` | MCP endpoint (only when `MCP_ENABLED=true`) |

## 🤖 Agent guide

The fastest way for an agent to learn the API is to fetch the guide once and treat it as a system-prompt / tool-selection reference:

```bash
curl http://localhost:3000/guide
```

The full guide includes:

- **`summary`** + **`philosophy[]`** — the high-level rules for using the API
- **`workflow.steps[]`** — the canonical 5-step flow: search → inspect → facet → resolve facet values → query
- **`decisionTree[]`** — common user intents mapped to the right sequence of calls
- **`antiPatterns[]`** — what *not* to do (and why)
- **`commonRecipes[]`** — copy-pasteable call templates
- **`domains[]`** — a summary of which domains ship playbooks, recipes, and agent hints
- **`endpoints`** — the canonical URL map

For a single domain, use the slice endpoint:

```bash
curl http://localhost:3000/guide/coal
# → { playbook, commonQueries, agentHints, taskToRoute, subRoutes[] }
```

`taskToRoute` is an intent-dispatch table (`"state coal production"` → `"aggregate-production"`) that an agent can scan when it has identified a domain but not a sub-route. `agentHints.warnings` and `.gotchas` collect the non-obvious things that often trip up agents (weekly-only series, id vs display-name facets, max length 5000, etc.).

Inside the per-domain `subRoutes[]`, each entry now also carries `agentGuidance` (free-form prose: when to use, when not to use, alternatives) and `columnDescriptions` (column name → human description) so an agent can interpret raw query results without external documentation.

See `examples/agents/00-read-the-guide.ts` for a complete walkthrough.

## 🧬 Energy ontology

A first-class RDF-style knowledge graph on top of the 15 EIA domains. Classes span 8 top-level concepts (EnergySource, Sector, Geography, EnergyFlow, Measurement, TemporalGranularity, Projection, EnvironmentalImpact), connected by typed relations (`produces`, `consumes`, `emits`, `imports`, `measuredBy`, …), and 15 domain mappings that bridge ontology classes to concrete EIA datasets.

The ontology is served in-memory — no upstream EIA calls — so the agent never burns its 5 req/s budget on discovery.

```bash
# 1. What classes are there?
curl http://localhost:3000/ontology/classes?parentClass=EnergySource | jq '.classes[].id'

# 2. Don't know the exact id? Search by keyword
curl 'http://localhost:3000/ontology/search?q=carbon+emissions' | jq '.hits[] | {type, id, score}'

# 3. Which ontology classes emit CO2?
curl http://localhost:3000/ontology/relations?predicate=emits | jq '.relations[] | {subject, object}'

# 4. Map a class to its EIA domain (and the routes that carry it)
curl http://localhost:3000/ontology/domains/electricity

# 5. Turn a relation into runnable queries (mappings + commonQueries + facet codes)
curl http://localhost:3000/ontology/relations/coal-emits-co2/evidence | jq '.evidence[].commonQueries'

# 6. How do two concepts connect? (multi-hop paths with evidence datasets per hop)
curl 'http://localhost:3000/ontology/paths?from=Residential&to=CO2Emissions' | jq '.paths[0].hops'

# 7. Which datasets can be validly compared for a class?
curl http://localhost:3000/ontology/classes/Electricity/comparability | jq '.comparableGroups'

# 8. Export for external RDF tools
curl 'http://localhost:3000/ontology/export?format=jsonld' | jq .
curl 'http://localhost:3000/ontology/export?format=turtle'
```

Four end-to-end examples in [`examples/agents/`](./examples/agents/):

- `06-mastra-ontology-electricity-carbon.ts` — a Mastra agent that *starts from the ontology* (no hardcoded domain knowledge) and produces a US electricity carbon-fingerprint report.
- `07-ontology-consumption-prediction.ts` — a plain-fetch walkthrough of the same pattern (no LLM dependency): ontology says which sectors/fuels to look at, then a single data query does the rest.
- `08-mastra-mcp-client.ts` — the MCP-protocol counterpart to 06: a Mastra agent that discovers its tools and system-prompt context by talking to this repo's own `/mcp` server via `@mastra/mcp`'s `MCPClient`, instead of hand-writing REST tool wrappers.
- `09-mastra-mcp2-energy-prices.ts` — same idea using the official MCP SDK v2 client (`@modelcontextprotocol/client`, protocol 2026-07-28) wired into a Mastra agent: compares gas vs electric home-heating prices across three domains.

## 🔌 MCP server

The same surface, exposed as a Model Context Protocol endpoint at `/mcp` for any MCP-compatible client (Claude Desktop, Cursor, Continue, custom agents). Off by default; one env var enables it.

```bash
# EIA server on :3000
bun dev

# Same process, also serves /mcp on :3000
MCP_ENABLED=true EIA_API_KEY=... bun dev
```

Add to Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "eia": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

The MCP server exposes:

- **9 tools** — `browse_relations`, `get_class_detail`, `get_domain_mapping`, `get_relation_evidence`, `search_ontology`, `list_facets`, `get_facet_values`, `query_eia`, `query_with_summary` (same shapes as the canonical reference `examples/agents/06-mastra-ontology-electricity-carbon.ts`).
- **2 resources** — `eia://guide` (full playbook) and `eia://guide/{domainId}` (per-domain slice), read-through cache with 1h TTL.

Built on MCP TypeScript SDK v2 (`@modelcontextprotocol/server`) via `createMcpHandler` — Bun-native, no Node-HTTP bridge, stateless. Speaks the **2026-07-28** protocol; 2025-era clients (plain `initialize` handshake) are still served, statelessly. No Host/Origin validation is applied — keep `/mcp` on a trusted network or put a reverse proxy in front. The EIA API key stays server-side; MCP only ever calls the wrapper's own REST API.

See `examples/agents/08-mastra-mcp-client.ts` for a full client-side example: a Mastra agent that connects to this `/mcp` endpoint with `@mastra/mcp`'s `MCPClient` and discovers both the tools and its system-prompt context (the `eia://guide` resource) over the wire. `examples/agents/09-mastra-mcp2-energy-prices.ts` does the same with the official MCP SDK v2 client instead of `@mastra/mcp`.

## 🧪 Example: query coal production

```bash
curl -X POST http://localhost:3000/query \
  -H 'Content-Type: application/json' \
  -d '{
    "domain": "coal",
    "route": "aggregate-production",
    "frequency": "annual",
    "data": ["production", "price"],
    "start": "2020",
    "end": "2024",
    "length": 100
  }'
```

## 🤖 Example: agent with Eden Treaty

```ts
import { treaty } from '@elysiajs/eden'
import type { app } from 'eia-api-ts/elysia.config'

const api = treaty<typeof app>('http://localhost:3000')

// 1. Discover domains
const { data: { domains } } = await api.domains.get()

// 2. Find what facets exist for a route
const { data: facets } = await api
  .routes({ domain: 'coal' })({ '*': 'aggregate-production' })
  .facet.get()

// 3. Query
const { data: result } = await api.query.post({
  domain: 'coal',
  route: 'aggregate-production',
  frequency: 'annual',
  start: '2020',
  end: '2024',
  length: 10,
})
// `result` is fully typed — zero `any`
```

## 💡 Usage examples

Three progressively complex ways to call the wrapper. All assume the dev server is running (`bun dev`) on `http://localhost:3000`.

### 1. Simple — one `POST /query` with plain `fetch`

A single call. No dependencies, no tooling. Useful for scripts, CI, and one-off explorations.

```ts
// A single POST /query with plain fetch — no deps, no tooling.
// Useful for scripts, CI, and one-off explorations.
// Run `bun dev` first, then `bun run this-file.ts`.
async function main(): Promise<void> {
  const response = await fetch('http://localhost:3000/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Body shape: { domain, route, frequency, start, end, length, ... }
    body: JSON.stringify({
      domain: 'natural-gas',     // pick a domain
      route: 'pri/sum',          // pick a route inside that domain
      frequency: 'annual',       // resolution of the time series
      start: '2020',             // inclusive lower bound on `period`
      end: '2024',               // inclusive upper bound on `period`
      facets: { duoarea: ['SCA'] }, // narrow to California only
      data: ['value'],           // ask for the numeric column
      length: 5,                 // cap to 5 rows
    }),
  })

  // The wrapper returns a uniform envelope:
  //   { response: { data, total, frequency, dateFormat, ... } }
  const json = (await response.json()) as {
    response: { data: Record<string, unknown>[]; total: number }
  }

  console.log(`Got ${json.response.total} matching rows; first:`)
  console.log(json.response.data[0])
}

main()
```

### 2. Medium — typed Eden Treaty client

End-to-end TypeScript: request body, response body, and error shape are all inferred from the server. The client re-types automatically when routes change.

```ts
// Typed Eden Treaty client. Request/response types are inferred from
// the server's route definitions, so changing the server changes the
// client — no manual type maintenance.
// Run `bun dev` in one terminal, then this file.
import { treaty } from '@elysiajs/eden'
import type { app } from 'eia-api-ts/elysia.config' // published package path

// `treaty<typeof app>` derives the client shape from the server factory.
const api = treaty<typeof app>('http://localhost:3000')

// 1. List domains — `data` is fully typed as { domains: DomainMeta[] }
const domains = await api.domains.get()
if (domains.error || !domains.data) throw new Error('no domains')
console.log(`${domains.data.domains.length} domains available`)

// 2. Inspect the natural-gas domain
const ng = await api.domains({ domain: 'natural-gas' }).get()
if (ng.error || !ng.data) throw new Error('no natural-gas domain')
console.log(`\n${ng.data.name} (${ng.data.subRoutes.length} sub-routes):`)
for (const s of ng.data.subRoutes) console.log(`  - ${s.id}: ${s.summary}`)

// 3. Pick a sub-route and run a query — body shape is type-checked
const target = ng.data.subRoutes.find((s) => s.id === 'pri/sum')
if (!target) throw new Error('no pri/sum sub-route')

const result = await api.query.post({
  domain: 'natural-gas',
  route: target.id,
  frequency: 'annual',
  start: '2020',
  end: '2024',
  facets: { duoarea: ['SCA'] }, // filter to California
  data: ['value'],
  length: 5,
})
if (result.error || !result.data) throw new Error('no result')

console.log(`\nGot ${result.data.response.total} matching rows`)
for (const row of result.data.response.data) console.log(row)
```

### 3. Complex — multi-step agent flow

A realistic agent loop: discover the data, narrow it down, fetch it, then do a tiny analysis. Self-contained (no `examples/shared` import), so you can copy it into any project.

```ts
// Realistic agent flow: search → inspect → facet → query → analyze.
// Self-contained — no `examples/shared` import required.
type SearchHit = { domain: string; path: string; title: string; score: number }
type SearchResponse = { query: string; total: number; hits: SearchHit[] }
type SubRoute = { id: string; path: string; summary: string; typicalFrequency: string }
type DomainMeta = { id: string; name: string; subRoutes: SubRoute[] }
type FacetList = { response: { facetOptions: string[] } }
type FacetValues = { response: { facets: { id: string; name?: string }[] } }
type Row = { period: string; value: string | number; units?: string; [k: string]: unknown }
type QueryResponse = { response: { data: Row[]; total: number } }

const BASE = 'http://localhost:3000'

// Tiny fetch helper that throws on non-2xx; keep the example portable.
async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init)
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}`)
  return res.json() as Promise<T>
}

async function main(): Promise<void> {
  console.log('=== Agent flow: California natural gas prices, 2020–2024 ===\n')

  // 1. Search by intent — find datasets that mention natural gas prices
  console.log('--- 1. search "natural gas price" ---')
  const search = await fetchJson<SearchResponse>('/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: 'natural gas price' }),
  })
  console.log(`Query "${search.query}" → ${search.total} hits`)
  const top = search.hits[0]
  if (!top) throw new Error('no hits')
  console.log(`Top hit: ${top.path}  (${top.title}, score ${top.score.toFixed(1)})`)

  // 2. Inspect the matched domain to learn its sub-routes
  console.log('\n--- 2. inspect /domains/natural-gas ---')
  const ng = await fetchJson<DomainMeta>('/domains/natural-gas')
  console.log(`${ng.name}: ${ng.subRoutes.length} sub-routes`)
  for (const s of ng.subRoutes) console.log(`  - ${s.id}: ${s.summary}`)
  const priceRoute = ng.subRoutes.find((s) => s.id === 'pri/sum')
  if (!priceRoute) throw new Error('no pri/sum route')

  // 3. Discover the available facets for the chosen route
  console.log('\n--- 3. list facets for natural-gas/pri/sum ---')
  const facets = await fetchJson<FacetList>('/routes/natural-gas/pri/sum/facet')
  console.log('Facets:', facets.response.facetOptions)

  // 4. Pick a value for the geographic facet (`duoarea`)
  console.log('\n--- 4. pick duoarea = California ---')
  const areas = await fetchJson<FacetValues>(
    '/routes/natural-gas/pri/sum/facet/duoarea',
  )
  const ca = areas.response.facets.find((f) => f.name === 'CALIFORNIA')
  if (!ca) throw new Error('no California')
  console.log(`Picked duoarea = ${ca.id} (${ca.name})`)

  // 5. Run the query with the chosen facet and the numeric `value` column
  console.log('\n--- 5. query California natural gas prices, 2020–2024 ---')
  const result = await fetchJson<QueryResponse>('/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      domain: 'natural-gas',
      route: 'pri/sum',
      frequency: 'annual',
      start: '2020',
      end: '2024',
      facets: { duoarea: [ca.id] },
      data: ['value'],
      sort: [{ column: 'period', direction: 'asc' }],
      length: 100,
    }),
  })
  console.log(`Got ${result.response.total} matching rows`)

  // 6. Tiny analysis — residential price series for California
  console.log('\n--- 6. analyze: residential price by year ---')
  const residential = result.response.data.filter(
    (r) => r['process-name'] === 'Price Delivered to Residential Consumers',
  )
  for (const row of residential) {
    console.log(`  ${row.period}  $${row.value} ${row.units ?? ''}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

## 📚 Examples

Every endpoint and every domain has a runnable example under [`examples/`](./examples/). With the dev server running (`bun dev`), pick one and execute it:

```bash
bun run examples/01-meta.ts                              # Meta endpoints (root, health, version, OpenAPI)
bun run examples/02-discovery.ts                         # /domains, /domains/:id, /routes/* (leaf metadata)
bun run examples/03-facets.ts                            # /routes/.../facet, /routes/.../facet/:id, /schema/...
bun run examples/04-search.ts                            # POST /search (4 query styles + error handling)
bun run examples/05-query-get.ts                         # GET /query (simple, with date range, with columns)
bun run examples/06-query-post-basic.ts                  # POST /query — basic + sort + pagination
bun run examples/07-query-post-facets.ts                 # POST /query — with facet filters (the main pattern)
bun run examples/08-domains-overview.ts                  # One minimal query per domain (15 calls)

bun run examples/domains/coal.ts                         # Per-domain query examples (15 files)
bun run examples/agents/00-read-the-guide.ts             # Start here — reads /guide and /guide/coal
bun run examples/agents/01-discover-and-query.ts          # Realistic agent flows (5 files; #5 is a Mastra+OpenRouter agent)
bun run examples/agents/06-mastra-ontology-electricity-carbon.ts   # Ontology-guided Mastra agent (opt-in deps)
bun run examples/agents/07-ontology-consumption-prediction.ts      # Ontology-first consumption forecast (no LLM)
MCP_ENABLED=true bun dev  # then, in another shell:
bun run examples/agents/08-mastra-mcp-client.ts                    # Mastra agent over /mcp via @mastra/mcp
bun run examples/agents/09-mastra-mcp2-energy-prices.ts            # Mastra agent over /mcp via MCP SDK v2 client
bash examples/curl/all-endpoints.sh                      # One curl per endpoint, grouped by tag
bash examples/curl/all-domains.sh                        # One POST /query per registered route (~57 calls)
```

A full per-endpoint, per-domain reference is in [`docs/EXAMPLES.md`](./docs/EXAMPLES.md), each agent example has its own `.md` walkthrough next to it, and [`examples/README.md`](./examples/README.md) has the canonical index.

## 🏗️ Architecture

```
src/
├── schemas/     TypeBox schemas (single source of truth)
├── lib/         EIA client, cache, errors, search, rate limiter
├── domains/     Typed metadata for all 15 domains (+ _sub.ts helper)
├── ontology/    Classes, relations, domain mappings, JSON-LD/Turtle
├── routes/      Elysia route modules (HTTP + /mcp)
├── mcp/         MCP server (tools, resources, transport)
├── config/      Env loading
├── openapi.ts   OpenAPI plugin config
└── index.ts     Server entry

docs-site/       Astro + Starlight docs site, deployed to Dokploy via its Dockerfile
examples/        Runnable examples (endpoints, domains, agents, curl)
tests/           bun test suite
docs/            EXAMPLES.md, DATA_SOURCES.md, bundled EIA swagger spec
```

The docs site uses Bun too:

```bash
cd docs-site && bun install && bun run dev
```

### Adding a new domain

1. Create `src/domains/my-domain.ts` exporting a `DomainMeta`. Use the shared `buildSubRoute()` helper from `./_sub.ts` so the sub-route shape stays consistent across domains.
2. Register it in `src/domains/index.ts`.
3. Done. It's automatically reachable via `POST /query`, listed in `/domains`, indexed by `/search`, documented in OpenAPI, and appears in `/guide`'s domain inventory.
4. *(Optional, recommended for agents)* Fill in the new optional `playbook`, `commonQueries`, `agentHints`, and `taskToRoute` fields on `DomainMeta`, plus `agentGuidance` and `columnDescriptions` on each `SubRouteMeta` — see `src/domains/coal.ts` for a worked example.
5. *(Optional)* Add a `DomainOntologyMapping` entry in `src/ontology/mappings.ts` so the ontology tools know which classes your domain instantiates.

## 📜 Scripts

| Script | Purpose |
|---|---|
| `bun dev` | Hot-reload dev server |
| `bun start` | Production server |
| `bun build` | Bundle to `dist/` |
| `bun test` | Run test suite |
| `bun run typecheck` | TypeScript check |
| `bun run dump-openapi` | Dump OpenAPI spec to `openapi.json` |

## 📦 Data domains covered

Annual Energy Outlook · International Energy Outlook · CO₂ Emissions · Coal · Crude Oil Imports · Densified Biomass · Electricity · State Electricity Profiles · RTO Daily Data · International · Nuclear Outages · Natural Gas · Total Energy · SEDS · STEO

## 📄 License

[MIT](./LICENSE) © 2026 Max Oliver.
