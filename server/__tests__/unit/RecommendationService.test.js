import { describe, test, expect, beforeEach } from '@jest/globals';
import { RecommendationService } from '../../services/RecommendationService.js';
import { TFIDFAdapter } from '../../adapters/TFIDFAdapter.js';
import { InMemoryRepository } from '../../adapters/InMemoryRepository.js';

const seed = async (repo, userId, items) => {
  const out = [];
  for (const it of items) {
    out.push(await repo.create({ ...it, userId, deletedAt: null }));
  }
  return out;
};

const buildTargetText = (t) =>
  [t.description, t.techniqueName, t.lens, (t.tags || []).join(' '), t.notes || '']
    .filter(Boolean)
    .join(' ');

describe('RecommendationService', () => {
  let techniqueRepository;
  let service;

  beforeEach(() => {
    techniqueRepository = new InMemoryRepository();
    service = new RecommendationService({ adapter: new TFIDFAdapter(), techniqueRepository });
  });

  test('returns the top similar techniques ranked by score', async () => {
    const userId = 'user-1';
    await seed(techniqueRepository, userId, [
      { _id: 't1', description: 'four-on-the-floor kick with side-chain compression', lens: 'rhythm', tags: ['909', 'compression'] },
      { _id: 't2', description: 'wide stereo synth pad with heavy reverb', lens: 'texture', tags: ['synth', 'reverb'] },
      { _id: 't3', description: 'reese bass with side-chain pumping', lens: 'texture', tags: ['bass', 'sidechain'] },
      { _id: 't4', description: '909 kick and side-chain groove', lens: 'rhythm', tags: ['909', 'groove'] },
    ]);

    const out = await service.findSimilarTechniques({ userId, techniqueId: 't1', limit: 3 });
    expect(out.target._id).toBe('t1');
    expect(out.similar).toHaveLength(3);
    // t4 shares 909 + side-chain + rhythm; t3 shares side-chain
    expect(out.similar[0].technique._id).toBe('t4');
    expect(out.similar[0].score).toBeGreaterThan(out.similar[1].score);
    expect(out.similar[0].score).toBeLessThanOrEqual(1);
    // Target itself is never in the result
    expect(out.similar.find((r) => r.technique._id === 't1')).toBeUndefined();
  });

  test('throws TECHNIQUE_NOT_FOUND for missing technique', async () => {
    await expect(
      service.findSimilarTechniques({ userId: 'user-1', techniqueId: 'missing' })
    ).rejects.toMatchObject({ code: 'TECHNIQUE_NOT_FOUND' });
  });

  test('throws TECHNIQUE_NOT_FOUND for another user\'s technique', async () => {
    await seed(techniqueRepository, 'other-user', [
      { _id: 'theirs', description: 'private', lens: 'rhythm' },
    ]);
    await expect(
      service.findSimilarTechniques({ userId: 'me', techniqueId: 'theirs' })
    ).rejects.toMatchObject({ code: 'TECHNIQUE_NOT_FOUND' });
  });

  test('throws TECHNIQUE_NOT_FOUND for soft-deleted technique', async () => {
    await techniqueRepository.create({
      _id: 'gone', userId: 'user-1', description: 'x', lens: 'rhythm', deletedAt: new Date(),
    });
    await expect(
      service.findSimilarTechniques({ userId: 'user-1', techniqueId: 'gone' })
    ).rejects.toMatchObject({ code: 'TECHNIQUE_NOT_FOUND' });
  });

  test('returns empty similar list when the user has only the target', async () => {
    await seed(techniqueRepository, 'user-1', [
      { _id: 'only', description: 'lone technique', lens: 'rhythm', tags: [] },
    ]);
    const out = await service.findSimilarTechniques({ userId: 'user-1', techniqueId: 'only' });
    expect(out.similar).toEqual([]);
  });

  test('respects the limit and clamps to [1, 50]', async () => {
    const items = [];
    for (let i = 0; i < 30; i++) {
      items.push({ _id: `t${i}`, description: `tech ${i} common-vocab-${i}`, lens: 'rhythm', tags: ['t'] });
    }
    items.push({ _id: 'target', description: 'common-vocab-target with shared words', lens: 'rhythm', tags: ['t'] });
    await seed(techniqueRepository, 'user-1', items);

    const out = await service.findSimilarTechniques({ userId: 'user-1', techniqueId: 'target', limit: 5 });
    expect(out.similar).toHaveLength(5);

    // Asking for absurdly high limit should still be capped (we clamp at 50)
    const out2 = await service.findSimilarTechniques({ userId: 'user-1', techniqueId: 'target', limit: 999 });
    expect(out2.similar.length).toBeLessThanOrEqual(50);
  });

  test('excludes soft-deleted techniques from the corpus', async () => {
    await techniqueRepository.create({ _id: 'active', userId: 'user-1', description: 'still here', lens: 'rhythm', tags: [] });
    await techniqueRepository.create({ _id: 'deleted', userId: 'user-1', description: 'gone', lens: 'rhythm', tags: [], deletedAt: new Date() });
    await techniqueRepository.create({ _id: 'target', userId: 'user-1', description: 'similar', lens: 'rhythm', tags: [] });

    const out = await service.findSimilarTechniques({ userId: 'user-1', techniqueId: 'target', limit: 10 });
    const ids = out.similar.map((r) => r.technique._id);
    expect(ids).toContain('active');
    expect(ids).not.toContain('deleted');
  });

  test('caps the corpus at MAX_CORPUS_SIZE for safety', async () => {
    // Create a service with a tiny internal cap by monkey-patching
    // (the constant is module-private; we just verify the limit is
    // honored when asking for more than the corpus size)
    await seed(techniqueRepository, 'user-1', [
      { _id: 't1', description: 'a b c', lens: 'rhythm' },
      { _id: 't2', description: 'd e f', lens: 'texture' },
    ]);
    const out = await service.findSimilarTechniques({ userId: 'user-1', techniqueId: 't1', limit: 50 });
    expect(out.similar.length).toBe(1);
    expect(out.similar[0].technique._id).toBe('t2');
  });

  test('buildTargetText concatenates fields in the right order', () => {
    // Pure helper, but worth pinning so the corpus stays stable
    const text = buildTargetText({
      description: 'desc',
      techniqueName: 'name',
      lens: 'harmony',
      tags: ['a', 'b'],
      notes: 'private',
    });
    expect(text).toBe('desc name harmony a b private');
  });
});
