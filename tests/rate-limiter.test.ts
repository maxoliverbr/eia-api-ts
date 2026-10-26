import { describe, expect, it } from 'bun:test'
import { LimiterBusyError, RateLimiter } from '../src/lib/rate-limiter'

// Timer jitter can fire setTimeout slightly early, so assert gaps with a
// small tolerance instead of exact equality.
const INTERVAL = 30
const MIN_GAP = INTERVAL - 5

describe('RateLimiter', () => {
  it('runs scheduled calls FIFO with at least minIntervalMs between starts', async () => {
    const limiter = new RateLimiter(INTERVAL)
    const starts: Array<{ id: number; at: number }> = []
    const task = (id: number) => async () => {
      starts.push({ id, at: Date.now() })
      return id
    }
    const results = await Promise.all([
      limiter.schedule(task(1)),
      limiter.schedule(task(2)),
      limiter.schedule(task(3)),
    ])
    expect(results).toEqual([1, 2, 3])
    expect(starts.map((s) => s.id)).toEqual([1, 2, 3])
    for (let i = 1; i < starts.length; i++) {
      expect(starts[i]!.at - starts[i - 1]!.at).toBeGreaterThanOrEqual(MIN_GAP)
    }
  })

  it('a rejected task does not poison the queue', async () => {
    const limiter = new RateLimiter(INTERVAL)
    const first = limiter.schedule(async () => {
      throw new Error('boom')
    })
    const second = limiter.schedule(async () => 'ok')
    await expect(first).rejects.toThrow('boom')
    expect(await second).toBe('ok')
  })

  it('minIntervalMs <= 0 bypasses spacing entirely', async () => {
    const limiter = new RateLimiter(0)
    const t0 = Date.now()
    const results = await Promise.all([
      limiter.schedule(async () => 1),
      limiter.schedule(async () => 2),
      limiter.schedule(async () => 3),
    ])
    expect(results).toEqual([1, 2, 3])
    expect(Date.now() - t0).toBeLessThan(20)
  })

  it('does not add spacing when calls are already far apart', async () => {
    const limiter = new RateLimiter(INTERVAL)
    await limiter.schedule(async () => 1)
    await new Promise((r) => setTimeout(r, INTERVAL + 10))
    const t0 = Date.now()
    await limiter.schedule(async () => 2)
    expect(Date.now() - t0).toBeLessThan(15)
  })

  it('holds calls during a pause, even with spacing disabled', async () => {
    const limiter = new RateLimiter(0)
    limiter.pause(INTERVAL)
    const t0 = Date.now()
    await limiter.schedule(async () => 1)
    expect(Date.now() - t0).toBeGreaterThanOrEqual(MIN_GAP)
  })

  it('rejects immediately when a pause outlasts maxWaitMs', async () => {
    const limiter = new RateLimiter(INTERVAL, 100)
    limiter.pause(10_000)
    const err = await limiter.schedule(async () => 1).catch((e) => e)
    expect(err).toBeInstanceOf(LimiterBusyError)
    expect(err.paused).toBe(true)
    expect(err.retryAfterMs).toBeGreaterThan(9_000)
  })

  it('rejects queued calls when a long pause starts while they wait', async () => {
    const limiter = new RateLimiter(INTERVAL, 100)
    await limiter.schedule(async () => 0)
    const queued = limiter.schedule(async () => 1).catch((e) => e)
    limiter.pause(10_000)
    expect(await queued).toBeInstanceOf(LimiterBusyError)
  })

  it('drops an aborted queued call without using its slot', async () => {
    const limiter = new RateLimiter(INTERVAL)
    const ran: number[] = []
    await limiter.schedule(async () => ran.push(0))
    const ctrl = new AbortController()
    const dropped = limiter.schedule(async () => ran.push(1), ctrl.signal).catch((e) => e)
    ctrl.abort()
    expect((await dropped).name).toBe('AbortError')
    expect(ran).toEqual([0])
  })
})
