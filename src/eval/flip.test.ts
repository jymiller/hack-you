// ★ GATE 3 — "the flip" (BUILD-LOOP step 3). Written before any kernel code.
// Certificate says COMPLIANT 6.47x; assess() recomputes 7.59x BREACH off the restated facts.
// This is the one gate that says the demo is real.

import { describe, expect, it } from "vitest";
import { assess } from "../kernel/assess.js";
import { withMemory } from "../corpus.js";
import { certificateFor, findCovenant } from "./helpers.js";

const NOW = "2026-07-24T09:00:00Z";

describe("★ the flip — certificate GREEN, recompute BREACH", () => {
  it("Thornwick total_net_leverage: cert 6.47x IN_COMPLIANCE, assess() 7.59x BREACH", () => {
    const { bundle, memory } = withMemory("thornwick");
    const covenant = findCovenant(bundle, "total_net_leverage");
    const certificate = certificateFor(bundle, "q1-2026", "total_net_leverage");

    const a = assess(bundle, covenant, certificate, memory, { now: NOW });

    // The certificate the borrower filed
    expect(certificate?.certified_result?.certified_value).toBe(6.47);
    expect(certificate?.certified_result?.certified_status).toBe("IN_COMPLIANCE");

    // The kernel's own recompute off the authoritative (audited_restated) basis
    expect(a.authoritative_basis).toBe("audited_restated");
    expect(a.recomputed_value).toBe(7.59);
    expect(a.status).toBe("BREACH");

    // THE FLIP: certified says in-compliance, the kernel says breach
    const flip = certificate?.certified_result?.certified_status === "IN_COMPLIANCE" && a.status === "BREACH";
    expect(flip).toBe(true);

    // …and the kernel records the conflict rather than adopting the certified number
    expect(a.certified.certification_conflict).toBe(true);
    expect(a.certified.certified_value).toBe(6.47);
  });
});
