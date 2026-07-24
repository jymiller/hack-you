// End-to-end money-shot on the deterministic core (no network). Prints the ordered scoreboard and
// a whole-corpus sweep. This is BUILD-LOOP gate 0's "demo runs end-to-end" — and the offline proof
// that the demo is real (steps 3 ★ + 7 ★) before FACE makes it live.

import { assess } from "../src/kernel/assess.js";
import { attest, makeAttestation, serveIfCommitted } from "../src/kernel/attest.js";
import { Scoreboard } from "../src/kernel/scoreboard.js";
import { buildMemoryContext, loadCorpus } from "../src/corpus.js";
import { certificateFor } from "../src/eval/helpers.js";
import type { Assessment, Provenance } from "../src/kernel/types.js";

const NOW = "2026-07-24T09:00:00Z";
const corpus = loadCorpus();

const C = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m", cyan: "\x1b[36m", magenta: "\x1b[35m",
};
const label = (l: Provenance) =>
  l === "REAL" ? `${C.green}[REAL]${C.reset}` : l === "PRERUN" ? `${C.magenta}[PRERUN]${C.reset}` : `${C.dim}[SYNTHETIC]${C.reset}`;
const statusColor = (s: string) => (s === "BREACH" ? C.red : s === "WATCH" ? C.yellow : s === "PASS" ? C.green : C.dim);

function line() {
  console.log(C.dim + "─".repeat(78) + C.reset);
}

// ---- The money-shot: Thornwick total_net_leverage ----------------------
function moneyShot(): void {
  const bundle = corpus.find((b) => b.facts_id === "thornwick")!;
  const memory = buildMemoryContext(bundle, corpus);
  const covenant = bundle.covenants.find((c) => c.covenant_id === "total_net_leverage")!;
  const certificate = certificateFor(bundle, "q1-2026", "total_net_leverage");

  const a = assess(bundle, covenant, certificate, memory, {
    now: NOW,
    event_ids: ["ev-thornwick-fy2025-restatement"],
  });

  line();
  console.log(`${C.bold}THE MONEY-SHOT — Thornwick Logistics · Total Net Leverage${C.reset}`);
  line();
  console.log(
    `  Certificate:  ${C.dim}${a.certified.certified_value}x — ${a.certified.certified_status}${C.reset}  ${label("SYNTHETIC")}`
  );
  console.log(
    `  Recompute:    ${statusColor(a.status)}${C.bold}${a.recomputed_value}x — ${a.status}${C.reset}  (${a.authoritative_basis}, limit ${a.threshold?.value}x, headroom ${a.headroom?.toFixed(2)})  ${label("REAL")}`
  );
  console.log(
    `  ${C.bold}${a.certified.certification_conflict ? C.red + "FLIP: certificate GREEN, recompute BREACH" : "no conflict"}${C.reset}`
  );
  console.log(`  ${C.dim}EBITDA bridge:${C.reset} stated ${a.recompute.stated_total} → disallowed ${a.recompute.disallowed_add_backs.map((d) => `${d.category} ${d.amount}`).join(", ")}; adj ${a.recompute.adjustments_applied.map((x) => x.amount).join(", ")}`);
  if (a.memory.hit) {
    const m = a.memory.matches[0];
    console.log(`  ${C.cyan}memory:${C.reset} ${m.relation.join("+")} → ${m.prior_facts_id} (${m.shared_add_back_category})`);
  }

  // Human attest gate → PRERUN serve
  const attestation = makeAttestation(a.proposed_write!, "ATTEST", { analyst_id: "an-01", name: "A. Vergdefinetta", role: "credit_analyst" }, NOW, "Confirmed against restated FY2025.");
  const result = attest(a.proposed_write!, attestation);
  const receipt = serveIfCommitted(result, NOW, { note: "PRERUN — synthetic sandbox target" });

  const sb = new Scoreboard(NOW);
  sb.scan(a, { triggerEventId: "ev-thornwick-fy2025-restatement", triggerLabel: "REAL", triggerSource: "you_research_ari" });
  sb.attested(a, attestation);
  sb.writeResult(a, result, receipt);

  console.log("");
  console.log(`  ${C.bold}Scoreboard${C.reset}`);
  for (const e of sb.events) {
    console.log(`   ${C.dim}${String(e.seq).padStart(2)}${C.reset}  ${e.event.padEnd(16)} ${label(e.provenance_label)}`);
  }
  console.log(`  ${C.dim}serve receipt: ${receipt?.receipt_id.slice(0, 16)}… (${receipt?.provenance_label})${C.reset}`);
}

// ---- Whole-corpus sweep ------------------------------------------------
function sweep(): void {
  line();
  console.log(`${C.bold}CORPUS SWEEP — 6 borrowers, authoritative basis${C.reset}`);
  line();
  for (const bundle of corpus) {
    const memory = buildMemoryContext(bundle, corpus);
    for (const period of bundle.periods) {
      for (const covenant of bundle.covenants) {
        const certificate = certificateFor(bundle, period.period_id, covenant.covenant_id);
        const a: Assessment = assess(bundle, covenant, certificate, memory, { now: NOW, target_period_id: period.period_id });
        const flags = [
          a.certified.certification_conflict ? `${C.red}conflict${C.reset}` : "",
          a.drift.detected ? `${C.yellow}drift${C.reset}` : "",
          a.memory.hit ? `${C.cyan}memory${C.reset}` : "",
        ].filter(Boolean).join(" ");
        console.log(
          `  ${bundle.borrower.short_name?.padEnd(22) ?? bundle.facts_id.padEnd(22)} ${period.period_id.padEnd(12)} ${covenant.covenant_id.padEnd(20)} ` +
            `${statusColor(a.status)}${a.status.padEnd(7)}${C.reset} ${String(a.recomputed_value).padStart(6)}x  ${flags}`
        );
      }
    }
  }
}

moneyShot();
console.log("");
sweep();
line();
console.log(`${C.green}${C.bold}✓ Deterministic core end-to-end — the demo is real before You.com makes it live.${C.reset}`);
