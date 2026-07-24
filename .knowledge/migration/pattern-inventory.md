---
type: migration_assessment
scope: system-wide
last_analyzed: 2026-07-24
---

# Pattern Inventory

The recurring code patterns across Covenant Sentinel, with counts, an example, and what each means
for reuse. The codebase is small and stylistically consistent — most patterns exist to serve the two
non-negotiables: **purity/determinism** in the core and **honesty labels** on every effect.

## 1 · Pure function with injected clock (kernel core)

**Count:** 6 (`assess`, `attest`, `recomputeEbitda`, `resolve`, `classify`, `detectDrift`,
`consultMemory` — all no-I/O). **Example:** `src/kernel/assess.ts`.

```ts
export function assess(facts, covenant, certificate, memory, ctx): Assessment {
  const now = ctx.now;                 // injected — never Date.now()
  const order = ctx.precedence_override ?? facts.basis_precedence;
  ...
}
```

Every input is a parameter; the only "clock" is `ctx.now`. **Reuse:** ideal — these functions are
referentially transparent and portable to any runtime.

## 2 · Total function (returns `errors[]`, never throws)

**Count:** 1 primary (`assess`, via the `indeterminate()` helper), mirrored by `attest`'s narrow
throw-only-on-tamper. **Example:** `src/kernel/assess.ts` `recomputeRatio` → `indeterminate(...)`.

A data fault yields an `INDETERMINATE` Finding with an `ErrorCode`, not an exception. **Reuse:** makes
the kernel safe to embed behind any boundary without try/catch churn. See
[ADR-0010](../decisions/0010-kernel-totality.md).

## 3 · Resolver with tiered fallback

**Count:** 1 (`resolve` in `recompute.ts`) — 4 tiers: clean measure → reconstruct from build →
stale-fallback (raises drift) → UNRESOLVED. **Example:** `src/kernel/recompute.ts`.

The single most subtle pattern: it decides *when* to trust an extracted value vs. rebuild it, and
the choice is exactly the schema-drift boundary. **Reuse:** high, but the tier order is load-bearing —
document it before touching it.

## 4 · Single comparator parameterised by `direction`

**Count:** 1 (`classify`/`headroom` in `classify.ts`) serving both leverage ceilings (`max`) and
cover-ratio floors (`min`). **Example:** `src/kernel/classify.ts`.

```ts
headroom = direction === "max" ? threshold - value : value - threshold;   // <0 ⇒ BREACH
```

**Reuse:** high — one code path, no per-metric branching.

## 5 · Fingerprint the map, not the values

**Count:** 1 (`fingerprint`/`detectDrift` in `drift.ts`). **Example:** `src/kernel/drift.ts`.

`sha256` over sorted `(canonical_key:raw_name)` pairs + unmapped names; recomputed, never trusted
from the stored `field_map_fingerprint`. **Reuse:** the pattern generalizes to any
schema-drift-over-time detector. See [ADR-0004](../decisions/0004-field-map-fingerprint-drift.md).

## 6 · Capability-object gate (effect gated behind a token type)

**Count:** 1 (`executeCommitted(w: CommittedWrite)` in `attest.ts`). **Example:**
`src/kernel/attest.ts`.

The side-effecting serve requires a `CommittedWrite`, which only `attest()` constructs on ATTEST.
**Reuse:** a clean, type-enforced authorization pattern worth copying. See
[ADR-0005](../decisions/0005-human-attest-gate.md).

## 7 · Deterministic id / signature via SHA over pipe-joined fields

**Count:** ~7 call sites (`assessment_id`, `proposal_id`, `attestation_id`, `receipt_id`,
`signature`, drift/doc fingerprints). **Example:** `sha1Hex(\`${borrower}|${covenant}|${period}|${basis}|${value}\`)`.

Folds the meaningful fields into the id so equal inputs → equal id (idempotency). **Reuse:** high;
keep the field list stable or ids change.

## 8 · API client with labeled fallback

**Count:** 4 (`searchLiveWeb`, `researchAri`, `youResearch`, `youBalance`). **Example:**
`src/server/youcom.ts`.

`key? → fetch → LIVE`, else/on-error → a labeled fallback (SYNTHETIC or PRERUN). Wrapped in an
`AbortController` timeout (`fetchJson`). **Reuse:** high; the "never hang, always label" shape is the
demo's reliability spine. See [ADR-0008](../decisions/0008-youcom-two-endpoints-fallback.md).

## 9 · Background task + poll-to-completion

**Count:** 2 (`researchAri`, `youResearch`). **Example:** `src/server/youcom.ts`.

`POST … {background:true}` → `task_id`, then poll `GET /{task_id}` until terminal within a budget.
**Reuse:** the canonical async-API pattern; portable.

## 10 · Convention-based auto-loader (drop-in directory)

**Count:** 1 (`mountDemos` in `app.ts`). **Example:** `src/server/app.ts`.

Scan `demos/`, register `page.html` + dynamic-import `routes.ts` per slug. **Reuse:** a neat plugin
architecture; the dynamic `import()` couples it to tsx-on-import. See
[ADR-0009](../decisions/0009-mini-demo-auto-mount.md).

## 11 · Self-contained inline-CSS/JS page

**Count:** 5 (`web/index.html`, `web/app.html`, `demos/youcom/page.html`, `demos/data/page.html`, and
this KB's own HTML). **Example:** `web/app.html`.

No bundler, no external assets, a shared dark palette copied per file. **Reuse:** trivially portable;
the copy-paste palette is the one duplication cost.

## 12 · Event stream with monotonic seq + provenance label

**Count:** 1 (`Scoreboard` in `scoreboard.ts`). **Example:** `src/kernel/scoreboard.ts`.

Append-only `events[]`, `seq++`, every event carries a `provenance_label`. **Reuse:** high; a clean
telemetry primitive.

## Consistency verdict

Pattern consistency is high (~0.88 system-wide). The core patterns (1–7) are applied uniformly across
the kernel; the integration patterns (8–9) are uniform across `youcom.ts`; the UI pattern (11) is
copy-paste-consistent. The only inconsistency worth noting is **id/label naming across fixtures**
(underscores vs hyphens vs bespoke covenant ids), which is data, not code, and harmless because the
kernel keys off `covenant.metric`.
