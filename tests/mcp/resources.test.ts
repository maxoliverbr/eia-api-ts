import { describe, expect, it } from 'bun:test'
import { guideResources } from '../../src/mcp/resources'
import { McpClient } from '../../src/mcp/client'

function mockFetch(responses: Array<{ status: number; body: string }>) {
  const calls: Array<{ url: string }> = []
  let i = 0
  const fn = (async (url: string | URL | Request) => {
    calls.push({ url: String(url) })
    const r = responses[i] ?? responses[responses.length - 1]!
    i++
    return new Response(r.body, { status: r.status, headers: { 'Content-Type': 'application/json' } })
  }) as unknown as typeof fetch
  return Object.assign(fn, { calls }) as typeof fetch & { calls: typeof calls }
}

describe('MCP guide resources', () => {
  it('full guide is fetched', async () => {
    const fetch = mockFetch([{ status: 200, body: '{"version":"1.0.0","philosophy":[]}' }])
    const r = guideResources(new McpClient({ baseUrl: 'http://test', fetchImpl: fetch }))
    const out = await r.full.read()
    expect(fetch.calls.length).toBe(1)
    expect(fetch.calls[0]?.url).toBe('http://test/guide')
    expect(out.contents[0]?.uri).toBe('eia://guide')
    expect(JSON.parse(out.contents[0]!.text)).toEqual({ version: '1.0.0', philosophy: [] })
  })

  it('per-domain guide resolves the path segment', async () => {
    const fetch = mockFetch([{ status: 200, body: '{"id":"coal"}' }])
    const r = guideResources(new McpClient({ baseUrl: 'http://test', fetchImpl: fetch }))
    const out = await r.perDomain.read(new URL('eia://guide/coal'))
    expect(fetch.calls[0]?.url).toBe('http://test/guide/coal')
    expect(out.contents[0]?.uri).toBe('eia://guide/coal')
    expect(JSON.parse(out.contents[0]!.text)).toEqual({ id: 'coal' })
  })

  it('rejects unknown or traversal domain ids without fetching', async () => {
    const fetch = mockFetch([{ status: 200, body: '{}' }])
    const r = guideResources(new McpClient({ baseUrl: 'http://test', fetchImpl: fetch }))
    await expect(r.perDomain.read(new URL('eia://guide/a1\\..\\..\\ontology\\graph'))).rejects.toThrow('Unknown domain')
    await expect(r.perDomain.read(new URL('eia://guide/not-a-domain'))).rejects.toThrow('Unknown domain')
    expect(fetch.calls.length).toBe(0)
  })
})

describe('McpClient path guard', () => {
  it('rejects backslashes and dot segments', async () => {
    const fetch = mockFetch([{ status: 200, body: '{}' }])
    const c = new McpClient({ baseUrl: 'http://test', fetchImpl: fetch })
    await expect(c.get('/ontology/classes/a\\..\\..\\guide')).rejects.toThrow('Invalid path')
    await expect(c.get('/routes/coal/../../guide/facet')).rejects.toThrow('Invalid path')
    await c.get('/routes/coal/shipments/by-mine-by-plant/facet')
    expect(fetch.calls.length).toBe(1)
  })
})
