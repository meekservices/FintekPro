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
  Settings, 
  Check, 
  IndianRupee, 
  Zap, 
  Shield as LucideShield, 
  AlertCircle,
  RefreshCw,
  TrendingDown,
  BarChart3,
  Users,
  CheckCircle,
  XCircle,
  Calculator,
  Key,
  ExternalLink
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Link } from "wouter";

interface AadhaarProviderConfig {
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
  providers: AadhaarProviderConfig[];
}

interface UsageStats {
  totalVerifications: number;
  successfulVerifications: number;
  failedVerifications: number;
  successRate: number;
  totalCost: number;
  thisMonth: {
    verifications: number;
    cost: number;
  };
  byProvider: {
    [key: string]: {
      verifications: number;
      successRate: number;
      cost: number;
    };
  };
}

interface UsageResponse {
  success: boolean;
  stats: UsageStats;
  mockData: boolean;
  note: string;
}

export default function AdminAadhaarConfig() {
  const { toast } = useToast();
  const [editPricing, setEditPricing] = useState<{ provider: string; price: number } | null>(null);
  const [monthlyVolume, setMonthlyVolume] = useState(1000);

  const { data, isLoading, refetch } = useQuery<ProvidersResponse>({
    queryKey: ["/api/admin/aadhaar/providers"],
  });

  const { data: usageData, isLoading: usageLoading } = useQuery<UsageResponse>({
    queryKey: ["/api/admin/aadhaar/usage"],
  });

  const setProviderMutation = useMutation({
    mutationFn: async (provider: string) => {
      return apiRequest("/api/admin/aadhaar/set-provider", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
    },
    onSuccess: (_, provider) => {
      toast({
        title: "Provider Updated",
        description: `Aadhaar verification provider switched to ${provider}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/aadhaar/providers"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update provider",
        variant: "destructive",
      });
    },
  });

  const updatePricingMutation = useMutation({
    mutationFn: async ({ provider, pricePerVerification }: { provider: string; pricePerVerification: number }) => {
      return apiRequest("/api/admin/aadhaar/pricing", {
        method: "PATCH",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, pricePerVerification }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Pricing Updated",
        description: "Provider pricing has been updated",
      });
      setEditPricing(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/aadhaar/providers"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update pricing",
        variant: "destructive",
      });
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
          <h2 className="text-2xl font-bold tracking-tight">Aadhaar Verification Provider Configuration</h2>
          <p className="text-muted-foreground">
            Manage Aadhaar verification providers for KYC and identity verification
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh-aadhaar-providers">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {cheapestConfigured && cheapestConfigured.provider !== activeProvider && (
        <Alert>
          <TrendingDown className="h-4 w-4" />
          <AlertTitle>Cost Optimization Available</AlertTitle>
          <AlertDescription>
            Switch to {cheapestConfigured.name} to save on Aadhaar verification costs. 
            Current rate: ₹{cheapestConfigured.pricePerVerification}/verification
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="providers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="providers" data-testid="tab-providers">
            <Settings className="h-4 w-4 mr-2" />
            Providers
          </TabsTrigger>
          <TabsTrigger value="comparison" data-testid="tab-comparison">
            <Calculator className="h-4 w-4 mr-2" />
            Cost Comparison
          </TabsTrigger>
          <TabsTrigger value="usage" data-testid="tab-usage">
            <BarChart3 className="h-4 w-4 mr-2" />
            Usage Statistics
          </TabsTrigger>
          <TabsTrigger value="setup" data-testid="tab-setup">
            <Key className="h-4 w-4 mr-2" />
            Configuration
          </TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {providers.map((provider) => (
              <Card 
                key={provider.provider}
                className={`relative ${provider.isActive ? 'ring-2 ring-primary' : ''}`}
                data-testid={`card-provider-${provider.provider}`}
              >
                {provider.isActive && (
                  <Badge className="absolute -top-2 right-4 bg-primary">
                    Active
                  </Badge>
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
                      <CardDescription className="mt-2">
                        {provider.description}
                      </CardDescription>
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
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setEditPricing({ provider: provider.provider, price: provider.pricePerVerification })}
                            data-testid={`button-edit-pricing-${provider.provider}`}
                          >
                            <Settings className="h-3 w-3" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Update Pricing</DialogTitle>
                            <DialogDescription>
                              Set the cost per Aadhaar verification for {provider.name}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="price">Price per Verification (INR)</Label>
                              <Input
                                id="price"
                                type="number"
                                step="0.01"
                                min="0"
                                value={editPricing?.price || 0}
                                onChange={(e) => setEditPricing(prev => prev ? { ...prev, price: parseFloat(e.target.value) || 0 } : null)}
                                data-testid="input-pricing-value"
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              onClick={() => {
                                if (editPricing) {
                                  updatePricingMutation.mutate({
                                    provider: editPricing.provider,
                                    pricePerVerification: editPricing.price,
                                  });
                                }
                              }}
                              disabled={updatePricingMutation.isPending}
                              data-testid="button-save-pricing"
                            >
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

                  <Button
                    className="w-full"
                    variant={provider.isActive ? "secondary" : "default"}
                    disabled={provider.isActive || !provider.isConfigured || setProviderMutation.isPending}
                    onClick={() => setProviderMutation.mutate(provider.provider)}
                    data-testid={`button-activate-${provider.provider}`}
                  >
                    {provider.isActive ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Currently Active
                      </>
                    ) : !provider.isConfigured ? (
                      <>
                        <AlertCircle className="h-4 w-4 mr-2" />
                        Configure to Enable
                      </>
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
                Cost Comparison Calculator
              </CardTitle>
              <CardDescription>
                Compare provider costs based on your expected monthly verification volume
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="volume">Estimated Monthly Verifications</Label>
                <Input
                  id="volume"
                  type="number"
                  min="1"
                  value={monthlyVolume}
                  onChange={(e) => setMonthlyVolume(parseInt(e.target.value) || 1)}
                  data-testid="input-monthly-volume"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {providers.map((provider) => {
                  const monthlyCost = provider.pricePerVerification * monthlyVolume;
                  const isCheapest = cheapestConfigured?.provider === provider.provider;
                  
                  return (
                    <Card 
                      key={provider.provider} 
                      className={`relative ${isCheapest ? 'ring-2 ring-green-500' : ''}`}
                      data-testid={`comparison-card-${provider.provider}`}
                    >
                      {isCheapest && provider.isConfigured && (
                        <Badge className="absolute -top-2 right-4 bg-green-500">
                          <TrendingDown className="h-3 w-3 mr-1" />
                          Cheapest
                        </Badge>
                      )}
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                          {provider.name}
                          {provider.isConfigured ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-yellow-500" />
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Per Verification</span>
                          <span className="font-bold">₹{provider.pricePerVerification.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-lg">
                          <span className="text-muted-foreground">Monthly Cost</span>
                          <span className="font-bold text-primary">₹{monthlyCost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                        </div>
                        {!provider.isConfigured && (
                          <p className="text-sm text-yellow-600">
                            Configure this provider to enable it
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {configuredProviders.length >= 2 && (
                <Alert>
                  <TrendingDown className="h-4 w-4" />
                  <AlertTitle>Recommendation</AlertTitle>
                  <AlertDescription>
                    Based on your volume of {monthlyVolume.toLocaleString()} verifications/month, 
                    {cheapestConfigured && (
                      <span className="font-medium"> {cheapestConfigured.name}</span>
                    )} is the most cost-effective option, 
                    saving you ₹{((providers.find(p => p.provider !== cheapestConfigured?.provider)?.pricePerVerification || 0) - (cheapestConfigured?.pricePerVerification || 0)) * monthlyVolume}/month.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          {usageLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : (
            <>
              {usageData?.mockData && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Mock Data</AlertTitle>
                  <AlertDescription>
                    {usageData.note}
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid gap-4 md:grid-cols-3">
                <Card data-testid="card-verifications-this-month">
                  <CardHeader className="pb-2">
                    <CardDescription>Verifications This Month</CardDescription>
                    <CardTitle className="text-3xl flex items-center gap-2">
                      <Users className="h-6 w-6 text-primary" />
                      {usageStats?.thisMonth?.verifications?.toLocaleString() || 0}
                    </CardTitle>
                  </CardHeader>
                </Card>

                <Card data-testid="card-success-rate">
                  <CardHeader className="pb-2">
                    <CardDescription>Success Rate</CardDescription>
                    <CardTitle className="text-3xl flex items-center gap-2">
                      <CheckCircle className="h-6 w-6 text-green-500" />
                      {((usageStats?.successRate || 0) * 100).toFixed(1)}%
                    </CardTitle>
                  </CardHeader>
                </Card>

                <Card data-testid="card-total-cost">
                  <CardHeader className="pb-2">
                    <CardDescription>Total Cost This Month</CardDescription>
                    <CardTitle className="text-3xl flex items-center gap-2">
                      <IndianRupee className="h-6 w-6 text-primary" />
                      ₹{usageStats?.thisMonth?.cost?.toLocaleString('en-IN', { maximumFractionDigits: 2 }) || 0}
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Usage by Provider</CardTitle>
                  <CardDescription>Breakdown of verifications by provider</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {providers.map((provider) => {
                      const providerStats = usageStats?.byProvider?.[provider.provider];
                      return (
                        <div 
                          key={provider.provider} 
                          className="flex items-center justify-between p-4 border rounded-lg"
                          data-testid={`usage-provider-${provider.provider}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${provider.isActive ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                            <div>
                              <p className="font-medium">{provider.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {providerStats?.verifications?.toLocaleString() || 0} verifications
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">₹{providerStats?.cost?.toLocaleString('en-IN', { maximumFractionDigits: 2 }) || 0}</p>
                            <p className="text-sm text-muted-foreground">
                              {((providerStats?.successRate || 0) * 100).toFixed(1)}% success rate
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="setup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Provider Configuration Status</CardTitle>
              <CardDescription>
                Required environment variables for each Aadhaar verification provider
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {providers.map((provider) => (
                <div key={provider.provider} className="space-y-3" data-testid={`setup-provider-${provider.provider}`}>
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium flex items-center gap-2">
                      {provider.name}
                      {provider.isConfigured ? (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Ready
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Missing Credentials
                        </Badge>
                      )}
                    </h4>
                  </div>
                  <p className="text-sm text-muted-foreground">{provider.description}</p>
                  
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Required Environment Variables:</p>
                    <div className="space-y-1">
                      {provider.requiredEnvVars?.map((envVar) => {
                        const isMissing = provider.missingEnvVars?.includes(envVar);
                        return (
                          <div 
                            key={envVar} 
                            className={`flex items-center gap-2 p-2 rounded text-sm font-mono ${isMissing ? 'bg-red-50 dark:bg-red-950' : 'bg-green-50 dark:bg-green-950'}`}
                          >
                            {isMissing ? (
                              <XCircle className="h-4 w-4 text-red-500" />
                            ) : (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                            {envVar}
                            {isMissing && <span className="text-red-500 text-xs">(missing)</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  {provider.missingEnvVars && provider.missingEnvVars.length > 0 && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/admin/api-configuration">
                        <Key className="h-4 w-4 mr-2" />
                        Configure Secrets
                        <ExternalLink className="h-3 w-3 ml-2" />
                      </Link>
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Integration Guide</CardTitle>
              <CardDescription>
                How Aadhaar verification works in your application
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <LucideShield className="h-4 w-4" />
                  Verification Flow
                </h4>
                <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                  <li>User enters their Aadhaar number</li>
                  <li>OTP is sent to linked mobile number via UIDAI</li>
                  <li>User enters OTP for verification</li>
                  <li>Verified demographic data is returned</li>
                  <li>Data is encrypted and stored for KYC compliance</li>
                </ol>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Provider Selection
                </h4>
                <p className="text-sm text-muted-foreground">
                  The active provider is used for all Aadhaar verifications. You can switch providers 
                  at any time without affecting existing verification data. Both Cashfree and Truthscreen 
                  are UIDAI-authorized ASAs (Authentication Service Agencies).
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
