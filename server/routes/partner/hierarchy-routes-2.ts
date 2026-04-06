import type { Express } from "express";
import { z } from "zod";
import { partnerHierarchyService } from "../../services/partner-hierarchy-service";
import { commissionWaterfallEngine } from "../../services/commission-waterfall-engine";
import { partnerAuditService } from "../../services/partner-audit-service";
import { commissionPayoutService } from "../../services/commission-payout-service";
import { partnerStatementService } from "../../services/partner-statement-service";
import { commissionDisputeService } from "../../services/commission-dispute-service";

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

export function registerPartnerHierarchyPart2Routes(app: Express) {
  const requireAdmin = (req: any, res: any, next: any) => {
    if (!req.user) {
      const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === "development" || process.env.REPL_ID;
      if (isDev) {
        req.user = { id: "central-test-user", roles: ["superadmin", "admin", "partner", "agent", "client", "user", "tester"], firstName: "Test", lastName: "SuperUser", email: "test@fintekpro.com" };
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
        req.user = { id: "central-test-user", roles: ["superadmin", "admin", "partner", "agent", "client", "user", "tester"], firstName: "Test", lastName: "SuperUser", email: "test@fintekpro.com" };
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

  // === PARTNER PAYOUT STATEMENT API ===
  app.get("/api/partner-hierarchy/payout-statement/:partnerId", requirePartnerOrAdmin, async (req: any, res) => {
    try {
      const { from_date, to_date, group_by } = req.query;
      const statement = await partnerStatementService.getPayoutStatement(req.params.partnerId, {
        fromDate: from_date as string,
        toDate: to_date as string,
        groupBy: (group_by as 'transaction' | 'day' | 'month') || 'transaction',
      });

      res.json(statement);
    } catch (error: any) {
      console.error("Error fetching payout statement:", error);
      res.status(500).json({ error: "Failed to fetch payout statement" });
    }
  });

  // === COMMISSION DISPUTE & REVERSAL ENGINE ===
  const disputeSchema = z.object({
    transactionId: z.string().min(1),
    reasonCode: z.string().min(1),
    description: z.string().optional(),
  });

  app.post("/api/commission/dispute", requirePartnerOrAdmin, async (req: any, res) => {
    try {
      const parsed = disputeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const partnerId = req.user.partnerId || req.user.id;
      const result = await commissionDisputeService.createDispute({
        transactionId: parsed.data.transactionId,
        raisedByPartnerId: partnerId,
        reasonCode: parsed.data.reasonCode,
        description: parsed.data.description,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.status(201).json(result.dispute);
    } catch (error: any) {
      console.error("Error creating dispute:", error);
      res.status(500).json({ error: "Failed to create dispute" });
    }
  });

  app.get("/api/commission/disputes", requirePartnerOrAdmin, async (req: any, res) => {
    try {
      const isAdmin = req.user.roles?.includes("admin") || req.user.roles?.includes("superadmin");
      const filters: any = {};

      if (!isAdmin) {
        filters.partnerId = req.user.partnerId || req.user.id;
      } else {
        if (req.query.partner_id) filters.partnerId = req.query.partner_id;
      }

      if (req.query.status) filters.status = req.query.status;
      if (req.query.transaction_id) filters.transactionId = req.query.transaction_id;
      if (req.query.limit) filters.limit = parseInt(req.query.limit as string);

      const disputes = await commissionDisputeService.getDisputes(filters);
      res.json(disputes);
    } catch (error: any) {
      console.error("Error fetching disputes:", error);
      res.status(500).json({ error: "Failed to fetch disputes" });
    }
  });

  app.get("/api/commission/dispute/:disputeId", requirePartnerOrAdmin, async (req: any, res) => {
    try {
      const dispute = await commissionDisputeService.getDisputeById(req.params.disputeId);
      if (!dispute) {
        return res.status(404).json({ error: "Dispute not found" });
      }

      const isAdmin = req.user.roles?.includes("admin") || req.user.roles?.includes("superadmin");
      const partnerId = req.user.partnerId || req.user.id;
      if (!isAdmin && dispute.raisedByPartnerId !== partnerId) {
        return res.status(403).json({ error: "Not authorized to view this dispute" });
      }

      res.json(dispute);
    } catch (error: any) {
      console.error("Error fetching dispute:", error);
      res.status(500).json({ error: "Failed to fetch dispute" });
    }
  });

  const updateDisputeSchema = z.object({
    status: z.enum(["UNDER_REVIEW", "RESOLVED", "REJECTED"]),
    resolutionNotes: z.string().optional(),
  });

  app.patch("/api/commission/dispute/:disputeId", requireAdmin, async (req: any, res) => {
    try {
      const parsed = updateDisputeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const result = await commissionDisputeService.updateDisputeStatus(
        req.params.disputeId,
        parsed.data.status,
        req.user.id,
        parsed.data.resolutionNotes,
      );

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json({ success: true, message: `Dispute status updated to ${parsed.data.status}` });
    } catch (error: any) {
      console.error("Error updating dispute:", error);
      res.status(500).json({ error: "Failed to update dispute" });
    }
  });

  const reversalSchema = z.object({
    transactionId: z.string().min(1),
    partnerId: z.string().min(1),
    disputeId: z.string().optional(),
  });

  app.post("/api/commission/reversal", requireAdmin, async (req: any, res) => {
    try {
      const parsed = reversalSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const result = await commissionDisputeService.processReversal({
        transactionId: parsed.data.transactionId,
        partnerId: parsed.data.partnerId,
        disputeId: parsed.data.disputeId,
        processedBy: req.user.id,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json({ success: true, reversals: result.reversals });
    } catch (error: any) {
      console.error("Error processing reversal:", error);
      res.status(500).json({ error: "Failed to process reversal" });
    }
  });

  app.get("/api/commission/reversals/:transactionId", requirePartnerOrAdmin, async (req: any, res) => {
    try {
      const reversals = await commissionDisputeService.getReversals(req.params.transactionId);
      res.json(reversals);
    } catch (error: any) {
      console.error("Error fetching reversals:", error);
      res.status(500).json({ error: "Failed to fetch reversals" });
    }
  });

  console.log("✅ Partner Hierarchy routes registered");
  console.log("✅ Progressive Payout Engine routes registered");
  console.log("✅ Payout Statement & Dispute/Reversal routes registered");
}
