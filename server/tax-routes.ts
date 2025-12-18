import { Router, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { z } from "zod";

const router = Router();

const itrDraftStorage = new Map<number, any>();
let draftIdCounter = 1;

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
    otherSources: coerceNumber
  }).optional(),
  deductionDetails: z.object({
    section80C: coerceNumber,
    section80D: coerceNumber,
    section80E: coerceNumber,
    section80G: coerceNumber,
    section80TTA: coerceNumber,
    otherDeductions: coerceNumber
  }).optional(),
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
    const userId = session?.userId;
    
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
    const userId = (req as any).session?.userId;
    
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

router.post("/itr/draft", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).session?.userId;
    
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
    const existingDraftKey = Array.from(itrDraftStorage.entries()).find(
      ([_, d]) => d.userId === userId && d.pan === draftData.pan && d.assessmentYear === draftData.assessmentYear
    );
    
    let draftId: number;
    const now = new Date().toISOString();
    
    if (existingDraftKey) {
      draftId = existingDraftKey[0];
      const savedDraft = {
        id: draftId,
        ...draftData,
        userId,
        status: draftData.status || "draft",
        createdAt: existingDraftKey[1].createdAt,
        updatedAt: now
      };
      itrDraftStorage.set(draftId, savedDraft);
      res.json({ success: true, draft: savedDraft, updated: true });
    } else {
      draftId = draftIdCounter++;
      const savedDraft = {
        id: draftId,
        ...draftData,
        userId,
        status: draftData.status || "draft",
        createdAt: now,
        updatedAt: now
      };
      itrDraftStorage.set(draftId, savedDraft);
      res.json({ success: true, draft: savedDraft, created: true });
    }
  } catch (error) {
    console.error("Error saving ITR draft:", error);
    res.status(500).json({ error: "Failed to save draft" });
  }
});

router.get("/itr/drafts", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).session?.userId;
    
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
    const userId = (req as any).session?.userId;
    
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
    const userId = (req as any).session?.userId;
    
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
    const userId = (req as any).session?.userId;
    
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
    const userId = (req as any).session?.userId;
    
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
    const userId = (req as any).session?.userId;
    
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
    const userId = (req as any).session?.userId;
    
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
    const userId = (req as any).session?.userId;
    
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
    const userId = (req as any).session?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    
    const { draftId, amount, paymentMethod, couponCode } = req.body;
    
    if (!draftId || !amount || !paymentMethod) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    const transactionId = `TXN${Date.now()}${paymentIdCounter++}`;
    
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
    const userId = (req as any).session?.userId;
    
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
    const userId = (req as any).session?.userId;
    
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
    const userId = (req as any).session?.userId;
    
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
    const userId = (req as any).session?.userId;
    
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

router.get("/filing-status", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).session?.userId;
    
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

export { router as taxRoutes, determinePANType, isNRI };
