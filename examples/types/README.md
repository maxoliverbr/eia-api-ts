# Typed Client with Eden Treaty

**File:** [`eden.ts`](./eden.ts)

The other examples use `fetch` and declare response types by hand. This one uses [Eden Treaty](https://elysiajs.com/eden/treaty/overview), which builds a client from `typeof app`, so request bodies, response shapes, and error unions are all **inferred from the server's route definitions**. Rename a field on the server and this file fails to typecheck.

It covers the same calls as the fetch-based examples in the parent folder, so you can compare the two styles directly.

```ts
import { treaty } from '@elysiajs/eden'
import type { app } from '../../elysia.config'

const api = treaty<typeof app>('http://localhost:3000')
const { data, error } = await api.search.post({ q: 'electricity emissions' })
//      ^ fully typed      ^ typed per status code
```

## When to use it

- **Use Eden** for TypeScript code in this monorepo, or anywhere that can import the server's types.
- **Use plain `fetch`** (the other examples) for anything outside the repo, or for agent tools, where the schema comes from the LLM's tool definition rather than from TypeScript.

## Running

```bash
bun dev                          # terminal 1
bun run examples/types/eden.ts   # terminal 2
```

`@elysiajs/eden` is already a dev dependency. If it's missing, run `bun add -d @elysiajs/eden`.
