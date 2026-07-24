---
type: module
name: eval-harness
display_name: Evaluation & Oracle Harness
status: active
file_locations:
  entry_points: ["src/eval/flip.test.ts", "scripts/demo.ts"]
  controllers: ["src/eval/oracle.test.ts", "src/eval/gates.test.ts", "src/eval/face.test.ts", "src/eval/totality.test.ts"]
  models: []
  services: ["src/eval/helpers.ts"]
  views: []
  tests: ["src/eval/flip.test.ts", "src/eval/oracle.test.ts", "src/eval/gates.test.ts", "src/eval/face.test.ts", "src/eval/totality.test.ts"]
  config: []
  scripts: ["scripts/demo.ts", "scripts/youcom-smoke.ts"]
patterns:
  - type: check-before-code gate test
    count: 5
    example: src/eval/flip.test.ts
  - type: data-driven oracle (iterate expected_assessment[])
    count: 1
    example: src/eval/oracle.test.ts
  - type: offline end-to-end script
    count: 1
    example: scripts/demo.ts
dependencies:
  internal: ["covenant-kernel", "attestation-gate", "scoreboard-labels", "scan-orchestration", "synthetic-corpus", "youcom-integration"]
  external: ["vitest", "node:process (env)"]
  database_tables: ["fixtures/*.json"]
migration:
  coupling_score: 0.30
  session_dependencies: 0
  global_dependencies: 1
  singleton_dependencies: []
  pattern_consistency: 0.9
  abstraction_boundary: clean
  testability: high
  estimated_effort: small
  blockers: ["face.test.ts mutates process.env.YDC_API_KEY"]
---

# Evaluation & Oracle Harness

The verification domain — **51 vitest assertions** that reproduce the ten build-loop gates, plus two
scripts (the offline money-shot and the live You.com smoke test). The build discipline is
"write the check before the code": `flip.test.ts` literally predates the kernel.

## The five test files (the gates)

| File | Gate(s) | What it proves |
|---|---|---|
| [`flip.test.ts`](../../cards/eval-harness/oracle-test.md) | ★ 3 | The flip: certificate GREEN 6.47× IN_COMPLIANCE vs `assess()` 7.59× BREACH; `certification_conflict == true`. |
| `oracle.test.ts` | 0/1/2/4 | Every `expected_assessment[]` row across all 6 borrowers — value (per pinned basis), status, drift; plus period-level conflict + memory. Sanity: the corpus is exactly six SYNTHETIC bundles. |
| `gates.test.ts` | 5/6/★7 | DENY/attest gate (zero writes before attest, tamper rejection), scoreboard ordering + monotonic seq, honesty labels (none unlabeled), Northgate drift+breach. |
| `face.test.ts` | 8 | The You.com-wrapped scan on the offline fallback path (Search→SYNTHETIC, ARI→PRERUN); the flip survives the wrap; attest commits/denies. |
| `totality.test.ts` | §11 | The error matrix — UNKNOWN_PERIOD, UNKNOWN_COVENANT_TYPE, NO_EFFECTIVE_THRESHOLD, DIVIDE_BY_ZERO, MISSING_INPUT, STALE_INPUT_UNBACKED — always a Finding with `errors[]`, never a throw; INDETERMINATE never a silent PASS. |

`helpers.ts` supplies `certificateFor` (build the borrower's claim input), `findCovenant`/`findPeriod`,
and `pinBasis` (force a basis to the top of precedence so the oracle can check each per-basis row).

## The two scripts

- **`scripts/demo.ts`** (`npm run demo`) — the offline money-shot end-to-end with a colored terminal
  scoreboard and a whole-corpus sweep. This is BUILD-LOOP gate 0's "demo runs end-to-end" and the
  proof the demo is real *before* You.com makes it live. No network.
- **`scripts/youcom-smoke.ts`** (`npm run smoke`) — fires a real Search + ARI call to confirm at
  least one LIVE endpoint hit (the bounty needs a real endpoint hit in the usage logs). Falls back
  cleanly with no key; never prints the key.

## Why it's clean

Test code with the same purity as the kernel it checks: `NOW` is a fixed ISO string everywhere, so
runs are deterministic. The one wart is `face.test.ts` mutating `process.env.YDC_API_KEY` (`delete
process.env.YDC_API_KEY`) to force the offline path — a global side effect, but scoped to forcing the
fallback.

## Related

Card: [`oracle.test.ts`](../../cards/eval-harness/oracle-test.md) · Decisions:
[ADR-0011](../../decisions/0011-synthetic-fixtures-oracle.md),
[ADR-0010](../../decisions/0010-kernel-totality.md) · Coverage feeds the
[migration readiness](../../migration/readiness-overview.md).
