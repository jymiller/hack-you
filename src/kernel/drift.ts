// §5 — drift detection compares the field MAP, not the values. A silent rename holds a covenant
// green while the underlying number moves; only comparing (canonical_key → raw_name) reveals it.

import { sha256Hex } from "./util.js";
import type { Assessment, Covenant, DriftKind, Observation } from "./types.js";

// (canonical_key → raw_name) pairs for measures that resolved, plus the unmapped raw names.
function fieldMapLines(obs: Observation): string[] {
  const mapped = obs.measures
    .filter((m) => m.raw_name != null)
    .map((m) => `${m.key}:${m.raw_name}`)
    .sort();
  const unmapped = (obs.unmapped_fields ?? []).map((u) => u.raw_name).sort();
  return [...mapped, ...unmapped];
}

// Recomputed, not trusted from the record — a stored hash is a claim like any other.
export function fingerprint(obs: Observation): string {
  return sha256Hex(fieldMapLines(obs).join("\n"));
}

export type DriftResult = Assessment["drift"];

export function detectDrift(obs: Observation, priorObs: Observation | null, covenant: Covenant): DriftResult {
  const kinds = new Set<DriftKind>();
  const details: DriftResult["details"] = [];
  const current_fingerprint = fingerprint(obs);
  const prior_fingerprint = priorObs ? fingerprint(priorObs) : null;

  // (a) unmapped_field — a source row matched no canonical key. Hard alarm.
  const unmapped = (obs.unmapped_fields ?? []).map((u) => u.raw_name);
  if (unmapped.length > 0) {
    kinds.add("unmapped_field");
    details.push({
      kind: "unmapped_field",
      canonical_key: null,
      prior_raw_name: null,
      current_raw_name: null,
      unmapped_raw_names: unmapped,
      prior_fingerprint,
      note: `${unmapped.length} source row(s) matched no canonical key: ${unmapped.join(", ")}`,
    });
  }

  // (b) stale_carry_forward — a measure the covenant USES failed to resolve and was carried forward.
  const used = new Set([covenant.formula.numerator_key, covenant.formula.denominator_key]);
  for (const m of obs.measures) {
    if (!used.has(m.key)) continue;
    if (m.state === "stale" || m.raw_name == null) {
      kinds.add("stale_carry_forward");
      details.push({
        kind: "stale_carry_forward",
        canonical_key: m.key,
        prior_raw_name: null,
        current_raw_name: m.raw_name,
        unmapped_raw_names: [],
        prior_fingerprint,
        note: `covenant input '${m.key}' is ${m.state ?? "unmapped"}${
          m.stale_from_period_id ? ` (carried from ${m.stale_from_period_id})` : ""
        }`,
      });
    }
  }

  // (c) field_rename — same basis, prior period, fingerprint changed, and a canonical key's
  //     raw_name moved. Not a value change — a MAP change.
  if (priorObs && prior_fingerprint !== current_fingerprint) {
    const priorByKey = new Map(priorObs.measures.filter((m) => m.raw_name != null).map((m) => [m.key, m.raw_name!]));
    for (const m of obs.measures) {
      if (m.raw_name == null) continue;
      const prior = priorByKey.get(m.key);
      if (prior != null && prior !== m.raw_name) {
        kinds.add("field_rename");
        details.push({
          kind: "field_rename",
          canonical_key: m.key,
          prior_raw_name: prior,
          current_raw_name: m.raw_name,
          unmapped_raw_names: [],
          prior_fingerprint,
          note: `'${m.key}' renamed '${prior}' → '${m.raw_name}' vs prior period`,
        });
      }
    }
  }

  return {
    detected: kinds.size > 0,
    kinds: [...kinds],
    current_fingerprint,
    prior_observation_id: priorObs?.observation_id ?? null,
    details,
  };
}
