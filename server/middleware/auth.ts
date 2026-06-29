import { Request, Response, NextFunction } from 'express';
import { db, DbUser } from '../db.js';

export interface AuthRequest extends Request {
  user?: DbUser;
  userId?: number;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const token = header.slice(7);
  const session = db.prepare(`
    SELECT s.token, s.user_id, s.expires_at, u.id, u.full_name, u.username, u.email, u.password_hash, u.created_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ?
  `).get(token) as unknown as SessionWithUser | undefined;

  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session.' });
  }

  if (new Date(session.expires_at) < new Date()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }

  req.userId = session.user_id;
  req.user = {
    id: session.id,
    full_name: session.full_name,
    username: session.username,
    email: session.email,
    password_hash: session.password_hash,
    created_at: session.created_at,
  };
  next();
}

interface SessionWithUser {
  token: string;
  user_id: number;
  expires_at: string;
  id: number;
  full_name: string;
  username: string;
  email: string | null;
  password_hash: string;
  created_at: string;
}

export function sanitizeUser(user: DbUser) {
  return {
    id: user.id,
    fullName: user.full_name,
    username: user.username,
    email: user.email,
    createdAt: user.created_at,
  };
}
