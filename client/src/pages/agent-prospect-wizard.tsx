import React, { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { 
  User, ArrowRight, ArrowLeft, Check, Target, PieChart, Scale, 
  TrendingUp, TrendingDown, Sparkles, Share2, Mail, MessageSquare, 
  Copy, ExternalLink, Plus, Trash2, Loader2, CheckCircle, AlertTriangle,
  IndianRupee, Percent, Clock, Shield, Zap, RefreshCw, Search, Users, Download,
  Upload, Link, FileText, AlertCircle, Settings2, Globe, ChevronUp, ChevronDown, Info,
  Pencil, RotateCcw, Save, X, Lightbulb, Calculator, LayoutGrid, Wand2,
  Activity, Wallet, BarChart3, ListChecks, ArrowUpCircle, FileCheck,
  CalendarDays, ClipboardCheck, UserCheck, RefreshCcw
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import jsPDF from "jspdf";
import PortfolioImportPanel from "@/components/portfolio/PortfolioImportPanel";
import { ProposalVersionTimeline } from "@/components/proposal/ProposalVersionTimeline";
import { AdvisorOverrideSystem, AdvisorModifiedBadge } from "@/components/proposal/AdvisorOverrideSystem";
import { useSectionAnalytics, AnalyticsSection } from "@/hooks/use-section-analytics";
import { SectionAnalyticsLoader } from "@/components/proposal/SectionAnalyticsLoader";

interface PortfolioHoldingLot {
  purchaseDate?: string;
  transactionDateStr?: string;
  transactionDate?: Date | string;
  transactionType?: string;
  amount?: number;
  units: number;
  nav: number;
  cost?: number;
}

interface PortfolioHolding {
  id?: string;
  productType: string;
  productName: string;
  quantity: number;
  currentValue: number;
  purchasePrice?: number;
  purchaseDate?: string;
  isin?: string;
  category?: string;
  symbol?: string;
  lots?: PortfolioHoldingLot[];
}

// Map frontend productType to backend assetType (backend schema has limited enum values)
function mapToAssetType(productType: string): string {
  const assetTypeMap: Record<string, string> = {
    'mutual_fund': 'mutual_fund',
    'equity': 'equity',
    'etf': 'etf',
    'bond': 'bond',
    'fd': 'fd',
    'gold': 'gold',
    // These map to 'other' for schema validation, but we preserve original in productType field
    'pms': 'other',
    'aif': 'other',
    'insurance': 'other',
    'other': 'other'
  };
  return assetTypeMap[productType] || 'other';
}

// Transform frontend holding to backend schema format
// Preserves productType as a separate field for lossless round-trip
function toBackendHolding(holding: PortfolioHolding): any {
  return {
    name: holding.productName,
    assetType: mapToAssetType(holding.productType),
    quantity: holding.quantity ?? 1,
    currentValue: holding.currentValue ?? 0,
    isin: holding.isin,
    category: holding.category,
    purchasePrice: holding.purchasePrice,
    purchaseDate: holding.purchaseDate,
    // Preserve original productType for lossless round-trip (PMS, AIF, insurance, etc.)
    productType: holding.productType
  };
}

// Transform backend holding to frontend format
// Uses preserved productType if available, otherwise falls back to assetType
function toFrontendHolding(holding: any): PortfolioHolding {
  // Prefer preserved productType, fallback to assetType
  const productType = holding.productType || holding.assetType || 'mutual_fund';
  return {
    productType: productType,
    productName: holding.name || holding.productName || '',
    quantity: holding.quantity ?? 1,
    currentValue: holding.currentValue ?? 0,
    isin: holding.isin,
    category: holding.category,
    purchasePrice: holding.purchasePrice || holding.averageCost,
    purchaseDate: holding.purchaseDate
  };
}

interface RiskProfile {
  riskTolerance: 'conservative' | 'moderate' | 'aggressive' | 'very_aggressive';
  investmentHorizon: '3_months' | '6_months' | '9_months' | '1_year' | 'short_term' | 'medium_term' | 'long_term';
  primaryGoal: string;
  monthlyIncome?: number;
  existingInvestments?: number;
  liquidityNeeds?: 'low' | 'medium' | 'high';
}

interface PortfolioAnalysis {
  totalValue: number;
  assetAllocation: Record<string, { value: number; percentage: number }>;
  riskScore: number;
  diversificationScore: number;
  recommendations: { type: string; message: string; action?: string }[];
  topPerformers: PortfolioHolding[];
  underperformers: PortfolioHolding[];
}

interface TaxImplicationsObject {
  taxType: string;
  isSlabBased?: boolean;
  estimatedGain: number;
  estimatedTax?: number;
  exitLoad?: number;
  grandfatheringBenefit?: number;
  alerts?: Array<{ type: string; message: string }>;
}

interface RebalanceRecommendation {
  action: 'BUY' | 'SELL' | 'HOLD' | 'SWITCH';
  productType: string;
  productName: string;
  currentValue?: number;
  suggestedValue?: number;
  changeAmount: number;
  switchAmount?: number;
  rationale: string;
  priority: 'high' | 'medium' | 'low';
  taxImplications?: string | TaxImplicationsObject;
  targetFund?: {
    name: string;
    amc: string;
    category: string;
    returns1Y: string;
    returns3Y: string;
    risk: string;
  };
  isOverridden?: boolean;
  override?: {
    originalAction: string;
    originalAmount: number;
    newAction?: string;
    newAmount?: number;
    overrideReason: string;
    overrideCategory: string;
    overriddenBy: string;
    overriddenAt: string;
  };
}

interface FreshInvestmentSuggestion {
  productType: string;
  productName: string;
  productId?: string;
  suggestedAmount: number;
  expectedReturn: string;
  riskLevel: string;
  matchScore: number;
  rationale: string;
  highlights: string[];
}

interface CombinedProposal {
  prospectId: string;
  proposalId: string;
  shareToken: string;
  analysis: PortfolioAnalysis;
  rebalancing: RebalanceRecommendation[];
  freshInvestments: FreshInvestmentSuggestion[];
  totalSellAmount: number;
  totalBuyAmount: number;
  netInvestmentRequired: number;
  projectedValue: number;
  projectedReturn: string;
  executiveSummary: string;
  proposalVersion?: number;
  parentProposalId?: string | null;
  isLatestVersion?: boolean;
  lockedAt?: string | null;
  agentName?: string | null;
}

const PRODUCT_TYPES = [
  { value: "mutual_fund", label: "Mutual Fund" },
  { value: "equity", label: "Stocks" },
  { value: "bond", label: "Bonds/NCDs" },
  { value: "fd", label: "Fixed Deposit" },
  { value: "gold", label: "Gold/SGB" },
  { value: "etf", label: "ETF" },
  { value: "pms", label: "PMS" },
  { value: "aif", label: "AIF" },
  { value: "insurance", label: "Insurance/ULIP" },
  { value: "other", label: "Other" }
];

const GOAL_OPTIONS = [
  { value: "wealth_creation", label: "Wealth Creation" },
  { value: "retirement", label: "Retirement Planning" },
  { value: "child_education", label: "Child Education" },
  { value: "home_purchase", label: "Home Purchase" },
  { value: "tax_saving", label: "Tax Saving" },
  { value: "regular_income", label: "Regular Income" },
  { value: "emergency_fund", label: "Emergency Fund" }
];

const PRODUCT_CATEGORY_OPTIONS = [
  { id: 'equity', label: 'Equity Mutual Funds', description: 'Large cap, mid cap, small cap, flexi cap funds', defaultSelected: true },
  { id: 'debt', label: 'Debt Mutual Funds', description: 'Corporate bonds, government securities, short duration', defaultSelected: true },
  { id: 'hybrid', label: 'Hybrid Funds', description: 'Balanced advantage, aggressive hybrid, multi-asset', defaultSelected: true },
  { id: 'gold_fof', label: 'Gold FOF', description: 'Gold Fund of Funds for portfolio hedging', defaultSelected: true },
  { id: 'silver_fof', label: 'Silver FOF', description: 'Silver ETF Fund of Funds', defaultSelected: false },
  { id: 'index_fund', label: 'Index Funds', description: 'Passive funds tracking Nifty, Sensex indices', defaultSelected: true },
  { id: 'international', label: 'International FOF', description: 'US equity, global tech, emerging markets funds', defaultSelected: false },
  { id: 'reit', label: 'REITs', description: 'Embassy, Mindspace, Brookfield real estate trusts', defaultSelected: false },
  { id: 'invit', label: 'InvITs', description: 'IndiGrid, IRB, PowerGrid infrastructure trusts', defaultSelected: false },
  { id: 'bonds', label: 'Corporate Bonds/NCDs', description: 'Direct corporate bonds, NCDs, G-Secs', defaultSelected: false },
  { id: 'mld', label: 'MLDs', description: 'Market Linked Debentures for tax-efficient returns', defaultSelected: false },
  { id: 'listed_stocks', label: 'Listed Stocks', description: 'Direct equity in NSE/BSE listed companies', defaultSelected: false },
  { id: 'unlisted_stocks', label: 'Unlisted Stocks', description: 'Pre-IPO & private company shares (Enhanced KYC required)', defaultSelected: false, requiresEnhancedKYC: true },
  { id: 'pms', label: 'PMS', description: 'Portfolio Management Services (Min ₹50L)', defaultSelected: false, minInvestment: 5000000 },
  { id: 'aif', label: 'AIF', description: 'Alternative Investment Funds (Min ₹1Cr)', defaultSelected: false, minInvestment: 10000000 },
  { id: 'global_advisory', label: 'Global Advisory (LRS)', description: 'International investments via Liberalised Remittance Scheme', defaultSelected: false, requiresEnhancedKYC: true },
  { id: 'us_markets', label: 'US Markets', description: 'NYSE, NASDAQ listed stocks & ETFs (🇺🇸)', defaultSelected: false, requiresEnhancedKYC: true },
  { id: 'europe_markets', label: 'European Markets', description: 'UK, Germany, France exchanges (🇪🇺)', defaultSelected: false, requiresEnhancedKYC: true },
  { id: 'asia_pacific_markets', label: 'Asia-Pacific Markets', description: 'Japan, Singapore, Australia, Hong Kong (🌏)', defaultSelected: false, requiresEnhancedKYC: true },
  { id: 'emerging_markets', label: 'Emerging Markets', description: 'Brazil, India, China growth opportunities (🌍)', defaultSelected: false, requiresEnhancedKYC: true },
];

const GLOBAL_MARKET_OPTIONS = [
  { id: 'us', label: 'US Markets', description: 'NYSE, NASDAQ listed securities', flag: '🇺🇸' },
  { id: 'europe', label: 'European Markets', description: 'UK, Germany, France exchanges', flag: '🇪🇺' },
  { id: 'china_hk', label: 'China/Hong Kong', description: 'HKSE, Shanghai, Shenzhen', flag: '🇨🇳' },
  { id: 'japan', label: 'Japan', description: 'Tokyo Stock Exchange', flag: '🇯🇵' },
  { id: 'other_asia', label: 'Other Asia', description: 'Singapore, Korea, Taiwan', flag: '🌏' },
];

const GLOBAL_INSTRUMENT_OPTIONS = [
  { id: 'stocks', label: 'Stocks', description: 'Direct equity shares' },
  { id: 'etfs', label: 'ETFs', description: 'Exchange traded funds' },
  { id: 'bonds', label: 'Bonds', description: 'Government & corporate bonds' },
  { id: 'mutual_funds', label: 'Mutual Funds', description: 'International mutual funds' },
];

interface GlobalAdvisorySelection {
  [marketId: string]: string[];
}

const LRS_ANNUAL_LIMIT_USD = 250000;

const DEFAULT_ALLOCATIONS = {
  conservative: { equity: 18, debt: 32, hybrid: 15, gold: 8, silver: 0, index: 5, international: 2, reit: 5, invit: 5, bonds: 5, mld: 0, listed_stocks: 5, unlisted_stocks: 0, pms: 0, aif: 0, global_advisory: 0, us_markets: 0, europe_markets: 0, asia_pacific_markets: 0, emerging_markets: 0 },
  moderate: { equity: 25, debt: 18, hybrid: 10, gold: 7, silver: 0, index: 8, international: 5, reit: 5, invit: 5, bonds: 5, mld: 2, listed_stocks: 8, unlisted_stocks: 2, pms: 0, aif: 0, global_advisory: 0, us_markets: 0, europe_markets: 0, asia_pacific_markets: 0, emerging_markets: 0 },
  aggressive: { equity: 26, debt: 6, hybrid: 6, gold: 5, silver: 2, index: 8, international: 0, reit: 5, invit: 5, bonds: 4, mld: 2, listed_stocks: 10, unlisted_stocks: 5, pms: 0, aif: 0, global_advisory: 0, us_markets: 6, europe_markets: 4, asia_pacific_markets: 4, emerging_markets: 2 },
  very_aggressive: { equity: 22, debt: 4, hybrid: 4, gold: 4, silver: 2, index: 6, international: 0, reit: 4, invit: 4, bonds: 4, mld: 3, listed_stocks: 12, unlisted_stocks: 8, pms: 0, aif: 0, global_advisory: 0, us_markets: 8, europe_markets: 5, asia_pacific_markets: 6, emerging_markets: 4 }
};

const CATEGORY_TO_ALLOCATION_MAP: Record<string, keyof typeof DEFAULT_ALLOCATIONS.moderate> = {
  equity: 'equity',
  debt: 'debt',
  hybrid: 'hybrid',
  gold_fof: 'gold',
  silver_fof: 'silver',
  index_fund: 'index',
  international: 'international',
  reit: 'reit',
  invit: 'invit',
  bonds: 'bonds',
  mld: 'mld',
  listed_stocks: 'listed_stocks',
  unlisted_stocks: 'unlisted_stocks',
  pms: 'pms',
  aif: 'aif',
  global_advisory: 'global_advisory',
  us_markets: 'us_markets',
  europe_markets: 'europe_markets',
  asia_pacific_markets: 'asia_pacific_markets',
  emerging_markets: 'emerging_markets'
};

const ALLOCATION_TO_CATEGORY_MAP: Record<string, string> = {
  equity: 'equity',
  debt: 'debt',
  hybrid: 'hybrid',
  gold: 'gold_fof',
  silver: 'silver_fof',
  index: 'index_fund',
  international: 'international',
  reit: 'reit',
  invit: 'invit',
  bonds: 'bonds',
  mld: 'mld',
  listed_stocks: 'listed_stocks',
  unlisted_stocks: 'unlisted_stocks',
  pms: 'pms',
  aif: 'aif',
  global_advisory: 'global_advisory',
  us_markets: 'us_markets',
  europe_markets: 'europe_markets',
  asia_pacific_markets: 'asia_pacific_markets',
  emerging_markets: 'emerging_markets'
};

const deriveDefaultCategories = (riskTolerance: keyof typeof DEFAULT_ALLOCATIONS): string[] => {
  const allocations = DEFAULT_ALLOCATIONS[riskTolerance];
  return Object.entries(allocations)
    .filter(([_, value]) => value > 0)
    .map(([key]) => ALLOCATION_TO_CATEGORY_MAP[key])
    .filter(Boolean);
};

const computeAllocationsForSelectedCategories = (
  selectedCategories: string[],
  riskTolerance: keyof typeof DEFAULT_ALLOCATIONS
): typeof DEFAULT_ALLOCATIONS.moderate => {
  const baseAllocations = DEFAULT_ALLOCATIONS[riskTolerance];
  const result = { ...baseAllocations };
  
  Object.keys(result).forEach(key => {
    result[key as keyof typeof result] = 0;
  });
  
  if (selectedCategories.length === 0) {
    return result;
  }
  
  const selectedAllocationKeys = selectedCategories
    .map(cat => CATEGORY_TO_ALLOCATION_MAP[cat])
    .filter(Boolean);
  
  const totalOriginalWeight = selectedAllocationKeys.reduce((sum, key) => {
    return sum + (baseAllocations[key] || 0);
  }, 0);
  
  if (totalOriginalWeight === 0) {
    const equalShare = Math.floor(100 / selectedAllocationKeys.length);
    const remainder = 100 - (equalShare * selectedAllocationKeys.length);
    selectedAllocationKeys.forEach((key, idx) => {
      result[key] = equalShare + (idx === 0 ? remainder : 0);
    });
    return result;
  }
  
  let allocated = 0;
  selectedAllocationKeys.forEach((key, idx) => {
    const originalWeight = baseAllocations[key] || 0;
    const proportionalShare = Math.round((originalWeight / totalOriginalWeight) * 100);
    if (idx === selectedAllocationKeys.length - 1) {
      result[key] = 100 - allocated;
    } else {
      result[key] = proportionalShare;
      allocated += proportionalShare;
    }
  });
  
  return result;
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

// PDF-safe currency formatter (jsPDF's Helvetica doesn't support ₹ Unicode)
const formatCurrencyForPdf = (amount: number) => {
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0
  }).format(amount);
  return `Rs. ${formatted}`;
};

// LOT-AWARE TAX CALCULATION (Per Fix Spec Section 4)
// FIFO lot-wise: Equity MF < 12 months = STCG, >= 12 months = LTCG
const calculateLotTaxStatus = (purchaseDate: string): { type: 'LTCG' | 'STCG'; holdingDays: number } => {
  const purchaseDateObj = new Date(purchaseDate);
  const today = new Date();
  const holdingDays = Math.floor((today.getTime() - purchaseDateObj.getTime()) / (1000 * 60 * 60 * 24));
  return {
    type: holdingDays >= 365 ? 'LTCG' : 'STCG',
    holdingDays
  };
};

// EXIT LOAD CALCULATION (Per Fix Spec Section 5)
// Default: 0.5% if redeemed within 1 month, nil after
const calculateLotExitLoad = (purchaseDate: string, exitLoadDays: number = 30, exitLoadPercent: number = 0.5): 
  { hasExitLoad: boolean; daysRemaining: number; exitLoadPercent: number } => {
  const purchaseDateObj = new Date(purchaseDate);
  const today = new Date();
  const daysSincePurchase = Math.floor((today.getTime() - purchaseDateObj.getTime()) / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.max(0, exitLoadDays - daysSincePurchase);
  return {
    hasExitLoad: daysSincePurchase < exitLoadDays,
    daysRemaining,
    exitLoadPercent: daysSincePurchase < exitLoadDays ? exitLoadPercent : 0
  };
};

// Get tax summary for holding (Section 4.2)
// AUTHORITATIVE FIX: Accept both purchaseDate (legacy) and transactionDate/transactionDateStr (new)
const getHoldingTaxSummary = (lots: Array<{ purchaseDate?: string; transactionDate?: Date | string; transactionDateStr?: string; units: number }> | undefined): 
  { hasLots: boolean; ltcgUnits: number; stcgUnits: number; taxStatus: 'All LTCG' | 'All STCG' | 'Mixed' | 'Unknown' } => {
  if (!lots || lots.length === 0) {
    return { hasLots: false, ltcgUnits: 0, stcgUnits: 0, taxStatus: 'Unknown' };
  }
  
  let ltcgUnits = 0;
  let stcgUnits = 0;
  
  for (const lot of lots) {
    // AUTHORITATIVE FIX: Use transactionDateStr or transactionDate first, fallback to purchaseDate
    const dateStr = lot.transactionDateStr || 
      (lot.transactionDate ? (typeof lot.transactionDate === 'string' ? lot.transactionDate : lot.transactionDate.toISOString()) : null) ||
      lot.purchaseDate;
    if (!dateStr) continue;
    
    const { type } = calculateLotTaxStatus(dateStr);
    if (type === 'LTCG') {
      ltcgUnits += lot.units;
    } else {
      stcgUnits += lot.units;
    }
  }
  
  let taxStatus: 'All LTCG' | 'All STCG' | 'Mixed' | 'Unknown' = 'Unknown';
  if (ltcgUnits > 0 && stcgUnits > 0) {
    taxStatus = 'Mixed';
  } else if (ltcgUnits > 0) {
    taxStatus = 'All LTCG';
  } else if (stcgUnits > 0) {
    taxStatus = 'All STCG';
  }
  
  return { hasLots: true, ltcgUnits, stcgUnits, taxStatus };
};

// Get exit load summary for holding (Section 5.1)
// AUTHORITATIVE FIX: Accept both purchaseDate (legacy) and transactionDate/transactionDateStr (new)
const getHoldingExitLoadSummary = (lots: Array<{ purchaseDate?: string; transactionDate?: Date | string; transactionDateStr?: string; units: number }> | undefined): 
  { hasLots: boolean; unitsWithExitLoad: number; unitsWithoutExitLoad: number; hasExitLoadRisk: boolean } => {
  if (!lots || lots.length === 0) {
    return { hasLots: false, unitsWithExitLoad: 0, unitsWithoutExitLoad: 0, hasExitLoadRisk: false };
  }
  
  let unitsWithExitLoad = 0;
  let unitsWithoutExitLoad = 0;
  
  for (const lot of lots) {
    // AUTHORITATIVE FIX: Use transactionDateStr or transactionDate first, fallback to purchaseDate
    const dateStr = lot.transactionDateStr || 
      (lot.transactionDate ? (typeof lot.transactionDate === 'string' ? lot.transactionDate : lot.transactionDate.toISOString()) : null) ||
      lot.purchaseDate;
    if (!dateStr) continue;
    
    const { hasExitLoad } = calculateLotExitLoad(dateStr);
    if (hasExitLoad) {
      unitsWithExitLoad += lot.units;
    } else {
      unitsWithoutExitLoad += lot.units;
    }
  }
  
  return { 
    hasLots: true, 
    unitsWithExitLoad, 
    unitsWithoutExitLoad, 
    hasExitLoadRisk: unitsWithExitLoad > 0 
  };
};

interface ExistingProspect {
  id: string;
  name: string;
  email?: string;
  mobile?: string;
  pan?: string;
  state?: string;
  createdAt?: string;
}

export default function AgentProspectWizard() {
  const { toast } = useToast();
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const urlProspectId = urlParams.get('prospectId');
  const zohoLeadId = urlParams.get('leadId');
  const zohoSource = urlParams.get('source');
  
  const [currentStep, setCurrentStep] = useState(1);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [prospectMode, setProspectMode] = useState<'new' | 'existing'>(urlProspectId ? 'existing' : 'new');
  const [prospectSearch, setProspectSearch] = useState('');
  
  const [prospectData, setProspectData] = useState({
    name: urlParams.get('name') || "",
    email: urlParams.get('email') || "",
    mobile: urlParams.get('phone') || "",
    pan: "",
    notes: urlParams.get('company') ? `Company: ${urlParams.get('company')}` : ""
  });

  const [riskProfile, setRiskProfile] = useState<RiskProfile>({
    riskTolerance: 'moderate',
    investmentHorizon: 'medium_term',
    primaryGoal: 'wealth_creation',
    monthlyIncome: 0,
    existingInvestments: 0,
    liquidityNeeds: 'medium'
  });

  // Goal Mapping State (Step 3)
  const [investmentGoals, setInvestmentGoals] = useState<Array<{
    id: string;
    goalType: string;
    goalName: string;
    targetAmount: number;
    timelineYears: number;
    priority: 'high' | 'medium' | 'low';
    currentProgress: number;
    monthlyContribution: number;
  }>>([]);
  
  const GOAL_TYPES = [
    { value: 'retirement', label: 'Retirement', icon: '🏖️' },
    { value: 'child_education', label: "Child's Education", icon: '🎓' },
    { value: 'house_purchase', label: 'House Purchase', icon: '🏠' },
    { value: 'wealth_creation', label: 'Wealth Creation', icon: '📈' },
    { value: 'emergency_fund', label: 'Emergency Fund', icon: '🛡️' },
    { value: 'car_purchase', label: 'Car Purchase', icon: '🚗' },
    { value: 'vacation', label: 'Vacation', icon: '✈️' },
    { value: 'wedding', label: 'Wedding', icon: '💍' },
    { value: 'business', label: 'Start Business', icon: '💼' },
    { value: 'other', label: 'Other', icon: '🎯' }
  ];

  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [newHolding, setNewHolding] = useState<Partial<PortfolioHolding>>({
    productType: "mutual_fund",
    productName: "",
    quantity: 1,
    currentValue: 0
  });
  const [editingHoldingIndex, setEditingHoldingIndex] = useState<number | null>(null);
  
  // SIP Mode - for adding multiple purchase lots for the same fund
  const [sipMode, setSipMode] = useState(false);
  const [sipLots, setSipLots] = useState<Array<{ purchaseDate: string; units: number; investedAmount?: number }>>([
    { purchaseDate: '', units: 0 }
  ]);
  
  // Product search state for autocomplete
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [productSearchResults, setProductSearchResults] = useState<any[]>([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [selectedInstrumentPrice, setSelectedInstrumentPrice] = useState<number | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [savedHoldingsLoaded, setSavedHoldingsLoaded] = useState(false);

  const [freshInvestmentAmount, setFreshInvestmentAmount] = useState(0);
  const [analysis, setAnalysis] = useState<PortfolioAnalysis | null>(null);
  
  // Asset Allocation & Category Selection State
  const [categorySelectionMode, setCategorySelectionMode] = useState<'ai_default' | 'manual'>('ai_default');
  const [customAllocations, setCustomAllocations] = useState<{
    equity: number; debt: number; hybrid: number; gold: number; silver: number; index: number;
    international: number; reit: number; invit: number; bonds: number; mld: number; 
    listed_stocks: number; unlisted_stocks: number; pms: number; aif: number; global_advisory: number;
    us_markets: number; europe_markets: number; asia_pacific_markets: number; emerging_markets: number;
  }>(DEFAULT_ALLOCATIONS.moderate);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    PRODUCT_CATEGORY_OPTIONS.filter(c => c.defaultSelected).map(c => c.id)
  );
  
  // Get AI default categories based on risk profile - derived from DEFAULT_ALLOCATIONS
  const getAIDefaultCategories = (riskTolerance: string): string[] => {
    const allocations = DEFAULT_ALLOCATIONS[riskTolerance as keyof typeof DEFAULT_ALLOCATIONS] || DEFAULT_ALLOCATIONS.moderate;
    const categories: string[] = [];
    
    // Derive categories from allocations that have non-zero values
    Object.entries(allocations).forEach(([allocationKey, value]) => {
      if (value > 0) {
        // Map allocation key back to category ID using ALLOCATION_TO_CATEGORY_MAP
        const categoryId = ALLOCATION_TO_CATEGORY_MAP[allocationKey] || allocationKey;
        categories.push(categoryId);
      }
    });
    
    return categories;
  };
  
  // Apply AI default allocation based on risk profile
  const applyAIDefaultAllocation = () => {
    const aiCategories = getAIDefaultCategories(riskProfile.riskTolerance);
    setSelectedCategories(aiCategories);
    setCustomAllocations(DEFAULT_ALLOCATIONS[riskProfile.riskTolerance as keyof typeof DEFAULT_ALLOCATIONS] || DEFAULT_ALLOCATIONS.moderate);
  };
  
  // Map category IDs to allocation keys (handles differences like gold_fof -> gold)
  const categoryToAllocationKey = (categoryId: string): string => {
    const mapping: Record<string, string> = {
      'gold_fof': 'gold',
      'silver_fof': 'silver',
      'index_fund': 'index',
    };
    return mapping[categoryId] || categoryId;
  };
  
  // Check if an allocation key is in the selected categories
  const isAllocationKeySelected = (allocationKey: string): boolean => {
    return selectedCategories.some(catId => categoryToAllocationKey(catId) === allocationKey);
  };
  
  const [globalAdvisorySelections, setGlobalAdvisorySelections] = useState<GlobalAdvisorySelection>({});
  const [globalAdvisoryBudget, setGlobalAdvisoryBudget] = useState<number>(0);
  const [showGlobalAdvisory, setShowGlobalAdvisory] = useState(false);
  
  const hasGlobalAdvisorySelections = Object.values(globalAdvisorySelections).some(instruments => instruments.length > 0);
  const effectiveGlobalBudget = globalAdvisoryBudget > 0 ? globalAdvisoryBudget : (freshInvestmentAmount * (customAllocations.global_advisory / 100));
  const totalGlobalAllocation = customAllocations.global_advisory;
  
  const toggleGlobalMarketInstrument = (marketId: string, instrumentId: string) => {
    setGlobalAdvisorySelections(prev => {
      const currentInstruments = prev[marketId] || [];
      const hasInstrument = currentInstruments.includes(instrumentId);
      
      if (hasInstrument) {
        const newInstruments = currentInstruments.filter(i => i !== instrumentId);
        if (newInstruments.length === 0) {
          const { [marketId]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [marketId]: newInstruments };
      } else {
        return { ...prev, [marketId]: [...currentInstruments, instrumentId] };
      }
    });
  };
  
  const toggleAllInstrumentsForMarket = (marketId: string) => {
    setGlobalAdvisorySelections(prev => {
      const currentInstruments = prev[marketId] || [];
      if (currentInstruments.length === GLOBAL_INSTRUMENT_OPTIONS.length) {
        const { [marketId]: _, ...rest } = prev;
        return rest;
      } else {
        return { ...prev, [marketId]: GLOBAL_INSTRUMENT_OPTIONS.map(i => i.id) };
      }
    });
  };
  
  const selectAllGlobalMarkets = () => {
    const allSelected: GlobalAdvisorySelection = {};
    GLOBAL_MARKET_OPTIONS.forEach(market => {
      allSelected[market.id] = GLOBAL_INSTRUMENT_OPTIONS.map(i => i.id);
    });
    setGlobalAdvisorySelections(allSelected);
  };
  
  const clearAllGlobalMarkets = () => {
    setGlobalAdvisorySelections({});
  };
  
  // Calculate total portfolio value for eligibility checks
  const totalPortfolioValue = holdings.reduce((sum, h) => sum + (h.currentValue || 0), 0) + freshInvestmentAmount;
  
  // Handle category toggle with allocation redistribution
  const handleCategoryToggle = (categoryId: string, checked: boolean) => {
    const newCategories = checked
      ? [...selectedCategories, categoryId]
      : selectedCategories.filter(c => c !== categoryId);
    
    setSelectedCategories(newCategories);
    
    // Redistribute allocations proportionally among selected categories
    const newAllocations = computeAllocationsForSelectedCategories(
      newCategories,
      riskProfile.riskTolerance
    );
    setCustomAllocations(newAllocations);
  };
  
  // Reset both categories and allocations to AI defaults for risk profile
  const handleUseDefaultAllocations = () => {
    const defaultCategories = deriveDefaultCategories(riskProfile.riskTolerance);
    const defaultAllocations = DEFAULT_ALLOCATIONS[riskProfile.riskTolerance];
    
    setSelectedCategories(defaultCategories);
    setCustomAllocations(defaultAllocations);
    
    // Also reset global advisory selections when using defaults
    setGlobalAdvisorySelections({});
    setGlobalAdvisoryBudget(0);
  };
  
  // Auto-reset PMS/AIF allocations when eligibility changes
  useEffect(() => {
    const MIN_PMS = 5000000;
    const MIN_AIF = 10000000;
    
    setCustomAllocations(prev => {
      let updated = { ...prev };
      let changed = false;
      
      // Reset PMS if ineligible and currently has allocation
      if (totalPortfolioValue < MIN_PMS && prev.pms > 0) {
        updated.pms = 0;
        changed = true;
      }
      
      // Reset AIF if ineligible and currently has allocation
      if (totalPortfolioValue < MIN_AIF && prev.aif > 0) {
        updated.aif = 0;
        changed = true;
      }
      
      return changed ? updated : prev;
    });
  }, [totalPortfolioValue]);
  
  // Apply AI defaults when entering Step 6 (Categories) in AI mode or when risk profile changes
  useEffect(() => {
    if (currentStep === 6 && categorySelectionMode === 'ai_default') {
      // Apply AI defaults based on current risk profile
      const aiCategories = getAIDefaultCategories(riskProfile.riskTolerance);
      setSelectedCategories(aiCategories);
      setCustomAllocations(DEFAULT_ALLOCATIONS[riskProfile.riskTolerance as keyof typeof DEFAULT_ALLOCATIONS] || DEFAULT_ALLOCATIONS.moderate);
    }
  }, [currentStep, categorySelectionMode, riskProfile.riskTolerance]);
  
  // Portfolio Import State
  const [importMode, setImportMode] = useState<'manual' | 'upload' | 'url'>('manual');
  const [importUrl, setImportUrl] = useState('');
  const [importResult, setImportResult] = useState<{
    success: boolean;
    holdings: any[];
    brokerDetected: string | null;
    confidenceScore: number;
    errors: string[];
    expectedCount?: number;
    importedCount?: number;
    unimportedCount?: number;
    needsManualReview?: boolean;
  } | null>(null);
  
  // CAS/Statement Import State
  const [showCASUploadDialog, setShowCASUploadDialog] = useState(false);
  
  // Smart Import Dialog State
  const [showSmartImportDialog, setShowSmartImportDialog] = useState(false);
  const [casFile, setCasFile] = useState<File | null>(null);
  const [casUploadType, setCasUploadType] = useState<'cas' | 'demat' | null>(null);
  const [casPreviewHoldings, setCasPreviewHoldings] = useState<Array<{
    id: string;
    name: string;
    symbol?: string;
    isin?: string;
    quantity: number;
    averagePrice: number;
    investedValue?: number;
    currentValue: number;
    currentNav?: number;
    unrealizedGain?: number;
    unrealizedGainPercent?: number;
    assetType: string;
    folioNumber?: string;
    confidenceScore?: number;
    broker?: string;
    // STEP 4: Lots from CAS parsing - each purchase = one lot
    firstPurchaseDate?: string;
    lots?: Array<{
      purchaseDate: string;
      transactionType: string;
      amount: number;
      units: number;
      nav: number;
      cost: number;
    }>;
    holdingTier?: 'FULL' | 'VALUATION_ONLY' | 'SUMMARY_PLACEHOLDER';
    eligibleForTax?: boolean;
    tierWarnings?: string[];
  }>>([]);
  const [casPreviewError, setCasPreviewError] = useState<string | null>(null);
  const [casPreviewMode, setCasPreviewMode] = useState(false);
  const [casImportSummary, setCasImportSummary] = useState<string | null>(null);
  // STEP 5 (FIX SPEC): Track date warning for save blocker
  const [casDateWarning, setCasDateWarning] = useState<string | null>(null);
  const [casLotCounts, setCasLotCounts] = useState<{ withLots: number; withMultipleLots: number; withoutLots: number } | null>(null);
  // STEP 5: Confirmation state for save blocker
  const [showDateWarningConfirm, setShowDateWarningConfirm] = useState(false);
  const [expandedHoldingIds, setExpandedHoldingIds] = useState<Set<string>>(new Set());
  const [editingLotHoldingId, setEditingLotHoldingId] = useState<string | null>(null);
  const [showEditHoldingsDialog, setShowEditHoldingsDialog] = useState(false);
  const [editableHoldings, setEditableHoldings] = useState<Array<{
    id: string;
    name: string;
    isin?: string;
    folioNumber?: string;
    purchaseDate?: string;
    quantity: number;
    avgPrice: number;
    currentValue: number;
  }>>([]);
  const [rebalancing, setRebalancing] = useState<RebalanceRecommendation[]>([]);
  const [taxSummary, setTaxSummary] = useState<any>(null);
  const [freshInvestments, setFreshInvestments] = useState<FreshInvestmentSuggestion[]>([]);
  const [proposal, setProposal] = useState<CombinedProposal | null>(null);
  
  // Exit Load Calendar State
  const [exitLoadData, setExitLoadData] = useState<{
    summary: { totalHoldings: number; exitLoadFree: number; withinExitLoadPeriod: number; totalExitLoadExposure: number };
    holdings: Array<{
      name: string;
      isin?: string;
      currentValue: number;
      isExitLoadFree: boolean;
      exitLoadFreeDate: string | null;
      daysToExitLoadFree: number | null;
      exitLoadPercent: number;
      currentExitLoadAmount: number;
    }>;
  } | null>(null);
  const [prospectId, setProspectId] = useState<string | null>(urlProspectId);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
  // Proposal Section Selection State - Agent can toggle which sections to include
  const [proposalSections, setProposalSections] = useState({
    exitLoadCalendar: true,
    capitalGainsSummary: true,
    portfolioHealthScore: true,
    expenseRatioAnalysis: true,
    dividendProjection: true,
    riskHeatmap: true,
    goalGapAnalysis: true,
    benchmarkComparison: true,
    priorityRecommendations: true,
    sipRecommendations: true,
    whatIfSimulator: true,
    executiveSummary: true
  });
  
  // Capital Gains Data State
  const [capitalGainsData, setCapitalGainsData] = useState<{
    stcg: { count: number; totalValue: number; taxableGain: number; estimatedTax: number };
    ltcg: { count: number; totalValue: number; taxableGain: number; estimatedTax: number; exemptionUsed: number };
    grandfathered: { count: number; benefit: number };
    totalTaxLiability: number;
    holdings: Array<{
      name: string;
      isin?: string;
      holdingPeriod: number;
      isLongTerm: boolean;
      purchaseValue: number;
      currentValue: number;
      gain: number;
      taxType: 'STCG' | 'LTCG';
      estimatedTax: number;
      isGrandfathered?: boolean;
    }>;
  } | null>(null);
  
  // Portfolio Health Score State
  const [healthScoreData, setHealthScoreData] = useState<{
    overallScore: number;
    components: {
      diversification: number;
      riskAlignment: number;
      costEfficiency: number;
      qualityScore: number;
      liquidityScore: number;
    };
    recommendations: string[];
  } | null>(null);
  
  // Expense Ratio Analysis State
  const [expenseRatioData, setExpenseRatioData] = useState<{
    weightedAvgTER: number;
    totalAnnualCost: number;
    potentialSavings: number;
    holdings: Array<{
      name: string;
      ter: number;
      value: number;
      annualCost: number;
      suggestedAlternative?: { name: string; ter: number; savings: number };
    }>;
  } | null>(null);
  
  // Dividend Income Projection State
  const [dividendData, setDividendData] = useState<{
    estimatedAnnualIncome: number;
    monthlyIncome: number;
    yieldPercent: number;
    holdings: Array<{
      name: string;
      value: number;
      dividendYield: number;
      estimatedAnnualDividend: number;
    }>;
  } | null>(null);
  
  // Risk Heatmap State
  const [riskHeatmapData, setRiskHeatmapData] = useState<{
    overallRisk: 'low' | 'medium' | 'high' | 'very_high';
    concentrationWarnings: Array<{
      type: 'sector' | 'asset' | 'stock' | 'amc';
      name: string;
      percentage: number;
      threshold: number;
      severity: 'warning' | 'critical';
    }>;
    sectorAllocation: Array<{ sector: string; percentage: number; value: number }>;
  } | null>(null);
  
  // Benchmark Comparison State  
  const [benchmarkData, setBenchmarkData] = useState<{
    portfolioReturn: { oneYear: number; threeYear: number; fiveYear: number };
    benchmarks: Array<{
      name: string;
      returns: { oneYear: number; threeYear: number; fiveYear: number };
    }>;
    alpha: number;
    beta: number;
  } | null>(null);
  
  // SIP Recommendations State
  const [sipRecommendations, setSipRecommendations] = useState<Array<{
    fundName: string;
    category: string;
    suggestedAmount: number;
    expectedReturn: number;
    riskLevel: string;
    rationale: string;
  }>>([]);
  
  // What-If Simulator State
  const [whatIfScenarios, setWhatIfScenarios] = useState<{
    scenarios: Array<{
      name: string;
      marketChange: number;
      portfolioImpact: number;
      newValue: number;
    }>;
    stressTestResult: {
      worstCase: number;
      recovery: string;
    };
  } | null>(null);

  const generateProposalPDF = async () => {
    if (!proposal?.shareToken) return;
    
    setIsGeneratingPdf(true);
    try {
      const response = await fetch(`/api/agent-wizard/public/proposal/${proposal.shareToken}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch proposal');
      const { proposal: storedProposal } = await response.json();
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let yPos = 0;
      
      const formatRs = (val: number | string) => {
        const num = typeof val === 'string' ? parseFloat(val) : val;
        if (isNaN(num)) return 'Rs. 0';
        if (num >= 10000000) return `Rs. ${(num / 10000000).toFixed(2)} Cr`;
        if (num >= 100000) return `Rs. ${(num / 100000).toFixed(2)} L`;
        return `Rs. ${num.toLocaleString('en-IN')}`;
      };
      
      const sanitizeText = (text: string) => {
        if (!text) return '';
        return text.replace(/₹/g, 'Rs. ').replace(/\*\*/g, '');
      };
      
      const checkPageBreak = (neededHeight: number) => {
        if (yPos + neededHeight > pageHeight - 20) {
          pdf.addPage();
          yPos = 20;
          return true;
        }
        return false;
      };

      // Header
      pdf.setFillColor(79, 70, 229);
      pdf.rect(0, 0, pageWidth, 35, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(22);
      pdf.setFont('helvetica', 'bold');
      pdf.text('FintekPro', margin, 22);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Investment Proposal', pageWidth - margin - 35, 22);
      
      yPos = 45;
      
      // Title
      pdf.setTextColor(30, 30, 30);
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      const title = sanitizeText(storedProposal.proposalTitle || `Investment Proposal for ${prospectData.name}`);
      pdf.text(title, margin, yPos);
      yPos += 8;
      
      // Executive Summary
      if (storedProposal.executiveSummary) {
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(80, 80, 80);
        const summaryText = sanitizeText(storedProposal.executiveSummary);
        const summaryLines = pdf.splitTextToSize(summaryText, pageWidth - (margin * 2));
        pdf.text(summaryLines, margin, yPos);
        yPos += summaryLines.length * 4 + 8;
      }
      
      // Key Metrics Box
      const metricsBoxHeight = 28;
      pdf.setFillColor(248, 250, 252);
      pdf.roundedRect(margin, yPos, pageWidth - (margin * 2), metricsBoxHeight, 3, 3, 'F');
      pdf.setDrawColor(226, 232, 240);
      pdf.roundedRect(margin, yPos, pageWidth - (margin * 2), metricsBoxHeight, 3, 3, 'S');
      
      const col4Width = (pageWidth - (margin * 2)) / 4;
      
      // Total Investment
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 100, 100);
      pdf.text('Total Investment', margin + 8, yPos + 9);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(30, 30, 30);
      pdf.text(formatRs(storedProposal.totalInvestmentAmount || 0), margin + 8, yPos + 20);
      
      // Expected Returns
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 100, 100);
      pdf.text('Expected Returns', margin + col4Width + 5, yPos + 9);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(22, 163, 74);
      pdf.text(`${storedProposal.projectedReturns || '12'}% p.a.`, margin + col4Width + 5, yPos + 20);
      
      // Projected Value
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 100, 100);
      pdf.text('5-Year Value', margin + (col4Width * 2) + 5, yPos + 9);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(124, 58, 237);
      pdf.text(formatRs(storedProposal.projectedValue || 0), margin + (col4Width * 2) + 5, yPos + 20);
      
      // Net Change
      const netChange = (proposal.totalBuyAmount || 0) - (proposal.totalSellAmount || 0);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 100, 100);
      pdf.text('Net Investment', margin + (col4Width * 3) + 5, yPos + 9);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(netChange >= 0 ? 22 : 220, netChange >= 0 ? 163 : 38, netChange >= 0 ? 74 : 38);
      pdf.text(formatRs(Math.abs(netChange)), margin + (col4Width * 3) + 5, yPos + 20);
      
      yPos += metricsBoxHeight + 12;
      
      // Parse stored analysis
      let storedAnalysis: any = null;
      if (storedProposal.currentAnalysis) {
        try { storedAnalysis = JSON.parse(storedProposal.currentAnalysis); } catch {}
      }
      
      // Portfolio Health Section
      if (storedAnalysis) {
        checkPageBreak(70);
        
        pdf.setTextColor(30, 30, 30);
        pdf.setFontSize(13);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Portfolio Health Analysis', margin, yPos);
        yPos += 10;
        
        const halfWidth = (pageWidth - (margin * 2) - 10) / 2;
        
        // Risk Score Card
        const riskScore = storedAnalysis.riskScore || 0;
        pdf.setFillColor(riskScore > 70 ? 254 : riskScore > 50 ? 254 : 240, 
                        riskScore > 70 ? 242 : riskScore > 50 ? 249 : 253, 
                        riskScore > 70 ? 242 : riskScore > 50 ? 235 : 244);
        pdf.roundedRect(margin, yPos, halfWidth, 35, 2, 2, 'F');
        
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(100, 100, 100);
        pdf.text('Risk Score', margin + 8, yPos + 10);
        
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(20);
        pdf.setTextColor(riskScore > 70 ? 185 : riskScore > 50 ? 202 : 22, 
                        riskScore > 70 ? 28 : riskScore > 50 ? 138 : 163, 
                        riskScore > 70 ? 28 : riskScore > 50 ? 4 : 74);
        pdf.text(`${riskScore}`, margin + 8, yPos + 25);
        pdf.setFontSize(10);
        pdf.text('/100', margin + 25, yPos + 25);
        
        const riskLabel = riskScore > 70 ? 'High Risk' : riskScore > 50 ? 'Moderate' : 'Low Risk';
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.text(riskLabel, margin + 8, yPos + 32);
        
        // Diversification Score Card
        const divScore = storedAnalysis.diversificationScore || 0;
        pdf.setFillColor(divScore >= 70 ? 240 : divScore >= 50 ? 254 : 254, 
                        divScore >= 70 ? 253 : divScore >= 50 ? 249 : 242, 
                        divScore >= 70 ? 244 : divScore >= 50 ? 235 : 242);
        pdf.roundedRect(margin + halfWidth + 10, yPos, halfWidth, 35, 2, 2, 'F');
        
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(100, 100, 100);
        pdf.text('Diversification Score', margin + halfWidth + 18, yPos + 10);
        
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(20);
        pdf.setTextColor(divScore >= 70 ? 22 : divScore >= 50 ? 202 : 185, 
                        divScore >= 70 ? 163 : divScore >= 50 ? 138 : 28, 
                        divScore >= 70 ? 74 : divScore >= 50 ? 4 : 28);
        pdf.text(`${divScore}`, margin + halfWidth + 18, yPos + 25);
        pdf.setFontSize(10);
        pdf.text('/100', margin + halfWidth + 35, yPos + 25);
        
        const divLabel = divScore >= 70 ? 'Well Diversified' : divScore >= 50 ? 'Moderate' : 'Needs Work';
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.text(divLabel, margin + halfWidth + 18, yPos + 32);
        
        yPos += 42;
        
        // Asset Allocation
        if (storedAnalysis.assetAllocation) {
          checkPageBreak(45);
          
          pdf.setFontSize(11);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(30, 30, 30);
          pdf.text('Current Asset Allocation', margin, yPos);
          yPos += 8;
          
          const allocationColors: Record<string, number[]> = {
            equity: [79, 70, 229],
            debt: [34, 197, 94],
            hybrid: [245, 158, 11],
            gold: [234, 179, 8],
            silver: [148, 163, 184],
            others: [107, 114, 128]
          };
          
          const allocEntries = Object.entries(storedAnalysis.assetAllocation)
            .filter(([_, data]: [string, any]) => data.percentage > 0)
            .sort((a: any, b: any) => b[1].percentage - a[1].percentage);
          
          const barWidth = pageWidth - (margin * 2);
          const barHeight = 12;
          let xOffset = margin;
          
          // Draw stacked bar
          allocEntries.forEach(([key, data]: [string, any]) => {
            const segmentWidth = (data.percentage / 100) * barWidth;
            const color = allocationColors[key] || [107, 114, 128];
            pdf.setFillColor(color[0], color[1], color[2]);
            pdf.rect(xOffset, yPos, segmentWidth, barHeight, 'F');
            xOffset += segmentWidth;
          });
          
          yPos += barHeight + 6;
          
          // Legend
          let legendX = margin;
          allocEntries.forEach(([key, data]: [string, any]) => {
            const color = allocationColors[key] || [107, 114, 128];
            pdf.setFillColor(color[0], color[1], color[2]);
            pdf.rect(legendX, yPos, 8, 8, 'F');
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(60, 60, 60);
            const label = `${key.charAt(0).toUpperCase() + key.slice(1)}: ${data.percentage.toFixed(1)}%`;
            pdf.text(label, legendX + 10, yPos + 6);
            legendX += 45;
            if (legendX > pageWidth - 60) {
              legendX = margin;
              yPos += 10;
            }
          });
          
          yPos += 15;
        }
        
        // Key Insights
        if (storedAnalysis.recommendations?.length > 0) {
          checkPageBreak(30);
          
          pdf.setFontSize(11);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(30, 30, 30);
          pdf.text('Key Insights', margin, yPos);
          yPos += 8;
          
          storedAnalysis.recommendations.slice(0, 4).forEach((insight: any) => {
            checkPageBreak(15);
            const iconColor = insight.type === 'warning' ? [234, 88, 12] : insight.type === 'opportunity' ? [22, 163, 74] : [59, 130, 246];
            pdf.setFillColor(iconColor[0], iconColor[1], iconColor[2]);
            pdf.circle(margin + 3, yPos + 2, 2, 'F');
            
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(60, 60, 60);
            const insightLines = pdf.splitTextToSize(insight.message, pageWidth - (margin * 2) - 12);
            pdf.text(insightLines.slice(0, 2), margin + 10, yPos + 3);
            yPos += Math.min(insightLines.length, 2) * 4 + 4;
          });
          
          yPos += 8;
        }
      }
      
      // Recommendations
      const recommendations = storedProposal.recommendations || [];
      const rebalancingRecs = recommendations.filter((r: any) => r.action === 'SELL' || r.action === 'BUY' || r.action === 'SWITCH' || r.action === 'HOLD');
      const freshInvestmentRecs = recommendations.filter((r: any) => r.suggestedAmount !== undefined && !r.action);
      
      // Rebalancing Section
      if (rebalancingRecs.length > 0) {
        checkPageBreak(25);
        
        pdf.setTextColor(30, 30, 30);
        pdf.setFontSize(13);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Rebalancing Recommendations', margin, yPos);
        yPos += 10;
        
        rebalancingRecs.forEach((rec: any) => {
          const hasTargetFund = rec.action === 'SWITCH' && rec.targetFund;
          const hasRationale = rec.rationale?.length > 0;
          const rationaleLines = hasRationale ? pdf.splitTextToSize(sanitizeText(rec.rationale), pageWidth - (margin * 2) - 12) : [];
          const showLines = Math.min(rationaleLines.length, 4);
          const boxHeight = hasTargetFund ? 48 : (22 + (showLines * 4));
          
          checkPageBreak(boxHeight + 5);
          
          // Card background
          pdf.setFillColor(250, 250, 252);
          pdf.roundedRect(margin, yPos, pageWidth - (margin * 2), boxHeight, 2, 2, 'F');
          
          // Action indicator
          const actionColor = rec.action === 'SELL' ? [220, 38, 38] : rec.action === 'BUY' ? [22, 163, 74] : [234, 88, 12];
          pdf.setFillColor(actionColor[0], actionColor[1], actionColor[2]);
          pdf.rect(margin, yPos, 4, boxHeight, 'F');
          
          // Action badge
          pdf.setFillColor(actionColor[0], actionColor[1], actionColor[2]);
          pdf.roundedRect(margin + 8, yPos + 4, 28, 10, 2, 2, 'F');
          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(7);
          pdf.setFont('helvetica', 'bold');
          pdf.text(rec.action, margin + 12, yPos + 11);
          
          // Product name
          pdf.setTextColor(30, 30, 30);
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'bold');
          const productName = rec.productName?.length > 45 ? rec.productName.substring(0, 45) + '...' : rec.productName;
          pdf.text(productName || '', margin + 40, yPos + 11);
          
          // Current value
          if (rec.currentValue) {
            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(100, 100, 100);
            pdf.text(`Current: ${formatRs(rec.currentValue)}`, pageWidth - margin - 45, yPos + 11);
          }
          
          // Amount change
          pdf.setTextColor(actionColor[0], actionColor[1], actionColor[2]);
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'bold');
          if (rec.action === 'SWITCH' && rec.switchAmount) {
            pdf.text(`Switch: ${formatRs(rec.switchAmount)}`, margin + 8, yPos + 20);
          } else if (rec.changeAmount !== undefined) {
            const sign = rec.changeAmount < 0 ? '-' : '+';
            pdf.text(`${sign} ${formatRs(Math.abs(rec.changeAmount))}`, margin + 8, yPos + 20);
          }
          
          // Target fund for SWITCH
          if (hasTargetFund) {
            pdf.setTextColor(22, 163, 74);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(9);
            const targetName = rec.targetFund.name?.length > 50 ? rec.targetFund.name.substring(0, 50) + '...' : rec.targetFund.name;
            pdf.text(`-> ${targetName}`, margin + 8, yPos + 30);
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8);
            pdf.setTextColor(100, 100, 100);
            pdf.text(`${rec.targetFund.returns3Y}% 3Y returns | ${rec.targetFund.risk} risk`, margin + 8, yPos + 38);
          } else if (hasRationale) {
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(80, 80, 80);
            pdf.text(rationaleLines.slice(0, showLines), margin + 8, yPos + 28);
          }
          
          yPos += boxHeight + 4;
        });
      }
      
      // Fresh Investments Section
      if (freshInvestmentRecs.length > 0) {
        yPos += 6;
        checkPageBreak(25);
        
        pdf.setTextColor(30, 30, 30);
        pdf.setFontSize(13);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Fresh Investment Suggestions', margin, yPos);
        yPos += 10;
        
        freshInvestmentRecs.forEach((inv: any) => {
          const hasRationale = inv.rationale?.length > 0;
          const rationaleLines = hasRationale ? pdf.splitTextToSize(sanitizeText(inv.rationale), pageWidth - (margin * 2) - 12) : [];
          const showLines = Math.min(rationaleLines.length, 4);
          const boxHeight = 24 + (showLines * 4);
          
          checkPageBreak(boxHeight + 5);
          
          // Card background
          pdf.setFillColor(250, 250, 252);
          pdf.roundedRect(margin, yPos, pageWidth - (margin * 2), boxHeight, 2, 2, 'F');
          
          // Indicator
          pdf.setFillColor(79, 70, 229);
          pdf.rect(margin, yPos, 4, boxHeight, 'F');
          
          // Product name
          pdf.setTextColor(30, 30, 30);
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'bold');
          const productName = inv.productName?.length > 50 ? inv.productName.substring(0, 50) + '...' : inv.productName;
          pdf.text(productName || '', margin + 8, yPos + 10);
          
          // Amount
          pdf.setTextColor(22, 163, 74);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(10);
          pdf.text(formatRs(inv.suggestedAmount), pageWidth - margin - 35, yPos + 10);
          
          // Metrics row
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(100, 100, 100);
          const riskColor = inv.riskLevel?.toLowerCase().includes('high') ? 'High' : inv.riskLevel?.toLowerCase().includes('low') ? 'Low' : 'Moderate';
          pdf.text(`Expected: ${inv.expectedReturn} | Risk: ${riskColor} | Match: ${inv.matchScore}%`, margin + 8, yPos + 18);
          
          // Rationale
          if (hasRationale) {
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(80, 80, 80);
            pdf.text(rationaleLines.slice(0, showLines), margin + 8, yPos + 26);
          }
          
          yPos += boxHeight + 4;
        });
      }
      
      // Agent Contact Footer
      if (storedProposal.agentName || storedProposal.agentMobile || storedProposal.agentEmail) {
        checkPageBreak(35);
        yPos += 10;
        
        pdf.setFillColor(248, 250, 252);
        pdf.roundedRect(margin, yPos, pageWidth - (margin * 2), 28, 3, 3, 'F');
        pdf.setDrawColor(226, 232, 240);
        pdf.roundedRect(margin, yPos, pageWidth - (margin * 2), 28, 3, 3, 'S');
        
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 30, 30);
        pdf.text('Your Financial Advisor', margin + 8, yPos + 10);
        
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(60, 60, 60);
        const contactInfo = [
          storedProposal.agentName,
          storedProposal.agentMobile ? `Tel: ${storedProposal.agentMobile}` : null,
          storedProposal.agentEmail ? `Email: ${storedProposal.agentEmail}` : null
        ].filter(Boolean).join(' | ');
        pdf.text(contactInfo, margin + 8, yPos + 20);
      }
      
      // Footer on all pages
      const pageCount = pdf.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        
        // Footer line
        pdf.setDrawColor(226, 232, 240);
        pdf.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
        
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(150, 150, 150);
        pdf.text('This proposal is for informational purposes only. Investment in securities market are subject to market risks.', margin, pageHeight - 10);
        
        const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        pdf.text(`Generated: ${dateStr} | Page ${i} of ${pageCount}`, pageWidth - margin - 45, pageHeight - 10);
      }
      
      pdf.save(`Proposal_${prospectData.name.replace(/\s+/g, '_')}_${proposal.proposalId}.pdf`);
      
      toast({
        title: "PDF Downloaded",
        description: "Investment proposal has been downloaded successfully.",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Download Failed",
        description: "Unable to generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const { data: existingProspectsData, isLoading: loadingProspects } = useQuery<{ success: boolean; prospects: ExistingProspect[] }>({
    queryKey: ["/api/agent-wizard/prospects"],
    enabled: prospectMode === 'existing'
  });

  const existingProspects = existingProspectsData?.prospects || [];
  const searchLower = prospectSearch.toLowerCase();
  const filteredProspects = existingProspects.filter(p => 
    (p.name || '').toLowerCase().includes(searchLower) ||
    (p.email || '').toLowerCase().includes(searchLower) ||
    (p.pan || '').toLowerCase().includes(searchLower)
  );

  const selectExistingProspect = (prospect: ExistingProspect, autoAdvance = false) => {
    setProspectId(prospect.id);
    setProspectData({
      name: prospect.name || "",
      email: prospect.email || "",
      mobile: prospect.mobile || "",
      pan: prospect.pan || "",
      notes: ""
    });
    if (autoAdvance) {
      setCurrentStep(2);
      toast({ title: "Prospect Loaded", description: `${prospect.name} loaded. Configure risk profile.` });
    } else {
      toast({ title: "Prospect Selected", description: `${prospect.name} selected. Continue to Risk Profile.` });
    }
  };

  useEffect(() => {
    if (urlProspectId && existingProspects.length > 0 && currentStep === 1) {
      const found = existingProspects.find(p => p.id === urlProspectId);
      if (found) {
        selectExistingProspect(found, true);
      }
    }
  }, [urlProspectId, existingProspects]);

  // Load saved holdings when prospect is selected
  useEffect(() => {
    const loadSavedHoldings = async () => {
      if (prospectId && !savedHoldingsLoaded) {
        try {
          const response = await fetch(`/api/agent-wizard/prospects/${prospectId}/holdings`, {
            credentials: 'include'
          });
          if (response.ok) {
            const payload = await response.json();
            // API returns { success: true, holdings: [...] }
            const backendHoldings = payload.holdings ?? [];
            console.log('[Holdings] Loaded saved holdings (backend):', backendHoldings.length);
            if (backendHoldings.length > 0) {
              // Transform backend holdings to frontend format
              const frontendHoldings = backendHoldings.map(toFrontendHolding);
              console.log('[Holdings] Transformed to frontend format:', frontendHoldings.length);
              setHoldings(frontendHoldings);
              toast({ 
                title: "Portfolio Loaded", 
                description: `${frontendHoldings.length} saved holdings loaded from previous session` 
              });
            }
          }
          setSavedHoldingsLoaded(true);
        } catch (error) {
          console.error("Error loading saved holdings:", error);
          setSavedHoldingsLoaded(true);
        }
      }
    };
    loadSavedHoldings();
  }, [prospectId, savedHoldingsLoaded]);

  // Reset savedHoldingsLoaded when prospect changes
  useEffect(() => {
    setSavedHoldingsLoaded(false);
  }, [prospectId]);

  // Load saved goals when prospect is selected
  const [savedGoalsLoaded, setSavedGoalsLoaded] = useState(false);
  useEffect(() => {
    const loadSavedGoals = async () => {
      if (prospectId && !savedGoalsLoaded) {
        try {
          const response = await fetch(`/api/agent-wizard/prospects/${prospectId}/goals`, {
            credentials: 'include'
          });
          if (response.ok) {
            const payload = await response.json();
            const backendGoals = payload.goals ?? [];
            console.log('[Goals] Loaded saved goals:', backendGoals.length);
            if (backendGoals.length > 0) {
              setInvestmentGoals(backendGoals.map((g: any) => ({
                id: g.id || `goal-${Date.now()}-${Math.random()}`,
                goalType: g.goalType || 'wealth_creation',
                goalName: g.goalName || '',
                targetAmount: g.targetAmount || 0,
                timelineYears: g.timelineYears || 5,
                priority: g.priority || 'medium',
                currentProgress: g.currentProgress || 0,
                monthlyContribution: g.monthlyContribution || 0
              })));
              toast({ 
                title: "Goals Loaded", 
                description: `${backendGoals.length} saved goals loaded from previous session` 
              });
            }
          }
          setSavedGoalsLoaded(true);
        } catch (error) {
          console.error("Error loading saved goals:", error);
          setSavedGoalsLoaded(true);
        }
      }
    };
    loadSavedGoals();
  }, [prospectId, savedGoalsLoaded]);

  // Reset savedGoalsLoaded when prospect changes
  useEffect(() => {
    setSavedGoalsLoaded(false);
  }, [prospectId]);

  // Auto-save goals when modified (debounced) - includes empty array to clear goals
  const goalsAutoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousGoalsRef = useRef<string>('');
  useEffect(() => {
    if (!prospectId || !savedGoalsLoaded) return;
    
    // Serialize goals to detect actual changes
    const goalsJson = JSON.stringify(investmentGoals);
    if (goalsJson === previousGoalsRef.current) return;
    previousGoalsRef.current = goalsJson;
    
    if (goalsAutoSaveTimeoutRef.current) {
      clearTimeout(goalsAutoSaveTimeoutRef.current);
    }
    
    goalsAutoSaveTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/agent-wizard/prospects/${prospectId}/goals`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ goals: investmentGoals })
        });
        if (response.ok) {
          console.log('[Goals] Auto-saved', investmentGoals.length, 'goals');
        }
      } catch (error) {
        console.error('[Goals] Auto-save error:', error);
      }
    }, 1500); // Debounce: wait 1.5s after last change
    
    return () => {
      if (goalsAutoSaveTimeoutRef.current) {
        clearTimeout(goalsAutoSaveTimeoutRef.current);
      }
    };
  }, [prospectId, investmentGoals, savedGoalsLoaded]);

  // Product search for autocomplete - debounced search
  useEffect(() => {
    const searchProducts = async () => {
      if (productSearchQuery.length < 3) {
        setProductSearchResults([]);
        setShowProductDropdown(false);
        return;
      }

      setIsSearchingProducts(true);
      try {
        // Map frontend productType to backend assetClass
        const assetClassMap: Record<string, string> = {
          'mutual_fund': 'mutual_fund',
          'equity': 'equity',
          'etf': 'etf',
          'bond': 'bond',
          'fd': 'fixed_deposit',
          'gold': 'gold',
        };
        const assetClass = assetClassMap[newHolding.productType || 'mutual_fund'] || '';
        
        const response = await fetch(`/api/instruments/search?q=${encodeURIComponent(productSearchQuery)}&assetClass=${assetClass}&limit=10`);
        if (response.ok) {
          const data = await response.json();
          setProductSearchResults(data.instruments || []);
          setShowProductDropdown(data.instruments?.length > 0);
        }
      } catch (error) {
        console.error("Product search error:", error);
      } finally {
        setIsSearchingProducts(false);
      }
    };

    const debounceTimer = setTimeout(searchProducts, 300);
    return () => clearTimeout(debounceTimer);
  }, [productSearchQuery, newHolding.productType]);

  // Handle selecting a product from search results
  const selectProduct = (instrument: any) => {
    const price = parseFloat(instrument.lastPrice) || parseFloat(instrument.nav) || 0;
    setNewHolding({
      ...newHolding,
      productName: instrument.name || instrument.shortName,
      isin: instrument.isin,
      currentValue: price * (newHolding.quantity || 1)
    });
    setSelectedInstrumentPrice(price);
    setProductSearchQuery(instrument.name || instrument.shortName);
    setShowProductDropdown(false);
  };

  // Recalculate current value when units change
  const handleUnitsChange = (units: number) => {
    const calculatedValue = selectedInstrumentPrice ? units * selectedInstrumentPrice : newHolding.currentValue || 0;
    setNewHolding({
      ...newHolding,
      quantity: units,
      currentValue: selectedInstrumentPrice ? calculatedValue : newHolding.currentValue || 0
    });
  };

  useEffect(() => {
    // When risk profile changes, reset both allocations AND categories to defaults
    const defaultAllocations = DEFAULT_ALLOCATIONS[riskProfile.riskTolerance];
    const defaultCategories = deriveDefaultCategories(riskProfile.riskTolerance);
    
    setCustomAllocations(defaultAllocations);
    setSelectedCategories(defaultCategories);
    
    // Also reset global advisory when risk profile changes
    setGlobalAdvisorySelections({});
    setGlobalAdvisoryBudget(0);
  }, [riskProfile.riskTolerance]);

  const [duplicateInfo, setDuplicateInfo] = useState<{
    isDuplicate: boolean;
    duplicateType?: 'existing_client' | 'existing_prospect';
    existingRecord?: {
      id: string;
      name?: string | null;
      email?: string | null;
      mobile?: string | null;
      pan?: string | null;
      currentAgentId?: string | null;
      currentAgentName?: string | null;
    };
    message?: string;
    canRequestMapping?: boolean;
  } | null>(null);

  const createProspectMutation = useMutation({
    mutationFn: async (data: typeof prospectData) => {
      const result = await apiRequest("/api/agent-wizard/prospects", {
        method: "POST",
        body: JSON.stringify(data)
      });
      if (result.isDuplicate) {
        throw { isDuplicate: true, ...result };
      }
      return result;
    },
    onSuccess: (data) => {
      if (data.success) {
        setDuplicateInfo(null);
        setProspectId(data.prospectId);
        toast({ title: "Prospect Created", description: "Prospect profile saved successfully." });
        setCurrentStep(2);
      }
    },
    onError: (error: any) => {
      if (error?.isDuplicate) {
        setDuplicateInfo(error);
        if (error.duplicateType === 'existing_prospect') {
          toast({ 
            title: "Duplicate Prospect", 
            description: error.message || "This prospect already exists.", 
            variant: "destructive" 
          });
        }
      } else {
        toast({ 
          title: "Error", 
          description: error?.message || "Failed to create prospect.", 
          variant: "destructive" 
        });
      }
    }
  });

  const requestMappingMutation = useMutation({
    mutationFn: async (data: any) => {
      const result = await apiRequest("/api/agent-wizard/request-mapping", {
        method: "POST",
        body: JSON.stringify(data)
      });
      return result;
    },
    onSuccess: (data) => {
      if (data.success) {
        setDuplicateInfo(null);
        toast({ 
          title: "Request Submitted", 
          description: data.message || "Your mapping request has been sent to admin for approval." 
        });
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit mapping request.", variant: "destructive" });
    }
  });

  // Helper function to reload holdings from server
  const reloadHoldingsFromServer = async () => {
    if (!prospectId) return;
    try {
      const response = await fetch(`/api/agent-wizard/prospects/${prospectId}/holdings`, {
        credentials: 'include'
      });
      if (response.ok) {
        const payload = await response.json();
        // API returns { success: true, holdings: [...] }
        const backendHoldings = payload.holdings ?? [];
        console.log('[Holdings] Reloaded from server (backend):', backendHoldings.length);
        // Transform backend holdings to frontend format
        const frontendHoldings = backendHoldings.map(toFrontendHolding);
        setHoldings(frontendHoldings);
      }
    } catch (error) {
      console.error('Error reloading holdings:', error);
    }
  };

  // Portfolio upload mutation with merge and persist functionality
  const uploadPortfolioMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('portfolio', file);
      const res = await fetch(`/api/agent/prospects/${prospectId}/portfolio/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      return res.json();
    },
    onSuccess: async (data) => {
      if (data.success) {
        setImportResult(data);
        if (data.holdings && data.holdings.length > 0) {
          // Convert imported holdings to frontend format first, then transform to backend
          // This ensures proper handling of special types (pms, aif, insurance)
          const backendHoldings = data.holdings.map((h: any) => {
            const frontendHolding: PortfolioHolding = {
              id: h.id || crypto.randomUUID(),
              productName: h.name || h.productName || '',
              productType: h.assetType || h.productType || 'mutual_fund',
              quantity: h.units || h.quantity || 1,
              currentValue: h.currentValue || 0,
              isin: h.isin,
              symbol: h.symbol
            };
            return toBackendHolding(frontendHolding);
          });
          
          // Persist merged holdings to backend using bulk merge endpoint
          try {
            const mergeRes = await fetch(`/api/agent-wizard/prospects/${prospectId}/holdings/merge`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ holdings: backendHoldings })
            });
            
            const mergeData = await mergeRes.json();
            
            if (mergeRes.ok && mergeData.success) {
              // Transform backend holdings to frontend format and update local state
              const frontendHoldings = (mergeData.holdings || []).map(toFrontendHolding);
              setHoldings(frontendHoldings);
              
              // Invalidate holdings cache
              queryClient.invalidateQueries({ 
                predicate: (query) => {
                  const key = query.queryKey;
                  return Array.isArray(key) && typeof key[0] === 'string' && key[0].includes('holdings');
                }
              });
              
              // Show appropriate toast based on whether all funds were imported
              if (data.unimportedCount && data.unimportedCount > 0) {
                toast({ 
                  title: "Partial Import - Manual Entry Needed", 
                  description: `Imported ${data.importedCount} of ${data.expectedCount} holdings. ${data.unimportedCount} fund(s) need manual entry.`,
                  variant: "default"
                });
              } else {
                toast({ 
                  title: "Portfolio Imported & Saved", 
                  description: `Detected ${data.brokerDetected || 'portfolio'}: ${mergeData.addedCount || data.holdings.length} holdings imported and saved.` 
                });
              }
            } else {
              // Merge failed - reload from server to show authoritative data
              await reloadHoldingsFromServer();
              toast({ 
                title: "Import Failed to Save", 
                description: `Could not save holdings: ${mergeData.message || 'Validation error'}. Please try again.`,
                variant: "destructive"
              });
            }
          } catch (err) {
            console.error('Failed to persist imported holdings:', err);
            // Reload from server to ensure UI matches saved state
            await reloadHoldingsFromServer();
            toast({ 
              title: "Import Failed to Save", 
              description: "Could not save holdings. Please try again.",
              variant: "destructive"
            });
          }
        }
      } else {
        toast({ title: "Import Failed", description: data.error || "Could not parse portfolio file.", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Upload Error", description: "Failed to upload portfolio file.", variant: "destructive" });
    }
  });

  // Portfolio URL import mutation with merge and persist functionality
  const importUrlMutation = useMutation({
    mutationFn: async (url: string) => {
      const res = await apiRequest(`/api/agent/prospects/${prospectId}/portfolio/import-url`, {
        method: 'POST',
        body: JSON.stringify({ portfolioUrl: url })
      });
      return res.json();
    },
    onSuccess: async (data) => {
      if (data.success) {
        setImportResult(data);
        if (data.holdings && data.holdings.length > 0) {
          // Convert imported holdings to frontend format first, then transform to backend
          // This ensures proper handling of special types (pms, aif, insurance)
          const backendHoldings = data.holdings.map((h: any) => {
            const frontendHolding: PortfolioHolding = {
              id: h.id || crypto.randomUUID(),
              productName: h.name || h.productName || '',
              productType: h.assetType || h.productType || 'mutual_fund',
              quantity: h.units || h.quantity || 1,
              currentValue: h.currentValue || 0,
              isin: h.isin,
              symbol: h.symbol
            };
            return toBackendHolding(frontendHolding);
          });
          
          // Persist merged holdings to backend using bulk merge endpoint
          try {
            const mergeRes = await fetch(`/api/agent-wizard/prospects/${prospectId}/holdings/merge`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ holdings: backendHoldings })
            });
            
            const mergeData = await mergeRes.json();
            
            if (mergeRes.ok && mergeData.success) {
              // Transform backend holdings to frontend format and update local state
              const frontendHoldings = (mergeData.holdings || []).map(toFrontendHolding);
              setHoldings(frontendHoldings);
              
              queryClient.invalidateQueries({ 
                predicate: (query) => {
                  const key = query.queryKey;
                  return Array.isArray(key) && typeof key[0] === 'string' && key[0].includes('holdings');
                }
              });
              
              toast({ 
                title: "Portfolio Imported & Saved", 
                description: `${mergeData.addedCount || data.holdings.length} holdings imported from ${data.brokerDetected || 'URL'} and saved.` 
              });
            } else {
              // Merge failed - reload from server to show authoritative data
              await reloadHoldingsFromServer();
              toast({ 
                title: "Import Failed to Save", 
                description: `Could not save holdings: ${mergeData.message || 'Validation error'}. Please try again.`,
                variant: "destructive"
              });
            }
          } catch (err) {
            console.error('Failed to persist imported holdings:', err);
            // Reload from server to ensure UI matches saved state
            await reloadHoldingsFromServer();
            toast({ 
              title: "Import Failed to Save", 
              description: "Could not save holdings. Please try again.",
              variant: "destructive"
            });
          }
        }
      } else {
        toast({ title: "Import Failed", description: data.error || "Could not parse portfolio from URL.", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "URL Import Error", description: "Failed to import from URL.", variant: "destructive" });
    }
  });

  // CAS/Statement Preview Mutation
  const casPreviewMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', casUploadType || 'cas');
      const res = await fetch(`/api/agent-wizard/portfolio/parse-cas`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success && data.holdings?.length > 0) {
        setCasPreviewHoldings(data.holdings);
        setCasPreviewMode(true);
        setCasPreviewError(null);
        setCasImportSummary(data.importSummary || null);
        // STEP 5 (FIX SPEC): Capture date warning and lot counts from backend
        setCasDateWarning(data.dateWarningMessage || null);
        setCasLotCounts(data.lotCounts || null);
        if (data.holdings.some((h: any) => (h.confidenceScore || 100) < 70)) {
          setCasPreviewError(`Some holdings have low confidence. Please review before importing.`);
        }
      } else {
        setCasPreviewError(data.errors?.join('; ') || data.error || 'No holdings found in the PDF');
        setCasImportSummary(null);
        setCasDateWarning(null);
        setCasLotCounts(null);
      }
    },
    onError: (error: any) => {
      setCasPreviewError(error.message || "Failed to parse PDF");
    }
  });

  // CAS Import Mutation (after preview confirmation)
  const casImportMutation = useMutation({
    mutationFn: async (holdings: typeof casPreviewHoldings) => {
      // STEP 4 & 5: Include lots and dates in import payload
      const backendHoldings = holdings.map(h => ({
        name: h.name,
        assetType: h.assetType || 'mutual_fund',
        quantity: h.quantity,
        currentValue: h.currentValue,
        isin: h.isin,
        folioNumber: h.folioNumber,
        averageCost: h.averagePrice,
        productType: h.assetType,
        // Include date-wise lots - primary truth for capital gains
        firstPurchaseDate: h.firstPurchaseDate,
        lots: h.lots || [],
        holdingTier: h.holdingTier,
        eligibleForTax: h.eligibleForTax
      }));
      
      const res = await fetch(`/api/agent-wizard/prospects/${prospectId}/holdings/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ holdings: backendHoldings })
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        const frontendHoldings = (data.holdings || []).map(toFrontendHolding);
        setHoldings(frontendHoldings);
        setShowCASUploadDialog(false);
        setCasFile(null);
        setCasUploadType(null);
        setCasPreviewHoldings([]);
        setCasPreviewMode(false);
        setCasPreviewError(null);
        setCasImportSummary(null);
        
        queryClient.invalidateQueries({ 
          predicate: (query) => {
            const key = query.queryKey;
            return Array.isArray(key) && typeof key[0] === 'string' && key[0].includes('holdings');
          }
        });
        
        toast({ 
          title: "Portfolio Imported", 
          description: `${data.addedCount || casPreviewHoldings.length} holdings imported from statement.` 
        });
      } else {
        toast({ 
          title: "Import Failed", 
          description: data.message || "Could not save holdings.", 
          variant: "destructive" 
        });
      }
    },
    onError: () => {
      toast({ title: "Import Error", description: "Failed to import holdings.", variant: "destructive" });
    }
  });

  const analyzePortfolioMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/agent-wizard/analyze-portfolio", {
        method: "POST",
        body: JSON.stringify({ holdings, riskProfile })
      });
    },
    onSuccess: async (data) => {
      if (data.success) {
        setAnalysis(data.analysis);
        toast({ title: "Analysis Complete", description: "Portfolio analyzed successfully." });
        setCurrentStep(5);
        
        // Fetch exit load calendar data
        try {
          const exitLoadRes = await fetch("/api/capital-gains/exit-load-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              holdings: holdings.map(h => ({
                name: h.productName,
                isin: h.isin,
                currentValue: h.currentValue,
                purchaseDate: h.purchaseDate,
                productType: h.productType
              }))
            })
          });
          if (exitLoadRes.ok) {
            const exitData = await exitLoadRes.json();
            if (exitData.holdings && exitData.summary) {
              setExitLoadData({
                summary: exitData.summary,
                holdings: exitData.holdings
              });
            }
          }
          
          const analyticsRes = await fetch("/api/agent-wizard/proposal-analytics", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ holdings, riskProfile, analysis: data })
          });
          if (analyticsRes.ok) {
            const analyticsData = await analyticsRes.json();
            if (analyticsData.success && analyticsData.analytics) {
              setCapitalGainsData(analyticsData.analytics.capitalGains);
              setHealthScoreData(analyticsData.analytics.healthScore?.data);
              setExpenseRatioData(analyticsData.analytics.expenseRatio?.data);
              setDividendData(analyticsData.analytics.dividend?.data);
              setRiskHeatmapData(analyticsData.analytics.riskHeatmap?.data);
              setBenchmarkData(analyticsData.analytics.benchmark?.data);
              setWhatIfScenarios(analyticsData.analytics.whatIf?.data);
              setSipRecommendations(analyticsData.analytics.sipRecommendations?.data || []);
            }
          }
        } catch (e) {
          console.log("Exit load/analytics fetch skipped:", e);
        }
      } else {
        toast({ title: "Analysis Failed", description: data.error || "Could not analyze portfolio.", variant: "destructive" });
      }
    },
    onError: (error) => {
      console.error("Portfolio analysis error:", error);
      toast({ title: "Analysis Error", description: "Failed to analyze portfolio. Please try again.", variant: "destructive" });
    }
  });

  const saveGoalsMutation = useMutation({
    mutationFn: async () => {
      if (!prospectId || investmentGoals.length === 0) return { success: true, skipped: true };
      return await apiRequest(`/api/agent-wizard/prospects/${prospectId}/goals`, {
        method: "POST",
        body: JSON.stringify({ goals: investmentGoals })
      });
    },
    onSuccess: (data) => {
      if (data.success && !data.skipped) {
        toast({ 
          title: "Goals Saved", 
          description: data.matchedToUser 
            ? "Goals linked to client's account" 
            : "Goals saved for prospect" 
        });
      }
      setCurrentStep(4);
    },
    onError: () => {
      toast({ title: "Note", description: "Goals will be saved when proposal is generated", variant: "default" });
      setCurrentStep(4);
    }
  });

  const getRebalancingMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/agent-wizard/rebalancing-suggestions", {
        method: "POST",
        body: JSON.stringify({ 
          holdings, 
          riskProfile, 
          analysis,
          customAllocations,
          selectedCategories
        })
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        setRebalancing(data.suggestions || []);
        setTaxSummary(data.taxSummary || null);
        setCurrentStep(9);
      }
    }
  });

  const getFreshInvestmentsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/agent-wizard/fresh-investment-suggestions", {
        method: "POST",
        body: JSON.stringify({ 
          riskProfile, 
          investmentAmount: freshInvestmentAmount,
          existingHoldings: holdings,
          customAllocations,
          selectedCategories
        })
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        setFreshInvestments(data.suggestions);
        setCurrentStep(11);
      }
    }
  });

  const getProposalAnalyticsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/agent-wizard/proposal-analytics", {
        method: "POST",
        body: JSON.stringify({ holdings, riskProfile, analysis })
      });
    },
    onSuccess: (data) => {
      if (data.success && data.analytics) {
        setCapitalGainsData(data.analytics.capitalGains);
        setHealthScoreData(data.analytics.healthScore?.data);
        setExpenseRatioData(data.analytics.expenseRatio?.data);
        setDividendData(data.analytics.dividend?.data);
        setRiskHeatmapData(data.analytics.riskHeatmap?.data);
        setBenchmarkData(data.analytics.benchmark?.data);
        setWhatIfScenarios(data.analytics.whatIf?.data);
        setSipRecommendations(data.analytics.sipRecommendations?.data || []);
      }
    }
  });

  const syncProposalToZohoMutation = useMutation({
    mutationFn: async (proposalData: { proposalId: string; proposalType: string; products: string[]; amount: number }) => {
      if (!zohoLeadId || zohoSource !== 'zoho') return { skipped: true, synced: false };
      try {
        const result = await apiRequest(`/api/agent/zoho/leads/${zohoLeadId}/proposal`, {
          method: "POST",
          body: JSON.stringify(proposalData)
        });
        return result;
      } catch (error: any) {
        return { 
          success: false, 
          synced: false, 
          message: error?.message || "Failed to sync to Zoho CRM" 
        };
      }
    }
  });

  // Zoho CRM Two-Way Sync
  const { data: zohoStatus } = useQuery<{ success: boolean; isConnected: boolean; isAvailable: boolean; isMaster: boolean }>({
    queryKey: ['/api/agent-wizard/zoho/status'],
    staleTime: 60000
  });

  // Prospect Readiness Status Query
  interface ReadinessCheck {
    isReady: boolean;
    currentStatus: 'INITIAL' | 'HOLDINGS_IMPORTED' | 'RISK_PROFILE_COMPLETED' | 'TAX_PROFILE_COMPLETED' | 'READY_FOR_PROPOSAL';
    missingSteps: string[];
    completedSteps: string[];
  }

  const { data: readinessData, refetch: refetchReadiness } = useQuery<{ success: boolean; readiness: ReadinessCheck }>({
    queryKey: ['/api/agent-wizard/prospects', prospectId, 'readiness'],
    enabled: !!prospectId && currentStep >= 2,
    staleTime: 10000
  });

  const [showZohoImportDialog, setShowZohoImportDialog] = useState(false);
  const [selectedAgentForImport, setSelectedAgentForImport] = useState<string>("");

  // Fetch team agents for master to assign during import
  const { data: teamAgentsData } = useQuery<{ success: boolean; agents: Array<{ id: string; name: string; email: string; isMaster: boolean }> }>({
    queryKey: ['/api/agent-wizard/zoho/team-agents'],
    enabled: !!zohoStatus?.isMaster,
    staleTime: 60000
  });

  const importZohoLeadsMutation = useMutation({
    mutationFn: async ({ limit = 50, skipExisting = true, assignToAgentId }: { limit?: number; skipExisting?: boolean; assignToAgentId?: string }) => {
      return await apiRequest("/api/agent-wizard/zoho/import/leads", {
        method: "POST",
        body: JSON.stringify({ limit, skipExisting, assignToAgentId: assignToAgentId || undefined })
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ 
          title: "Leads Imported", 
          description: `Imported ${data.imported} leads, skipped ${data.skipped} duplicates` 
        });
        queryClient.invalidateQueries({ queryKey: ['/api/agent-wizard/prospects'] });
        setShowZohoImportDialog(false);
      }
    },
    onError: (error: any) => {
      toast({ title: "Import Failed", description: error.message, variant: "destructive" });
    }
  });

  const importZohoContactsMutation = useMutation({
    mutationFn: async ({ limit = 50, skipExisting = true, assignToAgentId }: { limit?: number; skipExisting?: boolean; assignToAgentId?: string }) => {
      return await apiRequest("/api/agent-wizard/zoho/import/contacts", {
        method: "POST",
        body: JSON.stringify({ limit, skipExisting, assignToAgentId: assignToAgentId || undefined })
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ 
          title: "Contacts Imported", 
          description: `Imported ${data.imported} contacts, skipped ${data.skipped} duplicates` 
        });
        queryClient.invalidateQueries({ queryKey: ['/api/agent-wizard/prospects'] });
        setShowZohoImportDialog(false);
      }
    },
    onError: (error: any) => {
      toast({ title: "Import Failed", description: error.message, variant: "destructive" });
    }
  });

  const generateProposalMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/agent-wizard/generate-proposal", {
        method: "POST",
        body: JSON.stringify({
          prospectId,
          prospectData,
          holdings,
          riskProfile,
          freshInvestmentAmount,
          customAllocations,
          selectedCategories,
          globalAdvisorySelections: hasGlobalAdvisorySelections ? globalAdvisorySelections : undefined,
          globalAdvisoryBudget: hasGlobalAdvisorySelections ? effectiveGlobalBudget : undefined,
          proposalSections,
          analyticsData: {
            capitalGains: capitalGainsData,
            healthScore: healthScoreData,
            expenseRatio: expenseRatioData,
            dividend: dividendData,
            riskHeatmap: riskHeatmapData,
            benchmark: benchmarkData,
            whatIf: whatIfScenarios,
            sipRecommendations,
            exitLoad: exitLoadData
          }
        })
      });
    },
    onSuccess: async (data) => {
      if (data.success) {
        setProposal(data.proposal);
        toast({ title: "Proposal Generated", description: "Investment proposal ready to share!" });
        setCurrentStep(16);
        
        if (zohoLeadId && zohoSource === 'zoho') {
          const products = selectedCategories.filter(c => customAllocations[c as keyof typeof customAllocations] > 0);
          const syncResult = await syncProposalToZohoMutation.mutateAsync({
            proposalId: data.proposal.proposalId,
            proposalType: 'Multi-Product Investment',
            products,
            amount: freshInvestmentAmount
          });
          
          if (syncResult?.skipped) {
            // No sync attempted - silent
          } else if (syncResult?.success && syncResult?.synced) {
            toast({ title: "Synced to Zoho", description: "Proposal logged to Zoho CRM lead" });
          } else {
            toast({ 
              title: "Zoho Sync Failed", 
              description: syncResult?.message || "Could not sync proposal to Zoho CRM",
              variant: "destructive"
            });
          }
        }
      }
    }
  });

  const shareProposalMutation = useMutation({
    mutationFn: async (channel: 'email' | 'whatsapp' | 'sms') => {
      if (!proposal) return;
      return await apiRequest(`/api/agent-wizard/proposals/${proposal.proposalId}/share`, {
        method: "POST",
        body: JSON.stringify({ channel })
      });
    },
    onSuccess: (data, channel) => {
      if (data.success) {
        toast({ 
          title: "Proposal Shared", 
          description: `Proposal link sent via ${channel}. Share URL copied to clipboard.` 
        });
        navigator.clipboard.writeText(data.shareUrl);
        setShowShareDialog(false);
      }
    }
  });

  // Portfolio CRUD Mutations
  const addHoldingMutation = useMutation({
    mutationFn: async (holding: PortfolioHolding) => {
      if (!prospectId) throw new Error("No prospect selected");
      const backendHolding = toBackendHolding(holding);
      console.log('[Holdings] Adding holding:', holding, '-> backend format:', backendHolding);
      const result = await apiRequest(`/api/agent-wizard/prospects/${prospectId}/holdings`, {
        method: "POST",
        body: JSON.stringify(backendHolding)
      });
      console.log('[Holdings] Add result:', result);
      return result;
    },
    onSuccess: (data) => {
      console.log('[Holdings] Add success:', data);
      if (data.success) {
        // Transform backend holdings to frontend format
        const frontendHoldings = (data.holdings || []).map(toFrontendHolding);
        setHoldings(frontendHoldings);
        toast({ title: "Holding Added", description: "Investment saved to portfolio" });
      } else {
        toast({ title: "Save Failed", description: data.message || "Could not save holding", variant: "destructive" });
      }
    },
    onError: (error: any) => {
      console.error('[Holdings] Add error:', error);
      toast({ title: "Error Saving", description: error.message || "Failed to save holding", variant: "destructive" });
    }
  });

  const updateHoldingMutation = useMutation({
    mutationFn: async ({ index, holding }: { index: number; holding: PortfolioHolding }) => {
      if (!prospectId) throw new Error("No prospect selected");
      const backendHolding = toBackendHolding(holding);
      console.log('[Holdings] Updating holding at index:', index, holding, '-> backend format:', backendHolding);
      const result = await apiRequest(`/api/agent-wizard/prospects/${prospectId}/holdings/${index}`, {
        method: "PUT",
        body: JSON.stringify(backendHolding)
      });
      console.log('[Holdings] Update result:', result);
      return result;
    },
    onSuccess: (data) => {
      console.log('[Holdings] Update success:', data);
      if (data.success) {
        // Transform backend holdings to frontend format
        const frontendHoldings = (data.holdings || []).map(toFrontendHolding);
        setHoldings(frontendHoldings);
        setEditingHoldingIndex(null);
        toast({ title: "Holding Updated", description: "Investment updated successfully" });
      } else {
        // Reload from server on failure
        reloadHoldingsFromServer();
        toast({ title: "Update Failed", description: data.message || "Could not update holding", variant: "destructive" });
      }
    },
    onError: (error: any) => {
      console.error('[Holdings] Update error:', error);
      // Reload from server on error to stay in sync
      reloadHoldingsFromServer();
      toast({ title: "Error Updating", description: error.message || "Failed to update holding", variant: "destructive" });
    }
  });

  const deleteHoldingMutation = useMutation({
    mutationFn: async (index: number) => {
      if (!prospectId) throw new Error("No prospect selected");
      console.log('[Holdings] Deleting holding at index:', index);
      const result = await apiRequest(`/api/agent-wizard/prospects/${prospectId}/holdings/${index}`, {
        method: "DELETE"
      });
      console.log('[Holdings] Delete result:', result);
      return result;
    },
    onSuccess: (data) => {
      console.log('[Holdings] Delete success:', data);
      if (data.success) {
        // Transform backend holdings to frontend format
        const frontendHoldings = (data.holdings || []).map(toFrontendHolding);
        setHoldings(frontendHoldings);
        toast({ title: "Holding Removed", description: "Investment removed from portfolio" });
      } else {
        // Reload from server on failure
        reloadHoldingsFromServer();
        toast({ title: "Delete Failed", description: data.message || "Could not delete holding", variant: "destructive" });
      }
    },
    onError: (error: any) => {
      console.error('[Holdings] Delete error:', error);
      // Reload from server on error to stay in sync
      reloadHoldingsFromServer();
      toast({ title: "Error Deleting", description: error.message || "Failed to delete holding", variant: "destructive" });
    }
  });

  const resetPortfolioMutation = useMutation({
    mutationFn: async () => {
      if (!prospectId) throw new Error("No prospect selected");
      return await apiRequest(`/api/agent-wizard/prospects/${prospectId}/holdings`, {
        method: "DELETE"
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        setHoldings([]);
        setShowResetDialog(false);
        toast({ title: "Portfolio Reset", description: "All holdings cleared. You can now upload a fresh portfolio." });
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const addHolding = () => {
    // Handle SIP Mode - add multiple lots as separate holdings
    if (sipMode) {
      addSIPHoldings();
      return;
    }
    
    if (!newHolding.productName || !newHolding.currentValue) {
      toast({ title: "Missing Fields", description: "Enter product name and value.", variant: "destructive" });
      return;
    }
    
    const holdingToAdd = newHolding as PortfolioHolding;
    
    if (prospectId) {
      addHoldingMutation.mutate(holdingToAdd);
    } else {
      setHoldings([...holdings, holdingToAdd]);
    }
    setNewHolding({ productType: "mutual_fund", productName: "", quantity: 1, currentValue: 0 });
    setProductSearchQuery("");
    setSelectedInstrumentPrice(null);
    setProductSearchResults([]);
  };
  
  // SIP Mode - Add multiple purchase lots for the same fund
  const addSIPHoldings = async () => {
    if (!newHolding.productName) {
      toast({ title: "Missing Fund", description: "Select a fund first.", variant: "destructive" });
      return;
    }
    
    // Require ISIN for proper tax lot tracking
    if (!newHolding.isin) {
      toast({ 
        title: "Select from Search", 
        description: "Please select a fund from the search dropdown to ensure accurate tax calculations.", 
        variant: "destructive" 
      });
      return;
    }
    
    const validLots = sipLots.filter(lot => lot.purchaseDate && lot.units > 0);
    if (validLots.length === 0) {
      toast({ title: "No Valid Lots", description: "Add at least one lot with date and units.", variant: "destructive" });
      return;
    }
    
    const currentNav = selectedInstrumentPrice || 0;
    
    // Create a frontend holding for each SIP lot, then transform via toBackendHolding
    const holdingsToAdd: PortfolioHolding[] = validLots.map((lot) => ({
      id: crypto.randomUUID(),
      productType: newHolding.productType || 'mutual_fund',
      productName: newHolding.productName || '',
      quantity: lot.units,
      currentValue: lot.units * currentNav,
      purchasePrice: lot.investedAmount ? lot.investedAmount / lot.units : currentNav,
      purchaseDate: lot.purchaseDate,
      isin: newHolding.isin,
      category: newHolding.category
    }));
    
    if (prospectId) {
      // Add each lot as a separate holding to backend using proper transformation
      try {
        for (const holding of holdingsToAdd) {
          // Transform to backend format for consistency with normal flow
          const backendHolding = toBackendHolding(holding);
          await addHoldingMutation.mutateAsync(holding);
        }
        // Invalidate holdings query after all lots added
        queryClient.invalidateQueries({ queryKey: ['/api/agent-wizard/prospects', prospectId, 'holdings'] });
        toast({ 
          title: "SIP Lots Added", 
          description: `Added ${validLots.length} purchase lot(s) for ${newHolding.productName}` 
        });
      } catch (error) {
        toast({ title: "Error", description: "Failed to add some SIP lots", variant: "destructive" });
      }
    } else {
      setHoldings([...holdings, ...holdingsToAdd]);
      toast({ 
        title: "SIP Lots Added", 
        description: `Added ${validLots.length} purchase lot(s) for ${newHolding.productName}` 
      });
    }
    
    // Reset form completely
    setNewHolding({ productType: "mutual_fund", productName: "", quantity: 1, currentValue: 0 });
    setProductSearchQuery("");
    setSelectedInstrumentPrice(null);
    setProductSearchResults([]);
    setSipLots([{ purchaseDate: '', units: 0 }]);
  };
  
  // SIP Lot management
  const addSipLot = () => {
    setSipLots([...sipLots, { purchaseDate: '', units: 0 }]);
  };
  
  const removeSipLot = (index: number) => {
    if (sipLots.length > 1) {
      setSipLots(sipLots.filter((_, i) => i !== index));
    }
  };
  
  const updateSipLot = (index: number, field: 'purchaseDate' | 'units' | 'investedAmount', value: string | number) => {
    const updated = [...sipLots];
    updated[index] = { ...updated[index], [field]: value };
    setSipLots(updated);
  };

  const removeHolding = (index: number) => {
    if (prospectId) {
      deleteHoldingMutation.mutate(index);
    } else {
      setHoldings(holdings.filter((_, i) => i !== index));
    }
  };

  const startEditHolding = (index: number) => {
    const holdingToEdit = holdings[index];
    setEditingHoldingIndex(index);
    setNewHolding({
      productType: holdingToEdit.productType,
      productName: holdingToEdit.productName,
      quantity: holdingToEdit.quantity ?? 1,
      currentValue: holdingToEdit.currentValue ?? 0,
      isin: holdingToEdit.isin
    });
    setProductSearchQuery(holdingToEdit.productName);
    setSelectedInstrumentPrice(null);
    setImportMode('manual');
  };

  const saveEditHolding = () => {
    if (editingHoldingIndex === null) return;
    if (!newHolding.productName || !newHolding.currentValue) {
      toast({ title: "Missing Fields", description: "Enter product name and value.", variant: "destructive" });
      return;
    }
    
    const updatedHolding = newHolding as PortfolioHolding;
    
    if (prospectId) {
      updateHoldingMutation.mutate({ index: editingHoldingIndex, holding: updatedHolding });
    } else {
      const updatedHoldings = [...holdings];
      updatedHoldings[editingHoldingIndex] = updatedHolding;
      setHoldings(updatedHoldings);
      setEditingHoldingIndex(null);
    }
    setNewHolding({ productType: "mutual_fund", productName: "", quantity: 1, currentValue: 0 });
    setProductSearchQuery("");
    setSelectedInstrumentPrice(null);
    setProductSearchResults([]);
  };

  const cancelEditHolding = () => {
    setEditingHoldingIndex(null);
    setNewHolding({ productType: "mutual_fund", productName: "", quantity: 1, currentValue: 0 });
    setProductSearchQuery("");
    setSelectedInstrumentPrice(null);
    setProductSearchResults([]);
  };

  const steps = [
    { num: 1, title: "Prospect", icon: User },
    { num: 2, title: "Risk", icon: Target },
    { num: 3, title: "Goals", icon: Lightbulb },
    { num: 4, title: "Portfolio", icon: PieChart },
    { num: 5, title: "Analysis", icon: Sparkles },
    { num: 6, title: "Sections", icon: FileCheck },
    { num: 7, title: "Categories", icon: LayoutGrid },
    { num: 8, title: "Allocation", icon: Settings2 },
    { num: 9, title: "What-If", icon: TrendingDown },
    { num: 10, title: "Tax", icon: Calculator },
    { num: 11, title: "Rebalance", icon: Scale },
    { num: 12, title: "Fresh", icon: TrendingUp },
    { num: 13, title: "SIP", icon: ArrowUpCircle },
    { num: 14, title: "Review", icon: FileText },
    { num: 15, title: "Share", icon: Share2 }
  ];

  return (
    <div className="container max-w-5xl mx-auto py-6 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <Sparkles className="h-7 w-7 text-primary" />
          Prospect Onboarding Wizard
        </h1>
        <p className="text-muted-foreground mt-1">
          Complete workflow: Add prospect → Analyze portfolio → Generate AI recommendations → Share proposal
        </p>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {steps.map((step, idx) => (
            <div key={step.num} className="flex items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                currentStep >= step.num 
                  ? 'bg-primary border-primary text-primary-foreground' 
                  : 'border-muted-foreground/30 text-muted-foreground'
              }`}>
                {currentStep > step.num ? <Check className="h-5 w-5" /> : <step.icon className="h-5 w-5" />}
              </div>
              {idx < steps.length - 1 && (
                <div className={`w-8 md:w-16 h-0.5 mx-1 ${currentStep > step.num ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          {steps.map(step => (
            <span key={step.num} className="w-12 md:w-20 text-center">{step.title}</span>
          ))}
        </div>
      </div>

      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> Select or Add Prospect</CardTitle>
            <CardDescription>Choose an existing prospect or create a new one</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={prospectMode} onValueChange={(v) => setProspectMode(v as 'new' | 'existing')} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="existing" className="flex items-center gap-2" data-testid="tab-existing-prospect">
                  <Users className="h-4 w-4" /> Existing Prospect
                </TabsTrigger>
                <TabsTrigger value="new" className="flex items-center gap-2" data-testid="tab-new-prospect">
                  <Plus className="h-4 w-4" /> New Prospect
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="existing" className="mt-4 space-y-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search by name, email, or PAN..."
                      value={prospectSearch}
                      onChange={(e) => setProspectSearch(e.target.value)}
                      className="pl-10"
                      data-testid="prospect-search-input"
                    />
                  </div>
                  {zohoStatus?.isConnected && zohoStatus?.isMaster && (
                    <Button 
                      variant="outline" 
                      size="default"
                      onClick={() => setShowZohoImportDialog(true)}
                      className="flex items-center gap-2"
                      data-testid="zoho-import-btn"
                    >
                      <Download className="h-4 w-4" />
                      <span className="hidden sm:inline">Import from Zoho</span>
                    </Button>
                  )}
                </div>
                
                {loadingProspects ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredProspects.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>No prospects found. Add a new prospect to get started.</p>
                  </div>
                ) : (
                  <ScrollArea className="h-64 rounded-md border">
                    <div className="p-2 space-y-2">
                      {filteredProspects.map(prospect => (
                        <div
                          key={prospect.id}
                          onClick={() => selectExistingProspect(prospect, false)}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted ${
                            prospectId === prospect.id ? 'border-primary bg-primary/5' : ''
                          }`}
                          data-testid={`prospect-item-${prospect.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{prospect.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {prospect.email || prospect.mobile || 'No contact info'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {prospect.pan && (
                                <Badge variant="outline" className="text-xs">{prospect.pan}</Badge>
                              )}
                              {prospectId === prospect.id && (
                                <CheckCircle className="h-5 w-5 text-primary" />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
                
                {prospectId && prospectMode === 'existing' && (
                  <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <p className="text-sm font-medium text-primary">Selected: {prospectData.name}</p>
                    <p className="text-xs text-muted-foreground">{prospectData.email || prospectData.mobile}</p>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="new" className="mt-4 space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Full Name *</Label>
                    <Input 
                      placeholder="Rajesh Kumar"
                      value={prospectData.name}
                      onChange={(e) => setProspectData({ ...prospectData, name: e.target.value })}
                      data-testid="prospect-name-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>PAN <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                    <Input 
                      placeholder="ABCDE1234F"
                      value={prospectData.pan}
                      onChange={(e) => setProspectData({ ...prospectData, pan: e.target.value.toUpperCase() })}
                      maxLength={10}
                      data-testid="prospect-pan-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input 
                      type="email"
                      placeholder="client@email.com"
                      value={prospectData.email}
                      onChange={(e) => setProspectData({ ...prospectData, email: e.target.value })}
                      data-testid="prospect-email-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Mobile</Label>
                    <Input 
                      placeholder="+91 9876543210"
                      value={prospectData.mobile}
                      onChange={(e) => setProspectData({ ...prospectData, mobile: e.target.value })}
                      data-testid="prospect-mobile-input"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea 
                    placeholder="Any additional notes about the client..."
                    value={prospectData.notes}
                    onChange={(e) => setProspectData({ ...prospectData, notes: e.target.value })}
                    data-testid="prospect-notes-input"
                  />
                </div>

                {duplicateInfo && (
                  <div className={`mt-4 p-4 rounded-lg border ${
                    duplicateInfo.duplicateType === 'existing_client' 
                      ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800' 
                      : 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800'
                  }`}>
                    <div className="flex items-start gap-3">
                      <AlertTriangle className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
                        duplicateInfo.duplicateType === 'existing_client' ? 'text-amber-600' : 'text-red-600'
                      }`} />
                      <div className="flex-1">
                        <h4 className={`font-medium ${
                          duplicateInfo.duplicateType === 'existing_client' ? 'text-amber-800 dark:text-amber-200' : 'text-red-800 dark:text-red-200'
                        }`}>
                          {duplicateInfo.duplicateType === 'existing_client' ? 'Client Already Exists' : 'Duplicate Prospect'}
                        </h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {duplicateInfo.message}
                        </p>
                        {duplicateInfo.existingRecord && (
                          <div className="mt-2 text-sm space-y-1">
                            {duplicateInfo.existingRecord.name && (
                              <p><span className="font-medium">Name:</span> {duplicateInfo.existingRecord.name}</p>
                            )}
                            {duplicateInfo.existingRecord.email && (
                              <p><span className="font-medium">Email:</span> {duplicateInfo.existingRecord.email}</p>
                            )}
                            {duplicateInfo.existingRecord.pan && (
                              <p><span className="font-medium">PAN:</span> {duplicateInfo.existingRecord.pan}</p>
                            )}
                            {duplicateInfo.existingRecord.currentAgentName && (
                              <p><span className="font-medium">Current Agent:</span> {duplicateInfo.existingRecord.currentAgentName}</p>
                            )}
                          </div>
                        )}
                        <div className="mt-3 flex gap-2">
                          {duplicateInfo.canRequestMapping && (
                            <Button
                              size="sm"
                              onClick={() => requestMappingMutation.mutate({
                                clientId: duplicateInfo.existingRecord?.id,
                                pan: duplicateInfo.existingRecord?.pan,
                                email: duplicateInfo.existingRecord?.email,
                                mobile: duplicateInfo.existingRecord?.mobile,
                                name: duplicateInfo.existingRecord?.name,
                                currentAgentId: duplicateInfo.existingRecord?.currentAgentId,
                                currentAgentName: duplicateInfo.existingRecord?.currentAgentName,
                                reason: 'Agent requested client mapping from prospect wizard'
                              })}
                              disabled={requestMappingMutation.isPending}
                              data-testid="request-mapping-btn"
                            >
                              {requestMappingMutation.isPending ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : null}
                              Request Mapping Approval
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDuplicateInfo(null)}
                            data-testid="dismiss-duplicate-btn"
                          >
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="justify-end">
            {prospectMode === 'existing' ? (
              <Button 
                onClick={() => setCurrentStep(2)}
                disabled={!prospectId}
                data-testid="continue-existing-btn"
              >
                Continue to Risk Profile
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button 
                onClick={() => createProspectMutation.mutate(prospectData)}
                disabled={!prospectData.name || createProspectMutation.isPending || duplicateInfo?.isDuplicate}
                data-testid="create-prospect-btn"
              >
                {createProspectMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Continue to Risk Profile
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </CardFooter>
        </Card>
      )}

      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" /> Risk Profile</CardTitle>
            <CardDescription>Understand {prospectData.name}'s investment preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label className="text-base font-medium">Risk Tolerance</Label>
              <RadioGroup 
                value={riskProfile.riskTolerance}
                onValueChange={(v: any) => setRiskProfile({ ...riskProfile, riskTolerance: v })}
                className="grid grid-cols-2 md:grid-cols-4 gap-3"
              >
                {['conservative', 'moderate', 'aggressive', 'very_aggressive'].map(risk => (
                  <Label key={risk} htmlFor={risk} className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors hover:bg-muted ${riskProfile.riskTolerance === risk ? 'border-primary bg-primary/5' : ''}`}>
                    <RadioGroupItem value={risk} id={risk} />
                    <span className="capitalize">{risk.replace('_', ' ')}</span>
                  </Label>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label className="text-base font-medium">Investment Horizon</Label>
              <RadioGroup 
                value={riskProfile.investmentHorizon}
                onValueChange={(v: any) => setRiskProfile({ ...riskProfile, investmentHorizon: v })}
                className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2"
              >
                {[
                  { value: '3_months', label: '3M', desc: '0-3 months' },
                  { value: '6_months', label: '6M', desc: '3-6 months' },
                  { value: '9_months', label: '9M', desc: '6-9 months' },
                  { value: '1_year', label: '1Y', desc: '9-12 months' },
                  { value: 'short_term', label: 'Short', desc: '1-3 years' },
                  { value: 'medium_term', label: 'Medium', desc: '3-7 years' },
                  { value: 'long_term', label: 'Long', desc: '7+ years' }
                ].map(horizon => (
                  <Label 
                    key={horizon.value} 
                    htmlFor={`horizon_${horizon.value}`} 
                    className={`flex items-center gap-2 p-2.5 border rounded-lg cursor-pointer transition-colors hover:bg-muted ${riskProfile.investmentHorizon === horizon.value ? 'border-primary bg-primary/5' : ''}`}
                    data-testid={`horizon-${horizon.value.replace('_', '-')}`}
                  >
                    <RadioGroupItem value={horizon.value} id={`horizon_${horizon.value}`} />
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{horizon.label}</span>
                      <span className="text-xs text-muted-foreground">{horizon.desc}</span>
                    </div>
                  </Label>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>Primary Investment Goal</Label>
              <Select value={riskProfile.primaryGoal} onValueChange={(v) => setRiskProfile({ ...riskProfile, primaryGoal: v })}>
                <SelectTrigger data-testid="goal-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GOAL_OPTIONS.map(goal => (
                    <SelectItem key={goal.value} value={goal.value}>{goal.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setCurrentStep(1)} data-testid="back-to-prospect-btn">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button onClick={() => setCurrentStep(3)} data-testid="continue-to-goals-btn">
              Continue to Goals <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 3: Goal Mapping */}
      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Lightbulb className="h-5 w-5 text-amber-500" /> Investment Goals</CardTitle>
            <CardDescription>Define financial goals to create a personalized investment strategy for {prospectData.name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {investmentGoals.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed rounded-lg">
                <Lightbulb className="h-12 w-12 mx-auto mb-3 text-amber-500/50" />
                <p className="text-muted-foreground mb-4">No goals added yet. Add financial goals to personalize recommendations.</p>
                <Button onClick={() => setInvestmentGoals([{
                  id: crypto.randomUUID(),
                  goalType: 'wealth_creation',
                  goalName: 'Wealth Building',
                  targetAmount: 1000000,
                  timelineYears: 10,
                  priority: 'high',
                  currentProgress: 0,
                  monthlyContribution: 10000
                }])}>
                  <Plus className="h-4 w-4 mr-2" /> Add First Goal
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {investmentGoals.map((goal, idx) => (
                  <Card key={goal.id} className="border-l-4 border-l-amber-500">
                    <CardContent className="pt-4">
                      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">Goal Type</Label>
                          <Select 
                            value={goal.goalType} 
                            onValueChange={(v) => {
                              const updated = [...investmentGoals];
                              updated[idx].goalType = v;
                              updated[idx].goalName = GOAL_TYPES.find(g => g.value === v)?.label || v;
                              setInvestmentGoals(updated);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {GOAL_TYPES.map(g => (
                                <SelectItem key={g.value} value={g.value}>
                                  {g.icon} {g.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Target Amount</Label>
                          <div className="relative">
                            <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="number"
                              className="pl-9"
                              value={goal.targetAmount}
                              onChange={(e) => {
                                const updated = [...investmentGoals];
                                updated[idx].targetAmount = parseFloat(e.target.value) || 0;
                                setInvestmentGoals(updated);
                              }}
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Timeline (Years)</Label>
                          <Input
                            type="number"
                            min={1}
                            max={40}
                            value={goal.timelineYears}
                            onChange={(e) => {
                              const updated = [...investmentGoals];
                              updated[idx].timelineYears = parseInt(e.target.value) || 1;
                              setInvestmentGoals(updated);
                            }}
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Priority</Label>
                          <Select 
                            value={goal.priority} 
                            onValueChange={(v: 'high' | 'medium' | 'low') => {
                              const updated = [...investmentGoals];
                              updated[idx].priority = v;
                              setInvestmentGoals(updated);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="high">🔴 High</SelectItem>
                              <SelectItem value="medium">🟡 Medium</SelectItem>
                              <SelectItem value="low">🟢 Low</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid md:grid-cols-2 gap-4 mt-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">Monthly SIP Contribution</Label>
                          <div className="relative">
                            <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="number"
                              className="pl-9"
                              value={goal.monthlyContribution}
                              onChange={(e) => {
                                const updated = [...investmentGoals];
                                updated[idx].monthlyContribution = parseFloat(e.target.value) || 0;
                                setInvestmentGoals(updated);
                              }}
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Current Progress</Label>
                          <div className="relative">
                            <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="number"
                              className="pl-9"
                              value={goal.currentProgress}
                              onChange={(e) => {
                                const updated = [...investmentGoals];
                                updated[idx].currentProgress = parseFloat(e.target.value) || 0;
                                setInvestmentGoals(updated);
                              }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-4 pt-4 border-t">
                        <div className="text-sm">
                          <span className="text-muted-foreground">Gap to goal: </span>
                          <span className="font-semibold text-amber-600">
                            ₹{((goal.targetAmount - goal.currentProgress) / 100000).toFixed(1)}L
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600"
                          onClick={() => setInvestmentGoals(investmentGoals.filter((_, i) => i !== idx))}
                        >
                          <Trash2 className="h-4 w-4 mr-1" /> Remove
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <Button
                  variant="outline"
                  onClick={() => setInvestmentGoals([...investmentGoals, {
                    id: crypto.randomUUID(),
                    goalType: 'wealth_creation',
                    goalName: 'Wealth Building',
                    targetAmount: 500000,
                    timelineYears: 5,
                    priority: 'medium',
                    currentProgress: 0,
                    monthlyContribution: 5000
                  }])}
                >
                  <Plus className="h-4 w-4 mr-2" /> Add Another Goal
                </Button>
              </div>
            )}
            
            {investmentGoals.length > 0 && (
              <div className="p-4 bg-muted/30 rounded-lg">
                <h4 className="font-medium mb-2">Goals Summary</h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-amber-600">{investmentGoals.length}</p>
                    <p className="text-xs text-muted-foreground">Total Goals</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-600">
                      ₹{(investmentGoals.reduce((sum, g) => sum + g.targetAmount, 0) / 100000).toFixed(1)}L
                    </p>
                    <p className="text-xs text-muted-foreground">Total Target</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">
                      ₹{(investmentGoals.reduce((sum, g) => sum + g.monthlyContribution, 0)).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">Monthly SIP</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setCurrentStep(2)} data-testid="back-to-risk-btn">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button 
              onClick={() => saveGoalsMutation.mutate()} 
              disabled={saveGoalsMutation.isPending}
              data-testid="continue-to-portfolio-btn"
            >
              {saveGoalsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Continue to Portfolio <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 4: Current Portfolio */}
      {currentStep === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><PieChart className="h-5 w-5" /> Current Portfolio</CardTitle>
            <CardDescription>Import or manually enter existing investments for analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Import Mode Selection - Simplified to 2 buttons */}
            <div className="flex gap-2 flex-wrap">
              <Button 
                variant="default"
                size="sm"
                onClick={() => setShowSmartImportDialog(true)}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                data-testid="smart-import-btn"
              >
                <Wand2 className="h-4 w-4 mr-1" /> Smart Import
              </Button>
              <Button 
                variant={importMode === 'manual' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setImportMode('manual')}
                data-testid="mode-manual-btn"
              >
                <Plus className="h-4 w-4 mr-1" /> Manual Entry
              </Button>
              {/* CAS Upload Dialog - kept but triggered from Smart Import */}
              <Dialog open={showCASUploadDialog} onOpenChange={(open) => {
                setShowCASUploadDialog(open);
                if (!open) {
                  setCasFile(null);
                  setCasUploadType(null);
                  setCasPreviewHoldings([]);
                  setCasPreviewMode(false);
                  setCasPreviewError(null);
                  // STEP 5/6 (FIX SPEC): Clear date warning and lot counts
                  setCasDateWarning(null);
                  setCasLotCounts(null);
                  setShowDateWarningConfirm(false);
                }
              }}>
                <DialogContent className={casPreviewMode ? "max-w-4xl max-h-[85vh] overflow-hidden flex flex-col" : "max-w-lg"}>
                  <DialogHeader>
                    <DialogTitle>
                      {casPreviewMode ? 'Review Holdings Before Import' : 'Import Account Statement'}
                    </DialogTitle>
                    <DialogDescription>
                      {casPreviewMode 
                        ? `${casPreviewHoldings.length} holdings found. Review and edit as needed before importing.`
                        : 'Upload your CAMS/KFintech CAS PDF or NSDL/CDSL Demat statement to automatically import portfolio'
                      }
                    </DialogDescription>
                  </DialogHeader>

                  <div className="flex-1 overflow-auto">
                    {casPreviewMode ? (
                      <div className="space-y-4">
                        {casPreviewError && (
                          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-sm flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            {casPreviewError}
                          </div>
                        )}
                        
                        <div className="rounded-lg border overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead className="w-8"></TableHead>
                                <TableHead>Fund Name</TableHead>
                                <TableHead className="text-center w-28">First Purchase</TableHead>
                                <TableHead className="text-center">Lots</TableHead>
                                <TableHead className="text-center">Tax Status</TableHead>
                                <TableHead className="text-right">Units</TableHead>
                                <TableHead className="text-right">Value</TableHead>
                                <TableHead className="text-right">Gain/Loss</TableHead>
                                <TableHead className="text-center">Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {casPreviewHoldings.map((holding, idx) => {
                                // LOT-AWARE UI (Per Fix Spec Section 3)
                                const holdingId = holding.id || `${idx}`;
                                const isExpanded = expandedHoldingIds.has(holdingId);
                                const lotsCount = holding.lots?.length || 0;
                                
                                // Helper to get normalized date from lot (handles all date formats)
                                const getLotDateStr = (lot: any): string | null => {
                                  if (lot.transactionDateStr) return lot.transactionDateStr.split('T')[0];
                                  if (lot.transactionDate) {
                                    const d = typeof lot.transactionDate === 'string' ? lot.transactionDate : new Date(lot.transactionDate).toISOString();
                                    return d.split('T')[0];
                                  }
                                  if (lot.purchaseDate) return lot.purchaseDate.split('T')[0];
                                  return null;
                                };
                                
                                const earliestDate = holding.firstPurchaseDate?.split('T')[0] || 
                                  (holding.lots && holding.lots.length > 0 
                                    ? holding.lots.reduce((earliest: string | null, lot: any) => {
                                        const lotDate = getLotDateStr(lot);
                                        if (!lotDate) return earliest;
                                        if (!earliest) return lotDate;
                                        return lotDate < earliest ? lotDate : earliest;
                                      }, null)
                                    : null);
                                
                                // Calculate tax status (Section 4)
                                const taxSummary = getHoldingTaxSummary(holding.lots);
                                const exitLoadSummary = getHoldingExitLoadSummary(holding.lots);
                                
                                const toggleExpanded = () => {
                                  const newSet = new Set(expandedHoldingIds);
                                  if (isExpanded) {
                                    newSet.delete(holdingId);
                                  } else {
                                    newSet.add(holdingId);
                                  }
                                  setExpandedHoldingIds(newSet);
                                };
                                
                                return (
                                <>
                                <TableRow key={idx} className={lotsCount > 0 ? 'cursor-pointer hover:bg-muted/30' : ''} onClick={lotsCount > 0 ? toggleExpanded : undefined}>
                                  <TableCell className="w-8 text-center">
                                    {lotsCount > 0 && (
                                      <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                    )}
                                  </TableCell>
                                  <TableCell className="max-w-[180px]">
                                    <div className="truncate font-medium text-sm">{holding.name}</div>
                                    {holding.folioNumber && (
                                      <div className="text-xs text-muted-foreground">Folio: {holding.folioNumber}</div>
                                    )}
                                    {holding.holdingTier === 'VALUATION_ONLY' && (
                                      <div className="text-xs text-amber-600">Valuation only - tax disabled</div>
                                    )}
                                    {exitLoadSummary.hasExitLoadRisk && (
                                      <div className="text-xs text-orange-500">Exit load applies on some units</div>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {earliestDate ? (
                                      <div className="text-xs font-medium text-blue-700 dark:text-blue-400">
                                        {new Date(earliestDate).toLocaleDateString('en-IN', {
                                          day: '2-digit', month: 'short', year: 'numeric'
                                        })}
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground text-xs">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {lotsCount > 0 ? (
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-6 text-xs text-blue-600 hover:text-blue-800 p-1"
                                        onClick={(e) => { e.stopPropagation(); toggleExpanded(); }}
                                      >
                                        {lotsCount} {lotsCount === 1 ? 'lot' : 'lots'}
                                        <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                      </Button>
                                    ) : (
                                      <span className="text-muted-foreground text-xs">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {taxSummary.hasLots ? (
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                        taxSummary.taxStatus === 'All LTCG' ? 'bg-green-100 text-green-800' :
                                        taxSummary.taxStatus === 'All STCG' ? 'bg-amber-100 text-amber-800' :
                                        taxSummary.taxStatus === 'Mixed' ? 'bg-purple-100 text-purple-800' :
                                        'bg-gray-100 text-gray-800'
                                      }`}>
                                        {taxSummary.taxStatus}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground text-xs">Disabled</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">{holding.quantity.toFixed(3)}</TableCell>
                                  <TableCell className="text-right font-medium">{formatCurrency(holding.currentValue)}</TableCell>
                                  <TableCell className="text-right">
                                    {holding.unrealizedGain !== undefined ? (
                                      <div className={holding.unrealizedGain >= 0 ? 'text-green-600' : 'text-red-600'}>
                                        <div className="font-medium text-sm">
                                          {holding.unrealizedGain >= 0 ? '+' : ''}{formatCurrency(Math.abs(holding.unrealizedGain))}
                                        </div>
                                        <div className="text-xs">
                                          ({holding.unrealizedGainPercent?.toFixed(1) || 0}%)
                                        </div>
                                      </div>
                                    ) : '-'}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {(holding.confidenceScore || 100) >= 70 ? (
                                      <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                                    ) : (
                                      <AlertTriangle className="h-4 w-4 text-yellow-600 mx-auto" />
                                    )}
                                  </TableCell>
                                </TableRow>
                                {/* EXPANDABLE LOT VIEW - Progressive Disclosure (Section 3.2) */}
                                {isExpanded && holding.lots && holding.lots.length > 0 && (
                                  <TableRow className="bg-muted/20">
                                    <TableCell colSpan={9} className="py-3">
                                      <div className="pl-8 pr-4">
                                        <div className="flex items-center justify-between mb-2">
                                          <div className="text-xs font-medium text-muted-foreground">Purchase History (FIFO Order) - Edit dates for accurate tax calculations</div>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-6 text-xs"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setEditingLotHoldingId(holdingId);
                                            }}
                                          >
                                            <Pencil className="h-3 w-3 mr-1" />
                                            Edit Lot Dates
                                          </Button>
                                        </div>
                                        <div className="space-y-1">
                                          {holding.lots.map((lot, lotIdx) => {
                                            // Normalize date to YYYY-MM-DD format for consistent handling
                                            const normalizedDateStr = getLotDateStr(lot) || '';
                                            const lotTax = calculateLotTaxStatus(normalizedDateStr);
                                            const lotExitLoad = calculateLotExitLoad(normalizedDateStr);
                                            const isEditingThisLot = editingLotHoldingId === holdingId;
                                            return (
                                              <div key={lotIdx} className="flex items-center justify-between text-sm bg-background rounded px-3 py-1.5 border">
                                                <div className="flex items-center gap-4">
                                                  {isEditingThisLot ? (
                                                    <Input
                                                      type="date"
                                                      className="h-7 w-32 text-xs"
                                                      value={normalizedDateStr}
                                                      onChange={(e) => {
                                                        const newDate = e.target.value; // YYYY-MM-DD format
                                                        const updatedHoldings = casPreviewHoldings.map((h, hIdx) => {
                                                          if (hIdx === idx && h.lots) {
                                                            const updatedLots = h.lots.map((l, lIdx) => {
                                                              if (lIdx === lotIdx) {
                                                                return {
                                                                  ...l,
                                                                  transactionDateStr: newDate,
                                                                  transactionDate: newDate, // Store as string to avoid timezone issues
                                                                  purchaseDate: newDate
                                                                };
                                                              }
                                                              return l;
                                                            });
                                                            // Also update firstPurchaseDate if this was the earliest lot
                                                            const newEarliestDate = updatedLots.reduce((earliest: string | null, l: any) => {
                                                              const lotDate = getLotDateStr(l);
                                                              if (!lotDate) return earliest;
                                                              if (!earliest) return lotDate;
                                                              return lotDate < earliest ? lotDate : earliest;
                                                            }, null);
                                                            return { ...h, lots: updatedLots, firstPurchaseDate: newEarliestDate ?? undefined };
                                                          }
                                                          return h;
                                                        });
                                                        setCasPreviewHoldings(updatedHoldings);
                                                      }}
                                                    />
                                                  ) : (
                                                    <span className="font-medium w-24">
                                                      {normalizedDateStr ? new Date(normalizedDateStr + 'T00:00:00').toLocaleDateString('en-IN', { 
                                                        day: '2-digit', month: 'short', year: 'numeric' 
                                                      }) : 'N/A'}
                                                    </span>
                                                  )}
                                                  <span className="text-muted-foreground w-28">
                                                    {lot.units.toFixed(3)} units
                                                  </span>
                                                  <span className="text-muted-foreground w-20">
                                                    @ ₹{lot.nav.toFixed(2)}
                                                  </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                                                    lotTax.type === 'LTCG' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                                  }`}>
                                                    {lotTax.type}
                                                  </span>
                                                  {lotExitLoad.hasExitLoad ? (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                                                      Exit load
                                                    </span>
                                                  ) : (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                                                      No exit load
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                        {editingLotHoldingId === holdingId && (
                                          <div className="mt-2 flex items-center gap-2">
                                            <Button
                                              variant="default"
                                              size="sm"
                                              className="h-6 text-xs"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingLotHoldingId(null);
                                                toast({
                                                  title: 'Lot Dates Updated',
                                                  description: 'Tax status and exit load will be recalculated with new dates.',
                                                });
                                              }}
                                            >
                                              Done Editing
                                            </Button>
                                            <span className="text-xs text-muted-foreground">Changes apply to tax/exit load calculations</span>
                                          </div>
                                        )}
                                        {/* Tax Summary per Fix Spec Section 4.2 */}
                                        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                                          {taxSummary.ltcgUnits > 0 && (
                                            <span>LTCG: {taxSummary.ltcgUnits.toFixed(3)} units</span>
                                          )}
                                          {taxSummary.stcgUnits > 0 && (
                                            <span>STCG: {taxSummary.stcgUnits.toFixed(3)} units</span>
                                          )}
                                        </div>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                                </>
                              )})}
                            </TableBody>
                          </Table>
                        </div>
                        
                        <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                          {casImportSummary && (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-sm text-primary">
                                <CheckCircle className="h-4 w-4" />
                                <span>{casImportSummary}</span>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  if (prospectId) {
                                    try {
                                      const res = await fetch(`/api/agent-wizard/prospects/${prospectId}/holdings`, {
                                        credentials: 'include'
                                      });
                                      if (res.ok) {
                                        const data = await res.json();
                                        setEditableHoldings((data.holdings || []).map((h: any) => {
                                          const dateValue = h.purchaseDate || h.buyDate;
                                          return {
                                            id: h.id,
                                            name: h.name || h.securityName || '',
                                            isin: h.isin || '',
                                            folioNumber: h.folioNumber || '',
                                            purchaseDate: dateValue ? new Date(dateValue).toISOString().split('T')[0] : '',
                                            quantity: parseFloat(h.quantity) || 0,
                                            avgPrice: parseFloat(h.avgPrice || h.buyPrice) || 0,
                                            currentValue: parseFloat(h.currentValue) || 0,
                                          };
                                        }));
                                        setShowEditHoldingsDialog(true);
                                      }
                                    } catch (err) {
                                      console.error('Failed to fetch holdings:', err);
                                    }
                                  }
                                }}
                              >
                                <Pencil className="h-4 w-4 mr-1" />
                                Edit Holdings
                              </Button>
                            </div>
                          )}
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{casPreviewHoldings.length} holdings ready to import</span>
                            <div className="text-right space-y-1">
                              <div className="text-muted-foreground">
                                Invested: {formatCurrency(casPreviewHoldings.reduce((sum, h) => sum + (h.investedValue || 0), 0))}
                              </div>
                              <div className="font-semibold">
                                Current Value: {formatCurrency(casPreviewHoldings.reduce((sum, h) => sum + h.currentValue, 0))}
                              </div>
                              {(() => {
                                const totalInvested = casPreviewHoldings.reduce((sum, h) => sum + (h.investedValue || 0), 0);
                                const totalCurrent = casPreviewHoldings.reduce((sum, h) => sum + h.currentValue, 0);
                                const totalGain = totalCurrent - totalInvested;
                                const gainPercent = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;
                                return totalInvested > 0 ? (
                                  <div className={totalGain >= 0 ? 'text-green-600' : 'text-red-600'}>
                                    Total Gain: {totalGain >= 0 ? '+' : ''}{formatCurrency(Math.abs(totalGain))} ({gainPercent.toFixed(1)}%)
                                  </div>
                                ) : null;
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : !casUploadType ? (
                      <div className="grid grid-cols-2 gap-4">
                        <Card 
                          className="cursor-pointer hover:border-primary transition-colors"
                          onClick={() => setCasUploadType('cas')}
                        >
                          <CardContent className="p-4 text-center">
                            <FileText className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                            <h4 className="font-medium">CAMS/KFintech CAS</h4>
                            <p className="text-xs text-muted-foreground">Mutual Fund Statement</p>
                          </CardContent>
                        </Card>
                        <Card 
                          className="cursor-pointer hover:border-primary transition-colors opacity-60"
                          onClick={() => setCasUploadType('demat')}
                        >
                          <CardContent className="p-4 text-center">
                            <FileText className="h-8 w-8 mx-auto mb-2 text-green-600" />
                            <h4 className="font-medium">NSDL/CDSL</h4>
                            <p className="text-xs text-muted-foreground">Demat Statement (Beta)</p>
                          </CardContent>
                        </Card>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                          <Button variant="ghost" size="sm" onClick={() => {
                            setCasUploadType(null);
                            setCasFile(null);
                            setCasPreviewError(null);
                          }}>
                            <ArrowLeft className="h-4 w-4 mr-1" />
                            Back
                          </Button>
                          <span className="font-medium">
                            {casUploadType === 'cas' ? 'CAMS/KFintech CAS' : 'NSDL/CDSL Statement'}
                          </span>
                        </div>
                        
                        <div 
                          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                            casFile ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-muted-foreground/25 hover:border-primary'
                          }`}
                        >
                          <input
                            type="file"
                            accept=".pdf"
                            className="hidden"
                            id="cas-file-input"
                            onChange={(e) => {
                              setCasFile(e.target.files?.[0] || null);
                              setCasPreviewError(null);
                            }}
                          />
                          <label htmlFor="cas-file-input" className="cursor-pointer block">
                            {casFile ? (
                              <>
                                <CheckCircle className="h-10 w-10 mx-auto mb-2 text-green-600" />
                                <p className="font-medium">{casFile.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {(casFile.size / 1024).toFixed(1)} KB - Click to change
                                </p>
                              </>
                            ) : (
                              <>
                                <Upload className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                                <p className="font-medium">Drop your PDF here or click to browse</p>
                                <p className="text-sm text-muted-foreground">
                                  Supports {casUploadType === 'cas' ? 'CAMS and KFintech CAS' : 'NSDL and CDSL'} PDF statements
                                </p>
                              </>
                            )}
                          </label>
                        </div>
                        
                        {casPreviewError && !casPreviewMode && (
                          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            {casPreviewError}
                          </div>
                        )}
                        
                        {casUploadType === 'cas' && !casPreviewError && (
                          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-sm flex items-center gap-2">
                            <Info className="h-4 w-4 flex-shrink-0" />
                            <span>You can download your CAS from MFCentral, CAMSOnline, or KFintech portal. Make sure it's the detailed statement with unit balance.</span>
                          </div>
                        )}
                        
                        {casUploadType === 'demat' && !casPreviewError && (
                          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-sm flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                            <span>Demat statement parsing is in beta. Some holdings may require manual verification after import.</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <DialogFooter className="gap-2 sm:gap-0 flex-col sm:flex-row">
                    {/* STEP 5 (FIX SPEC): Show date warning before save blocker */}
                    {casPreviewMode && casDateWarning && (
                      <div className="w-full mb-2 p-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                        <span>{casDateWarning}</span>
                      </div>
                    )}
                    {/* STEP 6 (FIX SPEC): Show lot counts for acceptance verification */}
                    {casPreviewMode && casLotCounts && (
                      <div className="w-full mb-2 text-xs text-muted-foreground flex items-center gap-4">
                        <span>{casLotCounts.withLots} with dates</span>
                        <span>{casLotCounts.withMultipleLots} with multiple purchases</span>
                        {casLotCounts.withoutLots > 0 && (
                          <span className="text-amber-600">{casLotCounts.withoutLots} without dates</span>
                        )}
                      </div>
                    )}
                    {casPreviewMode ? (
                      <>
                        <Button variant="outline" onClick={() => {
                          setCasPreviewMode(false);
                          setCasFile(null);
                        }}>
                          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Upload
                        </Button>
                        {/* STEP 5 (FIX SPEC): Save blocker - require confirmation if date warning exists */}
                        {casDateWarning && !showDateWarningConfirm ? (
                          <Button 
                            variant="destructive"
                            onClick={() => setShowDateWarningConfirm(true)}
                            disabled={casImportMutation.isPending}
                          >
                            <AlertTriangle className="h-4 w-4 mr-2" /> Proceed Despite Warning
                          </Button>
                        ) : (
                          <Button 
                            onClick={() => casImportMutation.mutate(casPreviewHoldings)}
                            disabled={casImportMutation.isPending}
                          >
                            {casImportMutation.isPending ? (
                              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing...</>
                            ) : (
                              <><CheckCircle className="h-4 w-4 mr-2" /> Import {casPreviewHoldings.length} Holdings</>
                            )}
                          </Button>
                        )}
                      </>
                    ) : casUploadType ? (
                      <Button 
                        onClick={() => casFile && casPreviewMutation.mutate(casFile)}
                        disabled={!casFile || casPreviewMutation.isPending}
                      >
                        {casPreviewMutation.isPending ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Parsing PDF...</>
                        ) : (
                          <>Preview Holdings</>
                        )}
                      </Button>
                    ) : null}
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* Upload PDF Section */}
            {importMode === 'upload' && (
              <div className="border-2 border-dashed rounded-lg p-6 text-center bg-muted/20">
                <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-3">
                  Upload a portfolio statement from Zerodha, Groww, ICICI Direct, HDFC Securities, Kotak, Wealthy.in, or other brokers
                </p>
                <input
                  type="file"
                  accept=".pdf,.html,.htm,.csv,.xlsx,.xls"
                  id="portfolio-upload"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && prospectId) {
                      uploadPortfolioMutation.mutate(file);
                    } else if (!prospectId) {
                      toast({ title: "Error", description: "Please create prospect first.", variant: "destructive" });
                    }
                  }}
                  data-testid="portfolio-file-input"
                />
                <label htmlFor="portfolio-upload">
                  <Button 
                    variant="secondary" 
                    disabled={uploadPortfolioMutation.isPending || !prospectId}
                    asChild
                    title="Supports PDF, HTML, CSV, and Excel files"
                  >
                    <span>
                      {uploadPortfolioMutation.isPending ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Parsing...</>
                      ) : (
                        <><Upload className="h-4 w-4 mr-2" /> Upload Portfolio</>
                      )}
                    </span>
                  </Button>
                </label>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, HTML, CSV, or Excel (.xlsx, .xls)
                </p>
                {importResult && (
                  <div className="mt-4 space-y-2">
                    {/* Success/Failure Message */}
                    <div className={`p-3 rounded-lg text-sm ${importResult.success ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}>
                      {importResult.success ? (
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" />
                          Detected {importResult.brokerDetected} • {importResult.holdings?.length || 0} holdings • {importResult.confidenceScore}% confidence
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          {importResult.errors?.[0] || 'Failed to parse portfolio'}
                        </div>
                      )}
                    </div>
                    
                    {/* Alert for unimported funds */}
                    {importResult.unimportedCount && importResult.unimportedCount > 0 && (
                      <div className="p-3 rounded-lg text-sm bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <div>
                            <div className="font-medium">
                              {importResult.unimportedCount} of {importResult.expectedCount} funds could not be imported
                            </div>
                            <div className="text-xs mt-1 opacity-80">
                              Please use "Manual Entry" below to add the missing holdings. Check the original PDF for fund names and values.
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* URL Import Section */}
            {importMode === 'url' && (
              <div className="border rounded-lg p-4 bg-muted/20">
                <p className="text-sm text-muted-foreground mb-3">
                  Import portfolio from Wealthy.in, MF Central, or other supported platforms
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://wealthy.in/share/portfolio/..."
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    className="flex-1"
                    data-testid="portfolio-url-input"
                  />
                  <Button
                    onClick={() => {
                      if (importUrl && prospectId) {
                        importUrlMutation.mutate(importUrl);
                      } else if (!prospectId) {
                        toast({ title: "Error", description: "Please create prospect first.", variant: "destructive" });
                      }
                    }}
                    disabled={importUrlMutation.isPending || !importUrl || !prospectId}
                    data-testid="import-url-btn"
                  >
                    {importUrlMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing...</>
                    ) : (
                      <><Download className="h-4 w-4 mr-2" /> Import</>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Supported: Wealthy.in public share links, MF Central export URLs
                </p>
              </div>
            )}

            {/* Manual Entry Section */}
            {importMode === 'manual' && (
            <div className="p-4 bg-muted/30 rounded-lg space-y-3">
              {editingHoldingIndex !== null && (
                <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
                  <Pencil className="h-4 w-4" />
                  Editing holding #{editingHoldingIndex + 1}
                </div>
              )}
              
              {/* SIP Mode Toggle */}
              {editingHoldingIndex === null && (
                <div className="flex items-center gap-3 pb-2 border-b">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sipMode}
                      onChange={(e) => {
                        const newSipMode = e.target.checked;
                        setSipMode(newSipMode);
                        // Reset relevant fields when toggling mode
                        if (newSipMode) {
                          // Entering SIP mode - clear single-entry fields, keep fund selection
                          setNewHolding(prev => ({ 
                            ...prev, 
                            quantity: 1, 
                            currentValue: 0, 
                            purchaseDate: undefined 
                          }));
                        } else {
                          // Exiting SIP mode - reset lots
                          setSipLots([{ purchaseDate: '', units: 0 }]);
                        }
                      }}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="text-sm font-medium">SIP Mode</span>
                  </label>
                  <span className="text-xs text-muted-foreground">
                    {sipMode ? 'Add multiple purchase dates for the same fund' : 'Toggle to add SIP lots with different purchase dates'}
                  </span>
                </div>
              )}
              
              <div className="grid md:grid-cols-7 gap-3 items-end">
                <div className="space-y-2">
                  <Label>Product Type</Label>
                  <Select value={newHolding.productType} onValueChange={(v) => setNewHolding({ ...newHolding, productType: v })}>
                    <SelectTrigger data-testid="product-type-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCT_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2 relative">
                  <Label>Product Name / ISIN</Label>
                  <div className="relative">
                    <Input 
                      placeholder="Search by name or ISIN (min 3 chars)"
                      value={productSearchQuery || newHolding.productName || ''}
                      onChange={(e) => {
                        setProductSearchQuery(e.target.value);
                        setNewHolding({ ...newHolding, productName: e.target.value });
                        if (e.target.value !== newHolding.productName) {
                          setSelectedInstrumentPrice(null);
                        }
                      }}
                      onFocus={() => productSearchResults.length > 0 && setShowProductDropdown(true)}
                      data-testid="product-name-input"
                    />
                    {isSearchingProducts && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    {showProductDropdown && productSearchResults.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
                        {productSearchResults.map((instrument, idx) => (
                          <button
                            key={instrument.id || idx}
                            className="w-full px-3 py-2 text-left hover:bg-muted/50 border-b last:border-0 text-sm"
                            onClick={() => selectProduct(instrument)}
                            type="button"
                          >
                            <div className="font-medium truncate">{instrument.name || instrument.shortName}</div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {instrument.isin && <span className="font-mono">{instrument.isin}</span>}
                              {instrument.lastPrice && <span>₹{parseFloat(instrument.lastPrice).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>}
                              {instrument.category && <Badge variant="outline" className="text-[10px] h-4">{instrument.category}</Badge>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {newHolding.isin && (
                    <p className="text-xs text-muted-foreground">ISIN: {newHolding.isin}</p>
                  )}
                </div>
                {/* Single Entry Mode Fields */}
                {!sipMode && (
                  <>
                    <div className="space-y-2">
                      <Label>Units Held</Label>
                      <Input 
                        type="number"
                        placeholder="100"
                        step="0.0001"
                        value={newHolding.quantity || ''}
                        onChange={(e) => handleUnitsChange(parseFloat(e.target.value) || 0)}
                        data-testid="product-units-input"
                      />
                      {selectedInstrumentPrice && (
                        <p className="text-xs text-muted-foreground">
                          Price: ₹{selectedInstrumentPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Current Value (₹)</Label>
                      <Input 
                        type="number"
                        placeholder="100000"
                        value={newHolding.currentValue || ''}
                        onChange={(e) => setNewHolding({ ...newHolding, currentValue: parseFloat(e.target.value) || 0 })}
                        data-testid="product-value-input"
                        className={selectedInstrumentPrice ? "bg-muted/30" : ""}
                      />
                      {selectedInstrumentPrice && newHolding.quantity && (
                        <p className="text-xs text-green-600">Auto-calculated from units × price</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        Purchase Date
                        <span className="text-xs text-muted-foreground">(for tax)</span>
                      </Label>
                      <Input 
                        type="date"
                        value={newHolding.purchaseDate || ''}
                        onChange={(e) => setNewHolding({ ...newHolding, purchaseDate: e.target.value })}
                        data-testid="purchase-date-input"
                        max={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                  </>
                )}
                
                {/* SIP Mode - Show Add button that spans remaining columns */}
                {sipMode && (
                  <div className="md:col-span-4 flex items-end">
                    {selectedInstrumentPrice && (
                      <p className="text-xs text-muted-foreground mr-4">
                        Current NAV: ₹{selectedInstrumentPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </p>
                    )}
                  </div>
                )}
                
                {editingHoldingIndex !== null ? (
                  <div className="flex gap-2">
                    <Button onClick={saveEditHolding} size="sm" data-testid="save-holding-btn" disabled={updateHoldingMutation.isPending}>
                      {updateHoldingMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </Button>
                    <Button onClick={cancelEditHolding} size="sm" variant="outline" data-testid="cancel-edit-btn">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button onClick={addHolding} data-testid="add-holding-btn" disabled={addHoldingMutation.isPending}>
                    {addHoldingMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />} {sipMode ? 'Add All Lots' : 'Add'}
                  </Button>
                )}
              </div>
              
              {/* SIP Lots Entry Section */}
              {sipMode && newHolding.productName && (
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      SIP Purchase Lots for {newHolding.productName}
                    </h4>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={addSipLot}
                      className="text-blue-600 border-blue-300 hover:bg-blue-100"
                    >
                      <Plus className="h-3 w-3 mr-1" /> Add Lot
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    {sipLots.map((lot, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-4">
                          {idx === 0 && <Label className="text-xs">Purchase Date</Label>}
                          <Input
                            type="date"
                            value={lot.purchaseDate}
                            onChange={(e) => updateSipLot(idx, 'purchaseDate', e.target.value)}
                            max={new Date().toISOString().split('T')[0]}
                            className="h-9"
                          />
                        </div>
                        <div className="col-span-3">
                          {idx === 0 && <Label className="text-xs">Units</Label>}
                          <Input
                            type="number"
                            step="0.0001"
                            placeholder="100"
                            value={lot.units || ''}
                            onChange={(e) => updateSipLot(idx, 'units', parseFloat(e.target.value) || 0)}
                            className="h-9"
                          />
                        </div>
                        <div className="col-span-4">
                          {idx === 0 && <Label className="text-xs">Invested Amount (optional)</Label>}
                          <Input
                            type="number"
                            placeholder="₹5,000"
                            value={lot.investedAmount || ''}
                            onChange={(e) => updateSipLot(idx, 'investedAmount', parseFloat(e.target.value) || 0)}
                            className="h-9"
                          />
                        </div>
                        <div className="col-span-1">
                          {sipLots.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeSipLot(idx)}
                              className="h-9 w-9 p-0 text-red-500 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {sipLots.filter(l => l.purchaseDate && l.units > 0).length > 0 && selectedInstrumentPrice && (
                    <div className="text-xs text-blue-700 dark:text-blue-300 pt-2 border-t border-blue-200 dark:border-blue-700">
                      <span className="font-medium">Summary:</span>{' '}
                      {sipLots.filter(l => l.purchaseDate && l.units > 0).length} lots,{' '}
                      {sipLots.filter(l => l.purchaseDate && l.units > 0).reduce((sum, l) => sum + l.units, 0).toFixed(4)} total units,{' '}
                      ₹{(sipLots.filter(l => l.purchaseDate && l.units > 0).reduce((sum, l) => sum + l.units, 0) * selectedInstrumentPrice).toLocaleString('en-IN', { maximumFractionDigits: 0 })} current value
                    </div>
                  )}
                </div>
              )}
            </div>
            )}

            {/* Holdings Table - Always visible */}
            {holdings.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {holdings.length} investment{holdings.length !== 1 ? 's' : ''} saved
                  </p>
                  <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" data-testid="reset-portfolio-btn">
                        <RotateCcw className="h-4 w-4 mr-1" /> Reset Portfolio
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Reset Portfolio?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will clear all {holdings.length} holdings from the portfolio. You can then upload a fresh portfolio or add new holdings manually. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => resetPortfolioMutation.mutate()}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          disabled={resetPortfolioMutation.isPending}
                        >
                          {resetPortfolioMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                          Reset All Holdings
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead className="w-28">Purchase Date</TableHead>
                      <TableHead className="w-24 text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {holdings.map((holding, idx) => {
                      // Parse date from any format to Date object
                      const parseAnyDateFormat = (dateInput: string | Date | null | undefined): Date | null => {
                        if (!dateInput) return null;
                        
                        // If already a Date object, return it
                        if (dateInput instanceof Date) {
                          return isNaN(dateInput.getTime()) ? null : dateInput;
                        }
                        
                        const str = String(dateInput).trim();
                        if (!str) return null;
                        
                        // Try ISO format first (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)
                        if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
                          const d = new Date(str.split('T')[0] + 'T00:00:00');
                          return isNaN(d.getTime()) ? null : d;
                        }
                        
                        // Try DD-MMM-YYYY or DD/MMM/YYYY (e.g., "18-Mar-2024")
                        const ddMmmYyyyMatch = str.match(/^(\d{1,2})[-\/]([A-Za-z]{3})[-\/](\d{4})$/);
                        if (ddMmmYyyyMatch) {
                          const months: Record<string, number> = { 
                            jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, 
                            jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 
                          };
                          const day = parseInt(ddMmmYyyyMatch[1], 10);
                          const monthIdx = months[ddMmmYyyyMatch[2].toLowerCase()];
                          const year = parseInt(ddMmmYyyyMatch[3], 10);
                          if (monthIdx !== undefined) {
                            return new Date(year, monthIdx, day);
                          }
                        }
                        
                        // Try DD/MM/YYYY or DD-MM-YYYY
                        const ddMmYyyyMatch = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
                        if (ddMmYyyyMatch) {
                          const day = parseInt(ddMmYyyyMatch[1], 10);
                          const month = parseInt(ddMmYyyyMatch[2], 10) - 1;
                          const year = parseInt(ddMmYyyyMatch[3], 10);
                          return new Date(year, month, day);
                        }
                        
                        // Fallback to native Date parsing
                        const d = new Date(str);
                        return isNaN(d.getTime()) ? null : d;
                      };
                      
                      // Convert Date to YYYY-MM-DD string
                      const toISODateString = (d: Date): string => {
                        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                      };
                      
                      // Get earliest purchase date from lots or holding's purchaseDate
                      const getHoldingPurchaseDate = (): string | null => {
                        // Check lots first (most accurate for CAS imports)
                        if (holding.lots && holding.lots.length > 0) {
                          let earliestDate: Date | null = null;
                          for (const lot of holding.lots) {
                            const parsed = parseAnyDateFormat(lot.transactionDateStr) || 
                                           parseAnyDateFormat(lot.transactionDate) ||
                                           parseAnyDateFormat(lot.purchaseDate);
                            if (parsed) {
                              if (!earliestDate || parsed.getTime() < earliestDate.getTime()) {
                                earliestDate = parsed;
                              }
                            }
                          }
                          if (earliestDate) return toISODateString(earliestDate);
                        }
                        // Fallback to holding's purchaseDate
                        const holdingDate = parseAnyDateFormat(holding.purchaseDate);
                        return holdingDate ? toISODateString(holdingDate) : null;
                      };
                      
                      const purchaseDateStr = getHoldingPurchaseDate();
                      const formattedPurchaseDate = purchaseDateStr 
                        ? new Date(purchaseDateStr + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                        : null;
                      
                      return (
                      <TableRow key={idx} className={editingHoldingIndex === idx ? 'bg-amber-50 dark:bg-amber-900/20' : ''}>
                        <TableCell className="font-medium">{holding.productName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{PRODUCT_TYPES.find(t => t.value === holding.productType)?.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(holding.currentValue)}</TableCell>
                        <TableCell>
                          {editingHoldingIndex === idx ? (
                            <Input
                              type="date"
                              className="h-8 w-28 text-xs"
                              value={purchaseDateStr || ''}
                              onChange={(e) => {
                                const newDate = e.target.value;
                                // Guard against empty/invalid date input - purchase date is required for tax calculations
                                if (!newDate) {
                                  toast({
                                    title: "Purchase Date Required",
                                    description: "Purchase date is required for accurate capital gains and exit load calculations.",
                                    variant: "destructive"
                                  });
                                  return;
                                }
                                if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
                                  // Don't update if date format is invalid (shouldn't happen with date input)
                                  return;
                                }
                                
                                const updatedHoldings = [...holdings];
                                // Normalize to YYYY-MM-DD string format for storage
                                const normalizedDateStr = newDate; // Already YYYY-MM-DD from date input
                                // Create a proper Date object for transactionDate
                                const normalizedDateObj = new Date(normalizedDateStr + 'T00:00:00');
                                
                                // Validate the Date object is valid
                                if (isNaN(normalizedDateObj.getTime())) {
                                  // Don't update if date parsing failed
                                  return;
                                }
                                
                                updatedHoldings[idx] = {
                                  ...updatedHoldings[idx],
                                  purchaseDate: normalizedDateStr
                                };
                                // Update all lot date fields to keep them in sync
                                // - purchaseDate: string YYYY-MM-DD (for backward compat)
                                // - transactionDateStr: string YYYY-MM-DD (canonical string format)
                                // - transactionDate: Date object (for code that expects Date)
                                if (updatedHoldings[idx].lots && updatedHoldings[idx].lots.length > 0) {
                                  updatedHoldings[idx].lots = updatedHoldings[idx].lots.map(lot => ({
                                    ...lot,
                                    purchaseDate: normalizedDateStr,
                                    transactionDateStr: normalizedDateStr,
                                    transactionDate: normalizedDateObj
                                  }));
                                }
                                setHoldings(updatedHoldings);
                              }}
                              data-testid={`edit-date-${idx}`}
                            />
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              {formattedPurchaseDate || <span className="italic text-xs">Not set</span>}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => startEditHolding(idx)} 
                              data-testid={`edit-holding-${idx}`}
                              disabled={editingHoldingIndex !== null}
                            >
                              <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => removeHolding(idx)} 
                              data-testid={`remove-holding-${idx}`}
                              disabled={deleteHoldingMutation.isPending || editingHoldingIndex !== null}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )})}
                    <TableRow className="bg-muted/50">
                      <TableCell colSpan={2} className="font-semibold">Total Portfolio Value</TableCell>
                      <TableCell className="text-right font-bold text-lg">{formatCurrency(totalPortfolioValue)}</TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <PieChart className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No holdings added yet. Add investments above or proceed for fresh investment recommendations.</p>
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <Label>Fresh Investment Amount (Optional)</Label>
              <div className="flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-muted-foreground" />
                <Input 
                  type="number"
                  placeholder="500000"
                  value={freshInvestmentAmount || ''}
                  onChange={(e) => setFreshInvestmentAmount(parseFloat(e.target.value) || 0)}
                  className="max-w-xs"
                  data-testid="fresh-investment-input"
                />
              </div>
              <p className="text-sm text-muted-foreground">Enter amount for new investment recommendations</p>
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setCurrentStep(3)} data-testid="back-to-goals-btn">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button 
              onClick={() => analyzePortfolioMutation.mutate()}
              disabled={analyzePortfolioMutation.isPending}
              data-testid="analyze-portfolio-btn"
            >
              {analyzePortfolioMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Sparkles className="h-4 w-4 mr-2" /> Analyze Portfolio
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Smart Import Dialog */}
      <Dialog open={showSmartImportDialog} onOpenChange={setShowSmartImportDialog}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-purple-600" />
              Smart Portfolio Import
            </DialogTitle>
            <DialogDescription>
              Auto-detect 17+ broker formats with ISIN enrichment and holding lots tracking
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto py-4">
            <PortfolioImportPanel
              prospectId={prospectId || undefined}
              onHoldingsSaved={(count) => {
                setShowSmartImportDialog(false);
                toast({
                  title: "Portfolio Imported",
                  description: `Successfully imported ${count} holdings with ISIN enrichment.`
                });
                // Refresh the holdings list from correct endpoint
                if (prospectId) {
                  apiRequest(`/api/agent-wizard/prospects/${prospectId}/holdings`)
                    .then((data: any) => {
                      if (data?.holdings) {
                        setHoldings(data.holdings.map(toFrontendHolding));
                      }
                    })
                    .catch((err: any) => console.log("Refresh holdings error:", err));
                }
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Step 5: Portfolio Analysis */}
      {currentStep === 5 && analysis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" /> Portfolio Analysis</CardTitle>
            <CardDescription>AI-powered insights for {prospectData.name}'s portfolio</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 border-blue-200">
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Total Value</p>
                  <p className="text-2xl font-bold">{formatCurrency(analysis.totalValue)}</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 border-green-200">
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Diversification Score</p>
                  <p className="text-2xl font-bold">{analysis.diversificationScore}/100</p>
                  <Progress value={analysis.diversificationScore} className="mt-2" />
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/30 border-amber-200">
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Risk Score</p>
                  <p className="text-2xl font-bold">{analysis.riskScore}/100</p>
                  <Progress value={analysis.riskScore} className="mt-2" />
                </CardContent>
              </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Asset Allocation</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(analysis.assetAllocation).map(([type, data]) => (
                      <div key={type} className="flex items-center justify-between">
                        <span className="capitalize">{type.replace('_', ' ')}</span>
                        <div className="flex items-center gap-2">
                          <Progress value={data.percentage} className="w-24" />
                          <span className="text-sm font-medium w-12 text-right">{data.percentage}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {analysis.recommendations.map((rec, idx) => (
                      <div key={idx} className={`p-2 rounded-lg text-sm ${
                        rec.type === 'warning' ? 'bg-amber-100 dark:bg-amber-900/30' :
                        rec.type === 'suggestion' ? 'bg-blue-100 dark:bg-blue-900/30' :
                        'bg-green-100 dark:bg-green-900/30'
                      }`}>
                        {rec.type === 'warning' && <AlertTriangle className="h-4 w-4 inline mr-1" />}
                        {rec.message}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Executive Summary Card */}
            {proposalSections.executiveSummary && analysis && (
              <Card className="mt-4 border-emerald-200 dark:border-emerald-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-5 w-5 text-emerald-600" />
                    Executive Summary
                  </CardTitle>
                  <CardDescription>One-page key highlights for {prospectData.name}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Total Portfolio Value</p>
                      <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{formatCurrency(analysis.totalValue)}</p>
                      <p className="text-xs text-green-600 mt-1">+{(((analysis as any).totalGainPercent || 0)).toFixed(1)}% overall gain</p>
                    </div>
                    <div className="p-3 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Risk Profile</p>
                      <p className="text-xl font-bold text-purple-700 dark:text-purple-300 capitalize">{riskProfile.riskTolerance}</p>
                      <p className="text-xs text-muted-foreground mt-1">Score: {analysis.riskScore}/100</p>
                    </div>
                    <div className="p-3 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Holdings Count</p>
                      <p className="text-xl font-bold text-amber-700 dark:text-amber-300">{holdings.length}</p>
                      <p className="text-xs text-muted-foreground mt-1">Across {Object.keys(analysis.assetAllocation || {}).length} asset types</p>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                    <p className="text-sm font-medium mb-2">Key Observations</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li className="flex items-start gap-2"><CheckCircle className="h-3 w-3 text-green-500 mt-0.5" /> Portfolio aligned with {riskProfile.primaryGoal?.replace('_', ' ')} goal</li>
                      <li className="flex items-start gap-2"><CheckCircle className="h-3 w-3 text-green-500 mt-0.5" /> Investment horizon: {riskProfile.investmentHorizon?.replace('_', ' ')}</li>
                      {healthScoreData && <li className="flex items-start gap-2"><Activity className="h-3 w-3 text-blue-500 mt-0.5" /> Health Score: {healthScoreData.overallScore}/100</li>}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Portfolio Health Score Card */}
            {proposalSections.portfolioHealthScore && healthScoreData && (
              <Card className="mt-4 border-teal-200 dark:border-teal-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-5 w-5 text-teal-600" />
                    Portfolio Health Score
                  </CardTitle>
                  <CardDescription>Overall portfolio quality assessment</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6 mb-4">
                    <div className="relative w-24 h-24">
                      <svg className="w-24 h-24 transform -rotate-90">
                        <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="none" className="text-muted/30" />
                        <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="none" 
                          className={(healthScoreData?.overallScore ?? 0) >= 80 ? 'text-green-500' : (healthScoreData?.overallScore ?? 0) >= 60 ? 'text-amber-500' : 'text-red-500'}
                          strokeDasharray={`${(healthScoreData?.overallScore ?? 0) * 2.51} 251`} strokeLinecap="round" />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-bold">{healthScoreData?.overallScore ?? 0}</span>
                      </div>
                    </div>
                    <div className="flex-1 space-y-2">
                      {Object.entries(healthScoreData?.components ?? {}).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2">
                          <span className="text-xs capitalize w-24">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                          <Progress value={value} className="flex-1 h-2" />
                          <span className="text-xs font-medium w-8 text-right">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {(healthScoreData?.recommendations?.length ?? 0) > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Improvement Suggestions:</p>
                      {(healthScoreData?.recommendations ?? []).map((rec, idx) => (
                        <p key={idx} className="text-xs text-amber-700 dark:text-amber-300 flex items-start gap-1">
                          <Lightbulb className="h-3 w-3 mt-0.5" /> {rec}
                        </p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Expense Ratio Analysis Card */}
            {proposalSections.expenseRatioAnalysis && expenseRatioData && (
              <Card className="mt-4 border-pink-200 dark:border-pink-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Percent className="h-5 w-5 text-pink-600" />
                    Expense Ratio Analysis
                  </CardTitle>
                  <CardDescription>Total expense ratios and potential savings</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="p-2 bg-pink-50 dark:bg-pink-900/20 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground">Weighted Avg TER</p>
                      <p className="text-lg font-bold text-pink-600">{expenseRatioData?.weightedAvgTER ?? 0}%</p>
                    </div>
                    <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground">Annual Cost</p>
                      <p className="text-lg font-bold text-red-600">{formatCurrency(expenseRatioData?.totalAnnualCost ?? 0)}</p>
                    </div>
                    <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground">Potential Savings</p>
                      <p className="text-lg font-bold text-green-600">{formatCurrency(expenseRatioData?.potentialSavings ?? 0)}</p>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-36 overflow-y-auto">
                    {(expenseRatioData?.holdings ?? []).slice(0, 5).map((h, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-sm">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{h.name}</p>
                          <p className="text-xs text-muted-foreground">TER: {h.ter}% | Cost: {formatCurrency(h.annualCost)}/yr</p>
                        </div>
                        {h.suggestedAlternative && (
                          <Badge variant="outline" className="text-green-600 border-green-300 text-xs">
                            Save {formatCurrency(h.suggestedAlternative.savings)}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Risk Heatmap Card */}
            {proposalSections.riskHeatmap && riskHeatmapData && (
              <Card className="mt-4 border-red-200 dark:border-red-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    Risk Heatmap
                  </CardTitle>
                  <CardDescription>Concentration risks and sector allocation</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 mb-4">
                    <Badge variant={
                      (riskHeatmapData?.overallRisk ?? 'medium') === 'low' ? 'default' :
                      (riskHeatmapData?.overallRisk ?? 'medium') === 'medium' ? 'secondary' :
                      (riskHeatmapData?.overallRisk ?? 'medium') === 'high' ? 'destructive' : 'destructive'
                    } className="text-sm px-3 py-1">
                      {(riskHeatmapData?.overallRisk ?? 'medium').replace('_', ' ').toUpperCase()} RISK
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {(riskHeatmapData?.concentrationWarnings ?? []).length} concentration warning{(riskHeatmapData?.concentrationWarnings ?? []).length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {(riskHeatmapData?.concentrationWarnings ?? []).length > 0 && (
                    <div className="space-y-2 mb-4">
                      {(riskHeatmapData?.concentrationWarnings ?? []).slice(0, 4).map((w, idx) => (
                        <div key={idx} className={`p-2 rounded-lg text-sm flex items-center justify-between ${
                          w.severity === 'critical' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-amber-100 dark:bg-amber-900/30'
                        }`}>
                          <span className="flex items-center gap-2">
                            <AlertTriangle className={`h-4 w-4 ${w.severity === 'critical' ? 'text-red-600' : 'text-amber-600'}`} />
                            <span className="capitalize">{w.type}: {w.name}</span>
                          </span>
                          <Badge variant="outline">{w.percentage}% (limit: {w.threshold}%)</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Sector Allocation</p>
                    {(riskHeatmapData?.sectorAllocation ?? []).slice(0, 6).map((s, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-sm">{s.sector}</span>
                          <span className="text-sm font-bold text-green-600 dark:text-green-400 whitespace-nowrap">{(s.percentage ?? 0).toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full transition-all duration-300" 
                            style={{ width: `${Math.min(s.percentage || 0, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Benchmark Comparison Card */}
            {proposalSections.benchmarkComparison && benchmarkData && (
              <Card className="mt-4 border-sky-200 dark:border-sky-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-sky-600" />
                    Benchmark Comparison
                  </CardTitle>
                  <CardDescription>Portfolio returns vs market benchmarks</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-2 mb-4 text-center text-xs">
                    <div></div>
                    <div className="font-medium">1Y</div>
                    <div className="font-medium">3Y</div>
                    <div className="font-medium">5Y</div>
                    <div className="font-medium text-left">Your Portfolio</div>
                    <div className="text-blue-600 font-bold">{benchmarkData?.portfolioReturn?.oneYear ?? 0}%</div>
                    <div className="text-blue-600 font-bold">{benchmarkData?.portfolioReturn?.threeYear ?? 0}%</div>
                    <div className="text-blue-600 font-bold">{benchmarkData?.portfolioReturn?.fiveYear ?? 0}%</div>
                    {(benchmarkData?.benchmarks ?? []).map((b, idx) => (
                      <React.Fragment key={idx}>
                        <div className="text-left text-muted-foreground">{b.name}</div>
                        <div>{b.returns?.oneYear ?? 0}%</div>
                        <div>{b.returns?.threeYear ?? 0}%</div>
                        <div>{b.returns?.fiveYear ?? 0}%</div>
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="flex gap-4 p-2 bg-muted/50 rounded-lg">
                    <div className="text-center flex-1">
                      <p className="text-xs text-muted-foreground">Alpha</p>
                      <p className={`font-bold ${(benchmarkData?.alpha ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {(benchmarkData?.alpha ?? 0) >= 0 ? '+' : ''}{benchmarkData?.alpha ?? 0}%
                      </p>
                    </div>
                    <div className="text-center flex-1">
                      <p className="text-xs text-muted-foreground">Beta</p>
                      <p className="font-bold">{(benchmarkData?.beta ?? 0).toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Dividend Projection Card */}
            {proposalSections.dividendProjection && dividendData && (
              <Card className="mt-4 border-lime-200 dark:border-lime-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-lime-600" />
                    Dividend Income Projection
                  </CardTitle>
                  <CardDescription>Estimated dividend income from portfolio</CardDescription>
                </CardHeader>
                <CardContent>
                  {(dividendData as any)?.hasNoDividendHoldings ? (
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-center">
                      <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-1">No Dividend-Paying Holdings</p>
                      <p className="text-xs text-muted-foreground">
                        {(dividendData as any)?.message || 'Your portfolio consists of Growth plans which reinvest dividends instead of paying them out.'}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="p-2 bg-lime-50 dark:bg-lime-900/20 rounded-lg text-center">
                          <p className="text-xs text-muted-foreground">Annual Income</p>
                          <p className="text-lg font-bold text-lime-600">{formatCurrency(dividendData?.estimatedAnnualIncome ?? 0)}</p>
                        </div>
                        <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                          <p className="text-xs text-muted-foreground">Monthly Income</p>
                          <p className="text-lg font-bold text-green-600">{formatCurrency(dividendData?.monthlyIncome ?? 0)}</p>
                        </div>
                        <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-center">
                          <p className="text-xs text-muted-foreground">Yield</p>
                          <p className="text-lg font-bold text-emerald-600">{dividendData?.yieldPercent ?? 0}%</p>
                        </div>
                      </div>
                      {(dividendData?.holdings ?? []).length > 0 && (
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {(dividendData?.holdings ?? []).slice(0, 4).map((h, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-sm">
                              <span className="truncate flex-1">{h.name}</span>
                              <span className="text-xs text-muted-foreground ml-2">{h.dividendYield}% yield</span>
                              <Badge variant="outline" className="ml-2 text-xs">{formatCurrency(h.estimatedAnnualDividend)}/yr</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Exit Load Calendar */}
            {proposalSections.exitLoadCalendar && exitLoadData && exitLoadData.holdings.length > 0 && (
              <Card className="mt-4 border-blue-200 dark:border-blue-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-5 w-5 text-blue-600" />
                    Exit Load Calendar
                  </CardTitle>
                  <CardDescription>
                    Track when your holdings become exit-load-free
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground">Exit Load Free</p>
                      <p className="text-lg font-bold text-green-600">{exitLoadData.summary.exitLoadFree}</p>
                    </div>
                    <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground">Within Exit Period</p>
                      <p className="text-lg font-bold text-amber-600">{exitLoadData.summary.withinExitLoadPeriod}</p>
                    </div>
                    <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground">Exit Load Exposure</p>
                      <p className="text-lg font-bold text-red-600">{formatCurrency(exitLoadData.summary.totalExitLoadExposure)}</p>
                    </div>
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground">Total Holdings</p>
                      <p className="text-lg font-bold text-blue-600">{exitLoadData.summary.totalHoldings}</p>
                    </div>
                  </div>

                  {/* Holdings List */}
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {exitLoadData.holdings
                      .filter(h => !h.isExitLoadFree && h.daysToExitLoadFree !== null)
                      .slice(0, 5)
                      .map((holding, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-sm">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{holding.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {holding.daysToExitLoadFree} days to 0% exit load
                            </p>
                          </div>
                          <div className="text-right ml-2">
                            <Badge variant="outline" className="text-amber-600 border-amber-300">
                              {holding.exitLoadPercent.toFixed(2)}% load
                            </Badge>
                            {holding.exitLoadFreeDate && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Free by {new Date(holding.exitLoadFreeDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    {exitLoadData.holdings.filter(h => h.isExitLoadFree).length > 0 && (
                      <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg text-sm flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-green-700 dark:text-green-300">
                          {exitLoadData.holdings.filter(h => h.isExitLoadFree).length} holdings are already exit-load-free
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Priority Recommendations Card */}
            {proposalSections.priorityRecommendations && capitalGainsData && riskHeatmapData && (
              <Card className="mt-4 border-rose-200 dark:border-rose-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ListChecks className="h-5 w-5 text-rose-600" />
                    Priority Recommendations
                  </CardTitle>
                  <CardDescription>Ranked action items based on impact and urgency</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      ...(riskHeatmapData.concentrationWarnings?.some((w: any) => w.severity === 'critical') ? [{
                        priority: 1,
                        action: 'Reduce concentration risk',
                        reason: 'Portfolio has critical concentration in single sector/stock',
                        impact: 'Reduces portfolio volatility by up to 15%'
                      }] : []),
                      ...((capitalGainsData?.stcg?.count ?? 0) > 0 && (capitalGainsData?.stcg?.estimatedTax ?? 0) > 0 ? [{
                        priority: 2,
                        action: 'Consider tax-loss harvesting',
                        reason: `${capitalGainsData?.stcg?.count ?? 0} holdings have short-term gains`,
                        impact: `Potential tax savings: ${formatCurrency((capitalGainsData?.stcg?.estimatedTax ?? 0) * 0.3)}`
                      }] : []),
                      {
                        priority: 3,
                        action: 'Review expense ratios',
                        reason: 'Switch to direct plans for lower costs',
                        impact: 'Save ₹5,000-15,000 annually in fees'
                      },
                      {
                        priority: 4,
                        action: 'Set up SIP for regular investing',
                        reason: 'Systematic investing reduces timing risk',
                        impact: 'Average returns improve by 2-3% over lumpsum'
                      }
                    ].map((rec, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          rec.priority === 1 ? 'bg-red-500 text-white' :
                          rec.priority === 2 ? 'bg-amber-500 text-white' :
                          'bg-blue-500 text-white'
                        }`}>
                          {rec.priority}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{rec.action}</p>
                          <p className="text-xs text-muted-foreground mt-1">{rec.reason}</p>
                          <p className="text-xs text-green-600 mt-1">{rec.impact}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Goal Projection Visualization */}
            {proposalSections.goalGapAnalysis && analysis && analysis.totalValue > 0 && (
              <Card className="mt-4 border-purple-200 dark:border-purple-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-purple-600" />
                    Portfolio Growth Projection
                  </CardTitle>
                  <CardDescription>
                    Expected growth based on {riskProfile.primaryGoal?.replace('_', ' ')} goal and {riskProfile.riskTolerance} risk tolerance
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const totalValue = analysis.totalValue;
                    const horizonMap: Record<string, number> = {
                      '3_months': 0.25,
                      '6_months': 0.5,
                      '9_months': 0.75,
                      '1_year': 1,
                      'short_term': 3,
                      'medium_term': 5,
                      'long_term': 10
                    };
                    const horizonYears = horizonMap[riskProfile.investmentHorizon] || 5;
                    const riskReturns = {
                      conservative: { expected: 8, low: 5, high: 10 },
                      moderate: { expected: 12, low: 8, high: 15 },
                      aggressive: { expected: 15, low: 10, high: 20 },
                      very_aggressive: { expected: 18, low: 12, high: 25 }
                    };
                    const returns = riskReturns[riskProfile.riskTolerance] || riskReturns.moderate;
                    const projections = {
                      conservative: totalValue * Math.pow(1 + returns.low / 100, horizonYears),
                      expected: totalValue * Math.pow(1 + returns.expected / 100, horizonYears),
                      optimistic: totalValue * Math.pow(1 + returns.high / 100, horizonYears)
                    };
                    const maxProjection = projections.optimistic;
                    
                    return (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-muted-foreground">
                            Investment Horizon: {horizonYears < 1 ? `${Math.round(horizonYears * 12)} months` : `${horizonYears} year${horizonYears > 1 ? 's' : ''}`}
                          </span>
                          <span className="font-medium">Current: {formatCurrency(totalValue)}</span>
                        </div>
                        
                        {/* Projection Bars */}
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded-full bg-amber-500" />
                                Conservative ({returns.low}% p.a.)
                              </span>
                              <span className="font-semibold">{formatCurrency(projections.conservative)}</span>
                            </div>
                            <div className="h-3 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-amber-500 rounded-full transition-all"
                                style={{ width: `${(projections.conservative / maxProjection) * 100}%` }}
                              />
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded-full bg-blue-500" />
                                Expected ({returns.expected}% p.a.)
                              </span>
                              <span className="font-semibold text-blue-600">{formatCurrency(projections.expected)}</span>
                            </div>
                            <div className="h-3 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-blue-500 rounded-full transition-all"
                                style={{ width: `${(projections.expected / maxProjection) * 100}%` }}
                              />
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded-full bg-green-500" />
                                Optimistic ({returns.high}% p.a.)
                              </span>
                              <span className="font-semibold text-green-600">{formatCurrency(projections.optimistic)}</span>
                            </div>
                            <div className="h-3 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-green-500 rounded-full transition-all"
                                style={{ width: `100%` }}
                              />
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-3 p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-xs text-purple-700 dark:text-purple-300">
                          <Info className="h-3 w-3 inline mr-1" />
                          Projections are estimates based on historical returns and do not guarantee future performance.
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            )}
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setCurrentStep(4)} data-testid="back-to-portfolio-btn">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button 
              onClick={() => setCurrentStep(6)}
              data-testid="to-categories-btn"
            >
              <PieChart className="h-4 w-4 mr-2" /> Product Categories
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 6: Product Category Selection */}
      {currentStep === 6 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><LayoutGrid className="h-5 w-5" /> Product Category Selection</CardTitle>
            <CardDescription>Choose how to select product categories for {prospectData.name}'s portfolio</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Mode Selection */}
            <div className="grid md:grid-cols-2 gap-4">
              <div 
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  categorySelectionMode === 'ai_default' 
                    ? 'border-primary bg-primary/5' 
                    : 'border-muted hover:border-muted-foreground/50'
                }`}
                onClick={() => {
                  setCategorySelectionMode('ai_default');
                  applyAIDefaultAllocation();
                }}
                data-testid="mode-ai-default"
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${categorySelectionMode === 'ai_default' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    <Wand2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">AI Default Allocation</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Let AI automatically select product categories and allocation percentages based on the client's {riskProfile.riskTolerance} risk profile.
                    </p>
                  </div>
                </div>
              </div>
              
              <div 
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  categorySelectionMode === 'manual' 
                    ? 'border-primary bg-primary/5' 
                    : 'border-muted hover:border-muted-foreground/50'
                }`}
                onClick={() => {
                  setCategorySelectionMode('manual');
                  // When switching to manual mode, clear all selections so user starts fresh
                  setSelectedCategories([]);
                  // Reset all allocations to zero
                  setCustomAllocations({
                    equity: 0, debt: 0, hybrid: 0, gold: 0, silver: 0, index: 0,
                    international: 0, reit: 0, invit: 0, bonds: 0, mld: 0,
                    listed_stocks: 0, unlisted_stocks: 0, pms: 0, aif: 0, global_advisory: 0,
                    us_markets: 0, europe_markets: 0, asia_pacific_markets: 0, emerging_markets: 0
                  });
                }}
                data-testid="mode-manual"
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${categorySelectionMode === 'manual' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    <Settings2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Manual Selection</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Manually select which product categories to include and calibrate allocation percentages on the next step.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Default Mode Summary */}
            {categorySelectionMode === 'ai_default' && (
              <div className="p-4 bg-muted/30 rounded-lg space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h3 className="font-medium">AI-Selected Categories & Allocations</h3>
                  <Badge variant="secondary" className="ml-auto">{riskProfile.riskTolerance} profile</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Based on the client's risk profile, AI has selected the following categories and allocations:
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {getAIDefaultCategories(riskProfile.riskTolerance).map(catId => {
                    const category = PRODUCT_CATEGORY_OPTIONS.find(c => c.id === catId);
                    const allocationKey = catId === 'gold_fof' ? 'gold' : catId === 'index_fund' ? 'index' : catId;
                    const allocation = customAllocations[allocationKey as keyof typeof customAllocations] || 0;
                    return (
                      <div key={catId} className="flex items-center justify-between p-2 bg-background rounded border">
                        <span className="text-sm">{category?.label || catId}</span>
                        <Badge variant="outline">{allocation}%</Badge>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 pt-2 border-t">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-muted-foreground">
                    Total: {Object.values(customAllocations).reduce((a, b) => a + b, 0)}% allocated
                  </span>
                </div>
              </div>
            )}

            {/* Manual Selection Mode */}
            {categorySelectionMode === 'manual' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Select Product Categories</h3>
                    <p className="text-sm text-muted-foreground">Choose which categories to include in the proposal</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Select all eligible categories and compute allocations
                        const eligibleCategories = PRODUCT_CATEGORY_OPTIONS
                          .filter(c => !c.minInvestment || totalPortfolioValue >= c.minInvestment)
                          .map(c => c.id);
                        setSelectedCategories(eligibleCategories);
                        const newAllocations = computeAllocationsForSelectedCategories(
                          eligibleCategories,
                          riskProfile.riskTolerance as keyof typeof DEFAULT_ALLOCATIONS
                        );
                        setCustomAllocations(newAllocations);
                      }}
                      data-testid="select-all-categories-btn"
                    >
                      Select All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedCategories([]);
                        setCustomAllocations({
                          equity: 0, debt: 0, hybrid: 0, gold: 0, silver: 0, index: 0,
                          international: 0, reit: 0, invit: 0, bonds: 0, mld: 0,
                          listed_stocks: 0, unlisted_stocks: 0, pms: 0, aif: 0, global_advisory: 0,
                          us_markets: 0, europe_markets: 0, asia_pacific_markets: 0, emerging_markets: 0
                        });
                      }}
                      data-testid="clear-all-categories-btn"
                    >
                      Clear All
                    </Button>
                    <Badge variant="outline">{selectedCategories.length} selected</Badge>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  {PRODUCT_CATEGORY_OPTIONS.map(category => {
                    const isSelected = selectedCategories.includes(category.id);
                    const isEligible = !category.minInvestment || totalPortfolioValue >= category.minInvestment;
                    
                    return (
                      <div 
                        key={category.id}
                        className={`p-3 border rounded-lg transition-colors ${
                          !isEligible 
                            ? 'opacity-50 cursor-not-allowed bg-muted/30' 
                            : isSelected 
                              ? 'border-primary bg-primary/5 cursor-pointer' 
                              : 'hover:bg-muted/50 cursor-pointer'
                        }`}
                        onClick={() => isEligible && handleCategoryToggle(category.id, !isSelected)}
                        data-testid={`category-select-${category.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox 
                            checked={isSelected}
                            onCheckedChange={(checked) => isEligible && handleCategoryToggle(category.id, !!checked)}
                            disabled={!isEligible}
                            className="mt-0.5"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm">{category.label}</p>
                              {category.requiresEnhancedKYC && (
                                <Badge variant="outline" className="text-xs">Enhanced KYC</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{category.description}</p>
                            {category.minInvestment && !isEligible && (
                              <p className="text-xs text-amber-600 mt-1">Min {formatCurrency(category.minInvestment)} required</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {selectedCategories.length === 0 && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-center">
                    <AlertCircle className="h-5 w-5 text-amber-600 mx-auto mb-2" />
                    <p className="text-sm text-amber-700 dark:text-amber-400">Please select at least one category to proceed</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setCurrentStep(5)} data-testid="back-to-analysis-btn">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button 
              onClick={() => setCurrentStep(7)}
              disabled={categorySelectionMode === 'manual' && selectedCategories.length === 0}
              data-testid="to-allocation-btn"
            >
              {categorySelectionMode === 'ai_default' ? (
                <>
                  <Check className="h-4 w-4 mr-2" /> Confirm & Continue
                </>
              ) : (
                <>
                  <Settings2 className="h-4 w-4 mr-2" /> Configure Allocations
                </>
              )}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 7: Asset Allocation */}
      {currentStep === 7 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5" /> Asset Allocation</CardTitle>
            <CardDescription>
              {categorySelectionMode === 'ai_default' 
                ? `Review AI-recommended allocations for ${prospectData.name}` 
                : `Calibrate allocation percentages for selected categories`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Target Asset Allocation</h3>
                <p className="text-sm text-muted-foreground">Adjust allocation percentages based on client needs</p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleUseDefaultAllocations}
                data-testid="use-default-allocations-btn"
              >
                <RefreshCw className="h-4 w-4 mr-2" /> Use Default Allocations
              </Button>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                {[
                  { key: 'equity', label: 'Equity', color: 'bg-blue-500' },
                  { key: 'debt', label: 'Debt', color: 'bg-green-500' },
                  { key: 'hybrid', label: 'Hybrid', color: 'bg-purple-500' },
                  { key: 'gold', label: 'Gold', color: 'bg-yellow-500' },
                  { key: 'silver', label: 'Silver', color: 'bg-gray-400' },
                  { key: 'index', label: 'Index', color: 'bg-indigo-500' },
                  { key: 'international', label: 'International', color: 'bg-cyan-500' },
                  { key: 'reit', label: 'REITs', color: 'bg-orange-500' },
                  { key: 'invit', label: 'InvITs', color: 'bg-teal-500' },
                  { key: 'bonds', label: 'Bonds/NCDs', color: 'bg-emerald-600' },
                  { key: 'mld', label: 'MLDs', color: 'bg-pink-500' },
                  { key: 'listed_stocks', label: 'Listed Stocks', color: 'bg-sky-500' },
                  { key: 'unlisted_stocks', label: 'Unlisted Stocks', color: 'bg-amber-600', requiresEnhancedKYC: true },
                  { key: 'pms', label: 'PMS', color: 'bg-violet-600', minInvestment: 5000000 },
                  { key: 'aif', label: 'AIF', color: 'bg-rose-600', minInvestment: 10000000 },
                  { key: 'global_advisory', label: 'Global Advisory', color: 'bg-blue-700', requiresEnhancedKYC: true }
                ].filter(({ key }) => isAllocationKeySelected(key)).map(({ key, label, color, minInvestment, requiresEnhancedKYC }) => {
                  const isEligible = !minInvestment || totalPortfolioValue >= minInvestment;
                  const eligibilityMessage = minInvestment && !isEligible 
                    ? `Requires min ${formatCurrency(minInvestment)} portfolio`
                    : undefined;
                  
                  return (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className={`flex items-center gap-2 ${!isEligible ? 'text-muted-foreground' : ''}`}>
                        <div className={`w-3 h-3 rounded-full ${color} ${!isEligible ? 'opacity-40' : ''}`}></div>
                        {label}
                        {!isEligible && (
                          <span className="text-xs text-amber-600 ml-1" title={eligibilityMessage}>
                            (Ineligible)
                          </span>
                        )}
                      </Label>
                      <span className="text-sm font-medium w-12 text-right">
                        {customAllocations[key as keyof typeof customAllocations]}%
                      </span>
                    </div>
                    <Slider
                      value={[customAllocations[key as keyof typeof customAllocations]]}
                      onValueChange={([value]) => {
                        if (isEligible) {
                          setCustomAllocations(prev => ({ ...prev, [key]: value }));
                        }
                      }}
                      max={100}
                      step={5}
                      disabled={!isEligible}
                      className={`w-full ${!isEligible ? 'opacity-50 cursor-not-allowed' : ''}`}
                      data-testid={`slider-${key}`}
                    />
                    {eligibilityMessage && (
                      <p className="text-xs text-amber-600">{eligibilityMessage}</p>
                    )}
                  </div>
                  );
                })}
                
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Total Allocation</span>
                    <span className={`font-bold ${
                      Object.values(customAllocations).reduce((a, b) => a + b, 0) === 100 
                        ? 'text-green-600' 
                        : 'text-amber-600'
                    }`}>
                      {Object.values(customAllocations).reduce((a, b) => a + b, 0)}%
                    </span>
                  </div>
                  {Object.values(customAllocations).reduce((a, b) => a + b, 0) !== 100 && (
                    <p className="text-xs text-amber-600 mt-1">
                      Allocation should sum to 100%. Currently {Object.values(customAllocations).reduce((a, b) => a + b, 0) > 100 ? 'over' : 'under'} by{' '}
                      {Math.abs(Object.values(customAllocations).reduce((a, b) => a + b, 0) - 100)}%
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-muted/30 rounded-lg max-h-[350px] overflow-y-auto">
                  <h4 className="text-sm font-medium mb-3">Allocation Breakdown</h4>
                  <div className="space-y-2">
                    {[
                      { key: 'equity', label: 'Equity', color: 'bg-blue-500' },
                      { key: 'debt', label: 'Debt', color: 'bg-green-500' },
                      { key: 'hybrid', label: 'Hybrid', color: 'bg-purple-500' },
                      { key: 'gold', label: 'Gold', color: 'bg-yellow-500' },
                      { key: 'silver', label: 'Silver', color: 'bg-gray-400' },
                      { key: 'index', label: 'Index', color: 'bg-indigo-500' },
                      { key: 'international', label: 'International', color: 'bg-cyan-500' },
                      { key: 'reit', label: 'REITs', color: 'bg-orange-500' },
                      { key: 'invit', label: 'InvITs', color: 'bg-teal-500' },
                      { key: 'bonds', label: 'Bonds', color: 'bg-emerald-600' },
                      { key: 'mld', label: 'MLDs', color: 'bg-pink-500' },
                      { key: 'listed_stocks', label: 'Listed Stocks', color: 'bg-sky-500' },
                      { key: 'unlisted_stocks', label: 'Unlisted Stocks', color: 'bg-amber-600' },
                      { key: 'pms', label: 'PMS', color: 'bg-violet-600' },
                      { key: 'aif', label: 'AIF', color: 'bg-rose-600' },
                      { key: 'global_advisory', label: 'Global Advisory', color: 'bg-blue-700' }
                    ].filter(({ key }) => isAllocationKeySelected(key)).map(({ key, label, color }) => {
                      const value = customAllocations[key as keyof typeof customAllocations];
                      if (value === 0) return null;
                      return (
                        <div key={key} className="flex items-center gap-2">
                          <div className={`h-4 rounded ${color}`} style={{ width: `${Math.max(value * 2, 8)}px` }}></div>
                          <span className="text-sm">{label}: {value}%</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 flex h-8 rounded-lg overflow-hidden">
                    {[
                      { key: 'equity', color: 'bg-blue-500' },
                      { key: 'debt', color: 'bg-green-500' },
                      { key: 'hybrid', color: 'bg-purple-500' },
                      { key: 'gold', color: 'bg-yellow-500' },
                      { key: 'silver', color: 'bg-gray-400' },
                      { key: 'index', color: 'bg-indigo-500' },
                      { key: 'international', color: 'bg-cyan-500' },
                      { key: 'reit', color: 'bg-orange-500' },
                      { key: 'invit', color: 'bg-teal-500' },
                      { key: 'bonds', color: 'bg-emerald-600' },
                      { key: 'mld', color: 'bg-pink-500' },
                      { key: 'listed_stocks', color: 'bg-sky-500' },
                      { key: 'unlisted_stocks', color: 'bg-amber-600' },
                      { key: 'pms', color: 'bg-violet-600' },
                      { key: 'aif', color: 'bg-rose-600' },
                      { key: 'global_advisory', color: 'bg-blue-700' }
                    ].filter(({ key }) => isAllocationKeySelected(key)).map(({ key, color }) => {
                      const value = customAllocations[key as keyof typeof customAllocations];
                      if (value === 0) return null;
                      return (
                        <div 
                          key={key} 
                          className={`${color} transition-all duration-300`} 
                          style={{ width: `${value}%` }}
                          title={`${key}: ${value}%`}
                        />
                      );
                    })}
                  </div>
                </div>

                <div className="p-4 bg-muted/30 rounded-lg">
                  <h4 className="text-sm font-medium mb-3">Default for {riskProfile.riskTolerance.replace('_', ' ')} Profile</h4>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    {Object.entries(DEFAULT_ALLOCATIONS[riskProfile.riskTolerance]).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="capitalize text-muted-foreground">{key}:</span>
                        <span className="font-medium">{value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div>
                <h3 className="font-medium">Product Categories</h3>
                <p className="text-sm text-muted-foreground">Select which product categories to include in recommendations</p>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                {PRODUCT_CATEGORY_OPTIONS.map(category => (
                  <div 
                    key={category.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedCategories.includes(category.id) 
                        ? 'border-primary bg-primary/5' 
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => handleCategoryToggle(category.id, !selectedCategories.includes(category.id))}
                    data-testid={`category-${category.id}`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox 
                        checked={selectedCategories.includes(category.id)}
                        onCheckedChange={(checked) => handleCategoryToggle(category.id, !!checked)}
                        className="mt-0.5"
                      />
                      <div>
                        <p className="font-medium text-sm">{category.label}</p>
                        <p className="text-xs text-muted-foreground">{category.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Separator className="my-6" />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Global Advisory (LRS)
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      International investments via Liberalised Remittance Scheme ($250K annual limit)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasGlobalAdvisorySelections && (
                      <Badge variant="secondary" className="text-xs">
                        {Object.keys(globalAdvisorySelections).length} market(s) selected
                      </Badge>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowGlobalAdvisory(!showGlobalAdvisory)}
                      data-testid="toggle-global-advisory"
                    >
                      {showGlobalAdvisory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {showGlobalAdvisory && (
                  <div className="space-y-4 p-4 border rounded-lg bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        <span>Enhanced KYC required for global investments</span>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={selectAllGlobalMarkets} data-testid="select-all-global">
                          Select All
                        </Button>
                        <Button variant="ghost" size="sm" onClick={clearAllGlobalMarkets} data-testid="clear-all-global">
                          Clear All
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-3">
                      {GLOBAL_MARKET_OPTIONS.map(market => {
                        const selectedInstruments = globalAdvisorySelections[market.id] || [];
                        const isExpanded = selectedInstruments.length > 0;
                        
                        return (
                          <div 
                            key={market.id} 
                            className={`border rounded-lg transition-all ${
                              isExpanded ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                            }`}
                          >
                            <div 
                              className="p-3 flex items-center justify-between cursor-pointer"
                              onClick={() => toggleAllInstrumentsForMarket(market.id)}
                              data-testid={`market-${market.id}`}
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-2xl">{market.flag}</span>
                                <div>
                                  <p className="font-medium text-sm">{market.label}</p>
                                  <p className="text-xs text-muted-foreground">{market.description}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {selectedInstruments.length > 0 && (
                                  <Badge variant="secondary" className="text-xs">
                                    {selectedInstruments.length} instrument(s)
                                  </Badge>
                                )}
                                <Checkbox 
                                  checked={selectedInstruments.length === GLOBAL_INSTRUMENT_OPTIONS.length}
                                  className="pointer-events-none"
                                />
                              </div>
                            </div>
                            
                            {isExpanded && (
                              <div className="px-3 pb-3 pt-0">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 ml-11">
                                  {GLOBAL_INSTRUMENT_OPTIONS.map(instrument => (
                                    <div
                                      key={instrument.id}
                                      className={`p-2 border rounded text-center cursor-pointer transition-colors text-sm ${
                                        selectedInstruments.includes(instrument.id)
                                          ? 'border-primary bg-primary/10 text-primary'
                                          : 'hover:bg-muted/50'
                                      }`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleGlobalMarketInstrument(market.id, instrument.id);
                                      }}
                                      data-testid={`instrument-${market.id}-${instrument.id}`}
                                    >
                                      <Checkbox 
                                        checked={selectedInstruments.includes(instrument.id)}
                                        className="mr-1 pointer-events-none"
                                      />
                                      {instrument.label}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {hasGlobalAdvisorySelections && (
                      <div className="space-y-3">
                        <div className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-lg border border-green-200 dark:border-green-800">
                          <Label className="text-sm font-medium text-green-800 dark:text-green-200 mb-2 block">
                            Global Investment Budget (₹)
                          </Label>
                          <div className="flex items-center gap-3">
                            <Input
                              type="number"
                              placeholder={`Auto: ₹${Math.round(freshInvestmentAmount * (customAllocations.global_advisory / 100)).toLocaleString()}`}
                              value={globalAdvisoryBudget || ''}
                              onChange={(e) => setGlobalAdvisoryBudget(Number(e.target.value) || 0)}
                              className="max-w-[200px] bg-white dark:bg-gray-800"
                              data-testid="global-advisory-budget"
                            />
                            <span className="text-xs text-muted-foreground">
                              {globalAdvisoryBudget > 0 
                                ? `Manual: ₹${globalAdvisoryBudget.toLocaleString()}`
                                : `Auto-calculated from ${customAllocations.global_advisory}% of fresh investment`
                              }
                            </span>
                          </div>
                          <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                            Budget used for LRS limit compliance calculation (~${Math.round(effectiveGlobalBudget / 84).toLocaleString()} USD)
                          </p>
                        </div>
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                          <div className="flex items-start gap-2">
                            <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                            <div className="text-sm text-blue-800 dark:text-blue-200">
                              <p className="font-medium">LRS Compliance Notice</p>
                              <p className="text-xs mt-1">
                                Annual limit: $250,000 per financial year. Investments via authorized AD banks.
                                DTAA tax benefits apply based on country. FATCA/CRS reporting required.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {selectedCategories.length === 0 && !hasGlobalAdvisorySelections && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-sm text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 inline mr-2" />
                  Please select at least one product category for recommendations
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setCurrentStep(6)} data-testid="back-to-categories-btn">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button 
              onClick={() => setCurrentStep(8)}
              data-testid="to-whatif-btn"
            >
              <TrendingDown className="h-4 w-4 mr-2" /> What-If Analysis
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 8: What-If Analysis */}
      {currentStep === 8 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingDown className="h-5 w-5 text-violet-600" /> What-If Analysis</CardTitle>
            <CardDescription>Simulate different market scenarios to understand portfolio impact</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="border-red-200 dark:border-red-800">
                <CardContent className="pt-4">
                  <h4 className="font-medium text-red-600 mb-2">Market Crash (-20%)</h4>
                  <p className="text-sm text-muted-foreground mb-3">Simulates a significant market downturn</p>
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="text-sm text-muted-foreground">Portfolio Impact</p>
                    <p className="text-xl font-bold text-red-600">
                      -{formatCurrency((analysis?.totalValue || 0) * 0.20)}
                    </p>
                    <p className="text-xs text-muted-foreground">New Value: {formatCurrency((analysis?.totalValue || 0) * 0.80)}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-amber-200 dark:border-amber-800">
                <CardContent className="pt-4">
                  <h4 className="font-medium text-amber-600 mb-2">Interest Rate +2%</h4>
                  <p className="text-sm text-muted-foreground mb-3">Impact on debt instruments</p>
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                    <p className="text-sm text-muted-foreground">Bond Portfolio Impact</p>
                    <p className="text-xl font-bold text-amber-600">
                      -{((analysis?.assetAllocation?.debt?.percentage || 0) * 0.05).toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">Duration-adjusted decline</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-green-200 dark:border-green-800">
                <CardContent className="pt-4">
                  <h4 className="font-medium text-green-600 mb-2">Bull Market (+30%)</h4>
                  <p className="text-sm text-muted-foreground mb-3">Strong equity market performance</p>
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-sm text-muted-foreground">Portfolio Impact</p>
                    <p className="text-xl font-bold text-green-600">
                      +{formatCurrency((analysis?.totalValue || 0) * 0.30 * ((analysis?.assetAllocation?.equity?.percentage || 50) / 100))}
                    </p>
                    <p className="text-xs text-muted-foreground">Based on equity allocation</p>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="p-4 bg-violet-50 dark:bg-violet-900/20 rounded-lg">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-violet-600" />
                Risk Assessment
              </h4>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Maximum Drawdown Potential</p>
                  <p className="font-semibold">{formatCurrency((analysis?.totalValue || 0) * 0.25)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Recovery Time (Historical)</p>
                  <p className="font-semibold">18-24 months</p>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setCurrentStep(7)} data-testid="back-to-allocation-btn">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button 
              onClick={() => getRebalancingMutation.mutate()}
              disabled={
                getRebalancingMutation.isPending || 
                (selectedCategories.length === 0 && !hasGlobalAdvisorySelections) ||
                (selectedCategories.length > 0 && Object.values(customAllocations).reduce((a, b) => a + b, 0) !== 100)
              }
              data-testid="get-rebalancing-btn"
            >
              {getRebalancingMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Scale className="h-4 w-4 mr-2" /> Get Rebalancing
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 9: Rebalancing Recommendations */}
      {currentStep === 9 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Scale className="h-5 w-5" /> Rebalancing Recommendations</CardTitle>
            <CardDescription>AI-suggested portfolio adjustments based on {riskProfile.riskTolerance} risk profile</CardDescription>
          </CardHeader>
          <CardContent>
            {(!rebalancing || rebalancing.length === 0) ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                <p className="font-medium">Portfolio is well-balanced!</p>
                <p>No immediate rebalancing needed.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rebalancing.map((rec, idx) => (
                  <Card key={idx} className={`${
                    rec.action === 'SELL' ? 'border-l-4 border-l-red-500' :
                    rec.action === 'BUY' ? 'border-l-4 border-l-green-500' :
                    'border-l-4 border-l-amber-500'
                  }`}>
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={rec.action === 'SELL' ? 'destructive' : rec.action === 'BUY' ? 'default' : 'secondary'}>
                            {rec.action}
                          </Badge>
                          <span className="font-medium">{rec.productName}</span>
                          <Badge variant="outline">{rec.priority}</Badge>
                          {rec.isOverridden && rec.override && (
                            <AdvisorModifiedBadge override={{
                              ...rec.override,
                              overrideCategory: rec.override.overrideCategory as 'client_preference' | 'market_outlook' | 'risk_adjustment' | 'tax_optimization' | 'other'
                            }} />
                          )}
                        </div>
                        <span className={`font-bold ${rec.changeAmount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {rec.changeAmount < 0 ? '-' : '+'}{formatCurrency(Math.abs(rec.changeAmount))}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{rec.rationale}</p>
                      {rec.isOverridden && rec.override && (
                        <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-md text-xs">
                          <div className="flex items-center gap-1 text-amber-700 dark:text-amber-300">
                            <User className="h-3 w-3" />
                            <span className="font-medium">Override Reason:</span>
                            <span>{rec.override.overrideReason}</span>
                          </div>
                        </div>
                      )}
                      {rec.taxImplications && typeof rec.taxImplications === 'object' && (
                        <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-md text-xs space-y-1">
                          <div className="flex items-center gap-1 text-amber-700 dark:text-amber-300 font-medium">
                            <AlertTriangle className="h-3 w-3" />
                            Tax Implications
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-amber-800 dark:text-amber-200">
                            <div>
                              <span className="text-amber-600 dark:text-amber-400">Type:</span>{' '}
                              {rec.taxImplications.taxType === 'SLAB' 
                                ? 'Slab Rate (30%)'
                                : rec.taxImplications.taxType}
                              {rec.taxImplications.isSlabBased && (
                                <span className="ml-1 text-amber-500">(no LTCG benefit)</span>
                              )}
                            </div>
                            <div>
                              <span className="text-amber-600 dark:text-amber-400">Est. Gain:</span>{' '}
                              <span className={rec.taxImplications.estimatedGain >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {rec.taxImplications.estimatedGain >= 0 ? '+' : ''}{formatCurrency(rec.taxImplications.estimatedGain)}
                              </span>
                            </div>
                            <div>
                              <span className="text-amber-600 dark:text-amber-400">Est. Tax:</span>{' '}
                              {formatCurrency(rec.taxImplications.estimatedTax || 0)}
                            </div>
                            {(rec.taxImplications.exitLoad ?? 0) > 0 && (
                              <div>
                                <span className="text-amber-600 dark:text-amber-400">Exit Load:</span>{' '}
                                {formatCurrency(rec.taxImplications.exitLoad ?? 0)}
                              </div>
                            )}
                          </div>
                          {(rec.taxImplications.grandfatheringBenefit ?? 0) > 0 && (
                            <div className="text-green-600 dark:text-green-400">
                              Grandfathering Benefit: {formatCurrency(rec.taxImplications.grandfatheringBenefit ?? 0)} (pre-2018 holding)
                            </div>
                          )}
                          {(rec.taxImplications.alerts?.length ?? 0) > 0 && rec.taxImplications.alerts && (
                            <div className="space-y-1">
                              {rec.taxImplications.alerts.map((alert: any, aIdx: number) => (
                                <div key={aIdx} className={`flex items-start gap-1 ${
                                  alert.type === 'warning' ? 'text-red-600' : 
                                  alert.type === 'opportunity' ? 'text-blue-600' : 'text-amber-600'
                                }`}>
                                  {alert.type === 'warning' ? <AlertTriangle className="h-3 w-3 mt-0.5" /> : 
                                   alert.type === 'opportunity' ? <Lightbulb className="h-3 w-3 mt-0.5" /> : 
                                   <Info className="h-3 w-3 mt-0.5" />}
                                  <span>{alert.message}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {rec.taxImplications && typeof rec.taxImplications === 'string' && (
                        <p className="text-xs text-amber-600 mt-1">Tax Note: {rec.taxImplications}</p>
                      )}
                      {proposal && !proposal.lockedAt && (
                        <div className="mt-2 pt-2 border-t border-dashed flex justify-end group">
                          <AdvisorOverrideSystem
                            recommendation={{
                              productName: rec.productName,
                              action: rec.action as 'BUY' | 'SELL' | 'HOLD' | 'SWITCH',
                              changeAmount: rec.changeAmount,
                              category: rec.productType,
                              isOverridden: rec.isOverridden,
                              override: rec.override ? {
                                ...rec.override,
                                overrideCategory: rec.override.overrideCategory as 'client_preference' | 'market_outlook' | 'risk_adjustment' | 'tax_optimization' | 'other'
                              } : undefined
                            }}
                            proposalId={proposal.proposalId}
                            agentName={proposal.agentName || 'Advisor'}
                            onOverrideComplete={(updated) => {
                              const newRebalancing = [...rebalancing];
                              newRebalancing[idx] = { 
                                ...newRebalancing[idx], 
                                ...updated,
                                action: (updated.action || newRebalancing[idx].action) as 'BUY' | 'SELL' | 'HOLD' | 'SWITCH'
                              };
                              setRebalancing(newRebalancing);
                            }}
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
                
                {/* Comprehensive Tax Summary */}
                {taxSummary && (
                  <Card className="mt-4 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2 text-amber-800 dark:text-amber-200">
                        <Calculator className="h-5 w-5" />
                        Tax Impact Summary ({taxSummary.currentFY})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Tax Breakdown */}
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        <div className="p-2 bg-white dark:bg-gray-800 rounded-lg">
                          <p className="text-xs text-muted-foreground">Short-Term Gains</p>
                          <p className="font-semibold text-amber-700 dark:text-amber-300">{formatCurrency(taxSummary.totalSTCG)}</p>
                          <p className="text-xs text-muted-foreground">Tax: {formatCurrency(taxSummary.stcgTax)}</p>
                        </div>
                        <div className="p-2 bg-white dark:bg-gray-800 rounded-lg">
                          <p className="text-xs text-muted-foreground">Long-Term Gains</p>
                          <p className="font-semibold text-amber-700 dark:text-amber-300">{formatCurrency(taxSummary.totalLTCG)}</p>
                          <p className="text-xs text-muted-foreground">Tax: {formatCurrency(taxSummary.ltcgTax)}</p>
                        </div>
                        {taxSummary.totalSlabGains > 0 && (
                          <div className="p-2 bg-white dark:bg-gray-800 rounded-lg border border-orange-200 dark:border-orange-700">
                            <p className="text-xs text-muted-foreground">Debt Fund Gains</p>
                            <p className="font-semibold text-orange-600 dark:text-orange-400">{formatCurrency(taxSummary.totalSlabGains)}</p>
                            <p className="text-xs text-muted-foreground">Tax (30%): {formatCurrency(taxSummary.slabTax)}</p>
                          </div>
                        )}
                        <div className="p-2 bg-white dark:bg-gray-800 rounded-lg">
                          <p className="text-xs text-muted-foreground">H&E Cess (4%)</p>
                          <p className="font-semibold text-purple-600 dark:text-purple-400">{formatCurrency(taxSummary.cess || 0)}</p>
                        </div>
                        <div className="p-2 bg-white dark:bg-gray-800 rounded-lg">
                          <p className="text-xs text-muted-foreground">Exit Loads</p>
                          <p className="font-semibold text-red-600">{formatCurrency(taxSummary.totalExitLoad)}</p>
                        </div>
                        <div className="p-2 bg-white dark:bg-gray-800 rounded-lg border-2 border-amber-300">
                          <p className="text-xs text-muted-foreground">Net Rebalancing Cost</p>
                          <p className="font-bold text-lg text-amber-800 dark:text-amber-200">{formatCurrency(taxSummary.netRebalancingCost)}</p>
                          <p className="text-xs text-muted-foreground">(Tax + Cess + Exit Load)</p>
                        </div>
                      </div>

                      {/* Tax Loss Harvesting & Benefits */}
                      {(taxSummary.taxLossHarvestingOpportunity > 0 || taxSummary.grandfatheringBenefitTotal > 0) && (
                        <div className="flex flex-wrap gap-3">
                          {taxSummary.taxLossHarvestingOpportunity > 0 && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                              <Lightbulb className="h-4 w-4 text-blue-600" />
                              <span className="text-sm text-blue-700 dark:text-blue-300">
                                Tax Loss Offset: {formatCurrency(taxSummary.taxLossHarvestingOpportunity)}
                              </span>
                            </div>
                          )}
                          {taxSummary.grandfatheringBenefitTotal > 0 && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-green-100 dark:bg-green-900/30 rounded-full">
                              <Shield className="h-4 w-4 text-green-600" />
                              <span className="text-sm text-green-700 dark:text-green-300">
                                Grandfathering Benefit: {formatCurrency(taxSummary.grandfatheringBenefitTotal)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Alerts */}
                      {taxSummary.alerts?.length > 0 && (
                        <div className="space-y-2">
                          {taxSummary.alerts.map((alert: any, idx: number) => (
                            <div key={idx} className={`flex items-start gap-2 p-2 rounded-lg ${
                              alert.type === 'warning' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' : 
                              alert.type === 'opportunity' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 
                              'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                            }`}>
                              {alert.type === 'warning' ? <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" /> : 
                               alert.type === 'opportunity' ? <Lightbulb className="h-4 w-4 mt-0.5 flex-shrink-0" /> : 
                               <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />}
                              <span className="text-sm">{alert.message}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Disclosure */}
                      {taxSummary.disclosure && (
                        <div className="text-xs text-muted-foreground bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg border">
                          <p className="font-medium mb-1">Tax Calculation Disclosure:</p>
                          <p>{taxSummary.disclosure}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setCurrentStep(8)} data-testid="back-to-whatif-btn">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button 
              onClick={() => setCurrentStep(10)}
              data-testid="to-rebalancing-cost-btn"
            >
              <Calculator className="h-4 w-4 mr-2" /> Rebalancing Cost
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 10: Rebalancing Cost */}
      {currentStep === 10 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5 text-orange-600" /> Rebalancing Cost</CardTitle>
            <CardDescription>Capital gains tax and exit load charges for recommended rebalancing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {taxSummary ? (
              <>
                <div className="grid md:grid-cols-5 gap-4">
                  <Card className="border-red-200">
                    <CardContent className="pt-4 text-center">
                      <p className="text-xs text-muted-foreground">Short-Term Gains</p>
                      <p className="text-xl font-bold text-red-600">{formatCurrency(taxSummary.totalSTCG ?? 0)}</p>
                      <p className="text-xs text-muted-foreground">Tax (@20%): {formatCurrency(taxSummary.stcgTax ?? 0)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-amber-200">
                    <CardContent className="pt-4 text-center">
                      <p className="text-xs text-muted-foreground">Long-Term Gains</p>
                      <p className="text-xl font-bold text-amber-600">{formatCurrency(taxSummary.totalLTCG ?? 0)}</p>
                      <p className="text-xs text-muted-foreground">Tax (@12.5%): {formatCurrency(taxSummary.ltcgTax ?? 0)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-purple-200">
                    <CardContent className="pt-4 text-center">
                      <p className="text-xs text-muted-foreground">H&E Cess (4%)</p>
                      <p className="text-xl font-bold text-purple-600">{formatCurrency(taxSummary.cess ?? 0)}</p>
                      <p className="text-xs text-muted-foreground">on total tax</p>
                    </CardContent>
                  </Card>
                  <Card className="border-blue-200">
                    <CardContent className="pt-4 text-center">
                      <p className="text-xs text-muted-foreground">Exit Loads</p>
                      <p className="text-xl font-bold text-blue-600">{formatCurrency(taxSummary.totalExitLoad ?? 0)}</p>
                      <p className="text-xs text-muted-foreground">if sold today</p>
                    </CardContent>
                  </Card>
                  <Card className="border-2 border-amber-300">
                    <CardContent className="pt-4 text-center">
                      <p className="text-xs text-muted-foreground">Net Rebalancing Cost</p>
                      <p className="text-xl font-bold text-amber-700">{formatCurrency(taxSummary.netRebalancingCost ?? 0)}</p>
                      <p className="text-xs text-muted-foreground">(Tax + Cess + Exit Load)</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Grandfathering Benefit */}
                {(taxSummary.grandfatheringBenefitTotal ?? 0) > 0 && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center gap-2">
                    <Shield className="h-5 w-5 text-green-600" />
                    <span className="text-sm text-green-700 dark:text-green-300">
                      Grandfathering benefit applied: {formatCurrency(taxSummary.grandfatheringBenefitTotal)} saved on pre-2018 holdings
                    </span>
                  </div>
                )}

                {/* Tax-Loss Harvesting */}
                {(taxSummary.taxLossHarvestingOpportunity ?? 0) > 0 && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-blue-600" />
                    <span className="text-sm text-blue-700 dark:text-blue-300">
                      Tax-Loss Harvesting Opportunity: {formatCurrency(taxSummary.taxLossHarvestingOpportunity)} in unrealized losses available to offset gains
                    </span>
                  </div>
                )}

                {/* Alerts */}
                {taxSummary.alerts?.length > 0 && (
                  <div className="space-y-2">
                    {taxSummary.alerts.map((alert: any, idx: number) => (
                      <div key={idx} className={`flex items-start gap-2 p-2 rounded-lg ${
                        alert.type === 'warning' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' : 
                        alert.type === 'opportunity' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 
                        'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                      }`}>
                        {alert.type === 'warning' ? <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" /> : 
                         alert.type === 'opportunity' ? <Lightbulb className="h-4 w-4 mt-0.5 flex-shrink-0" /> : 
                         <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />}
                        <span className="text-sm">{alert.message}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Disclosure */}
                {taxSummary.disclosure && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs text-muted-foreground">
                    <p className="font-medium mb-1">Tax Calculation Disclosure:</p>
                    <p>{taxSummary.disclosure}</p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No rebalancing recommendations available.</p>
                <p className="text-sm">Go back to Step 9 to generate rebalancing recommendations first.</p>
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setCurrentStep(9)} data-testid="back-to-rebalancing-btn">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button 
              onClick={() => getFreshInvestmentsMutation.mutate()}
              disabled={getFreshInvestmentsMutation.isPending}
              data-testid="get-fresh-investments-btn"
            >
              {getFreshInvestmentsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <TrendingUp className="h-4 w-4 mr-2" /> Fresh Investment Ideas
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 11: Fresh Investment Suggestions */}
      {currentStep === 11 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Fresh Investment Suggestions</CardTitle>
            <CardDescription>
              AI-curated opportunities for {freshInvestmentAmount > 0 ? formatCurrency(freshInvestmentAmount) : 'optimal allocation'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {freshInvestments.map((inv, idx) => (
                <Card key={idx} className="border-l-4 border-l-primary">
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-medium">{inv.productName}</span>
                        <Badge variant="outline" className="ml-2">{PRODUCT_TYPES.find(t => t.value === inv.productType)?.label}</Badge>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary">{formatCurrency(inv.suggestedAmount)}</p>
                        <p className="text-xs text-muted-foreground">Match: {inv.matchScore}%</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm mb-2">
                      <span className="flex items-center gap-1">
                        <Percent className="h-4 w-4" /> {inv.expectedReturn}
                      </span>
                      <Badge variant={inv.riskLevel === 'low' ? 'secondary' : inv.riskLevel === 'high' ? 'destructive' : 'outline'}>
                        {inv.riskLevel} risk
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{inv.rationale}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
          
          {/* Readiness Checklist */}
          {readinessData?.readiness && (
            <div className="px-6 pb-4">
              <div className={`rounded-lg border p-4 ${
                readinessData.readiness.isReady 
                  ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950'
                  : 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950'
              }`}>
                <div className="flex items-start gap-3">
                  {readinessData.readiness.isReady ? (
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <h4 className={`font-semibold mb-2 ${
                      readinessData.readiness.isReady 
                        ? 'text-green-800 dark:text-green-200' 
                        : 'text-blue-800 dark:text-blue-200'
                    }`}>
                      {readinessData.readiness.isReady ? 'Ready to Generate Proposal' : 'Proposal Status'}
                    </h4>
                    {!readinessData.readiness.isReady && (
                      <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                        Holdings imported - you can generate a proposal now. Missing details can be completed by the client later.
                      </p>
                    )}
                    <div className="space-y-2">
                      {readinessData.readiness.completedSteps.map((step, idx) => (
                        <div key={`complete-${idx}`} className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                          <CheckCircle className="h-4 w-4" />
                          <span>{step}</span>
                        </div>
                      ))}
                      {readinessData.readiness.missingSteps.map((step, idx) => (
                        <div key={`missing-${idx}`} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>{step} <span className="text-xs italic">(client can complete later)</span></span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setCurrentStep(10)} data-testid="back-to-rebalancing-cost-btn">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button 
              onClick={() => setCurrentStep(12)}
              data-testid="to-sip-btn"
            >
              <RefreshCcw className="h-4 w-4 mr-2" /> SIP Planning
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 12: SIP Planning */}
      {currentStep === 12 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><RefreshCcw className="h-5 w-5 text-blue-600" /> SIP Planning</CardTitle>
            <CardDescription>Configure systematic investment plan based on goals and risk profile</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-medium">Recommended Monthly SIP</h4>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-3xl font-bold text-blue-600">{formatCurrency(investmentGoals.reduce((sum, g) => sum + (g.targetAmount / (g.timelineYears * 12)), 0) || 25000)}</p>
                  <p className="text-sm text-muted-foreground">Based on goals & timeline</p>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm">Equity Funds SIP</span>
                    <span className="font-semibold">{formatCurrency((investmentGoals.reduce((sum, g) => sum + (g.targetAmount / (g.timelineYears * 12)), 0) || 25000) * 0.6)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm">Debt Funds SIP</span>
                    <span className="font-semibold">{formatCurrency((investmentGoals.reduce((sum, g) => sum + (g.targetAmount / (g.timelineYears * 12)), 0) || 25000) * 0.3)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm">Gold/Hybrid SIP</span>
                    <span className="font-semibold">{formatCurrency((investmentGoals.reduce((sum, g) => sum + (g.targetAmount / (g.timelineYears * 12)), 0) || 25000) * 0.1)}</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="font-medium">SIP Schedule</h4>
                <div className="space-y-2">
                  <div className="p-3 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Preferred SIP Date</span>
                    </div>
                    <select className="w-full p-2 border rounded-md bg-background">
                      <option value="1">1st of every month</option>
                      <option value="5">5th of every month</option>
                      <option value="10">10th of every month</option>
                      <option value="15">15th of every month</option>
                    </select>
                  </div>
                  
                  <div className="p-3 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Step-Up SIP</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">Increase SIP by 10% annually</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Enable Step-Up</span>
                      <input type="checkbox" className="toggle" defaultChecked />
                    </div>
                  </div>
                </div>
                
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <h5 className="font-medium text-green-700 dark:text-green-300 mb-2">Projected Growth</h5>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">5 Years</p>
                      <p className="font-semibold">{formatCurrency((investmentGoals.reduce((sum, g) => sum + (g.targetAmount / (g.timelineYears * 12)), 0) || 25000) * 60 * 1.5)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">10 Years</p>
                      <p className="font-semibold">{formatCurrency((investmentGoals.reduce((sum, g) => sum + (g.targetAmount / (g.timelineYears * 12)), 0) || 25000) * 120 * 2.2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">15 Years</p>
                      <p className="font-semibold">{formatCurrency((investmentGoals.reduce((sum, g) => sum + (g.targetAmount / (g.timelineYears * 12)), 0) || 25000) * 180 * 3.5)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* AI SIP Recommendations */}
            {sipRecommendations.length > 0 && (
              <div className="mt-6 p-4 border border-cyan-200 dark:border-cyan-800 rounded-lg bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20">
                <div className="flex items-center gap-2 mb-3">
                  <ArrowUpCircle className="h-5 w-5 text-cyan-600" />
                  <h4 className="font-semibold text-cyan-700 dark:text-cyan-300">AI SIP Recommendations</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-4">Suggested SIP portfolio based on {riskProfile.riskTolerance} risk profile</p>
                <div className="space-y-3">
                  {sipRecommendations.map((sip, idx) => (
                    <div key={idx} className="p-3 bg-white dark:bg-gray-800 rounded-lg border">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{sip.fundName}</span>
                        <Badge variant="outline" className="text-cyan-600 border-cyan-300">{formatCurrency(sip.suggestedAmount)}/mo</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{sip.category}</span>
                        <span className="text-green-600 font-medium">~{sip.expectedReturn}% returns</span>
                        <Badge variant="secondary" className="text-xs">{sip.riskLevel}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{sip.rationale}</p>
                    </div>
                  ))}
                </div>
                <p className="text-sm font-medium text-cyan-700 dark:text-cyan-300 mt-4 text-center">
                  Total Recommended SIP: {formatCurrency(sipRecommendations.reduce((sum, s) => sum + s.suggestedAmount, 0))}/month
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setCurrentStep(11)} data-testid="back-to-fresh-invest-btn">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button onClick={() => setCurrentStep(13)} data-testid="to-recommended-whatif-btn">
              <TrendingUp className="h-4 w-4 mr-2" /> Recommended Portfolio Analysis
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 13: What-If Analysis (Recommended Portfolio) */}
      {currentStep === 13 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-emerald-600" /> Recommended Portfolio Projection</CardTitle>
            <CardDescription>What-if analysis of the recommended portfolio (rebalancing + SIP + existing holdings)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20">
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Current Portfolio</p>
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(analysis?.totalValue || 0)}</p>
                </CardContent>
              </Card>
              <Card className="border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">After Rebalancing</p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                    {formatCurrency((analysis?.totalValue || 0) - (rebalancing?.filter(r => r.action === 'SELL').reduce((sum, r) => sum + Math.abs(r.changeAmount), 0) || 0) + (rebalancing?.filter(r => r.action === 'BUY').reduce((sum, r) => sum + r.changeAmount, 0) || 0))}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Monthly SIP Addition</p>
                  <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                    {formatCurrency(sipRecommendations?.reduce((sum, s) => sum + s.suggestedAmount, 0) || 0)}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-amber-200 dark:border-amber-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-amber-600" />
                  5-Year Projection
                </CardTitle>
                <CardDescription>Projected portfolio value based on expected returns</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">1 Year</p>
                    <p className="text-lg font-bold text-amber-700 dark:text-amber-300">
                      {formatCurrency(((analysis?.totalValue || 0) * 1.12) + ((sipRecommendations?.reduce((sum, s) => sum + s.suggestedAmount, 0) || 0) * 12))}
                    </p>
                  </div>
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">3 Years</p>
                    <p className="text-lg font-bold text-amber-700 dark:text-amber-300">
                      {formatCurrency(((analysis?.totalValue || 0) * 1.4) + ((sipRecommendations?.reduce((sum, s) => sum + s.suggestedAmount, 0) || 0) * 36 * 1.15))}
                    </p>
                  </div>
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">5 Years</p>
                    <p className="text-lg font-bold text-amber-700 dark:text-amber-300">
                      {formatCurrency(((analysis?.totalValue || 0) * 1.76) + ((sipRecommendations?.reduce((sum, s) => sum + s.suggestedAmount, 0) || 0) * 60 * 1.25))}
                    </p>
                  </div>
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">10 Years</p>
                    <p className="text-lg font-bold text-green-700 dark:text-green-300">
                      {formatCurrency(((analysis?.totalValue || 0) * 3.1) + ((sipRecommendations?.reduce((sum, s) => sum + s.suggestedAmount, 0) || 0) * 120 * 1.65))}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center mt-3">*Based on assumed 12% annual returns for equity-oriented portfolio</p>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-4">
              <Card className="border-green-200 dark:border-green-800">
                <CardContent className="pt-4">
                  <h4 className="font-medium text-green-600 mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Bull Scenario (+30%)
                  </h4>
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-sm text-muted-foreground">5-Year Value</p>
                    <p className="text-xl font-bold text-green-600">
                      {formatCurrency(((analysis?.totalValue || 0) * 2.3) + ((sipRecommendations?.reduce((sum, s) => sum + s.suggestedAmount, 0) || 0) * 60 * 1.6))}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-red-200 dark:border-red-800">
                <CardContent className="pt-4">
                  <h4 className="font-medium text-red-600 mb-3 flex items-center gap-2">
                    <TrendingDown className="h-4 w-4" />
                    Bear Scenario (-15%)
                  </h4>
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="text-sm text-muted-foreground">5-Year Value</p>
                    <p className="text-xl font-bold text-red-600">
                      {formatCurrency(((analysis?.totalValue || 0) * 1.3) + ((sipRecommendations?.reduce((sum, s) => sum + s.suggestedAmount, 0) || 0) * 60 * 0.95))}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-600" />
                Portfolio Composition After Implementation
              </h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Holdings to Keep (HOLD)</p>
                  <p className="font-semibold">{rebalancing?.filter(r => r.action === 'HOLD').length || holdings.length} instruments</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Holdings to Sell</p>
                  <p className="font-semibold text-red-600">{rebalancing?.filter(r => r.action === 'SELL').length || 0} instruments</p>
                </div>
                <div>
                  <p className="text-muted-foreground">New Investments</p>
                  <p className="font-semibold text-green-600">{(rebalancing?.filter(r => r.action === 'BUY').length || 0) + (sipRecommendations?.length || 0)} instruments</p>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setCurrentStep(12)} data-testid="back-to-sip-btn">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button onClick={() => setCurrentStep(14)} data-testid="to-proposal-sections-btn">
              <FileCheck className="h-4 w-4 mr-2" /> Proposal Sections
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 14: Proposal Section Selection */}
      {currentStep === 14 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-indigo-600" />
              Proposal Sections
            </CardTitle>
            <CardDescription>
              Select which analytics sections to include in {prospectData.name}'s proposal report
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {[
                { key: 'exitLoadCalendar', label: 'Exit Load Calendar', icon: Clock },
                { key: 'capitalGainsSummary', label: 'Capital Gains Summary', icon: Calculator },
                { key: 'portfolioHealthScore', label: 'Portfolio Health Score', icon: Activity },
                { key: 'expenseRatioAnalysis', label: 'Expense Ratio Analysis', icon: Percent },
                { key: 'dividendProjection', label: 'Dividend Projection', icon: Wallet },
                { key: 'riskHeatmap', label: 'Risk Heatmap', icon: AlertTriangle },
                { key: 'goalGapAnalysis', label: 'Goal Gap Analysis', icon: Target },
                { key: 'benchmarkComparison', label: 'Benchmark Comparison', icon: BarChart3 },
                { key: 'priorityRecommendations', label: 'Priority Actions', icon: ListChecks },
                { key: 'sipRecommendations', label: 'SIP Recommendations', icon: ArrowUpCircle },
                { key: 'whatIfSimulator', label: 'What-If Simulator', icon: TrendingDown },
                { key: 'executiveSummary', label: 'Executive Summary', icon: FileText }
              ].map(({ key, label, icon: Icon }) => (
                <label 
                  key={key} 
                  className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                    proposalSections[key as keyof typeof proposalSections]
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700'
                      : 'bg-muted/30 border-muted hover:bg-muted/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={proposalSections[key as keyof typeof proposalSections]}
                    onChange={(e) => setProposalSections(prev => ({ ...prev, [key]: e.target.checked }))}
                    className="sr-only"
                  />
                  <Icon className={`h-4 w-4 ${proposalSections[key as keyof typeof proposalSections] ? 'text-indigo-600' : 'text-muted-foreground'}`} />
                  <span className={`text-sm font-medium ${proposalSections[key as keyof typeof proposalSections] ? 'text-indigo-700 dark:text-indigo-300' : 'text-muted-foreground'}`}>
                    {label}
                  </span>
                  {proposalSections[key as keyof typeof proposalSections] && (
                    <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />
                  )}
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-indigo-600" />
                <span className="font-medium">{Object.values(proposalSections).filter(Boolean).length} of 12 sections selected</span>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setProposalSections({
                    exitLoadCalendar: true, capitalGainsSummary: true, portfolioHealthScore: true,
                    expenseRatioAnalysis: true, dividendProjection: true, riskHeatmap: true,
                    goalGapAnalysis: true, benchmarkComparison: true, priorityRecommendations: true,
                    sipRecommendations: true, whatIfSimulator: true, executiveSummary: true
                  })}
                >
                  Select All
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setProposalSections({
                    exitLoadCalendar: false, capitalGainsSummary: false, portfolioHealthScore: false,
                    expenseRatioAnalysis: false, dividendProjection: false, riskHeatmap: false,
                    goalGapAnalysis: false, benchmarkComparison: false, priorityRecommendations: false,
                    sipRecommendations: false, whatIfSimulator: false, executiveSummary: false
                  })}
                >
                  Clear All
                </Button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setCurrentStep(13)} data-testid="back-to-recommended-whatif-btn">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button 
              onClick={() => setCurrentStep(15)}
              data-testid="to-review-btn"
            >
              <ClipboardCheck className="h-4 w-4 mr-2" /> Review Summary
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 15: Review Summary */}
      {currentStep === 15 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-green-600" /> Review Summary</CardTitle>
            <CardDescription>Review all recommendations before generating proposal</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Client Overview */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <UserCheck className="h-4 w-4" /> Client Profile
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium">{prospectData.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Risk Profile</span>
                    <Badge variant="outline">{riskProfile.riskTolerance || 'Moderate'}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Investment Horizon</span>
                    <span>{riskProfile.investmentHorizon || '5-10 years'}</span>
                  </div>
                </CardContent>
              </Card>
              
              {/* Portfolio Overview */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Wallet className="h-4 w-4" /> Portfolio Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current Value</span>
                    <span className="font-bold">{formatCurrency(analysis?.totalValue || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Holdings</span>
                    <span>{holdings.length} instruments</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Asset Classes</span>
                    <span>{Object.keys(analysis?.assetAllocation || {}).length}</span>
                  </div>
                </CardContent>
              </Card>
              
              {/* Goals Summary */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Target className="h-4 w-4" /> Goals
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  {investmentGoals.length > 0 ? (
                    <div className="space-y-2">
                      {investmentGoals.slice(0, 3).map((goal, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span className="text-muted-foreground">{goal.goalName}</span>
                          <span>{formatCurrency(goal.targetAmount)}</span>
                        </div>
                      ))}
                      {investmentGoals.length > 3 && (
                        <p className="text-xs text-muted-foreground">+{investmentGoals.length - 3} more goals</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No goals configured</p>
                  )}
                </CardContent>
              </Card>
              
              {/* Recommendations Summary */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="h-4 w-4" /> Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rebalancing Actions</span>
                    <span>{rebalancing.length} changes</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fresh Investments</span>
                    <span>{freshInvestments.length} suggestions</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Est. Tax Liability</span>
                    <span>{formatCurrency(capitalGainsData?.totalTaxLiability || 0)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <h4 className="font-medium text-green-700 dark:text-green-300 mb-2 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" /> Ready to Generate Proposal
              </h4>
              <p className="text-sm text-green-600 dark:text-green-400">
                All required information has been collected. Click "Generate Proposal" to create a comprehensive investment proposal PDF.
              </p>
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setCurrentStep(14)} data-testid="back-to-sections-btn">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button 
              onClick={() => generateProposalMutation.mutate()}
              disabled={generateProposalMutation.isPending || !readinessData?.readiness?.completedSteps?.includes('Holdings Imported')}
              data-testid="generate-proposal-btn"
              title={!readinessData?.readiness?.completedSteps?.includes('Holdings Imported') ? 'Import holdings to generate proposal' : ''}
            >
              {generateProposalMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Sparkles className="h-4 w-4 mr-2" /> Generate Proposal
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 16: Proposal Ready / Share */}
      {currentStep === 16 && proposal && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-500" /> Proposal Ready!</CardTitle>
                <CardDescription>Investment proposal for {prospectData.name}</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline"
                  onClick={generateProposalPDF}
                  disabled={isGeneratingPdf}
                  data-testid="download-pdf-btn"
                >
                  {isGeneratingPdf ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Download PDF
                </Button>
                <Button onClick={() => setShowShareDialog(true)} data-testid="share-proposal-btn">
                  <Share2 className="h-4 w-4 mr-2" /> Share with Client
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
              <CardContent className="py-4">
                <p className="text-sm font-medium mb-2">Executive Summary</p>
                <p className="text-muted-foreground">{proposal.executiveSummary}</p>
              </CardContent>
            </Card>

            {(proposal.proposalVersion !== undefined && proposal.proposalVersion >= 1) && (
              <ProposalVersionTimeline
                currentProposalId={proposal.proposalId}
                proposalVersion={proposal.proposalVersion}
                parentProposalId={proposal.parentProposalId || null}
                isLatestVersion={proposal.isLatestVersion ?? true}
                lockedAt={proposal.lockedAt || null}
              />
            )}

            <div className="grid md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-xs text-muted-foreground">Total Sell</p>
                  <p className="text-xl font-bold text-red-600">{formatCurrency(proposal.totalSellAmount)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-xs text-muted-foreground">Total Buy</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(proposal.totalBuyAmount)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-xs text-muted-foreground">Net Investment</p>
                  <p className="text-xl font-bold">{formatCurrency(proposal.netInvestmentRequired)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-xs text-muted-foreground">Projected Value</p>
                  <p className="text-xl font-bold text-primary">{formatCurrency(proposal.projectedValue)}</p>
                  <p className="text-xs text-muted-foreground">{proposal.projectedReturn}</p>
                </CardContent>
              </Card>
            </div>

            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <span className="text-sm">Share Link:</span>
              <code className="flex-1 text-sm bg-background px-2 py-1 rounded">
                {`${window.location.origin}/proposal/${proposal.shareToken}`}
              </code>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/proposal/${proposal.shareToken}`);
                  toast({ title: "Copied!", description: "Link copied to clipboard" });
                }}
                data-testid="copy-share-link-btn"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setCurrentStep(15)} data-testid="back-to-review-btn">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button variant="outline" onClick={() => window.open(`/proposal/${proposal.shareToken}`, '_blank')} data-testid="preview-proposal-btn">
              <ExternalLink className="h-4 w-4 mr-2" /> Preview Proposal
            </Button>
          </CardFooter>
        </Card>
      )}

      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Proposal</DialogTitle>
            <DialogDescription>Choose how you want to share this proposal with {prospectData.name}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-4 py-4">
            <Button 
              variant="outline" 
              className="flex flex-col h-24 gap-2"
              onClick={() => shareProposalMutation.mutate('email')}
              disabled={shareProposalMutation.isPending}
              data-testid="share-email-btn"
            >
              <Mail className="h-8 w-8" />
              <span>Email</span>
            </Button>
            <Button 
              variant="outline" 
              className="flex flex-col h-24 gap-2"
              onClick={() => shareProposalMutation.mutate('whatsapp')}
              disabled={shareProposalMutation.isPending}
              data-testid="share-whatsapp-btn"
            >
              <MessageSquare className="h-8 w-8" />
              <span>WhatsApp</span>
            </Button>
            <Button 
              variant="outline" 
              className="flex flex-col h-24 gap-2"
              onClick={() => {
                if (proposal) {
                  navigator.clipboard.writeText(`${window.location.origin}/proposal/${proposal.shareToken}`);
                  toast({ title: "Link Copied", description: "Share link copied to clipboard" });
                  setShowShareDialog(false);
                }
              }}
              data-testid="copy-link-btn"
            >
              <Copy className="h-8 w-8" />
              <span>Copy Link</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showZohoImportDialog} onOpenChange={(open) => {
        setShowZohoImportDialog(open);
        if (!open) setSelectedAgentForImport("");
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Import from Zoho CRM
            </DialogTitle>
            <DialogDescription>
              Import leads or contacts from your connected Zoho CRM account
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Agent Assignment Dropdown */}
            {teamAgentsData?.agents && teamAgentsData.agents.length > 1 && (
              <div className="space-y-2">
                <Label htmlFor="assign-agent">Assign to Agent</Label>
                <Select value={selectedAgentForImport} onValueChange={setSelectedAgentForImport}>
                  <SelectTrigger id="assign-agent" data-testid="zoho-agent-select">
                    <SelectValue placeholder="Assign to myself (default)" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamAgentsData.agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name} {agent.isMaster ? "(Me)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choose which team member to assign the imported leads/contacts to
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="flex flex-col h-24 gap-2"
                onClick={() => importZohoLeadsMutation.mutate({ 
                  limit: 50, 
                  skipExisting: true, 
                  assignToAgentId: selectedAgentForImport || undefined 
                })}
                disabled={importZohoLeadsMutation.isPending || importZohoContactsMutation.isPending}
                data-testid="import-zoho-leads-btn"
              >
                {importZohoLeadsMutation.isPending ? (
                  <Loader2 className="h-8 w-8 animate-spin" />
                ) : (
                  <Users className="h-8 w-8" />
                )}
                <span>Import Leads</span>
              </Button>
              <Button
                variant="outline"
                className="flex flex-col h-24 gap-2"
                onClick={() => importZohoContactsMutation.mutate({ 
                  limit: 50, 
                  skipExisting: true, 
                  assignToAgentId: selectedAgentForImport || undefined 
                })}
                disabled={importZohoLeadsMutation.isPending || importZohoContactsMutation.isPending}
                data-testid="import-zoho-contacts-btn"
              >
                {importZohoContactsMutation.isPending ? (
                  <Loader2 className="h-8 w-8 animate-spin" />
                ) : (
                  <User className="h-8 w-8" />
                )}
                <span>Import Contacts</span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Existing duplicates will be automatically skipped. Imports up to 50 records at a time.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowZohoImportDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Holdings Dialog */}
      <Dialog open={showEditHoldingsDialog} onOpenChange={setShowEditHoldingsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Holdings</DialogTitle>
            <DialogDescription>
              Review and edit purchase dates, folio numbers, and other details for accurate exit load and capital gains calculations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Fund Name</TableHead>
                    <TableHead className="w-32">Folio Number</TableHead>
                    <TableHead className="w-36">Purchase Date</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                    <TableHead className="text-right">Avg Price</TableHead>
                    <TableHead className="text-right">Current Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {editableHoldings.map((holding, idx) => (
                    <TableRow key={holding.id || idx}>
                      <TableCell>
                        <div className="max-w-[200px]">
                          <div className="font-medium text-sm truncate">{holding.name}</div>
                          {holding.isin && <div className="text-xs text-muted-foreground">{holding.isin}</div>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="text"
                          value={holding.folioNumber || ''}
                          onChange={(e) => {
                            const updated = [...editableHoldings];
                            updated[idx] = { ...updated[idx], folioNumber: e.target.value };
                            setEditableHoldings(updated);
                          }}
                          placeholder="Folio #"
                          className="h-8 w-28"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={holding.purchaseDate || ''}
                          onChange={(e) => {
                            const updated = [...editableHoldings];
                            updated[idx] = { ...updated[idx], purchaseDate: e.target.value };
                            setEditableHoldings(updated);
                          }}
                          className="h-8 w-36"
                        />
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {holding.quantity.toFixed(3)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(holding.avgPrice)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(holding.currentValue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditHoldingsDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                try {
                  let successCount = 0;
                  let failCount = 0;
                  const totalCount = editableHoldings.filter(h => h.id).length;
                  
                  for (const holding of editableHoldings) {
                    if (holding.id) {
                      try {
                        const res = await fetch(`/api/ai/portfolio/update/${holding.id}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({
                            folioNumber: holding.folioNumber || null,
                            purchaseDate: holding.purchaseDate || null,
                          }),
                        });
                        if (res.ok) {
                          successCount++;
                        } else {
                          failCount++;
                        }
                      } catch {
                        failCount++;
                      }
                    }
                  }
                  
                  if (failCount === 0 && successCount > 0) {
                    toast({
                      title: 'Holdings Updated',
                      description: `Updated ${successCount} holdings successfully.`,
                    });
                    setShowEditHoldingsDialog(false);
                  } else if (successCount > 0 && failCount > 0) {
                    toast({
                      title: 'Partial Update',
                      description: `Updated ${successCount} of ${totalCount} holdings. ${failCount} failed.`,
                      variant: 'destructive',
                    });
                  } else if (failCount > 0 && successCount === 0) {
                    toast({
                      title: 'Update Failed',
                      description: `Failed to update ${failCount} holdings. Please try again.`,
                      variant: 'destructive',
                    });
                  } else {
                    toast({
                      title: 'No Changes',
                      description: 'No holdings to update.',
                    });
                    setShowEditHoldingsDialog(false);
                  }
                } catch (err) {
                  console.error('Failed to update holdings:', err);
                  toast({
                    title: 'Update Failed',
                    description: 'An unexpected error occurred. Please try again.',
                    variant: 'destructive',
                  });
                }
              }}
            >
              <Save className="h-4 w-4 mr-1" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
