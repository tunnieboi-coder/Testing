import { Router } from 'express';
import db from '../db';
import { v4 as uuidv4 } from 'uuid';
import { validate } from '../middleware/validate';
import { CreateAuditSchema, UpdateAuditSchema, CreateFindingSchema, UpdateFindingSchema } from '../schemas';

const router = Router();

router.get('/', (req, res) => {
  const audits = db.prepare(`SELECT a.*, f.name as framework_name FROM audits a LEFT JOIN frameworks f ON a.framework_id = f.id ORDER BY a.created_at DESC`).all();
  res.json(audits);
});

router.post('/', validate(CreateAuditSchema), (req, res) => {
  const id = uuidv4();
  const { title, description, type, framework_id, status, auditor, auditor_firm, scope, start_date, end_date } = req.body;
  db.prepare(`INSERT INTO audits (id, title, description, type, framework_id, status, auditor, auditor_firm, scope, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, title, description, type, framework_id, status || 'planned', auditor, auditor_firm, scope, start_date, end_date
  );
  res.json(db.prepare('SELECT * FROM audits WHERE id = ?').get(id));
});

router.get('/:id', (req, res) => {
  const audit = db.prepare(`SELECT a.*, f.name as framework_name FROM audits a LEFT JOIN frameworks f ON a.framework_id = f.id WHERE a.id = ?`).get(req.params.id);
  if (!audit) return res.status(404).json({ error: 'Not found' });
  const findings = db.prepare(`SELECT af.*, c.identifier as control_identifier FROM audit_findings af LEFT JOIN controls c ON af.control_id = c.id WHERE af.audit_id = ? ORDER BY af.severity`).all(req.params.id);
  res.json({ ...audit as object, findings });
});

router.patch('/:id', validate(UpdateAuditSchema), (req, res) => {
  const fields = ['title', 'description', 'type', 'framework_id', 'status', 'auditor', 'auditor_firm', 'scope', 'start_date', 'end_date', 'report_url'];
  const updates: Record<string, unknown> = {};
  for (const f of fields) {
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No fields' });
  const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE audits SET ${sets}, updated_at = datetime('now') WHERE id = ?`).run(...Object.values(updates), req.params.id);
  res.json(db.prepare('SELECT * FROM audits WHERE id = ?').get(req.params.id));
});

// Findings
router.post('/:id/findings', validate(CreateFindingSchema), (req, res) => {
  const findingId = uuidv4();
  const { control_id, title, description, severity, status, recommendation, management_response, due_date } = req.body;
  db.prepare(`INSERT INTO audit_findings (id, audit_id, control_id, title, description, severity, status, recommendation, management_response, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    findingId, req.params.id, control_id, title, description, severity || 'medium', status || 'open', recommendation, management_response, due_date
  );
  // Update finding counts
  const counts = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN severity='critical' THEN 1 ELSE 0 END) as critical,
      SUM(CASE WHEN severity='high' THEN 1 ELSE 0 END) as high,
      SUM(CASE WHEN severity='medium' THEN 1 ELSE 0 END) as medium,
      SUM(CASE WHEN severity='low' THEN 1 ELSE 0 END) as low
    FROM audit_findings WHERE audit_id = ?
  `).get(req.params.id) as { total: number; critical: number; high: number; medium: number; low: number };
  db.prepare(`UPDATE audits SET findings_count=?, critical_findings=?, high_findings=?, medium_findings=?, low_findings=? WHERE id=?`).run(
    counts.total, counts.critical, counts.high, counts.medium, counts.low, req.params.id
  );
  res.json(db.prepare('SELECT * FROM audit_findings WHERE id = ?').get(findingId));
});

router.patch('/findings/:findingId', validate(UpdateFindingSchema), (req, res) => {
  const fields = ['title', 'description', 'severity', 'status', 'recommendation', 'management_response', 'due_date', 'remediated_at'];
  const updates: Record<string, unknown> = {};
  for (const f of fields) {
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  }
  if (req.body.status === 'remediated' && !updates.remediated_at) updates.remediated_at = new Date().toISOString();
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No fields' });
  const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE audit_findings SET ${sets}, updated_at = datetime('now') WHERE id = ?`).run(...Object.values(updates), req.params.findingId);
  res.json(db.prepare('SELECT * FROM audit_findings WHERE id = ?').get(req.params.findingId));
});

export default router;
