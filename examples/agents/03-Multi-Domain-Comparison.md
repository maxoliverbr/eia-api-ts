# 03 — Multi-Domain Comparison: CO2 Intensity by State

**File:** [`03-multi-domain-comparison.ts`](./03-multi-domain-comparison.ts)

## What this example is for

Many useful questions need two datasets that EIA publishes in different domains, with different facet names for the same concept. This example joins state CO2 emissions with state net generation to compute **emissions intensity (metric tons CO2 per MWh)** for 2022, then prints the five dirtiest and five cleanest grids. No LLM is involved.

---

## The flow

| Step | Domain / route | Facets | Column | Join key |
|---|---|---|---|---|
| 1 | `state-electricity-profiles` / `emissions-by-state-by-fuel` | `fuelid: ["ALL"]` | `co2-thousand-metric-tons` | `stateid` |
| 2 | `electricity` / `electric-power-operational-data` | `fueltypeid: ["ALL"]`, `sectorid: ["99"]` | `generation` | `location` |
| 3 | in-process join | | `co2 / gen` | state code |

## Things to notice

- **Same state, different facet names**: `stateid` in one domain, `location` in the other. Cross-domain joins usually need this kind of mapping. The ontology's `/ontology/classes/:id/comparability` endpoint lists it (see [`curl/ontology-insights.sh`](../curl/ontology-insights.sh)).
- **Units cancel**: thousand metric tons ÷ thousand MWh gives metric tons/MWh with no conversion. Check this before dividing any two series.
- **`sectorid: "99"`** is EIA's all-sectors total. Without it, generation is counted once per sector and the intensity comes out too low.
- States missing from either dataset, or with zero generation, are dropped rather than producing `Infinity`.

---

## Running

```bash
bun dev                                                # terminal 1
bun run examples/agents/03-multi-domain-comparison.ts  # terminal 2
```

Requires `EIA_API_KEY` on the server.
