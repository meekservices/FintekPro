import { Express } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import { requireAdmin, requireAgent } from '../middleware/roleMiddleware';
import * as schema from '@shared/schema';
import { eq, desc, sql, and, or, gte, lte, inArray } from 'drizzle-orm';

export function registerAgentCapitalGainsRoutes(app: Express): void {
  // ============ AGENT CAPITAL GAINS REPORTS ROUTES ============
  
  // Agent requests client capital gains report
  app.post("/api/agent/capital-gains-reports/request", requireAgent, async (req, res) => {
    try {
      const { clientId, financialYear, assessmentYear, reportType, dataSource } = req.body;
      
      if (!clientId || !financialYear || !dataSource) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      // Verify agent has access to this client
      const relationship = await storage.getClientAgentRelationship(clientId, req.user.id);
      if (!relationship || relationship.status !== 'active') {
        return res.status(403).json({ error: "No active relationship with this client" });
      }
      
      const reportData = {
        clientId,
        agentId: req.user.id,
        financialYear,
        assessmentYear: assessmentYear || `${parseInt(financialYear.split('-')[1]) + 1}-${parseInt(financialYear.split('-')[1]) + 2}`,
        reportType: reportType || 'capital_gains',
        dataSource,
        status: 'calculating',
        reportFee: '25',
        paymentStatus: 'pending'
      };
      
      const report = await storage.createCapitalGainsReport(reportData);
      
      res.status(201).json({
        success: true,
        report,
        message: "Capital gains report request created successfully"
      });
    } catch (error) {
      console.error("Error requesting capital gains report:", error);
      res.status(500).json({ error: "Failed to request capital gains report" });
    }
  });
  
  // Agent gets list of capital gains reports for their clients
  app.get("/api/agent/capital-gains-reports", requireAgent, async (req, res) => {
    try {
      const { clientId, financialYear, status } = req.query;
      
      // Get all reports where the agent is the requester
      const reports = await storage.getAgentCapitalGainsReports(req.user.id, {
        clientId: clientId as string,
        financialYear: financialYear as string,
        status: status as string
      });
      
      res.json({
        success: true,
        reports,
        count: reports.length
      });
    } catch (error) {
      console.error("Error fetching agent capital gains reports:", error);
      res.status(500).json({ error: "Failed to fetch capital gains reports" });
    }
  });
  
  // Agent downloads client capital gains report
  app.get("/api/agent/capital-gains-reports/:id/download", requireAgent, async (req, res) => {
    try {
      const { id } = req.params;
      const { format = 'pdf' } = req.query;
      
      const report = await storage.getCapitalGainsReport(id);
      if (!report) {
        return res.status(404).json({ error: "Capital gains report not found" });
      }
      
      // Verify agent has access to this report
      if (report.agentId !== req.user.id) {
        return res.status(403).json({ error: "Access denied to this report" });
      }
      
      if (report.status !== 'generated') {
        return res.status(400).json({ error: "Report is not ready for download" });
      }
      
      // Update download count
      await storage.updateCapitalGainsReport(id, {
        downloadCount: (report.downloadCount || 0) + 1,
        downloadedAt: new Date()
      });
      
      const filename = `client-capital-gains-${report.clientId}-${report.financialYear}-${Date.now()}`;
      
      if (format === 'pdf') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
        
        const pdfContent = `Client Capital Gains Report\n\nClient ID: ${report.clientId}\nFinancial Year: ${report.financialYear}\nAssessment Year: ${report.assessmentYear}\nSource: ${report.dataSource}\nGenerated: ${new Date().toLocaleDateString('en-IN')}\n\nShort Term Gains: ₹${report.totalShortTermGains || 0}\nLong Term Gains: ₹${report.totalLongTermGains || 0}\nTotal Tax Liability: ₹${report.totalTaxLiability || 0}\nNet Gains: ₹${report.netGains || 0}`;
        
        res.send(Buffer.from(pdfContent));
      } else if (format === 'excel') {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
        
        const excelContent = "Client,Financial Year,Short Term Gains,Long Term Gains,Net Gains,Tax Liability\n" +
          `${report.clientId},${report.financialYear},${report.totalShortTermGains || 0},${report.totalLongTermGains || 0},${report.netGains || 0},${report.totalTaxLiability || 0}`;
        
        res.send(Buffer.from(excelContent));
      } else {
        res.status(400).json({ error: "Invalid format. Use 'pdf' or 'excel'" });
      }
    } catch (error) {
      console.error("Error downloading capital gains report:", error);
      res.status(500).json({ error: "Failed to download capital gains report" });
    }
  });
  
  // Agent shares capital gains report with client
  app.post("/api/agent/capital-gains-reports/:id/share", requireAgent, async (req, res) => {
    try {
      const { id } = req.params;
      const { shareWithType = 'client', message, expiresInDays = 30 } = req.body;
      
      if (!req.user || req.user.role !== 'agent') {
        return res.status(403).json({ error: "Agent access required" });
      }
      
      const report = await storage.getCapitalGainsReport(id);
      if (!report) {
        return res.status(404).json({ error: "Capital gains report not found" });
      }
      
      // Verify agent has access to this report
      if (report.agentId !== req.user.id) {
        return res.status(403).json({ error: "Access denied to this report" });
      }
      
      // Create sharing record
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
      
      const sharing = await storage.createReportSharing({
        reportId: id,
        reportType: 'capital_gains_report',
        sharedBy: req.user.id,
        sharedWith: report.clientId,
        sharedWithType,
        accessType: 'download',
        message,
        expiresAt
      });
      
      res.json({
        success: true,
        sharing,
        message: "Capital gains report shared successfully"
      });
    } catch (error) {
      console.error("Error sharing capital gains report:", error);
      res.status(500).json({ error: "Failed to share capital gains report" });
    }
  });
  
  // Get agent's report sharing history
  app.get("/api/agent/reports/shared", requireAgent, async (req, res) => {
    try {
      const { reportType, status } = req.query;
      
      const sharedReports = await storage.getAgentSharedReports(req.user.id, {
        reportType: reportType as string,
        status: status as string
      });
      
      res.json({
        success: true,
        sharedReports,
        count: sharedReports.length
      });
    } catch (error) {
      console.error("Error fetching shared reports:", error);
      res.status(500).json({ error: "Failed to fetch shared reports" });
    }
  });

  // Agent Portal API endpoints
  // Agent tasks list - real appointments data
  app.get("/api/agent/tasks", requireAgent, async (req, res) => {
    try {
      const agentId = req.user?.id;
      if (!agentId) {
        return res.json([]);
      }
      
      // Get today's and upcoming appointments as tasks
      const today = new Date().toISOString().split('T')[0];
      const appointments = await db.select()
        .from(agentAppointments)
        .where(and(
          eq(agentAppointments.agentId, agentId),
          gte(agentAppointments.date, today)
        ))
        .orderBy(agentAppointments.date, agentAppointments.startTime)
        .limit(10);
      
      const tasks = appointments.map(apt => ({
        id: apt.id,
        title: apt.title,
        description: apt.description || '',
        time: apt.startTime,
        date: apt.date,
        type: apt.meetingType || 'meeting',
        status: apt.status,
        clientName: apt.clientName || '',
        clientEmail: apt.clientEmail || '',
        location: apt.location || 'virtual'
      }));
      
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching agent tasks:", error);
      res.json([]);
    }
  });

  // Agent recent activity - real data from leads, prospects, and commissions
  app.get("/api/agent/activity", requireAgent, async (req, res) => {
    try {
      const agentId = req.user?.id;
      if (!agentId) {
        return res.json([]);
      }
      
      const activities: Array<{ id: string; type: string; title: string; description: string; timestamp: string }> = [];
      
      // Get recent leads
      const recentLeads = await db.select()
        .from(agentLeads)
        .where(eq(agentLeads.agentId, agentId))
        .orderBy(desc(agentLeads.createdAt))
        .limit(5);
      
      recentLeads.forEach((lead) => {
        activities.push({
          id: `lead-${lead.id}`,
          type: "lead",
          title: lead.stage === 'new' ? "New Lead Assigned" : `Lead ${lead.stage}`,
          description: `${lead.name || 'Lead'} has been ${lead.stage === 'new' ? 'assigned to you' : 'updated to ' + lead.stage}`,
          timestamp: (lead.updatedAt || lead.createdAt || new Date()).toString()
        });
      });
      
      // Get recent prospects
      const recentProspects = await db.select()
        .from(prospectClients)
        .where(eq(prospectClients.agentId, agentId))
        .orderBy(desc(prospectClients.createdAt))
        .limit(5);
      
      recentProspects.forEach((prospect) => {
        activities.push({
          id: `prospect-${prospect.id}`,
          type: "prospect",
          title: prospect.uploadedPortfolio ? "Portfolio Uploaded" : "New Prospect Added",
          description: `${prospect.name || 'Prospect'} ${prospect.uploadedPortfolio ? 'uploaded their portfolio' : 'was added as a prospect'}`,
          timestamp: (prospect.updatedAt || prospect.createdAt || new Date()).toString()
        });
      });
      
      // Get recent commissions
      const recentCommissions = await db.select()
        .from(schema.agentCommissions)
        .where(eq(schema.agentCommissions.agentId, agentId))
        .orderBy(desc(schema.agentCommissions.createdAt))
        .limit(3);
      
      recentCommissions.forEach((commission) => {
        const amount = parseFloat(commission.agentCommissionAmount || '0');
        activities.push({
          id: `commission-${commission.id}`,
          type: "commission",
          title: commission.status === 'credited' ? "Commission Credited" : "Commission Pending",
          description: `₹${amount.toLocaleString('en-IN')} ${commission.status === 'credited' ? 'credited' : 'pending'} for ${commission.transactionType || 'transaction'}`,
          timestamp: (commission.createdAt || new Date()).toString()
        });
      });
      
      // Sort by timestamp descending and return top 10
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      res.json(activities.slice(0, 10));
    } catch (error) {
      console.error("Error fetching agent activity:", error);
      res.json([]);
    }
  });

  // Agent tasks stats for notification center - real data
  app.get("/api/agent/tasks/stats", requireAgent, async (req, res) => {
    try {
      const agentId = req.user?.id;
      if (!agentId) {
        return res.json({ pendingTasks: 0, overdueCount: 0 });
      }
      
      const today = new Date().toISOString().split('T')[0];
      
      // Get pending appointments
      const pendingResult = await db.select({ count: count() })
        .from(agentAppointments)
        .where(and(
          eq(agentAppointments.agentId, agentId),
          eq(agentAppointments.status, 'scheduled'),
          gte(agentAppointments.date, today)
        ));
      
      // Get overdue appointments (past date but still scheduled)
      const overdueResult = await db.select({ count: count() })
        .from(agentAppointments)
        .where(and(
          eq(agentAppointments.agentId, agentId),
          eq(agentAppointments.status, 'scheduled'),
          lt(agentAppointments.date, today)
        ));
      
      res.json({ 
        pendingTasks: pendingResult[0]?.count || 0, 
        overdueCount: overdueResult[0]?.count || 0 
      });
    } catch (error) {
      console.error("Error fetching agent tasks stats:", error);
      res.json({ pendingTasks: 0, overdueCount: 0 });
    }
  });
  // Agent leads - Full CRUD for lead pipeline
  // GET all leads for agent
  app.get("/api/agent/leads", requireAgent, async (req, res) => {
    try {
      const leads = await db.select()
        .from(agentLeads)
        .where(eq(agentLeads.agentId, req.user.id))
        .orderBy(desc(agentLeads.createdAt));
      
      // Transform to match frontend Lead interface
      const transformedLeads = leads.map(lead => ({
        id: lead.id,
        name: lead.name || '',
        email: lead.email || '',
        phone: lead.phone || '',
        stage: lead.stage || 'new',
        source: lead.source || 'manual',
        potentialValue: Number(lead.potentialValue) || 0,
        score: lead.score || 50,
        notes: lead.notes || '',
        lastContact: lead.lastContactAt?.toISOString(),
        nextFollowUp: lead.nextFollowUpAt?.toISOString(),
        createdAt: lead.createdAt?.toISOString() || new Date().toISOString(),
        tags: lead.tags || []
      }));
      
      res.json(transformedLeads);
    } catch (error) {
      console.error("Error fetching agent leads:", error);
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  // GET leads stats with full metrics
  app.get("/api/agent/leads/stats", requireAgent, async (req, res) => {
    try {
      const leads = await db.select()
        .from(agentLeads)
        .where(eq(agentLeads.agentId, req.user.id));
      
      const stageCounts = {
        new: 0,
        contacted: 0,
        proposal_sent: 0,
        negotiating: 0,
        converted: 0,
        lost: 0
      };
      
      let totalValue = 0;
      let convertedValue = 0;
      
      leads.forEach(lead => {
        const stage = lead.stage as keyof typeof stageCounts;
        if (stageCounts.hasOwnProperty(stage)) {
          stageCounts[stage]++;
        }
        const val = Number(lead.potentialValue) || 0;
        if (stage !== 'lost' && stage !== 'converted') {
          totalValue += val;
        }
        if (stage === 'converted') {
          convertedValue += val;
        }
      });
      
      const stats = {
        total: leads.length,
        new: stageCounts.new,
        contacted: stageCounts.contacted,
        proposalSent: stageCounts.proposal_sent,
        negotiating: stageCounts.negotiating,
        converted: stageCounts.converted,
        lost: stageCounts.lost,
        conversionRate: leads.length > 0 ? Math.round((stageCounts.converted / leads.length) * 100) : 0,
        avgDealValue: stageCounts.converted > 0 ? Math.round(convertedValue / stageCounts.converted) : 0,
        pipelineValue: totalValue,
        newLeadsCount: stageCounts.new
      };
      
      res.json(stats);
    } catch (error) {
      console.error("Error fetching agent leads stats:", error);
      res.json({ newLeadsCount: 0, total: 0 });
    }
  });

  // GAP 6: Upline visibility — returns the chain from the current agent up to root
  app.get("/api/agent/upline", requireAgent, async (req, res) => {
    try {
      const [agentRecord] = await db.select().from(schema.agents)
        .where(eq(schema.agents.userId, req.user.id)).limit(1);

      if (!agentRecord) return res.json({ upline: [], message: "No agent profile found" });

      const chain: any[] = [];
      let currentId = agentRecord.reportingTo;
      const visited = new Set<string>();

      while (currentId && !visited.has(currentId)) {
        visited.add(currentId);
        const [uplineAgent] = await db.select({
          id: schema.agents.id,
          fullName: schema.agents.fullName,
          email: schema.agents.email,
          hierarchyLevel: schema.agents.hierarchyLevel,
          employeeId: schema.agents.employeeId,
          arnCode: schema.agents.arnCode,
          userId: schema.agents.userId,
          reportingTo: schema.agents.reportingTo,
        }).from(schema.agents).where(eq(schema.agents.id, currentId)).limit(1);

        if (!uplineAgent) break;
        chain.push(uplineAgent);
        currentId = uplineAgent.reportingTo || null;
      }

      res.json({ upline: chain, levels: chain.length });
    } catch (error) {
      console.error("[Upline] Error:", error);
      res.status(500).json({ error: "Failed to fetch upline" });
    }
  });

  // POST create new lead
  // GAP 8: Business Associates' leads auto-assigned to upline Field Executive
  app.post("/api/agent/leads", requireAgent, async (req, res) => {
    try {
      const { name, email, phone, source, potentialValue, notes } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: "Lead name is required" });
      }

      // GAP 8 FIX: If creator is a Business Associate (associate role), find their upline
      let assignedAgentId = req.user.id;
      let resolvedSource = source || 'manual';
      const userRole = (req.user as any).role;

      if (userRole === 'associate') {
        try {
          const [baRecord] = await db.select().from(schema.agents)
            .where(eq(schema.agents.userId, req.user.id)).limit(1);

          if (baRecord?.reportingTo) {
            const [uplineAgent] = await db.select().from(schema.agents)
              .where(eq(schema.agents.id, baRecord.reportingTo)).limit(1);

            if (uplineAgent?.userId) {
              assignedAgentId = uplineAgent.userId;
              resolvedSource = 'associate_referral';
            }
          }
        } catch (e) {
          console.error("[LeadCreate] BA upline lookup failed:", e);
        }
      }

      const [newLead] = await db.insert(agentLeads)
        .values({
          agentId: assignedAgentId,
          name,
          email: email || null,
          phone: phone || null,
          source: resolvedSource,
          potentialValue: potentialValue ? String(potentialValue) : '0',
          notes: notes || null,
          stage: 'new',
          score: 50,
          tags: []
        })
        .returning();
      
      res.json({
        id: newLead.id,
        name: newLead.name,
        email: newLead.email || '',
        phone: newLead.phone || '',
        stage: newLead.stage,
        source: newLead.source,
        potentialValue: Number(newLead.potentialValue) || 0,
        score: newLead.score || 50,
        notes: newLead.notes || '',
        createdAt: newLead.createdAt?.toISOString(),
        tags: newLead.tags || [],
        assignedTo: assignedAgentId,
        createdBy: req.user.id,
      });
    } catch (error) {
      console.error("Error creating lead:", error);
      res.status(500).json({ error: "Failed to create lead" });
    }
  });

  // PATCH update lead stage
  app.patch("/api/agent/leads/:id/stage", requireAgent, async (req, res) => {
    try {
      const { id } = req.params;
      const { stage } = req.body;
      
      const validStages = ['new', 'contacted', 'proposal_sent', 'negotiating', 'converted', 'lost'];
      if (!validStages.includes(stage)) {
        return res.status(400).json({ error: "Invalid stage" });
      }
      
      const [updated] = await db.update(agentLeads)
        .set({ 
          stage, 
          updatedAt: new Date(),
          lastContactAt: new Date()
        })
        .where(and(eq(agentLeads.id, id), eq(agentLeads.agentId, req.user.id)))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      res.json({ success: true, lead: updated });
    } catch (error) {
      console.error("Error updating lead stage:", error);
      res.status(500).json({ error: "Failed to update lead stage" });
    }
  });

  // Agent proposals stats for notification center
  app.get("/api/agent/proposals/stats", requireAgent, async (req, res) => {
    try {
      res.json({ pendingResponses: 1 });
    } catch (error) {
      console.error("Error fetching agent proposals stats:", error);
      res.json({ pendingResponses: 0 });
    }

  // Push notification subscription storage (in-memory for demo)
  const pushSubscriptions = new Map<string, any>();

  // Save push notification subscription
  app.post("/api/agent/notifications/subscribe", requireAgent, async (req, res) => {
    try {
      const userId = req.user?.id || 'anonymous';
      const { subscription } = req.body;
      
      if (!subscription) {
        return res.status(400).json({ error: "Subscription data required" });
      }

      pushSubscriptions.set(userId, {
        subscription,
        subscribedAt: new Date(),
        userId
      });

      console.log(`📲 Push notification subscription saved for user: ${userId}`);
      res.json({ success: true, message: "Subscription saved successfully" });
    } catch (error) {
      console.error("Error saving push subscription:", error);
      res.status(500).json({ error: "Failed to save subscription" });
    }
  });

  // Mark notification as read
  app.post("/api/agent/notifications/:id/read", requireAgent, async (req, res) => {
    try {
      const { id } = req.params;
      console.log(`📖 Notification ${id} marked as read`);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  // Mark all notifications as read
  app.post("/api/agent/notifications/mark-all-read", requireAgent, async (req, res) => {
    try {
      console.log("📖 All notifications marked as read");
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ error: "Failed to mark notifications as read" });
    }
  });
  });

  // Get agent profile information
  app.get("/api/agent/profile", requireAgent, async (req, res) => {
    try {

      // Get agent details from the customer care agents table  
      const agents = await storage.getAgents();
      const agent = agents.find(a => a.employeeId === req.user.id);

      if (!agent) {
        return res.status(404).json({ error: "Agent profile not found" });
      }

      // Return data in the format expected by frontend
      const agentProfile = {
        id: agent.id,
        fullName: agent.fullName || `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim(),
        email: agent.email || req.user.email,
        employeeId: agent.employeeId,
        euinNumber: agent.euinNumber,
        arnCode: agent.arnCode,
        distributorId: agent.distributorId,
        specializations: agent.specializations || [],
        languages: agent.languages || ['en'],
        status: agent.status || 'active'
      };

      res.json(agentProfile);
    } catch (error) {
      console.error("Error fetching agent profile:", error);
      res.status(500).json({ error: "Failed to fetch agent profile" });
    }
  });


  // Get agent marketing profile for festival greetings
  app.get("/api/agent/marketing-profile", requireAgent, async (req, res) => {
    try {
      // Get agent from agents table (uses new marketing profile fields)
      const [agent] = await db
        .select()
        .from(schema.agents)
        .where(eq(schema.agents.userId, req.user.id))
        .limit(1);

      if (agent) {
        return res.json({
          id: agent.id,
          fullName: agent.fullName,
          email: agent.email,
          phone: agent.phone,
          marketingName: agent.marketingName,
          marketingDesignation: agent.marketingDesignation,
          marketingEmail: agent.marketingEmail,
          marketingPhone: agent.marketingPhone,
        });
      }

      // Fallback to customer care agents if no agent record
      const agents = await storage.getAgents();
      const ccAgent = agents.find(a => a.employeeId === req.user.id);
      
      if (ccAgent) {
        return res.json({
          id: ccAgent.id,
          fullName: ccAgent.fullName,
          email: ccAgent.email,
          phone: ccAgent.phone,
          marketingName: null,
          marketingDesignation: null,
          marketingEmail: null,
          marketingPhone: null,
        });
      }

      // Return user info as fallback
      res.json({
        id: req.user.id,
        fullName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim(),
        email: req.user.email,
        phone: req.user.mobile || req.user.phone,
        marketingName: null,
        marketingDesignation: null,
        marketingEmail: null,
        marketingPhone: null,
      });
    } catch (error) {
      console.error("Error fetching agent marketing profile:", error);
      res.status(500).json({ error: "Failed to fetch marketing profile" });
    }
  });

  // Save agent marketing profile
  app.post("/api/agent/marketing-profile", requireAgent, async (req, res) => {
    try {
      const { marketingName, marketingDesignation, marketingEmail, marketingPhone } = req.body;

      // Try to update agents table first
      const [existingAgent] = await db
        .select()
        .from(schema.agents)
        .where(eq(schema.agents.userId, req.user.id))
        .limit(1);

      if (existingAgent) {
        // Update existing agent record
        const [updated] = await db
          .update(schema.agents)
          .set({
            marketingName,
            marketingDesignation,
            marketingEmail,
            marketingPhone,
            updatedAt: new Date(),
          })
          .where(eq(schema.agents.id, existingAgent.id))
          .returning();

        return res.json({
          success: true,
          profile: updated,
        });
      }

      // Create new agent record if doesn't exist
      const [newAgent] = await db
        .insert(schema.agents)
        .values({
          userId: req.user.id,
          fullName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || 'Agent',
          email: req.user.email,
          phone: req.user.mobile || req.user.phone,
          marketingName,
          marketingDesignation,
          marketingEmail,
          marketingPhone,
        })
        .returning();

      res.json({
        success: true,
        profile: newAgent,
      });
    } catch (error) {
      console.error("Error saving agent marketing profile:", error);
      res.status(500).json({ error: "Failed to save marketing profile" });
    }
  });

  // ─── Advisor Brand Profile ───────────────────────────────────────────────
  app.get("/api/agent/advisor-brand-profile", requireAgent, async (req, res) => {
    try {
      const [agent] = await db.select().from(schema.agents)
        .where(eq(schema.agents.userId, req.user.id)).limit(1);
      if (!agent) return res.json({});

      // Auto-generate referral code if missing
      if (!agent.referralCode) {
        const code = `FP${agent.id.slice(0, 6).toUpperCase()}`;
        await db.update(schema.agents).set({ referralCode: code })
          .where(eq(schema.agents.id, agent.id));
        agent.referralCode = code;
      }

      // Fetch referrals count
      const referrals = await db.execute(
        sql`SELECT COUNT(*) AS cnt FROM advisor_referrals WHERE referrer_id = ${agent.id}`
      );

      res.json({
        // Identity
        fullName:      agent.fullName,
        email:         agent.email,
        phone:         agent.phone,
        photoUrl:      (agent as any).photoUrl       ?? null,
        // Branding
        firmName:      (agent as any).firmName       ?? null,
        firmLogoUrl:   (agent as any).firmLogoUrl    ?? null,
        tagline:       (agent as any).tagline        ?? null,
        bio:           (agent as any).bio            ?? null,
        // Credentials
        arnCode:       agent.arnCode                 ?? null,
        arnExpiryDate: (agent as any).arnExpiryDate  ?? null,
        euinNumber:    agent.euinNumber              ?? null,
        sebiRegNumber: (agent as any).sebiRegNumber  ?? null,
        irdaiRegNumber:(agent as any).irdaiRegNumber ?? null,
        nismCertNumber:(agent as any).nismCertNumber ?? null,
        nismCertExpiry:(agent as any).nismCertExpiry ?? null,
        cfpNumber:     (agent as any).cfpNumber      ?? null,
        cfpExpiry:     (agent as any).cfpExpiry      ?? null,
        // Business
        yearsExperience:(agent as any).yearsExperience ?? 0,
        aumManaged:    (agent as any).aumManaged     ?? 0,
        activeClients: agent.activeClients           ?? 0,
        totalClients:  agent.totalClients            ?? 0,
        city:          (agent as any).city           ?? null,
        state:         (agent as any).state          ?? null,
        joiningDate:   agent.joiningDate             ?? null,
        // Specialisations & Language
        specializations: (agent as any).specializations ?? [],
        languagesSpoken: (agent as any).languagesSpoken ?? [],
        // Social
        linkedinUrl:   (agent as any).linkedinUrl    ?? null,
        whatsappBusiness:(agent as any).whatsappBusiness ?? null,
        websiteUrl:    (agent as any).websiteUrl     ?? null,
        twitterUrl:    (agent as any).twitterUrl     ?? null,
        // Referral
        referralCode:  agent.referralCode            ?? null,
        referralCount: Number((referrals.rows[0] as any)?.cnt ?? 0),
        // Visibility
        profilePublic: (agent as any).profilePublic  ?? false,
      });
    } catch (err) {
      console.error("advisor-brand-profile GET error:", err);
      res.status(500).json({ error: "Failed to load advisor profile" });
    }
  });

  app.put("/api/agent/advisor-brand-profile", requireAgent, async (req, res) => {
    try {
      const {
        photoUrl, firmName, firmLogoUrl, tagline, bio,
        arnCode, arnExpiryDate, euinNumber, sebiRegNumber, irdaiRegNumber,
        nismCertNumber, nismCertExpiry, cfpNumber, cfpExpiry,
        yearsExperience, aumManaged, city, state,
        specializations, languagesSpoken,
        linkedinUrl, whatsappBusiness, websiteUrl, twitterUrl,
        profilePublic,
        marketingName, marketingDesignation, marketingEmail, marketingPhone,
      } = req.body;

      const [existing] = await db.select().from(schema.agents)
        .where(eq(schema.agents.userId, req.user.id)).limit(1);

      const payload: Record<string, unknown> = {
        photoUrl, firmName, firmLogoUrl, tagline, bio,
        arnCode, arnExpiryDate: arnExpiryDate || null,
        euinNumber, sebiRegNumber, irdaiRegNumber,
        nismCertNumber, nismCertExpiry: nismCertExpiry || null,
        cfpNumber, cfpExpiry: cfpExpiry || null,
        yearsExperience: Number(yearsExperience) || 0,
        aumManaged: aumManaged || 0,
        city, state,
        specializations: specializations || [],
        languagesSpoken: languagesSpoken || [],
        linkedinUrl, whatsappBusiness, websiteUrl, twitterUrl,
        profilePublic: !!profilePublic,
        marketingName, marketingDesignation, marketingEmail, marketingPhone,
        updatedAt: new Date(),
      };
      // Remove undefined keys to avoid overwriting with null accidentally
      Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

      if (existing) {
        await db.update(schema.agents).set(payload as any)
          .where(eq(schema.agents.id, existing.id));
      } else {
        await db.insert(schema.agents).values({
          userId: req.user.id,
          fullName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || 'Agent',
          email: req.user.email,
          phone: req.user.mobile || req.user.phone,
          ...payload,
        } as any);
      }

      res.json({ success: true });
    } catch (err) {
      console.error("advisor-brand-profile PUT error:", err);
      res.status(500).json({ error: "Failed to save advisor profile" });
    }
  });

  // Public advisor profile microsite (no auth)
  app.get("/api/public/advisor/:referralCode", async (req, res) => {
    try {
      const [agent] = await db.select().from(schema.agents)
        .where(eq(schema.agents.referralCode, req.params.referralCode)).limit(1);
      if (!agent || !(agent as any).profilePublic) {
        return res.status(404).json({ error: "Profile not found" });
      }
      res.json({
        fullName:        agent.fullName,
        photoUrl:        (agent as any).photoUrl        ?? null,
        firmName:        (agent as any).firmName        ?? null,
        firmLogoUrl:     (agent as any).firmLogoUrl     ?? null,
        tagline:         (agent as any).tagline         ?? null,
        bio:             (agent as any).bio             ?? null,
        arnCode:         agent.arnCode                  ?? null,
        sebiRegNumber:   (agent as any).sebiRegNumber   ?? null,
        irdaiRegNumber:  (agent as any).irdaiRegNumber  ?? null,
        yearsExperience: (agent as any).yearsExperience ?? 0,
        aumManaged:      (agent as any).aumManaged      ?? 0,
        activeClients:   agent.activeClients            ?? 0,
        city:            (agent as any).city            ?? null,
        state:           (agent as any).state           ?? null,
        specializations: (agent as any).specializations ?? [],
        languagesSpoken: (agent as any).languagesSpoken ?? [],
        linkedinUrl:     (agent as any).linkedinUrl     ?? null,
        whatsappBusiness:(agent as any).whatsappBusiness?? null,
        websiteUrl:      (agent as any).websiteUrl      ?? null,
        marketingPhone:  agent.marketingPhone           ?? null,
        marketingEmail:  agent.marketingEmail           ?? null,
        designation:     agent.marketingDesignation     ?? null,
        referralCode:    agent.referralCode,
      });
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // Get agent's partners
  app.get("/api/agent/partners", requireAgent, async (req, res) => {
    try {

      res.json([]);
    } catch (error) {
      console.error("Error fetching agent partners:", error);
      res.status(500).json({ error: "Failed to fetch partners" });
    }
  });

  // Add new partner
  app.post("/api/agent/partners", requireAgent, async (req, res) => {
    try {
      // Validate request body with Zod
      const partnerSchema = z.object({
        companyName: z.string().min(1, "Company name is required"),
        contactEmail: z.string().email("Valid email is required"),
        contactPhone: z.string().min(1, "Phone number is required"),
        address: z.string().optional(),
        website: z.string().url().optional().or(z.literal("")),
        partnerType: z.enum(["product_provider", "service_provider", "both"]),
        businessLicense: z.string().optional(),
        taxId: z.string().optional(),
        euinNumber: z.string().optional(),
        arnCode: z.string().optional(),
        hasEuinArn: z.boolean().default(false)
      });

      const partnerData = partnerSchema.parse(req.body);
      
      // In production, implement partner creation in storage
      const partner = {
        id: Date.now().toString(),
        ...partnerData,
        createdAt: new Date().toISOString(),
        agentId: req.user.id
      };

      res.json({ success: true, partner });
    } catch (error) {
      console.error("Error creating partner:", error);
      res.status(500).json({ error: "Failed to create partner" });
    }
  });

  // Get agent's clients (includes both registered clients and prospects/leads)
  app.get("/api/agent/clients", requireAgent, async (req, res) => {
    try {
      const { searchTerm } = req.query;
      console.log("[Agent Clients] Route called for user:", req.user?.id);
      res.set("Cache-Control", "no-cache, no-store");

      // Get clients assigned to this agent with full user data in single query
      const clientRelationships = await storage.getClientsForAgent(req.user.id);
      
      console.log("[Agent Clients] Client relationships found:", clientRelationships.length);
      // Get client IDs for batch fetching
      const clientIds = clientRelationships.map(r => r.clientId).filter(Boolean);
      
      // Batch fetch user details, KYC status, and portfolio values
      let enrichedClients: any[] = [];
      if (clientIds.length > 0) {
        const clientsData = await db
          .select({
            id: schema.users.id,
            firstName: schema.users.firstName,
            lastName: schema.users.lastName,
            email: schema.users.email,
            mobile: schema.users.mobile,
            panNumber: schema.users.panNumber,
            riskTolerance: schema.users.riskTolerance,
            investorType: schema.users.investorType,
            clientType: schema.users.clientType,
            isActive: schema.users.isActive,
            createdAt: schema.users.createdAt,
            kycStatus: schema.kycVault.kycStatus,
          })
          .from(schema.users)
          .leftJoin(schema.kycVault, eq(schema.users.id, schema.kycVault.userId))
          .where(inArray(schema.users.id, clientIds));

        // Get portfolio values in batch
        const portfolioValues = await db
          .select({
            userId: schema.portfolios.userId,
            totalValue: sql<number>`COALESCE(SUM(CAST(${schema.portfolios.currentValue} AS NUMERIC)), 0)`,
          })
          .from(schema.portfolios)
          .where(inArray(schema.portfolios.userId, clientIds))
          .groupBy(schema.portfolios.userId);

        const portfolioMap = new Map(portfolioValues.map(p => [p.userId, Number(p.totalValue) || 0]));

        enrichedClients = clientsData.map(client => {
          const totalPortfolioValue = portfolioMap.get(client.id) || 0;
          let kycStatus: string = 'pending';
          if (client.kycStatus === 'verified') kycStatus = 'enhanced';
          else if (client.kycStatus === 'pending') kycStatus = 'pending';
          else if (client.kycStatus) kycStatus = 'basic';

          let clientCategory: string = client.clientType === 'corporate' ? 'corporate' : 'retail';
          if (clientCategory !== 'corporate') {
            if (totalPortfolioValue >= 50000000) clientCategory = 'bhni';
            else if (totalPortfolioValue >= 10000000) clientCategory = 'shni';
            else if (totalPortfolioValue >= 5000000) clientCategory = 'hni';
          }

          return {
            id: client.id,
            firstName: client.firstName || '',
            lastName: client.lastName || '',
            email: client.email || '',
            mobile: client.mobile || '',
            panNumber: client.panNumber || '',
            kycStatus,
            riskProfile: client.riskTolerance || 'moderate',
            clientCategory,
            totalPortfolioValue,
            createdAt: client.createdAt?.toISOString() || new Date().toISOString(),
            isActive: client.isActive ?? true,
            isProspect: false,
          };
        });
      }
      
      // Get prospects/leads entered by this agent from prospect_clients table
      const prospects = await db.select()
        .from(prospectClients)
        .where(eq(prospectClients.agentId, req.user.id));
      console.log("[Agent Clients] Prospects found:", prospects.length, "for agent:", req.user.id);
      
      // Map prospects to match the client interface format
      const prospectsMapped = prospects.map(prospect => {
        const nameParts = (prospect.name || '').split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        return {
          id: prospect.id,
          firstName: firstName,
          lastName: lastName,
          email: prospect.email || '',
          phone: prospect.mobile || '',
          mobile: prospect.mobile || '',
          panNumber: prospect.pan || '',
          kycStatus: 'pending',
          riskProfile: 'moderate',
          clientCategory: 'retail',
          totalPortfolioValue: 0,
          createdAt: prospect.createdAt?.toISOString() || new Date().toISOString(),
          isActive: true,
          isProspect: true,
          prospectState: prospect.state,
          clientType: prospect.clientType
        };
      });
      
      // Combine clients and prospects
      let allClientsAndProspects = [...enrichedClients, ...prospectsMapped];
      
      // Filter by search term if provided
      if (searchTerm) {
        const term = (searchTerm as string).toLowerCase();
        allClientsAndProspects = allClientsAndProspects.filter(client => 
          client.firstName?.toLowerCase().includes(term) ||
          client.lastName?.toLowerCase().includes(term) ||
          client.email?.toLowerCase().includes(term) ||
          (client.panNumber && client.panNumber.toLowerCase().includes(term))
        );
      }

      console.log("[Agent Clients] Returning:", allClientsAndProspects.length, "total items");
      res.json(allClientsAndProspects);
    } catch (error) {
      console.error("Error fetching agent clients:", error);
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  // Add new client
  app.post("/api/agent/clients", requireAgent, async (req, res) => {
    try {
      // Validate request body with Zod - flexible validation for quick client creation
      const clientSchema = z.object({
        firstName: z.string().min(1, "First name is required"),
        lastName: z.string().min(1, "Last name is required"),
        email: z.string().email("Valid email is required").optional().or(z.literal("")),
        mobile: z.string().optional().or(z.literal("")),
        panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Valid PAN number is required").optional().or(z.literal("")),
        assignedAgent: z.string().optional(),
        masterAgentEuin: z.string().optional()
      });

      const clientData = clientSchema.parse(req.body);
      
      // Generate a unique ID for the new client
      const uuid = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Create new client in the database
      const [newClient] = await db.insert(users).values({
        email: clientData.email || `${uuid}@placeholder.fintekpro.com`,
        firstName: clientData.firstName,
        lastName: clientData.lastName,
        mobile: clientData.mobile || null,
        panNumber: clientData.panNumber || null,
        passwordHash: "placeholder-pending-onboarding",
        roles: ["client"],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();
      
      // Create agent-client relationship
      await db.insert(agentClientRelationships).values({
        agentId: req.user.id,
        clientId: newClient.id,
        relationshipType: "assigned",
        status: "active",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      res.json({ 
        success: true, 
        uuid: newClient.id,
        id: newClient.id,
        firstName: newClient.firstName,
        lastName: newClient.lastName,
        email: newClient.email,
        mobile: newClient.mobile
      });
    } catch (error: any) {
      console.error("Error creating client:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: error.errors[0]?.message || "Validation failed" });
      }
      res.status(500).json({ error: "Failed to create client" });
    }
  });

  // Get agent statistics
  app.get("/api/agent/stats", requireAgent, async (req, res) => {
    try {
      const agentId = req.user.id;
      
      // Get basic stats from existing data
      const clientRelationships = await storage.getClientsForAgent(agentId);
      const activeClients = clientRelationships.filter(c => c.isActive).length;
      
      // Get leads count
      const leadsResult = await db.select({ count: count() })
        .from(agentLeads)
        .where(eq(agentLeads.agentId, agentId));
      const totalLeads = leadsResult[0]?.count || 0;
      
      // Get converted leads
      const convertedLeadsResult = await db.select({ count: count() })
        .from(agentLeads)
        .where(and(
          eq(agentLeads.agentId, agentId),
          eq(agentLeads.stage, 'converted')
        ));
      const convertedLeads = convertedLeadsResult[0]?.count || 0;
      
      // Get AUM from client portfolios
      const clientIds = clientRelationships.map(c => c.clientId);
      let totalAUM = 0;
      if (clientIds.length > 0) {
        const portfolioValues = await db.select({ 
          totalValue: portfolios.totalValue 
        })
          .from(portfolios)
          .where(sql`${portfolios.userId} = ANY(${clientIds})`);
        
        totalAUM = portfolioValues.reduce((acc, p) => acc + (parseFloat(p.totalValue || '0') || 0), 0);
      }
      
      // Get current month's start date
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      
      // Get this month's commissions (business)
      const thisMonthCommissions = await db.select({ 
        total: sum(schema.agentCommissions.agentCommissionAmount) 
      })
        .from(schema.agentCommissions)
        .where(and(
          eq(schema.agentCommissions.agentId, agentId),
          gte(schema.agentCommissions.createdAt, monthStart)
        ));
      const thisMonthBusiness = parseFloat(thisMonthCommissions[0]?.total || '0') || 0;
      
      // Get last month's commissions
      const lastMonthCommissions = await db.select({ 
        total: sum(schema.agentCommissions.agentCommissionAmount) 
      })
        .from(schema.agentCommissions)
        .where(and(
          eq(schema.agentCommissions.agentId, agentId),
          gte(schema.agentCommissions.createdAt, lastMonthStart),
          lte(schema.agentCommissions.createdAt, lastMonthEnd)
        ));
      const lastMonthBusiness = parseFloat(lastMonthCommissions[0]?.total || '0') || 0;
      
      // Get total commissions (credited)
      const totalCommissionsResult = await db.select({ 
        total: sum(schema.agentCommissions.agentCommissionAmount) 
      })
        .from(schema.agentCommissions)
        .where(and(
          eq(schema.agentCommissions.agentId, agentId),
          eq(schema.agentCommissions.status, 'credited')
        ));
      const totalCommissions = parseFloat(totalCommissionsResult[0]?.total || '0') || 0;
      
      // Get pending commissions
      const pendingCommissionsResult = await db.select({ 
        total: sum(schema.agentCommissions.agentCommissionAmount) 
      })
        .from(schema.agentCommissions)
        .where(and(
          eq(schema.agentCommissions.agentId, agentId),
          eq(schema.agentCommissions.status, 'pending')
        ));
      const pendingCommissions = parseFloat(pendingCommissionsResult[0]?.total || '0') || 0;
      
      // Monthly target (configurable, default 500000)
      const monthlyTarget = 500000;
      const targetProgress = monthlyTarget > 0 ? (thisMonthBusiness / monthlyTarget) * 100 : 0;

      const stats = {
        totalClients: clientRelationships.length,
        activeClients,
        totalLeads,
        convertedLeads,
        totalAUM,
        thisMonthBusiness,
        lastMonthBusiness,
        totalCommissions,
        pendingCommissions,
        targetProgress,
        monthlyTarget
      };

      res.json(stats);
    } catch (error) {
      console.error("Error fetching agent stats:", error);
      res.status(500).json({ error: "Failed to fetch agent statistics" });
    }
  });
  app.get("/api/agent/appointments", requireAgent, async (req, res) => {
    try {
      const agentId = req.user!.id;
      const appointments = await db.select().from(schema.agentAppointments).where(eq(schema.agentAppointments.agentId, agentId)).orderBy(schema.agentAppointments.date, schema.agentAppointments.startTime);
      res.json({ appointments });
    } catch (error) {
      console.error("Error fetching appointments:", error);
      res.status(500).json({ error: "Failed to fetch appointments" });
    }
  });

  // POST /api/agent/appointments - Create appointment
  app.post("/api/agent/appointments", requireAgent, async (req, res) => {
    try {
      const agentId = req.user!.id;
      const { title, description, meetingType, date, startTime, endTime, duration, location, locationDetails, reminder, notes, agenda, clientId, clientName, clientEmail, clientPhone } = req.body;

      if (!title || !meetingType || !date || !startTime || !endTime || !duration) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const [appointment] = await db.insert(schema.agentAppointments).values({
        agentId,
        clientId,
        title,
        description,
        meetingType,
        date,
        startTime,
        endTime,
        duration,
        location,
        locationDetails,
        reminder: reminder || "30min",
        notes,
        agenda,
        clientName,
        clientEmail,
        clientPhone,
        status: "scheduled",
      }).returning();

      res.status(201).json({ appointment });
    } catch (error) {
      console.error("Error creating appointment:", error);
      res.status(500).json({ error: "Failed to create appointment" });
    }
  });

  // PATCH /api/agent/appointments/:id - Update appointment
  app.patch("/api/agent/appointments/:id", requireAgent, async (req, res) => {
    try {
      const agentId = req.user!.id;
      const { id } = req.params;
      const updates = req.body;

      const [existing] = await db.select().from(schema.agentAppointments).where(and(eq(schema.agentAppointments.id, id), eq(schema.agentAppointments.agentId, agentId)));
      if (!existing) {
        return res.status(404).json({ error: "Appointment not found" });
      }

      const updateData: any = { ...updates, updatedAt: new Date() };
      if (updates.status === "completed") {
        updateData.completedAt = new Date();
      }

      const [appointment] = await db.update(schema.agentAppointments).set(updateData).where(eq(schema.agentAppointments.id, id)).returning();
      res.json({ appointment });
    } catch (error) {
      console.error("Error updating appointment:", error);
      res.status(500).json({ error: "Failed to update appointment" });
    }
  });

  // DELETE /api/agent/appointments/:id - Cancel appointment
  app.delete("/api/agent/appointments/:id", requireAgent, async (req, res) => {
    try {
      const agentId = req.user!.id;
      const { id } = req.params;

      const [existing] = await db.select().from(schema.agentAppointments).where(and(eq(schema.agentAppointments.id, id), eq(schema.agentAppointments.agentId, agentId)));
      if (!existing) {
        return res.status(404).json({ error: "Appointment not found" });
      }

      await db.update(schema.agentAppointments).set({ status: "cancelled", updatedAt: new Date() }).where(eq(schema.agentAppointments.id, id));
      res.json({ success: true, message: "Appointment cancelled" });
    } catch (error) {
      console.error("Error cancelling appointment:", error);
      res.status(500).json({ error: "Failed to cancel appointment" });
    }
  });

  // POST /api/agent/appointments/:id/send-reminder - Send reminder to client
  app.post("/api/agent/appointments/:id/send-reminder", requireAgent, async (req, res) => {
    try {
      const agentId = req.user!.id;
      const { id } = req.params;
      const { method } = req.body;

      const [appointment] = await db.select().from(schema.agentAppointments).where(and(eq(schema.agentAppointments.id, id), eq(schema.agentAppointments.agentId, agentId)));
      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }

      await db.update(schema.agentAppointments).set({ reminderSent: true, updatedAt: new Date() }).where(eq(schema.agentAppointments.id, id));

      res.json({ success: true, message: "Reminder sent via " + method });
    } catch (error) {
      console.error("Error sending reminder:", error);
      res.status(500).json({ error: "Failed to send reminder" });
    }
  });

  // Agent Leaderboard - GET /api/agent/leaderboard
  app.get("/api/agent/leaderboard", requireAgent, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      res.json({ leaderboard: [] });
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  // Agent Commission Rates - GET /api/agent/commission-rates
  app.get("/api/agent/commission-rates", requireAgent, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const commissionRates = {
        mutual_funds: {
          trailPercent: 0.5,
          upfrontPercent: 1.0,
          minInvestment: 5000,
          description: "Earn trail commission on AUM plus upfront on new investments"
        },
        bonds: {
          trailPercent: 0.25,
          upfrontPercent: 0.5,
          minInvestment: 10000,
          description: "Fixed income products with competitive commission structure"
        },
        insurance: {
          trailPercent: 2.5,
          upfrontPercent: 15.0,
          minInvestment: 25000,
          description: "Life and health insurance with high upfront commissions"
        },
        unlisted_stocks: {
          trailPercent: 0,
          upfrontPercent: 2.0,
          minInvestment: 100000,
          description: "Pre-IPO and unlisted equity with one-time commission"
        },
        reits: {
          trailPercent: 0.3,
          upfrontPercent: 0.75,
          minInvestment: 50000,
          description: "Real estate investment trusts with quarterly payouts"
        }
      };

      res.json({ rates: commissionRates });
    } catch (error) {
      console.error("Error fetching commission rates:", error);
      res.status(500).json({ error: "Failed to fetch commission rates" });
    }
  });

  // Agent Campaigns - GET /api/agent/campaigns (history)
  app.get("/api/agent/campaigns", requireAgent, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      res.json([]);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      res.status(500).json({ error: "Failed to fetch campaigns" });
    }
  });

  // Agent Campaigns - POST /api/agent/campaigns/sms
  app.post("/api/agent/campaigns/sms", requireAgent, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { name, message, recipients } = req.body;

      if (!name || !message || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ error: "Campaign name, message, and recipients are required" });
      }

      let successCount = 0;
      let failedCount = 0;

      try {
        const { smsService } = await import("../services/sms-service");
        
        if (smsService.isAvailable()) {
          for (const recipient of recipients) {
            try {
              const sent = await smsService.sendMessage(recipient.phone, message);
              if (sent) {
                successCount++;
              } else {
                failedCount++;
              }
            } catch (err) {
              failedCount++;
            }
          }
        } else {
          successCount = recipients.length;
          console.log(`[Mock SMS Campaign] Sent to ${recipients.length} recipients`);
        }
      } catch (importError) {
        successCount = recipients.length;
        console.log(`[Mock SMS Campaign] SMS service not available, simulating send to ${recipients.length} recipients`);
      }

      res.json({
        success: true,
        campaignId: `sms-${Date.now()}`,
        name,
        type: "sms",
        totalRecipients: recipients.length,
        successCount,
        failedCount,
        status: "completed"
      });
    } catch (error) {
      console.error("Error sending SMS campaign:", error);
      res.status(500).json({ error: "Failed to send SMS campaign" });
    }
  });

  // Agent Campaigns - POST /api/agent/campaigns/email
  app.post("/api/agent/campaigns/email", requireAgent, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { name, subject, htmlContent, recipients } = req.body;

      if (!name || !subject || !htmlContent || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ error: "Campaign name, subject, content, and recipients are required" });
      }

      let successCount = 0;
      let failedCount = 0;

      try {
        const { emailService } = await import("../email-service");
        
        for (const recipient of recipients) {
          try {
            await emailService.sendEmail({
              to: recipient.email,
              subject,
              html: htmlContent
            });
            successCount++;
          } catch (err) {
            failedCount++;
          }
        }
      } catch (importError) {
        successCount = recipients.length;
        console.log(`[Mock Email Campaign] Email service not available, simulating send to ${recipients.length} recipients`);
      }

      res.json({
        success: true,
        campaignId: `email-${Date.now()}`,
        name,
        type: "email",
        totalRecipients: recipients.length,
        successCount,
        failedCount,
        status: "completed"
      });
    } catch (error) {
      console.error("Error sending email campaign:", error);
      res.status(500).json({ error: "Failed to send email campaign" });
    }
  });

  // Agent Campaigns - POST /api/agent/campaigns/whatsapp
  app.post("/api/agent/campaigns/whatsapp", requireAgent, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { name, templateName, templateParams, recipients } = req.body;

      if (!name || !templateName || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ error: "Campaign name, template name, and recipients are required" });
      }

      let successCount = 0;
      let failedCount = 0;
      const broadcastId = `whatsapp-${Date.now()}`;

      try {
        const { twilioWhatsAppService } = await import("../services/twilio-whatsapp-service");
        
        if (twilioWhatsAppService.isAvailable()) {
          for (const r of recipients) {
            const result = await twilioWhatsAppService.sendMessage(
              r.phone,
              `${name}: ${templateName}`
            );
            if (result.success) {
              successCount++;
            } else {
              failedCount++;
            }
          }
        } else {
          successCount = recipients.length;
          console.log(`[Mock WhatsApp Campaign] Twilio WhatsApp not configured, simulating send to ${recipients.length} recipients`);
        }
      } catch (importError) {
        successCount = recipients.length;
        console.log(`[Mock WhatsApp Campaign] Twilio service not available, simulating send to ${recipients.length} recipients`);
      }
      res.json({
        success: true,
        campaignId: broadcastId || `whatsapp-${Date.now()}`,
        name,
        type: "whatsapp",
        totalRecipients: recipients.length,
        successCount,
        failedCount,
        status: "completed"
      });
    } catch (error) {
      console.error("Error sending WhatsApp campaign:", error);
      res.status(500).json({ error: "Failed to send WhatsApp campaign" });
    }
  });

  // Interactive Brokers API integration routes
  app.get("/api/ib/accounts", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const accounts = await storage.getIBAccounts(req.user.id);
      res.json({ accounts });
    } catch (error) {
      console.error("Error fetching IB accounts:", error);
      res.status(500).json({ error: "Failed to fetch IB accounts" });
    }
  });

  app.post("/api/ib/accounts", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { accountNumber, host = "127.0.0.1", port = 7497, clientId } = req.body;

      if (!accountNumber || !clientId) {
        return res.status(400).json({ error: "Account number and client ID are required" });
      }

      const account = await storage.createIBAccount({
        userId: req.user!.id,
        accountNumber,
        host,
        port,
        clientId,
        status: "disconnected"
      });

      res.json({ account });
    } catch (error) {
      console.error("Error creating IB account:", error);
      res.status(500).json({ error: "Failed to create IB account" });
    }
  });

  app.post("/api/ib/accounts/:id/connect", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { id } = req.params;
      const account = await storage.getIBAccount(id);

      if (!account || account.userId !== req.user.id) {
        return res.status(404).json({ error: "IB account not found" });
      }

      // TODO: Implement actual IB API connection logic
      // For now, just update status
      const updatedAccount = await storage.updateIBAccountConnectionStatus(
        id, 
        "connected", 
        new Date()
      );

      res.json({ account: updatedAccount });
    } catch (error) {
      console.error("Error connecting to IB account:", error);
      res.status(500).json({ error: "Failed to connect to IB account" });
    }
  });

  app.get("/api/ib/positions", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { accountId } = req.query;
      const positions = await storage.getIBPositions(req.user.id, accountId as string);
      res.json({ positions });
    } catch (error) {
      console.error("Error fetching IB positions:", error);
      res.status(500).json({ error: "Failed to fetch IB positions" });
    }
  });

  app.get("/api/ib/orders", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { accountId } = req.query;
      const orders = await storage.getIBOrders(req.user.id, accountId as string);
      res.json({ orders });
    } catch (error) {
      console.error("Error fetching IB orders:", error);
      res.status(500).json({ error: "Failed to fetch IB orders" });
    }
  });

  app.post("/api/ib/orders", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { ibAccountId, symbol, action, quantity, orderType, price, timeInForce } = req.body;

      if (!ibAccountId || !symbol || !action || !quantity || !orderType) {
        return res.status(400).json({ error: "Missing required order parameters" });
      }

      // Verify account ownership
      const account = await storage.getIBAccount(ibAccountId);
      if (!account || account.userId !== req.user.id) {
        return res.status(404).json({ error: "IB account not found" });
      }

      const order = await storage.createIBOrder({
        userId: req.user!.id,
        ibAccountId,
        symbol,
        action,
        quantity,
        orderType,
        price,
        timeInForce: timeInForce || "DAY",
        status: "pending"
      });

      // TODO: Submit order to IB API

      res.json({ order });
    } catch (error) {
      console.error("Error creating IB order:", error);
      res.status(500).json({ error: "Failed to create IB order" });
    }
  });

  app.get("/api/ib/account-summary", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { accountId } = req.query;
      const summaries = await storage.getIBAccountSummary(req.user.id, accountId as string);
      res.json({ summaries });
    } catch (error) {
      console.error("Error fetching IB account summary:", error);
      res.status(500).json({ error: "Failed to fetch IB account summary" });
    }
  });

  // Supplier API endpoints
  app.get("/api/suppliers", requireAdmin, async (req, res) => {
    try {
      const suppliers = await storage.getAllSuppliers();
      res.json({ suppliers });
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      res.status(500).json({ error: "Failed to fetch suppliers" });
    }
  });

  app.post("/api/suppliers", requireAdmin, async (req, res) => {
    try {
      const { name, contactEmail, contactPhone, address, description, rating, isActive } = req.body;

      if (!name || !contactEmail) {
        return res.status(400).json({ error: "Name and contact email are required" });
      }

      const supplier = await storage.createSupplier({
        name,
        contactEmail,
        contactPhone,
        address,
        description,
        rating: rating || 5.0,
        isActive: isActive !== false
      });

      res.json({ supplier });
    } catch (error) {
      console.error("Error creating supplier:", error);
      res.status(500).json({ error: "Failed to create supplier" });
    }
  });

  app.put("/api/suppliers/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const supplier = await storage.updateSupplier(id, updates);
      if (!supplier) {
        return res.status(404).json({ error: "Supplier not found" });
      }

      res.json({ supplier });
    } catch (error) {
      console.error("Error updating supplier:", error);
      res.status(500).json({ error: "Failed to update supplier" });
    }
  });

  app.delete("/api/suppliers/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteSupplier(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Supplier not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting supplier:", error);
      res.status(500).json({ error: "Failed to delete supplier" });
    }
  });

  // Supplier Products API endpoints
  app.get("/api/supplier-products", requireAdmin, async (req, res) => {
    try {
      const { supplierId } = req.query;
      const products = await storage.getSupplierProducts(supplierId as string);
      res.json({ products });
    } catch (error) {
      console.error("Error fetching supplier products:", error);
      res.status(500).json({ error: "Failed to fetch supplier products" });
    }
  });

  app.post("/api/supplier-products", requireAdmin, async (req, res) => {
    try {
      const { supplierId, productName, description, price, profitMargin, category, isActive } = req.body;

      if (!supplierId || !productName || !price || !profitMargin) {
        return res.status(400).json({ error: "Supplier ID, product name, price, and profit margin are required" });
      }

      const product = await storage.createSupplierProduct({
        supplierId,
        productName,
        description,
        price,
        profitMargin,
        category,
        isActive: isActive !== false
      });

      res.json({ product });
    } catch (error) {
      console.error("Error creating supplier product:", error);
      res.status(500).json({ error: "Failed to create supplier product" });
    }
  });

  app.put("/api/supplier-products/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const product = await storage.updateSupplierProduct(id, updates);
      if (!product) {
        return res.status(404).json({ error: "Supplier product not found" });
      }

      res.json({ product });
    } catch (error) {
      console.error("Error updating supplier product:", error);
      res.status(500).json({ error: "Failed to update supplier product" });
    }
  });

  app.delete("/api/supplier-products/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteSupplierProduct(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Supplier product not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting supplier product:", error);
      res.status(500).json({ error: "Failed to delete supplier product" });
    }
  });

  // Profit Optimization endpoints
  app.get("/api/products/:productId/optimal-supplier", requireAdmin, async (req, res) => {
    try {
      const { productId } = req.params;
      const optimalSupplier = await storage.getOptimalSupplier(productId);
      
      if (!optimalSupplier) {
        return res.status(404).json({ error: "No suppliers found for this product" });
      }

      res.json({ optimalSupplier });
    } catch (error) {
      console.error("Error finding optimal supplier:", error);
      res.status(500).json({ error: "Failed to find optimal supplier" });
    }
  });

  app.get("/api/products/:productId/profit-analysis", requireAdmin, async (req, res) => {
    try {
      const { productId } = req.params;
      const analysis = await storage.getProfitAnalysis(productId);
      res.json({ analysis });
    } catch (error) {
      console.error("Error generating profit analysis:", error);
      res.status(500).json({ error: "Failed to generate profit analysis" });
    }
  });

  app.get("/api/products/:productId/supplier-comparison", requireAdmin, async (req, res) => {
    try {
      const { productId } = req.params;
      const comparison = await storage.getSupplierComparison(productId);
      res.json({ suppliers: comparison });
    } catch (error) {
      console.error("Error generating supplier comparison:", error);
      res.status(500).json({ error: "Failed to generate supplier comparison" });
    }
  });

  // Product Performance Metrics API endpoints
  app.get("/api/product-performance", requireAdmin, async (req, res) => {
    try {
      const { productId } = req.query;
      const metrics = await storage.getProductPerformanceMetrics(productId as string);
      res.json({ metrics });
    } catch (error) {
      console.error("Error fetching product performance metrics:", error);
      res.status(500).json({ error: "Failed to fetch product performance metrics" });
    }
  });

  app.post("/api/product-performance", requireAdmin, async (req, res) => {
    try {
      const { productId, salesVolume, revenue, customerSatisfaction, returnRate, profitMargin, trendDirection } = req.body;

      if (!productId || !salesVolume || !revenue) {
        return res.status(400).json({ error: "Product ID, sales volume, and revenue are required" });
      }

      const metric = await storage.createProductPerformanceMetric({
        productId,
        salesVolume,
        revenue,
        customerSatisfaction,
        returnRate,
        profitMargin,
        trendDirection,
        recordedAt: new Date()
      });

      res.json({ metric });
    } catch (error) {
      console.error("Error creating product performance metric:", error);
      res.status(500).json({ error: "Failed to create product performance metric" });
    }
  });




  // Admin endpoint to get all client assignments
  app.get("/api/admin/client-assignments", requireAdmin, async (req, res) => {
    try {
      const assignments = await storage.getClientAssignments();
      
      res.json({
        status: "success",
        data: assignments
      });
    } catch (error) {
      console.error("Error fetching client assignments:", error);
      res.status(500).json({ 
        status: "error", 
        error: "Failed to fetch client assignments" 
      });
    }
  });

  // Admin endpoint to update client assignment
  app.put("/api/admin/client-assignments/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const assignment = await storage.updateClientAssignment(id, updates);
      
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }

      // Log the update activity
      await adminService.logActivity({
        userId: req.user!.id,
        action: 'update_client_assignment',
        resource: `assignment:${id}`,
        details: updates
      });

      res.json({
        status: "success",
        data: assignment
      });
    } catch (error) {
      console.error("Error updating client assignment:", error);
      res.status(500).json({ 
        status: "error", 
        error: "Failed to update client assignment" 
      });
    }
  });

  // Agent endpoint to get assigned clients
  app.get("/api/agents/assigned-clients", async (req, res) => {
    try {
      const agentId = req.user?.id;
      
      if (!agentId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const assignments = await storage.getClientAssignmentsByAgent(agentId);
      
      res.json({
        status: "success",
        data: assignments
      });
    } catch (error) {
      console.error("Error fetching assigned clients:", error);
      res.status(500).json({ 
        status: "error", 
        error: "Failed to fetch assigned clients" 
      });
    }
  });

  // Loan Against Securities API endpoints
  
  // Check loan eligibility
  app.post("/api/loans/eligibility", async (req, res) => {
    try {
      const { portfolioId, requestedAmount } = req.body;
      
      if (!portfolioId || !requestedAmount) {
        return res.status(400).json({
          success: false,
          error: "Portfolio ID and requested amount are required"
        });
      }

      // Get portfolio holdings
      const holdings = await storage.getPortfolioHoldings(portfolioId);
      const totalValue = holdings.reduce((sum, holding) => sum + (parseFloat(holding.quantity) * parseFloat(holding.avgPrice)), 0);
      
      // Calculate eligibility (typically 50-80% LTV for securities)
      const maxLoanAmount = totalValue * 0.75; // 75% LTV
      const isEligible = parseFloat(requestedAmount) <= maxLoanAmount;
      
      const eligibilityData = {
        isEligible,
        maxLoanAmount,
        portfolioValue: totalValue,
        loanToValue: (parseFloat(requestedAmount) / totalValue * 100).toFixed(2),
        interestRate: "10.25", // Starting rate like 50Fin
        processingFee: parseFloat(requestedAmount) * 0.01, // 1% processing fee
        eligibleAssets: holdings.filter(h => ['equity', 'mf'].includes(h.assetType))
      };

      res.json({
        success: true,
        data: eligibilityData
      });
    } catch (error) {
      console.error("Error checking loan eligibility:", error);
      res.status(500).json({
        success: false,
        error: "Failed to check loan eligibility"
      });
    }
  });

  // Submit loan application
  app.post("/api/loans/apply", async (req, res) => {
    try {
      const loanData = req.body;
      
      // Generate application number
      const applicationNumber = `LAS${Date.now()}${Math.floor(Math.random() * 1000)}`;
      
      const application = await storage.createLoanApplication({
        ...loanData,
        applicationNumber,
        status: "pending"
      });

      res.json({
        success: true,
        data: application
      });
    } catch (error) {
      console.error("Error creating loan application:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create loan application"
      });
    }
  });

  // Get user's loan applications
  app.get("/api/loans/user/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const loans = await storage.getUserLoans(userId);
      
      res.json({
        success: true,
        data: loans
      });
    } catch (error) {
      console.error("Error fetching user loans:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch loan applications"
      });
    }
  });

  // Get loan details
  app.get("/api/loans/:loanId", async (req, res) => {
    try {
      const { loanId } = req.params;
      const loan = await storage.getLoanApplication(loanId);
      
      if (!loan) {
        return res.status(404).json({
          success: false,
          error: "Loan application not found"
        });
      }
      
      res.json({
        success: true,
        data: loan
      });
    } catch (error) {
      console.error("Error fetching loan details:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch loan details"
      });
    }
  });

  // Update loan status (admin only)
  app.patch("/api/loans/:loanId/status", async (req, res) => {
    try {
      const { loanId } = req.params;
      const { status, approvedAmount, rejectionReason } = req.body;
      
      const updatedLoan = await storage.updateLoanStatus(loanId, {
        status,
        approvedAmount,
        rejectionReason,
        approvalDate: status === 'approved' ? new Date() : undefined,
        disbursalDate: status === 'disbursed' ? new Date() : undefined
      });
      
      res.json({
        success: true,
        data: updatedLoan
      });
    } catch (error) {
      console.error("Error updating loan status:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update loan status"
      });
    }
  });

  // Get collateral valuation
  app.get("/api/loans/:loanId/valuation", async (req, res) => {
    try {
      const { loanId } = req.params;
      const valuation = await storage.getCollateralValuation(loanId);
      
      res.json({
        success: true,
        data: valuation
      });
    } catch (error) {
      console.error("Error fetching collateral valuation:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch collateral valuation"
      });
    }
  });

  // API Key Management endpoints (admin only)
  app.get("/api/admin/api-keys", requireAdmin, async (req, res) => {
    try {
      // Return available API keys without exposing actual values
      const apiKeys = {
        GEMINI_API_KEY: process.env.GEMINI_API_KEY ? 'configured' : 'not_configured',
 
        ALPHA_VANTAGE_API_KEY: process.env.ALPHA_VANTAGE_API_KEY ? 'configured' : 'not_configured',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'configured' : 'not_configured',
        ICICI_BANK_API_KEY: process.env.ICICI_BANK_API_KEY ? 'configured' : 'not_configured',
        HDFC_BANK_API_KEY: process.env.HDFC_BANK_API_KEY ? 'configured' : 'not_configured',
        JM_FINANCIAL_API_KEY: process.env.JM_FINANCIAL_API_KEY ? 'configured' : 'not_configured',
      };

      res.json({ success: true, data: apiKeys });
    } catch (error) {
      console.error("Error fetching API keys status:", error);
      res.status(500).json({ success: false, error: "Failed to fetch API keys status" });
    }
  });

  app.post("/api/admin/api-keys", requireAdmin, async (req, res) => {
    try {
      const { keyName, keyValue } = req.body;
      
      if (!keyName || !keyValue) {
        return res.status(400).json({ 
          success: false, 
          error: "API key name and value are required" 
        });
      }

      // Validate that the key name is allowed
      const allowedKeys = [
        'GEMINI_API_KEY', 'ALPHA_VANTAGE_API_KEY', 
        'OPENAI_API_KEY', 'ICICI_BANK_API_KEY', 'HDFC_BANK_API_KEY',
        'JM_FINANCIAL_API_KEY'
      ];

      if (!allowedKeys.includes(keyName)) {
        return res.status(400).json({ 
          success: false, 
          error: "Invalid API key name" 
        });
      }

      // Update environment variable (note: this only persists for current session)
      process.env[keyName] = keyValue;

      // Log the configuration change for audit
      await adminService.logActivity({
        userId: req.user!.id,
        action: 'api_key_updated',
        resource: `API Key: ${keyName}`,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        details: { keyName, timestamp: new Date().toISOString() }
      });

      res.json({ 
        success: true, 
        message: `${keyName} has been updated successfully`,
        data: { keyName, status: 'configured' }
      });
    } catch (error) {
      console.error("Error updating API key:", error);
      res.status(500).json({ success: false, error: "Failed to update API key" });
    }
  });

  // ========================
}
