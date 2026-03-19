import { Router } from 'express';
import db from '../db';

const router = Router();

// GET /api/change-log?entity_type=&entity_id=&user_id=&limit=&offset=
router.get('/', (req, res) => {
  const { entity_type, entity_id, user_id, limit = '50', offset = '0' } = req.query as Record<string, string>;

  let query = 'SELECT * FROM change_log WHERE 1=1';
  const params: unknown[] = [];

  if (entity_type) { query += ' AND entity_type = ?'; params.push(entity_type); }
  if (entity_id)   { query += ' AND entity_id = ?';   params.push(entity_id); }
  if (user_id)     { query += ' AND changed_by = ?';   params.push(user_id); }

  query += ' ORDER BY changed_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const rows = db.prepare(query).all(...params);
  const total = (db.prepare(
    `SELECT COUNT(*) as c FROM change_log WHERE 1=1${entity_type ? ' AND entity_type = ?' : ''}${entity_id ? ' AND entity_id = ?' : ''}${user_id ? ' AND changed_by = ?' : ''}`
  ).get(...params.slice(0, -2)) as { c: number }).c;

  res.json({ rows, total, limit: parseInt(limit), offset: parseInt(offset) });
});

// GET /api/change-log/entity/:type/:id — history for a specific entity
router.get('/entity/:type/:id', (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM change_log WHERE entity_type = ? AND entity_id = ? ORDER BY changed_at DESC LIMIT 100'
  ).all(req.params.type, req.params.id);
  res.json(rows);
});

export default router;
