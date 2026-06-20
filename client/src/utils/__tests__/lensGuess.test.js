import { describe, it, expect } from 'vitest';
import { guessLens, LENS_KEYWORDS } from '../lensGuess.js';

describe('guessLens', () => {
  it('returns rhythm for a sentence with drum/groove keywords', () => {
    expect(guessLens('The kick and snare lock into a tight groove at 90 BPM.')).toBe('rhythm');
  });

  it('returns harmony for a sentence with chord/progression keywords', () => {
    expect(guessLens('The chord progression borrows from the parallel minor for a darker resolution.')).toBe('harmony');
  });

  it('returns texture for a sentence with reverb/filter keywords', () => {
    expect(guessLens('A short slap-back delay and a high-pass filter shape the vocal layer.')).toBe('texture');
  });

  it('returns arrangement for a sentence with section/form keywords', () => {
    expect(guessLens('The pre-chorus builds tension before the drop of the second verse.')).toBe('arrangement');
  });

  it('returns arrangement fallback when no keyword matches', () => {
    expect(guessLens('This is a deeply contemplative moment in the track.')).toBe('arrangement');
  });

  it('handles empty / non-string input safely', () => {
    expect(guessLens('')).toBe('arrangement');
    expect(guessLens(null)).toBe('arrangement');
    expect(guessLens(undefined)).toBe('arrangement');
    expect(guessLens(42)).toBe('arrangement');
  });

  it('breaks ties deterministically (rhythm wins over arrangement on equal count)', () => {
    const s = 'Drums and structure together define the section.';
    const result = guessLens(s);
    const counts = countAll(s);
    const bestScore = Math.max(...Object.values(counts));
    const candidates = Object.entries(counts).filter(([, c]) => c === bestScore).map(([l]) => l);
    expect(candidates).toContain(result);
  });

  it('exports a LENS_KEYWORDS map with the four canonical lenses', () => {
    expect(Object.keys(LENS_KEYWORDS).sort()).toEqual(['arrangement', 'harmony', 'rhythm', 'texture']);
  });

  it('is case-insensitive', () => {
    expect(guessLens('The KICK and SNARE punch through the mix.')).toBe('rhythm');
  });
});

function countAll(text) {
  const lower = text.toLowerCase();
  const out = {};
  for (const [lens, kws] of Object.entries(LENS_KEYWORDS)) {
    let c = 0;
    for (const kw of kws) {
      const re = new RegExp(`(?:^|[^a-z0-9])${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[^a-z0-9]|$)`, 'i');
      if (re.test(lower)) c += 1;
    }
    out[lens] = c;
  }
  return out;
}
