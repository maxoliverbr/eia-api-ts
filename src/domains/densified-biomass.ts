/**
 * DBF — Densified Biomass
 *
 * Wood pellet and densified biomass production, sales, prices, capacity,
 * inventories, and feedstock costs by region.
 */
import type { DomainMeta } from '../schemas/domain'
import { buildSubRoute } from './_sub'

export const densifiedBiomassMeta: DomainMeta = {
  id: 'densified-biomass',
  name: 'Densified Biomass',
  description:
    'Wood pellet and densified biomass industry data: capacity, production, sales, prices, feedstocks, and inventories by region.',
  tags: ['biomass', 'wood-pellets', 'renewable', 'us'],
  useCases: [
    'Track regional wood pellet production capacity',
    'Analyze sales and prices by region',
    'Monitor feedstock availability and cost',
  ],
  subRoutes: [
    buildSubRoute('densified-biomass', {
      id: 'capacity-by-region',
      summary: 'Capacity by region',
      description: 'Production capacity of densified biomass plants by region.',
      tags: ['capacity'],
      dateRange: { start: '2014', end: null },
      facetsHint: ['region'],
      typicalFrequency: 'monthly',
    }),
    buildSubRoute('densified-biomass', {
      id: 'characteristics-by-region',
      summary: 'Characteristics by region',
      description: 'Physical/chemical characteristics of densified biomass by region.',
      tags: ['characteristics'],
      dateRange: { start: '2014', end: null },
      facetsHint: ['region'],
      typicalFrequency: 'monthly',
    }),
    buildSubRoute('densified-biomass', {
      id: 'export-sales-and-price',
      summary: 'Export sales and price',
      description: 'Export sales volumes and prices for densified biomass.',
      tags: ['exports', 'price'],
      dateRange: { start: '2014', end: null },
      facetsHint: ['destination', 'region'],
      typicalFrequency: 'monthly',
    }),
    buildSubRoute('densified-biomass', {
      id: 'feedstocks-and-cost',
      summary: 'Feedstocks and cost',
      description: 'Feedstock types and their costs.',
      tags: ['feedstock', 'cost'],
      dateRange: { start: '2014', end: null },
      facetsHint: ['feedstock', 'region'],
      typicalFrequency: 'monthly',
    }),
    buildSubRoute('densified-biomass', {
      id: 'inventories-by-region',
      summary: 'Inventories by region',
      description: 'End-of-period inventories by region.',
      tags: ['inventories'],
      dateRange: { start: '2014', end: null },
      facetsHint: ['region'],
      typicalFrequency: 'monthly',
    }),
    buildSubRoute('densified-biomass', {
      id: 'production-by-region',
      summary: 'Production by region',
      description: 'Production volumes by region.',
      tags: ['production'],
      dateRange: { start: '2014', end: null },
      facetsHint: ['region'],
      typicalFrequency: 'monthly',
    }),
    buildSubRoute('densified-biomass', {
      id: 'sales-and-price-by-region',
      summary: 'Sales and price by region',
      description: 'Domestic sales volumes and prices by region.',
      tags: ['sales', 'price'],
      dateRange: { start: '2014', end: null },
      facetsHint: ['region'],
      typicalFrequency: 'monthly',
    }),
    buildSubRoute('densified-biomass', {
      id: 'wood-pellet-plants',
      summary: 'Wood pellet plants',
      description: 'Plant-level data for wood pellet facilities.',
      tags: ['plants'],
      dateRange: { start: '2014', end: null },
      facetsHint: ['plantId', 'region'],
      typicalFrequency: 'monthly',
    }),
  ],
  relatedDomains: ['electricity', 'total-energy'],
}
