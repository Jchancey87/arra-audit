/**
 * IUserRepository - Port (interface) for user persistence.
 *
 * Extends the generic IRepository with authentication-specific operations.
 * Auth-related methods live here (not on IRepository) so the surface of
 * "things every repository can do" stays minimal.
 *
 * Production: UserRepository (wraps Mongoose User model)
 * Tests:      InMemoryUserRepository (wraps InMemoryRepository)
 */

import { IRepository } from './IRepository.js';

export class IUserRepository extends IRepository {
  /**
   * Verify an entity's password
   * @param {string} entityId - User ID
   * @param {string} candidatePassword - Plaintext password to verify
   * @returns {Promise<Object>} The user document if verification succeeds
   * @throws {Error} if user not found or password does not match
   */
  async verifyPassword(entityId, candidatePassword) {
    throw new Error('verifyPassword() not implemented');
  }

  /**
   * Hash and persist a new password for an entity
   * @param {string} entityId - User ID
   * @param {string} newPassword - Plaintext new password
   * @returns {Promise<Object>} Updated user document
   * @throws {Error} if user not found or update fails
   */
  async setPassword(entityId, newPassword) {
    throw new Error('setPassword() not implemented');
  }
}
