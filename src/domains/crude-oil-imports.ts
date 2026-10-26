/**
 * CRUD_IMPORTS — Crude Oil Imports
 *
 * U.S. crude oil imports by country of origin, grade, and customs district.
 */
import type { DomainMeta } from '../schemas/domain'

export const crudeOilImportsMeta: DomainMeta = {
  id: 'crude-oil-imports',
  name: 'Crude Oil Imports',
  description:
    'U.S. crude oil import volumes by country of origin, grade, and customs district. Useful for trade flow analysis and energy security studies.',
  tags: ['oil', 'imports', 'trade', 'us'],
  useCases: [
    'Analyze U.S. crude import dependency by country',
    'Track grade mix of imported crude',
    'Monitor customs district throughput',
  ],
  subRoutes: [
    {
      id: 'data',
      path: 'crude-oil-imports/data',
      summary: 'U.S. crude oil imports (all records)',
      description: 'The full crude oil imports dataset; filter via facets and date range.',
      tags: ['imports'],
      typicalFrequency: 'monthly',
      dateRange: { start: '1981', end: null },
      exampleQuery: {
        frequency: 'monthly',
        start: '2020',
        end: new Date().getFullYear().toString(),
        length: 50,
      },
      facetsHint: ['origin', 'grade', 'customsDistrict'],
    },
  ],
  relatedDomains: ['international', 'total-energy'],
}
