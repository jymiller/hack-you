---
type: decision
id: ADR-0004
title: Detect schema drift by fingerprinting the field map, not the values
status: inferred
date_inferred: 2026-07-24
scope: domain
affects: ["covenant-kernel"]
migration_impact: none
migration_notes: "Portable as a standalone schema-drift detector for any time-series of extracted records."
---

# ADR-0004 · Field-map fingerprint drift detection

## Context

A borrower can silently rename a line item — `EBITDA → "Adjusted EBITDA"` — and move the value a
plausible amount. A value-only comparison sees an ordinary quarter and stays green, while a covenant
is quietly held up by a substituted or carried-forward number.

## Decision

Detect drift by comparing the **field map** — the set of `(canonical_key → raw_name)` pairs plus the
unmapped raw names — not the values. The fingerprint is a `sha256` over the sorted map, **recomputed**
from the observation (never trusting the stored `field_map_fingerprint`). Three kinds fire:
`unmapped_field` (a source row matched no key), `stale_carry_forward` (a covenant input is stale or
unmapped), and `field_rename` (a key's `raw_name` changed vs. the prior period). Drift runs on **every**
assessment, including PASS, because a rename can *hold* a covenant green.

## Consequences

- Northgate: values hold (`38→40` plausible) but the map moves → drift detected, and the reconstruct-
  from-build path yields the true 1.33× BREACH instead of the naive 1.52× PASS.
- Thornwick is the deliberate contrast: values restated, fingerprint unchanged → **no** drift.
- The data model must carry `raw_name`, `state`, and `unmapped_fields[]` on every measure/observation.

## Evidence

`docs/KERNEL-SPEC.md` §5, `src/kernel/drift.ts`, `fixtures/northgate.json` vs `fixtures/thornwick.json`,
`gates.test.ts` (Northgate drift+breach). See the [drift card](../cards/covenant-kernel/drift.md).
