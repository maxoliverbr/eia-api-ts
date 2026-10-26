/**
 * NG — Natural Gas
 *
 * 2-level route structure: /v2/natural-gas/{category}/{dataset}.
 * Categories are 2-letter codes (`cons`, `pri`, `prod`, `stor`, `move`,
 * `enr`, `sum`); datasets are also short codes (`sum`, `wkly`, `impc`,
 * `oilwells`, …). These ids are taken verbatim from the upstream route
 * listing at /v2/natural-gas/ — the example queries below have all been
 * probed against the live API to confirm they return 200.
 */
import type { DomainMeta } from '../schemas/domain'
import { buildSubRoute } from './_sub'

export const naturalGasMeta: DomainMeta = {
  id: 'natural-gas',
  name: 'Natural Gas',
  description:
    'U.S. natural gas survey data: consumption by end use, prices, marketed production, working-gas storage, pipeline/LNG imports and exports, exploration and reserves, and high-level summaries. Uses 2-level routes like /natural-gas/{category}/{dataset}.',
  tags: ['natural-gas', 'fossil-fuels', 'us'],
  useCases: [
    'Track natural gas consumption by sector, state, or end use',
    'Monitor wellhead, city-gate, and retail natural gas prices',
    'Analyze working-gas storage levels and regional capacity',
    'Follow pipeline and LNG import/export flows',
  ],
  subRoutes: [
    buildSubRoute('natural-gas', {
      id: 'cons/sum',
      summary: 'Consumption by end use',
      description: 'Natural gas volumes delivered to residential, commercial, industrial, electric power, and vehicle-fuel end uses. Annual and monthly frequency.',
      tags: ['consumption', 'end-use'],
      dateRange: { start: '1973', end: null },
      facetsHint: ['duoarea', 'product'],
      agentGuidance:
        'Filter with `duoarea` (geography) and `product` (sector). Residential / commercial / industrial / electric power are all on the same dataset — pivot with the product facet.',
      prerequisites: ['GET /routes/natural-gas/cons/sum/facet'],
    }),
    buildSubRoute('natural-gas', {
      id: 'pri/sum',
      summary: 'Price summary (all sectors)',
      description: 'Natural gas prices aggregated across sectors. Annual and monthly frequency.',
      tags: ['price'],
      dateRange: { start: '1973', end: null },
      facetsHint: ['duoarea', 'product', 'process'],
      agentGuidance:
        'The `process` facet distinguishes "wellhead", "city-gate", and "delivered to [sector]" prices. Always include `process` in your filter or you\'ll get a cross-product of all of them.',
      columnDescriptions: {
        'process-name': 'Process label, e.g. "Price Delivered to Residential Consumers".',
        'value': 'Numeric price in USD per the units column.',
        'units': 'Unit string, e.g. "dollars per thousand cubic feet".',
        'duoarea': 'State name (e.g. "CALIFORNIA").',
        'product': 'Sector or product (e.g. "Residential", "Total Electric Power").',
      },
      prerequisites: [
        'GET /routes/natural-gas/pri/sum/facet',
        'GET /routes/natural-gas/pri/sum/facet/process',
      ],
    }),
    buildSubRoute('natural-gas', {
      id: 'prod/oilwells',
      summary: 'Production — oilwell counts',
      description: 'Marketed natural gas production reported alongside associated oilwell counts. Annual frequency.',
      tags: ['production', 'wells'],
      dateRange: { start: '1973', end: null },
      facetsHint: ['duoarea'],
      prerequisites: ['GET /routes/natural-gas/prod/oilwells/facet'],
    }),
    buildSubRoute('natural-gas', {
      id: 'stor/wkly',
      summary: 'Weekly working gas storage',
      description: 'Weekly working-gas storage levels by region. Weekly frequency only — annual/monthly are not supported on this dataset.',
      tags: ['storage', 'weekly'],
      dateRange: { start: '2010', end: null },
      facetsHint: ['duoarea'],
      typicalFrequency: 'weekly',
      exampleStart: '2024-01-01',
      exampleEnd: '2024-01-07',
      agentGuidance:
        'This dataset is WEEKLY ONLY. Asking for `frequency=annual` or `frequency=monthly` returns an upstream error. Use ISO date ranges in `start`/`end` (e.g. "2024-01-01").',
      prerequisites: ['GET /routes/natural-gas/stor/wkly/facet'],
    }),
    buildSubRoute('natural-gas', {
      id: 'move/impc',
      summary: 'Pipeline imports by country',
      description: 'Natural gas imported by pipeline, broken down by country of origin. Annual and monthly frequency.',
      tags: ['imports', 'pipeline', 'trade'],
      dateRange: { start: '1973', end: null },
      facetsHint: ['duoarea'],
      prerequisites: ['GET /routes/natural-gas/move/impc/facet'],
    }),
    buildSubRoute('natural-gas', {
      id: 'enr/sum',
      summary: 'Exploration & reserves summary',
      description: 'High-level summary of natural gas exploration, reserves, and resource categories (dry, coalbed, shale, tight, etc.). Annual frequency.',
      tags: ['reserves', 'exploration'],
      dateRange: { start: '1973', end: null },
      facetsHint: ['duoarea', 'process'],
      prerequisites: ['GET /routes/natural-gas/enr/sum/facet'],
    }),
    buildSubRoute('natural-gas', {
      id: 'sum/lsum',
      summary: 'LNG summary',
      description: 'Liquefied natural gas summary statistics. Annual and monthly frequency.',
      tags: ['lng', 'summary'],
      dateRange: { start: '1973', end: null },
      facetsHint: ['duoarea', 'product', 'process'],
      prerequisites: ['GET /routes/natural-gas/sum/lsum/facet'],
    }),
  ],
  relatedDomains: ['electricity', 'total-energy', 'international'],
  playbook: {
    steps: [
      {
        goal: 'Find a natural gas dataset that matches the user intent',
        route: 'POST /search { "q": "natural gas price" }',
        why: "The search index knows both top-level summaries and 2-level routes like 'pri/sum'.",
      },
      {
        goal: 'Confirm the 2-level sub-route id and read its metadata',
        route: 'GET /domains/natural-gas',
        why: "Sub-routes use a 2-level id like 'pri/sum' or 'stor/wkly' — the metadata tells you what each level means.",
      },
      {
        goal: 'Discover the filterable facets (e.g. duoarea, process)',
        route: 'GET /routes/natural-gas/{subRouteId}/facet',
        why: "Geographies, sectors, and processes are facets — listing them avoids bad filter values.",
      },
      {
        goal: 'Resolve human-readable names to ids (e.g. CALIFORNIA → SCA)',
        route: 'GET /routes/natural-gas/{subRouteId}/facet/{facetId}',
        why: 'Facet values are ids, not display names. The pair (id, name) is returned so you can map both ways.',
      },
      {
        goal: 'Run the actual data query',
        route: 'POST /query { domain: "natural-gas", route, frequency, start, end, data, facets }',
        why: 'Same uniform shape as every other domain. The route key uses the 2-level id verbatim.',
      },
    ],
  },
  commonQueries: [
    {
      name: 'California residential natural gas price, 2020–2024',
      description: 'Annual residential price series for California.',
      params: {
        domain: 'natural-gas',
        route: 'pri/sum',
        frequency: 'annual',
        start: '2020',
        end: '2024',
        facets: { duoarea: ['SCA'] },
        data: ['value'],
        sort: [{ column: 'period', direction: 'asc' }],
        length: 100,
      },
      expectedShape: 'Rows of { period, value, units, process-name } for residential CA.',
    },
    {
      name: 'Working gas storage, last 4 weeks',
      description: 'Weekly storage levels for the most recent reporting region.',
      params: {
        domain: 'natural-gas',
        route: 'stor/wkly',
        frequency: 'weekly',
        start: '2024-01-01',
        end: '2024-01-28',
        data: ['value'],
        length: 50,
      },
      expectedShape: 'Rows of { period, value, duoarea } for the prior 4 weeks.',
    },
    {
      name: 'Pipeline imports by origin country',
      description: 'Annual pipeline imports broken out by origin country.',
      params: {
        domain: 'natural-gas',
        route: 'move/impc',
        frequency: 'annual',
        start: '2010',
        end: '2024',
        data: ['value'],
        length: 1000,
      },
      expectedShape: 'Rows grouped by { period, duoarea } where duoarea is the origin country.',
    },
  ],
  agentHints: {
    warnings: [
      'Sub-route ids are 2-level: use "pri/sum", not "pri" or "sum".',
      'The weekly storage route (stor/wkly) ONLY supports frequency=weekly. Annual/monthly will 400 from upstream.',
      'Weekly storage dates use ISO format (YYYY-MM-DD), not YYYY.',
    ],
    gotchas: [
      'Filter values are ids like "SCA" (Southern California) and "NY" (New York), not full state names. Always hit /facet/{id} first.',
      '`process` facet for prices returns long descriptive labels — narrow the list by reading facet values first.',
      'If you ask for too many facets, upstream returns 0 rows; trim until data flows.',
    ],
    seeAlso: ['/domains/electricity', '/domains/total-energy', 'POST /search'],
  },
  taskToRoute: {
    'natural gas price': 'pri/sum',
    'state gas price': 'pri/sum',
    'residential gas price': 'pri/sum',
    'natural gas consumption': 'cons/sum',
    'gas consumption by sector': 'cons/sum',
    'natural gas storage': 'stor/wkly',
    'working gas storage': 'stor/wkly',
    'natural gas production': 'prod/oilwells',
    'gas reserves': 'enr/sum',
    'gas imports': 'move/impc',
    'lng': 'sum/lsum',
  },
}
