import mongoose from 'mongoose';

const songSchema = new mongoose.Schema(
  {
    // Source identification
    sourceType: {
      type: String,
      enum: ['youtube'],
      default: 'youtube',
      required: true,
    },
    sourceId: {
      type: String,
      required: true,
    },
    // Keep youtubeId as alias pointing to sourceId for backward compat
    youtubeId: {
      type: String,
    },
    originalUrl: {
      type: String,
    },
    // Keep youtubeUrl as alias for backward compat
    youtubeUrl: {
      type: String,
    },

    // Metadata
    title: {
      type: String,
      required: true,
    },
    artistName: {
      type: String,
    },
    // Keep artist as alias for backward compat
    artist: {
      type: String,
    },
    channelTitle: {
      type: String,
    },
    thumbnailUrl: {
      type: String,
    },
    // Keep thumbnail as alias for backward compat
    thumbnail: {
      type: String,
    },
    durationSeconds: {
      type: Number,
    },
    publishedAt: {
      type: Date,
    },

    // Import / research status
    metadataFetchStatus: {
      type: String,
      enum: ['pending', 'success', 'failed'],
      default: 'pending',
    },
    researchStatus: {
      type: String,
      enum: ['pending', 'success', 'failed', 'skipped'],
      default: 'pending',
    },
    researchSummary: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    researchSources: {
      type: [String],
      default: [],
    },
    audioAnalysisStatus: {
      type: String,
      enum: ['not_started', 'pending', 'success', 'failed'],
      default: 'not_started',
    },
    audioAnalysis: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    audioOverrides: {
      type: {
        tempo_bpm: Number,
        key: String,
        scale: String,
        estimated_meter: String,
      },
      default: null,
    },
    importErrors: {
      type: [String],
      default: [],
    },

    // Ownership
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Soft delete
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Primary deduplication index: one active record per (user, source type, source ID)
// partialFilterExpression means soft-deleted songs are excluded from uniqueness enforcement
songSchema.index(
  { userId: 1, sourceType: 1, sourceId: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);
// Fast lookups for active (non-deleted) songs
songSchema.index({ userId: 1, deletedAt: 1, createdAt: -1 });

export default mongoose.model('Song', songSchema);
