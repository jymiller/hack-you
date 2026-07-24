---
type: card
module: scoreboard-labels
file: src/kernel/scoreboard.ts
complexity: medium
lines: 136
last_analyzed: 2026-07-24
migration:
  global_refs: []
  session_keys_read: []
  session_keys_written: []
  db_tables_touched: []
  side_effects: ["mutates its own events[] array (per-instance, in-memory)"]
  singleton_pattern: false
  extractable: true
  extraction_notes: "A small stateful class; state is instance-local (events[] + seq). Pure with respect to its inputs. Extractable as a telemetry primitive."
---

# `src/kernel/scoreboard.ts` — the event feed

Turns Findings into an ordered, labeled event stream the UI can animate and replay. One class,
`Scoreboard`, with a private monotonic `seq` and an append-only `events[]`.

## Construction & the `push` envelope

`new Scoreboard(now, startSeq = 0)`. Every event shares an envelope built by the private `push()`:
`{ event, seq: seq++, ts: now, borrower_id, covenant_id, period_id, provenance_label, assessment_id,
data }`. `startSeq` lets `applyAttestation` continue the sequence from where the scan left off.

## The three emit methods

- **`scan(a, opts)`** — emits `scanned` (carrying the trigger's label — LIVE when a live crawl fired,
  via `opts.triggerLabel`), then exactly one of `pass`/`watch`/`breach` (all labeled LIVE — the
  recompute is a real computation), then `drift_detected` if `a.drift.detected`, then `memory_hit` if
  `a.memory.hit`. Memory is deduped once per `borrower|period` via `opts.memoryAlreadyCounted`.
- **`attested(a, attestation)`** — emits `attested` with the decision + signature.
- **`writeResult(a, result, serve)`** — emits `write_committed` (SYNTHETIC) or `write_denied` (LIVE).

## Per-event `data` payloads

Each event carries a purpose-built `data`: `breach` includes `from_value` (the certified 6.47×) and
`recomputed_value` (7.59×) plus `certification_conflict` and the rationale; `drift_detected` carries
`kinds`, the renamed key, and both fingerprints; `memory_hit` carries `sponsor_id`, `prior_facts_id`,
`relation`, `pattern_tags`. The UI reads straight off these.

## The money-shot order

`scanned(LIVE) → breach → memory_hit → attested → write_committed(SYNTHETIC)`. `gates.test.ts` gate 6
asserts both the presence and the **relative index order** of these, and that `seq` is `0,1,2,…` with
no gaps. Northgate additionally emits `drift_detected` + `breach`.

## Honesty-label discipline lives here

Every `push` requires a `provenance_label`, so no event can be unlabeled. `gates.test.ts` gate 7
walks the full money-shot feed and asserts every event's label is one of the three valid values, and
that `write_committed` is specifically SYNTHETIC (never a mislabeled mock).

## Depends on

`types.ts`. Consumed by [`scan.ts`](../scan-orchestration/scan.md), the offline
[`demo.ts`](../eval-harness/oracle-test.md) script, and the desk UI. Related:
[ADR-0006](../../decisions/0006-honesty-label-discipline.md).
