import { Router } from 'express';
import db from '../db';
import { v4 as uuidv4 } from 'uuid';
import { requirePermission } from '../middleware/auth';
import { generateAtoDocument, getActiveLlm, setActiveLlm, AVAILABLE_MODELS, DOC_TYPE_META, DocumentType } from '../lib/atoDocGen';
import { logChange } from '../lib/changeLog';

const router = Router();

// ── LLM Settings ─────────────────────────────────────────────────────────────

// GET /api/ato/llm-settings
router.get('/llm-settings', (req, res) => {
  res.json({ active: getActiveLlm(), models: AVAILABLE_MODELS });
});

// PATCH /api/ato/llm-settings
router.patch('/llm-settings', (req, res) => {
  if (req.user!.role !== 'admin' && req.user!.role !== 'isso') {
    return res.status(403).json({ error: 'Only admin or ISSO can change LLM settings' });
  }
  const { model } = req.body as { model?: string };
  if (!model || !AVAILABLE_MODELS.find(m => m.id === model)) {
    return res.status(400).json({ error: 'Invalid model', available: AVAILABLE_MODELS.map(m => m.id) });
  }
  setActiveLlm(model);
  res.json({ active: model });
});

// ── ATO Packages CRUD ────────────────────────────────────────────────────────

// GET /api/ato
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT p.*, s.name as system_name,
      (SELECT COUNT(*) FROM ato_documents d WHERE d.ato_package_id = p.id) as document_count,
      (SELECT COUNT(*) FROM ato_signatures sig WHERE sig.ato_package_id = p.id AND sig.status = 'signed') as signatures_collected,
      (SELECT COUNT(*) FROM ato_signatures sig WHERE sig.ato_package_id = p.id) as signatures_required
    FROM ato_packages p
    LEFT JOIN systems s ON s.id = p.system_id
    ORDER BY p.created_at DESC
  `).all();
  res.json(rows);
});

// POST /api/ato
router.post('/', requirePermission('ato', 'create'), (req, res) => {
  const id = uuidv4();
  const {
    title, system_id, package_type, impact_level, authorization_boundary,
    system_owner_id, system_owner_name, isso_id, isso_name,
    authorizing_official_id, authorizing_official_name, notes,
  } = req.body as Record<string, string>;

  db.prepare(`
    INSERT INTO ato_packages
      (id, title, system_id, package_type, impact_level, authorization_boundary,
       system_owner_id, system_owner_name, isso_id, isso_name,
       authorizing_official_id, authorizing_official_name, notes, created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, title, system_id || null, package_type || 'full_ato', impact_level || 'moderate',
    authorization_boundary || null, system_owner_id || null, system_owner_name || null,
    isso_id || null, isso_name || null,
    authorizing_official_id || null, authorizing_official_name || null,
    notes || null, req.user!.id,
  );

  // Create the three-step signature workflow
  const sigWorkflow = [
    { role: 'system_owner', order: 1, userId: system_owner_id, userName: system_owner_name },
    { role: 'isso',         order: 2, userId: isso_id,         userName: isso_name         },
    { role: 'authorizing_official', order: 3, userId: authorizing_official_id, userName: authorizing_official_name },
  ];
  for (const sig of sigWorkflow) {
    db.prepare(`
      INSERT INTO ato_signatures (id, ato_package_id, role, signature_order, user_id, user_name, status)
      VALUES (?,?,?,?,?,?,'pending')
    `).run(uuidv4(), id, sig.role, sig.order, sig.userId || null, sig.userName || null);
  }

  logChange({ entityType: 'ato_package', entityId: id, entityLabel: title, action: 'create', user: req.user! });
  res.status(201).json(db.prepare('SELECT * FROM ato_packages WHERE id = ?').get(id));
});

// GET /api/ato/:id
router.get('/:id', (req, res) => {
  const pkg = db.prepare(`
    SELECT p.*, s.name as system_name, s.description as system_description,
      s.impact_level as system_impact_level, s.system_type
    FROM ato_packages p LEFT JOIN systems s ON s.id = p.system_id
    WHERE p.id = ?
  `).get(req.params.id) as Record<string, unknown> | undefined;
  if (!pkg) return res.status(404).json({ error: 'Not found' });

  const signatures = db.prepare(
    'SELECT * FROM ato_signatures WHERE ato_package_id = ? ORDER BY signature_order'
  ).all(req.params.id);

  const documents = db.prepare(
    'SELECT id, document_type, title, status, version, generated_at, generated_by, llm_model, word_count, created_at FROM ato_documents WHERE ato_package_id = ? ORDER BY document_type'
  ).all(req.params.id);

  res.json({ ...pkg, signatures, documents });
});

// PATCH /api/ato/:id
router.patch('/:id', requirePermission('ato', 'update'), (req, res) => {
  const fields = [
    'title', 'system_id', 'package_type', 'impact_level', 'authorization_boundary',
    'status', 'system_owner_id', 'system_owner_name', 'isso_id', 'isso_name',
    'authorizing_official_id', 'authorizing_official_name', 'submission_date',
    'decision_date', 'expiration_date', 'denial_reason', 'notes',
  ];
  const updates: Record<string, unknown> = {};
  for (const f of fields) {
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No fields' });
  const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE ato_packages SET ${sets}, updated_at = datetime('now') WHERE id = ?`)
    .run(...Object.values(updates), req.params.id);
  res.json(db.prepare('SELECT * FROM ato_packages WHERE id = ?').get(req.params.id));
});

// DELETE /api/ato/:id
router.delete('/:id', requirePermission('ato', 'delete'), (req, res) => {
  const pkg = db.prepare('SELECT title FROM ato_packages WHERE id = ?').get(req.params.id) as { title: string } | undefined;
  db.prepare('DELETE FROM ato_packages WHERE id = ?').run(req.params.id);
  logChange({ entityType: 'ato_package', entityId: req.params.id, entityLabel: pkg?.title, action: 'delete', user: req.user! });
  res.json({ success: true });
});

// ── Signature Workflow ────────────────────────────────────────────────────────

// POST /api/ato/:id/sign — current user signs their role's slot
router.post('/:id/sign', requirePermission('ato', 'sign'), (req, res) => {
  const pkg = db.prepare('SELECT * FROM ato_packages WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!pkg) return res.status(404).json({ error: 'Package not found' });

  // Find the signature slot for this user's role
  const sig = db.prepare(
    "SELECT * FROM ato_signatures WHERE ato_package_id = ? AND role = ?"
  ).get(req.params.id, req.user!.role) as Record<string, unknown> | undefined;

  if (!sig) {
    return res.status(403).json({ error: `No signature slot for role '${req.user!.role}' on this package` });
  }
  if (sig.status === 'signed') {
    return res.status(409).json({ error: 'Already signed' });
  }

  // Enforce ordered signing: previous signers must have signed first
  const prevPending = db.prepare(
    'SELECT id FROM ato_signatures WHERE ato_package_id = ? AND signature_order < ? AND status != ?'
  ).get(req.params.id, sig.signature_order as number, 'signed');
  if (prevPending) {
    return res.status(400).json({ error: 'Previous signer(s) must sign first' });
  }

  db.prepare(`
    UPDATE ato_signatures SET status='signed', signed_at=datetime('now'), user_id=?, user_name=?, user_email=?
    WHERE ato_package_id=? AND role=?
  `).run(req.user!.id, req.user!.name, req.user!.email, req.params.id, req.user!.role);

  // If AO just signed, automatically approve the package
  if (req.user!.role === 'authorizing_official') {
    const expiresAt = new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    db.prepare(`
      UPDATE ato_packages SET status='approved', decision_date=date('now'), expiration_date=?, updated_at=datetime('now')
      WHERE id=?
    `).run(expiresAt, req.params.id);
    logChange({ entityType: 'ato_package', entityId: req.params.id, entityLabel: pkg.title as string, action: 'approved', user: req.user! });
  } else if (req.user!.role === 'isso') {
    db.prepare(`UPDATE ato_packages SET status='under_review', updated_at=datetime('now') WHERE id=?`).run(req.params.id);
  } else if (req.user!.role === 'system_owner') {
    db.prepare(`UPDATE ato_packages SET status='submitted', updated_at=datetime('now') WHERE id=?`).run(req.params.id);
  }

  logChange({ entityType: 'ato_signature', entityId: sig.id as string, entityLabel: `${pkg.title} — ${req.user!.role}`, action: 'signed', user: req.user! });
  res.json({ success: true, signed_at: new Date().toISOString() });
});

// POST /api/ato/:id/reject — reject/return the package
router.post('/:id/reject', requirePermission('ato', 'sign'), (req, res) => {
  const { reason } = req.body as { reason?: string };
  const pkg = db.prepare('SELECT * FROM ato_packages WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!pkg) return res.status(404).json({ error: 'Package not found' });

  db.prepare(`
    UPDATE ato_signatures SET status='rejected', rejected_at=datetime('now'), rejection_reason=?, user_id=?, user_name=?
    WHERE ato_package_id=? AND role=?
  `).run(reason || null, req.user!.id, req.user!.name, req.params.id, req.user!.role);

  const newStatus = req.user!.role === 'authorizing_official' ? 'denied' : 'in_progress';
  db.prepare(`UPDATE ato_packages SET status=?, denial_reason=?, updated_at=datetime('now') WHERE id=?`)
    .run(newStatus, reason || null, req.params.id);

  logChange({ entityType: 'ato_package', entityId: req.params.id, entityLabel: pkg.title as string, action: 'rejected', user: req.user! });
  res.json({ success: true });
});

// ── Document Generation ───────────────────────────────────────────────────────

// GET /api/ato/document-types
router.get('/meta/document-types', (req, res) => {
  res.json(DOC_TYPE_META);
});

// POST /api/ato/:id/documents/generate
router.post('/:id/documents/generate', requirePermission('ato', 'generate'), async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'AI generation unavailable: ANTHROPIC_API_KEY not configured' });
  }

  const { document_type, model_override } = req.body as { document_type?: string; model_override?: string };
  if (!document_type || !(document_type in DOC_TYPE_META)) {
    return res.status(400).json({ error: 'Invalid document_type', valid: Object.keys(DOC_TYPE_META) });
  }

  const pkg = db.prepare('SELECT id FROM ato_packages WHERE id = ?').get(req.params.id);
  if (!pkg) return res.status(404).json({ error: 'Package not found' });

  try {
    const result = await generateAtoDocument(req.params.id, document_type as DocumentType, model_override);

    // Upsert the document (one per type per package)
    const existing = db.prepare(
      'SELECT id FROM ato_documents WHERE ato_package_id = ? AND document_type = ?'
    ).get(req.params.id, document_type) as { id: string } | undefined;

    if (existing) {
      db.prepare(`
        UPDATE ato_documents SET title=?, content=?, status='generated', generated_at=datetime('now'),
          generated_by='ai', llm_model=?, word_count=?, updated_at=datetime('now')
        WHERE id=?
      `).run(result.title, result.content, result.model, result.wordCount, existing.id);
      res.json({ id: existing.id, ...result });
    } else {
      const docId = uuidv4();
      db.prepare(`
        INSERT INTO ato_documents (id, ato_package_id, document_type, title, content, status, generated_at, generated_by, llm_model, word_count)
        VALUES (?,?,?,?,?,'generated',datetime('now'),'ai',?,?)
      `).run(docId, req.params.id, document_type, result.title, result.content, result.model, result.wordCount);
      res.json({ id: docId, ...result });
    }
  } catch (err) {
    console.error('Document generation failed:', err);
    res.status(500).json({ error: 'Generation failed', detail: String(err) });
  }
});

// GET /api/ato/:packageId/documents/:docId — fetch full document content
router.get('/:packageId/documents/:docId', (req, res) => {
  const doc = db.prepare(
    'SELECT * FROM ato_documents WHERE id = ? AND ato_package_id = ?'
  ).get(req.params.docId, req.params.packageId);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  res.json(doc);
});

// PATCH /api/ato/:packageId/documents/:docId — update content / finalize
router.patch('/:packageId/documents/:docId', requirePermission('ato', 'update'), (req, res) => {
  const { content, status, title } = req.body as { content?: string; status?: string; title?: string };
  const updates: Record<string, unknown> = {};
  if (content  !== undefined) updates.content  = content;
  if (status   !== undefined) updates.status   = status;
  if (title    !== undefined) updates.title    = title;
  if (content  !== undefined) updates.word_count = content.split(/\s+/).filter(Boolean).length;
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No fields' });
  const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE ato_documents SET ${sets}, updated_at = datetime('now') WHERE id = ? AND ato_package_id = ?`)
    .run(...Object.values(updates), req.params.docId, req.params.packageId);
  res.json(db.prepare('SELECT * FROM ato_documents WHERE id = ?').get(req.params.docId));
});

export default router;
