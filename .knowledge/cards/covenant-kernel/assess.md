---
type: card
module: covenant-kernel
file: src/kernel/assess.ts
complexity: high
lines: 372
last_analyzed: 2026-07-24
migration:
  global_refs: []
  session_keys_read: []
  session_keys_written: []
  db_tables_touched: ["FactsBundle (read-only input parameter)"]
  side_effects: []
  singleton_pattern: false
  extractable: true
  extraction_notes: "Pure. Imports only sibling kernel modules + node:crypto (transitively via util). No I/O, no globals, injected clock. Extract as-is."
---

# `src/kernel/assess.ts` — the kernel entry point

The top-level pure function. Takes a borrower's Facts bundle + one covenant + the borrower's
certificate + injected memory + a context, and returns an `Assessment` (the Finding). Never throws
on a data fault — returns an `INDETERMINATE` Finding with `errors[]` instead.

## Signature

```ts
assess(facts: FactsBundle, covenant: Covenant, certificate: Certificate | null,
       memory: MemoryContext, ctx: AssessCtx): Assessment
```

## The 10-step pipeline

1. **Locate period** — `certificate?.period_id ?? ctx.target_period_id`. Missing → `UNKNOWN_PERIOD`.
2. **Validate covenant type** — `metric ∈ VALID_METRICS` and `direction ∈ {max,min}`. Else
   `UNKNOWN_COVENANT_TYPE`.
3. **Resolve authoritative observation** — `resolveAuthoritative(period, order)`: rank observations by
   `basis_precedence` index, tie-break by latest `as_of`. **This is the flip** — `audited_restated`
   outranks `borrower_certified`. None → `NO_OBSERVATION`.
4. **Select threshold** — `selectThreshold(covenant, test_date)` (the dated stepdown). None →
   `NO_EFFECTIVE_THRESHOLD` (never PASS).
5. **Recompute the ratio** — `recomputeRatio(obs, covenant)`: `resolve(num)/resolve(den)`. Guards for
   `MISSING_INPUT` (unresolved), `STALE_INPUT_UNBACKED` (a stale fallback with no build), and
   `DIVIDE_BY_ZERO`.
6. **Detect drift** — `detectDrift(obs, priorSameBasis(...), covenant)` — runs even on PASS/INDETERMINATE.
7. **Classify** — `classify(value, threshold, direction, watch_rule, trend)`; `trend` is built by
   recomputing each earlier period's authoritative observation.
8. **Consult memory** — `consultMemory(...)` when BREACH or a disallowed add-back drove the number.
9. **Certification conflict** — computed on the **natural** precedence for the period (independent of
   any `precedence_override`), so a pinned-basis oracle run still reports the true period-level
   conflict. Recorded, never an input to `status`.
10. **Emit proposed write** — `buildProposedWrite()` for WATCH/BREACH only; attach labels
    (`facts` SYNTHETIC, `recompute` LIVE, `downstream_serve` SYNTHETIC); return.

## Non-obvious details (gotchas)

- **Two precedence orderings in one call.** The `status` uses `ctx.precedence_override ?? basis_precedence`;
  the `certification_conflict` re-resolves on `facts.basis_precedence` *natural* order via
  `resolveAuthoritative(period, facts.basis_precedence)`. This is deliberate — the oracle pins a basis
  to check a per-basis row, but the period-level conflict must reflect the real authoritative status.
- **`STALE_INPUT_UNBACKED` still records the drift + stale source.** The `indeterminate()` helper takes
  a `detail` arg so the INDETERMINATE Finding keeps `ratio.numerator_source: "stale_fallback"` and the
  loud drift signal (per spec §3/§11) — an unbacked stale input is INDETERMINATE, never a silent PASS.
- **`assessment_id` is deterministic:** `sha1(borrower|covenant|period|basis|value)`. A re-run yields
  the same id.
- **`from_status` in the proposed write** is derived from the certificate's status
  (`IN_COMPLIANCE → PASS`, `NOT_IN_COMPLIANCE → BREACH`, else PASS), producing the human "GREEN → BREACH"
  rationale string.

## There is one dead-code import

`headroom` and `fingerprint` are imported; `fingerprint` is used in `buildProposedWrite` (fallback),
but `headroom` from `classify.js` is imported and not directly referenced in `assess.ts` (classify
returns the headroom). Harmless — noted for tidiness.

## Depends on

`classify.ts`, `drift.ts`, `memory.ts`, `recompute.ts`, `util.ts`, `types.ts`. Consumed by
[scan-orchestration](../../maps/scan-orchestration/index.md), the corpus sweep, and every
[eval test](../../maps/eval-harness/index.md).

Related: [ADR-0002](../../decisions/0002-recompute-never-trust.md),
[ADR-0003](../../decisions/0003-basis-precedence-resolution.md),
[ADR-0010](../../decisions/0010-kernel-totality.md).
