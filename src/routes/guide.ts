/**
 * GET /guide           — full agent playbook
 * GET /guide/:domain   — domain-specific guide
 *
 * The guide is a machine-readable document that an agent can fetch once and
 * then use as a system-prompt / tool-selection reference. It is generated
 * from the static `AGENT_GUIDE` content below plus the live domain
 * metadata in `src/domains/*`, so it never drifts from the data model.
 *
 * There is intentionally no caching here: the document is small and
 * trivially reconstructed from in-memory data.
 */
import { Elysia, t, type Static } from 'elysia'
import { DOMAINS, getDomain } from '../domains'
import { DomainGuideSchema, GuideResponseSchema } from '../schemas/guide'
import { DomainIdSchema } from '../schemas/primitives'

// ---------------------------------------------------------------------------
// Static content (hand-curated, versioned with the server)
// ---------------------------------------------------------------------------

/**
 * The canonical multi-step agent workflow. Edit this when the recommended
 * flow changes; downstream tools and examples pick it up automatically.
 */
const WORKFLOW = {
  title: 'Find data and fetch it',
  description:
    'The recommended agent flow for almost every energy-data task. Run the steps in order; later steps depend on what earlier steps taught you.',
  steps: [
    {
      step: 1,
      name: 'Search by intent',
      method: 'POST',
      path: '/search',
      body: { q: '<keywords, e.g. "natural gas price">' },
      whatYouLearn: 'Which domain(s) and sub-route(s) match the user intent. Use this to avoid hardcoded knowledge.',
      next: 'Step 2 with the matched domain id',
    },
    {
      step: 2,
      name: 'Inspect the domain',
      method: 'GET',
      path: '/domains/:domain',
      whatYouLearn:
        'A complete list of sub-routes for the domain, with summaries, descriptions, and exampleQuery templates. Pick the right sub-route id.',
      next: 'Step 3 with the chosen sub-route id',
    },
    {
      step: 3,
      name: 'List facets',
      method: 'GET',
      path: '/routes/:domain/:route/facet',
      whatYouLearn: 'The set of facet ids you can filter on (e.g. stateId, sectorId, fueltypeid).',
      next: 'Step 4 with one or more facet ids',
    },
    {
      step: 4,
      name: 'Resolve facet values',
      method: 'GET',
      path: '/routes/:domain/:route/facet/:facetId',
      whatYouLearn: 'The valid ids for a facet, paired with human-readable names. Pick the ids you want to filter on.',
      next: 'Step 5 with the resolved ids',
    },
    {
      step: 5,
      name: 'Query',
      method: 'POST',
      path: '/query',
      body: {
        domain: '<from step 2>',
        route: '<from step 2>',
        frequency: '<annual|monthly|weekly|daily|...>',
        start: '<period, e.g. "2020" or "2024-01-01">',
        end: '<period>',
        data: ['<column names you want>'],
        facets: { '<facetId>': ['<ids from step 4>'] },
        sort: [{ column: 'period', direction: 'asc' }],
        length: 100,
      },
      whatYouLearn: 'The actual data rows. Each row is a free-form object — read the `description` field of the response for column meanings.',
    },
  ],
} as const

const PHILOSOPHY = [
  'Never hardcode a sub-route id; look it up via /search or /domains first.',
  'The /query body shape is identical for every domain. Domain-specific knowledge lives in the per-domain metadata, not in /query itself.',
  'Facet values are ids, not display names. Always resolve them via /routes/.../facet/:id before filtering.',
  'frequency is a lowercase string ("annual", "monthly", "weekly", "daily", "hourly", "event"). Wrong values return an upstream error.',
  'Pagination: cap a single request with `length` (≤ 5000), then paginate with `offset`.',
  'Read /guide first — this document is generated from the same source of truth as /domains, so it stays in sync.',
  'For conceptual questions ("what produces electricity?", "which datasets are comparable?"), start at GET /ontology/search — the ontology links energy concepts to domains, runnable queries, and facet codes.',
]

const ANTI_PATTERNS = [
  {
    pattern: 'Guessing sub-route ids from memory',
    why: 'Upstream route ids change, and some domains use non-default namespaces (e.g. rto lives under electricity/rto/...).',
    instead: 'Call POST /search or GET /domains to discover the right id at runtime.',
  },
  {
    pattern: 'Using display names as facet values',
    why: 'Most facets expect ids like "SCA" or "NG", not "Southern California" or "Natural Gas".',
    instead: 'Call GET /routes/.../facet/:id and use the returned `id` field.',
  },
  {
    pattern: 'Hitting one giant query with no facets and no sort',
    why: 'You\'ll get unsorted, unfiltered rows that cross every state and sector — expensive and useless.',
    instead: 'Always start by listing facets, then narrow your query with `facets` and add a `sort` to get a stable series.',
  },
  {
    pattern: 'Forgetting that some sub-routes have unusual frequencies',
    why: 'The natural-gas weekly storage route (stor/wkly) only supports frequency=weekly. Asking for monthly returns a 400 from upstream.',
    instead: 'Read the `exampleQuery` and `agentGuidance` fields on the sub-route metadata before querying.',
  },
  {
    pattern: 'Tightly coupling to a single schema version',
    why: 'Upstream EIA occasionally renames or deprecates columns. Hardcoded assumptions break silently.',
    instead: 'Use the wrapper\'s typed client and read response `description` to confirm column meanings.',
  },
  {
    pattern: 'Ignoring the data `units` column',
    why: 'Numeric values are unitless without it. "value" in coal means short tons; in natural gas it means dollars per thousand cubic feet.',
    instead: 'Always include "units" in your `data` array, or use a domain-specific commonQuery recipe.',
  },
] as const

const COMMON_RECIPES = [
  {
    name: 'List every available domain',
    description: 'Get the catalogue of all 15 EIA domains with rich metadata.',
    method: 'GET',
    path: '/domains',
    expected: '{ domains: DomainMeta[] } (length 15)',
  },
  {
    name: 'Get one domain in full',
    description: 'Inspect all sub-routes, example queries, and tags for a single domain.',
    method: 'GET',
    path: '/domains/coal',
    expected: 'DomainMeta object with subRoutes[]',
  },
  {
    name: 'Search by free-text intent',
    description: 'Find a dataset when you don\'t know its id.',
    method: 'POST',
    path: '/search',
    body: { q: 'natural gas price', limit: 5 },
    expected: '{ query, total, hits[] }',
  },
  {
    name: 'List facets for a route',
    description: 'See which dimensions you can filter on.',
    method: 'GET',
    path: '/routes/coal/aggregate-production/facet',
    expected: '{ response: { facetOptions: string[] } }',
  },
  {
    name: 'Read the full agent guide',
    description: 'Fetch this document — the single best source of truth for how to use the API.',
    method: 'GET',
    path: '/guide',
    expected: 'GuideResponse (this document)',
  },
  {
    name: 'Relation → runnable queries',
    description: 'Turn an ontology relation into copy-pasteable POST /query bodies.',
    method: 'GET',
    path: '/ontology/relations/coal-produces-electricity/evidence',
    expected: '{ relation, evidence: [{ domainId, mapping, commonQueries[], subRoutes[], facetBindings[] }] }',
  },
  {
    name: 'POST /query — minimal example',
    description: 'Fetch a small slice of data.',
    method: 'POST',
    path: '/query',
    body: { domain: 'coal', route: 'aggregate-production', frequency: 'annual', start: '2020', end: '2024' },
    expected: '{ response: { data: Row[], total: number } }',
  },
] as const

// ---------------------------------------------------------------------------
// Hand-curated decision tree (intent → ordered endpoints)
// ---------------------------------------------------------------------------

type Intent = { intent: string; path: readonly string[] }
const DECISION_TREE: readonly Intent[] = [
  {
    intent: 'Find a dataset that mentions a topic',
    path: ['POST /search { q: "<topic>" }', 'GET /domains/<matched-id>'],
  },
  {
    intent: 'Inspect what a domain contains',
    path: ['GET /domains/<domain>'],
  },
  {
    intent: 'See which facets a route supports',
    path: ['GET /routes/<domain>/<route>/facet'],
  },
  {
    intent: 'Resolve a facet value (e.g. state name → id)',
    path: ['GET /routes/<domain>/<route>/facet/<facetId>'],
  },
  {
    intent: 'Get the data',
    path: [
      'POST /query { domain, route, frequency, start, end, facets, data, sort, length }',
    ],
  },
  {
    intent: 'Look up the upstream EIA FinalRoute (column metadata)',
    path: ['GET /schema/<domain>/<route>'],
  },
  {
    intent: 'Understand how two energy concepts relate (e.g. coal → CO2)',
    path: [
      'GET /ontology/search?q=<concept>',
      'GET /ontology/paths?from=<ClassA>&to=<ClassB>',
      'GET /ontology/relations/<relationId>/evidence',
    ],
  },
  {
    intent: 'Find datasets that can be compared for a concept',
    path: ['GET /ontology/classes/<ClassId>/comparability', 'POST /query per matched domain'],
  },
  {
    intent: 'Get this guide',
    path: ['GET /guide (or GET /guide/<domain> for a domain slice)'],
  },
]

// ---------------------------------------------------------------------------
// Response builders
// ---------------------------------------------------------------------------

type GuideResponse = Static<typeof GuideResponseSchema>

const buildFullGuide = (): GuideResponse => ({
  version: '1.0.0',
  generatedAt: new Date().toISOString(),
  summary:
    'eia-api-ts is a typed wrapper around the EIA APIv2. It exposes 15 energy-data domains, a single uniform POST /query endpoint, and a self-describing discovery layer (/domains, /routes, /search). Fetch this document once, then drive the API from it.',
  philosophy: [...PHILOSOPHY],
  workflow: { ...WORKFLOW, steps: [...WORKFLOW.steps] },
  decisionTree: DECISION_TREE.map((d) => ({ intent: d.intent, path: [...d.path] })),
  antiPatterns: ANTI_PATTERNS.map((a) => ({ ...a })),
  commonRecipes: COMMON_RECIPES.map((r) => ({ ...r })),
  domains: DOMAINS.map((d) => ({
    id: d.id,
    name: d.name,
    useCases: [...d.useCases],
    hasPlaybook: d.playbook != null,
    hasCommonQueries: d.commonQueries != null && d.commonQueries.length > 0,
    hasAgentHints: d.agentHints != null,
  })),
  endpoints: {
    root: '/',
    domains: '/domains',
    domainDetail: '/domains/:domain',
    search: '/search',
    facets: '/routes/:domain/:route/facet',
    facetValues: '/routes/:domain/:route/facet/:facetId',
    query: '/query',
    openapi: '/openapi',
    openapiJson: '/openapi/json',
  },
  related: {
    openapiSpec: '/openapi/json',
    examplesIndex: 'https://github.com/maxoliverbr/eia-api-ts/tree/main/examples',
  },
})

type DomainGuide = Static<typeof DomainGuideSchema>

const buildDomainGuide = (id: string): DomainGuide | null => {
  const d = getDomain(id)
  if (!d) return null
  return {
    id: d.id,
    name: d.name,
    description: d.description,
    tags: [...d.tags],
    useCases: [...d.useCases],
    ...(d.playbook
      ? { playbook: { steps: d.playbook.steps.map((s) => ({ ...s })) } }
      : {}),
    ...(d.commonQueries
      ? {
          commonQueries: d.commonQueries.map((q) => ({
            name: q.name,
            description: q.description,
            params: q.params,
            ...(q.expectedShape ? { expectedShape: q.expectedShape } : {}),
          })),
        }
      : {}),
    ...(d.agentHints
      ? {
          agentHints: {
            warnings: [...d.agentHints.warnings],
            gotchas: [...d.agentHints.gotchas],
            ...(d.agentHints.seeAlso ? { seeAlso: [...d.agentHints.seeAlso] } : {}),
          },
        }
      : {}),
    ...(d.taskToRoute ? { taskToRoute: { ...d.taskToRoute } } : {}),
    subRoutes: d.subRoutes.map((s) => ({
      id: s.id,
      path: s.path,
      summary: s.summary,
      ...(s.agentGuidance ? { agentGuidance: s.agentGuidance } : {}),
      ...(s.facetsHint ? { facetsHint: [...s.facetsHint] } : {}),
      exampleQuery: s.exampleQuery,
    })),
  }
}

// ---------------------------------------------------------------------------
// Route module
// ---------------------------------------------------------------------------

const notFound = (id: string) => ({
  error: 'guide_domain_not_found' as const,
  message: `No domain registered with id "${id}". Available: ${DOMAINS.map((d) => d.id).join(', ')}.`,
})

export const guideRoutes = new Elysia({ tags: ['Guide'] })
  // -------------------------------------------------------------------------
  // GET /guide
  // -------------------------------------------------------------------------
  .get(
    '/guide',
    () => buildFullGuide(),
    {
      detail: {
        summary: 'Agent guide (full)',
        description:
          'Returns a self-contained, machine-readable agent playbook for the entire API. Fetch this once at the start of a session and use it as a system-prompt / tool-selection reference. Generated from the same domain metadata that powers /domains, so it never drifts from the data model.\n\nSee `/guide/:domain` for a domain-specific slice.',
        tags: ['Guide'],
      },
      response: GuideResponseSchema,
    }
  )
  // -------------------------------------------------------------------------
  // GET /guide/:domain
  // -------------------------------------------------------------------------
  .get(
    '/guide/:domain',
    ({ params, status }) => {
      const g = buildDomainGuide(params.domain)
      if (!g) return status(404, notFound(params.domain))
      return g
    },
    {
      params: t.Object({ domain: DomainIdSchema }),
      detail: {
        summary: 'Agent guide (domain-specific)',
        description:
          'Returns the guide filtered to a single domain: playbook, common queries, agent hints, taskToRoute, and per-sub-route guidance. Use this when the agent has already decided which domain to query.',
        tags: ['Guide'],
      },
      response: {
        200: DomainGuideSchema,
        404: t.Object({
          error: t.Literal('guide_domain_not_found'),
          message: t.String(),
        }),
      },
    }
  )
