export const LENS_PROMPTS = {
  harmony: [
    { title: 'Chord Motion', question: 'Where does the bass imply a different chord inversion than the root position?' },
    { title: 'Harmonic Surprise', question: 'Identify one borrowed chord or unexpected harmonic color. What makes it work?' },
    { title: 'Steal Move', question: 'What chord movement or voicing technique would you steal for your own productions?' },
  ],
  rhythm: [
    { title: 'Groove Pocket', question: 'How does the bass relate to the kick and snare? Where does it push or pull against the grid?' },
    { title: 'Syncopation Map', question: 'Identify the primary syncopation pattern. Which beats are emphasized and which are ghosted?' },
    { title: 'Steal Move', question: 'What rhythmic technique or feel would you extract for your own productions?' },
  ],
  form: [
    { title: 'Section Architecture', question: 'Map out the song\u2019s sections. Where does the form surprise you or deviate from convention?' },
    { title: 'Transition Technique', question: 'How does the song move between sections? What elements signal a change?' },
    { title: 'Steal Move', question: 'What structural technique would you borrow for your own arrangements?' },
  ],
  texture: [
    { title: 'Layer Inventory', question: 'List every sound/instrument you can identify. How do they occupy frequency space?' },
    { title: 'Density Arc', question: 'How does the arrangement density change over time? Where is it thinnest and thickest?' },
    { title: 'Steal Move', question: 'What production texture or layering choice would you recreate?' },
  ],
  melody: [
    { title: 'Motif Tracker', question: 'Identify the main melodic motif. How does it transform over the course of the song?' },
    { title: 'Phrase Shape', question: 'Describe the contour of one full melodic phrase. Where does it peak?' },
    { title: 'Steal Move', question: 'What melodic device (interval, ornament, repetition) would you borrow?' },
  ],
};

export const LENS_LABEL = {
  harmony: 'Harmony',
  rhythm: 'Rhythm',
  form: 'Form',
  texture: 'Texture',
  melody: 'Melody',
};

// Region colors per lens — used by the universal wavesurfer RegionsPlugin
// overlay so bookmarks / tagged timestamps are color-coded by the lens they
// belong to. arrangement is included for sections on arrangement/form days.
export const LENS_REGION_COLOR = {
  harmony:      '#c084fc',
  rhythm:       '#34d399',
  form:         '#f472b6',
  texture:      '#22d3ee',
  melody:       '#fbbf24',
  arrangement:  '#ff6600',
};

// Section type colors for arrangement regions (mirrors the TYPE_COLORS map
// in ArrangementTimelineWidget — kept here so non-arrangement surfaces can
// build section regions without importing the widget).
export const SECTION_TYPE_COLORS = {
  intro:        '#a78bfa',
  verse:        '#34d399',
  chorus:       '#22d3ee',
  bridge:       '#fbbf24',
  outro:        '#ffd700',
  'pre-chorus': '#ff6f61',
  solo:         '#ff6600',
  custom:       '#f472b6',
};
