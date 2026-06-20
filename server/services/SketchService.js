// SketchService — orchestrates DAW sketch upload, listing, and analysis.
// Mirrors SongService.triggerAnalysis for the Python analysis_service callback flow.

import fs from 'fs';
import path from 'path';
import axios from 'axios';

const ANALYSIS_TIMEOUT_MS = 15_000;
const DEFAULT_LIMITS = { maxFileBytes: 100 * 1024 * 1024, allowedExtensions: ['.mp3', '.wav', '.m4a', '.aac', '.flac'] };

export class SketchService {
  constructor(sketchRepository, songRepository, { analysisServiceUrl, logger = console } = {}) {
    if (!sketchRepository) throw new Error('SketchService requires a sketchRepository');
    this.sketchRepository = sketchRepository;
    this.songRepository = songRepository || null;
    this.analysisServiceUrl = analysisServiceUrl || process.env.ANALYSIS_SERVICE_URL || 'http://localhost:8080';
    this.logger = logger;
  }

  async assertSongOwned(songId, userId) {
    if (!this.songRepository) return;
    const song = await this.songRepository.findById(songId);
    if (!song) {
      const err = new Error('Song not found');
      err.status = 404;
      throw err;
    }
    if (song.userId && song.userId.toString() !== userId.toString()) {
      const err = new Error('Song not found');
      err.status = 404;
      throw err;
    }
  }

  async createSketch({ userId, songId, file, title = '', notes = '' }) {
    if (!userId) throw new Error('userId is required');
    if (!songId) throw new Error('songId is required');
    if (!file) throw new Error('file is required');
    await this.assertSongOwned(songId, userId);

    const originalName = file.originalname || 'sketch';
    const ext = path.extname(originalName).toLowerCase() || '.bin';
    if (!DEFAULT_LIMITS.allowedExtensions.includes(ext)) {
      const err = new Error(`Unsupported file type: ${ext}. Allowed: ${DEFAULT_LIMITS.allowedExtensions.join(', ')}`);
      err.status = 400;
      throw err;
    }
    if (file.size > DEFAULT_LIMITS.maxFileBytes) {
      const err = new Error(`File too large. Max ${Math.round(DEFAULT_LIMITS.maxFileBytes / (1024 * 1024))}MB.`);
      err.status = 413;
      throw err;
    }

    const sketch = await this.sketchRepository.create({
      userId,
      songId,
      title: title || originalName.replace(/\.[^.]+$/, ''),
      fileName: file.filename,
      originalName,
      filePath: file.path,
      publicUrl: `/uploads/${file.filename}`,
      mimeType: file.mimetype || '',
      sizeBytes: file.size,
      analysis: null,
      analysisStatus: 'not_started',
      notes,
    });
    return sketch;
  }

  async getSketchesForSong(songId, userId) {
    if (!songId) return [];
    const sketches = await this.sketchRepository.find(
      { songId, userId, deletedAt: null },
      { sort: { createdAt: -1 } }
    );
    return sketches;
  }

  async updateSketch(id, userId, updates) {
    if (!id) throw new Error('Sketch id is required');
    if (!updates || typeof updates !== 'object') {
      const err = new Error('Updates payload is required');
      err.status = 400;
      throw err;
    }
    // Whitelist: only allow metadata that the client is permitted to fill in
    // after a successful upload (e.g. duration probed from <audio> loadedmetadata).
    const allowed = ['title', 'notes', 'durationSeconds'];
    const safe = {};
    for (const key of allowed) {
      if (updates[key] !== undefined) safe[key] = updates[key];
    }
    if (safe.durationSeconds !== undefined) {
      const n = Number(safe.durationSeconds);
      if (!Number.isFinite(n) || n < 0 || n > 60 * 60 * 6) {
        const err = new Error('durationSeconds must be a finite number between 0 and 21600');
        err.status = 400;
        throw err;
      }
      safe.durationSeconds = n;
    }
    if (Object.keys(safe).length === 0) {
      const err = new Error('No allowed fields to update');
      err.status = 400;
      throw err;
    }
    // Re-fetch via getSketch to enforce ownership and 404 on missing/deleted.
    await this.getSketch(id, userId);
    return this.sketchRepository.updateById(id, safe);
  }

  async getSketch(id, userId) {
    const sketch = await this.sketchRepository.findById(id);
    if (!sketch || sketch.deletedAt) {
      const err = new Error('Sketch not found');
      err.status = 404;
      throw err;
    }
    if (sketch.userId.toString() !== userId.toString()) {
      const err = new Error('Sketch not found');
      err.status = 404;
      throw err;
    }
    return sketch;
  }

  async deleteSketch(id, userId) {
    const sketch = await this.getSketch(id, userId);
    const updated = await this.sketchRepository.updateById(id, { deletedAt: new Date() });
    // Best-effort file cleanup; do not fail the request if unlink fails.
    if (sketch.filePath) {
      try {
        if (fs.existsSync(sketch.filePath)) fs.unlinkSync(sketch.filePath);
      } catch (e) {
        this.logger.warn?.(`SketchService: failed to remove ${sketch.filePath}: ${e.message}`);
      }
    }
    return updated;
  }

  async analyzeSketch(id, userId) {
    const sketch = await this.getSketch(id, userId);
    if (!sketch.filePath || !fs.existsSync(sketch.filePath)) {
      const err = new Error('Sketch file missing on disk');
      err.status = 410;
      throw err;
    }
    await this.sketchRepository.updateById(id, {
      analysisStatus: 'pending',
      analysisError: null,
    });
    try {
      const payload = {
        sketch_id: sketch._id.toString(),
        file_path: sketch.filePath,
        callback_url: null,
      };
      const res = await axios.post(`${this.analysisServiceUrl}/analyze-sketch`, payload, {
        timeout: ANALYSIS_TIMEOUT_MS,
      });
      const analysis = res.data?.analysis || null;
      if (!analysis) {
        await this.sketchRepository.updateById(id, {
          analysisStatus: 'failed',
          analysisError: 'Empty response from analysis service',
        });
        const err = new Error('Analysis returned no result');
        err.status = 502;
        throw err;
      }
      await this.sketchRepository.updateById(id, {
        analysis,
        analysisStatus: 'success',
        analysisError: null,
      });
      const updated = await this.sketchRepository.findById(id);
      return { queued: false, analysis, sketch: updated };
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || 'Analysis request failed';
      await this.sketchRepository.updateById(id, {
        analysisStatus: 'failed',
        analysisError: String(msg).slice(0, 500),
      });
      const err = new Error(`Sketch analysis failed: ${msg}`);
      err.status = e.response?.status || 502;
      throw err;
    }
  }
}

export const __test__ = { DEFAULT_LIMITS, ANALYSIS_TIMEOUT_MS };
