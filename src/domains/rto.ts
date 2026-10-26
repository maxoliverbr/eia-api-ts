/**
 * RTO — Regional Transmission Organization daily/regional data
 *
 * Daily interchange, fuel-type, region, and sub-BA data for U.S. RTOs
 * (CAISO, ERCOT, ISONE, MISO, NYISO, PJM, SPP).
 */
import type { DomainMeta } from '../schemas/domain'
import { buildSubRoute } from './_sub'

export const rtoMeta: DomainMeta = {
  id: 'rto',
  name: 'RTO Daily/Regional Data',
  description:
    'Daily and regional operational data for U.S. Regional Transmission Organizations (RTOs): interchange, fuel-type generation, region, and sub-BA data.',
  tags: ['rto', 'electricity', 'grid', 'operations'],
  useCases: [
    'Monitor day-ahead and real-time interchange between RTOs',
    'Track fuel-mix generation by RTO region',
    'Analyze sub-balancing authority flows',
  ],
  subRoutes: [
    buildSubRoute('electricity', {
      id: 'rto/daily-interchange-data',
      path: 'electricity/rto/daily-interchange-data',
      summary: 'Daily interchange data',
      description: 'Inter-RTO interchange on a daily basis.',
      facetsHint: ['interchange'],
      typicalFrequency: 'daily',
      dateRange: { start: '2018', end: null },
    }),
    buildSubRoute('electricity', {
      id: 'rto/daily-fuel-type-data',
      path: 'electricity/rto/daily-fuel-type-data',
      summary: 'Daily fuel type data',
      description: 'Daily generation by fuel type within each RTO.',
      facetsHint: ['fuel-type', 'generation'],
      typicalFrequency: 'daily',
      dateRange: { start: '2018', end: null },
    }),
    buildSubRoute('electricity', {
      id: 'rto/daily-region-data',
      path: 'electricity/rto/daily-region-data',
      summary: 'Daily region data',
      description: 'Daily totals by RTO region.',
      facetsHint: ['region'],
      typicalFrequency: 'daily',
      dateRange: { start: '2018', end: null },
    }),
    buildSubRoute('electricity', {
      id: 'rto/daily-region-sub-ba-data',
      path: 'electricity/rto/daily-region-sub-ba-data',
      summary: 'Daily region sub-BA data',
      description: 'Daily totals by RTO sub-balancing authority.',
      facetsHint: ['region', 'sub-ba'],
      typicalFrequency: 'daily',
      dateRange: { start: '2018', end: null },
    }),
    buildSubRoute('electricity', {
      id: 'rto/interchange-data',
      path: 'electricity/rto/interchange-data',
      summary: 'Interchange data (hourly)',
      description: 'Hourly interchange between RTOs.',
      facetsHint: ['interchange', 'hourly'],
      typicalFrequency: 'daily',
      dateRange: { start: '2018', end: null },
    }),
    buildSubRoute('electricity', {
      id: 'rto/fuel-type-data',
      path: 'electricity/rto/fuel-type-data',
      summary: 'Fuel type data (hourly)',
      description: 'Hourly generation by fuel type within each RTO.',
      facetsHint: ['fuel-type', 'hourly'],
      typicalFrequency: 'daily',
      dateRange: { start: '2018', end: null },
    }),
    buildSubRoute('electricity', {
      id: 'rto/region-data',
      path: 'electricity/rto/region-data',
      summary: 'Region data (hourly)',
      description: 'Hourly totals by RTO region.',
      facetsHint: ['region', 'hourly'],
      typicalFrequency: 'daily',
      dateRange: { start: '2018', end: null },
    }),
    buildSubRoute('electricity', {
      id: 'rto/region-sub-ba-data',
      path: 'electricity/rto/region-sub-ba-data',
      summary: 'Region sub-BA data (hourly)',
      description: 'Hourly totals by RTO sub-balancing authority.',
      facetsHint: ['region', 'sub-ba', 'hourly'],
      typicalFrequency: 'daily',
      dateRange: { start: '2018', end: null },
    }),
  ],
  relatedDomains: ['electricity', 'state-electricity-profiles', 'nuclear-outages'],
}
