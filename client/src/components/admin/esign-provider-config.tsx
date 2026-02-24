import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  Settings, 
  Check, 
  IndianRupee, 
  Zap, 
  Shield, 
  AlertCircle,
  RefreshCw,
  TrendingDown
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

interface ESignProviderConfig {
  provider: string;
  displayName: string;
  description: string;
  pricingPerSign: number;
  pricingCurrency: string;
  isActive: boolean;
  isConfigured: boolean;
  features: string[];
  environment: string;
}

interface ProvidersResponse {
  success: boolean;
  activeProvider: string;
  providers: ESignProviderConfig[];
}

export function ESignProviderConfig() {
  const { toast } = useToast();
  const [editPricing, setEditPricing] = useState<{ provider: string; price: number } | null>(null);

  const { data, isLoading, refetch } = useQuery<ProvidersResponse>({
    queryKey: ["/api/admin/esign/providers"],
  });

  const setProviderMutation = useMutation({
    mutationFn: async (provider: string) => {
      return apiRequest("/api/admin/esign/set-provider", {
        method: "POST",
        body: JSON.stringify({ provider }),
      });
    },
    onSuccess: (_, provider) => {
      toast({
        title: "Provider Updated",
        description: `eSign provider switched to ${provider}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/esign/providers"] });
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
    mutationFn: async ({ provider, pricePerSign }: { provider: string; pricePerSign: number }) => {
      return apiRequest("/api/admin/esign/update-pricing", {
        method: "POST",
        body: JSON.stringify({ provider, pricePerSign }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Pricing Updated",
        description: "Provider pricing has been updated",
      });
      setEditPricing(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/esign/providers"] });
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
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const providers = data?.providers || [];
  const activeProvider = data?.activeProvider;
  
  const configuredProviders = providers.filter(p => p.isConfigured);
  const cheapestConfigured = configuredProviders.length > 0
    ? configuredProviders.reduce((min, p) => p.pricingPerSign < min.pricingPerSign ? p : min, configuredProviders[0])
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">eSign Provider Configuration</h2>
          <p className="text-muted-foreground">
            Manage Aadhaar-based electronic signature providers
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh-providers">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {cheapestConfigured && cheapestConfigured.provider !== activeProvider && (
        <Alert>
          <TrendingDown className="h-4 w-4" />
          <AlertTitle>Cost Optimization Available</AlertTitle>
          <AlertDescription>
            Switch to {cheapestConfigured.displayName} to save on eSign costs. 
            Current rate: ₹{cheapestConfigured.pricingPerSign}/sign
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {providers.map((provider) => (
          <Card 
            key={provider.provider}
            className={`relative ${provider.isActive ? 'ring-2 ring-primary' : ''}`}
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
                    {provider.displayName}
                    {provider.isConfigured ? (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        <Check className="h-3 w-3 mr-1" />
                        Configured
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Mock Mode
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
                  <span className="text-sm font-medium">Price per Sign</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">₹{provider.pricingPerSign.toFixed(2)}</span>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setEditPricing({ provider: provider.provider, price: provider.pricingPerSign })}
                        data-testid={`button-edit-pricing-${provider.provider}`}
                      >
                        <Settings className="h-3 w-3" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Update Pricing</DialogTitle>
                        <DialogDescription>
                          Set the cost per eSign for {provider.displayName}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="price">Price per Sign (INR)</Label>
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
                                pricePerSign: editPricing.price,
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

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4" />
                <span>Environment: {provider.environment.toUpperCase()}</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {provider.features.map((feature, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    <Zap className="h-3 w-3 mr-1" />
                    {feature}
                  </Badge>
                ))}
              </div>

              <Button
                className="w-full"
                variant={provider.isActive ? "secondary" : "default"}
                disabled={provider.isActive || setProviderMutation.isPending}
                onClick={() => setProviderMutation.mutate(provider.provider)}
                data-testid={`button-activate-${provider.provider}`}
              >
                {provider.isActive ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Currently Active
                  </>
                ) : setProviderMutation.isPending ? (
                  "Switching..."
                ) : (
                  "Switch to this Provider"
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Provider Setup Instructions</CardTitle>
          <CardDescription>
            How to configure each eSign provider
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">TruthScreen (Primary)</h4>
            <p className="text-sm text-muted-foreground">
              Set the following environment variables:
            </p>
            <code className="block p-2 bg-muted rounded text-xs">
              TRUTHSCREEN_USERNAME<br/>
              TRUTHSCREEN_PASSWORD
            </code>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">Protean (NSDL)</h4>
            <p className="text-sm text-muted-foreground">
              Set the following environment variables when API credentials are received:
            </p>
            <code className="block p-2 bg-muted rounded text-xs">
              PROTEAN_ASP_ID<br/>
              PROTEAN_ASP_SECRET<br/>
              PROTEAN_LICENSE_KEY
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ESignProviderConfig;
