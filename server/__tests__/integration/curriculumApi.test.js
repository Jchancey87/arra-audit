import { jest, describe, test, expect, beforeEach, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { InMemoryRepository } from '../../adapters/InMemoryRepository.js';
import { MockAIAdapter } from '../../adapters/MockAIAdapter.js';
import { AuditService } from '../../services/auditService.js';
import { CurriculumService } from '../../services/curriculumService.js';
import createCurriculumRoutes from '../../routes/curricula.js';
import createStudyProgressRoutes from '../../routes/studyProgress.js';

describe('Curriculum & Study Progress API Integration Tests', () => {
  let app;
  let curriculumRepository;
  let studyProgressRepository;
  let songRepository;
  let auditRepository;
  let techniqueRepository;
  let auditService;
  let curriculumService;
  let aiAdapter;

  beforeEach(() => {
    curriculumRepository = new InMemoryRepository();
    studyProgressRepository = new InMemoryRepository();
    songRepository = new InMemoryRepository();
    auditRepository = new InMemoryRepository();
    techniqueRepository = new InMemoryRepository();
    aiAdapter = new MockAIAdapter();

    auditService = new AuditService(auditRepository, techniqueRepository, songRepository);
    curriculumService = new CurriculumService(
      curriculumRepository,
      studyProgressRepository,
      songRepository,
      auditService,
      techniqueRepository,
      aiAdapter
    );

    app = express();
    app.use(express.json());

    // Mock Authentication middleware
    app.use((req, res, next) => {
      req.userId = 'user-123';
      next();
    });

    app.use('/api/curricula', createCurriculumRoutes(curriculumService, techniqueRepository));
    app.use('/api/study-progress', createStudyProgressRoutes(curriculumService));
  });

  afterAll(async () => {
    // Clean up any uploaded test files from server/uploads/
    const uploadDir = path.join(process.cwd(), 'server/uploads');
    if (fs.existsSync(uploadDir)) {
      try {
        const files = fs.readdirSync(uploadDir);
        for (const file of files) {
          if (file.endsWith('.wav') || file.endsWith('.mp3')) {
            fs.unlinkSync(path.join(uploadDir, file));
          }
        }
      } catch (_) {}
    }
  });

  describe('POST /api/study-progress/start', () => {
    test('should start a curriculum and initialize progress', async () => {
      const curriculum = await curriculumRepository.create({
        title: 'Test Curriculum',
        slug: 'test-curriculum',
        creatorType: 'system',
        durationWeeks: 1,
        days: [
          {
            dayNumber: 1,
            lens: 'harmony',
            songQuery: 'Song Query',
            songTitle: 'Song Title',
            artistName: 'Artist Name',
            listeningPrompt: 'Listen carefully',
            applicationPrompt: 'Recreate chords',
            logFields: [{ key: 'harmony_notes', label: 'Harmony Notes', fieldType: 'textarea' }]
          }
        ]
      });

      const res = await request(app)
        .post('/api/study-progress/start')
        .send({ curriculumId: curriculum._id });

      expect(res.status).toBe(201);
      const returnedCurriculumId = typeof res.body.curriculumId === 'object' ? res.body.curriculumId._id : res.body.curriculumId;
      expect(returnedCurriculumId).toBe(curriculum._id);
      expect(res.body.dayProgress).toHaveLength(1);
      expect(res.body.dayProgress[0].dayNumber).toBe(1);
      expect(res.body.dayProgress[0].status).toBe('active');
    });
  });

  describe('GET /api/study-progress/active', () => {
    test('should retrieve the active progress document', async () => {
      const progress = await studyProgressRepository.create({
        userId: 'user-123',
        curriculumId: 'curr-abc',
        currentDay: 1,
        status: 'active',
        dayProgress: []
      });

      const res = await request(app).get('/api/study-progress/active');
      expect(res.status).toBe(200);
      expect(res.body._id).toBe(progress._id);
    });
  });

  describe('POST /api/study-progress/:id/day/:dayNumber/song', () => {
    test('should link a song to a day in the plan', async () => {
      const song = await songRepository.create({
        title: 'My Custom Song',
        artist: 'My Artist',
        userId: 'user-123'
      });

      const progress = await studyProgressRepository.create({
        userId: 'user-123',
        curriculumId: 'curr-abc',
        currentDay: 1,
        status: 'active',
        dayProgress: [{ dayNumber: 1, songId: null, status: 'active', responses: {} }]
      });

      const res = await request(app)
        .post(`/api/study-progress/${progress._id}/day/1/song`)
        .send({ songId: song._id });

      expect(res.status).toBe(200);
      const returnedSongId = typeof res.body.dayProgress[0].songId === 'object' ? res.body.dayProgress[0].songId._id : res.body.dayProgress[0].songId;
      expect(returnedSongId).toBe(song._id);
    });
  });

  describe('POST /api/study-progress/:id/day/:dayNumber/save', () => {
    test('should save responses draft', async () => {
      const progress = await studyProgressRepository.create({
        userId: 'user-123',
        curriculumId: 'curr-abc',
        currentDay: 1,
        status: 'active',
        dayProgress: [{ dayNumber: 1, songId: null, status: 'active', responses: {} }]
      });

      const res = await request(app)
        .post(`/api/study-progress/${progress._id}/day/1/save`)
        .send({ responses: { harmony_notes: 'Draft response text' } });

      expect(res.status).toBe(200);
      expect(res.body.dayProgress[0].responses.harmony_notes).toBe('Draft response text');
    });
  });

  describe('POST /api/study-progress/:id/day/:dayNumber/upload', () => {
    test('should successfully upload an audio sketch', async () => {
      const progress = await studyProgressRepository.create({
        userId: 'user-123',
        curriculumId: 'curr-abc',
        currentDay: 1,
        status: 'active',
        dayProgress: [{ dayNumber: 1, songId: null, status: 'active', responses: {} }]
      });

      const res = await request(app)
        .post(`/api/study-progress/${progress._id}/day/1/upload`)
        .attach('audio', Buffer.from('mock wav file data'), 'sketch.wav');

      expect(res.status).toBe(200);
      expect(res.body.dayProgress[0].audioOriginalName).toBe('sketch.wav');
      expect(res.body.dayProgress[0].audioFilePath).toMatch(/^\/uploads\//);
    });

    test('should reject non-audio files', async () => {
      const progress = await studyProgressRepository.create({
        userId: 'user-123',
        curriculumId: 'curr-abc',
        currentDay: 1,
        status: 'active',
        dayProgress: [{ dayNumber: 1, songId: null, status: 'active', responses: {} }]
      });

      const res = await request(app)
        .post(`/api/study-progress/${progress._id}/day/1/upload`)
        .attach('audio', Buffer.from('hello world'), 'sketch.txt');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Only audio files');
    });
  });

  describe('POST /api/study-progress/:id/day/:dayNumber/complete', () => {
    test('should complete a day, create audit, and create technique notebook entry if synced', async () => {
      const song = await songRepository.create({
        title: 'God Only Knows',
        artist: 'The Beach Boys',
        userId: 'user-123'
      });

      const curriculum = await curriculumRepository.create({
        title: 'Test Curriculum',
        slug: 'test-curriculum',
        creatorType: 'system',
        days: [
          {
            dayNumber: 1,
            lens: 'harmony',
            songQuery: 'God Only Knows',
            songTitle: 'God Only Knows',
            artistName: 'The Beach Boys',
            listeningPrompt: 'Chords...',
            applicationPrompt: 'Inversions...',
            logFields: [
              { key: 'harmony_notes', label: 'Harmony Notes', fieldType: 'textarea' },
              { key: 'steal_move', label: 'Steal Move', fieldType: 'textarea' }
            ]
          }
        ]
      });

      const progress = await studyProgressRepository.create({
        userId: 'user-123',
        curriculumId: curriculum._id,
        currentDay: 1,
        status: 'active',
        dayProgress: [
          {
            dayNumber: 1,
            songId: song._id,
            status: 'active',
            responses: {}
          }
        ]
      });

      const res = await request(app)
        .post(`/api/study-progress/${progress._id}/day/1/complete`)
        .send({
          responses: { harmony_notes: 'Lovely inversions', steal_move: 'Borrow the major IV to minor iv' },
          syncTechnique: true,
          techniqueNotes: 'Notes on Beach Boys counterpoint'
        });

      expect(res.status).toBe(200);
      expect(res.body.dayProgress[0].status).toBe('completed');
      expect(res.body.dayProgress[0].auditId).toBeDefined();

      // Verify Audit creation in database
      const audits = await auditRepository.find({ userId: 'user-123' });
      expect(audits).toHaveLength(1);
      expect(audits[0].songId).toBe(song._id);
      expect(audits[0].responses.harmony_notes).toBe('Lovely inversions');

      // Verify Technique notebook entry
      const techniques = await techniqueRepository.find({ userId: 'user-123' });
      expect(techniques).toHaveLength(1);
      expect(techniques[0].techniqueName).toBe('Steal Move (Day 1)');
      expect(techniques[0].description).toBe('Borrow the major IV to minor iv');
      expect(techniques[0].lens).toBe('harmony');
      expect(techniques[0].artist).toBe('The Beach Boys');
    });
  });

  describe('POST /api/study-progress/:id/week/:weekNumber/review', () => {
    test('should save weekly reflection', async () => {
      const progress = await studyProgressRepository.create({
        userId: 'user-123',
        curriculumId: 'curr-abc',
        currentDay: 7,
        status: 'active',
        dayProgress: [],
        weeklyReviews: [{ weekNumber: 1, changedInEars: '', notUnderstood: '', nextInvestigationQuestion: '', completedAt: null }]
      });

      const res = await request(app)
        .post(`/api/study-progress/${progress._id}/week/1/review`)
        .send({
          changedInEars: 'Active listening is easier',
          notUnderstood: 'Lofi filter effects',
          nextInvestigationQuestion: 'How to structure verses?'
        });

      expect(res.status).toBe(200);
      expect(res.body.weeklyReviews[0].changedInEars).toBe('Active listening is easier');
      expect(res.body.weeklyReviews[0].completedAt).toBeDefined();
    });
  });

  describe('AI Generator & Custom Curriculum Endpoints', () => {
    test('should generate, return, and successfully save an AI custom curriculum', async () => {
      const mockPlan = {
        title: 'Custom Groove Study',
        description: 'Groove-centric custom study program',
        audience: 'Rhythm lover',
        focusAreas: ['Groove'],
        durationWeeks: 1,
        days: [
          {
            dayNumber: 1,
            lens: 'rhythm',
            songQuery: 'D\'Angelo - Spanish Joint',
            songTitle: 'Spanish Joint',
            artistName: 'D\'Angelo',
            listeningPrompt: 'Observe the neo-soul pocket',
            applicationPrompt: 'Record a slightly laid-back drum groove',
            logFields: [
              { key: 'rhythm_notes', label: 'Rhythm Notes', fieldType: 'textarea' },
              { key: 'steal_move', label: 'Steal Move', fieldType: 'textarea' }
            ]
          }
        ]
      };

      aiAdapter.responseOverride = JSON.stringify(mockPlan);

      const genRes = await request(app)
        .post('/api/curricula/generate')
        .send({ focusArea: 'Groove' });

      expect(genRes.status).toBe(200);
      expect(genRes.body.title).toBe('Custom Groove Study');
      expect(genRes.body.days[0].artistName).toBe('D\'Angelo');

      const saveRes = await request(app)
        .post('/api/curricula/custom')
        .send(genRes.body);

      expect(saveRes.status).toBe(201);
      expect(saveRes.body._id).toBeDefined();
      expect(saveRes.body.creatorType).toBe('ai');
      expect(saveRes.body.userId).toBe('user-123');

      // Verify it's retrieved in lists
      const listRes = await request(app).get('/api/curricula');
      expect(listRes.status).toBe(200);
      const customItem = listRes.body.find(c => c._id === saveRes.body._id);
      expect(customItem).toBeDefined();
      expect(customItem.title).toBe('Custom Groove Study');
    });
  });
});
