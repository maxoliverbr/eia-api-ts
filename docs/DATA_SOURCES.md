# Data Sources

> **Status: design proposal — not yet implemented.**
>
> This document proposes extending `eia-api-ts` from a single-source wrapper (EIA only) to a multi-source architecture that can host additional upstream APIs (NOAA, FRED, BLS, internal warehouses, …) without touching the routing layer. Nothing in this document is implemented in `main` yet; the current single-source codebase is the source of truth until this design is reviewed and adopted.

## 1. Status

This is a **design proposal, not yet implemented**. The current `eia-api-ts` codebase is built around a single upstream API — the EIA APIv2. That assumption is hardcoded in four places: the env loader (`EIA_API_KEY` / `EIA_BASE_URL` are the only credential env vars), the HTTP client (`EiaClient` is a singleton with `?api_key=` query injection baked in), the URL builder (`buildUpstreamPath` and `resolveUpstreamPath` assume the `/v2/{domain}/{route}/data` layout), and the domain schema (`DomainMeta` has no `source` discriminator, so there's nowhere to *say* that a domain belongs to a particular upstream). The goal of this design is to factor those four concerns into a single `DataSource` interface, behind a `SourceRegistry`, so that adding a new source is a 4–5 file change in one well-defined directory — not a rewrite.

## 2. Where EIA is currently hardcoded

Four files currently assume the world is EIA:

| # | File | Lines | What's hardcoded |
|---|---|---|---|
| 1 | `src/config/env.ts` | 31–32 | `EIA_API_KEY`, `EIA_BASE_URL` are the only auth/URL env vars; `requireEnv('EIA_API_KEY', …)` throws at boot if missing. |
| 2 | `src/lib/eia-client.ts` | 1–310 | Singleton `EiaClient` with `?api_key=` query-string injection (`url.searchParams.set('api_key', this.apiKey)` at line 52), a hardcoded `EiaApiError`, and a shared `export const eia = new EiaClient()` at line 310 that every route imports. |
| 3 | `src/schemas/domain.ts` | 87–146 | `DomainMetaSchema` defines `id`, `name`, `description`, `tags`, `subRoutes`, etc. — but no `source` discriminator field. Every domain is implicitly EIA. |
| 4 | `src/routes/query.ts` + `src/domains/index.ts` | 43–56, 60–76 | `buildUpstreamPath()` (in `query.ts`) and `resolveUpstreamPath()` (in `domains/index.ts`) both assume EIA's `/v2/{domain}/{route}/data` layout. There is no place in the URL pipeline where a different base URL or different path template could be substituted. |

In practice, "hardcoded EIA" means that any new source would require **duplicating the client class, the URL builder, the env loader, the error normalizer, and the route handlers** — not just adding a new domain file. The current architecture is single-source by construction, and "wrap NOAA" today would mean a fork.

## 3. The Core Abstraction — `DataSource`

A `DataSource` is a typed bundle that owns everything source-specific — credentials, the HTTP client, the URL layout, response/error normalization. The rest of the application talks to a `SourceRegistry` of these bundles instead of a single EIA singleton. Adding a new source means writing one new bundle and registering it; the routing layer never has to learn the new source's quirks.

```ts
// src/sources/types.ts
import type { Brand } from '../schemas/primitives'

export type DataSourceId = Brand<string, 'DataSourceId'>

export type SourceAuth =
  | { kind: 'query'; paramName: string }      // EIA: ?api_key=xxx
  | { kind: 'header'; headerName: string }    // NOAA: token: xxx

export interface DataSource {
  readonly id: DataSourceId
  readonly displayName: string
  readonly description: string
  readonly docsUrl?: string
  readonly baseUrl: string
  readonly apiKeyEnv: string                  // env var holding the credential
  readonly auth: SourceAuth
  readonly client: SourceClient               // see Section 4
  readonly buildDataUrl: (domain: DomainMeta, subRouteId: string) => string
  readonly buildRouteUrl: (domain: DomainMeta, tail: string) => string
  readonly normalizeResponse?: (body: unknown) => unknown
  readonly normalizeError?: (status: number, body: unknown) => SourceError
}
```

### Design rationale

- **Auth is a discriminated union** (`query` vs `header`) so that query-string auth (EIA) and header auth (NOAA) are both first-class. There is no `if (source === 'eia')` branch in the client — the type system knows.
- **`buildDataUrl` and `buildRouteUrl` are functions per source.** Each upstream API's URL layout is declared in one place, alongside the source that owns it. EIA's `/v2/{domain}/{route}/data` is one function body; NOAA's `/data?datasetid=…` is another.
- **The response and error normalizers are optional.** Most sources are pass-through and only need the `client`. Sources that wrap a non-JSON protocol, or that return error shapes that need reshaping into our `SourceError` envelope, declare a normalizer.
- **`apiKeyEnv` is a string, not a value.** The bundle references the env var by name; the registry resolves it at boot. This keeps the bundle declarative and trivially serializable (good for tests, good for OpenAPI doc generation).

## 4. Generalize the Client

The current `EiaClient` becomes the **base behavior** — a generic `SourceClient` driven by per-source config. The URL builder logic is unchanged; only the auth injection point is parameterized.

The diff at the auth-injection site:

```ts
// before (EIA-only):
url.searchParams.set('api_key', this.apiKey)

// after (source-agnostic):
if (this.cfg.auth.kind === 'query') {
  url.searchParams.set(this.cfg.auth.paramName, this.cfg.apiKey)
} else if (this.cfg.auth.kind === 'header') {
  headers[this.cfg.auth.headerName] = this.cfg.apiKey
}
```

The rest of `SourceClient` (cache key derivation, retry policy, error normalization, `get` / `post` shape) is identical to today's `EiaClient`. What changes is *who* constructs the config: instead of `new EiaClient({ apiKey: env.EIA_API_KEY, baseUrl: env.EIA_BASE_URL })`, each `DataSource` constructs `new SourceClient({ apiKey, baseUrl, auth, … })`.

The new EIA bundle wires the existing EIA config into the new shape:

```ts
// src/sources/eia.ts
import type { DataSource } from './types'
import { env } from '../config/env'
import { SourceClient } from '../lib/source-client'
import { resolveUpstreamPath } from '../domains'

export const eiaSource: DataSource = {
  id: 'eia' as DataSourceId,
  displayName: 'U.S. Energy Information Administration',
  description: 'EIA APIv2 — 15 energy data domains.',
  docsUrl: 'https://www.eia.gov/opendata/',
  baseUrl: env.EIA_BASE_URL,
  apiKeyEnv: 'EIA_API_KEY',
  auth: { kind: 'query', paramName: 'api_key' },
  client: new SourceClient({
    baseUrl: env.EIA_BASE_URL,
    apiKey: env.EIA_API_KEY,
    auth: { kind: 'query', paramName: 'api_key' },
    cacheEnabled: env.CACHE_ENABLED,
    maxRetries: 2,
    retryDelayMs: 200,
  }),
  buildDataUrl: (domain, subRouteId) => {
    const canonical = resolveUpstreamPath(domain.id, subRouteId)
    const suffix =
      subRouteId === 'data' || subRouteId.endsWith('/data') || canonical.endsWith('/data')
        ? ''
        : '/data'
    return `/v2/${canonical}${suffix}`
  },
  buildRouteUrl: (domain, tail) => `/v2/${domain.id}/${tail}`,
}
```

> **All EIA-specific URL knowledge moves out of route handlers and into the source config** — the route handlers stop calling `resolveUpstreamPath()` directly; they ask the source to build its URL.

The fallback for domains with non-default upstream namespaces (e.g. rto's sub-routes under `electricity/rto/…`) is still resolved through `resolveUpstreamPath()` at the call site, because the *metadata* — the canonical `path` field on each sub-route — is the source of truth for that domain's layout, not a property of the upstream source.

## 5. The SourceRegistry

The registry is the barrel the rest of the app imports. It mirrors the existing `src/domains/index.ts` pattern: a `SOURCES_BY_ID` map, a `getSource` lookup, and a `requireSource` variant for internal use.

```ts
// src/sources/registry.ts
import type { DataSource, DataSourceId } from './types'
import { eiaSource } from './eia'
// import { noaaSource } from './noaa'   // future

const SOURCES: readonly DataSource[] = [eiaSource /*, noaaSource */] as const

const SOURCES_BY_ID: Readonly<Record<string, DataSource>> = SOURCES.reduce(
  (acc, s) => { acc[s.id] = s; return acc },
  {} as Record<string, DataSource>,
)

export const getSource = (id: string): DataSource | undefined => SOURCES_BY_ID[id]
export const listSources = (): readonly DataSource[] => SOURCES

export const requireSource = (id: string): DataSource => {
  const s = getSource(id)
  if (!s) throw new Error(`Unknown data source: ${id}. Registered: ${SOURCES.map(x => x.id).join(', ')}`)
  return s
}
```

This mirrors `src/domains/index.ts` (`DOMAINS_BY_ID`, `getDomain`). The pattern is identical — one barrel, one lookup function, one required variant for internal use. Anything that today does `import { getDomain } from '../domains'` will do `import { getSource } from '../sources/registry'`.

## 6. Schema Changes

### 6.1 New `source` field on `DomainMeta`

The `DomainMetaSchema` in `src/schemas/domain.ts:87-146` gains a required `source` field:

```ts
// src/schemas/domain.ts (DomainMetaSchema, lines 87-146)
export const DomainMetaSchema = t.Object({
  id: DomainIdSchema,
  source: DataSourceIdSchema,           // ← NEW: required
  name: t.String(),
  // … rest unchanged
})
```

Every existing `DomainMeta` value (the 15 `src/domains/*.ts` files) needs a `source: 'eia'` line. The migration is mechanical — see Section 10 for the additive variant that avoids a hard break.

### 6.2 New `src/schemas/source.ts`

A small new schema file for the source id validator and the summary response shape used by the new `/sources` route:

```ts
// src/schemas/source.ts
import { t } from 'elysia'

export const DataSourceIdSchema = t.String({
  minLength: 1,
  pattern: '^[a-z][a-z0-9-]*$',
  description: 'Registered data source id, e.g. "eia", "noaa", "fred".',
})
```

(`DataSourceSummarySchema` and `DataSourceSchema`, the response shapes used by `/sources` and `/sources/:id`, are added in the same file — see Section 7.2.)

### 6.3 Domain ID naming convention

Once two sources share a `domains/` directory, domain ids may collide. The proposed convention is to **prefix** every id with its source id, separated by a dash:

| Source | Today | Suggested new id |
|---|---|---|
| EIA | `coal` | `eia-coal` |
| EIA | `natural-gas` | `eia-natural-gas` |
| NOAA | (new) | `noaa-storms` |
| NOAA | (new) | `noaa-tides` |
| FRED | (new) | `fred-gdp` |

#### Two strategies

- **Additive (no breaking change)** — keep existing ids as-is; only *also* require `source` on `DomainMeta`. New NOAA domains just pick non-conflicting ids (`noaa-storms`, `noaa-tides`). Zero migration; slightly inconsistent (EIA ids lack a prefix, future ones have one).
- **Strict (clean break)** — rename everything to `eia-coal`, `eia-natural-gas`, etc. Cleaner long-term; breaks every example, every test, every external client, and every agent prompt that has been written against the current ids.

**Recommended: additive for the first cut, with a follow-up rename in the next major version.** The first cut ships the registry + the `source` field; the rename lands in a `2.0.0` that also takes the chance to add a per-source cookbook section to `/guide`.

## 7. Route Changes

### 7.1 `/query` dispatches by source

The shape of `src/routes/query.ts:72-117` changes from a direct `eia.post()` call to a 4-step dispatch: look up the domain, look up the source for that domain, ask the source to build the URL, hit `source.client.post()`.

```ts
// src/routes/query.ts (POST /query, lines 72-117)
.post('/query', async ({ body, set, request }) => {
  const domain = getDomain(body.domain)
  if (!domain) {
    set.status = 400
    return { error: 'validation_error', message: `Unknown domain "${body.domain}". Call GET /domains.`, domain: body.domain }
  }
  const source = getSource(domain.source)
  if (!source) {
    set.status = 500
    return { error: 'internal_error', message: `Domain "${body.domain}" references unknown source "${domain.source}".` }
  }
  const upstreamPath = source.buildDataUrl(domain, body.route)
  const params = stripRouting(body)
  try {
    const data = await source.client.post<DataResponseContainer>(upstreamPath, params)
    return source.normalizeResponse ? source.normalizeResponse(data) : data
  } catch (err) {
    return handleSourceError(err, set, request, upstreamPath, source)
  }
}, { /* schema unchanged */ })
```

The flow is:

1. **Look up the domain** (existing): `getDomain(body.domain)`.
2. **Look up the source for that domain** (NEW): `getSource(domain.source)`. If a domain declares a source that isn't registered, this returns a `500 internal_error` (the metadata is corrupt, not the request).
3. **Build the upstream URL via `source.buildDataUrl()`** (NEW). The source owns its URL layout.
4. **Hit `source.client.post()`** (CHANGED). The auth (`?api_key=` for EIA, `token:` for NOAA) is now applied inside the client based on the source's `auth` config.

The same pattern applies to `src/routes/facets.ts` — replace `eia.get(...)` with `source.client.get(...)` and `buildProxyPath()` with `source.buildRouteUrl()`.

### 7.2 New `GET /sources` and `GET /sources/:id`

A new route module exposes the registered sources:

```ts
// src/routes/sources.ts
import { Elysia, t } from 'elysia'
import { listSources, getSource } from '../sources/registry'
import { DataSourceSummarySchema, DataSourceSchema } from '../schemas/source'

export const sourceRoutes = new Elysia({ tags: ['Sources'] })
  .get('/sources', () => ({ sources: listSources().map(toSummary) }), {
    detail: { summary: 'List all registered data sources', tags: ['Sources'] },
    response: t.Object({ sources: t.Array(DataSourceSummarySchema) }),
  })
  .get('/sources/:id', ({ params, status }) => {
    const s = getSource(params.id)
    if (!s) return status(404, { error: 'source_not_found', message: 'No such source.' })
    return toFull(s)
  }, { /* … */ })
```

The summary response shape — small enough to embed in a system prompt, includes just enough to decide whether to call `/sources/:id` for details:

```json
{
  "id": "eia",
  "displayName": "U.S. Energy Information Administration",
  "description": "EIA APIv2 — 15 energy data domains.",
  "docsUrl": "https://www.eia.gov/opendata/",
  "domainCount": 15,
  "requiresApiKey": true
}
```

### 7.3 Filter `GET /domains` by source

`src/routes/discovery.ts:24-52` (the `GET /domains` handler) gains an optional `?source=` filter:

```ts
// src/routes/discovery.ts (GET /domains, lines 24-52)
.get('/domains', ({ query }) => {
  const sourceFilter = query.source ? getSource(query.source) : undefined
  const all = listDomains()
  const filtered = sourceFilter ? all.filter(d => d.source === sourceFilter.id) : all
  return { domains: filtered, totalSources: listSources().length }
}, {
  query: t.Object({ source: t.Optional(t.String()) }),
  response: t.Object({ domains: t.Array(DomainMetaSchema), totalSources: t.Integer() }),
})
```

The same `?source=` filter can be added to `/search` and `/guide` for symmetry.

## 8. Update `/guide`

The `buildFullGuide()` shape in `src/routes/guide.ts:122-165` (and the corresponding `buildFullGuide` function body at lines 220-253) gains a top-level `sources[]` section:

```ts
// src/routes/guide.ts — buildFullGuide() return shape
{
  version, generatedAt, summary, philosophy,
  workflow: { … },
  decisionTree: [ … ],
  antiPatterns: [ … ],
  commonRecipes: [ … ],
  sources: [                              // ← NEW
    { id: 'eia', displayName: '…', domainCount: 15, description: '…' },
    { id: 'noaa', displayName: '…', domainCount: 8, description: '…' },
  ],
  domains: [ … ],
  endpoints: { … },
}
```

An optional companion endpoint gives a per-source slice of the guide — handy when an agent already knows which source it wants:

```ts
// src/routes/guide.ts — new endpoint
.get('/guide/source/:id', ({ params, status }) => {
  const src = getSource(params.id)
  if (!src) return status(404, …)
  const domains = DOMAINS.filter(d => d.source === src.id)
  return { source: src, domains: domains.map(d => ({ id: d.id, name: d.name, hasPlaybook: !!d.playbook })) }
})
```

## 9. End-to-End Example: Adding NOAA Storms

This is the worked example. **Five small files** add a new upstream source — a different base URL, a different auth scheme (header instead of query string), and a different URL layout (`/data?datasetid=…&datatypeid=…` instead of `/v2/{domain}/{route}/data`). None of those quirks touch the routing layer.

### Step 1 — Source config: `src/sources/noaa.ts`

```ts
// src/sources/noaa.ts
import type { DataSource } from './types'
import { env } from '../config/env'
import { SourceClient } from '../lib/source-client'

export const noaaSource: DataSource = {
  id: 'noaa' as DataSourceId,
  displayName: 'National Oceanic and Atmospheric Administration',
  description: 'NOAA Climate Data Online (CDO) and storm events.',
  docsUrl: 'https://www.ncdc.noaa.gov/cdo-web/webservices/v2',
  baseUrl: 'https://www.ncdc.noaa.gov/cdo-web/api/v2',
  apiKeyEnv: 'NOAA_API_KEY',
  auth: { kind: 'header', headerName: 'token' },
  client: new SourceClient({
    baseUrl: 'https://www.ncdc.noaa.gov/cdo-web/api/v2',
    apiKey: env.NOAA_API_KEY,
    auth: { kind: 'header', headerName: 'token' },
    cacheEnabled: env.CACHE_ENABLED,
    maxRetries: 2,
    retryDelayMs: 200,
  }),
  buildDataUrl: (domain, subRouteId) => `/data?datasetid=${domain.id}&datatypeid=${subRouteId}`,
  buildRouteUrl: (domain, tail) => tail ? `/${tail}` : `/datasets`,
}
```

> Note the differences from EIA: header-based auth (`token:`), a totally different URL layout (`/data?datasetid=…&datatypeid=…`), and a different base URL. None of that requires changes outside this file and the registry.

### Step 2 — Env var: `src/config/env.ts`

```ts
// src/config/env.ts (env object, lines 30-36)
export const env = {
  EIA_API_KEY:  requireEnv('EIA_API_KEY', 'DEMO_KEY'),
  EIA_BASE_URL: process.env.EIA_BASE_URL ?? 'https://api.eia.gov',
  NOAA_API_KEY: process.env.NOAA_API_KEY,  // optional; checked at registry boot
  // …
} as const
```

Make NOAA optional; throw only if a registered source's key is missing at boot — checked in the registry initializer, not in `env.ts`. This way, a deployment that only needs EIA doesn't need to set `NOAA_API_KEY`.

### Step 3 — Register: `src/sources/registry.ts`

```ts
// src/sources/registry.ts
import { eiaSource } from './eia'
import { noaaSource } from './noaa'

const SOURCES: readonly DataSource[] = [eiaSource, noaaSource] as const
```

### Step 4 — Add a domain: `src/domains/noaa-storms.ts`

```ts
// src/domains/noaa-storms.ts
export const noaaStormsMeta: DomainMeta = {
  id: 'noaa-storms',
  source: 'noaa',
  name: 'NOAA Storm Events',
  description: '…',
  tags: ['weather', 'storms'],
  useCases: ['Track tornado counts by state and year', '…'],
  subRoutes: [
    {
      id: 'TORNADO',
      path: 'noaa-storms/TORNADO',
      summary: 'Tornado events',
      description: '…',
      tags: ['tornado'],
      typicalFrequency: 'annual',
      dateRange: { start: '1950', end: null },
      exampleQuery: { frequency: 'annual', start: '2020', end: '2024', length: 50 },
      facetsHint: ['state'],
    },
  ],
  relatedDomains: ['noaa-tides'],
}
```

And add it to `src/domains/index.ts` the same way `coalMeta` is registered today (import at the top, append to `DOMAINS`).

### Step 5 — Done.

Three end-to-end calls that exercise the new source:

```bash
curl http://localhost:3000/sources
# → { sources: [{ id: "eia", … }, { id: "noaa", … }] }

curl 'http://localhost:3000/domains?source=noaa'
# → { domains: [{ id: "noaa-storms", source: "noaa", … }] }

curl -X POST http://localhost:3000/query \
  -H 'Content-Type: application/json' \
  -d '{ "domain": "noaa-storms", "route": "TORNADO", "frequency": "annual", "start": "2020", "end": "2024" }'
# → routed to NOAA via the header-injected token, not EIA
```

> **Same `/guide` playbook, same `/search` index, same OpenAPI shape. The agents don't change.**

## 10. Migration / Backward Compatibility

| Change | Risk | Mitigation |
|---|---|---|
| Adding `source: DataSourceId` to `DomainMetaSchema` (required) | High — breaks every existing domain file | Make `source` optional during migration (default `'eia'`); tighten in a major version bump |
| Renaming the singleton `eia` to a registry | Medium — every route file imports `eia` | Re-export `eia` from the registry: `export const eia = eiaSource.client` so old imports keep working |
| Renaming `EiaApiError` to `SourceError` | Low — internal | Keep `EiaApiError = SourceError` as a type alias during deprecation window |
| Routing changes in `/query`, `/routes/*` | Medium — could break proxies | Keep existing handlers as fallback; introduce a parallel router; cut over once tests pass |
| Domain id namespacing (`coal` → `eia-coal`) | High — breaks every client | Skip for v1; only required if NOAA domains would otherwise collide |

## 11. Updated Architecture Diagram

```
src/
├── schemas/                ← + source.ts (DataSourceId, summaries)
├── lib/
│   ├── source-client.ts    ← NEW (was eia-client.ts, now generic)
│   ├── errors.ts           ← rename EiaApiError → SourceError, keep alias
│   ├── cache.ts            ← unchanged (works on URL+params, source-agnostic)
│   ├── search.ts           ← unchanged
├── sources/                ← NEW directory
│   ├── types.ts            ← DataSource interface
│   ├── registry.ts         ← SOURCES_BY_ID, getSource, listSources
│   ├── eia.ts              ← the EIA DataSource
│   └── noaa.ts             ← (future) the NOAA DataSource
├── domains/                ← + source field on every DomainMeta
├── routes/
│   ├── sources.ts          ← NEW: GET /sources, GET /sources/:id
│   ├── query.ts            ← updated to dispatch via source.client
│   ├── facets.ts           ← updated to dispatch via source.client + source.buildRouteUrl
│   ├── discovery.ts        ← updated to filter by source
│   └── guide.ts            ← updated to include sources[] section
├── config/env.ts           ← + per-source keys (EIA_API_KEY, NOAA_API_KEY, …)
└── …
```

The `DataSource` interface is what makes adding NOAA (or FRED, or BLS, or an internal warehouse) a 4-file change instead of a rewrite.

## 12. The Recurring Pattern

| Single-source rule | Multi-source equivalent |
|---|---|
| One `EiaClient` singleton | A `SourceRegistry` of `DataSource` instances |
| `EIA_API_KEY` env | `<SOURCE>_API_KEY` env (e.g. `NOAA_API_KEY`) |
| EIA URL layout hardcoded | Each source declares its own `buildDataUrl`, `buildRouteUrl` |
| `DomainMeta` implicitly EIA | `DomainMeta.source: DataSourceId` (discriminator) |
| `/query` calls `eia.post()` | `/query` calls `source.client.post()` |
| `/domains` lists everything | `/domains` accepts `?source=` filter |
| `/guide` has one workflow | `/guide` lists `sources[]`; one workflow + per-source cookbook |

**Schema is the contract.** Once `DomainMeta.source` is in the schema, the rest of the system adapts automatically — the search index keys on it, the OpenAPI doc advertises it, the guide surfaces it, and route handlers do the dispatch. A new source is "real" the moment a domain file declares `source: '<id>'`; the registry doesn't need to know the domain exists, and the route handlers don't need to know the source exists.

**Per-source quirks live in the source config, not in routes.** NOAA's `token:` header and EIA's `?api_key=` parameter never touch the routing layer. The same is true for URL layout, error envelope shape, retry policy, and rate-limit headers. If a future source returns XML or protobuf, the `normalizeResponse` hook on the `DataSource` interface is the only place that needs to change.

## 13. Open Questions / Next Steps

Things that still need decisions before implementation:

- Should `source` be required from day one (strict) or optional with default `'eia'` (additive)?
- Should domain ids be namespaced (`eia-coal`) or kept flat (`coal`) for backward compat?
- Should there be a per-source `/guide/source/:id` endpoint, or is the `?source=` filter on `/guide` enough?
- Should `SourceClient` keep `cache` and `logger` injected per-source, or share a global cache with per-source TTLs?
- What's the boot-time validation story — fail fast on missing keys, or warn and skip?
- Should there be source-level rate limiting (NOAA has 1000 req/day, EIA has 9000/hour)?
- OpenAPI: how do we document a discriminated `domain` field whose valid values depend on `source`?

---

> This is a design document. Implementation is intentionally deferred until the design is reviewed and the open questions are resolved. The current single-source (EIA) architecture is fully supported by `main` and is not affected by anything in this document.
