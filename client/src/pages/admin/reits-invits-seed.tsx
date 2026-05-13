import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  RefreshCw, Search, Loader2, ArrowLeft, Building2, Layers, 
  TrendingUp, AlertTriangle, Eye, EyeOff, Plus, Edit, Trash2,
  ChartLine, Percent, IndianRupee, Clock, Shield as LucideShield, Check, X,
  Download, CheckCircle2, XCircle, Landmark, Factory
} from "lucide-react";
import { Link } from "wouter";
import { format, parseISO } from "date-fns";

interface Reit {
  id: string;
  name: string;
  symbol: string;
  sector: string;
  sponsor: string | null;
  marketCap: string | null;
  currentPrice: string | null;
  dividendYield: string | null;
  occupancy: string | null;
  nav: string | null;
  totalAssets: string | null;
  aiSignal: string | null;
  isPublished: boolean;
  description: string | null;
  createdAt: string | null;
}

interface Invit {
  id: string;
  name: string;
  symbol: string;
  sector: string;
  sponsor: string | null;
  marketCap: string | null;
  currentPrice: string | null;
  dividendYield: string | null;
  nav: string | null;
  totalAssets: string | null;
  aiSignal: string | null;
  isPublished: boolean;
  description: string | null;
  createdAt: string | null;
}

function formatCurrency(value: string | null | undefined): string {
  if (!value) return "—";
  const num = parseFloat(value);
  if (isNaN(num)) return "—";
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  return `₹${num.toLocaleString("en-IN")}`;
}

function formatPercent(value: string | null | undefined): string {
  if (!value) return "—";
  const num = parseFloat(value);
  if (isNaN(num)) return "—";
  return `${num.toFixed(2)}%`;
}

const REIT_SECTORS = ['office', 'retail', 'industrial', 'hospitality', 'mixed', 'healthcare', 'data_centers'];
const INVIT_SECTORS = ['power', 'roads', 'telecom', 'gas_pipelines', 'ports', 'airports', 'mixed', 'renewable_energy'];
const AI_SIGNALS = ['strong_buy', 'buy', 'hold', 'sell', 'strong_sell'];

export default function ReitsInvitsSeedPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("reits");
  const [selectedItem, setSelectedItem] = useState<Reit | Invit | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [assetType, setAssetType] = useState<"reit" | "invit">("reit");

  const [formData, setFormData] = useState({
    name: "",
    symbol: "",
    sector: "",
    sponsor: "",
    marketCap: "",
    currentPrice: "",
    dividendYield: "",
    nav: "",
    totalAssets: "",
    occupancy: "",
    aiSignal: "hold",
    isPublished: false,
    description: "",
  });

  const { data: reitsData, isLoading: reitsLoading, refetch: refetchReits } = useQuery<{ reits: Reit[] }>({
    queryKey: ["/api/reit-invit/store/reits/admin"],
  });

  const { data: invitsData, isLoading: invitsLoading, refetch: refetchInvits } = useQuery<{ invits: Invit[] }>({
    queryKey: ["/api/reit-invit/store/invits/admin"],
  });

  // Data refresh status and controls
  const { data: refreshStatusData, refetch: refetchStatus } = useQuery<{
    success: boolean;
    status: { isRefreshing: boolean; lastRefreshTime: string | null; scheduledRefreshActive: boolean };
  }>({
    queryKey: ["/api/reit-invit/data-refresh/status"],
    refetchInterval: 10000,
  });

  const refreshAllMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/reit-invit/data-refresh/all", "POST");
    },
    onSuccess: (data: any) => {
      toast({ 
        title: "Data Refresh Complete", 
        description: `REITs: ${data.reits?.success || 0}/${data.reits?.total || 0}, InvITs: ${data.invits?.success || 0}/${data.invits?.total || 0}` 
      });
      refetchReits();
      refetchInvits();
      refetchStatus();
    },
    onError: (error: Error) => {
      toast({ title: "Refresh Failed", description: error.message, variant: "destructive" });
    },
  });

  const toggleSchedulerMutation = useMutation({
    mutationFn: async (action: "start" | "stop") => {
      return apiRequest(`/api/reit-invit/data-refresh/scheduler/${action}`, "POST", { intervalHours: 6 });
    },
    onSuccess: (_, action) => {
      toast({ title: action === "start" ? "Scheduler Started" : "Scheduler Stopped" });
      refetchStatus();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const reits = reitsData?.reits || [];
  const invits = invitsData?.invits || [];

  const filteredReits = reits.filter(reit => {
    const matchesSearch = !searchQuery || 
      reit.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reit.symbol?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reit.sponsor?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const filteredInvits = invits.filter(invit => {
    const matchesSearch = !searchQuery || 
      invit.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invit.symbol?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invit.sponsor?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const createMutation = useMutation({
    mutationFn: async (data: { type: "reit" | "invit"; item: typeof formData }) => {
      return apiRequest(`/api/reit-invit/store/${data.type}s`, {
        method: "POST",
        body: JSON.stringify(data.item),
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: `${assetType.toUpperCase()} created successfully` });
      setShowAddDialog(false);
      resetForm();
      if (assetType === "reit") refetchReits();
      else refetchInvits();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { type: "reit" | "invit"; id: string; updates: Partial<typeof formData> }) => {
      return apiRequest(`/api/reit-invit/store/${data.type}s/${data.id}`, {
        method: "PATCH",
        body: JSON.stringify(data.updates),
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: `${assetType.toUpperCase()} updated successfully` });
      setShowEditDialog(false);
      setSelectedItem(null);
      if (assetType === "reit") refetchReits();
      else refetchInvits();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const togglePublishMutation = useMutation({
    mutationFn: async (data: { type: "reit" | "invit"; id: string; isPublished: boolean }) => {
      return apiRequest(`/api/reit-invit/store/${data.type}s/${data.id}/publish`, {
        method: "PATCH",
        body: JSON.stringify({ isPublished: data.isPublished }),
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Publish status updated" });
      if (assetType === "reit") refetchReits();
      else refetchInvits();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      symbol: "",
      sector: "",
      sponsor: "",
      marketCap: "",
      currentPrice: "",
      dividendYield: "",
      nav: "",
      totalAssets: "",
      occupancy: "",
      aiSignal: "hold",
      isPublished: false,
      description: "",
    });
  };

  const handleEdit = (item: Reit | Invit, type: "reit" | "invit") => {
    setAssetType(type);
    setSelectedItem(item);
    setFormData({
      name: item.name || "",
      symbol: item.symbol || "",
      sector: item.sector || "",
      sponsor: item.sponsor || "",
      marketCap: item.marketCap || "",
      currentPrice: item.currentPrice || "",
      dividendYield: item.dividendYield || "",
      nav: item.nav || "",
      totalAssets: item.totalAssets || "",
      occupancy: (item as Reit).occupancy || "",
      aiSignal: item.aiSignal || "hold",
      isPublished: item.isPublished || false,
      description: item.description || "",
    });
    setShowEditDialog(true);
  };

  const handleAdd = (type: "reit" | "invit") => {
    setAssetType(type);
    resetForm();
    setShowAddDialog(true);
  };

  const handleSubmitCreate = () => {
    createMutation.mutate({ type: assetType, item: formData });
  };

  const handleSubmitUpdate = () => {
    if (!selectedItem) return;
    updateMutation.mutate({ type: assetType, id: selectedItem.id, updates: formData });
  };

  const isLoading = reitsLoading || invitsLoading;

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin/store-management">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Store
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">REITs & InvITs Management</h1>
          <p className="text-muted-foreground">Manage Real Estate Investment Trusts and Infrastructure Investment Trusts</p>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, symbol, or sponsor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" onClick={() => { refetchReits(); refetchInvits(); }} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="reits" className="flex items-center gap-2">
            <Landmark className="h-4 w-4" />
            REITs ({reits.length})
          </TabsTrigger>
          <TabsTrigger value="invits" className="flex items-center gap-2">
            <Factory className="h-4 w-4" />
            InvITs ({invits.length})
          </TabsTrigger>
          <TabsTrigger value="data-refresh" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Data Refresh
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reits">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Real Estate Investment Trusts</CardTitle>
                <CardDescription>Listed REITs for property investment</CardDescription>
              </div>
              <Button onClick={() => handleAdd("reit")}>
                <Plus className="h-4 w-4 mr-2" />
                Add REIT
              </Button>
            </CardHeader>
            <CardContent>
              {reitsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : filteredReits.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No REITs found. Add your first REIT to get started.
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Symbol</TableHead>
                        <TableHead>Sector</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Dividend Yield</TableHead>
                        <TableHead>Market Cap</TableHead>
                        <TableHead>Signal</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReits.map((reit) => (
                        <TableRow key={reit.id}>
                          <TableCell className="font-medium">{reit.name}</TableCell>
                          <TableCell>{reit.symbol}</TableCell>
                          <TableCell className="capitalize">{reit.sector?.replace('_', ' ')}</TableCell>
                          <TableCell>{formatCurrency(reit.currentPrice)}</TableCell>
                          <TableCell>{formatPercent(reit.dividendYield)}</TableCell>
                          <TableCell>{formatCurrency(reit.marketCap)}</TableCell>
                          <TableCell>
                            <Badge variant={reit.aiSignal?.includes('buy') ? 'default' : reit.aiSignal?.includes('sell') ? 'destructive' : 'secondary'}>
                              {reit.aiSignal || 'N/A'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={reit.isPublished}
                              onCheckedChange={(checked) => togglePublishMutation.mutate({ type: "reit", id: reit.id, isPublished: checked })}
                            />
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(reit, "reit")}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invits">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Infrastructure Investment Trusts</CardTitle>
                <CardDescription>Listed InvITs for infrastructure investment</CardDescription>
              </div>
              <Button onClick={() => handleAdd("invit")}>
                <Plus className="h-4 w-4 mr-2" />
                Add InvIT
              </Button>
            </CardHeader>
            <CardContent>
              {invitsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : filteredInvits.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No InvITs found. Add your first InvIT to get started.
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Symbol</TableHead>
                        <TableHead>Sector</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Dividend Yield</TableHead>
                        <TableHead>Market Cap</TableHead>
                        <TableHead>Signal</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInvits.map((invit) => (
                        <TableRow key={invit.id}>
                          <TableCell className="font-medium">{invit.name}</TableCell>
                          <TableCell>{invit.symbol}</TableCell>
                          <TableCell className="capitalize">{invit.sector?.replace('_', ' ')}</TableCell>
                          <TableCell>{formatCurrency(invit.currentPrice)}</TableCell>
                          <TableCell>{formatPercent(invit.dividendYield)}</TableCell>
                          <TableCell>{formatCurrency(invit.marketCap)}</TableCell>
                          <TableCell>
                            <Badge variant={invit.aiSignal?.includes('buy') ? 'default' : invit.aiSignal?.includes('sell') ? 'destructive' : 'secondary'}>
                              {invit.aiSignal || 'N/A'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={invit.isPublished}
                              onCheckedChange={(checked) => togglePublishMutation.mutate({ type: "invit", id: invit.id, isPublished: checked })}
                            />
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(invit, "invit")}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

        <TabsContent value="data-refresh">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Data Refresh Controls
              </CardTitle>
              <CardDescription>
                Update REIT and InvIT prices and yields from NSE/BSE/Yahoo Finance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <div className={`h-3 w-3 rounded-full ${refreshStatusData?.status?.scheduledRefreshActive ? "bg-green-500" : "bg-muted"}`} />
                      <span className="text-sm font-medium">
                        {refreshStatusData?.status?.scheduledRefreshActive ? "Scheduler Active" : "Scheduler Inactive"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Auto-refresh every 6 hours</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Last Refresh</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {refreshStatusData?.status?.lastRefreshTime
                        ? new Date(refreshStatusData.status.lastRefreshTime).toLocaleString()
                        : "Never"}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      {refreshStatusData?.status?.isRefreshing ? (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                      <span className="text-sm">
                        {refreshStatusData?.status?.isRefreshing ? "Refreshing..." : "Ready"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex gap-4">
                <Button
                  onClick={() => refreshAllMutation.mutate()}
                  disabled={refreshAllMutation.isPending || refreshStatusData?.status?.isRefreshing}
                >
                  {refreshAllMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Refresh All Data
                </Button>
                {refreshStatusData?.status?.scheduledRefreshActive ? (
                  <Button
                    variant="outline"
                    onClick={() => toggleSchedulerMutation.mutate("stop")}
                    disabled={toggleSchedulerMutation.isPending}
                  >
                    Stop Scheduler
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => toggleSchedulerMutation.mutate("start")}
                    disabled={toggleSchedulerMutation.isPending}
                  >
                    Start Scheduler
                  </Button>
                )}
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Data is fetched from NSE India API with Yahoo Finance as fallback.
                  Rate limiting is applied to prevent API blocks.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New {assetType.toUpperCase()}</DialogTitle>
            <DialogDescription>Fill in the details to create a new {assetType === "reit" ? "Real Estate Investment Trust" : "Infrastructure Investment Trust"}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Embassy Office Parks REIT" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="symbol">Symbol *</Label>
              <Input id="symbol" value={formData.symbol} onChange={(e) => setFormData({ ...formData, symbol: e.target.value })} placeholder="e.g., EMBASSY" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sector">Sector *</Label>
              <Select value={formData.sector} onValueChange={(v) => setFormData({ ...formData, sector: v })}>
                <SelectTrigger><SelectValue placeholder="Select sector" /></SelectTrigger>
                <SelectContent>
                  {(assetType === "reit" ? REIT_SECTORS : INVIT_SECTORS).map((sector) => (
                    <SelectItem key={sector} value={sector} className="capitalize">{sector.replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sponsor">Sponsor</Label>
              <Input id="sponsor" value={formData.sponsor} onChange={(e) => setFormData({ ...formData, sponsor: e.target.value })} placeholder="e.g., Blackstone" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currentPrice">Current Price (₹)</Label>
              <Input id="currentPrice" type="number" value={formData.currentPrice} onChange={(e) => setFormData({ ...formData, currentPrice: e.target.value })} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dividendYield">Dividend Yield (%)</Label>
              <Input id="dividendYield" type="number" value={formData.dividendYield} onChange={(e) => setFormData({ ...formData, dividendYield: e.target.value })} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="marketCap">Market Cap (₹)</Label>
              <Input id="marketCap" type="number" value={formData.marketCap} onChange={(e) => setFormData({ ...formData, marketCap: e.target.value })} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nav">NAV (₹)</Label>
              <Input id="nav" type="number" value={formData.nav} onChange={(e) => setFormData({ ...formData, nav: e.target.value })} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="totalAssets">Total Assets (₹)</Label>
              <Input id="totalAssets" type="number" value={formData.totalAssets} onChange={(e) => setFormData({ ...formData, totalAssets: e.target.value })} placeholder="0" />
            </div>
            {assetType === "reit" && (
              <div className="space-y-2">
                <Label htmlFor="occupancy">Occupancy (%)</Label>
                <Input id="occupancy" type="number" value={formData.occupancy} onChange={(e) => setFormData({ ...formData, occupancy: e.target.value })} placeholder="0" />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="aiSignal">AI Signal</Label>
              <Select value={formData.aiSignal} onValueChange={(v) => setFormData({ ...formData, aiSignal: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AI_SIGNALS.map((signal) => (
                    <SelectItem key={signal} value={signal} className="capitalize">{signal.replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Brief description..." rows={3} />
            </div>
            <div className="flex items-center space-x-2 col-span-2">
              <Switch id="isPublished" checked={formData.isPublished} onCheckedChange={(v) => setFormData({ ...formData, isPublished: v })} />
              <Label htmlFor="isPublished">Publish immediately</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleSubmitCreate} disabled={createMutation.isPending || !formData.name || !formData.symbol || !formData.sector}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create {assetType.toUpperCase()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {assetType.toUpperCase()}</DialogTitle>
            <DialogDescription>Update the details for {selectedItem?.name}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input id="edit-name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-symbol">Symbol</Label>
              <Input id="edit-symbol" value={formData.symbol} onChange={(e) => setFormData({ ...formData, symbol: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-sector">Sector</Label>
              <Select value={formData.sector} onValueChange={(v) => setFormData({ ...formData, sector: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(assetType === "reit" ? REIT_SECTORS : INVIT_SECTORS).map((sector) => (
                    <SelectItem key={sector} value={sector} className="capitalize">{sector.replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-sponsor">Sponsor</Label>
              <Input id="edit-sponsor" value={formData.sponsor} onChange={(e) => setFormData({ ...formData, sponsor: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-currentPrice">Current Price (₹)</Label>
              <Input id="edit-currentPrice" type="number" value={formData.currentPrice} onChange={(e) => setFormData({ ...formData, currentPrice: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-dividendYield">Dividend Yield (%)</Label>
              <Input id="edit-dividendYield" type="number" value={formData.dividendYield} onChange={(e) => setFormData({ ...formData, dividendYield: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-marketCap">Market Cap (₹)</Label>
              <Input id="edit-marketCap" type="number" value={formData.marketCap} onChange={(e) => setFormData({ ...formData, marketCap: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-nav">NAV (₹)</Label>
              <Input id="edit-nav" type="number" value={formData.nav} onChange={(e) => setFormData({ ...formData, nav: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-totalAssets">Total Assets (₹)</Label>
              <Input id="edit-totalAssets" type="number" value={formData.totalAssets} onChange={(e) => setFormData({ ...formData, totalAssets: e.target.value })} />
            </div>
            {assetType === "reit" && (
              <div className="space-y-2">
                <Label htmlFor="edit-occupancy">Occupancy (%)</Label>
                <Input id="edit-occupancy" type="number" value={formData.occupancy} onChange={(e) => setFormData({ ...formData, occupancy: e.target.value })} />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="edit-aiSignal">AI Signal</Label>
              <Select value={formData.aiSignal} onValueChange={(v) => setFormData({ ...formData, aiSignal: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AI_SIGNALS.map((signal) => (
                    <SelectItem key={signal} value={signal} className="capitalize">{signal.replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea id="edit-description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} />
            </div>
            <div className="flex items-center space-x-2 col-span-2">
              <Switch id="edit-isPublished" checked={formData.isPublished} onCheckedChange={(v) => setFormData({ ...formData, isPublished: v })} />
              <Label htmlFor="edit-isPublished">Published</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={handleSubmitUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
