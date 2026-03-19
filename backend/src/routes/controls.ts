import { Router } from 'express';
import db from '../db';
import { v4 as uuidv4 } from 'uuid';
import { validate } from '../middleware/validate';
import { UpdateControlSchema } from '../schemas';
import { logFieldChanges } from '../lib/changeLog';

const router = Router();

router.get('/:id', (req, res) => {
  const control = db.prepare(`
    SELECT c.*, cf.name as family_name, cf.identifier as family_identifier, f.name as framework_name, f.id as framework_id_ref
    FROM controls c
    LEFT JOIN control_families cf ON c.family_id = cf.id
    LEFT JOIN frameworks f ON c.framework_id = f.id
    WHERE c.id = ?
  `).get(req.params.id);
  if (!control) return res.status(404).json({ error: 'Not found' });

  const evidence = db.prepare(`SELECT e.* FROM evidence e JOIN control_evidence ce ON ce.evidence_id = e.id WHERE ce.control_id = ?`).all(req.params.id);
  const risks = db.prepare(`SELECT r.* FROM risks r JOIN control_risks cr ON cr.risk_id = r.id WHERE cr.control_id = ?`).all(req.params.id);
  const enhancements = db.prepare('SELECT * FROM control_enhancements WHERE control_id = ? ORDER BY number').all(req.params.id);
  const assessmentObjectives = db.prepare('SELECT * FROM control_assessment_objectives WHERE control_id = ?').all(req.params.id);
  const testingProcedures = db.prepare('SELECT * FROM control_testing_procedures WHERE control_id = ? ORDER BY procedure_type').all(req.params.id);
  const mappings = db.prepare(`
    SELECT fm.*, c.identifier as mapped_identifier, c.title as mapped_title, f.name as mapped_framework
    FROM framework_mappings fm
    JOIN controls c ON (fm.target_control_id = c.id OR fm.source_control_id = c.id)
    JOIN frameworks f ON c.framework_id = f.id
    WHERE (fm.source_control_id = ? OR fm.target_control_id = ?) AND c.id != ?
  `).all(req.params.id, req.params.id, req.params.id);

  res.json({ ...control as object, evidence, risks, enhancements, assessmentObjectives, testingProcedures, mappings });
});

router.patch('/:id', validate(UpdateControlSchema), (req, res) => {
  const { status, implementation_notes, responsible_team, due_date } = req.body;
  const allowed: Record<string, string | undefined> = {};
  if (status !== undefined) allowed.status = status;
  if (implementation_notes !== undefined) allowed.implementation_notes = implementation_notes;
  if (responsible_team !== undefined) allowed.responsible_team = responsible_team;
  if (due_date !== undefined) allowed.due_date = due_date;

  if (Object.keys(allowed).length === 0) return res.status(400).json({ error: 'No fields to update' });

  const before = db.prepare('SELECT * FROM controls WHERE id = ?').get(req.params.id) as Record<string, unknown>;
  const sets = Object.keys(allowed).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE controls SET ${sets}, updated_at = datetime('now') WHERE id = ?`).run(...Object.values(allowed), req.params.id);
  logFieldChanges('control', req.params.id, (before?.identifier as string) ?? req.params.id, before, allowed, req.user!);

  // Take a compliance snapshot when status changes
  if (status !== undefined) {
    const control = db.prepare('SELECT framework_id FROM controls WHERE id = ?').get(req.params.id) as { framework_id: string } | undefined;
    if (control) {
      const today = new Date().toISOString().split('T')[0];
      const existing = db.prepare('SELECT id FROM compliance_snapshots WHERE framework_id = ? AND snapshot_date = ?').get(control.framework_id, today);
      if (!existing) {
        const total = (db.prepare('SELECT COUNT(*) as c FROM controls WHERE framework_id = ?').get(control.framework_id) as { c: number }).c;
        const implemented = (db.prepare("SELECT COUNT(*) as c FROM controls WHERE framework_id = ? AND status = 'implemented'").get(control.framework_id) as { c: number }).c;
        const in_progress = (db.prepare("SELECT COUNT(*) as c FROM controls WHERE framework_id = ? AND status = 'in_progress'").get(control.framework_id) as { c: number }).c;
        const not_applicable = (db.prepare("SELECT COUNT(*) as c FROM controls WHERE framework_id = ? AND status = 'not_applicable'").get(control.framework_id) as { c: number }).c;
        const applicable = total - not_applicable;
        const score = applicable > 0 ? ((implemented + in_progress * 0.5) / applicable) * 100 : 0;
        db.prepare('INSERT INTO compliance_snapshots (id, framework_id, snapshot_date, total_controls, implemented, in_progress, not_implemented, not_applicable, compliance_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(uuidv4(), control.framework_id, today, total, implemented, in_progress, total - implemented - in_progress - not_applicable, not_applicable, Math.round(score * 10) / 10);
      }
    }
  }

  const updated = db.prepare('SELECT * FROM controls WHERE id = ?').get(req.params.id);
  res.json(updated);
});

router.post('/:id/evidence', (req, res) => {
  const { title, description, type, source, url, expires_at } = req.body;
  const evidenceId = uuidv4();
  db.prepare(`INSERT INTO evidence (id, title, description, type, source, url, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    evidenceId, title, description, type || 'document', source || 'manual', url, expires_at
  );
  db.prepare(`INSERT INTO control_evidence (id, control_id, evidence_id) VALUES (?, ?, ?)`).run(uuidv4(), req.params.id, evidenceId);
  res.json({ id: evidenceId, title, description, type, source, url, expires_at });
});

router.post('/:id/risks', (req, res) => {
  const { risk_id } = req.body;
  try {
    db.prepare(`INSERT INTO control_risks (id, control_id, risk_id) VALUES (?, ?, ?)`).run(uuidv4(), req.params.id, risk_id);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: 'Mapping already exists' });
  }
});

router.get('/:id/assessment-objectives', (req, res) => {
  const objs = db.prepare('SELECT * FROM control_assessment_objectives WHERE control_id = ?').all(req.params.id);
  res.json(objs);
});

router.patch('/assessment-objectives/:objId', (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE control_assessment_objectives SET status = ? WHERE id = ?').run(status, req.params.objId);
  res.json({ success: true });
});

export default router;
