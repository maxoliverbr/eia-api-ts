/**
 * Elysia route for the MCP endpoint. `createMcpHandler` from
 * @modelcontextprotocol/server returns a web-standard `{ fetch }` handler —
 * Elysia passes a standard `Request` (Bun is Web-Standards native) and
 * accepts a `Response` return value, so the bridge is one line.
 */
import { Elysia } from 'elysia'
import { createHandler } from '../mcp'
import { McpClient } from '../mcp/client'

const handler = createHandler(new McpClient())

export const mcpRoutes = new Elysia({ tags: ['MCP'] }).all('/mcp', ({ request }) => handler.fetch(request))
