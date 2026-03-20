import { Router } from 'express';
import db from '../db';
import { ALL_ROLES } from '../middleware/auth';

const router = Router();

interface PermissionRow { role: string; resource: string; action: string; }

// GET /api/roles — full permission matrix (all roles × resources × actions)
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT role, resource, action FROM role_permissions ORDER BY role, resource, action').all() as PermissionRow[];

  // Build matrix: { role -> { resource -> Set<action> } }
  const matrix: Record<string, Record<string, string[]>> = {};
  for (const role of ALL_ROLES) matrix[role] = {};
  for (const { role, resource, action } of rows) {
    if (!matrix[role]) matrix[role] = {};
    if (!matrix[role][resource]) matrix[role][resource] = [];
    matrix[role][resource].push(action);
  }

  // SoD conflict pairs — informational, shown in the UI
  const sodConflicts = [
    { role: 'auditor',              resource: 'finding', forbidden: 'remediate', reason: 'Auditors who create findings cannot remediate them' },
    { role: 'risk_owner',           resource: 'risk',    forbidden: 'approve',   reason: 'Risk owners who propose treatment cannot approve it' },
    { role: 'control_owner',        resource: 'control', forbidden: 'approve',   reason: 'Control owners who submit evidence cannot approve it' },
    { role: 'control_owner',        resource: 'evidence',forbidden: 'approve',   reason: 'Evidence submitters cannot approve their own evidence' },
    { role: 'admin',                resource: 'risk',    forbidden: 'create',    reason: 'Admins manage users/systems, not operational GRC' },
    { role: 'admin',                resource: 'finding', forbidden: 'create',    reason: 'Admins manage users/systems, not operational GRC' },
    // ATO-specific SoD
    { role: 'isso',                 resource: 'ato',     forbidden: 'approve',   reason: 'ISSO certifies completeness; only the AO can grant authorization' },
    { role: 'system_owner',         resource: 'ato',     forbidden: 'approve',   reason: 'System Owner acknowledges; AO grants the actual authorization' },
    { role: 'authorizing_official', resource: 'ato',     forbidden: 'create',    reason: 'AO reviews packages; ISSO creates and manages them' },
    { role: 'authorizing_official', resource: 'ato',     forbidden: 'generate',  reason: 'AO reviews documents; ISSO generates them' },
  ];

  res.json({ roles: ALL_ROLES, matrix, sodConflicts });
});

// GET /api/roles/my-permissions — current user's permission list
router.get('/my-permissions', (req, res) => {
  const rows = db.prepare(
    'SELECT resource, action FROM role_permissions WHERE role = ? ORDER BY resource, action'
  ).all(req.user!.role) as { resource: string; action: string }[];
  res.json({ role: req.user!.role, permissions: rows });
});

export default router;
