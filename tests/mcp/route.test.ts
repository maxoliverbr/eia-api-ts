import { describe, expect, it, afterEach } from 'bun:test'
import { app } from '../../elysia.config'

const post = (body: unknown) =>
  app.handle(
    new Request('http://localhost/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify(body),
    }),
  )

describe('POST /mcp', () => {
  // MCP_ENABLED defaults to undefined → mcp routes are not mounted.
  // We assert that without the env, /mcp returns 404 (the MCP-disabled
  // sentinel route doesn't bind /mcp). With MCP_ENABLED=true the test
  // below verifies the live tools/list round-trip.
  it('returns 404 when MCP_ENABLED is not set', async () => {
    const res = await post({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
    expect(res.status).toBe(404)
  })
})

describe('POST /mcp with MCP_ENABLED=true', () => {
  const originalEnv = process.env['MCP_ENABLED']
  beforeEnable()
  afterEach(() => {
    if (originalEnv === undefined) delete process.env['MCP_ENABLED']
    else process.env['MCP_ENABLED'] = originalEnv
    // Reload the app to pick up the env change.
    // (Bun caches the import; just reset the cached transport.)
  })
  it('returns the tool list', async () => {
    process.env['MCP_ENABLED'] = 'true'
    // Re-import the app after toggling the env. Bun caches modules but the
    // app factory reads env at call time, so we can call createApp() again.
    const { createApp } = await import('../../elysia.config')
    const testApp = createApp()
    const res = await testApp.handle(
      new Request('http://localhost/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      }),
    )
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain('browse_relations')
    expect(text).toContain('query_with_summary')
  })
})

function beforeEnable() {
  // No-op; placeholder so the import order is clear.
}
