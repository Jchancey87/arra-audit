import { IAIModelService } from '../ports/IAIModelService.js';

/**
 * OpenAIAdapter - Production implementation of IAIModelService
 * 
 * Calls the real OpenAI GPT-4 API to generate audit templates.
 * This adapter handles:
 * - API authentication
 * - Request formatting
 * - Response parsing
 * - Error handling
 * 
 * Usage:
 *   const adapter = new OpenAIAdapter();
 *   const json = await adapter.generateTemplate(prompt);
 */

export class OpenAIAdapter extends IAIModelService {
  constructor(apiKey = process.env.OPENAI_API_KEY) {
    super();
    this.apiKey = apiKey;
    this.apiUrl = process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions';
    this.model = process.env.OPENAI_MODEL || 'gpt-4-turbo';
  }

  async generateTemplate(prompt) {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || `OpenAI API returned ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;

      // Validate that response contains JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('OpenAI response did not contain valid JSON');
      }

      return jsonMatch[0];
    } catch (error) {
      throw new Error(`OpenAI template generation failed: ${error.message}`);
    }
  }

  async generateCompletion(prompt) {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 1500,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || `OpenAI API returned ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      throw new Error(`OpenAI completion generation failed: ${error.message}`);
    }
  }
}
