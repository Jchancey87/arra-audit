/**
 * OpenAIEmbeddingAdapter — production adapter for IRecommendationService
 * that uses OpenAI's text-embedding-3-* models for vector semantics.
 *
 * Phase 2.4 v2: the spec calls for "TF-IDF first, OpenAI if results poor".
 * This adapter is the off-by-default upgrade path. Switch via env in
 * server.js:
 *
 *   RECOMMENDATION_ADAPTER=openai
 *   OPENAI_API_KEY=sk-...
 *   OPENAI_EMBEDDING_MODEL=text-embedding-3-small   (default; 1536 dims)
 *
 * Behaviour:
 *   - Deduplicates input texts and batches the OpenAI call (up to 100
 *     inputs per request — OpenAI's hard cap).
 *   - Caches embeddings by SHA-256 of the text so repeated re-rankings
 *     of the same notebook cost zero API calls.
 *   - Cosine similarity in [0, 1] (matches TFIDFAdapter's contract).
 *   - Network / auth / rate-limit errors throw a typed `OpenAIEmbeddingsError`
 *     so the service layer can fall back to TF-IDF on outage.
 *
 * Tests use an injected `fetchImpl` so the test suite never hits the
 * network. Production uses the global `fetch` (Node 18+).
 */

import { createHash } from 'crypto';

const DEFAULT_MODEL = 'text-embedding-3-small';
const DEFAULT_BATCH = 100;
const OPENAI_ENDPOINT = 'https://api.openai.com/v1/embeddings';

export class OpenAIEmbeddingsError extends Error {
  constructor(message, { cause, status } = {}) {
    super(message);
    this.name = 'OpenAIEmbeddingsError';
    this.cause = cause;
    this.status = status;
  }
}

const hashText = (text) =>
  createHash('sha256').update(String(text)).digest('hex');

const cosine = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    const y = b[i];
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
};

export class OpenAIEmbeddingAdapter {
  constructor({
    apiKey,
    model = DEFAULT_MODEL,
    batchSize = DEFAULT_BATCH,
    fetchImpl,
    endpoint = OPENAI_ENDPOINT,
  } = {}) {
    if (!apiKey || typeof apiKey !== 'string') {
      throw new OpenAIEmbeddingsError(
        'OpenAIEmbeddingAdapter requires an apiKey (set OPENAI_API_KEY in .env)'
      );
    }
    if (batchSize < 1 || batchSize > 2048) {
      throw new OpenAIEmbeddingsError('batchSize must be in [1, 2048]');
    }
    this.apiKey = apiKey;
    this.model = model;
    this.batchSize = batchSize;
    this.endpoint = endpoint;
    this.fetchImpl = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
    if (!this.fetchImpl) {
      throw new OpenAIEmbeddingsError('No fetch implementation available (Node 18+ required)');
    }
    this._cache = new Map();
  }

  clearCache() {
    this._cache.clear();
  }

  cacheSize() {
    return this._cache.size;
  }

  async _fetchEmbeddingsForTexts(texts) {
    const body = JSON.stringify({ model: this.model, input: texts });
    let response;
    try {
      response = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body,
      });
    } catch (err) {
      throw new OpenAIEmbeddingsError(`OpenAI embeddings request failed: ${err.message}`, { cause: err });
    }
    if (!response.ok) {
      let detail = '';
      try { detail = (await response.text()).slice(0, 500); } catch { /* ignore */ }
      throw new OpenAIEmbeddingsError(
        `OpenAI embeddings HTTP ${response.status}: ${detail}`,
        { status: response.status }
      );
    }
    let payload;
    try {
      payload = await response.json();
    } catch (err) {
      throw new OpenAIEmbeddingsError(`OpenAI returned non-JSON response`, { cause: err });
    }
    if (!payload || !Array.isArray(payload.data)) {
      throw new OpenAIEmbeddingsError('OpenAI response missing data[]');
    }
    if (payload.data.length !== texts.length) {
      throw new OpenAIEmbeddingsError(
        `OpenAI returned ${payload.data.length} embeddings for ${texts.length} inputs`
      );
    }
    return payload.data.map((row) => {
      if (!row || !Array.isArray(row.embedding)) {
        throw new OpenAIEmbeddingsError('OpenAI returned an embedding of unexpected shape');
      }
      return row.embedding;
    });
  }

  async _embedUnique(uniqueTexts) {
    const result = new Map();
    const missing = [];
    for (const t of uniqueTexts) {
      const key = hashText(t);
      if (this._cache.has(key)) {
        result.set(t, this._cache.get(key));
      } else {
        missing.push(t);
      }
    }
    for (let i = 0; i < missing.length; i += this.batchSize) {
      const batch = missing.slice(i, i + this.batchSize);
      const vectors = await this._fetchEmbeddingsForTexts(batch);
      for (let j = 0; j < batch.length; j += 1) {
        const text = batch[j];
        const vec = vectors[j];
        result.set(text, vec);
        this._cache.set(hashText(text), vec);
      }
    }
    return result;
  }

  async rank({ targetId, targetText, corpus, limit = 10 } = {}) {
    if (!targetId || typeof targetId !== 'string') {
      throw new Error('targetId is required');
    }
    if (typeof targetText !== 'string') {
      throw new Error('targetText is required');
    }
    if (!Array.isArray(corpus) || corpus.length === 0) return [];

    const uniqueTexts = Array.from(
      new Set([targetText, ...corpus.map((c) => String(c.text))])
    );
    const embeddingMap = await this._embedUnique(uniqueTexts);
    const targetVec = embeddingMap.get(targetText);

    const results = [];
    for (const item of corpus) {
      if (item.id === targetId) continue;
      const vec = embeddingMap.get(String(item.text));
      if (!vec) continue;
      const score = cosine(targetVec, vec);
      results.push({ id: item.id, score });
    }

    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

    return results.slice(0, Math.max(0, limit));
  }
}

export default OpenAIEmbeddingAdapter;
