---
type: migration_assessment
scope: system-wide
last_analyzed: 2026-07-24
---

# Domain Boundaries

Each domain classified **clean** (extractable as a library today), **partial** (some refactoring to
extract), or **entangled** (cannot extract without rewriting). For a hackathon prototype the profile
is unusually healthy — six clean, three partial, zero entangled — because the design deliberately
kept the value in pure functions.

## Classification

| Domain | Boundary | Why |
|---|---|---|
| covenant-kernel | **clean** | Pure functions, zero internal imports, only `node:crypto`. Lift as an npm package unchanged. |
| attestation-gate | **clean** | Pure except the deliberately-isolated `executeCommitted`; depends only on kernel types + util. |
| scoreboard-labels | **clean** | Instance-local state (`events[]`), depends only on kernel types. |
| infrastructure | **clean** | Config/IaC only; no code coupling. |
| synthetic-corpus | **clean** | Data + a thin loader; the one impurity is `readFileSync`, easily swapped for any source. |
| eval-harness | **clean** | Deterministic tests; the only wart is `face.test.ts` mutating an env var. |
| youcom-integration | **partial** | Reads `process.env.YDC_API_KEY` directly and does network I/O; parameterise the key read to extract. |
| scan-orchestration | **partial** | Pure over inputs but hardcoded to Thornwick/`q1-2026`; generalize the borrower/period/trigger to extract. |
| web-demo-platform | **partial** | Express-coupled + the in-memory `sessions` Map (single-instance). Not a library — it's the process; extract pieces, not the whole. |

**Zero entangled domains.** Nothing requires a rewrite to lift out.

## What makes the clean domains clean

- **No globals, no framework.** The kernel/attest/scoreboard read nothing from the environment and
  import no framework. Every input is a parameter; the only clock is `ctx.now`.
- **Injected collaborators.** Cross-bundle retrieval is the `MemoryContext` interface, not a direct
  corpus reach. This is the single design choice that keeps the memory feature clean.
- **Type-only shared contract.** Domains share `types.ts`, which compiles away — a shape dependency,
  not a runtime one.

## What each partial domain needs

- **youcom-integration → clean:** inject the API key (and base hosts) instead of reading
  `process.env` inside `apiKey()`. Then it's a portable client with a labeled fallback.
- **scan-orchestration → clean:** replace the hardcoded `withMemory("thornwick")` / `"q1-2026"` /
  `TRIGGER_EVENT_ID` with parameters. The kernel is already generic; only the orchestration encodes
  the money-shot.
- **web-demo-platform → productionizable:** move `sessions` to an external store (or make attest
  stateless by re-deriving the proposal from the scan inputs), and bump off Render's free plan. This
  is the only work with real infrastructure implications.

## Recommended phased order

The dependency layering (see [dependency-analysis.md](dependency-analysis.md)) makes the order
obvious — extract bottom-up, lowest coupling first:

1. **Phase 1 — the library.** Extract `covenant-kernel` + `attestation-gate` + `scoreboard-labels` as
   one pure `@enid/covenant-kernel` package. Zero refactoring; the tests move with them.
2. **Phase 2 — the data.** Extract `synthetic-corpus` (schema + loader) behind a `FactsSource`
   interface so the corpus can be a DB in production.
3. **Phase 3 — the vendor.** Extract `youcom-integration` with the key injected.
4. **Phase 4 — the service.** Rebuild `scan-orchestration` generically and re-home
   `web-demo-platform` on a stateful backend (external session store, real deploy target).

Phases 1–3 are `small`/`medium` effort and touch no globals; Phase 4 is where the real
productionization work (persistence, multi-instance, auth) lives — and none of it touches the
load-bearing logic. See the [readiness overview](readiness-overview.md).
