// Test/eval helpers: build the Certificate input the kernel checks against, and
// locate periods/covenants. The certificate is the borrower's own claim for a period —
// an input to be checked, never an input to the classification.

import type { Basis, Certificate, Covenant, FactsBundle, Period } from "../kernel/types.js";

export function findCovenant(bundle: FactsBundle, covenant_id: string): Covenant {
  const c = bundle.covenants.find((x) => x.covenant_id === covenant_id);
  if (!c) throw new Error(`No covenant '${covenant_id}' in ${bundle.facts_id}`);
  return c;
}

export function findPeriod(bundle: FactsBundle, period_id: string): Period {
  const p = bundle.periods.find((x) => x.period_id === period_id);
  if (!p) throw new Error(`No period '${period_id}' in ${bundle.facts_id}`);
  return p;
}

// The certificate for (period, covenant) = the borrower_certified observation plus its
// certified_result entry for that covenant. Null when no certificate was filed.
export function certificateFor(bundle: FactsBundle, period_id: string, covenant_id: string): Certificate | null {
  const p = findPeriod(bundle, period_id);
  const obs = p.observations.find((o) => o.basis === "borrower_certified");
  if (!obs) return null;
  const cr = (obs.certified_results ?? []).find((r) => r.covenant_id === covenant_id) ?? null;
  return { period_id, observation_id: obs.observation_id, certified_result: cr };
}

// Force a specific basis to the top of precedence so a chosen observation becomes
// authoritative — used by the oracle to verify each per-basis expected_assessment row.
export function pinBasis(bundle: FactsBundle, basis: Basis): Basis[] {
  const rest = bundle.basis_precedence.filter((b) => b !== basis);
  return [basis, ...rest];
}
