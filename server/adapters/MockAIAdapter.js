import { IAIModelService } from '../ports/IAIModelService.js';

/**
 * MockAIAdapter - Test implementation of IAIModelService
 * 
 * Returns hardcoded template responses for testing.
 * Allows tests to run instantly without network calls or cost.
 * 
 * Usage:
 *   const mockAdapter = new MockAIAdapter();
 *   const json = await mockAdapter.generateTemplate(prompt);
 *   // Completes instantly, predictable response
 */

export class MockAIAdapter extends IAIModelService {
  constructor(responseOverride = null) {
    super();
    this.responseOverride = responseOverride;
  }

  async generateTemplate(prompt) {
    // Allow tests to inject custom responses
    if (this.responseOverride) {
      return this.responseOverride;
    }

    // Default: return a consistent template for testing
    return JSON.stringify({
      title: 'Sonic DNA Audit Template',
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
    });
  }

  async generateCompletion(prompt) {
    if (this.responseOverride) {
      return this.responseOverride;
    }
    return "Mock synthesized taste analysis profile summary content for testing.";
  }
}
