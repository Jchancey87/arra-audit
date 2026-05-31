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
}
