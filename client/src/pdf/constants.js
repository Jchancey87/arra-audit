// Pure PDF constants — no @react-pdf/renderer import.
// Split out of theme.js so that pure data-transform modules (pdfData.js,
// arrangementPdfData.js) can consume lens labels without transitively
// pulling the ~1.6 MB react-pdf bundle into their chunk.

export const LENS_LABELS = {
  rhythm: 'Rhythm',
  texture: 'Texture',
  harmony: 'Harmony',
  arrangement: 'Arrangement',
};

export const LENS_DESCRIPTIONS = {
  rhythm: 'Pulse, groove, timing feel, micro-timing, subdivision and swing.',
  texture: 'Timbre, layering, density, articulation, frequency balance and spatial width.',
  harmony: 'Chord movement, voice leading, modal colour, extensions and substitutions.',
  arrangement: 'Form, structure, section transitions, dynamics, instrumentation and energy arc.',
};
