/**
 * Typed environment configuration.
 *
 * Loaded once at startup. EIA_API_KEY falls back to the throttled DEMO_KEY
 * for local use, but is required when NODE_ENV=production so a deploy can't
 * silently run on the shared demo key.
 */
const requireEnv = (name: string, fallback?: string): string => {
  const v = process.env[name] ?? fallback
  if (v === undefined || v === '') {
    throw new Error(`Missing required env var: ${name}`)
  }
  return v
}

const numEnv = (name: string, fallback: number): number => {
  const v = process.env[name]
  if (v === undefined || v === '') return fallback
  const n = Number(v)
  if (Number.isNaN(n)) throw new Error(`Env var ${name} must be a number, got: ${v}`)
  return n
}

export const env = {
  EIA_API_KEY: requireEnv('EIA_API_KEY', process.env.NODE_ENV === 'production' ? undefined : 'DEMO_KEY'),
  EIA_BASE_URL: process.env.EIA_BASE_URL ?? 'https://api.eia.gov',
  PORT: numEnv('PORT', 3000),
  EIA_MIN_INTERVAL_MS: numEnv('EIA_MIN_INTERVAL_MS', 5000),
} as const

export type Env = typeof env
