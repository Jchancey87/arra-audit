// SongSketch — uploaded DAW sketch for A/B compare against a reference Song.
// Soft-deleted via `deletedAt`. `analysis` mirrors the Song.audioAnalysis Mixed
// payload produced by analysis_service.analyzer.analyze_audio_file.

import mongoose from 'mongoose';

const songSketchSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    songId: { type: mongoose.Schema.Types.ObjectId, ref: 'Song', required: true },
    title: { type: String, default: '' },
    fileName: { type: String, required: true },
    originalName: { type: String, default: '' },
    filePath: { type: String, required: true },
    publicUrl: { type: String, default: '' },
    mimeType: { type: String, default: '' },
    sizeBytes: { type: Number, default: 0 },
    durationSeconds: { type: Number, default: null },
    analysis: { type: mongoose.Schema.Types.Mixed, default: null },
    analysisStatus: {
      type: String,
      enum: ['not_started', 'pending', 'success', 'failed'],
      default: 'not_started',
    },
    analysisError: { type: String, default: null },
    notes: { type: String, default: '' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

songSketchSchema.index({ userId: 1, songId: 1, deletedAt: 1, createdAt: -1 });
songSketchSchema.index({ userId: 1, deletedAt: 1, createdAt: -1 });

export default mongoose.model('SongSketch', songSketchSchema);
