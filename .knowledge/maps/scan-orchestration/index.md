---
type: module
name: scan-orchestration
display_name: Scan Orchestration (the money-shot flow)
status: active
file_locations:
  entry_points: ["src/server/scan.ts"]
  controllers: ["src/server/scan.ts (runScan, applyAttestation)"]
  models: ["src/server/scan.ts (ScanResult, AttestResult)"]
  services: ["src/server/scan.ts"]
  views: ["web/app.html"]
  tests: ["src/eval/face.test.ts"]
  config: []
patterns:
  - type: orchestration service (fan-out, then assemble)
    count: 1
    example: src/server/scan.ts (runScan)
  - type: concurrent fetch (Promise.all)
    count: 1
    example: src/server/scan.ts
  - type: post-hoc enrichment (attach citations to a finding)
    count: 1
    example: src/server/scan.ts (attachLiveCitations)
dependencies:
  internal: ["covenant-kernel", "attestation-gate", "scoreboard-labels", "youcom-integration", "synthetic-corpus"]
  external: []
  database_tables: ["fixtures/thornwick.json (via withMemory)"]
migration:
  coupling_score: 0.40
  session_dependencies: 0
  global_dependencies: 0
  singleton_dependencies: []
  pattern_consistency: 0.9
  abstraction_boundary: partial
  testability: high
  estimated_effort: medium
  blockers: ["hardcoded to thornwick / q1-2026 (demo-specific)"]
---

# Scan Orchestration

The application service that assembles the money-shot. It is the seam where the pure kernel meets the
live vendor: it fires both You.com endpoints at t≈0, runs the kernel over the SYNTHETIC book,
attaches the LIVE/PRERUN citations to the finding, and emits the scoreboard. One file,
`src/server/scan.ts`, exporting two functions.

## `runScan(now, mode) → ScanResult`

1. `withMemory("thornwick")` → the Thornwick bundle + a `MemoryContext` over the corpus.
2. Build the two `Certificate` inputs (leverage + interest cover) from the `borrower_certified`
   observation.
3. **`Promise.all([ searchLiveWeb(...), researchAri(...) ])`** — fire both You.com endpoints
   concurrently (Search: `freshness:week, livecrawl:news`; ARI: the lender-response question).
4. `assess(...)` for `total_net_leverage` and `interest_cover` — the flip fires (7.59× BREACH).
5. `attachLiveCitations(a, ari, TRIGGER_EVENT_ID)` — copy ARI `sources[]` onto the finding's
   `evidence` **and** its `proposed_write.evidence`.
6. Build the **EBITDA bridge** (certified 34.0 → recomputed 29.0, net debt 220, 6.47→7.59, limit
   6.50) for the UI.
7. `Scoreboard.scan(a, { triggerLabel: search.label, source: "you_research_ari" })` → the ordered
   feed.
8. Return a `ScanResult` (search, ari, headline assessment, trigger, bridge, both assessments,
   proposal, scoreboard, labels).

The `ScanResult` is cached by `app.ts` in an in-memory `sessions` Map keyed by `scan_id` (the
headline `assessment_id`), so the later attest call can find the proposal.

## `applyAttestation(headline, proposal, decision, analyst, now, note, seqStart) → AttestResult`

The human gate applied over a scan: `makeAttestation` → `attest` → `serveIfCommitted` (see the
[attestation-gate](../attestation-gate/index.md)), then continue the scoreboard sequence with
`attested` + `writeResult`. On ATTEST it issues the reservation-of-rights notice to the covenant
register (SYNTHETIC); on DENY nothing serves.

## Demo-specific choices (the coupling)

- **Hardwired to Thornwick / `q1-2026`** — this is the money-shot borrower, not a generic scan of the
  book. `TRIGGER_EVENT_ID` is the synthetic restatement event id.
- The synthetic **trigger** headline is emitted with an explicit `SYNTHETIC` label (a synthetic
  borrower has no real headline) — separate from the LIVE Search hits that prove the *pattern* is
  current.
- The two functions are still pure over their inputs (no globals, injected `now`), which is why
  `face.test.ts` can run the whole thing offline by deleting the key.

## Related

Card: [`scan.ts`](../../cards/scan-orchestration/scan.md) · Full trace:
[data-flows §1 & §2](../../atlas/data-flows.md) · Consumers:
[web-demo-platform](../web-demo-platform/index.md) (`/api/scan`, `/api/attest`).
