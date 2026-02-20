import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle, 
  AlertTriangle,
  FileText,
  Calculator,
  Save,
  Send,
  Briefcase,
  Home,
  TrendingUp,
  Building2,
  Wallet,
  Receipt,
  HelpCircle,
  IndianRupee,
  Shield,
  Clock,
  Upload,
  Info,
  XCircle,
  Eye,
  Lock,
  BarChart3,
  Scale,
  Globe,
  Plus,
  Trash2
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type PANType = "individual" | "huf" | "firm" | "company" | "trust" | "nri";

interface PANContext {
  pan: string;
  panType: PANType;
  name: string;
  isVerified: boolean;
  entityDescription?: string;
}

interface IncomeSource {
  hasSalary: boolean;
  hasHouseProperty: boolean;
  hasCapitalGains: boolean;
  hasBusinessIncome: boolean;
  hasForeignIncome: boolean;
  hasOtherIncome: boolean;
}

interface SalaryDetails {
  grossSalary: number;
  allowances: number;
  perquisites: number;
  profitInLieu: number;
  standardDeduction: number;
  professionalTax: number;
  employerPF: number;
}

interface HousePropertyDetails {
  propertyCount: number;
  rentalIncome: number;
  municipalTaxes: number;
  interestOnLoan: number;
  isSelfOccupied: boolean;
}

interface CapitalGainsDetails {
  shortTermGains: number;
  longTermGains: number;
  exemptionsApplied: number;
}

interface ForeignIncomeDetails {
  foreignSTCG: number;
  foreignLTCG: number;
  foreignDividends: number;
  foreignInterest: number;
  foreignOtherIncome: number;
  foreignTaxPaid: number;
  dtaaCountry: string;
  dtaaArticle: string;
  currencyCode: string;
  exchangeRate: number;
  hasForeignAssets: boolean;
  foreignAssets: ForeignAssetEntry[];
}

interface ForeignAssetEntry {
  countryCode: string;
  countryName: string;
  assetType: string;
  institutionName: string;
  accountNumber: string;
  peakBalance: number;
  closingBalance: number;
  acquisitionDate: string;
  totalGrossIncome: number;
  taxableIncome: number;
}

interface OtherIncomeDetails {
  interestIncome: number;
  dividendIncome: number;
  otherSources: number;
}

interface DeductionDetails {
  section80C: number;
  section80D: number;
  section80E: number;
  section80G: number;
  section80TTA: number;
  otherDeductions: number;
}

interface TaxPaymentDetails {
  tdsDeducted: number;
  advanceTaxPaid: number;
  selfAssessmentTax: number;
}

interface SandboxTaxResult {
  success: boolean;
  data?: {
    totalIncome: number;
    taxableIncome: number;
    totalDeductions: number;
    taxLiability: number;
    taxPaid: number;
    refundAmount: number;
    taxPayable: number;
    effectiveTaxRate: number;
    regimeComparison?: {
      oldRegime: { taxPayable: number; effectiveRate: number };
      newRegime: { taxPayable: number; effectiveRate: number };
      recommended: string;
      savings: number;
    };
  };
  message: string;
}

interface ITRDraft {
  id?: number;
  pan: string;
  assessmentYear: string;
  itrForm: string;
  status: "draft" | "preview" | "pending_payment" | "paid" | "submitted" | "verified";
  incomeSources: IncomeSource;
  salaryDetails?: SalaryDetails;
  housePropertyDetails?: HousePropertyDetails;
  capitalGainsDetails?: CapitalGainsDetails;
  otherIncomeDetails?: OtherIncomeDetails;
  deductionDetails?: DeductionDetails;
  grossTotalIncome: number;
  totalDeductions: number;
  taxableIncome: number;
  taxPayable: number;
  tdsCredits: number;
  advanceTax: number;
  selfAssessmentTax: number;
  refundDue: number;
}

interface StepValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

const ASSESSMENT_YEARS = ["2025-26", "2024-25", "2023-24"];

const STEPS = [
  { id: "basic", title: "Basic Info", icon: FileText, description: "Your PAN and assessment year" },
  { id: "sources", title: "Income Sources", icon: Wallet, description: "Select applicable income types" },
  { id: "salary", title: "Salary", icon: Briefcase, description: "Salary and employment details" },
  { id: "property", title: "House Property", icon: Home, description: "Rental and home loan details" },
  { id: "capital", title: "Capital Gains", icon: TrendingUp, description: "Investment gains and losses" },
  { id: "foreign", title: "Foreign Income", icon: Globe, description: "Global stocks, DTAA relief, Schedule FA" },
  { id: "other", title: "Other Income", icon: Receipt, description: "Interest, dividends, and more" },
  { id: "deductions", title: "Deductions", icon: Calculator, description: "Tax-saving investments" },
  { id: "tax_payments", title: "Tax Payments", icon: IndianRupee, description: "TDS, advance tax, self-assessment" },
  { id: "review", title: "Review & File", icon: CheckCircle, description: "Verify and submit" }
];

const DEDUCTION_LIMITS: Record<string, { max: number; label: string }> = {
  section80C: { max: 150000, label: "Section 80C" },
  section80D: { max: 100000, label: "Section 80D" },
  section80TTA: { max: 10000, label: "Section 80TTA" },
};

function FieldHint({ text }: { text: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help inline-block ml-1" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[280px] text-xs">
          <p>{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function CurrencyInput({ id, value, onChange, placeholder, max, hint, disabled, "data-testid": testId }: {
  id: string;
  value: number;
  onChange: (val: number) => void;
  placeholder: string;
  max?: number;
  hint?: string;
  disabled?: boolean;
  "data-testid"?: string;
}) {
  const [localVal, setLocalVal] = useState(value ? String(value) : "");
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    setLocalVal(value ? String(value) : "");
  }, [value]);

  const handleChange = (raw: string) => {
    const cleaned = raw.replace(/[^0-9]/g, "");
    setLocalVal(cleaned);
    const num = Number(cleaned) || 0;
    if (max && num > max) {
      setWarning(`Maximum limit is ₹${max.toLocaleString("en-IN")}. Amount will be capped.`);
      onChange(max);
    } else {
      setWarning(null);
      onChange(num);
    }
  };

  return (
    <div className="space-y-1">
      <div className="relative">
        <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          id={id}
          type="text"
          inputMode="numeric"
          className={`pl-9 ${warning ? 'border-amber-400 focus-visible:ring-amber-400' : ''}`}
          value={localVal}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          data-testid={testId}
        />
      </div>
      {warning && (
        <p className="text-xs text-amber-600 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" /> {warning}
        </p>
      )}
      {hint && !warning && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

function ValidationBanner({ validation }: { validation: StepValidation }) {
  if (validation.isValid && validation.warnings.length === 0) return null;
  return (
    <div className="space-y-2">
      {validation.errors.map((err, i) => (
        <Alert key={`err-${i}`} className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
          <XCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-700 dark:text-red-300">{err}</AlertDescription>
        </Alert>
      ))}
      {validation.warnings.map((warn, i) => (
        <Alert key={`warn-${i}`} className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700 dark:text-amber-300">{warn}</AlertDescription>
        </Alert>
      ))}
    </div>
  );
}

export default function TaxITRSelfPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const [currentStepId, setCurrentStepId] = useState<string>("basic");
  const [assessmentYear, setAssessmentYear] = useState("2025-26");
  const [recommendedForm, setRecommendedForm] = useState("ITR-1");
  const [taxRegime, setTaxRegime] = useState<"old" | "new">("new");
  const [visitedSteps, setVisitedSteps] = useState<Set<string>>(new Set(["basic"]));
  const [form16Uploading, setForm16Uploading] = useState(false);
  
  const [incomeSources, setIncomeSources] = useState<IncomeSource>({
    hasSalary: true,
    hasHouseProperty: false,
    hasCapitalGains: false,
    hasBusinessIncome: false,
    hasForeignIncome: false,
    hasOtherIncome: false
  });

  const [salaryDetails, setSalaryDetails] = useState<SalaryDetails>({
    grossSalary: 0,
    allowances: 0,
    perquisites: 0,
    profitInLieu: 0,
    standardDeduction: 75000,
    professionalTax: 0,
    employerPF: 0
  });

  const [housePropertyDetails, setHousePropertyDetails] = useState<HousePropertyDetails>({
    propertyCount: 1,
    rentalIncome: 0,
    municipalTaxes: 0,
    interestOnLoan: 0,
    isSelfOccupied: true
  });

  const [capitalGainsDetails, setCapitalGainsDetails] = useState<CapitalGainsDetails>({
    shortTermGains: 0,
    longTermGains: 0,
    exemptionsApplied: 0
  });

  const [foreignIncomeDetails, setForeignIncomeDetails] = useState<ForeignIncomeDetails>({
    foreignSTCG: 0,
    foreignLTCG: 0,
    foreignDividends: 0,
    foreignInterest: 0,
    foreignOtherIncome: 0,
    foreignTaxPaid: 0,
    dtaaCountry: "US",
    dtaaArticle: "",
    currencyCode: "USD",
    exchangeRate: 83.5,
    hasForeignAssets: true,
    foreignAssets: [],
  });

  const [otherIncomeDetails, setOtherIncomeDetails] = useState<OtherIncomeDetails>({
    interestIncome: 0,
    dividendIncome: 0,
    otherSources: 0
  });

  const [deductionDetails, setDeductionDetails] = useState<DeductionDetails>({
    section80C: 0,
    section80D: 0,
    section80E: 0,
    section80G: 0,
    section80TTA: 0,
    otherDeductions: 0
  });

  const [taxPaymentDetails, setTaxPaymentDetails] = useState<TaxPaymentDetails>({
    tdsDeducted: 0,
    advanceTaxPaid: 0,
    selfAssessmentTax: 0
  });

  const [sandboxTaxResult, setSandboxTaxResult] = useState<SandboxTaxResult | null>(null);
  const [taxCalcError, setTaxCalcError] = useState<string | null>(null);

  const { data: panContext, isLoading: panLoading } = useQuery<PANContext>({
    queryKey: ["/api/tax/pan-context"],
    enabled: isAuthenticated
  });

  const saveDraftMutation = useMutation({
    mutationFn: async (draft: Partial<ITRDraft>) => {
      return apiRequest("/api/tax/itr/draft", {
        method: "POST",
        body: JSON.stringify(draft)
      });
    },
    onSuccess: () => {
      toast({ title: "Draft Saved", description: "Your ITR draft has been saved. You can resume anytime." });
      queryClient.invalidateQueries({ queryKey: ["/api/tax/itr/drafts"] });
    },
    onError: () => {
      toast({ title: "Save Failed", description: "Could not save draft. Please try again.", variant: "destructive" });
    }
  });

  const taxCalcMutation = useMutation({
    mutationFn: async () => {
      const salaryIncome = salaryDetails.grossSalary + salaryDetails.allowances +
        salaryDetails.perquisites + salaryDetails.profitInLieu -
        salaryDetails.standardDeduction - salaryDetails.professionalTax;

      let housePropertyIncome = 0;
      if (incomeSources.hasHouseProperty) {
        if (housePropertyDetails.isSelfOccupied) {
          housePropertyIncome = -Math.min(housePropertyDetails.interestOnLoan, 200000);
        } else {
          const netAnnualValue = housePropertyDetails.rentalIncome - housePropertyDetails.municipalTaxes;
          const stdDed = netAnnualValue * 0.30;
          housePropertyIncome = netAnnualValue - stdDed - housePropertyDetails.interestOnLoan;
        }
      }

      const foreignSTCG = incomeSources.hasForeignIncome ? foreignIncomeDetails.foreignSTCG : 0;
      const foreignLTCG = incomeSources.hasForeignIncome ? foreignIncomeDetails.foreignLTCG : 0;
      const foreignDividends = incomeSources.hasForeignIncome ? foreignIncomeDetails.foreignDividends : 0;
      const foreignInterest = incomeSources.hasForeignIncome ? foreignIncomeDetails.foreignInterest : 0;
      const foreignOtherInc = incomeSources.hasForeignIncome ? foreignIncomeDetails.foreignOtherIncome : 0;
      const foreignTaxPaid = incomeSources.hasForeignIncome ? foreignIncomeDetails.foreignTaxPaid : 0;

      const res = await apiRequest("/api/tax/itr/calculate", {
        method: "POST",
        body: JSON.stringify({
          assessmentYear,
          entityType: panContext?.panType || "individual",
          taxRegime,
          salaryIncome: Math.max(0, salaryIncome),
          housePropertyIncome,
          capitalGainsSTCG: capitalGainsDetails.shortTermGains + foreignSTCG,
          capitalGainsLTCG: capitalGainsDetails.longTermGains + foreignLTCG,
          capitalGainsExemptions: capitalGainsDetails.exemptionsApplied,
          businessIncome: 0,
          interestIncome: otherIncomeDetails.interestIncome + foreignInterest,
          dividendIncome: otherIncomeDetails.dividendIncome + foreignDividends,
          otherIncome: otherIncomeDetails.otherSources + foreignOtherInc,
          foreignTaxCredit: foreignTaxPaid,
          foreignIncomeCountry: incomeSources.hasForeignIncome ? foreignIncomeDetails.dtaaCountry : undefined,
          section80C: deductionDetails.section80C,
          section80D: deductionDetails.section80D,
          section80E: deductionDetails.section80E,
          section80G: deductionDetails.section80G,
          section80TTA: deductionDetails.section80TTA,
          otherDeductions: deductionDetails.otherDeductions,
          tdsDeducted: taxPaymentDetails.tdsDeducted,
          advanceTaxPaid: taxPaymentDetails.advanceTaxPaid,
          selfAssessmentTax: taxPaymentDetails.selfAssessmentTax,
          standardDeduction: salaryDetails.standardDeduction,
          professionalTax: salaryDetails.professionalTax,
          homeLoanInterest: housePropertyDetails.interestOnLoan,
        }),
      });
      return res as unknown as SandboxTaxResult;
    },
    onSuccess: (result) => {
      setSandboxTaxResult(result);
      setTaxCalcError(null);
      if (!result.success) {
        setTaxCalcError(result.message || "Tax calculation failed");
      }
    },
    onError: (error: Error) => {
      setTaxCalcError(error.message || "Tax calculation service unavailable");
      setSandboxTaxResult(null);
    }
  });

  useEffect(() => {
    let form = "ITR-1";
    const panType = panContext?.panType || "individual";
    
    if (panType === "firm") {
      form = "ITR-5";
    } else if (panType === "company") {
      form = "ITR-6";
    } else if (panType === "trust") {
      form = "ITR-7";
    } else if (panType === "huf") {
      if (incomeSources.hasBusinessIncome) form = "ITR-3";
      else form = "ITR-2";
    } else if (panType === "nri") {
      form = incomeSources.hasBusinessIncome ? "ITR-3" : "ITR-2";
    } else {
      if (incomeSources.hasBusinessIncome) {
        form = "ITR-3";
      } else if (incomeSources.hasCapitalGains || incomeSources.hasForeignIncome) {
        form = "ITR-2";
      } else if (housePropertyDetails.propertyCount > 1) {
        form = "ITR-2";
      } else {
        const totalIncome = salaryDetails.grossSalary + housePropertyDetails.rentalIncome + 
          otherIncomeDetails.interestIncome + otherIncomeDetails.dividendIncome;
        if (totalIncome > 5000000 || otherIncomeDetails.otherSources > 5000) {
          form = "ITR-2";
        } else {
          form = "ITR-1";
        }
      }
    }
    
    setRecommendedForm(form);
  }, [incomeSources, salaryDetails, housePropertyDetails, otherIncomeDetails, panContext]);

  useEffect(() => {
    const newSteps = getActiveSteps();
    const existsInNewSteps = newSteps.some(s => s.id === currentStepId);
    if (!existsInNewSteps) {
      const validSteps = newSteps.map(s => s.id);
      setCurrentStepId(validSteps.includes("sources") ? "sources" : validSteps[0] || "basic");
    }
  }, [incomeSources, currentStepId]);

  const getActiveSteps = () => {
    const active = [STEPS[0], STEPS[1]];
    if (incomeSources.hasSalary) active.push(STEPS[2]);
    if (incomeSources.hasHouseProperty) active.push(STEPS[3]);
    if (incomeSources.hasCapitalGains) active.push(STEPS[4]);
    if (incomeSources.hasForeignIncome) active.push(STEPS[5]);
    if (incomeSources.hasOtherIncome) active.push(STEPS[6]);
    active.push(STEPS[7]);
    active.push(STEPS[8]);
    active.push(STEPS[9]);
    return active;
  };

  const activeSteps = getActiveSteps();
  const currentStepIndex = activeSteps.findIndex(s => s.id === currentStepId);
  const safeCurrentStep = currentStepIndex >= 0 ? currentStepIndex : 0;
  const progress = ((safeCurrentStep + 1) / activeSteps.length) * 100;

  const validateStep = useCallback((stepId: string): StepValidation => {
    const errors: string[] = [];
    const warnings: string[] = [];

    switch (stepId) {
      case "basic":
        if (!panContext?.pan) errors.push("PAN details are required. Please ensure your PAN is linked.");
        break;
      case "sources":
        if (!incomeSources.hasSalary && !incomeSources.hasHouseProperty && !incomeSources.hasCapitalGains && 
            !incomeSources.hasBusinessIncome && !incomeSources.hasOtherIncome) {
          errors.push("Please select at least one income source to continue.");
        }
        if (incomeSources.hasBusinessIncome) {
          warnings.push("Business income requires ITR-3/4. Ensure you have your P&L and Balance Sheet ready.");
        }
        if (incomeSources.hasForeignIncome) {
          warnings.push("Foreign income requires ITR-2 or higher and may need Schedule FA (Foreign Assets).");
        }
        break;
      case "salary":
        if (incomeSources.hasSalary && salaryDetails.grossSalary <= 0) {
          errors.push("Please enter your gross salary. You can find this in your Form 16 Part B.");
        }
        if (salaryDetails.professionalTax > 2500) {
          warnings.push("Professional Tax is typically capped at ₹2,500/year in most states.");
        }
        if (salaryDetails.grossSalary > 0 && salaryDetails.allowances > salaryDetails.grossSalary) {
          errors.push("Allowances cannot exceed gross salary.");
        }
        break;
      case "property":
        if (!housePropertyDetails.isSelfOccupied && housePropertyDetails.rentalIncome <= 0) {
          errors.push("Please enter rental income for let-out property.");
        }
        if (housePropertyDetails.isSelfOccupied && housePropertyDetails.interestOnLoan > 200000) {
          warnings.push("For self-occupied property, home loan interest deduction is capped at ₹2,00,000.");
        }
        break;
      case "capital":
        if (capitalGainsDetails.exemptionsApplied > capitalGainsDetails.shortTermGains + capitalGainsDetails.longTermGains) {
          errors.push("Exemptions cannot exceed total capital gains.");
        }
        if (capitalGainsDetails.shortTermGains === 0 && capitalGainsDetails.longTermGains === 0) {
          warnings.push("If you have no capital gains, consider unchecking 'Capital Gains' in income sources.");
        }
        break;
      case "foreign":
        {
          const totalForeignIncome = foreignIncomeDetails.foreignSTCG + foreignIncomeDetails.foreignLTCG +
            foreignIncomeDetails.foreignDividends + foreignIncomeDetails.foreignInterest + foreignIncomeDetails.foreignOtherIncome;
          if (totalForeignIncome === 0) {
            warnings.push("No foreign income entered. If you don't have foreign income, uncheck 'Foreign Income / Assets' in income sources.");
          }
          if (foreignIncomeDetails.foreignTaxPaid > totalForeignIncome) {
            errors.push("Foreign tax paid (FTC) cannot exceed total foreign income. DTAA relief is limited to tax on foreign income.");
          }
          if (foreignIncomeDetails.exchangeRate <= 0) {
            errors.push("Please enter a valid RBI reference exchange rate for currency conversion.");
          }
          if (foreignIncomeDetails.hasForeignAssets && foreignIncomeDetails.foreignAssets.length === 0) {
            warnings.push("Schedule FA (Foreign Assets) disclosure is mandatory under the Black Money Act. Please add at least one foreign asset entry.");
          }
          if (foreignIncomeDetails.foreignTaxPaid > 0 && !foreignIncomeDetails.dtaaCountry) {
            errors.push("Please select the DTAA country to claim Foreign Tax Credit.");
          }
        }
        break;
      case "deductions":
        if (taxRegime === "new") {
          warnings.push("Under the New Tax Regime (default from FY 2023-24), most deductions under Chapter VI-A are not available. Only standard deduction applies.");
        }
        break;
      case "tax_payments":
        if (taxPaymentDetails.tdsDeducted > 0 && taxPaymentDetails.tdsDeducted > totals.grossTotalIncome * 0.40) {
          warnings.push("TDS appears high relative to your income. Please verify from Form 26AS.");
        }
        break;
    }
    return { isValid: errors.length === 0, errors, warnings };
  }, [incomeSources, salaryDetails, housePropertyDetails, capitalGainsDetails, foreignIncomeDetails, deductionDetails, taxPaymentDetails, panContext, taxRegime]);

  const calculateLocalTotals = () => {
    const salaryIncome = salaryDetails.grossSalary + salaryDetails.allowances + 
      salaryDetails.perquisites + salaryDetails.profitInLieu - 
      salaryDetails.standardDeduction - salaryDetails.professionalTax;
    
    let housePropertyIncome = 0;
    if (incomeSources.hasHouseProperty) {
      if (housePropertyDetails.isSelfOccupied) {
        housePropertyIncome = -Math.min(housePropertyDetails.interestOnLoan, 200000);
      } else {
        const netAnnualValue = housePropertyDetails.rentalIncome - housePropertyDetails.municipalTaxes;
        const standardDeduction = netAnnualValue * 0.30;
        housePropertyIncome = netAnnualValue - standardDeduction - housePropertyDetails.interestOnLoan;
      }
    }

    const capitalGains = capitalGainsDetails.shortTermGains + capitalGainsDetails.longTermGains - capitalGainsDetails.exemptionsApplied;
    const otherIncome = otherIncomeDetails.interestIncome + otherIncomeDetails.dividendIncome + otherIncomeDetails.otherSources;

    const foreignCapitalGains = incomeSources.hasForeignIncome ? (foreignIncomeDetails.foreignSTCG + foreignIncomeDetails.foreignLTCG) : 0;
    const foreignOtherIncome = incomeSources.hasForeignIncome ?
      (foreignIncomeDetails.foreignDividends + foreignIncomeDetails.foreignInterest + foreignIncomeDetails.foreignOtherIncome) : 0;
    const totalForeignIncome = foreignCapitalGains + foreignOtherIncome;
    const foreignTaxCredit = incomeSources.hasForeignIncome ? foreignIncomeDetails.foreignTaxPaid : 0;

    const grossTotalIncome = Math.max(0, salaryIncome) + housePropertyIncome + capitalGains + otherIncome + totalForeignIncome;

    const totalDeductions = Math.min(deductionDetails.section80C, 150000) +
      Math.min(deductionDetails.section80D, 100000) +
      deductionDetails.section80E +
      deductionDetails.section80G +
      Math.min(deductionDetails.section80TTA, 10000) +
      deductionDetails.otherDeductions;

    const totalTaxPaid = taxPaymentDetails.tdsDeducted + taxPaymentDetails.advanceTaxPaid + taxPaymentDetails.selfAssessmentTax;

    return {
      salaryIncome,
      housePropertyIncome,
      capitalGains,
      otherIncome,
      foreignCapitalGains,
      foreignOtherIncome,
      totalForeignIncome,
      foreignTaxCredit,
      grossTotalIncome,
      totalDeductions,
      totalTaxPaid,
    };
  };

  const totals = calculateLocalTotals();

  const handleSaveDraft = () => {
    const apiData = sandboxTaxResult?.data;
    saveDraftMutation.mutate({
      pan: panContext?.pan || "",
      assessmentYear,
      itrForm: recommendedForm,
      status: "draft",
      incomeSources,
      salaryDetails,
      housePropertyDetails,
      capitalGainsDetails,
      otherIncomeDetails,
      deductionDetails,
      grossTotalIncome: apiData?.totalIncome ?? totals.grossTotalIncome,
      totalDeductions: apiData?.totalDeductions ?? totals.totalDeductions,
      taxableIncome: apiData?.taxableIncome ?? 0,
      taxPayable: apiData?.taxPayable ?? 0,
      tdsCredits: taxPaymentDetails.tdsDeducted,
      advanceTax: taxPaymentDetails.advanceTaxPaid,
      selfAssessmentTax: taxPaymentDetails.selfAssessmentTax,
      refundDue: apiData?.refundAmount ?? 0,
    });
  };

  const handleProceedToPreview = () => {
    handleSaveDraft();
    navigate("/tax/itr/preview");
  };

  const handleForm16Upload = async (file: File) => {
    setForm16Uploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("assessmentYear", assessmentYear);
      const res = await fetch("/api/tax/itr/parse-form16", { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      if (data.parsed) {
        setSalaryDetails(prev => ({
          ...prev,
          grossSalary: data.parsed.grossSalary ?? prev.grossSalary,
          allowances: data.parsed.allowances ?? prev.allowances,
          professionalTax: data.parsed.professionalTax ?? prev.professionalTax,
          employerPF: data.parsed.employerPF ?? prev.employerPF,
        }));
        if (data.parsed.tdsDeducted) {
          setTaxPaymentDetails(prev => ({ ...prev, tdsDeducted: data.parsed.tdsDeducted }));
        }
        toast({ title: "Form 16 Parsed", description: "Salary and TDS details auto-filled from your Form 16." });
      }
    } catch {
      toast({ title: "Upload Failed", description: "Could not parse Form 16. Please enter details manually.", variant: "destructive" });
    } finally {
      setForm16Uploading(false);
    }
  };

  const currentValidation = useMemo(() => validateStep(currentStepId), [currentStepId, validateStep]);

  const nextStep = () => {
    const validation = validateStep(currentStepId);
    if (!validation.isValid) {
      toast({ title: "Please fix errors", description: validation.errors[0], variant: "destructive" });
      return;
    }
    if (safeCurrentStep < activeSteps.length - 1) {
      const newStepId = activeSteps[safeCurrentStep + 1]?.id || "basic";
      setVisitedSteps(prev => new Set([...prev, newStepId]));
      setCurrentStepId(newStepId);
      if (newStepId === "review") {
        taxCalcMutation.mutate();
      }
    }
  };

  const prevStep = () => {
    if (safeCurrentStep > 0) {
      setCurrentStepId(activeSteps[safeCurrentStep - 1]?.id || "basic");
    }
  };

  const goToStep = (stepId: string) => {
    const idx = activeSteps.findIndex(s => s.id === stepId);
    if (idx >= 0 && (idx <= safeCurrentStep || visitedSteps.has(stepId))) {
      setCurrentStepId(stepId);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: 'INR',
      maximumFractionDigits: 0 
    }).format(amount);
  };

  const formatLakhs = (amount: number) => {
    if (amount >= 10000000) return `${(amount / 10000000).toFixed(2)} Cr`;
    if (amount >= 100000) return `${(amount / 100000).toFixed(2)} L`;
    return formatCurrency(amount);
  };

  const renderBasicInfoStep = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            PAN <Lock className="h-3 w-3 text-muted-foreground" />
          </Label>
          <Input value={panContext?.pan || "Loading..."} disabled className="bg-muted font-mono tracking-wider" data-testid="input-pan" />
          <p className="text-xs text-muted-foreground">Auto-fetched from your profile. Cannot be changed here.</p>
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            Name <Lock className="h-3 w-3 text-muted-foreground" />
          </Label>
          <Input value={panContext?.name || "Loading..."} disabled className="bg-muted" data-testid="input-name" />
          <p className="text-xs text-muted-foreground">As per PAN records.</p>
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            Entity Type <Lock className="h-3 w-3 text-muted-foreground" />
          </Label>
          <Input value={panContext?.entityDescription || panContext?.panType?.toUpperCase() || "Individual"} disabled className="bg-muted" data-testid="input-entity-type" />
        </div>
        <div className="space-y-2">
          <Label>Assessment Year <FieldHint text="The year in which you file taxes for the previous financial year's income. For income earned in FY 2024-25, you file in AY 2025-26." /></Label>
          <Select value={assessmentYear} onValueChange={setAssessmentYear}>
            <SelectTrigger data-testid="select-assessment-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSESSMENT_YEARS.map(year => (
                <SelectItem key={year} value={year}>AY {year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Tax Regime <FieldHint text="New regime is default from FY 2023-24. Old regime allows more deductions (80C, 80D, HRA etc.). We'll compare both in the review." /></Label>
        <RadioGroup value={taxRegime} onValueChange={(v) => setTaxRegime(v as "old" | "new")} className="flex gap-6" data-testid="radio-tax-regime">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="new" id="regime-new" />
            <Label htmlFor="regime-new" className="cursor-pointer">
              <span className="font-medium">New Regime</span>
              <span className="text-xs text-muted-foreground ml-1">(Default, lower rates)</span>
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="old" id="regime-old" />
            <Label htmlFor="regime-old" className="cursor-pointer">
              <span className="font-medium">Old Regime</span>
              <span className="text-xs text-muted-foreground ml-1">(More deductions)</span>
            </Label>
          </div>
        </RadioGroup>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 flex items-center gap-3">
          <Shield className="h-5 w-5 text-primary flex-shrink-0" />
          <div>
            <p className="text-sm font-medium">Your data is encrypted and secure</p>
            <p className="text-xs text-muted-foreground">We follow SEBI/IT department guidelines. Tax computation via Sandbox.co.in API — no local calculations.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderIncomeSourcesStep = () => (
    <div className="space-y-6">
      <p className="text-muted-foreground">Select all sources of income for FY {assessmentYear === "2025-26" ? "2024-25" : assessmentYear === "2024-25" ? "2023-24" : "2022-23"}. The system will automatically select the correct ITR form.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[
          { key: "hasSalary", label: "Salary / Pension", icon: Briefcase, desc: "Income from employment, Form 16", color: "text-blue-600" },
          { key: "hasHouseProperty", label: "House Property", icon: Home, desc: "Rental income or home loan interest", color: "text-green-600" },
          { key: "hasCapitalGains", label: "Capital Gains", icon: TrendingUp, desc: "Stocks, MFs, property sale", color: "text-purple-600" },
          { key: "hasBusinessIncome", label: "Business / Profession", icon: Building2, desc: "Self-employed, freelancer, business", color: "text-orange-600" },
          { key: "hasForeignIncome", label: "Foreign Income / Global Stocks", icon: Globe, desc: "US/global stocks, DTAA relief, Schedule FA & FSI", color: "text-red-600" },
          { key: "hasOtherIncome", label: "Other Sources", icon: Wallet, desc: "FD/savings interest, dividends, lottery", color: "text-teal-600" }
        ].map(source => {
          const Icon = source.icon;
          const isChecked = incomeSources[source.key as keyof IncomeSource];
          return (
            <Card 
              key={source.key} 
              className={`cursor-pointer transition-all hover:shadow-sm ${isChecked ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'hover:border-muted-foreground/40'}`}
              onClick={() => setIncomeSources(prev => ({ ...prev, [source.key]: !prev[source.key as keyof IncomeSource] }))}
              data-testid={`card-source-${source.key}`}
            >
              <CardContent className="p-4 flex items-start gap-3">
                <Checkbox checked={isChecked} className="mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${source.color}`} />
                    <span className="font-medium text-sm">{source.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{source.desc}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                Auto-selected: {recommendedForm}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400">
                Based on your income sources. This is the correct form — no need to choose manually.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <ValidationBanner validation={currentValidation} />
    </div>
  );

  const renderSalaryStep = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">Enter details from your Form 16 Part B, or upload it for auto-fill.</p>
        <label htmlFor="form16-upload" className="cursor-pointer">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-md border text-sm font-medium transition-colors ${form16Uploading ? 'opacity-50 cursor-wait' : 'hover:bg-accent'}`}>
            <Upload className="h-4 w-4" />
            {form16Uploading ? "Parsing..." : "Upload Form 16"}
          </div>
          <input
            id="form16-upload"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            disabled={form16Uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleForm16Upload(file);
            }}
            data-testid="input-form16-upload"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <Label htmlFor="grossSalary">
            Gross Salary (Annual) <span className="text-red-500">*</span>
            <FieldHint text="Total salary before any deductions. Find in Part B of Form 16, row '1 - Gross Salary'." />
          </Label>
          <CurrencyInput
            id="grossSalary"
            value={salaryDetails.grossSalary}
            onChange={(v) => setSalaryDetails(prev => ({ ...prev, grossSalary: v }))}
            placeholder="e.g. 12,00,000"
            data-testid="input-gross-salary"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="allowances">
            Exempt Allowances (HRA, LTA)
            <FieldHint text="Exempt portions of HRA, LTA, and other allowances. Available in Form 16 Part B." />
          </Label>
          <CurrencyInput
            id="allowances"
            value={salaryDetails.allowances}
            onChange={(v) => setSalaryDetails(prev => ({ ...prev, allowances: v }))}
            placeholder="0 if none"
            data-testid="input-allowances"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="professionalTax">
            Professional Tax Paid
            <FieldHint text="Also called 'tax on employment'. Maximum ₹2,500/year in most states. Check your salary slip." />
          </Label>
          <CurrencyInput
            id="professionalTax"
            value={salaryDetails.professionalTax}
            onChange={(v) => setSalaryDetails(prev => ({ ...prev, professionalTax: v }))}
            placeholder="Usually ₹2,400 or ₹2,500"
            max={2500}
            data-testid="input-professional-tax"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="employerPF">
            Employer's PF Contribution
            <FieldHint text="Your employer's contribution to EPF. This is 12% of basic salary. Check salary slip or Form 16." />
          </Label>
          <CurrencyInput
            id="employerPF"
            value={salaryDetails.employerPF}
            onChange={(v) => setSalaryDetails(prev => ({ ...prev, employerPF: v }))}
            placeholder="12% of basic salary"
            data-testid="input-employer-pf"
          />
        </div>
      </div>

      <Card className="bg-muted/50">
        <CardContent className="p-4 space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Standard Deduction (Auto-applied for AY 2025-26)</span>
            <span className="font-medium">{formatCurrency(salaryDetails.standardDeduction)}</span>
          </div>
          <Separator />
          <div className="flex justify-between items-center">
            <span className="font-medium">Net Taxable Salary</span>
            <span className="font-bold text-lg">{formatCurrency(Math.max(0, totals.salaryIncome))}</span>
          </div>
        </CardContent>
      </Card>

      <ValidationBanner validation={currentValidation} />
    </div>
  );

  const renderHousePropertyStep = () => (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label>Property Type <FieldHint text="Self-occupied: You live in it. Let out: You receive rent. If you have both, let-out income is primary." /></Label>
        <RadioGroup 
          value={housePropertyDetails.isSelfOccupied ? "self" : "letout"} 
          onValueChange={(v) => setHousePropertyDetails(prev => ({ ...prev, isSelfOccupied: v === "self" }))}
          className="flex gap-4"
          data-testid="radio-property-type"
        >
          <label htmlFor="prop-self" className={`flex items-center gap-2 px-4 py-3 rounded-lg border cursor-pointer transition-all ${housePropertyDetails.isSelfOccupied ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/40'}`}>
            <RadioGroupItem value="self" id="prop-self" />
            <div>
              <span className="font-medium text-sm">Self Occupied</span>
              <p className="text-xs text-muted-foreground">You live in this property</p>
            </div>
          </label>
          <label htmlFor="prop-letout" className={`flex items-center gap-2 px-4 py-3 rounded-lg border cursor-pointer transition-all ${!housePropertyDetails.isSelfOccupied ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/40'}`}>
            <RadioGroupItem value="letout" id="prop-letout" />
            <div>
              <span className="font-medium text-sm">Let Out / Deemed</span>
              <p className="text-xs text-muted-foreground">Rented or vacant second property</p>
            </div>
          </label>
        </RadioGroup>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {!housePropertyDetails.isSelfOccupied && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="rentalIncome">
                Annual Rental Income <span className="text-red-500">*</span>
                <FieldHint text="Total rent received during the financial year. If property was vacant for some months, enter actual rent received." />
              </Label>
              <CurrencyInput
                id="rentalIncome"
                value={housePropertyDetails.rentalIncome}
                onChange={(v) => setHousePropertyDetails(prev => ({ ...prev, rentalIncome: v }))}
                placeholder="Total annual rent"
                data-testid="input-rental-income"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="municipalTaxes">
                Municipal Taxes Paid
                <FieldHint text="Property tax paid to local municipality. Only deductible if actually paid during the year." />
              </Label>
              <CurrencyInput
                id="municipalTaxes"
                value={housePropertyDetails.municipalTaxes}
                onChange={(v) => setHousePropertyDetails(prev => ({ ...prev, municipalTaxes: v }))}
                placeholder="Property tax paid"
                data-testid="input-municipal-taxes"
              />
            </div>
          </>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="interestOnLoan">
            Interest on Home Loan
            <FieldHint text={housePropertyDetails.isSelfOccupied 
              ? "Maximum ₹2,00,000 deduction for self-occupied property. Get from bank's interest certificate." 
              : "Full interest is deductible for let-out property. Get from bank's interest certificate."} />
          </Label>
          <CurrencyInput
            id="interestOnLoan"
            value={housePropertyDetails.interestOnLoan}
            onChange={(v) => setHousePropertyDetails(prev => ({ ...prev, interestOnLoan: v }))}
            placeholder="Annual home loan interest"
            max={housePropertyDetails.isSelfOccupied ? 200000 : undefined}
            data-testid="input-interest-loan"
          />
        </div>
      </div>

      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <span className="font-medium">Income / Loss from House Property</span>
            <span className={`font-bold text-lg ${totals.housePropertyIncome < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(totals.housePropertyIncome)}
            </span>
          </div>
          {housePropertyDetails.isSelfOccupied && totals.housePropertyIncome < 0 && (
            <p className="text-xs text-muted-foreground mt-1">This loss will reduce your total taxable income.</p>
          )}
        </CardContent>
      </Card>

      <ValidationBanner validation={currentValidation} />
    </div>
  );

  const renderCapitalGainsStep = () => (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">Enter your capital gains from equity, debt, or property. You can get these from your broker's tax P&L statement or CAMS/KFintech for mutual funds.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <Label htmlFor="shortTermGains">
            Short Term Capital Gains (STCG)
            <FieldHint text="Listed equity held < 12 months (taxed at 15% u/s 111A). Debt funds < 36 months. Property < 24 months." />
          </Label>
          <CurrencyInput
            id="shortTermGains"
            value={capitalGainsDetails.shortTermGains}
            onChange={(v) => setCapitalGainsDetails(prev => ({ ...prev, shortTermGains: v }))}
            placeholder="From equity, debt, property"
            data-testid="input-short-term-gains"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="longTermGains">
            Long Term Capital Gains (LTCG)
            <FieldHint text="Listed equity held > 12 months (₹1L exempt, then 10% u/s 112A). Property > 24 months (20% with indexation)." />
          </Label>
          <CurrencyInput
            id="longTermGains"
            value={capitalGainsDetails.longTermGains}
            onChange={(v) => setCapitalGainsDetails(prev => ({ ...prev, longTermGains: v }))}
            placeholder="From equity, property"
            data-testid="input-long-term-gains"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="exemptions">
            Exemptions Claimed (Sec 54/54EC/54F)
            <FieldHint text="Reinvestment exemptions. Sec 54: Reinvest property sale in new house. Sec 54EC: Invest in bonds within 6 months." />
          </Label>
          <CurrencyInput
            id="exemptions"
            value={capitalGainsDetails.exemptionsApplied}
            onChange={(v) => setCapitalGainsDetails(prev => ({ ...prev, exemptionsApplied: v }))}
            placeholder="0 if no exemptions claimed"
            max={capitalGainsDetails.shortTermGains + capitalGainsDetails.longTermGains || undefined}
            data-testid="input-exemptions"
          />
        </div>
      </div>

      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <span className="font-medium">Net Capital Gains</span>
            <span className="font-bold text-lg">{formatCurrency(totals.capitalGains)}</span>
          </div>
        </CardContent>
      </Card>

      <ValidationBanner validation={currentValidation} />
    </div>
  );

  const DTAA_COUNTRIES = [
    { code: "US", name: "United States", article: "Article 10/11/13" },
    { code: "UK", name: "United Kingdom", article: "Article 10/11/13" },
    { code: "SG", name: "Singapore", article: "Article 10/11/13" },
    { code: "AE", name: "UAE", article: "Article 11/13" },
    { code: "CA", name: "Canada", article: "Article 10/11/13" },
    { code: "AU", name: "Australia", article: "Article 10/11/13" },
    { code: "DE", name: "Germany", article: "Article 10/11/13" },
    { code: "JP", name: "Japan", article: "Article 10/11/13" },
    { code: "HK", name: "Hong Kong", article: "Article 10/11/13" },
    { code: "NL", name: "Netherlands", article: "Article 10/11/13" },
    { code: "FR", name: "France", article: "Article 10/11/13" },
    { code: "CH", name: "Switzerland", article: "Article 10/11/13" },
    { code: "OTHER", name: "Other Country", article: "See DTAA treaty" },
  ];

  const ASSET_TYPES = [
    { value: "equity", label: "Foreign Equity Shares (US stocks, ETFs)" },
    { value: "mutual_fund", label: "Foreign Mutual Funds / ETFs" },
    { value: "bank_account", label: "Foreign Bank Account" },
    { value: "custodial", label: "Foreign Custodial Account (Schwab, IBKR)" },
    { value: "bonds", label: "Foreign Bonds / Securities" },
    { value: "real_estate", label: "Foreign Immovable Property" },
    { value: "other", label: "Other Foreign Capital Asset" },
  ];

  const CURRENCY_CODES = [
    { code: "USD", symbol: "$", name: "US Dollar", defaultRate: 83.5 },
    { code: "GBP", symbol: "£", name: "British Pound", defaultRate: 105.5 },
    { code: "EUR", symbol: "€", name: "Euro", defaultRate: 90.5 },
    { code: "SGD", symbol: "S$", name: "Singapore Dollar", defaultRate: 62.0 },
    { code: "AED", symbol: "د.إ", name: "UAE Dirham", defaultRate: 22.7 },
    { code: "AUD", symbol: "A$", name: "Australian Dollar", defaultRate: 54.0 },
    { code: "CAD", symbol: "C$", name: "Canadian Dollar", defaultRate: 61.5 },
    { code: "JPY", symbol: "¥", name: "Japanese Yen", defaultRate: 0.56 },
    { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar", defaultRate: 10.7 },
    { code: "CHF", symbol: "Fr", name: "Swiss Franc", defaultRate: 94.0 },
  ];

  const addForeignAsset = () => {
    setForeignIncomeDetails(prev => ({
      ...prev,
      foreignAssets: [...prev.foreignAssets, {
        countryCode: prev.dtaaCountry || "US",
        countryName: DTAA_COUNTRIES.find(c => c.code === (prev.dtaaCountry || "US"))?.name || "United States",
        assetType: "equity",
        institutionName: "",
        accountNumber: "",
        peakBalance: 0,
        closingBalance: 0,
        acquisitionDate: "",
        totalGrossIncome: 0,
        taxableIncome: 0,
      }]
    }));
  };

  const updateForeignAsset = (idx: number, field: keyof ForeignAssetEntry, value: string | number) => {
    setForeignIncomeDetails(prev => ({
      ...prev,
      foreignAssets: prev.foreignAssets.map((a, i) => i === idx ? { ...a, [field]: value } : a)
    }));
  };

  const removeForeignAsset = (idx: number) => {
    setForeignIncomeDetails(prev => ({
      ...prev,
      foreignAssets: prev.foreignAssets.filter((_, i) => i !== idx)
    }));
  };

  const selectedCurrency = CURRENCY_CODES.find(c => c.code === foreignIncomeDetails.currencyCode) || CURRENCY_CODES[0];

  const foreignTotalInINR = (foreignIncomeDetails.foreignSTCG + foreignIncomeDetails.foreignLTCG +
    foreignIncomeDetails.foreignDividends + foreignIncomeDetails.foreignInterest + foreignIncomeDetails.foreignOtherIncome);

  const renderForeignIncomeStep = () => (
    <div className="space-y-6">
      <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <Globe className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-700 dark:text-blue-300">
          <strong>Global Stock Investments</strong> — Report all foreign income in INR (converted at RBI reference rate on the date of credit/sale).
          Schedule FA disclosure is mandatory under the Black Money Act, 2015. Non-disclosure attracts ₹10 lakh penalty.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Globe className="h-4 w-4" /> Currency & Country Setup
          </CardTitle>
          <CardDescription>Set your primary investment country and currency for auto-conversion.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>
                DTAA Country
                <FieldHint text="Select the country where you earned foreign income. India has DTAA treaties with 90+ countries to prevent double taxation." />
              </Label>
              <Select value={foreignIncomeDetails.dtaaCountry} onValueChange={(v) => {
                const country = DTAA_COUNTRIES.find(c => c.code === v);
                setForeignIncomeDetails(prev => ({
                  ...prev,
                  dtaaCountry: v,
                  dtaaArticle: country?.article || "",
                }));
              }}>
                <SelectTrigger data-testid="select-dtaa-country">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DTAA_COUNTRIES.map(c => (
                    <SelectItem key={c.code} value={c.code}>{c.name} ({c.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>
                Currency
                <FieldHint text="Currency in which your foreign transactions were made. All amounts will be converted to INR using the exchange rate below." />
              </Label>
              <Select value={foreignIncomeDetails.currencyCode} onValueChange={(v) => {
                const cur = CURRENCY_CODES.find(c => c.code === v);
                setForeignIncomeDetails(prev => ({
                  ...prev,
                  currencyCode: v,
                  exchangeRate: cur?.defaultRate || prev.exchangeRate,
                }));
              }}>
                <SelectTrigger data-testid="select-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_CODES.map(c => (
                    <SelectItem key={c.code} value={c.code}>{c.symbol} {c.name} ({c.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>
                Exchange Rate (1 {foreignIncomeDetails.currencyCode} = ₹)
                <FieldHint text="Use the SBI TT Buying Rate or RBI reference rate on the date of transaction. Check rbi.org.in for official rates. The pre-filled rate is approximate." />
              </Label>
              <Input
                type="number"
                step="0.01"
                value={foreignIncomeDetails.exchangeRate}
                onChange={(e) => setForeignIncomeDetails(prev => ({ ...prev, exchangeRate: parseFloat(e.target.value) || 0 }))}
                data-testid="input-exchange-rate"
              />
              <p className="text-xs text-muted-foreground">Pre-filled approximate rate. Verify from RBI/SBI for actual filing.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Foreign Capital Gains (Schedule CG)
          </CardTitle>
          <CardDescription>Enter capital gains from global stocks, ETFs, or other foreign assets. Enter amounts already converted to INR.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <Label htmlFor="foreignSTCG">
                Foreign STCG (in ₹)
                <FieldHint text="Short-term capital gains from foreign stocks/ETFs held < 24 months. Unlike Indian equities (12 months), foreign shares use 24-month holding period. Taxed at slab rates (not 15% flat like Indian STT-paid equity)." />
              </Label>
              <CurrencyInput
                id="foreignSTCG"
                value={foreignIncomeDetails.foreignSTCG}
                onChange={(v) => setForeignIncomeDetails(prev => ({ ...prev, foreignSTCG: v }))}
                placeholder="e.g., gains from selling US stocks < 24 months"
                data-testid="input-foreign-stcg"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="foreignLTCG">
                Foreign LTCG (in ₹)
                <FieldHint text="Long-term capital gains from foreign stocks/ETFs held > 24 months. Taxed at 20% with indexation benefit (u/s 112). No ₹1L exemption available (that's only for Indian listed equity u/s 112A)." />
              </Label>
              <CurrencyInput
                id="foreignLTCG"
                value={foreignIncomeDetails.foreignLTCG}
                onChange={(v) => setForeignIncomeDetails(prev => ({ ...prev, foreignLTCG: v }))}
                placeholder="e.g., gains from selling US stocks > 24 months"
                data-testid="input-foreign-ltcg"
              />
            </div>
          </div>
          <div className="mt-3 p-3 rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
            <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 flex-shrink-0" />
              Foreign equity holding period for LTCG is 24 months (not 12 months like Indian listed equity). Also, STT-based concessional rates (15%/10%) do NOT apply to foreign stocks.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Receipt className="h-4 w-4" /> Foreign Income — Other Heads (Schedule FSI)
          </CardTitle>
          <CardDescription>Report dividends, interest, and other income earned from foreign sources. Enter amounts in INR.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-1.5">
              <Label htmlFor="foreignDividends">
                Foreign Dividends (in ₹)
                <FieldHint text="Dividends from US stocks are taxed at 25% (DTAA rate) by the US and added to your Indian income at slab rates. Claim FTC below to avoid double taxation." />
              </Label>
              <CurrencyInput
                id="foreignDividends"
                value={foreignIncomeDetails.foreignDividends}
                onChange={(v) => setForeignIncomeDetails(prev => ({ ...prev, foreignDividends: v }))}
                placeholder="Dividends from foreign stocks/funds"
                data-testid="input-foreign-dividends"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="foreignInterest">
                Foreign Interest (in ₹)
                <FieldHint text="Interest earned on foreign bank accounts, bonds, or deposits. Fully taxable at slab rates in India." />
              </Label>
              <CurrencyInput
                id="foreignInterest"
                value={foreignIncomeDetails.foreignInterest}
                onChange={(v) => setForeignIncomeDetails(prev => ({ ...prev, foreignInterest: v }))}
                placeholder="Interest from foreign bank/bonds"
                data-testid="input-foreign-interest"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="foreignOtherIncome">
                Other Foreign Income (in ₹)
                <FieldHint text="Any other income from foreign sources — rental income from overseas property, freelance income earned abroad, etc." />
              </Label>
              <CurrencyInput
                id="foreignOtherIncome"
                value={foreignIncomeDetails.foreignOtherIncome}
                onChange={(v) => setForeignIncomeDetails(prev => ({ ...prev, foreignOtherIncome: v }))}
                placeholder="Other foreign-sourced income"
                data-testid="input-foreign-other-income"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-green-200 dark:border-green-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Scale className="h-4 w-4 text-green-600" /> Foreign Tax Credit — DTAA Relief (Schedule TR)
          </CardTitle>
          <CardDescription>Claim credit for taxes already paid in the foreign country to avoid double taxation. You must file Form 67 before filing ITR.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <Label htmlFor="foreignTaxPaid">
                Tax Paid in Foreign Country (in ₹)
                <FieldHint text="Total tax withheld or paid in the foreign country on your income. For US stocks: 25% on dividends, 0% on capital gains (US doesn't tax non-residents on capital gains). Get this from your broker's 1042-S form or tax statement." />
              </Label>
              <CurrencyInput
                id="foreignTaxPaid"
                value={foreignIncomeDetails.foreignTaxPaid}
                onChange={(v) => setForeignIncomeDetails(prev => ({ ...prev, foreignTaxPaid: v }))}
                placeholder="Tax withheld by foreign government"
                data-testid="input-foreign-tax-paid"
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                DTAA Article
                <FieldHint text="The specific DTAA article under which you're claiming relief. Common: Article 10 (Dividends), Article 11 (Interest), Article 13 (Capital Gains). Auto-filled based on country selection." />
              </Label>
              <Input
                value={foreignIncomeDetails.dtaaArticle || DTAA_COUNTRIES.find(c => c.code === foreignIncomeDetails.dtaaCountry)?.article || ""}
                onChange={(e) => setForeignIncomeDetails(prev => ({ ...prev, dtaaArticle: e.target.value }))}
                placeholder="e.g., Article 10/11/13"
                data-testid="input-dtaa-article"
              />
            </div>
          </div>
          {foreignIncomeDetails.foreignTaxPaid > 0 && (
            <Alert className="mt-3 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700 dark:text-green-300 text-sm">
                FTC of {formatCurrency(foreignIncomeDetails.foreignTaxPaid)} will be claimed under Section 90/91. 
                Remember to file <strong>Form 67</strong> before your ITR filing date — FTC is not allowed without it.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card className="border-red-200 dark:border-red-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4 text-red-600" /> Schedule FA — Foreign Asset Disclosure
            <Badge variant="outline" className="text-[10px] text-red-600 border-red-300">Mandatory</Badge>
          </CardTitle>
          <CardDescription>
            Mandatory for Resident & Ordinarily Resident (ROR) Indians. Disclose ALL foreign assets — even zero-balance accounts, 
            dormant accounts, or assets held for even 1 day during the calendar year (Jan 1 – Dec 31).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {foreignIncomeDetails.foreignAssets.map((asset, idx) => (
            <Card key={idx} className="border-dashed">
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <Badge variant="secondary" className="text-xs">Asset {idx + 1}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => removeForeignAsset(idx)} className="text-red-500 hover:text-red-700 h-7 px-2">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Country</Label>
                    <Select value={asset.countryCode} onValueChange={(v) => {
                      updateForeignAsset(idx, "countryCode", v);
                      updateForeignAsset(idx, "countryName", DTAA_COUNTRIES.find(c => c.code === v)?.name || v);
                    }}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DTAA_COUNTRIES.map(c => (
                          <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Asset Type
                      <FieldHint text="Table A3: Equity/Debt in foreign entity. Table A1: Foreign bank account. Table A2: Custodial account. Table C: Immovable property." />
                    </Label>
                    <Select value={asset.assetType} onValueChange={(v) => updateForeignAsset(idx, "assetType", v)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASSET_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Institution / Broker Name</Label>
                    <Input
                      className="h-8 text-xs"
                      value={asset.institutionName}
                      onChange={(e) => updateForeignAsset(idx, "institutionName", e.target.value)}
                      placeholder="e.g., Charles Schwab, Vested, INDmoney"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Account / Folio No.</Label>
                    <Input
                      className="h-8 text-xs"
                      value={asset.accountNumber}
                      onChange={(e) => updateForeignAsset(idx, "accountNumber", e.target.value)}
                      placeholder="Account number"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Peak Balance (₹)
                      <FieldHint text="Maximum balance/value of this asset at any point during the calendar year (Jan 1 – Dec 31). Convert using SBI TTBR rate on that peak date." />
                    </Label>
                    <CurrencyInput
                      id={`peak-${idx}`}
                      value={asset.peakBalance}
                      onChange={(v) => updateForeignAsset(idx, "peakBalance", v)}
                      placeholder="Max value during year"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Closing Balance (₹)
                      <FieldHint text="Value of this asset as of December 31 of the relevant calendar year. Convert at SBI TTBR rate on Dec 31." />
                    </Label>
                    <CurrencyInput
                      id={`closing-${idx}`}
                      value={asset.closingBalance}
                      onChange={(v) => updateForeignAsset(idx, "closingBalance", v)}
                      placeholder="Value on Dec 31"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Date Acquired</Label>
                    <Input
                      type="date"
                      className="h-8 text-xs"
                      value={asset.acquisitionDate}
                      onChange={(e) => updateForeignAsset(idx, "acquisitionDate", e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          <Button variant="outline" size="sm" onClick={addForeignAsset} className="w-full border-dashed" data-testid="button-add-foreign-asset">
            <Plus className="h-4 w-4 mr-2" /> Add Foreign Asset Entry
          </Button>

          {foreignIncomeDetails.foreignAssets.length === 0 && (
            <Alert className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-700 dark:text-red-300 text-sm">
                Schedule FA is mandatory for residents holding foreign assets. The Income Tax Department receives data from 100+ countries via CRS (Common Reporting Standard). 
                Non-disclosure can lead to ₹10 lakh penalty and prosecution under the Black Money Act.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card className="bg-muted/50">
        <CardContent className="p-4 space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-medium">Total Foreign Capital Gains</span>
            <span className="font-bold text-lg">{formatCurrency(foreignIncomeDetails.foreignSTCG + foreignIncomeDetails.foreignLTCG)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Total Foreign Other Income</span>
            <span className="font-medium">{formatCurrency(foreignIncomeDetails.foreignDividends + foreignIncomeDetails.foreignInterest + foreignIncomeDetails.foreignOtherIncome)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Total Foreign Income</span>
            <span className="font-medium">{formatCurrency(foreignTotalInINR)}</span>
          </div>
          {foreignIncomeDetails.foreignTaxPaid > 0 && (
            <div className="flex justify-between items-center text-sm text-green-600">
              <span>Less: Foreign Tax Credit (DTAA)</span>
              <span>- {formatCurrency(foreignIncomeDetails.foreignTaxPaid)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between items-center font-semibold">
            <span>Net Foreign Income (after FTC)</span>
            <span>{formatCurrency(foreignTotalInINR - foreignIncomeDetails.foreignTaxPaid)}</span>
          </div>
        </CardContent>
      </Card>

      <ValidationBanner validation={currentValidation} />
    </div>
  );

  const renderOtherIncomeStep = () => (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">Interest, dividends, and other sources. TDS on these is usually reflected in your Form 26AS.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <Label htmlFor="interestIncome">
            Interest from Savings / FD / RD
            <FieldHint text="Total interest earned from savings accounts, fixed deposits, recurring deposits. Check bank statements or Form 26AS for TDS." />
          </Label>
          <CurrencyInput
            id="interestIncome"
            value={otherIncomeDetails.interestIncome}
            onChange={(v) => setOtherIncomeDetails(prev => ({ ...prev, interestIncome: v }))}
            placeholder="All bank interest combined"
            data-testid="input-interest-income"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dividendIncome">
            Dividend Income
            <FieldHint text="Dividends from shares and mutual funds. Taxable in your hands since FY 2020-21. Check broker statement." />
          </Label>
          <CurrencyInput
            id="dividendIncome"
            value={otherIncomeDetails.dividendIncome}
            onChange={(v) => setOtherIncomeDetails(prev => ({ ...prev, dividendIncome: v }))}
            placeholder="From stocks, mutual funds"
            data-testid="input-dividend-income"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="otherSources">
            Other Sources
            <FieldHint text="Any income not covered above — gifts above ₹50,000, lottery winnings, agricultural income > ₹5,000, etc." />
          </Label>
          <CurrencyInput
            id="otherSources"
            value={otherIncomeDetails.otherSources}
            onChange={(v) => setOtherIncomeDetails(prev => ({ ...prev, otherSources: v }))}
            placeholder="0 if none"
            data-testid="input-other-sources"
          />
        </div>
      </div>

      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <span className="font-medium">Total Other Income</span>
            <span className="font-bold text-lg">{formatCurrency(totals.otherIncome)}</span>
          </div>
        </CardContent>
      </Card>

      <ValidationBanner validation={currentValidation} />
    </div>
  );

  const renderDeductionsStep = () => {
    const isNewRegime = taxRegime === "new";
    return (
      <div className="space-y-6">
        {isNewRegime && (
          <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>New Tax Regime selected.</strong> Most Chapter VI-A deductions (80C, 80D, 80G, etc.) are <strong>not available</strong>. Only standard deduction of ₹75,000 applies. 
              Switch to Old Regime in Basic Info to claim these deductions.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <Label htmlFor="section80C" className={isNewRegime ? "text-muted-foreground" : ""}>
              Section 80C (Max ₹1.5 Lakh)
              <FieldHint text="PPF, ELSS, life insurance, PF, tuition fees, home loan principal, NSC, tax-saving FD. Combined limit ₹1,50,000." />
            </Label>
            <CurrencyInput
              id="section80C"
              value={deductionDetails.section80C}
              onChange={(v) => setDeductionDetails(prev => ({ ...prev, section80C: v }))}
              placeholder="PPF, ELSS, LIC, PF, etc."
              max={150000}
              disabled={isNewRegime}
              data-testid="input-section-80c"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="section80D" className={isNewRegime ? "text-muted-foreground" : ""}>
              Section 80D - Health Insurance (Max ₹1L)
              <FieldHint text="Self + family: ₹25K (₹50K if senior). Parents: additional ₹25K (₹50K if senior). Max total: ₹1,00,000." />
            </Label>
            <CurrencyInput
              id="section80D"
              value={deductionDetails.section80D}
              onChange={(v) => setDeductionDetails(prev => ({ ...prev, section80D: v }))}
              placeholder="Self + family + parents"
              max={100000}
              disabled={isNewRegime}
              data-testid="input-section-80d"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="section80E" className={isNewRegime ? "text-muted-foreground" : ""}>
              Section 80E - Education Loan Interest
              <FieldHint text="Interest on education loan for higher studies. No upper limit. Available for 8 years from start of repayment." />
            </Label>
            <CurrencyInput
              id="section80E"
              value={deductionDetails.section80E}
              onChange={(v) => setDeductionDetails(prev => ({ ...prev, section80E: v }))}
              placeholder="No upper limit"
              disabled={isNewRegime}
              data-testid="input-section-80e"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="section80G" className={isNewRegime ? "text-muted-foreground" : ""}>
              Section 80G - Charitable Donations
              <FieldHint text="Donations to specified funds/charities. 100% or 50% deduction depending on the organization. Keep donation receipts." />
            </Label>
            <CurrencyInput
              id="section80G"
              value={deductionDetails.section80G}
              onChange={(v) => setDeductionDetails(prev => ({ ...prev, section80G: v }))}
              placeholder="Charitable donations"
              disabled={isNewRegime}
              data-testid="input-section-80g"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="section80TTA" className={isNewRegime ? "text-muted-foreground" : ""}>
              Section 80TTA - Savings Interest (Max ₹10K)
              <FieldHint text="Deduction on interest from savings account. Max ₹10,000. FD/RD interest NOT eligible. Senior citizens use 80TTB instead." />
            </Label>
            <CurrencyInput
              id="section80TTA"
              value={deductionDetails.section80TTA}
              onChange={(v) => setDeductionDetails(prev => ({ ...prev, section80TTA: v }))}
              placeholder="Savings account interest"
              max={10000}
              disabled={isNewRegime}
              data-testid="input-section-80tta"
            />
          </div>
        </div>

        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <span className="font-medium">Total Deductions</span>
              <span className="font-bold text-lg text-green-600">
                {isNewRegime ? formatCurrency(0) + " (New Regime)" : formatCurrency(totals.totalDeductions)}
              </span>
            </div>
          </CardContent>
        </Card>

        <ValidationBanner validation={currentValidation} />
      </div>
    );
  };

  const renderTaxPaymentsStep = () => (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Enter taxes already paid or deducted. These reduce your final tax liability. Verify from your Form 26AS on the Income Tax e-filing portal.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <Label htmlFor="tdsDeducted">
            TDS Deducted <FieldHint text="Total Tax Deducted at Source — by employer (salary), bank (FD interest), etc. Check Form 26AS Part A." />
          </Label>
          <CurrencyInput
            id="tdsDeducted"
            value={taxPaymentDetails.tdsDeducted}
            onChange={(v) => setTaxPaymentDetails(prev => ({ ...prev, tdsDeducted: v }))}
            placeholder="From Form 26AS / AIS"
            data-testid="input-tds-deducted"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="advanceTaxPaid">
            Advance Tax Paid <FieldHint text="Quarterly advance tax paid via challans (15 Jun, 15 Sep, 15 Dec, 15 Mar). Check Form 26AS Part C." />
          </Label>
          <CurrencyInput
            id="advanceTaxPaid"
            value={taxPaymentDetails.advanceTaxPaid}
            onChange={(v) => setTaxPaymentDetails(prev => ({ ...prev, advanceTaxPaid: v }))}
            placeholder="Advance tax challans"
            data-testid="input-advance-tax"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="selfAssessmentTax">
            Self Assessment Tax Paid <FieldHint text="Tax paid after computing total liability, typically before filing ITR. Challan 280, code 300." />
          </Label>
          <CurrencyInput
            id="selfAssessmentTax"
            value={taxPaymentDetails.selfAssessmentTax}
            onChange={(v) => setTaxPaymentDetails(prev => ({ ...prev, selfAssessmentTax: v }))}
            placeholder="Paid before filing"
            data-testid="input-self-assessment-tax"
          />
        </div>
      </div>

      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <span className="font-medium">Total Tax Already Paid</span>
            <span className="font-bold text-lg text-green-600">{formatCurrency(totals.totalTaxPaid)}</span>
          </div>
        </CardContent>
      </Card>

      <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <HelpCircle className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <strong>Where to find these?</strong> Log in to <span className="font-mono text-xs">incometax.gov.in</span> → My Account → View Form 26AS or Annual Information Statement (AIS).
        </AlertDescription>
      </Alert>

      <ValidationBanner validation={currentValidation} />
    </div>
  );

  const renderReviewStep = () => {
    const apiData = sandboxTaxResult?.data;
    const isCalculating = taxCalcMutation.isPending;
    const regimeComparison = apiData?.regimeComparison;

    const allStepValidations = activeSteps
      .filter(s => s.id !== "review")
      .map(s => ({ step: s, validation: validateStep(s.id) }))
      .filter(sv => !sv.validation.isValid);

    return (
      <div className="space-y-6">
        {allStepValidations.length > 0 && (
          <Alert className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
            <XCircle className="h-4 w-4 text-red-600" />
            <AlertDescription>
              <p className="font-medium text-red-700 dark:text-red-300 mb-2">Please fix the following before filing:</p>
              <ul className="space-y-1">
                {allStepValidations.map(sv => (
                  <li key={sv.step.id} className="text-sm">
                    <button 
                      className="text-red-600 underline hover:no-underline font-medium"
                      onClick={() => goToStep(sv.step.id)}
                    >
                      {sv.step.title}
                    </button>
                    : {sv.validation.errors[0]}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {taxCalcError && (
          <Alert className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Tax Calculation Error:</strong> {taxCalcError}
              <Button variant="link" className="ml-2 p-0 h-auto" onClick={() => taxCalcMutation.mutate()} disabled={isCalculating}>
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="dark:border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="h-4 w-4" /> Income Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {incomeSources.hasSalary && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Salary Income</span>
                  <span className="font-medium">{formatCurrency(Math.max(0, totals.salaryIncome))}</span>
                </div>
              )}
              {incomeSources.hasHouseProperty && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">House Property</span>
                  <span className={`font-medium ${totals.housePropertyIncome < 0 ? 'text-red-600' : ''}`}>
                    {formatCurrency(totals.housePropertyIncome)}
                  </span>
                </div>
              )}
              {incomeSources.hasCapitalGains && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Capital Gains</span>
                  <span className="font-medium">{formatCurrency(totals.capitalGains)}</span>
                </div>
              )}
              {incomeSources.hasForeignIncome && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1"><Globe className="h-3 w-3" /> Foreign Capital Gains</span>
                    <span className="font-medium">{formatCurrency(totals.foreignCapitalGains)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1"><Globe className="h-3 w-3" /> Foreign Other Income</span>
                    <span className="font-medium">{formatCurrency(totals.foreignOtherIncome)}</span>
                  </div>
                  {totals.foreignTaxCredit > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Less: Foreign Tax Credit (DTAA)</span>
                      <span>- {formatCurrency(totals.foreignTaxCredit)}</span>
                    </div>
                  )}
                </>
              )}
              {incomeSources.hasOtherIncome && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Other Income</span>
                  <span className="font-medium">{formatCurrency(totals.otherIncome)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Gross Total Income</span>
                <span>{formatCurrency(apiData?.totalIncome ?? totals.grossTotalIncome)}</span>
              </div>
              {(apiData?.totalDeductions ?? totals.totalDeductions) > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Less: Deductions</span>
                  <span>- {formatCurrency(apiData?.totalDeductions ?? totals.totalDeductions)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {incomeSources.hasForeignIncome && foreignIncomeDetails.foreignAssets.length > 0 && (
            <Card className="dark:border-border border-red-200 dark:border-red-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="h-4 w-4 text-red-600" />
                  Schedule FA — Foreign Assets ({foreignIncomeDetails.foreignAssets.length})
                  <Badge variant="outline" className="text-[10px] text-red-600 border-red-300">Mandatory</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                {foreignIncomeDetails.foreignAssets.map((a, i) => (
                  <div key={i} className="flex justify-between items-center py-1 border-b last:border-0">
                    <div>
                      <span className="font-medium">{a.institutionName || `Asset ${i+1}`}</span>
                      <span className="text-muted-foreground ml-2">({a.countryCode} · {a.assetType})</span>
                    </div>
                    <span className="font-medium">{formatCurrency(a.closingBalance)}</span>
                  </div>
                ))}
                <div className="pt-1 text-muted-foreground italic">
                  Form 67 must be filed before ITR submission to claim Foreign Tax Credit of {formatCurrency(foreignIncomeDetails.foreignTaxPaid)}.
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="dark:border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Tax Computation
                <Badge variant="outline" className="text-[10px] font-normal">Sandbox.co.in API</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {isCalculating ? (
                <div className="text-center py-8">
                  <Clock className="h-6 w-6 animate-spin mx-auto text-primary" />
                  <p className="mt-2 text-muted-foreground">Computing via Sandbox.co.in...</p>
                </div>
              ) : apiData ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Taxable Income</span>
                    <span className="font-medium">{formatCurrency(apiData.taxableIncome)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax on Income</span>
                    <span className="font-medium">{formatCurrency(apiData.taxLiability)}</span>
                  </div>
                  {totals.totalTaxPaid > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Less: Tax Already Paid</span>
                      <span>- {formatCurrency(totals.totalTaxPaid)}</span>
                    </div>
                  )}
                  <Separator />
                  {apiData.refundAmount > 0 ? (
                    <div className="flex justify-between text-lg">
                      <span className="font-bold text-green-700">Refund Due</span>
                      <span className="font-bold text-green-700">{formatCurrency(apiData.refundAmount)}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between text-lg">
                      <span className="font-bold">Net Tax Payable</span>
                      <span className="font-bold text-primary">{formatCurrency(apiData.taxPayable)}</span>
                    </div>
                  )}
                  {apiData.effectiveTaxRate > 0 && (
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Effective Tax Rate</span>
                      <span>{apiData.effectiveTaxRate.toFixed(2)}%</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-6">
                  <Calculator className="h-6 w-6 mx-auto text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">Tax not yet computed</p>
                  <Button className="mt-3" size="sm" onClick={() => taxCalcMutation.mutate()} data-testid="button-calculate-tax">
                    <Calculator className="h-4 w-4 mr-2" /> Calculate Now
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {regimeComparison && (
          <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Scale className="h-4 w-4" /> Regime Comparison
              </CardTitle>
              <CardDescription>We computed your tax under both regimes to help you choose the better one.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className={`p-4 rounded-lg border ${regimeComparison.recommended === "old" ? "border-green-400 bg-green-50 dark:bg-green-950" : "bg-muted/30"}`}>
                  <p className="text-sm font-medium mb-1">Old Regime</p>
                  <p className="text-xl font-bold">{formatCurrency(regimeComparison.oldRegime.taxPayable)}</p>
                  <p className="text-xs text-muted-foreground">Rate: {regimeComparison.oldRegime.effectiveRate.toFixed(1)}%</p>
                  {regimeComparison.recommended === "old" && (
                    <Badge className="mt-2 bg-green-100 text-green-700">Recommended - Save {formatLakhs(regimeComparison.savings)}</Badge>
                  )}
                </div>
                <div className={`p-4 rounded-lg border ${regimeComparison.recommended === "new" ? "border-green-400 bg-green-50 dark:bg-green-950" : "bg-muted/30"}`}>
                  <p className="text-sm font-medium mb-1">New Regime</p>
                  <p className="text-xl font-bold">{formatCurrency(regimeComparison.newRegime.taxPayable)}</p>
                  <p className="text-xs text-muted-foreground">Rate: {regimeComparison.newRegime.effectiveRate.toFixed(1)}%</p>
                  {regimeComparison.recommended === "new" && (
                    <Badge className="mt-2 bg-green-100 text-green-700">Recommended - Save {formatLakhs(regimeComparison.savings)}</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-primary bg-primary/5 dark:border-primary/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-6 w-6 text-primary" />
                <div>
                  <p className="font-semibold">Form: {recommendedForm}</p>
                  <p className="text-sm text-muted-foreground">AY {assessmentYear} | {taxRegime === "new" ? "New" : "Old"} Regime</p>
                </div>
              </div>
              {allStepValidations.length === 0 && apiData ? (
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                  <CheckCircle className="h-3 w-3 mr-1" /> Ready to File
                </Badge>
              ) : (
                <Badge variant="outline" className="text-amber-600 border-amber-300">
                  <AlertTriangle className="h-3 w-3 mr-1" /> {!apiData ? "Calculate tax first" : "Fix errors"}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Review all details carefully. After proceeding to preview, your return will be prepared for e-filing via Sandbox.co.in API. Any changes after submission may require revised return filing.
          </AlertDescription>
        </Alert>
      </div>
    );
  };

  const renderCurrentStep = () => {
    const currentStepExists = activeSteps.some(s => s.id === currentStepId);
    if (!currentStepExists) {
      return (
        <div className="text-center py-8">
          <Clock className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-muted-foreground">Loading step...</p>
        </div>
      );
    }
    switch (currentStepId) {
      case "basic": return renderBasicInfoStep();
      case "sources": return renderIncomeSourcesStep();
      case "salary": return renderSalaryStep();
      case "property": return renderHousePropertyStep();
      case "capital": return renderCapitalGainsStep();
      case "foreign": return renderForeignIncomeStep();
      case "other": return renderOtherIncomeStep();
      case "deductions": return renderDeductionsStep();
      case "tax_payments": return renderTaxPaymentsStep();
      case "review": return renderReviewStep();
      default: return null;
    }
  };

  if (panLoading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Clock className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-muted-foreground">Loading your details...</p>
        </div>
      </div>
    );
  }

  const currentStepConfig = activeSteps[safeCurrentStep];

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 max-w-5xl" data-testid="page-itr-self">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/tax/itr")} data-testid="button-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl font-bold">Self-File Income Tax Return</h1>
          <p className="text-sm text-muted-foreground">AY {assessmentYear} | {recommendedForm} | {taxRegime === "new" ? "New" : "Old"} Regime</p>
        </div>
        <Badge variant="outline" className="hidden sm:flex">
          Step {safeCurrentStep + 1}/{activeSteps.length}
        </Badge>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
        {activeSteps.map((step, idx) => {
          const Icon = step.icon;
          const isActive = idx === safeCurrentStep;
          const isCompleted = idx < safeCurrentStep;
          const isAccessible = isCompleted || visitedSteps.has(step.id);
          const stepValidation = isCompleted ? validateStep(step.id) : null;
          const hasErrors = stepValidation && !stepValidation.isValid;
          return (
            <div key={step.id} className="flex items-center">
              <button
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap
                  ${isActive ? 'bg-primary text-primary-foreground shadow-sm' : ''}
                  ${isCompleted && !hasErrors ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' : ''}
                  ${hasErrors ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300' : ''}
                  ${!isActive && !isCompleted ? 'text-muted-foreground hover:bg-accent' : ''}
                  ${!isAccessible ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
                onClick={() => isAccessible && goToStep(step.id)}
                disabled={!isAccessible}
                data-testid={`button-step-${step.id}`}
              >
                {isCompleted && !hasErrors ? <CheckCircle className="h-3.5 w-3.5" /> : hasErrors ? <XCircle className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{step.title}</span>
              </button>
              {idx < activeSteps.length - 1 && (
                <div className={`w-4 h-px mx-0.5 ${isCompleted ? 'bg-green-400' : 'bg-border'}`} />
              )}
            </div>
          );
        })}
      </div>

      <Progress value={progress} className="h-1.5" />

      <Card className="dark:border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                {(() => { const Icon = currentStepConfig?.icon || FileText; return <Icon className="h-5 w-5" />; })()}
                {currentStepConfig?.title}
              </CardTitle>
              <CardDescription className="dark:text-muted-foreground mt-0.5">
                {currentStepConfig?.description}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {renderCurrentStep()}
        </CardContent>
        <CardFooter className="flex justify-between border-t pt-4">
          <Button variant="outline" onClick={prevStep} disabled={safeCurrentStep === 0} data-testid="button-prev">
            <ArrowLeft className="h-4 w-4 mr-2" /> Previous
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleSaveDraft} disabled={saveDraftMutation.isPending} data-testid="button-save-draft">
              <Save className="h-4 w-4 mr-1" /> Save
            </Button>
            {currentStepId === "review" ? (
              <Button 
                onClick={handleProceedToPreview} 
                disabled={!sandboxTaxResult?.data}
                data-testid="button-proceed-preview"
              >
                <Send className="h-4 w-4 mr-2" /> Proceed to File
              </Button>
            ) : (
              <Button onClick={nextStep} data-testid="button-next">
                Next <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
