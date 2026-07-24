---
type: decision
id: ADR-0001
title: Deterministic, offline core — no LLM or network in the money-shot
status: inferred
date_inferred: 2026-07-24
scope: system-wide
affects: ["covenant-kernel", "eval-harness", "scan-orchestration"]
migration_impact: none
migration_notes: "This decision is why the codebase is so extractable — the value lives in pure functions."
---

# ADR-0001 · Deterministic, offline core

## Context

This is a live, on-stage demo on venue wifi. The load-bearing claim — a certificate reads GREEN while
the truth is a BREACH — must never depend on a flaky network call or a non-deterministic model at the
moment it matters.

## Decision

Front-load all risk into a **deterministic, offline, testable core**. `assess()` and `attest()` are
pure functions with no I/O, no writes, and no clock except an injected `ctx.now`. No LLM and no
network sit in the money-shot; the flip is plain arithmetic over local JSON. You.com is wrapped
*around* the core (FACE), and the notice-serving is gated *after* it (HARDEN) — but the truth on
screen is computed with zero external dependencies.

## Consequences

- The demo is verifiable before the vendor is wired in: `scripts/demo.ts` runs the whole money-shot
  offline, and 51 tests reproduce every gate with no network.
- The kernel scores 0.08 coupling — it could be lifted out as a library today.
- `round()` carries an FP epsilon so ratios are exactly reproducible; ids are SHA hashes so re-runs
  are idempotent.
- The one wall-clock read (`new Date()` in `app.ts`) is injected into the otherwise-pure orchestration.

## Evidence

`BUILD-LOOP.md` ("Deterministic core first — no network/LLM in the money-shot is exactly what makes
it trustworthy"), `README.md`, the purity of `src/kernel/*`, `scripts/demo.ts`.
