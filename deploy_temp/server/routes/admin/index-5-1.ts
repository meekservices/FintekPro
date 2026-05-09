import { Express, Response } from 'express';
import { db } from '../../db';
import { sql, desc, eq } from 'drizzle-orm';
import { mutualFunds, signalResolutionLog, governancePolicy } from '@shared/schema';
import { signalOrchestrator } from '../../services/signal-orchestrator';
import { storage } from '../../storage';
import { adminService } from '../../admin-service';
import ckycDeferredRoutes from './ckyc-deferred-routes';
import { registerSEBIComplianceRoutes } from './sebi-compliance-routes';
import { auditIntegrityChecker } from '../../services/audit-integrity-checker';
import { platformStatsCache } from '../../services/platform-stats-cache';
import { riaValidationService } from '../../services/ria-validation-service';
import { insuranceSuitabilityService } from '../../services/insurance-suitability-service';
import { proxyToInsurance } from '../../clients/insurance-client';
import { beneficialOwnershipService } from '../../services/beneficial-ownership-service';
import { sebiScoresService } from '../../services/sebi-scores-service';
import { mfReturnsSyncService } from '../../services/mf-returns-sync-service';

const requireAdmin = async (req: any, res: Response, next: any) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  const isAdmin = await adminService.isAdmin(req.user.id);
  if (!isAdmin) {
    return res.status(403).json({ message: "Admin access required" });
  }
  
  next();
};

async function ensureAgentNotificationsTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS agent_notifications (
        id          SERIAL PRIMARY KEY,
        agent_id    VARCHAR(255) NOT NULL,
        title       TEXT NOT NULL,
        body        TEXT NOT NULL,
        type        TEXT NOT NULL DEFAULT 'info',
        link        TEXT,
        read_at     TIMESTAMPTZ,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_agent_notifications_agent_id
        ON agent_notifications(agent_id)
    `);
    console.log("✅ [AgentNotifications] Table ready");
  } catch (err: any) {
    console.error("[AgentNotifications] Table init error:", err.message);
  }
}
ensureAgentNotificationsTable();

export function registerAdminPanelPart5Sub1Routes(app: Express): void {
  
  // Admin Dashboard - Overview statistics


  // Revenue Analytics API
  app.put("/api/kyc-progress", async (req, res) => {
    try {
      const userId = req.user?.id || "central-test-user"; // Get from session
      const { 
        currentStep, 
        completedSteps, 
        completionPercentage,
        personalDetailsData,
        addressDetailsData,
        bankDetailsData,
        documentDetailsData,
        panDataSource,
        aadharDataSource,
        addressDataSource,
        autoPopulatedFields,
        isCompleted,
        completedAt
      } = req.body;

      // Check if progress exists
      const existing = await db
        .select()
        .from(kycFormProgress)
        .where(eq(kycFormProgress.userId, userId))
        .limit(1);

      let result;

      if (existing.length > 0) {
        // Update existing progress
        result = await db
          .update(kycFormProgress)
          .set({
            currentStep,
            completedSteps,
            completionPercentage,
            personalDetailsData,
            addressDetailsData,
            bankDetailsData,
            documentDetailsData,
            panDataSource,
            aadharDataSource,
            addressDataSource,
            autoPopulatedFields,
            isCompleted,
            completedAt: completedAt ? new Date(completedAt) : undefined,
            lastSavedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(kycFormProgress.userId, userId))
          .returning();
      } else {
        // Create new progress
        result = await db
          .insert(kycFormProgress)
          .values({
            userId,
            currentStep,
            completedSteps,
            completionPercentage,
            personalDetailsData,
            addressDetailsData,
            bankDetailsData,
            documentDetailsData,
            panDataSource,
            aadharDataSource,
            addressDataSource,
            autoPopulatedFields,
            isCompleted,
            completedAt: completedAt ? new Date(completedAt) : undefined
          })
          .returning();
      }

      res.json(result[0]);
    } catch (error) {
      console.error("Error saving KYC progress:", error);
      res.status(500).json({ error: "Failed to save KYC progress" });
    }
  });

  // ============ CUSTOMER CARE AGENT ROUTES ============
  // NOTE: Agent CRUD routes (GET, POST, PATCH, DELETE /api/admin/agents) 
  // are now handled in server/stakeholder-routes.ts to avoid duplication.
  // Only the agent-partner mapping routes remain here.

  // Get agent-partner mappings
  app.get("/api/admin/agent-mappings", requireAdmin, async (req, res) => {
    try {
      const { agentId, partnerId } = req.query as any;
      const mappings = await storage.getAgentPartnerMappings(agentId, partnerId);
      res.json(mappings);
    } catch (error) {
      console.error("Error fetching agent-partner mappings:", error);
      res.status(500).json({ error: "Failed to fetch mappings" });
    }
  });

  // Create agent-partner mapping
  app.post("/api/admin/agent-mappings", requireAdmin, async (req, res) => {
    try {
      const mapping = await storage.createAgentPartnerMapping({
        ...req.body,
        assignedBy: req.user.id
      });
      res.status(201).json(mapping);
    } catch (error) {
      console.error("Error creating agent-partner mapping:", error);
      res.status(500).json({ error: "Failed to create mapping" });
    }
  });

  // Update agent-partner mapping
  app.patch("/api/admin/agent-mappings/:mappingId", requireAdmin, async (req, res) => {
    try {
      const { mappingId } = req.params;
      const updated = await storage.updateAgentPartnerMapping(mappingId, req.body);
      
      if (!updated) {
        return res.status(404).json({ error: "Mapping not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating agent-partner mapping:", error);
      res.status(500).json({ error: "Failed to update mapping" });
    }
  });

  // Delete agent-partner mapping
  app.delete("/api/admin/agent-mappings/:mappingId", requireAdmin, async (req, res) => {
    try {
      const { mappingId } = req.params;
      const deleted = await storage.deleteAgentPartnerMapping(mappingId);
      
      if (!deleted) {
        return res.status(404).json({ error: "Mapping not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting agent-partner mapping:", error);
      res.status(500).json({ error: "Failed to delete mapping" });
    }
  });

  // ============ CLIENT-AGENT RELATIONSHIP ROUTES (EUIN/ARN Integration) ============
  
  // Get all client-agent relationships
  app.get("/api/admin/client-agent-relationships", requireAdmin, async (req, res) => {
    try {
      const { clientId, agentId } = req.query;
      const relationships = await storage.getClientAgentRelationships(
        clientId as string, 
        agentId as string
      );
      res.json(relationships);
    } catch (error) {
      console.error("Error fetching client-agent relationships:", error);
      res.status(500).json({ error: "Failed to fetch relationships" });
    }
  });

  // Get client-agent relationships statistics
  app.get("/api/admin/client-agent-relationships/stats", requireAdmin, async (req, res) => {
    try {
      // Get stats using raw SQL for efficiency
      const statsResult = await db.execute(sql`
        SELECT 
          COUNT(*) as total_relationships,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_relationships,
          COUNT(DISTINCT client_id) as unique_clients,
          COUNT(DISTINCT agent_id) as unique_agents,
          SUM(CASE WHEN auto_populate_euin OR auto_populate_arn THEN 1 ELSE 0 END) as auto_populated_apis
        FROM client_agent_relationships
      `);
      
      const stats = statsResult.rows[0] || {};
      
      res.json({
        totalRelationships: Number(stats.total_relationships || 0),
        activeRelationships: Number(stats.active_relationships || 0),
        uniqueClients: Number(stats.unique_clients || 0),
        uniqueAgents: Number(stats.unique_agents || 0),
        autoPopulatedApis: Number(stats.auto_populated_apis || 0)
      });
    } catch (error) {
      console.error("Error fetching client-agent relationship stats:", error);
      res.status(500).json({ error: "Failed to fetch relationship stats" });
    }
  });

  // Create client-agent relationship
  app.post("/api/admin/client-agent-relationships", requireAdmin, async (req, res) => {
    try {
      const relationshipData = req.body;
      
      // Validate required fields
      if (!relationshipData.clientId || !relationshipData.agentId || !relationshipData.euinNumber) {
        return res.status(400).json({ error: "Client ID, Agent ID, and EUIN number are required" });
      }

      const relationship = await storage.createClientAgentRelationship(relationshipData);
      res.json(relationship);
    } catch (error) {
      console.error("Error creating client-agent relationship:", error);
      res.status(500).json({ error: "Failed to create relationship" });
    }
  });

  // Update client-agent relationship
  app.patch("/api/admin/client-agent-relationships/:relationshipId", requireAdmin, async (req, res) => {
    try {
      const { relationshipId } = req.params;
      const updates = req.body;
      
      const updated = await storage.updateClientAgentRelationship(relationshipId, updates);
      
      if (!updated) {
        return res.status(404).json({ error: "Relationship not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating client-agent relationship:", error);
      res.status(500).json({ error: "Failed to update relationship" });
    }
  });

  // Delete client-agent relationship
  app.delete("/api/admin/client-agent-relationships/:relationshipId", requireAdmin, async (req, res) => {
    try {
      const { relationshipId } = req.params;
      const deleted = await storage.deleteClientAgentRelationship(relationshipId);
      
      if (!deleted) {
        return res.status(404).json({ error: "Relationship not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting client-agent relationship:", error);
      res.status(500).json({ error: "Failed to delete relationship" });
    }
  });

  // Get agent for a specific client
  app.get("/api/client/:clientId/agent", async (req, res) => {
    try {
      const { clientId } = req.params;
      const { relationshipType } = req.query;
      
      const agentRelationship = await storage.getAgentForClient(
        clientId, 
        relationshipType as string
      );
      
      if (!agentRelationship) {
        return res.status(404).json({ error: "No agent assigned to this client" });
      }
      
      res.json(agentRelationship);
    } catch (error) {
      console.error("Error fetching agent for client:", error);
      res.status(500).json({ error: "Failed to fetch agent" });
    }
  });

  // Get clients for a specific agent
  app.get("/api/agent/:agentId/clients", async (req, res) => {
    try {
      const { agentId } = req.params;
      const clientRelationships = await storage.getClientsForAgent(agentId);
      
      res.json(clientRelationships);
    } catch (error) {
      console.error("Error fetching clients for agent:", error);
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  // Automatically populate EUIN/ARN for API calls (utility endpoint)
  app.get("/api/client/:clientId/euin-arn", async (req, res) => {
    try {
      const { clientId } = req.params;
      const agentRelationship = await storage.getAgentForClient(clientId);
      
      if (!agentRelationship) {
        return res.status(404).json({ 
          error: "No agent assigned to this client",
          euinNumber: null,
          arnCode: null 
        });
      }
      
      res.json({
        euinNumber: agentRelationship.autoPopulateEuin ? agentRelationship.euinNumber : null,
        arnCode: agentRelationship.autoPopulateArn ? agentRelationship.arnCode : null,
        amcCode: agentRelationship.amcCode,
        distributorId: agentRelationship.distributorId,
        agentId: agentRelationship.agentId
      });
    } catch (error) {
      console.error("Error fetching EUIN/ARN for client:", error);
      res.status(500).json({ error: "Failed to fetch EUIN/ARN data" });
    }
  });

  // Audit Trail Integrity Status API
}
