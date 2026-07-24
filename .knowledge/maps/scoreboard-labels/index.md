---
type: module
name: scoreboard-labels
display_name: Event Scoreboard & Honesty Labels
status: active
file_locations:
  entry_points: ["src/kernel/scoreboard.ts"]
  controllers: ["src/kernel/scoreboard.ts"]
  models: ["src/kernel/types.ts (ScoreboardEvent, ScoreboardEventName, Provenance)"]
  services: []
  views: ["web/app.html (animated feed)"]
  tests: ["src/eval/gates.test.ts"]
  config: []
patterns:
  - type: append-only event stream with monotonic seq
    count: 1
    example: src/kernel/scoreboard.ts
  - type: provenance label on every event
    count: 1
    example: src/kernel/scoreboard.ts
dependencies:
  internal: ["covenant-kernel"]
  external: []
  database_tables: []
migration:
  coupling_score: 0.10
  session_dependencies: 0
  global_dependencies: 0
  singleton_dependencies: []
  pattern_consistency: 1.0
  abstraction_boundary: clean
  testability: high
  estimated_effort: small
  blockers: []
---

# Event Scoreboard & Honesty Labels

The observability domain — the thing that makes **green→breach legible on stage**. One universal
event feed with a monotonic `seq`, so the UI can order and replay. And the cross-cutting discipline
that every effect carries exactly one honesty label (**LIVE / PRERUN / SYNTHETIC**), which the UI
reads off the record rather than painting from a slide.

## `Scoreboard` (class, `scoreboard.ts`)

Constructed with `(now, startSeq = 0)`; holds an append-only `events[]` and a private monotonic
`seq`. `applyAttestation()` continues the sequence from where the scan left off by passing
`seqStart`.

| Method | Emits |
|---|---|
| `scan(assessment, opts)` | `scanned` (carries the trigger's label — LIVE when a live crawl fired), then one of `pass`/`watch`/`breach`, then `drift_detected` (if drift), then `memory_hit` (if a hit; deduped once per borrower+period). |
| `attested(assessment, attestation)` | `attested` (carries the decision + signature). |
| `writeResult(assessment, result, serve)` | `write_committed` (SYNTHETIC) or `write_denied` (LIVE). |

The money-shot order: `scanned(LIVE) → breach → memory_hit → attested → write_committed(SYNTHETIC)`.
`gates.test.ts` asserts both the presence and the **relative order** of these events, and that `seq`
is `0,1,2,…` with no gaps.

## The nine event types

`scanned` · `pass` · `watch` · `breach` · `drift_detected` · `memory_hit` · `attested` ·
`write_denied` · `write_committed`. Each has a shared envelope
(`event, seq, ts, borrower_id, covenant_id, period_id, provenance_label, assessment_id, data`) and a
per-event `data` payload (e.g. `breach` carries `from_value 6.47 → recomputed_value 7.59`).

## Honesty labels — the discipline, not just a field

`Provenance = "SYNTHETIC" | "LIVE" | "PRERUN"` threads through the whole system. Where each attaches:

| Field | On stage | Meaning |
|---|---|---|
| `FactsBundle.provenance_label` / `document` / `observation` | SYNTHETIC | the whole corpus is synthetic |
| `event.provenance_label` (a live You.com crawl) | LIVE | the trigger that fired the scan |
| `Assessment.labels.facts` | SYNTHETIC | the book being assessed |
| `Assessment.labels.recompute` | LIVE | the kernel run is a real computation |
| `Assessment.labels.downstream_serve` | SYNTHETIC | the register notice over the synthetic book |
| every scoreboard event `.provenance_label` | as above | the UI reads it off the event |

Rule: **never label a mock as PRERUN.** A `dry_run:true` descriptor that never executed is SYNTHETIC.
`gates.test.ts` gate 7 asserts every assessment across the corpus is fully labeled with valid values
and every scoreboard event on the full money-shot carries a valid label — *none unlabeled*. See
[ADR-0006](../../decisions/0006-honesty-label-discipline.md).

## Why it's a separate domain

`scoreboard.ts` lives in `src/kernel/` next to `assess.ts`, but its job — turning Findings into a
legible, labeled event stream for the UI — is a distinct concern from computing the Finding. It is
pure and stateful-in-the-small (one `events[]` array per instance), depends only on kernel types, and
holds no global or framework state.

## Related

Card: [`scoreboard.ts`](../../cards/scoreboard-labels/scoreboard.md) · Consumers:
[scan-orchestration](../scan-orchestration/index.md), the desk UI (`web/app.html`).
