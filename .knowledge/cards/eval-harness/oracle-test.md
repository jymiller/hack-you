---
type: card
module: eval-harness
file: src/eval/oracle.test.ts
complexity: medium
lines: 85
last_analyzed: 2026-07-24
migration:
  global_refs: []
  session_keys_read: []
  session_keys_written: []
  db_tables_touched: ["fixtures/*.json (via loadCorpus)"]
  side_effects: ["reads fixtures/ at import time"]
  singleton_pattern: false
  extractable: true
  extraction_notes: "Deterministic (fixed NOW). Data-driven — iterates every fixture's expected_assessment[]. The safety net keeping types.ts, the schema, and the kernel in agreement."
---

# `src/eval/oracle.test.ts` — the fixture oracle

The data-driven safety net. Iterates every `expected_assessment[]` row across the 6-borrower corpus
and asserts the kernel reproduces it exactly. Covers BUILD-LOOP gates 0/1/2/4 (recompute, classify,
drift) and the corpus sanity check.

## What it asserts, per row

For each `(borrower, period, covenant, basis)` oracle row, it runs
`assess(bundle, covenant, certificate, memory, { now: NOW, precedence_override: pinBasis(bundle,
row.basis), target_period_id: period.period_id })` and checks:

- `a.authoritative_basis === row.basis` (the pin worked),
- `a.recomputed_value === row.expected_value` (when present) — an **exact** numeric match,
- `a.status === row.expected_status`,
- `a.drift.detected === row.expect_drift_detected`.

## Period-level facts checked once

`certification_conflict` and `memory_hit` are **period-level** facts (the fixtures author them so
Thornwick records the memory hit once, on leverage; Halveston is "true on both rows"). So a separate
per-period assertion runs `assess()` on the natural precedence and checks
`some(expect_certification_conflict)` and `some(expect_memory_hit)` against the kernel's OR-across-
covenants result.

## The `pinBasis` mechanism

`pinBasis(bundle, basis)` ([`helpers.ts`](../../maps/eval-harness/index.md)) moves a chosen basis to
the top of `basis_precedence`, so the oracle can verify *each* per-basis row (e.g. Thornwick's
`borrower_certified` 6.47× PASS *and* its `audited_restated` 7.59× BREACH) from the same fixture. The
kernel's step-9 conflict logic re-resolves on the *natural* order so the pin doesn't corrupt the
period-level conflict.

## Corpus sanity

A final block asserts `loadCorpus()` returns exactly six bundles and every one is
`provenance_label === "SYNTHETIC"`.

## Why this is the linchpin test

It is the single check that keeps three artifacts in agreement: the fixtures (data), `types.ts` (the
TypeScript shape), and the kernel (the logic). Any drift among them fails a row. Together with
[`flip.test.ts`](../../maps/eval-harness/index.md) (the ★ flip) and `gates.test.ts` (labels + gate),
this is the "the demo is real" proof.

## Depends on

`assess.ts`, `corpus.ts`, `helpers.ts`, `types.ts`, vitest. Related:
[ADR-0011](../../decisions/0011-synthetic-fixtures-oracle.md),
[eval-harness map](../../maps/eval-harness/index.md).
