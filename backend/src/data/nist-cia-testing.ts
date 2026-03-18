// CIA Impact values and NIST 800-53A assessment procedures for each control
// C = Confidentiality, I = Integrity, A = Availability
// Each: 'H' | 'M' | 'L' | 'N/A'

export interface ControlCIAProfile {
  controlId: string;
  confidentiality: 'H' | 'M' | 'L' | 'N/A';
  integrity: 'H' | 'M' | 'L' | 'N/A';
  availability: 'H' | 'M' | 'L' | 'N/A';
  // NIST 800-53A assessment objectives
  assessmentObjectives: string[];
  // Testing procedures (examine, interview, test)
  examineItems: string[];
  interviewTargets: string[];
  testProcedures: string[];
}

export const CONTROL_CIA_PROFILES: ControlCIAProfile[] = [
  {
    controlId: 'AC-1',
    confidentiality: 'H', integrity: 'M', availability: 'L',
    assessmentObjectives: [
      'AC-01a. Verify access control policy addresses purpose, scope, roles, responsibilities, management commitment, coordination, and compliance.',
      'AC-01b. Verify procedures facilitate implementation of access control policy and associated controls.',
      'AC-01c. Verify access control policy and procedures are designated, reviewed, and updated per defined frequencies.',
    ],
    examineItems: ['Access control policy', 'Access control procedures', 'Other relevant documents or records'],
    interviewTargets: ['Organizational personnel with access control responsibilities', 'System owner'],
    testProcedures: ['Review policy document for completeness', 'Verify review dates match defined frequency', 'Confirm distribution to relevant personnel'],
  },
  {
    controlId: 'AC-2',
    confidentiality: 'H', integrity: 'H', availability: 'M',
    assessmentObjectives: [
      'AC-02a. Verify account types are identified and defined.',
      'AC-02b. Verify conditions for group/role membership are established.',
      'AC-02c. Verify system access authorization is assigned according to privilege.',
      'AC-02d. Verify accounts are created, enabled, modified, disabled, and removed per defined procedures.',
      'AC-02e. Verify accounts are monitored and notifications sent when no longer required.',
    ],
    examineItems: ['Access control policy', 'Procedures for account management', 'System design documentation', 'System-generated list of accounts', 'Account management audit records'],
    interviewTargets: ['System or network administrators', 'Organizational personnel with account management responsibilities', 'System developers'],
    testProcedures: [
      'Automated mechanisms supporting account management',
      'Verification that account activations require authorization',
      'Testing that inactive accounts are disabled after defined period',
      'Confirm alerts are generated for account creation/modification outside business hours',
    ],
  },
  {
    controlId: 'AC-3',
    confidentiality: 'H', integrity: 'H', availability: 'M',
    assessmentObjectives: [
      'AC-03a. Verify the system enforces approved authorizations for logical access.',
      'AC-03b. Verify access enforcement mechanisms support the required access control policies.',
    ],
    examineItems: ['Access control policy', 'Procedures for access enforcement', 'System design documentation', 'Access control list', 'Audit records'],
    interviewTargets: ['System or network administrators', 'System developers', 'Organizational personnel with information security responsibilities'],
    testProcedures: [
      'Verify access control enforcement mechanisms are in place',
      'Attempt access with unauthorized credentials and confirm denial',
      'Verify role-based access assignments match job function requirements',
      'Test that privilege escalation requires appropriate authorization',
    ],
  },
  {
    controlId: 'AC-4',
    confidentiality: 'H', integrity: 'H', availability: 'L',
    assessmentObjectives: [
      'AC-04a. Verify information flow control policies are defined.',
      'AC-04b. Verify the system enforces information flow control using defined mechanisms.',
    ],
    examineItems: ['Access control policy', 'Information flow control policies', 'System design documentation', 'Network diagrams', 'Firewall rules'],
    interviewTargets: ['System or network administrators', 'System developers'],
    testProcedures: [
      'Attempt to transfer information in violation of flow policies',
      'Verify firewall/proxy rules enforce permitted flows',
      'Test data exfiltration prevention mechanisms',
    ],
  },
  {
    controlId: 'AC-5',
    confidentiality: 'H', integrity: 'H', availability: 'M',
    assessmentObjectives: [
      'AC-05a. Verify that duties of individuals requiring separation are identified.',
      'AC-05b. Verify that access authorizations to support separation of duties are defined.',
      'AC-05c. Verify that the system enforces separation of duties through assigned access authorizations.',
    ],
    examineItems: ['Access control policy', 'Procedures for separation of duties', 'System design documentation', 'Access authorization records'],
    interviewTargets: ['Organizational personnel with separation of duties responsibilities', 'System or network administrators'],
    testProcedures: [
      'Verify conflicting roles cannot be assigned to single user',
      'Attempt to perform actions requiring separation with single account',
      'Review access matrix for segregation conflicts',
    ],
  },
  {
    controlId: 'AC-6',
    confidentiality: 'H', integrity: 'H', availability: 'M',
    assessmentObjectives: [
      'AC-06a. Verify least privilege is employed allowing only authorized accesses for users and processes.',
      'AC-06b. Verify privileged accounts and roles are authorized for only specific duties.',
    ],
    examineItems: ['Access control policy', 'Procedures for least privilege', 'List of system accounts', 'Privilege assignments', 'Audit records of privileged functions'],
    interviewTargets: ['System or network administrators', 'Organizational personnel with least privilege responsibilities'],
    testProcedures: [
      'Verify standard users cannot access administrative functions',
      'Review privilege assignments against job functions',
      'Test that privilege elevation requires justification and approval',
      'Verify audit logging of all privileged operations',
    ],
  },
  {
    controlId: 'AC-7',
    confidentiality: 'H', integrity: 'M', availability: 'L',
    assessmentObjectives: [
      'AC-07a. Verify the system enforces a limit of consecutive invalid logon attempts.',
      'AC-07b. Verify actions are taken when the limit of invalid attempts is exceeded.',
    ],
    examineItems: ['Access control policy', 'Procedures for unsuccessful logon attempts', 'System design documentation', 'Audit/log records'],
    interviewTargets: ['System or network administrators', 'Organizational personnel with information security responsibilities'],
    testProcedures: [
      'Attempt to exceed defined consecutive invalid logon limit',
      'Verify account lockout or delay is triggered',
      'Test unlock procedures and verify appropriate authorization required',
    ],
  },
  {
    controlId: 'AU-2',
    confidentiality: 'M', integrity: 'H', availability: 'M',
    assessmentObjectives: [
      'AU-02a. Verify the types of events that the system is capable of logging are identified.',
      'AU-02b. Verify the frequency of (or situation requiring) logging for each identified event type.',
      'AU-02c. Verify the identified event types are logged by the system.',
    ],
    examineItems: ['Audit and accountability policy', 'Procedures for audit events', 'System design documentation', 'System-generated audit records', 'Configuration documentation'],
    interviewTargets: ['System or network administrators', 'System developer', 'Organizational personnel with audit and accountability responsibilities'],
    testProcedures: [
      'Perform defined auditable actions and verify events are captured',
      'Verify audit records include required content fields',
      'Test that login/logout events are captured',
      'Confirm privileged operations are logged with sufficient detail',
    ],
  },
  {
    controlId: 'AU-9',
    confidentiality: 'H', integrity: 'H', availability: 'M',
    assessmentObjectives: [
      'AU-09a. Verify audit information is protected from unauthorized access.',
      'AU-09b. Verify audit tools are protected from unauthorized access, modification, and deletion.',
    ],
    examineItems: ['Audit and accountability policy', 'Procedures for protection of audit information', 'Access control documentation', 'Audit records showing access to audit tools'],
    interviewTargets: ['System or network administrators', 'Organizational personnel with audit responsibilities'],
    testProcedures: [
      'Attempt to access audit logs with non-privileged accounts',
      'Attempt to modify audit records with non-privileged accounts',
      'Verify audit storage protection mechanisms',
      'Test audit log backup and integrity verification',
    ],
  },
  {
    controlId: 'CM-6',
    confidentiality: 'M', integrity: 'H', availability: 'M',
    assessmentObjectives: [
      'CM-06a. Verify configuration settings for technology products are established and documented.',
      'CM-06b. Verify configuration settings are implemented as established.',
      'CM-06c. Verify deviations from established configuration settings are identified and documented.',
    ],
    examineItems: ['Configuration management policy', 'Procedures for configuration settings', 'System design documentation', 'System security plan', 'Configuration settings documentation'],
    interviewTargets: ['System or network administrators', 'System developer', 'Organizational personnel with configuration management responsibilities'],
    testProcedures: [
      'Compare running configurations to documented baselines',
      'Verify unauthorized configuration changes trigger alerts',
      'Test hardening settings against CIS benchmarks or STIGs',
      'Confirm deviation approval process is enforced',
    ],
  },
  {
    controlId: 'IA-2',
    confidentiality: 'H', integrity: 'H', availability: 'M',
    assessmentObjectives: [
      'IA-02a. Verify organizational users are uniquely identified.',
      'IA-02b. Verify organizational users are authenticated before granting access.',
      'IA-02c. Verify MFA is implemented for privileged accounts.',
      'IA-02d. Verify MFA is implemented for non-privileged accounts accessing restricted systems.',
    ],
    examineItems: ['Identification and authentication policy', 'Procedures for identification and authentication', 'System design documentation', 'List of privileged accounts', 'Audit records'],
    interviewTargets: ['System or network administrators', 'Organizational personnel with I&A responsibilities', 'System developers'],
    testProcedures: [
      'Verify unique identifiers are assigned to all users',
      'Test authentication mechanisms for privileged access',
      'Verify MFA cannot be bypassed',
      'Test replay attack prevention',
      'Confirm shared accounts are prohibited or documented with controls',
    ],
  },
  {
    controlId: 'IA-5',
    confidentiality: 'H', integrity: 'H', availability: 'M',
    assessmentObjectives: [
      'IA-05a. Verify authenticator management processes verify identity before issuing authenticators.',
      'IA-05b. Verify initial authenticator content meets defined requirements.',
      'IA-05c. Verify administrative procedures are established for lost/compromised authenticators.',
      'IA-05d. Verify authenticators have defined lifetimes.',
      'IA-05e. Verify authenticators are changed/refreshed per defined timelines.',
    ],
    examineItems: ['Identification and authentication policy', 'Procedures for authenticator management', 'Password management system documentation', 'Audit records of authenticator changes'],
    interviewTargets: ['System or network administrators', 'Organizational personnel with authenticator management responsibilities'],
    testProcedures: [
      'Verify password complexity requirements are enforced',
      'Test password history to prevent reuse',
      'Confirm default passwords are changed before deployment',
      'Verify password expiration policies',
      'Test credential storage is hashed with strong algorithms',
    ],
  },
  {
    controlId: 'IR-4',
    confidentiality: 'H', integrity: 'H', availability: 'H',
    assessmentObjectives: [
      'IR-04a. Verify incident handling capability includes preparation, detection/analysis, containment, eradication, and recovery.',
      'IR-04b. Verify incident handling is coordinated with contingency planning activities.',
      'IR-04c. Verify lessons learned from incidents are incorporated into procedures.',
    ],
    examineItems: ['Incident response policy', 'Incident response procedures', 'Incident response plan', 'Incident response records', 'Evidence of post-incident analysis'],
    interviewTargets: ['Organizational personnel with incident response responsibilities', 'Organizational personnel with information security responsibilities'],
    testProcedures: [
      'Review incident response plan for completeness against NIST SP 800-61',
      'Conduct tabletop or simulation exercise',
      'Verify incident tracking system is operational',
      'Test communication procedures with relevant authorities',
      'Confirm evidence handling procedures preserve forensic integrity',
    ],
  },
  {
    controlId: 'RA-3',
    confidentiality: 'H', integrity: 'H', availability: 'H',
    assessmentObjectives: [
      'RA-03a. Verify a risk assessment is conducted that identifies threats and vulnerabilities.',
      'RA-03b. Verify risk assessment includes determination of likelihood of exploitation.',
      'RA-03c. Verify risk assessment includes determination of impact.',
      'RA-03d. Verify risk assessment results are documented.',
      'RA-03e. Verify risk assessments are reviewed and updated per defined frequency.',
    ],
    examineItems: ['Risk assessment policy', 'Procedures for risk assessment', 'Security categorization documentation', 'Risk assessment results', 'Risk assessment updates', 'System security plan'],
    interviewTargets: ['Organizational personnel with risk assessment responsibilities', 'System owners'],
    testProcedures: [
      'Review risk assessment methodology against NIST RMF/SP 800-30',
      'Verify all system components are in scope',
      'Confirm risk assessment recurrence meets defined frequency',
      'Verify risk acceptance is documented and signed off',
    ],
  },
  {
    controlId: 'RA-5',
    confidentiality: 'H', integrity: 'H', availability: 'H',
    assessmentObjectives: [
      'RA-05a. Verify vulnerability monitoring and scanning is performed.',
      'RA-05b. Verify vulnerability scan results are analyzed and remediation actions are identified.',
      'RA-05c. Verify true positives are remediated within defined timeframes.',
      'RA-05d. Verify vulnerability scanning tools are updated.',
    ],
    examineItems: ['Risk assessment policy', 'Procedures for vulnerability monitoring and scanning', 'Vulnerability scan reports', 'Patch records', 'Configuration management records'],
    interviewTargets: ['System or network administrators', 'Organizational personnel with vulnerability management responsibilities'],
    testProcedures: [
      'Review recent vulnerability scan reports',
      'Verify scan coverage includes all in-scope systems',
      'Confirm critical/high vulnerabilities are remediated within SLA',
      'Test authenticated scanning is configured',
      'Verify vulnerability tool definitions are current',
    ],
  },
  {
    controlId: 'SC-7',
    confidentiality: 'H', integrity: 'H', availability: 'H',
    assessmentObjectives: [
      'SC-07a. Verify the system monitors and controls communications at external boundaries.',
      'SC-07b. Verify the system monitors and controls communications at key internal boundaries.',
      'SC-07c. Verify the system implements subnetworks for publicly accessible system components.',
      'SC-07d. Verify only allowed communications cross boundary protection devices.',
    ],
    examineItems: ['System and communications protection policy', 'Procedures for boundary protection', 'System design documentation', 'Network topology/architecture diagrams', 'Firewall configuration documentation'],
    interviewTargets: ['System or network administrators', 'System developer'],
    testProcedures: [
      'Verify firewall/NGFW rules follow deny-by-default',
      'Test traffic flow through boundary devices',
      'Attempt to bypass boundary controls',
      'Verify DMZ separation from internal network',
      'Confirm all external connections are documented and authorized',
    ],
  },
  {
    controlId: 'SC-8',
    confidentiality: 'H', integrity: 'H', availability: 'L',
    assessmentObjectives: [
      'SC-08a. Verify the system implements cryptographic mechanisms to prevent unauthorized disclosure during transmission.',
      'SC-08b. Verify the system implements cryptographic mechanisms to prevent unauthorized modification during transmission.',
    ],
    examineItems: ['System and communications protection policy', 'Procedures for transmission confidentiality and integrity', 'System design documentation', 'TLS/SSL configuration documentation'],
    interviewTargets: ['System or network administrators', 'System developer'],
    testProcedures: [
      'Verify TLS 1.2+ is enforced on all transmission paths',
      'Test for weak cipher suites using SSL labs or similar',
      'Verify certificates are valid and not expired',
      'Test that unencrypted protocols (HTTP, FTP, Telnet) are blocked',
      'Verify HSTS is configured for web applications',
    ],
  },
  {
    controlId: 'SC-28',
    confidentiality: 'H', integrity: 'H', availability: 'L',
    assessmentObjectives: [
      'SC-28a. Verify the system implements cryptographic mechanisms to prevent unauthorized disclosure of information at rest.',
      'SC-28b. Verify the system implements cryptographic mechanisms to prevent unauthorized modification of information at rest.',
    ],
    examineItems: ['System and communications protection policy', 'Procedures for protection of information at rest', 'System design documentation', 'Encryption configuration documentation'],
    interviewTargets: ['System or network administrators', 'System developer'],
    testProcedures: [
      'Verify database encryption at rest is enabled',
      'Confirm disk encryption is enforced on workstations/laptops',
      'Verify backup encryption is configured',
      'Test that encryption keys are stored separately from data',
      'Confirm FIPS 140-2/3 validated cryptographic modules are used',
    ],
  },
  {
    controlId: 'SI-2',
    confidentiality: 'M', integrity: 'H', availability: 'H',
    assessmentObjectives: [
      'SI-02a. Verify system flaws are identified, reported, and corrected.',
      'SI-02b. Verify security-relevant software updates are installed within defined timeframes.',
      'SI-02c. Verify the effectiveness of security patches is verified after installation.',
    ],
    examineItems: ['System and information integrity policy', 'Procedures for flaw remediation', 'Patch management records', 'Vulnerability scan results', 'System update records'],
    interviewTargets: ['System or network administrators', 'Organizational personnel with flaw remediation responsibilities'],
    testProcedures: [
      'Review patch management process documentation',
      'Verify critical patches applied within defined SLA (e.g., 30 days)',
      'Run authenticated scan and compare with known patch levels',
      'Verify test environment is used before production patching',
      'Confirm rollback procedures exist for failed patches',
    ],
  },
  {
    controlId: 'SI-3',
    confidentiality: 'H', integrity: 'H', availability: 'H',
    assessmentObjectives: [
      'SI-03a. Verify malicious code protection mechanisms are implemented at system entry/exit points.',
      'SI-03b. Verify malicious code protection mechanisms are updated.',
      'SI-03c. Verify malicious code scans are performed.',
      'SI-03d. Verify actions are taken in response to malicious code detection.',
    ],
    examineItems: ['System and information integrity policy', 'Procedures for malicious code protection', 'AV/EDR configuration documentation', 'Malicious code scan records', 'Incident response records'],
    interviewTargets: ['System or network administrators', 'Organizational personnel with malicious code protection responsibilities'],
    testProcedures: [
      'Verify AV/EDR is deployed on all endpoints',
      'Confirm signature updates are current (within 24 hours)',
      'Test EICAR file detection and response',
      'Verify real-time protection is enabled',
      'Confirm centralized management console is operational',
    ],
  },
  {
    controlId: 'SI-4',
    confidentiality: 'H', integrity: 'H', availability: 'H',
    assessmentObjectives: [
      'SI-04a. Verify the system is monitored to detect attacks and indicators of potential attacks.',
      'SI-04b. Verify monitoring is used to identify unauthorized use of the system.',
      'SI-04c. Verify monitoring information is provided to authorized personnel.',
      'SI-04d. Verify monitoring tools are protected from unauthorized access, modification, and deletion.',
    ],
    examineItems: ['System and information integrity policy', 'Procedures for system monitoring', 'SIEM configuration', 'IDS/IPS configuration', 'Monitoring reports', 'Audit records'],
    interviewTargets: ['System or network administrators', 'Organizational personnel with system monitoring responsibilities', 'SOC personnel'],
    testProcedures: [
      'Verify SIEM collects logs from all in-scope systems',
      'Test alerting for known attack patterns (brute force, privilege escalation)',
      'Verify alert response procedures and SLAs',
      'Confirm monitoring coverage for after-hours activity',
      'Test anomaly detection baselines',
    ],
  },
  {
    controlId: 'CP-9',
    confidentiality: 'M', integrity: 'H', availability: 'H',
    assessmentObjectives: [
      'CP-09a. Verify backups of user-level information are conducted per defined frequency.',
      'CP-09b. Verify backups of system-level information are conducted per defined frequency.',
      'CP-09c. Verify backups of system documentation are conducted per defined frequency.',
      'CP-09d. Verify the confidentiality, integrity, and availability of backup information is protected at storage location.',
    ],
    examineItems: ['Contingency planning policy', 'Procedures for system backup', 'System security plan', 'Backup configuration documentation', 'Backup records', 'Backup test results'],
    interviewTargets: ['System or network administrators', 'Organizational personnel with backup responsibilities'],
    testProcedures: [
      'Verify backup schedule meets defined RPO',
      'Confirm backup encryption at rest',
      'Test restoration from backup and verify data integrity',
      'Verify backup media is stored at separate physical location',
      'Confirm backup testing occurs per defined frequency',
    ],
  },
];
