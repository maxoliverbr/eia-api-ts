/**
 * Tests for the structured logger.
 *
 * Captures `console.error` output via spyOn so we can assert on the
 * emitted JSON line. Each test resets the spy and the cached env values.
 */
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { EiaApiError } from '../src/lib/errors'
import { logRequestError, logger } from '../src/lib/logger'

const ORIGINAL_LOG_LEVEL = process.env.LOG_LEVEL
let stderrSpy: ReturnType<typeof spyOn> | null = null

function captureStderr(): { lines: string[] } {
  const lines: string[] = []
  stderrSpy = spyOn(console, 'error').mockImplementation((line: unknown) => {
    lines.push(typeof line === 'string' ? line : JSON.stringify(line))
  })
  return { lines }
}

function getLine(lines: string[]): Record<string, unknown> {
  expect(lines.length).toBeGreaterThan(0)
  return JSON.parse(lines[0]!) as Record<string, unknown>
}

beforeEach(() => {
  process.env.LOG_LEVEL = 'debug'
})

afterEach(() => {
  process.env.LOG_LEVEL = ORIGINAL_LOG_LEVEL
  stderrSpy?.mockRestore()
  stderrSpy = null
})

describe('logger', () => {
  it('emits single-line JSON with level, message, and at fields', () => {
    const { lines } = captureStderr()
    logger.info('hello world', { foo: 'bar' })
    expect(lines.length).toBe(1)
    const line = getLine(lines)
    expect(line.level).toBe('info')
    expect(line.message).toBe('hello world')
    expect(line.foo).toBe('bar')
    expect(typeof line.at).toBe('string')
  })

  it('silences lower levels when LOG_LEVEL is set higher', () => {
    process.env.LOG_LEVEL = 'warn'
    const { lines } = captureStderr()
    logger.debug('d')
    logger.info('i')
    expect(lines.length).toBe(0)
    logger.warn('w')
    expect(lines.length).toBe(1)
    expect(getLine(lines).level).toBe('warn')
  })
})

describe('logRequestError', () => {
  it('formats an EiaApiError with upstream fields and truncated body', () => {
    const { lines } = captureStderr()
    const big = 'x'.repeat(2_000)
    const err = new EiaApiError({
      message: 'Upstream EIA returned 400',
      code: 'upstream_non_2xx',
      status: 400,
      path: '/v2/co2-emissions/co2-emissions-and-carbon-coefficients/data',
      upstreamStatus: 400,
      body: { error: 'Invalid data "value" provided.', details: big },
    })
    logRequestError({
      method: 'POST',
      path: '/query',
      elysiaCode: 'INTERNAL',
      status: 400,
      error: err,
    })

    expect(lines.length).toBe(1)
    const line = getLine(lines)
    expect(line.message).toBe('request failed')
    expect(line.method).toBe('POST')
    expect(line.path).toBe('/query')
    expect(line.elysiaCode).toBe('INTERNAL')
    expect(line.status).toBe(400)
    expect(line.errorName).toBe('EiaApiError')
    expect(line.errorCode).toBe('upstream_non_2xx')
    expect(line.upstreamStatus).toBe(400)
    expect(line.upstreamPath).toBe('/v2/co2-emissions/co2-emissions-and-carbon-coefficients/data')
    expect(line.errorMessage).toBe('Upstream EIA returned 400')
    expect(typeof line.body).toBe('string')
    expect((line.body as string).length).toBeLessThanOrEqual(501) // 500 chars + ellipsis
    expect((line.body as string).endsWith('…')).toBe(true)
  })

  it('formats a plain Error with name + message', () => {
    const { lines } = captureStderr()
    const err = new TypeError('boom')
    logRequestError({
      method: 'GET',
      path: '/domains/coal',
      elysiaCode: 'INTERNAL',
      status: 500,
      error: err,
    })
    const line = getLine(lines)
    expect(line.errorName).toBe('TypeError')
    expect(line.errorMessage).toBe('boom')
  })

  it('includes stack when LOG_LEVEL=debug', () => {
    process.env.LOG_LEVEL = 'debug'
    const { lines } = captureStderr()
    const err = new Error('with stack')
    logRequestError({
      method: 'GET',
      path: '/x',
      elysiaCode: 'INTERNAL',
      status: 500,
      error: err,
    })
    const line = getLine(lines)
    expect(typeof line.stack).toBe('string')
    expect((line.stack as string).includes('Error: with stack')).toBe(true)
  })

  it('omits stack when LOG_LEVEL=info', () => {
    process.env.LOG_LEVEL = 'info'
    const { lines } = captureStderr()
    const err = new Error('no stack in prod')
    logRequestError({
      method: 'GET',
      path: '/x',
      elysiaCode: 'INTERNAL',
      status: 500,
      error: err,
    })
    const line = getLine(lines)
    expect(line.stack).toBeUndefined()
  })

  it('handles non-Error throw values', () => {
    const { lines } = captureStderr()
    logRequestError({
      method: 'POST',
      path: '/query',
      elysiaCode: 'INTERNAL',
      status: 500,
      error: 'a string error',
    })
    const line = getLine(lines)
    expect(line.errorName).toBe('string')
    expect(line.errorMessage).toBe('a string error')
  })

  it('omits the body field when EiaApiError.body is undefined', () => {
    const { lines } = captureStderr()
    const err = new EiaApiError({
      message: 'Upstream EIA network error',
      code: 'upstream_network',
      status: 502,
      path: '/v2/coal/aggregate-production/data',
    })
    logRequestError({
      method: 'GET',
      path: '/coal/data',
      elysiaCode: 'INTERNAL',
      status: 502,
      error: err,
    })
    const line = getLine(lines)
    expect(line.errorCode).toBe('upstream_network')
    expect(line.body).toBeUndefined()
  })
})
