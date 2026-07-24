---
type: module
name: web-demo-platform
display_name: Web UI & Mini-Demo Platform
status: active
file_locations:
  entry_points: ["src/server/app.ts"]
  controllers: ["src/server/app.ts", "demos/data/routes.ts"]
  models: ["src/server/app.ts (DemoCard)"]
  services: ["src/server/app.ts (mountDemos)"]
  views: ["web/index.html", "web/app.html", "demos/data/page.html"]
  tests: []
  config: ["demos/data/meta.json", "demos/agno/meta.json", "demos/crewai/meta.json", "demos/llamaindex/meta.json", "demos/parasail/meta.json", "demos/pica/meta.json", "demos/replit/meta.json"]
patterns:
  - type: convention-based auto-loader (drop-in directory)
    count: 1
    example: src/server/app.ts (mountDemos)
  - type: dynamic import of transpiled router
    count: 1
    example: src/server/app.ts
  - type: self-contained inline-CSS/JS page
    count: 3
    example: web/app.html
  - type: in-memory session store (Map)
    count: 1
    example: src/server/app.ts (sessions)
dependencies:
  internal: ["scan-orchestration", "covenant-kernel", "synthetic-corpus", "youcom-integration"]
  external: ["express", "node:fs", "node:path", "node:url"]
  database_tables: ["fixtures/*.json (via /api/corpus, /api/data)"]
migration:
  coupling_score: 0.50
  session_dependencies: 0
  global_dependencies: 2
  singleton_dependencies: ["app (Express)", "sessions (Map)"]
  pattern_consistency: 0.8
  abstraction_boundary: partial
  testability: medium
  estimated_effort: medium
  blockers: ["Express-coupled", "in-memory sessions Map (non-persistent, single-instance)", "process.env.PORT/YDC_API_KEY"]
---

# Web UI & Mini-Demo Platform

The presentation + hosting domain. One Express service (`src/server/app.ts`) serves the landing
launcher and the Sentinel desk, exposes the core API, and **auto-mounts every mini-demo** under
`demos/`. The most framework-coupled domain (coupling 0.50) — and the only place with in-process
mutable state.

## The Express service (`src/server/app.ts`)

| Route | Purpose |
|---|---|
| `GET /` (static) | `web/index.html` — the landing launcher |
| `GET /app` | `web/app.html` — the Sentinel desk |
| `GET /api/health` | `{ ok, youcom_key, service }` — Render health check |
| `POST /api/scan` | `runScan()`, cache in `sessions` by `scan_id` |
| `POST /api/attest` | `applyAttestation()` (looks scan up by `scan_id`) |
| `GET /api/corpus` | assess all 6 borrowers × periods × covenants (desk panel) |
| `GET /<slug>`, `/api/<slug>/*` | per-demo, mounted by `mountDemos()` |
| `GET /api/demos` | the demo registry the landing page renders |

State: `sessions = new Map<string, ScanResult>()` — the only mutable in-process state, non-persistent.

## The mini-demo auto-mount (the distinctive architecture)

`mountDemos()` scans `demos/`, and for each `demos/<slug>/` with a `meta.json`:

- parses `meta.json` (`{ name, blurb, accent, status?, order? }`) into a `DemoCard` (bad JSON →
  skip, not crash);
- if `page.html` exists → serves it at `GET /<slug>` + static sibling assets;
- if `routes.ts`/`routes.js` exists → `await import(...)`, mount the default-export Router at
  `/api/<slug>` (failures logged, never fatal).

**Drop in a directory and it appears — no edits to any shared file.** This enables unlimited parallel
demo development. See [ADR-0009](../../decisions/0009-mini-demo-auto-mount.md) and the
[bootstrap chain](../../atlas/bootstrap-chain.md).

### The demo registry

| Slug | Name | Status | Notes |
|---|---|---|---|
| `youcom` | You.com | **live** | Search + ARI + balance explorer ([youcom-integration](../youcom-integration/index.md)) |
| `data` | Data | **live** | the corpus explorer (`routes.ts` + `page.html`) |
| `crewai`, `parasail`, `llamaindex`, `agno`, `replit`, `pica` | (vendors) | soon | `meta.json`-only stubs → greyed "coming soon" cards |

## The three first-party pages (self-contained HTML)

- **`web/index.html`** — the landing launcher. Hero = the money-shot flip; a grid of mini-demo cards
  populated at runtime from `GET /api/demos` (so new demos appear with no edit here).
- **`web/app.html`** — the Sentinel desk. Left: the Thornwick tile (flips 6.47×→7.59×) + the attest
  gate + a corpus table. Right: the animated scoreboard, the You.com Search headline, and the ARI
  cited brief. A LIVE/PRERUN mode toggle drives `/api/scan`.
- **`demos/data/page.html`** — the corpus explorer: pick a borrower, see every period/covenant
  recomputed live vs the oracle, with conflict/drift/memory flags.

Each page inlines all CSS + JS, shares the dark palette, and renders honesty chips from API labels.

## Coupling notes (0.50 — partial)

- **Express-coupled** (routing, static, JSON, Router) — the framework touch point of the whole repo.
- **`sessions` Map** is non-persistent and single-instance: a restart or a second Render instance
  loses scan state (fine for a single-instance demo; a blocker for horizontal scale).
- Reads `process.env.PORT` and `process.env.YDC_API_KEY` (via the health check).
- **Dynamic import** of demo routers relies on tsx transpiling `.ts` on import.

## Related

Cards: [`app.ts`](../../cards/web-demo-platform/app.md) ·
[`web/app.html`](../../cards/web-demo-platform/app-html.md) · Sitemap:
[page/route sitemap](../../diagrams/designer/sitemap.html).
