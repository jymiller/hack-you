---
type: card
module: attestation-gate
file: src/kernel/attest.ts
complexity: medium
lines: 81
last_analyzed: 2026-07-24
migration:
  global_refs: []
  session_keys_read: []
  session_keys_written: []
  db_tables_touched: []
  side_effects: ["executeCommitted() emits a ServeReceipt (SYNTHETIC covenant-register notice) — the only effect in the system, and only reachable via a CommittedWrite"]
  singleton_pattern: false
  extractable: true
  extraction_notes: "Pure except the deliberately-isolated executeCommitted(). node:crypto (via util) only. The type-gated effect is the whole point — keep executeCommitted the sole ServeReceipt constructor."
---

# `src/kernel/attest.ts` — the human gate

The safety file. `assess()` only proposes; `attest()` is the sole thing that can flip a proposal into
a `CommittedWrite`, and `executeCommitted()` — the only side-effecting function in the codebase —
cannot be called without one. "Zero writes before a human signs off" is therefore a *structural*
guarantee.

## Public API

| Function | Role |
|---|---|
| `signAttestation(proposalId, analystId, decision, attestedAt)` | `sha256(proposal_id\|analyst_id\|decision\|attested_at)` — tamper-evident |
| `makeAttestation(proposal, decision, attestedBy, attestedAt, note?)` | builds a signed `Attestation` |
| `attest(proposal, attestation) → WriteResult` | verify id-match + signature; `ATTEST → CommittedWrite`, `DENY → DeniedWrite` |
| `executeCommitted(committed, servedAt, detail?) → ServeReceipt` | the ONLY serve — issues the reservation-of-rights notice (SYNTHETIC) |
| `serveIfCommitted(result \| null, servedAt, detail?) → ServeReceipt \| null` | guard: serve iff a `CommittedWrite` exists |

## The two throw conditions (and only these)

`attest()` throws **only** when (a) `attestation.proposal_id !== proposal.proposal_id`, or (b) the
signature does not match `signAttestation(...)`. A business **DENY is not an error** — it is a
first-class `DeniedWrite`. This keeps the kernel total: normal decisions never throw; only tamper or
a wired-up mismatch does.

## Why the gate can't be bypassed

`executeCommitted(w: CommittedWrite)` requires a value of a type that **only the ATTEST branch of
`attest()` constructs**. There is no other `CommittedWrite` constructor anywhere. So the call graph
enforces: no served notice without a human ATTEST. `serveIfCommitted(null, …)` returns `null`, making
"nothing serves pre-attest" a runtime guard used by the orchestration and proved by `gates.test.ts`.

## The serve is SYNTHETIC

`executeCommitted` returns a `ServeReceipt` with `provenance_label: "SYNTHETIC"` and
`channel: "covenant_register"` — the notice is recorded over the synthetic book; no external
counterparty is served on stage. The `receipt_id` is `sha256(proposal_id|attestation_id|servedAt)`.

## Tests that pin this

`gates.test.ts`: proposal is PENDING/inert; DENY → no serve; ATTEST → receipt exists and is SYNTHETIC;
a tampered attestation (decision flipped after signing) throws. `face.test.ts` runs the same over the
full scan.

## Depends on

`util.ts` (`sha256Hex`), `types.ts`. Driven by
[scan-orchestration `applyAttestation`](../scan-orchestration/scan.md). Related:
[ADR-0005](../../decisions/0005-human-attest-gate.md).
