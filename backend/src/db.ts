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
      -- AI review fields
      ai_confidence INTEGER,          -- 0-100 confidence that evidence satisfies its controls
      ai_verdict TEXT,                -- 'satisfies' | 'partial' | 'insufficient' | 'unclear'
      ai_summary TEXT,                -- brief AI rationale
      ai_gaps TEXT,                   -- identified gaps (JSON array of strings)
      ai_reviewed_at TEXT,            -- when AI last reviewed
      ai_reviewed_by TEXT,            -- 'ai' | user id (human reviewer)
      review_notes TEXT,              -- human override notes
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

    CREATE TABLE IF NOT EXISTS policy_acknowledgments (
      id TEXT PRIMARY KEY,
      policy_id TEXT NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      user_name TEXT,
      user_email TEXT,
      acknowledged_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(policy_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_policy_ack_policy ON policy_acknowledgments(policy_id);
    CREATE INDEX IF NOT EXISTS idx_policy_ack_user ON policy_acknowledgments(user_id);

    -- ── ATO (Authority to Operate) ────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS ato_packages (
      id TEXT PRIMARY KEY,
      system_id TEXT REFERENCES systems(id),
      title TEXT NOT NULL,
      package_type TEXT NOT NULL DEFAULT 'full_ato', -- 'full_ato' | 'interim_ato' | 'ato_renewal' | 'continuous_monitoring'
      impact_level TEXT NOT NULL DEFAULT 'moderate', -- 'low' | 'moderate' | 'high'
      status TEXT NOT NULL DEFAULT 'in_progress', -- 'in_progress' | 'submitted' | 'under_review' | 'approved' | 'denied' | 'expired'
      authorization_boundary TEXT,
      system_owner_id TEXT,
      system_owner_name TEXT,
      isso_id TEXT,
      isso_name TEXT,
      authorizing_official_id TEXT,
      authorizing_official_name TEXT,
      submission_date TEXT,
      decision_date TEXT,
      expiration_date TEXT,   -- ATO typically valid 3 years
      denial_reason TEXT,
      notes TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Ordered signature workflow: system_owner → isso → authorizing_official
    CREATE TABLE IF NOT EXISTS ato_signatures (
      id TEXT PRIMARY KEY,
      ato_package_id TEXT NOT NULL REFERENCES ato_packages(id) ON DELETE CASCADE,
      role TEXT NOT NULL,          -- 'system_owner' | 'isso' | 'authorizing_official'
      signature_order INTEGER NOT NULL, -- 1 = first signer, 2 = second, 3 = final
      user_id TEXT,
      user_name TEXT,
      user_email TEXT,
      status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'signed' | 'rejected'
      signed_at TEXT,
      rejected_at TEXT,
      rejection_reason TEXT,
      ip_address TEXT,             -- for audit trail
      UNIQUE(ato_package_id, role)
    );

    CREATE INDEX IF NOT EXISTS idx_ato_sig_pkg ON ato_signatures(ato_package_id);

    -- Generated ATO documents (SSP, RAR, SAR, ATO Letter, POA&M, etc.)
    CREATE TABLE IF NOT EXISTS ato_documents (
      id TEXT PRIMARY KEY,
      ato_package_id TEXT NOT NULL REFERENCES ato_packages(id) ON DELETE CASCADE,
      document_type TEXT NOT NULL, -- 'ssp' | 'rar' | 'sar' | 'ato_letter' | 'poam' | 'iscp' | 'pia' | 'cis' | 'sctm'
      title TEXT NOT NULL,
      content TEXT,                -- full markdown content
      status TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'generated' | 'final'
      version TEXT NOT NULL DEFAULT '1.0',
      generated_at TEXT,
      generated_by TEXT,           -- 'ai' or user id
      llm_model TEXT,              -- which model generated this (e.g. 'claude-sonnet-4-6')
      word_count INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_ato_doc_pkg ON ato_documents(ato_package_id);

    -- App-level settings (LLM selection, etc.)
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Segregation of Duties: per-action permission table
    -- Each role has a set of allowed actions. Conflicting actions (e.g. create+approve)
    -- are intentionally assigned to different roles to enforce SoD.
    CREATE TABLE IF NOT EXISTS role_permissions (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      resource TEXT NOT NULL,  -- 'control' | 'risk' | 'audit' | 'finding' | 'policy' | 'vendor' | 'evidence' | 'user'
      action TEXT NOT NULL,    -- 'create' | 'read' | 'update' | 'delete' | 'approve' | 'publish' | 'assign' | 'remediate'
      UNIQUE(role, resource, action)
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
      password_hash TEXT NOT NULL DEFAULT '',
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

    -- Information systems under assessment (unlimited, each with own scoped data)
    CREATE TABLE IF NOT EXISTS systems (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      system_type TEXT NOT NULL DEFAULT 'major_application',
        -- 'major_application' | 'general_support_system' | 'minor_application'
      status TEXT NOT NULL DEFAULT 'assessment_in_progress',
        -- 'assessment_in_progress' | 'authorized' | 'under_review' | 'decommissioned'
      system_owner TEXT,
      authorizing_official TEXT,
      organization TEXT,
      boundary_description TEXT,
      authorization_date TEXT,
      reauthorization_date TEXT,
      -- Computed/overridden security category (high-water mark from 800-60 types)
      security_category_confidentiality TEXT DEFAULT 'Low',
      security_category_integrity TEXT DEFAULT 'Low',
      security_category_availability TEXT DEFAULT 'Low',
      impact_level TEXT DEFAULT 'Low',      -- 'Low' | 'Moderate' | 'High'
      applicable_baseline TEXT DEFAULT 'Low', -- 'Low' | 'Moderate' | 'High'
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Per-system control implementation status (overrides global controls.status)
    CREATE TABLE IF NOT EXISTS system_control_implementations (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      control_id TEXT NOT NULL REFERENCES controls(id),
      status TEXT NOT NULL DEFAULT 'not_implemented',
        -- 'not_implemented' | 'in_progress' | 'implemented' | 'not_applicable'
      implementation_notes TEXT,
      responsible_team TEXT,
      due_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(system_id, control_id)
    );

    -- Control inheritance: tracks whether a control is system-specific, inherited, or hybrid
    CREATE TABLE IF NOT EXISTS control_inheritance (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      control_id TEXT NOT NULL REFERENCES controls(id),
      implementation_type TEXT NOT NULL DEFAULT 'system_specific',
        -- 'system_specific' | 'inherited' | 'hybrid'
      provider_name TEXT,           -- e.g. "AWS GovCloud", "DoD PKI", "Shared Services"
      provider_type TEXT,           -- 'cloud_provider' | 'shared_service' | 'organization' | 'other'
      provider_authorization TEXT,  -- ATO/P-ATO reference or authority
      inherited_description TEXT,   -- what portion the provider implements
      system_responsibility TEXT,   -- what this system is still responsible for
      authorization_reference TEXT, -- MOU/ISA/SLA reference number
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(system_id, control_id)
    );

    -- Step-level assessment results per NIST 800-53A Rev 5
    -- Each row captures one examine/interview/test step result for one assessment objective
    CREATE TABLE IF NOT EXISTS assessment_step_results (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      control_id TEXT NOT NULL REFERENCES controls(id),
      objective_id TEXT REFERENCES control_assessment_objectives(id),
      procedure_id TEXT REFERENCES control_testing_procedures(id),
      method TEXT NOT NULL,           -- 'examine' | 'interview' | 'test'
      object_description TEXT,        -- specific artifact, person, or mechanism assessed
      result TEXT NOT NULL DEFAULT 'not_assessed',
        -- 'satisfied' | 'other_than_satisfied' | 'not_assessed'
      finding_summary TEXT,           -- assessor's finding narrative
      recommendation TEXT,            -- recommended corrective action
      assessor TEXT,
      assessed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- NIST SP 800-60 Vol 2 Rev 1 information types (seeded from standard)
    CREATE TABLE IF NOT EXISTS nist_800_60_types (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL UNIQUE,  -- e.g. "C.2.1.0"
      name TEXT NOT NULL,
      description TEXT,
      section TEXT NOT NULL,            -- top-level section (C.1, C.2, C.3)
      section_name TEXT NOT NULL,       -- human label for the section
      category TEXT NOT NULL,           -- subcategory label
      confidentiality_impact TEXT NOT NULL DEFAULT 'Low',
        -- 'Low' | 'Moderate' | 'High' | 'N/A'
      integrity_impact TEXT NOT NULL DEFAULT 'Low',
      availability_impact TEXT NOT NULL DEFAULT 'Low',
      rationale TEXT,                   -- brief justification from the standard
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Per-system selected information types (from 800-60 catalog)
    CREATE TABLE IF NOT EXISTS system_information_types (
      id TEXT PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      type_id TEXT NOT NULL REFERENCES nist_800_60_types(id),
      confidentiality_override TEXT,    -- 'Low' | 'Moderate' | 'High' | null = use catalog default
      integrity_override TEXT,
      availability_override TEXT,
      override_justification TEXT,      -- required when overriding
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(system_id, type_id)
    );

    -- Change log for audit trail
    CREATE TABLE IF NOT EXISTS change_log (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,   -- 'control' | 'risk' | 'vendor' | 'policy' | 'asset' | 'audit' | 'finding' | 'evidence' | 'system'
      entity_id TEXT NOT NULL,
      entity_label TEXT,           -- human-readable name/identifier of the entity
      action TEXT NOT NULL,        -- 'create' | 'update' | 'delete'
      field TEXT,                  -- which field changed (null for create/delete)
      old_value TEXT,
      new_value TEXT,
      changed_by TEXT NOT NULL,    -- user id
      changed_by_name TEXT,        -- user name snapshot
      changed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_change_log_entity ON change_log(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_change_log_user ON change_log(changed_by);
    CREATE INDEX IF NOT EXISTS idx_change_log_at ON change_log(changed_at DESC);

    -- Performance indexes
    CREATE INDEX IF NOT EXISTS idx_controls_status ON controls(status);
    CREATE INDEX IF NOT EXISTS idx_controls_framework ON controls(framework_id);
    CREATE INDEX IF NOT EXISTS idx_controls_family ON controls(family_id);
    CREATE INDEX IF NOT EXISTS idx_risks_score ON risks(risk_score DESC);
    CREATE INDEX IF NOT EXISTS idx_risks_status ON risks(status);
    CREATE INDEX IF NOT EXISTS idx_risks_category ON risks(category);
    CREATE INDEX IF NOT EXISTS idx_audit_findings_audit ON audit_findings(audit_id);
    CREATE INDEX IF NOT EXISTS idx_audit_findings_severity ON audit_findings(severity);
    CREATE INDEX IF NOT EXISTS idx_evidence_status ON evidence(status);
    CREATE INDEX IF NOT EXISTS idx_control_evidence_control ON control_evidence(control_id);
    CREATE INDEX IF NOT EXISTS idx_control_evidence_evidence ON control_evidence(evidence_id);
    CREATE INDEX IF NOT EXISTS idx_vendors_status ON vendors(status);
    CREATE INDEX IF NOT EXISTS idx_vendors_tier ON vendors(tier);
    CREATE INDEX IF NOT EXISTS idx_policies_status ON policies(status);
    CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);
    CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
    CREATE INDEX IF NOT EXISTS idx_system_controls_system ON system_control_implementations(system_id);
    CREATE INDEX IF NOT EXISTS idx_compliance_snapshots_fw ON compliance_snapshots(framework_id, snapshot_date);
    CREATE INDEX IF NOT EXISTS idx_risk_snapshots_date ON risk_snapshots(snapshot_date DESC);

    CREATE TABLE IF NOT EXISTS business_questions (
      id TEXT PRIMARY KEY,
      question TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL, -- 'criticality' | 'data_sensitivity' | 'regulatory' | 'exposure' | 'financial'
      answer TEXT, -- 'yes' | 'no' | null (unanswered)
      risk_multiplier REAL NOT NULL DEFAULT 1.0, -- applied to all risk scores when answer = 'yes'
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Seed business questions if none exist
  const bqCount = (db.prepare('SELECT COUNT(*) as c FROM business_questions').get() as { c: number }).c;
  if (bqCount === 0) {
    const { v4: uuidv4bq } = require('uuid');
    const BUSINESS_QUESTIONS = [
      { category: 'criticality', multiplier: 1.5, sort: 1,
        question: 'Is this a mission-critical system where downtime directly disrupts core business operations?',
        description: 'Mission-critical systems have the highest risk exposure. Incidents carry severe operational and financial consequences.' },
      { category: 'criticality', multiplier: 1.3, sort: 2,
        question: 'Would a breach or outage of this system result in significant revenue loss (>$100k)?',
        description: 'Financial exposure amplifies the business impact of any risk materializing.' },
      { category: 'data_sensitivity', multiplier: 1.4, sort: 3,
        question: 'Does this system process or store Personally Identifiable Information (PII) or Protected Health Information (PHI)?',
        description: 'Systems handling PII/PHI face heightened legal liability and regulatory penalties under GDPR, HIPAA, and similar laws.' },
      { category: 'data_sensitivity', multiplier: 1.3, sort: 4,
        question: 'Does this system handle payment card data (PCI-DSS in scope)?',
        description: 'PCI-DSS non-compliance and card data breaches carry heavy fines and card brand penalties.' },
      { category: 'data_sensitivity', multiplier: 1.2, sort: 5,
        question: 'Does this system store or transmit trade secrets, intellectual property, or other proprietary business data?',
        description: 'Loss or exfiltration of IP can have long-term competitive consequences.' },
      { category: 'regulatory', multiplier: 1.3, sort: 6,
        question: 'Is your organization subject to industry-specific regulations (HIPAA, FedRAMP, SOX, FFIEC, NERC CIP)?',
        description: 'Regulatory frameworks impose mandatory security requirements; non-compliance can result in fines or loss of operating licenses.' },
      { category: 'regulatory', multiplier: 1.2, sort: 7,
        question: 'Does your organization have international data transfer obligations (e.g., GDPR cross-border transfers)?',
        description: 'Cross-border data flows add legal complexity and increase the cost of incidents.' },
      { category: 'exposure', multiplier: 1.2, sort: 8,
        question: 'Does this system have publicly accessible internet-facing components (APIs, portals, services)?',
        description: 'Internet exposure increases the attack surface and the likelihood of exploitation.' },
      { category: 'exposure', multiplier: 1.2, sort: 9,
        question: 'Do third-party vendors or partners have privileged access to this system?',
        description: 'Third-party access introduces supply chain and insider threat risks that are harder to control.' },
      { category: 'financial', multiplier: 1.2, sort: 10,
        question: 'Is your organization publicly listed or subject to securities/financial reporting regulations (SOX)?',
        description: 'Public companies face investor and regulatory scrutiny that magnifies the impact of security incidents on stock price and legal liability.' },
    ];
    for (const q of BUSINESS_QUESTIONS) {
      db.prepare(`INSERT INTO business_questions (id, question, description, category, risk_multiplier, sort_order) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(uuidv4bq(), q.question, q.description, q.category, q.multiplier, q.sort);
    }
  }

  // Seed role permissions (SoD-aware)
  const rpCount = (db.prepare('SELECT COUNT(*) as c FROM role_permissions').get() as { c: number }).c;
  if (rpCount === 0) {
    const { v4: uuidv4rp } = require('uuid');
    // SoD rules enforced:
    //  - auditor creates findings; reviewer/compliance_manager remediates (auditor ≠ remediator)
    //  - risk_owner proposes treatment; risk_approver accepts (proposer ≠ approver)
    //  - control_owner submits evidence; reviewer approves (submitter ≠ approver)
    //  - compliance_manager publishes policies; cannot audit against them (author ≠ auditor)
    //  - admin manages users/system; cannot perform GRC operations
    const PERMISSIONS: Array<{ role: string; resource: string; action: string }> = [
      // ── admin: user & system management only ──────────────────────────────
      { role: 'admin', resource: 'user',    action: 'create'    },
      { role: 'admin', resource: 'user',    action: 'read'      },
      { role: 'admin', resource: 'user',    action: 'update'    },
      { role: 'admin', resource: 'user',    action: 'delete'    },
      { role: 'admin', resource: 'system',  action: 'read'      },
      { role: 'admin', resource: 'system',  action: 'update'    },
      // ── compliance_manager: GRC operations; cannot audit ──────────────────
      { role: 'compliance_manager', resource: 'control',  action: 'create'    },
      { role: 'compliance_manager', resource: 'control',  action: 'read'      },
      { role: 'compliance_manager', resource: 'control',  action: 'update'    },
      { role: 'compliance_manager', resource: 'control',  action: 'delete'    },
      { role: 'compliance_manager', resource: 'control',  action: 'assign'    },
      { role: 'compliance_manager', resource: 'control',  action: 'approve'   },
      { role: 'compliance_manager', resource: 'risk',     action: 'read'      },
      { role: 'compliance_manager', resource: 'risk',     action: 'update'    },
      { role: 'compliance_manager', resource: 'policy',   action: 'create'    },
      { role: 'compliance_manager', resource: 'policy',   action: 'read'      },
      { role: 'compliance_manager', resource: 'policy',   action: 'update'    },
      { role: 'compliance_manager', resource: 'policy',   action: 'delete'    },
      { role: 'compliance_manager', resource: 'policy',   action: 'publish'   },
      { role: 'compliance_manager', resource: 'evidence', action: 'read'      },
      { role: 'compliance_manager', resource: 'evidence', action: 'approve'   },
      { role: 'compliance_manager', resource: 'vendor',   action: 'create'    },
      { role: 'compliance_manager', resource: 'vendor',   action: 'read'      },
      { role: 'compliance_manager', resource: 'vendor',   action: 'update'    },
      { role: 'compliance_manager', resource: 'vendor',   action: 'delete'    },
      { role: 'compliance_manager', resource: 'asset',    action: 'create'    },
      { role: 'compliance_manager', resource: 'asset',    action: 'read'      },
      { role: 'compliance_manager', resource: 'asset',    action: 'update'    },
      { role: 'compliance_manager', resource: 'asset',    action: 'delete'    },
      { role: 'compliance_manager', resource: 'audit',    action: 'read'      },
      { role: 'compliance_manager', resource: 'finding',  action: 'read'      },
      { role: 'compliance_manager', resource: 'finding',  action: 'remediate' }, // can close findings, but cannot create them
      // ── risk_owner: proposes risks; cannot approve ─────────────────────────
      { role: 'risk_owner', resource: 'risk',    action: 'create'    },
      { role: 'risk_owner', resource: 'risk',    action: 'read'      },
      { role: 'risk_owner', resource: 'risk',    action: 'update'    },
      { role: 'risk_owner', resource: 'control', action: 'read'      },
      { role: 'risk_owner', resource: 'audit',   action: 'read'      },
      { role: 'risk_owner', resource: 'finding', action: 'read'      },
      { role: 'risk_owner', resource: 'evidence',action: 'read'      },
      { role: 'risk_owner', resource: 'policy',  action: 'read'      },
      { role: 'risk_owner', resource: 'vendor',  action: 'read'      },
      // ── risk_approver: accepts risk; cannot create ─────────────────────────
      { role: 'risk_approver', resource: 'risk',    action: 'read'      },
      { role: 'risk_approver', resource: 'risk',    action: 'update'    },
      { role: 'risk_approver', resource: 'risk',    action: 'approve'   },
      { role: 'risk_approver', resource: 'control', action: 'read'      },
      { role: 'risk_approver', resource: 'audit',   action: 'read'      },
      { role: 'risk_approver', resource: 'finding', action: 'read'      },
      // ── auditor: creates audits & findings; cannot remediate ───────────────
      { role: 'auditor', resource: 'audit',   action: 'create'    },
      { role: 'auditor', resource: 'audit',   action: 'read'      },
      { role: 'auditor', resource: 'audit',   action: 'update'    },
      { role: 'auditor', resource: 'finding', action: 'create'    },
      { role: 'auditor', resource: 'finding', action: 'read'      },
      { role: 'auditor', resource: 'finding', action: 'update'    },
      // SoD: auditor explicitly CANNOT 'remediate' findings
      { role: 'auditor', resource: 'control', action: 'read'      },
      { role: 'auditor', resource: 'risk',    action: 'read'      },
      { role: 'auditor', resource: 'evidence',action: 'read'      },
      { role: 'auditor', resource: 'policy',  action: 'read'      },
      { role: 'auditor', resource: 'vendor',  action: 'read'      },
      { role: 'auditor', resource: 'asset',   action: 'read'      },
      // ── control_owner: implements controls, submits evidence; cannot approve
      { role: 'control_owner', resource: 'control',  action: 'read'      },
      { role: 'control_owner', resource: 'control',  action: 'update'    },
      { role: 'control_owner', resource: 'evidence', action: 'create'    },
      { role: 'control_owner', resource: 'evidence', action: 'read'      },
      { role: 'control_owner', resource: 'risk',     action: 'read'      },
      { role: 'control_owner', resource: 'audit',    action: 'read'      },
      { role: 'control_owner', resource: 'finding',  action: 'read'      },
      { role: 'control_owner', resource: 'policy',   action: 'read'      },
      // ── reviewer: approves evidence & controls; cannot create them ─────────
      { role: 'reviewer', resource: 'control',  action: 'read'      },
      { role: 'reviewer', resource: 'control',  action: 'approve'   },
      { role: 'reviewer', resource: 'evidence', action: 'read'      },
      { role: 'reviewer', resource: 'evidence', action: 'approve'   },
      { role: 'reviewer', resource: 'finding',  action: 'read'      },
      { role: 'reviewer', resource: 'finding',  action: 'remediate' },
      { role: 'reviewer', resource: 'risk',     action: 'read'      },
      { role: 'reviewer', resource: 'risk',     action: 'approve'   },
      { role: 'reviewer', resource: 'audit',    action: 'read'      },
      { role: 'reviewer', resource: 'policy',   action: 'read'      },
      { role: 'reviewer', resource: 'vendor',   action: 'read'      },
      // ── viewer: read-only across everything ───────────────────────────────
      { role: 'viewer', resource: 'control',  action: 'read' },
      { role: 'viewer', resource: 'risk',     action: 'read' },
      { role: 'viewer', resource: 'audit',    action: 'read' },
      { role: 'viewer', resource: 'finding',  action: 'read' },
      { role: 'viewer', resource: 'evidence', action: 'read' },
      { role: 'viewer', resource: 'policy',   action: 'read' },
      { role: 'viewer', resource: 'vendor',   action: 'read' },
      { role: 'viewer', resource: 'asset',    action: 'read' },
      // ── system_owner: manages system info, owns ATO package, signs first ──
      { role: 'system_owner', resource: 'system',   action: 'read'      },
      { role: 'system_owner', resource: 'system',   action: 'update'    },
      { role: 'system_owner', resource: 'control',  action: 'read'      },
      { role: 'system_owner', resource: 'control',  action: 'update'    },
      { role: 'system_owner', resource: 'control',  action: 'assign'    },
      { role: 'system_owner', resource: 'risk',     action: 'read'      },
      { role: 'system_owner', resource: 'risk',     action: 'create'    },
      { role: 'system_owner', resource: 'risk',     action: 'update'    },
      { role: 'system_owner', resource: 'evidence', action: 'create'    },
      { role: 'system_owner', resource: 'evidence', action: 'read'      },
      { role: 'system_owner', resource: 'policy',   action: 'read'      },
      { role: 'system_owner', resource: 'audit',    action: 'read'      },
      { role: 'system_owner', resource: 'finding',  action: 'read'      },
      { role: 'system_owner', resource: 'vendor',   action: 'read'      },
      { role: 'system_owner', resource: 'ato',      action: 'read'      },
      { role: 'system_owner', resource: 'ato',      action: 'update'    },
      { role: 'system_owner', resource: 'ato',      action: 'sign'      }, // signs ATO package
      // ── isso: security officer; creates & manages ATO package, certifies ──
      { role: 'isso', resource: 'system',   action: 'read'      },
      { role: 'isso', resource: 'system',   action: 'update'    },
      { role: 'isso', resource: 'control',  action: 'create'    },
      { role: 'isso', resource: 'control',  action: 'read'      },
      { role: 'isso', resource: 'control',  action: 'update'    },
      { role: 'isso', resource: 'control',  action: 'approve'   },
      { role: 'isso', resource: 'risk',     action: 'create'    },
      { role: 'isso', resource: 'risk',     action: 'read'      },
      { role: 'isso', resource: 'risk',     action: 'update'    },
      { role: 'isso', resource: 'risk',     action: 'approve'   },
      { role: 'isso', resource: 'evidence', action: 'create'    },
      { role: 'isso', resource: 'evidence', action: 'read'      },
      { role: 'isso', resource: 'evidence', action: 'approve'   },
      { role: 'isso', resource: 'policy',   action: 'create'    },
      { role: 'isso', resource: 'policy',   action: 'read'      },
      { role: 'isso', resource: 'policy',   action: 'update'    },
      { role: 'isso', resource: 'policy',   action: 'publish'   },
      { role: 'isso', resource: 'audit',    action: 'create'    },
      { role: 'isso', resource: 'audit',    action: 'read'      },
      { role: 'isso', resource: 'audit',    action: 'update'    },
      { role: 'isso', resource: 'finding',  action: 'create'    },
      { role: 'isso', resource: 'finding',  action: 'read'      },
      { role: 'isso', resource: 'finding',  action: 'update'    },
      { role: 'isso', resource: 'finding',  action: 'remediate' },
      { role: 'isso', resource: 'vendor',   action: 'read'      },
      { role: 'isso', resource: 'vendor',   action: 'update'    },
      { role: 'isso', resource: 'ato',      action: 'create'    },
      { role: 'isso', resource: 'ato',      action: 'read'      },
      { role: 'isso', resource: 'ato',      action: 'update'    },
      { role: 'isso', resource: 'ato',      action: 'delete'    },
      { role: 'isso', resource: 'ato',      action: 'sign'      }, // certifies the package
      { role: 'isso', resource: 'ato',      action: 'generate'  }, // generates documents
      // ── authorizing_official: reviews & grants ATO; final signer ──────────
      { role: 'authorizing_official', resource: 'system',   action: 'read'    },
      { role: 'authorizing_official', resource: 'control',  action: 'read'    },
      { role: 'authorizing_official', resource: 'risk',     action: 'read'    },
      { role: 'authorizing_official', resource: 'risk',     action: 'approve' },
      { role: 'authorizing_official', resource: 'evidence', action: 'read'    },
      { role: 'authorizing_official', resource: 'evidence', action: 'approve' },
      { role: 'authorizing_official', resource: 'policy',   action: 'read'    },
      { role: 'authorizing_official', resource: 'audit',    action: 'read'    },
      { role: 'authorizing_official', resource: 'finding',  action: 'read'    },
      { role: 'authorizing_official', resource: 'vendor',   action: 'read'    },
      { role: 'authorizing_official', resource: 'ato',      action: 'read'    },
      { role: 'authorizing_official', resource: 'ato',      action: 'approve' }, // grants/denies ATO
      { role: 'authorizing_official', resource: 'ato',      action: 'sign'    }, // final authoritative signature
    ];
    for (const p of PERMISSIONS) {
      db.prepare(`INSERT OR IGNORE INTO role_permissions (id, role, resource, action) VALUES (?, ?, ?, ?)`)
        .run(uuidv4rp(), p.role, p.resource, p.action);
    }
  }

  // Seed default app settings
  const settingDefaults: Record<string, string> = {
    llm_model:     'claude-sonnet-4-6',
    login_banner:  '',
  };
  for (const [key, value] of Object.entries(settingDefaults)) {
    db.prepare('INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)').run(key, value);
  }

  // Seed default admin user if none exists
  // Password: Admin@123 (bcrypt hash)
  const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@trustops.local');
  if (!adminExists) {
    const { v4: uuidv4 } = require('uuid');
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('Admin@123', 10);
    db.prepare(
      `INSERT INTO users (id, email, password_hash, name, role, department, active) VALUES (?, ?, ?, ?, ?, ?, 1)`
    ).run(uuidv4(), 'admin@trustops.local', hash, 'Platform Admin', 'admin', 'IT Security');
  }
}

export default db;
