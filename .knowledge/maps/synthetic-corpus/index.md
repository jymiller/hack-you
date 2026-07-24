---
type: module
name: synthetic-corpus
display_name: Synthetic Corpus & Data Contract
status: active
file_locations:
  entry_points: ["src/corpus.ts"]
  controllers: ["src/corpus.ts (loadCorpus, buildMemoryContext, withMemory)"]
  models: ["prerun/covenant-facts.schema.json"]
  services: []
  views: []
  tests: ["src/eval/oracle.test.ts"]
  config: []
  data: ["fixtures/thornwick.json", "fixtures/halveston.json", "fixtures/northgate.json", "fixtures/borrower-a.json", "fixtures/borrower-b.json", "fixtures/borrower-c.json", "prerun/ari-lender-response-standard.json"]
patterns:
  - type: JSON fixture with embedded expected_assessment[] oracle
    count: 6
    example: fixtures/thornwick.json
  - type: filesystem loader (readdir + JSON.parse)
    count: 1
    example: src/corpus.ts
  - type: in-memory index by join key (sponsor_id)
    count: 1
    example: src/corpus.ts (buildMemoryContext)
dependencies:
  internal: ["covenant-kernel (FactsBundle, MemoryContext)"]
  external: ["node:fs", "node:path", "node:url"]
  database_tables: ["fixtures/*.json"]
migration:
  coupling_score: 0.20
  session_dependencies: 0
  global_dependencies: 0
  singleton_dependencies: []
  pattern_consistency: 0.85
  abstraction_boundary: clean
  testability: high
  estimated_effort: small
  blockers: ["synchronous readFileSync per load (no caching)"]
---

# Synthetic Corpus & Data Contract

The data layer. Six SYNTHETIC borrower fixtures — each carrying its own `expected_assessment[]`
oracle — plus the JSON Schema they conform to, the loader that reads them, and the genuine cached
ARI response used as the PRERUN receipt. There is no SQL database
([data model](../../atlas/database-schema.md)).

## The six borrowers (each a distinct mechanism)

| Fixture | Borrower | Sponsor | Covenant(s) | Mechanism → flip |
|---|---|---|---|---|
| `thornwick.json` | Thornwick Logistics | Ardenmoor | `total_net_leverage`, `interest_cover` | restatement over time → **6.47×→7.59×** (money-shot) |
| `halveston.json` | Halveston Services | Ardenmoor | `hv-leverage` | prior cross-deal precedent → 5.38×→6.22× |
| `northgate.json` | Northgate Airport | Castlereach | `interest-cover` | schema drift / silent rename → 1.52×→1.33× |
| `borrower-c.json` | Marrowfield Water | Brackwater | `dscr_floor` | under-reporting → DSCR 1.24× vs **1.08×** |
| `borrower-a.json` | Merribrook | Calderhythe | `total-net-leverage`, `interest-cover` | control — clean PASS |
| `borrower-b.json` | Brenmark Grid | Cindermere | `total_net_leverage` | watch — creep 4.0→4.2→4.4× (WATCH on trend) |

Every entity is invented; all amounts are GBP millions. The largest fixture (`northgate.json`, 833
lines) carries the drift beat; the money-shot (`thornwick.json`, 735 lines) carries two observations
of the same quarter on different bases.

## `src/corpus.ts` — loader + memory index

| Function | Role |
|---|---|
| `loadBundle(file)` | `readFileSync` + `JSON.parse` one fixture |
| `loadCorpus()` | read all `fixtures/*.json`, sorted, into `FactsBundle[]` |
| `buildMemoryContext(self, corpus)` | index bundles by `sponsor_id`; `bySponsor(id)` returns siblings **excluding self** |
| `withMemory(factsId)` | convenience: load the corpus and return `{ bundle, memory }` for one borrower |

`buildMemoryContext` is the runtime side of the cross-deal memory join — it supplies the
`MemoryContext` the kernel needs without the kernel ever reaching for a corpus. See
[ADR-0007](../../decisions/0007-cross-deal-sponsor-memory.md).

## The data contract — `prerun/covenant-facts.schema.json` (v1.0.0)

A JSON Schema (`$id .../covenant-facts/v1.json`) with 18 `$defs` (`borrower`, `covenant`, `period`,
`observation`, `measure`, `ebitda_build`, `add_back`, `adjustment`, `certified_result`,
`expected_assessment`, `document`, `event`, `memory`, …). The kernel's `types.ts` is re-typed by hand
from this schema; both are kept in lockstep by the oracle test. The schema is documented as the
[data model](../../atlas/database-schema.md).

## The oracle — `expected_assessment[]`

Each period embeds an oracle array: per `(covenant_id, basis)`, the `expected_value`,
`expected_status`, and the `expect_drift_detected` / `expect_certification_conflict` /
`expect_memory_hit` flags. `oracle.test.ts` re-derives every row by pinning each basis and asserting
`assess()` matches. **`assess()` must never read `expected_assessment`** — it is a test oracle only.
See [ADR-0011](../../decisions/0011-synthetic-fixtures-oracle.md).

## The PRERUN cache — `prerun/ari-lender-response-standard.json`

A **genuine** You.com ARI response captured 2026-07-23 (13.3s, `standard`, 8 real sources: Proskauer,
Sidley, Paul Weiss, …). Labeled `PRERUN`. Loaded by `youcom.ts`'s `prerunAriFallback` when the live
call is off/fails. It is explicitly **not a mock** — that is why it may carry the PRERUN label.

## A known data inconsistency (documented, not a runtime bug)

Thornwick's `memory.related_deals[].facts_id` says `"halveston"` while the Halveston fixture's actual
`facts_id` is `"halveston-services"` (and Halveston points back at `"thornwick-logistics"`, not
`"thornwick"`). The memory join keys off **`sponsor_id`** (`ardenmoor`), not `facts_id`, so the
memory hit still fires correctly; the mismatch only means the extra `related_deals` relation
enrichment doesn't join, leaving `["same_sponsor"]` as the relation. Thornwick's fixture note flags
this as a forward reference to reconcile.

## Related

Cards: [`corpus.ts`](../../cards/synthetic-corpus/corpus.md) ·
[`thornwick.json`](../../cards/synthetic-corpus/thornwick-fixture.md) ·
[`covenant-facts.schema.json`](../../cards/synthetic-corpus/covenant-facts-schema.md).
