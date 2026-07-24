// GATE 5 (DENY/attest), GATE 6 (scoreboard), ★ GATE 7 (labels).

import { describe, expect, it } from "vitest";
import { assess } from "../kernel/assess.js";
import { attest, makeAttestation, serveIfCommitted } from "../kernel/attest.js";
import { Scoreboard } from "../kernel/scoreboard.js";
import { buildMemoryContext, loadCorpus, withMemory } from "../corpus.js";
import { certificateFor, findCovenant } from "./helpers.js";
import type { Assessment, Provenance } from "../kernel/types.js";

const NOW = "2026-07-24T09:00:00Z";
const LABELS: Provenance[] = ["SYNTHETIC", "LIVE", "PRERUN"];

const ANALYST = { analyst_id: "an-01", name: "A. Vergdefinetta", role: "credit_analyst" as const };

function thornwickBreach(): Assessment {
  const { bundle, memory } = withMemory("thornwick");
  const covenant = findCovenant(bundle, "total_net_leverage");
  const certificate = certificateFor(bundle, "q1-2026", "total_net_leverage");
  return assess(bundle, covenant, certificate, memory, { now: NOW });
}

describe("GATE 5 — DENY / human-attest gate: zero writes before attest", () => {
  it("proposal is inert (PENDING) and no serve is reachable without a CommittedWrite", () => {
    const a = thornwickBreach();
    expect(a.proposed_write).not.toBeNull();
    expect(a.proposed_write!.requires_attestation).toBe(true);
    expect(a.proposed_write!.attestation_state).toBe("PENDING");
    expect(a.proposed_write!.downstream.dry_run).toBe(true);

    // Pre-attest: there is no WriteResult, so serveIfCommitted has nothing to serve.
    expect(serveIfCommitted(null, NOW)).toBeNull();
  });

  it("DENY → write_denied, no serve fires", () => {
    const a = thornwickBreach();
    const denial = makeAttestation(a.proposed_write!, "DENY", ANALYST, NOW, "Need the auditor's restatement note first.");
    const result = attest(a.proposed_write!, denial);
    expect(result.outcome).toBe("denied");
    expect(serveIfCommitted(result, NOW)).toBeNull();
  });

  it("ATTEST → write_committed, and only then does a notice receipt exist", () => {
    const a = thornwickBreach();
    const ok = makeAttestation(a.proposed_write!, "ATTEST", ANALYST, NOW, "Confirmed against restated FY2025.");
    const result = attest(a.proposed_write!, ok);
    expect(result.outcome).toBe("committed");
    const receipt = serveIfCommitted(result, NOW);
    expect(receipt).not.toBeNull();
    expect(receipt!.provenance_label).toBe("SYNTHETIC");
    expect(receipt!.channel).toBe("covenant_register");
  });

  it("a tampered attestation is rejected", () => {
    const a = thornwickBreach();
    const ok = makeAttestation(a.proposed_write!, "ATTEST", ANALYST, NOW);
    const tampered = { ...ok, decision: "DENY" as const }; // signature no longer matches
    expect(() => attest(a.proposed_write!, tampered)).toThrow();
  });
});

describe("GATE 6 — scoreboard: the money-shot emits an ordered event feed", () => {
  it("Thornwick: scanned → breach → memory_hit → attested → write_committed (in order)", () => {
    const a = thornwickBreach();
    const sb = new Scoreboard(NOW);
    sb.scan(a, { triggerEventId: "ev-thornwick-fy2025-restatement", triggerLabel: "LIVE", triggerSource: "you_research_ari" });
    const ok = makeAttestation(a.proposed_write!, "ATTEST", ANALYST, NOW);
    const result = attest(a.proposed_write!, ok);
    sb.attested(a, ok);
    sb.writeResult(a, result, serveIfCommitted(result, NOW));

    const names: string[] = sb.events.map((e) => e.event);
    for (const expected of ["scanned", "breach", "memory_hit", "attested", "write_committed"]) {
      expect(names).toContain(expected);
    }
    // relative order preserved
    const idx = (n: string) => names.indexOf(n);
    expect(idx("scanned")).toBeLessThan(idx("breach"));
    expect(idx("breach")).toBeLessThan(idx("memory_hit"));
    expect(idx("memory_hit")).toBeLessThan(idx("attested"));
    expect(idx("attested")).toBeLessThan(idx("write_committed"));
    // seq is monotonic
    expect(sb.events.every((e, i) => e.seq === i)).toBe(true);
    // scanned came from a live You.com crawl
    expect(sb.events[0].provenance_label).toBe("LIVE");
  });

  it("Northgate: drift_detected + breach on the schema-rename period", () => {
    const corpus = loadCorpus();
    const bundle = corpus.find((b) => b.facts_id === "northgate")!;
    const memory = buildMemoryContext(bundle, corpus);
    const covenant = findCovenant(bundle, "interest-cover");
    const certificate = certificateFor(bundle, "p-2026-q1", "interest-cover");
    const a = assess(bundle, covenant, certificate, memory, { now: NOW, target_period_id: "p-2026-q1" });
    expect(a.status).toBe("BREACH");
    expect(a.drift.detected).toBe(true);

    const sb = new Scoreboard(NOW);
    sb.scan(a, { triggerEventId: "evt-northgate-traffic-q1-2026", triggerLabel: "LIVE", triggerSource: "you_search" });
    const names: string[] = sb.events.map((e) => e.event);
    expect(names).toContain("breach");
    expect(names).toContain("drift_detected");
  });
});

describe("★ GATE 7 — honesty labels: every effect carries exactly one label, none unlabeled", () => {
  it("money-shot triad: facts SYNTHETIC · recompute LIVE · downstream_serve SYNTHETIC", () => {
    const a = thornwickBreach();
    expect(a.labels.facts).toBe("SYNTHETIC");
    expect(a.labels.recompute).toBe("LIVE");
    expect(a.labels.downstream_serve).toBe("SYNTHETIC");
    expect(a.provenance_label).toBe("SYNTHETIC");
    expect(a.proposed_write!.provenance_label).toBe("SYNTHETIC");
  });

  it("every assessment across the corpus is fully labeled with valid values", () => {
    const corpus = loadCorpus();
    for (const bundle of corpus) {
      const memory = buildMemoryContext(bundle, corpus);
      for (const period of bundle.periods) {
        for (const covenant of bundle.covenants) {
          const certificate = certificateFor(bundle, period.period_id, covenant.covenant_id);
          const a = assess(bundle, covenant, certificate, memory, { now: NOW, target_period_id: period.period_id });
          for (const v of [a.labels.facts, a.labels.recompute, a.labels.downstream_serve, a.provenance_label]) {
            expect(LABELS).toContain(v);
          }
        }
      }
    }
  });

  it("every scoreboard event on the full money-shot carries a valid label — none unlabeled", () => {
    const a = thornwickBreach();
    const sb = new Scoreboard(NOW);
    sb.scan(a, { triggerEventId: "ev-thornwick-fy2025-restatement", triggerLabel: "LIVE", triggerSource: "you_research_ari" });
    const ok = makeAttestation(a.proposed_write!, "ATTEST", ANALYST, NOW);
    const result = attest(a.proposed_write!, ok);
    sb.attested(a, ok);
    sb.writeResult(a, result, serveIfCommitted(result, NOW));

    expect(sb.events.length).toBeGreaterThan(0);
    for (const e of sb.events) {
      expect(LABELS).toContain(e.provenance_label);
    }
    // the issued notice is SYNTHETIC (a synthetic-book notice), never a mock mislabeled
    expect(sb.events.find((e) => e.event === "write_committed")!.provenance_label).toBe("SYNTHETIC");
  });
});
