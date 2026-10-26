import { describe, expect, it } from 'bun:test'
import { app } from '../elysia.config'

const get = (path: string) => app.handle(new Request(`http://localhost${path}`))

describe('routes (smoke)', () => {
  it('GET / returns API info', async () => {
    const res = await get('/')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe('EIA API for Agents')
    expect(body.endpoints.domains).toBe('/domains')
  })

  it('GET /domains returns 15 domains', async () => {
    const res = await get('/domains')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.domains.length).toBe(15)
  })

  it('GET /domains/coal returns coal metadata', async () => {
    const res = await get('/domains/coal')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('coal')
    expect(body.subRoutes.length).toBeGreaterThan(0)
  })

  it('GET /domains/nope returns 404', async () => {
    const res = await get('/domains/nope')
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('domain_not_found')
  })

  it('POST /search returns hits for "coal"', async () => {
    const res = await app.handle(
      new Request('http://localhost/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: 'coal' }),
      })
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.hits.length).toBeGreaterThan(0)
    expect(body.hits[0].domain).toBe('coal')
  })

  it('POST /search validation rejects empty q', async () => {
    const res = await app.handle(
      new Request('http://localhost/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: '' }),
      })
    )
    // Elysia returns 422 for body validation by default
    expect([400, 422]).toContain(res.status)
  })

  it('POST /query validation rejects unknown domain', async () => {
    const res = await app.handle(
      new Request('http://localhost/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: 'nope', route: 'x', frequency: 'annual' }),
      })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('validation_error')
  })
})
