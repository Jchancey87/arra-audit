/**
 * ICompletionService - Port (interface) for AI completion services.
 *
 * Two operations cover all current AI use-cases:
 * - completeText(prompt)  → free-form string response
 * - completeJson(prompt)  → parsed object response (adapters handle the JSON
 *                          parsing + validation internally)
 *
 * This pushes the "string vs. object" decision into the adapter, so service
 * code never has to JSON.parse() AI responses and never sees malformed
 * strings bubble up to business logic.
 *
 * Production: OpenAIAdapter
 * Tests:      MockAIAdapter
 */

export class ICompletionService {
  /**
   * Generate a free-form text completion.
   * @param {string} prompt
   * @returns {Promise<string>}
   * @throws {Error} if the completion fails
   */
  async completeText(prompt) {
    throw new Error('completeText() not implemented');
  }

  /**
   * Generate a completion that the adapter parses into an object.
   * @param {string} prompt
   * @returns {Promise<Object>}
   * @throws {Error} if the completion fails or the response is not parseable
   */
  async completeJson(prompt) {
    throw new Error('completeJson() not implemented');
  }
}
