import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import createAuditRoutes from '../../routes/audits.js';
import { AuditService } from '../../services/auditService.js';
import { InMemoryRepository } from '../../adapters/InMemoryRepository.js';
import { bookmarkAnalysisBus } from '../../services/BookmarkAnalysisBus.js';

describe('Audit Routes Integration', () => {
  let app;
  let auditService;
  let auditRepository;
  let techniqueRepository;
  let songRepository;

  beforeEach(() => {
    auditRepository = new InMemoryRepository();
    techniqueRepository = new InMemoryRepository();
    songRepository = new InMemoryRepository();

    auditService = new AuditService(auditRepository, techniqueRepository, songRepository);
    
    app = express();
    app.use(express.json());
    
    // Mock authentication middleware
    app.use((req, res, next) => {
      req.userId = 'user-123';
      next();
    });

    app.use('/api/audits', createAuditRoutes(auditService, null, techniqueRepository));
  });

  describe('GET /api/audits/trash', () => {
    test('should return only soft-deleted audits for active songs', async () => {
      const activeSong = await songRepository.create({ title: 'Active Song', userId: 'user-123', deletedAt: null });
      const deletedSong = await songRepository.create({ title: 'Deleted Song', userId: 'user-123', deletedAt: new Date() });

      const audit1 = await auditRepository.create({
        songId: activeSong._id,
        userId: 'user-123',
        deletedAt: new Date('2023-01-01'),
        lensSelection: ['rhythm']
      });

      const audit2 = await auditRepository.create({
        songId: deletedSong._id,
        userId: 'user-123',
        deletedAt: new Date('2023-01-02'),
        lensSelection: ['texture']
      });

      const res = await request(app).get('/api/audits/trash');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]._id).toBe(audit1._id);
    });
  });

  describe('POST /api/audits/:id/restore', () => {
    test('should restore a soft-deleted audit', async () => {
      const activeSong = await songRepository.create({ title: 'Active Song', userId: 'user-123', deletedAt: null });
      const audit = await auditRepository.create({
        songId: activeSong._id,
        userId: 'user-123',
        deletedAt: new Date(),
        lensSelection: ['rhythm']
      });

      const res = await request(app).post(`/api/audits/${audit._id}/restore`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Audit restored successfully');

      const found = await auditRepository.findById(audit._id);
      expect(found.deletedAt).toBeNull();
    });

    test('should fail to restore if parent song is deleted', async () => {
      const deletedSong = await songRepository.create({ title: 'Deleted Song', userId: 'user-123', deletedAt: new Date() });
      const audit = await auditRepository.create({
        songId: deletedSong._id,
        userId: 'user-123',
        deletedAt: new Date(),
        lensSelection: ['rhythm']
      });

      const res = await request(app).post(`/api/audits/${audit._id}/restore`);

      expect(res.status).toBe(500); // Because it throws error from service
      expect(res.body.error).toContain('parent song is deleted');
    });
  });

  describe('DELETE /api/audits/:id/purge', () => {
    test('should permanently purge an audit', async () => {
      const audit = await auditRepository.create({
        songId: 'song-1',
        userId: 'user-123',
        deletedAt: new Date(),
        lensSelection: ['rhythm']
      });

      const res = await request(app).delete(`/api/audits/${audit._id}/purge`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Audit permanently deleted');

      const found = await auditRepository.findById(audit._id);
      expect(found).toBeNull();
    });
  });

  describe('GET /api/audits/:id/bookmarks/events (SSE)', () => {
    let sseApp;
    let sseRouter;

    beforeEach(() => {
      // Express lazily builds the app's router; build a router directly
      // so we can introspect the route stack without an HTTP roundtrip.
      sseRouter = createAuditRoutes(
        auditService,
        null,
        techniqueRepository,
        null,
        { analysisBus: bookmarkAnalysisBus, auditRepository }
      );
      sseApp = express();
      sseApp.use(express.json());
      sseApp.use((req, res, next) => {
        req.userId = 'user-123';
        next();
      });
      sseApp.use('/api/audits', sseRouter);
    });

    afterEach(() => {
      bookmarkAnalysisBus.clear();
    });

    test('returns 404 when caller does not own the audit', async () => {
      const audit = await auditRepository.create({
        songId: 'song-1',
        userId: 'other-user',
        deletedAt: null,
        lensSelection: ['rhythm'],
      });

      const res = await request(sseApp).get(
        `/api/audits/${audit._id}/bookmarks/events`
      );

      expect(res.status).toBe(404);
    });

    test('opens SSE stream for owner (regression: audit is not defined)', async () => {
      const audit = await auditRepository.create({
        songId: 'song-1',
        userId: 'user-123',
        deletedAt: null,
        lensSelection: ['rhythm'],
      });
      bookmarkAnalysisBus.publish(audit._id, 'b1', { status: 'pending' });

      // Pull the route handler out of the express router and invoke it
      // with a mock req/res. This is the same pattern
      // BookmarkAnalysisBus.test.js uses for the SSE handler — it avoids
      // spinning up an HTTP server and the long-lived connection that
      // would otherwise keep the test (and jest) alive.
      const eventsLayer = sseRouter.stack.find(
        (l) => l.route?.path === '/:id/bookmarks/events'
      );
      expect(eventsLayer).toBeDefined();
      const handler = eventsLayer.route.stack[0].handle;

      const written = [];
      const reqListeners = {};
      const req = {
        params: { id: audit._id },
        userId: 'user-123',
        on: (event, cb) => { reqListeners[event] = cb; },
        _triggerClose: () => reqListeners.close?.(),
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        flushHeaders: jest.fn(),
        write: jest.fn((chunk) => {
          written.push(chunk.toString());
          return true;
        }),
        end: jest.fn(),
      };

      await handler(req, res, () => {});

      // Simulate the client closing the connection so the SSE handler's
      // heartbeat interval is cleared.
      req._triggerClose();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.set).toHaveBeenCalledWith(
        expect.objectContaining({ 'Content-Type': 'text/event-stream' })
      );
      const body = written.join('');
      expect(body).toMatch(/event: snapshot/);
      expect(body).toContain(`"auditId":"${audit._id}"`);
      expect(req.params.id).toBe(audit._id);
    });
  });
});
