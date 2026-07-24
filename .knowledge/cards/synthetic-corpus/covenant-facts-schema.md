---
type: card
module: synthetic-corpus
file: prerun/covenant-facts.schema.json
complexity: medium
lines: 680
last_analyzed: 2026-07-24
migration:
  global_refs: []
  session_keys_read: []
  session_keys_written: []
  db_tables_touched: []
  side_effects: []
  singleton_pattern: false
  extractable: true
  extraction_notes: "The versioned data contract. Not imported at runtime (types.ts mirrors it by hand) — it validates fixtures and documents the shape."
---

# `prerun/covenant-facts.schema.json` — the Facts data contract

The JSON Schema (draft 2020-12) every fixture conforms to. `$id
https://enid.local/schemas/covenant-facts/v1.json`, version **1.0.0**, title "ENID Covenant Sentinel —
Normalized Facts Bundle". 680 lines, 18 `$defs`.

## Required top-level fields

`schema_version`, `facts_id`, `provenance_label`, `units`, `basis_precedence`, `borrower`,
`covenants`, `periods`, `documents`. Optional: `generated_at`, `events`, `memory`, `notes`.

## The 18 `$defs`

`provenance_label`, `units`, `basis`, `measure_key`, `status`, `borrower`, `covenant`, `period`,
`observation`, `measure`, `ebitda_build`, `add_back`, `adjustment`, `certified_result`,
`expected_assessment`, `document`, `event`, `memory`.

## Relationship to `types.ts`

This schema is the **authoritative shape**; [`src/kernel/types.ts`](../covenant-kernel/types.md) is a
hand-written TypeScript mirror of it. The schema is **not imported at runtime** — the kernel reads a
`FactsBundle` typed by `types.ts`, and the schema exists to (a) document the contract and (b) validate
fixtures. The two are kept in lockstep by the [oracle test](../eval-harness/oracle-test.md): if a
fixture drifts from the shape the kernel expects, a row fails.

## Notable modeled concepts

- **`observation.basis`** + **`basis_precedence`** — the multi-basis-per-period model that makes the
  flip a precedence resolution.
- **`add_back.allowed: boolean | null`** — the tri-state adjudication (`true` summed, `false`/`null`
  dropped) that the recompute keys off.
- **`measure.state`** (`observed`/`derived`/`missing`/`stale`) + **`unmapped_fields[]`** +
  **`field_map_fingerprint`** — the drift-detection surface.
- **`expected_assessment[]`** — the embedded oracle (test-only; `assess()` must never read it).
- **`memory.related_deals[]`** + **`sponsor`** — the cross-deal join surface.

## Version

`schema_version` is pinned to `"1.0.0"` as a const in both the schema and the types. Bumping the data
contract means bumping both plus every fixture.

Related: [data model](../../atlas/database-schema.md),
[ADR-0011](../../decisions/0011-synthetic-fixtures-oracle.md).
