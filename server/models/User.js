import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const tastesSchema = new mongoose.Schema(
  {
    rhythm: { type: String, default: 'Jamerson, Radiohead' },
    texture: { type: String, default: 'Flaming Lips, Pink Floyd' },
    harmony: { type: String, default: 'Jimmy Webb, Beach Boys, Radiohead' },
    arrangement: { type: String, default: 'Jimmy Webb, Beach Boys, Pink Floyd, Radiohead' },
  },
  { _id: false }
);

const preferencesSchema = new mongoose.Schema(
  {
    defaultWorkflow: {
      type: String,
      enum: ['quick', 'guided'],
      default: 'quick',
    },
    preferredLenses: {
      type: [String],
      default: [],
    },
    timezone: {
      type: String,
      default: 'UTC',
    },
    tastes: {
      type: tastesSchema,
      default: () => ({}),
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    // Display name shown in UI
    displayName: {
      type: String,
      trim: true,
    },
    // Legacy field kept for backwards compat during transition
    name: {
      type: String,
      trim: true,
    },
    preferences: {
      type: preferencesSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', userSchema);
