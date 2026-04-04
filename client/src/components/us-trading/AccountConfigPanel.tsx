/**
 * Account Configuration Panel
 * Controls PDT protection, short selling, fractional trading, options level, trade confirmations.
 */
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Settings, Shield, AlertTriangle, RefreshCw, TrendingDown, Percent } from "lucide-react";
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

  const configItems = [
    {
      key: "no_shorting" as const,
      label: "Disable Short Selling",
      description: "Prevent short orders. Enable to only allow long positions.",
      icon: TrendingDown,
      value: config.no_shorting,
      warning: !config.no_shorting ? undefined : undefined,
    },
    {
      key: "fractional_trading" as const,
      label: "Fractional Trading",
      description: "Allow fractional share and notional-amount orders (e.g. 'Invest $500 in AAPL').",
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

        {/* Margin Multiplier */}
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

      <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => refetch()}>
        <RefreshCw className="h-3.5 w-3.5" /> Refresh Configuration
      </Button>
    </div>
  );
}
