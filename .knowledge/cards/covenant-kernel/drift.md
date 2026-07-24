---
type: card
module: covenant-kernel
file: src/kernel/drift.ts
complexity: medium
lines: 94
last_analyzed: 2026-07-24
migration:
  global_refs: []
  session_keys_read: []
  session_keys_written: []
  db_tables_touched: []
  side_effects: []
  singleton_pattern: false
  extractable: true
  extraction_notes: "Pure. Uses sha256Hex from util. Portable as a standalone schema-drift detector."
---

# `src/kernel/drift.ts` — compare the map, not the values

Detects schema drift that a value diff would miss. A silent `EBITDA → "Adjusted EBITDA"` rename holds
a covenant green while the number moves a plausible amount; only comparing the **field map** reveals
it.

## `fingerprint(obs) → string`

`sha256` over the newline-joined, sorted set of `(canonical_key:raw_name)` pairs (for measures whose
`raw_name != null`) **plus** the sorted `unmapped_fields[].raw_name`. Crucially it is **recomputed**,
never trusted from the stored `field_map_fingerprint` — a stored hash is a claim like any other.

## `detectDrift(obs, priorObs, covenant) → DriftResult`

`detected` is true if **any** of three fire:

- **(a) `unmapped_field`** — `obs.unmapped_fields[]` non-empty. A source row matched no canonical key
  (Northgate: `"Adjusted EBITDA" = 40.0`). Hard alarm.
- **(b) `stale_carry_forward`** — a measure the *covenant uses* (`numerator_key`/`denominator_key`)
  has `state === "stale"` or `raw_name == null`. The "dashboard stayed green on a carried-forward
  number" bug, made explicit.
- **(c) `field_rename`** — `priorObs` exists (same basis, prior period), the fingerprint changed,
  **and** a canonical key's `raw_name` differs from the prior period. A *map* change, not a value
  change.

`kinds[]` collects which fired; `details[]` names the `canonical_key`, `prior_raw_name`,
`current_raw_name`, the unmapped rows, and both fingerprints — enough for the UI to show the rename
inline and for an audit trail.

## Why it runs on every assessment (even PASS)

Drift is orthogonal to breach: a renamed field can silently *hold* a covenant green. So `assess.ts`
calls `detectDrift` at step 6, before classification, and includes it even in INDETERMINATE Findings.
The deliberate contrast is Thornwick (values restated, fingerprint unchanged → **no** drift) vs.
Northgate (values hold, map moves → drift). See the two worked examples in
`docs/KERNEL-SPEC.md` §10.

## Depends on

`util.ts` (`sha256Hex`), `types.ts`. Consumed by [`assess.ts`](assess.md) and
[`scoreboard.ts`](../scoreboard-labels/scoreboard.md). Related:
[ADR-0004](../../decisions/0004-field-map-fingerprint-drift.md).
