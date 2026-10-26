/**
 * Schemas for the `/guide` endpoint — the machine-readable agent manual.
 *
 * The guide is a self-contained document that an agent can fetch once and
 * then use as a system-prompt or tool-selection reference. It's generated
 * from the static `AGENT_GUIDE` content + the live domain metadata in
 * `src/domains/*`, so it never drifts from the data model.
 */
import { t, type Static } from 'elysia'
import { DomainIdSchema } from './primitives'

// ---------------------------------------------------------------------------
// WorkflowStep
// ---------------------------------------------------------------------------

export const WorkflowStepSchema = t.Object({
  step: t.Integer({ minimum: 1, description: '1-indexed step number.' }),
  name: t.String({ description: 'Short step name, e.g. "Search".' }),
  method: t.String({ description: 'HTTP method, e.g. "POST" or "GET".' }),
  path: t.String({ description: 'Path template, e.g. "/domains/:id".' }),
  body: t.Optional(t.Any({ description: 'Example request body for POST steps.' })),
  whatYouLearn: t.String({ description: 'What the agent learns from this call.' }),
  next: t.Optional(t.String({ description: 'Pointer to the next step.' })),
})
export type WorkflowStep = Static<typeof WorkflowStepSchema>

// ---------------------------------------------------------------------------
// DecisionTree
// ---------------------------------------------------------------------------

export const DecisionTreeNodeSchema = t.Object({
  question: t.String({ description: 'A natural-language branching question.' }),
  yes: t.Optional(t.String({ description: 'What to do if the answer is yes.' })),
  no: t.Optional(t.String({ description: 'What to do if the answer is no.' })),
  endpoint: t.Optional(
    t.String({ description: 'Optional direct endpoint suggestion if the branch resolves to a single call.' })
  ),
})

// ---------------------------------------------------------------------------
// AntiPattern
// ---------------------------------------------------------------------------

export const AntiPatternSchema = t.Object({
  pattern: t.String({ description: 'The bad pattern in natural language.' }),
  why: t.String({ description: 'Why it fails or is sub-optimal.' }),
  instead: t.String({ description: 'What the agent should do instead.' }),
})
export type AntiPattern = Static<typeof AntiPatternSchema>

// ---------------------------------------------------------------------------
// CommonRecipe (server-wide, cross-domain)
// ---------------------------------------------------------------------------

export const CommonRecipeSchema = t.Object({
  name: t.String(),
  description: t.String(),
  method: t.String(),
  path: t.String(),
  body: t.Optional(t.Any()),
  expected: t.Optional(t.String()),
})
export type CommonRecipe = Static<typeof CommonRecipeSchema>

// ---------------------------------------------------------------------------
// Per-domain guide (returned by /guide/:domain)
// ---------------------------------------------------------------------------

export const DomainGuideSchema = t.Object({
  id: DomainIdSchema,
  name: t.String(),
  description: t.String(),
  tags: t.Array(t.String()),
  useCases: t.Array(t.String()),
  playbook: t.Optional(
    t.Object({
      steps: t.Array(
        t.Object({
          goal: t.String(),
          route: t.String(),
          why: t.String(),
        })
      ),
    })
  ),
  commonQueries: t.Optional(
    t.Array(
      t.Object({
        name: t.String(),
        description: t.String(),
        params: t.Any(),
        expectedShape: t.Optional(t.String()),
      })
    )
  ),
  agentHints: t.Optional(
    t.Object({
      warnings: t.Array(t.String()),
      gotchas: t.Array(t.String()),
      seeAlso: t.Optional(t.Array(t.String())),
    })
  ),
  taskToRoute: t.Optional(t.Record(t.String(), t.String())),
  subRoutes: t.Array(
    t.Object({
      id: t.String(),
      path: t.String(),
      summary: t.String(),
      agentGuidance: t.Optional(t.String()),
      facetsHint: t.Optional(t.Array(t.String())),
      exampleQuery: t.Any(),
    })
  ),
})
export type DomainGuide = Static<typeof DomainGuideSchema>

// ---------------------------------------------------------------------------
// Top-level /guide response
// ---------------------------------------------------------------------------

export const GuideResponseSchema = t.Object({
  version: t.String({ description: 'Guide schema version (semver-ish, e.g. "1.0.0").' }),
  generatedAt: t.String({ description: 'ISO timestamp the guide was assembled.' }),
  summary: t.String({ description: 'One-paragraph mission statement for the agent.' }),
  philosophy: t.Array(t.String(), { description: 'High-level rules for using the API.' }),
  workflow: t.Object({
    title: t.String(),
    description: t.String(),
    steps: t.Array(WorkflowStepSchema),
  }),
  decisionTree: t.Array(
    t.Object({
      intent: t.String({ description: 'A common user intent, e.g. "Find state-level coal production".' }),
      path: t.Array(t.String(), { description: 'Ordered list of API calls to satisfy that intent.' }),
    })
  ),
  antiPatterns: t.Array(AntiPatternSchema),
  commonRecipes: t.Array(CommonRecipeSchema),
  domains: t.Array(
    t.Object({
      id: DomainIdSchema,
      name: t.String(),
      useCases: t.Array(t.String()),
      hasPlaybook: t.Boolean(),
      hasCommonQueries: t.Boolean(),
      hasAgentHints: t.Boolean(),
    })
  ),
  endpoints: t.Object({
    root: t.String(),
    domains: t.String(),
    domainDetail: t.String(),
    search: t.String(),
    facets: t.String(),
    facetValues: t.String(),
    query: t.String(),
    openapi: t.String(),
    openapiJson: t.String(),
  }),
  related: t.Object({
    openapiSpec: t.String(),
    examplesIndex: t.String(),
  }),
})
export type GuideResponse = Static<typeof GuideResponseSchema>
