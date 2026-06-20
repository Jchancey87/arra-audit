import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { OpenAIEmbeddingAdapter, OpenAIEmbeddingsError } from '../../adapters/OpenAIEmbeddingAdapter.js';

const fakeEmbedding = (dim, seed) => {
  const out = new Array(dim);
  let s = seed;
  for (let i = 0; i < dim; i += 1) {
    s = (s * 1664525 + 1013904223) >>> 0;
    out[i] = (s % 10000) / 10000 - 0.5;
  }
  return out;
};

const makeFetch = (handler) => jest.fn(async (url, init) => handler(url, init));

describe('OpenAIEmbeddingAdapter', () => {
  let calls;
  beforeEach(() => {
    calls = [];
  });

  describe('constructor', () => {
    it('throws OpenAIEmbeddingsError when apiKey is missing', () => {
      expect(() => new OpenAIEmbeddingAdapter({ apiKey: '' })).toThrow(OpenAIEmbeddingsError);
      expect(() => new OpenAIEmbeddingAdapter({})).toThrow(/apiKey/);
    });

    it('throws when batchSize is out of range', () => {
      expect(() => new OpenAIEmbeddingAdapter({ apiKey: 'sk-test', batchSize: 0 })).toThrow(OpenAIEmbeddingsError);
      expect(() => new OpenAIEmbeddingAdapter({ apiKey: 'sk-test', batchSize: 5000 })).toThrow(OpenAIEmbeddingsError);
    });

    it('throws when no fetch implementation is available', () => {
      const origFetch = global.fetch;
      delete global.fetch;
      try {
        expect(() => new OpenAIEmbeddingAdapter({ apiKey: 'sk-test' })).toThrow(/fetch/);
      } finally {
        if (origFetch) global.fetch = origFetch;
      }
    });

    it('accepts a valid config', () => {
      const a = new OpenAIEmbeddingAdapter({ apiKey: 'sk-test', fetchImpl: makeFetch(() => {}) });
      expect(a.model).toBe('text-embedding-3-small');
      expect(a.cacheSize()).toBe(0);
    });
  });

  describe('rank', () => {
    it('returns an empty list for empty corpus', async () => {
      const a = new OpenAIEmbeddingAdapter({ apiKey: 'sk-test', fetchImpl: makeFetch(() => {}) });
      expect(await a.rank({ targetId: 't', targetText: 'foo', corpus: [] })).toEqual([]);
    });

    it('throws when targetId is missing', async () => {
      const a = new OpenAIEmbeddingAdapter({ apiKey: 'sk-test', fetchImpl: makeFetch(() => {}) });
      await expect(a.rank({ targetText: 'foo', corpus: [{ id: 'a', text: 'x' }] })).rejects.toThrow(/targetId/);
    });

    it('throws when targetText is missing', async () => {
      const a = new OpenAIEmbeddingAdapter({ apiKey: 'sk-test', fetchImpl: makeFetch(() => {}) });
      await expect(a.rank({ targetId: 't', corpus: [{ id: 'a', text: 'x' }] })).rejects.toThrow(/targetText/);
    });

    it('ranks by cosine similarity and excludes the target', async () => {
      const fetchImpl = makeFetch((url, init) => {
        calls.push({ url, init });
        const inputs = JSON.parse(init.body).input;
        return {
          ok: true,
          json: async () => ({
            data: inputs.map((text, i) => ({ embedding: fakeEmbedding(8, i + 1) })),
          }),
        };
      });
      const a = new OpenAIEmbeddingAdapter({ apiKey: 'sk-test', fetchImpl });

      const corpus = [
        { id: 'a', text: 'first' },
        { id: 'b', text: 'second' },
        { id: 'c', text: 'third' },
        { id: 't', text: 'target' },
      ];

      const out = await a.rank({ targetId: 't', targetText: 'target', corpus, limit: 5 });
      expect(out).toHaveLength(3);
      expect(out.find((r) => r.id === 't')).toBeUndefined();
      expect(out.every((r) => r.score >= 0 && r.score <= 1)).toBe(true);
    });

    it('sorts by score desc with deterministic id tiebreak', async () => {
      const fetchImpl = makeFetch((url, init) => {
        const inputs = JSON.parse(init.body).input;
        return {
          ok: true,
          json: async () => ({
            data: inputs.map((_, i) => ({ embedding: fakeEmbedding(4, i + 100) })),
          }),
        };
      });
      const a = new OpenAIEmbeddingAdapter({ apiKey: 'sk-test', fetchImpl });

      const out = await a.rank({
        targetId: 't',
        targetText: 'target',
        corpus: [
          { id: 'z', text: 'x' },
          { id: 'a', text: 'y' },
          { id: 'm', text: 'z' },
        ],
      });
      const ids = out.map((r) => r.id);
      const sortedByScore = [...out].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.id < b.id ? -1 : 1;
      });
      expect(ids).toEqual(sortedByScore.map((r) => r.id));
    });

    it('deduplicates inputs and caches embeddings across calls', async () => {
      const fetchImpl = makeFetch((url, init) => {
        calls.push(init);
        const inputs = JSON.parse(init.body).input;
        return {
          ok: true,
          json: async () => ({
            data: inputs.map((_, i) => ({ embedding: fakeEmbedding(4, i + 7) })),
          }),
        };
      });
      const a = new OpenAIEmbeddingAdapter({ apiKey: 'sk-test', fetchImpl });

      const corpus = [
        { id: 'a', text: 'shared' },
        { id: 'b', text: 'shared' },
        { id: 'c', text: 'unique' },
        { id: 't', text: 'shared' },
      ];
      await a.rank({ targetId: 't', targetText: 'shared', corpus, limit: 5 });
      const firstCallInputs = JSON.parse(calls[0].body).input;
      expect(new Set(firstCallInputs).size).toBe(firstCallInputs.length);
      const uniqueTexts = new Set(['shared', 'unique']);
      expect(firstCallInputs.every((t) => uniqueTexts.has(t))).toBe(true);

      const before = a.cacheSize();
      await a.rank({ targetId: 't', targetText: 'shared', corpus, limit: 5 });
      expect(a.cacheSize()).toBe(before);
      expect(calls).toHaveLength(1);
    });

    it('batches large requests into chunks of batchSize', async () => {
      const fetchImpl = makeFetch((url, init) => {
        calls.push(init);
        const inputs = JSON.parse(init.body).input;
        return {
          ok: true,
          json: async () => ({ data: inputs.map((_, i) => ({ embedding: fakeEmbedding(3, i + 1) })) }),
        };
      });
      const a = new OpenAIEmbeddingAdapter({ apiKey: 'sk-test', fetchImpl, batchSize: 2 });
      const corpus = [
        { id: 'a', text: 't1' }, { id: 'b', text: 't2' }, { id: 'c', text: 't3' },
        { id: 'd', text: 't4' }, { id: 'e', text: 't5' },
      ];
      await a.rank({ targetId: 't', targetText: 't6', corpus, limit: 5 });
      expect(calls).toHaveLength(3);
      for (const c of calls) {
        const inputs = JSON.parse(c.body).input;
        expect(inputs.length).toBeLessThanOrEqual(2);
      }
    });

    it('throws OpenAIEmbeddingsError on non-2xx response', async () => {
      const fetchImpl = makeFetch(() => ({
        ok: false,
        status: 401,
        text: async () => 'unauthorized',
      }));
      const a = new OpenAIEmbeddingAdapter({ apiKey: 'sk-test', fetchImpl });
      await expect(
        a.rank({ targetId: 't', targetText: 'x', corpus: [{ id: 'a', text: 'y' }] })
      ).rejects.toThrow(/401/);
    });

    it('throws OpenAIEmbeddingsError on network failure', async () => {
      const fetchImpl = makeFetch(() => { throw new Error('ECONNREFUSED'); });
      const a = new OpenAIEmbeddingAdapter({ apiKey: 'sk-test', fetchImpl });
      await expect(
        a.rank({ targetId: 't', targetText: 'x', corpus: [{ id: 'a', text: 'y' }] })
      ).rejects.toThrow(OpenAIEmbeddingsError);
    });

    it('throws when response shape is invalid', async () => {
      const fetchImpl = makeFetch(() => ({ ok: true, json: async () => ({ data: 'oops' }) }));
      const a = new OpenAIEmbeddingAdapter({ apiKey: 'sk-test', fetchImpl });
      await expect(
        a.rank({ targetId: 't', targetText: 'x', corpus: [{ id: 'a', text: 'y' }] })
      ).rejects.toThrow(/data/);
    });

    it('uses Authorization Bearer header', async () => {
      const fetchImpl = makeFetch((url, init) => {
        calls.push({ url, init });
        const inputs = JSON.parse(init.body).input;
        return {
          ok: true,
          json: async () => ({ data: inputs.map(() => ({ embedding: fakeEmbedding(2, 1) })) }),
        };
      });
      const a = new OpenAIEmbeddingAdapter({ apiKey: 'sk-abc-123', fetchImpl });
      await a.rank({ targetId: 't', targetText: 'x', corpus: [{ id: 'a', text: 'y' }] });
      expect(calls[0].init.headers.Authorization).toBe('Bearer sk-abc-123');
      expect(calls[0].init.headers['Content-Type']).toBe('application/json');
      expect(calls[0].url).toBe('https://api.openai.com/v1/embeddings');
    });

    it('respects custom model + endpoint overrides', async () => {
      const fetchImpl = makeFetch((url, init) => {
        calls.push({ url, body: init.body });
        const inputs = JSON.parse(init.body).input;
        return {
          ok: true,
          json: async () => ({ data: inputs.map(() => ({ embedding: fakeEmbedding(2, 1) })) }),
        };
      });
      const a = new OpenAIEmbeddingAdapter({
        apiKey: 'sk-test',
        model: 'text-embedding-3-large',
        endpoint: 'https://example.test/v1/embeddings',
        fetchImpl,
      });
      await a.rank({ targetId: 't', targetText: 'x', corpus: [{ id: 'a', text: 'y' }] });
      expect(calls[0].url).toBe('https://example.test/v1/embeddings');
      expect(JSON.parse(calls[0].body).model).toBe('text-embedding-3-large');
    });

    it('limits output to limit', async () => {
      const fetchImpl = makeFetch((url, init) => {
        const inputs = JSON.parse(init.body).input;
        return {
          ok: true,
          json: async () => ({ data: inputs.map((_, i) => ({ embedding: fakeEmbedding(4, i + 1) })) }),
        };
      });
      const a = new OpenAIEmbeddingAdapter({ apiKey: 'sk-test', fetchImpl });
      const corpus = Array.from({ length: 20 }, (_, i) => ({ id: `id${i}`, text: `text${i}` }));
      const out = await a.rank({ targetId: 't', targetText: 'text0', corpus, limit: 5 });
      expect(out).toHaveLength(5);
    });
  });
});
