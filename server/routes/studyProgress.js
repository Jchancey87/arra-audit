import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, '../uploads/');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // Check extension and MIME type
    const filetypes = /mp3|wav|mpeg|x-wav/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files (mp3, wav) are allowed!'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

export default function createStudyProgressRoutes(curriculumService) {
  const router = express.Router();

  async function populateProgress(progress) {
    if (!progress) return null;
    // Handle mongoose document to object conversion if necessary
    const doc = progress.toObject ? progress.toObject() : progress;
    
    if (curriculumService.studyProgressRepository.model) {
      return await curriculumService.studyProgressRepository.model.findById(doc._id)
        .populate('curriculumId')
        .populate('dayProgress.songId')
        .lean();
    } else {
      const pCloned = JSON.parse(JSON.stringify(doc));
      const curriculum = await curriculumService.curriculumRepository.findById(pCloned.curriculumId);
      pCloned.curriculumId = curriculum || pCloned.curriculumId;
      for (const dp of pCloned.dayProgress) {
        if (dp.songId) {
          const song = await curriculumService.songRepository.findById(dp.songId);
          dp.songId = song || dp.songId;
        }
      }
      return pCloned;
    }
  }

  // GET /api/study-progress/active - Returns active planner progress
  router.get('/active', async (req, res) => {
    try {
      const active = await curriculumService.studyProgressRepository.findOne({
        userId: req.userId,
        status: 'active'
      });
      const populated = await populateProgress(active);
      res.json(populated || null);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/study-progress - Returns all progress documents for the logged in user
  router.get('/', async (req, res) => {
    try {
      const list = await curriculumService.studyProgressRepository.find({
        userId: req.userId
      });
      const populatedList = await Promise.all(list.map(p => populateProgress(p)));
      res.json(populatedList);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/study-progress/:id - Get a specific study progress by ID
  router.get('/:id', async (req, res) => {
    try {
      const progress = await curriculumService.studyProgressRepository.findById(req.params.id);
      if (!progress) {
        return res.status(404).json({ error: 'Study progress not found' });
      }
      if (progress.userId.toString() !== req.userId.toString()) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      const populated = await populateProgress(progress);
      res.json(populated);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/study-progress/start - Starts a curriculum (creates StudyProgress document)
  router.post('/start', async (req, res) => {
    try {
      const { curriculumId } = req.body;
      if (!curriculumId) {
        return res.status(400).json({ error: 'curriculumId is required' });
      }
      const progress = await curriculumService.startCurriculum(req.userId, curriculumId);
      const populated = await populateProgress(progress);
      res.status(201).json(populated);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/study-progress/:id/day/:dayNumber/song - Links song to a day
  router.post('/:id/day/:dayNumber/song', async (req, res) => {
    try {
      const { songId } = req.body;
      if (!songId) {
        return res.status(400).json({ error: 'songId is required' });
      }
      const updated = await curriculumService.linkSongToDay(
        req.userId,
        req.params.id,
        req.params.dayNumber,
        songId
      );
      const populated = await populateProgress(updated);
      res.json(populated);
    } catch (error) {
      res.status(error.message.includes('not found') ? 404 : 500).json({ error: error.message });
    }
  });

  // POST /api/study-progress/:id/day/:dayNumber/save - Saves draft answers
  router.post('/:id/day/:dayNumber/save', async (req, res) => {
    try {
      const { responses } = req.body;
      if (!responses) {
        return res.status(400).json({ error: 'responses is required' });
      }
      const updated = await curriculumService.logDayProgress(
        req.userId,
        req.params.id,
        req.params.dayNumber,
        responses
      );
      const populated = await populateProgress(updated);
      res.json(populated);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/study-progress/:id/day/:dayNumber/complete - Completes day, creates Audit & Technique
  router.post('/:id/day/:dayNumber/complete', async (req, res) => {
    try {
      const { responses, syncTechnique, techniqueNotes, auditData } = req.body;
      const updated = await curriculumService.completeDayProgress(
        req.userId,
        req.params.id,
        req.params.dayNumber,
        responses || {},
        !!syncTechnique,
        techniqueNotes,
        auditData
      );
      const populated = await populateProgress(updated);
      res.json(populated);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/study-progress/:id/day/:dayNumber/upload - Handles audio upload
  router.post('/:id/day/:dayNumber/upload', (req, res) => {
    upload.single('audio')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      try {
        const progressId = req.params.id;
        const dayNumber = Number(req.params.dayNumber);
        const userId = req.userId;

        const progress = await curriculumService.studyProgressRepository.findById(progressId);
        if (!progress) {
          return res.status(404).json({ error: 'Study progress not found' });
        }
        if (progress.userId.toString() !== userId.toString()) {
          return res.status(403).json({ error: 'Unauthorized' });
        }

        const day = progress.dayProgress.find(d => d.dayNumber === dayNumber);
        if (!day) {
          return res.status(404).json({ error: `Day ${dayNumber} not found` });
        }

        day.audioFilePath = `/uploads/${req.file.filename}`;
        day.audioOriginalName = req.file.originalname;

        const updated = await curriculumService.studyProgressRepository.updateById(progressId, {
          dayProgress: progress.dayProgress
        });

        const populated = await populateProgress(updated);
        res.json(populated);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  });

  // POST /api/study-progress/:id/week/:weekNumber/review - Records weekly reflections
  router.post('/:id/week/:weekNumber/review', async (req, res) => {
    try {
      const updated = await curriculumService.submitWeeklyReview(
        req.userId,
        req.params.id,
        req.params.weekNumber,
        req.body
      );
      const populated = await populateProgress(updated);
      res.json(populated);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
