import express from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { body, validationResult } from 'express-validator';

/**
 * Extract a canonical 11-character YouTube video ID from any URL format:
 * - youtube.com/watch?v=ID
 * - youtu.be/ID
 * - youtube.com/embed/ID
 * - youtube.com/shorts/ID
 * Strips trailing noise (?t=, &list=, etc.)
 */
function extractYouTubeId(url) {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /\/embed\/([a-zA-Z0-9_-]{11})/,
    /\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export default function createSongRoutes(
  songService,
  auditRepository,
  techniqueRepository,
  sketchRepository,
  audioStorageService = null,
  audioDownloader = null
) {
  const router = express.Router();

  const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  };

  // ── Import song from YouTube URL ─────────────────────────────────────────
  // Phase: download audio to local storage at import time, then trigger
  // analysis against the local file. YouTube IFrame is no longer used.
  router.post('/import', [
    body('youtubeUrl').isString().notEmpty().trim().withMessage('YouTube URL required'),
  ], handleValidationErrors, async (req, res) => {
    const { youtubeUrl } = req.body;
    const userId = req.userId;

    if (!youtubeUrl) {
      return res.status(400).json({ error: 'YouTube URL required' });
    }

    const sourceId = extractYouTubeId(youtubeUrl);
    if (!sourceId) {
      return res.status(400).json({ error: 'Invalid YouTube URL — could not extract video ID' });
    }

    // Fetch video metadata via YouTube oEmbed (no API key required)
    let title = 'Unknown Song';
    let channelTitle = '';
    let thumbnailUrl = null;
    try {
      const oembedRes = await axios.get(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${sourceId}&format=json`
      );
      title = oembedRes.data.title || title;
      channelTitle = oembedRes.data.author_name || '';
      thumbnailUrl = oembedRes.data.thumbnail_url || null;
    } catch (err) {
      console.warn('Could not fetch YouTube oEmbed metadata:', err.message);
    }

    // Heuristic artist extraction from "Artist - Title" format
    let artistName = channelTitle || 'Unknown Artist';
    if (title.includes(' - ')) {
      const parts = title.split(' - ');
      artistName = parts[0].trim();
      title = parts.slice(1).join(' - ').trim();
    }

    // Research (Tavily + AI summary) — independent of audio download
    const research = await songService.researchSong(title, artistName);

    // 1. Create the Song record first (sourceType=youtube, no audio yet).
    let song;
    try {
      song = await songService.importSong(
        {
          sourceType: 'youtube',
          sourceId,
          originalUrl: youtubeUrl,
          youtubeId: sourceId,
          youtubeUrl,
          title,
          artistName,
          artist: artistName,
          channelTitle,
          thumbnailUrl,
          thumbnail: thumbnailUrl,
          userId,
        },
        research
      );
    } catch (error) {
      if (error.code === 'already_imported') {
        return res.status(409).json({
          error: 'already_imported',
          message: 'You have already imported this song',
          songId: error.songId,
        });
      }
      console.error('Import error:', error);
      return res.status(400).json({ error: error.message });
    }

    const songId = song._id.toString();

    // 2. Download the audio via the Python analysis service and persist it
    //    under server/uploads/songs/. Synchronous: the user gets the Song
    //    back only after local audio lands. On any download failure we
    //    delete the half-imported song and return 502 so the client never
    //    sees a record with publicUrl=null (which used to drive a 10x
    //    polling loop that tripped the global rate limiter).
    if (audioDownloader && audioStorageService) {
      let tempDir;
      try {
        const downloaded = await audioDownloader.downloadToTemp({ songId, youtubeUrl });
        tempDir = downloaded.tempDir;
        await songService.attachLocalAudio(songId, downloaded.sourcePath, {
          extension: path.extname(downloaded.sourcePath).replace(/^\./, ''),
        });
        // Best-effort: kick off analysis against the now-local file. The
        // song is already importable, so a failure here is non-fatal.
        try {
          const updated = await songService.getSong(songId, null);
          if (updated && updated.audioAnalysisStatus === 'not_started') {
            await songService.triggerAnalysis(songId, null);
          }
        } catch (err) {
          console.warn(`[songs] post-download analysis trigger failed for ${songId}: ${err.message}`);
        }
      } catch (err) {
        console.error(`[songs] Audio download failed for ${songId}: ${err.message}`);
        // Roll back the import so the client doesn't see a stuck record.
        try {
          await songService.purgeSong(songId, userId, auditRepository, techniqueRepository);
        } catch (purgeErr) {
          console.error(`[songs] Failed to roll back song ${songId} after download error: ${purgeErr.message}`);
        }
        return res.status(502).json({
          error: 'audio_download_failed',
          message: `Could not download audio from YouTube: ${err.message}`,
        });
      } finally {
        if (tempDir) {
          try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) { /* swallow */ }
        }
      }
    } else {
      console.warn(`[songs] No audioDownloader/audioStorageService — song ${songId} will not have local audio.`);
    }

    // Re-read so the response reflects the local audio fields.
    const hydrated = await songService.getSong(songId, userId);
    res.status(201).json({ song: _sanitizeSong(hydrated || song) });
  });

  // ── Get delete preview ───────────────────────────────────────────────────
  router.get('/:id/delete-preview', async (req, res) => {
    try {
      const preview = await songService.getDeletePreview(
        req.params.id,
        req.userId,
        auditRepository,
        techniqueRepository,
        sketchRepository
      );
      res.json(preview);
    } catch (error) {
      if (error.message === 'Song not found') return res.status(404).json({ error: error.message });
      console.error('Delete preview error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── Get all songs for user ────────────────────────────────────────────────
  router.get('/', async (req, res) => {
    try {
      const songs = await songService.getUserSongs(req.userId, req.query);
      res.json(songs);
    } catch (error) {
      console.error('Get songs error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── Get all soft-deleted songs for user ───────────────────────────────────
  router.get('/trash', async (req, res) => {
    try {
      const songs = await songService.getDeletedSongs(req.userId);
      res.json(songs.map((s) => _sanitizeSong(s)));
    } catch (error) {
      console.error('Get deleted songs error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── Purge all soft-deleted songs (cascade) ────────────────────────────────
  router.delete('/trash/purge-all', async (req, res) => {
    try {
      const deletedSongs = await songService.getDeletedSongs(req.userId);
      for (const song of deletedSongs) {
        await songService.purgeSong(song._id, req.userId, auditRepository, techniqueRepository);
      }
      res.json({ success: true, count: deletedSongs.length });
    } catch (error) {
      console.error('Purge all songs error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── Get song by ID ────────────────────────────────────────────────────────
  router.get('/:id', async (req, res) => {
    try {
      const song = await songService.getSong(req.params.id, req.userId);
      if (!song) return res.status(404).json({ error: 'Song not found' });
      res.json(_sanitizeSong(song));
    } catch (error) {
      console.error('Get song error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── Soft-delete song (cascade) ────────────────────────────────────────────
  router.delete('/:id', async (req, res) => {
    try {
      const result = await songService.deleteSong(
        req.params.id,
        req.userId,
        auditRepository,
        techniqueRepository,
        sketchRepository
      );
      if (!result) return res.status(404).json({ error: 'Song not found' });
      res.json({ message: 'Song deleted' });
    } catch (error) {
      console.error('Delete song error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── Restore song (cascade) ────────────────────────────────────────────────
  router.post('/:id/restore', async (req, res) => {
    try {
      const result = await songService.restoreSong(
        req.params.id,
        req.userId,
        auditRepository,
        techniqueRepository
      );
      if (!result) return res.status(404).json({ error: 'Song not found or not in trash' });
      res.json({ message: 'Song restored successfully' });
    } catch (error) {
      console.error('Restore song error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── Purge song (cascade permanent delete) ────────────────────────────────
  router.delete('/:id/purge', async (req, res) => {
    try {
      const result = await songService.purgeSong(
        req.params.id,
        req.userId,
        auditRepository,
        techniqueRepository
      );
      if (!result) return res.status(404).json({ error: 'Song not found' });
      res.json({ message: 'Song permanently deleted' });
    } catch (error) {
      console.error('Purge song error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── Trigger audio analysis ────────────────────────────────────────────────
  router.post('/:id/analyze', async (req, res) => {
    try {
      await songService.triggerAnalysis(req.params.id, req.userId);
      res.json({ message: 'Analysis triggered successfully' });
    } catch (error) {
      console.error('Trigger analysis error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── Trigger Tavily cross-verification ──────────────────────────────────────
  router.post('/:id/verify-analysis', async (req, res) => {
    try {
      const song = await songService.crossVerifyAnalysis(req.params.id, req.userId);
      res.json({ song: _sanitizeSong(song) });
    } catch (error) {
      console.error('Cross-verify analysis error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── Save audio overrides ──────────────────────────────────────────────────
  router.put('/:id/audio-overrides', async (req, res) => {
    try {
      const song = await songService.saveAudioOverrides(req.params.id, req.userId, req.body);
      res.json({ song: _sanitizeSong(song) });
    } catch (error) {
      console.error('Save audio overrides error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── Re-download audio for a stuck song ────────────────────────────────────
  // Used to recover legacy songs that were imported before /import became
  // synchronous and were left with publicUrl=null. Synchronous like /import:
  // on success the song ends up with sourceType='local' and publicUrl set;
  // on failure the song is unchanged so the user can retry.
  router.post('/:id/download-audio', async (req, res) => {
    if (!audioDownloader || !audioStorageService) {
      return res.status(503).json({
        error: 'audio_download_unavailable',
        message: 'Server is not configured to download audio (audioDownloader/audioStorageService missing).',
      });
    }
    const songId = req.params.id;
    let song;
    try {
      song = await songService.getSong(songId, req.userId);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!song) return res.status(404).json({ error: 'Song not found' });
    if (song.publicUrl) {
      return res.status(409).json({
        error: 'already_has_local_audio',
        message: 'Song already has local audio; nothing to download.',
        song: _sanitizeSong(song),
      });
    }
    const youtubeUrl = song.originalUrl || song.youtubeUrl;
    if (!youtubeUrl) {
      return res.status(400).json({
        error: 'no_youtube_url',
        message: 'Song has no originalUrl/youtubeUrl; cannot redownload.',
      });
    }

    let tempDir;
    try {
      const downloaded = await audioDownloader.downloadToTemp({ songId, youtubeUrl });
      tempDir = downloaded.tempDir;
      const updated = await songService.attachLocalAudio(songId, downloaded.sourcePath, {
        extension: path.extname(downloaded.sourcePath).replace(/^\./, ''),
      });
      return res.json({ song: _sanitizeSong(updated) });
    } catch (err) {
      console.error(`[songs] re-download failed for ${songId}: ${err.message}`);
      return res.status(502).json({
        error: 'audio_download_failed',
        message: `Could not download audio: ${err.message}`,
      });
    } finally {
      if (tempDir) {
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) { /* swallow */ }
      }
    }
  });

  return router;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// Return a clean, consistent song shape to the client
function _sanitizeSong(song) {
  return {
    _id: song._id,
    title: song.title,
    artistName: song.artistName || song.artist,
    artist: song.artistName || song.artist,    // backward compat
    channelTitle: song.channelTitle,
    youtubeId: song.sourceId || song.youtubeId,
    sourceId: song.sourceId || song.youtubeId,
    sourceType: song.sourceType,
    originalUrl: song.originalUrl || song.youtubeUrl,
    youtubeUrl: song.originalUrl || song.youtubeUrl,  // backward compat
    thumbnailUrl: song.thumbnailUrl || song.thumbnail,
    thumbnail: song.thumbnailUrl || song.thumbnail,    // backward compat
    publicUrl: song.publicUrl || null,
    audioSizeBytes: song.audioSizeBytes || null,
    audioMimeType: song.audioMimeType || null,
    audioDownloadedAt: song.audioDownloadedAt || null,
    durationSeconds: song.durationSeconds,
    publishedAt: song.publishedAt,
    researchSummary: song.researchSummary,
    researchStatus: song.researchStatus,
    metadataFetchStatus: song.metadataFetchStatus,
    audioAnalysisStatus: song.audioAnalysisStatus || 'not_started',
    audioAnalysis: song.audioAnalysis,
    audioOverrides: song.audioOverrides,
    deletedAt: song.deletedAt,
    createdAt: song.createdAt,
    updatedAt: song.updatedAt,
  };
}
