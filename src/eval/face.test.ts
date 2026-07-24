// GATE 8 — FACE. The live scan wires You.com into the money-shot. Offline (no key) it degrades to
// the labeled fallback: Search → SYNTHETIC fixture, ARI → the PRERUN cached response. The flip still
// fires with sources shown; the recompute is REAL over the SYNTHETIC book.

import { describe, expect, it } from "vitest";
import { runScan, applyAttestation } from "../server/scan.js";

const NOW = "2026-07-24T09:00:00Z";

describe("GATE 8 — FACE: You.com-wrapped scan (offline fallback path)", () => {
  it("scan produces the flip with a cited ARI brief and an ordered scoreboard", async () => {
    delete process.env.YDC_API_KEY; // force the deterministic offline fallback
    const s = await runScan(NOW);

    // the flip survives the wrap
    expect(s.headline.status).toBe("BREACH");
    expect(s.headline.recomputed_value).toBe(7.59);
    expect(s.headline.certified.certification_conflict).toBe(true);

    // ARI degraded to the genuine PRERUN cache — with real sources
    expect(s.ari.label).toBe("PRERUN");
    expect(s.ari.sources.length).toBeGreaterThanOrEqual(6);
    expect(s.ari.summary.length).toBeGreaterThan(0);

    // live citations attached to the finding + the proposed write
    expect(s.headline.evidence.citations.length).toBe(s.ari.sources.length);
    expect(s.proposal?.evidence.citations.length).toBe(s.ari.sources.length);

    // Search degraded to SYNTHETIC (nothing crawled) — never mislabeled PRERUN
    expect(s.search.label).toBe("SYNTHETIC");

    // ordered scoreboard
    const names: string[] = s.scoreboard.map((e) => e.event);
    expect(names).toContain("scanned");
    expect(names).toContain("breach");
    expect(names).toContain("memory_hit");
  });

  it("attest gate over the scan: ATTEST commits and issues the notice; DENY issues nothing", async () => {
    delete process.env.YDC_API_KEY;
    const s = await runScan(NOW);
    const analyst = { analyst_id: "an-01", name: "Duty Analyst", role: "credit_analyst" as const };

    const committed = applyAttestation(s.headline, s.proposal!, "ATTEST", analyst, NOW, null, s.scoreboard.length);
    expect(committed.outcome).toBe("committed");
    expect(committed.serve_receipt?.provenance_label).toBe("SYNTHETIC");
    expect(committed.events.map((e) => e.event)).toContain("write_committed");

    const denied = applyAttestation(s.headline, s.proposal!, "DENY", analyst, NOW, "hold", s.scoreboard.length);
    expect(denied.outcome).toBe("denied");
    expect(denied.serve_receipt).toBeNull();
    expect(denied.events.map((e) => e.event)).toContain("write_denied");
  });
});
