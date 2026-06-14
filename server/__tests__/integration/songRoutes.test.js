import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import createSongRoutes from '../../routes/songs.js';
import { SongService } from '../../services/songService.js';
import { InMemoryRepository } from '../../adapters/InMemoryRepository.js';

describe('Song Routes Integration', () => {
  let app;
  let songService;
  let songRepository;

  beforeEach(() => {
    // Setup test container
    songRepository = new InMemoryRepository();
    
    // Mock search service
    const mockSearchService = {
      searchSongInfo: jest.fn().mockResolvedValue({
        summary: 'Mock research summary',
        sources: []
      })
    };

    songService = new SongService(songRepository, mockSearchService);
    
    app = express();
    app.use(express.json());
    
    // Mock authentication middleware
    app.use((req, res, next) => {
      req.userId = 'user-123';
      next();
    });

    app.use('/api/songs', createSongRoutes(songService));
  });

  describe('POST /api/songs/import', () => {
    test('should import a song successfully', async () => {
      const res = await request(app)
        .post('/api/songs/import')
        .send({ youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });

      expect(res.status).toBe(201);
      expect(res.body.song.youtubeId).toBe('dQw4w9WgXcQ');
      expect(res.body.song.title).toBeDefined();
      
      // Verify it was saved in repository
      const saved = await songRepository.find({ userId: 'user-123' });
      expect(saved).toHaveLength(1);
    });

    test('should fail if youtubeUrl is missing', async () => {
      const res = await request(app)
        .post('/api/songs/import')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: expect.stringMatching(/required/i) }),
        ])
      );
    });
  });

  describe('GET /api/songs', () => {
    test('should return all songs for the user', async () => {
      // Seed data
      await songRepository.create({ 
        title: 'Song 1', 
        artist: 'Artist 1', 
        userId: 'user-123',
        youtubeId: 'id1',
        youtubeUrl: 'url1',
        importedAt: new Date('2023-01-01'),
        createdAt: new Date('2023-01-01')
      });
      await songRepository.create({ 
        title: 'Song 2', 
        artist: 'Artist 2', 
        userId: 'user-123',
        youtubeId: 'id2',
        youtubeUrl: 'url2',
        importedAt: new Date('2023-01-02'),
        createdAt: new Date('2023-01-02')
      });
      await songRepository.create({ 
        title: 'Other User Song', 
        artist: 'Artist X', 
        userId: 'other-user',
        importedAt: new Date('2023-01-03'),
        createdAt: new Date('2023-01-03')
      });

      const res = await request(app).get('/api/songs');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].title).toBe('Song 2'); // Sorted by date desc
    });
  });

  describe('DELETE /api/songs/:id', () => {
    test('should delete a song', async () => {
      const song = await songRepository.create({ 
        title: 'To Delete', 
        userId: 'user-123' 
      });

      const res = await request(app).delete(`/api/songs/${song._id}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Song deleted');
      
      const found = await songRepository.findById(song._id);
      expect(found.deletedAt).toBeDefined();
    });

    test('should return 404 if song does not exist', async () => {
      const res = await request(app).delete('/api/songs/non-existent-id');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/songs/trash', () => {
    test('should return soft-deleted songs', async () => {
      await songRepository.create({ title: 'Active Song', userId: 'user-123', deletedAt: null });
      const deletedSong = await songRepository.create({ title: 'Deleted Song', userId: 'user-123', deletedAt: new Date() });

      const res = await request(app).get('/api/songs/trash');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('Deleted Song');
    });
  });

  describe('POST /api/songs/:id/restore', () => {
    test('should restore a soft-deleted song', async () => {
      const song = await songRepository.create({ title: 'Deleted Song', userId: 'user-123', deletedAt: new Date() });

      const res = await request(app).post(`/api/songs/${song._id}/restore`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Song restored successfully');

      const found = await songRepository.findById(song._id);
      expect(found.deletedAt).toBeNull();
    });
  });

  describe('DELETE /api/songs/:id/purge', () => {
    test('should permanently purge a song', async () => {
      const song = await songRepository.create({ title: 'Deleted Song', userId: 'user-123', deletedAt: new Date() });

      const res = await request(app).delete(`/api/songs/${song._id}/purge`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Song permanently deleted');

      const found = await songRepository.findById(song._id);
      expect(found).toBeNull();
    });
  });
});
