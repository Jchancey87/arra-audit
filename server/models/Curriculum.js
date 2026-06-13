import mongoose from 'mongoose';

const daySchema = new mongoose.Schema({
  dayNumber: { type: Number, required: true },
  lens: { 
    type: String, 
    enum: ['harmony', 'rhythm', 'texture', 'form', 'arrangement'], 
    required: true 
  },
  songQuery: { type: String, required: true },     // Search recommendation for YouTube
  songTitle: { type: String, required: true },     // Target song title
  artistName: { type: String, required: true },    // Target artist
  listeningPrompt: { type: String, required: true },
  applicationPrompt: { type: String, required: true },
  logFields: [{
    key: { type: String, required: true },       // e.g., "harmonic_surprises"
    label: { type: String, required: true },     // e.g., "Harmonic surprises"
    fieldType: { type: String, enum: ['text', 'textarea'], default: 'textarea' }
  }]
});

const curriculumSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String },
  audience: { type: String },
  focusAreas: [{ type: String }],
  durationWeeks: { type: Number, default: 1 }, // 7 days = 1 week, 14 days = 2 weeks
  days: [daySchema],
  creatorType: { type: String, enum: ['system', 'ai'], default: 'system' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null } // Associated with user if AI-generated
}, { timestamps: true });

// Add fast lookup index for queries by user and creation type
curriculumSchema.index({ userId: 1, creatorType: 1 });

export default mongoose.model('Curriculum', curriculumSchema);
