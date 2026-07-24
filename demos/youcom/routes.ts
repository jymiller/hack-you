// You.com mini-demo API — auto-mounted at /api/youcom by the demo loader (src/server/app.ts).
// Self-contained: this directory is the whole demo (page.html + routes.ts + meta.json).
import { Router } from "express";
import { searchLiveWeb, youResearch, youBalance } from "../../src/server/youcom.js";

const router = Router();

router.post("/search", async (req, res) => {
  const { query, freshness, livecrawl } = req.body ?? {};
  if (!query || typeof query !== "string") return void res.status(400).json({ error: "query required" });
  try {
    res.json(await searchLiveWeb(query, { freshness: freshness ?? "week", livecrawl: livecrawl ?? "news", emptyFallback: true, timeoutMs: 15000 }));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/research", async (req, res) => {
  const { input, effort } = req.body ?? {};
  if (!input || typeof input !== "string") return void res.status(400).json({ error: "input required" });
  try {
    res.json(await youResearch(input, { effort: effort === "deep" ? "deep" : "standard" }));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get("/balance", async (_req, res) => {
  try {
    res.json(await youBalance());
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
