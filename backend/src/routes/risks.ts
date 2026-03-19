import { Router } from 'express';
import db from '../db';
import { v4 as uuidv4 } from 'uuid';
import { validate } from '../middleware/validate';
import { CreateRiskSchema, UpdateRiskSchema } from '../schemas';
import { getBusinessMultiplier } from '../lib/businessMultiplier';
import { logChange, logFieldChanges } from '../lib/changeLog';
import { requirePermission } from '../middleware/auth';

const router = Router();

function withEffectiveScore(risk: Record<string, unknown>, multiplier: number) {
  const base = (risk.risk_score as number) || 0;
  return {
    ...risk,
    business_multiplier: multiplier,
    effective_score: Math.min(100, Math.round(base * multiplier * 10) / 10),
  };
}

router.get('/', (req, res) => {
  const { category, status, search } = req.query as Record<string, string>;
  let query = 'SELECT * FROM risks WHERE 1=1';
  const params: unknown[] = [];
  if (category) { query += ' AND category = ?'; params.push(category); }
  if (status) { query += ' AND status = ?'; params.push(status); }
  if (search) { query += ' AND (title LIKE ? OR description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  query += ' ORDER BY risk_score DESC, created_at DESC';
  const multiplier = getBusinessMultiplier();
  const risks = (db.prepare(query).all(...params) as Record<string, unknown>[]).map(r => withEffectiveScore(r, multiplier));
  res.json(risks);
});

// SoD: risk_owner creates; risk_approver approves (different people)
router.post('/', requirePermission('risk', 'create'), validate(CreateRiskSchema), (req, res) => {
  const { title, description, category, likelihood, impact, owner, treatment, treatment_notes, due_date } = req.body;
  const id = uuidv4();
  db.prepare(`INSERT INTO risks (id, title, description, category, likelihood, impact, owner, treatment, treatment_notes, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, title, description, category, likelihood, impact, owner, treatment, treatment_notes, due_date
  );
  logChange({ entityType: 'risk', entityId: id, entityLabel: title, action: 'create', user: req.user! });
  const risk = db.prepare('SELECT * FROM risks WHERE id = ?').get(id) as Record<string, unknown>;
  res.json(withEffectiveScore(risk, getBusinessMultiplier()));
});

router.get('/:id', (req, res) => {
  const risk = db.prepare('SELECT * FROM risks WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!risk) return res.status(404).json({ error: 'Not found' });
  const controls = db.prepare(`SELECT c.id, c.identifier, c.title, c.status FROM controls c JOIN control_risks cr ON cr.control_id = c.id WHERE cr.risk_id = ?`).all(req.params.id);
  res.json({ ...withEffectiveScore(risk, getBusinessMultiplier()), controls });
});

router.patch('/:id', validate(UpdateRiskSchema), (req, res) => {
  const fields = ['title', 'description', 'category', 'likelihood', 'impact', 'status', 'owner', 'treatment', 'treatment_notes', 'residual_likelihood', 'residual_impact', 'due_date'];
  const updates: Record<string, unknown> = {};
  for (const f of fields) {
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No fields' });
  const before = db.prepare('SELECT * FROM risks WHERE id = ?').get(req.params.id) as Record<string, unknown>;
  const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE risks SET ${sets}, updated_at = datetime('now') WHERE id = ?`).run(...Object.values(updates), req.params.id);
  logFieldChanges('risk', req.params.id, (before?.title as string) ?? req.params.id, before, updates, req.user!);

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

  const risk = db.prepare('SELECT * FROM risks WHERE id = ?').get(req.params.id) as Record<string, unknown>;
  res.json(withEffectiveScore(risk, getBusinessMultiplier()));
});

router.delete('/:id', requirePermission('risk', 'delete'), (req, res) => {
  const risk = db.prepare('SELECT title FROM risks WHERE id = ?').get(req.params.id) as { title: string } | undefined;
  db.prepare('DELETE FROM control_risks WHERE risk_id = ?').run(req.params.id);
  db.prepare('DELETE FROM risks WHERE id = ?').run(req.params.id);
  logChange({ entityType: 'risk', entityId: req.params.id, entityLabel: risk?.title, action: 'delete', user: req.user! });
  res.json({ success: true });
});

export default router;
