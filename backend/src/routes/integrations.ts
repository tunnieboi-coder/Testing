import { Router } from 'express';
import db from '../db';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM integrations ORDER BY status, name').all());
});

router.post('/:id/sync', (req, res) => {
  // Simulate a sync operation
  const integration = db.prepare('SELECT * FROM integrations WHERE id = ?').get(req.params.id) as { type: string } | undefined;
  if (!integration) return res.status(404).json({ error: 'Not found' });

  // Simulate collecting new evidence
  const newEvidence = Math.floor(Math.random() * 10) + 1;
  db.prepare(`UPDATE integrations SET last_sync = datetime('now'), evidence_collected = evidence_collected + ?, status = 'active', updated_at = datetime('now') WHERE id = ?`).run(newEvidence, req.params.id);

  res.json({ success: true, newEvidenceCollected: newEvidence, message: `Sync completed. ${newEvidence} new evidence items collected.` });
});

router.patch('/:id', (req, res) => {
  const { status, sync_frequency } = req.body;
  const updates: Record<string, unknown> = {};
  if (status !== undefined) updates.status = status;
  if (sync_frequency !== undefined) updates.sync_frequency = sync_frequency;
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No fields' });
  const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE integrations SET ${sets}, updated_at = datetime('now') WHERE id = ?`).run(...Object.values(updates), req.params.id);
  res.json(db.prepare('SELECT * FROM integrations WHERE id = ?').get(req.params.id));
});

export default router;
