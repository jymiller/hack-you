// Parasail mini-demo API — auto-mounted at /api/parasail by the demo loader (src/server/app.ts).
// Self-contained GLM-5.2 reasoning chat over Parasail's OpenAI-compatible serverless inference.
import { Router } from "express";
import { chatFull, parasailStatus, type ChatMessage } from "../../src/server/parasail.js";

const router = Router();

// Model id + whether the key is configured — drives the header pill on the page.
router.get("/status", (_req, res) => res.json(parasailStatus()));

router.post("/chat", async (req, res) => {
  const { messages } = req.body ?? {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return void res.status(400).json({ error: "messages[] required" });
  }
  try {
    const r = await chatFull(messages as ChatMessage[], { timeoutMs: 120000 });
    res.json({ label: "LIVE", ...r });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
