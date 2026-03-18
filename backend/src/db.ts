import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const DB_PATH = path.join(DB_DIR, 'grc.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS frameworks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      version TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL, -- 'nist' | 'iso' | 'soc2' | 'custom'
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS control_families (
      id TEXT PRIMARY KEY,
      framework_id TEXT NOT NULL REFERENCES frameworks(id),
      identifier TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS controls (
      id TEXT PRIMARY KEY,
      framework_id TEXT NOT NULL REFERENCES frameworks(id),
      family_id TEXT REFERENCES control_families(id),
      identifier TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      guidance TEXT,
      discussion TEXT,
      priority TEXT, -- P0-P3 for NIST
      baseline_low INTEGER DEFAULT 0,
      baseline_moderate INTEGER DEFAULT 0,
      baseline_high INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'not_implemented', -- not_implemented | in_progress | implemented | not_applicable
      implementation_notes TEXT,
      responsible_team TEXT,
      due_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS control_enhancements (
      id TEXT PRIMARY KEY,
      control_id TEXT NOT NULL REFERENCES controls(id),
      number INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_implemented',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS evidence (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL, -- 'document' | 'screenshot' | 'config' | 'log' | 'attestation'
      source TEXT, -- 'manual' | 'automated' | 'integration'
      filename TEXT,
      url TEXT,
      collected_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT,
      status TEXT NOT NULL DEFAULT 'valid', -- 'valid' | 'expired' | 'review_needed'
      collected_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS control_evidence (
      id TEXT PRIMARY KEY,
      control_id TEXT NOT NULL REFERENCES controls(id),
      evidence_id TEXT NOT NULL REFERENCES evidence(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(control_id, evidence_id)
    );

    CREATE TABLE IF NOT EXISTS risks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL, -- 'operational' | 'technical' | 'compliance' | 'strategic' | 'financial'
      likelihood INTEGER NOT NULL DEFAULT 3, -- 1-5
      impact INTEGER NOT NULL DEFAULT 3, -- 1-5
      risk_score INTEGER GENERATED ALWAYS AS (likelihood * impact) STORED,
      status TEXT NOT NULL DEFAULT 'open', -- 'open' | 'mitigated' | 'accepted' | 'transferred' | 'closed'
      owner TEXT,
      treatment TEXT, -- 'mitigate' | 'accept' | 'transfer' | 'avoid'
      treatment_notes TEXT,
      residual_likelihood INTEGER,
      residual_impact INTEGER,
      due_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS control_risks (
      id TEXT PRIMARY KEY,
      control_id TEXT NOT NULL REFERENCES controls(id),
      risk_id TEXT NOT NULL REFERENCES risks(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(control_id, risk_id)
    );

    CREATE TABLE IF NOT EXISTS vendors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      website TEXT,
      description TEXT,
      category TEXT NOT NULL, -- 'cloud' | 'saas' | 'infrastructure' | 'security' | 'hr' | 'finance' | 'other'
      tier INTEGER NOT NULL DEFAULT 2, -- 1=critical, 2=important, 3=standard
      status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'under_review' | 'approved' | 'rejected' | 'offboarded'
      risk_rating TEXT DEFAULT 'medium', -- 'low' | 'medium' | 'high' | 'critical'
      contact_name TEXT,
      contact_email TEXT,
      soc2_report_url TEXT,
      iso_cert_url TEXT,
      last_review_date TEXT,
      next_review_date TEXT,
      data_types TEXT, -- JSON array
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS policies (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL, -- 'security' | 'privacy' | 'hr' | 'it' | 'compliance' | 'operational'
      status TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'review' | 'approved' | 'published' | 'archived'
      version TEXT NOT NULL DEFAULT '1.0',
      owner TEXT,
      approver TEXT,
      content TEXT,
      review_frequency TEXT DEFAULT 'annual', -- 'monthly' | 'quarterly' | 'annual'
      last_reviewed_at TEXT,
      next_review_at TEXT,
      published_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL, -- 'server' | 'workstation' | 'network' | 'application' | 'database' | 'saas' | 'cloud' | 'mobile'
      category TEXT NOT NULL DEFAULT 'hardware', -- 'hardware' | 'software' | 'data' | 'cloud' | 'people'
      owner TEXT,
      custodian TEXT,
      location TEXT,
      classification TEXT NOT NULL DEFAULT 'internal', -- 'public' | 'internal' | 'confidential' | 'restricted'
      status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'inactive' | 'retired' | 'disposed'
      criticality TEXT NOT NULL DEFAULT 'medium', -- 'low' | 'medium' | 'high' | 'critical'
      ip_address TEXT,
      hostname TEXT,
      os TEXT,
      version TEXT,
      vendor TEXT,
      purchase_date TEXT,
      end_of_life TEXT,
      tags TEXT, -- JSON array
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audits (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL, -- 'internal' | 'external' | 'certification' | 'penetration_test' | 'vulnerability_scan'
      framework_id TEXT REFERENCES frameworks(id),
      status TEXT NOT NULL DEFAULT 'planned', -- 'planned' | 'in_progress' | 'completed' | 'cancelled'
      auditor TEXT,
      auditor_firm TEXT,
      scope TEXT,
      start_date TEXT,
      end_date TEXT,
      report_url TEXT,
      findings_count INTEGER DEFAULT 0,
      critical_findings INTEGER DEFAULT 0,
      high_findings INTEGER DEFAULT 0,
      medium_findings INTEGER DEFAULT 0,
      low_findings INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_findings (
      id TEXT PRIMARY KEY,
      audit_id TEXT NOT NULL REFERENCES audits(id),
      control_id TEXT REFERENCES controls(id),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'medium', -- 'critical' | 'high' | 'medium' | 'low' | 'informational'
      status TEXT NOT NULL DEFAULT 'open', -- 'open' | 'in_progress' | 'remediated' | 'accepted' | 'closed'
      recommendation TEXT,
      management_response TEXT,
      due_date TEXT,
      remediated_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS integrations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL, -- 'aws' | 'gcp' | 'azure' | 'github' | 'okta' | 'crowdstrike' | 'qualys' | 'jira' | 'slack'
      status TEXT NOT NULL DEFAULT 'inactive', -- 'active' | 'inactive' | 'error' | 'configuring'
      config TEXT, -- JSON encrypted config
      last_sync TEXT,
      sync_frequency TEXT DEFAULT 'daily',
      controls_mapped INTEGER DEFAULT 0,
      evidence_collected INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer', -- 'admin' | 'compliance_manager' | 'auditor' | 'viewer'
      department TEXT,
      avatar TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info', -- 'info' | 'warning' | 'error' | 'success'
      read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL, -- 'control_review' | 'evidence_collection' | 'risk_assessment' | 'vendor_review' | 'policy_review'
      status TEXT NOT NULL DEFAULT 'open', -- 'open' | 'in_progress' | 'completed' | 'cancelled'
      priority TEXT NOT NULL DEFAULT 'medium', -- 'low' | 'medium' | 'high' | 'critical'
      assignee_id TEXT REFERENCES users(id),
      related_id TEXT, -- id of related entity
      related_type TEXT, -- 'control' | 'risk' | 'vendor' | 'policy'
      due_date TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      entity_type TEXT NOT NULL, -- 'control' | 'risk' | 'vendor' | 'policy' | 'audit' | 'evidence'
      user_id TEXT REFERENCES users(id),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

export default db;
