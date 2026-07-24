---
type: card
module: covenant-kernel
file: src/kernel/recompute.ts
complexity: medium
lines: 52
last_analyzed: 2026-07-24
migration:
  global_refs: []
  session_keys_read: []
  session_keys_written: []
  db_tables_touched: []
  side_effects: []
  singleton_pattern: false
  extractable: true
  extraction_notes: "Pure functions over an Observation. Zero dependencies beyond types. The tiered resolve() order is load-bearing — preserve it exactly."
---

# `src/kernel/recompute.ts` — recompute, never trust

The single most important arithmetic in the codebase: the line that drops a disallowed synergy, and
the resolver that decides *when* to trust an extracted value versus rebuild it.

## `recomputeEbitda(build) → number`

```ts
let total = build.base_amount;
for (const ab of build.add_backs ?? []) if (ab.allowed === true) total += ab.amount;
for (const adj of build.adjustments ?? []) total += adj.amount;   // signed
return total;
```

**Only `allowed === true` add-backs are summed.** `null` (unadjudicated) and `false` (disallowed)
contribute nothing. On Thornwick's restated build: `29.5 (base) + 0.2 + 1.0 + 0.0 (allowed) + (−1.7
IFRS-15 reversal) = 29.0`. That `29.0` (vs. the certified `34.0`) is the entire flip.

## `resolve(obs, key) → { value, source }` — four tiers, in order

1. **`measure`** — a clean measure: `m.value != null && state === "observed" && m.raw_name != null`.
   The field resolved from the document; adopting it is *reading the document*, not trusting the
   borrower.
2. **`reconstructed_build`** — the covenant needs an EBITDA key that didn't resolve cleanly, and an
   `ebitda_build` exists → return `recomputeEbitda(build)`. (Keys: `total_key`, `base_key`, or the two
   `EBITDA_KEYS` = `consolidated_ebitda`/`adjusted_ebitda`.)
3. **`stale_fallback`** — a numeric value survives but the field name did not resolve (a stale
   carry-forward). Returns the value **and the caller raises a drift signal**; `assess()` then treats
   this as `STALE_INPUT_UNBACKED` INDETERMINATE (never a silent green).
4. **`unresolved`** — nothing to stand on → `MISSING_INPUT`.

## Why the tier order matters

The whole schema-drift thesis is "never go green on a carried-forward number." The order encodes it:
a cleanly-resolved value is truth (tier 1); the kernel substitutes its own reconstruction *exactly
when* the field failed to resolve (tier 2, the Northgate case); and a bare stale value is flagged, not
silently consumed (tier 3). Reorder these and Northgate's 1.33× BREACH becomes a naive 1.52× PASS.

## Depends on

`types.ts` only. Consumed by [`assess.ts`](assess.md) (`recomputeRatio`, the recompute-delta finding,
and the trend builder). Related: [ADR-0002](../../decisions/0002-recompute-never-trust.md),
[ADR-0004](../../decisions/0004-field-map-fingerprint-drift.md).
