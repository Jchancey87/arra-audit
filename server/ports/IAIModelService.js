/**
 * IAIModelService - DEPRECATED port for AI model services.
 *
 * Replaced by ICompletionService in Phase 0.3. Kept here as a compatibility
 * shim so external consumers / older code keeps importing the old name.
 * Will be removed in Phase 2.
 *
 * Prefer: `import { ICompletionService } from './ICompletionService.js'`
 */

import { ICompletionService } from './ICompletionService.js';

/** @deprecated use ICompletionService */
export class IAIModelService extends ICompletionService {
  /**
   * @deprecated use completeText()
   * @param {string} prompt
   * @returns {Promise<string>}
   */
  async generateCompletion(prompt) {
    return this.completeText(prompt);
  }

  /**
   * @deprecated use completeJson()
   * @param {string} prompt
   * @returns {Promise<string>} JSON string (kept for back-compat; use completeJson for object)
   */
  async generateTemplate(prompt) {
    const obj = await this.completeJson(prompt);
    return JSON.stringify(obj);
  }
}
