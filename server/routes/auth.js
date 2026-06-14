import express from 'express';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import { authMiddleware } from '../middleware/auth.js';

export default function createAuthRoutes(authService) {
  const router = express.Router();

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many auth attempts, please try again later.' },
  });

  const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  };

  // Register
  router.post('/register', authLimiter, [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ], handleValidationErrors, async (req, res) => {
    try {
      const result = await authService.register(req.body);

      res.status(201).json(result);
    } catch (err) {
      console.error('Register error:', err);
      res.status(400).json({ error: err.message });
    }
  });

  // Login
  router.post('/login', authLimiter, [
    body('email').notEmpty().trim().withMessage('Email required'),
    body('password').notEmpty().withMessage('Password required'),
  ], handleValidationErrors, async (req, res) => {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);

      res.json(result);
    } catch (err) {
      console.error('Login error:', err);
      res.status(401).json({ error: err.message });
    }
  });

  // Get current user profile
  router.get('/me', authMiddleware, async (req, res) => {
    try {
      const result = await authService.getProfile(req.userId);
      res.json(result);
    } catch (err) {
      console.error('Get profile error:', err);
      res.status(400).json({ error: err.message });
    }
  });

  // Update user preferences
  router.put('/preferences', authMiddleware, async (req, res) => {
    try {
      const result = await authService.updatePreferences(req.userId, req.body);
      res.json(result);
    } catch (err) {
      console.error('Update preferences error:', err);
      res.status(400).json({ error: err.message });
    }
  });

  // Update profile info (name)
  router.put('/profile', authMiddleware, async (req, res) => {
    try {
      const result = await authService.updateProfile(req.userId, req.body);
      res.json(result);
    } catch (err) {
      console.error('Update profile error:', err);
      res.status(400).json({ error: err.message });
    }
  });

  // Change password
  router.put('/change-password', authMiddleware, async (req, res) => {
    try {
      const { oldPassword, newPassword } = req.body;
      const result = await authService.changePassword(req.userId, oldPassword, newPassword);
      res.json({ success: result });
    } catch (err) {
      console.error('Change password error:', err);
      res.status(400).json({ error: err.message });
    }
  });

  // Delete account
  router.delete('/delete-account', authMiddleware, async (req, res) => {
    try {
      const result = await authService.deleteAccount(req.userId);
      res.json({ success: result });
    } catch (err) {
      console.error('Delete account error:', err);
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}

