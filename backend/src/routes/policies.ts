import { Router } from 'express';
import db from '../db';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.get('/', (req, res) => {
  const { category, status, search } = req.query as Record<string, string>;
  let query = 'SELECT * FROM policies WHERE 1=1';
  const params: unknown[] = [];
  if (category) { query += ' AND category = ?'; params.push(category); }
  if (status) { query += ' AND status = ?'; params.push(status); }
  if (search) { query += ' AND (title LIKE ? OR description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  query += ' ORDER BY category, title';
  res.json(db.prepare(query).all(...params));
});

router.post('/', (req, res) => {
  const id = uuidv4();
  const { title, description, category, status, version, owner, approver, content, review_frequency } = req.body;
  const nextReview = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(`INSERT INTO policies (id, title, description, category, status, version, owner, approver, content, review_frequency, next_review_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, title, description, category, status || 'draft', version || '1.0', owner, approver, content, review_frequency || 'annual', nextReview
  );
  res.json(db.prepare('SELECT * FROM policies WHERE id = ?').get(id));
});

router.get('/:id', (req, res) => {
  const policy = db.prepare('SELECT * FROM policies WHERE id = ?').get(req.params.id);
  if (!policy) return res.status(404).json({ error: 'Not found' });
  res.json(policy);
});

router.patch('/:id', (req, res) => {
  const fields = ['title', 'description', 'category', 'status', 'version', 'owner', 'approver', 'content', 'review_frequency', 'last_reviewed_at', 'next_review_at', 'published_at'];
  const updates: Record<string, unknown> = {};
  for (const f of fields) {
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  }
  if (req.body.status === 'published' && !updates.published_at) {
    updates.published_at = new Date().toISOString();
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No fields' });
  const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE policies SET ${sets}, updated_at = datetime('now') WHERE id = ?`).run(...Object.values(updates), req.params.id);
  res.json(db.prepare('SELECT * FROM policies WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM policies WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
