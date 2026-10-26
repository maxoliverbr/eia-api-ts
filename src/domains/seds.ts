/**
 * SEDS — State Energy Data System
 *
 * Comprehensive state-level energy consumption, prices, expenditures,
 * and production estimates.
 */
import type { DomainMeta } from '../schemas/domain'

export const sedsMeta: DomainMeta = {
  id: 'seds',
  name: 'State Energy Data System',
  description:
    'State-level estimates of energy consumption, prices, expenditures, production, and indicators. The canonical source for state-level energy comparisons.',
  tags: ['state', 'consumption', 'price', 'expenditure', 'us'],
  useCases: [
    'Compare per-capita energy use across states',
    'Track state-level energy expenditures by sector',
    'Analyze state fuel-mix trends',
  ],
  subRoutes: [
    {
      id: 'data',
      path: 'seds/data',
      summary: 'SEDS data (all records)',
      description: 'All SEDS records; filter via facets and date range.',
      tags: ['state'],
      typicalFrequency: 'annual',
      dateRange: { start: '1960', end: null },
      exampleQuery: {
        frequency: 'annual',
        start: '2010',
        end: new Date().getFullYear().toString(),
        length: 100,
      },
      facetsHint: ['stateId', 'sectorId', 'fuelId', 'seriesId'],
    },
  ],
  relatedDomains: ['total-energy', 'electricity', 'state-electricity-profiles'],
}
