import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  ChartLine, Percent, IndianRupee, Clock, Shield, Check, X,
  Download, CloudDownload, CheckCircle2, XCircle, Database, Sparkles
} from "lucide-react";
import { Link } from "wouter";
import { format, parseISO } from "date-fns";

interface AifMaster {
  id: string;
  name: string;
  registrationNo: string | null;
  category: string | null;
  subcategory: string | null;
  fundHouseName: string | null;
  sponsor: string | null;
  style: string | null;
  minInvestment: string | null;
  lockIn: string | null;
  liquidityFrequency: string | null;
  benchmark: string | null;
  fundStatus: string | null;
  isPublished: boolean;
  navFrequency: string | null;
  latestNav: string | null;
  lastNavDate: string | null;
  aum: string | null;
  return1Y: string | null;
  return3Y: string | null;
  returnSinceInception: string | null;
  riskScore: number | null;
  inceptionDate: string | null;
  description: string | null;
}

interface SebiAifListing {
  registrationNo: string;
  name: string;
  fundHouseName: string;
  category: string;
  subcategory: string | null;
  sponsor: string | null;
  inceptionDate: string | null;
  city: string | null;
  source: string;
  isDuplicate?: boolean;
}

interface ImportPreview {
  success: boolean;
  listings: SebiAifListing[];
  summary: {
    total: number;
    new: number;
    duplicates: number;
  };
  errors: string[];
}

interface SeedPreview {
  success: boolean;
  listings: Array<SebiAifListing & {
    minInvestment: string;
    aum: string;
    return1Y: string;
    return3Y: string;
    riskScore: number;
    isDuplicate?: boolean;
  }>;
  summary: {
    total: number;
    new: number;
    duplicates: number;
    byCategory: {
      "Category I": number;
      "Category II": number;
      "Category III": number;
    };
  };
}

function formatCurrency(value: string | null | undefined): string {
  if (!value) return "—";
  const num = parseFloat(value);
  if (isNaN(num)) return "—";
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  return `₹${num.toLocaleString("en-IN")}`;
}

function formatReturn(value: string | null | undefined): string {
  if (!value) return "—";
  const num = parseFloat(value);
  if (isNaN(num)) return "—";
  return `${num >= 0 ? "+" : ""}${num.toFixed(2)}%`;
}

export default function AifSeedPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedAif, setSelectedAif] = useState<AifMaster | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [selectedForImport, setSelectedForImport] = useState<Set<string>>(new Set());
  const [showSeedDialog, setShowSeedDialog] = useState(false);
  const [seedPreview, setSeedPreview] = useState<SeedPreview | null>(null);

  // Fetch all AIFs for admin
  const { data: aifData, isLoading, refetch } = useQuery<{ schemes: AifMaster[] }>({
    queryKey: ["/api/store/aif/admin"],
  });

  const aifs = aifData?.schemes || [];

  // Filter AIFs based on search and tab
  const filteredAifs = aifs.filter(aif => {
    const matchesSearch = !searchQuery || 
      aif.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      aif.registrationNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      aif.fundHouseName?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesTab = activeTab === "all" ||
      (activeTab === "published" && aif.isPublished) ||
      (activeTab === "unpublished" && !aif.isPublished) ||
      (activeTab === "category1" && aif.category === "Category I") ||
      (activeTab === "category2" && aif.category === "Category II") ||
      (activeTab === "category3" && aif.category === "Category III");
    
    return matchesSearch && matchesTab;
  });

  // Toggle publish status
  const togglePublishMutation = useMutation({
    mutationFn: async ({ id, isPublished }: { id: string; isPublished: boolean }) => {
      const response = await apiRequest(`/api/store/aif/${id}/publish`, {
        method: "PATCH",
        body: JSON.stringify({ isPublished }),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/store/aif/admin"] });
      toast({ title: "Success", description: "AIF status updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Preview SEBI import
  const previewSebiImportMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/store/aif/sebi/preview", {
        method: "GET",
      });
      return response;
    },
    onSuccess: (data) => {
      setImportPreview(data);
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: `Failed to fetch SEBI data: ${error.message}`, 
        variant: "destructive" 
      });
    },
  });

  // Execute import
  const executeSebiImportMutation = useMutation({
    mutationFn: async (listings: SebiAifListing[]) => {
      const response = await apiRequest("/api/store/aif/sebi/import", {
        method: "POST",
        body: JSON.stringify({ listings }),
      });
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/store/aif/admin"] });
      toast({ 
        title: "Import Complete", 
        description: `Imported ${data.summary.imported} AIFs. ${data.summary.skipped} skipped.` 
      });
      setShowImportDialog(false);
      setImportPreview(null);
      setSelectedForImport(new Set());
    },
    onError: (error: any) => {
      toast({ 
        title: "Import Failed", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  // Preview comprehensive seed data
  const previewSeedMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/store/aif/seed/preview", {
        method: "GET",
      });
      return response;
    },
    onSuccess: (data) => {
      setSeedPreview(data);
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: `Failed to load seed data: ${error.message}`, 
        variant: "destructive" 
      });
    },
  });

  // Execute seed all
  const executeSeedAllMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/store/aif/seed/all", {
        method: "POST",
      });
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/store/aif/admin"] });
      toast({ 
        title: "Seeding Complete", 
        description: `Successfully seeded ${data.summary.imported} AIFs across all categories.` 
      });
      setShowSeedDialog(false);
      setSeedPreview(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Seeding Failed", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const toggleImportSelection = (regNo: string) => {
    const newSet = new Set(selectedForImport);
    if (newSet.has(regNo)) {
      newSet.delete(regNo);
    } else {
      newSet.add(regNo);
    }
    setSelectedForImport(newSet);
  };

  const selectAllNew = () => {
    if (!importPreview) return;
    const newItems = importPreview.listings
      .filter(l => !l.isDuplicate)
      .map(l => l.registrationNo);
    setSelectedForImport(new Set(newItems));
  };

  const clearSelection = () => {
    setSelectedForImport(new Set());
  };

  const handleImportSelected = () => {
    if (!importPreview) return;
    const selectedListings = importPreview.listings.filter(
      l => selectedForImport.has(l.registrationNo)
    );
    executeSebiImportMutation.mutate(selectedListings);
  };

  const getCategoryBadgeColor = (category: string | null) => {
    switch (category) {
      case "Category I": return "bg-blue-500";
      case "Category II": return "bg-purple-500";
      case "Category III": return "bg-orange-500";
      default: return "bg-muted";
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="icon" data-testid="btn-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">AIF Seed Management</h1>
            <p className="text-muted-foreground">
              Manage Alternative Investment Fund master data
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => refetch()}
            data-testid="btn-refresh"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button 
            variant="outline"
            onClick={() => {
              setShowImportDialog(true);
              setImportPreview(null);
              setSelectedForImport(new Set());
            }}
            data-testid="btn-import-sebi"
          >
            <CloudDownload className="w-4 h-4 mr-2" />
            Import from SEBI
          </Button>
          <Button 
            variant="default"
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            onClick={() => {
              setShowSeedDialog(true);
              setSeedPreview(null);
            }}
            data-testid="btn-seed-all"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Seed All AIFs
          </Button>
          <Button data-testid="btn-add-aif">
            <Plus className="w-4 h-4 mr-2" />
            Add AIF
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total AIFs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aifs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Published</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {aifs.filter(a => a.isPublished).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Category I</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {aifs.filter(a => a.category === "Category I").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Category II</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {aifs.filter(a => a.category === "Category II").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Category III</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {aifs.filter(a => a.category === "Category III").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search by name, registration number, or fund house..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs and Table */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-1 mb-4">
            {[
              { value: "all", label: `All (${aifs.length})` },
              { value: "published", label: `Published (${aifs.filter(a => a.isPublished).length})` },
              { value: "unpublished", label: `Unpublished (${aifs.filter(a => !a.isPublished).length})` },
              { value: "category1", label: `Category I (${aifs.filter(a => a.category === "Category I").length})` },
              { value: "category2", label: `Category II (${aifs.filter(a => a.category === "Category II").length})` },
              { value: "category3", label: `Category III (${aifs.filter(a => a.category === "Category III").length})` },
            ].map(tab => (
              <Button
                key={tab.value}
                variant={activeTab === tab.value ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab(tab.value)}
              >
                {tab.label}
              </Button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAifs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Layers className="w-12 h-12 mb-4" />
              <p>No AIFs found</p>
              <p className="text-sm">Import from SEBI or add manually</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Registration No</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Fund House</TableHead>
                    <TableHead>Min Investment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Published</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAifs.map((aif) => (
                    <TableRow key={aif.id}>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {aif.name}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {aif.registrationNo || "—"}
                      </TableCell>
                      <TableCell>
                        {aif.category ? (
                          <Badge className={getCategoryBadgeColor(aif.category)}>
                            {aif.category}
                          </Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell>{aif.fundHouseName || "—"}</TableCell>
                      <TableCell>{formatCurrency(aif.minInvestment)}</TableCell>
                      <TableCell>
                        <Badge variant={aif.fundStatus === "active" ? "default" : "secondary"}>
                          {aif.fundStatus || "active"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={aif.isPublished}
                          onCheckedChange={(checked) => 
                            togglePublishMutation.mutate({ id: aif.id, isPublished: checked })
                          }
                          data-testid={`switch-publish-${aif.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => {
                              setSelectedAif(aif);
                              setShowEditDialog(true);
                            }}
                            data-testid={`btn-edit-${aif.id}`}
                          >
                            <Edit className="w-4 h-4" />
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

      {/* SEBI Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CloudDownload className="w-5 h-5" />
              Import AIFs from SEBI
            </DialogTitle>
            <DialogDescription>
              Import registered Alternative Investment Funds from SEBI's database.
            </DialogDescription>
          </DialogHeader>

          {!importPreview ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <CloudDownload className="w-16 h-16 text-muted-foreground" />
              <p className="text-muted-foreground text-center">
                Fetch registered AIFs from SEBI to import into your database.
              </p>
              <Button 
                onClick={() => previewSebiImportMutation.mutate()}
                disabled={previewSebiImportMutation.isPending}
                data-testid="btn-fetch-sebi"
              >
                {previewSebiImportMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Fetch from SEBI
              </Button>
            </div>
          ) : importPreview.listings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <AlertTriangle className="w-16 h-16 text-yellow-500" />
              <p className="text-muted-foreground text-center">
                No AIF listings found.
              </p>
              {importPreview.errors && importPreview.errors.length > 0 && (
                <div className="text-sm text-destructive max-w-md text-center">
                  {importPreview.errors.slice(0, 2).join(". ")}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between">
                <div className="flex gap-4">
                  <Badge variant="outline" className="text-sm">
                    Total: {importPreview.summary.total}
                  </Badge>
                  <Badge variant="default" className="text-sm bg-green-600">
                    New: {importPreview.summary.new}
                  </Badge>
                  <Badge variant="secondary" className="text-sm">
                    Duplicates: {importPreview.summary.duplicates}
                  </Badge>
                  <Badge variant="outline" className="text-sm">
                    Selected: {selectedForImport.size}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAllNew}>
                    Select All New
                  </Button>
                  <Button variant="outline" size="sm" onClick={clearSelection}>
                    Clear
                  </Button>
                </div>
              </div>

              <ScrollArea className="h-[400px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Select</TableHead>
                      <TableHead>Registration No</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Fund House</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Subcategory</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importPreview.listings.map((listing) => (
                      <TableRow 
                        key={listing.registrationNo}
                        className={listing.isDuplicate ? "opacity-50 bg-muted/50" : ""}
                      >
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedForImport.has(listing.registrationNo)}
                            onChange={() => toggleImportSelection(listing.registrationNo)}
                            disabled={listing.isDuplicate}
                            className="w-4 h-4"
                            data-testid={`checkbox-${listing.registrationNo}`}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {listing.registrationNo}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {listing.name}
                        </TableCell>
                        <TableCell>{listing.fundHouseName}</TableCell>
                        <TableCell>
                          <Badge className={getCategoryBadgeColor(listing.category)}>
                            {listing.category}
                          </Badge>
                        </TableCell>
                        <TableCell>{listing.subcategory || "—"}</TableCell>
                        <TableCell>
                          {listing.isDuplicate ? (
                            <Badge variant="secondary" className="flex items-center gap-1">
                              <XCircle className="w-3 h-3" /> Exists
                            </Badge>
                          ) : (
                            <Badge variant="default" className="flex items-center gap-1 bg-green-600">
                              <CheckCircle2 className="w-3 h-3" /> New
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              {importPreview.errors && importPreview.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>
                    {importPreview.errors.length} error(s) during fetch. Some listings may be incomplete.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowImportDialog(false);
                setImportPreview(null);
                setSelectedForImport(new Set());
              }}
            >
              Cancel
            </Button>
            {importPreview && importPreview.listings.length > 0 && (
              <Button
                onClick={handleImportSelected}
                disabled={selectedForImport.size === 0 || executeSebiImportMutation.isPending}
                data-testid="btn-confirm-import"
              >
                {executeSebiImportMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Import {selectedForImport.size} Selected
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Seed All AIFs Dialog */}
      <Dialog open={showSeedDialog} onOpenChange={setShowSeedDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              Seed All AIFs
            </DialogTitle>
            <DialogDescription>
              Generate and import 100+ comprehensive AIFs with performance data across all categories.
            </DialogDescription>
          </DialogHeader>

          {!seedPreview ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-6">
              <div className="relative">
                <Database className="w-20 h-20 text-muted-foreground" />
                <Sparkles className="w-8 h-8 text-purple-500 absolute -top-2 -right-2" />
              </div>
              <div className="text-center space-y-2 max-w-md">
                <p className="text-lg font-medium">Comprehensive AIF Seed Data</p>
                <p className="text-muted-foreground text-sm">
                  This will generate 100+ Alternative Investment Funds from 35+ fund houses 
                  with complete performance metrics, risk scores, AUM, and NAV data.
                </p>
              </div>
              <div className="flex gap-4 text-sm text-muted-foreground">
                <Badge variant="outline" className="text-blue-600 border-blue-300">Category I: ~30</Badge>
                <Badge variant="outline" className="text-purple-600 border-purple-300">Category II: ~40</Badge>
                <Badge variant="outline" className="text-orange-600 border-orange-300">Category III: ~30</Badge>
              </div>
              <Button 
                onClick={() => previewSeedMutation.mutate()}
                disabled={previewSeedMutation.isPending}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                data-testid="btn-preview-seed"
              >
                {previewSeedMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Preview Seed Data
              </Button>
            </div>
          ) : (
            <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="outline" className="text-sm">
                    Total: {seedPreview.summary.total}
                  </Badge>
                  <Badge variant="default" className="text-sm bg-green-600">
                    New: {seedPreview.summary.new}
                  </Badge>
                  <Badge variant="secondary" className="text-sm">
                    Existing: {seedPreview.summary.duplicates}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-blue-600 border-blue-300">
                    Cat I: {seedPreview.summary.byCategory["Category I"]}
                  </Badge>
                  <Badge variant="outline" className="text-purple-600 border-purple-300">
                    Cat II: {seedPreview.summary.byCategory["Category II"]}
                  </Badge>
                  <Badge variant="outline" className="text-orange-600 border-orange-300">
                    Cat III: {seedPreview.summary.byCategory["Category III"]}
                  </Badge>
                </div>
              </div>

              {seedPreview.summary.new === 0 ? (
                <Alert>
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <AlertDescription>
                    All AIFs already exist in the database. No new AIFs to import.
                  </AlertDescription>
                </Alert>
              ) : (
                <ScrollArea className="h-[350px] border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Registration No</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Fund House</TableHead>
                        <TableHead>Min Inv</TableHead>
                        <TableHead>AUM</TableHead>
                        <TableHead>1Y Return</TableHead>
                        <TableHead>Risk</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {seedPreview.listings.slice(0, 50).map((listing) => (
                        <TableRow 
                          key={listing.registrationNo}
                          className={listing.isDuplicate ? "opacity-50 bg-muted/50" : ""}
                        >
                          <TableCell className="max-w-[180px] truncate font-medium">
                            {listing.name}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {listing.registrationNo}
                          </TableCell>
                          <TableCell>
                            <Badge className={getCategoryBadgeColor(listing.category)}>
                              {listing.category.replace("Category ", "Cat ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[120px] truncate">
                            {listing.fundHouseName}
                          </TableCell>
                          <TableCell>{formatCurrency(listing.minInvestment)}</TableCell>
                          <TableCell>{formatCurrency(listing.aum)}</TableCell>
                          <TableCell className={parseFloat(listing.return1Y) >= 0 ? "text-green-600" : "text-red-600"}>
                            {formatReturn(listing.return1Y)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{listing.riskScore}/10</Badge>
                          </TableCell>
                          <TableCell>
                            {listing.isDuplicate ? (
                              <Badge variant="secondary" className="text-xs">Exists</Badge>
                            ) : (
                              <Badge variant="default" className="text-xs bg-green-600">New</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {seedPreview.listings.length > 50 && (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      Showing 50 of {seedPreview.listings.length} AIFs...
                    </div>
                  )}
                </ScrollArea>
              )}
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowSeedDialog(false);
                setSeedPreview(null);
              }}
            >
              Cancel
            </Button>
            {seedPreview && seedPreview.summary.new > 0 && (
              <Button
                onClick={() => executeSeedAllMutation.mutate()}
                disabled={executeSeedAllMutation.isPending}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                data-testid="btn-confirm-seed"
              >
                {executeSeedAllMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Seed {seedPreview.summary.new} AIFs
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
