import { Router } from 'express';
import db from '../db';

const router = Router();

// GET /api/settings — all app settings (admin only)
router.get('/', (req, res) => {
  if (req.user!.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const rows = db.prepare('SELECT key, value, updated_at FROM app_settings ORDER BY key').all() as { key: string; value: string; updated_at: string }[];
  const settings: Record<string, string> = {};
  for (const r of rows) settings[r.key] = r.value;
  res.json(settings);
});

// PATCH /api/settings — update one or more keys (admin only)
router.patch('/', (req, res) => {
  if (req.user!.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const allowed = ['login_banner', 'llm_model'];
  const body = req.body as Record<string, string>;
  for (const key of allowed) {
    if (key in body) {
      db.prepare(`
        INSERT INTO app_settings (key, value, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).run(key, body[key]);
    }
  }
  const rows = db.prepare('SELECT key, value FROM app_settings ORDER BY key').all() as { key: string; value: string }[];
  const settings: Record<string, string> = {};
  for (const r of rows) settings[r.key] = r.value;
  res.json(settings);
});

export default router;
