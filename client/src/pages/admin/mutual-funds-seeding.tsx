import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Building2, Search, Loader2, ArrowLeft, 
  Shield, TrendingUp, CheckCircle2, XCircle, RefreshCw,
  Eye, EyeOff, FileText
} from "lucide-react";
import { Link } from "wouter";

interface Amc {
  id: string;
  name: string;
  displayName?: string;
  logoUrl?: string;
  regularPlansEnabled: boolean;
  directPlansEnabled: boolean;
  totalSchemes: number;
  publishedRegularSchemes: number;
  publishedDirectSchemes: number;
  lastToggledAt?: string;
  lastToggledBy?: string;
}

interface Scheme {
  id: string;
  schemeCode: string;
  schemeName: string;
  category?: string;
  fundHouse?: string;
  nav?: string;
  riskLevel?: string;
  returns1y?: string;
  returns3y?: string;
  returns5y?: string;
  planType?: string;
  isPublished?: boolean;
  publishedAt?: string;
  publishedBy?: string;
}

export default function MutualFundsSeeding() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("amcs");
  const [amcSearchQuery, setAmcSearchQuery] = useState("");
  const [schemeSearchQuery, setSchemeSearchQuery] = useState("");
  const [selectedAmcId, setSelectedAmcId] = useState<string>("all");
  const [publishedFilter, setPublishedFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Fetch AMCs
  const { data: amcsData, isLoading: isLoadingAmcs } = useQuery<{ amcs: Amc[] }>({
    queryKey: ['/api/admin/amcs'],
  });

  // Fetch Regular schemes
  const { data: schemesData, isLoading: isLoadingSchemes } = useQuery<{ schemes: Scheme[], pagination: any }>({
    queryKey: ['/api/admin/regular-schemes', selectedAmcId, publishedFilter, categoryFilter, schemeSearchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedAmcId !== 'all') params.append('amcId', selectedAmcId);
      if (publishedFilter !== 'all') params.append('published', publishedFilter);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (schemeSearchQuery) params.append('search', schemeSearchQuery);
      params.append('limit', '100');
      
      const res = await fetch(`/api/admin/regular-schemes?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch schemes');
      return res.json();
    },
  });

  const amcs: Amc[] = amcsData?.amcs || [];
  const schemes: Scheme[] = schemesData?.schemes || [];

  // Filter AMCs by search
  const filteredAmcs = amcs.filter(amc => 
    amc.name?.toLowerCase().includes(amcSearchQuery.toLowerCase()) ||
    amc.displayName?.toLowerCase().includes(amcSearchQuery.toLowerCase())
  );

  // Get unique categories from schemes
  const categories = Array.from(new Set(schemes.map(s => s.category).filter(Boolean))) as string[];

  // Calculate stats
  const totalAmcs = amcs.length;
  const enabledAmcs = amcs.filter(a => a.regularPlansEnabled).length;
  const totalSchemes = schemes.length;
  const publishedSchemes = schemes.filter(s => s.isPublished).length;

  // Toggle AMC mutation
  const toggleAmcMutation = useMutation({
    mutationFn: async ({ id, regularPlansEnabled }: { id: string; regularPlansEnabled: boolean }) => {
      const res = await apiRequest(`/api/admin/amcs/${id}/toggle`, {
        method: 'PUT',
        body: JSON.stringify({ regularPlansEnabled, adminId: 'admin' }),
      });
      return res;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/amcs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/regular-schemes'] });
      toast({ 
        title: data.amc?.regularPlansEnabled ? "AMC Enabled" : "AMC Disabled",
        description: data.message 
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to toggle AMC", variant: "destructive" });
    },
  });

  // Publish/Unpublish scheme mutation
  const toggleSchemeMutation = useMutation({
    mutationFn: async ({ schemeCode, isPublished }: { schemeCode: string; isPublished: boolean }) => {
      const res = await apiRequest(`/api/admin/schemes/${schemeCode}/publish`, {
        method: 'PUT',
        body: JSON.stringify({ isPublished, adminId: 'admin' }),
      });
      return res;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/regular-schemes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/amcs'] });
      toast({ 
        title: data.scheme?.isPublished ? "Scheme Published" : "Scheme Unpublished",
        description: data.message 
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update scheme", variant: "destructive" });
    },
  });

  // Sync AMCs mutation
  const syncAmcsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('/api/admin/amcs/sync', { method: 'POST' });
      return res;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/amcs'] });
      toast({ title: "Sync Complete", description: data.message });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to sync AMCs", variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="sm" data-testid="link-back-admin">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Admin
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Regular Mutual Fund Seeding</h1>
              <p className="text-gray-500 dark:text-gray-400">Seed and manage Regular Plans for Mutual Funds. Direct plans managed separately.</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => syncAmcsMutation.mutate()}
            disabled={syncAmcsMutation.isPending}
            data-testid="button-sync-amcs"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncAmcsMutation.isPending ? 'animate-spin' : ''}`} />
            Sync AMCs
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card data-testid="card-total-amcs">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Total AMCs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalAmcs}</div>
            </CardContent>
          </Card>
          <Card data-testid="card-enabled-amcs">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Enabled AMCs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{enabledAmcs}</div>
              <p className="text-xs text-gray-500">Regular plans active</p>
            </CardContent>
          </Card>
          <Card data-testid="card-total-schemes">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Total Regular Schemes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSchemes}</div>
            </CardContent>
          </Card>
          <Card data-testid="card-published-schemes">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                <Eye className="h-4 w-4 text-blue-600" />
                Published Schemes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{publishedSchemes}</div>
              <p className="text-xs text-gray-500">Visible to clients</p>
            </CardContent>
          </Card>
        </div>

        {/* Info Alert */}
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <strong>AMC Toggle Behavior:</strong> When an AMC toggle is turned ON, all Regular schemes under that AMC become published and visible to clients. 
            When OFF, all schemes are unpublished. You can override individual schemes only when the AMC toggle is ON.
          </AlertDescription>
        </Alert>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="amcs" data-testid="tab-amcs">
              <Building2 className="h-4 w-4 mr-2" />
              AMC-Level Controls
            </TabsTrigger>
            <TabsTrigger value="schemes" data-testid="tab-schemes">
              <FileText className="h-4 w-4 mr-2" />
              Scheme-Level Controls
            </TabsTrigger>
          </TabsList>

          {/* Section A: AMC-Level Controls */}
          <TabsContent value="amcs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>AMC-Level Publishing Controls</CardTitle>
                <CardDescription>Enable or disable all Regular mutual fund schemes per AMC</CardDescription>
              </CardHeader>
              <CardContent>
                {/* AMC Search */}
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search AMCs..."
                      value={amcSearchQuery}
                      onChange={(e) => setAmcSearchQuery(e.target.value)}
                      className="pl-10"
                      data-testid="input-search-amcs"
                    />
                  </div>
                </div>

                {isLoadingAmcs ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : filteredAmcs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No AMCs found. Click "Sync AMCs" to populate from mutual fund data.
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[300px]">AMC Name</TableHead>
                          <TableHead className="text-center">Total Schemes</TableHead>
                          <TableHead className="text-center">Published</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                          <TableHead className="text-center">Toggle</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAmcs.map((amc) => (
                          <TableRow key={amc.id} data-testid={`row-amc-${amc.id}`}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-gray-400" />
                                {amc.displayName || amc.name}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">{amc.totalSchemes}</TableCell>
                            <TableCell className="text-center">
                              <span className={amc.publishedRegularSchemes > 0 ? "text-green-600 font-medium" : "text-gray-400"}>
                                {amc.publishedRegularSchemes}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              {amc.regularPlansEnabled ? (
                                <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Enabled
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Disabled
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <Switch
                                checked={amc.regularPlansEnabled}
                                onCheckedChange={(checked) => {
                                  toggleAmcMutation.mutate({ id: amc.id, regularPlansEnabled: checked });
                                }}
                                disabled={toggleAmcMutation.isPending}
                                data-testid={`switch-amc-${amc.id}`}
                              />
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

          {/* Section B: Scheme-Level Controls */}
          <TabsContent value="schemes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Scheme-Level Publishing Controls</CardTitle>
                <CardDescription>View and manage individual Regular mutual fund schemes</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Filters */}
                <div className="flex flex-wrap gap-4 mb-4">
                  <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Search by scheme name, code, or AMC..."
                        value={schemeSearchQuery}
                        onChange={(e) => setSchemeSearchQuery(e.target.value)}
                        className="pl-10"
                        data-testid="input-search-schemes"
                      />
                    </div>
                  </div>
                  <Select value={selectedAmcId} onValueChange={setSelectedAmcId}>
                    <SelectTrigger className="w-[200px]" data-testid="select-amc-filter">
                      <SelectValue placeholder="Filter by AMC" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All AMCs</SelectItem>
                      {amcs.map((amc) => (
                        <SelectItem key={amc.id} value={amc.id}>{amc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={publishedFilter} onValueChange={setPublishedFilter}>
                    <SelectTrigger className="w-[150px]" data-testid="select-published-filter">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="true">Published</SelectItem>
                      <SelectItem value="false">Unpublished</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[180px]" data-testid="select-category-filter">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat || 'unknown'}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {isLoadingSchemes ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : schemes.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No Regular schemes found. Try adjusting your filters or sync AMC data first.
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[350px]">Scheme Name</TableHead>
                          <TableHead>Code</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>AMC</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                          <TableHead className="text-center">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {schemes.map((scheme) => {
                          const amc = amcs.find(a => a.name === scheme.fundHouse);
                          const amcEnabled = amc?.regularPlansEnabled ?? false;
                          
                          return (
                            <TableRow key={scheme.id} data-testid={`row-scheme-${scheme.schemeCode}`}>
                              <TableCell className="font-medium">
                                <div className="max-w-[350px] truncate" title={scheme.schemeName}>
                                  {scheme.schemeName}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-gray-500">{scheme.schemeCode}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {scheme.category || 'N/A'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm">{scheme.fundHouse}</TableCell>
                              <TableCell className="text-center">
                                {scheme.isPublished ? (
                                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                                    <Eye className="h-3 w-3 mr-1" />
                                    Published
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                                    <EyeOff className="h-3 w-3 mr-1" />
                                    Unpublished
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {scheme.isPublished ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleSchemeMutation.mutate({ 
                                      schemeCode: scheme.schemeCode, 
                                      isPublished: false 
                                    })}
                                    disabled={toggleSchemeMutation.isPending}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    data-testid={`button-unpublish-${scheme.schemeCode}`}
                                  >
                                    <EyeOff className="h-4 w-4 mr-1" />
                                    Unpublish
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleSchemeMutation.mutate({ 
                                      schemeCode: scheme.schemeCode, 
                                      isPublished: true 
                                    })}
                                    disabled={toggleSchemeMutation.isPending || !amcEnabled}
                                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                    title={!amcEnabled ? "Enable AMC toggle first to publish schemes" : "Publish this scheme"}
                                    data-testid={`button-publish-${scheme.schemeCode}`}
                                  >
                                    <Eye className="h-4 w-4 mr-1" />
                                    Publish
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}

                {schemesData?.pagination && schemesData.pagination.total > 0 && (
                  <div className="mt-4 text-sm text-gray-500 text-center">
                    Showing {schemes.length} of {schemesData.pagination.total} Regular schemes
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
