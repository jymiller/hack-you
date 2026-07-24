---
type: card
module: covenant-kernel
file: src/kernel/types.ts
complexity: medium
lines: 497
last_analyzed: 2026-07-24
migration:
  global_refs: []
  session_keys_read: []
  session_keys_written: []
  db_tables_touched: []
  side_effects: []
  singleton_pattern: false
  extractable: true
  extraction_notes: "Type-only module (no runtime code). The authoritative TypeScript mirror of the Facts JSON Schema + kernel spec."
---

# `src/kernel/types.ts` — the type contract

497 lines of `type`/`interface` declarations and nothing else — the authoritative runtime shape for
the whole system. Re-typed by hand from `prerun/covenant-facts.schema.json` (v1.0.0) and
`docs/KERNEL-SPEC.md` §1/§3/§7.

## What it defines (four groups)

1. **Facts bundle (schema v1.0.0)** — `FactsBundle`, `Borrower`, `Sponsor`, `Covenant`, `Threshold`,
   `WatchRule`, `Period`, `Observation`, `Measure`, `EbitdaBuild`, `AddBack`, `Adjustment`,
   `CertifiedResult`, `UnmappedField`, `EnidDocument`, `EnidEvent`, `Memory`, `RelatedDeal`,
   `ExpectedAssessment`.
2. **Kernel context** — `Certificate`, `MemoryContext` (`{ self, bySponsor(id) }`), `AssessCtx`
   (`{ now, precedence_override?, target_period_id?, event_ids? }`).
3. **The Finding** — `Assessment` (with nested `ratio`, `recompute`, `certified`, `drift`, `memory`,
   `watch`, `evidence`, `labels`, `proposed_write`, `errors`, `warnings`).
4. **Gate + scoreboard** — `ProposedWrite`, `Attestation`, `CommittedWrite`, `DeniedWrite`,
   `WriteResult`, `ServeReceipt`, `ScoreboardEvent`, `ScoreboardEventName`.

## The load-bearing enums

- `Provenance = "SYNTHETIC" | "LIVE" | "PRERUN"` — the honesty-label vocabulary, used everywhere.
- `Basis` — the five observation bases (`borrower_certified` … `audited_restated` …).
- `CovenantMetric` — the five allowed metrics; `assess()` validates against this exact set.
- `MeasureKey` — 17 canonical financial keys.
- `Status = "PASS" | "WATCH" | "BREACH" | "INDETERMINATE"`.
- `ErrorCode` — the seven totality error codes.

## Const-narrowed invariants (the gate, in the types)

`ProposedWrite` bakes the gate into the type: `requires_attestation: true`, `attestation_state:
"PENDING"`, `downstream.dry_run: true`, `provenance_label: "SYNTHETIC"` are all `const` literals — a
proposal *cannot* be constructed pre-attested. `CommittedWrite` / `DeniedWrite` carry the attestation,
so the outcome is discriminated by `outcome`.

## Kept in lockstep with two other files

`types.ts` mirrors `covenant-facts.schema.json` (the data contract) and the spec. The
[oracle test](../eval-harness/oracle-test.md) is what keeps the mirror honest — if the types and the
fixtures diverge, a row fails. Type-only module, so it compiles away; zero runtime footprint.

## Consumed by

Every kernel file, `scan.ts`, `scoreboard.ts`, `corpus.ts`, `youcom.ts` (`Provenance`), and the
tests. Related: [ADR-0011](../../decisions/0011-synthetic-fixtures-oracle.md).
