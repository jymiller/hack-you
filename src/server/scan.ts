// FACE — the live scan. Fires You.com Search (fresh headline) + ARI (cited brief) at t≈0, runs the
// deterministic kernel over the SYNTHETIC book, and attaches the LIVE/PRERUN citations to the finding.
// The recompute is LIVE over a SYNTHETIC book; the research is You.com's. Two endpoints, one per job.

import { assess } from "../kernel/assess.js";
import { attest, makeAttestation, serveIfCommitted } from "../kernel/attest.js";
import { Scoreboard } from "../kernel/scoreboard.js";
import { withMemory } from "../corpus.js";
import { ARI_QUESTION, SEARCH_QUERY, researchAri, searchLiveWeb, type AriResult, type SearchResult } from "./youcom.js";
import type { Assessment, Attestation, ProposedWrite, ScoreboardEvent, ServeReceipt } from "../kernel/types.js";

const TRIGGER_EVENT_ID = "ev-thornwick-fy2025-restatement";

export interface ScanResult {
  scan_id: string;
  generated_at: string;
  borrower: { borrower_id: string; legal_name: string; short_name?: string; sponsor?: string | null };
  search: SearchResult;
  ari: AriResult;
  headline: Assessment; // Thornwick total_net_leverage — the money-shot
  trigger: { headline: string; summary: string | null; published_at: string | null; source: string; label: "SYNTHETIC" }; // the synthetic filing that triggered the scan
  bridge: { certified_ebitda: number | null; recomputed_ebitda: number | null; net_debt: number | null; certified_ratio: number | null; recomputed_ratio: number | null; threshold: number | null };
  assessments: Assessment[]; // leverage + interest_cover
  proposal: ProposedWrite | null;
  scoreboard: ScoreboardEvent[];
  labels: { search: string; ari: string; recompute: "LIVE"; downstream_serve: "SYNTHETIC" };
}

function attachLiveCitations(a: Assessment, ari: AriResult, eventId: string): void {
  const citations = ari.sources.map((s) => ({ url: s.url, title: s.title, publisher: s.publisher, snippet: s.snippet }));
  a.evidence.event_ids = [...new Set([eventId, ...a.evidence.event_ids])];
  a.evidence.citations = citations;
  if (a.proposed_write) {
    a.proposed_write.evidence.event_ids = [...new Set([eventId, ...a.proposed_write.evidence.event_ids])];
    a.proposed_write.evidence.citations = citations;
  }
}

export async function runScan(now: string, mode: "live" | "prerun" = "live"): Promise<ScanResult> {
  const { bundle, memory } = withMemory("thornwick");
  const leverage = bundle.covenants.find((c) => c.covenant_id === "total_net_leverage")!;
  const interest = bundle.covenants.find((c) => c.covenant_id === "interest_cover")!;

  const certLev = certificate(bundle, "q1-2026", "total_net_leverage");
  const certIc = certificate(bundle, "q1-2026", "interest_cover");

  // Fire both You.com endpoints concurrently at scan time. Search proves live freshness on the
  // real theme (week window widens the news hit rate); ARI builds the cited brief.
  const [search, ari] = await Promise.all([
    searchLiveWeb(SEARCH_QUERY, { freshness: "week", livecrawl: "news", mode }),
    researchAri(ARI_QUESTION, { mode }),
  ]);

  // The synthetic filing that triggered this scan (a synthetic borrower has no real headline).
  const triggerEvent = (bundle.events ?? []).find((e) => e.event_id === TRIGGER_EVENT_ID);
  const trigger = {
    headline: triggerEvent?.headline ?? "Thornwick Logistics Holdings restates FY2025 accounts following auditor change",
    summary: "FY2025 restated by incoming auditor Marbury Tolland LLP: £1.7m early-recognised revenue reversed, £3.0m unrealised run-rate synergies disallowed.",
    published_at: "2026-07-03",
    source: "ENID synthetic corpus fixture",
    label: "SYNTHETIC" as const,
  };

  const a = assess(bundle, leverage, certLev, memory, { now, event_ids: [TRIGGER_EVENT_ID] });
  const aIc = assess(bundle, interest, certIc, memory, { now, event_ids: [TRIGGER_EVENT_ID] });
  attachLiveCitations(a, ari, TRIGGER_EVENT_ID);
  attachLiveCitations(aIc, ari, TRIGGER_EVENT_ID);

  // The EBITDA flip that drives the money-shot: certified adjusted EBITDA vs the restated recompute.
  const certObs = bundle.periods.find((p) => p.period_id === "q1-2026")!.observations.find((o) => o.basis === "borrower_certified")!;
  const certifiedEbitda = certObs.measures.find((m) => m.key === "adjusted_ebitda")?.value ?? null;
  const bridge = {
    certified_ebitda: certifiedEbitda,
    recomputed_ebitda: a.ratio.denominator_value,
    net_debt: a.ratio.numerator_value,
    certified_ratio: a.certified.certified_value,
    recomputed_ratio: a.recomputed_value,
    threshold: a.threshold?.value ?? null,
  };

  const sb = new Scoreboard(now);
  sb.scan(a, {
    triggerEventId: TRIGGER_EVENT_ID,
    triggerLabel: search.label,
    triggerSource: "you_research_ari",
  });

  return {
    scan_id: a.assessment_id,
    generated_at: now,
    borrower: {
      borrower_id: bundle.borrower.borrower_id,
      legal_name: bundle.borrower.legal_name,
      short_name: bundle.borrower.short_name,
      sponsor: bundle.borrower.sponsor?.name ?? null,
    },
    search,
    ari,
    headline: a,
    trigger,
    bridge,
    assessments: [a, aIc],
    proposal: a.proposed_write,
    scoreboard: sb.events,
    labels: { search: search.label, ari: ari.label, recompute: "LIVE", downstream_serve: "SYNTHETIC" },
  };
}

// The human gate: attest the proposal, then (only on ATTEST) issue the reservation-of-rights
// breach notice to the covenant register.
export interface AttestResult {
  outcome: "committed" | "denied";
  attestation: Attestation;
  serve_receipt: ServeReceipt | null;
  events: ScoreboardEvent[];
}

export function applyAttestation(
  headline: Assessment,
  proposal: ProposedWrite,
  decision: "ATTEST" | "DENY",
  analyst: Attestation["attested_by"],
  now: string,
  note: string | null,
  seqStart: number
): AttestResult {
  const attestation = makeAttestation(proposal, decision, analyst, now, note);
  const result = attest(proposal, attestation);
  const serve = serveIfCommitted(result, now, { note: "SYNTHETIC — reservation-of-rights notice recorded in the covenant register" });

  // continue the scoreboard sequence from where the scan left off
  const sb = new Scoreboard(now, seqStart);
  sb.attested(headline, attestation);
  sb.writeResult(headline, result, serve);

  return { outcome: result.outcome, attestation, serve_receipt: serve, events: sb.events };
}

function certificate(bundle: ReturnType<typeof withMemory>["bundle"], periodId: string, covenantId: string) {
  const p = bundle.periods.find((x) => x.period_id === periodId)!;
  const obs = p.observations.find((o) => o.basis === "borrower_certified");
  if (!obs) return null;
  const cr = (obs.certified_results ?? []).find((r) => r.covenant_id === covenantId) ?? null;
  return { period_id: periodId, observation_id: obs.observation_id, certified_result: cr };
}
