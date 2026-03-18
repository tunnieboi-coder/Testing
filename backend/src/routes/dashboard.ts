import { Router } from 'express';
import db from '../db';

const router = Router();

router.get('/stats', (req, res) => {
  const frameworks = db.prepare('SELECT id, name, version FROM frameworks').all() as Array<{ id: string; name: string; version: string }>;
  const frameworkStats = frameworks.map(fw => {
    const total = (db.prepare('SELECT COUNT(*) as c FROM controls WHERE framework_id = ?').get(fw.id) as { c: number }).c;
    const implemented = (db.prepare("SELECT COUNT(*) as c FROM controls WHERE framework_id = ? AND status = 'implemented'").get(fw.id) as { c: number }).c;
    const in_progress = (db.prepare("SELECT COUNT(*) as c FROM controls WHERE framework_id = ? AND status = 'in_progress'").get(fw.id) as { c: number }).c;
    const not_applicable = (db.prepare("SELECT COUNT(*) as c FROM controls WHERE framework_id = ? AND status = 'not_applicable'").get(fw.id) as { c: number }).c;
    const applicable = total - not_applicable;
    const score = applicable > 0 ? Math.round(((implemented + in_progress * 0.5) / applicable) * 1000) / 10 : 0;
    return { ...fw, total, implemented, in_progress, not_applicable, not_implemented: total - implemented - in_progress - not_applicable, score };
  });

  const totalRisks = (db.prepare("SELECT COUNT(*) as c FROM risks WHERE status != 'closed'").get() as { c: number }).c;
  const criticalRisks = (db.prepare("SELECT COUNT(*) as c FROM risks WHERE risk_score >= 20 AND status != 'closed'").get() as { c: number }).c;
  const highRisks = (db.prepare("SELECT COUNT(*) as c FROM risks WHERE risk_score >= 15 AND risk_score < 20 AND status != 'closed'").get() as { c: number }).c;
  const mediumRisks = (db.prepare("SELECT COUNT(*) as c FROM risks WHERE risk_score >= 9 AND risk_score < 15 AND status != 'closed'").get() as { c: number }).c;
  const lowRisks = (db.prepare("SELECT COUNT(*) as c FROM risks WHERE risk_score < 9 AND status != 'closed'").get() as { c: number }).c;

  const activeVendors = (db.prepare("SELECT COUNT(*) as c FROM vendors WHERE status = 'active' OR status = 'approved'").get() as { c: number }).c;
  const highRiskVendors = (db.prepare("SELECT COUNT(*) as c FROM vendors WHERE risk_rating IN ('high', 'critical') AND (status = 'active' OR status = 'approved')").get() as { c: number }).c;

  const publishedPolicies = (db.prepare("SELECT COUNT(*) as c FROM policies WHERE status = 'published'").get() as { c: number }).c;
  const reviewDuePolicies = (db.prepare("SELECT COUNT(*) as c FROM policies WHERE next_review_at < datetime('now', '+30 days') AND status = 'published'").get() as { c: number }).c;

  const openFindings = (db.prepare("SELECT COUNT(*) as c FROM audit_findings WHERE status IN ('open', 'in_progress')").get() as { c: number }).c;
  const criticalFindings = (db.prepare("SELECT COUNT(*) as c FROM audit_findings WHERE severity = 'critical' AND status IN ('open', 'in_progress')").get() as { c: number }).c;

  const activeIntegrations = (db.prepare("SELECT COUNT(*) as c FROM integrations WHERE status = 'active'").get() as { c: number }).c;
  const totalEvidenceCollected = (db.prepare("SELECT COALESCE(SUM(evidence_collected), 0) as c FROM integrations").get() as { c: number }).c;

  // Recent activity
  const recentAudits = db.prepare("SELECT id, title, status, type, start_date FROM audits ORDER BY created_at DESC LIMIT 5").all();
  const openTasks = (db.prepare("SELECT COUNT(*) as c FROM tasks WHERE status IN ('open', 'in_progress')").get() as { c: number }).c;

  res.json({
    frameworks: frameworkStats,
    risks: { total: totalRisks, critical: criticalRisks, high: highRisks, medium: mediumRisks, low: lowRisks },
    vendors: { total: activeVendors, highRisk: highRiskVendors },
    policies: { published: publishedPolicies, reviewDue: reviewDuePolicies },
    findings: { open: openFindings, critical: criticalFindings },
    integrations: { active: activeIntegrations, evidenceCollected: totalEvidenceCollected },
    tasks: { open: openTasks },
    recentAudits,
  });
});

router.get('/compliance-trend', (req, res) => {
  const data = db.prepare(`
    SELECT cs.snapshot_date, cs.compliance_score, cs.implemented, cs.in_progress, cs.not_implemented, cs.not_applicable, cs.total_controls, f.name as framework_name
    FROM compliance_snapshots cs
    JOIN frameworks f ON cs.framework_id = f.id
    ORDER BY cs.snapshot_date ASC
  `).all();
  res.json(data);
});

router.get('/risk-trend', (req, res) => {
  const data = db.prepare(`
    SELECT snapshot_date, critical_count, high_count, medium_count, low_count, total_open, avg_risk_score
    FROM risk_snapshots
    ORDER BY snapshot_date ASC
  `).all();
  res.json(data);
});

router.get('/control-status-distribution', (req, res) => {
  const data = db.prepare(`
    SELECT f.name as framework, c.status, COUNT(*) as count
    FROM controls c
    JOIN frameworks f ON c.framework_id = f.id
    GROUP BY f.name, c.status
    ORDER BY f.name, c.status
  `).all();
  res.json(data);
});

router.get('/risk-heatmap', (req, res) => {
  const data = db.prepare(`
    SELECT likelihood, impact, COUNT(*) as count, GROUP_CONCAT(title, '||') as titles
    FROM risks
    WHERE status != 'closed'
    GROUP BY likelihood, impact
  `).all();
  res.json(data);
});

router.get('/evidence-coverage', (req, res) => {
  const data = db.prepare(`
    SELECT f.name as framework,
      COUNT(DISTINCT c.id) as total_controls,
      COUNT(DISTINCT ce.control_id) as controls_with_evidence,
      CAST(COUNT(DISTINCT ce.control_id) AS FLOAT) / NULLIF(COUNT(DISTINCT c.id), 0) * 100 as coverage_pct
    FROM frameworks f
    JOIN controls c ON c.framework_id = f.id
    LEFT JOIN control_evidence ce ON ce.control_id = c.id
    GROUP BY f.name
  `).all();
  res.json(data);
});

router.get('/upcoming-reviews', (req, res) => {
  const audits = db.prepare(`
    SELECT id, title, type, start_date, status FROM audits
    WHERE start_date >= date('now') AND status IN ('planned','in_progress')
    ORDER BY start_date ASC LIMIT 5
  `).all();
  const policies = db.prepare(`
    SELECT id, title, next_review_at, owner FROM policies
    WHERE next_review_at >= date('now') AND status = 'published'
    ORDER BY next_review_at ASC LIMIT 5
  `).all();
  const vendors = db.prepare(`
    SELECT id, name, next_review_date, risk_rating FROM vendors
    WHERE next_review_date >= date('now') AND (status = 'active' OR status = 'approved')
    ORDER BY next_review_date ASC LIMIT 5
  `).all();
  res.json({ audits, policies, vendors });
});

export default router;
