import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

interface TaskRow {
  id: string;
  user_id: number;
  project_id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  due_date: string;
  subtasks: string;
  created_at: string;
  updated_at: string;
}

function mapTask(row: TaskRow) {
  let subtasks = [];
  try {
    subtasks = JSON.parse(row.subtasks);
  } catch {
    subtasks = [];
  }
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date,
    subtasks,
    ownerId: String(row.user_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function verifyProjectOwnership(projectId: string, userId: number): boolean {
  const project = db.prepare(
    'SELECT id FROM projects WHERE id = ? AND user_id = ?'
  ).get(projectId, userId);
  return !!project;
}

router.get('/', (req: AuthRequest, res) => {
  const rows = db.prepare(
    'SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC'
  ).all(req.userId!) as unknown as TaskRow[];
  res.json(rows.map(mapTask));
});

router.post('/', (req: AuthRequest, res) => {
  const { projectId, title, description, priority, dueDate, subtasks } = req.body ?? {};

  if (!title?.trim() || !projectId) {
    return res.status(400).json({ error: 'Title and list are required.' });
  }

  if (!verifyProjectOwnership(projectId, req.userId!)) {
    return res.status(403).json({ error: 'Invalid list for this user.' });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO tasks (id, user_id, project_id, title, description, status, priority, due_date, subtasks, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)
  `).run(
    id,
    req.userId!,
    projectId,
    title.trim(),
    description ?? '',
    priority || 'medium',
    dueDate ?? '',
    JSON.stringify(subtasks ?? []),
    now,
    now
  );

  const row = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(id, req.userId!) as unknown as TaskRow;
  res.status(201).json(mapTask(row));
});

router.put('/:id', (req: AuthRequest, res) => {
  const existing = db.prepare(
    'SELECT * FROM tasks WHERE id = ? AND user_id = ?'
  ).get(req.params.id, req.userId!) as unknown as TaskRow | undefined;

  if (!existing) {
    return res.status(404).json({ error: 'Task not found.' });
  }

  const { projectId, title, description, status, priority, dueDate, subtasks } = req.body ?? {};

  if (projectId && !verifyProjectOwnership(projectId, req.userId!)) {
    return res.status(403).json({ error: 'Invalid list for this user.' });
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE tasks SET
      project_id = ?,
      title = ?,
      description = ?,
      status = ?,
      priority = ?,
      due_date = ?,
      subtasks = ?,
      updated_at = ?
    WHERE id = ? AND user_id = ?
  `).run(
    projectId ?? existing.project_id,
    title?.trim() ?? existing.title,
    description ?? existing.description,
    status ?? existing.status,
    priority ?? existing.priority,
    dueDate ?? existing.due_date,
    JSON.stringify(subtasks ?? JSON.parse(existing.subtasks)),
    now,
    req.params.id,
    req.userId!
  );

  const row = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(req.params.id, req.userId!) as unknown as TaskRow;
  res.json(mapTask(row));
});

router.delete('/:id', (req: AuthRequest, res) => {
  const result = db.prepare(
    'DELETE FROM tasks WHERE id = ? AND user_id = ?'
  ).run(req.params.id, req.userId!);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Task not found.' });
  }
  res.json({ success: true });
});

export default router;
