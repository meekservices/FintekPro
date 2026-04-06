import { Express } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import { requireAdmin, requireAgent } from '../middleware/roleMiddleware';
import * as schema from '@shared/schema';
import { eq, desc, sql, and, or, gte, lte, inArray, lt, count } from 'drizzle-orm';
import { agentAppointments, prospectClients, portfolios } from '@shared/schema';

export function registerAgentCapitalGainPart2Part1Routes(app: Express): void {
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
        .from(schema.agentLeads)
        .where(eq(schema.agentLeads.agentId, agentId));
      const totalLeads = leadsResult[0]?.count || 0;
      
      // Get converted leads
      const convertedLeadsResult = await db.select({ count: count() })
        .from(schema.agentLeads)
        .where(and(
          eq(schema.agentLeads.agentId, agentId),
          eq(schema.agentLeads.stage, 'converted')
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
}
