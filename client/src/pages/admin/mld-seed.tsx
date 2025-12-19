import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
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
  ChartLine, Percent, IndianRupee, Clock, Shield, Check, X
} from "lucide-react";
import { Link } from "wouter";
import { format, parseISO } from "date-fns";

interface MldMaster {
  id: string;
  isin: string;
  name: string;
  issuer: string;
  issueDate: string;
  maturityDate: string;
  faceValue: string;
  issuePrice?: string;
  couponRate?: string;
  couponFrequency?: string;
  underlying: string;
  payoffType: string;
  barrierLevel?: string;
  participationRate?: string;
  capLevel?: string;
  floorLevel?: string;
  strikePrice?: string;
  knockInLevel?: string;
  knockOutLevel?: string;
  minInvestment?: string;
  lotSize?: number;
  creditRating?: string;
  ratingAgency?: string;
  listingType: string;
  exchange?: string;
  sector?: string;
  category?: string;
  status: string;
  riskScore?: number;
  description?: string;
  payoffFormula?: string;
  riskFactors?: string;
  documentUrl?: string;
  isPublished: boolean;
  createdAt: string;
}

interface MldListResponse {
  mlds: MldMaster[];
  total: number;
}

const PAYOFF_TYPES = [
  { value: "digital", label: "Digital" },
  { value: "barrier", label: "Barrier" },
  { value: "sharkfin", label: "Shark Fin" },
  { value: "range", label: "Range Accrual" },
  { value: "participation", label: "Participation" },
  { value: "autocall", label: "Autocall" },
  { value: "snowball", label: "Snowball" },
];

const UNDERLYINGS = [
  "NIFTY 50",
  "BANK NIFTY",
  "SENSEX",
  "NIFTY IT",
  "NIFTY PHARMA",
  "GOLD",
  "SILVER",
  "S&P 500",
  "NASDAQ 100",
  "EURO STOXX 50",
];

const COUPON_FREQUENCIES = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "semi-annual", label: "Semi-Annual" },
  { value: "annual", label: "Annual" },
  { value: "at_maturity", label: "At Maturity" },
];

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  matured: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  suspended: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const formatCurrency = (value: string | null | undefined) => {
  if (!value) return "—";
  const num = parseFloat(value);
  if (isNaN(num)) return "—";
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  return `₹${num.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
};

const defaultMldForm = {
  isin: "",
  name: "",
  issuer: "",
  issueDate: format(new Date(), "yyyy-MM-dd"),
  maturityDate: "",
  faceValue: "100000",
  issuePrice: "",
  couponRate: "",
  couponFrequency: "quarterly",
  underlying: "NIFTY 50",
  payoffType: "barrier",
  barrierLevel: "",
  participationRate: "",
  capLevel: "",
  floorLevel: "",
  strikePrice: "",
  knockInLevel: "",
  knockOutLevel: "",
  minInvestment: "500000",
  lotSize: "1",
  creditRating: "",
  ratingAgency: "",
  listingType: "unlisted",
  exchange: "",
  sector: "",
  category: "",
  riskScore: "5",
  description: "",
  payoffFormula: "",
  riskFactors: "",
  documentUrl: "",
  isPublished: false,
};

export default function MldSeedAdmin() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingMld, setEditingMld] = useState<MldMaster | null>(null);
  const [mldForm, setMldForm] = useState(defaultMldForm);

  const { data: mldData, isLoading, refetch } = useQuery<MldListResponse>({
    queryKey: ["/api/store/admin/mld"],
  });

  const mlds = mldData?.mlds || [];

  const filteredMlds = mlds.filter(mld => {
    const matchesSearch = 
      mld.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mld.isin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mld.issuer.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === "all") return matchesSearch;
    if (activeTab === "published") return matchesSearch && mld.isPublished;
    if (activeTab === "draft") return matchesSearch && !mld.isPublished;
    if (activeTab === "listed") return matchesSearch && mld.listingType === "listed";
    if (activeTab === "unlisted") return matchesSearch && mld.listingType === "unlisted";
    return matchesSearch;
  });

  const createMldMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/store/admin/mld", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/store/admin/mld"] });
      toast({ title: "Success", description: "MLD created successfully" });
      setShowAddDialog(false);
      setMldForm(defaultMldForm);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to create MLD", variant: "destructive" });
    },
  });

  const updateMldMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest(`/api/store/admin/mld/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/store/admin/mld"] });
      toast({ title: "Success", description: "MLD updated successfully" });
      setEditingMld(null);
      setMldForm(defaultMldForm);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to update MLD", variant: "destructive" });
    },
  });

  const togglePublishMutation = useMutation({
    mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) => 
      apiRequest(`/api/store/admin/mld/${id}/publish`, {
        method: "PUT",
        body: JSON.stringify({ isPublished }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/store/admin/mld"] });
      queryClient.invalidateQueries({ queryKey: ["/api/store/mld"] });
      toast({ title: "Success", description: "Publish status updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to update status", variant: "destructive" });
    },
  });

  const deleteMldMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/store/admin/mld/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/store/admin/mld"] });
      toast({ title: "Success", description: "MLD deleted successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to delete MLD", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!mldForm.isin || !mldForm.name || !mldForm.issuer || !mldForm.maturityDate) {
      toast({ title: "Missing Fields", description: "Please fill in all required fields (ISIN, Name, Issuer, Maturity Date)", variant: "destructive" });
      return;
    }

    const data = {
      isin: mldForm.isin,
      name: mldForm.name,
      issuer: mldForm.issuer,
      issueDate: mldForm.issueDate,
      maturityDate: mldForm.maturityDate,
      faceValue: mldForm.faceValue || "100000",
      issuePrice: mldForm.issuePrice || null,
      couponRate: mldForm.couponRate || null,
      couponFrequency: mldForm.couponFrequency || null,
      underlying: mldForm.underlying,
      payoffType: mldForm.payoffType,
      barrierLevel: mldForm.barrierLevel || null,
      participationRate: mldForm.participationRate || null,
      capLevel: mldForm.capLevel || null,
      floorLevel: mldForm.floorLevel || null,
      strikePrice: mldForm.strikePrice || null,
      knockInLevel: mldForm.knockInLevel || null,
      knockOutLevel: mldForm.knockOutLevel || null,
      minInvestment: mldForm.minInvestment || "500000",
      lotSize: parseInt(mldForm.lotSize) || 1,
      creditRating: mldForm.creditRating || null,
      ratingAgency: mldForm.ratingAgency || null,
      listingType: mldForm.listingType || "unlisted",
      exchange: mldForm.exchange || null,
      sector: mldForm.sector || null,
      category: mldForm.category || null,
      status: "active",
      riskScore: parseInt(mldForm.riskScore) || 5,
      description: mldForm.description || null,
      payoffFormula: mldForm.payoffFormula || null,
      riskFactors: mldForm.riskFactors || null,
      documentUrl: mldForm.documentUrl || null,
      isPublished: mldForm.isPublished,
    };

    if (editingMld) {
      updateMldMutation.mutate({ id: editingMld.id, ...data });
    } else {
      createMldMutation.mutate(data);
    }
  };

  const handleEdit = (mld: MldMaster) => {
    setEditingMld(mld);
    setMldForm({
      isin: mld.isin,
      name: mld.name,
      issuer: mld.issuer,
      issueDate: mld.issueDate,
      maturityDate: mld.maturityDate,
      faceValue: mld.faceValue,
      issuePrice: mld.issuePrice || "",
      couponRate: mld.couponRate || "",
      couponFrequency: mld.couponFrequency || "quarterly",
      underlying: mld.underlying,
      payoffType: mld.payoffType,
      barrierLevel: mld.barrierLevel || "",
      participationRate: mld.participationRate || "",
      capLevel: mld.capLevel || "",
      floorLevel: mld.floorLevel || "",
      strikePrice: mld.strikePrice || "",
      knockInLevel: mld.knockInLevel || "",
      knockOutLevel: mld.knockOutLevel || "",
      minInvestment: mld.minInvestment || "",
      lotSize: String(mld.lotSize || 1),
      creditRating: mld.creditRating || "",
      ratingAgency: mld.ratingAgency || "",
      listingType: mld.listingType,
      exchange: mld.exchange || "",
      sector: mld.sector || "",
      category: mld.category || "",
      riskScore: String(mld.riskScore || 5),
      description: mld.description || "",
      payoffFormula: mld.payoffFormula || "",
      riskFactors: mld.riskFactors || "",
      documentUrl: mld.documentUrl || "",
      isPublished: mld.isPublished,
    });
    setShowAddDialog(true);
  };

  const closeDialog = () => {
    setShowAddDialog(false);
    setEditingMld(null);
    setMldForm(defaultMldForm);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/store-management">
            <Button variant="ghost" size="sm" data-testid="btn-back">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Layers className="w-8 h-8 text-primary" />
              MLD Seed Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage Market Linked Debentures catalog
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} data-testid="btn-refresh">
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
          <Button onClick={() => setShowAddDialog(true)} data-testid="btn-add-mld">
            <Plus className="w-4 h-4 mr-2" /> Add MLD
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{mlds.length}</div>
            <p className="text-muted-foreground text-sm">Total MLDs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">
              {mlds.filter(m => m.isPublished).length}
            </div>
            <p className="text-muted-foreground text-sm">Published</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">
              {mlds.filter(m => !m.isPublished).length}
            </div>
            <p className="text-muted-foreground text-sm">Drafts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">
              {mlds.filter(m => m.listingType === "listed").length}
            </div>
            <p className="text-muted-foreground text-sm">Listed</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>MLD Catalog</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search by name, ISIN, issuer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">All ({mlds.length})</TabsTrigger>
              <TabsTrigger value="published">Published ({mlds.filter(m => m.isPublished).length})</TabsTrigger>
              <TabsTrigger value="draft">Drafts ({mlds.filter(m => !m.isPublished).length})</TabsTrigger>
              <TabsTrigger value="listed">Listed ({mlds.filter(m => m.listingType === "listed").length})</TabsTrigger>
              <TabsTrigger value="unlisted">Unlisted ({mlds.filter(m => m.listingType === "unlisted").length})</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="ml-2">Loading...</span>
                </div>
              ) : filteredMlds.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Layers className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No MLDs found</p>
                  <Button className="mt-4" onClick={() => setShowAddDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" /> Add First MLD
                  </Button>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name / ISIN</TableHead>
                        <TableHead>Issuer</TableHead>
                        <TableHead>Payoff Type</TableHead>
                        <TableHead>Underlying</TableHead>
                        <TableHead>Face Value</TableHead>
                        <TableHead>Maturity</TableHead>
                        <TableHead>Rating</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Published</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMlds.map((mld) => (
                        <TableRow key={mld.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{mld.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{mld.isin}</p>
                            </div>
                          </TableCell>
                          <TableCell>{mld.issuer}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{mld.payoffType}</Badge>
                          </TableCell>
                          <TableCell>{mld.underlying}</TableCell>
                          <TableCell>{formatCurrency(mld.faceValue)}</TableCell>
                          <TableCell>
                            {format(parseISO(mld.maturityDate), "dd MMM yyyy")}
                          </TableCell>
                          <TableCell>
                            {mld.creditRating ? (
                              <Badge>{mld.creditRating}</Badge>
                            ) : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge className={STATUS_COLORS[mld.status] || ""}>
                              {mld.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={mld.isPublished}
                              onCheckedChange={(checked) => 
                                togglePublishMutation.mutate({ id: mld.id, isPublished: checked })
                              }
                              data-testid={`switch-publish-${mld.id}`}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(mld)}
                                data-testid={`btn-edit-${mld.id}`}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (confirm("Are you sure you want to delete this MLD?")) {
                                    deleteMldMutation.mutate(mld.id);
                                  }
                                }}
                                data-testid={`btn-delete-${mld.id}`}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={showAddDialog} onOpenChange={closeDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingMld ? "Edit MLD" : "Add New MLD"}</DialogTitle>
            <DialogDescription>
              {editingMld ? "Update the MLD details" : "Create a new Market Linked Debenture entry"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>ISIN *</Label>
                <Input
                  value={mldForm.isin}
                  onChange={(e) => setMldForm({ ...mldForm, isin: e.target.value.toUpperCase() })}
                  placeholder="INE123456789"
                  data-testid="input-isin"
                />
              </div>
              <div className="col-span-2">
                <Label>Name *</Label>
                <Input
                  value={mldForm.name}
                  onChange={(e) => setMldForm({ ...mldForm, name: e.target.value })}
                  placeholder="MLD Name"
                  data-testid="input-name"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Issuer *</Label>
                <Input
                  value={mldForm.issuer}
                  onChange={(e) => setMldForm({ ...mldForm, issuer: e.target.value })}
                  placeholder="Issuing Company Name"
                  data-testid="input-issuer"
                />
              </div>
              <div>
                <Label>Underlying *</Label>
                <Select
                  value={mldForm.underlying}
                  onValueChange={(v) => setMldForm({ ...mldForm, underlying: v })}
                >
                  <SelectTrigger data-testid="select-underlying">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNDERLYINGS.map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Payoff Type *</Label>
                <Select
                  value={mldForm.payoffType}
                  onValueChange={(v) => setMldForm({ ...mldForm, payoffType: v })}
                >
                  <SelectTrigger data-testid="select-payoff">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYOFF_TYPES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Listing Type</Label>
                <Select
                  value={mldForm.listingType}
                  onValueChange={(v) => setMldForm({ ...mldForm, listingType: v })}
                >
                  <SelectTrigger data-testid="select-listing">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="listed">Listed</SelectItem>
                    <SelectItem value="unlisted">Unlisted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Exchange</Label>
                <Input
                  value={mldForm.exchange}
                  onChange={(e) => setMldForm({ ...mldForm, exchange: e.target.value })}
                  placeholder="NSE / BSE"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label>Face Value *</Label>
                <Input
                  type="number"
                  value={mldForm.faceValue}
                  onChange={(e) => setMldForm({ ...mldForm, faceValue: e.target.value })}
                  data-testid="input-facevalue"
                />
              </div>
              <div>
                <Label>Issue Price</Label>
                <Input
                  type="number"
                  value={mldForm.issuePrice}
                  onChange={(e) => setMldForm({ ...mldForm, issuePrice: e.target.value })}
                />
              </div>
              <div>
                <Label>Issue Date *</Label>
                <Input
                  type="date"
                  value={mldForm.issueDate}
                  onChange={(e) => setMldForm({ ...mldForm, issueDate: e.target.value })}
                  data-testid="input-issuedate"
                />
              </div>
              <div>
                <Label>Maturity Date *</Label>
                <Input
                  type="date"
                  value={mldForm.maturityDate}
                  onChange={(e) => setMldForm({ ...mldForm, maturityDate: e.target.value })}
                  data-testid="input-maturitydate"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label>Coupon Rate (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={mldForm.couponRate}
                  onChange={(e) => setMldForm({ ...mldForm, couponRate: e.target.value })}
                />
              </div>
              <div>
                <Label>Coupon Frequency</Label>
                <Select
                  value={mldForm.couponFrequency}
                  onValueChange={(v) => setMldForm({ ...mldForm, couponFrequency: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUPON_FREQUENCIES.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Min Investment</Label>
                <Input
                  type="number"
                  value={mldForm.minInvestment}
                  onChange={(e) => setMldForm({ ...mldForm, minInvestment: e.target.value })}
                />
              </div>
              <div>
                <Label>Lot Size</Label>
                <Input
                  type="number"
                  min="1"
                  value={mldForm.lotSize}
                  onChange={(e) => setMldForm({ ...mldForm, lotSize: e.target.value })}
                />
              </div>
            </div>

            <div className="border rounded-lg p-4 bg-muted/30">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <ChartLine className="w-4 h-4" /> Payoff Structure
              </h4>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label>Barrier Level (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={mldForm.barrierLevel}
                    onChange={(e) => setMldForm({ ...mldForm, barrierLevel: e.target.value })}
                    placeholder="e.g., 70"
                  />
                </div>
                <div>
                  <Label>Participation Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={mldForm.participationRate}
                    onChange={(e) => setMldForm({ ...mldForm, participationRate: e.target.value })}
                    placeholder="e.g., 100"
                  />
                </div>
                <div>
                  <Label>Cap Level (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={mldForm.capLevel}
                    onChange={(e) => setMldForm({ ...mldForm, capLevel: e.target.value })}
                    placeholder="e.g., 25"
                  />
                </div>
                <div>
                  <Label>Floor Level (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={mldForm.floorLevel}
                    onChange={(e) => setMldForm({ ...mldForm, floorLevel: e.target.value })}
                    placeholder="e.g., -5"
                  />
                </div>
                <div>
                  <Label>Strike Price</Label>
                  <Input
                    type="number"
                    value={mldForm.strikePrice}
                    onChange={(e) => setMldForm({ ...mldForm, strikePrice: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Knock-In Level (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={mldForm.knockInLevel}
                    onChange={(e) => setMldForm({ ...mldForm, knockInLevel: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Knock-Out Level (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={mldForm.knockOutLevel}
                    onChange={(e) => setMldForm({ ...mldForm, knockOutLevel: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Credit Rating</Label>
                <Input
                  value={mldForm.creditRating}
                  onChange={(e) => setMldForm({ ...mldForm, creditRating: e.target.value })}
                  placeholder="AA+"
                />
              </div>
              <div>
                <Label>Rating Agency</Label>
                <Input
                  value={mldForm.ratingAgency}
                  onChange={(e) => setMldForm({ ...mldForm, ratingAgency: e.target.value })}
                  placeholder="CRISIL / ICRA / CARE"
                />
              </div>
              <div>
                <Label>Risk Score (1-10)</Label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={mldForm.riskScore}
                  onChange={(e) => setMldForm({ ...mldForm, riskScore: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={mldForm.description}
                onChange={(e) => setMldForm({ ...mldForm, description: e.target.value })}
                placeholder="Brief description of the MLD..."
                rows={3}
              />
            </div>

            <div>
              <Label>Payoff Formula</Label>
              <Textarea
                value={mldForm.payoffFormula}
                onChange={(e) => setMldForm({ ...mldForm, payoffFormula: e.target.value })}
                placeholder="Describe the payoff formula..."
                rows={2}
              />
            </div>

            <div>
              <Label>Risk Factors</Label>
              <Textarea
                value={mldForm.riskFactors}
                onChange={(e) => setMldForm({ ...mldForm, riskFactors: e.target.value })}
                placeholder="Key risk factors..."
                rows={2}
              />
            </div>

            <div>
              <Label>Document URL</Label>
              <Input
                value={mldForm.documentUrl}
                onChange={(e) => setMldForm({ ...mldForm, documentUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={mldForm.isPublished}
                onCheckedChange={(checked) => setMldForm({ ...mldForm, isPublished: checked })}
              />
              <Label>Publish immediately</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMldMutation.isPending || updateMldMutation.isPending}
              data-testid="btn-submit"
            >
              {(createMldMutation.isPending || updateMldMutation.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {editingMld ? "Update MLD" : "Create MLD"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
