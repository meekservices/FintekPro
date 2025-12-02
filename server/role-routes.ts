import type { Express, Request, Response, NextFunction } from 'express';
import { roleService } from './services/roleService';
import { ROLE_DEFINITIONS, RoleId, ADMIN_PORTAL_ROLES, PARTNER_PORTAL_ROLES, AGENT_PORTAL_ROLES } from '@shared/roles';

type PortalType = 'admin' | 'partner' | 'agent' | 'client';

const requireAuth = (req: any, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  next();
};

const requireAnyRole = (allowedRoles: RoleId[]) => {
  return (req: any, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    
    const userRoles = roleService.normalizeRoles(req.user.role || req.user.roles);
    const check = roleService.checkRoleAccess(userRoles, allowedRoles);
    
    if (check.allowed) {
      return next();
    }
    
    return res.status(403).json({
      success: false,
      message: check.reason || 'Insufficient permissions',
      requiredRoles: allowedRoles
    });
  };
};

const requirePortalAccess = (portal: PortalType) => {
  return (req: any, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    
    const userRoles = roleService.normalizeRoles(req.user.role || req.user.roles);
    let canAccess = false;
    
    switch (portal) {
      case 'admin':
        canAccess = roleService.canAccessAdminPortal(userRoles);
        break;
      case 'partner':
        canAccess = roleService.canAccessPartnerPortal(userRoles);
        break;
      case 'agent':
        canAccess = roleService.canAccessAgentPortal(userRoles);
        break;
      case 'client':
        canAccess = true;
        break;
    }
    
    if (canAccess) {
      return next();
    }
    
    return res.status(403).json({
      success: false,
      message: `Access to ${portal} portal denied`,
      portal
    });
  };
};

export function registerRoleRoutes(app: Express) {
  
  app.get('/api/roles/hierarchy', async (req: Request, res: Response) => {
    try {
      res.json({
        success: true,
        roles: roleService.getPublicRoleData(),
        adminPortalRoles: ADMIN_PORTAL_ROLES,
        partnerPortalRoles: PARTNER_PORTAL_ROLES,
        agentPortalRoles: AGENT_PORTAL_ROLES
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch role hierarchy',
        error: error.message
      });
    }
  });

  app.get('/api/roles/current', requireAuth, async (req: any, res: Response) => {
    try {
      const userRoles = roleService.normalizeRoles(req.user?.role || req.user?.roles);
      const highestRole = roleService.getHighestRole(userRoles);
      const portalAccess = roleService.getPortalAccess(userRoles);
      const permissions = roleService.getEffectivePermissions(userRoles);
      
      res.json({
        success: true,
        roles: userRoles,
        highestRole,
        portalAccess,
        permissions,
        isInternal: roleService.isInternalStaff(userRoles),
        isDistribution: roleService.isDistributionNetwork(userRoles),
        needsCompliance: roleService.needsComplianceVerification(userRoles)
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch current user role',
        error: error.message
      });
    }
  });

  app.get('/api/roles/check/:role', requireAuth, async (req: any, res: Response) => {
    try {
      const targetRole = req.params.role as RoleId;
      
      if (!roleService.isValidRole(targetRole)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role specified'
        });
      }
      
      const userRoles = roleService.normalizeRoles(req.user?.role || req.user?.roles);
      const check = roleService.checkRoleAccess(userRoles, [targetRole]);
      
      res.json({
        success: true,
        hasRole: check.allowed,
        userRoles,
        targetRole
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to check role',
        error: error.message
      });
    }
  });

  app.get('/api/roles/can-access-portal/:portal', requireAuth, async (req: any, res: Response) => {
    try {
      const targetPortal = req.params.portal as PortalType;
      const userRoles = roleService.normalizeRoles(req.user?.role || req.user?.roles);
      
      let canAccess = false;
      switch (targetPortal) {
        case 'admin':
          canAccess = roleService.canAccessAdminPortal(userRoles);
          break;
        case 'partner':
          canAccess = roleService.canAccessPartnerPortal(userRoles);
          break;
        case 'agent':
          canAccess = roleService.canAccessAgentPortal(userRoles);
          break;
        case 'client':
          canAccess = true;
          break;
      }
      
      res.json({
        success: true,
        canAccess,
        userRoles,
        targetPortal,
        portalAccess: roleService.getPortalAccess(userRoles)
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to check portal access',
        error: error.message
      });
    }
  });

  app.get('/api/admin/roles/all', 
    requireAuth, 
    requireAnyRole(['superadmin', 'admin', 'master_agent']),
    async (req: Request, res: Response) => {
      try {
        const rolesWithInfo = Object.entries(ROLE_DEFINITIONS).map(([roleId, def]) => ({
          roleId,
          name: def.name,
          portal: def.portal,
          level: def.level,
          isInternal: def.isInternal,
          permissions: def.permissions,
          parentRoles: def.parentRoles
        }));
        
        res.json({
          success: true,
          roles: rolesWithInfo
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          message: 'Failed to fetch all roles',
          error: error.message
        });
      }
    }
  );

  app.get('/api/partner/dashboard',
    requireAuth,
    requirePortalAccess('partner'),
    async (req: any, res: Response) => {
      try {
        const userRoles = roleService.normalizeRoles(req.user?.role || req.user?.roles);
        
        res.json({
          success: true,
          portal: 'partner',
          user: {
            id: req.user?.id,
            roles: userRoles
          },
          message: 'Partner portal access granted'
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          message: 'Failed to access partner dashboard',
          error: error.message
        });
      }
    }
  );

  app.get('/api/agent/dashboard',
    requireAuth,
    requirePortalAccess('agent'),
    async (req: any, res: Response) => {
      try {
        const userRoles = roleService.normalizeRoles(req.user?.role || req.user?.roles);
        
        res.json({
          success: true,
          portal: 'agent',
          user: {
            id: req.user?.id,
            roles: userRoles
          },
          message: 'Agent portal access granted'
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          message: 'Failed to access agent dashboard',
          error: error.message
        });
      }
    }
  );

  app.get('/api/agent/profile', async (req: any, res: Response) => {
    try {
      if (!req.user && process.env.NODE_ENV !== 'development') {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }
      
      res.json({
        id: req.user?.id || 'demo-agent',
        fullName: req.user?.firstName ? `${req.user.firstName} ${req.user.lastName || ''}` : 'Demo Agent',
        email: req.user?.email || 'demo-agent@example.com',
        phone: req.user?.phone || '+91-9876543210',
        euinNumber: 'E123456',
        arnCode: 'ARN-12345',
        agentLevel: 'agent'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch agent profile',
        error: error.message
      });
    }
  });

  app.get('/api/agent/stats', async (req: any, res: Response) => {
    try {
      res.json({
        totalClients: 0,
        activeClients: 0,
        totalLeads: 0,
        convertedLeads: 0,
        totalAUM: 0,
        thisMonthBusiness: 0,
        lastMonthBusiness: 0,
        totalCommissions: 0,
        pendingCommissions: 0,
        targetProgress: 0,
        monthlyTarget: 500000
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch agent stats',
        error: error.message
      });
    }
  });

  app.get('/api/agent/clients', async (req: any, res: Response) => {
    try {
      res.json([]);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch agent clients',
        error: error.message
      });
    }
  });

  app.get('/api/agent/leads', async (req: any, res: Response) => {
    try {
      res.json([]);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch agent leads',
        error: error.message
      });
    }
  });

  app.get('/api/agent/tasks', async (req: any, res: Response) => {
    try {
      res.json([]);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch agent tasks',
        error: error.message
      });
    }
  });

  app.get('/api/partner/stats', async (req: any, res: Response) => {
    try {
      res.json({
        totalAgents: 0,
        activeAgents: 0,
        totalClients: 0,
        totalAUM: 0,
        thisMonthBusiness: 0,
        lastMonthBusiness: 0,
        totalCommissions: 0,
        pendingCommissions: 0,
        conversionRate: 0
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch partner stats',
        error: error.message
      });
    }
  });

  app.get('/api/partner/agents', async (req: any, res: Response) => {
    try {
      res.json([]);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch partner agents',
        error: error.message
      });
    }
  });

  app.get('/api/partner/teams', async (req: any, res: Response) => {
    try {
      res.json([]);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch partner teams',
        error: error.message
      });
    }
  });

  app.get('/api/partner/commissions', async (req: any, res: Response) => {
    try {
      res.json([]);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch partner commissions',
        error: error.message
      });
    }
  });

  console.log('✅ Role-based API routes registered');
}
