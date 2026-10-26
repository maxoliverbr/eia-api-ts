/**
 * MCP server for the EIA API for Agents wrapper.
 *
 * Exposes:
 *   - 9 tools  (browse_relations, get_class_detail, get_domain_mapping,
 *               get_relation_evidence, search_ontology, list_facets,
 *               get_facet_values, query_eia, query_with_summary)
 *   - 2 resources (eia://guide, eia://guide/{domainId})
 *
 * Dispatches to the wrapper's own REST routes in-process. The EIA API key
 * never leaves the upstream server.
 */
import { McpServer, createMcpHandler } from '@modelcontextprotocol/server'
import pkg from '../../package.json' with { type: 'json' }
import * as tools from './tools'
import { registerGuideResources } from './resources'
import type { McpClient } from './client'

const TOOLS = {
  browse_relations: tools.browseRelations,
  get_class_detail: tools.getClassDetail,
  get_domain_mapping: tools.getDomainMapping,
  get_relation_evidence: tools.getRelationEvidence,
  search_ontology: tools.searchOntology,
  list_facets: tools.listFacets,
  get_facet_values: tools.getFacetValues,
  query_eia: tools.queryEia,
  query_with_summary: tools.queryWithSummary,
}

export function buildMcp(client: McpClient): McpServer {
  const server = new McpServer(
    {
      name: 'eia-api-ts',
      version: pkg.version,
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
      instructions:
        'EIA (U.S. Energy Information Administration) API for AI agents. ' +
        'Tools cover the full discovery → query loop: search datasets, ' +
        'inspect domain metadata, browse the EIA energy ontology, list ' +
        'facets, resolve facet values, and run data queries. ' +
        'Resources expose the agent playbook at eia://guide and per-domain ' +
        'slices at eia://guide/{domainId}.',
    },
  )

  // 9 tools
  for (const [name, make] of Object.entries(TOOLS)) {
    const tool = make(client)
    // Each tool pairs its own inputSchema with its execute; the union of all
    // nine doesn't fit registerTool's per-schema generics, so erase it here.
    server.registerTool(name, tool as never, tool.execute as never)
  }

  // 2 resources
  registerGuideResources(server, client)

  return server
}

/**
 * Web-standard `{ fetch }` handler. The SDK builds a fresh server per
 * request from the factory, serving 2026-07-28 clients natively and
 * 2025-era clients (initialize handshake) statelessly.
 */
export const createHandler = (client: McpClient) => createMcpHandler(() => buildMcp(client))
