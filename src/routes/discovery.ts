/**
 * GET /domains                  — list all 15 domains
 * GET /domains/:domain          — single domain + sub-routes
 *
 * The `GET /routes/*` and `GET /schema/*` proxies live in `facets.ts`
 * (the Facets tag group) because they share the same domain-validated
 * canonical-path-resolution logic. Keeping a stub here would race with
 * the more specific `/routes/:domain/*` matcher in facets.ts.
 */
import { Elysia, t } from 'elysia'
import { DOMAINS, getDomain } from '../domains'
import { DomainMetaSchema } from '../schemas/domain'
import { DomainIdSchema } from '../schemas/primitives'

const notFound = (id: string) => ({
  error: 'domain_not_found' as const,
  message: `No domain registered with id "${id}". Available: ${DOMAINS.map((d) => d.id).join(', ')}.`,
})

export const discoveryRoutes = new Elysia({ tags: ['Discovery'] })
  // ---------------------------------------------------------------------------
  // GET /domains
  // ---------------------------------------------------------------------------
  .get(
    '/domains',
    () => ({ domains: [...DOMAINS] }),
    {
      detail: {
        summary: 'List all domains',
        description: [
          'Returns rich metadata for every EIA domain this server knows about — including use cases, sub-routes, examples, and related domains. Useful as the first call an agent makes.',
          '',
          '**Example**',
          '```bash',
          'curl http://localhost:3000/domains',
          '```',
          '',
          '**Sample response (truncated)**',
          '```json',
          '{ "domains": [ { "id": "coal", "name": "Coal", "tags": ["fossil-fuels"], "useCases": ["..."], "subRoutes": [ /* 12 entries */ ], "relatedDomains": ["electricity", "total-energy"] } ] }',
          '```',
          '',
          '**Next steps** → `GET /domains/:id` for a single domain, or `POST /search` to filter by intent.',
          '**Tip** → `GET /guide` returns a full agent playbook (workflow, decision tree, anti-patterns, recipes).',
        ].join('\n'),
        tags: ['Discovery'],
      },
      response: t.Object({
        domains: t.Array(DomainMetaSchema),
      }),
    }
  )
  // ---------------------------------------------------------------------------
  // GET /domains/:domain
  // ---------------------------------------------------------------------------
  .get(
    '/domains/:domain',
    ({ params, status }) => {
      const meta = getDomain(params.domain)
      if (!meta) {
        return status(404, notFound(params.domain))
      }
      return meta
    },
    {
      params: t.Object({ domain: DomainIdSchema }),
      detail: {
        summary: 'Get a single domain',
        description: [
          'Returns full metadata for a single domain, including all its sub-routes and example queries.',
          '',
          '**Example**',
          '```bash',
          'curl http://localhost:3000/domains/coal',
          '```',
          '',
          '**Sample response (truncated)**',
          '```json',
          '{ "id": "coal", "name": "Coal", "subRoutes": [ { "id": "aggregate-production", "summary": "Aggregate U.S. coal production", "exampleQuery": { "frequency": "annual", "start": "1949" }, "facetsHint": ["location"] } ] }',
          '```',
          '',
          '**Next steps** → `GET /routes/coal/aggregate-production/facet` to discover filterable dimensions, then `POST /query`.',
        ].join('\n'),
        tags: ['Discovery'],
      },
      response: {
        200: DomainMetaSchema,
        404: t.Object({
          error: t.Literal('domain_not_found'),
          message: t.String(),
        }),
      },
    }
  )
