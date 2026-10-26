/**
 * TOTAL — Total Energy
 *
 * U.S. aggregate energy production, consumption, trade, and intensity
 * by source and sector.
 */
import type { DomainMeta } from '../schemas/domain'

export const totalEnergyMeta: DomainMeta = {
  id: 'total-energy',
  name: 'Total Energy',
  description:
    'U.S. aggregate energy data: total production, consumption, trade (imports/exports), and energy intensity by source and sector.',
  tags: ['aggregate', 'national', 'consumption', 'production', 'us'],
  useCases: [
    'Track total U.S. energy production and consumption',
    'Analyze net energy imports/exports',
    'Monitor energy intensity over time',
  ],
  subRoutes: [
    {
      id: 'data',
      path: 'total-energy/data',
      summary: 'Total energy data (all records)',
      description: 'All total-energy records; filter via facets and date range.',
      tags: ['aggregate'],
      typicalFrequency: 'monthly',
      dateRange: { start: '1949', end: null },
      exampleQuery: {
        frequency: 'monthly',
        start: '2010',
        end: new Date().getFullYear().toString(),
        length: 100,
      },
      facetsHint: ['seriesId'],
    },
  ],
  relatedDomains: ['seds', 'electricity', 'aeo', 'steo'],
}
