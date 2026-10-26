# 07 — Ontology-Driven Consumption Prediction

**File:** [`07-ontology-consumption-prediction.ts`](./07-ontology-consumption-prediction.ts)

## What this example is for

This is the **consumption** counterpart to [example 06](./06-Ontology-Example.md) (which is about **generation + carbon**). The two together cover both ends of the energy story:

- **06** — *Which fossil fuels generate US electricity, and what CO₂ do they emit?* (knowledge-graph-first carbon footprint)
- **07** — *Which sectors consume which fuels, and what does STEO forecast for the next 24 months?* (knowledge-graph-first consumption forecast)

07 is also a different *style* of ontology example: plain `fetch` + `shared.ts`, **no LLM dependency**, runs as a single script. The pattern is: ask the ontology what to investigate, then issue data queries with graceful degradation.

**Question the example answers:** *Across three U.S. sectors and two fuels, how does recent historical consumption compare to the STEO forecast?*

It does not answer this from prior knowledge — it asks the ontology which sectors exist, which fuels they consume, and which domains project forward. Then it pulls historical consumption from `total-energy` and the forecast from `steo`.

---

## The flow

```
GET /ontology                                → counts, confirm size
GET /ontology/classes?parentClass=Sector     → pick 3 sectors
GET /ontology/relations?subject=<Sector>     → for each sector, find fuels it consumes
GET /ontology/relations?predicate=forecastedBy → find projection domains (steo, aeo, …)
GET /ontology/domains/seds                   → historical domain metadata
GET /ontology/domains/steo                   → forecast domain metadata

POST /query  total-energy  (msn=NGRCPUS, …)  → historical mean per (sector × fuel)
POST /query  steo          (seriesId=NGTCPUS, …) → forecast mean per fuel
```

The first six calls are in-memory (`/ontology/*` bypasses the upstream EIA API and the throttle) — only the last two actually hit EIA.

---

## The ontology, as walked in the example

### 1. Sectors come from the `Sector` hierarchy

```
GET /ontology/classes?parentClass=Sector
→ { total: 5, classes: [Residential, Commercial, Industrial, Transportation, ElectricPower] }
```

The example picks three (Residential, Commercial, Industrial) — the classic end-use sectors.

### 2. Sector → fuel consumption edges

```
GET /ontology/relations?subject=Residential
→ Residential –consumes→ NaturalGas
→ Residential –consumes→ Electricity
…
```

The example uses these to confirm that the (sector × fuel) pairs it plans to query are actually supported by the conceptual model. This is the bridge between "what the data *can* describe" and "what we should query."

### 3. Projection domains live behind the `forecastedBy` predicate

```
GET /ontology/relations?predicate=forecastedBy
→ LongTermProjection  –forecastedBy→ Projection   (evidence: aeo, ieo)
→ ShortTermProjection –forecastedBy→ Projection   (evidence: steo)
```

The example asserts that `steo` appears here — without the ontology, an agent would have to know about STEO in advance.

### 4. Domain mappings bridge ontology classes to EIA domains

```
GET /ontology/domains/seds
→ { geographyScope: "state",  energyFlows: ["Consumption"], … }

GET /ontology/domains/steo
→ { geographyScope: "national", temporalGranularities: ["monthly"], isProjection: true }
```

The mapping confirms:
- `seds` is the historical consumption domain (state-level, Consumption flow).
- `steo` is the forecast domain (national, monthly, projection).

---

## The data, as walked in the example

The 3 × 2 matrix of (sector × fuel) pairs:

|                | Natural Gas | Electricity |
|----------------|-------------|-------------|
| Residential    | `NGRCPUS`   | `ESRCPUS`   |
| Commercial     | `NGCCPUS`   | `ESCCPUS`   |
| Industrial     | `NGICPUS`   | `ESICPUS`   |

These are EIA **MSN** (Monthly State Name) codes, fetched from `total-energy` at `frequency=annual` for `2020–2023`. The historical mean over those four years is the "historical" column.

The forecast is pulled from STEO with **fuel-level** series IDs (`NGTCPUS` for natural gas, `ELTCPUS` for electricity), `frequency=monthly`, over a window covering the next ~24 months. The forecast mean is the "forecast" column.

The script prints a small ASCII table:

```
  sector       fuel         historical   forecast    Δ%
  ------------- ------------- ------------ ------------ -------
  Residential  NaturalGas      4.32e+00   3.10e+01   +617.5%
  Residential  Electricity     1.50e+03   4.00e+02    -73.3%
  …
```

(Numbers in this doc are illustrative; the real values print at runtime.)

---

## Honest limitations

The script flags these in its log output and in code comments:

1. **STEO is fuel-level, not sector × fuel.** The forecast mean is therefore the same across sectors of the same fuel. The script repeats the value across the three sector cells and adds a note. Sector-level STEO forecasts exist but use a separate `seriesId` namespace and a different facet — discovering those at runtime would be the next step in a production agent.
2. **MSN codes are EIA-published names.** They are stable but not guaranteed — if EIA deprecates any, the cell returns empty and the script logs `no data` and continues.
3. **The "Δ%" column is a simple mean-over-mean comparison.** It does not normalize units across rows, mix calendarization, or weight by sector size. A real agent would join units, frequency, and date ranges before drawing conclusions.

---

## Adapting this example

The pattern generalizes in three obvious ways:

### Add more sectors

```
const sectors: Sector[] = ['Residential', 'Commercial', 'Industrial', 'Transportation', 'ElectricPower']
```

Transportation consumes Petroleum primarily — `browse_relations(subject='Transportation')` will tell you which fuels to add to `FUELS`.

### Switch to long-term (AEO)

Replace `forecastedBy` consumption with `LongTermProjection`:

```
GET /ontology/relations?predicate=forecastedBy
→ LongTermProjection –forecastedBy→ Projection   (evidence: aeo, ieo)
GET /ontology/domains/aeo
→ { temporalGranularities: ["annual"], isProjection: true }
```

Then query `aeo/data` for the same MSN codes, `start=2024`, `end=2050`, `frequency=annual`. The output will be a 30-year outlook instead of a 24-month one.

### Compare scenarios

AEO publishes multiple scenarios (reference, low oil price, high oil price, etc.). The `scenario` facet lets you pull the same MSN under different scenarios and compare — e.g. residential natural gas consumption in the reference case vs. the high-renewables case.

---

## Running the example

```bash
# Terminal 1 — start the API server (a valid EIA_API_KEY must be in .env
# for the data steps; ontology steps need no key)
bun dev

# Terminal 2
bun run examples/agents/07-ontology-consumption-prediction.ts
```

---

## What to watch in the logs

If the script logs `no data` for any (sector × fuel) cell, it means EIA returned zero rows for that MSN code — most likely because the code is misnamed for the current EIA API. The right next step is to call:

```bash
curl 'http://localhost:3000/routes/total-energy/facet/msn' | head -200
```

…and pick the matching code for that sector × fuel from the live list.
