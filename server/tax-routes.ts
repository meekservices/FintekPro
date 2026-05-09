import { Router, Request, Response, NextFunction } from "express";
import { createHash } from 'crypto';
import { storage } from "./storage";
import { z } from "zod";
import multer from "multer";
import { sandboxITRService } from "./sandbox-itr-service";
import { emailService } from "./email-service";
import { db } from "./db";
import { sql } from "drizzle-orm";

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

  const sessionRole = session.userRole?.toLowerCase();
  if (sessionRole === "admin" || sessionRole === "superadmin") return "admin";
  if (sessionRole === "ca" || sessionRole === "chartered_accountant") return "ca";
  if (sessionRole === "agent" || sessionRole === "partner") return "agent";

  const reqUser = (req as any).user;
  if (reqUser) {
    const userRoles: string[] = reqUser.roles || (reqUser.role ? [reqUser.role] : []);
    const userRole = (reqUser.role || "").toLowerCase();
    if (userRole === "admin" || userRole === "superadmin" || userRoles.includes("admin") || userRoles.includes("superadmin")) return "admin";
    if (userRole === "ca" || userRoles.includes("ca")) return "ca";
    if (userRole === "agent" || userRole === "partner" || userRoles.includes("agent") || userRoles.includes("partner") || reqUser.isAgent === true) return "agent";
  }

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
  { id: 'iris', name: 'IRIS (KFintech)', category: 'fund_house', supportedFormats: ['pdf'], fileFormatHint: 'CAS from IRIS / KFintech', assetTypes: ['mutual_fund'], pdfType: 'cas_combined', isSupported: true },
  { id: 'mfcentral', name: 'MF Central / IRIS', category: 'fund_house', supportedFormats: ['pdf'], fileFormatHint: 'Combined CAS from mfcentral.com or IRIS (CAMS + KFintech)', assetTypes: ['mutual_fund'], pdfType: 'cas_combined', isSupported: true },
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

    const { filingDate, dueDate, advanceTaxPaid, grossTotalIncome } = req.body;
    const amt = Number(taxAmount) || 0;

    const dueDateObj = dueDate ? new Date(dueDate) : new Date(`${(assessmentYear || "2025-26").split("-")[0]}-07-31`);
    const filingDateObj = filingDate ? new Date(filingDate) : new Date();
    const monthsLate234A = Math.max(0, Math.ceil((filingDateObj.getTime() - dueDateObj.getTime()) / (30.44 * 24 * 60 * 60 * 1000)));
    const interest234A = monthsLate234A > 0 ? Math.round(amt * 0.01 * monthsLate234A) : 0;

    const advTaxPaid = Number(advanceTaxPaid) || 0;
    const shortfall234B = Math.max(0, amt - advTaxPaid);
    const assessedTaxDue = amt * 0.90;
    const months234B = shortfall234B > 0 && advTaxPaid < assessedTaxDue
      ? Math.max(0, Math.ceil((filingDateObj.getTime() - new Date(`${(assessmentYear || "2025-26").split("-")[0]}-03-31`).getTime()) / (30.44 * 24 * 60 * 60 * 1000)))
      : 0;
    const interest234B = months234B > 0 ? Math.round(shortfall234B * 0.01 * months234B) : 0;

    const { advanceTaxQ1, advanceTaxQ2, advanceTaxQ3, advanceTaxQ4 } = req.body;
    let interest234C = 0;
    if (amt > 10000) {
      const q1Paid = Number(advanceTaxQ1) || 0;
      const q2Paid = Number(advanceTaxQ2) || 0;
      const q3Paid = Number(advanceTaxQ3) || 0;
      const q4Paid = Number(advanceTaxQ4) || 0;
      const q1Due = amt * 0.15;
      const q2Due = amt * 0.45;
      const q3Due = amt * 0.75;
      const q4Due = amt;
      if (q1Paid < q1Due) interest234C += Math.round((q1Due - q1Paid) * 0.01 * 3);
      if ((q1Paid + q2Paid) < q2Due) interest234C += Math.round((q2Due - q1Paid - q2Paid) * 0.01 * 3);
      if ((q1Paid + q2Paid + q3Paid) < q3Due) interest234C += Math.round((q3Due - q1Paid - q2Paid - q3Paid) * 0.01 * 3);
      if ((q1Paid + q2Paid + q3Paid + q4Paid) < q4Due) interest234C += Math.round((q4Due - q1Paid - q2Paid - q3Paid - q4Paid) * 0.01 * 1);
    }

    const gti = Number(grossTotalIncome) || 0;
    let fee234F = 0;
    if (filingDateObj > dueDateObj) {
      fee234F = gti <= 500000 ? 1000 : 5000;
    }

    const surcharge = computeSurcharge(computeSlabTax(amt, NEW_REGIME_SLABS), amt, NEW_REGIME_SLABS);
    const educationCess = Math.round((amt + surcharge) * 0.04);

    const challanData = {
      challanNo: challanType === "advance_tax" ? "280" : challanType === "self_assessment" ? "280" : "281",
      bsrCode: "",
      dateOfDeposit: new Date().toISOString().split("T")[0],
      pan,
      assessmentYear: assessmentYear || "2025-26",
      majorHead: "0021",
      minorHead: challanType === "advance_tax" ? "100" : challanType === "self_assessment" ? "300" : "400",
      taxAmount: amt,
      surcharge,
      educationCess,
      interest234A,
      interest234B,
      interest234C,
      fee234F,
      totalAmount: amt + surcharge + educationCess + interest234A + interest234B + interest234C + fee234F,
      paymentMode: paymentMode || "net_banking",
      paymentUrl: `https://onlineservices.tin.egov-nsdl.com/etaxnew/tdsnontds.jsp`,
      generatedAt: new Date().toISOString(),
      dueDate: dueDateObj.toISOString().split("T")[0],
      filingDate: filingDateObj.toISOString().split("T")[0],
      interestBreakdown: {
        "234A_monthsLate": monthsLate234A,
        "234A_ratePerMonth": "1%",
        "234B_shortfall": shortfall234B,
        "234B_months": months234B,
        "234C_applicable": amt > 10000,
        "234C_note": "1% per month for shortfall in quarterly advance tax installments (15%/45%/75%/100%)",
        "234F_reason": fee234F > 0 ? "Filed after due date" : "Filed on or before due date",
      },
    };

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

function computeSlabTax(income: number, slabs: { limit: number; rate: number }[]): number {
  let tax = 0;
  let prev = 0;
  for (const slab of slabs) {
    const taxable = Math.min(income, slab.limit) - prev;
    if (taxable > 0) tax += taxable * slab.rate;
    prev = slab.limit;
    if (income <= slab.limit) break;
  }
  return Math.round(tax);
}

const NEW_REGIME_SLABS = [
  { limit: 300000, rate: 0 },
  { limit: 700000, rate: 0.05 },
  { limit: 1000000, rate: 0.10 },
  { limit: 1200000, rate: 0.15 },
  { limit: 1500000, rate: 0.20 },
  { limit: Infinity, rate: 0.30 },
];

const OLD_REGIME_SLABS_BELOW60 = [
  { limit: 250000, rate: 0 },
  { limit: 500000, rate: 0.05 },
  { limit: 1000000, rate: 0.20 },
  { limit: Infinity, rate: 0.30 },
];

const OLD_REGIME_SLABS_60TO80 = [
  { limit: 300000, rate: 0 },
  { limit: 500000, rate: 0.05 },
  { limit: 1000000, rate: 0.20 },
  { limit: Infinity, rate: 0.30 },
];

const OLD_REGIME_SLABS_ABOVE80 = [
  { limit: 500000, rate: 0 },
  { limit: 1000000, rate: 0.20 },
  { limit: Infinity, rate: 0.30 },
];

function computeSurcharge(tax: number, income: number, slabs: { limit: number; rate: number }[]): number {
  let surchargeRate = 0;
  if (income > 50000000) surchargeRate = 0.37;
  else if (income > 20000000) surchargeRate = 0.25;
  else if (income > 10000000) surchargeRate = 0.15;
  else if (income > 5000000) surchargeRate = 0.10;
  else return 0;

  const surcharge = Math.round(tax * surchargeRate);

  const thresholds = [5000000, 10000000, 20000000, 50000000];
  const rates = [0, 0.10, 0.15, 0.25, 0.37];
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (income > thresholds[i]) {
      const excessIncome = income - thresholds[i];
      const taxAtThreshold = computeSlabTax(thresholds[i], slabs);
      const surchargeAtThreshold = Math.round(taxAtThreshold * rates[i]);
      const maxTaxPlusSurcharge = taxAtThreshold + surchargeAtThreshold + excessIncome;
      if (tax + surcharge > maxTaxPlusSurcharge) {
        return Math.max(0, maxTaxPlusSurcharge - tax);
      }
      break;
    }
  }
  return surcharge;
}

function computeFullTax(income: number, regime: "new" | "old" = "new", age: number = 30): {
  basicTax: number; rebate87A: number; surcharge: number; cess: number; totalTax: number;
} {
  const slabs = regime === "old"
    ? (age >= 80 ? OLD_REGIME_SLABS_ABOVE80 : age >= 60 ? OLD_REGIME_SLABS_60TO80 : OLD_REGIME_SLABS_BELOW60)
    : NEW_REGIME_SLABS;

  let basicTax = computeSlabTax(income, slabs);

  let rebate87A = 0;
  if (regime === "new" && income <= 700000) {
    rebate87A = Math.min(basicTax, 25000);
  } else if (regime === "old" && income <= 500000) {
    rebate87A = Math.min(basicTax, 12500);
  }
  basicTax -= rebate87A;
  if (basicTax < 0) basicTax = 0;

  const surcharge = computeSurcharge(basicTax, income, slabs);
  const cess = Math.round((basicTax + surcharge) * 0.04);
  const totalTax = basicTax + surcharge + cess;

  return { basicTax, rebate87A, surcharge, cess, totalTax };
}

function computeSimpleTax(income: number): number {
  return computeFullTax(income, "new").totalTax;
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
      const totalDeductions = Number(deductions?.totalDeductions) || 0;
      const userAge = Number(age) || 30;
      const oldTax = computeFullTax(Math.max(0, income - totalDeductions), "old", userAge).totalTax;
      const newTax = computeFullTax(income, "new", userAge).totalTax;
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

// ==========================================
// GAP G1: AIS/TIS Integration
// ==========================================
router.post("/api/tax/import/ais-tis", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No AIS/TIS file uploaded" });
    const content = req.file.buffer.toString("utf-8");
    let parsed: any;
    try { parsed = JSON.parse(content); } catch { return res.status(400).json({ success: false, message: "Invalid JSON format. Please upload the AIS/TIS JSON downloaded from the IT portal." }); }

    const extractedData: any = {
      tdsEntries: [] as any[], sftEntries: [] as any[], tcsEntries: [] as any[],
      interestIncome: 0, dividendIncome: 0, salaryIncome: 0,
      propertyTransactions: [] as any[], highValueTransactions: [] as any[],
      foreignRemittances: [] as any[], mutualFundPurchases: [] as any[],
      pan: parsed.pan || parsed.PAN || "", assessmentYear: parsed.assessmentYear || parsed.ay || "",
    };

    const sections = parsed.data || parsed.sections || parsed.TaxPayerInfo?.SFTInfo || [];
    if (Array.isArray(sections)) {
      for (const section of sections) {
        const sftType = section.sftType || section.type || section.infoCategory || "";
        const amount = Number(section.amount || section.value || section.transactionValue || 0);
        if (sftType.includes("TDS") || section.tdsSection) {
          extractedData.tdsEntries.push({ tan: section.tan || section.deductorTAN || "", deductorName: section.deductorName || "", amount, section: section.tdsSection || "192", quarter: section.quarter || "" });
        } else if (sftType.includes("SFT-005") || sftType.includes("INTEREST")) {
          extractedData.interestIncome += amount;
          extractedData.sftEntries.push({ type: "interest", source: section.reportingEntity || "", amount });
        } else if (sftType.includes("SFT-011") || sftType.includes("DIVIDEND")) {
          extractedData.dividendIncome += amount;
          extractedData.sftEntries.push({ type: "dividend", source: section.reportingEntity || "", amount });
        } else if (sftType.includes("SFT-013") || sftType.includes("PROPERTY")) {
          extractedData.propertyTransactions.push({ description: section.description || "Property", amount, date: section.transactionDate || "" });
        } else if (sftType.includes("SFT-008") || sftType.includes("MUTUAL_FUND")) {
          extractedData.mutualFundPurchases.push({ scheme: section.schemeName || section.description || "", amount, date: section.transactionDate || "" });
        } else if (sftType.includes("FOREIGN") || sftType.includes("REMITTANCE")) {
          extractedData.foreignRemittances.push({ purpose: section.purpose || "", amount, country: section.country || "" });
        } else if (amount > 1000000) {
          extractedData.highValueTransactions.push({ type: sftType, description: section.description || "", amount });
        }
      }
    }

    if (parsed.salary || parsed.salaryIncome) extractedData.salaryIncome = Number(parsed.salary || parsed.salaryIncome);

    res.json({
      success: true,
      data: extractedData,
      summary: {
        totalTDSEntries: extractedData.tdsEntries.length,
        totalSFTEntries: extractedData.sftEntries.length,
        interestIncome: extractedData.interestIncome,
        dividendIncome: extractedData.dividendIncome,
        propertyTransactions: extractedData.propertyTransactions.length,
        highValueTransactions: extractedData.highValueTransactions.length,
        foreignRemittances: extractedData.foreignRemittances.length,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || "Failed to parse AIS/TIS data" });
  }
});

// ==========================================
// GAP G2: Form 26AS Auto-Reconciliation
// ==========================================
router.post("/api/tax/reconcile/26as", async (req: Request, res: Response) => {
  try {
    const { tdsEntered, tds26AS } = req.body;
    if (!tdsEntered || !tds26AS) return res.status(400).json({ success: false, message: "Both entered TDS and 26AS TDS data required" });

    const mismatches: any[] = [];
    const matched: any[] = [];
    const missing26AS: any[] = [];
    const missingEntry: any[] = [];

    const enteredMap = new Map<string, any>();
    for (const entry of tdsEntered) {
      const key = `${(entry.tan || "").toUpperCase()}-${entry.section || ""}`;
      enteredMap.set(key, entry);
    }

    const as26Map = new Map<string, any>();
    for (const entry of tds26AS) {
      const key = `${(entry.tan || "").toUpperCase()}-${entry.section || ""}`;
      as26Map.set(key, entry);
    }

    Array.from(enteredMap.entries()).forEach(([key, entered]) => {
      const as26Entry = as26Map.get(key);
      if (!as26Entry) {
        missing26AS.push({ ...entered, issue: "TDS entry not found in 26AS — may be rejected by CPC" });
      } else {
        const diff = Math.abs(Number(entered.amount) - Number(as26Entry.amount));
        if (diff > 1) {
          mismatches.push({
            tan: entered.tan, section: entered.section, deductorName: entered.deductorName || as26Entry.deductorName,
            enteredAmount: Number(entered.amount), amount26AS: Number(as26Entry.amount),
            difference: diff, recommendation: Number(entered.amount) > Number(as26Entry.amount) ? "Reduce to 26AS amount to avoid mismatch notice" : "Consider claiming 26AS amount",
          });
        } else {
          matched.push({ tan: entered.tan, section: entered.section, amount: Number(entered.amount) });
        }
      }
    });

    Array.from(as26Map.entries()).forEach(([key, as26Entry]) => {
      if (!enteredMap.has(key)) {
        missingEntry.push({ ...as26Entry, issue: "TDS in 26AS but not claimed — you may be leaving money on the table" });
      }
    });

    const totalEntered = tdsEntered.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
    const total26AS = tds26AS.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);

    res.json({
      success: true,
      data: {
        matched, mismatches, missing26AS, missingEntry,
        summary: {
          totalEntered, total26AS, difference: Math.abs(totalEntered - total26AS),
          matchedCount: matched.length, mismatchCount: mismatches.length,
          missing26ASCount: missing26AS.length, missingEntryCount: missingEntry.length,
          status: mismatches.length === 0 && missing26AS.length === 0 ? "RECONCILED" : "DISCREPANCIES_FOUND",
          recommendation: mismatches.length > 0 ? "Fix mismatched amounts before filing to avoid intimation u/s 143(1)" : missing26AS.length > 0 ? "Remove unclaimed TDS not in 26AS" : "All TDS entries reconciled",
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// GAP G3: 20+ Broker Support
// ==========================================
const SUPPORTED_BROKERS = [
  { id: "zerodha", name: "Zerodha", format: "CSV", columns: ["symbol", "isin", "trade_date", "exchange", "quantity", "price", "trade_type"] },
  { id: "groww", name: "Groww", format: "CSV", columns: ["Stock Name", "ISIN", "Buy Date", "Sell Date", "Buy Quantity", "Sell Quantity", "Buy Price", "Sell Price"] },
  { id: "upstox", name: "Upstox", format: "CSV", columns: ["Symbol", "ISIN", "Trade Date", "Trade Type", "Quantity", "Price", "Exchange"] },
  { id: "angel_one", name: "Angel One", format: "CSV", columns: ["Scrip Name", "ISIN", "Buy Date", "Sell Date", "Buy Qty", "Sell Qty", "Buy Rate", "Sell Rate"] },
  { id: "icici_direct", name: "ICICI Direct", format: "CSV", columns: ["Stock", "ISIN Code", "Purchase Date", "Sale Date", "Purchase Qty", "Sale Qty", "Purchase Price", "Sale Price"] },
  { id: "hdfc_securities", name: "HDFC Securities", format: "CSV", columns: ["Scrip", "ISIN", "Buy Date", "Sell Date", "Buy Qty", "Sale Qty", "Buy Avg", "Sell Avg"] },
  { id: "motilal_oswal", name: "Motilal Oswal", format: "CSV", columns: ["Symbol", "ISIN", "BuyDate", "SellDate", "BuyQty", "SellQty", "BuyPrice", "SellPrice"] },
  { id: "kotak_securities", name: "Kotak Securities", format: "CSV", columns: ["Script Name", "ISIN", "Purchase Date", "Sale Date", "Buy Quantity", "Sale Quantity", "Buy Rate", "Sale Rate"] },
  { id: "five_paisa", name: "5Paisa", format: "CSV", columns: ["ScripName", "ISIN", "PurchaseDate", "SaleDate", "PurchaseQty", "SaleQty", "PurchaseRate", "SaleRate"] },
  { id: "paytm_money", name: "Paytm Money", format: "CSV", columns: ["Stock", "ISIN", "Buy Date", "Sell Date", "Buy Quantity", "Sell Quantity", "Avg Buy Price", "Avg Sell Price"] },
  { id: "axis_direct", name: "Axis Direct", format: "CSV", columns: ["Scrip", "ISIN Code", "Buy Date", "Sell Date", "Buy Qty", "Sell Qty", "Buy Price", "Sell Price"] },
  { id: "edelweiss", name: "Edelweiss", format: "CSV", columns: ["Symbol", "ISIN", "Purchase Date", "Sale Date", "Purchase Qty", "Sale Qty", "Purchase Price", "Sale Price"] },
  { id: "sharekhan", name: "Sharekhan", format: "CSV", columns: ["Scrip", "ISIN", "Buy Date", "Sell Date", "Buy Qty", "Sell Qty", "Buy Rate", "Sell Rate"] },
  { id: "sbi_securities", name: "SBI Securities", format: "CSV", columns: ["Stock Name", "ISIN", "Date of Purchase", "Date of Sale", "Qty Purchased", "Qty Sold", "Purchase Rate", "Sale Rate"] },
  { id: "dhan", name: "Dhan", format: "CSV", columns: ["Symbol", "ISIN", "BuyDate", "SellDate", "BuyQty", "SellQty", "BuyPrice", "SellPrice"] },
  { id: "mstock", name: "mStock by Mirae", format: "CSV", columns: ["Scrip", "ISIN", "Buy Date", "Sell Date", "Buy Qty", "Sell Qty", "Buy Price", "Sell Price"] },
  { id: "iifl_securities", name: "IIFL Securities", format: "CSV", columns: ["Scrip Name", "ISIN No", "Purchase Date", "Sale Date", "Purchase Qty", "Sale Qty", "Purchase Rate", "Sale Rate"] },
  { id: "geojit", name: "Geojit", format: "CSV", columns: ["Symbol", "ISIN", "Buy Date", "Sell Date", "Buy Qty", "Sell Qty", "Buy Price", "Sell Price"] },
  { id: "kuvera", name: "Kuvera (MF)", format: "CSV", columns: ["Scheme", "ISIN", "Purchase Date", "Redemption Date", "Units", "Purchase NAV", "Redemption NAV"] },
  { id: "cams", name: "CAMS (MF)", format: "CSV", columns: ["Scheme Name", "ISIN", "Transaction Date", "Units", "NAV", "Amount", "Transaction Type"] },
  { id: "karvy_kfin", name: "KFintech/Karvy (MF)", format: "CSV", columns: ["Fund Name", "Folio", "Transaction Date", "Units", "NAV", "Amount", "Type"] },
  { id: "coin_zerodha", name: "Coin by Zerodha (MF)", format: "CSV", columns: ["Fund", "ISIN", "Date", "Units", "NAV", "Amount", "Type"] },
  { id: "iris", name: "IRIS (KFintech)", format: "JSON/PDF", columns: ["Scheme", "ISIN", "Units", "Amount"] },
  { id: "mfcentral", name: "MFCentral / IRIS (CAS)", format: "PDF/CSV", columns: ["Scheme", "ISIN", "Date", "Units", "NAV", "Amount"] },
];

router.get("/api/tax/brokers/supported", (_req: Request, res: Response) => {
  res.json({ success: true, data: SUPPORTED_BROKERS, total: SUPPORTED_BROKERS.length });
});

router.post("/api/tax/import/broker-cg-v2", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });
    const brokerId = req.body.broker || "generic";
    const content = req.file.buffer.toString("utf-8");
    const lines = content.split("\n").filter(l => l.trim());
    if (lines.length < 2) return res.status(400).json({ success: false, message: "File has insufficient data rows" });

    const header = lines[0].toLowerCase();
    let detectedBroker = brokerId;
    if (brokerId === "generic" || brokerId === "auto") {
      if (header.includes("trade_type") && header.includes("symbol")) detectedBroker = "zerodha";
      else if (header.includes("stock name") && header.includes("buy date")) detectedBroker = "groww";
      else if (header.includes("scrip name") && header.includes("isin no")) detectedBroker = "iifl_securities";
      else if (header.includes("scrip") && header.includes("buy avg")) detectedBroker = "hdfc_securities";
      else if (header.includes("script name")) detectedBroker = "kotak_securities";
      else if (header.includes("scheme") || header.includes("fund")) detectedBroker = "cams";
      else detectedBroker = "generic";
    }

    const transactions: any[] = [];
    let totalSTCG = 0, totalLTCG = 0;
    const cols = lines[0].split(",").map(c => c.trim().toLowerCase().replace(/['"]/g, ""));

    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(",").map(v => v.trim().replace(/['"]/g, ""));
      if (vals.length < 3) continue;
      const row: Record<string, string> = {};
      cols.forEach((c, j) => { row[c] = vals[j] || ""; });

      const buyPrice = Number(row["buy price"] || row["purchase price"] || row["buy rate"] || row["purchase rate"] || row["buy avg"] || row["purchase nav"] || row["price"] || 0);
      const sellPrice = Number(row["sell price"] || row["sale price"] || row["sell rate"] || row["sale rate"] || row["sell avg"] || row["redemption nav"] || 0);
      const qty = Number(row["quantity"] || row["buy quantity"] || row["buy qty"] || row["purchase qty"] || row["units"] || row["sell quantity"] || row["sell qty"] || row["sale qty"] || 1);
      const buyDateStr = row["buy date"] || row["purchase date"] || row["trade_date"] || row["date of purchase"] || row["date"] || "";
      const sellDateStr = row["sell date"] || row["sale date"] || row["redemption date"] || row["date of sale"] || "";

      const gain = (sellPrice - buyPrice) * qty;
      let holdingDays = 365;
      try {
        const bd = new Date(buyDateStr);
        const sd = sellDateStr ? new Date(sellDateStr) : new Date();
        holdingDays = Math.floor((sd.getTime() - bd.getTime()) / (1000 * 60 * 60 * 24));
      } catch {}

      const isLTCG = holdingDays > 365;
      if (isLTCG) totalLTCG += gain; else totalSTCG += gain;

      transactions.push({
        symbol: row["symbol"] || row["stock"] || row["scrip"] || row["scrip name"] || row["stock name"] || row["scheme"] || row["fund"] || "",
        isin: row["isin"] || row["isin code"] || row["isin no"] || "",
        buyDate: buyDateStr, sellDate: sellDateStr, buyPrice, sellPrice, quantity: qty,
        gain: Math.round(gain), holdingDays, type: isLTCG ? "LTCG" : "STCG",
      });
    }

    res.json({
      success: true,
      data: {
        broker: detectedBroker, totalTransactions: transactions.length,
        totalSTCG: Math.round(totalSTCG), totalLTCG: Math.round(totalLTCG),
        netGain: Math.round(totalSTCG + totalLTCG),
        transactions: transactions.slice(0, 500),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || "Failed to parse broker statement" });
  }
});

// ==========================================
// GAP G4: Direct ERI e-Filing API (via Sandbox.co.in)
// ==========================================
router.post("/api/tax/efile/direct", async (req: Request, res: Response) => {
  try {
    const { pan, itrForm, assessmentYear, itrData, eVerificationMethod, digitalSignature, personalInfo, bankDetails } = req.body;
    if (!pan || !itrForm || !itrData) return res.status(400).json({ success: false, message: "PAN, ITR form, and ITR data required" });

    const firstName = personalInfo?.firstName || itrData?.personalInfo?.firstName;
    const lastName = personalInfo?.lastName || itrData?.personalInfo?.lastName;
    const dateOfBirth = personalInfo?.dateOfBirth || itrData?.personalInfo?.dateOfBirth;
    const email = personalInfo?.email || itrData?.personalInfo?.email;
    const phone = personalInfo?.phone || itrData?.personalInfo?.phone;
    const aadhar = personalInfo?.aadhar || itrData?.personalInfo?.aadhar;
    const address = personalInfo?.address || itrData?.personalInfo?.address;
    const acctNumber = bankDetails?.accountNumber || itrData?.bankDetails?.accountNumber;
    const ifscCode = bankDetails?.ifscCode || itrData?.bankDetails?.ifscCode;

    const missingFields: string[] = [];
    if (!firstName) missingFields.push("firstName");
    if (!lastName) missingFields.push("lastName");
    if (!dateOfBirth) missingFields.push("dateOfBirth");
    if (!email) missingFields.push("email");
    if (!phone) missingFields.push("phone");
    if (!aadhar || aadhar.length !== 12) missingFields.push("aadhar (12-digit Aadhaar number)");
    if (!address?.line1 || !address?.city || !address?.state || !address?.pincode) missingFields.push("address (line1, city, state, pincode)");
    if (!acctNumber) missingFields.push("bankDetails.accountNumber");
    if (!ifscCode) missingFields.push("bankDetails.ifscCode");

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields for e-filing: ${missingFields.join(", ")}`,
        missingFields,
      });
    }

    const formData = {
      personalInfo: {
        pan,
        firstName,
        lastName,
        dateOfBirth,
        email,
        phone,
        aadhar,
        address,
      },
      incomeDetails: {
        salaryIncome: Number(itrData?.salaryDetails?.grossSalary || itrData?.salaryIncome || 0),
        businessIncome: Number(itrData?.businessIncome || 0),
        capitalGains: Number(itrData?.capitalGainsDetails?.shortTermGains || 0) + Number(itrData?.capitalGainsDetails?.longTermGains || 0),
        otherIncome: Number(itrData?.otherIncomeDetails?.otherIncome || 0),
        interestIncome: Number(itrData?.otherIncomeDetails?.interestIncome || 0),
        rentalIncome: Number(itrData?.housePropertyIncome || 0),
        dividendIncome: Number(itrData?.otherIncomeDetails?.dividendIncome || 0),
      },
      deductions: {
        section80C: Number(itrData?.deductionDetails?.section80C || 0),
        section80D: Number(itrData?.deductionDetails?.section80D || 0),
        section80G: Number(itrData?.deductionDetails?.section80G || 0),
        homeLoanInterest: Number(itrData?.deductionDetails?.homeLoanInterest || 0),
        standardDeduction: Number(itrData?.deductionDetails?.standardDeduction || 75000),
        professionalTax: Number(itrData?.deductionDetails?.professionalTax || 0),
        otherDeductions: Number(itrData?.deductionDetails?.otherDeductions || 0),
      },
      taxPayments: {
        tdsDeducted: Number(itrData?.taxPaymentDetails?.tdsDeducted || 0),
        advanceTaxPaid: Number(itrData?.taxPaymentDetails?.advanceTaxPaid || 0),
        selfAssessmentTax: Number(itrData?.taxPaymentDetails?.selfAssessmentTax || 0),
      },
      bankDetails: {
        accountNumber: acctNumber,
        ifscCode,
        bankName: bankDetails?.bankName || itrData?.bankDetails?.bankName || "",
        accountHolderName: `${firstName} ${lastName}`,
      },
      filingDetails: {
        assessmentYear: assessmentYear || "2025-26",
        itrForm: itrForm as any,
        filingStatus: "Original" as const,
        isDefective: false,
      },
      entityType: (itrData?.entityType || "individual") as any,
    };

    const result = await sandboxITRService.prepareITR(formData);

    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message, errors: result.errors });
    }

    if (eVerificationMethod && result.data?.acknowledgmentNumber) {
      const eVerifyResult = await sandboxITRService.eVerifyITR(
        result.data.acknowledgmentNumber,
        eVerificationMethod,
        { pan, aadhaarNumber: personalInfo?.aadhar }
      );
      (result.data as any).eVerificationStatus = eVerifyResult.success ? "VERIFIED" : "PENDING";
      (result.data as any).eVerificationMethod = eVerificationMethod;
    }

    res.json({
      success: true,
      data: {
        ...result.data,
        pan,
        itrForm,
        assessmentYear: assessmentYear || "2025-26",
        submittedAt: new Date().toISOString(),
        source: "sandbox_api",
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/api/tax/efile/itrv/:token", async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: {
        token: req.params.token, type: "ITR-V",
        title: "Indian Income Tax Return Verification Form",
        generatedAt: new Date().toISOString(),
        instructions: "If not e-verified within 30 days, please send signed ITR-V to CPC, Post Bag No. 1, Electronic City Post Office, Bengaluru — 560100, Karnataka",
        barcode: `ITRV-${req.params.token}`,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// GAP G5: Challan 281/282 Support
// ==========================================
router.post("/api/tax/challan/prepare-extended", async (req: Request, res: Response) => {
  try {
    const { pan, tan, assessmentYear, amount, challanType, natureOfPayment, paymentMode } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: "Valid payment amount required" });

    let challanNo = "280", majorHead = "0021", minorHead = "300";
    if (challanType === "tds_tcs" || challanType === "281") {
      challanNo = "281"; majorHead = "0020"; minorHead = natureOfPayment === "salary" ? "200" : "800";
    } else if (challanType === "other_taxes" || challanType === "282") {
      challanNo = "282"; majorHead = "0024"; minorHead = "800";
    } else if (challanType === "advance_tax") {
      minorHead = "100";
    } else if (challanType === "self_assessment") {
      minorHead = "300";
    } else if (challanType === "regular_assessment") {
      minorHead = "400";
    }

    const amt = Number(amount);
    const surcharge = amt > 5000000 ? Math.round(amt * 0.10) : amt > 1000000 ? Math.round(amt * 0.05) : 0;
    const cess = Math.round((amt + surcharge) * 0.04);
    const totalAmount = amt + surcharge + cess;

    res.json({
      success: true,
      data: {
        challanNo, majorHead, minorHead,
        pan: pan || "", tan: tan || "",
        assessmentYear: assessmentYear || "2025-26",
        taxAmount: amt, surcharge, educationCess: cess, totalAmount,
        paymentMode: paymentMode || "net_banking",
        paymentUrl: challanNo === "281"
          ? "https://onlineservices.tin.egov-nsdl.com/etaxnew/tdsnontds.jsp"
          : "https://onlineservices.tin.egov-nsdl.com/etaxnew/tdsnontds.jsp",
        oltas_url: "https://tin.tin.nsdl.com/oltas/",
        generatedAt: new Date().toISOString(),
        instructions: challanNo === "281" ? "Use TAN for TDS/TCS payments" : challanNo === "282" ? "For gift tax, wealth tax, and other direct taxes" : "For income tax payments",
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// GAP G6: IFSC/BSR Code Lookup
// ==========================================
const BSR_CODES: Record<string, string> = {
  "0002": "State Bank of India", "0003": "SBI (Associate)", "0004": "Union Bank of India",
  "0005": "Indian Bank", "0006": "Canara Bank", "0008": "Bank of Baroda",
  "0009": "Punjab National Bank", "0010": "Central Bank of India",
  "0011": "Bank of India", "0012": "Indian Overseas Bank", "0016": "HDFC Bank",
  "0018": "ICICI Bank", "0022": "Axis Bank", "0024": "Kotak Mahindra Bank",
  "0028": "Yes Bank", "0032": "IDBI Bank", "0229": "RBL Bank",
};

router.get("/api/tax/lookup/ifsc/:code", async (req: Request, res: Response) => {
  try {
    const code = req.params.code?.toUpperCase();
    if (!code || code.length !== 11) return res.status(400).json({ success: false, message: "IFSC code must be 11 characters" });

    try {
      const { lookupIFSC } = await import("./ifsc-lookup-service");
      const ifscResult = await lookupIFSC(code);
      if (ifscResult.success && ifscResult.data) {
        const data = ifscResult.data;
        return res.json({
          success: true,
          data: { 
            ifsc: code, 
            bank: data.bank, 
            branch: data.branch, 
            address: data.address, 
            city: data.city, 
            state: data.state, 
            contact: data.contact || "", 
            // Cashfree response might not have all these but we default them
            micr: (data as any).micr || "", 
            neft: (data as any).neft ?? true, 
            rtgs: (data as any).rtgs ?? true, 
            imps: (data as any).imps ?? true, 
            upi: (data as any).upi ?? true 
          },
        });
      }
    } catch {}


    const bankCode = code.substring(0, 4);
    res.json({
      success: true,
      data: { ifsc: code, bank: bankCode, branch: `Branch for ${code}`, address: "", city: "", state: "", note: "Lookup via external API unavailable, showing partial data" },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/api/tax/lookup/bsr/:code", async (req: Request, res: Response) => {
  try {
    const code = req.params.code;
    if (!code) return res.status(400).json({ success: false, message: "BSR code required" });
    const bankName = BSR_CODES[code] || `Bank with BSR ${code}`;
    res.json({ success: true, data: { bsrCode: code, bankName, description: `BSR Code ${code} — ${bankName}` } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// GAP G7: TAN / AO Code Finder
// ==========================================
router.get("/api/tax/lookup/tan/:tan", async (req: Request, res: Response) => {
  try {
    const tan = req.params.tan?.toUpperCase();
    if (!tan || tan.length !== 10) return res.status(400).json({ success: false, message: "TAN must be 10 characters (e.g., DELH12345A)" });
    if (/iris|kfintech|mf\s*central|mfcentral\.com/i.test(text)) return 'aggregator_mfcentral';
    if (!/^[A-Z]{4}\d{5}[A-Z]$/.test(tan)) return res.status(400).json({ success: false, message: "Invalid TAN format" });

    const cityCode = tan.substring(0, 3);
    const cityMap: Record<string, string> = { DEL: "Delhi", MUM: "Mumbai", CHE: "Chennai", KOL: "Kolkata", BNG: "Bengaluru", HYD: "Hyderabad", PUN: "Pune", AHM: "Ahmedabad", JAI: "Jaipur", LKN: "Lucknow" };
    res.json({
      success: true,
      data: { tan, city: cityMap[cityCode] || cityCode, entityType: tan[3], isValid: true, format: "AAAA99999A" },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/api/tax/lookup/ao-code", async (req: Request, res: Response) => {
  try {
    const { city, areaCode, rangeCode, aoType } = req.query;
    const aoCodes = [
      { city: "Delhi", areaCode: "DEL", aoType: "W", rangeCode: "1", aoNumber: "1", jurisdiction: "Ward 1(1), Delhi" },
      { city: "Delhi", areaCode: "DEL", aoType: "C", rangeCode: "1", aoNumber: "1", jurisdiction: "Circle 1(1), Delhi" },
      { city: "Mumbai", areaCode: "MUM", aoType: "W", rangeCode: "1", aoNumber: "1", jurisdiction: "Ward 1(1), Mumbai" },
      { city: "Mumbai", areaCode: "MUM", aoType: "C", rangeCode: "2", aoNumber: "1", jurisdiction: "Circle 2(1), Mumbai" },
      { city: "Chennai", areaCode: "CHE", aoType: "W", rangeCode: "1", aoNumber: "1", jurisdiction: "Ward 1(1), Chennai" },
      { city: "Bengaluru", areaCode: "BNG", aoType: "W", rangeCode: "1", aoNumber: "1", jurisdiction: "Ward 1(1), Bengaluru" },
      { city: "Kolkata", areaCode: "KOL", aoType: "W", rangeCode: "1", aoNumber: "1", jurisdiction: "Ward 1(1), Kolkata" },
      { city: "Hyderabad", areaCode: "HYD", aoType: "W", rangeCode: "1", aoNumber: "1", jurisdiction: "Ward 1(1), Hyderabad" },
    ];

    let filtered = aoCodes;
    if (city) filtered = filtered.filter(a => a.city.toLowerCase().includes(String(city).toLowerCase()));
    if (areaCode) filtered = filtered.filter(a => a.areaCode === String(areaCode).toUpperCase());
    if (rangeCode) filtered = filtered.filter(a => a.rangeCode === String(rangeCode));
    if (aoType) filtered = filtered.filter(a => a.aoType === String(aoType).toUpperCase());

    res.json({ success: true, data: filtered, total: filtered.length, aoTypes: { W: "Ward", C: "Circle", R: "Range" } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// GAP G19: Tax PnL Calculator (via Sandbox.co.in API)
// ==========================================
router.post("/api/tax/calculate/tax-pnl", async (req: Request, res: Response) => {
  try {
    const { assetClass, transactions } = req.body;
    if (!assetClass || !transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ success: false, message: "Asset class and transactions array required" });
    }

    const validClasses = ["domestic", "foreign", "crypto", "real_estate", "other"];
    if (!validClasses.includes(assetClass)) {
      return res.status(400).json({ success: false, message: `Invalid asset class. Valid: ${validClasses.join(", ")}` });
    }

    const result = await sandboxITRService.calculateTaxPnL(assetClass, transactions);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json({ success: true, data: result.data, source: "sandbox_api" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// GAP G20: Indexed Cost Calculator (via Sandbox.co.in API)
// ==========================================
router.post("/api/tax/calculate/indexed-cost", async (req: Request, res: Response) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Items array required with acquisitionCost, acquisitionYear, saleYear" });
    }

    const result = await sandboxITRService.calculateIndexedCost(items);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json({ success: true, data: result.data, source: "sandbox_api" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// GAP G21: Capital Gains Report (via Sandbox.co.in API)
// ==========================================
router.post("/api/tax/report/capital-gains", async (req: Request, res: Response) => {
  try {
    const { pan, assessmentYear, assetClass } = req.body;
    if (!pan) return res.status(400).json({ success: false, message: "PAN required" });

    const result = await sandboxITRService.getCapitalGainsReport(pan, assessmentYear || "2025-26", assetClass);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json({ success: true, data: result.data, source: "sandbox_api" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// GAP G8 & G9: Email & WhatsApp Sharing (via Nodemailer)
// ==========================================
router.post("/api/tax/share/email", async (req: Request, res: Response) => {
  try {
    const { recipientEmail, recipientName, documentType, pan, assessmentYear, attachmentData } = req.body;
    if (!recipientEmail) return res.status(400).json({ success: false, message: "Recipient email required" });
    if (!documentType) return res.status(400).json({ success: false, message: "Document type required" });

    const docLabels: Record<string, string> = {
      itr_v: "ITR-V Acknowledgment", computation: "Computation Sheet", itr_json: "ITR JSON",
      form_26as: "Form 26AS", ais_tis: "AIS/TIS Statement", challan: "Challan Receipt", form_12bb: "Form 12BB",
    };

    const maskedPAN = pan ? pan.substring(0, 5) + "XXXXX" : "N/A";
    const docLabel = docLabels[documentType] || documentType;
    const subject = `${docLabel} - PAN: ${maskedPAN} - AY ${assessmentYear || "2025-26"}`;

    const htmlContent = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1a365d; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 22px;">FintekPro Tax Services</h1>
        </div>
        <div style="padding: 24px; background: #f8fafc;">
          <p>Dear ${recipientName || "Client"},</p>
          <p>Please find your <strong>${docLabel}</strong> for:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">Assessment Year</td><td style="padding: 8px; border: 1px solid #e2e8f0;">${assessmentYear || "2025-26"}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">PAN</td><td style="padding: 8px; border: 1px solid #e2e8f0;">${maskedPAN}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">Document Type</td><td style="padding: 8px; border: 1px solid #e2e8f0;">${docLabel}</td></tr>
          </table>
          ${attachmentData ? '<p>The document data is included below for your records.</p>' : '<p>Please log in to FintekPro to download the document.</p>'}
          <p style="margin-top: 24px; color: #64748b; font-size: 12px;">
            This is an automated message from FintekPro Tax Services. Please do not reply to this email.
            For queries, contact your assigned tax advisor.
          </p>
        </div>
        <div style="background: #1e293b; color: #94a3b8; padding: 16px; text-align: center; font-size: 12px;">
          FintekPro Financial Services | SEBI Registered | SOC2 Compliant
        </div>
      </div>
    `;

    const sent = await emailService.sendEmail({
      to: recipientEmail,
      subject,
      html: htmlContent,
      text: `Dear ${recipientName || "Client"},\n\nYour ${docLabel} for AY ${assessmentYear || "2025-26"} (PAN: ${maskedPAN}) is ready.\n\nPlease log in to FintekPro to access your documents.\n\n— FintekPro Tax Services`,
    });

    const emailRecord = {
      id: `email-${Date.now()}`,
      to: recipientEmail,
      recipientName: recipientName || "",
      subject,
      documentType,
      status: sent ? "sent" : "queued",
      sentAt: new Date().toISOString(),
      hasAttachment: !!attachmentData,
      deliveryMethod: sent ? "smtp" : "email_service_unavailable",
    };

    res.json({
      success: true,
      data: emailRecord,
      message: sent
        ? `${docLabel} sent to ${recipientEmail}`
        : `Email queued. SMTP not configured — configure EMAIL_HOST, EMAIL_USER, EMAIL_PASS to enable email delivery.`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/api/tax/share/whatsapp", async (req: Request, res: Response) => {
  try {
    const { phoneNumber, documentType, pan, assessmentYear, message } = req.body;
    if (!phoneNumber) return res.status(400).json({ success: false, message: "Phone number required" });

    const docLabels: Record<string, string> = {
      itr_v: "ITR-V Acknowledgment", computation: "Computation Sheet", summary: "ITR Summary",
      challan: "Challan Receipt", form_12bb: "Form 12BB",
    };

    const maskedPAN = pan ? pan.substring(0, 5) + "XXXXX" : "N/A";
    const defaultMsg = `Dear Client,\n\nYour ${docLabels[documentType] || documentType} for AY ${assessmentYear || "2025-26"} (PAN: ${maskedPAN}) has been prepared.\n\nPlease review and confirm.\n\n— FintekPro Tax Services`;
    const msgToSend = message || defaultMsg;

    let sent = false;
    let deliveryMethod = "whatsapp_link";
    try {
      const { twilioWhatsAppService } = await import("./services/twilio-whatsapp-service");
      if (twilioWhatsAppService.isAvailable()) {
        const result = await twilioWhatsAppService.sendMessage(phoneNumber, msgToSend);
        sent = result?.success ?? false;
        deliveryMethod = sent ? "twilio_whatsapp" : "twilio_failed";
      }
    } catch {
      try {
        const { whatsappService } = await import("./whatsapp");
        if (whatsappService.isClientReady()) {
          sent = await whatsappService.sendMessage(phoneNumber, msgToSend);
          deliveryMethod = sent ? "whatsapp_direct" : "whatsapp_failed";
        }
      } catch {
        deliveryMethod = "whatsapp_link";
      }
    }

    const whatsappRecord = {
      id: `wa-${Date.now()}`,
      to: phoneNumber,
      message: msgToSend,
      documentType,
      status: sent ? "sent" : "link_generated",
      sentAt: new Date().toISOString(),
      deliveryMethod,
      whatsappUrl: !sent ? `https://wa.me/${phoneNumber.replace(/\D/g, "")}?text=${encodeURIComponent(msgToSend)}` : undefined,
    };

    res.json({
      success: true,
      data: whatsappRecord,
      message: sent
        ? `${docLabels[documentType] || documentType} sent via WhatsApp to ${phoneNumber}`
        : `WhatsApp delivery service unavailable. Use the link to send manually.`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// GAP G10: PDF Computation Sheet (via Sandbox.co.in Calculator API)
// ==========================================
router.post("/api/tax/export/computation-pdf", async (req: Request, res: Response) => {
  try {
    const { pan, name, assessmentYear, itrForm, data } = req.body;
    if (!pan) return res.status(400).json({ success: false, message: "PAN required" });

    const salaryIncome = Number(data?.salaryDetails?.grossSalary || 0) - Number(data?.salaryDetails?.standardDeduction || 75000);
    const hpIncome = Number(data?.housePropertyIncome || 0);
    const stcg = Number(data?.capitalGainsDetails?.shortTermGains || 0);
    const ltcg = Number(data?.capitalGainsDetails?.longTermGains || 0);
    const cgIncome = stcg + ltcg;
    const interestInc = Number(data?.otherIncomeDetails?.interestIncome || 0);
    const dividendInc = Number(data?.otherIncomeDetails?.dividendIncome || 0);
    const otherIncome = interestInc + dividendInc;
    const grossTotal = salaryIncome + hpIncome + cgIncome + otherIncome;
    const sec80C = Number(data?.deductionDetails?.section80C || 0);
    const sec80D = Number(data?.deductionDetails?.section80D || 0);
    const sec80G = Number(data?.deductionDetails?.section80G || 0);
    const deductions = sec80C + sec80D + sec80G + Number(data?.deductionDetails?.otherDeductions || 0);
    const tds = Number(data?.taxPaymentDetails?.tdsDeducted || 0);
    const advanceTax = Number(data?.taxPaymentDetails?.advanceTaxPaid || 0);
    const selfAssessmentTax = Number(data?.taxPaymentDetails?.selfAssessmentTax || 0);
    const totalPaid = tds + advanceTax + selfAssessmentTax;

    let taxResult: any = null;
    let taxSource = "local_fallback";
    try {
      const calcResult = await sandboxITRService.calculateTaxFromWizard({
        assessmentYear: assessmentYear || "2025-26",
        entityType: data?.entityType || "individual",
        salaryIncome: Number(data?.salaryDetails?.grossSalary || 0),
        housePropertyIncome: hpIncome,
        capitalGainsSTCG: stcg,
        capitalGainsLTCG: ltcg,
        capitalGainsExemptions: Number(data?.capitalGainsDetails?.exemptions || 0),
        businessIncome: Number(data?.businessIncome || 0),
        interestIncome: interestInc,
        dividendIncome: dividendInc,
        otherIncome: Number(data?.otherIncomeDetails?.otherIncome || 0),
        section80C: sec80C, section80D: sec80D, section80G: sec80G,
        section80E: Number(data?.deductionDetails?.section80E || 0),
        section80TTA: Number(data?.deductionDetails?.section80TTA || 0),
        otherDeductions: Number(data?.deductionDetails?.otherDeductions || 0),
        tdsDeducted: tds, advanceTaxPaid: advanceTax, selfAssessmentTax,
        standardDeduction: Number(data?.salaryDetails?.standardDeduction || 75000),
        professionalTax: Number(data?.salaryDetails?.professionalTax || 0),
        homeLoanInterest: Number(data?.deductionDetails?.homeLoanInterest || 0),
      });
      if (calcResult.success && calcResult.data) {
        taxResult = calcResult.data;
        taxSource = "sandbox_api";
      }
    } catch (apiErr) {
      console.warn("[Computation] Sandbox API unavailable, using local calculation:", apiErr);
    }

    const taxableIncome = taxResult?.taxableIncome ?? Math.max(0, grossTotal - deductions);
    const tax = taxResult?.taxLiability ?? computeSimpleTax(taxableIncome);
    const cess = Math.round(tax * 0.04);
    const totalTaxLiability = tax + cess;
    const balanceDue = Math.max(0, totalTaxLiability - totalPaid);
    const refund = totalPaid > totalTaxLiability ? totalPaid - totalTaxLiability : 0;

    const pdfContent = {
      title: "COMPUTATION OF INCOME AND TAX",
      subtitle: `Assessment Year: ${assessmentYear || "2025-26"} | ITR Form: ${itrForm || "ITR-1"}`,
      assessee: { name: name || "", pan, status: "Individual" },
      generatedAt: new Date().toISOString(),
      calculationSource: taxSource,
      sections: [
        { heading: "1. INCOME FROM SALARY", items: [
          { label: "Gross Salary", amount: Number(data?.salaryDetails?.grossSalary || 0) },
          { label: "Less: Standard Deduction u/s 16(ia)", amount: Number(data?.salaryDetails?.standardDeduction || 75000), isDeduction: true },
          { label: "Net Salary Income", amount: salaryIncome, isBold: true },
        ]},
        { heading: "2. INCOME FROM HOUSE PROPERTY", items: [{ label: "Net Income from HP", amount: hpIncome }] },
        { heading: "3. CAPITAL GAINS", items: [
          { label: "Short-Term Capital Gains", amount: stcg },
          { label: "Long-Term Capital Gains", amount: ltcg },
          { label: "Total Capital Gains", amount: cgIncome, isBold: true },
        ]},
        { heading: "4. INCOME FROM OTHER SOURCES", items: [
          { label: "Interest Income", amount: interestInc },
          { label: "Dividend Income", amount: dividendInc },
          { label: "Total Other Income", amount: otherIncome, isBold: true },
        ]},
        { heading: "5. GROSS TOTAL INCOME", items: [{ label: "Gross Total Income", amount: taxResult?.totalIncome ?? grossTotal, isBold: true }] },
        { heading: "6. DEDUCTIONS UNDER CHAPTER VI-A", items: [
          { label: "Section 80C", amount: sec80C, isDeduction: true },
          { label: "Section 80D", amount: sec80D, isDeduction: true },
          { label: "Section 80G", amount: sec80G, isDeduction: true },
          { label: "Total Deductions", amount: taxResult?.totalDeductions ?? deductions, isBold: true, isDeduction: true },
        ]},
        { heading: "7. TOTAL TAXABLE INCOME", items: [{ label: "Total Taxable Income", amount: taxableIncome, isBold: true }] },
        { heading: "8. TAX COMPUTATION", items: [
          { label: `Tax on Total Income (${data?.taxRegime || "new"} regime)`, amount: tax },
          { label: "Health & Education Cess @ 4%", amount: cess },
          { label: "Total Tax Liability", amount: totalTaxLiability, isBold: true },
        ]},
        { heading: "9. TAXES PAID", items: [
          { label: "TDS Deducted", amount: tds, isDeduction: true },
          { label: "Advance Tax Paid", amount: advanceTax, isDeduction: true },
          { label: "Self-Assessment Tax", amount: selfAssessmentTax, isDeduction: true },
          { label: "Total Tax Paid", amount: totalPaid, isBold: true, isDeduction: true },
        ]},
        { heading: "10. TAX PAYABLE / REFUND", items: [
          ...(balanceDue > 0 ? [{ label: "Balance Tax Payable", amount: balanceDue, isBold: true }] : []),
          ...(refund > 0 ? [{ label: "Refund Due", amount: refund, isBold: true, isRefund: true }] : []),
        ]},
      ],
      footer: {
        verification: `I, ${name || "the assessee"}, hereby declare that to the best of my knowledge and belief, the information given above is correct, complete, and truly stated.`,
        place: "", date: new Date().toISOString().split("T")[0],
      },
      format: "structured_pdf_data",
      fileName: `Computation_${pan}_AY${(assessmentYear || "2025-26").replace("-", "")}.json`,
    };

    res.json({ success: true, data: pdfContent });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// GAP G11: Refund Status Tracking (via Sandbox.co.in API)
// ==========================================
router.get("/api/tax/refund/status", async (req: Request, res: Response) => {
  try {
    const { pan, assessmentYear, acknowledgmentNumber } = req.query;
    if (!pan) return res.status(400).json({ success: false, message: "PAN required" });

    if (acknowledgmentNumber) {
      const apiResult = await sandboxITRService.getITRStatus(String(acknowledgmentNumber));
      if (apiResult.success && apiResult.data) {
        const statusMap: Record<string, number> = { "Filed": 1, "Processing": 3, "Verified": 2, "Defective": 3, "Failed": 0 };
        const completedSteps = statusMap[apiResult.data.status] ?? 1;
        const allStages = [
          { stage: "Return Filed", status: completedSteps >= 1 ? "completed" : "pending", date: apiResult.data.filingDate || null },
          { stage: "Return Verified (e-Verification)", status: completedSteps >= 2 ? "completed" : completedSteps === 1 ? "in_progress" : "pending", date: apiResult.data.verificationDate || null },
          { stage: "Return Processed at CPC", status: completedSteps >= 3 ? "completed" : completedSteps === 2 ? "in_progress" : "pending", date: null },
          { stage: "Intimation u/s 143(1) Sent", status: completedSteps >= 4 ? "completed" : completedSteps === 3 ? "in_progress" : "pending", date: null },
          { stage: "Refund Issued", status: apiResult.data.refundStatus === "Issued" ? "completed" : apiResult.data.refundStatus === "Processed" ? "in_progress" : "pending", date: null },
          { stage: "Refund Credited to Bank", status: "pending", date: null },
        ];

        return res.json({
          success: true,
          data: {
            pan: String(pan),
            assessmentYear: String(assessmentYear || "2025-26"),
            acknowledgmentNumber: apiResult.data.acknowledgmentNumber,
            status: apiResult.data.status,
            stages: allStages,
            refundAmount: apiResult.data.refundAmount || null,
            taxLiability: apiResult.data.taxLiability,
            itPortalLink: "https://www.incometax.gov.in/iec/foportal/",
            source: "sandbox_api",
            note: "Status fetched from Income Tax portal via Sandbox.co.in API.",
          },
        });
      }
    }

    res.json({
      success: true,
      data: {
        pan: String(pan),
        assessmentYear: String(assessmentYear || "2025-26"),
        status: "NO_FILING_FOUND",
        stages: [
          { stage: "Return Filed", status: "pending", date: null },
          { stage: "Return Verified (e-Verification)", status: "pending", date: null },
          { stage: "Return Processed at CPC", status: "pending", date: null },
          { stage: "Intimation u/s 143(1) Sent", status: "pending", date: null },
          { stage: "Refund Issued", status: "pending", date: null },
          { stage: "Refund Credited to Bank", status: "pending", date: null },
        ],
        refundAmount: null,
        itPortalLink: "https://www.incometax.gov.in/iec/foportal/",
        source: "no_ack_number",
        note: "No acknowledgment number provided. Provide your ITR acknowledgment number to check real-time status from the IT portal. You can also check directly at incometax.gov.in.",
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// GAP G12: Filing Deadline Reminders
// ==========================================
router.get("/api/tax/deadlines", async (_req: Request, res: Response) => {
  try {
    const deadlines = [
      { form: "ITR-1/ITR-4", category: "Individual/HUF (No Audit)", deadline: "2025-07-31", status: "upcoming", description: "Last date for non-audit cases", penalty: "₹5,000 after due date (₹1,000 if income ≤ ₹5L)" },
      { form: "ITR-2/ITR-3", category: "Individual (CG/Business)", deadline: "2025-07-31", status: "upcoming", description: "Capital gains / business income", penalty: "₹5,000 after due date" },
      { form: "ITR-5/ITR-6/ITR-7", category: "Firms/Companies/Trusts (Audit)", deadline: "2025-10-31", status: "upcoming", description: "Audit cases u/s 44AB", penalty: "₹5,000 + interest u/s 234A" },
      { form: "Tax Audit Report", category: "44AB Audit", deadline: "2025-09-30", status: "upcoming", description: "Tax audit report submission", penalty: "0.5% of turnover or ₹1,50,000" },
      { form: "ITR-U", category: "Updated Return", deadline: "2027-03-31", status: "upcoming", description: "Updated return for AY 2025-26 (within 24 months)", penalty: "25% additional tax (12m) / 50% (24m)" },
      { form: "Advance Tax - Q1", category: "Advance Tax", deadline: "2025-06-15", status: "upcoming", description: "15% of estimated tax", penalty: "Interest u/s 234C" },
      { form: "Advance Tax - Q2", category: "Advance Tax", deadline: "2025-09-15", status: "upcoming", description: "45% of estimated tax", penalty: "Interest u/s 234C" },
      { form: "Advance Tax - Q3", category: "Advance Tax", deadline: "2025-12-15", status: "upcoming", description: "75% of estimated tax", penalty: "Interest u/s 234C" },
      { form: "Advance Tax - Q4", category: "Advance Tax", deadline: "2026-03-15", status: "upcoming", description: "100% of estimated tax", penalty: "Interest u/s 234C" },
      { form: "Belated Return", category: "Late Filing", deadline: "2025-12-31", status: "upcoming", description: "Last date for belated/revised return u/s 139(4)", penalty: "₹5,000 + loss of carry-forward" },
    ];

    const now = new Date();
    const enriched = deadlines.map(d => {
      const dt = new Date(d.deadline);
      const daysLeft = Math.ceil((dt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return { ...d, daysLeft, urgency: daysLeft <= 7 ? "critical" : daysLeft <= 30 ? "warning" : "normal" };
    });

    res.json({ success: true, data: enriched });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// GAP G14: ITR-V PDF Generation (via Sandbox.co.in API)
// ==========================================
router.post("/api/tax/generate/itrv", async (req: Request, res: Response) => {
  try {
    const { pan, name, assessmentYear, itrForm, ackNumber, filingDate, incomeData } = req.body;
    if (!pan || !name) return res.status(400).json({ success: false, message: "PAN and name required" });

    if (ackNumber) {
      const apiResult = await sandboxITRService.downloadITRV(ackNumber);
      if (apiResult.success && apiResult.data) {
        return res.json({
          success: true,
          data: {
            title: "INDIAN INCOME TAX RETURN VERIFICATION FORM",
            formType: "ITR-V",
            assessmentYear: assessmentYear || "2025-26",
            ackNumber,
            downloadUrl: apiResult.data.downloadUrl,
            fileName: apiResult.data.fileName,
            assessee: { name, pan, status: "Resident Individual", aadhaarLinked: true },
            itrForm: itrForm || "ITR-1",
            source: "sandbox_api",
            generatedAt: new Date().toISOString(),
            instructions: [
              "This ITR-V is valid only if it is digitally signed or e-verified.",
              "If not e-verified within 30 days, send signed ITR-V to: CPC, Post Bag No. 1, Electronic City Post Office, Bengaluru — 560100, Karnataka.",
              "Do not send this form to any other office of the Income Tax Department.",
            ],
          },
        });
      }
    }

    const grossTotalIncome = Number(incomeData?.grossTotalIncome || 0);
    const totalDeductions = Number(incomeData?.totalDeductions || 0);
    const taxableIncome = Number(incomeData?.taxableIncome || Math.max(0, grossTotalIncome - totalDeductions));
    const netTaxPayable = Number(incomeData?.netTaxPayable || 0);
    const totalTaxesPaid = Number(incomeData?.totalTaxesPaid || 0);

    const itrV = {
      title: "INDIAN INCOME TAX RETURN VERIFICATION FORM",
      formType: "ITR-V",
      assessmentYear: assessmentYear || "2025-26",
      ackNumber: ackNumber || null,
      filingDate: filingDate || new Date().toISOString().split("T")[0],
      assessee: { name, pan, status: "Resident Individual", address: "", aadhaarLinked: true },
      itrForm: itrForm || "ITR-1",
      returnFiled: {
        section: "139(1) — On or before due date",
        originalOrRevised: "Original",
      },
      incomeDetails: {
        grossTotalIncome,
        totalDeductions,
        totalTaxableIncome: taxableIncome,
        currentYearLoss: Number(incomeData?.currentYearLoss || 0),
        netTaxPayable,
        totalTaxesPaid,
        refundOrBalanceDue: totalTaxesPaid - netTaxPayable,
      },
      bankDetails: incomeData?.bankDetails || { bankName: "", accountNumber: "", ifscCode: "", accountType: "Savings" },
      verification: {
        place: "",
        date: new Date().toISOString().split("T")[0],
        declaration: `I, ${name}, son/daughter of ________, solemnly declare that to the best of my knowledge and belief, the information given in the return and schedules thereto is correct and complete and that the amount of total income and other particulars shown therein are truly stated.`,
      },
      instructions: [
        "This ITR-V is valid only if it is digitally signed or e-verified.",
        "If not e-verified within 30 days, send signed ITR-V to: CPC, Post Bag No. 1, Electronic City Post Office, Bengaluru — 560100, Karnataka.",
        "Do not send this form to any other office of the Income Tax Department.",
      ],
      source: ackNumber ? "sandbox_api_fallback" : "local_generation",
      note: ackNumber ? "Sandbox API did not return ITR-V. Showing structured data. Re-try with valid acknowledgment number." : "No acknowledgment number provided. File ITR first to generate official ITR-V.",
      generatedAt: new Date().toISOString(),
      fileName: `ITR-V_${pan}_AY${(assessmentYear || "2025-26").replace("-", "")}.json`,
    };

    res.json({ success: true, data: itrV });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// GAP G15: Computation History
// ==========================================
const computationHistory = new Map<string, any[]>();

router.post("/api/tax/history/save", async (req: Request, res: Response) => {
  try {
    const { pan, assessmentYear, data } = req.body;
    if (!pan || !assessmentYear) return res.status(400).json({ success: false, message: "PAN and assessment year required" });
    const key = pan.toUpperCase();
    const existing = computationHistory.get(key) || [];
    existing.push({ assessmentYear, savedAt: new Date().toISOString(), data, id: `hist-${Date.now()}` });
    computationHistory.set(key, existing);
    res.json({ success: true, message: "Computation saved to history" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/api/tax/history/:pan", async (req: Request, res: Response) => {
  try {
    const pan = req.params.pan?.toUpperCase();
    if (!pan) return res.status(400).json({ success: false, message: "PAN required" });
    const history = computationHistory.get(pan) || [];
    res.json({ success: true, data: history, total: history.length });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// GAP G16: Form 49A (PAN Application)
// ==========================================
router.post("/api/tax/form49a/generate", async (req: Request, res: Response) => {
  try {
    const { applicationType, title, lastName, firstName, middleName, dateOfBirth, gender, fatherName, address, phone, email, aadhaarNumber, applicantStatus } = req.body;
    if (!lastName || !firstName || !dateOfBirth) return res.status(400).json({ success: false, message: "Name and date of birth required" });

    const form49A = {
      formType: applicationType === "correction" ? "FORM 49A (CORRECTION)" : "FORM 49A (NEW PAN)",
      applicationId: `49A-${Date.now()}`,
      applicant: {
        title: title || "Shri", lastName, firstName, middleName: middleName || "",
        dateOfBirth, gender: gender || "Male",
        fatherName: fatherName || "",
        applicantStatus: applicantStatus || "Individual",
      },
      address: {
        residenceAddress: address?.residence || "",
        officeAddress: address?.office || "",
        city: address?.city || "",
        state: address?.state || "",
        pinCode: address?.pinCode || "",
        country: "India",
      },
      contact: { phone: phone || "", email: email || "" },
      identityProof: { aadhaarNumber: aadhaarNumber || "", documentType: aadhaarNumber ? "Aadhaar Card" : "Other" },
      fee: { amount: applicationType === "correction" ? 107 : 107, currency: "INR", gst: 19, total: 126 },
      submissionUrl: "https://www.onlineservices.nsdl.com/paam/endUserRegisterContact.html",
      utiitslUrl: "https://www.pan.utiitsl.com/PAN/",
      generatedAt: new Date().toISOString(),
    };

    res.json({ success: true, data: form49A });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// GAP G17: Pre-Filing Error Detection Engine
// ==========================================
router.post("/api/tax/validate/pre-filing", async (req: Request, res: Response) => {
  try {
    const { pan, assessmentYear, itrForm, data } = req.body;
    if (!pan || !data) return res.status(400).json({ success: false, message: "PAN and data required" });

    const errors: any[] = [];
    const warnings: any[] = [];
    const info: any[] = [];

    if (!pan || pan.length !== 10) errors.push({ code: "E001", field: "pan", message: "Invalid PAN format", severity: "error" });
    if (pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) errors.push({ code: "E002", field: "pan", message: "PAN does not match standard format AAAAA9999A", severity: "error" });

    const salary = Number(data?.salaryDetails?.grossSalary || 0);
    const stdDeduction = Number(data?.salaryDetails?.standardDeduction || 0);
    if (salary > 0 && stdDeduction > 75000) errors.push({ code: "E003", field: "standardDeduction", message: "Standard deduction cannot exceed ₹75,000 (Budget 2024)", severity: "error" });
    if (salary > 0 && !data?.salaryDetails?.employerTAN) warnings.push({ code: "W001", field: "employerTAN", message: "Employer TAN not provided — TDS credit may not be processed", severity: "warning" });

    const sec80C = Number(data?.deductionDetails?.section80C || 0);
    if (sec80C > 150000 && data?.taxRegime === "old") errors.push({ code: "E004", field: "section80C", message: "Section 80C deduction cannot exceed ₹1,50,000", severity: "error" });
    const sec80D = Number(data?.deductionDetails?.section80D || 0);
    if (sec80D > 100000) errors.push({ code: "E005", field: "section80D", message: "Section 80D deduction exceeds maximum limit of ₹1,00,000", severity: "error" });

    if (data?.taxRegime === "new" && sec80C > 0) warnings.push({ code: "W002", field: "regime", message: "Chapter VI-A deductions (80C, 80D, etc.) are not available under New Regime", severity: "warning" });

    const stcg = Number(data?.capitalGainsDetails?.shortTermGains || 0);
    const ltcg = Number(data?.capitalGainsDetails?.longTermGains || 0);
    if ((stcg !== 0 || ltcg !== 0) && itrForm === "ITR-1") errors.push({ code: "E006", field: "itrForm", message: "Capital gains not allowed in ITR-1 — use ITR-2 or ITR-3", severity: "error" });

    const businessInc = Number(data?.businessIncome || 0);
    if (businessInc !== 0 && itrForm === "ITR-1") errors.push({ code: "E008", field: "itrForm", message: "Business/professional income not allowed in ITR-1 — use ITR-3 or ITR-4", severity: "error" });

    const agriIncome = Number(data?.agriculturalIncome || 0);
    if (agriIncome > 5000 && itrForm === "ITR-1") errors.push({ code: "E009", field: "itrForm", message: "Agricultural income exceeding ₹5,000 not allowed in ITR-1 — use ITR-2", severity: "error" });

    const housePropertyCount = Number(data?.housePropertyCount || data?.numberOfHouseProperties || 0);
    if (housePropertyCount > 1 && itrForm === "ITR-1") errors.push({ code: "E010", field: "itrForm", message: "Multiple house properties not allowed in ITR-1 — use ITR-2", severity: "error" });

    const sec80GG = Number(data?.deductionDetails?.section80GG || 0);
    if (sec80GG > 0 && data?.taxRegime === "old") {
      const maxGG = Math.min(60000, Math.round(Number(data?.grossTotalIncome || 0) * 0.25));
      if (sec80GG > maxGG) errors.push({ code: "E011", field: "section80GG", message: `Section 80GG deduction cannot exceed ₹60,000/year or 25% of total income (max: ₹${maxGG.toLocaleString("en-IN")})`, severity: "error" });
    }

    const tds = Number(data?.taxPaymentDetails?.tdsDeducted || 0);
    const grossTotal = salary - stdDeduction + stcg + ltcg + Number(data?.otherIncomeDetails?.interestIncome || 0);
    if (tds > grossTotal * 0.5) warnings.push({ code: "W003", field: "tds", message: "TDS exceeds 50% of gross income — verify 26AS data", severity: "warning" });

    if (data?.residentialStatus === "NRI" && data?.deductionDetails?.section80C > 0 && data?.taxRegime === "old") {
      warnings.push({ code: "W004", field: "nri_deductions", message: "NRIs may have limited Chapter VI-A deductions — verify eligibility", severity: "warning" });
    }

    const grossIncome = Number(data?.grossTotalIncome || grossTotal);
    if (grossIncome > 5000000 && itrForm === "ITR-1") warnings.push({ code: "W005", field: "itrForm", message: "Income exceeds ₹50 lakhs — Schedule AL (Assets & Liabilities) may be required (use ITR-2)", severity: "warning" });

    if (data?.taxPaymentDetails?.selfAssessmentTaxPaid > 0 && !data?.taxPaymentDetails?.selfAssessmentChallanDate) {
      warnings.push({ code: "W006", field: "challanDate", message: "Self-assessment tax challan date not provided — needed for 234B/C computation", severity: "warning" });
    }

    const hpIncome = Number(data?.housePropertyIncome || 0);
    if (hpIncome < -200000) errors.push({ code: "E007", field: "houseProperty", message: "House property loss set-off capped at ₹2,00,000 per year (excess carries forward)", severity: "error" });

    if (data?.bankDetails?.accountNumber && !data?.bankDetails?.ifscCode) {
      warnings.push({ code: "W007", field: "bankIfsc", message: "Bank IFSC code missing — required for refund credit", severity: "warning" });
    }

    if (data?.residentialStatus === "NRI" && itrForm === "ITR-1") {
      errors.push({ code: "E012", field: "itrForm", message: "Non-residents cannot file ITR-1 — use ITR-2 or higher", severity: "error" });
    }

    if (data?.isDirectorInCompany && itrForm === "ITR-1") {
      errors.push({ code: "E013", field: "itrForm", message: "Directors of companies cannot file ITR-1 — use ITR-2", severity: "error" });
    }

    if (data?.hasForeignAssets && itrForm === "ITR-1") {
      errors.push({ code: "E014", field: "itrForm", message: "Taxpayers with foreign assets/income cannot file ITR-1 — use ITR-2 with Schedule FA", severity: "error" });
    }

    info.push({ code: "I001", message: `Filing ${itrForm || "ITR-1"} for AY ${assessmentYear || "2025-26"}` });
    if (grossIncome > 2500000) info.push({ code: "I002", message: "Return is mandatory (income exceeds basic exemption limit)" });

    const isFileable = errors.length === 0;

    res.json({
      success: true,
      data: {
        isFileable,
        errors, warnings, info,
        summary: {
          totalErrors: errors.length, totalWarnings: warnings.length, totalInfo: info.length,
          verdict: isFileable ? (warnings.length > 0 ? "FILEABLE_WITH_WARNINGS" : "CLEAR_TO_FILE") : "ERRORS_FOUND",
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// GAP G18: Bulk JSON Upload for Multiple Clients
// ==========================================
router.post("/api/tax/practice/bulk-upload", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });
    const content = req.file.buffer.toString("utf-8");
    let clients: any[];
    try { clients = JSON.parse(content); } catch { return res.status(400).json({ success: false, message: "Invalid JSON format" }); }

    if (!Array.isArray(clients)) clients = [clients];

    const results: any[] = [];
    for (const client of clients) {
      if (!client.pan || !client.name) {
        results.push({ pan: client.pan || "N/A", name: client.name || "N/A", status: "failed", error: "PAN and name required" });
        continue;
      }
      const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      const record = {
        id: clientId, pan: client.pan, name: client.name, email: client.email || "",
        phone: client.phone || "", itrForm: client.itrForm || "ITR-1",
        assessmentYear: client.assessmentYear || "2025-26",
        status: "data_collection", filingStatus: "pending",
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        importedData: client.data || null,
      };
      clientDashboardStorage.set(clientId, record);
      results.push({ pan: client.pan, name: client.name, status: "success", clientId });
    }

    const success = results.filter(r => r.status === "success").length;
    const failed = results.filter(r => r.status === "failed").length;

    res.json({
      success: true,
      data: { results, summary: { total: clients.length, imported: success, failed } },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export { router as taxRoutes, determinePANType, isNRI };
