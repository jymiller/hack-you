---
type: decision
id: ADR-0003
title: The flip is basis-precedence resolution, not a special case
status: inferred
date_inferred: 2026-07-24
scope: domain
affects: ["covenant-kernel", "synthetic-corpus"]
migration_impact: none
migration_notes: "Generalizes cleanly to any 'multiple observations of the same period on different authorities' problem."
---

# ADR-0003 · Basis-precedence truth resolution

## Context

A single test date can have several accounts of the same quarter — a borrower certificate, management
accounts, raw financials, an audited restatement — that disagree. The kernel must pick *which* to
believe, and the choice must be principled, not hand-coded per demo.

## Decision

Model each account as an `Observation` with a `basis`, and resolve the authoritative one by
`basis_precedence` order (default: `audited_restated > raw_financials > management_accounts >
borrower_certified`), tie-broken by latest `as_of`. The status is computed on whichever observation
wins. **The money-shot flip is nothing more than this resolution:** Thornwick's `q1-2026` carries both
a `borrower_certified` (6.47×) and an `audited_restated` (7.59×) observation; the latter outranks the
former, so the period *is* a breach the moment the restatement exists.

## Consequences

- No special-case "restatement" code path — the flip falls out of ordinary precedence resolution.
- The oracle can pin any basis (`pinBasis`) to check per-basis rows; the period-level conflict is
  re-resolved on the *natural* order so pinning doesn't corrupt it.
- Fixtures carry multiple observations per period; `resolveAuthoritative` centralizes the choice.

## Evidence

`docs/KERNEL-SPEC.md` §4a, `src/kernel/assess.ts` (`resolveAuthoritative`), `fixtures/thornwick.json`,
`flip.test.ts`. See the [Thornwick fixture card](../cards/synthetic-corpus/thornwick-fixture.md).
