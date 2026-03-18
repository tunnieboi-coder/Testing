import { Router } from 'express';
import db from '../db';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

const IMPACT_ORDER = ['N/A', 'Low', 'Moderate', 'High'];
function highWaterMark(values: string[]): string {
  let max = 0;
  for (const v of values) {
    const idx = IMPACT_ORDER.indexOf(v);
    if (idx > max) max = idx;
  }
  return IMPACT_ORDER[max] || 'Low';
}

function impactToLevel(c: string, i: string, a: string): 'Low' | 'Moderate' | 'High' {
  const vals = [c, i, a];
  if (vals.includes('High')) return 'High';
  if (vals.includes('Moderate')) return 'Moderate';
  return 'Low';
}

// ─── Catalog ─────────────────────────────────────────────────────────────────

router.get('/catalog', (req, res) => {
  const types = db.prepare('SELECT * FROM nist_800_60_types ORDER BY section, identifier').all();
  res.json(types);
});

router.get('/catalog/:identifier', (req, res) => {
  const type = db.prepare('SELECT * FROM nist_800_60_types WHERE identifier = ?').get(req.params.identifier);
  if (!type) return res.status(404).json({ error: 'Not found' });
  res.json(type);
});

// ─── Per-System Information Type Selections ───────────────────────────────────

router.get('/systems/:systemId/types', (req, res) => {
  const selections = db.prepare(`
    SELECT sit.*, nt.identifier, nt.name, nt.description, nt.section, nt.section_name, nt.category,
      nt.confidentiality_impact as default_confidentiality,
      nt.integrity_impact as default_integrity,
      nt.availability_impact as default_availability
    FROM system_information_types sit
    JOIN nist_800_60_types nt ON nt.id = sit.type_id
    WHERE sit.system_id = ?
    ORDER BY nt.identifier
  `).all(req.params.systemId);
  res.json(selections);
});

router.post('/systems/:systemId/types', (req, res) => {
  const { type_id, confidentiality_override, integrity_override, availability_override, override_justification, notes } = req.body;
  if (!type_id) return res.status(400).json({ error: 'type_id is required' });

  const existing = db.prepare('SELECT id FROM system_information_types WHERE system_id = ? AND type_id = ?')
    .get(req.params.systemId, type_id);
  if (existing) return res.status(409).json({ error: 'Type already selected for this system' });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO system_information_types
      (id, system_id, type_id, confidentiality_override, integrity_override,
       availability_override, override_justification, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.params.systemId, type_id,
    confidentiality_override || null, integrity_override || null,
    availability_override || null, override_justification || null, notes || null);

  // Recompute and update system security category
  recomputeSystemCategory(req.params.systemId);

  const row = db.prepare(`
    SELECT sit.*, nt.identifier, nt.name, nt.section, nt.section_name, nt.category,
      nt.confidentiality_impact as default_confidentiality,
      nt.integrity_impact as default_integrity,
      nt.availability_impact as default_availability
    FROM system_information_types sit
    JOIN nist_800_60_types nt ON nt.id = sit.type_id
    WHERE sit.id = ?
  `).get(id);
  res.status(201).json(row);
});

router.patch('/systems/:systemId/types/:selectionId', (req, res) => {
  const { confidentiality_override, integrity_override, availability_override, override_justification, notes } = req.body;
  db.prepare(`
    UPDATE system_information_types SET
      confidentiality_override = ?, integrity_override = ?, availability_override = ?,
      override_justification = ?, notes = ?, updated_at = datetime('now')
    WHERE id = ? AND system_id = ?
  `).run(
    confidentiality_override ?? null, integrity_override ?? null, availability_override ?? null,
    override_justification ?? null, notes ?? null,
    req.params.selectionId, req.params.systemId
  );
  recomputeSystemCategory(req.params.systemId);
  res.json(db.prepare('SELECT * FROM system_information_types WHERE id = ?').get(req.params.selectionId));
});

router.delete('/systems/:systemId/types/:selectionId', (req, res) => {
  db.prepare('DELETE FROM system_information_types WHERE id = ? AND system_id = ?')
    .run(req.params.selectionId, req.params.systemId);
  recomputeSystemCategory(req.params.systemId);
  res.json({ success: true });
});

// ─── Computed Security Category ───────────────────────────────────────────────

router.get('/systems/:systemId/category', (req, res) => {
  const result = computeCategory(req.params.systemId);
  res.json(result);
});

function computeCategory(systemId: string) {
  const selections = db.prepare(`
    SELECT
      COALESCE(sit.confidentiality_override, nt.confidentiality_impact) as c,
      COALESCE(sit.integrity_override, nt.integrity_impact) as i,
      COALESCE(sit.availability_override, nt.availability_impact) as a
    FROM system_information_types sit
    JOIN nist_800_60_types nt ON nt.id = sit.type_id
    WHERE sit.system_id = ?
  `).all(systemId) as { c: string; i: string; a: string }[];

  if (selections.length === 0) {
    return {
      confidentiality: 'Low', integrity: 'Low', availability: 'Low',
      impact_level: 'Low', applicable_baseline: 'Low',
      type_count: 0,
    };
  }

  const c = highWaterMark(selections.map(s => s.c));
  const i = highWaterMark(selections.map(s => s.i));
  const a = highWaterMark(selections.map(s => s.a));
  const impact_level = impactToLevel(c, i, a);

  return {
    confidentiality: c, integrity: i, availability: a,
    impact_level, applicable_baseline: impact_level,
    type_count: selections.length,
  };
}

function recomputeSystemCategory(systemId: string) {
  const cat = computeCategory(systemId);
  db.prepare(`
    UPDATE systems SET
      security_category_confidentiality = ?,
      security_category_integrity = ?,
      security_category_availability = ?,
      impact_level = ?,
      applicable_baseline = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(cat.confidentiality, cat.integrity, cat.availability, cat.impact_level, cat.applicable_baseline, systemId);
}

export default router;
