---
type: module
name: attestation-gate
display_name: Attestation & Breach-Notice Gate
status: active
file_locations:
  entry_points: ["src/kernel/attest.ts"]
  controllers: ["src/kernel/attest.ts"]
  models: ["src/kernel/types.ts (ProposedWrite, Attestation, CommittedWrite, DeniedWrite, ServeReceipt)"]
  services: ["src/kernel/util.ts (sha256Hex)"]
  views: ["web/app.html (attest gate UI)"]
  tests: ["src/eval/gates.test.ts", "src/eval/face.test.ts"]
  config: []
patterns:
  - type: capability-object gate (effect unreachable without a token type)
    count: 1
    example: src/kernel/attest.ts
  - type: tamper-evident signature
    count: 1
    example: src/kernel/attest.ts
dependencies:
  internal: ["covenant-kernel"]
  external: ["node:crypto"]
  database_tables: []
migration:
  coupling_score: 0.10
  session_dependencies: 0
  global_dependencies: 0
  singleton_dependencies: []
  pattern_consistency: 1.0
  abstraction_boundary: clean
  testability: high
  estimated_effort: small
  blockers: []
---

# Attestation & Breach-Notice Gate

The safety domain. `assess()` only ever **proposes** a write; a separate, human-driven `attest()`
is the sole thing that can turn a proposal into a `CommittedWrite`, and `executeCommitted()` — the
one function in the whole system that touches the outside world — cannot be called without one. This
makes "zero writes before a human signs off" a **structural** guarantee, not a convention.

Physically this is one file, `src/kernel/attest.ts`, but it is a distinct business function: the
authorization + notice-issuance gate the security judge rewards.

## Public API (`attest.ts`)

| Function | Signature | Role |
|---|---|---|
| `signAttestation` | `(proposalId, analystId, decision, attestedAt) → string` | `sha256(proposal_id\|analyst_id\|decision\|attested_at)` — tamper-evident |
| `makeAttestation` | `(proposal, decision, attestedBy, attestedAt, note?) → Attestation` | builds a signed attestation (convenience for the UI/callers) |
| `attest` | `(proposal, attestation) → WriteResult` | verifies id-match + signature; `ATTEST → CommittedWrite`, `DENY → DeniedWrite`. Throws **only** on tamper/mismatch, never on a business DENY. |
| `executeCommitted` | `(committedWrite, servedAt, detail?) → ServeReceipt` | the ONLY side-effecting serve — issues the reservation-of-rights notice to the covenant register (SYNTHETIC) |
| `serveIfCommitted` | `(result \| null, servedAt, detail?) → ServeReceipt \| null` | guard: serve iff a `CommittedWrite` exists; a PENDING proposal or a `DeniedWrite` yields `null` |

## Why the gate is structural

`executeCommitted(w: CommittedWrite)` takes a value of a type that **only `attest()` can construct**,
and only on the `ATTEST` branch. There is no other constructor of `CommittedWrite` in the codebase.
So the compiler and the call graph together enforce: no served notice without a human ATTEST. The
`ProposedWrite` emitted by the kernel is inert by construction — `requires_attestation: true`,
`attestation_state: "PENDING"`, `downstream.dry_run: true`. See
[ADR-0005](../../decisions/0005-human-attest-gate.md).

## Idempotency & tamper-evidence

- **Idempotency:** `ProposedWrite.proposal_id` folds in the recomputed value and the fingerprint, so
  a re-scan of an unchanged breach yields the same id and cannot double-serve.
- **Tamper-evidence:** flip a stored decision from ATTEST to DENY and the signature no longer matches
  `signAttestation(...)`, so `attest()` throws. `gates.test.ts` proves this ("a tampered attestation
  is rejected").

## Flow

The gate is driven from [scan-orchestration](../scan-orchestration/index.md)'s `applyAttestation()`
and surfaced in the desk UI (`web/app.html`, the "Attest breach / Deny" buttons). On ATTEST the UI
shows a `write_committed` scoreboard event and a receipt; on DENY, `write_denied` and no receipt.
Full trace in [data-flows.md §2](../../atlas/data-flows.md).

## Related

Card: [`attest.ts`](../../cards/attestation-gate/attest.md) · Decisions:
[ADR-0005](../../decisions/0005-human-attest-gate.md),
[ADR-0006](../../decisions/0006-honesty-label-discipline.md)
