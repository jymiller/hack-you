---
type: card
module: synthetic-corpus
file: fixtures/thornwick.json
complexity: high
lines: 735
last_analyzed: 2026-07-24
migration:
  global_refs: []
  session_keys_read: []
  session_keys_written: []
  db_tables_touched: []
  side_effects: []
  singleton_pattern: false
  extractable: true
  extraction_notes: "Pure data. The reference fixture — the shape every other fixture follows. Reproducible arithmetic documented in its own notes[] field."
---

# `fixtures/thornwick.json` — the money-shot fixture

The reference borrower and the entire demo in one JSON file. Thornwick Logistics Holdings plc
(sponsor Ardenmoor Capital), 735 lines, `provenance_label: SYNTHETIC`. Two covenants
(`total_net_leverage` max 6.50, `interest_cover` min 2.00), two periods.

## The mechanism: one quarter, two observations

The flip is **pure basis-precedence resolution**, not a special case. Period `q1-2026` (test_date
2026-03-31) carries two observations of the *same quarter* on different bases:

| Observation | basis | as_of | adjusted_ebitda | leverage |
|---|---|---|---|---|
| `obs-thornwick-q1-2026-cert` | `borrower_certified` | 2026-05-13 | 34.0 | 220/34.0 = **6.47× PASS** |
| `obs-thornwick-q1-2026-restated` | `audited_restated` | 2026-07-03 | 29.0 | 220/29.0 = **7.59× BREACH** |

`basis_precedence` puts `audited_restated` first, so the restated observation wins → the period *is*
a breach the moment the restatement exists. Net debt is 220 on **both** vintages — the entire move is
EBITDA.

## The EBITDA bridge (recompute-never-trust in the data)

On the certified observation every add-back has `allowed: null` (claimed, not yet adjudicated), so
`29.5 + 3.2 + 1.0 + 0.3 = 34.0`. The audit sets `allowed: false` on the `run_rate_synergy` (£3.0m
disallowed, `not_realised_in_window`) and the `transaction_advisory` (£0.3m, `outside_definition`),
and adds a signed `-1.7` IFRS-15 revenue reversal. The kernel's `recomputeEbitda`
(`base + allowed add-backs + adjustments`) reproduces `29.5 + 0.2 + 1.0 + 0.0 + (−1.7) = 29.0` in one
sum. `add_back_id`s are deliberately shared across the two observations so the adjudication diff joins.

## What it deliberately does NOT have

- **No `watch_rule`** on either covenant — the certified 6.47× sits 0.03× under the ceiling, so any
  proximity band would classify it WATCH and pre-empt the clean-PASS-to-BREACH flip.
- **No schema drift** — `field_map_fingerprint` is identical across all three observations. Same field
  map, different values = restatement. That is the deliberate contrast with
  [`northgate.json`](../../maps/synthetic-corpus/index.md), where the map moves and the values hold.
- **No audited_restated observation on `q4-2025`** — that period exists only to establish the "was
  green" baseline (6.35× PASS).

## Memory & events

`memory.sponsor_id: "ardenmoor"` with `pattern_tags` (`run_rate_synergy_disallowed`,
`restated_after_auditor_change`, …) and `related_deals` pointing at Halveston (the cross-deal hit).
`events[]` holds one SYNTHETIC placeholder (`retrieved_via: "manual"`, a non-resolving URL) that the
live You.com result replaces at runtime. `documents[]` fingerprints are deterministic placeholders
(`sha256('SYNTHETIC-PLACEHOLDER|…')`) — no real file to hash.

## The oracle

`expected_assessment[]` on `q1-2026` encodes four rows (cert/restated × leverage/interest_cover) with
the expected value, status, and the conflict/memory flags. The fixture's own `notes[]` field carries
the full reproducible arithmetic. [`oracle.test.ts`](../eval-harness/oracle-test.md) and
[`flip.test.ts`](../eval-harness/oracle-test.md) re-derive it.

Related: [ADR-0003](../../decisions/0003-basis-precedence-resolution.md),
[ADR-0011](../../decisions/0011-synthetic-fixtures-oracle.md).
