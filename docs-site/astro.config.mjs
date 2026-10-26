// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

const REPO = 'https://github.com/MaxwellCalkin/eia-api-ts';

export default defineConfig({
  site: 'https://eia-api.maxcalkin.dev',
  integrations: [
    starlight({
      title: 'eia-api-ts',
      tagline: 'A typed, agent-ready wrapper around the EIA API v2',
      description:
        'Modern, fully-typed wrapper around the EIA APIv2 for agentic use. Built with Bun, ElysiaJS, and OpenAPI.',
      logo: {
        src: './src/assets/logo.svg',
        replacesTitle: false,
      },
      favicon: '/favicon.svg',
      social: [{ icon: 'github', label: 'GitHub', href: REPO }],
      editLink: {
        baseUrl: `${REPO}/edit/main/docs-site/`,
      },
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Introduction', slug: 'index' },
            { label: 'Installation', slug: 'start/installation' },
            { label: 'Quick start', slug: 'start/quick-start' },
            { label: 'Configuration', slug: 'start/configuration' },
            { label: 'Architecture', slug: 'start/architecture' },
            { label: 'Deployment', slug: 'start/deployment' },
          ],
        },
        {
          label: 'Concepts',
          items: [
            { label: 'Unified /query', slug: 'concepts/unified-query' },
            { label: 'Facets', slug: 'concepts/facets' },
            { label: 'Discovery', slug: 'concepts/discovery' },
            { label: 'Agent guide', slug: 'concepts/guide' },
            { label: 'Energy ontology', slug: 'concepts/ontology' },
            { label: 'Deprecations', slug: 'concepts/deprecations' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Simple fetch', slug: 'guides/simple-fetch' },
            { label: 'Eden Treaty (typed client)', slug: 'guides/eden-treaty' },
            { label: 'Multi-step agent', slug: 'guides/multi-step-agent' },
            { label: 'Error handling', slug: 'guides/error-handling' },
          ],
        },
        {
          label: 'Domains',
          collapsed: false,
          items: [
            { label: 'Overview', slug: 'domains' },
            { label: 'Coal', slug: 'domains/coal' },
            { label: 'Electricity', slug: 'domains/electricity' },
            { label: 'Natural Gas', slug: 'domains/natural-gas' },
            { label: 'CO₂ Emissions', slug: 'domains/co2-emissions' },
            { label: 'Crude Oil Imports', slug: 'domains/crude-oil-imports' },
            { label: 'Densified Biomass', slug: 'domains/densified-biomass' },
            { label: 'International', slug: 'domains/international' },
            { label: 'Nuclear Outages', slug: 'domains/nuclear-outages' },
            { label: 'RTO', slug: 'domains/rto' },
            { label: 'SEDS', slug: 'domains/seds' },
            { label: 'STEO', slug: 'domains/steo' },
            { label: 'AEO', slug: 'domains/aeo' },
            { label: 'IEO', slug: 'domains/ieo' },
            { label: 'State Electricity Profiles', slug: 'domains/state-electricity-profiles' },
            { label: 'Total Energy', slug: 'domains/total-energy' },
          ],
        },
        {
          label: 'Agents',
          items: [
            { label: 'Overview', slug: 'agents/overview' },
            { label: 'Mastra + OpenRouter', slug: 'agents/mastra' },
            { label: 'Ontology-first', slug: 'agents/ontology-first' },
            { label: 'MCP client', slug: 'agents/mcp-client' },
          ],
        },
        {
          label: 'MCP Server',
          items: [
            { label: 'Overview', slug: 'mcp/overview' },
            { label: 'Tools', slug: 'mcp/tools' },
            { label: 'Resources', slug: 'mcp/resources' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'Endpoints', slug: 'reference/endpoints' },
            { label: 'Schemas', slug: 'reference/schemas' },
            { label: 'Environment variables', slug: 'reference/env' },
            { label: 'OpenAPI', slug: 'reference/openapi' },
          ],
        },
        {
          label: 'Contributing',
          items: [
            { label: 'Adding a domain', slug: 'contribute/adding-a-domain' },
            { label: 'Scripts', slug: 'contribute/scripts' },
          ],
        },
      ],
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
      pagination: true,
      expressiveCode: {
        themes: ['github-dark', 'github-light'],
      },
    }),
  ],
});