import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, ArrowRight, CheckCircle2, Info, ShieldAlert, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface KycGapItem {
  key: string;
  label: string;
  description: string;
  wizardStep: number;
  type: "tier" | "condition" | "limit";
}

interface KycGapData {
  success: boolean;
  hasGap: boolean;
  isAdmin?: boolean;
  roleCategory?: "client" | "agent" | "partner" | "sub_agent";
  message?: string | null;
  missingItems?: KycGapItem[];
  currentTier?: string | null;
  requiredTier?: string | null;
  productCode?: string | null;
  productName?: string | null;
  wizardDeepLink?: string | null;
  amountLimitMessage?: string | null;
}

interface KycGapNudgeProps {
  productCode: string;
  className?: string;
  variant?: "inline" | "compact";
}

function getTierLabel(tier: string): string {
  const labels: Record<string, string> = {
    basic: "Basic",
    enhanced: "Enhanced",
    accredited_investor: "Accredited Investor",
  };
  return labels[tier] || tier.charAt(0).toUpperCase() + tier.slice(1).replace(/_/g, " ");
}

function ItemTypeIcon({ type }: { type: KycGapItem["type"] }) {
  switch (type) {
    case "tier":
      return <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />;
    case "limit":
      return <Info className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />;
    default:
      return <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />;
  }
}

export function useKycGap(productCode: string) {
  return useQuery<KycGapData>({
    queryKey: ["/api/kyc/gap", productCode],
    queryFn: async () => {
      const res = await fetch(`/api/kyc/gap?productCode=${encodeURIComponent(productCode)}`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 401) return { success: false, hasGap: false };
        throw new Error("Failed to fetch KYC gap");
      }
      return res.json();
    },
    staleTime: 60_000,
    retry: false,
  });
}

/**
 * Returns true when a user is blocked from transacting (hard gap or sub-agent routing).
 * Returns false for limit-only gaps (eligible but capped).
 */
export function isHardBlocked(data: KycGapData | undefined): boolean {
  if (!data || !data.success || data.isAdmin) return false;
  if (data.roleCategory === "sub_agent") return true;
  const nonLimitItems = (data.missingItems ?? []).filter((i) => i.type !== "limit");
  return data.hasGap && nonLimitItems.length > 0;
}

/**
 * Inline/compact nudge component — renders KYC gap details.
 * Designed to be shown after a user triggers an action, not passively.
 */
export function KycGapNudge({ productCode, className, variant = "inline" }: KycGapNudgeProps) {
  const [, setLocation] = useLocation();
  const { data, isLoading } = useKycGap(productCode);

  if (isLoading) {
    return (
      <div className={cn("space-y-2", className)}>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }

  if (!data || !data.success || !data.hasGap || data.isAdmin) {
    return null;
  }

  const {
    roleCategory,
    message,
    missingItems = [],
    wizardDeepLink,
    amountLimitMessage,
    requiredTier,
    currentTier,
  } = data;

  const isSubAgent = roleCategory === "sub_agent";
  const nonLimitItems = missingItems.filter((i) => i.type !== "limit");
  const limitItem = missingItems.find((i) => i.type === "limit");

  const handleCompleteKyc = () => {
    setLocation(wizardDeepLink || "/onboarding");
  };

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2",
          className
        )}
      >
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 space-y-1.5">
            {isSubAgent ? (
              <p className="text-sm text-amber-800 dark:text-amber-300">{message}</p>
            ) : (
              <>
                {nonLimitItems.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {nonLimitItems.slice(0, 3).map((item) => (
                      <Badge
                        key={item.key}
                        variant="outline"
                        className="text-xs border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 font-normal"
                      >
                        {item.label}
                      </Badge>
                    ))}
                    {nonLimitItems.length > 3 && (
                      <Badge
                        variant="outline"
                        className="text-xs border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 font-normal"
                      >
                        +{nonLimitItems.length - 3} more
                      </Badge>
                    )}
                  </div>
                )}
                {limitItem && !nonLimitItems.length && (
                  <p className="text-xs text-blue-700 dark:text-blue-300">{limitItem.description}</p>
                )}
                {wizardDeepLink && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                    onClick={handleCompleteKyc}
                  >
                    Complete KYC <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Alert
      className={cn(
        "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30",
        className
      )}
    >
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertTitle className="text-amber-900 dark:text-amber-200 font-semibold">
        {isSubAgent
          ? "Transaction Handled by Supervising Partner"
          : "KYC Verification Required"}
      </AlertTitle>
      <AlertDescription className="space-y-3 mt-2">
        {message && (
          <p className="text-sm text-amber-800 dark:text-amber-300">{message}</p>
        )}

        {isSubAgent && (
          <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
            <Users className="h-4 w-4" />
            <span>
              Please contact your supervising partner or agent to initiate this transaction on your
              behalf.
            </span>
          </div>
        )}

        {!isSubAgent && (
          <>
            {requiredTier && currentTier && requiredTier !== currentTier && (
              <div className="text-sm text-amber-800 dark:text-amber-300">
                <span className="font-medium">Required tier:</span>{" "}
                <Badge
                  variant="outline"
                  className="text-xs border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-300"
                >
                  {getTierLabel(requiredTier)}
                </Badge>{" "}
                <span className="text-muted-foreground">
                  (current: {getTierLabel(currentTier)})
                </span>
              </div>
            )}

            {nonLimitItems.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                  Steps to complete:
                </p>
                <ul className="space-y-1.5">
                  {nonLimitItems.map((item) => (
                    <li key={item.key} className="flex items-start gap-2">
                      <ItemTypeIcon type={item.type} />
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
                          {item.label}
                        </span>
                        <span className="text-xs text-amber-700/70 dark:text-amber-400/70 ml-1">
                          — {item.description}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {amountLimitMessage && (
              <div className="flex items-start gap-2 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-2.5">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800 dark:text-blue-300">{amountLimitMessage}</p>
              </div>
            )}

            {wizardDeepLink && (
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600 text-white"
                onClick={handleCompleteKyc}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Complete KYC
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </>
        )}
      </AlertDescription>
    </Alert>
  );
}

interface ActionButtonWithNudgeProps {
  productCode: string;
  children: React.ReactNode;
  onProceed: () => void;
  className?: string;
  buttonVariant?: "default" | "outline" | "secondary" | "destructive" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  /** Caller-supplied disabled guard (e.g. form validation). The button is also
   *  disabled while KYC gap data is loading. */
  disabled?: boolean;
  "data-testid"?: string;
}

/**
 * Wraps an action button (Invest, Apply, Transact) with KYC gap detection.
 *
 * Behavior:
 * - Browsing: gap data is pre-fetched silently but nudge is NOT shown until user clicks.
 * - On click: if the user is hard-blocked (ineligible or sub-agent), the nudge appears
 *   inline and the action does NOT proceed.
 * - If only a transaction-amount limit gap exists, the action proceeds but the nudge
 *   is shown alongside explaining the cap.
 * - Admins are never blocked.
 * - Caller-supplied `disabled` (e.g. form validation) is respected independently of
 *   the KYC gate; both conditions must pass before onProceed() is called.
 */
export function ActionButtonWithNudge({
  productCode,
  children,
  onProceed,
  className,
  buttonVariant = "default",
  size = "default",
  disabled: callerDisabled = false,
  "data-testid": testId,
}: ActionButtonWithNudgeProps) {
  const [showNudge, setShowNudge] = useState(false);
  const { data, isLoading } = useKycGap(productCode);

  const hardBlocked = isHardBlocked(data);
  const limitOnly =
    data?.hasGap &&
    !data?.isAdmin &&
    !hardBlocked &&
    (data?.missingItems ?? []).some((i) => i.type === "limit");

  const handleClick = () => {
    if (hardBlocked) {
      // Intercept: show nudge instead of proceeding
      setShowNudge(true);
    } else {
      // Proceed (eligible or limit-only), then show limit nudge if applicable
      onProceed();
      if (limitOnly) setShowNudge(true);
    }
  };

  return (
    <div className="space-y-3">
      <Button
        onClick={handleClick}
        className={className}
        disabled={isLoading || callerDisabled}
        variant={buttonVariant}
        size={size}
        data-testid={testId}
      >
        {children}
      </Button>
      {showNudge && <KycGapNudge productCode={productCode} variant="inline" />}
    </div>
  );
}
