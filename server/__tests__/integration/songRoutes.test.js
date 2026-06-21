import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import express from 'express';
import createSongRoutes from '../../routes/songs.js';
import { SongService } from '../../services/songService.js';
import { InMemoryRepository } from '../../adapters/InMemoryRepository.js';
import { FilesystemAudioStorageAdapter } from '../../services/audioStorageService.js';

describe('Song Routes Integration', () => {
  let app;
  let songService;
  let songRepository;
  let audioDownloader;
  let audioStorage;
  let tmpUploadsRoot;
  let tmpSourceDir;
  let mockSourceFile;

  beforeEach(() => {
    songRepository = new InMemoryRepository();
    const mockSearchService = {
      searchSongInfo: jest.fn().mockResolvedValue({
        summary: 'Mock research summary',
        sources: []
      })
    };

    // Stand up a real FilesystemAudioStorageAdapter against a tmp dir, plus
    // a fake AudioDownloadService the tests can program to succeed or throw.
    tmpUploadsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'arra-routes-uploads-'));
    tmpSourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arra-routes-source-'));
    audioStorage = new FilesystemAudioStorageAdapter({ uploadsRoot: tmpUploadsRoot });
    mockSourceFile = path.join(tmpSourceDir, 'mock.mp3');
    fs.writeFileSync(mockSourceFile, Buffer.from('fake-mp3-bytes-for-test'));

    audioDownloader = {
      downloadToTemp: jest.fn().mockResolvedValue({
        sourcePath: mockSourceFile,
        tempDir: tmpSourceDir,
      }),
    };

    songService = new SongService(songRepository, mockSearchService, null, audioStorage);

    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.userId = 'user-123';
      next();
    });

    app.use('/api/songs', createSongRoutes(
      songService,
      songRepository,           // auditRepository
      null,                     // techniqueRepository
      null,                     // sketchRepository
      audioStorage,
      audioDownloader
    ));
  });

  afterEach(() => {
    try { fs.rmSync(tmpUploadsRoot, { recursive: true, force: true }); } catch (_) { /* ignore */ }
    try { fs.rmSync(tmpSourceDir, { recursive: true, force: true }); } catch (_) { /* ignore */ }
  });

  describe('POST /api/songs/import', () => {
    test('should import a song synchronously and return 201 with publicUrl set', async () => {
      const res = await request(app)
        .post('/api/songs/import')
        .send({ youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });

      expect(res.status).toBe(201);
      expect(res.body.song.youtubeId).toBe('dQw4w9WgXcQ');
      expect(res.body.song.title).toBeDefined();
      // The new sync-import contract: publicUrl is set on the response.
      expect(res.body.song.publicUrl).toMatch(/^\/uploads\/songs\/.+\.mp3$/);
      expect(res.body.song.sourceType).toBe('local');
      expect(res.body.song.audioSizeBytes).toBe(Buffer.byteLength('fake-mp3-bytes-for-test'));
      expect(res.body.song.audioDownloadedAt).toBeDefined();
      // The downloader must have been awaited exactly once.
      expect(audioDownloader.downloadToTemp).toHaveBeenCalledTimes(1);

      // Verify the file actually landed on disk.
      const saved = await songRepository.find({ userId: 'user-123' });
      expect(saved).toHaveLength(1);
      const diskPath = path.join(tmpUploadsRoot, 'songs', `${saved[0]._id}.mp3`);
      expect(fs.existsSync(diskPath)).toBe(true);
    });

    test('deletes the half-imported song and returns 502 when the download fails', async () => {
      audioDownloader.downloadToTemp.mockRejectedValueOnce(
        new Error('YouTube rate-limited')
      );

      const res = await request(app)
        .post('/api/songs/import')
        .send({ youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });

      expect(res.status).toBe(502);
      expect(res.body.error).toBe('audio_download_failed');
      expect(res.body.message).toMatch(/YouTube rate-limited/);
      // The song must NOT be in the repo (rolled back).
      const saved = await songRepository.find({ userId: 'user-123' });
      expect(saved).toHaveLength(0);
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

  describe('POST /api/songs/:id/download-audio', () => {
    test('downloads audio for a song stuck with publicUrl=null (legacy recovery)', async () => {
      // Seed a stuck legacy song (publicUrl=null, sourceType=youtube).
      const stuck = await songRepository.create({
        title: 'Stuck Song',
        userId: 'user-123',
        sourceType: 'youtube',
        publicUrl: null,
        originalUrl: 'https://www.youtube.com/watch?v=stuck000001',
        youtubeUrl: 'https://www.youtube.com/watch?v=stuck000001',
      });

      const res = await request(app)
        .post(`/api/songs/${stuck._id}/download-audio`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.song._id).toBe(stuck._id);
      expect(res.body.song.publicUrl).toBe(`/uploads/songs/${stuck._id}.mp3`);
      expect(res.body.song.sourceType).toBe('local');
    });

    test('returns 409 if the song already has local audio', async () => {
      const done = await songRepository.create({
        title: 'Already Local',
        userId: 'user-123',
        sourceType: 'local',
        publicUrl: '/uploads/songs/done00000001.mp3',
        originalUrl: 'https://www.youtube.com/watch?v=done00000001',
      });

      const res = await request(app)
        .post(`/api/songs/${done._id}/download-audio`)
        .send({});

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('already_has_local_audio');
      // Downloader must not have been called.
      expect(audioDownloader.downloadToTemp).not.toHaveBeenCalled();
    });

    test('returns 502 when the download fails (song left unchanged)', async () => {
      const stuck = await songRepository.create({
        title: 'Stuck Song',
        userId: 'user-123',
        sourceType: 'youtube',
        publicUrl: null,
        originalUrl: 'https://www.youtube.com/watch?v=stuck000002',
      });
      audioDownloader.downloadToTemp.mockRejectedValueOnce(new Error('Network blip'));

      const res = await request(app)
        .post(`/api/songs/${stuck._id}/download-audio`)
        .send({});

      expect(res.status).toBe(502);
      // Song must be untouched (NOT rolled back like /import does).
      const after = await songRepository.findById(stuck._id);
      expect(after.publicUrl).toBeNull();
      expect(after.sourceType).toBe('youtube');
    });

    test('returns 404 for a non-owned song', async () => {
      const other = await songRepository.create({
        title: 'Other User',
        userId: 'other-user',
        sourceType: 'youtube',
        publicUrl: null,
      });
      const res = await request(app)
        .post(`/api/songs/${other._id}/download-audio`)
        .send({});
      expect(res.status).toBe(404);
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
