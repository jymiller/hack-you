// §6 — cross-deal sponsor memory. The join key is sponsor_id; the demo hit is Thornwick
// (sponsor Ardenmoor) → Halveston (same sponsor, same disallowed run-rate synergy, two years earlier).
// Retrieval across bundles is something a big context window cannot fake.

import type { Assessment, Covenant, FactsBundle, MemoryContext, Observation, Status } from "./types.js";

export type MemoryResult = Assessment["memory"];

function disallowedCategories(obs: Observation): Set<string> {
  const cats = new Set<string>();
  for (const ab of obs.ebitda_build?.add_backs ?? []) {
    if (ab.allowed === false) cats.add(ab.category);
  }
  return cats;
}

// A sibling "exhibits the pattern" if any of its observations disallows an add-back in one of the
// current categories.
function siblingExhibits(sibling: FactsBundle, categories: Set<string>): { matched: boolean; category: string | null } {
  for (const p of sibling.periods) {
    for (const o of p.observations) {
      for (const ab of o.ebitda_build?.add_backs ?? []) {
        if (ab.allowed === false && categories.has(ab.category)) {
          return { matched: true, category: ab.category };
        }
      }
    }
  }
  return { matched: false, category: null };
}

export function consultMemory(
  facts: FactsBundle,
  _covenant: Covenant,
  obs: Observation,
  status: Status,
  memory: MemoryContext
): MemoryResult {
  const disallowed = disallowedCategories(obs);
  const consulted = status === "BREACH" || disallowed.size > 0;
  const empty: MemoryResult = { consulted, hit: false, matches: [] };

  if (!consulted) return { consulted, hit: false, matches: [] };

  const sponsorId = facts.borrower.sponsor?.sponsor_id;
  if (!sponsorId) return empty;

  // Candidate priors: siblings by sponsor ∪ deals named in self.related_deals.
  const siblings = memory.bySponsor(sponsorId);
  const relatedIds = new Set((memory.self?.related_deals ?? []).map((d) => d.facts_id));
  const candidates = siblings.filter(
    (s) => s.borrower.sponsor?.sponsor_id === sponsorId || relatedIds.has(s.facts_id)
  );

  const matches: MemoryResult["matches"] = [];
  for (const sib of candidates) {
    const { matched, category } = siblingExhibits(sib, disallowed);
    if (!matched) continue;

    const relations = new Set<string>(["same_sponsor"]);
    for (const d of memory.self?.related_deals ?? []) {
      if (d.facts_id === sib.facts_id || d.borrower_id === sib.borrower.borrower_id) relations.add(d.relation);
    }

    matches.push({
      prior_facts_id: sib.facts_id,
      borrower_id: sib.borrower.borrower_id,
      sponsor_id: sponsorId,
      relation: [...relations],
      pattern_tags: memory.self?.pattern_tags ?? [],
      shared_add_back_category: category,
      note: (memory.self?.related_deals ?? []).find((d) => d.facts_id === sib.facts_id)?.note ?? null,
    });
  }

  return { consulted, hit: matches.length > 0, matches };
}
