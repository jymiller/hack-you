// Render mini-demo API — auto-mounted at /api/render by the demo loader.
// Self-observability: the running instance reports its OWN facts from the env vars Render injects
// into every service, plus process runtime. Deliberately uses NO Render API key — an infrastructure
// admin token can read every other secret, and it has no business on a public box. Everything here
// is self-reported by the process you're talking to.
import { Router } from "express";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const router = Router();
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BOOTED_AT = new Date().toISOString();

const val = (k: string): string | null => process.env[k]?.trim() || null;

function humanUptime(sec: number): string {
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  return [d && `${d}d`, (d || h) && `${h}h`, `${m}m`, `${s}s`].filter(Boolean).join(" ");
}

// Live facts about THIS process. On Render the RENDER_* vars are populated; locally they're absent
// and we say so rather than inventing them.
router.get("/runtime", (_req, res) => {
  const onRender = val("RENDER") === "true" || !!val("RENDER_SERVICE_ID");
  const mem = process.memoryUsage();
  res.json({
    label: "LIVE",
    environment: onRender ? "render" : "local",
    service: {
      name: val("RENDER_SERVICE_NAME"),
      id: val("RENDER_SERVICE_ID"),
      type: val("RENDER_SERVICE_TYPE"),
      instance_id: val("RENDER_INSTANCE_ID"),
      external_url: val("RENDER_EXTERNAL_URL"),
      is_pull_request: val("IS_PULL_REQUEST") === "true",
    },
    git: {
      commit: val("RENDER_GIT_COMMIT"),
      commit_short: val("RENDER_GIT_COMMIT")?.slice(0, 7) ?? null,
      branch: val("RENDER_GIT_BRANCH"),
      repo_slug: val("RENDER_GIT_REPO_SLUG"),
    },
    process: {
      node: process.version,
      platform: `${process.platform}/${process.arch}`,
      pid: process.pid,
      port: Number(process.env.PORT ?? 8080),
      booted_at: BOOTED_AT,
      uptime_seconds: Math.round(process.uptime()),
      uptime_human: humanUptime(process.uptime()),
      rss_mb: +(mem.rss / 1048576).toFixed(1),
      heap_used_mb: +(mem.heapUsed / 1048576).toFixed(1),
    },
    // Which integrations are configured — presence only, never a value.
    integrations: {
      youcom: !!val("YDC_API_KEY"),
      parasail: !!val("PARASAIL_API_KEY"),
      parasail_model: val("PARASAIL_MODEL"),
    },
  });
});

// The Blueprint that provisioned this service — infrastructure as code, straight from the repo.
// Contains env var NAMES only (values are dashboard secrets, `sync: false`).
router.get("/blueprint", (_req, res) => {
  try {
    const yaml = readFileSync(join(ROOT, "render.yaml"), "utf8");
    const declared = [...yaml.matchAll(/-\s*key:\s*([A-Z0-9_]+)/g)].map((m) => m[1]);
    const secret = [...yaml.matchAll(/-\s*key:\s*([A-Z0-9_]+)\s*\n\s*sync:\s*false/g)].map((m) => m[1]);
    res.json({
      label: "LIVE",
      yaml,
      summary: {
        declared_env: declared,
        dashboard_secrets: secret,
        plan: yaml.match(/^\s*plan:\s*(\S+)/m)?.[1] ?? null,
        region: yaml.match(/^\s*region:\s*(\S+)/m)?.[1] ?? null,
        health_check: yaml.match(/^\s*healthCheckPath:\s*(\S+)/m)?.[1] ?? null,
        build_command: yaml.match(/^\s*buildCommand:\s*(.+)$/m)?.[1]?.trim() ?? null,
        start_command: yaml.match(/^\s*startCommand:\s*(.+)$/m)?.[1]?.trim() ?? null,
        auto_deploy: /autoDeploy:\s*true/.test(yaml),
      },
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
