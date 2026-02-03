/**
 * Role-based Access Control Middleware for FintekPro
 * Provides Express middleware for enforcing role hierarchy and permissions
 */

import { Request, Response, NextFunction } from 'express';
import { roleService } from '../services/roleService';
import { RoleId, ROLE_DEFINITIONS, ADMIN_PORTAL_ROLES, PARTNER_PORTAL_ROLES, AGENT_PORTAL_ROLES } from '@shared/roles';

// Note: Express.User is already extended in auth.ts
// We use the existing User type that includes id, email, mobile, roles, role

// Define a type for users that may have legacy role field
interface UserWithRole {
  id: string;
  roles?: string[] | null;
  role?: string; // Legacy single role field from older code
}

/**
 * Normalize user roles from various formats
 */
function getUserRoles(user: UserWithRole | undefined): RoleId[] {
  if (!user) return [];
  
  // Support both old single role field and new roles array
  const roles = user.roles || (user.role ? [user.role] : ['user']);
  return (roles || ['user']).filter(r => r in ROLE_DEFINITIONS) as RoleId[];
}

/**
 * Middleware: Require authentication
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ 
      success: false,
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
  next();
}

/**
 * Middleware: Require specific role(s)
 * @param requiredRoles - Array of roles, user must have at least one
 * Supports both: requireRole('admin', 'agent') and requireRole(['admin', 'agent'])
 */
export function requireRole(...requiredRoles: (RoleId | RoleId[])[]) {
  // Flatten in case array was passed: requireRole(['admin', 'agent']) becomes [['admin', 'agent']]
  const flatRoles: RoleId[] = requiredRoles.flat() as RoleId[];
  
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const userRoles = getUserRoles(req.user);
    const result = roleService.checkRoleAccess(userRoles, flatRoles);

    if (!result.allowed) {
      return res.status(403).json({ 
        success: false,
        message: 'Insufficient privileges',
        code: 'FORBIDDEN',
        required: flatRoles,
        userRoles: userRoles
      });
    }

    next();
  };
}

/**
 * Middleware: Require specific permission(s)
 * @param permissions - Required permissions
 * @param requireAll - If true, user must have ALL permissions; if false, any one is sufficient
 */
export function requirePermission(permissions: string[], requireAll = false) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const userRoles = getUserRoles(req.user);
    const result = roleService.checkPermissionAccess(userRoles, permissions, requireAll);

    if (!result.allowed) {
      return res.status(403).json({ 
        success: false,
        message: result.reason || 'Missing required permissions',
        code: 'FORBIDDEN',
        required: permissions
      });
    }

    next();
  };
}

/**
 * Middleware: Require Admin Portal access
 * Allows: superadmin, master_agent, admin, department heads, team members
 */
export function requireAdminPortal(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ 
      success: false,
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  const userRoles = getUserRoles(req.user);
  
  if (!roleService.canAccessAdminPortal(userRoles)) {
    return res.status(403).json({ 
      success: false,
      message: 'Admin portal access required',
      code: 'ADMIN_ACCESS_REQUIRED',
      userRoles
    });
  }

  next();
}

/**
 * Middleware: Require Partner Portal access
 * Allows: partner, partner_ops (and all admin roles)
 */
export function requirePartnerPortal(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ 
      success: false,
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  const userRoles = getUserRoles(req.user);
  
  if (!roleService.canAccessPartnerPortal(userRoles)) {
    return res.status(403).json({ 
      success: false,
      message: 'Partner portal access required',
      code: 'PARTNER_ACCESS_REQUIRED',
      userRoles
    });
  }

  next();
}

/**
 * Middleware: Require Agent Portal access
 * Allows: agent, sub_agent, associate (and partner + admin roles)
 */
export function requireAgentPortal(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ 
      success: false,
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  const userRoles = getUserRoles(req.user);
  
  if (!roleService.canAccessAgentPortal(userRoles)) {
    return res.status(403).json({ 
      success: false,
      message: 'Agent portal access required',
      code: 'AGENT_ACCESS_REQUIRED',
      userRoles
    });
  }

  next();
}

/**
 * Middleware: Require Superadmin role only
 */
export function requireSuperadmin(req: Request, res: Response, next: NextFunction) {
  return requireRole('superadmin')(req, res, next);
}

/**
 * Middleware: Require Master Agent role
 */
export function requireMasterAgent(req: Request, res: Response, next: NextFunction) {
  return requireRole('superadmin', 'master_agent')(req, res, next);
}

/**
 * Middleware: Require Admin or higher role
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  return requireRole('superadmin', 'master_agent', 'admin')(req, res, next);
}

/**
 * Middleware: Require Compliance Officer role
 */
export function requireCompliance(req: Request, res: Response, next: NextFunction) {
  return requireRole('superadmin', 'master_agent', 'compliance_officer', 'compliance_team')(req, res, next);
}

/**
 * Middleware: Require Finance role
 */
export function requireFinance(req: Request, res: Response, next: NextFunction) {
  return requireRole('superadmin', 'admin', 'finance_head', 'finance_team')(req, res, next);
}

/**
 * Middleware: Require Operations role
 */
export function requireOperations(req: Request, res: Response, next: NextFunction) {
  return requireRole('superadmin', 'admin', 'ops_head', 'ops_team')(req, res, next);
}

/**
 * Middleware: Require HR role
 */
export function requireHR(req: Request, res: Response, next: NextFunction) {
  return requireRole('superadmin', 'admin', 'hr_head', 'hr_team')(req, res, next);
}

/**
 * Middleware: Require Technology role
 */
export function requireTech(req: Request, res: Response, next: NextFunction) {
  return requireRole('superadmin', 'admin', 'tech_head', 'tech_backend', 'tech_frontend', 'tech_devops')(req, res, next);
}

/**
 * Middleware: Require Business Development role
 */
export function requireBD(req: Request, res: Response, next: NextFunction) {
  return requireRole('superadmin', 'admin', 'bd_head', 'bd_team')(req, res, next);
}

/**
 * Middleware: Require Partner or higher role
 */
export function requirePartner(req: Request, res: Response, next: NextFunction) {
  return requireRole('superadmin', 'master_agent', 'admin', 'bd_head', 'partner')(req, res, next);
}

/**
 * Middleware: Require Agent or higher role (includes partner, admin hierarchy)
 */
export function requireAgent(req: Request, res: Response, next: NextFunction) {
  return requireRole('superadmin', 'master_agent', 'admin', 'partner', 'agent', 'sub_agent')(req, res, next);
}

/**
 * Middleware: Require Client role (includes all distribution and admin roles)
 */
export function requireClient(req: Request, res: Response, next: NextFunction) {
  return requireRole(
    'superadmin', 'master_agent', 'admin',
    'partner', 'agent', 'sub_agent', 'associate',
    'client', 'business_client', 'user'
  )(req, res, next);
}

/**
 * Middleware: Require internal staff (FintekPro employees)
 */
export function requireInternalStaff(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ 
      success: false,
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  const userRoles = getUserRoles(req.user);
  
  if (!roleService.isInternalStaff(userRoles)) {
    return res.status(403).json({ 
      success: false,
      message: 'Internal staff access required',
      code: 'INTERNAL_ACCESS_REQUIRED',
      userRoles
    });
  }

  next();
}

/**
 * Middleware: Require compliance verification (ARN/EUIN etc)
 * Used for roles that need regulatory compliance
 */
export function requireComplianceVerified(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ 
      success: false,
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  const userRoles = getUserRoles(req.user);
  
  // Check if any role requires compliance
  if (roleService.needsComplianceVerification(userRoles)) {
    // TODO: Check if user has verified compliance credentials (ARN, EUIN, etc.)
    // For now, pass through - this would check against partner/agent records
  }

  next();
}

/**
 * Middleware: Inject user role info into request for use in handlers
 */
export function injectRoleInfo(req: Request, res: Response, next: NextFunction) {
  if (req.user) {
    const userRoles = getUserRoles(req.user);
    const portalAccess = roleService.getPortalAccess(userRoles);
    const permissions = roleService.getEffectivePermissions(userRoles);
    const highestRole = roleService.getHighestRole(userRoles);

    // Attach role info to request for use in handlers
    (req as any).roleInfo = {
      roles: userRoles,
      portal: portalAccess.portal,
      permissions,
      highestRole,
      isInternal: roleService.isInternalStaff(userRoles),
      isDistribution: roleService.isDistributionNetwork(userRoles),
    };
  }

  next();
}

/**
 * Helper: Get role info from request (after injectRoleInfo middleware)
 */
export function getRoleInfo(req: Request): {
  roles: RoleId[];
  portal: 'admin' | 'partner' | 'agent' | 'client';
  permissions: string[];
  highestRole: RoleId | null;
  isInternal: boolean;
  isDistribution: boolean;
} | null {
  return (req as any).roleInfo || null;
}

/**
 * Create a custom role check middleware
 */
export function createRoleCheck(checkFn: (roles: RoleId[]) => boolean, errorMessage = 'Access denied') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const userRoles = getUserRoles(req.user);
    
    if (!checkFn(userRoles)) {
      return res.status(403).json({ 
        success: false,
        message: errorMessage,
        code: 'FORBIDDEN',
        userRoles
      });
    }

    next();
  };
}
