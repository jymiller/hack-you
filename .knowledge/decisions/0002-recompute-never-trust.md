---
type: decision
id: ADR-0002
title: Recompute, never trust — form the ratio from raw measures
status: inferred
date_inferred: 2026-07-24
scope: domain
affects: ["covenant-kernel"]
migration_impact: none
migration_notes: "The tier order in resolve() is load-bearing; document it before refactoring."
---

# ADR-0002 · Recompute, never trust

## Context

The failure mode being caught is a borrower certifying a compliant number that the underlying figures
don't support. If the kernel adopted the certified value, it would be blind to exactly the fraud it
exists to catch.

## Decision

The kernel **forms its own ratio from raw `measures[]`** and treats three data points as *claims to
check, never inputs to the classification*: the certified value, the stated EBITDA total
(`ebitda_build.total_amount`), and the self-certified status. `recomputeEbitda` sums only
`allowed === true` add-backs plus signed adjustments; `resolve()` reads a clean measure, else
reconstructs from the build, else flags a stale fallback. The certificate is passed as a *separate*
parameter and only *compared* afterward (`certification_conflict`), never fed into `status`.

## Consequences

- Thornwick: certified 34.0 EBITDA → recomputed 29.0 → 7.59× BREACH vs. the 6.47× GREEN certificate.
- Marrowfield: self-certifies "IN COMPLIANCE" at DSCR 1.24× while the raw recompute is 1.08× BREACH.
- The stored `field_map_fingerprint` and `certified_value` are recomputed/recorded, never trusted.
- The kernel must carry an `ebitda_build` model and the tri-state `allowed` field.

## Evidence

`docs/KERNEL-SPEC.md` §2, `src/kernel/recompute.ts`, `src/kernel/assess.ts` (step 9), the fixture
oracles. See the [recompute card](../cards/covenant-kernel/recompute.md).
