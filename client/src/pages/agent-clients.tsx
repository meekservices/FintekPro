import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Users, 
  UserPlus,
  Search,
  Filter,
  Eye,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Upload,
  FileText,
  BarChart3,
  TrendingUp,
  Wallet,
  Target,
  ArrowRight,
  Plus,
  ExternalLink,
  RefreshCw,
  Lock,
  Unlock,
  Send,
  AlertCircle,
  XCircle,
  ChevronRight
} from "lucide-react";

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  panNumber?: string;
  kycStatus: 'pending' | 'basic' | 'enhanced' | 'accredited';
  riskProfile?: string;
  clientCategory: 'retail' | 'hni' | 'shni' | 'bhni' | 'corporate';
  totalPortfolioValue?: number;
  lastActivityDate?: string;
  createdAt: string;
  assignedAgentId?: string;
  isActive: boolean;
}

interface PortfolioUpload {
  id: string;
  clientId: string;
  uploadType: string;
  fileName: string;
  parsingStatus: string;
  confirmationStatus: string;
  parsedSummary?: {
    totalValue: number;
    holdingsCount: number;
    assetBreakdown: Record<string, number>;
  };
  createdAt: string;
}

interface AdvisorySession {
  id: string;
  clientId: string;
  sessionPurpose: string;
  workflowState: string;
  createdAt: string;
  updatedAt: string;
}

const KYC_STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  basic: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  enhanced: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  accredited: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
};

const CLIENT_CATEGORY_LABELS: Record<string, string> = {
  retail: "Retail",
  hni: "HNI",
  shni: "Super HNI",
  bhni: "BHNI",
  corporate: "Corporate"
};

const WORKFLOW_STATE_LABELS: Record<string, string> = {
  purpose_selection: "Purpose Selection",
  suitability_check: "Suitability Check",
  optimization: "Optimization",
  draft_review: "Draft Review",
  client_sharing: "Shared with Client",
  client_action: "Awaiting Client Action",
  execution: "Execution",
  completed: "Completed",
  cancelled: "Cancelled"
};

export default function AgentClientsPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showPortfolioUploadDialog, setShowPortfolioUploadDialog] = useState(false);
  const [showStartSessionDialog, setShowStartSessionDialog] = useState(false);
  const [selectedSessionPurpose, setSelectedSessionPurpose] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const { data: clients, isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ['/api/agent/clients'],
  });

  const { data: pendingUploads } = useQuery<PortfolioUpload[]>({
    queryKey: ['/api/agent/portfolio-uploads/pending'],
    enabled: !!selectedClient,
  });

  const { data: clientSessions } = useQuery<AdvisorySession[]>({
    queryKey: ['/api/agent/advisory-sessions', selectedClient?.id],
    enabled: !!selectedClient,
  });

  const startAdvisorySession = useMutation({
    mutationFn: async (data: { clientId: string; sessionPurpose: string }) => {
      return apiRequest('/api/agent/advisory-sessions', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Advisory session started successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/agent/advisory-sessions'] });
      setShowStartSessionDialog(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to start advisory session", 
        variant: "destructive" 
      });
    }
  });

  const uploadPortfolio = useMutation({
    mutationFn: async (data: FormData) => {
      return apiRequest('/api/agent/portfolio-upload', {
        method: 'POST',
        body: data
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Portfolio uploaded. Client confirmation required." });
      queryClient.invalidateQueries({ queryKey: ['/api/agent/portfolio-uploads'] });
      setShowPortfolioUploadDialog(false);
      setUploadFile(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to upload portfolio", 
        variant: "destructive" 
      });
    }
  });

  const filteredClients = clients?.filter(client => {
    const matchesSearch = !searchQuery || 
      client.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.mobile?.includes(searchQuery) ||
      client.panNumber?.toLowerCase().includes(searchQuery.toLowerCase());

    if (activeTab === "all") return matchesSearch;
    if (activeTab === "pending_kyc") return matchesSearch && client.kycStatus === "pending";
    if (activeTab === "active") return matchesSearch && client.isActive && client.kycStatus !== "pending";
    if (activeTab === "hni") return matchesSearch && ["hni", "shni", "bhni"].includes(client.clientCategory);
    if (activeTab === "corporate") return matchesSearch && client.clientCategory === "corporate";
    return matchesSearch;
  }) || [];

  const handleStartSession = () => {
    if (!selectedClient || !selectedSessionPurpose) return;
    startAdvisorySession.mutate({
      clientId: selectedClient.id,
      sessionPurpose: selectedSessionPurpose
    });
  };

  const handlePortfolioUpload = () => {
    if (!selectedClient || !uploadFile) return;
    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('clientId', selectedClient.id);
    uploadPortfolio.mutate(formData);
  };

  const formatCurrency = (amount: number | undefined) => {
    if (!amount) return "₹0";
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (clientsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950">
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3"></div>
            <div className="text-lg">Loading clients...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950" data-testid="agent-clients-page">
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="h-8 w-8 text-primary" />
              Client Management
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage your clients, portfolios, and advisory sessions
            </p>
          </div>
          <Button className="bg-primary hover:bg-primary/90" data-testid="button-add-client">
            <UserPlus className="h-4 w-4 mr-2" />
            Onboard New Client
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{clients?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">KYC Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {clients?.filter(c => c.kycStatus === "pending").length || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">HNI+ Clients</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {clients?.filter(c => ["hni", "shni", "bhni"].includes(c.clientCategory)).length || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total AUM</CardTitle>
              <Wallet className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(clients?.reduce((sum, c) => sum + (c.totalPortfolioValue || 0), 0))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>My Clients</CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Search clients..." 
                        className="pl-10 w-64"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        data-testid="input-search-clients"
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <ScrollableTabsList>
                    <TabsTrigger value="all" data-testid="tab-all-clients">All ({clients?.length || 0})</TabsTrigger>
                    <TabsTrigger value="pending_kyc" data-testid="tab-pending-kyc">
                      Pending KYC ({clients?.filter(c => c.kycStatus === "pending").length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="active" data-testid="tab-active-clients">Active</TabsTrigger>
                    <TabsTrigger value="hni" data-testid="tab-hni-clients">HNI+</TabsTrigger>
                    <TabsTrigger value="corporate" data-testid="tab-corporate-clients">Corporate</TabsTrigger>
                  </ScrollableTabsList>

                  <TabsContent value={activeTab} className="mt-4">
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Client</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>KYC Status</TableHead>
                            <TableHead>Portfolio Value</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredClients.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                No clients found
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredClients.map((client) => (
                              <TableRow 
                                key={client.id} 
                                className={`cursor-pointer ${selectedClient?.id === client.id ? 'bg-muted' : ''}`}
                                onClick={() => setSelectedClient(client)}
                                data-testid={`row-client-${client.id}`}
                              >
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                      <span className="text-sm font-semibold text-primary">
                                        {client.firstName?.[0]}{client.lastName?.[0]}
                                      </span>
                                    </div>
                                    <div>
                                      <div className="font-medium">{client.firstName} {client.lastName}</div>
                                      <div className="text-sm text-muted-foreground">{client.email}</div>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">
                                    {CLIENT_CATEGORY_LABELS[client.clientCategory] || client.clientCategory}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge className={KYC_STATUS_COLORS[client.kycStatus]}>
                                    {client.kycStatus === "pending" && <Clock className="h-3 w-3 mr-1" />}
                                    {client.kycStatus === "basic" && <Shield className="h-3 w-3 mr-1" />}
                                    {client.kycStatus === "enhanced" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                                    {client.kycStatus === "accredited" && <Shield className="h-3 w-3 mr-1" />}
                                    {client.kycStatus.charAt(0).toUpperCase() + client.kycStatus.slice(1)}
                                  </Badge>
                                </TableCell>
                                <TableCell>{formatCurrency(client.totalPortfolioValue)}</TableCell>
                                <TableCell className="text-right">
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedClient(client);
                                    }}
                                    data-testid={`button-view-client-${client.id}`}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            {selectedClient ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Client Profile</span>
                      <Button variant="ghost" size="sm" data-testid="button-edit-client">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xl font-bold text-primary">
                          {selectedClient.firstName?.[0]}{selectedClient.lastName?.[0]}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">
                          {selectedClient.firstName} {selectedClient.lastName}
                        </h3>
                        <Badge className={KYC_STATUS_COLORS[selectedClient.kycStatus]}>
                          {selectedClient.kycStatus.toUpperCase()} KYC
                        </Badge>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedClient.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedClient.mobile}</span>
                      </div>
                      {selectedClient.panNumber && (
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span>PAN: {selectedClient.panNumber}</span>
                        </div>
                      )}
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Category</p>
                        <p className="font-medium">
                          {CLIENT_CATEGORY_LABELS[selectedClient.clientCategory]}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Risk Profile</p>
                        <p className="font-medium">{selectedClient.riskProfile || "Not Set"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Portfolio Value</p>
                        <p className="font-medium">{formatCurrency(selectedClient.totalPortfolioValue)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Last Activity</p>
                        <p className="font-medium text-sm">
                          {selectedClient.lastActivityDate 
                            ? new Date(selectedClient.lastActivityDate).toLocaleDateString()
                            : "N/A"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex gap-2">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => setShowPortfolioUploadDialog(true)}
                      data-testid="button-upload-portfolio"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Portfolio
                    </Button>
                    <Button 
                      className="flex-1"
                      onClick={() => setShowStartSessionDialog(true)}
                      disabled={selectedClient.kycStatus === "pending"}
                      data-testid="button-start-session"
                    >
                      <Target className="h-4 w-4 mr-2" />
                      Start Advisory
                    </Button>
                  </CardFooter>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Product Eligibility
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {selectedClient.kycStatus === "pending" ? (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>KYC required for all products</AlertDescription>
                        </Alert>
                      ) : (
                        <>
                          <div className="flex items-center justify-between">
                            <span>Mutual Funds</span>
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Bonds & FDs</span>
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Equity</span>
                            {selectedClient.kycStatus === "basic" ? (
                              <Lock className="h-4 w-4 text-yellow-500" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            <span>PMS/AIF</span>
                            {["enhanced", "accredited"].includes(selectedClient.kycStatus) && 
                             ["hni", "shni", "bhni"].includes(selectedClient.clientCategory) ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <Lock className="h-4 w-4 text-yellow-500" />
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Unlisted Shares</span>
                            {selectedClient.kycStatus === "accredited" ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <Lock className="h-4 w-4 text-yellow-500" />
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Active Sessions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {clientSessions && clientSessions.length > 0 ? (
                      <div className="space-y-2">
                        {clientSessions.map((session) => (
                          <div 
                            key={session.id} 
                            className="flex items-center justify-between p-2 border rounded-md hover:bg-muted cursor-pointer"
                            data-testid={`session-${session.id}`}
                          >
                            <div>
                              <p className="text-sm font-medium capitalize">
                                {session.sessionPurpose.replace(/_/g, ' ')}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {WORKFLOW_STATE_LABELS[session.workflowState]}
                              </p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No active advisory sessions
                      </p>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Select a client to view details</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showStartSessionDialog} onOpenChange={setShowStartSessionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Advisory Session</DialogTitle>
            <DialogDescription>
              Select the purpose for this advisory session. The system will guide you through the 
              suitability assessment and generate optimized recommendations.
            </DialogDescription>
          </DialogHeader>

          {selectedClient && selectedClient.kycStatus === "pending" && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>KYC Required</AlertTitle>
              <AlertDescription>
                Client must complete KYC before starting an advisory session.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div>
              <Label>Advisory Purpose</Label>
              <Select value={selectedSessionPurpose} onValueChange={setSelectedSessionPurpose}>
                <SelectTrigger data-testid="select-session-purpose">
                  <SelectValue placeholder="Select purpose..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fresh_investment">Fresh Investment</SelectItem>
                  <SelectItem value="rebalancing">Portfolio Rebalancing</SelectItem>
                  <SelectItem value="goal_review">Goal Review</SelectItem>
                  <SelectItem value="retirement_review">Retirement Planning Review</SelectItem>
                  {selectedClient?.clientCategory === "corporate" && (
                    <SelectItem value="corporate_treasury">Corporate Treasury</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <Alert>
              <Lock className="h-4 w-4" />
              <AlertTitle>Controlled Advisory</AlertTitle>
              <AlertDescription>
                Recommendations are generated by our AI system. You will be able to add 
                explanatory notes but cannot modify product allocations.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStartSessionDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleStartSession}
              disabled={!selectedSessionPurpose || startAdvisorySession.isPending}
              data-testid="button-confirm-start-session"
            >
              {startAdvisorySession.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4 mr-2" />
              )}
              Start Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPortfolioUploadDialog} onOpenChange={setShowPortfolioUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Client Portfolio</DialogTitle>
            <DialogDescription>
              Upload the client's existing portfolio for analysis. The client must confirm 
              the data before we can proceed with recommendations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <Input
                type="file"
                accept=".pdf,.xlsx,.xls,.csv"
                className="hidden"
                id="portfolio-file"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
              <Label htmlFor="portfolio-file" className="cursor-pointer">
                <span className="text-primary hover:underline">Click to upload</span>
                {' '}or drag and drop
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                PDF, Excel, or CSV files supported
              </p>
              {uploadFile && (
                <div className="mt-3 flex items-center justify-center gap-2 text-sm">
                  <FileText className="h-4 w-4" />
                  <span>{uploadFile.name}</span>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setUploadFile(null)}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            <Alert>
              <Send className="h-4 w-4" />
              <AlertTitle>Client Confirmation Required</AlertTitle>
              <AlertDescription>
                After upload, an OTP will be sent to the client's registered mobile/email 
                for confirmation. Portfolio analysis will only begin after client approval.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPortfolioUploadDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handlePortfolioUpload}
              disabled={!uploadFile || uploadPortfolio.isPending}
              data-testid="button-confirm-upload"
            >
              {uploadPortfolio.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Upload & Request Confirmation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
