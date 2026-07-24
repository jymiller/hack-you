---
type: card
module: scan-orchestration
file: src/server/scan.ts
complexity: high
lines: 145
last_analyzed: 2026-07-24
migration:
  global_refs: []
  session_keys_read: []
  session_keys_written: []
  db_tables_touched: ["fixtures/thornwick.json (via withMemory)"]
  side_effects: ["indirect network I/O via searchLiveWeb/researchAri", "mutates the Assessment to attach citations"]
  singleton_pattern: false
  extractable: true
  extraction_notes: "Pure over its inputs (injected now, no globals) but hardcoded to Thornwick/q1-2026. Generalize by parameterising borrower/period/trigger."
---

# `src/server/scan.ts` — the money-shot orchestration

Wires the pure kernel to the live vendor. Two exported functions: `runScan` (the scan) and
`applyAttestation` (the human gate applied over a scan).

## `runScan(now, mode) → ScanResult`

1. `withMemory("thornwick")` — the bundle + a `MemoryContext` over the whole corpus.
2. Build the two `Certificate` inputs (leverage + interest cover) from the `borrower_certified`
   observation via the local `certificate()` helper.
3. **`Promise.all([ searchLiveWeb(SEARCH_QUERY, {freshness:week, livecrawl:news, mode}),
   researchAri(ARI_QUESTION, {mode}) ])`** — fire both You.com endpoints concurrently at t≈0.
4. `assess(...)` for `total_net_leverage` (the money-shot → 7.59× BREACH) and `interest_cover`
   (→ 1.76× BREACH), passing `event_ids: [TRIGGER_EVENT_ID]`.
5. `attachLiveCitations(a, ari, TRIGGER_EVENT_ID)` — copies ARI `sources[]` onto both the finding's
   `evidence.citations` **and** the `proposed_write.evidence.citations`, and unions the trigger event
   id in. (This mutates the Assessment — the one place a Finding is enriched post-hoc.)
6. Build the **bridge** for the UI: `{ certified_ebitda 34.0, recomputed_ebitda 29.0 (=
   a.ratio.denominator_value), net_debt 220 (= a.ratio.numerator_value), certified_ratio 6.47,
   recomputed_ratio 7.59, threshold 6.50 }`.
7. `new Scoreboard(now).scan(a, { triggerLabel: search.label, triggerSource: "you_research_ari" })`.
8. Return the `ScanResult` (search, ari, headline, trigger, bridge, both assessments, proposal,
   scoreboard, labels).

## `applyAttestation(headline, proposal, decision, analyst, now, note, seqStart) → AttestResult`

`makeAttestation` → `attest` → `serveIfCommitted` (see [attest.ts](../attestation-gate/attest.md)),
then a fresh `Scoreboard(now, seqStart)` emits `attested` + `writeResult`. On ATTEST the serve is the
SYNTHETIC reservation-of-rights notice; on DENY, `serve_receipt` is `null`.

## Demo-specific coupling (the honest caveats)

- **Hardwired to `thornwick` / `q1-2026`** and `TRIGGER_EVENT_ID =
  "ev-thornwick-fy2025-restatement"`. This is the money-shot, not a generic book scan.
- The `trigger` object is emitted with an explicit **SYNTHETIC** label (a synthetic borrower has no
  real headline) — deliberately separate from the LIVE Search hits, which prove the *pattern* is
  current, not the borrower.
- Search uses `freshness:week` (not `day`) to widen the live news hit rate for the demo.

## Why it's still testable offline

Both functions take an injected `now` and read no globals. `face.test.ts` deletes `YDC_API_KEY`,
calls `runScan(NOW)`, and asserts the flip survives with Search→SYNTHETIC, ARI→PRERUN, cited sources
attached, and an ordered scoreboard.

## Depends on

`assess.ts`, `attest.ts`, `scoreboard.ts`, `corpus.ts` (`withMemory`), `youcom.ts`. Consumed by
[`app.ts`](../web-demo-platform/app.md) (`/api/scan`, `/api/attest`). Related:
[data-flows §1 & §2](../../atlas/data-flows.md).
