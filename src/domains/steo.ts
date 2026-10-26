/**
 * STEO — Short Term Energy Outlook
 *
 * Short-term (up to ~24 months) projections of U.S. energy indicators:
 * prices, supply, demand, inventories, and weather.
 */
import type { DomainMeta } from '../schemas/domain'

export const steoMeta: DomainMeta = {
  id: 'steo',
  name: 'Short Term Energy Outlook',
  description:
    'Short-term projections of U.S. energy prices, production, consumption, and inventories for the next ~24 months.',
  tags: ['projection', 'short-term', 'forecast', 'us'],
  useCases: [
    'Forecast near-term U.S. energy prices',
    'Track short-term production and consumption trends',
    'Compare STEO forecasts to actuals',
  ],
  subRoutes: [
    {
      id: 'data',
      path: 'steo/data',
      summary: 'STEO data (all records)',
      description: 'All STEO records; filter via facets and date range.',
      tags: ['forecast'],
      typicalFrequency: 'monthly',
      dateRange: { start: '2010', end: null },
      exampleQuery: {
        frequency: 'monthly',
        start: '2024',
        end: '2025',
        length: 100,
      },
      facetsHint: ['seriesId'],
    },
  ],
  relatedDomains: ['aeo', 'total-energy'],
}
