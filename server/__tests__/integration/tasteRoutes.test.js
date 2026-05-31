import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import createTasteRoutes from '../../routes/tastes.js';
import { TasteService } from '../../services/tasteService.js';
import { InMemoryRepository } from '../../adapters/InMemoryRepository.js';

describe('Taste Routes Integration', () => {
  let app;
  let tasteService;
  let tasteProfileRepository;
  let mockSearchService;
  let mockAiService;

  beforeEach(() => {
    tasteProfileRepository = new InMemoryRepository();
    
    mockSearchService = {
      search: jest.fn().mockResolvedValue({
        query: 'Jamerson rhythm',
        results: [
          { title: 'Source 1', url: 'http://example.com/1', content: 'Jamerson rhythm style content 1' },
          { title: 'Source 2', url: 'http://example.com/2', content: 'Jamerson rhythm style content 2' },
        ],
      }),
    };

    mockAiService = {
      generateCompletion: jest.fn().mockResolvedValue('Synthesized style summary from search.'),
    };

    tasteService = new TasteService(tasteProfileRepository, mockSearchService, mockAiService);

    app = express();
    app.use(express.json());

    // Mock authentication middleware
    app.use((req, res, next) => {
      req.userId = 'user-123';
      next();
    });

    app.use('/api/tastes', createTasteRoutes(tasteService));
  });

  describe('GET /api/tastes', () => {
    test('should return all taste profiles for the logged-in user', async () => {
      await tasteProfileRepository.create({
        userId: 'user-123',
        lens: 'rhythm',
        name: 'Jamerson',
        summary: 'Original Bass Style',
        sources: [],
      });

      await tasteProfileRepository.create({
        userId: 'other-user',
        lens: 'texture',
        name: 'Kevin Shields',
        summary: 'Gaze Style',
        sources: [],
      });

      const res = await request(app).get('/api/tastes');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Jamerson');
    });
  });

  describe('POST /api/tastes/research', () => {
    test('should trigger deep research dive and return the profile', async () => {
      const res = await request(app)
        .post('/api/tastes/research')
        .send({ lens: 'rhythm', name: 'Jamerson' });

      expect(res.status).toBe(200);
      expect(res.body.profile).toBeDefined();
      expect(res.body.profile.name).toBe('Jamerson');
      expect(res.body.profile.lens).toBe('rhythm');
      expect(res.body.profile.summary).toBe('Synthesized style summary from search.');
      expect(res.body.profile.sources).toHaveLength(2);
      expect(mockSearchService.search).toHaveBeenCalledWith(
        'Jamerson signature rhythm music production techniques analysis style',
        10
      );
      expect(mockAiService.generateCompletion).toHaveBeenCalled();
    });

    test('should return 400 if lens or name are missing', async () => {
      const res = await request(app)
        .post('/api/tastes/research')
        .send({ lens: 'rhythm' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('lens and name are required');
    });

    test('should return 400 if lens is invalid', async () => {
      const res = await request(app)
        .post('/api/tastes/research')
        .send({ lens: 'invalid-lens', name: 'Jamerson' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid lens');
    });
  });
});
