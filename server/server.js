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

// Services
import { AuthService } from './services/authService.js';
import { SongService } from './services/songService.js';
import { AuditService } from './services/auditService.js';
import { TechniqueService } from './services/techniqueService.js';
import { TemplateComposer } from './services/templateComposer.js';

// Routes
import createAuthRoutes from './routes/auth.js';
import createSongRoutes from './routes/songs.js';
import createAuditRoutes from './routes/audits.js';
import createTechniqueRoutes from './routes/techniques.js';

import { authMiddleware } from './middleware/auth.js';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sonic_dna')
  .then(() => console.log('✓ MongoDB connected'))
  .catch((err) => console.error('✗ MongoDB connection error:', err));

// ── Bootstrap Dependencies ────────────────────────────────────────────────────
const aiAdapter = new OpenAIAdapter();
const searchAdapter = new TavilyAdapter();

const userRepository = new MongooseRepository(User);
const songRepository = new MongooseRepository(Song);
const auditRepository = new MongooseRepository(Audit);
const techniqueRepository = new MongooseRepository(TechniqueEntry);

const authService = new AuthService(userRepository);
const songService = new SongService(songRepository, searchAdapter, aiAdapter);
const auditService = new AuditService(auditRepository, techniqueRepository, songRepository);
const techniqueService = new TechniqueService(techniqueRepository);
const templateComposer = new TemplateComposer(aiAdapter);

// ── Routes (all under /api/) ──────────────────────────────────────────────────
app.use('/api/auth',       createAuthRoutes(authService));
app.use('/api/songs',      authMiddleware, createSongRoutes(songService, auditRepository, techniqueRepository));
app.use('/api/audits',     authMiddleware, createAuditRoutes(auditService, templateComposer));
app.use('/api/techniques', authMiddleware, createTechniqueRoutes(techniqueService));

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
