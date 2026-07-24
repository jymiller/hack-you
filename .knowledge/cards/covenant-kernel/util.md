---
type: card
module: covenant-kernel
file: src/kernel/util.ts
complexity: low
lines: 41
last_analyzed: 2026-07-24
migration:
  global_refs: []
  session_keys_read: []
  session_keys_written: []
  db_tables_touched: []
  side_effects: []
  singleton_pattern: false
  extractable: true
  extraction_notes: "The kernel's only non-type dependency on Node (node:crypto). Trivially portable; swap the hash impl for a web-crypto one if targeting the browser."
---

# `src/kernel/util.ts` — deterministic primitives

Two concerns, both required for determinism: hashing (for ids/fingerprints) and covenant-grade
rounding. This is the **only** file in the kernel that imports Node (`node:crypto`).

## Hashing

```ts
sha256Hex(s)  // fingerprints, attestation signatures, receipt ids
sha1Hex(s)    // assessment_id, proposal_id (shorter, still deterministic)
```

Both are `createHash(...).update(s,'utf8').digest('hex')`. Used to fold meaningful fields into
deterministic ids — equal inputs produce equal ids (the basis of idempotency and tamper-evidence).

## `round(value, rounding?) — covenant-grade`

```ts
const f = 10 ** decimals;              // decimals default 2
const scaled = value * f;
// half_up:  Math.floor(abs + 0.5 + 1e-9)
// half_even: banker's rounding at the .5 boundary (±1e-9 epsilon)
// truncate:  Math.trunc(abs)
return (sign * r) / f;
```

**The epsilon is the subtle part.** `1e-9` absorbs binary-FP representation error so half-way cases
land correctly: `6.3450292… → 6.35` and `220/29 → 7.586206… → 7.59` (half_up). Without it, FP jitter
could round a boundary the wrong way and silently move a PASS/BREACH classification.

Handles negative values via an explicit `sign` (used for the signed `recompute_delta`). Modes:
`half_up` (default), `half_even` (banker's), `truncate`.

## Why it matters

Every ratio in every fixture's oracle is reproducible to 2 dp because `round` is deterministic and
FP-safe. The [oracle test](../eval-harness/oracle-test.md) asserts exact values (`toBe(7.59)`), so any
change to the rounding logic would break dozens of assertions — a good guardrail.

## Consumed by

`assess.ts`, `drift.ts`, `attest.ts`, `scoreboard.ts` (transitively). Related:
[ADR-0001](../../decisions/0001-deterministic-offline-core.md).
