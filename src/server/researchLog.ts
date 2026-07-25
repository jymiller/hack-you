// A durable log of research runs.
//
// A "run" is one dispatch action — either a single agent or a fan-out across every sponsor — so the
// UI can partition results by the question that produced them instead of showing one flat list.
//
// Live runs are assembled from the in-memory dispatcher. Once every agent in a run reaches a
// terminal state it is appended to a JSONL archive on disk, so the log survives a server restart.
// (On an ephemeral filesystem the archive resets when the instance is rebuilt — the honest limit of
// not running a datastore. A Postgres-backed store would drop in behind the same two functions.)

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { jobs, type Job } from "./jobs.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DIR = join(ROOT, ".data");
const FILE = join(DIR, "research-log.jsonl");

export interface RunAgent {
  label: string;
  sponsor: string | null;
  borrowers: string[];
  question: string | null;
  status: string;
  headline: string | null;
  finding: string | null;
  duration_ms: number | null;
  summary: string | null;
  highlights: string[];
  sources: Array<{ url: string; title: string | null; publisher: string | null }>;
  label_provenance: string | null;
  error: string | null;
}

export interface Run {
  run_id: string;
  started_at: string;
  kind: "fan_out" | "single" | "search";
  question: string; // what the operator actually asked ("" = the default sweep)
  agent_count: number;
  archived?: boolean;
  agents: RunAgent[];
}

// run_id → the jobs dispatched under it, in order.
const runIndex = new Map<string, { started_at: string; kind: Run["kind"]; question: string; jobIds: string[] }>();
const archivedIds = new Set<string>();

export function newRun(kind: Run["kind"], question: string): string {
  const run_id = `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  runIndex.set(run_id, { started_at: new Date().toISOString(), kind, question, jobIds: [] });
  return run_id;
}

export function attach(run_id: string, jobId: string): void {
  runIndex.get(run_id)?.jobIds.push(jobId);
}

function toAgent(j: Job): RunAgent {
  const r = (j.result ?? {}) as any;
  const meta = (j.meta ?? {}) as any;
  return {
    label: j.label,
    sponsor: meta.sponsor ?? null,
    borrowers: meta.borrowers ?? [],
    question: meta.question ?? null,
    status: j.status,
    duration_ms: j.duration_ms,
    headline: r.headline ?? null,
    finding: r.finding ?? null,
    summary: r.summary ?? null,
    highlights: Array.isArray(r.highlights) ? r.highlights : [],
    sources: Array.isArray(r.sources)
      ? r.sources.map((s: any) => ({ url: s.url, title: s.title ?? null, publisher: s.publisher ?? null }))
      : [],
    label_provenance: r.label ?? null,
    error: j.error,
  };
}

function readArchive(): Run[] {
  if (!existsSync(FILE)) return [];
  const out: Run[] = [];
  for (const line of readFileSync(FILE, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push({ ...(JSON.parse(line) as Run), archived: true });
    } catch {
      /* skip a corrupt line rather than losing the whole log */
    }
  }
  return out;
}

function archive(run: Run): void {
  try {
    if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
    appendFileSync(FILE, JSON.stringify(run) + "\n", "utf8");
  } catch {
    /* archiving is best-effort — never break a response over it */
  }
}

// Live runs first (newest first), then anything already on disk. Terminal runs are archived here,
// so no callback plumbing is needed in the dispatcher.
export function listRuns(limit = 25): Run[] {
  const live: Run[] = [];
  for (const [run_id, r] of runIndex) {
    const js = r.jobIds.map((id) => jobs.get(id)).filter((j): j is Job => !!j);
    if (js.length === 0) continue;
    const run: Run = {
      run_id, started_at: r.started_at, kind: r.kind, question: r.question,
      agent_count: js.length, agents: js.map(toAgent),
    };
    live.push(run);
    const done = js.every((j) => j.status === "completed" || j.status === "failed");
    if (done && !archivedIds.has(run_id)) {
      archivedIds.add(run_id);
      archive(run);
    }
  }
  live.sort((a, b) => b.started_at.localeCompare(a.started_at));
  const liveIds = new Set(live.map((r) => r.run_id));
  const past = readArchive().filter((r) => !liveIds.has(r.run_id)).reverse();
  return [...live, ...past].slice(0, limit);
}
