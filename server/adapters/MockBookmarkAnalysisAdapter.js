/**
 * MockBookmarkAnalysisAdapter — deterministic in-memory adapter for tests
 * and offline development. Mirrors the shape of CLAPSegmentAdapter but
 * never touches the network or the GPU.
 *
 * The result is seeded by (audioId, startSeconds, endSeconds) so the same
 * bookmark always returns the same analysis — keeps tests reproducible.
 */

import { createHash } from 'crypto';

const MOOD_TAGS = [
  'energetic', 'melancholic', 'dreamy', 'aggressive', 'intimate',
  'triumphant', 'tense', 'uplifting', 'dark', 'playful',
];
const TIMBRE_TAGS = [
  'warm', 'bright', 'dark', 'harsh', 'smooth', 'percussive',
  'distorted', 'clean', 'reverberant', 'lo-fi',
];
const REFERENCE_TRACKS = [
  'Daft Punk - One More Time',
  'Boards of Canada - Roygbiv',
  'Radiohead - Everything In Its Right Place',
  'Burial - Archangel',
  'Aphex Twin - Xtal',
  'Flying Lotus - Never Catch Me',
  'Massive Attack - Teardrop',
  'Portishead - Wandering Star',
  'Brian Eno - Music for Airports',
  'Madlib - Take It Back',
];

const seededRng = (seed) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
};

const seedFrom = (...parts) => {
  const h = createHash('sha256');
  h.update(parts.filter((p) => p !== undefined && p !== null).join('|'));
  const buf = h.digest();
  return buf.readUInt32BE(0);
};

const buildTags = (rng, tags) => {
  const raw = tags.map((tag) => ({ tag, score: 0.05 + rng() * 0.4 }));
  const sum = raw.reduce((acc, t) => acc + t.score, 0) || 1;
  return raw
    .map((t) => ({ tag: t.tag, score: Math.round((t.score / sum) * 10000) / 10000 }))
    .sort((a, b) => b.score - a.score);
};

const pickSimilar = (rng) => {
  const pool = [...REFERENCE_TRACKS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
};

export class MockBookmarkAnalysisAdapter {
  constructor({ model = 'deterministic-v1', version = '2.3.0', latencyMs = 0, failureRate = 0 } = {}) {
    this.model = model;
    this.version = version;
    this.latencyMs = latencyMs;
    this.failureRate = failureRate;
  }

  async analyzeSegment({ audioId, startSeconds, endSeconds }) {
    if (this.latencyMs > 0) {
      await new Promise((r) => setTimeout(r, this.latencyMs));
    }
    if (this.failureRate > 0 && Math.random() < this.failureRate) {
      throw new Error('MockBookmarkAnalysisAdapter: simulated failure');
    }
    if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds)) {
      throw new Error('startSeconds and endSeconds are required and must be numbers');
    }
    if (endSeconds <= startSeconds) {
      throw new Error('endSeconds must be greater than startSeconds');
    }

    const seed = seedFrom(audioId || 'anon', startSeconds, endSeconds);
    const rng = seededRng(seed);

    return {
      model: this.model,
      version: this.version,
      mood_tags: buildTags(rng, MOOD_TAGS),
      timbre_tags: buildTags(rng, TIMBRE_TAGS),
      similar_to: pickSimilar(rng),
    };
  }
}

export default MockBookmarkAnalysisAdapter;
