import { describe, expect, it } from 'bun:test'
import { Client, StreamableHTTPClientTransport, type VersionNegotiationMode } from '@modelcontextprotocol/client'
import { createApp } from '../../elysia.config'
import { McpClient } from '../../src/mcp/client'
import { createHandler } from '../../src/mcp'

// End-to-end over the real SDK client, pinned to each protocol era. The EIA
// REST calls are stubbed so the guide resource read stays offline.
const stub = new McpClient({ fetchImpl: (async () => Response.json({ summary: 'stub guide' })) as unknown as typeof fetch })
const handler = createHandler(stub)

const connect = async (mode: VersionNegotiationMode) => {
  const client = new Client({ name: 'test', version: '0' }, { versionNegotiation: { mode } })
  const transport = new StreamableHTTPClientTransport(new URL('http://localhost/mcp'), {
    fetch: (input, init) => handler.fetch(new Request(input, init)),
  })
  await client.connect(transport)
  return client
}

const eras: [string, VersionNegotiationMode, RegExp][] = [
  ['2026-07-28', { pin: '2026-07-28' }, /^2026-07-28$/],
  ['2025 legacy', 'legacy', /^2025-/],
]

for (const [era, mode, expected] of eras) {
  describe(`MCP over ${era}`, () => {
    it('lists all 9 tools and reads eia://guide', async () => {
      const client = await connect(mode)
      expect(client.getNegotiatedProtocolVersion()).toMatch(expected)
      const { tools } = await client.listTools()
      expect(tools).toHaveLength(9)
      expect(tools.map((t) => t.name)).toContain('query_with_summary')
      const res = await client.readResource({ uri: 'eia://guide' })
      expect(JSON.stringify(res.contents)).toContain('stub guide')
      await client.close()
    })
  })
}

describe('MCP route wiring', () => {
  it('serves /mcp through Elysia when MCP_ENABLED=true', async () => {
    const prev = process.env['MCP_ENABLED']
    process.env['MCP_ENABLED'] = 'true'
    const app = createApp()
    if (prev === undefined) delete process.env['MCP_ENABLED']
    else process.env['MCP_ENABLED'] = prev
    const res = await app.handle(
      new Request('http://localhost/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } },
        }),
      }),
    )
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('eia-api-ts')
  })
})
