---
type: decision
id: ADR-0009
title: Auto-mount drop-in mini-demos from demos/<slug>/
status: inferred
date_inferred: 2026-07-24
scope: domain
affects: ["web-demo-platform"]
migration_impact: low
migration_notes: "The dynamic import() couples the loader to tsx-on-import; a compiled build would need a glob/manifest instead."
---

# ADR-0009 · Mini-demo auto-mount architecture

## Context

The team wanted to show a mini-demo per hackathon vendor and build them in parallel without merge
conflicts on a shared router file, while keeping the flagship Sentinel desk front and center.

## Decision

Make each demo a **self-contained directory** `demos/<slug>/` with a required `meta.json`
(`{name, blurb, accent, status?, order?}`) and two optional files: `page.html` (served at `/<slug>`)
and `routes.ts` (an Express Router mounted at `/api/<slug>`). At boot, `mountDemos()` scans `demos/`,
registers each, and exposes the registry at `/api/demos`, which the landing page renders. **Drop a
directory in and it appears — no edits to any shared file.** A `meta.json`-only directory renders as a
greyed "coming soon" card.

## Consequences

- Unlimited parallel demo development; zero shared-file contention.
- The landing grid is data-driven from `/api/demos`, so new demos need no HTML edit.
- Robustness: a bad `meta.json` or a failing `routes.ts` is logged and skipped, never fatal.
- Coupling: `routes.ts` is loaded via dynamic `import()`, which works because tsx transpiles `.ts` on
  import — a compiled build would need a manifest or glob instead.
- Currently live: `youcom`, `data`; six vendor stubs (`crewai`, `parasail`, `llamaindex`, `agno`,
  `replit`, `pica`) are `status:"soon"`.

## Evidence

`src/server/app.ts` (`mountDemos`), `web/index.html` (grid from `/api/demos`), `demos/*/meta.json`.
See the [web-demo-platform map](../maps/web-demo-platform/index.md) and
[app.ts card](../cards/web-demo-platform/app.md).
