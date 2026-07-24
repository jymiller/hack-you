---
type: card
module: youcom-integration
file: src/server/youcom.ts
complexity: high
lines: 339
last_analyzed: 2026-07-24
migration:
  global_refs: ["process.env.YDC_API_KEY"]
  session_keys_read: []
  session_keys_written: []
  db_tables_touched: ["prerun/ari-lender-response-standard.json (read)"]
  side_effects: ["network I/O to ydc-index.io + api.you.com", "readFileSync of the PRERUN cache", "module-level _prerunCache"]
  singleton_pattern: true
  extractable: true
  extraction_notes: "Extractable once the env read (apiKey()) is parameterised/injected. Network + fs are the only impurities; the fallback keeps every function total."
---

# `src/server/youcom.ts` — the You.com client

The vendor integration. Two You.com hosts behind one key, four callable functions, and a
labeled-fallback discipline so no call ever hangs the demo.

## Hosts & auth

- `SEARCH_HOST = https://ydc-index.io/v1` (Search + Contents)
- `RESEARCH_HOST = https://api.you.com/v1` (Research/ARI + Billing)
- `apiKey()` = `process.env.YDC_API_KEY?.trim() || undefined` — the one global read.
- `fetchJson(url, init, timeoutMs)` wraps `fetch` in an `AbortController` timeout and throws on
  `!res.ok`.

## The four functions

| Function | Endpoint | Live | Fallback |
|---|---|---|---|
| `searchLiveWeb(query, opts)` | `GET /v1/search?freshness&livecrawl` | LIVE hits | `synthSearchFallback` (SYNTHETIC Thornwick headline) or `{hits:[]}` when `emptyFallback` |
| `researchAri(question, opts)` | `POST /v1/research` `{background:true}` then poll `GET /v1/research/{task_id}` | LIVE brief | `prerunAriFallback` → **PRERUN** genuine cache |
| `youResearch(input, opts)` | same, with a structured financial-brief schema | LIVE | inline SYNTHETIC "offline" |
| `youBalance()` | `GET /v1/billing/account_balance` | LIVE balance | SYNTHETIC n/a |

## The background/poll pattern (ARI)

`researchAri` posts with `background:true`, reads `task_id` (or `id`), then polls
`GET /v1/research/{task_id}` every `pollMs` (default 1500) until `status == "completed"` (or a
`result`/`response`/`output` appears), inside a `budget` (default 30000ms). `effort` defaults to
`standard` — **never `exhaustive` live on stage**. On `failed`/`error` or timeout it throws → the
catch returns the PRERUN fallback.

## `normalizeAri` handles both shapes

The live response nests content at `data.result.output`; the PRERUN cache nests it at
`data.response.output`. `output.content` may be a structured object (`{summary, lender_actions}`) or a
plain string. `sources[]` are mapped to `{url, title, publisher, snippet}` with `domainOf(url)` as the
publisher fallback. Same normalizer is reused for the offline path so LIVE and PRERUN render
identically.

## Gotchas

- **`output_schema` requires `additionalProperties:false` on every object** or the API returns HTTP
  422 (documented inline and in the PRERUN cache's `output_schema_gotcha`). Both `ARI_OUTPUT_SCHEMA`
  and `FINANCE_SCHEMA` set it.
- **The query field is `input`, not `query`.**
- **The SSE `/stream` is heartbeat-only** — the real answer comes from the terminal `GET`.
- **`_prerunCache`** is a module-level lazy singleton holding the parsed cache JSON (read once).
- **Two constants** encode the demo's honesty: `SEARCH_QUERY` proves the *pattern* is live (Thornwick
  is synthetic, so nothing crawls it); `ARI_QUESTION` depends only on the event, legitimizing firing
  it at t≈0 before the recompute.

## Depends on

`node:fs`, global `fetch`, `types.ts` (`Provenance`), the PRERUN cache. Consumed by
[`scan.ts`](../scan-orchestration/scan.md), [`demos/youcom/routes.ts`](../../maps/youcom-integration/index.md),
and the smoke script. Related: [ADR-0008](../../decisions/0008-youcom-two-endpoints-fallback.md).
