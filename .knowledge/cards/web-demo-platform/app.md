---
type: card
module: web-demo-platform
file: src/server/app.ts
complexity: high
lines: 158
last_analyzed: 2026-07-24
migration:
  global_refs: ["process.env.PORT", "process.env.YDC_API_KEY", "process.loadEnvFile"]
  session_keys_read: []
  session_keys_written: []
  db_tables_touched: ["fixtures/*.json (via /api/corpus)"]
  side_effects: ["binds a TCP port (app.listen)", "reads demos/ + web/ from disk", "dynamic import() of demo routes", "in-memory sessions Map"]
  singleton_pattern: true
  extractable: false
  extraction_notes: "The framework-coupled entry point. Express app + in-memory sessions Map + dynamic import. Not a library — it's the process. Extract pieces (mountDemos, the sweep) rather than the whole."
---

# `src/server/app.ts` — the Express server + demo auto-loader

The process entry point (`npm start` → `tsx src/server/app.ts`) and the most framework-coupled file.
Serves the UIs, exposes the core API, and auto-mounts every mini-demo.

## Boot sequence

1. Resolve `ROOT`/`DEMOS_DIR` from `import.meta.url`; `process.loadEnvFile('.env')` in a try/catch
   (missing `.env` → fallback mode, not a crash).
2. `express()` + `express.json()` + `express.static(web)`.
3. Register core routes (below).
4. `await mountDemos()` — scan `demos/`, mount pages + routers.
5. `app.listen(PORT ?? 8080)` and log the live/soon demo slugs + whether the key is present.

## Core routes

| Route | Handler |
|---|---|
| `GET /api/health` | `{ ok, youcom_key: !!YDC_API_KEY, service }` |
| `GET /app` | `sendFile web/app.html` |
| `POST /api/scan` | `runScan(nowIso(), mode)`; cache in `sessions` by `scan_id`; 500 on throw |
| `POST /api/attest` | look scan up by `scan_id`; `applyAttestation(...)`; 404 if unknown / no proposal, 400 if bad decision |
| `GET /api/corpus` | assess all 6 borrowers × periods × covenants → rows for the desk panel |

## The `sessions` Map — the only mutable state

`const sessions = new Map<string, ScanResult>()`. A scan is cached so the later attest can find its
proposal. **Non-persistent and single-instance**: a restart or a second Render instance loses it. The
one real productionization blocker (see [readiness](../../migration/readiness-overview.md)).

## `mountDemos()` — the auto-loader

For each `demos/<slug>/` with a `meta.json`: parse it into a `DemoCard` (bad JSON → skip, logged); if
`page.html` exists → `GET /<slug>` + `express.static(dir, {index:false})`; if `routes.ts`/`routes.js`
exists → `await import(pathToFileURL(routesPath))`, mount `mod.default ?? mod.router` at
`/api/<slug>` (failures logged, non-fatal). Sort by `(order, name)`, expose at `GET /api/demos`.

**Dynamic `import()` of a `.ts` file works because tsx transpiles on import** — this is the coupling
to the tsx runtime. Drop a directory in and it appears; no shared-file edit. See
[ADR-0009](../../decisions/0009-mini-demo-auto-mount.md).

## Robustness choices

- Missing `.env`, bad `meta.json`, and failing `routes.ts` are all **non-fatal** — the server boots in
  a degraded-but-labeled state rather than crashing. This is the "demo never dies" posture from
  `DEMO-SCRIPT.md`.
- `nowIso()` is `new Date().toISOString()` — the only wall-clock read, injected into `runScan`/
  `applyAttestation` (which are otherwise pure).

## Depends on

`express`, `node:fs`/`path`/`url`, `scan.ts`, `corpus.ts`, `assess.ts`, `eval/helpers.ts`. Related:
[bootstrap-chain](../../atlas/bootstrap-chain.md),
[ADR-0012](../../decisions/0012-single-service-render-deploy.md).
