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

  // 9 tools — build each tool object once, then register config + execute.
  const relations = tools.browseRelations(client)
  const classDetail = tools.getClassDetail(client)
  const domainMapping = tools.getDomainMapping(client)
  const relationEvidence = tools.getRelationEvidence(client)
  const ontologySearch = tools.searchOntology(client)
  const facets = tools.listFacets(client)
  const facetValues = tools.getFacetValues(client)
  const query = tools.queryEia(client)
  const querySummary = tools.queryWithSummary(client)
  server.registerTool('browse_relations', relations, relations.execute)
  server.registerTool('get_class_detail', classDetail, classDetail.execute)
  server.registerTool('get_domain_mapping', domainMapping, domainMapping.execute)
  server.registerTool('get_relation_evidence', relationEvidence, relationEvidence.execute)
  server.registerTool('search_ontology', ontologySearch, ontologySearch.execute)
  server.registerTool('list_facets', facets, facets.execute)
  server.registerTool('get_facet_values', facetValues, facetValues.execute)
  server.registerTool('query_eia', query, query.execute)
  server.registerTool('query_with_summary', querySummary, querySummary.execute)

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
