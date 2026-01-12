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
  ClipboardPaste,
  Table2,
  FileSpreadsheet,
  FileText as FileTextIcon
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
  id: number;
  uuid: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
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
  const [selectedHorizon, setSelectedHorizon] = useState<string>("3M");
  const [selectedProductTypes, setSelectedProductTypes] = useState<string[]>(["stocks", "mutual_funds", "bonds", "etfs"]);
  const [showAddHoldingDialog, setShowAddHoldingDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showPasteDialog, setShowPasteDialog] = useState(false);
  const [showCASUploadDialog, setShowCASUploadDialog] = useState(false);
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
    assetType: "EQUITY"
  });

  // Fetch clients for searchable dropdown
  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ['/api/agent/clients'],
  });

  // Filter clients based on search query (search by name or UUID)
  const filteredClients = useMemo(() => {
    if (!clientSearchQuery.trim()) return clients;
    const query = clientSearchQuery.toLowerCase();
    return clients.filter(client => {
      const fullName = `${client.firstName} ${client.lastName}`.toLowerCase();
      const uuid = client.uuid?.toLowerCase() || '';
      return fullName.includes(query) || uuid.includes(query);
    });
  }, [clients, clientSearchQuery]);

  // Get the selected client display name
  const selectedClient = useMemo(() => {
    return clients.find(c => c.uuid === selectedClientId || String(c.id) === selectedClientId);
  }, [clients, selectedClientId]);

  const { data: portfolio, isLoading: portfolioLoading } = useQuery<Portfolio>({
    queryKey: ['/api/ai-investment/portfolio', selectedClientId],
    enabled: !!selectedClientId
  });

  const { data: analysis, isLoading: analysisLoading, refetch: refetchAnalysis } = useQuery<PortfolioAnalysis>({
    queryKey: ['/api/ai-investment/analyze', selectedClientId],
    enabled: !!selectedClientId && !!portfolio
  });

  const { data: profitPicks, isLoading: picksLoading, refetch: refetchPicks } = useQuery<AIProfitPick[]>({
    queryKey: ['/api/ai-investment/profit-picks', selectedClientId, selectedHorizon, selectedProductTypes],
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
      setNewHolding({ symbol: "", name: "", quantity: 0, averagePrice: 0, assetType: "EQUITY" });
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
                    {selectedClient.firstName} {selectedClient.lastName}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Select client...</span>
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
                    {clientsLoading ? "Loading clients..." : "No clients found."}
                  </CommandEmpty>
                  <CommandGroup>
                    {filteredClients.map((client) => (
                      <CommandItem
                        key={client.id}
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
                        <div className="flex flex-col">
                          <span>{client.firstName} {client.lastName}</span>
                          <span className="text-xs text-muted-foreground truncate">
                            {client.uuid?.slice(0, 8)}...
                          </span>
                        </div>
                      </CommandItem>
                    ))}
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

            <Dialog open={showCASUploadDialog} onOpenChange={setShowCASUploadDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-import-cas">
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Import CAS/Statement
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Import Account Statement</DialogTitle>
                  <DialogDescription>
                    Upload your CAMS/KFintech CAS PDF or NSDL/CDSL Demat statement to automatically import your portfolio
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="cursor-pointer hover:border-primary transition-colors">
                      <CardContent className="p-4 text-center">
                        <FileTextIcon className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                        <h4 className="font-medium">CAMS/KFintech CAS</h4>
                        <p className="text-xs text-muted-foreground">Mutual Fund Statement</p>
                      </CardContent>
                    </Card>
                    <Card className="cursor-pointer hover:border-primary transition-colors">
                      <CardContent className="p-4 text-center">
                        <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 text-green-600" />
                        <h4 className="font-medium">NSDL/CDSL</h4>
                        <p className="text-xs text-muted-foreground">Demat Statement</p>
                      </CardContent>
                    </Card>
                  </div>
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Coming Soon</AlertTitle>
                    <AlertDescription>
                      PDF statement parsing is under development. For now, please use CSV upload or paste from Excel.
                    </AlertDescription>
                  </Alert>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCASUploadDialog(false)}>
                    Close
                  </Button>
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {portfolio.holdings.map((holding, idx) => (
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
                  Add portfolio holdings and run AI analysis to see insights
                </p>
                <Button onClick={handleRunAnalysis} disabled={!portfolio}>
                  <Brain className="h-4 w-4 mr-2" />
                  Run Analysis
                </Button>
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
                      const response = await apiRequest('/api/unified-advisory/recommendations', {
                        method: 'POST',
                        body: JSON.stringify({
                          clientId: selectedClientId,
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
      </Tabs>
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
                        {availableCas?.map((ca: any) => (
                          <SelectItem key={ca.user_id} value={ca.user_id}>
                            {ca.full_name} ({ca.membership_type})
                          </SelectItem>
                        ))}
                        {(!availableCas || availableCas.length === 0) && (
                          <SelectItem value="none" disabled>No CAs available</SelectItem>
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
