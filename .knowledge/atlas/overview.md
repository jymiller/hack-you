---
type: atlas
title: System Overview — Covenant Sentinel
last_analyzed: 2026-07-24
modules:
  - name: covenant-kernel
    display_name: Covenant Kernel (deterministic assessment core)
    file_count: 7
    role: Pure function assess(facts, covenant, certificate, memory, ctx) → Assessment. Recompute-never-trust, classify PASS/WATCH/BREACH/INDETERMINATE, field-map drift, cross-deal memory. No I/O.
    depends_on: []
    entry_points: ["src/kernel/assess.ts"]
    handlers: ["src/kernel/recompute.ts", "src/kernel/classify.ts", "src/kernel/drift.ts", "src/kernel/memory.ts"]
    migration: { complexity: high, coupling_score: 0.08, session_dependencies: 0, global_dependencies: 0 }
  - name: attestation-gate
    display_name: Attestation & Breach-Notice Gate
    file_count: 1
    role: The human DENY/ATTEST gate. assess() only PROPOSES; a separate attest() flips it, and only a CommittedWrite reaches executeCommitted() — the sole place a real effect can happen.
    depends_on: ["covenant-kernel"]
    entry_points: ["src/kernel/attest.ts"]
    handlers: ["src/kernel/attest.ts"]
    migration: { complexity: medium, coupling_score: 0.10, session_dependencies: 0, global_dependencies: 0 }
  - name: scoreboard-labels
    display_name: Event Scoreboard & Honesty Labels
    file_count: 1
    role: One universal event feed (scanned→breach→drift→memory_hit→attested→write_committed) making green→breach legible; every effect carries exactly one LIVE/PRERUN/SYNTHETIC label.
    depends_on: ["covenant-kernel"]
    entry_points: ["src/kernel/scoreboard.ts"]
    handlers: ["src/kernel/scoreboard.ts"]
    migration: { complexity: low, coupling_score: 0.10, session_dependencies: 0, global_dependencies: 0 }
  - name: youcom-integration
    display_name: You.com Live Research (the vendor FACE)
    file_count: 3
    role: Two You.com endpoints, one per job — Search (fresh headline) + Research/ARI (cited brief), plus balance. Every path degrades to a labeled fallback so the demo never hangs on venue wifi.
    depends_on: ["covenant-kernel", "synthetic-corpus"]
    entry_points: ["src/server/youcom.ts"]
    handlers: ["src/server/youcom.ts", "demos/youcom/routes.ts"]
    migration: { complexity: high, coupling_score: 0.35, session_dependencies: 0, global_dependencies: 1 }
  - name: scan-orchestration
    display_name: Scan Orchestration (the money-shot flow)
    file_count: 1
    role: Fires You.com Search + ARI at t≈0, runs the kernel over the SYNTHETIC book, attaches LIVE/PRERUN citations, emits the scoreboard, and applies the attestation. Wires every domain together.
    depends_on: ["covenant-kernel", "attestation-gate", "scoreboard-labels", "youcom-integration", "synthetic-corpus"]
    entry_points: ["src/server/scan.ts"]
    handlers: ["src/server/scan.ts"]
    migration: { complexity: medium, coupling_score: 0.40, session_dependencies: 0, global_dependencies: 0 }
  - name: synthetic-corpus
    display_name: Synthetic Corpus & Data Contract
    file_count: 9
    role: The 6-borrower SYNTHETIC corpus (each with an expected_assessment[] oracle), the loader + cross-deal memory index, the Facts JSON Schema (v1.0.0), and the genuine cached ARI response (PRERUN).
    depends_on: ["covenant-kernel"]
    entry_points: ["src/corpus.ts"]
    handlers: ["src/corpus.ts"]
    migration: { complexity: medium, coupling_score: 0.20, session_dependencies: 0, global_dependencies: 0 }
  - name: web-demo-platform
    display_name: Web UI & Mini-Demo Platform
    file_count: 12
    role: Single Express service that serves the landing launcher + Sentinel desk and AUTO-MOUNTS every demos/<slug>/ directory (meta.json + optional page.html + optional routes.ts). Drop-in demos, no shared-file edits.
    depends_on: ["scan-orchestration", "covenant-kernel", "synthetic-corpus", "youcom-integration"]
    entry_points: ["src/server/app.ts"]
    handlers: ["src/server/app.ts", "demos/data/routes.ts"]
    migration: { complexity: high, coupling_score: 0.50, session_dependencies: 0, global_dependencies: 2 }
  - name: eval-harness
    display_name: Evaluation & Oracle Harness
    file_count: 8
    role: 51 vitest assertions reproducing the 10 build-loop gates (flip, oracle, gates, face, totality) plus the offline money-shot demo script and the live You.com smoke test.
    depends_on: ["covenant-kernel", "attestation-gate", "scoreboard-labels", "scan-orchestration", "synthetic-corpus", "youcom-integration"]
    entry_points: ["src/eval/flip.test.ts", "scripts/demo.ts"]
    handlers: ["src/eval/oracle.test.ts", "src/eval/gates.test.ts", "src/eval/face.test.ts", "src/eval/totality.test.ts"]
    migration: { complexity: medium, coupling_score: 0.30, session_dependencies: 0, global_dependencies: 1 }
  - name: infrastructure
    display_name: Build & Deploy Infrastructure
    file_count: 7
    role: ESM/tsx toolchain, TypeScript strict config, Render Blueprint + deploy guide, env-var contract, and the local launch config.
    depends_on: []
    entry_points: ["package.json", "render.yaml"]
    handlers: []
    migration: { complexity: low, coupling_score: 0.15, session_dependencies: 0, global_dependencies: 0 }
---

# System Overview — Covenant Sentinel

**Covenant Sentinel** (repo `hack-you`, npm package `covenant-sentinel`) is a real-time
credit-monitoring agent built for the **You.com Agentic hackathon** (AWS Builder Loft, SF ·
Fri Jul 24 2026). It watches the live web for events that threaten a borrower's financial
covenant, does cited deep research via the You.com Research API (ARI), recomputes the covenant
ratio on its own books, flags the drift, routes it to a human analyst to sign off, and — only
after attestation — issues a reservation-of-rights breach notice to the covenant register.

**The one truth on screen:** a borrower's compliance certificate reads **GREEN 6.47×**; the
kernel's recompute reads **BREACH 7.59×**. The killer failure mode it catches is a borrower
quietly restating its accounts so a covenant silently breaches while the dashboard stays green.

> ENID (a private-markets debt-monitoring platform) is the **use-case named in the pitch only** —
> never an integration. The prototype is fully self-contained: all borrower data is **synthetic
> fixtures**, and all code was written fresh during the event.

## The shape of the system

The whole strategy is to **front-load all risk into a deterministic, offline, testable core**,
then wrap it in You.com, then harden it. That produces a clean layering:

```
        ┌──────────────────────── web-demo-platform ────────────────────────┐
        │  Express app.ts · landing launcher · Sentinel desk · demo auto-mount │
        └───────────────┬───────────────────────────────┬────────────────────┘
                        │ POST /api/scan, /api/attest    │ auto-mounts demos/<slug>/
                ┌───────▼─────────── scan-orchestration ─▼──────────┐
                │  scan.ts — fires You.com, runs the kernel,         │
                │  attaches citations, emits scoreboard, attests     │
                └───┬──────────┬──────────┬──────────┬──────────┬────┘
                    │          │          │          │          │
        youcom-integration     │   scoreboard-labels │   synthetic-corpus
        (Search + ARI +        │   (event feed +      │   (6 fixtures + oracle +
         labeled fallback)     │    honesty labels)   │    schema + PRERUN cache)
                               │                      │
                    ┌──────────▼──────────┐   ┌───────▼───────────┐
                    │   covenant-kernel   │   │ attestation-gate  │
                    │   assess() — pure   │──▶│ attest() → commit │
                    │   recompute-never-  │   │ → executeCommitted│
                    │   trust             │   │ (the only effect) │
                    └─────────────────────┘   └───────────────────┘

        eval-harness verifies every layer (51 tests, 10 gates) ·
        infrastructure builds & deploys it (tsx + Render)
```

No LLM and no network sit in the money-shot: the flip is plain arithmetic over local JSON, which
is exactly what makes it trustworthy on stage. You.com makes it *live*; the attest gate makes it
*safe*.

## Domains (organized by business function)

| Domain | Files | Role | Coupling |
|---|---|---|---|
| [covenant-kernel](../maps/covenant-kernel/index.md) | 7 | The pure deterministic assessment core — the money-shot | 0.08 |
| [attestation-gate](../maps/attestation-gate/index.md) | 1 | Human DENY/ATTEST gate + the only side-effecting serve | 0.10 |
| [scoreboard-labels](../maps/scoreboard-labels/index.md) | 1 | Event feed + LIVE/PRERUN/SYNTHETIC honesty discipline | 0.10 |
| [youcom-integration](../maps/youcom-integration/index.md) | 3 | You.com Search + ARI, with labeled offline fallback | 0.35 |
| [scan-orchestration](../maps/scan-orchestration/index.md) | 1 | Wires You.com + kernel + gate + scoreboard into the scan | 0.40 |
| [synthetic-corpus](../maps/synthetic-corpus/index.md) | 9 | 6-borrower corpus, oracle, Facts schema, PRERUN cache | 0.20 |
| [web-demo-platform](../maps/web-demo-platform/index.md) | 12 | Express server, UIs, drop-in mini-demo auto-loader | 0.50 |
| [eval-harness](../maps/eval-harness/index.md) | 8 | 51 tests reproducing the 10 build-loop gates + scripts | 0.30 |
| [infrastructure](../maps/infrastructure/index.md) | 7 | tsx/ESM toolchain, Render Blueprint, env contract | 0.15 |

## The five load-bearing ideas

1. **Recompute, never trust.** The kernel forms its own ratio from raw `measures[]` and never adopts
   a certified number, a stated EBITDA total, or a self-certified status. See
   [ADR-0002](../decisions/0002-recompute-never-trust.md).
2. **The flip is basis precedence, not a special case.** One test date carries two observations of
   the same quarter on different bases; `audited_restated` outranks `borrower_certified`, so the
   period *is* a breach the moment the restatement exists. See
   [ADR-0003](../decisions/0003-basis-precedence-resolution.md).
3. **Drift compares the field map, not the values.** A silent `EBITDA → "Adjusted EBITDA"` rename is
   caught by fingerprinting `(canonical_key → raw_name)` pairs where a value diff sees an ordinary
   quarter. See [ADR-0004](../decisions/0004-field-map-fingerprint-drift.md).
4. **Writes are structurally unreachable without a human ATTEST.** The downstream serve cannot be
   reached without a `CommittedWrite`, which only `attest()` on an `ATTEST` decision produces. See
   [ADR-0005](../decisions/0005-human-attest-gate.md).
5. **Exactly one honesty label per effect.** LIVE (fired now), PRERUN (a genuine cached receipt),
   SYNTHETIC (corpus data). The UI reads the label off the record, never a slide. See
   [ADR-0006](../decisions/0006-honesty-label-discipline.md).

## Where to go next

- **30,000 ft** — this document + [bootstrap chain](bootstrap-chain.md) + [tech stack](tech-stack.md)
- **5,000 ft** — the nine [domain maps](../maps/covenant-kernel/index.md)
- **Ground level** — the [file cards](../cards/covenant-kernel/assess.md)
- **Runtime** — the [data flows](data-flows.md) and the [Facts data model](database-schema.md)
- **Decisions** — the [inferred ADRs](../decisions/0001-deterministic-offline-core.md)
- **Migration** — the [readiness overview](../migration/readiness-overview.md)
