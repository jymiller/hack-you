// You.com — two base hosts, one key (X-API-Key). Search + Contents at ydc-index.io/v1/*;
// Research (ARI) + Finance at api.you.com/v1/*. Don't mix them.
//   • Search   — GET /v1/search, freshness=day, livecrawl=news → the fresh restatement headline. [LIVE]
//   • Research — POST /v1/research, standard, background:true → task_id in <1s; poll until completed. [LIVE]
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
  opts: { freshness?: "day" | "week" | "month"; livecrawl?: "news" | "all"; timeoutMs?: number; mode?: "live" | "prerun"; emptyFallback?: boolean } = {}
): Promise<SearchResult> {
  const key = apiKey();
  const started = Date.now();
  // Sentinel scan uses the Thornwick fixture as its fallback; the general explorer uses an empty result.
  const fb = (ms: number, note: string): SearchResult =>
    opts.emptyFallback ? { label: "SYNTHETIC", query, hits: [], latency_ms: ms, note } : synthSearchFallback(query, ms, note);
  if (opts.mode === "prerun") return fb(0, "PRERUN mode — live crawl off");
  if (!key) return fb(Date.now() - started, "no YDC_API_KEY — offline");

  const params = new URLSearchParams({
    query,
    freshness: opts.freshness ?? "day",
    livecrawl: opts.livecrawl ?? "news",
  });
  try {
    // Live shape: { results: { web: [{ url, title, description, page_age, snippets[] }] }, metadata }.
    // livecrawl=news can take ~6s, so allow generous headroom before falling back.
    const data = await fetchJson(`${SEARCH_HOST}/search?${params}`, { headers: { "X-API-Key": key } }, opts.timeoutMs ?? 14000);
    const rawHits: any[] = data?.results?.web ?? data?.hits ?? data?.results ?? [];
    const hits: SearchHit[] = rawHits.slice(0, 6).map((h) => ({
      url: h.url ?? h.link ?? "",
      title: h.title ?? null,
      publisher: h.publisher ?? h.source ?? domainOf(h.url ?? h.link),
      snippet: Array.isArray(h.snippets) ? h.snippets[0] ?? null : h.snippet ?? h.description ?? null,
      published_at: h.published_at ?? h.page_age ?? null,
    }));
    return { label: "LIVE", query, hits, latency_ms: Date.now() - started };
  } catch (err) {
    return fb(Date.now() - started, `live search failed: ${(err as Error).message}`);
  }
}

function domainOf(url?: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

// ---- You.com Research (ARI) — the flagship, cited deep research ---------
// background:true returns a task_id in <1s; poll GET /v1/research/{task_id} until completed.
export async function researchAri(
  question: string,
  opts: { effort?: "standard" | "deep"; timeoutMs?: number; pollMs?: number; mode?: "live" | "prerun" } = {}
): Promise<AriResult> {
  const key = apiKey();
  const started = Date.now();
  if (opts.mode === "prerun") return prerunAriFallback(question, 0, "PRERUN mode — live research off");
  if (!key) return prerunAriFallback(question, Date.now() - started, "no YDC_API_KEY — offline");

  const effort = opts.effort ?? "standard"; // never `exhaustive` live on stage
  const budget = opts.timeoutMs ?? 30000;
  try {
    // The query field is `input` (not `query`). An output_schema returns structured content
    // {summary, lender_actions[]} matching the PRERUN cache (every object needs additionalProperties:false).
    const start = await fetchJson(
      `${RESEARCH_HOST}/research`,
      {
        method: "POST",
        headers: { "X-API-Key": key, "Content-Type": "application/json" },
        body: JSON.stringify({ input: question, research_effort: effort, background: true, output_schema: ARI_OUTPUT_SCHEMA }),
      },
      8000
    );
    const taskId: string | undefined = start?.task_id ?? start?.id;
    if (!taskId) return normalizeAri(start, question, "LIVE", Date.now() - started, null);

    // Poll the GET until terminal (the SSE /stream is heartbeat only).
    const deadline = started + budget;
    const pollMs = opts.pollMs ?? 1500;
    while (Date.now() < deadline) {
      const data = await fetchJson(`${RESEARCH_HOST}/research/${taskId}`, { headers: { "X-API-Key": key } }, 8000);
      const status = data?.status ?? data?.state;
      // Only a terminal status ends the poll: `result` appears (empty) while still running,
      // so breaking on its presence returns an empty brief.
      if (status === "completed") {
        return normalizeAri(data, question, "LIVE", Date.now() - started, taskId);
      }
      if (status === "failed" || status === "error") throw new Error(`research task ${taskId} ${status}`);
      await sleep(pollMs);
    }
    throw new Error(`research task ${taskId} did not complete within ${budget}ms`);
  } catch (err) {
    return prerunAriFallback(question, Date.now() - started, `live ARI failed: ${(err as Error).message}`);
  }
}

// Structured research output (standard/deep support output_schema; lite does not).
const ARI_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "lender_actions"],
  properties: {
    summary: { type: "string", description: "2-4 sentence synthesis of how lenders respond." },
    lender_actions: { type: "array", items: { type: "string" }, description: "Discrete actions a lender typically takes." },
  },
};

// Handles the live shape (data.result.output) and the PRERUN cache shape (data.response.output).
// content may be a structured object {summary, lender_actions} (with output_schema) or a plain string.
function normalizeAri(data: any, question: string, label: Provenance, latency: number, taskId: string | null): AriResult {
  const output = data?.result?.output ?? data?.response?.output ?? data?.output ?? {};
  const content = output?.content;
  let summary = "";
  let lender_actions: string[] = [];
  if (content && typeof content === "object") {
    summary = content.summary ?? "";
    lender_actions = Array.isArray(content.lender_actions) ? content.lender_actions : [];
  } else if (typeof content === "string") {
    summary = content;
  }
  const rawSources: any[] = output?.sources ?? [];
  return {
    label,
    question,
    summary,
    lender_actions,
    sources: rawSources.map((s) => ({
      url: s.url,
      title: s.title ?? null,
      publisher: s.publisher ?? domainOf(s.url),
      snippet: Array.isArray(s.snippets) ? s.snippets[0] ?? null : s.snippet ?? null,
    })),
    research_effort: data?.input?.research_effort ?? data?.research_effort ?? "standard",
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

// Thornwick is a SYNTHETIC borrower, so we don't pretend a live crawl finds it. The live Search
// proves freshness on the real underlying theme the recompute is an instance of; hits are labelled LIVE.
export const SEARCH_QUERY = "private credit borrower restated accounts disallowed EBITDA add-backs covenant breach";

// ---- General You.com capabilities for the explorer page -----------------
// The You.com MCP tool list confirms the account exposes: you-search, you-contents, you-research,
// you-balance, you-discover — and NO dedicated Finance tool. So "financial data" is delivered via
// you-research (ARI): a cited financial brief on any company. REST equivalents used here.

export interface ResearchResult {
  label: Provenance;
  input: string;
  headline: string | null;
  finding: "none" | "background" | "notable" | "material" | null;
  summary: string;
  highlights: string[];
  sources: AriSource[];
  research_effort: string;
  latency_ms: number;
  task_id?: string | null;
  note?: string;
}

// Structured financial-brief schema (standard/deep support output_schema; lite does not).
const FINANCE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "finding", "summary", "highlights"],
  properties: {
    headline: { type: "string", description: "One short line (max ~10 words) stating the verdict, e.g. 'No material findings' or 'Restatement and auditor change reported'." },
    finding: {
      type: "string",
      enum: ["none", "background", "notable", "material"],
      description: "How significant the findings are. 'none' = nothing relevant found; 'background' = only general context, nothing specific; 'notable' = relevant signals worth monitoring; 'material' = a specific, significant finding a lender must act on.",
    },
    summary: { type: "string", description: "3-5 sentence synthesis of what was found." },
    highlights: { type: "array", items: { type: "string" }, description: "Key concrete facts, figures or events found." },
  },
};

// you-research (ARI) with structured output — powers the explorer's financial-brief panel.
export async function youResearch(
  input: string,
  opts: { effort?: "lite" | "standard" | "deep"; schema?: object; timeoutMs?: number } = {}
): Promise<ResearchResult> {
  const key = apiKey();
  const started = Date.now();
  if (!key) {
    return { label: "SYNTHETIC", input, headline: null, finding: null, summary: "No YDC_API_KEY set — live You.com research is off.", highlights: [], sources: [], research_effort: "n/a", latency_ms: 0, note: "offline" };
  }
  const effort = opts.effort ?? "standard";
  const schema = opts.schema ?? FINANCE_SCHEMA;
  const budget = opts.timeoutMs ?? 40000;
  try {
    // NOTE: `enabled_toolsets` (the only documented value being "events") is rejected for external
    // keys — "restricted to internal service callers" (HTTP 403). Verified against this account, so
    // we deliberately don't send it. Steering toward datable events is done in the prompt instead.
    const body: Record<string, unknown> = { input, research_effort: effort, background: true, output_schema: schema };
    const start = await fetchJson(
      `${RESEARCH_HOST}/research`,
      { method: "POST", headers: { "X-API-Key": key, "Content-Type": "application/json" }, body: JSON.stringify(body) },
      8000
    );
    const taskId: string | undefined = start?.task_id ?? start?.id;
    const deadline = started + budget;
    let data: any = start;
    while (taskId && Date.now() < deadline) {
      await sleep(1500);
      data = await fetchJson(`${RESEARCH_HOST}/research/${taskId}`, { headers: { "X-API-Key": key } }, 8000);
      const st = data?.status ?? data?.state;
      if (st === "completed") break;  // see note above — never break on `result` alone
      if (st === "failed" || st === "error") throw new Error(`research task ${st}`);
    }
    const output = data?.result?.output ?? data?.response?.output ?? data?.output ?? {};
    const content = output?.content;
    let summary = "";
    let highlights: string[] = [];
    let headline: string | null = null;
    let finding: ResearchResult["finding"] = null;
    if (content && typeof content === "object") {
      summary = content.summary ?? "";
      highlights = Array.isArray(content.highlights) ? content.highlights : Array.isArray(content.lender_actions) ? content.lender_actions : [];
      headline = content.headline ?? null;
      finding = content.finding ?? null;
    } else if (typeof content === "string") {
      summary = content;
    }
    const sources: AriSource[] = (output?.sources ?? []).map((s: any) => ({
      url: s.url, title: s.title ?? null, publisher: s.publisher ?? domainOf(s.url), snippet: Array.isArray(s.snippets) ? s.snippets[0] ?? null : s.snippet ?? null,
    }));
    return { label: "LIVE", input, headline, finding, summary, highlights, sources, research_effort: effort, latency_ms: Date.now() - started, task_id: taskId ?? null };
  } catch (err) {
    return { label: "SYNTHETIC", input, headline: null, finding: null, summary: `Live research failed: ${(err as Error).message}`, highlights: [], sources: [], research_effort: effort, latency_ms: Date.now() - started, note: "error" };
  }
}

// you-balance — remaining You.com credit; a live "this is really hitting the API" proof.
export async function youBalance(): Promise<{ label: Provenance; balance: number | null; note?: string }> {
  const key = apiKey();
  if (!key) return { label: "SYNTHETIC", balance: null, note: "offline" };
  try {
    // Live shape: { data: { type:"account", id, attributes: { balance } } }
    const data = await fetchJson("https://api.you.com/v1/billing/account_balance", { headers: { "X-API-Key": key } }, 6000);
    const bal = data?.data?.attributes?.balance ?? data?.balance ?? null;
    if (bal != null) return { label: "LIVE", balance: Number(bal) };
  } catch {
    /* fall through */
  }
  return { label: "SYNTHETIC", balance: null, note: "balance unavailable" };
}
