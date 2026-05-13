import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format, formatDistanceToNow } from "date-fns";
import {
  FileSignature,
  Settings,
  BarChart3,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  IndianRupee,
  Zap,
  Shield as LucideShield,
  TrendingUp,
  Search,
  Download,
  Users,
  FileText,
  Activity,
  Loader2,
} from "lucide-react";

interface ProviderConfig {
  id: string;
  displayName: string;
  description: string;
  pricingPerSign: number;
  isConfigured: boolean;
  status: 'active' | 'inactive' | 'pending';
  features: string[];
}

interface UsageStats {
  totalRequests: number;
  completedRequests: number;
  pendingRequests: number;
  failedRequests: number;
  byProvider: {
    provider: string;
    count: number;
    successRate: number;
    totalCost: number;
  }[];
  monthlyTrend: {
    month: string;
    requests: number;
    cost: number;
  }[];
}

interface ESignRequest {
  id: string;
  documentName: string;
  documentType: string;
  status: 'pending' | 'signed' | 'expired' | 'declined' | 'partial';
  createdAt: string;
  completedAt?: string;
  agentName: string;
  agentId: string;
  clientName: string;
  provider: string;
  cost?: number;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  signed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  expired: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  declined: "bg-muted text-muted-foreground",
  partial: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

const STATUS_ICONS: Record<string, typeof Clock> = {
  pending: Clock,
  signed: CheckCircle2,
  expired: AlertCircle,
  declined: XCircle,
  partial: RefreshCw,
};

export default function AdminESignManagement() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showPricingDialog, setShowPricingDialog] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [newPrice, setNewPrice] = useState<string>("");

  interface BackendProvider {
    provider: string;
    displayName: string;
    description: string;
    pricingPerSign: number;
    isActive: boolean;
    isConfigured: boolean;
    features: string[];
  }

  const { data: providersData, isLoading: providersLoading } = useQuery<{
    success: boolean;
    activeProvider: string;
    providers: BackendProvider[];
  }, Error, { activeProvider: string; providers: ProviderConfig[] }>({
    queryKey: ['/api/admin/esign/providers'],
    select: (data) => ({
      activeProvider: data.activeProvider,
      providers: (data.providers || []).map(p => ({
        id: p.provider,
        displayName: p.displayName,
        description: p.description,
        pricingPerSign: p.pricingPerSign,
        isConfigured: p.isConfigured,
        status: p.isActive ? 'active' as const : 'inactive' as const,
        features: p.features || [],
      })),
    }),
  });

  const { data: allRequests, isLoading: requestsLoading } = useQuery<ESignRequest[]>({
    queryKey: ['/api/admin/esign/all-requests'],
    placeholderData: [],
  });

  const usageStats: UsageStats = {
    totalRequests: allRequests?.length || 0,
    completedRequests: allRequests?.filter(r => r.status === 'signed').length || 0,
    pendingRequests: allRequests?.filter(r => r.status === 'pending').length || 0,
    failedRequests: allRequests?.filter(r => r.status === 'expired' || r.status === 'declined').length || 0,
    byProvider: Object.entries(
      (allRequests || []).reduce((acc, r) => {
        const provider = r.provider || 'unknown';
        if (!acc[provider]) acc[provider] = { count: 0, signed: 0, cost: 0 };
        acc[provider].count++;
        if (r.status === 'signed') acc[provider].signed++;
        acc[provider].cost += r.cost || 0;
        return acc;
      }, {} as Record<string, { count: number; signed: number; cost: number }>)
    ).map(([provider, data]) => ({
      provider,
      count: data.count,
      successRate: data.count > 0 ? Math.round((data.signed / data.count) * 100) : 0,
      totalCost: data.cost,
    })),
    monthlyTrend: [],
  };
  const statsLoading = requestsLoading;

  const { data: cheapestData } = useQuery<{
    success: boolean;
    cheapestProvider: string;
    config: BackendProvider;
    recommendation: string;
  }, Error, { cheapestProvider: string; config: ProviderConfig; recommendation: string }>({
    queryKey: ['/api/admin/esign/cheapest-provider'],
    select: (data) => ({
      cheapestProvider: data.cheapestProvider,
      recommendation: data.recommendation,
      config: data.config ? {
        id: data.config.provider,
        displayName: data.config.displayName,
        description: data.config.description,
        pricingPerSign: data.config.pricingPerSign,
        isConfigured: data.config.isConfigured,
        status: data.config.isActive ? 'active' as const : 'inactive' as const,
        features: data.config.features || [],
      } : undefined as any,
    }),
  });

  const setProviderMutation = useMutation({
    mutationFn: async (provider: string) => {
      return apiRequest('/api/admin/esign/set-provider', {
        method: 'POST',
        body: JSON.stringify({ provider }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/esign/providers'] });
      toast({
        title: "Provider Updated",
        description: "Active eSign provider has been changed successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update provider. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updatePricingMutation = useMutation({
    mutationFn: async ({ provider, pricePerSign }: { provider: string; pricePerSign: number }) => {
      return apiRequest('/api/admin/esign/update-pricing', {
        method: 'POST',
        body: JSON.stringify({ provider, pricePerSign }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/esign/providers'] });
      setShowPricingDialog(false);
      toast({
        title: "Pricing Updated",
        description: "Provider pricing has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update pricing. Please try again.",
        variant: "destructive",
      });
    },
  });

  const filteredRequests = (allRequests || []).filter(req => {
    const matchesSearch = req.documentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.agentName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || req.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleUpdatePricing = () => {
    const price = parseFloat(newPrice);
    if (isNaN(price) || price < 0) {
      toast({
        title: "Invalid Price",
        description: "Please enter a valid price.",
        variant: "destructive",
      });
      return;
    }
    updatePricingMutation.mutate({ provider: selectedProvider, pricePerSign: price });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSignature className="h-6 w-6 text-primary" />
            eSign Management
          </h1>
          <p className="text-muted-foreground">
            Manage eSign providers, monitor usage, and track all document signing requests
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <ScrollableTabsList>
          <TabsTrigger value="overview" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="providers" className="gap-2">
            <Settings className="h-4 w-4" />
            Providers
          </TabsTrigger>
          <TabsTrigger value="requests" className="gap-2">
            <FileText className="h-4 w-4" />
            All Requests
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </ScrollableTabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
                <FileSignature className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{usageStats?.totalRequests || 0}</div>
                <p className="text-xs text-muted-foreground">All time eSign requests</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">{usageStats?.completedRequests || 0}</div>
                <p className="text-xs text-muted-foreground">Successfully signed</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
                <Clock className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">{usageStats?.pendingRequests || 0}</div>
                <p className="text-xs text-muted-foreground">Awaiting signatures</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Active Provider</CardTitle>
                <Zap className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold capitalize">{providersData?.activeProvider || '-'}</div>
                <p className="text-xs text-muted-foreground">Currently in use</p>
              </CardContent>
            </Card>
          </div>

          {cheapestData && cheapestData.cheapestProvider !== providersData?.activeProvider && (
            <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20">
              <CardHeader>
                <CardTitle className="text-amber-700 dark:text-amber-400 flex items-center gap-2">
                  <IndianRupee className="h-5 w-5" />
                  Cost Optimization Opportunity
                </CardTitle>
                <CardDescription>{cheapestData.recommendation}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  onClick={() => setProviderMutation.mutate(cheapestData.cheapestProvider)}
                  disabled={setProviderMutation.isPending}
                >
                  {setProviderMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Switch to {cheapestData.config?.displayName}
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Provider Usage</CardTitle>
                <CardDescription>Requests by provider</CardDescription>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(usageStats?.byProvider || []).map((provider) => (
                      <div key={provider.provider} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium capitalize">{provider.provider}</span>
                          <span className="text-muted-foreground">{provider.count} requests</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{
                                width: `${(provider.count / (usageStats?.totalRequests || 1)) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-12">
                            {provider.successRate}%
                          </span>
                        </div>
                      </div>
                    ))}
                    {(!usageStats?.byProvider || usageStats.byProvider.length === 0) && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No provider usage data available
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest eSign requests</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(allRequests || []).slice(0, 5).map((req) => {
                    const StatusIcon = STATUS_ICONS[req.status] || Clock;
                    return (
                      <div key={req.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <StatusIcon className="h-4 w-4" />
                          <span className="truncate max-w-[150px]">{req.documentName}</span>
                        </div>
                        <Badge className={STATUS_COLORS[req.status]}>{req.status}</Badge>
                      </div>
                    );
                  })}
                  {(!allRequests || allRequests.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No recent activity
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="providers" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {providersLoading ? (
              <div className="col-span-full flex items-center justify-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              (providersData?.providers || []).map((provider) => (
                <Card key={provider.id} className={provider.id === providersData?.activeProvider ? 'border-primary' : ''}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{provider.displayName}</CardTitle>
                      {provider.id === providersData?.activeProvider && (
                        <Badge className="bg-primary">Active</Badge>
                      )}
                    </div>
                    <CardDescription>{provider.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Price per sign</span>
                      <span className="font-semibold flex items-center">
                        <IndianRupee className="h-3 w-3" />
                        {provider.pricingPerSign}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <Badge variant={provider.isConfigured ? "default" : "secondary"}>
                        {provider.isConfigured ? "Configured" : "Not Configured"}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <span className="text-sm text-muted-foreground">Features</span>
                      <div className="flex flex-wrap gap-1">
                        {provider.features?.map((feature, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {feature}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      {provider.id !== providersData?.activeProvider && provider.isConfigured && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => setProviderMutation.mutate(provider.id)}
                          disabled={setProviderMutation.isPending}
                        >
                          Set Active
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedProvider(provider.id);
                          setNewPrice(provider.pricingPerSign.toString());
                          setShowPricingDialog(true);
                        }}
                      >
                        Edit Pricing
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>All eSign Requests</CardTitle>
                  <CardDescription>View and manage all eSign requests across agents</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search requests..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-64"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="signed">Signed</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="declined">Declined</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {requestsLoading ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <FileSignature className="h-12 w-12 mb-2 opacity-50" />
                  <p>No eSign requests found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Document</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Agent</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRequests.map((request) => {
                        const StatusIcon = STATUS_ICONS[request.status] || Clock;
                        return (
                          <TableRow key={request.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium truncate max-w-[200px]">
                                  {request.documentName}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>{request.clientName}</TableCell>
                            <TableCell>{request.agentName}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {request.provider}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={STATUS_COLORS[request.status]}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {request.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                            </TableCell>
                            <TableCell className="text-right">
                              {request.cost ? (
                                <span className="flex items-center justify-end">
                                  <IndianRupee className="h-3 w-3" />
                                  {request.cost}
                                </span>
                              ) : '-'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {usageStats?.totalRequests ? 
                    Math.round((usageStats.completedRequests / usageStats.totalRequests) * 100) : 0}%
                </div>
                <p className="text-xs text-muted-foreground">Overall completion rate</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
                <IndianRupee className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(usageStats?.byProvider || []).reduce((acc, p) => acc + p.totalCost, 0).toLocaleString('en-IN')}
                </div>
                <p className="text-xs text-muted-foreground">Total eSign spend</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Avg Cost/Sign</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {usageStats?.completedRequests ? 
                    Math.round((usageStats.byProvider || []).reduce((acc, p) => acc + p.totalCost, 0) / usageStats.completedRequests) : 0}
                </div>
                <p className="text-xs text-muted-foreground">Per completed signature</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Monthly Trend</CardTitle>
              <CardDescription>eSign requests and cost over time</CardDescription>
            </CardHeader>
            <CardContent>
              {(usageStats?.monthlyTrend || []).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mb-2 opacity-50" />
                  <p>No trend data available yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(usageStats?.monthlyTrend || []).map((month) => (
                    <div key={month.month} className="flex items-center justify-between">
                      <span className="font-medium">{month.month}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">{month.requests} requests</span>
                        <span className="font-medium flex items-center">
                          <IndianRupee className="h-3 w-3" />
                          {month.cost.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showPricingDialog} onOpenChange={setShowPricingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Provider Pricing</DialogTitle>
            <DialogDescription>
              Set the cost per signature for this provider
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Price per Sign (INR)</Label>
              <Input
                type="number"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="Enter price"
                min="0"
                step="0.01"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPricingDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdatePricing} disabled={updatePricingMutation.isPending}>
              {updatePricingMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Pricing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
