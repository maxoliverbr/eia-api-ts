# cURL Examples

Plain shell scripts for when you want to see raw HTTP: no Bun, no TypeScript, just `curl` piped through `jq`. Use them to smoke-test a deployment, to show the API to someone who doesn't use TypeScript, or to copy a request into another language.

## Files

| File | What it does |
|---|---|
| [`all-endpoints.sh`](./all-endpoints.sh) | One `curl` per endpoint, grouped by tag: meta, discovery, facets, search, query (POST and GET), and deliberate error responses |
| [`all-domains.sh`](./all-domains.sh) | One minimal `POST /query` (`length: 2`) for every registered domain/route, about 57 calls. Quick check that every route still returns data |
| [`ontology-insights.sh`](./ontology-insights.sh) | Steps through the ontology end to end: `/ontology/search` → `/ontology/paths` → relation evidence → class facet bindings → `/comparability` → a real `POST /query` built from a binding |

## Running

Run from the repo root, with the server up (`bun dev`):

```bash
bash examples/curl/all-endpoints.sh
bash examples/curl/all-domains.sh
bash examples/curl/ontology-insights.sh
```

| Variable | Default | Purpose |
|---|---|---|
| `BASE` | `http://localhost:3000` | Point at another host, e.g. a Dokploy deployment |
| `JQ` | `jq` | Path to the `jq` binary |

`jq` must be installed. Data queries need `EIA_API_KEY` on the server; discovery, facet, search, and ontology calls work without it. Note that `all-domains.sh` hardcodes the AEO/IEO publication years (`2026`, `2023`); change them when EIA publishes a new edition.
