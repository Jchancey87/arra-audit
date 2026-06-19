import { IRepository } from '../ports/IRepository.js';
import { IUserRepository } from '../ports/IUserRepository.js';
import bcrypt from 'bcryptjs';
import Curriculum from '../models/Curriculum.js';
import StudyProgress from '../models/StudyProgress.js';
import User from '../models/User.js';

/**
 * MongooseRepository - Production implementation of IRepository
 * 
 * Wraps a Mongoose model and provides standard CRUD operations.
 * This is the production adapter that calls real MongoDB.
 * 
 * Usage:
 *   const songRepository = new MongooseRepository(Song);
 *   const song = await songRepository.findById(songId);
 */

export class MongooseRepository extends IRepository {
  constructor(model) {
    super();
    if (!model) {
      throw new Error('MongooseRepository requires a Mongoose model');
    }
    this.model = model;
  }

  async create(data) {
    try {
      const doc = new this.model(data);
      return await doc.save();
    } catch (error) {
      throw new Error(`Failed to create ${this.model.modelName}: ${error.message}`);
    }
  }

  async findById(id) {
    try {
      return await this.model.findById(id).lean();
    } catch (error) {
      throw new Error(`Failed to find ${this.model.modelName} by id: ${error.message}`);
    }
  }

  async findByIdWithRelations(id, relations = []) {
    try {
      let query = this.model.findById(id);

      for (const relation of relations) {
        const path = typeof relation === 'string' ? relation : relation.path;
        query = query.populate(path);
      }

      return await query.lean();
    } catch (error) {
      throw new Error(`Failed to find ${this.model.modelName} with relations: ${error.message}`);
    }
  }

  async find(query = {}, options = {}) {
    try {
      let q = this.model.find(query);

      // Apply options
      if (options.sort) {
        q = q.sort(options.sort);
      }
      if (options.limit) {
        q = q.limit(options.limit);
      }
      if (options.skip) {
        q = q.skip(options.skip);
      }

      // Use lean() for performance (read-only queries) unless explicitly disabled
      if (options.lean !== false) {
        q = q.lean();
      }

      return await q.exec();
    } catch (error) {
      throw new Error(`Failed to find ${this.model.modelName}: ${error.message}`);
    }
  }

  async findOne(query) {
    try {
      return await this.model.findOne(query).lean();
    } catch (error) {
      throw new Error(`Failed to find one ${this.model.modelName}: ${error.message}`);
    }
  }

  async updateById(id, data) {
    try {
      const doc = await this.model.findByIdAndUpdate(id, data, {
        returnDocument: 'after',
        runValidators: true,
      });

      if (!doc) {
        throw new Error(`${this.model.modelName} not found`);
      }

      return doc;
    } catch (error) {
      throw new Error(`Failed to update ${this.model.modelName}: ${error.message}`);
    }
  }

  async deleteById(id) {
    try {
      const result = await this.model.findByIdAndDelete(id);
      return !!result;
    } catch (error) {
      throw new Error(`Failed to delete ${this.model.modelName}: ${error.message}`);
    }
  }

  async deleteMany(query) {
    try {
      const result = await this.model.deleteMany(query);
      return result.deletedCount;
    } catch (error) {
      throw new Error(`Failed to delete ${this.model.modelName} documents: ${error.message}`);
    }
  }

  async count(query = {}) {
    try {
      return await this.model.countDocuments(query);
    } catch (error) {
      throw new Error(`Failed to count ${this.model.modelName}: ${error.message}`);
    }
  }

  async exists(query = {}) {
    try {
      const doc = await this.model.findOne(query).lean();
      return !!doc;
    } catch (error) {
      throw new Error(`Failed to check existence: ${error.message}`);
    }
  }
}

export class CurriculumRepository extends MongooseRepository {
  constructor() {
    super(Curriculum);
  }
}

export class StudyProgressRepository extends MongooseRepository {
  constructor() {
    super(StudyProgress);
  }
}

/**
 * UserRepository - Mongoose-backed implementation of IUserRepository.
 *
 * Adds password verify/change on top of the base MongooseRepository CRUD.
 */
export class UserRepository extends IUserRepository {
  constructor(model) {
    super();
    if (!model) {
      throw new Error('UserRepository requires a Mongoose model');
    }
    this.model = model;
  }

  async create(data) {
    try {
      const doc = new this.model(data);
      return await doc.save();
    } catch (error) {
      throw new Error(`Failed to create ${this.model.modelName}: ${error.message}`);
    }
  }

  async findById(id) {
    try {
      return await this.model.findById(id).lean();
    } catch (error) {
      throw new Error(`Failed to find ${this.model.modelName} by id: ${error.message}`);
    }
  }

  async findOne(query) {
    try {
      return await this.model.findOne(query).lean();
    } catch (error) {
      throw new Error(`Failed to find one ${this.model.modelName}: ${error.message}`);
    }
  }

  async updateById(id, data) {
    try {
      const doc = await this.model.findByIdAndUpdate(id, data, {
        returnDocument: 'after',
        runValidators: true,
      });

      if (!doc) {
        throw new Error(`${this.model.modelName} not found`);
      }

      return doc;
    } catch (error) {
      throw new Error(`Failed to update ${this.model.modelName}: ${error.message}`);
    }
  }

  async deleteById(id) {
    try {
      const result = await this.model.findByIdAndDelete(id);
      return !!result;
    } catch (error) {
      throw new Error(`Failed to delete ${this.model.modelName}: ${error.message}`);
    }
  }

  async verifyPassword(entityId, candidatePassword) {
    const doc = await this.model.findById(entityId);
    if (!doc) {
      throw new Error('User not found');
    }

    const isValid = typeof doc.comparePassword === 'function'
      ? await doc.comparePassword(candidatePassword)
      : await bcrypt.compare(candidatePassword, doc.password);

    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    return doc;
  }

  async setPassword(entityId, newPassword) {
    const doc = await this.model.findById(entityId);
    if (!doc) {
      throw new Error('User not found');
    }

    doc.password = newPassword;
    return await doc.save();
  }
}

export class MongooseUserRepository extends UserRepository {
  constructor() {
    super(User);
  }
}

