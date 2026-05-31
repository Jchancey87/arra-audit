/**
 * IAIModelService - Port (interface) for AI model services
 * 
 * Any class implementing this interface must provide a way to generate
 * templated content from a prompt. This allows production code to use real
 * APIs (OpenAI, Anthropic) while tests use mock implementations.
 * 
 * Contract: generateTemplate(prompt) MUST return a JSON string with the
 * template structure, or throw an error.
 */

export class IAIModelService {
  /**
   * Generate template content from a prompt
   * @param {string} prompt - The full prompt to send to the AI model
   * @returns {Promise<string>} JSON string of the template
   * @throws {Error} if API fails or response cannot be parsed
   */
  async generateTemplate(prompt) {
    throw new Error('generateTemplate() not implemented');
  }

  /**
   * Generate general text content from a prompt
   * @param {string} prompt - The full prompt
   * @returns {Promise<string>} Plain text response
   * @throws {Error} if API fails
   */
  async generateCompletion(prompt) {
    throw new Error('generateCompletion() not implemented');
  }
}
