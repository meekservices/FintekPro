/**
 * Server-side Role Service for FintekPro
 * Handles role-based access control, permission checking, and hierarchy validation
 */

import {
  RoleId,
  ROLE_DEFINITIONS,
  hasAuthorityOver,
  isInHierarchyChain,
  getManageableRoles,
  getPortalForRole,
  getPrimaryPortal,
  hasAnyPermission,
  hasAllPermissions,
  getAllPermissions,
  requiresCompliance,
  canAssignRole,
  getRoleDisplayName,
  ADMIN_PORTAL_ROLES,
  PARTNER_PORTAL_ROLES,
  AGENT_PORTAL_ROLES,
} from '@shared/schema';

export interface RoleCheckResult {
  allowed: boolean;
  reason?: string;
  requiredRoles?: RoleId[];
  userRoles?: RoleId[];
}

export interface PortalAccessResult {
  canAccess: boolean;
  portal: 'admin' | 'partner' | 'agent' | 'client';
  redirectTo?: string;
}

/**
 * Role Service class for server-side role management
 */
class RoleService {
  /**
   * Check if user can access admin portal
   */
  canAccessAdminPortal(userRoles: RoleId[]): boolean {
    return userRoles.some(role => ADMIN_PORTAL_ROLES.includes(role));
  }

  /**
   * Check if user can access partner portal
   */
  canAccessPartnerPortal(userRoles: RoleId[]): boolean {
    // Admin roles can also access partner portal
    return userRoles.some(role => 
      PARTNER_PORTAL_ROLES.includes(role) || 
      ADMIN_PORTAL_ROLES.includes(role)
    );
  }

  /**
   * Check if user can access agent portal
   */
  canAccessAgentPortal(userRoles: RoleId[]): boolean {
    // Admin and partner roles can also access agent portal
    return userRoles.some(role => 
      AGENT_PORTAL_ROLES.includes(role) || 
      PARTNER_PORTAL_ROLES.includes(role) ||
      ADMIN_PORTAL_ROLES.includes(role)
    );
  }

  /**
   * Get the appropriate portal for a user
   */
  getPortalAccess(userRoles: RoleId[]): PortalAccessResult {
    // Check portals in priority order
    if (this.canAccessAdminPortal(userRoles)) {
      return { canAccess: true, portal: 'admin' };
    }
    
    if (this.canAccessPartnerPortal(userRoles)) {
      return { canAccess: true, portal: 'partner' };
    }
    
    if (this.canAccessAgentPortal(userRoles)) {
      return { canAccess: true, portal: 'agent' };
    }
    
    return { canAccess: true, portal: 'client' };
  }

  /**
   * Check if user has required role(s) for an action
   */
  checkRoleAccess(userRoles: RoleId[], requiredRoles: RoleId[]): RoleCheckResult {
    // Tester role is universal and bypasses all role checks
    if (userRoles.includes('tester')) {
      return { allowed: true, userRoles, reason: 'Tester role grants universal access' };
    }

    // Check if user has any of the required roles
    const hasRole = userRoles.some(role => requiredRoles.includes(role));
    
    if (hasRole) {
      return { allowed: true, userRoles };
    }
    
    // Check if user has a higher-level role that grants access
    for (const userRole of userRoles) {
      for (const requiredRole of requiredRoles) {
        if (hasAuthorityOver(userRole, requiredRole)) {
          return { allowed: true, userRoles, reason: `${getRoleDisplayName(userRole)} has authority over ${getRoleDisplayName(requiredRole)}` };
        }
      }
    }
    
    return {
      allowed: false,
      reason: 'Insufficient role privileges',
      requiredRoles,
      userRoles,
    };
  }

  /**
   * Check if user has required permission(s)
   */
  checkPermissionAccess(userRoles: RoleId[], requiredPermissions: string[], requireAll = false): RoleCheckResult {
    // Tester role is universal and bypasses all permission checks
    if (userRoles.includes('tester')) {
      return { allowed: true, userRoles, reason: 'Tester role grants universal permissions' };
    }

    const hasAccess = requireAll
      ? hasAllPermissions(userRoles, requiredPermissions)
      : hasAnyPermission(userRoles, requiredPermissions);
    
    if (hasAccess) {
      return { allowed: true, userRoles };
    }
    
    return {
      allowed: false,
      reason: `Missing required permission(s): ${requiredPermissions.join(', ')}`,
      userRoles,
    };
  }

  /**
   * Validate role assignment - can assigner assign the target role?
   */
  validateRoleAssignment(assignerRoles: RoleId[], targetRole: RoleId): RoleCheckResult {
    if (canAssignRole(assignerRoles, targetRole)) {
      return { allowed: true };
    }
    
    const manageable = getManageableRoles(assignerRoles);
    return {
      allowed: false,
      reason: `Cannot assign role ${getRoleDisplayName(targetRole)}. Assignable roles: ${manageable.map(getRoleDisplayName).join(', ')}`,
      userRoles: assignerRoles,
    };
  }

  /**
   * Get hierarchy chain for a role
   */
  getRoleHierarchy(role: RoleId): RoleId[] {
    const hierarchy: RoleId[] = [role];
    const def = ROLE_DEFINITIONS[role];
    
    if (def) {
      for (const parent of def.parentRoles) {
        hierarchy.push(...this.getRoleHierarchy(parent));
      }
    }
    
    return Array.from(new Set(hierarchy)); // Remove duplicates
  }

  /**
   * Get all subordinate roles for a given role
   */
  getSubordinateRoles(role: RoleId): RoleId[] {
    const subordinates: RoleId[] = [];
    
    for (const [roleId, def] of Object.entries(ROLE_DEFINITIONS)) {
      if (def.parentRoles.includes(role)) {
        subordinates.push(roleId as RoleId);
        subordinates.push(...this.getSubordinateRoles(roleId as RoleId));
      }
    }
    
    return Array.from(new Set(subordinates));
  }

  /**
   * Check if user needs compliance verification (ARN/EUIN etc)
   */
  needsComplianceVerification(userRoles: RoleId[]): boolean {
    return requiresCompliance(userRoles);
  }

  /**
   * Get effective permissions for user based on all their roles
   */
  getEffectivePermissions(userRoles: RoleId[]): string[] {
    return getAllPermissions(userRoles);
  }

  /**
   * Check if user is internal staff
   */
  isInternalStaff(userRoles: RoleId[]): boolean {
    return userRoles.some(role => ROLE_DEFINITIONS[role]?.isInternal);
  }

  /**
   * Check if user is in distribution network (partner/agent hierarchy)
   */
  isDistributionNetwork(userRoles: RoleId[]): boolean {
    const distributionRoles: RoleId[] = ['partner', 'partner_ops', 'agent', 'sub_agent', 'associate'];
    return userRoles.some(role => distributionRoles.includes(role));
  }

  /**
   * Get the highest level role for a user
   */
  getHighestRole(userRoles: RoleId[]): RoleId | null {
    if (!userRoles.length) return null;
    
    let highestRole: RoleId = userRoles[0];
    let lowestLevel = ROLE_DEFINITIONS[userRoles[0]]?.level ?? Infinity;
    
    for (const role of userRoles) {
      const level = ROLE_DEFINITIONS[role]?.level ?? Infinity;
      if (level < lowestLevel) {
        lowestLevel = level;
        highestRole = role;
      }
    }
    
    return highestRole;
  }

  /**
   * Normalize role array from various input formats
   */
  normalizeRoles(roles: string | string[] | null | undefined): RoleId[] {
    if (!roles) return ['user'];
    
    if (typeof roles === 'string') {
      return [roles as RoleId];
    }
    
    return roles.filter(r => r in ROLE_DEFINITIONS) as RoleId[];
  }

  /**
   * Check if a role ID is valid
   */
  isValidRole(role: string): role is RoleId {
    return role in ROLE_DEFINITIONS;
  }

  /**
   * Get role definition
   */
  getRoleDefinition(role: RoleId) {
    return ROLE_DEFINITIONS[role];
  }

  /**
   * Export role definitions for client-side use
   */
  getPublicRoleData() {
    const publicData: Record<string, { name: string; portal: string; level: number }> = {};
    
    for (const [roleId, def] of Object.entries(ROLE_DEFINITIONS)) {
      publicData[roleId] = {
        name: def.name,
        portal: def.portal,
        level: def.level,
      };
    }
    
    return publicData;
  }
}

// Export singleton instance
export const roleService = new RoleService();

// Export helper functions for direct use
export {
  hasAuthorityOver,
  isInHierarchyChain,
  getManageableRoles,
  getPortalForRole,
  getPrimaryPortal,
  hasAnyPermission,
  hasAllPermissions,
  getAllPermissions,
  requiresCompliance,
  canAssignRole,
  getRoleDisplayName,
};
