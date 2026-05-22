import { IRepository } from '../ports/IRepository.js';

/**
 * InMemoryRepository - Test implementation of IRepository
 * 
 * Stores all data in memory using a Map. Perfect for unit tests because:
 * - No database connection needed
 * - Instant (no I/O overhead)
 * - Fully isolated (each test gets fresh data)
 * - Deterministic (no race conditions)
 * - Supports all CRUD operations
 * 
 * Usage:
 *   const testRepository = new InMemoryRepository();
 *   const song = await testRepository.create({ title: 'Test Song' });
 *   const found = await testRepository.findById(song._id);
 */

export class InMemoryRepository extends IRepository {
  constructor() {
    super();
    this.storage = new Map();
    this.idCounter = 1;
  }

  /**
   * Generate a MongoDB-like ID for in-memory storage
   * @private
   */
  _generateId() {
    return `id_${this.idCounter++}`;
  }

  /**
   * Deep clone to simulate MongoDB document isolation
   * @private
   */
  _clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Check if object matches query criteria
   * @private
   */
  _matches(doc, query) {
    for (const [key, value] of Object.entries(query)) {
      const docVal = doc[key];

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Handle operator query, e.g. { deletedAt: { $ne: null } }
        for (const [op, opVal] of Object.entries(value)) {
          if (op === '$ne') {
            if (opVal === null) {
              if (docVal === null || docVal === undefined) return false;
            } else {
              if (docVal === opVal) return false;
            }
          } else if (op === '$eq') {
            if (opVal === null) {
              if (docVal !== null && docVal !== undefined) return false;
            } else {
              if (docVal !== opVal) return false;
            }
          }
        }
      } else if (value === null) {
        // MongoDB query { field: null } matches if field is null, undefined, or missing
        if (docVal !== null && docVal !== undefined) {
          return false;
        }
      } else {
        // Simple equality match
        if (docVal !== value) {
          return false;
        }
      }
    }
    return true;
  }

  async create(data) {
    const doc = {
      ...data,
      _id: data._id || this._generateId(),
      createdAt: data.createdAt || new Date(),
      updatedAt: data.updatedAt || new Date(),
    };

    this.storage.set(doc._id, this._clone(doc));
    return this._clone(doc);
  }

  async findById(id) {
    const doc = this.storage.get(id);
    return doc ? this._clone(doc) : null;
  }

  async find(query = {}, options = {}) {
    const results = [];

    for (const doc of this.storage.values()) {
      if (this._matches(doc, query)) {
        results.push(this._clone(doc));
      }
    }

    // Apply sort
    if (options.sort) {
      for (const [key, order] of Object.entries(options.sort)) {
        results.sort((a, b) => {
          if (a[key] < b[key]) return order === 1 ? -1 : 1;
          if (a[key] > b[key]) return order === 1 ? 1 : -1;
          return 0;
        });
      }
    }

    // Apply skip and limit
    const skip = options.skip || 0;
    const limit = options.limit || results.length;

    return results.slice(skip, skip + limit);
  }

  async findOne(query) {
    for (const doc of this.storage.values()) {
      if (this._matches(doc, query)) {
        return this._clone(doc);
      }
    }
    return null;
  }

  async updateById(id, data) {
    const doc = this.storage.get(id);

    if (!doc) {
      throw new Error('Document not found');
    }

    const updated = {
      ...doc,
      ...data,
      _id: id, // Don't allow ID changes
      updatedAt: new Date(),
    };

    this.storage.set(id, updated);
    return this._clone(updated);
  }

  async deleteById(id) {
    const exists = this.storage.has(id);
    this.storage.delete(id);
    return exists;
  }

  async deleteMany(query) {
    let count = 0;

    for (const [id, doc] of this.storage.entries()) {
      if (this._matches(doc, query)) {
        this.storage.delete(id);
        count++;
      }
    }

    return count;
  }

  async count(query = {}) {
    let count = 0;

    for (const doc of this.storage.values()) {
      if (this._matches(doc, query)) {
        count++;
      }
    }

    return count;
  }

  async exists(query = {}) {
    for (const doc of this.storage.values()) {
      if (this._matches(doc, query)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Clear all data (useful for test teardown)
   * @internal
   */
  async clear() {
    this.storage.clear();
    this.idCounter = 1;
  }

  /**
   * Get all data (for debugging tests)
   * @internal
   */
  async getAll() {
    const results = [];
    for (const doc of this.storage.values()) {
      results.push(this._clone(doc));
    }
    return results;
  }
}
