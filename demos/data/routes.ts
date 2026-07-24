// Data mini-demo API — auto-mounted at /api/data. Reviews the SYNTHETIC corpus behind the demo:
// the 6 borrowers, and for each the kernel's live assessment per period/covenant vs the baked oracle.
import { Router } from "express";
import { loadCorpus, buildMemoryContext } from "../../src/corpus.js";
import { assess } from "../../src/kernel/assess.js";
import { certificateFor } from "../../src/eval/helpers.js";

const router = Router();
const NOW = "2026-07-24T12:00:00Z";

// The six borrowers at a glance.
router.get("/corpus", (_req, res) => {
  const corpus = loadCorpus();
  const borrowers = corpus.map((b) => ({
    facts_id: b.facts_id,
    borrower: b.borrower.short_name ?? b.borrower.legal_name,
    sponsor: b.borrower.sponsor?.name ?? null,
    sector: b.borrower.sector ?? null,
    covenants: b.covenants.map((c) => c.label ?? c.covenant_id),
    periods: b.periods.length,
  }));
  res.json({ borrowers });
});

// One borrower in full: each period/covenant recomputed live, next to the fixture's expected oracle.
router.get("/borrower/:id", (req, res) => {
  const corpus = loadCorpus();
  const bundle = corpus.find((b) => b.facts_id === req.params.id || b.borrower.borrower_id === req.params.id);
  if (!bundle) return void res.status(404).json({ error: "unknown borrower" });
  const memory = buildMemoryContext(bundle, corpus);

  const rows = [];
  for (const period of bundle.periods) {
    for (const covenant of bundle.covenants) {
      const cert = certificateFor(bundle, period.period_id, covenant.covenant_id);
      const a = assess(bundle, covenant, cert, memory, { now: NOW, target_period_id: period.period_id });
      rows.push({
        period: period.period_id,
        test_date: period.test_date,
        covenant: covenant.covenant_id,
        basis: a.authoritative_basis,
        value: a.recomputed_value,
        threshold: a.threshold?.value ?? null,
        status: a.status,
        certified: a.certified.certified_value,
        certified_status: a.certified.certified_status,
        conflict: a.certified.certification_conflict === true,
        drift: a.drift.detected,
        memory: a.memory.hit,
      });
    }
  }

  res.json({
    facts_id: bundle.facts_id,
    borrower: bundle.borrower,
    notes: bundle.notes ?? null,
    covenants: bundle.covenants,
    rows,
  });
});

export default router;
