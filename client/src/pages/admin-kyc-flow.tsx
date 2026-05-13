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
  Shield as LucideShield, AlertCircle, RefreshCw, CheckCircle, XCircle, 
  ArrowUpDown, Zap, IndianRupee, Settings, GripVertical,
  Scale, FileCheck, CreditCard, Landmark, User, BookOpen
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";

interface KycStepProvider {
  providerId: string;
  providerName: string;
  priority: number;
  isConfigured: boolean;
  pricePerCall: number;
  features: string[];
}

interface KycStep {
  stepId: string;
  stepName: string;
  description: string;
  regulatoryBasis: string;
  requiredFor: string[];
  providers: KycStepProvider[];
}

interface KycFlowResponse {
  success: boolean;
  steps: KycStep[];
  meta: {
    totalSteps: number;
    totalProviders: number;
    configuredProviders: number;
  };
}

const stepIcons: Record<string, typeof LucideShield> = {
  pan_verification: CreditCard,
  aadhaar_verification: User,
  address_verification: Landmark,
  bank_verification: Landmark,
  ckyc_verification: FileCheck,
  fatca_declaration: Scale,
  risk_profiling: BookOpen,
};

export default function AdminKycFlow() {
  const { toast } = useToast();
  const [editPricing, setEditPricing] = useState<{ stepId: string; providerId: string; price: number } | null>(null);

  const { data, isLoading, refetch } = useQuery<KycFlowResponse>({
    queryKey: ["/api/admin/kyc/flow"],
  });

  const updatePriorityMutation = useMutation({
    mutationFn: async ({ stepId, providers }: { stepId: string; providers: Array<{ providerId: string; priority: number }> }) => {
      return apiRequest(`/api/admin/kyc/flow/${stepId}/priorities`, {
        method: "PATCH",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providers }),
      });
    },
    onSuccess: () => {
      toast({ title: "Priorities Updated", description: "Provider priority order has been saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kyc/flow"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update priorities", variant: "destructive" });
    },
  });

  const updatePriceMutation = useMutation({
    mutationFn: async ({ stepId, providerId, pricePerCall }: { stepId: string; providerId: string; pricePerCall: number }) => {
      return apiRequest(`/api/admin/kyc/flow/${stepId}/provider/${providerId}/price`, {
        method: "PATCH",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pricePerCall }),
      });
    },
    onSuccess: () => {
      toast({ title: "Pricing Updated", description: "Provider pricing has been saved" });
      setEditPricing(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kyc/flow"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update pricing", variant: "destructive" });
    },
  });

  const moveProvider = (step: KycStep, sortedIndex: number, direction: 'up' | 'down') => {
    const sorted = [...step.providers].sort((a, b) => a.priority - b.priority);
    const swapIndex = direction === 'up' ? sortedIndex - 1 : sortedIndex + 1;
    if (swapIndex < 0 || swapIndex >= sorted.length) return;

    const tempPriority = sorted[sortedIndex].priority;
    sorted[sortedIndex].priority = sorted[swapIndex].priority;
    sorted[swapIndex].priority = tempPriority;

    updatePriorityMutation.mutate({
      stepId: step.stepId,
      providers: sorted.map(p => ({ providerId: p.providerId, priority: p.priority })),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const steps = data?.steps || [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">KYC Flow Configuration</h2>
          <p className="text-muted-foreground">
            Configure priority-based provider selection for each KYC verification step
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">KYC Steps</p>
              <p className="text-3xl font-bold">{meta?.totalSteps || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Total Providers</p>
              <p className="text-3xl font-bold">{meta?.totalProviders || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Configured</p>
              <p className="text-3xl font-bold text-green-600">{meta?.configuredProviders || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Alert>
        <ArrowUpDown className="h-4 w-4" />
        <AlertTitle>Priority-Based Fallback</AlertTitle>
        <AlertDescription>
          Each KYC step tries providers in priority order. If the top-priority provider fails or is not configured,
          the system falls back to the next one automatically. Priority and pricing changes are persisted to the
          database and survive server restarts. Only providers marked <strong>Ready</strong> will be selected for
          live verification flows.
        </AlertDescription>
      </Alert>

      <Accordion type="multiple" defaultValue={steps.map(s => s.stepId)} className="space-y-3">
        {steps.map((step) => {
          const StepIcon = stepIcons[step.stepId] || LucideShield;
          const configuredCount = step.providers.filter(p => p.isConfigured).length;
          const sortedProviders = [...step.providers].sort((a, b) => a.priority - b.priority);

          return (
            <AccordionItem key={step.stepId} value={step.stepId} className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-3 text-left flex-1">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                    <StepIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{step.stepName}</h3>
                      <Badge variant="outline" className="text-xs">
                        {configuredCount}/{step.providers.length} configured
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                    {step.requiredFor.slice(0, 3).map((product, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{product}</Badge>
                    ))}
                    {step.requiredFor.length > 3 && (
                      <Badge variant="secondary" className="text-xs">+{step.requiredFor.length - 3}</Badge>
                    )}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="space-y-4">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Regulatory Basis</p>
                    <p className="text-sm">{step.regulatoryBasis}</p>
                  </div>

                  <div className="space-y-2">
                    {sortedProviders.map((provider, index) => (
                      <div
                        key={provider.providerId}
                        className={`flex items-center gap-3 p-3 border rounded-lg ${
                          provider.isConfigured ? 'bg-card' : 'bg-muted/30 opacity-75'
                        } ${index === 0 && provider.isConfigured ? 'ring-1 ring-primary/30' : ''}`}
                      >
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            disabled={index === 0 || updatePriorityMutation.isPending}
                            onClick={() => moveProvider(step, index, 'up')}
                          >
                            <ArrowUpDown className="h-3 w-3 rotate-180" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            disabled={index === sortedProviders.length - 1 || updatePriorityMutation.isPending}
                            onClick={() => moveProvider(step, index, 'down')}
                          >
                            <ArrowUpDown className="h-3 w-3" />
                          </Button>
                        </div>

                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted font-bold text-sm">
                          {index + 1}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{provider.providerName}</span>
                            {provider.isConfigured ? (
                              <Badge variant="outline" className="text-green-600 border-green-600 text-xs">
                                <CheckCircle className="h-3 w-3 mr-1" />Ready
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-yellow-600 border-yellow-600 text-xs">
                                <AlertCircle className="h-3 w-3 mr-1" />Not Configured
                              </Badge>
                            )}
                            {index === 0 && provider.isConfigured && (
                              <Badge className="bg-primary text-xs">Primary</Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {provider.features.map((f, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                <Zap className="h-2.5 w-2.5 mr-0.5" />{f}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <div className="flex items-center gap-1">
                              <IndianRupee className="h-3 w-3 text-muted-foreground" />
                              <span className="font-bold text-sm">
                                {provider.pricePerCall === 0 ? 'Free' : `₹${provider.pricePerCall.toFixed(2)}`}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">per call</span>
                          </div>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                                onClick={() => setEditPricing({ stepId: step.stepId, providerId: provider.providerId, price: provider.pricePerCall })}>
                                <Settings className="h-3 w-3" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Update Pricing</DialogTitle>
                                <DialogDescription>Set the cost per API call for {provider.providerName}</DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <Label>Price per API Call (INR)</Label>
                                  <Input type="number" step="0.01" min="0"
                                    value={editPricing?.price ?? 0}
                                    onChange={(e) => setEditPricing(prev => prev ? { ...prev, price: parseFloat(e.target.value) || 0 } : null)} />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button onClick={() => {
                                  if (editPricing) {
                                    updatePriceMutation.mutate({ stepId: editPricing.stepId, providerId: editPricing.providerId, pricePerCall: editPricing.price });
                                  }
                                }} disabled={updatePriceMutation.isPending}>
                                  {updatePriceMutation.isPending ? "Saving..." : "Save Pricing"}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
