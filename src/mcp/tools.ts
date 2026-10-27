/**
 * The 9 MCP tools exposed by the EIA wrapper. Same descriptions, same input
 * shapes, same upstream behaviour as examples/agents/06-mastra-ontology-electricity-carbon.ts
 * (the canonical reference). `summarise.ts` is the lifted version of that
 * example's summarizeRows.
 *
 * Each `execute` returns an MCP tool-result payload ({ content: [...] })
 * directly, matching the @modelcontextprotocol/server `ToolCallback` shape.
 */
import { z } from 'zod'
import type { McpClient } from './client'
import { summarizeRows, type RawEiaRow } from './summarise'
import { RelationPredicateSchema, type RelationPredicate } from '../schemas/ontology'

const RELATION_PREDICATES = RelationPredicateSchema.anyOf.map((s) => s.const) as [RelationPredicate, ...RelationPredicate[]]

/** Wrap any value as an MCP tool result with a JSON text content block. */
const asToolResult = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
})

// ---------------------------------------------------------------------------
// Tool 1 — browse_relations
// ---------------------------------------------------------------------------
export const browseRelations = (client: McpClient) => ({
  description:
    'Browse relations in the EIA energy ontology. Filter by subject class id (e.g. "Coal"), predicate verb (e.g. "emits", "produces", "consumes"), or object class id (e.g. "Electricity", "CO2Emissions"). Returns matching RDF-style triples with evidenceDomains.',
  inputSchema: z.object({
    subject: z.string().optional().describe('Filter by subject class id, e.g. "Coal".'),
    predicate: z.enum(RELATION_PREDICATES).optional().describe('Filter by predicate verb, e.g. "emits".'),
    object: z.string().optional().describe('Filter by object class id, e.g. "Electricity".'),
  }),
  execute: async ({
    subject,
    predicate,
    object,
  }: {
    subject?: string
    predicate?: string
    object?: string
  }) => {
    const qs = new URLSearchParams(
      Object.entries({ subject, predicate, object }).filter((e): e is [string, string] => !!e[1]),
    ).toString()
    const value = await client.get(`/ontology/relations${qs ? `?${qs}` : ''}`)
    return asToolResult(value)
  },
})

// ---------------------------------------------------------------------------
// Tool 2 — get_class_detail
// ---------------------------------------------------------------------------
export const getClassDetail = (client: McpClient) => ({
  description:
    'Get full detail for an ontology class: its description, sameAs URIs, sub-classes, and all relations where it appears as subject or object. Use to understand a class before querying data.',
  inputSchema: z.object({
    classId: z
      .string()
      .describe('Ontology class id (PascalCase), e.g. "Coal", "NaturalGas", "CO2Emissions", "Electricity".'),
  }),
  execute: async ({ classId }: { classId: string }) =>
    asToolResult(await client.get(`/ontology/classes/${classId}`)),
})

// ---------------------------------------------------------------------------
// Tool 3 — get_domain_mapping
// ---------------------------------------------------------------------------
export const getDomainMapping = (client: McpClient) => ({
  description:
    'Get the ontology mapping for a specific EIA domain: which ontology classes it covers, which energy flows it represents, its geography scope, available temporal granularities, and the related ontology relation ids. Use this to bridge from an ontology class to an EIA domain id and its routes.',
  inputSchema: z.object({
    domainId: z
      .string()
      .describe('EIA domain id, e.g. "electricity", "co2-emissions", "coal", "natural-gas".'),
  }),
  execute: async ({ domainId }: { domainId: string }) =>
    asToolResult(await client.get(`/ontology/domains/${domainId}`)),
})

// ---------------------------------------------------------------------------
// Tool 4 — get_relation_evidence
// ---------------------------------------------------------------------------
export const getRelationEvidence = (client: McpClient) => ({
  description:
    'For an ontology relation id (e.g. "coal-emits-co2"), return runnable evidence per EIA domain: the domain ontology mapping, copy-pasteable POST /query recipe bodies (commonQueries), candidate sub-routes with example queries, and known facet-value bindings (e.g. fueltypeid=["COL"] for Coal). Use after browse_relations to jump straight to data.',
  inputSchema: z.object({
    relationId: z.string().describe('Relation id, e.g. "coal-produces-electricity".'),
  }),
  execute: async ({ relationId }: { relationId: string }) =>
    asToolResult(await client.get(`/ontology/relations/${relationId}/evidence`)),
})

// ---------------------------------------------------------------------------
// Tool 5 — search_ontology
// ---------------------------------------------------------------------------
export const searchOntology = (client: McpClient) => ({
  description:
    'Free-text keyword search over the EIA energy ontology. Returns ranked hits of classes and relations with id and snippet. Use this first when you do not know the exact class id (PascalCase) or relation id — then follow up with get_class_detail or browse_relations.',
  inputSchema: z.object({
    q: z.string().min(1).describe('Free-text query, e.g. "carbon emissions" or "coal".'),
    limit: z.number().int().min(1).max(100).optional().describe('Max hits (default 10).'),
  }),
  execute: async ({ q, limit }: { q: string; limit?: number }) => {
    const params = new URLSearchParams({ q })
    if (limit) params.set('limit', String(limit))
    return asToolResult(await client.get(`/ontology/search?${params}`))
  },
})

// ---------------------------------------------------------------------------
// Tool 6 — list_facets
// ---------------------------------------------------------------------------
export const listFacets = (client: McpClient) => ({
  description:
    'List the filterable facet IDs for a given domain + route (e.g. ["fueltypeid", "location", "sectorid"]). Call get_facet_values to resolve codes for a specific facet.',
  inputSchema: z.object({
    domain: z.string().describe('Domain id, e.g. "electricity" or "co2-emissions".'),
    route: z
      .string()
      .describe('Sub-route id, e.g. "electric-power-operational-data" or "co2-emissions-aggregates".'),
  }),
  execute: async ({ domain, route }: { domain: string; route: string }) =>
    asToolResult(await client.get(`/routes/${domain}/${route}/facet`)),
})

// ---------------------------------------------------------------------------
// Tool 7 — get_facet_values
// ---------------------------------------------------------------------------
export const getFacetValues = (client: McpClient) => ({
  description:
    'List all valid values for a facet (e.g. the fueltypeid codes available on an electricity route). Returns id + name pairs. Use this to discover the correct code for a fuel type before filtering.',
  inputSchema: z.object({
    domain: z.string().describe('Domain id.'),
    route: z.string().describe('Sub-route id.'),
    facetId: z.string().describe('Facet id, e.g. "fueltypeid" or "fuelId".'),
  }),
  execute: async ({ domain, route, facetId }: { domain: string; route: string; facetId: string }) =>
    asToolResult(await client.get(`/routes/${domain}/${route}/facet/${facetId}`)),
})

// ---------------------------------------------------------------------------
// Tool 8 — query_eia
// Raw query, useful for inspecting column shapes in unfamiliar domains.
// ---------------------------------------------------------------------------
export const queryEia = (client: McpClient) => ({
  description:
    'Execute an EIA data query and return raw rows. Use this to inspect the column shape of an unfamiliar domain before running query_with_summary. Pass domain + route plus optional DataParams.',
  inputSchema: z.object({
    domain: z.string().describe('Domain id.'),
    route: z.string().describe('Sub-route id.'),
    frequency: z.string().optional().describe('"annual" | "monthly" | "quarterly" | "weekly" | "daily".'),
    start: z.string().optional().describe('Start period, e.g. "2020" or "2020-01".'),
    end: z.string().optional().describe('End period, e.g. "2024" or "2024-12".'),
    facets: z
      .record(z.string(), z.array(z.string()))
      .optional()
      .describe('Facet filters, e.g. { fueltypeid: ["COL"] }.'),
    data: z.array(z.string()).optional().describe('Columns to return. Omit to get all columns.'),
    length: z.number().int().min(1).max(5000).optional().describe('Max rows (default 10 for inspection).'),
    sort: z
      .array(z.object({ column: z.string(), direction: z.enum(['asc', 'desc']) }))
      .optional(),
  }),
  execute: async (params: Record<string, unknown>) =>
    asToolResult(await client.post('/query', { length: 10, ...params })),
})

// ---------------------------------------------------------------------------
// Tool 9 — query_with_summary
// Compact per-series statistics for a query.
// ---------------------------------------------------------------------------
export const queryWithSummary = (client: McpClient) => ({
  description:
    'Run an EIA query and return compact per-series statistics. Always injects data:["value"] so numeric values are present. Each series entry has: description, units, periodRange, count, min, max, avg, latest {period, value}, and yoyChangePct. Series whose rows carry no unit get unitsMissing: true; pass requireUnits: true to fail instead. If bySeries is empty, the endpoint may use a different value column — fall back to query_eia to inspect the raw shape.',
  inputSchema: z.object({
    domain: z.string().describe('Domain id.'),
    route: z.string().describe('Sub-route id.'),
    frequency: z.string().optional().describe('"annual" | "monthly" | "quarterly".'),
    start: z.string().optional().describe('Start period.'),
    end: z.string().optional().describe('End period.'),
    facets: z
      .record(z.string(), z.array(z.string()))
      .optional()
      .describe('Facet filters, e.g. { fueltypeid: ["COL", "NG"] }.'),
    length: z.number().int().min(1).max(5000).optional().describe('Max rows (default 500).'),
    requireUnits: z
      .boolean()
      .optional()
      .describe('If true, error when any series has no units instead of returning it with unitsMissing: true.'),
  }),
  execute: async ({ requireUnits, ...params }: Record<string, unknown>) => {
    const body = { ...params, data: ['value'], length: (params['length'] as number) ?? 500 }
    const r = (await client.post('/query', body)) as { response?: { data?: RawEiaRow[] } }
    const rows = r.response?.data ?? []
    const summary = summarizeRows(String(params['route']), rows)
    const missing = summary.bySeries.filter((s) => s.unitsMissing).map((s) => s.series)
    if (requireUnits && missing.length > 0) {
      throw new Error(`query_with_summary: no units for series ${missing.join(', ')}`)
    }
    return asToolResult(summary)
  },
})
