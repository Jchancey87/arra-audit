import { describe, test, expect } from '@jest/globals';
import { TFIDFAdapter, tokenize } from '../../adapters/TFIDFAdapter.js';
import { MockRecommendationAdapter } from '../../adapters/MockRecommendationAdapter.js';

describe('tokenize', () => {
  test('lowercases and splits on non-letters', () => {
    expect(tokenize('Hello, World! 42 things.')).toEqual(['hello', 'world', '42', 'things']);
  });

  test('drops single-character tokens', () => {
    expect(tokenize('a b c dog')).toEqual(['dog']);
  });

  test('drops common stopwords', () => {
    expect(tokenize('the quick brown fox is not lazy')).toEqual(['quick', 'brown', 'fox', 'lazy']);
  });

  test('handles non-string input', () => {
    expect(tokenize(null)).toEqual([]);
    expect(tokenize(undefined)).toEqual([]);
    expect(tokenize(42)).toEqual([]);
  });

  test('preserves hyphenated compounds as separate tokens (minus stopwords)', () => {
    // "on" and "the" are stopwords and get dropped; the rest survive
    expect(tokenize('four-on-the-floor kick')).toEqual(['four', 'floor', 'kick']);
  });
});

describe('TFIDFAdapter.rank', () => {
  const adapter = new TFIDFAdapter();

  const makeCorpus = () => [
    { id: 'a', text: 'four-on-the-floor kick drum pattern with side-chain compression' },
    { id: 'b', text: 'wide stereo synth pad with heavy reverb and tape saturation' },
    { id: 'c', text: '909 kick drum and Reese bass with side-chain pumping' },
    { id: 'd', text: 'minimal techno arrangement with hypnotic loops' },
  ];

  test('excludes the target from results', async () => {
    const corpus = makeCorpus();
    const out = await adapter.rank({
      targetId: 'a',
      targetText: corpus[0].text,
      corpus,
      limit: 10,
    });
    expect(out.find((r) => r.id === 'a')).toBeUndefined();
  });

  test('ranks semantically similar techniques higher', async () => {
    const corpus = makeCorpus();
    const out = await adapter.rank({
      targetId: 'a',
      targetText: corpus[0].text,
      corpus,
      limit: 5,
    });
    // c shares "kick", "drum", "side-chain" → should be top
    expect(out[0].id).toBe('c');
    expect(out[0].score).toBeGreaterThan(out[1].score);
  });

  test('returns at most `limit` results', async () => {
    const corpus = makeCorpus();
    const out = await adapter.rank({
      targetId: 'a',
      targetText: corpus[0].text,
      corpus,
      limit: 2,
    });
    expect(out).toHaveLength(2);
  });

  test('scores are in [0, 1]', async () => {
    const corpus = makeCorpus();
    const out = await adapter.rank({
      targetId: 'a',
      targetText: corpus[0].text,
      corpus,
      limit: 10,
    });
    for (const r of out) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1);
    }
  });

  test('deterministic tiebreak by id ascending', async () => {
    // Two corpora that should produce identical scores for some pairs.
    // The first call seeds the sort; the second call's ids differ only
    // in the candidate that ties — the sort is by score desc, then id asc.
    const corpus1 = [
      { id: 'a', text: 'rhythm texture harmony' },
      { id: 'b', text: 'rhythm texture harmony' },
      { id: 'c', text: 'rhythm texture harmony' },
    ];
    const out = await adapter.rank({ targetId: 'a', targetText: corpus1[0].text, corpus: corpus1 });
    // b < c lexicographically → b should come first
    expect(out[0].id).toBe('b');
    expect(out[1].id).toBe('c');
  });

  test('returns empty array for empty corpus', async () => {
    const out = await adapter.rank({ targetId: 'a', targetText: 'x', corpus: [] });
    expect(out).toEqual([]);
  });

  test('throws on missing targetId', async () => {
    await expect(adapter.rank({ targetText: 'x', corpus: [{ id: 'a', text: 'y' }] })).rejects.toThrow(/targetId/);
  });

  test('handles single-document corpus gracefully (no self in results)', async () => {
    const out = await adapter.rank({
      targetId: 'only',
      targetText: 'a single document',
      corpus: [{ id: 'only', text: 'a single document' }],
    });
    expect(out).toEqual([]);
  });

  test('lifts techniques that share the same lens even with no vocab overlap', async () => {
    const corpus = [
      { id: 'rhythm-1', text: 'polyrhythmic groove' },
      { id: 'harmony-1', text: 'polyrhythmic groove' },
      { id: 'rhythm-2', text: 'completely different words here' },
    ];
    const out = await adapter.rank({
      targetId: 'rhythm-1',
      targetText: 'polyrhythmic groove',
      corpus,
    });
    // rhythm-1 == target (excluded); harmony-1 has identical text and
    // should beat rhythm-2 on the lens token
    expect(out[0].id).toBe('harmony-1');
    expect(out[0].score).toBeGreaterThan(out[1].score);
  });
});

describe('MockRecommendationAdapter.rank', () => {
  const adapter = new MockRecommendationAdapter();

  test('returns deterministic results for the same input', async () => {
    const corpus = [
      { id: 'a', text: '#bass #reese rolling' },
      { id: 'b', text: '#bass #synth wide' },
      { id: 'c', text: '#drum #break heavy' },
    ];
    const a = await adapter.rank({ targetId: 'a', targetText: corpus[0].text, corpus });
    const b = await adapter.rank({ targetId: 'a', targetText: corpus[0].text, corpus });
    expect(a).toEqual(b);
  });

  test('excludes the target from results', async () => {
    const corpus = [
      { id: 'a', text: '#tag stuff' },
      { id: 'b', text: '#tag other' },
    ];
    const out = await adapter.rank({ targetId: 'a', targetText: corpus[0].text, corpus });
    expect(out.find((r) => r.id === 'a')).toBeUndefined();
  });

  test('prefers techniques that share a tag with the target', async () => {
    const corpus = [
      { id: 'a', text: '#hiphop #sample chopped' },
      { id: 'b', text: '#hiphop #808 swung' },
      { id: 'c', text: '#ambient #pad' },
    ];
    const out = await adapter.rank({ targetId: 'a', targetText: corpus[0].text, corpus });
    // b shares #hiphop; c shares nothing
    expect(out[0].id).toBe('b');
    expect(out[1].id).toBe('c');
    expect(out[0].score).toBeGreaterThan(out[1].score);
  });

  test('returns empty for empty input', async () => {
    expect(await adapter.rank({ targetId: 'a', targetText: 'x', corpus: [] })).toEqual([]);
    expect(await adapter.rank({ targetId: null, targetText: 'x', corpus: [{ id: 'a', text: 'y' }] })).toEqual([]);
  });
});
