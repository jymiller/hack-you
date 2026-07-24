---
type: module
name: covenant-kernel
display_name: Covenant Kernel (deterministic assessment core)
status: active
file_locations:
  entry_points: ["src/kernel/assess.ts"]
  controllers: ["src/kernel/recompute.ts", "src/kernel/classify.ts", "src/kernel/drift.ts", "src/kernel/memory.ts"]
  models: ["src/kernel/types.ts"]
  services: ["src/kernel/util.ts"]
  views: []
  tests: ["src/eval/flip.test.ts", "src/eval/oracle.test.ts", "src/eval/totality.test.ts"]
  config: []
patterns:
  - type: pure function (no I/O, injected clock)
    count: 6
    example: src/kernel/assess.ts
  - type: resolver with tiered fallback
    count: 1
    example: src/kernel/recompute.ts
  - type: single comparator parameterised by direction
    count: 1
    example: src/kernel/classify.ts
  - type: total function (returns errors[], never throws)
    count: 1
    example: src/kernel/assess.ts
dependencies:
  internal: []
  external: ["node:crypto"]
  database_tables: ["FactsBundle (read-only input)"]
migration:
  coupling_score: 0.08
  session_dependencies: 0
  global_dependencies: 0
  singleton_dependencies: []
  pattern_consistency: 0.95
  abstraction_boundary: clean
  testability: high
  estimated_effort: small
  blockers: []
---

# Covenant Kernel

The heart of Covenant Sentinel and the whole reason the demo is trustworthy: **one pure function**
turns a borrower's Facts bundle into an assessment, with no network, no LLM, and no clock except an
injected `now`. This is the money-shot, expressed as plain arithmetic you can unit-test offline.

```ts
function assess(
  facts: FactsBundle, covenant: Covenant, certificate: Certificate | null,
  memory: MemoryContext, ctx: AssessCtx
): Assessment      // never throws for data faults — returns errors[] instead
```

## What each file does

| File | Lines | Role |
|---|---|---|
| [`assess.ts`](../../cards/covenant-kernel/assess.md) | 372 | The 10-step top-level pipeline: locate period → validate → resolve authoritative observation → threshold → recompute → drift → classify → memory → certification conflict → propose write. |
| [`recompute.ts`](../../cards/covenant-kernel/recompute.md) | 52 | "Recompute, never trust." `recomputeEbitda` sums only `allowed===true` add-backs + signed adjustments; `resolve` reads a clean measure, else reconstructs from the build, else a stale fallback, else UNRESOLVED. |
| [`classify.ts`](../../cards/covenant-kernel/classify.md) | 82 | One comparator via `direction` (max ceiling / min floor). `headroom<0 → BREACH`; WATCH is the union of proximity + a deteriorating-trend rule; else PASS. `selectThreshold` picks the dated stepdown. |
| [`drift.ts`](../../cards/covenant-kernel/drift.md) | 94 | Field-map fingerprint. Detects `unmapped_field`, `stale_carry_forward`, and `field_rename` by comparing the map of `(canonical_key → raw_name)` pairs, not the values. |
| [`memory.ts`](../../cards/covenant-kernel/memory.md) | 77 | Cross-deal sponsor memory. Joins sibling bundles by `sponsor_id` and matches a shared disallowed add-back category (Thornwick → Halveston). |
| [`types.ts`](../../cards/covenant-kernel/types.md) | 497 | The full type contract — `FactsBundle`, `Assessment`, `ProposedWrite`, `ScoreboardEvent`, all enums. Re-typed by hand from the Facts JSON Schema + kernel spec. |
| [`util.ts`](../../cards/covenant-kernel/util.md) | 41 | Deterministic primitives: `sha256Hex`/`sha1Hex` (ids + fingerprints) and covenant-grade `round` (half_up/half_even/truncate with an FP epsilon). |

## The five kernel mechanisms

1. **Recompute** the ratio from raw measures — never adopt the certified number or stated EBITDA total.
2. **Fingerprint** the field map — catch a silent rename where a value diff sees nothing.
3. **Classify** PASS/WATCH/BREACH/INDETERMINATE via one `direction`-parameterised comparator.
4. **Consult memory** across bundles on the `sponsor_id` join.
5. **Propose a write** that is inert until a separate human `attest()` flips it (see the
   [attestation-gate](../attestation-gate/index.md)).

## Why the boundary is clean (coupling 0.08)

- **Zero framework coupling.** No Express, no filesystem, no env vars. The only import outside the
  kernel is `node:crypto` (for hashing) in `util.ts`.
- **No global or session state.** Every input arrives as a parameter; the only "clock" is
  `ctx.now`. Determinism is a hard requirement, not a nicety.
- **The `MemoryContext` is injected** as an interface (`{ self, bySponsor(id) }`), so cross-bundle
  retrieval is a dependency the caller supplies — the kernel never reaches for a corpus.

This is the domain you could lift out as a standalone npm library tomorrow. See the
[domain boundaries analysis](../../migration/domain-boundaries.md).

## Worked example — the flip

Thornwick `q1-2026`, `total_net_leverage` (direction max, threshold 6.50):

- Authoritative basis = `audited_restated` (outranks `borrower_certified`).
- `resolve(adjusted_ebitda)` = clean observed measure **29.0**; `resolve(total_net_debt)` = 220.0.
- `220 / 29.0 = 7.586… → 7.59×`, headroom `6.50 − 7.59 = −1.09` → **BREACH**.
- Certificate said 6.47× IN_COMPLIANCE → `certification_conflict = true`.
- Memory: sponsor Ardenmoor + `run_rate_synergy` disallowed → **hit → Halveston**.

Reproduced exactly by [`flip.test.ts`](../eval-harness/index.md) and the fixture oracle.

## Related decisions

[ADR-0001](../../decisions/0001-deterministic-offline-core.md) ·
[ADR-0002](../../decisions/0002-recompute-never-trust.md) ·
[ADR-0003](../../decisions/0003-basis-precedence-resolution.md) ·
[ADR-0004](../../decisions/0004-field-map-fingerprint-drift.md) ·
[ADR-0007](../../decisions/0007-cross-deal-sponsor-memory.md) ·
[ADR-0010](../../decisions/0010-kernel-totality.md)
