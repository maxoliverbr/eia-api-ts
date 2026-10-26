/**
 * NUC_STATUS — Nuclear Outages
 *
 * U.S. nuclear power plant outage status at facility, generator, and
 * national level.
 */
import type { DomainMeta } from '../schemas/domain'
import { buildSubRoute } from './_sub'

export const nuclearOutagesMeta: DomainMeta = {
  id: 'nuclear-outages',
  name: 'Nuclear Outages',
  description:
    'U.S. nuclear power plant outage status and capacity reductions at the facility, generator, and national level.',
  tags: ['nuclear', 'outages', 'electricity', 'us'],
  useCases: [
    'Track real-time nuclear unit outages',
    'Analyze historical outage patterns by facility',
    'Monitor U.S. nuclear capacity factor trends',
  ],
  subRoutes: [
    buildSubRoute('nuclear-outages', {
      id: 'facility-nuclear-outages',
      summary: 'Facility nuclear outages',
      description: 'Outage records at the facility level.',
      facetsHint: ['facility', 'outages'],
      typicalFrequency: 'daily',
      dateRange: { start: '2014', end: null },
    }),
    buildSubRoute('nuclear-outages', {
      id: 'generator-nuclear-outages',
      summary: 'Generator nuclear outages',
      description: 'Outage records at the generator/reactor level.',
      facetsHint: ['generator', 'outages'],
      typicalFrequency: 'daily',
      dateRange: { start: '2014', end: null },
    }),
    buildSubRoute('nuclear-outages', {
      id: 'us-nuclear-outages',
      summary: 'U.S. nuclear outages (summary)',
      description: 'National-level nuclear outage summary.',
      facetsHint: ['national', 'summary'],
      typicalFrequency: 'daily',
      dateRange: { start: '2014', end: null },
    }),
  ],
  relatedDomains: ['electricity', 'state-electricity-profiles'],
}
