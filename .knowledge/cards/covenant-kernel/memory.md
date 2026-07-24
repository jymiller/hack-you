---
type: card
module: covenant-kernel
file: src/kernel/memory.ts
complexity: medium
lines: 77
last_analyzed: 2026-07-24
migration:
  global_refs: []
  session_keys_read: []
  session_keys_written: []
  db_tables_touched: ["sibling FactsBundles (via injected MemoryContext.bySponsor)"]
  side_effects: []
  singleton_pattern: false
  extractable: true
  extraction_notes: "Pure. Cross-bundle retrieval is via the injected MemoryContext interface — the kernel never reaches for a corpus itself."
---

# `src/kernel/memory.ts` — cross-deal sponsor memory

Proves *retrieval across bundles* — something a big context window cannot fake. The join key is
`sponsor_id`; the demo hit is **Thornwick (sponsor Ardenmoor) → Halveston** (same sponsor, same
disallowed run-rate synergy, two years earlier).

## `consultMemory(facts, _covenant, obs, status, memory) → MemoryResult`

1. `disallowed = disallowedCategories(obs)` — the set of `add_back.category` where `allowed === false`
   in this observation's build.
2. `consulted = status === "BREACH" || disallowed.size > 0`. If not consulted → `{consulted:false,
   hit:false, matches:[]}`.
3. `sponsorId = facts.borrower.sponsor?.sponsor_id`; absent → no hit.
4. **Candidates** = `memory.bySponsor(sponsorId)` (siblings) filtered to those sharing the sponsor
   *or* named in `memory.self.related_deals[]`.
5. For each candidate, `siblingExhibits(sib, disallowed)` scans every observation for a disallowed
   add-back in a matching category. On a match, record `relation[]` (always `["same_sponsor"]`, plus
   any `related_deals` relations that join by `facts_id`/`borrower_id`), `pattern_tags`, and
   `shared_add_back_category`.
6. `hit = matches.length > 0`.

## The consulted gate matters for the oracle

Memory fires on the **audited_restated** basis (where `tw-syn.allowed == false` is known), matching
`expect_memory_hit=true` on Thornwick's restated row; it does **not** fire on the `borrower_certified`
basis (`allowed == null`, disallowal not yet adjudicated). That's exactly the fixture oracle.

## The injected `MemoryContext`

`memory` is `{ self: Memory | null, bySponsor(sponsor_id): FactsBundle[] }`, supplied by
[`corpus.ts`](../synthetic-corpus/corpus.md)'s `buildMemoryContext`. The kernel never reads the
filesystem or the corpus — retrieval is a dependency the caller injects. This keeps the kernel pure
and makes the memory join testable in isolation.

## The `related_deals` facts_id caveat

Thornwick's `related_deals` name `facts_id: "halveston"` but the actual fixture is
`"halveston-services"`. Because candidates are gathered by **`sponsor_id`** (not `facts_id`), the hit
still fires — the mismatch only means the extra `related_deals` relation labels don't join, so
`relation` stays `["same_sponsor"]`. Documented in the
[synthetic-corpus map](../../maps/synthetic-corpus/index.md).

## Depends on

`types.ts`. Consumed by [`assess.ts`](assess.md). Related:
[ADR-0007](../../decisions/0007-cross-deal-sponsor-memory.md).
