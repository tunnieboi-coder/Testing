import { Router } from 'express';
import db from '../db';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.get('/', (req, res) => {
  const { type, category, classification, criticality, status, search } = req.query as Record<string, string>;
  let query = 'SELECT * FROM assets WHERE 1=1';
  const params: unknown[] = [];
  if (type) { query += ' AND type = ?'; params.push(type); }
  if (category) { query += ' AND category = ?'; params.push(category); }
  if (classification) { query += ' AND classification = ?'; params.push(classification); }
  if (criticality) { query += ' AND criticality = ?'; params.push(criticality); }
  if (status) { query += ' AND status = ?'; params.push(status); }
  if (search) { query += ' AND (name LIKE ? OR description LIKE ? OR hostname LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  query += ' ORDER BY criticality ASC, name ASC';
  res.json(db.prepare(query).all(...params));
});

router.post('/', (req, res) => {
  const id = uuidv4();
  const { name, description, type, category, owner, custodian, location, classification, status, criticality, ip_address, hostname, os, version, vendor, purchase_date, end_of_life, tags } = req.body;
  db.prepare(`INSERT INTO assets (id, name, description, type, category, owner, custodian, location, classification, status, criticality, ip_address, hostname, os, version, vendor, purchase_date, end_of_life, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, name, description, type, category || 'hardware', owner, custodian, location, classification || 'internal', status || 'active', criticality || 'medium', ip_address, hostname, os, version, vendor, purchase_date, end_of_life, JSON.stringify(tags || [])
  );
  res.json(db.prepare('SELECT * FROM assets WHERE id = ?').get(id));
});

router.get('/:id', (req, res) => {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!asset) return res.status(404).json({ error: 'Not found' });
  res.json(asset);
});

router.patch('/:id', (req, res) => {
  const fields = ['name', 'description', 'type', 'category', 'owner', 'custodian', 'location', 'classification', 'status', 'criticality', 'ip_address', 'hostname', 'os', 'version', 'vendor', 'purchase_date', 'end_of_life', 'tags'];
  const updates: Record<string, unknown> = {};
  for (const f of fields) {
    if (req.body[f] !== undefined) updates[f] = f === 'tags' ? JSON.stringify(req.body[f]) : req.body[f];
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No fields' });
  const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE assets SET ${sets}, updated_at = datetime('now') WHERE id = ?`).run(...Object.values(updates), req.params.id);
  res.json(db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM assets WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
