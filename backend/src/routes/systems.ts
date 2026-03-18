import { Router } from 'express';
import db from '../db';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ─── Systems CRUD ─────────────────────────────────────────────────────────────

router.get('/', (req, res) => {
  const systems = db.prepare(`SELECT * FROM systems ORDER BY created_at DESC`).all();
  res.json(systems);
});

router.post('/', (req, res) => {
  const {
    name, description, system_type, status, system_owner, authorizing_official,
    organization, boundary_description, authorization_date, reauthorization_date,
  } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const id = uuidv4();
  db.prepare(`
    INSERT INTO systems (id, name, description, system_type, status, system_owner,
      authorizing_official, organization, boundary_description, authorization_date, reauthorization_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, description || null, system_type || 'major_application',
    status || 'assessment_in_progress', system_owner || null, authorizing_official || null,
    organization || null, boundary_description || null, authorization_date || null, reauthorization_date || null);
  const created = db.prepare('SELECT * FROM systems WHERE id = ?').get(id);
  res.status(201).json(created);
});

router.get('/:id', (req, res) => {
  const system = db.prepare('SELECT * FROM systems WHERE id = ?').get(req.params.id);
  if (!system) return res.status(404).json({ error: 'Not found' });

  // Attach control implementation stats
  const implStats = db.prepare(`
    SELECT status, COUNT(*) as count FROM system_control_implementations
    WHERE system_id = ? GROUP BY status
  `).all(req.params.id) as { status: string; count: number }[];

  const statMap: Record<string, number> = {};
  implStats.forEach(r => { statMap[r.status] = r.count; });

  // Inheritance stats
  const inheritStats = db.prepare(`
    SELECT implementation_type, COUNT(*) as count FROM control_inheritance
    WHERE system_id = ? GROUP BY implementation_type
  `).all(req.params.id) as { implementation_type: string; count: number }[];
  const inheritMap: Record<string, number> = {};
  inheritStats.forEach(r => { inheritMap[r.implementation_type] = r.count; });

  // Assessment progress
  const assessStats = db.prepare(`
    SELECT result, COUNT(*) as count FROM assessment_step_results
    WHERE system_id = ? GROUP BY result
  `).all(req.params.id) as { result: string; count: number }[];
  const assessMap: Record<string, number> = {};
  assessStats.forEach(r => { assessMap[r.result] = r.count; });

  res.json({
    ...(system as object),
    implementationStats: statMap,
    inheritanceStats: inheritMap,
    assessmentStats: assessMap,
  });
});

router.patch('/:id', (req, res) => {
  const allowed = [
    'name', 'description', 'system_type', 'status', 'system_owner', 'authorizing_official',
    'organization', 'boundary_description', 'authorization_date', 'reauthorization_date',
    'security_category_confidentiality', 'security_category_integrity',
    'security_category_availability', 'impact_level', 'applicable_baseline',
  ];
  const body = req.body as Record<string, string>;
  const fields: Record<string, string> = {};
  allowed.forEach(k => { if (body[k] !== undefined) fields[k] = body[k]; });
  if (Object.keys(fields).length === 0) return res.status(400).json({ error: 'No fields to update' });

  const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE systems SET ${sets}, updated_at = datetime('now') WHERE id = ?`)
    .run(...Object.values(fields), req.params.id);
  res.json(db.prepare('SELECT * FROM systems WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM systems WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ─── Per-System Control Implementations ──────────────────────────────────────

router.get('/:id/controls', (req, res) => {
  const { framework_id, status, family_id } = req.query;
  let where = 'c.framework_id = ?';
  const params: unknown[] = [framework_id as string];

  if (status) { where += ' AND COALESCE(sci.status, c.status) = ?'; params.push(status); }
  if (family_id) { where += ' AND c.family_id = ?'; params.push(family_id); }

  if (!framework_id) {
    const controls = db.prepare(`
      SELECT c.id, c.identifier, c.title, c.priority, c.family_id, c.framework_id,
        cf.identifier as family_identifier, cf.name as family_name,
        COALESCE(sci.status, c.status) as status,
        sci.implementation_notes, sci.responsible_team, sci.due_date,
        ci.implementation_type
      FROM controls c
      LEFT JOIN control_families cf ON c.family_id = cf.id
      LEFT JOIN system_control_implementations sci ON sci.control_id = c.id AND sci.system_id = ?
      LEFT JOIN control_inheritance ci ON ci.control_id = c.id AND ci.system_id = ?
      ORDER BY c.identifier
    `).all(req.params.id, req.params.id);
    return res.json(controls);
  }

  const controls = db.prepare(`
    SELECT c.id, c.identifier, c.title, c.priority, c.family_id, c.framework_id,
      cf.identifier as family_identifier, cf.name as family_name,
      COALESCE(sci.status, c.status) as status,
      sci.implementation_notes, sci.responsible_team, sci.due_date,
      ci.implementation_type
    FROM controls c
    LEFT JOIN control_families cf ON c.family_id = cf.id
    LEFT JOIN system_control_implementations sci ON sci.control_id = c.id AND sci.system_id = ?
    LEFT JOIN control_inheritance ci ON ci.control_id = c.id AND ci.system_id = ?
    WHERE ${where}
    ORDER BY c.identifier
  `).all(req.params.id, req.params.id, ...params);
  res.json(controls);
});

router.put('/:id/controls/:controlId', (req, res) => {
  const { status, implementation_notes, responsible_team, due_date } = req.body;
  const existing = db.prepare('SELECT id FROM system_control_implementations WHERE system_id = ? AND control_id = ?')
    .get(req.params.id, req.params.controlId);

  if (existing) {
    const fields: Record<string, string | undefined> = {};
    if (status !== undefined) fields.status = status;
    if (implementation_notes !== undefined) fields.implementation_notes = implementation_notes;
    if (responsible_team !== undefined) fields.responsible_team = responsible_team;
    if (due_date !== undefined) fields.due_date = due_date;
    const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
    if (sets) {
      db.prepare(`UPDATE system_control_implementations SET ${sets}, updated_at = datetime('now') WHERE system_id = ? AND control_id = ?`)
        .run(...Object.values(fields), req.params.id, req.params.controlId);
    }
  } else {
    db.prepare(`INSERT INTO system_control_implementations (id, system_id, control_id, status, implementation_notes, responsible_team, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(uuidv4(), req.params.id, req.params.controlId, status || 'not_implemented',
        implementation_notes || null, responsible_team || null, due_date || null);
  }
  res.json(db.prepare('SELECT * FROM system_control_implementations WHERE system_id = ? AND control_id = ?')
    .get(req.params.id, req.params.controlId));
});

// ─── Per-System Control Inheritance ──────────────────────────────────────────

router.get('/:id/inheritance/:controlId', (req, res) => {
  const row = db.prepare('SELECT * FROM control_inheritance WHERE system_id = ? AND control_id = ?')
    .get(req.params.id, req.params.controlId);
  res.json(row || {
    implementation_type: 'system_specific',
    provider_name: null, provider_type: null, provider_authorization: null,
    inherited_description: null, system_responsibility: null, authorization_reference: null, notes: null,
  });
});

router.put('/:id/inheritance/:controlId', (req, res) => {
  const {
    implementation_type, provider_name, provider_type, provider_authorization,
    inherited_description, system_responsibility, authorization_reference, notes,
  } = req.body;

  const existing = db.prepare('SELECT id FROM control_inheritance WHERE system_id = ? AND control_id = ?')
    .get(req.params.id, req.params.controlId);

  if (existing) {
    db.prepare(`
      UPDATE control_inheritance SET
        implementation_type = ?, provider_name = ?, provider_type = ?,
        provider_authorization = ?, inherited_description = ?, system_responsibility = ?,
        authorization_reference = ?, notes = ?, updated_at = datetime('now')
      WHERE system_id = ? AND control_id = ?
    `).run(implementation_type || 'system_specific', provider_name || null, provider_type || null,
      provider_authorization || null, inherited_description || null, system_responsibility || null,
      authorization_reference || null, notes || null, req.params.id, req.params.controlId);
  } else {
    db.prepare(`
      INSERT INTO control_inheritance
        (id, system_id, control_id, implementation_type, provider_name, provider_type,
         provider_authorization, inherited_description, system_responsibility, authorization_reference, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), req.params.id, req.params.controlId,
      implementation_type || 'system_specific', provider_name || null, provider_type || null,
      provider_authorization || null, inherited_description || null, system_responsibility || null,
      authorization_reference || null, notes || null);
  }
  res.json(db.prepare('SELECT * FROM control_inheritance WHERE system_id = ? AND control_id = ?')
    .get(req.params.id, req.params.controlId));
});

// ─── Per-System Assessment Step Results ──────────────────────────────────────

router.get('/:id/assessment/:controlId', (req, res) => {
  const results = db.prepare(`
    SELECT asr.*, cao.objective as objective_text, ctp.description as procedure_description
    FROM assessment_step_results asr
    LEFT JOIN control_assessment_objectives cao ON cao.id = asr.objective_id
    LEFT JOIN control_testing_procedures ctp ON ctp.id = asr.procedure_id
    WHERE asr.system_id = ? AND asr.control_id = ?
    ORDER BY asr.method, asr.created_at
  `).all(req.params.id, req.params.controlId);
  res.json(results);
});

router.post('/:id/assessment/:controlId', (req, res) => {
  const {
    objective_id, procedure_id, method, object_description,
    result, finding_summary, recommendation, assessor, assessed_at,
  } = req.body;
  if (!method) return res.status(400).json({ error: 'method is required' });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO assessment_step_results
      (id, system_id, control_id, objective_id, procedure_id, method, object_description,
       result, finding_summary, recommendation, assessor, assessed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.params.id, req.params.controlId,
    objective_id || null, procedure_id || null, method,
    object_description || null, result || 'not_assessed',
    finding_summary || null, recommendation || null, assessor || null, assessed_at || null);

  res.status(201).json(db.prepare('SELECT * FROM assessment_step_results WHERE id = ?').get(id));
});

router.patch('/:id/assessment/step/:stepId', (req, res) => {
  const allowed = ['result', 'finding_summary', 'recommendation', 'assessor', 'assessed_at',
    'object_description', 'method', 'objective_id', 'procedure_id'];
  const body = req.body as Record<string, string>;
  const fields: Record<string, string> = {};
  allowed.forEach(k => { if (body[k] !== undefined) fields[k] = body[k]; });
  if (Object.keys(fields).length === 0) return res.status(400).json({ error: 'No fields to update' });

  const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE assessment_step_results SET ${sets}, updated_at = datetime('now') WHERE id = ?`)
    .run(...Object.values(fields), req.params.stepId);
  res.json(db.prepare('SELECT * FROM assessment_step_results WHERE id = ?').get(req.params.stepId));
});

router.delete('/:id/assessment/step/:stepId', (req, res) => {
  db.prepare('DELETE FROM assessment_step_results WHERE id = ? AND system_id = ?')
    .run(req.params.stepId, req.params.id);
  res.json({ success: true });
});

// ─── System compliance summary ────────────────────────────────────────────────

router.get('/:id/compliance-summary', (req, res) => {
  const rows = db.prepare(`
    SELECT f.id, f.name, f.version,
      COUNT(c.id) as total,
      SUM(CASE WHEN COALESCE(sci.status, c.status) = 'implemented' THEN 1 ELSE 0 END) as implemented,
      SUM(CASE WHEN COALESCE(sci.status, c.status) = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN COALESCE(sci.status, c.status) = 'not_implemented' THEN 1 ELSE 0 END) as not_implemented,
      SUM(CASE WHEN COALESCE(sci.status, c.status) = 'not_applicable' THEN 1 ELSE 0 END) as not_applicable
    FROM frameworks f
    JOIN controls c ON c.framework_id = f.id
    LEFT JOIN system_control_implementations sci ON sci.control_id = c.id AND sci.system_id = ?
    GROUP BY f.id
  `).all(req.params.id) as Array<{
    id: string; name: string; version: string;
    total: number; implemented: number; in_progress: number; not_implemented: number; not_applicable: number;
  }>;

  const result = rows.map(fw => {
    const applicable = fw.total - fw.not_applicable;
    const score = applicable > 0 ? ((fw.implemented + fw.in_progress * 0.5) / applicable) * 100 : 0;
    return { ...fw, score: Math.round(score * 10) / 10 };
  });

  res.json(result);
});

export default router;
