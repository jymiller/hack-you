// §9 — one universal event feed that makes green→breach legible on stage. `seq` is monotonic so
// the UI can order and replay. Money-shot order: scanned → breach → drift_detected → memory_hit →
// attested → write_committed.

import type {
  Assessment,
  Attestation,
  Provenance,
  ScoreboardEvent,
  ScoreboardEventName,
  ServeReceipt,
  WriteResult,
} from "./types.js";

export class Scoreboard {
  private seq: number;
  readonly events: ScoreboardEvent[] = [];

  private push(
    event: ScoreboardEventName,
    a: Pick<Assessment, "borrower_id" | "covenant_id" | "period_id" | "assessment_id">,
    provenance_label: Provenance,
    data: Record<string, unknown>
  ): ScoreboardEvent {
    const e: ScoreboardEvent = {
      event,
      seq: this.seq++,
      ts: this.now,
      borrower_id: a.borrower_id,
      covenant_id: a.covenant_id ?? null,
      period_id: a.period_id ?? null,
      provenance_label,
      assessment_id: a.assessment_id ?? null,
      data,
    };
    this.events.push(e);
    return e;
  }

  constructor(private now: string, startSeq = 0) {
    this.seq = startSeq;
  }

  // Emit the ordered feed for one assessment. `scanned` carries the trigger's label (REAL when a
  // live You.com crawl fired); the recompute findings are REAL computations over the SYNTHETIC book.
  scan(
    a: Assessment,
    opts: {
      triggerEventId?: string | null;
      triggerLabel?: Provenance;
      triggerSource?: "you_search" | "you_research_ari" | "schedule";
      countMemoryOnce?: boolean;
      memoryAlreadyCounted?: Set<string>;
    } = {}
  ): void {
    const triggerLabel = opts.triggerLabel ?? "SYNTHETIC";
    this.push("scanned", a, triggerLabel, {
      trigger_event_id: opts.triggerEventId ?? null,
      covenants_queued: 1,
      source: opts.triggerSource ?? "schedule",
    });

    if (a.status === "PASS") {
      this.push("pass", a, "REAL", { recomputed_value: a.recomputed_value, threshold: a.threshold?.value, headroom: a.headroom, authoritative_basis: a.authoritative_basis });
    } else if (a.status === "WATCH") {
      this.push("watch", a, "REAL", { recomputed_value: a.recomputed_value, threshold: a.threshold?.value, headroom: a.headroom, triggered_by: a.watch.triggered_by, trend: a.watch.trend.map((t) => ({ period_id: t.period_id, value: t.value })) });
    } else if (a.status === "BREACH") {
      this.push("breach", a, "REAL", {
        recomputed_value: a.recomputed_value,
        threshold: a.threshold?.value,
        headroom: a.headroom,
        authoritative_basis: a.authoritative_basis,
        from_value: a.certified.certified_value,
        certification_conflict: a.certified.certification_conflict,
        rationale: a.proposed_write?.rationale ?? null,
      });
    }

    if (a.drift.detected) {
      const d = a.drift.details[0];
      this.push("drift_detected", a, "REAL", {
        kinds: a.drift.kinds,
        canonical_key: d?.canonical_key ?? null,
        prior_raw_name: d?.prior_raw_name ?? null,
        current_raw_name: d?.current_raw_name ?? null,
        unmapped_raw_names: a.drift.details.flatMap((x) => x.unmapped_raw_names),
        prior_fingerprint: d?.prior_fingerprint ?? null,
        current_fingerprint: a.drift.current_fingerprint,
      });
    }

    if (a.memory.hit) {
      // Memory retrieval is recorded once per (borrower, period) so the scoreboard counts one hit.
      const key = `${a.borrower_id}|${a.period_id}`;
      const seen = opts.memoryAlreadyCounted;
      if (!(opts.countMemoryOnce && seen && seen.has(key))) {
        const m = a.memory.matches[0];
        this.push("memory_hit", a, "REAL", {
          sponsor_id: m?.sponsor_id,
          prior_facts_id: m?.prior_facts_id,
          relation: m?.relation ?? [],
          pattern_tags: m?.pattern_tags ?? [],
          shared_add_back_category: m?.shared_add_back_category ?? null,
        });
        seen?.add(key);
      }
    }
  }

  // The human gate outcome, then its consequence.
  attested(a: Assessment, attestation: Attestation): void {
    this.push("attested", a, "REAL", {
      proposal_id: attestation.proposal_id,
      decision: attestation.decision,
      analyst_id: attestation.attested_by.analyst_id,
      attested_at: attestation.attested_at,
      signature: attestation.signature,
    });
  }

  writeResult(a: Assessment, result: WriteResult, serve: ServeReceipt | null): void {
    if (result.outcome === "committed") {
      this.push("write_committed", a, "PRERUN", {
        proposal_id: result.proposal.proposal_id,
        downstream: { channel: result.proposal.downstream.channel, template: result.proposal.downstream.template, target_ref: result.proposal.downstream.target_ref },
        serve_receipt_id: serve?.receipt_id ?? null,
        provenance_label: "PRERUN",
      });
    } else {
      this.push("write_denied", a, "REAL", {
        proposal_id: result.proposal.proposal_id,
        denied_reason: result.denied_reason,
      });
    }
  }
}
