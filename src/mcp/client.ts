/**
 * Client for the MCP layer. Tools call the wrapper's own REST routes
 * in-process via `app.handle()` — no network hop, no port to configure.
 * The EIA rate limit and cache still apply: they live in `EiaClient`.
 *
 * EIA_API_KEY is held server-side; this client never touches it.
 */

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export type McpClientOptions = {
  baseUrl?: string
  /** Test seam — production dispatches to the in-process Elysia app. */
  fetchImpl?: FetchLike
}

// Lazy import: elysia.config mounts the MCP route that constructs this client.
const handleInProcess: FetchLike = async (input, init) => {
  const { app } = await import('../../elysia.config')
  return app.handle(new Request(input, init))
}

export class McpClient {
  private readonly baseUrl: string
  private readonly fetchImpl: FetchLike

  constructor(opts: McpClientOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? 'http://localhost').replace(/\/+$/, '')
    this.fetchImpl = opts.fetchImpl ?? handleInProcess
  }

  /**
   * Paths embed caller-supplied ids (tool args, resource URIs). Reject
   * backslashes and dot segments: URL parsing normalizes them, which would
   * let an id escape its intended route on the wrapper.
   */
  private assertSafePath(path: string): void {
    const pathname = path.split('?')[0]!
    if (pathname.includes('\\') || pathname.split('/').some((s) => s === '..' || s === '.')) {
      throw new Error(`Invalid path: ${pathname}`)
    }
  }

  get<T>(path: string): Promise<T> {
    return this.call<T>(path)
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return this.call<T>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    this.assertSafePath(path)
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, init)
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`${init?.method ?? 'GET'} ${path} → ${res.status} ${text.slice(0, 200)}`)
    }
    return (await res.json()) as T
  }
}
