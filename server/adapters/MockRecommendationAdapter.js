/**
 * MockRecommendationAdapter — deterministic in-memory adapter for tests
 * and offline development. Mirrors the shape of TFIDFAdapter but uses
 * a hash-stable shuffle so the same input always returns the same
 * ranking (useful for snapshot-style assertions).
 *
 * Ranking: simplest possible "shares a tag" sim, with a small jitter
 * seeded by the pair (targetId, otherId). A technique is preferred
 * if it shares ≥1 tag with the target, then by the jitter score.
 */

import { createHash } from 'crypto';

const stableSeed = (a, b) => {
  const h = createHash('sha256');
  h.update([a, b].sort().join('|'));
  const buf = h.digest();
  return buf.readUInt32BE(0);
};

const jaccard = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0) return 0;
  const A = new Set(a.map(String));
  const B = new Set(b.map(String));
  let inter = 0;
  for (const x of A) if (B.has(x)) inter += 1;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
};

export class MockRecommendationAdapter {
  constructor({ mode = 'tag-jaccard' } = {}) {
    this.mode = mode;
  }

  async rank({ targetId, targetText, corpus, limit = 10 } = {}) {
    if (!targetId || !corpus) return [];

    // For tag-jaccard mode, we'd need per-item tags. The corpus payload
    // is opaque to the adapter (just {id, text}), so we extract tags by
    // looking for tokens after a `#` prefix. This is intentionally
    // simple — tests pass pre-tokenized corpora when they need precision.
    const extractTags = (text) => {
      if (typeof text !== 'string') return [];
      const out = [];
      for (const part of text.split(/\s+/)) {
        if (part.startsWith('#') && part.length > 1) out.push(part.slice(1).toLowerCase());
      }
      return out;
    };

    const targetTags = extractTags(targetText);

    const results = [];
    for (const item of corpus) {
      if (item.id === targetId) continue;
      const seed = stableSeed(targetId, item.id);
      const jitter = (seed % 1000) / 10000; // 0..0.1
      const overlap = this.mode === 'tag-jaccard' ? jaccard(targetTags, extractTags(item.text)) : 0;
      const score = Math.min(1, 0.4 * overlap + 0.05 + jitter);
      results.push({ id: item.id, score });
    }
    results.sort((a, b) => (b.score - a.score) || (a.id < b.id ? -1 : 1));
    return results.slice(0, Math.max(0, limit));
  }
}

export default MockRecommendationAdapter;
