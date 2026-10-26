# 01 — Discover, Then Query

**File:** [`01-discover-and-query.ts`](./01-discover-and-query.ts)

## What this example is for

This is the agent loop that every later example builds on, written as plain `fetch` calls with no LLM. It starts from a natural-language intent (`"electricity emissions by state"`) and turns it into a valid `POST /query` without hardcoding a domain, route, or facet code. Each id is taken from the previous response.

---

## The flow

| Step | Call | Output used by the next step |
|---|---|---|
| 1 | `POST /search { q }` | Top hit's `domain` and `path` |
| 2 | `GET /domains/:id` | Sub-routes; takes the first one, with its `typicalFrequency` and `exampleQuery` |
| 3 | `GET /routes/{path}/facet` | Facet ids, e.g. `["fueltypeid", "location", …]` |
| 4 | `GET /routes/{path}/facet/{facetId}` | Two valid codes for the first facet |
| 5 | `POST /query` | Rows, built from all of the above |
| 6 | `POST /query { domain: "nope" }` | An `EiaClientError`, to show how a bad domain looks |

Step 4 is the important one. Facet codes are opaque (`"COL"`, `"SWY"`, `"99"`), so an agent that guesses them gets empty results or a 400 error. Always resolve them from the API.

---

## Running

```bash
bun dev                                           # terminal 1
bun run examples/agents/01-discover-and-query.ts  # terminal 2
```

Steps 1–4 work without a key. Step 5 needs `EIA_API_KEY` set on the server.

## Adapting

- Change `query` in step 1 to any intent.
- The example takes `domain.subRoutes[0]` and the first two facet values. A real agent would choose by `summary`/`tags` and by facet `name`. Example [05](./05-Mastra-Wyoming-Natural-Gas.md) hands those choices to an LLM.
