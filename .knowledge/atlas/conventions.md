---
type: atlas
title: Conventions & Coding Standards
last_analyzed: 2026-07-24
---

# Conventions & Coding Standards

Extracted from `README.md`, `BUILD-LOOP.md`, `CLAUDE.md`, `docs/KERNEL-SPEC.md`,
`docs/DEMO-SCRIPT.md`, and the code itself.

## Project ground rules (from `BUILD-LOOP.md` / `CLAUDE.md`)

- **New work only.** The kernel is re-typed fresh from `docs/KERNEL-SPEC.md` inside the event
  window; the spec is design/pseudocode only and carries no runnable implementation.
- **Deterministic core first.** No network and no LLM sit in the money-shot. That is exactly what
  makes it trustworthy on stage.
- **Honesty labels on every effect.** Never live-fire a real notice; the committed write records to
  the covenant register as **SYNTHETIC**.
- **You.com ARI must be the live star** — route real traffic through it.
- **Keys live in `.env`** (gitignored). `.env.example` holds placeholders only. Never commit real
  keys. `HANDOFF.md` (the private brief) is also gitignored.

## Build discipline — write the check before the code

Every capability is one gated step: **pick the step → write its runnable check first → build the
thin slice → run the check → green: commit + next / red: fix (max 3 tries, then flag).** Progress is
measured as **gates green / 10**, with the "demo gate" being steps 3 (the flip) + 7 (the labels).
The tests in [`src/eval/`](../maps/eval-harness/index.md) are those checks; `flip.test.ts`
literally predates the kernel.

## Language & module conventions

- **TypeScript, strict mode**, `target ES2022`, `module NodeNext`. ESM everywhere (`"type":"module"`).
- **`.js` extensions in imports.** Because `moduleResolution: NodeNext`, source imports reference the
  emitted extension: `import { assess } from "./assess.js"` even though the file is `assess.ts`. This
  is required, not optional.
- **`import.meta.url` for paths.** Files resolve their own directory via
  `dirname(fileURLToPath(import.meta.url))` — never `__dirname` (which does not exist in ESM) and
  never a hardcoded absolute path.
- **`resolveJsonModule` is on**, but fixtures are read at runtime with `readFileSync` + `JSON.parse`
  (so they can be enumerated), not `import`ed.

## Kernel conventions (the heart of the codebase)

- **Purity.** `assess()` and `attest()` perform no I/O, no writes, and read no clock except the
  injected `ctx.now`. The only Node import in the kernel is `node:crypto` (in `util.ts`).
- **Totality.** The kernel never throws on a data fault — it returns a Finding with `errors[]`.
  `INDETERMINATE` is never a silent `PASS`. `attest()` throws *only* on a tampered/mismatched
  attestation, never on a business DENY.
- **Claims are recorded, never adopted.** Certified value, stated EBITDA total, self-certified
  status, and the stored `field_map_fingerprint` are all treated as claims the kernel recomputes and
  compares against — never inputs to the classification.
- **Deterministic ids.** `assessment_id`/`proposal_id`/`receipt_id`/signatures are SHA hashes over
  pipe-joined field lists (`util.ts`), so a re-scan of an unchanged breach yields the same id and
  cannot double-serve.

## Honesty-label taxonomy (`Provenance`)

Exactly one of three values attaches to every on-stage effect:

| Label | Meaning | Example |
|---|---|---|
| `SYNTHETIC` | fabricated corpus data | every fixture, the issued breach notice |
| `LIVE` | fired live right now | the You.com Search crawl, the kernel recompute |
| `PRERUN` | a genuine call executed earlier, shown as a receipt | `prerun/ari-lender-response-standard.json` |

Rule: **never label a mock as PRERUN.** A `dry_run:true` descriptor that never executed is
SYNTHETIC. PRERUN is reserved for the genuine cached You.com response.

## Naming

- **Files**: kebab/lowercase (`recompute.ts`, `covenant-facts.schema.json`, `borrower-a.json`).
- **Tests**: `*.test.ts` under `src/eval/`, each named for the build-loop gate it proves.
- **Domains here are business functions, not folders** — the kernel gate, scoreboard, and attest
  logic all live in `src/kernel/` but are documented as three separate domains.
- **Synthetic entities are deliberately invented** (Thornwick Logistics, Ardenmoor Capital, Cheswick
  Bank, Marbury Tolland LLP). No fixture names a real company, fund, or person.
- **Covenant/period ids are inconsistent across fixtures** — some use underscores
  (`total_net_leverage`), some hyphens (`total-net-leverage`, `interest-cover`), some bespoke
  (`hv-leverage`, `dscr_floor`). The kernel keys off `covenant.metric` (a fixed enum), so ids are
  free-form labels. See the [synthetic-corpus map](../maps/synthetic-corpus/index.md).

## UI / presentation conventions

- **Self-contained HTML.** `web/*.html` and `demos/*/page.html` inline all CSS and JS — no build,
  no bundler, no external assets. A shared dark palette (`--bg:#0b0f17`, accent `--cyan:#46c6ff`) is
  copied into each page.
- **Honesty chips** (`SYNTHETIC`/`LIVE`/`PRERUN`) are rendered from the API response label, never
  hardcoded per beat.
- **`freshness`/`livecrawl` shown in the UI** so the audience sees the query is live.

## Documentation set (repo root + `docs/`)

| Doc | What it is |
|---|---|
| `README.md` | The public pitch, quick start, corpus table, gate list, vendor stack |
| `BUILD-LOOP.md` | The execution plan: 3 phases (CORE→FACE→HARDEN), 10 gated steps |
| `docs/KERNEL-SPEC.md` | The full kernel design/spec (types, algorithms, worked examples, error matrix) — the source the kernel was re-typed from |
| `docs/DEMO-SCRIPT.md` | Second-by-second run-of-show, per-beat fallbacks, judge targeting |
| `DEPLOY.md` | Render deploy walkthrough |
| `HANDOFF.md` | The private brief (gitignored — not in this KB) |
