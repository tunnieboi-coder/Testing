import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { JWT_SECRET, JWT_EXPIRES_IN, requireAuth, AuthUser } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { LoginSchema } from '../schemas';
import { z } from 'zod';

const router = Router();

// POST /api/auth/login
router.post('/login', validate(LoginSchema), (req, res) => {
  const { email, password } = req.body as z.infer<typeof LoginSchema>;

  const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email) as Record<string, unknown> | undefined;
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash as string);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const payload: AuthUser = {
    id: user.id as string,
    email: user.email as string,
    name: user.name as string,
    role: user.role as string,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  res.json({ token, user: payload });
});

// GET /api/auth/me — validate current token & return user info
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, email, name, role, department, avatar, active FROM users WHERE id = ?').get(req.user!.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// POST /api/auth/change-password
const ChangePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8),
});

router.post('/change-password', requireAuth, validate(ChangePasswordSchema), (req, res) => {
  const { current_password, new_password } = req.body as z.infer<typeof ChangePasswordSchema>;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as Record<string, unknown> | undefined;
  if (!user) return res.status(404).json({ error: 'User not found' });

  const valid = bcrypt.compareSync(current_password, user.password_hash as string);
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

  const newHash = bcrypt.hashSync(new_password, 10);
  db.prepare(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`).run(newHash, req.user!.id);
  res.json({ success: true });
});

// GET /api/auth/users — admin only: list users
router.get('/users', requireAuth, (req, res) => {
  if (req.user!.role !== 'admin') return res.status(403).json({ error: 'Insufficient permissions' });
  const users = db.prepare('SELECT id, email, name, role, department, avatar, active, created_at FROM users ORDER BY name').all();
  res.json(users);
});

// POST /api/auth/users — admin only: create user
const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255),
  password: z.string().min(8),
  role: z.enum(['admin', 'compliance_manager', 'risk_owner', 'risk_approver', 'auditor', 'control_owner', 'reviewer', 'viewer', 'system_owner', 'isso', 'authorizing_official']),
  department: z.string().optional(),
});

router.post('/users', requireAuth, validate(CreateUserSchema), (req, res) => {
  if (req.user!.role !== 'admin') return res.status(403).json({ error: 'Insufficient permissions' });
  const { email, name, password, role, department } = req.body as z.infer<typeof CreateUserSchema>;

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ error: 'Email already in use' });

  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare(`INSERT INTO users (id, email, password_hash, name, role, department) VALUES (?, ?, ?, ?, ?, ?)`).run(id, email, hash, name, role, department || null);
  res.status(201).json(db.prepare('SELECT id, email, name, role, department, active, created_at FROM users WHERE id = ?').get(id));
});

// GET /api/auth/banner — public, no auth (shown on login page before credentials entered)
router.get('/banner', (req, res) => {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = 'login_banner'").get() as { value: string } | undefined;
  res.json({ message: row?.value ?? '' });
});

export default router;
