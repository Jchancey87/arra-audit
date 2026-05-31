import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { TemplateComposer } from '../../services/templateComposer.js';
import { MockAIAdapter } from '../../adapters/MockAIAdapter.js';

describe('TemplateComposer Unit Tests', () => {
  let composer;
  let mockAdapter;

  beforeEach(() => {
    mockAdapter = new MockAIAdapter();
    composer = new TemplateComposer(mockAdapter);
  });

  describe('generateTemplate()', () => {
    test('generates template with requested lenses', async () => {
      const template = await composer.generateTemplate(
        'Song Name',
        'Artist Name',
        ['rhythm', 'harmony']
      );

      expect(template.title).toBeDefined();
      expect(template.lenses).toHaveProperty('rhythm');
      expect(template.lenses).toHaveProperty('harmony');
    });

    test('generates fallback template with exercises when AI fails', async () => {
      const failingAdapter = {
        async generateTemplate() {
          throw new Error('API down');
        },
      };

      const composerWithFailure = new TemplateComposer(failingAdapter);
      const tastes = {
        rhythm: 'Jamerson, Radiohead',
        texture: 'Flaming Lips, Pink Floyd',
      };
      
      const template = await composerWithFailure.generateTemplate(
        'Song Name',
        'Artist Name',
        ['rhythm', 'texture'],
        'Some research context',
        tastes
      );

      expect(template.lenses).toHaveProperty('rhythm');
      expect(template.lenses).toHaveProperty('texture');
      
      expect(template.lenses.rhythm.exercises).toBeDefined();
      expect(template.lenses.rhythm.exercises.length).toBeGreaterThan(0);
      expect(template.lenses.rhythm.exercises[0].name).toBe('Jamerson micro‑transcription');
    });

    test('builds prompt containing tailored tastes context', () => {
      const tastes = {
        rhythm: 'Dilla swing, Bonham beats',
        texture: 'Brian Eno, Kevin Shields',
      };

      const prompt = composer._buildPrompt(
        'My Song',
        'My Artist',
        ['rhythm', 'texture'],
        'No research',
        tastes
      );

      expect(prompt).toContain('TAILORED USER TASTES/INFLUENCES FOR EACH LENS');
      expect(prompt).toContain('Dilla swing, Bonham beats');
      expect(prompt).toContain('Brian Eno, Kevin Shields');
      expect(prompt).toContain('concrete, DAW-actionable exercises/tasks');
    });
  });
});
