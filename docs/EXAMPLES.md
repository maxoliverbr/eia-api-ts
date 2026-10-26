# Examples

Every endpoint and every domain, with a curl snippet, a TypeScript snippet, and the response shape.

> **Server must be running:** `bun dev` (in another terminal)
> **Base URL:** `http://localhost:3000` (override with `EIA_API_BASE` for the TS examples, or `BASE` for the curl scripts)

For runnable versions of every example below, see [`examples/`](./examples/).

## Contents

- [Endpoints](#endpoints)
  - [GET /](#get-)
  - [GET /health](#get-health)
  - [GET /version](#get-version)
  - [GET /openapi](#get-openapi)
  - [GET /openapi/json](#get-openapijson)
  - [GET /domains](#get-domains)
  - [GET /domains/:id](#get-domainsid)
  - [GET /routes/:domain/*](#get-routesdomain)
  - [GET /routes/:domain/*/facet](#get-routesdomainfacet)
  - [GET /routes/:domain/*/facet/:id](#get-routesdomainfacetid)
  - [GET /schema/:domain/*](#get-schemadomain)
  - [POST /search](#post-search)
  - [POST /query](#post-query)
  - [GET /query](#get-query)
- [Domains](#domains) (AEO → TOTAL)
- [Agents](#agents)

> **Note on route discovery:** `rto`, `state-electricity-profiles`, `aeo`, and `ieo` have non-default upstream namespaces (e.g. rto lives under `/v2/electricity/rto/...`). The wrapper looks the canonical path up in its local domain metadata, so callers can use the friendly sub-route id (`rto/daily-fuel-type-data`) without remembering the upstream prefix. `aeo` and `ieo` use a `{year}` placeholder for the publication year — call `GET /routes/aeo` first to discover the available years.

> **Note on deprecations:** the `co2-emissions` upstream routes still respond but the underlying data series were deprecated by EIA in 2023 in favour of `seds`. See [`DEPRECATIONS.md`](./DEPRECATIONS.md) for the full list (including APIv1).

---

## Endpoints

### `GET /`

Landing page with links to the most useful endpoints.

```bash
curl -s http://localhost:3000/ | jq .
```

```ts
const root = await fetch('http://localhost:3000/').then(r => r.json())
console.log(root.endpoints.domains)  // "/domains"
```

```json
{
  "name": "EIA API for Agents",
  "version": "0.1.0",
  "endpoints": { "domains": "/domains", "query": "/query", "search": "/search", "...": "..." }
}
```

---

### `GET /health`

Liveness + upstream reachability.

```bash
curl -s http://localhost:3000/health | jq .
```

```json
{ "status": "ok", "upstream": "ok", "timestamp": "2024-05-01T12:00:00.000Z" }
```

`upstream` is `"degraded"` if the EIA API is unreachable.

---

### `GET /version`

Server and EIA API versions.

```bash
curl -s http://localhost:3000/version | jq .
```

```json
{ "server": "0.1.0", "eiaApi": "2.1.0" }
```

---

### `GET /openapi`

Interactive Swagger UI. Open `http://localhost:3000/openapi` in a browser.

---

### `GET /openapi/json`

Raw OpenAPI 3.x spec (JSON). Useful for tool integration.

```bash
curl -s http://localhost:3000/openapi/json | jq .info
```

---

### `GET /domains`

List all 15 domains with rich metadata: name, description, tags, use cases, sub-routes, related domains.

```bash
curl -s http://localhost:3000/domains | jq '.domains | length'  # 15
```

```ts
const { domains } = await fetch('/domains').then(r => r.json())
for (const d of domains) console.log(d.id, d.name, d.subRoutes.length)
```

```json
{
  "domains": [
    {
      "id": "aeo",
      "name": "Annual Energy Outlook",
      "description": "Long-term projections of U.S. energy supply, demand, prices, and emissions...",
      "tags": ["projection", "long-term", "policy-neutral", "us"],
      "useCases": ["Project future U.S. energy demand by sector and fuel", "..."],
      "subRoutes": [{ "id": "{year}", "path": "aeo/{year}", "summary": "...", "...": "..." }],
      "relatedDomains": ["ieo", "steo", "total-energy"]
    }
  ]
}
```

---

### `GET /domains/:id`

Single domain + sub-routes + example queries.

```bash
curl -s http://localhost:3000/domains/coal | jq '.subRoutes | length'  # 13
```

```ts
const coal = await fetch('/domains/coal').then(r => r.json())
console.log(coal.name, coal.subRoutes.length)
```

```json
{
  "id": "coal",
  "name": "Coal",
  "description": "Comprehensive U.S. coal data: production, consumption, exports/imports, prices, reserves, and shipments.",
  "tags": ["fossil-fuels", "mining", "energy", "us"],
  "useCases": ["Track historical coal production by state and mine type", "..."],
  "subRoutes": [
    {
      "id": "aggregate-production",
      "path": "coal/aggregate-production",
      "summary": "Aggregate U.S. coal production",
      "description": "National aggregate coal production totals.",
      "tags": ["production", "national"],
      "typicalFrequency": "annual",
      "dateRange": { "start": "1949", "end": null },
      "exampleQuery": { "frequency": "annual", "start": "1949", "end": "2024", "length": 50 },
      "facetsHint": ["location"]
    }
  ],
  "relatedDomains": ["electricity", "total-energy", "state-electricity-profiles"]
}
```

**404 example:**

```bash
curl -s -w '\nHTTP %{http_code}\n' http://localhost:3000/domains/nope
# {"error":"domain_not_found","message":"No domain registered with id \"nope\". Available: aeo, ieo, ..."}
# HTTP 404
```

---

### `GET /routes/:domain/*`

Proxy to EIA's route tree. The wrapper validates that `{domain}` is a known EIA domain and consults local metadata to resolve the canonical upstream path (so `rto/daily-fuel-type-data` correctly maps to `/v2/electricity/rto/daily-fuel-type-data`).

```bash
curl -s http://localhost:3000/routes/coal | jq '.response.routes'
# ["aggregate-production","consumption-and-quality","exports-imports-quantity-price",...]
```

```ts
const tree = await fetch('/routes/coal').then(r => r.json())
console.log(tree.response.routes)
```

```json
{ "response": { "routes": ["aggregate-production", "consumption-and-quality", "..."] } }
```

For a leaf route, returns the full `FinalRoute` metadata (frequencies, facets, data columns, date range):

```bash
curl -s http://localhost:3000/routes/coal/aggregate-production | jq '.response | {id, name, frequency, facets: (.facets | length), startPeriod, endPeriod, defaultFrequency}'
```

```json
{
  "id": "aggregate-production",
  "name": "Aggregate production",
  "frequency": [{ "id": "annual", "query": "frequency=annual", "format": "YYYY", "...": "..." }],
  "facets": [...],
  "startPeriod": "1949",
  "endPeriod": "2024",
  "defaultFrequency": "annual"
}
```

> `rto` and `state-electricity-profiles` don't have an upstream listing at `/v2/{domain}` — the wrapper synthesises the route list from local metadata in that case (`__synthesized: true` flag included in the response).

---

### `GET /routes/:domain/*/facet`

List facet IDs available for a route.

```bash
curl -s http://localhost:3000/routes/coal/aggregate-production/facet | jq .
```

```ts
const list = await fetch('/routes/coal/aggregate-production/facet').then(r => r.json())
console.log(list.response.facetOptions)  // ["stateRegionId", "coalRankId", "mineTypeId"]
```

```json
{ "response": { "totalFacetOptions": 3, "facetOptions": ["stateRegionId", "coalRankId", "mineTypeId"] } }
```

---

### `GET /routes/:domain/*/facet/:id`

Possible values for a specific facet. (EIA's facet IDs are case-sensitive — `stateId` ≠ `stateID` ≠ `stateid`.)

```bash
curl -s http://localhost:3000/routes/coal/aggregate-production/facet/stateRegionId | jq '.response.facets | length'
```

```ts
const values = await fetch('/routes/coal/aggregate-production/facet/stateRegionId').then(r => r.json())
console.log(values.response.facets.map(f => f.id))  // first state IDs
```

```json
{
  "response": {
    "totalFacets": 51,
    "facets": [
      { "id": "AK", "name": "Alaska" },
      { "id": "AL", "name": "Alabama" }
    ]
  }
}
```

---

### `GET /schema/:domain/*`

Full route metadata — equivalent to `GET /routes/{domain}/{leaf}` but conceptually distinct ("what shape will I get?"). Use the same domain/path format as `/routes/...`.

```bash
curl -s http://localhost:3000/schema/coal/aggregate-production | jq '.response.frequency'
```

```ts
const schema = await fetch('/schema/coal/aggregate-production').then(r => r.json())
console.log(schema.response.defaultFrequency, schema.response.facets.length)
```

---

### `POST /search`

Keyword search across domain metadata.

```bash
curl -s -X POST http://localhost:3000/search \
  -H 'Content-Type: application/json' \
  -d '{"q": "coal production", "limit": 3}' | jq .
```

```ts
const r = await fetch('/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ q: 'coal production', limit: 3 }),
}).then(r => r.json())
for (const hit of r.hits) console.log(hit.path, hit.score, hit.title)
```

```json
{
  "query": "coal production",
  "total": 5,
  "hits": [
    {
      "domain": "coal",
      "subRouteId": "aggregate-production",
      "path": "coal/aggregate-production",
      "title": "Coal → Aggregate U.S. coal production",
      "snippet": "…coal production totals…",
      "score": 14.2
    }
  ]
}
```

**Validation:** empty `q` returns 422.

---

### `POST /query`

The unified data query — fetch any EIA dataset through one endpoint.

#### Basic call

```bash
curl -s -X POST http://localhost:3000/query \
  -H 'Content-Type: application/json' \
  -d '{
    "domain": "coal",
    "route": "aggregate-production",
    "frequency": "annual",
    "data": ["period", "production"],
    "start": "2020",
    "end": "2024",
    "length": 5
  }' | jq .
```

```ts
const r = await fetch('/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    domain: 'coal',
    route: 'aggregate-production',
    frequency: 'annual',
    data: ['period', 'production'],
    start: '2020',
    end: '2024',
    length: 5,
  }),
}).then(r => r.json())
console.log(r.response.total, r.response.data)
```

```json
{
  "response": {
    "data": [{ "period": "2020", "production": 535.34 }, { "...": "..." }],
    "dateFormat": "YYYY",
    "description": "Aggregate production",
    "frequency": "annual",
    "total": 5
  }
}
```

#### With sort

```bash
curl -s -X POST http://localhost:3000/query -H 'Content-Type: application/json' -d '{
  "domain": "electricity",
  "route": "retail-sales",
  "frequency": "annual",
  "start": "2020",
  "end": "2024",
  "sort": [{ "column": "period", "direction": "desc" }],
  "length": 3
}' | jq .
```

#### With pagination

```bash
curl -s -X POST http://localhost:3000/query -H 'Content-Type: application/json' -d '{
  "domain": "international",
  "route": "data",
  "frequency": "annual",
  "start": "2020",
  "end": "2023",
  "length": 3,
  "offset": 3
}' | jq .
```

#### With facet filters (the main pattern)

```bash
curl -s -X POST http://localhost:3000/query -H 'Content-Type: application/json' -d '{
  "domain": "electricity",
  "route": "electric-power-operational-data",
  "frequency": "monthly",
  "start": "2024-01",
  "end": "2024-03",
  "facets": { "fueltypeid": ["NG"], "location": ["CA", "TX"] },
  "length": 5
}' | jq .
```

#### Errors

- 400 if `domain` is not in the registry (returns helpful "Available: …" message)
- 502 if the upstream EIA call fails (response body includes `upstreamStatus`)

---

### `GET /query`

Same as `POST /query` but via query string. Best for simple cases; for facet filters prefer POST.

```bash
# With comma-separated data columns
curl -s 'http://localhost:3000/query?domain=coal&route=aggregate-production&frequency=annual&start=2024&end=2024&data=period,production&length=3' | jq .
```

```ts
const r = await fetch(
  '/query?domain=coal&route=aggregate-production&frequency=annual&start=2024&end=2024&length=3'
).then(r => r.json())
console.log(r.response.data)
```

Notes:

- `data` is a single **comma-separated** string (e.g. `data=period,production`); the wrapper sends it as `data=period,production` to the upstream. Don't URL-encode an array.
- For arrays of facet values, use `POST /query`.

---

## Domains

One query example per domain. (All assume a valid `EIA_API_KEY` is set on the server.) Facet IDs are **case-sensitive** — see the per-domain notes below for the right casing on each route. Run any of these via `bun run examples/domains/<file>.ts`.

### AEO — Annual Energy Outlook

Sub-routes are **publication years** (e.g. `2026`, `2025`, `2023`). Call `GET /routes/aeo` first to discover what's available — `{year}` is a placeholder, not a literal route id.

```bash
# AEO 2026, 2025–2030 annual projection
curl -s -X POST http://localhost:3000/query -H 'Content-Type: application/json' -d '{
  "domain": "aeo", "route": "2026",
  "frequency": "annual", "start": "2025", "end": "2030", "length": 5
}' | jq .
```

### IEO — International Energy Outlook

Same `{year}` placeholder pattern as AEO.

```bash
curl -s -X POST http://localhost:3000/query -H 'Content-Type: application/json' -d '{
  "domain": "ieo", "route": "2023",
  "frequency": "annual", "start": "2025", "end": "2030", "length": 5
}' | jq .
```

### CO2 Emissions

Two sub-routes: `co2-emissions-aggregates` and `co2-emissions-and-carbon-coefficients`. Use **camelCase** `sectorId` (not `sectorid`).

```bash
# State-level aggregates, top producers in 2022 (electric-power sector)
curl -s -X POST http://localhost:3000/query -H 'Content-Type: application/json' -d '{
  "domain": "co2-emissions", "route": "co2-emissions-aggregates",
  "frequency": "annual", "start": "2022", "end": "2022",
  "facets": { "sectorId": ["EC"] },
  "sort": [{ "column": "value", "direction": "desc" }],
  "length": 10
}' | jq .
```

### Coal

13 sub-routes. All are **annual-only** (upstream rejects `monthly`). Examples:

```bash
# Aggregate production 2015-2024
curl -s -X POST http://localhost:3000/query -H 'Content-Type: application/json' -d '{
  "domain": "coal", "route": "aggregate-production",
  "frequency": "annual", "start": "2015", "end": "2024", "length": 20
}' | jq .

# Mine → plant shipments (detail)
curl -s -X POST http://localhost:3000/query -H 'Content-Type: application/json' -d '{
  "domain": "coal", "route": "shipments/by-mine-by-plant",
  "frequency": "annual", "start": "2022", "end": "2023", "length": 5
}' | jq .
```

Other sub-routes: `consumption-and-quality`, `exports-imports-quantity-price`, `market-sales-price`, `mine-production`, `price-by-rank`, `reserves-capacity`, `shipments/{mine-aggregates, mine-state-aggregates, plant-aggregates, plant-state-aggregates, receipts}`. Facet IDs are **camelCase** (e.g. `stateRegionId`, `coalRankId`, `mineTypeId`).

### Crude Oil Imports

Flat domain — only one "route" `data`, which is the whole dataset. Facets live at `/routes/crude-oil-imports/facet/{id}` (not under `/data`).

```bash
curl -s -X POST http://localhost:3000/query -H 'Content-Type: application/json' -d '{
  "domain": "crude-oil-imports", "route": "data",
  "frequency": "monthly", "start": "2023-01", "end": "2023-12", "length": 5
}' | jq .
```

### Densified Biomass

8 sub-routes. Note: `wood-pellet-plants` is **annual-only** (upstream rejects `monthly`).

```bash
# Monthly production by region
curl -s -X POST http://localhost:3000/query -H 'Content-Type: application/json' -d '{
  "domain": "densified-biomass", "route": "production-by-region",
  "frequency": "monthly", "start": "2023-01", "end": "2023-12", "length": 5
}' | jq .

# Annual wood-pellet-plant capacity (not monthly!)
curl -s -X POST http://localhost:3000/query -H 'Content-Type: application/json' -d '{
  "domain": "densified-biomass", "route": "wood-pellet-plants",
  "frequency": "annual", "start": "2023", "end": "2023", "length": 3
}' | jq .
```

Other sub-routes: `capacity-by-region`, `characteristics-by-region`, `export-sales-and-price`, `feedstocks-and-cost`, `inventories-by-region`, `sales-and-price-by-region`.

### Electricity

4 sub-routes. The state column is called **`location`**, not `stateid`. Facet IDs are lowercase: `sectorid`, `fueltypeid`, `location`.

```bash
# Retail sales by state, top 5 by revenue (2022)
curl -s -X POST http://localhost:3000/query -H 'Content-Type: application/json' -d '{
  "domain": "electricity", "route": "retail-sales",
  "frequency": "annual", "start": "2022", "end": "2022",
  "sort": [{ "column": "revenue", "direction": "desc" }],
  "length": 5
}' | jq .

# Electric power operational data — NG only (CA, 2024)
curl -s -X POST http://localhost:3000/query -H 'Content-Type: application/json' -d '{
  "domain": "electricity", "route": "electric-power-operational-data",
  "frequency": "monthly", "start": "2024-01", "end": "2024-03",
  "facets": { "fueltypeid": ["NG"], "location": ["CA"] },
  "length": 5
}' | jq .
```

Other sub-routes: `facility-fuel`, `operating-generator-capacity`.

### International

Flat domain — only one "route" `data`. Use the `countryRegionId` facet (camelCase).

```bash
curl -s -X POST http://localhost:3000/query -H 'Content-Type: application/json' -d '{
  "domain": "international", "route": "data",
  "frequency": "annual", "start": "2020", "end": "2022",
  "facets": { "countryRegionId": ["CHN"] },
  "length": 3
}' | jq .
```

### Natural Gas

2-level routes with the upstream using short codes (e.g. `cons/sum`, `pri/sum`). The wrapper resolves them to the canonical upstream path automatically. Facet IDs are typically `duoarea` and `process` for the data rows.

```bash
# Consumption by end-use (annual, 2020)
curl -s -X POST http://localhost:3000/query -H 'Content-Type: application/json' -d '{
  "domain": "natural-gas", "route": "cons/sum",
  "frequency": "annual", "start": "2020", "end": "2020", "length": 5
}' | jq .

# Weekly working-gas storage (latest week)
curl -s -X POST http://localhost:3000/query -H 'Content-Type: application/json' -d '{
  "domain": "natural-gas", "route": "stor/wkly",
  "frequency": "weekly", "start": "2024-01-01", "end": "2024-01-07", "length": 2
}' | jq .
```

Other sub-routes: `pri/sum` (prices), `enr/sum` (reserves), `prod/oilwells` (well counts), `move/impc` (imports), `sum/snd` (supply & disposition).

### Nuclear Outages

3 sub-routes. Daily frequency.

```bash
curl -s -X POST http://localhost:3000/query -H 'Content-Type: application/json' -d '{
  "domain": "nuclear-outages", "route": "facility-nuclear-outages",
  "frequency": "daily", "start": "2024-01", "end": "2024-12", "length": 5
}' | jq .
```

Other sub-routes: `generator-nuclear-outages`, `us-nuclear-outages`.

### RTO

Lives under the upstream `electricity/rto/...` namespace. The wrapper resolves `rto/daily-fuel-type-data` to the canonical path automatically. 8 sub-routes — daily and hourly variants of `interchange-data`, `fuel-type-data`, `region-data`, `region-sub-ba-data`.

```bash
# PJM daily fuel-type data
curl -s -X POST http://localhost:3000/query -H 'Content-Type: application/json' -d '{
  "domain": "rto", "route": "daily-fuel-type-data",
  "frequency": "daily", "start": "2024-01-01", "end": "2024-01-07", "length": 5
}' | jq .
```

### SEDS

Flat domain — only one "route" `data`. Facets are `seriesId` and `stateId` (camelCase). **There is no `sectorId` facet here** — for residential/industrial breakdowns, use the `seriesId` value.

```bash
# Texas total energy consumption 2020-2023
curl -s -X POST http://localhost:3000/query -H 'Content-Type: application/json' -d '{
  "domain": "seds", "route": "data",
  "frequency": "annual", "start": "2020", "end": "2023",
  "facets": { "stateId": ["TX"] }, "length": 5
}' | jq .
```

### State Electricity Profiles

Lives under the upstream `electricity/state-electricity-profiles/...` namespace. The wrapper resolves the namespace automatically. 7 sub-routes. **The `summary` route's only facet is `stateID` (capital ID) — not `stateId`.**

```bash
# Texas emissions by fuel (2022) — uses lowercase stateid
curl -s -X POST http://localhost:3000/query -H 'Content-Type: application/json' -d '{
  "domain": "state-electricity-profiles", "route": "emissions-by-state-by-fuel",
  "frequency": "annual", "start": "2022", "end": "2022",
  "facets": { "stateid": ["TX"], "fuelid": ["NG"] },
  "length": 5
}' | jq .

# Summary (CA + TX, 2022) — stateID, not stateId
curl -s -X POST http://localhost:3000/query -H 'Content-Type: application/json' -d '{
  "domain": "state-electricity-profiles", "route": "summary",
  "frequency": "annual", "start": "2022", "end": "2022",
  "facets": { "stateID": ["CA", "TX"] },
  "length": 5
}' | jq .
```

Other sub-routes: `capability`, `energy-efficiency`, `meters`, `net-metering`, `source-disposition`.

### STEO — Short Term Energy Outlook

Flat domain — only one "route" `data`.

```bash
curl -s -X POST http://localhost:3000/query -H 'Content-Type: application/json' -d '{
  "domain": "steo", "route": "data",
  "frequency": "monthly", "start": "2024-01", "end": "2025-06", "length": 5
}' | jq .
```

### Total Energy

Flat domain — only one "route" `data`. **The only facet is `msn`** (a series code). Facets live at `/routes/total-energy/facet/{id}` (not under `/data`).

```bash
curl -s -X POST http://localhost:3000/query -H 'Content-Type: application/json' -d '{
  "domain": "total-energy", "route": "data",
  "frequency": "monthly", "start": "2024-01", "end": "2024-12", "length": 5
}' | jq .
```

---

## Agents

Four realistic agentic flows, plus a fifth that wires the wrapper into a [Mastra](https://mastra.ai) agent with OpenRouter. See [`examples/agents/`](./examples/agents/) for runnable versions.

### Discover and query

The canonical agent loop. Picks a real `aeo`/`ieo` year from the upstream route listing instead of using `{year}`:

```ts
// 1. Search
const search = await fetch('/search', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ q: 'electricity emissions by state' }),
}).then(r => r.json())

// 2. Inspect the top hit
const domain = await fetch(`/domains/${search.hits[0].domain}`).then(r => r.json())

// 3. List facets (singular /facet!)
const facets = await fetch(`/routes/${domain.subRoutes[0].path}/facet`).then(r => r.json())

// 4. Pick a value
const values = await fetch(`/routes/${domain.subRoutes[0].path}/facet/${facets.response.facetOptions[0]}`).then(r => r.json())

// 5. Query with the chosen facet filter
const data = await fetch('/query', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    domain: search.hits[0].domain,
    route: domain.subRoutes[0].id,
    frequency: domain.subRoutes[0].typicalFrequency,
    start: domain.subRoutes[0].exampleQuery.start,
    end: domain.subRoutes[0].exampleQuery.end,
    facets: { [facets.response.facetOptions[0]]: values.response.facets.slice(0, 2).map(f => f.id) },
    length: 5,
  }),
}).then(r => r.json())
```

### Trend analysis

Multi-step: fetch → aggregate → YoY. Uses `total-energy/data` filtered to a single national series (`ELETPUS`, US total electricity primary consumption), giving exactly one monthly `value` per period:

```ts
// Fetch monthly US total electricity primary consumption 2020-2024
const monthly = await fetch('/query', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    domain: 'total-energy', route: 'data',
    data: ['value'],
    frequency: 'monthly', start: '2020-01', end: '2024-12',
    facets: { msn: ['ELETPUS'] }, length: 100,
  }),
}).then(r => r.json())

// Aggregate monthly → annual (sum of 12 monthly observations per year)
const totals = new Map<string, number>()
for (const row of monthly.response.data) {
  const year = row.period.slice(0, 4)
  const v = Number(row.value)
  totals.set(year, (totals.get(year) ?? 0) + v)
}
```

### Multi-domain comparison

Cross-domain join: state CO2 vs electricity net generation → emissions intensity. Note the **camelCase** `sectorId` (not `sectorid`):

```ts
const co2 = await fetch('/query', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    domain: 'co2-emissions', route: 'co2-emissions-aggregates',
    frequency: 'annual', start: '2022', end: '2022',
    facets: { sectorId: ['EC'] }, length: 5000,
  }),
}).then(r => r.json())
const gen = await fetch('/query', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    domain: 'state-electricity-profiles', route: 'summary',
    frequency: 'annual', start: '2022', end: '2022', length: 5000,
  }),
}).then(r => r.json())
// join by stateid in-process, compute co2/gen, sort
```

### Error recovery

`examples/agents/04-error-recovery.ts` shows the four main error classes an agent should handle:

| Status | When | What to do |
|---|---|---|
| `422` | Body validation (e.g. `q: ""` for `/search`) | Fix the request body; re-validate client-side if possible |
| `400` (`error: "validation_error"`) | Unknown domain in `/query` | Call `/search` to suggest an alternative |
| `502` (`error: "upstream_error"`) | Upstream EIA failed | Retry with backoff, or fall back to cached data |
| `401` (from upstream) | Bad `EIA_API_KEY` | Surface as an actionable error to the user |

A minimal pattern using the shared `fetchJson` helper:

```ts
import { EiaClientError, fetchJson } from './examples/shared'

try {
  await fetchJson('/query', { /* ... */ })
} catch (err) {
  if (err instanceof EiaClientError) {
    if (err.status === 422) { /* fix body */ }
    if (err.status === 400 && err.errorCode === 'validation_error') {
      // unknown domain — fall back to /search
    }
    if (err.status === 502) { /* upstream down — retry */ }
    if (err.upstreamStatus === 401) { /* bad EIA_API_KEY */ }
  }
}
```

### Mastra agent — Wyoming natural gas

`examples/agents/05-mastra-wyoming-natural-gas.ts` shows how to wire the wrapper into a [Mastra](https://mastra.ai) agent using [OpenRouter](https://openrouter.ai/) as the model router. The agent is given six tools that wrap the wrapper's endpoints, and is asked to reason end-to-end about natural gas in Wyoming.

Tools provided:

| Tool | Wraps | Purpose |
|---|---|---|
| `search_datasets` | `POST /search` | Find datasets by free-text |
| `list_domains` | `GET /domains` | Discover the natural-gas domain |
| `get_domain` | `GET /domains/:id` | List sub-routes for a domain |
| `list_facets` | `GET /routes/.../facet` | Confirm `duoarea` is a usable facet |
| `get_facet_values` | `GET /routes/.../facet/:id` | **Discover Wyoming's duoarea code (e.g. `SWY`)** |
| `query_eia` | `POST /query` | Raw query (for debugging the data shape) |
| `query_with_summary` | `POST /query` + summarise | Primary data tool: injects `data:["value"]`, groups by series, returns min/max/avg/latest/yoyChangePct per series |

The agent must use the fifth tool (`get_facet_values`) to discover the duoarea code for Wyoming before it can filter the natural-gas routes — illustrating the wrapper's "self-describing API" design: the agent learns the schema on demand, it isn't hard-coded.

Install (opt-in; not in `package.json`):

```bash
bun add @mastra/core @ai-sdk/openai-compatible zod
# Put your key in .env (the example auto-loads it):
echo 'OPENROUTER_API_KEY=sk-or-...' >> .env
bun run examples/agents/05-mastra-wyoming-natural-gas.ts
```

The full agent definition:

```ts
import { Agent } from '@mastra/core/agent'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { z } from 'zod'

const openrouter = createOpenAICompatible({
  name: 'openrouter',
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
})

const agent = new Agent({
  name: 'Wyoming-Natural-Gas-Analyst',
  instructions: `
    You are an energy analyst. Produce a brief insight report on natural gas
    in Wyoming. Use the natural-gas domain and the cons/sum, pri/sum, and
    prod/oilwells sub-routes. To filter by state, call get_facet_values on
    one route to discover the duoarea code whose name contains "Wyoming"
    (it is "SWY" in the upstream natural-gas v2 taxonomy, but verify).
    Then run query_with_summary against each route with annual frequency
    over the last 5 years — it injects `data:["value"]` automatically and
    returns per-series min/max/avg/latest/yoyChangePct so you can write a
    concrete, numerical report without re-parsing raw rows.
  `,
  model: openrouter('anthropic/claude-3.5-sonnet'),
  tools: { /* search_datasets, list_domains, ... */ },
})

const result = await agent.generate(
  'Give me a brief insight report on natural gas in Wyoming over the last 5 years.'
)
console.log(result.text)
```

---

## Next

- Browse the runnable index: [`examples/README.md`](./examples/README.md) — 8 numbered examples, 15 per-domain, 5 agent flows, 2 cURL scripts.
- Project overview: [`README.md`](./README.md) — quick start, architecture, endpoint table.
- Open the API in a browser: <http://localhost:3000/openapi> (Swagger UI), or grab the raw spec at `/openapi/json`.
