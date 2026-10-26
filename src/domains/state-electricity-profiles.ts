/**
 * SEP — State Electricity Profiles
 *
 * State-level electricity capability, emissions, efficiency, meters,
 * net metering, source disposition, and summary.
 */
import type { DomainMeta } from '../schemas/domain'
import { buildSubRoute } from './_sub'

export const stateElectricityProfilesMeta: DomainMeta = {
  id: 'state-electricity-profiles',
  name: 'State Electricity Profiles',
  description:
    'Annual state-level electricity profile data: capability, emissions, efficiency, metering, net metering, and source disposition.',
  tags: ['state', 'electricity', 'capability', 'emissions'],
  useCases: [
    'Compare state electricity generation capability',
    'Track state emissions by fuel',
    'Analyze net metering adoption',
  ],
  subRoutes: [
    buildSubRoute('electricity', {
      id: 'state-electricity-profiles/capability',
      path: 'electricity/state-electricity-profiles/capability',
      summary: 'Capability',
      description: 'Net summer capability by state and energy source.',
      facetsHint: ['capability'],
      dateRange: { start: '1990', end: null },
    }),
    buildSubRoute('electricity', {
      id: 'state-electricity-profiles/emissions-by-state-by-fuel',
      path: 'electricity/state-electricity-profiles/emissions-by-state-by-fuel',
      summary: 'Emissions by state by fuel',
      description: 'State electricity emissions disaggregated by fuel.',
      facetsHint: ['emissions', 'fuel'],
      dateRange: { start: '1990', end: null },
    }),
    buildSubRoute('electricity', {
      id: 'state-electricity-profiles/energy-efficiency',
      path: 'electricity/state-electricity-profiles/energy-efficiency',
      summary: 'Energy efficiency',
      description: 'State energy efficiency program spending and savings.',
      facetsHint: ['efficiency'],
      dateRange: { start: '1990', end: null },
    }),
    buildSubRoute('electricity', {
      id: 'state-electricity-profiles/meters',
      path: 'electricity/state-electricity-profiles/meters',
      summary: 'Meters',
      description: 'Number of electricity meters and customer counts by state and sector.',
      facetsHint: ['meters', 'customers'],
      dateRange: { start: '1990', end: null },
    }),
    buildSubRoute('electricity', {
      id: 'state-electricity-profiles/net-metering',
      path: 'electricity/state-electricity-profiles/net-metering',
      summary: 'Net metering',
      description: 'Net metering capacity and customer counts.',
      facetsHint: ['net-metering', 'distributed'],
      dateRange: { start: '1990', end: null },
    }),
    buildSubRoute('electricity', {
      id: 'state-electricity-profiles/source-disposition',
      path: 'electricity/state-electricity-profiles/source-disposition',
      summary: 'Source and disposition',
      description: 'Sources of electricity and where it is disposed (sales, losses, etc.).',
      facetsHint: ['source', 'disposition'],
      dateRange: { start: '1990', end: null },
    }),
    buildSubRoute('electricity', {
      id: 'state-electricity-profiles/summary',
      path: 'electricity/state-electricity-profiles/summary',
      summary: 'Summary',
      description: 'High-level annual state electricity summary.',
      facetsHint: ['summary'],
      dateRange: { start: '1990', end: null },
    }),
  ],
  relatedDomains: ['electricity', 'co2-emissions', 'seds'],
}
