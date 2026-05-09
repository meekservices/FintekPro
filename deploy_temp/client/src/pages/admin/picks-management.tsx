import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  ArrowLeft, Search, Loader2, TrendingUp, Plus, 
  Pencil, Trash2, RefreshCw, Target, AlertTriangle,
  Calendar, DollarSign, BarChart3, Sparkles, CheckCircle,
  XCircle, Clock
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { AdminLayout } from "@/components/layout/admin-layout";

interface DailyPick {
  id: number;
  category: string;
  instrumentId: string;
  instrumentName: string;
  isin?: string;
  symbol?: string;
  market?: string;
  recoDate: string;
  recoPrice: string;
  targetPrice: string;
  stoplossPrice: string;
  currentPrice?: string;
  status: string;
  expiryDate: string;
  returnPct?: string;
  daysHeld?: number;
  rationale: string;
  riskLevel: string;
  suitableFor?: string[];
  keyMetrics?: Record<string, any>;
  timeHorizon?: string;
  confidenceScore?: number;
  sectorCategory?: string;
  generatedBy: string;
  createdAt: string;
}

interface SearchResult {
  id: string;
  name: string;
  symbol?: string;
  isin?: string;
  price?: string | number;
  type: string;
  sector?: string;
  fundHouse?: string;
  issuer?: string;
  market?: string;
}

const CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "listed_stocks", label: "Listed Stocks" },
  { value: "mutual_funds", label: "Mutual Funds" },
  { value: "bonds", label: "Bonds" },
  { value: "unlisted", label: "Unlisted Companies" },
  { value: "global_stocks", label: "Global Stocks" },
  { value: "etfs", label: "ETFs" },
  { value: "reits", label: "REITs/InvITs" },
  { value: "fixed_deposits", label: "Fixed Deposits" },
  { value: "sgb", label: "SGBs" },
];

const STATUSES = [
  { value: "all", label: "All Statuses" },
  { value: "live", label: "Live" },
  { value: "target_hit", label: "Target Hit" },
  { value: "stoploss_hit", label: "Stoploss Hit" },
  { value: "expired", label: "Expired" },
];

const TARGET_PERCENTAGES: Record<string, number> = {
  listed_stocks: 15,
  mutual_funds: 12,
  bonds: 8,
  unlisted: 25,
  global_stocks: 15,
  etfs: 10,
  reits: 10,
  fixed_deposits: 0,
  sgb: 8,
};

const STOPLOSS_PERCENTAGES: Record<string, number> = {
  listed_stocks: 8,
  mutual_funds: 5,
  bonds: 3,
  unlisted: 15,
  global_stocks: 8,
  etfs: 5,
  reits: 5,
  fixed_deposits: 0,
  sgb: 3,
};

const EXPIRY_DAYS: Record<string, number> = {
  listed_stocks: 30,
  mutual_funds: 90,
  bonds: 180,
  unlisted: 365,
  global_stocks: 30,
  etfs: 60,
  reits: 90,
  fixed_deposits: 365,
  sgb: 365,
};

export default function PicksManagement() {
  const { toast } = useToast();
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingPick, setEditingPick] = useState<DailyPick | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<SearchResult | null>(null);
  
  const [formData, setFormData] = useState({
    category: "listed_stocks",
    instrumentId: "",
    instrumentName: "",
    isin: "",
    symbol: "",
    market: "",
    recoPrice: "",
    targetPrice: "",
    stoplossPrice: "",
    expiryDate: "",
    rationale: "",
    riskLevel: "medium",
    suitableFor: ["Balanced"],
  });

  const { data: picksData, isLoading, refetch } = useQuery<{ success: boolean; picks: DailyPick[] }>({
    queryKey: ['/api/picks/admin/list', categoryFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("limit", "100");
      const res = await fetch(`/api/picks/admin/list?${params}`);
      return res.json();
    }
  });

  const { data: statsData } = useQuery<{ success: boolean; stats: any }>({
    queryKey: ['/api/picks/stats'],
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/picks/generate", { method: "POST" });
    },
    onSuccess: (data: any) => {
      toast({ title: `Generated ${data.picks?.length || 0} picks` });
      queryClient.invalidateQueries({ queryKey: ['/api/picks'] });
      refetch();
    },
    onError: (error: any) => {
      toast({ title: "Error generating picks", description: error.message, variant: "destructive" });
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/picks/admin/create", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({ title: "Pick created successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/picks'] });
      setIsAddDialogOpen(false);
      resetForm();
      refetch();
    },
    onError: (error: any) => {
      toast({ title: "Error creating pick", description: error.message, variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest(`/api/picks/admin/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({ title: "Pick updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/picks'] });
      setEditingPick(null);
      resetForm();
      refetch();
    },
    onError: (error: any) => {
      toast({ title: "Error updating pick", description: error.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/picks/admin/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      toast({ title: "Pick deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/picks'] });
      refetch();
    },
    onError: (error: any) => {
      toast({ title: "Error deleting pick", description: error.message, variant: "destructive" });
    }
  });

  const searchProducts = async (query: string, category: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const res = await fetch(`/api/picks/search/products?q=${encodeURIComponent(query)}&category=${category}`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
    }
    setIsSearching(false);
  };

  const handleProductSelect = (product: SearchResult) => {
    const price = parseFloat(product.price?.toString() || "0");
    const targetPct = TARGET_PERCENTAGES[formData.category] || 15;
    const stoplossPct = STOPLOSS_PERCENTAGES[formData.category] || 8;
    const expiryDays = EXPIRY_DAYS[formData.category] || 30;
    
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + expiryDays);
    
    setFormData({
      ...formData,
      instrumentId: product.id,
      instrumentName: product.name,
      isin: product.isin || "",
      symbol: product.symbol || "",
      market: product.market || "",
      recoPrice: price.toString(),
      targetPrice: (price * (1 + targetPct / 100)).toFixed(2),
      stoplossPrice: (price * (1 - stoplossPct / 100)).toFixed(2),
      expiryDate: expiryDate.toISOString().split('T')[0],
    });
    setSelectedProduct(product);
    setSearchResults([]);
    setSearchQuery("");
  };

  const resetForm = () => {
    setFormData({
      category: "listed_stocks",
      instrumentId: "",
      instrumentName: "",
      isin: "",
      symbol: "",
      market: "",
      recoPrice: "",
      targetPrice: "",
      stoplossPrice: "",
      expiryDate: "",
      rationale: "",
      riskLevel: "medium",
      suitableFor: ["Balanced"],
    });
    setSelectedProduct(null);
    setSearchQuery("");
    setSearchResults([]);
  };

  const openEditDialog = (pick: DailyPick) => {
    setEditingPick(pick);
    setFormData({
      category: pick.category,
      instrumentId: pick.instrumentId || "",
      instrumentName: pick.instrumentName,
      isin: pick.isin || "",
      symbol: pick.symbol || "",
      market: pick.market || "",
      recoPrice: pick.recoPrice,
      targetPrice: pick.targetPrice,
      stoplossPrice: pick.stoplossPrice,
      expiryDate: pick.expiryDate,
      rationale: pick.rationale,
      riskLevel: pick.riskLevel || "medium",
      suitableFor: pick.suitableFor || ["Balanced"],
    });
  };

  const handleSubmit = () => {
    if (!formData.instrumentName || !formData.recoPrice || !formData.rationale) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }
    
    if (editingPick) {
      updateMutation.mutate({ id: editingPick.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'live':
        return <Badge className="bg-green-500"><Clock className="h-3 w-3 mr-1" />Live</Badge>;
      case 'target_hit':
        return <Badge className="bg-blue-500"><CheckCircle className="h-3 w-3 mr-1" />Target Hit</Badge>;
      case 'stoploss_hit':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Stoploss Hit</Badge>;
      case 'expired':
        return <Badge variant="secondary"><AlertTriangle className="h-3 w-3 mr-1" />Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCategoryLabel = (category: string) => {
    return CATEGORIES.find(c => c.value === category)?.label || category;
  };

  const picks = picksData?.picks || [];
  const stats = statsData?.stats;

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Pick of the Day Management</h1>
            <p className="text-muted-foreground">Create, manage, and track daily investment picks across all categories</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Auto-Generate
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { resetForm(); setIsAddDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Pick
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingPick ? "Edit Pick" : "Create New Pick"}</DialogTitle>
                  <DialogDescription>
                    {editingPick ? "Update the pick details" : "Add a new investment pick manually"}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select
                        value={formData.category}
                        onValueChange={(value) => setFormData({ ...formData, category: value })}
                        disabled={!!editingPick}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.filter(c => c.value !== "all").map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Risk Level</Label>
                      <Select
                        value={formData.riskLevel}
                        onValueChange={(value) => setFormData({ ...formData, riskLevel: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {!editingPick && (
                    <div className="space-y-2">
                      <Label>Search Product</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search by name, symbol, or ISIN..."
                          className="pl-10"
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            searchProducts(e.target.value, formData.category);
                          }}
                        />
                        {isSearching && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
                        )}
                      </div>
                      {searchResults.length > 0 && (
                        <div className="border rounded-md mt-1 max-h-48 overflow-y-auto">
                          {searchResults.map((result) => (
                            <div
                              key={result.id}
                              className="p-3 hover:bg-muted cursor-pointer border-b last:border-b-0"
                              onClick={() => handleProductSelect(result)}
                            >
                              <div className="font-medium">{result.name}</div>
                              <div className="text-sm text-muted-foreground flex gap-2">
                                {result.symbol && <span>{result.symbol}</span>}
                                {result.isin && <span>{result.isin}</span>}
                                {result.price && <span className="text-green-600">₹{parseFloat(result.price.toString()).toFixed(2)}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {selectedProduct && (
                    <div className="p-3 bg-muted rounded-md">
                      <div className="font-medium">{selectedProduct.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {selectedProduct.symbol} | {selectedProduct.isin}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Instrument Name *</Label>
                    <Input
                      value={formData.instrumentName}
                      onChange={(e) => setFormData({ ...formData, instrumentName: e.target.value })}
                      placeholder="e.g., Reliance Industries Ltd"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Symbol</Label>
                      <Input
                        value={formData.symbol}
                        onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                        placeholder="RELIANCE"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>ISIN</Label>
                      <Input
                        value={formData.isin}
                        onChange={(e) => setFormData({ ...formData, isin: e.target.value })}
                        placeholder="INE002A01018"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Market</Label>
                      <Input
                        value={formData.market}
                        onChange={(e) => setFormData({ ...formData, market: e.target.value })}
                        placeholder="in/us"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Recommendation Price *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.recoPrice}
                        onChange={(e) => {
                          const price = parseFloat(e.target.value);
                          const targetPct = TARGET_PERCENTAGES[formData.category] || 15;
                          const stoplossPct = STOPLOSS_PERCENTAGES[formData.category] || 8;
                          setFormData({
                            ...formData,
                            recoPrice: e.target.value,
                            targetPrice: (price * (1 + targetPct / 100)).toFixed(2),
                            stoplossPrice: (price * (1 - stoplossPct / 100)).toFixed(2),
                          });
                        }}
                        placeholder="1000.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Target Price</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.targetPrice}
                        onChange={(e) => setFormData({ ...formData, targetPrice: e.target.value })}
                        placeholder="1150.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Stoploss Price</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.stoplossPrice}
                        onChange={(e) => setFormData({ ...formData, stoplossPrice: e.target.value })}
                        placeholder="920.00"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Expiry Date</Label>
                    <Input
                      type="date"
                      value={formData.expiryDate}
                      onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Investment Rationale *</Label>
                    <Textarea
                      value={formData.rationale}
                      onChange={(e) => setFormData({ ...formData, rationale: e.target.value })}
                      placeholder="Explain why this is a good investment opportunity..."
                      rows={4}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setIsAddDialogOpen(false); setEditingPick(null); resetForm(); }}>
                    Cancel
                  </Button>
                  <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                    {(createMutation.isPending || updateMutation.isPending) && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    {editingPick ? "Update Pick" : "Create Pick"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  <div>
                    <div className="text-2xl font-bold">{stats.totalPicks || 0}</div>
                    <div className="text-sm text-muted-foreground">Total Picks</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-500" />
                  <div>
                    <div className="text-2xl font-bold">{stats.livePicks || 0}</div>
                    <div className="text-sm text-muted-foreground">Live Picks</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-green-500" />
                  <div>
                    <div className="text-2xl font-bold">{stats.hitRate ? `${stats.hitRate.toFixed(1)}%` : "N/A"}</div>
                    <div className="text-sm text-muted-foreground">Hit Rate</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-purple-500" />
                  <div>
                    <div className="text-2xl font-bold">{stats.avgReturn ? `${stats.avgReturn.toFixed(1)}%` : "N/A"}</div>
                    <div className="text-sm text-muted-foreground">Avg Return</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Daily Picks</CardTitle>
                <CardDescription>Manage all investment picks</CardDescription>
              </div>
              <div className="flex gap-2">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={() => refetch()}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : picks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No picks found. Click "Add Pick" to create one or "Auto-Generate" to generate picks automatically.
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Instrument</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Sector</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Horizon</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead className="text-right">Reco Price</TableHead>
                      <TableHead className="text-right">Target</TableHead>
                      <TableHead className="text-right">Stoploss</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {picks.map((pick) => (
                      <TableRow key={pick.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{pick.instrumentName}</div>
                            <div className="text-sm text-muted-foreground">
                              {pick.symbol || pick.isin}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{getCategoryLabel(pick.category)}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{pick.sectorCategory || '-'}</span>
                        </TableCell>
                        <TableCell>
                          {format(new Date(pick.recoDate), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {(pick.timeHorizon || 'medium_term').replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <div className={`w-2 h-2 rounded-full ${
                              (pick.confidenceScore || 70) >= 80 ? 'bg-green-500' :
                              (pick.confidenceScore || 70) >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                            }`} />
                            <span className="text-sm">{pick.confidenceScore || 70}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ₹{parseFloat(pick.recoPrice).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          ₹{parseFloat(pick.targetPrice).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-red-600">
                          ₹{parseFloat(pick.stoplossPrice).toLocaleString()}
                        </TableCell>
                        <TableCell>{getStatusBadge(pick.status)}</TableCell>
                        <TableCell>
                          <Badge variant={pick.generatedBy === "ai" ? "default" : "secondary"}>
                            {pick.generatedBy === "ai" ? "AI" : "Manual"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                openEditDialog(pick);
                                setIsAddDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm("Are you sure you want to delete this pick?")) {
                                  deleteMutation.mutate(pick.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
