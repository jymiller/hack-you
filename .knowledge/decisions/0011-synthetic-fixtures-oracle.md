---
type: decision
id: ADR-0011
title: Synthetic fixtures carry their own expected_assessment[] oracle
status: inferred
date_inferred: 2026-07-24
scope: domain
affects: ["synthetic-corpus", "eval-harness", "covenant-kernel"]
migration_impact: none
migration_notes: "The oracle-in-the-fixture pattern is a clean regression harness; keep assess() blind to expected_assessment."
---

# ADR-0011 · Synthetic fixtures with an embedded oracle

## Context

The rules require all data to be synthetic (no real company) and the kernel to be re-typed fresh
during the event. The team needed a way to prove, continuously, that the freshly-typed kernel
reproduces the intended numbers for six distinct failure mechanisms.

## Decision

Each fixture is a fully synthetic `FactsBundle` that **carries its own `expected_assessment[]`
oracle** — per `(covenant, basis)`, the expected value, status, and drift/conflict/memory flags —
plus a `notes[]` field with the reproducible arithmetic. `oracle.test.ts` iterates every row and
asserts the kernel matches; `assess()` **must never read `expected_assessment`** (it is a test oracle
only). The six borrowers deliberately span distinct mechanisms (restatement, cross-deal precedent,
schema drift, under-reporting, clean control, watch-on-trend) so the kernel is exercised across its
whole surface.

## Consequences

- One regression harness keeps three artifacts in agreement: the fixtures (data), `types.ts` (shape),
  and the kernel (logic). Drift among them fails a row.
- The corpus proves the kernel "doesn't cry breach at everything" — Merribrook PASSes, Brenmark
  WATCHes.
- New scenarios are added by writing a fixture + its oracle, not by editing test code.
- The oracle is authored data, so a wrong expected value would mask a real bug — the `notes[]`
  arithmetic is the human cross-check.

## Evidence

`fixtures/*.json` (each with `expected_assessment[]` + `notes`), `src/eval/oracle.test.ts`,
`BUILD-LOOP.md` ("write the check before the code"). See the
[synthetic-corpus map](../maps/synthetic-corpus/index.md) and
[oracle test card](../cards/eval-harness/oracle-test.md).
