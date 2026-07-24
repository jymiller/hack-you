---
type: decision
id: ADR-0010
title: The kernel is total — INDETERMINATE never silent PASS, never a throw
status: inferred
date_inferred: 2026-07-24
scope: domain
affects: ["covenant-kernel"]
migration_impact: none
migration_notes: "Total functions embed safely behind any boundary without try/catch churn."
---

# ADR-0010 · Kernel totality

## Context

A covenant monitor that throws on messy data, or that treats "I couldn't compute this" as
"compliant", is dangerous: a data fault must never be indistinguishable from a green light.

## Decision

Make `assess()` **total**: every data fault returns an `INDETERMINATE` Finding with a typed `errors[]`
code — never an exception. The seven codes are `UNKNOWN_PERIOD`, `NO_OBSERVATION`,
`NO_EFFECTIVE_THRESHOLD`, `DIVIDE_BY_ZERO`, `MISSING_INPUT`, `STALE_INPUT_UNBACKED`,
`UNKNOWN_COVENANT_TYPE`. **INDETERMINATE is never silently PASS.** `attest()` is total too — it throws
*only* on a tampered/mismatched attestation, never on a business DENY (a first-class `DeniedWrite`).

## Consequences

- A missing threshold → INDETERMINATE, not PASS. A stale-unbacked input → INDETERMINATE (and it still
  records the stale source + drift), not a silent green.
- Callers (`scan.ts`, the UI) never need try/catch around the kernel.
- `totality.test.ts` walks the whole §11 error matrix and asserts a Finding-with-errors, never a throw.
- INDETERMINATE Findings carry no `proposed_write`, so a data fault can never propose a notice.

## Evidence

`docs/KERNEL-SPEC.md` §11, `src/kernel/assess.ts` (`indeterminate()` helper, `recomputeRatio` guards),
`src/eval/totality.test.ts`. See the [assess card](../cards/covenant-kernel/assess.md).
