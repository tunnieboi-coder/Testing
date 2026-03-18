import { Router } from 'express';
import db from '../db';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.get('/', (req, res) => {
  const frameworks = db.prepare('SELECT * FROM frameworks ORDER BY name').all();
  res.json(frameworks);
});

router.get('/:id', (req, res) => {
  const fw = db.prepare('SELECT * FROM frameworks WHERE id = ?').get(req.params.id);
  if (!fw) return res.status(404).json({ error: 'Not found' });
  const families = db.prepare('SELECT * FROM control_families WHERE framework_id = ? ORDER BY identifier').all(req.params.id);
  const stats = db.prepare(`
    SELECT status, COUNT(*) as count FROM controls WHERE framework_id = ? GROUP BY status
  `).all(req.params.id);
  res.json({ ...fw as object, families, stats });
});

router.get('/:id/controls', (req, res) => {
  const { family, status, search, page = '1', limit = '50' } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let query = `SELECT c.*, cf.name as family_name, cf.identifier as family_identifier FROM controls c LEFT JOIN control_families cf ON c.family_id = cf.id WHERE c.framework_id = ?`;
  const params: unknown[] = [req.params.id];
  if (family) { query += ' AND cf.identifier = ?'; params.push(family); }
  if (status) { query += ' AND c.status = ?'; params.push(status); }
  if (search) { query += ' AND (c.identifier LIKE ? OR c.title LIKE ? OR c.description LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  query += ' ORDER BY c.identifier';
  const total = (db.prepare(query.replace('SELECT c.*, cf.name as family_name, cf.identifier as family_identifier', 'SELECT COUNT(*) as count')).get(...params) as { count: number }).count;
  query += ` LIMIT ${limit} OFFSET ${offset}`;
  const controls = db.prepare(query).all(...params);
  res.json({ controls, total, page: parseInt(page), limit: parseInt(limit) });
});

export default router;
