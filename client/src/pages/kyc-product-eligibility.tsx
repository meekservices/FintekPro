import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Lock, Unlock, Shield, CheckCircle2, AlertTriangle, Info, ArrowUpRight } from "lucide-react";
import { KycGapNudge } from "@/components/kyc/kyc-gap-nudge";

interface ProductEligibility {
  productCode: string;
  productName: string;
  eligible: boolean;
  locked: boolean;
  reason: string;
  requiredTier: string;
  requiredTierStatus: string;
  maxAmount: number;
  missingConditions: string[];
  regulatoryBasis: string;
}

interface EligibilityResponse {
  success: boolean;
  eligibility: ProductEligibility[];
}

const TIER_ORDER = ["basic", "enhanced", "accredited_investor"];

function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function getTierLabel(tier: string): string {
  const labels: Record<string, string> = {
    basic: "Basic",
    enhanced: "Enhanced",
    accredited_investor: "Accredited Investor",
  };
  return labels[tier] || tier.charAt(0).toUpperCase() + tier.slice(1).replace(/_/g, " ");
}

function getTierColor(tier: string): string {
  switch (tier) {
    case "basic": return "bg-gray-500";
    case "enhanced": return "bg-purple-500";
    case "accredited_investor": return "bg-green-500";
    default: return "bg-gray-500";
  }
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96" />
      <div className="rounded-lg border p-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-6 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-6 w-6 rounded-full" />
            </div>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}

function TierUpgradeProgress({ eligibility }: { eligibility: ProductEligibility[] }) {
  const lockedProducts = eligibility.filter((p) => p.locked);
  const unlockedProducts = eligibility.filter((p) => !p.locked);
  const total = eligibility.length;
  const unlockedPercent = total > 0 ? (unlockedProducts.length / total) * 100 : 0;

  const currentTierIndex = TIER_ORDER.findIndex((t) =>
    eligibility.some((p) => !p.locked && p.requiredTier === t)
  );
  const highestRequiredIndex = Math.max(
    ...eligibility.map((p) => TIER_ORDER.indexOf(p.requiredTier))
  );

  const currentTier = currentTierIndex >= 0 ? TIER_ORDER[currentTierIndex] : "basic";
  const nextTier = currentTierIndex < highestRequiredIndex
    ? TIER_ORDER[Math.min(currentTierIndex + 1, TIER_ORDER.length - 1)]
    : null;

  const allMissingConditions = [
    ...new Set(lockedProducts.flatMap((p) => p.missingConditions)),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          KYC Tier Progress
        </CardTitle>
        <CardDescription>
          {unlockedProducts.length} of {total} products unlocked
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className={`${getTierColor(currentTier)} text-white border-0`}>
            {getTierLabel(currentTier)}
          </Badge>
          {nextTier && (
            <>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              <Badge variant="outline" className={`${getTierColor(nextTier)} text-white border-0`}>
                {getTierLabel(nextTier)}
              </Badge>
            </>
          )}
        </div>

        <Progress value={unlockedPercent} className="h-2" />

        {allMissingConditions.length > 0 && nextTier && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>To unlock more products</AlertTitle>
            <AlertDescription>
              <span className="block mb-2">
                Upgrade to <strong>{getTierLabel(nextTier)}</strong> tier by completing:
              </span>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {allMissingConditions.map((condition) => (
                  <li key={condition}>{condition.replace(/_/g, " ")}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function ProductCard({ product }: { product: ProductEligibility }) {
  const cardContent = (
    <Card className={`transition-all ${product.locked ? "border-muted" : "border-green-200 dark:border-green-800"}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{product.productName}</CardTitle>
          {product.locked ? (
            <Lock className="h-5 w-5 text-red-500" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          )}
        </div>
        <CardDescription className="text-xs">{product.productCode}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant={product.eligible ? "default" : "destructive"} className="text-xs">
            {product.eligible ? "Eligible" : "Not Eligible"}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {getTierLabel(product.requiredTier)} Tier
          </Badge>
        </div>

        {product.maxAmount > 0 && (
          <div className="text-sm text-muted-foreground">
            Max Investment: <span className="font-medium text-foreground">{formatINR(product.maxAmount)}</span>
          </div>
        )}

        {product.locked && (
          <KycGapNudge productCode={product.productCode} variant="compact" />
        )}

        {!product.locked && product.missingConditions.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              Missing Requirements
            </div>
            <div className="flex flex-wrap gap-1">
              {product.missingConditions.map((condition) => (
                <Badge key={condition} variant="outline" className="text-xs font-normal">
                  {condition.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (product.locked) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div>{cardContent}</div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium text-sm">Why locked?</p>
            <p className="text-xs">{product.reason}</p>
            {product.regulatoryBasis && (
              <p className="text-xs text-muted-foreground italic">
                Regulatory basis: {product.regulatoryBasis}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  return cardContent;
}

export default function KYCProductEligibility() {
  const { toast } = useToast();

  const { data, isLoading, isError, error } = useQuery<EligibilityResponse>({
    queryKey: ["/api/kyc/product-eligibility"],
  });

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (isError) {
    toast({
      title: "Error loading eligibility",
      description: error instanceof Error ? error.message : "Failed to load product eligibility data",
      variant: "destructive",
    });
  }

  const eligibility = data?.eligibility ?? [];
  const unlockedProducts = eligibility.filter((p) => !p.locked);
  const lockedProducts = eligibility.filter((p) => p.locked);

  return (
    <TooltipProvider>
      <div className="space-y-6 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Product Eligibility</h1>
          <p className="text-muted-foreground">
            View which products you can access based on your KYC tier and verification status.
          </p>
        </div>

        {eligibility.length > 0 && (
          <TierUpgradeProgress eligibility={eligibility} />
        )}

        {eligibility.length === 0 && !isLoading && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>No product eligibility data</AlertTitle>
            <AlertDescription>
              Complete your KYC verification to see which products you can access.
            </AlertDescription>
          </Alert>
        )}

        {unlockedProducts.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Unlock className="h-4 w-4 text-green-500" />
              Unlocked Products ({unlockedProducts.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {unlockedProducts.map((product) => (
                <ProductCard key={product.productCode} product={product} />
              ))}
            </div>
          </div>
        )}

        {lockedProducts.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Lock className="h-4 w-4 text-red-500" />
              Locked Products ({lockedProducts.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {lockedProducts.map((product) => (
                <ProductCard key={product.productCode} product={product} />
              ))}
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
