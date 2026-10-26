# 08 — Talking MCP: A Mastra Agent Over the Wire

**File:** [`08-mastra-mcp-client.ts`](./08-mastra-mcp-client.ts)

## What this example is for

Examples [05](./05-mastra-wyoming-natural-gas.ts) and [06](./06-Ontology-Example.md) are both Mastra agents, but neither one touches the MCP server. They hand-write their tools as plain `{ description, inputSchema, execute }` objects that call the REST API directly with `fetch`. In fact, the MCP server's own tool implementations (`src/mcp/tools.ts`) were copied from example 06's code — the server exists *because* those tools were useful, not the other way around.

This example closes the loop: it's a Mastra `Agent` that connects to this repo's own `/mcp` endpoint using Mastra's real MCP client package, `@mastra/mcp`'s `MCPClient`, and gets everything it needs over the wire:

- **Tools** — `mcp.listTools()` returns the server's 8 tools (namespaced `eia_<toolName>`), ready to pass straight into `new Agent({ tools })`. No zod schema is written in this file.
- **Instructions** — `mcp.resources.read('eia', 'eia://guide')` fetches the same agent playbook the REST `/guide` endpoint serves, and the example splices its `summary` + `philosophy` into the system prompt at runtime. Compare this to 06, which hardcodes its ontology knowledge directly into the prompt string.

The question is deliberately different from 06 (fossil fuels + carbon) and 07 (consumption forecast) so this isn't just a rerun with new plumbing: **which energy sources produce electricity via renewable means, and how has solar + wind generation trended 2020-2024?**

---

## The flow

```
new MCPClient({ servers: { eia: { url: new URL('http://localhost:3000/mcp') } } })
  → mcp.listTools()                       (discover the 8 tools, no local schemas)
  → mcp.resources.read('eia', 'eia://guide')  (discover the system-prompt context)
  → new Agent({ instructions, model, tools })
  → agent.generate(userPrompt)
  → mcp.disconnect()
```

Everything before `new Agent(...)` is generic MCP client code — it would work identically against any other MCP server, not just this repo's.

---

## Tools discovered over MCP

The server (`src/mcp/index.ts`) registers these 8 tools; `mcp.listTools()` returns them namespaced as `eia_browse_relations`, `eia_get_class_detail`, etc.:

| Tool | Purpose |
|---|---|
| `browse_relations` | Filter the ontology's RDF-style triples by subject / predicate / object |
| `get_class_detail` | Full detail for one ontology class (relations, sub-classes) |
| `get_domain_mapping` | Bridge an ontology class to an EIA domain + route + facet hints |
| `search_ontology` | Free-text keyword search over ontology classes and relations |
| `list_facets` | Filterable facet IDs for a domain + route |
| `get_facet_values` | Valid values for one facet (e.g. fuel-type codes) |
| `query_eia` | Raw EIA query, useful for inspecting column shapes |
| `query_with_summary` | EIA query post-processed into per-series statistics |

Their descriptions and input schemas live once, in `src/mcp/tools.ts` — this file never duplicates them.

---

## The `eia://guide` resource as dynamic system-prompt context

`mcp.resources.read('eia', 'eia://guide')` returns the same JSON the REST `/guide` endpoint serves — `summary`, `philosophy[]`, `workflow`, `decisionTree[]`, `antiPatterns[]`, and more (see `src/mcp/resources.ts`). This example only pulls `summary` and `philosophy` into the prompt (see `extractGuidePreamble` in the `.ts` file); a more ambitious agent could pull `antiPatterns` or `decisionTree` too, all without changing a line of server code.

---

## Adapting this example

- **Point at a different MCP server.** Add another entry to `servers: { eia: {...}, other: { url: new URL('...') } }` — `mcp.listTools()` namespaces tools per server, so nothing collides.
- **Use a narrower resource slice.** `eia://guide/{domainId}` (e.g. `eia://guide/electricity`) returns just one domain's playbook instead of the full guide — useful when you already know which domain you're working with and want a smaller prompt.
- **Swap `listTools()` for `listToolsets()`.** `listToolsets()` groups tools by server without namespacing and is meant to be passed dynamically per-call via `agent.generate(prompt, { toolsets })` instead of baked into the `Agent` at construction time — useful in multi-tenant setups where different callers should see different servers.

---

## Running the example

```bash
# Terminal 1 — the server, with MCP mounted (a valid EIA_API_KEY is only
# needed for the final data-query tool calls; ontology tools need no key)
MCP_ENABLED=true bun dev

# Terminal 2
bun add @mastra/core @mastra/mcp @ai-sdk/openai-compatible zod
echo 'OPENROUTER_API_KEY=sk-or-...' >> .env
bun run examples/agents/08-mastra-mcp-client.ts
```

---

## What to watch in the logs

- `Discovered 8 tools over MCP` followed by a `eia_*`-prefixed list — confirms the tools came from the server, not from this file.
- If instead you see `Could not reach the MCP endpoint ...`, the server was started without `MCP_ENABLED=true` (`/mcp` 404s when the flag is off) — restart it with the flag set and re-run.
- `Reading the eia://guide resource over MCP ...` — confirms the resource read succeeded before the agent starts reasoning.
