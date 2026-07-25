<p align="center">
  <strong>The certificate reads GREEN. The recompute reads BREACH.</strong><br>
  <em>Real-time covenant monitoring for credit desks — live web signal, cited research, a human on the gate.</em>
</p>

<p align="center">
  <a href="https://covenant-sentinel.onrender.com"><strong>▶ Live demo</strong></a> ·
  <a href="https://luma.com/youdotcom-agentic-hackathon-sf">You.com Agentic Hackathon</a> ·
  AWS Builder Loft, San Francisco · July 2026
</p>

# Covenant Sentinel

**A credit analyst covers 40 borrowers and can't read every filing — so the dashboard stays green while a covenant quietly breaches.**

Covenant monitoring for private credit. Not *"can the model summarise the filing?"* — *"did anyone catch the breach the certificate is hiding, and did a human sign off before anything went out?"*

Built in one day on the [You.com](https://you.com) developer platform. The use case comes from the work on **ENID**; all code here was written during the event.

<!-- Screenshot slots — drop the PNGs in docs/ and delete the comment markers to render.
![Covenant Sentinel desk — Thornwick certified GREEN 6.47x, recomputed BREACH 7.59x, with the cited ARI brief and the attest gate](docs/desk.png)
-->

---

## The premise

A borrower signs a covenant, and every quarter it self-certifies compliance. Somebody is supposed to read that certificate, recompute the ratio from the underlying book, and act if the borrower has slipped. Mostly nobody does — one analyst covers forty names, and the certificate is the path of least resistance.

So the failure is quiet. A sponsor restates its accounts, an auditor change disallows some add-backs, EBITDA falls — and the certificate, computed on the old numbers, still says **IN COMPLIANCE**. The dashboard is green on a number that is no longer true.

**Covenant Sentinel never trusts the certified number.** It watches the live web for the event that changes the math, recomputes the ratio on its own book, and routes the result to a human before anything is served.

## What it does

- **Watches the live web.** You.com Search with `freshness=day` and `livecrawl=news` surfaces the fresh restatement headline, with a source and a timestamp — labeled `LIVE`.
- **Researches while you're still talking.** You.com's ARI agent fires with `background:true` at the first click and returns a cited, structured brief — `summary` + `lender_actions[]` via `output_schema`, with visible source links. It completes in ~13s, hidden behind narration that was happening anyway.
- **Recomputes instead of reading.** The certificate says **6.47× — GREEN**. The restatement reverses £1.7m of early-recognised revenue and disallows £3.0m of unrealised synergies; LTM EBITDA falls £34m → £29m, net debt never moves, and leverage is **7.59× — BREACH**. A breach by more than a full turn, on a certificate that says otherwise.
- **Catches drift the numbers alone won't show.** The kernel fingerprints the field *map*, not just the values — so a borrower silently relabeling `ebitda` to `adjusted_ebitda` is caught rather than read straight past.
- **Remembers across the book.** The cross-deal join is `sponsor_id`: the same sponsor disallowed the same run-rate synergy on a different borrower two years earlier, and Sentinel surfaces the precedent.
- **Holds the line on authority.** The kernel only ever emits a **PROPOSED** write. A separate human `attest()` flips it to **COMMITTED** — the agent cannot serve a notice by itself.
- **Proves it.** Every effect on screen carries exactly one label: **LIVE**, **PRERUN**, or **SYNTHETIC**.

## The story, act by act

**1 · The desk** — one analyst, forty borrowers, every certificate saying the same thing. Thornwick sits green at 6.47×.

**2 · The scan** — *Scan live web* fires You.com Search and, in the background, ARI. The scoreboard ticks `scanned · research: running` while the crawl returns.

**3 · The signal** — a live headline lands: Thornwick's sponsor Ardenmoor restated FY2025 after an auditor change. Source and timestamp visible, from the last day.

**4 · The recompute** — Sentinel ignores the certified number and recomputes on its own book. **6.47× GREEN → 7.59× BREACH.** The tile turns red; the scoreboard logs `breach · certification_conflict · memory_hit`.

**5 · The gate** — the write is shown **PROPOSED**, marked *requires human sign-off*. An analyst attests; only then does it commit, recording a reservation-of-rights breach notice to the covenant register. No counterparty is ever served on stage.

## The demo (≈3 min)

1. **The desk** ([live](https://covenant-sentinel.onrender.com/app)) — Thornwick green at 6.47×, certificate **IN COMPLIANCE**.
2. **Scan live web** — Search returns the fresh restatement headline `LIVE`; ARI is already running in the background.
3. **The flip** — the recompute panel bridges £34m → £29m EBITDA and the ratio flips **6.47× → 7.59×**.
4. **The cited brief** — the ARI package slides in with `lender_actions[]` and inline source links, researched during the previous two beats.
5. **Attest** — the proposed write goes **PROPOSED → COMMITTED** under a human's identity, and the notice lands in the register.

**Signal to cited breach alert: under a minute** — against an analyst's afternoon.

## Honesty is a feature, not a disclaimer

Every borrower is fictional. The corpus is **SYNTHETIC** and contains no real company and no ENID IP. The You.com Search and ARI calls are **LIVE** — real metered traffic against the account. Anything captured ahead of time is **PRERUN**, and that label is reserved for a genuine cached API response; a mock is never dressed up as one.

The money-shot is precisely **synthetic data through a live recompute**. Every live path degrades to a labeled fallback rather than a spinner: Search falls back to the fixture event, ARI falls back to a real cached response, and the recompute is a pure function that touches no network at all. The demo's floor is a clean offline run with no keys.

## How we used the You.com APIs

Three endpoints, one key (`X-API-Key`), each picked for a different job. **Two hosts, deliberately not mixed:** Search lives at `ydc-index.io/v1`, Research and billing at `api.you.com/v1`.

### Search — `GET /v1/search`

Called with **`freshness=day`** and **`livecrawl=news`** to force a fresh crawl rather than serve a cached index. That is what surfaces the restatement headline in the window that matters. Responses are normalised out of `results.web[]` into `{url, title, publisher, snippet, published_at}`, where `page_age` carries the freshness proof onto the screen. The timeout is a deliberate 14s — `livecrawl=news` genuinely takes ~6s, and cutting it short would silently downgrade a live result to a fallback.

On the Research page this runs as **DETECT**: fast, broad, shallow — *is this pattern in the live web right now?*

### Research / ARI — `POST /v1/research`

The flagship. The query field is `input`, not `query`. Three choices make it an integration rather than a call:

- **`background: true`** — returns a `task_id` in under a second; we poll `GET /v1/research/{task_id}` until `completed`. Nothing blocks on a long research run, which is what lets the brief be researched *during* the two demo beats that were happening anyway.
- **`output_schema`** — ARI returns **structured JSON** (`summary`, `lender_actions[]`), not prose we regex afterwards. Every object in the schema sets `additionalProperties: false`, which the validator requires.
- **`research_effort: "standard"`** — pinned on purpose. Never `exhaustive` live on stage.

**The portfolio fan-out is the case that makes async non-optional.** `POST /api/research/portfolio` walks the corpus, dedupes to one job **per sponsor**, and dispatches a concurrent ARI agent for each. Run sequentially those are minutes of dead air; fanned out they land together. Every run — DETECT, a single question, or a fan-out — is written to a shared research log partitioned by the question that produced it, so what's on screen is an audit trail rather than a single answer.

### Balance — `GET /v1/billing/account_balance`

Remaining You.com credit, rendered live in the UI. The unglamorous proof that this is metered traffic against a real account and not an SDK import.

### Every path degrades, and says so

No live rail is allowed to hang or to lie. Search failure falls back to the **SYNTHETIC** fixture — nothing was crawled and it never claims otherwise. ARI failure falls back to **PRERUN**, backed by `prerun/ari-lender-response-standard.json`, a *genuine cached You.com response*; a mock is never dressed up as one. Success is **LIVE**. `/api/health` exposes `youcom_key` so the live path is verifiable from outside the demo.

## The rest of the stack

- **Parasail** — GLM-5.2 reasoning chat over the OpenAI-compatible endpoint, as its own mini-demo.
- **Render** — hosts the live URL, and its own mini-demo reports the running instance, commit and uptime back to you.

Each mini-demo under `demos/<slug>/` is self-contained — `meta.json` plus an optional `page.html` and `routes.ts` — and is auto-mounted at boot. Drop a directory in and it appears; there is no shared file to edit.

## Run it

Node ≥ 20.

```bash
npm install
npm start          # http://localhost:8080
```

- `/` — the landing page and mini-demo launcher
- `/app` — the Sentinel desk (the money-shot)
- `/research` · `/data` · `/render` · `/parasail` — the vendor mini-demos

```bash
npm test           # the build-loop gates
npm run demo       # the money-shot end-to-end, deterministic, no network
```

**Runs offline with zero keys** — that's the floor, and every live rail has a labeled fallback. Live mode reads `YDC_API_KEY` (and optionally `PARASAIL_API_KEY`) from `.env`; see `.env.example`.

### Tests

| Gate | What it pins |
|---|---|
| `flip.test.ts` | ★ the flip — certificate GREEN 6.47× vs `assess()` BREACH 7.59× |
| `oracle.test.ts` | every `expected_assessment[]` row across all six borrowers |
| `gates.test.ts` | the DENY/attest gate, scoreboard ordering, ★ no unlabeled effect |
| `face.test.ts` | the You.com-wrapped scan, including the offline fallback path |
| `totality.test.ts` | the error matrix — the kernel never throws, and INDETERMINATE is never a silent PASS |

## The corpus

Six synthetic borrowers, engineered so the same green→breach truth surfaces several different ways.

| Borrower | Mechanism | The flip |
|---|---|---|
| **Thornwick Logistics** (sponsor Ardenmoor) | Restatement over time | Leverage **6.47× → 7.59×** — the money-shot |
| **Halveston Services** (same sponsor) | Cross-deal precedent | **5.38× → 6.22×**, same disallowed add-back, two years earlier |
| **Northgate Airport** | Schema drift | ICR **1.52× → 1.33×** vs a 1.40× floor — `ebitda` silently relabeled `adjusted_ebitda` |
| **Borrower C** | Under-reporting | DSCR **1.08× vs 1.20×** — self-certifies compliant, the raw financials disagree |
| **Borrower A** | Control | Clean PASS |
| **Borrower B** | Watch | Leverage creeping 4.0 → 4.2 → 4.4× |

## About

Covenant Sentinel is inspired by the work on **ENID**, which is the use case here and never an integration. The gate is the product: detection isn't finished until someone with authority signs, and that signature is a decision a human owns.

Architecture and design notes live in [`docs/KERNEL-SPEC.md`](docs/KERNEL-SPEC.md) and [`.knowledge/`](.knowledge/); the run-of-show is in [`docs/DEMO-SCRIPT.md`](docs/DEMO-SCRIPT.md).
