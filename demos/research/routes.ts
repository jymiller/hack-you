// You.com Research mini-demo API — auto-mounted at /api/research by the demo loader.
// Showcases the You.com stack end to end: Search (live web), Research/ARI (cited deep research —
// synchronous for one question, ASYNC for a portfolio fan-out), and the billing balance.
import { Router } from "express";
import { searchLiveWeb, youResearch, youBalance } from "../../src/server/youcom.js";
import { jobs } from "../../src/server/jobs.js";
import { loadCorpus } from "../../src/corpus.js";

const router = Router();

// ---- Live web search -----------------------------------------------------
router.post("/search", async (req, res) => {
  const { query, freshness, livecrawl } = req.body ?? {};
  if (!query || typeof query !== "string") return void res.status(400).json({ error: "query required" });
  try {
    res.json(await searchLiveWeb(query, { freshness: freshness ?? "week", livecrawl: livecrawl ?? "news", emptyFallback: true, timeoutMs: 15000 }));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ---- Synchronous research (one question; blocks ~15-18s) -----------------
router.post("/ask", async (req, res) => {
  const { input, effort } = req.body ?? {};
  if (!input || typeof input !== "string") return void res.status(400).json({ error: "input required" });
  try {
    res.json(await youResearch(input, { effort: effort === "deep" ? "deep" : "standard" }));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ---- Asynchronous research (dispatch → poll) -----------------------------
// Returns immediately with a job id; ARI runs in the background and the client polls.
router.post("/jobs", (req, res) => {
  const { input, effort } = req.body ?? {};
  if (!input || typeof input !== "string") return void res.status(400).json({ error: "input required" });
  const job = jobs.dispatch("research", input.slice(0, 90), () =>
    youResearch(input, { effort: effort === "deep" ? "deep" : "standard", timeoutMs: 90000 })
  );
  res.status(202).json({ job_id: job.id, status: job.status });
});

// The portfolio sweep: one research job per sponsor, dispatched concurrently. This is the case that
// makes async non-optional — run sequentially these would take ~2 minutes; fanned out they land together.
router.post("/portfolio", (_req, res) => {
  const corpus = loadCorpus();
  const seen = new Set<string>();
  const dispatched: Array<{ job_id: string; sponsor: string; borrowers: string[] }> = [];

  for (const b of corpus) {
    const sponsor = b.borrower.sponsor?.name;
    if (!sponsor || seen.has(sponsor)) continue;
    seen.add(sponsor);
    const borrowers = corpus
      .filter((x) => x.borrower.sponsor?.name === sponsor)
      .map((x) => x.borrower.short_name ?? x.borrower.legal_name);

    const question =
      `Are there recent reports of accounting restatements, auditor changes, disallowed EBITDA add-backs, ` +
      `or covenant disputes among private-credit borrowers backed by sponsors such as ${sponsor}? ` +
      `Summarise what a lender monitoring such a borrower should watch for.`;

    const job = jobs.dispatch(
      "research",
      `Sponsor sweep — ${sponsor}`,
      () => youResearch(question, { effort: "standard", timeoutMs: 90000 }),
      { sponsor, borrowers }
    );
    dispatched.push({ job_id: job.id, sponsor, borrowers });
  }

  res.status(202).json({ dispatched, count: dispatched.length });
});

router.get("/jobs", (_req, res) => res.json({ jobs: jobs.list(30) }));

router.get("/jobs/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return void res.status(404).json({ error: "unknown job" });
  res.json(job);
});

// ---- Account balance -----------------------------------------------------
router.get("/balance", async (_req, res) => {
  try {
    res.json(await youBalance());
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
