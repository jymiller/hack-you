// Sentinel desk server. Serves the UI and two endpoints, one per demo action:
//   POST /api/scan   — fire You.com (Search + ARI), recompute, return the finding + scoreboard.
//   POST /api/attest — the human gate; on ATTEST, issue the breach notice to the covenant register.
// Deploys to a live URL (AWS Builder Loft credits / Render). "Running live" scores the AWS judge.

import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { applyAttestation, runScan, type ScanResult } from "./scan.js";
import { searchLiveWeb, youResearch, youBalance } from "./youcom.js";
import { loadCorpus, buildMemoryContext } from "../corpus.js";
import { assess } from "../kernel/assess.js";
import { certificateFor } from "../eval/helpers.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");

// Load .env if present (no dependency; Node 20.6+). Never fails the boot.
try {
  process.loadEnvFile(join(ROOT, ".env"));
} catch {
  /* no .env — offline/fallback mode */
}

const app = express();
app.use(express.json());
app.use(express.static(join(ROOT, "web")));

// In-memory session store: scan_id → the scan result (so attest can find the proposal).
const sessions = new Map<string, ScanResult>();

function nowIso(): string {
  return new Date().toISOString();
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, youcom_key: !!process.env.YDC_API_KEY, service: "covenant-sentinel" });
});

app.post("/api/scan", async (req, res) => {
  try {
    const mode = req.body?.mode === "prerun" ? "prerun" : "live";
    const result = await runScan(nowIso(), mode);
    sessions.set(result.scan_id, result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Page routes: front page at /, Sentinel app at /app, You.com explorer at /youcom.
app.get("/app", (_req, res) => res.sendFile(join(ROOT, "web", "app.html")));
app.get("/youcom", (_req, res) => res.sendFile(join(ROOT, "web", "youcom.html")));

// You.com explorer — live Search, ARI research (financial brief), and credit balance.
app.post("/api/youcom/search", async (req, res) => {
  const { query, freshness, livecrawl } = req.body ?? {};
  if (!query || typeof query !== "string") return void res.status(400).json({ error: "query required" });
  try {
    res.json(await searchLiveWeb(query, { freshness: freshness ?? "week", livecrawl: livecrawl ?? "news", emptyFallback: true, timeoutMs: 15000 }));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
app.post("/api/youcom/research", async (req, res) => {
  const { input, effort } = req.body ?? {};
  if (!input || typeof input !== "string") return void res.status(400).json({ error: "input required" });
  try {
    res.json(await youResearch(input, { effort: effort === "deep" ? "deep" : "standard" }));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
app.get("/api/youcom/balance", async (_req, res) => {
  try {
    res.json(await youBalance());
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/api/attest", (req, res) => {
  const { scan_id, decision, note } = req.body ?? {};
  const scan = scan_id ? sessions.get(scan_id) : undefined;
  if (!scan || !scan.proposal) {
    res.status(404).json({ error: "unknown scan_id or no proposal to attest" });
    return;
  }
  if (decision !== "ATTEST" && decision !== "DENY") {
    res.status(400).json({ error: "decision must be ATTEST or DENY" });
    return;
  }
  const result = applyAttestation(
    scan.headline,
    scan.proposal,
    decision,
    { analyst_id: "an-01", name: "Duty Credit Analyst", role: "credit_analyst" },
    nowIso(),
    note ?? null,
    scan.scoreboard.length
  );
  res.json(result);
});

// Secondary panel: the whole-corpus sweep (proves the kernel doesn't cry breach at everything).
app.get("/api/corpus", (_req, res) => {
  const corpus = loadCorpus();
  const now = nowIso();
  const rows = [];
  for (const bundle of corpus) {
    const memory = buildMemoryContext(bundle, corpus);
    for (const period of bundle.periods) {
      for (const covenant of bundle.covenants) {
        const cert = certificateFor(bundle, period.period_id, covenant.covenant_id);
        const a = assess(bundle, covenant, cert, memory, { now, target_period_id: period.period_id });
        rows.push({
          borrower: bundle.borrower.short_name ?? bundle.facts_id,
          period: period.period_id,
          covenant: covenant.covenant_id,
          status: a.status,
          value: a.recomputed_value,
          certified: a.certified.certified_value,
          conflict: a.certified.certification_conflict === true,
          drift: a.drift.detected,
          memory: a.memory.hit,
        });
      }
    }
  }
  res.json({ rows });
});

const PORT = Number(process.env.PORT ?? 8080);
app.listen(PORT, () => {
  console.log(`Covenant Sentinel on http://localhost:${PORT}  (You.com key: ${process.env.YDC_API_KEY ? "present" : "absent → PRERUN/SYNTHETIC fallback"})`);
});
