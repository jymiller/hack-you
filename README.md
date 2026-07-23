# hack-you

**ENID Covenant Sentinel** — build repo for the You.com Agentic hackathon (AWS Builder Loft, SF · Fri Jul 24, 2026).

A real-time agent that watches the live web — news, filings, markets — for events that threaten a
borrower's financial covenant, does **cited** deep research via the You.com Research API (ARI),
flags the drift, routes it to a human analyst to sign off, and (post-attestation) serves a notice
via ActionLayer. The killer failure mode it catches: a borrower quietly restating its accounts so a
covenant silently breaches while the dashboard stays green.

## The pattern

ENID (a private-markets debt-monitoring platform) is the **use case named in the pitch only** — never
an integration. The prototype is fully self-contained: all data is **synthetic fixtures**, and all
code in this repo is **written fresh during the event** (fresh repo per event).

## Setup

```bash
cp .env.example .env   # then fill in real keys (.env is gitignored)
```

## Vendor stack

- **You.com** — Research API (ARI) for cited deep research; Search/Contents for live-web freshness.
- **Novita** — reasoning LLM + DeepSeek-OCR, and the opencode build harness (OpenAI-compatible).
- **ActionLayer** — last-mile serve-notice rail (run PRERUN on stage).
- **AWS** — venue and deploy target (Builder Loft credits).

## Private prep

Detailed plan, demo script, and day-of notes live in `HANDOFF.md` (gitignored — start there in a new
session) and in the sibling `hackathon-prep` repo.
