---
type: decision
id: ADR-0007
title: Cross-deal memory joins on sponsor_id via an injected resolver
status: inferred
date_inferred: 2026-07-24
scope: domain
affects: ["covenant-kernel", "synthetic-corpus"]
migration_impact: low
migration_notes: "The MemoryContext interface is the extension point; back it with a DB query instead of an in-memory index for scale."
---

# ADR-0007 · Cross-deal sponsor memory

## Context

Part of the pitch is that the agent *remembers across deals* — recognizing that the same sponsor
pulled the same trick on another borrower years earlier. This is retrieval across separate data
bundles, which a large context window cannot fake.

## Decision

Join on **`sponsor_id`**. `consultMemory` fires when a finding is BREACH or a disallowed add-back
drove the number, then matches sibling bundles that share the sponsor *and* exhibit the same
disallowed add-back category. Crucially, cross-bundle retrieval is via an **injected**
`MemoryContext = { self, bySponsor(id) }` — the kernel never reaches for a corpus itself;
`buildMemoryContext` (in `corpus.ts`) supplies the index. The demo hit is Thornwick (Ardenmoor) →
Halveston (same sponsor, same disallowed run-rate synergy, two years earlier).

## Consequences

- The kernel stays pure and the memory join is testable in isolation.
- Memory fires on the `audited_restated` basis (where `allowed==false` is known), not on the certified
  basis (`allowed==null`) — matching the oracle exactly.
- The join keys off `sponsor_id`, so a `related_deals[].facts_id` mismatch in the fixtures (Thornwick
  says `"halveston"`, the fixture is `"halveston-services"`) still produces the hit; only the extra
  relation labels don't join. Flagged in the fixture note.
- Scaling to a real corpus means backing `bySponsor` with a query, not an in-memory Map.

## Evidence

`docs/KERNEL-SPEC.md` §6, `src/kernel/memory.ts`, `src/corpus.ts`, `fixtures/thornwick.json` +
`fixtures/halveston.json`. See the [memory card](../cards/covenant-kernel/memory.md).
