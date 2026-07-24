---
type: card
module: web-demo-platform
file: web/app.html
complexity: medium
lines: 304
last_analyzed: 2026-07-24
migration:
  global_refs: []
  session_keys_read: []
  session_keys_written: []
  db_tables_touched: []
  side_effects: ["fetch to /api/scan, /api/attest, /api/corpus", "DOM mutation"]
  singleton_pattern: false
  extractable: true
  extraction_notes: "Self-contained page (inline CSS + vanilla JS). No build. Portable; the dark palette is copy-pasted across pages."
---

# `web/app.html` — the Sentinel desk

The flagship demo UI. A single self-contained page (inline CSS + vanilla JS, no framework, no build)
that drives the money-shot: scan → flip → cited brief → attest → notice.

## Layout

- **Header** — brand, a live URL chip, nav to Home + You.com Explorer, a **LIVE/PRERUN mode toggle**
  (drives `/api/scan`'s `mode`), and the honesty-label legend chips.
- **Left column** — the Thornwick tile (starts GREEN 6.47× IN COMPLIANCE, flips to RED 7.59× BREACH),
  the EBITDA bridge, a cross-deal memory chip, the **attest gate** (Attest / Deny), and a collapsible
  6-borrower corpus table.
- **Right column** — the animated event scoreboard, the You.com Search headline card, and the ARI
  cited brief (summary + `lender_actions[]` + source links).

## Key JS flows

- **`scan()`** — `POST /api/scan {mode}` → animate the scoreboard (`renderScoreboard`, 700ms ticks) →
  render the trigger + live Search headline → flip the tile and render the bridge → render the ARI
  brief + sources → reveal the attest gate.
- **`decide(decision)`** — `POST /api/attest {scan_id, decision}` → animate the continuation events →
  on committed, show a receipt with the SYNTHETIC chip; on denied, "no notice issued".
- **`loadCorpus()`** — `GET /api/corpus` → the collapsible table with conflict/drift/memory tags.

## Honesty chips are data-driven

`chipHtml(label)` renders `SYNTHETIC`/`LIVE`/`PRERUN` from the API response's label field — the search
label, the ARI label, and each scoreboard event's `provenance_label` — never hardcoded per beat. This
is the UI honoring [ADR-0006](../../decisions/0006-honesty-label-discipline.md): the label is read off
the record.

## Notes

- The palette (`--bg:#0b0f17`, `--cyan:#46c6ff`, `--green:#35d07f`, `--red:#ff5470`) is copy-pasted
  across `web/*.html` and `demos/*/page.html` — the one duplication cost of the no-bundler approach.
  (Note: the KB portal uses the *skill's* dark palette, which differs from the app's palette.)
- The flip animation and the scoreboard ticks are pure CSS/JS timing — nothing to fail — which is the
  DEMO-SCRIPT fallback for "the recompute is a pure local function; here are the numbers."

## Consumes

`/api/scan`, `/api/attest`, `/api/corpus` (all in [`app.ts`](app.md), backed by
[`scan.ts`](../scan-orchestration/scan.md)). Sitemap:
[designer/sitemap.html](../../diagrams/designer/sitemap.html).
