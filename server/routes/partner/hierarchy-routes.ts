import type { Express } from "express";
import { z } from "zod";
import { partnerHierarchyService } from "../../services/partner-hierarchy-service";
import { commissionWaterfallEngine } from "../../services/commission-waterfall-engine";
import { partnerAuditService } from "../../services/partner-audit-service";
import { commissionPayoutService } from "../../services/commission-payout-service";

const createPartnerSchema = z.object({
  companyName: z.string().min(1),
  contactEmail: z.string().email(),
  contactPhone: z.string().optional(),
  password: z.string().min(8),
  partnerType: z.string().optional(),
  parentPartnerId: z.string().optional(),
});

const approvePartnerSchema = z.object({
  partnerId: z.string().min(1),
});

const rejectPartnerSchema = z.object({
  partnerId: z.string().min(1),
  reason: z.string().optional(),
});

const kycUpdateSchema = z.object({
  partnerId: z.string().min(1),
  status: z.enum(["PENDING", "VERIFIED", "REJECTED"]),
});

const clientOwnershipSchema = z.object({
  clientId: z.string().min(1),
  ownerPartnerId: z.string().min(1),
});

const overrideOwnershipSchema = z.object({
  clientId: z.string().min(1),
  newOwnerId: z.string().min(1),
  reason: z.string().min(1),
});

const commissionRuleSchema = z.object({
  productType: z.string().min(1),
  agentPct: z.number().min(0).max(100),
  subPartnerPct: z.number().min(0).max(100),
  masterPartnerPct: z.number().min(0).max(100),
  platformPct: z.number().min(0).max(100),
});

const processCommissionSchema = z.object({
  transactionId: z.string().min(1),
  orderId: z.string().optional(),
  productType: z.string().min(1),
  transactionAmount: z.number().positive(),
  sellingPartnerId: z.string().min(1),
});

const auditQuerySchema = z.object({
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  actorId: z.string().optional(),
  action: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  limit: z.coerce.number().optional(),
  offset: z.coerce.number().optional(),
});

export function registerPartnerHierarchyRoutes(app: Express) {
  const requireAdmin = (req: any, res: any, next: any) => {
    if (!req.user) {
      const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === "development" || process.env.REPL_ID;
      if (isDev) {
        req.user = { id: "admin-dev-1", roles: ["admin"], firstName: "Dev", lastName: "Admin", email: "admin@fintekpro.com" };
      } else {
        return res.status(401).json({ error: "Authentication required" });
      }
    }
    const isAdmin = req.user.roles?.includes("admin") || req.user.roles?.includes("superadmin");
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  };

  const requirePartnerOrAdmin = (req: any, res: any, next: any) => {
    if (!req.user) {
      const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === "development" || process.env.REPL_ID;
      if (isDev) {
        req.user = { id: "partner-dev-1", roles: ["partner"], firstName: "Dev", lastName: "Partner", email: "partner@fintekpro.com" };
      } else {
        return res.status(401).json({ error: "Authentication required" });
      }
    }
    const hasAccess = req.user.roles?.includes("partner") ||
                      req.user.roles?.includes("admin") ||
                      req.user.roles?.includes("superadmin");
    if (!hasAccess) {
      return res.status(403).json({ error: "Partner or admin access required" });
    }
    next();
  };

  // === TICKET 2: Partner Creation API ===
  app.post("/api/partner-hierarchy/partners", requirePartnerOrAdmin, async (req: any, res) => {
    try {
      const parsed = createPartnerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const data = parsed.data;
      const creatorId = req.user.id;
      const creatorLevel = req.user.partnerLevel;

      const result = await partnerHierarchyService.createPartner({
        ...data,
        creatorId,
        creatorLevel,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      await partnerAuditService.logPartnerCreation(
        creatorId, result.partner.id, result.partner, req.ip
      );

      res.status(201).json(result.partner);
    } catch (error: any) {
      console.error("Error creating partner:", error);
      res.status(500).json({ error: "Failed to create partner" });
    }
  });

  // === TICKET 3: Partner Approval ===
  app.post("/api/partner-hierarchy/partners/approve", requireAdmin, async (req: any, res) => {
    try {
      const parsed = approvePartnerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const result = await partnerHierarchyService.approvePartner(parsed.data.partnerId, req.user.id);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      await partnerAuditService.logPartnerApproval(req.user.id, parsed.data.partnerId, req.ip);
      res.json({ success: true, message: "Partner approved" });
    } catch (error: any) {
      console.error("Error approving partner:", error);
      res.status(500).json({ error: "Failed to approve partner" });
    }
  });

  // Partner Rejection
  app.post("/api/partner-hierarchy/partners/reject", requireAdmin, async (req: any, res) => {
    try {
      const parsed = rejectPartnerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const result = await partnerHierarchyService.rejectPartner(parsed.data.partnerId, req.user.id, parsed.data.reason);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      await partnerAuditService.logPartnerRejection(req.user.id, parsed.data.partnerId, parsed.data.reason, req.ip);
      res.json({ success: true, message: "Partner rejected" });
    } catch (error: any) {
      console.error("Error rejecting partner:", error);
      res.status(500).json({ error: "Failed to reject partner" });
    }
  });

  // KYC Status Update
  app.post("/api/partner-hierarchy/partners/kyc", requireAdmin, async (req: any, res) => {
    try {
      const parsed = kycUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const partner = await partnerHierarchyService.getPartnerById(parsed.data.partnerId);
      const oldStatus = partner?.kycStatus || "UNKNOWN";

      const result = await partnerHierarchyService.updateKycStatus(parsed.data.partnerId, parsed.data.status);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      await partnerAuditService.logKycUpdate(req.user.id, parsed.data.partnerId, oldStatus, parsed.data.status, req.ip);
      res.json({ success: true, message: `KYC status updated to ${parsed.data.status}` });
    } catch (error: any) {
      console.error("Error updating KYC:", error);
      res.status(500).json({ error: "Failed to update KYC status" });
    }
  });

  // Suspend Partner
  app.post("/api/partner-hierarchy/partners/:partnerId/suspend", requireAdmin, async (req: any, res) => {
    try {
      const result = await partnerHierarchyService.suspendPartner(req.params.partnerId);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      await partnerAuditService.logPartnerSuspension(req.user.id, req.params.partnerId, req.ip);
      res.json({ success: true, message: "Partner suspended" });
    } catch (error: any) {
      console.error("Error suspending partner:", error);
      res.status(500).json({ error: "Failed to suspend partner" });
    }
  });

  // Terminate Partner
  app.post("/api/partner-hierarchy/partners/:partnerId/terminate", requireAdmin, async (req: any, res) => {
    try {
      const result = await partnerHierarchyService.terminatePartner(req.params.partnerId);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      await partnerAuditService.logPartnerTermination(req.user.id, req.params.partnerId, req.ip);
      res.json({ success: true, message: "Partner terminated" });
    } catch (error: any) {
      console.error("Error terminating partner:", error);
      res.status(500).json({ error: "Failed to terminate partner" });
    }
  });

  // Get pending approvals
  app.get("/api/partner-hierarchy/partners/pending", requireAdmin, async (req: any, res) => {
    try {
      const pending = await partnerHierarchyService.getPendingApprovals();
      res.json(pending);
    } catch (error: any) {
      console.error("Error fetching pending approvals:", error);
      res.status(500).json({ error: "Failed to fetch pending approvals" });
    }
  });

  // Get partner by ID
  app.get("/api/partner-hierarchy/partners/:partnerId", requirePartnerOrAdmin, async (req: any, res) => {
    try {
      const partner = await partnerHierarchyService.getPartnerById(req.params.partnerId);
      if (!partner) {
        return res.status(404).json({ error: "Partner not found" });
      }
      res.json(partner);
    } catch (error: any) {
      console.error("Error fetching partner:", error);
      res.status(500).json({ error: "Failed to fetch partner" });
    }
  });

  // === TICKET 7: Downline Visibility API ===
  app.get("/api/partner-hierarchy/partners/:partnerId/downline", requirePartnerOrAdmin, async (req: any, res) => {
    try {
      const isAdmin = req.user.roles?.includes("admin") || req.user.roles?.includes("superadmin");
      const maskPII = !isAdmin;
      const downline = await partnerHierarchyService.getDownline(req.params.partnerId, maskPII);
      res.json(downline);
    } catch (error: any) {
      console.error("Error fetching downline:", error);
      res.status(500).json({ error: "Failed to fetch downline" });
    }
  });

  // Get partner tree (ancestors)
  app.get("/api/partner-hierarchy/partners/:partnerId/tree", requirePartnerOrAdmin, async (req: any, res) => {
    try {
      const tree = await partnerHierarchyService.getPartnerTree(req.params.partnerId);
      res.json(tree);
    } catch (error: any) {
      console.error("Error fetching partner tree:", error);
      res.status(500).json({ error: "Failed to fetch partner tree" });
    }
  });

  // === TICKET 4: Client Ownership ===
  app.post("/api/partner-hierarchy/client-ownership", requirePartnerOrAdmin, async (req: any, res) => {
    try {
      const parsed = clientOwnershipSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const result = await partnerHierarchyService.assignClientOwnership(parsed.data.clientId, parsed.data.ownerPartnerId);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json({ success: true, message: "Client ownership assigned" });
    } catch (error: any) {
      console.error("Error assigning ownership:", error);
      res.status(500).json({ error: "Failed to assign client ownership" });
    }
  });

  // Admin override of client ownership
  app.post("/api/partner-hierarchy/client-ownership/override", requireAdmin, async (req: any, res) => {
    try {
      const parsed = overrideOwnershipSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const oldOwnership = await partnerHierarchyService.getClientOwnership(parsed.data.clientId);
      const oldOwnerId = oldOwnership?.ownerPartnerId || "NONE";

      const result = await partnerHierarchyService.overrideClientOwnership(
        parsed.data.clientId, parsed.data.newOwnerId, req.user.id, parsed.data.reason
      );
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      await partnerAuditService.logClientReassignment(
        req.user.id, parsed.data.clientId, oldOwnerId, parsed.data.newOwnerId, parsed.data.reason, req.ip
      );

      res.json({ success: true, message: "Client ownership overridden" });
    } catch (error: any) {
      console.error("Error overriding ownership:", error);
      res.status(500).json({ error: "Failed to override client ownership" });
    }
  });

  // Get client ownership
  app.get("/api/partner-hierarchy/client-ownership/:clientId", requirePartnerOrAdmin, async (req: any, res) => {
    try {
      const ownership = await partnerHierarchyService.getClientOwnership(req.params.clientId);
      if (!ownership) {
        return res.status(404).json({ error: "No ownership record found" });
      }
      res.json(ownership);
    } catch (error: any) {
      console.error("Error fetching ownership:", error);
      res.status(500).json({ error: "Failed to fetch client ownership" });
    }
  });

  // === TICKET 5: Commission Rules ===
  app.post("/api/partner-hierarchy/commission-rules", requireAdmin, async (req: any, res) => {
    try {
      const parsed = commissionRuleSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const result = await commissionWaterfallEngine.createCommissionRule({
        ...parsed.data,
        createdBy: req.user.id,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.status(201).json(result.rule);
    } catch (error: any) {
      console.error("Error creating commission rule:", error);
      res.status(500).json({ error: "Failed to create commission rule" });
    }
  });

  app.get("/api/partner-hierarchy/commission-rules", requirePartnerOrAdmin, async (req: any, res) => {
    try {
      const rules = await commissionWaterfallEngine.getCommissionRules();
      res.json(rules);
    } catch (error: any) {
      console.error("Error fetching commission rules:", error);
      res.status(500).json({ error: "Failed to fetch commission rules" });
    }
  });

  app.patch("/api/partner-hierarchy/commission-rules/:ruleId", requireAdmin, async (req: any, res) => {
    try {
      const result = await commissionWaterfallEngine.updateCommissionRule(req.params.ruleId, req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      await partnerAuditService.logCommissionOverride(req.user.id, req.params.ruleId, req.body, req.ip);
      res.json({ success: true, message: "Commission rule updated" });
    } catch (error: any) {
      console.error("Error updating commission rule:", error);
      res.status(500).json({ error: "Failed to update commission rule" });
    }
  });

  // === TICKET 5: Process Commission (Waterfall) ===
  app.post("/api/partner-hierarchy/commission/process", requireAdmin, async (req: any, res) => {
    try {
      const parsed = processCommissionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }

      // TICKET 9: Anti-MLM check
      const antiMLM = commissionWaterfallEngine.validateAntiMLM(parsed.data.productType);
      if (!antiMLM.valid) {
        return res.status(400).json({ error: antiMLM.error });
      }

      const result = await commissionWaterfallEngine.processCommission(parsed.data);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json({ success: true, ledgerEntries: result.ledgerEntries });
    } catch (error: any) {
      console.error("Error processing commission:", error);
      res.status(500).json({ error: "Failed to process commission" });
    }
  });

  // === TICKET 6: Wallet Endpoints ===
  app.get("/api/partner-hierarchy/wallet/:partnerId", requirePartnerOrAdmin, async (req: any, res) => {
    try {
      const wallet = await commissionWaterfallEngine.getWallet(req.params.partnerId);
      res.json(wallet);
    } catch (error: any) {
      console.error("Error fetching wallet:", error);
      res.status(500).json({ error: "Failed to fetch wallet" });
    }
  });

  app.get("/api/partner-hierarchy/ledger/:partnerId", requirePartnerOrAdmin, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const entries = await commissionWaterfallEngine.getLedgerEntries(req.params.partnerId, limit);
      res.json(entries);
    } catch (error: any) {
      console.error("Error fetching ledger:", error);
      res.status(500).json({ error: "Failed to fetch ledger entries" });
    }
  });

  // Manual payout (debit wallet)
  app.post("/api/partner-hierarchy/wallet/:partnerId/payout", requireAdmin, async (req: any, res) => {
    try {
      const amount = parseFloat(req.body.amount);
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Invalid payout amount" });
      }

      // Check KYC before payout
      const partner = await partnerHierarchyService.getPartnerById(req.params.partnerId);
      if (!partner) {
        return res.status(404).json({ error: "Partner not found" });
      }
      if (partner.kycStatus !== "VERIFIED") {
        return res.status(400).json({ error: "Partner KYC must be verified before payout" });
      }

      const result = await commissionWaterfallEngine.debitWallet(req.params.partnerId, amount);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      await partnerAuditService.logManualPayout(req.user.id, req.params.partnerId, amount, req.ip);
      res.json({ success: true, message: `Payout of ${amount} processed` });
    } catch (error: any) {
      console.error("Error processing payout:", error);
      res.status(500).json({ error: "Failed to process payout" });
    }
  });

  // === TICKET 8: Audit Log Endpoints ===
  app.get("/api/partner-hierarchy/audit-logs", requireAdmin, async (req: any, res) => {
    try {
      const parsed = auditQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid query parameters" });
      }

      const filters: any = { ...parsed.data };
      if (filters.fromDate) filters.fromDate = new Date(filters.fromDate);
      if (filters.toDate) filters.toDate = new Date(filters.toDate);

      const result = await partnerAuditService.getAuditLogs(filters);
      res.json(result);
    } catch (error: any) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  app.get("/api/partner-hierarchy/audit-logs/:entityType/:entityId", requireAdmin, async (req: any, res) => {
    try {
      const trail = await partnerAuditService.getEntityAuditTrail(req.params.entityType, req.params.entityId);
      res.json(trail);
    } catch (error: any) {
      console.error("Error fetching audit trail:", error);
      res.status(500).json({ error: "Failed to fetch audit trail" });
    }
  });

  // === TICKET 10: Hierarchy Integrity Check (on-demand) ===
  app.post("/api/partner-hierarchy/integrity-check", requireAdmin, async (req: any, res) => {
    try {
      const { detectCycles, detectOrphans, detectDepthViolations } = await import("../../services/hierarchy-integrity-validator");
      
      const cycles = await detectCycles();
      const orphans = await detectOrphans();
      const depthViolations = await detectDepthViolations();

      const issues = [...cycles, ...orphans, ...depthViolations];

      for (const issue of issues) {
        await partnerAuditService.log({
          actorId: req.user.id,
          action: "INTEGRITY_ISSUE_DETECTED",
          entityType: "partner_hierarchy",
          entityId: issue.partnerId || "system",
          metadata: issue,
          ipAddress: req.ip,
        });
      }

      res.json({
        totalIssues: issues.length,
        cycles: cycles.length,
        orphans: orphans.length,
        depthViolations: depthViolations.length,
        details: issues,
      });
    } catch (error: any) {
      console.error("Error running integrity check:", error);
      res.status(500).json({ error: "Failed to run integrity check" });
    }
  });

  // === PROGRESSIVE PAYOUT ENGINE: Commission Config CRUD ===
  const commissionConfigSchema = z.object({
    productType: z.string().min(1),
    agentPct: z.number().min(0).max(99),
    platformPct: z.number().min(0).max(99),
    uplineIncentivePct: z.number().min(0).max(100),
    minResidualThreshold: z.number().min(0).optional(),
  });

  app.post("/api/partner-hierarchy/payout-config", requireAdmin, async (req: any, res) => {
    try {
      const parsed = commissionConfigSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const result = await commissionPayoutService.createConfig(parsed.data);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      await partnerAuditService.log({
        actorId: req.user.id,
        action: "PAYOUT_CONFIG_CREATED",
        entityType: "commission_config",
        entityId: result.config.configId,
        metadata: parsed.data,
        ipAddress: req.ip,
      });

      res.status(201).json(result.config);
    } catch (error: any) {
      console.error("Error creating payout config:", error);
      res.status(500).json({ error: "Failed to create payout config" });
    }
  });

  app.get("/api/partner-hierarchy/payout-config", requirePartnerOrAdmin, async (req: any, res) => {
    try {
      const configs = await commissionPayoutService.getConfigs();
      res.json(configs);
    } catch (error: any) {
      console.error("Error fetching payout configs:", error);
      res.status(500).json({ error: "Failed to fetch payout configs" });
    }
  });

  app.get("/api/partner-hierarchy/payout-config/:productType", requirePartnerOrAdmin, async (req: any, res) => {
    try {
      const config = await commissionPayoutService.getConfigByProduct(req.params.productType);
      if (!config) {
        return res.status(404).json({ error: "No active config for this product type" });
      }
      res.json(config);
    } catch (error: any) {
      console.error("Error fetching payout config:", error);
      res.status(500).json({ error: "Failed to fetch payout config" });
    }
  });

  // === PROGRESSIVE PAYOUT ENGINE: Process Transaction ===
  const processPayoutSchema = z.object({
    transactionId: z.string().min(1),
    grossCommission: z.number().positive(),
    productType: z.string().min(1),
    sellerPartnerId: z.string().min(1),
  });

  app.post("/api/partner-hierarchy/payout/process", requireAdmin, async (req: any, res) => {
    try {
      const parsed = processPayoutSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const result = await commissionPayoutService.processTransaction(parsed.data);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json({ success: true, ledgerEntries: result.ledgerEntries });
    } catch (error: any) {
      console.error("Error processing payout:", error);
      res.status(500).json({ error: "Failed to process payout" });
    }
  });

  // === PROGRESSIVE PAYOUT ENGINE: Ledger Queries ===
  app.get("/api/partner-hierarchy/payout/ledger/transaction/:transactionId", requirePartnerOrAdmin, async (req: any, res) => {
    try {
      const entries = await commissionPayoutService.getLedgerByTransaction(req.params.transactionId);
      res.json(entries);
    } catch (error: any) {
      console.error("Error fetching ledger:", error);
      res.status(500).json({ error: "Failed to fetch ledger entries" });
    }
  });

  app.get("/api/partner-hierarchy/payout/ledger/partner/:partnerId", requirePartnerOrAdmin, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const entries = await commissionPayoutService.getLedgerByPartner(req.params.partnerId, limit);
      res.json(entries);
    } catch (error: any) {
      console.error("Error fetching partner ledger:", error);
      res.status(500).json({ error: "Failed to fetch partner ledger entries" });
    }
  });

  console.log("✅ Partner Hierarchy routes registered");
  console.log("✅ Progressive Payout Engine routes registered");
}
