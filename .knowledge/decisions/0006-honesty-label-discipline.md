---
type: decision
id: ADR-0006
title: Exactly one honesty label (LIVE / PRERUN / SYNTHETIC) on every effect
status: inferred
date_inferred: 2026-07-24
scope: system-wide
affects: ["scoreboard-labels", "youcom-integration", "scan-orchestration", "web-demo-platform"]
migration_impact: none
migration_notes: "A clean provenance-tagging discipline; keep the 'never label a mock PRERUN' rule."
---

# ADR-0006 · Honesty-label discipline

## Context

The demo mixes fabricated data, live API calls, and cached receipts. Judges (and integrity) require
the audience to always know which is which — and the labels must be honest even when a live call falls
back mid-demo.

## Decision

Every on-stage effect carries **exactly one** `Provenance` label: `SYNTHETIC` (fabricated corpus
data), `LIVE` (fired live now), or `PRERUN` (a genuine call executed earlier, shown as a receipt). The
UI reads the label **off the record** (the API response / scoreboard event), never from slide text.
Hard rule: **never label a mock as PRERUN** — a `dry_run:true` descriptor that never executed is
SYNTHETIC; PRERUN is reserved for the genuine cached You.com response.

## Consequences

- The money-shot triad is legible directly from `Assessment.labels`: `facts SYNTHETIC · recompute
  LIVE · downstream_serve SYNTHETIC`.
- A live You.com call that fails degrades to a *labeled* fallback (Search→SYNTHETIC, ARI→PRERUN) — the
  label flips honestly, and `face.test.ts` asserts it.
- Every `Scoreboard.push` requires a label, so no event can be unlabeled; `gates.test.ts` gate 7
  enforces "none unlabeled" across the whole corpus and the full money-shot feed.
- The data model carries `provenance_label` on bundles, documents, observations, events, and the
  proposal.

## Evidence

`docs/KERNEL-SPEC.md` §8, `docs/DEMO-SCRIPT.md` §3, `src/kernel/scoreboard.ts`, `src/server/youcom.ts`,
`gates.test.ts`. See the [scoreboard-labels map](../maps/scoreboard-labels/index.md).
