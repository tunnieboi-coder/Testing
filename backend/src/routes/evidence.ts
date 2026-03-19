import { Router } from 'express';
import db from '../db';
import { v4 as uuidv4 } from 'uuid';
import { validate } from '../middleware/validate';
import { CreateEvidenceSchema } from '../schemas';
import { reviewEvidence } from '../lib/aiReview';

const router = Router();

router.get('/', (req, res) => {
  const { type, status, source, search } = req.query as Record<string, string>;
  let query = `SELECT e.*, GROUP_CONCAT(c.identifier, ', ') as mapped_controls FROM evidence e LEFT JOIN control_evidence ce ON ce.evidence_id = e.id LEFT JOIN controls c ON ce.control_id = c.id WHERE 1=1`;
  const params: unknown[] = [];
  if (type) { query += ' AND e.type = ?'; params.push(type); }
  if (status) { query += ' AND e.status = ?'; params.push(status); }
  if (source) { query += ' AND e.source = ?'; params.push(source); }
  if (search) { query += ' AND (e.title LIKE ? OR e.description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  query += ' GROUP BY e.id ORDER BY e.collected_at DESC';
  res.json(db.prepare(query).all(...params));
});

router.post('/', validate(CreateEvidenceSchema), (req, res) => {
  const id = uuidv4();
  const { title, description, type, source, url, collected_by, expires_at, control_ids } = req.body;
  db.prepare(`INSERT INTO evidence (id, title, description, type, source, url, collected_by, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, title, description, type || 'document', source || 'manual', url, collected_by, expires_at
  );
  if (control_ids?.length) {
    for (const cid of control_ids) {
      try {
        db.prepare(`INSERT INTO control_evidence (id, control_id, evidence_id) VALUES (?, ?, ?)`).run(uuidv4(), cid, id);
      } catch { /* dup */ }
    }
  }
  res.json(db.prepare('SELECT * FROM evidence WHERE id = ?').get(id));
});

router.patch('/:id', (req, res) => {
  const fields = ['title', 'description', 'type', 'source', 'url', 'status', 'expires_at'];
  const updates: Record<string, unknown> = {};
  for (const f of fields) {
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No fields' });
  const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE evidence SET ${sets}, updated_at = datetime('now') WHERE id = ?`).run(...Object.values(updates), req.params.id);
  res.json(db.prepare('SELECT * FROM evidence WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM control_evidence WHERE evidence_id = ?').run(req.params.id);
  db.prepare('DELETE FROM evidence WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST /api/evidence/:id/ai-review — trigger AI review for this evidence item
router.post('/:id/ai-review', async (req, res) => {
  const ev = db.prepare('SELECT * FROM evidence WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!ev) return res.status(404).json({ error: 'Evidence not found' });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'AI review unavailable: ANTHROPIC_API_KEY not configured' });
  }

  // Get linked control ids
  const links = db.prepare('SELECT control_id FROM control_evidence WHERE evidence_id = ?').all(req.params.id) as { control_id: string }[];
  const controlIds = links.map(l => l.control_id);

  try {
    const result = await reviewEvidence({
      evidenceTitle: ev.title as string,
      evidenceDescription: ev.description as string ?? '',
      evidenceType: ev.type as string,
      controlIds,
    });

    // Persist the review result
    db.prepare(`
      UPDATE evidence SET
        ai_confidence = ?,
        ai_verdict = ?,
        ai_summary = ?,
        ai_gaps = ?,
        ai_reviewed_at = datetime('now'),
        ai_reviewed_by = 'ai',
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      result.confidence,
      result.verdict,
      result.summary,
      JSON.stringify(result.gaps),
      req.params.id,
    );

    res.json({ ...result, reviewed_at: new Date().toISOString() });
  } catch (err) {
    console.error('AI review failed:', err);
    res.status(500).json({ error: 'AI review failed', detail: String(err) });
  }
});

// PATCH /api/evidence/:id/review — human reviewer override
router.patch('/:id/review', (req, res) => {
  const { verdict, confidence, notes } = req.body as { verdict?: string; confidence?: number; notes?: string };
  const updates: Record<string, unknown> = {
    ai_reviewed_by: req.user!.id,
    ai_reviewed_at: new Date().toISOString(),
  };
  if (verdict) updates.ai_verdict = verdict;
  if (confidence != null) updates.ai_confidence = Math.max(0, Math.min(100, confidence));
  if (notes != null) updates.review_notes = notes;
  const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE evidence SET ${sets}, updated_at = datetime('now') WHERE id = ?`).run(...Object.values(updates), req.params.id);
  res.json(db.prepare('SELECT * FROM evidence WHERE id = ?').get(req.params.id));
});

router.get('/stats', (req, res) => {
  const total = (db.prepare('SELECT COUNT(*) as c FROM evidence').get() as { c: number }).c;
  const valid = (db.prepare("SELECT COUNT(*) as c FROM evidence WHERE status = 'valid'").get() as { c: number }).c;
  const expired = (db.prepare("SELECT COUNT(*) as c FROM evidence WHERE status = 'expired' OR (expires_at IS NOT NULL AND expires_at < datetime('now'))").get() as { c: number }).c;
  const byType = db.prepare('SELECT type, COUNT(*) as count FROM evidence GROUP BY type').all();
  const bySource = db.prepare('SELECT source, COUNT(*) as count FROM evidence GROUP BY source').all();
  res.json({ total, valid, expired, byType, bySource });
});

export default router;
