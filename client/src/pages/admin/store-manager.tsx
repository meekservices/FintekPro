import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Search, Building2, Eye, EyeOff, RefreshCw, TrendingUp, 
  AlertTriangle, Shield as LucideShield, BarChart3, Settings, Users, Plus, Pencil, Trash2, Award, Calculator
} from "lucide-react";

interface FundManager {
  id: string;
  name: string;
  designation: string | null;
  bio: string | null;
  experienceYears: number | null;
  qualifications: string | null;
  photoUrl: string | null;
  linkedinUrl: string | null;
  totalAumManaged: string | null;
  fundsManaged: number | null;
  avgAlpha: string | null;
  consistencyScore: string | null;
}

interface AifScheme {
  id: string;
  name: string;
  registrationNo: string | null;
  category: string | null;
  fundHouseName: string | null;
  fundStatus: string | null;
  aum: string | null;
  return1Y: string | null;
  riskScore: number | null;
  isPublished: boolean;
}

interface PmsScheme {
  id: string;
  name: string;
  registrationNo: string | null;
  strategy: string | null;
  fundHouseName: string | null;
  fundStatus: string | null;
  aum: string | null;
  return1Y: string | null;
  riskScore: number | null;
  isPublished: boolean;
}

interface ItrPricingConfig {
  id: string;
  itrFormType: string;
  displayName: string;
  description: string | null;
  selfFileFee: string;
  selfFileGst: string | null;
  caAssistedFee: string;
  caAssistedGst: string | null;
  caRevenueSharePercent: string | null;
  expertConsultationFee: string | null;
  rushFilingFee: string | null;
  complexityLevel: string | null;
  estimatedProcessingDays: number | null;
  eligibleForSelfFile: boolean | null;
  requiresCa: boolean | null;
  isActive: boolean | null;
}

interface PlatformFeeConfig {
  id: string;
  feeCode: string;
  feeName: string;
  feeDescription: string | null;
  category: string;
  chargeType: string;
  rateValue: string;
  rateUnit: string | null;
  minAmount: string | null;
  maxAmount: string | null;
  applicableTo: string;
  isGstApplicable: boolean | null;
  gstRate: string | null;
  isRegulatory: boolean | null;
  regulatoryReference: string | null;
  isWaivable: boolean | null;
  maxWaiverPercent: string | null;
  displayOrder: number | null;
  displayLabel: string | null;
  isActive: boolean | null;
}

function formatCurrency(value: string | number | null): string {
  if (!value) return "N/A";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "N/A";
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(1)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(1)} L`;
  return `₹${num.toLocaleString("en-IN")}`;
}

function formatPercent(value: string | null): string {
  if (!value) return "N/A";
  const num = parseFloat(value);
  if (isNaN(num)) return "N/A";
  return `${num >= 0 ? "+" : ""}${num.toFixed(2)}%`;
}

function getReturnColor(value: string | null): string {
  if (!value) return "text-muted-foreground";
  const num = parseFloat(value);
  if (isNaN(num)) return "text-muted-foreground";
  return num >= 0 ? "text-green-600" : "text-red-600";
}

function getRiskBadge(score: number | null) {
  if (!score) return <Badge variant="outline" className="text-xs">N/A</Badge>;
  if (score <= 3) return <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-xs">Low</Badge>;
  if (score <= 6) return <Badge className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-xs">Medium</Badge>;
  return <Badge className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 text-xs">High</Badge>;
}

function getStatusBadge(status: string | null) {
  switch (status) {
    case "active": return <Badge className="bg-green-500 text-white text-xs">Active</Badge>;
    case "soft_close": return <Badge className="bg-yellow-500 text-white text-xs">Soft Close</Badge>;
    case "hard_close": return <Badge className="bg-red-500 text-white text-xs">Hard Close</Badge>;
    default: return <Badge variant="outline" className="text-xs">{status || "Unknown"}</Badge>;
  }
}

export default function AdminStoreManager() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("aif");
  const [aifSearch, setAifSearch] = useState("");
  const [pmsSearch, setPmsSearch] = useState("");
  const [aifStatusFilter, setAifStatusFilter] = useState<string>("all");
  const [pmsStatusFilter, setPmsStatusFilter] = useState<string>("all");
  const [managerSearch, setManagerSearch] = useState("");
  const [editingManager, setEditingManager] = useState<FundManager | null>(null);
  const [isManagerDialogOpen, setIsManagerDialogOpen] = useState(false);
  const [newManager, setNewManager] = useState({
    name: "", designation: "", bio: "", experienceYears: "",
    qualifications: "", photoUrl: "", linkedinUrl: "",
    totalAumManaged: "", fundsManaged: "", avgAlpha: "", consistencyScore: ""
  });

  // ITR Pricing State
  const [editingItrPricing, setEditingItrPricing] = useState<ItrPricingConfig | null>(null);
  const [isItrPricingDialogOpen, setIsItrPricingDialogOpen] = useState(false);
  const [newItrPricing, setNewItrPricing] = useState({
    itrFormType: "", displayName: "", description: "",
    selfFileFee: "0", caAssistedFee: "0", caRevenueSharePercent: "50",
    complexityLevel: "standard", estimatedProcessingDays: 3,
    eligibleForSelfFile: true, requiresCa: false, isActive: true
  });

  // Platform Fees State
  const [platformFeeCategory, setPlatformFeeCategory] = useState("all");
  const [editingFee, setEditingFee] = useState<PlatformFeeConfig | null>(null);
  const [isFeeDialogOpen, setIsFeeDialogOpen] = useState(false);
  const [newFee, setNewFee] = useState({
    feeCode: "", feeName: "", feeDescription: "", category: "platform",
    chargeType: "percentage", rateValue: "0", rateUnit: "percent",
    minAmount: "0", maxAmount: "", applicableTo: "all",
    isGstApplicable: true, gstRate: "18", isRegulatory: false,
    regulatoryReference: "", isWaivable: false, maxWaiverPercent: "0",
    displayOrder: 100, displayLabel: "", isActive: true
  });

  const { data: fundManagersData, isLoading: managersLoading, refetch: refetchManagers } = useQuery<{ managers: FundManager[]; pagination: any }>({
    queryKey: ["/api/store/fund-managers", { search: managerSearch }],
  });

  const { data: aifData, isLoading: aifLoading, refetch: refetchAif } = useQuery<{ schemes: AifScheme[] }>({
    queryKey: ["/api/store/aif/admin", { search: aifSearch, status: aifStatusFilter }],
  });

  const createManagerMutation = useMutation({
    mutationFn: async (data: typeof newManager) => {
      const payload = {
        ...data,
        experienceYears: data.experienceYears ? parseInt(data.experienceYears) : null,
        fundsManaged: data.fundsManaged ? parseInt(data.fundsManaged) : null,
        totalAumManaged: data.totalAumManaged || null,
        avgAlpha: data.avgAlpha || null,
        consistencyScore: data.consistencyScore || null,
      };
      return await apiRequest("/api/store/fund-managers", { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/store/fund-managers"] });
      toast({ title: "Fund Manager Created", description: "New fund manager added successfully." });
      setIsManagerDialogOpen(false);
      setNewManager({ name: "", designation: "", bio: "", experienceYears: "", qualifications: "", photoUrl: "", linkedinUrl: "", totalAumManaged: "", fundsManaged: "", avgAlpha: "", consistencyScore: "" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const updateManagerMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<FundManager>) => {
      const payload = {
        name: data.name,
        designation: data.designation || null,
        bio: data.bio || null,
        experienceYears: typeof data.experienceYears === 'number' ? data.experienceYears : (data.experienceYears ? parseInt(String(data.experienceYears)) : null),
        fundsManaged: typeof data.fundsManaged === 'number' ? data.fundsManaged : (data.fundsManaged ? parseInt(String(data.fundsManaged)) : null),
        totalAumManaged: data.totalAumManaged || null,
        avgAlpha: data.avgAlpha || null,
        consistencyScore: data.consistencyScore || null,
        qualifications: data.qualifications || null,
        photoUrl: data.photoUrl || null,
        linkedinUrl: data.linkedinUrl || null,
      };
      return await apiRequest(`/api/store/fund-managers/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/store/fund-managers"] });
      toast({ title: "Fund Manager Updated" });
      setEditingManager(null);
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const deleteManagerMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/store/fund-managers/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/store/fund-managers"] });
      toast({ title: "Fund Manager Deleted" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });


  // ITR Pricing Query and Mutations
  const { data: itrPricingData, isLoading: itrPricingLoading, refetch: refetchItrPricing } = useQuery<{ data: ItrPricingConfig[] }>({
    queryKey: ["/api/admin/itr-pricing"],
  });

  const seedItrPricingMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/admin/itr-pricing/seed-defaults", { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/itr-pricing"] });
      toast({ title: "Default ITR Pricing Seeded Successfully" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const createItrPricingMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/admin/itr-pricing", { method: "POST", body: JSON.stringify(data) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/itr-pricing"] });
      setIsItrPricingDialogOpen(false);
      setNewItrPricing({ itrFormType: "", displayName: "", description: "", selfFileFee: "0", caAssistedFee: "0", caRevenueSharePercent: "50", complexityLevel: "standard", estimatedProcessingDays: 3, eligibleForSelfFile: true, requiresCa: false, isActive: true });
      toast({ title: "ITR Pricing Created" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const updateItrPricingMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      return await apiRequest(`/api/admin/itr-pricing/${id}`, { method: "PUT", body: JSON.stringify(data) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/itr-pricing"] });
      setEditingItrPricing(null);
      toast({ title: "ITR Pricing Updated" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const deleteItrPricingMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/admin/itr-pricing/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/itr-pricing"] });
      toast({ title: "ITR Pricing Deleted" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  // Platform Fees Query and Mutations
  const { data: platformFeesData, isLoading: platformFeesLoading } = useQuery<{ data: PlatformFeeConfig[], categories: string[] }>({
    queryKey: ["/api/admin/platform-fees"],
  });

  const seedPlatformFeesMutation = useMutation({
    mutationFn: async () => await apiRequest("/api/admin/platform-fees/seed-defaults", { method: "POST" }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/platform-fees"] });
      toast({ title: "Platform Fees Seeded", description: `Seeded ${data.seeded} fees, skipped ${data.skipped} existing` });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const createFeeMutation = useMutation({
    mutationFn: async (data: any) => await apiRequest("/api/admin/platform-fees", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/platform-fees"] });
      setIsFeeDialogOpen(false);
      setNewFee({ feeCode: "", feeName: "", feeDescription: "", category: "platform", chargeType: "percentage", rateValue: "0", rateUnit: "percent", minAmount: "0", maxAmount: "", applicableTo: "all", isGstApplicable: true, gstRate: "18", isRegulatory: false, regulatoryReference: "", isWaivable: false, maxWaiverPercent: "0", displayOrder: 100, displayLabel: "", isActive: true });
      toast({ title: "Fee Created" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const updateFeeMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => await apiRequest(`/api/admin/platform-fees/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/platform-fees"] });
      setEditingFee(null);
      toast({ title: "Fee Updated" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const deleteFeeMutation = useMutation({
    mutationFn: async (id: string) => await apiRequest(`/api/admin/platform-fees/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/platform-fees"] });
      toast({ title: "Fee Deleted" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const toggleFeeMutation = useMutation({
    mutationFn: async (id: string) => await apiRequest(`/api/admin/platform-fees/${id}/toggle`, { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/platform-fees"] });
      toast({ title: "Fee Status Updated" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const filteredFees = platformFeesData?.data?.filter(fee => 
    platformFeeCategory === "all" || fee.category === platformFeeCategory
  ) || [];

  const feeCategories = [
    { value: "all", label: "All Categories" },
    { value: "regulatory", label: "Regulatory (STT, Stamp Duty)" },
    { value: "platform", label: "Platform (Brokerage, Fees)" },
    { value: "advisory", label: "Advisory Services" },
    { value: "document", label: "Document Charges" },
    { value: "convenience", label: "Convenience Fees" },
    { value: "value_added", label: "Value-Added Services" },
  ];

  const { data: pmsData, isLoading: pmsLoading, refetch: refetchPms } = useQuery<{ schemes: PmsScheme[] }>({
    queryKey: ["/api/store/pms/admin", { search: pmsSearch, status: pmsStatusFilter }],
  });

  const toggleAifPublish = useMutation({
    mutationFn: async ({ id, isPublished }: { id: string; isPublished: boolean }) => {
      return await apiRequest(`/api/store/aif/${id}/publish`, { 
        method: "PATCH", 
        body: JSON.stringify({ isPublished }) 
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/store/aif/admin"] });
      queryClient.invalidateQueries({ queryKey: ["/api/store/aif"] });
      toast({
        title: variables.isPublished ? "AIF Published" : "AIF Unpublished",
        description: `The scheme is now ${variables.isPublished ? "visible" : "hidden"} in the store.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update publish status",
        variant: "destructive",
      });
    },
  });

  const togglePmsPublish = useMutation({
    mutationFn: async ({ id, isPublished }: { id: string; isPublished: boolean }) => {
      return await apiRequest(`/api/store/pms/${id}/publish`, { 
        method: "PATCH", 
        body: JSON.stringify({ isPublished }) 
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/store/pms/admin"] });
      queryClient.invalidateQueries({ queryKey: ["/api/store/pms"] });
      toast({
        title: variables.isPublished ? "PMS Published" : "PMS Unpublished",
        description: `The scheme is now ${variables.isPublished ? "visible" : "hidden"} in the store.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update publish status",
        variant: "destructive",
      });
    },
  });

  const aifSchemes = aifData?.schemes || [];
  const pmsSchemes = pmsData?.schemes || [];

  const filteredAif = aifSchemes.filter(scheme => {
    const matchSearch = !aifSearch || 
      scheme.name.toLowerCase().includes(aifSearch.toLowerCase()) ||
      scheme.fundHouseName?.toLowerCase().includes(aifSearch.toLowerCase()) ||
      scheme.registrationNo?.toLowerCase().includes(aifSearch.toLowerCase());
    const matchStatus = aifStatusFilter === "all" || 
      (aifStatusFilter === "published" && scheme.isPublished) ||
      (aifStatusFilter === "unpublished" && !scheme.isPublished);
    return matchSearch && matchStatus;
  });

  const filteredPms = pmsSchemes.filter(scheme => {
    const matchSearch = !pmsSearch || 
      scheme.name.toLowerCase().includes(pmsSearch.toLowerCase()) ||
      scheme.fundHouseName?.toLowerCase().includes(pmsSearch.toLowerCase()) ||
      scheme.registrationNo?.toLowerCase().includes(pmsSearch.toLowerCase());
    const matchStatus = pmsStatusFilter === "all" || 
      (pmsStatusFilter === "published" && scheme.isPublished) ||
      (pmsStatusFilter === "unpublished" && !scheme.isPublished);
    return matchSearch && matchStatus;
  });

  const aifPublishedCount = aifSchemes.filter(s => s.isPublished).length;
  const pmsPublishedCount = pmsSchemes.filter(s => s.isPublished).length;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Settings className="w-8 h-8 text-indigo-600" />
            Store Manager
          </h1>
          <p className="text-muted-foreground mt-1">Manage AIF and PMS scheme visibility in the store</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { refetchAif(); refetchPms(); }} data-testid="refresh-all">
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total AIF Schemes</p>
            <p className="text-2xl font-bold text-indigo-600">{aifSchemes.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Published AIF</p>
            <p className="text-2xl font-bold text-green-600">{aifPublishedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total PMS Strategies</p>
            <p className="text-2xl font-bold text-purple-600">{pmsSchemes.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Published PMS</p>
            <p className="text-2xl font-bold text-green-600">{pmsPublishedCount}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full md:w-auto grid-cols-3 md:inline-flex">
          <TabsTrigger value="aif" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            AIF Schemes ({aifSchemes.length})
          </TabsTrigger>
          <TabsTrigger value="pms" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            PMS Strategies ({pmsSchemes.length})
          </TabsTrigger>
          <TabsTrigger value="managers" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Fund Managers ({fundManagersData?.managers?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="itr-pricing" className="flex items-center gap-2">
            <Calculator className="w-4 h-4" />
            ITR Pricing ({itrPricingData?.data?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="platform-fees" className="flex items-center gap-2" data-testid="tab-platform-fees">
            <Settings className="w-4 h-4" />
            Platform Fees ({platformFeesData?.data?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="aif">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>Alternative Investment Funds</CardTitle>
                  <CardDescription>Manage AIF scheme visibility in the store</CardDescription>
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Search schemes..."
                      value={aifSearch}
                      onChange={(e) => setAifSearch(e.target.value)}
                      className="pl-10 w-64"
                      data-testid="aif-search"
                    />
                  </div>
                  <Select value={aifStatusFilter} onValueChange={setAifStatusFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="unpublished">Unpublished</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {aifLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : filteredAif.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p>No AIF schemes found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Scheme</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>AUM</TableHead>
                      <TableHead>1Y Return</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Published</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAif.map((scheme) => (
                      <TableRow key={scheme.id} data-testid={`aif-row-${scheme.id}`}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{scheme.name}</p>
                            <p className="text-xs text-muted-foreground">{scheme.fundHouseName}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{scheme.category || "AIF"}</Badge>
                        </TableCell>
                        <TableCell>{formatCurrency(scheme.aum)}</TableCell>
                        <TableCell className={getReturnColor(scheme.return1Y)}>
                          {formatPercent(scheme.return1Y)}
                        </TableCell>
                        <TableCell>{getRiskBadge(scheme.riskScore)}</TableCell>
                        <TableCell>{getStatusBadge(scheme.fundStatus)}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            {scheme.isPublished ? (
                              <Eye className="w-4 h-4 text-green-600" />
                            ) : (
                              <EyeOff className="w-4 h-4 text-muted-foreground" />
                            )}
                            <Switch
                              checked={scheme.isPublished}
                              onCheckedChange={(checked) => toggleAifPublish.mutate({ id: scheme.id, isPublished: checked })}
                              disabled={toggleAifPublish.isPending}
                              data-testid={`aif-publish-${scheme.id}`}
                            />
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

        <TabsContent value="pms">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>Portfolio Management Services</CardTitle>
                  <CardDescription>Manage PMS strategy visibility in the store</CardDescription>
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Search strategies..."
                      value={pmsSearch}
                      onChange={(e) => setPmsSearch(e.target.value)}
                      className="pl-10 w-64"
                      data-testid="pms-search"
                    />
                  </div>
                  <Select value={pmsStatusFilter} onValueChange={setPmsStatusFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="unpublished">Unpublished</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {pmsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : filteredPms.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p>No PMS strategies found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Strategy</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>AUM</TableHead>
                      <TableHead>1Y Return</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Published</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPms.map((scheme) => (
                      <TableRow key={scheme.id} data-testid={`pms-row-${scheme.id}`}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{scheme.name}</p>
                            <p className="text-xs text-muted-foreground">{scheme.fundHouseName}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{scheme.strategy || "PMS"}</Badge>
                        </TableCell>
                        <TableCell>{formatCurrency(scheme.aum)}</TableCell>
                        <TableCell className={getReturnColor(scheme.return1Y)}>
                          {formatPercent(scheme.return1Y)}
                        </TableCell>
                        <TableCell>{getRiskBadge(scheme.riskScore)}</TableCell>
                        <TableCell>{getStatusBadge(scheme.fundStatus)}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            {scheme.isPublished ? (
                              <Eye className="w-4 h-4 text-green-600" />
                            ) : (
                              <EyeOff className="w-4 h-4 text-muted-foreground" />
                            )}
                            <Switch
                              checked={scheme.isPublished}
                              onCheckedChange={(checked) => togglePmsPublish.mutate({ id: scheme.id, isPublished: checked })}
                              disabled={togglePmsPublish.isPending}
                              data-testid={`pms-publish-${scheme.id}`}
                            />
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

        <TabsContent value="managers">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-500" />
                    Fund Managers
                  </CardTitle>
                  <CardDescription>Manage portfolio managers and their profiles</CardDescription>
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Search managers..."
                      value={managerSearch}
                      onChange={(e) => setManagerSearch(e.target.value)}
                      className="pl-10 w-64"
                      data-testid="manager-search"
                    />
                  </div>
                  <Dialog open={isManagerDialogOpen} onOpenChange={setIsManagerDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-indigo-600 hover:bg-indigo-700" data-testid="add-manager-btn">
                        <Plus className="w-4 h-4 mr-2" /> Add Manager
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Add New Fund Manager</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="name">Name *</Label>
                            <Input id="name" value={newManager.name} onChange={(e) => setNewManager({ ...newManager, name: e.target.value })} placeholder="Fund Manager Name" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="designation">Designation</Label>
                            <Input id="designation" value={newManager.designation} onChange={(e) => setNewManager({ ...newManager, designation: e.target.value })} placeholder="e.g., Chief Investment Officer" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="bio">Bio</Label>
                          <Textarea id="bio" value={newManager.bio} onChange={(e) => setNewManager({ ...newManager, bio: e.target.value })} placeholder="Professional background and investment philosophy..." rows={3} />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="experience">Experience (Years)</Label>
                            <Input id="experience" type="number" value={newManager.experienceYears} onChange={(e) => setNewManager({ ...newManager, experienceYears: e.target.value })} placeholder="15" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="fundsManaged">Funds Managed</Label>
                            <Input id="fundsManaged" type="number" value={newManager.fundsManaged} onChange={(e) => setNewManager({ ...newManager, fundsManaged: e.target.value })} placeholder="5" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="totalAum">Total AUM (in Cr)</Label>
                            <Input id="totalAum" type="number" value={newManager.totalAumManaged} onChange={(e) => setNewManager({ ...newManager, totalAumManaged: e.target.value })} placeholder="500" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="avgAlpha">Avg Alpha (%)</Label>
                            <Input id="avgAlpha" type="number" step="0.01" value={newManager.avgAlpha} onChange={(e) => setNewManager({ ...newManager, avgAlpha: e.target.value })} placeholder="3.5" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="consistencyScore">Consistency Score (%)</Label>
                            <Input id="consistencyScore" type="number" step="0.01" value={newManager.consistencyScore} onChange={(e) => setNewManager({ ...newManager, consistencyScore: e.target.value })} placeholder="85" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="qualifications">Qualifications</Label>
                          <Input id="qualifications" value={newManager.qualifications} onChange={(e) => setNewManager({ ...newManager, qualifications: e.target.value })} placeholder="CFA, MBA Finance" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="photoUrl">Photo URL</Label>
                            <Input id="photoUrl" value={newManager.photoUrl} onChange={(e) => setNewManager({ ...newManager, photoUrl: e.target.value })} placeholder="https://..." />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="linkedinUrl">LinkedIn URL</Label>
                            <Input id="linkedinUrl" value={newManager.linkedinUrl} onChange={(e) => setNewManager({ ...newManager, linkedinUrl: e.target.value })} placeholder="https://linkedin.com/in/..." />
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsManagerDialogOpen(false)}>Cancel</Button>
                        <Button onClick={() => createManagerMutation.mutate(newManager)} disabled={!newManager.name || createManagerMutation.isPending}>
                          {createManagerMutation.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                          Create Manager
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {managersLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : !fundManagersData?.managers?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p>No fund managers found</p>
                  <p className="text-sm">Add fund managers to associate with PMS and AIF schemes</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Designation</TableHead>
                      <TableHead>Experience</TableHead>
                      <TableHead>Funds Managed</TableHead>
                      <TableHead>AUM</TableHead>
                      <TableHead>Avg Alpha</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fundManagersData.managers.map((manager) => (
                      <TableRow key={manager.id} data-testid={`manager-row-${manager.id}`}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{manager.name}</p>
                            {manager.qualifications && <p className="text-xs text-muted-foreground">{manager.qualifications}</p>}
                          </div>
                        </TableCell>
                        <TableCell>{manager.designation || "N/A"}</TableCell>
                        <TableCell>{manager.experienceYears ? `${manager.experienceYears} yrs` : "N/A"}</TableCell>
                        <TableCell>{manager.fundsManaged || "N/A"}</TableCell>
                        <TableCell>{manager.totalAumManaged ? formatCurrency(manager.totalAumManaged) : "N/A"}</TableCell>
                        <TableCell className={manager.avgAlpha && parseFloat(manager.avgAlpha) >= 0 ? "text-green-600" : "text-red-600"}>
                          {manager.avgAlpha ? `${parseFloat(manager.avgAlpha) >= 0 ? "+" : ""}${parseFloat(manager.avgAlpha).toFixed(2)}%` : "N/A"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setEditingManager(manager)} data-testid={`edit-manager-${manager.id}`}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-600" onClick={() => deleteManagerMutation.mutate(manager.id)} data-testid={`delete-manager-${manager.id}`}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {editingManager && (
            <Dialog open={!!editingManager} onOpenChange={() => setEditingManager(null)}>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Edit Fund Manager</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Name *</Label>
                      <Input value={editingManager.name} onChange={(e) => setEditingManager({ ...editingManager, name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Designation</Label>
                      <Input value={editingManager.designation || ""} onChange={(e) => setEditingManager({ ...editingManager, designation: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Bio</Label>
                    <Textarea value={editingManager.bio || ""} onChange={(e) => setEditingManager({ ...editingManager, bio: e.target.value })} rows={3} />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Experience (Years)</Label>
                      <Input type="number" value={editingManager.experienceYears || ""} onChange={(e) => setEditingManager({ ...editingManager, experienceYears: parseInt(e.target.value) || null })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Funds Managed</Label>
                      <Input type="number" value={editingManager.fundsManaged || ""} onChange={(e) => setEditingManager({ ...editingManager, fundsManaged: parseInt(e.target.value) || null })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Total AUM</Label>
                      <Input value={editingManager.totalAumManaged || ""} onChange={(e) => setEditingManager({ ...editingManager, totalAumManaged: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Avg Alpha (%)</Label>
                      <Input value={editingManager.avgAlpha || ""} onChange={(e) => setEditingManager({ ...editingManager, avgAlpha: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Consistency Score (%)</Label>
                      <Input value={editingManager.consistencyScore || ""} onChange={(e) => setEditingManager({ ...editingManager, consistencyScore: e.target.value })} />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditingManager(null)}>Cancel</Button>
                  <Button onClick={() => updateManagerMutation.mutate({ ...editingManager })} disabled={updateManagerMutation.isPending}>
                    {updateManagerMutation.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Pencil className="w-4 h-4 mr-2" />}
                    Update Manager
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </TabsContent>

        {/* ITR Pricing Tab */}
        <TabsContent value="itr-pricing">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>ITR Filing Pricing Configuration</CardTitle>
                  <CardDescription>Manage pricing for all ITR form types (ITR-1 through ITR-7)</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => seedItrPricingMutation.mutate()} disabled={seedItrPricingMutation.isPending}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${seedItrPricingMutation.isPending ? "animate-spin" : ""}`} />
                    Seed Defaults
                  </Button>
                  <Button onClick={() => setIsItrPricingDialogOpen(true)} data-testid="button-add-itr-pricing">
                    <Plus className="w-4 h-4 mr-2" /> Add Pricing
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {itrPricingLoading ? (
                <div className="flex justify-center py-8"><RefreshCw className="w-6 h-6 animate-spin" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium">Form Type</th>
                        <th className="text-left p-3 font-medium">Display Name</th>
                        <th className="text-right p-3 font-medium">Self-File Fee</th>
                        <th className="text-right p-3 font-medium">CA-Assisted Fee</th>
                        <th className="text-right p-3 font-medium">CA Share %</th>
                        <th className="text-center p-3 font-medium">Complexity</th>
                        <th className="text-center p-3 font-medium">Status</th>
                        <th className="text-right p-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itrPricingData?.data?.map((pricing) => (
                        <tr key={pricing.id} className="border-b hover:bg-muted/20">
                          <td className="p-3 font-medium">{pricing.itrFormType}</td>
                          <td className="p-3">{pricing.displayName}</td>
                          <td className="p-3 text-right">{pricing.eligibleForSelfFile ? `₹${Number(pricing.selfFileFee).toLocaleString()}` : "N/A"}</td>
                          <td className="p-3 text-right">₹{Number(pricing.caAssistedFee).toLocaleString()}</td>
                          <td className="p-3 text-right">{pricing.caRevenueSharePercent}%</td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${pricing.complexityLevel === "simple" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" : pricing.complexityLevel === "standard" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" : "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"}`}>
                              {pricing.complexityLevel}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${pricing.isActive ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" : "bg-muted text-muted-foreground"}`}>
                              {pricing.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex gap-1 justify-end">
                              <Button variant="ghost" size="icon" onClick={() => setEditingItrPricing(pricing)} data-testid={`button-edit-itr-pricing-${pricing.id}`}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { if (confirm("Delete this pricing?")) deleteItrPricingMutation.mutate(pricing.id.toString()); }} data-testid={`button-delete-itr-pricing-${pricing.id}`}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(!itrPricingData?.data || itrPricingData.data.length === 0) && (
                    <div className="text-center py-8 text-muted-foreground">No ITR pricing configured. Click "Seed Defaults" to add standard pricing.</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Platform Fees Tab */}
        <TabsContent value="platform-fees">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>Platform Fee Configuration</CardTitle>
                  <CardDescription>Manage all platform charges including regulatory fees, brokerage, advisory, and value-added services</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={platformFeeCategory} onValueChange={setPlatformFeeCategory}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Filter by category" />
                    </SelectTrigger>
                    <SelectContent>
                      {feeCategories.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={() => seedPlatformFeesMutation.mutate()} disabled={seedPlatformFeesMutation.isPending} data-testid="button-seed-platform-fees">
                    <RefreshCw className={`w-4 h-4 mr-2 ${seedPlatformFeesMutation.isPending ? "animate-spin" : ""}`} />
                    Seed Defaults
                  </Button>
                  <Button onClick={() => setIsFeeDialogOpen(true)} data-testid="button-add-platform-fee">
                    <Plus className="w-4 h-4 mr-2" /> Add Fee
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {platformFeesLoading ? (
                <div className="flex justify-center py-8"><RefreshCw className="w-6 h-6 animate-spin" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium">Fee Code</th>
                        <th className="text-left p-3 font-medium">Fee Name</th>
                        <th className="text-center p-3 font-medium">Category</th>
                        <th className="text-center p-3 font-medium">Type</th>
                        <th className="text-right p-3 font-medium">Rate</th>
                        <th className="text-center p-3 font-medium">GST</th>
                        <th className="text-center p-3 font-medium">Status</th>
                        <th className="text-right p-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFees.map((fee) => (
                        <tr key={fee.id} className="border-b hover:bg-muted/20">
                          <td className="p-3 font-mono text-sm">{fee.feeCode}</td>
                          <td className="p-3">
                            <div>{fee.displayLabel || fee.feeName}</div>
                            {fee.isRegulatory && <span className="text-xs text-blue-600">Regulatory</span>}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              fee.category === "regulatory" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" :
                              fee.category === "platform" ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300" :
                              fee.category === "advisory" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" :
                              fee.category === "document" ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300" :
                              fee.category === "convenience" ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300" :
                              "bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300"
                            }`}>
                              {fee.category}
                            </span>
                          </td>
                          <td className="p-3 text-center text-sm">{fee.chargeType}</td>
                          <td className="p-3 text-right font-mono">
                            {fee.rateUnit === "inr" ? `₹${Number(fee.rateValue).toLocaleString()}` : 
                             fee.rateUnit === "bps" ? `${fee.rateValue} bps` : 
                             `${fee.rateValue}%`}
                          </td>
                          <td className="p-3 text-center">
                            {fee.isGstApplicable ? <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs">{fee.gstRate}%</Badge> : <Badge variant="outline" className="text-xs">Exempt</Badge>}
                          </td>
                          <td className="p-3 text-center">
                            <Switch checked={fee.isActive ?? true} onCheckedChange={() => toggleFeeMutation.mutate(fee.id)} data-testid={`switch-fee-status-${fee.id}`} />
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex gap-1 justify-end">
                              <Button variant="ghost" size="icon" onClick={() => setEditingFee(fee)} data-testid={`button-edit-fee-${fee.id}`}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { if (confirm("Delete this fee?")) deleteFeeMutation.mutate(fee.id); }} data-testid={`button-delete-fee-${fee.id}`}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredFees.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">No platform fees configured. Click "Seed Defaults" to add standard fees.</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Platform Fee Dialog */}
      <Dialog open={isFeeDialogOpen} onOpenChange={setIsFeeDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Platform Fee</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fee Code</Label>
                <Input value={newFee.feeCode} onChange={(e) => setNewFee({ ...newFee, feeCode: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_') })} placeholder="e.g., STT_EQUITY" data-testid="input-fee-code" />
              </div>
              <div className="space-y-2">
                <Label>Fee Name</Label>
                <Input value={newFee.feeName} onChange={(e) => setNewFee({ ...newFee, feeName: e.target.value })} placeholder="Securities Transaction Tax" data-testid="input-fee-name" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <select className="w-full p-2 border rounded" value={newFee.category} onChange={(e) => setNewFee({ ...newFee, category: e.target.value })} data-testid="select-fee-category" title="Fee Category" aria-label="Fee Category">
                  <option value="regulatory">Regulatory</option>
                  <option value="platform">Platform</option>
                  <option value="advisory">Advisory</option>
                  <option value="document">Document</option>
                  <option value="convenience">Convenience</option>
                  <option value="value_added">Value-Added</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Applicable To</Label>
                <select className="w-full p-2 border rounded" value={newFee.applicableTo} onChange={(e) => setNewFee({ ...newFee, applicableTo: e.target.value })} data-testid="select-fee-applicable" title="Applicable To" aria-label="Applicable To">
                  <option value="all">All Products</option>
                  <option value="equity">Equity</option>
                  <option value="mutual_fund">Mutual Funds</option>
                  <option value="bond">Bonds</option>
                  <option value="unlisted">Unlisted Shares</option>
                  <option value="ipo">IPO</option>
                  <option value="derivatives">Derivatives (F&O)</option>
                  <option value="tax_services">Tax Services</option>
                  <option value="advisory">Advisory</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Charge Type</Label>
                <select className="w-full p-2 border rounded" value={newFee.chargeType} onChange={(e) => setNewFee({ ...newFee, chargeType: e.target.value })} data-testid="select-charge-type" title="Charge Type" aria-label="Charge Type">
                  <option value="percentage">Percentage</option>
                  <option value="flat">Flat Amount</option>
                  <option value="tiered">Tiered</option>
                  <option value="per_unit">Per Unit</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Rate Value</Label>
                <Input type="number" step="0.0001" value={newFee.rateValue} onChange={(e) => setNewFee({ ...newFee, rateValue: e.target.value })} data-testid="input-rate-value" />
              </div>
              <div className="space-y-2">
                <Label>Rate Unit</Label>
                <select className="w-full p-2 border rounded" value={newFee.rateUnit} onChange={(e) => setNewFee({ ...newFee, rateUnit: e.target.value })} data-testid="select-rate-unit" title="Rate Unit" aria-label="Rate Unit">
                  <option value="percent">Percent (%)</option>
                  <option value="bps">Basis Points</option>
                  <option value="inr">INR (₹)</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min Amount (₹)</Label>
                <Input type="number" value={newFee.minAmount} onChange={(e) => setNewFee({ ...newFee, minAmount: e.target.value })} data-testid="input-min-amount" />
              </div>
              <div className="space-y-2">
                <Label>Max Amount (₹)</Label>
                <Input type="number" value={newFee.maxAmount} onChange={(e) => setNewFee({ ...newFee, maxAmount: e.target.value })} placeholder="No cap" data-testid="input-max-amount" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Display Label (User-friendly)</Label>
              <Input value={newFee.displayLabel} onChange={(e) => setNewFee({ ...newFee, displayLabel: e.target.value })} placeholder="e.g., STT" data-testid="input-display-label" />
            </div>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2"><input type="checkbox" checked={newFee.isGstApplicable} onChange={(e) => setNewFee({ ...newFee, isGstApplicable: e.target.checked })} /> GST Applicable</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={newFee.isRegulatory} onChange={(e) => setNewFee({ ...newFee, isRegulatory: e.target.checked })} /> Regulatory Fee</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={newFee.isWaivable} onChange={(e) => setNewFee({ ...newFee, isWaivable: e.target.checked })} /> Waivable</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={newFee.isActive} onChange={(e) => setNewFee({ ...newFee, isActive: e.target.checked })} /> Active</label>
            </div>
            {newFee.isGstApplicable && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>GST Rate (%)</Label>
                  <Input type="number" value={newFee.gstRate} onChange={(e) => setNewFee({ ...newFee, gstRate: e.target.value })} data-testid="input-gst-rate" />
                </div>
              </div>
            )}
            {newFee.isWaivable && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Max Waiver (%)</Label>
                  <Input type="number" value={newFee.maxWaiverPercent} onChange={(e) => setNewFee({ ...newFee, maxWaiverPercent: e.target.value })} max="100" data-testid="input-max-waiver" />
                </div>
              </div>
            )}
            {newFee.isRegulatory && (
              <div className="space-y-2">
                <Label>Regulatory Reference</Label>
                <Input value={newFee.regulatoryReference} onChange={(e) => setNewFee({ ...newFee, regulatoryReference: e.target.value })} placeholder="e.g., Securities Transaction Tax Act, 2004" data-testid="input-regulatory-ref" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFeeDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => createFeeMutation.mutate(newFee)} disabled={createFeeMutation.isPending || !newFee.feeCode || !newFee.feeName} data-testid="button-submit-fee">
              {createFeeMutation.isPending ? "Creating..." : "Create Fee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Platform Fee Dialog */}
      <Dialog open={!!editingFee} onOpenChange={() => setEditingFee(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Fee - {editingFee?.feeCode}</DialogTitle>
          </DialogHeader>
          {editingFee && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fee Code</Label>
                  <Input value={editingFee.feeCode} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Fee Name</Label>
                  <Input value={editingFee.feeName} onChange={(e) => setEditingFee({ ...editingFee, feeName: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <select className="w-full p-2 border rounded" value={editingFee.category} onChange={(e) => setEditingFee({ ...editingFee, category: e.target.value })} title="Fee Category" aria-label="Fee Category">
                    <option value="regulatory">Regulatory</option>
                    <option value="platform">Platform</option>
                    <option value="advisory">Advisory</option>
                    <option value="document">Document</option>
                    <option value="convenience">Convenience</option>
                    <option value="value_added">Value-Added</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Applicable To</Label>
                  <select className="w-full p-2 border rounded" value={editingFee.applicableTo} onChange={(e) => setEditingFee({ ...editingFee, applicableTo: e.target.value })} title="Applicable To" aria-label="Applicable To">
                    <option value="all">All Products</option>
                    <option value="equity">Equity</option>
                    <option value="mutual_fund">Mutual Funds</option>
                    <option value="bond">Bonds</option>
                    <option value="unlisted">Unlisted Shares</option>
                    <option value="ipo">IPO</option>
                    <option value="derivatives">Derivatives (F&O)</option>
                    <option value="tax_services">Tax Services</option>
                    <option value="advisory">Advisory</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Charge Type</Label>
                  <select className="w-full p-2 border rounded" value={editingFee.chargeType} onChange={(e) => setEditingFee({ ...editingFee, chargeType: e.target.value })} title="Charge Type" aria-label="Charge Type">
                    <option value="percentage">Percentage</option>
                    <option value="flat">Flat Amount</option>
                    <option value="tiered">Tiered</option>
                    <option value="per_unit">Per Unit</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Rate Value</Label>
                  <Input type="number" step="0.0001" value={editingFee.rateValue} onChange={(e) => setEditingFee({ ...editingFee, rateValue: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Rate Unit</Label>
                  <select className="w-full p-2 border rounded" value={editingFee.rateUnit || "percent"} onChange={(e) => setEditingFee({ ...editingFee, rateUnit: e.target.value })} title="Rate Unit" aria-label="Rate Unit">
                    <option value="percent">Percent (%)</option>
                    <option value="bps">Basis Points</option>
                    <option value="inr">INR (₹)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Min Amount (₹)</Label>
                  <Input type="number" value={editingFee.minAmount || ""} onChange={(e) => setEditingFee({ ...editingFee, minAmount: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Max Amount (₹)</Label>
                  <Input type="number" value={editingFee.maxAmount || ""} onChange={(e) => setEditingFee({ ...editingFee, maxAmount: e.target.value })} placeholder="No cap" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Display Label</Label>
                <Input value={editingFee.displayLabel || ""} onChange={(e) => setEditingFee({ ...editingFee, displayLabel: e.target.value })} />
              </div>
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2"><input type="checkbox" checked={editingFee.isGstApplicable ?? true} onChange={(e) => setEditingFee({ ...editingFee, isGstApplicable: e.target.checked })} /> GST Applicable</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={editingFee.isRegulatory ?? false} onChange={(e) => setEditingFee({ ...editingFee, isRegulatory: e.target.checked })} /> Regulatory</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={editingFee.isWaivable ?? false} onChange={(e) => setEditingFee({ ...editingFee, isWaivable: e.target.checked })} /> Waivable</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={editingFee.isActive ?? true} onChange={(e) => setEditingFee({ ...editingFee, isActive: e.target.checked })} /> Active</label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFee(null)}>Cancel</Button>
            <Button onClick={() => editingFee && updateFeeMutation.mutate({ ...editingFee })} disabled={updateFeeMutation.isPending} data-testid="button-update-fee">
              {updateFeeMutation.isPending ? "Updating..." : "Update Fee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create ITR Pricing Dialog */}
      <Dialog open={isItrPricingDialogOpen} onOpenChange={setIsItrPricingDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add ITR Pricing Configuration</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ITR Form Type</Label>
                <select className="w-full p-2 border rounded" value={newItrPricing.itrFormType} onChange={(e) => setNewItrPricing({ ...newItrPricing, itrFormType: e.target.value })} title="ITR Form Type" aria-label="ITR Form Type">
                  <option value="">Select Form</option>
                  <option value="ITR-1">ITR-1 (Sahaj)</option>
                  <option value="ITR-2">ITR-2</option>
                  <option value="ITR-3">ITR-3</option>
                  <option value="ITR-4">ITR-4 (Sugam)</option>
                  <option value="ITR-5">ITR-5</option>
                  <option value="ITR-6">ITR-6</option>
                  <option value="ITR-7">ITR-7</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input value={newItrPricing.displayName} onChange={(e) => setNewItrPricing({ ...newItrPricing, displayName: e.target.value })} placeholder="e.g., Salaried Individual" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={newItrPricing.description} onChange={(e) => setNewItrPricing({ ...newItrPricing, description: e.target.value })} placeholder="Brief description" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Self-File Fee (₹)</Label>
                <Input type="number" value={newItrPricing.selfFileFee} onChange={(e) => setNewItrPricing({ ...newItrPricing, selfFileFee: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>CA-Assisted Fee (₹)</Label>
                <Input type="number" value={newItrPricing.caAssistedFee} onChange={(e) => setNewItrPricing({ ...newItrPricing, caAssistedFee: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>CA Share (%)</Label>
                <Input type="number" value={newItrPricing.caRevenueSharePercent} onChange={(e) => setNewItrPricing({ ...newItrPricing, caRevenueSharePercent: e.target.value })} min="0" max="100" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Complexity Level</Label>
                <select className="w-full p-2 border rounded" value={newItrPricing.complexityLevel} onChange={(e) => setNewItrPricing({ ...newItrPricing, complexityLevel: e.target.value })} title="Complexity Level" aria-label="Complexity Level">
                  <option value="simple">Simple</option>
                  <option value="standard">Standard</option>
                  <option value="complex">Complex</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Processing Days</Label>
                <Input type="number" value={newItrPricing.estimatedProcessingDays} onChange={(e) => setNewItrPricing({ ...newItrPricing, estimatedProcessingDays: parseInt(e.target.value) || 3 })} min="1" max="30" />
              </div>
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2"><input type="checkbox" checked={newItrPricing.eligibleForSelfFile} onChange={(e) => setNewItrPricing({ ...newItrPricing, eligibleForSelfFile: e.target.checked })} /> Eligible for Self-File</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={newItrPricing.requiresCa} onChange={(e) => setNewItrPricing({ ...newItrPricing, requiresCa: e.target.checked })} /> Requires CA</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={newItrPricing.isActive} onChange={(e) => setNewItrPricing({ ...newItrPricing, isActive: e.target.checked })} /> Active</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsItrPricingDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => createItrPricingMutation.mutate({ ...newItrPricing, selfFileFee: newItrPricing.selfFileFee, caAssistedFee: newItrPricing.caAssistedFee, caRevenueSharePercent: parseInt(newItrPricing.caRevenueSharePercent) })} disabled={createItrPricingMutation.isPending} data-testid="button-submit-itr-pricing">
              {createItrPricingMutation.isPending ? "Creating..." : "Create Pricing"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit ITR Pricing Dialog */}
      <Dialog open={!!editingItrPricing} onOpenChange={() => setEditingItrPricing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit ITR Pricing - {editingItrPricing?.itrFormType}</DialogTitle>
          </DialogHeader>
          {editingItrPricing && (
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input value={editingItrPricing.displayName || ""} onChange={(e) => setEditingItrPricing({ ...editingItrPricing, displayName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={editingItrPricing.description || ""} onChange={(e) => setEditingItrPricing({ ...editingItrPricing, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Self-File Fee (₹)</Label>
                  <Input type="number" value={editingItrPricing.selfFileFee} onChange={(e) => setEditingItrPricing({ ...editingItrPricing, selfFileFee: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>CA-Assisted Fee (₹)</Label>
                  <Input type="number" value={editingItrPricing.caAssistedFee ?? ''} onChange={(e) => setEditingItrPricing({ ...editingItrPricing, caAssistedFee: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>CA Share (%)</Label>
                  <Input type="number" value={String(editingItrPricing.caRevenueSharePercent ?? '')} onChange={(e) => setEditingItrPricing({ ...editingItrPricing, caRevenueSharePercent: e.target.value })} min="0" max="100" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Complexity Level</Label>
                  <select className="w-full p-2 border rounded" value={editingItrPricing.complexityLevel ?? 'standard'} onChange={(e) => setEditingItrPricing({ ...editingItrPricing, complexityLevel: e.target.value })} title="Complexity Level" aria-label="Complexity Level">
                    <option value="simple">Simple</option>
                    <option value="standard">Standard</option>
                    <option value="complex">Complex</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Processing Days</Label>
                  <Input type="number" value={editingItrPricing.estimatedProcessingDays ?? ''} onChange={(e) => setEditingItrPricing({ ...editingItrPricing, estimatedProcessingDays: parseInt(e.target.value) || 3 })} min="1" max="30" />
                </div>
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2"><input type="checkbox" checked={editingItrPricing.eligibleForSelfFile ?? true} onChange={(e) => setEditingItrPricing({ ...editingItrPricing, eligibleForSelfFile: e.target.checked })} /> Eligible for Self-File</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={editingItrPricing.requiresCa ?? false} onChange={(e) => setEditingItrPricing({ ...editingItrPricing, requiresCa: e.target.checked })} /> Requires CA</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={editingItrPricing.isActive ?? true} onChange={(e) => setEditingItrPricing({ ...editingItrPricing, isActive: e.target.checked })} /> Active</label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItrPricing(null)}>Cancel</Button>
            <Button onClick={() => editingItrPricing && updateItrPricingMutation.mutate({ id: editingItrPricing.id, displayName: editingItrPricing.displayName, description: editingItrPricing.description, selfFileFee: editingItrPricing.selfFileFee, caAssistedFee: editingItrPricing.caAssistedFee, caRevenueSharePercent: editingItrPricing.caRevenueSharePercent, complexityLevel: editingItrPricing.complexityLevel, estimatedProcessingDays: editingItrPricing.estimatedProcessingDays, eligibleForSelfFile: editingItrPricing.eligibleForSelfFile, requiresCa: editingItrPricing.requiresCa, isActive: editingItrPricing.isActive })} disabled={updateItrPricingMutation.isPending} data-testid="button-update-itr-pricing">
              {updateItrPricingMutation.isPending ? "Updating..." : "Update Pricing"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
