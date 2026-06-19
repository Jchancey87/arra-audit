/**
 * TemplateComposer - Deep module for audit template generation
 * 
 * Owns the business logic for:
 * - Building customized prompts from song data
 * - Composing research context with lens descriptions
 * - Parsing and validating template responses
 * - Generating fallback templates
 * 
 * The AI adapter (production or test) is injected as a dependency.
 * This decouples the business logic from the external API.
 * 
 * Tests inject MockAIAdapter for instant, deterministic results.
 * Production injects OpenAIAdapter for real API calls.
 */

const LENS_DESCRIPTIONS = {
  rhythm: 'How does the song use drums, bass, and groove? Where do the kicks sit? How do the hats breathe? What is the pocket and feel?',
  texture: 'What are all the distinct textures and timbres? How is EQ used? What reverb and delays create space and depth? What is the surface feel?',
  harmony: 'What chords and progressions are used? Are there borrowed chords? Modal shifts? How does harmony move throughout?',
  arrangement: 'How is the song structured? What sections exist? How do transitions work? What instruments enter/exit? How does energy build?',
};

export class TemplateComposer {
  constructor(completionService) {
    if (!completionService) {
      throw new Error('TemplateComposer requires an ICompletionService adapter');
    }
    this.aiService = completionService;
  }

  /**
   * Generate a customized audit template for a song
   * 
   * @param {string} songTitle - Title of the song
   * @param {string} artist - Artist name
   * @param {string[]} lenses - Array of lens names ['rhythm', 'harmony', etc]
   * @param {string} researchSummary - Optional research context from Tavily or other source
   * @returns {Promise<Object>} Template object with lenses and questions
   * @throws {Error} if template generation or parsing fails
   */
  async generateTemplate(songTitle, artist, lenses, researchSummary = '', tastes = null) {
    // Validate inputs
    if (!songTitle || !artist || !lenses || lenses.length === 0) {
      throw new Error('songTitle, artist, and lenses are required');
    }

    // Validate lenses are known
    const invalidLenses = lenses.filter(lens => !LENS_DESCRIPTIONS[lens]);
    if (invalidLenses.length > 0) {
      throw new Error(`Unknown lenses: ${invalidLenses.join(', ')}`);
    }

    try {
      // Build the prompt
      const prompt = this._buildPrompt(songTitle, artist, lenses, researchSummary, tastes);

      // Call the AI adapter (production or mock) — adapter handles JSON parsing
      const template = await this.aiService.completeJson(prompt);
      return template;
    } catch (error) {
      // If AI service fails, fall back to hardcoded template
      console.warn(`Template generation failed (${error.message}), using fallback`);
      return this.fallbackTemplate(songTitle, artist, lenses, tastes);
    }
  }

  /**
   * Build the prompt sent to the AI model
   * This is pure business logic, testable independently
   * 
   * @private
   */
  _buildPrompt(songTitle, artist, lenses, researchSummary, tastes) {
    const lensDescriptions = lenses
      .map((lens) => `- ${lens}: ${LENS_DESCRIPTIONS[lens]}`)
      .join('\n');

    let tastesInstructions = '';
    if (tastes) {
      const entries = Object.entries(tastes)
        .filter(([lens]) => lenses.includes(lens))
        .map(([lens, taste]) => {
          if (taste && typeof taste === 'object') {
            return `- Lens: ${lens}\n  Artists: ${taste.raw || ''}\n  Detailed Styles & Techniques:\n${taste.rich || ''}`;
          }
          return `- ${lens}: ${taste}`;
        })
        .join('\n\n');

      if (entries) {
        tastesInstructions = '\nTAILORED USER TASTES/INFLUENCES FOR EACH LENS:\n' + entries +
          '\n\nFor each lens, you MUST generate 2-3 concrete, DAW-actionable exercises/tasks tailored to the user\'s tastes for that lens. Combine their reference tastes (e.g. "Jamerson + Radiohead") and detailed style guides with an understanding of this song to create highly customized exercises.';
      }
    }

    return `You are a music production expert specializing in detailed song analysis using the "Arra" methodology.

Song: "${songTitle}" by ${artist}
Research Context: ${researchSummary || 'No research available'}
${tastesInstructions}

Create a customized audit questionnaire and a set of concrete exercises for studying this song through these lenses:
${lensDescriptions}

For EACH selected lens, generate:
1. 4-6 focused, open-ended questions. Questions should:
   - Be actionable (something the listener can do while studying)
   - Reference specific musical techniques
   - Encourage detailed listening and analysis
   - Be specific to this song's characteristics
2. 2-3 concrete exercises/activities tailored to the user's tastes/references for that lens (if specified). Each exercise should:
   - Have a descriptive "name" (e.g. "Jamerson micro‑transcription", "Radiohead groove displacement", "Apply to your writing")
   - Have a step-by-step, DAW-ready "description" showing the user exactly how to study/recreate/apply the technique from this song in their own writing/DAW (e.g., using Bitwig, midi notes, plugins, reverb depth, etc.).

Format your response as JSON (no markdown, just the object):
{
  "title": "Arra Audit: [Song Name]",
  "artist": "${artist}",
  "lenses": {
    "lens_name": {
      "description": "short description of this lens",
      "questions": ["question 1", "question 2", ...],
      "exercises": [
        {
          "name": "Exercise Name",
          "description": "Exercise description..."
        }
      ]
    }
  },
  "workflow_guidance": "Brief guidance on how to approach this audit"
}

Only include the lenses specified: ${lenses.join(', ')}`;
  }

  /**
   * Generate a fallback template when AI service fails.
   * Public so route handlers can call it directly when needed.
   *
   * @param {string} songTitle
   * @param {string} artist
   * @param {string[]} lenses
   * @param {Object|null} tastes
   * @returns {Object} Fallback template
   */
  fallbackTemplate(songTitle, artist, lenses, tastes) {
    const lensTemplates = {
      rhythm: {
        description: LENS_DESCRIPTIONS.rhythm,
        questions: [
          'What is the tempo and time signature?',
          'Describe the drum pattern and kick placement.',
          'How does the bass interact with the kick?',
          'What is the overall pocket and feel?',
          'Where does the groove breathe or swing?',
          'How do rhythmic elements create tension or release?',
        ],
        exercises: [
          {
            name: 'Jamerson micro‑transcription',
            description: 'Take one bass phrase from this song: mark where notes land relative to the grid (ahead, behind, locked), ghost notes, and pickups into downbeats. Then in Bitwig, program a similar rhythmic shape over a completely different set of chords.'
          },
          {
            name: 'Radiohead groove displacement',
            description: 'Pick an odd phrasing section in this song. Count out loud and sketch the bar groupings (e.g., 3+3+2) and where the snare lands. Recreate the pattern with neutral sounds (kick/snare/hat), then re‑voice it into your own sound world.'
          },
          {
            name: 'Apply to your writing',
            description: 'Take an 8‑bar loop you’ve already made and: 1) Move every second snare slightly late. 2) Add one Jamerson‑style chromatic pickup into each bar 1. 3) Add or remove a beat from every 4th bar to create a subtle “stumble” à la Radiohead.'
          }
        ]
      },
      texture: {
        description: LENS_DESCRIPTIONS.texture,
        questions: [
          'What are the main textures and timbres you hear?',
          'How is EQ used to shape each element?',
          'Describe the use of reverb and space.',
          'What delays or modulation effects are present?',
          'How do textures change through the song?',
          'What is the most interesting textural choice?',
        ],
        exercises: [
          {
            name: 'Texture inventory',
            description: 'Write a list of all distinct textures you hear (e.g., “washed‑out, detuned pad,” “filtered noise swells,” “distant choir,” “tape‑warped piano”). Don’t worry about the instrument, only the feel.'
          },
          {
            name: 'Recreate 3 textures',
            description: 'In Bitwig, try to build three of those textures using your own synths, pedals, and plugins—matching brightness, movement, and stereo width more than exact sound. Use a “color” mindset: EQ as choosing a specific shade of blue rather than “add 3 dB at 8 kHz.”'
          },
          {
            name: 'Space as perspective',
            description: 'Take a dry stem from one of your tracks and create three “depth” versions using different reverb lengths and pre‑delay: close, mid, far. Then, deliberately place each element on a depth ladder (e.g., drums close, voice mid, pads far) instead of just “add reverb until it sounds nice.”'
          }
        ]
      },
      harmony: {
        description: LENS_DESCRIPTIONS.harmony,
        questions: [
          'What is the key and primary chord progression?',
          'Are there any borrowed chords or surprising movements?',
          'How does harmony evolve through the song?',
          'Describe any modal shifts or harmonic tension.',
          'What chords create the most emotional impact?',
          'How does harmony interact with the melody?',
        ],
        exercises: [
          {
            name: 'Jimmy Webb harmonic sketch',
            description: 'Write the chord progression of the song in Nashville numbers, marking any non‑diatonic/borrowed chords and key changes. Note where tension rises (borrowed chord) and resolves (tonic or close substitute).'
          },
          {
            name: 'Beach Boys vertical vs. horizontal',
            description: 'Isolate the bass and top melody (even roughly by ear). Notice when the bass moves contrary to the melody to create richer harmony. In your own loop, experiment with bass lines that move stepwise against the melody.'
          },
          {
            name: 'Radiohead ambiguity exercise',
            description: 'Use a pedal tone or common top note technique: hold one scale tone on top while the chords under it change. Start with a 4‑chord loop that never clearly “lands” on a tonic, and write a melody over it that only resolves in the last bar.'
          },
          {
            name: 'Apply to your writing',
            description: 'For each new sketch, force yourself to: 1) Use at least one borrowed chord or unexpected key move (Webb/Beach Boys). 2) Try one progression where the tonic chord never appears until the chorus (Radiohead‑style).'
          }
        ]
      },
      arrangement: {
        description: LENS_DESCRIPTIONS.arrangement,
        questions: [
          'What are the main sections (intro, verse, chorus, bridge)?',
          'How do instruments enter, build, and exit?',
          'Describe the energy arc from start to finish.',
          'What are the key transitions between sections?',
          'How is repetition and variation used?',
          'What arrangement element surprised you most?',
        ],
        exercises: [
          {
            name: 'Paper map of a favorite track',
            description: 'Draw a horizontal timeline and mark sections (intro/verse/bridge/etc.) with bar counts. Under each section, list: drums? bass? main harmony? lead? pads? ear‑candy?'
          },
          {
            name: 'Transition audit',
            description: 'Listen only to the transitions: what exactly happens in the 1–2 bars before each new section? Drum fill, filter sweep, drop‑outs, vocal pickup, etc. Write those as a “transition vocabulary” list you can steal.'
          },
          {
            name: 'Apply to your own 8‑bar loop',
            description: 'Take a loop you like and force yourself to build a 3‑section structure: A1 (original loop but slightly sparser), B (contrast: change chord quality or bass motion and add one new instrument), and A2 (bring back A with one extra overdub and one arrangement trick you stole).'
          }
        ]
      },
    };

    const selectedLenses = {};
    lenses.forEach(lens => {
      if (lensTemplates[lens]) {
        selectedLenses[lens] = lensTemplates[lens];
      }
    });

    return {
      title: `Arra Audit: ${songTitle}`,
      artist,
      lenses: selectedLenses,
      workflow_guidance:
        'Work through each lens systematically. Play the song multiple times if needed. Take notes on specific moments and timestamps.',
    };
  }
}
