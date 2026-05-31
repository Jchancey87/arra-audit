import mongoose from 'mongoose';

const tasteProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    lens: {
      type: String,
      enum: ['rhythm', 'texture', 'harmony', 'arrangement'],
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    summary: {
      type: String,
      default: '',
    },
    sources: [
      {
        title: { type: String, default: '' },
        url: { type: String, default: '' },
        content: { type: String, default: '' },
      }
    ],
  },
  { timestamps: true }
);

// Prevent duplicate profiles for the same user, lens, and artist name
tasteProfileSchema.index({ userId: 1, lens: 1, name: 1 }, { unique: true });

export default mongoose.model('TasteProfile', tasteProfileSchema);
