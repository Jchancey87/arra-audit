/**
 * IBackendService - Frontend Port for backend communication
 * 
 * Defines the contract for all backend operations.
 * Allows the UI to be tested in isolation using an InMemoryBackendAdapter.
 */
export class IBackendService {
  // Auth
  async login(email, password) { throw new Error('Not implemented'); }
  async register(email, password, name) { throw new Error('Not implemented'); }
  async getUserProfile() { throw new Error('Not implemented'); }
  async updatePreferences(preferences) { throw new Error('Not implemented'); }
  async updateProfile(profileData) { throw new Error('Not implemented'); }
  async changePassword(oldPassword, newPassword) { throw new Error('Not implemented'); }
  async deleteAccount() { throw new Error('Not implemented'); }
  
  // Songs
  async getSongs(filters) { throw new Error('Not implemented'); }
  async getSong(id) { throw new Error('Not implemented'); }
  async importSong(youtubeUrl) { throw new Error('Not implemented'); }
  async deleteSong(id) { throw new Error('Not implemented'); }
  async getDeletedSongs() { throw new Error('Not implemented'); }
  async restoreSong(id) { throw new Error('Not implemented'); }
  async purgeSong(id) { throw new Error('Not implemented'); }
  async purgeAllSongs() { throw new Error('Not implemented'); }
  async triggerSongAnalysis(songId) { throw new Error('Not implemented'); }
  async saveAudioOverrides(songId, overrides) { throw new Error('Not implemented'); }
  
  // Audits
  async getAudits() { throw new Error('Not implemented'); }
  async generateTemplate(songId, lenses, workflowType) { throw new Error('Not implemented'); }
  async createAudit(auditData) { throw new Error('Not implemented'); }
  async getAuditsForSong(songId) { throw new Error('Not implemented'); }
  async getAudit(id) { throw new Error('Not implemented'); }
  async updateAudit(id, updates) { throw new Error('Not implemented'); }
  async deleteAudit(id) { throw new Error('Not implemented'); }
  async getDeletedAudits() { throw new Error('Not implemented'); }
  async restoreAudit(id) { throw new Error('Not implemented'); }
  async purgeAudit(id) { throw new Error('Not implemented'); }
  async purgeAllAudits() { throw new Error('Not implemented'); }
  
  // Techniques
  async getTechniques(filters) { throw new Error('Not implemented'); }
  async addTechnique(techniqueData) { throw new Error('Not implemented'); }
  async updateTechnique(id, updates) { throw new Error('Not implemented'); }
  async deleteTechnique(id) { throw new Error('Not implemented'); }

  // Tastes
  async getTasteProfiles() { throw new Error('Not implemented'); }
  async researchTasteProfile(lens, name) { throw new Error('Not implemented'); }
}
