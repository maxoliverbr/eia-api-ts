# 06 — Ontology-Guided Mastra Agent

**File:** [`06-mastra-ontology-electricity-carbon.ts`](./06-mastra-ontology-electricity-carbon.ts)

## What this example is for

Most agent examples start from a known question ("give me Wyoming natural gas data") and hardcode the domain, route, and facet names they need. This example shows the alternative: letting the **EIA energy ontology** drive the entire analysis.

The ontology is a formal knowledge graph of the energy domain — 55 classes, 34 RDF-style relations, and 15 domain mappings that link abstract concepts ("Coal emits CO2") to concrete EIA datasets ("query the `co2-emissions` domain"). An ontology-guided agent doesn't need to know which domains are relevant in advance. It asks the knowledge graph first, then follows the edges to data.

**Question the agent answers:** *Which fossil fuels generate US electricity, and what CO2 emissions do they produce?*

The agent cannot answer this from its training. It has to discover it:

```
browse_relations(predicate="emits")
  → Coal, NaturalGas, Petroleum emit CO2

browse_relations(predicate="produces", object="Electricity")
  → Coal, NaturalGas, Nuclear, Renewables, DensifiedBiomass produce electricity

Intersect → fossil electricity producers = Coal + NaturalGas

get_domain_mapping("electricity")   → domain id, routes, facet names
get_domain_mapping("co2-emissions") → domain id, routes, facet names

list_facets + get_facet_values      → discover actual fueltypeid codes (e.g. "COL", "NG")

query_with_summary(electricity, ...)  → generation by fuel 2020–2024
query_with_summary(co2-emissions, ...) → emissions by fuel 2020–2024
```

The domain names, route names, and facet codes are all *discovered*, not hardcoded.

---

## The ontology: three layers

### 1. Classes (`/ontology/classes`)

55 concepts organized in 8 hierarchies. Each has an `id` (PascalCase), a `name`, an optional `parentClass`, a `description`, and optional `sameAs` URIs linking to DBpedia/Wikidata.

| Hierarchy | Classes |
|-----------|---------|
| **EnergySource** | Coal, NaturalGas, Petroleum, Nuclear, Renewables, DensifiedBiomass, Electricity |
| **Sector** | Residential, Commercial, Industrial, Transportation, ElectricPower |
| **Geography** | Country, State, RTORegion, CustomsDistrict, Facility |
| **EnergyFlow** | Production, Consumption, Import, Export, Storage, Transmission, RetailSales |
| **Measurement** | Quantity, Price, Expenditure, Capacity |
| **TemporalGranularity** | Annual, Monthly, Weekly, Daily, Hourly |
| **Projection** | LongTermProjection, ShortTermProjection |
| **EnvironmentalImpact** | CO2Emissions, CarbonCoefficient |

### 2. Relations (`/ontology/relations`)

34 directed edges in the form `Subject –[predicate]→ Object`. Each relation also carries `evidenceDomains` — the EIA domain ids where that relationship is actually observed in data.

The 12 predicate verbs:

| Category | Predicates |
|----------|-----------|
| Production / consumption | `produces`, `consumes` |
| Trade | `imports`, `exports` |
| Infrastructure | `stores`, `transmits`, `locatedIn` |
| Measurement | `measuredBy`, `measuredAt` |
| Environmental | `emits` |
| Forecasting | `forecastedBy` |
| Semantics | `subClassOf` |

A few notable triples:

```
Coal          –emits→       CO2Emissions      (evidenceDomains: co2-emissions)
NaturalGas    –emits→       CO2Emissions      (evidenceDomains: co2-emissions)
Coal          –produces→    Electricity       (evidenceDomains: coal, electricity)
Renewables    –produces→    Electricity       (evidenceDomains: electricity)
Electricity   –transmits→   RTORegion         (evidenceDomains: rto)
Electricity   –measuredAt→  Hourly            (evidenceDomains: rto)
NaturalGas    –stores→      State             (evidenceDomains: natural-gas)
Petroleum     –imports→     Country           (evidenceDomains: crude-oil-imports)
```

### 3. Domain mappings (`/ontology/domains/:domainId`)

Each of the 15 EIA domains is annotated with:

- `primaryClasses` — which ontology classes it primarily covers
- `energyFlows` — which EnergyFlow subclasses it represents
- `geographyScope` — finest geographic granularity (`national`, `state`, `facility`, `regional`, `international`)
- `temporalGranularities` — available frequencies (annual, monthly, hourly, …)
- `isProjection` — whether the domain is forecasted (AEO, IEO, STEO = `true`)
- `hasEmissions` — whether it includes CO2 data
- `relatedRelationIds` — which ontology relations this domain instantiates

This is the bridge layer: from "I care about the `NaturalGas` class" to "I should query the `natural-gas` domain."

---

## Ontology endpoints

| Endpoint | What it returns |
|----------|----------------|
| `GET /ontology` | Index: class count, relation count, domain mapping count, links to sub-resources |
| `GET /ontology/classes` | All 55 classes; filter with `?parentClass=EnergySource` |
| `GET /ontology/classes/:classId` | One class + its direct subclasses + all relations where it appears |
| `GET /ontology/relations` | All 34 relations; filter with `?subject=Coal`, `?predicate=emits`, `?object=Electricity` |
| `GET /ontology/domains/:domainId` | Domain mapping (primaryClasses, routes, facets, scope, …) |
| `GET /ontology/graph` | All three collections in one call (classes + relations + domainMappings) |
| `GET /ontology/export?format=jsonld` | W3C JSON-LD serialization (for external RDF tools) |
| `GET /ontology/export?format=turtle` | Turtle RDF serialization |

---

## Tools in this example

The agent has seven tools — three for ontology navigation, four for data retrieval. The data tools are the same as in example 05; the ontology tools are what's new.

| Tool | Endpoint | Role |
|------|----------|------|
| `browse_relations` | `GET /ontology/relations?predicate=&subject=&object=` | Graph traversal — the core discovery tool |
| `get_class_detail` | `GET /ontology/classes/:classId` | Deep-dive on a single class |
| `get_domain_mapping` | `GET /ontology/domains/:domainId` | Bridge from class → EIA domain |
| `list_facets` | `GET /routes/:domain/:route/facet` | What filters exist on a route |
| `get_facet_values` | `GET /routes/:domain/:route/facet/:facetId` | What codes are valid for a filter |
| `query_eia` | `POST /query` | Raw data query (useful for inspecting column shapes) |
| `query_with_summary` | `POST /query` + post-process | Per-series statistics (min, max, avg, latest, yoy) |

---

## Adapting this example to new scenarios

The pattern is always the same: **start from a relation, follow the edges, land on a domain.** Change the starting predicate or class to explore a completely different energy story.

---

### Scenario A — Renewable electricity by state

**Question:** Which energy sources produce electricity without emitting CO2, and which states have the most renewable capacity?

```
browse_relations(predicate="produces", object="Electricity")
  → Coal, NaturalGas, Nuclear, Renewables, DensifiedBiomass

browse_relations(predicate="emits", object="CO2Emissions")
  → Coal, NaturalGas, Petroleum

Subtract emitters → non-emitting producers = Nuclear, Renewables, DensifiedBiomass

get_domain_mapping("state-electricity-profiles")
  → geographyScope: "state", facets include stateid and fueltypeid

get_domain_mapping("electricity")
  → route: electric-power-operational-data, facets: location, fueltypeid

query_with_summary(electricity, electric-power-operational-data,
  facets: { fueltypeid: [<solar code>, <wind code>, <hydro code>] })
```

Changes from the existing example: the starting `browse_relations` call is the same shape, but the intersection logic is inverted (exclude emitters instead of include them).

---

### Scenario B — Natural gas trade and storage

**Question:** Where does the US get its natural gas, and how much is stored?

```
browse_relations(subject="NaturalGas")
  → NaturalGas –imports→ Country  (evidenceDomains: natural-gas)
  → NaturalGas –stores→  State    (evidenceDomains: natural-gas)
  → NaturalGas –produces→ Electricity
  → NaturalGas –emits→   CO2Emissions
  → Residential –consumes→ NaturalGas

get_domain_mapping("natural-gas")
  → routes: sum/imports, stor/wkly, cons/sum, pri/sum, prod/oilwells, ...

query_with_summary(natural-gas, sum/imports, frequency="monthly", ...)
query_with_summary(natural-gas, stor/wkly,   frequency="weekly",  ...)
```

`browse_relations(subject="NaturalGas")` returns all edges where NaturalGas is the subject — it's a one-call map of everything the ontology knows about natural gas, including which domains carry evidence.

---

### Scenario C — Sector-level CO2 from all fossil fuels

**Question:** Which consumption sectors are most exposed to CO2-emitting fuels?

```
browse_relations(predicate="emits")
  → Coal, NaturalGas, Petroleum emit CO2

For each emitter, browse_relations(subject=<emitter>, predicate="consumes")
  (note: consumes is the reverse — look for relations where the emitter is the object)
browse_relations(predicate="consumes", object="Coal")
  → ElectricPower –consumes→ Coal
browse_relations(predicate="consumes", object="NaturalGas")
  → Residential –consumes→ NaturalGas
browse_relations(predicate="consumes", object="Petroleum")
  → Transportation sector (via SEDS)

get_domain_mapping("co2-emissions")
  → route: co2-emissions-aggregates, facets: stateId, sectorId, fuelId

get_domain_mapping("seds")
  → State Energy Data System — sector-level consumption across all fuels

query_with_summary(co2-emissions, co2-emissions-aggregates,
  frequency="annual", facets: { sectorId: ["EC", "RC", "CC", "IC", "TC"] })
```

---

### Scenario D — Grid real-time: hourly electricity transmission

**Question:** How does electricity flow through RTO regions in real time?

```
browse_relations(predicate="transmits")
  → Electricity –transmits→ RTORegion (evidenceDomains: rto)

browse_relations(predicate="measuredAt", object="Hourly")
  → Electricity –measuredAt→ Hourly (evidenceDomains: rto)

get_domain_mapping("rto")
  → temporalGranularities: ["hourly"], geographyScope: "regional"
  → routes include: region-data, fuel-type-data, interchange-data

list_facets(rto, fuel-type-data)
  → available respondent (region) and fueltype ids

query_with_summary(rto, fuel-type-data, frequency="hourly",
  start="2024-12-01T00", end="2024-12-07T23", length=500)
```

The key insight comes from `browse_relations(predicate="measuredAt", object="Hourly")` — it's the only way to discover that `rto` is the domain with hourly data without reading domain docs.

---

### Scenario E — Long-term energy outlook

**Question:** What does the AEO forecast for total energy production through 2050?

```
browse_relations(predicate="forecastedBy")
  → LongTermProjection  –forecastedBy→ Projection (evidenceDomains: aeo, ieo)
  → ShortTermProjection –forecastedBy→ Projection (evidenceDomains: steo)

get_domain_mapping("aeo")
  → isProjection: true, temporalGranularities: ["annual"]

get_domain_mapping("steo")
  → isProjection: true, temporalGranularities: ["monthly"]

query_with_summary(aeo, <route>, frequency="annual", start="2024", end="2050")
```

`browse_relations(predicate="forecastedBy")` is the signal that projection domains exist. Without the ontology, an agent would need to know about AEO in advance.

---

## Running the example

```bash
# Terminal 1 — start the API server
bun dev

# Terminal 2 — install opt-in deps (once) and run
bun add @mastra/core @ai-sdk/openai-compatible zod
echo 'OPENROUTER_API_KEY=sk-or-...' >> .env
bun run examples/agents/06-mastra-ontology-electricity-carbon.ts
```

You can swap the model on line 304 of the example:

```typescript
model: openrouter('anthropic/claude-sonnet-4-5'),
// or:
model: openrouter('openai/gpt-4o-mini'),
model: openrouter('google/gemini-2.0-flash'),
```

Any model available on [OpenRouter](https://openrouter.ai) works.

---

## What to watch in the logs

Each tool call is logged with its input and output count:

```
[tool:browse_relations]  in:  {"predicate":"emits"}
[tool:browse_relations]  out: 3 items
[tool:browse_relations]  in:  {"predicate":"produces","object":"Electricity"}
[tool:browse_relations]  out: 5 items
[tool:get_domain_mapping]  in:  {"domainId":"electricity"}
[tool:get_domain_mapping]  out: ok
[tool:list_facets]  in:  {"domain":"electricity","route":"electric-power-operational-data"}
[tool:list_facets]  out: 3 items
[tool:get_facet_values]  in:  {"domain":"electricity","route":"electric-power-operational-data","facetId":"fueltypeid"}
[tool:get_facet_values]  out: 12 items
[tool:query_with_summary]  in:  {"domain":"electricity","route":"electric-power-operational-data",...}
[tool:query_with_summary]  out: 243 rows
```

If the ontology tools (`browse_relations`, `get_domain_mapping`) are called *before* any data tools, the example is working as intended — the knowledge graph is driving the query strategy.

If the agent skips ontology steps and jumps straight to data queries, the system prompt's "MANDATORY WORKFLOW" section needs strengthening (try a more capable model, or add explicit penalties for skipping steps).
