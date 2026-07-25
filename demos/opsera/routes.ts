// Opsera mini-demo API — auto-mounted at /api/opsera by the demo loader.
// The DevSecOps gate, self-reported. This mirrors how the Opsera Claude Code plugin actually
// works: the scan runs LOCALLY with local tooling and only findings + telemetry ever leave the
// box — source code never does. So there is no Opsera key here, and nothing is sent anywhere.
// Every number below is produced by scanning this repo at request time.
import { Router } from "express";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const exec = promisify(execFile);
const router = Router();
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// The scanners Opsera's phase-2 tool check looks for before it will run a full scan.
const SCANNERS = ["semgrep", "gitleaks", "trufflehog", "trivy", "osv-scanner", "checkov", "syft"];

// Static-analysis rules we can evaluate without third-party tooling installed.
const RULES = [
  {
    id: "CWE-209",
    severity: "low",
    title: "Internal error message returned to client",
    remediation: "Return a generic message; log the detail server-side.",
    pattern: String.raw`error: \(err as Error\)\.message`,
  },
  {
    id: "CWE-798",
    severity: "critical",
    title: "Hardcoded credential",
    remediation: "Move to an environment variable and rotate the exposed key.",
    pattern: String.raw`(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,})`,
  },
  {
    id: "CWE-489",
    severity: "medium",
    title: "Debug/inspect surface left in source",
    remediation: "Remove before shipping — these expose internals in production.",
    pattern: String.raw`(debugger;|\.only\()`,
  },
];

const CACHE_MS = 30_000;
let cache: { at: number; data: Record<string, unknown> } | null = null;

// npm audit exits non-zero whenever it finds anything — the JSON is still on stdout, so a
// throw here is the normal path, not the error path.
async function npmAudit(): Promise<Record<string, any> | null> {
  const parse = (s?: string) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };
  try {
    const { stdout } = await exec("npm", ["audit", "--json"], { cwd: ROOT, timeout: 30_000, maxBuffer: 16 << 20 });
    return parse(stdout);
  } catch (err) {
    return parse((err as { stdout?: string }).stdout);
  }
}

async function gitGrep(pattern: string): Promise<{ file: string; line: number; text: string }[]> {
  try {
    const { stdout } = await exec("git", ["grep", "-nIE", pattern], { cwd: ROOT, timeout: 10_000, maxBuffer: 4 << 20 });
    return stdout.split("\n").filter(Boolean).slice(0, 50).map((l) => {
      const [file, line, ...rest] = l.split(":");
      return { file, line: Number(line), text: rest.join(":").trim().slice(0, 160) };
    });
  } catch {
    return []; // git grep exits 1 on no match
  }
}

async function which(bin: string): Promise<boolean> {
  try { await exec("which", [bin], { timeout: 4000 }); return true; } catch { return false; }
}

// Full posture: dependency CVEs + SAST rules + secret sweep + gate coverage.
router.get("/posture", async (_req, res) => {
  if (cache && Date.now() - cache.at < CACHE_MS) return void res.json({ ...cache.data, cached: true });

  const started = Date.now();
  const [audit, tools, ...ruleHits] = await Promise.all([
    npmAudit(),
    Promise.all(SCANNERS.map(async (s) => ({ name: s, installed: await which(s) }))),
    ...RULES.map((r) => gitGrep(r.pattern)),
  ]);

  const findings: Record<string, unknown>[] = [];

  // Dependency CVEs — real advisories from the local lockfile.
  const vulns = audit?.vulnerabilities ?? {};
  for (const [name, v] of Object.entries<any>(vulns)) {
    const advisory = (Array.isArray(v.via) ? v.via : []).find((x: any) => typeof x === "object");
    findings.push({
      source: "npm-audit",
      id: advisory?.cwe?.[0] ?? "CVE",
      severity: v.severity,
      title: advisory?.title ?? `Vulnerable dependency: ${name}`,
      location: `${name}@${v.range ?? "*"}`,
      cvss: advisory?.cvss?.score ?? null,
      url: advisory?.url ?? null,
      dev_only: v.isDirect === false || !!v.effects?.length,
      // npm reports the fix against the top-level package, which is often not `name` itself.
      remediation: v.fixAvailable?.version
        ? `Upgrade ${v.fixAvailable.name ?? name} to ${v.fixAvailable.version}${v.fixAvailable.isSemVerMajor ? " (major)" : ""}`
        : v.fixAvailable ? "Patched release available" : "No patched release yet",
    });
  }

  // SAST rules evaluated against the tracked tree.
  RULES.forEach((rule, i) => {
    for (const hit of ruleHits[i] ?? []) {
      findings.push({
        source: "sast",
        id: rule.id,
        severity: rule.severity,
        title: rule.title,
        location: `${hit.file}:${hit.line}`,
        cvss: null,
        url: null,
        dev_only: false,
        remediation: rule.remediation,
      });
    }
  });

  const count = (s: string) => findings.filter((f) => f.severity === s).length;
  const counts = {
    critical: count("critical"), high: count("high"),
    medium: count("medium") + count("moderate"), low: count("low"), total: findings.length,
  };

  const data = {
    label: "LIVE",
    scanned_at: new Date().toISOString(),
    duration_ms: Date.now() - started,
    // The gate mirrors the plugin's rule: critical/high blocks, everything else warns.
    gate: counts.critical + counts.high > 0 ? "BLOCK" : "PASS",
    counts,
    findings: findings.sort((a, b) => {
      const rank = { critical: 0, high: 1, moderate: 2, medium: 2, low: 3 } as Record<string, number>;
      return (rank[a.severity as string] ?? 9) - (rank[b.severity as string] ?? 9);
    }),
    coverage: {
      scanners: tools,
      installed: tools.filter((t) => t.installed).length,
      total: tools.length,
      npm_audit: audit !== null,
    },
    // Presence only, never a value — same discipline as the Render demo.
    opsera: { key_configured: !!process.env.OPSERA_API_KEY, transmits_source: false },
    cached: false,
  };

  cache = { at: Date.now(), data };
  res.json(data);
});

export default router;
