# Repository Agent Instructions

## Package manager: BUN ONLY

This repository uses **Bun** as the sole package manager and JavaScript runtime.
Do **not** invoke `npm`, `pnpm`, `yarn`, or `npx` under any circumstance.

- Use `bun install` instead of `npm install`
- Use `bun add <pkg>` instead of `npm install <pkg>`
- Use `bunx <bin>` instead of `npx <bin>`
- Use `bun run <script>` instead of `npm run <script>`
- Use `bun <script.ts>` to run TypeScript directly instead of `node` + `tsc`

This rule applies to **every** sub-project in this repository, including:

- The root Elysia server (`package.json` at repo root)
- `docs-site/` — the Starlight documentation site (`package.json` inside `docs-site/`)

If a tool, dependency, or example command suggests `npm` or `pnpm`, rewrite it to
the equivalent `bun` / `bunx` command before executing or documenting it.

## Layout

```
.
├── src/             # Elysia server (Bun runtime, TypeBox schemas, routes)
├── docs-site/       # Starlight (Astro) documentation site — deploys to Dokploy
├── examples/        # Runnable examples for the Elysia server
├── eia-api-swagger.yaml  # Bundled EIA OpenAPI 2.0 spec
└── package.json     # Elysia server manifest
```

## Documentation site

`docs-site/` is a static Astro + Starlight site. Authoring rules:

- Markdown/MDX pages go in `docs-site/src/content/docs/`
- Sidebar order is controlled by `docs-site/astro.config.mjs` (do not rely on
  file-system order — Starlight reorders by config)
- Bun is the package manager; the site has its own `package.json` and `bun.lock`
- Deploy via Dockerfile (`docs-site/Dockerfile`) on Dokploy; do not add
  Netlify/Vercel configs