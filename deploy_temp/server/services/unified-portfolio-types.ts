/**
 * Unified Portfolio Types
 * 
 * Consolidates holding and portfolio types used across all import sources:
 * - CAS Statement parsing (CAMS/KFintech)
 * - Broker PDF statements (Zerodha, Groww, etc.)
 * - Wealthy.in URL imports
 * - BSE STAR MFD API
 * - Manual entry
 */

export type AssetType = 
  | 'equity' 
  | 'mutual_fund' 
  | 'etf' 
  | 'bond' 
  | 'gold' 
  | 'fd' 
  | 'debt'
  | 'hybrid'
  | 'cash'
  | 'pms'
  | 'aif'
  | 'reit'
  | 'invit'
  | 'unlisted'
  | 'other';

export type ImportSource = 
  | 'cas_statement'
  | 'broker_pdf'
  | 'wealthy_url'
  | 'bse_star_api'
  | 'manual_entry'
  | 'csv_upload'
  | 'external_sync';

export type ParsingStatus = 
  | 'pending' 
  | 'parsing' 
  | 'completed' 
  | 'failed' 
  | 'needs_review';

export type TransactionType = 
  | 'purchase' 
  | 'redemption' 
  | 'switch_in' 
  | 'switch_out' 
  | 'sip' 
  | 'stp_in'
  | 'stp_out'
  | 'dividend' 
  | 'bonus'
  | 'other';

export interface UnifiedHolding {
  id?: string;
  name: string;
  isin?: string;
  symbol?: string;
  schemeCode?: string;
  folioNumber?: string;
  
  assetType: AssetType;
  quantity: number;
  
  avgCostPerUnit?: number;
  investedValue?: number;
  currentNav?: number;
  currentValue: number;
  
  unrealizedGain?: number;
  unrealizedGainPercent?: number;
  
  broker?: string;
  registrar?: 'CAMS' | 'KFINTECH' | 'FRANKLIN' | 'OTHER';
  amcName?: string;
  
  planType?: 'Regular' | 'Direct';
  optionType?: 'Growth' | 'IDCW' | 'Dividend';
  isDemat?: boolean;
  
  navDate?: string;
  purchaseDate?: string;
  lastTransactionDate?: string;
  
  confidenceScore?: number;
  instrumentType?: string;
  regulator?: string;
  isEdgeCase?: boolean;

  lots?: Array<{
    transactionDate?: string;
    transactionDateStr?: string;
    transactionType?: string;
    amount?: number;
    units?: number;
    nav?: number;
    cost?: number;
    remainingUnits?: number;
    description?: string;
    purchaseDate?: string;
    quantity?: number;
    purchaseNav?: number;
    purchaseValue?: number;
    source?: string;
    status?: string;
  }>;
  lotCount?: number;
  lotSummary?: string;

  transactions?: Array<{
    date?: string;
    transactionType?: string;
    amount?: number;
    units?: number;
    nav?: number;
    balance?: number;
    description?: string;
    isCredit?: boolean;
  }>;

  holdingTier?: 'FULL' | 'VALUATION_ONLY' | 'SUMMARY_PLACEHOLDER';
  eligibleForTax?: boolean;
  tierWarnings?: string[];
  firstPurchaseDate?: string;
}

export interface UnifiedTransaction {
  id?: string;
  folioNumber?: string;
  isin?: string;
  schemeCode?: string;
  schemeName?: string;
  
  transactionDate: string;
  transactionType: TransactionType;
  
  units: number;
  nav?: number;
  amount: number;
  netAmount?: number;
  
  stampDuty?: number;
  stt?: number;
  tds?: number;
  
  orderNumber?: string;
  description?: string;
}

export interface UnifiedInvestorInfo {
  name?: string;
  email?: string;
  pan?: string;
  mobile?: string;
  address?: string;
}

export interface AllocationBreakdown {
  equity: number;
  debt: number;
  gold: number;
  cash: number;
  hybrid: number;
  alternatives: number;
  others: number;
}

export interface RegistrarBreakdown {
  cams: { count: number; value: number };
  kfintech: { count: number; value: number };
  franklin: { count: number; value: number };
  other: { count: number; value: number };
}

export interface UnifiedPortfolioSummary {
  totalHoldings: number;
  totalInvestedValue: number;
  totalCurrentValue: number;
  totalUnrealizedGain: number;
  totalUnrealizedGainPercent: number;
  allocation: AllocationBreakdown;
  registrarBreakdown?: RegistrarBreakdown;
}

export interface UnifiedImportResult {
  success: boolean;
  source: ImportSource;
  sourceFileName?: string;
  sourceUrl?: string;
  
  investor?: UnifiedInvestorInfo;
  holdings: UnifiedHolding[];
  transactions?: UnifiedTransaction[];
  summary: UnifiedPortfolioSummary;
  
  parsingStatus: ParsingStatus;
  confidenceScore: number;
  brokerDetected?: string;
  
  errors: string[];
  warnings?: string[];
  
  rawTextLength?: number;
  expectedCount?: number;
  importedCount?: number;
  skippedCount?: number;
  needsManualReview?: boolean;
  
  capturedAt: string;

  reconciliation?: {
    passed: boolean;
    parsedTotal: number;
    expectedTotal: number;
    delta: number;
    deltaPercent: number;
    message: string;
  };
  portfolioSummary?: {
    entries: Array<{ amcName: string; costValue: number; marketValue: number }>;
    totalCostValue: number;
    totalMarketValue: number;
  };
  tierBreakdown?: { FULL: number; VALUATION_ONLY: number; SUMMARY_PLACEHOLDER: number };
  lotCounts?: { withLots: number; withMultipleLots: number; withoutLots: number };
}

export interface PortfolioStorageOptions {
  prospectId?: string;
  userId?: string;
  clientId?: string;
  
  source: ImportSource;
  sourceFileName?: string;
  sourceUrl?: string;
  
  replaceExisting?: boolean;
  confidenceScore?: number;
}

export interface PortfolioUpsertResult {
  portfolioId: string;
  holdingsInserted: number;
  holdingsUpdated: number;
  holdingsDeleted: number;
  isNewPortfolio: boolean;
}

export function createEmptySummary(): UnifiedPortfolioSummary {
  return {
    totalHoldings: 0,
    totalInvestedValue: 0,
    totalCurrentValue: 0,
    totalUnrealizedGain: 0,
    totalUnrealizedGainPercent: 0,
    allocation: {
      equity: 0,
      debt: 0,
      gold: 0,
      cash: 0,
      hybrid: 0,
      alternatives: 0,
      others: 0
    }
  };
}

export function createEmptyImportResult(source: ImportSource): UnifiedImportResult {
  return {
    success: false,
    source,
    holdings: [],
    summary: createEmptySummary(),
    parsingStatus: 'pending',
    confidenceScore: 0,
    errors: [],
    capturedAt: new Date().toISOString()
  };
}
