import { ICompletionService } from '../ports/ICompletionService.js';

/**
 * OpenAIAdapter - Production implementation of ICompletionService
 *
 * Calls the real OpenAI GPT-4 API. Handles:
 * - API authentication
 * - Request formatting
 * - Response parsing (incl. JSON extraction for completeJson)
 * - Error handling
 *
 * Usage:
 *   const adapter = new OpenAIAdapter();
 *   const obj = await adapter.completeJson(prompt);
 */

export class OpenAIAdapter extends ICompletionService {
  constructor(apiKey = process.env.OPENAI_API_KEY) {
    super();
    this.apiKey = apiKey;
    this.apiUrl = process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions';
    this.model = process.env.OPENAI_MODEL || 'gpt-4-turbo';
  }

  async _callOpenAI(prompt, maxTokens) {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `OpenAI API returned ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  async completeText(prompt) {
    try {
      return await this._callOpenAI(prompt, 1500);
    } catch (error) {
      throw new Error(`OpenAI completion failed: ${error.message}`);
    }
  }

  async completeJson(prompt) {
    let content;
    try {
      content = await this._callOpenAI(prompt, 2000);
    } catch (error) {
      throw new Error(`OpenAI template generation failed: ${error.message}`);
    }

    // Extract JSON object from response (model may add prose)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('OpenAI response did not contain valid JSON');
    }

    try {
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      throw new Error(`OpenAI returned malformed JSON: ${error.message}`);
    }
  }
}
