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

export function registerPartnerHierarchyPart1Routes(app: Express) {
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

  // List all partners (admin)
  app.get("/api/partner-hierarchy/partners", requireAdmin, async (req: any, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string || "100"), 500);
      const offset = parseInt(req.query.offset as string || "0");
      const all = await partnerHierarchyService.getAllPartners(limit, offset);
      res.json(all);
    } catch (error: any) {
      console.error("Error fetching partners:", error);
      res.status(500).json({ error: "Failed to fetch partners" });
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
}
