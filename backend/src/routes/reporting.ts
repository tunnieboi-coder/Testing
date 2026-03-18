import { Router } from 'express';
import db from '../db';

const router = Router();

router.get('/executive-summary', (req, res) => {
  const frameworks = db.prepare('SELECT * FROM frameworks').all() as Array<{ id: string; name: string; version: string }>;

  const frameworkData = frameworks.map(fw => {
    const total = (db.prepare('SELECT COUNT(*) as c FROM controls WHERE framework_id = ?').get(fw.id) as { c: number }).c;
    const implemented = (db.prepare("SELECT COUNT(*) as c FROM controls WHERE framework_id = ? AND status = 'implemented'").get(fw.id) as { c: number }).c;
    const in_progress = (db.prepare("SELECT COUNT(*) as c FROM controls WHERE framework_id = ? AND status = 'in_progress'").get(fw.id) as { c: number }).c;
    const not_applicable = (db.prepare("SELECT COUNT(*) as c FROM controls WHERE framework_id = ? AND status = 'not_applicable'").get(fw.id) as { c: number }).c;
    const applicable = total - not_applicable;
    const score = applicable > 0 ? Math.round(((implemented + in_progress * 0.5) / applicable) * 1000) / 10 : 0;

    // By family
    const byFamily = db.prepare(`
      SELECT cf.identifier, cf.name, COUNT(*) as total,
        SUM(CASE WHEN c.status='implemented' THEN 1 ELSE 0 END) as implemented,
        SUM(CASE WHEN c.status='in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN c.status='not_implemented' THEN 1 ELSE 0 END) as not_implemented
      FROM controls c JOIN control_families cf ON c.family_id = cf.id
      WHERE c.framework_id = ?
      GROUP BY cf.id ORDER BY cf.identifier
    `).all(fw.id);

    return { ...fw, total, implemented, in_progress, not_applicable, not_implemented: total - implemented - in_progress - not_applicable, score, byFamily };
  });

  const riskSummary = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN risk_score >= 20 THEN 1 ELSE 0 END) as critical,
      SUM(CASE WHEN risk_score >= 15 AND risk_score < 20 THEN 1 ELSE 0 END) as high,
      SUM(CASE WHEN risk_score >= 9 AND risk_score < 15 THEN 1 ELSE 0 END) as medium,
      SUM(CASE WHEN risk_score < 9 THEN 1 ELSE 0 END) as low,
      AVG(risk_score) as avg_score
    FROM risks WHERE status != 'closed'
  `).get();

  const topRisks = db.prepare("SELECT * FROM risks WHERE status != 'closed' ORDER BY risk_score DESC LIMIT 10").all();

  const vendorStats = db.prepare(`
    SELECT risk_rating, COUNT(*) as count FROM vendors WHERE status IN ('active','approved') GROUP BY risk_rating
  `).all();

  const policyStats = db.prepare(`
    SELECT status, COUNT(*) as count FROM policies GROUP BY status
  `).all();

  const openFindings = db.prepare(`
    SELECT af.*, a.title as audit_title FROM audit_findings af JOIN audits a ON af.audit_id = a.id
    WHERE af.status IN ('open', 'in_progress')
    ORDER BY af.severity ASC LIMIT 10
  `).all();

  const complianceTrend = db.prepare(`
    SELECT cs.snapshot_date, cs.compliance_score, f.name as framework_name
    FROM compliance_snapshots cs JOIN frameworks f ON cs.framework_id = f.id
    WHERE cs.snapshot_date >= date('now', '-6 months')
    ORDER BY cs.snapshot_date ASC
  `).all();

  res.json({
    generatedAt: new Date().toISOString(),
    frameworks: frameworkData,
    riskSummary,
    topRisks,
    vendorStats,
    policyStats,
    openFindings,
    complianceTrend,
  });
});

router.get('/control-gap-analysis', (req, res) => {
  const { framework_id } = req.query as { framework_id?: string };
  let query = `
    SELECT c.identifier, c.title, c.status, c.priority, c.cia_confidentiality, c.cia_integrity, c.cia_availability,
      cf.name as family_name, f.name as framework_name,
      COUNT(ce.evidence_id) as evidence_count
    FROM controls c
    JOIN frameworks f ON c.framework_id = f.id
    LEFT JOIN control_families cf ON c.family_id = cf.id
    LEFT JOIN control_evidence ce ON ce.control_id = c.id
    WHERE c.status != 'not_applicable'
  `;
  const params: unknown[] = [];
  if (framework_id) { query += ' AND c.framework_id = ?'; params.push(framework_id); }
  query += ` GROUP BY c.id ORDER BY f.name, c.identifier`;
  const controls = db.prepare(query).all(...params);
  res.json(controls);
});

router.get('/audit-history', (req, res) => {
  const audits = db.prepare(`
    SELECT a.*, f.name as framework_name,
      COUNT(af.id) as total_findings,
      SUM(CASE WHEN af.status = 'remediated' THEN 1 ELSE 0 END) as remediated_findings
    FROM audits a
    LEFT JOIN frameworks f ON a.framework_id = f.id
    LEFT JOIN audit_findings af ON af.audit_id = a.id
    GROUP BY a.id
    ORDER BY a.created_at DESC
  `).all();
  res.json(audits);
});

export default router;
