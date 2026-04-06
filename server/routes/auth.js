import { Router } from 'express';
import bcrypt from 'bcrypt';
import { query, queryOne } from '../db.js';
import { requireAuth, requireRole, signAccessToken, signRefreshToken } from '../middleware/auth.js';

const router = Router();

// ─── Register ────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { email, username, password, firstName, lastName } = req.body;
    if (!email || !username || !password)
      return res.status(400).json({ error: 'Email, username, and password required' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const exists = await queryOne(
      'SELECT user_id FROM users WHERE email = ? OR username = ?', [email, username]
    );
    if (exists) return res.status(409).json({ error: 'Email or username already taken' });

    const hash = await bcrypt.hash(password, 12);
    const result = await query(
      `INSERT INTO users (email, username, password_hash, first_name, last_name)
       VALUES (?, ?, ?, ?, ?)`,
      [email, username, hash, firstName || null, lastName || null]
    );

    const user = await queryOne('SELECT * FROM users WHERE user_id = ?', [result.insertId]);
    const token = signAccessToken(user);
    const refresh = signRefreshToken(user);

    res.status(201).json({
      token, refresh,
      user: { userId: user.user_id, email: user.email, username: user.username,
              firstName: user.first_name, lastName: user.last_name, role: user.role }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ─── Login ───────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body;  // login = email or username
    if (!login || !password)
      return res.status(400).json({ error: 'Login and password required' });

    const user = await queryOne(
      'SELECT * FROM users WHERE (email = ? OR username = ?) AND is_active = TRUE',
      [login, login]
    );
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    await query('UPDATE users SET last_login_at = NOW() WHERE user_id = ?', [user.user_id]);

    const token = signAccessToken(user);
    const refresh = signRefreshToken(user);

    res.json({
      token, refresh,
      user: { userId: user.user_id, email: user.email, username: user.username,
              firstName: user.first_name, lastName: user.last_name, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ─── Get current user ────────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  const user = await queryOne(
    'SELECT user_id, email, username, first_name, last_name, role, created_at FROM users WHERE user_id = ?',
    [req.user.userId]
  );
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ userId: user.user_id, email: user.email, username: user.username,
             firstName: user.first_name, lastName: user.last_name, role: user.role });
});

// ─── Admin: list users ───────────────────────────────────────────────────────
router.get('/users', requireAuth, requireRole('admin'), async (req, res) => {
  const users = await query(
    `SELECT user_id, email, username, first_name, last_name, role, is_active,
            last_login_at, created_at
     FROM users ORDER BY created_at DESC`
  );
  res.json(users);
});

// ─── Admin: update user role ─────────────────────────────────────────────────
router.put('/users/:id/role', requireAuth, requireRole('admin'), async (req, res) => {
  const { role } = req.body;
  if (!['admin', 'manager', 'user'].includes(role))
    return res.status(400).json({ error: 'Invalid role' });
  await query('UPDATE users SET role = ? WHERE user_id = ?', [role, req.params.id]);
  res.json({ success: true });
});

// ─── Admin: toggle user active ───────────────────────────────────────────────
router.put('/users/:id/active', requireAuth, requireRole('admin'), async (req, res) => {
  const { active } = req.body;
  await query('UPDATE users SET is_active = ? WHERE user_id = ?', [!!active, req.params.id]);
  res.json({ success: true });
});

export default router;
