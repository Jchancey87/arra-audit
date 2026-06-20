/**
 * IBookmarkAnalysisService — Port (interface) for per-bookmark segment
 * analysis. Phase 2.3: runs CLAP on the ±5s window around a bookmark
 * to surface timbre tags, mood tags, and similar reference tracks.
 *
 * Production: CLAPSegmentAdapter (POSTs to the analysis_service FastAPI
 *             /analyze-segment endpoint, which serializes the GPU slot).
 * Tests:      MockBookmarkAnalysisAdapter (deterministic stub).
 *
 * The adapter is responsible for resolving the audio (downloading from
 * YouTube via the Python service's cache, or accepting a local file
 * path) and for normalizing the result into the bookmark.analysis shape.
 *
 * The returned shape is stored directly on the bookmark subdocument
 * (see server/models/Audit.js — bookmarkSchema.analysis).
 */

/**
 * @typedef {Object} SegmentTagScore
 * @property {string} tag
 * @property {number} score    0..1, sums to ~1 within a category
 */

/**
 * @typedef {Object} SegmentAnalysis
 * @property {'clap-htsat-fused' | 'deterministic-v1'} model
 * @property {string} version                            "2.3.0"
 * @property {SegmentTagScore[]} mood_tags               sorted desc by score
 * @property {SegmentTagScore[]} timbre_tags             sorted desc by score
 * @property {string[]} similar_to                       up to 3 reference tracks
 */

/**
 * @typedef {Object} SegmentAnalysisRequest
 * @property {string} [audioId]
 * @property {string} [filePath]                          prefer this if available
 * @property {string} [youtubeUrl]
 * @property {string} [ytId]
 * @property {number} startSeconds
 * @property {number} endSeconds
 * @property {number} [padSeconds=5]
 */

export class IBookmarkAnalysisService {
  /**
   * Analyze a single bookmark's audio window.
   * @param {SegmentAnalysisRequest} req
   * @returns {Promise<SegmentAnalysis>}
   * @throws {Error} if the analysis fails irrecoverably
   */
  async analyzeSegment(req) {
    throw new Error('analyzeSegment() not implemented');
  }
}
