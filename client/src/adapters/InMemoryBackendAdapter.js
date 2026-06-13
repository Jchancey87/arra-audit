import { IBackendService } from '../ports/IBackendService.js';

/**
 * InMemoryBackendAdapter - Mock implementation of IBackendService.
 * Used for isolated UI testing and Storybook. Stores all data in memory.
 */
export class InMemoryBackendAdapter extends IBackendService {
  constructor() {
    super();
    this.songs = [];
    this.audits = [];
    this.techniques = [];
    this.tastes = [];
    this.currentUser = null;
    this.studyProgress = [];
    
    // Seed default curriculum
    const formatLabel = (key) => key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const rawDays = [
      { dayNumber: 1, lens: 'harmony', songQuery: 'Wichita Lineman Glen Campbell', songTitle: 'Wichita Lineman', artistName: 'Glen Campbell', listeningPrompt: 'Listen to the harmonic progression...', applicationPrompt: 'Recreate main chord progression...', logFields: ['harmony_notes', 'harmonic_surprises', 'steal_move', 'sketch_filename'] },
      { dayNumber: 2, lens: 'rhythm', songQuery: "What's Going On Marvin Gaye", songTitle: "What's Going On", artistName: 'Marvin Gaye', listeningPrompt: 'Analyze syncopation...', applicationPrompt: 'Write a syncopated groove...', logFields: ['rhythm_notes', 'strong_vs_weak', 'jamerson_pattern', 'sketch_filename'] },
      { dayNumber: 3, lens: 'harmony', songQuery: 'God Only Knows The Beach Boys', songTitle: 'God Only Knows', artistName: 'The Beach Boys', listeningPrompt: 'Identify inversions...', applicationPrompt: 'Write chord progression with inversions...', logFields: ['arrangement_notes', 'inversion_moments', 'emotional_effect', 'sketch_filename'] },
      { dayNumber: 4, lens: 'form', songQuery: 'Weird Fishes Arpeggi Radiohead', songTitle: 'Weird Fishes/Arpeggi', artistName: 'Radiohead', listeningPrompt: 'Listen to building layers...', applicationPrompt: 'Create building layered structure...', logFields: ['form_notes', 'section_map', 'transition_tricks', 'sketch_filename'] },
      { dayNumber: 5, lens: 'texture', songQuery: 'She Moves She Four Tet', songTitle: 'She Moves She', artistName: 'Four Tet', listeningPrompt: 'Focus on blend of acoustic and electronic...', applicationPrompt: 'Incorporate organic textures...', logFields: ['texture_notes', 'texture_inventory', 'steal_move', 'sketch_filename'] },
      { dayNumber: 6, lens: 'arrangement', songQuery: 'Integration Day 6', songTitle: 'Original Build 1', artistName: 'User Original', listeningPrompt: 'Reflect on weekly techniques...', applicationPrompt: 'Start an original DAW sketch...', logFields: ['original_notes', 'ingredients_used', 'natural_vs_forced', 'sketch_filename'] },
      { dayNumber: 7, lens: 'arrangement', songQuery: 'Rest Day 7', songTitle: 'Weekly Reflection 1', artistName: 'System', listeningPrompt: 'No active listening required...', applicationPrompt: 'Reflect on weekly findings...', logFields: ['review_notes', 'ear_changes', 'biggest_confusion', 'investigation_question'] },
      { dayNumber: 8, lens: 'arrangement', songQuery: 'Wichita Lineman Glen Campbell', songTitle: 'Wichita Lineman', artistName: 'Glen Campbell', listeningPrompt: 'Analyze arrangement growth...', applicationPrompt: 'Draft arrangement curve...', logFields: ['arrangement_notes', 'arr_gestures', 'sparse_vs_dense', 'sketch_filename'] },
      { dayNumber: 9, lens: 'rhythm', songQuery: "What's Going On Marvin Gaye", songTitle: "What's Going On", artistName: 'Marvin Gaye', listeningPrompt: 'Listen to bassline as melody...', applicationPrompt: 'Write melodic bassline...', logFields: ['rhythm_notes', 'favorite_fragment', 'bass_contour', 'sketch_filename'] },
      { dayNumber: 10, lens: 'harmony', songQuery: 'God Only Knows The Beach Boys', songTitle: 'God Only Knows', artistName: 'The Beach Boys', listeningPrompt: 'Listen to counterpoint...', applicationPrompt: 'Record overlapping synth/vocal lines...', logFields: ['harmony_notes', 'vocal_moment', 'counterpoint_ideas', 'sketch_filename'] },
      { dayNumber: 11, lens: 'harmony', songQuery: 'Weird Fishes Arpeggi Radiohead', songTitle: 'Weird Fishes/Arpeggi', artistName: 'Radiohead', listeningPrompt: 'Identify pedal tones...', applicationPrompt: 'Write progression over pedal tone...', logFields: ['harmony_notes', 'pedal_tones', 'pedal_progression', 'sketch_filename'] },
      { dayNumber: 12, lens: 'form', songQuery: 'She Moves She Four Tet', songTitle: 'She Moves She', artistName: 'Four Tet', listeningPrompt: 'Observe modulation of loops...', applicationPrompt: 'Build 2-minute arrangement from 4-bar loop...', logFields: ['form_notes', 'section_lengths', 'structural_tricks', 'sketch_filename'] },
      { dayNumber: 13, lens: 'texture', songQuery: 'User Choice Song', songTitle: 'Song You Avoid', artistName: 'User Input', listeningPrompt: 'Deconstruct a song you avoid...', applicationPrompt: 'Borrow one move from it...', logFields: ['dna_notes', 'sonic_dna_bullets', 'borrowed_move', 'sketch_filename'] },
      { dayNumber: 14, lens: 'arrangement', songQuery: 'Integration Day 14', songTitle: 'Original Build 2', artistName: 'User Original', listeningPrompt: 'Integrate all techniques...', applicationPrompt: 'Finish or expand DAW sketch...', logFields: ['original_notes', 'ingredients_used', 'artistic_voice', 'sketch_filename'] }
    ];

    this.curricula.push({
      _id: 'curriculum-seeded-2-week',
      title: '2-Week Song Audit Planner',
      slug: '2-week-song-audit-planner',
      description: 'A structured 14-day study plan focusing on harmony, bass movement, texture, and form to guide your listening and application practice.',
      audience: 'Producer blending lofi, indie electronic, country-psychedelic, and Americana',
      focusAreas: ['harmony', 'bass movement', 'texture', 'form'],
      durationWeeks: 2,
      creatorType: 'system',
      days: rawDays.map(day => ({
        ...day,
        logFields: day.logFields.map(key => ({ key, label: formatLabel(key), fieldType: 'textarea' }))
      }))
    });
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  async login(email, password) {
    this.currentUser = {
      id: 'user-1',
      email,
      displayName: 'Test User',
      name: 'Test User',
      preferences: { defaultWorkflow: 'quick', preferredLenses: [], timezone: 'UTC' }
    };
    return { token: 'mock-token', user: this.currentUser };
  }

  async register(email, password, name) {
    this.currentUser = {
      id: 'user-1',
      email,
      displayName: name,
      name,
      preferences: { defaultWorkflow: 'quick', preferredLenses: [], timezone: 'UTC' }
    };
    return { token: 'mock-token', user: this.currentUser };
  }

  async getUserProfile() {
    if (!this.currentUser) throw new Error('Not authenticated');
    return this.currentUser;
  }

  async updatePreferences(preferences) {
    if (!this.currentUser) throw new Error('Not authenticated');
    this.currentUser.preferences = {
      ...this.currentUser.preferences,
      ...preferences
    };
    return this.currentUser.preferences;
  }

  async updateProfile(profileData) {
    if (!this.currentUser) throw new Error('Not authenticated');
    this.currentUser = {
      ...this.currentUser,
      ...profileData,
      displayName: profileData.name || this.currentUser.displayName,
      name: profileData.name || this.currentUser.name
    };
    return this.currentUser;
  }

  async changePassword(oldPassword, newPassword) {
    if (!this.currentUser) throw new Error('Not authenticated');
    return { success: true };
  }

  async deleteAccount() {
    this.currentUser = null;
    return { success: true };
  }

  // ── Songs ─────────────────────────────────────────────────────────────────
  async getSongs(filters = {}) {
    return this.songs.filter((s) => !s.deletedAt);
  }

  async getSong(id) {
    return this.songs.find((s) => s._id === id && !s.deletedAt) || null;
  }

  async importSong(youtubeUrl) {
    const sourceId = `mock-id-${Date.now()}`;
    const existing = this.songs.find((s) => s.sourceId === sourceId && !s.deletedAt);
    if (existing) {
      const err = new Error('already_imported');
      err.code = 'already_imported';
      err.songId = existing._id;
      throw err;
    }
    const song = {
      _id: `song-${Date.now()}`,
      title: 'Mock Song',
      artistName: 'Mock Artist',
      artist: 'Mock Artist',
      sourceType: 'youtube',
      sourceId,
      youtubeId: sourceId,
      originalUrl: youtubeUrl,
      youtubeUrl,
      thumbnailUrl: null,
      thumbnail: null,
      researchStatus: 'skipped',
      researchSummary: null,
      deletedAt: null,
    };
    this.songs.push(song);
    return { song };
  }

  async getSongDeletePreview(id) {
    const auditCount = this.audits.filter((a) => a.songId === id && !a.deletedAt).length;
    const techniqueCount = this.techniques.filter((t) => {
      const audit = this.audits.find((a) => a._id === t.auditId);
      return audit?.songId === id && !t.deletedAt;
    }).length;
    return { auditCount, techniqueCount };
  }

  async deleteSong(id) {
    const now = new Date().toISOString();
    const songIdx = this.songs.findIndex((s) => s._id === id);
    if (songIdx === -1) return false;
    this.songs[songIdx].deletedAt = now;
    // Cascade
    this.audits.filter((a) => a.songId === id).forEach((a) => {
      a.deletedAt = now;
      this.techniques.filter((t) => t.auditId === a._id).forEach((t) => { t.deletedAt = now; });
    });
    return true;
  }

  // ── Audits ────────────────────────────────────────────────────────────────
  async getAudits() {
    return this.audits.filter((a) => !a.deletedAt);
  }

  /**
   * Single-step creation: server generates template. In mock, we generate it client-side.
   */
  async createAudit({ songId, lenses, lensSelection, workflowType = 'quick' }) {
    const resolvedLenses = lenses || lensSelection || [];
    const templateQuestions = {
      title: 'Mock Audit',
      lenses: resolvedLenses.reduce((acc, lens) => {
        acc[lens] = { 
          description: `Study the ${lens}`, 
          questions: ['Q1?', 'Q2?', 'Q3?'],
          exercises: [
            { name: `Mock ${lens} exercise 1`, description: `Step 1 of recreation for ${lens}` },
            { name: `Mock ${lens} exercise 2`, description: `Step 2 of application for ${lens}` }
          ]
        };
        return acc;
      }, {}),
      workflow_guidance: 'Work through each lens systematically.',
    };

    const audit = {
      _id: `audit-${Date.now()}`,
      songId,
      lensSelection: resolvedLenses,
      workflowType,
      templateQuestions,
      templateVersion: 'mock-v1',
      modelUsed: null,
      responses: {},
      bookmarks: [],
      techniques: [],
      guidedSteps: [],
      status: 'draft',
      completedAt: null,
      deletedAt: null,
      createdAt: new Date().toISOString(),
    };
    this.audits.push(audit);
    return { audit };
  }

  async getAuditsForSong(songId) {
    return this.audits.filter((a) => a.songId === songId && !a.deletedAt);
  }

  async getAudit(id) {
    return this.audits.find((a) => a._id === id && !a.deletedAt) || null;
  }

  async updateAudit(id, updates) {
    const idx = this.audits.findIndex((a) => a._id === id);
    if (idx === -1) throw new Error('Not found');
    this.audits[idx] = { ...this.audits[idx], ...updates };
    return this.audits[idx];
  }

  async getAuditDeletePreview(id) {
    const techniqueCount = this.techniques.filter((t) => t.auditId === id && !t.deletedAt).length;
    return { techniqueCount };
  }

  async deleteAudit(id) {
    const now = new Date().toISOString();
    const idx = this.audits.findIndex((a) => a._id === id);
    if (idx === -1) return false;
    this.audits[idx].deletedAt = now;
    this.techniques.filter((t) => t.auditId === id).forEach((t) => { t.deletedAt = now; });
    return true;
  }

  // ── Bookmarks ─────────────────────────────────────────────────────────────
  async addBookmark(auditId, bookmark) {
    const audit = await this.getAudit(auditId);
    if (!audit) throw new Error('Not found');
    const newBookmark = {
      _id: `bm-${Date.now()}`,
      timestampSeconds: bookmark.timestampSeconds ?? bookmark.timestamp ?? 0,
      label: bookmark.label || '',
      note: bookmark.note || '',
      lens: bookmark.lens || null,
      createdAt: new Date().toISOString(),
    };
    audit.bookmarks = [...(audit.bookmarks || []), newBookmark]
      .sort((a, b) => a.timestampSeconds - b.timestampSeconds);
    return audit;
  }

  async updateBookmark(auditId, bookmarkId, updates) {
    const audit = await this.getAudit(auditId);
    if (!audit) throw new Error('Not found');
    audit.bookmarks = (audit.bookmarks || []).map((b) =>
      b._id === bookmarkId ? { ...b, ...updates } : b
    );
    return audit;
  }

  // ── Guided steps ──────────────────────────────────────────────────────────
  async advanceStep(auditId) {
    const audit = await this.getAudit(auditId);
    const steps = audit?.guidedSteps || [];
    const idx = steps.findIndex((s) => s.status === 'active');
    if (idx !== -1) {
      steps[idx].status = 'complete';
      if (idx + 1 < steps.length) steps[idx + 1].status = 'active';
    }
    return this.updateAudit(auditId, { guidedSteps: steps });
  }

  async goBackStep(auditId) {
    const audit = await this.getAudit(auditId);
    const steps = audit?.guidedSteps || [];
    const idx = steps.findIndex((s) => s.status === 'active');
    if (idx > 0) {
      steps[idx].status = 'pending';
      steps[idx - 1].status = 'active';
    }
    return this.updateAudit(auditId, { guidedSteps: steps });
  }

  async skipStep(auditId) {
    const audit = await this.getAudit(auditId);
    const steps = audit?.guidedSteps || [];
    const idx = steps.findIndex((s) => s.status === 'active');
    if (idx !== -1) {
      steps[idx].status = 'skipped';
      if (idx + 1 < steps.length) steps[idx + 1].status = 'active';
    }
    return this.updateAudit(auditId, { guidedSteps: steps });
  }

  // ── Techniques ────────────────────────────────────────────────────────────
  async getTechniques(filters = {}) {
    let techniques = this.techniques.filter((t) => !t.deletedAt);
    if (filters.lens || filters.category) {
      techniques = techniques.filter((t) => t.lens === (filters.lens || filters.category));
    }
    if (filters.q || filters.search) {
      const s = (filters.q || filters.search).toLowerCase();
      techniques = techniques.filter(
        (t) =>
          (t.description || '').toLowerCase().includes(s) ||
          (t.techniqueName || '').toLowerCase().includes(s) ||
          (t.notes || '').toLowerCase().includes(s)
      );
    }
    const grouped = {};
    techniques.forEach((t) => {
      const key = t.lens || 'other';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(t);
    });
    return { techniques, grouped };
  }

  async addTechnique(techniqueData) {
    const tech = {
      _id: `tech-${Date.now()}`,
      deletedAt: null,
      createdAt: new Date().toISOString(),
      ...techniqueData,
      lens: techniqueData.lens || techniqueData.category,
    };
    this.techniques.push(tech);
    return tech;
  }

  async updateTechnique(id, updates) {
    const idx = this.techniques.findIndex((t) => t._id === id);
    if (idx === -1) throw new Error('Not found');
    this.techniques[idx] = { ...this.techniques[idx], ...updates };
    return this.techniques[idx];
  }

  async deleteTechnique(id) {
    const idx = this.techniques.findIndex((t) => t._id === id);
    if (idx !== -1) this.techniques[idx].deletedAt = new Date().toISOString();
    return true;
  }

  // ── Trash / Archives (Mock) ──────────────────────────────────────────────
  async getDeletedSongs() {
    return this.songs
      .filter((s) => s.deletedAt)
      .sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
  }

  async restoreSong(id) {
    const song = this.songs.find((s) => s._id === id);
    if (!song) return false;
    song.deletedAt = null;
    this.audits.filter((a) => a.songId === id).forEach((a) => {
      a.deletedAt = null;
      this.techniques.filter((t) => t.auditId === a._id).forEach((t) => { t.deletedAt = null; });
    });
    return true;
  }

  async purgeSong(id) {
    this.songs = this.songs.filter((s) => s._id !== id);
    const auditsToDelete = this.audits.filter((a) => a.songId === id).map((a) => a._id);
    this.audits = this.audits.filter((a) => a.songId !== id);
    this.techniques = this.techniques.filter((t) => !auditsToDelete.includes(t.auditId));
    return true;
  }

  async purgeAllSongs() {
    const deleted = this.songs.filter((s) => s.deletedAt).map((s) => s._id);
    for (const id of deleted) {
      await this.purgeSong(id);
    }
    return { success: true, count: deleted.length };
  }

  async triggerSongAnalysis(songId) {
    const song = this.songs.find((s) => s._id === songId);
    if (!song) throw new Error('Song not found');
    
    song.audioAnalysisStatus = 'success';
    song.audioAnalysis = {
      tempo_bpm: 120.00,
      tempo_confidence: 0.950,
      tempo_curve: [
        { time_seconds: 0.0, bpm: 120.00 },
        { time_seconds: 15.0, bpm: 120.00 },
        { time_seconds: 30.0, bpm: 120.00 }
      ],
      beat_times: [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0],
      downbeat_times: [0.5, 2.5, 4.5],
      estimated_meter: "4/4",
      meter_confidence: 0.910,
      key: "C",
      scale: "major",
      key_confidence: 0.890,
      tuning_reference: 440.0,
      sectional_key_candidates: [
        { section: "Intro", key: "C", scale: "major", confidence: 0.92 },
        { section: "Verse 1", key: "C", scale: "major", confidence: 0.90 },
        { section: "Chorus 1", key: "C", scale: "major", confidence: 0.95 }
      ],
      loudness_integrated: -14.20,
      dynamic_range: 8.50,
      energy_curve: [0.3, 0.4, 0.6, 0.7, 0.5, 0.8, 0.4],
      spectral_centroid_summary: {
        mean_hz: 1850.5,
        std_hz: 320.0
      },
      danceability_or_pulse_strength: 0.75,
      analysis_notes: "Mock pipeline execution completed successfully."
    };
    return { success: true };
  }

  async saveAudioOverrides(songId, overrides) {
    const song = this.songs.find((s) => s._id === songId);
    if (!song) throw new Error('Song not found');
    song.audioOverrides = overrides;
    return { song };
  }

  async getDeletedAudits() {
    // Return deleted audits whose parent song is active
    const deleted = this.audits.filter((a) => {
      if (!a.deletedAt) return false;
      const song = this.songs.find((s) => s._id === a.songId);
      return !song || !song.deletedAt;
    });

    // Populate song field
    return deleted.map((a) => {
      const song = this.songs.find((s) => s._id === a.songId);
      return {
        ...a,
        songId: song || a.songId,
      };
    }).sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
  }

  async restoreAudit(id) {
    const audit = this.audits.find((a) => a._id === id);
    if (!audit) return false;
    const song = this.songs.find((s) => s._id === audit.songId);
    if (song && song.deletedAt) {
      throw new Error('Cannot restore audit because its parent song is deleted. Restore the song first.');
    }
    audit.deletedAt = null;
    this.techniques.filter((t) => t.auditId === id).forEach((t) => { t.deletedAt = null; });
    return true;
  }

  async purgeAudit(id) {
    this.audits = this.audits.filter((a) => a._id !== id);
    this.techniques = this.techniques.filter((t) => t.auditId !== id);
    return true;
  }

  async purgeAllAudits() {
    const deleted = this.audits.filter((a) => a.deletedAt).map((a) => a._id);
    for (const id of deleted) {
      await this.purgeAudit(id);
    }
    return { success: true, count: deleted.length };
  }

  // ── Tastes ────────────────────────────────────────────────────────────────
  async getTasteProfiles() {
    return this.tastes || [];
  }

  async researchTasteProfile(lens, name) {
    if (!this.tastes) this.tastes = [];
    const idx = this.tastes.findIndex(t => t.lens === lens && t.name.toLowerCase() === name.toLowerCase());
    const profile = {
      _id: `taste-${Date.now()}`,
      lens,
      name,
      summary: `Mock synthesized style profile for "${name}" under the ${lens} lens. Highly detailed techniques and DAW tips.`,
      sources: [
        { title: `Mock Source 1 about ${name}`, url: 'http://example.com/1', content: `${name}'s style analysis snippet.` },
        { title: `Mock Source 2 about ${name}`, url: 'http://example.com/2', content: `${name}'s DAW techniques snippet.` },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (idx !== -1) {
      this.tastes[idx] = { ...this.tastes[idx], ...profile };
      return { profile: this.tastes[idx] };
    } else {
      this.tastes.push(profile);
      return { profile };
    }
  }

  // ── Curriculum & Study Progress ───────────────────────────────────────────
  async getCurricula() {
    return this.curricula || [];
  }

  async generateAICurriculum(focusArea, pastTechniques) {
    const mockPlan = {
      _id: `curriculum-ai-${Date.now()}`,
      title: `AI Curriculum: ${focusArea}`,
      slug: `ai-curriculum-${Date.now()}`,
      description: `Custom 7-day plan optimized for: ${focusArea}`,
      audience: 'Producer exploring style concepts',
      focusAreas: [focusArea],
      durationWeeks: 1,
      creatorType: 'ai',
      days: [
        {
          dayNumber: 1,
          lens: 'harmony',
          songQuery: 'Mock Song for Day 1',
          songTitle: 'Mock Song 1',
          artistName: 'Mock Artist 1',
          listeningPrompt: `Analyze harmonic voicings related to ${focusArea}`,
          applicationPrompt: 'Try recreation in your DAW',
          logFields: [
            { key: 'harmony_notes', label: 'Harmony Notes', fieldType: 'textarea' },
            { key: 'steal_move', label: 'Steal Move', fieldType: 'textarea' }
          ]
        },
        {
          dayNumber: 2,
          lens: 'rhythm',
          songQuery: 'Mock Song for Day 2',
          songTitle: 'Mock Song 2',
          artistName: 'Mock Artist 2',
          listeningPrompt: `Analyze rhythm & syncopation in relation to ${focusArea}`,
          applicationPrompt: 'Write a rhythmic groove in your DAW',
          logFields: [
            { key: 'rhythm_notes', label: 'Rhythm Notes', fieldType: 'textarea' },
            { key: 'strong_vs_weak', label: 'Strong Vs Weak', fieldType: 'textarea' }
          ]
        },
        {
          dayNumber: 3,
          lens: 'texture',
          songQuery: 'Mock Song for Day 3',
          songTitle: 'Mock Song 3',
          artistName: 'Mock Artist 3',
          listeningPrompt: `Explore textures in ${focusArea}`,
          applicationPrompt: 'Record organic layer in your DAW',
          logFields: [
            { key: 'texture_notes', label: 'Texture Notes', fieldType: 'textarea' },
            { key: 'steal_move', label: 'Steal Move', fieldType: 'textarea' }
          ]
        },
        {
          dayNumber: 4,
          lens: 'harmony',
          songQuery: 'Mock Song for Day 4',
          songTitle: 'Mock Song 4',
          artistName: 'Mock Artist 4',
          listeningPrompt: `Explore pedal tones or chord extensions in ${focusArea}`,
          applicationPrompt: 'Write a chord progression in your DAW',
          logFields: [
            { key: 'harmony_notes', label: 'Harmony Notes', fieldType: 'textarea' }
          ]
        },
        {
          dayNumber: 5,
          lens: 'form',
          songQuery: 'Mock Song for Day 5',
          songTitle: 'Mock Song 5',
          artistName: 'Mock Artist 5',
          listeningPrompt: `Explore structure & transitions related to ${focusArea}`,
          applicationPrompt: 'Write dynamic transitions in your DAW',
          logFields: [
            { key: 'form_notes', label: 'Form Notes', fieldType: 'textarea' }
          ]
        },
        {
          dayNumber: 6,
          lens: 'arrangement',
          songQuery: 'Mock Song for Day 6',
          songTitle: 'Mock Song 6',
          artistName: 'Mock Artist 6',
          listeningPrompt: `Reflect on all parameters in ${focusArea}`,
          applicationPrompt: 'Draft an original DAW sketch',
          logFields: [
            { key: 'original_notes', label: 'Original Notes', fieldType: 'textarea' }
          ]
        },
        {
          dayNumber: 7,
          lens: 'arrangement',
          songQuery: 'Rest Day 7',
          songTitle: 'Weekly Reflection',
          artistName: 'System',
          listeningPrompt: 'Rest your ears and reflect on the week.',
          applicationPrompt: 'Log your weekly reflections.',
          logFields: [
            { key: 'review_notes', label: 'Review Notes', fieldType: 'textarea' },
            { key: 'ear_changes', label: 'Ear Changes', fieldType: 'textarea' }
          ]
        }
      ]
    };
    return mockPlan;
  }

  async saveCustomCurriculum(curriculumData) {
    const saved = {
      ...curriculumData,
      _id: curriculumData._id || `curriculum-${Date.now()}`
    };
    this.curricula.push(saved);
    return saved;
  }

  async getActiveStudyProgress() {
    const active = this.studyProgress.find((p) => p.status === 'active');
    if (!active) return null;
    
    // We should populate the curriculum for it
    const curr = this.curricula.find((c) => c._id === active.curriculumId);
    return {
      ...active,
      curriculumId: curr || active.curriculumId
    };
  }

  async startCurriculum(curriculumId) {
    // Mark previous active as paused or just remove/override
    this.studyProgress.forEach((p) => {
      if (p.status === 'active') p.status = 'paused';
    });

    const curr = this.curricula.find((c) => c._id === curriculumId);
    if (!curr) throw new Error('Curriculum not found');

    const progress = {
      _id: `progress-${Date.now()}`,
      userId: 'user-1',
      curriculumId: curr._id,
      currentDay: 1,
      status: 'active',
      dayProgress: curr.days.map((day) => ({
        dayNumber: day.dayNumber,
        songId: null,
        auditId: null,
        responses: {},
        audioFilePath: null,
        audioOriginalName: null,
        status: 'pending',
        completedAt: null
      })),
      weeklyReviews: Array.from({ length: curr.durationWeeks }, (_, idx) => ({
        weekNumber: idx + 1,
        changedInEars: '',
        notUnderstood: '',
        nextInvestigationQuestion: '',
        completedAt: null
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.studyProgress.push(progress);
    return progress;
  }

  async linkSongToDay(progressId, dayNumber, songId) {
    const progress = this.studyProgress.find((p) => p._id === progressId);
    if (!progress) throw new Error('Progress not found');
    const day = progress.dayProgress.find((dp) => dp.dayNumber === Number(dayNumber));
    if (!day) throw new Error('Day not found');
    day.songId = songId;
    return progress;
  }

  async saveDayProgress(progressId, dayNumber, responses) {
    const progress = this.studyProgress.find((p) => p._id === progressId);
    if (!progress) throw new Error('Progress not found');
    const day = progress.dayProgress.find((dp) => dp.dayNumber === Number(dayNumber));
    if (!day) throw new Error('Day not found');
    day.responses = { ...day.responses, ...responses };
    return progress;
  }

  async completeDayProgress(progressId, dayNumber, responses, syncTechnique, techniqueNotes) {
    const progress = this.studyProgress.find((p) => p._id === progressId);
    if (!progress) throw new Error('Progress not found');
    const day = progress.dayProgress.find((dp) => dp.dayNumber === Number(dayNumber));
    if (!day) throw new Error('Day not found');
    
    day.responses = { ...day.responses, ...responses };
    day.status = 'completed';
    day.completedAt = new Date().toISOString();

    // Create a mock audit
    const curr = this.curricula.find((c) => c._id === progress.curriculumId);
    const dayMeta = curr?.days?.find(d => d.dayNumber === Number(dayNumber));
    
    const mockAudit = {
      _id: `audit-curr-${Date.now()}`,
      songId: day.songId || `mock-song-id`,
      userId: 'user-1',
      lens: dayMeta?.lens || 'harmony',
      workflowType: 'guided',
      status: 'completed',
      answers: responses,
      createdAt: new Date().toISOString()
    };
    this.audits.push(mockAudit);
    day.auditId = mockAudit._id;

    if (syncTechnique) {
      const mockTechnique = {
        _id: `tech-curr-${Date.now()}`,
        userId: 'user-1',
        title: `Technique: Day ${dayNumber} from ${curr?.title || 'Study'}`,
        description: techniqueNotes || 'Extracted during curriculum audit',
        lens: dayMeta?.lens || 'harmony',
        notes: techniqueNotes,
        createdAt: new Date().toISOString()
      };
      this.techniques.push(mockTechnique);
    }

    // Advance currentDay if completing the current day
    if (progress.currentDay === Number(dayNumber)) {
      progress.currentDay += 1;
    }

    return progress;
  }

  async uploadAudioSketch(progressId, dayNumber, file) {
    const progress = this.studyProgress.find((p) => p._id === progressId);
    if (!progress) throw new Error('Progress not found');
    const day = progress.dayProgress.find((dp) => dp.dayNumber === Number(dayNumber));
    if (!day) throw new Error('Day not found');
    day.audioFilePath = `/uploads/mock-audio-${Date.now()}.wav`;
    day.audioOriginalName = file.name || 'sketch.wav';
    return progress;
  }

  async submitWeeklyReview(progressId, weekNumber, reviewData) {
    const progress = this.studyProgress.find((p) => p._id === progressId);
    if (!progress) throw new Error('Progress not found');
    const review = progress.weeklyReviews.find((r) => r.weekNumber === Number(weekNumber));
    if (!review) throw new Error('Review not found');
    
    review.changedInEars = reviewData.changedInEars || '';
    review.notUnderstood = reviewData.notUnderstood || '';
    review.nextInvestigationQuestion = reviewData.nextInvestigationQuestion || '';
    review.completedAt = new Date().toISOString();

    return progress;
  }
}

