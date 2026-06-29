import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../db.js';
import { requireAuth, sanitizeUser, AuthRequest } from '../middleware/auth.js';

const router = Router();
const SESSION_DAYS = 30;
const BCRYPT_ROUNDS = 12;

function createSession(userId: number): string {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);

  db.prepare(`
    INSERT INTO sessions (token, user_id, expires_at)
    VALUES (?, ?, ?)
  `).run(token, userId, expiresAt.toISOString());

  return token;
}

function validateUsername(username: string): string | null {
  const trimmed = username.trim();
  if (trimmed.length < 3) return 'Username must be at least 3 characters.';
  if (trimmed.length > 30) return 'Username must be at most 30 characters.';
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
    return 'Username may only contain letters, numbers, and underscores.';
  }
  return null;
}

function validatePassword(password: string): string | null {
  if (password.length < 6) return 'Password must be at least 6 characters.';
  if (password.length > 128) return 'Password must be at most 128 characters.';
  return null;
}

router.post('/register', async (req, res) => {
  try {
    const { fullName, username, email, password, confirmPassword } = req.body ?? {};

    if (!fullName?.trim()) {
      return res.status(400).json({ error: 'Full name is required.' });
    }

    const usernameError = validateUsername(username ?? '');
    if (usernameError) {
      return res.status(400).json({ error: usernameError, field: 'username' });
    }

    const passwordError = validatePassword(password ?? '');
    if (passwordError) {
      return res.status(400).json({ error: passwordError, field: 'password' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.', field: 'confirmPassword' });
    }

    const normalizedUsername = username.trim();
    const existing = db.prepare(
      'SELECT id FROM users WHERE username = ? COLLATE NOCASE'
    ).get(normalizedUsername);

    if (existing) {
      return res.status(409).json({
        error: 'This username is already taken. Please choose another.',
        field: 'username',
      });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const result = db.prepare(`
      INSERT INTO users (full_name, username, email, password_hash)
      VALUES (?, ?, ?, ?)
    `).run(
      fullName.trim(),
      normalizedUsername,
      email?.trim() || null,
      passwordHash
    );

    const userId = Number(result.lastInsertRowid);
    const token = createSession(userId);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as unknown as import('../db.js').DbUser;
    res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body ?? {};

    if (!username?.trim() || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const user = db.prepare(
      'SELECT * FROM users WHERE username = ? COLLATE NOCASE'
    ).get(username.trim()) as unknown as import('../db.js').DbUser | undefined;

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const token = createSession(user.id);
    res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

router.post('/logout', requireAuth, (req: AuthRequest, res) => {
  const header = req.headers.authorization;
  const token = header?.slice(7);
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  res.json({ success: true });
});

router.get('/me', requireAuth, (req: AuthRequest, res) => {
  res.json({ user: sanitizeUser(req.user!) });
});

router.get('/check-username', (req, res) => {
  const username = String(req.query.username ?? '').trim();
  if (!username) {
    return res.json({ available: false, error: 'Username is required.' });
  }

  const usernameError = validateUsername(username);
  if (usernameError) {
    return res.json({ available: false, error: usernameError });
  }

  const existing = db.prepare(
    'SELECT id FROM users WHERE username = ? COLLATE NOCASE'
  ).get(username);

  res.json({ available: !existing });
});

export default router;
