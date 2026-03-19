import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import db from '../db';

export const JWT_SECRET = process.env.JWT_SECRET || 'grc-platform-dev-secret-change-in-production';
export const JWT_EXPIRES_IN = '8h';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthUser;
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

/**
 * Enforce Segregation of Duties via the role_permissions table.
 * Usage: requirePermission('audit', 'create')
 */
export function requirePermission(resource: string, action: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const allowed = db.prepare(
      'SELECT id FROM role_permissions WHERE role = ? AND resource = ? AND action = ?'
    ).get(req.user.role, resource, action);
    if (!allowed) {
      return res.status(403).json({
        error: 'Forbidden',
        detail: `Role '${req.user.role}' cannot perform '${action}' on '${resource}'`,
      });
    }
    next();
  };
}

export const ALL_ROLES = ['admin', 'compliance_manager', 'risk_owner', 'risk_approver', 'auditor', 'control_owner', 'reviewer', 'viewer'] as const;
export type AppRole = typeof ALL_ROLES[number];
