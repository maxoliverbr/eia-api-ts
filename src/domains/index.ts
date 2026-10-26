/**
 * Barrel of all domain metadata + a typed map of all 15 domains.
 *
 * Order is roughly: projections, then by topic.
 */
import type { DomainMeta } from '../schemas/domain'
import { aeoMeta } from './aeo'
import { ieoMeta } from './ieo'
import { co2EmissionsMeta } from './co2-emissions'
import { coalMeta } from './coal'
import { crudeOilImportsMeta } from './crude-oil-imports'
import { densifiedBiomassMeta } from './densified-biomass'
import { electricityMeta } from './electricity'
import { internationalMeta } from './international'
import { naturalGasMeta } from './natural-gas'
import { nuclearOutagesMeta } from './nuclear-outages'
import { rtoMeta } from './rto'
import { sedsMeta } from './seds'
import { stateElectricityProfilesMeta } from './state-electricity-profiles'
import { steoMeta } from './steo'
import { totalEnergyMeta } from './total-energy'

export const DOMAINS: readonly DomainMeta[] = [
  aeoMeta,
  ieoMeta,
  co2EmissionsMeta,
  coalMeta,
  crudeOilImportsMeta,
  densifiedBiomassMeta,
  electricityMeta,
  internationalMeta,
  naturalGasMeta,
  nuclearOutagesMeta,
  rtoMeta,
  sedsMeta,
  stateElectricityProfilesMeta,
  steoMeta,
  totalEnergyMeta,
] as const

export const DOMAINS_BY_ID: Readonly<Record<string, DomainMeta>> = Object.fromEntries(DOMAINS.map((d) => [d.id, d]))

export const getDomain = (id: string): DomainMeta | undefined => DOMAINS_BY_ID[id]

/**
 * Resolve the canonical upstream EIA path for a (domain, sub-route id) pair.
 *
 * Most domains store their sub-routes at `/v2/{domain}/{id}/...`, but a few
 * (rto, state-electricity-profiles, aeo, ieo, co2-emissions) use a different
 * upstream namespace declared in each sub-route's `path` field. Unknown
 * domains or sub-routes fall back to `{domain}/{subRouteId}` so power-users
 * can still hit ad-hoc upstream paths. Returns the path without `/data`.
 */
export const resolveUpstreamPath = (domain: string, subRouteId: string): string =>
  DOMAINS_BY_ID[domain]?.subRoutes.find((s) => s.id === subRouteId)?.path ??
  `${domain}/${subRouteId.replace(/^\/+/, '')}`
