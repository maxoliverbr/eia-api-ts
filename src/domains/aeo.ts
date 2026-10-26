/**
 * AEO — Annual Energy Outlook
 *
 * Long-term (typically 30-year) projections of U.S. energy supply,
 * demand, and prices under various scenarios. The route1 segment is
 * a year identifier (e.g. "2024").
 */
import type { DomainMeta } from '../schemas/domain'

export const aeoMeta: DomainMeta = {
  id: 'aeo',
  name: 'Annual Energy Outlook',
  description:
    'Long-term projections of U.S. energy supply, demand, prices, and emissions. AEO is a policy-neutral reference case produced annually; route1 selects the publication year (e.g. "2024").',
  tags: ['projection', 'long-term', 'policy-neutral', 'us'],
  useCases: [
    'Project future U.S. energy demand by sector and fuel',
    'Compare reference-case vs. side-case scenarios',
    'Investigate long-term price forecasts',
  ],
  subRoutes: [
    {
      id: '{year}',
      path: 'aeo/{year}',
      summary: 'Projections for a given AEO publication year',
      description:
        'Discover the available sub-routes for a specific AEO year. Always navigate via this route to find facets and frequencies for a publication.',
      tags: ['projection'],
      typicalFrequency: 'annual',
      dateRange: { start: '2020', end: null },
      exampleQuery: { frequency: 'annual', data: ['value'], length: 50 },
      facetsHint: ['scenario', 'seriesId'],
    },
  ],
  relatedDomains: ['ieo', 'steo', 'total-energy'],
}
