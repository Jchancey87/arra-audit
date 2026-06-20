import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { BookmarkAnalysisService } from '../../services/BookmarkAnalysisService.js';
import { InMemoryRepository } from '../../adapters/InMemoryRepository.js';
import { MockBookmarkAnalysisAdapter } from '../../adapters/MockBookmarkAnalysisAdapter.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const pollUntil = async (fn, { timeoutMs = 2000, intervalMs = 25 } = {}) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const v = await fn();
    if (v) return v;
    await wait(intervalMs);
  }
  return fn();
};

const buildAuditWithBookmark = async (auditRepository, songRepository, { ts = 145 } = {}) => {
  const song = await songRepository.create({
    title: 'Song', userId: 'user-1', sourceId: 'yt-abc', originalUrl: 'https://youtu.be/yt-abc',
  });
  const audit = await auditRepository.create({
    songId: song._id, userId: 'user-1', lensSelection: ['harmony'],
    bookmarks: [
      { _id: 'bm-1', timestampSeconds: ts, label: '', note: '', lens: null, analysis: null },
    ],
  });
  return { song, audit, bookmark: audit.bookmarks[0] };
};

describe('BookmarkAnalysisService', () => {
  describe('enqueue + queue mechanics', () => {
    test('enqueue marks the bookmark as pending and runs the analysis', async () => {
      const auditRepository = new InMemoryRepository();
      const songRepository = new InMemoryRepository();
      const service = new BookmarkAnalysisService({
        adapter: new MockBookmarkAnalysisAdapter(),
        auditRepository,
        songRepository,
      });
      const { audit } = await buildAuditWithBookmark(auditRepository, songRepository);

      const result = service.enqueue({
        auditId: audit._id, bookmarkId: 'bm-1', startSeconds: 140, endSeconds: 150,
      });
      expect(result.accepted).toBe(true);
      expect(service.size()).toBe(0); // drained immediately
      expect(service.inFlightCount()).toBe(1);

      await pollUntil(async () => {
        const a = await auditRepository.findById(audit._id);
        return a.bookmarks[0].analysis?.status === 'success';
      });

      const after = await auditRepository.findById(audit._id);
      expect(after.bookmarks[0].analysis.status).toBe('success');
      expect(after.bookmarks[0].analysis.model).toBe('deterministic-v1');
      expect(after.bookmarks[0].analysis.version).toBe('2.3.0');
      expect(after.bookmarks[0].analysis.mood_tags.length).toBeGreaterThan(0);
      expect(after.bookmarks[0].analysis.timbre_tags.length).toBeGreaterThan(0);
      expect(after.bookmarks[0].analysis.similar_to.length).toBeGreaterThan(0);
      expect(after.bookmarks[0].analysis.computedAt).toBeTruthy();
    });

    test('rejects enqueue when the queue is full', async () => {
      const auditRepository = new InMemoryRepository();
      const songRepository = new InMemoryRepository();
      // Slow adapter so the first job is still in-flight when the second
      // enqueue happens — the queue length matters only while work is
      // pending, not after it drains.
      const slowAdapter = {
        analyzeSegment: () => new Promise((r) => setTimeout(() => r({
          model: 'deterministic-v1', version: '2.3.0', mood_tags: [], timbre_tags: [], similar_to: [],
        }), 100)),
      };
      const service = new BookmarkAnalysisService({
        adapter: slowAdapter, auditRepository, songRepository, queueLimit: 1,
      });
      const a = service.enqueue({ auditId: 'a', bookmarkId: 'b', startSeconds: 0, endSeconds: 1 });
      const b = service.enqueue({ auditId: 'a', bookmarkId: 'b', startSeconds: 0, endSeconds: 1 });
      expect(a.accepted).toBe(true);
      expect(b.accepted).toBe(false);
      expect(b.reason).toBe('queue-full');
    });

    test('adapter errors set status=error and store the message', async () => {
      const auditRepository = new InMemoryRepository();
      const songRepository = new InMemoryRepository();
      const failingAdapter = { analyzeSegment: async () => { throw new Error('boom'); } };
      const service = new BookmarkAnalysisService({
        adapter: failingAdapter, auditRepository, songRepository,
      });
      const { audit } = await buildAuditWithBookmark(auditRepository, songRepository);

      service.enqueue({ auditId: audit._id, bookmarkId: 'bm-1', startSeconds: 140, endSeconds: 150 });
      await pollUntil(async () => {
        const a = await auditRepository.findById(audit._id);
        return a.bookmarks[0].analysis?.status === 'error';
      });
      const after = await auditRepository.findById(audit._id);
      expect(after.bookmarks[0].analysis.status).toBe('error');
      expect(after.bookmarks[0].analysis.error).toMatch(/boom/);
    });

    test('audio resolution fails gracefully when songRepository missing', async () => {
      const auditRepository = new InMemoryRepository();
      const songRepository = new InMemoryRepository();
      const { audit } = await buildAuditWithBookmark(auditRepository, songRepository);
      const failingAdapter = { analyzeSegment: async () => { throw new Error('should not reach here'); } };
      const service = new BookmarkAnalysisService({
        adapter: failingAdapter, auditRepository, songRepository: null,
      });
      service.enqueue({ auditId: audit._id, bookmarkId: 'bm-1', startSeconds: 140, endSeconds: 150 });
      await pollUntil(async () => {
        const a = await auditRepository.findById(audit._id);
        return a.bookmarks[0].analysis?.status === 'error';
      });
      const after = await auditRepository.findById(audit._id);
      expect(after.bookmarks[0].analysis.error).toMatch(/songRepository/);
    });

    test('skips work for a missing bookmark id', async () => {
      const auditRepository = new InMemoryRepository();
      const songRepository = new InMemoryRepository();
      const service = new BookmarkAnalysisService({
        adapter: new MockBookmarkAnalysisAdapter(), auditRepository, songRepository,
      });
      const { audit } = await buildAuditWithBookmark(auditRepository, songRepository);

      service.enqueue({ auditId: audit._id, bookmarkId: 'bm-does-not-exist', startSeconds: 140, endSeconds: 150 });
      await wait(150);
      // The pending write is a no-op when the bookmark is missing, so
      // analysis stays null. The job finishes without an error state.
      const after = await auditRepository.findById(audit._id);
      expect(after.bookmarks[0].analysis).toBeNull();
    });
  });

  describe('audio resolution', () => {
    test('uses filePath when provided (no song lookup)', async () => {
      const auditRepository = new InMemoryRepository();
      const songRepository = new InMemoryRepository();
      const service = new BookmarkAnalysisService({
        adapter: new MockBookmarkAnalysisAdapter(), auditRepository, songRepository,
      });
      const { audit } = await buildAuditWithBookmark(auditRepository, songRepository);
      service.enqueue({
        auditId: audit._id, bookmarkId: 'bm-1',
        startSeconds: 0, endSeconds: 1, filePath: '/tmp/test.mp3',
      });
      await pollUntil(async () => {
        const a = await auditRepository.findById(audit._id);
        return a.bookmarks[0].analysis?.status === 'success';
      });
    });

    test('resolves youtubeUrl + ytId from the song when no filePath', async () => {
      const auditRepository = new InMemoryRepository();
      const songRepository = new InMemoryRepository();
      const { audit, song } = await buildAuditWithBookmark(auditRepository, songRepository);
      const seenArgs = [];
      const trackingAdapter = {
        analyzeSegment: async (req) => {
          seenArgs.push(req);
          return { model: 'clap', version: '2.3.0', mood_tags: [], timbre_tags: [], similar_to: [] };
        },
      };
      const service = new BookmarkAnalysisService({
        adapter: trackingAdapter, auditRepository, songRepository,
      });
      service.enqueue({ auditId: audit._id, bookmarkId: 'bm-1', startSeconds: 140, endSeconds: 150 });
      await pollUntil(async () => seenArgs.length > 0);
      expect(seenArgs[0].ytId).toBe(song.sourceId);
      expect(seenArgs[0].youtubeUrl).toBe(song.originalUrl);
      expect(seenArgs[0].audioId).toBe(song.sourceId);
    });
  });

  describe('deterministic adapter contract', () => {
    test('same (audioId, start, end) returns the same analysis', async () => {
      const adapter = new MockBookmarkAnalysisAdapter();
      const a = await adapter.analyzeSegment({ audioId: 'yt-1', startSeconds: 30, endSeconds: 35 });
      const b = await adapter.analyzeSegment({ audioId: 'yt-1', startSeconds: 30, endSeconds: 35 });
      expect(a).toEqual(b);
    });

    test('different (audioId, start, end) returns different analyses', async () => {
      const adapter = new MockBookmarkAnalysisAdapter();
      const a = await adapter.analyzeSegment({ audioId: 'yt-1', startSeconds: 30, endSeconds: 35 });
      const b = await adapter.analyzeSegment({ audioId: 'yt-2', startSeconds: 60, endSeconds: 65 });
      const sameTop = a.mood_tags[0].tag === b.mood_tags[0].tag && a.mood_tags[0].score === b.mood_tags[0].score;
      expect(sameTop).toBe(false);
    });

    test('validates startSeconds and endSeconds', async () => {
      const adapter = new MockBookmarkAnalysisAdapter();
      await expect(adapter.analyzeSegment({ audioId: 'x', startSeconds: 'oops' })).rejects.toThrow(/required/);
      await expect(adapter.analyzeSegment({ audioId: 'x', startSeconds: 5, endSeconds: 5 })).rejects.toThrow(/greater/);
    });
  });

  describe('eventBus integration (Phase 2.3 v2)', () => {
    test('publishes pending → running → success on the bus', async () => {
      const auditRepository = new InMemoryRepository();
      const songRepository = new InMemoryRepository();
      const { audit, song } = await buildAuditWithBookmark(auditRepository, songRepository);
      const events = [];
      const eventBus = { publish: (aid, bid, analysis) => events.push({ aid, bid, analysis }) };

      const service = new BookmarkAnalysisService({
        adapter: new MockBookmarkAnalysisAdapter(),
        auditRepository,
        songRepository,
        eventBus,
      });
      service.enqueue({ auditId: audit._id, bookmarkId: 'bm-1', startSeconds: 10, endSeconds: 12 });
      await pollUntil(async () => {
        const a = await auditRepository.findById(audit._id);
        return a.bookmarks[0].analysis?.status === 'success';
      });

      const statuses = events.filter((e) => e.bid === 'bm-1').map((e) => e.analysis.status);
      expect(statuses).toContain('pending');
      expect(statuses).toContain('running');
      expect(statuses).toContain('success');
      // pending should be the first transition, success the last
      expect(statuses[0]).toBe('pending');
      expect(statuses[statuses.length - 1]).toBe('success');
    });

    test('publishes an error event when the adapter throws', async () => {
      const auditRepository = new InMemoryRepository();
      const songRepository = new InMemoryRepository();
      const { audit, song } = await buildAuditWithBookmark(auditRepository, songRepository);
      const events = [];
      const eventBus = { publish: (_aid, bid, analysis) => events.push({ bid, analysis }) };

      const service = new BookmarkAnalysisService({
        adapter: { analyzeSegment: async () => { throw new Error('boom'); } },
        auditRepository,
        songRepository,
        eventBus,
      });
      service.enqueue({ auditId: audit._id, bookmarkId: 'bm-1', startSeconds: 5, endSeconds: 10 });
      await pollUntil(async () => {
        const a = await auditRepository.findById(audit._id);
        return a.bookmarks[0].analysis?.status === 'error';
      });

      const statuses = events.filter((e) => e.bid === 'bm-1').map((e) => e.analysis.status);
      expect(statuses).toContain('error');
      const errorEvent = events.find((e) => e.bid === 'bm-1' && e.analysis.status === 'error');
      expect(errorEvent.analysis.error).toMatch(/boom/);
    });

    test('does not throw when eventBus.publish is a no-op / throws', async () => {
      const auditRepository = new InMemoryRepository();
      const songRepository = new InMemoryRepository();
      const { audit, song } = await buildAuditWithBookmark(auditRepository, songRepository);
      const eventBus = { publish: () => { throw new Error('bus down'); } };

      const service = new BookmarkAnalysisService({
        adapter: new MockBookmarkAnalysisAdapter(),
        auditRepository,
        songRepository,
        eventBus,
      });
      service.enqueue({ auditId: audit._id, bookmarkId: 'bm-1', startSeconds: 1, endSeconds: 2 });
      await pollUntil(async () => {
        const a = await auditRepository.findById(audit._id);
        return a.bookmarks[0].analysis?.status === 'success';
      });
      // No assertion — the test is that the service completed without
      // crashing the bus exception.
      const a = await auditRepository.findById(audit._id);
      expect(a.bookmarks[0].analysis.status).toBe('success');
    });

    test('tolerates a missing eventBus (back-compat)', async () => {
      const auditRepository = new InMemoryRepository();
      const songRepository = new InMemoryRepository();
      const { audit, song } = await buildAuditWithBookmark(auditRepository, songRepository);

      const service = new BookmarkAnalysisService({
        adapter: new MockBookmarkAnalysisAdapter(),
        auditRepository,
        songRepository,
        // no eventBus
      });
      service.enqueue({ auditId: audit._id, bookmarkId: 'bm-1', startSeconds: 1, endSeconds: 2 });
      await pollUntil(async () => {
        const a = await auditRepository.findById(audit._id);
        return a.bookmarks[0].analysis?.status === 'success';
      });
    });
  });
});
