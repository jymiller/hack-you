---
type: card
module: covenant-kernel
file: src/kernel/classify.ts
complexity: medium
lines: 82
last_analyzed: 2026-07-24
migration:
  global_refs: []
  session_keys_read: []
  session_keys_written: []
  db_tables_touched: []
  side_effects: []
  singleton_pattern: false
  extractable: true
  extraction_notes: "Pure. One comparator + a threshold selector + a trend rule. No dependencies beyond types."
---

# `src/kernel/classify.ts` — one comparator, both directions

Classifies PASS / WATCH / BREACH with a single comparator parameterised by `direction`, plus the
dated-stepdown threshold selector and the data-driven WATCH rule.

## `selectThreshold(covenant, testDate) → Threshold | null`

Picks the `thresholds[]` row whose window contains `test_date`
(`effective_from <= testDate <= (effective_to ?? +∞)`). Returns the first match, or `null` (the
caller returns INDETERMINATE / `NO_EFFECTIVE_THRESHOLD` — **never** PASS). Thornwick 2026-03-31
selects the `6.50` row (window 2024-06-28 … 2026-06-29).

## `headroom(value, threshold, direction)`

```ts
direction === "max" ? threshold - value : value - threshold;   // negative ⇒ BREACH
```

Signed distance still inside the covenant. `max` serves leverage ceilings; `min` serves cover-ratio
floors. This is the whole trick that lets one code path handle both metric families.

## `classify(value, threshold, direction, watchRule, trend) → ClassifyResult`

- `headroom < 0` → **BREACH** (short-circuits; WATCH not evaluated).
- No `watchRule` → **PASS**.
- Else evaluate WATCH as the **union** of any sub-rule that fires:
  - `headroom_absolute = h` → WATCH if `0 <= headroom <= h`.
  - `headroom_pct = q` → WATCH if `0 <= headroom <= q * threshold`.
  - `deteriorating_periods = N` → **trend rule**: `isDeteriorating(trend, N, direction)`.
- Any trigger → **WATCH**; else **PASS**. `watch.trend[]` always carries the series so the UI can draw
  the creep line.

## `isDeteriorating(trend, n, direction)`

Requires `n` consecutive periods moving **strictly toward** the threshold (`max`: strictly increasing;
`min`: strictly decreasing). Bails to `false` on `< n` points or any `null` value in the window.
Borrower-B: 4.0 → 4.2 → 4.4× over 3 periods ⇒ WATCH, even though headroom (0.6) alone wouldn't trip
`headroom_absolute=0.25`.

## Gotcha

Thornwick's `watch_rule` is deliberately `null` on both covenants: the certified 6.47× sits 0.03×
under the ceiling, so any proximity band would classify it WATCH and pre-empt the flip — the demo
needs the certificate to read a clean PASS. WATCH is Borrower-B's mechanism, not Thornwick's.

## Depends on

`types.ts` only. Consumed by [`assess.ts`](assess.md). Related:
[ADR-0003](../../decisions/0003-basis-precedence-resolution.md).
