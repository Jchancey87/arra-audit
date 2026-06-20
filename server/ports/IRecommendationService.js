/**
 * IRecommendationService — Port for technique recommendation.
 *
 * Phase 2.4 ("liked-by-artist discovery"): given a target technique, return
 * a ranked list of the user's OTHER techniques that are most semantically
 * similar — by description, tags, lens, and techniqueName. Surfaces the
 * "find similar" button on the technique card.
 *
 * Production: TFIDFAdapter (local TF-IDF + cosine sim, ~O(N·V) where N
 *             is the user's technique count and V is the vocab size).
 *             For 1k techniques + 5k vocab this is sub-millisecond.
 *             OpenAI embeddings adapter is a v2 follow-up (see spec).
 * Tests:      MockRecommendationAdapter (deterministic shuffle by hash).
 *
 * The adapter receives a corpus of (id → text) and a target (id, text),
 * and returns a sorted array of {id, score}. The service layer wraps
 * this with the database round-trip + ownership check.
 */

/**
 * @typedef {Object} SimilarityScore
 * @property {string} id        technique entry id
 * @property {number} score     cosine similarity, 0..1
 */

/**
 * @typedef {Object} RecommendationCorpusItem
 * @property {string} id         technique entry id
 * @property {string} text       concatenated description + tags + lens + name
 */

export class IRecommendationService {
  /**
   * @param {Object} req
   * @param {string} req.targetId
   * @param {string} req.targetText
   * @param {RecommendationCorpusItem[]} req.corpus    includes the target itself
   * @param {number} [req.limit=10]
   * @returns {Promise<SimilarityScore[]>} sorted desc by score, target excluded
   */
  async rank(req) {
    throw new Error('rank() not implemented');
  }
}
