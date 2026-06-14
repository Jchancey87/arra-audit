import express from 'express';
import Curriculum from '../models/Curriculum.js';

function formatLabel(key) {
  return key
    .split('_')
    .map(word => {
      if (word === 'vs' || word === 'dna') {
        return word.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

const daysDataRaw = [
  {
    dayNumber: 1,
    lens: 'harmony',
    songQuery: 'Wichita Lineman Glen Campbell',
    songTitle: 'Wichita Lineman',
    artistName: 'Glen Campbell',
    listeningPrompt: 'Listen to the harmonic progression of the song. Focus on the chord voicings, key changes, and the tension/resolution. Pay attention to the maj7 and min7 chords.',
    applicationPrompt: 'Recreate the main chord progression or a section of it. Try using similar maj7 chord movements or unexpected chord changes in your own DAW sketch.',
    logFields: ['harmony_notes', 'harmonic_surprises', 'steal_move', 'sketch_filename']
  },
  {
    dayNumber: 2,
    lens: 'rhythm',
    songQuery: "What's Going On Marvin Gaye",
    songTitle: "What's Going On",
    artistName: 'Marvin Gaye',
    listeningPrompt: 'Analyze the syncopation, placement of the bass relative to the snare/kick, and how James Jamerson builds rhythm.',
    applicationPrompt: 'Write a syncopated groove in your DAW. Experiment with placing bass notes on weak beats or ghost notes.',
    logFields: ['rhythm_notes', 'strong_vs_weak', 'jamerson_pattern', 'sketch_filename']
  },
  {
    dayNumber: 3,
    lens: 'harmony',
    songQuery: 'God Only Knows The Beach Boys',
    songTitle: 'God Only Knows',
    artistName: 'The Beach Boys',
    listeningPrompt: 'Identify the inversions used in the bassline and how they create a feeling of continuous movement rather than resolving to root notes.',
    applicationPrompt: 'Write a chord progression where the bass plays the 3rd or 5th of each chord instead of the root, maintaining movement.',
    logFields: ['arrangement_notes', 'inversion_moments', 'emotional_effect', 'sketch_filename']
  },
  {
    dayNumber: 4,
    lens: 'arrangement',
    songQuery: 'Weird Fishes Arpeggi Radiohead',
    songTitle: 'Weird Fishes/Arpeggi',
    artistName: 'Radiohead',
    listeningPrompt: 'Listen to the building layers, arpeggio patterns, and how the sections transition organically without a traditional verse/chorus structure.',
    applicationPrompt: 'Create a layered structure that builds dynamically. Introduce and fade layers gradually to guide the listener\'s focus.',
    logFields: ['form_notes', 'section_map', 'transition_tricks', 'sketch_filename']
  },
  {
    dayNumber: 5,
    lens: 'texture',
    songQuery: 'She Moves She Four Tet',
    songTitle: 'She Moves She',
    artistName: 'Four Tet',
    listeningPrompt: 'Focus on the blend of acoustic instruments, glitches, found sounds, and electronic elements. Take an inventory of the textures.',
    applicationPrompt: 'Incorporate organic textures, field recordings, or micro-samples over an electronic beat in a DAW sketch.',
    logFields: ['texture_notes', 'texture_inventory', 'steal_move', 'sketch_filename']
  },
  {
    dayNumber: 6,
    lens: 'arrangement',
    songQuery: 'Integration Day 6',
    songTitle: 'Original Build 1',
    artistName: 'User Original',
    listeningPrompt: 'Reflect on the techniques explored this week (harmony, rhythm, inversions, texture, arrangement).',
    applicationPrompt: 'Start an original DAW sketch combining at least two of these concepts. Do not overthink, keep it raw.',
    logFields: ['original_notes', 'ingredients_used', 'natural_vs_forced', 'sketch_filename']
  },
  {
    dayNumber: 7,
    lens: 'arrangement',
    songQuery: 'Rest Day 7',
    songTitle: 'Weekly Reflection 1',
    artistName: 'System',
    listeningPrompt: 'No active listening required. Step away from the DAW. Let your ears rest.',
    applicationPrompt: 'Reflect on your weekly findings and log your answers to transition into the second week.',
    logFields: ['review_notes', 'ear_changes', 'biggest_confusion', 'investigation_question']
  },
  {
    dayNumber: 8,
    lens: 'arrangement',
    songQuery: 'Wichita Lineman Glen Campbell',
    songTitle: 'Wichita Lineman',
    artistName: 'Glen Campbell',
    listeningPrompt: 'Analyze how the arrangement grows and pulls back. Trace the strings, bass line, vocals, and sound effects (e.g. telegraph lines).',
    applicationPrompt: 'Draft an arrangement curve. Alternate between sparse sections (only rhythm/vocal) and dense sections (strings/layers).',
    logFields: ['arrangement_notes', 'arr_gestures', 'sparse_vs_dense', 'sketch_filename']
  },
  {
    dayNumber: 9,
    lens: 'rhythm',
    songQuery: "What's Going On Marvin Gaye",
    songTitle: "What's Going On",
    artistName: 'Marvin Gaye',
    listeningPrompt: 'Listen to the bassline as a secondary vocal melody. How does it curve? Where does it rest?',
    applicationPrompt: 'Write a melodic bassline that moves up and down the scale, contrasting with a simple chord progression.',
    logFields: ['rhythm_notes', 'favorite_fragment', 'bass_contour', 'sketch_filename']
  },
  {
    dayNumber: 10,
    lens: 'harmony',
    songQuery: 'God Only Knows The Beach Boys',
    songTitle: 'God Only Knows',
    artistName: 'The Beach Boys',
    listeningPrompt: 'Listen to the multiple vocal parts, the call-and-response, and the counterpoint. How do they overlap?',
    applicationPrompt: 'Record or program two or three overlapping vocal or synth lines that move in opposite directions (counterpoint).',
    logFields: ['harmony_notes', 'vocal_moment', 'counterpoint_ideas', 'sketch_filename']
  },
  {
    dayNumber: 11,
    lens: 'harmony',
    songQuery: 'Weird Fishes Arpeggi Radiohead',
    songTitle: 'Weird Fishes/Arpeggi',
    artistName: 'Radiohead',
    listeningPrompt: 'Identify any static/sustained pedal tones beneath the changing arpeggios. How does it anchor the harmony?',
    applicationPrompt: 'Write a chord progression where one note stays constant (pedal tone) across all changing chords.',
    logFields: ['harmony_notes', 'pedal_tones', 'pedal_progression', 'sketch_filename']
  },
  {
    dayNumber: 12,
    lens: 'arrangement',
    songQuery: 'She Moves She Four Tet',
    songTitle: 'She Moves She',
    artistName: 'Four Tet',
    listeningPrompt: 'Observe how loops are repeated, modulated, filtered, and cut to create structure and forward momentum.',
    applicationPrompt: 'Take a simple 4-bar loop and build a 2-minute arrangement by applying filters, mute triggers, and variations.',
    logFields: ['form_notes', 'section_lengths', 'structural_tricks', 'sketch_filename']
  },
  {
    dayNumber: 13,
    lens: 'texture',
    songQuery: 'User Choice Song',
    songTitle: 'Song You Avoid',
    artistName: 'User input',
    listeningPrompt: 'Choose a song you usually avoid or find challenging to listen to. Break down its full sonic DNA and elements.',
    applicationPrompt: 'Deconstruct the sonic DNA of this song. Borrow one specific move, transition, or sound choice and apply it in your DAW.',
    logFields: ['dna_notes', 'sonic_dna_bullets', 'borrowed_move', 'sketch_filename']
  },
  {
    dayNumber: 14,
    lens: 'arrangement',
    songQuery: 'Integration Day 14',
    songTitle: 'Original Build 2',
    artistName: 'User Original',
    listeningPrompt: 'Integrate all techniques learned over the 2-week audit process.',
    applicationPrompt: 'Finish or expand an original DAW sketch. Focus on presenting a cohesive arrangement reflecting your artistic voice.',
    logFields: ['original_notes', 'ingredients_used', 'artistic_voice', 'sketch_filename']
  }
];

const defaultCurriculumData = {
  title: '2-Week Song Audit Planner & Daily Prompts',
  slug: '2-week-song-audit-planner',
  description: 'A structured 14-day study plan focusing on harmony, bass movement, texture, and arrangement to guide your listening and application practice.',
  audience: 'Producer blending lofi, indie electronic, country-psychedelic, and Americana',
  focusAreas: ['harmony', 'bass movement', 'texture', 'arrangement'],
  durationWeeks: 2,
  creatorType: 'system',
  days: daysDataRaw.map(day => ({
    dayNumber: day.dayNumber,
    lens: day.lens,
    songQuery: day.songQuery,
    songTitle: day.songTitle,
    artistName: day.artistName,
    listeningPrompt: day.listeningPrompt,
    applicationPrompt: day.applicationPrompt,
    logFields: day.logFields.map(key => ({
      key,
      label: formatLabel(key),
      fieldType: 'textarea'
    }))
  }))
};

export default function createCurriculumRoutes(curriculumService, techniqueRepository) {
  const router = express.Router();

  // GET /api/curricula - Retrieve list of curricula available to user
  router.get('/', async (req, res) => {
    try {
      const all = await curriculumService.curriculumRepository.find({});
      const list = all.filter(c => 
        c.creatorType === 'system' || 
        (c.userId && c.userId.toString() === req.userId.toString())
      );
      res.json(list);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/curricula/:id - Get a specific curriculum
  router.get('/:id', async (req, res) => {
    try {
      const curriculum = await curriculumService.curriculumRepository.findById(req.params.id);
      if (!curriculum) {
        return res.status(404).json({ error: 'Curriculum not found' });
      }
      res.json(curriculum);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/curricula/seed - System utility seeding the default 2-Week Planner
  router.post('/seed', async (req, res) => {
    try {
      await curriculumService.curriculumRepository.deleteMany({ slug: '2-week-song-audit-planner' });
      const result = await curriculumService.curriculumRepository.create(defaultCurriculumData);
      res.json({ success: true, curriculum: result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/curricula/generate - Generates a 7-day draft plan using OpenAI
  router.post('/generate', async (req, res) => {
    try {
      const { focusArea } = req.body;
      if (!focusArea) {
        return res.status(400).json({ error: 'focusArea is required' });
      }

      let pastTechniques = [];
      if (techniqueRepository) {
        pastTechniques = await techniqueRepository.find({ userId: req.userId, deletedAt: null });
      }

      const plan = await curriculumService.generateAICurriculum(req.userId, focusArea, pastTechniques);
      res.json(plan);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/curricula/custom - Saves custom curriculum drafts
  router.post('/custom', async (req, res) => {
    try {
      const saved = await curriculumService.saveCustomCurriculum(req.userId, req.body);
      res.status(201).json(saved);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
