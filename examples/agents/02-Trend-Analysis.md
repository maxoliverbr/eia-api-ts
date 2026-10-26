# 02 — Trend Analysis: Monthly → Annual → YoY

**File:** [`02-trend-analysis.ts`](./02-trend-analysis.ts)

## What this example is for

Raw EIA rows are seldom the answer. Usually you have to reshape them. This example shows the most common post-processing step: fetch a monthly series, roll it up to annual totals, compute year-over-year change, and draw an ASCII bar chart in the terminal. No LLM is involved.

The series is **`ELETPUS`** from the `total-energy` domain: US total electricity primary consumption, monthly, 2020-01 → 2024-12.

---

## The flow

```
POST /query { domain: "total-energy", route: "data", frequency: "monthly",
              facets: { msn: ["ELETPUS"] }, data: ["value"], start: "2020-01", end: "2024-12" }
  → aggregateAnnual()   sum 12 monthly values per year
  → YoY %               (this year − last year) / last year
  → bar()               40-char ASCII bar scaled to the max year
```

## Things to notice

- **`value` arrives as a string** in many EIA responses. `toNumber()` handles both forms and skips blanks rather than treating them as zero.
- **Summing is only correct for flow series** (consumption, generation). For prices or stocks, average or take the last value of each year instead.
- The `/query` call sets `length: 100`. 60 monthly rows fit easily, but the EIA default is lower, so always set `length` to cover the whole range.

---

## Running

```bash
bun dev                                       # terminal 1
bun run examples/agents/02-trend-analysis.ts  # terminal 2
```

Requires `EIA_API_KEY` on the server.

## Adapting

Swap `msn` for any Monthly Energy Review series code. Use `GET /routes/total-energy/data/facet/msn` to list them.
