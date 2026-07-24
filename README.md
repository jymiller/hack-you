# hack-you

**ENID Covenant Sentinel** — build repo for the You.com Agentic hackathon (AWS Builder Loft, SF · Fri Jul 24, 2026).

A real-time agent that watches the live web — news, filings, markets — for events that threaten a
borrower's financial covenant, does **cited** deep research via the You.com Research API (ARI),
flags the drift, routes it to a human analyst to sign off, and (post-attestation) serves a notice
via ActionLayer. The killer failure mode it catches: a borrower quietly restating its accounts so a
covenant silently breaches while the dashboard stays green.

**The one truth on screen:** the certificate reads **GREEN 6.47×**, the recompute reads **BREACH 7.59×**.

## The pattern

ENID (a private-markets debt-monitoring platform) is the **use case named in the pitch only** — never
an integration. The prototype is fully self-contained: all data is **synthetic fixtures**, and all
code in this repo is **written fresh during the event** (fresh repo per event).

## Quick start

```bash
npm install
npm test          # 51 assertions — the 10 build-loop gates, green
npm run demo      # money-shot end-to-end on the deterministic core (no network)
npm start         # Sentinel desk at http://localhost:8080
```

To wire the live You.com calls, copy `.env.example` to `.env` and set `YDC_API_KEY`. Without a key the
app runs in labelled fallback mode (Search → SYNTHETIC fixture; ARI → the genuine PRERUN cached
response) so the demo never hangs on venue wifi.

## What's inside

The whole strategy is to **front-load all risk into a deterministic, offline, testable core**, then
wrap it in You.com, then harden it. Three phases, each gated on one runnable check:

### Phase 1 — CORE (deterministic; no network, no LLM in the money-shot)

`src/kernel/` — one pure function `assess(facts, covenant, certificate, memory, ctx) → Assessment`:

1. **recompute** the ratio from raw measures — never trust a certified number or a stated EBITDA total
   (`recompute.ts`: sums only `allowed === true` add-backs + signed adjustments).
2. **fingerprint** the field *map* and detect schema drift by comparing maps, not values
   (`drift.ts`: a silent `EBITDA → Adjusted EBITDA` rename is caught where a value diff sees nothing).
3. **classify** PASS / WATCH / BREACH / INDETERMINATE via one comparator (`classify.ts`), where
   `direction: max|min` serves leverage ceilings and cover-ratio floors, and WATCH is data-driven
   (proximity band or a deteriorating trend).
4. **consult memory** across bundles — the cross-deal join key is `sponsor_id` (`memory.ts`:
   Thornwick → Halveston, same sponsor, same disallowed run-rate synergy, two years earlier).
5. **propose a write** that is inert until a separate human `attest()` flips it (`attest.ts`). A
   downstream serve is structurally unreachable without a `CommittedWrite`, which only an ATTEST
   produces — the DENY/attest gate.

Every effect carries exactly one honesty label — **SYNTHETIC** (corpus data), **REAL** (a live
computation/crawl), **PRERUN** (a cached receipt) — and the event scoreboard (`scoreboard.ts`) makes
green→breach legible: `scanned → breach → memory_hit → attested → write_committed`.

### Phase 2 — FACE (the vendor)

`src/server/youcom.ts` — two You.com endpoints, one per job:

- **Search** `GET ydc-index.io/v1/search` (`freshness=day`, `livecrawl=news`) → the fresh restatement
  headline. The visible live-data proof. `[REAL]`
- **Research (ARI)** `POST api.you.com/v1/research` (`standard`, `background:true` → `task_id` in <1s,
  polled to completion) → the cited, structured brief. #1 on DeepSearchQA (83.67%). `[REAL]`

`src/server/scan.ts` fires both at scan time, runs the kernel over the SYNTHETIC book, and attaches
the REAL/PRERUN citations to the finding. Recompute is REAL over a SYNTHETIC book.

### Phase 3 — HARDEN

The ActionLayer serve is **PRERUN** — a cached reservation-of-rights receipt, served only after the
human attests, never live-fired on stage. The deterministic core makes the 3-clean-runs rehearsal
trivial: the money-shot is a pure function.

## The 6-borrower synthetic corpus (`fixtures/`)

| Borrower | Mechanism | Flip |
|---|---|---|
| **Thornwick** (sponsor Ardenmoor) | restatement over time | leverage **6.47× → 7.59×** — the money-shot |
| **Halveston** (same sponsor) | prior cross-deal precedent | **5.38× → 6.22×**, same disallowed add-back |
| **Northgate** | schema drift / silent rename | ICR **1.52× → 1.33×**; `ebitda→adjusted_ebitda`, dashboard stays green |
| **Borrower C** (Marrowfield) | under-reporting | DSCR **1.24× vs 1.08×**; self-certifies "IN COMPLIANCE" |
| **Borrower A** (Merribrook) | control | clean PASS |
| **Borrower B** (Brenmark) | watch | leverage creep 4.0 → 4.2 → 4.4× (WATCH on trend) |

Each fixture carries an `expected_assessment[]` oracle; `src/eval/oracle.test.ts` reproduces every row.

## Tests (the build-loop gates)

```bash
npm test          # vitest — all gates
npm run typecheck # tsc --noEmit
```

- `flip.test.ts` — ★ the flip: certificate GREEN 6.47× vs `assess()` BREACH 7.59×.
- `oracle.test.ts` — every `expected_assessment[]` row across all 6 borrowers (recompute, classify, drift).
- `gates.test.ts` — DENY/attest gate, scoreboard ordering, ★ honesty labels (none unlabeled).
- `face.test.ts` — the You.com-wrapped scan (offline fallback path).
- `totality.test.ts` — §11 error matrix; the kernel never throws and INDETERMINATE is never a silent PASS.

## Vendor stack

- **You.com** — Research API (ARI) for cited deep research; Search/Contents for live-web freshness.
- **Novita** — reasoning LLM + DeepSeek-OCR, and the opencode build harness (OpenAI-compatible).
- **ActionLayer** — last-mile serve-notice rail (run PRERUN on stage).
- **AWS** — venue and deploy target (Builder Loft credits).

## Private prep

Detailed plan, demo script, and day-of notes live in `HANDOFF.md` (gitignored) and the build sequence
in `BUILD-LOOP.md`. Kernel spec + demo run-of-show in `docs/`.
