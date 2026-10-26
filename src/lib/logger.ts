/**
 * Tiny structured logger.
 *
 * Zero dependencies. Emits single-line JSON to stderr so the output
 * is friendly to log aggregators (Loki, CloudWatch, Datadog, etc.) and
 * to `docker logs`. When `LOG_LEVEL=debug`, pretty-prints the JSON for
 * human readability during development.
 *
 * Respects the existing `LOG_LEVEL` env var (see `src/config/env.ts`).
 * Order: `debug (10) < info (20) < warn (30) < error (40)`. Setting
 * `LOG_LEVEL=warn` silences `info` and `debug`.
 *
 * Reads `process.env.LOG_LEVEL` at every call so tests can flip the
 * level without re-importing the module. Default is `info`.
 */
import { EiaApiError } from './errors'

type Level = 'debug' | 'info' | 'warn' | 'error'

const LEVELS: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

/** Read and validate the current LOG_LEVEL at call time. */
function currentLogLevel(): Level {
  const raw = (process.env.LOG_LEVEL ?? 'info').toLowerCase()
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') {
    return raw
  }
  return 'info'
}

const shouldLog = (level: Level): boolean =>
  LEVELS[level] >= LEVELS[currentLogLevel()]

/**
 * Truncate a value (string or object) to ~500 characters of JSON
 * representation. Used for upstream response bodies, which can be
 * large but we want a short, safe preview in the log.
 */
function truncateBody(body: unknown, max = 500): string | undefined {
  if (body === undefined || body === null) return undefined
  const asString = typeof body === 'string' ? body : safeStringify(body)
  if (asString === undefined) return undefined
  return asString.length > max ? `${asString.slice(0, max)}…` : asString
}

function safeStringify(value: unknown): string | undefined {
  try {
    return JSON.stringify(value)
  } catch {
    return undefined
  }
}

function emit(level: Level, message: string, fields?: Record<string, unknown>): void {
  if (!shouldLog(level)) return
  const entry = { at: new Date().toISOString(), level, message, ...(fields ?? {}) }
  // eslint-disable-next-line no-console
  console.error(JSON.stringify(entry, null, currentLogLevel() === 'debug' ? 2 : undefined))
}

export const logger = {
  debug: (message: string, fields?: Record<string, unknown>): void =>
    emit('debug', message, fields),
  info: (message: string, fields?: Record<string, unknown>): void =>
    emit('info', message, fields),
  warn: (message: string, fields?: Record<string, unknown>): void =>
    emit('warn', message, fields),
  error: (message: string, fields?: Record<string, unknown>): void =>
    emit('error', message, fields),
}

export type LogFields = Record<string, unknown>

/**
 * Format an error that came out of an Elysia route handler into a single
 * structured log line. The result is emitted to stderr via `logger.error`.
 *
 * Covers:
 *   - `EiaApiError` — includes the upstream path, upstream status, the
 *     `EiaErrorCode`, and a truncated preview of the upstream body.
 *   - Any other `Error` — name, message, and stack (stack only when
 *     `LOG_LEVEL=debug` to keep prod output tight).
 *   - Anything else — `typeof` + `String(value)`.
 */
export function logRequestError(args: {
  method: string
  path: string
  elysiaCode?: string
  status: number
  error: unknown
}): void {
  const { method, path, status, error } = args
  const elysiaCode = args.elysiaCode ?? 'HANDLER'
  const base: LogFields = {
    method,
    path,
    elysiaCode,
    status,
  }

  if (error instanceof EiaApiError) {
    const truncated = truncateBody(error.body)
    logger.error('request failed', {
      ...base,
      errorName: error.name,
      errorCode: error.code,
      upstreamStatus: error.upstreamStatus,
      upstreamPath: error.path,
      errorMessage: error.message,
      ...(truncated !== undefined ? { body: truncated } : {}),
    })
    return
  }

  if (error instanceof Error) {
    logger.error('request failed', {
      ...base,
      errorName: error.name,
      errorMessage: error.message,
      ...(currentLogLevel() === 'debug' && error.stack
        ? { stack: error.stack }
        : {}),
    })
    return
  }

  logger.error('request failed', {
    ...base,
    errorName: typeof error,
    errorMessage: String(error),
  })
}
