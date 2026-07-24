# HANDOFF — landing page rewrite (narrative / pitch)

**For the next session working in this repo.** This folder contains a **drop-in replacement for `web/index.html`**
plus the pitch language behind it. Nothing here has been wired into the app — integrating it is your call.

Written Jul 24, 2026 by the prep/strategy session. Companion: [`PITCH-LANGUAGE.md`](PITCH-LANGUAGE.md).

---

## 1 · Why this exists

The old landing page led with the **mechanism** ("The certificate reads GREEN. The recompute reads BREACH."). That's a
great line, but it's the *proof*, not the *story*. John's reframe — the one that matches how Wet Ink won — leads with
**scale**:

> A portfolio isn't 1 deal, it's 6,000. Getting a human to check them all is impossible. **How do you know all 6,000
> are green?** You don't — unless something re-underwrites every covenant on every deal. That's Covenant Sentinel.

The GREEN→BREACH flip is still on the page — demoted from headline to **evidence**, which makes it hit harder.

## 2 · What's in this folder

| File | What it is |
|---|---|
| `index.candidate.html` | Full drop-in replacement for `web/index.html`. Self-contained, no new deps. |
| `LANDING-HANDOFF.md` | This file — what changed and how to integrate. |
| `PITCH-LANGUAGE.md` | The winning words, the 30-second spoken pitch, and what NOT to say. Language is still being refined. |

## 3 · What is PRESERVED (do not regress these)

`index.candidate.html` is a **superset** of the current `web/index.html`. Verified against the real file:

- ✅ **The dynamic demo grid.** `<div class="grid" id="grid">` + the `/api/demos` fetch script are **byte-identical** to
  the current version. Cards still auto-populate from `demos/*/meta.json` — **never hardcode the vendor cards.**
  Adding `demos/<slug>/meta.json` still makes a card appear with no edit to the page.
- ✅ **The full `:root` palette** — same `--bg / --panel / --cyan / --green / --red / --violet / --amber`, same fonts.
- ✅ **The accent system** — `.vcard.live[data-accent="cyan|violet|green"]` hover glows, `.badge`, `.soon` opacity.
- ✅ **Header** (brand, event tag, GitHub link), **`.infra` sponsor line**, **`.foot` honesty chips**
  (`LIVE / PRERUN / SYNTHETIC`).
- ✅ **The CTA** still points at `/app`.
- ✅ **No JS added.** The new fleet board is static markup — it cannot fail at demo time.

## 4 · What is NEW

Four narrative sections between the hero and the existing "Explore the stack":

1. **Hero rewritten** → `<h1>How do you know all 6,000 are green?</h1>` + the scale answer. Keeps the `6.47× → 7.59×`
   flip strip directly underneath, relabeled *"the one it caught."*
2. **The book, at a glance** — a 60-cell portfolio board: a wall of green, 3 amber, **1 glowing red**. This is the
   Wet Ink fleet-view move, made visual. Paired with the Thornwick math.
3. **How it works** — Watch · Recompute · Catch · Escalate (4 cards).
4. **The guardrail** — *"It finds the breach. It won't file it. A human signs."* + the triage inversion: the machine
   reads all 6,000, the human decides on the few that flipped.

New CSS classes are namespaced to avoid collisions: `.sec`, `.fleetwrap`, `.board`, `.fleetgrid`, `.fcell`, `.caught`,
`.loop`, `.step`, `.two`, `.tcard`. **`.grid` and `#grid` still belong to the demo registry** — untouched.

## 5 · How to integrate

```bash
cd ~/Downloads/source/hack-you
cp web/index.html handoff/index.previous.html   # keep a rollback
cp handoff/index.candidate.html web/index.html
npm run dev   # or your usual start; then load / and confirm
```

**Then verify (2 minutes):**
1. The mini-demo grid still populates — **You.com** and **Data** show `LIVE` with `Open →`; the six stubs show `SOON`.
   (If the grid is empty, the `/api/demos` fetch broke — that's the one regression that matters.)
2. Both `Open →` links route correctly, and the CTA opens `/app`.
3. Mobile width: the fleet board reflows to 10 columns; cards stack.
4. The GitHub link and footer honesty chips render.

Rollback is `cp handoff/index.previous.html web/index.html`.

## 6 · Honesty check (important — this is a scoring asset)

The page claims a **6,000-deal book** while the demo runs a **6-borrower corpus**. That's handled honestly in two places
— **keep both**:

- The board header is labeled `Synthetic · illustrative`.
- The footer says: *"The 6,000-deal book is illustrative — the demo runs a 6-borrower corpus on the same engine."*

The claim is about the **architecture** (it scales), not a fib that it's live at scale. If you change the numbers,
keep a disclosure like this. Never let the page imply 6,000 real deals are being monitored.

## 7 · Open items / judgement calls for you

- **Numbers:** the page uses **6 → 6,000** as the spine and *"40 borrowers per analyst"* as the human ceiling. If the
  desk UI uses different figures, make them agree.
- **Line-count:** if the page now feels long for a 3-minute demo, the **first cut is "How it works"** (§3) — the desk
  demo shows the loop live anyway. Keep hero + fleet + guardrail.
- **Language is still being refined** with John — see `PITCH-LANGUAGE.md`. Expect the hero copy to change; keep edits
  in `web/index.html` and this handoff can go stale.
- Not committed. Commit only with John's explicit confirmation (repo rule).
