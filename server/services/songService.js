/**
 * SongService - Business logic for song management.
 *
 * Key changes in this version:
 * - importSong() uses sourceType + sourceId for canonical deduplication.
 * - deleteSong() is now a soft-delete with cascade to audits + techniques.
 * - getDeletePreview() returns affected record counts before destructive actions.
 * - All find queries filter out soft-deleted records.
 */

export class SongService {
  constructor(songRepository, searchService) {
    if (!songRepository) throw new Error('SongService requires a song repository');
    this.songRepository = songRepository;
    this.searchService = searchService;
  }

  // ─── Import ───────────────────────────────────────────────────────────────

  /**
   * Import a song from a supported source (currently: YouTube).
   *
   * @param {Object} songData
   *   sourceType, sourceId, originalUrl, title, artistName, channelTitle,
   *   thumbnailUrl, durationSeconds, publishedAt, userId
   * @param {Object|null} research  Research result from search service
   * @returns {Promise<Object>} Created or found song document
   * @throws {Error} with code 'already_imported' if duplicate detected
   */
  async importSong(songData, research) {
    const {
      sourceType = 'youtube',
      sourceId,
      originalUrl,
      title,
      artistName,
      channelTitle,
      thumbnailUrl,
      durationSeconds,
      publishedAt,
      userId,
      // Backward-compat aliases
      youtubeId,
      youtubeUrl,
      artist,
      thumbnail,
    } = songData;

    const resolvedSourceId = sourceId || youtubeId;
    const resolvedArtist = artistName || artist || 'Unknown Artist';
    const resolvedThumbnail = thumbnailUrl || thumbnail;
    const resolvedUrl = originalUrl || youtubeUrl;

    if (!title || !resolvedSourceId || !userId) {
      throw new Error('Missing required fields: title, sourceId (or youtubeId), userId');
    }

    // Canonical deduplication check
    const existing = await this.songRepository.findOne({
      userId,
      sourceType,
      sourceId: resolvedSourceId,
      deletedAt: null,
    });

    if (existing) {
      const err = new Error('You have already imported this song');
      err.code = 'already_imported';
      err.songId = existing._id;
      throw err;
    }

    const researchStatus = research ? 'success' : 'skipped';

    const song = await this.songRepository.create({
      sourceType,
      sourceId: resolvedSourceId,
      youtubeId: resolvedSourceId,   // alias for backward compat
      originalUrl: resolvedUrl,
      youtubeUrl: resolvedUrl,        // alias for backward compat
      title,
      artistName: resolvedArtist,
      artist: resolvedArtist,         // alias for backward compat
      channelTitle: channelTitle || '',
      thumbnailUrl: resolvedThumbnail,
      thumbnail: resolvedThumbnail,   // alias for backward compat
      durationSeconds,
      publishedAt,
      metadataFetchStatus: 'success',
      researchStatus,
      researchSummary: research || { query: `${title} by ${resolvedArtist}`, summary: '' },
      importErrors: [],
      userId,
      deletedAt: null,
    });

    return song;
  }

  // ─── Read ─────────────────────────────────────────────────────────────────

  async getUserSongs(userId, filters = {}) {
    const query = { userId, deletedAt: null };

    if (filters.artist) {
      query.artistName = filters.artist;
    }

    const songs = await this.songRepository.find(query, { sort: { createdAt: -1 } });

    if (filters.search) {
      const s = filters.search.toLowerCase();
      return songs.filter((song) =>
        (song.title || '').toLowerCase().includes(s) ||
        (song.artistName || song.artist || '').toLowerCase().includes(s) ||
        (song.researchSummary?.summary || '').toLowerCase().includes(s)
      );
    }

    return songs;
  }

  async getSong(songId, userId) {
    const song = await this.songRepository.findById(songId);
    if (!song || song.deletedAt) return null;
    if (song.userId.toString() !== userId.toString()) return null;
    return song;
  }

  // ─── Delete preview ───────────────────────────────────────────────────────

  /**
   * Return counts of records that would be affected by deleting a song.
   */
  async getDeletePreview(songId, userId, auditRepository, techniqueRepository) {
    const song = await this.getSong(songId, userId);
    if (!song) throw new Error('Song not found');

    let auditCount = 0;
    let techniqueCount = 0;

    if (auditRepository) {
      const audits = await auditRepository.find({ songId, deletedAt: null });
      auditCount = audits.length;

      if (techniqueRepository) {
        const auditIds = audits.map((a) => a._id);
        for (const auditId of auditIds) {
          techniqueCount += await techniqueRepository.count({ auditId, deletedAt: null });
        }
      }
    }

    return { auditCount, techniqueCount };
  }

  // ─── Delete (soft) ────────────────────────────────────────────────────────

  /**
   * Soft-delete a song and cascade to its audits + linked technique entries.
   */
  async deleteSong(songId, userId, auditRepository, techniqueRepository) {
    const song = await this.getSong(songId, userId);
    if (!song) return false;

    const now = new Date();

    if (auditRepository) {
      const audits = await auditRepository.find({ songId, deletedAt: null });
      for (const audit of audits) {
        // Cascade to techniques
        if (techniqueRepository) {
          const techniques = await techniqueRepository.find({ auditId: audit._id, deletedAt: null });
          for (const t of techniques) {
            await techniqueRepository.updateById(t._id, { deletedAt: now });
          }
        }
        await auditRepository.updateById(audit._id, { deletedAt: now });
      }
    }

    await this.songRepository.updateById(songId, { deletedAt: now });
    return true;
  }

  // ─── Research update ──────────────────────────────────────────────────────

  async updateResearch(songId, userId, research) {
    const song = await this.getSong(songId, userId);
    if (!song) throw new Error('Song not found');
    return this.songRepository.updateById(songId, {
      researchSummary: research,
      researchStatus: 'success',
      updatedAt: new Date(),
    });
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  async getStats(userId) {
    const songs = await this.songRepository.find({ userId, deletedAt: null });
    const artists = new Set(songs.map((s) => s.artistName || s.artist));
    return { totalSongs: songs.length, artistCount: artists.size, artists: Array.from(artists) };
  }

  // ─── Trash / Archives ─────────────────────────────────────────────────────

  async getDeletedSongs(userId) {
    const songs = await this.songRepository.find({ userId });
    return songs
      .filter((s) => s.deletedAt !== null && s.deletedAt !== undefined)
      .sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
  }

  /**
   * Restore a soft-deleted song and cascade to its audits + techniques.
   */
  async restoreSong(songId, userId, auditRepository, techniqueRepository) {
    const song = await this.songRepository.findOne({ _id: songId, userId });
    if (!song || !song.deletedAt) return false;

    if (auditRepository) {
      const audits = await auditRepository.find({ songId, deletedAt: { $ne: null } });
      for (const audit of audits) {
        if (techniqueRepository) {
          const techniques = await techniqueRepository.find({ auditId: audit._id, deletedAt: { $ne: null } });
          for (const t of techniques) {
            await techniqueRepository.updateById(t._id, { deletedAt: null });
          }
        }
        await auditRepository.updateById(audit._id, { deletedAt: null });
      }
    }

    await this.songRepository.updateById(songId, { deletedAt: null });
    return true;
  }

  /**
   * Permanently delete a song and all its associated audits and techniques from the database.
   */
  async purgeSong(songId, userId, auditRepository, techniqueRepository) {
    const song = await this.songRepository.findOne({ _id: songId, userId });
    if (!song) return false;

    if (auditRepository) {
      const audits = await auditRepository.find({ songId });
      for (const audit of audits) {
        if (techniqueRepository) {
          await techniqueRepository.deleteMany({ auditId: audit._id });
        }
        await auditRepository.deleteById(audit._id);
      }
    }

    await this.songRepository.deleteById(songId);
    return true;
  }
}
