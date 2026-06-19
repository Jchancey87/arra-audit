import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Adapters & Repositories
import { OpenAIAdapter } from './adapters/OpenAIAdapter.js';
import { TavilyAdapter } from './adapters/TavilyAdapter.js';
import { MongooseRepository, UserRepository } from './adapters/MongooseRepository.js';

// Models
import User from './models/User.js';
import Song from './models/Song.js';
import Audit from './models/Audit.js';
import TechniqueEntry from './models/TechniqueEntry.js';
import TasteProfile from './models/TasteProfile.js';
import Curriculum from './models/Curriculum.js';
import StudyProgress from './models/StudyProgress.js';
import SongSketch from './models/SongSketch.js';

// Services
import { AuthService } from './services/authService.js';
import { SongService } from './services/songService.js';
import { AuditService } from './services/auditService.js';
import { TechniqueService } from './services/techniqueService.js';
import { TemplateComposer } from './services/templateComposer.js';
import { TasteService } from './services/tasteService.js';
import { CurriculumService } from './services/curriculumService.js';
import { SketchService } from './services/SketchService.js';

// Routes
import createAuthRoutes from './routes/auth.js';
import createSongRoutes from './routes/songs.js';
import createAuditRoutes from './routes/audits.js';
import createTechniqueRoutes from './routes/techniques.js';
import createTasteRoutes from './routes/tastes.js';
import createCurriculumRoutes from './routes/curricula.js';
import createStudyProgressRoutes from './routes/studyProgress.js';
import createSketchRoutes from './routes/sketches.js';

import { authMiddleware } from './middleware/auth.js';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const isProduction = process.env.NODE_ENV === 'production';

// Required secrets fail closed
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

if (isProduction && !process.env.CLIENT_ORIGIN) {
  throw new Error('CLIENT_ORIGIN environment variable is required in production');
}

if (isProduction && !process.env.ANALYSIS_WEBHOOK_SECRET) {
  throw new Error('ANALYSIS_WEBHOOK_SECRET environment variable is required in production');
}

const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const analysisWebhookSecret = process.env.ANALYSIS_WEBHOOK_SECRET;

if (!isProduction && !analysisWebhookSecret) {
  console.warn('[Security] ANALYSIS_WEBHOOK_SECRET is not set; analysis webhook is unprotected in development');
}

const app = express();

// Trust proxy to allow rate limiter to identify users correctly behind proxy/sandboxes
app.set('trust proxy', 1);

// Middleware
app.use(cors({ origin: clientOrigin, credentials: true }));
app.use(express.json());

// Global rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 100 : 10000, // Keep production safe but prevent blocking in development
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(generalLimiter);

// Database connection
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/arra')
  .then(() => console.log('✓ MongoDB connected'))
  .catch((err) => console.error('✗ MongoDB connection error:', err));

// ── Bootstrap Dependencies ────────────────────────────────────────────────────
const aiAdapter = new OpenAIAdapter();
const searchAdapter = new TavilyAdapter();

const userRepository = new UserRepository(User);
const songRepository = new MongooseRepository(Song);
const auditRepository = new MongooseRepository(Audit);
const techniqueRepository = new MongooseRepository(TechniqueEntry);
const tasteProfileRepository = new MongooseRepository(TasteProfile);
const curriculumRepository = new MongooseRepository(Curriculum);
const studyProgressRepository = new MongooseRepository(StudyProgress);
const sketchRepository = new MongooseRepository(SongSketch);

const authService = new AuthService(userRepository);
const songService = new SongService(songRepository, searchAdapter, aiAdapter);
const auditService = new AuditService(auditRepository, techniqueRepository, songRepository);
const techniqueService = new TechniqueService(techniqueRepository);
const templateComposer = new TemplateComposer(aiAdapter);
const tasteService = new TasteService(tasteProfileRepository, searchAdapter, aiAdapter);
const curriculumService = new CurriculumService(
  curriculumRepository,
  studyProgressRepository,
  songRepository,
  auditService,
  techniqueRepository,
  aiAdapter
);
const sketchService = new SketchService(sketchRepository, songRepository);

// ── Routes (all under /api/) ──────────────────────────────────────────────────
app.post('/api/public/songs/:id/analysis-completed', async (req, res) => {
  try {
    if (analysisWebhookSecret) {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (token !== analysisWebhookSecret) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    const { id } = req.params;
    const { status, analysis, error } = req.body;
    console.log(`[Webhook] Received analysis callback for song ${id}. Status: ${status}`);

    const song = await Song.findById(id);
    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    if (status === 'success') {
      song.audioAnalysisStatus = 'success';
      song.audioAnalysis = analysis;
    } else {
      song.audioAnalysisStatus = 'failed';
      song.importErrors = song.importErrors || [];
      song.importErrors.push(`Audio analysis error: ${error || 'Unknown error'}`);
    }

    await song.save();
    res.json({ success: true });
  } catch (err) {
    console.error('[Webhook] Analysis callback error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.use('/api/auth',       createAuthRoutes(authService));
app.use('/api/songs',      authMiddleware, createSongRoutes(songService, auditRepository, techniqueRepository));
app.use('/api/audits',     authMiddleware, createAuditRoutes(auditService, templateComposer, techniqueRepository));
app.use('/api/techniques', authMiddleware, createTechniqueRoutes(techniqueService));
app.use('/api/tastes',     authMiddleware, createTasteRoutes(tasteService));
app.use('/api/curricula',      authMiddleware, createCurriculumRoutes(curriculumService, techniqueRepository));
app.use('/api/study-progress', authMiddleware, createStudyProgressRoutes(curriculumService));
app.use('/api/sketches',       authMiddleware, createSketchRoutes(sketchService));

// Static file serving for audio uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
  console.log(`✓ Server running on http://localhost:${PORT}`);
});
