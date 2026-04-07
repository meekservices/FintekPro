/**
 * Account Configuration Panel
 * Controls PDT, shorting, fractional trading, options level, trade confirmations,
 * High-Yield Cash Interest program, and Fully Paid Securities Lending (FPSL).
 */
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Settings, Shield, AlertTriangle, RefreshCw, TrendingDown, Percent, Landmark, TrendingUp, Info, BadgePercent, Banknote } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { AlpacaAccountConfig } from "@/components/us-trading/types";

interface AccountConfigPanelProps {
  accountId?: string;
}

export default function AccountConfigPanel({ accountId }: AccountConfigPanelProps) {
  const { toast } = useToast();

  const { data, isLoading, refetch } = useQuery<{ success: boolean; config: AlpacaAccountConfig }>({
    queryKey: accountId
      ? ["/api/us-trading/broker/accounts", accountId, "config"]
      : ["/api/us-trading/account/config"],
    queryFn: () => fetch(accountId
      ? `/api/us-trading/broker/accounts/${accountId}/config`
      : "/api/us-trading/account/config"
    ).then(r => r.json()),
    staleTime: 60_000,
  });

  const { data: aprTiersData } = useQuery<{ success: boolean; tiers: any[] }>({
    queryKey: ["/api/us-trading/cash-interest/tiers"],
    queryFn: () => fetch("/api/us-trading/cash-interest/tiers").then(r => r.json()),
    staleTime: 300_000,
    enabled: !!accountId,
  });

  const { data: fpslData, refetch: refetchFpsl } = useQuery<{ success: boolean; fpsl: any }>({
    queryKey: ["/api/us-trading/broker/accounts", accountId, "fpsl"],
    queryFn: () => fetch(`/api/us-trading/broker/accounts/${accountId}/fpsl/status`).then(r => r.json()),
    staleTime: 60_000,
    enabled: !!accountId,
  });

  const updateMutation = useMutation({
    mutationFn: (updates: Partial<AlpacaAccountConfig>) =>
      apiRequest("PATCH", accountId
        ? `/api/us-trading/broker/accounts/${accountId}/config`
        : "/api/us-trading/account/config", updates),
    onSuccess: () => {
      toast({ title: "Account configuration updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/us-trading/account/config"] });
      refetch();
    },
    onError: (e: any) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const cashInterestMutation = useMutation({
    mutationFn: ({ action, tier }: { action: "enroll" | "unenroll"; tier?: string }) =>
      apiRequest(`/api/us-trading/broker/accounts/${accountId}/cash-interest/${action}`, {
        method: "POST",
        body: action === "enroll" ? JSON.stringify({ apr_tier_name: tier }) : "{}",
      }),
    onSuccess: (_, vars) => {
      toast({ title: vars.action === "enroll" ? "Enrolled in Cash Interest" : "Unenrolled from Cash Interest" });
      refetch();
    },
    onError: (e: any) => toast({ title: "Cash Interest update failed", description: e.message, variant: "destructive" }),
  });

  const fpslMutation = useMutation({
    mutationFn: ({ action }: { action: "enroll" | "unenroll" }) =>
      apiRequest(`/api/us-trading/broker/accounts/${accountId}/fpsl/${action}`, {
        method: "POST",
        body: action === "enroll" ? JSON.stringify({ tier_id: "standard" }) : "{}",
      }),
    onSuccess: (_, vars) => {
      toast({ title: vars.action === "enroll" ? "FPSL enrollment submitted" : "FPSL unenrolled" });
      refetchFpsl();
    },
    onError: (e: any) => toast({ title: "FPSL update failed", description: e.message, variant: "destructive" }),
  });

  function toggle(key: keyof AlpacaAccountConfig, current: boolean) {
    updateMutation.mutate({ [key]: !current });
  }

  if (isLoading) {
    return <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-14" />)}</div>;
  }

  const config = data?.config;
  if (!config) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        Account configuration not available. Alpaca credentials may not be configured.
      </div>
    );
  }

  const aprTiers = aprTiersData?.tiers ?? [];
  const fpslStatus = fpslData?.fpsl?.us?.status ?? null;
  const cashInterestStatus = (config as any)?.cash_interest?.USD?.status ?? null;
  const currentAprTier = (config as any)?.cash_interest?.USD?.apr_tier_name ?? null;

  const configItems = [
    {
      key: "no_shorting" as const,
      label: "Disable Short Selling",
      description: "Prevent short orders. Enable to only allow long positions.",
      icon: TrendingDown,
      value: config.no_shorting,
    },
    {
      key: "fractional_trading" as const,
      label: "Fractional Trading",
      description: "Allow fractional share and notional-amount orders (e.g. 'Invest ₹10,000 in AAPL').",
      icon: Percent,
      value: config.fractional_trading,
    },
    {
      key: "suspend_trade" as const,
      label: "Suspend All Trading",
      description: "Immediately block all new orders. Existing positions remain open.",
      icon: Shield,
      value: config.suspend_trade,
      warning: config.suspend_trade ? "Trading is currently suspended on this account." : undefined,
    },
  ];

  return (
    <div className="space-y-5">
      <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
        <Settings className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-sm text-blue-700 dark:text-blue-300">
          These settings control trading behaviour at the Alpaca account level and take effect immediately for all new orders.
        </AlertDescription>
      </Alert>

      <div className="space-y-3">
        {configItems.map(({ key, label, description, icon: Icon, value, warning }) => (
          <Card key={key}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-md bg-muted p-1.5">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
                    {warning && <div className="text-xs text-amber-600 mt-1 font-medium">{warning}</div>}
                  </div>
                </div>
                <Switch
                  checked={value}
                  onCheckedChange={() => toggle(key, value)}
                  disabled={updateMutation.isPending}
                />
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Options Level */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-md bg-muted p-1.5">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-sm font-medium">Options Trading Level</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Level 1: Covered calls &amp; cash-secured puts · Level 2: Long calls/puts · Level 3: Spreads (per FINRA 2360)
                  </div>
                </div>
              </div>
              <Select
                value={config.max_options_trading_level?.toString() ?? "none"}
                onValueChange={(v) => updateMutation.mutate({
                  max_options_trading_level: v === "none" ? null : parseInt(v),
                })}
                disabled={updateMutation.isPending}
              >
                <SelectTrigger className="w-28 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Disabled</SelectItem>
                  <SelectItem value="1">Level 1</SelectItem>
                  <SelectItem value="2">Level 2</SelectItem>
                  <SelectItem value="3">Level 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* PDT Check */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-md bg-muted p-1.5">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-sm font-medium">PDT (Pattern Day Trader) Check</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Accounts below $25,000 are limited to 3 day trades per 5-day rolling window.
                    <span className="font-medium text-foreground"> Current: </span>
                    <Badge variant="outline" className="text-xs ml-1">{config.pdt_check?.toUpperCase() || "BOTH"}</Badge>
                  </div>
                </div>
              </div>
              <Select
                value={config.pdt_check || "both"}
                onValueChange={(v) => updateMutation.mutate({ pdt_check: v as any })}
                disabled={updateMutation.isPending}
              >
                <SelectTrigger className="w-28 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Both</SelectItem>
                  <SelectItem value="entry">Entry Only</SelectItem>
                  <SelectItem value="exit">Exit Only</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Trade Confirm Emails */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-md bg-muted p-1.5">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-sm font-medium">Trade Confirm Emails</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Send email confirmation for every trade.</div>
                </div>
              </div>
              <Switch
                checked={config.trade_confirm_email === "all"}
                onCheckedChange={(v) => updateMutation.mutate({ trade_confirm_email: v ? "all" : "none" })}
                disabled={updateMutation.isPending}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── High-Yield Cash Interest ─────────────────────────────────────── */}
      {accountId && (
        <div>
          <Separator className="my-2" />
          <div className="flex items-center gap-2 mb-3 mt-4">
            <BadgePercent className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-semibold">High-Yield Cash Interest Program</span>
            {cashInterestStatus && (
              <Badge className={
                cashInterestStatus === "ACTIVE" ? "bg-green-100 text-green-700 text-xs" :
                cashInterestStatus === "PENDING_ENROLLMENT" ? "bg-amber-100 text-amber-700 text-xs" :
                "bg-gray-100 text-gray-600 text-xs"
              }>
                {cashInterestStatus}
              </Badge>
            )}
          </div>
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                Earn interest on uninvested USD cash held in your Alpaca account. Rates are set by Alpaca's program tiers.
              </p>
              {aprTiers.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {aprTiers.map((tier: any) => (
                    <div
                      key={tier.name ?? tier.id}
                      className={`flex items-center justify-between border rounded-md p-3 ${currentAprTier === (tier.name ?? tier.id) ? "border-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/20" : ""}`}
                    >
                      <div>
                        <div className="text-xs font-medium capitalize">{(tier.name ?? tier.id ?? "").replace(/_/g, " ")}</div>
                        {tier.apr && <div className="text-lg font-bold text-emerald-600">{parseFloat(tier.apr).toFixed(2)}% APR</div>}
                        {tier.min_balance !== undefined && (
                          <div className="text-[10px] text-muted-foreground">Min: ${Number(tier.min_balance).toLocaleString()}</div>
                        )}
                      </div>
                      {currentAprTier === (tier.name ?? tier.id) ? (
                        <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Active</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => cashInterestMutation.mutate({ action: "enroll", tier: tier.name ?? tier.id })}
                          disabled={cashInterestMutation.isPending}
                        >
                          Select
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground bg-muted/50 rounded p-3">
                  APR tier data not available in sandbox. In production, you'll see available rates here.
                </div>
              )}
              {cashInterestStatus === "ACTIVE" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs text-red-600 border-red-200"
                  onClick={() => cashInterestMutation.mutate({ action: "unenroll" })}
                  disabled={cashInterestMutation.isPending}
                >
                  Unenroll from Cash Interest
                </Button>
              )}
            </CardContent>
          </Card>
          <Alert className="border-amber-200 bg-amber-50/50 mt-2 py-2">
            <Info className="h-3.5 w-3.5 text-amber-600" />
            <AlertDescription className="text-xs text-amber-700">
              Interest earned in the US is reportable under India's Foreign Income rules. Declare under Schedule FSI (ITR-2/3) and claim Foreign Tax Credit for any US withholding.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* ─── Fully Paid Securities Lending (FPSL) ─────────────────────────── */}
      {accountId && (
        <div>
          <Separator className="my-2" />
          <div className="flex items-center gap-2 mb-3 mt-4">
            <Banknote className="h-4 w-4 text-indigo-600" />
            <span className="text-sm font-semibold">Fully Paid Securities Lending (FPSL)</span>
            {fpslStatus && (
              <Badge className={
                fpslStatus === "ACTIVE" ? "bg-green-100 text-green-700 text-xs" :
                fpslStatus === "PENDING_ENROLLMENT" ? "bg-amber-100 text-amber-700 text-xs" :
                fpslStatus === "TERMINATED" ? "bg-red-100 text-red-700 text-xs" :
                "bg-gray-100 text-gray-600 text-xs"
              }>
                {fpslStatus}
              </Badge>
            )}
          </div>
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                Allow Alpaca to lend out your fully-paid shares to other market participants (short sellers, etc.). You earn a share of the lending fee. Securities remain in your account and are protected by SIPC.
              </p>
              <div className="flex items-center gap-3">
                {!fpslStatus || fpslStatus === "TERMINATED" ? (
                  <Button
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => fpslMutation.mutate({ action: "enroll" })}
                    disabled={fpslMutation.isPending}
                  >
                    {fpslMutation.isPending ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : null}
                    Enroll in FPSL
                  </Button>
                ) : fpslStatus === "PENDING_ENROLLMENT" ? (
                  <Badge className="bg-amber-100 text-amber-700 text-xs py-1">Enrollment Pending</Badge>
                ) : fpslStatus === "ACTIVE" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs text-red-600 border-red-200"
                    onClick={() => fpslMutation.mutate({ action: "unenroll" })}
                    disabled={fpslMutation.isPending}
                  >
                    Terminate FPSL
                  </Button>
                ) : null}
                <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => refetchFpsl()}>
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
          <Alert className="border-blue-200 bg-blue-50/50 mt-2 py-2">
            <Info className="h-3.5 w-3.5 text-blue-600" />
            <AlertDescription className="text-xs text-blue-700">
              FPSL income is taxable as "Income from Other Sources" in India. The income is US-sourced; report under Schedule FSI and claim FTC for any US withholding. FPSL fees are typically paid as substitute payments — consult your CA for ITR treatment.
            </AlertDescription>
          </Alert>
        </div>
      )}

      <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => refetch()}>
        <RefreshCw className="h-3.5 w-3.5" /> Refresh Configuration
      </Button>
    </div>
  );
}
