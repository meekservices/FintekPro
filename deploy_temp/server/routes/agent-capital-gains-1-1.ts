import { Express } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import { requireAdmin, requireAgent } from '../middleware/roleMiddleware';
import * as schema from '@shared/schema';
import { eq, desc, sql, and, or, gte, lte, inArray, lt, count } from 'drizzle-orm';
import { agentAppointments, prospectClients, portfolios } from '@shared/schema';

export function registerAgentCapitalGainPart1Part1Routes(app: Express): void {
  app.post("/api/agent/capital-gains-reports/request", requireAgent, async (req, res) => {
    try {
      const { clientId, financialYear, assessmentYear, reportType, dataSource } = req.body;
      
      if (!clientId || !financialYear || !dataSource) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      // Verify agent has access to this client
      const relationship = await storage.getClientAgentRelationship(clientId, req.user!.id);
      if (!relationship || (relationship as any).status !== 'active') {
        return res.status(403).json({ error: "No active relationship with this client" });
      }
      
      const reportData = {
        clientId,
        agentId: req.user!.id,
        financialYear,
        assessmentYear: assessmentYear || `${parseInt(financialYear.split('-')[1]) + 1}-${parseInt(financialYear.split('-')[1]) + 2}`,
        reportType: reportType || 'capital_gains',
        dataSource,
        status: 'calculating',
        reportFee: '25',
        paymentStatus: 'pending'
      };
      
      const report = await storage.createCapitalGainsReport(reportData as any);
      
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
      const reports = await storage.getAgentCapitalGainsReports(req.user!.id, {
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
      if (report.agentId !== req.user!.id) {
        return res.status(403).json({ error: "Access denied to this report" });
      }
      
      if ((report as any).status !== 'generated') {
        return res.status(400).json({ error: "Report is not ready for download" });
      }
      
      // Update download count
      await storage.updateCapitalGainsReport(id, {
        downloadCount: ((report as any).downloadCount || 0) + 1,
        downloadedAt: new Date()
      } as any);
      
      const filename = `client-capital-gains-${(report as any).clientId}-${(report as any).financialYear}-${Date.now()}`;
      
      if (format === 'pdf') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
        
        const pdfContent = `Client Capital Gains Report\n\nClient ID: ${(report as any).clientId}\nFinancial Year: ${(report as any).financialYear}\nAssessment Year: ${(report as any).assessmentYear}\nSource: ${(report as any).dataSource}\nGenerated: ${new Date().toLocaleDateString('en-IN')}\n\nShort Term Gains: ₹${(report as any).totalShortTermGains || 0}\nLong Term Gains: ₹${(report as any).totalLongTermGains || 0}\nTotal Tax Liability: ₹${(report as any).totalTaxLiability || 0}\nNet Gains: ₹${(report as any).netGains || 0}`;
        
        res.send(Buffer.from(pdfContent));
      } else if (format === 'excel') {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
        
        const excelContent = "Client,Financial Year,Short Term Gains,Long Term Gains,Net Gains,Tax Liability\n" +
          `${(report as any).clientId},${(report as any).financialYear},${(report as any).totalShortTermGains || 0},${(report as any).totalLongTermGains || 0},${(report as any).netGains || 0},${(report as any).totalTaxLiability || 0}`;
        
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
      
      if (!req.user || req.user!.role !== 'agent') {
        return res.status(403).json({ error: "Agent access required" });
      }
      
      const report = await storage.getCapitalGainsReport(id);
      if (!report) {
        return res.status(404).json({ error: "Capital gains report not found" });
      }
      
      // Verify agent has access to this report
      if (report.agentId !== req.user!.id) {
        return res.status(403).json({ error: "Access denied to this report" });
      }
      
      // Create sharing record
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
      
      const sharing = await storage.createReportSharing({
        reportId: id,
        reportType: 'capital_gains_report',
        sharedBy: req.user!.id,
        sharedWith: (report as any).clientId,
        sharedWithType: undefined,
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
      
      const sharedReports = await storage.getAgentSharedReports(req.user!.id, {
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
        .from(schema.agentLeads)
        .where(eq(schema.agentLeads.agentId, agentId))
        .orderBy(desc(schema.agentLeads.createdAt))
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
          title: (commission as any).status === 'credited' ? "Commission Credited" : "Commission Pending",
          description: `₹${amount.toLocaleString('en-IN')} ${(commission as any).status === 'credited' ? 'credited' : 'pending'} for ${commission.transactionType || 'transaction'}`,
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
        .from(schema.agentLeads)
        .where(eq(schema.agentLeads.agentId, req.user!.id))
        .orderBy(desc(schema.agentLeads.createdAt));
      
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
        .from(schema.agentLeads)
        .where(eq(schema.agentLeads.agentId, req.user!.id));
      
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
        .where(eq(schema.agents.userId, req.user!.id)).limit(1);

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
}
