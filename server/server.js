import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Adapters & Repositories
import { OpenAIAdapter } from './adapters/OpenAIAdapter.js';
import { TavilyAdapter } from './adapters/TavilyAdapter.js';
import { MongooseRepository } from './adapters/MongooseRepository.js';

// Models
import User from './models/User.js';
import Song from './models/Song.js';
import Audit from './models/Audit.js';
import TechniqueEntry from './models/TechniqueEntry.js';
import TasteProfile from './models/TasteProfile.js';

// Services
import { AuthService } from './services/authService.js';
import { SongService } from './services/songService.js';
import { AuditService } from './services/auditService.js';
import { TechniqueService } from './services/techniqueService.js';
import { TemplateComposer } from './services/templateComposer.js';
import { TasteService } from './services/tasteService.js';

// Routes
import createAuthRoutes from './routes/auth.js';
import createSongRoutes from './routes/songs.js';
import createAuditRoutes from './routes/audits.js';
import createTechniqueRoutes from './routes/techniques.js';
import createTasteRoutes from './routes/tastes.js';

import { authMiddleware } from './middleware/auth.js';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/arra')
  .then(() => console.log('✓ MongoDB connected'))
  .catch((err) => console.error('✗ MongoDB connection error:', err));

// ── Bootstrap Dependencies ────────────────────────────────────────────────────
const aiAdapter = new OpenAIAdapter();
const searchAdapter = new TavilyAdapter();

const userRepository = new MongooseRepository(User);
const songRepository = new MongooseRepository(Song);
const auditRepository = new MongooseRepository(Audit);
const techniqueRepository = new MongooseRepository(TechniqueEntry);
const tasteProfileRepository = new MongooseRepository(TasteProfile);

const authService = new AuthService(userRepository);
const songService = new SongService(songRepository, searchAdapter, aiAdapter);
const auditService = new AuditService(auditRepository, techniqueRepository, songRepository);
const techniqueService = new TechniqueService(techniqueRepository);
const templateComposer = new TemplateComposer(aiAdapter);
const tasteService = new TasteService(tasteProfileRepository, searchAdapter, aiAdapter);

// ── Routes (all under /api/) ──────────────────────────────────────────────────
app.post('/api/public/songs/:id/analysis-completed', async (req, res) => {
  try {
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
app.use('/api/audits',     authMiddleware, createAuditRoutes(auditService, templateComposer));
app.use('/api/techniques', authMiddleware, createTechniqueRoutes(techniqueService));
app.use('/api/tastes',     authMiddleware, createTasteRoutes(tasteService));

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
