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

interface BrokerUploadInfo {
  id: number;
  brokerName: string;
  brokerId: string;
  fileName: string;
  parseConfidence: number;
  summary: { netSTCG: number; netLTCG: number; totalTransactions: number };
  status: string;
  uploadedAt: string;
}

interface ManualCGEntry {
  assetName: string;
  isin: string;
  buyDate: string;
  sellDate: string;
  quantity: number;
  buyPrice: number;
  sellPrice: number;
  expenses: number;
  sttPaid: number;
  fairMarketValue: number;
  exemptionSection: string;
  exemptionAmount: number;
}

const MANUAL_ASSET_TYPES = [
  { value: 'shares', label: 'Shares / Debentures', icon: '📈', holdingPeriod: '12 months for listed equity', hint: 'Equity shares, preference shares, debentures traded on recognized exchange' },
  { value: 'mutual_funds', label: 'Mutual Funds', icon: '💰', holdingPeriod: '12 months for equity MF, 24-36 months for debt MF', hint: 'Redemption of mutual fund units including SIP investments' },
  { value: 'esop_rsu', label: 'Stock Options / RSUs', icon: '🏢', holdingPeriod: '12 months from exercise date', hint: 'Employee Stock Options, Restricted Stock Units from employer' },
  { value: 'property', label: 'Land or Building (Property)', icon: '🏠', holdingPeriod: '24 months', hint: 'Sale of residential/commercial property, plots, agricultural land (non-exempt)' },
  { value: 'bonds', label: 'Bonds / NCDs', icon: '📄', holdingPeriod: '12-36 months depending on type', hint: 'Corporate bonds, government securities, NCDs' },
  { value: 'gold', label: 'Gold / Silver / Jewellery', icon: '✨', holdingPeriod: '24 months', hint: 'Physical gold, sovereign gold bonds, gold ETFs' },
  { value: 'vda', label: 'Virtual Digital Assets (Crypto)', icon: '₿', holdingPeriod: 'Flat 30% tax, no threshold', hint: 'Cryptocurrency, NFTs. Taxed at flat 30% under Section 115BBH' },
  { value: 'other_assets', label: 'Any Other Capital Assets', icon: '📦', holdingPeriod: '36 months for unlisted', hint: 'Unlisted shares, collectibles, paintings, archaeological items' },
  { value: 'deemed_cg', label: 'Deemed Capital Gains', icon: '⚖️', holdingPeriod: 'As per section', hint: 'Capital gains under Sec 45(2), 45(3), 45(4), 50C, 50CA, 56(2)(x)' },
] as const;

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

interface BusinessDetails {
  businessIncome: number;
  grossTurnover: number;
  grossReceipts: number;
  presumptiveIncome44AD: number;
  presumptiveIncome44ADA: number;
  vehicleCount: number;
  presumptiveIncome44AE: number;
  isPresumptive: boolean;
  businessType: string;
  businessDescription: string;
}

interface OtherIncomeDetails {
  interestIncome: number;
  dividendIncome: number;
  otherSources: number;
}

interface RegimeComparison {
  oldRegime: { taxableIncome: number; taxLiability: number; taxPayable: number; effectiveTaxRate: number; totalDeductions: number };
  newRegime: { taxableIncome: number; taxLiability: number; taxPayable: number; effectiveTaxRate: number; totalDeductions: number };
  recommended: string;
  savings: number;
  recommendation: string;
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
  { id: "business", title: "Business / Profession", icon: Building2, description: "Business income, P&L, presumptive" },
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

  const [cgMode, setCgMode] = useState<'upload' | 'manual' | 'summary'>('upload');
  const [cgBrokerSearch, setCgBrokerSearch] = useState('');
  const [cgSelectedBroker, setCgSelectedBroker] = useState<string | null>(null);
  const [cgUploading, setCgUploading] = useState(false);
  const [cgUploads, setCgUploads] = useState<BrokerUploadInfo[]>([]);
  const [cgManualAssetType, setCgManualAssetType] = useState<string>('shares');
  const [cgManualEntries, setCgManualEntries] = useState<ManualCGEntry[]>([]);
  const [cgManualSaved, setCgManualSaved] = useState<Array<{ id: number; assetType: string; summary: { totalSTCG: number; totalLTCG: number; totalExemptions: number; netGains: number }; entryCount: number }>>([]);

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

  const [businessDetails, setBusinessDetails] = useState<BusinessDetails>({
    businessIncome: 0,
    grossTurnover: 0,
    grossReceipts: 0,
    presumptiveIncome44AD: 0,
    presumptiveIncome44ADA: 0,
    vehicleCount: 0,
    presumptiveIncome44AE: 0,
    isPresumptive: true,
    businessType: "business",
    businessDescription: "",
  });

  const [regimeComparison, setRegimeComparison] = useState<RegimeComparison | null>(null);

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
          businessIncome: incomeSources.hasBusinessIncome ? (
            businessDetails.isPresumptive
              ? (businessDetails.presumptiveIncome44AD + businessDetails.presumptiveIncome44ADA + businessDetails.presumptiveIncome44AE)
              : businessDetails.businessIncome
          ) : 0,
          presumptiveIncome44AD: businessDetails.presumptiveIncome44AD,
          presumptiveIncome44ADA: businessDetails.presumptiveIncome44ADA,
          grossTurnover: businessDetails.grossTurnover,
          grossReceipts: businessDetails.grossReceipts,
          isPresumptive: businessDetails.isPresumptive,
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

  const regimeCompareMutation = useMutation({
    mutationFn: async () => {
      const salaryIncome = salaryDetails.grossSalary + salaryDetails.allowances +
        salaryDetails.perquisites + salaryDetails.profitInLieu -
        salaryDetails.standardDeduction - salaryDetails.professionalTax;
      const businessInc = incomeSources.hasBusinessIncome ? (
        businessDetails.isPresumptive
          ? (businessDetails.presumptiveIncome44AD + businessDetails.presumptiveIncome44ADA + businessDetails.presumptiveIncome44AE)
          : businessDetails.businessIncome
      ) : 0;
      const res = await apiRequest("/api/tax/itr/regime-compare", {
        method: "POST",
        body: JSON.stringify({
          assessmentYear,
          entityType: panContext?.panType || "individual",
          salaryIncome: Math.max(0, salaryIncome),
          businessIncome: businessInc,
          interestIncome: otherIncomeDetails.interestIncome,
          dividendIncome: otherIncomeDetails.dividendIncome,
          otherIncome: otherIncomeDetails.otherSources,
          section80C: deductionDetails.section80C,
          section80D: deductionDetails.section80D,
          section80E: deductionDetails.section80E,
          section80G: deductionDetails.section80G,
          section80TTA: deductionDetails.section80TTA,
          otherDeductions: deductionDetails.otherDeductions,
          standardDeduction: salaryDetails.standardDeduction,
          professionalTax: salaryDetails.professionalTax,
          homeLoanInterest: housePropertyDetails.interestOnLoan,
          presumptiveIncome44AD: businessDetails.presumptiveIncome44AD,
          presumptiveIncome44ADA: businessDetails.presumptiveIncome44ADA,
          grossTurnover: businessDetails.grossTurnover,
          grossReceipts: businessDetails.grossReceipts,
          isPresumptive: businessDetails.isPresumptive,
        }),
      });
      return (res as any)?.data as RegimeComparison;
    },
    onSuccess: (data) => {
      if (data) setRegimeComparison(data);
    },
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
        form = businessDetails.isPresumptive && !incomeSources.hasCapitalGains && !incomeSources.hasForeignIncome ? "ITR-4" : "ITR-3";
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
  }, [incomeSources, salaryDetails, housePropertyDetails, otherIncomeDetails, panContext, businessDetails]);

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
    if (incomeSources.hasBusinessIncome) active.push(STEPS[4]);
    if (incomeSources.hasCapitalGains) active.push(STEPS[5]);
    if (incomeSources.hasForeignIncome) active.push(STEPS[6]);
    if (incomeSources.hasOtherIncome) active.push(STEPS[7]);
    active.push(STEPS[8]);
    active.push(STEPS[9]);
    active.push(STEPS[10]);
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
      case "business":
        if (incomeSources.hasBusinessIncome) {
          if (businessDetails.isPresumptive) {
            if (businessDetails.businessType === "business") {
              if (businessDetails.grossTurnover <= 0) {
                errors.push("Please enter gross turnover for presumptive income under Section 44AD.");
              }
              if (businessDetails.grossTurnover > 30000000) {
                errors.push("Turnover exceeds ₹3 Cr limit for Section 44AD. Presumptive taxation is not eligible — switch to regular filing (ITR-3).");
              }
              const minDeemed = Math.round(businessDetails.grossTurnover * 0.06);
              if (businessDetails.presumptiveIncome44AD > 0 && businessDetails.presumptiveIncome44AD < minDeemed) {
                errors.push(`Deemed profit cannot be less than 6% of turnover (₹${minDeemed.toLocaleString('en-IN')}). IT Act mandates minimum 6% for digital receipts, 8% otherwise.`);
              }
            }
            if (businessDetails.businessType === "profession") {
              if (businessDetails.grossReceipts <= 0) {
                errors.push("Please enter gross receipts for presumptive income under Section 44ADA.");
              }
              if (businessDetails.grossReceipts > 7500000) {
                errors.push("Gross receipts exceed ₹75 lakhs limit for Section 44ADA. Presumptive taxation is not eligible — switch to regular filing (ITR-3).");
              }
              const minDeemed = Math.round(businessDetails.grossReceipts * 0.5);
              if (businessDetails.presumptiveIncome44ADA > 0 && businessDetails.presumptiveIncome44ADA < minDeemed) {
                errors.push(`Deemed profit cannot be less than 50% of gross receipts (₹${minDeemed.toLocaleString('en-IN')}). Section 44ADA mandates minimum 50%.`);
              }
            }
            if (businessDetails.businessType === "transport") {
              if (businessDetails.vehicleCount <= 0) {
                errors.push("Please enter the number of goods carriage vehicles owned.");
              }
              if (businessDetails.vehicleCount > 10) {
                errors.push("Section 44AE is limited to taxpayers owning ≤10 goods carriage vehicles. Use regular ITR-3 filing.");
              }
            }
          } else {
            if (businessDetails.businessIncome <= 0) {
              warnings.push("No business income entered. If you don't have business income, consider unchecking it in income sources.");
            }
          }
          if (!businessDetails.businessDescription) {
            warnings.push("A brief business description helps during assessment proceedings.");
          }
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
  }, [incomeSources, salaryDetails, housePropertyDetails, businessDetails, capitalGainsDetails, foreignIncomeDetails, deductionDetails, taxPaymentDetails, panContext, taxRegime]);

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

    const businessInc = incomeSources.hasBusinessIncome ? (
      businessDetails.isPresumptive
        ? (businessDetails.presumptiveIncome44AD + businessDetails.presumptiveIncome44ADA + businessDetails.presumptiveIncome44AE)
        : businessDetails.businessIncome
    ) : 0;

    const grossTotalIncome = Math.max(0, salaryIncome) + housePropertyIncome + capitalGains + otherIncome + totalForeignIncome + businessInc;

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
      businessDetails: incomeSources.hasBusinessIncome ? businessDetails : undefined,
      foreignIncomeDetails: incomeSources.hasForeignIncome ? foreignIncomeDetails : undefined,
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

  const renderBusinessIncomeStep = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Building2 className="h-5 w-5 text-orange-600" />
        <p className="text-muted-foreground text-sm">
          {recommendedForm === "ITR-4" ? "Presumptive taxation under Section 44AD/44ADA" : "Business or profession income details (ITR-3)"}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <Label>Business Type</Label>
          <Select value={businessDetails.businessType} onValueChange={(v) => setBusinessDetails(prev => ({ ...prev, businessType: v }))}>
            <SelectTrigger data-testid="select-business-type">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="business">Business (44AD)</SelectItem>
              <SelectItem value="profession">Profession (44ADA)</SelectItem>
              <SelectItem value="transport">Goods Carriage (44AE)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Business Description</Label>
          <Input
            value={businessDetails.businessDescription}
            onChange={(e) => setBusinessDetails(prev => ({ ...prev, businessDescription: e.target.value }))}
            placeholder="e.g. Software consulting, Retail shop"
            data-testid="input-business-desc"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
        <Checkbox
          checked={businessDetails.isPresumptive}
          onCheckedChange={(checked) => setBusinessDetails(prev => ({ ...prev, isPresumptive: !!checked }))}
          data-testid="checkbox-presumptive"
        />
        <div>
          <p className="text-sm font-medium text-orange-800 dark:text-orange-200">Presumptive Taxation Scheme</p>
          <p className="text-xs text-orange-600 dark:text-orange-400">
            Simplified filing under 44AD (business ≤₹3 Cr) or 44ADA (profession ≤₹75 Lakh). No need to maintain books.
          </p>
        </div>
      </div>

      {businessDetails.isPresumptive ? (
        <div className="space-y-5">
          {businessDetails.businessType === "business" && (
            <Card className="border-orange-200 dark:border-orange-800">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300">Section 44AD</Badge>
                  <span className="text-sm text-muted-foreground">Presumptive Business Income</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Gross Turnover (Annual) <span className="text-red-500">*</span>
                      <FieldHint text="Total revenue/turnover of business. For digital receipts (>95% via banking), 6% of turnover is deemed income; otherwise 8%." />
                    </Label>
                    <CurrencyInput
                      id="grossTurnover"
                      value={businessDetails.grossTurnover}
                      onChange={(v) => {
                        const deemed = Math.round(v * 0.08);
                        setBusinessDetails(prev => ({ ...prev, grossTurnover: v, presumptiveIncome44AD: deemed }));
                      }}
                      placeholder="e.g. 1,00,00,000"
                      data-testid="input-gross-turnover"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Deemed Profit (8% of Turnover)
                      <FieldHint text="Minimum 8% of turnover (6% for digital receipts). You can declare higher income." />
                    </Label>
                    <CurrencyInput
                      id="presumptiveIncome44AD"
                      value={businessDetails.presumptiveIncome44AD}
                      onChange={(v) => setBusinessDetails(prev => ({ ...prev, presumptiveIncome44AD: v }))}
                      data-testid="input-presumptive-44ad"
                    />
                    <p className="text-xs text-muted-foreground">Min: {formatCurrency(Math.round(businessDetails.grossTurnover * 0.06))} (6%) — Max: {formatCurrency(businessDetails.grossTurnover)} (100%)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {businessDetails.businessType === "profession" && (
            <Card className="border-orange-200 dark:border-orange-800">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300">Section 44ADA</Badge>
                  <span className="text-sm text-muted-foreground">Presumptive Professional Income</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Gross Receipts (Annual) <span className="text-red-500">*</span>
                      <FieldHint text="Total professional receipts. 50% is deemed as net income under 44ADA." />
                    </Label>
                    <CurrencyInput
                      id="grossReceipts"
                      value={businessDetails.grossReceipts}
                      onChange={(v) => {
                        const deemed = Math.round(v * 0.5);
                        setBusinessDetails(prev => ({ ...prev, grossReceipts: v, presumptiveIncome44ADA: deemed }));
                      }}
                      placeholder="e.g. 50,00,000"
                      data-testid="input-gross-receipts"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Deemed Profit (50% of Receipts)
                      <FieldHint text="Minimum 50% of gross receipts. You can declare higher." />
                    </Label>
                    <CurrencyInput
                      id="presumptiveIncome44ADA"
                      value={businessDetails.presumptiveIncome44ADA}
                      onChange={(v) => setBusinessDetails(prev => ({ ...prev, presumptiveIncome44ADA: v }))}
                      data-testid="input-presumptive-44ada"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {businessDetails.businessType === "transport" && (
            <Card className="border-orange-200 dark:border-orange-800">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300">Section 44AE</Badge>
                  <span className="text-sm text-muted-foreground">Goods Carriage Income (≤10 vehicles)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Number of Goods Vehicles <span className="text-red-500">*</span>
                      <FieldHint text="Total vehicles owned at any time during the year. Section 44AE is limited to ≤10 vehicles." />
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      value={businessDetails.vehicleCount || ""}
                      onChange={(e) => {
                        const count = parseInt(e.target.value) || 0;
                        const deemed = count * 7500 * 12;
                        setBusinessDetails(prev => ({ ...prev, vehicleCount: count, presumptiveIncome44AE: deemed }));
                      }}
                      placeholder="e.g. 5"
                      data-testid="input-vehicle-count"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Deemed Profit (₹7,500/vehicle/month)
                      <FieldHint text="₹7,500 per month per vehicle for light goods vehicles. ₹1,000 per ton per month for heavy vehicles." />
                    </Label>
                    <CurrencyInput
                      id="presumptiveIncome44AE"
                      value={businessDetails.presumptiveIncome44AE}
                      onChange={(v) => setBusinessDetails(prev => ({ ...prev, presumptiveIncome44AE: v }))}
                      data-testid="input-presumptive-44ae"
                    />
                    <p className="text-xs text-muted-foreground">Auto-calculated: {businessDetails.vehicleCount} × ₹7,500 × 12 = {formatCurrency(businessDetails.vehicleCount * 7500 * 12)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <Card>
            <CardContent className="p-5 space-y-4">
              <p className="text-sm font-medium">Regular Business Income (Non-Presumptive)</p>
              <p className="text-xs text-muted-foreground">You must maintain books of accounts. Tax audit required if turnover exceeds prescribed limits.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Net Business Income <span className="text-red-500">*</span></Label>
                  <CurrencyInput
                    id="businessIncome"
                    value={businessDetails.businessIncome}
                    onChange={(v) => setBusinessDetails(prev => ({ ...prev, businessIncome: v }))}
                    placeholder="Net profit from P&L account"
                    data-testid="input-business-income"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Gross Turnover</Label>
                  <CurrencyInput
                    id="nonPresumptiveTurnover"
                    value={businessDetails.grossTurnover}
                    onChange={(v) => setBusinessDetails(prev => ({ ...prev, grossTurnover: v }))}
                    placeholder="Total turnover/receipts"
                    data-testid="input-non-presumptive-turnover"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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

  const brokersQuery = useQuery<{ brokers: Array<{ id: string; name: string; category: string; supportedFormats: string[]; fileFormatHint: string; assetTypes: string[] }> }>({
    queryKey: ['/api/tax/capital-gains/brokers'],
    enabled: incomeSources.hasCapitalGains,
  });

  const brokerList = brokersQuery.data?.brokers || [];
  const filteredBrokers = brokerList.filter(b =>
    b.name.toLowerCase().includes(cgBrokerSearch.toLowerCase()) ||
    b.category.toLowerCase().includes(cgBrokerSearch.toLowerCase())
  );

  const handleCgFileUpload = async (file: File, brokerId: string) => {
    setCgUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('brokerId', brokerId);
      formData.append('assessmentYear', assessmentYear);

      const resp = await fetch('/api/tax/capital-gains/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      const result = await resp.json();

      if (result.success) {
        setCgUploads(prev => [...prev, {
          id: result.uploadId,
          brokerName: result.brokerName,
          brokerId,
          fileName: result.fileName,
          parseConfidence: result.parseConfidence,
          summary: result.summary,
          status: result.status,
          uploadedAt: new Date().toISOString(),
        }]);
        const uploadSTCG = cgUploads.reduce((s, u) => s + u.summary.netSTCG, 0) + (result.summary?.netSTCG || 0);
        const uploadLTCG = cgUploads.reduce((s, u) => s + u.summary.netLTCG, 0) + (result.summary?.netLTCG || 0);
        setCapitalGainsDetails(prev => ({
          ...prev,
          shortTermGains: uploadSTCG + cgManualSaved.reduce((s, e) => s + e.summary.totalSTCG, 0),
          longTermGains: uploadLTCG + cgManualSaved.reduce((s, e) => s + e.summary.totalLTCG, 0),
        }));
        toast({ title: "Statement Uploaded", description: `${result.brokerName}: ${result.transactionCount} transactions parsed (${(result.parseConfidence * 100).toFixed(0)}% confidence)` });
        if (result.parseWarnings?.length > 0) {
          toast({ title: "Parse Warnings", description: result.parseWarnings.slice(0, 2).join('; '), variant: "destructive" });
        }
      } else {
        toast({ title: "Upload Failed", description: result.error || 'Unknown error', variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Upload Error", description: err instanceof Error ? err.message : 'Upload failed', variant: "destructive" });
    } finally {
      setCgUploading(false);
      setCgSelectedBroker(null);
    }
  };

  const handleCgManualSave = async () => {
    if (cgManualEntries.length === 0) {
      toast({ title: "No entries", description: "Please add at least one transaction", variant: "destructive" });
      return;
    }
    try {
      const resp = await apiRequest('/api/tax/capital-gains/manual', {
        method: 'POST',
        body: JSON.stringify({
          assessmentYear,
          assetType: cgManualAssetType,
          entries: cgManualEntries.map(e => ({
            ...e,
            quantity: e.quantity || 1,
            buyPrice: e.buyPrice || 0,
            sellPrice: e.sellPrice || 0,
            expenses: e.expenses || 0,
            sttPaid: e.sttPaid || 0,
          })),
        }),
      });
      const result = await resp.json();
      if (result.success) {
        setCgManualSaved(prev => [...prev, {
          id: result.entryId,
          assetType: cgManualAssetType,
          summary: result.summary,
          entryCount: result.entries.length,
        }]);
        const manualSTCG = cgManualSaved.reduce((s, e) => s + e.summary.totalSTCG, 0) + (result.summary?.totalSTCG || 0);
        const manualLTCG = cgManualSaved.reduce((s, e) => s + e.summary.totalLTCG, 0) + (result.summary?.totalLTCG || 0);
        setCapitalGainsDetails(prev => ({
          ...prev,
          shortTermGains: cgUploads.reduce((s, u) => s + u.summary.netSTCG, 0) + manualSTCG,
          longTermGains: cgUploads.reduce((s, u) => s + u.summary.netLTCG, 0) + manualLTCG,
          exemptionsApplied: cgManualSaved.reduce((s, e) => s + e.summary.totalExemptions, 0) + (result.summary?.totalExemptions || 0),
        }));
        setCgManualEntries([]);
        toast({ title: "Entries Saved", description: `${result.entries.length} ${cgManualAssetType} transactions saved. STCG: ${formatCurrency(result.summary.totalSTCG)}, LTCG: ${formatCurrency(result.summary.totalLTCG)}` });
      }
    } catch (err) {
      toast({ title: "Save Error", description: err instanceof Error ? err.message : 'Save failed', variant: "destructive" });
    }
  };

  const addManualEntry = () => {
    setCgManualEntries(prev => [...prev, {
      assetName: '', isin: '', buyDate: '', sellDate: '',
      quantity: 0, buyPrice: 0, sellPrice: 0,
      expenses: 0, sttPaid: 0, fairMarketValue: 0,
      exemptionSection: '', exemptionAmount: 0,
    }]);
  };

  const updateManualEntry = (idx: number, field: keyof ManualCGEntry, value: string | number) => {
    setCgManualEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  };

  const removeManualEntry = (idx: number) => {
    setCgManualEntries(prev => prev.filter((_, i) => i !== idx));
  };

  const renderCapitalGainsStep = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">Upload your broker's Tax P&L statement or enter capital gains manually for each asset type.</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant={cgMode === 'upload' ? 'default' : 'outline'} onClick={() => setCgMode('upload')} data-testid="cg-mode-upload">
          <Upload className="h-4 w-4 mr-1" /> Upload Statement
        </Button>
        <Button size="sm" variant={cgMode === 'manual' ? 'default' : 'outline'} onClick={() => setCgMode('manual')} data-testid="cg-mode-manual">
          <Plus className="h-4 w-4 mr-1" /> Manual Entry
        </Button>
        <Button size="sm" variant={cgMode === 'summary' ? 'default' : 'outline'} onClick={() => setCgMode('summary')} data-testid="cg-mode-summary">
          <BarChart3 className="h-4 w-4 mr-1" /> Summary
        </Button>
      </div>

      {cgMode === 'upload' && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Upload Capital Gains Statement
              </CardTitle>
              <CardDescription>Select your broker/fund house and upload the Tax P&L report. We support {brokerList.length}+ platforms.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Input
                  placeholder="Search brokers (e.g. Zerodha, CAMS, Groww...)"
                  value={cgBrokerSearch}
                  onChange={(e) => setCgBrokerSearch(e.target.value)}
                  className="pl-8"
                  data-testid="cg-broker-search"
                />
                <span className="absolute left-2.5 top-2.5 text-muted-foreground text-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                </span>
              </div>

              {(['stock_broker', 'fund_house', 'aggregator', 'us_stocks'] as const).map(category => {
                const brokers = filteredBrokers.filter(b => b.category === category);
                if (brokers.length === 0) return null;
                const categoryLabels: Record<string, string> = {
                  stock_broker: 'Stock Brokers',
                  fund_house: 'Fund Houses / Registrars',
                  aggregator: 'Aggregators & Platforms',
                  us_stocks: 'US Stocks',
                };
                return (
                  <div key={category} className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">{categoryLabels[category]}</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                      {brokers.map(broker => (
                        <Button
                          key={broker.id}
                          variant={cgSelectedBroker === broker.id ? 'default' : 'outline'}
                          size="sm"
                          className="h-auto py-2 px-3 text-left justify-start text-xs"
                          onClick={() => setCgSelectedBroker(broker.id === cgSelectedBroker ? null : broker.id)}
                          data-testid={`cg-broker-${broker.id}`}
                        >
                          <span className="truncate">{broker.name}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                );
              })}

              {cgSelectedBroker && (() => {
                const broker = brokerList.find(b => b.id === cgSelectedBroker);
                if (!broker) return null;
                return (
                  <Card className="border-primary/30 bg-primary/5">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{broker.name}</p>
                          <p className="text-xs text-muted-foreground">{broker.fileFormatHint}</p>
                        </div>
                        <Badge variant="outline">{broker.supportedFormats.map(f => f.toUpperCase()).join(' / ')}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept={broker.supportedFormats.map(f => `.${f}`).join(',')}
                          disabled={cgUploading}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleCgFileUpload(file, broker.id);
                          }}
                          data-testid="cg-file-input"
                        />
                        {cgUploading && <span className="text-xs text-muted-foreground animate-pulse">Uploading & parsing...</span>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Broker not listed?</p>
                  <p className="text-xs text-muted-foreground">Download our Excel template, fill in your transactions, and upload using "FintekPro Template" option above.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setCgSelectedBroker('template')}>
                  Use Template
                </Button>
              </div>
            </CardContent>
          </Card>

          {cgUploads.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Uploaded Statements ({cgUploads.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {cgUploads.map(upload => (
                  <div key={upload.id} className="flex items-center justify-between border rounded-md p-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{upload.brokerName}</span>
                        <Badge variant={upload.parseConfidence >= 0.7 ? 'default' : 'secondary'} className="text-xs">
                          {(upload.parseConfidence * 100).toFixed(0)}% confidence
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{upload.fileName} — {upload.summary.totalTransactions} transactions</p>
                      <div className="flex gap-3 mt-1">
                        <span className="text-xs">STCG: <span className={upload.summary.netSTCG >= 0 ? 'text-green-600' : 'text-red-600'}>{formatCurrency(upload.summary.netSTCG)}</span></span>
                        <span className="text-xs">LTCG: <span className={upload.summary.netLTCG >= 0 ? 'text-green-600' : 'text-red-600'}>{formatCurrency(upload.summary.netLTCG)}</span></span>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => {
                      setCgUploads(prev => prev.filter(u => u.id !== upload.id));
                    }}><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {cgMode === 'manual' && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Add Sale Entry — Manual</CardTitle>
              <CardDescription>Enter capital gains data manually for each asset type. Each entry is logged to the audit trail.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {MANUAL_ASSET_TYPES.map(at => (
                  <Button
                    key={at.value}
                    variant={cgManualAssetType === at.value ? 'default' : 'outline'}
                    size="sm"
                    className="h-auto py-2 px-3 text-left justify-start"
                    onClick={() => { setCgManualAssetType(at.value); setCgManualEntries([]); }}
                    data-testid={`cg-manual-type-${at.value}`}
                  >
                    <span className="mr-1.5">{at.icon}</span>
                    <span className="text-xs truncate">{at.label}</span>
                  </Button>
                ))}
              </div>

              {(() => {
                const selectedType = MANUAL_ASSET_TYPES.find(t => t.value === cgManualAssetType);
                if (!selectedType) return null;
                return (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      <strong>{selectedType.label}</strong>: {selectedType.hint}<br/>
                      <span className="text-muted-foreground">LTCG holding period: {selectedType.holdingPeriod}</span>
                    </AlertDescription>
                  </Alert>
                );
              })()}

              {cgManualEntries.map((entry, idx) => (
                <Card key={idx} className="border">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Transaction #{idx + 1}</span>
                      <Button variant="ghost" size="sm" onClick={() => removeManualEntry(idx)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Asset Name <span className="text-red-500">*</span></Label>
                        <Input
                          value={entry.assetName}
                          onChange={(e) => updateManualEntry(idx, 'assetName', e.target.value)}
                          placeholder={cgManualAssetType === 'property' ? 'e.g. 2BHK Flat, Andheri' : 'e.g. Reliance Industries'}
                          data-testid={`cg-manual-name-${idx}`}
                        />
                      </div>
                      {cgManualAssetType !== 'property' && cgManualAssetType !== 'deemed_cg' && (
                        <div className="space-y-1.5">
                          <Label className="text-xs">ISIN (optional)</Label>
                          <Input
                            value={entry.isin}
                            onChange={(e) => updateManualEntry(idx, 'isin', e.target.value)}
                            placeholder="e.g. INE002A01018"
                          />
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <Label className="text-xs">Purchase Date <span className="text-red-500">*</span></Label>
                        <Input type="date" value={entry.buyDate} onChange={(e) => updateManualEntry(idx, 'buyDate', e.target.value)} data-testid={`cg-manual-buydate-${idx}`} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Sale Date <span className="text-red-500">*</span></Label>
                        <Input type="date" value={entry.sellDate} onChange={(e) => updateManualEntry(idx, 'sellDate', e.target.value)} data-testid={`cg-manual-selldate-${idx}`} />
                      </div>
                      {cgManualAssetType !== 'property' && (
                        <div className="space-y-1.5">
                          <Label className="text-xs">Quantity</Label>
                          <Input type="number" min={0} value={entry.quantity || ''} onChange={(e) => updateManualEntry(idx, 'quantity', parseFloat(e.target.value) || 0)} placeholder="Number of units/shares" />
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <Label className="text-xs">{cgManualAssetType === 'property' ? 'Purchase Price' : 'Buy Price Per Unit'}</Label>
                        <CurrencyInput id={`buyPrice-${idx}`} value={entry.buyPrice} onChange={(v) => updateManualEntry(idx, 'buyPrice', v)} data-testid={`cg-manual-buyprice-${idx}`} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">{cgManualAssetType === 'property' ? 'Sale Consideration' : 'Sell Price Per Unit'}</Label>
                        <CurrencyInput id={`sellPrice-${idx}`} value={entry.sellPrice} onChange={(v) => updateManualEntry(idx, 'sellPrice', v)} data-testid={`cg-manual-sellprice-${idx}`} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Expenses (Brokerage/Stamp Duty)</Label>
                        <CurrencyInput id={`expenses-${idx}`} value={entry.expenses} onChange={(v) => updateManualEntry(idx, 'expenses', v)} />
                      </div>
                      {(cgManualAssetType === 'shares' || cgManualAssetType === 'mutual_funds') && (
                        <div className="space-y-1.5">
                          <Label className="text-xs">STT Paid</Label>
                          <CurrencyInput id={`stt-${idx}`} value={entry.sttPaid} onChange={(v) => updateManualEntry(idx, 'sttPaid', v)} />
                        </div>
                      )}
                      {cgManualAssetType === 'property' && (
                        <>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Stamp Duty Value (Sec 50C)</Label>
                            <CurrencyInput id={`sdv-${idx}`} value={entry.fairMarketValue} onChange={(v) => updateManualEntry(idx, 'fairMarketValue', v)} />
                          </div>
                        </>
                      )}
                      <div className="space-y-1.5">
                        <Label className="text-xs">Exemption Section</Label>
                        <Select value={entry.exemptionSection} onValueChange={(v) => updateManualEntry(idx, 'exemptionSection', v)}>
                          <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Exemption</SelectItem>
                            <SelectItem value="54">Sec 54 - House reinvestment</SelectItem>
                            <SelectItem value="54EC">Sec 54EC - Capital Gains Bonds</SelectItem>
                            <SelectItem value="54F">Sec 54F - New house from other CG</SelectItem>
                            <SelectItem value="54B">Sec 54B - Agricultural land</SelectItem>
                            <SelectItem value="54GB">Sec 54GB - Startup investment</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {entry.exemptionSection && entry.exemptionSection !== 'none' && (
                        <div className="space-y-1.5">
                          <Label className="text-xs">Exemption Amount</Label>
                          <CurrencyInput id={`exemption-${idx}`} value={entry.exemptionAmount} onChange={(v) => updateManualEntry(idx, 'exemptionAmount', v)} />
                        </div>
                      )}
                    </div>
                    {entry.buyDate && entry.sellDate && (
                      <div className="flex gap-4 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                        <span>Holding: {Math.max(0, Math.floor((new Date(entry.sellDate).getTime() - new Date(entry.buyDate).getTime()) / (86400000)))} days</span>
                        <span>Gain/Loss: {formatCurrency((entry.quantity || 1) * (entry.sellPrice - entry.buyPrice) - entry.expenses - (entry.exemptionAmount || 0))}</span>
                        <Badge variant="secondary" className="text-xs">
                          {Math.floor((new Date(entry.sellDate).getTime() - new Date(entry.buyDate).getTime()) / 86400000) > (cgManualAssetType === 'property' || cgManualAssetType === 'gold' || cgManualAssetType === 'other_assets' ? 730 : 365) ? 'LTCG' : 'STCG'}
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={addManualEntry} data-testid="cg-add-manual">
                  <Plus className="h-4 w-4 mr-1" /> Add Transaction
                </Button>
                {cgManualEntries.length > 0 && (
                  <Button size="sm" onClick={handleCgManualSave} data-testid="cg-save-manual">
                    <Save className="h-4 w-4 mr-1" /> Save {cgManualEntries.length} Entries
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {cgManualSaved.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Saved Manual Entries ({cgManualSaved.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {cgManualSaved.map(saved => {
                  const at = MANUAL_ASSET_TYPES.find(t => t.value === saved.assetType);
                  return (
                    <div key={saved.id} className="flex items-center justify-between border rounded-md p-3">
                      <div>
                        <span className="text-sm font-medium">{at?.icon} {at?.label || saved.assetType}</span>
                        <span className="text-xs text-muted-foreground ml-2">({saved.entryCount} transactions)</span>
                        <div className="flex gap-3 mt-1">
                          <span className="text-xs">STCG: <span className="text-green-600">{formatCurrency(saved.summary.totalSTCG)}</span></span>
                          <span className="text-xs">LTCG: <span className="text-green-600">{formatCurrency(saved.summary.totalLTCG)}</span></span>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => {
                        setCgManualSaved(prev => prev.filter(s => s.id !== saved.id));
                      }}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>F&O / Intraday Trading:</strong> If you have Futures & Options or frequent intraday activity, these are classified as Business Income (ITR-3). 
              Use the Business & Profession section instead. Only equity delivery-based trades are reported as Capital Gains.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {cgMode === 'summary' && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Capital Gains Summary
              </CardTitle>
              <CardDescription>Combined totals from all uploaded statements and manual entries. These values will be used in your ITR filing.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800">
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground">Short Term Capital Gains</p>
                    <p className="text-xl font-bold text-orange-700 dark:text-orange-400">{formatCurrency(capitalGainsDetails.shortTermGains)}</p>
                    <p className="text-xs text-muted-foreground">Taxed at 15-20% (u/s 111A)</p>
                  </CardContent>
                </Card>
                <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground">Long Term Capital Gains</p>
                    <p className="text-xl font-bold text-blue-700 dark:text-blue-400">{formatCurrency(capitalGainsDetails.longTermGains)}</p>
                    <p className="text-xs text-muted-foreground">Taxed at 10-12.5% (u/s 112A)</p>
                  </CardContent>
                </Card>
                <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground">Net Capital Gains</p>
                    <p className="text-xl font-bold text-green-700 dark:text-green-400">{formatCurrency(totals.capitalGains)}</p>
                    <p className="text-xs text-muted-foreground">After exemptions</p>
                  </CardContent>
                </Card>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-sm font-medium">Exemptions (Sec 54/54EC/54F)</Label>
                <CurrencyInput
                  id="exemptions"
                  value={capitalGainsDetails.exemptionsApplied}
                  onChange={(v) => setCapitalGainsDetails(prev => ({ ...prev, exemptionsApplied: v }))}
                  placeholder="0 if no exemptions claimed"
                  data-testid="input-exemptions"
                />
                <p className="text-xs text-muted-foreground">Reinvestment exemptions. Sec 54: Reinvest property sale proceeds in a new house within 2 years. Sec 54EC: Invest up to ₹50 lakhs in capital gains bonds within 6 months.</p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-sm font-medium">Override Totals (Advanced)</Label>
                <p className="text-xs text-muted-foreground">If upload/manual totals are incorrect, you can override them directly below.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Short Term Capital Gains (STCG)</Label>
                    <CurrencyInput
                      id="shortTermGains"
                      value={capitalGainsDetails.shortTermGains}
                      onChange={(v) => setCapitalGainsDetails(prev => ({ ...prev, shortTermGains: v }))}
                      data-testid="input-short-term-gains"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Long Term Capital Gains (LTCG)</Label>
                    <CurrencyInput
                      id="longTermGains"
                      value={capitalGainsDetails.longTermGains}
                      onChange={(v) => setCapitalGainsDetails(prev => ({ ...prev, longTermGains: v }))}
                      data-testid="input-long-term-gains"
                    />
                  </div>
                </div>
              </div>

              {(cgUploads.length > 0 || cgManualSaved.length > 0) && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Data Sources</Label>
                    {cgUploads.map(u => (
                      <div key={u.id} className="flex items-center justify-between text-xs border rounded p-2">
                        <span><Upload className="h-3 w-3 inline mr-1" />{u.brokerName} ({u.fileName})</span>
                        <span>STCG: {formatCurrency(u.summary.netSTCG)} | LTCG: {formatCurrency(u.summary.netLTCG)}</span>
                      </div>
                    ))}
                    {cgManualSaved.map(s => {
                      const at = MANUAL_ASSET_TYPES.find(t => t.value === s.assetType);
                      return (
                        <div key={s.id} className="flex items-center justify-between text-xs border rounded p-2">
                          <span>{at?.icon} {at?.label} ({s.entryCount} entries)</span>
                          <span>STCG: {formatCurrency(s.summary.totalSTCG)} | LTCG: {formatCurrency(s.summary.totalLTCG)}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  All uploads and manual entries are logged with SHA-256 hash chain integrity for ITR department audit compliance. 
                  File checksums, parse confidence scores, and entry timestamps are immutably recorded.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      )}

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
    const apiRegimeComparison = apiData?.regimeComparison;

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
              {incomeSources.hasBusinessIncome && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1"><Building2 className="h-3 w-3" /> Business Income</span>
                  <span className="font-medium">{formatCurrency(
                    businessDetails.isPresumptive 
                      ? (businessDetails.presumptiveIncome44AD + businessDetails.presumptiveIncome44ADA + businessDetails.presumptiveIncome44AE) 
                      : businessDetails.businessIncome
                  )}</span>
                </div>
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

          <Card className="dark:border-border border-blue-200 dark:border-blue-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                Regime Comparison
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => regimeCompareMutation.mutate()}
                disabled={regimeCompareMutation.isPending}
                data-testid="btn-compare-regimes"
              >
                {regimeCompareMutation.isPending ? (
                  <><Clock className="h-4 w-4 mr-2 animate-spin" /> Comparing via Sandbox API...</>
                ) : (
                  <><Calculator className="h-4 w-4 mr-2" /> Compare Old vs New Regime</>
                )}
              </Button>
              {regimeComparison && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className={`p-3 rounded-lg border ${regimeComparison.recommended === 'old' ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-muted'}`}>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Old Regime</p>
                      <p className="text-lg font-bold">{formatLakhs(regimeComparison.oldRegime.taxPayable)}</p>
                      <p className="text-xs text-muted-foreground">Deductions: {formatCurrency(regimeComparison.oldRegime.totalDeductions)}</p>
                      {regimeComparison.recommended === 'old' && <Badge className="mt-1 bg-green-600 text-[10px]">Recommended</Badge>}
                    </div>
                    <div className={`p-3 rounded-lg border ${regimeComparison.recommended === 'new' ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-muted'}`}>
                      <p className="text-xs font-medium text-muted-foreground mb-1">New Regime</p>
                      <p className="text-lg font-bold">{formatLakhs(regimeComparison.newRegime.taxPayable)}</p>
                      <p className="text-xs text-muted-foreground">Deductions: {formatCurrency(regimeComparison.newRegime.totalDeductions)}</p>
                      {regimeComparison.recommended === 'new' && <Badge className="mt-1 bg-green-600 text-[10px]">Recommended</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950 rounded text-xs">
                    <CheckCircle className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
                    <span>{regimeComparison.recommendation}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

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
                <Scale className="h-4 w-4" /> Regime Comparison (Sandbox API)
              </CardTitle>
              <CardDescription>We computed your tax under both regimes to help you choose the better one.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className={`p-4 rounded-lg border ${regimeComparison.recommended === "old" ? "border-green-400 bg-green-50 dark:bg-green-950" : "bg-muted/30"}`}>
                  <p className="text-sm font-medium mb-1">Old Regime</p>
                  <p className="text-xl font-bold">{formatCurrency(regimeComparison.oldRegime.taxPayable)}</p>
                  <p className="text-xs text-muted-foreground">Rate: {(regimeComparison.oldRegime.effectiveTaxRate ?? 0).toFixed(1)}%</p>
                  {regimeComparison.recommended === "old" && (
                    <Badge className="mt-2 bg-green-100 text-green-700">Recommended - Save {formatLakhs(regimeComparison.savings)}</Badge>
                  )}
                </div>
                <div className={`p-4 rounded-lg border ${regimeComparison.recommended === "new" ? "border-green-400 bg-green-50 dark:bg-green-950" : "bg-muted/30"}`}>
                  <p className="text-sm font-medium mb-1">New Regime</p>
                  <p className="text-xl font-bold">{formatCurrency(regimeComparison.newRegime.taxPayable)}</p>
                  <p className="text-xs text-muted-foreground">Rate: {(regimeComparison.newRegime.effectiveTaxRate ?? 0).toFixed(1)}%</p>
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
      case "business": return renderBusinessIncomeStep();
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
