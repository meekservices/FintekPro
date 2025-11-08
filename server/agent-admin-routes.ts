import type { Express, Request, Response } from "express";
import { agentSelectionService } from "./services/agent-selection-service";
import { apiResponse } from "./utils/responses";
import { storage } from "./storage";

// Auth middleware
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

// Admin middleware
const requireAdmin = async (req: any, res: any, next: any) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  const user = await storage.getUser(req.user.id);
  if (!user || !user.roles || !user.roles.includes("admin")) {
    return res.status(403).json({ error: "Forbidden: Admin access required" });
  }
  
  next();
};

export function registerAgentAdminRoutes(app: Express) {
  
  /**
   * GET /api/admin/agents/default
   * Get the current default agent
   * Admin only
   */
  app.get("/api/admin/agents/default", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const defaultAgent = await agentSelectionService.getDefaultAgent();
      
      return apiResponse.success(res, {
        agentId: defaultAgent.agentId,
        arnCode: defaultAgent.arnCode,
        euinNumber: defaultAgent.euinNumber,
        fullName: defaultAgent.fullName
      }, "Default agent retrieved successfully");
    } catch (error) {
      console.error("Error getting default agent:", error);
      return apiResponse.serverError(res, error instanceof Error ? error.message : "Failed to get default agent");
    }
  });

  /**
   * POST /api/admin/agents/default
   * Set a new default agent
   * Admin only
   * 
   * Body: { agentId: string, tableType?: 'agents' | 'customer_care_agents' }
   */
  app.post("/api/admin/agents/default", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { agentId, tableType = 'customer_care_agents' } = req.body;
      
      if (!agentId) {
        return apiResponse.badRequest(res, "Agent ID is required");
      }
      
      if (!['agents', 'customer_care_agents'].includes(tableType)) {
        return apiResponse.badRequest(res, "Invalid table type. Must be 'agents' or 'customer_care_agents'");
      }
      
      await agentSelectionService.setDefaultAgent(agentId, tableType as 'agents' | 'customer_care_agents');
      
      // Get the updated default agent details
      const defaultAgent = await agentSelectionService.getDefaultAgent();
      
      return apiResponse.success(res, {
        agentId: defaultAgent.agentId,
        arnCode: defaultAgent.arnCode,
        euinNumber: defaultAgent.euinNumber,
        fullName: defaultAgent.fullName
      }, "Default agent updated successfully");
    } catch (error) {
      console.error("Error setting default agent:", error);
      return apiResponse.serverError(res, error instanceof Error ? error.message : "Failed to set default agent");
    }
  });
}
