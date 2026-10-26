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

  async get<T>(path: string): Promise<T> {
    this.assertSafePath(path)
    const res = await this.fetchImpl(`${this.baseUrl}${path}`)
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`GET ${path} → ${res.status} ${body.slice(0, 200)}`)
    }
    return (await res.json()) as T
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    this.assertSafePath(path)
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`POST ${path} → ${res.status} ${text.slice(0, 200)}`)
    }
    return (await res.json()) as T
  }
}
