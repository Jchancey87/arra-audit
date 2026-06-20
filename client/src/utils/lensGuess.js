export const LENS_KEYWORDS = {
  rhythm: [
    'kick', 'snare', 'hi-hat', 'hihat', 'drum', 'beat', 'groove', 'pocket',
    'bpm', 'tempo', 'swing', 'shuffle', 'syncopation', 'syncopated', 'ghost note',
    'rim', 'clap', 'percussion', 'rhythm', 'rhythmic', 'pulse', 'grid', 'pushed',
    'pulled', 'feel', 'straight', 'triplet', 'breakbeat', 'roll', 'fill',
  ],
  texture: [
    'reverb', 'delay', 'filter', 'saturate', 'saturation', 'distortion', 'drive',
    'compression', 'compressor', 'limiter', 'sidechain', 'chorus', 'phaser',
    'flanger', 'panner', 'width', 'stereo', 'low-pass', 'high-pass', 'band-pass',
    'eq', 'cutoff', 'resonance', 'granular', 'shimmer', 'texture', 'layered',
    'layer', 'sound design', 'patch', 'synthesis', 'sub', 'air', 'presence',
  ],
  harmony: [
    'chord', 'chords', 'progression', 'voicing', 'voicings', 'inversion',
    'borrowed', 'borrowing', 'modal', 'mode', 'major', 'minor', 'diminished',
    'augmented', 'seventh', 'ninth', 'eleventh', 'thirteenth', 'tritone',
    'suspension', 'pedal', 'key', 'key change', 'modulation', 'tonic',
    'subdominant', 'dominant', 'resolution', 'voice leading', 'counterpoint',
    'diatonic', 'chromatic', 'dissonance', 'consonance', 'harmony', 'harmonic',
    'melody', 'melodic', 'phrase', 'contour',
  ],
  arrangement: [
    'intro', 'verse', 'chorus', 'bridge', 'outro', 'hook', 'pre-chorus',
    'breakdown', 'drop', 'build', 'build-up', 'section', 'form', 'structure',
    'transition', 'arrangement', 'arranged', 'arc', 'density', 'automation',
    'energy', 'dynamic', 'dynamics', 'instrumentation', 'tempo change', 'silence',
    'pause', 'stop', 'tension', 'release', 'lift', 'drop-out',
  ],
};

const FALLBACK_LENS = 'arrangement';
const TIEBREAK_ORDER = ['rhythm', 'texture', 'harmony', 'arrangement'];

export function guessLens(text, { minScore = 1 } = {}) {
  if (!text || typeof text !== 'string') return FALLBACK_LENS;
  const lower = text.toLowerCase();
  const tokens = lower.split(/[^a-z0-9-]+/).filter(Boolean);
  if (tokens.length === 0) return FALLBACK_LENS;

  const scores = {};
  for (const [lens, keywords] of Object.entries(LENS_KEYWORDS)) {
    let count = 0;
    for (const kw of keywords) {
      const pattern = new RegExp(`(?:^|[^a-z0-9])${escapeRegex(kw)}(?:[^a-z0-9]|$)`, 'i');
      if (pattern.test(lower)) count += 1;
    }
    scores[lens] = count;
  }

  let best = FALLBACK_LENS;
  let bestScore = minScore - 1;
  for (const lens of TIEBREAK_ORDER) {
    if (scores[lens] > bestScore) {
      bestScore = scores[lens];
      best = lens;
    }
  }
  return best;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
