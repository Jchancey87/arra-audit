import { ICompletionService } from '../ports/ICompletionService.js';

/**
 * MockAIAdapter - Test implementation of ICompletionService
 *
 * Returns hardcoded responses for testing.
 * Allows tests to run instantly without network calls or cost.
 *
 * Usage:
 *   const mockAdapter = new MockAIAdapter();
 *   const obj = await mockAdapter.completeJson(prompt);
 *   // Completes instantly, predictable response
 */

const DEFAULT_JSON_RESPONSE = {
  title: 'Arra Audit Template',
  description: 'Mock template for testing',
  lenses: {
    rhythm: {
      description: 'How does the song use drums, bass, and groove?',
      questions: [
        'What is the primary tempo and time signature?',
        'Describe the drum pattern and kick placement.',
        'How does the bass interact with the kick?',
        'What is the overall pocket and feel?',
      ],
    },
    texture: {
      description: 'What are the distinct textures and timbres?',
      questions: [
        'What are the main textures you hear?',
        'How is reverb used to create space?',
        'Describe the frequency balance.',
        'What delays or modulation effects are present?',
      ],
    },
    harmony: {
      description: 'What chords and progressions are used?',
      questions: [
        'What is the key and primary chord progression?',
        'Are there any borrowed chords?',
        'How does harmony evolve through the song?',
        'Describe any modal shifts or harmonic tension.',
      ],
    },
    arrangement: {
      description: 'How is the song structured?',
      questions: [
        'What are the main sections (intro, verse, chorus)?',
        'How do instruments enter and exit?',
        'Describe the energy arc across sections.',
        'What are the key transitions?',
      ],
    },
  },
  workflow_guidance: 'Work through each lens systematically, taking notes on specific moments.',
};

export class MockAIAdapter extends ICompletionService {
  constructor(responseOverride = null) {
    super();
    this.responseOverride = responseOverride;
  }

  async completeJson(prompt) {
    if (this.responseOverride != null) {
      return typeof this.responseOverride === 'string'
        ? JSON.parse(this.responseOverride)
        : this.responseOverride;
    }
    return JSON.parse(JSON.stringify(DEFAULT_JSON_RESPONSE));
  }

  async completeText(prompt) {
    if (this.responseOverride != null) {
      return typeof this.responseOverride === 'string'
        ? this.responseOverride
        : JSON.stringify(this.responseOverride);
    }
    return 'Mock synthesized taste analysis profile summary content for testing.';
  }
}
