// You.com Research mini-demo API — auto-mounted at /api/research by the demo loader.
// Showcases the You.com stack end to end: Search (live web), Research/ARI (cited deep research —
// synchronous for one question, ASYNC for a portfolio fan-out), and the billing balance.
import { Router } from "express";
import { searchLiveWeb, youResearch, youBalance } from "../../src/server/youcom.js";
import { jobs } from "../../src/server/jobs.js";
import { loadCorpus } from "../../src/corpus.js";
import { newRun, attach, listRuns } from "../../src/server/researchLog.js";

const router = Router();

// ---- Live web search -----------------------------------------------------
// Mode 1 — DETECT. Fast, broad, shallow: is this pattern in the live web right now?
// Dispatched like the others so every mode lands in the same research log.
router.post("/search", (req, res) => {
  const { query, freshness } = req.body ?? {};
  if (!query || typeof query !== "string") return void res.status(400).json({ error: "query required" });
  const run_id = newRun("search", query);
  const job = jobs.dispatch("search", query.slice(0, 90), async () => {
    const r = await searchLiveWeb(query, { freshness: freshness ?? "week", livecrawl: "news", emptyFallback: true, timeoutMs: 15000 });
    // Normalise into the shared result shape so one renderer serves all three modes.
    return {
      label: r.label,
      headline: `${r.hits.length} result${r.hits.length === 1 ? "" : "s"} from the live web`,
      finding: null,
      summary: "",
      highlights: r.hits.map((h) => h.snippet).filter((x): x is string => !!x).slice(0, 5),
      sources: r.hits.map((h) => ({ url: h.url, title: h.title, publisher: h.publisher })),
    };
  }, { question: query, freshness: freshness ?? "week" });
  attach(run_id, job.id);
  res.status(202).json({ run_id, job_id: job.id });
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
  const run_id = newRun("single", input);
  const job = jobs.dispatch("research", input.slice(0, 90), () =>
    youResearch(input, { effort: effort === "deep" ? "deep" : "standard", timeoutMs: 90000 }),
    { question: input }
  );
  attach(run_id, job.id);
  res.status(202).json({ job_id: job.id, run_id, status: job.status });
});

// The portfolio sweep: one research job per sponsor, dispatched concurrently. This is the case that
// makes async non-optional — run sequentially these would take ~2 minutes; fanned out they land together.
router.post("/portfolio", (req, res) => {
  const corpus = loadCorpus();
  const seen = new Set<string>();
  const dispatched: Array<{ job_id: string; sponsor: string; borrowers: string[]; question: string }> = [];
  // Optional: fan the caller's OWN question across every sponsor. Empty → the default covenant-risk sweep.
  const ask = typeof req.body?.question === "string" ? req.body.question.trim() : "";
  const run_id = newRun("fan_out", ask);

  for (const b of corpus) {
    const sponsor = b.borrower.sponsor?.name;
    if (!sponsor || seen.has(sponsor)) continue;
    seen.add(sponsor);
    const borrowers = corpus
      .filter((x) => x.borrower.sponsor?.name === sponsor)
      .map((x) => x.borrower.short_name ?? x.borrower.legal_name);

    const question = ask
      ? `In the context of ${sponsor} and its private-credit portfolio companies: ${ask}`
      : `Are there recent reports of accounting restatements, auditor changes, disallowed EBITDA add-backs, ` +
        `or covenant disputes among private-credit borrowers backed by sponsors such as ${sponsor}? ` +
        `Summarise what a lender monitoring such a borrower should watch for.`;

    const job = jobs.dispatch(
      "research",
      `${ask ? "Agent" : "Covenant-risk sweep"} — ${sponsor}`,
      () => youResearch(question, { effort: "standard", timeoutMs: 90000 }),
      { sponsor, borrowers, question }
    );
    attach(run_id, job.id);
    dispatched.push({ job_id: job.id, sponsor, borrowers, question });
  }

  res.status(202).json({ run_id, dispatched, count: dispatched.length });
});

router.get("/jobs", (_req, res) => res.json({ jobs: jobs.list(30) }));

// The research log: every run, newest first, each partitioned by the question that produced it.
router.get("/runs", (_req, res) => res.json({ runs: listRuns(25) }));

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
