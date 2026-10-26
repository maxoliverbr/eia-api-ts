#!/usr/bin/env bash
# examples/curl/ontology-insights.sh
#
# Run from the repo root:  bash examples/curl/ontology-insights.sh
# Override base URL with:  BASE=https://my-host bash examples/curl/ontology-insights.sh
#
# Walks the ontology insight loop end to end: start from a plain-English
# concept, discover how it connects to other concepts, and land on runnable
# queries — without hardcoding any energy knowledge.
#
#   1. /ontology/search           free text → class/relation ids
#   2. /ontology/paths            how two concepts connect (with evidence datasets per hop)
#   3. /ontology/relations/:id/evidence   relation → runnable POST /query bodies
#   4. /ontology/classes/:id      class detail incl. facet-value bindings
#   5. /ontology/classes/:id/comparability   which datasets can be validly compared
#   6. POST /query                use a facet binding to fetch real data (needs EIA_API_KEY upstream)

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
# 1. Free-text search: "carbon emissions" → class and relation ids
# -----------------------------------------------------------------------------
run "1. Search the ontology — don't guess ids" \
  bash -c "curl -s '$BASE/ontology/search?q=carbon+emissions&limit=5' | $JQ '.hits[] | {type, id, score}'"

# -----------------------------------------------------------------------------
# 2. Path finding: how does home natural-gas use end up as CO2?
#    Each hop cites the EIA domains that can quantify it.
# -----------------------------------------------------------------------------
run "2. Connect two concepts — Residential → CO2Emissions" \
  bash -c "curl -s '$BASE/ontology/paths?from=Residential&to=CO2Emissions&limit=2' | $JQ '.paths[] | {length, chain: [.hops[] | \"\(.from) \(if .direction == \"reverse\" then \"<-\(.predicate)-\" else \"-\(.predicate)->\" end) \(.to) [\(.evidenceDomains | join(\",\"))]\"]}'"

# -----------------------------------------------------------------------------
# 3. Evidence: turn a relation into runnable query bodies.
#    commonQueries[].params can be POSTed to /query as-is; facetBindings give
#    the filter codes for the relation's subject/object classes.
# -----------------------------------------------------------------------------
run "3. Relation → runnable queries (coal-produces-electricity)" \
  bash -c "curl -s '$BASE/ontology/relations/coal-produces-electricity/evidence' | $JQ '.evidence[] | {domainId, recipes: [.commonQueries[] | {name, params}], facetBindings}'"

# -----------------------------------------------------------------------------
# 4. Class detail: facetBindings map the class to concrete filter codes
#    (Coal → fueltypeid=["COL"] on the electricity operational route).
# -----------------------------------------------------------------------------
run "4. Class → facet filter codes" \
  bash -c "curl -s '$BASE/ontology/classes/Coal' | $JQ '{class: .class.id, facetBindings}'"

# -----------------------------------------------------------------------------
# 5. Comparability: which state-level datasets line up for cross-domain analysis?
# -----------------------------------------------------------------------------
run "5. Which datasets can be compared for State" \
  bash -c "curl -s '$BASE/ontology/classes/State/comparability' | $JQ '.comparableGroups[] | select(.comparable)'"

# -----------------------------------------------------------------------------
# 6. Payoff: use the Coal binding from step 4 in a real data query.
#    (Proxied to the EIA API — the server needs EIA_API_KEY set.)
# -----------------------------------------------------------------------------
run "6. Query coal-fired generation using the binding" \
  bash -c "curl -s -X POST '$BASE/query' -H 'Content-Type: application/json' -d '{
    \"domain\": \"electricity\",
    \"route\": \"electric-power-operational-data\",
    \"frequency\": \"annual\",
    \"start\": \"2022\", \"end\": \"2024\",
    \"facets\": { \"fueltypeid\": [\"COL\"] },
    \"data\": [\"generation\"],
    \"sort\": [{ \"column\": \"period\", \"direction\": \"asc\" }],
    \"length\": 5
  }' | $JQ '.response.data'"

echo
echo "Done. Concept → connection → runnable query, with zero hardcoded energy knowledge."
