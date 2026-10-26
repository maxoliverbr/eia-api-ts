/**
 * FIFO serializing rate limiter: at most one call *starts* per
 * `minIntervalMs`. Spacing is measured between call starts, so a slow
 * response body does not further delay the queue.
 *
 * Back-pressure, so the queue can't grow without bound:
 *   - `schedule` rejects with `LimiterBusyError` instead of queueing when
 *     the projected wait exceeds `maxWaitMs`.
 *   - `pause(ms)` holds every queued and future call (used after an
 *     upstream 429). Queued calls that would outwait `maxWaitMs` are
 *     rejected rather than left hanging.
 *   - A queued call whose `signal` aborts (caller gone) is dropped without
 *     using a slot.
 *
 * Scope is per-process — every scheduled call in this process shares the
 * same clock. A `minIntervalMs` of 0 (or less) disables spacing; pauses
 * still apply.
 */
export class LimiterBusyError extends Error {
  constructor(
    readonly retryAfterMs: number,
    readonly paused: boolean,
  ) {
    super(paused ? 'Upstream EIA cool-down in effect' : 'Upstream EIA request queue is full')
    this.name = 'LimiterBusyError'
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export class RateLimiter {
  private tail: Promise<unknown> = Promise.resolve()
  private lastStartAt = 0
  private pausedUntil = 0
  private queued = 0

  constructor(
    private readonly minIntervalMs: number,
    private readonly maxWaitMs = 60_000,
  ) {}

  /** Hold all calls until `ms` from now. Never shortens an existing pause. */
  pause(ms: number): void {
    this.pausedUntil = Math.max(this.pausedUntil, Date.now() + ms)
  }

  /** Remaining pause in ms; 0 when not paused. */
  get pausedFor(): number {
    return Math.max(0, this.pausedUntil - Date.now())
  }

  schedule<T>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    const interval = Math.max(0, this.minIntervalMs)
    if (interval === 0 && this.pausedFor === 0) return fn()

    const now = Date.now()
    const nextStart = Math.max(now, this.pausedUntil, this.lastStartAt + interval)
    const projected = nextStart - now + this.queued * interval
    if (projected > this.maxWaitMs) {
      return Promise.reject(new LimiterBusyError(projected, this.pausedFor > 0))
    }

    this.queued++
    const slot = this.tail.then(async (): Promise<LimiterBusyError | 'aborted' | 'go'> => {
      try {
        // Loop: a pause can start or grow while we sleep.
        for (;;) {
          if (this.pausedFor > this.maxWaitMs) return new LimiterBusyError(this.pausedFor, true)
          const wait = Math.max(this.pausedUntil, this.lastStartAt + interval) - Date.now()
          if (wait <= 0) break
          await sleep(wait)
        }
        if (signal?.aborted) return 'aborted'
        this.lastStartAt = Date.now()
        return 'go'
      } finally {
        this.queued--
      }
    })
    // The tail advances when the slot is granted, not when fn settles, and
    // the slot itself never rejects — a failing fn can't poison the queue.
    this.tail = slot
    return slot.then((outcome) => {
      if (outcome === 'go') return fn()
      throw outcome === 'aborted' ? signal!.reason : outcome
    })
  }
}
