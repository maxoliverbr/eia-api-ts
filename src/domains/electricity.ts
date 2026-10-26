/**
 * ELEC — Electricity
 *
 * Operational data for U.S. electric power: facility-fuel, generation,
 * operating generator capacity, and retail sales.
 */
import type { DomainMeta } from '../schemas/domain'
import { buildSubRoute } from './_sub'

export const electricityMeta: DomainMeta = {
  id: 'electricity',
  name: 'Electricity',
  description:
    'Operational data for the U.S. electric power sector: facility-level fuel use, generation, generator capacity, and retail sales.',
  tags: ['electricity', 'power', 'generation', 'us'],
  useCases: [
    'Analyze electricity generation by fuel and region',
    'Track retail sales and revenue by state and sector',
    'Monitor operating generator capacity',
  ],
  subRoutes: [
    buildSubRoute('electricity', {
      id: 'electric-power-operational-data',
      summary: 'Electric power operational data',
      description: 'Monthly and annual electric power operations by state, sector, and energy source.',
      tags: ['operational', 'generation'],
      dateRange: { start: '2018', end: null },
      facetsHint: ['location', 'sectorid', 'fueltypeid'],
      typicalFrequency: 'monthly',
      agentGuidance:
        'The default endpoint for "electricity generation by state/fuel" questions. Filter with `location` (state name or US-TOTAL) and `fueltypeid` (e.g. "SUN", "WND", "NUC", "NG").',
      prerequisites: ['GET /routes/electricity/electric-power-operational-data/facet'],
    }),
    buildSubRoute('electricity', {
      id: 'facility-fuel',
      summary: 'Facility fuel consumption',
      description: 'Facility-level fuel consumption and emissions.',
      tags: ['facility', 'fuel'],
      dateRange: { start: '2011', end: null },
      facetsHint: ['plantId', 'fueltypeid', 'stateid'],
      typicalFrequency: 'monthly',
      prerequisites: ['GET /routes/electricity/facility-fuel/facet'],
    }),
    buildSubRoute('electricity', {
      id: 'operating-generator-capacity',
      summary: 'Operating generator capacity',
      description: 'Capacity of operating generators by fuel, region, and prime mover.',
      tags: ['capacity', 'generator'],
      dateRange: { start: '2011', end: null },
      facetsHint: ['plantId', 'fueltypeid', 'stateid'],
      typicalFrequency: 'monthly',
      prerequisites: ['GET /routes/electricity/operating-generator-capacity/facet'],
    }),
    buildSubRoute('electricity', {
      id: 'retail-sales',
      summary: 'Retail sales',
      description: 'Electricity retail sales, revenue, and customer counts by state and sector.',
      tags: ['retail', 'sales', 'revenue'],
      dateRange: { start: '2001', end: null },
      facetsHint: ['stateid', 'sectorid'],
      typicalFrequency: 'monthly',
      prerequisites: ['GET /routes/electricity/retail-sales/facet'],
    }),
  ],
  relatedDomains: ['state-electricity-profiles', 'rto', 'coal'],
  playbook: {
    steps: [
      {
        goal: 'Find an electricity dataset that matches the user intent',
        route: 'POST /search { "q": "electricity generation" }',
        why: 'The search index covers all four electricity sub-routes and their tags.',
      },
      {
        goal: 'Read the sub-route descriptions to pick the right one',
        route: 'GET /domains/electricity',
        why: 'Four sub-routes cover very different use cases (operations, facility fuel, capacity, retail sales).',
      },
      {
        goal: 'Discover the filterable facets (stateid, sectorid, fueltypeid, …)',
        route: 'GET /routes/electricity/{subRouteId}/facet',
        why: 'State / sector / fuel ids are not human-readable — list them first.',
      },
      {
        goal: 'Resolve a state name to a stateid if needed',
        route: 'GET /routes/electricity/{subRouteId}/facet/stateid',
        why: 'stateid is a 2-letter code; you can also pass the state name to the `location` facet on some routes.',
      },
      {
        goal: 'Run the actual data query',
        route: 'POST /query { domain: "electricity", route, frequency: "monthly", start, end, facets }',
        why: 'Most electricity data is monthly; default frequency on these routes is "monthly".',
      },
    ],
  },
  commonQueries: [
    {
      name: 'California monthly generation by fuel, 2024',
      description: 'Monthly net generation in California broken down by fuel type.',
      params: {
        domain: 'electricity',
        route: 'electric-power-operational-data',
        frequency: 'monthly',
        start: '2024-01',
        end: '2024-12',
        facets: { location: ['CALIFORNIA'] },
        data: ['generation'],
        sort: [{ column: 'period', direction: 'asc' }],
        length: 5000,
      },
      expectedShape: 'Rows of { period, generation, fueltypeid, location: "CALIFORNIA" }.',
    },
    {
      name: 'US total retail sales, 5 years',
      description: 'Monthly retail sales aggregated to the US.',
      params: {
        domain: 'electricity',
        route: 'retail-sales',
        frequency: 'monthly',
        start: '2020-01',
        end: '2024-12',
        data: ['sales', 'revenue'],
        sort: [{ column: 'period', direction: 'asc' }],
        length: 5000,
      },
      expectedShape: 'Rows of { period, sales, revenue, stateid, sectorid }.',
    },
  ],
  agentHints: {
    warnings: [
      'Frequency on this domain is "monthly" by default. Use "monthly" for retail sales and operational data.',
      'State identifiers vary: `location` accepts a state name (e.g. "CALIFORNIA"), but `stateid` is a 2-letter code.',
      'fueltypeid values are short codes (e.g. "NG" for natural gas, "NUC" for nuclear) — not names.',
    ],
    gotchas: [
      'Length must be ≤ 5000; longer pulls need pagination with `offset`.',
      'The `electric-power-operational-data` dataset is the modern, monthly replacement for several legacy series.',
    ],
    seeAlso: ['/domains/state-electricity-profiles', '/domains/rto', 'POST /search'],
  },
  taskToRoute: {
    'electricity generation by state': 'electric-power-operational-data',
    'electricity generation by fuel': 'electric-power-operational-data',
    'power plant fuel consumption': 'facility-fuel',
    'generator capacity': 'operating-generator-capacity',
    'retail electricity sales': 'retail-sales',
    'electricity revenue': 'retail-sales',
  },
}
