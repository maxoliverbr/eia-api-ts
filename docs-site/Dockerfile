# Multi-stage build for the eia-api-ts Starlight documentation site.
# Produces a tiny nginx-based image that serves the static `dist/` output.
#
# Local preview:  docker build -t eia-docs . && docker run --rm -p 8080:8080 eia-docs
# Dokploy:        set Build Type = Dockerfile; Dokploy detects this file and
#                 serves the resulting image on its internal port 8080.

# ---------------------------------------------------------------------------
# 1. Build stage — Bun to install deps, Node to run Astro (Astro doesn't yet
#    have an official Bun adapter for the build step; we install with bun and
#    run the build with Node, matching what the Astro team tests against).
# ---------------------------------------------------------------------------
FROM oven/bun:1.3-alpine AS deps
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY astro.config.mjs ./
COPY tsconfig.json ./
COPY src ./src
COPY public ./public
RUN node ./node_modules/astro/astro.js build

# ---------------------------------------------------------------------------
# 2. Runtime stage — nginx serving the static build on port 8080 (Dokploy's
#    internal convention; Dokploy handles TLS + reverse proxy in front).
# ---------------------------------------------------------------------------
FROM nginx:1.31-alpine
COPY --from=build /app/dist /usr/share/nginx/html
RUN sed -i 's/listen       80;/listen       8080;/' /etc/nginx/conf.d/default.conf
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null 2>&1 || exit 1
CMD ["nginx", "-g", "daemon off;"]