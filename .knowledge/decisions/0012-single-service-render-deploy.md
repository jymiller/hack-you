---
type: decision
id: ADR-0012
title: One Express service, run via tsx, deployed on Render with in-memory state
status: inferred
date_inferred: 2026-07-24
scope: system-wide
affects: ["web-demo-platform", "infrastructure"]
migration_impact: medium
migration_notes: "The in-memory sessions Map and single-instance assumption are the productionization blockers."
---

# ADR-0012 · Single service, tsx runtime, Render deploy

## Context

A hackathon needs the shortest path from "code written on the day" to "a live URL judges can visit",
with no build pipeline to babysit and no infrastructure to stand up.

## Decision

Ship **one Node/Express service** run directly through **tsx** (no compile step, no `dist/`), serving
both the UI and the API, and deploy it via a **Render Blueprint** (`render.yaml`: `npm ci` → `npm
start`, health check `/api/health`, `YDC_API_KEY` as a dashboard secret). Scan state lives in an
**in-memory `Map`** keyed by `scan_id`. Without the key the service still runs in labeled fallback
mode.

## Consequences

- Fast iteration: edit `.ts`, restart, done. Production runs the same `.ts` as dev.
- Two real productionization limits: (1) the `sessions` Map is non-persistent and single-instance — a
  Render restart or a second instance loses scan state, so `/api/attest` would 404; (2) `render.yaml`
  defaults to Render's **free** plan, which cold-starts after idle (the deploy guide recommends
  Starter or pre-warming for the live demo).
- No auth, no CORS, no rate limiting, no database — appropriate for a demo, not for multi-tenant use.
- The dynamic `import()` of demo routers depends on tsx transpiling `.ts` at runtime.

## Evidence

`package.json`, `render.yaml`, `DEPLOY.md`, `src/server/app.ts` (`sessions` Map, `mountDemos`). See
the [infrastructure map](../maps/infrastructure/index.md) and
[readiness overview](../migration/readiness-overview.md).
