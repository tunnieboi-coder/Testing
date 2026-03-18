import { Router } from 'express';
import db from '../db';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.get('/', (req, res) => {
  const { category, status, search } = req.query as Record<string, string>;
  let query = 'SELECT * FROM risks WHERE 1=1';
  const params: unknown[] = [];
  if (category) { query += ' AND category = ?'; params.push(category); }
  if (status) { query += ' AND status = ?'; params.push(status); }
  if (search) { query += ' AND (title LIKE ? OR description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  query += ' ORDER BY risk_score DESC, created_at DESC';
  const risks = db.prepare(query).all(...params);
  res.json(risks);
});

router.post('/', (req, res) => {
  const { title, description, category, likelihood, impact, owner, treatment, treatment_notes, due_date } = req.body;
  const id = uuidv4();
  db.prepare(`INSERT INTO risks (id, title, description, category, likelihood, impact, owner, treatment, treatment_notes, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, title, description, category, likelihood, impact, owner, treatment, treatment_notes, due_date
  );
  res.json(db.prepare('SELECT * FROM risks WHERE id = ?').get(id));
});

router.get('/:id', (req, res) => {
  const risk = db.prepare('SELECT * FROM risks WHERE id = ?').get(req.params.id);
  if (!risk) return res.status(404).json({ error: 'Not found' });
  const controls = db.prepare(`SELECT c.id, c.identifier, c.title, c.status FROM controls c JOIN control_risks cr ON cr.control_id = c.id WHERE cr.risk_id = ?`).all(req.params.id);
  res.json({ ...risk as object, controls });
});

router.patch('/:id', (req, res) => {
  const fields = ['title', 'description', 'category', 'likelihood', 'impact', 'status', 'owner', 'treatment', 'treatment_notes', 'residual_likelihood', 'residual_impact', 'due_date'];
  const updates: Record<string, unknown> = {};
  for (const f of fields) {
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No fields' });
  const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE risks SET ${sets}, updated_at = datetime('now') WHERE id = ?`).run(...Object.values(updates), req.params.id);

  // Record risk snapshot
  const today = new Date().toISOString().split('T')[0];
  const existing = db.prepare('SELECT id FROM risk_snapshots WHERE snapshot_date = ?').get(today);
  if (!existing) {
    const critical = (db.prepare("SELECT COUNT(*) as c FROM risks WHERE risk_score >= 20 AND status != 'closed'").get() as { c: number }).c;
    const high = (db.prepare("SELECT COUNT(*) as c FROM risks WHERE risk_score >= 15 AND risk_score < 20 AND status != 'closed'").get() as { c: number }).c;
    const medium = (db.prepare("SELECT COUNT(*) as c FROM risks WHERE risk_score >= 9 AND risk_score < 15 AND status != 'closed'").get() as { c: number }).c;
    const low = (db.prepare("SELECT COUNT(*) as c FROM risks WHERE risk_score < 9 AND status != 'closed'").get() as { c: number }).c;
    const total = critical + high + medium + low;
    const avg = total > 0 ? (critical * 22.5 + high * 17 + medium * 11 + low * 5) / total : 0;
    db.prepare('INSERT INTO risk_snapshots (id, snapshot_date, critical_count, high_count, medium_count, low_count, total_open, avg_risk_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(uuidv4(), today, critical, high, medium, low, total, Math.round(avg * 10) / 10);
  }

  res.json(db.prepare('SELECT * FROM risks WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM control_risks WHERE risk_id = ?').run(req.params.id);
  db.prepare('DELETE FROM risks WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
