import { describe, expect, it, beforeEach } from 'bun:test'
import {
  browseRelations,
  getClassDetail,
  getDomainMapping,
  listFacets,
  getFacetValues,
  queryEia,
  queryWithSummary,
} from '../../src/mcp/tools'
import { McpClient } from '../../src/mcp/client'

/** A mock fetch that records the calls and returns scripted responses. */
function mockFetch(responses: Array<{ status: number; body: string }>) {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  let i = 0
  const fn = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init })
    const r = responses[i] ?? responses[responses.length - 1]!
    i++
    return new Response(r.body, { status: r.status, headers: { 'Content-Type': 'application/json' } })
  }) as unknown as typeof fetch
  return Object.assign(fn, { calls }) as typeof fetch & { calls: typeof calls }
}

function makeClient(fetchImpl: typeof fetch): McpClient {
  return new McpClient({ baseUrl: 'http://test', fetchImpl })
}

beforeEach(() => {
  // Reset the throttle between tests
})

describe('MCP tools', () => {
  it('browse_relations builds query string and returns MCP content', async () => {
    const fetch = mockFetch([{ status: 200, body: '{"relations":[]}' }])
    const client = makeClient(fetch)
    const t = browseRelations(client)
    const r = await t.execute({ subject: 'Coal', predicate: 'emits' })
    expect(fetch.calls[0]?.url).toBe('http://test/ontology/relations?subject=Coal&predicate=emits')
    expect(r.content[0]?.type).toBe('text')
    expect(JSON.parse((r.content[0] as { text: string }).text)).toEqual({ relations: [] })
  })

  it('get_class_detail hits /ontology/classes/:id', async () => {
    const fetch = mockFetch([{ status: 200, body: '{"class":{}}' }])
    const t = getClassDetail(makeClient(fetch))
    await t.execute({ classId: 'Coal' })
    expect(fetch.calls[0]?.url).toBe('http://test/ontology/classes/Coal')
  })

  it('get_domain_mapping hits /ontology/domains/:id', async () => {
    const fetch = mockFetch([{ status: 200, body: '{}' }])
    const t = getDomainMapping(makeClient(fetch))
    await t.execute({ domainId: 'coal' })
    expect(fetch.calls[0]?.url).toBe('http://test/ontology/domains/coal')
  })

  it('list_facets hits /routes/:domain/:route/facet', async () => {
    const fetch = mockFetch([{ status: 200, body: '[]' }])
    const t = listFacets(makeClient(fetch))
    await t.execute({ domain: 'electricity', route: 'electric-power-operational-data' })
    expect(fetch.calls[0]?.url).toBe('http://test/routes/electricity/electric-power-operational-data/facet')
  })

  it('get_facet_values hits /routes/:domain/:route/facet/:facetId', async () => {
    const fetch = mockFetch([{ status: 200, body: '[]' }])
    const t = getFacetValues(makeClient(fetch))
    await t.execute({ domain: 'electricity', route: 'electric-power-operational-data', facetId: 'fueltypeid' })
    expect(fetch.calls[0]?.url).toBe(
      'http://test/routes/electricity/electric-power-operational-data/facet/fueltypeid',
    )
  })

  it('query_eia POSTs to /query with default length 10', async () => {
    const fetch = mockFetch([{ status: 200, body: '{"response":{"data":[]}}' }])
    const t = queryEia(makeClient(fetch))
    await t.execute({ domain: 'coal', route: 'aggregate-production', frequency: 'annual' })
    expect(fetch.calls[0]?.init?.method).toBe('POST')
    expect(fetch.calls[0]?.url).toBe('http://test/query')
    const body = JSON.parse(String(fetch.calls[0]?.init?.body))
    expect(body.domain).toBe('coal')
    expect(body.route).toBe('aggregate-production')
    expect(body.length).toBe(10)
  })

  it('query_with_summary injects data:["value"] and summarises', async () => {
    const fetch = mockFetch([
      {
        status: 200,
        body: JSON.stringify({
          response: {
            data: [
              { period: '2020', value: 100, series: 'A', units: 'Btu', 'series-description': 'Series A' },
              { period: '2021', value: 110, series: 'A', units: 'Btu', 'series-description': 'Series A' },
            ],
          },
        }),
      },
    ])
    const t = queryWithSummary(makeClient(fetch))
    const r = (await t.execute({ domain: 'coal', route: 'r', frequency: 'annual' })) as {
      content: Array<{ type: string; text: string }>
    }
    const body = JSON.parse(String(fetch.calls[0]?.init?.body))
    expect(body.data).toEqual(['value'])
    const summary = JSON.parse(r.content[0]!.text)
    expect(summary.route).toBe('r')
    expect(summary.bySeries.length).toBe(1)
    expect(summary.bySeries[0].min).toBe(100)
    expect(summary.bySeries[0].max).toBe(110)
    expect(summary.bySeries[0].yoyChangePct).toBeCloseTo(10, 5)
  })
})
