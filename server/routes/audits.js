import express from 'express';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import TasteProfile from '../models/TasteProfile.js';

/**
 * Audit routes — single-step creation (Issue 4 clean cutover).
 *
 * POST /api/audits
 *   Generates + stores the template inline, returns the full audit object.
 *   The old /generate-template endpoint has been removed.
 *
 * New endpoints:
 *   GET  /api/audits/:id/delete-preview  → { techniqueCount }
 *   PATCH /api/audits/:id/bookmarks/:bookmarkId  → update a single bookmark
 *   POST /api/audits/:id/steps/advance   → advance guided step
 *   POST /api/audits/:id/steps/back      → go back one guided step
 *   POST /api/audits/:id/steps/skip      → skip current guided step
 */

export default function createAuditRoutes(auditService, templateComposer, techniqueRepository) {
  const router = express.Router();

  const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  };

  // ── Create audit (single-step: generate template + save) ──────────────────
  router.post('/', [
    body('songId').isString().notEmpty().trim().withMessage('songId is required'),
  ], handleValidationErrors, async (req, res) => {
    try {
      const { songId, lenses, lensSelection, workflowType = 'quick' } = req.body;
      const userId = req.userId;

      const resolvedLenses = lenses || lensSelection;

      if (!songId || !resolvedLenses || !Array.isArray(resolvedLenses) || resolvedLenses.length === 0) {
        return res.status(400).json({ error: 'songId and lenses (array) are required' });
      }

      // Fetch user's tastes/influences for personalized exercises
      let tastes = null;
      let enrichedTastes = null;
      try {
        const user = await User.findById(userId);
        if (user && user.preferences && user.preferences.tastes) {
          tastes = user.preferences.tastes;

          // Fetch any synthesized TasteProfiles to enrich the prompt context
          let tasteProfiles = [];
          try {
            tasteProfiles = await TasteProfile.find({ userId });
          } catch (profileErr) {
            console.warn('[Audit Create] Failed to fetch TasteProfiles:', profileErr.message);
          }

          enrichedTastes = {};
          for (const lens of ['rhythm', 'texture', 'harmony', 'arrangement']) {
            const rawArtists = tastes[lens] || '';
            const artistNames = rawArtists.split(',').map(name => name.trim()).filter(Boolean);
            const summaries = [];
            for (const name of artistNames) {
              const matchedProfile = tasteProfiles.find(
                p => p.lens === lens && p.name.toLowerCase() === name.toLowerCase()
              );
              if (matchedProfile && matchedProfile.summary) {
                summaries.push(`[Style: ${matchedProfile.name}]: ${matchedProfile.summary}`);
              } else {
                summaries.push(`[Style: ${name}]: (Awaiting deep‑dive research; use general stylistic traits)`);
              }
            }
            enrichedTastes[lens] = {
              raw: rawArtists,
              rich: summaries.join('\n\n')
            };
          }
        }
      } catch (err) {
        console.warn('[Audit Create] Failed to fetch user tastes, proceeding with defaults:', err.message);
      }

      // Generate template (with fallback if AI fails)
      let templateQuestions = null;
      let templateVersion = 'fallback-v1';
      let modelUsed = null;
      const promptVersion = 'v1';

      if (templateComposer) {
        // Fetch song for context via the service — no repository leakage in routes
        const song = await auditService.getSongContext(songId, userId);

        // Issue 4: build richer context from full source content, not just the pre-computed snippet
        const researchData = song?.researchSummary;
        const researchSources = researchData?.results || [];
        // Combine content from up to 3 sources (up to 1500 chars) for the AI prompt
        const richContext = researchSources.length > 0
          ? researchSources
              .slice(0, 3)
              .map((s) => `[${s.title || 'Source'}]: ${s.content || ''}`)
              .join('\n\n')
              .substring(0, 1500)
          : (researchData?.summary || '');
        console.log(`[Audit Create] Song: "${song?.title}" | Research sources: ${researchSources.length} | Context chars: ${richContext.length}`);

        try {
          console.log('[Audit Create] Calling AI to generate template with user tastes...');
          templateQuestions = await templateComposer.generateTemplate(
            song?.title || 'Unknown',
            song?.artistName || song?.artist || 'Unknown',
            resolvedLenses,
            richContext,
            enrichedTastes || tastes
          );
          templateVersion = 'ai-v1';
          modelUsed = process.env.OPENAI_MODEL || 'gpt-4-turbo';
          console.log(`[Audit Create] ✓ AI template generated successfully using model: ${modelUsed}`);
        } catch (err) {
          console.warn(`[Audit Create] ✗ AI template generation failed (${err.message}), using FALLBACK generic template`);
          templateQuestions = templateComposer.fallbackTemplate(
            song?.title || 'Unknown',
            song?.artistName || song?.artist || 'Unknown',
            resolvedLenses,
            enrichedTastes || tastes
          );
        }
      }

      const audit = await auditService.createAudit({
        songId,
        userId,
        lensSelection: resolvedLenses,
        workflowType,
        templateQuestions,
        templateVersion,
        modelUsed,
        promptVersion,
        responses: {},
      });

      res.status(201).json({ audit });
    } catch (error) {
      console.error('Create audit error:', error);
      res.status(error.message === 'Song not found' ? 404 : 500).json({ error: error.message });
    }
  });

  // ── Get delete preview ────────────────────────────────────────────────────
  router.get('/:id/delete-preview', async (req, res) => {
    try {
      const preview = await auditService.getDeletePreview(req.params.id, req.userId);
      res.json(preview);
    } catch (error) {
      if (error.message === 'Audit not found') return res.status(404).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  // ── Get all user audits ───────────────────────────────────────────────────
  router.get('/', async (req, res) => {
    try {
      const audits = await auditService.getUserAudits(req.userId);
      res.json(audits);
    } catch (error) {
      console.error('Get user audits error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── Get audits for a song ─────────────────────────────────────────────────
  // NOTE: this must be registered before /:id to avoid route collision
  router.get('/song/:songId', async (req, res) => {
    try {
      const audits = await auditService.getAuditsForSong(req.params.songId, req.userId);
      res.json(audits);
    } catch (error) {
      console.error('Get audits for song error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── Get all soft-deleted audits for user ───────────────────────────────────
  router.get('/trash', async (req, res) => {
    try {
      const audits = await auditService.getDeletedAudits(req.userId);
      res.json(audits);
    } catch (error) {
      console.error('Get deleted audits error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── Purge all soft-deleted audits ─────────────────────────────────────────
  router.delete('/trash/purge-all', async (req, res) => {
    try {
      const deletedAudits = await auditService.getDeletedAudits(req.userId);
      for (const audit of deletedAudits) {
        await auditService.purgeAudit(audit._id, req.userId, techniqueRepository);
      }
      res.json({ success: true, count: deletedAudits.length });
    } catch (error) {
      console.error('Purge all audits error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── Get audit by ID ───────────────────────────────────────────────────────
  router.get('/:id', async (req, res) => {
    try {
      const audit = await auditService.getAudit(req.params.id, req.userId);
      if (!audit) return res.status(404).json({ error: 'Audit not found' });
      res.json(audit);
    } catch (error) {
      console.error('Get audit error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── Update audit (responses, status, bookmarks, title, etc.) ─────────────
  router.patch('/:id', async (req, res) => {
    try {
      const audit = await auditService.updateAudit(req.params.id, req.userId, req.body);
      res.json(audit);
    } catch (error) {
      if (error.message === 'Audit not found') return res.status(404).json({ error: error.message });
      console.error('Update audit error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── Add bookmark ──────────────────────────────────────────────────────────
  router.post('/:id/bookmarks', async (req, res) => {
    try {
      const audit = await auditService.addBookmark(req.params.id, req.userId, req.body);
      res.json(audit);
    } catch (error) {
      if (error.message === 'Audit not found') return res.status(404).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  // ── Update a single bookmark ──────────────────────────────────────────────
  router.patch('/:id/bookmarks/:bookmarkId', async (req, res) => {
    try {
      const audit = await auditService.updateBookmark(
        req.params.id,
        req.userId,
        req.params.bookmarkId,
        req.body
      );
      res.json(audit);
    } catch (error) {
      if (error.message === 'Audit not found') return res.status(404).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  // ── Delete a single bookmark ──────────────────────────────────────────────
  router.delete('/:id/bookmarks/:bookmarkId', async (req, res) => {
    try {
      const audit = await auditService.deleteBookmark(
        req.params.id,
        req.userId,
        req.params.bookmarkId
      );
      res.json(audit);
    } catch (error) {
      if (error.message === 'Audit not found' || error.message === 'Bookmark not found') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // ── Guided step management ────────────────────────────────────────────────
  router.post('/:id/steps/advance', async (req, res) => {
    try {
      const audit = await auditService.advanceStep(req.params.id, req.userId);
      res.json(audit);
    } catch (error) {
      res.status(error.message.includes('not found') ? 404 : 400).json({ error: error.message });
    }
  });

  router.post('/:id/steps/back', async (req, res) => {
    try {
      const audit = await auditService.goBackStep(req.params.id, req.userId);
      res.json(audit);
    } catch (error) {
      res.status(error.message.includes('not found') ? 404 : 400).json({ error: error.message });
    }
  });

  router.post('/:id/steps/skip', async (req, res) => {
    try {
      const audit = await auditService.skipStep(req.params.id, req.userId);
      res.json(audit);
    } catch (error) {
      res.status(error.message.includes('not found') ? 404 : 400).json({ error: error.message });
    }
  });

  // ── Soft-delete audit ─────────────────────────────────────────────────────
  router.delete('/:id', async (req, res) => {
    try {
      const result = await auditService.deleteAudit(req.params.id, req.userId);
      if (!result) return res.status(404).json({ error: 'Audit not found' });
      res.json({ message: 'Audit deleted' });
    } catch (error) {
      console.error('Delete audit error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── Restore audit ─────────────────────────────────────────────────────────
  router.post('/:id/restore', async (req, res) => {
    try {
      const result = await auditService.restoreAudit(req.params.id, req.userId);
      if (!result) return res.status(404).json({ error: 'Audit not found or not in trash' });
      res.json({ message: 'Audit restored successfully' });
    } catch (error) {
      console.error('Restore audit error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── Purge audit (permanent delete) ───────────────────────────────────────
  router.delete('/:id/purge', async (req, res) => {
    try {
      const result = await auditService.purgeAudit(req.params.id, req.userId);
      if (!result) return res.status(404).json({ error: 'Audit not found' });
      res.json({ message: 'Audit permanently deleted' });
    } catch (error) {
      console.error('Purge audit error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
