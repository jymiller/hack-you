# DEMO SCRIPT + RUN-OF-SHOW — ENID Covenant Sentinel

**Event:** You.com Agentic hackathon · Fri Jul 24 2026 · AWS Builder Loft, SF
**Format:** ≤ 3:00 live, in-person + a 1–3 min backup video recorded Thu night.
**The one truth on screen:** *the certificate reads GREEN, the recompute says BREACH.*

Persona line (say it in the first 20s, near-verbatim):
> "A credit-monitoring analyst covers 40 borrowers and can't read every filing. Covenant Sentinel
> watches live filings and news, and the moment something threatens a covenant it produces a cited,
> structured drift alert in under a minute."

---

## 0 · The timing problem, solved (read this first)

ARI at `research_effort=standard` measured **13.3s** last night. In a 180s demo that is 7% dead air,
and dead air on stage is fatal. **Fix: fire ARI in the background at the very first click and mask its
latency with narration that is happening anyway.**

- ARI is called with **`background: true`** → `POST https://api.you.com/v1/research` returns a
  `task_id` + `stream_url` in **< 1s**, so the click never blocks the UI. (Verified last night.)
- Poll `GET /v1/research/{task_id}` until `status=="completed"`; the SSE `/stream` is progress/heartbeat
  only — pull the real answer from the GET after the terminal event.
- **Fire at t≈0:06** (the "Scan" click). Completes **≈ t=0:19**. First on-screen display of the ARI
  package is **t=1:30**. Slack = **71 seconds** — even a 3× slow venue-wifi run (≈40s) finishes by 0:46,
  still 44s early. The 13.3s is fully absorbed; the audience is watching the Search result and the
  recompute, never a spinner.
- The scoreboard shows `research: queued → running` with a live progress tick during 0:06–0:19, so the
  wait is **visible but productive** — that read as "we understand async," not lag.

The research question ARI answers ("how do lenders respond when a sponsor-backed borrower restates and
disallows add-backs after an auditor change?") depends only on the **event**, not on the recompute
number — so firing it before the recompute is legitimate, not faked.

**Two You.com endpoints, one per job** (this is what Kruti rewards):
- **You.com Search** — `GET ydc-index.io/v1/search`, `freshness=day`, `livecrawl=news` → surfaces the
  fresh restatement headline, sub-second. This is the visible **live-data** proof. `[REAL]`
- **You.com Research / ARI** — `POST api.you.com/v1/research`, `standard`, `background:true` → the
  cited, structured brief. This is the flagship move; #1 on DeepSearchQA (83.67%). `[REAL]`

---

## 1 · Pre-stage setup (T-5 min, before you're miked)

- [ ] App open at the **live deployed URL** (Render of record; `cloudflared` tunnel as hot insurance).
      Keep the URL bar visible all demo — "this is running live" scores Sandeep/AWS + Rajani.
- [ ] Thornwick tile showing **GREEN 6.47×**, certificate **IN COMPLIANCE**. Nothing scanned yet.
- [ ] **Backup video** queued in a second tab, paused at frame 0 (see §5).
- [ ] PRERUN cache open in background tabs, ready to drop in: `prerun/ari-lender-response-standard.json`
      (rendered) and a cached Search-result screenshot from last night.
- [ ] Laptop set to **never sleep**; wifi tested on venue network; `GET /v1/billing/account_balance`
      checked so you know the key has credit.
- [ ] Opsera scan screenshot (from Thu night) loaded as the single bonus slide.
- [ ] One dry run of the whole 3:00 on the actual venue wifi if you can get 5 quiet minutes.

---

## 2 · Second-by-second run-of-show

Labels: **[REAL]** fired live · **[SYNTHETIC]** corpus data · **[PRERUN]** executed earlier, shown as
a receipt. The money-shot is **SYNTHETIC data through a REAL recompute**.

| Time | On screen | Said (near-verbatim) | Firing / background | Label |
|---|---|---|---|---|
| **0:00** | Sentinel desk. Thornwick tile **GREEN 6.47×**; cert badge **IN COMPLIANCE** | "This is a live credit-monitoring desk. One analyst, forty borrowers — and every borrower's certificate says the same thing: in compliance." | — | data on tile `[SYNTHETIC]` |
| **0:06** | Click **Scan live web** | "Sentinel watches the live web for anything that threatens a covenant. Watch the last twenty-four hours." | **Search fires** (`freshness=day`, `livecrawl=news`). **ARI fires `background:true`** — `task_id` returns instantly; scoreboard: `research: queued` | Search `[REAL]` · ARI `[REAL]` |
| 0:10 | Scoreboard tick: `scanned · research: running ▓▓░░` | "The moment something lands it doesn't just alert — it researches, it recomputes, and it puts a human in the loop." | ARI running in background (≈13s); Search returning | ARI `[REAL]` |
| **0:20** | **Live headline card** renders: *"Thornwick sponsor Ardenmoor restates FY2025 after auditor change"* + source + timestamp | "There it is — Thornwick's sponsor, Ardenmoor, restated FY2025 accounts after an auditor change. Live, from the last day, with a source." | ARI still running (done ≈0:19–0:21) | headline `[REAL]` |
| **0:50** | Recompute panel opens; certified **6.47×** highlighted, then the bridge animates | "The certificate says 6.47 times — green. But Sentinel never trusts the certified number; it recomputes on our own books. The restatement reverses £1.7m of early-recognised revenue and disallows £3m of unrealised synergies. EBITDA falls from £34m to £29m. Net debt never moved." | ARI complete; result cached, waiting to display | recompute `[REAL]` on `[SYNTHETIC]` book |
| **1:20** | Ratio flips **6.47× GREEN → 7.59× BREACH**; tile turns red; scoreboard: `breach · certification_conflict · memory_hit` | "6.47 becomes 7.59 — a breach by more than a full turn. The dashboard was green. The truth is a breach." | — | `[REAL]` recompute · `[SYNTHETIC]` data |
| **1:30** | **Cited ARI brief** slides in: summary + `lender_actions[]`, each with **inline source links** | "And here's why it matters — researched while we were talking. You.com's ARI agent built a cited brief on exactly this: restated accounts, disallowed add-backs, auditor change. Eight real sources — Proskauer, Sidley, Paul Weiss." | — (pulled from the background call that finished at 0:19) | ARI package `[REAL]` |
| **2:00** | **Attest gate**: write shown as **PROPOSED**, red "requires human sign-off" | "Sentinel does not act on this itself. It proposes. A human analyst attests." → click **Attest** → write goes **PROPOSED → COMMITTED** | — | gate `[REAL]` |
| **2:15** | **ActionLayer serve receipt** (reservation-of-rights notice) appears | "Only after sign-off does the last mile fire — a reservation-of-rights notice, served through ActionLayer. Pre-run against a sandbox, shown here as a receipt." | — | serve `[PRERUN]` |
| **2:30** | Metric card + single **Opsera scan** slide | "Signal to cited breach alert: under a minute — an analyst's afternoon in thirteen seconds. Live signal from You.com Search, the cited brief from You.com's ARI, number one on DeepSearchQA. Secured and scanned with Opsera." | — | metric `[REAL]` · Opsera `[PRERUN]` |
| **2:45** | Split card: **cert GREEN 6.47×** vs **recompute BREACH 7.59×** | *(closing line — §4)* | — | — |
| **3:00** | Hold on the split card | *(silence — let it land)* | — | — |

**Three-agent framing** (drop one line if it flows, ~t=0:10): "Three agents — a Watcher on You.com
Search, a Researcher on ARI, a Calculator on the covenant kernel — coordinated behind the attest gate."
Straddles Real-Time Intelligence + Multi-Agent Systems. Don't belabor it.

---

## 3 · Per-beat fallback lines (fall back to PRERUN cache — and SAY SO; honesty scores)

Say the fallback **out loud**; naming the cache is worth more than a flawless run.

| Beat | If it dies | Say, and show |
|---|---|---|
| **Search headline (0:20)** | crawl times out on venue wifi | "Our live crawl just timed out on the venue wifi — here's the identical query I ran last night, labeled PRERUN." → cached Search screenshot `[PRERUN]` |
| **ARI package (1:30)** | background call still running or 429/5xx | "The research call's still running — rather than watch a spinner, here's the completed package from last night. PRERUN — a genuine API response, eight real sources, 13.3 seconds." → render `prerun/ari-lender-response-standard.json` `[PRERUN]` |
| **Recompute (0:50–1:20)** | UI hiccup | "The recompute is a pure local function — no network, nothing to fail. Here are the numbers straight from the book: £34m EBITDA down to £29m, 220 over 29 is 7.59." (read off `fixtures/thornwick.json`) `[REAL]` |
| **Attest / ActionLayer (2:00–2:15)** | anything | Already PRERUN by design — never live-fire a notice on stage. "This one we never fire live; here's the receipt from the sandbox run." `[PRERUN]` |
| **Total wifi death** | network gone entirely | "Venue wifi's gone — here's the full run I recorded last night, end to end." → play the backup video (§5). |

Guardrails that protect the demo and the bounties:
- **Never** live-fire ActionLayer on stage (metered; can hang on a `blocked_on_user` prompt). PRERUN only.
- **Never** call ARI `exhaustive` live; `standard` + `background:true` only.
- The live runtime research model **is You.com ARI**, not Novita — do not swap Novita in as the ARI
  substitute (voids the You.com bounty). Novita is the *build harness* + OCR; mention only as "built with."
- Every on-screen effect carries exactly one label. Never label a mock as PRERUN.

---

## 4 · Exact opening and closing lines

**Open (0:00):**
> "This is a live credit-monitoring desk. One analyst, forty borrowers — and every borrower's
> certificate says the same thing: in compliance."

**Close (2:45, exact):**
> "The certificate reads GREEN. The recompute reads BREACH. Closing that gap — in under a minute,
> fully cited, with a human in the loop — is Covenant Sentinel. Thank you."

---

## 5 · Backup video spec (record Thu night, on good wifi)

- **1–3 min**, a single clean end-to-end run of §2 (same narration), captured with all calls firing
  REAL on stable wifi. This is your insurance against total network failure — and the submission's
  required backup video in one shot.
- Show the deployed URL bar, the live Search headline, the recompute flip, the cited ARI package with
  visible source links, the attest click, and the PRERUN serve receipt.
- Keep every honesty label visible on screen. Narrate the labels once ("live," "synthetic book,"
  "pre-run") so the video is self-explanatory muted.
- Save it locally **and** upload a copy; queue the local file in a paused tab before you go on.

---

## 6 · Who each beat is for (judge targeting)

- **Kruti (You.com):** two endpoints, right one per job; `freshness=day` live proof; ARI cited sources
  on screen; benchmark named. This is the whole spine — build for her.
- **Rutansh (Palo Alto):** the **attest gate** (PROPOSED → COMMITTED), the labels, the Opsera scan
  slide — audit trail + human sign-off + security.
- **Rajani (Microsoft):** background/async ARI, per-beat fallbacks, the live deployed URL, recompute is
  a pure function — production-readiness, not demo-ware.
- **Sandeep (Amazon/AWS):** "running live" URL bar; name the AWS venue credits / deploy.

Rubric weighting to exploit: Impact 20 + UX 15 + Presentation 15 = **50%** — the metric line, the clean
GREEN→BREACH flip, and this rehearsed 3:00 are where that half is won.
