import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calculator, Info, TrendingUp, Sparkles, Zap } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface FeeBreakdownCardProps {
  orderValueInr: number;
  compact?: boolean;
}

interface FeeBreakdown {
  advisoryFeeBps: number;
  platformFeeBps: number;
  advisoryFeeAmount: number;
  platformFeeAmount: number;
  totalFeeAmount: number;
  feeMode: 'ADVISORY_PLATFORM' | 'PLATFORM_ONLY';
}

export function FeeBreakdownCard({ orderValueInr, compact = false }: FeeBreakdownCardProps) {
  const { data, isLoading, isError } = useQuery<{ success: boolean; fees: FeeBreakdown }>({
    queryKey: ["/api/fee-mode/calculate-fees", { orderValue: orderValueInr }],
    queryFn: async () => {
      const response = await fetch(`/api/fee-mode/calculate-fees?orderValue=${orderValueInr}`, {
        credentials: 'include'
      });
      return response.json();
    },
    enabled: orderValueInr > 0
  });

  if (isLoading) {
    return compact ? (
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
    ) : (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !data?.success) {
    return (
      <Alert variant="default" className="border-amber-200 dark:border-amber-800">
        <Info className="h-4 w-4" />
        <AlertDescription>
          Unable to calculate fees. Please select a fee mode first.
        </AlertDescription>
      </Alert>
    );
  }

  const { fees } = data;
  const isAdvisory = fees.feeMode === 'ADVISORY_PLATFORM';

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 text-sm" data-testid="fee-breakdown-compact">
              <Calculator className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Fees:</span>
              <span className="font-medium">₹{fees.totalFeeAmount.toFixed(2)}</span>
              <Badge variant="outline" className="text-xs">
                {isAdvisory ? 'Advisory' : 'Platform Only'}
              </Badge>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-1 text-xs">
              {isAdvisory && (
                <div className="flex justify-between gap-4">
                  <span>Advisory Fee ({fees.advisoryFeeBps} bps):</span>
                  <span>₹{fees.advisoryFeeAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <span>Platform Fee ({fees.platformFeeBps} bps):</span>
                <span>₹{fees.platformFeeAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-4 pt-1 border-t font-medium">
                <span>Total:</span>
                <span>₹{fees.totalFeeAmount.toFixed(2)}</span>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Card className="border-2" data-testid="fee-breakdown-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Fee Breakdown
          </div>
          <Badge variant={isAdvisory ? "default" : "secondary"}>
            {isAdvisory ? (
              <><Sparkles className="h-3 w-3 mr-1" /> Advisory + Platform</>
            ) : (
              <><Zap className="h-3 w-3 mr-1" /> Platform Only</>
            )}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Order Value</span>
            <span>₹{orderValueInr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          
          {isAdvisory && (
            <div className="flex justify-between">
              <span className="flex items-center gap-1">
                Advisory Fee
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      {fees.advisoryFeeBps} basis points ({(fees.advisoryFeeBps / 100).toFixed(2)}%)
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </span>
              <span>₹{fees.advisoryFeeAmount.toFixed(2)}</span>
            </div>
          )}
          
          <div className="flex justify-between">
            <span className="flex items-center gap-1">
              Platform Fee
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    {fees.platformFeeBps} basis points ({(fees.platformFeeBps / 100).toFixed(2)}%)
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </span>
            <span>₹{fees.platformFeeAmount.toFixed(2)}</span>
          </div>
          
          <div className="flex justify-between pt-2 border-t font-medium">
            <span>Total Fees</span>
            <span className="text-primary">₹{fees.totalFeeAmount.toFixed(2)}</span>
          </div>
        </div>

        {!isAdvisory && (
          <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
            You are in Platform-Only mode. No advisory fees apply. 
            AI recommendations are disabled.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function useClientCapabilities() {
  return useQuery<{
    success: boolean;
    capabilities: {
      canUseAi: boolean;
      canViewRecommendations: boolean;
      advisoryFeeApplicable: boolean;
      platformFeeApplicable: boolean;
      feeMode: 'ADVISORY_PLATFORM' | 'PLATFORM_ONLY' | null;
      feeModeSelected: boolean;
      requiresModeSelection: boolean;
      policyVersion: number;
    };
  }>({
    queryKey: ["/api/fee-mode/capabilities"]
  });
}
