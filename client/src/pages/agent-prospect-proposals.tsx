import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PortfolioEditor } from "@/components/portfolio/PortfolioEditor";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Plus,
  FileText,
  Send,
  Eye,
  Copy,
  ExternalLink,
  Trash2,
  Pencil,
  TrendingUp,
  Target,
  Wallet,
  Users,
  BarChart3,
  RefreshCw,
  Mail,
  MessageSquare,
  Link2,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
  PieChart,
  Building2,
  User,
  Search,
  Loader2,
  X,
  Check,
  AlertCircle,
  Upload,
  FileUp,
  Info,
  TrendingDown,
  Scale,
  Briefcase
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Link } from "wouter";

// Product types for portfolio entry
const PRODUCT_TYPES = [
  { value: "mutual_fund", label: "Mutual Fund", color: "bg-blue-500" },
  { value: "pms", label: "PMS", color: "bg-purple-500" },
  { value: "aif", label: "AIF", color: "bg-indigo-500" },
  { value: "equity", label: "Stocks", color: "bg-green-500" },
  { value: "bond", label: "Bonds/NCDs", color: "bg-amber-500" },
  { value: "etf", label: "ETF", color: "bg-cyan-500" },
  { value: "fd", label: "Fixed Deposit", color: "bg-orange-500" },
  { value: "insurance", label: "Insurance/ULIP", color: "bg-pink-500" },
  { value: "gold", label: "Gold", color: "bg-yellow-500" },
  { value: "real_estate", label: "Real Estate", color: "bg-stone-500" },
  { value: "other", label: "Other", color: "bg-muted" },
];

interface PortfolioHolding {
  id: string;
  productType: string;
  productId?: string;
  productName: string;
  quantity: number;
  currentPrice: number | null;
  currentValue: number;
  returns1y: number | null;
  category?: string;
  issuer?: string;
  isManual: boolean;
  purchaseDate?: string;
  purchasePrice?: number;
  // AI recommendation fields populated after analysis
  aiRecommendation?: 'BUY' | 'SELL' | 'HOLD' | 'SWITCH';
  aiRationale?: string;
  aiMetrics?: {
    sharpeRatio?: number;
    alpha?: number;
    beta?: number;
    standardDeviation?: number;
    maxDrawdown?: number;
    categoryRank?: string;
    benchmarkReturn?: number;
    expenseRatio?: number;
    exitLoadApplicable?: boolean;
    exitLoadPercent?: number;
    holdingPeriodDays?: number;
    capitalGainsTaxType?: 'STCG' | 'LTCG';
    taxRate?: number;
    estimatedTax?: number;
  };
}

interface SearchProduct {
  id: string;
  name: string;
  productType: string;
  category: string | null;
  issuer: string | null;
  currentPrice: number | null;
  returns1y: number | null;
  returns3y: number | null;
  riskLevel: string | null;
  identifier: string | null;
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
  draft: "bg-muted text-muted-foreground",
  shared: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  viewed: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  converted: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  expired: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const GOAL_TYPE_OPTIONS = [
  { value: "retirement", label: "Retirement Planning" },
  { value: "child_education", label: "Child Education" },
  { value: "wealth_creation", label: "Wealth Creation" },
  { value: "home_purchase", label: "Home Purchase" },
  { value: "emergency_fund", label: "Emergency Fund" },
  { value: "tax_saving", label: "Tax Saving" },
  { value: "regular_income", label: "Regular Income" },
  { value: "custom", label: "Custom Goal" },
];

const CLIENT_TYPE_OPTIONS = [
  { value: "individual", label: "Individual", description: "Retail investor with standard investment needs" },
  { value: "hni", label: "High Net Worth (HNI)", description: "₹50L+ investible surplus, eligible for PMS/AIF" },
  { value: "ultra_hni", label: "Ultra HNI", description: "₹5Cr+ investible, access to exclusive products" },
  { value: "corporate", label: "Corporate/Business", description: "Company treasury or business investment" },
  { value: "nri", label: "NRI", description: "Non-Resident Indian with forex considerations" },
  { value: "trust", label: "Trust/Family Office", description: "Trust or family office with special requirements" },
  { value: "institutional", label: "Institutional", description: "Banks, NBFCs, or institutional investors" },
];

export default function AgentProspectProposalsPage() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [proposalToDelete, setProposalToDelete] = useState<ProspectProposal | null>(null);
  const [selectedProposal, setSelectedProposal] = useState<ProspectProposal | null>(null);
  const [editFormData, setEditFormData] = useState({
    prospectName: "",
    prospectEmail: "",
    prospectMobile: "",
    proposalTitle: "",
    totalInvestmentAmount: "",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  
  // Create proposal form state
  const [proposalType, setProposalType] = useState<"sample_portfolio" | "fresh_investment">("fresh_investment");
  const [prospectName, setProspectName] = useState("");
  const [prospectEmail, setProspectEmail] = useState("");
  const [prospectMobile, setProspectMobile] = useState("");
  const [proposalTitle, setProposalTitle] = useState("");
  
  // Sample portfolio fields
  const [portfolioValue, setPortfolioValue] = useState("");
  const [holdingsText, setHoldingsText] = useState("");
  const [portfolioHoldings, setPortfolioHoldings] = useState<any[]>([]);
  const [useAdvancedEditor, setUseAdvancedEditor] = useState(false);
  
  // Quick Entry with product search
  const [quickHoldings, setQuickHoldings] = useState<PortfolioHolding[]>([]);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [productSearchResults, setProductSearchResults] = useState<SearchProduct[]>([]);
  
  // PDF Upload state
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [activeHoldingId, setActiveHoldingId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // PAN and Client type for AI-tailored recommendations
  const [prospectPan, setProspectPan] = useState("");
  const [clientType, setClientType] = useState("individual");
  const [panAutoDetected, setPanAutoDetected] = useState(false);
  
  // Product category filter for AI recommendations
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    "mutual_fund", "bond", "pms", "aif", "etf"
  ]);

const RECOMMENDATION_CATEGORIES = [
  { value: "mutual_fund", label: "Mutual Funds", description: "Equity, Debt, Hybrid schemes" },
  { value: "bond", label: "Bonds/NCDs", description: "Government securities, Corporate bonds" },
  { value: "pms", label: "PMS", description: "Portfolio Management Services (₹50L+)" },
  { value: "aif", label: "AIF", description: "Alternative Investment Funds (₹1Cr+)" },
  { value: "mld", label: "MLDs", description: "Market Linked Debentures" },
  { value: "etf", label: "ETFs", description: "Exchange Traded Funds" },
  { value: "fd", label: "Fixed Deposits", description: "Bank & Corporate FDs" },
  { value: "gold", label: "Gold", description: "SGBs, Gold ETFs, Digital Gold" },
  { value: "insurance", label: "Insurance/ULIP", description: "Term, Endowment, ULIPs" },
];

  // Auto-detect client type from PAN (4th character indicates entity type)
  const autoDetectClientTypeFromPan = (pan: string) => {
    if (!pan || pan.length < 4) return null;
    const entityChar = pan.charAt(3).toUpperCase();
    // PAN 4th character entity mapping:
    // P - Individual, C - Company, H - HUF, F - Firm/LLP, T - Trust, A - AOP, B - BOI, G - Government, L - Local Authority, J - Artificial Juridical Person
    const entityMap: Record<string, string> = {
      'P': 'individual', // Individual - could be upgraded to HNI based on investment amount
      'C': 'corporate',  // Company
      'H': 'trust',      // Hindu Undivided Family
      'F': 'corporate',  // Firm/LLP
      'T': 'trust',      // Trust
      'A': 'institutional', // Association of Persons
      'B': 'institutional', // Body of Individuals
      'G': 'institutional', // Government
      'L': 'institutional', // Local Authority
      'J': 'institutional', // Artificial Juridical Person
    };
    return entityMap[entityChar] || null;
  };

  const handlePanChange = (value: string) => {
    const upperValue = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    setProspectPan(upperValue);
    setPanAutoDetected(false);
    
    // Auto-detect when valid PAN format is entered
    if (upperValue.length === 10 && /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(upperValue)) {
      const detectedType = autoDetectClientTypeFromPan(upperValue);
      if (detectedType) {
        setClientType(detectedType);
        setPanAutoDetected(true);
      }
    }
  };
  
  // Fresh investment fields
  const [goalType, setGoalType] = useState("wealth_creation");
  const [targetAmount, setTargetAmount] = useState("");
  const [timeHorizon, setTimeHorizon] = useState("medium_term");
  const [monthlyInvestment, setMonthlyInvestment] = useState("");
  const [lumpsum, setLumpsum] = useState("");
  const [riskTolerance, setRiskTolerance] = useState("moderate");
  
  // Include existing portfolio analysis toggle
  const [includeExistingPortfolio, setIncludeExistingPortfolio] = useState(false);
  
  // Generated proposal
  const [generatedProposal, setGeneratedProposal] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: proposalsData, isLoading } = useQuery<{ proposals: ProspectProposal[]; stats: ProposalStats }>({
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

  const generateProposalMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/agent/prospect-proposals/generate", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" }
      });
    },
    onSuccess: (data) => {
      console.log("[AI Generate] Response received:", data);
      if (data?.success && data?.generated) {
        console.log("[AI Generate] Setting generated proposal:", data.generated);
        setGeneratedProposal(data.generated);
        toast({ title: "Proposal Generated", description: "AI recommendations are ready for review" });
      } else if (data?.generated) {
        console.log("[AI Generate] No success flag but has generated data");
        setGeneratedProposal(data.generated);
        toast({ title: "Proposal Generated", description: "AI recommendations are ready for review" });
      } else {
        console.error("[AI Generate] Unexpected response structure:", data);
        toast({ title: "Generation Issue", description: "Response received but no recommendations found", variant: "destructive" });
      }
    },
    onError: (error: any) => {
      console.error("[AI Generate] Error:", error);
      toast({ title: "Generation Failed", description: error.message, variant: "destructive" });
    }
  });

  const createProposalMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/agent/prospect-proposals", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" }
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "Proposal Created", description: "You can now share it with the prospect" });
        queryClient.invalidateQueries({ queryKey: ["/api/agent/prospect-proposals"] });
        resetForm();
        setShowCreateDialog(false);
        setSelectedProposal(data.proposal);
        setShowShareDialog(true);
      }
    },
    onError: (error: any) => {
      toast({ title: "Creation Failed", description: error.message, variant: "destructive" });
    }
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
      setShowDeleteConfirm(false);
      setProposalToDelete(null);
    },
    onError: (error: any) => {
      toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
    }
  });

  const updateProposalMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest(`/api/agent/prospect-proposals/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" }
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "Proposal Updated", description: "Changes saved successfully" });
        queryClient.invalidateQueries({ queryKey: ["/api/agent/prospect-proposals"] });
        setShowEditDialog(false);
        setSelectedProposal(null);
      }
    },
    onError: (error: any) => {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    }
  });

  const openEditDialog = (proposal: ProspectProposal) => {
    setSelectedProposal(proposal);
    setEditFormData({
      prospectName: proposal.prospectName || "",
      prospectEmail: proposal.prospectEmail || "",
      prospectMobile: proposal.prospectMobile || "",
      proposalTitle: proposal.proposalTitle || "",
      totalInvestmentAmount: proposal.totalInvestmentAmount || "",
    });
    setShowEditDialog(true);
  };

  const handleEditSubmit = () => {
    if (!selectedProposal) return;
    updateProposalMutation.mutate({
      id: selectedProposal.id,
      data: editFormData
    });
  };

  const openDeleteConfirm = (proposal: ProspectProposal) => {
    setProposalToDelete(proposal);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (proposalToDelete) {
      deleteProposalMutation.mutate(proposalToDelete.id);
    }
  };

  const resetForm = () => {
    setProposalType("fresh_investment");
    setProspectName("");
    setProspectEmail("");
    setProspectMobile("");
    setProspectPan("");
    setProposalTitle("");
    setPortfolioValue("");
    setHoldingsText("");
    setQuickHoldings([]);
    setClientType("individual");
    setPanAutoDetected(false);
    setGoalType("wealth_creation");
    setTargetAmount("");
    setTimeHorizon("medium_term");
    setMonthlyInvestment("");
    setLumpsum("");
    setRiskTolerance("moderate");
    setIncludeExistingPortfolio(false);
    setGeneratedProposal(null);
    setSelectedCategories(["mutual_fund", "bond", "pms", "aif", "etf"]);
  };

  // Product search function
  const searchProducts = useCallback(async (query: string, productType: string) => {
    if (!query || query.length < 2) {
      setProductSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const res = await fetch(`/api/store/products/search?query=${encodeURIComponent(query)}&productType=${productType}&limit=15`);
      const data = await res.json();
      setProductSearchResults(data.products || []);
    } catch (error) {
      console.error("Product search error:", error);
      setProductSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced product search
  const handleProductSearch = useCallback((query: string, productType: string) => {
    setProductSearchQuery(query);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      searchProducts(query, productType);
    }, 300);
  }, [searchProducts]);

  // Add new holding
  const addHolding = () => {
    const newHolding: PortfolioHolding = {
      id: `holding-${Date.now()}`,
      productType: "mutual_fund",
      productName: "",
      quantity: 0,
      currentPrice: null,
      currentValue: 0,
      returns1y: null,
      isManual: false,
    };
    setQuickHoldings([...quickHoldings, newHolding]);
    setActiveHoldingId(newHolding.id);
  };

  // Handle PDF upload for holding reports
  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast({ title: "Invalid file type", description: "Please upload a PDF file", variant: "destructive" });
      return;
    }

    setIsUploadingPdf(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/agent/parse-holding-report', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to parse PDF');
      }

      const result = await response.json();
      
      if (result.success && result.parsedData) {
        const { clientInfo, summary, holdings } = result.parsedData;
        
        // Auto-fill client info if available
        if (clientInfo.name && !prospectName) {
          setProspectName(clientInfo.name);
        }
        if (clientInfo.pan) {
          handlePanChange(clientInfo.pan);
        }
        
        // Convert parsed holdings to quickHoldings format
        const newHoldings: PortfolioHolding[] = holdings.map((h: any, idx: number) => ({
          id: `pdf-holding-${Date.now()}-${idx}`,
          productType: "mutual_fund",
          productName: h.fundName,
          quantity: h.units || 0,
          currentPrice: h.nav || (h.currentValue / (h.units || 1)),
          currentValue: h.currentValue,
          returns1y: h.xirr || null,
          category: h.category,
          isManual: true,
        }));

        if (newHoldings.length > 0) {
          setQuickHoldings(prev => [...prev, ...newHoldings]);
          
          // Set portfolio value from summary
          if (summary.currentValue) {
            setPortfolioValue(summary.currentValue.toString());
          }
          
          toast({ 
            title: "Holdings imported successfully", 
            description: `Imported ${newHoldings.length} holdings from ${file.name}. Total value: ₹${summary.currentValue?.toLocaleString() || 'N/A'}` 
          });
        } else {
          toast({ 
            title: "No holdings found", 
            description: "Could not extract holdings from the PDF. Please add them manually.", 
            variant: "destructive" 
          });
        }
      }
    } catch (error: any) {
      console.error("PDF upload error:", error);
      toast({ 
        title: "Failed to parse PDF", 
        description: error.message || "Please try again or add holdings manually", 
        variant: "destructive" 
      });
    } finally {
      setIsUploadingPdf(false);
      // Reset file input
      if (pdfInputRef.current) {
        pdfInputRef.current.value = '';
      }
    }
  };

  // Update holding - always recalculate currentValue from final price and quantity
  const updateHolding = (id: string, updates: Partial<PortfolioHolding>) => {
    setQuickHoldings(holdings => 
      holdings.map(h => {
        if (h.id === id) {
          const updated = { ...h, ...updates };
          // Always recalculate current value using final price and quantity
          const finalPrice = updated.currentPrice ?? 0;
          const finalQty = updated.quantity ?? 0;
          updated.currentValue = finalPrice * finalQty;
          return updated;
        }
        return h;
      })
    );
  };

  // Select product from search results - preserve existing quantity
  const selectProduct = (holdingId: string, product: SearchProduct) => {
    setQuickHoldings(holdings => 
      holdings.map(h => {
        if (h.id === holdingId) {
          const newPrice = product.currentPrice ?? 0;
          const existingQty = h.quantity ?? 0;
          return {
            ...h,
            productId: product.id,
            productName: product.name,
            currentPrice: product.currentPrice,
            returns1y: product.returns1y,
            category: product.category || undefined,
            issuer: product.issuer || undefined,
            isManual: false,
            currentValue: newPrice * existingQty,
          };
        }
        return h;
      })
    );
    setSearchOpen(false);
    setProductSearchQuery("");
    setProductSearchResults([]);
  };

  // Remove holding
  const removeHolding = (id: string) => {
    setQuickHoldings(holdings => holdings.filter(h => h.id !== id));
  };

  // Calculate portfolio summary with proper guards against NaN
  const totalPortfolioValue = (Array.isArray(quickHoldings) ? quickHoldings : []).reduce((sum, h) => sum + (h.currentValue || 0), 0);
  const holdingsWithValue = (Array.isArray(quickHoldings) ? quickHoldings : []).filter(h => (h.currentValue || 0) > 0 && h.returns1y !== null);
  const weightedReturnNumerator = holdingsWithValue.reduce((sum, h) => sum + ((h.returns1y || 0) * (h.currentValue || 0)), 0);
  
  const portfolioSummary = {
    totalValue: totalPortfolioValue,
    totalHoldings: (Array.isArray(quickHoldings) ? quickHoldings : []).filter(h => h.productName).length,
    weightedReturn: totalPortfolioValue > 0 && holdingsWithValue.length > 0
      ? weightedReturnNumerator / totalPortfolioValue
      : 0,
    assetAllocation: (Array.isArray(quickHoldings) ? quickHoldings : []).filter(h => (h.currentValue || 0) > 0).reduce((acc, h) => {
      const type = PRODUCT_TYPES.find(p => p.value === h.productType)?.label || h.productType;
      acc[type] = (acc[type] || 0) + (h.currentValue || 0);
      return acc;
    }, {} as Record<string, number>),
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    
    let data: any = { 
      proposalType, 
      clientType, 
      selectedCategories,
      includeExistingPortfolio,
      prospectPan: prospectPan || undefined,
      prospectEmail: prospectEmail || undefined,
    };
    
    if (proposalType === "sample_portfolio") {
      let holdings: any[] = [];
      let totalValue = 0;
      
      if (useAdvancedEditor) {
        // Advanced editor mode - use portfolioHoldings
        holdings = portfolioHoldings.map(h => ({
          name: h.securityName || h.productName,
          type: h.assetClass || "mutual_fund",
          currentValue: h.currentValue || 0,
          allocation: 0,
          returns1Y: h.unrealizedGainLossPercent || 10,
        }));
        totalValue = parseFloat(portfolioValue) || (Array.isArray(holdings) ? holdings : []).reduce((sum, h) => sum + h.currentValue, 0);
      } else if (quickHoldings.length > 0) {
        // Quick entry mode with product search
        holdings = quickHoldings.filter(h => h.productName).map(h => ({
          name: h.productName,
          type: h.productType,
          currentValue: h.currentValue || 0,
          allocation: 0,
          returns1Y: h.returns1y || 10,
          quantity: h.quantity,
          currentPrice: h.currentPrice,
          category: h.category,
          issuer: h.issuer,
        }));
        totalValue = portfolioSummary.totalValue;
      } else {
        // Legacy text mode fallback
        holdings = holdingsText.split("\n").filter(h => h.trim()).map((line, idx) => {
          const parts = line.split(",").map(p => p.trim());
          return {
            name: parts[0] || `Holding ${idx + 1}`,
            type: "mutual_fund",
            currentValue: parseFloat(parts[1]) || 100000,
            allocation: 0,
            returns1Y: parseFloat(parts[2]) || 10,
          };
        });
        totalValue = parseFloat(portfolioValue) || (Array.isArray(holdings) ? holdings : []).reduce((sum, h) => sum + h.currentValue, 0);
      }
      
      holdings.forEach(h => { h.allocation = totalValue > 0 ? (h.currentValue / totalValue) * 100 : 0; });
      
      data.samplePortfolio = {
        totalValue,
        holdings,
        assetAllocation: portfolioSummary.assetAllocation
      };
    } else {
      data.investmentGoals = {
        goalType,
        targetAmount: parseFloat(targetAmount) || undefined,
        timeHorizon,
        monthlyInvestment: parseFloat(monthlyInvestment) || undefined,
        lumpsum: parseFloat(lumpsum) || undefined,
        riskTolerance,
      };
    }
    
    generateProposalMutation.mutate(data, {
      onSettled: () => setIsGenerating(false)
    });
  };

  const handleCreate = () => {
    if (!prospectName || !proposalTitle) {
      toast({ title: "Missing Information", description: "Please provide prospect name and proposal title", variant: "destructive" });
      return;
    }

    if (!generatedProposal) {
      toast({ title: "Generate First", description: "Please generate AI recommendations before creating the proposal", variant: "destructive" });
      return;
    }

    const data: any = {
      prospectName,
      prospectEmail,
      prospectMobile,
      prospectPan: prospectPan || undefined,
      proposalType,
      proposalTitle,
      clientType,
      executiveSummary: generatedProposal.executiveSummary,
      currentAnalysis: generatedProposal.currentAnalysis,
      recommendations: generatedProposal.recommendations,
      totalInvestmentAmount: generatedProposal.totalInvestmentAmount,
      projectedReturns: generatedProposal.projectedReturns,
      projectedValue: generatedProposal.projectedValue,
      targetAllocation: generatedProposal.targetAllocation,
    };

    if (proposalType === "sample_portfolio") {
      const holdings = holdingsText.split("\n").filter(h => h.trim()).map((line, idx) => {
        const parts = line.split(",").map(p => p.trim());
        return {
          name: parts[0] || `Holding ${idx + 1}`,
          type: "mutual_fund",
          currentValue: parseFloat(parts[1]) || 100000,
          allocation: 0,
        };
      });
      const totalValue = parseFloat(portfolioValue) || (Array.isArray(holdings) ? holdings : []).reduce((sum, h) => sum + h.currentValue, 0);
      data.samplePortfolio = { totalValue, holdings, assetAllocation: {} };
    } else {
      data.investmentGoals = {
        goalType,
        targetAmount: parseFloat(targetAmount) || undefined,
        timeHorizon,
        monthlyInvestment: parseFloat(monthlyInvestment) || undefined,
        lumpsum: parseFloat(lumpsum) || undefined,
        riskTolerance,
      };
    }

    createProposalMutation.mutate(data);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: `${label} copied to clipboard` });
  };

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="space-y-6 p-6" data-testid="prospect-proposals-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Portfolio Demo Proposals</h1>
          <p className="text-muted-foreground">Create and share investment proposals to acquire new clients</p>
        </div>
        <div className="flex gap-2">
          <Link href="/demo-proposal-builder">
            <Button variant="outline" className="border-purple-600 text-purple-600 hover:bg-purple-50" data-testid="btn-advanced-builder">
              <Sparkles className="w-4 h-4 mr-2" />
              Advanced Builder
            </Button>
          </Link>
          <Button 
            className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-foreground shadow-md"
            onClick={() => setShowCreateDialog(true)}
            data-testid="btn-create-proposal"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Proposal
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
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
                <p className="text-xs text-muted-foreground">Draft</p>
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
                <p className="text-xs text-muted-foreground">Shared</p>
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
                <p className="text-xs text-muted-foreground">Viewed</p>
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
                <p className="text-xs text-muted-foreground">Converted</p>
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
                <p className="text-xs text-muted-foreground">Total Views</p>
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
                data-testid="input-search"
              />
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-32" data-testid="select-filter">
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
          {isLoading ? (
            <div className="text-center py-8">Loading proposals...</div>
          ) : filteredProposals.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No proposals yet</h3>
              <p className="text-muted-foreground mb-4">Create your first proposal to start acquiring new clients</p>
              <Button onClick={() => setShowCreateDialog(true)} className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-foreground">
                <Plus className="w-4 h-4 mr-2" />
                Create First Proposal
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prospect</TableHead>
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
                      <Badge className={PROPOSAL_STATUS_COLORS[proposal.status]}>
                        {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
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
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
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
                            </TooltipTrigger>
                            <TooltipContent>Preview</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-amber-600 hover:text-amber-800 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950"
                                onClick={() => openEditDialog(proposal)}
                                data-testid={`btn-edit-${proposal.id}`}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
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
                            </TooltipTrigger>
                            <TooltipContent>Share</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:text-foreground hover:bg-muted"
                                onClick={() => copyToClipboard(`${baseUrl}/proposal/${proposal.shareToken}`, "Proposal link")}
                                data-testid={`btn-copy-${proposal.id}`}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copy Link</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-800 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                                onClick={() => openDeleteConfirm(proposal)}
                                data-testid={`btn-delete-${proposal.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Proposal Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Portfolio Demo Proposal</DialogTitle>
            <DialogDescription>
              Create a personalized investment proposal to share with prospective clients
            </DialogDescription>
          </DialogHeader>

          <Tabs value={proposalType} onValueChange={(v) => setProposalType(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="fresh_investment" className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                Fresh Investment
              </TabsTrigger>
              <TabsTrigger value="sample_portfolio" className="flex items-center gap-2">
                <PieChart className="w-4 h-4" />
                Portfolio Analysis
              </TabsTrigger>
            </TabsList>

            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Prospect Name *</Label>
                  <Input 
                    value={prospectName} 
                    onChange={(e) => setProspectName(e.target.value)}
                    placeholder="Enter prospect's name"
                    data-testid="input-prospect-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input 
                    type="email"
                    value={prospectEmail} 
                    onChange={(e) => setProspectEmail(e.target.value)}
                    placeholder="prospect@email.com"
                    data-testid="input-prospect-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mobile</Label>
                  <Input 
                    value={prospectMobile} 
                    onChange={(e) => setProspectMobile(e.target.value)}
                    placeholder="+91 XXXXXXXXXX"
                    data-testid="input-prospect-mobile"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Proposal Title *</Label>
                <Input 
                  value={proposalTitle} 
                  onChange={(e) => setProposalTitle(e.target.value)}
                  placeholder="e.g., Personalized Wealth Creation Strategy"
                  data-testid="input-proposal-title"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Client PAN (Optional)</Label>
                  <p className="text-xs text-muted-foreground">Enter PAN to auto-detect client type</p>
                  <div className="relative">
                    <Input 
                      value={prospectPan} 
                      onChange={(e) => handlePanChange(e.target.value)}
                      placeholder="ABCDE1234F"
                      maxLength={10}
                      className="uppercase"
                      data-testid="input-prospect-pan"
                    />
                    {panAutoDetected && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-xs">Auto-detected</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Client Type {panAutoDetected && <span className="text-green-600 text-xs ml-1">(from PAN)</span>}</Label>
                  <p className="text-xs text-muted-foreground">AI recommendations will be tailored based on client category</p>
                  <Select value={clientType} onValueChange={(val) => { setClientType(val); setPanAutoDetected(false); }}>
                    <SelectTrigger data-testid="select-client-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CLIENT_TYPE_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex flex-col">
                            <span>{opt.label}</span>
                            <span className="text-xs text-muted-foreground">{opt.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Product Category Selection for AI Recommendations */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">Product Categories for AI Recommendations</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="w-4 h-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Select which product categories the AI should consider when generating recommendations. HNI/Ultra HNI clients automatically unlock PMS and AIF options.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {RECOMMENDATION_CATEGORIES.map((cat) => {
                    const isDisabled = (cat.value === "pms" || cat.value === "aif") && 
                      !["hni", "ultra_hni", "institutional", "corporate"].includes(clientType);
                    return (
                      <div 
                        key={cat.value}
                        className={`flex items-start gap-2 p-2 rounded-lg border transition-colors ${
                          selectedCategories.includes(cat.value) 
                            ? "border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-950" 
                            : "border-border"
                        } ${isDisabled ? "opacity-50" : "cursor-pointer hover:bg-muted"}`}
                        onClick={() => {
                          if (isDisabled) return;
                          if (selectedCategories.includes(cat.value)) {
                            setSelectedCategories(selectedCategories.filter(c => c !== cat.value));
                          } else {
                            setSelectedCategories([...selectedCategories, cat.value]);
                          }
                        }}
                      >
                        <Checkbox
                          checked={selectedCategories.includes(cat.value)}
                          disabled={isDisabled}
                          onCheckedChange={(checked) => {
                            if (isDisabled) return;
                            if (checked) {
                              setSelectedCategories([...selectedCategories, cat.value]);
                            } else {
                              setSelectedCategories(selectedCategories.filter(c => c !== cat.value));
                            }
                          }}
                          className="mt-0.5"
                          data-testid={`checkbox-category-${cat.value}`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{cat.label}</p>
                          <p className="text-xs text-muted-foreground truncate">{cat.description}</p>
                          {isDisabled && (
                            <p className="text-xs text-amber-600 mt-0.5">HNI/Ultra HNI only</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Selected: {selectedCategories.length} categories
                </p>
              </div>

              <Separator />

              <TabsContent value="fresh_investment" className="space-y-4 mt-0">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Investment Goal</Label>
                    <Select value={goalType} onValueChange={setGoalType}>
                      <SelectTrigger data-testid="select-goal-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GOAL_TYPE_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Target Amount (Optional)</Label>
                    <Input 
                      type="number"
                      value={targetAmount} 
                      onChange={(e) => setTargetAmount(e.target.value)}
                      placeholder="₹ 50,00,000"
                      data-testid="input-target-amount"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Time Horizon</Label>
                    <Select value={timeHorizon} onValueChange={setTimeHorizon}>
                      <SelectTrigger data-testid="select-time-horizon">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ultra_short_term">Ultra Short Term (7 days - 1 year)</SelectItem>
                        <SelectItem value="short_term">Short Term (1-3 years)</SelectItem>
                        <SelectItem value="medium_term">Medium Term (3-7 years)</SelectItem>
                        <SelectItem value="long_term">Long Term (7+ years)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Monthly SIP (Optional)</Label>
                    <Input 
                      type="number"
                      value={monthlyInvestment} 
                      onChange={(e) => setMonthlyInvestment(e.target.value)}
                      placeholder="₹ 25,000"
                      data-testid="input-monthly-sip"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Lumpsum (Optional)</Label>
                    <Input 
                      type="number"
                      value={lumpsum} 
                      onChange={(e) => setLumpsum(e.target.value)}
                      placeholder="₹ 5,00,000"
                      data-testid="input-lumpsum"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Risk Tolerance</Label>
                  <Select value={riskTolerance} onValueChange={setRiskTolerance}>
                    <SelectTrigger data-testid="select-risk-tolerance">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conservative">Conservative - Capital preservation focus</SelectItem>
                      <SelectItem value="moderately_conservative">Moderately Conservative - Stability with some growth</SelectItem>
                      <SelectItem value="moderate">Moderate - Balanced growth and stability</SelectItem>
                      <SelectItem value="moderately_aggressive">Moderately Aggressive - Growth oriented</SelectItem>
                      <SelectItem value="aggressive">Aggressive - Maximum growth potential</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              <TabsContent value="sample_portfolio" className="space-y-4 mt-0">
                {/* Mode Toggle */}
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="advanced-toggle" className="text-sm">
                      {useAdvancedEditor ? "Advanced ISIN-based Entry" : "Quick Product Entry"}
                    </Label>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setUseAdvancedEditor(!useAdvancedEditor)}
                    className="text-xs"
                    data-testid="btn-toggle-editor"
                  >
                    {useAdvancedEditor ? "Switch to Quick Entry" : "Use Advanced Editor"}
                  </Button>
                </div>

                {useAdvancedEditor ? (
                  /* Advanced ISIN-based Editor */
                  <div className="border rounded-lg p-4">
                    <PortfolioEditor
                      onSave={(holdings, summary) => {
                        setPortfolioHoldings(holdings);
                        setPortfolioValue(summary.totalCurrentValue.toString());
                      }}
                      initialHoldings={portfolioHoldings}
                    />
                  </div>
                ) : (
                  /* Quick Product Entry Mode with Search */
                  <div className="space-y-4">
                    {/* Holdings List */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Client Holdings</Label>
                        <div className="flex items-center gap-2">
                          <input
                            type="file"
                            ref={pdfInputRef}
                            accept=".pdf"
                            onChange={handlePdfUpload}
                            className="hidden"
                            data-testid="input-pdf-upload"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => pdfInputRef.current?.click()}
                            disabled={isUploadingPdf}
                            className="text-xs"
                            data-testid="btn-upload-pdf"
                          >
                            {isUploadingPdf ? (
                              <>
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                Parsing...
                              </>
                            ) : (
                              <>
                                <FileUp className="w-3 h-3 mr-1" />
                                Upload PDF
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={addHolding}
                            className="text-xs"
                            data-testid="btn-add-holding"
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add Holding
                          </Button>
                        </div>
                      </div>

                      {quickHoldings.length === 0 ? (
                        <div className="border-2 border-dashed rounded-lg p-6 text-center text-muted-foreground">
                          <Wallet className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm">No holdings added yet</p>
                          <p className="text-xs mt-1">Upload a holding report PDF or add holdings manually</p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                          {quickHoldings.map((holding, idx) => (
                            <div 
                              key={holding.id} 
                              className="border rounded-lg p-3 bg-card space-y-2"
                            >
                              <div className="flex items-start gap-2">
                                {/* Product Type */}
                                <div className="w-28">
                                  <Select 
                                    value={holding.productType} 
                                    onValueChange={(v) => {
                                      updateHolding(holding.id, { productType: v, productName: "", productId: undefined, currentPrice: null, returns1y: null });
                                    }}
                                  >
                                    <SelectTrigger className="h-9 text-xs" data-testid={`select-product-type-${idx}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {PRODUCT_TYPES.map(pt => (
                                        <SelectItem key={pt.value} value={pt.value} className="text-xs">
                                          {pt.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                {/* Product Name with Search */}
                                <div className="flex-1">
                                  <Popover 
                                    open={searchOpen && activeHoldingId === holding.id} 
                                    onOpenChange={(open) => {
                                      if (!open) {
                                        setSearchOpen(false);
                                        setProductSearchQuery("");
                                        setProductSearchResults([]);
                                      }
                                    }}
                                  >
                                    <PopoverTrigger asChild>
                                      <div className="relative">
                                        <Input
                                          placeholder={
                                            ["fd", "insurance", "gold", "real_estate", "other"].includes(holding.productType)
                                              ? "Enter product name manually"
                                              : "Search product name..."
                                          }
                                          value={
                                            activeHoldingId === holding.id && searchOpen 
                                              ? productSearchQuery 
                                              : holding.productName
                                          }
                                          onChange={(e) => {
                                            const value = e.target.value;
                                            if (!["fd", "insurance", "gold", "real_estate", "other"].includes(holding.productType)) {
                                              // For searchable product types
                                              if (activeHoldingId !== holding.id) {
                                                setActiveHoldingId(holding.id);
                                              }
                                              if (!searchOpen) {
                                                setSearchOpen(true);
                                              }
                                              // handleProductSearch sets productSearchQuery and triggers debounced search
                                              handleProductSearch(value, holding.productType);
                                            } else {
                                              // For manual entry product types
                                              updateHolding(holding.id, { productName: value, isManual: true });
                                            }
                                          }}
                                          onFocus={() => {
                                            if (!["fd", "insurance", "gold", "real_estate", "other"].includes(holding.productType)) {
                                              setActiveHoldingId(holding.id);
                                              setSearchOpen(true);
                                              // Initialize search query with existing product name if any
                                              setProductSearchQuery(holding.productName || "");
                                            }
                                          }}
                                          className="h-9 text-xs pr-8"
                                          data-testid={`input-product-name-${idx}`}
                                        />
                                        {isSearching && activeHoldingId === holding.id && (
                                          <Loader2 className="w-4 h-4 absolute right-2 top-2.5 animate-spin text-muted-foreground" />
                                        )}
                                        {holding.productName && !isSearching && !(activeHoldingId === holding.id && searchOpen) && (
                                          <Check className="w-4 h-4 absolute right-2 top-2.5 text-green-500" />
                                        )}
                                      </div>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80 p-0" align="start">
                                      {productSearchResults.length > 0 ? (
                                        <div className="max-h-60 overflow-y-auto">
                                          {productSearchResults.map((product) => (
                                            <div
                                              key={product.id}
                                              className="px-3 py-2 hover:bg-muted cursor-pointer border-b last:border-b-0"
                                              onClick={() => selectProduct(holding.id, product)}
                                            >
                                              <p className="text-sm font-medium truncate">{product.name}</p>
                                              <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-xs text-muted-foreground">{product.issuer}</span>
                                                {product.currentPrice && (
                                                  <span className="text-xs text-blue-600">NAV: ₹{product.currentPrice.toFixed(2)}</span>
                                                )}
                                                {product.returns1y !== null && (
                                                  <span className={`text-xs ${product.returns1y >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    1Y: {product.returns1y.toFixed(1)}%
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      ) : productSearchQuery.length >= 2 ? (
                                        <div className="p-4 text-center text-muted-foreground text-sm">
                                          {isSearching ? "Searching..." : "No products found"}
                                        </div>
                                      ) : (
                                        <div className="p-4 text-center text-muted-foreground text-sm">
                                          Type at least 2 characters to search
                                        </div>
                                      )}
                                    </PopoverContent>
                                  </Popover>
                                </div>

                                {/* Quantity Input */}
                                <div className="w-24">
                                  <Input
                                    type="number"
                                    placeholder="Qty"
                                    value={holding.quantity || ""}
                                    onChange={(e) => updateHolding(holding.id, { quantity: parseFloat(e.target.value) || 0 })}
                                    className="h-9 text-xs"
                                    data-testid={`input-quantity-${idx}`}
                                  />
                                </div>

                                {/* Manual Price (for manual entries or override) */}
                                {["fd", "insurance", "gold", "real_estate", "other"].includes(holding.productType) && (
                                  <div className="w-28">
                                    <Input
                                      type="number"
                                      placeholder="Price/NAV"
                                      value={holding.currentPrice || ""}
                                      onChange={(e) => updateHolding(holding.id, { currentPrice: parseFloat(e.target.value) || null })}
                                      className="h-9 text-xs"
                                      data-testid={`input-price-${idx}`}
                                    />
                                  </div>
                                )}

                                {/* Remove Button */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeHolding(holding.id)}
                                  className="h-9 w-9 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  data-testid={`btn-remove-holding-${idx}`}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>

                              {/* Holding Summary Row */}
                              {holding.productName && (
                                <div className="flex items-center justify-between text-xs px-1 pt-1 border-t">
                                  <div className="flex items-center gap-3">
                                    {holding.currentPrice && (
                                      <span className="text-muted-foreground">
                                        NAV: <span className="font-medium">₹{holding.currentPrice.toFixed(2)}</span>
                                      </span>
                                    )}
                                    {holding.returns1y !== null && (
                                      <span className={holding.returns1y >= 0 ? 'text-green-600' : 'text-red-600'}>
                                        1Y Return: {holding.returns1y.toFixed(1)}%
                                      </span>
                                    )}
                                    {/* AI Recommendation Badge */}
                                    {holding.aiRecommendation && (
                                      <Badge 
                                        className={`text-xs ${
                                          holding.aiRecommendation === 'BUY' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                                          holding.aiRecommendation === 'SELL' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                                          holding.aiRecommendation === 'SWITCH' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' :
                                          'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                                        }`}
                                        data-testid={`badge-ai-reco-${idx}`}
                                      >
                                        {holding.aiRecommendation === 'BUY' && <TrendingUp className="w-3 h-3 mr-1" />}
                                        {holding.aiRecommendation === 'SELL' && <TrendingDown className="w-3 h-3 mr-1" />}
                                        {holding.aiRecommendation === 'HOLD' && <Scale className="w-3 h-3 mr-1" />}
                                        AI: {holding.aiRecommendation}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="font-medium text-blue-700">
                                    Value: ₹{holding.currentValue.toLocaleString('en-IN')}
                                  </div>
                                </div>
                              )}
                              {/* AI Rationale Row */}
                              {holding.aiRationale && (
                                <div className="text-xs px-1 py-1.5 bg-muted rounded mt-1">
                                  <p className="text-muted-foreground font-medium mb-1">AI Analysis:</p>
                                  <p className="text-muted-foreground">{holding.aiRationale}</p>
                                  {holding.aiMetrics && (
                                    <div className="flex flex-wrap gap-2 mt-1.5">
                                      {holding.aiMetrics.sharpeRatio !== undefined && (
                                        <span className="text-muted-foreground">Sharpe: {holding.aiMetrics.sharpeRatio.toFixed(2)}</span>
                                      )}
                                      {holding.aiMetrics.alpha !== undefined && (
                                        <span className={holding.aiMetrics.alpha >= 0 ? 'text-green-600' : 'text-red-600'}>
                                          Alpha: {holding.aiMetrics.alpha.toFixed(2)}%
                                        </span>
                                      )}
                                      {holding.aiMetrics.categoryRank && (
                                        <span className="text-muted-foreground">Rank: {holding.aiMetrics.categoryRank}</span>
                                      )}
                                      {holding.aiMetrics.exitLoadApplicable && (
                                        <span className="text-amber-600">Exit Load: {holding.aiMetrics.exitLoadPercent}%</span>
                                      )}
                                      {holding.aiMetrics.capitalGainsTaxType && (
                                        <span className="text-purple-600">
                                          {holding.aiMetrics.capitalGainsTaxType} @ {holding.aiMetrics.taxRate}%
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Portfolio Summary */}
                    {quickHoldings.length > 0 && (
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-lg p-4 space-y-3">
                        <h4 className="font-medium text-sm flex items-center gap-2">
                          <PieChart className="w-4 h-4 text-indigo-600" />
                          Portfolio Summary
                        </h4>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Total Value</p>
                            <p className="text-lg font-bold text-blue-700">
                              ₹{portfolioSummary.totalValue.toLocaleString('en-IN')}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Holdings</p>
                            <p className="text-lg font-bold text-muted-foreground">{portfolioSummary.totalHoldings}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Wtd. Avg. 1Y Return</p>
                            <p className={`text-lg font-bold ${portfolioSummary.weightedReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {portfolioSummary.weightedReturn.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                        {Object.keys(portfolioSummary.assetAllocation).length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-2">Asset Allocation</p>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(portfolioSummary.assetAllocation).map(([type, value]) => (
                                <Badge key={type} variant="secondary" className="text-xs">
                                  {type}: ₹{value.toLocaleString('en-IN')} ({((value / portfolioSummary.totalValue) * 100).toFixed(0)}%)
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              <Separator />

              {/* Include Existing Portfolio Analysis Toggle */}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 dark:bg-amber-900 rounded-lg">
                      <Briefcase className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <label htmlFor="include-existing" className="font-medium text-sm text-foreground cursor-pointer">
                        Include Existing Portfolio Analysis
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Analyze client's current holdings with AI recommendations (BUY/HOLD/SELL/SWITCH)
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="include-existing"
                    checked={includeExistingPortfolio}
                    onCheckedChange={setIncludeExistingPortfolio}
                    data-testid="switch-include-existing-portfolio"
                  />
                </div>
                {includeExistingPortfolio && (
                  <div className="mt-3 pl-12 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                    <AlertCircle className="w-3 h-3" />
                    {prospectPan ? 
                      `Will fetch existing holdings for PAN: ${prospectPan}` : 
                      "Enter prospect PAN above to fetch existing holdings, or analysis will use sample portfolio data"
                    }
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={handleGenerate}
                  disabled={isGenerating || generateProposalMutation.isPending}
                  className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950"
                  data-testid="btn-generate"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  {isGenerating ? "Generating..." : "Generate AI Recommendations"}
                </Button>
              </div>

              {generatedProposal && (
                <Card className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950 dark:to-blue-950 border-indigo-200 dark:border-indigo-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-indigo-600" />
                      AI-Generated Proposal Preview
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground">Executive Summary</h4>
                      <p className="text-sm text-muted-foreground">{generatedProposal.executiveSummary}</p>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-card rounded-lg p-3">
                        <p className="text-xs text-muted-foreground">Total Investment</p>
                        <p className="text-lg font-bold text-indigo-600">
                          ₹{(generatedProposal.totalInvestmentAmount || 0).toLocaleString('en-IN')}
                        </p>
                      </div>
                      <div className="bg-card rounded-lg p-3">
                        <p className="text-xs text-muted-foreground">Expected Returns</p>
                        <p className="text-lg font-bold text-green-600">{generatedProposal.projectedReturns}% p.a.</p>
                      </div>
                      <div className="bg-card rounded-lg p-3">
                        <p className="text-xs text-muted-foreground">Projected Value (5Y)</p>
                        <p className="text-lg font-bold text-purple-600">
                          ₹{(generatedProposal.projectedValue || 0).toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-2">Recommended Products ({generatedProposal.recommendations?.length || 0})</h4>
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {generatedProposal.recommendations?.map((rec: any, idx: number) => (
                          <div key={idx} className="bg-card rounded-lg p-3 space-y-2">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-sm">{rec.productName}</p>
                                  {rec.recommendationType && (
                                    <Badge 
                                      className={`text-xs ${
                                        rec.recommendationType === 'BUY' ? 'bg-green-100 text-green-700' :
                                        rec.recommendationType === 'SELL' ? 'bg-red-100 text-red-700' :
                                        rec.recommendationType === 'SWITCH' ? 'bg-amber-100 text-amber-700' :
                                        'bg-blue-100 text-blue-700'
                                      }`}
                                    >
                                      {rec.recommendationType}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">{rec.category} • {rec.riskRating}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-sm">₹{(rec.recommendedAmount || 0).toLocaleString('en-IN')}</p>
                                <p className="text-xs text-muted-foreground">{rec.allocationPercentage}%</p>
                              </div>
                            </div>
                            {/* AI Rationale with Metrics */}
                            {rec.rationale && (
                              <div className="text-xs bg-muted rounded p-2 space-y-2">
                                <p className="text-muted-foreground">{rec.rationale}</p>
                                {rec.metrics && (
                                  <>
                                    {/* Valuation Metrics Row */}
                                    <div className="flex flex-wrap gap-3 pt-1.5 border-t border-border">
                                      {rec.metrics.pe > 0 && (
                                        <span className="bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded text-blue-700 dark:text-blue-400">
                                          P/E: {rec.metrics.pe}x {rec.metrics.peVsCat !== 0 && <span className={rec.metrics.peVsCat < 0 ? 'text-green-600' : 'text-amber-600'}>({rec.metrics.peVsCat > 0 ? '+' : ''}{rec.metrics.peVsCat}%)</span>}
                                        </span>
                                      )}
                                      {rec.metrics.pbRatio > 0 && (
                                        <span className="bg-purple-50 dark:bg-purple-900/30 px-1.5 py-0.5 rounded text-purple-700 dark:text-purple-400">
                                          P/B: {rec.metrics.pbRatio}x
                                        </span>
                                      )}
                                      {rec.metrics.roe > 0 && (
                                        <span className={`px-1.5 py-0.5 rounded ${rec.metrics.roe >= 15 ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                                          ROE: {rec.metrics.roe}%
                                        </span>
                                      )}
                                      {rec.metrics.epsGrowth3Y && rec.metrics.epsGrowth3Y !== 0 && (
                                        <span className={`px-1.5 py-0.5 rounded ${rec.metrics.epsGrowth3Y > 12 ? 'bg-green-50 dark:bg-green-900/30 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                                          EPS 3Y: {rec.metrics.epsGrowth3Y}%
                                        </span>
                                      )}
                                      {rec.metrics.dividendYield > 0 && (
                                        <span className="bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded text-emerald-700 dark:text-emerald-400">
                                          Div: {rec.metrics.dividendYield}%
                                        </span>
                                      )}
                                    </div>
                                    {/* Risk & Performance Metrics Row */}
                                    <div className="flex flex-wrap gap-3">
                                      {rec.metrics.sharpeRatio !== undefined && (
                                        <span className={`text-muted-foreground ${rec.metrics.sharpeRatio > 0.5 ? 'font-medium' : ''}`}>
                                          Sharpe: {rec.metrics.sharpeRatio}
                                        </span>
                                      )}
                                      {rec.metrics.alpha !== undefined && (
                                        <span className={rec.metrics.alpha >= 0 ? 'text-green-600' : 'text-red-600'}>
                                          Alpha: {rec.metrics.alpha > 0 ? '+' : ''}{rec.metrics.alpha}%
                                        </span>
                                      )}
                                      {rec.metrics.downsideCapture && (
                                        <span className={`${rec.metrics.downsideCapture < 90 ? 'text-green-600' : rec.metrics.downsideCapture > 110 ? 'text-red-600' : 'text-muted-foreground'}`}>
                                          Downside: {rec.metrics.downsideCapture}%
                                        </span>
                                      )}
                                      {rec.metrics.styleBox && (
                                        <span className="text-indigo-600 dark:text-indigo-400">
                                          {rec.metrics.styleBox}
                                        </span>
                                      )}
                                      {rec.metrics.categoryRank && (
                                        <span className="text-muted-foreground">{rec.metrics.categoryRank}</span>
                                      )}
                                      {rec.metrics.expenseRatio !== undefined && rec.metrics.expenseRatio > 0 && (
                                        <span className={`${rec.metrics.expenseRatio < 1 ? 'text-green-600' : 'text-muted-foreground'}`}>
                                          TER: {rec.metrics.expenseRatio.toFixed(2)}%
                                        </span>
                                      )}
                                    </div>
                                    {/* Additional Info Row */}
                                    {(rec.exitLoadApplicable || rec.taxImplication || rec.metrics.aum) && (
                                      <div className="flex flex-wrap gap-3 text-muted-foreground">
                                        {rec.metrics.aum && (
                                          <span>AUM: {rec.metrics.aum}</span>
                                        )}
                                        {rec.exitLoadApplicable && (
                                          <span className="text-amber-600">Exit Load: {rec.exitLoadPercent}%</span>
                                        )}
                                        {rec.taxImplication && (
                                          <span className="text-purple-600">{rec.taxImplication}</span>
                                        )}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Existing Portfolio Analysis Section */}
                    {generatedProposal.existingPortfolioAnalysis && (
                      <div className="border-t pt-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Briefcase className="w-5 h-5 text-amber-600" />
                          <h4 className="font-medium text-sm text-muted-foreground">
                            Existing Portfolio Analysis
                          </h4>
                        </div>
                        
                        <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">
                          {generatedProposal.existingPortfolioAnalysis.analysisNote}
                        </p>

                        {/* Summary Stats */}
                        <div className="grid grid-cols-5 gap-2 mb-3">
                          <div className="bg-muted rounded p-2 text-center">
                            <p className="text-xs text-muted-foreground">Total Value</p>
                            <p className="font-bold text-sm">
                              ₹{(generatedProposal.existingPortfolioAnalysis.summary?.totalValue || 0).toLocaleString('en-IN')}
                            </p>
                          </div>
                          <div className="bg-green-50 dark:bg-green-900/30 rounded p-2 text-center">
                            <p className="text-xs text-green-600">BUY</p>
                            <p className="font-bold text-sm text-green-700">{generatedProposal.existingPortfolioAnalysis.summary?.buyCount || 0}</p>
                          </div>
                          <div className="bg-blue-50 dark:bg-blue-900/30 rounded p-2 text-center">
                            <p className="text-xs text-blue-600">HOLD</p>
                            <p className="font-bold text-sm text-blue-700">{generatedProposal.existingPortfolioAnalysis.summary?.holdCount || 0}</p>
                          </div>
                          <div className="bg-red-50 dark:bg-red-900/30 rounded p-2 text-center">
                            <p className="text-xs text-red-600">SELL</p>
                            <p className="font-bold text-sm text-red-700">{generatedProposal.existingPortfolioAnalysis.summary?.sellCount || 0}</p>
                          </div>
                          <div className="bg-amber-50 dark:bg-amber-900/30 rounded p-2 text-center">
                            <p className="text-xs text-amber-600">SWITCH</p>
                            <p className="font-bold text-sm text-amber-700">{generatedProposal.existingPortfolioAnalysis.summary?.switchCount || 0}</p>
                          </div>
                        </div>

                        {/* Existing Holdings List */}
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {generatedProposal.existingPortfolioAnalysis.holdings?.map((holding: any, idx: number) => (
                            <div key={idx} className="bg-card rounded-lg p-2.5 border border-border">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-xs">{holding.name}</p>
                                    <Badge 
                                      className={`text-[10px] px-1.5 py-0 ${
                                        holding.recommendationType === 'BUY' ? 'bg-green-100 text-green-700' :
                                        holding.recommendationType === 'SELL' ? 'bg-red-100 text-red-700' :
                                        holding.recommendationType === 'SWITCH' ? 'bg-amber-100 text-amber-700' :
                                        'bg-blue-100 text-blue-700'
                                      }`}
                                    >
                                      {holding.recommendationType === 'BUY' && <TrendingUp className="w-2.5 h-2.5 mr-0.5" />}
                                      {holding.recommendationType === 'SELL' && <TrendingDown className="w-2.5 h-2.5 mr-0.5" />}
                                      {holding.recommendationType === 'HOLD' && <Scale className="w-2.5 h-2.5 mr-0.5" />}
                                      {holding.recommendationType}
                                    </Badge>
                                  </div>
                                  <p className="text-[10px] text-muted-foreground">{holding.category || holding.type}</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-xs">₹{(holding.currentValue || 0).toLocaleString('en-IN')}</p>
                                  <p className={`text-[10px] ${holding.gainLossPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {holding.gainLossPercent >= 0 ? '+' : ''}{holding.gainLossPercent?.toFixed(1)}%
                                  </p>
                                </div>
                              </div>
                              {/* Rationale and Metrics */}
                              {(holding.rationale || holding.metrics) && (
                                <div className="mt-1.5 bg-muted rounded p-1.5 space-y-1">
                                  {holding.rationale && (
                                    <p className="text-[10px] text-muted-foreground">
                                      {holding.rationale}
                                    </p>
                                  )}
                                  {holding.metrics && (
                                    <div className="flex flex-wrap gap-1.5 text-[9px]">
                                      {holding.metrics.pe > 0 && (
                                        <span className="bg-blue-50 dark:bg-blue-900/30 px-1 py-0.5 rounded text-blue-600">
                                          P/E: {holding.metrics.pe}x
                                        </span>
                                      )}
                                      {holding.metrics.pbRatio > 0 && (
                                        <span className="bg-purple-50 dark:bg-purple-900/30 px-1 py-0.5 rounded text-purple-600">
                                          P/B: {holding.metrics.pbRatio}x
                                        </span>
                                      )}
                                      {holding.metrics.roe > 0 && (
                                        <span className={`px-1 py-0.5 rounded ${holding.metrics.roe >= 15 ? 'bg-green-50 text-green-600' : 'bg-muted text-muted-foreground'}`}>
                                          ROE: {holding.metrics.roe}%
                                        </span>
                                      )}
                                      {holding.metrics.sharpeRatio !== undefined && (
                                        <span className="text-muted-foreground">Sharpe: {holding.metrics.sharpeRatio}</span>
                                      )}
                                      {holding.metrics.alpha !== undefined && (
                                        <span className={holding.metrics.alpha >= 0 ? 'text-green-600' : 'text-red-500'}>
                                          α: {holding.metrics.alpha > 0 ? '+' : ''}{holding.metrics.alpha}%
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </Tabs>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => { resetForm(); setShowCreateDialog(false); }}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreate}
              disabled={!generatedProposal || createProposalMutation.isPending}
              className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-foreground"
              data-testid="btn-create-final"
            >
              {createProposalMutation.isPending ? "Creating..." : "Create & Share"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
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
                  <p className="text-sm text-muted-foreground">{selectedProposal.executiveSummary}</p>
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
                        <>
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
                          {rec.rationale && (
                            <TableRow key={`${idx}-rationale`} className="bg-muted">
                              <TableCell colSpan={5} className="text-xs py-2">
                                <div className="space-y-1">
                                  <p className="text-muted-foreground">{rec.rationale}</p>
                                  {(rec.exitLoadApplicable || rec.taxImplication) && (
                                    <div className="flex gap-3">
                                      {rec.exitLoadApplicable && (
                                        <span className="text-amber-600">Exit Load: {rec.exitLoadPercent}%</span>
                                      )}
                                      {rec.taxImplication && (
                                        <span className="text-purple-600">{rec.taxImplication}</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
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
              className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-foreground"
            >
              <Send className="w-4 h-4 mr-2" />
              Share Proposal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Share Proposal</DialogTitle>
            <DialogDescription>
              Share this proposal with {selectedProposal?.prospectName}
            </DialogDescription>
          </DialogHeader>

          {selectedProposal && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Proposal Link</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    value={`${baseUrl}/proposal/${selectedProposal.shareToken}`}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(`${baseUrl}/proposal/${selectedProposal.shareToken}`, "Proposal link")}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

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

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950"
                  onClick={() => shareProposalMutation.mutate({ id: selectedProposal.id, shareVia: 'email' })}
                  disabled={shareProposalMutation.isPending}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Share via Email
                </Button>
                <Button
                  variant="outline"
                  className="border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-950"
                  onClick={() => {
                    const message = encodeURIComponent(`Hi ${selectedProposal.prospectName}, I've prepared a personalized investment proposal for you. View it here: ${baseUrl}/proposal/${selectedProposal.shareToken}`);
                    const phone = selectedProposal.prospectMobile?.replace(/[^0-9]/g, '') || '';
                    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
                    shareProposalMutation.mutate({ id: selectedProposal.id, shareVia: 'whatsapp' });
                  }}
                  disabled={!selectedProposal.prospectMobile}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Share via WhatsApp
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

      {/* Edit Proposal Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-amber-600" />
              Edit Proposal
            </DialogTitle>
            <DialogDescription>
              Update proposal details. Only draft proposals can be fully edited.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Prospect Name</Label>
              <Input
                value={editFormData.prospectName}
                onChange={(e) => setEditFormData(prev => ({ ...prev, prospectName: e.target.value }))}
                placeholder="Enter prospect name"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={editFormData.prospectEmail}
                onChange={(e) => setEditFormData(prev => ({ ...prev, prospectEmail: e.target.value }))}
                placeholder="prospect@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Mobile</Label>
              <Input
                value={editFormData.prospectMobile}
                onChange={(e) => setEditFormData(prev => ({ ...prev, prospectMobile: e.target.value }))}
                placeholder="+91 XXXXXXXXXX"
              />
            </div>
            <div className="space-y-2">
              <Label>Proposal Title</Label>
              <Input
                value={editFormData.proposalTitle}
                onChange={(e) => setEditFormData(prev => ({ ...prev, proposalTitle: e.target.value }))}
                placeholder="Investment Proposal"
              />
            </div>
            <div className="space-y-2">
              <Label>Investment Amount (₹)</Label>
              <Input
                type="number"
                value={editFormData.totalInvestmentAmount}
                onChange={(e) => setEditFormData(prev => ({ ...prev, totalInvestmentAmount: e.target.value }))}
                placeholder="1000000"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleEditSubmit}
              disabled={updateProposalMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {updateProposalMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Delete Proposal
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this proposal? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {proposalToDelete && (
            <div className="py-4 border rounded-lg px-4 bg-muted/50">
              <p className="font-medium">{proposalToDelete.prospectName}</p>
              <p className="text-sm text-muted-foreground">{proposalToDelete.proposalTitle}</p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteProposalMutation.isPending}
            >
              {deleteProposalMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Proposal"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
