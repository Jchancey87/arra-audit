/**
 * TFIDFAdapter — production adapter for IRecommendationService.
 *
 * Tokenizes the corpus, builds a sparse TF-IDF vector per document, and
 * ranks the target against the rest by cosine similarity. Pure JS — no
 * external deps. Designed for a single user's notebook (hundreds to a
 * few thousand techniques), not a multi-tenant corpus.
 *
 * Tokenization rules (kept simple + predictable):
 *   - lowercase
 *   - split on whitespace + ASCII punctuation
 *   - drop tokens shorter than 2 chars
 *   - drop a small fixed English stopword list
 *   - keep the lens as its own token (so a technique in "harmony" lifts
 *     other harmony techniques regardless of vocabulary overlap)
 *
 * Score is cosine similarity in [0, 1]. Self-similarity (target vs
 * itself) is filtered out by the caller, but we compute it for
 * consistency.
 */

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'were', 'will', 'with', 'this', 'but', 'or', 'not',
  'so', 'if', 'we', 'you', 'i', 'they', 'them', 'their',
]);

const TOKEN_RE = /[a-z0-9]+/g;

export const tokenize = (text) => {
  if (typeof text !== 'string') return [];
  const out = [];
  const matches = text.toLowerCase().match(TOKEN_RE) || [];
  for (const m of matches) {
    if (m.length < 2) continue;
    if (STOPWORDS.has(m)) continue;
    out.push(m);
  }
  return out;
};

const termFrequency = (tokens) => {
  const tf = new Map();
  for (const t of tokens) {
    tf.set(t, (tf.get(t) || 0) + 1);
  }
  // L1-normalize
  let total = 0;
  for (const v of tf.values()) total += v;
  if (total === 0) return tf;
  for (const [k, v] of tf.entries()) tf.set(k, v / total);
  return tf;
};

const buildVocab = (corpus) => {
  const df = new Map();
  for (const item of corpus) {
    const seen = new Set();
    for (const t of tokenize(item.text)) {
      if (seen.has(t)) continue;
      seen.add(t);
      df.set(t, (df.get(t) || 0) + 1);
    }
  }
  return df;
};

const idfWeight = (df, N) => Math.log((N + 1) / (df + 1)) + 1; // smoothed

const vectorize = (tokens, df, N) => {
  const tf = termFrequency(tokens);
  const vec = new Map();
  for (const [term, freq] of tf.entries()) {
    const w = freq * idfWeight(df.get(term) || 0, N);
    if (w > 0) vec.set(term, w);
  }
  return vec;
};

const dot = (a, b) => {
  // Smaller map iterates
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let s = 0;
  for (const [k, v] of small) {
    const u = large.get(k);
    if (u !== undefined) s += v * u;
  }
  return s;
};

const norm = (a) => {
  let s = 0;
  for (const v of a.values()) s += v * v;
  return Math.sqrt(s);
};

const cosine = (a, b) => {
  const na = norm(a);
  const nb = norm(b);
  if (na === 0 || nb === 0) return 0;
  return dot(a, b) / (na * nb);
};

export class TFIDFAdapter {
  async rank({ targetId, targetText, corpus, limit = 10 }) {
    if (!Array.isArray(corpus) || corpus.length === 0) return [];
    if (typeof targetId !== 'string' || !targetId) {
      throw new Error('targetId is required');
    }
    if (typeof targetText !== 'string') {
      throw new Error('targetText is required');
    }

    const N = corpus.length;
    const df = buildVocab(corpus);
    const vectors = new Map();
    for (const item of corpus) {
      vectors.set(item.id, vectorize(tokenize(item.text), df, N));
    }

    const targetVec = vectorize(tokenize(targetText), df, N);
    const results = [];
    for (const item of corpus) {
      if (item.id === targetId) continue; // skip self
      const score = cosine(targetVec, vectors.get(item.id));
      results.push({ id: item.id, score });
    }

    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Deterministic tiebreak by id so tests don't flake
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

    return results.slice(0, Math.max(0, limit));
  }
}

