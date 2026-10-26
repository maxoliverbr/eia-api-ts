# Per-Domain Examples

One short script per EIA domain. Each one calls `POST /query` through `queryDomain()` in [`../shared.ts`](../shared.ts). Where the facet codes aren't obvious, it lists the facets first, then runs 2–5 small queries (usually `length: 5`) so you can see the shape of each dataset's rows. No LLM is involved.

Use these as a reference for the correct `domain` + `route` + `facets` combinations. Several domains have quirks that break a query on first try, and those are listed below.

## Files

| File | Domain | What it queries |
|---|---|---|
| [`aeo.ts`](./aeo.ts) | Annual Energy Outlook | Picks the latest publication year from `/routes/aeo`, lists `scenario` values, then a 2025–2030 projection |
| [`ieo.ts`](./ieo.ts) | International Energy Outlook | Same year-discovery pattern as AEO; `regionId` values; 2025–2030 projection |
| [`co2-emissions.ts`](./co2-emissions.ts) | CO2 Emissions | State aggregates for the electric power sector (`sectorId: EC`); carbon coefficients by fuel |
| [`coal.ts`](./coal.ts) | Coal | US production 2015–2024, mine → plant shipments, price by rank, exports |
| [`crude-oil-imports.ts`](./crude-oil-imports.ts) | Crude Oil Imports | Facets, origin-country values, monthly imports for 2023 |
| [`densified-biomass.ts`](./densified-biomass.ts) | Densified Biomass | Wood-pellet production and sales/price by region; plant list |
| [`electricity.ts`](./electricity.ts) | Electricity | Generator capacity, retail sales by state, operational data for CA natural gas (`fueltypeid: NG`, `location: CA`) |
| [`international.ts`](./international.ts) | International | Country/region values; 2020–2022 data; China only (`countryRegionId: CHN`) |
| [`natural-gas.ts`](./natural-gas.ts) | Natural Gas | Consumption by end use, prices, oil-well counts, weekly storage, imports |
| [`nuclear-outages.ts`](./nuclear-outages.ts) | Nuclear Outages | Daily facility, generator, and US-total outages |
| [`rto.ts`](./rto.ts) | RTO / grid operations | PJM daily fuel mix, ERCOT daily region data, hourly interchange |
| [`seds.ts`](./seds.ts) | State Energy Data System | Texas total consumption 2020–2023; CA residential electricity (`seriesId: ESRCP`) |
| [`state-electricity-profiles.ts`](./state-electricity-profiles.ts) | State Electricity Profiles | Capability, Texas natural-gas emissions, CA + TX summary |
| [`steo.ts`](./steo.ts) | Short-Term Energy Outlook | `seriesId` values; monthly forecast rows |
| [`total-energy.ts`](./total-energy.ts) | Total Energy (MER) | `msn` series values; monthly 2024 rows |

## Gotchas these scripts already handle

- **AEO / IEO routes are publication years** (`aeo/2025`), not fixed names. Read the latest one from `/routes/aeo` instead of hardcoding it.
- **Natural-gas routes have two levels**: use `pri/sum`, not `pri`. Always filter `pri/sum` on `process`, or you get every price type in one result.
- **Facet names differ in case between domains**: `stateid` (electricity), `stateID` (state-electricity-profiles summary), `stateId` (seds).
- **SEDS and Total Energy facets are listed at the domain level** (`/routes/seds/facet`), not under `/data`.
- **`seds/data` has no sector facet.** The sector is part of the `seriesId` code (`ESRCP` = electricity, residential, consumption).
- **`wood-pellet-plants` is annual only.** Asking for monthly returns an error.

## Running

```bash
bun dev                                 # terminal 1
bun run examples/domains/electricity.ts # terminal 2 — any file in this folder
```

All scripts need `EIA_API_KEY` set on the server. To run one query for every domain/route at once, see [`../curl/all-domains.sh`](../curl/all-domains.sh) or [`../08-domains-overview.ts`](../08-domains-overview.ts).
