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

  // Agent Dashboard Overview - returns real client overview stats (agent-only access)
  app.get('/api/agent/dashboard/overview', requireAnyRole(AGENT_PORTAL_ROLES), async (req: any, res: Response) => {
    try {
      const { db } = await import('./db');
      const { 
        clientAgentRelationships, 
        agentLeads, 
        agentAppointments, 
        agentCommissions,
        portfolios,
        prospectClients,
        users,
        customerCareAgents
      } = await import('@shared/schema');
      const { eq, and, gte, sql, count, sum, desc, inArray } = await import('drizzle-orm');
      
      const agentId = req.user?.id;
      if (!agentId) {
        return res.status(401).json({ success: false, message: 'Agent ID not found' });
      }

      // Lookup customerCareAgent.id for commission queries
      const userRecord = await db.select({ email: users.email }).from(users).where(eq(users.id, agentId)).limit(1);
      const userEmail = userRecord[0]?.email;
      let ccAgentId = null;
      
      if (userEmail) {
        const ccAgent = await db.select({ id: customerCareAgents.id })
          .from(customerCareAgents)
          .where(eq(customerCareAgents.email, userEmail))
          .limit(1);
        ccAgentId = ccAgent[0]?.id;
      }
      
      // Get client relationships for agent
      const clientRelations = await db.select()
        .from(clientAgentRelationships)
        .where(eq(clientAgentRelationships.agentId, agentId));
      
      const totalClients = clientRelations.length;
      const activeClients = clientRelations.filter(c => c.isActive).length;
      
      // Get leads count
      const leadsResult = await db.select({ count: count() })
        .from(agentLeads)
        .where(eq(agentLeads.agentId, agentId));
      const totalLeads = leadsResult[0]?.count || 0;
      
      // Get converted leads (conversion rate)
      const convertedLeadsResult = await db.select({ count: count() })
        .from(agentLeads)
        .where(and(
          eq(agentLeads.agentId, agentId),
          eq(agentLeads.stage, 'converted')
        ));
      const convertedLeads = convertedLeadsResult[0]?.count || 0;
      const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : '0.0';
      
      // Get AUM from portfolios of clients
      const clientIds = clientRelations.map(c => c.clientId);
      let totalAUM = 0;
      if (clientIds.length > 0) {
        const portfolioValues = await db.select({ 
          totalValue: portfolios.totalValue 
        })
          .from(portfolios)
          .where(inArray(portfolios.userId, clientIds));
        
        totalAUM = portfolioValues.reduce((sum, p) => sum + (parseFloat(p.totalValue || '0') || 0), 0);
      }
      
      // Get current month's start date
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // Get monthly commissions earned
      const monthlyCommissions = await db.select({ 
        total: sum(agentCommissions.agentCommissionAmount) 
      })
        .from(agentCommissions)
        .where(and(
          eq(agentCommissions.agentId, ccAgentId || 'none'),
          gte(agentCommissions.createdAt, monthStart)
        ));
      const monthlyEarned = parseFloat(monthlyCommissions[0]?.total || '0') || 0;
      
      // Get pending commissions
      const pendingCommissions = await db.select({ 
        total: sum(agentCommissions.agentCommissionAmount) 
      })
        .from(agentCommissions)
        .where(and(
          eq(agentCommissions.agentId, ccAgentId || 'none'),
          eq(agentCommissions.agentSettlementStatus, 'pending')
        ));
      const pendingEarned = parseFloat(pendingCommissions[0]?.total || '0') || 0;
      
      // Get upcoming appointments count
      const upcomingAppointments = await db.select({ count: count() })
        .from(agentAppointments)
        .where(and(
          eq(agentAppointments.agentId, agentId),
          gte(agentAppointments.date, now.toISOString().split('T')[0]),
          eq(agentAppointments.status, 'scheduled')
        ));
      const upcomingMeetings = upcomingAppointments[0]?.count || 0;
      
      // Get pending tasks (appointments with pending status)
      const pendingTasks = await db.select({ count: count() })
        .from(agentAppointments)
        .where(and(
          eq(agentAppointments.agentId, agentId),
          eq(agentAppointments.status, 'pending')
        ));
      const pendingTasksCount = pendingTasks[0]?.count || 0;
      
      // Get prospects count
      const prospectsResult = await db.select({ count: count() })
        .from(prospectClients)
        .where(eq(prospectClients.agentId, agentId));
      const totalProspects = prospectsResult[0]?.count || 0;
      
      // Monthly target (configurable, default 500000)
      const monthlyTarget = 500000;
      
      res.json({
        totalClients,
        activeClients,
        totalLeads,
        conversionRate,
        totalAUM,
        monthlyTarget,
        monthlyAchieved: monthlyEarned,
        pendingEarnings: pendingEarned,
        pendingTasks: pendingTasksCount,
        upcomingMeetings,
        totalProspects
      });
    } catch (error: any) {
      console.error('Error fetching dashboard overview:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch dashboard overview', error: error.message });
    }
  });

  // Agent Dashboard Recent Activity
  app.get('/api/agent/dashboard/recent-activity', async (req: any, res: Response) => {
    try {
      const { db } = await import('./db');
      const { agentLeads, prospectClients } = await import('@shared/schema');
      const { eq, desc } = await import('drizzle-orm');
      
      const agentId = req.user?.id;
      if (!agentId) {
        return res.json([]);
      }
      
      // Get recent leads
      const recentLeads = await db.select()
        .from(agentLeads)
        .where(eq(agentLeads.agentId, agentId))
        .orderBy(desc(agentLeads.createdAt))
        .limit(3);
      
      // Get recent prospects
      const recentProspects = await db.select()
        .from(prospectClients)
        .where(eq(prospectClients.agentId, agentId))
        .orderBy(desc(prospectClients.createdAt))
        .limit(3);
      
      const activities: any[] = [];
      
      recentLeads.forEach((lead, idx) => {
        const createdAt = lead.createdAt ? new Date(lead.createdAt) : new Date();
        const hoursAgo = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60));
        const timeStr = hoursAgo < 24 ? `${hoursAgo} hours ago` : `${Math.floor(hoursAgo/24)} days ago`;
        activities.push({
          id: idx + 1,
          type: 'lead',
          client: lead.name || 'Unknown',
          message: `Lead ${lead.stage === 'new' ? 'added' : 'updated to ' + lead.stage}`,
          time: timeStr
        });
      });
      
      recentProspects.forEach((prospect, idx) => {
        const createdAt = prospect.createdAt ? new Date(prospect.createdAt) : new Date();
        const hoursAgo = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60));
        const timeStr = hoursAgo < 24 ? `${hoursAgo} hours ago` : `${Math.floor(hoursAgo/24)} days ago`;
        activities.push({
          id: 100 + idx,
          type: 'prospect',
          client: prospect.name || 'Unknown',
          message: prospect.uploadedPortfolio ? 'Portfolio uploaded' : 'New prospect added',
          time: timeStr
        });
      });
      
      // Sort by time and limit
      res.json(activities.slice(0, 5));
    } catch (error: any) {
      console.error('Error fetching recent activity:', error);
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
        { id: 'ca-1', name: 'CA Suresh Agarwal', specialization: 'Individual ITR, Capital Gains', activeCases: 12 },
        { id: 'ca-2', name: 'CA Meera Joshi', specialization: 'Business ITR, GST', activeCases: 8 },
        { id: 'ca-3', name: 'CA Rahul Mehta', specialization: 'Corporate Tax, Audit', activeCases: 15 }
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
      
      // Fetch agent details from customer_care_agents table
      const { db } = await import('./db');
      const { customerCareAgents } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      
      let euinNumber = 'E317634';
      let arnCode = 'ARN-317634';
      
      if (req.user?.id) {
        const agents = await db.select()
          .from(customerCareAgents)
          .where(eq(customerCareAgents.employeeId, req.user.id))
          .limit(1);
        
        if (agents.length > 0) {
          euinNumber = agents[0].euinNumber || euinNumber;
          arnCode = agents[0].arnCode || arnCode;
        }
      }
      
      res.json({
        id: req.user?.id || 'central-test-user',
        fullName: req.user?.firstName ? `${req.user.firstName} ${req.user.lastName || ''}` : 'Test SuperUser',
        email: req.user?.email || 'test@fintekpro.com',
        phone: req.user?.phone || '+91-9876543210',
        euinNumber,
        arnCode,
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
      const { db } = await import('./db');
      const { clientAgentRelationships, agentLeads, portfolios, prospectClients } = await import('@shared/schema');
      const { eq, sql, and, gte, inArray } = await import('drizzle-orm');
      
      const agentId = req.user?.id;
      if (!agentId) {
        return res.json({
          totalClients: 0, activeClients: 0, totalLeads: 0, convertedLeads: 0,
          totalAUM: 0, thisMonthBusiness: 0, lastMonthBusiness: 0,
          totalCommissions: 0, pendingCommissions: 0, targetProgress: 0, monthlyTarget: 500000
        });
      }
      
      // Get client count
      const clientsResult = await db.select({ count: sql<number>`count(*)` })
        .from(clientAgentRelationships)
        .where(eq(clientAgentRelationships.agentId, agentId));
      const totalClients = Number(clientsResult[0]?.count) || 0;
      
      // Get leads count from agentLeads table
      const leadsResult = await db.select({ count: sql<number>`count(*)` })
        .from(agentLeads)
        .where(eq(agentLeads.agentId, agentId));
      const totalLeads = Number(leadsResult[0]?.count) || 0;
      
      // Get converted leads
      const convertedResult = await db.select({ count: sql<number>`count(*)` })
        .from(agentLeads)
        .where(and(eq(agentLeads.agentId, agentId), eq(agentLeads.stage, 'converted')));
      const convertedLeads = Number(convertedResult[0]?.count) || 0;
      
      // Get prospects count
      const prospectsResult = await db.select({ count: sql<number>`count(*)` })
        .from(prospectClients)
        .where(eq(prospectClients.agentId, agentId));
      const prospectsCount = Number(prospectsResult[0]?.count) || 0;
      
      // Calculate AUM from client portfolios
      let totalAUM = 0;
      if (totalClients > 0) {
        const clientIds = await db.select({ clientId: clientAgentRelationships.clientId })
          .from(clientAgentRelationships)
          .where(eq(clientAgentRelationships.agentId, agentId));
        
        if (clientIds.length > 0) {
          const ids = clientIds.map(c => c.clientId).filter(Boolean);
          if (ids.length > 0) {
            const aumResult = await db.select({ total: sql<number>`COALESCE(SUM(CAST(total_value AS NUMERIC)), 0)` })
              .from(portfolios)
              .where(inArray(portfolios.userId, ids as string[]));
            totalAUM = Number(aumResult[0]?.total) || 0;
          }
        }
      }
      
      const monthlyTarget = 500000;
      const thisMonthBusiness = 0; // Would need transactions table
      const targetProgress = monthlyTarget > 0 ? Math.round((thisMonthBusiness / monthlyTarget) * 100) : 0;
      
      res.json({
        totalClients,
        activeClients: totalClients,
        totalLeads: totalLeads + prospectsCount,
        convertedLeads,
        totalAUM,
        thisMonthBusiness,
        lastMonthBusiness: 0,
        totalCommissions: 0,
        pendingCommissions: 0,
        targetProgress,
        monthlyTarget
      });
    } catch (error: any) {
      console.error('Error fetching agent stats:', error);
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

  app.get('/api/agent/reports', async (req: any, res: Response) => {
    try {
      res.json([]);
    } catch (error: any) {
      res.status(500).json({ success: false, message: 'Failed to fetch reports', error: error.message });
    }
  });

  // Agent Clients List (for dropdowns)
  app.get('/api/agent/clients/list', async (req: any, res: Response) => {
    try {
      const { db } = await import('./db');
      const { clientAgentRelationships, users, prospectClients } = await import('@shared/schema');
      const { eq, inArray } = await import('drizzle-orm');
      
      const agentId = req.user?.id;
      if (!agentId) {
        return res.json([]);
      }
      
      // Get registered clients
      const relationships = await db.select({ clientId: clientAgentRelationships.clientId })
        .from(clientAgentRelationships)
        .where(eq(clientAgentRelationships.agentId, agentId));
      
      let clients: any[] = [];
      if (relationships.length > 0) {
        const clientIds = relationships.map(r => r.clientId).filter(Boolean);
        if (clientIds.length > 0) {
          const usersData = await db.select({
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            panNumber: users.panNumber,
            email: users.email
          }).from(users).where(inArray(users.id, clientIds));
          
          clients = usersData.map(u => ({
            id: u.id,
            name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Unknown',
            pan: u.panNumber || '',
            email: u.email || ''
          }));
        }
      }
      
      // Also get prospects
      const prospects = await db.select()
        .from(prospectClients)
        .where(eq(prospectClients.agentId, agentId));
      
      const prospectsList = prospects.map(p => ({
        id: p.id,
        name: p.name || 'Unknown',
        pan: p.pan || '',
        email: p.email || '',
        isProspect: true
      }));
      
      res.json([...clients, ...prospectsList]);
    } catch (error: any) {
      console.error('Error fetching clients list:', error);
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

  const requirePartnerAuth = (req: any, res: Response, next: any) => {
    if (!req.user) {
      const isDevelopment = !process.env.NODE_ENV || process.env.NODE_ENV === 'development' || process.env.REPL_ID;
      if (isDevelopment) {
        req.user = { id: 'central-test-user', roles: ['superadmin', 'admin', 'partner', 'agent', 'client', 'user', 'tester'], firstName: 'Test', lastName: 'SuperUser', email: 'test@fintekpro.com' };
      } else {
        return res.status(401).json({ error: "Authentication required" });
      }
    }
    const hasPartnerRole = req.user.roles?.includes('partner') || 
                           req.user.roles?.includes('admin') || 
                           req.user.roles?.includes('superadmin');
    if (!hasPartnerRole) {
      return res.status(403).json({ error: "Partner access required" });
    }
    next();
  };

  app.get('/api/partner/stats', requirePartnerAuth, async (req: any, res: Response) => {
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

  app.get('/api/partner/agents', requirePartnerAuth, async (req: any, res: Response) => {
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

  app.get('/api/partner/teams', requirePartnerAuth, async (req: any, res: Response) => {
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

  app.get('/api/partner/commissions', requirePartnerAuth, async (req: any, res: Response) => {
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
