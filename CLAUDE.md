# hack-you

This is the **hack-you** build repo for the **You.com Agentic hackathon (Fri Jul 24, 2026)**.

**Start by reading `HANDOFF.md`** (gitignored) — the concept, demo script, and day-of plan — then
**`BUILD-LOOP.md`** (committed) — the step-by-step build sequence: three phases (CORE → FACE → HARDEN)
and the gated steps you build in order, each ending on one check.

- ENID is the **use case only** — never an integration. Self-contained prototype, **synthetic
  fixtures**, and **all code written fresh during the event**.
- Keys live in `.env` (gitignored). **Never commit `.env` or real keys.** `.env.example` holds
  placeholders only.
- Never commit or push without John's explicit confirmation.
