import Anthropic from '@anthropic-ai/sdk';
import db from '../db';

export const AVAILABLE_MODELS = [
  { id: 'claude-opus-4-6',           label: 'Claude Opus 4.6 (Most capable)'  },
  { id: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6 (Recommended)' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (Fastest)'      },
] as const;

export function getActiveLlm(): string {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = 'llm_model'").get() as { value: string } | undefined;
  return row?.value ?? 'claude-sonnet-4-6';
}

export function setActiveLlm(modelId: string): void {
  db.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES ('llm_model', ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(modelId);
}

export type DocumentType = 'ssp' | 'rar' | 'sar' | 'ato_letter' | 'poam' | 'iscp' | 'pia' | 'cis' | 'sctm';

export const DOC_TYPE_META: Record<DocumentType, { label: string; description: string }> = {
  ssp:       { label: 'System Security Plan (SSP)',               description: 'Comprehensive security plan describing the system, boundary, controls, and implementation' },
  rar:       { label: 'Risk Assessment Report (RAR)',             description: 'Identifies, analyzes, and prioritizes risks to the system' },
  sar:       { label: 'Security Assessment Report (SAR)',         description: 'Results of security control assessments and testing' },
  ato_letter:{ label: 'ATO Decision Letter',                      description: 'Formal authorization to operate letter from the Authorizing Official' },
  poam:      { label: 'Plan of Action & Milestones (POA&M)',      description: 'Tracks open findings, remediation plans, and milestones' },
  iscp:      { label: 'Information System Contingency Plan (ISCP)',description: 'Procedures for recovering the system after a disruption' },
  pia:       { label: 'Privacy Impact Assessment (PIA)',          description: 'Assesses privacy risks of data collection and processing' },
  cis:       { label: 'Control Implementation Summary (CIS)',     description: 'Summary table of control implementation status across all families' },
  sctm:      { label: 'Security Control Traceability Matrix (SCTM)', description: 'Maps controls to evidence, findings, and implementation status' },
};

interface AtoContext {
  package: Record<string, unknown>;
  system: Record<string, unknown> | null;
  controls: Record<string, unknown>[];
  risks: Record<string, unknown>[];
  findings: Record<string, unknown>[];
  audits: Record<string, unknown>[];
  evidence: Record<string, unknown>[];
  policies: Record<string, unknown>[];
}

function buildContext(packageId: string): AtoContext {
  const pkg = db.prepare('SELECT * FROM ato_packages WHERE id = ?').get(packageId) as Record<string, unknown>;
  const system = pkg?.system_id
    ? db.prepare('SELECT * FROM systems WHERE id = ?').get(pkg.system_id as string) as Record<string, unknown>
    : null;

  const controls = db.prepare(`
    SELECT c.*, cf.name as family_name, f.name as framework_name
    FROM controls c
    LEFT JOIN control_families cf ON cf.id = c.family_id
    LEFT JOIN frameworks f ON f.id = c.framework_id
    ORDER BY c.identifier
  `).all() as Record<string, unknown>[];

  const risks = db.prepare(`
    SELECT * FROM risks ORDER BY risk_score DESC LIMIT 50
  `).all() as Record<string, unknown>[];

  const findings = db.prepare(`
    SELECT af.*, a.title as audit_title
    FROM audit_findings af LEFT JOIN audits a ON a.id = af.audit_id
    WHERE af.status IN ('open','in_progress','accepted')
    ORDER BY af.severity
    LIMIT 50
  `).all() as Record<string, unknown>[];

  const audits = db.prepare(`
    SELECT a.*, f.name as framework_name
    FROM audits a LEFT JOIN frameworks f ON f.id = a.framework_id
    ORDER BY a.created_at DESC LIMIT 10
  `).all() as Record<string, unknown>[];

  const evidence = db.prepare(`
    SELECT e.*, GROUP_CONCAT(c.identifier,', ') as mapped_controls
    FROM evidence e
    LEFT JOIN control_evidence ce ON ce.evidence_id = e.id
    LEFT JOIN controls c ON c.id = ce.control_id
    GROUP BY e.id ORDER BY e.collected_at DESC LIMIT 40
  `).all() as Record<string, unknown>[];

  const policies = db.prepare(
    "SELECT * FROM policies WHERE status IN ('published','approved') ORDER BY category, title"
  ).all() as Record<string, unknown>[];

  return { package: pkg, system, controls, risks, findings, audits, evidence, policies };
}

function controlSummary(controls: Record<string, unknown>[]) {
  const impl    = controls.filter(c => c.status === 'implemented').length;
  const inProg  = controls.filter(c => c.status === 'in_progress').length;
  const notImpl = controls.filter(c => c.status === 'not_implemented').length;
  const na      = controls.filter(c => c.status === 'not_applicable').length;
  return `Total: ${controls.length} | Implemented: ${impl} | In-Progress: ${inProg} | Not Implemented: ${notImpl} | N/A: ${na}`;
}

function buildPrompt(docType: DocumentType, ctx: AtoContext): string {
  const pkg = ctx.package;
  const sys = ctx.system;
  const sysDesc = sys
    ? `System: ${sys.name} | Type: ${sys.system_type} | Impact: ${sys.impact_level} | Description: ${sys.description}`
    : `System: ${pkg.title} | Impact Level: ${pkg.impact_level}`;

  const ctrlSummary = controlSummary(ctx.controls);
  const openFindings = ctx.findings.filter(f => f.status === 'open').length;
  const critFindings = ctx.findings.filter(f => f.severity === 'critical').length;
  const highFindings = ctx.findings.filter(f => f.severity === 'high').length;

  const riskSummary = ctx.risks.slice(0, 10).map(r =>
    `- ${r.title} (score: ${r.risk_score}, status: ${r.status})`
  ).join('\n');

  const controlDetail = ctx.controls.slice(0, 30).map(c =>
    `${c.identifier}: ${c.title} [${c.status}]${c.implementation_notes ? ` — ${String(c.implementation_notes).slice(0,80)}` : ''}`
  ).join('\n');

  const findingDetail = ctx.findings.slice(0, 20).map(f =>
    `- [${f.severity}] ${f.title} (${f.status})${f.recommendation ? ` — ${String(f.recommendation).slice(0,80)}` : ''}`
  ).join('\n');

  const policyList = ctx.policies.map(p => `- ${p.title} (${p.category}, v${p.version})`).join('\n');

  const baseHeader = `
ATO Package: ${pkg.title}
Type: ${pkg.package_type} | Impact Level: ${pkg.impact_level}
${sysDesc}
Authorization Boundary: ${pkg.authorization_boundary || 'Not specified'}
System Owner: ${pkg.system_owner_name || 'TBD'} | ISSO: ${pkg.isso_name || 'TBD'} | AO: ${pkg.authorizing_official_name || 'TBD'}

Control Implementation Summary: ${ctrlSummary}
Open Findings: ${openFindings} (Critical: ${critFindings}, High: ${highFindings})
Active Risks: ${ctx.risks.length}
Published Policies: ${ctx.policies.length}
`.trim();

  const prompts: Record<DocumentType, string> = {
    ssp: `You are a federal cybersecurity compliance expert. Generate a comprehensive System Security Plan (SSP) in NIST SP 800-18 format.

${baseHeader}

Top Controls:
${controlDetail}

Approved Policies:
${policyList}

Write a professional, complete SSP with these sections:
1. Information System Name and Identifier
2. Information System Categorization (FIPS 199)
3. System Owner and Points of Contact
4. Assignment of Security Responsibility (ISSO)
5. Information System Operational Status
6. Information System Type
7. General System Description / Purpose
8. System Environment of Operation
9. System Interconnections / Information Sharing
10. Laws, Regulations, and Policies
11. Minimum Security Controls (summarize by family)
12. Information System Security Plan Completion Date
13. Information System Security Plan Approval

Use proper markdown formatting with headers, tables where appropriate, and professional federal document language.`,

    rar: `You are a federal cybersecurity compliance expert. Generate a Risk Assessment Report (RAR) following NIST SP 800-30 Rev 1.

${baseHeader}

Risk Register (top risks):
${riskSummary}

Open Findings:
${findingDetail}

Write a professional RAR with these sections:
1. Executive Summary
2. System Description and Boundary
3. Risk Assessment Methodology
4. Threat Sources and Events
5. Vulnerabilities and Predisposing Conditions
6. Likelihood Determination
7. Impact Analysis
8. Risk Determination
9. Risk Response Recommendations
10. Summary Risk Table
11. Conclusion

Include a risk matrix table. Use professional federal document language.`,

    sar: `You are a federal cybersecurity compliance expert. Generate a Security Assessment Report (SAR) per NIST SP 800-53A.

${baseHeader}

Assessment Findings (${ctx.findings.length} total):
${findingDetail}

Control Assessment Results:
${ctrlSummary}

Evidence Collected: ${ctx.evidence.length} items

Write a professional SAR with:
1. Executive Summary
2. Assessment Scope and Objectives
3. Assessment Methodology
4. Assessment Results by Control Family
5. Summary of Findings
6. Risks Identified
7. Recommendations
8. Conclusion

Include findings summary table. Use professional federal document language.`,

    ato_letter: `You are a federal Authorizing Official. Generate a formal Authority to Operate (ATO) Decision Letter.

${baseHeader}

Write a formal ATO decision letter with:
1. Official letterhead section (organization, date, TO/FROM fields)
2. Subject line
3. Decision statement (AUTHORIZATION TO OPERATE granted/denied with conditions)
4. System description
5. Authorization boundary
6. Impact level
7. Authorization conditions and terms
8. Ongoing authorization requirements (continuous monitoring)
9. Authorization termination conditions
10. ATO expiration date (3 years from today: ${new Date(Date.now() + 3*365*24*60*60*1000).toISOString().slice(0,10)})
11. Authorizing Official signature block
12. Distribution list

Use formal government memorandum format.`,

    poam: `You are a federal cybersecurity compliance expert. Generate a Plan of Action & Milestones (POA&M) per OMB Memorandum M-02-01.

${baseHeader}

Open Findings requiring remediation:
${findingDetail}

Open Risks:
${riskSummary}

Generate a professional POA&M document with:
1. POA&M Header Information
2. POA&M Table with columns: ID, Weakness Description, Point of Contact, Resources Required, Scheduled Completion Date, Milestones with Completion Dates, Changes to Milestones, Source of Discovery, Status
3. Summary statistics
4. Certification statement

Populate the table with the actual findings listed. Use realistic milestone dates (30/60/90 days from today). Use professional federal document language.`,

    iscp: `You are a federal cybersecurity compliance expert. Generate an Information System Contingency Plan (ISCP) per NIST SP 800-34.

${baseHeader}

Write a comprehensive ISCP with:
1. Introduction and Purpose
2. Applicability and Scope
3. Contingency Planning Objectives
4. Concept of Operations
5. Notification / Activation Phase
6. Recovery Phase (procedures to restore the system)
7. Reconstitution Phase
8. Plan Training, Testing, and Exercises
9. Plan Maintenance
10. Appendix A: Personnel Contact List
11. Appendix B: System Resources Required

Use professional federal document language with specific recovery time objectives (RTO) and recovery point objectives (RPO) for a ${(sys?.impact_level ?? pkg.impact_level) || 'moderate'}-impact system.`,

    pia: `You are a federal privacy officer. Generate a Privacy Impact Assessment (PIA) per E-Government Act of 2002.

${baseHeader}

Approved Policies:
${policyList}

Write a comprehensive PIA with:
1. Overview of the Information System
2. Characterization of the Information Collected
3. Uses of the Information
4. Retention of the Information
5. Internal Sharing and Disclosure
6. External Sharing and Disclosure
7. Notice
8. Individual Access, Redress, and Correction
9. Technical Access and Security
10. Accountability, Audit, and Risk Management
11. PIA Approval

Use formal government document language.`,

    cis: `You are a federal cybersecurity compliance expert. Generate a Control Implementation Summary (CIS) table.

${baseHeader}

All Controls:
${ctx.controls.map(c => `${c.identifier}|${c.title}|${c.status}|${c.responsible_team || 'TBD'}|${c.implementation_notes ? String(c.implementation_notes).slice(0,100) : 'See SSP'}`).join('\n')}

Generate a complete CIS document with:
1. Document header and metadata
2. Implementation Status Summary (counts by status)
3. Full control implementation table: Control ID | Control Name | Status | Responsible Party | Implementation Summary | Evidence Reference
4. Inherited controls section
5. Common controls section
6. Signature block

Group controls by family. Use professional federal document language.`,

    sctm: `You are a federal cybersecurity compliance expert. Generate a Security Control Traceability Matrix (SCTM).

${baseHeader}

Controls with evidence:
${ctx.controls.slice(0,40).map(c => `${c.identifier}|${c.title}|${c.status}`).join('\n')}

Evidence items: ${ctx.evidence.length}
Findings: ${ctx.findings.length}

Generate a complete SCTM with:
1. Document header
2. Purpose and scope
3. Traceability matrix table: Control ID | Control Name | Implementation Status | Evidence References | Assessment Finding | Risk Level | Notes
4. Summary of traceability coverage
5. Gap analysis
6. Signature block

Use professional federal document language with proper cross-references.`,
  };

  return prompts[docType];
}

export async function generateAtoDocument(
  packageId: string,
  docType: DocumentType,
  modelOverride?: string,
): Promise<{ title: string; content: string; wordCount: number; model: string }> {
  const model = modelOverride ?? getActiveLlm();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const ctx = buildContext(packageId);
  const prompt = buildPrompt(docType, ctx);
  const meta = DOC_TYPE_META[docType];

  const message = await client.messages.create({
    model,
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = (message.content[0] as { type: string; text: string }).text;
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const title = `${meta.label} — ${(ctx.package.title as string) ?? 'ATO Package'}`;

  return { title, content, wordCount, model };
}
