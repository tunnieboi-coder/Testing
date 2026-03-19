import { Router } from 'express';
import db from '../db';
import { v4 as uuidv4 } from 'uuid';
import { validate } from '../middleware/validate';
import { CreateVendorSchema, UpdateVendorSchema } from '../schemas';
import { logChange, logFieldChanges } from '../lib/changeLog';

const router = Router();

router.get('/', (req, res) => {
  const { category, status, tier, search } = req.query as Record<string, string>;
  let query = 'SELECT * FROM vendors WHERE 1=1';
  const params: unknown[] = [];
  if (category) { query += ' AND category = ?'; params.push(category); }
  if (status) { query += ' AND status = ?'; params.push(status); }
  if (tier) { query += ' AND tier = ?'; params.push(parseInt(tier)); }
  if (search) { query += ' AND (name LIKE ? OR description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  query += ' ORDER BY tier ASC, name ASC';
  res.json(db.prepare(query).all(...params));
});

router.post('/', validate(CreateVendorSchema), (req, res) => {
  const id = uuidv4();
  const { name, website, description, category, tier, status, risk_rating, contact_name, contact_email, data_types, notes } = req.body;
  db.prepare(`INSERT INTO vendors (id, name, website, description, category, tier, status, risk_rating, contact_name, contact_email, data_types, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, name, website, description, category, tier || 2, status || 'active', risk_rating || 'medium', contact_name, contact_email, JSON.stringify(data_types || []), notes
  );
  logChange({ entityType: 'vendor', entityId: id, entityLabel: name, action: 'create', user: req.user! });
  res.json(db.prepare('SELECT * FROM vendors WHERE id = ?').get(id));
});

router.get('/:id', (req, res) => {
  const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(req.params.id);
  if (!vendor) return res.status(404).json({ error: 'Not found' });
  res.json(vendor);
});

router.patch('/:id', validate(UpdateVendorSchema), (req, res) => {
  const fields = ['name', 'website', 'description', 'category', 'tier', 'status', 'risk_rating', 'contact_name', 'contact_email', 'soc2_report_url', 'iso_cert_url', 'last_review_date', 'next_review_date', 'data_types', 'notes'];
  const updates: Record<string, unknown> = {};
  for (const f of fields) {
    if (req.body[f] !== undefined) updates[f] = f === 'data_types' ? JSON.stringify(req.body[f]) : req.body[f];
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No fields' });
  const before = db.prepare('SELECT * FROM vendors WHERE id = ?').get(req.params.id) as Record<string, unknown>;
  const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE vendors SET ${sets}, updated_at = datetime('now') WHERE id = ?`).run(...Object.values(updates), req.params.id);
  logFieldChanges('vendor', req.params.id, (before?.name as string) ?? req.params.id, before, updates, req.user!);
  res.json(db.prepare('SELECT * FROM vendors WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const vendor = db.prepare('SELECT name FROM vendors WHERE id = ?').get(req.params.id) as { name: string } | undefined;
  db.prepare('DELETE FROM vendors WHERE id = ?').run(req.params.id);
  logChange({ entityType: 'vendor', entityId: req.params.id, entityLabel: vendor?.name, action: 'delete', user: req.user! });
  res.json({ success: true });
});

export default router;
