// Corpus loader — reads the six SYNTHETIC fixtures and builds a MemoryContext
// (a deterministic cross-deal resolver keyed by sponsor_id). No network, no live lookup.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { FactsBundle, MemoryContext } from "./kernel/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const FIXTURES_DIR = join(__dirname, "..", "fixtures");

export function loadBundle(file: string): FactsBundle {
  const raw = readFileSync(join(FIXTURES_DIR, file), "utf8");
  return JSON.parse(raw) as FactsBundle;
}

export function loadCorpus(): FactsBundle[] {
  return readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => loadBundle(f));
}

// Index bundles by sponsor_id so memory.bySponsor(id) returns siblings (excluding self).
export function buildMemoryContext(self: FactsBundle, corpus: FactsBundle[]): MemoryContext {
  const bySponsor = new Map<string, FactsBundle[]>();
  for (const b of corpus) {
    const sid = b.borrower.sponsor?.sponsor_id;
    if (!sid) continue;
    const list = bySponsor.get(sid) ?? [];
    list.push(b);
    bySponsor.set(sid, list);
  }
  return {
    self: self.memory ?? null,
    bySponsor(sponsor_id: string): FactsBundle[] {
      return (bySponsor.get(sponsor_id) ?? []).filter((b) => b.facts_id !== self.facts_id);
    },
  };
}

// Convenience: load the corpus and return {bundle, memory} for one facts_id.
export function withMemory(factsId: string): { bundle: FactsBundle; memory: MemoryContext } {
  const corpus = loadCorpus();
  const bundle = corpus.find((b) => b.facts_id === factsId || b.borrower.borrower_id === factsId);
  if (!bundle) throw new Error(`No fixture for '${factsId}'`);
  return { bundle, memory: buildMemoryContext(bundle, corpus) };
}
