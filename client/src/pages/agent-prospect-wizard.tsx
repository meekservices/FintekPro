import { useState, useEffect } from "react";
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
  Pencil, RotateCcw, Save, X
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import jsPDF from "jspdf";

interface PortfolioHolding {
  productType: string;
  productName: string;
  quantity: number;
  currentValue: number;
  purchasePrice?: number;
  purchaseDate?: string;
  isin?: string;
  category?: string;
}

interface RiskProfile {
  riskTolerance: 'conservative' | 'moderate' | 'aggressive' | 'very_aggressive';
  investmentHorizon: 'short_term' | 'medium_term' | 'long_term';
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

interface RebalanceRecommendation {
  action: 'BUY' | 'SELL' | 'HOLD' | 'SWITCH';
  productType: string;
  productName: string;
  currentValue?: number;
  suggestedValue?: number;
  changeAmount: number;
  switchAmount?: number; // For SWITCH actions - the actual value being switched
  rationale: string;
  priority: 'high' | 'medium' | 'low';
  taxImplications?: string;
  targetFund?: {
    name: string;
    amc: string;
    category: string;
    returns1Y: string;
    returns3Y: string;
    risk: string;
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
  conservative: { equity: 18, debt: 32, hybrid: 15, gold: 8, silver: 0, index: 5, international: 2, reit: 5, invit: 5, bonds: 5, mld: 0, listed_stocks: 5, unlisted_stocks: 0, pms: 0, aif: 0, global_advisory: 0 },
  moderate: { equity: 25, debt: 18, hybrid: 10, gold: 7, silver: 0, index: 8, international: 5, reit: 5, invit: 5, bonds: 5, mld: 2, listed_stocks: 8, unlisted_stocks: 2, pms: 0, aif: 0, global_advisory: 0 },
  aggressive: { equity: 30, debt: 6, hybrid: 6, gold: 5, silver: 2, index: 8, international: 5, reit: 5, invit: 5, bonds: 4, mld: 2, listed_stocks: 12, unlisted_stocks: 6, pms: 0, aif: 0, global_advisory: 4 },
  very_aggressive: { equity: 28, debt: 4, hybrid: 4, gold: 4, silver: 2, index: 8, international: 5, reit: 4, invit: 4, bonds: 4, mld: 3, listed_stocks: 15, unlisted_stocks: 10, pms: 0, aif: 0, global_advisory: 5 }
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
  global_advisory: 'global_advisory'
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
  global_advisory: 'global_advisory'
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

  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [newHolding, setNewHolding] = useState<Partial<PortfolioHolding>>({
    productType: "mutual_fund",
    productName: "",
    quantity: 1,
    currentValue: 0
  });
  const [editingHoldingIndex, setEditingHoldingIndex] = useState<number | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [savedHoldingsLoaded, setSavedHoldingsLoaded] = useState(false);

  const [freshInvestmentAmount, setFreshInvestmentAmount] = useState(0);
  const [analysis, setAnalysis] = useState<PortfolioAnalysis | null>(null);
  
  // Asset Allocation & Category Selection State
  const [customAllocations, setCustomAllocations] = useState<{
    equity: number; debt: number; hybrid: number; gold: number; silver: number; index: number;
    international: number; reit: number; invit: number; bonds: number; mld: number; 
    listed_stocks: number; unlisted_stocks: number; pms: number; aif: number; global_advisory: number;
  }>(DEFAULT_ALLOCATIONS.moderate);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    PRODUCT_CATEGORY_OPTIONS.filter(c => c.defaultSelected).map(c => c.id)
  );
  
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
  const [rebalancing, setRebalancing] = useState<RebalanceRecommendation[]>([]);
  const [freshInvestments, setFreshInvestments] = useState<FreshInvestmentSuggestion[]>([]);
  const [proposal, setProposal] = useState<CombinedProposal | null>(null);
  const [prospectId, setProspectId] = useState<string | null>(urlProspectId);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const generateProposalPDF = () => {
    if (!proposal || !analysis) return;
    
    setIsGeneratingPdf(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 20;
      let yPos = 20;

      pdf.setFillColor(79, 70, 229);
      pdf.rect(0, 0, pageWidth, 40, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'bold');
      pdf.text('FintekPro', margin, 25);
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Investment Proposal', pageWidth - margin - 40, 25);
      
      yPos = 55;
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Investment Proposal for ${prospectData.name}`, margin, yPos);
      
      if (proposal.executiveSummary) {
        yPos += 12;
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(100, 100, 100);
        const summaryLines = pdf.splitTextToSize(proposal.executiveSummary, pageWidth - (margin * 2));
        pdf.text(summaryLines, margin, yPos);
        yPos += summaryLines.length * 5 + 10;
      }
      
      yPos += 5;
      pdf.setFillColor(245, 245, 245);
      pdf.rect(margin, yPos, pageWidth - (margin * 2), 35, 'F');
      
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      
      const colWidth = (pageWidth - (margin * 2)) / 4;
      
      pdf.text('Total Sell', margin + 5, yPos + 10);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(220, 38, 38);
      pdf.text(formatCurrency(proposal.totalSellAmount), margin + 5, yPos + 20);
      
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Total Buy', margin + colWidth + 5, yPos + 10);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(34, 197, 94);
      pdf.text(formatCurrency(proposal.totalBuyAmount), margin + colWidth + 5, yPos + 20);
      
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Net Investment', margin + (colWidth * 2) + 5, yPos + 10);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text(formatCurrency(proposal.netInvestmentRequired), margin + (colWidth * 2) + 5, yPos + 20);
      
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Projected Value', margin + (colWidth * 3) + 5, yPos + 10);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(79, 70, 229);
      pdf.text(formatCurrency(proposal.projectedValue), margin + (colWidth * 3) + 5, yPos + 20);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.text(proposal.projectedReturn, margin + (colWidth * 3) + 5, yPos + 28);
      
      yPos += 50;
      
      if (proposal.rebalancing && proposal.rebalancing.length > 0) {
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Rebalancing Recommendations', margin, yPos);
        yPos += 10;
        
        proposal.rebalancing.forEach((rec: any) => {
          // Calculate dynamic height based on content
          const hasTargetFund = rec.action === 'SWITCH' && rec.targetFund;
          const hasRationale = rec.rationale && rec.rationale.length > 0;
          const boxHeight = hasTargetFund ? 45 : hasRationale ? 35 : 25;
          
          if (yPos > 250) {
            pdf.addPage();
            yPos = 20;
          }
          
          pdf.setFillColor(250, 250, 250);
          pdf.rect(margin, yPos, pageWidth - (margin * 2), boxHeight, 'F');
          
          const actionColor = rec.action === 'SELL' ? [220, 38, 38] : rec.action === 'BUY' ? [34, 197, 94] : [245, 158, 11];
          pdf.setFillColor(actionColor[0], actionColor[1], actionColor[2]);
          pdf.rect(margin, yPos, 3, boxHeight, 'F');
          
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(0, 0, 0);
          pdf.text(`${rec.action}: ${rec.productName}`, margin + 8, yPos + 8);
          
          // Show current value on the right
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(100, 100, 100);
          if (rec.currentValue) {
            pdf.text(`Current: ${formatCurrency(rec.currentValue)}`, pageWidth - margin - 40, yPos + 8);
          }
          
          // Show amount change (use switchAmount for SWITCH actions)
          pdf.setTextColor(actionColor[0], actionColor[1], actionColor[2]);
          if (rec.action === 'SWITCH' && rec.switchAmount) {
            pdf.text(`Switch: ${formatCurrency(rec.switchAmount)}`, margin + 8, yPos + 16);
          } else {
            const changeText = rec.changeAmount < 0 ? `-${formatCurrency(Math.abs(rec.changeAmount))}` : `+${formatCurrency(Math.abs(rec.changeAmount))}`;
            pdf.text(changeText, margin + 8, yPos + 16);
          }
          
          // For SWITCH, show target fund
          if (hasTargetFund) {
            pdf.setTextColor(34, 197, 94);
            pdf.setFont('helvetica', 'bold');
            pdf.text(`→ ${rec.targetFund.name}`, margin + 8, yPos + 24);
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8);
            pdf.setTextColor(100, 100, 100);
            pdf.text(`${rec.targetFund.returns3Y}% 3Y returns | ${rec.targetFund.risk} risk`, margin + 8, yPos + 32);
          }
          
          // Show rationale
          if (hasRationale && !hasTargetFund) {
            pdf.setFontSize(8);
            pdf.setTextColor(100, 100, 100);
            const rationaleLines = pdf.splitTextToSize(rec.rationale, pageWidth - (margin * 2) - 16);
            pdf.text(rationaleLines.slice(0, 2), margin + 8, yPos + 24);
          }
          
          yPos += boxHeight + 5;
        });
      }
      
      if (proposal.freshInvestments && proposal.freshInvestments.length > 0) {
        yPos += 5;
        if (yPos > 240) {
          pdf.addPage();
          yPos = 20;
        }
        
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Fresh Investment Suggestions', margin, yPos);
        yPos += 10;
        
        proposal.freshInvestments.forEach((inv: any) => {
          const hasRationale = inv.rationale && inv.rationale.length > 0;
          const boxHeight = hasRationale ? 40 : 28;
          
          if (yPos > 250) {
            pdf.addPage();
            yPos = 20;
          }
          
          pdf.setFillColor(250, 250, 250);
          pdf.rect(margin, yPos, pageWidth - (margin * 2), boxHeight, 'F');
          pdf.setFillColor(79, 70, 229);
          pdf.rect(margin, yPos, 3, boxHeight, 'F');
          
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(0, 0, 0);
          pdf.text(inv.productName, margin + 8, yPos + 8);
          
          // Show amount on right
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(34, 197, 94);
          pdf.text(formatCurrency(inv.suggestedAmount), pageWidth - margin - 30, yPos + 8);
          
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(100, 100, 100);
          const riskColor = inv.riskLevel?.includes('high') ? [220, 38, 38] : inv.riskLevel?.includes('low') ? [34, 197, 94] : [100, 100, 100];
          pdf.text(`Expected: ${inv.expectedReturn} | Risk: ${inv.riskLevel || 'Moderate'} | Match: ${inv.matchScore}%`, margin + 8, yPos + 18);
          
          // Show rationale
          if (hasRationale) {
            pdf.setFontSize(8);
            pdf.setTextColor(120, 120, 120);
            const rationaleLines = pdf.splitTextToSize(inv.rationale, pageWidth - (margin * 2) - 16);
            pdf.text(rationaleLines.slice(0, 2), margin + 8, yPos + 28);
          }
          
          yPos += boxHeight + 5;
        });
      }
      
      const pageCount = pdf.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(
          'This proposal is for informational purposes only. Please consult your financial advisor.',
          margin, 
          pdf.internal.pageSize.getHeight() - 10
        );
        pdf.text(
          `Generated on ${new Date().toLocaleDateString('en-IN')} | Page ${i} of ${pageCount}`,
          pageWidth - margin - 50,
          pdf.internal.pageSize.getHeight() - 10
        );
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
            const data = await response.json();
            if (data.success && data.holdings && data.holdings.length > 0) {
              setHoldings(data.holdings);
              toast({ 
                title: "Portfolio Loaded", 
                description: `${data.holdings.length} saved holdings loaded from previous session` 
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
      const res = await apiRequest("/api/agent-wizard/prospects", {
        method: "POST",
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (!res.ok && result.isDuplicate) {
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
        toast({ title: "Error", description: "Failed to create prospect.", variant: "destructive" });
      }
    }
  });

  const requestMappingMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("/api/agent-wizard/request-mapping", {
        method: "POST",
        body: JSON.stringify(data)
      });
      return res.json();
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

  // Portfolio upload mutation
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
    onSuccess: (data) => {
      if (data.success) {
        setImportResult(data);
        if (data.holdings && data.holdings.length > 0) {
          const mappedHoldings: PortfolioHolding[] = data.holdings.map((h: any) => ({
            productType: h.assetType || 'mutual_fund',
            productName: h.name,
            quantity: h.units || 1,
            currentValue: h.currentValue,
            isin: h.isin,
            category: h.category
          }));
          setHoldings(prev => [...prev, ...mappedHoldings]);
          
          // Show appropriate toast based on whether all funds were imported
          if (data.unimportedCount && data.unimportedCount > 0) {
            toast({ 
              title: "Partial Import - Manual Entry Needed", 
              description: `Imported ${data.importedCount} of ${data.expectedCount} holdings. ${data.unimportedCount} fund(s) need manual entry.`,
              variant: "default"
            });
          } else {
            toast({ 
              title: "Portfolio Imported", 
              description: `Detected ${data.brokerDetected || 'portfolio'}: ${data.holdings.length} holdings imported with ${data.confidenceScore}% confidence.` 
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

  // Portfolio URL import mutation
  const importUrlMutation = useMutation({
    mutationFn: async (url: string) => {
      const res = await apiRequest(`/api/agent/prospects/${prospectId}/portfolio/import-url`, {
        method: 'POST',
        body: JSON.stringify({ portfolioUrl: url })
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setImportResult(data);
        if (data.holdings && data.holdings.length > 0) {
          const mappedHoldings: PortfolioHolding[] = data.holdings.map((h: any) => ({
            productType: h.assetType || 'mutual_fund',
            productName: h.name,
            quantity: h.units || 1,
            currentValue: h.currentValue,
            isin: h.isin,
            category: h.category
          }));
          setHoldings(prev => [...prev, ...mappedHoldings]);
          toast({ 
            title: "Portfolio Imported", 
            description: `${data.holdings.length} holdings imported from ${data.brokerDetected || 'URL'}.` 
          });
        }
      } else {
        toast({ title: "Import Failed", description: data.error || "Could not parse portfolio from URL.", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "URL Import Error", description: "Failed to import from URL.", variant: "destructive" });
    }
  });

  const analyzePortfolioMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/agent-wizard/analyze-portfolio", {
        method: "POST",
        body: JSON.stringify({ holdings, riskProfile })
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        setAnalysis(data.analysis);
        toast({ title: "Analysis Complete", description: "Portfolio analyzed successfully." });
        setCurrentStep(4);
      } else {
        toast({ title: "Analysis Failed", description: data.error || "Could not analyze portfolio.", variant: "destructive" });
      }
    },
    onError: (error) => {
      console.error("Portfolio analysis error:", error);
      toast({ title: "Analysis Error", description: "Failed to analyze portfolio. Please try again.", variant: "destructive" });
    }
  });

  const getRebalancingMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/agent-wizard/rebalancing-suggestions", {
        method: "POST",
        body: JSON.stringify({ holdings, riskProfile, analysis })
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        setRebalancing(data.suggestions);
        setCurrentStep(6);
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
          existingHoldings: holdings 
        })
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        setFreshInvestments(data.suggestions);
        setCurrentStep(7);
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
          globalAdvisoryBudget: hasGlobalAdvisorySelections ? effectiveGlobalBudget : undefined
        })
      });
    },
    onSuccess: async (data) => {
      if (data.success) {
        setProposal(data.proposal);
        toast({ title: "Proposal Generated", description: "Investment proposal ready to share!" });
        setCurrentStep(8);
        
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
      return await apiRequest(`/api/agent-wizard/prospects/${prospectId}/holdings`, {
        method: "POST",
        body: JSON.stringify(holding)
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        setHoldings(data.holdings);
        toast({ title: "Holding Added", description: "Investment saved to portfolio" });
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const updateHoldingMutation = useMutation({
    mutationFn: async ({ index, holding }: { index: number; holding: PortfolioHolding }) => {
      if (!prospectId) throw new Error("No prospect selected");
      return await apiRequest(`/api/agent-wizard/prospects/${prospectId}/holdings/${index}`, {
        method: "PUT",
        body: JSON.stringify(holding)
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        setHoldings(data.holdings);
        setEditingHoldingIndex(null);
        toast({ title: "Holding Updated", description: "Investment updated successfully" });
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const deleteHoldingMutation = useMutation({
    mutationFn: async (index: number) => {
      if (!prospectId) throw new Error("No prospect selected");
      return await apiRequest(`/api/agent-wizard/prospects/${prospectId}/holdings/${index}`, {
        method: "DELETE"
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        setHoldings(data.holdings);
        toast({ title: "Holding Removed", description: "Investment removed from portfolio" });
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
      quantity: holdingToEdit.quantity,
      currentValue: holdingToEdit.currentValue
    });
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
  };

  const cancelEditHolding = () => {
    setEditingHoldingIndex(null);
    setNewHolding({ productType: "mutual_fund", productName: "", quantity: 1, currentValue: 0 });
  };

  const steps = [
    { num: 1, title: "Add Prospect", icon: User },
    { num: 2, title: "Risk Profile", icon: Target },
    { num: 3, title: "Portfolio", icon: PieChart },
    { num: 4, title: "Analysis", icon: Sparkles },
    { num: 5, title: "Allocation", icon: Settings2 },
    { num: 6, title: "Rebalance", icon: Scale },
    { num: 7, title: "Fresh Invest", icon: TrendingUp },
    { num: 8, title: "Share", icon: Share2 }
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
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search by name, email, or PAN..."
                    value={prospectSearch}
                    onChange={(e) => setProspectSearch(e.target.value)}
                    className="pl-10"
                    data-testid="prospect-search-input"
                  />
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
                    <Label>PAN</Label>
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
                className="grid grid-cols-3 gap-3"
              >
                {[
                  { value: 'short_term', label: 'Short Term', desc: '< 3 years' },
                  { value: 'medium_term', label: 'Medium Term', desc: '3-7 years' },
                  { value: 'long_term', label: 'Long Term', desc: '7+ years' }
                ].map(horizon => (
                  <Label 
                    key={horizon.value} 
                    htmlFor={`horizon_${horizon.value}`} 
                    className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors hover:bg-muted ${riskProfile.investmentHorizon === horizon.value ? 'border-primary bg-primary/5' : ''}`}
                    data-testid={`horizon-${horizon.value.replace('_', '-')}`}
                  >
                    <RadioGroupItem value={horizon.value} id={`horizon_${horizon.value}`} />
                    <div className="flex flex-col">
                      <span className="font-medium">{horizon.label}</span>
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
            <Button onClick={() => setCurrentStep(3)} data-testid="continue-to-portfolio-btn">
              Continue to Portfolio <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><PieChart className="h-5 w-5" /> Current Portfolio</CardTitle>
            <CardDescription>Import or manually enter existing investments for analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Import Mode Selection */}
            <div className="flex gap-2 flex-wrap">
              <Button 
                variant={importMode === 'manual' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setImportMode('manual')}
                data-testid="mode-manual-btn"
              >
                <Plus className="h-4 w-4 mr-1" /> Manual Entry
              </Button>
              <Button 
                variant={importMode === 'upload' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setImportMode('upload')}
                data-testid="mode-upload-btn"
              >
                <Upload className="h-4 w-4 mr-1" /> Upload File
              </Button>
              <Button 
                variant={importMode === 'url' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setImportMode('url')}
                data-testid="mode-url-btn"
              >
                <Link className="h-4 w-4 mr-1" /> Import from URL
              </Button>
            </div>

            {/* Upload PDF Section */}
            {importMode === 'upload' && (
              <div className="border-2 border-dashed rounded-lg p-6 text-center bg-muted/20">
                <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-3">
                  Upload a portfolio statement (PDF or HTML) from Zerodha, Groww, ICICI Direct, HDFC Securities, Kotak, Wealthy.in, or other brokers
                </p>
                <input
                  type="file"
                  accept=".pdf,.html,.htm"
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
                  >
                    <span>
                      {uploadPortfolioMutation.isPending ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Parsing...</>
                      ) : (
                        <><Upload className="h-4 w-4 mr-2" /> Choose PDF or HTML File</>
                      )}
                    </span>
                  </Button>
                </label>
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
              <div className="grid md:grid-cols-5 gap-3 items-end">
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
                <div className="space-y-2 md:col-span-2">
                  <Label>Product Name</Label>
                  <Input 
                    placeholder="HDFC Flexi Cap Fund"
                    value={newHolding.productName}
                    onChange={(e) => setNewHolding({ ...newHolding, productName: e.target.value })}
                    data-testid="product-name-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Current Value (₹)</Label>
                  <Input 
                    type="number"
                    placeholder="100000"
                    value={newHolding.currentValue || ''}
                    onChange={(e) => setNewHolding({ ...newHolding, currentValue: parseFloat(e.target.value) || 0 })}
                    data-testid="product-value-input"
                  />
                </div>
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
                    {addHoldingMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />} Add
                  </Button>
                )}
              </div>
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
                      <TableHead className="w-24 text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {holdings.map((holding, idx) => (
                      <TableRow key={idx} className={editingHoldingIndex === idx ? 'bg-amber-50 dark:bg-amber-900/20' : ''}>
                        <TableCell className="font-medium">{holding.productName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{PRODUCT_TYPES.find(t => t.value === holding.productType)?.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(holding.currentValue)}</TableCell>
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
                    ))}
                    <TableRow className="bg-muted/50">
                      <TableCell colSpan={2} className="font-semibold">Total Portfolio Value</TableCell>
                      <TableCell className="text-right font-bold text-lg">{formatCurrency(totalPortfolioValue)}</TableCell>
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
            <Button variant="outline" onClick={() => setCurrentStep(2)} data-testid="back-to-risk-btn">
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

      {currentStep === 4 && analysis && (
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
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setCurrentStep(3)} data-testid="back-to-portfolio-btn">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button 
              onClick={() => setCurrentStep(5)}
              data-testid="to-allocation-btn"
            >
              <Settings2 className="h-4 w-4 mr-2" /> Configure Allocations
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {currentStep === 5 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5" /> Asset Allocation & Category Selection</CardTitle>
            <CardDescription>Customize target allocations and select product categories for {prospectData.name}</CardDescription>
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
                ].map(({ key, label, color, minInvestment, requiresEnhancedKYC }) => {
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
                    ].map(({ key, label, color }) => {
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
                    ].map(({ key, color }) => {
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
            <Button variant="outline" onClick={() => setCurrentStep(4)} data-testid="back-to-analysis-btn">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button 
              onClick={() => getRebalancingMutation.mutate()}
              disabled={getRebalancingMutation.isPending || (selectedCategories.length === 0 && !hasGlobalAdvisorySelections)}
              data-testid="get-rebalancing-btn"
            >
              {getRebalancingMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Scale className="h-4 w-4 mr-2" /> Get Rebalancing Suggestions
            </Button>
          </CardFooter>
        </Card>
      )}

      {currentStep === 6 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Scale className="h-5 w-5" /> Rebalancing Recommendations</CardTitle>
            <CardDescription>AI-suggested portfolio adjustments based on {riskProfile.riskTolerance} risk profile</CardDescription>
          </CardHeader>
          <CardContent>
            {rebalancing.length === 0 ? (
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
                        </div>
                        <span className={`font-bold ${rec.changeAmount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {rec.changeAmount < 0 ? '-' : '+'}{formatCurrency(Math.abs(rec.changeAmount))}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{rec.rationale}</p>
                      {rec.taxImplications && (
                        <p className="text-xs text-amber-600 mt-1">Tax Note: {rec.taxImplications}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setCurrentStep(5)} data-testid="back-to-allocation-btn">
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

      {currentStep === 7 && (
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
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setCurrentStep(6)} data-testid="back-to-rebalance-btn">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button 
              onClick={() => generateProposalMutation.mutate()}
              disabled={generateProposalMutation.isPending}
              data-testid="generate-proposal-btn"
            >
              {generateProposalMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Sparkles className="h-4 w-4 mr-2" /> Generate Proposal
            </Button>
          </CardFooter>
        </Card>
      )}

      {currentStep === 8 && proposal && (
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
            <Button variant="outline" onClick={() => setCurrentStep(7)} data-testid="back-to-fresh-invest-btn">
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
    </div>
  );
}
