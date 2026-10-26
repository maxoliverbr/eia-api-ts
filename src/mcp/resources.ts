/**
 * MCP resources exposed by the EIA wrapper. Both read the wrapper's own
 * `/guide` endpoint, which returns the full agent playbook generated from
 * the same domain metadata that powers `/domains`.
 *
 *   eia://guide                 — full server-wide playbook
 *   eia://guide/{domainId}      — domain slice (e.g. eia://guide/coal)
 */
import { ResourceTemplate, type McpServer } from '@modelcontextprotocol/server'
import type { McpClient } from './client'
import { getDomain } from '../domains'

export const guideResources = (client: McpClient) => ({
  full: {
    description: 'Full EIA agent playbook: workflow, decision tree, anti-patterns, copy-pasteable recipes. Generated from the same domain metadata that powers /domains.',
    read: async () => {
      const value = await client.get('/guide')
      return { contents: [{ uri: 'eia://guide', text: JSON.stringify(value, null, 2), mimeType: 'application/json' }] }
    },
  },
  perDomain: {
    description: 'Domain-specific guide slice: playbook, common queries, agent hints, taskToRoute, per-sub-route guidance.',
    read: async (uri: URL) => {
      const domain = uri.pathname.replace(/^\//, '')
      if (!getDomain(domain)) throw new Error(`Unknown domain in URI: eia://guide/${domain}`)
      const value = await client.get(`/guide/${domain}`)
      return { contents: [{ uri: uri.href, text: JSON.stringify(value, null, 2), mimeType: 'application/json' }] }
    },
  },
})

/**
 * The MCP resource templates exposed by the EIA wrapper. Call once at
 * server start to register both `eia://guide` (fixed) and
 * `eia://guide/{domainId}` (templated) with the McpServer.
 */
export function registerGuideResources(server: McpServer, client: McpClient): void {
  const r = guideResources(client)

  server.registerResource(
    'guide',
    'eia://guide',
    { description: r.full.description, mimeType: 'application/json' },
    async () => r.full.read(),
  )

  server.registerResource(
    'guide-domain',
    new ResourceTemplate('eia://guide/{domainId}', { list: undefined }),
    { description: r.perDomain.description, mimeType: 'application/json' },
    async (uri) => r.perDomain.read(uri),
  )
}
