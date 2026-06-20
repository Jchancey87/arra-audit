import mongoose from 'mongoose';

// ── Bookmark sub-document ──────────────────────────────────────────────────
const bookmarkAnalysisSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['pending', 'running', 'success', 'error', 'skipped'],
      default: 'pending',
    },
    model: { type: String, default: null },
    version: { type: String, default: null },
    mood_tags: { type: [mongoose.Schema.Types.Mixed], default: [] },
    timbre_tags: { type: [mongoose.Schema.Types.Mixed], default: [] },
    similar_to: { type: [String], default: [] },
    error: { type: String, default: null },
    computedAt: { type: Date, default: null },
  },
  { _id: false }
);

const bookmarkSchema = new mongoose.Schema(
  {
    timestampSeconds: {
      type: Number,
      required: true,
      min: 0,
    },
    label: {
      type: String,
      trim: true,
      default: '',
    },
    note: {
      type: String,
      default: '',
    },
    lens: {
      type: String,
      enum: ['rhythm', 'texture', 'harmony', 'arrangement', null],
      default: null,
    },
    // Phase 2.3: per-bookmark CLAP analysis. `null` means "not yet
    // requested" (older bookmarks). `status: 'pending'` is set the
    // moment the service enqueues the job.
    analysis: {
      type: bookmarkAnalysisSchema,
      default: null,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// ── Guided step sub-document ───────────────────────────────────────────────
// Steps in order: Listen → Sketch → Translate → Recreate → Log
const GUIDED_STEPS = [
  { stepNumber: 1, name: 'Listen',    instructions: 'First full listen — no notes. Just absorb the track. Notice what stands out emotionally and sonically.' },
  { stepNumber: 2, name: 'Sketch',    instructions: 'Quick raw impressions. Mark any bookmarks on moments that surprise you. Free-write for 2 minutes.' },
  { stepNumber: 3, name: 'Translate', instructions: 'Answer the lens questions. Put techniques into your own vocabulary.' },
  { stepNumber: 4, name: 'Recreate',  instructions: 'Attempt to recreate or transcribe a key element. Even partial attempts reveal the structure.' },
  { stepNumber: 5, name: 'Log',       instructions: 'Capture techniques to your notebook. Be specific: artist, tool, and why it works.' },
];

const guidedStepSchema = new mongoose.Schema(
  {
    stepNumber: { type: Number, required: true },
    name:       { type: String, required: true },
    instructions: { type: String },
    status: {
      type: String,
      enum: ['pending', 'active', 'complete', 'skipped'],
      default: 'pending',
    },
    notes:       { type: String, default: '' },
    skipped:     { type: Boolean, default: false },
    startedAt:   { type: Date },
    completedAt: { type: Date },
  },
  { _id: true }
);

// ── Audit schema ──────────────────────────────────────────────────────────
const auditSchema = new mongoose.Schema(
  {
    songId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Song',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Human-readable label (auto-generated if not provided)
    title: {
      type: String,
      default: '',
    },

    // Lenses selected for this audit
    lensSelection: {
      type: [String],
      enum: ['rhythm', 'texture', 'harmony', 'arrangement'],
      required: true,
    },

    // Workflow
    workflowType: {
      type: String,
      enum: ['quick', 'guided'],
      default: 'quick',
    },

    // Template — generated once at creation, stored permanently
    templateQuestions: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    templateVersion: {
      type: String,
      default: null,
    },
    modelUsed: {
      type: String,
      default: null,
    },
    promptVersion: {
      type: String,
      default: 'v1',
    },

    // Answers / responses
    responses: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Bookmarks
    bookmarks: {
      type: [bookmarkSchema],
      default: [],
    },

    // Inline technique log (lightweight; also synced to TechniqueEntry collection)
    techniques: [
      {
        description: String,
        lens: {
          type: String,
          enum: ['rhythm', 'texture', 'harmony', 'arrangement'],
        },
        exampleTimestamp: Number,
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // Guided mode steps
    guidedSteps: {
      type: [guidedStepSchema],
      default: [],
    },

    // Status
    status: {
      type: String,
      enum: ['draft', 'completed', 'archived'],
      default: 'draft',
    },
    completedAt: {
      type: Date,
      default: null,
    },

    // Soft delete
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Fast lookup indexes
auditSchema.index({ userId: 1, songId: 1, deletedAt: 1 });
auditSchema.index({ userId: 1, deletedAt: 1, createdAt: -1 });

// Export step definitions for use in service layer
auditSchema.statics.GUIDED_STEPS = GUIDED_STEPS;

export default mongoose.model('Audit', auditSchema);
export { GUIDED_STEPS };
