import { Router } from 'express';
import crypto from 'crypto';
import { db, runTransaction } from '../db.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

function mapProject(row: ProjectRow) {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    ownerId: String(row.user_id),
    createdAt: row.created_at,
  };
}

interface ProjectRow {
  id: string;
  user_id: number;
  name: string;
  color: string;
  created_at: string;
}

function ensureDefaultInbox(userId: number) {
  const count = db.prepare('SELECT COUNT(*) as c FROM projects WHERE user_id = ?').get(userId) as { c: number };
  if (count.c === 0) {
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO projects (id, user_id, name, color)
      VALUES (?, ?, 'Inbox', 'indigo')
    `).run(id, userId);
  }
}

router.get('/', (req: AuthRequest, res) => {
  ensureDefaultInbox(req.userId!);
  const rows = db.prepare(
    'SELECT * FROM projects WHERE user_id = ? ORDER BY created_at ASC'
  ).all(req.userId!) as unknown as ProjectRow[];
  res.json(rows.map(mapProject));
});

router.post('/', (req: AuthRequest, res) => {
  const { name, color } = req.body ?? {};
  if (!name?.trim()) {
    return res.status(400).json({ error: 'List name is required.' });
  }

  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO projects (id, user_id, name, color)
    VALUES (?, ?, ?, ?)
  `).run(id, req.userId!, name.trim(), color || 'indigo');

  const row = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(id, req.userId!) as unknown as ProjectRow;
  res.status(201).json(mapProject(row));
});

router.delete('/:id', (req: AuthRequest, res) => {
  const project = db.prepare(
    'SELECT * FROM projects WHERE id = ? AND user_id = ?'
  ).get(req.params.id, req.userId!) as unknown as ProjectRow | undefined;

  if (!project) {
    return res.status(404).json({ error: 'List not found.' });
  }

  if (project.name === 'Inbox') {
    return res.status(400).json({ error: 'The Inbox list cannot be deleted.' });
  }

  runTransaction(() => {
    db.prepare('DELETE FROM tasks WHERE project_id = ? AND user_id = ?').run(project.id, req.userId!);
    db.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?').run(project.id, req.userId!);
  });

  res.json({ success: true });
});

export default router;
