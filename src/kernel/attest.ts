// §7 — the human gate. `assess()` only PROPOSES; a separate human `attest()` flips it, and only a
// CommittedWrite can reach `executeCommitted` (the wrapper). No write or serve is structurally
// possible without a human ATTEST. Same DENY/attest gate as the Wet-Ink policy-gate win.

import { sha256Hex } from "./util.js";
import type { Attestation, CommittedWrite, DeniedWrite, ProposedWrite, ServeReceipt, WriteResult } from "./types.js";

// Tamper-evident signature over the decision.
export function signAttestation(proposalId: string, analystId: string, decision: "ATTEST" | "DENY", attestedAt: string): string {
  return sha256Hex(`${proposalId}|${analystId}|${decision}|${attestedAt}`);
}

// Build a signed attestation for a proposal (convenience for callers/UI).
export function makeAttestation(
  proposal: ProposedWrite,
  decision: "ATTEST" | "DENY",
  attestedBy: Attestation["attested_by"],
  attestedAt: string,
  note: string | null = null
): Attestation {
  return {
    attestation_id: sha256Hex(`${proposal.proposal_id}|${attestedBy.analyst_id}|${attestedAt}`),
    proposal_id: proposal.proposal_id,
    attested_by: attestedBy,
    decision,
    attested_at: attestedAt,
    note,
    signature: signAttestation(proposal.proposal_id, attestedBy.analyst_id, decision, attestedAt),
  };
}

// attest() authorizes; it performs NO serve. Throws only on a broken/mismatched attestation
// (tamper or wrong proposal) — never on a business DENY, which is a first-class DeniedWrite.
export function attest(proposal: ProposedWrite, attestation: Attestation): WriteResult {
  if (attestation.proposal_id !== proposal.proposal_id) {
    throw new Error(`attestation proposal_id '${attestation.proposal_id}' != proposal '${proposal.proposal_id}'`);
  }
  const expected = signAttestation(
    proposal.proposal_id,
    attestation.attested_by.analyst_id,
    attestation.decision,
    attestation.attested_at
  );
  if (attestation.signature !== expected) {
    throw new Error("attestation signature invalid (tamper-evident check failed)");
  }
  if (attestation.decision === "ATTEST") {
    const committed: CommittedWrite = { outcome: "committed", proposal, attestation, committed_at: attestation.attested_at };
    return committed;
  }
  const denied: DeniedWrite = {
    outcome: "denied",
    proposal,
    attestation,
    denied_at: attestation.attested_at,
    denied_reason: attestation.note,
  };
  return denied;
}

// The ONLY place the system touches the outside world. Cannot be reached without a CommittedWrite,
// which only a human ATTEST produces. On stage this serve is PRERUN (a cached receipt).
export function executeCommitted(w: CommittedWrite, servedAt: string, detail?: unknown): ServeReceipt {
  return {
    receipt_id: sha256Hex(`${w.proposal.proposal_id}|${w.attestation.attestation_id}|${servedAt}`),
    channel: "actionlayer",
    template: "reservation_of_rights",
    target_ref: w.proposal.downstream.target_ref,
    served_at: servedAt,
    provenance_label: "PRERUN",
    detail,
  };
}

// Guard used by the wrapper/UI: serve iff a CommittedWrite exists; a PENDING proposal or a
// DeniedWrite yields null. Makes "zero writes before attest" a runtime invariant, not a hope.
export function serveIfCommitted(result: WriteResult | null, servedAt: string, detail?: unknown): ServeReceipt | null {
  if (result && result.outcome === "committed") return executeCommitted(result, servedAt, detail);
  return null;
}
