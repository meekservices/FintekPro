import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, UseMutationResult } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { 
  PANContext, SalaryDetails, IncomeSource, HousePropertyDetails, CapitalGainsDetails, 
  OtherIncomeDetails, DeductionDetails, TaxPaymentDetails, 
  BankDetailsForRefund, ITRDraft, StepValidation, LossCarryForward, 
  DirectorshipEntry, UnlistedShareEntry, Schedule112AEntry,
  ScheduleSIDetails, ScheduleEIDetails, Interest234Details, 
  ScheduleSPIEntry, Schedule5ADetails, ScheduleIFEntry, MATDetails, MATCreditDetails, 
  AMTDetails, AMTCreditDetails, TDS1Entry, TDS2Entry, TCSEntry, Section234FDetails, 
  Section87ADetails, ReconciliationResult, ChallanResult, HraResult, Form10EResult, 
  OptimizerResult, PreFilingResult, TaxDeadline, RefundData, IfscResult, SandboxTaxResult,
  Broker, TaxHistoryItem, BrokerUploadInfo, ManualCGEntry, CYLAAdjustment, BFLAAdjustment, CFLEntry,
  ForeignIncomeDetails, BusinessDetails, RegimeComparison, EmployerDetails, BalanceSheetDetails,
  ProfitLossDetails, DepreciationEntry, TaxAuditInfo, EntityProfileDetails, CorporateDetails, TrustDetails,
  ScheduleALDetails, DonationEntry, LossAdjustmentDetails, SpecialRateIncome, FOIncome, CYLAData, BFLAData,
  ItrUDetails, Step, TaxTotals, CGManualSavedItem
} from "./types";
import { STEPS } from "./constants";
import { formatCurrency } from "@/components/tax-itr/TaxITRHelpers";

interface AISData {
  salaryIncome?: number;
  interestIncome?: number;
  dividendIncome?: number;
  loaded: boolean;
  [key: string]: any;
}

interface TaxContextType {
  // Navigation & Meta
  currentStepId: string;
  setCurrentStepId: (id: string) => void;
  safeCurrentStep: number;
  assessmentYear: string;
  setAssessmentYear: (ay: string) => void;
  recommendedForm: string;
  taxRegime: "old" | "new";
  setTaxRegime: (regime: "old" | "new") => void;
  visitedSteps: Set<string>;
  setVisitedSteps: React.Dispatch<React.SetStateAction<Set<string>>>;
  activeSubTab: string;
  setActiveSubTab: (tab: string) => void;
  
  // Queries
  panContext: PANContext | undefined;
  panLoading: boolean;
  historyData: { data: TaxHistoryItem[] } | undefined;
  isLoadingHistory: boolean;
  supportedBrokers: { data: Broker[] } | undefined;
  
  // Primary State
  incomeSources: IncomeSource;
  setIncomeSources: React.Dispatch<React.SetStateAction<IncomeSource>>;
  salaryDetails: SalaryDetails;
  setSalaryDetails: React.Dispatch<React.SetStateAction<SalaryDetails>>;
  housePropertyDetails: HousePropertyDetails;
  setHousePropertyDetails: React.Dispatch<React.SetStateAction<HousePropertyDetails>>;
  capitalGainsDetails: CapitalGainsDetails;
  setCapitalGainsDetails: React.Dispatch<React.SetStateAction<CapitalGainsDetails>>;
  
  // Capital Gains Specific
  cgMode: 'upload' | 'manual' | 'summary';
  setCgMode: (mode: 'upload' | 'manual' | 'summary') => void;
  cgBrokerSearch: string;
  setCgBrokerSearch: (s: string) => void;
  cgSelectedBroker: string | null;
  setCgSelectedBroker: (s: string | null) => void;
  cgUploading: boolean;
  cgUploads: BrokerUploadInfo[];
  setCgUploads: React.Dispatch<React.SetStateAction<BrokerUploadInfo[]>>;
  cgManualAssetType: string;
  setCgManualAssetType: (t: string) => void;
  cgManualEntries: ManualCGEntry[];
  setCgManualEntries: React.Dispatch<React.SetStateAction<ManualCGEntry[]>>;
  cgManualSaved: CGManualSavedItem[];
  setCgManualSaved: React.Dispatch<React.SetStateAction<CGManualSavedItem[]>>;
  
  // Other Income & Filing Details
  foreignIncomeDetails: ForeignIncomeDetails;
  setForeignIncomeDetails: React.Dispatch<React.SetStateAction<ForeignIncomeDetails>>;
  businessDetails: BusinessDetails;
  setBusinessDetails: React.Dispatch<React.SetStateAction<BusinessDetails>>;
  residentialStatus: "resident" | "nri" | "rnor";
  setResidentialStatus: (s: "resident" | "nri" | "rnor") => void;
  filingSection: string;
  setFilingSection: (s: string) => void;
  employerDetails: EmployerDetails;
  setEmployerDetails: React.Dispatch<React.SetStateAction<EmployerDetails>>;
  otherIncomeDetails: OtherIncomeDetails;
  setOtherIncomeDetails: React.Dispatch<React.SetStateAction<OtherIncomeDetails>>;
  deductionDetails: DeductionDetails;
  setDeductionDetails: React.Dispatch<React.SetStateAction<DeductionDetails>>;
  taxPaymentDetails: TaxPaymentDetails;
  setTaxPaymentDetails: React.Dispatch<React.SetStateAction<TaxPaymentDetails>>;
  bankDetails: BankDetailsForRefund;
  setBankDetails: React.Dispatch<React.SetStateAction<BankDetailsForRefund>>;
  
  // Schedules & Advanced
  lossCarryForward: LossCarryForward[];
  setLossCarryForward: React.Dispatch<React.SetStateAction<LossCarryForward[]>>;
  schedule112AEntries: Schedule112AEntry[];
  setSchedule112AEntries: React.Dispatch<React.SetStateAction<Schedule112AEntry[]>>;
  scheduleSI: ScheduleSIDetails;
  setScheduleSI: React.Dispatch<React.SetStateAction<ScheduleSIDetails>>;
  scheduleEI: ScheduleEIDetails;
  setScheduleEI: React.Dispatch<React.SetStateAction<ScheduleEIDetails>>;
  interest234: Interest234Details;
  setInterest234: React.Dispatch<React.SetStateAction<Interest234Details>>;
  scheduleSPI: ScheduleSPIEntry[];
  setScheduleSPI: React.Dispatch<React.SetStateAction<ScheduleSPIEntry[]>>;
  schedule5A: Schedule5ADetails;
  setSchedule5A: React.Dispatch<React.SetStateAction<Schedule5ADetails>>;
  scheduleIF: ScheduleIFEntry[];
  setScheduleIF: React.Dispatch<React.SetStateAction<ScheduleIFEntry[]>>;
  matDetails: MATDetails;
  setMatDetails: React.Dispatch<React.SetStateAction<MATDetails>>;
  matcDetails: MATCreditDetails;
  setMatcDetails: React.Dispatch<React.SetStateAction<MATCreditDetails>>;
  amtDetails: AMTDetails;
  setAmtDetails: React.Dispatch<React.SetStateAction<AMTDetails>>;
  amtcDetails: AMTCreditDetails;
  setAmtcDetails: React.Dispatch<React.SetStateAction<AMTCreditDetails>>;
  tds1Entries: TDS1Entry[];
  setTds1Entries: React.Dispatch<React.SetStateAction<TDS1Entry[]>>;
  tds2Entries: TDS2Entry[];
  setTds2Entries: React.Dispatch<React.SetStateAction<TDS2Entry[]>>;
  tcsEntries: TCSEntry[];
  setTcsEntries: React.Dispatch<React.SetStateAction<TCSEntry[]>>;
  section234F: Section234FDetails;
  setSection234F: React.Dispatch<React.SetStateAction<Section234FDetails>>;
  section87A: Section87ADetails;
  setSection87A: React.Dispatch<React.SetStateAction<Section87ADetails>>;
  balanceSheet: BalanceSheetDetails;
  setBalanceSheet: React.Dispatch<React.SetStateAction<BalanceSheetDetails>>;
  profitLoss: ProfitLossDetails;
  setProfitLoss: React.Dispatch<React.SetStateAction<ProfitLossDetails>>;
  depreciationEntries: DepreciationEntry[];
  setDepreciationEntries: React.Dispatch<React.SetStateAction<DepreciationEntry[]>>;
  taxAuditInfo: TaxAuditInfo;
  setTaxAuditInfo: React.Dispatch<React.SetStateAction<TaxAuditInfo>>;
  entityProfile: EntityProfileDetails;
  setEntityProfile: React.Dispatch<React.SetStateAction<EntityProfileDetails>>;
  corporateDetails: CorporateDetails;
  setCorporateDetails: React.Dispatch<React.SetStateAction<CorporateDetails>>;
  trustDetails: TrustDetails;
  setTrustDetails: React.Dispatch<React.SetStateAction<TrustDetails>>;
  scheduleAL: ScheduleALDetails;
  setScheduleAL: React.Dispatch<React.SetStateAction<ScheduleALDetails>>;
  donationEntries: DonationEntry[];
  setDonationEntries: React.Dispatch<React.SetStateAction<DonationEntry[]>>;
  specialRateIncome: SpecialRateIncome;
  setSpecialRateIncome: React.Dispatch<React.SetStateAction<SpecialRateIncome>>;
  foIncome: FOIncome;
  setFoIncome: React.Dispatch<React.SetStateAction<FOIncome>>;
  
  // UI States & Flags
  isUpdatedReturn: boolean;
  setIsUpdatedReturn: (v: boolean) => void;
  itrUDetails: ItrUDetails;
  setItrUDetails: React.Dispatch<React.SetStateAction<ItrUDetails>>;
  aisLoading: boolean;
  aisData: any;
  setAisData: React.Dispatch<React.SetStateAction<any>>;
  form16Uploading: boolean;
  setForm16Uploading: (v: boolean) => void;
  sandboxTaxResult: SandboxTaxResult | null;
  taxCalcError: string | null;
  
  // Advanced Computations
  computeCYLA: CYLAData;
  computeBFLA: BFLAData;
  computeCFL: CFLEntry[];
  compute234Interest: () => void;
  
  // Computations
  totals: TaxTotals;
  activeSteps: Step[];
  currentStepIndex: number;
  progress: number;
  currentValidation: StepValidation;
  cyla: CYLAData;
  bfla: BFLAData;
  cfl: CFLEntry[];
  
  // Actions
  validateStep: (stepId: string) => StepValidation;
  saveDraft: () => void;
  calculateTax: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (id: string) => void;
  handleFetchAIS: () => Promise<void>;
  handleForm16Upload: (file: File) => Promise<void>;
  handleCgFileUpload: (file: File, brokerId: string) => Promise<void>;
  handleCgManualSave: () => Promise<void>;
  handleFetch26AS: () => Promise<void>;
  taxCalcMutation: UseMutationResult<any, Error, any>;
  regimeCompareMutation: UseMutationResult<RegimeComparison, Error, any>;
}

const TaxContext = createContext<TaxContextType | undefined>(undefined);

export const TaxProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();

  // Navigation & Meta
  const [currentStepId, setCurrentStepId] = useState<string>("basic");
  const [assessmentYear, setAssessmentYear] = useState("2025-26");
  const [recommendedForm, setRecommendedForm] = useState("ITR-1");
  const [taxRegime, setTaxRegime] = useState<"old" | "new">("new");
  const [visitedSteps, setVisitedSteps] = useState<Set<string>>(new Set(["basic"]));
  const [activeSubTab, setActiveSubTab] = useState<string>("wizard");

  // Queries
  const { data: panContext, isLoading: panLoading } = useQuery<PANContext>({
    queryKey: ["/api/tax/pan-context"],
    enabled: isAuthenticated,
  });

  const { data: historyData, isLoading: isLoadingHistory } = useQuery<{ data: TaxHistoryItem[] }>({
    queryKey: ["/api/tax/history", panContext?.pan],
    enabled: !!panContext?.pan && activeSubTab === "history",
  });

  const { data: supportedBrokers } = useQuery<{ data: Broker[] }>({
    queryKey: ["/api/tax/brokers/supported"],
  });

  // Section States
  const [incomeSources, setIncomeSources] = useState<IncomeSource>({
    hasSalary: true, hasHouseProperty: false, hasCapitalGains: false,
    hasBusinessIncome: false, hasForeignIncome: false, hasOtherIncome: false
  });

  const [salaryDetails, setSalaryDetails] = useState<SalaryDetails>({
    grossSalary: 0, allowances: 0, perquisites: 0, profitInLieu: 0,
    standardDeduction: 75000, professionalTax: 0, employerPF: 0
  });

  const [housePropertyDetails, setHousePropertyDetails] = useState<HousePropertyDetails>({
    propertyCount: 1, rentalIncome: 0, municipalTaxes: 0, interestOnLoan: 0, isSelfOccupied: true,
    properties: [{ propertyType: "self_occupied", rentalIncome: 0, municipalTaxes: 0, interestOnLoan: 0, unrealizedRent: 0, address: "" }]
  });

  const [capitalGainsDetails, setCapitalGainsDetails] = useState<CapitalGainsDetails>({
    shortTermGains: 0, longTermGains: 0, exemptionsApplied: 0, sttPaidSTCG: 0, sttNotPaidSTCG: 0,
    sttPaidLTCG: 0, sttNotPaidLTCG: 0, grandfatheringFMV: 0, grandfatheringApplied: false,
  });

  const [cgMode, setCgMode] = useState<'upload' | 'manual' | 'summary'>('upload');
  const [cgBrokerSearch, setCgBrokerSearch] = useState('');
  const [cgSelectedBroker, setCgSelectedBroker] = useState<string | null>(null);
  const [cgUploading, setCgUploading] = useState(false);
  const [cgUploads, setCgUploads] = useState<BrokerUploadInfo[]>([]);
  const [cgManualAssetType, setCgManualAssetType] = useState<string>('shares');
  const [cgManualEntries, setCgManualEntries] = useState<ManualCGEntry[]>([]);
  const [cgManualSaved, setCgManualSaved] = useState<CGManualSavedItem[]>([]);

  const [foreignIncomeDetails, setForeignIncomeDetails] = useState<ForeignIncomeDetails>({
    foreignSTCG: 0, foreignLTCG: 0, foreignDividends: 0, foreignInterest: 0, foreignOtherIncome: 0,
    foreignTaxPaid: 0, dtaaCountry: "US", dtaaArticle: "", currencyCode: "USD", exchangeRate: 83.5,
    hasForeignAssets: true, foreignAssets: [],
  });

  const [businessDetails, setBusinessDetails] = useState<BusinessDetails>({
    businessIncome: 0, grossTurnover: 0, grossReceipts: 0, presumptiveIncome44AD: 0,
    presumptiveIncome44ADA: 0, vehicleCount: 0, presumptiveIncome44AE: 0, isPresumptive: true,
    businessType: "business", businessDescription: "",
  });

  const [residentialStatus, setResidentialStatus] = useState<"resident" | "nri" | "rnor">("resident");
  const [filingSection, setFilingSection] = useState<string>("139(1)");
  const [employerDetails, setEmployerDetails] = useState<EmployerDetails>({ employerName: "", employerTAN: "" });

  const [otherIncomeDetails, setOtherIncomeDetails] = useState<OtherIncomeDetails>({
    interestIncome: 0, dividendIncome: 0, otherSources: 0, agriculturalIncome: 0
  });

  const [deductionDetails, setDeductionDetails] = useState<DeductionDetails>({
    section80C: 0, section80CCC: 0, section80CCD1: 0, section80CCD1B: 0, section80CCD2: 0,
    section80D: 0, section80DD: 0, section80DDB: 0, section80E: 0, section80EEA: 0,
    section80EEB: 0, section80G: 0, section80GG: 0, section80TTA: 0, section80TTB: 0,
    section80U: 0, otherDeductions: 0
  });

  const [taxPaymentDetails, setTaxPaymentDetails] = useState<TaxPaymentDetails>({
    tdsSalary: 0, tdsOtherThanSalary: 0, tdsOnProperty: 0, tcsCollected: 0, tdsDeducted: 0,
    advanceTaxPaid: 0, selfAssessmentTax: 0, reliefUs89: 0
  });

  const [bankDetails, setBankDetails] = useState<BankDetailsForRefund>({
    accountNumber: "", ifscCode: "", bankName: "", accountType: "savings", isPrimary: true
  });

  // Schedules
  const [lossCarryForward, setLossCarryForward] = useState<LossCarryForward[]>([]);
  const [schedule112AEntries, setSchedule112AEntries] = useState<Schedule112AEntry[]>([]);
  const [scheduleSI, setScheduleSI] = useState<ScheduleSIDetails>({
    stcg111A: 0, ltcg112A: 0, ltcg112: 0, vdaCrypto115BBH: 0, lottery115BB: 0, horseRacing: 0,
    onlineGaming: 0, dtaaSpecialRate: 0, dtaaSpecialRatePercent: 10, otherSpecialRate: 0, otherSpecialRatePercent: 20,
  });
  const [scheduleEI, setScheduleEI] = useState<ScheduleEIDetails>({
    agriculturalIncome: 0, ltcgExemptUpTo125000: 0, dividendFromCooperative: 0, ppfInterest: 0,
    epfInterest: 0, section10Exemptions: 0, otherExemptIncome: 0, exemptIncomeDescription: "",
  });
  const [interest234, setInterest234] = useState<Interest234Details>({
    interest234A: 0, interest234B: 0, interest234C: 0, totalInterest: 0, filingDueDate: "2025-07-31",
    filingDate: "", assessedTax: 0, advanceTaxDetails: [
      { quarter: "Q1 (Jun 15)", dueDate: "2024-06-15", amountDue: 0, amountPaid: 0, paidDate: "" },
      { quarter: "Q2 (Sep 15)", dueDate: "2024-09-15", amountDue: 0, amountPaid: 0, paidDate: "" },
      { quarter: "Q3 (Dec 15)", dueDate: "2024-12-15", amountDue: 0, amountPaid: 0, paidDate: "" },
      { quarter: "Q4 (Mar 15)", dueDate: "2025-03-15", amountDue: 0, amountPaid: 0, paidDate: "" },
    ],
  });
  const [scheduleSPI, setScheduleSPI] = useState<ScheduleSPIEntry[]>([]);
  const [schedule5A, setSchedule5A] = useState<Schedule5ADetails>({
    isApplicable: false, nameOfSpouse: "", panOfSpouse: "", totalIncomeOfAssessee: 0, totalIncomeOfSpouse: 0,
    apportionedIncomeAssessee: 0, apportionedIncomeSpouse: 0, headwiseBreakdown: {
      salary: { assessee: 0, spouse: 0 }, houseProperty: { assessee: 0, spouse: 0 }, business: { assessee: 0, spouse: 0 },
      capitalGains: { assessee: 0, spouse: 0 }, otherSources: { assessee: 0, spouse: 0 },
    },
  });
  const [scheduleIF, setScheduleIF] = useState<ScheduleIFEntry[]>([]);
  const [matDetails, setMatDetails] = useState<MATDetails>({
    isApplicable: false, bookProfitBeforeAdjustments: 0, additionsToBookProfit: { incomeTaxProvision: 0, deferredTax: 0, dividendPaid: 0, carriedForwardLosses: 0, unabsorbedDepreciation: 0, transferToReserve: 0, provisionForDiminution: 0, expenditureRelatingExemptIncome: 0, notionalGain: 0, otherAdditions: 0 }, deductionsFromBookProfit: { withdrawalFromReserve: 0, incomeExemptUs10: 0, incomeExemptUs11_12: 0, depreciationExcludingRevaluation: 0, withdrawalFromProvision: 0, lowerOfUnabsorbedDepOrBroughtForwardLoss: 0, notionalLoss: 0, otherDeductions: 0 }, 
    adjustedBookProfit: 0, matRate: 15, matTaxAmount: 0, surchargeOnMAT: 0, cessOnMAT: 0, totalMATLiability: 0, normalTaxLiability: 0, isMATApplicable: false, taxPayableHigherOfMATOrNormal: 0,
  });
  const [matcDetails, setMatcDetails] = useState<MATCreditDetails>({
    isApplicable: false, creditEntries: [], totalCreditBroughtForward: 0, creditUtilizedCurrentYear: 0, creditCarriedForward: 0, creditSetOffLimit: 0,
  });
  const [amtDetails, setAmtDetails] = useState<AMTDetails>({
    isApplicable: false, adjustedTotalIncome: 0, additions: { deduction80H_80RRB: 0, deduction10AA: 0, deduction35AD: 0, deduction80IA_80IB: 0, deduction80JJA: 0, deduction80P: 0, otherChapter6ADeductions: 0 },
    totalAdjustedIncome: 0, amtRate: 18.5, amtAmount: 0, surchargeOnAMT: 0, cessOnAMT: 0, totalAMTLiability: 0, normalTaxLiability: 0, isAMTApplicable: false, taxPayableHigherOfAMTOrNormal: 0,
  });
  const [amtcDetails, setAmtcDetails] = useState<AMTCreditDetails>({
    isApplicable: false, creditEntries: [], totalCreditBroughtForward: 0, creditUtilizedCurrentYear: 0, creditCarriedForward: 0,
  });
  const [tds1Entries, setTds1Entries] = useState<TDS1Entry[]>([]);
  const [tds2Entries, setTds2Entries] = useState<TDS2Entry[]>([]);
  const [tcsEntries, setTcsEntries] = useState<TCSEntry[]>([]);
  const [section234F, setSection234F] = useState<Section234FDetails>({
    isApplicable: false, filingDueDate: "2025-07-31", actualFilingDate: "", totalIncome: 0, lateFee: 0, isSmallTaxpayer: false,
  });
  const [section87A, setSection87A] = useState<Section87ADetails>({
    isEligible: false, taxableIncome: 0, normalTaxLiability: 0, rebateAmount: 0, maxRebateOldRegime: 12500, maxRebateNewRegime: 25000, incomeThresholdOld: 500000, incomeThresholdNew: 700000, taxAfterRebate: 0,
  });

  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetDetails>({
    fixedAssets: 0, investments: 0, currentAssets: 0, loansAndAdvances: 0, otherAssets: 0, totalAssets: 0, capital: 0, reservesAndSurplus: 0, securedLoans: 0, unsecuredLoans: 0, currentLiabilities: 0, totalLiabilities: 0,
  });
  const [profitLoss, setProfitLoss] = useState<ProfitLossDetails>({
    grossRevenue: 0, otherOperatingIncome: 0, totalRevenue: 0, purchasesAndDirectExpenses: 0, employeeBenefitExpenses: 0, depreciation: 0, otherExpenses: 0, totalExpenses: 0, netProfitBeforeTax: 0,
  });
  const [depreciationEntries, setDepreciationEntries] = useState<DepreciationEntry[]>([]);
  const [taxAuditInfo, setTaxAuditInfo] = useState<TaxAuditInfo>({
    isAuditRequired: false, auditorName: "", auditorMembershipNo: "", auditDate: "", form3CA_3CD: false, form3CB_3CD: false, auditReportFiled: false,
  });
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
    immovableProperty: 0, movableAssets: 0, bankDeposits: 0, sharesAndSecurities: 0, insurancePolicies: 0, loansAndAdvancesGiven: 0, cashInHand: 0, jewelleryBullion: 0, archaeologicalCollections: 0, vehiclesYachtsBoats: 0, totalAssets: 0, totalLiabilities: 0, liabilitiesRelatedToImmovable: 0, liabilitiesRelatedToOther: 0,
  });
  const [specialRateIncome, setSpecialRateIncome] = useState<SpecialRateIncome>({
    lottery: 0, horseRacing: 0, onlineGaming: 0, otherSpecial: 0,
  });
  const [foIncome, setFoIncome] = useState<FOIncome>({
    futuresGains: 0, optionsGains: 0, intradayGains: 0, isSpeculative: false
  });
  const [donationEntries, setDonationEntries] = useState<DonationEntry[]>([]);
  const [isUpdatedReturn, setIsUpdatedReturn] = useState(false);
  const [itrUDetails, setItrUDetails] = useState<ItrUDetails>({ originalAckNumber: "", originalFilingDate: "", reasonForUpdate: "income_not_reported", additionalTaxPayable: 0, lateFee234F: 0, additionalInterest: 0 });
  const [aisLoading, setAisLoading] = useState(false);
  const [aisData, setAisData] = useState<AISData | null>(null);
  const [form26ASLoading, setForm26ASLoading] = useState(false);
  const [form16Uploading, setForm16Uploading] = useState(false);
  
  const handleFetch26AS = async (): Promise<void> => {
    if (!panContext?.pan) return;
    setForm26ASLoading(true);
    try {
      const res = await apiRequest(`/api/tax/26as?pan=${panContext.pan}`, { method: "GET" });
      setTaxPaymentDetails((prev: TaxPaymentDetails) => ({
        ...prev,
        tdsSalary: res.tdsSalary || 0,
        tdsOtherThanSalary: res.tdsOther || 0,
        tdsDeducted: (res.tdsSalary || 0) + (res.tdsOther || 0) + (res.tdsProperty || 0),
        advanceTaxPaid: res.advanceTax || 0,
        selfAssessmentTax: res.selfAssessment || 0,
      }));
      toast({ title: "Form 26AS Fetched", description: "Tax payments have been auto-filled." });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Fetch failed";
      toast({ title: "Fetch Failed", description: message, variant: "destructive" });
    } finally {
      setForm26ASLoading(false);
    }
  };
  const [sandboxTaxResult, setSandboxTaxResult] = useState<SandboxTaxResult | null>(null);
  const [taxCalcError, setTaxCalcError] = useState<string | null>(null);

  const handleFetchAIS = async (): Promise<void> => {
    if (!panContext?.pan) return;
    setAisLoading(true);
    try {
      const res = await apiRequest(`/api/tax/ais?pan=${panContext.pan}`, { method: "GET" });
      setAisData({ ...res, loaded: true });
      if (res.salaryIncome) setSalaryDetails((prev: SalaryDetails) => ({ ...prev, grossSalary: res.salaryIncome }));
      if (res.interestIncome) setOtherIncomeDetails((prev: OtherIncomeDetails) => ({ ...prev, interestIncome: res.interestIncome }));
      if (res.dividendIncome) setOtherIncomeDetails((prev: OtherIncomeDetails) => ({ ...prev, dividendIncome: res.dividendIncome }));
      toast({ title: "AIS Data Fetched", description: "Your income details have been updated from AIS." });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Fetch failed";
      toast({ title: "AIS Fetch Failed", description: message, variant: "destructive" });
    } finally {
      setAisLoading(false);
    }
  };

  const handleForm16Upload = async (file: File) => {
    setForm16Uploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("assessmentYear", assessmentYear);
      const res = await fetch("/api/tax/itr/parse-form16", { 
        method: "POST", 
        body: formData,
        credentials: "include" 
      });
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
        toast({ title: "Form 16 Parsed", description: "Salary and TDS details auto-filled." });
      }
    } catch {
      toast({ title: "Upload Failed", description: "Could not parse Form 16.", variant: "destructive" });
    } finally {
      setForm16Uploading(false);
    }
  };

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
        
        // Income is recalculated via useMemo 'totals', but we update the details state
        const uploadSTCG = cgUploads.reduce((s, u) => s + u.summary.netSTCG, 0) + (result.summary?.netSTCG || 0);
        const uploadLTCG = cgUploads.reduce((s, u) => s + u.summary.netLTCG, 0) + (result.summary?.netLTCG || 0);
        
        setCapitalGainsDetails(prev => ({
          ...prev,
          shortTermGains: uploadSTCG + cgManualSaved.reduce((s, e) => s + e.summary.totalSTCG, 0),
          longTermGains: uploadLTCG + cgManualSaved.reduce((s, e) => s + e.summary.totalLTCG, 0),
        }));
        
        toast({ 
          title: "Statement Uploaded", 
          description: `${result.brokerName}: ${result.transactionCount} transactions parsed` 
        });
      } else {
        throw new Error(result.error || "Upload failed");
      }
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
    } finally {
      setCgUploading(false);
      setCgSelectedBroker(null);
    }
  };

  const handleCgManualSave = async (): Promise<void> => {
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
          entries: cgManualEntries,
        }),
      });
      const result = await resp.json();
      if (result.success) {
        setCgManualSaved((prev: CGManualSavedItem[]) => [...prev, {
          id: result.entryId,
          assetType: cgManualAssetType,
          summary: result.summary,
          entryCount: result.entries.length,
        }]);
        
        const manualSTCG = cgManualSaved.reduce((s: number, e: CGManualSavedItem) => s + (e.summary as any).totalSTCG, 0) + (result.summary?.totalSTCG || 0);
        const manualLTCG = cgManualSaved.reduce((s: number, e: CGManualSavedItem) => s + (e.summary as any).totalLTCG, 0) + (result.summary?.totalLTCG || 0);
        
        setCapitalGainsDetails((prev: CapitalGainsDetails) => ({
          ...prev,
          shortTermGains: cgUploads.reduce((s: number, u: BrokerUploadInfo) => s + u.summary.netSTCG, 0) + manualSTCG,
          longTermGains: cgUploads.reduce((s: number, u: BrokerUploadInfo) => s + u.summary.netLTCG, 0) + manualLTCG,
          exemptionsApplied: cgManualSaved.reduce((s: number, e: CGManualSavedItem) => s + (e.summary as any).totalExemptions, 0) + (result.summary?.totalExemptions || 0),
        }));
        
        setCgManualEntries([]);
        toast({ title: "Entries Saved" });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unknown error occurred";
      toast({ title: "Save Failed", description: message, variant: "destructive" });
    }
  };

  // Computations
  const totals = useMemo((): TaxTotals => {
    const salaryIncome = incomeSources.hasSalary ? (salaryDetails.grossSalary + salaryDetails.allowances + salaryDetails.perquisites + salaryDetails.profitInLieu - salaryDetails.standardDeduction - salaryDetails.professionalTax) : 0;
    let hpIncome = 0;
    if (incomeSources.hasHouseProperty) {
      housePropertyDetails.properties.forEach(prop => {
        if (prop.propertyType === "self_occupied") hpIncome += -Math.min(prop.interestOnLoan, 200000);
        else { const nav = prop.rentalIncome - prop.municipalTaxes - prop.unrealizedRent; hpIncome += nav * 0.70 - prop.interestOnLoan; }
      });
    }
    const capitalGains = capitalGainsDetails.shortTermGains + capitalGainsDetails.longTermGains - capitalGainsDetails.exemptionsApplied;
    const otherIncome = otherIncomeDetails.interestIncome + otherIncomeDetails.dividendIncome + otherIncomeDetails.otherSources;
    const businessIncome = incomeSources.hasBusinessIncome ? (businessDetails.isPresumptive ? (businessDetails.presumptiveIncome44AD + businessDetails.presumptiveIncome44ADA + businessDetails.presumptiveIncome44AE) : businessDetails.businessIncome) : 0;
    const grossTotalIncome = Math.max(0, salaryIncome) + hpIncome + capitalGains + otherIncome + businessIncome;
    const totalDeductions = deductionDetails.section80C + deductionDetails.section80CCC + deductionDetails.section80CCD1 + deductionDetails.section80CCD1B + deductionDetails.section80CCD2 + deductionDetails.section80D + deductionDetails.section80DD + deductionDetails.section80DDB + deductionDetails.section80E + deductionDetails.section80EEA + deductionDetails.section80EEB + deductionDetails.section80G + deductionDetails.section80GG + deductionDetails.section80TTA + deductionDetails.section80TTB + deductionDetails.section80U + deductionDetails.otherDeductions;
    const totalTaxPaid = taxPaymentDetails.tdsDeducted + taxPaymentDetails.advanceTaxPaid + taxPaymentDetails.selfAssessmentTax;
    
    const taxableIncome = Math.max(0, grossTotalIncome - totalDeductions);
    const refundDue = totalTaxPaid > 0 ? Math.max(0, totalTaxPaid - 0) : 0; // Simplified for now
    
    return { 
      salaryIncome, housePropertyIncome: hpIncome, capitalGains, otherIncome, businessIncome, 
      grossTotalIncome, totalDeductions, taxableIncome, taxPayable: 0, refundDue, paymentDue: 0 
    };
  }, [incomeSources, salaryDetails, housePropertyDetails, capitalGainsDetails, otherIncomeDetails, businessDetails, deductionDetails, taxPaymentDetails]);

  const activeSteps = useMemo((): Step[] => {
    const stepIds: string[] = ["basic", "sources"];
    const isEntityForm = ["ITR-5", "ITR-6", "ITR-7"].includes(recommendedForm);
    
    if (isEntityForm) stepIds.push("entity_profile");
    if (incomeSources.hasSalary && !isEntityForm) stepIds.push("salary");
    if (incomeSources.hasHouseProperty) stepIds.push("property");
    if (incomeSources.hasBusinessIncome) stepIds.push("business");
    if (["ITR-3", "ITR-5", "ITR-6"].includes(recommendedForm) && incomeSources.hasBusinessIncome) stepIds.push("financials");
    if (incomeSources.hasCapitalGains) stepIds.push("capital");
    if (incomeSources.hasForeignIncome) stepIds.push("foreign");
    if (incomeSources.hasOtherIncome) stepIds.push("other");
    if (["ITR-2", "ITR-3", "ITR-5", "ITR-6"].includes(recommendedForm)) stepIds.push("disclosures");
    if (recommendedForm === "ITR-7") stepIds.push("trust_income");
    stepIds.push("deductions");
    if (recommendedForm !== "ITR-1" && totals.grossTotalIncome > 5000000) stepIds.push("schedule_al");
    if (incomeSources.hasCapitalGains || incomeSources.hasBusinessIncome) stepIds.push("loss_adjustment");
    if (["ITR-2", "ITR-3", "ITR-5", "ITR-6"].includes(recommendedForm)) stepIds.push("schedule_si_ei");
    stepIds.push("tax_payments", "review");

    return stepIds.map(id => STEPS.find(s => s.id === id)).filter((s): s is Step => !!s);
  }, [recommendedForm, incomeSources, totals.grossTotalIncome]);

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
          warnings.push("For self-occupied property, home loan interest deduction is capped at ₹2,0,000.");
        }
        break;
      case "business":
        if (incomeSources.hasBusinessIncome) {
          if (businessDetails.isPresumptive) {
            if (businessDetails.businessType === "business") {
              if (businessDetails.grossTurnover <= 0) errors.push("Please enter gross turnover for presumptive income under Section 44AD.");
              if (businessDetails.grossTurnover > 30000000) errors.push("Turnover exceeds ₹3 Cr limit for Section 44AD.");
              const minDeemed = Math.round(businessDetails.grossTurnover * 0.06);
              if (businessDetails.presumptiveIncome44AD > 0 && businessDetails.presumptiveIncome44AD < minDeemed) {
                errors.push(`Deemed profit cannot be less than 6% of turnover (₹${minDeemed.toLocaleString('en-IN')}).`);
              }
            }
            if (businessDetails.businessType === "profession") {
              if (businessDetails.grossReceipts <= 0) errors.push("Please enter gross receipts for Section 44ADA.");
              if (businessDetails.grossReceipts > 7500000) errors.push("Gross receipts exceed ₹75 lakhs limit.");
              const minDeemed = Math.round(businessDetails.grossReceipts * 0.5);
              if (businessDetails.presumptiveIncome44ADA > 0 && businessDetails.presumptiveIncome44ADA < minDeemed) {
                errors.push(`Deemed profit cannot be less than 50% (₹${minDeemed.toLocaleString('en-IN')}).`);
              }
            }
          }
        }
        break;
      case "capital":
        if (capitalGainsDetails.exemptionsApplied > capitalGainsDetails.shortTermGains + capitalGainsDetails.longTermGains) {
          errors.push("Exemptions cannot exceed total capital gains.");
        }
        break;
      case "deductions":
        if (taxRegime === "new") {
          warnings.push("Under the New Tax Regime, most Chapter VI-A deductions are not available.");
        }
        if (deductionDetails.section80TTA > 0 && deductionDetails.section80TTB > 0) {
          errors.push("You cannot claim both 80TTA and 80TTB.");
        }
        break;
      case "review":
        if (sandboxTaxResult?.data?.refundAmount && sandboxTaxResult.data.refundAmount > 0 && !bankDetails.accountNumber) {
          errors.push("Bank account details are required for your refund.");
        }
        break;
    }
    return { isValid: errors.length === 0, errors, warnings };
  }, [panContext, incomeSources, salaryDetails, housePropertyDetails, businessDetails, capitalGainsDetails, deductionDetails, taxRegime, bankDetails, sandboxTaxResult]);

  const currentValidation = useMemo(() => validateStep(currentStepId), [currentStepId, validateStep]);

  // Mutations
  const saveDraftMutation = useMutation({
    mutationFn: (draft: Partial<ITRDraft>) => apiRequest("/api/tax/itr/draft", { method: "POST", body: JSON.stringify(draft) }),
    onSuccess: () => toast({ title: "Draft Saved" }),
  });

  const taxCalcMutation = useMutation({
    mutationFn: async () => {
      const salaryIncome = salaryDetails.grossSalary + salaryDetails.allowances +
        salaryDetails.perquisites + salaryDetails.profitInLieu -
        salaryDetails.standardDeduction - salaryDetails.professionalTax;

      let housePropertyIncome = 0;
      housePropertyDetails.properties.forEach(prop => {
        if (prop.propertyType === "self_occupied") {
          housePropertyIncome += -Math.min(prop.interestOnLoan, 200000);
        } else {
          const nav = prop.rentalIncome - prop.municipalTaxes - prop.unrealizedRent;
          housePropertyIncome += nav * 0.70 - prop.interestOnLoan;
        }
      });

      const res = await apiRequest("/api/tax/itr/calculate", {
        method: "POST",
        body: JSON.stringify({
          assessmentYear,
          entityType: panContext?.panType || "individual",
          taxRegime,
          salaryIncome: Math.max(0, salaryIncome),
          housePropertyIncome,
          capitalGainsSTCG: capitalGainsDetails.shortTermGains,
          capitalGainsLTCG: capitalGainsDetails.longTermGains,
          capitalGainsExemptions: capitalGainsDetails.exemptionsApplied,
          businessIncome: totals.businessIncome,
          interestIncome: otherIncomeDetails.interestIncome,
          dividendIncome: otherIncomeDetails.dividendIncome,
          otherIncome: otherIncomeDetails.otherSources,
          section80C: deductionDetails.section80C,
          section80CCC: deductionDetails.section80CCC,
          section80CCD1: deductionDetails.section80CCD1,
          section80D: deductionDetails.section80D,
          tdsDeducted: taxPaymentDetails.tdsDeducted,
          advanceTaxPaid: taxPaymentDetails.advanceTaxPaid,
          selfAssessmentTax: taxPaymentDetails.selfAssessmentTax,
          specialRateIncome,
          foIncome,
          balanceSheet,
          profitLoss,
          bankDetails: bankDetails.accountNumber ? bankDetails : undefined,
        }),
      });
      return res as SandboxTaxResult;
    },
    onSuccess: (result) => {
      setSandboxTaxResult(result);
      setTaxCalcError(null);
    },
    onError: (error: Error) => {
      setTaxCalcError(error.message);
      setSandboxTaxResult(null);
    }
  });

  const regimeCompareMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/tax/itr/compare", {
        method: "POST",
        body: JSON.stringify({
          assessmentYear,
          salaryIncome: totals.salaryIncome,
          hpIncome: totals.housePropertyIncome,
          businessIncome: totals.businessIncome,
          capitalGains: totals.capitalGains,
          otherIncome: totals.otherIncome,
          deductions: deductionDetails
        })
      });
      return res as RegimeComparison;
    }
  });

  const saveDraft = () => {
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
      specialRateIncome,
      foIncome,
      balanceSheet,
      profitLoss,
      grossTotalIncome: sandboxTaxResult?.data?.totalIncome ?? totals.grossTotalIncome,
      totalDeductions: totals.totalDeductions,
      taxableIncome: sandboxTaxResult?.data?.taxableIncome ?? 0,
      taxPayable: sandboxTaxResult?.data?.taxPayable ?? 0,
    });
  };

  const nextStep = () => {
    if (!currentValidation.isValid) {
      toast({ title: "Validation Error", description: currentValidation.errors[0], variant: "destructive" });
      return;
    }
    const idx = activeSteps.findIndex(s => s.id === currentStepId);
    if (idx < activeSteps.length - 1) {
      const nextId = activeSteps[idx + 1].id;
      setVisitedSteps(prev => new Set([...prev, nextId]));
      setCurrentStepId(nextId);
    }
  };

  const prevStep = () => {
    const idx = activeSteps.findIndex(s => s.id === currentStepId);
    if (idx > 0) setCurrentStepId(activeSteps[idx - 1].id);
  };

  const goToStep = (id: string) => {
    if (visitedSteps.has(id)) setCurrentStepId(id);
  };

  const computeCYLA = useMemo((): CYLAData => {
    const salary = incomeSources.hasSalary ? (salaryDetails.grossSalary + salaryDetails.allowances + salaryDetails.perquisites + salaryDetails.profitInLieu - salaryDetails.standardDeduction - salaryDetails.professionalTax) : 0;
    let hp = 0;
    if (incomeSources.hasHouseProperty) {
      housePropertyDetails.properties.forEach(prop => {
        if (prop.propertyType === "self_occupied") hp += -Math.min(prop.interestOnLoan, 200000);
        else hp += (prop.rentalIncome - prop.municipalTaxes - prop.unrealizedRent) * 0.70 - prop.interestOnLoan;
      });
    }
    const stcg = capitalGainsDetails.shortTermGains;
    const ltcg = capitalGainsDetails.longTermGains;
    const business = incomeSources.hasBusinessIncome ? (businessDetails.isPresumptive ? (businessDetails.presumptiveIncome44AD + businessDetails.presumptiveIncome44ADA + businessDetails.presumptiveIncome44AE) : businessDetails.businessIncome) : 0;
    const otherSrc = otherIncomeDetails.interestIncome + otherIncomeDetails.dividendIncome + otherIncomeDetails.otherSources;

    const adjustments: CYLAAdjustment[] = [];
    let remainingHPLoss = hp < 0 ? Math.min(Math.abs(hp), 200000) : 0;
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
    return { 
      adjustments, 
      totalIncomeAfterCYLA: adjustments.reduce((s: number, a: CYLAAdjustment) => s + a.incomeAfterSetOff, 0), 
      unabsorbedHPLoss: remainingHPLoss, 
      unabsorbedBizLoss: remainingBizLoss,
      currentYearSTCLoss: stcg < 0 ? Math.abs(stcg) : 0,
      currentYearLTCLoss: ltcg < 0 ? Math.abs(ltcg) : 0,
    };
  }, [incomeSources, salaryDetails, housePropertyDetails, capitalGainsDetails, businessDetails, otherIncomeDetails]);

  const computeBFLA = useMemo((): BFLAData => {
    const cyla = computeCYLA;
    const bflaRows: BFLAAdjustment[] = cyla.adjustments.map((a: CYLAAdjustment) => ({
      head: a.head, incomeAfterCYLA: a.incomeAfterSetOff, bfHPLossSetOff: 0, bfSTCLSetOff: 0, bfLTCLSetOff: 0, bfBusinessLossSetOff: 0, bfSpeculationSetOff: 0, incomeAfterBFLA: a.incomeAfterSetOff,
    }));
    let remHP = lossCarryForward.filter((l: LossCarryForward) => l.lossType === "house_property").reduce((s: number, l: LossCarryForward) => s + (l.lossAmount - l.setOffAmount), 0);
    let remBiz = lossCarryForward.filter((l: LossCarryForward) => l.lossType === "business").reduce((s: number, l: LossCarryForward) => s + (l.lossAmount - l.setOffAmount), 0);
    
    for (const row of bflaRows) {
      let avail = row.incomeAfterCYLA;
      if (remHP > 0 && avail > 0) { const u = Math.min(remHP, avail); row.bfHPLossSetOff = u; remHP -= u; avail -= u; }
      if (remBiz > 0 && avail > 0 && row.head !== "Salary") { const u = Math.min(remBiz, avail); row.bfBusinessLossSetOff = u; remBiz -= u; avail -= u; }
      row.incomeAfterBFLA = avail;
    }
    return { bflaRows, totalIncomeAfterBFLA: bflaRows.reduce((s: number, r: BFLAAdjustment) => s + r.incomeAfterBFLA, 0), remainingHP: remHP, remainingBiz: remBiz };
  }, [computeCYLA, lossCarryForward]);

  const computeCFL = useMemo((): CFLEntry[] => {
    const cyla: CYLAData = computeCYLA;
    const entries: CFLEntry[] = [];
    if (cyla.unabsorbedHPLoss > 0 || cyla.unabsorbedBizLoss > 0) {
      entries.push({
        assessmentYear: assessmentYear, dateOfFiling: new Date().toISOString().split("T")[0],
        housePropertyLoss: cyla.unabsorbedHPLoss, shortTermCapitalLoss: 0, longTermCapitalLoss: 0, businessLoss: cyla.unabsorbedBizLoss, speculativeBusinessLoss: 0, specifiedBusinessLoss: 0,
      });
    }
    return entries;
  }, [computeCYLA, assessmentYear]);

  const compute234Interest = useCallback(() => {
    const taxLiability = sandboxTaxResult?.data?.taxLiability || 0;
    const assessedTax = Math.max(0, taxLiability - taxPaymentDetails.reliefUs89);
    setInterest234(prev => ({ ...prev, assessedTax }));
  }, [sandboxTaxResult, taxPaymentDetails]);

  const value: TaxContextType = {
    currentStepId, setCurrentStepId, assessmentYear, setAssessmentYear, recommendedForm, taxRegime, setTaxRegime, visitedSteps, setVisitedSteps, activeSubTab, setActiveSubTab,
    panContext, panLoading, historyData, isLoadingHistory, supportedBrokers,
    incomeSources, setIncomeSources, salaryDetails, setSalaryDetails, housePropertyDetails, setHousePropertyDetails, capitalGainsDetails, setCapitalGainsDetails,
    cgMode, setCgMode, cgBrokerSearch, setCgBrokerSearch, cgSelectedBroker, setCgSelectedBroker, cgUploading, cgUploads, setCgUploads, cgManualAssetType, setCgManualAssetType, cgManualEntries, setCgManualEntries, cgManualSaved, setCgManualSaved,
    foreignIncomeDetails, setForeignIncomeDetails, businessDetails, setBusinessDetails, residentialStatus, setResidentialStatus, filingSection, setFilingSection, employerDetails, setEmployerDetails, otherIncomeDetails, setOtherIncomeDetails, deductionDetails, setDeductionDetails, taxPaymentDetails, setTaxPaymentDetails, bankDetails, setBankDetails,
    lossCarryForward, setLossCarryForward, schedule112AEntries, setSchedule112AEntries, scheduleSI, setScheduleSI, scheduleEI, setScheduleEI, interest234, setInterest234, scheduleSPI, setScheduleSPI, schedule5A, setSchedule5A, scheduleIF, setScheduleIF, matDetails, setMatDetails, matcDetails, setMatcDetails, amtDetails, setAmtDetails, amtcDetails, setAmtcDetails, tds1Entries, setTds1Entries, tds2Entries, setTds2Entries, tcsEntries, setTcsEntries, section234F, setSection234F, section87A, setSection87A, balanceSheet, setBalanceSheet, profitLoss, setProfitLoss, depreciationEntries, setDepreciationEntries, taxAuditInfo, setTaxAuditInfo, entityProfile, setEntityProfile, corporateDetails, setCorporateDetails, trustDetails, setTrustDetails, scheduleAL, setScheduleAL, donationEntries, setDonationEntries,
    isUpdatedReturn, setIsUpdatedReturn, itrUDetails, setItrUDetails, aisLoading, aisData, setAisData, form16Uploading, setForm16Uploading, sandboxTaxResult, taxCalcError,
    computeCYLA, computeBFLA, computeCFL, compute234Interest,
    totals, activeSteps, currentStepIndex: activeSteps.findIndex(s => s.id === currentStepId), 
    safeCurrentStep: Math.max(0, activeSteps.findIndex(s => s.id === currentStepId)),
    progress: ((activeSteps.findIndex(s => s.id === currentStepId) + 1) / activeSteps.length) * 100, currentValidation,
    cyla: computeCYLA, bfla: computeBFLA, cfl: computeCFL,
    specialRateIncome, setSpecialRateIncome,
    foIncome, setFoIncome,
    validateStep, saveDraft, calculateTax: () => taxCalcMutation.mutate(), nextStep, prevStep, goToStep, handleFetchAIS, handleForm16Upload, handleCgFileUpload, handleCgManualSave, handleFetch26AS,
    taxCalcMutation, regimeCompareMutation
  };

  return <TaxContext.Provider value={value}>{children}</TaxContext.Provider>;
};

export const useTax = (): TaxContextType => {
  const context = useContext(TaxContext);
  if (context === undefined) throw new Error("useTax must be used within a TaxProvider");
  return context;
};
