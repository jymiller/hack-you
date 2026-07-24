---
type: migration_assessment
scope: system-wide
last_analyzed: 2026-07-24
overall_readiness: 0.82
scores:
  dependency_injection: 0.85
  test_coverage: 0.80
  separation_of_concerns: 0.90
  api_surface_clarity: 0.85
  data_layer_isolation: 0.70
global_state_inventory:
  session_keys_total: 0
  global_variables: ["process.env.YDC_API_KEY", "process.env.PORT"]
  singletons: ["app (Express)", "sessions (Map<string,ScanResult>)", "_prerunCache (youcom.ts)"]
---

# Migration Readiness — System-wide

"Migration" here means *extractability and reuse readiness*: how cleanly each domain could be lifted
out, embedded in another product (e.g. the real ENID platform), or scaled. For a hackathon prototype
this codebase scores unusually high — because the entire design front-loads risk into a pure,
offline, testable core.

## Overall readiness: **0.82 / 1.0** (high)

| Axis | Score | Why |
|---|---|---|
| Dependency injection | 0.85 | The kernel takes everything as parameters (facts, covenant, certificate, memory, ctx). `MemoryContext` is an injected interface. The one leak is direct `process.env` reads in `youcom.ts`/`app.ts`. |
| Test coverage | 0.80 | 51 assertions reproduce the 10 gates + the error matrix + the offline scan. The kernel and corpus are exhaustively covered; the Express routes and the UIs have no automated tests. |
| Separation of concerns | 0.90 | Pure kernel ↔ vendor integration ↔ orchestration ↔ web are cleanly layered; the attest gate is structurally isolated. |
| API surface clarity | 0.85 | `assess()` and `attest()` are single, well-typed entry points; the data contract is a versioned JSON Schema. |
| Data layer isolation | 0.70 | Data is JSON read synchronously with `readFileSync` per call (no caching, no repository abstraction); paths are resolved from `import.meta.url`. Fine at corpus scale, not a data access layer. |

## Per-domain readiness (migrate/extract lowest-coupling first)

| Domain | Coupling | Boundary | Testability | Effort | Extract order |
|---|---|---|---|---|---|
| [covenant-kernel](../maps/covenant-kernel/index.md) | 0.08 | clean | high | small | **1 — lift as a library today** |
| [attestation-gate](../maps/attestation-gate/index.md) | 0.10 | clean | high | small | 2 |
| [scoreboard-labels](../maps/scoreboard-labels/index.md) | 0.10 | clean | high | small | 3 |
| [infrastructure](../maps/infrastructure/index.md) | 0.15 | clean | high | small | 4 (config only) |
| [synthetic-corpus](../maps/synthetic-corpus/index.md) | 0.20 | clean | high | small | 5 |
| [eval-harness](../maps/eval-harness/index.md) | 0.30 | clean | high | small | 6 |
| [youcom-integration](../maps/youcom-integration/index.md) | 0.35 | partial | high | medium | 7 — parameterise the env read |
| [scan-orchestration](../maps/scan-orchestration/index.md) | 0.40 | partial | high | medium | 8 — de-hardcode Thornwick |
| [web-demo-platform](../maps/web-demo-platform/index.md) | 0.50 | partial | medium | medium | 9 — Express + sessions Map |

## Global state inventory

- **Session/request state:** none. No sessions, no cookies, no auth. The kernel has zero global reads.
- **Env vars (2):** `YDC_API_KEY` (read in `youcom.ts` via `apiKey()` and surfaced by
  `/api/health`), `PORT` (read in `app.ts`). Both have safe defaults/fallbacks.
- **Singletons (3):** the Express `app`, the `sessions` Map (non-persistent scan cache), and the lazy
  `_prerunCache` in `youcom.ts`. None are in the kernel.

## The two real blockers for productionization

1. **In-memory `sessions` Map** (`app.ts`). Scan state lives in one process; a Render restart or a
   second instance loses it. For a single-instance demo this is fine; horizontal scale needs an
   external store (Redis/DB) or a stateless attest that re-derives the proposal from the scan inputs.
2. **Demo-hardcoding in `scan.ts`.** `runScan` is wired to Thornwick/`q1-2026`. Generalizing to
   "scan any borrower on any trigger" is straightforward (the kernel is already generic) but the
   orchestration currently encodes the money-shot.

Neither touches the kernel — the load-bearing logic is already clean.

See [pattern-inventory.md](pattern-inventory.md), [dependency-analysis.md](dependency-analysis.md),
and [domain-boundaries.md](domain-boundaries.md).
