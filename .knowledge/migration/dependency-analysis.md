---
type: migration_assessment
scope: system-wide
last_analyzed: 2026-07-24
---

# Dependency Analysis

How the nine domains depend on each other, and where the (very few) global-state hotspots are. The
striking feature is a strict, acyclic layering with the pure kernel at the bottom depending on
nothing.

## Domain × domain coupling matrix

Rows depend on columns. `●` = direct import/use, `○` = indirect/type-only, blank = none.

| depends on → | kernel | attest | scoreboard | corpus | youcom | scan | web | eval | infra |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **covenant-kernel** | — | | | | | | | | |
| **attestation-gate** | ● | — | | | | | | | |
| **scoreboard-labels** | ○ | | — | | | | | | |
| **synthetic-corpus** | ○ | | | — | | | | | |
| **youcom-integration** | ○ | | | ●(cache) | — | | | | |
| **scan-orchestration** | ● | ● | ● | ● | ● | — | | | |
| **web-demo-platform** | ● | ○ | ○ | ● | ●(demo) | ● | — | | |
| **eval-harness** | ● | ● | ● | ● | ● | ● | | — | |
| **infrastructure** | | | | | | | | | — |

**No cycles.** The kernel imports nothing internal; everything flows *toward* it. `scan-orchestration`
is the fan-in hub (imports five domains); `eval-harness` imports six (it tests them all). `○` marks
type-only dependencies on `types.ts` (which compiles away).

## Fan-in / fan-out

| Domain | Imports (out) | Imported by (in) | Role |
|---|---|---|---|
| covenant-kernel | 0 internal | 6 | the foundation — depended on by all logic |
| synthetic-corpus | kernel (types) | 4 | data layer |
| attestation-gate | kernel | 3 | gate |
| scoreboard-labels | kernel (types) | 3 | telemetry |
| youcom-integration | kernel (types), corpus (cache) | 3 | vendor |
| scan-orchestration | 5 domains | 2 | orchestration hub |
| web-demo-platform | 4 domains | 0 | top of the stack |
| eval-harness | 6 domains | 0 | verification |

## Global-state hotspots

There are essentially none in the logic. The complete inventory:

| Global | Read by | Written by | Notes |
|---|---|---|---|
| `process.env.YDC_API_KEY` | `youcom.ts` (`apiKey()`), `app.ts` (`/api/health`) | `face.test.ts` (`delete`) | the one env dependency in the vendor path; has a safe fallback |
| `process.env.PORT` | `app.ts` | — | defaults to 8080 |
| `sessions` Map | `app.ts` (`/api/attest`) | `app.ts` (`/api/scan`) | in-memory scan cache; **the** state hotspot; single-instance |
| `_prerunCache` | `youcom.ts` | `youcom.ts` (lazy) | benign read-once cache of the PRERUN JSON |
| Express `app` | `app.ts`, demo routers | `app.ts` | the framework singleton |

**The kernel (7 files), attest, scoreboard, corpus, and the fixtures read zero globals and hold zero
session state.** All mutable state and all env reads are confined to the `web-demo-platform` and
`youcom-integration` domains — the outer shell.

## What this means for change safety

- Editing the kernel can't ripple *up* through hidden globals — it has none. Downstream breakage would
  surface as a failing oracle/gate test, not a runtime surprise.
- The only "shared mutable" is the `sessions` Map, touched by exactly two routes in one file. Reasoning
  about it is local.
- `face.test.ts` mutating `process.env.YDC_API_KEY` is the one test-time global write; it's scoped to
  forcing the offline path and doesn't leak across the pure kernel.

See [domain-boundaries.md](domain-boundaries.md) for the clean/partial/entangled classification and a
phased extraction order.
