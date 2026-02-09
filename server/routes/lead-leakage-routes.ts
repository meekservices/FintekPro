import { Express, Request, Response } from "express";
import { z } from "zod";
import { leadRegistryService } from "../services/lead-registry-service";
import { payoutClaimService } from "../services/payout-claim-service";
import { bankerConfirmationService } from "../services/banker-confirmation-service";

const requireAuth = (req: any, res: Response, next: any) => {
  if (!req.user) return res.status(401).json({ error: "Authentication required" });
  next();
};
const requireAdmin = (req: any, res: Response, next: any) => {
  if (!req.user || !['admin', 'superadmin'].includes(req.user.role))
    return res.status(403).json({ error: "Admin access required" });
  next();
};
const requireAgentOrPartner = (req: any, res: Response, next: any) => {
  if (!req.user || !['agent', 'partner', 'admin', 'superadmin'].includes(req.user.role))
    return res.status(403).json({ error: "Agent or partner access required" });
  next();
};

const registerLeadSchema = z.object({
  pan: z.string().length(10).toUpperCase(),
  mobile: z.string().min(10).max(15),
  customerName: z.string().min(1),
  loanType: z.string().min(1),
  approxAmount: z.number().optional(),
});

const processingModeSchema = z.object({
  mode: z.enum(['PLATFORM', 'EXTERNAL_FINANCIER']),
});

const financierSchema = z.object({
  financierName: z.string().min(1),
  bankerName: z.string().min(1),
  bankerMobile: z.string().min(1),
  bankerEmail: z.string().email(),
});

const statusSchema = z.object({
  status: z.enum(['LOGGED_IN', 'APPROVED', 'DISBURSED']),
});

const submitClaimSchema = z.object({
  leadId: z.string().min(1),
  disbursementAmount: z.number(),
  disbursementDate: z.string().min(1),
  loanAccountNumber: z.string().optional(),
  financierName: z.string().min(1),
  pddStatus: z.enum(['NOT_APPLICABLE', 'PENDING', 'CLEARED']),
  pddExceptionAllowedByFinancier: z.boolean().optional(),
  subventionFlag: z.boolean().optional(),
  teamCase: z.boolean().optional(),
  teamMembers: z.array(z.any()).optional(),
  transactionStatus: z.string().optional(),
});

const proofSchema = z.object({
  fileName: z.string().min(1),
  fileType: z.string().min(1),
  fileSize: z.number(),
  fileHash: z.string().min(1),
  storagePath: z.string().min(1),
});

const bankerConfirmationSchema = z.object({
  bankerEmail: z.string().email(),
  seniorEmail: z.string().email().optional(),
  ccAdminEmail: z.string().email().optional(),
  emailSubject: z.string().min(1),
  emailBody: z.string().min(1),
});

const confirmBankerReplySchema = z.object({
  emailContent: z.string().optional(),
});

const reasonSchema = z.object({
  reason: z.string().min(10),
});

export function registerLeadLeakageRoutes(app: Express) {

  // 1. POST /api/leads/register
  app.post("/api/leads/register", requireAgentOrPartner, async (req: any, res: Response) => {
    try {
      const parsed = registerLeadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }
      const result = await leadRegistryService.registerLead({
        ...parsed.data,
        approxAmount: parsed.data.approxAmount?.toString(),
        agentId: req.user.id,
        partnerId: req.user.partnerId || req.user.id,
        ipAddress: req.ip,
      });
      res.status(201).json(result);
    } catch (error: any) {
      console.error("Error registering lead:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // 2. POST /api/leads/:leadId/processing-mode
  app.post("/api/leads/:leadId/processing-mode", requireAgentOrPartner, async (req: any, res: Response) => {
    try {
      const parsed = processingModeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }
      const result = await leadRegistryService.setProcessingMode(
        req.params.leadId, parsed.data.mode, req.user.id, req.ip
      );
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      res.status(200).json(result);
    } catch (error: any) {
      console.error("Error setting processing mode:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // 3. POST /api/leads/:leadId/financier
  app.post("/api/leads/:leadId/financier", requireAgentOrPartner, async (req: any, res: Response) => {
    try {
      const parsed = financierSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }
      const result = await leadRegistryService.setFinancierDetails(
        req.params.leadId, parsed.data, req.user.id, req.ip
      );
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      res.status(200).json(result);
    } catch (error: any) {
      console.error("Error setting financier details:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // 4. POST /api/leads/:leadId/status
  app.post("/api/leads/:leadId/status", requireAgentOrPartner, async (req: any, res: Response) => {
    try {
      const parsed = statusSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }
      const result = await leadRegistryService.updateStatus(
        req.params.leadId, parsed.data.status, req.user.id, req.user.role, req.ip
      );
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      res.status(200).json(result);
    } catch (error: any) {
      console.error("Error updating lead status:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // 5. GET /api/leads
  app.get("/api/leads", requireAgentOrPartner, async (req: any, res: Response) => {
    try {
      let leads;
      if (req.user.role === 'agent') {
        leads = await leadRegistryService.getLeadsByAgent(req.user.id);
      } else {
        leads = await leadRegistryService.getLeadsByPartner(req.user.partnerId || req.user.id);
      }
      res.json(leads);
    } catch (error: any) {
      console.error("Error fetching leads:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // 6. GET /api/leads/:leadId
  app.get("/api/leads/:leadId", requireAuth, async (req: any, res: Response) => {
    try {
      const lead = await leadRegistryService.getLeadById(req.params.leadId);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      res.json(lead);
    } catch (error: any) {
      console.error("Error fetching lead:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // 7. POST /api/payout-claims
  app.post("/api/payout-claims", requireAgentOrPartner, async (req: any, res: Response) => {
    try {
      const parsed = submitClaimSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }
      const result = await payoutClaimService.submitClaim({
        ...parsed.data,
        disbursementAmount: parsed.data.disbursementAmount.toString(),
        agentId: req.user.id,
        partnerId: req.user.partnerId || req.user.id,
      });
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      if (result.claim) {
        bankerConfirmationService.triggerBankerConfirmation(result.claim.claimId).catch(err => {
          console.error("Failed to trigger banker confirmation email:", err);
        });
      }
      res.status(201).json(result);
    } catch (error: any) {
      console.error("Error submitting payout claim:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // 8. POST /api/payout-claims/:claimId/proof
  app.post("/api/payout-claims/:claimId/proof", requireAuth, async (req: any, res: Response) => {
    try {
      const parsed = proofSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }
      const result = await payoutClaimService.addProof(req.params.claimId, {
        ...parsed.data,
        uploaderRole: req.user.role,
        uploaderId: req.user.id,
      });
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      res.status(201).json(result);
    } catch (error: any) {
      console.error("Error adding proof:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // 9. POST /api/payout-claims/:claimId/banker-confirmation
  app.post("/api/payout-claims/:claimId/banker-confirmation", requireAdmin, async (req: any, res: Response) => {
    try {
      const parsed = bankerConfirmationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }
      const result = await payoutClaimService.sendBankerConfirmation(req.params.claimId, parsed.data);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      res.status(201).json(result);
    } catch (error: any) {
      console.error("Error sending banker confirmation:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // 10. POST /api/payout-claims/:claimId/confirm-banker-reply
  app.post("/api/payout-claims/:claimId/confirm-banker-reply", requireAdmin, async (req: any, res: Response) => {
    try {
      const parsed = confirmBankerReplySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }
      const result = await payoutClaimService.adminConfirmBankerReply(
        req.params.claimId, req.user.id, parsed.data.emailContent
      );
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      res.status(200).json(result);
    } catch (error: any) {
      console.error("Error confirming banker reply:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // 11. POST /api/payout-claims/:claimId/pdd-clearance
  app.post("/api/payout-claims/:claimId/pdd-clearance", requireAdmin, async (req: any, res: Response) => {
    try {
      const result = await payoutClaimService.confirmPddClearance(
        req.params.claimId, req.user.id, req.ip
      );
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      res.status(200).json(result);
    } catch (error: any) {
      console.error("Error confirming PDD clearance:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // 12. POST /api/payout-claims/:claimId/reject
  app.post("/api/payout-claims/:claimId/reject", requireAdmin, async (req: any, res: Response) => {
    try {
      const parsed = reasonSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }
      const result = await payoutClaimService.rejectClaim(
        req.params.claimId, req.user.id, parsed.data.reason
      );
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      res.status(200).json(result);
    } catch (error: any) {
      console.error("Error rejecting claim:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // 13. POST /api/payout-claims/:claimId/clawback
  app.post("/api/payout-claims/:claimId/clawback", requireAdmin, async (req: any, res: Response) => {
    try {
      const parsed = reasonSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }
      const result = await payoutClaimService.executeClawback(
        req.params.claimId, req.user.id, parsed.data.reason
      );
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      res.status(200).json(result);
    } catch (error: any) {
      console.error("Error executing clawback:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // 14. GET /api/payout-claims
  app.get("/api/payout-claims", requireAuth, async (req: any, res: Response) => {
    try {
      const { status, agentId } = req.query;
      let claims;
      if (req.user.role === 'agent') {
        claims = await payoutClaimService.getClaimsByAgent(req.user.id);
      } else if (['admin', 'superadmin'].includes(req.user.role) && status) {
        claims = await payoutClaimService.getClaimsByStatus(status as string);
      } else if (['admin', 'superadmin'].includes(req.user.role) && agentId) {
        claims = await payoutClaimService.getClaimsByAgent(agentId as string);
      } else {
        claims = await payoutClaimService.getClaimsByAgent(req.user.id);
      }
      res.json(claims);
    } catch (error: any) {
      console.error("Error fetching payout claims:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // 15. GET /api/payout-claims/:claimId
  app.get("/api/payout-claims/:claimId", requireAuth, async (req: any, res: Response) => {
    try {
      const claim = await payoutClaimService.getClaimById(req.params.claimId);
      if (!claim) {
        return res.status(404).json({ error: "Claim not found" });
      }
      const proofs = await payoutClaimService.getProofsByClaimId(req.params.claimId);
      res.json({ ...claim, proofs });
    } catch (error: any) {
      console.error("Error fetching payout claim:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // 16. GET /api/payout-claims/:claimId/proofs
  app.get("/api/payout-claims/:claimId/proofs", requireAuth, async (req: any, res: Response) => {
    try {
      const proofs = await payoutClaimService.getProofsByClaimId(req.params.claimId);
      res.json(proofs);
    } catch (error: any) {
      console.error("Error fetching proofs:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // 17. GET /api/leads/:leadId/audit-trail
  app.get("/api/leads/:leadId/audit-trail", requireAuth, async (req: any, res: Response) => {
    try {
      const logs = await payoutClaimService.getAuditLogs(req.params.leadId);
      res.json(logs);
    } catch (error: any) {
      console.error("Error fetching audit trail:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}
