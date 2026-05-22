import express from 'express';
import axios from 'axios';

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

export default function createSongRoutes(songService, auditRepository, techniqueRepository) {
  const router = express.Router();

  // ── Import song from YouTube URL ─────────────────────────────────────────
  router.post('/import', async (req, res) => {
    try {
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

      // Fetch research via search service
      let research = null;
      if (songService.searchService) {
        try {
          research = await songService.searchService.searchSongInfo(title, artistName);
        } catch (err) {
          console.warn('Research fetch failed:', err.message);
        }
      }

      const song = await songService.importSong(
        {
          sourceType: 'youtube',
          sourceId,
          originalUrl: youtubeUrl,
          youtubeId: sourceId,         // backward compat
          youtubeUrl,                  // backward compat
          title,
          artistName,
          artist: artistName,          // backward compat
          channelTitle,
          thumbnailUrl,
          thumbnail: thumbnailUrl,     // backward compat
          userId,
        },
        research
      );

      res.status(201).json({ song: _sanitizeSong(song) });
    } catch (error) {
      if (error.code === 'already_imported') {
        return res.status(409).json({
          error: 'already_imported',
          message: 'You have already imported this song',
          songId: error.songId,
        });
      }
      console.error('Import error:', error);
      res.status(400).json({ error: error.message });
    }
  });

  // ── Get delete preview ───────────────────────────────────────────────────
  router.get('/:id/delete-preview', async (req, res) => {
    try {
      const preview = await songService.getDeletePreview(
        req.params.id,
        req.userId,
        auditRepository,
        techniqueRepository
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
        techniqueRepository
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

  return router;
}

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
    durationSeconds: song.durationSeconds,
    publishedAt: song.publishedAt,
    researchSummary: song.researchSummary,
    researchStatus: song.researchStatus,
    metadataFetchStatus: song.metadataFetchStatus,
    deletedAt: song.deletedAt,
    createdAt: song.createdAt,
    updatedAt: song.updatedAt,
  };
}
