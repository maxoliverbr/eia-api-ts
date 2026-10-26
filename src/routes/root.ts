/**
 * GET / — API root.
 *
 * Provides a human-friendly landing page of the most important endpoints
 * so agents (and humans) can discover capabilities without reading docs.
 */
import { Elysia, t } from 'elysia'
import pkg from '../../package.json' with { type: 'json' }

export const rootRoutes = new Elysia({ tags: ['Meta'] }).get(
  '/',
  () => ({
    name: 'EIA API for Agents',
    version: pkg.version,
    eiaApiBase: 'https://api.eia.gov/v2',
    description:
      'A modern, fully-typed wrapper around the EIA APIv2 designed for AI agents and modern TypeScript clients. Start with GET /guide for a machine-readable playbook.',
    endpoints: {
      docs: '/openapi',
      openapiSpec: '/openapi/json',
      health: '/health',
      version: '/version',
      guide: '/guide',
      domains: '/domains',
      query: '/query',
      search: '/search',
    },
    quickStart: {
      readGuide: 'GET /guide',
      listDomains: 'GET /domains',
      inspectDomain: 'GET /domains/coal',
      listFacets: 'GET /routes/coal/aggregate-production/facet',
      query: 'POST /query { "domain": "coal", "route": "aggregate-production", "frequency": "annual", "start": "2020", "end": "2024" }',
      search: 'POST /search { "q": "coal production" }',
    },
  }),
  {
    detail: {
      summary: 'API root',
      description: [
        'Landing page with links to the most useful endpoints.',
        '',
        '**Start here** → `GET /guide` returns a full agent playbook (workflow, decision tree, anti-patterns, copy-pasteable recipes). Generated from the same source of truth as `/domains`, so it never drifts.',
      ].join('\n'),
      tags: ['Meta'],
    },
    response: t.Object({
      name: t.String(),
      version: t.String(),
      eiaApiBase: t.String(),
      description: t.String(),
      endpoints: t.Object({
        docs: t.String(),
        openapiSpec: t.String(),
        health: t.String(),
        version: t.String(),
        guide: t.Optional(t.String()),
        domains: t.String(),
        query: t.String(),
        search: t.String(),
      }),
      quickStart: t.Object({
        readGuide: t.Optional(t.String()),
        listDomains: t.String(),
        inspectDomain: t.String(),
        listFacets: t.String(),
        query: t.String(),
        search: t.String(),
      }),
    }),
  }
)
