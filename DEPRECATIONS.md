# Deprecations

Curated summary of upstream EIA API deprecations that affect routes this wrapper proxies. Not an official EIA document — re-verify against the links in the "Sources" section before relying on it.

## Deprecated API version — APIv1

The entire APIv1 surface is deprecated. EIA committed to supporting it "until at least January 2023" (per the official docs page). No end-of-life date has been published since.

What is gone in v2:

- Legacy routes such as `/series/?series_id=...` and `/aeries/?series_id=...`.
- The `command` parameter pattern (replaced by a RESTful route hierarchy).
- `Geoset` queries (replaced by the `facets[...]` property on data calls).
- Separate `relation` / `category` queries (folded into the route tree, or surfaced as metadata).
- Header-based `start` / `end` / `num` pagination (replaced by URL `offset` / `length` parameters).
- The non-TLS `http://` protocol (v2 is https-only).
- The quota-free "last update" query (not supported in v2).

Backward-compat shim: `/v2/seriesid/{seriesId}` still translates v1 Series IDs. It was added in v2.1.0 "Clementia" (Nov 2022) and is the only v1-era affordance that survives in v2. This wrapper does not currently expose a dedicated route for it; call the upstream directly if you need it (`https://api.eia.gov/v2/seriesid/{seriesId}?api_key=...`).

## Deprecated data series — CO2 emissions

The underlying data series behind two upstream routes have been deprecated as of 2023. Per the open-data landing page: "Deprecated series as of 2023; now available in SEDS." The same note appears in the bulk-file list for `EMISS.zip` ("CO2 Emissions (deprecated): see SEDS") and `EMISS-old.zip` ("Emissions (old) (deprecated): see SEDS").

Affected upstream routes:

- `GET/POST /v2/co2-emissions/co2-emissions-aggregates/...` (`src/domains/co2-emissions.ts:49-53`).
- `GET/POST /v2/co2-emissions/co2-emissions-and-carbon-coefficients/...` (`src/domains/co2-emissions.ts:58-62`).

Replacement: the State Energy Data System (SEDS) domain, under `GET/POST /v2/seds/{...}/data`. The relevant SEDS sub-routes are discoverable via `GET /routes/seds` — for example, `seds/co2-emissions-from-energy-consumption` carries the same per-state CO2 totals that the deprecated route used to serve.

The deprecation is data-level: the v2 endpoints still respond, and this wrapper does not currently intercept or rewrite calls to them. Until/unless upstream stops returning data, calls to the deprecated routes will continue to work.

## What this wrapper does about it

- The wrapper does not intercept, rewrite, or deprecate any upstream call. It proxies them.
- `/domains` and `/routes/*` responses do not currently surface a `deprecated` field for sub-routes — see `src/schemas/domain.ts` (`DomainMeta`) and `src/domains/co2-emissions.ts:36-66`.
- If a caller hits a deprecated upstream route, the wrapper returns whatever the upstream returns (typically `200` with the deprecated series).
- The bundled `eia-api-swagger.yaml` carries no `deprecated: true` flags anywhere — EIA does not annotate them in the spec they publish, only in prose on the open-data pages.

## How to verify

These upstream pages are the source of truth:

- `https://www.eia.gov/opendata/` — landing page; the "CO2 Emission Aggregates" entry and the bulk-file list carry the deprecation note.
- `https://www.eia.gov/opendata/documentation.php` — "APIv1 availability" table and the v2.1.0 "Clementia" patch note (Nov 2022).

## Last reviewed

2026-06-15.
