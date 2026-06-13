import { jest, describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Curriculum from '../../models/Curriculum.js';
import StudyProgress from '../../models/StudyProgress.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

let MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/arra';
if (MONGODB_URI.includes('/arra?')) {
  MONGODB_URI = MONGODB_URI.replace('/arra?', '/arra_test?');
} else if (MONGODB_URI.endsWith('/arra')) {
  MONGODB_URI = MONGODB_URI.slice(0, -5) + '/arra_test';
}

describe('Curriculum & StudyProgress Model Tests', () => {
  beforeAll(async () => {
    // Connect to test database
    try {
      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 3000
      });
    } catch (err) {
      console.warn('Could not connect to MongoDB, database connected assertions will be skipped:', err.message);
    }
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      // Clean up test data
      try {
        await Curriculum.deleteMany({ slug: { $regex: /^test-/ } });
        await StudyProgress.deleteMany({ userId: new mongoose.Types.ObjectId('000000000000000000000000') });
      } catch (err) {
        console.error('Teardown cleanup error:', err);
      }
      await mongoose.disconnect();
    }
  });

  describe('Curriculum Schema Validation', () => {
    test('should fail validation if required fields are missing', () => {
      const curriculum = new Curriculum({});
      const err = curriculum.validateSync();
      expect(err).toBeDefined();
      expect(err.errors.title).toBeDefined();
      expect(err.errors.slug).toBeDefined();
    });

    test('should fail validation for invalid lens value in day schema', () => {
      const curriculum = new Curriculum({
        title: 'Test Title',
        slug: 'test-slug',
        days: [{
          dayNumber: 1,
          lens: 'invalid-lens',
          songQuery: 'Test',
          songTitle: 'Test',
          artistName: 'Test',
          listeningPrompt: 'Test',
          applicationPrompt: 'Test'
        }]
      });
      const err = curriculum.validateSync();
      expect(err).toBeDefined();
      expect(err.errors['days.0.lens']).toBeDefined();
    });

    test('should validate successfully with valid fields', () => {
      const curriculum = new Curriculum({
        title: 'Test Title',
        slug: 'test-slug',
        days: [{
          dayNumber: 1,
          lens: 'harmony',
          songQuery: 'Test Query',
          songTitle: 'Test Song',
          artistName: 'Test Artist',
          listeningPrompt: 'Test Listen',
          applicationPrompt: 'Test Apply',
          logFields: [{
            key: 'test_key',
            label: 'Test Label',
            fieldType: 'textarea'
          }]
        }]
      });
      const err = curriculum.validateSync();
      expect(err).toBeUndefined();
    });
  });

  describe('Curriculum Database Operations', () => {
    test('should save and retrieve a curriculum successfully', async () => {
      if (mongoose.connection.readyState !== 1) {
        console.warn('Skipping DB test: no connection');
        return;
      }

      const slug = `test-slug-${Date.now()}`;
      const curriculum = new Curriculum({
        title: 'Test Database Title',
        slug: slug,
        days: [{
          dayNumber: 1,
          lens: 'harmony',
          songQuery: 'Test Query',
          songTitle: 'Test Song',
          artistName: 'Test Artist',
          listeningPrompt: 'Test Listen',
          applicationPrompt: 'Test Apply'
        }]
      });

      const saved = await curriculum.save();
      expect(saved._id).toBeDefined();

      const retrieved = await Curriculum.findOne({ slug });
      expect(retrieved).toBeDefined();
      expect(retrieved.title).toBe('Test Database Title');
      expect(retrieved.days).toHaveLength(1);
      expect(retrieved.days[0].lens).toBe('harmony');
    });
  });

  describe('StudyProgress Schema Validation & DB Operations', () => {
    test('should fail validation for missing userId or curriculumId', () => {
      const progress = new StudyProgress({});
      const err = progress.validateSync();
      expect(err).toBeDefined();
      expect(err.errors.userId).toBeDefined();
      expect(err.errors.curriculumId).toBeDefined();
    });

    test('should save and retrieve StudyProgress successfully', async () => {
      if (mongoose.connection.readyState !== 1) {
        console.warn('Skipping DB test: no connection');
        return;
      }

      const userId = new mongoose.Types.ObjectId('000000000000000000000000');
      const curriculumId = new mongoose.Types.ObjectId('111111111111111111111111');

      // Clear any prior
      await StudyProgress.deleteMany({ userId, curriculumId });

      const progress = new StudyProgress({
        userId,
        curriculumId,
        currentDay: 1,
        dayProgress: [{
          dayNumber: 1,
          responses: { harmony_notes: 'Great chords' },
          status: 'completed',
          completedAt: new Date()
        }],
        weeklyReviews: [{
          weekNumber: 1,
          changedInEars: 'Everything',
          notUnderstood: 'Nothing',
          nextInvestigationQuestion: 'How to do counterpoint'
        }]
      });

      const saved = await progress.save();
      expect(saved._id).toBeDefined();

      const retrieved = await StudyProgress.findOne({ userId, curriculumId });
      expect(retrieved).toBeDefined();
      expect(retrieved.currentDay).toBe(1);
      expect(retrieved.dayProgress).toHaveLength(1);
      expect(retrieved.dayProgress[0].responses.harmony_notes).toBe('Great chords');
      expect(retrieved.weeklyReviews).toHaveLength(1);
      expect(retrieved.weeklyReviews[0].changedInEars).toBe('Everything');
    });
  });
});
