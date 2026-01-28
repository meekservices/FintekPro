import { Router } from "express";
import { storage } from "./storage";
import { amfiValidationService } from "./amfi-validation-service";
import { CashfreeAadhaarService } from "./services/cashfree-aadhaar-service";
import { z } from "zod";
import { randomUUID } from "crypto";
import { ZohoCRMService } from "./zoho/services/crm";

// Helper to get Zoho CRM service (uses default connection)
async function getZohoCRMService(): Promise<ZohoCRMService | null> {
  try {
    const { zohoConnections } = await import("@shared/schema");
    const { db } = await import("./db");
    const { eq } = await import("drizzle-orm");
    
    const [connection] = await db
      .select()
      .from(zohoConnections)
      .where(eq(zohoConnections.isDefault, true))
      .limit(1);
    
    if (connection) {
      return new ZohoCRMService(connection.id, connection.dataCenter || 'com');
    }
    return null;
  } catch (error) {
    console.warn("Zoho CRM service not available:", error);
    return null;
  }
}

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
  if (!user || !user.roles || !user.roles.includes("admin")) {
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
  if (user.roles && user.roles.includes("admin")) {
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

// Product Eligibility Helpers
const isSecuritiesAgent = (agent: any): boolean => {
  if (!agent.productTypes) return false;
  const securitiesProducts = ["mutual_funds", "aif", "pms", "equity"]; // SEBI-regulated only
  return agent.productTypes.some((pt: string) => securitiesProducts.includes(pt));
};

const isLoanAgent = (agent: any): boolean => {
  if (!agent.productTypes) return false;
  return agent.productTypes.includes("loans");
};

const isInsuranceAgent = (agent: any): boolean => {
  if (!agent.productTypes) return false;
  return agent.productTypes.includes("insurance");
};

const canDistributeProduct = (agent: any, productType: string): boolean => {
  if (!agent.productTypes) return false;
  return agent.productTypes.includes(productType);
};

const getRequiredCredentials = (productType: string): { requiresARN: boolean; requiresEUIN: boolean; requiresIRDAI: boolean } => {
  // SEBI-regulated products (require ARN/EUIN)
  const securitiesProducts = ["mutual_funds", "aif", "pms", "equity"];
  const isSecurities = securitiesProducts.includes(productType);
  
  // IRDAI-regulated (require IRDAI license, not ARN/EUIN)
  const isInsurance = productType === "insurance";
  
  // RBI/NBFC-regulated (no ARN/EUIN/IRDAI needed)
  const isLoan = productType === "loans";
  
  return {
    requiresARN: isSecurities,
    requiresEUIN: isSecurities,
    requiresIRDAI: isInsurance,
  };
};

// Validation schemas
const agentRegistrationSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  productTypes: z.array(z.enum(["loans", "mutual_funds", "aif", "pms", "insurance", "equity"])).min(1, "At least one product type is required"),
  
  // Regulatory credentials (required for master/associate agents with securities products)
  arnCode: z.string().regex(/^ARN-\d{5,6}$/i, "Invalid ARN format").optional(),
  euinNumber: z.string().regex(/^E\d{6}$/i, "Invalid EUIN format").optional(),
  
  // Basic KYC (required for sub-agents)
  panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i, "Invalid PAN format").optional(),
  aadharNumber: z.string().length(12, "Aadhaar must be 12 digits").optional(),
  
  // Bank account details (required for commission payouts)
  bankAccountNumber: z.string().optional(),
  bankIfscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/i, "Invalid IFSC code format").optional(),
  bankName: z.string().optional(),
  accountHolderName: z.string().optional(),
  
  // Agent hierarchy
  agentLevel: z.enum(["master", "sub_agent", "associate"]).optional(),
  masterAgentId: z.string().optional(),
  distributorId: z.string().optional(),
  distributorName: z.string().optional(),
}).superRefine((data, ctx) => {
  // Sub-agents are marketing-only agents with basic KYC requirements
  // They don't need ARN/EUIN as they refer clients to master agents
  const isSubAgent = data.agentLevel === "sub_agent";
  
  if (!isSubAgent) {
    // Master and associate agents distributing securities products require ARN/EUIN
    const securitiesProducts = ["mutual_funds", "aif", "pms", "equity"]; // SEBI only, NOT insurance
    const hasSecurities = data.productTypes.some(pt => securitiesProducts.includes(pt));
    
    if (hasSecurities) {
      if (!data.arnCode) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "ARN code is required for distributing mutual funds, PMS, AIF, or equity products (SEBI-regulated)",
          path: ["arnCode"],
        });
      }
      if (!data.euinNumber) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "EUIN is required for distributing mutual funds, PMS, AIF, or equity products (SEBI-regulated)",
          path: ["euinNumber"],
        });
      }
    }
  }
  
  // Sub-agents must have a master agent
  if (isSubAgent && !data.masterAgentId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Sub-agents must be assigned to a master agent",
      path: ["masterAgentId"],
    });
  }
  
  // Sub-agents require basic KYC: PAN, Aadhaar, and Bank Account
  if (isSubAgent) {
    if (!data.panNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "PAN number is required for sub-agents",
        path: ["panNumber"],
      });
    }
    if (!data.aadharNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Aadhaar number is required for sub-agents",
        path: ["aadharNumber"],
      });
    }
    if (!data.bankAccountNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Bank account number is required for commission payouts",
        path: ["bankAccountNumber"],
      });
    }
    if (!data.bankIfscCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Bank IFSC code is required for commission payouts",
        path: ["bankIfscCode"],
      });
    }
    if (!data.accountHolderName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Account holder name is required",
        path: ["accountHolderName"],
      });
    }
  }
  
  // Insurance products require IRDAI license (handled separately, no ARN/EUIN needed)
  const hasInsurance = data.productTypes.includes("insurance");
  // Note: IRDAI validation would be implemented here if we had IRDAI integration
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
      productTypes,
      arnCode, 
      euinNumber, 
      agentLevel,
      masterAgentId,
      distributorId,
      distributorName,
      panNumber,
      aadharNumber,
      bankAccountNumber,
      bankIfscCode,
      bankName,
      accountHolderName
    } = validation.data;

    // Determine regulatory category based on product types
    const securitiesProducts = ["mutual_funds", "aif", "pms", "equity"]; // SEBI-regulated only
    const hasSecurities = productTypes.some(pt => securitiesProducts.includes(pt));
    const hasLoans = productTypes.includes("loans");
    const hasInsurance = productTypes.includes("insurance"); // IRDAI-regulated
    
    // Determine regulatory category based on product mix
    // NOTE: regulatoryCategory is a simplified field. For more granular control, use productTypes array
    let regulatoryCategory: "loan_dsa" | "securities_distributor" | "insurance_agent" | "hybrid" = "loan_dsa";
    
    const productCount = (hasSecurities ? 1 : 0) + (hasLoans ? 1 : 0) + (hasInsurance ? 1 : 0);
    
    if (productCount > 1) {
      // Mixed regulatory requirements (any combination of SEBI/IRDAI/RBI products)
      regulatoryCategory = "hybrid";
    } else if (hasSecurities) {
      // Pure SEBI-regulated securities distributor
      regulatoryCategory = "securities_distributor";
    } else if (hasInsurance) {
      // Pure IRDAI-regulated insurance agent
      regulatoryCategory = "insurance_agent";
    } else if (hasLoans) {
      // Pure RBI/NBFC loan DSA
      regulatoryCategory = "loan_dsa";
    }

    // Check if email already exists
    const existingAgent = await storage.getAgentByEmail(email);
    if (existingAgent) {
      return res.status(400).json({ error: "Agent with this email already exists" });
    }

    // Check if ARN already exists (only if provided)
    if (arnCode) {
      const existingArn = await storage.getAgentByArn(arnCode);
      if (existingArn) {
        return res.status(400).json({ error: "ARN code already registered" });
      }
    }

    // Check if EUIN already exists (only if provided)
    if (euinNumber) {
      const existingEuin = await storage.getAgentByEuin(euinNumber);
      if (existingEuin) {
        return res.status(400).json({ error: "EUIN already registered" });
      }
    }

    // Conditional AMFI validation - only for master/associate agents with securities products
    // Sub-agents don't need ARN/EUIN validation (marketing-only role)
    let arnValidation = null;
    let euinValidation = null;
    const isSubAgent = agentLevel === "sub_agent";
    
    if (hasSecurities && !isSubAgent) {
      // Validate ARN with AMFI (required for master/associate securities distributors)
      if (arnCode) {
        arnValidation = await amfiValidationService.validateArn(arnCode);
        if (!arnValidation.isValid) {
          return res.status(400).json({ 
            error: "Invalid ARN code", 
            details: arnValidation.errorMessage 
          });
        }
      }

      // Validate EUIN with AMFI (required for master/associate securities distributors)
      if (euinNumber) {
        euinValidation = await amfiValidationService.validateEuin(euinNumber, arnCode);
        if (!euinValidation.isValid) {
          return res.status(400).json({ 
            error: "Invalid EUIN number", 
            details: euinValidation.errorMessage 
          });
        }
      }
    }

    // Create agent record
    const agentData = {
      fullName,
      email,
      phone,
      productTypes,
      regulatoryCategory,
      
      // Regulatory credentials (for master/associate agents)
      arnCode: arnCode || null,
      euinNumber: euinNumber || null,
      distributorId,
      distributorName: distributorName || (arnValidation?.distributorDetails?.distributorName),
      
      // Basic KYC (for sub-agents)
      panNumber: panNumber || null,
      aadharNumber: aadharNumber || null,
      
      // Bank account details (required for all agents for commission payouts)
      bankAccountNumber: bankAccountNumber || null,
      bankIfscCode: bankIfscCode || null,
      bankName: bankName || null,
      accountHolderName: accountHolderName || null,
      
      // Agent hierarchy
      agentLevel: agentLevel || "master",
      masterAgentId,
      
      // Verification status
      arnVerificationStatus: hasSecurities && !isSubAgent ? (arnValidation?.isValid ? "verified" : "pending") : "not_required",
      euinVerificationStatus: hasSecurities && !isSubAgent ? (euinValidation?.isValid ? "verified" : "pending") : "not_required",
      panVerified: false, // Will be verified via Cashfree OKYC or other service
      aadharVerified: false, // Will be verified via Cashfree OKYC
      bankAccountVerified: false, // Will be verified via penny drop
      
      onboardingStatus: "pending",
      status: "active",
      amfiVerificationResponse: hasSecurities && !isSubAgent ? {
        arn: arnValidation,
        euin: euinValidation
      } : null,
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

    // Sync agent to Zoho CRM as Lead (pending approval)
    try {
      const zohoCRM = await getZohoCRMService();
      if (zohoCRM) {
        await zohoCRM.createAgentAsLead(agent.id);
        console.log(`✅ Agent ${agent.id} synced to Zoho CRM as Lead`);
      }
    } catch (zohoError) {
      console.warn("Zoho CRM sync failed (non-blocking):", zohoError);
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

// Generate OTP for Aadhaar verification (for sub-agent onboarding)
router.post("/api/agents/:agentId/aadhaar/generate-otp", requireAuth, async (req, res) => {
  try {
    const { agentId } = req.params;
    const { aadhaarNumber } = req.body;
    
    // Verify ownership or admin access
    const accessCheck = await verifyAgentAccess(req, agentId);
    if (!accessCheck.allowed) {
      return res.status(accessCheck.error === "Unauthorized" ? 401 : 403).json({ error: accessCheck.error });
    }
    
    // Validate Aadhaar number
    if (!aadhaarNumber || !/^\d{12}$/.test(aadhaarNumber)) {
      return res.status(400).json({ error: "Invalid Aadhaar number. Must be 12 digits." });
    }
    
    // Check if Cashfree is configured
    if (!CashfreeAadhaarService.isConfigured()) {
      return res.status(503).json({ 
        error: "Aadhaar verification service not configured",
        message: "Please contact support to enable Aadhaar verification" 
      });
    }
    
    // Generate OTP using Cashfree OKYC
    const otpResponse = await CashfreeAadhaarService.generateOTP(aadhaarNumber);
    
    if (!otpResponse.success) {
      return res.status(400).json({ 
        error: "Failed to generate OTP", 
        message: otpResponse.message 
      });
    }
    
    // Store ref_id temporarily (in production, you'd store this in a session or temporary table)
    // For now, we'll return it to the client to send back with OTP verification
    res.json({
      success: true,
      message: otpResponse.message,
      refId: otpResponse.ref_id,
      maskedAadhaar: otpResponse.maskedAadhaar
    });
    
  } catch (error) {
    console.error("Aadhaar OTP generation error:", error);
    res.status(500).json({ error: "Failed to generate OTP for Aadhaar verification" });
  }
});

// Verify Aadhaar OTP and update agent verification status
router.post("/api/agents/:agentId/aadhaar/verify-otp", requireAuth, async (req, res) => {
  try {
    const { agentId } = req.params;
    const { otp, refId } = req.body;
    
    // Verify ownership or admin access
    const accessCheck = await verifyAgentAccess(req, agentId);
    if (!accessCheck.allowed) {
      return res.status(accessCheck.error === "Unauthorized" ? 401 : 403).json({ error: accessCheck.error });
    }
    
    // Validate inputs
    if (!otp || !refId) {
      return res.status(400).json({ error: "OTP and reference ID are required" });
    }
    
    // Verify OTP using Cashfree OKYC
    const verificationResponse = await CashfreeAadhaarService.verifyOTP(otp, refId);
    
    if (!verificationResponse.success || !verificationResponse.verified) {
      return res.status(400).json({ 
        error: "Aadhaar verification failed", 
        message: verificationResponse.message 
      });
    }
    
    // SECURITY: Ensure verified data exists
    if (!verificationResponse.data?.aadhaarNumber || !verificationResponse.data?.name) {
      return res.status(400).json({ 
        error: "Verification failed", 
        message: "Missing verified Aadhaar data from UIDAI" 
      });
    }
    
    // Get agent record
    const agent = await storage.getAgentById(agentId);
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }
    
    // CRITICAL: Use ONLY verified data from Cashfree/UIDAI, never client-supplied data
    await storage.updateCustomerCareAgent(agentId, {
      aadharNumber: verificationResponse.data.aadhaarNumber, // Verified Aadhaar from UIDAI
      aadharName: verificationResponse.data.name, // Verified name from UIDAI
      aadharVerified: true,
      onboardingStatus: agent.panVerified && agent.bankAccountVerified ? "approved" : "pending"
    });
    
    res.json({
      success: true,
      verified: true,
      message: "Aadhaar verified successfully",
      data: {
        aadhaarNumber: verificationResponse.data.aadhaarNumber, // Return verified number
        name: verificationResponse.data.name,
        dob: verificationResponse.data.dob,
        gender: verificationResponse.data.gender,
        address: verificationResponse.data.address
      }
    });
    
  } catch (error) {
    console.error("Aadhaar OTP verification error:", error);
    res.status(500).json({ error: "Failed to verify Aadhaar OTP" });
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

    // If approved, sync agent to Zoho CRM as Contact
    if (status === "approved") {
      try {
        const zohoCRM = await getZohoCRMService();
        if (zohoCRM) {
          await zohoCRM.syncAgentToContact(agentId);
          console.log(`✅ Approved agent ${agentId} synced to Zoho CRM as Contact`);
        }
      } catch (zohoError) {
        console.warn("Zoho CRM sync on approval failed (non-blocking):", zohoError);
      }
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

// ==================== SUB-AGENT DASHBOARD ENDPOINTS ====================

// Get referral statistics for sub-agent
router.get("/api/agents/:agentId/referral-stats", requireAuth, async (req, res) => {
  try {
    const { agentId } = req.params;
    
    const accessCheck = await verifyAgentAccess(req, agentId);
    if (!accessCheck.allowed) {
      return res.status(accessCheck.error === "Unauthorized" ? 401 : 403).json({ error: accessCheck.error });
    }

    const stats = await storage.getAgentReferralStats(agentId);
    res.json(stats);
  } catch (error) {
    console.error("Get referral stats error:", error);
    res.status(500).json({ error: "Failed to fetch referral statistics" });
  }
});

// Get referred clients for sub-agent
router.get("/api/agents/:agentId/referred-clients", requireAuth, async (req, res) => {
  try {
    const { agentId } = req.params;
    
    const accessCheck = await verifyAgentAccess(req, agentId);
    if (!accessCheck.allowed) {
      return res.status(accessCheck.error === "Unauthorized" ? 401 : 403).json({ error: accessCheck.error });
    }

    const clients = await storage.getReferredClients(agentId);
    res.json(clients);
  } catch (error) {
    console.error("Get referred clients error:", error);
    res.status(500).json({ error: "Failed to fetch referred clients" });
  }
});

// Get earnings breakdown for sub-agent
router.get("/api/agents/:agentId/earnings", requireAuth, async (req, res) => {
  try {
    const { agentId } = req.params;
    
    const accessCheck = await verifyAgentAccess(req, agentId);
    if (!accessCheck.allowed) {
      return res.status(accessCheck.error === "Unauthorized" ? 401 : 403).json({ error: accessCheck.error });
    }

    const earnings = await storage.getAgentEarnings(agentId);
    res.json(earnings);
  } catch (error) {
    console.error("Get earnings error:", error);
    res.status(500).json({ error: "Failed to fetch earnings" });
  }
});

// Refer new client (sub-agent)
router.post("/api/agents/:agentId/refer-client", requireAuth, async (req, res) => {
  try {
    const { agentId } = req.params;
    
    const accessCheck = await verifyAgentAccess(req, agentId);
    if (!accessCheck.allowed) {
      return res.status(accessCheck.error === "Unauthorized" ? 401 : 403).json({ error: accessCheck.error });
    }

    const { firstName, lastName, email, mobile, interestedProducts, notes } = req.body;

    if (!firstName || !lastName || !email || !mobile) {
      return res.status(400).json({ error: "First name, last name, email, and mobile are required" });
    }

    const referral = await storage.createClientReferral({
      agentId,
      firstName,
      lastName,
      email,
      mobile,
      interestedProducts: interestedProducts || [],
      notes: notes || "",
      status: "pending",
      referredDate: new Date().toISOString(),
    });

    res.json({ success: true, referral });
  } catch (error) {
    console.error("Refer client error:", error);
    res.status(500).json({ error: "Failed to refer client" });
  }
});

// ==================== APPOINTMENT/CALENDAR ENDPOINTS ====================

const appointmentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  type: z.enum(["meeting", "call", "review", "demo"]),
  clientId: z.string().optional(),
  clientName: z.string().optional(),
  location: z.enum(["virtual", "office", "client_site"]),
  locationDetails: z.string().optional(),
  date: z.string().min(1, "Date is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().optional(),
  duration: z.number().min(15).max(480),
  reminder: z.enum(["15min", "30min", "1hr", "1day", "none"]),
  notes: z.string().optional(),
});

// In-memory appointments storage (replace with database in production)
let appointmentsStore: any[] = [
  { id: '1', title: 'Portfolio Review', description: 'Q4 portfolio review', type: 'review', clientId: '1', clientName: 'Rajesh Sharma', location: 'virtual', date: new Date().toISOString().split('T')[0], startTime: '10:00', endTime: '11:00', duration: 60, reminder: '30min', status: 'scheduled', createdAt: new Date().toISOString() },
  { id: '2', title: 'SIP Discussion', description: 'New SIP recommendations', type: 'call', clientId: '2', clientName: 'Priya Patel', location: 'virtual', date: new Date().toISOString().split('T')[0], startTime: '14:00', endTime: '14:30', duration: 30, reminder: '15min', status: 'scheduled', createdAt: new Date().toISOString() },
];

// Get all appointments
router.get("/api/agent/appointments", requireAuth, async (req, res) => {
  try {
    const { startDate, endDate, clientId, type, status } = req.query;
    
    let filtered = [...appointmentsStore];
    
    if (startDate) {
      filtered = filtered.filter(apt => apt.date >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter(apt => apt.date <= endDate);
    }
    if (clientId) {
      filtered = filtered.filter(apt => apt.clientId === clientId);
    }
    if (type) {
      filtered = filtered.filter(apt => apt.type === type);
    }
    if (status) {
      filtered = filtered.filter(apt => apt.status === status);
    }
    
    res.json({ appointments: filtered });
  } catch (error) {
    console.error("Get appointments error:", error);
    res.status(500).json({ error: "Failed to fetch appointments" });
  }
});

// Create appointment
router.post("/api/agent/appointments", requireAuth, async (req, res) => {
  try {
    const validation = appointmentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validation.error.errors 
      });
    }
    
    const { title, description, type, clientId, clientName, location, locationDetails, date, startTime, endTime, duration, reminder, notes } = validation.data;
    
    const appointment = {
      id: randomUUID(),
      title,
      description,
      type,
      clientId,
      clientName,
      location,
      locationDetails,
      date,
      startTime,
      endTime: endTime || calculateEndTime(startTime, duration),
      duration,
      reminder,
      notes,
      status: "scheduled",
      createdAt: new Date().toISOString(),
      agentId: req.user?.id,
    };
    
    appointmentsStore.push(appointment);
    
    res.json({ success: true, appointment });
  } catch (error) {
    console.error("Create appointment error:", error);
    res.status(500).json({ error: "Failed to create appointment" });
  }
});

// Update appointment
router.patch("/api/agent/appointments/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const appointmentIndex = appointmentsStore.findIndex(apt => apt.id === id);
    
    if (appointmentIndex === -1) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    
    const { type, clientId, clientName, location, locationDetails, date, startTime, endTime, duration, reminder, notes, status } = req.body;
    const allowedUpdates: Record<string, any> = {};
    if (type !== undefined) allowedUpdates.type = type;
    if (clientId !== undefined) allowedUpdates.clientId = clientId;
    if (clientName !== undefined) allowedUpdates.clientName = clientName;
    if (location !== undefined) allowedUpdates.location = location;
    if (locationDetails !== undefined) allowedUpdates.locationDetails = locationDetails;
    if (date !== undefined) allowedUpdates.date = date;
    if (startTime !== undefined) allowedUpdates.startTime = startTime;
    if (endTime !== undefined) allowedUpdates.endTime = endTime;
    if (duration !== undefined) allowedUpdates.duration = duration;
    if (reminder !== undefined) allowedUpdates.reminder = reminder;
    if (notes !== undefined) allowedUpdates.notes = notes;
    if (status !== undefined) allowedUpdates.status = status;
    
    appointmentsStore[appointmentIndex] = {
      ...appointmentsStore[appointmentIndex],
      ...allowedUpdates,
      updatedAt: new Date().toISOString(),
    };
    
    res.json({ success: true, appointment: appointmentsStore[appointmentIndex] });
  } catch (error) {
    console.error("Update appointment error:", error);
    res.status(500).json({ error: "Failed to update appointment" });
  }
});

// Delete appointment
router.delete("/api/agent/appointments/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const appointmentIndex = appointmentsStore.findIndex(apt => apt.id === id);
    
    if (appointmentIndex === -1) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    
    appointmentsStore.splice(appointmentIndex, 1);
    
    res.json({ success: true, message: "Appointment deleted" });
  } catch (error) {
    console.error("Delete appointment error:", error);
    res.status(500).json({ error: "Failed to delete appointment" });
  }
});

// Get clients for appointment selector
router.get("/api/agent/clients", requireAuth, async (req, res) => {
  try {
    const { users, prospectClients } = await import("@shared/schema");
    const { db } = await import("./db");
    const { sql, eq } = await import("drizzle-orm");
    
    const agentUser = await storage.getUser((req as any).user?.id);
    if (!agentUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    // Fetch real clients assigned to this agent from users table
    const clientsData = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        mobile: users.mobile,
        panNumber: users.panNumber,
        isActive: users.isActive,
      })
      .from(users)
      .where(
        sql`${users.agentId} = ${agentUser.id} AND 'client' = ANY(${users.roles})`
      )
      .limit(100);
    
    // Also fetch prospects from prospect_clients table
    const prospectsData = await db
      .select({
        id: prospectClients.id,
        name: prospectClients.name,
        email: prospectClients.email,
        mobile: prospectClients.mobile,
        pan: prospectClients.pan,
        state: prospectClients.state,
      })
      .from(prospectClients)
      .where(eq(prospectClients.agentId, agentUser.id))
      .limit(100);
    
    // Map clients to expected format
    const clients = clientsData.map(client => ({
      id: client.id,
      firstName: client.firstName || '',
      lastName: client.lastName || '',
      email: client.email || '',
      mobile: client.mobile || '',
      panNumber: client.panNumber || '',
      kycStatus: 'verified',
      isActive: client.isActive ?? true,
      clientCategory: 'retail',
      type: 'client' as const,
    }));
    
    // Map prospects to expected format - split name into first/last
    const prospects = prospectsData.map(prospect => {
      const nameParts = (prospect.name || '').split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      return {
        id: prospect.id,
        firstName,
        lastName,
        email: prospect.email || '',
        mobile: prospect.mobile || '',
        panNumber: prospect.pan || '',
        kycStatus: prospect.state === 'active_client' ? 'verified' : 'pending',
        isActive: prospect.state !== 'inactive',
        clientCategory: 'prospect',
        type: 'prospect' as const,
      };
    });
    
    // Combine clients and prospects
    const allClientsAndProspects = [...clients, ...prospects];
    
    res.json(allClientsAndProspects);
  } catch (error) {
    console.error("Get clients error:", error);
    res.status(500).json({ error: "Failed to fetch clients" });
  }
});

// Helper function to calculate end time
function calculateEndTime(startTime: string, durationMinutes: number): string {
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMinutes = totalMinutes % 60;
  return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
}

// ============================================
// Client Onboarding Endpoints
// ============================================

// In-memory draft storage (in production, use database)
const onboardingDraftsStore: Map<string, any> = new Map();

// Client onboarding validation schema
const clientOnboardingSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  mobile: z.string().min(10, "Mobile must be at least 10 digits"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["M", "F", "O"]),
  panNumber: z.string().length(10, "PAN must be 10 characters"),
  panVerified: z.boolean().optional(),
  panHolderName: z.string().optional(),
  aadhaarNumber: z.string().length(12, "Aadhaar must be 12 digits").optional(),
  addressLine1: z.string().min(5, "Address is required"),
  addressLine2: z.string().optional(),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  pincode: z.string().length(6, "Pincode must be 6 digits"),
  addressProofType: z.string().min(1, "Please select address proof type"),
  addressProofUrl: z.string().optional(),
  accountNumber: z.string().min(9, "Account number must be at least 9 digits"),
  confirmAccountNumber: z.string().min(9, "Please confirm account number"),
  ifscCode: z.string().length(11, "IFSC must be 11 characters"),
  bankName: z.string().min(2, "Bank name is required"),
  branchName: z.string().optional(),
  accountType: z.enum(["savings", "current"]),
  investmentGoal: z.enum(["wealth_creation", "retirement", "tax_saving", "child_education", "emergency_fund", "regular_income"]),
  riskTolerance: z.enum(["conservative", "moderate", "aggressive"]),
  investmentHorizon: z.enum(["short", "medium", "long"]),
  annualIncome: z.enum(["below_5l", "5l_10l", "10l_25l", "25l_50l", "above_50l"]),
  investmentExperience: z.enum(["beginner", "intermediate", "experienced"]),
});

// Submit new client onboarding
router.post("/api/agent/clients/onboard", requireAuth, async (req, res) => {
  try {
    const validationResult = clientOnboardingSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validationResult.error.issues,
      });
    }

    const data = validationResult.data;
    const agentId = req.user?.id;
    
    // Generate client ID
    const clientId = `CLT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    
    // In production, save to database
    const newClient = {
      id: clientId,
      ...data,
      agentId,
      status: "kyc_pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    console.log("New client onboarded:", newClient);
    
    res.json({
      success: true,
      clientId,
      message: "Client onboarded successfully",
    });
  } catch (error) {
    console.error("Client onboarding error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to onboard client",
    });
  }
});

// Save draft
router.post("/api/agent/clients/onboard/draft", requireAuth, async (req, res) => {
  try {
    const agentId = req.user?.id;
    const draftData = req.body;
    
    // Generate or use existing draft ID
    const draftId = draftData.draftId || `DRAFT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    
    const draft = {
      id: draftId,
      agentId,
      data: draftData,
      updatedAt: new Date().toISOString(),
      createdAt: onboardingDraftsStore.get(draftId)?.createdAt || new Date().toISOString(),
    };
    
    onboardingDraftsStore.set(draftId, draft);
    
    res.json({
      success: true,
      draftId,
      message: "Draft saved successfully",
    });
  } catch (error) {
    console.error("Save draft error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to save draft",
    });
  }
});

// Resume draft
router.get("/api/agent/clients/onboard/draft/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const agentId = req.user?.id;
    
    const draft = onboardingDraftsStore.get(id);
    
    if (!draft) {
      return res.status(404).json({
        success: false,
        error: "Draft not found",
      });
    }
    
    // Verify ownership
    if (draft.agentId !== agentId) {
      return res.status(403).json({
        success: false,
        error: "You don't have access to this draft",
      });
    }
    
    res.json({
      success: true,
      draft,
    });
  } catch (error) {
    console.error("Get draft error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve draft",
    });
  }
});

// List all drafts for agent
router.get("/api/agent/clients/onboard/drafts", requireAuth, async (req, res) => {
  try {
    const agentId = req.user?.id;
    
    const drafts = Array.from(onboardingDraftsStore.values())
      .filter(draft => draft.agentId === agentId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    
    res.json({
      success: true,
      drafts,
    });
  } catch (error) {
    console.error("List drafts error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to list drafts",
    });
  }
});

// Delete draft
router.delete("/api/agent/clients/onboard/draft/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const agentId = req.user?.id;
    
    const draft = onboardingDraftsStore.get(id);
    
    if (!draft) {
      return res.status(404).json({
        success: false,
        error: "Draft not found",
      });
    }
    
    if (draft.agentId !== agentId) {
      return res.status(403).json({
        success: false,
        error: "You don't have access to this draft",
      });
    }
    
    onboardingDraftsStore.delete(id);
    
    res.json({
      success: true,
      message: "Draft deleted successfully",
    });
  } catch (error) {
    console.error("Delete draft error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete draft",
    });
  }
});

// ============================================================================
// AGENT ZOHO CRM ROUTES - Lead management for agents
// ============================================================================

// Get leads from Zoho CRM for agent (uses agent-specific connection resolution)
router.get("/api/agent/zoho/leads", requireAuth, async (req, res) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    // Use ZohoConnectionResolver to find the agent's connection (or their master's)
    const { ZohoConnectionResolver } = await import("./zoho/connection-resolver");
    const connection = await ZohoConnectionResolver.resolveForAgent(agentId);
    
    if (!connection) {
      return res.status(200).json({
        success: true,
        connected: false,
        leads: [],
        total: 0,
        message: "Zoho CRM not connected - please configure integration in admin settings"
      });
    }

    const zohoCRM = new ZohoCRMService(connection.connectionId, connection.zohoDataCenter);
    const result = await zohoCRM.getLeads(200);
    
    res.json({
      success: true,
      connected: true,
      leads: result || [],
      total: Array.isArray(result) ? result.length : 0
    });
  } catch (error: any) {
    console.error("[Agent Zoho] Get leads error:", error.message);
    res.status(500).json({
      success: false,
      connected: false,
      leads: [],
      total: 0,
      error: error.message
    });
  }
});

// Sync leads from Zoho CRM (refresh) - uses agent-specific connection
router.post("/api/agent/zoho/sync", requireAuth, async (req, res) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const { ZohoConnectionResolver } = await import("./zoho/connection-resolver");
    const connection = await ZohoConnectionResolver.resolveForAgent(agentId);
    
    if (!connection) {
      return res.status(400).json({
        success: false,
        message: "Zoho CRM not connected"
      });
    }

    const zohoCRM = new ZohoCRMService(connection.connectionId, connection.zohoDataCenter);
    const result = await zohoCRM.getLeads(200);
    
    res.json({
      success: true,
      synced: Array.isArray(result) ? result.length : 0,
      message: "Leads synced successfully"
    });
  } catch (error: any) {
    console.error("[Agent Zoho] Sync error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get single lead details from Zoho CRM - uses agent-specific connection
router.get("/api/agent/zoho/leads/:leadId", requireAuth, async (req, res) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { leadId } = req.params;
    
    const { ZohoConnectionResolver } = await import("./zoho/connection-resolver");
    const connection = await ZohoConnectionResolver.resolveForAgent(agentId);
    
    if (!connection) {
      return res.status(400).json({
        error: "Zoho CRM not connected"
      });
    }

    const zohoCRM = new ZohoCRMService(connection.connectionId, connection.zohoDataCenter);
    const lead = await zohoCRM.getLead(leadId);
    
    if (!lead) {
      return res.status(404).json({
        error: "Lead not found"
      });
    }

    res.json(lead);
  } catch (error: any) {
    console.error("[Agent Zoho] Get lead error:", error.message);
    res.status(500).json({
      error: error.message
    });
  }
});

// Log proposal activity back to Zoho CRM as a note - uses agent-specific connection
router.post("/api/agent/zoho/leads/:leadId/proposal", requireAuth, async (req, res) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, synced: false, message: "Authentication required" });
    }

    const { leadId } = req.params;
    const { proposalId, proposalType, products, amount } = req.body;
    
    if (!proposalId || typeof proposalId !== 'string') {
      return res.status(400).json({
        success: false,
        synced: false,
        message: "proposalId is required and must be a string"
      });
    }
    
    if (!leadId || typeof leadId !== 'string') {
      return res.status(400).json({
        success: false,
        synced: false,
        message: "leadId is required"
      });
    }
    
    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        synced: false,
        message: "products is required and must be a non-empty array"
      });
    }
    
    if (amount === undefined || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        success: false,
        synced: false,
        message: "amount is required and must be a positive number"
      });
    }
    
    const { ZohoConnectionResolver } = await import("./zoho/connection-resolver");
    const connection = await ZohoConnectionResolver.resolveForAgent(agentId);
    
    if (!connection) {
      console.log(`[Agent Zoho] Zoho not connected - proposal ${proposalId} not synced`);
      return res.status(503).json({
        success: false,
        synced: false,
        message: "Zoho CRM not connected - please configure integration",
        leadId,
        proposalId
      });
    }
    
    const zohoCRM = new ZohoCRMService(connection.connectionId, connection.zohoDataCenter);

    const noteTitle = `Proposal Created: ${proposalType || 'Investment'}`;
    const noteContent = [
      `Proposal ID: ${proposalId}`,
      `Type: ${proposalType || 'Multi-Product'}`,
      `Products: ${products?.join(", ") || "N/A"}`,
      amount ? `Proposed Amount: ₹${Number(amount).toLocaleString('en-IN')}` : '',
      `Created: ${new Date().toLocaleString('en-IN')}`
    ].filter(Boolean).join('\n');

    const noteId = await zohoCRM.addNote('Leads', leadId, {
      title: noteTitle,
      content: noteContent
    });

    if (!noteId) {
      console.warn(`[Agent Zoho] Failed to create note for lead ${leadId}`);
      return res.status(502).json({
        success: false,
        synced: false,
        message: "Failed to create proposal note in Zoho CRM",
        leadId,
        proposalId
      });
    }

    const statusUpdated = await zohoCRM.updateLeadStatus(leadId, 'Proposal Sent');
    
    if (!statusUpdated) {
      console.warn(`[Agent Zoho] Note created but status update failed for lead ${leadId}`);
    }

    console.log(`[Agent Zoho] Proposal ${proposalId} synced to Zoho lead ${leadId} (note: ${noteId})`);

    res.json({
      success: true,
      synced: true,
      noteId,
      statusUpdated,
      message: statusUpdated 
        ? "Proposal synced to Zoho CRM" 
        : "Proposal note created, status update pending",
      leadId,
      proposalId
    });
  } catch (error: any) {
    console.error("[Agent Zoho] Log proposal error:", error.message);
    res.status(500).json({
      success: false,
      synced: false,
      message: "Failed to sync proposal to Zoho CRM",
      error: error.message
    });
  }
});

// Export product eligibility utilities for use in other modules
export { isSecuritiesAgent, isLoanAgent, isInsuranceAgent, canDistributeProduct, getRequiredCredentials };

export default router;
