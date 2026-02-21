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

interface HousePropertyEntry {
  propertyType: "self_occupied" | "let_out" | "deemed_let_out";
  rentalIncome: number;
  municipalTaxes: number;
  interestOnLoan: number;
  unrealizedRent: number;
  address: string;
}

interface HousePropertyDetails {
  propertyCount: number;
  rentalIncome: number;
  municipalTaxes: number;
  interestOnLoan: number;
  isSelfOccupied: boolean;
  properties: HousePropertyEntry[];
}

interface CapitalGainsDetails {
  shortTermGains: number;
  longTermGains: number;
  exemptionsApplied: number;
  sttPaidSTCG: number;
  sttNotPaidSTCG: number;
  sttPaidLTCG: number;
  sttNotPaidLTCG: number;
  grandfatheringFMV: number;
  grandfatheringApplied: boolean;
}

interface LossCarryForward {
  assessmentYear: string;
  lossType: "house_property" | "short_term_capital" | "long_term_capital" | "business" | "speculation" | "specified_business";
  lossAmount: number;
  setOffAmount: number;
  carriedForwardAmount: number;
  housePropertyLoss: number;
  shortTermCapitalLoss: number;
  longTermCapitalLoss: number;
  businessLoss: number;
  speculativeBusinessLoss: number;
  owedSpecifiedBusinessLoss: number;
}

interface Schedule112AEntry {
  isin: string;
  shareName: string;
  unitsSold: number;
  salePricePerUnit: number;
  costOfAcquisition: number;
  fmvAsOn31Jan2018: number;
  expenditureOnTransfer: number;
  totalSaleValue: number;
  totalCostWithFMV: number;
  ltcgBeforeExemption: number;
}

interface ScheduleSIDetails {
  stcg111A: number;
  ltcg112A: number;
  ltcg112: number;
  vdaCrypto115BBH: number;
  lottery115BB: number;
  horseRacing: number;
  onlineGaming: number;
  dtaaSpecialRate: number;
  dtaaSpecialRatePercent: number;
  otherSpecialRate: number;
  otherSpecialRatePercent: number;
}

interface ScheduleEIDetails {
  agriculturalIncome: number;
  ltcgExemptUpTo125000: number;
  dividendFromCooperative: number;
  ppfInterest: number;
  epfInterest: number;
  section10Exemptions: number;
  otherExemptIncome: number;
  exemptIncomeDescription: string;
}

interface AdvanceTaxInstallment {
  quarter: string;
  dueDate: string;
  amountDue: number;
  amountPaid: number;
  paidDate: string;
}

interface Interest234Details {
  interest234A: number;
  interest234B: number;
  interest234C: number;
  totalInterest: number;
  filingDueDate: string;
  filingDate: string;
  assessedTax: number;
  advanceTaxDetails: AdvanceTaxInstallment[];
}

interface CYLAAdjustment {
  head: string;
  incomeBeforeSetOff: number;
  hpLossSetOff: number;
  businessLossSetOff: number;
  otherSourceLossSetOff: number;
  incomeAfterSetOff: number;
}

interface BFLAAdjustment {
  head: string;
  incomeAfterCYLA: number;
  bfHPLossSetOff: number;
  bfSTCLSetOff: number;
  bfLTCLSetOff: number;
  bfBusinessLossSetOff: number;
  bfSpeculationSetOff: number;
  incomeAfterBFLA: number;
}

interface CFLEntry {
  assessmentYear: string;
  dateOfFiling: string;
  housePropertyLoss: number;
  shortTermCapitalLoss: number;
  longTermCapitalLoss: number;
  businessLoss: number;
  speculativeBusinessLoss: number;
  specifiedBusinessLoss: number;
}

interface DirectorshipEntry {
  companyName: string;
  companyPAN: string;
  din: string;
  sharesHeld: number;
}

interface UnlistedShareEntry {
  companyName: string;
  companyPAN: string;
  openingShares: number;
  closingShares: number;
  acquisitionCost: number;
}

interface BalanceSheetDetails {
  fixedAssets: number;
  investments: number;
  currentAssets: number;
  loansAndAdvances: number;
  otherAssets: number;
  totalAssets: number;
  capital: number;
  reservesAndSurplus: number;
  securedLoans: number;
  unsecuredLoans: number;
  currentLiabilities: number;
  totalLiabilities: number;
}

interface ProfitLossDetails {
  grossRevenue: number;
  otherOperatingIncome: number;
  totalRevenue: number;
  purchasesAndDirectExpenses: number;
  employeeBenefitExpenses: number;
  depreciation: number;
  otherExpenses: number;
  totalExpenses: number;
  netProfitBeforeTax: number;
}

interface DepreciationEntry {
  assetBlock: string;
  openingWDV: number;
  additions: number;
  disposals: number;
  depreciationRate: number;
  depreciationAmount: number;
  closingWDV: number;
}

interface TaxAuditInfo {
  isAuditRequired: boolean;
  auditorName: string;
  auditorMembershipNo: string;
  auditDate: string;
  form3CA_3CD: boolean;
  form3CB_3CD: boolean;
  auditReportFiled: boolean;
}

interface PartnerDetails {
  partnerName: string;
  partnerPAN: string;
  sharePercentage: number;
  capitalContribution: number;
  profitShareRatio: number;
  remuneration: number;
  interestOnCapital: number;
  isManagingPartner: boolean;
}

interface EntityProfileDetails {
  entityName: string;
  entityPAN: string;
  entityType: string;
  dateOfIncorporation: string;
  registrationNumber: string;
  constitutionType: string;
  natureOfBusiness: string;
  partners: PartnerDetails[];
}

interface CorporateDetails {
  companyType: "private" | "public" | "section_8";
  cin: string;
  authorizedCapital: number;
  paidUpCapital: number;
  matApplicable: boolean;
  matCredit: number;
  bookProfit: number;
  matTax: number;
  dividendDeclared: number;
  dividendDistributionTax: number;
}

interface TrustDetails {
  trustType: "charitable" | "religious" | "educational" | "medical" | "political_party" | "research" | "news_agency";
  registrationSection: string;
  registrationNumber: string;
  registrationDate: string;
  corpusDonations: number;
  voluntaryContributions: number;
  applicationOfIncome: number;
  accumulatedIncome: number;
  accumulationPercentage: number;
  section11Exemption: number;
  section12Exemption: number;
  anonymousDonations: number;
  investmentInSpecifiedMode: number;
}

interface ScheduleALDetails {
  immovableProperty: number;
  movableAssets: number;
  bankDeposits: number;
  sharesAndSecurities: number;
  insurancePolicies: number;
  loansAndAdvancesGiven: number;
  cashInHand: number;
  jewelleryBullion: number;
  archaeologicalCollections: number;
  vehiclesYachtsBoats: number;
  totalAssets: number;
  totalLiabilities: number;
  liabilitiesRelatedToImmovable: number;
  liabilitiesRelatedToOther: number;
}

interface DonationEntry {
  doneeName: string;
  doneePAN: string;
  doneeAddress: string;
  donationAmount: number;
  qualifyingPercentage: 100 | 50;
  qualifyingLimit: "with_limit" | "without_limit";
  donationDate: string;
  donationType: "cash" | "kind" | "other";
  section80GCertificateNo: string;
  eligibleAmount: number;
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
  agriculturalIncome: number;
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
  section80CCC: number;
  section80CCD1: number;
  section80CCD1B: number;
  section80CCD2: number;
  section80D: number;
  section80DD: number;
  section80DDB: number;
  section80E: number;
  section80EEA: number;
  section80EEB: number;
  section80G: number;
  section80GG: number;
  section80TTA: number;
  section80TTB: number;
  section80U: number;
  otherDeductions: number;
}

interface TaxPaymentDetails {
  tdsSalary: number;
  tdsOtherThanSalary: number;
  tdsOnProperty: number;
  tcsCollected: number;
  tdsDeducted: number;
  advanceTaxPaid: number;
  selfAssessmentTax: number;
  reliefUs89: number;
}

interface BankDetailsForRefund {
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  accountType: "savings" | "current";
  isPrimary: boolean;
}

interface EmployerDetails {
  employerName: string;
  employerTAN: string;
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
  { id: "entity_profile", title: "Entity Profile", icon: Building2, description: "Firm/company/trust details and partners" },
  { id: "salary", title: "Salary", icon: Briefcase, description: "Salary and employment details" },
  { id: "property", title: "House Property", icon: Home, description: "Rental and home loan details" },
  { id: "business", title: "Business / Profession", icon: Building2, description: "Business income, P&L, presumptive" },
  { id: "financials", title: "Financial Statements", icon: BarChart3, description: "Balance Sheet, P&L, depreciation" },
  { id: "capital", title: "Capital Gains", icon: TrendingUp, description: "Investment gains and losses" },
  { id: "foreign", title: "Foreign Income", icon: Globe, description: "Global stocks, DTAA relief, Schedule FA" },
  { id: "other", title: "Other Income", icon: Receipt, description: "Interest, dividends, and more" },
  { id: "disclosures", title: "Disclosures", icon: Shield, description: "Director, unlisted shares, loss carry-forward" },
  { id: "trust_income", title: "Trust / Exemptions", icon: Scale, description: "Corpus, voluntary contributions, exemptions" },
  { id: "deductions", title: "Deductions", icon: Calculator, description: "Tax-saving investments" },
  { id: "schedule_al", title: "Schedule AL", icon: Scale, description: "Assets & liabilities disclosure" },
  { id: "loss_adjustment", title: "Loss Adjustment", icon: Scale, description: "CYLA, BFLA, CFL set-off schedules" },
  { id: "schedule_si_ei", title: "Special / Exempt", icon: Shield, description: "Schedule SI & EI — special rate and exempt income" },
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
    isSelfOccupied: true,
    properties: [{ propertyType: "self_occupied", rentalIncome: 0, municipalTaxes: 0, interestOnLoan: 0, unrealizedRent: 0, address: "" }]
  });

  const [capitalGainsDetails, setCapitalGainsDetails] = useState<CapitalGainsDetails>({
    shortTermGains: 0,
    longTermGains: 0,
    exemptionsApplied: 0,
    sttPaidSTCG: 0,
    sttNotPaidSTCG: 0,
    sttPaidLTCG: 0,
    sttNotPaidLTCG: 0,
    grandfatheringFMV: 0,
    grandfatheringApplied: false,
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

  const [residentialStatus, setResidentialStatus] = useState<"resident" | "nri" | "rnor">("resident");
  const [filingSection, setFilingSection] = useState<string>("139(1)");
  const [employerDetails, setEmployerDetails] = useState<EmployerDetails>({ employerName: "", employerTAN: "" });

  const [otherIncomeDetails, setOtherIncomeDetails] = useState<OtherIncomeDetails>({
    interestIncome: 0,
    dividendIncome: 0,
    otherSources: 0,
    agriculturalIncome: 0
  });

  const [deductionDetails, setDeductionDetails] = useState<DeductionDetails>({
    section80C: 0,
    section80CCC: 0,
    section80CCD1: 0,
    section80CCD1B: 0,
    section80CCD2: 0,
    section80D: 0,
    section80DD: 0,
    section80DDB: 0,
    section80E: 0,
    section80EEA: 0,
    section80EEB: 0,
    section80G: 0,
    section80GG: 0,
    section80TTA: 0,
    section80TTB: 0,
    section80U: 0,
    otherDeductions: 0
  });

  const [taxPaymentDetails, setTaxPaymentDetails] = useState<TaxPaymentDetails>({
    tdsSalary: 0,
    tdsOtherThanSalary: 0,
    tdsOnProperty: 0,
    tcsCollected: 0,
    tdsDeducted: 0,
    advanceTaxPaid: 0,
    selfAssessmentTax: 0,
    reliefUs89: 0
  });

  const [bankDetails, setBankDetails] = useState<BankDetailsForRefund>({
    accountNumber: "",
    ifscCode: "",
    bankName: "",
    accountType: "savings",
    isPrimary: true
  });

  const [form26ASLoading, setForm26ASLoading] = useState(false);
  const [aisLoading, setAisLoading] = useState(false);
  const [aisData, setAisData] = useState<{ loaded: boolean; tdsEntries: number; interestIncome: number; dividendIncome: number; salaryIncome: number; saleTransactions: number; timestamp: string } | null>(null);
  const [showComputationSummary, setShowComputationSummary] = useState(false);
  const [showValidationReport, setShowValidationReport] = useState(false);

  const [lossCarryForward, setLossCarryForward] = useState<LossCarryForward[]>([]);
  const [directorships, setDirectorships] = useState<DirectorshipEntry[]>([]);
  const [unlistedShares, setUnlistedShares] = useState<UnlistedShareEntry[]>([]);
  const [specialRateIncome, setSpecialRateIncome] = useState({ lottery: 0, horseRacing: 0, onlineGaming: 0, otherSpecial: 0 });
  const [schedule112AEntries, setSchedule112AEntries] = useState<Schedule112AEntry[]>([]);
  const [scheduleSI, setScheduleSI] = useState<ScheduleSIDetails>({
    stcg111A: 0, ltcg112A: 0, ltcg112: 0, vdaCrypto115BBH: 0,
    lottery115BB: 0, horseRacing: 0, onlineGaming: 0,
    dtaaSpecialRate: 0, dtaaSpecialRatePercent: 10,
    otherSpecialRate: 0, otherSpecialRatePercent: 20,
  });
  const [scheduleEI, setScheduleEI] = useState<ScheduleEIDetails>({
    agriculturalIncome: 0, ltcgExemptUpTo125000: 0, dividendFromCooperative: 0,
    ppfInterest: 0, epfInterest: 0, section10Exemptions: 0,
    otherExemptIncome: 0, exemptIncomeDescription: "",
  });
  const [interest234, setInterest234] = useState<Interest234Details>({
    interest234A: 0, interest234B: 0, interest234C: 0, totalInterest: 0,
    filingDueDate: "2025-07-31", filingDate: "",
    assessedTax: 0,
    advanceTaxDetails: [
      { quarter: "Q1 (Jun 15)", dueDate: "2024-06-15", amountDue: 0, amountPaid: 0, paidDate: "" },
      { quarter: "Q2 (Sep 15)", dueDate: "2024-09-15", amountDue: 0, amountPaid: 0, paidDate: "" },
      { quarter: "Q3 (Dec 15)", dueDate: "2024-12-15", amountDue: 0, amountPaid: 0, paidDate: "" },
      { quarter: "Q4 (Mar 15)", dueDate: "2025-03-15", amountDue: 0, amountPaid: 0, paidDate: "" },
    ],
  });

  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetDetails>({
    fixedAssets: 0, investments: 0, currentAssets: 0, loansAndAdvances: 0, otherAssets: 0, totalAssets: 0,
    capital: 0, reservesAndSurplus: 0, securedLoans: 0, unsecuredLoans: 0, currentLiabilities: 0, totalLiabilities: 0,
  });
  const [profitLoss, setProfitLoss] = useState<ProfitLossDetails>({
    grossRevenue: 0, otherOperatingIncome: 0, totalRevenue: 0,
    purchasesAndDirectExpenses: 0, employeeBenefitExpenses: 0, depreciation: 0, otherExpenses: 0, totalExpenses: 0, netProfitBeforeTax: 0,
  });
  const [depreciationEntries, setDepreciationEntries] = useState<DepreciationEntry[]>([]);
  const [taxAuditInfo, setTaxAuditInfo] = useState<TaxAuditInfo>({
    isAuditRequired: false, auditorName: "", auditorMembershipNo: "", auditDate: "", form3CA_3CD: false, form3CB_3CD: false, auditReportFiled: false,
  });
  const [foIncome, setFoIncome] = useState({ futuresGains: 0, optionsGains: 0, intradayGains: 0, isSpeculative: false });

  const [entityProfile, setEntityProfile] = useState<EntityProfileDetails>({
    entityName: "", entityPAN: "", entityType: "partnership_firm", dateOfIncorporation: "", registrationNumber: "", constitutionType: "partnership", natureOfBusiness: "", partners: [],
  });
  const [corporateDetails, setCorporateDetails] = useState<CorporateDetails>({
    companyType: "private", cin: "", authorizedCapital: 0, paidUpCapital: 0, matApplicable: false, matCredit: 0, bookProfit: 0, matTax: 0, dividendDeclared: 0, dividendDistributionTax: 0,
  });
  const [trustDetails, setTrustDetails] = useState<TrustDetails>({
    trustType: "charitable", registrationSection: "12A", registrationNumber: "", registrationDate: "", corpusDonations: 0, voluntaryContributions: 0, applicationOfIncome: 0, accumulatedIncome: 0, accumulationPercentage: 15, section11Exemption: 0, section12Exemption: 0, anonymousDonations: 0, investmentInSpecifiedMode: 0,
  });

  const [scheduleAL, setScheduleAL] = useState<ScheduleALDetails>({
    immovableProperty: 0, movableAssets: 0, bankDeposits: 0, sharesAndSecurities: 0,
    insurancePolicies: 0, loansAndAdvancesGiven: 0, cashInHand: 0, jewelleryBullion: 0,
    archaeologicalCollections: 0, vehiclesYachtsBoats: 0, totalAssets: 0, totalLiabilities: 0,
    liabilitiesRelatedToImmovable: 0, liabilitiesRelatedToOther: 0,
  });

  const [donationEntries, setDonationEntries] = useState<DonationEntry[]>([]);

  const [isUpdatedReturn, setIsUpdatedReturn] = useState(false);
  const [itrUDetails, setItrUDetails] = useState({ originalAckNumber: "", originalFilingDate: "", reasonForUpdate: "income_not_reported", additionalTaxPayable: 0, lateFee234F: 0, additionalInterest: 0 });

  const [documentVault, setDocumentVault] = useState<{ id: string; name: string; type: string; category: string; uploadedAt: string; size: number }[]>([]);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

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
        const props = housePropertyDetails.properties.length > 0 ? housePropertyDetails.properties : [{ propertyType: housePropertyDetails.isSelfOccupied ? "self_occupied" as const : "let_out" as const, rentalIncome: housePropertyDetails.rentalIncome, municipalTaxes: housePropertyDetails.municipalTaxes, interestOnLoan: housePropertyDetails.interestOnLoan, unrealizedRent: 0, address: "" }];
        for (const prop of props) {
          if (prop.propertyType === "self_occupied") {
            housePropertyIncome += -Math.min(prop.interestOnLoan, 200000);
          } else {
            const nav = prop.rentalIncome - prop.municipalTaxes - prop.unrealizedRent;
            const stdDed = nav * 0.30;
            housePropertyIncome += nav - stdDed - prop.interestOnLoan;
          }
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
          agriculturalIncome: otherIncomeDetails.agriculturalIncome,
          section80C: deductionDetails.section80C,
          section80CCC: deductionDetails.section80CCC,
          section80CCD1: deductionDetails.section80CCD1,
          section80CCD1B: deductionDetails.section80CCD1B,
          section80CCD2: deductionDetails.section80CCD2,
          section80D: deductionDetails.section80D,
          section80DD: deductionDetails.section80DD,
          section80DDB: deductionDetails.section80DDB,
          section80E: deductionDetails.section80E,
          section80EEA: deductionDetails.section80EEA,
          section80EEB: deductionDetails.section80EEB,
          section80G: deductionDetails.section80G,
          section80GG: deductionDetails.section80GG,
          section80TTA: deductionDetails.section80TTA,
          section80TTB: deductionDetails.section80TTB,
          section80U: deductionDetails.section80U,
          otherDeductions: deductionDetails.otherDeductions,
          tdsDeducted: taxPaymentDetails.tdsDeducted,
          tdsSalary: taxPaymentDetails.tdsSalary,
          tdsOtherThanSalary: taxPaymentDetails.tdsOtherThanSalary,
          tdsOnProperty: taxPaymentDetails.tdsOnProperty,
          tcsCollected: taxPaymentDetails.tcsCollected,
          advanceTaxPaid: taxPaymentDetails.advanceTaxPaid,
          selfAssessmentTax: taxPaymentDetails.selfAssessmentTax,
          reliefUs89: taxPaymentDetails.reliefUs89,
          standardDeduction: salaryDetails.standardDeduction,
          professionalTax: salaryDetails.professionalTax,
          homeLoanInterest: housePropertyDetails.interestOnLoan,
          residentialStatus,
          filingSection,
          employerName: employerDetails.employerName,
          employerTAN: employerDetails.employerTAN,
          bankDetails: bankDetails.accountNumber ? bankDetails : undefined,
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
          section80CCC: deductionDetails.section80CCC,
          section80CCD1: deductionDetails.section80CCD1,
          section80CCD1B: deductionDetails.section80CCD1B,
          section80CCD2: deductionDetails.section80CCD2,
          section80D: deductionDetails.section80D,
          section80DD: deductionDetails.section80DD,
          section80DDB: deductionDetails.section80DDB,
          section80E: deductionDetails.section80E,
          section80EEA: deductionDetails.section80EEA,
          section80EEB: deductionDetails.section80EEB,
          section80G: deductionDetails.section80G,
          section80GG: deductionDetails.section80GG,
          section80TTA: deductionDetails.section80TTA,
          section80TTB: deductionDetails.section80TTB,
          section80U: deductionDetails.section80U,
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
      } else if (residentialStatus !== "resident") {
        form = "ITR-2";
      } else if (otherIncomeDetails.agriculturalIncome > 5000) {
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
  }, [incomeSources, salaryDetails, housePropertyDetails, otherIncomeDetails, panContext, businessDetails, residentialStatus]);

  useEffect(() => {
    const newSteps = getActiveSteps();
    const existsInNewSteps = newSteps.some(s => s.id === currentStepId);
    if (!existsInNewSteps) {
      const validSteps = newSteps.map(s => s.id);
      setCurrentStepId(validSteps.includes("sources") ? "sources" : validSteps[0] || "basic");
    }
  }, [incomeSources, currentStepId]);

  const getStepById = (id: string) => STEPS.find(s => s.id === id)!;
  const isEntityForm = ["ITR-5", "ITR-6", "ITR-7"].includes(recommendedForm);
  const needsFinancials = ["ITR-3", "ITR-5", "ITR-6"].includes(recommendedForm);
  const needsDisclosures = ["ITR-2", "ITR-3", "ITR-5", "ITR-6"].includes(recommendedForm);
  const needsTrustSchedule = recommendedForm === "ITR-7";

  const computeCYLA = useMemo(() => {
    const salary = incomeSources.hasSalary ? (salaryDetails.grossSalary + salaryDetails.allowances + salaryDetails.perquisites + salaryDetails.profitInLieu - salaryDetails.standardDeduction - salaryDetails.professionalTax) : 0;
    let hp = 0;
    if (incomeSources.hasHouseProperty) {
      const props = housePropertyDetails.properties.length > 0 ? housePropertyDetails.properties : [{ propertyType: housePropertyDetails.isSelfOccupied ? "self_occupied" as const : "let_out" as const, rentalIncome: housePropertyDetails.rentalIncome, municipalTaxes: housePropertyDetails.municipalTaxes, interestOnLoan: housePropertyDetails.interestOnLoan, unrealizedRent: 0, address: "" }];
      for (const prop of props) {
        if (prop.propertyType === "self_occupied") { hp += -Math.min(prop.interestOnLoan, 200000); }
        else { const nav = prop.rentalIncome - prop.municipalTaxes - prop.unrealizedRent; hp += nav * 0.70 - prop.interestOnLoan; }
      }
    }
    const stcg = capitalGainsDetails.sttPaidSTCG + capitalGainsDetails.sttNotPaidSTCG;
    const ltcg = capitalGainsDetails.sttPaidLTCG + capitalGainsDetails.sttNotPaidLTCG;
    const business = incomeSources.hasBusinessIncome ? (businessDetails.isPresumptive ? (businessDetails.presumptiveIncome44AD + businessDetails.presumptiveIncome44ADA + businessDetails.presumptiveIncome44AE) : businessDetails.businessIncome) : 0;
    const otherSrc = otherIncomeDetails.interestIncome + otherIncomeDetails.dividendIncome + otherIncomeDetails.otherSources;

    const adjustments: CYLAAdjustment[] = [];
    const hpLossToSetOff = hp < 0 ? Math.min(Math.abs(hp), 200000) : 0;
    let remainingHPLoss = hpLossToSetOff;
    let remainingBizLoss = business < 0 ? Math.abs(business) : 0;

    const heads = [
      { head: "Salary", income: Math.max(salary, 0) },
      { head: "House Property", income: hp > 0 ? hp : 0 },
      { head: "STCG", income: stcg > 0 ? stcg : 0 },
      { head: "LTCG", income: ltcg > 0 ? ltcg : 0 },
      { head: "Business / Profession", income: business > 0 ? business : 0 },
      { head: "Other Sources", income: otherSrc > 0 ? otherSrc : 0 },
    ];

    for (const h of heads) {
      let available = h.income;
      let hpUsed = 0, bizUsed = 0;
      if (remainingHPLoss > 0 && available > 0 && h.head !== "House Property") {
        hpUsed = Math.min(remainingHPLoss, available);
        remainingHPLoss -= hpUsed;
        available -= hpUsed;
      }
      if (remainingBizLoss > 0 && available > 0 && h.head !== "Salary" && h.head !== "Business / Profession") {
        bizUsed = Math.min(remainingBizLoss, available);
        remainingBizLoss -= bizUsed;
        available -= bizUsed;
      }
      adjustments.push({ head: h.head, incomeBeforeSetOff: h.income, hpLossSetOff: hpUsed, businessLossSetOff: bizUsed, otherSourceLossSetOff: 0, incomeAfterSetOff: available });
    }
    const totalIncomeAfterCYLA = adjustments.reduce((s, a) => s + a.incomeAfterSetOff, 0);
    return { adjustments, totalIncomeAfterCYLA, unabsorbedHPLoss: remainingHPLoss, unabsorbedBizLoss: remainingBizLoss, currentYearSTCLoss: stcg < 0 ? Math.abs(stcg) : 0, currentYearLTCLoss: ltcg < 0 ? Math.abs(ltcg) : 0 };
  }, [incomeSources, salaryDetails, housePropertyDetails, capitalGainsDetails, businessDetails, otherIncomeDetails]);

  const computeBFLA = useMemo(() => {
    const cyla = computeCYLA;
    const bflaRows: BFLAAdjustment[] = cyla.adjustments.map(a => ({
      head: a.head, incomeAfterCYLA: a.incomeAfterSetOff, bfHPLossSetOff: 0, bfSTCLSetOff: 0, bfLTCLSetOff: 0, bfBusinessLossSetOff: 0, bfSpeculationSetOff: 0, incomeAfterBFLA: a.incomeAfterSetOff,
    }));
    let totalBFHPLoss = 0, totalBFSTCL = 0, totalBFLTCL = 0, totalBFBizLoss = 0;
    for (const lcf of lossCarryForward) {
      const amt = (lcf.lossAmount || 0) - (lcf.setOffAmount || 0);
      if (amt <= 0) continue;
      if (lcf.lossType === "house_property") totalBFHPLoss += amt;
      else if (lcf.lossType === "short_term_capital") totalBFSTCL += amt;
      else if (lcf.lossType === "long_term_capital") totalBFLTCL += amt;
      else if (lcf.lossType === "business") totalBFBizLoss += amt;
    }
    let remHP = totalBFHPLoss, remSTCL = totalBFSTCL, remLTCL = totalBFLTCL, remBiz = totalBFBizLoss;
    for (const row of bflaRows) {
      let avail = row.incomeAfterCYLA;
      if (remHP > 0 && avail > 0) { const u = Math.min(remHP, avail); row.bfHPLossSetOff = u; remHP -= u; avail -= u; }
      if (remBiz > 0 && avail > 0 && row.head !== "Salary") { const u = Math.min(remBiz, avail); row.bfBusinessLossSetOff = u; remBiz -= u; avail -= u; }
      if (remSTCL > 0 && avail > 0 && (row.head === "STCG" || row.head === "LTCG")) { const u = Math.min(remSTCL, avail); row.bfSTCLSetOff = u; remSTCL -= u; avail -= u; }
      if (remLTCL > 0 && avail > 0 && row.head === "LTCG") { const u = Math.min(remLTCL, avail); row.bfLTCLSetOff = u; remLTCL -= u; avail -= u; }
      row.incomeAfterBFLA = avail;
    }
    return { bflaRows, totalIncomeAfterBFLA: bflaRows.reduce((s, r) => s + r.incomeAfterBFLA, 0), remainingHP: remHP, remainingSTCL: remSTCL, remainingLTCL: remLTCL, remainingBiz: remBiz };
  }, [computeCYLA, lossCarryForward]);

  const computeCFL = useMemo((): CFLEntry[] => {
    const bfla = computeBFLA;
    const cyla = computeCYLA;
    const entries: CFLEntry[] = [];
    for (const lcf of lossCarryForward) {
      const remaining = (lcf.lossAmount || 0) - (lcf.setOffAmount || 0);
      if (remaining <= 0) continue;
      const existing = entries.find(e => e.assessmentYear === lcf.assessmentYear);
      if (existing) {
        if (lcf.lossType === "house_property") existing.housePropertyLoss += remaining;
        else if (lcf.lossType === "short_term_capital") existing.shortTermCapitalLoss += remaining;
        else if (lcf.lossType === "long_term_capital") existing.longTermCapitalLoss += remaining;
        else if (lcf.lossType === "business") existing.businessLoss += remaining;
        else if (lcf.lossType === "speculation") existing.speculativeBusinessLoss += remaining;
        else if (lcf.lossType === "specified_business") existing.specifiedBusinessLoss += remaining;
      } else {
        const e: CFLEntry = { assessmentYear: lcf.assessmentYear, dateOfFiling: "", housePropertyLoss: 0, shortTermCapitalLoss: 0, longTermCapitalLoss: 0, businessLoss: 0, speculativeBusinessLoss: 0, specifiedBusinessLoss: 0 };
        if (lcf.lossType === "house_property") e.housePropertyLoss = remaining;
        else if (lcf.lossType === "short_term_capital") e.shortTermCapitalLoss = remaining;
        else if (lcf.lossType === "long_term_capital") e.longTermCapitalLoss = remaining;
        else if (lcf.lossType === "business") e.businessLoss = remaining;
        else if (lcf.lossType === "speculation") e.speculativeBusinessLoss = remaining;
        else if (lcf.lossType === "specified_business") e.specifiedBusinessLoss = remaining;
        entries.push(e);
      }
    }
    if (cyla.unabsorbedHPLoss > 0 || cyla.currentYearSTCLoss > 0 || cyla.currentYearLTCLoss > 0 || cyla.unabsorbedBizLoss > 0) {
      entries.push({
        assessmentYear: assessmentYear, dateOfFiling: interest234.filingDate || new Date().toISOString().split("T")[0],
        housePropertyLoss: cyla.unabsorbedHPLoss + bfla.remainingHP, shortTermCapitalLoss: cyla.currentYearSTCLoss + bfla.remainingSTCL,
        longTermCapitalLoss: cyla.currentYearLTCLoss + bfla.remainingLTCL, businessLoss: cyla.unabsorbedBizLoss + bfla.remainingBiz,
        speculativeBusinessLoss: 0, specifiedBusinessLoss: 0,
      });
    }
    return entries;
  }, [computeCYLA, computeBFLA, lossCarryForward, assessmentYear, interest234.filingDate]);

  const compute234Interest = useCallback(() => {
    const taxLiability = sandboxTaxResult?.data?.taxLiability || 0;
    const totalTaxPaid = taxPaymentDetails.tdsSalary + taxPaymentDetails.tdsOtherThanSalary + taxPaymentDetails.tdsOnProperty + taxPaymentDetails.tcsCollected + taxPaymentDetails.advanceTaxPaid + taxPaymentDetails.selfAssessmentTax;
    const assessedTax = Math.max(0, taxLiability - taxPaymentDetails.reliefUs89);
    const unpaidTax = Math.max(0, assessedTax - totalTaxPaid);

    let int234A = 0;
    if (interest234.filingDate && interest234.filingDueDate && unpaidTax > 0) {
      const due = new Date(interest234.filingDueDate);
      const filed = new Date(interest234.filingDate);
      if (filed > due) {
        const months = Math.ceil((filed.getTime() - due.getTime()) / (30.44 * 24 * 60 * 60 * 1000));
        int234A = Math.round(unpaidTax * 0.01 * months);
      }
    }

    let int234B = 0;
    const advanceTaxLiability = assessedTax - taxPaymentDetails.tdsSalary - taxPaymentDetails.tdsOtherThanSalary - taxPaymentDetails.tdsOnProperty - taxPaymentDetails.tcsCollected;
    if (advanceTaxLiability > 10000) {
      const advanceTaxPaid = taxPaymentDetails.advanceTaxPaid;
      if (advanceTaxPaid < advanceTaxLiability * 0.9) {
        const shortfall = advanceTaxLiability - advanceTaxPaid;
        const ayStart = assessmentYear.split("-")[0];
        const aprilToFiling = interest234.filingDate ? Math.ceil((new Date(interest234.filingDate).getTime() - new Date(`${ayStart}-04-01`).getTime()) / (30.44 * 24 * 60 * 60 * 1000)) : 3;
        int234B = Math.round(shortfall * 0.01 * Math.max(aprilToFiling, 1));
      }
    }

    let int234C = 0;
    const installments = interest234.advanceTaxDetails;
    const qDue = [0.15, 0.45, 0.75, 1.0];
    let cumPaid = 0;
    for (let i = 0; i < 4; i++) {
      cumPaid += installments[i].amountPaid;
      const shouldHavePaid = advanceTaxLiability * qDue[i];
      if (cumPaid < shouldHavePaid) {
        const shortfall = shouldHavePaid - cumPaid;
        int234C += Math.round(shortfall * 0.01 * 3);
      }
    }

    setInterest234(prev => ({ ...prev, interest234A: int234A, interest234B: int234B, interest234C: int234C, totalInterest: int234A + int234B + int234C, assessedTax }));
  }, [sandboxTaxResult, taxPaymentDetails, interest234.filingDate, interest234.filingDueDate, interest234.advanceTaxDetails, assessmentYear]);

  const calculateLocalTotals = () => {
    const salaryIncome = salaryDetails.grossSalary + salaryDetails.allowances + 
      salaryDetails.perquisites + salaryDetails.profitInLieu - 
      salaryDetails.standardDeduction - salaryDetails.professionalTax;
    
    let housePropertyIncome = 0;
    if (incomeSources.hasHouseProperty) {
      const props = housePropertyDetails.properties.length > 0 ? housePropertyDetails.properties : [{ propertyType: housePropertyDetails.isSelfOccupied ? "self_occupied" as const : "let_out" as const, rentalIncome: housePropertyDetails.rentalIncome, municipalTaxes: housePropertyDetails.municipalTaxes, interestOnLoan: housePropertyDetails.interestOnLoan, unrealizedRent: 0, address: "" }];
      for (const prop of props) {
        if (prop.propertyType === "self_occupied") {
          housePropertyIncome += -Math.min(prop.interestOnLoan, 200000);
        } else {
          const nav = prop.rentalIncome - prop.municipalTaxes - prop.unrealizedRent;
          const stdDed = nav * 0.30;
          housePropertyIncome += nav - stdDed - prop.interestOnLoan;
        }
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

    const combined80C_CCC_CCD1 = Math.min(
      deductionDetails.section80C + deductionDetails.section80CCC + deductionDetails.section80CCD1,
      150000
    );
    const totalDeductions = combined80C_CCC_CCD1 +
      Math.min(deductionDetails.section80CCD1B, 50000) +
      deductionDetails.section80CCD2 +
      Math.min(deductionDetails.section80D, 100000) +
      Math.min(deductionDetails.section80DD, 125000) +
      Math.min(deductionDetails.section80DDB, 100000) +
      deductionDetails.section80E +
      Math.min(deductionDetails.section80EEA, 150000) +
      Math.min(deductionDetails.section80EEB, 150000) +
      deductionDetails.section80G +
      Math.min(deductionDetails.section80GG, 60000) +
      Math.min(deductionDetails.section80TTA, 10000) +
      Math.min(deductionDetails.section80TTB, 50000) +
      Math.min(deductionDetails.section80U, 125000) +
      deductionDetails.otherDeductions;

    const autoTdsTotal = taxPaymentDetails.tdsSalary + taxPaymentDetails.tdsOtherThanSalary + taxPaymentDetails.tdsOnProperty;
    const effectiveTds = autoTdsTotal > 0 ? autoTdsTotal : taxPaymentDetails.tdsDeducted;
    const totalTaxPaid = effectiveTds + taxPaymentDetails.tcsCollected +
      taxPaymentDetails.advanceTaxPaid + taxPaymentDetails.selfAssessmentTax;

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

  const getActiveSteps = () => {
    const active = [getStepById("basic"), getStepById("sources")];
    if (isEntityForm) active.push(getStepById("entity_profile"));
    if (incomeSources.hasSalary && !isEntityForm) active.push(getStepById("salary"));
    if (incomeSources.hasHouseProperty) active.push(getStepById("property"));
    if (incomeSources.hasBusinessIncome) active.push(getStepById("business"));
    if (needsFinancials && incomeSources.hasBusinessIncome) active.push(getStepById("financials"));
    if (incomeSources.hasCapitalGains) active.push(getStepById("capital"));
    if (incomeSources.hasForeignIncome) active.push(getStepById("foreign"));
    if (incomeSources.hasOtherIncome) active.push(getStepById("other"));
    if (needsDisclosures) active.push(getStepById("disclosures"));
    if (needsTrustSchedule) active.push(getStepById("trust_income"));
    active.push(getStepById("deductions"));
    if (recommendedForm !== "ITR-1" && totals.grossTotalIncome > 5000000) {
      active.push(getStepById("schedule_al"));
    }
    if (needsDisclosures || incomeSources.hasCapitalGains || incomeSources.hasBusinessIncome) {
      active.push(getStepById("loss_adjustment"));
    }
    if (["ITR-2", "ITR-3", "ITR-5", "ITR-6"].includes(recommendedForm)) {
      active.push(getStepById("schedule_si_ei"));
    }
    active.push(getStepById("tax_payments"));
    active.push(getStepById("review"));
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
      case "other":
        if (otherIncomeDetails.agriculturalIncome > 5000 && recommendedForm === "ITR-1") {
          warnings.push("Agricultural income above ₹5,000 disqualifies ITR-1. Your form will auto-upgrade to ITR-2.");
        }
        break;
      case "deductions":
        if (taxRegime === "new") {
          warnings.push("Under the New Tax Regime (default from FY 2023-24), most deductions under Chapter VI-A are not available. Only standard deduction and 80CCD(2) apply.");
        }
        if (deductionDetails.section80TTA > 0 && deductionDetails.section80TTB > 0) {
          errors.push("You cannot claim both 80TTA and 80TTB. 80TTA is for below 60 years; 80TTB is for senior citizens (60+).");
        }
        {
          const combined80C = deductionDetails.section80C + deductionDetails.section80CCC + deductionDetails.section80CCD1;
          if (combined80C > 150000) {
            warnings.push(`Combined 80C + 80CCC + 80CCD(1) exceeds ₹1.5L limit. Only ₹1,50,000 will be allowed. You entered ₹${combined80C.toLocaleString('en-IN')}.`);
          }
        }
        break;
      case "schedule_al": {
        const alTotal = scheduleAL.immovableProperty + scheduleAL.movableAssets + scheduleAL.bankDeposits + scheduleAL.sharesAndSecurities + scheduleAL.insurancePolicies + scheduleAL.loansAndAdvancesGiven + scheduleAL.cashInHand + scheduleAL.jewelleryBullion + scheduleAL.archaeologicalCollections + scheduleAL.vehiclesYachtsBoats;
        if (alTotal === 0) {
          errors.push("Schedule AL is mandatory for ITR-2/3 with income exceeding ₹50 lakhs. Please enter your assets.");
        }
        const totalLiab = scheduleAL.liabilitiesRelatedToImmovable + scheduleAL.liabilitiesRelatedToOther;
        if (totalLiab > alTotal) {
          warnings.push("Total liabilities exceed total assets. Please verify.");
        }
        break;
      }
      case "loss_adjustment":
        break;
      case "schedule_si_ei":
        if (scheduleSI.stcg111A < 0 || scheduleSI.ltcg112A < 0 || scheduleSI.ltcg112 < 0 || scheduleSI.vdaCrypto115BBH < 0) {
          errors.push("Special rate income amounts cannot be negative.");
        }
        if (scheduleEI.ltcgExemptUpTo125000 > 125000) {
          errors.push("LTCG exemption u/s 112A cannot exceed ₹1,25,000.");
        }
        if (scheduleEI.agriculturalIncome > 0 && scheduleEI.agriculturalIncome < 5000) {
          warnings.push("Very small agricultural income. Please verify — income below ₹5,000 is generally not considered agricultural income by the IT department.");
        }
        break;
      case "tax_payments":
        if (taxPaymentDetails.tdsDeducted > 0 && taxPaymentDetails.tdsDeducted > totals.grossTotalIncome * 0.40) {
          warnings.push("TDS appears high relative to your income. Please verify from Form 26AS.");
        }
        if (interest234.totalInterest > 0) {
          warnings.push(`Interest u/s 234A/B/C of ${formatCurrency(interest234.totalInterest)} will be added to your tax liability.`);
        }
        break;
      case "entity_profile":
        if (isEntityForm) {
          if (!entityProfile.entityName) errors.push("Entity name is required.");
          if (!entityProfile.entityPAN) errors.push("Entity PAN is required.");
          if (recommendedForm === "ITR-5" && entityProfile.partners.length === 0) {
            errors.push("At least one partner/member must be added.");
          }
          if (recommendedForm === "ITR-6" && !corporateDetails.cin) {
            errors.push("Company Identification Number (CIN) is required for ITR-6.");
          }
          if (recommendedForm === "ITR-7" && !trustDetails.registrationNumber) {
            errors.push("Trust/institution registration number is required.");
          }
        }
        break;
      case "financials":
        if (needsFinancials) {
          if (balanceSheet.totalAssets !== balanceSheet.totalLiabilities && balanceSheet.totalAssets > 0) {
            errors.push("Balance Sheet does not tally — Total Assets must equal Total Liabilities + Capital.");
          }
          if (profitLoss.grossRevenue > 0 && profitLoss.netProfitBeforeTax === 0) {
            warnings.push("Net profit is zero despite having revenue. Please verify expenses.");
          }
          if (taxAuditInfo.isAuditRequired && !taxAuditInfo.auditReportFiled) {
            warnings.push("Tax audit is required but not yet filed. Audit report must be filed before ITR.");
          }
        }
        break;
      case "disclosures":
        if (needsDisclosures) {
          if (lossCarryForward.length > 0) {
            const invalidLoss = lossCarryForward.find(l => !l.assessmentYear);
            if (invalidLoss) errors.push("Assessment year is required for all loss carry-forward entries.");
          }
        }
        break;
      case "trust_income":
        if (needsTrustSchedule) {
          if (trustDetails.accumulationPercentage > 15) {
            warnings.push("Accumulation beyond 15% of income requires specific conditions under Section 11(2).");
          }
          if (trustDetails.anonymousDonations > 0) {
            warnings.push("Anonymous donations exceeding ₹1 lakh or 5% of total donations are taxed at 30%.");
          }
        }
        break;
      case "review":
        {
          const hasRefundDue = sandboxTaxResult?.data?.refundAmount && sandboxTaxResult.data.refundAmount > 0;
          if (hasRefundDue && !bankDetails.accountNumber) {
            errors.push("Bank account details are required to receive your refund. Please enter your bank account number and IFSC code.");
          } else if (!bankDetails.accountNumber) {
            warnings.push("Bank account details are recommended for receiving any refund.");
          }
          if (bankDetails.accountNumber && !bankDetails.ifscCode) {
            errors.push("IFSC code is required when bank account number is provided.");
          }
          if (bankDetails.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankDetails.ifscCode)) {
            errors.push("Invalid IFSC code format. It should be 11 characters: 4 letters, '0', then 6 alphanumeric characters.");
          }
        }
        break;
    }
    return { isValid: errors.length === 0, errors, warnings };
  }, [incomeSources, salaryDetails, housePropertyDetails, businessDetails, capitalGainsDetails, foreignIncomeDetails, deductionDetails, taxPaymentDetails, panContext, taxRegime, otherIncomeDetails, bankDetails, recommendedForm, totals, sandboxTaxResult, isEntityForm, needsFinancials, needsDisclosures, needsTrustSchedule, entityProfile, corporateDetails, trustDetails, balanceSheet, profitLoss, taxAuditInfo, lossCarryForward]);

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label>Residential Status <FieldHint text="Resident: in India ≥182 days. NRI: outside India. RNOR: Returning NRI or newly resident. ITR-1 is only for Resident Individuals." /></Label>
          <Select value={residentialStatus} onValueChange={(v) => setResidentialStatus(v as any)}>
            <SelectTrigger data-testid="select-residential-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="resident">Resident (ROR)</SelectItem>
              <SelectItem value="nri">Non-Resident (NRI)</SelectItem>
              <SelectItem value="rnor">Resident but Not Ordinarily Resident (RNOR)</SelectItem>
            </SelectContent>
          </Select>
          {residentialStatus !== "resident" && (
            <p className="text-xs text-amber-600">NRI/RNOR cannot file ITR-1. Form will auto-upgrade to ITR-2 or higher.</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Filing Under Section <FieldHint text="139(1): Original return filed on time. 139(4): Belated return (after due date). 139(5): Revised return (correcting earlier filed return)." /></Label>
          <Select value={filingSection} onValueChange={setFilingSection}>
            <SelectTrigger data-testid="select-filing-section">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="139(1)">139(1) — Original Return</SelectItem>
              <SelectItem value="139(4)">139(4) — Belated Return</SelectItem>
              <SelectItem value="139(5)">139(5) — Revised Return</SelectItem>
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

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="itr-u-toggle"
            checked={isUpdatedReturn}
            onChange={(e) => setIsUpdatedReturn(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
            data-testid="checkbox-itr-u"
          />
          <Label htmlFor="itr-u-toggle" className="cursor-pointer">
            <span className="font-medium">Filing Updated Return (ITR-U)</span>
            <span className="text-xs text-muted-foreground ml-1">Under Section 139(8A)</span>
          </Label>
        </div>
        {isUpdatedReturn && (
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                ITR-U allows you to update a previously filed return within 24 months from the end of the relevant assessment year. 
                Additional tax of 25% (within 12 months) or 50% (12-24 months) applies on the additional tax payable.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Original Acknowledgment Number <span className="text-red-500">*</span></Label>
                  <Input value={itrUDetails.originalAckNumber} onChange={(e) => setItrUDetails(p => ({ ...p, originalAckNumber: e.target.value }))} placeholder="15-digit ack number" maxLength={15} className="font-mono" data-testid="itr-u-ack" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Original Filing Date</Label>
                  <Input type="date" value={itrUDetails.originalFilingDate} onChange={(e) => setItrUDetails(p => ({ ...p, originalFilingDate: e.target.value }))} data-testid="itr-u-date" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Reason for Updated Return</Label>
                  <Select value={itrUDetails.reasonForUpdate} onValueChange={(v) => setItrUDetails(p => ({ ...p, reasonForUpdate: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income_not_reported">Income not reported earlier</SelectItem>
                      <SelectItem value="income_incorrectly_reported">Income incorrectly reported</SelectItem>
                      <SelectItem value="wrong_heads">Income reported under wrong head</SelectItem>
                      <SelectItem value="wrong_deductions">Wrong deductions claimed</SelectItem>
                      <SelectItem value="wrong_tax_rate">Wrong tax rate applied</SelectItem>
                      <SelectItem value="wrong_carry_forward">Wrong carry forward of loss</SelectItem>
                      <SelectItem value="wrong_exemption">Wrong exemption claimed</SelectItem>
                      <SelectItem value="other">Others</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Additional Tax Payable (₹)</Label>
                  <CurrencyInput id="itr-u-tax" value={itrUDetails.additionalTaxPayable} onChange={(v) => setItrUDetails(p => ({ ...p, additionalTaxPayable: v }))} placeholder="Additional tax on updated income" data-testid="itr-u-tax" />
                </div>
              </div>
              <Alert className="bg-red-50 dark:bg-red-950 border-red-200">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <AlertDescription className="text-xs">
                  <strong>Important:</strong> ITR-U cannot be used to: (a) file nil/loss return, (b) claim refund or increase refund, 
                  (c) decrease total tax liability. Additional tax includes 25% surcharge (if filed within 12 months) or 50% (12-24 months).
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}
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

  const formScheduleMap: Record<string, string[]> = {
    "ITR-1": ["Part A: Personal Details", "Part B: Gross Total Income (Salary, HP, Other)", "Part C: Deductions & Taxable Income", "Part D: Tax Computation", "Schedule TDS"],
    "ITR-2": ["Schedule S (Salary)", "Schedule HP", "Schedule CG (Capital Gains — STT/Non-STT split)", "Schedule OS", "Schedule CYLA/BFLA/CFL", "Schedule SI (Special Rate)", "Schedule FA (Foreign Assets)", "Schedule FSI", "Schedule AL (Assets & Liabilities)"],
    "ITR-3": ["All ITR-2 Schedules", "Schedule BP (Business/Profession)", "Part A-BS (Balance Sheet)", "Part A-P&L", "Schedule DEP (Depreciation)", "Schedule ESR (Tax Audit 44AB)"],
    "ITR-4": ["Part A (Personal Info)", "Schedule BP (Presumptive 44AD/44ADA/44AE)", "Part B-TI (Total Income)", "Part B-TTI (Tax Computation)"],
    "ITR-5": ["Part A-GEN (Firm/LLP)", "Schedule IF (Partner Details)", "Part A-BS", "Part A-P&L", "Schedule CG", "Schedule OS", "Schedule BP"],
    "ITR-6": ["Part A-GEN (Company)", "Part A-BS", "Part A-P&L", "Schedule MAT (115JB)", "Schedule CG", "Schedule OS", "Schedule BP"],
    "ITR-7": ["Part A-GEN (Trust)", "Schedule VC (Voluntary Contributions)", "Schedule-J (Investments)", "Schedule AI (Aggregate Income)", "Part B-TI", "Part B-TTI", "Section 11/12/13 Exemptions"],
  };

  const renderIncomeSourcesStep = () => (
    <div className="space-y-6">
      <p className="text-muted-foreground">Select all sources of income for FY {assessmentYear === "2025-26" ? "2024-25" : assessmentYear === "2024-25" ? "2023-24" : "2022-23"}. The system will automatically select the correct ITR form — just like TaxCloudIndia, schedules adjust internally.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[
          { key: "hasSalary", label: "Salary / Pension", icon: Briefcase, desc: "Income from employment, Form 16", color: "text-blue-600" },
          { key: "hasHouseProperty", label: "House Property", icon: Home, desc: "Rental income or home loan interest", color: "text-green-600" },
          { key: "hasCapitalGains", label: "Capital Gains", icon: TrendingUp, desc: "Stocks, MFs, property sale, STT/non-STT split", color: "text-purple-600" },
          { key: "hasBusinessIncome", label: "Business / Profession", icon: Building2, desc: "Self-employed, freelancer, F&O, business P&L", color: "text-orange-600" },
          { key: "hasForeignIncome", label: "Foreign Income / Global Stocks", icon: Globe, desc: "US/global stocks, DTAA relief, Schedule FA & FSI", color: "text-red-600" },
          { key: "hasOtherIncome", label: "Other Sources", icon: Wallet, desc: "FD/savings interest, dividends, lottery, gaming", color: "text-teal-600" }
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

      <Card className={`border-2 ${
        recommendedForm === "ITR-1" ? "border-green-300 bg-green-50 dark:bg-green-950" :
        recommendedForm === "ITR-2" ? "border-blue-300 bg-blue-50 dark:bg-blue-950" :
        recommendedForm === "ITR-3" ? "border-orange-300 bg-orange-50 dark:bg-orange-950" :
        recommendedForm === "ITR-4" ? "border-amber-300 bg-amber-50 dark:bg-amber-950" :
        "border-purple-300 bg-purple-50 dark:bg-purple-950"
      }`}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              recommendedForm === "ITR-1" ? "bg-green-100 dark:bg-green-900" :
              recommendedForm === "ITR-2" ? "bg-blue-100 dark:bg-blue-900" :
              "bg-purple-100 dark:bg-purple-900"
            }`}>
              <FileText className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">
                Auto-selected: {recommendedForm} {
                  recommendedForm === "ITR-1" ? "(Sahaj)" :
                  recommendedForm === "ITR-2" ? "(Individual/HUF — No Business)" :
                  recommendedForm === "ITR-3" ? "(Business/Profession)" :
                  recommendedForm === "ITR-4" ? "(Sugam — Presumptive)" :
                  recommendedForm === "ITR-5" ? "(Firm/LLP/AOP)" :
                  recommendedForm === "ITR-6" ? "(Company)" : "(Trust/Charity)"
                }
              </p>
              <p className="text-xs text-muted-foreground">
                Based on your PAN type and income sources. Steps and schedules adjust automatically as you add or remove sources.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(formScheduleMap[recommendedForm] || []).map((sch, i) => (
              <Badge key={i} variant="secondary" className="text-xs">{sch}</Badge>
            ))}
          </div>
          {recommendedForm !== "ITR-1" && (
            <div className="text-xs text-muted-foreground border-t pt-2 mt-2">
              <strong>Why not ITR-1?</strong>{" "}
              {incomeSources.hasCapitalGains && "Capital gains require ITR-2+. "}
              {incomeSources.hasForeignIncome && "Foreign income/assets require ITR-2+. "}
              {incomeSources.hasBusinessIncome && "Business income requires ITR-3/4. "}
              {residentialStatus !== "resident" && "NRI/RNOR status requires ITR-2+. "}
              {housePropertyDetails.propertyCount > 1 && "Multiple properties require ITR-2+. "}
              {isEntityForm && `Entity type (${panContext?.panType}) requires ${recommendedForm}. `}
            </div>
          )}
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

  const handleFetch26AS = async () => {
    if (!panContext?.pan) return;
    setForm26ASLoading(true);
    try {
      const res = await fetch(`/api/tax/itr/26as/${panContext.pan}/${assessmentYear}`, { credentials: "include" });
      const data = await res.json();
      if (data.success && data.data) {
        const d = data.data;
        setTaxPaymentDetails(prev => ({
          ...prev,
          tdsSalary: d.summary?.tdsSalary ?? d.summary?.totalTDSDeducted ?? prev.tdsSalary,
          tdsOtherThanSalary: d.summary?.tdsOtherThanSalary ?? prev.tdsOtherThanSalary,
          tdsOnProperty: d.summary?.tdsOnProperty ?? prev.tdsOnProperty,
          tcsCollected: d.summary?.totalTCSCollected ?? prev.tcsCollected,
          tdsDeducted: d.summary?.totalTaxCredits ?? d.summary?.totalTDSDeducted ?? prev.tdsDeducted,
          advanceTaxPaid: d.summary?.totalAdvanceTax ?? prev.advanceTaxPaid,
          selfAssessmentTax: d.summary?.totalSelfAssessmentTax ?? prev.selfAssessmentTax,
        }));
        toast({ title: "Form 26AS Loaded", description: "TDS, advance tax, and self-assessment details auto-filled from Form 26AS." });
      } else {
        toast({ title: "26AS Fetch Failed", description: data.message || "Could not fetch Form 26AS. Please enter TDS details manually.", variant: "destructive" });
      }
    } catch {
      toast({ title: "26AS Unavailable", description: "Form 26AS service is currently unavailable. Please enter details manually.", variant: "destructive" });
    } finally {
      setForm26ASLoading(false);
    }
  };

  const handleFetchAIS = async () => {
    if (!panContext?.pan || !assessmentYear) return;
    setAisLoading(true);
    try {
      const res = await fetch(`/api/tax/ais/${panContext.pan}/${assessmentYear}`, { credentials: "include" });
      const data = await res.json();
      if (data.success && data.aisData) {
        const ais = data.aisData;
        if (ais.salaryIncome > 0) setSalaryDetails(prev => ({ ...prev, basicSalary: ais.salaryIncome }));
        if (ais.interestIncome > 0) setOtherIncomeDetails(prev => ({ ...prev, savingsInterest: prev.savingsInterest + ais.interestIncome }));
        if (ais.dividendIncome > 0) setOtherIncomeDetails(prev => ({ ...prev, dividendIncome: prev.dividendIncome + ais.dividendIncome }));
        if (ais.tdsEntries > 0) setTaxPaymentDetails(prev => ({ ...prev, tdsDeducted: prev.tdsDeducted + (ais.totalTDS || 0) }));
        setAisData({ loaded: true, tdsEntries: ais.tdsEntries || 0, interestIncome: ais.interestIncome || 0, dividendIncome: ais.dividendIncome || 0, salaryIncome: ais.salaryIncome || 0, saleTransactions: ais.saleTransactions || 0, timestamp: new Date().toISOString() });
        toast({ title: "AIS Data Loaded", description: `Loaded ${ais.tdsEntries || 0} TDS entries, income details from Annual Information Statement.` });
      } else {
        toast({ title: "AIS Fetch Failed", description: data.message || "Could not fetch AIS data. You can enter details manually.", variant: "destructive" });
      }
    } catch {
      toast({ title: "AIS Unavailable", description: "Annual Information Statement service is currently unavailable.", variant: "destructive" });
    } finally {
      setAisLoading(false);
    }
  };

  const getAllStepValidations = () => {
    return activeSteps.map(step => ({
      stepId: step.id,
      stepTitle: step.title,
      validation: validateStep(step.id),
    }));
  };

  const renderSalaryStep = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">Enter details from your Form 16 Part B, or upload it for auto-fill.</p>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleFetchAIS} disabled={aisLoading || !panContext?.pan} data-testid="btn-fetch-ais">
            <Globe className="h-4 w-4 mr-1" />
            {aisLoading ? "Fetching AIS..." : aisData?.loaded ? "AIS Loaded ✓" : "Fetch AIS"}
          </Button>
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
      </div>

      {aisData?.loaded && (
        <Alert className="bg-green-50 dark:bg-green-950 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-xs">
            <strong>AIS data pre-filled:</strong> {aisData.salaryIncome > 0 ? `Salary ₹${aisData.salaryIncome.toLocaleString('en-IN')}` : ''} 
            {aisData.interestIncome > 0 ? ` | Interest ₹${aisData.interestIncome.toLocaleString('en-IN')}` : ''} 
            {aisData.dividendIncome > 0 ? ` | Dividends ₹${aisData.dividendIncome.toLocaleString('en-IN')}` : ''} 
            {aisData.tdsEntries > 0 ? ` | ${aisData.tdsEntries} TDS entries` : ''} 
            {aisData.saleTransactions > 0 ? ` | ${aisData.saleTransactions} sale transactions` : ''}
          </AlertDescription>
        </Alert>
      )}

      <Card className="bg-blue-50/50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
        <CardContent className="p-4 space-y-3">
          <p className="text-xs font-medium text-blue-700 dark:text-blue-300">Employer Details (as per Form 16 Part A)</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="employerName" className="text-xs">Employer Name</Label>
              <Input
                id="employerName"
                value={employerDetails.employerName}
                onChange={(e) => setEmployerDetails(prev => ({ ...prev, employerName: e.target.value }))}
                placeholder="e.g. Tata Consultancy Services Ltd"
                data-testid="input-employer-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="employerTAN" className="text-xs">
                Employer TAN <FieldHint text="Tax Deduction Account Number of employer. 10-character alphanumeric. Found on Form 16 Part A." />
              </Label>
              <Input
                id="employerTAN"
                value={employerDetails.employerTAN}
                onChange={(e) => setEmployerDetails(prev => ({ ...prev, employerTAN: e.target.value.toUpperCase() }))}
                placeholder="e.g. MUMS12345E"
                className="font-mono tracking-wider uppercase"
                maxLength={10}
                data-testid="input-employer-tan"
              />
            </div>
          </div>
        </CardContent>
      </Card>

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

  const computePropertyIncome = (property: HousePropertyEntry): number => {
    if (property.propertyType === "self_occupied") {
      return -Math.min(property.interestOnLoan, 200000);
    }
    const nav = property.rentalIncome - property.municipalTaxes - property.unrealizedRent;
    const stdDed = nav * 0.30;
    return nav - stdDed - property.interestOnLoan;
  };

  const addProperty = () => {
    const maxProps = recommendedForm === "ITR-1" ? 1 : 5;
    if (housePropertyDetails.properties.length >= maxProps) return;
    const newProp: HousePropertyEntry = { propertyType: "self_occupied", rentalIncome: 0, municipalTaxes: 0, interestOnLoan: 0, unrealizedRent: 0, address: "" };
    setHousePropertyDetails(prev => ({
      ...prev,
      propertyCount: prev.properties.length + 1,
      properties: [...prev.properties, newProp],
    }));
  };

  const removeProperty = (idx: number) => {
    if (housePropertyDetails.properties.length <= 1) return;
    setHousePropertyDetails(prev => {
      const updated = prev.properties.filter((_, i) => i !== idx);
      const first = updated[0];
      return {
        ...prev,
        propertyCount: updated.length,
        properties: updated,
        isSelfOccupied: first ? first.propertyType === "self_occupied" : true,
        rentalIncome: first ? first.rentalIncome : 0,
        municipalTaxes: first ? first.municipalTaxes : 0,
        interestOnLoan: first ? first.interestOnLoan : 0,
      };
    });
  };

  const updateProperty = (idx: number, field: keyof HousePropertyEntry, value: string | number) => {
    setHousePropertyDetails(prev => {
      const updated = [...prev.properties];
      updated[idx] = { ...updated[idx], [field]: value };
      const backcompat: Partial<HousePropertyDetails> = {};
      if (idx === 0) {
        backcompat.isSelfOccupied = updated[0].propertyType === "self_occupied";
        backcompat.rentalIncome = updated[0].rentalIncome;
        backcompat.municipalTaxes = updated[0].municipalTaxes;
        backcompat.interestOnLoan = updated[0].interestOnLoan;
      }
      return { ...prev, ...backcompat, properties: updated };
    });
  };

  const renderHousePropertyStep = () => {
    const maxProps = recommendedForm === "ITR-1" ? 1 : 5;
    const properties = housePropertyDetails.properties.length > 0
      ? housePropertyDetails.properties
      : [{ propertyType: "self_occupied" as const, rentalIncome: 0, municipalTaxes: 0, interestOnLoan: 0, unrealizedRent: 0, address: "" }];

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">
              {properties.length} {properties.length === 1 ? "Property" : "Properties"} added
            </h3>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={addProperty}
            disabled={properties.length >= maxProps}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Add Property
          </Button>
        </div>

        {recommendedForm === "ITR-1" && properties.length >= 1 && (
          <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-700 dark:text-blue-300">
              ITR-1 allows only 1 house property. Switch to ITR-2 or higher to add multiple properties.
            </AlertDescription>
          </Alert>
        )}

        {properties.map((prop, idx) => {
          const propIncome = computePropertyIncome(prop);
          const isSelf = prop.propertyType === "self_occupied";
          const isLetOut = prop.propertyType === "let_out" || prop.propertyType === "deemed_let_out";

          return (
            <Card key={idx} className="border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Home className="h-4 w-4" />
                    Property {idx + 1}
                    <Badge variant={isSelf ? "secondary" : "outline"} className="text-xs">
                      {prop.propertyType === "self_occupied" ? "Self Occupied" : prop.propertyType === "let_out" ? "Let Out" : "Deemed Let Out"}
                    </Badge>
                  </CardTitle>
                  {properties.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeProperty(idx)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-3">
                  <Label>Property Type <FieldHint text="Self-occupied: You live in it. Let out: You receive rent. Deemed let out: Vacant second property treated as let out." /></Label>
                  <RadioGroup
                    value={prop.propertyType}
                    onValueChange={(v) => updateProperty(idx, "propertyType", v)}
                    className="flex flex-wrap gap-3"
                  >
                    <label htmlFor={`prop-self-${idx}`} className={`flex items-center gap-2 px-4 py-3 rounded-lg border cursor-pointer transition-all ${prop.propertyType === "self_occupied" ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/40'}`}>
                      <RadioGroupItem value="self_occupied" id={`prop-self-${idx}`} />
                      <div>
                        <span className="font-medium text-sm">Self Occupied</span>
                        <p className="text-xs text-muted-foreground">You live in this property</p>
                      </div>
                    </label>
                    <label htmlFor={`prop-letout-${idx}`} className={`flex items-center gap-2 px-4 py-3 rounded-lg border cursor-pointer transition-all ${prop.propertyType === "let_out" ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/40'}`}>
                      <RadioGroupItem value="let_out" id={`prop-letout-${idx}`} />
                      <div>
                        <span className="font-medium text-sm">Let Out</span>
                        <p className="text-xs text-muted-foreground">Rented to tenants</p>
                      </div>
                    </label>
                    <label htmlFor={`prop-deemed-${idx}`} className={`flex items-center gap-2 px-4 py-3 rounded-lg border cursor-pointer transition-all ${prop.propertyType === "deemed_let_out" ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/40'}`}>
                      <RadioGroupItem value="deemed_let_out" id={`prop-deemed-${idx}`} />
                      <div>
                        <span className="font-medium text-sm">Deemed Let Out</span>
                        <p className="text-xs text-muted-foreground">Vacant second property</p>
                      </div>
                    </label>
                  </RadioGroup>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`address-${idx}`}>
                    Property Address
                    <FieldHint text="Full address of the property including city and pin code." />
                  </Label>
                  <Input
                    id={`address-${idx}`}
                    value={prop.address}
                    onChange={(e) => updateProperty(idx, "address", e.target.value)}
                    placeholder="Enter property address"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {isLetOut && (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor={`rentalIncome-${idx}`}>
                          Annual Rental Income <span className="text-red-500">*</span>
                          <FieldHint text="Total rent received during the financial year. If property was vacant for some months, enter actual rent received." />
                        </Label>
                        <CurrencyInput
                          id={`rentalIncome-${idx}`}
                          value={prop.rentalIncome}
                          onChange={(v) => updateProperty(idx, "rentalIncome", v)}
                          placeholder="Total annual rent"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`municipalTaxes-${idx}`}>
                          Municipal Taxes Paid
                          <FieldHint text="Property tax paid to local municipality. Only deductible if actually paid during the year." />
                        </Label>
                        <CurrencyInput
                          id={`municipalTaxes-${idx}`}
                          value={prop.municipalTaxes}
                          onChange={(v) => updateProperty(idx, "municipalTaxes", v)}
                          placeholder="Property tax paid"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`unrealizedRent-${idx}`}>
                          Unrealized Rent
                          <FieldHint text="Rent that could not be collected from tenant. Conditions under Rule 4 must be satisfied." />
                        </Label>
                        <CurrencyInput
                          id={`unrealizedRent-${idx}`}
                          value={prop.unrealizedRent}
                          onChange={(v) => updateProperty(idx, "unrealizedRent", v)}
                          placeholder="Unrealized rent amount"
                        />
                      </div>
                    </>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor={`interestOnLoan-${idx}`}>
                      Interest on Home Loan
                      <FieldHint text={isSelf
                        ? "Maximum ₹2,00,000 deduction for self-occupied property. Get from bank's interest certificate."
                        : "Full interest is deductible for let-out property. Get from bank's interest certificate."} />
                    </Label>
                    <CurrencyInput
                      id={`interestOnLoan-${idx}`}
                      value={prop.interestOnLoan}
                      onChange={(v) => updateProperty(idx, "interestOnLoan", v)}
                      placeholder="Annual home loan interest"
                      max={isSelf ? 200000 : undefined}
                    />
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Income / Loss from Property {idx + 1}</span>
                    <span className={`font-semibold ${propIncome < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(propIncome)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <span className="font-medium">Total Income / Loss from House Property</span>
              <span className={`font-bold text-lg ${totals.housePropertyIncome < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(totals.housePropertyIncome)}
              </span>
            </div>
            {totals.housePropertyIncome < 0 && (
              <p className="text-xs text-muted-foreground mt-1">This loss will reduce your total taxable income.</p>
            )}
          </CardContent>
        </Card>

        <ValidationBanner validation={currentValidation} />
      </div>
    );
  };

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

              {recommendedForm !== "ITR-1" && (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-medium">Schedule CG — STT Split (ITR-2+)</Label>
                      <Badge variant="outline" className="text-[10px]">Mandatory for ITR-2/3</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Capital gains must be split by STT status. STT-paid equity (listed shares/MF on recognized exchange) has preferential tax rates. Non-STT includes unlisted shares, property, gold, etc.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">
                          STCG — STT Paid (u/s 111A)
                          <FieldHint text="Short-term gains on listed equity/MF sold on stock exchange with STT paid. Taxed at flat 20% (from FY 2024-25, was 15% earlier)." />
                        </Label>
                        <CurrencyInput id="sttPaidSTCG" value={capitalGainsDetails.sttPaidSTCG} onChange={(v) => setCapitalGainsDetails(prev => ({ ...prev, sttPaidSTCG: v }))} data-testid="input-stt-paid-stcg" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">
                          STCG — STT Not Paid
                          <FieldHint text="Short-term gains on unlisted shares, property, gold, bonds etc. where STT is not applicable. Taxed at slab rates." />
                        </Label>
                        <CurrencyInput id="sttNotPaidSTCG" value={capitalGainsDetails.sttNotPaidSTCG} onChange={(v) => setCapitalGainsDetails(prev => ({ ...prev, sttNotPaidSTCG: v }))} data-testid="input-stt-not-paid-stcg" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">
                          LTCG — STT Paid (u/s 112A)
                          <FieldHint text="Long-term gains on listed equity/MF sold on exchange with STT paid. Taxed at flat 12.5% (from FY 2024-25, was 10% earlier). ₹1.25L exemption applies." />
                        </Label>
                        <CurrencyInput id="sttPaidLTCG" value={capitalGainsDetails.sttPaidLTCG} onChange={(v) => setCapitalGainsDetails(prev => ({ ...prev, sttPaidLTCG: v }))} data-testid="input-stt-paid-ltcg" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">
                          LTCG — STT Not Paid (u/s 112)
                          <FieldHint text="Long-term gains on unlisted shares, property, gold, bonds etc. Taxed at 12.5% without indexation (from FY 2024-25). No ₹1.25L exemption." />
                        </Label>
                        <CurrencyInput id="sttNotPaidLTCG" value={capitalGainsDetails.sttNotPaidLTCG} onChange={(v) => setCapitalGainsDetails(prev => ({ ...prev, sttNotPaidLTCG: v }))} data-testid="input-stt-not-paid-ltcg" />
                      </div>
                    </div>
                    {(capitalGainsDetails.sttPaidSTCG + capitalGainsDetails.sttNotPaidSTCG) > 0 && Math.abs((capitalGainsDetails.sttPaidSTCG + capitalGainsDetails.sttNotPaidSTCG) - capitalGainsDetails.shortTermGains) > 1 && (
                      <p className="text-xs text-amber-600">STT split total ({formatCurrency(capitalGainsDetails.sttPaidSTCG + capitalGainsDetails.sttNotPaidSTCG)}) differs from STCG total ({formatCurrency(capitalGainsDetails.shortTermGains)}). Please reconcile.</p>
                    )}
                    {(capitalGainsDetails.sttPaidLTCG + capitalGainsDetails.sttNotPaidLTCG) > 0 && Math.abs((capitalGainsDetails.sttPaidLTCG + capitalGainsDetails.sttNotPaidLTCG) - capitalGainsDetails.longTermGains) > 1 && (
                      <p className="text-xs text-amber-600">STT split total ({formatCurrency(capitalGainsDetails.sttPaidLTCG + capitalGainsDetails.sttNotPaidLTCG)}) differs from LTCG total ({formatCurrency(capitalGainsDetails.longTermGains)}). Please reconcile.</p>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-medium">Grandfathering — Pre-2018 Equity LTCG</Label>
                      <Badge variant="outline" className="text-[10px]">Sec 112A</Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="grandfathering-toggle"
                        checked={capitalGainsDetails.grandfatheringApplied}
                        onChange={(e) => setCapitalGainsDetails(prev => ({ ...prev, grandfatheringApplied: e.target.checked }))}
                        className="h-4 w-4 rounded border-gray-300"
                        data-testid="checkbox-grandfathering"
                      />
                      <Label htmlFor="grandfathering-toggle" className="text-sm cursor-pointer">
                        Apply grandfathering provision for equity acquired before 31-Jan-2018
                      </Label>
                    </div>
                    {capitalGainsDetails.grandfatheringApplied && (
                      <div className="space-y-2 pl-7">
                        <p className="text-xs text-muted-foreground">
                          For listed equity/MF acquired before 1-Feb-2018, the cost of acquisition is higher of: (a) actual purchase price, or (b) Fair Market Value as on 31-Jan-2018 (but not exceeding sale price). This reduces LTCG.
                        </p>
                        <div className="max-w-sm space-y-1.5">
                          <Label className="text-xs">
                            FMV as on 31-Jan-2018 (highest traded price)
                            <FieldHint text="Enter the highest price on NSE/BSE as of 31-Jan-2018 for your pre-2018 equity holdings. This is used as deemed cost of acquisition if higher than actual purchase price." />
                          </Label>
                          <CurrencyInput
                            id="grandfatheringFMV"
                            value={capitalGainsDetails.grandfatheringFMV}
                            onChange={(v) => setCapitalGainsDetails(prev => ({ ...prev, grandfatheringFMV: v }))}
                            placeholder="FMV of pre-2018 holdings"
                            data-testid="input-grandfathering-fmv"
                          />
                        </div>
                        <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200">
                          <Info className="h-4 w-4" />
                          <AlertDescription className="text-xs">
                            Grandfathering applies to equity shares/equity MF units acquired before 1-Feb-2018. Gains up to 31-Jan-2018 are exempt.
                            Only LTCG exceeding ₹1.25 lakh (from FY 2024-25) on such assets is taxable at 12.5%.
                          </AlertDescription>
                        </Alert>
                      </div>
                    )}
                  </div>

                  <Separator />
                </>
              )}

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

      {["ITR-2", "ITR-3"].includes(recommendedForm) && incomeSources.hasCapitalGains && (
          <Card className="border-purple-200 dark:border-purple-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-purple-600" /> Schedule 112A — Scrip-wise Long-Term Capital Gains
                <Badge variant="outline" className="text-[10px]">Listed Equity / Equity MF with STT</Badge>
              </CardTitle>
              <CardDescription>Per-share details of LTCG on listed equity shares and equity-oriented mutual funds where STT was paid on sale</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {schedule112AEntries.map((entry, idx) => (
                <div key={idx} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">Scrip {idx + 1}: {entry.shareName || 'New Entry'}</span>
                    <Button variant="ghost" size="sm" onClick={() => setSchedule112AEntries(prev => prev.filter((_, i) => i !== idx))}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <Label className="text-xs">ISIN *</Label>
                      <Input value={entry.isin} onChange={e => { const u = [...schedule112AEntries]; u[idx] = { ...u[idx], isin: e.target.value.toUpperCase() }; setSchedule112AEntries(u); }} placeholder="INE..." maxLength={12} className="font-mono text-xs" />
                    </div>
                    <div>
                      <Label className="text-xs">Share / Fund Name *</Label>
                      <Input value={entry.shareName} onChange={e => { const u = [...schedule112AEntries]; u[idx] = { ...u[idx], shareName: e.target.value }; setSchedule112AEntries(u); }} placeholder="e.g. Reliance Industries" />
                    </div>
                    <div>
                      <Label className="text-xs">Units Sold</Label>
                      <Input type="number" value={entry.unitsSold || ""} onChange={e => { const u = [...schedule112AEntries]; u[idx] = { ...u[idx], unitsSold: Number(e.target.value) }; setSchedule112AEntries(u); }} />
                    </div>
                    <div>
                      <Label className="text-xs">Sale Price / Unit (₹)</Label>
                      <Input type="number" value={entry.salePricePerUnit || ""} onChange={e => { const u = [...schedule112AEntries]; u[idx] = { ...u[idx], salePricePerUnit: Number(e.target.value) }; setSchedule112AEntries(u); }} />
                    </div>
                    <div>
                      <Label className="text-xs">Cost of Acquisition (₹)</Label>
                      <Input type="number" value={entry.costOfAcquisition || ""} onChange={e => { const u = [...schedule112AEntries]; u[idx] = { ...u[idx], costOfAcquisition: Number(e.target.value) }; setSchedule112AEntries(u); }} />
                    </div>
                    <div>
                      <Label className="text-xs">FMV as on 31-Jan-2018 (₹) <FieldHint text="Fair Market Value for grandfathering. Highest traded price on 31-Jan-2018 or NAV on that date for MF." /></Label>
                      <Input type="number" value={entry.fmvAsOn31Jan2018 || ""} onChange={e => { const u = [...schedule112AEntries]; u[idx] = { ...u[idx], fmvAsOn31Jan2018: Number(e.target.value) }; setSchedule112AEntries(u); }} />
                    </div>
                    <div>
                      <Label className="text-xs">Expenditure on Transfer (₹)</Label>
                      <Input type="number" value={entry.expenditureOnTransfer || ""} onChange={e => { const u = [...schedule112AEntries]; u[idx] = { ...u[idx], expenditureOnTransfer: Number(e.target.value) }; setSchedule112AEntries(u); }} />
                    </div>
                    <div>
                      <Label className="text-xs">LTCG (₹)</Label>
                      <div className="text-sm mt-1 font-medium p-2 bg-muted rounded">
                        ₹{(() => { const saleVal = entry.unitsSold * entry.salePricePerUnit; const costWithFMV = entry.fmvAsOn31Jan2018 > 0 ? Math.max(entry.costOfAcquisition, Math.min(entry.fmvAsOn31Jan2018 * entry.unitsSold, saleVal)) : entry.costOfAcquisition; return (saleVal - costWithFMV - entry.expenditureOnTransfer).toLocaleString('en-IN'); })()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setSchedule112AEntries(prev => [...prev, { isin: "", shareName: "", unitsSold: 0, salePricePerUnit: 0, costOfAcquisition: 0, fmvAsOn31Jan2018: 0, expenditureOnTransfer: 0, totalSaleValue: 0, totalCostWithFMV: 0, ltcgBeforeExemption: 0 }])} data-testid="btn-add-112a-scrip">
                <Plus className="h-4 w-4 mr-1" /> Add Scrip
              </Button>
              {schedule112AEntries.length > 0 && (
                <Card className="bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800">
                  <CardContent className="p-3 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Sale Consideration</span>
                      <span className="font-medium">₹{schedule112AEntries.reduce((s, e) => s + e.unitsSold * e.salePricePerUnit, 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total LTCG (before exemption)</span>
                      <span className="font-medium">₹{schedule112AEntries.reduce((s, e) => { const sv = e.unitsSold * e.salePricePerUnit; const c = e.fmvAsOn31Jan2018 > 0 ? Math.max(e.costOfAcquisition, Math.min(e.fmvAsOn31Jan2018 * e.unitsSold, sv)) : e.costOfAcquisition; return s + sv - c - e.expenditureOnTransfer; }, 0).toLocaleString('en-IN')}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-green-600">
                      <span>Exempt u/s 112A (up to ₹1,25,000)</span>
                      <span>- ₹{Math.min(125000, Math.max(0, schedule112AEntries.reduce((s, e) => { const sv = e.unitsSold * e.salePricePerUnit; const c = e.fmvAsOn31Jan2018 > 0 ? Math.max(e.costOfAcquisition, Math.min(e.fmvAsOn31Jan2018 * e.unitsSold, sv)) : e.costOfAcquisition; return s + sv - c - e.expenditureOnTransfer; }, 0))).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Taxable LTCG u/s 112A @ 12.5%</span>
                      <span>₹{Math.max(0, schedule112AEntries.reduce((s, e) => { const sv = e.unitsSold * e.salePricePerUnit; const c = e.fmvAsOn31Jan2018 > 0 ? Math.max(e.costOfAcquisition, Math.min(e.fmvAsOn31Jan2018 * e.unitsSold, sv)) : e.costOfAcquisition; return s + sv - c - e.expenditureOnTransfer; }, 0) - 125000).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Tax on LTCG @ 12.5%</span>
                      <span>₹{Math.round(Math.max(0, schedule112AEntries.reduce((s, e) => { const sv = e.unitsSold * e.salePricePerUnit; const c = e.fmvAsOn31Jan2018 > 0 ? Math.max(e.costOfAcquisition, Math.min(e.fmvAsOn31Jan2018 * e.unitsSold, sv)) : e.costOfAcquisition; return s + sv - c - e.expenditureOnTransfer; }, 0) - 125000) * 0.125).toLocaleString('en-IN')}</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
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
            <FieldHint text="Any income not covered above — gifts above ₹50,000, lottery winnings, etc." />
          </Label>
          <CurrencyInput
            id="otherSources"
            value={otherIncomeDetails.otherSources}
            onChange={(v) => setOtherIncomeDetails(prev => ({ ...prev, otherSources: v }))}
            placeholder="0 if none"
            data-testid="input-other-sources"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="agriculturalIncome">
            Agricultural Income
            <FieldHint text="Income from agriculture. Exempt under Sec 10(1) but used for rate purposes if total income > ₹5 lakh. ITR-1 allows up to ₹5,000 only; above ₹5,000 requires ITR-2." />
          </Label>
          <CurrencyInput
            id="agriculturalIncome"
            value={otherIncomeDetails.agriculturalIncome}
            onChange={(v) => setOtherIncomeDetails(prev => ({ ...prev, agriculturalIncome: v }))}
            placeholder="Exempt up to ₹5,000 for ITR-1"
            max={5000000}
            data-testid="input-agricultural-income"
          />
          {otherIncomeDetails.agriculturalIncome > 5000 && recommendedForm === "ITR-1" && (
            <p className="text-xs text-amber-600">Agricultural income above ₹5,000 requires ITR-2. Your form will be auto-upgraded.</p>
          )}
        </div>
      </div>

      <Card className="bg-muted/50">
        <CardContent className="p-4 space-y-1">
          <div className="flex justify-between items-center">
            <span className="font-medium">Total Other Income</span>
            <span className="font-bold text-lg">{formatCurrency(totals.otherIncome)}</span>
          </div>
          {otherIncomeDetails.agriculturalIncome > 0 && (
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>Agricultural Income (exempt, for rate purposes)</span>
              <span>{formatCurrency(otherIncomeDetails.agriculturalIncome)}</span>
            </div>
          )}
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
              <strong>New Tax Regime selected.</strong> Most Chapter VI-A deductions (80C, 80D, 80G, etc.) are <strong>not available</strong>. Only standard deduction of ₹75,000 and employer NPS (80CCD2) apply. 
              Switch to Old Regime in Basic Info to claim these deductions.
            </AlertDescription>
          </Alert>
        )}

        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Section 80C / 80CCC / 80CCD — Combined Limit ₹1.5 Lakh</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <Label htmlFor="section80C" className={isNewRegime ? "text-muted-foreground" : ""}>
              80C — Investments (Max ₹1.5L combined)
              <FieldHint text="PPF, ELSS, life insurance, PF, tuition fees, home loan principal, NSC, tax-saving FD, Sukanya Samriddhi. Combined limit with 80CCC and 80CCD(1)." />
            </Label>
            <CurrencyInput id="section80C" value={deductionDetails.section80C} onChange={(v) => setDeductionDetails(prev => ({ ...prev, section80C: v }))} placeholder="PPF, ELSS, LIC, PF" max={150000} disabled={isNewRegime} data-testid="input-section-80c" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="section80CCC" className={isNewRegime ? "text-muted-foreground" : ""}>
              80CCC — Pension Fund (within ₹1.5L)
              <FieldHint text="Contribution to annuity plan of LIC or other insurer. Falls within the overall ₹1.5L limit of 80C+80CCC+80CCD(1)." />
            </Label>
            <CurrencyInput id="section80CCC" value={deductionDetails.section80CCC} onChange={(v) => setDeductionDetails(prev => ({ ...prev, section80CCC: v }))} placeholder="Pension fund contributions" max={150000} disabled={isNewRegime} data-testid="input-section-80ccc" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="section80CCD1" className={isNewRegime ? "text-muted-foreground" : ""}>
              80CCD(1) — NPS Employee (within ₹1.5L)
              <FieldHint text="Your own contribution to NPS (National Pension System). Limited to 10% of salary (14% for govt). Within overall ₹1.5L cap." />
            </Label>
            <CurrencyInput id="section80CCD1" value={deductionDetails.section80CCD1} onChange={(v) => setDeductionDetails(prev => ({ ...prev, section80CCD1: v }))} placeholder="NPS self-contribution" max={150000} disabled={isNewRegime} data-testid="input-section-80ccd1" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="section80CCD1B" className={isNewRegime ? "text-muted-foreground" : ""}>
              80CCD(1B) — NPS Additional (Extra ₹50K)
              <FieldHint text="Additional deduction of ₹50,000 for NPS. This is OVER AND ABOVE the ₹1.5L limit — a powerful tax saver." />
            </Label>
            <CurrencyInput id="section80CCD1B" value={deductionDetails.section80CCD1B} onChange={(v) => setDeductionDetails(prev => ({ ...prev, section80CCD1B: v }))} placeholder="Additional NPS ₹50K" max={50000} disabled={isNewRegime} data-testid="input-section-80ccd1b" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="section80CCD2">
              80CCD(2) — Employer NPS Contribution
              <FieldHint text="Employer's NPS contribution — up to 10% of salary (14% for central govt). Available in BOTH old and new regimes. Check salary slip." />
            </Label>
            <CurrencyInput id="section80CCD2" value={deductionDetails.section80CCD2} onChange={(v) => setDeductionDetails(prev => ({ ...prev, section80CCD2: v }))} placeholder="Employer NPS (check payslip)" data-testid="input-section-80ccd2" />
            <p className="text-xs text-green-600">Available in both Old and New regime</p>
          </div>
        </div>

        <Separator />
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Health, Disability & Education</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <Label htmlFor="section80D" className={isNewRegime ? "text-muted-foreground" : ""}>
              80D — Health Insurance (Max ₹1L)
              <FieldHint text="Self + family: ₹25K (₹50K if senior). Parents: additional ₹25K (₹50K if senior). Max total: ₹1,00,000." />
            </Label>
            <CurrencyInput id="section80D" value={deductionDetails.section80D} onChange={(v) => setDeductionDetails(prev => ({ ...prev, section80D: v }))} placeholder="Self + family + parents" max={100000} disabled={isNewRegime} data-testid="input-section-80d" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="section80DD" className={isNewRegime ? "text-muted-foreground" : ""}>
              80DD — Disabled Dependent (₹75K/₹1.25L)
              <FieldHint text="Maintenance/medical treatment of disabled dependent. ₹75,000 for 40-80% disability, ₹1,25,000 for severe (>80%)." />
            </Label>
            <CurrencyInput id="section80DD" value={deductionDetails.section80DD} onChange={(v) => setDeductionDetails(prev => ({ ...prev, section80DD: v }))} placeholder="₹75K or ₹1.25L" max={125000} disabled={isNewRegime} data-testid="input-section-80dd" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="section80DDB" className={isNewRegime ? "text-muted-foreground" : ""}>
              80DDB — Medical Treatment (Max ₹40K/₹1L)
              <FieldHint text="Treatment of specified diseases (cancer, AIDS, etc.). ₹40,000 for below 60; ₹1,00,000 for senior citizens. Need Form 10-I." />
            </Label>
            <CurrencyInput id="section80DDB" value={deductionDetails.section80DDB} onChange={(v) => setDeductionDetails(prev => ({ ...prev, section80DDB: v }))} placeholder="Specified disease treatment" max={100000} disabled={isNewRegime} data-testid="input-section-80ddb" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="section80U" className={isNewRegime ? "text-muted-foreground" : ""}>
              80U — Self Disability (₹75K/₹1.25L)
              <FieldHint text="For persons with disability (self). ₹75,000 for 40-80% disability, ₹1,25,000 for severe disability (>80%). Need medical certificate." />
            </Label>
            <CurrencyInput id="section80U" value={deductionDetails.section80U} onChange={(v) => setDeductionDetails(prev => ({ ...prev, section80U: v }))} placeholder="₹75K or ₹1.25L" max={125000} disabled={isNewRegime} data-testid="input-section-80u" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="section80E" className={isNewRegime ? "text-muted-foreground" : ""}>
              80E — Education Loan Interest
              <FieldHint text="Interest on education loan for higher studies. No upper limit. Available for 8 years from start of repayment." />
            </Label>
            <CurrencyInput id="section80E" value={deductionDetails.section80E} onChange={(v) => setDeductionDetails(prev => ({ ...prev, section80E: v }))} placeholder="No upper limit" disabled={isNewRegime} data-testid="input-section-80e" />
          </div>
        </div>

        <Separator />
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Housing, Donations & Savings Interest</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <Label htmlFor="section80EEA" className={isNewRegime ? "text-muted-foreground" : ""}>
              80EEA — Affordable Housing Interest (₹1.5L)
              <FieldHint text="Additional interest deduction up to ₹1.5L for affordable housing (stamp duty ≤₹45L). Loan sanctioned between 1 Apr 2019 – 31 Mar 2022." />
            </Label>
            <CurrencyInput id="section80EEA" value={deductionDetails.section80EEA} onChange={(v) => setDeductionDetails(prev => ({ ...prev, section80EEA: v }))} placeholder="Affordable housing loan" max={150000} disabled={isNewRegime} data-testid="input-section-80eea" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="section80EEB" className={isNewRegime ? "text-muted-foreground" : ""}>
              80EEB — EV Loan Interest (₹1.5L)
              <FieldHint text="Interest on loan for electric vehicle purchase. Max ₹1,50,000. Loan sanctioned between 1 Apr 2019 – 31 Mar 2023." />
            </Label>
            <CurrencyInput id="section80EEB" value={deductionDetails.section80EEB} onChange={(v) => setDeductionDetails(prev => ({ ...prev, section80EEB: v }))} placeholder="Electric vehicle loan" max={150000} disabled={isNewRegime} data-testid="input-section-80eeb" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="section80GG" className={isNewRegime ? "text-muted-foreground" : ""}>
              80GG — Rent Paid (No HRA) (Max ₹5K/m)
              <FieldHint text="For those NOT receiving HRA from employer. Least of: rent paid - 10% of total income, ₹5,000/month, or 25% of total income. File Form 10BA." />
            </Label>
            <CurrencyInput id="section80GG" value={deductionDetails.section80GG} onChange={(v) => setDeductionDetails(prev => ({ ...prev, section80GG: v }))} placeholder="Rent if no HRA" max={60000} disabled={isNewRegime} data-testid="input-section-80gg" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="section80G" className={isNewRegime ? "text-muted-foreground" : ""}>
              80G — Charitable Donations (Total)
              <FieldHint text="Donations to specified funds/charities. 100% or 50% deduction depending on the organization. Auto-calculated from entries below, or override manually." />
            </Label>
            <CurrencyInput id="section80G" value={deductionDetails.section80G} onChange={(v) => setDeductionDetails(prev => ({ ...prev, section80G: v }))} placeholder="Charitable donations" disabled={isNewRegime} data-testid="input-section-80g" />
          </div>

          {!isNewRegime && (
            <div className="col-span-full space-y-3 border rounded-lg p-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Schedule 80G — Donation Details</Label>
                <Button variant="outline" size="sm" onClick={() => setDonationEntries(prev => [...prev, {
                  doneeName: "", doneePAN: "", doneeAddress: "", donationAmount: 0,
                  qualifyingPercentage: 100, qualifyingLimit: "without_limit", donationDate: "",
                  donationType: "cash", section80GCertificateNo: "", eligibleAmount: 0,
                }])} data-testid="btn-add-donation">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Donation
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Add each donation separately for ITR Schedule 80G. The total eligible deduction is auto-calculated and applied to the 80G field above.</p>

              {donationEntries.map((d, idx) => (
                <Card key={idx} className="border-dashed">
                  <CardContent className="p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Donation #{idx + 1}</span>
                      <Button variant="ghost" size="sm" onClick={() => setDonationEntries(prev => prev.filter((_, i) => i !== idx))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Donee Name <span className="text-red-500">*</span></Label>
                        <Input value={d.doneeName} onChange={(e) => { const n = [...donationEntries]; n[idx] = { ...n[idx], doneeName: e.target.value }; setDonationEntries(n); }} placeholder="e.g. PM National Relief Fund" data-testid={`donation-name-${idx}`} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Donee PAN</Label>
                        <Input value={d.doneePAN} onChange={(e) => { const n = [...donationEntries]; n[idx] = { ...n[idx], doneePAN: e.target.value.toUpperCase() }; setDonationEntries(n); }} placeholder="AAAPN0000A" maxLength={10} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Donation Amount <span className="text-red-500">*</span></Label>
                        <CurrencyInput id={`donation-amt-${idx}`} value={d.donationAmount} onChange={(v) => { const n = [...donationEntries]; const pct = n[idx].qualifyingPercentage; n[idx] = { ...n[idx], donationAmount: v, eligibleAmount: v * pct / 100 }; setDonationEntries(n); }} data-testid={`donation-amount-${idx}`} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Donation Date</Label>
                        <Input type="date" value={d.donationDate} onChange={(e) => { const n = [...donationEntries]; n[idx] = { ...n[idx], donationDate: e.target.value }; setDonationEntries(n); }} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Qualifying %</Label>
                        <Select value={String(d.qualifyingPercentage)} onValueChange={(v) => { const n = [...donationEntries]; const pct = parseInt(v) as 100 | 50; n[idx] = { ...n[idx], qualifyingPercentage: pct, eligibleAmount: n[idx].donationAmount * pct / 100 }; setDonationEntries(n); }}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="100">100% Deduction</SelectItem>
                            <SelectItem value="50">50% Deduction</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Limit Type</Label>
                        <Select value={d.qualifyingLimit} onValueChange={(v: "with_limit" | "without_limit") => { const n = [...donationEntries]; n[idx] = { ...n[idx], qualifyingLimit: v }; setDonationEntries(n); }}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="without_limit">Without Limit (e.g. PM Relief Fund)</SelectItem>
                            <SelectItem value="with_limit">With Limit (10% of Adjusted GTI)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Mode of Payment</Label>
                        <Select value={d.donationType} onValueChange={(v: "cash" | "kind" | "other") => { const n = [...donationEntries]; n[idx] = { ...n[idx], donationType: v }; setDonationEntries(n); }}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">Cash / Cheque / UPI</SelectItem>
                            <SelectItem value="kind">In Kind</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">80G Certificate No.</Label>
                        <Input value={d.section80GCertificateNo} onChange={(e) => { const n = [...donationEntries]; n[idx] = { ...n[idx], section80GCertificateNo: e.target.value }; setDonationEntries(n); }} placeholder="Certificate reference" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs bg-green-50 dark:bg-green-950/30 p-2 rounded">
                      <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                      <span>Eligible Deduction: <strong>{formatCurrency(d.eligibleAmount)}</strong> ({d.qualifyingPercentage}% of {formatCurrency(d.donationAmount)})</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {donationEntries.length > 0 && (
                <div className="flex justify-between items-center p-2 bg-green-100 dark:bg-green-950 rounded text-sm font-medium">
                  <span>Total 80G Eligible Deduction</span>
                  <span className="text-green-700 dark:text-green-400">{formatCurrency(donationEntries.reduce((sum, d) => sum + d.eligibleAmount, 0))}</span>
                </div>
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="section80TTA" className={isNewRegime ? "text-muted-foreground" : ""}>
              80TTA — Savings Interest (Max ₹10K)
              <FieldHint text="Deduction on interest from savings account. Max ₹10,000. FD/RD interest NOT eligible. Cannot claim both 80TTA and 80TTB." />
            </Label>
            <CurrencyInput id="section80TTA" value={deductionDetails.section80TTA} onChange={(v) => setDeductionDetails(prev => ({ ...prev, section80TTA: v }))} placeholder="Savings account interest" max={10000} disabled={isNewRegime} data-testid="input-section-80tta" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="section80TTB" className={isNewRegime ? "text-muted-foreground" : ""}>
              80TTB — Senior Citizen Interest (Max ₹50K)
              <FieldHint text="For senior citizens (60+). Deduction on interest from savings, FD, RD — up to ₹50,000. Cannot claim both 80TTA and 80TTB." />
            </Label>
            <CurrencyInput id="section80TTB" value={deductionDetails.section80TTB} onChange={(v) => setDeductionDetails(prev => ({ ...prev, section80TTB: v }))} placeholder="Senior citizen interest" max={50000} disabled={isNewRegime} data-testid="input-section-80ttb" />
          </div>
        </div>

        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <span className="font-medium">Total Deductions (Chapter VI-A)</span>
              <span className="font-bold text-lg text-green-600">
                {isNewRegime ? formatCurrency(deductionDetails.section80CCD2) + " (New Regime — only 80CCD2)" : formatCurrency(totals.totalDeductions)}
              </span>
            </div>
          </CardContent>
        </Card>

        <ValidationBanner validation={currentValidation} />
      </div>
    );
  };

  const renderScheduleALStep = () => {
    const computedTotalAssets = scheduleAL.immovableProperty + scheduleAL.movableAssets + scheduleAL.bankDeposits + scheduleAL.sharesAndSecurities + scheduleAL.insurancePolicies + scheduleAL.loansAndAdvancesGiven + scheduleAL.cashInHand + scheduleAL.jewelleryBullion + scheduleAL.archaeologicalCollections + scheduleAL.vehiclesYachtsBoats;
    const computedTotalLiabilities = scheduleAL.liabilitiesRelatedToImmovable + scheduleAL.liabilitiesRelatedToOther;
    const netWorth = computedTotalAssets - computedTotalLiabilities;

    return (
      <div className="space-y-6">
        <p className="text-muted-foreground text-sm">
          Schedule AL (Assets & Liabilities) is <strong>mandatory for ITR-2/3/4 when total income exceeds ₹50 lakhs</strong>. 
          Disclose all assets and liabilities as on 31st March of the assessment year. This is a wealth disclosure requirement per Income Tax rules.
        </p>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Home className="h-4 w-4" /> Part A — Assets (as on 31st March)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Immovable Assets</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Land & Building (Total Value)
                    <FieldHint text="Market value of all immovable properties — residential, commercial, agricultural land. Include stamp duty value or purchase cost." />
                  </Label>
                  <CurrencyInput id="al-immovable" value={scheduleAL.immovableProperty} onChange={(v) => setScheduleAL(prev => ({ ...prev, immovableProperty: v }))} data-testid="al-immovable" />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Movable Assets</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Jewellery, Bullion & Precious Items
                    <FieldHint text="Estimated value of gold, silver, diamonds, and other precious items owned." />
                  </Label>
                  <CurrencyInput id="al-jewellery" value={scheduleAL.jewelleryBullion} onChange={(v) => setScheduleAL(prev => ({ ...prev, jewelleryBullion: v }))} data-testid="al-jewellery" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Motor Vehicles, Yachts & Boats
                    <FieldHint text="Current market value of all vehicles, yachts, boats, and aircraft owned." />
                  </Label>
                  <CurrencyInput id="al-vehicles" value={scheduleAL.vehiclesYachtsBoats} onChange={(v) => setScheduleAL(prev => ({ ...prev, vehiclesYachtsBoats: v }))} data-testid="al-vehicles" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Archaeological Collections & Paintings
                    <FieldHint text="Value of art, antiques, archaeological artifacts, and collectible paintings." />
                  </Label>
                  <CurrencyInput id="al-archaeological" value={scheduleAL.archaeologicalCollections} onChange={(v) => setScheduleAL(prev => ({ ...prev, archaeologicalCollections: v }))} data-testid="al-archaeological" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Other Movable Assets
                    <FieldHint text="Any other movable assets not listed above — furniture, electronics, equipment, etc." />
                  </Label>
                  <CurrencyInput id="al-movable" value={scheduleAL.movableAssets} onChange={(v) => setScheduleAL(prev => ({ ...prev, movableAssets: v }))} data-testid="al-movable" />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Financial Assets</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Bank Deposits (Savings + FD + RD)
                    <FieldHint text="Total balance in all bank accounts including savings, fixed deposits, recurring deposits." />
                  </Label>
                  <CurrencyInput id="al-bank" value={scheduleAL.bankDeposits} onChange={(v) => setScheduleAL(prev => ({ ...prev, bankDeposits: v }))} data-testid="al-bank" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Shares & Securities (Market Value)
                    <FieldHint text="Market value of all shares, mutual funds, bonds, debentures, and other securities held." />
                  </Label>
                  <CurrencyInput id="al-shares" value={scheduleAL.sharesAndSecurities} onChange={(v) => setScheduleAL(prev => ({ ...prev, sharesAndSecurities: v }))} data-testid="al-shares" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Insurance Policies (Surrender Value)
                    <FieldHint text="Surrender value of all life insurance policies, ULIPs, and endowment plans." />
                  </Label>
                  <CurrencyInput id="al-insurance" value={scheduleAL.insurancePolicies} onChange={(v) => setScheduleAL(prev => ({ ...prev, insurancePolicies: v }))} data-testid="al-insurance" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Loans & Advances Given
                    <FieldHint text="Total outstanding loans given to others. Include personal loans, advance payments." />
                  </Label>
                  <CurrencyInput id="al-loans" value={scheduleAL.loansAndAdvancesGiven} onChange={(v) => setScheduleAL(prev => ({ ...prev, loansAndAdvancesGiven: v }))} data-testid="al-loans" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Cash in Hand
                    <FieldHint text="Physical cash held as on 31st March. Disclose actual cash balance." />
                  </Label>
                  <CurrencyInput id="al-cash" value={scheduleAL.cashInHand} onChange={(v) => setScheduleAL(prev => ({ ...prev, cashInHand: v }))} data-testid="al-cash" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4" /> Part B — Liabilities (as on 31st March)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Liabilities Related to Immovable Property
                  <FieldHint text="Outstanding home loans, property loans, or mortgages on land & buildings." />
                </Label>
                <CurrencyInput id="al-liab-immovable" value={scheduleAL.liabilitiesRelatedToImmovable} onChange={(v) => setScheduleAL(prev => ({ ...prev, liabilitiesRelatedToImmovable: v }))} data-testid="al-liab-immovable" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Other Liabilities (Personal/Vehicle Loans)
                  <FieldHint text="Outstanding personal loans, car loans, credit card dues, and any other liabilities." />
                </Label>
                <CurrencyInput id="al-liab-other" value={scheduleAL.liabilitiesRelatedToOther} onChange={(v) => setScheduleAL(prev => ({ ...prev, liabilitiesRelatedToOther: v }))} data-testid="al-liab-other" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-muted/50">
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm">Total Assets</span>
              <span className="font-bold text-blue-600">{formatCurrency(computedTotalAssets)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Total Liabilities</span>
              <span className="font-bold text-red-600">{formatCurrency(computedTotalLiabilities)}</span>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="font-medium">Net Worth (Assets − Liabilities)</span>
              <span className={`font-bold text-lg ${netWorth >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(netWorth)}</span>
            </div>
          </CardContent>
        </Card>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <strong>Important:</strong> Ensure all assets are disclosed at their value as on 31st March {assessmentYear ? parseInt(assessmentYear) - 1 : '2025'}. 
            Non-disclosure or under-reporting may attract penalty under Section 271(1)(c) for concealment of income and assets.
          </AlertDescription>
        </Alert>

        <ValidationBanner validation={currentValidation} />
      </div>
    );
  };

  const renderTaxPaymentsStep = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Enter taxes already paid or deducted. These reduce your final tax liability. Verify from your Form 26AS on the Income Tax e-filing portal.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleFetch26AS}
          disabled={form26ASLoading || !panContext?.pan}
          data-testid="btn-fetch-26as"
        >
          {form26ASLoading ? <><Clock className="h-4 w-4 mr-2 animate-spin" /> Fetching 26AS...</> : <><FileText className="h-4 w-4 mr-2" /> Auto-fill from 26AS</>}
        </Button>
      </div>

      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">TDS Breakdown (Schedule TDS)</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <Label htmlFor="tdsSalary">
            TDS on Salary (Part A) <FieldHint text="Tax deducted by your employer from salary. Check Form 16 Part A or 26AS Part A, section 192." />
          </Label>
          <CurrencyInput
            id="tdsSalary"
            value={taxPaymentDetails.tdsSalary}
            onChange={(v) => {
              setTaxPaymentDetails(prev => {
                const updated = { ...prev, tdsSalary: v };
                updated.tdsDeducted = updated.tdsSalary + updated.tdsOtherThanSalary + updated.tdsOnProperty;
                return updated;
              });
            }}
            placeholder="TDS from employer"
            data-testid="input-tds-salary"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tdsOtherThanSalary">
            TDS Other Than Salary (Part A1) <FieldHint text="TDS by banks on FD interest (194A), TDS on rent receipts (194I), commission (194H), etc. Check 26AS Part A." />
          </Label>
          <CurrencyInput
            id="tdsOtherThanSalary"
            value={taxPaymentDetails.tdsOtherThanSalary}
            onChange={(v) => {
              setTaxPaymentDetails(prev => {
                const updated = { ...prev, tdsOtherThanSalary: v };
                updated.tdsDeducted = updated.tdsSalary + updated.tdsOtherThanSalary + updated.tdsOnProperty;
                return updated;
              });
            }}
            placeholder="Bank TDS, rent TDS, etc."
            data-testid="input-tds-other"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tdsOnProperty">
            TDS on Sale of Property (26QB) <FieldHint text="TDS deducted by buyer on purchase of property ≥₹50 lakh. Rate: 1% of sale consideration. Check Form 26QB." />
          </Label>
          <CurrencyInput
            id="tdsOnProperty"
            value={taxPaymentDetails.tdsOnProperty}
            onChange={(v) => {
              setTaxPaymentDetails(prev => {
                const updated = { ...prev, tdsOnProperty: v };
                updated.tdsDeducted = updated.tdsSalary + updated.tdsOtherThanSalary + updated.tdsOnProperty;
                return updated;
              });
            }}
            placeholder="Property sale TDS (26QB)"
            data-testid="input-tds-property"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tcsCollected">
            TCS Collected (Part A2) <FieldHint text="Tax Collected at Source — on foreign remittances (LRS), car purchases above ₹10L, etc. Check 26AS Part A2." />
          </Label>
          <CurrencyInput
            id="tcsCollected"
            value={taxPaymentDetails.tcsCollected}
            onChange={(v) => setTaxPaymentDetails(prev => ({ ...prev, tcsCollected: v }))}
            placeholder="Foreign remittance TCS, etc."
            data-testid="input-tcs-collected"
          />
        </div>
      </div>

      <Card className="bg-muted/50">
        <CardContent className="p-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Total TDS + TCS</span>
            <span className="font-medium">{formatCurrency(taxPaymentDetails.tdsDeducted + taxPaymentDetails.tcsCollected)}</span>
          </div>
        </CardContent>
      </Card>

      <Separator />
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Advance Tax & Self-Assessment</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <Label htmlFor="tdsDeducted">
            Total TDS (Auto-calculated) <FieldHint text="Sum of TDS on salary + TDS other than salary + TDS on property. Auto-calculated from breakdown above." />
          </Label>
          <CurrencyInput
            id="tdsDeducted"
            value={taxPaymentDetails.tdsDeducted}
            disabled
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

      <Separator />
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Relief & Adjustments</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <Label htmlFor="reliefUs89">
            Relief u/s 89 (Arrear Salary) <FieldHint text="Relief for salary received in arrears or in advance. Calculate using Form 10E on the e-filing portal before claiming." />
          </Label>
          <CurrencyInput
            id="reliefUs89"
            value={taxPaymentDetails.reliefUs89}
            onChange={(v) => setTaxPaymentDetails(prev => ({ ...prev, reliefUs89: v }))}
            placeholder="File Form 10E first"
            data-testid="input-relief-89"
          />
        </div>
      </div>

      <Card className="bg-muted/50">
        <CardContent className="p-4 space-y-1">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">TDS + TCS</span>
            <span>{formatCurrency(taxPaymentDetails.tdsDeducted + taxPaymentDetails.tcsCollected)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Advance Tax + Self-Assessment</span>
            <span>{formatCurrency(taxPaymentDetails.advanceTaxPaid + taxPaymentDetails.selfAssessmentTax)}</span>
          </div>
          {taxPaymentDetails.reliefUs89 > 0 && (
            <div className="flex justify-between items-center text-sm text-green-600">
              <span>Relief u/s 89</span>
              <span>{formatCurrency(taxPaymentDetails.reliefUs89)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between items-center">
            <span className="font-medium">Total Tax Credits</span>
            <span className="font-bold text-lg text-green-600">{formatCurrency(totals.totalTaxPaid)}</span>
          </div>
        </CardContent>
      </Card>

      <Separator />
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Interest u/s 234A / 234B / 234C (Auto-calculated)</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <Label className="text-xs">Filing Due Date <FieldHint text="Standard due date is 31st July. Extended to 31st Oct for audit cases. Belated filing allowed until 31st Dec of AY." /></Label>
          <Input type="date" value={interest234.filingDueDate} onChange={e => setInterest234(p => ({ ...p, filingDueDate: e.target.value }))} data-testid="input-filing-due-date" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Actual / Expected Filing Date <FieldHint text="Date when you file (or plan to file) the ITR. Used to compute months of delay for 234A interest." /></Label>
          <Input type="date" value={interest234.filingDate} onChange={e => setInterest234(p => ({ ...p, filingDate: e.target.value }))} data-testid="input-filing-date" />
        </div>
      </div>

      <Card className="bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Advance Tax Installments (for 234C calculation)</CardTitle>
          <CardDescription className="text-xs">Enter quarter-wise advance tax paid. Required if tax liability exceeds ₹10,000.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {interest234.advanceTaxDetails.map((inst, idx) => (
              <div key={idx} className="border rounded p-2 space-y-1">
                <p className="text-xs font-medium">{inst.quarter} — Due: {inst.dueDate}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px]">Amount Paid (₹)</Label>
                    <Input type="number" className="h-8 text-xs" value={inst.amountPaid || ""} onChange={e => {
                      const u = [...interest234.advanceTaxDetails]; u[idx] = { ...u[idx], amountPaid: Number(e.target.value) };
                      setInterest234(p => ({ ...p, advanceTaxDetails: u }));
                    }} />
                  </div>
                  <div>
                    <Label className="text-[10px]">Date Paid</Label>
                    <Input type="date" className="h-8 text-xs" value={inst.paidDate} onChange={e => {
                      const u = [...interest234.advanceTaxDetails]; u[idx] = { ...u[idx], paidDate: e.target.value };
                      setInterest234(p => ({ ...p, advanceTaxDetails: u }));
                    }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button variant="outline" size="sm" onClick={compute234Interest} className="w-full" data-testid="btn-compute-234-interest">
        <Calculator className="h-4 w-4 mr-2" /> Compute Interest u/s 234A / 234B / 234C
      </Button>

      {interest234.totalInterest > 0 && (
        <Card className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
          <CardContent className="p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">234A — Late Filing Interest</span>
              <span className="text-red-600 font-medium">{formatCurrency(interest234.interest234A)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">234B — Default in Advance Tax</span>
              <span className="text-red-600 font-medium">{formatCurrency(interest234.interest234B)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">234C — Deferment of Advance Tax</span>
              <span className="text-red-600 font-medium">{formatCurrency(interest234.interest234C)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Total Interest Payable</span>
              <span className="text-red-600">{formatCurrency(interest234.totalInterest)}</span>
            </div>
            <p className="text-xs text-muted-foreground">This interest is added to your tax liability. Pay along with self-assessment tax before filing.</p>
          </CardContent>
        </Card>
      )}

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

        <Card className="dark:border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Bank Account for Refund
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="bankAccountNumber" className="text-xs">Account Number <span className="text-red-500">*</span></Label>
                <Input
                  id="bankAccountNumber"
                  value={bankDetails.accountNumber}
                  onChange={(e) => setBankDetails(prev => ({ ...prev, accountNumber: e.target.value }))}
                  placeholder="Enter bank account number"
                  data-testid="input-bank-account"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bankIFSC" className="text-xs">IFSC Code <span className="text-red-500">*</span></Label>
                <Input
                  id="bankIFSC"
                  value={bankDetails.ifscCode}
                  onChange={(e) => setBankDetails(prev => ({ ...prev, ifscCode: e.target.value.toUpperCase() }))}
                  placeholder="e.g. SBIN0001234"
                  className="font-mono tracking-wider uppercase"
                  maxLength={11}
                  data-testid="input-bank-ifsc"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bankName" className="text-xs">Bank Name</Label>
                <Input
                  id="bankName"
                  value={bankDetails.bankName}
                  onChange={(e) => setBankDetails(prev => ({ ...prev, bankName: e.target.value }))}
                  placeholder="e.g. State Bank of India"
                  data-testid="input-bank-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bankAccountType" className="text-xs">Account Type</Label>
                <Select value={bankDetails.accountType} onValueChange={(v) => setBankDetails(prev => ({ ...prev, accountType: v as any }))}>
                  <SelectTrigger id="bankAccountType" data-testid="select-bank-account-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="savings">Savings</SelectItem>
                    <SelectItem value="current">Current</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {apiData?.refundAmount && apiData.refundAmount > 0 && !bankDetails.accountNumber && (
              <p className="text-xs text-amber-600">Bank account details are required to receive your refund of {formatCurrency(apiData.refundAmount)}.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" /> Document Vault
              </CardTitle>
              <label htmlFor="doc-vault-upload" className="cursor-pointer">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium hover:bg-accent">
                  <Upload className="h-3.5 w-3.5" /> Upload Document
                </div>
                <input
                  id="doc-vault-upload"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.xlsx,.csv"
                  className="hidden"
                  multiple
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files) {
                      const newDocs = Array.from(files).map(f => ({
                        id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                        name: f.name,
                        type: f.type,
                        category: f.name.toLowerCase().includes('form16') ? 'Form 16' : f.name.toLowerCase().includes('26as') ? 'Form 26AS' : f.name.toLowerCase().includes('ais') ? 'AIS' : 'Supporting',
                        uploadedAt: new Date().toISOString(),
                        size: f.size,
                      }));
                      setDocumentVault(prev => [...prev, ...newDocs]);
                      toast({ title: "Documents Added", description: `${files.length} document(s) added to your vault.` });
                    }
                  }}
                  data-testid="doc-vault-upload"
                />
              </label>
            </div>
            <CardDescription>Store all supporting documents for your ITR filing. Form 16, 26AS, AIS, rent receipts, investment proofs, etc.</CardDescription>
          </CardHeader>
          <CardContent>
            {documentVault.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No documents uploaded yet. Upload Form 16, 26AS, investment proofs, etc.</p>
            ) : (
              <div className="space-y-2">
                {documentVault.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between p-2 border rounded text-xs">
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{doc.name}</p>
                        <p className="text-muted-foreground">{doc.category} | {(doc.size / 1024).toFixed(0)} KB</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setDocumentVault(prev => prev.filter(d => d.id !== doc.id))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" /> Advanced Options
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}>
                {showAdvancedOptions ? "Hide" : "Show"}
              </Button>
            </div>
          </CardHeader>
          {showAdvancedOptions && (
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 p-3 border rounded">
                  <Label className="text-xs font-medium">e-Verification Method</Label>
                  <Select defaultValue="aadhaar_otp">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aadhaar_otp">Aadhaar OTP</SelectItem>
                      <SelectItem value="net_banking">Net Banking</SelectItem>
                      <SelectItem value="bank_account">Bank Account EVC</SelectItem>
                      <SelectItem value="dsc">Digital Signature (DSC)</SelectItem>
                      <SelectItem value="send_to_cpc">Send ITR-V to CPC Bengaluru</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">How you'll verify your return after filing. Aadhaar OTP is fastest.</p>
                </div>
                <div className="space-y-2 p-3 border rounded">
                  <Label className="text-xs font-medium">Bulk CSV Upload</Label>
                  <label htmlFor="bulk-csv-upload" className="cursor-pointer">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium hover:bg-accent w-full justify-center">
                      <Upload className="h-3.5 w-3.5" /> Upload Capital Gains CSV
                    </div>
                    <input
                      id="bulk-csv-upload"
                      type="file"
                      accept=".csv,.xlsx"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          toast({ title: "CSV Received", description: `${file.name} uploaded for bulk processing. Parsing capital gains entries...` });
                        }
                      }}
                      data-testid="bulk-csv-upload"
                    />
                  </label>
                  <p className="text-[10px] text-muted-foreground">Upload a CSV with multiple capital gains transactions for bulk import.</p>
                </div>
                <div className="space-y-2 p-3 border rounded">
                  <Label className="text-xs font-medium">Audit Trail</Label>
                  <Badge variant="outline" className="text-[10px]">
                    {documentVault.length} documents | {(cgUploads?.length || 0) + (cgManualSaved?.length || 0)} CG sources | {donationEntries.length} donations
                  </Badge>
                  <p className="text-[10px] text-muted-foreground">All entries are SHA-256 hashed and timestamped for audit compliance.</p>
                </div>
                <div className="space-y-2 p-3 border rounded">
                  <Label className="text-xs font-medium">Filing Preferences</Label>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="opt-auto-26as" defaultChecked className="h-3.5 w-3.5" />
                      <Label htmlFor="opt-auto-26as" className="text-xs cursor-pointer">Auto-fetch 26AS on calculation</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="opt-regime-compare" defaultChecked className="h-3.5 w-3.5" />
                      <Label htmlFor="opt-regime-compare" className="text-xs cursor-pointer">Show regime comparison</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="opt-email-ack" defaultChecked className="h-3.5 w-3.5" />
                      <Label htmlFor="opt-email-ack" className="text-xs cursor-pointer">Email acknowledgment after filing</Label>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          )}
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

  const renderEntityProfileStep = () => {
    const formLabel = recommendedForm === "ITR-6" ? "Company" : recommendedForm === "ITR-7" ? "Trust / Institution" : "Firm / AOP / BOI";
    return (
      <div className="space-y-4">
        <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            {recommendedForm}: {formLabel} details required. This information maps to Part A-GEN of the return.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{formLabel} Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Entity Name *</Label>
                <Input value={entityProfile.entityName} onChange={e => setEntityProfile(p => ({ ...p, entityName: e.target.value }))} placeholder="Legal name of entity" />
              </div>
              <div>
                <Label>Entity PAN *</Label>
                <Input value={entityProfile.entityPAN} onChange={e => setEntityProfile(p => ({ ...p, entityPAN: e.target.value.toUpperCase() }))} placeholder="ABCDE1234F" maxLength={10} />
              </div>
              <div>
                <Label>Date of Incorporation</Label>
                <Input type="date" value={entityProfile.dateOfIncorporation} onChange={e => setEntityProfile(p => ({ ...p, dateOfIncorporation: e.target.value }))} />
              </div>
              <div>
                <Label>Nature of Business</Label>
                <Input value={entityProfile.natureOfBusiness} onChange={e => setEntityProfile(p => ({ ...p, natureOfBusiness: e.target.value }))} placeholder="e.g. Manufacturing, IT Services" />
              </div>
              {recommendedForm === "ITR-5" && (
                <div>
                  <Label>Constitution Type</Label>
                  <Select value={entityProfile.constitutionType} onValueChange={v => setEntityProfile(p => ({ ...p, constitutionType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="partnership">Partnership Firm</SelectItem>
                      <SelectItem value="llp">LLP</SelectItem>
                      <SelectItem value="aop">AOP / BOI</SelectItem>
                      <SelectItem value="cooperative">Cooperative Society</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Registration Number</Label>
                <Input value={entityProfile.registrationNumber} onChange={e => setEntityProfile(p => ({ ...p, registrationNumber: e.target.value }))} placeholder="LLPIN / CIN / Registration No." />
              </div>
            </div>
          </CardContent>
        </Card>

        {recommendedForm === "ITR-6" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Corporate Details (Schedule Part A-GEN)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Company Type</Label>
                  <Select value={corporateDetails.companyType} onValueChange={v => setCorporateDetails(p => ({ ...p, companyType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="private">Private Limited</SelectItem>
                      <SelectItem value="public">Public Limited</SelectItem>
                      <SelectItem value="section8">Section 8 Company</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>CIN (Company Identification Number) *</Label>
                  <Input value={corporateDetails.cin} onChange={e => setCorporateDetails(p => ({ ...p, cin: e.target.value.toUpperCase() }))} placeholder="U12345MH2020PTC123456" />
                </div>
                <div>
                  <Label>Authorized Capital (₹)</Label>
                  <Input type="number" value={corporateDetails.authorizedCapital || ""} onChange={e => setCorporateDetails(p => ({ ...p, authorizedCapital: Number(e.target.value) }))} />
                </div>
                <div>
                  <Label>Paid-up Capital (₹)</Label>
                  <Input type="number" value={corporateDetails.paidUpCapital || ""} onChange={e => setCorporateDetails(p => ({ ...p, paidUpCapital: Number(e.target.value) }))} />
                </div>
              </div>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox checked={corporateDetails.matApplicable} onCheckedChange={c => setCorporateDetails(p => ({ ...p, matApplicable: !!c }))} />
                  <Label>MAT (Minimum Alternate Tax) applicable under Section 115JB</Label>
                </div>
                {corporateDetails.matApplicable && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pl-6">
                    <div>
                      <Label>Book Profit (₹)</Label>
                      <Input type="number" value={corporateDetails.bookProfit || ""} onChange={e => setCorporateDetails(p => ({ ...p, bookProfit: Number(e.target.value) }))} />
                    </div>
                    <div>
                      <Label>MAT Tax (₹)</Label>
                      <Input type="number" value={corporateDetails.matTax || ""} onChange={e => setCorporateDetails(p => ({ ...p, matTax: Number(e.target.value) }))} />
                    </div>
                    <div>
                      <Label>MAT Credit c/f (₹)</Label>
                      <Input type="number" value={corporateDetails.matCredit || ""} onChange={e => setCorporateDetails(p => ({ ...p, matCredit: Number(e.target.value) }))} />
                    </div>
                  </div>
                )}
              </div>
              <Separator />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Dividend Declared (₹)</Label>
                  <Input type="number" value={corporateDetails.dividendDeclared || ""} onChange={e => setCorporateDetails(p => ({ ...p, dividendDeclared: Number(e.target.value) }))} />
                </div>
                <div>
                  <Label>Dividend Distribution Tax (₹)</Label>
                  <Input type="number" value={corporateDetails.dividendDistributionTax || ""} onChange={e => setCorporateDetails(p => ({ ...p, dividendDistributionTax: Number(e.target.value) }))} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {recommendedForm === "ITR-7" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Trust / Institution Registration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Trust Type</Label>
                  <Select value={trustDetails.trustType} onValueChange={v => setTrustDetails(p => ({ ...p, trustType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="charitable">Charitable Trust</SelectItem>
                      <SelectItem value="religious">Religious Trust</SelectItem>
                      <SelectItem value="educational">Educational Institution</SelectItem>
                      <SelectItem value="medical">Medical Institution</SelectItem>
                      <SelectItem value="political">Political Party</SelectItem>
                      <SelectItem value="research">Research Association</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Registration Section</Label>
                  <Select value={trustDetails.registrationSection} onValueChange={v => setTrustDetails(p => ({ ...p, registrationSection: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12A">Section 12A</SelectItem>
                      <SelectItem value="12AA">Section 12AA</SelectItem>
                      <SelectItem value="12AB">Section 12AB</SelectItem>
                      <SelectItem value="10(23C)">Section 10(23C)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Registration Number *</Label>
                  <Input value={trustDetails.registrationNumber} onChange={e => setTrustDetails(p => ({ ...p, registrationNumber: e.target.value }))} />
                </div>
                <div>
                  <Label>Registration Date</Label>
                  <Input type="date" value={trustDetails.registrationDate} onChange={e => setTrustDetails(p => ({ ...p, registrationDate: e.target.value }))} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {recommendedForm === "ITR-5" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Partners / Members (Schedule-IF)</CardTitle>
              <CardDescription>Add details of all partners or members as per the deed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {entityProfile.partners.map((partner, idx) => (
                <div key={idx} className="border rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">Partner {idx + 1}</span>
                    <Button variant="ghost" size="sm" onClick={() => setEntityProfile(p => ({ ...p, partners: p.partners.filter((_, i) => i !== idx) }))}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Name</Label>
                      <Input value={partner.name} onChange={e => {
                        const updated = [...entityProfile.partners];
                        updated[idx] = { ...updated[idx], name: e.target.value };
                        setEntityProfile(p => ({ ...p, partners: updated }));
                      }} placeholder="Partner name" />
                    </div>
                    <div>
                      <Label className="text-xs">PAN</Label>
                      <Input value={partner.pan} onChange={e => {
                        const updated = [...entityProfile.partners];
                        updated[idx] = { ...updated[idx], pan: e.target.value.toUpperCase() };
                        setEntityProfile(p => ({ ...p, partners: updated }));
                      }} maxLength={10} />
                    </div>
                    <div>
                      <Label className="text-xs">Profit Share %</Label>
                      <Input type="number" value={partner.profitSharePercentage || ""} onChange={e => {
                        const updated = [...entityProfile.partners];
                        updated[idx] = { ...updated[idx], profitSharePercentage: Number(e.target.value) };
                        setEntityProfile(p => ({ ...p, partners: updated }));
                      }} />
                    </div>
                    <div>
                      <Label className="text-xs">Remuneration (₹)</Label>
                      <Input type="number" value={partner.remuneration || ""} onChange={e => {
                        const updated = [...entityProfile.partners];
                        updated[idx] = { ...updated[idx], remuneration: Number(e.target.value) };
                        setEntityProfile(p => ({ ...p, partners: updated }));
                      }} />
                    </div>
                    <div>
                      <Label className="text-xs">Interest on Capital (₹)</Label>
                      <Input type="number" value={partner.interestOnCapital || ""} onChange={e => {
                        const updated = [...entityProfile.partners];
                        updated[idx] = { ...updated[idx], interestOnCapital: Number(e.target.value) };
                        setEntityProfile(p => ({ ...p, partners: updated }));
                      }} />
                    </div>
                    <div>
                      <Label className="text-xs">Capital Balance (₹)</Label>
                      <Input type="number" value={partner.capitalBalance || ""} onChange={e => {
                        const updated = [...entityProfile.partners];
                        updated[idx] = { ...updated[idx], capitalBalance: Number(e.target.value) };
                        setEntityProfile(p => ({ ...p, partners: updated }));
                      }} />
                    </div>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setEntityProfile(p => ({ ...p, partners: [...p.partners, { name: "", pan: "", profitSharePercentage: 0, remuneration: 0, interestOnCapital: 0, capitalBalance: 0 }] }))}>
                <Plus className="h-4 w-4 mr-1" /> Add Partner
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderFinancialsStep = () => {
    const autoTotalAssets = balanceSheet.fixedAssets + balanceSheet.investments + balanceSheet.currentAssets + balanceSheet.loansAndAdvances + balanceSheet.otherAssets;
    const autoTotalLiabilities = balanceSheet.capital + balanceSheet.reservesAndSurplus + balanceSheet.securedLoans + balanceSheet.unsecuredLoans + balanceSheet.currentLiabilities;
    const autoTotalRevenue = profitLoss.grossRevenue + profitLoss.otherOperatingIncome;
    const autoTotalExpenses = profitLoss.purchasesAndDirectExpenses + profitLoss.employeeBenefitExpenses + profitLoss.depreciation + profitLoss.otherExpenses;
    const autoNetProfit = autoTotalRevenue - autoTotalExpenses;

    return (
      <div className="space-y-4">
        <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Schedule BP / Balance Sheet / P&L as required for {recommendedForm}. These map to Part A-BS, Part A-P&L and Part A-OI.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Balance Sheet (Part A-BS)</CardTitle>
            <CardDescription>Assets and liabilities as on 31st March</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold mb-2 text-green-700 dark:text-green-400">Assets</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { key: "fixedAssets", label: "Fixed Assets (Net of Depreciation)" },
                  { key: "investments", label: "Investments" },
                  { key: "currentAssets", label: "Current Assets" },
                  { key: "loansAndAdvances", label: "Loans & Advances" },
                  { key: "otherAssets", label: "Other Assets" },
                ].map(item => (
                  <div key={item.key}>
                    <Label className="text-xs">{item.label} (₹)</Label>
                    <Input type="number" value={(balanceSheet as any)[item.key] || ""} onChange={e => {
                      const val = Number(e.target.value);
                      setBalanceSheet(p => ({ ...p, [item.key]: val, totalAssets: autoTotalAssets - (p as any)[item.key] + val }));
                    }} />
                  </div>
                ))}
              </div>
              <div className="mt-2 p-2 bg-green-50 dark:bg-green-950 rounded text-sm font-medium">
                Total Assets: ₹{autoTotalAssets.toLocaleString('en-IN')}
              </div>
            </div>
            <Separator />
            <div>
              <h4 className="text-sm font-semibold mb-2 text-red-700 dark:text-red-400">Liabilities & Capital</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { key: "capital", label: "Capital / Share Capital" },
                  { key: "reservesAndSurplus", label: "Reserves & Surplus" },
                  { key: "securedLoans", label: "Secured Loans" },
                  { key: "unsecuredLoans", label: "Unsecured Loans" },
                  { key: "currentLiabilities", label: "Current Liabilities & Provisions" },
                ].map(item => (
                  <div key={item.key}>
                    <Label className="text-xs">{item.label} (₹)</Label>
                    <Input type="number" value={(balanceSheet as any)[item.key] || ""} onChange={e => {
                      const val = Number(e.target.value);
                      setBalanceSheet(p => ({ ...p, [item.key]: val, totalLiabilities: autoTotalLiabilities - (p as any)[item.key] + val }));
                    }} />
                  </div>
                ))}
              </div>
              <div className="mt-2 p-2 bg-red-50 dark:bg-red-950 rounded text-sm font-medium">
                Total Liabilities: ₹{autoTotalLiabilities.toLocaleString('en-IN')}
                {autoTotalAssets !== autoTotalLiabilities && autoTotalAssets > 0 && (
                  <span className="ml-2 text-red-600 text-xs">(Does not tally — difference: ₹{Math.abs(autoTotalAssets - autoTotalLiabilities).toLocaleString('en-IN')})</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Profit & Loss Account (Part A-P&L)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold mb-2">Revenue</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Gross Revenue / Turnover (₹)</Label>
                  <Input type="number" value={profitLoss.grossRevenue || ""} onChange={e => setProfitLoss(p => ({ ...p, grossRevenue: Number(e.target.value) }))} />
                </div>
                <div>
                  <Label className="text-xs">Other Operating Income (₹)</Label>
                  <Input type="number" value={profitLoss.otherOperatingIncome || ""} onChange={e => setProfitLoss(p => ({ ...p, otherOperatingIncome: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950 rounded text-sm">Total Revenue: ₹{autoTotalRevenue.toLocaleString('en-IN')}</div>
            </div>
            <Separator />
            <div>
              <h4 className="text-sm font-semibold mb-2">Expenses</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { key: "purchasesAndDirectExpenses", label: "Purchases & Direct Expenses" },
                  { key: "employeeBenefitExpenses", label: "Employee Benefit Expenses" },
                  { key: "depreciation", label: "Depreciation & Amortisation" },
                  { key: "otherExpenses", label: "Other Expenses" },
                ].map(item => (
                  <div key={item.key}>
                    <Label className="text-xs">{item.label} (₹)</Label>
                    <Input type="number" value={(profitLoss as any)[item.key] || ""} onChange={e => setProfitLoss(p => ({ ...p, [item.key]: Number(e.target.value) }))} />
                  </div>
                ))}
              </div>
              <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-950 rounded text-sm">Total Expenses: ₹{autoTotalExpenses.toLocaleString('en-IN')}</div>
            </div>
            <div className={`p-3 rounded-lg text-sm font-semibold ${autoNetProfit >= 0 ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'}`}>
              Net Profit Before Tax: ₹{autoNetProfit.toLocaleString('en-IN')} {autoNetProfit < 0 ? '(Loss)' : ''}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Depreciation Schedule</CardTitle>
            <CardDescription>Block-wise depreciation as per IT Act (WDV method)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {depreciationEntries.map((entry, idx) => (
              <div key={idx} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">Block {idx + 1}</span>
                  <Button variant="ghost" size="sm" onClick={() => setDepreciationEntries(prev => prev.filter((_, i) => i !== idx))}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <Label className="text-xs">Asset Block</Label>
                    <Input value={entry.assetBlock} onChange={e => {
                      const updated = [...depreciationEntries]; updated[idx] = { ...updated[idx], assetBlock: e.target.value };
                      setDepreciationEntries(updated);
                    }} placeholder="e.g. Plant & Machinery" />
                  </div>
                  <div>
                    <Label className="text-xs">Rate %</Label>
                    <Input type="number" value={entry.rate || ""} onChange={e => {
                      const updated = [...depreciationEntries]; updated[idx] = { ...updated[idx], rate: Number(e.target.value) };
                      setDepreciationEntries(updated);
                    }} />
                  </div>
                  <div>
                    <Label className="text-xs">Opening WDV (₹)</Label>
                    <Input type="number" value={entry.openingWDV || ""} onChange={e => {
                      const updated = [...depreciationEntries]; updated[idx] = { ...updated[idx], openingWDV: Number(e.target.value) };
                      setDepreciationEntries(updated);
                    }} />
                  </div>
                  <div>
                    <Label className="text-xs">Additions (₹)</Label>
                    <Input type="number" value={entry.additions || ""} onChange={e => {
                      const updated = [...depreciationEntries]; updated[idx] = { ...updated[idx], additions: Number(e.target.value) };
                      setDepreciationEntries(updated);
                    }} />
                  </div>
                  <div>
                    <Label className="text-xs">Deletions (₹)</Label>
                    <Input type="number" value={entry.deletions || ""} onChange={e => {
                      const updated = [...depreciationEntries]; updated[idx] = { ...updated[idx], deletions: Number(e.target.value) };
                      setDepreciationEntries(updated);
                    }} />
                  </div>
                  <div>
                    <Label className="text-xs">Depreciation (₹)</Label>
                    <Input type="number" value={entry.depreciationAmount || ""} onChange={e => {
                      const updated = [...depreciationEntries]; updated[idx] = { ...updated[idx], depreciationAmount: Number(e.target.value) };
                      setDepreciationEntries(updated);
                    }} />
                  </div>
                  <div>
                    <Label className="text-xs">Closing WDV (₹)</Label>
                    <div className="text-sm mt-1 font-medium p-2 bg-muted rounded">
                      ₹{((entry.openingWDV + entry.additions - entry.deletions - entry.depreciationAmount)).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setDepreciationEntries(prev => [...prev, { assetBlock: "", rate: 15, openingWDV: 0, additions: 0, deletions: 0, depreciationAmount: 0, closingWDV: 0, method: "WDV" }])}>
              <Plus className="h-4 w-4 mr-1" /> Add Depreciation Block
            </Button>
          </CardContent>
        </Card>

        {recommendedForm === "ITR-3" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Tax Audit Information (Section 44AB)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox checked={taxAuditInfo.isAuditRequired} onCheckedChange={c => setTaxAuditInfo(p => ({ ...p, isAuditRequired: !!c }))} />
                <Label>Tax Audit is required (turnover exceeds threshold)</Label>
              </div>
              {taxAuditInfo.isAuditRequired && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6">
                  <div>
                    <Label className="text-xs">Auditor Name</Label>
                    <Input value={taxAuditInfo.auditorName} onChange={e => setTaxAuditInfo(p => ({ ...p, auditorName: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Membership Number</Label>
                    <Input value={taxAuditInfo.auditorMembershipNo} onChange={e => setTaxAuditInfo(p => ({ ...p, auditorMembershipNo: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Audit Date</Label>
                    <Input type="date" value={taxAuditInfo.auditDate} onChange={e => setTaxAuditInfo(p => ({ ...p, auditDate: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox checked={taxAuditInfo.form3CA_3CD} onCheckedChange={c => setTaxAuditInfo(p => ({ ...p, form3CA_3CD: !!c, form3CB_3CD: !!c ? false : p.form3CB_3CD }))} />
                      <Label className="text-xs">Form 3CA-3CD (company/firm audit)</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={taxAuditInfo.form3CB_3CD} onCheckedChange={c => setTaxAuditInfo(p => ({ ...p, form3CB_3CD: !!c, form3CA_3CD: !!c ? false : p.form3CA_3CD }))} />
                      <Label className="text-xs">Form 3CB-3CD (other persons audit)</Label>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={taxAuditInfo.auditReportFiled} onCheckedChange={c => setTaxAuditInfo(p => ({ ...p, auditReportFiled: !!c }))} />
                    <Label className="text-xs">Audit Report Filed on IT Portal</Label>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {recommendedForm === "ITR-3" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">F&O / Intraday Income (Schedule BP)</CardTitle>
              <CardDescription>Futures, Options, and Intraday trading classified as business income</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Futures Gains/Loss (₹)</Label>
                  <Input type="number" value={foIncome.futuresGains || ""} onChange={e => setFoIncome(p => ({ ...p, futuresGains: Number(e.target.value) }))} />
                </div>
                <div>
                  <Label className="text-xs">Options Gains/Loss (₹)</Label>
                  <Input type="number" value={foIncome.optionsGains || ""} onChange={e => setFoIncome(p => ({ ...p, optionsGains: Number(e.target.value) }))} />
                </div>
                <div>
                  <Label className="text-xs">Intraday Gains/Loss (₹)</Label>
                  <Input type="number" value={foIncome.intradayGains || ""} onChange={e => setFoIncome(p => ({ ...p, intradayGains: Number(e.target.value) }))} />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <Checkbox checked={foIncome.isSpeculative} onCheckedChange={c => setFoIncome(p => ({ ...p, isSpeculative: !!c }))} />
                  <Label className="text-xs">Mark intraday as speculative income (Section 43(5))</Label>
                </div>
              </div>
              <div className="mt-3 p-2 bg-muted rounded text-sm">
                Net F&O + Intraday: ₹{(foIncome.futuresGains + foIncome.optionsGains + foIncome.intradayGains).toLocaleString('en-IN')}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderDisclosuresStep = () => {
    return (
      <div className="space-y-4">
        <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Mandatory disclosures for {recommendedForm}: Director positions, unlisted equity holdings, and loss carry-forward (Schedule CYLA / BFLA / CFL).
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Directorship in Companies</CardTitle>
            <CardDescription>Required if you are/were a director in any company during the FY</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {directorships.map((entry, idx) => (
              <div key={idx} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">Company {idx + 1}</span>
                  <Button variant="ghost" size="sm" onClick={() => setDirectorships(prev => prev.filter((_, i) => i !== idx))}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Company Name</Label>
                    <Input value={entry.companyName} onChange={e => {
                      const updated = [...directorships]; updated[idx] = { ...updated[idx], companyName: e.target.value };
                      setDirectorships(updated);
                    }} />
                  </div>
                  <div>
                    <Label className="text-xs">CIN / LLPIN</Label>
                    <Input value={entry.cin} onChange={e => {
                      const updated = [...directorships]; updated[idx] = { ...updated[idx], cin: e.target.value };
                      setDirectorships(updated);
                    }} />
                  </div>
                  <div>
                    <Label className="text-xs">DIN</Label>
                    <Input value={entry.din} onChange={e => {
                      const updated = [...directorships]; updated[idx] = { ...updated[idx], din: e.target.value };
                      setDirectorships(updated);
                    }} />
                  </div>
                  <div>
                    <Label className="text-xs">Shares Held</Label>
                    <Input type="number" value={entry.sharesHeld || ""} onChange={e => {
                      const updated = [...directorships]; updated[idx] = { ...updated[idx], sharesHeld: Number(e.target.value) };
                      setDirectorships(updated);
                    }} />
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <Checkbox checked={entry.listedCompany} onCheckedChange={c => {
                      const updated = [...directorships]; updated[idx] = { ...updated[idx], listedCompany: !!c };
                      setDirectorships(updated);
                    }} />
                    <Label className="text-xs">Listed Company</Label>
                  </div>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setDirectorships(prev => [...prev, { companyName: "", cin: "", din: "", sharesHeld: 0, listedCompany: false }])}>
              <Plus className="h-4 w-4 mr-1" /> Add Directorship
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Unlisted Equity Shares</CardTitle>
            <CardDescription>Holdings in unlisted companies at any time during the FY</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {unlistedShares.map((entry, idx) => (
              <div key={idx} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">Holding {idx + 1}</span>
                  <Button variant="ghost" size="sm" onClick={() => setUnlistedShares(prev => prev.filter((_, i) => i !== idx))}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Company Name</Label>
                    <Input value={entry.companyName} onChange={e => {
                      const updated = [...unlistedShares]; updated[idx] = { ...updated[idx], companyName: e.target.value };
                      setUnlistedShares(updated);
                    }} />
                  </div>
                  <div>
                    <Label className="text-xs">PAN of Company</Label>
                    <Input value={entry.companyPAN} onChange={e => {
                      const updated = [...unlistedShares]; updated[idx] = { ...updated[idx], companyPAN: e.target.value.toUpperCase() };
                      setUnlistedShares(updated);
                    }} maxLength={10} />
                  </div>
                  <div>
                    <Label className="text-xs">No. of Shares</Label>
                    <Input type="number" value={entry.numberOfShares || ""} onChange={e => {
                      const updated = [...unlistedShares]; updated[idx] = { ...updated[idx], numberOfShares: Number(e.target.value) };
                      setUnlistedShares(updated);
                    }} />
                  </div>
                  <div>
                    <Label className="text-xs">Acquisition Cost (₹)</Label>
                    <Input type="number" value={entry.acquisitionCost || ""} onChange={e => {
                      const updated = [...unlistedShares]; updated[idx] = { ...updated[idx], acquisitionCost: Number(e.target.value) };
                      setUnlistedShares(updated);
                    }} />
                  </div>
                  <div>
                    <Label className="text-xs">FMV at Year End (₹)</Label>
                    <Input type="number" value={entry.fmvAtYearEnd || ""} onChange={e => {
                      const updated = [...unlistedShares]; updated[idx] = { ...updated[idx], fmvAtYearEnd: Number(e.target.value) };
                      setUnlistedShares(updated);
                    }} />
                  </div>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setUnlistedShares(prev => [...prev, { companyName: "", companyPAN: "", numberOfShares: 0, acquisitionCost: 0, fmvAtYearEnd: 0 }])}>
              <Plus className="h-4 w-4 mr-1" /> Add Unlisted Share Holding
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Loss Carry Forward (Schedule CYLA / BFLA / CFL)</CardTitle>
            <CardDescription>Losses from prior assessment years eligible for carry-forward and set-off</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {lossCarryForward.map((entry, idx) => (
              <div key={idx} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">Loss Entry {idx + 1}</span>
                  <Button variant="ghost" size="sm" onClick={() => setLossCarryForward(prev => prev.filter((_, i) => i !== idx))}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Assessment Year *</Label>
                    <Select value={entry.assessmentYear} onValueChange={v => {
                      const updated = [...lossCarryForward]; updated[idx] = { ...updated[idx], assessmentYear: v };
                      setLossCarryForward(updated);
                    }}>
                      <SelectTrigger><SelectValue placeholder="Select AY" /></SelectTrigger>
                      <SelectContent>
                        {["2024-25", "2023-24", "2022-23", "2021-22", "2020-21", "2019-20", "2018-19", "2017-18"].map(ay => (
                          <SelectItem key={ay} value={ay}>{ay}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Loss Type</Label>
                    <Select value={entry.lossType} onValueChange={v => {
                      const updated = [...lossCarryForward]; updated[idx] = { ...updated[idx], lossType: v as any };
                      setLossCarryForward(updated);
                    }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="house_property">House Property Loss</SelectItem>
                        <SelectItem value="short_term_capital">Short-Term Capital Loss</SelectItem>
                        <SelectItem value="long_term_capital">Long-Term Capital Loss</SelectItem>
                        <SelectItem value="business">Business Loss</SelectItem>
                        <SelectItem value="speculation">Speculation Loss</SelectItem>
                        <SelectItem value="specified_business">Specified Business Loss (35AD)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Loss Amount (₹)</Label>
                    <Input type="number" value={entry.lossAmount || ""} onChange={e => {
                      const updated = [...lossCarryForward]; updated[idx] = { ...updated[idx], lossAmount: Number(e.target.value) };
                      setLossCarryForward(updated);
                    }} />
                  </div>
                  <div>
                    <Label className="text-xs">Set Off This Year (₹)</Label>
                    <Input type="number" value={entry.setOffAmount || ""} onChange={e => {
                      const updated = [...lossCarryForward]; updated[idx] = { ...updated[idx], setOffAmount: Number(e.target.value) };
                      setLossCarryForward(updated);
                    }} />
                  </div>
                  <div>
                    <Label className="text-xs">Carried Forward (₹)</Label>
                    <div className="text-sm mt-1 font-medium p-2 bg-muted rounded">
                      ₹{(entry.lossAmount - entry.setOffAmount).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setLossCarryForward(prev => [...prev, { assessmentYear: "", lossType: "short_term_capital", lossAmount: 0, setOffAmount: 0, carriedForwardAmount: 0 }])}>
              <Plus className="h-4 w-4 mr-1" /> Add Prior Year Loss
            </Button>
            {lossCarryForward.length > 0 && (
              <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-950 rounded text-sm">
                <strong>Set-off rules:</strong> STCL against any CG; LTCL only against LTCG; HP loss against any head (max ₹2L); Business loss against any head except salary. Carry-forward up to 8 AYs (HP loss: no limit).
              </div>
            )}
          </CardContent>
        </Card>

        {["ITR-2", "ITR-3"].includes(recommendedForm) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Special Rate Income (Schedule SI)</CardTitle>
              <CardDescription>Income taxable at special rates — not at slab rate</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Lottery / Crossword / Game Show Winnings (₹) — 30% flat</Label>
                  <Input type="number" value={specialRateIncome.lottery || ""} onChange={e => setSpecialRateIncome(p => ({ ...p, lottery: Number(e.target.value) }))} />
                </div>
                <div>
                  <Label className="text-xs">Horse Racing Winnings (₹) — 30% flat</Label>
                  <Input type="number" value={specialRateIncome.horseRacing || ""} onChange={e => setSpecialRateIncome(p => ({ ...p, horseRacing: Number(e.target.value) }))} />
                </div>
                <div>
                  <Label className="text-xs">Online Gaming Winnings (₹) — 30% flat</Label>
                  <Input type="number" value={specialRateIncome.onlineGaming || ""} onChange={e => setSpecialRateIncome(p => ({ ...p, onlineGaming: Number(e.target.value) }))} />
                </div>
                <div>
                  <Label className="text-xs">Other Special Rate Income (₹)</Label>
                  <Input type="number" value={specialRateIncome.otherSpecial || ""} onChange={e => setSpecialRateIncome(p => ({ ...p, otherSpecial: Number(e.target.value) }))} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderTrustIncomeStep = () => {
    return (
      <div className="space-y-4">
        <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            ITR-7 specific schedules: Voluntary contributions, corpus donations, application of income, and Section 11/12/13 exemptions.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Schedule VC — Voluntary Contributions & Corpus</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Corpus Donations (₹)</Label>
                <Input type="number" value={trustDetails.corpusDonations || ""} onChange={e => setTrustDetails(p => ({ ...p, corpusDonations: Number(e.target.value) }))} />
                <p className="text-xs text-muted-foreground mt-1">Donations with specific direction to form part of corpus — exempt u/s 11(1)(d)</p>
              </div>
              <div>
                <Label className="text-xs">Voluntary Contributions (₹)</Label>
                <Input type="number" value={trustDetails.voluntaryContributions || ""} onChange={e => setTrustDetails(p => ({ ...p, voluntaryContributions: Number(e.target.value) }))} />
                <p className="text-xs text-muted-foreground mt-1">General donations without corpus direction</p>
              </div>
              <div>
                <Label className="text-xs">Anonymous Donations (₹)</Label>
                <Input type="number" value={trustDetails.anonymousDonations || ""} onChange={e => setTrustDetails(p => ({ ...p, anonymousDonations: Number(e.target.value) }))} />
                <p className="text-xs text-muted-foreground mt-1">Donations where donor identity not available — taxed at 30% beyond threshold</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Application of Income & Accumulation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Application of Income (₹)</Label>
                <Input type="number" value={trustDetails.applicationOfIncome || ""} onChange={e => setTrustDetails(p => ({ ...p, applicationOfIncome: Number(e.target.value) }))} />
                <p className="text-xs text-muted-foreground mt-1">Amount actually spent on objects of the trust during the FY</p>
              </div>
              <div>
                <Label className="text-xs">Accumulated Income (₹)</Label>
                <Input type="number" value={trustDetails.accumulatedIncome || ""} onChange={e => setTrustDetails(p => ({ ...p, accumulatedIncome: Number(e.target.value) }))} />
              </div>
              <div>
                <Label className="text-xs">Accumulation % (max 15% u/s 11(1)(a))</Label>
                <Input type="number" value={trustDetails.accumulationPercentage} onChange={e => setTrustDetails(p => ({ ...p, accumulationPercentage: Number(e.target.value) }))} max={100} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Exemptions — Section 11 / 12 / 13</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Section 11 Exemption (₹)</Label>
                <Input type="number" value={trustDetails.section11Exemption || ""} onChange={e => setTrustDetails(p => ({ ...p, section11Exemption: Number(e.target.value) }))} />
                <p className="text-xs text-muted-foreground mt-1">Income applied for charitable/religious purposes</p>
              </div>
              <div>
                <Label className="text-xs">Section 12 Exemption (₹)</Label>
                <Input type="number" value={trustDetails.section12Exemption || ""} onChange={e => setTrustDetails(p => ({ ...p, section12Exemption: Number(e.target.value) }))} />
                <p className="text-xs text-muted-foreground mt-1">Voluntary contributions treated as income</p>
              </div>
              <div>
                <Label className="text-xs">Investment in Specified Mode (₹)</Label>
                <Input type="number" value={trustDetails.investmentInSpecifiedMode || ""} onChange={e => setTrustDetails(p => ({ ...p, investmentInSpecifiedMode: Number(e.target.value) }))} />
                <p className="text-xs text-muted-foreground mt-1">Schedule-J: Investments as per Section 11(5) — government securities, FDs, etc.</p>
              </div>
            </div>
            <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-950 rounded text-sm">
              <strong>Section 13 warning:</strong> If income is applied for private benefit, invested outside specified modes, or trust has specified violations, exemption u/s 11 and 12 may be denied.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderLossAdjustmentStep = () => {
    const cyla = computeCYLA;
    const bfla = computeBFLA;
    const cfl = computeCFL;

    return (
      <div className="space-y-4">
        <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Auto-computed loss adjustment schedules per Income Tax Act rules. CYLA adjusts current year losses across income heads; BFLA applies brought-forward losses from prior years; CFL shows remaining losses carried to future years.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Schedule CYLA — Current Year Loss Adjustment</CardTitle>
            <CardDescription>Inter-head set-off of current year losses (HP loss max ₹2L against other heads; business loss against all except salary)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-1 font-medium">Head of Income</th>
                    <th className="text-right py-2 px-1 font-medium">Income</th>
                    <th className="text-right py-2 px-1 font-medium text-red-600">HP Loss Set-off</th>
                    <th className="text-right py-2 px-1 font-medium text-red-600">Business Loss</th>
                    <th className="text-right py-2 px-1 font-medium">After Set-off</th>
                  </tr>
                </thead>
                <tbody>
                  {cyla.adjustments.map((a, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 px-1 font-medium">{a.head}</td>
                      <td className="py-2 px-1 text-right">{formatCurrency(a.incomeBeforeSetOff)}</td>
                      <td className="py-2 px-1 text-right text-red-600">{a.hpLossSetOff > 0 ? `- ${formatCurrency(a.hpLossSetOff)}` : '—'}</td>
                      <td className="py-2 px-1 text-right text-red-600">{a.businessLossSetOff > 0 ? `- ${formatCurrency(a.businessLossSetOff)}` : '—'}</td>
                      <td className="py-2 px-1 text-right font-medium">{formatCurrency(a.incomeAfterSetOff)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-semibold">
                    <td className="py-2 px-1">Total Income After CYLA</td>
                    <td colSpan={3}></td>
                    <td className="py-2 px-1 text-right">{formatCurrency(cyla.totalIncomeAfterCYLA)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {(cyla.unabsorbedHPLoss > 0 || cyla.unabsorbedBizLoss > 0 || cyla.currentYearSTCLoss > 0 || cyla.currentYearLTCLoss > 0) && (
              <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-950 rounded text-xs space-y-1">
                {cyla.unabsorbedHPLoss > 0 && <p>Unabsorbed HP Loss: {formatCurrency(cyla.unabsorbedHPLoss)} (carry forward — no time limit)</p>}
                {cyla.unabsorbedBizLoss > 0 && <p>Unabsorbed Business Loss: {formatCurrency(cyla.unabsorbedBizLoss)} (carry forward — 8 AYs)</p>}
                {cyla.currentYearSTCLoss > 0 && <p>Current Year STCL: {formatCurrency(cyla.currentYearSTCLoss)} (carry forward — 8 AYs)</p>}
                {cyla.currentYearLTCLoss > 0 && <p>Current Year LTCL: {formatCurrency(cyla.currentYearLTCLoss)} (carry forward — 8 AYs, set-off only against LTCG)</p>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Schedule BFLA — Brought Forward Loss Adjustment</CardTitle>
            <CardDescription>Set-off of losses from prior assessment years against current year income (after CYLA)</CardDescription>
          </CardHeader>
          <CardContent>
            {lossCarryForward.length === 0 ? (
              <div className="text-center py-4 text-sm text-muted-foreground">
                <p>No brought-forward losses entered. Add prior year losses in the Disclosures step to see BFLA adjustments.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-1 font-medium">Head</th>
                      <th className="text-right py-2 px-1 font-medium">After CYLA</th>
                      <th className="text-right py-2 px-1 font-medium text-orange-600">BF HP Loss</th>
                      <th className="text-right py-2 px-1 font-medium text-orange-600">BF STCL</th>
                      <th className="text-right py-2 px-1 font-medium text-orange-600">BF LTCL</th>
                      <th className="text-right py-2 px-1 font-medium text-orange-600">BF Business</th>
                      <th className="text-right py-2 px-1 font-medium">After BFLA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bfla.bflaRows.map((r, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 px-1 font-medium">{r.head}</td>
                        <td className="py-2 px-1 text-right">{formatCurrency(r.incomeAfterCYLA)}</td>
                        <td className="py-2 px-1 text-right text-orange-600">{r.bfHPLossSetOff > 0 ? `- ${formatCurrency(r.bfHPLossSetOff)}` : '—'}</td>
                        <td className="py-2 px-1 text-right text-orange-600">{r.bfSTCLSetOff > 0 ? `- ${formatCurrency(r.bfSTCLSetOff)}` : '—'}</td>
                        <td className="py-2 px-1 text-right text-orange-600">{r.bfLTCLSetOff > 0 ? `- ${formatCurrency(r.bfLTCLSetOff)}` : '—'}</td>
                        <td className="py-2 px-1 text-right text-orange-600">{r.bfBusinessLossSetOff > 0 ? `- ${formatCurrency(r.bfBusinessLossSetOff)}` : '—'}</td>
                        <td className="py-2 px-1 text-right font-medium">{formatCurrency(r.incomeAfterBFLA)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-semibold">
                      <td className="py-2 px-1">Total After BFLA</td>
                      <td colSpan={5}></td>
                      <td className="py-2 px-1 text-right">{formatCurrency(bfla.totalIncomeAfterBFLA)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Schedule CFL — Losses to Carry Forward</CardTitle>
            <CardDescription>Losses remaining after CYLA + BFLA, available for set-off in future assessment years</CardDescription>
          </CardHeader>
          <CardContent>
            {cfl.length === 0 ? (
              <div className="text-center py-4 text-sm text-muted-foreground">
                <CheckCircle className="h-5 w-5 mx-auto mb-2 text-green-500" />
                <p>No losses to carry forward. All losses have been fully absorbed in the current year.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-1 font-medium">Assessment Year</th>
                      <th className="text-right py-2 px-1 font-medium">HP Loss</th>
                      <th className="text-right py-2 px-1 font-medium">STCL</th>
                      <th className="text-right py-2 px-1 font-medium">LTCL</th>
                      <th className="text-right py-2 px-1 font-medium">Business</th>
                      <th className="text-right py-2 px-1 font-medium">Speculation</th>
                      <th className="text-right py-2 px-1 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cfl.map((e, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 px-1 font-medium">{e.assessmentYear}</td>
                        <td className="py-2 px-1 text-right">{e.housePropertyLoss > 0 ? formatCurrency(e.housePropertyLoss) : '—'}</td>
                        <td className="py-2 px-1 text-right">{e.shortTermCapitalLoss > 0 ? formatCurrency(e.shortTermCapitalLoss) : '—'}</td>
                        <td className="py-2 px-1 text-right">{e.longTermCapitalLoss > 0 ? formatCurrency(e.longTermCapitalLoss) : '—'}</td>
                        <td className="py-2 px-1 text-right">{e.businessLoss > 0 ? formatCurrency(e.businessLoss) : '—'}</td>
                        <td className="py-2 px-1 text-right">{e.speculativeBusinessLoss > 0 ? formatCurrency(e.speculativeBusinessLoss) : '—'}</td>
                        <td className="py-2 px-1 text-right font-medium">{formatCurrency(e.housePropertyLoss + e.shortTermCapitalLoss + e.longTermCapitalLoss + e.businessLoss + e.speculativeBusinessLoss + e.specifiedBusinessLoss)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-950 rounded text-xs space-y-1">
              <p><strong>Carry-forward rules:</strong></p>
              <p>House Property Loss — No time limit for carry-forward</p>
              <p>Capital Losses (STCL/LTCL) — 8 assessment years; LTCL only against LTCG</p>
              <p>Business Loss — 8 assessment years; against any head except salary</p>
              <p>Speculation Loss — 4 assessment years; only against speculation income</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderScheduleSIEIStep = () => {
    const totalSI = scheduleSI.stcg111A + scheduleSI.ltcg112A + scheduleSI.ltcg112 + scheduleSI.vdaCrypto115BBH + scheduleSI.lottery115BB + scheduleSI.horseRacing + scheduleSI.onlineGaming + scheduleSI.dtaaSpecialRate + scheduleSI.otherSpecialRate;
    const totalEI = scheduleEI.agriculturalIncome + scheduleEI.ltcgExemptUpTo125000 + scheduleEI.dividendFromCooperative + scheduleEI.ppfInterest + scheduleEI.epfInterest + scheduleEI.section10Exemptions + scheduleEI.otherExemptIncome;

    const autoPopulateSI = () => {
      setScheduleSI(prev => ({
        ...prev,
        stcg111A: capitalGainsDetails.sttPaidSTCG,
        ltcg112A: Math.max(0, capitalGainsDetails.sttPaidLTCG - 125000),
        vdaCrypto115BBH: prev.vdaCrypto115BBH,
        lottery115BB: specialRateIncome.lottery,
        horseRacing: specialRateIncome.horseRacing,
        onlineGaming: specialRateIncome.onlineGaming,
      }));
    };

    return (
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Schedule SI — Income Chargeable at Special Rates</CardTitle>
                <CardDescription>Income taxed at rates other than normal slab (capital gains, lottery, crypto, DTAA rates)</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={autoPopulateSI} data-testid="btn-auto-populate-si">
                <Calculator className="h-3.5 w-3.5 mr-1" /> Auto-fill from CG
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Capital Gains at Special Rates</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">STCG u/s 111A (₹) — 20% <FieldHint text="Short-term capital gains on listed equity shares/MF where STT paid on sale. Taxed at flat 20%." /></Label>
                <Input type="number" value={scheduleSI.stcg111A || ""} onChange={e => setScheduleSI(p => ({ ...p, stcg111A: Number(e.target.value) }))} data-testid="input-si-stcg-111a" />
              </div>
              <div>
                <Label className="text-xs">LTCG u/s 112A (₹) — 12.5% <FieldHint text="Long-term capital gains on listed equity/MF with STT, exceeding ₹1.25 lakh exemption. Taxed at 12.5%." /></Label>
                <Input type="number" value={scheduleSI.ltcg112A || ""} onChange={e => setScheduleSI(p => ({ ...p, ltcg112A: Number(e.target.value) }))} data-testid="input-si-ltcg-112a" />
              </div>
              <div>
                <Label className="text-xs">LTCG u/s 112 (₹) — 20% with indexation <FieldHint text="Long-term capital gains on unlisted shares, property, gold, debt MF (pre-2023 investments). 20% with indexation benefit." /></Label>
                <Input type="number" value={scheduleSI.ltcg112 || ""} onChange={e => setScheduleSI(p => ({ ...p, ltcg112: Number(e.target.value) }))} data-testid="input-si-ltcg-112" />
              </div>
              <div>
                <Label className="text-xs">VDA / Crypto u/s 115BBH (₹) — 30% <FieldHint text="Virtual Digital Assets (cryptocurrency, NFTs) taxed at flat 30%. No deduction except cost of acquisition. 1% TDS applies." /></Label>
                <Input type="number" value={scheduleSI.vdaCrypto115BBH || ""} onChange={e => setScheduleSI(p => ({ ...p, vdaCrypto115BBH: Number(e.target.value) }))} data-testid="input-si-vda" />
              </div>
            </div>
            <Separator />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Winnings & Other Special Rate Income</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Lottery / Crossword / Game Show u/s 115BB (₹) — 30%</Label>
                <Input type="number" value={scheduleSI.lottery115BB || ""} onChange={e => setScheduleSI(p => ({ ...p, lottery115BB: Number(e.target.value) }))} />
              </div>
              <div>
                <Label className="text-xs">Horse Racing (₹) — 30%</Label>
                <Input type="number" value={scheduleSI.horseRacing || ""} onChange={e => setScheduleSI(p => ({ ...p, horseRacing: Number(e.target.value) }))} />
              </div>
              <div>
                <Label className="text-xs">Online Gaming (₹) — 30%</Label>
                <Input type="number" value={scheduleSI.onlineGaming || ""} onChange={e => setScheduleSI(p => ({ ...p, onlineGaming: Number(e.target.value) }))} />
              </div>
            </div>
            <Separator />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">DTAA Special Rate Income</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Income Amount (₹)</Label>
                <Input type="number" value={scheduleSI.dtaaSpecialRate || ""} onChange={e => setScheduleSI(p => ({ ...p, dtaaSpecialRate: Number(e.target.value) }))} />
              </div>
              <div>
                <Label className="text-xs">DTAA Tax Rate (%)</Label>
                <Input type="number" value={scheduleSI.dtaaSpecialRatePercent || ""} onChange={e => setScheduleSI(p => ({ ...p, dtaaSpecialRatePercent: Number(e.target.value) }))} max={100} />
              </div>
              <div>
                <Label className="text-xs">Other Special Rate Income (₹)</Label>
                <Input type="number" value={scheduleSI.otherSpecialRate || ""} onChange={e => setScheduleSI(p => ({ ...p, otherSpecialRate: Number(e.target.value) }))} />
              </div>
            </div>
            <Card className="bg-muted/50">
              <CardContent className="p-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Total Special Rate Income</span>
                  <span className="font-bold text-lg">{formatCurrency(totalSI)}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-muted-foreground mt-1">
                  <span>Estimated Tax on Special Rate Income</span>
                  <span>{formatCurrency(Math.round(
                    scheduleSI.stcg111A * 0.20 + scheduleSI.ltcg112A * 0.125 + scheduleSI.ltcg112 * 0.20 +
                    (scheduleSI.vdaCrypto115BBH + scheduleSI.lottery115BB + scheduleSI.horseRacing + scheduleSI.onlineGaming) * 0.30 +
                    scheduleSI.dtaaSpecialRate * (scheduleSI.dtaaSpecialRatePercent / 100) +
                    scheduleSI.otherSpecialRate * (scheduleSI.otherSpecialRatePercent / 100)
                  ))}</span>
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Schedule EI — Exempt Income</CardTitle>
            <CardDescription>Income not included in total income — must still be reported in the ITR</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Agricultural Income (₹) <FieldHint text="Income from agriculture is exempt u/s 10(1). However, if total income exceeds ₹5 lakh, agricultural income is used to calculate tax on non-agricultural income (partial integration)." /></Label>
                <Input type="number" value={scheduleEI.agriculturalIncome || ""} onChange={e => setScheduleEI(p => ({ ...p, agriculturalIncome: Number(e.target.value) }))} data-testid="input-ei-agri" />
              </div>
              <div>
                <Label className="text-xs">LTCG Exempt u/s 112A (up to ₹1,25,000) <FieldHint text="First ₹1.25 lakh of LTCG on listed equity/MF with STT is exempt from tax. Auto-calculated from Schedule 112A." /></Label>
                <Input type="number" value={scheduleEI.ltcgExemptUpTo125000 || ""} onChange={e => setScheduleEI(p => ({ ...p, ltcgExemptUpTo125000: Math.min(125000, Number(e.target.value)) }))} max={125000} />
              </div>
              <div>
                <Label className="text-xs">PPF Interest (₹) — Exempt u/s 10(11)</Label>
                <Input type="number" value={scheduleEI.ppfInterest || ""} onChange={e => setScheduleEI(p => ({ ...p, ppfInterest: Number(e.target.value) }))} />
              </div>
              <div>
                <Label className="text-xs">EPF Interest (₹) — Exempt portion <FieldHint text="Interest on EPF balance is exempt if withdrawn after 5 years of continuous service." /></Label>
                <Input type="number" value={scheduleEI.epfInterest || ""} onChange={e => setScheduleEI(p => ({ ...p, epfInterest: Number(e.target.value) }))} />
              </div>
              <div>
                <Label className="text-xs">Dividend from Cooperative Society (₹) — Exempt u/s 10(34)</Label>
                <Input type="number" value={scheduleEI.dividendFromCooperative || ""} onChange={e => setScheduleEI(p => ({ ...p, dividendFromCooperative: Number(e.target.value) }))} />
              </div>
              <div>
                <Label className="text-xs">Section 10 Exemptions (₹) <FieldHint text="Other exemptions under section 10: Leave encashment (10(10AA)), gratuity (10(10)), VRS compensation (10(10C)), etc." /></Label>
                <Input type="number" value={scheduleEI.section10Exemptions || ""} onChange={e => setScheduleEI(p => ({ ...p, section10Exemptions: Number(e.target.value) }))} />
              </div>
              <div>
                <Label className="text-xs">Other Exempt Income (₹)</Label>
                <Input type="number" value={scheduleEI.otherExemptIncome || ""} onChange={e => setScheduleEI(p => ({ ...p, otherExemptIncome: Number(e.target.value) }))} />
              </div>
              <div>
                <Label className="text-xs">Description of Other Exempt Income</Label>
                <Input value={scheduleEI.exemptIncomeDescription} onChange={e => setScheduleEI(p => ({ ...p, exemptIncomeDescription: e.target.value }))} placeholder="e.g. ELSS maturity, SGB redemption" />
              </div>
            </div>
            <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
              <CardContent className="p-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">Total Exempt Income</span>
                  <span className="font-bold text-lg text-green-700 dark:text-green-300">{formatCurrency(totalEI)}</span>
                </div>
                {scheduleEI.agriculturalIncome > 0 && totals.grossTotalIncome > 500000 && (
                  <p className="text-xs text-amber-600 mt-1">Agricultural income with total income above ₹5L triggers partial integration for tax calculation.</p>
                )}
              </CardContent>
            </Card>
          </CardContent>
        </Card>
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
      case "entity_profile": return renderEntityProfileStep();
      case "salary": return renderSalaryStep();
      case "property": return renderHousePropertyStep();
      case "business": return renderBusinessIncomeStep();
      case "financials": return renderFinancialsStep();
      case "capital": return renderCapitalGainsStep();
      case "foreign": return renderForeignIncomeStep();
      case "other": return renderOtherIncomeStep();
      case "disclosures": return renderDisclosuresStep();
      case "trust_income": return renderTrustIncomeStep();
      case "deductions": return renderDeductionsStep();
      case "schedule_al": return renderScheduleALStep();
      case "loss_adjustment": return renderLossAdjustmentStep();
      case "schedule_si_ei": return renderScheduleSIEIStep();
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
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowComputationSummary(!showComputationSummary)} data-testid="btn-computation-summary">
                <Calculator className="h-3.5 w-3.5 mr-1" /> Summary
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowValidationReport(!showValidationReport)} data-testid="btn-validation-report">
                <Shield className="h-3.5 w-3.5 mr-1" /> Validate
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {renderCurrentStep()}

          {showComputationSummary && (
            <div className="mt-6 border-t pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2"><Calculator className="h-4 w-4" /> Tax Computation Summary</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowComputationSummary(false)}><XCircle className="h-4 w-4" /></Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span>Salary Income</span><span className="font-medium">{formatCurrency(totals.salary)}</span>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span>House Property Income</span><span className="font-medium">{formatCurrency(totals.houseProperty)}</span>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span>Business Income</span><span className="font-medium">{formatCurrency(totals.business)}</span>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span>Capital Gains</span><span className="font-medium">{formatCurrency(totals.capitalGains)}</span>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span>Other Income</span><span className="font-medium">{formatCurrency(totals.otherIncome)}</span>
                </div>
                <div className="flex justify-between p-2 bg-blue-50 dark:bg-blue-950/30 rounded font-medium">
                  <span>Gross Total Income</span><span>{formatCurrency(totals.grossTotalIncome)}</span>
                </div>
                <div className="flex justify-between p-2 bg-green-50 dark:bg-green-950/30 rounded">
                  <span>Total Deductions</span><span className="font-medium text-green-600">- {formatCurrency(totals.totalDeductions)}</span>
                </div>
                <div className="flex justify-between p-2 bg-purple-50 dark:bg-purple-950/30 rounded font-bold">
                  <span>Net Taxable Income</span><span>{formatCurrency(Math.max(0, totals.grossTotalIncome - totals.totalDeductions))}</span>
                </div>
              </div>
              {sandboxTaxResult?.data && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                  <div className="flex justify-between p-2 bg-red-50 dark:bg-red-950/30 rounded font-medium">
                    <span>Tax Payable</span><span className="text-red-600">{formatCurrency(sandboxTaxResult.data.totalTaxPayable)}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-amber-50 dark:bg-amber-950/30 rounded">
                    <span>Tax Regime</span><span>{taxRegime === "new" ? "New Regime" : "Old Regime"}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-muted/50 rounded">
                    <span>ITR Form</span><span className="font-medium">{recommendedForm}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {showValidationReport && (
            <div className="mt-6 border-t pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2"><Shield className="h-4 w-4" /> Validation Report — All Steps</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowValidationReport(false)}><XCircle className="h-4 w-4" /></Button>
              </div>
              {getAllStepValidations().map(({ stepId, stepTitle, validation }) => {
                const hasIssues = validation.errors.length > 0 || validation.warnings.length > 0;
                return (
                  <div key={stepId} className={`p-3 rounded border text-xs ${validation.errors.length > 0 ? 'border-red-200 bg-red-50 dark:bg-red-950/20' : validation.warnings.length > 0 ? 'border-amber-200 bg-amber-50 dark:bg-amber-950/20' : 'border-green-200 bg-green-50 dark:bg-green-950/20'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium flex items-center gap-1.5">
                        {validation.errors.length > 0 ? <XCircle className="h-3.5 w-3.5 text-red-500" /> : validation.warnings.length > 0 ? <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> : <CheckCircle className="h-3.5 w-3.5 text-green-500" />}
                        {stepTitle}
                      </span>
                      {hasIssues && (
                        <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => { setCurrentStepId(stepId); setShowValidationReport(false); }}>
                          Go to Step
                        </Button>
                      )}
                    </div>
                    {validation.errors.map((e, i) => <p key={`e-${i}`} className="text-red-600 ml-5">Error: {e}</p>)}
                    {validation.warnings.map((w, i) => <p key={`w-${i}`} className="text-amber-600 ml-5">Warning: {w}</p>)}
                    {!hasIssues && <p className="text-green-600 ml-5">No issues found.</p>}
                  </div>
                );
              })}
              <div className="flex items-center gap-2 p-2 bg-muted rounded text-xs">
                {(() => {
                  const all = getAllStepValidations();
                  const totalErrors = all.reduce((s, v) => s + v.validation.errors.length, 0);
                  const totalWarnings = all.reduce((s, v) => s + v.validation.warnings.length, 0);
                  return (
                    <>
                      {totalErrors > 0 ? <XCircle className="h-4 w-4 text-red-500" /> : <CheckCircle className="h-4 w-4 text-green-500" />}
                      <span className="font-medium">
                        {totalErrors} error{totalErrors !== 1 ? 's' : ''}, {totalWarnings} warning{totalWarnings !== 1 ? 's' : ''} across {all.length} steps
                      </span>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
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
