/**
 * RecommendationService — orchestrates IRecommendationService for
 * "find similar techniques" in a user's notebook.
 *
 * Phase 2.4: loads the user's non-deleted techniques (including the
 * target), builds the corpus (text = description + tags + lens +
 * techniqueName), delegates the ranking to the adapter, and returns
 * the top N results with their full technique payloads.
 *
 * Designed to be cheap: a single user-scoped technique fetch, then
 * in-memory ranking. For larger notebooks the fetch should be
 * swapped for a paginated/streaming variant (TODO).
 */

const DEFAULT_LIMIT = 10;
const MAX_CORPUS_SIZE = 5000; // safety cap to keep TF-IDF snappy

const buildTechniqueText = (t) => {
  const parts = [
    t.description || '',
    t.techniqueName || '',
    t.lens || '',
    Array.isArray(t.tags) ? t.tags.join(' ') : '',
    t.notes || '',
  ];
  return parts.filter(Boolean).join(' ').trim();
};

export class RecommendationService {
  constructor({ adapter, techniqueRepository }) {
    if (!adapter) throw new Error('RecommendationService requires an adapter');
    if (!techniqueRepository) throw new Error('RecommendationService requires a techniqueRepository');
    this.adapter = adapter;
    this.techniqueRepository = techniqueRepository;
  }

  async findSimilarTechniques({ userId, techniqueId, limit = DEFAULT_LIMIT }) {
    if (!userId) throw new Error('userId is required');
    if (!techniqueId) throw new Error('techniqueId is required');

    // Fetch the target first so we can 404 cleanly if it's missing
    const target = await this.techniqueRepository.findById(techniqueId);
    if (!target || target.deletedAt) {
      const e = new Error('Technique not found');
      e.code = 'TECHNIQUE_NOT_FOUND';
      throw e;
    }
    if (target.userId.toString() !== userId.toString()) {
      const e = new Error('Technique not found');
      e.code = 'TECHNIQUE_NOT_FOUND';
      throw e;
    }

    // Fetch the user's full notebook (cap to MAX_CORPUS_SIZE for safety)
    const all = await this.techniqueRepository.find(
      { userId, deletedAt: null },
      { limit: MAX_CORPUS_SIZE, sort: { createdAt: -1 } }
    );

    const corpus = all.map((t) => ({ id: t._id?.toString?.() || t.id, text: buildTechniqueText(t) }));
    const ranked = await this.adapter.rank({
      targetId: target._id.toString(),
      targetText: buildTechniqueText(target),
      corpus,
      limit: Math.max(1, Math.min(50, limit)),
    });

    // Hydrate the ranked ids back to full technique docs
    const byId = new Map(all.map((t) => [t._id?.toString?.() || t.id, t]));
    const results = [];
    for (const r of ranked) {
      const tech = byId.get(r.id);
      if (!tech) continue;
      results.push({
        technique: tech,
        score: r.score,
      });
    }
    return {
      target: {
        _id: target._id.toString(),
        techniqueName: target.techniqueName,
        lens: target.lens,
      },
      similar: results,
    };
  }
}

export default RecommendationService;
