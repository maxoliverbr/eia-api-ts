#!/usr/bin/env bash
# examples/curl/all-endpoints.sh
#
# Run from the repo root:  bash examples/curl/all-endpoints.sh
# Override base URL with:  BASE=https://my-host bash examples/curl/all-endpoints.sh
#
# Demonstrates every endpoint exposed by the EIA API for Agents wrapper.

set -euo pipefail

BASE="${BASE:-http://localhost:3000}"
JQ="${JQ:-jq}"  # set JQ=cat to skip pretty-printing

run() {
  local desc="$1"; shift
  echo
  echo "=== ${desc} ==="
  echo "+ $ $*"
  "$@"
  echo
}

# -----------------------------------------------------------------------------
# Meta
# -----------------------------------------------------------------------------
run "GET / — API root" \
  bash -c "curl -s '$BASE/' | $JQ ."

run "GET /health" \
  bash -c "curl -s '$BASE/health' | $JQ ."

run "GET /version" \
  bash -c "curl -s '$BASE/version' | $JQ ."

# -----------------------------------------------------------------------------
# Discovery
# -----------------------------------------------------------------------------
run "GET /domains — first 3 domains only" \
  bash -c "curl -s '$BASE/domains' | $JQ '.domains[:3]'"

run "GET /domains/coal — single domain" \
  bash -c "curl -s '$BASE/domains/coal' | $JQ '{id, name, subRoutes: (.subRoutes | length), useCases}'"

run "GET /domains/nope — 404 example" \
  bash -c "curl -s -w '\nHTTP %{http_code}\n' '$BASE/domains/nope'"

run "GET /routes/coal — proxied EIA route listing" \
  bash -c "curl -s '$BASE/routes/coal' | $JQ '.response.routes'"

# -----------------------------------------------------------------------------
# Facets
# -----------------------------------------------------------------------------
run "GET /routes/coal/aggregate-production/facet" \
  bash -c "curl -s '$BASE/routes/coal/aggregate-production/facet' | $JQ ."

run "GET /routes/coal/aggregate-production/facet/stateRegionId — values" \
  bash -c "curl -s '$BASE/routes/coal/aggregate-production/facet/stateRegionId' | $JQ '.response.facets[:5]'"

run "GET /schema/coal/aggregate-production — full route metadata" \
  bash -c "curl -s '$BASE/schema/coal/aggregate-production' | $JQ '{id: .response.id, name: .response.name, frequencies: .response.frequency, defaultFrequency: .response.defaultFrequency}'"

# -----------------------------------------------------------------------------
# Search
# -----------------------------------------------------------------------------
run "POST /search — keyword search" \
  bash -c "curl -s -X POST '$BASE/search' -H 'Content-Type: application/json' -d '{\"q\": \"coal production\"}' | $JQ ."

# -----------------------------------------------------------------------------
# Query (POST)
# -----------------------------------------------------------------------------
run "POST /query — basic, with column selection + sort" \
  bash -c "curl -s -X POST '$BASE/query' -H 'Content-Type: application/json' -d '{
    \"domain\": \"coal\",
    \"route\": \"aggregate-production\",
    \"frequency\": \"annual\",
    \"data\": [\"period\", \"production\"],
    \"start\": \"2020\",
    \"end\": \"2024\",
    \"sort\": [{\"column\": \"period\", \"direction\": \"asc\"}],
    \"length\": 5
  }' | $JQ ."

run "POST /query — with facet filters (electricity: NG fuel, CA + TX)" \
  bash -c "curl -s -X POST '$BASE/query' -H 'Content-Type: application/json' -d '{
    \"domain\": \"electricity\",
    \"route\": \"electric-power-operational-data\",
    \"frequency\": \"monthly\",
    \"start\": \"2024-01\",
    \"end\": \"2024-03\",
    \"facets\": {\"fueltypeid\": [\"NG\"], \"location\": [\"CA\", \"TX\"]},
    \"length\": 3
  }' | $JQ ."

run "POST /query — pagination (offset=3, length=2)" \
  bash -c "curl -s -X POST '$BASE/query' -H 'Content-Type: application/json' -d '{
    \"domain\": \"international\",
    \"route\": \"data\",
    \"frequency\": \"annual\",
    \"start\": \"2020\",
    \"end\": \"2023\",
    \"length\": 2,
    \"offset\": 3
  }' | $JQ ."

# -----------------------------------------------------------------------------
# Query (GET)
# -----------------------------------------------------------------------------
run "GET /query — simple via query string" \
  bash -c "curl -s '$BASE/query?domain=coal&route=aggregate-production&frequency=annual&start=2024&end=2024&length=3' | $JQ ."

# -----------------------------------------------------------------------------
# Error responses
# -----------------------------------------------------------------------------
run "POST /query — 400 on unknown domain" \
  bash -c "curl -s -w '\nHTTP %{http_code}\n' -X POST '$BASE/query' \
    -H 'Content-Type: application/json' \
    -d '{\"domain\": \"nope\", \"route\": \"x\"}'"

run "POST /search — 422 on empty q" \
  bash -c "curl -s -w '\nHTTP %{http_code}\n' -X POST '$BASE/search' \
    -H 'Content-Type: application/json' \
    -d '{\"q\": \"\"}'"

echo
echo "All endpoint examples complete."
