// Sentinel server. Serves the landing + flagship desk, and AUTO-MOUNTS every mini-demo under demos/.
// A mini-demo is a self-contained directory demos/<slug>/ with:
//   • meta.json   (required)  { name, blurb, accent, status?, order? }  → the landing card
//   • page.html   (optional)  → served at  /<slug>
//   • routes.ts   (optional)  → an Express Router, mounted at  /api/<slug>
// Drop in a directory and it appears — no shared-file edits, unlimited parallel development.

import express from "express";
import { readdirSync, statSync, existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { applyAttestation, runScan, type ScanResult } from "./scan.js";
import { loadCorpus, buildMemoryContext } from "../corpus.js";
import { assess } from "../kernel/assess.js";
import { certificateFor } from "../eval/helpers.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const DEMOS_DIR = join(ROOT, "demos");

try {
  process.loadEnvFile(join(ROOT, ".env"));
} catch {
  /* no .env — offline/fallback mode */
}

const app = express();
app.use(express.json());
app.use(express.static(join(ROOT, "web")));

const sessions = new Map<string, ScanResult>();
const nowIso = (): string => new Date().toISOString();

// ---- Core app (flagship Sentinel desk) ----------------------------------

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, youcom_key: !!process.env.YDC_API_KEY, service: "covenant-sentinel" });
});

app.get("/app", (_req, res) => res.sendFile(join(ROOT, "web", "app.html")));

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

app.post("/api/attest", (req, res) => {
  const { scan_id, decision, note } = req.body ?? {};
  const scan = scan_id ? sessions.get(scan_id) : undefined;
  if (!scan || !scan.proposal) return void res.status(404).json({ error: "unknown scan_id or no proposal to attest" });
  if (decision !== "ATTEST" && decision !== "DENY") return void res.status(400).json({ error: "decision must be ATTEST or DENY" });
  const result = applyAttestation(
    scan.headline, scan.proposal, decision,
    { analyst_id: "an-01", name: "Duty Credit Analyst", role: "credit_analyst" },
    nowIso(), note ?? null, scan.scoreboard.length
  );
  res.json(result);
});

// Corpus sweep used by the Sentinel desk's panel (the richer explorer is the /data mini-demo).
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
          borrower: bundle.borrower.short_name ?? bundle.facts_id, period: period.period_id, covenant: covenant.covenant_id,
          status: a.status, value: a.recomputed_value, certified: a.certified.certified_value,
          conflict: a.certified.certification_conflict === true, drift: a.drift.detected, memory: a.memory.hit,
        });
      }
    }
  }
  res.json({ rows });
});

// ---- Mini-demo auto-loader ----------------------------------------------

interface DemoCard { slug: string; name: string; blurb: string; accent: string; status: string; order: number; href: string }

async function mountDemos(): Promise<DemoCard[]> {
  const registry: DemoCard[] = [];
  if (!existsSync(DEMOS_DIR)) return registry;

  for (const slug of readdirSync(DEMOS_DIR).sort()) {
    const dir = join(DEMOS_DIR, slug);
    if (!statSync(dir).isDirectory()) continue;
    const metaPath = join(dir, "meta.json");
    if (!existsSync(metaPath)) continue;

    let meta: Record<string, unknown>;
    try {
      meta = JSON.parse(readFileSync(metaPath, "utf8"));
    } catch {
      console.error(`demo '${slug}': invalid meta.json — skipped`);
      continue;
    }

    const pagePath = join(dir, "page.html");
    const hasPage = existsSync(pagePath);
    registry.push({
      slug,
      name: (meta.name as string) ?? slug,
      blurb: (meta.blurb as string) ?? "",
      accent: (meta.accent as string) ?? "cyan",
      status: hasPage ? ((meta.status as string) ?? "live") : "soon",
      order: (meta.order as number) ?? 999,
      href: `/${slug}`,
    });

    if (hasPage) {
      app.get(`/${slug}`, (_req, res) => res.sendFile(pagePath));
      app.use(`/${slug}`, express.static(dir, { index: false }));
    }

    // Optional API router, transpiled on import by tsx.
    const routesPath = ["routes.ts", "routes.js"].map((f) => join(dir, f)).find((p) => existsSync(p));
    if (routesPath) {
      try {
        const mod = await import(pathToFileURL(routesPath).href);
        const router = mod.default ?? mod.router;
        if (router) app.use(`/api/${slug}`, router);
        else console.error(`demo '${slug}': routes file has no default export`);
      } catch (err) {
        console.error(`demo '${slug}': routes failed to load — ${(err as Error).message}`);
      }
    }
  }

  registry.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  app.get("/api/demos", (_req, res) => res.json({ demos: registry }));
  return registry;
}

// ---- Boot ---------------------------------------------------------------

const PORT = Number(process.env.PORT ?? 8080);
(async () => {
  const demos = await mountDemos();
  app.listen(PORT, () => {
    const live = demos.filter((d) => d.status === "live").map((d) => d.slug);
    console.log(
      `Covenant Sentinel on http://localhost:${PORT}  (You.com key: ${process.env.YDC_API_KEY ? "present" : "absent → fallback"})\n` +
      `  mini-demos: ${demos.map((d) => `${d.slug}[${d.status}]`).join(", ")}  ·  live: ${live.join(", ")}`
    );
  });
})();
