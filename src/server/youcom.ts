// You.com — two base hosts, one key (X-API-Key). Search + Contents at ydc-index.io/v1/*;
// Research (ARI) + Finance at api.you.com/v1/*. Don't mix them.
//   • Search   — GET /v1/search, freshness=day, livecrawl=news → the fresh restatement headline. [REAL]
//   • Research — POST /v1/research, standard, background:true → task_id in <1s; poll until completed. [REAL]
// Every path degrades to a labeled fallback so the demo never hangs on venue wifi:
//   Search fallback → the SYNTHETIC fixture event (nothing was crawled — never mislabel a mock PRERUN).
//   ARI fallback    → prerun/ari-lender-response-standard.json, a GENUINE cached API response. [PRERUN]

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Provenance } from "../kernel/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");

const SEARCH_HOST = "https://ydc-index.io/v1";
const RESEARCH_HOST = "https://api.you.com/v1";

function apiKey(): string | undefined {
  return process.env.YDC_API_KEY?.trim() || undefined;
}

export interface SearchHit {
  url: string;
  title: string | null;
  publisher: string | null;
  snippet: string | null;
  published_at: string | null;
}
export interface SearchResult {
  label: Provenance;
  query: string;
  hits: SearchHit[];
  latency_ms: number;
  note?: string;
}

export interface AriSource {
  url: string;
  title: string | null;
  publisher: string | null;
  snippet: string | null;
}
export interface AriResult {
  label: Provenance;
  question: string;
  summary: string;
  lender_actions: string[];
  sources: AriSource[];
  research_effort: string;
  latency_ms: number;
  task_id?: string | null;
  note?: string;
}

async function fetchJson(url: string, init: RequestInit, timeoutMs: number): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// ---- You.com Search — live-web freshness proof --------------------------
export async function searchLiveWeb(
  query: string,
  opts: { freshness?: "day" | "week" | "month"; livecrawl?: "news" | "all"; timeoutMs?: number } = {}
): Promise<SearchResult> {
  const key = apiKey();
  const started = Date.now();
  if (!key) return synthSearchFallback(query, Date.now() - started, "no YDC_API_KEY — offline");

  const params = new URLSearchParams({
    query,
    freshness: opts.freshness ?? "day",
    livecrawl: opts.livecrawl ?? "news",
  });
  try {
    const data = await fetchJson(`${SEARCH_HOST}/search?${params}`, { headers: { "X-API-Key": key } }, opts.timeoutMs ?? 8000);
    const rawHits: any[] = data?.hits ?? data?.results ?? data?.web?.results ?? [];
    const hits: SearchHit[] = rawHits.slice(0, 6).map((h) => ({
      url: h.url ?? h.link ?? "",
      title: h.title ?? null,
      publisher: h.publisher ?? h.source ?? null,
      snippet: Array.isArray(h.snippets) ? h.snippets[0] ?? null : h.snippet ?? h.description ?? null,
      published_at: h.published_at ?? h.page_age ?? null,
    }));
    return { label: "REAL", query, hits, latency_ms: Date.now() - started };
  } catch (err) {
    return synthSearchFallback(query, Date.now() - started, `live search failed: ${(err as Error).message}`);
  }
}

// ---- You.com Research (ARI) — the flagship, cited deep research ---------
// background:true returns a task_id in <1s; poll GET /v1/research/{task_id} until completed.
export async function researchAri(
  question: string,
  opts: { effort?: "standard" | "deep"; timeoutMs?: number; pollMs?: number } = {}
): Promise<AriResult> {
  const key = apiKey();
  const started = Date.now();
  if (!key) return prerunAriFallback(question, Date.now() - started, "no YDC_API_KEY — offline");

  const effort = opts.effort ?? "standard"; // never `exhaustive` live on stage
  const budget = opts.timeoutMs ?? 30000;
  try {
    const start = await fetchJson(
      `${RESEARCH_HOST}/research`,
      { method: "POST", headers: { "X-API-Key": key, "Content-Type": "application/json" }, body: JSON.stringify({ query: question, research_effort: effort, background: true }) },
      8000
    );
    const taskId: string | undefined = start?.task_id ?? start?.id;
    if (!taskId) return normalizeAri(start, question, "REAL", Date.now() - started, null);

    // Poll the GET until terminal (the SSE /stream is heartbeat only).
    const deadline = started + budget;
    const pollMs = opts.pollMs ?? 1200;
    while (Date.now() < deadline) {
      const data = await fetchJson(`${RESEARCH_HOST}/research/${taskId}`, { headers: { "X-API-Key": key } }, 8000);
      const status = data?.status ?? data?.state;
      if (status === "completed" || data?.response || data?.output) {
        return normalizeAri(data, question, "REAL", Date.now() - started, taskId);
      }
      if (status === "failed" || status === "error") throw new Error(`research task ${taskId} ${status}`);
      await sleep(pollMs);
    }
    throw new Error(`research task ${taskId} did not complete within ${budget}ms`);
  } catch (err) {
    return prerunAriFallback(question, Date.now() - started, `live ARI failed: ${(err as Error).message}`);
  }
}

function normalizeAri(data: any, question: string, label: Provenance, latency: number, taskId: string | null): AriResult {
  const output = data?.response?.output ?? data?.output ?? data;
  const content = output?.content ?? {};
  const rawSources: any[] = output?.sources ?? [];
  return {
    label,
    question,
    summary: content?.summary ?? output?.summary ?? "",
    lender_actions: content?.lender_actions ?? [],
    sources: rawSources.map((s) => ({
      url: s.url,
      title: s.title ?? null,
      publisher: s.publisher ?? null,
      snippet: Array.isArray(s.snippets) ? s.snippets[0] ?? null : s.snippet ?? null,
    })),
    research_effort: data?.research_effort ?? "standard",
    latency_ms: latency,
    task_id: taskId,
  };
}

// ---- Fallbacks ----------------------------------------------------------
let _prerunCache: any | null = null;
function prerunAri(): any {
  if (!_prerunCache) _prerunCache = JSON.parse(readFileSync(join(ROOT, "prerun", "ari-lender-response-standard.json"), "utf8"));
  return _prerunCache;
}

export function prerunAriFallback(question: string, latency: number, note: string): AriResult {
  const cache = prerunAri();
  const out = normalizeAri(cache.response, question, "PRERUN", latency, null);
  out.research_effort = cache.research_effort ?? "standard";
  out.note = note;
  return out;
}

// Search has no genuine prerun capture — fall back to the SYNTHETIC fixture placeholder.
function synthSearchFallback(query: string, latency: number, note: string): SearchResult {
  return {
    label: "SYNTHETIC",
    query,
    hits: [
      {
        url: "https://synthetic.enid.local/thornwick/fy2025-restatement-note",
        title: "Thornwick Logistics Holdings restates FY2025 accounts following auditor change",
        publisher: "SYNTHETIC corpus fixture (no live crawl)",
        snippet: "FY2025 restated by incoming auditor Marbury Tolland LLP: GBP 1.7m early-recognised revenue reversed, GBP 3.0m unrealised run-rate synergies disallowed.",
        published_at: "2026-07-03",
      },
    ],
    latency_ms: latency,
    note,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// The research question ARI answers depends only on the EVENT (a sponsor-backed borrower restating
// and disallowing add-backs after an auditor change), not on the recompute number — so firing it at
// scan time, before the recompute, is legitimate.
export const ARI_QUESTION =
  "How do private-credit lenders typically respond when a sponsor-backed borrower restates accounts and disallows EBITDA add-backs after an auditor change?";

export const SEARCH_QUERY = "Thornwick Logistics Ardenmoor FY2025 restatement auditor change disallowed EBITDA add-backs";
