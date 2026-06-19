/**
 * IRepository - Port (interface) for data persistence
 * 
 * Any class implementing this interface must provide standard CRUD operations.
 * This allows production code to use MongoDB while tests use in-memory storage.
 * 
 * Contract: All methods must handle the specified collection/entity type.
 * Different repositories can extend this (SongRepository, AuditRepository, etc.)
 */

export class IRepository {
  /**
   * Create and save a new document
   * @param {Object} data - Document to create
   * @returns {Promise<Object>} Created document with _id
   * @throws {Error} if creation fails
   */
  async create(data) {
    throw new Error('create() not implemented');
  }

  /**
   * Find a document by ID
   * @param {string} id - Document ID
   * @returns {Promise<Object|null>} Document if found, null otherwise
   * @throws {Error} if query fails
   */
  async findById(id) {
    throw new Error('findById() not implemented');
  }

  /**
   * Find a document by ID and populate related fields
   * @param {string} id - Document ID
   * @param {Array<string|{path: string, resolver?: Function}>} relations - Paths to populate, optionally with resolver functions for in-memory adapters
   * @returns {Promise<Object|null>} Document if found, null otherwise
   * @throws {Error} if query fails
   */
  async findByIdWithRelations(id, relations = []) {
    throw new Error('findByIdWithRelations() not implemented');
  }

  /**
   * Find documents by query criteria
   * @param {Object} query - MongoDB query object
   * @param {Object} options - { lean?: boolean, sort?: Object, limit?: number }
   * @returns {Promise<Array>} Array of matching documents
   * @throws {Error} if query fails
   */
  async find(query, options = {}) {
    throw new Error('find() not implemented');
  }

  /**
   * Find one document by query
   * @param {Object} query - MongoDB query object
   * @returns {Promise<Object|null>} First matching document or null
   * @throws {Error} if query fails
   */
  async findOne(query) {
    throw new Error('findOne() not implemented');
  }

  /**
   * Update a document by ID
   * @param {string} id - Document ID
   * @param {Object} data - Fields to update
   * @returns {Promise<Object>} Updated document
   * @throws {Error} if update fails or document not found
   */
  async updateById(id, data) {
    throw new Error('updateById() not implemented');
  }

  /**
   * Delete a document by ID
   * @param {string} id - Document ID
   * @returns {Promise<boolean>} true if deleted, false if not found
   * @throws {Error} if deletion fails
   */
  async deleteById(id) {
    throw new Error('deleteById() not implemented');
  }

  /**
   * Delete multiple documents by query
   * @param {Object} query - MongoDB query object
   * @returns {Promise<number>} Number of documents deleted
   * @throws {Error} if deletion fails
   */
  async deleteMany(query) {
    throw new Error('deleteMany() not implemented');
  }

  /**
   * Count documents matching query
   * @param {Object} query - MongoDB query object
   * @returns {Promise<number>} Count of matching documents
   * @throws {Error} if count fails
   */
  async count(query) {
    throw new Error('count() not implemented');
  }

  /**
   * Check if a document exists matching query
   * @param {Object} query - MongoDB query object
   * @returns {Promise<boolean>} true if exists, false otherwise
   * @throws {Error} if query fails
   */
  async exists(query) {
    throw new Error('exists() not implemented');
  }
}
