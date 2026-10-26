/**
 * IEO — International Energy Outlook
 *
 * Long-term projections of world energy supply, demand, and prices by
 * country/region. route1 is a publication year.
 */
import type { DomainMeta } from '../schemas/domain'

export const ieoMeta: DomainMeta = {
  id: 'ieo',
  name: 'International Energy Outlook',
  description:
    'Long-term international energy projections. IEO models energy demand and supply across world regions. route1 selects the publication year.',
  tags: ['projection', 'long-term', 'international', 'global'],
  useCases: [
    'Project world energy demand by region',
    'Compare energy mixes across countries',
    'Analyze long-term international price trends',
  ],
  subRoutes: [
    {
      id: '{year}',
      path: 'ieo/{year}',
      summary: 'Projections for a given IEO publication year',
      description: 'Discover sub-routes for a specific IEO publication year.',
      tags: ['projection', 'international'],
      typicalFrequency: 'annual',
      dateRange: { start: '2010', end: null },
      exampleQuery: { frequency: 'annual', data: ['value'], length: 50 },
      facetsHint: ['countryRegionId', 'scenario'],
    },
  ],
  relatedDomains: ['aeo', 'international'],
}
