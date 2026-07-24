# BUILD-LOOP — how we build Covenant Sentinel

The **execution plan**: what to build, in what order, and the check that ends each step. Read this alongside
`HANDOFF.md` (the brief + full spec). Full visual write-up (prep repo, if present):
`../hackathon-prep/docs/inner-build-loop.html`.

## The idea in one line

**Build the money-shot first and prove it works offline. Then wrap it in You.com. Then harden it. Don't move past a
step until its one check is green.**

## Three phases, left to right

- **CORE** — deterministic (no network, no LLM). Build & prove the money-shot with plain arithmetic you can test.
- **FACE** — the vendor. Wrap the core in the You.com Research API (ARI): live web + citations.
- **HARDEN** — serve the notice (PRERUN) and rehearse until it runs clean, every time.

**The demo is REAL the moment CORE's two starred checks pass** (step 3, the flip + step 7, the labels). FACE makes it
live; HARDEN makes it safe. Everything before that line is what you actually claim on stage — so all the risk is
front-loaded into cheap, testable, offline arithmetic.

## What we're building (the kernel — full spec in `HANDOFF.md` §2b)

One pure, deterministic function + a visible scoreboard. No LLM sits in the money-shot.

```
assess(facts, covenant, certificate, memory) -> Assessment
  recompute the ratio from RAW facts     # never trust the certified number
  fingerprint the doc + detect NAME drift # compare the field map, not just values
  classify PASS | WATCH | BREACH
  propose a write, gated behind human attest()   # it never writes itself
  + an ordered Event stream (the scoreboard)
  + a REAL / PRERUN / SYNTHETIC label on every effect
```

## The money-shot (SYNTHETIC data — `HANDOFF.md` §1)

Thornwick's certificate says **COMPLIANT — leverage 6.47×** (covenant ≤ 6.50×). Recompute off the restated facts (a
£3.0m disallowed add-back drops LTM EBITDA £34m→£29m; net debt £220m unmoved) and it's **7.59× — BREACH**. Certificate
GREEN, recompute BREACH.

## The gated steps — each is one capability + one check (green = done)

**Phase 1 — CORE (deterministic)**

| # | Capability | The check (gate) |
|---|---|---|
| 0 | Fixtures load | all 6 borrowers load into one Facts schema; `demo` runs end-to-end on a stub; 1 smoke test green |
| 1 | Recompute | Thornwick = **6.47×** as-reported **and 7.59×** restated; all 6 borrowers match known-good fixture ratios |
| 2 | Classify | A=PASS, B=WATCH, C=BREACH, Thornwick-restated=BREACH — all correct |
| **3 ★** | **The flip** | cert = COMPLIANT (6.47×) but `assess()` = BREACH (7.59×) → `assert flip == True` |
| 4 | Drift | catches `ebitda→adjusted_ebitda` (Northgate); the value-only path stays GREEN while the fingerprint path flips → assert the two diverge |
| 5 | DENY gate | write pre-attest → `write_denied`; after `attest()` → `write_committed`; assert **zero** writes fire before attest |
| 6 | Scoreboard | the money-shot emits the ordered event feed (`scanned→recomputed→breach→drift_detected→write_denied→attested→write_committed`) |
| **7 ★** | **Labels** | every effect carries exactly one of REAL/PRERUN/SYNTHETIC → assert none unlabeled |

_(Steps 3 + 7 together are the "demo-flip eval" — the one gate that says the demo is real.)_

**Phase 2 — FACE (the vendor)**

| # | Capability | The check (gate) |
|---|---|---|
| 8 | You.com ARI | a live, cited news event (Ardenmoor restated) maps to Thornwick's restated facts → the flip fires **with sources shown**; live crawl = REAL. **Cache the call** for demo reliability. (API in `HANDOFF.md` §3) |

**Phase 3 — HARDEN**

| # | Capability | The check (gate) |
|---|---|---|
| 9 | Serve + rehearse | ActionLayer serves the notice **(PRERUN)** only after you attest, against a synthetic target; then **3 clean end-to-end runs in a row** |

## How each step gets done (the cycle)

Every box above is built the same way. The unusual, important part is step 2 — **write the check before the code**.

**Pick the step → write its check first (a runnable assertion) → build the thin slice (opencode × Novita) → run the
check → green: commit + next · red: fix (max 3 tries, then stop and flag).** Run the full money-shot end-to-end every
~3 steps so drift surfaces early, not at demo time.

## Where to start

Write **step 3's check** before any kernel code: load Thornwick's certificate (COMPLIANT, 6.47×) and its restated
facts, and assert `recompute → 7.59×` and `flip == True`. It fails at first (nothing's built) — that's the starting
gun. Steps 0 → 1 → 2 exist purely to turn that one check green.

## How we measure progress

Two numbers, one that matters: **gates green / 10** (cumulative, honest), and **the demo gate = steps 3 + 7**. When
those two are green, the demo is verified, not hoped-for. Sequence CORE first because it's fully checkable with no
network and no LLM — get to green by step 7, then spend the event decorating (FACE) and hardening, not discovering
whether the core works.

## Ground rules

- **NEW WORK ONLY** — retype the kernel fresh from the spec; bring the data + design + credits, leave the code.
  Commit inside the event window. (`HANDOFF.md` §8)
- **Deterministic core first** — no network/LLM in the money-shot is exactly what makes it trustworthy on stage.
- **Honesty labels on every effect**; ActionLayer is **PRERUN**, never live-fire a real notice. (`HANDOFF.md` §2e–f)
- **Harness ≠ runtime** — opencode-on-Novita builds it; You.com ARI must be the live star in the demo. (`HANDOFF.md` §2d)
- Keys live in `.env` (gitignored); see `.env.example`.
