/**
 * FintekPro Role Hierarchy System
 * 
 * SUPERADMIN
 * └── Master Agent (ARN/EUIN/POSP/DSA – top compliance anchor)
 *     ├── Admin
 *     │     ├── Business Development Head
 *     │     │       ├── Partners
 *     │     │       │     ├── Agents
 *     │     │       │     │     ├── Sub-Agents
 *     │     │       │     │     │     └── Business Associates
 *     │     │       │     └── Partner Ops Support
 *     │     │       └── Distribution Team
 *     │     ├── Compliance Officer
 *     │     ├── Accounts & Finance
 *     │     ├── Operations Support Team
 *     │     ├── HR
 *     │     └── Technology Team (Backend + Frontend + DevOps)
 *     └── Regulatory Audit Oversight
 */

// Role type definitions
export type RoleId = 
  // Top Level
  | 'superadmin'
  | 'master_agent'
  
  // Admin Department Heads
  | 'admin'
  | 'bd_head'           // Business Development Head
  | 'compliance_officer'
  | 'finance_head'      // Accounts & Finance Head
  | 'ops_head'          // Operations Support Head
  | 'hr_head'
  | 'tech_head'         // Technology Team Lead
  | 'regulatory_auditor'
  
  // Team Members
  | 'bd_team'           // Distribution Team member
  | 'compliance_team'
  | 'finance_team'
  | 'ops_team'
  | 'hr_team'
  | 'tech_backend'
  | 'tech_frontend'
  | 'tech_devops'
  
  // External Distribution Hierarchy
  | 'partner'           // Partner (Company/Individual with ARN)
  | 'partner_ops'       // Partner Ops Support
  | 'agent'             // Agent (reports to Partner)
  | 'sub_agent'         // Field Executive (reports to Agent)
  | 'associate'         // Associate (reports to Field Executive)
  
  // Client Types
  | 'client'            // Regular retail client
  | 'business_client'   // Business/Corporate client
  | 'user'              // Default user role
  
  // Special Roles
  | 'tester';           // Universal tester - full access + error data collection

// Role metadata interface
export interface RoleDefinition {
  id: RoleId;
  name: string;
  description: string;
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
    parentRoles: [],
    portal: 'admin',
    level: 0,
    permissions: ['*'],  // All permissions
    canManageRoles: ['master_agent', 'admin', 'bd_head', 'compliance_officer', 'finance_head', 'ops_head', 'hr_head', 'tech_head', 'regulatory_auditor'],
    isInternal: true,
    requiresCompliance: false,
  },

  // Level 1: Master Agent (Compliance Anchor)
  master_agent: {
    id: 'master_agent',
    name: 'Master Agent',
    description: 'Top compliance anchor with ARN/EUIN/POSP/DSA certifications',
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
      'create:agent',
      'create:sub_agent',
      'create:associate',
      'refer:master_agent',
    ],
    canManageRoles: ['admin', 'partner', 'agent', 'sub_agent', 'associate', 'regulatory_auditor'],
    isInternal: true,
    requiresCompliance: true,
  },

  // Level 2: Admin Roles (Department Heads)
  admin: {
    id: 'admin',
    name: 'Admin',
    description: 'System administrator with broad access',
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
    canManageRoles: ['bd_head', 'compliance_officer', 'finance_head', 'ops_head', 'hr_head', 'tech_head'],
    isInternal: true,
    requiresCompliance: false,
  },

  bd_head: {
    id: 'bd_head',
    name: 'Business Development Head',
    description: 'Head of business development and distribution',
    parentRoles: ['admin'],
    portal: 'admin',
    level: 2,
    permissions: [
      'manage:partners',
      'manage:agents',
      'view:distribution_metrics',
      'manage:campaigns',
      'approve:partner_applications',
      'manage:bd_team',
    ],
    canManageRoles: ['bd_team', 'partner'],
    isInternal: true,
    requiresCompliance: false,
  },

  compliance_officer: {
    id: 'compliance_officer',
    name: 'Compliance Officer',
    description: 'Regulatory compliance and KYC oversight',
    parentRoles: ['admin', 'master_agent'],
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
    canManageRoles: ['compliance_team'],
    isInternal: true,
    requiresCompliance: true,
  },

  finance_head: {
    id: 'finance_head',
    name: 'Finance Head',
    description: 'Accounts and finance management',
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
    parentRoles: ['master_agent'],
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
    parentRoles: ['tech_head'],
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
    parentRoles: ['ops_head', 'partner'],
    portal: 'partner',
    level: 3,
    permissions: [
      'view:partner_transactions',
      'manage:partner_support',
      'assist:agents',
    ],
    canManageRoles: [],
    isInternal: false,
    requiresCompliance: false,
  },

  // Level 4: External Distribution Network - Partners
  /**
   * Level 4: Partner — Mid-Tier Role
   * Sits between Admin and Agent in the hierarchy.
   * Can manage agents WITH EUIN (AMFI-certified, MF transactions enabled)
   * and agents WITHOUT EUIN (lead/DSA agents, transactions blocked until EUIN verified).
   */
  partner: {
    id: 'partner',
    name: 'Partner',
    description: 'Distribution partner (Company/Individual with ARN) — mid-tier between Admin and Agent',
    parentRoles: ['bd_head', 'master_agent'],
    portal: 'partner',
    level: 4,
    permissions: [
      // Agent management (core mid-tier capability)
      'manage:own_agents',             // CRUD for agents under this partner
      'invite:agent_with_euin',        // Onboard AMFI-certified agents (EUIN required)
      'invite:agent_without_euin',     // Onboard DSA/lead agents (no EUIN)
      'assign:agent_euin',             // Assign/upgrade agent with EUIN number
      'suspend:agent',                 // Suspend agents
      'reactivate:agent',              // Reactivate suspended agents
      // Financial
      'view:own_transactions',
      'view:own_commissions',
      'manage:own_clients',
      // Network
      'create:sub_agent',
      'create:associate',
      'refer:partner',
    ],
    canManageRoles: ['agent', 'partner_ops', 'sub_agent', 'associate'],
    isInternal: false,
    requiresCompliance: true,
  },

  // Level 5: Agents
  agent: {
    id: 'agent',
    name: 'Agent',
    description: 'Field agent under a partner',
    parentRoles: ['partner', 'agent'],
    portal: 'agent',
    level: 5,
    permissions: [
      'manage:own_clients',
      'view:own_transactions',
      'view:own_commissions',
      'create:sub_agent',
      'create:associate',
      'create:leads',
      'refer:agent',
    ],
    canManageRoles: ['sub_agent', 'associate', 'agent'],
    isInternal: false,
    requiresCompliance: true,
  },

  // Level 6: Field Executives
  sub_agent: {
    id: 'sub_agent',
    name: 'Field Executive',
    description: 'Field Executive under an agent',
    parentRoles: ['agent', 'sub_agent'],
    portal: 'agent',
    level: 6,
    permissions: [
      'manage:own_clients',
      'view:own_transactions',
      'view:own_commissions',
      'create:associate',
      'create:leads',
      'refer:sub_agent',
    ],
    canManageRoles: ['associate', 'sub_agent'],
    isInternal: false,
    requiresCompliance: true,
  },

  // Level 7: Associates
  associate: {
    id: 'associate',
    name: 'Business Associate',
    description: 'Business Associate under a Field Executive',
    parentRoles: ['sub_agent', 'associate'],
    portal: 'agent',
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
export function isInHierarchyChain(userRole: RoleId, targetRole: RoleId): boolean {
  const targetDef = ROLE_DEFINITIONS[targetRole];
  if (!targetDef) return false;
  
  // Check if userRole is a direct or indirect parent
  for (const parent of targetDef.parentRoles) {
    if (parent === userRole) return true;
    if (isInHierarchyChain(userRole, parent)) return true;
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
      def.canManageRoles.forEach(r => manageable.add(r));
      
      // Recursively add roles that manageable roles can manage
      def.canManageRoles.forEach(r => {
        const subDef = ROLE_DEFINITIONS[r];
        if (subDef) {
          subDef.canManageRoles.forEach(sr => manageable.add(sr));
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
  return ROLE_DEFINITIONS[role]?.portal || 'client';
}

/**
 * Get the highest priority portal for multiple roles
 */
export function getPrimaryPortal(roles: RoleId[]): 'admin' | 'partner' | 'agent' | 'client' {
  const portalPriority: Record<string, number> = {
    admin: 0,
    partner: 1,
    agent: 2,
    client: 3,
  };
  
  let primaryPortal: 'admin' | 'partner' | 'agent' | 'client' = 'client';
  let lowestPriority = Number.POSITIVE_INFINITY;
  
  for (const role of roles) {
    const portal = getPortalForRole(role);
    const priority = portalPriority[portal];
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
    
    def.permissions.forEach(p => userPermissions.add(p));
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
      def.permissions.forEach(p => permissions.add(p));
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
 * Get all external distribution roles
 */
export function getDistributionRoles(): RoleId[] {
  return ['partner', 'partner_ops', 'agent', 'sub_agent', 'associate'];
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

// Export role groups for easy access
export const ADMIN_ROLES: RoleId[] = ['superadmin', 'master_agent', 'admin', 'bd_head', 'compliance_officer', 'finance_head', 'ops_head', 'hr_head', 'tech_head', 'regulatory_auditor', 'tester'];
export const TEAM_ROLES: RoleId[] = ['bd_team', 'compliance_team', 'finance_team', 'ops_team', 'hr_team', 'tech_backend', 'tech_frontend', 'tech_devops'];
export const PARTNER_ROLES: RoleId[] = ['partner', 'partner_ops'];
export const AGENT_ROLES: RoleId[] = ['agent', 'sub_agent', 'associate'];
export const CLIENT_ROLES: RoleId[] = ['client', 'business_client', 'user'];

// All roles that can access admin portal
export const ADMIN_PORTAL_ROLES: RoleId[] = [...ADMIN_ROLES, ...TEAM_ROLES];

// All roles that can access partner portal
export const PARTNER_PORTAL_ROLES: RoleId[] = [...PARTNER_ROLES];

// All roles that can access agent portal  
export const AGENT_PORTAL_ROLES: RoleId[] = [...AGENT_ROLES];
