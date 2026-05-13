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
  RefreshCw, Search, Loader2, ArrowLeft, Globe, Building2, 
  TrendingUp, AlertTriangle, Eye, EyeOff, Plus, Edit, Trash2,
  DollarSign, Percent, IndianRupee, Clock, LucideShield as LucideShield, Check, X,
  Briefcase, Crown, Banknote, Target, ArrowDownToLine, ArrowUpFromLine,
  Scale, FileCheck, Users, Database, Sparkles, Package
} from "lucide-react";
import { Link } from "wouter";

interface GiftCityProduct {
  id: string;
  name: string;
  description: string | null;
  category: string;
  subcategory: string | null;
  flowDirection: string;
  regulatoryFramework: string | null;
  investorType: string | null;
  lrsApplicable: boolean;
  lrsCategory: string | null;
  minimumInvestment: string | null;
  currency: string | null;
  expectedReturns: string | null;
  riskLevel: string | null;
  provider: string | null;
  features: string[] | null;
  regulatoryBenefits: string[] | null;
  eligibility: string[] | null;
  complianceRequirements: string[] | null;
  taxImplications: string | null;
  isPublished: boolean;
  isPremium: boolean;
  isLimited: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

const CATEGORIES = [
  "Alternative Investment Funds",
  "IFSC Banking",
  "Structured Products",
  "Family Office Services",
  "Insurance & Reinsurance",
  "Aircraft Leasing",
  "Ship Leasing",
  "FinTech & Digital Assets",
  "Global Trading",
  "Commodity Derivatives"
];

const RISK_LEVELS = ["Low", "Medium", "Medium-High", "High", "Very High"];
const CURRENCIES = ["USD", "EUR", "GBP", "INR", "Multi-Currency"];

const FLOW_DIRECTIONS = [
  { value: "inbound", label: "Inbound", description: "Foreign investors investing in India via IFSC" },
  { value: "outbound", label: "Outbound", description: "Indian residents investing abroad via IFSC" }
];

const REGULATORY_FRAMEWORKS = [
  "IFSCA Fund Management",
  "IFSCA Banking Regulations",
  "IFSCA Insurance",
  "FEMA LRS (Liberalised Remittance Scheme)",
  "FEMA ODI Regulations",
  "RBI Guidelines",
  "SEBI Regulations",
  "IFSCA Bullion Exchange"
];

const INVESTOR_TYPES = [
  "Resident Indian",
  "NRI (Non-Resident Indian)",
  "Foreign Investor",
  "FPI (Foreign Portfolio Investor)",
  "Institutional Investor",
  "HNI (High Net Worth Individual)",
  "Family Office",
  "Sovereign Wealth Fund"
];

const LRS_CATEGORIES = [
  "Capital Account - Investment",
  "Capital Account - Gift/Donation",
  "Current Account - Education",
  "Current Account - Medical",
  "Current Account - Travel",
  "Capital Account - Property Purchase",
  "Investment in Equity/Debt",
  "Investment in Mutual Funds"
];

function formatCurrency(value: string | null | undefined, currency?: string): string {
  if (!value) return "—";
  const num = parseFloat(value);
  if (isNaN(num)) return "—";
  const curr = currency || "USD";
  if (curr === "INR") {
    if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
    if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
    return `₹${num.toLocaleString("en-IN")}`;
  }
  return `$${num.toLocaleString("en-US")}`;
}

export default function GiftCityIfscSeed() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState<GiftCityProduct | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
    subcategory: "",
    flowDirection: "inbound",
    regulatoryFramework: "",
    investorType: "",
    lrsApplicable: false,
    lrsCategory: "",
    minimumInvestment: "",
    currency: "USD",
    expectedReturns: "",
    riskLevel: "Medium",
    provider: "",
    features: "",
    regulatoryBenefits: "",
    eligibility: "",
    complianceRequirements: "",
    taxImplications: "",
    isPublished: true,
    isPremium: false,
    isLimited: false
  });

  const { data: productsData, isLoading, refetch } = useQuery<{ products: GiftCityProduct[] }>({
    queryKey: ["/api/store/gift-city/admin"],
  });

  const products = productsData?.products || [];

  const filteredProducts = products.filter(product => {
    const matchesSearch = !searchQuery || 
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.provider?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesTab = activeTab === "all" ||
      (activeTab === "inbound" && product.flowDirection === "inbound") ||
      (activeTab === "outbound" && product.flowDirection === "outbound") ||
      (activeTab === "published" && product.isPublished) ||
      (activeTab === "unpublished" && !product.isPublished) ||
      (activeTab === "premium" && product.isPremium) ||
      (activeTab === "aif" && product.category === "Alternative Investment Funds") ||
      (activeTab === "banking" && product.category === "IFSC Banking") ||
      (activeTab === "structured" && product.category === "Structured Products");
    
    return matchesSearch && matchesTab;
  });
  
  const inboundCount = products.filter(p => p.flowDirection === "inbound").length;
  const outboundCount = products.filter(p => p.flowDirection === "outbound").length;

  const togglePublishMutation = useMutation({
    mutationFn: async ({ id, isPublished }: { id: string; isPublished: boolean }) => {
      return apiRequest(`/api/store/gift-city/admin/${id}`, "PATCH", { isPublished });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/store/gift-city/admin"] });
      toast({ title: "Product updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update product", variant: "destructive" });
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      const payload = {
        ...data,
        features: data.features.split(",").map(s => s.trim()).filter(Boolean),
        regulatoryBenefits: data.regulatoryBenefits.split(",").map(s => s.trim()).filter(Boolean),
        eligibility: data.eligibility.split(",").map(s => s.trim()).filter(Boolean),
        complianceRequirements: data.complianceRequirements.split(",").map(s => s.trim()).filter(Boolean),
      };
      if (data.id) {
        return apiRequest(`/api/store/gift-city/admin/${data.id}`, "PUT", payload);
      }
      return apiRequest("/api/store/gift-city/admin", "POST", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/store/gift-city/admin"] });
      toast({ title: selectedProduct ? "Product updated" : "Product created" });
      setShowEditDialog(false);
      setShowAddDialog(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to save product", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/store/gift-city/admin/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/store/gift-city/admin"] });
      toast({ title: "Product deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete product", variant: "destructive" });
    }
  });

  const bulkSeedMutation = useMutation({
    mutationFn: async (template: string) => {
      return apiRequest(`/api/store/gift-city/admin/bulk-seed`, "POST", { template });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/store/gift-city/admin"] });
      toast({ 
        title: "Products seeded successfully", 
        description: `Added ${data.count || 0} new products` 
      });
    },
    onError: () => {
      toast({ title: "Failed to seed products", variant: "destructive" });
    }
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/store/gift-city/admin/clear-all`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/store/gift-city/admin"] });
      toast({ title: "All products cleared" });
    },
    onError: () => {
      toast({ title: "Failed to clear products", variant: "destructive" });
    }
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      category: "",
      subcategory: "",
      flowDirection: "inbound",
      regulatoryFramework: "",
      investorType: "",
      lrsApplicable: false,
      lrsCategory: "",
      minimumInvestment: "",
      currency: "USD",
      expectedReturns: "",
      riskLevel: "Medium",
      provider: "",
      features: "",
      regulatoryBenefits: "",
      eligibility: "",
      complianceRequirements: "",
      taxImplications: "",
      isPublished: true,
      isPremium: false,
      isLimited: false
    });
    setSelectedProduct(null);
  };

  const openEditDialog = (product: GiftCityProduct) => {
    setSelectedProduct(product);
    setFormData({
      name: product.name,
      description: product.description || "",
      category: product.category,
      subcategory: product.subcategory || "",
      flowDirection: product.flowDirection || "inbound",
      regulatoryFramework: product.regulatoryFramework || "",
      investorType: product.investorType || "",
      lrsApplicable: product.lrsApplicable || false,
      lrsCategory: product.lrsCategory || "",
      minimumInvestment: product.minimumInvestment || "",
      currency: product.currency || "USD",
      expectedReturns: product.expectedReturns || "",
      riskLevel: product.riskLevel || "Medium",
      provider: product.provider || "",
      features: product.features?.join(", ") || "",
      regulatoryBenefits: product.regulatoryBenefits?.join(", ") || "",
      eligibility: product.eligibility?.join(", ") || "",
      complianceRequirements: product.complianceRequirements?.join(", ") || "",
      taxImplications: product.taxImplications || "",
      isPublished: product.isPublished,
      isPremium: product.isPremium,
      isLimited: product.isLimited
    });
    setShowEditDialog(true);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Alternative Investment Funds": return <Building2 className="h-4 w-4" />;
      case "IFSC Banking": return <Banknote className="h-4 w-4" />;
      case "Structured Products": return <Target className="h-4 w-4" />;
      case "Family Office Services": return <Crown className="h-4 w-4" />;
      default: return <Globe className="h-4 w-4" />;
    }
  };

  const getRiskBadgeVariant = (risk: string | null) => {
    switch (risk) {
      case "Low": return "outline";
      case "Medium": return "secondary";
      case "Medium-High": return "default";
      case "High": return "destructive";
      case "Very High": return "destructive";
      default: return "outline";
    }
  };

  const stats = {
    total: products.length,
    published: products.filter(p => p.isPublished).length,
    premium: products.filter(p => p.isPremium).length,
    aifCount: products.filter(p => p.category === "Alternative Investment Funds").length,
    bankingCount: products.filter(p => p.category === "IFSC Banking").length,
    inbound: inboundCount,
    outbound: outboundCount
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/store-management">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Globe className="h-6 w-6 text-indigo-500" />
              GIFT City / IFSC Products
            </h1>
            <p className="text-muted-foreground">
              Manage GIFT City IFSC products including AIFs, Banking Services, and Structured Products
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={() => { resetForm(); setShowAddDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-indigo-500" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Products</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <ArrowDownToLine className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{stats.inbound}</p>
                <p className="text-xs text-emerald-600">Inbound (FPI)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <ArrowUpFromLine className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.outbound}</p>
                <p className="text-xs text-blue-600">Outbound (LRS)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats.published}</p>
                <p className="text-xs text-muted-foreground">Published</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">{stats.premium}</p>
                <p className="text-xs text-muted-foreground">Premium</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats.aifCount}</p>
                <p className="text-xs text-muted-foreground">AIFs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{stats.bankingCount}</p>
                <p className="text-xs text-muted-foreground">Banking</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4 text-indigo-500" />
            Bulk Seeding Options
          </CardTitle>
          <CardDescription>
            Quickly populate products using predefined IFSCA-compliant templates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => bulkSeedMutation.mutate("inbound")}
              disabled={bulkSeedMutation.isPending}
              className="border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:bg-emerald-950/30"
            >
              {bulkSeedMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ArrowDownToLine className="h-4 w-4 mr-2 text-emerald-600" />
              )}
              Seed Inbound Bundle (FPI Products)
            </Button>
            <Button
              variant="outline"
              onClick={() => bulkSeedMutation.mutate("outbound")}
              disabled={bulkSeedMutation.isPending}
              className="border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:bg-blue-950/30"
            >
              {bulkSeedMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ArrowUpFromLine className="h-4 w-4 mr-2 text-blue-600" />
              )}
              Seed Outbound Bundle (LRS Products)
            </Button>
            <Button
              variant="outline"
              onClick={() => bulkSeedMutation.mutate("all")}
              disabled={bulkSeedMutation.isPending}
              className="border-purple-300 dark:border-purple-700 hover:bg-purple-50 dark:bg-purple-950/30"
            >
              {bulkSeedMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Package className="h-4 w-4 mr-2 text-purple-600" />
              )}
              Seed All IFSC Products
            </Button>
            <Button
              variant="outline"
              onClick={() => bulkSeedMutation.mutate("aif")}
              disabled={bulkSeedMutation.isPending}
            >
              {bulkSeedMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Building2 className="h-4 w-4 mr-2" />
              )}
              Seed AIFs Only
            </Button>
            <Button
              variant="outline"
              onClick={() => bulkSeedMutation.mutate("global-funds")}
              disabled={bulkSeedMutation.isPending}
            >
              {bulkSeedMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Globe className="h-4 w-4 mr-2" />
              )}
              Seed Global Funds
            </Button>
            <div className="ml-auto">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (confirm("Are you sure you want to delete ALL products? This cannot be undone.")) {
                    clearAllMutation.mutate();
                  }
                }}
                disabled={clearAllMutation.isPending || stats.total === 0}
              >
                {clearAllMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Clear All ({stats.total})
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
              <TabsTrigger value="inbound" className="text-emerald-600">
                <ArrowDownToLine className="h-3 w-3 mr-1" />
                Inbound ({stats.inbound})
              </TabsTrigger>
              <TabsTrigger value="outbound" className="text-blue-600">
                <ArrowUpFromLine className="h-3 w-3 mr-1" />
                Outbound ({stats.outbound})
              </TabsTrigger>
              <TabsTrigger value="published">Published ({stats.published})</TabsTrigger>
              <TabsTrigger value="unpublished">Unpublished ({stats.total - stats.published})</TabsTrigger>
              <TabsTrigger value="premium">Premium ({stats.premium})</TabsTrigger>
              <TabsTrigger value="aif">AIFs ({stats.aifCount})</TabsTrigger>
              <TabsTrigger value="banking">Banking ({stats.bankingCount})</TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[500px]">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No products found</p>
                  <p className="text-sm">Add your first GIFT City product to get started</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">ID</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Category / Type</TableHead>
                      <TableHead>Flow</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Min Investment</TableHead>
                      <TableHead>Returns</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                            {product.id.substring(0, 8)}
                          </code>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {product.isPremium && <Crown className="h-4 w-4 text-amber-500" />}
                            <div>
                              <p className="font-medium">{product.name}</p>
                              {product.isLimited && (
                                <Badge variant="outline" className="text-xs">Limited</Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              {getCategoryIcon(product.category)}
                              <span className="text-sm">{product.category}</span>
                            </div>
                            {product.subcategory && (
                              <Badge 
                                variant="secondary" 
                                className={`text-xs w-fit ${
                                  product.subcategory.includes("Category I") && !product.subcategory.includes("II") && !product.subcategory.includes("III")
                                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700"
                                    : product.subcategory.includes("Category II") && !product.subcategory.includes("III")
                                    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700"
                                    : product.subcategory.includes("Category III")
                                    ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700"
                                    : ""
                                }`}
                              >
                                {product.subcategory}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={product.flowDirection === "inbound" 
                              ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300" 
                              : "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300"}
                          >
                            {product.flowDirection === "inbound" ? (
                              <><ArrowDownToLine className="h-3 w-3 mr-1" />Inbound</>
                            ) : (
                              <><ArrowUpFromLine className="h-3 w-3 mr-1" />Outbound</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{product.provider || "—"}</span>
                            {product.provider && (
                              <span className="text-xs text-muted-foreground">
                                {product.category === "Alternative Investment Funds" ? "Fund Manager" :
                                 product.category === "IFSC Banking" ? "Banking Unit" :
                                 product.category === "Insurance & Reinsurance" ? "Insurer" :
                                 product.category === "Family Office Services" ? "Multi-Family Office" :
                                 product.category === "Aircraft Leasing" ? "Lessor" :
                                 "Provider"}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {formatCurrency(product.minimumInvestment, product.currency || undefined)}
                        </TableCell>
                        <TableCell>
                          <span className="text-green-600 font-medium">
                            {product.expectedReturns || "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getRiskBadgeVariant(product.riskLevel)}>
                            {product.riskLevel || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={product.isPublished}
                            onCheckedChange={(checked) => 
                              togglePublishMutation.mutate({ id: product.id, isPublished: checked })
                            }
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => openEditDialog(product)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                if (confirm("Delete this product?")) {
                                  deleteMutation.mutate(product.id);
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
              )}
            </ScrollArea>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={showEditDialog || showAddDialog} onOpenChange={(open) => {
        if (!open) {
          setShowEditDialog(false);
          setShowAddDialog(false);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedProduct ? "Edit Product" : "Add New Product"}
            </DialogTitle>
            <DialogDescription>
              {selectedProduct ? "Update product details" : "Create a new GIFT City IFSC product"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Product Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter product name"
                />
              </div>
              <div className="space-y-2">
                <Label>Provider</Label>
                <Input
                  value={formData.provider}
                  onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                  placeholder="Enter provider name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Product description"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Subcategory</Label>
                <Input
                  value={formData.subcategory}
                  onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                  placeholder="Optional subcategory"
                />
              </div>
            </div>

            <div className="border-t pt-4 mt-2">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Scale className="h-4 w-4 text-indigo-500" />
                Regulatory Classification (IFSCA)
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Flow Direction *</Label>
                  <Select
                    value={formData.flowDirection}
                    onValueChange={(value) => setFormData({ ...formData, flowDirection: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FLOW_DIRECTIONS.map((fd) => (
                        <SelectItem key={fd.value} value={fd.value}>
                          <div className="flex items-center gap-2">
                            {fd.value === "inbound" ? (
                              <ArrowDownToLine className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <ArrowUpFromLine className="h-3 w-3 text-blue-600" />
                            )}
                            {fd.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {formData.flowDirection === "inbound" 
                      ? "Foreign investors investing in India via IFSC"
                      : "Indian residents investing abroad via IFSC"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Regulatory Framework</Label>
                  <Select
                    value={formData.regulatoryFramework}
                    onValueChange={(value) => setFormData({ ...formData, regulatoryFramework: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select framework" />
                    </SelectTrigger>
                    <SelectContent>
                      {REGULATORY_FRAMEWORKS.map((rf) => (
                        <SelectItem key={rf} value={rf}>{rf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <Label>Investor Type</Label>
                  <Select
                    value={formData.investorType}
                    onValueChange={(value) => setFormData({ ...formData, investorType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select investor type" />
                    </SelectTrigger>
                    <SelectContent>
                      {INVESTOR_TYPES.map((it) => (
                        <SelectItem key={it} value={it}>{it}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>LRS Category</Label>
                  <Select
                    value={formData.lrsCategory}
                    onValueChange={(value) => setFormData({ ...formData, lrsCategory: value })}
                    disabled={formData.flowDirection !== "outbound"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select LRS category" />
                    </SelectTrigger>
                    <SelectContent>
                      {LRS_CATEGORIES.map((lc) => (
                        <SelectItem key={lc} value={lc}>{lc}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <Switch
                  checked={formData.lrsApplicable}
                  onCheckedChange={(checked) => setFormData({ ...formData, lrsApplicable: checked })}
                />
                <Label className="text-sm">LRS Limits Apply ($250,000/year for outbound)</Label>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Minimum Investment</Label>
                <Input
                  type="number"
                  value={formData.minimumInvestment}
                  onChange={(e) => setFormData({ ...formData, minimumInvestment: e.target.value })}
                  placeholder="100000"
                />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(value) => setFormData({ ...formData, currency: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((curr) => (
                      <SelectItem key={curr} value={curr}>{curr}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Expected Returns</Label>
                <Input
                  value={formData.expectedReturns}
                  onChange={(e) => setFormData({ ...formData, expectedReturns: e.target.value })}
                  placeholder="15-20%"
                />
              </div>
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
                  {RISK_LEVELS.map((risk) => (
                    <SelectItem key={risk} value={risk}>{risk}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Features (comma-separated)</Label>
              <Textarea
                value={formData.features}
                onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                placeholder="Tax Efficient, Professional Management, Global Access"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Regulatory Benefits (comma-separated)</Label>
              <Textarea
                value={formData.regulatoryBenefits}
                onChange={(e) => setFormData({ ...formData, regulatoryBenefits: e.target.value })}
                placeholder="No STT/CTT, Tax Pass-through, SEBI Regulated"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Eligibility (comma-separated)</Label>
              <Textarea
                value={formData.eligibility}
                onChange={(e) => setFormData({ ...formData, eligibility: e.target.value })}
                placeholder="HNI, Institutional Investors, NRIs"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Compliance Requirements (comma-separated)</Label>
              <Textarea
                value={formData.complianceRequirements}
                onChange={(e) => setFormData({ ...formData, complianceRequirements: e.target.value })}
                placeholder="KYC verification, FATCA declaration, CRS reporting, PAN verification"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Tax Implications</Label>
              <Textarea
                value={formData.taxImplications}
                onChange={(e) => setFormData({ ...formData, taxImplications: e.target.value })}
                placeholder="Enter tax treatment details, withholding tax rates, DTAA benefits, etc."
                rows={2}
              />
            </div>

            <div className="flex items-center gap-6 pt-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.isPublished}
                  onCheckedChange={(checked) => setFormData({ ...formData, isPublished: checked })}
                />
                <Label>Published</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.isPremium}
                  onCheckedChange={(checked) => setFormData({ ...formData, isPremium: checked })}
                />
                <Label>Premium</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.isLimited}
                  onCheckedChange={(checked) => setFormData({ ...formData, isLimited: checked })}
                />
                <Label>Limited Availability</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowEditDialog(false);
              setShowAddDialog(false);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button 
              onClick={() => saveMutation.mutate({ ...formData, id: selectedProduct?.id })}
              disabled={saveMutation.isPending || !formData.name || !formData.category}
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedProduct ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
