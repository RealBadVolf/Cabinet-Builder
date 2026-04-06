import jwt from 'jsonwebtoken';
import { queryOne } from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production';

// Attach user if token present, but don't require it
export function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) { req.user = null; return next(); }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    req.user = payload;
  } catch { req.user = null; }
  next();
}

// Require valid token (supports Bearer header OR ?token= query for downloads)
export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  let token = null;

  if (header?.startsWith('Bearer ')) {
    token = header.slice(7);
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token)
    return res.status(401).json({ error: 'Authentication required' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Require specific roles
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!roles.includes(req.user.role))
      return res.status(403).json({ error: 'Insufficient permissions' });
    next();
  };
}

// Check resource ownership (user owns it, or admin/manager)
export function ownerOrManager(userIdField = 'user_id') {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (['admin', 'manager'].includes(req.user.role)) return next();
    // Will be checked in route after fetching resource
    req.checkOwnership = true;
    req.ownerField = userIdField;
    next();
  };
}

export function signAccessToken(user) {
  return jwt.sign(
    { userId: user.user_id, email: user.email, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

export function signRefreshToken(user) {
  return jwt.sign(
    { userId: user.user_id, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}
