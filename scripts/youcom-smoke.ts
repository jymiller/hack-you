// Live You.com smoke test — proves a REAL Search + ARI call routes through the API (the bounty
// needs ≥1 real endpoint hit, visible in usage logs). Uses the real client; falls back cleanly if
// no key. Run: npm run smoke   (or: tsx scripts/youcom-smoke.ts). Never prints the key.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ARI_QUESTION, SEARCH_QUERY, researchAri, searchLiveWeb } from "../src/server/youcom.js";

try { process.loadEnvFile(join(dirname(fileURLToPath(import.meta.url)), "..", ".env")); } catch { /* no .env */ }

const C = { g: "\x1b[32m", m: "\x1b[35m", d: "\x1b[2m", b: "\x1b[1m", r: "\x1b[0m" };
const tag = (l: string) => (l === "REAL" ? `${C.g}[REAL]${C.r}` : l === "PRERUN" ? `${C.m}[PRERUN]${C.r}` : `${C.d}[${l}]${C.r}`);

console.log(`${C.b}You.com live smoke test${C.r}  (key ${process.env.YDC_API_KEY ? "present" : "ABSENT → fallback"})\n`);

console.log(`${C.b}1) Search${C.r}  freshness=day livecrawl=news`);
const s = await searchLiveWeb(SEARCH_QUERY, { freshness: "day", livecrawl: "news" });
console.log(`   ${tag(s.label)}  ${s.hits.length} hits · ${s.latency_ms}ms${s.note ? " · " + s.note : ""}`);
for (const h of s.hits.slice(0, 3)) console.log(`   ${C.d}·${C.r} ${h.title ?? h.url}  ${C.d}(${h.publisher ?? ""})${C.r}`);

console.log(`\n${C.b}2) Research / ARI${C.r}  standard · background:true`);
const a = await researchAri(ARI_QUESTION);
console.log(`   ${tag(a.label)}  ${a.sources.length} sources · ${(a.latency_ms / 1000).toFixed(1)}s · task ${a.task_id ?? "—"}${a.note ? " · " + a.note : ""}`);
console.log(`   ${C.d}summary:${C.r} ${a.summary.slice(0, 160)}…`);
console.log(`   ${C.d}actions:${C.r} ${a.lender_actions.length}`);
for (const src of a.sources.slice(0, 3)) console.log(`   ${C.d}↗${C.r} ${src.title ?? src.url}`);

const realHit = s.label === "REAL" || a.label === "REAL";
console.log(`\n${realHit ? C.g + "✓ at least one REAL You.com endpoint hit — usage logged." : C.m + "⚠ ran on fallback (no key) — set YDC_API_KEY for live."}${C.r}`);
