/**
 * Dump the generated OpenAPI 3.1 spec to ./openapi.json.
 *
 *   bun run dump-openapi
 *
 * Hits the in-process `/openapi/json` route — no server needs to be running.
 */
import { writeFileSync } from 'node:fs'
import { app } from '../elysia.config'

const res = await app.handle(new Request('http://localhost/openapi/json'))
const text = await res.text()
writeFileSync('openapi.json', text)
console.log(`Wrote openapi.json (${text.length} bytes)`)
