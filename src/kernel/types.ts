// Covenant Sentinel — type shapes.
// Retyped fresh from docs/KERNEL-SPEC.md (§1, §3, §7) and prerun/covenant-facts.schema.json (v1.0.0).
// The kernel treats a FactsBundle as read-only input and returns an Assessment. Pure — no I/O.

export type Provenance = "SYNTHETIC" | "REAL" | "PRERUN";

export type Basis =
  | "borrower_certified"
  | "management_accounts"
  | "raw_financials"
  | "audited_restated"
  | "agent_recomputed";

export type Status = "PASS" | "WATCH" | "BREACH" | "INDETERMINATE";

export type MeasureKey =
  | "consolidated_ebitda"
  | "adjusted_ebitda"
  | "revenue"
  | "operating_profit"
  | "total_net_debt"
  | "senior_net_debt"
  | "gross_debt"
  | "term_loan"
  | "revolver_drawn"
  | "cash_and_equivalents"
  | "cash_interest"
  | "net_finance_charges"
  | "scheduled_amortisation"
  | "debt_service"
  | "cfads"
  | "cure_amount";

export type CovenantMetric =
  | "total_net_leverage"
  | "senior_net_leverage"
  | "interest_cover"
  | "debt_service_cover"
  | "fixed_charge_cover";

export type Direction = "max" | "min";

export type RoundingMode = "half_up" | "half_even" | "truncate";
export interface Rounding {
  mode: RoundingMode;
  decimals: number;
}

export interface Units {
  currency: string;
  magnitude: "units" | "thousands" | "millions";
  ratio_decimals?: number;
}

// ---- Facts bundle (schema v1.0.0) ---------------------------------------

export interface Sponsor {
  sponsor_id: string;
  name: string;
}

export interface Borrower {
  borrower_id: string;
  legal_name: string;
  short_name?: string;
  sector?: string;
  jurisdiction?: string;
  sponsor?: Sponsor | null;
  agent?: { name: string; role?: string } | null;
  auditors?: Array<{ name: string; financial_year_end?: string; report_signed_on?: string }>;
  facility?: { facility_name?: string; agreement_date?: string; agreement_doc_id?: string } | null;
}

export interface WatchRule {
  headroom_absolute?: number | null;
  headroom_pct?: number | null;
  deteriorating_periods?: number | null;
}

export interface Threshold {
  value: number;
  effective_from: string;
  effective_to?: string | null;
}

export interface Covenant {
  covenant_id: string;
  label?: string;
  metric: CovenantMetric;
  direction: Direction;
  formula: {
    numerator_key: MeasureKey;
    denominator_key: MeasureKey;
    rounding?: Rounding;
  };
  thresholds: Threshold[];
  watch_rule?: WatchRule | null;
  clause_ref?: string;
  source_doc_id?: string;
  cure?: unknown;
}

export interface Measure {
  key: MeasureKey;
  value: number | null;
  raw_name: string | null;
  raw_label?: string | null;
  unit?: string | null;
  sign_convention?: "as_stated" | "negated";
  state?: "observed" | "derived" | "missing" | "stale";
  stale_from_period_id?: string | null;
  source_doc_id?: string | null;
  source_locator?: string | null;
}

export interface AddBack {
  add_back_id: string;
  label?: string;
  category:
    | "run_rate_synergy"
    | "exceptional_restructuring"
    | "transaction_advisory"
    | "non_cash"
    | "pro_forma_acquisition"
    | "other";
  limb_ref?: string;
  amount: number;
  allowed: boolean | null;
  allowed_amount?: number | null;
  disallowed_amount?: number | null;
  disallowed_reason?: string | null;
  cap_check?: {
    basis_key?: MeasureKey;
    cap_pct?: number;
    cap_amount?: number;
    within_cap?: boolean;
  } | null;
  evidence_doc_id?: string | null;
  first_claimed_period_id?: string | null;
}

export interface Adjustment {
  adjustment_id: string;
  label?: string;
  type: "revenue_reversal" | "cost_reclassification" | "impairment" | "pro_forma" | "equity_cure" | "other";
  amount: number; // signed
  reason?: string | null;
  evidence_doc_id?: string | null;
  affects_measure_key?: MeasureKey;
}

export interface EbitdaBuild {
  base_key: MeasureKey;
  base_amount: number;
  add_backs?: AddBack[];
  adjustments?: Adjustment[];
  total_key: MeasureKey;
  total_amount: number;
}

export interface CertifiedResult {
  covenant_id: string;
  certified_value?: number | null;
  certified_threshold?: number | null;
  certified_status: "IN_COMPLIANCE" | "NOT_IN_COMPLIANCE" | "NOT_STATED";
  certified_status_verbatim?: string | null;
  calculation_text?: string | null;
}

export interface UnmappedField {
  raw_name: string;
  raw_label?: string;
  value?: number | string | null;
  unit?: string | null;
}

export interface Observation {
  observation_id: string;
  basis: Basis;
  as_of: string;
  source_doc_id?: string;
  supersedes_observation_id?: string | null;
  provenance_label?: Provenance;
  measures: Measure[];
  unmapped_fields?: UnmappedField[];
  field_map_fingerprint?: string | null;
  ebitda_build?: EbitdaBuild;
  certified_results?: CertifiedResult[];
  signed_by?: { name?: string; title?: string; signed_on?: string } | null;
}

export interface Period {
  period_id: string;
  label?: string;
  test_date: string;
  sequence?: number;
  relevant_period?: { start: string; end: string };
  observations: Observation[];
  expected_assessment?: ExpectedAssessment[];
}

export interface ExpectedAssessment {
  covenant_id: string;
  basis: Basis;
  expected_value?: number | null;
  expected_status: Status;
  expect_drift_detected?: boolean;
  expect_certification_conflict?: boolean;
  expect_memory_hit?: boolean;
  rationale?: string;
}

export interface EnidDocument {
  doc_id: string;
  kind: string;
  title?: string;
  doc_date?: string | null;
  party?: string | null;
  source_uri?: string | null;
  fingerprint: { algo: "sha256"; value: string; computed_at?: string | null; byte_length?: number | null };
  extraction?: unknown;
  provenance_label?: Provenance;
}

export interface EnidEvent {
  event_id: string;
  kind: "restatement" | "auditor_change" | "rating_action" | "regulatory_filing" | "news" | "market_move" | "other";
  observed_at: string;
  headline: string;
  summary?: string | null;
  entity_refs?: { borrower_ids?: string[]; sponsor_ids?: string[] };
  retrieved_via: "you_search" | "you_research_ari" | "you_finance" | "you_contents" | "manual";
  research_effort?: string | null;
  sources?: Array<{ url: string; title?: string | null; publisher?: string | null; published_at?: string | null; snippet?: string | null }>;
  derived_observation_ids?: string[];
  provenance_label: Provenance;
}

export interface RelatedDeal {
  facts_id: string;
  borrower_id?: string | null;
  relation: "same_sponsor" | "same_lender" | "same_auditor" | "same_addback_pattern" | "same_group";
  note?: string | null;
}

export interface Memory {
  sponsor_id?: string | null;
  pattern_tags?: string[];
  related_deals?: RelatedDeal[];
}

export interface FactsBundle {
  schema_version: "1.0.0";
  facts_id: string;
  generated_at?: string;
  provenance_label: Provenance;
  units: Units;
  basis_precedence: Basis[];
  borrower: Borrower;
  covenants: Covenant[];
  periods: Period[];
  documents: EnidDocument[];
  events?: EnidEvent[];
  memory?: Memory;
  notes?: string;
}

// ---- Kernel context + memory resolver -----------------------------------

export interface Certificate {
  period_id: string;
  observation_id: string;
  certified_result: CertifiedResult | null;
}

export interface MemoryContext {
  self: Memory | null;
  bySponsor(sponsor_id: string): FactsBundle[];
}

export interface AssessCtx {
  now: string;
  precedence_override?: Basis[];
  target_period_id?: string; // used when certificate == null to select the period under test
  event_ids?: string[]; // live You.com events that triggered this scan (for evidence + scoreboard)
}

// ---- Assessment (the Finding, §3) ---------------------------------------

export type SourceKind = "measure" | "reconstructed_build" | "stale_fallback" | "unresolved";

export type ErrorCode =
  | "UNKNOWN_PERIOD"
  | "NO_OBSERVATION"
  | "NO_EFFECTIVE_THRESHOLD"
  | "DIVIDE_BY_ZERO"
  | "MISSING_INPUT"
  | "UNKNOWN_COVENANT_TYPE"
  | "STALE_INPUT_UNBACKED";

export type DriftKind = "unmapped_field" | "stale_carry_forward" | "field_rename";

export interface Assessment {
  assessment_id: string;
  schema_version: "1.0.0";
  generated_at: string;

  borrower_id: string;
  covenant_id: string;
  period_id: string;
  test_date: string;
  authoritative_basis: Basis | null;

  status: Status;
  recomputed_value: number | null;
  headroom: number | null;

  threshold: {
    value: number;
    direction: Direction;
    effective_from: string;
    effective_to: string | null;
  } | null;

  ratio: {
    numerator_key: string;
    numerator_value: number | null;
    numerator_source: SourceKind;
    denominator_key: string;
    denominator_value: number | null;
    denominator_source: SourceKind;
    rounding: Rounding;
  };

  recompute: {
    ebitda_build_present: boolean;
    recomputed_ebitda: number | null;
    stated_total: number | null;
    recompute_delta: number | null;
    disallowed_add_backs: Array<{ add_back_id: string; category: string; amount: number; disallowed_reason: string | null }>;
    adjustments_applied: Array<{ adjustment_id: string; type: string; amount: number }>;
  };

  certified: {
    present: boolean;
    certified_value: number | null;
    certified_status: "IN_COMPLIANCE" | "NOT_IN_COMPLIANCE" | "NOT_STATED" | null;
    certified_status_verbatim: string | null;
    certification_conflict: boolean | null;
    delta_vs_recompute: number | null;
  };

  drift: {
    detected: boolean;
    kinds: DriftKind[];
    current_fingerprint: string | null;
    prior_observation_id: string | null;
    details: Array<{
      kind: DriftKind;
      canonical_key: string | null;
      prior_raw_name: string | null;
      current_raw_name: string | null;
      unmapped_raw_names: string[];
      prior_fingerprint: string | null;
      note: string;
    }>;
  };

  memory: {
    consulted: boolean;
    hit: boolean;
    matches: Array<{
      prior_facts_id: string;
      borrower_id: string | null;
      sponsor_id: string;
      relation: string[];
      pattern_tags: string[];
      shared_add_back_category: string | null;
      note: string | null;
    }>;
  };

  watch: {
    evaluated: boolean;
    triggered_by: Array<"headroom_absolute" | "headroom_pct" | "deteriorating_periods">;
    headroom_value: number | null;
    trend: Array<{ period_id: string; test_date: string; value: number | null }>;
  };

  evidence: {
    source_doc_ids: string[];
    event_ids: string[];
    citations: Array<{ url: string; title: string | null; publisher: string | null; snippet: string | null }>;
  };

  labels: {
    facts: Provenance;
    recompute: Provenance;
    downstream_serve: Provenance;
  };
  provenance_label: Provenance;

  proposed_write: ProposedWrite | null;

  errors: Array<{ code: ErrorCode; message: string; field: string | null }>;
  warnings: string[];
}

// ---- Attest gate (§7) ---------------------------------------------------

export interface ProposedWrite {
  proposal_id: string;
  created_at: string;
  kind: "breach_notice" | "watch_flag" | "covenant_status_update";
  target: { borrower_id: string; covenant_id: string; period_id: string; test_date: string };
  from_status: Status;
  to_status: Status;
  recomputed_value: number;
  threshold: { value: number; direction: Direction };
  rationale: string;
  evidence: {
    source_doc_ids: string[];
    event_ids: string[];
    citations: Array<{ url: string; title: string | null; publisher: string | null; snippet: string | null }>;
  };
  downstream: {
    channel: "covenant_register";
    template: "reservation_of_rights";
    target_ref: string;
    dry_run: true;
  };
  requires_attestation: true;
  attestation_state: "PENDING";
  provenance_label: "SYNTHETIC";
}

export interface Attestation {
  attestation_id: string;
  proposal_id: string;
  attested_by: { analyst_id: string; name: string; role: "credit_analyst" | "agent" | "lender" };
  decision: "ATTEST" | "DENY";
  attested_at: string;
  note: string | null;
  signature: string;
}

export interface CommittedWrite {
  outcome: "committed";
  proposal: ProposedWrite;
  attestation: Attestation;
  committed_at: string;
}

export interface DeniedWrite {
  outcome: "denied";
  proposal: ProposedWrite;
  attestation: Attestation;
  denied_at: string;
  denied_reason: string | null;
}

export type WriteResult = CommittedWrite | DeniedWrite;

export interface ServeReceipt {
  receipt_id: string;
  channel: "covenant_register";
  template: "reservation_of_rights";
  target_ref: string;
  served_at: string;
  provenance_label: "SYNTHETIC";
  detail?: unknown;
}

// ---- Event-stream scoreboard (§9) ---------------------------------------

export type ScoreboardEventName =
  | "scanned"
  | "pass"
  | "watch"
  | "breach"
  | "drift_detected"
  | "memory_hit"
  | "attested"
  | "write_denied"
  | "write_committed";

export interface ScoreboardEvent {
  event: ScoreboardEventName;
  seq: number;
  ts: string;
  borrower_id: string;
  covenant_id: string | null;
  period_id: string | null;
  provenance_label: Provenance;
  assessment_id: string | null;
  data: Record<string, unknown>;
}
