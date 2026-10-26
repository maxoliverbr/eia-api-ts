# 00 — Read the Guide First

**File:** [`00-read-the-guide.ts`](./00-read-the-guide.ts)

## What this example is for

Before an agent calls `/search` or `/query`, it should read `/guide`. That endpoint returns the server's own playbook: the rules, the step-by-step workflow, common mistakes, and ready-to-use recipes. Everything in it is generated from the same domain metadata that powers `/domains`. This example fetches the full guide and then one domain slice (`/guide/coal`), and prints both in a readable form. Nothing in the file is hardcoded energy knowledge; it only displays what the server says about itself.

No LLM is involved. Run this first to see what an agent would read before it starts.

---

## The flow

```
GET /guide          → summary, philosophy, workflow, antiPatterns, commonRecipes, domains[]
GET /guide/coal     → playbook, commonQueries, agentHints, taskToRoute, subRoutes[].agentGuidance
```

## What it prints

| Section | Source field | Why an agent cares |
|---|---|---|
| Philosophy | `guide.philosophy[]` | The rules, e.g. discover facet codes before filtering |
| Workflow | `guide.workflow.steps[]` | The canonical search → inspect → facet → query loop |
| Anti-patterns | `guide.antiPatterns[]` | What not to do, why, and what to do instead |
| Common recipes | `guide.commonRecipes[]` | Requests you can copy and paste |
| Domain inventory | `guide.domains[]` | Which domains include a playbook, recipes, or hints |
| Coal playbook | `coal.playbook.steps[]` | The goal, route, and reason for each step |
| Agent hints | `coal.agentHints` | Domain-specific warnings and gotchas |
| Task → route | `coal.taskToRoute` | Table that maps a plain-language task to a sub-route |
| Sub-route guidance | `coal.subRoutes[].agentGuidance` | Notes on each route, such as which facet must always be set |

---

## Running

```bash
bun dev                                        # terminal 1
bun run examples/agents/00-read-the-guide.ts   # terminal 2
```

No `EIA_API_KEY` is needed: `/guide` is served from local metadata.

## Adapting

- Change `/guide/coal` to any domain id from `/domains` (for example `/guide/natural-gas`) to see that domain's slice.
- An MCP client gets the same content from the `eia://guide` and `eia://guide/{domainId}` resources. See [08](./08-Mastra-MCP-Client.md).
