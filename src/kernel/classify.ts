// §4 — one comparator serves leverage (max ceiling) and cover ratios (min floor) via `direction`.
// Threshold is a dated stepdown; WATCH is data-driven (proximity or a deteriorating trend).

import type { Covenant, Direction, Status, Threshold, WatchRule } from "./types.js";

// The stepdown row whose window contains test_date. Exactly one should match; none → null
// (the caller returns INDETERMINATE / NO_EFFECTIVE_THRESHOLD, never PASS).
export function selectThreshold(covenant: Covenant, testDate: string): Threshold | null {
  const matches = covenant.thresholds.filter(
    (t) => t.effective_from <= testDate && (t.effective_to == null || testDate <= t.effective_to)
  );
  return matches[0] ?? null;
}

// Signed distance still inside the covenant; negative ⇒ breach.
export function headroom(value: number, threshold: number, direction: Direction): number {
  return direction === "max" ? threshold - value : value - threshold;
}

export interface WatchTrendPoint {
  period_id: string;
  test_date: string;
  value: number | null;
}

export interface ClassifyResult {
  status: Status;
  headroom: number;
  watch: {
    evaluated: boolean;
    triggered_by: Array<"headroom_absolute" | "headroom_pct" | "deteriorating_periods">;
    headroom_value: number | null;
    trend: WatchTrendPoint[];
  };
}

// trend = this covenant's recomputed value over the most recent periods (oldest→newest, current last),
// each recomputed by the kernel (never a stored ratio). Used only for the deteriorating-trend rule.
export function classify(
  value: number,
  threshold: number,
  direction: Direction,
  watchRule: WatchRule | null | undefined,
  trend: WatchTrendPoint[]
): ClassifyResult {
  const h = headroom(value, threshold, direction);
  const triggered_by: ClassifyResult["watch"]["triggered_by"] = [];

  if (h < 0) {
    return { status: "BREACH", headroom: h, watch: { evaluated: false, triggered_by, headroom_value: h, trend } };
  }

  if (!watchRule) {
    return { status: "PASS", headroom: h, watch: { evaluated: false, triggered_by, headroom_value: h, trend } };
  }

  if (watchRule.headroom_absolute != null && h <= watchRule.headroom_absolute) {
    triggered_by.push("headroom_absolute");
  }
  if (watchRule.headroom_pct != null && h <= watchRule.headroom_pct * threshold) {
    triggered_by.push("headroom_pct");
  }
  if (watchRule.deteriorating_periods != null && isDeteriorating(trend, watchRule.deteriorating_periods, direction)) {
    triggered_by.push("deteriorating_periods");
  }

  const status: Status = triggered_by.length > 0 ? "WATCH" : "PASS";
  return { status, headroom: h, watch: { evaluated: true, triggered_by, headroom_value: h, trend } };
}

// N consecutive periods moving strictly TOWARD the threshold (max: increasing; min: decreasing).
function isDeteriorating(trend: WatchTrendPoint[], n: number, direction: Direction): boolean {
  if (trend.length < n) return false;
  const window = trend.slice(trend.length - n);
  if (window.some((p) => p.value == null)) return false;
  for (let i = 1; i < window.length; i++) {
    const prev = window[i - 1].value!;
    const cur = window[i].value!;
    if (direction === "max" ? !(cur > prev) : !(cur < prev)) return false;
  }
  return true;
}
