import { useState } from "react";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { Link, useLocation } from "wouter";
import { 
  Plus,
  Users,
  UserPlus,
  TrendingUp,
  PieChart,
  Target,
  FileText,
  CheckCircle2,
  Clock,
  ArrowRight,
  AlertCircle,
  Upload,
  Loader2,
  Search,
  Eye,
  BarChart3,
  Briefcase,
  RefreshCw,
  MessageSquare,
  ThumbsUp,
  XCircle,
  Shield as LucideShield,
  Sparkles,
  Building2,
  Wallet,
  Info,
  ChevronRight,
  FileUp,
  Scale,
  Wand2,
  ChevronDown,
  FolderSearch,
  PlusCircle,
  Layers
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  portfolioFetchConsent: boolean;
  advisoryConsent: boolean;
  fetchedPortfolio?: any;
  uploadedPortfolio?: any;
  portfolioAnalysis?: any;
  unifiedPortfolio?: {
    portfolioId: string;
    source: string;
    sourceFileName?: string;
    isVerified: boolean;
    totalValue: number;
    holdingsCount: number;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface AcquisitionMetrics {
  period?: string;
  prospects: {
    total: number;
    onboarded: number;
    activeClients: number;
    converted: number;
  };
  proposals: {
    total: number;
    converted: number;
    conversionRate: number;
  };
  conversionRate: number;
  aumAcquired: number;
  aumFormatted: string;
}

const STATE_BADGES: Record<string, { label: string; color: string }> = {
  prospect: { label: "Prospect", color: "bg-muted text-muted-foreground" },
  onboarded: { label: "Onboarded", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  active_client: { label: "Active Client", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
};

const CLIENT_TYPE_OPTIONS = [
  { value: "individual", label: "Individual" },
  { value: "hni", label: "High Net Worth (HNI)" },
  { value: "ultra_hni", label: "Ultra HNI" },
  { value: "corporate", label: "Corporate" },
  { value: "nri", label: "NRI" },
  { value: "trust", label: "Trust/Family Office" },
];

const RISK_PROFILE_OPTIONS = [
  { value: "conservative", label: "Conservative" },
  { value: "moderate", label: "Moderate" },
  { value: "aggressive", label: "Aggressive" },
  { value: "very_aggressive", label: "Very Aggressive" },
];

export default function AgentClientAcquisitionPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("pipeline");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addDialogSuccess, setAddDialogSuccess] = useState(false);
  const [createdProspectId, setCreatedProspectId] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showAnalysisDialog, setShowAnalysisDialog] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<ProspectClient | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterState, setFilterState] = useState("all");
  
  const [newProspect, setNewProspect] = useState({
    name: "",
    email: "",
    mobile: "",
    pan: "",
    clientType: "individual",
    indicativeRiskProfile: "moderate",
  });

  const { data: prospectsData, isLoading } = useQuery<{ prospects: ProspectClient[]; stats: any }>({
    queryKey: ["/api/agent/prospect-clients", filterState],
  });

  const { data: metricsData } = useQuery<AcquisitionMetrics>({
    queryKey: ["/api/agent/acquisition-metrics"],
  });

  const prospects = prospectsData?.prospects || [];
  const stats = prospectsData?.stats || { total: 0, prospects: 0, onboarded: 0, activeClients: 0 };
  
  // Helper function to check if prospect has portfolio data (prefers unified tables)
  const hasPortfolioData = (prospect: ProspectClient) => {
    return prospect.unifiedPortfolio || prospect.fetchedPortfolio || prospect.uploadedPortfolio;
  };
  
  // Helper to get portfolio summary from unified or legacy data
  const getPortfolioSummary = (prospect: ProspectClient) => {
    if (prospect.unifiedPortfolio) {
      return {
        totalValue: prospect.unifiedPortfolio.totalValue,
        holdingsCount: prospect.unifiedPortfolio.holdingsCount,
        source: prospect.unifiedPortfolio.source,
        isVerified: prospect.unifiedPortfolio.isVerified
      };
    }
    const legacyPortfolio = prospect.fetchedPortfolio || prospect.uploadedPortfolio;
    return legacyPortfolio ? {
      totalValue: legacyPortfolio.totalValue || 0,
      holdingsCount: legacyPortfolio.holdings?.length || legacyPortfolio.parsedHoldings?.length || 0,
      source: legacyPortfolio.source || 'uploaded',
      isVerified: false
    } : null;
  };
  const prospectData = metricsData?.prospects || { total: 0, onboarded: 0, activeClients: 0, converted: 0 };
  const proposalData = metricsData?.proposals || { total: 0, converted: 0, conversionRate: 0 };
  const metrics = {
    prospects: prospectData.total ?? 0,
    onboarded: prospectData.onboarded ?? 0,
    activeClients: prospectData.activeClients ?? 0,
    total: prospectData.total ?? 0,
    conversionRate: metricsData?.conversionRate ?? 0,
    proposalStats: {
      total: proposalData.total ?? 0,
      draft: 0,
      shared: 0,
      viewed: 0,
      converted: proposalData.converted ?? 0,
      acceptanceRate: proposalData.conversionRate ?? 0,
    },
    aumAcquired: metricsData?.aumFormatted ?? "₹0",
  };

  const filteredProspects = prospects.filter(p => {
    const matchesSearch = p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.pan?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesState = filterState === "all" || p.state === filterState;
    return matchesSearch && matchesState;
  });

  const createProspectMutation = useMutation({
    mutationFn: async (data: typeof newProspect) => {
      const response = await apiRequest("/api/agent-wizard/prospects", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" }
      });
      return response;
    },
    onSuccess: (data: any) => {
      toast({ title: "Prospect Added", description: "New prospect has been added to your pipeline" });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/prospect-clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent-wizard/prospects"] });
      setCreatedProspectId(data?.prospectId || null);
      setAddDialogSuccess(true);
    },
    onError: (error: any) => {
      toast({ title: "Failed to Add Prospect", description: error.message, variant: "destructive" });
    }
  });

  const handleCloseAddDialog = () => {
    setShowAddDialog(false);
    setAddDialogSuccess(false);
    setCreatedProspectId(null);
    setNewProspect({ name: "", email: "", mobile: "", pan: "", clientType: "individual", indicativeRiskProfile: "moderate" });
  };

  const handleContinueToWizard = () => {
    if (createdProspectId) {
      navigate(`/agent-prospect-wizard?prospectId=${createdProspectId}`);
    }
    handleCloseAddDialog();
  };

  const handleAddAnother = () => {
    setAddDialogSuccess(false);
    setCreatedProspectId(null);
    setNewProspect({ name: "", email: "", mobile: "", pan: "", clientType: "individual", indicativeRiskProfile: "moderate" });
  };

  const updateStateMutation = useMutation({
    mutationFn: async ({ id, newState }: { id: string; newState: string }) => {
      return await apiRequest(`/api/agent/prospect-clients/${id}/state`, {
        method: "PATCH",
        body: JSON.stringify({ newState }),
        headers: { "Content-Type": "application/json" }
      });
    },
    onSuccess: () => {
      toast({ title: "State Updated", description: "Prospect state has been updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/prospect-clients"] });
    },
    onError: (error: any) => {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    }
  });

  const analyzePortfolioMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/agent/prospect-clients/${id}/analyze-portfolio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
    },
    onSuccess: (data) => {
      toast({ title: "Analysis Complete", description: "AI portfolio analysis is ready" });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/prospect-clients"] });
      if (selectedProspect) {
        setSelectedProspect({ ...selectedProspect, portfolioAnalysis: data.analysis });
      }
      setShowAnalysisDialog(true);
    },
    onError: (error: any) => {
      toast({ title: "Analysis Failed", description: error.message, variant: "destructive" });
    }
  });

  const fetchPortfolioMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/agent/prospect-clients/${id}/fetch-portfolio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
    },
    onSuccess: () => {
      toast({ title: "Portfolio Fetched", description: "Portfolio data retrieved from demat accounts" });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/prospect-clients"] });
    },
    onError: (error: any) => {
      toast({ title: "Fetch Failed", description: error.message, variant: "destructive" });
    }
  });

  const autoDetectClientType = (pan: string) => {
    if (!pan || pan.length < 4) return null;
    const entityChar = pan.charAt(3).toUpperCase();
    const entityMap: Record<string, string> = {
      'P': 'individual',
      'C': 'corporate',
      'H': 'trust',
      'F': 'corporate',
      'T': 'trust',
    };
    return entityMap[entityChar] || null;
  };

  const handlePanChange = (value: string) => {
    const upperValue = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    setNewProspect(prev => ({ ...prev, pan: upperValue }));
    
    if (upperValue.length === 10 && /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(upperValue)) {
      const detectedType = autoDetectClientType(upperValue);
      if (detectedType) {
        setNewProspect(prev => ({ ...prev, clientType: detectedType }));
      }
    }
  };

  const getNextState = (current: string): string | null => {
    if (current === 'prospect') return 'onboarded';
    if (current === 'onboarded') return 'active_client';
    return null;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Client Acquisition</h1>
          <p className="text-muted-foreground">Manage prospect pipeline and convert to active clients</p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default" className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700" data-testid="btn-smart-proposal">
                <Wand2 className="h-4 w-4 mr-2" />
                Create Smart Proposal
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>Choose Proposal Type</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="cursor-pointer py-3" 
                data-testid="menu-analyze-existing"
                onSelect={() => navigate("/agent-prospect-wizard")}
              >
                <FolderSearch className="h-4 w-4 mr-3 text-blue-600" />
                <div>
                  <p className="font-medium">Analyze Existing Portfolio</p>
                  <p className="text-xs text-muted-foreground">Import holdings & get AI rebalancing advice</p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="cursor-pointer py-3" 
                data-testid="menu-fresh-investment"
                onSelect={() => navigate("/agent-prospect-wizard?mode=fresh")}
              >
                <PlusCircle className="h-4 w-4 mr-3 text-green-600" />
                <div>
                  <p className="font-medium">Fresh Investment Proposal</p>
                  <p className="text-xs text-muted-foreground">AI recommendations for new investments</p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="cursor-pointer py-3" 
                data-testid="menu-combined"
                onSelect={() => navigate("/agent-prospect-wizard?mode=combined")}
              >
                <Layers className="h-4 w-4 mr-3 text-purple-600" />
                <div>
                  <p className="font-medium">Combined Proposal</p>
                  <p className="text-xs text-muted-foreground">Analyze existing + suggest fresh investments</p>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => setShowAddDialog(true)} data-testid="btn-add-prospect">
            <UserPlus className="h-4 w-4 mr-2" />
            Add Prospect
          </Button>
        </div>
      </div>

      <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
        <Info className="h-4 w-4" />
        <AlertTitle>Advisory Disclosure</AlertTitle>
        <AlertDescription>
          The analysis and proposals shared are advisory in nature. Final investment decisions are made by the client with your assistance as a licensed agent.
        </AlertDescription>
      </Alert>

      <Card className="border-2 border-dashed border-indigo-200 dark:border-indigo-800 bg-gradient-to-r from-slate-50 to-indigo-50 dark:from-background dark:to-indigo-950">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-5 w-5 text-indigo-600" />
            <h3 className="font-semibold text-sm">How to Create AI-Powered Proposals</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">1</div>
              <div>
                <p className="font-medium text-sm">Add Prospect</p>
                <p className="text-xs text-muted-foreground">Click "Add Prospect" with name & PAN</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">2</div>
              <div>
                <p className="font-medium text-sm">Import/Enter Portfolio</p>
                <p className="text-xs text-muted-foreground">Fetch via PAN or manually add holdings</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">3</div>
              <div>
                <p className="font-medium text-sm">AI Analysis</p>
                <p className="text-xs text-muted-foreground">Get asset allocation, risk & gap analysis</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">4</div>
              <div>
                <p className="font-medium text-sm">Generate Proposal</p>
                <p className="text-xs text-muted-foreground">Share PDF with rebalancing + fresh ideas</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Prospects</p>
                <p className="text-2xl font-bold">{metrics.prospects}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Onboarded</p>
                <p className="text-2xl font-bold">{metrics.onboarded}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Clients</p>
                <p className="text-2xl font-bold">{metrics.activeClients}</p>
              </div>
              <ThumbsUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Conversion Rate</p>
                <p className="text-2xl font-bold">{metrics.conversionRate.toFixed(1)}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">AUM Acquired</p>
                <p className="text-2xl font-bold">{metrics.aumAcquired}</p>
              </div>
              <Wallet className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <ScrollableTabsList>
          <TabsTrigger value="pipeline" className="flex items-center gap-1" data-testid="tab-pipeline">
            <Users className="h-4 w-4" />
            <span>Pipeline</span>
          </TabsTrigger>
          <TabsTrigger value="analysis" className="flex items-center gap-1" data-testid="tab-analysis">
            <BarChart3 className="h-4 w-4" />
            <span>Portfolio Analysis</span>
          </TabsTrigger>
          <TabsTrigger value="metrics" className="flex items-center gap-1" data-testid="tab-metrics">
            <Target className="h-4 w-4" />
            <span>Acquisition Metrics</span>
          </TabsTrigger>
        </ScrollableTabsList>

        <TabsContent value="pipeline" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row gap-4 justify-between">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, or PAN..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="input-search-prospects"
                  />
                </div>
                <Select value={filterState} onValueChange={setFilterState}>
                  <SelectTrigger className="w-[180px]" data-testid="select-filter-state">
                    <SelectValue placeholder="Filter by state" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All States</SelectItem>
                    <SelectItem value="prospect">Prospects</SelectItem>
                    <SelectItem value="onboarded">Onboarded</SelectItem>
                    <SelectItem value="active_client">Active Clients</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredProspects.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No prospects found</p>
                  <Button variant="outline" className="mt-4" onClick={() => setShowAddDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Prospect
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>PAN</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Portfolio</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProspects.map((prospect) => (
                      <TableRow key={prospect.id} data-testid={`row-prospect-${prospect.id}`}>
                        <TableCell className="font-medium">{prospect.name}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {prospect.email && <div>{prospect.email}</div>}
                            {prospect.mobile && <div className="text-muted-foreground">{prospect.mobile}</div>}
                          </div>
                        </TableCell>
                        <TableCell>{prospect.pan || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {CLIENT_TYPE_OPTIONS.find(c => c.value === prospect.clientType)?.label || prospect.clientType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={STATE_BADGES[prospect.state]?.color || ""}>
                            {STATE_BADGES[prospect.state]?.label || prospect.state}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {hasPortfolioData(prospect) ? (
                            <Badge variant="outline" className={prospect.unifiedPortfolio?.isVerified ? "text-blue-600" : "text-green-600"}>
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              {prospect.unifiedPortfolio?.isVerified ? 'Verified' : 'Available'}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              <Clock className="h-3 w-3 mr-1" />
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedProspect(prospect);
                                setShowDetailDialog(true);
                              }}
                              data-testid={`btn-view-${prospect.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {prospect.pan && !hasPortfolioData(prospect) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => fetchPortfolioMutation.mutate(prospect.id)}
                                disabled={fetchPortfolioMutation.isPending}
                                data-testid={`btn-fetch-${prospect.id}`}
                              >
                                <RefreshCw className={`h-4 w-4 ${fetchPortfolioMutation.isPending ? 'animate-spin' : ''}`} />
                              </Button>
                            )}
                            {hasPortfolioData(prospect) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedProspect(prospect);
                                  analyzePortfolioMutation.mutate(prospect.id);
                                }}
                                disabled={analyzePortfolioMutation.isPending}
                                data-testid={`btn-analyze-${prospect.id}`}
                              >
                                <Sparkles className={`h-4 w-4 ${analyzePortfolioMutation.isPending ? 'animate-spin' : ''}`} />
                              </Button>
                            )}
                            {getNextState(prospect.state) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateStateMutation.mutate({ id: prospect.id, newState: getNextState(prospect.state)! })}
                                disabled={updateStateMutation.isPending}
                                data-testid={`btn-advance-${prospect.id}`}
                              >
                                <ChevronRight className="h-4 w-4 mr-1" />
                                {getNextState(prospect.state) === 'onboarded' ? 'Onboard' : 'Activate'}
                              </Button>
                            )}
                            <Link href={`/agent/proposals?prospect=${prospect.id}`}>
                              <Button variant="outline" size="sm" data-testid={`btn-proposal-${prospect.id}`}>
                                <FileText className="h-4 w-4 mr-1" />
                                Proposal
                              </Button>
                            </Link>
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

        <TabsContent value="analysis" className="space-y-4">
          <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950 dark:to-purple-950 border-indigo-200 dark:border-indigo-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-indigo-600" />
                AI Portfolio Analysis & Proposal Wizard
              </CardTitle>
              <CardDescription>
                Choose your workflow to create personalized investment proposals for prospects
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card 
                  className="cursor-pointer hover:shadow-lg transition-all hover:border-blue-400 group h-full"
                  onClick={() => navigate("/agent-prospect-wizard")}
                  data-testid="card-analyze-existing"
                >
                  <CardHeader className="pb-2">
                    <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                      <FolderSearch className="h-6 w-6 text-blue-600" />
                    </div>
                    <CardTitle className="text-base">Analyze Existing Portfolio</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Import client's current holdings and get AI-powered rebalancing recommendations
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" /> Manual entry or bulk import</li>
                      <li className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" /> Asset allocation analysis</li>
                      <li className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" /> Risk assessment & gaps</li>
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button variant="ghost" className="w-full group-hover:bg-blue-50 dark:group-hover:bg-blue-900">
                      Start Analysis <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </CardFooter>
                </Card>

                <Card 
                  className="cursor-pointer hover:shadow-lg transition-all hover:border-green-400 group h-full"
                  onClick={() => navigate("/agent-prospect-wizard?mode=fresh")}
                  data-testid="card-fresh-investment"
                >
                  <CardHeader className="pb-2">
                    <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                      <PlusCircle className="h-6 w-6 text-green-600" />
                    </div>
                    <CardTitle className="text-base">Fresh Investment Proposal</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Create AI-powered investment recommendations for new capital deployment
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" /> Risk profiling</li>
                      <li className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" /> Goal-based recommendations</li>
                      <li className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" /> Diversified allocation</li>
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button variant="ghost" className="w-full group-hover:bg-green-50 dark:group-hover:bg-green-900">
                      Create Proposal <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </CardFooter>
                </Card>

                <Card 
                  className="cursor-pointer hover:shadow-lg transition-all hover:border-purple-400 group h-full"
                  onClick={() => navigate("/agent-prospect-wizard?mode=combined")}
                  data-testid="card-combined"
                >
                  <CardHeader className="pb-2">
                    <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                      <Layers className="h-6 w-6 text-purple-600" />
                    </div>
                    <CardTitle className="text-base">Combined Proposal</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Full analysis: rebalance existing + recommend new investments together
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" /> Portfolio optimization</li>
                      <li className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" /> Fresh investment suggestions</li>
                      <li className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" /> Consolidated proposal PDF</li>
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button variant="ghost" className="w-full group-hover:bg-purple-50 dark:group-hover:bg-purple-900">
                      Full Proposal <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Prospects with Portfolio Data</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Portfolio Value</TableHead>
                    <TableHead>Holdings</TableHead>
                    <TableHead>Analysis Status</TableHead>
                    <TableHead>Overall Score</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProspects
                    .filter(p => hasPortfolioData(p))
                    .map((prospect) => {
                      const portfolioSummary = getPortfolioSummary(prospect);
                      const analysis = prospect.portfolioAnalysis;
                      return (
                        <TableRow key={prospect.id}>
                          <TableCell className="font-medium">{prospect.name}</TableCell>
                          <TableCell>
                            ₹{(portfolioSummary?.totalValue || 0).toLocaleString('en-IN')}
                          </TableCell>
                          <TableCell>
                            {portfolioSummary?.holdingsCount || 0} holdings
                          </TableCell>
                          <TableCell>
                            {analysis ? (
                              <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Analyzed
                              </Badge>
                            ) : (
                              <Badge variant="outline">Pending</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {analysis?.overallScore ? (
                              <div className="flex items-center gap-2">
                                <Progress value={analysis.overallScore} className="w-16 h-2" />
                                <span className="text-sm">{analysis.overallScore}/100</span>
                              </div>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedProspect(prospect);
                                if (analysis) {
                                  setShowAnalysisDialog(true);
                                } else {
                                  analyzePortfolioMutation.mutate(prospect.id);
                                }
                              }}
                              disabled={analyzePortfolioMutation.isPending}
                            >
                              {analysis ? (
                                <>
                                  <Eye className="h-4 w-4 mr-1" />
                                  View
                                </>
                              ) : (
                                <>
                                  <Sparkles className="h-4 w-4 mr-1" />
                                  Analyze
                                </>
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
              {filteredProspects.filter(p => hasPortfolioData(p)).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <FileUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No prospects with portfolio data yet</p>
                  <p className="text-sm">Fetch or upload portfolio for a prospect to enable analysis</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Acquisition Funnel</CardTitle>
                <CardDescription>Track prospects through your pipeline</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span>Prospects</span>
                    <span className="font-bold">{metrics.prospects}</span>
                  </div>
                  <Progress value={100} className="h-3 bg-muted" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span>Onboarded</span>
                    <span className="font-bold">{metrics.onboarded}</span>
                  </div>
                  <Progress 
                    value={metrics.total > 0 ? (metrics.onboarded / metrics.total) * 100 : 0} 
                    className="h-3 bg-muted" 
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span>Active Clients</span>
                    <span className="font-bold">{metrics.activeClients}</span>
                  </div>
                  <Progress 
                    value={metrics.total > 0 ? (metrics.activeClients / metrics.total) * 100 : 0} 
                    className="h-3 bg-muted" 
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Proposal Performance</CardTitle>
                <CardDescription>Track proposal success rates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{metrics.proposalStats.total}</p>
                    <p className="text-sm text-muted-foreground">Total Proposals</p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{metrics.proposalStats.converted}</p>
                    <p className="text-sm text-muted-foreground">Converted</p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{metrics.proposalStats.viewed}</p>
                    <p className="text-sm text-muted-foreground">Viewed</p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{metrics.proposalStats.acceptanceRate.toFixed(1)}%</p>
                    <p className="text-sm text-muted-foreground">Acceptance Rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Key Performance Indicators</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="h-20 w-20 mx-auto rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mb-2">
                    <TrendingUp className="h-10 w-10 text-blue-600" />
                  </div>
                  <p className="text-2xl font-bold">{metrics.conversionRate.toFixed(1)}%</p>
                  <p className="text-sm text-muted-foreground">Prospect → Client</p>
                </div>
                <div className="text-center">
                  <div className="h-20 w-20 mx-auto rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mb-2">
                    <Wallet className="h-10 w-10 text-green-600" />
                  </div>
                  <p className="text-2xl font-bold">{metrics.aumAcquired}</p>
                  <p className="text-sm text-muted-foreground">AUM Acquired</p>
                </div>
                <div className="text-center">
                  <div className="h-20 w-20 mx-auto rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center mb-2">
                    <FileText className="h-10 w-10 text-purple-600" />
                  </div>
                  <p className="text-2xl font-bold">{metrics.proposalStats.acceptanceRate.toFixed(1)}%</p>
                  <p className="text-sm text-muted-foreground">Proposal Acceptance</p>
                </div>
                <div className="text-center">
                  <div className="h-20 w-20 mx-auto rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center mb-2">
                    <LucideShield className="h-10 w-10 text-amber-600" />
                  </div>
                  <p className="text-2xl font-bold">0</p>
                  <p className="text-sm text-muted-foreground">Compliance Flags</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showAddDialog} onOpenChange={handleCloseAddDialog}>
        <DialogContent className="max-w-md">
          {addDialogSuccess ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Prospect Added Successfully
                </DialogTitle>
                <DialogDescription>
                  {newProspect.name} has been added to your pipeline. What would you like to do next?
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <p className="font-medium">{newProspect.name}</p>
                  <div className="text-sm text-muted-foreground space-y-1">
                    {newProspect.email && <p>{newProspect.email}</p>}
                    {newProspect.mobile && <p>{newProspect.mobile}</p>}
                    {newProspect.pan && <p>PAN: {newProspect.pan}</p>}
                  </div>
                </div>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={handleAddAnother} data-testid="btn-add-another">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Another
                </Button>
                <Button onClick={handleContinueToWizard} data-testid="btn-continue-wizard">
                  Continue to Wizard
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Add New Prospect</DialogTitle>
                <DialogDescription>
                  Enter prospect details to start the acquisition journey
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={newProspect.name}
                    onChange={(e) => setNewProspect(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Full name"
                    data-testid="input-prospect-name"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newProspect.email}
                    onChange={(e) => setNewProspect(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="email@example.com"
                    data-testid="input-prospect-email"
                  />
                </div>
                <div>
                  <Label htmlFor="mobile">Mobile</Label>
                  <Input
                    id="mobile"
                    value={newProspect.mobile}
                    onChange={(e) => setNewProspect(prev => ({ ...prev, mobile: e.target.value }))}
                    placeholder="+91 9876543210"
                    data-testid="input-prospect-mobile"
                  />
                </div>
                <div>
                  <Label htmlFor="pan">PAN (for portfolio fetch)</Label>
                  <Input
                    id="pan"
                    value={newProspect.pan}
                    onChange={(e) => handlePanChange(e.target.value)}
                    placeholder="ABCDE1234F"
                    maxLength={10}
                    data-testid="input-prospect-pan"
                  />
                </div>
                <div>
                  <Label htmlFor="clientType">Client Type</Label>
                  <Select
                    value={newProspect.clientType}
                    onValueChange={(value) => setNewProspect(prev => ({ ...prev, clientType: value }))}
                  >
                    <SelectTrigger data-testid="select-client-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CLIENT_TYPE_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="risk">Indicative Risk Profile</Label>
                  <Select
                    value={newProspect.indicativeRiskProfile}
                    onValueChange={(value) => setNewProspect(prev => ({ ...prev, indicativeRiskProfile: value }))}
                  >
                    <SelectTrigger data-testid="select-risk-profile">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RISK_PROFILE_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCloseAddDialog}>
                  Cancel
                </Button>
                <Button
                  onClick={() => createProspectMutation.mutate(newProspect)}
                  disabled={!newProspect.name || createProspectMutation.isPending}
                  data-testid="btn-submit-prospect"
                >
                  {createProspectMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Add Prospect
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedProspect?.name}</DialogTitle>
            <DialogDescription>
              Prospect details and portfolio information
            </DialogDescription>
          </DialogHeader>
          {selectedProspect && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">State</Label>
                  <div className="mt-1">
                    <Badge className={STATE_BADGES[selectedProspect.state]?.color}>
                      {STATE_BADGES[selectedProspect.state]?.label}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Client Type</Label>
                  <p className="mt-1 font-medium">
                    {CLIENT_TYPE_OPTIONS.find(c => c.value === selectedProspect.clientType)?.label}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p className="mt-1">{selectedProspect.email || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Mobile</Label>
                  <p className="mt-1">{selectedProspect.mobile || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">PAN</Label>
                  <p className="mt-1">{selectedProspect.pan || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Risk Profile</Label>
                  <p className="mt-1 capitalize">{selectedProspect.indicativeRiskProfile || "-"}</p>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2">Portfolio Data</h4>
                {hasPortfolioData(selectedProspect) ? (
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span>Total Value</span>
                      <span className="font-bold">
                        ₹{(getPortfolioSummary(selectedProspect)?.totalValue || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <span>Holdings</span>
                      <span>
                        {getPortfolioSummary(selectedProspect)?.holdingsCount || 0} items
                      </span>
                    </div>
                    {selectedProspect.unifiedPortfolio && (
                      <div className="flex justify-between items-center">
                        <span>Status</span>
                        <Badge variant="outline" className={selectedProspect.unifiedPortfolio.isVerified ? "text-blue-600" : "text-amber-600"}>
                          {selectedProspect.unifiedPortfolio.isVerified ? 'Verified' : 'Unverified'}
                        </Badge>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 border border-dashed rounded-lg text-center text-muted-foreground">
                    <p>No portfolio data available</p>
                    {selectedProspect.pan && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => fetchPortfolioMutation.mutate(selectedProspect.id)}
                        disabled={fetchPortfolioMutation.isPending}
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${fetchPortfolioMutation.isPending ? 'animate-spin' : ''}`} />
                        Fetch Portfolio
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-2 justify-end">
                {getNextState(selectedProspect.state) && (
                  <Button
                    onClick={() => {
                      updateStateMutation.mutate({ id: selectedProspect.id, newState: getNextState(selectedProspect.state)! });
                      setShowDetailDialog(false);
                    }}
                  >
                    <ChevronRight className="h-4 w-4 mr-1" />
                    Advance to {getNextState(selectedProspect.state) === 'onboarded' ? 'Onboarded' : 'Active Client'}
                  </Button>
                )}
                <Link href={`/agent/proposals?prospect=${selectedProspect.id}`}>
                  <Button variant="outline">
                    <FileText className="h-4 w-4 mr-1" />
                    Create Proposal
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showAnalysisDialog} onOpenChange={setShowAnalysisDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Portfolio Analysis - {selectedProspect?.name}</DialogTitle>
            <DialogDescription>
              AI-generated insights and recommendations (Informational Only)
            </DialogDescription>
          </DialogHeader>
          {selectedProspect?.portfolioAnalysis ? (
            <div className="space-y-6">
              <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  This analysis is for informational purposes only. No buy/sell actions at this stage.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Overall Score</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <Progress value={selectedProspect.portfolioAnalysis.overallScore} className="flex-1" />
                      <span className="text-2xl font-bold">{selectedProspect.portfolioAnalysis.overallScore}/100</span>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Risk Score</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <Progress value={selectedProspect.portfolioAnalysis.riskScore} className="flex-1" />
                      <span className="text-2xl font-bold">{selectedProspect.portfolioAnalysis.riskScore}/100</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Asset Allocation</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(selectedProspect.portfolioAnalysis.assetAllocationBreakdown || {}).map(([asset, data]: [string, any]) => (
                      <div key={asset} className="p-3 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground capitalize">{asset.replace(/_/g, ' ')}</p>
                        <p className="text-lg font-bold">{data.percentage.toFixed(1)}%</p>
                        <p className="text-xs text-muted-foreground">₹{data.value.toLocaleString('en-IN')}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {selectedProspect.portfolioAnalysis.concentrationRisk?.alerts?.length > 0 && (
                <Card className="border-amber-200 dark:border-amber-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                      Concentration Risk Alerts
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {selectedProspect.portfolioAnalysis.concentrationRisk.alerts.map((alert: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                          {alert}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {selectedProspect.portfolioAnalysis.missingAssetClasses?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Missing Asset Classes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {selectedProspect.portfolioAnalysis.missingAssetClasses.map((asset: string) => (
                        <Badge key={asset} variant="outline" className="capitalize">
                          {asset.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {selectedProspect.portfolioAnalysis.gapAnalysis?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Gap Analysis & Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {selectedProspect.portfolioAnalysis.gapAnalysis.map((gap: any, i: number) => (
                        <div key={i} className="p-3 border rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <span className="font-medium">{gap.gap}</span>
                            <Badge
                              variant={gap.severity === 'high' ? 'destructive' : gap.severity === 'medium' ? 'outline' : 'secondary'}
                            >
                              {gap.severity}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{gap.recommendation}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAnalysisDialog(false)}>
                  Close
                </Button>
                <Link href={`/agent/proposals?prospect=${selectedProspect.id}`}>
                  <Button>
                    <FileText className="h-4 w-4 mr-2" />
                    Create Proposal Based on Analysis
                  </Button>
                </Link>
              </DialogFooter>
            </div>
          ) : (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>Generating analysis...</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
