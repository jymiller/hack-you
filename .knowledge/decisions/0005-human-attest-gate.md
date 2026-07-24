---
type: decision
id: ADR-0005
title: Writes are structurally unreachable without a human ATTEST
status: inferred
date_inferred: 2026-07-24
scope: domain
affects: ["attestation-gate", "covenant-kernel", "scan-orchestration"]
migration_impact: none
migration_notes: "The capability-object gate is a clean, type-enforced authorization pattern worth preserving verbatim."
---

# ADR-0005 · Human attest gate

## Context

An agent that autonomously fires a breach notice at a counterparty is a liability. The system must
guarantee — not merely by convention — that no downstream effect happens without a human in the loop,
and that decision must be auditable and tamper-evident.

## Decision

Split the pipeline so `assess()` only ever emits a **`ProposedWrite`** that is inert by construction
(`requires_attestation: true`, `attestation_state: "PENDING"`, `downstream.dry_run: true`, all `const`
literals). A separate `attest()` — a different function with a different caller — verifies a
signed `Attestation` and produces a `CommittedWrite` (on ATTEST) or a `DeniedWrite` (on DENY).
`executeCommitted()`, the **only** side-effecting function in the codebase, takes a `CommittedWrite`
— and nothing else constructs one. The type system therefore enforces "no serve without a human ATTEST".

## Consequences

- `serveIfCommitted(null, …)` and `serveIfCommitted(deniedWrite, …)` both return `null` — "zero writes
  before attest" is a runtime invariant, proved by `gates.test.ts`.
- The attestation carries a tamper-evident `sha256(proposal|analyst|decision|attested_at)` signature;
  flipping a stored decision breaks it and `attest()` throws.
- Idempotency: `proposal_id` folds in the value + fingerprint, so a re-scanned unchanged breach yields
  the same id and cannot double-serve.
- The issued notice is SYNTHETIC (over the synthetic book) — no external counterparty is ever served.

## Evidence

`docs/KERNEL-SPEC.md` §7, `src/kernel/attest.ts`, `gates.test.ts`/`face.test.ts`, the desk attest UI.
See the [attest card](../cards/attestation-gate/attest.md).
