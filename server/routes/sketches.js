// Sketch upload/list/delete/analyze routes. Multer config accepts up to 100MB
// to cover 3-min DAW exports (a 10-min 44.1kHz/16-bit stereo wav is ~100MB).

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, '../uploads/');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const ALLOWED_EXT = ['.mp3', '.wav', '.m4a', '.aac', '.flac'];
const ALLOWED_MIME_PREFIXES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/m4a', 'audio/mp4', 'audio/aac', 'audio/x-aac', 'audio/flac', 'audio/x-flac'];
const MAX_BYTES = 100 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `sketch-${uniqueSuffix}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    const extOk = ALLOWED_EXT.includes(ext);
    const mimeOk = ALLOWED_MIME_PREFIXES.some((prefix) => mime === prefix || mime.startsWith(`${prefix};`));
    if (extOk && mimeOk) cb(null, true);
    else cb(new Error('Only audio files (mp3, wav, m4a, aac, flac) are allowed'));
  },
  limits: { fileSize: MAX_BYTES },
});

function _sanitizeSketch(s) {
  if (!s) return null;
  return {
    _id: s._id,
    userId: s.userId,
    songId: s.songId,
    title: s.title,
    fileName: s.fileName,
    originalName: s.originalName,
    filePath: s.filePath,
    publicUrl: s.publicUrl,
    mimeType: s.mimeType,
    sizeBytes: s.sizeBytes,
    durationSeconds: s.durationSeconds,
    analysis: s.analysis,
    analysisStatus: s.analysisStatus,
    analysisError: s.analysisError,
    notes: s.notes,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

export default function createSketchRoutes(sketchService) {
  const router = express.Router();

  // List sketches for a song
  router.get('/songs/:songId', async (req, res) => {
    try {
      const list = await sketchService.getSketchesForSong(req.params.songId, req.userId);
      res.json(list.map(_sanitizeSketch));
    } catch (err) {
      console.error('[sketches] list error:', err);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  // Upload a new sketch
  router.post('/songs/:songId/upload', (req, res) => {
    upload.single('audio')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      try {
        const sketch = await sketchService.createSketch({
          userId: req.userId,
          songId: req.params.songId,
          file: req.file,
          title: req.body?.title,
          notes: req.body?.notes,
        });
        res.status(201).json(_sanitizeSketch(sketch));
      } catch (e) {
        // Clean up the uploaded file on error to avoid orphans
        try {
          if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        } catch (_) { /* swallow */ }
        console.error('[sketches] upload error:', e);
        res.status(e.status || 500).json({ error: e.message });
      }
    });
  });

  // Get a single sketch
  router.get('/:id', async (req, res) => {
    try {
      const sketch = await sketchService.getSketch(req.params.id, req.userId);
      res.json(_sanitizeSketch(sketch));
    } catch (err) {
      console.error('[sketches] get error:', err);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  // Delete a sketch (soft)
  router.delete('/:id', async (req, res) => {
    try {
      const out = await sketchService.deleteSketch(req.params.id, req.userId);
      res.json({ deleted: true, sketch: _sanitizeSketch(out) });
    } catch (err) {
      console.error('[sketches] delete error:', err);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  // Patch sketch metadata (title/notes/durationSeconds)
  router.patch('/:id', async (req, res) => {
    try {
      const out = await sketchService.updateSketch(req.params.id, req.userId, req.body || {});
      res.json(_sanitizeSketch(out));
    } catch (err) {
      console.error('[sketches] patch error:', err);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  // Trigger Python analysis on a sketch
  router.post('/:id/analyze', async (req, res) => {
    try {
      const out = await sketchService.analyzeSketch(req.params.id, req.userId);
      res.json(out);
    } catch (err) {
      console.error('[sketches] analyze error:', err);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  return router;
}
