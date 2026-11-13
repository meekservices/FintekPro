/**
 * FintekPro Role Hierarchy System
 * 
 * SUPERADMIN (Level 0)
 * └── Master Partner (Level 1 – ARN/EUIN/POSP/DSA top compliance anchor)
 *     ├── Admin (Level 2 – Department Heads)
 *     │     ├── Business Development Head
 *     │     │       ├── Distribution Partners (Level 4 – Wealth Managers, RIAs, DSAs, MFDs)
 *     │     │       │     ├── Sales Support (Level 5 – Client Acquisition & Partner Ops)
 *     │     │       │     │     ├── Client Support (Level 6 – Onboarding, Servicing & Operations)
 *     │     │       │     │     │     └── Partner Associates (Level 7 – Referrals & Lead Generation)
 *     │     │       │     └── Partner Ops Support (Level 3)
 *     │     │       └── Distribution Team (Level 3)
 *     │     ├── Compliance Officer (Level 2)
 *     │     │       └── Compliance Team (Level 3)
 *     │     ├── Accounts & Finance Head (Level 2)
 *     │     │       └── Finance Team (Level 3)
 *     │     ├── Operations Support Head (Level 2)
 *     │     │       └── Operations Team (Level 3)
 *     │     ├── HR Head (Level 2)
 *     │     │       └── HR Team (Level 3)
 *     │     └── Technology Team Head (Level 2)
 *     │             ├── Backend Developers (Level 3)
 *     │             ├── Frontend Developers (Level 3)
 *     │             └── DevOps Engineers (Level 3)
 *     ├── Regulatory Audit Oversight (Level 2 – Regulatory Auditor)
 *     └── Universal Tester (Level 1 – Diagnostics & Logs)
 * 
 * CLIENTS & INVESTORS:
 * ├── Corporate / Business Clients (Level 8)
 * ├── Retail Clients (Level 8)
 * └── Base Registered Users (Level 9)
 * 
 * NOTE ON AI AGENTS:
 * Under FASP-AI v1.0, the term "AGENT" is strictly and exclusively reserved for AI AGENTS
 * (Autonomous Copilots, Advisory Engines, CRM Agents, Compliance Agents).
 * Human distribution professionals are Partners, Sales Support, Client Support, or Associates.
 */

// Role categories for classification and UI grouping
export type RoleCategory = 
  | 'statutory_officer'     // Mandatory statutory & regulatory officers (SEBI, PMLA, CSCRF, DPDP)
  | 'internal_management'   // Department Heads & Administrators
  | 'internal_staff'        // Internal operations & engineering staff
  | 'licensed_professional' // External accredited professionals (Chartered Accountants, Company Secretaries)
  | 'distribution_network'  // Distribution Partners, Sales Support, Client Support, Associates
  | 'client';               // Retail & Corporate Clients

// Indian Financial Regulatory Bodies
export type RegulatoryBody = 
  | 'SEBI'       // Securities and Exchange Board of India
  | 'FIU_IND'    // Financial Intelligence Unit – India (PMLA)
  | 'CERT_IN'    // Indian Computer Emergency Response Team (CSCRF)
  | 'DPDP'       // Data Protection Board of India (DPDP Act 2023)
  | 'MCA'        // Ministry of Corporate Affairs
  | 'ICAI'       // Institute of Chartered Accountants of India
  | 'ICSI'       // Institute of Company Secretaries of India
  | 'AMFI'       // Association of Mutual Funds in India
  | 'RBI';       // Reserve Bank of India

// Role type definitions
export type RoleId = 
  // Top Level & Statutory Governance
  | 'superadmin'
  | 'designated_director' // PMLA / FIU-IND Statutory Board Director
  | 'master_agent'        // Top compliance partner anchor (ARN/EUIN/POSP/DSA)
  
  // Statutory Regulatory Officers (SEBI, PMLA, CSCRF, DPDP)
  | 'principal_officer'   // SEBI RIA / RA / PMS Principal Officer (Mandatory advisory head)
  | 'compliance_officer'  // SEBI Intermediary Compliance Officer
  | 'grievance_officer'   // SEBI SCORES 2.0 & SMART ODR Grievance Redressal / Nodal Officer
  | 'ciso'                // Chief Information Security Officer (SEBI CSCRF & CERT-In)
  | 'dpo'                 // Data Protection Officer (DPDP Act 2023)
  | 'regulatory_auditor'  // Statutory / Internal Regulatory Auditor
  
  // Admin Department Heads
  | 'admin'
  | 'bd_head'             // Business Development Head
  | 'finance_head'        // Accounts & Finance Head
  | 'ops_head'            // Operations Support Head
  | 'hr_head'
  | 'tech_head'           // Technology Team Lead
  
  // Team Members
  | 'bd_team'             // Distribution Team member
  | 'compliance_team'
  | 'finance_team'
  | 'ops_team'
  | 'hr_team'
  | 'tech_backend'
  | 'tech_frontend'
  | 'tech_devops'
  
  // Licensed Practice Network (CA & CS Portal)
  | 'ca'                  // Chartered Accountant (Tax Audit, Form 15CA/CB, Financials)
  | 'cs'                  // Company Secretary (MCA/ROC Filings, Secretarial Audit, KMP)

  // External Distribution Hierarchy
  | 'partner'             // Partner (Company/Individual with ARN)
  | 'partner_ops'         // Partner Ops Support
  | 'sales_support'       // Sales Support (formerly human agent; 'agent' is reserved strictly for AI agents)
  | 'client_support'      // Client Support (formerly sub-agent / field executive)
  | 'agent'               // Backward compatibility alias -> maps to sales_support / partner
  | 'sub_agent'           // Backward compatibility alias -> maps to client_support
  | 'associate'           // Associate (reports to Client Support / Sales Support)
  
  // Client Types
  | 'client'              // Regular retail client
  | 'business_client'     // Business/Corporate client
  | 'user'                // Default user role
  
  // Special Roles
  | 'tester';             // Universal tester - full access + error data collection

// Role metadata interface
export interface RoleDefinition {
  id: RoleId;
  name: string;
  description: string;
  category: RoleCategory;
  regulator?: RegulatoryBody;
  mandatoryCredential?: string; // Required statutory credential (e.g. NISM, DIN, COP)
  parentRoles: RoleId[];        // Direct parent roles in hierarchy
  portal: 'admin' | 'partner' | 'agent' | 'client';  // Which portal this role accesses
  level: number;                // Hierarchy level (0 = highest)
  permissions: string[];        // Base permissions for this role
  canManageRoles: RoleId[];     // Roles this role can manage/create
  isInternal: boolean;          // Internal FintekPro staff vs external
  requiresCompliance: boolean;  // Requires regulatory compliance (ARN/EUIN etc)
}

// Complete role definitions with hierarchy
export const ROLE_DEFINITIONS: Record<RoleId, RoleDefinition> = {
  // Level 0: Super Admin
  superadmin: {
    id: 'superadmin',
    name: 'Super Admin',
    description: 'Platform owner with full system access',
    category: 'internal_management',
    parentRoles: [],
    portal: 'admin',
    level: 0,
    permissions: ['*'],  // All permissions
    canManageRoles: ['designated_director', 'master_agent', 'admin', 'principal_officer', 'compliance_officer', 'grievance_officer', 'ciso', 'dpo', 'bd_head', 'finance_head', 'ops_head', 'hr_head', 'tech_head', 'regulatory_auditor'],
    isInternal: true,
    requiresCompliance: false,
  },

  // Level 1: Designated Director (PMLA / FIU-IND Statutory Board Director)
  designated_director: {
    id: 'designated_director',
    name: 'Designated Director',
    description: 'Statutory Board Director responsible for PMLA & FIU-IND regulatory reporting obligations',
    category: 'statutory_officer',
    regulator: 'FIU_IND',
    mandatoryCredential: 'Director Identification Number (DIN) & Board Resolution',
    parentRoles: ['superadmin'],
    portal: 'admin',
    level: 1,
    permissions: [
      'view:all_transactions',
      'manage:compliance',
      'approve:fiu_ind_filings',
      'view:audit_logs',
      'submit:regulatory_reports',
      'escalate:aml_alerts',
    ],
    canManageRoles: ['compliance_officer', 'principal_officer', 'regulatory_auditor'],
    isInternal: true,
    requiresCompliance: true,
  },

  // Level 1: Master Partner (Compliance Anchor)
  master_agent: {
    id: 'master_agent',
    name: 'Master Partner',
    description: 'Top compliance partner anchor with ARN/EUIN/POSP/DSA certifications',
    category: 'statutory_officer',
    regulator: 'AMFI',
    mandatoryCredential: 'ARN & EUIN License',
    parentRoles: ['superadmin'],
    portal: 'admin',
    level: 1,
    permissions: [
      'view:all_transactions',
      'manage:distribution_network',
      'manage:compliance',
      'approve:partner_onboarding',
      'approve:agent_onboarding',
      'view:audit_logs',
      'manage:commissions',
      'submit:regulatory_reports',
      'create:partner',
      'create:sales_support',
      'create:client_support',
      'create:ca',
      'create:cs',
      'create:agent',
      'create:sub_agent',
      'create:associate',
      'refer:master_agent',
    ],
    canManageRoles: ['admin', 'partner', 'ca', 'cs', 'sales_support', 'client_support', 'agent', 'sub_agent', 'associate', 'regulatory_auditor'],
    isInternal: true,
    requiresCompliance: true,
  },

  // Level 2: Principal Officer (SEBI RIA / RA / PMS Advisory Head)
  principal_officer: {
    id: 'principal_officer',
    name: 'Principal Officer',
    description: 'SEBI-mandated Principal Officer for RIA/RA/PMS advisory operations, client suitability, and research approval',
    category: 'statutory_officer',
    regulator: 'SEBI',
    mandatoryCredential: 'SEBI Registration ID & NISM Series X-A / X-B Certification',
    parentRoles: ['superadmin', 'designated_director', 'master_agent'],
    portal: 'admin',
    level: 2,
    permissions: [
      'manage:advisory',
      'approve:investment_recommendations',
      'view:compliance_reports',
      'manage:risk_profiling',
      'submit:regulatory_reports',
      'view:all_transactions',
      'manage:products',
    ],
    canManageRoles: ['bd_head', 'partner'],
    isInternal: true,
    requiresCompliance: true,
  },

  // Level 2: Admin Roles (Department Heads)
  admin: {
    id: 'admin',
    name: 'Admin',
    description: 'System administrator with broad access',
    category: 'internal_management',
    parentRoles: ['superadmin', 'master_agent'],
    portal: 'admin',
    level: 2,
    permissions: [
      'manage:users',
      'manage:products',
      'view:transactions',
      'manage:content',
      'view:reports',
      'manage:support',
    ],
    canManageRoles: ['bd_head', 'compliance_officer', 'finance_head', 'ops_head', 'hr_head', 'tech_head', 'ca', 'cs'],
    isInternal: true,
    requiresCompliance: false,
  },

  bd_head: {
    id: 'bd_head',
    name: 'Business Development Head',
    description: 'Head of business development and distribution',
    category: 'internal_management',
    parentRoles: ['admin'],
    portal: 'admin',
    level: 2,
    permissions: [
      'manage:partners',
      'manage:sales_support',
      'manage:client_support',
      'manage:agents',
      'view:distribution_metrics',
      'manage:campaigns',
      'approve:partner_applications',
      'manage:bd_team',
    ],
    canManageRoles: ['bd_team', 'partner', 'sales_support', 'client_support'],
    isInternal: true,
    requiresCompliance: false,
  },

  compliance_officer: {
    id: 'compliance_officer',
    name: 'Compliance Officer',
    description: 'Regulatory compliance and KYC oversight',
    category: 'statutory_officer',
    regulator: 'SEBI',
    mandatoryCredential: 'NISM Series III-A Certification',
    parentRoles: ['admin', 'designated_director', 'master_agent'],
    portal: 'admin',
    level: 2,
    permissions: [
      'manage:kyc',
      'view:compliance_reports',
      'approve:kyc_escalations',
      'manage:aml_alerts',
      'submit:regulatory_reports',
      'manage:compliance_team',
    ],
    canManageRoles: ['compliance_team', 'grievance_officer'],
    isInternal: true,
    requiresCompliance: true,
  },

  // Level 2: Grievance Redressal / Nodal Officer (SEBI SCORES 2.0 & SMART ODR)
  grievance_officer: {
    id: 'grievance_officer',
    name: 'Grievance Redressal Officer',
    description: 'Statutory Nodal Officer for SEBI SCORES 2.0, SMART ODR, and investor complaint redressal within 21-day SLA',
    category: 'statutory_officer',
    regulator: 'SEBI',
    mandatoryCredential: 'SEBI SCORES 2.0 Nodal Officer Credential',
    parentRoles: ['compliance_officer', 'principal_officer', 'admin'],
    portal: 'admin',
    level: 2,
    permissions: [
      'manage:grievances',
      'resolve:scores_complaints',
      'manage:smart_odr',
      'view:compliance_reports',
      'escalate:grievance',
    ],
    canManageRoles: [],
    isInternal: true,
    requiresCompliance: true,
  },

  // Level 2: Chief Information Security Officer (SEBI CSCRF & CERT-In)
  ciso: {
    id: 'ciso',
    name: 'Chief Information Security Officer',
    description: 'SEBI CSCRF & CERT-In designated Chief Information Security Officer for cyber resilience, vulnerability audits and incident reporting',
    category: 'statutory_officer',
    regulator: 'CERT_IN',
    mandatoryCredential: 'CISA / CISM / CISSP Credential & CERT-In Designation',
    parentRoles: ['superadmin', 'admin'],
    portal: 'admin',
    level: 2,
    permissions: [
      'manage:cybersecurity',
      'report:certin_incidents',
      'view:system_logs',
      'manage:vulnerability_assessments',
      'audit:system_security',
      'access:dev_tools',
    ],
    canManageRoles: ['tech_devops'],
    isInternal: true,
    requiresCompliance: true,
  },

  // Level 2: Data Protection Officer (DPDP Act 2023)
  dpo: {
    id: 'dpo',
    name: 'Data Protection Officer',
    description: 'DPDP Act 2023 statutory officer responsible for data privacy governance, consent auditing, and Data Protection Board compliance',
    category: 'statutory_officer',
    regulator: 'DPDP',
    mandatoryCredential: 'Data Protection Officer Appointment & DPBI Registration',
    parentRoles: ['superadmin', 'compliance_officer'],
    portal: 'admin',
    level: 2,
    permissions: [
      'manage:data_privacy',
      'audit:consent_records',
      'process:data_subject_requests',
      'view:compliance_reports',
    ],
    canManageRoles: [],
    isInternal: true,
    requiresCompliance: true,
  },

  finance_head: {
    id: 'finance_head',
    name: 'Finance Head',
    description: 'Accounts and finance management',
    category: 'internal_management',
    parentRoles: ['admin'],
    portal: 'admin',
    level: 2,
    permissions: [
      'manage:settlements',
      'manage:commissions',
      'view:financial_reports',
      'approve:payouts',
      'manage:reconciliation',
      'manage:finance_team',
    ],
    canManageRoles: ['finance_team'],
    isInternal: true,
    requiresCompliance: false,
  },

  ops_head: {
    id: 'ops_head',
    name: 'Operations Head',
    description: 'Operations and support team management',
    category: 'internal_management',
    parentRoles: ['admin'],
    portal: 'admin',
    level: 2,
    permissions: [
      'manage:support_tickets',
      'manage:operations',
      'view:ops_metrics',
      'manage:ops_team',
      'escalate:issues',
    ],
    canManageRoles: ['ops_team', 'partner_ops'],
    isInternal: true,
    requiresCompliance: false,
  },

  hr_head: {
    id: 'hr_head',
    name: 'HR Head',
    description: 'Human resources management',
    category: 'internal_management',
    parentRoles: ['admin'],
    portal: 'admin',
    level: 2,
    permissions: [
      'manage:employees',
      'view:hr_reports',
      'manage:onboarding',
      'manage:hr_team',
    ],
    canManageRoles: ['hr_team'],
    isInternal: true,
    requiresCompliance: false,
  },

  tech_head: {
    id: 'tech_head',
    name: 'Technology Head',
    description: 'Technology and development team lead',
    category: 'internal_management',
    parentRoles: ['admin'],
    portal: 'admin',
    level: 2,
    permissions: [
      'manage:deployments',
      'view:system_logs',
      'manage:integrations',
      'manage:tech_team',
      'access:admin_tools',
    ],
    canManageRoles: ['tech_backend', 'tech_frontend', 'tech_devops'],
    isInternal: true,
    requiresCompliance: false,
  },

  regulatory_auditor: {
    id: 'regulatory_auditor',
    name: 'Regulatory Auditor',
    description: 'External regulatory audit oversight',
    category: 'statutory_officer',
    regulator: 'SEBI',
    mandatoryCredential: 'Chartered Accountant / Certified Internal Auditor',
    parentRoles: ['master_agent', 'designated_director'],
    portal: 'admin',
    level: 2,
    permissions: [
      'view:audit_logs',
      'view:compliance_reports',
      'view:transactions',
      'generate:audit_reports',
    ],
    canManageRoles: [],
    isInternal: false,
    requiresCompliance: true,
  },

  // Level 3: Team Members
  bd_team: {
    id: 'bd_team',
    name: 'Distribution Team',
    description: 'Business development team member',
    category: 'internal_staff',
    parentRoles: ['bd_head'],
    portal: 'admin',
    level: 3,
    permissions: [
      'view:partners',
      'view:agents',
      'create:leads',
      'manage:campaigns',
    ],
    canManageRoles: [],
    isInternal: true,
    requiresCompliance: false,
  },

  compliance_team: {
    id: 'compliance_team',
    name: 'Compliance Team',
    description: 'Compliance team member',
    category: 'internal_staff',
    parentRoles: ['compliance_officer'],
    portal: 'admin',
    level: 3,
    permissions: [
      'view:kyc',
      'verify:kyc',
      'view:compliance_reports',
    ],
    canManageRoles: [],
    isInternal: true,
    requiresCompliance: false,
  },

  finance_team: {
    id: 'finance_team',
    name: 'Finance Team',
    description: 'Finance and accounts team member',
    category: 'internal_staff',
    parentRoles: ['finance_head'],
    portal: 'admin',
    level: 3,
    permissions: [
      'view:transactions',
      'process:settlements',
      'view:financial_reports',
    ],
    canManageRoles: [],
    isInternal: true,
    requiresCompliance: false,
  },

  ops_team: {
    id: 'ops_team',
    name: 'Operations Team',
    description: 'Operations support team member',
    category: 'internal_staff',
    parentRoles: ['ops_head'],
    portal: 'admin',
    level: 3,
    permissions: [
      'manage:support_tickets',
      'view:operations',
      'assist:clients',
    ],
    canManageRoles: [],
    isInternal: true,
    requiresCompliance: false,
  },

  hr_team: {
    id: 'hr_team',
    name: 'HR Team',
    description: 'Human resources team member',
    category: 'internal_staff',
    parentRoles: ['hr_head'],
    portal: 'admin',
    level: 3,
    permissions: [
      'view:employees',
      'assist:onboarding',
    ],
    canManageRoles: [],
    isInternal: true,
    requiresCompliance: false,
  },

  tech_backend: {
    id: 'tech_backend',
    name: 'Backend Developer',
    description: 'Backend development team member',
    category: 'internal_staff',
    parentRoles: ['tech_head'],
    portal: 'admin',
    level: 3,
    permissions: [
      'view:system_logs',
      'manage:api',
      'access:dev_tools',
    ],
    canManageRoles: [],
    isInternal: true,
    requiresCompliance: false,
  },

  tech_frontend: {
    id: 'tech_frontend',
    name: 'Frontend Developer',
    description: 'Frontend development team member',
    category: 'internal_staff',
    parentRoles: ['tech_head'],
    portal: 'admin',
    level: 3,
    permissions: [
      'view:system_logs',
      'manage:ui',
      'access:dev_tools',
    ],
    canManageRoles: [],
    isInternal: true,
    requiresCompliance: false,
  },

  tech_devops: {
    id: 'tech_devops',
    name: 'DevOps Engineer',
    description: 'DevOps and infrastructure team member',
    category: 'internal_staff',
    parentRoles: ['tech_head', 'ciso'],
    portal: 'admin',
    level: 3,
    permissions: [
      'view:system_logs',
      'manage:deployments',
      'manage:infrastructure',
      'access:dev_tools',
    ],
    canManageRoles: [],
    isInternal: true,
    requiresCompliance: false,
  },

  partner_ops: {
    id: 'partner_ops',
    name: 'Partner Ops Support',
    description: 'Partner operations support staff',
    category: 'distribution_network',
    parentRoles: ['ops_head', 'partner'],
    portal: 'partner',
    level: 3,
    permissions: [
      'view:partner_transactions',
      'manage:partner_support',
      'assist:agents',
      'assist:sales_support',
      'assist:client_support',
    ],
    canManageRoles: [],
    isInternal: false,
    requiresCompliance: false,
  },

  // Level 4: Licensed Practice Professionals (CA & CS Practice Portal)
  ca: {
    id: 'ca',
    name: 'Chartered Accountant',
    description: 'Accredited Chartered Accountant for statutory audits, Form 15CA/15CB remittances, tax compliance & certifications',
    category: 'licensed_professional',
    regulator: 'ICAI',
    mandatoryCredential: 'ICAI Membership Number & Certificate of Practice (COP)',
    parentRoles: ['admin', 'master_agent'],
    portal: 'partner',
    level: 4,
    permissions: [
      'manage:own_clients',
      'view:tax_filings',
      'sign:form_15cb',
      'perform:statutory_audit',
      'view:own_commissions',
      'view:own_transactions',
      'create:leads',
    ],
    canManageRoles: [],
    isInternal: false,
    requiresCompliance: true,
  },

  cs: {
    id: 'cs',
    name: 'Company Secretary',
    description: 'Accredited Company Secretary for MCA/ROC filings, secretarial audits, corporate governance & Key Managerial Personnel oversight',
    category: 'licensed_professional',
    regulator: 'ICSI',
    mandatoryCredential: 'ICSI Membership Number & Certificate of Practice (COP)',
    parentRoles: ['admin', 'master_agent'],
    portal: 'partner',
    level: 4,
    permissions: [
      'manage:own_clients',
      'manage:mca_filings',
      'sign:secretarial_audit',
      'manage:director_kyc',
      'view:own_commissions',
      'view:own_transactions',
      'create:leads',
    ],
    canManageRoles: [],
    isInternal: false,
    requiresCompliance: true,
  },

  // Level 4: External Distribution Network - Partners (Human distribution roles are Partners)
  partner: {
    id: 'partner',
    name: 'Partner',
    description: 'Distribution Partner (human distribution role; "agent" is reserved exclusively for AI agents)',
    category: 'distribution_network',
    regulator: 'AMFI',
    mandatoryCredential: 'ARN Number',
    parentRoles: ['bd_head', 'master_agent'],
    portal: 'partner',
    level: 4,
    permissions: [
      'manage:own_clients',
      'view:own_transactions',
      'view:own_commissions',
      'create:sales_support',
      'create:client_support',
      'create:sub_agent',
      'create:associate',
      'create:leads',
      'refer:partner',
      'manage:own_agents',
      'invite:agent_with_euin',
      'invite:agent_without_euin',
      'assign:agent_euin',
      'suspend:agent',
      'reactivate:agent',
    ],
    canManageRoles: ['partner_ops', 'sales_support', 'client_support', 'sub_agent', 'associate'],
    isInternal: false,
    requiresCompliance: true,
  },

  // Level 5: Sales Support (Formerly human agent. 'agent' is reserved exclusively for AI agents)
  sales_support: {
    id: 'sales_support',
    name: 'Sales Support',
    description: 'Sales Support professional assisting distribution partners, client acquisition, and operations. ("Agent" is strictly reserved for AI agents)',
    category: 'distribution_network',
    mandatoryCredential: 'EUIN Certification',
    parentRoles: ['partner', 'bd_head', 'master_agent'],
    portal: 'partner',
    level: 5,
    permissions: [
      'manage:own_clients',
      'view:own_transactions',
      'view:own_commissions',
      'create:client_support',
      'create:sub_agent',
      'create:associate',
      'create:leads',
      'refer:sales_support',
      'refer:partner',
      'assist:clients',
    ],
    canManageRoles: ['client_support', 'sub_agent', 'associate'],
    isInternal: false,
    requiresCompliance: true,
  },

  // Legacy human 'agent' alias — maps to sales_support
  // Note: Going forward, "agent" across FintekPro refers exclusively to AI agents.
  agent: {
    id: 'sales_support' as RoleId,
    name: 'Sales Support',
    description: 'Legacy human role alias — replaced by sales_support. "agent" is reserved exclusively for AI agents.',
    category: 'distribution_network',
    parentRoles: ['partner', 'bd_head', 'master_agent'],
    portal: 'partner',
    level: 5,
    permissions: [
      'manage:own_clients',
      'view:own_transactions',
      'view:own_commissions',
      'create:client_support',
      'create:sub_agent',
      'create:associate',
      'create:leads',
      'refer:sales_support',
      'refer:partner',
    ],
    canManageRoles: ['client_support', 'sub_agent', 'associate'],
    isInternal: false,
    requiresCompliance: true,
  },

  // Level 6: Client Support (Formerly sub-agent / field executive)
  client_support: {
    id: 'client_support',
    name: 'Client Support',
    description: 'Client Support specialist assisting clients with onboarding, portfolio operations, and servicing (formerly sub-agent).',
    category: 'distribution_network',
    parentRoles: ['sales_support', 'partner', 'master_agent'],
    portal: 'partner',
    level: 6,
    permissions: [
      'manage:own_clients',
      'view:own_transactions',
      'view:own_commissions',
      'create:associate',
      'create:leads',
      'assist:clients',
      'refer:client_support',
    ],
    canManageRoles: ['associate'],
    isInternal: false,
    requiresCompliance: true,
  },

  // Legacy 'sub_agent' alias — maps to client_support
  sub_agent: {
    id: 'client_support' as RoleId,
    name: 'Client Support',
    description: 'Legacy sub-agent role alias — replaced by client_support.',
    category: 'distribution_network',
    parentRoles: ['sales_support', 'partner', 'master_agent'],
    portal: 'partner',
    level: 6,
    permissions: [
      'manage:own_clients',
      'view:own_transactions',
      'view:own_commissions',
      'create:associate',
      'create:leads',
      'assist:clients',
      'refer:client_support',
    ],
    canManageRoles: ['associate'],
    isInternal: false,
    requiresCompliance: true,
  },

  // Level 7: Partner Associates (Migrated from Business Associates)
  associate: {
    id: 'associate',
    name: 'Partner Associate',
    description: 'Partner Associate in distribution network',
    category: 'distribution_network',
    parentRoles: ['client_support', 'sales_support', 'partner', 'sub_agent'],
    portal: 'partner',
    level: 7,
    permissions: [
      'create:leads',
      'view:own_commissions',
      'refer:associate',
    ],
    canManageRoles: ['associate'],
    isInternal: false,
    requiresCompliance: false,
  },

  // Level 8: Clients
  client: {
    id: 'client',
    name: 'Client',
    description: 'Retail investor client',
    category: 'client',
    parentRoles: [],
    portal: 'client',
    level: 8,
    permissions: [
      'view:own_portfolio',
      'place:orders',
      'manage:own_profile',
    ],
    canManageRoles: [],
    isInternal: false,
    requiresCompliance: false,
  },

  business_client: {
    id: 'business_client',
    name: 'Business Client',
    description: 'Corporate/Business investor client',
    category: 'client',
    parentRoles: [],
    portal: 'client',
    level: 8,
    permissions: [
      'view:own_portfolio',
      'place:orders',
      'manage:own_profile',
      'manage:authorized_signatories',
    ],
    canManageRoles: [],
    isInternal: false,
    requiresCompliance: false,
  },

  user: {
    id: 'user',
    name: 'User',
    description: 'Default registered user',
    category: 'client',
    parentRoles: [],
    portal: 'client',
    level: 9,
    permissions: [
      'view:own_profile',
      'complete:kyc',
    ],
    canManageRoles: [],
    isInternal: false,
    requiresCompliance: false,
  },

  tester: {
    id: 'tester',
    name: 'Universal Tester',
    description: 'QA/Testing role with full platform access and error data collection capabilities',
    category: 'internal_staff',
    parentRoles: ['superadmin'],
    portal: 'admin',
    level: 1,
    permissions: [
      '*',
      'access:error_diagnostics',
      'access:all_portals',
      'collect:error_data',
      'view:system_logs',
      'access:dev_tools',
      'view:api_metrics',
    ],
    canManageRoles: [],
    isInternal: true,
    requiresCompliance: false,
  },
};

// Helper functions for role hierarchy

/**
 * Check if a role has authority over another role
 */
export function hasAuthorityOver(userRole: RoleId, targetRole: RoleId): boolean {
  const userDef = ROLE_DEFINITIONS[userRole];
  const targetDef = ROLE_DEFINITIONS[targetRole];
  
  if (!userDef || !targetDef) return false;
  
  // Same role has no authority over itself
  if (userRole === targetRole) return false;
  
  // Higher level (lower number) has authority
  if (userDef.level < targetDef.level) {
    // Check if target is in the hierarchy chain
    return isInHierarchyChain(userRole, targetRole);
  }
  
  return false;
}

/**
 * Check if targetRole is in the hierarchy chain below userRole
 */
export function isInHierarchyChain(userRole: RoleId, targetRole: RoleId, visited = new Set<RoleId>()): boolean {
  if (visited.has(targetRole)) return false;
  visited.add(targetRole);

  const targetDef = ROLE_DEFINITIONS[targetRole];
  if (!targetDef) return false;
  
  // Check if userRole is a direct or indirect parent
  for (const parent of targetDef.parentRoles) {
    if (parent === targetRole) continue;
    if (parent === userRole) return true;
    if (isInHierarchyChain(userRole, parent, visited)) return true;
  }
  
  return false;
}

/**
 * Get all roles a user can manage based on their roles
 */
export function getManageableRoles(userRoles: RoleId[]): RoleId[] {
  const manageable = new Set<RoleId>();
  
  for (const role of userRoles) {
    const def = ROLE_DEFINITIONS[role];
    if (def) {
      def.canManageRoles.forEach(r => {
        manageable.add(r);
      });
      
      // Recursively add roles that manageable roles can manage
      def.canManageRoles.forEach(r => {
        const subDef = ROLE_DEFINITIONS[r];
        if (subDef) {
          subDef.canManageRoles.forEach(sr => {
            manageable.add(sr);
          });
        }
      });
    }
  }
  
  return Array.from(manageable);
}

/**
 * Get the portal a role should access
 */
export function getPortalForRole(role: RoleId): 'admin' | 'partner' | 'agent' | 'client' {
  const portal = ROLE_DEFINITIONS[role]?.portal;
  if (portal === 'agent') return 'partner';
  return portal || 'client';
}

/**
 * Get the highest priority portal for multiple roles
 */
export function getPrimaryPortal(roles: RoleId[]): 'admin' | 'partner' | 'agent' | 'client' {
  const portalPriority: Record<string, number> = {
    admin: 0,
    partner: 1,
    agent: 1,
    client: 2,
  };
  
  let primaryPortal: 'admin' | 'partner' | 'agent' | 'client' = 'client';
  let lowestPriority = Number.POSITIVE_INFINITY;
  
  for (const role of roles) {
    const portal = getPortalForRole(role);
    const priority = portalPriority[portal] ?? 2;
    if (priority < lowestPriority) {
      lowestPriority = priority;
      primaryPortal = portal;
    }
  }
  
  return primaryPortal;
}

/**
 * Check if user has any of the specified permissions
 */
export function hasAnyPermission(userRoles: RoleId[], requiredPermissions: string[]): boolean {
  for (const role of userRoles) {
    const def = ROLE_DEFINITIONS[role];
    if (!def) continue;
    
    // Superadmin has all permissions
    if (def.permissions.includes('*')) return true;
    
    // Check specific permissions
    for (const perm of requiredPermissions) {
      if (def.permissions.includes(perm)) return true;
    }
  }
  
  return false;
}

/**
 * Check if user has all specified permissions
 */
export function hasAllPermissions(userRoles: RoleId[], requiredPermissions: string[]): boolean {
  const userPermissions = new Set<string>();
  
  for (const role of userRoles) {
    const def = ROLE_DEFINITIONS[role];
    if (!def) continue;
    
    // Superadmin has all permissions
    if (def.permissions.includes('*')) return true;
    
    def.permissions.forEach(p => {
      userPermissions.add(p);
    });
  }
  
  return requiredPermissions.every(p => userPermissions.has(p));
}

/**
 * Get all permissions for given roles
 */
export function getAllPermissions(userRoles: RoleId[]): string[] {
  const permissions = new Set<string>();
  
  for (const role of userRoles) {
    const def = ROLE_DEFINITIONS[role];
    if (def) {
      def.permissions.forEach(p => {
        permissions.add(p);
      });
    }
  }
  
  return Array.from(permissions);
}

/**
 * Check if any of the roles require compliance (ARN/EUIN etc)
 */
export function requiresCompliance(roles: RoleId[]): boolean {
  return roles.some(role => ROLE_DEFINITIONS[role]?.requiresCompliance);
}

/**
 * Get all internal staff roles
 */
export function getInternalRoles(): RoleId[] {
  return Object.values(ROLE_DEFINITIONS)
    .filter(def => def.isInternal)
    .map(def => def.id);
}

/**
 * Get all external distribution roles (Partners, Sales Support, and Client Support)
 */
export function getDistributionRoles(): RoleId[] {
  return ['partner', 'partner_ops', 'sales_support', 'client_support', 'sub_agent', 'associate'];
}

/**
 * Get roles for a specific portal
 */
export function getRolesForPortal(portal: 'admin' | 'partner' | 'agent' | 'client'): RoleId[] {
  return Object.values(ROLE_DEFINITIONS)
    .filter(def => def.portal === portal)
    .map(def => def.id);
}

/**
 * Validate if a role assignment is allowed based on assigner's roles
 */
export function canAssignRole(assignerRoles: RoleId[], roleToAssign: RoleId): boolean {
  const manageable = getManageableRoles(assignerRoles);
  return manageable.includes(roleToAssign);
}

/**
 * Get display name for a role
 */
export function getRoleDisplayName(role: RoleId): string {
  return ROLE_DEFINITIONS[role]?.name || role;
}

/**
 * Get all roles as options for select dropdowns
 */
export function getRoleOptions(filterByPortal?: 'admin' | 'partner' | 'agent' | 'client'): { value: RoleId; label: string }[] {
  return Object.values(ROLE_DEFINITIONS)
    .filter(def => !filterByPortal || def.portal === filterByPortal)
    .sort((a, b) => a.level - b.level)
    .map(def => ({
      value: def.id,
      label: def.name,
    }));
}

// Export role groups for easy access & compliance checks
export const STATUTORY_ROLES: RoleId[] = [
  'designated_director',
  'master_agent',
  'principal_officer',
  'compliance_officer',
  'grievance_officer',
  'ciso',
  'dpo',
  'regulatory_auditor',
];

export const PROFESSIONAL_ROLES: RoleId[] = ['ca', 'cs'];

export const MANAGEMENT_ROLES: RoleId[] = [
  'superadmin',
  'admin',
  'bd_head',
  'finance_head',
  'ops_head',
  'hr_head',
  'tech_head',
];

export const ADMIN_ROLES: RoleId[] = [
  ...MANAGEMENT_ROLES,
  ...STATUTORY_ROLES,
  'tester',
];

export const TEAM_ROLES: RoleId[] = [
  'bd_team',
  'compliance_team',
  'finance_team',
  'ops_team',
  'hr_team',
  'tech_backend',
  'tech_frontend',
  'tech_devops',
];

// Human distribution roles are Partners, Sales Support, and Client Support. The "agent" name is reserved exclusively for AI agents.
export const PARTNER_ROLES: RoleId[] = [
  'partner',
  'partner_ops',
  'sales_support',
  'client_support',
  'sub_agent',
  'associate',
];

export const CLIENT_ROLES: RoleId[] = ['client', 'business_client', 'user'];

// All roles that can access admin portal
export const ADMIN_PORTAL_ROLES: RoleId[] = [...ADMIN_ROLES, ...TEAM_ROLES];

// All roles that can access partner portal (human distribution network & licensed professionals)
export const PARTNER_PORTAL_ROLES: RoleId[] = [...PARTNER_ROLES, ...PROFESSIONAL_ROLES];

// Backwards-compatibility aliases (human agent migrated to sales_support/partner; agent reserved for AI agents)
export const AGENT_ROLES: RoleId[] = PARTNER_ROLES;
export const AGENT_PORTAL_ROLES: RoleId[] = PARTNER_PORTAL_ROLES;

/**
 * Check if a role is a mandatory statutory regulatory officer
 */
export function isStatutoryRole(role: RoleId): boolean {
  return ROLE_DEFINITIONS[role]?.category === 'statutory_officer';
}

/**
 * Check if a role is an accredited licensed professional (CA / CS)
 */
export function isProfessionalRole(role: RoleId): boolean {
  return ROLE_DEFINITIONS[role]?.category === 'licensed_professional';
}

/**
 * Get all roles within a specific category
 */
export function getRolesByCategory(category: RoleCategory): RoleId[] {
  return (Object.values(ROLE_DEFINITIONS) as RoleDefinition[])
    .filter(def => def.category === category)
    .map(def => def.id);
}

/**
 * AI AGENT TAXONOMY (FASP-AI v1.0)
 * 
 * In FintekPro, the word "Agent" refers EXCLUSIVELY to AI Agents and Autonomous Copilots.
 * Human professionals are classified as Partners, Sales Support, Associates, or Administrators.
 */
export const AI_AGENT_TYPES = [
  'crm_agent',           // Automated lead nurturing, scoring & CRM Copilot
  'advisory_agent',      // FASP-AI investment suitability & portfolio copilot
  'compliance_agent',    // SEBI & PMLA regulatory KYC auditing agent
  'research_agent',      // Real-time market, equities, and mutual fund intelligence agent
  'ops_support_agent',   // Autonomous client query resolution & ticket routing agent
] as const;

export type AIAgentType = typeof AI_AGENT_TYPES[number];
