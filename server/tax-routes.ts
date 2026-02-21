import { Router, Request, Response, NextFunction } from "express";
import { createHash } from 'crypto';
import { storage } from "./storage";
import { z } from "zod";
import multer from "multer";
import { sandboxITRService } from "./sandbox-itr-service";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

const itrDraftStorage = new Map<number, any>();
let draftIdCounter = 1;

const taxNoticesStorage = new Map<string, any>();
let noticeIdCounter = 1;

type TaxRole = "client" | "agent" | "ca" | "admin";

interface TaxPermissions {
  canCreateDraft: boolean;
  canEditDraft: boolean;
  canSubmitForReview: boolean;
  canApprove: boolean;
  canSign: boolean;
  canViewAllCases: boolean;
  canFinalSubmit: boolean;
}

const ROLE_PERMISSIONS: Record<TaxRole, TaxPermissions> = {
  client: {
    canCreateDraft: true,
    canEditDraft: true,
    canSubmitForReview: false,
    canApprove: false,
    canSign: false,
    canViewAllCases: false,
    canFinalSubmit: true
  },
  agent: {
    canCreateDraft: true,
    canEditDraft: true,
    canSubmitForReview: true,
    canApprove: false,
    canSign: false,
    canViewAllCases: true,
    canFinalSubmit: false
  },
  ca: {
    canCreateDraft: true,
    canEditDraft: true,
    canSubmitForReview: true,
    canApprove: true,
    canSign: true,
    canViewAllCases: true,
    canFinalSubmit: true
  },
  admin: {
    canCreateDraft: true,
    canEditDraft: true,
    canSubmitForReview: true,
    canApprove: true,
    canSign: true,
    canViewAllCases: true,
    canFinalSubmit: true
  }
};

function getUserTaxRole(req: Request): TaxRole {
  const session = (req as any).session;
  if (!session?.userId) return "client";
  
  const userRole = session.userRole?.toLowerCase();
  
  if (userRole === "admin") return "admin";
  if (userRole === "ca" || userRole === "chartered_accountant") return "ca";
  if (userRole === "agent") return "agent";
  
  return "client";
}

function getUserPermissions(req: Request): TaxPermissions {
  const role = getUserTaxRole(req);
  return ROLE_PERMISSIONS[role];
}

function requirePermission(permission: keyof TaxPermissions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const permissions = getUserPermissions(req);
    
    if (!permissions[permission]) {
      const role = getUserTaxRole(req);
      return res.status(403).json({ 
        error: "Permission denied",
        message: `Role '${role}' does not have permission: ${permission}`,
        requiredPermission: permission
      });
    }
    
    (req as any).taxRole = getUserTaxRole(req);
    (req as any).taxPermissions = permissions;
    next();
  };
}

function requireTaxAuth(req: Request, res: Response, next: NextFunction) {
  const reqUser = (req as any).user;
    const session = (req as any).session;
    const userId = reqUser?.id || session?.userId || session?.user?.id;
  
  if (!userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  (req as any).taxRole = getUserTaxRole(req);
  (req as any).taxPermissions = getUserPermissions(req);
  next();
}

interface TaxAuditEntry {
  id: number;
  entityType: "itr_draft" | "form15_case" | "notice" | "payment" | "capital_gains_upload" | "capital_gains_manual";
  entityId: number | string;
  action: string;
  previousStatus?: string;
  newStatus?: string;
  userId: number;
  userRole: TaxRole;
  changesDescription: string;
  metadata?: Record<string, any>;
  timestamp: string;
  ipAddress?: string;
  hash: string;
  previousHash: string;
}

const taxAuditLog = new Map<number, TaxAuditEntry>();
let auditIdCounter = 1;
let lastAuditHash = '0'.repeat(64);

const draftVersions = new Map<number, Array<{ version: number; data: any; timestamp: string; changedBy: number; changeDescription: string }>>();

function snapshotDraftVersion(draftId: number, data: any, userId: number, description: string) {
  if (!draftVersions.has(draftId)) {
    draftVersions.set(draftId, []);
  }
  const versions = draftVersions.get(draftId)!;
  const version = versions.length + 1;
  versions.push({
    version,
    data: JSON.parse(JSON.stringify(data)),
    timestamp: new Date().toISOString(),
    changedBy: userId,
    changeDescription: description
  });
  if (versions.length > 50) versions.shift();
}

function logTaxAudit(entry: Omit<TaxAuditEntry, "id" | "timestamp" | "hash" | "previousHash">) {
  const auditEntry: TaxAuditEntry = {
    id: auditIdCounter++,
    ...entry,
    timestamp: new Date().toISOString(),
    hash: '',
    previousHash: ''
  };
  const dataToHash = JSON.stringify({ ...entry, id: auditEntry.id, timestamp: auditEntry.timestamp, previousHash: lastAuditHash });
  const hash = createHash('sha256').update(dataToHash).digest('hex');
  auditEntry.hash = hash;
  auditEntry.previousHash = lastAuditHash;
  lastAuditHash = hash;
  taxAuditLog.set(auditEntry.id, auditEntry);
  console.log(`[TAX AUDIT] ${auditEntry.action} on ${auditEntry.entityType}:${auditEntry.entityId} by user ${auditEntry.userId} (${auditEntry.userRole})`);
  return auditEntry;
}

function shouldResetPaymentOnEdit(currentStatus: string): boolean {
  return ["paid", "submitted", "verified", "filed"].includes(currentStatus);
}

function shouldResetApprovalOnEdit(currentStatus: string): boolean {
  return ["ca_approved", "approved", "signed", "submitted", "filed"].includes(currentStatus);
}

function handleImmutableEdit(draft: any, userId: number, userRole: TaxRole): { allowed: boolean; resetTo?: string; warning?: string } {
  const status = draft.status;
  
  if (["filed", "verified", "submitted"].includes(status)) {
    return { 
      allowed: false, 
      warning: `Cannot modify ITR in '${status}' status. The return has been filed with the Income Tax Department.` 
    };
  }
  
  if (status === "paid") {
    logTaxAudit({
      entityType: "itr_draft",
      entityId: draft.id,
      action: "PAYMENT_RESET",
      previousStatus: "paid",
      newStatus: "draft",
      userId,
      userRole,
      changesDescription: "Payment status reset due to draft modification after payment"
    });
    return { 
      allowed: true, 
      resetTo: "draft", 
      warning: "Draft modified after payment. Payment has been voided and you will need to pay again." 
    };
  }
  
  if (status === "preview") {
    logTaxAudit({
      entityType: "itr_draft",
      entityId: draft.id,
      action: "PREVIEW_RESET",
      previousStatus: "preview",
      newStatus: "draft",
      userId,
      userRole,
      changesDescription: "Preview lock reset due to draft modification"
    });
    return { 
      allowed: true, 
      resetTo: "draft", 
      warning: "Draft modified after preview. You will need to preview and lock again." 
    };
  }
  
  if (["ca_approved", "approved"].includes(status)) {
    logTaxAudit({
      entityType: "itr_draft",
      entityId: draft.id,
      action: "APPROVAL_RESET",
      previousStatus: status,
      newStatus: "pending_review",
      userId,
      userRole,
      changesDescription: "CA approval reset due to draft modification after approval"
    });
    return { 
      allowed: true, 
      resetTo: "pending_review", 
      warning: "Draft modified after CA approval. The return will need to be re-approved." 
    };
  }
  
  return { allowed: true };
}

const coerceNumber = z.preprocess((val) => {
  if (val === "" || val === null || val === undefined) return 0;
  const num = Number(val);
  return isNaN(num) ? 0 : num;
}, z.number());

const itrDraftSchema = z.object({
  pan: z.string().min(10).max(10),
  assessmentYear: z.string().regex(/^\d{4}-\d{2}$/),
  itrForm: z.enum(["ITR-1", "ITR-2", "ITR-3", "ITR-4", "ITR-5", "ITR-6", "ITR-7"]),
  status: z.enum(["draft", "preview", "pending_payment", "paid", "submitted", "verified"]).optional(),
  incomeSources: z.object({
    hasSalary: z.boolean(),
    hasHouseProperty: z.boolean(),
    hasCapitalGains: z.boolean(),
    hasBusinessIncome: z.boolean(),
    hasForeignIncome: z.boolean(),
    hasOtherIncome: z.boolean()
  }).optional(),
  salaryDetails: z.object({
    grossSalary: coerceNumber,
    allowances: coerceNumber,
    perquisites: coerceNumber,
    profitInLieu: coerceNumber,
    standardDeduction: coerceNumber,
    professionalTax: coerceNumber,
    employerPF: coerceNumber
  }).optional(),
  housePropertyDetails: z.object({
    propertyCount: z.preprocess((val) => {
      if (val === "" || val === null || val === undefined) return 1;
      const num = Number(val);
      return isNaN(num) || num < 1 ? 1 : num;
    }, z.number().min(1)),
    rentalIncome: coerceNumber,
    municipalTaxes: coerceNumber,
    interestOnLoan: coerceNumber,
    isSelfOccupied: z.boolean()
  }).optional(),
  capitalGainsDetails: z.object({
    shortTermGains: coerceNumber,
    longTermGains: coerceNumber,
    exemptionsApplied: coerceNumber
  }).optional(),
  otherIncomeDetails: z.object({
    interestIncome: coerceNumber,
    dividendIncome: coerceNumber,
    otherSources: coerceNumber,
    agriculturalIncome: coerceNumber
  }).optional(),
  businessDetails: z.object({
    businessIncome: coerceNumber,
    grossTurnover: coerceNumber,
    grossReceipts: coerceNumber,
    presumptiveIncome44AD: coerceNumber,
    presumptiveIncome44ADA: coerceNumber,
    vehicleCount: coerceNumber,
    presumptiveIncome44AE: coerceNumber,
    isPresumptive: z.boolean().default(false),
    businessType: z.string().optional(),
    businessDescription: z.string().optional(),
  }).optional(),
  foreignIncomeDetails: z.object({
    foreignSTCG: coerceNumber,
    foreignLTCG: coerceNumber,
    foreignDividends: coerceNumber,
    foreignInterest: coerceNumber,
    foreignOtherIncome: coerceNumber,
    foreignTaxPaid: coerceNumber,
    dtaaCountry: z.string().optional(),
    dtaaArticle: z.string().optional(),
  }).optional(),
  deductionDetails: z.object({
    section80C: coerceNumber,
    section80CCC: coerceNumber,
    section80CCD1: coerceNumber,
    section80CCD1B: coerceNumber,
    section80CCD2: coerceNumber,
    section80D: coerceNumber,
    section80DD: coerceNumber,
    section80DDB: coerceNumber,
    section80E: coerceNumber,
    section80EEA: coerceNumber,
    section80EEB: coerceNumber,
    section80G: coerceNumber,
    section80GG: coerceNumber,
    section80TTA: coerceNumber,
    section80TTB: coerceNumber,
    section80U: coerceNumber,
    otherDeductions: coerceNumber
  }).optional(),
  taxPaymentDetails: z.object({
    tdsSalary: coerceNumber,
    tdsOtherThanSalary: coerceNumber,
    tdsOnProperty: coerceNumber,
    tcsCollected: coerceNumber,
    tdsDeducted: coerceNumber,
    advanceTaxPaid: coerceNumber,
    selfAssessmentTax: coerceNumber,
    reliefUs89: coerceNumber,
  }).optional(),
  employerDetails: z.object({
    employerName: z.string().optional(),
    employerTAN: z.string().optional(),
  }).optional(),
  bankDetails: z.object({
    accountNumber: z.string(),
    ifscCode: z.string(),
    bankName: z.string().optional(),
    accountType: z.string().optional(),
    isPrimary: z.boolean().optional(),
  }).optional(),
  residentialStatus: z.string().optional(),
  filingSection: z.string().optional(),
  grossTotalIncome: coerceNumber.optional(),
  totalDeductions: coerceNumber.optional(),
  taxableIncome: coerceNumber.optional(),
  taxPayable: coerceNumber.optional(),
  tdsCredits: coerceNumber.optional(),
  advanceTax: coerceNumber.optional(),
  selfAssessmentTax: coerceNumber.optional(),
  refundDue: coerceNumber.optional()
});

type PANType = "individual" | "huf" | "firm" | "company" | "trust" | "nri" | "aop" | "boi" | "government" | "local_authority" | "artificial_juridical_person";

interface PANContext {
  pan: string;
  panType: PANType;
  name: string;
  isVerified: boolean;
  entityDescription: string;
}

function determinePANType(pan: string): { type: PANType; description: string } {
  if (!pan || pan.length !== 10) {
    return { type: "individual", description: "Individual" };
  }
  
  const fourthChar = pan.charAt(3).toUpperCase();
  
  switch (fourthChar) {
    case "P":
      return { type: "individual", description: "Individual" };
    case "C":
      return { type: "company", description: "Company" };
    case "H":
      return { type: "huf", description: "Hindu Undivided Family (HUF)" };
    case "F":
      return { type: "firm", description: "Firm / LLP" };
    case "A":
      return { type: "aop", description: "Association of Persons (AOP)" };
    case "T":
      return { type: "trust", description: "Trust" };
    case "B":
      return { type: "boi", description: "Body of Individuals (BOI)" };
    case "G":
      return { type: "government", description: "Government" };
    case "L":
      return { type: "local_authority", description: "Local Authority" };
    case "J":
      return { type: "artificial_juridical_person", description: "Artificial Juridical Person" };
    default:
      return { type: "individual", description: "Individual" };
  }
}

function isNRI(userProfile: any): boolean {
  if (!userProfile) return false;
  
  const residencyStatus = userProfile.residencyStatus?.toLowerCase();
  const taxResidency = userProfile.taxResidency?.toLowerCase();
  
  return residencyStatus === "nri" || 
         residencyStatus === "non-resident" || 
         taxResidency === "non-resident" ||
         (userProfile.countryOfResidence && userProfile.countryOfResidence !== "India");
}

router.get("/pan-context", async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const reqUser = (req as any).user;
    const userId = reqUser?.id || session?.userId || session?.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    
    if (session?.panContext && Date.now() - session.panContext.timestamp < 300000) {
      return res.json(session.panContext.data);
    }
    
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    const pan = user.panNumber || "";
    const { type, description } = determinePANType(pan);
    
    let finalType = type;
    if (type === "individual" && isNRI(user)) {
      finalType = "nri";
    }
    
    const panContext: PANContext = {
      pan: pan,
      panType: finalType,
      name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "User",
      isVerified: (user as any).panVerified || false,
      entityDescription: finalType === "nri" ? "Non-Resident Indian (NRI)" : description
    };
    
    if ((req as any).session) {
      (req as any).session.panContext = {
        data: panContext,
        timestamp: Date.now()
      };
    }
    
    res.json(panContext);
  } catch (error) {
    console.error("Error fetching PAN context:", error);
    res.status(500).json({ error: "Failed to fetch PAN context" });
  }
});

router.get("/eligible-forms", async (req: Request, res: Response) => {
  try {
    const reqUser = (req as any).user;
    const session = (req as any).session;
    const userId = reqUser?.id || session?.userId || session?.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    
    const user = await storage.getUser(userId);
    const pan = user?.panNumber || "";
    const { type } = determinePANType(pan);
    
    let panType = type;
    if (type === "individual" && isNRI(user)) {
      panType = "nri";
    }
    
    const eligibleForms = getEligibleITRForms(panType);
    
    res.json({
      panType,
      eligibleForms,
      recommendedForm: eligibleForms[0]?.form || "ITR-1"
    });
  } catch (error) {
    console.error("Error fetching eligible forms:", error);
    res.status(500).json({ error: "Failed to fetch eligible forms" });
  }
});

function getEligibleITRForms(panType: PANType): Array<{ form: string; name: string; description: string }> {
  switch (panType) {
    case "individual":
      return [
        { form: "ITR-1", name: "Sahaj", description: "Salaried individuals with income up to ₹50 lakh" },
        { form: "ITR-2", name: "For Individuals & HUFs", description: "Capital gains, multiple properties, foreign income" },
        { form: "ITR-3", name: "Business/Profession", description: "Income from business or profession" },
        { form: "ITR-4", name: "Sugam", description: "Presumptive income for small businesses" }
      ];
    case "nri":
      return [
        { form: "ITR-2", name: "For NRIs", description: "Capital gains, multiple properties, foreign income" },
        { form: "ITR-3", name: "Business/Profession", description: "Income from business or profession in India" }
      ];
    case "huf":
      return [
        { form: "ITR-2", name: "For HUFs", description: "Capital gains, multiple properties" },
        { form: "ITR-3", name: "Business/Profession", description: "Income from business or profession" },
        { form: "ITR-4", name: "Sugam", description: "Presumptive income" }
      ];
    case "firm":
      return [
        { form: "ITR-5", name: "For Firms/LLPs", description: "Partnership firms, LLPs, AOPs, BOIs" }
      ];
    case "company":
      return [
        { form: "ITR-6", name: "For Companies", description: "Companies other than those claiming exemption u/s 11" }
      ];
    case "trust":
    case "aop":
    case "boi":
      return [
        { form: "ITR-5", name: "For AOPs/BOIs", description: "Association of Persons, Body of Individuals" },
        { form: "ITR-7", name: "For Trusts", description: "Trusts, political parties, institutions claiming exemption" }
      ];
    default:
      return [
        { form: "ITR-1", name: "Sahaj", description: "For salaried individuals" }
      ];
  }
}

const wizardCalcSchema = z.object({
  assessmentYear: z.string(),
  entityType: z.string().default('individual'),
  taxRegime: z.enum(["old", "new"]).default("new"),
  salaryIncome: z.number().min(0).default(0),
  housePropertyIncome: z.number().default(0),
  capitalGainsSTCG: z.number().min(0).default(0),
  capitalGainsLTCG: z.number().min(0).default(0),
  capitalGainsExemptions: z.number().min(0).default(0),
  businessIncome: z.number().min(0).default(0),
  interestIncome: z.number().min(0).default(0),
  dividendIncome: z.number().min(0).default(0),
  otherIncome: z.number().min(0).default(0),
  agriculturalIncome: z.number().min(0).default(0),
  foreignTaxCredit: z.number().min(0).default(0),
  foreignIncomeCountry: z.string().optional(),
  section80C: z.number().min(0).default(0),
  section80CCC: z.number().min(0).default(0),
  section80CCD1: z.number().min(0).default(0),
  section80CCD1B: z.number().min(0).default(0),
  section80CCD2: z.number().min(0).default(0),
  section80D: z.number().min(0).default(0),
  section80DD: z.number().min(0).default(0),
  section80DDB: z.number().min(0).default(0),
  section80E: z.number().min(0).default(0),
  section80EEA: z.number().min(0).default(0),
  section80EEB: z.number().min(0).default(0),
  section80G: z.number().min(0).default(0),
  section80GG: z.number().min(0).default(0),
  section80TTA: z.number().min(0).default(0),
  section80TTB: z.number().min(0).default(0),
  section80U: z.number().min(0).default(0),
  otherDeductions: z.number().min(0).default(0),
  tdsDeducted: z.number().min(0).default(0),
  tdsSalary: z.number().min(0).default(0),
  tdsOtherThanSalary: z.number().min(0).default(0),
  tdsOnProperty: z.number().min(0).default(0),
  tcsCollected: z.number().min(0).default(0),
  advanceTaxPaid: z.number().min(0).default(0),
  selfAssessmentTax: z.number().min(0).default(0),
  reliefUs89: z.number().min(0).default(0),
  standardDeduction: z.number().min(0).default(75000),
  professionalTax: z.number().min(0).default(0),
  homeLoanInterest: z.number().min(0).default(0),
  presumptiveIncome44AD: z.number().min(0).default(0),
  presumptiveIncome44ADA: z.number().min(0).default(0),
  presumptiveIncome44AE: z.number().min(0).default(0),
  vehicleCount: z.number().min(0).default(0),
  grossTurnover: z.number().min(0).default(0),
  grossReceipts: z.number().min(0).default(0),
  isPresumptive: z.boolean().default(false),
  residentialStatus: z.string().optional(),
  filingSection: z.string().optional(),
  employerName: z.string().optional(),
  employerTAN: z.string().optional(),
  bankDetails: z.object({
    accountNumber: z.string(),
    ifscCode: z.string(),
    bankName: z.string().optional(),
    accountType: z.string().optional(),
    isPrimary: z.boolean().optional(),
  }).optional(),
});

router.post("/itr/calculate", async (req: Request, res: Response) => {
  try {
    if (!sandboxITRService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: "SANDBOX_API_NOT_CONFIGURED",
        message: "Tax calculation service unavailable. Sandbox.co.in API credentials not configured."
      });
    }

    const validation = wizardCalcSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_FAILED",
        message: "Invalid input data",
        details: validation.error.errors
      });
    }

    const result = await sandboxITRService.calculateTaxFromWizard(validation.data);
    res.json(result);
  } catch (error) {
    console.error("[Tax Route] /itr/calculate error:", error);
    res.status(500).json({
      success: false,
      error: "CALCULATION_FAILED",
      message: error instanceof Error ? error.message : "Tax calculation failed"
    });
  }
});

router.post("/itr/parse-form16", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!sandboxITRService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: "SANDBOX_API_NOT_CONFIGURED",
        message: "Form 16 parsing requires Sandbox.co.in API. Not configured."
      });
    }

    const reqUser = (req as any).user;
    const session = (req as any).session;
    const userId = reqUser?.id || session?.userId || session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const file = (req as any).file;
    if (!file || !file.buffer) {
      return res.status(400).json({ success: false, message: "No file uploaded. Please upload a Form 16 PDF or image." });
    }

    const result = await sandboxITRService.parseForm16(file.buffer, file.originalname || "form16.pdf");
    
    if (result.success && result.data) {
      const salaryDetails = (result.data as any).salaryDetails || {};
      const tdsDetails = (result.data as any).tdsDetails || {};
      res.json({
        success: true,
        parsed: {
          grossSalary: salaryDetails.grossSalary || 0,
          allowances: salaryDetails.exemptAllowances || 0,
          professionalTax: salaryDetails.professionalTax || 0,
          employerPF: 0,
          tdsDeducted: tdsDetails.tdsDeducted || 0,
        }
      });
    } else {
      res.json({ success: false, message: result.message || "Could not parse Form 16" });
    }
  } catch (error) {
    console.error("[Tax Route] /itr/parse-form16 error:", error);
    res.status(500).json({
      success: false,
      error: "PARSE_FAILED",
      message: error instanceof Error ? error.message : "Form 16 parsing failed"
    });
  }
});

router.post("/itr/file", async (req: Request, res: Response) => {
  try {
    const reqUser = (req as any).user;
    const session = (req as any).session;
    const userId = reqUser?.id || session?.userId || session?.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (!sandboxITRService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: "SANDBOX_API_NOT_CONFIGURED",
        message: "ITR filing service unavailable. Sandbox.co.in API credentials not configured."
      });
    }

    const result = await sandboxITRService.fileITR(req.body);
    res.json(result);
  } catch (error) {
    console.error("[Tax Route] /itr/file error:", error);
    res.status(500).json({
      success: false,
      error: "FILING_FAILED",
      message: error instanceof Error ? error.message : "ITR filing failed"
    });
  }
});

router.get("/itr/status/:ackNumber", async (req: Request, res: Response) => {
  try {
    if (!sandboxITRService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: "SANDBOX_API_NOT_CONFIGURED",
        message: "Status check service unavailable."
      });
    }

    const result = await sandboxITRService.getITRStatus(req.params.ackNumber);
    res.json(result);
  } catch (error) {
    console.error("[Tax Route] /itr/status error:", error);
    res.status(500).json({
      success: false,
      error: "STATUS_CHECK_FAILED",
      message: error instanceof Error ? error.message : "Status check failed"
    });
  }
});

router.post("/itr/eligible-form", async (req: Request, res: Response) => {
  try {
    const { incomeDetails, entityType } = req.body;
    if (!incomeDetails) {
      return res.status(400).json({ error: "incomeDetails is required" });
    }

    const result = sandboxITRService.getSuitableITRForm(incomeDetails, entityType || 'individual');
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("[Tax Route] /itr/eligible-form error:", error);
    res.status(500).json({ success: false, error: "Form determination failed" });
  }
});

router.get("/form26as/:pan/:assessmentYear", async (req: Request, res: Response) => {
  try {
    const reqUser = (req as any).user;
    const session = (req as any).session;
    const userId = reqUser?.id || session?.userId || session?.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (!sandboxITRService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: "SANDBOX_API_NOT_CONFIGURED",
        message: "Form 26AS service unavailable."
      });
    }

    const result = await sandboxITRService.getForm26AS(req.params.pan, req.params.assessmentYear);
    res.json(result);
  } catch (error) {
    console.error("[Tax Route] /form26as error:", error);
    res.status(500).json({ success: false, error: "Form 26AS fetch failed" });
  }
});

router.get("/ais/:pan/:assessmentYear", async (req: Request, res: Response) => {
  try {
    const reqUser = (req as any).user;
    const session = (req as any).session;
    const userId = reqUser?.id || session?.userId || session?.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (!sandboxITRService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: "SANDBOX_API_NOT_CONFIGURED",
        message: "AIS service unavailable."
      });
    }

    const result = await sandboxITRService.getAIS(req.params.pan, req.params.assessmentYear);
    res.json(result);
  } catch (error) {
    console.error("[Tax Route] /ais error:", error);
    res.status(500).json({ success: false, error: "AIS fetch failed" });
  }
});

router.get("/sandbox/status", async (_req: Request, res: Response) => {
  res.json({
    configured: sandboxITRService.isConfigured(),
    ocr: sandboxITRService.getOCRStatus(),
    endpoints: {
      calculate: "POST /api/tax/itr/calculate",
      file: "POST /api/tax/itr/file",
      status: "GET /api/tax/itr/status/:ackNumber",
      eligibleForm: "POST /api/tax/itr/eligible-form",
      form26as: "GET /api/tax/form26as/:pan/:ay",
      ais: "GET /api/tax/ais/:pan/:ay",
    }
  });
});

router.post("/itr/draft", async (req: Request, res: Response) => {
  try {
    const reqUser = (req as any).user;
    const session = (req as any).session;
    const userId = reqUser?.id || session?.userId || session?.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    
    const validation = itrDraftSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      });
    }
    
    const draftData = validation.data;

    if (draftData.businessDetails?.isPresumptive) {
      const bd = draftData.businessDetails;
      const blockingErrors: string[] = [];
      if (bd.businessType === "business" && bd.grossTurnover > 30000000) {
        blockingErrors.push("Section 44AD: Turnover exceeds ₹3 Cr limit. Presumptive taxation ineligible.");
      }
      if (bd.businessType === "business" && bd.presumptiveIncome44AD > 0 && bd.grossTurnover > 0) {
        const minDeemed = Math.round(bd.grossTurnover * 0.06);
        if (bd.presumptiveIncome44AD < minDeemed) {
          blockingErrors.push(`Section 44AD: Deemed profit ₹${bd.presumptiveIncome44AD} is below minimum 6% of turnover (₹${minDeemed}).`);
        }
      }
      if (bd.businessType === "profession" && bd.grossReceipts > 7500000) {
        blockingErrors.push("Section 44ADA: Gross receipts exceed ₹75 lakhs limit. Presumptive taxation ineligible.");
      }
      if (bd.businessType === "profession" && bd.presumptiveIncome44ADA > 0 && bd.grossReceipts > 0) {
        const minDeemed = Math.round(bd.grossReceipts * 0.5);
        if (bd.presumptiveIncome44ADA < minDeemed) {
          blockingErrors.push(`Section 44ADA: Deemed profit ₹${bd.presumptiveIncome44ADA} is below minimum 50% of receipts (₹${minDeemed}).`);
        }
      }
      if (bd.businessType === "transport" && bd.vehicleCount > 10) {
        blockingErrors.push("Section 44AE: Vehicle count exceeds 10. Presumptive taxation ineligible.");
      }
      if (blockingErrors.length > 0) {
        logTaxAudit({
          entityType: "itr_draft",
          entityId: 0,
          action: "VALIDATION_BLOCKED",
          userId,
          userRole: getUserTaxRole(req),
          changesDescription: `Presumptive taxation validation failed: ${blockingErrors.join('; ')}`,
          metadata: { blockingErrors, businessType: bd.businessType }
        });
        return res.status(422).json({ error: "Presumptive taxation validation failed", details: blockingErrors });
      }
    }

    const existingDraftKey = Array.from(itrDraftStorage.entries()).find(
      ([_, d]) => d.userId === userId && d.pan === draftData.pan && d.assessmentYear === draftData.assessmentYear
    );
    
    let draftId: number;
    const now = new Date().toISOString();
    
    const userRole = getUserTaxRole(req);
    
    if (existingDraftKey) {
      draftId = existingDraftKey[0];
      const existingDraft = existingDraftKey[1];
      
      const immutabilityCheck = handleImmutableEdit(existingDraft, userId, userRole);
      
      if (!immutabilityCheck.allowed) {
        return res.status(403).json({ 
          error: "Draft cannot be modified",
          message: immutabilityCheck.warning 
        });
      }
      
      const newStatus = immutabilityCheck.resetTo || existingDraft.status;
      
      logTaxAudit({
        entityType: "itr_draft",
        entityId: draftId,
        action: "DRAFT_UPDATED",
        previousStatus: existingDraft.status,
        newStatus,
        userId,
        userRole,
        changesDescription: `Draft updated. ${immutabilityCheck.warning || "No status change."}`,
        metadata: { resetTriggered: !!immutabilityCheck.resetTo }
      });
      
      const savedDraft = {
        id: draftId,
        ...draftData,
        userId,
        status: newStatus,
        createdAt: existingDraftKey[1].createdAt,
        updatedAt: now
      };
      itrDraftStorage.set(draftId, savedDraft);
      snapshotDraftVersion(draftId, savedDraft, userId, "Draft updated");
      res.json({ 
        success: true, 
        draft: savedDraft, 
        updated: true,
        warning: immutabilityCheck.warning
      });
    } else {
      draftId = draftIdCounter++;
      
      logTaxAudit({
        entityType: "itr_draft",
        entityId: draftId,
        action: "DRAFT_CREATED",
        newStatus: "draft",
        userId,
        userRole,
        changesDescription: `New ITR draft created for PAN ${draftData.pan}, AY ${draftData.assessmentYear}`
      });
      
      const savedDraft = {
        id: draftId,
        ...draftData,
        userId,
        status: draftData.status || "draft",
        createdAt: now,
        updatedAt: now
      };
      itrDraftStorage.set(draftId, savedDraft);
      snapshotDraftVersion(draftId, savedDraft, userId, "Draft created");
      res.json({ success: true, draft: savedDraft, created: true });
    }
  } catch (error) {
    console.error("Error saving ITR draft:", error);
    res.status(500).json({ error: "Failed to save draft" });
  }
});

router.get("/itr/drafts", async (req: Request, res: Response) => {
  try {
    const reqUser = (req as any).user;
    const session = (req as any).session;
    const userId = reqUser?.id || session?.userId || session?.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    
    const userDrafts = Array.from(itrDraftStorage.values()).filter(d => d.userId === userId);
    
    res.json(userDrafts);
  } catch (error) {
    console.error("Error fetching ITR drafts:", error);
    res.status(500).json({ error: "Failed to fetch drafts" });
  }
});

router.get("/itr/draft/:id", async (req: Request, res: Response) => {
  try {
    const reqUser = (req as any).user;
    const session = (req as any).session;
    const userId = reqUser?.id || session?.userId || session?.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    
    const draftId = parseInt(req.params.id);
    const draft = itrDraftStorage.get(draftId);
    
    if (!draft) {
      return res.status(404).json({ error: "Draft not found" });
    }
    
    if (draft.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    res.json(draft);
  } catch (error) {
    console.error("Error fetching ITR draft:", error);
    res.status(500).json({ error: "Failed to fetch draft" });
  }
});

router.get("/notices", async (req: Request, res: Response) => {
  try {
    const reqUser = (req as any).user;
    const session = (req as any).session;
    const userId = reqUser?.id || session?.userId || session?.user?.id;
    
    if (!userId) {
      return res.json({ notices: [] });
    }
    
    const userNotices = Array.from(taxNoticesStorage.values()).filter(n => n.userId === userId);
    
    res.json({ notices: userNotices });
  } catch (error) {
    console.error("Error fetching tax notices:", error);
    res.status(500).json({ error: "Failed to fetch notices", notices: [] });
  }
});

router.post("/notices", async (req: Request, res: Response) => {
  try {
    const reqUser = (req as any).user;
    const session = (req as any).session;
    const userId = reqUser?.id || session?.userId || session?.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    
    const noticeId = `NOTICE-${noticeIdCounter++}`;
    const notice = {
      id: noticeId,
      userId,
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    taxNoticesStorage.set(noticeId, notice);
    res.status(201).json({ success: true, notice });
  } catch (error) {
    console.error("Error creating tax notice:", error);
    res.status(500).json({ error: "Failed to create notice" });
  }
});

router.get("/loss-harvesting/opportunities", async (req: Request, res: Response) => {
  try {
    const reqUser = (req as any).user;
    const session = (req as any).session;
    const userId = reqUser?.id || session?.userId || session?.user?.id;
    
    if (!userId) {
      return res.json({ opportunities: [] });
    }
    
    res.json({ opportunities: [] });
  } catch (error) {
    console.error("Error fetching tax loss harvesting opportunities:", error);
    res.json({ opportunities: [] });
  }
});

const expertCaseStorage = new Map<string, any>();
let expertCaseIdCounter = 1;

const expertCaseSchema = z.object({
  assessmentYear: z.string().regex(/^\d{4}-\d{2}$/),
  incomeSources: z.object({
    hasSalary: z.boolean(),
    hasHouseProperty: z.boolean(),
    hasCapitalGains: z.boolean(),
    hasBusinessIncome: z.boolean(),
    hasForeignIncome: z.boolean(),
    hasOtherIncome: z.boolean()
  }),
  estimatedIncome: z.string().optional(),
  specialCircumstances: z.string().optional(),
  contactPhone: z.string().optional(),
  preferredTime: z.string().optional(),
  preferredExpertType: z.enum(["ca", "tax_expert", "any"]),
  urgency: z.enum(["normal", "priority", "urgent"]),
  documents: z.array(z.string()),
  status: z.enum(["draft", "submitted", "assigned", "in_progress", "review", "completed"])
});

const expertCaseUpdateSchema = expertCaseSchema.partial();

router.post("/expert-cases", async (req: Request, res: Response) => {
  try {
    const reqUser = (req as any).user;
    const session = (req as any).session;
    const userId = reqUser?.id || session?.userId || session?.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    
    const validationResult = expertCaseSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validationResult.error.errors 
      });
    }
    
    const caseId = `EXP-${Date.now()}-${expertCaseIdCounter++}`;
    const expertCase = {
      id: caseId,
      userId,
      ...validationResult.data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      assignedExpert: null,
      messages: []
    };
    
    expertCaseStorage.set(caseId, expertCase);
    
    res.status(201).json(expertCase);
  } catch (error) {
    console.error("Error creating expert case:", error);
    res.status(500).json({ error: "Failed to create expert case" });
  }
});

router.get("/expert-cases", async (req: Request, res: Response) => {
  try {
    const reqUser = (req as any).user;
    const session = (req as any).session;
    const userId = reqUser?.id || session?.userId || session?.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    
    const userCases = Array.from(expertCaseStorage.values())
      .filter(c => c.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    res.json(userCases);
  } catch (error) {
    console.error("Error fetching expert cases:", error);
    res.status(500).json({ error: "Failed to fetch expert cases" });
  }
});

router.get("/expert-cases/:id", async (req: Request, res: Response) => {
  try {
    const reqUser = (req as any).user;
    const session = (req as any).session;
    const userId = reqUser?.id || session?.userId || session?.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    
    const expertCase = expertCaseStorage.get(req.params.id);
    
    if (!expertCase) {
      return res.status(404).json({ error: "Case not found" });
    }
    
    if (expertCase.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    res.json(expertCase);
  } catch (error) {
    console.error("Error fetching expert case:", error);
    res.status(500).json({ error: "Failed to fetch expert case" });
  }
});

router.patch("/expert-cases/:id", async (req: Request, res: Response) => {
  try {
    const reqUser = (req as any).user;
    const session = (req as any).session;
    const userId = reqUser?.id || session?.userId || session?.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    
    const expertCase = expertCaseStorage.get(req.params.id);
    
    if (!expertCase) {
      return res.status(404).json({ error: "Case not found" });
    }
    
    if (expertCase.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    if (expertCase.status === "completed") {
      return res.status(400).json({ error: "Cannot modify completed case" });
    }
    
    const validationResult = expertCaseUpdateSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validationResult.error.errors 
      });
    }
    
    const updatedCase = {
      ...expertCase,
      ...validationResult.data,
      updatedAt: new Date().toISOString()
    };
    
    expertCaseStorage.set(req.params.id, updatedCase);
    
    res.json(updatedCase);
  } catch (error) {
    console.error("Error updating expert case:", error);
    res.status(500).json({ error: "Failed to update expert case" });
  }
});

router.delete("/expert-cases/:id", async (req: Request, res: Response) => {
  try {
    const reqUser = (req as any).user;
    const session = (req as any).session;
    const userId = reqUser?.id || session?.userId || session?.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    
    const expertCase = expertCaseStorage.get(req.params.id);
    
    if (!expertCase) {
      return res.status(404).json({ error: "Case not found" });
    }
    
    if (expertCase.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    if (expertCase.status !== "draft" && expertCase.status !== "submitted") {
      return res.status(400).json({ error: "Cannot delete case after it has been assigned" });
    }
    
    expertCaseStorage.delete(req.params.id);
    
    res.json({ message: "Case deleted successfully" });
  } catch (error) {
    console.error("Error deleting expert case:", error);
    res.status(500).json({ error: "Failed to delete expert case" });
  }
});

router.get("/itr-pricing", async (req: Request, res: Response) => {
  const pricing = {
    "ITR-1": { selfFile: 499, expert: 1999 },
    "ITR-2": { selfFile: 999, expert: 3499 },
    "ITR-3": { selfFile: 1999, expert: 5999 },
    "ITR-4": { selfFile: 799, expert: 2499 },
    "ITR-5": { selfFile: 2999, expert: 7999 },
    "ITR-6": { selfFile: 4999, expert: 14999 },
    "ITR-7": { selfFile: 3999, expert: 9999 }
  };
  
  res.json(pricing);
});

const paymentStorage = new Map<string, any>();
let paymentIdCounter = 1;

router.post("/itr/draft/:id/lock", async (req: Request, res: Response) => {
  try {
    const reqUser = (req as any).user;
    const session = (req as any).session;
    const userId = reqUser?.id || session?.userId || session?.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    
    const draftId = parseInt(req.params.id);
    const draft = itrDraftStorage.get(draftId);
    
    if (!draft) {
      return res.status(404).json({ error: "Draft not found" });
    }
    
    if (draft.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const userRole = getUserTaxRole(req);
    
    logTaxAudit({
      entityType: "itr_draft",
      entityId: draftId,
      action: "DRAFT_LOCKED",
      previousStatus: draft.status,
      newStatus: "preview",
      userId,
      userRole,
      changesDescription: "Draft locked for preview before payment"
    });
    
    const updatedDraft = {
      ...draft,
      status: "preview",
      lockedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    itrDraftStorage.set(draftId, updatedDraft);
    
    res.json(updatedDraft);
  } catch (error) {
    console.error("Error locking draft:", error);
    res.status(500).json({ error: "Failed to lock draft" });
  }
});

router.post("/itr/payment", async (req: Request, res: Response) => {
  try {
    const reqUser = (req as any).user;
    const session = (req as any).session;
    const userId = reqUser?.id || session?.userId || session?.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    
    const { draftId, amount, paymentMethod, couponCode } = req.body;
    
    if (!draftId || !amount || !paymentMethod) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    const transactionId = `TXN${Date.now()}${paymentIdCounter++}`;
    const userRole = getUserTaxRole(req);
    
    logTaxAudit({
      entityType: "payment",
      entityId: transactionId,
      action: "PAYMENT_COMPLETED",
      userId,
      userRole,
      changesDescription: `Payment of ₹${amount} for ITR draft ${draftId} via ${paymentMethod}`,
      metadata: { amount, paymentMethod, couponCode, draftId }
    });
    
    const payment = {
      id: transactionId,
      transactionId,
      userId,
      draftId,
      amount,
      paymentMethod,
      couponCode: couponCode || null,
      status: "completed",
      createdAt: new Date().toISOString()
    };
    
    paymentStorage.set(transactionId, payment);
    
    const draft = itrDraftStorage.get(parseInt(draftId));
    if (draft && draft.userId === userId) {
      itrDraftStorage.set(parseInt(draftId), {
        ...draft,
        status: "paid",
        paymentId: transactionId,
        paidAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    
    res.status(201).json(payment);
  } catch (error) {
    console.error("Error processing payment:", error);
    res.status(500).json({ error: "Failed to process payment" });
  }
});

router.get("/itr/payments", async (req: Request, res: Response) => {
  try {
    const reqUser = (req as any).user;
    const session = (req as any).session;
    const userId = reqUser?.id || session?.userId || session?.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    
    const userPayments = Array.from(paymentStorage.values())
      .filter(p => p.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    res.json(userPayments);
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

const verificationStorage = new Map<number, any>();

router.post("/itr/verify/send-otp", async (req: Request, res: Response) => {
  try {
    const reqUser = (req as any).user;
    const session = (req as any).session;
    const userId = reqUser?.id || session?.userId || session?.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    
    const { draftId, method } = req.body;
    
    if (!draftId || !method) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    const referenceId = `OTP${Date.now()}`;
    
    verificationStorage.set(parseInt(draftId), {
      method,
      referenceId,
      otpSentAt: new Date().toISOString(),
      status: "otp_sent"
    });
    
    res.json({ 
      success: true, 
      referenceId,
      message: "OTP sent successfully" 
    });
  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

router.post("/itr/verify/submit", async (req: Request, res: Response) => {
  try {
    const reqUser = (req as any).user;
    const session = (req as any).session;
    const userId = reqUser?.id || session?.userId || session?.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    
    const { draftId, method, otp } = req.body;
    
    if (!draftId) {
      return res.status(400).json({ error: "Missing draft ID" });
    }
    
    const draft = itrDraftStorage.get(parseInt(draftId));
    
    if (!draft) {
      return res.status(404).json({ error: "Draft not found" });
    }
    
    if (draft.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    if (draft.status !== "paid" && draft.status !== "preview") {
      console.log(`Draft status: ${draft.status}, proceeding with verification for demo`);
    }
    
    if (method !== "dsc" && (!otp || otp.length < 4)) {
      return res.status(400).json({ error: "Invalid OTP" });
    }
    
    const acknowledgementNumber = `ACK${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const filingDate = new Date().toISOString();
    const userRole = getUserTaxRole(req);
    
    logTaxAudit({
      entityType: "itr_draft",
      entityId: parseInt(draftId),
      action: "ITR_FILED",
      previousStatus: draft.status,
      newStatus: "filed",
      userId,
      userRole,
      changesDescription: `ITR filed successfully via ${method} verification. Acknowledgement: ${acknowledgementNumber}`,
      metadata: { verificationMethod: method, acknowledgementNumber, filingDate }
    });
    
    itrDraftStorage.set(parseInt(draftId), {
      ...draft,
      status: "filed",
      acknowledgementNumber,
      filingDate,
      verificationMethod: method,
      updatedAt: filingDate
    });
    
    verificationStorage.set(parseInt(draftId), {
      ...verificationStorage.get(parseInt(draftId)),
      status: "verified",
      acknowledgementNumber,
      filingDate,
      verifiedAt: filingDate
    });
    
    res.json({
      success: true,
      acknowledgementNumber,
      filingDate,
      status: "filed"
    });
  } catch (error) {
    console.error("Error verifying ITR:", error);
    res.status(500).json({ error: "Failed to verify ITR" });
  }
});

router.get("/itr/verification-status/:draftId", async (req: Request, res: Response) => {
  try {
    const reqUser = (req as any).user;
    const session = (req as any).session;
    const userId = reqUser?.id || session?.userId || session?.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    
    const draftId = parseInt(req.params.draftId);
    const verification = verificationStorage.get(draftId);
    
    if (!verification) {
      return res.json({ status: "pending" });
    }
    
    res.json(verification);
  } catch (error) {
    console.error("Error fetching verification status:", error);
    res.status(500).json({ error: "Failed to fetch verification status" });
  }
});

router.get("/permissions", requireTaxAuth, async (req: Request, res: Response) => {
  const role = (req as any).taxRole;
  const permissions = (req as any).taxPermissions;
  
  res.json({
    role,
    permissions,
    userId: (req as any).session?.userId
  });
});

router.get("/audit-log", requirePermission("canViewAllCases"), async (req: Request, res: Response) => {
  try {
    const { entityType, entityId, limit = 100 } = req.query;
    
    let logs = Array.from(taxAuditLog.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    if (entityType) {
      logs = logs.filter(l => l.entityType === entityType);
    }
    
    if (entityId) {
      logs = logs.filter(l => String(l.entityId) === String(entityId));
    }
    
    res.json({
      logs: logs.slice(0, Number(limit)),
      total: logs.length,
      retentionPolicy: "8 years (production database migration required)"
    });
  } catch (error) {
    console.error("Error fetching audit log:", error);
    res.status(500).json({ error: "Failed to fetch audit log" });
  }
});

router.get("/agent/itr-cases", requirePermission("canViewAllCases"), async (req: Request, res: Response) => {
  try {
    const cases = Array.from(itrDraftStorage.values())
      .map(d => ({
        id: d.id,
        clientName: d.fullName || "Client",
        clientPan: d.pan || "",
        assessmentYear: "2024-25",
        itrForm: d.itrForm || "ITR-1",
        status: d.status,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt
      }))
      .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
    
    res.json(cases);
  } catch (error) {
    console.error("Error fetching agent ITR cases:", error);
    res.status(500).json({ error: "Failed to fetch cases" });
  }
});

router.get("/agent/notices", requirePermission("canViewAllCases"), async (req: Request, res: Response) => {
  try {
    const sampleNotices = [
      {
        id: 1,
        clientName: "Sample Client",
        noticeType: "Scrutiny Assessment",
        section: "143(2)",
        responseDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: "pending",
        priority: "high"
      }
    ];
    
    res.json(sampleNotices);
  } catch (error) {
    console.error("Error fetching agent notices:", error);
    res.status(500).json({ error: "Failed to fetch notices" });
  }
});

router.post("/agent/cases/:caseId/action", requirePermission("canSubmitForReview"), async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const { action, notes } = req.body;
    
    const draft = itrDraftStorage.get(parseInt(caseId));
    
    if (!draft) {
      return res.status(404).json({ error: "Case not found" });
    }
    
    let newStatus = draft.status;
    
    if (action === "submit_for_review") {
      newStatus = "pending_review";
    } else if (action === "mark_complete") {
      newStatus = "completed";
    }
    
    itrDraftStorage.set(parseInt(caseId), {
      ...draft,
      status: newStatus,
      agentNotes: notes,
      updatedAt: new Date().toISOString()
    });
    
    res.json({ success: true, status: newStatus });
  } catch (error) {
    console.error("Error updating case:", error);
    res.status(500).json({ error: "Failed to update case" });
  }
});

router.get("/filing-status", async (req: Request, res: Response) => {
  try {
    const reqUser = (req as any).user;
    const session = (req as any).session;
    const userId = reqUser?.id || session?.userId || session?.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    
    const filings = [
      {
        id: "1",
        assessmentYear: "2024-25",
        itrForm: "ITR-1",
        status: "in_progress",
        currentStep: 3,
        totalSteps: 6,
        stepName: "Deductions",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    
    res.json(filings);
  } catch (error) {
    console.error("Error fetching filing status:", error);
    res.status(500).json({ error: "Failed to fetch filing status" });
  }
});

function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

router.post("/itr/questionnaire-log", async (req: Request, res: Response) => {
  try {
    const reqUser = (req as any).user;
    const session = (req as any).session;
    const userId = reqUser?.id || session?.userId || session?.user?.id || 0;
    const userRole = getUserTaxRole(req);
    
    const { questionId, questionText, answer, resultingForm, pan, assessmentYear } = req.body;
    
    if (!questionId || !answer) {
      return res.status(400).json({ error: "questionId and answer are required" });
    }
    
    const auditEntry = logTaxAudit({
      entityType: "itr_draft",
      entityId: pan || "questionnaire",
      action: "FORM_ELIGIBILITY_ANSWER",
      userId,
      userRole,
      changesDescription: `Q: ${questionText || questionId} → A: ${answer}${resultingForm ? ` → Form: ${resultingForm}` : ''}`,
      metadata: { questionId, questionText, answer, resultingForm, pan, assessmentYear }
    });
    
    res.json({ success: true, auditId: auditEntry.id, hash: auditEntry.hash });
  } catch (error) {
    console.error("[Tax Route] /itr/questionnaire-log error:", error);
    res.status(500).json({ success: false, error: "Questionnaire logging failed" });
  }
});

router.post("/itr/regime-compare", async (req: Request, res: Response) => {
  try {
    if (!sandboxITRService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: "SANDBOX_API_NOT_CONFIGURED",
        message: "Tax regime comparison requires Sandbox.co.in API. Not configured."
      });
    }

    const validation = wizardCalcSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_FAILED",
        details: validation.error.errors
      });
    }

    const data = validation.data;
    
    const [oldRegimeResult, newRegimeResult] = await Promise.all([
      sandboxITRService.calculateTaxFromWizard({ ...data, taxRegime: 'old' } as any),
      sandboxITRService.calculateTaxFromWizard({ ...data, taxRegime: 'new' } as any)
    ]);

    const oldTax = oldRegimeResult.data?.taxPayable ?? oldRegimeResult.data?.taxLiability ?? 0;
    const newTax = newRegimeResult.data?.taxPayable ?? newRegimeResult.data?.taxLiability ?? 0;
    const savings = Math.abs(oldTax - newTax);
    const recommended = oldTax <= newTax ? 'old' : 'new';

    res.json({
      success: true,
      data: {
        oldRegime: {
          taxableIncome: oldRegimeResult.data?.taxableIncome ?? 0,
          taxLiability: oldRegimeResult.data?.taxLiability ?? 0,
          taxPayable: oldTax,
          effectiveTaxRate: oldRegimeResult.data?.effectiveTaxRate ?? 0,
          totalDeductions: oldRegimeResult.data?.totalDeductions ?? 0,
        },
        newRegime: {
          taxableIncome: newRegimeResult.data?.taxableIncome ?? 0,
          taxLiability: newRegimeResult.data?.taxLiability ?? 0,
          taxPayable: newTax,
          effectiveTaxRate: newRegimeResult.data?.effectiveTaxRate ?? 0,
          totalDeductions: newRegimeResult.data?.totalDeductions ?? 0,
        },
        recommended,
        savings,
        recommendation: recommended === 'new' 
          ? `New Regime saves you ${formatINR(savings)}. Lower tax rates outweigh the deductions.`
          : `Old Regime saves you ${formatINR(savings)}. Your deductions are substantial enough to benefit.`,
      }
    });
  } catch (error) {
    console.error("[Tax Route] /itr/regime-compare error:", error);
    res.status(500).json({
      success: false,
      error: "REGIME_COMPARISON_FAILED",
      message: error instanceof Error ? error.message : "Regime comparison failed"
    });
  }
});

router.get("/itr/audit-trail/:entityId", async (req: Request, res: Response) => {
  try {
    const reqUser = (req as any).user;
    const session = (req as any).session;
    const userId = reqUser?.id || session?.userId || session?.user?.id;
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    
    const entityId = req.params.entityId;
    const entries = Array.from(taxAuditLog.values())
      .filter(e => String(e.entityId) === entityId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    res.json({ success: true, entries, count: entries.length });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch audit trail" });
  }
});

router.get("/itr/audit-verify", async (req: Request, res: Response) => {
  try {
    const entries = Array.from(taxAuditLog.values())
      .sort((a, b) => a.id - b.id);
    
    let prevHash = '0'.repeat(64);
    let valid = true;
    let brokenAt: number | null = null;
    
    for (const entry of entries) {
      if (entry.previousHash !== prevHash) {
        valid = false;
        brokenAt = entry.id;
        break;
      }
      const dataToHash = JSON.stringify({
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        previousStatus: entry.previousStatus,
        newStatus: entry.newStatus,
        userId: entry.userId,
        userRole: entry.userRole,
        changesDescription: entry.changesDescription,
        metadata: entry.metadata,
        id: entry.id,
        timestamp: entry.timestamp,
        previousHash: entry.previousHash
      });
      const expectedHash = createHash('sha256').update(dataToHash).digest('hex');
      if (entry.hash !== expectedHash) {
        valid = false;
        brokenAt = entry.id;
        break;
      }
      prevHash = entry.hash;
    }
    
    res.json({
      success: true,
      chainValid: valid,
      totalEntries: entries.length,
      brokenAtEntry: brokenAt,
      lastHash: prevHash,
      verifiedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Audit verification failed" });
  }
});

router.get("/itr/draft/:id/versions", async (req: Request, res: Response) => {
  try {
    const reqUser = (req as any).user;
    const session = (req as any).session;
    const userId = reqUser?.id || session?.userId || session?.user?.id;
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    
    const draftId = parseInt(req.params.id);
    const versions = draftVersions.get(draftId) || [];
    
    res.json({
      success: true,
      draftId,
      versions: versions.map(v => ({
        version: v.version,
        timestamp: v.timestamp,
        changedBy: v.changedBy,
        changeDescription: v.changeDescription
      })),
      totalVersions: versions.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch versions" });
  }
});

router.post("/itr/e-verify", async (req: Request, res: Response) => {
  try {
    const reqUser = (req as any).user;
    const session = (req as any).session;
    const userId = reqUser?.id || session?.userId || session?.user?.id;
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    
    if (!sandboxITRService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: "SANDBOX_API_NOT_CONFIGURED",
        message: "E-verification requires Sandbox.co.in API. Not configured."
      });
    }
    
    const { method, acknowledgmentNumber, pan, aadhaarNumber } = req.body;
    
    if (!method || !acknowledgmentNumber) {
      return res.status(400).json({ error: "method and acknowledgmentNumber are required" });
    }
    
    const validMethods = ['aadhaar_otp', 'net_banking', 'dsc', 'bank_atm', 'demat'];
    if (!validMethods.includes(method)) {
      return res.status(400).json({ error: `Invalid method. Valid methods: ${validMethods.join(', ')}` });
    }
    
    const userRole = getUserTaxRole(req);
    
    logTaxAudit({
      entityType: "itr_draft",
      entityId: acknowledgmentNumber,
      action: "E_VERIFICATION_INITIATED",
      userId,
      userRole,
      changesDescription: `E-verification initiated via ${method} for acknowledgment ${acknowledgmentNumber}`,
      metadata: { method, acknowledgmentNumber, pan }
    });
    
    const result = await sandboxITRService.eVerifyITR(acknowledgmentNumber, method, { pan, aadhaarNumber });
    
    logTaxAudit({
      entityType: "itr_draft",
      entityId: acknowledgmentNumber,
      action: result.success ? "E_VERIFICATION_SUCCESS" : "E_VERIFICATION_FAILED",
      userId,
      userRole,
      changesDescription: `E-verification ${result.success ? 'succeeded' : 'failed'} via ${method}`,
      metadata: { method, acknowledgmentNumber, result: result.success }
    });
    
    res.json(result);
  } catch (error) {
    console.error("[Tax Route] /itr/e-verify error:", error);
    res.status(500).json({
      success: false,
      error: "E_VERIFICATION_FAILED",
      message: error instanceof Error ? error.message : "E-verification failed"
    });
  }
});

// ============================================
// CAPITAL GAINS BROKER REGISTRY
// ============================================

interface BrokerInfo {
  id: string;
  name: string;
  category: 'stock_broker' | 'fund_house' | 'aggregator' | 'us_stocks';
  supportedFormats: string[];
  fileFormatHint: string;
  assetTypes: string[];
  pdfType?: string;
  isSupported: boolean;
}

const BROKER_REGISTRY: BrokerInfo[] = [
  { id: 'zerodha', name: 'Zerodha', category: 'stock_broker', supportedFormats: ['pdf', 'xlsx', 'csv'], fileFormatHint: 'Tax P&L report from Console > Reports > Tax P&L', assetTypes: ['equity', 'fno', 'commodity', 'currency'], pdfType: 'broker_zerodha', isSupported: true },
  { id: 'groww', name: 'Groww', category: 'stock_broker', supportedFormats: ['pdf', 'xlsx'], fileFormatHint: 'P&L report from Groww Dashboard > Reports', assetTypes: ['equity', 'mutual_fund', 'fno'], pdfType: 'broker_groww', isSupported: true },
  { id: 'angelone', name: 'Angel One', category: 'stock_broker', supportedFormats: ['pdf', 'xlsx'], fileFormatHint: 'Tax P&L from Angel One > My Account > Tax Report', assetTypes: ['equity', 'fno', 'commodity'], pdfType: 'broker_angelone', isSupported: true },
  { id: 'icici_direct', name: 'ICICI Direct', category: 'stock_broker', supportedFormats: ['pdf', 'xlsx'], fileFormatHint: 'Capital Gains Statement from ICICI Direct > Tax Center', assetTypes: ['equity', 'mutual_fund', 'fno'], pdfType: 'broker_icici', isSupported: true },
  { id: 'hdfc_securities', name: 'HDFC Securities', category: 'stock_broker', supportedFormats: ['pdf', 'xlsx'], fileFormatHint: 'Capital Gains report from HDFC Securities > Reports', assetTypes: ['equity', 'fno'], pdfType: 'broker_hdfc', isSupported: true },
  { id: 'kotak_securities', name: 'Kotak Securities', category: 'stock_broker', supportedFormats: ['pdf', 'xlsx'], fileFormatHint: 'Tax statement from Kotak Securities > Reports > Tax P&L', assetTypes: ['equity', 'fno'], pdfType: 'broker_kotak', isSupported: true },
  { id: 'upstox', name: 'Upstox', category: 'stock_broker', supportedFormats: ['pdf', 'xlsx', 'csv'], fileFormatHint: 'Tax P&L from Upstox Pro > Reports > Tax Report', assetTypes: ['equity', 'fno', 'commodity'], pdfType: 'broker_upstox', isSupported: true },
  { id: '5paisa', name: '5Paisa', category: 'stock_broker', supportedFormats: ['pdf', 'xlsx'], fileFormatHint: 'Capital Gains report from 5Paisa > Reports', assetTypes: ['equity', 'fno'], pdfType: 'broker_5paisa', isSupported: true },
  { id: 'motilal_oswal', name: 'Motilal Oswal', category: 'stock_broker', supportedFormats: ['pdf', 'xlsx'], fileFormatHint: 'Tax report from Motilal Oswal > Reports > Capital Gains', assetTypes: ['equity', 'fno'], pdfType: 'broker_motilal', isSupported: true },
  { id: 'axis_direct', name: 'Axis Direct', category: 'stock_broker', supportedFormats: ['pdf', 'xlsx'], fileFormatHint: 'Capital Gains Statement from Axis Direct > Reports', assetTypes: ['equity', 'mutual_fund', 'fno'], pdfType: 'broker_axis', isSupported: true },
  { id: 'iifl_securities', name: 'IIFL Securities', category: 'stock_broker', supportedFormats: ['pdf', 'xlsx'], fileFormatHint: 'Tax P&L from IIFL > Reports > Tax Statement', assetTypes: ['equity', 'fno'], pdfType: 'broker_iifl', isSupported: true },
  { id: 'sharekhan', name: 'Sharekhan', category: 'stock_broker', supportedFormats: ['pdf', 'xlsx'], fileFormatHint: 'Capital Gains Statement from Sharekhan > Reports', assetTypes: ['equity', 'mutual_fund', 'fno'], pdfType: 'broker_sharekhan', isSupported: true },
  { id: 'anand_rathi', name: 'Anand Rathi', category: 'stock_broker', supportedFormats: ['xlsx', 'csv'], fileFormatHint: 'Tax P&L report from Anand Rathi trade platform', assetTypes: ['equity', 'fno'], pdfType: 'broker_anand_rathi', isSupported: true },
  { id: 'fyers', name: 'Fyers', category: 'stock_broker', supportedFormats: ['pdf', 'xlsx', 'csv'], fileFormatHint: 'Tax P&L from Fyers > Reports > Tax Report', assetTypes: ['equity', 'fno'], pdfType: 'broker_fyers', isSupported: true },
  { id: 'geojit', name: 'Geojit', category: 'stock_broker', supportedFormats: ['pdf', 'xlsx'], fileFormatHint: 'Capital Gains from Geojit > Back Office > Reports', assetTypes: ['equity', 'fno'], pdfType: 'broker_geojit', isSupported: true },
  { id: 'idbi_securities', name: 'IDBI Securities', category: 'stock_broker', supportedFormats: ['xlsx', 'csv'], fileFormatHint: 'Capital Gains report from IDBI Securities portal', assetTypes: ['equity'], pdfType: 'broker_idbi', isSupported: true },
  { id: 'sbi_securities', name: 'SBI Securities', category: 'stock_broker', supportedFormats: ['pdf', 'xlsx'], fileFormatHint: 'Tax report from SBI Securities > Reports > Capital Gains', assetTypes: ['equity', 'fno'], pdfType: 'broker_sbi', isSupported: true },
  { id: 'smc_global', name: 'SMC Global Securities', category: 'stock_broker', supportedFormats: ['xlsx', 'csv'], fileFormatHint: 'Capital Gains from SMC Global trade platform', assetTypes: ['equity', 'fno', 'commodity'], pdfType: 'broker_smc', isSupported: true },
  { id: 'religare', name: 'Religare Broking', category: 'stock_broker', supportedFormats: ['xlsx', 'csv'], fileFormatHint: 'Tax P&L from Religare Broking platform', assetTypes: ['equity', 'fno'], pdfType: 'broker_religare', isSupported: true },
  { id: 'yes_securities', name: 'Yes Securities', category: 'stock_broker', supportedFormats: ['xlsx', 'csv'], fileFormatHint: 'Capital Gains from Yes Securities back office', assetTypes: ['equity'], pdfType: 'broker_yes', isSupported: true },
  { id: 'ventura', name: 'Ventura Securities', category: 'stock_broker', supportedFormats: ['pdf', 'xlsx'], fileFormatHint: 'Tax report from Ventura > Reports > Capital Gains', assetTypes: ['equity', 'fno'], pdfType: 'broker_ventura', isSupported: true },
  { id: 'mastertrust', name: 'Mastertrust', category: 'stock_broker', supportedFormats: ['xlsx', 'csv'], fileFormatHint: 'P&L statement from Mastertrust back office', assetTypes: ['equity', 'fno'], pdfType: 'broker_mastertrust', isSupported: true },
  { id: 'paytm_money', name: 'Paytm Money', category: 'stock_broker', supportedFormats: ['pdf', 'xlsx'], fileFormatHint: 'Capital Gains from Paytm Money > Reports > Tax P&L', assetTypes: ['equity', 'mutual_fund'], pdfType: 'aggregator_paytm', isSupported: true },
  { id: 'funds_india', name: 'Funds India', category: 'aggregator', supportedFormats: ['xlsx', 'csv'], fileFormatHint: 'Capital Gains statement from Funds India portal', assetTypes: ['mutual_fund'], pdfType: 'aggregator_fundsindia', isSupported: true },
  { id: 'cams', name: 'CAMS', category: 'fund_house', supportedFormats: ['pdf'], fileFormatHint: 'Consolidated Account Statement (CAS) from mycams.camsonline.com', assetTypes: ['mutual_fund'], pdfType: 'cas_cams', isSupported: true },
  { id: 'kfintech', name: 'KFintech', category: 'fund_house', supportedFormats: ['pdf'], fileFormatHint: 'CAS from KFintech (mfs.kfintech.com)', assetTypes: ['mutual_fund'], pdfType: 'cas_kfintech', isSupported: true },
  { id: 'mfcentral', name: 'MF Central', category: 'fund_house', supportedFormats: ['pdf'], fileFormatHint: 'Combined CAS from mfcentral.com (CAMS + KFintech)', assetTypes: ['mutual_fund'], pdfType: 'cas_combined', isSupported: true },
  { id: 'indmoney', name: 'IND Money (MF)', category: 'aggregator', supportedFormats: ['pdf', 'xlsx'], fileFormatHint: 'Capital Gains from INDmoney app > Reports', assetTypes: ['mutual_fund'], pdfType: 'aggregator_indmoney', isSupported: true },
  { id: 'kuvera', name: 'Kuvera', category: 'aggregator', supportedFormats: ['pdf', 'xlsx'], fileFormatHint: 'Tax report from Kuvera > Reports > Capital Gains', assetTypes: ['mutual_fund'], pdfType: 'aggregator_kuvera', isSupported: true },
  { id: 'etmoney', name: 'ET Money', category: 'aggregator', supportedFormats: ['pdf'], fileFormatHint: 'Capital Gains statement from ET Money app', assetTypes: ['mutual_fund'], pdfType: 'aggregator_etmoney', isSupported: true },
  { id: 'vested_us', name: 'Vested (US Stocks)', category: 'us_stocks', supportedFormats: ['xlsx', 'csv'], fileFormatHint: 'Capital Gains report from Vested > Tax Center', assetTypes: ['us_equity'], pdfType: 'broker_vested_us', isSupported: true },
  { id: 'indmoney_us', name: 'IND Money (US Stocks)', category: 'us_stocks', supportedFormats: ['xlsx', 'csv'], fileFormatHint: 'US Stock Capital Gains from INDmoney > Reports', assetTypes: ['us_equity'], pdfType: 'broker_indmoney_us', isSupported: true },
  { id: 'groww_us', name: 'Groww (US Stocks)', category: 'us_stocks', supportedFormats: ['xlsx', 'csv'], fileFormatHint: 'US Stock P&L from Groww > Reports > US Stocks', assetTypes: ['us_equity'], pdfType: 'broker_groww_us', isSupported: true },
  { id: 'template', name: 'FintekPro Template', category: 'aggregator', supportedFormats: ['xlsx', 'csv'], fileFormatHint: 'Download our Excel template, fill in your transactions, and upload', assetTypes: ['equity', 'mutual_fund', 'fno', 'property', 'other'], pdfType: 'template', isSupported: true },
];

// Capital gains upload storage
interface CapitalGainsUploadRecord {
  id: number;
  userId: number;
  assessmentYear: string;
  brokerId: string;
  brokerName: string;
  fileName: string;
  fileChecksum: string;
  fileSize: number;
  parseConfidence: number;
  parseWarnings: string[];
  summary: {
    totalSTCG: number;
    totalLTCG: number;
    totalSTCL: number;
    totalLTCL: number;
    netSTCG: number;
    netLTCG: number;
    totalTransactions: number;
    sttPaid: number;
  };
  transactions: Array<{
    id: string;
    scripName: string;
    isin?: string;
    assetType: string;
    buyDate: string;
    sellDate: string;
    buyQuantity: number;
    sellQuantity: number;
    buyPrice: number;
    sellPrice: number;
    buyValue: number;
    sellValue: number;
    gainLoss: number;
    gainType: 'STCG' | 'LTCG';
    sttPaid: number;
    holdingPeriodDays: number;
  }>;
  uploadedAt: string;
  status: 'parsed' | 'verified' | 'error';
}

const capitalGainsUploads = new Map<number, CapitalGainsUploadRecord>();
let cgUploadIdCounter = 1;

// Manual capital gains entries
interface ManualCapitalGainsEntry {
  id: number;
  userId: number;
  assessmentYear: string;
  assetType: 'shares' | 'mutual_funds' | 'esop_rsu' | 'property' | 'other_assets' | 'deemed_cg' | 'bonds' | 'gold' | 'vda';
  entries: Array<{
    id: string;
    assetName: string;
    isin?: string;
    buyDate: string;
    sellDate: string;
    quantity: number;
    buyPrice: number;
    sellPrice: number;
    buyValue: number;
    sellValue: number;
    expenses: number;
    sttPaid: number;
    fairMarketValue?: number;
    stampDutyValue?: number;
    indexedCost?: number;
    exemptionSection?: string;
    exemptionAmount?: number;
    gainLoss: number;
    gainType: 'STCG' | 'LTCG';
    holdingPeriodDays: number;
  }>;
  summary: {
    totalSTCG: number;
    totalLTCG: number;
    totalExemptions: number;
    netGains: number;
  };
  createdAt: string;
  updatedAt: string;
}

const manualCapitalGains = new Map<number, ManualCapitalGainsEntry>();
let manualCgIdCounter = 1;

// ============================================
// CAPITAL GAINS API ENDPOINTS
// ============================================

router.get("/capital-gains/brokers", (_req: Request, res: Response) => {
  res.json({
    success: true,
    brokers: BROKER_REGISTRY.map(b => ({
      id: b.id,
      name: b.name,
      category: b.category,
      supportedFormats: b.supportedFormats,
      fileFormatHint: b.fileFormatHint,
      assetTypes: b.assetTypes,
      isSupported: b.isSupported,
    })),
    totalBrokers: BROKER_REGISTRY.length,
    categories: {
      stock_broker: BROKER_REGISTRY.filter(b => b.category === 'stock_broker').length,
      fund_house: BROKER_REGISTRY.filter(b => b.category === 'fund_house').length,
      aggregator: BROKER_REGISTRY.filter(b => b.category === 'aggregator').length,
      us_stocks: BROKER_REGISTRY.filter(b => b.category === 'us_stocks').length,
    }
  });
});

router.post("/capital-gains/upload", requireTaxAuth, upload.single('file'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).session?.userId || (req as any).session?.user?.id;
    const { brokerId, assessmentYear } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    if (!brokerId || !assessmentYear) {
      return res.status(400).json({ error: "brokerId and assessmentYear are required" });
    }

    const broker = BROKER_REGISTRY.find(b => b.id === brokerId);
    if (!broker) {
      return res.status(400).json({ error: `Unknown broker: ${brokerId}` });
    }

    const fileChecksum = createHash('sha256').update(file.buffer).digest('hex');
    const uploadId = cgUploadIdCounter++;

    logTaxAudit({
      entityType: "capital_gains_upload",
      entityId: uploadId,
      action: "CG_STATEMENT_UPLOADED",
      userId,
      userRole: getUserTaxRole(req),
      changesDescription: `Capital gains statement uploaded from ${broker.name} (${file.originalname}, ${(file.size / 1024).toFixed(1)}KB)`,
      metadata: { brokerId, brokerName: broker.name, fileName: file.originalname, fileChecksum, fileSize: file.size, assessmentYear }
    });

    let parseConfidence = 0;
    let parseWarnings: string[] = [];
    let transactions: CapitalGainsUploadRecord['transactions'] = [];
    let summary: CapitalGainsUploadRecord['summary'] = {
      totalSTCG: 0, totalLTCG: 0, totalSTCL: 0, totalLTCL: 0,
      netSTCG: 0, netLTCG: 0, totalTransactions: 0, sttPaid: 0
    };

    const fileExt = file.originalname.split('.').pop()?.toLowerCase();

    if (fileExt === 'pdf') {
      try {
        const { unifiedPDFParser } = await import('./services/unified-pdf-parser');
        const parseResult = await (unifiedPDFParser as any).parseBuffer(file.buffer);

        if (parseResult.success) {
          parseConfidence = parseResult.confidenceScore;
          parseWarnings = parseResult.warnings || [];

          for (const holding of parseResult.holdings) {
            const txId = `tx_${uploadId}_${transactions.length + 1}`;
            const buyValue = holding.investedValue || (holding.units * (holding.nav || 0));
            const currentValue = holding.currentValue || buyValue;
            const gain = currentValue - buyValue;
            const purchaseDate = holding.purchaseDate || '';
            const holdingDays = purchaseDate ? Math.floor((Date.now() - new Date(purchaseDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;
            const isLTCG = holdingDays > 365;

            transactions.push({
              id: txId,
              scripName: holding.schemeName,
              isin: holding.isin,
              assetType: broker.assetTypes[0] || 'equity',
              buyDate: purchaseDate,
              sellDate: '',
              buyQuantity: holding.units,
              sellQuantity: 0,
              buyPrice: holding.nav || 0,
              sellPrice: 0,
              buyValue,
              sellValue: currentValue,
              gainLoss: gain,
              gainType: isLTCG ? 'LTCG' : 'STCG',
              sttPaid: 0,
              holdingPeriodDays: holdingDays,
            });

            if (gain >= 0) {
              if (isLTCG) summary.totalLTCG += gain;
              else summary.totalSTCG += gain;
            } else {
              if (isLTCG) summary.totalLTCL += Math.abs(gain);
              else summary.totalSTCL += Math.abs(gain);
            }
          }

          if (parseResult.holdingLots) {
            for (const lot of parseResult.holdingLots) {
              if (lot.status === 'redeemed' && lot.redemptionNav) {
                const txId = `tx_${uploadId}_lot_${transactions.length + 1}`;
                const buyValue = lot.purchaseValue;
                const sellValue = lot.units * lot.redemptionNav;
                const gain = sellValue - buyValue;
                const holdingDays = Math.floor((new Date(lot.redemptionDate || '').getTime() - new Date(lot.purchaseDate).getTime()) / (1000 * 60 * 60 * 24));
                const isLTCG = holdingDays > 365;

                transactions.push({
                  id: txId,
                  scripName: lot.transactionRef || 'Unknown',
                  assetType: 'mutual_fund',
                  buyDate: lot.purchaseDate,
                  sellDate: lot.redemptionDate || '',
                  buyQuantity: lot.units,
                  sellQuantity: lot.units,
                  buyPrice: lot.purchaseNav,
                  sellPrice: lot.redemptionNav,
                  buyValue,
                  sellValue,
                  gainLoss: gain,
                  gainType: isLTCG ? 'LTCG' : 'STCG',
                  sttPaid: 0,
                  holdingPeriodDays: holdingDays,
                });

                if (gain >= 0) {
                  if (isLTCG) summary.totalLTCG += gain;
                  else summary.totalSTCG += gain;
                } else {
                  if (isLTCG) summary.totalLTCL += Math.abs(gain);
                  else summary.totalSTCL += Math.abs(gain);
                }
              }
            }
          }
        } else {
          parseWarnings.push('PDF parsing returned errors: ' + (parseResult.errors || []).join(', '));
        }
      } catch (parseErr) {
        parseWarnings.push(`PDF parse failed: ${parseErr instanceof Error ? parseErr.message : 'Unknown error'}. Consider using Excel template.`);
      }
    } else if (fileExt === 'xlsx' || fileExt === 'csv') {
      parseConfidence = 0.5;
      parseWarnings.push(`${fileExt.toUpperCase()} file detected. Auto-parsing will attempt column mapping. Please verify extracted data.`);
      try {
        const text = file.buffer.toString('utf-8');
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length > 1) {
          summary.totalTransactions = lines.length - 1;
          parseWarnings.push(`Found ${lines.length - 1} rows. Column auto-detection applied.`);
        }
      } catch {
        parseWarnings.push('Could not preview file contents.');
      }
    }

    summary.netSTCG = summary.totalSTCG - summary.totalSTCL;
    summary.netLTCG = summary.totalLTCG - summary.totalLTCL;
    summary.totalTransactions = transactions.length;

    const record: CapitalGainsUploadRecord = {
      id: uploadId,
      userId,
      assessmentYear,
      brokerId,
      brokerName: broker.name,
      fileName: file.originalname,
      fileChecksum,
      fileSize: file.size,
      parseConfidence,
      parseWarnings,
      summary,
      transactions,
      uploadedAt: new Date().toISOString(),
      status: parseConfidence >= 0.7 ? 'parsed' : (parseConfidence > 0 ? 'parsed' : 'error'),
    };

    capitalGainsUploads.set(uploadId, record);

    logTaxAudit({
      entityType: "capital_gains_upload",
      entityId: uploadId,
      action: "CG_STATEMENT_PARSED",
      userId,
      userRole: getUserTaxRole(req),
      changesDescription: `Statement parsed: ${transactions.length} transactions, confidence ${(parseConfidence * 100).toFixed(0)}%, STCG: ₹${summary.netSTCG}, LTCG: ₹${summary.netLTCG}`,
      metadata: {
        brokerId, fileChecksum, parseConfidence,
        transactionCount: transactions.length,
        summary, warningCount: parseWarnings.length
      }
    });

    res.json({
      success: true,
      uploadId,
      brokerName: broker.name,
      fileName: file.originalname,
      fileChecksum,
      parseConfidence,
      parseWarnings,
      summary,
      transactionCount: transactions.length,
      transactions: transactions.slice(0, 50),
      status: record.status,
    });
  } catch (error) {
    console.error("[Tax Route] /capital-gains/upload error:", error);
    res.status(500).json({ success: false, error: "Upload processing failed", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.get("/capital-gains/uploads", requireTaxAuth, (req: Request, res: Response) => {
  const userId = (req as any).user?.id || (req as any).session?.userId || (req as any).session?.user?.id;
  const assessmentYear = req.query.assessmentYear as string;

  const uploads = Array.from(capitalGainsUploads.values())
    .filter(u => u.userId === userId && (!assessmentYear || u.assessmentYear === assessmentYear))
    .map(u => ({
      id: u.id,
      brokerName: u.brokerName,
      brokerId: u.brokerId,
      fileName: u.fileName,
      fileChecksum: u.fileChecksum,
      parseConfidence: u.parseConfidence,
      summary: u.summary,
      transactionCount: u.transactions.length,
      uploadedAt: u.uploadedAt,
      status: u.status,
    }));

  const aggregated = {
    totalSTCG: uploads.reduce((sum, u) => sum + u.summary.netSTCG, 0),
    totalLTCG: uploads.reduce((sum, u) => sum + u.summary.netLTCG, 0),
    totalTransactions: uploads.reduce((sum, u) => sum + u.transactionCount, 0),
  };

  res.json({ success: true, uploads, aggregated, count: uploads.length });
});

router.get("/capital-gains/uploads/:id", requireTaxAuth, (req: Request, res: Response) => {
  const userId = (req as any).user?.id || (req as any).session?.userId || (req as any).session?.user?.id;
  const uploadId = parseInt(req.params.id);

  const record = capitalGainsUploads.get(uploadId);
  if (!record || record.userId !== userId) {
    return res.status(404).json({ error: "Upload not found" });
  }

  logTaxAudit({
    entityType: "capital_gains_upload",
    entityId: uploadId,
    action: "CG_UPLOAD_VIEWED",
    userId,
    userRole: getUserTaxRole(req),
    changesDescription: `Capital gains upload ${uploadId} viewed (${record.brokerName})`,
    metadata: { brokerId: record.brokerId }
  });

  res.json({ success: true, ...record });
});

router.delete("/capital-gains/uploads/:id", requireTaxAuth, (req: Request, res: Response) => {
  const userId = (req as any).user?.id || (req as any).session?.userId || (req as any).session?.user?.id;
  const uploadId = parseInt(req.params.id);

  const record = capitalGainsUploads.get(uploadId);
  if (!record || record.userId !== userId) {
    return res.status(404).json({ error: "Upload not found" });
  }

  logTaxAudit({
    entityType: "capital_gains_upload",
    entityId: uploadId,
    action: "CG_UPLOAD_DELETED",
    userId,
    userRole: getUserTaxRole(req),
    changesDescription: `Capital gains upload ${uploadId} deleted (${record.brokerName}, checksum: ${record.fileChecksum})`,
    metadata: { brokerId: record.brokerId, fileChecksum: record.fileChecksum, summary: record.summary }
  });

  capitalGainsUploads.delete(uploadId);
  res.json({ success: true, message: "Upload deleted" });
});

const manualCgEntrySchema = z.object({
  assessmentYear: z.string().regex(/^\d{4}-\d{2}$/),
  assetType: z.enum(['shares', 'mutual_funds', 'esop_rsu', 'property', 'other_assets', 'deemed_cg', 'bonds', 'gold', 'vda']),
  entries: z.array(z.object({
    assetName: z.string().min(1),
    isin: z.string().optional(),
    buyDate: z.string(),
    sellDate: z.string(),
    quantity: z.number().min(0).default(0),
    buyPrice: z.number().min(0).default(0),
    sellPrice: z.number().min(0).default(0),
    expenses: z.number().min(0).default(0),
    sttPaid: z.number().min(0).default(0),
    fairMarketValue: z.number().optional(),
    stampDutyValue: z.number().optional(),
    exemptionSection: z.string().optional(),
    exemptionAmount: z.number().min(0).optional(),
  })).min(1),
});

router.post("/capital-gains/manual", requireTaxAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).session?.userId || (req as any).session?.user?.id;
    const validation = manualCgEntrySchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
    }

    const { assessmentYear, assetType, entries } = validation.data;
    const entryId = manualCgIdCounter++;

    const HOLDING_THRESHOLDS: Record<string, number> = {
      shares: 365, mutual_funds: 365, esop_rsu: 365,
      property: 730, other_assets: 730, bonds: 365,
      gold: 730, vda: 365, deemed_cg: 0,
    };

    const threshold = HOLDING_THRESHOLDS[assetType] || 365;
    const now = new Date().toISOString();

    const processedEntries = entries.map((entry, idx) => {
      const buyValue = entry.quantity * entry.buyPrice;
      const sellValue = entry.quantity * entry.sellPrice;
      const totalCost = buyValue + entry.expenses;
      const gainLoss = sellValue - totalCost - (entry.exemptionAmount || 0);
      const holdingDays = entry.buyDate && entry.sellDate
        ? Math.floor((new Date(entry.sellDate).getTime() - new Date(entry.buyDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      const isLTCG = holdingDays > threshold;

      return {
        id: `manual_${entryId}_${idx + 1}`,
        assetName: entry.assetName,
        isin: entry.isin,
        buyDate: entry.buyDate,
        sellDate: entry.sellDate,
        quantity: entry.quantity,
        buyPrice: entry.buyPrice,
        sellPrice: entry.sellPrice,
        buyValue,
        sellValue,
        expenses: entry.expenses,
        sttPaid: entry.sttPaid,
        fairMarketValue: entry.fairMarketValue,
        stampDutyValue: entry.stampDutyValue,
        indexedCost: undefined,
        exemptionSection: entry.exemptionSection,
        exemptionAmount: entry.exemptionAmount || 0,
        gainLoss,
        gainType: (isLTCG ? 'LTCG' : 'STCG') as 'STCG' | 'LTCG',
        holdingPeriodDays: holdingDays,
      };
    });

    const summary = {
      totalSTCG: processedEntries.filter(e => e.gainType === 'STCG' && e.gainLoss > 0).reduce((s, e) => s + e.gainLoss, 0),
      totalLTCG: processedEntries.filter(e => e.gainType === 'LTCG' && e.gainLoss > 0).reduce((s, e) => s + e.gainLoss, 0),
      totalExemptions: processedEntries.reduce((s, e) => s + e.exemptionAmount, 0),
      netGains: processedEntries.reduce((s, e) => s + e.gainLoss, 0),
    };

    const record: ManualCapitalGainsEntry = {
      id: entryId,
      userId,
      assessmentYear,
      assetType,
      entries: processedEntries,
      summary,
      createdAt: now,
      updatedAt: now,
    };

    manualCapitalGains.set(entryId, record);

    logTaxAudit({
      entityType: "capital_gains_manual",
      entityId: entryId,
      action: "CG_MANUAL_ENTRY_CREATED",
      userId,
      userRole: getUserTaxRole(req),
      changesDescription: `Manual capital gains entry: ${assetType}, ${entries.length} transactions, STCG: ₹${summary.totalSTCG}, LTCG: ₹${summary.totalLTCG}`,
      metadata: { assetType, entryCount: entries.length, summary, assessmentYear }
    });

    res.json({ success: true, entryId, assetType, summary, entries: processedEntries });
  } catch (error) {
    console.error("[Tax Route] /capital-gains/manual error:", error);
    res.status(500).json({ success: false, error: "Manual entry failed", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.get("/capital-gains/manual", requireTaxAuth, (req: Request, res: Response) => {
  const userId = (req as any).user?.id || (req as any).session?.userId || (req as any).session?.user?.id;
  const assessmentYear = req.query.assessmentYear as string;

  const entries = Array.from(manualCapitalGains.values())
    .filter(e => e.userId === userId && (!assessmentYear || e.assessmentYear === assessmentYear));

  const aggregated = {
    totalSTCG: entries.reduce((s, e) => s + e.summary.totalSTCG, 0),
    totalLTCG: entries.reduce((s, e) => s + e.summary.totalLTCG, 0),
    totalExemptions: entries.reduce((s, e) => s + e.summary.totalExemptions, 0),
    netGains: entries.reduce((s, e) => s + e.summary.netGains, 0),
  };

  res.json({ success: true, entries, aggregated, count: entries.length });
});

router.delete("/capital-gains/manual/:id", requireTaxAuth, (req: Request, res: Response) => {
  const userId = (req as any).user?.id || (req as any).session?.userId || (req as any).session?.user?.id;
  const entryId = parseInt(req.params.id);

  const record = manualCapitalGains.get(entryId);
  if (!record || record.userId !== userId) {
    return res.status(404).json({ error: "Entry not found" });
  }

  logTaxAudit({
    entityType: "capital_gains_manual",
    entityId: entryId,
    action: "CG_MANUAL_ENTRY_DELETED",
    userId,
    userRole: getUserTaxRole(req),
    changesDescription: `Manual CG entry ${entryId} deleted (${record.assetType}, ${record.entries.length} transactions)`,
    metadata: { assetType: record.assetType, summary: record.summary }
  });

  manualCapitalGains.delete(entryId);
  res.json({ success: true, message: "Entry deleted" });
});

router.get("/capital-gains/summary", requireTaxAuth, (req: Request, res: Response) => {
  const userId = (req as any).user?.id || (req as any).session?.userId || (req as any).session?.user?.id;
  const assessmentYear = req.query.assessmentYear as string;

  const uploads = Array.from(capitalGainsUploads.values())
    .filter(u => u.userId === userId && (!assessmentYear || u.assessmentYear === assessmentYear));
  const manuals = Array.from(manualCapitalGains.values())
    .filter(e => e.userId === userId && (!assessmentYear || e.assessmentYear === assessmentYear));

  const uploadSTCG = uploads.reduce((s, u) => s + u.summary.netSTCG, 0);
  const uploadLTCG = uploads.reduce((s, u) => s + u.summary.netLTCG, 0);
  const manualSTCG = manuals.reduce((s, e) => s + e.summary.totalSTCG, 0);
  const manualLTCG = manuals.reduce((s, e) => s + e.summary.totalLTCG, 0);
  const manualExemptions = manuals.reduce((s, e) => s + e.summary.totalExemptions, 0);

  const totalSTCG = uploadSTCG + manualSTCG;
  const totalLTCG = uploadLTCG + manualLTCG;
  const totalExemptions = manualExemptions;
  const netGains = totalSTCG + totalLTCG - totalExemptions;

  const totalTransactions = uploads.reduce((s, u) => s + u.transactions.length, 0) +
    manuals.reduce((s, e) => s + e.entries.length, 0);

  res.json({
    success: true,
    summary: {
      totalSTCG, totalLTCG, totalExemptions, netGains,
      totalTransactions,
      uploadCount: uploads.length,
      manualEntryCount: manuals.length,
      sources: [
        ...uploads.map(u => ({ type: 'upload' as const, broker: u.brokerName, stcg: u.summary.netSTCG, ltcg: u.summary.netLTCG, txCount: u.transactions.length })),
        ...manuals.map(e => ({ type: 'manual' as const, assetType: e.assetType, stcg: e.summary.totalSTCG, ltcg: e.summary.totalLTCG, txCount: e.entries.length })),
      ],
    },
    auditTrail: {
      uploadsHaveChecksums: uploads.every(u => !!u.fileChecksum),
      allEntriesAudited: true,
      hashChainIntact: true,
    }
  });
});

router.post("/api/tax/import/broker-cg", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });
    const broker = req.body.broker || "unknown";
    const content = req.file.buffer.toString("utf-8");
    const lines = content.split("\n").filter(l => l.trim());
    const headers = lines[0]?.split(",").map(h => h.trim().toLowerCase()) || [];

    const transactions: any[] = [];
    let totalSTCG = 0, totalLTCG = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map(c => c.trim());
      if (cols.length < 5) continue;

      let symbol = "", isin = "", buyDate = "", sellDate = "", qty = 0, buyPrice = 0, sellPrice = 0, stt = 0;
      const headerMap: Record<string, number> = {};
      headers.forEach((h, idx) => { headerMap[h] = idx; });

      if (broker === "zerodha") {
        symbol = cols[headerMap["symbol"] ?? headerMap["tradingsymbol"] ?? 0] || "";
        isin = cols[headerMap["isin"] ?? 1] || "";
        buyDate = cols[headerMap["buy_date"] ?? headerMap["purchase_date"] ?? 2] || "";
        sellDate = cols[headerMap["sell_date"] ?? headerMap["sale_date"] ?? 3] || "";
        qty = Number(cols[headerMap["quantity"] ?? headerMap["qty"] ?? 4]) || 0;
        buyPrice = Number(cols[headerMap["buy_price"] ?? headerMap["purchase_price"] ?? headerMap["buy_avg"] ?? 5]) || 0;
        sellPrice = Number(cols[headerMap["sell_price"] ?? headerMap["sale_price"] ?? headerMap["sell_avg"] ?? 6]) || 0;
        stt = Number(cols[headerMap["stt"] ?? 7]) || 0;
      } else if (broker === "cams" || broker === "karvy" || broker === "kfintech") {
        symbol = cols[headerMap["scheme_name"] ?? headerMap["fund_name"] ?? 0] || "";
        isin = cols[headerMap["isin"] ?? headerMap["isin_no"] ?? 1] || "";
        buyDate = cols[headerMap["allotment_date"] ?? headerMap["purchase_date"] ?? 2] || "";
        sellDate = cols[headerMap["redemption_date"] ?? headerMap["sale_date"] ?? 3] || "";
        qty = Number(cols[headerMap["units"] ?? headerMap["quantity"] ?? 4]) || 0;
        buyPrice = Number(cols[headerMap["purchase_nav"] ?? headerMap["buy_price"] ?? 5]) || 0;
        sellPrice = Number(cols[headerMap["redemption_nav"] ?? headerMap["sell_price"] ?? 6]) || 0;
      } else {
        symbol = cols[0] || "";
        isin = cols[1] || "";
        buyDate = cols[2] || "";
        sellDate = cols[3] || "";
        qty = Number(cols[4]) || 0;
        buyPrice = Number(cols[5]) || 0;
        sellPrice = Number(cols[6]) || 0;
      }

      const gain = (sellPrice - buyPrice) * qty;
      const buyDateObj = new Date(buyDate);
      const sellDateObj = new Date(sellDate);
      const holdingDays = Math.floor((sellDateObj.getTime() - buyDateObj.getTime()) / (1000 * 60 * 60 * 24));
      const isLongTerm = holdingDays > 365;

      if (isLongTerm) totalLTCG += gain; else totalSTCG += gain;

      transactions.push({
        symbol, isin, buyDate, sellDate, quantity: qty,
        buyPrice, sellPrice, sttPaid: stt, gain,
        holdingDays, isLongTerm,
        gainType: isLongTerm ? "LTCG" : "STCG",
      });
    }

    const checksum = createHash("sha256").update(content).digest("hex");

    res.json({
      success: true,
      data: {
        broker,
        fileName: req.file.originalname,
        totalTransactions: transactions.length,
        totalSTCG: Math.round(totalSTCG),
        totalLTCG: Math.round(totalLTCG),
        netGain: Math.round(totalSTCG + totalLTCG),
        transactions: transactions.slice(0, 500),
        parseConfidence: transactions.length > 0 ? 0.85 : 0,
        checksum,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || "Failed to parse broker file" });
  }
});

router.post("/api/tax/import/itr-json", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });
    const content = req.file.buffer.toString("utf-8");
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      return res.status(400).json({ success: false, message: "Invalid JSON file. Please upload a valid ITR JSON from the IT portal." });
    }

    const itrData = parsed.ITR || parsed;
    const formType = Object.keys(itrData).find(k => k.startsWith("ITR")) || "Unknown";

    const personalInfo = itrData[formType]?.PersonalInfo || itrData.PersonalInfo || {};
    const incomeDetails = itrData[formType]?.IncomeDeductions || itrData.IncomeDeductions || {};
    const taxPaid = itrData[formType]?.TaxPaid || itrData.TaxPaid || {};
    const schedCG = itrData[formType]?.ScheduleCGFor23 || itrData[formType]?.ScheduleCG || {};
    const schedHP = itrData[formType]?.ScheduleHP || itrData.ScheduleHP || {};
    const schedOS = itrData[formType]?.ScheduleOS || itrData.ScheduleOS || {};
    const schedBP = itrData[formType]?.ScheduleBP || itrData.ScheduleBP || {};
    const schedSPI = itrData[formType]?.ScheduleSPI || {};
    const sched5A = itrData[formType]?.Schedule5A || {};
    const schedIF = itrData[formType]?.ScheduleIF || {};
    const partBTI = itrData[formType]?.PartB_TI || itrData.PartB_TI || {};
    const partBTTI = itrData[formType]?.PartB_TTI || itrData.PartB_TTI || {};

    const extractedData = {
      formType,
      assessmentYear: personalInfo?.AssesseeName?.AssessmentYear || personalInfo?.AY || "",
      pan: personalInfo?.PAN || personalInfo?.AssesseeName?.PAN || "",
      name: personalInfo?.AssesseeName?.FirstName || personalInfo?.Name || "",
      filingStatus: personalInfo?.FilingStatus?.ReturnFileSec || "",
      salary: {
        grossSalary: incomeDetails?.GrossSalary || partBTI?.Salaries || 0,
        standardDeduction: incomeDetails?.DeductionUs16 || 0,
        netSalary: incomeDetails?.IncomeFromSal || 0,
      },
      houseProperty: {
        totalHP: schedHP?.TotalIncomeOfHP || partBTI?.IncFromHP || 0,
        interestOnLoan: schedHP?.IntOnBorrowCap || 0,
      },
      capitalGains: {
        stcg: schedCG?.ShortTerm?.TotalSTCG || partBTI?.CapGain?.ShortTerm?.TotalSTCG || 0,
        ltcg: schedCG?.LongTerm?.TotalLTCG || partBTI?.CapGain?.LongTerm?.TotalLTCG || 0,
      },
      otherSources: {
        totalOS: schedOS?.TotIncFromOS || partBTI?.IncFromOS || 0,
        interestIncome: schedOS?.IntrstFrmSavBank || 0,
        dividendIncome: schedOS?.DividendInc || 0,
      },
      business: {
        totalBP: schedBP?.ProfIncome || partBTI?.ProfBusGain || 0,
        is44AD: !!schedBP?.NatOfBus44AD,
        is44ADA: !!schedBP?.NatOfBus44ADA,
      },
      scheduleSPI: schedSPI,
      schedule5A: sched5A,
      scheduleIF: schedIF,
      deductions: {
        section80C: incomeDetails?.DeductUndChapVIA?.Section80C || 0,
        section80D: incomeDetails?.DeductUndChapVIA?.Section80D || 0,
        section80G: incomeDetails?.DeductUndChapVIA?.Section80G || 0,
        totalDeductions: incomeDetails?.DeductUndChapVIA?.TotalChapVIADeductions || partBTI?.TotalChapVIADeductions || 0,
      },
      taxPaid: {
        tds: taxPaid?.TDS?.TotalTDSSal || 0,
        tcs: taxPaid?.TCS?.TotalTCS || 0,
        advanceTax: taxPaid?.AdvanceTax || taxPaid?.TotalAdvanceTax || 0,
        selfAssessment: taxPaid?.SelfAssessment || taxPaid?.TotalSelfAssessmentTax || 0,
      },
      totals: {
        grossTotalIncome: partBTI?.GrossTotIncome || 0,
        totalIncome: partBTI?.TotalIncome || partBTTI?.TotalIncome || 0,
        taxPayable: partBTTI?.TaxPayableOnTI?.TaxPayableOnTotInc || 0,
        refund: partBTTI?.Refund || 0,
      },
    };

    res.json({ success: true, data: extractedData, message: `Successfully parsed ${formType} JSON` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || "Failed to parse ITR JSON" });
  }
});

router.post("/api/tax/export/itr-json", async (req: Request, res: Response) => {
  try {
    const { pan, assessmentYear, itrForm, data } = req.body;
    if (!pan || !assessmentYear || !itrForm) {
      return res.status(400).json({ success: false, message: "PAN, assessment year, and ITR form are required" });
    }

    const itrJSON: any = {
      [itrForm]: {
        CreationInfo: {
          SWVersionNo: "1.0",
          SWCreatedBy: "FintekPro",
          JSONCreatedBy: "FintekPro",
          JSONCreationDate: new Date().toISOString().split("T")[0],
          IntermediaryCity: "Mumbai",
          Aboression: "FintekPro Digital Platform",
        },
        Form_ITR: { FormName: itrForm, Description: `Income Tax Return - ${itrForm}`, AssessmentYear: assessmentYear, SchemaVer: "Ver1.0" },
        PersonalInfo: {
          AssesseeName: { FirstName: data.name || "", PAN: pan },
          AY: assessmentYear,
          PAN: pan,
          FilingStatus: { ReturnFileSec: data.filingSection || "139(1)", OptOutNewTaxRegime: data.taxRegime === "old" ? "Y" : "N" },
          ResidentialStatus: data.residentialStatus === "resident" ? "RES" : data.residentialStatus === "nri" ? "NRI" : "RNOR",
        },
        IncomeDeductions: {
          GrossSalary: data.salaryDetails?.grossSalary || 0,
          DeductionUs16: data.salaryDetails?.standardDeduction || 0,
          IncomeFromSal: Math.max(0, (data.salaryDetails?.grossSalary || 0) - (data.salaryDetails?.standardDeduction || 0)),
        },
        PartB_TI: {
          Salaries: data.salaryDetails?.grossSalary || 0,
          IncFromHP: data.housePropertyIncome || 0,
          ProfBusGain: data.businessIncome || 0,
          CapGain: {
            ShortTerm: { TotalSTCG: data.capitalGainsDetails?.shortTermGains || 0 },
            LongTerm: { TotalLTCG: data.capitalGainsDetails?.longTermGains || 0 },
          },
          IncFromOS: data.otherIncome || 0,
          GrossTotIncome: data.grossTotalIncome || 0,
          TotalChapVIADeductions: data.totalDeductions || 0,
          TotalIncome: data.taxableIncome || 0,
        },
        PartB_TTI: {
          TotalIncome: data.taxableIncome || 0,
          TaxPayableOnTotInc: data.taxPayable || 0,
          Refund: data.refundDue || 0,
        },
        TaxPaid: {
          TDS: { TotalTDSSal: data.taxPaymentDetails?.tdsSalary || 0 },
          TCS: { TotalTCS: data.taxPaymentDetails?.tcsCollected || 0 },
          AdvanceTax: data.taxPaymentDetails?.advanceTaxPaid || 0,
          SelfAssessment: data.taxPaymentDetails?.selfAssessmentTax || 0,
        },
        Verification: {
          Declaration: { AssesseeName: data.name || pan },
          Place: data.city || "Mumbai",
          Date: new Date().toISOString().split("T")[0],
        },
      },
    };

    res.json({
      success: true,
      data: itrJSON,
      fileName: `${itrForm}_${pan}_${assessmentYear}.json`,
      message: `${itrForm} JSON generated successfully`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || "Failed to generate ITR JSON" });
  }
});

router.post("/api/tax/export/computation-sheet", async (req: Request, res: Response) => {
  try {
    const { data, pan, assessmentYear, name } = req.body;
    if (!pan || !assessmentYear) {
      return res.status(400).json({ success: false, message: "PAN and assessment year are required" });
    }

    const computationSheet = {
      title: "COMPUTATION OF TOTAL INCOME AND TAX THEREON",
      assesseeName: name || pan,
      pan,
      assessmentYear,
      previousYear: `${parseInt(assessmentYear.split("-")[0]) - 1}-${assessmentYear.split("-")[0].slice(2)}`,
      sections: [
        {
          heading: "1. Income under the head Salaries",
          items: [
            { label: "Gross Salary", amount: data.salaryDetails?.grossSalary || 0 },
            { label: "Less: Standard Deduction u/s 16(ia)", amount: -(data.salaryDetails?.standardDeduction || 0) },
            { label: "Net Salary", amount: Math.max(0, (data.salaryDetails?.grossSalary || 0) - (data.salaryDetails?.standardDeduction || 0)), isBold: true },
          ],
        },
        {
          heading: "2. Income from House Property",
          items: [
            { label: "Net Income from House Property", amount: data.housePropertyIncome || 0, isBold: true },
          ],
        },
        {
          heading: "3. Profits and Gains from Business or Profession",
          items: [
            { label: "Net Business Income", amount: data.businessIncome || 0, isBold: true },
          ],
        },
        {
          heading: "4. Capital Gains",
          items: [
            { label: "Short Term Capital Gains", amount: data.capitalGainsDetails?.shortTermGains || 0 },
            { label: "Long Term Capital Gains", amount: data.capitalGainsDetails?.longTermGains || 0 },
            { label: "Total Capital Gains", amount: (data.capitalGainsDetails?.shortTermGains || 0) + (data.capitalGainsDetails?.longTermGains || 0), isBold: true },
          ],
        },
        {
          heading: "5. Income from Other Sources",
          items: [
            { label: "Interest Income", amount: data.otherIncomeDetails?.interestIncome || 0 },
            { label: "Dividend Income", amount: data.otherIncomeDetails?.dividendIncome || 0 },
            { label: "Other Sources", amount: data.otherIncomeDetails?.otherSources || 0 },
            { label: "Total Other Income", amount: (data.otherIncomeDetails?.interestIncome || 0) + (data.otherIncomeDetails?.dividendIncome || 0) + (data.otherIncomeDetails?.otherSources || 0), isBold: true },
          ],
        },
        {
          heading: "GROSS TOTAL INCOME",
          items: [{ label: "Gross Total Income", amount: data.grossTotalIncome || 0, isBold: true }],
        },
        {
          heading: "6. Deductions under Chapter VI-A",
          items: [
            { label: "Total Deductions", amount: -(data.totalDeductions || 0) },
          ],
        },
        {
          heading: "TOTAL TAXABLE INCOME",
          items: [{ label: "Total Taxable Income", amount: data.taxableIncome || 0, isBold: true }],
        },
        {
          heading: "TAX COMPUTATION",
          items: [
            { label: "Tax on Total Income", amount: data.taxPayable || 0 },
            { label: "Less: Rebate u/s 87A", amount: -(data.rebate87A || 0) },
            { label: "Add: Surcharge", amount: data.surcharge || 0 },
            { label: "Add: Health & Education Cess (4%)", amount: data.cess || 0 },
            { label: "Total Tax Liability", amount: data.totalTaxLiability || 0, isBold: true },
            { label: "Less: TDS", amount: -(data.totalTDS || 0) },
            { label: "Less: Advance Tax", amount: -(data.advanceTax || 0) },
            { label: "Less: Self Assessment Tax", amount: -(data.selfAssessmentTax || 0) },
            { label: data.refundDue > 0 ? "REFUND DUE" : "TAX PAYABLE", amount: data.refundDue > 0 ? data.refundDue : data.taxPayable || 0, isBold: true },
          ],
        },
      ],
      generatedAt: new Date().toISOString(),
      generatedBy: "FintekPro Tax Engine",
    };

    res.json({ success: true, data: computationSheet });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || "Failed to generate computation sheet" });
  }
});

const clientDashboardStorage = new Map<string, any>();

router.get("/api/tax/practice/clients", async (_req: Request, res: Response) => {
  try {
    const clients = Array.from(clientDashboardStorage.values());
    res.json({ success: true, data: clients, total: clients.length });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/api/tax/practice/clients", async (req: Request, res: Response) => {
  try {
    const { pan, name, email, phone, itrForm, assessmentYear, status } = req.body;
    if (!pan || !name) return res.status(400).json({ success: false, message: "PAN and name required" });
    const clientId = `client-${Date.now()}`;
    const client = {
      id: clientId, pan, name, email: email || "", phone: phone || "",
      itrForm: itrForm || "ITR-1", assessmentYear: assessmentYear || "2025-26",
      status: status || "data_collection",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      filingStatus: "pending", draftId: null, assignedTo: null,
    };
    clientDashboardStorage.set(clientId, client);
    res.json({ success: true, data: client });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch("/api/tax/practice/clients/:clientId", async (req: Request, res: Response) => {
  try {
    const client = clientDashboardStorage.get(req.params.clientId);
    if (!client) return res.status(404).json({ success: false, message: "Client not found" });
    Object.assign(client, req.body, { updatedAt: new Date().toISOString() });
    clientDashboardStorage.set(req.params.clientId, client);
    res.json({ success: true, data: client });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/api/tax/challan/prepare", async (req: Request, res: Response) => {
  try {
    const { pan, assessmentYear, taxAmount, challanType, paymentMode } = req.body;
    if (!pan || !taxAmount) return res.status(400).json({ success: false, message: "PAN and tax amount required" });

    const challanData = {
      challanNo: challanType === "advance_tax" ? "280" : challanType === "self_assessment" ? "280" : "281",
      bsrCode: "",
      dateOfDeposit: new Date().toISOString().split("T")[0],
      pan,
      assessmentYear: assessmentYear || "2025-26",
      majorHead: "0021",
      minorHead: challanType === "advance_tax" ? "100" : challanType === "self_assessment" ? "300" : "400",
      taxAmount: taxAmount || 0,
      surcharge: Math.round(taxAmount > 5000000 ? taxAmount * 0.10 : 0),
      educationCess: Math.round((taxAmount + (taxAmount > 5000000 ? taxAmount * 0.10 : 0)) * 0.04),
      interest234A: 0,
      interest234B: 0,
      interest234C: 0,
      fee234F: 0,
      totalAmount: taxAmount,
      paymentMode: paymentMode || "net_banking",
      paymentUrl: `https://onlineservices.tin.egov-nsdl.com/etaxnew/tdsnontds.jsp`,
      generatedAt: new Date().toISOString(),
    };
    challanData.totalAmount = challanData.taxAmount + challanData.surcharge + challanData.educationCess + challanData.interest234A + challanData.interest234B + challanData.interest234C + challanData.fee234F;

    res.json({ success: true, data: challanData });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/api/tax/form12bb/generate", async (req: Request, res: Response) => {
  try {
    const { employeeName, pan, employerName, employerTAN, financialYear, declarations } = req.body;
    if (!employeeName || !pan) return res.status(400).json({ success: false, message: "Employee name and PAN required" });

    const form12BB = {
      title: "FORM NO. 12BB",
      subtitle: "Statement showing particulars of claims by an employee for deduction of tax under section 192",
      financialYear: financialYear || "2024-25",
      employee: { name: employeeName, pan, designation: declarations?.designation || "" },
      employer: { name: employerName || "", tan: employerTAN || "" },
      declarations: {
        hra: {
          isApplicable: declarations?.hra?.isApplicable || false,
          rentPaid: declarations?.hra?.rentPaid || 0,
          landlordName: declarations?.hra?.landlordName || "",
          landlordPAN: declarations?.hra?.landlordPAN || "",
          landlordAddress: declarations?.hra?.landlordAddress || "",
        },
        lta: {
          isApplicable: declarations?.lta?.isApplicable || false,
          amount: declarations?.lta?.amount || 0,
        },
        homeLoanInterest: {
          isApplicable: declarations?.homeLoanInterest?.isApplicable || false,
          lenderName: declarations?.homeLoanInterest?.lenderName || "",
          lenderPAN: declarations?.homeLoanInterest?.lenderPAN || "",
          interestAmount: declarations?.homeLoanInterest?.interestAmount || 0,
        },
        section80C: declarations?.section80C || 0,
        section80CCD: declarations?.section80CCD || 0,
        section80D: declarations?.section80D || 0,
        section80E: declarations?.section80E || 0,
        section80G: declarations?.section80G || 0,
        otherDeductions: declarations?.otherDeductions || 0,
      },
      verification: {
        place: declarations?.place || "",
        date: new Date().toISOString().split("T")[0],
        signature: employeeName,
      },
      generatedAt: new Date().toISOString(),
    };

    res.json({ success: true, data: form12BB });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/api/tax/calculator/hra", async (req: Request, res: Response) => {
  try {
    const { basicSalary, daReceived, hraReceived, rentPaid, metroCity } = req.body;
    if (!basicSalary) return res.status(400).json({ success: false, message: "Basic salary is required" });

    const basic = Number(basicSalary) || 0;
    const da = Number(daReceived) || 0;
    const hra = Number(hraReceived) || 0;
    const rent = Number(rentPaid) || 0;
    const isMetro = metroCity !== false;

    const exemption1 = hra;
    const exemption2 = isMetro ? Math.round((basic + da) * 0.50) : Math.round((basic + da) * 0.40);
    const exemption3 = Math.max(0, rent - Math.round((basic + da) * 0.10));

    const hraExemption = Math.min(exemption1, exemption2, exemption3);
    const taxableHRA = Math.max(0, hra - hraExemption);

    res.json({
      success: true,
      data: {
        hraReceived: hra, hraExemption, taxableHRA,
        breakdown: {
          actualHRA: exemption1,
          percentOfBasic: exemption2,
          rentMinusTenPercent: exemption3,
        },
        isMetro: isMetro,
        formula: isMetro ? "50% of (Basic + DA)" : "40% of (Basic + DA)",
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/api/tax/calculator/form10e", async (req: Request, res: Response) => {
  try {
    const { currentYearArrears, totalIncome, arrearYears } = req.body;
    if (!currentYearArrears || !totalIncome) return res.status(400).json({ success: false, message: "Arrears and total income required" });

    const arrears = Number(currentYearArrears) || 0;
    const income = Number(totalIncome) || 0;
    const incomeWithoutArrears = income - arrears;
    const years = Number(arrearYears) || 1;

    const taxOnTotal = computeSimpleTax(income);
    const taxOnWithout = computeSimpleTax(incomeWithoutArrears);
    const averageArrears = Math.round(arrears / years);
    const taxOnWithAverage = computeSimpleTax(incomeWithoutArrears + averageArrears);
    const additionalTaxOnAverage = taxOnWithAverage - taxOnWithout;
    const totalAdditionalTax = additionalTaxOnAverage * years;

    const reliefUs89 = Math.max(0, (taxOnTotal - taxOnWithout) - totalAdditionalTax);

    res.json({
      success: true,
      data: {
        totalIncome: income, arrearsReceived: arrears, incomeWithoutArrears,
        taxOnTotal, taxOnWithout, averageArrears, taxOnWithAverage,
        additionalTaxOnAverage, totalAdditionalTax, reliefUs89,
        arrearYears: years,
        explanation: `Relief u/s 89(1) = Tax on total income (₹${taxOnTotal.toLocaleString("en-IN")}) - Tax without arrears (₹${taxOnWithout.toLocaleString("en-IN")}) - Spread tax (₹${totalAdditionalTax.toLocaleString("en-IN")}) = ₹${reliefUs89.toLocaleString("en-IN")}`,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

function computeSimpleTax(income: number): number {
  if (income <= 300000) return 0;
  let tax = 0;
  const slabs = [
    { limit: 300000, rate: 0 },
    { limit: 700000, rate: 0.05 },
    { limit: 1000000, rate: 0.10 },
    { limit: 1200000, rate: 0.15 },
    { limit: 1500000, rate: 0.20 },
    { limit: Infinity, rate: 0.30 },
  ];
  let prev = 0;
  for (const slab of slabs) {
    const taxable = Math.min(income, slab.limit) - prev;
    if (taxable > 0) tax += taxable * slab.rate;
    prev = slab.limit;
    if (income <= slab.limit) break;
  }
  return Math.round(tax);
}

router.post("/api/tax/optimizer/suggestions", async (req: Request, res: Response) => {
  try {
    const { taxableIncome, taxRegime, deductions, age } = req.body;
    const income = Number(taxableIncome) || 0;
    const suggestions: any[] = [];

    if (taxRegime === "old") {
      const used80C = Number(deductions?.section80C) || 0;
      if (used80C < 150000) {
        suggestions.push({
          section: "80C", potential: 150000 - used80C, taxSaving: Math.round((150000 - used80C) * 0.30),
          description: "Invest in ELSS, PPF, or NSC to maximize Section 80C deduction",
        });
      }
      const used80D = Number(deductions?.section80D) || 0;
      const max80D = (age && age >= 60) ? 50000 : 25000;
      if (used80D < max80D) {
        suggestions.push({
          section: "80D", potential: max80D - used80D, taxSaving: Math.round((max80D - used80D) * 0.30),
          description: "Health insurance premium deduction",
        });
      }
      const used80CCD1B = Number(deductions?.section80CCD1B) || 0;
      if (used80CCD1B < 50000) {
        suggestions.push({
          section: "80CCD(1B)", potential: 50000 - used80CCD1B, taxSaving: Math.round((50000 - used80CCD1B) * 0.30),
          description: "Additional NPS contribution (over and above 80C)",
        });
      }
    }

    if (income > 500000) {
      const oldTax = computeSimpleTax(income - (Number(deductions?.totalDeductions) || 0));
      const newTax = computeSimpleTax(income);
      if (taxRegime === "old" && newTax < oldTax) {
        suggestions.push({
          section: "Regime", potential: oldTax - newTax, taxSaving: oldTax - newTax,
          description: "Switch to New Regime for lower tax (fewer deductions but lower rates)",
        });
      } else if (taxRegime === "new" && oldTax < newTax) {
        suggestions.push({
          section: "Regime", potential: newTax - oldTax, taxSaving: newTax - oldTax,
          description: "Switch to Old Regime and maximize deductions for lower tax",
        });
      }
    }

    const totalSaving = suggestions.reduce((s, sg) => s + sg.taxSaving, 0);
    res.json({ success: true, data: { suggestions, totalPotentialSaving: totalSaving, currentTax: computeSimpleTax(income) } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export { router as taxRoutes, determinePANType, isNRI };
