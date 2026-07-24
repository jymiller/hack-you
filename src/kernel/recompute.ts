// §2 — "recompute, never trust". Build the EBITDA from measures; substitute the kernel's own
// reconstruction exactly when a field fails to resolve (stale / renamed / missing).

import type { EbitdaBuild, MeasureKey, Observation, SourceKind } from "./types.js";

export interface Resolved {
  value: number | null;
  source: SourceKind;
}

// total = base + sum(add_backs where allowed===true) + sum(signed adjustments).
// null (unadjudicated) and false (disallowed) add-backs contribute nothing — the single line
// that drops disallowed synergies.
export function recomputeEbitda(build: EbitdaBuild): number {
  let total = build.base_amount;
  for (const ab of build.add_backs ?? []) {
    if (ab.allowed === true) total += ab.amount;
  }
  for (const adj of build.adjustments ?? []) {
    total += adj.amount;
  }
  return total;
}

const EBITDA_KEYS = new Set<MeasureKey>(["consolidated_ebitda", "adjusted_ebitda"]);

// resolve(observation, key): read the field cleanly if it resolved from the document; otherwise
// reconstruct EBITDA from the build; otherwise fall back to a stale value (raising a drift signal);
// otherwise UNRESOLVED.
export function resolve(obs: Observation, key: MeasureKey): Resolved {
  const m = obs.measures.find((x) => x.key === key);
  const state = m?.state ?? "observed";

  // (2) clean measure — the field resolved from the document
  if (m && m.value != null && state === "observed" && m.raw_name != null) {
    return { value: m.value, source: "measure" };
  }

  // (3) reconstruct from the EBITDA build when the covenant needs an EBITDA that didn't resolve
  const build = obs.ebitda_build;
  if (build && (key === build.total_key || key === build.base_key || EBITDA_KEYS.has(key))) {
    return { value: recomputeEbitda(build), source: "reconstructed_build" };
  }

  // (4) stale carry-forward — a numeric value survives but the field name did not resolve
  if (m && m.value != null) {
    return { value: m.value, source: "stale_fallback" };
  }

  // (5) nothing to stand on
  return { value: null, source: "unresolved" };
}
