import { Router } from "express";
import { storage } from "./storage";
import { amfiValidationService } from "./amfi-validation-service";
import { z } from "zod";
import { randomUUID } from "crypto";

const router = Router();

// Middleware: Require authentication
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

// Middleware: Require admin role
const requireAdmin = async (req: any, res: any, next: any) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  const user = await storage.getUser(req.user.id);
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden: Admin access required" });
  }
  
  next();
};

// Helper: Verify agent ownership or admin access
const verifyAgentAccess = async (req: any, agentId: string): Promise<{ allowed: boolean; isAdmin: boolean; error?: string }> => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return { allowed: false, isAdmin: false, error: "Unauthorized" };
  }

  const user = await storage.getUser(req.user.id);
  if (!user) {
    return { allowed: false, isAdmin: false, error: "User not found" };
  }

  // Admins can access any agent
  if (user.role === "admin") {
    return { allowed: true, isAdmin: true };
  }

  // Get agent by ID
  const agent = await storage.getAgentById(agentId);
  if (!agent) {
    return { allowed: false, isAdmin: false, error: "Agent not found" };
  }

  // Check if the authenticated user is the agent owner
  // Assuming agents have a userId field linking to the user account
  if (agent.email === user.email) {
    return { allowed: true, isAdmin: false };
  }

  return { allowed: false, isAdmin: false, error: "Forbidden: You can only access your own agent data" };
};

// Validation schemas
const agentRegistrationSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  arnCode: z.string().regex(/^ARN-\d{5,6}$/i, "Invalid ARN format").optional(),
  euinNumber: z.string().regex(/^E\d{6}$/i, "Invalid EUIN format").optional(),
  agentLevel: z.enum(["master", "sub_agent", "associate"]).optional(),
  masterAgentId: z.string().optional(),
  distributorId: z.string().optional(),
  distributorName: z.string().optional(),
});

const arnValidationSchema = z.object({
  arnCode: z.string().regex(/^ARN-\d{5,6}$/i, "Invalid ARN format"),
});

const euinValidationSchema = z.object({
  euinNumber: z.string().regex(/^E\d{6}$/i, "Invalid EUIN format"),
  arnCode: z.string().regex(/^ARN-\d{5,6}$/i).optional(),
});

const documentUploadSchema = z.object({
  documentType: z.enum(["pan_card", "aadhar_card", "amfi_certificate", "euin_card", "bank_proof", "cancelled_cheque"]),
  documentName: z.string().min(1, "Document name is required"),
  documentUrl: z.string().url("Valid document URL is required"),
  documentNumber: z.string().optional(),
});

const documentVerificationSchema = z.object({
  status: z.enum(["verified", "rejected"]),
  rejectionReason: z.string().optional(),
});

const agentApprovalSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  rejectionReason: z.string().optional(),
});

const commissionSplitSchema = z.object({
  subAgentId: z.string().min(1, "Sub-agent ID is required"),
  masterAgentId: z.string().min(1, "Master agent ID is required"),
  splitModel: z.enum(["percentage", "fixed_amount", "tiered"]).optional(),
  productType: z.string().optional(),
  subAgentShare: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0 && num <= 100;
  }, "Sub-agent share must be between 0 and 100"),
  masterAgentShare: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0 && num <= 100;
  }, "Master agent share must be between 0 and 100"),
});

// Agent Onboarding: Register new agent (public route for self-registration)
router.post("/api/agents/register", async (req, res) => {
  try {
    // Validate request body
    const validation = agentRegistrationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validation.error.errors 
      });
    }

    const { 
      fullName, 
      email, 
      phone, 
      arnCode, 
      euinNumber, 
      agentLevel,
      masterAgentId,
      distributorId,
      distributorName
    } = validation.data;

    // Check if email already exists
    const existingAgent = await storage.getAgentByEmail(email);
    if (existingAgent) {
      return res.status(400).json({ error: "Agent with this email already exists" });
    }

    // Check if ARN already exists
    if (arnCode) {
      const existingArn = await storage.getAgentByArn(arnCode);
      if (existingArn) {
        return res.status(400).json({ error: "ARN code already registered" });
      }
    }

    // Check if EUIN already exists
    if (euinNumber) {
      const existingEuin = await storage.getAgentByEuin(euinNumber);
      if (existingEuin) {
        return res.status(400).json({ error: "EUIN already registered" });
      }
    }

    // If ARN provided, validate it with AMFI
    let arnValidation = null;
    if (arnCode) {
      arnValidation = await amfiValidationService.validateArn(arnCode);
      if (!arnValidation.isValid) {
        return res.status(400).json({ 
          error: "Invalid ARN code", 
          details: arnValidation.errorMessage 
        });
      }
    }

    // If EUIN provided, validate it with AMFI
    let euinValidation = null;
    if (euinNumber) {
      euinValidation = await amfiValidationService.validateEuin(euinNumber, arnCode);
      if (!euinValidation.isValid) {
        return res.status(400).json({ 
          error: "Invalid EUIN number", 
          details: euinValidation.errorMessage 
        });
      }
    }

    // Create agent record
    const agentData = {
      fullName,
      email,
      phone,
      arnCode,
      euinNumber,
      distributorId,
      distributorName: distributorName || (arnValidation?.distributorDetails?.distributorName),
      agentLevel: agentLevel || "master",
      masterAgentId,
      arnVerificationStatus: arnValidation?.isValid ? "verified" : "pending",
      euinVerificationStatus: euinValidation?.isValid ? "verified" : "pending",
      onboardingStatus: "pending",
      status: "active",
      amfiVerificationResponse: {
        arn: arnValidation,
        euin: euinValidation
      },
      arnExpiryDate: arnValidation?.distributorDetails?.arnExpiryDate,
      amfiVerifiedAt: (arnValidation?.isValid || euinValidation?.isValid) ? new Date() : null,
    };

    const agent = await storage.createCustomerCareAgent(agentData as any);

    // Log AMFI verification
    if (arnCode) {
      await storage.createAmfiVerificationLog({
        agentId: agent.id,
        verificationType: "arn_verification",
        arnCode,
        apiRequest: { arnCode },
        apiResponse: arnValidation,
        verificationStatus: arnValidation?.status || "failed",
        errorMessage: arnValidation?.errorMessage,
        distributorName: arnValidation?.distributorDetails?.distributorName,
        distributorStatus: arnValidation?.distributorDetails?.distributorStatus,
        arnExpiryDate: arnValidation?.distributorDetails?.arnExpiryDate,
        registrationDate: arnValidation?.distributorDetails?.registrationDate,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      });
    }

    if (euinNumber) {
      await storage.createAmfiVerificationLog({
        agentId: agent.id,
        verificationType: "euin_verification",
        euinNumber,
        apiRequest: { euinNumber, arnCode },
        apiResponse: euinValidation,
        verificationStatus: euinValidation?.status || "failed",
        errorMessage: euinValidation?.errorMessage,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      });
    }

    res.json({ 
      success: true, 
      agent: {
        id: agent.id,
        fullName: agent.fullName,
        email: agent.email,
        arnCode: agent.arnCode,
        euinNumber: agent.euinNumber,
        onboardingStatus: agent.onboardingStatus,
        arnVerificationStatus: agent.arnVerificationStatus,
        euinVerificationStatus: agent.euinVerificationStatus,
      }
    });
  } catch (error) {
    console.error("Agent registration error:", error);
    res.status(500).json({ error: "Failed to register agent" });
  }
});

// Validate ARN code (public endpoint for pre-validation)
router.post("/api/agents/validate-arn", async (req, res) => {
  try {
    const validation = arnValidationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validation.error.errors 
      });
    }

    const { arnCode } = validation.data;
    const arnValidation = await amfiValidationService.validateArn(arnCode);
    
    res.json({
      isValid: arnValidation.isValid,
      status: arnValidation.status,
      errorMessage: arnValidation.errorMessage,
      distributorDetails: arnValidation.distributorDetails,
    });
  } catch (error) {
    console.error("ARN validation error:", error);
    res.status(500).json({ error: "Failed to validate ARN" });
  }
});

// Validate EUIN number (public endpoint for pre-validation)
router.post("/api/agents/validate-euin", async (req, res) => {
  try {
    const validation = euinValidationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validation.error.errors 
      });
    }

    const { euinNumber, arnCode } = validation.data;
    const euinValidation = await amfiValidationService.validateEuin(euinNumber, arnCode);
    
    res.json({
      isValid: euinValidation.isValid,
      status: euinValidation.status,
      errorMessage: euinValidation.errorMessage,
      euinDetails: euinValidation.euinDetails,
    });
  } catch (error) {
    console.error("EUIN validation error:", error);
    res.status(500).json({ error: "Failed to validate EUIN" });
  }
});

// Upload agent document
router.post("/api/agents/:agentId/documents", requireAuth, async (req, res) => {
  try {
    const { agentId } = req.params;
    
    // Verify ownership or admin access
    const accessCheck = await verifyAgentAccess(req, agentId);
    if (!accessCheck.allowed) {
      return res.status(accessCheck.error === "Unauthorized" ? 401 : 403).json({ error: accessCheck.error });
    }
    
    const validation = documentUploadSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validation.error.errors 
      });
    }

    const { documentType, documentName, documentUrl, documentNumber } = validation.data;

    const document = await storage.uploadAgentDocument({
      agentId,
      documentType,
      documentName,
      documentUrl,
      documentNumber,
      verificationStatus: "pending",
    });

    // Update agent's document verification flags
    const updates: any = {};
    if (documentType === "pan_card") updates.panVerified = false;
    if (documentType === "aadhar_card") updates.aadharVerified = false;
    if (documentType === "amfi_certificate") updates.amfiCertificateVerified = false;
    if (documentType === "euin_card") updates.euinCardVerified = false;

    if (Object.keys(updates).length > 0) {
      await storage.updateAgentVerificationStatus(agentId, updates);
    }

    res.json({ success: true, document });
  } catch (error) {
    console.error("Document upload error:", error);
    res.status(500).json({ error: "Failed to upload document" });
  }
});

// Get agent documents
router.get("/api/agents/:agentId/documents", requireAuth, async (req, res) => {
  try {
    const { agentId } = req.params;
    
    // Verify ownership or admin access
    const accessCheck = await verifyAgentAccess(req, agentId);
    if (!accessCheck.allowed) {
      return res.status(accessCheck.error === "Unauthorized" ? 401 : 403).json({ error: accessCheck.error });
    }
    
    const documents = await storage.getAgentDocuments(agentId);
    res.json({ documents });
  } catch (error) {
    console.error("Get documents error:", error);
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

// Admin: Verify agent document
router.post("/api/admin/agents/documents/:documentId/verify", requireAdmin, async (req, res) => {
  try {
    const { documentId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const validation = documentVerificationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validation.error.errors 
      });
    }

    const { status, rejectionReason } = validation.data;

    const document = await storage.updateAgentDocumentVerification(
      documentId,
      status,
      userId,
      rejectionReason
    );

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Update agent's document verification flags
    const updates: any = {};
    if (document.documentType === "pan_card") updates.panVerified = (status === "verified");
    if (document.documentType === "aadhar_card") updates.aadharVerified = (status === "verified");
    if (document.documentType === "amfi_certificate") updates.amfiCertificateVerified = (status === "verified");
    if (document.documentType === "euin_card") updates.euinCardVerified = (status === "verified");

    if (Object.keys(updates).length > 0) {
      await storage.updateAgentVerificationStatus(document.agentId, updates);
    }

    res.json({ success: true, document });
  } catch (error) {
    console.error("Document verification error:", error);
    res.status(500).json({ error: "Failed to verify document" });
  }
});

// Admin: Approve/reject agent
router.post("/api/admin/agents/:agentId/approve", requireAdmin, async (req, res) => {
  try {
    const { agentId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const validation = agentApprovalSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validation.error.errors 
      });
    }

    const { status, rejectionReason } = validation.data;

    const updates: any = {
      onboardingStatus: status,
      verifiedBy: userId,
      verifiedAt: new Date(),
    };

    if (rejectionReason) {
      updates.rejectionReason = rejectionReason;
    }

    const agent = await storage.updateAgentVerificationStatus(agentId, updates);

    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    res.json({ success: true, agent });
  } catch (error) {
    console.error("Agent approval error:", error);
    res.status(500).json({ error: "Failed to approve/reject agent" });
  }
});

// Get all agents (admin)
router.get("/api/admin/agents", requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    const agents = await storage.getAllAgentsByStatus(status as string);
    res.json({ agents });
  } catch (error) {
    console.error("Get agents error:", error);
    res.status(500).json({ error: "Failed to fetch agents" });
  }
});

// Get agent by ID
router.get("/api/agents/:agentId", requireAuth, async (req, res) => {
  try {
    const { agentId } = req.params;
    
    // Verify ownership or admin access
    const accessCheck = await verifyAgentAccess(req, agentId);
    if (!accessCheck.allowed) {
      return res.status(accessCheck.error === "Unauthorized" ? 401 : 403).json({ error: accessCheck.error });
    }
    
    const agent = await storage.getAgentById(agentId);
    
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    res.json({ agent });
  } catch (error) {
    console.error("Get agent error:", error);
    res.status(500).json({ error: "Failed to fetch agent" });
  }
});

// Get sub-agents for a master agent
router.get("/api/agents/:masterAgentId/sub-agents", requireAuth, async (req, res) => {
  try {
    const { masterAgentId } = req.params;
    
    // Verify ownership or admin access
    const accessCheck = await verifyAgentAccess(req, masterAgentId);
    if (!accessCheck.allowed) {
      return res.status(accessCheck.error === "Unauthorized" ? 401 : 403).json({ error: accessCheck.error });
    }
    
    const subAgents = await storage.getSubAgents(masterAgentId);
    res.json({ subAgents });
  } catch (error) {
    console.error("Get sub-agents error:", error);
    res.status(500).json({ error: "Failed to fetch sub-agents" });
  }
});

// Create commission split rule
router.post("/api/admin/agents/commission-splits", requireAdmin, async (req, res) => {
  try {
    const validation = commissionSplitSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validation.error.errors 
      });
    }

    const {
      subAgentId,
      masterAgentId,
      splitModel,
      productType,
      subAgentShare,
      masterAgentShare,
    } = validation.data;

    // Validate shares add up to 100
    const totalShare = parseFloat(subAgentShare) + parseFloat(masterAgentShare);
    if (Math.abs(totalShare - 100) > 0.01) {
      return res.status(400).json({ error: "Commission shares must add up to 100%" });
    }

    const split = await storage.createCommissionSplit({
      subAgentId,
      masterAgentId,
      splitModel: splitModel || "percentage",
      productType,
      subAgentShare,
      masterAgentShare,
      isActive: true,
    });

    res.json({ success: true, split });
  } catch (error) {
    console.error("Create commission split error:", error);
    res.status(500).json({ error: "Failed to create commission split" });
  }
});

// Get commission splits
router.get("/api/agents/commission-splits", requireAuth, async (req, res) => {
  try {
    const { subAgentId, masterAgentId } = req.query;
    
    // Verify ownership or admin access for either master or sub-agent
    let accessGranted = false;
    
    if (masterAgentId) {
      const accessCheck = await verifyAgentAccess(req, masterAgentId as string);
      if (accessCheck.allowed) {
        accessGranted = true;
      }
    }
    
    if (!accessGranted && subAgentId) {
      const accessCheck = await verifyAgentAccess(req, subAgentId as string);
      if (accessCheck.allowed) {
        accessGranted = true;
      }
    }
    
    if (!accessGranted) {
      return res.status(403).json({ error: "Forbidden: You can only access your own commission splits" });
    }
    
    const splits = await storage.getCommissionSplits(
      subAgentId as string,
      masterAgentId as string
    );
    res.json({ splits });
  } catch (error) {
    console.error("Get commission splits error:", error);
    res.status(500).json({ error: "Failed to fetch commission splits" });
  }
});

// Get agent commissions
router.get("/api/agents/:agentId/commissions", requireAuth, async (req, res) => {
  try {
    const { agentId } = req.params;
    
    // Verify ownership or admin access
    const accessCheck = await verifyAgentAccess(req, agentId);
    if (!accessCheck.allowed) {
      return res.status(accessCheck.error === "Unauthorized" ? 401 : 403).json({ error: accessCheck.error });
    }
    
    const { month, productType, settlementStatus } = req.query;
    
    const commissions = await storage.getAgentCommissions(agentId, {
      month: month as string,
      productType: productType as string,
      settlementStatus: settlementStatus as string,
    });

    res.json({ commissions });
  } catch (error) {
    console.error("Get agent commissions error:", error);
    res.status(500).json({ error: "Failed to fetch commissions" });
  }
});

// Get commission summary
router.get("/api/agents/:agentId/commission-summary", requireAuth, async (req, res) => {
  try {
    const { agentId } = req.params;
    
    // Verify ownership or admin access
    const accessCheck = await verifyAgentAccess(req, agentId);
    if (!accessCheck.allowed) {
      return res.status(accessCheck.error === "Unauthorized" ? 401 : 403).json({ error: accessCheck.error });
    }
    
    const { month } = req.query;
    
    const summary = await storage.getCommissionSummary(agentId, month as string);
    res.json({ summary });
  } catch (error) {
    console.error("Get commission summary error:", error);
    res.status(500).json({ error: "Failed to fetch commission summary" });
  }
});

// Get AMFI verification logs
router.get("/api/admin/agents/amfi-logs", requireAdmin, async (req, res) => {
  try {
    const { agentId, verificationType } = req.query;
    const logs = await storage.getAmfiVerificationLogs(
      agentId as string,
      verificationType as string
    );
    res.json({ logs });
  } catch (error) {
    console.error("Get AMFI logs error:", error);
    res.status(500).json({ error: "Failed to fetch AMFI logs" });
  }
});

export default router;
