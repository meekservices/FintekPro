import { LucideIcon } from "lucide-react";

export type PANType = "individual" | "huf" | "firm" | "company" | "trust" | "nri";

export interface PANContext {
  pan: string;
  panType: PANType;
  name: string;
  isVerified: boolean;
  entityDescription?: string;
}

export interface IncomeSource {
  hasSalary: boolean;
  hasHouseProperty: boolean;
  hasCapitalGains: boolean;
  hasBusinessIncome: boolean;
  hasForeignIncome: boolean;
  hasOtherIncome: boolean;
  [key: string]: boolean;
}

export interface SpecialRateIncome {
  lottery: number;
  horseRacing: number;
  onlineGaming: number;
  otherSpecial: number;
}

export interface SalaryDetails {
  grossSalary: number;
  allowances: number;
  perquisites: number;
  profitInLieu: number;
  standardDeduction: number;
  professionalTax: number;
  employerPF: number;
}

export interface HousePropertyEntry {
  propertyType: "self_occupied" | "let_out" | "deemed_let_out";
  rentalIncome: number;
  municipalTaxes: number;
  interestOnLoan: number;
  unrealizedRent: number;
  address: string;
}

export interface HousePropertyDetails {
  propertyCount: number;
  rentalIncome: number;
  municipalTaxes: number;
  interestOnLoan: number;
  isSelfOccupied: boolean;
  properties: HousePropertyEntry[];
}

export interface CapitalGainsDetails {
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

export interface LossCarryForward {
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

export type LossCarryForwardEntry = LossCarryForward;

export interface Schedule112AEntry {
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

export interface ScheduleSIDetails {
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

export interface ScheduleEIDetails {
  agriculturalIncome: number;
  ltcgExemptUpTo125000: number;
  dividendFromCooperative: number;
  ppfInterest: number;
  epfInterest: number;
  section10Exemptions: number;
  otherExemptIncome: number;
  exemptIncomeDescription: string;
}

export interface Broker {
  id: string;
  name: string;
  category: string;
  supportedFormats: string[];
  fileFormatHint: string;
  assetTypes?: string[];
}

export interface TaxHistoryItem {
  id: string | number;
  assessmentYear: string;
  savedAt: string;
  data: {
    taxableIncome?: number;
    taxPayable?: number;
    [key: string]: unknown;
  };
}

export interface ChallanResult {
  challanType: string;
  taxAmount: number;
  challanNo?: string;
  surcharge?: number;
  educationCess?: number;
  totalAmount?: number;
  paymentUrl?: string;
}

export interface OptimizerSuggestion {
  section: string;
  taxSaving: number;
  description: string;
}

export interface ItrUDetails {
  originalAckNumber: string;
  originalFilingDate: string;
  reasonForUpdate: string;
  additionalTaxPayable: number;
  lateFee234F?: number;
  additionalInterest: number;
}

export interface DocumentVaultEntry {
  id: string;
  name: string;
  type: string;
  category: string;
  uploadedAt: string;
  size: number;
}

export interface OptimizerResult {
  suggestions: OptimizerSuggestion[];
  totalPotentialSaving: number;
}

export interface PreFilingItem {
  code: string;
  message: string;
}

export interface PreFilingResult {
  isFileable: boolean;
  summary: {
    verdict: string;
    totalErrors: number;
    totalWarnings: number;
  };
  errors: PreFilingItem[];
  warnings: PreFilingItem[];
}

export interface ReconciliationItem {
  deductorName?: string;
  tan?: string;
  amount26AS?: number;
  computedAmount?: number;
  difference?: number;
  recommendation?: string;
  amount?: number;
}

export interface ReconciliationResult {
  summary: {
    matchRate: string;
  };
  matched: ReconciliationItem[];
  mismatched: ReconciliationItem[];
  missing: ReconciliationItem[];
  recommendations?: string[];
}

export interface RefundStage {
  stage: string;
  date?: string;
  status: "completed" | "pending" | "failed" | "processed" | "disbursed" | "in_progress";
}

export interface RefundData {
  assessmentYear: string;
  stages: RefundStage[];
  currentStage: string;
  expectedDate?: string;
  note?: string;
}

export interface TaxDeadline {
  urgency: "critical" | "warning" | "default";
  daysLeft: number;
  form: string;
  deadline: string;
}

export interface HraResult {
  breakdown: {
    actualHRA: number;
    percentOfBasic: number;
    rentMinusTenPercent: number;
  };
  formula: string;
  hraExemption: number;
  taxableHRA: number;
}

export interface Form10EResult {
  taxOnTotal: number;
  taxOnWithout: number;
  totalAdditionalTax: number;
  reliefUs89: number;
  explanation: string;
}

export interface IfscResult {
  ifsc?: string;
  bank?: string;
  branch?: string;
  city?: string;
  bsrCode?: string;
  bankName?: string;
  tan?: string;
  isValid?: boolean;
}

export interface AdvanceTaxInstallment {
  quarter: string;
  dueDate: string;
  amountDue: number;
  amountPaid: number;
  paidDate: string;
}

export interface Interest234Details {
  interest234A: number;
  interest234B: number;
  interest234C: number;
  totalInterest: number;
  filingDueDate: string;
  filingDate: string;
  assessedTax: number;
  advanceTaxDetails: AdvanceTaxInstallment[];
}

export interface CYLAAdjustment {
  head: "salary" | "house_property" | "business" | "capital_gains" | "other_sources";
  incomeBeforeSetOff: number;
  hpLossSetOff: number;
  businessLossSetOff: number;
  otherSourceLossSetOff: number;
  incomeAfterSetOff: number;
}

export interface BFLAAdjustment {
  head: "salary" | "house_property" | "business" | "capital_gains" | "other_sources";
  incomeAfterCYLA: number;
  bfHPLossSetOff: number;
  bfSTCLSetOff: number;
  bfLTCLSetOff: number;
  bfBusinessLossSetOff: number;
  bfSpeculationSetOff: number;
  incomeAfterBFLA: number;
}

export interface CFLEntry {
  assessmentYear: string;
  dateOfFiling: string;
  housePropertyLoss: number;
  shortTermCapitalLoss: number;
  longTermCapitalLoss: number;
  businessLoss: number;
  speculativeBusinessLoss: number;
  specifiedBusinessLoss: number;
}

export interface ScheduleSPIEntry {
  nameOfPerson: string;
  panOfPerson: string;
  relationshipCode: "spouse" | "son" | "daughter" | "son_wife" | "minor_son" | "minor_daughter";
  incomeType: "salary" | "house_property" | "business" | "capital_gains" | "other_sources";
  amountIncluded: number;
  section: "64(1)(ii)" | "64(1)(iv)" | "64(1A)";
  remarks: string;
}

export interface Schedule5ADetails {
  isApplicable: boolean;
  nameOfSpouse: string;
  panOfSpouse: string;
  totalIncomeOfAssessee: number;
  totalIncomeOfSpouse: number;
  apportionedIncomeAssessee: number;
  apportionedIncomeSpouse: number;
  headwiseBreakdown: {
    salary: { assessee: number; spouse: number };
    houseProperty: { assessee: number; spouse: number };
    business: { assessee: number; spouse: number };
    capitalGains: { assessee: number; spouse: number };
    otherSources: { assessee: number; spouse: number };
  };
}

export interface ScheduleIFEntry {
  firmName: string;
  firmPAN: string;
  firmAddress: string;
  assessmentYear: string;
  shareOfProfit: number;
  shareOfSalary: number;
  shareOfInterest: number;
  shareOfBonus: number;
  shareOfCommission: number;
  capitalBalanceOnApril1: number;
  capitalBalanceOnMarch31: number;
  isPartnerInAOP: boolean;
}

export interface MATDetails {
  isApplicable: boolean;
  bookProfitBeforeAdjustments: number;
  additionsToBookProfit: {
    incomeTaxProvision: number;
    deferredTax: number;
    dividendPaid: number;
    carriedForwardLosses: number;
    unabsorbedDepreciation: number;
    transferToReserve: number;
    provisionForDiminution: number;
    expenditureRelatingExemptIncome: number;
    notionalGain: number;
    otherAdditions: number;
  };
  deductionsFromBookProfit: {
    withdrawalFromReserve: number;
    incomeExemptUs10: number;
    incomeExemptUs11_12: number;
    depreciationExcludingRevaluation: number;
    withdrawalFromProvision: number;
    lowerOfUnabsorbedDepOrBroughtForwardLoss: number;
    notionalLoss: number;
    otherDeductions: number;
  };
  adjustedBookProfit: number;
  matRate: number;
  matTaxAmount: number;
  surchargeOnMAT: number;
  cessOnMAT: number;
  totalMATLiability: number;
  normalTaxLiability: number;
  isMATApplicable: boolean;
  taxPayableHigherOfMATOrNormal: number;
}

export interface MATCreditEntry {
  assessmentYear: string;
  matPaid: number;
  normalTaxPayable: number;
  matCreditAvailable: number;
  matCreditUtilized: number;
  matCreditLapsed: boolean;
  expiryYear: string;
}

export interface MATCreditDetails {
  isApplicable: boolean;
  creditEntries: Array<MATCreditEntry>;
  totalCreditBroughtForward: number;
  creditUtilizedCurrentYear: number;
  creditCarriedForward: number;
  creditSetOffLimit: number;
}

export interface AMTDetails {
  isApplicable: boolean;
  adjustedTotalIncome: number;
  additions: {
    deduction80H_80RRB: number;
    deduction10AA: number;
    deduction35AD: number;
    deduction80IA_80IB: number;
    deduction80JJA: number;
    deduction80P: number;
    otherChapter6ADeductions: number;
  };
  totalAdjustedIncome: number;
  amtRate: number;
  amtAmount: number;
  surchargeOnAMT: number;
  cessOnAMT: number;
  totalAMTLiability: number;
  normalTaxLiability: number;
  isAMTApplicable: boolean;
  taxPayableHigherOfAMTOrNormal: number;
}

export interface AMTCreditEntry {
  assessmentYear: string;
  amtPaid: number;
  normalTaxPayable: number;
  amtCreditAvailable: number;
  amtCreditUtilized: number;
  amtCreditLapsed: boolean;
  expiryYear: string;
}

export interface AMTCreditDetails {
  isApplicable: boolean;
  creditEntries: Array<AMTCreditEntry>;
  totalCreditBroughtForward: number;
  creditUtilizedCurrentYear: number;
  creditCarriedForward: number;
}

export interface TDS1Entry {
  employerTAN: string;
  employerName: string;
  salaryUnderSection: "17(1)" | "17(2)" | "17(3)";
  incomeCredited: number;
  tdsDeducted: number;
  tdsClaimedCurrentYear: number;
}

export interface TDS2Entry {
  deductorTAN: string;
  deductorName: string;
  incomeType: "interest" | "dividend" | "rent" | "professional_fees" | "commission" | "winnings" | "sale_of_property" | "other";
  section: string;
  dateOfPayment: string;
  incomeCredited: number;
  tdsDeducted: number;
  tdsClaimedCurrentYear: number;
}

export interface TCSEntry {
  collectorTAN: string;
  collectorName: string;
  amountPaid: number;
  tcsCollected: number;
  tcsClaimedCurrentYear: number;
}

export interface Section234FDetails {
  isApplicable: boolean;
  filingDueDate: string;
  actualFilingDate: string;
  totalIncome: number;
  lateFee: number;
  isSmallTaxpayer: boolean;
}

export interface Section87ADetails {
  isEligible: boolean;
  taxableIncome: number;
  normalTaxLiability: number;
  rebateAmount: number;
  maxRebateOldRegime: number;
  maxRebateNewRegime: number;
  incomeThresholdOld: number;
  incomeThresholdNew: number;
  taxAfterRebate: number;
}

export interface DirectorshipEntry {
  companyName: string;
  companyPAN: string;
  din: string;
  sharesHeld: number;
}

export interface UnlistedShareEntry {
  companyName: string;
  companyPAN: string;
  openingShares: number;
  closingShares: number;
  acquisitionCost: number;
}

export interface BalanceSheetDetails {
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
  [key: string]: number;
}

export type BalanceSheet = BalanceSheetDetails; // Alias for backward compatibility

export interface ProfitLossDetails {
  grossRevenue: number;
  otherOperatingIncome: number;
  totalRevenue: number;
  purchasesAndDirectExpenses: number;
  employeeBenefitExpenses: number;
  depreciation: number;
  otherExpenses: number;
  totalExpenses: number;
  netProfitBeforeTax: number;
  [key: string]: number;
}

export type ProfitLoss = ProfitLossDetails; // Alias for backward compatibility

export interface DepreciationEntry {
  assetBlock: string;
  openingWDV: number;
  additions: number;
  disposals: number;
  depreciationRate: number;
  depreciationAmount: number;
  closingWDV: number;
}

export interface TaxAuditInfo {
  isAuditRequired: boolean;
  auditorName: string;
  auditorMembershipNo: string;
  auditDate: string;
  form3CA_3CD: boolean;
  form3CB_3CD: boolean;
  auditReportFiled: boolean;
}

export interface PartnerDetails {
  partnerName: string;
  partnerPAN: string;
  sharePercentage: number;
  capitalContribution: number;
  profitShareRatio: number;
  remuneration: number;
  interestOnCapital: number;
  isManagingPartner: boolean;
}

export interface EntityProfileDetails {
  entityName: string;
  entityPAN: string;
  entityType: string;
  dateOfIncorporation: string;
  registrationNumber: string;
  constitutionType: string;
  natureOfBusiness: string;
  partners: PartnerDetails[];
}

export interface CorporateDetails {
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

export interface TrustDetails {
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

export interface ScheduleALDetails {
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

export interface DonationEntry {
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

export interface BrokerUploadInfo {
  id: number;
  brokerName: string;
  brokerId: string;
  fileName: string;
  parseConfidence: number;
  summary: { netSTCG: number; netLTCG: number; totalTransactions: number };
  status: string;
  uploadedAt: string;
}

export interface ManualCGEntry {
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

export interface ForeignIncomeDetails {
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

export interface ForeignTaxCreditDetails {
  isApplicable: boolean;
}

export interface ForeignAssetsDetails {
  isApplicable: boolean;
  assets: ForeignAssetEntry[];
}

export interface ForeignAssetEntry {
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

export interface BusinessDetails {
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

export interface OtherIncomeDetails {
  interestIncome: number;
  dividendIncome: number;
  otherSources: number;
  agriculturalIncome: number;
}

export interface RegimeComparison {
  oldRegime: { taxableIncome: number; taxLiability: number; taxPayable: number; effectiveTaxRate: number; totalDeductions: number };
  newRegime: { taxableIncome: number; taxLiability: number; taxPayable: number; effectiveTaxRate: number; totalDeductions: number };
  recommended: string;
  savings: number;
  recommendation: string;
}

export interface DeductionDetails {
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

export interface TaxPaymentDetails {
  tdsSalary: number;
  tdsOtherThanSalary: number;
  tdsOnProperty: number;
  tcsCollected: number;
  tdsDeducted: number;
  advanceTaxPaid: number;
  selfAssessmentTax: number;
  reliefUs89: number;
}

export interface BankDetailsForRefund {
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  accountType: "savings" | "current";
  isPrimary: boolean;
}

export interface EmployerDetails {
  employerName: string;
  employerTAN: string;
}

export interface SandboxTaxResult {
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

export interface ITRDraft {
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
  specialRateIncome?: SpecialRateIncome;
  foIncome?: FOIncome;
  balanceSheet?: BalanceSheetDetails;
  profitLoss?: ProfitLossDetails;
  grossTotalIncome: number;
  totalDeductions: number;
  taxableIncome: number;
  taxPayable: number;
  tdsCredits: number;
  advanceTax: number;
  selfAssessmentTax: number;
  refundDue: number;
}

export interface CYLAData {
  adjustments: CYLAAdjustment[];
  totalIncomeAfterCYLA: number;
  unabsorbedHPLoss: number;
  unabsorbedBizLoss: number;
  currentYearSTCLoss: number;
  currentYearLTCLoss: number;
}

export interface BFLAData {
  bflaRows: BFLAAdjustment[];
  totalIncomeAfterBFLA: number;
  remainingHP: number;
  remainingBiz: number;
}

export interface LossAdjustmentDetails {
  cyla: CYLAData;
  bfla: BFLAData;
  cfl: CFLEntry[];
}

export interface Step {
  id: string;
  title: string;
  icon: LucideIcon;
  description: string;
}

export interface FOIncome {
  futuresGains: number;
  optionsGains: number;
  intradayGains: number;
  isSpeculative: boolean;
}

export interface StepValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface TaxTotals {
  salaryIncome: number;
  housePropertyIncome: number;
  capitalGains: number;
  businessIncome: number;
  otherIncome: number;
  foreignCapitalGains: number;
  foreignOtherIncome: number;
  foreignTaxCredit: number;
  grossTotalIncome: number;
  totalDeductions: number;
  taxableIncome: number;
  taxPayable: number;
  totalTaxPaid: number;
  refundDue: number;
  paymentDue: number;
}

export interface CGManualSummary {
  purchaseValue: number;
  saleValue: number;
  expenses: number;
  shortTermGain: number;
  longTermGain: number;
  totalSTCG: number;
  totalLTCG: number;
  totalExemptions: number;
}

export interface CGManualSavedItem {
  id: number;
  assetType: string;
  summary: CGManualSummary;
  entryCount: number;
}
