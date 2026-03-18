import db, { initDb } from './db';
import { v4 as uuidv4 } from 'uuid';
import { NIST_FAMILIES, NIST_CONTROLS } from './data/nist-800-53-families';
import { ISO_DOMAINS, ISO_CONTROLS, NIST_ISO_MAPPING } from './data/iso-27001';
import { CONTROL_CIA_PROFILES } from './data/nist-cia-testing';

initDb();

// Add CIA profile columns and testing data if not present
try {
  db.exec(`
    ALTER TABLE controls ADD COLUMN cia_confidentiality TEXT DEFAULT 'M';
    ALTER TABLE controls ADD COLUMN cia_integrity TEXT DEFAULT 'M';
    ALTER TABLE controls ADD COLUMN cia_availability TEXT DEFAULT 'M';
  `);
} catch { /* columns already exist */ }

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS control_testing_procedures (
      id TEXT PRIMARY KEY,
      control_id TEXT NOT NULL REFERENCES controls(id),
      procedure_type TEXT NOT NULL, -- 'examine' | 'interview' | 'test'
      description TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS control_assessment_objectives (
      id TEXT PRIMARY KEY,
      control_id TEXT NOT NULL REFERENCES controls(id),
      objective TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_assessed', -- 'satisfied' | 'other_than_satisfied' | 'not_assessed'
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS framework_mappings (
      id TEXT PRIMARY KEY,
      source_framework_id TEXT NOT NULL,
      source_control_id TEXT NOT NULL,
      target_framework_id TEXT NOT NULL,
      target_control_id TEXT NOT NULL,
      mapping_type TEXT NOT NULL DEFAULT 'related', -- 'equivalent' | 'related' | 'partial'
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(source_control_id, target_control_id)
    );
    CREATE TABLE IF NOT EXISTS compliance_snapshots (
      id TEXT PRIMARY KEY,
      framework_id TEXT NOT NULL REFERENCES frameworks(id),
      snapshot_date TEXT NOT NULL,
      total_controls INTEGER NOT NULL DEFAULT 0,
      implemented INTEGER NOT NULL DEFAULT 0,
      in_progress INTEGER NOT NULL DEFAULT 0,
      not_implemented INTEGER NOT NULL DEFAULT 0,
      not_applicable INTEGER NOT NULL DEFAULT 0,
      compliance_score REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS risk_snapshots (
      id TEXT PRIMARY KEY,
      snapshot_date TEXT NOT NULL,
      critical_count INTEGER NOT NULL DEFAULT 0,
      high_count INTEGER NOT NULL DEFAULT 0,
      medium_count INTEGER NOT NULL DEFAULT 0,
      low_count INTEGER NOT NULL DEFAULT 0,
      total_open INTEGER NOT NULL DEFAULT 0,
      avg_risk_score REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS technical_profile (
      id TEXT PRIMARY KEY,
      question TEXT NOT NULL,
      category TEXT NOT NULL,
      answer TEXT,
      impact_controls TEXT, -- JSON array of control IDs
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
} catch { /* tables already exist */ }

console.log('Seeding database...');

// Clear existing data
db.exec(`
  DELETE FROM framework_mappings;
  DELETE FROM control_testing_procedures;
  DELETE FROM control_assessment_objectives;
  DELETE FROM control_evidence;
  DELETE FROM control_enhancements;
  DELETE FROM control_risks;
  DELETE FROM controls;
  DELETE FROM control_families;
  DELETE FROM frameworks;
  DELETE FROM risks;
  DELETE FROM vendors;
  DELETE FROM policies;
  DELETE FROM assets;
  DELETE FROM audits;
  DELETE FROM audit_findings;
  DELETE FROM integrations;
  DELETE FROM users;
  DELETE FROM tasks;
  DELETE FROM compliance_snapshots;
  DELETE FROM risk_snapshots;
  DELETE FROM technical_profile;
`);

// Insert frameworks
const nistFrameworkId = uuidv4();
const isoFrameworkId = uuidv4();

db.prepare(`INSERT INTO frameworks (id, name, version, description, type) VALUES (?, ?, ?, ?, ?)`).run(
  nistFrameworkId, 'NIST SP 800-53', 'Rev 5', 'Security and Privacy Controls for Information Systems and Organizations', 'nist'
);
db.prepare(`INSERT INTO frameworks (id, name, version, description, type) VALUES (?, ?, ?, ?, ?)`).run(
  isoFrameworkId, 'ISO/IEC 27001', '2022', 'Information security management systems — Requirements', 'iso'
);

// Insert NIST families
const nistFamilyIdMap: Record<string, string> = {};
for (const family of NIST_FAMILIES) {
  const id = uuidv4();
  nistFamilyIdMap[family.id] = id;
  db.prepare(`INSERT INTO control_families (id, framework_id, identifier, name, description) VALUES (?, ?, ?, ?, ?)`).run(
    id, nistFrameworkId, family.id, family.name, family.description
  );
}

// Insert NIST controls with CIA values
const nistControlIdMap: Record<string, string> = {};
const ciaMap = new Map(CONTROL_CIA_PROFILES.map(p => [p.controlId, p]));

for (const ctrl of NIST_CONTROLS) {
  const id = uuidv4();
  nistControlIdMap[ctrl.id] = id;
  const familyId = nistFamilyIdMap[ctrl.familyId];
  const cia = ciaMap.get(ctrl.id);

  db.prepare(`
    INSERT INTO controls (id, framework_id, family_id, identifier, title, description, guidance, priority,
      baseline_low, baseline_moderate, baseline_high, cia_confidentiality, cia_integrity, cia_availability)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, nistFrameworkId, familyId, ctrl.id, ctrl.title, ctrl.description,
    ctrl.guidance || null, ctrl.priority || 'P2',
    ctrl.baselineLow || 0, ctrl.baselineModerate || 0, ctrl.baselineHigh || 0,
    cia?.confidentiality || 'M', cia?.integrity || 'M', cia?.availability || 'M'
  );

  // Insert assessment objectives and testing procedures
  if (cia) {
    for (const obj of cia.assessmentObjectives) {
      db.prepare(`INSERT INTO control_assessment_objectives (id, control_id, objective) VALUES (?, ?, ?)`)
        .run(uuidv4(), id, obj);
    }
    for (const item of cia.examineItems) {
      db.prepare(`INSERT INTO control_testing_procedures (id, control_id, procedure_type, description) VALUES (?, ?, ?, ?)`)
        .run(uuidv4(), id, 'examine', item);
    }
    for (const target of cia.interviewTargets) {
      db.prepare(`INSERT INTO control_testing_procedures (id, control_id, procedure_type, description) VALUES (?, ?, ?, ?)`)
        .run(uuidv4(), id, 'interview', target);
    }
    for (const proc of cia.testProcedures) {
      db.prepare(`INSERT INTO control_testing_procedures (id, control_id, procedure_type, description) VALUES (?, ?, ?, ?)`)
        .run(uuidv4(), id, 'test', proc);
    }
  }
}

// Insert ISO domains
const isoDomainIdMap: Record<string, string> = {};
for (const domain of ISO_DOMAINS) {
  const id = uuidv4();
  isoDomainIdMap[domain.id] = id;
  db.prepare(`INSERT INTO control_families (id, framework_id, identifier, name, description) VALUES (?, ?, ?, ?, ?)`).run(
    id, isoFrameworkId, domain.id, domain.name, domain.description
  );
}

// Insert ISO controls
const isoControlIdMap: Record<string, string> = {};
for (const ctrl of ISO_CONTROLS) {
  const id = uuidv4();
  isoControlIdMap[ctrl.id] = id;
  const domainKey = ctrl.id.split('.').slice(0, 2).join('.');
  const familyId = isoDomainIdMap[domainKey];
  db.prepare(`
    INSERT INTO controls (id, framework_id, family_id, identifier, title, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, isoFrameworkId, familyId, ctrl.id, ctrl.title, ctrl.description);
}

// Insert cross-framework mappings
for (const mapping of NIST_ISO_MAPPING) {
  const srcId = nistControlIdMap[mapping.nistId];
  const tgtId = isoControlIdMap[mapping.isoId];
  if (srcId && tgtId) {
    try {
      db.prepare(`INSERT INTO framework_mappings (id, source_framework_id, source_control_id, target_framework_id, target_control_id, mapping_type) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(uuidv4(), nistFrameworkId, srcId, isoFrameworkId, tgtId, 'related');
    } catch { /* duplicate */ }
  }
}

// Insert users
const adminId = uuidv4();
const user2Id = uuidv4();
const user3Id = uuidv4();

db.prepare(`INSERT INTO users (id, email, name, role, department) VALUES (?, ?, ?, ?, ?)`).run(adminId, 'admin@company.com', 'Alex Chen', 'admin', 'Information Security');
db.prepare(`INSERT INTO users (id, email, name, role, department) VALUES (?, ?, ?, ?, ?)`).run(user2Id, 'sarah.johnson@company.com', 'Sarah Johnson', 'compliance_manager', 'GRC');
db.prepare(`INSERT INTO users (id, email, name, role, department) VALUES (?, ?, ?, ?, ?)`).run(user3Id, 'mike.torres@company.com', 'Mike Torres', 'auditor', 'Internal Audit');

// Insert sample risks
const risks = [
  { title: 'Insufficient Multi-Factor Authentication Coverage', description: 'MFA is not enforced for all privileged accounts, creating risk of credential-based attacks.', category: 'technical', likelihood: 4, impact: 5, status: 'open', owner: 'Sarah Johnson', treatment: 'mitigate' },
  { title: 'Unpatched Vulnerabilities in Production Systems', description: 'Critical CVEs remain unpatched beyond SLA due to change freeze periods.', category: 'technical', likelihood: 4, impact: 4, status: 'in_progress', owner: 'Mike Torres', treatment: 'mitigate' },
  { title: 'Third-Party Vendor Security Risk', description: 'Key vendors have not provided recent SOC 2 reports or security assessments.', category: 'operational', likelihood: 3, impact: 4, status: 'open', owner: 'Sarah Johnson', treatment: 'mitigate' },
  { title: 'Insufficient Audit Log Retention', description: 'Audit logs are retained for only 30 days, below the 90-day minimum requirement.', category: 'compliance', likelihood: 2, impact: 3, status: 'open', owner: 'Alex Chen', treatment: 'mitigate' },
  { title: 'Weak Password Policy for Service Accounts', description: 'Service accounts use simple passwords without rotation.', category: 'technical', likelihood: 3, impact: 5, status: 'open', owner: 'Mike Torres', treatment: 'mitigate' },
  { title: 'Cloud Misconfiguration Exposure', description: 'S3 buckets and cloud storage may have overly permissive access controls.', category: 'technical', likelihood: 3, impact: 5, status: 'in_progress', owner: 'Alex Chen', treatment: 'mitigate' },
  { title: 'Insider Threat - Privileged User Abuse', description: 'Limited controls to detect and prevent insider threat from privileged users.', category: 'operational', likelihood: 2, impact: 5, status: 'open', owner: 'Sarah Johnson', treatment: 'mitigate' },
  { title: 'Business Continuity Plan Not Tested', description: 'BCP/DR procedures have not been tested in over 12 months.', category: 'operational', likelihood: 2, impact: 4, status: 'open', owner: 'Alex Chen', treatment: 'mitigate' },
  { title: 'Supply Chain Software Tampering', description: 'No SBOM or integrity verification for third-party libraries.', category: 'technical', likelihood: 2, impact: 4, status: 'open', owner: 'Mike Torres', treatment: 'mitigate' },
  { title: 'Regulatory Non-Compliance - GDPR', description: 'Data subject request processes are manual and may exceed 30-day response requirement.', category: 'compliance', likelihood: 3, impact: 4, status: 'open', owner: 'Sarah Johnson', treatment: 'mitigate' },
];

const riskIds: string[] = [];
for (const risk of risks) {
  const id = uuidv4();
  riskIds.push(id);
  db.prepare(`INSERT INTO risks (id, title, description, category, likelihood, impact, status, owner, treatment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, risk.title, risk.description, risk.category, risk.likelihood, risk.impact, risk.status, risk.owner, risk.treatment
  );
}

// Insert sample vendors
const vendors = [
  { name: 'Amazon Web Services', website: 'https://aws.amazon.com', description: 'Cloud infrastructure provider', category: 'cloud', tier: 1, status: 'approved', risk_rating: 'medium', contact_name: 'AWS Support', data_types: '["Infrastructure","Compute","Storage"]', soc2: true },
  { name: 'Okta', website: 'https://okta.com', description: 'Identity and access management', category: 'security', tier: 1, status: 'approved', risk_rating: 'low', contact_name: 'Okta Support', data_types: '["Identity","Authentication"]', soc2: true },
  { name: 'CrowdStrike', website: 'https://crowdstrike.com', description: 'Endpoint detection and response', category: 'security', tier: 1, status: 'approved', risk_rating: 'low', data_types: '["Endpoint telemetry","Security logs"]', soc2: true },
  { name: 'Slack', website: 'https://slack.com', description: 'Business messaging platform', category: 'saas', tier: 2, status: 'approved', risk_rating: 'medium', data_types: '["Communications","Business data"]', soc2: true },
  { name: 'Salesforce', website: 'https://salesforce.com', description: 'CRM platform', category: 'saas', tier: 1, status: 'approved', risk_rating: 'medium', data_types: '["Customer data","PII","Business records"]', soc2: true },
  { name: 'GitHub', website: 'https://github.com', description: 'Source code management', category: 'saas', tier: 1, status: 'approved', risk_rating: 'medium', data_types: '["Source code","IP"]', soc2: true },
  { name: 'Zoom', website: 'https://zoom.us', description: 'Video conferencing', category: 'saas', tier: 2, status: 'approved', risk_rating: 'medium', data_types: '["Communications","Meeting recordings"]', soc2: true },
  { name: 'Datadog', website: 'https://datadoghq.com', description: 'Monitoring and observability', category: 'infrastructure', tier: 2, status: 'approved', risk_rating: 'low', data_types: '["Metrics","Logs","Traces"]', soc2: true },
  { name: 'Veracode', website: 'https://veracode.com', description: 'Application security testing', category: 'security', tier: 2, status: 'under_review', risk_rating: 'medium', data_types: '["Source code","Security findings"]', soc2: false },
  { name: 'Workday', website: 'https://workday.com', description: 'HR management system', category: 'hr', tier: 1, status: 'approved', risk_rating: 'high', data_types: '["HR data","PII","Payroll","Benefits"]', soc2: true },
];

for (const vendor of vendors) {
  db.prepare(`INSERT INTO vendors (id, name, website, description, category, tier, status, risk_rating, contact_name, data_types) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), vendor.name, vendor.website, vendor.description, vendor.category, vendor.tier, vendor.status, vendor.risk_rating, vendor.contact_name || null, vendor.data_types
  );
}

// Insert sample policies
const policies = [
  { title: 'Information Security Policy', category: 'security', status: 'published', version: '3.1', owner: 'Alex Chen', approver: 'CISO', content: 'This policy establishes the information security framework for the organization...', review_frequency: 'annual' },
  { title: 'Access Control Policy', category: 'security', status: 'published', version: '2.4', owner: 'Sarah Johnson', approver: 'CISO', content: 'This policy defines requirements for user access management...', review_frequency: 'annual' },
  { title: 'Acceptable Use Policy', category: 'it', status: 'published', version: '2.0', owner: 'Mike Torres', approver: 'CTO', content: 'This policy defines acceptable use of company information assets...', review_frequency: 'annual' },
  { title: 'Incident Response Policy', category: 'security', status: 'published', version: '1.8', owner: 'Alex Chen', approver: 'CISO', content: 'This policy defines the incident response process...', review_frequency: 'annual' },
  { title: 'Business Continuity Policy', category: 'operational', status: 'review', version: '2.1', owner: 'Sarah Johnson', approver: 'COO', content: 'This policy establishes business continuity requirements...', review_frequency: 'annual' },
  { title: 'Data Classification Policy', category: 'security', status: 'published', version: '1.5', owner: 'Alex Chen', approver: 'CISO', content: 'This policy defines data classification tiers...', review_frequency: 'annual' },
  { title: 'Vulnerability Management Policy', category: 'security', status: 'published', version: '2.2', owner: 'Mike Torres', approver: 'CISO', content: 'This policy establishes requirements for vulnerability identification and remediation...', review_frequency: 'quarterly' },
  { title: 'Vendor Management Policy', category: 'compliance', status: 'published', version: '1.3', owner: 'Sarah Johnson', approver: 'CFO', content: 'This policy defines vendor risk assessment requirements...', review_frequency: 'annual' },
  { title: 'Password Policy', category: 'security', status: 'published', version: '3.0', owner: 'Alex Chen', approver: 'CISO', content: 'This policy sets password complexity and rotation requirements...', review_frequency: 'annual' },
  { title: 'Privacy Policy', category: 'privacy', status: 'published', version: '2.7', owner: 'Sarah Johnson', approver: 'DPO', content: 'This policy governs collection and processing of personal data...', review_frequency: 'annual' },
  { title: 'Change Management Policy', category: 'it', status: 'draft', version: '1.1', owner: 'Mike Torres', approver: 'CTO', content: 'This policy defines the change management process...', review_frequency: 'annual' },
  { title: 'Cryptography Policy', category: 'security', status: 'published', version: '1.4', owner: 'Alex Chen', approver: 'CISO', content: 'This policy defines approved cryptographic standards and key management...', review_frequency: 'annual' },
];

for (const policy of policies) {
  const now = new Date().toISOString();
  const nextReview = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(`INSERT INTO policies (id, title, category, status, version, owner, approver, content, review_frequency, last_reviewed_at, next_review_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), policy.title, policy.category, policy.status, policy.version, policy.owner, policy.approver, policy.content, policy.review_frequency, now, nextReview
  );
}

// Insert sample assets
const assets = [
  { name: 'Production Web Application', type: 'application', category: 'software', owner: 'Engineering', classification: 'confidential', criticality: 'critical', status: 'active', hostname: 'app.company.com' },
  { name: 'Customer Database', type: 'database', category: 'data', owner: 'Engineering', classification: 'restricted', criticality: 'critical', status: 'active', hostname: 'db-prod-01' },
  { name: 'AWS Production Account', type: 'cloud', category: 'cloud', owner: 'Infrastructure', classification: 'confidential', criticality: 'critical', status: 'active' },
  { name: 'Corporate Laptop Fleet', type: 'workstation', category: 'hardware', owner: 'IT', classification: 'internal', criticality: 'high', status: 'active' },
  { name: 'Internal Network Switches', type: 'network', category: 'hardware', owner: 'IT', classification: 'internal', criticality: 'high', status: 'active' },
  { name: 'HR Management System (Workday)', type: 'saas', category: 'cloud', owner: 'HR', classification: 'restricted', criticality: 'high', status: 'active' },
  { name: 'Source Code Repository (GitHub)', type: 'saas', category: 'cloud', owner: 'Engineering', classification: 'confidential', criticality: 'critical', status: 'active' },
  { name: 'Email System (Microsoft 365)', type: 'saas', category: 'cloud', owner: 'IT', classification: 'internal', criticality: 'high', status: 'active' },
  { name: 'Dev/Staging Environment', type: 'cloud', category: 'cloud', owner: 'Engineering', classification: 'internal', criticality: 'medium', status: 'active' },
  { name: 'Backup Storage (S3)', type: 'cloud', category: 'cloud', owner: 'Infrastructure', classification: 'confidential', criticality: 'high', status: 'active' },
  { name: 'VPN Gateway', type: 'network', category: 'hardware', owner: 'IT', classification: 'internal', criticality: 'high', status: 'active' },
  { name: 'Security Information and Event Management (SIEM)', type: 'application', category: 'software', owner: 'Security', classification: 'confidential', criticality: 'high', status: 'active' },
];

for (const asset of assets) {
  db.prepare(`INSERT INTO assets (id, name, type, category, owner, classification, criticality, status, hostname) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), asset.name, asset.type, asset.category, asset.owner, asset.classification, asset.criticality, asset.status, asset.hostname || null
  );
}

// Insert sample audits
const audit1Id = uuidv4();
const audit2Id = uuidv4();
const audit3Id = uuidv4();
db.prepare(`INSERT INTO audits (id, title, description, type, framework_id, status, auditor, auditor_firm, start_date, end_date, findings_count, critical_findings, high_findings, medium_findings, low_findings) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
  audit1Id, 'Annual NIST 800-53 Assessment', 'Annual assessment against NIST SP 800-53 Rev 5 controls', 'internal', nistFrameworkId, 'completed', 'Sarah Johnson', 'Internal', '2025-10-01', '2025-11-15', 12, 0, 3, 6, 3
);
db.prepare(`INSERT INTO audits (id, title, description, type, framework_id, status, auditor, auditor_firm, start_date, end_date, findings_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
  audit2Id, 'ISO 27001 Certification Audit', 'Stage 2 certification audit by accredited body', 'certification', isoFrameworkId, 'in_progress', 'External Auditor', 'BSI Group', '2026-02-01', '2026-03-31', 0
);
db.prepare(`INSERT INTO audits (id, title, description, type, status, auditor, start_date) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
  audit3Id, 'Annual Penetration Test', 'External penetration test of production systems', 'penetration_test', 'planned', 'TBD', '2026-04-15'
);

// Insert audit findings
const findingData = [
  { title: 'MFA Not Enforced for All Admin Accounts', description: 'Several privileged accounts do not have MFA enabled.', severity: 'high', status: 'in_progress', recommendation: 'Enforce MFA for all accounts with elevated privileges within 30 days.' },
  { title: 'Audit Log Retention Below Required Threshold', description: 'System audit logs are retained for 30 days vs. required 90 days.', severity: 'medium', status: 'open', recommendation: 'Update log retention policies to meet minimum 90-day requirement.' },
  { title: 'Missing Evidence for AC-2 Account Review', description: 'No documented quarterly access review was performed.', severity: 'medium', status: 'open', recommendation: 'Implement and document quarterly access reviews.' },
  { title: 'Outdated SSL/TLS Configuration', description: 'Three servers still support TLS 1.0 and 1.1.', severity: 'high', status: 'remediated', recommendation: 'Disable TLS 1.0 and 1.1 on all servers.' },
  { title: 'Vendor Risk Assessment Gaps', description: 'Five tier-1 vendors lack current SOC 2 Type II reports.', severity: 'medium', status: 'open', recommendation: 'Obtain current reports from all tier-1 vendors.' },
];

for (const finding of findingData) {
  db.prepare(`INSERT INTO audit_findings (id, audit_id, title, description, severity, status, recommendation) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), audit1Id, finding.title, finding.description, finding.severity, finding.status, finding.recommendation
  );
}

// Insert integrations
const integrations = [
  { name: 'AWS Security Hub', type: 'aws', status: 'active', controls_mapped: 45, evidence_collected: 234 },
  { name: 'Okta Identity', type: 'okta', status: 'active', controls_mapped: 12, evidence_collected: 89 },
  { name: 'CrowdStrike Falcon', type: 'crowdstrike', status: 'active', controls_mapped: 8, evidence_collected: 56 },
  { name: 'GitHub Advanced Security', type: 'github', status: 'active', controls_mapped: 6, evidence_collected: 34 },
  { name: 'Jira', type: 'jira', status: 'configuring', controls_mapped: 0, evidence_collected: 0 },
  { name: 'Microsoft Azure', type: 'azure', status: 'inactive', controls_mapped: 0, evidence_collected: 0 },
  { name: 'Qualys VMDR', type: 'qualys', status: 'active', controls_mapped: 15, evidence_collected: 120 },
  { name: 'Slack Notifications', type: 'slack', status: 'active', controls_mapped: 0, evidence_collected: 0 },
];

for (const integration of integrations) {
  db.prepare(`INSERT INTO integrations (id, name, type, status, controls_mapped, evidence_collected, last_sync) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), integration.name, integration.type, integration.status, integration.controls_mapped, integration.evidence_collected,
    integration.status === 'active' ? new Date().toISOString() : null
  );
}

// Insert technical profile questions
const profileQuestions = [
  { question: 'Does your organization use multi-factor authentication (MFA) for all user accounts?', category: 'Identity & Access', impact_controls: JSON.stringify(['AC-2', 'AC-3', 'IA-2', 'IA-5']) },
  { question: 'Do you have a centralized Identity Provider (IdP) or SSO solution (e.g., Okta, Azure AD)?', category: 'Identity & Access', impact_controls: JSON.stringify(['AC-2', 'IA-2', 'IA-4', 'IA-8']) },
  { question: 'Do you maintain privileged access workstations (PAWs) or separate admin accounts for privileged operations?', category: 'Identity & Access', impact_controls: JSON.stringify(['AC-5', 'AC-6', 'IA-2']) },
  { question: 'Does your organization use cloud infrastructure (AWS, Azure, GCP)?', category: 'Cloud Infrastructure', impact_controls: JSON.stringify(['AC-4', 'CM-2', 'CM-6', 'SC-7', 'SC-28']) },
  { question: 'Do you deploy SIEM/SOC capabilities for centralized log analysis and threat detection?', category: 'Monitoring & Detection', impact_controls: JSON.stringify(['AU-2', 'AU-6', 'AU-12', 'SI-4']) },
  { question: 'Do you run automated vulnerability scanning on your systems (authenticated scans)?', category: 'Vulnerability Management', impact_controls: JSON.stringify(['RA-5', 'SI-2', 'CM-8']) },
  { question: 'Do you have endpoint detection and response (EDR) deployed on all endpoints?', category: 'Endpoint Security', impact_controls: JSON.stringify(['SI-3', 'SI-4', 'CM-7']) },
  { question: 'Do you enforce encryption at rest for databases and sensitive storage?', category: 'Data Protection', impact_controls: JSON.stringify(['SC-28', 'MP-5', 'MP-8']) },
  { question: 'Do you enforce TLS/HTTPS for all web-facing and internal service communications?', category: 'Data Protection', impact_controls: JSON.stringify(['SC-8', 'SC-23', 'IA-7']) },
  { question: 'Do you have a documented incident response plan and conduct regular tabletop exercises?', category: 'Incident Response', impact_controls: JSON.stringify(['IR-4', 'IR-8', 'IR-3', 'IR-2']) },
  { question: 'Do you perform regular data backups and test restoration procedures?', category: 'Business Continuity', impact_controls: JSON.stringify(['CP-9', 'CP-10', 'CP-2']) },
  { question: 'Do you use infrastructure-as-code (IaC) and enforce configuration baselines?', category: 'Configuration Management', impact_controls: JSON.stringify(['CM-2', 'CM-6', 'CM-9', 'SA-10']) },
  { question: 'Do you conduct security awareness training for all employees at least annually?', category: 'Security Training', impact_controls: JSON.stringify(['AT-2', 'AT-3', 'PS-6']) },
  { question: 'Do you perform background checks on all new employees with access to sensitive systems?', category: 'Personnel Security', impact_controls: JSON.stringify(['PS-3', 'PS-6', 'AT-2']) },
  { question: 'Do you have a formal vendor/supplier risk management process?', category: 'Third Party Risk', impact_controls: JSON.stringify(['SR-3', 'SR-6', 'SA-9', 'CA-3']) },
  { question: 'Do you use Web Application Firewall (WAF) for public-facing applications?', category: 'Network Security', impact_controls: JSON.stringify(['SC-5', 'SC-7', 'SI-10']) },
  { question: 'Do you have network segmentation between production, dev/test, and corporate networks?', category: 'Network Security', impact_controls: JSON.stringify(['SC-2', 'SC-7', 'SC-39', 'AC-4']) },
  { question: 'Do you have a formal change management process with testing and approval gates?', category: 'Change Management', impact_controls: JSON.stringify(['CM-3', 'CM-4', 'SA-10']) },
  { question: 'Do you track software supply chain provenance and maintain an SBOM?', category: 'Supply Chain', impact_controls: JSON.stringify(['SR-3', 'SR-11', 'SA-12']) },
  { question: 'Do you have Data Loss Prevention (DLP) controls in place?', category: 'Data Protection', impact_controls: JSON.stringify(['AC-4', 'MP-7', 'SC-28', 'SI-12']) },
];

for (const q of profileQuestions) {
  db.prepare(`INSERT INTO technical_profile (id, question, category, impact_controls) VALUES (?, ?, ?, ?)`)
    .run(uuidv4(), q.question, q.category, q.impact_controls);
}

// Generate historical compliance snapshots for trend analysis
const today = new Date();
const nistControlCount = NIST_CONTROLS.length;
const isoControlCount = ISO_CONTROLS.length;

for (let i = 11; i >= 0; i--) {
  const date = new Date(today);
  date.setMonth(date.getMonth() - i);
  const dateStr = date.toISOString().split('T')[0];

  const baseImplemented = Math.floor(nistControlCount * (0.35 + (11 - i) * 0.04));
  const baseInProgress = Math.floor(nistControlCount * (0.15 + (11 - i) * 0.01));
  const notApplicable = Math.floor(nistControlCount * 0.08);
  const notImplemented = nistControlCount - baseImplemented - baseInProgress - notApplicable;
  const score = Math.round(((baseImplemented + baseInProgress * 0.5) / (nistControlCount - notApplicable)) * 100 * 10) / 10;

  db.prepare(`INSERT INTO compliance_snapshots (id, framework_id, snapshot_date, total_controls, implemented, in_progress, not_implemented, not_applicable, compliance_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(uuidv4(), nistFrameworkId, dateStr, nistControlCount, baseImplemented, baseInProgress, Math.max(0, notImplemented), notApplicable, score);

  const isoImplemented = Math.floor(isoControlCount * (0.40 + (11 - i) * 0.035));
  const isoInProgress = Math.floor(isoControlCount * (0.12 + (11 - i) * 0.01));
  const isoNA = Math.floor(isoControlCount * 0.05);
  const isoNotImpl = isoControlCount - isoImplemented - isoInProgress - isoNA;
  const isoScore = Math.round(((isoImplemented + isoInProgress * 0.5) / (isoControlCount - isoNA)) * 100 * 10) / 10;

  db.prepare(`INSERT INTO compliance_snapshots (id, framework_id, snapshot_date, total_controls, implemented, in_progress, not_implemented, not_applicable, compliance_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(uuidv4(), isoFrameworkId, dateStr, isoControlCount, isoImplemented, isoInProgress, Math.max(0, isoNotImpl), isoNA, isoScore);

  // Risk snapshots
  const critical = Math.max(0, 2 - Math.floor((11 - i) * 0.15));
  const high = Math.max(2, 6 - Math.floor((11 - i) * 0.3));
  const medium = Math.max(3, 9 - Math.floor((11 - i) * 0.4));
  const low = Math.max(1, 4 - Math.floor((11 - i) * 0.2));
  db.prepare(`INSERT INTO risk_snapshots (id, snapshot_date, critical_count, high_count, medium_count, low_count, total_open, avg_risk_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(uuidv4(), dateStr, critical, high, medium, low, critical + high + medium + low, parseFloat((critical * 5 * 5 + high * 4 * 4 + medium * 3 * 3 + low * 2 * 2) / (critical + high + medium + low || 1) as unknown as string).toFixed(1));
}

// Set some controls as implemented/in_progress for demo
const statusUpdates = [
  { id: 'AC-1', status: 'implemented' }, { id: 'AC-2', status: 'implemented' }, { id: 'AC-3', status: 'implemented' },
  { id: 'AC-7', status: 'implemented' }, { id: 'AC-8', status: 'implemented' }, { id: 'AC-17', status: 'implemented' },
  { id: 'AC-18', status: 'implemented' }, { id: 'AT-2', status: 'implemented' }, { id: 'AT-3', status: 'implemented' },
  { id: 'AT-4', status: 'implemented' }, { id: 'AU-2', status: 'implemented' }, { id: 'AU-3', status: 'implemented' },
  { id: 'AU-4', status: 'implemented' }, { id: 'AU-8', status: 'implemented' }, { id: 'AU-9', status: 'implemented' },
  { id: 'AU-11', status: 'in_progress' }, { id: 'AU-12', status: 'implemented' }, { id: 'CM-2', status: 'implemented' },
  { id: 'CM-6', status: 'implemented' }, { id: 'CM-7', status: 'in_progress' }, { id: 'CM-8', status: 'in_progress' },
  { id: 'CM-10', status: 'implemented' }, { id: 'CM-11', status: 'implemented' }, { id: 'CP-9', status: 'implemented' },
  { id: 'CP-10', status: 'in_progress' }, { id: 'IA-1', status: 'implemented' }, { id: 'IA-2', status: 'in_progress' },
  { id: 'IA-4', status: 'implemented' }, { id: 'IA-5', status: 'implemented' }, { id: 'IA-6', status: 'implemented' },
  { id: 'IA-7', status: 'implemented' }, { id: 'IA-8', status: 'implemented' }, { id: 'IR-4', status: 'implemented' },
  { id: 'IR-5', status: 'implemented' }, { id: 'IR-6', status: 'implemented' }, { id: 'IR-8', status: 'implemented' },
  { id: 'RA-3', status: 'implemented' }, { id: 'RA-5', status: 'in_progress' }, { id: 'SC-7', status: 'implemented' },
  { id: 'SC-8', status: 'implemented' }, { id: 'SC-12', status: 'in_progress' }, { id: 'SC-13', status: 'implemented' },
  { id: 'SC-28', status: 'implemented' }, { id: 'SI-2', status: 'in_progress' }, { id: 'SI-3', status: 'implemented' },
  { id: 'SI-4', status: 'implemented' },
];

for (const update of statusUpdates) {
  const controlId = nistControlIdMap[update.id];
  if (controlId) {
    db.prepare(`UPDATE controls SET status = ? WHERE id = ?`).run(update.status, controlId);
  }
}

console.log('✅ Database seeded successfully!');
console.log(`  - ${NIST_CONTROLS.length} NIST 800-53 Rev 5 controls`);
console.log(`  - ${ISO_CONTROLS.length} ISO 27001 controls`);
console.log(`  - ${NIST_ISO_MAPPING.length} cross-framework mappings`);
console.log(`  - ${risks.length} sample risks`);
console.log(`  - ${vendors.length} vendors`);
console.log(`  - ${policies.length} policies`);
console.log(`  - ${assets.length} assets`);
console.log(`  - Historical trend data generated (12 months)`);
console.log(`  - ${profileQuestions.length} technical profile questions`);
