---
type: module
name: youcom-integration
display_name: You.com Live Research (the vendor FACE)
status: active
file_locations:
  entry_points: ["src/server/youcom.ts"]
  controllers: ["demos/youcom/routes.ts"]
  models: ["src/server/youcom.ts (SearchResult, AriResult, ResearchResult)"]
  services: ["src/server/youcom.ts"]
  views: ["demos/youcom/page.html"]
  tests: ["src/eval/face.test.ts", "scripts/youcom-smoke.ts"]
  config: ["demos/youcom/meta.json", ".env.example (YDC_API_KEY)"]
patterns:
  - type: API client with labeled fallback
    count: 4
    example: src/server/youcom.ts
  - type: background task + poll-to-completion
    count: 2
    example: src/server/youcom.ts (researchAri)
  - type: AbortController timeout wrapper
    count: 1
    example: src/server/youcom.ts (fetchJson)
dependencies:
  internal: ["covenant-kernel (Provenance)", "synthetic-corpus (prerun cache)"]
  external: ["node:fs", "fetch (global)", "express (demo router)"]
  database_tables: ["prerun/ari-lender-response-standard.json"]
migration:
  coupling_score: 0.35
  session_dependencies: 0
  global_dependencies: 1
  singleton_dependencies: ["_prerunCache (module-level lazy cache)"]
  pattern_consistency: 0.9
  abstraction_boundary: partial
  testability: high
  estimated_effort: medium
  blockers: ["process.env.YDC_API_KEY read directly", "network I/O to two You.com hosts"]
---

# You.com Live Research

The **FACE** of the demo — the load-bearing vendor. Two You.com endpoints, one per job, plus a
balance check. Every path degrades to a **labeled fallback** so a scan never hangs on venue wifi.

## Two hosts, one key

One `YDC_API_KEY` (sent as `X-API-Key`), two base hosts that must not be mixed:

- **Search + Contents** → `https://ydc-index.io/v1/*`
- **Research (ARI) + Finance/Billing** → `https://api.you.com/v1/*`

## Public API (`youcom.ts`)

| Function | Endpoint | Live label | Fallback |
|---|---|---|---|
| `searchLiveWeb(query, opts)` | `GET /v1/search` (`freshness`, `livecrawl`) | **LIVE** | `synthSearchFallback` → **SYNTHETIC** fixture headline (or empty for the explorer) |
| `researchAri(question, opts)` | `POST /v1/research` (`background:true` → `task_id`, polled) | **LIVE** | `prerunAriFallback` → **PRERUN** genuine cache |
| `youResearch(input, opts)` | `POST /v1/research` (structured financial-brief schema) | **LIVE** | inline SYNTHETIC "offline" message |
| `youBalance()` | `GET /v1/billing/account_balance` | **LIVE** | SYNTHETIC (balance n/a) |

Constants: `ARI_QUESTION` (the lender-response research prompt — depends only on the *event*, not the
recompute, so firing it at t≈0 before the recompute is legitimate) and `SEARCH_QUERY` (the real
underlying theme; Thornwick is synthetic so the live crawl proves freshness on the pattern, not the
borrower).

## The background/poll pattern (ARI)

ARI at `research_effort=standard` measured ~13s. To keep the click from blocking:

1. `POST /v1/research` with `background: true` → `task_id` in < 1s.
2. Poll `GET /v1/research/{task_id}` every `pollMs` until `status == "completed"` (or a `result`/
   `response`/`output` appears), within a budget (default 30s).
3. `normalizeAri` handles both the live shape (`data.result.output`) and the PRERUN cache shape
   (`data.response.output`); content may be a structured object (`{summary, lender_actions}`) or a
   plain string. `output_schema` requires `additionalProperties:false` on every object or the API
   returns HTTP 422 (documented gotcha).

Never `exhaustive` live on stage — `standard` + `background:true` only. See
[ADR-0008](../../decisions/0008-youcom-two-endpoints-fallback.md) and the
[DEMO-SCRIPT timing solution](../../atlas/conventions.md).

## The You.com Explorer mini-demo (`demos/youcom/`)

A self-contained mini-demo (auto-mounted by [web-demo-platform](../web-demo-platform/index.md)):

- `routes.ts` → `POST /api/youcom/search`, `POST /api/youcom/research`, `GET /api/youcom/balance`.
- `page.html` → a two-panel explorer (live search + financial research) with a live balance chip
  that "ticks down with each call".
- `meta.json` → `{ name: "You.com", accent: "cyan", status: "live", order: 10 }`.

## Coupling notes (0.35 — partial)

- Reads `process.env.YDC_API_KEY` directly (the one global dependency).
- Network I/O to two external hosts; wrapped in an `AbortController` timeout (`fetchJson`).
- A module-level lazy cache `_prerunCache` holds the parsed PRERUN JSON (a benign singleton).
- Otherwise pure and interface-clean: functions take inputs, return typed results, and the fallback
  keeps them total. Extractable with the env read parameterised.

## Related

Cards: [`youcom.ts`](../../cards/youcom-integration/youcom.md) · Decisions:
[ADR-0008](../../decisions/0008-youcom-two-endpoints-fallback.md),
[ADR-0006](../../decisions/0006-honesty-label-discipline.md) · Data:
[PRERUN cache](../synthetic-corpus/index.md).
