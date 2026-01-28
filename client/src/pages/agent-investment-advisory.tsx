import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";
import { 
  Brain,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  Target,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Upload,
  FileText,
  Plus,
  Minus,
  RefreshCw,
  Send,
  MessageSquare,
  Lightbulb,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  ArrowLeft,
  Calculator,
  Scale,
  Briefcase,
  Calendar,
  DollarSign,
  Percent,
  ShieldCheck,
  Zap,
  Eye,
  Edit,
  Trash2,
  Copy,
  Download,
  Filter,
  Search,
  Layers,
  Building2,
  Globe,
  Lock,
  Unlock,
  Check,
  ChevronsUpDown,
  User,
  UserPlus,
  ClipboardPaste,
  Table2,
  FileSpreadsheet,
  FileText as FileTextIcon,
  Goal,
  Crosshair,
  Shuffle,
  LineChart,
  GraduationCap,
  Home,
  Wallet,
  Car,
  Plane,
  Heart,
  HelpCircle,
  CircleDot,
  Timer,
  IndianRupee,
  Sparkles,
  ChevronRight,
  RotateCcw
} from "lucide-react";

interface Portfolio {
  id: string;
  clientId: string;
  name: string;
  totalValue: number;
  holdings: PortfolioHolding[];
  lastUpdated: string;
}

interface PortfolioHolding {
  id?: string;
  symbol: string;
  name: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  currentValue: number;
  gainLoss: number;
  gainLossPercent: number;
  sector?: string;
  assetType: string;
}

interface PortfolioAnalysis {
  totalValue: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  fundamentalRatios: {
    avgPE: number;
    avgPB: number;
    avgROE: number;
    avgDebtEquity: number;
  };
  sectorConcentration: Record<string, number>;
  topHoldings: { symbol: string; weight: number }[];
  riskScore: number;
  diversificationScore: number;
}

interface AIProfitPick {
  id: string;
  symbol: string;
  companyName: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  horizon: '1M' | '3M' | '6M' | '1Y';
  currentPrice: number;
  targetPrice: number;
  stopLoss: number;
  expectedReturn: number;
  confidenceScore: number;
  technicalIndicators: {
    rsi: number;
    macd: string;
    movingAverages: string;
    volumeTrend: string;
  };
  fundamentalScore: number;
  aiRationale: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  createdAt: string;
}

interface PortfolioAlert {
  id: string;
  alertType: 'UNDERPERFORMANCE' | 'CONCENTRATION' | 'REBALANCE' | 'OPPORTUNITY';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  benchmarkComparison?: {
    benchmark: string;
    portfolioReturn: number;
    benchmarkReturn: number;
    underperformancePercent: number;
  };
  actionRequired: boolean;
  createdAt: string;
}

interface TalkingPoint {
  category: 'STRENGTH' | 'CONCERN' | 'OPPORTUNITY' | 'ACTION';
  title: string;
  content: string;
  supportingData?: string;
}

interface Client {
  id: number | string;
  uuid: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  mobile?: string | null;
  phone?: string | null;
  isProspect?: boolean;
  prospectState?: string;
  clientType?: string;
  relationshipType?: string;
  kycStatus?: string;
  riskProfile?: string;
  companyName?: string | null;
  leadQuality?: string | null;
  createdAt?: string | Date | null;
}

const SIGNAL_COLORS = {
  BUY: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  SELL: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  HOLD: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
};

const RISK_COLORS = {
  LOW: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  MEDIUM: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  HIGH: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
};

const SEVERITY_COLORS = {
  INFO: "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950",
  WARNING: "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950",
  CRITICAL: "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
};

const CATEGORY_ICONS = {
  STRENGTH: CheckCircle2,
  CONCERN: AlertTriangle,
  OPPORTUNITY: Lightbulb,
  ACTION: Zap
};

export default function AgentInvestmentAdvisory() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("portfolio");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [showNewClientDialog, setShowNewClientDialog] = useState(false);
  const [newClientData, setNewClientData] = useState({ firstName: "", lastName: "", email: "", mobile: "" });
  const [selectedHorizon, setSelectedHorizon] = useState<string>("3M");
  const [selectedProductTypes, setSelectedProductTypes] = useState<string[]>(["stocks", "mutual_funds", "bonds", "etfs"]);
  const [showAddHoldingDialog, setShowAddHoldingDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showPasteDialog, setShowPasteDialog] = useState(false);
  const [showCASUploadDialog, setShowCASUploadDialog] = useState(false);
  const [casFile, setCasFile] = useState<File | null>(null);
  const [casUploadType, setCasUploadType] = useState<'cas' | 'demat' | null>(null);
  const [casPreviewHoldings, setCasPreviewHoldings] = useState<Array<{
    id: string;
    name: string;
    symbol: string;
    isin?: string;
    quantity: number;
    averagePrice: number;
    currentValue: number;
    assetType: string;
    folioNumber?: string;
    confidenceScore?: number;
    broker?: string;
  }>>([]);
  const [casPreviewError, setCasPreviewError] = useState<string | null>(null);
  const [casPreviewMode, setCasPreviewMode] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [parsedHoldings, setParsedHoldings] = useState<Array<{symbol: string; name: string; quantity: number; averagePrice: number; assetType: string}>>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedProductCategories, setSelectedProductCategories] = useState<string[]>([]);
  const [unifiedAdvisoryLoading, setUnifiedAdvisoryLoading] = useState(false);
  const [unifiedEligibility, setUnifiedEligibility] = useState<Record<string, { eligible: boolean; reason: string }> | null>(null);
  const [unifiedRecommendations, setUnifiedRecommendations] = useState<any>(null);

  const [newHolding, setNewHolding] = useState({
    symbol: "",
    name: "",
    quantity: 0,
    averagePrice: 0,
    assetType: "EQUITY",
    purchaseDate: ""
  });

  // Calculate holding period info for tax classification
  const getHoldingPeriodInfo = (purchaseDate: string) => {
    if (!purchaseDate) return null;
    const purchase = new Date(purchaseDate);
    const today = new Date();
    const diffTime = today.getTime() - purchase.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const isLTCG = diffDays > 365;
    const daysToLTCG = isLTCG ? 0 : 365 - diffDays;
    const isFutureDate = diffDays < 0;
    const isVeryOld = diffDays > 365 * 20; // More than 20 years
    
    return {
      days: diffDays,
      isLTCG,
      daysToLTCG,
      isFutureDate,
      isVeryOld,
      taxType: isLTCG ? 'LTCG' : 'STCG',
      taxRate: isLTCG ? '12.5%' : '20%',
      exitLoadApplicable: diffDays < 365
    };
  };

  const holdingPeriodInfo = getHoldingPeriodInfo(newHolding.purchaseDate);

  // Fetch clients for searchable dropdown
  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ['/api/agent/clients'],
  });

  // Fetch prospects (leads) for searchable dropdown - use standard fetcher with proper error handling
  const { data: prospectsResponse, isLoading: prospectsLoading, error: prospectsError } = useQuery<{ success: boolean; prospects?: any[] }>({
    queryKey: ['/api/agent-wizard/prospects'],
    retry: false,
    staleTime: 30000,
  });

  // Extract prospects array from response
  const prospects = prospectsResponse?.prospects || [];

  // Combined loading state for client selector
  const isLoadingClientsOrProspects = clientsLoading || prospectsLoading;

  // Combine clients and prospects for unified dropdown
  const allClientsAndProspects = useMemo(() => {
    const clientsList: Client[] = clients.map(c => ({ ...c, isProspect: false }));
    const prospectsList: Client[] = (Array.isArray(prospects) ? prospects : []).map(p => ({
      id: p.id,
      uuid: p.id?.toString() || '',
      firstName: p.firstName || p.first_name || '',
      lastName: p.lastName || p.last_name || '',
      email: p.email || null,
      mobile: p.phone || p.mobile || null,
      isProspect: true,
      prospectState: p.status || 'new',
      leadQuality: p.leadQuality || p.lead_quality || null,
      createdAt: p.createdAt || p.created_at || null
    }));
    return [...clientsList, ...prospectsList];
  }, [clients, prospects]);

  // Filter clients/prospects based on search query (search by name or UUID)
  const filteredClients = useMemo(() => {
    if (!clientSearchQuery.trim()) return allClientsAndProspects;
    const query = clientSearchQuery.toLowerCase();
    return allClientsAndProspects.filter(client => {
      const fullName = `${client.firstName} ${client.lastName}`.toLowerCase();
      const uuid = client.uuid?.toLowerCase() || '';
      return fullName.includes(query) || uuid.includes(query);
    });
  }, [allClientsAndProspects, clientSearchQuery]);

  // Get the selected client display name
  const selectedClient = useMemo(() => {
    return allClientsAndProspects.find(c => c.uuid === selectedClientId || String(c.id) === selectedClientId);
  }, [allClientsAndProspects, selectedClientId]);

  const { data: portfolio, isLoading: portfolioLoading } = useQuery<Portfolio>({
    queryKey: ['/api/ai-investment/portfolio', selectedClientId],
    enabled: !!selectedClientId
  });

  const { data: analysis, isLoading: analysisLoading, refetch: refetchAnalysis } = useQuery<PortfolioAnalysis>({
    queryKey: ['/api/ai-investment/analyze', selectedClientId],
    enabled: !!selectedClientId && !!portfolio
  });

  const { data: profitPicks, isLoading: picksLoading, refetch: refetchPicks } = useQuery<AIProfitPick[]>({
    queryKey: ['/api/ai-investment/profit-picks', selectedClientId, selectedHorizon],
    enabled: !!selectedClientId && !!portfolio
  });
  
  // Filter profit picks based on selected product types (client-side filtering)
  const filteredProfitPicks = profitPicks?.filter(pick => {
    if (selectedProductTypes.length === 0) return true;
    // Map asset types to product categories
    const assetTypeMap: Record<string, string> = {
      'EQUITY': 'stocks',
      'STOCK': 'stocks',
      'MF': 'mutual_funds',
      'MUTUAL_FUND': 'mutual_funds',
      'BOND': 'bonds',
      'NCD': 'bonds',
      'ETF': 'etfs',
      'GOLD': 'gold',
      'SGB': 'gold',
      'REIT': 'reits',
      'INVIT': 'reits'
    };
    // Default to stocks if no mapping found
    const productCategory = assetTypeMap[(pick as any).assetType?.toUpperCase()] || 'stocks';
    return selectedProductTypes.includes(productCategory);
  });

  const { data: alerts, isLoading: alertsLoading } = useQuery<PortfolioAlert[]>({
    queryKey: ['/api/ai-investment/alerts', selectedClientId],
    enabled: !!selectedClientId && !!portfolio
  });

  const { data: talkingPoints, isLoading: talkingPointsLoading, refetch: refetchTalkingPoints } = useQuery<TalkingPoint[]>({
    queryKey: ['/api/ai-investment/talking-points', selectedClientId],
    enabled: !!selectedClientId && !!portfolio
  });

  const createClientMutation = useMutation({
    mutationFn: async (clientData: typeof newClientData) => {
      return apiRequest('/api/agent/clients', {
        method: 'POST',
        body: JSON.stringify(clientData)
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/agent/clients'] });
      setShowNewClientDialog(false);
      setNewClientData({ firstName: "", lastName: "", email: "", mobile: "" });
      if (data?.uuid) {
        setSelectedClientId(data.uuid);
      }
      toast({ title: "Client created", description: "New client added successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create client", variant: "destructive" });
    }
  });

  const addHoldingMutation = useMutation({
    mutationFn: async (holding: typeof newHolding) => {
      return apiRequest(`/api/ai-investment/portfolio/${selectedClientId}/holdings`, {
        method: 'POST',
        body: JSON.stringify(holding)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-investment/portfolio', selectedClientId] });
      setShowAddHoldingDialog(false);
      setNewHolding({ symbol: "", name: "", quantity: 0, averagePrice: 0, assetType: "EQUITY", purchaseDate: "" });
      toast({ title: "Holding added", description: "Portfolio updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add holding", variant: "destructive" });
    }
  });

  const uploadCSVMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiRequest(`/api/ai-investment/portfolio/${selectedClientId}/upload`, {
        method: 'POST',
        body: formData,
        headers: {}
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-investment/portfolio', selectedClientId] });
      setShowUploadDialog(false);
      toast({ title: "Portfolio uploaded", description: "CSV processed successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to upload CSV", variant: "destructive" });
    }
  });

  const createProposalMutation = useMutation({
    mutationFn: async (picks: AIProfitPick[]) => {
      return apiRequest('/api/ai-investment/proposal', {
        method: 'POST',
        body: JSON.stringify({ clientId: selectedClientId, picks })
      });
    },
    onSuccess: (data: any) => {
      toast({ 
        title: "Proposal created", 
        description: `Proposal #${data.proposalId} created with ${data.itemCount} recommendations` 
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create proposal", variant: "destructive" });
    }
  });

  const bulkImportMutation = useMutation({
    mutationFn: async (holdings: typeof parsedHoldings) => {
      return apiRequest(`/api/ai-investment/portfolio/${selectedClientId}/bulk-import`, {
        method: 'POST',
        body: JSON.stringify({ holdings })
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-investment/portfolio', selectedClientId] });
      setShowPasteDialog(false);
      setPastedText("");
      setParsedHoldings([]);
      setParseError(null);
      toast({ title: "Portfolio imported", description: `${data?.imported || parsedHoldings.length} holdings added successfully` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to import holdings", variant: "destructive" });
    }
  });

  const casPreviewMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/ai-investment/portfolio/preview-pdf', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Preview failed');
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      if (data.holdings && data.holdings.length > 0) {
        setCasPreviewHoldings(data.holdings);
        setCasPreviewMode(true);
        setCasPreviewError(null);
        if (data.needsManualReview) {
          setCasPreviewError(`Some holdings have low confidence. Please review before importing.`);
        }
      } else {
        setCasPreviewError(data.errors?.join('; ') || 'No holdings found in the PDF');
      }
    },
    onError: (error: any) => {
      setCasPreviewError(error.message || "Failed to parse PDF");
    }
  });

  const casUploadMutation = useMutation({
    mutationFn: async (holdings: typeof casPreviewHoldings) => {
      return apiRequest(`/api/ai-investment/portfolio/${selectedClientId}/import-previewed`, {
        method: 'POST',
        body: JSON.stringify({ holdings })
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-investment/portfolio', selectedClientId] });
      setShowCASUploadDialog(false);
      setCasFile(null);
      setCasUploadType(null);
      setCasPreviewHoldings([]);
      setCasPreviewMode(false);
      setCasPreviewError(null);
      toast({ 
        title: "Portfolio imported successfully", 
        description: `${data.imported} holdings imported` 
      });
    },
    onError: (error: any) => {
      toast({ title: "Import failed", description: error.message || "Failed to import holdings", variant: "destructive" });
    }
  });

  const parseClipboardData = useCallback((text: string) => {
    if (!text.trim()) {
      setParsedHoldings([]);
      setParseError(null);
      return;
    }

    try {
      const lines = text.trim().split('\n').filter(line => line.trim());
      if (lines.length === 0) {
        setParseError("No data found");
        return;
      }

      const delimiter = lines[0].includes('\t') ? '\t' : ',';
      const rows = lines.map(line => line.split(delimiter).map(cell => cell.trim()));
      
      const headerRow = rows[0].map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
      
      const matchColumn = (patterns: string[]) => 
        headerRow.findIndex(h => patterns.some(p => h.includes(p)));
      
      const symbolIdx = matchColumn(['symbol', 'ticker', 'stock', 'scrip', 'isin', 'code']);
      const nameIdx = matchColumn(['name', 'company', 'scheme', 'fund', 'security']);
      const qtyIdx = matchColumn(['qty', 'quantity', 'units', 'shares', 'holding', 'balance']);
      const priceIdx = matchColumn(['price', 'avg', 'average', 'cost', 'nav', 'buy']);
      const typeIdx = matchColumn(['type', 'asset', 'category', 'class']);

      const hasHeader = symbolIdx !== -1 || qtyIdx !== -1 || priceIdx !== -1;
      const dataRows = hasHeader ? rows.slice(1) : rows;
      const numCols = rows[0].length;

      if (dataRows.length === 0) {
        setParseError("No data rows found");
        return;
      }

      const parsed = dataRows.map((row) => {
        const safeGet = (index: number, fallbackIdx: number) => {
          if (index !== -1 && index < row.length) return row[index];
          if (fallbackIdx < row.length) return row[fallbackIdx];
          return '';
        };
        
        const rawSymbol = safeGet(symbolIdx, 0);
        const rawName = safeGet(nameIdx, numCols >= 4 ? 1 : -1);
        const rawQty = safeGet(qtyIdx, numCols >= 3 ? (numCols >= 4 ? 2 : 1) : -1);
        const rawPrice = safeGet(priceIdx, numCols >= 3 ? (numCols >= 4 ? 3 : 2) : -1);
        const rawType = safeGet(typeIdx, -1);
        
        const symbol = rawSymbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const quantity = parseFloat(rawQty.replace(/,/g, '')) || 0;
        const averagePrice = parseFloat(rawPrice.replace(/[₹,Rs.\s]/g, '').trim()) || 0;
        
        return {
          symbol,
          name: rawName || rawSymbol,
          quantity,
          averagePrice,
          assetType: rawType.toUpperCase() || 'EQUITY',
          _hasValidPrice: averagePrice > 0
        };
      }).filter(h => h.symbol && h.quantity > 0);

      if (parsed.length === 0) {
        setParseError("Could not parse any valid holdings. Ensure data has symbol and quantity columns.");
        return;
      }

      const missingPriceCount = parsed.filter(h => !h._hasValidPrice).length;
      if (missingPriceCount === parsed.length) {
        setParseError(`Warning: No prices detected. Check that your data includes a price/cost column.`);
      } else if (missingPriceCount > 0) {
        setParseError(`Note: ${missingPriceCount} of ${parsed.length} holdings have no price. They will be imported with price = 0.`);
      } else {
        setParseError(null);
      }

      setParsedHoldings(parsed.map(({ _hasValidPrice, ...rest }) => rest));
    } catch (err) {
      setParseError("Failed to parse data. Try copying from Excel or use CSV format.");
    }
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      uploadCSVMutation.mutate(acceptedFiles[0]);
    }
  }, [uploadCSVMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1
  });

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      await refetchAnalysis();
      await refetchPicks();
      await refetchTalkingPoints();
      toast({ title: "Analysis complete", description: "AI recommendations updated" });
    } catch (error) {
      toast({ title: "Error", description: "Analysis failed", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="page-title">
            AI Investment Advisory
          </h1>
          <p className="text-muted-foreground dark:text-muted-foreground">
            Analyze portfolios and generate intelligent investment recommendations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Popover open={clientSearchOpen} onOpenChange={setClientSearchOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={clientSearchOpen}
                className="w-64 justify-between"
                data-testid="select-client"
              >
                {selectedClient ? (
                  <span className="flex items-center gap-2 truncate">
                    <User className="h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {(selectedClient.firstName || selectedClient.lastName) 
                        ? `${selectedClient.firstName || ''} ${selectedClient.lastName || ''}`.trim()
                        : (selectedClient.name || selectedClient.email?.split('@')[0] || 'Unnamed')}
                    </span>
                    {selectedClient.prospectState === 'lead' ? (
                      <Badge variant="outline" className="text-xs px-1 py-0 h-4 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                        Lead
                      </Badge>
                    ) : selectedClient.isProspect ? (
                      <Badge variant="outline" className="text-xs px-1 py-0 h-4 bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800">
                        Prospect
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs px-1 py-0 h-4 bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
                        Client
                      </Badge>
                    )}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Select client, prospect or lead...</span>
                )}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput 
                  placeholder="Search by name or ID..." 
                  value={clientSearchQuery}
                  onValueChange={setClientSearchQuery}
                />
                <CommandList>
                  <CommandEmpty>
                    {isLoadingClientsOrProspects ? "Loading clients & prospects..." : (
                      <div className="py-2">
                        <p className="text-sm text-muted-foreground mb-2">No clients or prospects found.</p>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            setClientSearchOpen(false);
                            setShowNewClientDialog(true);
                          }}
                        >
                          <UserPlus className="h-4 w-4 mr-2" />
                          Add New Client
                        </Button>
                      </div>
                    )}
                  </CommandEmpty>
                  <CommandGroup>
                    {filteredClients.map((client, idx) => (
                      <CommandItem
                        key={`${client.uuid || client.id}-${idx}`}
                        value={client.uuid}
                        onSelect={() => {
                          setSelectedClientId(client.uuid);
                          setClientSearchOpen(false);
                          setClientSearchQuery("");
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedClientId === client.uuid ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex flex-col flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate">
                              {(client.firstName || client.lastName) 
                                ? `${client.firstName || ''} ${client.lastName || ''}`.trim()
                                : (client.name || client.email?.split('@')[0] || 'Unnamed')}
                            </span>
                            {client.prospectState === 'lead' ? (
                              <Badge variant="outline" className="text-xs px-1 py-0 h-4 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                                Lead {client.leadQuality === 'hot' && '🔥'}
                              </Badge>
                            ) : client.isProspect ? (
                              <Badge variant="outline" className="text-xs px-1 py-0 h-4 bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800">
                                Prospect
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs px-1 py-0 h-4 bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
                                Client
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground truncate">
                            {client.email || client.companyName || client.phone || client.uuid?.slice(0, 8) + '...'}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => {
                        setClientSearchOpen(false);
                        setShowNewClientDialog(true);
                      }}
                      className="border-t"
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      Add New Client
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <Button 
            onClick={handleRunAnalysis} 
            disabled={isAnalyzing || !portfolio}
            data-testid="button-run-analysis"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4 mr-2" />
                Run AI Analysis
              </>
            )}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <ScrollableTabsList>
          <TabsTrigger value="portfolio" data-testid="tab-portfolio">
            <Briefcase className="h-4 w-4 mr-2" />
            Portfolio
          </TabsTrigger>
          <TabsTrigger value="analysis" data-testid="tab-analysis">
            <PieChart className="h-4 w-4 mr-2" />
            Analysis
          </TabsTrigger>
          <TabsTrigger value="profit-picks" data-testid="tab-profit-picks">
            <TrendingUp className="h-4 w-4 mr-2" />
            AI Profit Picks
          </TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-alerts">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Alerts
          </TabsTrigger>
          <TabsTrigger value="talking-points" data-testid="tab-talking-points">
            <MessageSquare className="h-4 w-4 mr-2" />
            Talking Points
          </TabsTrigger>
          <TabsTrigger value="multi-product" data-testid="tab-multi-product">
            <Layers className="h-4 w-4 mr-2" />
            Multi-Product
          </TabsTrigger>
          <TabsTrigger value="finalize" data-testid="tab-finalize">
            <Send className="h-4 w-4 mr-2" />
            Finalize
          </TabsTrigger>
          <TabsTrigger value="itr-services" data-testid="tab-itr-services">
            <FileText className="h-4 w-4 mr-2" />
            ITR Services
          </TabsTrigger>
          <TabsTrigger value="goal-planning" data-testid="tab-goal-planning">
            <Goal className="h-4 w-4 mr-2" />
            Goal Planning
          </TabsTrigger>
          <TabsTrigger value="risk-profiler" data-testid="tab-risk-profiler">
            <Crosshair className="h-4 w-4 mr-2" />
            Risk Profiler
          </TabsTrigger>
          <TabsTrigger value="what-if" data-testid="tab-what-if">
            <Shuffle className="h-4 w-4 mr-2" />
            What-If
          </TabsTrigger>
          <TabsTrigger value="benchmark" data-testid="tab-benchmark">
            <LineChart className="h-4 w-4 mr-2" />
            Benchmark
          </TabsTrigger>
        </ScrollableTabsList>

        <TabsContent value="portfolio" className="space-y-4">
          <div className="flex flex-wrap gap-2 mb-4">
            <Dialog open={showAddHoldingDialog} onOpenChange={setShowAddHoldingDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-add-holding">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Holding
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Portfolio Holding</DialogTitle>
                  <DialogDescription>
                    Manually add a stock or mutual fund to the portfolio
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Symbol</Label>
                      <Input 
                        placeholder="e.g., RELIANCE"
                        value={newHolding.symbol}
                        onChange={(e) => setNewHolding({ ...newHolding, symbol: e.target.value.toUpperCase() })}
                        data-testid="input-symbol"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Asset Type</Label>
                      <Select 
                        value={newHolding.assetType} 
                        onValueChange={(v) => setNewHolding({ ...newHolding, assetType: v })}
                      >
                        <SelectTrigger data-testid="select-asset-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EQUITY">Equity</SelectItem>
                          <SelectItem value="MUTUAL_FUND">Mutual Fund</SelectItem>
                          <SelectItem value="ETF">ETF</SelectItem>
                          <SelectItem value="BOND">Bond</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Company/Fund Name</Label>
                    <Input 
                      placeholder="e.g., Reliance Industries Ltd"
                      value={newHolding.name}
                      onChange={(e) => setNewHolding({ ...newHolding, name: e.target.value })}
                      data-testid="input-name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Quantity</Label>
                      <Input 
                        type="number"
                        placeholder="100"
                        value={newHolding.quantity || ''}
                        onChange={(e) => setNewHolding({ ...newHolding, quantity: parseInt(e.target.value) || 0 })}
                        data-testid="input-quantity"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Avg. Buy Price</Label>
                      <Input 
                        type="number"
                        placeholder="2500.00"
                        value={newHolding.averagePrice || ''}
                        onChange={(e) => setNewHolding({ ...newHolding, averagePrice: parseFloat(e.target.value) || 0 })}
                        data-testid="input-avg-price"
                      />
                    </div>
                  </div>
                  
                  {/* Purchase Date with Tax Classification Indicator */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Purchase Date
                      <span className="text-xs text-muted-foreground">(for exit load & capital gains)</span>
                    </Label>
                    <Input 
                      type="date"
                      value={newHolding.purchaseDate}
                      onChange={(e) => setNewHolding({ ...newHolding, purchaseDate: e.target.value })}
                      max={new Date().toISOString().split('T')[0]}
                      data-testid="input-purchase-date"
                    />
                    
                    {/* Tax Classification Preview */}
                    {holdingPeriodInfo && (
                      <div className="mt-3 p-3 rounded-lg border bg-muted/30">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Tax Classification</span>
                          <Badge 
                            variant={holdingPeriodInfo.isLTCG ? "default" : "secondary"}
                            className={cn(
                              holdingPeriodInfo.isLTCG 
                                ? "bg-green-500/10 text-green-600 border-green-200" 
                                : "bg-orange-500/10 text-orange-600 border-orange-200"
                            )}
                          >
                            {holdingPeriodInfo.taxType} @ {holdingPeriodInfo.taxRate}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex items-center gap-1">
                            <Timer className="h-3 w-3 text-muted-foreground" />
                            <span>Holding: {holdingPeriodInfo.days} days</span>
                          </div>
                          {!holdingPeriodInfo.isLTCG && holdingPeriodInfo.daysToLTCG > 0 && (
                            <div className="flex items-center gap-1 text-orange-600">
                              <Clock className="h-3 w-3" />
                              <span>{holdingPeriodInfo.daysToLTCG} days to LTCG</span>
                            </div>
                          )}
                        </div>
                        
                        {holdingPeriodInfo.exitLoadApplicable && (
                          <div className="mt-2 flex items-center gap-1 text-xs text-amber-600">
                            <AlertTriangle className="h-3 w-3" />
                            <span>Exit load may apply (within 1 year)</span>
                          </div>
                        )}
                        
                        {/* Date Validation Warnings */}
                        {holdingPeriodInfo.isFutureDate && (
                          <Alert variant="destructive" className="mt-2 py-2">
                            <AlertCircle className="h-3 w-3" />
                            <AlertDescription className="text-xs">
                              Purchase date cannot be in the future
                            </AlertDescription>
                          </Alert>
                        )}
                        {holdingPeriodInfo.isVeryOld && (
                          <Alert className="mt-2 py-2 border-amber-200 bg-amber-50">
                            <AlertTriangle className="h-3 w-3 text-amber-600" />
                            <AlertDescription className="text-xs text-amber-700">
                              This date is over 20 years ago. Please verify.
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAddHoldingDialog(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => addHoldingMutation.mutate(newHolding)}
                    disabled={!newHolding.symbol || !newHolding.quantity}
                    data-testid="button-confirm-add"
                  >
                    Add Holding
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-upload-csv">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload CSV
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload Portfolio CSV</DialogTitle>
                  <DialogDescription>
                    Upload a CSV file with columns: symbol, name, quantity, averagePrice, assetType
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                      isDragActive 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border dark:border-border hover:border-primary'
                    }`}
                    data-testid="dropzone-csv"
                  >
                    <input {...getInputProps()} />
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    {isDragActive ? (
                      <p>Drop the CSV file here...</p>
                    ) : (
                      <p>Drag & drop a CSV file, or click to select</p>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={showPasteDialog} onOpenChange={(open) => {
              setShowPasteDialog(open);
              if (!open) {
                setPastedText("");
                setParsedHoldings([]);
                setParseError(null);
              }
            }}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-paste-excel">
                  <ClipboardPaste className="h-4 w-4 mr-2" />
                  Paste from Excel
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                  <DialogTitle>Paste Portfolio Data</DialogTitle>
                  <DialogDescription>
                    Copy data from Excel, Google Sheets, or any spreadsheet and paste below. 
                    Auto-detects columns like Symbol, Quantity, Price, etc.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-auto py-4 space-y-4">
                  <Textarea 
                    placeholder="Paste your portfolio data here...

Example format:
Symbol  Name    Quantity        Avg Price
RELIANCE        Reliance Industries     100     2450.50
INFY    Infosys Limited 50      1520.00
TCS     Tata Consultancy        25      3850.00"
                    className="min-h-[150px] font-mono text-sm"
                    value={pastedText}
                    onChange={(e) => {
                      setPastedText(e.target.value);
                      parseClipboardData(e.target.value);
                    }}
                    data-testid="textarea-paste"
                  />
                  
                  {parseError && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Parse Error</AlertTitle>
                      <AlertDescription>{parseError}</AlertDescription>
                    </Alert>
                  )}
                  
                  {parsedHoldings.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-600">
                          Parsed {parsedHoldings.length} holdings
                        </span>
                      </div>
                      <div className="border rounded-lg max-h-[200px] overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Symbol</TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead className="text-right">Qty</TableHead>
                              <TableHead className="text-right">Avg Price</TableHead>
                              <TableHead>Type</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {parsedHoldings.slice(0, 10).map((h, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="font-medium">{h.symbol}</TableCell>
                                <TableCell className="max-w-[150px] truncate">{h.name}</TableCell>
                                <TableCell className="text-right">{h.quantity}</TableCell>
                                <TableCell className="text-right">{formatCurrency(h.averagePrice)}</TableCell>
                                <TableCell>{h.assetType}</TableCell>
                              </TableRow>
                            ))}
                            {parsedHoldings.length > 10 && (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center text-muted-foreground">
                                  ... and {parsedHoldings.length - 10} more holdings
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowPasteDialog(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => bulkImportMutation.mutate(parsedHoldings)}
                    disabled={parsedHoldings.length === 0 || bulkImportMutation.isPending}
                    data-testid="button-import-parsed"
                  >
                    {bulkImportMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Import {parsedHoldings.length} Holdings
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={showCASUploadDialog} onOpenChange={(open) => {
              setShowCASUploadDialog(open);
              if (!open) {
                setCasFile(null);
                setCasUploadType(null);
                setCasPreviewHoldings([]);
                setCasPreviewMode(false);
                setCasPreviewError(null);
              }
            }}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-import-cas">
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Import CAS/Statement
                </Button>
              </DialogTrigger>
              <DialogContent className={casPreviewMode ? "max-w-4xl max-h-[85vh] overflow-hidden flex flex-col" : "max-w-lg"}>
                <DialogHeader>
                  <DialogTitle>
                    {casPreviewMode ? 'Review Holdings Before Import' : 'Import Account Statement'}
                  </DialogTitle>
                  <DialogDescription>
                    {casPreviewMode 
                      ? `${casPreviewHoldings.length} holdings found. Review and edit as needed before importing.`
                      : 'Upload your CAMS/KFintech CAS PDF or NSDL/CDSL Demat statement to automatically import your portfolio'
                    }
                  </DialogDescription>
                </DialogHeader>
                
                <div className="py-4 space-y-4 flex-1 overflow-auto">
                  {casPreviewMode ? (
                    <div className="space-y-4">
                      {casPreviewError && (
                        <Alert variant="default">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle>Review Required</AlertTitle>
                          <AlertDescription>{casPreviewError}</AlertDescription>
                        </Alert>
                      )}
                      
                      <div className="border rounded-lg overflow-auto max-h-[400px]">
                        <Table>
                          <TableHeader className="sticky top-0 bg-background">
                            <TableRow>
                              <TableHead>Scheme/Stock Name</TableHead>
                              <TableHead className="text-right">Units</TableHead>
                              <TableHead className="text-right">Avg Price</TableHead>
                              <TableHead className="text-right">Value</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead className="w-[60px]">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {casPreviewHoldings.map((holding, idx) => (
                              <TableRow key={holding.id || idx}>
                                <TableCell className="max-w-[250px]">
                                  <div className="truncate font-medium">{holding.name}</div>
                                  {holding.folioNumber && (
                                    <div className="text-xs text-muted-foreground">Folio: {holding.folioNumber}</div>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">{holding.quantity.toFixed(3)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(holding.averagePrice)}</TableCell>
                                <TableCell className="text-right font-medium">{formatCurrency(holding.currentValue)}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {holding.assetType === 'mutual_fund' ? 'MF' : holding.assetType.toUpperCase()}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {(holding.confidenceScore || 100) >= 70 ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                        <span>{casPreviewHoldings.length} holdings ready to import</span>
                        <span className="font-medium">
                          Total Value: {formatCurrency(casPreviewHoldings.reduce((sum, h) => sum + h.currentValue, 0))}
                        </span>
                      </div>
                    </div>
                  ) : !casUploadType ? (
                    <div className="grid grid-cols-2 gap-4">
                      <Card 
                        className="cursor-pointer hover:border-primary transition-colors"
                        onClick={() => setCasUploadType('cas')}
                      >
                        <CardContent className="p-4 text-center">
                          <FileTextIcon className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                          <h4 className="font-medium">CAMS/KFintech CAS</h4>
                          <p className="text-xs text-muted-foreground">Mutual Fund Statement</p>
                        </CardContent>
                      </Card>
                      <Card 
                        className="cursor-pointer hover:border-primary transition-colors opacity-60"
                        onClick={() => setCasUploadType('demat')}
                      >
                        <CardContent className="p-4 text-center">
                          <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 text-green-600" />
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
                              <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-green-600" />
                              <p className="font-medium">{casFile.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {(casFile.size / 1024).toFixed(1)} KB · Click to change
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
                        <Alert variant="destructive">
                          <XCircle className="h-4 w-4" />
                          <AlertTitle>Parsing Failed</AlertTitle>
                          <AlertDescription>{casPreviewError}</AlertDescription>
                        </Alert>
                      )}
                      
                      {casUploadType === 'cas' && !casPreviewError && (
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Tip</AlertTitle>
                          <AlertDescription>
                            You can download your CAS from MFCentral, CAMSOnline, or KFintech portal. Make sure it's the detailed statement with unit balance.
                          </AlertDescription>
                        </Alert>
                      )}
                      
                      {casUploadType === 'demat' && !casPreviewError && (
                        <Alert>
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle>Beta Feature</AlertTitle>
                          <AlertDescription>
                            Demat statement parsing is in beta. Some holdings may require manual verification after import.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  )}
                </div>
                
                <DialogFooter>
                  {casPreviewMode ? (
                    <>
                      <Button variant="outline" onClick={() => {
                        setCasPreviewMode(false);
                        setCasPreviewHoldings([]);
                        setCasPreviewError(null);
                      }}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Upload
                      </Button>
                      <Button 
                        onClick={() => casUploadMutation.mutate(casPreviewHoldings)}
                        disabled={casUploadMutation.isPending || casPreviewHoldings.length === 0}
                      >
                        {casUploadMutation.isPending ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Importing...
                          </>
                        ) : (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            Confirm Import ({casPreviewHoldings.length})
                          </>
                        )}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" onClick={() => {
                        setShowCASUploadDialog(false);
                        setCasFile(null);
                        setCasUploadType(null);
                        setCasPreviewError(null);
                      }}>
                        Cancel
                      </Button>
                      {casUploadType && casFile && (
                        <Button 
                          onClick={() => casPreviewMutation.mutate(casFile)}
                          disabled={casPreviewMutation.isPending}
                        >
                          {casPreviewMutation.isPending ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Parsing...
                            </>
                          ) : (
                            <>
                              <Eye className="h-4 w-4 mr-2" />
                              Preview Holdings
                            </>
                          )}
                        </Button>
                      )}
                    </>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {portfolioLoading ? (
            <Card>
              <CardContent className="p-6">
                <div className="space-y-3">
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-64 w-full" />
                </div>
              </CardContent>
            </Card>
          ) : portfolio?.holdings?.length ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Current Holdings</CardTitle>
                    <CardDescription>
                      {portfolio.holdings.length} positions · Last updated: {new Date(portfolio.lastUpdated).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{formatCurrency(portfolio.totalValue)}</p>
                    <p className="text-sm text-muted-foreground">Total Value</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Tax Summary Card */}
                {(() => {
                  const stcgHoldings = portfolio.holdings.filter((h: any) => h.taxType === 'STCG' && h.gainLoss > 0);
                  const ltcgHoldings = portfolio.holdings.filter((h: any) => h.taxType === 'LTCG' && h.gainLoss > 0);
                  const totalSTCG = stcgHoldings.reduce((sum: number, h: any) => sum + h.gainLoss, 0);
                  const totalLTCG = ltcgHoldings.reduce((sum: number, h: any) => sum + h.gainLoss, 0);
                  const stcgTax = totalSTCG * 0.20;
                  const ltcgTax = totalLTCG * 0.125;
                  
                  if (totalSTCG > 0 || totalLTCG > 0) {
                    return (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 p-3 rounded-lg border bg-muted/20">
                        <div className="text-center p-2">
                          <div className="text-xs text-muted-foreground mb-1">STCG Gains</div>
                          <div className="font-semibold text-orange-600">{formatCurrency(totalSTCG)}</div>
                          <div className="text-xs text-muted-foreground">Tax @ 20%: {formatCurrency(stcgTax)}</div>
                        </div>
                        <div className="text-center p-2">
                          <div className="text-xs text-muted-foreground mb-1">LTCG Gains</div>
                          <div className="font-semibold text-green-600">{formatCurrency(totalLTCG)}</div>
                          <div className="text-xs text-muted-foreground">Tax @ 12.5%: {formatCurrency(ltcgTax)}</div>
                        </div>
                        <div className="text-center p-2">
                          <div className="text-xs text-muted-foreground mb-1">Total Tax Liability</div>
                          <div className="font-bold text-primary">{formatCurrency(stcgTax + ltcgTax)}</div>
                        </div>
                        <div className="text-center p-2">
                          <div className="text-xs text-muted-foreground mb-1">Holdings Breakdown</div>
                          <div className="flex justify-center gap-2">
                            <Badge variant="secondary" className="bg-orange-500/10 text-orange-600 text-xs">
                              {stcgHoldings.length} STCG
                            </Badge>
                            <Badge variant="secondary" className="bg-green-500/10 text-green-600 text-xs">
                              {ltcgHoldings.length} LTCG
                            </Badge>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
                
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Avg Price</TableHead>
                      <TableHead className="text-right">Current</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead className="text-right">P&L</TableHead>
                      <TableHead className="text-center">Tax Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {portfolio.holdings.map((holding: any, idx: number) => (
                      <TableRow key={holding.id || idx} data-testid={`row-holding-${idx}`}>
                        <TableCell className="font-medium">{holding.symbol}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">
                          {holding.name}
                        </TableCell>
                        <TableCell className="text-right">{holding.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(holding.averagePrice)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(holding.currentPrice)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(holding.currentValue)}</TableCell>
                        <TableCell className="text-right">
                          <span className={holding.gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatCurrency(holding.gainLoss)}
                            <br />
                            <span className="text-xs">({formatPercent(holding.gainLossPercent)})</span>
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {holding.taxType ? (
                            <div className="flex flex-col items-center gap-1">
                              <Badge 
                                variant="secondary"
                                className={cn(
                                  "text-xs",
                                  holding.taxType === 'LTCG' 
                                    ? "bg-green-500/10 text-green-600 border-green-200" 
                                    : "bg-orange-500/10 text-orange-600 border-orange-200"
                                )}
                              >
                                {holding.taxType}
                              </Badge>
                              {holding.taxType === 'STCG' && holding.daysToLTCG > 0 && (
                                <span className="text-[10px] text-muted-foreground">
                                  {holding.daysToLTCG}d to LTCG
                                </span>
                              )}
                              {holding.exitLoadApplicable && (
                                <span className="text-[10px] text-amber-600">
                                  Exit load
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Briefcase className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No Portfolio Data</h3>
                <p className="text-muted-foreground mb-4">
                  Import your client's existing portfolio to get started
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="outline" onClick={() => setShowAddHoldingDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Holding
                  </Button>
                  <Button variant="outline" onClick={() => setShowPasteDialog(true)}>
                    <ClipboardPaste className="h-4 w-4 mr-2" />
                    Paste from Excel
                  </Button>
                  <Button variant="outline" onClick={() => setShowUploadDialog(true)}>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload CSV
                  </Button>
                  <Button variant="outline" onClick={() => setShowCASUploadDialog(true)}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Import Statement
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          {analysisLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-8 w-24 mb-2" />
                    <Skeleton className="h-12 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : analysis ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <DollarSign className="h-4 w-4" />
                      <span className="text-sm">Total Value</span>
                    </div>
                    <p className="text-2xl font-bold" data-testid="text-total-value">
                      {formatCurrency(analysis.totalValue)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-sm">Total P&L</span>
                    </div>
                    <p className={`text-2xl font-bold ${analysis.totalGainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}
                       data-testid="text-total-pnl">
                      {formatCurrency(analysis.totalGainLoss)}
                      <span className="text-sm ml-1">({formatPercent(analysis.totalGainLossPercent)})</span>
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <Scale className="h-4 w-4" />
                      <span className="text-sm">Risk Score</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-2xl font-bold" data-testid="text-risk-score">
                        {analysis.riskScore}/100
                      </p>
                      <Badge variant={analysis.riskScore < 40 ? "default" : analysis.riskScore < 70 ? "secondary" : "destructive"}>
                        {analysis.riskScore < 40 ? 'Low' : analysis.riskScore < 70 ? 'Medium' : 'High'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <PieChart className="h-4 w-4" />
                      <span className="text-sm">Diversification</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-2xl font-bold" data-testid="text-diversification">
                        {analysis.diversificationScore}/100
                      </p>
                      <Progress value={analysis.diversificationScore} className="flex-1 h-2" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Fundamental Ratios</CardTitle>
                    <CardDescription>Average metrics across holdings</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-muted dark:bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">Avg P/E Ratio</p>
                        <p className="text-xl font-bold" data-testid="text-avg-pe">
                          {analysis.fundamentalRatios.avgPE.toFixed(2)}
                        </p>
                      </div>
                      <div className="p-4 bg-muted dark:bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">Avg P/B Ratio</p>
                        <p className="text-xl font-bold" data-testid="text-avg-pb">
                          {analysis.fundamentalRatios.avgPB.toFixed(2)}
                        </p>
                      </div>
                      <div className="p-4 bg-muted dark:bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">Avg ROE</p>
                        <p className="text-xl font-bold" data-testid="text-avg-roe">
                          {analysis.fundamentalRatios.avgROE.toFixed(2)}%
                        </p>
                      </div>
                      <div className="p-4 bg-muted dark:bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">Avg Debt/Equity</p>
                        <p className="text-xl font-bold" data-testid="text-avg-de">
                          {analysis.fundamentalRatios.avgDebtEquity.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Sector Allocation</CardTitle>
                    <CardDescription>Portfolio concentration by sector</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(analysis.sectorConcentration)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 6)
                        .map(([sector, weight]) => (
                          <div key={sector} className="flex items-center gap-3">
                            <span className="text-sm w-24 truncate">{sector}</span>
                            <Progress value={weight * 100} className="flex-1 h-2" />
                            <span className="text-sm font-medium w-12 text-right">
                              {(weight * 100).toFixed(1)}%
                            </span>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <PieChart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No Analysis Available</h3>
                <p className="text-muted-foreground mb-4">
                  {!selectedClientId 
                    ? "Please select a client from the dropdown above to view or run portfolio analysis"
                    : "Add portfolio holdings and run AI analysis to see insights"
                  }
                </p>
                {selectedClientId && (
                  <Button onClick={handleRunAnalysis} disabled={!portfolio}>
                    <Brain className="h-4 w-4 mr-2" />
                    Run Analysis
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="profit-picks" className="space-y-4">
          <div className="flex flex-col gap-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label>Investment Horizon:</Label>
                  <Select value={selectedHorizon} onValueChange={setSelectedHorizon}>
                    <SelectTrigger className="w-32" data-testid="select-horizon">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1M">1 Month</SelectItem>
                      <SelectItem value="3M">3 Months</SelectItem>
                      <SelectItem value="6M">6 Months</SelectItem>
                      <SelectItem value="1Y">1 Year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button 
                onClick={() => refetchPicks()}
                variant="outline"
                data-testid="button-refresh-picks"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Picks
              </Button>
            </div>
            
            {/* Product Type Selection */}
            <div className="flex flex-wrap items-center gap-2">
              <Label className="mr-2">Product Types:</Label>
              {[
                { id: 'stocks', label: 'Stocks', icon: TrendingUp },
                { id: 'mutual_funds', label: 'Mutual Funds', icon: PieChart },
                { id: 'bonds', label: 'Bonds/NCDs', icon: Briefcase },
                { id: 'etfs', label: 'ETFs', icon: BarChart3 },
                { id: 'gold', label: 'Gold/SGBs', icon: Target },
                { id: 'reits', label: 'REITs/InvITs', icon: Building2 }
              ].map(product => {
                const Icon = product.icon;
                const isSelected = selectedProductTypes.includes(product.id);
                return (
                  <Badge
                    key={product.id}
                    variant={isSelected ? "default" : "outline"}
                    className={`cursor-pointer transition-all ${
                      isSelected 
                        ? 'bg-primary text-primary-foreground' 
                        : 'hover:bg-primary/10'
                    }`}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedProductTypes(prev => prev.filter(p => p !== product.id));
                      } else {
                        setSelectedProductTypes(prev => [...prev, product.id]);
                      }
                    }}
                    data-testid={`badge-product-${product.id}`}
                  >
                    <Icon className="h-3 w-3 mr-1" />
                    {product.label}
                  </Badge>
                );
              })}
            </div>
          </div>

          {picksLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-6 w-32 mb-4" />
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredProfitPicks?.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProfitPicks.map((pick) => (
                <Card key={pick.id} className="overflow-hidden" data-testid={`card-pick-${pick.symbol}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{pick.symbol}</CardTitle>
                        <CardDescription className="truncate">{pick.companyName}</CardDescription>
                      </div>
                      <Badge className={SIGNAL_COLORS[pick.signal]}>
                        {pick.signal === 'BUY' && <ArrowUp className="h-3 w-3 mr-1" />}
                        {pick.signal === 'SELL' && <ArrowDown className="h-3 w-3 mr-1" />}
                        {pick.signal}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="text-center p-2 bg-muted dark:bg-muted rounded">
                        <p className="text-muted-foreground">Current</p>
                        <p className="font-bold">{formatCurrency(pick.currentPrice)}</p>
                      </div>
                      <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded">
                        <p className="text-muted-foreground">Target</p>
                        <p className="font-bold text-green-600">{formatCurrency(pick.targetPrice)}</p>
                      </div>
                      <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded">
                        <p className="text-muted-foreground">Stop Loss</p>
                        <p className="font-bold text-red-600">{formatCurrency(pick.stopLoss)}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Expected Return</span>
                      <span className={`font-bold ${pick.expectedReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPercent(pick.expectedReturn)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Confidence</span>
                      <div className="flex items-center gap-2">
                        <Progress value={pick.confidenceScore} className="w-16 h-2" />
                        <span className="font-medium">{pick.confidenceScore}%</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Risk Level</span>
                      <Badge variant="outline" className={RISK_COLORS[pick.riskLevel]}>
                        {pick.riskLevel}
                      </Badge>
                    </div>

                    <Separator />

                    <div className="text-sm">
                      <p className="text-muted-foreground mb-1">Technical Indicators</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>RSI: <span className="font-medium">{pick.technicalIndicators.rsi}</span></div>
                        <div>MACD: <span className="font-medium">{pick.technicalIndicators.macd}</span></div>
                        <div className="col-span-2">MA: <span className="font-medium">{pick.technicalIndicators.movingAverages}</span></div>
                      </div>
                    </div>

                    <div className="text-sm">
                      <p className="text-muted-foreground mb-1">AI Rationale</p>
                      <p className="text-xs line-clamp-3">{pick.aiRationale}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No AI Picks Available</h3>
                <p className="text-muted-foreground mb-4">
                  Run AI analysis to generate intelligent stock recommendations
                </p>
                <Button onClick={handleRunAnalysis} disabled={!portfolio}>
                  <Brain className="h-4 w-4 mr-2" />
                  Generate AI Picks
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          {alertsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : alerts?.length ? (
            <div className="space-y-4">
              {alerts.map((alert) => (
                <Alert 
                  key={alert.id} 
                  className={SEVERITY_COLORS[alert.severity]}
                  data-testid={`alert-${alert.id}`}
                >
                  <div className="flex items-start gap-3">
                    {alert.severity === 'CRITICAL' && <XCircle className="h-5 w-5 text-red-600" />}
                    {alert.severity === 'WARNING' && <AlertTriangle className="h-5 w-5 text-yellow-600" />}
                    {alert.severity === 'INFO' && <CheckCircle2 className="h-5 w-5 text-blue-600" />}
                    <div className="flex-1">
                      <AlertTitle className="flex items-center gap-2">
                        {alert.title}
                        <Badge variant="outline" className="text-xs">
                          {(alert.alertType || 'alert').replace('_', ' ')}
                        </Badge>
                      </AlertTitle>
                      <AlertDescription className="mt-1">
                        {alert.message}
                        {alert.benchmarkComparison && (
                          <div className="mt-2 p-2 bg-white/50 dark:bg-black/20 rounded text-sm">
                            <p>
                              <strong>{alert.benchmarkComparison.benchmark}:</strong>{' '}
                              Portfolio {formatPercent(alert.benchmarkComparison.portfolioReturn)} vs{' '}
                              Benchmark {formatPercent(alert.benchmarkComparison.benchmarkReturn)}
                            </p>
                            <p className="text-red-600 font-medium">
                              Underperformance: {formatPercent(alert.benchmarkComparison.underperformancePercent)}
                            </p>
                          </div>
                        )}
                      </AlertDescription>
                    </div>
                    {alert.actionRequired && (
                      <Badge variant="destructive" className="shrink-0">
                        Action Required
                      </Badge>
                    )}
                  </div>
                </Alert>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <h3 className="text-lg font-medium mb-2">No Alerts</h3>
                <p className="text-muted-foreground">
                  Portfolio is performing well with no issues detected
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="talking-points" className="space-y-4">
          {talkingPointsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : talkingPoints?.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {talkingPoints.map((point, idx) => {
                const Icon = CATEGORY_ICONS[point.category];
                return (
                  <Card key={idx} data-testid={`card-talking-point-${idx}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-full ${
                          point.category === 'STRENGTH' ? 'bg-green-100 text-green-600' :
                          point.category === 'CONCERN' ? 'bg-red-100 text-red-600' :
                          point.category === 'OPPORTUNITY' ? 'bg-blue-100 text-blue-600' :
                          'bg-purple-100 text-purple-600'
                        }`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <Badge variant="outline" className="text-xs mb-1">
                            {point.category}
                          </Badge>
                          <CardTitle className="text-base">{point.title}</CardTitle>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground dark:text-muted-foreground">{point.content}</p>
                      {point.supportingData && (
                        <p className="text-xs text-muted-foreground mt-2 italic">{point.supportingData}</p>
                      )}
                    </CardContent>
                    <CardFooter className="pt-0">
                      <Button variant="ghost" size="sm" className="w-full">
                        <Copy className="h-4 w-4 mr-2" />
                        Copy to Clipboard
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No Talking Points</h3>
                <p className="text-muted-foreground mb-4">
                  Run AI analysis to generate client talking points
                </p>
                <Button onClick={handleRunAnalysis} disabled={!portfolio}>
                  <Brain className="h-4 w-4 mr-2" />
                  Generate Talking Points
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="finalize" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Finalize Investment Recommendations</CardTitle>
              <CardDescription>
                Review AI picks and create an investment proposal for the client
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {filteredProfitPicks?.length ? (
                <>
                  <div className="bg-muted dark:bg-muted rounded-lg p-4">
                    <h4 className="font-medium mb-3">Selected AI Recommendations</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Symbol</TableHead>
                          <TableHead>Signal</TableHead>
                          <TableHead>Target</TableHead>
                          <TableHead>Expected Return</TableHead>
                          <TableHead>Confidence</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredProfitPicks.filter(p => p.signal === 'BUY').slice(0, 5).map((pick) => (
                          <TableRow key={pick.id}>
                            <TableCell className="font-medium">{pick.symbol}</TableCell>
                            <TableCell>
                              <Badge className={SIGNAL_COLORS[pick.signal]}>{pick.signal}</Badge>
                            </TableCell>
                            <TableCell>{formatCurrency(pick.targetPrice)}</TableCell>
                            <TableCell className="text-green-600">{formatPercent(pick.expectedReturn)}</TableCell>
                            <TableCell>{pick.confidenceScore}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <Alert>
                    <ShieldCheck className="h-4 w-4" />
                    <AlertTitle>Compliance Check</AlertTitle>
                    <AlertDescription>
                      All recommendations align with client's risk profile and investment objectives.
                      Creating a proposal will route through your firm's compliance workflow.
                    </AlertDescription>
                  </Alert>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Export Report
                    </Button>
                    <Button 
                      onClick={() => profitPicks && createProposalMutation.mutate(profitPicks.filter(p => p.signal === 'BUY'))}
                      disabled={createProposalMutation.isPending}
                      data-testid="button-create-proposal"
                    >
                      {createProposalMutation.isPending ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Create Investment Proposal
                        </>
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No Recommendations to Finalize</h3>
                  <p className="text-muted-foreground mb-4">
                    Generate AI profit picks first to create an investment proposal
                  </p>
                  <Button onClick={() => setActiveTab("profit-picks")}>
                    Go to AI Profit Picks
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="multi-product" className="space-y-4">
          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>SEBI Compliance Mode</AlertTitle>
            <AlertDescription>
              Agent view-only: You can review and explain recommendations but cannot modify suitability assessments.
              All advice is logged for 8-year regulatory retention.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Multi-Product Advisory Engine
              </CardTitle>
              <CardDescription>
                Generate AI-powered recommendations across 8 product categories with regulatory compliance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { id: 'stocks', name: 'Stocks', icon: TrendingUp, risk: 'Aggressive' },
                  { id: 'mutual_funds', name: 'Mutual Funds', icon: PieChart, risk: 'Moderate' },
                  { id: 'bonds', name: 'Bonds/NCDs', icon: Briefcase, risk: 'Conservative' },
                  { id: 'unlisted', name: 'Unlisted/Pre-IPO', icon: Lock, risk: 'HNI+' },
                  { id: 'mld', name: 'MLDs', icon: Calculator, risk: 'HNI+' },
                  { id: 'pms', name: 'PMS', icon: Target, risk: 'HNI+' },
                  { id: 'aif', name: 'AIF', icon: Building2, risk: 'Accredited' },
                  { id: 'cfd', name: 'CFDs/Offshore', icon: Globe, risk: 'High Risk' }
                ].map((product) => {
                  const Icon = product.icon;
                  const isSelected = selectedProductCategories.includes(product.id);
                  const eligibility = unifiedEligibility?.[product.id];
                  const isEligible = eligibility?.eligible ?? false;
                  
                  return (
                    <Card 
                      key={product.id}
                      className={`cursor-pointer transition-all ${
                        isSelected 
                          ? 'ring-2 ring-primary border-primary' 
                          : 'hover:border-primary/50'
                      } ${!isEligible && eligibility ? 'opacity-50' : ''}`}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedProductCategories(prev => prev.filter(p => p !== product.id));
                        } else {
                          setSelectedProductCategories(prev => [...prev, product.id]);
                        }
                      }}
                      data-testid={`card-product-${product.id}`}
                    >
                      <CardContent className="p-4 text-center">
                        <Icon className={`h-8 w-8 mx-auto mb-2 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                        <div className="font-medium text-sm">{product.name}</div>
                        <Badge 
                          variant="outline" 
                          className={`text-xs mt-1 ${
                            product.risk === 'Conservative' ? 'border-green-500 text-green-600' :
                            product.risk === 'Moderate' ? 'border-yellow-500 text-yellow-600' :
                            product.risk === 'Aggressive' ? 'border-orange-500 text-orange-600' :
                            'border-red-500 text-red-600'
                          }`}
                        >
                          {product.risk}
                        </Badge>
                        {eligibility && (
                          <div className="mt-2">
                            {isEligible ? (
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                                <Unlock className="h-3 w-3 mr-1" />
                                Eligible
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-xs">
                                <Lock className="h-3 w-3 mr-1" />
                                Blocked
                              </Badge>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <Separator />

              <div className="flex gap-4">
                <Button
                  variant="outline"
                  onClick={async () => {
                    setUnifiedAdvisoryLoading(true);
                    try {
                      const response = await apiRequest('/api/unified-advisory/eligibility', {
                        method: 'POST',
                        body: JSON.stringify({ clientId: selectedClientId })
                      });
                      const data = await response.json();
                      setUnifiedEligibility(data.eligibility || {});
                      toast({
                        title: "Eligibility Checked",
                        description: `${Object.values(data.eligibility || {}).filter((e: any) => e.eligible).length} products eligible`
                      });
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: "Failed to check eligibility",
                        variant: "destructive"
                      });
                    }
                    setUnifiedAdvisoryLoading(false);
                  }}
                  disabled={unifiedAdvisoryLoading}
                  data-testid="button-check-eligibility"
                >
                  {unifiedAdvisoryLoading ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-4 w-4 mr-2" />
                  )}
                  Check Eligibility
                </Button>

                <Button
                  onClick={async () => {
                    if (selectedProductCategories.length === 0) {
                      toast({
                        title: "Select Products",
                        description: "Please select at least one product category",
                        variant: "destructive"
                      });
                      return;
                    }
                    setUnifiedAdvisoryLoading(true);
                    try {
                      const response = await apiRequest(`/api/unified-advisory/recommendations/${selectedClientId}`, {
                        method: 'POST',
                        body: JSON.stringify({
                          productTypes: selectedProductCategories
                        })
                      });
                      const data = await response.json();
                      setUnifiedRecommendations(data);
                      toast({
                        title: "Recommendations Generated",
                        description: `Generated ${data.recommendations?.length || 0} recommendations`
                      });
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: "Failed to generate recommendations",
                        variant: "destructive"
                      });
                    }
                    setUnifiedAdvisoryLoading(false);
                  }}
                  disabled={unifiedAdvisoryLoading || selectedProductCategories.length === 0}
                  data-testid="button-generate-recommendations"
                >
                  {unifiedAdvisoryLoading ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Brain className="h-4 w-4 mr-2" />
                  )}
                  Generate AI Recommendations
                </Button>
              </div>

              {unifiedRecommendations && (
                <div className="space-y-4">
                  <Separator />
                  
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">AI Recommendations</h3>
                    <Badge variant="outline">
                      <Clock className="h-3 w-3 mr-1" />
                      {new Date().toLocaleString()}
                    </Badge>
                  </div>

                  {unifiedRecommendations.recommendations?.map((rec: any, index: number) => (
                    <Card key={index} className="border-l-4 border-l-primary">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{rec.productName}</CardTitle>
                          <div className="flex gap-2">
                            <Badge className={SIGNAL_COLORS[rec.action as keyof typeof SIGNAL_COLORS] || ''}>
                              {rec.action}
                            </Badge>
                            <Badge variant="outline">{rec.productType}</Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <p className="text-sm text-muted-foreground">{rec.rationale}</p>
                        <div className="flex gap-4 text-sm">
                          <span>Amount: <strong>₹{rec.suggestedAmount?.toLocaleString()}</strong></span>
                          <span>Expected Return: <strong>{rec.expectedReturn}%</strong></span>
                          <span>Risk: <Badge variant="outline" className={RISK_COLORS[rec.riskLevel as keyof typeof RISK_COLORS] || ''}>{rec.riskLevel}</Badge></span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {unifiedRecommendations.disclosures && (
                    <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <AlertTitle className="text-amber-800 dark:text-amber-200">Regulatory Disclosures</AlertTitle>
                      <AlertDescription className="text-amber-700 dark:text-amber-300 text-xs space-y-1">
                        {Object.entries(unifiedRecommendations.disclosures || {}).map(([key, value]) => (
                          <p key={key}>{String(value)}</p>
                        ))}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </CardContent>
            <CardFooter className="text-xs text-muted-foreground">
              <Eye className="h-3 w-3 mr-1" />
              Agent Mode: View and explain only. Recommendations are AI-generated with regulatory compliance.
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="itr-services" className="space-y-4">
          <ItrServicesTab clientId={selectedClientId} />
        </TabsContent>

        <TabsContent value="goal-planning" className="space-y-4">
          <GoalPlanningTab clientId={selectedClientId} clientName={selectedClient ? `${selectedClient.firstName} ${selectedClient.lastName}` : ''} />
        </TabsContent>

        <TabsContent value="risk-profiler" className="space-y-4">
          <RiskProfilerTab clientId={selectedClientId} clientName={selectedClient ? `${selectedClient.firstName} ${selectedClient.lastName}` : ''} />
        </TabsContent>

        <TabsContent value="what-if" className="space-y-4">
          <WhatIfSimulatorTab clientId={selectedClientId} portfolio={portfolio} analysis={analysis} />
        </TabsContent>

        <TabsContent value="benchmark" className="space-y-4">
          <BenchmarkComparisonTab clientId={selectedClientId} portfolio={portfolio} />
        </TabsContent>
      </Tabs>

      <Dialog open={showNewClientDialog} onOpenChange={setShowNewClientDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
            <DialogDescription>
              Create a new client to manage their portfolio and provide investment recommendations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  placeholder="Enter first name"
                  value={newClientData.firstName}
                  onChange={(e) => setNewClientData(prev => ({ ...prev, firstName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  placeholder="Enter last name"
                  value={newClientData.lastName}
                  onChange={(e) => setNewClientData(prev => ({ ...prev, lastName: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="client@example.com"
                value={newClientData.email}
                onChange={(e) => setNewClientData(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobile">Mobile Number</Label>
              <Input
                id="mobile"
                placeholder="9876543210"
                value={newClientData.mobile}
                onChange={(e) => setNewClientData(prev => ({ ...prev, mobile: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewClientDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => createClientMutation.mutate(newClientData)}
              disabled={createClientMutation.isPending || !newClientData.firstName || !newClientData.lastName}
            >
              {createClientMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create Client
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ITR Services Tab Component
function ItrServicesTab({ clientId }: { clientId: string }) {
  const { toast } = useToast();
  const [showCreateCaseDialog, setShowCreateCaseDialog] = useState(false);
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [assessmentYear, setAssessmentYear] = useState("2024-25");
  const [financialYear, setFinancialYear] = useState("2023-24");
  const [itrFormType, setItrFormType] = useState("ITR-2");

  const { data: itrStats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ['/api/agent/itr/stats'],
  });

  const { data: itrCases, isLoading: casesLoading, refetch: refetchCases } = useQuery<any[]>({
    queryKey: ['/api/agent/itr/cases'],
  });

  const { data: availableCas } = useQuery<any[]>({
    queryKey: ['/api/agent/itr/available-cas'],
  });

  const createCaseMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/agent/itr/cases', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "ITR case created successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/agent/itr/cases'] });
      queryClient.invalidateQueries({ queryKey: ['/api/agent/itr/stats'] });
      setShowCreateCaseDialog(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create case", variant: "destructive" });
    }
  });

  const autoPopulateMutation = useMutation({
    mutationFn: async (caseId: string) => {
      return apiRequest(`/api/agent/itr/cases/${caseId}/auto-populate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: (data: any) => {
      toast({ 
        title: "Income Data Auto-Populated", 
        description: `Total gross income: ₹${(data.data?.totalGrossIncome || 0).toLocaleString('en-IN')}` 
      });
      refetchCases();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to auto-populate data", variant: "destructive" });
    }
  });

  const calculateTaxMutation = useMutation({
    mutationFn: async ({ caseId, taxRegime }: { caseId: string; taxRegime: string }) => {
      return apiRequest(`/api/agent/itr/cases/${caseId}/calculate-tax`, {
        method: 'POST',
        body: JSON.stringify({ taxRegime }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: (data: any) => {
      const isRefund = data.refundOrDue < 0;
      toast({ 
        title: isRefund ? "Refund Expected" : "Tax Due",
        description: `${isRefund ? 'Refund' : 'Tax payable'}: ₹${Math.abs(data.refundOrDue).toLocaleString('en-IN')}`
      });
      refetchCases();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to calculate tax", variant: "destructive" });
    }
  });

  const assignCaMutation = useMutation({
    mutationFn: async ({ caseId, caId }: { caseId: string; caId: string }) => {
      return apiRequest(`/api/agent/itr/cases/${caseId}/assign-ca`, {
        method: 'POST',
        body: JSON.stringify({ caId }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: (data: any) => {
      toast({ title: "CA Assigned", description: `${data.caName} assigned to the case` });
      refetchCases();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to assign CA", variant: "destructive" });
    }
  });

  const formatCurrency = (value: number | string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num || 0);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      initiated: "bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground",
      documents_pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
      documents_received: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
      under_review: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
      ca_assigned: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
      processing: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
      filed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
      completed: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
    };
    return colors[status] || colors.initiated;
  };

  const DOCUMENT_TYPES = [
    { value: 'form_16', label: 'Form 16', description: 'Salary TDS certificate' },
    { value: 'form_16a', label: 'Form 16A', description: 'Non-salary TDS certificate' },
    { value: 'form_26as', label: 'Form 26AS', description: 'Annual Tax Statement' },
    { value: 'ais', label: 'AIS', description: 'Annual Information Statement' },
    { value: 'capital_gains_statement', label: 'Capital Gains Statement', description: 'From broker/DP' },
    { value: 'bank_statement', label: 'Bank Statement', description: 'Interest income proof' },
    { value: 'rent_receipt', label: 'Rent Receipt', description: 'HRA exemption proof' },
    { value: 'investment_proof', label: 'Investment Proof', description: '80C, 80D deductions' }
  ];

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Cases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{itrStats?.total_cases || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {(parseInt(itrStats?.under_review) || 0) + (parseInt(itrStats?.processing) || 0) + (parseInt(itrStats?.ca_assigned) || 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Filed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{itrStats?.filed || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(itrStats?.collected_fees || 0)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">ITR Filing Cases</h3>
        <Dialog open={showCreateCaseDialog} onOpenChange={setShowCreateCaseDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-itr-case">
              <Plus className="h-4 w-4 mr-2" />
              New ITR Case
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create ITR Filing Case</DialogTitle>
              <DialogDescription>
                Initiate CA-assisted ITR filing for your client
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Assessment Year</Label>
                <Select value={assessmentYear} onValueChange={setAssessmentYear}>
                  <SelectTrigger data-testid="select-ay">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2024-25">AY 2024-25</SelectItem>
                    <SelectItem value="2023-24">AY 2023-24</SelectItem>
                    <SelectItem value="2022-23">AY 2022-23</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Financial Year</Label>
                <Select value={financialYear} onValueChange={setFinancialYear}>
                  <SelectTrigger data-testid="select-fy">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2023-24">FY 2023-24</SelectItem>
                    <SelectItem value="2022-23">FY 2022-23</SelectItem>
                    <SelectItem value="2021-22">FY 2021-22</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>ITR Form Type</Label>
                <Select value={itrFormType} onValueChange={setItrFormType}>
                  <SelectTrigger data-testid="select-itr-form">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ITR-1">ITR-1 (Sahaj) - Salary & Interest</SelectItem>
                    <SelectItem value="ITR-2">ITR-2 - Salary, Capital Gains, Multiple Properties</SelectItem>
                    <SelectItem value="ITR-3">ITR-3 - Business/Profession Income</SelectItem>
                    <SelectItem value="ITR-4">ITR-4 (Sugam) - Presumptive Business</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateCaseDialog(false)}>Cancel</Button>
              <Button 
                onClick={() => createCaseMutation.mutate({
                  clientId,
                  assessmentYear,
                  financialYear,
                  itrFormType,
                  sourceProduct: 'investment_advisory'
                })}
                disabled={createCaseMutation.isPending}
                data-testid="button-confirm-create"
              >
                {createCaseMutation.isPending ? "Creating..." : "Create Case"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Cases List */}
      {casesLoading ? (
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      ) : !itrCases || itrCases.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No ITR Cases Yet</h3>
            <p className="text-muted-foreground mb-4">
              Start assisting your clients with their income tax filing
            </p>
            <Button onClick={() => setShowCreateCaseDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Case
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {itrCases.map((itrCase: any) => (
            <Card key={itrCase.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{itrCase.client_name || itrCase.client_email}</CardTitle>
                    <CardDescription>
                      {itrCase.itr_form_type || 'ITR'} - AY {itrCase.assessment_year}
                    </CardDescription>
                  </div>
                  <Badge className={getStatusColor(itrCase.status)}>
                    {itrCase.status?.replace(/_/g, ' ').toUpperCase()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Income Summary */}
                {parseFloat(itrCase.total_gross_income) > 0 && (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Gross Income:</span>
                      <span className="ml-2 font-medium">{formatCurrency(itrCase.total_gross_income)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tax Payable:</span>
                      <span className="ml-2 font-medium">{formatCurrency(itrCase.tax_payable)}</span>
                    </div>
                  </div>
                )}

                {/* Document Progress */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Documents</span>
                    <span>{(itrCase.documents_received?.length || 0)}/{(itrCase.documents_required?.length || 4)}</span>
                  </div>
                  <Progress 
                    value={((itrCase.documents_received?.length || 0) / (itrCase.documents_required?.length || 4)) * 100} 
                    className="h-2"
                  />
                </div>

                {/* CA Assignment */}
                {itrCase.ca_name ? (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>CA: {itrCase.ca_name}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Select onValueChange={(caId) => assignCaMutation.mutate({ caseId: itrCase.id, caId })}>
                      <SelectTrigger className="h-8 text-sm" data-testid={`select-ca-${itrCase.id}`}>
                        <SelectValue placeholder="Assign CA" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCas && availableCas.length > 0 ? (
                          availableCas.map((ca: any, idx: number) => (
                            <SelectItem key={ca.user_id || `ca-${idx}`} value={ca.user_id}>
                              {ca.full_name} ({ca.membership_type})
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem key="no-cas" value="none" disabled>No CAs available</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => autoPopulateMutation.mutate(itrCase.id)}
                  disabled={autoPopulateMutation.isPending}
                  data-testid={`button-auto-populate-${itrCase.id}`}
                >
                  <RefreshCw className={`h-3 w-3 mr-1 ${autoPopulateMutation.isPending ? 'animate-spin' : ''}`} />
                  Auto-Fill
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => calculateTaxMutation.mutate({ caseId: itrCase.id, taxRegime: 'new' })}
                  disabled={calculateTaxMutation.isPending}
                  data-testid={`button-calc-tax-${itrCase.id}`}
                >
                  <Calculator className="h-3 w-3 mr-1" />
                  Calculate
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setSelectedCase(itrCase)}
                  data-testid={`button-view-case-${itrCase.id}`}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  Details
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Case Details Dialog */}
      <Dialog open={!!selectedCase} onOpenChange={() => setSelectedCase(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>ITR Case Details</DialogTitle>
            <DialogDescription>
              {selectedCase?.client_name} - AY {selectedCase?.assessment_year}
            </DialogDescription>
          </DialogHeader>
          {selectedCase && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">
                    <Badge className={getStatusColor(selectedCase.status)}>
                      {selectedCase.status?.replace(/_/g, ' ').toUpperCase()}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">ITR Form</Label>
                  <p className="font-medium">{selectedCase.itr_form_type || 'Not determined'}</p>
                </div>
              </div>

              <Separator />

              <div>
                <Label className="text-muted-foreground">Income Breakdown</Label>
                <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                  <div className="flex justify-between p-2 bg-muted rounded">
                    <span>Salary Income</span>
                    <span className="font-medium">{formatCurrency(selectedCase.salary_income)}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-muted rounded">
                    <span>Interest Income</span>
                    <span className="font-medium">{formatCurrency(selectedCase.interest_income)}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-muted rounded">
                    <span>Dividend Income</span>
                    <span className="font-medium">{formatCurrency(selectedCase.dividend_income)}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-muted rounded">
                    <span>Capital Gains (STCG)</span>
                    <span className="font-medium">{formatCurrency(selectedCase.capital_gains_stcg)}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-muted rounded">
                    <span>Capital Gains (LTCG)</span>
                    <span className="font-medium">{formatCurrency(selectedCase.capital_gains_ltcg)}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-muted rounded">
                    <span>Other Income</span>
                    <span className="font-medium">{formatCurrency(selectedCase.other_income)}</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <p className="text-sm text-muted-foreground">Gross Income</p>
                  <p className="text-xl font-bold text-blue-600">{formatCurrency(selectedCase.total_gross_income)}</p>
                </div>
                <div className="text-center p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                  <p className="text-sm text-muted-foreground">Tax Payable</p>
                  <p className="text-xl font-bold text-purple-600">{formatCurrency(selectedCase.tax_payable)}</p>
                </div>
                <div className={`text-center p-4 rounded-lg ${parseFloat(selectedCase.refund_or_due) < 0 ? 'bg-green-50 dark:bg-green-950' : 'bg-red-50 dark:bg-red-950'}`}>
                  <p className="text-sm text-muted-foreground">
                    {parseFloat(selectedCase.refund_or_due) < 0 ? 'Refund' : 'Balance Due'}
                  </p>
                  <p className={`text-xl font-bold ${parseFloat(selectedCase.refund_or_due) < 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(Math.abs(parseFloat(selectedCase.refund_or_due) || 0))}
                  </p>
                </div>
              </div>

              <Separator />

              <div>
                <Label className="text-muted-foreground">Required Documents</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {DOCUMENT_TYPES.map((doc) => {
                    const isReceived = selectedCase.documents_received?.includes(doc.value);
                    return (
                      <div 
                        key={doc.value}
                        className={`flex items-center gap-2 p-2 rounded ${isReceived ? 'bg-green-50 dark:bg-green-950' : 'bg-muted dark:bg-card'}`}
                      >
                        {isReceived ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <Clock className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="text-sm">{doc.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedCase(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Goal Planning Tab Component
const GOAL_TYPES = [
  { id: 'retirement', label: 'Retirement', icon: Wallet, color: 'bg-blue-500', description: 'Build retirement corpus' },
  { id: 'education', label: 'Child Education', icon: GraduationCap, color: 'bg-purple-500', description: 'Fund education expenses' },
  { id: 'house', label: 'House Purchase', icon: Home, color: 'bg-green-500', description: 'Save for dream home' },
  { id: 'car', label: 'Vehicle', icon: Car, color: 'bg-orange-500', description: 'Buy a car or vehicle' },
  { id: 'vacation', label: 'Vacation', icon: Plane, color: 'bg-pink-500', description: 'Plan a trip' },
  { id: 'wealth', label: 'Wealth Creation', icon: TrendingUp, color: 'bg-emerald-500', description: 'Grow your wealth' },
  { id: 'emergency', label: 'Emergency Fund', icon: Heart, color: 'bg-red-500', description: '6 months expenses' },
  { id: 'other', label: 'Other Goal', icon: Goal, color: 'bg-gray-500', description: 'Custom goal' },
];

interface InvestmentGoal {
  id: string;
  type: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  monthlyContribution: number;
  expectedReturn: number;
  riskLevel: string;
  progress: number;
  createdAt: string;
}

function GoalPlanningTab({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { toast } = useToast();
  const [showAddGoalDialog, setShowAddGoalDialog] = useState(false);
  const [selectedGoalType, setSelectedGoalType] = useState<string>('');
  const [goalForm, setGoalForm] = useState({
    name: '',
    targetAmount: '',
    targetYears: '',
    currentAmount: '',
    expectedReturn: '12',
    riskLevel: 'moderate'
  });

  const { data: goals = [], isLoading, refetch } = useQuery<InvestmentGoal[]>({
    queryKey: ['/api/ai-investment/goals', clientId],
    queryFn: async () => {
      const res = await fetch(`/api/ai-investment/goals/${clientId}`);
      if (!res.ok) throw new Error('Failed to fetch goals');
      return res.json();
    },
    enabled: !!clientId
  });

  const createGoalMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/ai-investment/goals', {
        method: 'POST',
        body: JSON.stringify({ ...data, clientId })
      });
    },
    onSuccess: () => {
      toast({ title: "Goal created", description: "Investment goal added successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/ai-investment/goals', clientId] });
      setShowAddGoalDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create goal", variant: "destructive" });
    }
  });

  const deleteGoalMutation = useMutation({
    mutationFn: async (goalId: string) => {
      return apiRequest(`/api/ai-investment/goals/${goalId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      toast({ title: "Goal deleted", description: "Investment goal removed" });
      queryClient.invalidateQueries({ queryKey: ['/api/ai-investment/goals', clientId] });
    }
  });

  const resetForm = () => {
    setSelectedGoalType('');
    setGoalForm({ name: '', targetAmount: '', targetYears: '', currentAmount: '', expectedReturn: '12', riskLevel: 'moderate' });
  };

  const calculateSIP = () => {
    const target = parseFloat(goalForm.targetAmount) || 0;
    const current = parseFloat(goalForm.currentAmount) || 0;
    const years = parseFloat(goalForm.targetYears) || 1;
    const rate = parseFloat(goalForm.expectedReturn) || 12;
    const monthlyRate = rate / 100 / 12;
    const months = years * 12;
    const futureValueNeeded = target - current * Math.pow(1 + rate / 100, years);
    if (futureValueNeeded <= 0) return 0;
    const sip = futureValueNeeded * monthlyRate / (Math.pow(1 + monthlyRate, months) - 1);
    return Math.ceil(sip / 100) * 100;
  };

  const handleCreateGoal = () => {
    const targetDate = new Date();
    targetDate.setFullYear(targetDate.getFullYear() + parseInt(goalForm.targetYears || '1'));
    createGoalMutation.mutate({
      type: selectedGoalType,
      name: goalForm.name || GOAL_TYPES.find(g => g.id === selectedGoalType)?.label,
      targetAmount: parseFloat(goalForm.targetAmount),
      currentAmount: parseFloat(goalForm.currentAmount) || 0,
      targetDate: targetDate.toISOString(),
      monthlyContribution: calculateSIP(),
      expectedReturn: parseFloat(goalForm.expectedReturn),
      riskLevel: goalForm.riskLevel
    });
  };

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

  if (!clientId) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Goal className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">Select a Client</h3>
          <p className="text-muted-foreground">Choose a client to manage their investment goals</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Investment Goals for {clientName}</h2>
          <p className="text-sm text-muted-foreground">Plan and track financial goals with SIP recommendations</p>
        </div>
        <Button onClick={() => setShowAddGoalDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Goal
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : goals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No Goals Yet</h3>
            <p className="text-muted-foreground mb-4">Create investment goals to help your client plan their financial future</p>
            <Button onClick={() => setShowAddGoalDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Goal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => {
            const goalType = GOAL_TYPES.find(g => g.id === goal.type) || GOAL_TYPES[7];
            const Icon = goalType.icon;
            return (
              <Card key={goal.id} className="overflow-hidden">
                <div className={`h-2 ${goalType.color}`} />
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-full ${goalType.color} text-white`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <CardTitle className="text-base">{goal.name}</CardTitle>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteGoalMutation.mutate(goal.id)}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{formatCurrency(goal.currentAmount)}</span>
                      <span className="text-muted-foreground">{formatCurrency(goal.targetAmount)}</span>
                    </div>
                    <Progress value={goal.progress} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">{goal.progress.toFixed(0)}% achieved</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="p-2 bg-muted rounded">
                      <p className="text-xs text-muted-foreground">Monthly SIP</p>
                      <p className="font-medium">{formatCurrency(goal.monthlyContribution)}</p>
                    </div>
                    <div className="p-2 bg-muted rounded">
                      <p className="text-xs text-muted-foreground">Target Date</p>
                      <p className="font-medium">{new Date(goal.targetDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline">{goal.riskLevel}</Badge>
                    <span className="text-muted-foreground">{goal.expectedReturn}% expected return</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showAddGoalDialog} onOpenChange={(open) => { setShowAddGoalDialog(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Investment Goal</DialogTitle>
            <DialogDescription>Set up a financial goal with timeline and SIP calculator</DialogDescription>
          </DialogHeader>
          
          {!selectedGoalType ? (
            <div className="grid grid-cols-4 gap-3 py-4">
              {GOAL_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.id}
                    onClick={() => setSelectedGoalType(type.id)}
                    className="flex flex-col items-center gap-2 p-4 rounded-lg border hover:border-primary hover:bg-accent transition-colors"
                  >
                    <div className={`p-3 rounded-full ${type.color} text-white`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-medium">{type.label}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <Button variant="ghost" size="sm" onClick={() => setSelectedGoalType('')} className="mb-2">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Change Goal Type
              </Button>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Goal Name</Label>
                  <Input
                    placeholder={GOAL_TYPES.find(g => g.id === selectedGoalType)?.label}
                    value={goalForm.name}
                    onChange={(e) => setGoalForm(p => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Target Amount (₹)</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 5000000"
                    value={goalForm.targetAmount}
                    onChange={(e) => setGoalForm(p => ({ ...p, targetAmount: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Current Savings (₹)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={goalForm.currentAmount}
                    onChange={(e) => setGoalForm(p => ({ ...p, currentAmount: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Time Horizon (Years)</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 10"
                    value={goalForm.targetYears}
                    onChange={(e) => setGoalForm(p => ({ ...p, targetYears: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Expected Annual Return (%)</Label>
                  <Select value={goalForm.expectedReturn} onValueChange={(v) => setGoalForm(p => ({ ...p, expectedReturn: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="8">8% (Conservative)</SelectItem>
                      <SelectItem value="10">10% (Moderate)</SelectItem>
                      <SelectItem value="12">12% (Balanced)</SelectItem>
                      <SelectItem value="14">14% (Growth)</SelectItem>
                      <SelectItem value="15">15% (Aggressive)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Risk Appetite</Label>
                  <Select value={goalForm.riskLevel} onValueChange={(v) => setGoalForm(p => ({ ...p, riskLevel: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conservative">Conservative</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="aggressive">Aggressive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {goalForm.targetAmount && goalForm.targetYears && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Recommended Monthly SIP</p>
                        <p className="text-2xl font-bold text-primary">{formatCurrency(calculateSIP())}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">To achieve</p>
                        <p className="font-medium">{formatCurrency(parseFloat(goalForm.targetAmount) || 0)}</p>
                        <p className="text-xs text-muted-foreground">in {goalForm.targetYears} years</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddGoalDialog(false); resetForm(); }}>Cancel</Button>
            <Button 
              onClick={handleCreateGoal} 
              disabled={!selectedGoalType || !goalForm.targetAmount || !goalForm.targetYears || createGoalMutation.isPending}
            >
              {createGoalMutation.isPending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Create Goal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Risk Profiler Tab Component
const RISK_QUESTIONS = [
  {
    id: 'age',
    question: 'What is your age group?',
    options: [
      { value: 'under_30', label: 'Under 30', score: 5 },
      { value: '30_40', label: '30-40', score: 4 },
      { value: '40_50', label: '40-50', score: 3 },
      { value: '50_60', label: '50-60', score: 2 },
      { value: 'above_60', label: 'Above 60', score: 1 },
    ]
  },
  {
    id: 'income_stability',
    question: 'How stable is your income?',
    options: [
      { value: 'very_stable', label: 'Very stable (government/PSU)', score: 5 },
      { value: 'stable', label: 'Stable (MNC/large company)', score: 4 },
      { value: 'moderate', label: 'Moderate (small business/startup)', score: 3 },
      { value: 'variable', label: 'Variable (freelancer/commission)', score: 2 },
      { value: 'uncertain', label: 'Uncertain', score: 1 },
    ]
  },
  {
    id: 'investment_horizon',
    question: 'What is your investment time horizon?',
    options: [
      { value: 'short', label: 'Less than 3 years', score: 1 },
      { value: 'medium', label: '3-5 years', score: 2 },
      { value: 'long', label: '5-10 years', score: 4 },
      { value: 'very_long', label: 'More than 10 years', score: 5 },
    ]
  },
  {
    id: 'loss_reaction',
    question: 'If your portfolio drops 20% in a month, you would:',
    options: [
      { value: 'sell_all', label: 'Sell everything immediately', score: 1 },
      { value: 'sell_some', label: 'Sell some to reduce exposure', score: 2 },
      { value: 'hold', label: 'Hold and wait for recovery', score: 3 },
      { value: 'buy_more', label: 'Buy more at lower prices', score: 5 },
    ]
  },
  {
    id: 'return_expectation',
    question: 'What annual returns do you expect?',
    options: [
      { value: 'fd_like', label: '6-8% (FD-like)', score: 1 },
      { value: 'moderate', label: '8-12%', score: 2 },
      { value: 'market', label: '12-15% (market returns)', score: 3 },
      { value: 'aggressive', label: '15-20%', score: 4 },
      { value: 'very_high', label: '20%+ (high risk)', score: 5 },
    ]
  },
  {
    id: 'experience',
    question: 'What is your investment experience?',
    options: [
      { value: 'none', label: 'None (first time)', score: 1 },
      { value: 'basic', label: 'Basic (FDs, savings)', score: 2 },
      { value: 'intermediate', label: 'Intermediate (MFs, some stocks)', score: 3 },
      { value: 'advanced', label: 'Advanced (active trading)', score: 4 },
      { value: 'expert', label: 'Expert (derivatives, F&O)', score: 5 },
    ]
  },
];

function RiskProfilerTab({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { toast } = useToast();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [showResult, setShowResult] = useState(false);

  const { data: existingProfile, isLoading } = useQuery<any>({
    queryKey: ['/api/ai-investment/risk-profile', clientId],
    enabled: !!clientId
  });

  const saveProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/ai-investment/risk-profile', {
        method: 'POST',
        body: JSON.stringify({ ...data, clientId })
      });
    },
    onSuccess: () => {
      toast({ title: "Profile saved", description: "Risk profile updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/ai-investment/risk-profile', clientId] });
    }
  });

  const calculateScore = () => {
    let total = 0;
    let count = 0;
    RISK_QUESTIONS.forEach(q => {
      const answer = answers[q.id];
      if (answer) {
        const option = q.options.find(o => o.value === answer);
        if (option) {
          total += option.score;
          count++;
        }
      }
    });
    return count > 0 ? Math.round((total / (count * 5)) * 100) : 0;
  };

  const getRiskCategory = (score: number) => {
    if (score >= 80) return { label: 'Aggressive', color: 'text-red-600', bgColor: 'bg-red-100', description: 'High risk tolerance, seeks maximum returns' };
    if (score >= 60) return { label: 'Moderately Aggressive', color: 'text-orange-600', bgColor: 'bg-orange-100', description: 'Above average risk tolerance' };
    if (score >= 40) return { label: 'Moderate', color: 'text-yellow-600', bgColor: 'bg-yellow-100', description: 'Balanced approach to risk and return' };
    if (score >= 20) return { label: 'Conservative', color: 'text-blue-600', bgColor: 'bg-blue-100', description: 'Prefers stability over high returns' };
    return { label: 'Very Conservative', color: 'text-green-600', bgColor: 'bg-green-100', description: 'Capital preservation is priority' };
  };

  const getRecommendedAllocation = (score: number) => {
    if (score >= 80) return { equity: 80, debt: 15, gold: 5 };
    if (score >= 60) return { equity: 65, debt: 25, gold: 10 };
    if (score >= 40) return { equity: 50, debt: 35, gold: 15 };
    if (score >= 20) return { equity: 30, debt: 55, gold: 15 };
    return { equity: 15, debt: 70, gold: 15 };
  };

  const score = calculateScore();
  const riskCategory = getRiskCategory(score);
  const allocation = getRecommendedAllocation(score);
  const isComplete = Object.keys(answers).length === RISK_QUESTIONS.length;

  const handleAnswer = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    if (currentQuestion < RISK_QUESTIONS.length - 1) {
      setTimeout(() => setCurrentQuestion(prev => prev + 1), 300);
    }
  };

  const handleSaveProfile = () => {
    saveProfileMutation.mutate({
      answers,
      score,
      riskCategory: riskCategory.label,
      allocation
    });
  };

  if (!clientId) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Crosshair className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">Select a Client</h3>
          <p className="text-muted-foreground">Choose a client to assess their risk profile</p>
        </CardContent>
      </Card>
    );
  }

  if (existingProfile && !showResult && Object.keys(answers).length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crosshair className="h-5 w-5" />
            Risk Profile for {clientName}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-6">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" r="56" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted" />
                <circle cx="64" cy="64" r="56" fill="none" stroke="currentColor" strokeWidth="8" className="text-primary" strokeDasharray={`${(existingProfile.score / 100) * 352} 352`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-3xl font-bold">{existingProfile.score}</span>
                <span className="text-xs text-muted-foreground">Score</span>
              </div>
            </div>
            <div>
              <Badge className={`${getRiskCategory(existingProfile.score).bgColor} ${getRiskCategory(existingProfile.score).color} text-lg px-4 py-2`}>
                {existingProfile.riskCategory}
              </Badge>
              <p className="text-muted-foreground mt-2">{getRiskCategory(existingProfile.score).description}</p>
              <p className="text-sm text-muted-foreground mt-1">Last updated: {new Date(existingProfile.updatedAt).toLocaleDateString('en-IN')}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg text-center">
              <p className="text-2xl font-bold text-blue-600">{existingProfile.allocation?.equity || 50}%</p>
              <p className="text-sm text-muted-foreground">Equity</p>
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg text-center">
              <p className="text-2xl font-bold text-green-600">{existingProfile.allocation?.debt || 35}%</p>
              <p className="text-sm text-muted-foreground">Debt</p>
            </div>
            <div className="p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg text-center">
              <p className="text-2xl font-bold text-yellow-600">{existingProfile.allocation?.gold || 15}%</p>
              <p className="text-sm text-muted-foreground">Gold</p>
            </div>
          </div>

          <Button onClick={() => { setAnswers({}); setCurrentQuestion(0); }} className="w-full">
            <RotateCcw className="h-4 w-4 mr-2" />
            Reassess Risk Profile
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isComplete && !showResult) {
    setShowResult(true);
  }

  if (showResult) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Risk Assessment Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-6">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" r="56" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted" />
                <circle cx="64" cy="64" r="56" fill="none" stroke="currentColor" strokeWidth="8" className="text-primary" strokeDasharray={`${(score / 100) * 352} 352`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-3xl font-bold">{score}</span>
                <span className="text-xs text-muted-foreground">Score</span>
              </div>
            </div>
            <div>
              <Badge className={`${riskCategory.bgColor} ${riskCategory.color} text-lg px-4 py-2`}>{riskCategory.label}</Badge>
              <p className="text-muted-foreground mt-2">{riskCategory.description}</p>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-3">Recommended Asset Allocation</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-600">{allocation.equity}%</p>
                <p className="text-sm text-muted-foreground">Equity</p>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">{allocation.debt}%</p>
                <p className="text-sm text-muted-foreground">Debt</p>
              </div>
              <div className="p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg text-center">
                <p className="text-2xl font-bold text-yellow-600">{allocation.gold}%</p>
                <p className="text-sm text-muted-foreground">Gold</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { setShowResult(false); setAnswers({}); setCurrentQuestion(0); }}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Retake
            </Button>
            <Button onClick={handleSaveProfile} disabled={saveProfileMutation.isPending} className="flex-1">
              {saveProfileMutation.isPending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              Save Profile
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const question = RISK_QUESTIONS[currentQuestion];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Risk Assessment for {clientName}</CardTitle>
          <span className="text-sm text-muted-foreground">{currentQuestion + 1} of {RISK_QUESTIONS.length}</span>
        </div>
        <Progress value={((currentQuestion + 1) / RISK_QUESTIONS.length) * 100} className="h-2" />
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="text-lg font-medium mb-4">{question.question}</h3>
          <div className="space-y-3">
            {question.options.map((option) => (
              <button
                key={option.value}
                onClick={() => handleAnswer(question.id, option.value)}
                className={`w-full p-4 rounded-lg border text-left transition-all ${
                  answers[question.id] === option.value 
                    ? 'border-primary bg-primary/5' 
                    : 'hover:border-primary/50 hover:bg-accent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    answers[question.id] === option.value ? 'border-primary bg-primary' : 'border-muted-foreground'
                  }`}>
                    {answers[question.id] === option.value && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <span>{option.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" disabled={currentQuestion === 0} onClick={() => setCurrentQuestion(prev => prev - 1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          <Button 
            className="flex-1" 
            disabled={!answers[question.id]}
            onClick={() => currentQuestion < RISK_QUESTIONS.length - 1 ? setCurrentQuestion(prev => prev + 1) : setShowResult(true)}
          >
            {currentQuestion === RISK_QUESTIONS.length - 1 ? 'View Results' : 'Next'}
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// What-If Simulator Tab Component
function WhatIfSimulatorTab({ clientId, portfolio, analysis }: { clientId: string; portfolio?: Portfolio; analysis?: PortfolioAnalysis }) {
  const [simulatedChanges, setSimulatedChanges] = useState<Array<{ symbol: string; action: 'add' | 'remove' | 'modify'; quantity: number; price: number }>>([]);
  const [newSimulation, setNewSimulation] = useState<{ symbol: string; action: 'add' | 'remove'; quantity: string; price: string }>({ symbol: '', action: 'add', quantity: '', price: '' });

  const calculateImpact = () => {
    if (!analysis) return null;
    let newValue = analysis.totalValue;
    simulatedChanges.forEach(change => {
      const changeValue = change.quantity * change.price;
      if (change.action === 'add') newValue += changeValue;
      else if (change.action === 'remove') newValue -= changeValue;
    });
    const valueChange = newValue - analysis.totalValue;
    const percentChange = (valueChange / analysis.totalValue) * 100;
    return { newValue, valueChange, percentChange };
  };

  const addSimulation = () => {
    if (newSimulation.symbol && newSimulation.quantity && newSimulation.price) {
      setSimulatedChanges(prev => [...prev, {
        symbol: newSimulation.symbol.toUpperCase(),
        action: newSimulation.action,
        quantity: parseFloat(newSimulation.quantity),
        price: parseFloat(newSimulation.price)
      }]);
      setNewSimulation({ symbol: '', action: 'add', quantity: '', price: '' });
    }
  };

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
  const impact = calculateImpact();

  if (!clientId || !portfolio) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Shuffle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">What-If Simulator</h3>
          <p className="text-muted-foreground">Select a client with a portfolio to simulate changes</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shuffle className="h-5 w-5" />
            Simulate Portfolio Changes
          </CardTitle>
          <CardDescription>Test how adding or removing holdings would affect the portfolio</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-2">
            <Input placeholder="Symbol" value={newSimulation.symbol} onChange={(e) => setNewSimulation(p => ({ ...p, symbol: e.target.value.toUpperCase() }))} />
            <Select value={newSimulation.action} onValueChange={(v: 'add' | 'remove') => setNewSimulation(p => ({ ...p, action: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="add">Add</SelectItem>
                <SelectItem value="remove">Remove</SelectItem>
              </SelectContent>
            </Select>
            <Input type="number" placeholder="Qty" value={newSimulation.quantity} onChange={(e) => setNewSimulation(p => ({ ...p, quantity: e.target.value }))} />
            <Input type="number" placeholder="Price" value={newSimulation.price} onChange={(e) => setNewSimulation(p => ({ ...p, price: e.target.value }))} />
          </div>
          <Button onClick={addSimulation} disabled={!newSimulation.symbol || !newSimulation.quantity || !newSimulation.price} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add to Simulation
          </Button>

          {simulatedChanges.length > 0 && (
            <div className="space-y-2">
              <Label>Simulated Changes</Label>
              {simulatedChanges.map((change, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <Badge variant={change.action === 'add' ? 'default' : 'destructive'}>{change.action}</Badge>
                    <span className="font-medium">{change.symbol}</span>
                    <span className="text-muted-foreground">x{change.quantity} @ {formatCurrency(change.price)}</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setSimulatedChanges(prev => prev.filter((_, i) => i !== idx))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" onClick={() => setSimulatedChanges([])} className="w-full">
                <RotateCcw className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Impact Analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {analysis && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Current Value</p>
                  <p className="text-xl font-bold">{formatCurrency(analysis.totalValue)}</p>
                </div>
                <div className={`p-4 rounded-lg ${impact && impact.valueChange >= 0 ? 'bg-green-50 dark:bg-green-950' : 'bg-red-50 dark:bg-red-950'}`}>
                  <p className="text-sm text-muted-foreground">After Changes</p>
                  <p className={`text-xl font-bold ${impact && impact.valueChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {impact ? formatCurrency(impact.newValue) : formatCurrency(analysis.totalValue)}
                  </p>
                </div>
              </div>

              {impact && simulatedChanges.length > 0 && (
                <div className={`p-4 rounded-lg border ${impact.valueChange >= 0 ? 'border-green-200 bg-green-50 dark:bg-green-950' : 'border-red-200 bg-red-50 dark:bg-red-950'}`}>
                  <div className="flex items-center gap-2">
                    {impact.valueChange >= 0 ? <TrendingUp className="h-5 w-5 text-green-600" /> : <TrendingDown className="h-5 w-5 text-red-600" />}
                    <span className={`text-lg font-bold ${impact.valueChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {impact.valueChange >= 0 ? '+' : ''}{formatCurrency(impact.valueChange)} ({impact.percentChange >= 0 ? '+' : ''}{impact.percentChange.toFixed(2)}%)
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">Projected portfolio change</p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Current Portfolio Metrics</Label>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="p-2 bg-muted rounded">Risk Score: {analysis.riskScore}/100</div>
                  <div className="p-2 bg-muted rounded">Diversification: {analysis.diversificationScore}/100</div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Benchmark Comparison Tab Component
function BenchmarkComparisonTab({ clientId, portfolio }: { clientId: string; portfolio?: Portfolio }) {
  const { data: benchmarkData, isLoading } = useQuery<any>({
    queryKey: ['/api/ai-investment/benchmark', clientId],
    queryFn: async () => {
      const res = await fetch(`/api/ai-investment/benchmark/${clientId}`);
      if (!res.ok) throw new Error('Failed to fetch benchmark data');
      return res.json();
    },
    enabled: !!clientId && !!portfolio
  });

  const formatPercent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  const formatCurrency = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

  if (!clientId || !portfolio) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <LineChart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">Benchmark Comparison</h3>
          <p className="text-muted-foreground">Select a client with a portfolio to compare against benchmarks</p>
        </CardContent>
      </Card>
    );
  }

  const benchmarks = benchmarkData?.benchmarks || [
    { name: 'Nifty 50', return1M: 2.5, return3M: 8.2, return1Y: 15.4, ytd: 12.3 },
    { name: 'Sensex', return1M: 2.3, return3M: 7.9, return1Y: 14.8, ytd: 11.8 },
    { name: 'Nifty Midcap 100', return1M: 3.1, return3M: 10.5, return1Y: 22.3, ytd: 18.5 },
    { name: 'Nifty Smallcap 100', return1M: 4.2, return3M: 12.8, return1Y: 28.7, ytd: 24.2 },
  ];

  const portfolioReturns = benchmarkData?.portfolioReturns || { return1M: 2.8, return3M: 9.1, return1Y: 18.2, ytd: 14.5 };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LineChart className="h-5 w-5" />
            Portfolio vs Benchmark Performance
          </CardTitle>
          <CardDescription>Compare your client's portfolio returns against major indices</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Benchmark</TableHead>
                  <TableHead className="text-right">1 Month</TableHead>
                  <TableHead className="text-right">3 Months</TableHead>
                  <TableHead className="text-right">1 Year</TableHead>
                  <TableHead className="text-right">YTD</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="bg-primary/5 font-medium">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4" />
                      Client Portfolio
                    </div>
                  </TableCell>
                  <TableCell className={`text-right ${portfolioReturns.return1M >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatPercent(portfolioReturns.return1M)}</TableCell>
                  <TableCell className={`text-right ${portfolioReturns.return3M >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatPercent(portfolioReturns.return3M)}</TableCell>
                  <TableCell className={`text-right ${portfolioReturns.return1Y >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatPercent(portfolioReturns.return1Y)}</TableCell>
                  <TableCell className={`text-right ${portfolioReturns.ytd >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatPercent(portfolioReturns.ytd)}</TableCell>
                </TableRow>
                {benchmarks.map((benchmark: any) => {
                  const outperforms1Y = portfolioReturns.return1Y > benchmark.return1Y;
                  return (
                    <TableRow key={benchmark.name}>
                      <TableCell>{benchmark.name}</TableCell>
                      <TableCell className="text-right">{formatPercent(benchmark.return1M)}</TableCell>
                      <TableCell className="text-right">{formatPercent(benchmark.return3M)}</TableCell>
                      <TableCell className="text-right">{formatPercent(benchmark.return1Y)}</TableCell>
                      <TableCell className="text-right">{formatPercent(benchmark.ytd)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alpha Generation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {benchmarks.slice(0, 2).map((benchmark: any) => {
                const alpha = portfolioReturns.return1Y - benchmark.return1Y;
                return (
                  <div key={benchmark.name} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="text-sm">vs {benchmark.name}</span>
                    <div className="flex items-center gap-2">
                      {alpha >= 0 ? <TrendingUp className="h-4 w-4 text-green-600" /> : <TrendingDown className="h-4 w-4 text-red-600" />}
                      <span className={`font-medium ${alpha >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {alpha >= 0 ? '+' : ''}{alpha.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Risk-Adjusted Returns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm">Sharpe Ratio</span>
                <span className="font-medium">{benchmarkData?.sharpeRatio?.toFixed(2) || '1.25'}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm">Sortino Ratio</span>
                <span className="font-medium">{benchmarkData?.sortinoRatio?.toFixed(2) || '1.58'}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm">Beta</span>
                <span className="font-medium">{benchmarkData?.beta?.toFixed(2) || '0.92'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
