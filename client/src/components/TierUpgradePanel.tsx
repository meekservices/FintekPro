import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Shield, ShieldCheck, Crown, CheckCircle2, XCircle, Lock, Unlock, ArrowRight, TrendingUp, Globe } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";

interface CompleteKYCStatus {
  currentTier: string;
  currentTierName: string;
  currentTierDescription: string;
  eligibleForUpgrade: boolean;
  nextTier: string | null;
  nextTierName: string | null;
  nextTierDescription: string | null;
  completedVerifications: Array<{code: string; name: string; completed: boolean}>;
  missingVerifications: Array<{code: string; name: string; completed: boolean}>;
  unlockedFeatures: string[];
  productsUnlockedAtCurrentTier: string[];
  productsAccessible: number;
  productsLocked: number;
  upgradeRequestedAt: string | null;
  upgradedAt: string | null;
  isActive: boolean;
  dueDate: string | null;
  daysUntilExpiry: number | null;
  requiresReKYC: boolean;
  remindersSent: number;
  canTradeMutualFunds: boolean;
  canTradeBroking: boolean;
  canTradeInternational: boolean;
  riskCategory: string;
  reviewFrequency: string;
  lastUpdated: string | null;
  pendingActions: string[];
}

interface TierInfo {
  id: string;
  name: string;
  description: string;
  icon: typeof Shield;
  color: string;
  bgColor: string;
  productsUnlocked: string[];
  features: string[];
  maxInvestment: string;
}

const tierHierarchy: TierInfo[] = [
  {
    id: "basic",
    name: "Basic Tier",
    description: "Essential financial products for everyday investors",
    icon: Shield,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
    productsUnlocked: ["Mutual Funds (Equity)", "Mutual Funds (Debt)", "Mutual Funds (Hybrid)"],
    features: ["PAN & Aadhaar Verification", "Bank Account Link", "Basic Profile"],
    maxInvestment: "₹50L/year"
  },
  {
    id: "enhanced",
    name: "Enhanced Tier",
    description: "Expanded access for serious investors",
    icon: ShieldCheck,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-900/20",
    productsUnlocked: ["Broking Services", "IPO", "Bonds", "Government Securities", "NCDs", "SGBs"],
    features: ["Video KYC", "Income Proof", "Bank Statement", "Enhanced Due Diligence"],
    maxInvestment: "₹5Cr/year"
  },
  {
    id: "accredited_investor",
    name: "Accredited Investor",
    description: "Premium tier for high-net-worth individuals",
    icon: Crown,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-900/20",
    productsUnlocked: ["International Trading", "Alternative Investments", "Private Equity", "Portfolio Management"],
    features: ["SEBI Accreditation", "Digital Signature", "Wealth Verification", "Regulatory Compliance"],
    maxInvestment: "Unlimited"
  }
];

export function TierUpgradePanel() {
  const { toast } = useToast();
  const [selectedTierForUpgrade, setSelectedTierForUpgrade] = useState<string | null>(null);

  const { data: completeStatus, isLoading } = useQuery<{ success: boolean; data: CompleteKYCStatus }>({
    queryKey: ["/api/kyc/complete-status"],
  });

  const upgradeMutation = useMutation({
    mutationFn: async (targetTier: string) => {
      return await apiRequest('POST', '/api/kyc/tiers/request-upgrade', { body: { targetTier } });
    },
    onSuccess: (data) => {
      toast({
        title: 'Upgrade Requested',
        description: data.message || 'Your KYC tier upgrade request has been submitted.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/kyc/complete-status'] });
      setSelectedTierForUpgrade(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Upgrade Failed',
        description: error.message || 'Failed to request KYC upgrade',
        variant: 'destructive',
      });
    }
  });

  if (isLoading) {
    return (
      <Card data-testid="card-tier-upgrade-panel">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-24 bg-gray-200 dark:bg-gray-800 rounded"></div>
            <div className="h-24 bg-gray-200 dark:bg-gray-800 rounded"></div>
            <div className="h-24 bg-gray-200 dark:bg-gray-800 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!completeStatus?.success) {
    return (
      <Alert data-testid="alert-status-error">
        <AlertDescription>Unable to load tier information. Please try again.</AlertDescription>
      </Alert>
    );
  }

  const status = completeStatus.data;
  const currentTierIndex = tierHierarchy.findIndex(t => t.id === status.currentTier);

  const getTierProgress = (tierIndex: number): number => {
    if (tierIndex < currentTierIndex) return 100;
    if (tierIndex === currentTierIndex) {
      const total = status.completedVerifications.length + status.missingVerifications.length;
      return total > 0 ? (status.completedVerifications.length / total) * 100 : 0;
    }
    return 0;
  };

  const getTierStatus = (tierIndex: number): "completed" | "current" | "locked" => {
    if (tierIndex < currentTierIndex) return "completed";
    if (tierIndex === currentTierIndex) return "current";
    return "locked";
  };

  const canUpgradeToTier = (tierIndex: number): boolean => {
    return tierIndex === currentTierIndex + 1 && status.eligibleForUpgrade;
  };

  return (
    <Card data-testid="card-tier-upgrade-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          KYC Tier Progression
        </CardTitle>
        <CardDescription>
          Upgrade your tier to unlock more financial products and higher investment limits
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Tier Progression Cards */}
        <div className="space-y-4">
          {tierHierarchy.map((tier, index) => {
            const tierStatus = getTierStatus(index);
            const progress = getTierProgress(index);
            const TierIcon = tier.icon;
            const isUpgradeable = canUpgradeToTier(index);

            return (
              <div
                key={tier.id}
                className={`relative rounded-lg border-2 p-4 transition-all ${
                  tierStatus === "current"
                    ? "border-primary bg-primary/5 dark:bg-primary/10"
                    : tierStatus === "completed"
                    ? "border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/10"
                    : "border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/10"
                }`}
                data-testid={`card-tier-${tier.id}`}
              >
                {/* Tier Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${tier.bgColor}`}>
                      <TierIcon className={`h-6 w-6 ${tier.color}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg dark:text-white flex items-center gap-2">
                        {tier.name}
                        {tierStatus === "completed" && (
                          <CheckCircle2 className="h-5 w-5 text-green-500" data-testid={`icon-tier-completed-${tier.id}`} />
                        )}
                        {tierStatus === "current" && (
                          <Badge variant="default" data-testid={`badge-tier-current-${tier.id}`}>Current</Badge>
                        )}
                        {tierStatus === "locked" && (
                          <Lock className="h-4 w-4 text-gray-400" data-testid={`icon-tier-locked-${tier.id}`} />
                        )}
                      </h3>
                      <p className="text-sm text-muted-foreground">{tier.description}</p>
                    </div>
                  </div>
                  
                  {tierStatus === "current" && (
                    <Badge variant="secondary" className="shrink-0" data-testid={`badge-progress-${tier.id}`}>
                      {Math.round(progress)}% Complete
                    </Badge>
                  )}
                </div>

                {/* Progress Bar (for current tier) */}
                {tierStatus === "current" && (
                  <div className="mb-4">
                    <Progress value={progress} className="h-2" data-testid={`progress-tier-${tier.id}`} />
                    <p className="text-xs text-muted-foreground mt-1">
                      {status.completedVerifications.length} of {status.completedVerifications.length + status.missingVerifications.length} verifications completed
                    </p>
                  </div>
                )}

                <Separator className="my-3" />

                {/* Tier Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Products Unlocked */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                      <Unlock className="h-3 w-3" />
                      Products Unlocked ({tier.productsUnlocked.length})
                    </p>
                    <ul className="space-y-1">
                      {tier.productsUnlocked.slice(0, 3).map((product, i) => (
                        <li key={i} className="text-sm flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                          <span className="dark:text-gray-300">{product}</span>
                        </li>
                      ))}
                      {tier.productsUnlocked.length > 3 && (
                        <li className="text-xs text-muted-foreground">
                          +{tier.productsUnlocked.length - 3} more...
                        </li>
                      )}
                    </ul>
                  </div>

                  {/* Requirements */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      Key Requirements
                    </p>
                    <ul className="space-y-1">
                      {tier.features.slice(0, 3).map((feature, i) => (
                        <li key={i} className="text-sm flex items-center gap-1">
                          {tierStatus === "completed" || (tierStatus === "current" && i < status.completedVerifications.length) ? (
                            <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                          ) : (
                            <XCircle className="h-3 w-3 text-gray-300 dark:text-gray-600 shrink-0" />
                          )}
                          <span className="dark:text-gray-300">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Investment Limit */}
                <div className="mt-3 pt-3 border-t dark:border-gray-700">
                  <p className="text-sm flex items-center justify-between">
                    <span className="text-muted-foreground">Max Annual Investment:</span>
                    <span className="font-semibold dark:text-white">{tier.maxInvestment}</span>
                  </p>
                </div>

                {/* Upgrade Button (for next tier only) */}
                {isUpgradeable && (
                  <div className="mt-4">
                    <Button
                      onClick={() => upgradeMutation.mutate(tier.id)}
                      disabled={upgradeMutation.isPending || status.upgradeRequestedAt !== null}
                      className="w-full"
                      data-testid={`button-upgrade-to-${tier.id}`}
                    >
                      {upgradeMutation.isPending ? (
                        "Processing..."
                      ) : status.upgradeRequestedAt ? (
                        <>Upgrade Pending</>
                      ) : (
                        <>
                          <ArrowRight className="h-4 w-4 mr-2" />
                          Upgrade to {tier.name}
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* Missing Verifications Alert (for next tier) */}
                {tierStatus === "locked" && index === currentTierIndex + 1 && !status.eligibleForUpgrade && (
                  <Alert className="mt-4" data-testid={`alert-missing-verifications-${tier.id}`}>
                    <AlertDescription>
                      <p className="font-semibold mb-2">Complete these verifications to unlock:</p>
                      <ul className="space-y-1">
                        {status.missingVerifications.slice(0, 3).map((verification, i) => (
                          <li key={i} className="text-sm flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-destructive shrink-0" />
                            {verification.name}
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t dark:border-gray-700">
          <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400" data-testid="stat-products-accessible">
              {status.productsAccessible}
            </p>
            <p className="text-sm text-muted-foreground">Products Accessible</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20">
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400" data-testid="stat-products-locked">
              {status.productsLocked}
            </p>
            <p className="text-sm text-muted-foreground">Products Locked</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="stat-upgrade-eligible">
              {status.eligibleForUpgrade ? "Yes" : "No"}
            </p>
            <p className="text-sm text-muted-foreground">Upgrade Eligible</p>
          </div>
        </div>

        {/* Pending Actions */}
        {status.pendingActions.length > 0 && (
          <Alert data-testid="alert-pending-actions">
            <AlertDescription>
              <p className="font-semibold mb-2">Pending Actions:</p>
              <ul className="list-disc list-inside space-y-1">
                {status.pendingActions.map((action, i) => (
                  <li key={i} className="text-sm">{action}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
