---
type: module
name: infrastructure
display_name: Build & Deploy Infrastructure
status: active
file_locations:
  entry_points: ["package.json", "render.yaml"]
  controllers: []
  models: []
  services: []
  views: []
  tests: []
  config: ["package.json", "tsconfig.json", "render.yaml", ".env.example", ".claude/launch.json", ".gitignore", "DEPLOY.md"]
patterns:
  - type: no-build ESM toolchain (tsx)
    count: 1
    example: package.json
  - type: infrastructure-as-code (Render Blueprint)
    count: 1
    example: render.yaml
dependencies:
  internal: []
  external: ["tsx", "typescript", "vitest", "Render", "AWS"]
  database_tables: []
migration:
  coupling_score: 0.15
  session_dependencies: 0
  global_dependencies: 0
  singleton_dependencies: []
  pattern_consistency: 0.9
  abstraction_boundary: clean
  testability: high
  estimated_effort: small
  blockers: ["free Render plan cold-starts", "in-memory sessions blocks multi-instance"]
---

# Build & Deploy Infrastructure

The bootstrap/config domain: how the app is built, typed, run, and deployed. Deliberately minimal —
no bundler, no Dockerfile, no CI config in-repo; a no-build ESM toolchain and a single Render
Blueprint.

## The files

| File | Role |
|---|---|
| `package.json` | scripts (start/dev/test/demo/smoke/typecheck), 2 runtime deps (express, tsx), `type:module`, node≥20 |
| `tsconfig.json` | strict TS, `target ES2022`, `module NodeNext`, `noEmit`, includes `src`/`scripts`/`demos` |
| `render.yaml` | Render Blueprint — web service, `npm ci` → `npm start`, health check `/api/health`, `YDC_API_KEY` as a dashboard secret |
| `DEPLOY.md` | step-by-step Render deploy (redeem credit → Blueprint → add key → avoid cold starts) |
| `.env.example` | the env contract: `YDC_API_KEY`, AWS placeholders, `PORT` (default 8080) |
| `.claude/launch.json` | local launch config (`npm run start`, port 8080) |
| `.gitignore` | secrets (`.env`), the private `HANDOFF.md`, `node_modules`, build dirs |

## The toolchain (no build step)

Production runs `.ts` directly through **tsx** — there is no `dist/` and no compile step. `tsc` is
used only for `--noEmit` typechecking. This keeps the "written fresh during the event, run
immediately" loop tight. See [tech-stack.md](../../atlas/tech-stack.md).

## Deploy target — Render

`render.yaml` declares one Node web service (`covenant-sentinel`), region oregon, `autoDeploy:true`,
health check `/api/health`. `YDC_API_KEY` is `sync:false` (set as a dashboard secret) — **without it
the app still runs in labeled fallback mode** (Search → SYNTHETIC, ARI → PRERUN). `NODE_VERSION:22`.
The Blueprint defaults to the **free** plan (cold-starts after ~15 min idle); `DEPLOY.md` recommends
bumping to Starter for the live demo or pre-warming the URL. See
[ADR-0012](../../decisions/0012-single-service-render-deploy.md).

## The env contract (`.env.example`)

```
YDC_API_KEY=            # You.com — X-API-Key header; two hosts, one key
AWS_ACCESS_KEY_ID=      # venue = AWS Builder Loft; a deploy target
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-west-2
PORT=8080               # Sentinel server port
```

`.env` is a symlink to the parent repo's `.env` (gitignored); a missing `.env` is a supported mode.

## Related

Decisions: [ADR-0012](../../decisions/0012-single-service-render-deploy.md),
[ADR-0001](../../decisions/0001-deterministic-offline-core.md) · Boot sequence:
[bootstrap-chain.md](../../atlas/bootstrap-chain.md).
