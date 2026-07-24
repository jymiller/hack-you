# Covenant Kernel — Spec

**ENID Covenant Sentinel · You.com Agentic hackathon (Fri Jul 24 2026)**

Status: **DESIGN / SPEC ONLY.** Per `HANDOFF.md` §8 (NEW WORK ONLY) this file contains type
shapes, rules, and pseudocode — **no runnable kernel implementation**. The kernel is re-typed
fresh from this spec inside the event window. TypeScript `interface` blocks below are *type
shapes*; numbered "Algorithm" blocks are *pseudocode*, deliberately non-executable.

Reads only the normalized Facts bundle: `prerun/covenant-facts.schema.json` (v1.0.0).
Anchored to the six fixtures in `fixtures/` — the worked examples in §10 reproduce the
`expected_assessment[]` oracle exactly.

---

## 0 · One-paragraph contract

`assess()` is a **pure function**. Given a borrower's Facts bundle, one covenant, the borrower's
self-certificate for a period, and cross-deal memory, it (1) reads facts, (2) **recomputes** the
ratio from measures — never trusting any certified number or stated EBITDA total, (3) **fingerprints
the field map** and detects schema drift by comparing *maps, not values*, (4) classifies
**PASS / WATCH / BREACH / INDETERMINATE**, and (5) emits a **PROPOSED write** that is inert until a
separate human `attest()` flips it. `assess()` performs **no side effects and no writes.** Only a
wrapper, only after `attest()` returns `ATTEST`, may fire the downstream (ActionLayer) serve.

---

## 1 · Function signatures

```ts
// The kernel. Pure. No I/O, no writes, no clock except the injected `now`.
function assess(
  facts: FactsBundle,          // full normalized bundle for ONE borrower (schema v1.0.0)
  covenant: Covenant,          // one element of facts.covenants[]
  certificate: Certificate | null, // the borrower-certified observation for the period under test
  memory: MemoryContext,       // facts.memory + a resolver over sibling bundles by sponsor_id
  ctx?: AssessCtx              // injected determinism: { now, precedence_override? }
): Assessment;                 // the Finding (§3). Never throws for data faults — errors[] instead.

// The human gate. Separate function, separate caller. Also pure.
function attest(
  proposal: ProposedWrite,
  attestation: Attestation
): WriteResult;                // CommittedWrite | DeniedWrite. Still no side effect.

// NOT part of the kernel. The wrapper executes the downstream serve ONLY on a CommittedWrite.
// Documented here so the boundary is explicit; it is the only place a real effect happens.
function executeCommitted(w: CommittedWrite): ServeReceipt;
```

Parameter types:

```ts
type Basis =
  | "borrower_certified" | "management_accounts"
  | "raw_financials" | "audited_restated" | "agent_recomputed";

type Status = "PASS" | "WATCH" | "BREACH" | "INDETERMINATE";

// `facts` is the whole bundle (borrower, covenants[], periods[], documents[], events?, memory?).
// Shapes are defined by covenant-facts.schema.json; the kernel treats it as read-only input.
type FactsBundle = /* covenant-facts.schema.json root */ object;
type Covenant    = /* $defs.covenant */ object;
type Observation = /* $defs.observation */ object;
type Period      = /* $defs.period */ object;

// The certificate is the borrower's own claim for a period: the basis=="borrower_certified"
// observation plus its certified_result[] entry for THIS covenant. Nullable (no cert filed).
interface Certificate {
  period_id: string;              // selects the period under test
  observation_id: string;         // the borrower_certified observation
  certified_result: CertifiedResult | null; // $defs.certified_result for covenant.covenant_id
}

// Memory is the current bundle's memory node plus a lookup into the sibling corpus.
interface MemoryContext {
  self: Memory | null;            // facts.memory  ($defs.memory)
  // Deterministic resolver: sibling SYNTHETIC bundles keyed by sponsor_id. In the demo this is a
  // pre-indexed map (Ardenmoor -> [halveston]); no network, no live lookup.
  bySponsor(sponsor_id: string): FactsBundle[];
}

interface AssessCtx {
  now: string;                    // ISO date-time; injected so the function is deterministic
  precedence_override?: Basis[];  // else use facts.basis_precedence
}
```

`certificate` is separate from `facts` on purpose: the borrower's claim is an *input to be checked*,
never an input to the classification. The kernel forms its own ratio and only *compares* to the
certificate afterward.

---

## 2 · What "recompute, never trust" means precisely

Three numbers in the data are **claims the kernel must not adopt as the answer**:

1. `certified_result.certified_value` — the borrower's own ratio (6.47×, 1.60×).
2. `ebitda_build.total_amount` — the borrower's claimed adjusted EBITDA total (34.0, 40.0).
3. `certified_result.certified_status` / `..._verbatim` — "No Default is continuing."

The kernel builds the ratio itself from `measures[]`, using this resolver:

**Algorithm `resolve(observation, key) -> {value, source} | UNRESOLVED`:**
1. `m` ← the measure in `observation.measures[]` whose `key == key`.
2. If `m` exists, `m.value != null`, `m.state == "observed"`, and `m.raw_name != null`:
   return `{ value: m.value, source: "measure" }`  — the field resolved cleanly from the document.
3. Else if this `observation.ebitda_build` produces `key` (i.e. `key == ebitda_build.total_key`
   or `key == ebitda_build.base_key`):
   return `{ value: recomputeEbitda(observation.ebitda_build), source: "reconstructed_build" }`.
4. Else if `m` exists with a numeric `value` (e.g. `state=="stale"` carry-forward):
   return `{ value: m.value, source: "stale_fallback" }` **and raise a drift signal** (§5b).
5. Else return `UNRESOLVED`.

**Algorithm `recomputeEbitda(build) -> number`:**
```
total = build.base_amount
for ab in build.add_backs:  if ab.allowed === true:  total += ab.amount   // null and false are DROPPED
for adj in build.adjustments:                          total += adj.amount // adjustments are signed
return total
```
The kernel **only ever sums `allowed === true`**. `null` (not yet adjudicated) and `false`
(disallowed) contribute nothing. This is the single line that drops disallowed synergies.

Independently, whenever a build exists the kernel records
`recompute_delta = recomputeEbitda(build) − build.total_amount` as a finding — the borrower's
stated total is a claim, checked, never adopted.

> Why step 2 uses the clean measure but step 3/4 rebuild: a source-resolved observed value *is* the
> extracted truth; adopting it is not "trusting the borrower," it is reading the document. The kernel
> substitutes its own reconstruction exactly when the field **failed to resolve** (stale / renamed /
> missing) — which is also precisely the schema-drift case. See Thornwick vs Northgate in §10.

---

## 3 · Return type — `Assessment` (the Finding)

Every field, always present unless marked `| null`.

```ts
interface Assessment {
  assessment_id: string;        // deterministic: sha1(borrower_id|covenant_id|period_id|authoritative_basis|recomputed_value)
  schema_version: "1.0.0";
  generated_at: string;         // = ctx.now (injected, not wall clock)

  borrower_id: string;
  covenant_id: string;
  period_id: string;
  test_date: string;            // period.test_date
  authoritative_basis: Basis | null;  // basis the status is computed on; null on INDETERMINATE/no-obs

  status: Status;
  recomputed_value: number | null;    // the kernel's own ratio; null when INDETERMINATE
  headroom: number | null;            // signed distance to threshold (see §4); negative == breach

  threshold: {                        // the stepdown row selected for test_date; null if none matched
    value: number;
    direction: "max" | "min";
    effective_from: string;
    effective_to: string | null;
  } | null;

  ratio: {                            // how recomputed_value was formed — the audit trail
    numerator_key: string;
    numerator_value: number | null;
    numerator_source: "measure" | "reconstructed_build" | "stale_fallback" | "unresolved";
    denominator_key: string;
    denominator_value: number | null;
    denominator_source: "measure" | "reconstructed_build" | "stale_fallback" | "unresolved";
    rounding: { mode: "half_up" | "half_even" | "truncate"; decimals: number };
  };

  recompute: {                        // the "never trust the stated total" check
    ebitda_build_present: boolean;
    recomputed_ebitda: number | null; // sum of base + allowed add-backs + signed adjustments
    stated_total: number | null;      // ebitda_build.total_amount (the CLAIM)
    recompute_delta: number | null;   // recomputed_ebitda - stated_total
    disallowed_add_backs: Array<{ add_back_id: string; category: string; amount: number;
                                  disallowed_reason: string | null }>;
    adjustments_applied: Array<{ adjustment_id: string; type: string; amount: number }>;
  };

  certified: {                        // the borrower's claim, recorded, NEVER an input to `status`
    present: boolean;
    certified_value: number | null;
    certified_status: "IN_COMPLIANCE" | "NOT_IN_COMPLIANCE" | "NOT_STATED" | null;
    certified_status_verbatim: string | null;
    certification_conflict: boolean | null;   // status disagrees with the certificate (§4d); null if no cert
    delta_vs_recompute: number | null;         // certified_value - recomputed_value
  };

  drift: {                            // §5 — compares the field MAP, not the values
    detected: boolean;
    kinds: Array<"unmapped_field" | "stale_carry_forward" | "field_rename">;
    current_fingerprint: string | null;   // recomputed, not trusted from the record
    prior_observation_id: string | null;
    details: Array<{
      kind: "unmapped_field" | "stale_carry_forward" | "field_rename";
      canonical_key: string | null;
      prior_raw_name: string | null;
      current_raw_name: string | null;
      unmapped_raw_names: string[];
      prior_fingerprint: string | null;
      note: string;
    }>;
  };

  memory: {                           // §6 — cross-deal sponsor pattern
    consulted: boolean;
    hit: boolean;
    matches: Array<{
      prior_facts_id: string;         // e.g. "halveston-services"
      borrower_id: string | null;
      sponsor_id: string;             // e.g. "ardenmoor"
      relation: string[];             // ["same_sponsor","same_addback_pattern", ...]
      pattern_tags: string[];         // ["run_rate_synergy_disallowed", ...]
      shared_add_back_category: string | null; // "run_rate_synergy"
      note: string | null;
    }>;
  };

  watch: {                            // §4c — trend-based
    evaluated: boolean;
    triggered_by: Array<"headroom_absolute" | "headroom_pct" | "deteriorating_periods">;
    headroom_value: number | null;
    trend: Array<{ period_id: string; test_date: string; value: number | null }>;
  };

  evidence: {                         // for the UI citations + the proposed write
    source_doc_ids: string[];
    event_ids: string[];              // live You.com events that caused this (facts.events[])
    citations: Array<{ url: string; title: string | null; publisher: string | null;
                       snippet: string | null }>;  // 1:1 with ARI output.sources[]
  };

  labels: {                           // §8 honesty overlay — rendered from the record
    facts: "SYNTHETIC" | "REAL" | "PRERUN";       // the corpus/observation label
    recompute: "SYNTHETIC" | "REAL" | "PRERUN";   // the kernel run itself == REAL
    downstream_serve: "SYNTHETIC" | "REAL" | "PRERUN"; // the ActionLayer serve == PRERUN on stage
  };
  provenance_label: "SYNTHETIC" | "REAL" | "PRERUN"; // top label for the whole record

  proposed_write: ProposedWrite | null;   // §7 — present only for WATCH/BREACH; ALWAYS inert

  errors: Array<{ code: ErrorCode; message: string; field: string | null }>; // [] on success
  warnings: string[];
}

type ErrorCode =
  | "UNKNOWN_PERIOD" | "NO_OBSERVATION" | "NO_EFFECTIVE_THRESHOLD"
  | "DIVIDE_BY_ZERO" | "MISSING_INPUT" | "UNKNOWN_COVENANT_TYPE" | "STALE_INPUT_UNBACKED";
```

---

## 4 · Classification rules

**Algorithm `assess()` (top level):**

1. **Locate period.** `p` ← `facts.periods[]` where `period_id == certificate.period_id`
   (if `certificate == null`, the caller passes the target `period_id` via `ctx`). Missing →
   return INDETERMINATE, `errors:[{code:"UNKNOWN_PERIOD"}]`, no `proposed_write`.
2. **Validate covenant type.** `covenant.metric ∈ {total_net_leverage, senior_net_leverage,
   interest_cover, debt_service_cover, fixed_charge_cover}` and `direction ∈ {max, min}`. Else
   INDETERMINATE, `UNKNOWN_COVENANT_TYPE`.
3. **Resolve the authoritative observation** for `p` (§4a).
4. **Resolve the threshold** row for `p.test_date` (§4b). None → INDETERMINATE,
   `NO_EFFECTIVE_THRESHOLD` (**never PASS**).
5. **Recompute the ratio.** `num = resolve(obs, covenant.formula.numerator_key)`,
   `den = resolve(obs, covenant.formula.denominator_key)`.
   - either `UNRESOLVED` → INDETERMINATE, `MISSING_INPUT`.
   - `den.value == 0` → INDETERMINATE, `DIVIDE_BY_ZERO`.
   - else `recomputed_value = round(num.value / den.value, covenant.formula.rounding)`.
6. **Detect drift** (§5) on `obs` vs the prior-period same-basis observation. (Runs even on PASS —
   drift is orthogonal to breach.)
7. **Classify** BREACH → WATCH → PASS (§4c/§4d).
8. **Consult memory** (§6) when the finding is BREACH *or* a disallowed add-back drove the recompute.
9. **Compare to certificate**: `certification_conflict = certificate.present &&
   normalize(status) != normalize(certified_status)`.
10. **Emit proposed write** (§7) for WATCH/BREACH; attach labels (§8); return.

### 4a · Basis precedence (truth resolution)
Order = `ctx.precedence_override ?? facts.basis_precedence`. Default, most-authoritative first:
`audited_restated > raw_financials > management_accounts > borrower_certified`. The authoritative
observation is the one in `p.observations[]` whose basis is highest in that order; ties broken by
latest `as_of`. **This single step is the Thornwick money-shot**: the `audited_restated` observation
(as_of 2026-07-03, 7.59×) outranks the `borrower_certified` one (as_of 2026-05-13, 6.47×), so the
period *is* a BREACH the moment the restatement exists.

### 4b · Threshold selection (dated stepdown)
Select the `thresholds[]` row where `effective_from <= test_date <= (effective_to ?? +∞)`. Exactly
one must match; zero → INDETERMINATE / `NO_EFFECTIVE_THRESHOLD`. Thornwick 2026-03-31 selects the
`6.50` row (window 2024-06-28 … 2026-06-29).

### 4c · The comparator + WATCH (trend-based)
One comparator serves all three mechanisms via `direction`:

- **`headroom`** (signed, "distance still inside the covenant"):
  `max` → `threshold − value`; `min` → `value − threshold`. Negative headroom ⇒ **BREACH**.
- **BREACH** iff `headroom < 0` (`max`: `value > threshold`; `min`: `value < threshold`).
- If not breached, evaluate **WATCH** from `covenant.watch_rule` (null ⇒ no WATCH, stays PASS).
  WATCH is the **union** of any sub-rule that fires:
  1. `headroom_absolute = h`  → WATCH if `0 <= headroom <= h`.
  2. `headroom_pct = q`       → WATCH if `0 <= headroom <= q * threshold`.
  3. `deteriorating_periods = N` → **trend rule**: gather this covenant's `recomputed_value` over the
     last `N` periods by `sequence`/`test_date` (the kernel recomputes each; it does not read stored
     ratios). WATCH if there are `N` consecutive periods moving monotonically *toward* the threshold
     (`max`: strictly increasing; `min`: strictly decreasing). Borrower-B: 4.0 → 4.2 → 4.4× over
     `b-p1/b-p2/b-p3` with `N=3` ⇒ WATCH, even though headroom (5.0 − 4.4 = 0.6) alone would not trip
     `headroom_absolute=0.25`.
- Else **PASS**.

`watch.trend[]` always carries the series used, so the UI can draw the creep line from the record.

### 4d · Certification conflict
`certification_conflict = true` when the kernel's `status` disagrees with
`certificate.certified_result.certified_status` (mapping `PASS/WATCH → IN_COMPLIANCE`,
`BREACH → NOT_IN_COMPLIANCE`). This is a **recorded diff, not an input**. Thornwick restated
(BREACH) vs certificate ("In compliance. No Default … is continuing.") ⇒ conflict = true — the
one-truth headline. Borrower-C: recompute DSCR 1.08× BREACH sits next to a self-certified
"IN COMPLIANCE" ⇒ conflict = true.

---

## 5 · Drift detection — compare the MAP, not the values

The schema-drift beat **fails silently if you only diff numbers**: Northgate's EBITDA row is renamed
`EBITDA → "Adjusted EBITDA"` and the value moves a plausible 38 → 40; a value comparison sees an
ordinary quarter and stays green. Only the **field map** reveals the rename.

**Field map of an observation** = the set of `(canonical_key → raw_name)` pairs from `measures[]`
where `raw_name != null`, **plus** the set of `unmapped_fields[].raw_name`.

**Fingerprint** = `sha256` over the sorted `"key:raw_name"` pairs concatenated with the sorted
unmapped raw names. The kernel **recomputes** this from the observation (it does **not** trust the
stored `field_map_fingerprint`; a stored hash is a claim like any other).

**Algorithm `detectDrift(obs, priorObs) -> DriftResult`:** `drift.detected` is TRUE if ANY hold:

- **(a) unmapped_field** — `obs.unmapped_fields[]` is non-empty. A source row matched no canonical
  key (Northgate management: `"Adjusted EBITDA" = 40.0` in `unmapped_fields`). Hard alarm.
- **(b) stale_carry_forward** — any measure the covenant *uses* has `state == "stale"` or
  `raw_name == null`. A canonical key failed to resolve and was carried forward (Northgate
  `consolidated_ebitda = 38.0`, `state="stale"`, `stale_from_period_id="p-2025-q4"`). This is the
  "dashboard stayed green on a carried-forward number" bug, made explicit.
- **(c) field_rename** — `priorObs` exists (same basis, prior period) and `fingerprint(obs) !=
  fingerprint(priorObs)` **and** the diff includes a canonical key whose `raw_name` changed
  (`EBITDA → "Adjusted EBITDA"`). Not merely a value change — a *map* change.

`drift.kinds[]` collects which fired; `drift.details[]` names the `canonical_key`,
`prior_raw_name`, `current_raw_name`, the unmapped rows, and both fingerprints — enough for the UI to
show the rename inline and for the security judge's audit trail. Drift is computed for every
assessment (including PASS) because a renamed field can silently *hold* a covenant green.

---

## 6 · Cross-deal sponsor memory

Purpose: prove *retrieval across bundles*, which a big context window cannot fake — the join key is
`sponsor_id`, and the demo hit is **Thornwick (sponsor Ardenmoor) → Halveston (same sponsor, same
disallowed add-back), two years earlier.**

**Algorithm `consultMemory(facts, covenant, obs, recompute, memory) -> MemoryResult`:**
1. `consulted = true` only when the current finding is BREACH **or** `recompute.disallowed_add_backs`
   is non-empty (i.e. an add-back adjudication moved the number). Otherwise `consulted=false, hit=false`.
2. `sponsor_id = facts.borrower.sponsor?.sponsor_id`; if absent → no hit.
3. Candidate priors = `memory.self.related_deals[]` ∪ `memory.bySponsor(sponsor_id)` (sibling bundles).
4. Current pattern = the set of `add_back.category` where `allowed === false` in `obs.ebitda_build`
   (Thornwick restated: `run_rate_synergy`), plus `memory.self.pattern_tags[]`.
5. **hit** when a prior bundle shares (`same_sponsor`) **and** exhibits the same disallowed add-back
   `category` / `pattern_tag` (`run_rate_synergy_disallowed`). Record `relation[]` (e.g.
   `["same_sponsor","same_addback_pattern","same_auditor"]`), `pattern_tags[]`, and
   `shared_add_back_category`.

Consequence in the fixtures: memory fires on the **audited_restated** basis (where `tw-syn.allowed ==
false` is known), matching `expect_memory_hit=true` on Thornwick's restated row; it does **not** fire
on the `borrower_certified` basis (`allowed == null`, disallowal not yet adjudicated) — exactly the
oracle. Halveston is the mirror: its restated BREACH carries `related_deals → thornwick-logistics`.

---

## 7 · The attest gate + proposed-write shape

`assess()` emits a **ProposedWrite** for WATCH/BREACH and **never executes it**. `attestation_state`
is a `const "PENDING"` at emit; `requires_attestation` is `const true`.

```ts
interface ProposedWrite {
  proposal_id: string;          // idempotency key: sha1(borrower|covenant|period|to_status|current_fingerprint|recomputed_value)
  created_at: string;           // ctx.now
  kind: "breach_notice" | "watch_flag" | "covenant_status_update";
  target: { borrower_id: string; covenant_id: string; period_id: string; test_date: string };
  from_status: Status;          // prior/certified status (e.g. PASS / IN_COMPLIANCE)
  to_status: Status;            // the recomputed status (BREACH / WATCH)
  recomputed_value: number;
  threshold: { value: number; direction: "max" | "min" };
  rationale: string;            // human sentence, e.g. "Restated adjusted EBITDA 34.0->29.0 drives
                                //  total net leverage 6.47x->7.59x, above the 6.50x limit."
  evidence: {
    source_doc_ids: string[];
    event_ids: string[];        // the live You.com event(s) that triggered the scan
    citations: Array<{ url: string; title: string | null; publisher: string | null; snippet: string | null }>;
  };
  downstream: {                 // a DESCRIPTOR of the serve, not a call. Never fired here.
    channel: "actionlayer";
    template: "reservation_of_rights";
    target_ref: string;         // synthetic/sandbox recipient
    dry_run: true;              // const true at proposal time
  };
  requires_attestation: true;   // const
  attestation_state: "PENDING"; // const at emit
  provenance_label: "SYNTHETIC"; // facts are synthetic; the eventual serve is PRERUN (see labels)
}

interface Attestation {
  attestation_id: string;
  proposal_id: string;          // must equal the ProposedWrite it answers
  attested_by: { analyst_id: string; name: string; role: "credit_analyst" | "agent" | "lender" };
  decision: "ATTEST" | "DENY";
  attested_at: string;
  note: string | null;
  signature: string;            // sha256(proposal_id|analyst_id|decision|attested_at) — tamper-evident
}

type WriteResult = CommittedWrite | DeniedWrite;

interface CommittedWrite {
  outcome: "committed";
  proposal: ProposedWrite;
  attestation: Attestation;     // decision == "ATTEST"
  committed_at: string;
  // NOTE: still no side effect. executeCommitted(this) is what actually serves. That call is the
  // ONLY place the system touches the outside world, and it cannot be reached without this object.
}

interface DeniedWrite {
  outcome: "denied";
  proposal: ProposedWrite;
  attestation: Attestation;     // decision == "DENY"
  denied_at: string;
  denied_reason: string | null;
}
```

**`attest()` rules:** verify `attestation.proposal_id == proposal.proposal_id` and the signature;
`ATTEST → CommittedWrite`, `DENY → DeniedWrite`. `attest()` itself performs **no serve** — the gate
is *authorization*, the wrapper is *execution*. Same DENY/attest gate as the Wet-Ink policy-gate win.
Idempotency: `proposal_id` folds in the recomputed value and fingerprint, so a re-scan of an
unchanged breach yields the same id and cannot double-serve.

---

## 8 · Honesty-label overlay (rendered from the record, never a slide)

Exactly one label per on-stage effect: **SYNTHETIC** (all corpus data), **REAL** (fired live), or
**PRERUN** (executed earlier, shown as a receipt). Where each attaches in the data model:

| Where the label lives (field) | Value on stage | Meaning |
|---|---|---|
| `FactsBundle.provenance_label` | `SYNTHETIC` | whole corpus is synthetic |
| `document.provenance_label` | `SYNTHETIC` | every fixture doc |
| `observation.provenance_label` | `SYNTHETIC` | every recomputed observation |
| `event.provenance_label` (`facts.events[]`) | `REAL` | the live You.com Search/ARI crawl that triggered the scan |
| `Assessment.labels.facts` | `SYNTHETIC` | the book being assessed |
| `Assessment.labels.recompute` | `REAL` | the kernel run itself is a real computation |
| `Assessment.labels.downstream_serve` | `PRERUN` | the ActionLayer serve is a cached receipt |
| `Assessment.provenance_label` | `SYNTHETIC` | top label for the whole record |
| `ProposedWrite.provenance_label` | `SYNTHETIC` | proposal over synthetic facts |
| every scoreboard event `.provenance_label` (§9) | as above | UI reads it off the event |

The **money-shot** is legible directly from `Assessment.labels`: `facts=SYNTHETIC`, `recompute=REAL`,
`downstream_serve=PRERUN` — "SYNTHETIC data through a REAL recompute, served PRERUN." The UI **must
read the label from the record**; it must never paint a label from slide text. Rule: never label a
mock as PRERUN; a `dry_run:true` descriptor that was never executed is SYNTHETIC, not PRERUN.

---

## 9 · Event-stream scoreboard

One universal feed. Shared envelope, then a per-event `data`. `seq` is a monotonic counter so the UI
can order and replay.

```ts
interface ScoreboardEvent {
  event: "scanned" | "pass" | "watch" | "breach" | "drift_detected"
       | "memory_hit" | "attested" | "write_denied" | "write_committed";
  seq: number;
  ts: string;
  borrower_id: string;
  covenant_id: string | null;
  period_id: string | null;
  provenance_label: "SYNTHETIC" | "REAL" | "PRERUN";
  assessment_id: string | null;   // links the tile back to the Finding
  data: object;                   // per-event, below
}
```

Per-event `data` payloads:

- **`scanned`** — a borrower/covenant entered the pipeline (often triggered by a live event).
  `{ trigger_event_id: string | null, covenants_queued: number, source: "you_search"|"you_research_ari"|"schedule" }`
- **`pass`** — `{ recomputed_value: number, threshold: number, headroom: number, authoritative_basis: Basis }`
- **`watch`** — `{ recomputed_value, threshold, headroom, triggered_by: string[], trend: Array<{period_id,value}> }`
- **`breach`** — `{ recomputed_value, threshold, headroom, authoritative_basis, from_value: number|null,
  certification_conflict: boolean, rationale: string }` (Thornwick: `from_value:6.47, recomputed_value:7.59`).
- **`drift_detected`** — `{ kinds: string[], canonical_key: string|null, prior_raw_name: string|null,
  current_raw_name: string|null, unmapped_raw_names: string[], prior_fingerprint: string|null, current_fingerprint: string }`
- **`memory_hit`** — `{ sponsor_id: string, prior_facts_id: string, relation: string[],
  pattern_tags: string[], shared_add_back_category: string|null }` (Ardenmoor → halveston).
- **`attested`** — `{ proposal_id, decision: "ATTEST"|"DENY", analyst_id, attested_at, signature }`
  (one `attested` event carries the decision; `write_committed`/`write_denied` is the consequence).
- **`write_denied`** — `{ proposal_id, denied_reason: string|null }` (no downstream fired).
- **`write_committed`** — `{ proposal_id, downstream: { channel:"actionlayer", template, target_ref },
  serve_receipt_id: string|null, provenance_label: "PRERUN" }` (the serve is a PRERUN receipt).

Ordering for the money-shot demo: `scanned(REAL) → breach → drift_detected → memory_hit → attested →
write_committed(PRERUN)`. Borrower-B contributes a `watch`; Borrower-A a `pass`; Northgate a
`drift_detected`+`breach`.

---

## 10 · Worked examples (reproduce the `expected_assessment[]` oracle)

**Thornwick q1-2026 · `total_net_leverage` (direction max, threshold 6.50).**
- Authoritative basis = `audited_restated` (outranks `borrower_certified`). `resolve(adjusted_ebitda)`
  = clean observed measure **29.0**; `resolve(total_net_debt)` = 220.0 → **220/29.0 = 7.59× → BREACH**
  (headroom = 6.50 − 7.59 = −1.09). Certificate says 6.47× IN_COMPLIANCE ⇒ `certification_conflict =
  true`. `recompute.disallowed_add_backs = [run_rate_synergy 3.2 (not_realised_in_window),
  transaction_advisory 0.3]`; `recompute_delta = (29.5+1.0−1.7) − 29.0 = −0.2`. Memory: sponsor
  Ardenmoor + `run_rate_synergy` disallowed ⇒ **hit → halveston**. Matches oracle
  (`BREACH, 7.59, memhit=true, certconf=true`). The certified-basis assessment separately yields
  220/34.0 = **6.47× PASS** (oracle row 2).

**Northgate p-2026-q1 · `interest-cover` (direction min, threshold 1.40).**
- Authoritative basis = `management_accounts` (outranks certified; no audited/raw present).
  `resolve(consolidated_ebitda)`: measure is `state=="stale"`/`raw_name==null` ⇒ **not clean** ⇒
  reconstruct from `ebitda_build`: `20.0 + 13.25 (non_cash, allowed) = 33.25` (the disallowed
  `exceptional_restructuring 6.75` is dropped). `resolve(net_finance_charges) = 25.0` →
  **33.25/25.0 = 1.33× → BREACH** (matches oracle 1.33, not the naïve `38/25=1.52` a value-only read
  would show). **Drift**: `unmapped_field` (`"Adjusted EBITDA"=40.0`) + `stale_carry_forward`
  (`consolidated_ebitda` stale from `p-2025-q4`) + `field_rename` (`EBITDA → "Adjusted EBITDA"` vs
  prior period) ⇒ `drift.detected=true`. Certified basis: measure maps cleanly to 40.0 → 40/25 =
  **1.60× PASS**, but drift still true and `certification_conflict=true` (oracle rows match).

**Borrower-B b-p3 · `total_net_leverage` (max, threshold 5.00, `watch_rule.deteriorating_periods=3`).**
- `resolve` → 4.4×; headroom 5.0 − 4.4 = 0.6 (not a breach; `headroom_absolute=0.25` alone does not
  trip). Trend over `b-p1,b-p2,b-p3` = 4.0 → 4.2 → 4.4 strictly increasing over 3 periods ⇒
  `deteriorating_periods` fires ⇒ **WATCH** (matches oracle). `watch.trend[]` carries the creep line.

---

## 11 · Error / edge-case matrix

| Situation | `status` | `errors[].code` | `proposed_write` |
|---|---|---|---|
| `certificate.period_id` not in `facts.periods` | INDETERMINATE | `UNKNOWN_PERIOD` | null |
| period has empty `observations[]` | INDETERMINATE | `NO_OBSERVATION` | null |
| no `thresholds[]` row covers `test_date` | INDETERMINATE | `NO_EFFECTIVE_THRESHOLD` | null |
| denominator resolves to `0` | INDETERMINATE | `DIVIDE_BY_ZERO` | null |
| numerator or denominator `UNRESOLVED`, no build | INDETERMINATE | `MISSING_INPUT` | null |
| stale measure used, no build to reconstruct from | INDETERMINATE | `STALE_INPUT_UNBACKED` | null |
| `covenant.metric`/`direction` outside the enum | INDETERMINATE | `UNKNOWN_COVENANT_TYPE` | null |
| `certificate == null` (no cert filed) | computed on authoritative basis | — | as normal; `certified.present=false`, `certification_conflict=null` |

Invariants: **INDETERMINATE is never silently PASS**; a data fault yields a Finding with `errors[]`,
never a thrown exception (the kernel is total). `assess()` and `attest()` **never** perform a write or
downstream serve — that is structurally impossible without a `CommittedWrite`, which only a human
`ATTEST` produces.
