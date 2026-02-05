import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  Check,
  Users,
  Target,
  Settings,
  Eye,
  Download,
  Loader2,
  AlertTriangle,
  PieChart,
  TrendingUp,
  BarChart3,
  Shield,
  IndianRupee,
  CheckCircle,
  RefreshCw,
  Save,
  History,
  Briefcase,
  Scale,
  Percent,
  Calendar,
  User,
  Mail,
  Phone,
  Sparkles,
  Plus,
  Send,
  Copy,
  ExternalLink,
  Trash2,
  Clock,
  MessageSquare,
  CheckCircle2,
  Globe,
  Brain,
  GraduationCap,
  Layers
} from "lucide-react";

import SIPSimulatorUI from "@/components/proposal-builder/sip-simulator-ui";
import AdvisorTrainingPanel from "@/components/proposal-builder/advisor-training-panel";
import SEBIAuditExport from "@/components/proposal-builder/sebi-audit-export";

interface Client {
  id: number | string;
  fullName: string;
  email: string;
  phone?: string;
  riskProfile?: string;
  type: 'client' | 'prospect';
}

interface ProspectClient {
  id: string;
  agentId: string;
  name: string;
  email?: string;
  mobile?: string;
  pan?: string;
  clientType: string;
  indicativeRiskProfile?: string;
  state: 'prospect' | 'onboarded' | 'active_client';
}

interface AssetAllocation {
  equity: number;
  debt: number;
  hybrid: number;
  gold: number;
  index: number;
  international: number;
  us_markets: number;
  europe_markets: number;
  asia_pacific_markets: number;
  emerging_markets: number;
  reit: number;
  invit: number;
  bonds: number;
  listed_stocks: number;
  unlisted_stocks: number;
  cash: number;
}

interface ProposalConfig {
  clientId: string;
  investmentGoals: {
    primaryGoal: string;
    investmentHorizon: string;
    targetAmount: number;
    monthlyContribution: number;
  };
  assetAllocation: AssetAllocation;
  selectedCategories: string[];
  riskProfile: {
    score: number;
    category: 'conservative' | 'moderate' | 'aggressive' | 'very_aggressive';
    tolerance: string;
  };
  sections: {
    coverPage: boolean;
    tableOfContents: boolean;
    executiveSummary: boolean;
    portfolioOverview: boolean;
    productRecommendations: boolean;
    capitalGainsSummary: boolean;
    exitLoadSummary: boolean;
    taxImpactSummary: boolean;
    rebalancingSipRecommendations: boolean;
    portfolioHealthScore: boolean;
    expenseRatioAnalysis: boolean;
    riskHeatMap: boolean;
    benchmarkComparison: boolean;
    whatIfScenarios: boolean;
    dividendProjection: boolean;
    priorityRecommendations: boolean;
    portfolioGrowthProjection: boolean;
    mandatoryDisclaimers: boolean;
    advisorDeclaration: boolean;
  };
  sectionCustomizations: {
    [sectionId: string]: {
      customNotes?: string;
      overrideTitle?: string;
      showInToc?: boolean;
      customData?: Record<string, any>;
    };
  };
  coverPage: {
    enabled: boolean;
    title: string;
    clientName: string;
    preparedBy: string;
    date: string;
  };
  settings: {
    orientation: 'portrait' | 'landscape';
    includeDisclaimer: boolean;
    includeSEBIDisclosure: boolean;
  };
}

interface ProspectProposal {
  id: string;
  shareToken: string;
  prospectName: string;
  prospectEmail?: string;
  prospectMobile?: string;
  proposalType: string;
  proposalTitle: string;
  executiveSummary?: string;
  currentAnalysis?: string;
  recommendations?: any[];
  totalInvestmentAmount?: string;
  projectedReturns?: string;
  projectedValue?: string;
  targetAllocation?: Record<string, number>;
  samplePortfolio?: any;
  investmentGoals?: any;
  referralCode?: string;
  viewCount: number;
  status: string;
  createdAt: string;
  validUntil?: string;
  sharedViaEmail?: boolean;
  sharedViaWhatsApp?: boolean;
  firstViewedAt?: string;
  lastViewedAt?: string;
}

interface ProposalStats {
  total: number;
  draft: number;
  shared: number;
  viewed: number;
  converted: number;
  totalViews: number;
}

const PROPOSAL_STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground",
  shared: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  viewed: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  converted: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  expired: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const WIZARD_STEPS = [
  { id: 1, title: 'Select Client', icon: Users, description: 'Choose prospect or client' },
  { id: 2, title: 'Investment Goals', icon: Target, description: 'Define financial objectives' },
  { id: 3, title: 'Asset Allocation', icon: PieChart, description: 'Configure portfolio mix' },
  { id: 4, title: 'Risk Profile', icon: Scale, description: 'Assess risk tolerance' },
  { id: 5, title: 'Portfolio Intelligence', icon: Brain, description: 'Overlap analysis & SIP simulation' },
  { id: 6, title: 'Proposal Sections', icon: FileText, description: 'Select content modules' },
  { id: 7, title: 'Customize Content', icon: Settings, description: 'Add notes & customize sections' },
  { id: 8, title: 'Generate', icon: Download, description: 'Create proposal PDF' },
];

const INVESTMENT_GOALS = [
  { id: 'wealth_creation', name: 'Wealth Creation', description: 'Long-term capital appreciation' },
  { id: 'retirement', name: 'Retirement Planning', description: 'Build retirement corpus' },
  { id: 'child_education', name: 'Child Education', description: 'Fund children\'s higher education' },
  { id: 'home_purchase', name: 'Home Purchase', description: 'Save for property down payment' },
  { id: 'tax_saving', name: 'Tax Saving', description: 'Optimize tax liability' },
  { id: 'regular_income', name: 'Regular Income', description: 'Generate periodic income' },
];

const PROPOSAL_SECTIONS = [
  { id: 'coverPage', name: 'Cover Page', description: 'Professional cover with client details and branding', icon: FileText, category: 'header', required: true },
  { id: 'tableOfContents', name: 'Table of Contents', description: 'Dynamic navigation with page numbers', icon: FileText, category: 'header', required: true },
  { id: 'executiveSummary', name: 'Executive Summary', description: 'High-level proposal overview with key highlights', icon: FileText, category: 'overview' },
  { id: 'portfolioOverview', name: 'Portfolio Overview', description: 'Current holdings snapshot with asset breakdown', icon: Briefcase, category: 'analysis', requiresData: 'holdings' },
  { id: 'productRecommendations', name: 'Product Recommendations', description: 'AI-powered fund/stock recommendations with verdicts', icon: TrendingUp, category: 'recommendations' },
  { id: 'capitalGainsSummary', name: 'Capital Gains Summary', description: 'LTCG/STCG breakdown for sell recommendations', icon: IndianRupee, category: 'tax', requiresData: 'sellVerdicts' },
  { id: 'exitLoadSummary', name: 'Exit Load Summary', description: 'Lock-in periods and exit charges analysis', icon: Clock, category: 'tax', requiresData: 'exitLoads' },
  { id: 'taxImpactSummary', name: 'Tax Impact Summary', description: 'Overall tax implications with optimization tips', icon: Percent, category: 'tax' },
  { id: 'rebalancingSipRecommendations', name: 'Rebalancing & SIP Recommendations', description: 'Monthly SIP plan with source attribution', icon: RefreshCw, category: 'recommendations' },
  { id: 'portfolioHealthScore', name: 'Portfolio Health Score', description: 'Diversification and risk-adjusted metrics', icon: Shield, category: 'analysis' },
  { id: 'expenseRatioAnalysis', name: 'Expense Ratio Analysis', description: 'Fund cost comparison and optimization', icon: Percent, category: 'analysis' },
  { id: 'riskHeatMap', name: 'Risk Heat Map', description: 'Visual risk distribution across holdings', icon: AlertTriangle, category: 'analysis' },
  { id: 'benchmarkComparison', name: 'Benchmark Comparison', description: 'Performance vs goal-appropriate benchmarks', icon: BarChart3, category: 'analysis' },
  { id: 'whatIfScenarios', name: 'What-If Scenarios', description: 'Market scenario analysis with projections', icon: Sparkles, category: 'projections' },
  { id: 'dividendProjection', name: 'Dividend Projection', description: 'Expected dividend income over time', icon: IndianRupee, category: 'projections' },
  { id: 'priorityRecommendations', name: 'Priority Recommendations', description: 'Top 5 actionable items for immediate focus', icon: Target, category: 'recommendations' },
  { id: 'portfolioGrowthProjection', name: 'Portfolio Growth Projection', description: 'Future value projections with confidence bands', icon: TrendingUp, category: 'projections' },
  { id: 'mandatoryDisclaimers', name: 'Mandatory Disclaimers', description: 'SEBI/AMFI regulatory disclaimers', icon: Shield, category: 'compliance', required: true },
  { id: 'advisorDeclaration', name: 'Advisor Declaration', description: 'ARN holder declaration and signature', icon: CheckCircle, category: 'compliance', required: true },
];

const ASSET_CATEGORIES = [
  { id: 'equity', name: 'Equity Mutual Funds', color: 'bg-blue-500', description: 'Large, Mid & Small Cap Funds', group: 'domestic' },
  { id: 'debt', name: 'Debt Funds', color: 'bg-green-500', description: 'Corporate & Govt Bond Funds', group: 'domestic' },
  { id: 'hybrid', name: 'Hybrid Funds', color: 'bg-teal-500', description: 'Balanced & Multi-Asset Funds', group: 'domestic' },
  { id: 'gold', name: 'Gold', color: 'bg-yellow-500', description: 'Gold ETFs & Funds', group: 'commodities' },
  { id: 'index', name: 'Index Funds', color: 'bg-indigo-500', description: 'Nifty, Sensex Trackers', group: 'domestic' },
  { id: 'international', name: 'Global Diversified', color: 'bg-cyan-500', description: 'Multi-Region International Funds', group: 'global' },
  { id: 'us_markets', name: 'US Markets', color: 'bg-blue-600', description: 'S&P 500, Nasdaq, US Equity', group: 'global' },
  { id: 'europe_markets', name: 'Europe Markets', color: 'bg-sky-500', description: 'Euro Stoxx, UK, German Funds', group: 'global' },
  { id: 'asia_pacific_markets', name: 'Asia-Pacific', color: 'bg-violet-500', description: 'Japan, China, ASEAN Funds', group: 'global' },
  { id: 'emerging_markets', name: 'Emerging Markets', color: 'bg-amber-500', description: 'BRICS, Latin America, Africa', group: 'global' },
  { id: 'reit', name: 'REITs', color: 'bg-purple-500', description: 'Real Estate Investment Trusts', group: 'alternatives' },
  { id: 'invit', name: 'InvITs', color: 'bg-orange-500', description: 'Infrastructure Investment Trusts', group: 'alternatives' },
  { id: 'bonds', name: 'Direct Bonds', color: 'bg-emerald-500', description: 'NCDs, Tax-Free Bonds', group: 'fixed_income' },
  { id: 'listed_stocks', name: 'Listed Stocks', color: 'bg-rose-500', description: 'Direct Equity (NSE/BSE)', group: 'domestic' },
  { id: 'unlisted_stocks', name: 'Unlisted Stocks', color: 'bg-pink-500', description: 'Pre-IPO Shares', group: 'alternatives' },
  { id: 'cash', name: 'Cash/Liquid', color: 'bg-gray-500', description: 'Liquid Funds & Cash', group: 'fixed_income' },
];

const DEFAULT_ALLOCATIONS: Record<string, AssetAllocation> = {
  conservative: {
    equity: 20, debt: 35, hybrid: 15, gold: 10, index: 5, international: 0,
    us_markets: 0, europe_markets: 0, asia_pacific_markets: 0, emerging_markets: 0,
    reit: 5, invit: 5, bonds: 5, listed_stocks: 0, unlisted_stocks: 0, cash: 0
  },
  moderate: {
    equity: 25, debt: 20, hybrid: 10, gold: 5, index: 8, international: 0,
    us_markets: 5, europe_markets: 2, asia_pacific_markets: 3, emerging_markets: 0,
    reit: 5, invit: 5, bonds: 5, listed_stocks: 0, unlisted_stocks: 0, cash: 7
  },
  aggressive: {
    equity: 30, debt: 10, hybrid: 5, gold: 3, index: 10, international: 0,
    us_markets: 8, europe_markets: 4, asia_pacific_markets: 5, emerging_markets: 3,
    reit: 5, invit: 5, bonds: 5, listed_stocks: 0, unlisted_stocks: 0, cash: 7
  },
  very_aggressive: {
    equity: 25, debt: 5, hybrid: 5, gold: 2, index: 10, international: 0,
    us_markets: 10, europe_markets: 5, asia_pacific_markets: 7, emerging_markets: 6,
    reit: 5, invit: 3, bonds: 2, listed_stocks: 7, unlisted_stocks: 5, cash: 3
  }
};

const TEMPLATE_PRESETS = [
  {
    id: 'conservative_retirement',
    name: 'Conservative Retirement',
    description: 'Low-risk portfolio for retirement planning',
    config: {
      investmentGoals: { primaryGoal: 'retirement', investmentHorizon: '10+ years', targetAmount: 10000000, monthlyContribution: 50000 },
      assetAllocation: DEFAULT_ALLOCATIONS.conservative,
      selectedCategories: ['equity', 'debt', 'hybrid', 'gold', 'index', 'reit', 'invit', 'bonds'],
      riskProfile: { score: 25, category: 'conservative' as const, tolerance: 'Low risk tolerance - prefers capital preservation' },
    }
  },
  {
    id: 'aggressive_wealth',
    name: 'Aggressive Wealth Creation',
    description: 'High-growth portfolio with global diversification',
    config: {
      investmentGoals: { primaryGoal: 'wealth_creation', investmentHorizon: '10+ years', targetAmount: 50000000, monthlyContribution: 100000 },
      assetAllocation: DEFAULT_ALLOCATIONS.aggressive,
      selectedCategories: ['equity', 'debt', 'hybrid', 'gold', 'index', 'us_markets', 'europe_markets', 'asia_pacific_markets', 'emerging_markets', 'reit', 'invit', 'bonds'],
      riskProfile: { score: 80, category: 'aggressive' as const, tolerance: 'High risk tolerance - growth focused' },
    }
  },
  {
    id: 'balanced_education',
    name: 'Balanced Child Education',
    description: 'Moderate-risk portfolio with global exposure',
    config: {
      investmentGoals: { primaryGoal: 'child_education', investmentHorizon: '5-10 years', targetAmount: 3000000, monthlyContribution: 25000 },
      assetAllocation: DEFAULT_ALLOCATIONS.moderate,
      selectedCategories: ['equity', 'debt', 'hybrid', 'gold', 'index', 'us_markets', 'asia_pacific_markets', 'reit', 'invit', 'bonds'],
      riskProfile: { score: 50, category: 'moderate' as const, tolerance: 'Moderate risk tolerance - balanced approach' },
    }
  },
  {
    id: 'income_focused',
    name: 'Income Focused',
    description: 'Regular income generation portfolio',
    config: {
      investmentGoals: { primaryGoal: 'regular_income', investmentHorizon: '3-5 years', targetAmount: 5000000, monthlyContribution: 0 },
      assetAllocation: { ...DEFAULT_ALLOCATIONS.conservative, debt: 40, bonds: 10, reit: 8, invit: 7, equity: 15, hybrid: 10, gold: 5, index: 5 },
      selectedCategories: ['equity', 'debt', 'hybrid', 'gold', 'index', 'reit', 'invit', 'bonds'],
      riskProfile: { score: 30, category: 'conservative' as const, tolerance: 'Low risk tolerance - income stability preferred' },
    }
  },
  {
    id: 'global_diversified',
    name: 'Global Diversified',
    description: 'Multi-region portfolio for international exposure',
    config: {
      investmentGoals: { primaryGoal: 'wealth_creation', investmentHorizon: '10+ years', targetAmount: 20000000, monthlyContribution: 75000 },
      assetAllocation: {
        equity: 20, debt: 10, hybrid: 5, gold: 3, index: 5, international: 0,
        us_markets: 15, europe_markets: 10, asia_pacific_markets: 12, emerging_markets: 8,
        reit: 5, invit: 2, bonds: 3, listed_stocks: 0, unlisted_stocks: 0, cash: 2
      },
      selectedCategories: ['equity', 'debt', 'index', 'us_markets', 'europe_markets', 'asia_pacific_markets', 'emerging_markets', 'reit', 'bonds'],
      riskProfile: { score: 70, category: 'aggressive' as const, tolerance: 'High risk tolerance - global growth focused' },
    }
  },
];

const defaultConfig: ProposalConfig = {
  clientId: '',
  investmentGoals: {
    primaryGoal: 'wealth_creation',
    investmentHorizon: '5-10 years',
    targetAmount: 5000000,
    monthlyContribution: 25000,
  },
  assetAllocation: { ...DEFAULT_ALLOCATIONS.moderate },
  selectedCategories: ['equity', 'debt', 'hybrid', 'gold', 'index', 'us_markets', 'asia_pacific_markets', 'reit', 'invit', 'bonds'],
  riskProfile: {
    score: 50,
    category: 'moderate',
    tolerance: 'Can tolerate moderate market fluctuations',
  },
  sections: {
    coverPage: true,
    tableOfContents: true,
    executiveSummary: true,
    portfolioOverview: true,
    productRecommendations: true,
    capitalGainsSummary: false,
    exitLoadSummary: false,
    taxImpactSummary: true,
    rebalancingSipRecommendations: true,
    portfolioHealthScore: true,
    expenseRatioAnalysis: true,
    riskHeatMap: false,
    benchmarkComparison: true,
    whatIfScenarios: false,
    dividendProjection: false,
    priorityRecommendations: true,
    portfolioGrowthProjection: true,
    mandatoryDisclaimers: true,
    advisorDeclaration: true,
  },
  sectionCustomizations: {},
  coverPage: {
    enabled: true,
    title: 'Investment Proposal',
    clientName: '',
    preparedBy: 'FintekPro Financial Advisor',
    date: new Date().toLocaleDateString('en-IN'),
  },
  settings: {
    orientation: 'portrait',
    includeDisclaimer: true,
    includeSEBIDisclosure: true,
  },
};

export default function AgentDemoProposalBuilder() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("create");
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [config, setConfig] = useState<ProposalConfig>(defaultConfig);
  const [proposalName, setProposalName] = useState('');
  const [generatedProposalUrl, setGeneratedProposalUrl] = useState<string | null>(null);
  const [generatedProposalData, setGeneratedProposalData] = useState<any>(null);
  
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<ProspectProposal | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  
  const [dataAvailability, setDataAvailability] = useState({
    hasHoldings: true,
    hasSellVerdicts: true,
    hasExitLoads: true,
    hasVerdicts: true,
    hasTaxImpact: true,
    hasSipRecommendations: true,
    hasPortfolioHealth: true,
    hasExpenseAnalysis: true,
    hasRiskHeatMap: true,
    hasBenchmarkComparison: true,
    hasWhatIfScenarios: true,
    hasDividendProjection: true,
    hasPriorityRecommendations: true,
    hasGrowthProjection: true
  });
  
  // Portfolio comparison state
  interface PortfolioHolding {
    name: string;
    assetType: string;
    currentValue: number;
    units?: number;
    category?: string;
  }
  interface ProspectPortfolio {
    holdings: PortfolioHolding[];
    allocation: { equity: number; debt: number; gold: number; cash: number; others: number };
    totalValue: number;
    source: string;
    brokerDetected?: string;
    importedAt?: string;
  }
  const [prospectPortfolio, setProspectPortfolio] = useState<ProspectPortfolio | null>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const { data: managedClientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ['/api/agent/clients'],
  });

  const { data: prospectsData, isLoading: prospectsLoading } = useQuery({
    queryKey: ['/api/agent/prospect-clients'],
  });

  const { data: proposalsData, isLoading: proposalsLoading } = useQuery<{ proposals: ProspectProposal[]; stats: ProposalStats }>({
    queryKey: ["/api/agent/prospect-proposals", filterStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterStatus && filterStatus !== "all") {
        params.append("status", filterStatus);
      }
      const url = `/api/agent/prospect-proposals${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch proposals");
      return res.json();
    },
  });

  const proposals = proposalsData?.proposals || [];
  const stats = proposalsData?.stats || { total: 0, draft: 0, shared: 0, viewed: 0, converted: 0, totalViews: 0 };

  const filteredProposals = proposals.filter(p =>
    p.prospectName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.proposalTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.prospectEmail?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const validateBeforeGenerate = (): boolean => {
    const allocationTotal = Object.values(config.assetAllocation).reduce((a, b) => a + b, 0);
    if (allocationTotal !== 100) {
      toast({
        title: "Invalid Allocation",
        description: `Asset allocation must total 100% (currently ${allocationTotal}%)`,
        variant: "destructive",
      });
      return false;
    }
    if (!selectedClient) {
      toast({
        title: "No Client Selected",
        description: "Please select a client before generating the proposal",
        variant: "destructive",
      });
      return false;
    }
    if (!Object.values(config.sections).some(v => v)) {
      toast({
        title: "No Sections Selected",
        description: "Please select at least one proposal section",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!validateBeforeGenerate()) {
        throw new Error("Validation failed");
      }
      return apiRequest('/api/agent/demo-proposals/generate-pdf', {
        method: 'POST',
        body: JSON.stringify({
          config,
          clientId: selectedClient?.id,
          proposalName: proposalName || `Investment Proposal - ${selectedClient?.fullName}`,
        }),
      });
    },
    onSuccess: (data: any) => {
      if (data.pdfUrl) {
        setGeneratedProposalUrl(data.pdfUrl);
        setGeneratedProposalData(data);
        toast({
          title: "Proposal Generated",
          description: "Your investment proposal PDF is ready for download",
        });
        queryClient.invalidateQueries({ queryKey: ['/api/agent/demo-proposals'] });
        queryClient.invalidateQueries({ queryKey: ['/api/agent/prospect-proposals'] });
      }
    },
    onError: (error: any) => {
      if (error.message !== "Validation failed") {
        toast({
          title: "Generation Failed",
          description: error.message || "Failed to generate proposal",
          variant: "destructive",
        });
      }
    },
  });

  const shareProposalMutation = useMutation({
    mutationFn: async ({ id, shareVia }: { id: string; shareVia: string }) => {
      return await apiRequest(`/api/agent/prospect-proposals/${id}/share`, {
        method: "POST",
        body: JSON.stringify({ shareVia }),
        headers: { "Content-Type": "application/json" }
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "Proposal Shared", description: "The prospect can now view the proposal" });
        queryClient.invalidateQueries({ queryKey: ["/api/agent/prospect-proposals"] });
        setShowShareDialog(false);
      }
    },
    onError: (error: any) => {
      toast({ title: "Share Failed", description: error.message, variant: "destructive" });
    }
  });

  const deleteProposalMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/agent/prospect-proposals/${id}`, {
        method: "DELETE"
      });
    },
    onSuccess: () => {
      toast({ title: "Proposal Deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/prospect-proposals"] });
    },
    onError: (error: any) => {
      toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
    }
  });

  useEffect(() => {
    if (selectedClient && config.coverPage) {
      setConfig(prev => ({
        ...prev,
        clientId: selectedClient.id.toString(),
        coverPage: {
          ...prev.coverPage,
          clientName: selectedClient.fullName,
        },
      }));
    }
  }, [selectedClient]);

  // Fetch portfolio when a prospect is selected
  const fetchProspectPortfolio = async (prospectId: string) => {
    setPortfolioLoading(true);
    try {
      const res = await fetch(`/api/agent/prospects/${prospectId}/portfolio`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.portfolio) {
          setProspectPortfolio(data.portfolio);
        } else {
          setProspectPortfolio(null);
        }
      } else {
        setProspectPortfolio(null);
      }
    } catch (err) {
      setProspectPortfolio(null);
    } finally {
      setPortfolioLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClient?.type === 'prospect' && selectedClient?.id) {
      fetchProspectPortfolio(selectedClient.id.toString());
    } else {
      setProspectPortfolio(null);
    }
  }, [selectedClient]);

  useEffect(() => {
    const hasClientOrPortfolio = Boolean(prospectPortfolio?.holdings?.length || selectedClient?.type === 'client');
    
    const newAvailability = {
      hasHoldings: hasClientOrPortfolio,
      hasSellVerdicts: hasClientOrPortfolio,
      hasExitLoads: hasClientOrPortfolio,
      hasVerdicts: hasClientOrPortfolio,
      hasTaxImpact: hasClientOrPortfolio,
      hasSipRecommendations: hasClientOrPortfolio,
      hasPortfolioHealth: hasClientOrPortfolio,
      hasExpenseAnalysis: hasClientOrPortfolio,
      hasRiskHeatMap: hasClientOrPortfolio,
      hasBenchmarkComparison: hasClientOrPortfolio,
      hasWhatIfScenarios: true,
      hasDividendProjection: hasClientOrPortfolio,
      hasPriorityRecommendations: true,
      hasGrowthProjection: true
    };

    setDataAvailability(newAvailability);

    const sectionToAvailabilityMap: Record<string, boolean> = {
      portfolioOverview: newAvailability.hasHoldings,
      productRecommendations: newAvailability.hasVerdicts,
      capitalGainsSummary: newAvailability.hasSellVerdicts,
      exitLoadSummary: newAvailability.hasExitLoads,
      taxImpactSummary: newAvailability.hasTaxImpact,
      rebalancingSipRecommendations: newAvailability.hasSipRecommendations,
      portfolioHealthScore: newAvailability.hasPortfolioHealth,
      expenseRatioAnalysis: newAvailability.hasExpenseAnalysis,
      riskHeatMap: newAvailability.hasRiskHeatMap,
      benchmarkComparison: newAvailability.hasBenchmarkComparison,
      dividendProjection: newAvailability.hasDividendProjection,
    };

    setConfig(prev => {
      const updatedSections = { ...prev.sections };
      Object.entries(sectionToAvailabilityMap).forEach(([sectionId, isAvailable]) => {
        if (!isAvailable && updatedSections[sectionId as keyof typeof updatedSections]) {
          (updatedSections as any)[sectionId] = false;
        }
      });
      return { ...prev, sections: updatedSections };
    });
  }, [selectedClient, prospectPortfolio]);

  const handleNext = () => {
    if (currentStep < 8) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleAllocationChange = (key: keyof typeof config.assetAllocation, value: number) => {
    const oldValue = config.assetAllocation[key];
    const clampedValue = Math.max(0, Math.min(100, Math.round(value)));
    const diff = clampedValue - oldValue;
    
    if (diff === 0) return;
    
    const otherKeys = Object.keys(config.assetAllocation).filter(k => k !== key) as Array<keyof typeof config.assetAllocation>;
    const otherTotal = otherKeys.reduce((sum, k) => sum + config.assetAllocation[k], 0);
    
    const newAllocation = { ...config.assetAllocation };
    newAllocation[key] = clampedValue;
    
    if (diff > 0) {
      if (otherTotal <= 0) return;
      
      const actualDiff = Math.min(diff, otherTotal);
      newAllocation[key] = oldValue + actualDiff;
      
      let accumulated = 0;
      const nonZeroKeys = otherKeys.filter(k => config.assetAllocation[k] > 0);
      
      nonZeroKeys.forEach((k, i) => {
        const proportion = config.assetAllocation[k] / otherTotal;
        if (i === nonZeroKeys.length - 1) {
          newAllocation[k] = config.assetAllocation[k] - (actualDiff - accumulated);
        } else {
          const reduction = Math.floor(actualDiff * proportion);
          newAllocation[k] = config.assetAllocation[k] - reduction;
          accumulated += reduction;
        }
        newAllocation[k] = Math.max(0, newAllocation[k]);
      });
    } else {
      const increase = Math.abs(diff);
      
      if (otherTotal > 0) {
        let accumulated = 0;
        const nonZeroKeys = otherKeys.filter(k => config.assetAllocation[k] > 0);
        
        nonZeroKeys.forEach((k, i) => {
          const proportion = config.assetAllocation[k] / otherTotal;
          if (i === nonZeroKeys.length - 1) {
            newAllocation[k] = config.assetAllocation[k] + (increase - accumulated);
          } else {
            const addition = Math.floor(increase * proportion);
            newAllocation[k] = config.assetAllocation[k] + addition;
            accumulated += addition;
          }
        });
      } else if (otherKeys.length > 0) {
        newAllocation[otherKeys[0]] = config.assetAllocation[otherKeys[0]] + increase;
      }
    }
    
    setConfig(prev => ({ ...prev, assetAllocation: newAllocation }));
  };

  const getAllocationTotal = () => {
    return Object.values(config.assetAllocation).reduce((a, b) => a + b, 0);
  };

  const normalizeAllocation = () => {
    const total = getAllocationTotal();
    if (total === 0) {
      setConfig(prev => ({
        ...prev,
        assetAllocation: { ...DEFAULT_ALLOCATIONS.moderate },
      }));
      return;
    }
    
    const scale = 100 / total;
    const newAllocation = { ...config.assetAllocation };
    Object.keys(newAllocation).forEach(key => {
      newAllocation[key as keyof typeof newAllocation] = Math.round(newAllocation[key as keyof typeof newAllocation] * scale);
    });
    
    const newTotal = Object.values(newAllocation).reduce((a, b) => a + b, 0);
    if (newTotal !== 100) {
      const diff = 100 - newTotal;
      const maxKey = Object.entries(newAllocation).reduce((a, b) => b[1] > a[1] ? b : a)[0];
      newAllocation[maxKey as keyof typeof newAllocation] += diff;
    }
    
    setConfig(prev => ({ ...prev, assetAllocation: newAllocation }));
    toast({
      title: "Allocation Normalized",
      description: "Your allocation has been adjusted to total 100%",
    });
  };

  const applyDefaultAllocation = (riskCategory: 'conservative' | 'moderate' | 'aggressive' | 'very_aggressive') => {
    const allocation = DEFAULT_ALLOCATIONS[riskCategory];
    const selectedCats = Object.entries(allocation)
      .filter(([_, value]) => value > 0)
      .map(([key]) => key);
    
    setConfig(prev => ({
      ...prev,
      assetAllocation: { ...allocation },
      selectedCategories: selectedCats,
      riskProfile: {
        ...prev.riskProfile,
        category: riskCategory,
        score: riskCategory === 'conservative' ? 25 : riskCategory === 'moderate' ? 50 : riskCategory === 'aggressive' ? 75 : 90,
        tolerance: riskCategory === 'conservative' ? 'Low risk tolerance - prefers capital preservation' :
                   riskCategory === 'moderate' ? 'Moderate risk tolerance - balanced approach' :
                   riskCategory === 'aggressive' ? 'High risk tolerance - growth focused' :
                   'Very high risk tolerance - maximum growth potential'
      }
    }));
    
    toast({
      title: "Default Allocation Applied",
      description: `${riskCategory.charAt(0).toUpperCase() + riskCategory.slice(1).replace('_', ' ')} allocation has been applied`,
    });
  };

  const toggleCategory = (categoryId: string) => {
    setConfig(prev => {
      const isSelected = prev.selectedCategories.includes(categoryId);
      let newCategories: string[];
      let newAllocation = { ...prev.assetAllocation };
      
      if (isSelected) {
        newCategories = prev.selectedCategories.filter(c => c !== categoryId);
        newAllocation[categoryId as keyof AssetAllocation] = 0;
      } else {
        newCategories = [...prev.selectedCategories, categoryId];
        if (newAllocation[categoryId as keyof AssetAllocation] === 0) {
          newAllocation[categoryId as keyof AssetAllocation] = 5;
        }
      }
      
      return {
        ...prev,
        selectedCategories: newCategories,
        assetAllocation: newAllocation
      };
    });
  };

  const handleRiskScoreChange = (value: number[]) => {
    const score = value[0];
    let category: 'conservative' | 'moderate' | 'aggressive' | 'very_aggressive';
    let tolerance: string;
    
    if (score <= 25) {
      category = 'conservative';
      tolerance = 'Low risk tolerance - prefers capital preservation';
    } else if (score <= 50) {
      category = 'moderate';
      tolerance = 'Moderate risk tolerance - balanced approach';
    } else if (score <= 75) {
      category = 'aggressive';
      tolerance = 'High risk tolerance - growth focused';
    } else {
      category = 'very_aggressive';
      tolerance = 'Very high risk tolerance - maximum growth potential';
    }
    
    setConfig(prev => ({
      ...prev,
      riskProfile: { score, category, tolerance },
    }));
  };

  const handleDownload = () => {
    if (generatedProposalUrl) {
      const link = document.createElement('a');
      link.href = generatedProposalUrl;
      link.download = `${proposalName || 'investment-proposal'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: `${label} copied to clipboard` });
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return !!selectedClient;
      case 2:
        return config.investmentGoals.primaryGoal && config.investmentGoals.targetAmount > 0;
      case 3:
        const total = Object.values(config.assetAllocation).reduce((a, b) => a + b, 0);
        return total === 100;
      case 4:
        return config.riskProfile.score >= 0;
      case 5:
        return Object.values(config.sections).some(v => v);
      case 6:
        return Object.values(config.sections).some(v => v);
      default:
        return true;
    }
  };

  const allocationTotal = Object.values(config.assetAllocation).reduce((a, b) => a + b, 0);
  
  // Combine managed clients and prospects into unified list
  // API returns { success: true, data: clients } or array directly
  const clientsArray = (managedClientsData as any)?.data || (managedClientsData as any)?.clients || (Array.isArray(managedClientsData) ? managedClientsData : []);
  const managedClients: Client[] = clientsArray.map((c: any) => ({
    id: c.id,
    fullName: c.fullName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.name || 'Unknown',
    email: c.email || c.emailAddress || '',
    phone: c.phone || c.mobile || c.mobileNumber || '',
    riskProfile: c.riskProfile,
    type: 'client' as const
  }));
  
  const prospects: Client[] = ((prospectsData as any)?.prospects || []).map((p: ProspectClient) => ({
    id: p.id,
    fullName: p.name || 'Unnamed Prospect',
    email: p.email || '',
    phone: p.mobile || '',
    riskProfile: p.indicativeRiskProfile,
    type: 'prospect' as const
  }));
  
  const clients = [...managedClients, ...prospects];
  const isLoadingContacts = clientsLoading || prospectsLoading;

  const formatCurrency = (value: number) => {
    if (value >= 10000000) {
      return `₹${(value / 10000000).toFixed(2)} Cr`;
    } else if (value >= 100000) {
      return `₹${(value / 100000).toFixed(2)} L`;
    }
    return `₹${value.toLocaleString('en-IN')}`;
  };

  return (
    <div className="min-h-screen bg-muted dark:bg-card" data-testid="proposal-builder">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Sparkles className="h-8 w-8 text-purple-600" />
              Proposal Builder
            </h1>
            <p className="text-muted-foreground dark:text-muted-foreground mt-1">
              Create professional investment proposals for prospects and clients
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="create" className="flex items-center gap-2" data-testid="tab-create">
              <Plus className="w-4 h-4" />
              Create Proposal
            </TabsTrigger>
            <TabsTrigger value="proposals" className="flex items-center gap-2" data-testid="tab-proposals">
              <FileText className="w-4 h-4" />
              My Proposals
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create">
            <div className="flex gap-8 mb-8 overflow-x-auto pb-2">
              {WIZARD_STEPS.map((step, index) => {
                const StepIcon = step.icon;
                const isActive = currentStep === step.id;
                const isCompleted = currentStep > step.id;
                return (
                  <div 
                    key={step.id} 
                    className={`flex items-center gap-3 flex-shrink-0 ${isActive ? 'opacity-100' : 'opacity-60'}`}
                    data-testid={`wizard-step-${step.id}`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      isCompleted ? 'bg-green-500 text-white' :
                      isActive ? 'bg-purple-600 text-white' :
                      'bg-muted dark:bg-gray-700 text-muted-foreground'
                    }`}>
                      {isCompleted ? <Check className="h-5 w-5" /> : <StepIcon className="h-5 w-5" />}
                    </div>
                    <div className="hidden lg:block">
                      <p className={`text-sm font-medium ${isActive ? 'text-purple-600' : 'text-muted-foreground dark:text-muted-foreground'}`}>
                        {step.title}
                      </p>
                      <p className="text-xs text-muted-foreground">{step.description}</p>
                    </div>
                    {index < WIZARD_STEPS.length - 1 && (
                      <div className={`w-8 h-0.5 ${isCompleted ? 'bg-green-500' : 'bg-muted'}`} />
                    )}
                  </div>
                );
              })}
            </div>

            <Progress value={(currentStep / 8) * 100} className="mb-8" />

            <Card className="mb-6">
              <CardContent className="p-6">
                {currentStep === 1 && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-xl font-semibold mb-4">Select Prospect or Client</h2>
                      {isLoadingContacts ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div>
                            <Label className="mb-2 block">Select from your managed clients or prospects</Label>
                            <Select 
                              value={selectedClient?.id?.toString() || ''} 
                              onValueChange={(val) => {
                                const client = clients.find((c: Client) => c.id.toString() === val);
                                setSelectedClient(client || null);
                              }}
                            >
                              <SelectTrigger data-testid="select-client">
                                <SelectValue placeholder="Select a client or prospect" />
                              </SelectTrigger>
                              <SelectContent>
                                {managedClients.length > 0 && (
                                  <SelectGroup>
                                    <SelectLabel className="text-xs font-semibold text-blue-600">Managed Clients</SelectLabel>
                                    {managedClients.map((client: Client) => (
                                      <SelectItem key={`client-${client.id}`} value={client.id.toString()}>
                                        <div className="flex items-center gap-2">
                                          <User className="h-4 w-4 text-blue-600" />
                                          <span>{client.fullName}</span>
                                          {client.email && <span className="text-muted-foreground text-sm">({client.email})</span>}
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                )}
                                {prospects.length > 0 && (
                                  <SelectGroup>
                                    <SelectLabel className="text-xs font-semibold text-orange-600">Prospects</SelectLabel>
                                    {prospects.map((prospect: Client) => (
                                      <SelectItem key={`prospect-${prospect.id}`} value={prospect.id.toString()}>
                                        <div className="flex items-center gap-2">
                                          <User className="h-4 w-4 text-orange-600" />
                                          <span>{prospect.fullName}</span>
                                          {prospect.email && <span className="text-muted-foreground text-sm">({prospect.email})</span>}
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                )}
                                {clients.length === 0 && (
                                  <div className="p-4 text-center text-muted-foreground">
                                    <p>No clients or prospects found.</p>
                                    <p className="text-sm mt-1">Add prospects from Client Acquisition page.</p>
                                  </div>
                                )}
                              </SelectContent>
                            </Select>
                          </div>

                          {selectedClient && (
                            <Card className={`${selectedClient.type === 'client' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200' : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200'}`}>
                              <CardContent className="p-4">
                                <div className="flex items-start gap-4">
                                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-bold ${selectedClient.type === 'client' ? 'bg-blue-600' : 'bg-orange-600'}`}>
                                    {selectedClient.fullName.charAt(0)}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <h4 className="font-semibold text-lg">{selectedClient.fullName}</h4>
                                      <Badge variant="secondary" className={selectedClient.type === 'client' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}>
                                        {selectedClient.type === 'client' ? 'Client' : 'Prospect'}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-muted-foreground dark:text-muted-foreground mt-1">
                                      {selectedClient.email && (
                                        <span className="flex items-center gap-1">
                                          <Mail className="h-4 w-4" />
                                          {selectedClient.email}
                                        </span>
                                      )}
                                      {selectedClient.phone && (
                                        <span className="flex items-center gap-1">
                                          <Phone className="h-4 w-4" />
                                          {selectedClient.phone}
                                        </span>
                                      )}
                                    </div>
                                    {selectedClient.riskProfile && (
                                      <Badge variant="outline" className="mt-2">
                                        Risk Profile: {selectedClient.riskProfile}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-semibold">Investment Goals</h2>
                      <Select
                        onValueChange={(val) => {
                          const preset = TEMPLATE_PRESETS.find(p => p.id === val);
                          if (preset) {
                            setConfig(prev => ({
                              ...prev,
                              investmentGoals: preset.config.investmentGoals,
                              assetAllocation: preset.config.assetAllocation,
                              riskProfile: preset.config.riskProfile,
                            }));
                            toast({
                              title: "Template Applied",
                              description: `${preset.name} template has been applied`,
                            });
                          }
                        }}
                      >
                        <SelectTrigger className="w-48" data-testid="select-template">
                          <SelectValue placeholder="Apply Template" />
                        </SelectTrigger>
                        <SelectContent>
                          {TEMPLATE_PRESETS.map(preset => (
                            <SelectItem key={preset.id} value={preset.id}>
                              {preset.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <Label className="mb-2 block">Primary Investment Goal</Label>
                          <RadioGroup
                            value={config.investmentGoals.primaryGoal}
                            onValueChange={(val) => setConfig(prev => ({
                              ...prev,
                              investmentGoals: { ...prev.investmentGoals, primaryGoal: val }
                            }))}
                            className="space-y-3"
                          >
                            {INVESTMENT_GOALS.map(goal => (
                              <div key={goal.id} className="flex items-center space-x-2">
                                <RadioGroupItem value={goal.id} id={goal.id} />
                                <Label htmlFor={goal.id} className="cursor-pointer">
                                  <span className="font-medium">{goal.name}</span>
                                  <span className="text-muted-foreground text-sm ml-2">- {goal.description}</span>
                                </Label>
                              </div>
                            ))}
                          </RadioGroup>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <Label className="mb-2 block">Investment Horizon</Label>
                          <Select
                            value={config.investmentGoals.investmentHorizon}
                            onValueChange={(val) => setConfig(prev => ({
                              ...prev,
                              investmentGoals: { ...prev.investmentGoals, investmentHorizon: val }
                            }))}
                          >
                            <SelectTrigger data-testid="select-horizon">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1-3 years">Short Term (1-3 years)</SelectItem>
                              <SelectItem value="3-5 years">Medium Term (3-5 years)</SelectItem>
                              <SelectItem value="5-10 years">Long Term (5-10 years)</SelectItem>
                              <SelectItem value="10+ years">Very Long Term (10+ years)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="mb-2 block">Target Corpus (₹)</Label>
                          <Input
                            type="number"
                            value={config.investmentGoals.targetAmount}
                            onChange={(e) => setConfig(prev => ({
                              ...prev,
                              investmentGoals: { ...prev.investmentGoals, targetAmount: parseInt(e.target.value) || 0 }
                            }))}
                            data-testid="input-target-amount"
                          />
                          <p className="text-sm text-muted-foreground mt-1">{formatCurrency(config.investmentGoals.targetAmount)}</p>
                        </div>

                        <div>
                          <Label className="mb-2 block">Monthly Contribution (₹)</Label>
                          <Input
                            type="number"
                            value={config.investmentGoals.monthlyContribution}
                            onChange={(e) => setConfig(prev => ({
                              ...prev,
                              investmentGoals: { ...prev.investmentGoals, monthlyContribution: parseInt(e.target.value) || 0 }
                            }))}
                            data-testid="input-monthly-contribution"
                          />
                          <p className="text-sm text-muted-foreground mt-1">{formatCurrency(config.investmentGoals.monthlyContribution)}/month</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div>
                        <h2 className="text-xl font-semibold">Asset Allocation</h2>
                        <p className="text-sm text-muted-foreground mt-1">Choose a default allocation or customize with sliders</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant={allocationTotal === 100 ? "default" : "destructive"} className="text-sm px-3 py-1">
                          Total: {allocationTotal}%
                        </Badge>
                        {allocationTotal !== 100 && (
                          <Button size="sm" variant="outline" onClick={normalizeAllocation}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Normalize to 100%
                          </Button>
                        )}
                      </div>
                    </div>

                    <Card className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-purple-200 dark:border-purple-800">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="h-5 w-5 text-purple-600" />
                        <h3 className="font-semibold">Quick Start - Default Allocations</h3>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">Select a risk-based preset to auto-fill allocation, or customize manually below</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {(['conservative', 'moderate', 'aggressive', 'very_aggressive'] as const).map((risk) => (
                          <Button
                            key={risk}
                            variant={config.riskProfile.category === risk ? "default" : "outline"}
                            className={`flex flex-col h-auto py-3 ${config.riskProfile.category === risk ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
                            onClick={() => applyDefaultAllocation(risk)}
                          >
                            <span className="font-medium capitalize">{risk.replace('_', ' ')}</span>
                            <span className="text-xs opacity-75 mt-1">
                              {risk === 'conservative' ? 'Low Risk' : risk === 'moderate' ? 'Balanced' : risk === 'aggressive' ? 'Growth' : 'Max Growth'}
                            </span>
                          </Button>
                        ))}
                      </div>
                    </Card>

                    <Separator />

                    <div className="grid lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-2 space-y-3">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold">Asset Categories</h3>
                          <p className="text-xs text-muted-foreground">Toggle categories on/off, then adjust allocation %</p>
                        </div>
                        <div className="grid gap-3">
                          {ASSET_CATEGORIES.map((category) => {
                            const isSelected = config.selectedCategories.includes(category.id);
                            const value = config.assetAllocation[category.id as keyof AssetAllocation] || 0;
                            return (
                              <div 
                                key={category.id} 
                                className={`p-3 rounded-lg border transition-all ${
                                  isSelected 
                                    ? 'bg-white dark:bg-card border-gray-200 dark:border-gray-700' 
                                    : 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800 opacity-60'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleCategory(category.id)}
                                    className="h-5 w-5"
                                  />
                                  <div className={`w-3 h-3 rounded-full ${category.color}`} />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                      <div>
                                        <span className="font-medium text-sm">{category.name}</span>
                                        <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">{category.description}</span>
                                      </div>
                                      <span className="font-semibold text-sm tabular-nums w-12 text-right">{value}%</span>
                                    </div>
                                    {isSelected && (
                                      <Slider
                                        value={[value]}
                                        onValueChange={(val) => {
                                          setConfig(prev => ({
                                            ...prev,
                                            assetAllocation: {
                                              ...prev.assetAllocation,
                                              [category.id]: val[0]
                                            }
                                          }));
                                        }}
                                        max={100}
                                        step={1}
                                        className="mt-2"
                                      />
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <Card className="p-4 sticky top-4">
                          <h3 className="font-semibold mb-4 text-center">Allocation Preview</h3>
                          <div className="aspect-square max-w-[180px] mx-auto relative">
                            <svg viewBox="0 0 100 100" className="transform -rotate-90">
                              {(() => {
                                let currentAngle = 0;
                                const categoryColors: Record<string, string> = {
                                  equity: '#3B82F6', debt: '#22C55E', hybrid: '#14B8A6', gold: '#EAB308',
                                  index: '#6366F1', international: '#06B6D4', 
                                  us_markets: '#2563EB', europe_markets: '#0EA5E9', asia_pacific_markets: '#8B5CF6', emerging_markets: '#F59E0B',
                                  reit: '#A855F7', invit: '#F97316',
                                  bonds: '#10B981', listed_stocks: '#F43F5E', unlisted_stocks: '#EC4899', cash: '#6B7280'
                                };
                                return ASSET_CATEGORIES.map((cat) => {
                                  const value = config.assetAllocation[cat.id as keyof AssetAllocation] || 0;
                                  if (value === 0) return null;
                                  const percentage = value / 100;
                                  const angle = percentage * 360;
                                  const startAngle = currentAngle;
                                  currentAngle += angle;
                                  const x1 = 50 + 40 * Math.cos((startAngle * Math.PI) / 180);
                                  const y1 = 50 + 40 * Math.sin((startAngle * Math.PI) / 180);
                                  const x2 = 50 + 40 * Math.cos(((startAngle + angle) * Math.PI) / 180);
                                  const y2 = 50 + 40 * Math.sin(((startAngle + angle) * Math.PI) / 180);
                                  const largeArcFlag = angle > 180 ? 1 : 0;
                                  return (
                                    <path
                                      key={cat.id}
                                      d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArcFlag} 1 ${x2} ${y2} Z`}
                                      fill={categoryColors[cat.id]}
                                      opacity={0.85}
                                    />
                                  );
                                });
                              })()}
                            </svg>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5 mt-4 text-xs">
                            {ASSET_CATEGORIES.map((cat) => {
                              const value = config.assetAllocation[cat.id as keyof AssetAllocation] || 0;
                              if (value === 0) return null;
                              return (
                                <div key={cat.id} className="flex items-center gap-1.5">
                                  <div className={`w-2 h-2 rounded-full ${cat.color}`} />
                                  <span className="truncate">{cat.name.split(' ')[0]}: {value}%</span>
                                </div>
                              );
                            })}
                          </div>
                        </Card>

                        {selectedClient?.type === 'prospect' && prospectPortfolio && (
                          <Card className="p-4">
                            <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                              <BarChart3 className="h-4 w-4" />
                              Current vs Recommended
                            </h3>
                            <div className="space-y-2 text-xs">
                              {Object.entries({
                                Equity: { current: prospectPortfolio.allocation?.equity || 0, recommended: config.assetAllocation.equity },
                                Debt: { current: prospectPortfolio.allocation?.debt || 0, recommended: config.assetAllocation.debt },
                              }).map(([name, { current, recommended }]) => {
                                const diff = recommended - current;
                                return (
                                  <div key={name} className="flex justify-between">
                                    <span>{name}</span>
                                    <span className={diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : ''}>
                                      {current}% → {recommended}%
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </Card>
                        )}

                        {(config.assetAllocation.us_markets > 0 || config.assetAllocation.europe_markets > 0 || 
                          config.assetAllocation.asia_pacific_markets > 0 || config.assetAllocation.emerging_markets > 0) && (
                          <Card className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
                            <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                              <Globe className="h-4 w-4 text-blue-600" />
                              Global Market Exposure
                            </h3>
                            <div className="space-y-2 text-xs">
                              {[
                                { key: 'us_markets', name: 'US Markets', color: '#2563EB', benchmark: 'S&P 500', ytd: '+12.4%' },
                                { key: 'europe_markets', name: 'Europe', color: '#0EA5E9', benchmark: 'STOXX 600', ytd: '+8.2%' },
                                { key: 'asia_pacific_markets', name: 'Asia-Pacific', color: '#8B5CF6', benchmark: 'MSCI APAC', ytd: '+6.8%' },
                                { key: 'emerging_markets', name: 'Emerging', color: '#F59E0B', benchmark: 'MSCI EM', ytd: '+4.5%' }
                              ].filter(region => (config.assetAllocation[region.key as keyof typeof config.assetAllocation] as number) > 0)
                               .map(region => (
                                <div key={region.key} className="flex items-center justify-between py-1">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: region.color }} />
                                    <span className="font-medium">{region.name}</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-muted-foreground">{region.benchmark}</span>
                                    <span className="text-green-600 font-medium">{region.ytd}</span>
                                    <Badge variant="outline" className="text-xs">
                                      {config.assetAllocation[region.key as keyof typeof config.assetAllocation]}%
                                    </Badge>
                                  </div>
                                </div>
                              ))}
                              <div className="border-t pt-2 mt-2 flex justify-between text-muted-foreground">
                                <span>Total Global Allocation</span>
                                <span className="font-semibold text-foreground">
                                  {(config.assetAllocation.us_markets || 0) + (config.assetAllocation.europe_markets || 0) + 
                                   (config.assetAllocation.asia_pacific_markets || 0) + (config.assetAllocation.emerging_markets || 0)}%
                                </span>
                              </div>
                            </div>
                          </Card>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 4 && (
                  <div className="space-y-6">
                    <h2 className="text-xl font-semibold">Risk Profile Assessment</h2>
                    
                    <div className="grid md:grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <div>
                          <Label className="mb-4 block">Risk Tolerance Score</Label>
                          <Slider
                            value={[config.riskProfile.score]}
                            onValueChange={handleRiskScoreChange}
                            max={100}
                            step={5}
                            className="w-full"
                          />
                          <div className="flex justify-between text-sm text-muted-foreground mt-2">
                            <span>Conservative</span>
                            <span>Moderate</span>
                            <span>Aggressive</span>
                          </div>
                        </div>

                        <Card className={`p-4 ${
                          config.riskProfile.category === 'conservative' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' :
                          config.riskProfile.category === 'moderate' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' :
                          config.riskProfile.category === 'aggressive' ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' :
                          'border-red-500 bg-red-50 dark:bg-red-900/20'
                        }`}>
                          <div className="flex items-center gap-3 mb-2">
                            <Scale className="h-6 w-6" />
                            <h3 className="font-semibold text-lg capitalize">{(config.riskProfile?.category || 'moderate').replace('_', ' ')} Investor</h3>
                          </div>
                          <p className="text-muted-foreground dark:text-muted-foreground">{config.riskProfile.tolerance}</p>
                          <Badge className="mt-2">Score: {config.riskProfile.score}/100</Badge>
                        </Card>
                      </div>

                      <div>
                        <h3 className="font-semibold mb-4">Recommended Portfolio Mix</h3>
                        <div className="space-y-3">
                          {config.riskProfile.category === 'conservative' && (
                            <>
                              <div className="flex justify-between"><span>Equity</span><span>20-30%</span></div>
                              <div className="flex justify-between"><span>Debt</span><span>50-60%</span></div>
                              <div className="flex justify-between"><span>Gold</span><span>10-15%</span></div>
                              <div className="flex justify-between"><span>Cash</span><span>5-10%</span></div>
                            </>
                          )}
                          {config.riskProfile.category === 'moderate' && (
                            <>
                              <div className="flex justify-between"><span>Equity</span><span>40-50%</span></div>
                              <div className="flex justify-between"><span>Debt</span><span>30-40%</span></div>
                              <div className="flex justify-between"><span>Gold</span><span>10-15%</span></div>
                              <div className="flex justify-between"><span>Cash</span><span>5%</span></div>
                            </>
                          )}
                          {config.riskProfile.category === 'aggressive' && (
                            <>
                              <div className="flex justify-between"><span>Equity</span><span>60-70%</span></div>
                              <div className="flex justify-between"><span>Debt</span><span>15-25%</span></div>
                              <div className="flex justify-between"><span>Gold</span><span>5-10%</span></div>
                              <div className="flex justify-between"><span>Cash</span><span>5%</span></div>
                            </>
                          )}
                          {config.riskProfile.category === 'very_aggressive' && (
                            <>
                              <div className="flex justify-between"><span>Equity</span><span>75-85%</span></div>
                              <div className="flex justify-between"><span>Debt</span><span>5-15%</span></div>
                              <div className="flex justify-between"><span>Gold/Alternatives</span><span>5-10%</span></div>
                              <div className="flex justify-between"><span>Cash</span><span>0-5%</span></div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 5 && (
                  <div className="space-y-6">
                    <h2 className="text-xl font-semibold">Portfolio Intelligence</h2>
                    <p className="text-muted-foreground">Analyze overlap, simulate SIP impact, and generate advisor talking points</p>
                    
                    <Tabs defaultValue="simulator" className="w-full">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="simulator" className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          SIP Simulator
                        </TabsTrigger>
                        <TabsTrigger value="analysis" className="flex items-center gap-2">
                          <Layers className="h-4 w-4" />
                          Overlap Analysis
                        </TabsTrigger>
                        <TabsTrigger value="training" className="flex items-center gap-2">
                          <GraduationCap className="h-4 w-4" />
                          Advisor Training
                        </TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="simulator" className="space-y-4 mt-4">
                        <SIPSimulatorUI
                          existingPortfolio={prospectPortfolio?.holdings?.map(h => ({
                            mfIsin: h.name?.replace(/\s+/g, '_') || '',
                            name: h.name || '',
                            portfolioWeight: (h.currentValue / (prospectPortfolio?.totalValue || 1)) * 100,
                            currentValue: h.currentValue
                          })) || []}
                          candidateFunds={[]}
                          onSimulationComplete={(result) => {
                            console.log('SIP simulation complete:', result);
                          }}
                        />
                        <Alert>
                          <Brain className="h-4 w-4" />
                          <AlertDescription>
                            The SIP Simulator projects how monthly investments will improve your portfolio's diversification score over time.
                          </AlertDescription>
                        </Alert>
                      </TabsContent>
                      
                      <TabsContent value="analysis" className="space-y-4 mt-4">
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                              <Brain className="h-5 w-5 text-primary" />
                              Diversification Analysis
                            </CardTitle>
                            <CardDescription>
                              Analyze portfolio overlap and identify concentration risks
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            {prospectPortfolio?.holdings && prospectPortfolio.holdings.length > 0 ? (
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                                    <div className="text-2xl font-bold text-primary">{prospectPortfolio.holdings.length}</div>
                                    <div className="text-sm text-muted-foreground">Holdings</div>
                                  </div>
                                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                                    <div className="text-2xl font-bold text-green-600">
                                      ₹{((prospectPortfolio.totalValue || 0) / 100000).toFixed(1)}L
                                    </div>
                                    <div className="text-sm text-muted-foreground">Total Value</div>
                                  </div>
                                </div>
                                <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                                  <p className="text-sm text-blue-700 dark:text-blue-300">
                                    Portfolio overlap analysis examines fund holdings for stock/sector concentration. 
                                    Import CAS statement for detailed ISIN-level analysis.
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="p-4 bg-muted/50 rounded-lg text-center">
                                <p className="text-sm text-muted-foreground">
                                  Import portfolio holdings in Step 1 to enable overlap analysis.
                                </p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </TabsContent>
                      
                      <TabsContent value="training" className="space-y-4 mt-4">
                        <AdvisorTrainingPanel
                          diversificationScore={{
                            score: 72,
                            grade: "GOOD",
                            penalties: [],
                            stockExposures: [],
                            sectorExposures: []
                          }}
                          selectedGoal={config.investmentGoals.primaryGoal}
                          isAdvisor={true}
                        />
                      </TabsContent>
                    </Tabs>
                  </div>
                )}

                {currentStep === 6 && (
                  <div className="space-y-6">
                    <h2 className="text-xl font-semibold">Select Proposal Sections</h2>
                    <p className="text-muted-foreground">Choose which sections to include in the proposal report. Some sections require specific data.</p>
                    
                    {['header', 'overview', 'recommendations', 'analysis', 'tax', 'projections', 'compliance'].map(category => {
                      const categoryLabels: Record<string, string> = {
                        header: 'Header Sections',
                        overview: 'Overview',
                        recommendations: 'Recommendations',
                        analysis: 'Analysis & Metrics',
                        tax: 'Tax & Exit Load',
                        projections: 'Projections',
                        compliance: 'Compliance'
                      };
                      const categorySections = PROPOSAL_SECTIONS.filter(s => 'category' in s && s.category === category);
                      if (categorySections.length === 0) return null;
                      
                      const dataAvailabilityMap: Record<string, boolean> = {
                        holdings: dataAvailability.hasHoldings,
                        sellVerdicts: dataAvailability.hasSellVerdicts,
                        exitLoads: dataAvailability.hasExitLoads,
                        verdicts: dataAvailability.hasVerdicts,
                        taxImpact: dataAvailability.hasTaxImpact,
                        sipRecommendations: dataAvailability.hasSipRecommendations,
                        portfolioHealth: dataAvailability.hasPortfolioHealth,
                        expenseAnalysis: dataAvailability.hasExpenseAnalysis,
                        riskHeatMap: dataAvailability.hasRiskHeatMap,
                        benchmarkComparison: dataAvailability.hasBenchmarkComparison,
                        whatIfScenarios: dataAvailability.hasWhatIfScenarios,
                        dividendProjection: dataAvailability.hasDividendProjection,
                        priorityRecommendations: dataAvailability.hasPriorityRecommendations,
                        growthProjection: dataAvailability.hasGrowthProjection
                      };
                      
                      return (
                        <div key={category} className="space-y-3">
                          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">{categoryLabels[category]}</h3>
                          <div className="grid md:grid-cols-2 gap-4">
                            {categorySections.map(section => {
                              const SectionIcon = section.icon;
                              const isSelected = config.sections[section.id as keyof typeof config.sections];
                              const isRequired = 'required' in section && section.required;
                              const requiresData = 'requiresData' in section ? section.requiresData : null;
                              const isDataAvailable = requiresData ? dataAvailabilityMap[requiresData] !== false : true;
                              const isDisabled = isRequired || !isDataAvailable;
                              
                              const dependencyMessages: Record<string, string> = {
                                holdings: 'Requires portfolio holdings data',
                                sellVerdicts: 'Only shown when SELL recommendations exist',
                                exitLoads: 'Only shown when exit loads apply'
                              };
                              
                              return (
                                <Card 
                                  key={section.id}
                                  className={`transition-all ${
                                    !isDataAvailable
                                      ? 'border-gray-300 bg-gray-50/50 dark:bg-gray-900/10 cursor-not-allowed opacity-60'
                                      : isRequired 
                                        ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-900/10 cursor-not-allowed' 
                                        : isSelected 
                                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 cursor-pointer' 
                                          : 'hover:border-border cursor-pointer'
                                  }`}
                                  onClick={() => {
                                    if (isDisabled) return;
                                    setConfig(prev => ({
                                      ...prev,
                                      sections: { ...prev.sections, [section.id]: !isSelected }
                                    }));
                                  }}
                                >
                                  <CardContent className="p-4 flex items-start gap-3">
                                    <Checkbox 
                                      checked={isSelected && isDataAvailable}
                                      disabled={isDisabled}
                                      className="mt-1"
                                    />
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <SectionIcon className="h-4 w-4" />
                                        <span className="font-medium">{section.name}</span>
                                        {isRequired && (
                                          <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700">Required</Badge>
                                        )}
                                        {!isDataAvailable && (
                                          <Badge variant="secondary" className="text-xs bg-gray-200 text-gray-600">Unavailable</Badge>
                                        )}
                                      </div>
                                      <p className="text-sm text-muted-foreground mt-1">{section.description}</p>
                                      {requiresData && !isDataAvailable && (
                                        <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                                          <AlertTriangle className="h-3 w-3" />
                                          Data not available - section will be skipped
                                        </p>
                                      )}
                                      {requiresData && isDataAvailable && (
                                        <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                          <AlertTriangle className="h-3 w-3" />
                                          {dependencyMessages[requiresData] || `Requires: ${requiresData}`}
                                        </p>
                                      )}
                                    </div>
                                  </CardContent>
                                </Card>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    
                    <Alert className="mt-4">
                      <AlertDescription className="text-sm">
                        <strong>{Object.values(config.sections).filter(Boolean).length}</strong> sections selected. 
                        Required sections (Cover Page, TOC, Disclaimers, Declaration) cannot be disabled.
                      </AlertDescription>
                    </Alert>

                    <Separator />

                    <div className="space-y-4">
                      <h3 className="font-semibold">Cover Page Settings</h3>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Include Cover Page</Label>
                          <p className="text-sm text-muted-foreground">Professional cover with client name and date</p>
                        </div>
                        <Switch
                          checked={config.coverPage.enabled}
                          onCheckedChange={(checked) => setConfig(prev => ({
                            ...prev,
                            coverPage: { ...prev.coverPage, enabled: checked }
                          }))}
                        />
                      </div>

                      {config.coverPage.enabled && (
                        <div className="grid md:grid-cols-2 gap-4 pl-4 border-l-2 border-purple-200">
                          <div>
                            <Label className="mb-2 block">Proposal Title</Label>
                            <Input
                              value={config.coverPage.title}
                              onChange={(e) => setConfig(prev => ({
                                ...prev,
                                coverPage: { ...prev.coverPage, title: e.target.value }
                              }))}
                              data-testid="input-cover-title"
                            />
                          </div>
                          <div>
                            <Label className="mb-2 block">Prepared By</Label>
                            <Input
                              value={config.coverPage.preparedBy}
                              onChange={(e) => setConfig(prev => ({
                                ...prev,
                                coverPage: { ...prev.coverPage, preparedBy: e.target.value }
                              }))}
                              data-testid="input-prepared-by"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h3 className="font-semibold">Compliance Settings</h3>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Include Disclaimer</Label>
                          <p className="text-sm text-muted-foreground">Standard investment disclaimer</p>
                        </div>
                        <Switch
                          checked={config.settings.includeDisclaimer}
                          onCheckedChange={(checked) => setConfig(prev => ({
                            ...prev,
                            settings: { ...prev.settings, includeDisclaimer: checked }
                          }))}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Include SEBI Disclosures</Label>
                          <p className="text-sm text-muted-foreground">Regulatory compliance statements</p>
                        </div>
                        <Switch
                          checked={config.settings.includeSEBIDisclosure}
                          onCheckedChange={(checked) => setConfig(prev => ({
                            ...prev,
                            settings: { ...prev.settings, includeSEBIDisclosure: checked }
                          }))}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 7 && (
                  <div className="space-y-6">
                    <h2 className="text-xl font-semibold">Customize Report Content</h2>
                    <p className="text-muted-foreground">Add custom notes and personalize each section of the proposal</p>
                    
                    <div className="space-y-4">
                      {PROPOSAL_SECTIONS.filter(section => 
                        config.sections[section.id as keyof typeof config.sections]
                      ).map(section => {
                        const SectionIcon = section.icon;
                        const customization = config.sectionCustomizations[section.id] || {};
                        const isRequired = 'required' in section && section.required;
                        const requiresData = 'requiresData' in section ? section.requiresData : null;
                        
                        return (
                          <Card key={section.id} className="border-l-4 border-l-purple-500">
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <SectionIcon className="h-4 w-4 text-purple-600" />
                                  <CardTitle className="text-base">{section.name}</CardTitle>
                                  {isRequired && (
                                    <Badge variant="secondary" className="text-xs">Required</Badge>
                                  )}
                                  {requiresData && (
                                    <Badge variant="outline" className="text-xs text-amber-600">
                                      Requires: {requiresData}
                                    </Badge>
                                  )}
                                </div>
                                {'category' in section && (
                                  <Badge variant="outline" className="capitalize">{section.category}</Badge>
                                )}
                              </div>
                              <CardDescription>{section.description}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div>
                                <Label className="mb-2 block text-sm">Custom Title (optional)</Label>
                                <Input
                                  placeholder={section.name}
                                  value={customization.overrideTitle || ''}
                                  onChange={(e) => setConfig(prev => ({
                                    ...prev,
                                    sectionCustomizations: {
                                      ...prev.sectionCustomizations,
                                      [section.id]: {
                                        ...prev.sectionCustomizations[section.id],
                                        overrideTitle: e.target.value
                                      }
                                    }
                                  }))}
                                />
                              </div>
                              <div>
                                <Label className="mb-2 block text-sm">Advisor Notes</Label>
                                <Textarea
                                  placeholder="Add personalized notes, context, or recommendations for this section..."
                                  value={customization.customNotes || ''}
                                  onChange={(e) => setConfig(prev => ({
                                    ...prev,
                                    sectionCustomizations: {
                                      ...prev.sectionCustomizations,
                                      [section.id]: {
                                        ...prev.sectionCustomizations[section.id],
                                        customNotes: e.target.value
                                      }
                                    }
                                  }))}
                                  className="min-h-[80px]"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`toc-${section.id}`}
                                  checked={customization.showInToc !== false}
                                  onCheckedChange={(checked) => setConfig(prev => ({
                                    ...prev,
                                    sectionCustomizations: {
                                      ...prev.sectionCustomizations,
                                      [section.id]: {
                                        ...prev.sectionCustomizations[section.id],
                                        showInToc: !!checked
                                      }
                                    }
                                  }))}
                                />
                                <Label htmlFor={`toc-${section.id}`} className="text-sm">
                                  Show in Table of Contents
                                </Label>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                    
                    {Object.values(config.sections).filter(Boolean).length === 0 && (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          No sections selected. Go back to Step 5 to select at least one section.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}

                {currentStep === 8 && (
                  <div className="space-y-6">
                    <h2 className="text-xl font-semibold">Generate Proposal</h2>
                    
                    <div className="space-y-4">
                      <div>
                        <Label className="mb-2 block">Proposal Name</Label>
                        <Input
                          value={proposalName}
                          onChange={(e) => setProposalName(e.target.value)}
                          placeholder={`Investment Proposal - ${selectedClient?.fullName} - ${new Date().toLocaleDateString('en-IN')}`}
                          data-testid="input-final-proposal-name"
                        />
                      </div>

                      <Card className="bg-muted dark:bg-muted">
                        <CardHeader>
                          <CardTitle className="text-sm">Proposal Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Client:</span>
                            <span className="font-medium">{selectedClient?.fullName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Investment Goal:</span>
                            <span className="font-medium capitalize">{(config.investmentGoals?.primaryGoal || 'growth').replace('_', ' ')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Target Corpus:</span>
                            <span className="font-medium">{formatCurrency(config.investmentGoals.targetAmount)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Monthly Contribution:</span>
                            <span className="font-medium">{formatCurrency(config.investmentGoals.monthlyContribution)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Risk Profile:</span>
                            <span className="font-medium capitalize">{(config.riskProfile?.category || 'moderate').replace('_', ' ')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Sections:</span>
                            <span className="font-medium">
                              {Object.values(config.sections).filter(Boolean).length} selected
                            </span>
                          </div>
                        </CardContent>
                      </Card>

                      {generateMutation.isPending ? (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                          <Loader2 className="h-12 w-12 animate-spin text-purple-600" />
                          <p className="text-lg">Generating your proposal...</p>
                          <p className="text-sm text-muted-foreground">This may take a moment</p>
                        </div>
                      ) : generatedProposalUrl ? (
                        <Card className="border-green-500 bg-green-50 dark:bg-green-900/10">
                          <CardContent className="py-8 text-center">
                            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-green-800 dark:text-green-200 mb-2">
                              Proposal Generated Successfully!
                            </h3>
                            <p className="text-green-600 dark:text-green-300 mb-6">
                              Your investment proposal is ready for download and sharing
                            </p>

                            {generatedProposalData?.shareToken && (
                              <div className="mb-6 p-4 bg-white dark:bg-muted rounded-lg border">
                                <Label className="text-sm text-muted-foreground dark:text-muted-foreground block mb-2">Shareable Link</Label>
                                <div className="flex items-center gap-2">
                                  <Input
                                    value={`${baseUrl}/proposal/${generatedProposalData.shareToken}`}
                                    readOnly
                                    className="font-mono text-sm"
                                  />
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => copyToClipboard(`${baseUrl}/proposal/${generatedProposalData.shareToken}`, "Proposal link")}
                                    data-testid="button-copy-link"
                                  >
                                    <Copy className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            )}

                            <div className="flex justify-center gap-4 flex-wrap">
                              <Button onClick={handleDownload} data-testid="button-download-proposal">
                                <Download className="h-4 w-4 mr-2" />
                                Download PDF
                              </Button>
                              <Button 
                                variant="outline"
                                onClick={() => {
                                  if (generatedProposalData) {
                                    setSelectedProposal(generatedProposalData);
                                    setShowShareDialog(true);
                                  }
                                }}
                                className="border-green-500 text-green-700 hover:bg-green-50"
                                data-testid="button-share-proposal"
                              >
                                <Send className="h-4 w-4 mr-2" />
                                Share Proposal
                              </Button>
                              <Button 
                                variant="outline" 
                                onClick={() => setActiveTab("proposals")}
                                data-testid="button-view-proposals"
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                View Proposals
                              </Button>
                              <Button variant="outline" onClick={() => {
                                setGeneratedProposalUrl(null);
                                setGeneratedProposalData(null);
                                setCurrentStep(1);
                                setConfig(defaultConfig);
                                setSelectedClient(null);
                              }}>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Create Another
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ) : (
                        <Card>
                          <CardContent className="py-8 text-center">
                            <Sparkles className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                            <h3 className="text-lg font-medium mb-2">Ready to Generate</h3>
                            <p className="text-muted-foreground mb-6">
                              Click the button below to create your proposal PDF
                            </p>
                            <Button 
                              size="lg"
                              onClick={() => generateMutation.mutate()}
                              disabled={!canProceed()}
                              className="bg-purple-600 hover:bg-purple-700"
                              data-testid="button-generate-proposal"
                            >
                              <Sparkles className="h-5 w-5 mr-2" />
                              Generate Proposal
                            </Button>
                          </CardContent>
                        </Card>
                      )}

                      <Card className="mt-6">
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Shield className="h-5 w-5 text-primary" />
                            SEBI Audit & Compliance Export
                          </CardTitle>
                          <CardDescription>
                            Export proposal data for regulatory audit and compliance records
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <SEBIAuditExport
                            prospectId={selectedClient?.id?.toString()}
                            proposalId={generatedProposalData?.id?.toString()}
                            onExportComplete={(result) => {
                              console.log('SEBI Audit export complete:', result);
                            }}
                          />
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}
              </CardContent>

              <CardFooter className="flex justify-between border-t pt-6">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  disabled={currentStep === 1}
                  data-testid="button-previous"
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>
                
                {currentStep < 8 && (
                  <Button
                    onClick={handleNext}
                    disabled={!canProceed()}
                    className="bg-purple-600 hover:bg-purple-700"
                    data-testid="button-next"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="proposals">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground dark:text-muted-foreground">Total</p>
                      <p className="text-2xl font-bold">{stats.total}</p>
                    </div>
                    <FileText className="w-8 h-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground dark:text-muted-foreground">Draft</p>
                      <p className="text-2xl font-bold text-muted-foreground">{stats.draft}</p>
                    </div>
                    <Clock className="w-8 h-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground dark:text-muted-foreground">Shared</p>
                      <p className="text-2xl font-bold text-blue-600">{stats.shared}</p>
                    </div>
                    <Send className="w-8 h-8 text-blue-400" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground dark:text-muted-foreground">Viewed</p>
                      <p className="text-2xl font-bold text-green-600">{stats.viewed}</p>
                    </div>
                    <Eye className="w-8 h-8 text-green-400" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground dark:text-muted-foreground">Converted</p>
                      <p className="text-2xl font-bold text-purple-600">{stats.converted}</p>
                    </div>
                    <CheckCircle2 className="w-8 h-8 text-purple-400" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground dark:text-muted-foreground">Total Views</p>
                      <p className="text-2xl font-bold text-indigo-600">{stats.totalViews}</p>
                    </div>
                    <BarChart3 className="w-8 h-8 text-indigo-400" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Your Proposals</CardTitle>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Search proposals..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-64"
                      data-testid="input-search-proposals"
                    />
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="w-32" data-testid="select-filter-status">
                        <SelectValue placeholder="All Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="shared">Shared</SelectItem>
                        <SelectItem value="viewed">Viewed</SelectItem>
                        <SelectItem value="converted">Converted</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {proposalsLoading ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-purple-600" />
                    <p className="mt-2 text-muted-foreground">Loading proposals...</p>
                  </div>
                ) : filteredProposals.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No proposals yet</h3>
                    <p className="text-muted-foreground dark:text-muted-foreground mb-4">Create your first proposal to start acquiring new clients</p>
                    <Button 
                      onClick={() => setActiveTab("create")} 
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create First Proposal
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Prospect Name</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Views</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProposals.map((proposal) => (
                        <TableRow key={proposal.id} data-testid={`row-proposal-${proposal.id}`}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{proposal.prospectName}</p>
                              <p className="text-xs text-muted-foreground">{proposal.prospectEmail || proposal.prospectMobile || '-'}</p>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-48 truncate" title={proposal.proposalTitle}>
                            {proposal.proposalTitle}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {proposal.proposalType === 'sample_portfolio' ? 'Portfolio Analysis' : 'Fresh Investment'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={PROPOSAL_STATUS_COLORS[proposal.status || 'draft']}>
                              {(proposal.status || 'draft').charAt(0).toUpperCase() + (proposal.status || 'draft').slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Eye className="w-3 h-3 text-muted-foreground" />
                              <span>{proposal.viewCount || 0}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(proposal.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950"
                                onClick={() => {
                                  setSelectedProposal(proposal);
                                  setShowPreviewDialog(true);
                                }}
                                data-testid={`btn-preview-${proposal.id}`}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-green-600 hover:text-green-800 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950"
                                onClick={() => {
                                  setSelectedProposal(proposal);
                                  setShowShareDialog(true);
                                }}
                                data-testid={`btn-share-${proposal.id}`}
                              >
                                <Send className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:text-foreground hover:bg-muted dark:text-muted-foreground dark:hover:bg-muted"
                                onClick={() => copyToClipboard(`${baseUrl}/proposal/${proposal.shareToken}`, "Proposal link")}
                                data-testid={`btn-copy-${proposal.id}`}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-800 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                                onClick={() => deleteProposalMutation.mutate(proposal.id)}
                                data-testid={`btn-delete-${proposal.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Share Proposal</DialogTitle>
            <DialogDescription>
              Share this proposal with {selectedProposal?.prospectName || selectedClient?.fullName}
            </DialogDescription>
          </DialogHeader>

          {(selectedProposal || generatedProposalData) && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Proposal Link</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    value={`${baseUrl}/proposal/${selectedProposal?.shareToken || generatedProposalData?.shareToken}`}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(`${baseUrl}/proposal/${selectedProposal?.shareToken || generatedProposalData?.shareToken}`, "Proposal link")}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {selectedProposal?.referralCode && (
                <div className="space-y-2">
                  <Label>Onboarding Link (for signup)</Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      value={`${baseUrl}/onboarding?ref=${selectedProposal.referralCode}`}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(`${baseUrl}/onboarding?ref=${selectedProposal.referralCode}`, "Onboarding link")}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950"
                  onClick={() => {
                    if (selectedProposal?.id) {
                      shareProposalMutation.mutate({ id: selectedProposal.id, shareVia: 'email' });
                    }
                  }}
                  disabled={shareProposalMutation.isPending || !selectedProposal?.id}
                  data-testid="btn-share-email"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Send via Email
                </Button>
                <Button
                  variant="outline"
                  className="border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-950"
                  onClick={() => {
                    const proposal = selectedProposal || generatedProposalData;
                    const prospectName = proposal?.prospectName || selectedClient?.fullName || 'there';
                    const shareToken = proposal?.shareToken;
                    const phone = proposal?.prospectMobile?.replace(/[^0-9]/g, '') || selectedClient?.phone?.replace(/[^0-9]/g, '') || '';
                    const message = encodeURIComponent(`Hi ${prospectName}, I've prepared a personalized investment proposal for you. View it here: ${baseUrl}/proposal/${shareToken}`);
                    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
                    if (selectedProposal?.id) {
                      shareProposalMutation.mutate({ id: selectedProposal.id, shareVia: 'whatsapp' });
                    }
                  }}
                  data-testid="btn-share-whatsapp"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Send via WhatsApp
                </Button>
              </div>

              <div className="bg-indigo-50 dark:bg-indigo-950 rounded-lg p-4">
                <h4 className="font-medium text-sm text-indigo-800 dark:text-indigo-200 mb-2">How it works</h4>
                <ol className="text-sm text-indigo-700 dark:text-indigo-300 space-y-1 list-decimal list-inside">
                  <li>Share the proposal link with your prospect</li>
                  <li>They view the personalized investment plan</li>
                  <li>They click "Get Started" to begin onboarding</li>
                  <li>You get notified when they sign up</li>
                </ol>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShareDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedProposal?.proposalTitle}</DialogTitle>
            <DialogDescription>
              Proposal for {selectedProposal?.prospectName}
            </DialogDescription>
          </DialogHeader>

          {selectedProposal && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Eye className="w-4 h-4" /> {selectedProposal.viewCount} views
                </span>
                <Badge className={PROPOSAL_STATUS_COLORS[selectedProposal.status]}>
                  {selectedProposal.status}
                </Badge>
                {selectedProposal.sharedViaEmail && <Badge variant="outline"><Mail className="w-3 h-3 mr-1" />Email</Badge>}
                {selectedProposal.sharedViaWhatsApp && <Badge variant="outline"><MessageSquare className="w-3 h-3 mr-1" />WhatsApp</Badge>}
              </div>

              {selectedProposal.executiveSummary && (
                <div>
                  <h4 className="font-medium mb-1">Executive Summary</h4>
                  <p className="text-sm text-muted-foreground dark:text-muted-foreground">{selectedProposal.executiveSummary}</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Total Investment</p>
                    <p className="text-lg font-bold">₹{parseFloat(selectedProposal.totalInvestmentAmount || '0').toLocaleString('en-IN')}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Expected Returns</p>
                    <p className="text-lg font-bold text-green-600">{selectedProposal.projectedReturns}% p.a.</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Projected Value</p>
                    <p className="text-lg font-bold text-purple-600">₹{parseFloat(selectedProposal.projectedValue || '0').toLocaleString('en-IN')}</p>
                  </CardContent>
                </Card>
              </div>

              {selectedProposal.recommendations && selectedProposal.recommendations.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Recommendations</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Action</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Allocation</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedProposal.recommendations.map((rec: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <Badge 
                              className={`text-xs ${
                                rec.recommendationType === 'BUY' ? 'bg-green-100 text-green-700' :
                                rec.recommendationType === 'SELL' ? 'bg-red-100 text-red-700' :
                                rec.recommendationType === 'SWITCH' ? 'bg-amber-100 text-amber-700' :
                                'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {rec.recommendationType || 'BUY'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{rec.productName}</TableCell>
                          <TableCell>{rec.category}</TableCell>
                          <TableCell>₹{rec.recommendedAmount?.toLocaleString('en-IN')}</TableCell>
                          <TableCell>{rec.allocationPercentage}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>Close</Button>
            <Button 
              onClick={() => {
                setShowPreviewDialog(false);
                setShowShareDialog(true);
              }}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Send className="w-4 h-4 mr-2" />
              Share Proposal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
