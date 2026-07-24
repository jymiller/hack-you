---
type: atlas
title: Data Model — the Facts bundle (there is no SQL database)
last_analyzed: 2026-07-24
---

# Data Model

Covenant Sentinel has **no SQL database**. Its "schema" is a JSON Schema
(`prerun/covenant-facts.schema.json`, `$id .../covenant-facts/v1.json`, version **1.0.0**) and its
"tables" are six SYNTHETIC JSON fixtures in `fixtures/`, read from disk per request. This document
maps that data model the way an ER doc would map tables — it is the closest analogue to a database
schema in this codebase.

The kernel's TypeScript types (`src/kernel/types.ts`) are re-typed by hand from this schema and are
the authoritative runtime shape. The kernel treats a `FactsBundle` as **read-only input**.

## Entity hierarchy (the "tables")

A **FactsBundle** is the whole normalized book for **one borrower**. Nesting, top to bottom:

```
FactsBundle (one per borrower; the file in fixtures/)
├─ units                     currency, magnitude, ratio_decimals
├─ basis_precedence[]        the truth-resolution order (most authoritative first)
├─ borrower                  legal_name, sector, sponsor{sponsor_id,name}, auditors[], facility
├─ covenants[]               ← Covenant
│   ├─ metric (enum) + direction (max|min)
│   ├─ formula {numerator_key, denominator_key, rounding}
│   ├─ thresholds[]          dated stepdown windows {value, effective_from, effective_to}
│   └─ watch_rule            {headroom_absolute?, headroom_pct?, deteriorating_periods?}
├─ periods[]                 ← Period
│   ├─ test_date, sequence
│   ├─ observations[]        ← Observation  (one per basis, per period)
│   │   ├─ basis (enum), as_of, provenance_label
│   │   ├─ measures[]        ← Measure {key, value, raw_name, state, source_doc_id}
│   │   ├─ unmapped_fields[] source rows that matched no canonical key (drift signal)
│   │   ├─ field_map_fingerprint   (a stored CLAIM; the kernel recomputes its own)
│   │   ├─ ebitda_build      ← EbitdaBuild {base, add_backs[], adjustments[], total}
│   │   └─ certified_results[]  ← CertifiedResult (the borrower's claim, per covenant)
│   └─ expected_assessment[] ← the ORACLE (test-only; assess() must never read it)
├─ documents[]               provenance-labeled source docs with sha256 fingerprints
├─ events[]                  the live-web trigger rows (LIVE at runtime; SYNTHETIC placeholder in fixtures)
└─ memory                    {sponsor_id, pattern_tags[], related_deals[]}  ← cross-deal join
```

## The relationships that matter

- **Covenant → Measure (by key).** `covenant.formula.numerator_key` / `denominator_key` are
  `MeasureKey`s that the kernel `resolve()`s against the authoritative observation's `measures[]`.
  This is the join that computes the ratio.
- **Period → Observation (by basis).** A single `test_date` can carry **multiple observations of
  the same quarter** on different bases. `basis_precedence` orders them; the highest-ranked wins.
  This one-to-many is the entire money-shot: Thornwick's `q1-2026` holds both a `borrower_certified`
  (6.47×) and an `audited_restated` (7.59×) observation.
- **Observation → EbitdaBuild → AddBack.** `add_back.allowed` (`true|false|null`) is the single most
  important field in the data: `recomputeEbitda` sums **only `allowed === true`**. `null`
  (unadjudicated) and `false` (disallowed) contribute nothing — the line that drops the disallowed
  synergy.
- **FactsBundle → memory.sponsor_id → sibling FactsBundle.** The cross-deal join key is
  `sponsor_id`. `buildMemoryContext` indexes every bundle by sponsor so `memory.bySponsor(id)`
  returns siblings; `consultMemory` matches a shared disallowed add-back category.
- **Observation → Measure.raw_name → drift.** Drift is detected over the *map* of
  `(canonical_key → raw_name)` pairs, not the values. A rename with an unchanged value trips it.

## Enumerations (the fixed vocabulary)

| Enum | Values |
|---|---|
| `provenance_label` | `SYNTHETIC` · `LIVE` · `PRERUN` |
| `basis` | `borrower_certified` · `management_accounts` · `raw_financials` · `audited_restated` · `agent_recomputed` |
| `CovenantMetric` | `total_net_leverage` · `senior_net_leverage` · `interest_cover` · `debt_service_cover` · `fixed_charge_cover` |
| `direction` | `max` (leverage ceiling) · `min` (cover-ratio floor) |
| `MeasureKey` | 17 keys incl. `consolidated_ebitda`, `adjusted_ebitda`, `total_net_debt`, `cash_interest`, `net_finance_charges`, `debt_service`, `cfads`, … |
| `AddBack.category` | `run_rate_synergy` · `exceptional_restructuring` · `transaction_advisory` · `non_cash` · `pro_forma_acquisition` · `other` |
| `measure.state` | `observed` · `derived` · `missing` · `stale` |
| `Status` | `PASS` · `WATCH` · `BREACH` · `INDETERMINATE` |

## The "tables" (fixtures) grouped by mechanism

Each fixture is one borrower with a distinct failure mechanism and its own baked `expected_assessment[]`
oracle. All six are `provenance_label: SYNTHETIC`.

| Fixture file | Borrower (invented) | Sponsor | Covenant(s) | Mechanism |
|---|---|---|---|---|
| `thornwick.json` | Thornwick Logistics | Ardenmoor | `total_net_leverage`, `interest_cover` | restatement over time → **6.47×→7.59×** (the money-shot) |
| `halveston.json` | Halveston Services | Ardenmoor | `hv-leverage` | prior cross-deal precedent → 5.38×→6.22×, same disallowed add-back |
| `northgate.json` | Northgate Airport | Castlereach | `interest-cover` | schema drift / silent rename → 1.52×→1.33×, `ebitda→adjusted_ebitda` |
| `borrower-c.json` | Marrowfield Water | Brackwater | `dscr_floor` | under-reporting → DSCR 1.24× vs 1.08×, self-certifies "IN COMPLIANCE" |
| `borrower-a.json` | Merribrook | Calderhythe | `total-net-leverage`, `interest-cover` | control — clean PASS |
| `borrower-b.json` | Brenmark Grid | Cindermere | `total_net_leverage` | watch — leverage creep 4.0→4.2→4.4× (WATCH on trend) |

Note the **id inconsistency**: covenant/period ids differ per fixture (underscores vs hyphens vs
bespoke like `hv-leverage`, `dscr_floor`). The kernel keys off `covenant.metric` (a fixed enum), so
these ids are free-form labels, not contracts. `borrower-c.json` carries `facts_id:
"marrowfield-water"`; `halveston.json` carries `facts_id: "halveston-services"`.

## Tenant scoping

There is no multi-tenant column model. The unit of isolation is **one `FactsBundle` = one borrower**
= one file. Cross-borrower access is *only* via the deliberate `sponsor_id` memory join, which
`buildMemoryContext` scopes to siblings (excluding self). See the
[synthetic-corpus map](../maps/synthetic-corpus/index.md) and the
[ER diagram](../diagrams/data-engineer/entity-relationships.html).

## Documents & fingerprints

`documents[]` carries provenance-labeled source docs (credit agreement, compliance certificates,
audited accounts, restatement note) each with a `sha256` fingerprint. In the fixtures the fingerprint
is a **deterministic placeholder** — `sha256('SYNTHETIC-PLACEHOLDER|<doc_id>|<title>|<doc_date>')` —
because no real file exists to hash; it hashes a declared string rather than pretending to hash a
document. `events[]` similarly holds a SYNTHETIC placeholder (`retrieved_via: "manual"`, a
non-resolving URL) that the live You.com result replaces at runtime.
