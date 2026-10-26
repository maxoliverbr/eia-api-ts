/**
 * POST /search — keyword search across domain metadata.
 */
import { Elysia, t } from 'elysia'
import { DOMAINS } from '../domains'
import { searchDomains } from '../lib/search'
import { SearchRequestSchema, SearchResponseSchema } from '../schemas/domain'

export const searchRoutes = new Elysia({ tags: ['Search'] }).post(
  '/search',
  ({ body }) => searchDomains(DOMAINS, body.q, body.limit ?? 10),
  {
    body: SearchRequestSchema,
    detail: {
      summary: 'Search domains and sub-routes',
      description: [
        'Find EIA datasets by free-text keywords. Searches across domain names, descriptions, use cases, tags, and sub-route names/summaries. Returns the top N results with a relevance score and a contextual snippet.',
        '',
        '**Example**',
        '```bash',
        'curl -X POST http://localhost:3000/search \\',
        '  -H "Content-Type: application/json" \\',
        '  -d \'{"q":"natural gas price","limit":3}\'',
        '```',
        '',
        '**Sample response (truncated)**',
        '```json',
        '{ "query": "natural gas price", "total": 3, "hits": [ { "domain": "natural-gas", "subRouteId": "pri/sum", "path": "natural-gas/pri/sum", "title": "Price summary (all sectors)", "score": 12.4, "snippet": "Natural gas prices aggregated across sectors..." } ] }',
        '```',
        '',
        '**Next steps** → take the top hit\'s `domain` and call `GET /domains/:domain` to read the sub-route\'s exampleQuery and facetsHint.',
      ].join('\n'),
      tags: ['Search'],
    },
    response: SearchResponseSchema,
  }
)
