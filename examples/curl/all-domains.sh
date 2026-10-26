#!/usr/bin/env bash
# examples/curl/all-domains.sh
#
# Run:  bash examples/curl/all-domains.sh
#
# Sends one minimal POST /query for every registered domain. Good for
# smoke-testing the wrapper and exploring the shape of each dataset.

set -euo pipefail

BASE="${BASE:-http://localhost:3000}"
JQ="${JQ:-jq}"

declare -a QUERIES=(
  '{"domain":"aeo","route":"2026","frequency":"annual","length":2}'
  '{"domain":"ieo","route":"2023","frequency":"annual","length":2}'
  '{"domain":"co2-emissions","route":"co2-emissions-aggregates","frequency":"annual","length":2}'
  '{"domain":"co2-emissions","route":"co2-emissions-and-carbon-coefficients","frequency":"annual","length":2}'
  '{"domain":"coal","route":"aggregate-production","frequency":"annual","length":2}'
  '{"domain":"coal","route":"consumption-and-quality","frequency":"annual","length":2}'
  '{"domain":"coal","route":"exports-imports-quantity-price","frequency":"annual","length":2}'
  '{"domain":"coal","route":"market-sales-price","frequency":"annual","length":2}'
  '{"domain":"coal","route":"mine-production","frequency":"annual","length":2}'
  '{"domain":"coal","route":"price-by-rank","frequency":"annual","length":2}'
  '{"domain":"coal","route":"reserves-capacity","frequency":"annual","length":2}'
  '{"domain":"coal","route":"shipments/by-mine-by-plant","frequency":"annual","length":2}'
  '{"domain":"coal","route":"shipments/mine-aggregates","frequency":"annual","length":2}'
  '{"domain":"coal","route":"shipments/mine-state-aggregates","frequency":"annual","length":2}'
  '{"domain":"coal","route":"shipments/plant-aggregates","frequency":"annual","length":2}'
  '{"domain":"coal","route":"shipments/plant-state-aggregates","frequency":"annual","length":2}'
  '{"domain":"coal","route":"shipments/receipts","frequency":"annual","length":2}'
  '{"domain":"crude-oil-imports","route":"data","frequency":"monthly","length":2}'
  '{"domain":"densified-biomass","route":"capacity-by-region","frequency":"monthly","length":2}'
  '{"domain":"densified-biomass","route":"characteristics-by-region","frequency":"monthly","length":2}'
  '{"domain":"densified-biomass","route":"export-sales-and-price","frequency":"monthly","length":2}'
  '{"domain":"densified-biomass","route":"feedstocks-and-cost","frequency":"monthly","length":2}'
  '{"domain":"densified-biomass","route":"inventories-by-region","frequency":"monthly","length":2}'
  '{"domain":"densified-biomass","route":"production-by-region","frequency":"monthly","length":2}'
  '{"domain":"densified-biomass","route":"sales-and-price-by-region","frequency":"monthly","length":2}'
  '{"domain":"densified-biomass","route":"wood-pellet-plants","frequency":"annual","length":2}'
  '{"domain":"electricity","route":"electric-power-operational-data","frequency":"monthly","length":2}'
  '{"domain":"electricity","route":"facility-fuel","frequency":"monthly","length":2}'
  '{"domain":"electricity","route":"operating-generator-capacity","frequency":"monthly","length":2}'
  '{"domain":"electricity","route":"retail-sales","frequency":"annual","length":2}'
  '{"domain":"international","route":"data","frequency":"annual","length":2}'
  '{"domain":"natural-gas","route":"cons/sum","frequency":"annual","length":2}'
  '{"domain":"natural-gas","route":"pri/sum","frequency":"annual","length":2}'
  '{"domain":"natural-gas","route":"enr/sum","frequency":"annual","length":2}'
  '{"domain":"natural-gas","route":"prod/oilwells","frequency":"annual","length":2}'
  '{"domain":"natural-gas","route":"move/impc","frequency":"annual","length":2}'
  '{"domain":"natural-gas","route":"stor/wkly","frequency":"weekly","length":2}'
  '{"domain":"natural-gas","route":"sum/snd","frequency":"annual","length":2}'
  '{"domain":"nuclear-outages","route":"facility-nuclear-outages","frequency":"daily","length":2}'
  '{"domain":"nuclear-outages","route":"generator-nuclear-outages","frequency":"daily","length":2}'
  '{"domain":"nuclear-outages","route":"us-nuclear-outages","frequency":"daily","length":2}'
  '{"domain":"rto","route":"daily-interchange-data","frequency":"daily","length":2}'
  '{"domain":"rto","route":"daily-fuel-type-data","frequency":"daily","length":2}'
  '{"domain":"rto","route":"daily-region-data","frequency":"daily","length":2}'
  '{"domain":"rto","route":"daily-region-sub-ba-data","frequency":"daily","length":2}'
  '{"domain":"rto","route":"interchange-data","frequency":"hourly","length":2}'
  '{"domain":"rto","route":"fuel-type-data","frequency":"hourly","length":2}'
  '{"domain":"rto","route":"region-data","frequency":"hourly","length":2}'
  '{"domain":"rto","route":"region-sub-ba-data","frequency":"hourly","length":2}'
  '{"domain":"seds","route":"data","frequency":"annual","length":2}'
  '{"domain":"state-electricity-profiles","route":"capability","frequency":"annual","length":2}'
  '{"domain":"state-electricity-profiles","route":"emissions-by-state-by-fuel","frequency":"annual","length":2}'
  '{"domain":"state-electricity-profiles","route":"energy-efficiency","frequency":"annual","length":2}'
  '{"domain":"state-electricity-profiles","route":"meters","frequency":"annual","length":2}'
  '{"domain":"state-electricity-profiles","route":"net-metering","frequency":"annual","length":2}'
  '{"domain":"state-electricity-profiles","route":"source-disposition","frequency":"annual","length":2}'
  '{"domain":"state-electricity-profiles","route":"summary","frequency":"annual","length":2}'
  '{"domain":"steo","route":"data","frequency":"monthly","length":2}'
  '{"domain":"total-energy","route":"data","frequency":"monthly","length":2}'
)

ok=0
fail=0
echo
printf "%-32s %-50s %s\n" "DOMAIN" "ROUTE" "RESULT"
printf "%-32s %-50s %s\n" "------" "-----" "------"

for body in "${QUERIES[@]}"; do
  domain=$(echo "$body" | $JQ -r '.domain')
  route=$(echo "$body" | $JQ -r '.route')
  http=$(curl -s -o /tmp/eia-resp.json -w '%{http_code}' -X POST "$BASE/query" \
    -H 'Content-Type: application/json' \
    -d "$body")
  if [[ "$http" == "200" ]]; then
    total=$(jq -r '.response.total // "?"' /tmp/eia-resp.json 2>/dev/null || echo "?")
    printf "%-32s %-50s %s (%s rows)\n" "$domain" "$route" "OK" "$total"
    ok=$((ok + 1))
  else
    err=$(jq -r '.error // .message // "?"' /tmp/eia-resp.json 2>/dev/null || echo "?")
    printf "%-32s %-50s HTTP %s — %s\n" "$domain" "$route" "$http" "$err"
    fail=$((fail + 1))
  fi
done

echo
echo "Summary: $ok ok, $fail failed (out of ${#QUERIES[@]} total)"
