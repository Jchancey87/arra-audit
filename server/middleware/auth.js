import jwt from 'jsonwebtoken';

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
};

export const authMiddleware = (req, res, next) => {
  // Phase 2.3 v2: EventSource can't send custom headers, so the SSE
  // endpoint passes the JWT in a `?token=` query param. We accept either
  // form, header first (preferred), query as fallback for SSE.
  let token = req.headers.authorization?.split(' ')[1];
  if (!token && typeof req.query?.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
