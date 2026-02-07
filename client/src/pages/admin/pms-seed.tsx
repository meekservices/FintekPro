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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  RefreshCw, Search, Loader2, ArrowLeft, Building2, Layers, 
  TrendingUp, AlertTriangle, Plus, Edit,
  CloudDownload, CheckCircle2, XCircle, Database, Sparkles
} from "lucide-react";
import { Link } from "wouter";

interface PmsMaster {
  id: string;
  name: string;
  registrationNo: string | null;
  strategy: string | null;
  style: string | null;
  fundHouseName: string | null;
  sponsor: string | null;
  minInvestment: string | null;
  lockIn: string | null;
  benchmark: string | null;
  feeStructure: string | null;
  managementFee: string | null;
  performanceFee: string | null;
  fundStatus: string | null;
  isPublished: boolean;
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

interface SebiPmsListing {
  registrationNo: string;
  name: string;
  fundHouseName: string;
  strategy: string | null;
  style: string | null;
  sponsor: string | null;
  inceptionDate: string | null;
  city: string | null;
  source: string;
  isDuplicate?: boolean;
}

interface ImportPreview {
  success: boolean;
  listings: SebiPmsListing[];
  summary: {
    total: number;
    new: number;
    duplicates: number;
  };
  errors: string[];
}

interface SeedPreview {
  success: boolean;
  listings: Array<SebiPmsListing & {
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
    byStrategy: Record<string, number>;
  };
}

function formatReturn(value: string | null | undefined): string {
  if (!value) return "—";
  const num = parseFloat(value);
  if (isNaN(num)) return "—";
  return `${num >= 0 ? "+" : ""}${num.toFixed(2)}%`;
}

function getStrategyBadgeColor(strategy: string | null): string {
  switch (strategy) {
    case "Large-cap": return "bg-blue-500 text-white";
    case "Multi-cap": return "bg-purple-500 text-white";
    case "Mid-cap": return "bg-indigo-500 text-white";
    case "Small-cap": return "bg-pink-500 text-white";
    case "Flexi-cap": return "bg-cyan-500 text-white";
    case "Focused": return "bg-orange-500 text-white";
    case "Value": return "bg-green-600 text-white";
    case "Thematic": return "bg-amber-600 text-white";
    default: return "bg-muted text-foreground";
  }
}

function formatCurrency(value: string | null | undefined): string {
  if (!value) return "—";
  const num = parseFloat(value);
  if (isNaN(num)) return "—";
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  return `₹${num.toLocaleString("en-IN")}`;
}

export default function PmsSeedPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [selectedForImport, setSelectedForImport] = useState<Set<string>>(new Set());
  const [showSeedDialog, setShowSeedDialog] = useState(false);
  const [seedPreview, setSeedPreview] = useState<SeedPreview | null>(null);

  // Fetch all PMS for admin
  const { data: pmsData, isLoading, refetch } = useQuery<{ schemes: PmsMaster[] }>({
    queryKey: ["/api/store/pms/admin"],
  });

  const pmsList = pmsData?.schemes || [];

  // Filter PMS based on search and tab
  const filteredPms = pmsList.filter(pms => {
    const matchesSearch = !searchQuery || 
      pms.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pms.registrationNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pms.fundHouseName?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesTab = activeTab === "all" ||
      (activeTab === "published" && pms.isPublished) ||
      (activeTab === "unpublished" && !pms.isPublished) ||
      (activeTab === "multicap" && pms.strategy === "Multi-cap") ||
      (activeTab === "largecap" && pms.strategy === "Large-cap") ||
      (activeTab === "focused" && pms.strategy === "Focused");
    
    return matchesSearch && matchesTab;
  });

  // Toggle publish status
  const togglePublishMutation = useMutation({
    mutationFn: async ({ id, isPublished }: { id: string; isPublished: boolean }) => {
      const response = await apiRequest(`/api/store/pms/${id}/publish`, {
        method: "PATCH",
        body: JSON.stringify({ isPublished }),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/store/pms/admin"] });
      toast({ title: "Success", description: "PMS status updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Preview SEBI import
  const previewSebiImportMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/store/pms/sebi/preview", {
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
    mutationFn: async (listings: SebiPmsListing[]) => {
      const response = await apiRequest("/api/store/pms/sebi/import", {
        method: "POST",
        body: JSON.stringify({ listings }),
      });
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/store/pms/admin"] });
      toast({ 
        title: "Import Complete", 
        description: `Imported ${data.summary.imported} PMS. ${data.summary.skipped} skipped.` 
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
      const response = await apiRequest("/api/store/pms/seed/preview", {
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
      const response = await apiRequest("/api/store/pms/seed/all", {
        method: "POST",
      });
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/store/pms/admin"] });
      toast({ 
        title: "Seeding Complete", 
        description: `Successfully seeded ${data.summary.imported} PMS across all strategies.` 
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

  const getStrategyBadgeColor = (strategy: string | null) => {
    switch (strategy) {
      case "Multi-cap": return "bg-blue-500";
      case "Large-cap": return "bg-green-500";
      case "Mid-cap": return "bg-yellow-500";
      case "Small-cap": return "bg-orange-500";
      case "Focused": return "bg-purple-500";
      case "Thematic": return "bg-pink-500";
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
            <h1 className="text-2xl font-bold">PMS Seed Management</h1>
            <p className="text-muted-foreground">
              Manage Portfolio Management Services master data
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
            Seed All PMS
          </Button>
          <Button data-testid="btn-add-pms">
            <Plus className="w-4 h-4 mr-2" />
            Add PMS
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total PMS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pmsList.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Published</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {pmsList.filter(p => p.isPublished).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Multi-cap</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {pmsList.filter(p => p.strategy === "Multi-cap").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Large-cap</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {pmsList.filter(p => p.strategy === "Large-cap").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Focused</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {pmsList.filter(p => p.strategy === "Focused").length}
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
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">All ({pmsList.length})</TabsTrigger>
              <TabsTrigger value="published">Published</TabsTrigger>
              <TabsTrigger value="unpublished">Unpublished</TabsTrigger>
              <TabsTrigger value="multicap">Multi-cap</TabsTrigger>
              <TabsTrigger value="largecap">Large-cap</TabsTrigger>
              <TabsTrigger value="focused">Focused</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredPms.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Layers className="w-12 h-12 mb-4" />
                  <p>No PMS found</p>
                  <p className="text-sm">Import from SEBI or add manually</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Registration No</TableHead>
                        <TableHead>Strategy</TableHead>
                        <TableHead>Style</TableHead>
                        <TableHead>Fund House</TableHead>
                        <TableHead>Min Investment</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Published</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPms.map((pms) => (
                        <TableRow key={pms.id}>
                          <TableCell className="font-medium max-w-[200px] truncate">
                            {pms.name}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {pms.registrationNo || "—"}
                          </TableCell>
                          <TableCell>
                            {pms.strategy ? (
                              <Badge className={getStrategyBadgeColor(pms.strategy)}>
                                {pms.strategy}
                              </Badge>
                            ) : "—"}
                          </TableCell>
                          <TableCell>{pms.style || "—"}</TableCell>
                          <TableCell>{pms.fundHouseName || "—"}</TableCell>
                          <TableCell>{formatCurrency(pms.minInvestment)}</TableCell>
                          <TableCell>
                            <Badge variant={pms.fundStatus === "active" ? "default" : "secondary"}>
                              {pms.fundStatus || "active"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={pms.isPublished}
                              onCheckedChange={(checked) => 
                                togglePublishMutation.mutate({ id: pms.id, isPublished: checked })
                              }
                              data-testid={`switch-publish-${pms.id}`}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                data-testid={`btn-edit-${pms.id}`}
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
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* SEBI Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CloudDownload className="w-5 h-5" />
              Import PMS from SEBI
            </DialogTitle>
            <DialogDescription>
              Import registered Portfolio Management Services from SEBI's database.
            </DialogDescription>
          </DialogHeader>

          {!importPreview ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <CloudDownload className="w-16 h-16 text-muted-foreground" />
              <p className="text-muted-foreground text-center">
                Fetch registered PMS from SEBI to import into your database.
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
                No PMS listings found.
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
                      <TableHead>Strategy</TableHead>
                      <TableHead>Style</TableHead>
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
                          <Badge className={getStrategyBadgeColor(listing.strategy)}>
                            {listing.strategy || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell>{listing.style || "—"}</TableCell>
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

      {/* Seed All PMS Dialog */}
      <Dialog open={showSeedDialog} onOpenChange={setShowSeedDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              Seed All PMS
            </DialogTitle>
            <DialogDescription>
              Generate and import 80+ comprehensive PMS with performance data across all strategies.
            </DialogDescription>
          </DialogHeader>

          {!seedPreview ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-6">
              <div className="relative">
                <Database className="w-20 h-20 text-muted-foreground" />
                <Sparkles className="w-8 h-8 text-purple-500 absolute -top-2 -right-2" />
              </div>
              <div className="text-center space-y-2 max-w-md">
                <p className="text-lg font-medium">Comprehensive PMS Seed Data</p>
                <p className="text-muted-foreground text-sm">
                  This will generate 80+ Portfolio Management Services from 30+ fund houses 
                  with complete performance metrics, AUM, NAV, and risk data.
                </p>
              </div>
              <div className="flex gap-2 flex-wrap justify-center text-sm text-muted-foreground">
                <Badge variant="outline" className="text-blue-600 border-blue-300">Large-cap</Badge>
                <Badge variant="outline" className="text-purple-600 border-purple-300">Multi-cap</Badge>
                <Badge variant="outline" className="text-indigo-600 border-indigo-300">Mid-cap</Badge>
                <Badge variant="outline" className="text-orange-600 border-orange-300">Focused</Badge>
                <Badge variant="outline" className="text-green-600 border-green-300">Value</Badge>
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
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(seedPreview.summary.byStrategy || {})
                    .filter(([_, count]) => count > 0)
                    .slice(0, 5)
                    .map(([strategy, count]) => (
                      <Badge key={strategy} variant="outline" className={getStrategyBadgeColor(strategy).replace("text-foreground", "").replace("bg-", "text-").replace("-500", "-600") + " border-current"}>
                        {strategy}: {count}
                      </Badge>
                    ))
                  }
                </div>
              </div>

              {seedPreview.summary.new === 0 ? (
                <Alert>
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <AlertDescription>
                    All PMS already exist in the database. No new PMS to import.
                  </AlertDescription>
                </Alert>
              ) : (
                <ScrollArea className="h-[350px] border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Registration No</TableHead>
                        <TableHead>Strategy</TableHead>
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
                            <Badge className={getStrategyBadgeColor(listing.strategy)}>
                              {listing.strategy}
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
                      Showing 50 of {seedPreview.listings.length} PMS...
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
                Seed {seedPreview.summary.new} PMS
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
