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
  constructor(songRepository, searchService, aiService) {
    if (!songRepository) throw new Error('SongService requires a song repository');
    this.songRepository = songRepository;
    this.searchService = searchService;
    this.aiService = aiService;
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

    let finalResearch = research;
    if (research && research.results?.length > 0 && this.aiService) {
      try {
        console.log(`[SongService] Generating AI production summary for: "${title}"`);
        const rawSearchData = research.results.map(s => `[Source: ${s.title}]: ${s.content}`).join('\n\n');
        
        const aiPrompt = `You are a music production expert and research assistant.
We have conducted web searches about the song "${title}" by ${resolvedArtist}.

Here is the raw search data:
${rawSearchData}

Based on this search data, generate a production summary structured by musical lenses. If the search data is thin or lacks specific details for a lens, use your general knowledge of the song/artist/genre to provide helpful context.

You MUST respond with a JSON object in this exact format (do not include markdown headers or backticks, just the raw JSON object):
{
  "overview": "A 2-3 sentence overview of the song's production history and release context.",
  "rhythm": "Details about the drums, groove, bass, and pocket (devices, techniques, feel).",
  "texture": "Details about the textures, synths, instruments, spatial effects (reverbs, delays), and vocal processing.",
  "harmony": "Details about key, chord progressions, harmonic changes, or key signature.",
  "arrangement": "Details about the song structure, sections, key transitions, and dynamic build-ups."
}`;

        const aiResponse = await this.aiService.completeJson(aiPrompt);
        const aiSummary = aiResponse;
        
        if (aiSummary && aiSummary.overview) {
          const compiledSummary = `### 💿 Production Overview\n${aiSummary.overview}\n\n` +
            `### 🥁 Rhythm Lens\n${aiSummary.rhythm}\n\n` +
            `### 🎛️ Texture Lens\n${aiSummary.texture}\n\n` +
            `### 🎹 Harmony Lens\n${aiSummary.harmony}\n\n` +
            `### 🎼 Arrangement Lens\n${aiSummary.arrangement}`;
            
          finalResearch = {
            ...research,
            summary: compiledSummary,
            lensSummary: aiSummary
          };
        }
      } catch (aiErr) {
        console.warn('[SongService] AI production summary generation failed:', aiErr.message);
      }
    }

    const researchStatus = finalResearch ? 'success' : 'skipped';

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
      researchSummary: finalResearch || { query: `${title} by ${resolvedArtist}`, summary: '' },
      importErrors: [],
      userId,
      deletedAt: null,
    });

    // Trigger analysis asynchronously in the background
    if (process.env.NODE_ENV !== 'test') {
      this.triggerAnalysis(song._id, userId).catch(err => {
        console.error('[SongService] Background audio analysis trigger failed:', err.message);
      });
    }

    return song;
  }

  // ─── Read ─────────────────────────────────────────────────────────────────

  /**
   * Look up research context for a song via the injected search service.
   * Public façade so route handlers don't reach into .searchService directly.
   * Returns null on missing adapter or any error.
   *
   * @param {string} title
   * @param {string} artist
   * @returns {Promise<Object|null>}
   */
  async researchSong(title, artist) {
    if (!this.searchService || typeof this.searchService.searchSongInfo !== 'function') {
      return null;
    }
    try {
      return await this.searchService.searchSongInfo(title, artist);
    } catch (err) {
      console.warn(`[SongService] researchSong failed for "${title}" by ${artist}: ${err.message}`);
      return null;
    }
  }

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
  async getDeletePreview(songId, userId, auditRepository, techniqueRepository, sketchRepository) {
    const song = await this.getSong(songId, userId);
    if (!song) throw new Error('Song not found');

    let auditCount = 0;
    let techniqueCount = 0;
    let sketchCount = 0;

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

    if (sketchRepository) {
      sketchCount = await sketchRepository.count({ songId, deletedAt: null });
    }

    return { auditCount, techniqueCount, sketchCount };
  }

  // ─── Delete (soft) ────────────────────────────────────────────────────────

  /**
   * Soft-delete a song and cascade to its audits + linked technique entries.
   */
  async deleteSong(songId, userId, auditRepository, techniqueRepository, sketchRepository) {
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

    // Cascade to sketches (A/B compare uploads). Sketches are not auto-restored
    // along with the song because their backing files may have been cleaned up.
    if (sketchRepository) {
      const sketches = await sketchRepository.find({ songId, deletedAt: null });
      for (const s of sketches) {
        await sketchRepository.updateById(s._id, { deletedAt: now });
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
    const songs = await this.songRepository.find({ userId, deletedAt: { $ne: null } });
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

  async triggerAnalysis(songId, userId) {
    const song = await this.getSong(songId, userId);
    if (!song) throw new Error('Song not found');

    // Update status to pending
    await this.songRepository.updateById(songId, { audioAnalysisStatus: 'pending' });

    // Call Python FastAPI service asynchronously
    const analysisServiceUrl = process.env.ANALYSIS_SERVICE_URL || 'http://localhost:8080';
    const callbackUrl = `${process.env.BACKEND_CALLBACK_URL || 'http://localhost:5050'}/api/public/songs/${songId}/analysis-completed`;

    const payload = {
      song_id: songId.toString(),
      youtube_url: song.originalUrl || song.youtubeUrl,
      yt_id: song.sourceId || song.youtubeId,
      callback_url: callbackUrl
    };

    try {
      console.log(`[SongService] Triggering audio analysis for song ${songId} at ${analysisServiceUrl}/analyze`);
      const axios = (await import('axios')).default;
      await axios.post(`${analysisServiceUrl}/analyze`, payload, { timeout: 5000 });
      console.log(`[SongService] Audio analysis triggered successfully for song ${songId}`);
    } catch (error) {
      console.error(`[SongService] Failed to trigger audio analysis: ${error.message}`);
      // Fallback: If python service is offline/errored, update database to 'failed'
      await this.songRepository.updateById(songId, { audioAnalysisStatus: 'failed' });
    }
  }

  async crossVerifyAnalysis(songId, userId = null) {
    let song;
    if (userId) {
      song = await this.getSong(songId, userId);
    } else {
      song = await this.songRepository.findById(songId);
    }
    if (!song || song.deletedAt) throw new Error('Song not found');
    if (!song.audioAnalysis || song.audioAnalysisStatus !== 'success') {
      throw new Error('Song has not been successfully analyzed yet');
    }

    const { title, artistName } = song;
    const analysis = { ...song.audioAnalysis };

    // Set defaults for cross-verification flags
    analysis.tempo_cross_verified = false;
    analysis.key_cross_verified = false;
    analysis.meter_cross_verified = false;

    // Check if we need to search or if we can cross-verify
    // Query Tavily search specifically for musical metadata
    if (this.searchService && typeof this.searchService.search === 'function') {
      const query = `"${title}" by "${artistName || 'Unknown Artist'}" BPM key signature meter tempo time signature`;
      try {
        console.log(`[SongService] Running cross-verification web search: "${query}"`);
        const searchResult = await this.searchService.search(query, 5);
        const results = searchResult.results || [];

        if (results.length > 0 && this.aiService) {
          const rawSearchData = results.map(r => `[Source: ${r.title}]: ${r.content}`).join('\n\n');
          const prompt = `You are a music metadata extraction assistant.
Based on the following web search results for the song "${title}" by "${artistName || 'Unknown Artist'}", extract:
1. The tempo in beats per minute (BPM) as a number.
2. The musical key signature root note (e.g. C, C#, D, Eb, E, F, F#, G, Ab, A, Bb, B).
3. The scale mode ("major" or "minor").
4. The meter / time signature (e.g. "4/4", "3/4", "6/8", "5/4", "7/8").

Search results:
${rawSearchData}

Respond with a JSON object in this exact format (do not include markdown block syntax, just the raw JSON object):
{
  "tempo_bpm": 120,
  "key": "G",
  "scale": "minor",
  "estimated_meter": "4/4"
}`;

          const verifiedMetadata = await this.aiService.completeJson(prompt);
          console.log('[SongService] Extracted web metadata:', verifiedMetadata);

          // 1. Cross-verify tempo
          if (verifiedMetadata.tempo_bpm) {
            const extTempo = parseFloat(verifiedMetadata.tempo_bpm);
            const curTempo = parseFloat(analysis.tempo_bpm);
            if (!isNaN(extTempo) && !isNaN(curTempo)) {
              const diffRatio = Math.abs(curTempo - extTempo) / extTempo;
              const isDoubleOrHalf = Math.abs(curTempo * 2 - extTempo) / extTempo < 0.05 || Math.abs(curTempo / 2 - extTempo) / extTempo < 0.05;
              if (diffRatio < 0.05 || isDoubleOrHalf) {
                analysis.tempo_confidence = Math.max(analysis.tempo_confidence || 0, 0.95);
                analysis.tempo_cross_verified = true;
              } else if (analysis.tempo_confidence < 0.95) {
                analysis.tempo_bpm = extTempo;
                analysis.tempo_confidence = 0.95;
                analysis.tempo_cross_verified = true;
              }
            }
          }

          // 2. Cross-verify key
          if (verifiedMetadata.key) {
            const extKey = verifiedMetadata.key.trim().toUpperCase();
            const curKey = (analysis.key || '').trim().toUpperCase();
            const extScale = (verifiedMetadata.scale || '').toLowerCase();
            const curScale = (analysis.scale || '').toLowerCase();

            if (extKey === curKey && extScale === curScale) {
              analysis.key_confidence = Math.max(analysis.key_confidence || 0, 0.95);
              analysis.key_cross_verified = true;
            } else if (analysis.key_confidence < 0.95) {
              analysis.key = verifiedMetadata.key;
              if (verifiedMetadata.scale) {
                analysis.scale = verifiedMetadata.scale;
              }
              analysis.key_confidence = 0.95;
              analysis.key_cross_verified = true;
            }
          }

          // 3. Cross-verify meter
          if (verifiedMetadata.estimated_meter) {
            const extMeter = verifiedMetadata.estimated_meter.trim();
            const curMeter = (analysis.estimated_meter || '').trim();

            if (extMeter === curMeter) {
              analysis.meter_confidence = Math.max(analysis.meter_confidence || 0, 0.95);
              analysis.meter_cross_verified = true;
            } else if (analysis.meter_confidence < 0.95) {
              analysis.estimated_meter = extMeter;
              analysis.meter_confidence = 0.95;
              analysis.meter_cross_verified = true;
            }
          }
        }
      } catch (err) {
        console.warn(`[SongService] Cross-verification search/extraction failed: ${err.message}`);
      }
    }

    // Fallback: If GPU confidence is already >= 0.95, mark it verified even without Tavily
    if ((analysis.tempo_confidence || 0) >= 0.95) {
      analysis.tempo_cross_verified = true;
    }
    if ((analysis.key_confidence || 0) >= 0.95) {
      analysis.key_cross_verified = true;
    }
    if ((analysis.meter_confidence || 0) >= 0.95) {
      analysis.meter_cross_verified = true;
    }

    await this.songRepository.updateById(songId, { audioAnalysis: analysis });
    return userId ? this.getSong(songId, userId) : this.songRepository.findById(songId);
  }

  async saveAudioOverrides(songId, userId, overrides) {
    const song = await this.getSong(songId, userId);
    if (!song) throw new Error('Song not found');

    await this.songRepository.updateById(songId, { audioOverrides: overrides });
    return this.getSong(songId, userId);
  }
}
