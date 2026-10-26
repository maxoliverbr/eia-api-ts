/**
 * EiaApiError — normalized error type for upstream EIA failures.
 */

export type EiaErrorCode =
  | 'upstream_non_2xx'
  | 'upstream_timeout'
  | 'upstream_network'
  | 'invalid_response'
  | 'rate_limited'
  | 'unauthorized'

export class EiaApiError extends Error {
  readonly code: EiaErrorCode
  readonly status: number
  readonly upstreamStatus: number | undefined
  readonly path: string
  readonly body: unknown
  /** Seconds the caller should wait before retrying (sent as `Retry-After`). */
  readonly retryAfterSec: number | undefined

  constructor(opts: {
    message: string
    code: EiaErrorCode
    status: number
    path: string
    upstreamStatus?: number
    body?: unknown
    cause?: unknown
    retryAfterSec?: number
  }) {
    super(opts.message, { cause: opts.cause })
    this.name = 'EiaApiError'
    this.code = opts.code
    this.status = opts.status
    this.upstreamStatus = opts.upstreamStatus
    this.path = opts.path
    this.body = opts.body
    this.retryAfterSec = opts.retryAfterSec
  }
}
