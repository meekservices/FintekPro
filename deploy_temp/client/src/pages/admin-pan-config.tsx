import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  Settings, Check, IndianRupee, Zap, Shield, AlertCircle,
  RefreshCw, TrendingDown, BarChart3, Calculator, Key,
  CheckCircle, XCircle, CreditCard
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface PANProviderConfig {
  provider: string;
  name: string;
  description: string;
  pricePerVerification: number;
  isActive: boolean;
  isConfigured: boolean;
  requiredEnvVars: string[];
  missingEnvVars: string[];
  features: string[];
}

interface ProvidersResponse {
  success: boolean;
  activeProvider: string;
  providers: PANProviderConfig[];
}

interface UsageResponse {
  success: boolean;
  stats: {
    totalVerifications: number;
    successfulVerifications: number;
    failedVerifications: number;
    successRate: number;
    totalCost: number;
    thisMonth: { verifications: number; cost: number };
    byProvider: Record<string, { verifications: number; successRate: number; cost: number }>;
  };
  mockData: boolean;
  note: string;
}

export default function AdminPANConfig() {
  const { toast } = useToast();
  const [editPricing, setEditPricing] = useState<{ provider: string; price: number } | null>(null);
  const [monthlyVolume, setMonthlyVolume] = useState(1000);

  const { data, isLoading, refetch } = useQuery<ProvidersResponse>({
    queryKey: ["/api/admin/pan/providers"],
  });

  const { data: usageData, isLoading: usageLoading } = useQuery<UsageResponse>({
    queryKey: ["/api/admin/pan/usage"],
  });

  const setProviderMutation = useMutation({
    mutationFn: async (provider: string) => {
      return apiRequest("/api/admin/pan/set-provider", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
    },
    onSuccess: (_, provider) => {
      toast({ title: "Provider Updated", description: `PAN verification provider switched to ${provider}` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pan/providers"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update provider", variant: "destructive" });
    },
  });

  const updatePricingMutation = useMutation({
    mutationFn: async ({ provider, pricePerVerification }: { provider: string; pricePerVerification: number }) => {
      return apiRequest("/api/admin/pan/pricing", {
        method: "PATCH",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, pricePerVerification }),
      });
    },
    onSuccess: () => {
      toast({ title: "Pricing Updated", description: "Provider pricing has been updated" });
      setEditPricing(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pan/providers"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update pricing", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const providers = data?.providers || [];
  const activeProvider = data?.activeProvider;
  const configuredProviders = providers.filter(p => p.isConfigured);
  const cheapestConfigured = configuredProviders.length > 0
    ? configuredProviders.reduce((min, p) => p.pricePerVerification < min.pricePerVerification ? p : min, configuredProviders[0])
    : null;
  const usageStats = usageData?.stats;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">PAN Verification Provider Configuration</h2>
          <p className="text-muted-foreground">
            Manage PAN verification providers for KYC and identity verification
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {cheapestConfigured && cheapestConfigured.provider !== activeProvider && (
        <Alert>
          <TrendingDown className="h-4 w-4" />
          <AlertTitle>Cost Optimization Available</AlertTitle>
          <AlertDescription>
            Switch to {cheapestConfigured.name} to save on PAN verification costs.
            Current rate: ₹{cheapestConfigured.pricePerVerification}/verification
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="providers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="providers">
            <Settings className="h-4 w-4 mr-2" />
            Providers
          </TabsTrigger>
          <TabsTrigger value="comparison">
            <Calculator className="h-4 w-4 mr-2" />
            Cost Comparison
          </TabsTrigger>
          <TabsTrigger value="usage">
            <BarChart3 className="h-4 w-4 mr-2" />
            Usage Statistics
          </TabsTrigger>
          <TabsTrigger value="setup">
            <Key className="h-4 w-4 mr-2" />
            Configuration
          </TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {providers.map((provider) => (
              <Card 
                key={provider.provider}
                className={`relative ${provider.isActive ? 'ring-2 ring-primary' : ''}`}
              >
                {provider.isActive && (
                  <Badge className="absolute -top-2 right-4 bg-primary">Active</Badge>
                )}
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {provider.name}
                        {provider.isConfigured ? (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Configured
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Not Configured
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="mt-2">{provider.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <IndianRupee className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Price per Verification</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">₹{provider.pricePerVerification.toFixed(2)}</span>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm"
                            onClick={() => setEditPricing({ provider: provider.provider, price: provider.pricePerVerification })}>
                            <Settings className="h-3 w-3" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Update Pricing</DialogTitle>
                            <DialogDescription>Set the cost per PAN verification for {provider.name}</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="price">Price per Verification (INR)</Label>
                              <Input id="price" type="number" step="0.01" min="0"
                                value={editPricing?.price || 0}
                                onChange={(e) => setEditPricing(prev => prev ? { ...prev, price: parseFloat(e.target.value) || 0 } : null)} />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button onClick={() => {
                              if (editPricing) {
                                updatePricingMutation.mutate({ provider: editPricing.provider, pricePerVerification: editPricing.price });
                              }
                            }} disabled={updatePricingMutation.isPending}>
                              {updatePricingMutation.isPending ? "Saving..." : "Save Pricing"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {provider.features?.map((feature, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        <Zap className="h-3 w-3 mr-1" />
                        {feature}
                      </Badge>
                    ))}
                  </div>

                  <Button className="w-full"
                    variant={provider.isActive ? "secondary" : "default"}
                    disabled={provider.isActive || !provider.isConfigured || setProviderMutation.isPending}
                    onClick={() => setProviderMutation.mutate(provider.provider)}>
                    {provider.isActive ? (
                      <><Check className="h-4 w-4 mr-2" />Currently Active</>
                    ) : !provider.isConfigured ? (
                      <><AlertCircle className="h-4 w-4 mr-2" />Configure to Enable</>
                    ) : setProviderMutation.isPending ? (
                      "Switching..."
                    ) : (
                      "Set as Active"
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="comparison" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Monthly Cost Estimator
              </CardTitle>
              <CardDescription>Compare provider costs based on your estimated monthly volume</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Estimated Monthly Verifications</Label>
                <Input type="number" min="0" value={monthlyVolume}
                  onChange={(e) => setMonthlyVolume(parseInt(e.target.value) || 0)} />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {providers.map((provider) => {
                  const monthlyCost = provider.pricePerVerification * monthlyVolume;
                  const isLowest = configuredProviders.length > 0 && 
                    provider.pricePerVerification === Math.min(...configuredProviders.map(p => p.pricePerVerification));
                  return (
                    <Card key={provider.provider} className={isLowest && provider.isConfigured ? 'ring-2 ring-green-500' : ''}>
                      <CardContent className="pt-6">
                        <div className="text-center space-y-2">
                          <p className="font-medium">{provider.name}</p>
                          <p className="text-2xl font-bold">₹{monthlyCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                          <p className="text-xs text-muted-foreground">{monthlyVolume} x ₹{provider.pricePerVerification.toFixed(2)}</p>
                          {isLowest && provider.isConfigured && (
                            <Badge className="bg-green-600">Best Value</Badge>
                          )}
                          {!provider.isConfigured && (
                            <Badge variant="outline" className="text-yellow-600">Not Configured</Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          {usageLoading ? (
            <div className="flex items-center justify-center py-10">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Total Verifications</p>
                    <p className="text-3xl font-bold">{usageStats?.totalVerifications || 0}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Success Rate</p>
                    <p className="text-3xl font-bold">{(usageStats?.successRate || 0).toFixed(1)}%</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">This Month</p>
                    <p className="text-3xl font-bold">{usageStats?.thisMonth?.verifications || 0}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Total Cost</p>
                    <p className="text-3xl font-bold">₹{(usageStats?.totalCost || 0).toLocaleString('en-IN')}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          {usageData?.mockData && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No Usage Data Yet</AlertTitle>
              <AlertDescription>{usageData.note}</AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="setup" className="space-y-4">
          {providers.map((provider) => (
            <Card key={provider.provider}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  {provider.name}
                  {provider.isConfigured ? (
                    <Badge className="bg-green-600">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Ready
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <XCircle className="h-3 w-3 mr-1" />
                      Missing Configuration
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">Required Environment Variables:</p>
                <div className="space-y-2">
                  {provider.requiredEnvVars.map((envVar) => {
                    const isMissing = provider.missingEnvVars.includes(envVar);
                    return (
                      <div key={envVar} className="flex items-center gap-2 p-2 rounded bg-muted">
                        {isMissing ? (
                          <XCircle className="h-4 w-4 text-red-500" />
                        ) : (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                        <code className="text-sm font-mono">{envVar}</code>
                        {isMissing && <Badge variant="destructive" className="text-xs ml-auto">Missing</Badge>}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
