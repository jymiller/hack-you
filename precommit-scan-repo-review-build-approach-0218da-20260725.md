# Pre-Commit Security Scan — repo-review-build-approach-0218da

**Date:** 2026-07-25 · **Verdict:** ✅ **SAFE TO COMMIT** — no new security issues introduced by the staged changes.
**Scanners:** gitleaks · npm audit · grype · semgrep · checkov · hadolint (Opsera DevSecOps, pre-commit mode)

## Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 6 |
| 🟠 High | 22 |
| 🟡 Medium | 28 |
| 🟢 Low | 0 |
| **Total** | **56** |

| Origin | Count |
|---|---|
| 🆕 New (this commit's changed lines) | **0** |
| 📋 Existing (already committed) | 56 |

**Risk score:** 79.7/100 (Critical Risk) — driven entirely by pre-existing dev-dependency CVEs.

**Staged in this commit:** `demos/research/page.html` (two buttons + three sample query strings).
Zero findings map to it — semgrep reported 0 results repo-wide, and the file appears only in
`paths.scanned`, not in any finding.

## Findings by category

### 🔐 Secrets — gitleaks: **0 findings** ✅
No credentials in the working tree. Notable given the repo carries `.env.example`, a Render blueprint
declaring secret names, and a symlinked `.env` — all secrets stay in the environment, never in git.

### 🧠 SAST — semgrep: **0 findings** ✅
No injection, XSS, path-traversal or unsafe-pattern findings in first-party application code
(`src/`, `demos/`, `scripts/`, `web/`).

### 📦 Dependencies — grype: 6 Critical / 22 High / 28 Medium
All in **dev/build tooling under `node_modules/`**, none in runtime application code.

| Sev | ID | Package | Location |
|---|---|---|---|
| 🔴 Critical | GO-2024-2887 | stdlib go1.20.12 | `node_modules/vite/node_modules/esbuild/bin/esbuild` |
| 🔴 Critical | GO-2026-4337 | stdlib go1.20.12 | `node_modules/vite/node_modules/esbuild/bin/esbuild` |
| 🔴 Critical | GO-2025-3563 | stdlib go1.20.12 | `node_modules/vite/node_modules/@esbuild/darwin-arm64` |

*Remediation:* these are the Go runtime statically linked into the prebuilt `esbuild` binary that ships
inside `vite` (a transitive dev dependency of `vitest`). They are not reachable from the deployed
service — `npm ci` on Render installs production dependencies and the server runs `express` + `tsx`
only. Fix by upgrading `vitest`/`vite` when convenient; no production exposure.

### 📦 Dependencies — npm audit: 1 Critical / 1 High / 3 Moderate
| Sev | Package | Direct? | Issue |
|---|---|---|---|
| 🔴 Critical | `vitest` | dev | `@vitest/mocker` — arbitrary file read when the Vitest UI server is listening |
| 🟠 High | `vite` | transitive | Path traversal in optimized-deps `.map` handling |

*Remediation:* `npm audit fix --force` upgrades `vitest`. Both require a **locally running dev server**
to exploit; neither ships to production. Deferred deliberately rather than risk a test-runner upgrade
immediately before a demo.

### 🏗 IaC — checkov: **0 findings** ✅
`render.yaml` declares both API keys with `sync: false` (dashboard secrets, never committed).

### 🐳 Containers — hadolint: **not applicable**
No Dockerfile in the repo; the service deploys via Render's native Node runtime.

## Gate decision

**ALLOW.** The gate blocks only on Critical/High findings on lines changed in this commit — there are
none. All 56 findings are pre-existing and confined to dev-only dependencies with no production
reachability. Warning recorded; commit proceeds.
