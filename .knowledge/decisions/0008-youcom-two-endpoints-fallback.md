---
type: decision
id: ADR-0008
title: Two You.com endpoints (one per job) with a labeled fallback on every path
status: inferred
date_inferred: 2026-07-24
scope: domain
affects: ["youcom-integration", "scan-orchestration"]
migration_impact: low
migration_notes: "Parameterise the apiKey() env read to fully decouple; otherwise portable."
---

# ADR-0008 · You.com: two endpoints + labeled fallback

## Context

You.com is the load-bearing hackathon vendor; the bounty rewards using the *right* endpoint per job
and routing real traffic through ARI. But the demo runs on venue wifi and cannot hang on a spinner or
a 13-second research call.

## Decision

Use **two You.com endpoints, one per job**: Search (`GET ydc-index.io/v1/search`, `freshness` +
`livecrawl`) for the fresh live headline, and Research/ARI (`POST api.you.com/v1/research`) for the
cited structured brief. ARI is called with `background: true` (→ `task_id` in <1s, polled to
completion) so the click never blocks. **Every path degrades to a labeled fallback**: no key / prerun
mode / error → Search returns the SYNTHETIC fixture headline and ARI returns the genuine **PRERUN**
cache. Never `exhaustive` live; `standard` only.

## Consequences

- The scan never hangs; the offline test suite runs the full flow by deleting the key.
- ARI's question depends only on the *event* (not the recompute), so firing it at t≈0 before the
  recompute is legitimate, not faked.
- The client must handle two response shapes (`data.result.output` live vs `data.response.output`
  cache) and the `output_schema` `additionalProperties:false` (HTTP 422) gotcha.
- One env global (`YDC_API_KEY`) and a module-level PRERUN cache are introduced.

## Evidence

`docs/DEMO-SCRIPT.md` §0, `README.md` (Phase 2), `src/server/youcom.ts`, `face.test.ts`,
`scripts/youcom-smoke.ts`. See the [youcom card](../cards/youcom-integration/youcom.md).
