import mongoose from 'mongoose';

const dailyResponseSchema = new mongoose.Schema({
  dayNumber: { type: Number, required: true },
  songId: { type: mongoose.Schema.Types.ObjectId, ref: 'Song', default: null },
  auditId: { type: mongoose.Schema.Types.ObjectId, ref: 'Audit', default: null },
  responses: { type: mongoose.Schema.Types.Mixed, default: {} }, // Key-value matching logFields keys
  audioFilePath: { type: String, default: null },                  // Uploaded DAW sketch URL/path
  audioOriginalName: { type: String, default: null },             // Uploaded filename
  status: { type: String, enum: ['pending', 'active', 'completed'], default: 'pending' },
  completedAt: { type: Date, default: null }
});

const weeklyReviewSchema = new mongoose.Schema({
  weekNumber: { type: Number, required: true },
  changedInEars: { type: String, default: '' },
  notUnderstood: { type: String, default: '' },
  nextInvestigationQuestion: { type: String, default: '' },
  completedAt: { type: Date, default: null }
});

const studyProgressSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  curriculumId: { type: mongoose.Schema.Types.ObjectId, ref: 'Curriculum', required: true },
  currentDay: { type: Number, default: 1 },
  dayProgress: [dailyResponseSchema],
  weeklyReviews: [weeklyReviewSchema],
  status: { type: String, enum: ['active', 'completed', 'paused'], default: 'active' }
}, { timestamps: true });

// A user can only have one active/completed progress document per curriculum
studyProgressSchema.index({ userId: 1, curriculumId: 1 }, { unique: true });
// Fast query for listing active or completed curricula for a user
studyProgressSchema.index({ userId: 1, status: 1 });

export default mongoose.model('StudyProgress', studyProgressSchema);
