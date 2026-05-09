import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  Activity, 
  TrendingUp, 
  DollarSign, 
  BarChart3, 
  Edit, 
  RefreshCw,
  IndianRupee,
  Calendar,
  AlertCircle
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

interface ProviderPricing {
  providerName: string;
  displayName: string;
  description?: string;
  costPerCall: number;
  currency: string;
}

interface UsageStats {
  provider: string;
  displayName: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  costPerCall: number;
  totalCost: number;
  currency: string;
}

interface MonthlyEstimate {
  month: string;
  totalCalls: number;
  totalCost: number;
  byProvider: UsageStats[];
  projectedMonthEnd: number;
}

interface DailyUsage {
  date: string;
  calls: number;
  cost: number;
}

export default function AdminApiUsage() {
  const { toast } = useToast();
  const [editingProvider, setEditingProvider] = useState<ProviderPricing | null>(null);
  const [newCost, setNewCost] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: providersData, isLoading: loadingProviders, refetch: refetchProviders } = useQuery<{ success: boolean; providers: ProviderPricing[] }>({
    queryKey: ['/api/admin/api-usage/providers'],
  });

  const { data: estimateData, isLoading: loadingEstimate, refetch: refetchEstimate } = useQuery<MonthlyEstimate & { success: boolean }>({
    queryKey: ['/api/admin/api-usage/monthly-estimate'],
  });

  const { data: dailyData, isLoading: loadingDaily } = useQuery<{ success: boolean; dailyUsage: DailyUsage[] }>({
    queryKey: ['/api/admin/api-usage/daily'],
  });

  const updatePricingMutation = useMutation({
    mutationFn: async (data: { providerName: string; costPerCall: number }) => {
      return apiRequest('/api/admin/api-usage/pricing', {
        method: 'PATCH',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      toast({ title: "Pricing Updated", description: "Provider pricing has been updated successfully." });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/api-usage/providers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/api-usage/monthly-estimate'] });
      setDialogOpen(false);
      setEditingProvider(null);
      setNewCost("");
    },
    onError: (error: any) => {
      toast({ 
        title: "Update Failed", 
        description: error.message || "Failed to update pricing",
        variant: "destructive" 
      });
    },
  });

  const handleEditPricing = (provider: ProviderPricing) => {
    setEditingProvider(provider);
    setNewCost(provider.costPerCall.toString());
    setDialogOpen(true);
  };

  const handleSavePricing = () => {
    if (!editingProvider || !newCost) return;
    updatePricingMutation.mutate({
      providerName: editingProvider.providerName,
      costPerCall: parseFloat(newCost),
    });
  };

  const refreshAll = () => {
    refetchProviders();
    refetchEstimate();
  };

  const providers = providersData?.providers || [];
  const monthlyEstimate = estimateData;
  const dailyUsage = dailyData?.dailyUsage || [];

  const totalMonthlySpend = monthlyEstimate?.totalCost || 0;
  const projectedSpend = monthlyEstimate?.projectedMonthEnd || 0;
  const totalCalls = monthlyEstimate?.totalCalls || 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">API Usage & Cost Tracking</h1>
            <p className="text-muted-foreground mt-1">
              Monitor API usage across all providers and manage per-call pricing
            </p>
          </div>
          <Button onClick={refreshAll} variant="outline" data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Month-to-Date Spend</CardTitle>
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-mtd-spend">₹{totalMonthlySpend.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">{monthlyEstimate?.month || 'Current Month'}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Projected Month-End</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-projected-spend">₹{projectedSpend.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Based on current usage rate</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total API Calls</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-calls">{totalCalls.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">This month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Providers</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-provider-count">{providers.length}</div>
              <p className="text-xs text-muted-foreground">Configured APIs</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Daily Usage Trend</CardTitle>
              <CardDescription>API calls and costs over the last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              {dailyUsage.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dailyUsage}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}
                      formatter={(value: number, name: string) => [
                        name === 'cost' ? `₹${value.toFixed(2)}` : value,
                        name === 'cost' ? 'Cost' : 'Calls'
                      ]}
                    />
                    <Line yAxisId="left" type="monotone" dataKey="calls" stroke="#8884d8" name="calls" />
                    <Line yAxisId="right" type="monotone" dataKey="cost" stroke="#82ca9d" name="cost" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  <div className="text-center">
                    <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No usage data available yet</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cost by Provider</CardTitle>
              <CardDescription>Monthly spend breakdown by API provider</CardDescription>
            </CardHeader>
            <CardContent>
              {monthlyEstimate?.byProvider && monthlyEstimate.byProvider.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyEstimate.byProvider}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="displayName" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number) => [`₹${value.toFixed(2)}`, 'Cost']}
                    />
                    <Bar dataKey="totalCost" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  <div className="text-center">
                    <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No usage data available yet</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>API Provider Pricing</CardTitle>
            <CardDescription>
              Configure the cost per API call for each provider. These rates are used to calculate estimated monthly expenditure.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingProviders ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Cost per Call</TableHead>
                    <TableHead className="text-right">MTD Calls</TableHead>
                    <TableHead className="text-right">MTD Cost</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {providers.map((provider) => {
                    const usageStats = monthlyEstimate?.byProvider?.find(
                      (s) => s.provider.toLowerCase() === provider.providerName.toLowerCase()
                    );
                    return (
                      <TableRow key={provider.providerName} data-testid={`row-provider-${provider.providerName}`}>
                        <TableCell className="font-medium">
                          {provider.displayName}
                          <Badge variant="outline" className="ml-2 text-xs">
                            {provider.providerName}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {provider.description || '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ₹{provider.costPerCall.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          {usageStats?.totalCalls?.toLocaleString() || '0'}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ₹{usageStats?.totalCost?.toFixed(2) || '0.00'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditPricing(provider)}
                            data-testid={`button-edit-${provider.providerName}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-5 w-5" />
              Important Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-amber-700 dark:text-amber-400 space-y-2">
            <p>• API usage is tracked automatically when external services are called.</p>
            <p>• Costs are estimated based on the per-call rates you configure here.</p>
            <p>• Actual billing may vary based on your agreements with each provider.</p>
            <p>• Update pricing regularly to maintain accurate cost projections.</p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Provider Pricing</DialogTitle>
            <DialogDescription>
              Set the cost per API call for {editingProvider?.displayName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cost">Cost per Call (₹)</Label>
              <Input
                id="cost"
                type="number"
                step="0.01"
                min="0"
                value={newCost}
                onChange={(e) => setNewCost(e.target.value)}
                placeholder="Enter cost per call"
                data-testid="input-cost"
              />
            </div>
            {editingProvider?.description && (
              <p className="text-sm text-muted-foreground">
                {editingProvider.description}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSavePricing} 
              disabled={updatePricingMutation.isPending}
              data-testid="button-save-pricing"
            >
              {updatePricingMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
