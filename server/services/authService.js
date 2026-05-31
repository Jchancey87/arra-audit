import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

export class AuthService {
  constructor(userRepository) {
    this.userRepository = userRepository;
    this.secret = process.env.JWT_SECRET || 'your-secret';
  }

  async register(data) {
    const { email, password, name } = data;

    if (!email || !password) {
      throw new Error('Email and password required');
    }

    const existingUser = await this.userRepository.findOne({ email });
    if (existingUser) {
      throw new Error('User already exists');
    }

    // Create user - password hashing is handled by Mongoose pre-save middleware
    const user = await this.userRepository.create({ email, password, name });
    
    const token = this.generateToken(user._id);

    return {
      token,
      user: { id: user._id, email: user.email, name: user.name, preferences: user.preferences },
    };
  }

  async login(email, password) {
    if (!email || !password) {
      throw new Error('Email and password required');
    }

    // Find user by email
    // We need to ensure we get the password field
    const user = await this.userRepository.findOne({ email });
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Compare password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    const token = this.generateToken(user._id);

    return {
      token,
      user: { id: user._id, email: user.email, name: user.name, preferences: user.preferences },
    };
  }

  generateToken(userId) {
    return jwt.sign({ userId }, this.secret, { expiresIn: '7d' });
  }

  async getProfile(userId) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return {
      id: user._id,
      email: user.email,
      name: user.name,
      displayName: user.displayName,
      preferences: user.preferences || {
        defaultWorkflow: 'quick',
        preferredLenses: [],
        timezone: 'UTC',
        tastes: {
          rhythm: 'Jamerson, Radiohead',
          texture: 'Flaming Lips, Pink Floyd',
          harmony: 'Jimmy Webb, Beach Boys, Radiohead',
          arrangement: 'Jimmy Webb, Beach Boys, Pink Floyd, Radiohead'
        }
      }
    };
  }

  async updatePreferences(userId, preferences) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    const updatedPrefs = {
      ...user.preferences,
      ...preferences
    };
    const updatedUser = await this.userRepository.updateById(userId, { preferences: updatedPrefs });
    return updatedUser.preferences;
  }

  async updateProfile(userId, { name }) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    const updatedUser = await this.userRepository.updateById(userId, { name, displayName: name });
    return {
      id: updatedUser._id,
      email: updatedUser.email,
      name: updatedUser.name,
      displayName: updatedUser.displayName,
      preferences: updatedUser.preferences
    };
  }

  async changePassword(userId, oldPassword, newPassword) {
    if (this.userRepository.model) {
      // Production path (Mongoose)
      const userDoc = await this.userRepository.model.findById(userId);
      if (!userDoc) {
        throw new Error('User not found');
      }
      const isValid = await bcrypt.compare(oldPassword, userDoc.password);
      if (!isValid) {
        throw new Error('Invalid credentials');
      }
      userDoc.password = newPassword;
      await userDoc.save();
    } else {
      // Test/In-Memory path
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      const isValid = await bcrypt.compare(oldPassword, user.password);
      if (!isValid) {
        throw new Error('Invalid credentials');
      }
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      await this.userRepository.updateById(userId, { password: hashedPassword });
    }
    return true;
  }

  async deleteAccount(userId) {
    const deleted = await this.userRepository.deleteById(userId);
    return deleted;
  }
}
