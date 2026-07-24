---
type: card
module: synthetic-corpus
file: src/corpus.ts
complexity: low
lines: 48
last_analyzed: 2026-07-24
migration:
  global_refs: []
  session_keys_read: []
  session_keys_written: []
  db_tables_touched: ["fixtures/*.json (readFileSync)"]
  side_effects: ["synchronous filesystem reads of fixtures/"]
  singleton_pattern: false
  extractable: true
  extraction_notes: "Extractable; the only impurity is readFileSync of fixtures/. No caching — each loadCorpus() re-reads all files. Fine at corpus scale."
---

# `src/corpus.ts` — loader + cross-deal memory index

Reads the six SYNTHETIC fixtures and builds the `MemoryContext` the kernel needs. The runtime side of
the cross-deal memory join.

## Functions

| Function | Role |
|---|---|
| `loadBundle(file)` | `readFileSync(join(FIXTURES_DIR, file))` + `JSON.parse` → `FactsBundle` |
| `loadCorpus()` | `readdirSync(fixtures).filter(.json).sort().map(loadBundle)` → `FactsBundle[]` |
| `buildMemoryContext(self, corpus)` | index bundles by `sponsor_id`; return `{ self: self.memory, bySponsor(id) }` where `bySponsor` excludes `self` (by `facts_id`) |
| `withMemory(factsId)` | load the corpus, find the bundle by `facts_id` **or** `borrower_id`, return `{ bundle, memory }` |

`FIXTURES_DIR` is resolved from `import.meta.url` (`../fixtures`).

## The memory index

`buildMemoryContext` walks the corpus once, bucketing bundles into a `Map<sponsor_id, FactsBundle[]>`.
`bySponsor(id)` returns the bucket minus self. This is what turns "Thornwick's sponsor is Ardenmoor"
into "here are Ardenmoor's other deals" — without the kernel ever touching the filesystem. See
[`memory.ts`](../covenant-kernel/memory.md).

## Notes

- **No caching.** Every `loadCorpus()` re-reads and re-parses all six files. The corpus sweep
  (`/api/corpus`) and the Data explorer each call it per request — negligible at this scale, a place
  to add a cache if the corpus grew.
- **`withMemory` matches on `facts_id` OR `borrower_id`** — so `withMemory("thornwick")` works even
  though the bundle's `facts_id` is also `"thornwick"` (some fixtures differ, e.g. `borrower-c.json`
  has `facts_id: "marrowfield-water"` with `borrower_id: "marrowfield"`).

## Depends on

`node:fs`, `node:path`, `node:url`, `types.ts`. Consumed by
[`scan.ts`](../scan-orchestration/scan.md), [`app.ts`](../web-demo-platform/app.md),
[`demos/data/routes.ts`](../../maps/web-demo-platform/index.md), and the tests. Related:
[ADR-0007](../../decisions/0007-cross-deal-sponsor-memory.md),
[ADR-0011](../../decisions/0011-synthetic-fixtures-oracle.md).
