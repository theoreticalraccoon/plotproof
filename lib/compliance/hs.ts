/**
 * HS-code classifier, the data-science front door. A farmer types what they
 * grow in their own words; we map it to the international HS code customs needs.
 *
 * This is a transparent keyword/token-overlap baseline with a clear ML seam:
 * swap `classify` for an embedding or LLM classifier later without changing
 * callers. Pure, products are injected so it's Node-testable.
 */
import type { HsCandidate, Product } from "./types";

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Ranked HS candidates for a free-text product description. */
export function classify(text: string, products: Product[]): HsCandidate[] {
  const q = new Set(tokens(text));
  if (q.size === 0) return [];

  const scored = products.map((p) => {
    const hay = new Set([...tokens(p.name), ...p.synonyms.flatMap(tokens), ...tokens(p.category)]);
    let hits = 0;
    for (const t of q) if (hay.has(t)) hits++;
    // Normalise by query length so short, exact matches score high.
    const score = hits / q.size;
    return { hsCode: p.hsCode, productId: p.id, name: p.name, score: Math.round(score * 100) / 100 };
  });

  return scored
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}
