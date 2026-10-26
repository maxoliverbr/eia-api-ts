# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report privately via GitHub: **Security → Report a vulnerability**
(<https://github.com/maxoliverbr/eia-api-ts/security/advisories/new>).

Include what you found, how to reproduce it, and the impact. You should get a
reply within 7 days.

## Supported versions

Only the latest commit on `main` receives fixes.

## Deployment notes

- Keep `EIA_API_KEY` in the environment; never commit `.env`.
- `/mcp` applies no Host/Origin validation. Keep it on a trusted network or
  behind a reverse proxy, or leave `MCP_ENABLED=false`.
