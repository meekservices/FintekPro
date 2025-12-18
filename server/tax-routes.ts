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
