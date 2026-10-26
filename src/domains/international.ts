/**
 * INTL — International
 *
 * International energy data by country/region: production, consumption,
 * reserves, and trade for major energy commodities.
 */
import type { DomainMeta } from '../schemas/domain'

export const internationalMeta: DomainMeta = {
  id: 'international',
  name: 'International',
  description:
    'International energy data by country and region: production, consumption, reserves, imports, and exports for major fuels.',
  tags: ['international', 'global', 'country', 'production', 'consumption'],
  useCases: [
    'Compare energy production across countries',
    'Track global consumption of major fuels',
    'Analyze reserves by region',
  ],
  subRoutes: [
    {
      id: 'data',
      path: 'international/data',
      summary: 'International energy data (all records)',
      description: 'All international energy data; filter via facets and date range.',
      tags: ['global'],
      typicalFrequency: 'annual',
      dateRange: { start: '1980', end: null },
      exampleQuery: {
        frequency: 'annual',
        start: '2010',
        end: new Date().getFullYear().toString(),
        length: 50,
      },
      facetsHint: ['countryRegionId', 'activityId', 'productId', 'unit'],
    },
  ],
  relatedDomains: ['ieo', 'total-energy'],
}
