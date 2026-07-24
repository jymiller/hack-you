// The kernel. Pure. No I/O, no writes, no clock except the injected `now`.
// assess(facts, covenant, certificate, memory, ctx) → Assessment. Never throws for data faults;
// returns a Finding with errors[] instead (the kernel is total).

import { classify, headroom, selectThreshold, type WatchTrendPoint } from "./classify.js";
import { detectDrift, fingerprint } from "./drift.js";
import { consultMemory } from "./memory.js";
import { recomputeEbitda, resolve } from "./recompute.js";
import { round, sha1Hex } from "./util.js";
import type {
  AssessCtx,
  Assessment,
  Basis,
  Certificate,
  Covenant,
  ErrorCode,
  FactsBundle,
  MemoryContext,
  Observation,
  Period,
  ProposedWrite,
  Status,
} from "./types.js";

const VALID_METRICS = new Set([
  "total_net_leverage",
  "senior_net_leverage",
  "interest_cover",
  "debt_service_cover",
  "fixed_charge_cover",
]);

function normalizeStatus(s: Status): "IN_COMPLIANCE" | "NOT_IN_COMPLIANCE" | "INDETERMINATE" {
  if (s === "BREACH") return "NOT_IN_COMPLIANCE";
  if (s === "INDETERMINATE") return "INDETERMINATE";
  return "IN_COMPLIANCE"; // PASS / WATCH
}

function seqOf(p: Period): number {
  return p.sequence ?? 0;
}

// Highest-basis observation for a period under an ordering; ties broken by latest as_of.
function resolveAuthoritative(period: Period, order: Basis[]): Observation | null {
  const ranked = period.observations
    .map((o) => ({ o, rank: order.indexOf(o.basis) }))
    .filter((x) => x.rank !== -1)
    .sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : b.o.as_of.localeCompare(a.o.as_of)));
  return ranked[0]?.o ?? period.observations[0] ?? null;
}

// The same-basis observation from the most recent earlier period (for drift + trend).
function priorSameBasis(bundle: FactsBundle, period: Period, basis: Basis): Observation | null {
  const earlier = bundle.periods
    .filter((p) => seqOf(p) < seqOf(period))
    .sort((a, b) => seqOf(b) - seqOf(a));
  for (const p of earlier) {
    const obs = p.observations.find((o) => o.basis === basis);
    if (obs) return obs;
  }
  return null;
}

interface Recomputed {
  value: number | null;
  num: ReturnType<typeof resolve>;
  den: ReturnType<typeof resolve>;
  error: ErrorCode | null;
}

function recomputeRatio(obs: Observation, covenant: Covenant): Recomputed {
  const num = resolve(obs, covenant.formula.numerator_key);
  const den = resolve(obs, covenant.formula.denominator_key);
  if (num.source === "unresolved" || den.source === "unresolved") {
    return { value: null, num, den, error: "MISSING_INPUT" };
  }
  // §11: a stale carry-forward with no build to reconstruct from must NOT be consumed — the whole
  // schema-drift thesis is "never go green on a carried-forward number." INDETERMINATE, not silent PASS.
  if (num.source === "stale_fallback" || den.source === "stale_fallback") {
    return { value: null, num, den, error: "STALE_INPUT_UNBACKED" };
  }
  if (den.value === 0) {
    return { value: null, num, den, error: "DIVIDE_BY_ZERO" };
  }
  const value = round(num.value! / den.value!, covenant.formula.rounding);
  return { value, num, den, error: null };
}

// Trend series for the deteriorating-periods watch rule: recompute this covenant on each period's
// authoritative observation, oldest→newest up to and including the current period.
function buildTrend(bundle: FactsBundle, covenant: Covenant, upto: Period, order: Basis[]): WatchTrendPoint[] {
  return bundle.periods
    .filter((p) => seqOf(p) <= seqOf(upto))
    .sort((a, b) => seqOf(a) - seqOf(b))
    .map((p) => {
      const obs = resolveAuthoritative(p, order);
      const value = obs ? recomputeRatio(obs, covenant).value : null;
      return { period_id: p.period_id, test_date: p.test_date, value };
    });
}

function gatherEvidence(bundle: FactsBundle, obs: Observation, ctxEventIds?: string[]): Assessment["evidence"] {
  const docIds = new Set<string>();
  if (obs.source_doc_id) docIds.add(obs.source_doc_id);
  for (const m of obs.measures) if (m.source_doc_id) docIds.add(m.source_doc_id);

  const events = (bundle.events ?? []).filter(
    (e) =>
      (ctxEventIds && ctxEventIds.includes(e.event_id)) ||
      (e.derived_observation_ids ?? []).includes(obs.observation_id)
  );
  const event_ids = events.map((e) => e.event_id);
  const citations = events.flatMap((e) =>
    (e.sources ?? []).map((s) => ({
      url: s.url,
      title: s.title ?? null,
      publisher: s.publisher ?? null,
      snippet: s.snippet ?? null,
    }))
  );
  return { source_doc_ids: [...docIds], event_ids, citations };
}

// An INDETERMINATE Finding (the kernel is total — a data fault is a Finding, never a throw).
// Optionally records what WAS resolved (basis, ratio sources, drift) so an unbacked-stale input is
// INDETERMINATE per §11 yet still carries the stale_fallback source (§3) and its loud drift signal.
function indeterminate(
  bundle: FactsBundle,
  covenant: Covenant,
  period: Period | null,
  now: string,
  code: ErrorCode,
  message: string,
  field: string | null,
  detail?: { basis?: Basis; ratio?: Assessment["ratio"]; drift?: Assessment["drift"] }
): Assessment {
  return {
    assessment_id: sha1Hex(`${bundle.borrower.borrower_id}|${covenant.covenant_id}|${period?.period_id ?? "?"}|indeterminate|${code}`),
    schema_version: "1.0.0",
    generated_at: now,
    borrower_id: bundle.borrower.borrower_id,
    covenant_id: covenant.covenant_id,
    period_id: period?.period_id ?? "",
    test_date: period?.test_date ?? "",
    authoritative_basis: detail?.basis ?? null,
    status: "INDETERMINATE",
    recomputed_value: null,
    headroom: null,
    threshold: null,
    ratio: detail?.ratio ?? {
      numerator_key: covenant.formula.numerator_key,
      numerator_value: null,
      numerator_source: "unresolved",
      denominator_key: covenant.formula.denominator_key,
      denominator_value: null,
      denominator_source: "unresolved",
      rounding: covenant.formula.rounding ?? { mode: "half_up", decimals: 2 },
    },
    recompute: {
      ebitda_build_present: false,
      recomputed_ebitda: null,
      stated_total: null,
      recompute_delta: null,
      disallowed_add_backs: [],
      adjustments_applied: [],
    },
    certified: {
      present: false,
      certified_value: null,
      certified_status: null,
      certified_status_verbatim: null,
      certification_conflict: null,
      delta_vs_recompute: null,
    },
    drift: detail?.drift ?? { detected: false, kinds: [], current_fingerprint: null, prior_observation_id: null, details: [] },
    memory: { consulted: false, hit: false, matches: [] },
    watch: { evaluated: false, triggered_by: [], headroom_value: null, trend: [] },
    evidence: { source_doc_ids: [], event_ids: [], citations: [] },
    labels: { facts: bundle.provenance_label, recompute: "LIVE", downstream_serve: "SYNTHETIC" },
    provenance_label: bundle.provenance_label,
    proposed_write: null,
    errors: [{ code, message, field }],
    warnings: [],
  };
}

export function assess(
  facts: FactsBundle,
  covenant: Covenant,
  certificate: Certificate | null,
  memory: MemoryContext,
  ctx: AssessCtx
): Assessment {
  const now = ctx.now;
  const order = ctx.precedence_override ?? facts.basis_precedence;

  // 1 — locate period
  const periodId = certificate?.period_id ?? ctx.target_period_id;
  const period = facts.periods.find((p) => p.period_id === periodId) ?? null;
  if (!period) {
    return indeterminate(facts, covenant, null, now, "UNKNOWN_PERIOD", `No period '${periodId}'`, "period_id");
  }

  // 2 — validate covenant type
  if (!VALID_METRICS.has(covenant.metric) || (covenant.direction !== "max" && covenant.direction !== "min")) {
    return indeterminate(facts, covenant, period, now, "UNKNOWN_COVENANT_TYPE", `Unknown metric/direction`, "metric");
  }

  // 3 — authoritative observation (under the possibly-overridden ordering)
  const obs = resolveAuthoritative(period, order);
  if (!obs) {
    return indeterminate(facts, covenant, period, now, "NO_OBSERVATION", `Period has no observations`, "observations");
  }

  // 4 — threshold for test_date
  const threshold = selectThreshold(covenant, period.test_date);
  if (!threshold) {
    return indeterminate(facts, covenant, period, now, "NO_EFFECTIVE_THRESHOLD", `No threshold covers ${period.test_date}`, "thresholds");
  }

  // 5 — recompute the ratio
  const rc = recomputeRatio(obs, covenant);

  // 6 — drift (runs even on PASS/INDETERMINATE — a stale/renamed input is caught here loudly)
  const drift = detectDrift(obs, priorSameBasis(facts, period, obs.basis), covenant);

  const rounding = covenant.formula.rounding ?? { mode: "half_up" as const, decimals: 2 };
  const ratioDetail: Assessment["ratio"] = {
    numerator_key: covenant.formula.numerator_key,
    numerator_value: rc.num.value,
    numerator_source: rc.num.source,
    denominator_key: covenant.formula.denominator_key,
    denominator_value: rc.den.value,
    denominator_source: rc.den.source,
    rounding,
  };

  if (rc.error) {
    // INDETERMINATE, but record the resolved sources + drift so nothing is lost (§3/§5b/§11).
    return indeterminate(facts, covenant, period, now, rc.error, `Ratio unresolved (${rc.error})`, null, {
      basis: obs.basis,
      ratio: ratioDetail,
      drift,
    });
  }
  const value = rc.value!;

  // 7 — classify
  const trend = buildTrend(facts, covenant, period, order);
  const cls = classify(value, threshold.value, covenant.direction, covenant.watch_rule, trend);
  const status = cls.status;

  // recompute-delta finding (the "never trust the stated total" check)
  const build = obs.ebitda_build;
  const recomputedEbitda = build ? recomputeEbitda(build) : null;
  const disallowed = (build?.add_backs ?? [])
    .filter((ab) => ab.allowed === false)
    .map((ab) => ({ add_back_id: ab.add_back_id, category: ab.category, amount: ab.amount, disallowed_reason: ab.disallowed_reason ?? null }));

  // 8 — memory
  const mem = consultMemory(facts, covenant, obs, status, memory);

  // 9 — certification conflict (PERIOD-LEVEL: the certificate's claim vs the status the kernel
  //     resolves on the NATURAL precedence for the period, independent of any pin/override).
  const cr = certificate?.certified_result ?? null;
  const naturalObs = resolveAuthoritative(period, facts.basis_precedence);
  const naturalStatus = naturalObs ? classify(
    recomputeRatio(naturalObs, covenant).value ?? NaN,
    threshold.value,
    covenant.direction,
    covenant.watch_rule,
    buildTrend(facts, covenant, period, facts.basis_precedence)
  ).status : status;
  const certification_conflict =
    cr && cr.certified_status !== "NOT_STATED" && naturalStatus !== "INDETERMINATE"
      ? normalizeStatus(naturalStatus) !== cr.certified_status
      : cr ? false : null;

  // 10 — proposed write (WATCH/BREACH only; ALWAYS inert)
  const evidence = gatherEvidence(facts, obs, ctx.event_ids);
  const proposed_write =
    status === "BREACH" || status === "WATCH"
      ? buildProposedWrite(facts, covenant, period, obs, status, value, threshold.value, drift.current_fingerprint, cr, evidence, now)
      : null;

  return {
    assessment_id: sha1Hex(`${facts.borrower.borrower_id}|${covenant.covenant_id}|${period.period_id}|${obs.basis}|${value}`),
    schema_version: "1.0.0",
    generated_at: now,
    borrower_id: facts.borrower.borrower_id,
    covenant_id: covenant.covenant_id,
    period_id: period.period_id,
    test_date: period.test_date,
    authoritative_basis: obs.basis,
    status,
    recomputed_value: value,
    headroom: cls.headroom,
    threshold: {
      value: threshold.value,
      direction: covenant.direction,
      effective_from: threshold.effective_from,
      effective_to: threshold.effective_to ?? null,
    },
    ratio: ratioDetail,
    recompute: {
      ebitda_build_present: !!build,
      recomputed_ebitda: recomputedEbitda,
      stated_total: build?.total_amount ?? null,
      recompute_delta: build && recomputedEbitda != null ? round(recomputedEbitda - build.total_amount, { mode: "half_up", decimals: 4 }) : null,
      disallowed_add_backs: disallowed,
      adjustments_applied: (build?.adjustments ?? []).map((adj) => ({ adjustment_id: adj.adjustment_id, type: adj.type, amount: adj.amount })),
    },
    certified: {
      present: !!cr,
      certified_value: cr?.certified_value ?? null,
      certified_status: cr?.certified_status ?? null,
      certified_status_verbatim: cr?.certified_status_verbatim ?? null,
      certification_conflict,
      delta_vs_recompute: cr?.certified_value != null ? round(cr.certified_value - value, { mode: "half_up", decimals: 4 }) : null,
    },
    drift,
    memory: mem,
    watch: cls.watch,
    evidence,
    labels: { facts: bundle_facts_label(facts, obs), recompute: "LIVE", downstream_serve: "SYNTHETIC" },
    provenance_label: facts.provenance_label,
    proposed_write,
    errors: [],
    warnings: [],
  };
}

function bundle_facts_label(facts: FactsBundle, obs: Observation): Assessment["labels"]["facts"] {
  return obs.provenance_label ?? facts.provenance_label;
}

function buildProposedWrite(
  facts: FactsBundle,
  covenant: Covenant,
  period: Period,
  obs: Observation,
  status: Status,
  value: number,
  threshold: number,
  fingerprintValue: string | null,
  cr: Certificate["certified_result"],
  evidence: Assessment["evidence"],
  now: string
): ProposedWrite {
  const fp = fingerprintValue ?? fingerprint(obs);
  const fromStatus: Status = cr?.certified_status === "IN_COMPLIANCE" ? "PASS" : cr?.certified_status === "NOT_IN_COMPLIANCE" ? "BREACH" : "PASS";
  const dir = covenant.direction;
  const cmp = dir === "max" ? "above" : "below";
  const certPart = cr?.certified_value != null ? `Certificate reported ${cr.certified_value}x (${cr.certified_status}); ` : "";
  const rationale = `${certPart}kernel recomputes ${covenant.label ?? covenant.metric} = ${value}x ${cmp} the ${threshold}x limit on the ${obs.basis} basis → ${status}.`;
  return {
    proposal_id: sha1Hex(`${facts.borrower.borrower_id}|${covenant.covenant_id}|${period.period_id}|${status}|${fp}|${value}`),
    created_at: now,
    kind: status === "BREACH" ? "breach_notice" : "watch_flag",
    target: { borrower_id: facts.borrower.borrower_id, covenant_id: covenant.covenant_id, period_id: period.period_id, test_date: period.test_date },
    from_status: fromStatus,
    to_status: status,
    recomputed_value: value,
    threshold: { value: threshold, direction: dir },
    rationale,
    evidence,
    downstream: { channel: "covenant_register", template: "reservation_of_rights", target_ref: `synthetic:${facts.borrower.borrower_id}`, dry_run: true },
    requires_attestation: true,
    attestation_state: "PENDING",
    provenance_label: "SYNTHETIC",
  };
}
