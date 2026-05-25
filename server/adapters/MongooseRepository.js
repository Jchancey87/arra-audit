import { IRepository } from '../ports/IRepository.js';

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
