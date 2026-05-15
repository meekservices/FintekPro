import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { logger } from "./logger";
import { insertUserSchema, users } from "@shared/schema";
import { setupAuth } from "./auth";
import { eq, or, and, sql, desc, ilike } from "drizzle-orm";
import { db } from "./db";
import { emailService } from "./email-service";
import { whatsappService } from "./whatsapp";
import { smsService } from "./services/sms-service";
import { encryptionService } from "./encryption-service";
import { fileURLToPath } from 'url';
import path from 'path';
import multer from 'multer';
import fs from 'fs';
import { apiResponse } from "./utils/responses";
import { auditLog } from "./middleware/audit-trail";
import { creditRatingsService } from "./services/credit-ratings-service";
import { symbolMappingService } from "./services/symbol-mapping-service";
import { registerAuditExportRoutes } from "./routes/admin/audit-export-routes";
import { maskEmail, maskMobile } from "./utils/pii-utils";
import usTradingRoutes from "./routes/us-trading";
import agentRoutes from "./agent-routes";
import agentTrackerRoutes from "./routes/agent-tracker";
import { registerAgentCapitalGainPart1Part1Routes } from "./routes/agent-capital-gains-1-1";
import agentRevenueRoutes from "./routes/agent-revenue-routes";
import agentBasketsRoutes from "./routes/agent-baskets";
import agentSipHealthRoutes from "./routes/agent-sip-health";
import agentPortfolioDriftRoutes from "./routes/agent-portfolio-drift";
import agentClientOrdersRoutes from "./routes/agent-client-orders";
import agentMarketAlertsRoutes from "./routes/agent-market-alerts";
import meetingRoutes from "./routes/meeting-bookings-1";
import { registerOrderRoutes } from "./order-routes";
import { taxRoutes } from "./tax-routes";
import { registerKYCVaultRoutes } from "./kyc-vault-routes";
import { registerAppointmentManagementRoutes } from "./routes/appointment-management-routes";
import { setupChatRoutes } from "./routes/chat-routes";
import complianceRoutes from "./compliance-routes";
import amlRoutes from "./aml-routes";
import orderStatusRoutes from "./routes/fixed-income-status-routes";
import aiInvestmentRoutes from "./routes/ai-investment-routes";
import engineHealthRoutes from "./routes/engine-health-check";
import { registerMarketDataRoutes } from "./routes/market-data";
import { registerPlatformStatsRoutes } from "./routes/platform-stats-routes";
import { registerPortalSystemRoutes } from "./routes/portal-system";
import { registerBondsMarketRoutes } from "./routes/bonds-market";
import { registerUserProfileKYCRoutes } from "./routes/user-profile-kyc";
import yieldCurveRoutes from "./routes/yield-curve";
import { registerReportsInlineRoutes } from "./routes/reports-inline";
import adminMutualFundsRouter from "./routes/admin-mutual-funds-routes";
import liveMFDataRouter from "./routes/live-mf-data-routes";
import treasuryCopilotRoutes from "./routes/treasury-copilot-routes";
import treasuryRoutes from "./routes/treasury-routes";
import versionRouter from "./routes/version";
import { registerBankingRoutes } from "./routes/banking";
import prospectWizardRoutes1 from "./routes/agent-prospect-wizard-1";
import prospectWizardRoutes2 from "./routes/agent-prospect-wizard-5-2";
import { registerAgentCapitalGainPart1Part2Routes } from "./routes/agent-capital-gains-1-2";
import { registerAgentCapitalGainPart1Routes } from "./routes/agent-capital-gains-1";
import { registerAgentCapitalGainPart2Part2Routes } from "./routes/agent-capital-gains-2-2";
import { registerAgentAdvisoryPart1Routes } from "./routes/agent-advisory-1";
import { registerAgentAdvisoryPart2Routes } from "./routes/agent-advisory-2";
import { registerAgentAdvisoryPart3Routes } from "./routes/agent-advisory-3";
import { registerAgentProspectAcquisitionPart1Routes } from "./routes/agent-prospect-acquisition-1";
import testerDiagnosticsRoutes from "./routes/tester-diagnostics-routes";
import { Router } from "express";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for file uploads
const storage_config = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage_config,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG, PDF, and Word documents are allowed.'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // setupAuth is now handled in the main index.ts boot sequence Phase 3
  // setupAuth(app);

  // Note: Health check is now handled in Phase 1 of index.ts for immediate availability
  /*
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });
  */

  // Search users API (Admin & Agent)
  app.get("/api/users/search", async (req, res) => {
    if (!req.isAuthenticated()) return apiResponse.unauthorized(res);
    
    try {
      const query = (req.query.q as string || "").trim();
      const roles = (req.query.roles as string || "").split(",").filter(Boolean);
      
      if (!query && roles.length === 0) {
        return apiResponse.badRequest(res, "Search query or role filter is required");
      }

      let whereClause: any;
      
      if (query) {
        whereClause = or(
          ilike(users.userId, `%${query}%`),
          ilike(users.email, `%${query}%`),
          ilike(users.mobile, `%${query}%`),
          ilike(users.firstName, `%${query}%`),
          ilike(users.lastName, `%${query}%`),
          ilike(users.userId, `%${query}%`)
        );
      }

      if (roles.length > 0) {
        const roleClause = sql`${users.roles} ?| array[${sql.raw(roles.map(r => `'${r}'`).join(","))}]`;
        whereClause = whereClause ? and(whereClause, roleClause) : roleClause;
      }

      const results = await db.select({
        id: users.id,
        userId: users.userId,
        email: users.email,
        mobile: users.mobile,
        firstName: users.firstName,
        lastName: users.lastName,
        roles: users.roles,
        isActive: users.isActive
      })
      .from(users)
      .where(whereClause)
      .limit(20);

      const maskedResults = results.map(u => ({
        ...u,
        email: maskEmail(u.email),
        mobile: maskMobile(u.mobile)
      }));

      return apiResponse.success(res, maskedResults);
    } catch (error) {
      console.error("User search error:", error);
      return apiResponse.serverError(res);
    }
  });

  // Basic admin stats
  app.get("/api/admin/stats", async (req, res) => {
    if (!req.isAuthenticated() || !req.user?.roles?.includes('admin')) {
      return apiResponse.unauthorized(res);
    }

    try {
      const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
      const [activeUsers] = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.isActive, true));

      return apiResponse.success(res, {
        totalUsers: Number(userCount.count),
        activeUsers: Number(activeUsers.count),
        systemStatus: "Healthy",
        uptime: process.uptime()
      });
    } catch (error) {
      console.error("Admin stats error:", error);
      return apiResponse.serverError(res);
    }
  });

  // Compliance Audit Export Routes
  registerAuditExportRoutes(app);

  // US Trading & Alpaca Broker Routes
  app.use("/api/us-trading", usTradingRoutes);

  // Business Logic Routes
  app.use("/api/agent", agentRoutes);
  app.use("/api/agent", agentTrackerRoutes);
  registerAgentCapitalGainPart1Part1Routes(app); // Registered to fix /api/agent/activity 404
  app.use("/api/agent", agentRevenueRoutes);
  app.use("/api/agent", agentBasketsRoutes);
  app.use("/api/agent", agentSipHealthRoutes);
  app.use("/api/agent", agentPortfolioDriftRoutes);
  app.use("/api/agent", agentClientOrdersRoutes);
  app.use("/api/agent", agentMarketAlertsRoutes);
  
  // Agent Wizard & Prospect Management Routes
  app.use("/api/agent-wizard", prospectWizardRoutes1);
  app.use("/api/agent-wizard", prospectWizardRoutes2);
  registerAgentCapitalGainPart1Part2Routes(app);
  registerAgentCapitalGainPart1Routes(app);
  registerAgentCapitalGainPart2Part2Routes(app);
  registerAgentAdvisoryPart1Routes(app);
  registerAgentAdvisoryPart2Routes(app);
  registerAgentAdvisoryPart3Routes(app);
  registerAgentProspectAcquisitionPart1Routes(app);
  
  app.use("/api/meetings", meetingRoutes);
  
  // Named export registrations
  registerOrderRoutes(app);
  app.use("/api/tax", taxRoutes);
  registerKYCVaultRoutes(app);
  
  // Chat routes setup
  const chatRouter = Router();
  setupChatRoutes(chatRouter, storage, (req, res, next) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
    next();
  });
  app.use(chatRouter);

  app.use("/api/compliance", complianceRoutes);
  app.use("/api/aml", amlRoutes);
  app.use("/api/fixed-income", orderStatusRoutes);
  app.use("/api/ai-investment", aiInvestmentRoutes);
  app.use("/api/ai/copilot", treasuryCopilotRoutes);
  app.use("/api/treasury", treasuryRoutes);
  app.use("/api/engine", engineHealthRoutes);

  // Missing Production Routes
  registerMarketDataRoutes(app);
  registerPlatformStatsRoutes(app);
  registerPortalSystemRoutes(app);
  registerBondsMarketRoutes(app);
  registerUserProfileKYCRoutes(app);
  registerBankingRoutes(app);
  app.use(versionRouter);
  app.use("/api/bonds/yield-curve", yieldCurveRoutes);

  // Specialized registrations
  registerAppointmentManagementRoutes(app);
  registerReportsInlineRoutes(app);
  app.use("/api/admin/mutual-funds", adminMutualFundsRouter);
  app.use("/api/live-mf", liveMFDataRouter);
  app.use("/api/tester/diagnostics", testerDiagnosticsRoutes);

  // Profile Sharing Toggle
  app.patch("/api/user/profile/sharing", async (req, res) => {
    if (!req.isAuthenticated()) return apiResponse.unauthorized(res);
    try {
      const { enabled } = req.body;
      await db.update(users)
        .set({ shareableProfileEnabled: enabled })
        .where(eq(users.id, req.user!.id));
      
      return apiResponse.success(res, { success: true });
    } catch (error) {
      console.error("Profile sharing toggle error:", error);
      return apiResponse.serverError(res);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
