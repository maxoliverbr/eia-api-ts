/**
 * CO2 Emissions
 *
 * Two sub-datasets:
 *  - co2-emissions-aggregates: state-level aggregated CO2 emissions
 *  - co2-emissions-and-carbon-coefficients: emissions + carbon coefficients by fuel
 */
import type { DomainMeta } from '../schemas/domain'
import { buildSubRoute } from './_sub'

export const co2EmissionsMeta: DomainMeta = {
  id: 'co2-emissions',
  name: 'CO2 Emissions',
  description:
    'State- and sector-level U.S. CO2 emissions from energy consumption. Includes aggregated totals and fuel-specific carbon coefficients.',
  tags: ['emissions', 'co2', 'climate', 'state', 'us'],
  useCases: [
    'Track state-level CO2 emissions over time',
    'Analyze emissions intensity by fuel',
    'Compare per-capita or per-GDP emissions across states',
  ],
  subRoutes: [
    buildSubRoute('co2-emissions', {
      id: 'co2-emissions-aggregates',
      path: 'co2-emissions/co2-emissions-aggregates',
      summary: 'State-level aggregated CO2 emissions',
      description: 'Aggregated U.S. CO2 emissions by state, sector, and fuel.',
      tags: ['emissions', 'state', 'aggregate'],
      dateRange: { start: '1970', end: null },
      facetsHint: ['stateId', 'sectorId', 'fuelId'],
    }),
    buildSubRoute('co2-emissions', {
      id: 'co2-emissions-and-carbon-coefficients',
      path: 'co2-emissions/co2-emissions-and-carbon-coefficients',
      summary: 'CO2 emissions and fuel carbon coefficients',
      description: 'CO2 emissions paired with the carbon coefficient of each fuel.',
      tags: ['emissions', 'coefficient', 'fuel'],
      dateRange: { start: '1970', end: null },
      facetsHint: ['stateId', 'fuelId', 'sectorId'],
    }),
  ],
  relatedDomains: ['electricity', 'total-energy', 'state-electricity-profiles'],
}
