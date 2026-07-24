---
type: atlas
title: Bootstrap Chain — process start to ready-to-serve
last_analyzed: 2026-07-24
bootstrap_chain:
  - step: 1
    file: package.json
    role: "`npm start` → `tsx src/server/app.ts`. tsx transpiles TypeScript/ESM on the fly; no build step. type=module, engines node>=20."
  - step: 2
    file: src/server/app.ts
    role: "Resolve ROOT and DEMOS_DIR from import.meta.url; process.loadEnvFile('.env') inside try/catch (missing .env → offline fallback mode, not a crash)."
  - step: 3
    file: src/server/app.ts
    role: "Create the Express app; app.use(express.json()); app.use(express.static('web')) so the landing page is served at /."
  - step: 4
    file: src/server/app.ts
    role: "Register core routes: GET /api/health, GET /app (Sentinel desk), POST /api/scan, POST /api/attest, GET /api/corpus."
  - step: 5
    file: src/server/app.ts
    role: "await mountDemos() — scan demos/ synchronously, JSON-parse each meta.json, register GET /<slug> + static assets for any page.html, and dynamic-import routes.ts as an Express Router at /api/<slug>."
  - step: 6
    file: demos/*/routes.ts
    role: "Each mounted routes.ts is transpiled on import by tsx and returns an express.Router (default export). youcom + data are the live ones."
  - step: 7
    file: src/server/app.ts
    role: "Build the /api/demos registry from the scan, sort by (order, name), then app.listen(PORT ?? 8080) and log the live/soon demo slugs and whether YDC_API_KEY is present."
data_flows:
  - name: Cold start
    path: ["package.json", "src/server/app.ts", "process.loadEnvFile", "mountDemos()", "app.listen(8080)"]
    description: "From `npm start` to an HTTP server with all demos auto-mounted."
---

# Bootstrap Chain

Covenant Sentinel is a **single Node/Express service** run through **tsx** (TypeScript executed
directly, no compile step). There is no framework scaffolding, DI container, or ORM — the startup
sequence is short and explicit. Trace it from `npm start` to "ready to serve requests".

## 1 · Entry — `npm start`

`package.json` maps `start` → `tsx src/server/app.ts`. `tsx` (a dependency, not just a dev tool)
transpiles ESM TypeScript on import, so `src/server/app.ts` — and every `routes.ts` it later
imports — runs without a build artifact. `"type": "module"` makes the whole repo ESM;
`engines.node` requires **Node ≥ 20** (needed for `process.loadEnvFile` and global `fetch`).

Related scripts: `npm run dev` (tsx watch), `npm test` (vitest), `npm run demo`
(`tsx scripts/demo.ts`), `npm run smoke` (`tsx scripts/youcom-smoke.ts`), `npm run typecheck`
(`tsc --noEmit`).

## 2 · Environment — `.env` is optional

```ts
try { process.loadEnvFile(join(ROOT, ".env")); }
catch { /* no .env — offline/fallback mode */ }
```

This is deliberate: a **missing `.env` is a supported mode**, not an error. Without `YDC_API_KEY`
the app still boots and every You.com call degrades to a labeled fallback (Search → SYNTHETIC
fixture, ARI → the genuine PRERUN cache). See [ADR-0008](../decisions/0008-youcom-two-endpoints-fallback.md).

## 3 · Express app + static

`express.json()` parses request bodies; `express.static(ROOT/web)` serves the landing launcher
(`web/index.html`) at `/`. The Sentinel desk (`web/app.html`) is served explicitly at `/app`.

## 4 · Core routes (the flagship desk)

| Method + path | Handler | Purpose |
|---|---|---|
| `GET /api/health` | inline | `{ ok, youcom_key: !!YDC_API_KEY, service }` — Render health check |
| `GET /app` | `sendFile app.html` | the Sentinel desk UI |
| `POST /api/scan` | `runScan()` | the money-shot scan; caches result in an in-memory `sessions` Map by `scan_id` |
| `POST /api/attest` | `applyAttestation()` | the human gate; looks the scan up by `scan_id` |
| `GET /api/corpus` | inline sweep | assesses all 6 borrowers × periods × covenants for the desk's corpus panel |

`sessions` is a module-level `Map<string, ScanResult>` — the only in-process state, and it is
non-persistent (see [ADR-0012](../decisions/0012-single-service-render-deploy.md)).

## 5 · Mini-demo auto-mount — `mountDemos()`

The distinctive step. `mountDemos()` scans `demos/` and, for each `demos/<slug>/` directory with a
`meta.json`:

1. Parses `meta.json` (`{ name, blurb, accent, status?, order? }`) into a `DemoCard`. A bad
   `meta.json` logs an error and **skips that demo** rather than crashing the boot.
2. If `page.html` exists → `GET /<slug>` serves it, and `express.static(dir)` serves sibling assets.
3. If `routes.ts` (or `routes.js`) exists → `await import(pathToFileURL(routesPath))`, take
   `default ?? router`, and mount it at `/api/<slug>`. Failures are caught and logged, never fatal.

The registry is then sorted by `(order, name)` and exposed at `GET /api/demos`, which the landing
page fetches to render its grid. **Drop a directory into `demos/` and it appears — no edits to any
shared file.** See [ADR-0009](../decisions/0009-mini-demo-auto-mount.md) and the
[web-demo-platform map](../maps/web-demo-platform/index.md).

Currently live: `demos/youcom/` (You.com Explorer) and `demos/data/` (corpus explorer). Six more
(`agno`, `crewai`, `llamaindex`, `parasail`, `pica`, `replit`) ship as `status:"soon"` stubs —
`meta.json` only, no `page.html`, so they render as greyed-out "coming soon" cards.

## 6 · Listen

`app.listen(PORT ?? 8080)` logs the URL, whether the You.com key is present, and the demo slugs.
On Render, `PORT` is injected by the platform; locally it defaults to 8080.

## What is *not* in the bootstrap

- **No database connection.** The "data layer" is JSON on disk read synchronously per request
  ([synthetic-corpus](../maps/synthetic-corpus/index.md)).
- **No middleware stack** beyond `express.json` + `express.static`. No auth, sessions, CORS, or
  rate limiting.
- **No kernel initialization.** `assess()` is a pure function imported where needed; it holds no
  state and needs no wiring.
