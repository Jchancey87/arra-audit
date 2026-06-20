import axios from 'axios';
import { IBackendService } from '../ports/IBackendService.js';

/**
 * HttpBackendAdapter - Production implementation of IBackendService.
 * Communicates with the Express backend via Axios.
 */
export class HttpBackendAdapter extends IBackendService {
  constructor(baseURL) {
    super();
    this.api = axios.create({
      baseURL: baseURL || import.meta.env?.VITE_API_URL || 'http://localhost:5050/api',
      headers: { 'Content-Type': 'application/json' },
    });

    // Attach JWT on every request
    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  async login(email, password) {
    const res = await this.api.post('/auth/login', { email, password });
    return res.data;
  }

  async register(email, password, name) {
    const res = await this.api.post('/auth/register', { email, password, name });
    return res.data;
  }

  async getUserProfile() {
    const res = await this.api.get('/auth/me');
    return res.data;
  }

  async updatePreferences(preferences) {
    const res = await this.api.put('/auth/preferences', preferences);
    return res.data;
  }

  async updateProfile(profileData) {
    const res = await this.api.put('/auth/profile', profileData);
    return res.data;
  }

  async changePassword(oldPassword, newPassword) {
    const res = await this.api.put('/auth/change-password', { oldPassword, newPassword });
    return res.data;
  }

  async deleteAccount() {
    const res = await this.api.delete('/auth/delete-account');
    return res.data;
  }

  // ── Songs ─────────────────────────────────────────────────────────────────
  async getSongs(filters = {}) {
    const res = await this.api.get('/songs', { params: filters });
    return res.data;
  }

  async getSong(id) {
    const res = await this.api.get(`/songs/${id}`);
    return res.data;
  }

  async importSong(youtubeUrl) {
    const res = await this.api.post('/songs/import', { youtubeUrl });
    return res.data;
  }

  async getSongDeletePreview(id) {
    const res = await this.api.get(`/songs/${id}/delete-preview`);
    return res.data; // { auditCount, techniqueCount }
  }

  async deleteSong(id) {
    const res = await this.api.delete(`/songs/${id}`);
    return res.data;
  }

  async getDeletedSongs() {
    const res = await this.api.get('/songs/trash');
    return res.data;
  }

  async restoreSong(id) {
    const res = await this.api.post(`/songs/${id}/restore`);
    return res.data;
  }

  async purgeSong(id) {
    const res = await this.api.delete(`/songs/${id}/purge`);
    return res.data;
  }

  async purgeAllSongs() {
    const res = await this.api.delete('/songs/trash/purge-all');
    return res.data;
  }

  async triggerSongAnalysis(songId) {
    const res = await this.api.post(`/songs/${songId}/analyze`);
    return res.data;
  }

  async saveAudioOverrides(songId, overrides) {
    const res = await this.api.put(`/songs/${songId}/audio-overrides`, overrides);
    return res.data;
  }

  // ── Audits ────────────────────────────────────────────────────────────────
  async getAudits() {
    const res = await this.api.get('/audits');
    return res.data;
  }

  /**
   * Create an audit — single-step (generates + stores template server-side).
   * @param {{ songId, lenses, workflowType }} data
   */
  async createAudit(data) {
    const res = await this.api.post('/audits', data);
    return res.data; // { audit: { _id, templateQuestions, ... } }
  }

  async getAuditsForSong(songId) {
    const res = await this.api.get(`/audits/song/${songId}`);
    return res.data;
  }

  async getAudit(id) {
    const res = await this.api.get(`/audits/${id}`);
    return res.data;
  }

  async updateAudit(id, updates) {
    const res = await this.api.patch(`/audits/${id}`, updates);
    return res.data;
  }

  async getAuditDeletePreview(id) {
    const res = await this.api.get(`/audits/${id}/delete-preview`);
    return res.data; // { techniqueCount }
  }

  async deleteAudit(id) {
    const res = await this.api.delete(`/audits/${id}`);
    return res.data;
  }

  async getDeletedAudits() {
    const res = await this.api.get('/audits/trash');
    return res.data;
  }

  async restoreAudit(id) {
    const res = await this.api.post(`/audits/${id}/restore`);
    return res.data;
  }

  async purgeAudit(id) {
    const res = await this.api.delete(`/audits/${id}/purge`);
    return res.data;
  }

  async purgeAllAudits() {
    const res = await this.api.delete('/audits/trash/purge-all');
    return res.data;
  }

  // ── Audit bookmarks ───────────────────────────────────────────────────────
  async addBookmark(auditId, bookmark) {
    const res = await this.api.post(`/audits/${auditId}/bookmarks`, bookmark);
    return res.data;
  }

  async updateBookmark(auditId, bookmarkId, updates) {
    const res = await this.api.patch(`/audits/${auditId}/bookmarks/${bookmarkId}`, updates);
    return res.data;
  }

  async deleteBookmark(auditId, bookmarkId) {
    const res = await this.api.delete(`/audits/${auditId}/bookmarks/${bookmarkId}`);
    return res.data;
  }

  async analyzeBookmark(auditId, bookmarkId, opts = {}) {
    const res = await this.api.post(`/audits/${auditId}/bookmarks/${bookmarkId}/analyze`, opts);
    return res.data;
  }

  async getBookmarkAnalysis(auditId, bookmarkId) {
    const res = await this.api.get(`/audits/${auditId}/bookmarks/${bookmarkId}/analysis`);
    return res.data;
  }

  // ── Guided steps ──────────────────────────────────────────────────────────
  async advanceStep(auditId) {
    const res = await this.api.post(`/audits/${auditId}/steps/advance`);
    return res.data;
  }

  async goBackStep(auditId) {
    const res = await this.api.post(`/audits/${auditId}/steps/back`);
    return res.data;
  }

  async skipStep(auditId) {
    const res = await this.api.post(`/audits/${auditId}/steps/skip`);
    return res.data;
  }

  // ── Techniques ────────────────────────────────────────────────────────────
  /**
   * Supported filters: q, lens, category, artist, songId, auditId,
   *   tags (CSV), sortBy, order, page, limit
   */
  async getTechniques(filters = {}) {
    const res = await this.api.get('/techniques', { params: filters });
    return res.data; // { techniques, grouped }
  }

  async addTechnique(techniqueData) {
    const res = await this.api.post('/techniques', techniqueData);
    return res.data;
  }

  async updateTechnique(id, updates) {
    const res = await this.api.patch(`/techniques/${id}`, updates);
    return res.data;
  }

  async deleteTechnique(id) {
    const res = await this.api.delete(`/techniques/${id}`);
    return res.data;
  }

  async findSimilarTechniques(techniqueId, { limit = 10 } = {}) {
    const res = await this.api.get(`/techniques/${techniqueId}/similar`, { params: { limit } });
    return res.data; // { target, similar: [{ technique, score }] }
  }

  // ── Tastes ────────────────────────────────────────────────────────────────
  async getTasteProfiles() {
    const res = await this.api.get('/tastes');
    return res.data;
  }

  async researchTasteProfile(lens, name) {
    const res = await this.api.post('/tastes/research', { lens, name });
    return res.data;
  }

  // ── Curriculum & Study Progress ───────────────────────────────────────────
  async getCurricula() {
    const res = await this.api.get('/curricula');
    return res.data;
  }

  async generateAICurriculum(focusArea, pastTechniques) {
    const res = await this.api.post('/curricula/generate', { focusArea, pastTechniques });
    return res.data;
  }

  async saveCustomCurriculum(curriculumData) {
    const res = await this.api.post('/curricula/custom', curriculumData);
    return res.data;
  }

  async getActiveStudyProgress() {
    const res = await this.api.get('/study-progress/active');
    return res.data;
  }

  async startCurriculum(curriculumId) {
    const res = await this.api.post('/study-progress/start', { curriculumId });
    return res.data;
  }

  async linkSongToDay(progressId, dayNumber, songId) {
    const res = await this.api.post(`/study-progress/${progressId}/day/${dayNumber}/song`, { songId });
    return res.data;
  }

  async saveDayProgress(progressId, dayNumber, responses) {
    const res = await this.api.post(`/study-progress/${progressId}/day/${dayNumber}/save`, { responses });
    return res.data;
  }

  async completeDayProgress(progressId, dayNumber, responses, syncTechnique, techniqueNotes) {
    const res = await this.api.post(`/study-progress/${progressId}/day/${dayNumber}/complete`, {
      responses,
      syncTechnique,
      techniqueNotes
    });
    return res.data;
  }

  async uploadAudioSketch(progressId, dayNumber, file) {
    const formData = new FormData();
    formData.append('audio', file);
    const res = await this.api.post(`/study-progress/${progressId}/day/${dayNumber}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  }

  async submitWeeklyReview(progressId, weekNumber, reviewData) {
    const res = await this.api.post(`/study-progress/${progressId}/week/${weekNumber}/review`, reviewData);
    return res.data;
  }

  // Sketches (A/B compare)
  async getSketches(songId) {
    const res = await this.api.get(`/sketches/songs/${songId}`);
    return res.data;
  }

  async getSketch(id) {
    const res = await this.api.get(`/sketches/${id}`);
    return res.data;
  }

  async uploadSketch(songId, file, { title, notes } = {}) {
    const formData = new FormData();
    formData.append('audio', file);
    if (title) formData.append('title', title);
    if (notes) formData.append('notes', notes);
    const res = await this.api.post(`/sketches/songs/${songId}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  }

  async deleteSketch(id) {
    const res = await this.api.delete(`/sketches/${id}`);
    return res.data;
  }

  async updateSketch(id, updates) {
    const res = await this.api.patch(`/sketches/${id}`, updates);
    return res.data;
  }

  async analyzeSketch(id) {
    const res = await this.api.post(`/sketches/${id}/analyze`);
    return res.data;
  }

  // Audio fallback (yt-dlp). Returns { url, expiresAt } or throws.
  async getAudioFallbackUrl(songId, format = 'bestaudio') {
    const res = await this.api.get(`/songs/${songId}/audio-url`, { params: { format } });
    return res.data;
  }

  async isAudioFallbackAvailable() {
    const res = await this.api.get('/songs/audio-url/available');
    return res.data;
  }
}

