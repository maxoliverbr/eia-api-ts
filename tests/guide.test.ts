import { describe, expect, it } from 'bun:test'
import { Value } from '@sinclair/typebox/value'
import { app } from '../elysia.config'
import { GuideResponseSchema, DomainGuideSchema } from '../src/schemas/guide'
import { DomainMetaSchema } from '../src/schemas/domain'
import { getDomain } from '../src/domains'

const get = (path: string) => app.handle(new Request(`http://localhost${path}`))

describe('GET /guide', () => {
  it('returns 200 and validates against GuideResponseSchema', async () => {
    const res = await get('/guide')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Value.Check(GuideResponseSchema, body)).toBe(true)
  })

  it('has all the required top-level sections', async () => {
    const res = await get('/guide')
    const body = await res.json()
    expect(typeof body.version).toBe('string')
    expect(typeof body.generatedAt).toBe('string')
    expect(typeof body.summary).toBe('string')
    expect(Array.isArray(body.philosophy)).toBe(true)
    expect(body.philosophy.length).toBeGreaterThan(0)
    expect(body.workflow).toBeDefined()
    expect(Array.isArray(body.workflow.steps)).toBe(true)
    expect(body.workflow.steps.length).toBeGreaterThanOrEqual(3)
    expect(Array.isArray(body.decisionTree)).toBe(true)
    expect(body.decisionTree.length).toBeGreaterThan(0)
    expect(Array.isArray(body.antiPatterns)).toBe(true)
    expect(body.antiPatterns.length).toBeGreaterThan(0)
    expect(Array.isArray(body.commonRecipes)).toBe(true)
    expect(body.commonRecipes.length).toBeGreaterThan(0)
    expect(Array.isArray(body.domains)).toBe(true)
    expect(body.domains.length).toBe(15)
    expect(body.endpoints).toBeDefined()
    expect(body.endpoints.guide).toBeUndefined() // /guide doesn't reference itself
  })

  it('workflow steps are numbered sequentially', async () => {
    const res = await get('/guide')
    const body = await res.json()
    const steps = body.workflow.steps
    for (let i = 0; i < steps.length; i++) {
      expect(steps[i].step).toBe(i + 1)
      expect(typeof steps[i].name).toBe('string')
      expect(typeof steps[i].method).toBe('string')
      expect(typeof steps[i].path).toBe('string')
      expect(typeof steps[i].whatYouLearn).toBe('string')
    }
  })

  it('decision tree points agents at the ontology', async () => {
    const res = await get('/guide')
    const body = await res.json()
    const paths = body.decisionTree.flatMap((d: { path: string[] }) => d.path)
    expect(paths.some((p: string) => p.includes('/ontology'))).toBe(true)
  })

  it('domains summary reflects hasPlaybook for at least one domain', async () => {
    const res = await get('/guide')
    const body = await res.json()
    const coal = body.domains.find((d: { id: string }) => d.id === 'coal')
    expect(coal).toBeDefined()
    expect(coal.hasPlaybook).toBe(true)
    expect(coal.hasCommonQueries).toBe(true)
    expect(coal.hasAgentHints).toBe(true)
  })
})

describe('GET /guide/:domain', () => {
  it('returns 200 for coal and validates against DomainGuideSchema', async () => {
    const res = await get('/guide/coal')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Value.Check(DomainGuideSchema, body)).toBe(true)
    expect(body.id).toBe('coal')
    expect(body.name).toBe('Coal')
  })

  it('inlines playbook, commonQueries, agentHints, taskToRoute for coal', async () => {
    const res = await get('/guide/coal')
    const body = await res.json()
    expect(body.playbook).toBeDefined()
    expect(body.playbook.steps.length).toBeGreaterThan(0)
    expect(body.commonQueries).toBeDefined()
    expect(body.commonQueries.length).toBeGreaterThan(0)
    expect(body.agentHints).toBeDefined()
    expect(body.agentHints.warnings.length).toBeGreaterThan(0)
    expect(body.agentHints.gotchas.length).toBeGreaterThan(0)
    expect(body.taskToRoute).toBeDefined()
    expect(body.taskToRoute['state coal production']).toBe('aggregate-production')
  })

  it('subRoutes include agentGuidance for at least one sub-route', async () => {
    const res = await get('/guide/coal')
    const body = await res.json()
    const withGuidance = body.subRoutes.find((s: { agentGuidance?: string }) => !!s.agentGuidance)
    expect(withGuidance).toBeDefined()
  })

  it('returns 404 for an unknown domain', async () => {
    const res = await get('/guide/nope')
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('guide_domain_not_found')
  })
})

describe('GET /domains (extended) — agent context fields are optional', () => {
  it('DomainMetaSchema validates a domain with all new fields filled in', () => {
    const coal = getDomain('coal')!
    expect(Value.Check(DomainMetaSchema, coal)).toBe(true)
  })

  it('DomainMetaSchema still validates a domain without the new fields', () => {
    // A trimmed, minimal DomainMeta with no playbook/commonQueries/agentHints/taskToRoute
    const minimal = {
      id: 'fake',
      name: 'Fake',
      description: 'A minimal domain for testing optional fields.',
      tags: [],
      useCases: [],
      subRoutes: [],
    }
    // We don't cast id to the branded DomainId type here; that's a TS concern,
    // not a runtime one, so the runtime schema check is the right test.
    expect(Value.Check(DomainMetaSchema, minimal as unknown as Parameters<typeof Value.Check>[0])).toBe(true)
  })

  it('GET /domains returns the new agent-context fields when present', async () => {
    const res = await get('/domains')
    const body = await res.json()
    const coal = body.domains.find((d: { id: string }) => d.id === 'coal')
    expect(coal).toBeDefined()
    expect(coal.playbook).toBeDefined()
    expect(coal.commonQueries).toBeDefined()
    expect(coal.agentHints).toBeDefined()
    expect(coal.taskToRoute).toBeDefined()
  })

  it('GET /domains/coal returns columnDescriptions on the aggregate-production sub-route', async () => {
    const res = await get('/domains/coal')
    const body = await res.json()
    const agg = body.subRoutes.find((s: { id: string }) => s.id === 'aggregate-production')
    expect(agg).toBeDefined()
    expect(agg.columnDescriptions).toBeDefined()
    expect(agg.columnDescriptions['production'].toLowerCase()).toContain('short tons')
    expect(agg.prerequisites).toBeDefined()
    expect(agg.prerequisites.apiCalls).toContain('GET /routes/coal/aggregate-production/facet')
  })
})

describe('GET / (root) — advertises /guide', () => {
  it('exposes a `guide` endpoint pointer', async () => {
    const res = await get('/')
    const body = await res.json()
    expect(body.endpoints.guide).toBe('/guide')
    expect(body.quickStart.readGuide).toBe('GET /guide')
  })
})
