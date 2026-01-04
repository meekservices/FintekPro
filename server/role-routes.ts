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

  // Agent Dashboard Overview - returns client overview stats
  app.get('/api/agent/dashboard/overview', async (req: any, res: Response) => {
    try {
      res.json({
        totalClients: 156,
        activeClients: 142,
        pendingKYC: 8,
        completedKYC: 134,
        totalAUM: 45600000,
        monthlyTarget: 5000000,
        monthlyAchieved: 3200000,
        pendingTasks: 12,
        upcomingMeetings: 5
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: 'Failed to fetch dashboard overview', error: error.message });
    }
  });

  // Agent Dashboard Recent Activity
  app.get('/api/agent/dashboard/recent-activity', async (req: any, res: Response) => {
    try {
      res.json([
        { id: 1, type: 'kyc', client: 'Rajesh Kumar', message: 'KYC verification completed', time: '2 hours ago' },
        { id: 2, type: 'investment', client: 'Priya Sharma', message: 'New SIP registered - ₹10,000/month', time: '4 hours ago' },
        { id: 3, type: 'meeting', client: 'Amit Patel', message: 'Meeting scheduled for portfolio review', time: '6 hours ago' },
        { id: 4, type: 'proposal', client: 'Sunita Verma', message: 'Investment proposal approved', time: '1 day ago' },
        { id: 5, type: 'document', client: 'Vikram Singh', message: 'Documents uploaded for ITR filing', time: '2 days ago' }
      ]);
    } catch (error: any) {
      res.status(500).json({ success: false, message: 'Failed to fetch recent activity', error: error.message });
    }
  });

  // Agent ITR Cases
  app.get('/api/agent/itr-cases', async (req: any, res: Response) => {
    try {
      res.json([
        { id: '1', clientName: 'Rajesh Kumar', pan: 'ABCPK1234L', status: 'in_progress', filingType: 'ITR-1', assessmentYear: '2025-26', dueDate: '2025-07-31' },
        { id: '2', clientName: 'Priya Sharma', pan: 'DEFPS5678M', status: 'pending_documents', filingType: 'ITR-2', assessmentYear: '2025-26', dueDate: '2025-07-31' },
        { id: '3', clientName: 'Amit Patel', pan: 'GHIAP9012N', status: 'filed', filingType: 'ITR-1', assessmentYear: '2024-25', filedDate: '2024-07-15' }
      ]);
    } catch (error: any) {
      res.status(500).json({ success: false, message: 'Failed to fetch ITR cases', error: error.message });
    }
  });

  // Agent CA List
  app.get('/api/agent/ca-list', async (req: any, res: Response) => {
    try {
      res.json([
        { id: 'ca-1', name: 'CA Suresh Agarwal', specialization: 'Individual ITR, Capital Gains', activeCase: 12 },
        { id: 'ca-2', name: 'CA Meera Joshi', specialization: 'Business ITR, GST', activeCase: 8 },
        { id: 'ca-3', name: 'CA Rahul Mehta', specialization: 'Corporate Tax, Audit', activeCase: 15 }
      ]);
    } catch (error: any) {
      res.status(500).json({ success: false, message: 'Failed to fetch CA list', error: error.message });
    }
  });

  // Agent TDS Summary
  app.get('/api/agent/tds-summary', async (req: any, res: Response) => {
    try {
      res.json([
        { clientName: 'Rajesh Kumar', pan: 'ABCPK1234L', totalTds: 125000, claimedTds: 120000, pendingTds: 5000 },
        { clientName: 'Priya Sharma', pan: 'DEFPS5678M', totalTds: 85000, claimedTds: 85000, pendingTds: 0 },
        { clientName: 'Amit Patel', pan: 'GHIAP9012N', totalTds: 210000, claimedTds: 195000, pendingTds: 15000 }
      ]);
    } catch (error: any) {
      res.status(500).json({ success: false, message: 'Failed to fetch TDS summary', error: error.message });
    }
  });

  // Agent Training Quiz Questions
  app.get('/api/agent/training/quiz-questions', async (req: any, res: Response) => {
    try {
      const { playbook } = req.query;
      res.json([
        { id: '1', question: 'What is the maximum investment limit in ELSS per year for tax benefit?', options: ['₹1 Lakh', '₹1.5 Lakh', '₹2 Lakh', '₹2.5 Lakh'], correctAnswer: 1 },
        { id: '2', question: 'What is the lock-in period for ELSS mutual funds?', options: ['1 year', '2 years', '3 years', '5 years'], correctAnswer: 2 },
        { id: '3', question: 'Which section covers tax deduction for home loan principal repayment?', options: ['Section 80C', 'Section 80D', 'Section 24', 'Section 80E'], correctAnswer: 0 }
      ]);
    } catch (error: any) {
      res.status(500).json({ success: false, message: 'Failed to fetch quiz questions', error: error.message });
    }
  });

  // Agent ITR Stats
  app.get('/api/agent/itr/stats', async (req: any, res: Response) => {
    try {
      res.json({
        totalCases: 45,
        filed: 32,
        inProgress: 8,
        pendingDocuments: 5,
        avgFilingTime: 3.5,
        successRate: 98.5
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: 'Failed to fetch ITR stats', error: error.message });
    }
  });

  // Agent ITR Cases
  app.get('/api/agent/itr/cases', async (req: any, res: Response) => {
    try {
      res.json([
        { id: '1', clientName: 'Rajesh Kumar', pan: 'ABCPK1234L', status: 'in_progress', filingType: 'ITR-1', assessmentYear: '2025-26', dueDate: '2025-07-31', assignedCA: 'CA Suresh Agarwal' },
        { id: '2', clientName: 'Priya Sharma', pan: 'DEFPS5678M', status: 'pending_documents', filingType: 'ITR-2', assessmentYear: '2025-26', dueDate: '2025-07-31' },
        { id: '3', clientName: 'Amit Patel', pan: 'GHIAP9012N', status: 'filed', filingType: 'ITR-1', assessmentYear: '2024-25', filedDate: '2024-07-15', acknowledgementNo: 'ACK123456' }
      ]);
    } catch (error: any) {
      res.status(500).json({ success: false, message: 'Failed to fetch ITR cases', error: error.message });
    }
  });

  // Agent Available CAs
  app.get('/api/agent/itr/available-cas', async (req: any, res: Response) => {
    try {
      res.json([
        { id: 'ca-1', name: 'CA Suresh Agarwal', specialization: 'Individual ITR, Capital Gains', activeCases: 12, rating: 4.8, available: true },
        { id: 'ca-2', name: 'CA Meera Joshi', specialization: 'Business ITR, GST', activeCases: 8, rating: 4.9, available: true },
        { id: 'ca-3', name: 'CA Rahul Mehta', specialization: 'Corporate Tax, Audit', activeCases: 15, rating: 4.7, available: false }
      ]);
    } catch (error: any) {
      res.status(500).json({ success: false, message: 'Failed to fetch available CAs', error: error.message });
    }
  });

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

  // Agent Reports List
  app.get('/api/agent/reports', async (req: any, res: Response) => {
    try {
      res.json([
        { id: '1', name: 'Monthly Portfolio Report', type: 'portfolio', clientName: 'Rajesh Kumar', generatedAt: new Date().toISOString(), status: 'ready' },
        { id: '2', name: 'Capital Gains Statement', type: 'tax', clientName: 'Priya Sharma', generatedAt: new Date().toISOString(), status: 'ready' },
        { id: '3', name: 'Investment Summary Q4', type: 'summary', clientName: 'Amit Patel', generatedAt: new Date().toISOString(), status: 'processing' }
      ]);
    } catch (error: any) {
      res.status(500).json({ success: false, message: 'Failed to fetch reports', error: error.message });
    }
  });

  // Agent Clients List (for dropdowns)
  app.get('/api/agent/clients/list', async (req: any, res: Response) => {
    try {
      res.json([
        { id: '1', name: 'Rajesh Kumar', pan: 'ABCPK1234L', email: 'rajesh@example.com' },
        { id: '2', name: 'Priya Sharma', pan: 'DEFPS5678M', email: 'priya@example.com' },
        { id: '3', name: 'Amit Patel', pan: 'GHIAP9012N', email: 'amit@example.com' },
        { id: '4', name: 'Sunita Verma', pan: 'JKLSV3456O', email: 'sunita@example.com' }
      ]);
    } catch (error: any) {
      res.status(500).json({ success: false, message: 'Failed to fetch clients list', error: error.message });
    }
  });

  // Agent Earnings
  app.get('/api/agent/earnings', async (req: any, res: Response) => {
    try {
      const { period = 'monthly' } = req.query;
      res.json({
        totalEarnings: 125000,
        pendingPayouts: 35000,
        lastPayout: 90000,
        lastPayoutDate: '2025-12-15',
        breakdown: [
          { category: 'Mutual Funds', amount: 75000, percentage: 60 },
          { category: 'Insurance', amount: 30000, percentage: 24 },
          { category: 'Bonds', amount: 15000, percentage: 12 },
          { category: 'Other', amount: 5000, percentage: 4 }
        ],
        monthlyTrend: [
          { month: 'Oct', amount: 95000 },
          { month: 'Nov', amount: 110000 },
          { month: 'Dec', amount: 125000 }
        ]
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: 'Failed to fetch earnings', error: error.message });
    }
  });

  // Agent Payout Requests
  app.get('/api/agent/payout-requests', async (req: any, res: Response) => {
    try {
      res.json([
        { id: '1', amount: 50000, status: 'approved', requestedAt: '2025-12-20', processedAt: '2025-12-22', bankAccount: '****1234' },
        { id: '2', amount: 35000, status: 'pending', requestedAt: '2025-12-28', bankAccount: '****1234' },
        { id: '3', amount: 45000, status: 'completed', requestedAt: '2025-11-25', processedAt: '2025-11-27', bankAccount: '****1234' }
      ]);
    } catch (error: any) {
      res.status(500).json({ success: false, message: 'Failed to fetch payout requests', error: error.message });
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
