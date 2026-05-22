import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import createAuditRoutes from '../../routes/audits.js';
import { AuditService } from '../../services/auditService.js';
import { InMemoryRepository } from '../../adapters/InMemoryRepository.js';

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

    app.use('/api/audits', createAuditRoutes(auditService, null));
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
});
