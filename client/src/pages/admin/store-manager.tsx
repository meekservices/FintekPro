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
  AlertTriangle, Shield, BarChart3, Settings, Users, Plus, Pencil, Trash2, Award
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
  if (!value) return "text-gray-500";
  const num = parseFloat(value);
  if (isNaN(num)) return "text-gray-500";
  return num >= 0 ? "text-green-600" : "text-red-600";
}

function getRiskBadge(score: number | null) {
  if (!score) return <Badge variant="outline" className="text-xs">N/A</Badge>;
  if (score <= 3) return <Badge className="bg-green-100 text-green-800 text-xs">Low</Badge>;
  if (score <= 6) return <Badge className="bg-yellow-100 text-yellow-800 text-xs">Medium</Badge>;
  return <Badge className="bg-red-100 text-red-800 text-xs">High</Badge>;
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
          <p className="text-gray-600 mt-1">Manage AIF and PMS scheme visibility in the store</p>
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
            <p className="text-sm text-gray-500">Total AIF Schemes</p>
            <p className="text-2xl font-bold text-indigo-600">{aifSchemes.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Published AIF</p>
            <p className="text-2xl font-bold text-green-600">{aifPublishedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Total PMS Strategies</p>
            <p className="text-2xl font-bold text-purple-600">{pmsSchemes.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Published PMS</p>
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
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
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
                <div className="text-center py-8 text-gray-500">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
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
                            <p className="text-xs text-gray-500">{scheme.fundHouseName}</p>
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
                              <EyeOff className="w-4 h-4 text-gray-400" />
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
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
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
                <div className="text-center py-8 text-gray-500">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
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
                            <p className="text-xs text-gray-500">{scheme.fundHouseName}</p>
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
                              <EyeOff className="w-4 h-4 text-gray-400" />
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
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
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
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
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
                            {manager.qualifications && <p className="text-xs text-gray-500">{manager.qualifications}</p>}
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
                  <Button onClick={() => updateManagerMutation.mutate({ id: editingManager.id, ...editingManager })} disabled={updateManagerMutation.isPending}>
                    {updateManagerMutation.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Pencil className="w-4 h-4 mr-2" />}
                    Update Manager
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
