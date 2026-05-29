import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown, Plus, Briefcase, PieChart, BarChart3, FileText, CheckCircle, Clock, XCircle, AlertTriangle, Search, Pencil, Trash2, Layers, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

interface AifHolding {
  id: string;
  clientId: string;
  aifId?: string;
  aifName: string;
  registrationNo?: string;
  category?: string;
  subcategory?: string;
  commitmentAmount: string;
  capitalCalled: string;
  capitalUncalled?: string;
  investedDate: string;
  lockinEndDate?: string;
  currentUnits?: string;
  entryNav?: string;
  latestNav?: string;
  lastNavDate?: string;
  currentValue?: string;
  unrealizedGainLoss?: string;
  unrealizedGainLossPercent?: string;
  distributionsReceived?: string;
  entryStatus: string;
  notes?: string;
  createdAt: string;
}

interface PmsHolding {
  id: string;
  clientId: string;
  pmsId?: string;
  pmsName: string;
  registrationNo?: string;
  strategy?: string;
  investedAmount: string;
  additionalInfusions?: string;
  totalInvested?: string;
  startDate: string;
  corpusValue?: string;
  latestNav?: string;
  currentValue?: string;
  unrealizedGainLoss?: string;
  unrealizedGainLossPercent?: string;
  cagr?: string;
  entryStatus: string;
  notes?: string;
  createdAt: string;
}

interface PortfolioSummary {
  totalCurrentValue: number;
  totalInvested: number;
  totalCommitment?: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  holdings: number;
}

const formatCurrency = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "—";
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  return `₹${num.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
};

const StatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case "approved":
      return <Badge variant="default" className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" /> Approved</Badge>;
    case "pending":
      return <Badge variant="secondary" className="bg-yellow-500 text-white"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
    case "rejected":
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>;
    case "needs_review":
      return <Badge variant="outline" className="border-orange-500 text-orange-500"><AlertTriangle className="w-3 h-3 mr-1" /> Needs Review</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const GainLossIndicator = ({ value, percent }: { value?: string | number; percent?: string | number }) => {
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  const numPercent = typeof percent === "string" ? parseFloat(percent) : percent;
  
  if (numValue === undefined || numValue === null || isNaN(numValue)) return <span>—</span>;
  
  const isPositive = numValue >= 0;
  return (
    <span className={`flex items-center gap-1 ${isPositive ? "text-green-600" : "text-red-600"}`}>
      {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
      {formatCurrency(Math.abs(numValue))}
      {numPercent !== undefined && !isNaN(numPercent) && (
        <span className="text-xs">({numPercent > 0 ? "+" : ""}{numPercent.toFixed(2)}%)</span>
      )}
    </span>
  );
};

export default function AlternativeInvestmentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("aif");
  const [showAddAifDialog, setShowAddAifDialog] = useState(false);
  const [showAddPmsDialog, setShowAddPmsDialog] = useState(false);
  const [aifSearch, setAifSearch] = useState("");
  const [pmsSearch, setPmsSearch] = useState("");

  // AIF Form State
  const [aifForm, setAifForm] = useState({
    aifName: "",
    registrationNo: "",
    category: "Category II",
    subcategory: "",
    commitmentAmount: "",
    capitalCalled: "",
    investedDate: "",
    lockinEndDate: "",
    currentUnits: "",
    entryNav: "",
    latestNav: "",
    currentValue: "",
    notes: "",
  });

  // PMS Form State
  const [pmsForm, setPmsForm] = useState({
    pmsName: "",
    registrationNo: "",
    strategy: "",
    investedAmount: "",
    additionalInfusions: "0",
    startDate: "",
    corpusValue: "",
    latestNav: "",
    notes: "",
  });

  // Fetch AIF Holdings
  const { data: aifData, isLoading: aifLoading } = useQuery<{ holdings: AifHolding[]; summary: PortfolioSummary }>({
    queryKey: ["/api/store/portfolio/aif"],
    enabled: !!user,
  });

  // Fetch PMS Holdings
  const { data: pmsData, isLoading: pmsLoading } = useQuery<{ holdings: PmsHolding[]; summary: PortfolioSummary }>({
    queryKey: ["/api/store/portfolio/pms"],
    enabled: !!user,
  });

  // AIF Search for autocomplete
  const { data: aifSearchResults } = useQuery({
    queryKey: ["/api/store/aif", { search: aifSearch }],
    enabled: aifSearch.length >= 2,
  });

  // PMS Search for autocomplete
  const { data: pmsSearchResults } = useQuery({
    queryKey: ["/api/store/pms", { search: pmsSearch }],
    enabled: pmsSearch.length >= 2,
  });

  // Add AIF Mutation
  const addAifMutation = useMutation({
    mutationFn: async (data: typeof aifForm) => {
      return apiRequest("/api/store/portfolio/aif", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({ title: "AIF Investment Added", description: "Your AIF investment has been submitted for approval." });
      queryClient.invalidateQueries({ queryKey: ["/api/store/portfolio/aif"] });
      setShowAddAifDialog(false);
      setAifForm({
        aifName: "", registrationNo: "", category: "Category II", subcategory: "",
        commitmentAmount: "", capitalCalled: "", investedDate: "", lockinEndDate: "",
        currentUnits: "", entryNav: "", latestNav: "", currentValue: "", notes: "",
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add AIF investment", variant: "destructive" });
    },
  });

  // Add PMS Mutation
  const addPmsMutation = useMutation({
    mutationFn: async (data: typeof pmsForm) => {
      return apiRequest("/api/store/portfolio/pms", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({ title: "PMS Investment Added", description: "Your PMS investment has been submitted for approval." });
      queryClient.invalidateQueries({ queryKey: ["/api/store/portfolio/pms"] });
      setShowAddPmsDialog(false);
      setPmsForm({
        pmsName: "", registrationNo: "", strategy: "",
        investedAmount: "", additionalInfusions: "0", startDate: "",
        corpusValue: "", latestNav: "", notes: "",
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add PMS investment", variant: "destructive" });
    },
  });

  // Delete AIF Mutation
  const deleteAifMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/store/portfolio/aif/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "AIF investment removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/store/portfolio/aif"] });
    },
  });

  // Delete PMS Mutation
  const deletePmsMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/store/portfolio/pms/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "PMS investment removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/store/portfolio/pms"] });
    },
  });

  const handleAddAif = () => {
    if (!aifForm.aifName || !aifForm.commitmentAmount || !aifForm.capitalCalled || !aifForm.investedDate) {
      toast({ title: "Missing Fields", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    addAifMutation.mutate(aifForm);
  };

  const handleAddPms = () => {
    if (!pmsForm.pmsName || !pmsForm.investedAmount || !pmsForm.startDate) {
      toast({ title: "Missing Fields", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    addPmsMutation.mutate(pmsForm);
  };

  const aifHoldings: AifHolding[] = aifData?.holdings || [];
  const aifSummary: PortfolioSummary = aifData?.summary || { totalCurrentValue: 0, totalInvested: 0, totalCommitment: 0, totalGainLoss: 0, totalGainLossPercent: 0, holdings: 0 };
  
  const pmsHoldings: PmsHolding[] = pmsData?.holdings || [];
  const pmsSummary: PortfolioSummary = pmsData?.summary || { totalCurrentValue: 0, totalInvested: 0, totalGainLoss: 0, totalGainLossPercent: 0, holdings: 0 };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Alternative Investments</h1>
          <p className="text-muted-foreground">Track your AIF and PMS investments in one place</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowAddAifDialog(true)} data-testid="button-add-aif">
            <Plus className="w-4 h-4 mr-2" /> Add AIF
          </Button>
          <Button onClick={() => setShowAddPmsDialog(true)} variant="outline" data-testid="button-add-pms">
            <Plus className="w-4 h-4 mr-2" /> Add PMS
          </Button>
        </div>
      </div>

      {/* Combined Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Briefcase className="w-4 h-4" />
              <span className="text-sm">Total Holdings</span>
            </div>
            <p className="text-2xl font-bold">{aifSummary.holdings + pmsSummary.holdings}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <PieChart className="w-4 h-4" />
              <span className="text-sm">Total Invested</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(aifSummary.totalInvested + pmsSummary.totalInvested)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <BarChart3 className="w-4 h-4" />
              <span className="text-sm">Current Value</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(aifSummary.totalCurrentValue + pmsSummary.totalCurrentValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              {(aifSummary.totalGainLoss + pmsSummary.totalGainLoss) >= 0 ? <TrendingUp className="w-4 h-4 text-green-600" /> : <TrendingDown className="w-4 h-4 text-red-600" />}
              <span className="text-sm">Total Gain/Loss</span>
            </div>
            <GainLossIndicator 
              value={aifSummary.totalGainLoss + pmsSummary.totalGainLoss} 
              percent={(aifSummary.totalInvested + pmsSummary.totalInvested) > 0 
                ? ((aifSummary.totalGainLoss + pmsSummary.totalGainLoss) / (aifSummary.totalInvested + pmsSummary.totalInvested)) * 100 
                : 0}
            />
          </CardContent>
        </Card>
      </div>

      {/* Tabs for AIF and PMS */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <ScrollableTabsList>
          <TabsTrigger value="aif" data-testid="tab-aif">
            <Briefcase className="w-4 h-4 mr-2" /> AIF ({aifSummary.holdings})
          </TabsTrigger>
          <TabsTrigger value="pms" data-testid="tab-pms">
            <PieChart className="w-4 h-4 mr-2" /> PMS ({pmsSummary.holdings})
          </TabsTrigger>
          <TabsTrigger value="mld" data-testid="tab-mld">
            <Layers className="w-4 h-4 mr-2" /> MLD
          </TabsTrigger>
        </ScrollableTabsList>

        {/* AIF Tab Content */}
        <TabsContent value="aif" className="mt-4">
          {aifLoading ? (
            <Card><CardContent className="py-8"><Skeleton className="h-40 w-full" /></CardContent></Card>
          ) : aifHoldings.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Briefcase className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No AIF Investments Yet</h3>
                <p className="text-muted-foreground mb-4">Add your existing AIF investments to track them here</p>
                <Button onClick={() => setShowAddAifDialog(true)} data-testid="button-add-first-aif">
                  <Plus className="w-4 h-4 mr-2" /> Add Your First AIF
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* AIF Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <Card className="bg-blue-50 dark:bg-blue-950">
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Total Commitment</p>
                    <p className="text-xl font-bold">{formatCurrency(aifSummary.totalCommitment)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-green-50 dark:bg-green-950">
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Capital Called</p>
                    <p className="text-xl font-bold">{formatCurrency(aifSummary.totalInvested)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-purple-50 dark:bg-purple-950">
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Uncalled Capital</p>
                    <p className="text-xl font-bold">{formatCurrency((aifSummary.totalCommitment || 0) - aifSummary.totalInvested)}</p>
                  </CardContent>
                </Card>
              </div>
              
              {/* AIF Holdings Table */}
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fund Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Commitment</TableHead>
                        <TableHead className="text-right">Called</TableHead>
                        <TableHead className="text-right">Current Value</TableHead>
                        <TableHead className="text-right">Gain/Loss</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aifHoldings.map((holding) => (
                        <TableRow key={holding.id} data-testid={`row-aif-${holding.id}`}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{holding.aifName}</p>
                              {holding.registrationNo && <p className="text-xs text-muted-foreground">{holding.registrationNo}</p>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{holding.category || "—"}</Badge>
                            {holding.subcategory && <p className="text-xs text-muted-foreground mt-1">{holding.subcategory}</p>}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(holding.commitmentAmount)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(holding.capitalCalled)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(holding.currentValue)}</TableCell>
                          <TableCell className="text-right">
                            <GainLossIndicator value={holding.unrealizedGainLoss} percent={holding.unrealizedGainLossPercent} />
                          </TableCell>
                          <TableCell><StatusBadge status={holding.entryStatus} /></TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => deleteAifMutation.mutate(holding.id)}
                              data-testid={`button-delete-aif-${holding.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* PMS Tab Content */}
        <TabsContent value="pms" className="mt-4">
          {pmsLoading ? (
            <Card><CardContent className="py-8"><Skeleton className="h-40 w-full" /></CardContent></Card>
          ) : pmsHoldings.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <PieChart className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No PMS Investments Yet</h3>
                <p className="text-muted-foreground mb-4">Add your existing PMS investments to track them here</p>
                <Button onClick={() => setShowAddPmsDialog(true)} data-testid="button-add-first-pms">
                  <Plus className="w-4 h-4 mr-2" /> Add Your First PMS
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* PMS Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <Card className="bg-indigo-50 dark:bg-indigo-950">
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Total Invested</p>
                    <p className="text-xl font-bold">{formatCurrency(pmsSummary.totalInvested)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-emerald-50 dark:bg-emerald-950">
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Current Value</p>
                    <p className="text-xl font-bold">{formatCurrency(pmsSummary.totalCurrentValue)}</p>
                  </CardContent>
                </Card>
                <Card className={pmsSummary.totalGainLoss >= 0 ? "bg-green-50 dark:bg-green-950" : "bg-red-50 dark:bg-red-950"}>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Total Gain/Loss</p>
                    <GainLossIndicator value={pmsSummary.totalGainLoss} percent={pmsSummary.totalGainLossPercent} />
                  </CardContent>
                </Card>
              </div>
              
              {/* PMS Holdings Table */}
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Strategy Name</TableHead>
                        <TableHead>Strategy Type</TableHead>
                        <TableHead className="text-right">Invested</TableHead>
                        <TableHead className="text-right">Corpus Value</TableHead>
                        <TableHead className="text-right">Gain/Loss</TableHead>
                        <TableHead className="text-right">CAGR</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pmsHoldings.map((holding) => (
                        <TableRow key={holding.id} data-testid={`row-pms-${holding.id}`}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{holding.pmsName}</p>
                              {holding.registrationNo && <p className="text-xs text-muted-foreground">{holding.registrationNo}</p>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{holding.strategy || "—"}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(holding.totalInvested || holding.investedAmount)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(holding.corpusValue || holding.currentValue)}</TableCell>
                          <TableCell className="text-right">
                            <GainLossIndicator value={holding.unrealizedGainLoss} percent={holding.unrealizedGainLossPercent} />
                          </TableCell>
                          <TableCell className="text-right">
                            {holding.cagr ? <span className={parseFloat(holding.cagr) >= 0 ? "text-green-600" : "text-red-600"}>{parseFloat(holding.cagr).toFixed(2)}%</span> : "—"}
                          </TableCell>
                          <TableCell><StatusBadge status={holding.entryStatus} /></TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => deletePmsMutation.mutate(holding.id)}
                              data-testid={`button-delete-pms-${holding.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* MLD Tab Content */}
        <TabsContent value="mld" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="w-5 h-5" />
                Market Linked Debentures
              </CardTitle>
              <CardDescription>
                Explore and invest in structured products with market-linked returns
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                MLDs offer capital-efficient exposure to market indices with structured payoff profiles.
                Browse available MLDs, analyze payoff scenarios, and add your existing holdings to track them.
              </p>
              <div className="flex gap-4">
                <Link href="/mld">
                  <Button data-testid="button-browse-mld">
                    <Layers className="w-4 h-4 mr-2" /> Browse MLDs
                  </Button>
                </Link>
                <Link href="/mld">
                  <Button variant="outline" data-testid="button-add-mld">
                    <Plus className="w-4 h-4 mr-2" /> Add Existing MLD
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add AIF Dialog */}
      <Dialog open={showAddAifDialog} onOpenChange={setShowAddAifDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Existing AIF Investment</DialogTitle>
            <DialogDescription>Enter details of your Alternative Investment Fund holding</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Your investment will be submitted for verification. Once approved, it will be included in your portfolio analysis.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="aif-name">Fund Name *</Label>
                <Input
                  id="aif-name"
                  placeholder="e.g., ICICI Prudential India Advantage Fund"
                  value={aifForm.aifName}
                  onChange={(e) => setAifForm({ ...aifForm, aifName: e.target.value })}
                  data-testid="input-aif-name"
                />
              </div>
              
              <div>
                <Label htmlFor="aif-registration">Registration Number</Label>
                <Input
                  id="aif-registration"
                  placeholder="e.g., IN/AIF2/20-21/0001"
                  value={aifForm.registrationNo}
                  onChange={(e) => setAifForm({ ...aifForm, registrationNo: e.target.value })}
                  data-testid="input-aif-registration"
                />
              </div>
              
              <div>
                <Label htmlFor="aif-category">Category</Label>
                <Select value={aifForm.category} onValueChange={(v) => setAifForm({ ...aifForm, category: v })}>
                  <SelectTrigger data-testid="select-aif-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Category I">Category I</SelectItem>
                    <SelectItem value="Category II">Category II</SelectItem>
                    <SelectItem value="Category III">Category III</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="aif-subcategory">Sub-category / Strategy</Label>
                <Input
                  id="aif-subcategory"
                  placeholder="e.g., Private Equity, Credit, Long-Short"
                  value={aifForm.subcategory}
                  onChange={(e) => setAifForm({ ...aifForm, subcategory: e.target.value })}
                  data-testid="input-aif-subcategory"
                />
              </div>

              <Separator className="md:col-span-2" />
              
              <div>
                <Label htmlFor="aif-commitment">Total Commitment Amount (₹) *</Label>
                <Input
                  id="aif-commitment"
                  type="number"
                  placeholder="e.g., 10000000"
                  value={aifForm.commitmentAmount}
                  onChange={(e) => setAifForm({ ...aifForm, commitmentAmount: e.target.value })}
                  data-testid="input-aif-commitment"
                />
                <p className="text-xs text-muted-foreground mt-1">Total amount you committed to invest</p>
              </div>
              
              <div>
                <Label htmlFor="aif-called">Capital Called (₹) *</Label>
                <Input
                  id="aif-called"
                  type="number"
                  placeholder="e.g., 5000000"
                  value={aifForm.capitalCalled}
                  onChange={(e) => setAifForm({ ...aifForm, capitalCalled: e.target.value })}
                  data-testid="input-aif-called"
                />
                <p className="text-xs text-muted-foreground mt-1">Amount called by the fund till date</p>
              </div>

              <div>
                <Label htmlFor="aif-invested-date">Investment Date *</Label>
                <Input
                  id="aif-invested-date"
                  type="date"
                  value={aifForm.investedDate}
                  onChange={(e) => setAifForm({ ...aifForm, investedDate: e.target.value })}
                  data-testid="input-aif-invested-date"
                />
              </div>
              
              <div>
                <Label htmlFor="aif-lockin-date">Lock-in End Date</Label>
                <Input
                  id="aif-lockin-date"
                  type="date"
                  value={aifForm.lockinEndDate}
                  onChange={(e) => setAifForm({ ...aifForm, lockinEndDate: e.target.value })}
                  data-testid="input-aif-lockin-date"
                />
              </div>

              <Separator className="md:col-span-2" />
              
              <div>
                <Label htmlFor="aif-units">Current Units</Label>
                <Input
                  id="aif-units"
                  type="number"
                  step="0.0001"
                  placeholder="e.g., 500.0000"
                  value={aifForm.currentUnits}
                  onChange={(e) => setAifForm({ ...aifForm, currentUnits: e.target.value })}
                  data-testid="input-aif-units"
                />
              </div>
              
              <div>
                <Label htmlFor="aif-entry-nav">Entry NAV (₹)</Label>
                <Input
                  id="aif-entry-nav"
                  type="number"
                  step="0.01"
                  placeholder="e.g., 10000.00"
                  value={aifForm.entryNav}
                  onChange={(e) => setAifForm({ ...aifForm, entryNav: e.target.value })}
                  data-testid="input-aif-entry-nav"
                />
              </div>

              <div>
                <Label htmlFor="aif-latest-nav">Latest NAV (₹)</Label>
                <Input
                  id="aif-latest-nav"
                  type="number"
                  step="0.01"
                  placeholder="e.g., 12500.00"
                  value={aifForm.latestNav}
                  onChange={(e) => setAifForm({ ...aifForm, latestNav: e.target.value })}
                  data-testid="input-aif-latest-nav"
                />
              </div>
              
              <div>
                <Label htmlFor="aif-current-value">Current Value (₹)</Label>
                <Input
                  id="aif-current-value"
                  type="number"
                  placeholder="e.g., 6250000"
                  value={aifForm.currentValue}
                  onChange={(e) => setAifForm({ ...aifForm, currentValue: e.target.value })}
                  data-testid="input-aif-current-value"
                />
                <p className="text-xs text-muted-foreground mt-1">Leave blank if NAV × Units should be used</p>
              </div>
              
              <div className="md:col-span-2">
                <Label htmlFor="aif-notes">Notes</Label>
                <Textarea
                  id="aif-notes"
                  placeholder="Any additional notes about this investment..."
                  value={aifForm.notes}
                  onChange={(e) => setAifForm({ ...aifForm, notes: e.target.value })}
                  data-testid="input-aif-notes"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddAifDialog(false)}>Cancel</Button>
            <Button onClick={handleAddAif} disabled={addAifMutation.isPending} data-testid="button-submit-aif">
              {addAifMutation.isPending ? "Submitting..." : "Submit for Approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add PMS Dialog */}
      <Dialog open={showAddPmsDialog} onOpenChange={setShowAddPmsDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Existing PMS Investment</DialogTitle>
            <DialogDescription>Enter details of your Portfolio Management Service holding</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Your investment will be submitted for verification. Once approved, it will be included in your portfolio analysis.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="pms-name">Strategy Name *</Label>
                <Input
                  id="pms-name"
                  placeholder="e.g., Marcellus Consistent Compounders"
                  value={pmsForm.pmsName}
                  onChange={(e) => setPmsForm({ ...pmsForm, pmsName: e.target.value })}
                  data-testid="input-pms-name"
                />
              </div>
              
              <div>
                <Label htmlFor="pms-registration">Registration Number</Label>
                <Input
                  id="pms-registration"
                  placeholder="e.g., INP000004865"
                  value={pmsForm.registrationNo}
                  onChange={(e) => setPmsForm({ ...pmsForm, registrationNo: e.target.value })}
                  data-testid="input-pms-registration"
                />
              </div>
              
              <div>
                <Label htmlFor="pms-strategy">Strategy Type</Label>
                <Select value={pmsForm.strategy} onValueChange={(v) => setPmsForm({ ...pmsForm, strategy: v })}>
                  <SelectTrigger data-testid="select-pms-strategy">
                    <SelectValue placeholder="Select strategy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Multi-cap">Multi-cap</SelectItem>
                    <SelectItem value="Large-cap">Large-cap</SelectItem>
                    <SelectItem value="Mid-cap">Mid-cap</SelectItem>
                    <SelectItem value="Small-cap">Small-cap</SelectItem>
                    <SelectItem value="Value">Value</SelectItem>
                    <SelectItem value="Growth">Growth</SelectItem>
                    <SelectItem value="GARP">GARP</SelectItem>
                    <SelectItem value="Momentum">Momentum</SelectItem>
                    <SelectItem value="Thematic">Thematic</SelectItem>
                    <SelectItem value="Quant">Quant</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator className="md:col-span-2" />
              
              <div>
                <Label htmlFor="pms-invested">Initial Investment (₹) *</Label>
                <Input
                  id="pms-invested"
                  type="number"
                  placeholder="e.g., 5000000"
                  value={pmsForm.investedAmount}
                  onChange={(e) => setPmsForm({ ...pmsForm, investedAmount: e.target.value })}
                  data-testid="input-pms-invested"
                />
              </div>
              
              <div>
                <Label htmlFor="pms-additional">Additional Infusions (₹)</Label>
                <Input
                  id="pms-additional"
                  type="number"
                  placeholder="e.g., 1000000"
                  value={pmsForm.additionalInfusions}
                  onChange={(e) => setPmsForm({ ...pmsForm, additionalInfusions: e.target.value })}
                  data-testid="input-pms-additional"
                />
                <p className="text-xs text-muted-foreground mt-1">Total additional investments after initial</p>
              </div>

              <div>
                <Label htmlFor="pms-start-date">Start Date *</Label>
                <Input
                  id="pms-start-date"
                  type="date"
                  value={pmsForm.startDate}
                  onChange={(e) => setPmsForm({ ...pmsForm, startDate: e.target.value })}
                  data-testid="input-pms-start-date"
                />
              </div>
              
              <div>
                <Label htmlFor="pms-corpus">Current Corpus Value (₹)</Label>
                <Input
                  id="pms-corpus"
                  type="number"
                  placeholder="e.g., 7500000"
                  value={pmsForm.corpusValue}
                  onChange={(e) => setPmsForm({ ...pmsForm, corpusValue: e.target.value })}
                  data-testid="input-pms-corpus"
                />
                <p className="text-xs text-muted-foreground mt-1">Current portfolio value as per PMS statement</p>
              </div>

              <div>
                <Label htmlFor="pms-nav">Latest NAV (₹)</Label>
                <Input
                  id="pms-nav"
                  type="number"
                  step="0.01"
                  placeholder="e.g., 150.00"
                  value={pmsForm.latestNav}
                  onChange={(e) => setPmsForm({ ...pmsForm, latestNav: e.target.value })}
                  data-testid="input-pms-nav"
                />
              </div>
              
              <div className="md:col-span-2">
                <Label htmlFor="pms-notes">Notes</Label>
                <Textarea
                  id="pms-notes"
                  placeholder="Any additional notes about this investment..."
                  value={pmsForm.notes}
                  onChange={(e) => setPmsForm({ ...pmsForm, notes: e.target.value })}
                  data-testid="input-pms-notes"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddPmsDialog(false)}>Cancel</Button>
            <Button onClick={handleAddPms} disabled={addPmsMutation.isPending} data-testid="button-submit-pms">
              {addPmsMutation.isPending ? "Submitting..." : "Submit for Approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
