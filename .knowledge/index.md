---
type: atlas
title: Covenant Sentinel — Knowledge Base (agent entry point)
last_analyzed: 2026-07-24
---

# Covenant Sentinel — Knowledge Base

Agent entry point. This `.knowledge/` directory documents the **hack-you / Covenant Sentinel**
codebase (You.com Agentic hackathon). Humans should open [`index.html`](index.html); agents should
read the Markdown, which carries structured YAML frontmatter.

**What the app is:** a real-time credit-monitoring agent with a deterministic covenant-monitoring
kernel at its heart. It recomputes a borrower's covenant ratio on its own books, catches a certificate
that reads **GREEN 6.47×** while the recompute reads **BREACH 7.59×**, does cited You.com research,
routes the finding to a human to attest, and — only after sign-off — issues a breach notice to the
covenant register. All borrower data is SYNTHETIC.

## Lookup order (for agents)

1. **System shape** → [`atlas/overview.md`](atlas/overview.md) — the nine domains, the layering, the
   five load-bearing ideas.
2. **How it boots** → [`atlas/bootstrap-chain.md`](atlas/bootstrap-chain.md).
3. **A specific domain** → the [`maps/`](maps/covenant-kernel/index.md) table below.
4. **A specific file** → the [`cards/`](cards/covenant-kernel/assess.md) for that file.
5. **Why it's built this way** → the [`decisions/`](decisions/0001-deterministic-offline-core.md).
6. **How data moves at runtime** → [`atlas/data-flows.md`](atlas/data-flows.md).
7. **The data contract** → [`atlas/database-schema.md`](atlas/database-schema.md).
8. **Extraction / reuse readiness** → [`migration/readiness-overview.md`](migration/readiness-overview.md).

## Domain map

| Domain | Map | What lives there |
|---|---|---|
| Covenant Kernel | [maps/covenant-kernel](maps/covenant-kernel/index.md) | `src/kernel/{assess,recompute,classify,drift,memory,types,util}.ts` |
| Attestation Gate | [maps/attestation-gate](maps/attestation-gate/index.md) | `src/kernel/attest.ts` |
| Scoreboard & Labels | [maps/scoreboard-labels](maps/scoreboard-labels/index.md) | `src/kernel/scoreboard.ts` |
| You.com Integration | [maps/youcom-integration](maps/youcom-integration/index.md) | `src/server/youcom.ts`, `demos/youcom/` |
| Scan Orchestration | [maps/scan-orchestration](maps/scan-orchestration/index.md) | `src/server/scan.ts` |
| Synthetic Corpus | [maps/synthetic-corpus](maps/synthetic-corpus/index.md) | `fixtures/`, `src/corpus.ts`, `prerun/` |
| Web & Demo Platform | [maps/web-demo-platform](maps/web-demo-platform/index.md) | `src/server/app.ts`, `web/`, `demos/` |
| Evaluation Harness | [maps/eval-harness](maps/eval-harness/index.md) | `src/eval/`, `scripts/` |
| Infrastructure | [maps/infrastructure](maps/infrastructure/index.md) | `package.json`, `render.yaml`, `tsconfig.json` |

## Atlas documents

- [overview.md](atlas/overview.md) — system-wide module inventory (30,000 ft)
- [bootstrap-chain.md](atlas/bootstrap-chain.md) — process start → ready to serve
- [conventions.md](atlas/conventions.md) — coding standards, honesty-label taxonomy, build discipline
- [tech-stack.md](atlas/tech-stack.md) — languages, dependencies, external services
- [data-flows.md](atlas/data-flows.md) — the money-shot + attest + kernel pipeline traces
- [database-schema.md](atlas/database-schema.md) — the Facts JSON data model (no SQL DB)

## Decisions (inferred ADRs)

[0001 deterministic offline core](decisions/0001-deterministic-offline-core.md) ·
[0002 recompute-never-trust](decisions/0002-recompute-never-trust.md) ·
[0003 basis-precedence resolution](decisions/0003-basis-precedence-resolution.md) ·
[0004 field-map fingerprint drift](decisions/0004-field-map-fingerprint-drift.md) ·
[0005 human attest gate](decisions/0005-human-attest-gate.md) ·
[0006 honesty-label discipline](decisions/0006-honesty-label-discipline.md) ·
[0007 cross-deal sponsor memory](decisions/0007-cross-deal-sponsor-memory.md) ·
[0008 You.com two endpoints + fallback](decisions/0008-youcom-two-endpoints-fallback.md) ·
[0009 mini-demo auto-mount](decisions/0009-mini-demo-auto-mount.md) ·
[0010 kernel totality](decisions/0010-kernel-totality.md) ·
[0011 synthetic fixtures with oracle](decisions/0011-synthetic-fixtures-oracle.md) ·
[0012 single service on Render](decisions/0012-single-service-render-deploy.md)

## Facts about this KB

- **9 domains · 6 atlas docs · 9 maps · 17 file cards · 12 decisions · 5 diagrams · 4 migration docs.**
- Source of truth is Markdown; `index.html` and the diagram pages are derived and self-contained.
- All internal links are relative (work via `file://` and the `_server.js` dev server).
- Serve it: `node .knowledge/_server.js` then open `http://localhost:4173`.
