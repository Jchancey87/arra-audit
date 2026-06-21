import { IRepository } from '../ports/IRepository.js';
import { IUserRepository } from '../ports/IUserRepository.js';
import bcrypt from 'bcryptjs';

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

  async findByIdWithRelations(id, relations = []) {
    const doc = await this.findById(id);
    if (!doc) return null;

    const populated = this._clone(doc);

    for (const relation of relations) {
      if (typeof relation === 'string' || typeof relation.resolver !== 'function') {
        continue;
      }

      const { path, resolver } = relation;
      const parts = path.split('.');

      if (parts.length === 1) {
        const value = populated[path];
        if (value != null) {
          const resolved = await resolver(value);
          populated[path] = resolved != null ? resolved : value;
        }
      } else if (parts.length === 2) {
        const [arrayField, subField] = parts;
        const array = populated[arrayField];
        if (Array.isArray(array)) {
          for (const item of array) {
            const value = item[subField];
            if (value != null) {
              const resolved = await resolver(value);
              item[subField] = resolved != null ? resolved : value;
            }
          }
        }
      }
    }

    return populated;
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

/**
 * InMemoryUserRepository - Test implementation of IUserRepository.
 *
 * Mirrors the InMemoryRepository CRUD surface, plus the password methods
 * that live on IUserRepository (not on IRepository).
 */
class InMemoryUserRepository extends IUserRepository {
  constructor() {
    super();
    this._store = new InMemoryRepository();
  }

  async create(data) {
    return this._store.create(data);
  }

  async findById(id) {
    return this._store.findById(id);
  }

  async findOne(query) {
    return this._store.findOne(query);
  }

  async updateById(id, data) {
    return this._store.updateById(id, data);
  }

  async deleteById(id) {
    return this._store.deleteById(id);
  }

  async exists(query) {
    return this._store.exists(query);
  }

  async find(query, options) {
    return this._store.find(query, options);
  }

  async count(query) {
    return this._store.count(query);
  }

  async deleteMany(query) {
    return this._store.deleteMany(query);
  }

  async verifyPassword(entityId, candidatePassword) {
    const doc = await this._store.findById(entityId);
    if (!doc) {
      throw new Error('User not found');
    }

    const isValid = await bcrypt.compare(candidatePassword, doc.password);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    return doc;
  }

  async setPassword(entityId, newPassword) {
    const doc = await this._store.findById(entityId);
    if (!doc) {
      throw new Error('User not found');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    return this._store.updateById(entityId, { password: hashedPassword });
  }
}
