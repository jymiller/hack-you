---
type: atlas
title: Data Flows — critical runtime paths
last_analyzed: 2026-07-24
data_flows:
  - name: The money-shot scan
    path: ["POST /api/scan", "runScan()", "withMemory()", "You.com Search + ARI (Promise.all)", "assess() ×2", "attachLiveCitations()", "Scoreboard.scan()", "ScanResult"]
    description: "Scan the live web, recompute Thornwick on the restated book, flip GREEN→BREACH, attach cited sources, emit the scoreboard."
  - name: The attest gate
    path: ["POST /api/attest", "applyAttestation()", "makeAttestation()", "attest()", "serveIfCommitted()", "executeCommitted()", "Scoreboard.attested()+writeResult()"]
    description: "Human ATTEST/DENY over the proposal; on ATTEST issue the reservation-of-rights notice to the covenant register (SYNTHETIC)."
  - name: assess() internal pipeline
    path: ["locate period", "validate covenant", "resolveAuthoritative()", "selectThreshold()", "recomputeRatio()", "detectDrift()", "classify()", "consultMemory()", "certification_conflict", "buildProposedWrite()"]
    description: "The 10-step pure pipeline inside the kernel that turns a FactsBundle into an Assessment."
  - name: Corpus sweep
    path: ["GET /api/corpus or /api/data/borrower/:id", "loadCorpus()", "buildMemoryContext()", "assess() per period×covenant"]
    description: "Assess all six borrowers (or one) across every period and covenant for the desk/data explorers."
  - name: You.com call with fallback
    path: ["searchLiveWeb()/researchAri()", "apiKey()?", "fetch host", "poll (ARI)", "normalize", "or labeled fallback"]
    description: "Every You.com path degrades to a labeled fallback so the demo never hangs."
---

# Data Flows

Five critical runtime paths, traced file-by-file. The first is **the money-shot** — the sequence the
prompt asks to be documented end-to-end.

---

## 1 · The money-shot scan (scan → recompute → flip → notice)

Triggered by the **Scan live web** button on the Sentinel desk (`web/app.html`).

```
web/app.html  scan()
  │  POST /api/scan { mode: "live" | "prerun" }
  ▼
src/server/app.ts  app.post("/api/scan")
  │  runScan(nowIso(), mode)   ── caches result in sessions Map by scan_id
  ▼
src/server/scan.ts  runScan(now, mode)
  │
  ├─ withMemory("thornwick")                         [corpus.ts]
  │     loadCorpus() → 6 fixtures; buildMemoryContext indexes bundles by sponsor_id
  │
  ├─ Promise.all([                                   ── fire BOTH You.com endpoints at t≈0
  │     searchLiveWeb(SEARCH_QUERY, {freshness:week, livecrawl:news, mode})   [youcom.ts]
  │        └─ key? GET ydc-index.io/v1/search  →  LIVE hits
  │           no key / prerun / error → synthSearchFallback()  →  SYNTHETIC
  │     researchAri(ARI_QUESTION, {mode})                                     [youcom.ts]
  │        └─ key? POST api.you.com/v1/research (background:true) → task_id
  │              poll GET /v1/research/{task_id} until completed  →  LIVE brief
  │           no key / prerun / error → prerunAriFallback()  →  PRERUN (genuine cache)
  │  ])
  │
  ├─ assess(bundle, leverage,  certLev, memory, {now, event_ids:[TRIGGER]})   [kernel/assess.ts]
  │     └─ authoritative basis = audited_restated (outranks borrower_certified)
  │        recompute adjusted_ebitda 34.0 → 29.0; 220 / 29.0 = 7.59×  →  BREACH
  │        certification_conflict = true (certificate said 6.47× IN_COMPLIANCE)
  │        memory.hit = true (Ardenmoor run_rate_synergy → Halveston)
  │        proposed_write = breach_notice (PENDING, dry_run, requires_attestation)
  ├─ assess(bundle, interest, certIc, memory, …)  →  1.76× BREACH (interest cover)
  │
  ├─ attachLiveCitations(a, ari, TRIGGER)           ── ARI sources → a.evidence + proposed_write
  │
  ├─ bridge = { certified_ebitda 34.0, recomputed_ebitda 29.0, net_debt 220, 6.47→7.59, limit 6.50 }
  │
  └─ Scoreboard.scan(a, {triggerLabel: search.label, source: you_research_ari})   [scoreboard.ts]
        emits:  scanned(LIVE) → breach(LIVE) → memory_hit(LIVE)
        (drift NOT emitted here — Thornwick has no field-map drift; only values were restated)

ScanResult  →  cached in sessions[scan_id]  →  JSON to web/app.html
web/app.html animates the scoreboard, flips the tile 6.47×→7.59×, renders the ARI brief + sources,
             reveals the attest gate.
```

**Key invariant:** the recompute is **LIVE over a SYNTHETIC book**; the research is You.com's
(LIVE or PRERUN). No live network call is *in* the recompute — it depends only on the fixture.

---

## 2 · The attest gate (proposal → committed → notice)

Triggered by the **Attest breach** / **Deny** buttons, after a scan.

```
web/app.html  decide("ATTEST" | "DENY")
  │  POST /api/attest { scan_id, decision }
  ▼
src/server/app.ts  app.post("/api/attest")
  │  scan = sessions.get(scan_id)         ── 404 if unknown scan_id or no proposal
  │  applyAttestation(scan.headline, scan.proposal, decision, analyst, now, note, seqStart)
  ▼
src/server/scan.ts  applyAttestation(...)
  │
  ├─ makeAttestation(proposal, decision, analyst, now, note)     [kernel/attest.ts]
  │     signature = sha256(proposal_id | analyst_id | decision | attested_at)
  │
  ├─ attest(proposal, attestation)                               [kernel/attest.ts]
  │     verify proposal_id match + signature (throws only on tamper)
  │     ATTEST → CommittedWrite      DENY → DeniedWrite
  │
  ├─ serveIfCommitted(result, now, {note})                       [kernel/attest.ts]
  │     committed → executeCommitted() → ServeReceipt (channel: covenant_register, SYNTHETIC)
  │     denied/pending → null   ── "zero writes before attest" is a runtime guard, not a hope
  │
  └─ Scoreboard(now, seqStart)                                   [scoreboard.ts]
        attested(a, attestation)  → attested(LIVE)
        writeResult(a, result, serve) → write_committed(SYNTHETIC) | write_denied(LIVE)

AttestResult { outcome, attestation, serve_receipt, events }  →  JSON to web/app.html
```

**The gate is structural:** `executeCommitted()` — the *only* function that produces a serve receipt
— takes a `CommittedWrite`, and a `CommittedWrite` can only come from `attest()` on an `ATTEST`
decision. There is no code path from a scan to a served notice that bypasses a human decision. See
[ADR-0005](../decisions/0005-human-attest-gate.md).

---

## 3 · `assess()` internal pipeline (the pure kernel)

One `FactsBundle` + one `Covenant` + a `Certificate` + `MemoryContext` + `AssessCtx` → one
`Assessment`. Ten steps, no I/O.

```
assess()                                                         [kernel/assess.ts]
 1. locate period      certificate.period_id ?? ctx.target_period_id   → UNKNOWN_PERIOD
 2. validate covenant  metric ∈ enum, direction ∈ {max,min}            → UNKNOWN_COVENANT_TYPE
 3. resolveAuthoritative(period, order)   highest-basis obs; ties by as_of → NO_OBSERVATION
 4. selectThreshold(covenant, test_date)  dated stepdown row           → NO_EFFECTIVE_THRESHOLD
 5. recomputeRatio(obs, covenant)         resolve(num) / resolve(den)  [recompute.ts]
        UNRESOLVED → MISSING_INPUT · stale_fallback → STALE_INPUT_UNBACKED · 0 → DIVIDE_BY_ZERO
 6. detectDrift(obs, priorSameBasis)      compares the FIELD MAP       [drift.ts]
 7. classify(value, threshold, direction, watch_rule, trend)          [classify.ts]
        headroom<0 → BREACH · watch sub-rule fires → WATCH · else PASS
 8. consultMemory(facts, covenant, obs, status, memory)               [memory.ts]
        consulted iff BREACH or a disallowed add-back; join by sponsor_id
 9. certification_conflict   normalize(naturalStatus) != certified_status  (recorded, not an input)
10. buildProposedWrite()     WATCH/BREACH only; PENDING + dry_run + requires_attestation
    → Assessment (+ labels: facts SYNTHETIC, recompute LIVE, downstream_serve SYNTHETIC)
```

On any data fault the pipeline returns an **INDETERMINATE** Finding with `errors[]` — never a throw
(the kernel is total). See [totality.test.ts](../cards/eval-harness/oracle-test.md) and
[ADR-0010](../decisions/0010-kernel-totality.md).

---

## 4 · Corpus sweep (all six borrowers)

Used by the desk's corpus panel (`GET /api/corpus`) and the Data explorer
(`GET /api/data/borrower/:id`).

```
loadCorpus()  →  readdirSync(fixtures).filter(.json).sort().map(JSON.parse)   [corpus.ts]
for each bundle:
  memory = buildMemoryContext(bundle, corpus)    ── index siblings by sponsor_id
  for each period × covenant:
    cert = certificateFor(bundle, period, covenant)                          [eval/helpers.ts]
    assess(bundle, covenant, cert, memory, { now, target_period_id })         [kernel/assess.ts]
    → row { status, value, certified, conflict, drift, memory }
```

This is the proof the kernel "doesn't cry breach at everything": Merribrook PASSes, Brenmark
WATCHes on trend, Northgate/Marrowfield/Halveston BREACH on their respective mechanisms.

---

## 5 · You.com call with labeled fallback

Every You.com function follows the same shape (`youcom.ts`):

```
searchLiveWeb() / researchAri() / youResearch() / youBalance()
  key = process.env.YDC_API_KEY?.trim()
  mode === "prerun"  → labeled fallback (SYNTHETIC search / PRERUN ari)
  no key             → labeled fallback
  try:
      fetchJson(host, { headers: X-API-Key }, timeoutMs)   ── AbortController timeout
      (ARI) poll GET /v1/research/{task_id} until status==completed or deadline
      normalize live shape  → LIVE
  catch:
      labeled fallback  (Search → SYNTHETIC fixture · ARI → prerun cache PRERUN)
```

The fallback is the reason the offline test suite (`face.test.ts`) can run the full scan with no
network: it deletes `YDC_API_KEY` and asserts Search degrades to SYNTHETIC and ARI to PRERUN, while
the flip still fires. See [ADR-0008](../decisions/0008-youcom-two-endpoints-fallback.md).

---

See the interactive versions: [request lifecycle](../diagrams/developer/request-lifecycle.html) ·
[kernel pipeline](../diagrams/developer/kernel-pipeline.html) ·
[data pipeline](../diagrams/data-engineer/data-pipeline.html).
