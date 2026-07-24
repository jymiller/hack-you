// KERNEL-SPEC §11 — totality matrix. The kernel is TOTAL: a data fault yields a Finding with
// errors[], never a throw, and INDETERMINATE is never silently PASS.

import { describe, expect, it } from "vitest";
import { assess } from "../kernel/assess.js";
import { withMemory } from "../corpus.js";
import { findCovenant } from "./helpers.js";
import type { Covenant, FactsBundle, MemoryContext } from "../kernel/types.js";

const NOW = "2026-07-24T09:00:00Z";
const EMPTY_MEM: MemoryContext = { self: null, bySponsor: () => [] };

function ctx(bundle: FactsBundle) {
  const cov = findCovenant(bundle, "total_net_leverage");
  const cert = null;
  return { bundle, cov };
}

describe("§11 — totality / error matrix", () => {
  it("UNKNOWN_PERIOD: no period matches", () => {
    const { bundle, memory } = withMemory("thornwick");
    const { cov } = ctx(bundle);
    const a = assess(bundle, cov, null, memory, { now: NOW, target_period_id: "no-such-period" });
    expect(a.status).toBe("INDETERMINATE");
    expect(a.errors[0].code).toBe("UNKNOWN_PERIOD");
    expect(a.proposed_write).toBeNull();
  });

  it("UNKNOWN_COVENANT_TYPE: metric outside the enum", () => {
    const { bundle, memory } = withMemory("thornwick");
    const badCov = { ...findCovenant(bundle, "total_net_leverage"), metric: "bogus_metric" } as unknown as Covenant;
    const a = assess(bundle, badCov, null, memory, { now: NOW, target_period_id: "q1-2026" });
    expect(a.status).toBe("INDETERMINATE");
    expect(a.errors[0].code).toBe("UNKNOWN_COVENANT_TYPE");
  });

  it("NO_EFFECTIVE_THRESHOLD: test_date outside every stepdown window", () => {
    const { bundle, memory } = withMemory("thornwick");
    const cov: Covenant = { ...findCovenant(bundle, "total_net_leverage"), thresholds: [{ value: 6.5, effective_from: "2020-01-01", effective_to: "2020-12-31" }] };
    const a = assess(bundle, cov, null, memory, { now: NOW, target_period_id: "q1-2026" });
    expect(a.status).toBe("INDETERMINATE");
    expect(a.errors[0].code).toBe("NO_EFFECTIVE_THRESHOLD");
  });

  it("DIVIDE_BY_ZERO: denominator resolves to 0", () => {
    // Synthetic one-off bundle: EBITDA 0.
    const bundle = zeroDenBundle();
    const cov = bundle.covenants[0];
    const a = assess(bundle, cov, null, EMPTY_MEM, { now: NOW, target_period_id: "p1" });
    expect(a.status).toBe("INDETERMINATE");
    expect(a.errors[0].code).toBe("DIVIDE_BY_ZERO");
  });

  it("MISSING_INPUT: a covenant input does not resolve at all", () => {
    const bundle = zeroDenBundle();
    // remove the numerator measure entirely, no build → unresolved
    bundle.periods[0].observations[0].measures = bundle.periods[0].observations[0].measures.filter((m) => m.key !== "total_net_debt");
    const a = assess(bundle, bundle.covenants[0], null, EMPTY_MEM, { now: NOW, target_period_id: "p1" });
    expect(a.status).toBe("INDETERMINATE");
    expect(a.errors[0].code).toBe("MISSING_INPUT");
  });

  it("STALE_INPUT_UNBACKED: a stale covenant input with no build is INDETERMINATE, not a silent PASS — but records the stale_fallback source and fires drift", () => {
    const bundle = staleUnbackedBundle();
    const a = assess(bundle, bundle.covenants[0], null, EMPTY_MEM, { now: NOW, target_period_id: "p1" });
    expect(a.status).toBe("INDETERMINATE");
    expect(a.errors[0].code).toBe("STALE_INPUT_UNBACKED");
    // §3: the stale_fallback source is still recorded on the Finding
    expect(a.ratio.numerator_source).toBe("stale_fallback");
    // §5b: drift fires loudly for the stale carry-forward
    expect(a.drift.detected).toBe(true);
    expect(a.drift.kinds).toContain("stale_carry_forward");
    // never a silent green
    expect(a.status).not.toBe("PASS");
  });
});

// ---- synthetic one-off bundles (not part of the SYNTHETIC corpus) -------
function baseBundle(): FactsBundle {
  return {
    schema_version: "1.0.0",
    facts_id: "edge-case",
    provenance_label: "SYNTHETIC",
    units: { currency: "GBP", magnitude: "millions", ratio_decimals: 2 },
    basis_precedence: ["audited_restated", "raw_financials", "management_accounts", "borrower_certified"],
    borrower: { borrower_id: "edge", legal_name: "Edge Co" },
    covenants: [
      {
        covenant_id: "total_net_leverage",
        metric: "total_net_leverage",
        direction: "max",
        formula: { numerator_key: "total_net_debt", denominator_key: "consolidated_ebitda", rounding: { mode: "half_up", decimals: 2 } },
        thresholds: [{ value: 5.0, effective_from: "2020-01-01", effective_to: null }],
        watch_rule: null,
      },
    ],
    periods: [
      {
        period_id: "p1",
        test_date: "2026-03-31",
        sequence: 0,
        observations: [
          {
            observation_id: "o1",
            basis: "borrower_certified",
            as_of: "2026-04-01",
            provenance_label: "SYNTHETIC",
            measures: [
              { key: "total_net_debt", value: 200, raw_name: "Total Net Debt", state: "observed" },
              { key: "consolidated_ebitda", value: 0, raw_name: "Consolidated EBITDA", state: "observed" },
            ],
          },
        ],
      },
    ],
    documents: [],
  };
}

function zeroDenBundle(): FactsBundle {
  return baseBundle();
}

function staleUnbackedBundle(): FactsBundle {
  const b = baseBundle();
  // prior period establishes the field map; current period carries the covenant numerator as a
  // STALE carry-forward with no ebitda_build to reconstruct from.
  b.periods = [
    {
      period_id: "p0",
      test_date: "2025-12-31",
      sequence: 0,
      observations: [
        {
          observation_id: "o0",
          basis: "borrower_certified",
          as_of: "2026-01-01",
          provenance_label: "SYNTHETIC",
          measures: [
            { key: "total_net_debt", value: 200, raw_name: "Total Net Debt", state: "observed" },
            { key: "consolidated_ebitda", value: 50, raw_name: "Consolidated EBITDA", state: "observed" },
          ],
        },
      ],
    },
    {
      period_id: "p1",
      test_date: "2026-03-31",
      sequence: 1,
      observations: [
        {
          observation_id: "o1",
          basis: "borrower_certified",
          as_of: "2026-04-01",
          provenance_label: "SYNTHETIC",
          measures: [
            { key: "total_net_debt", value: 200, raw_name: null, state: "stale", stale_from_period_id: "p0" },
            { key: "consolidated_ebitda", value: 50, raw_name: "Consolidated EBITDA", state: "observed" },
          ],
          // no ebitda_build → nothing to reconstruct the stale numerator from
        },
      ],
    },
  ];
  return b;
}
