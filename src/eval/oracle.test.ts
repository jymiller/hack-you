// GATES 0/1/2/4 — reproduce every fixture's expected_assessment[] oracle exactly.
//   • value  (recompute, pinned to each basis)      — step 1
//   • status (classify: PASS/WATCH/BREACH)          — step 2
//   • drift.detected (per observation)              — step 4
// certification_conflict and memory_hit are PERIOD-LEVEL facts (the fixtures author them so:
// Halveston "true on BOTH rows"; Thornwick's interest-cover records the memory hit once, on
// leverage). They are asserted once per period, on the naturally-resolved authoritative basis.

import { describe, expect, it } from "vitest";
import { assess } from "../kernel/assess.js";
import { buildMemoryContext, loadCorpus } from "../corpus.js";
import { certificateFor, pinBasis } from "./helpers.js";
import type { ExpectedAssessment, FactsBundle } from "../kernel/types.js";

const NOW = "2026-07-24T09:00:00Z";
const corpus = loadCorpus();

function rowsByCovenant(rows: ExpectedAssessment[]): Map<string, ExpectedAssessment[]> {
  const m = new Map<string, ExpectedAssessment[]>();
  for (const r of rows) {
    const list = m.get(r.covenant_id) ?? [];
    list.push(r);
    m.set(r.covenant_id, list);
  }
  return m;
}

describe("oracle — every expected_assessment row across the 6-borrower corpus", () => {
  for (const bundle of corpus) {
    const memory = buildMemoryContext(bundle, corpus);

    for (const period of bundle.periods) {
      const expected = period.expected_assessment ?? [];
      if (expected.length === 0) continue;
      const byCovenant = rowsByCovenant(expected);

      for (const [covenantId, rows] of byCovenant) {
        const covenant = bundle.covenants.find((c) => c.covenant_id === covenantId)!;
        const certificate = certificateFor(bundle, period.period_id, covenantId);

        for (const row of rows) {
          it(`${bundle.facts_id} · ${period.period_id} · ${covenantId} · ${row.basis} → ${row.expected_status} ${row.expected_value ?? ""}`, () => {
            const a = assess(bundle, covenant, certificate, memory, {
              now: NOW,
              precedence_override: pinBasis(bundle, row.basis),
              target_period_id: period.period_id,
            });
            expect(a.authoritative_basis).toBe(row.basis);
            if (row.expected_value != null) expect(a.recomputed_value).toBe(row.expected_value);
            expect(a.status).toBe(row.expected_status);
            expect(a.drift.detected).toBe(row.expect_drift_detected ?? false);
          });
        }
      }

      // PERIOD-LEVEL facts: certification_conflict + memory_hit
      it(`${bundle.facts_id} · ${period.period_id} → period-level conflict/memory`, () => {
        const expectedConflict = expected.some((r) => r.expect_certification_conflict);
        const expectedMemory = expected.some((r) => r.expect_memory_hit);

        const covenantIds = [...new Set(expected.map((r) => r.covenant_id))];
        let kernelConflict = false;
        let kernelMemory = false;
        for (const cid of covenantIds) {
          const covenant = bundle.covenants.find((c) => c.covenant_id === cid)!;
          const certificate = certificateFor(bundle, period.period_id, cid);
          const a = assess(bundle, covenant, certificate, memory, { now: NOW, target_period_id: period.period_id });
          if (a.certified.certification_conflict === true) kernelConflict = true;
          if (a.memory.hit) kernelMemory = true;
        }
        expect(kernelConflict).toBe(expectedConflict);
        expect(kernelMemory).toBe(expectedMemory);
      });
    }
  }
});

// Sanity: the corpus is the expected six borrowers.
describe("corpus", () => {
  it("loads all six SYNTHETIC bundles", () => {
    const ids = corpus.map((b: FactsBundle) => b.facts_id).sort();
    expect(ids.length).toBe(6);
    expect(corpus.every((b) => b.provenance_label === "SYNTHETIC")).toBe(true);
  });
});
