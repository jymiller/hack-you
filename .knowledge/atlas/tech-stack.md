---
type: atlas
title: Technology Stack
last_analyzed: 2026-07-24
---

# Technology Stack

A deliberately small, dependency-light stack. The design goal is a self-contained prototype with a
deterministic core that runs offline; the only heavy dependency is a single HTTP framework.

## Runtime & language

| Concern | Choice | Notes |
|---|---|---|
| Language | **TypeScript 5.7**, `strict` | `target ES2022`, `module NodeNext`, `noEmit` |
| Runtime | **Node ≥ 20** | needed for `process.loadEnvFile` and global `fetch` |
| Execution | **tsx 4.19** | runs `.ts` directly (ESM), no build step; also transpiles demo `routes.ts` on import |
| Module system | **ESM** (`"type":"module"`) | imports use `.js` extensions; `import.meta.url` for paths |

## Dependencies (`package.json`)

**Runtime dependencies — only two:**

- `express ^4.21.2` — the HTTP server + router (the one framework in the stack).
- `tsx ^4.19.2` — TypeScript executor (a runtime dependency, because production runs `.ts` directly).

**Dev dependencies:**

- `vitest ^2.1.8` — the test runner (51 assertions).
- `typescript ^5.7.2` — `tsc --noEmit` typecheck only.
- `@types/express`, `@types/node`.

There is **no ORM, no database driver, no LLM SDK, no HTTP client library.** You.com is called with
the built-in `fetch`; the "database" is JSON on disk.

## External services

| Service | Role | How it's called |
|---|---|---|
| **You.com Search** | fresh live-web headline | `GET https://ydc-index.io/v1/search` (`freshness`, `livecrawl`), header `X-API-Key` |
| **You.com Research (ARI)** | cited structured brief | `POST https://api.you.com/v1/research` (`background:true` → `task_id`, polled) |
| **You.com Billing** | remaining credit ("really live" proof) | `GET https://api.you.com/v1/billing/account_balance` |
| **Render** | hosts the deployed service | `render.yaml` Blueprint, `npm ci` → `npm start` |
| **AWS** | the venue (Builder Loft) + a deploy target | `.env.example` carries placeholder AWS keys |
| **Opsera** | optional pre-deploy security scan (side-quest) | day-of, no key committed |

One You.com key, two hosts: **Search + Contents** at `ydc-index.io/v1/*`; **Research (ARI) +
Finance/Billing** at `api.you.com/v1/*`. They must not be mixed. See the
[youcom-integration map](../maps/youcom-integration/index.md).

## Data layer

There is no SQL database. The data contract is a JSON Schema
(`prerun/covenant-facts.schema.json`, v1.0.0) and the data is six SYNTHETIC fixtures in `fixtures/`,
loaded synchronously with `readFileSync` + `JSON.parse`. A genuine cached ARI response
(`prerun/ari-lender-response-standard.json`) is the PRERUN receipt. See the
[Facts data model](database-schema.md).

## Frontend

Plain **HTML + inline CSS + vanilla JS** — no framework, no bundler, no external assets. Each page
(`web/index.html`, `web/app.html`, `demos/*/page.html`) is self-contained and fetches the JSON API.

## Build, test, deploy

| Task | Command |
|---|---|
| Run the server | `npm start` → `tsx src/server/app.ts` (http://localhost:8080) |
| Watch dev | `npm run dev` → `tsx watch src/server/app.ts` |
| Tests (the gates) | `npm test` → `vitest run` (51 assertions) |
| Offline money-shot | `npm run demo` → `tsx scripts/demo.ts` |
| Live You.com smoke | `npm run smoke` → `tsx scripts/youcom-smoke.ts` |
| Typecheck | `npm run typecheck` → `tsc --noEmit` |
| Deploy | Render Blueprint (`render.yaml`), health check `/api/health` |

## Current vs. outdated

Everything is current (2026-era): TypeScript 5.7, Node 20+, Express 4.21, vitest 2.1. Nothing here
is legacy. The notable *intentional* constraints are (a) `render.yaml` defaults to Render's **free**
plan, which cold-starts after idle — the deploy guide recommends bumping to Starter for the live
demo; and (b) the in-memory `sessions` Map means a Render restart or a second instance loses scan
state (fine for a single-instance demo, a blocker for horizontal scale).
