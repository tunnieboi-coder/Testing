import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { AuthUser } from '../middleware/auth';

type Action = 'create' | 'update' | 'delete';

interface LogEntry {
  entityType: string;
  entityId: string;
  entityLabel?: string;
  action: Action;
  field?: string;
  oldValue?: unknown;
  newValue?: unknown;
  user: AuthUser;
}

export function logChange(entry: LogEntry) {
  try {
    db.prepare(`
      INSERT INTO change_log (id, entity_type, entity_id, entity_label, action, field, old_value, new_value, changed_by, changed_by_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      entry.entityType,
      entry.entityId,
      entry.entityLabel ?? null,
      entry.action,
      entry.field ?? null,
      entry.oldValue != null ? String(entry.oldValue) : null,
      entry.newValue != null ? String(entry.newValue) : null,
      entry.user.id,
      entry.user.name,
    );
  } catch {
    // Never let audit logging crash the main request
  }
}

/**
 * Diffs two objects and logs a change_log row for each changed field.
 */
export function logFieldChanges(
  entityType: string,
  entityId: string,
  entityLabel: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  user: AuthUser,
  fieldsToTrack?: string[],
) {
  const keys = fieldsToTrack ?? Object.keys(after);
  for (const key of keys) {
    if (after[key] !== undefined && String(after[key]) !== String(before[key] ?? '')) {
      logChange({
        entityType, entityId, entityLabel,
        action: 'update',
        field: key,
        oldValue: before[key],
        newValue: after[key],
        user,
      });
    }
  }
}
