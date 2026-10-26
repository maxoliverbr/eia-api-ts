# 04 — Error Recovery Patterns

**File:** [`04-error-recovery.ts`](./04-error-recovery.ts)

## What this example is for

An agent that stops at the first error is not useful. This example triggers each error class the wrapper returns, on purpose, and shows the matching recovery. It uses `EiaClientError` from [`../shared.ts`](../shared.ts), which exposes `status`, `errorCode`, and `upstreamStatus` so code can branch on them instead of parsing message strings.

---

## Error classes

| Status | Triggered by | Meaning | Recovery shown |
|---|---|---|---|
| **422** | `POST /search { q: "" }` | Request body failed schema validation | Fix the input; validate on the client first |
| **400** | `POST /query { domain: "typo-domain" }` | Valid shape but unknown domain | Fall back to `/search` to suggest the right one |
| **502** | `POST /query { domain: "coal", route: "no-such-subroute" }` | Upstream EIA rejected the request; `upstreamStatus` says why | List valid sub-routes via `GET /domains/coal`, then retry |
| **401 → 502** | Bad `EIA_API_KEY` on the server (explained, not triggered) | Upstream rejected the key | Fix the key in the server's `.env` |
| transient | Simulated flaky call | Network or rate-limit glitch | Retry with exponential backoff (100 → 200 → 400 ms) |

## Things to notice

- The `safe()` helper logs and returns `null` instead of throwing, so one failed step doesn't end the run. Agent tool wrappers need the same pattern: return the error to the model as data so it can try again with different arguments. Example [09](./09-Mastra-MCP2-Energy-Prices.md) does this for MCP tool errors.
- The wrapper already backs off on upstream 429s. The retry loop here is for errors the server can't absorb.

---

## Running

```bash
bun dev                                     # terminal 1
bun run examples/agents/04-error-recovery.ts  # terminal 2
```

Works without `EIA_API_KEY`, since every call is expected to fail.
