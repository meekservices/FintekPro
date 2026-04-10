import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  ShieldAlert, ShieldCheck, ShieldX, Lock, Unlock, RefreshCw,
  AlertTriangle, CheckCircle2, Info, Settings2, Zap,
} from "lucide-react";

interface Restrictions {
  restrict_trading?: boolean;
  restrict_short_selling?: boolean;
  restrict_options_trading?: boolean;
  restrict_margin?: boolean;
  max_margin_multiplier?: number;
  suspend_trading?: boolean;
  dtbp_check?: string;
  no_shorting?: boolean;
  pattern_day_trader?: boolean;
  trade_confirm_email?: string;
}

interface Props {
  accountId?: string;
  accountStatus?: string;
}

export default function AccountRestrictionsPanel({ accountId, accountStatus }: Props) {
  const { toast } = useToast();
  const [suspendReason, setSuspendReason] = useState("");
  const [marginMultiplier, setMarginMultiplier] = useState("");
  const [pendingRestrictions, setPendingRestrictions] = useState<Restrictions | null>(null);

  const { data, isLoading, refetch } = useQuery<{ success: boolean; restrictions: Restrictions }>({
    queryKey: ["/api/broker/accounts", accountId, "restrictions"],
    queryFn: () => fetch(`/api/broker/accounts/${accountId}/restrictions`).then(r => r.json()),
    enabled: !!accountId,
    staleTime: 60_000,
  });

  const restrictions: Restrictions = data?.restrictions || {};
  const isSuspended = accountStatus === "ACCOUNT_SUSPENDED" || restrictions.suspend_trading;

  const updateMutation = useMutation({
    mutationFn: async (updates: Restrictions) => {
      const res = await apiRequest(`/api/broker/accounts/${accountId}/restrictions`, "PATCH", updates);
      return res;
    },
    onSuccess: () => {
      toast({ title: "Restrictions Updated", description: "Account restrictions saved successfully." });
      setPendingRestrictions(null);
      queryClient.invalidateQueries({ queryKey: ["/api/broker/accounts", accountId, "restrictions"] });
    },
    onError: (e: any) => {
      toast({ title: "Update Failed", description: e.message, variant: "destructive" });
    },
  });

  const suspendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(`/api/broker/accounts/${accountId}/suspend`, "POST", { reason: suspendReason });
      return res;
    },
    onSuccess: () => {
      toast({ title: "Account Suspended", description: "All trading has been halted on this account." });
      setSuspendReason("");
      refetch();
    },
    onError: (e: any) => {
      toast({ title: "Suspend Failed", description: e.message, variant: "destructive" });
    },
  });

  const reinstateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(`/api/broker/accounts/${accountId}/reinstate`, "POST", {});
      return res;
    },
    onSuccess: () => {
      toast({ title: "Account Reinstated", description: "Account is now active." });
      refetch();
    },
    onError: (e: any) => {
      toast({ title: "Reinstate Failed", description: e.message, variant: "destructive" });
    },
  });

  function toggleRestriction(key: keyof Restrictions, value: boolean) {
    const updates = { ...(pendingRestrictions || restrictions), [key]: value };
    setPendingRestrictions(updates);
  }

  function saveRestrictions() {
    if (!pendingRestrictions) return;
    const payload: Restrictions = { ...pendingRestrictions };
    if (marginMultiplier) payload.max_margin_multiplier = parseFloat(marginMultiplier);
    updateMutation.mutate(payload);
  }

  const hasPending = pendingRestrictions !== null;
  const current = pendingRestrictions || restrictions;

  if (!accountId) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>Connect your Alpaca account to manage restrictions.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <Alert className={isSuspended ? "border-red-300 bg-red-50 dark:bg-red-950/20" : "border-green-200 bg-green-50 dark:bg-green-950/20"}>
        {isSuspended ? <ShieldX className="h-4 w-4 text-red-600" /> : <ShieldCheck className="h-4 w-4 text-green-600" />}
        <AlertDescription className={isSuspended ? "text-red-700 dark:text-red-300" : "text-green-700 dark:text-green-300"}>
          <strong>Account Status:</strong>{" "}
          {isSuspended ? "SUSPENDED — All trading is halted." : "ACTIVE — Account is in good standing."}
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Trading Restrictions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Trading Restrictions
            </CardTitle>
            <CardDescription className="text-xs">
              Control what trading activities are permitted on this account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="py-4 text-center text-xs text-muted-foreground">Loading…</div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-medium">Restrict Trading</Label>
                    <p className="text-[10px] text-muted-foreground">Prevent all buy/sell orders</p>
                  </div>
                  <Switch
                    checked={!!current.restrict_trading}
                    onCheckedChange={v => toggleRestriction("restrict_trading", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-medium">Restrict Short Selling</Label>
                    <p className="text-[10px] text-muted-foreground">Disable shorting on this account</p>
                  </div>
                  <Switch
                    checked={!!current.restrict_short_selling || !!current.no_shorting}
                    onCheckedChange={v => toggleRestriction("restrict_short_selling", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-medium">Restrict Options Trading</Label>
                    <p className="text-[10px] text-muted-foreground">Prevent options orders</p>
                  </div>
                  <Switch
                    checked={!!current.restrict_options_trading}
                    onCheckedChange={v => toggleRestriction("restrict_options_trading", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-medium">Restrict Margin</Label>
                    <p className="text-[10px] text-muted-foreground">Disable margin borrowing</p>
                  </div>
                  <Switch
                    checked={!!current.restrict_margin}
                    onCheckedChange={v => toggleRestriction("restrict_margin", v)}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Max Margin Multiplier</Label>
                  <p className="text-[10px] text-muted-foreground">
                    Current: {restrictions.max_margin_multiplier ?? "N/A"}x
                  </p>
                  <Input
                    type="number"
                    placeholder="e.g. 2"
                    value={marginMultiplier}
                    onChange={e => setMarginMultiplier(e.target.value)}
                    className="h-7 text-xs"
                    min="1" max="4" step="1"
                  />
                </div>

                {hasPending && (
                  <Button
                    size="sm"
                    className="w-full text-xs"
                    onClick={saveRestrictions}
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? (
                      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                    )}
                    Save Restrictions
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Compliance Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              Compliance & PDT Status
            </CardTitle>
            <CardDescription className="text-xs">
              Pattern Day Trader rules and account flags
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="py-4 text-center text-xs text-muted-foreground">Loading…</div>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-1.5 border-b">
                    <span className="text-xs text-muted-foreground">Pattern Day Trader (PDT)</span>
                    <Badge variant={restrictions.pattern_day_trader ? "destructive" : "outline"} className="text-[10px]">
                      {restrictions.pattern_day_trader ? "⚠ PDT Flagged" : "✓ Not PDT"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b">
                    <span className="text-xs text-muted-foreground">Short Selling</span>
                    <Badge variant={restrictions.no_shorting ? "secondary" : "outline"} className="text-[10px]">
                      {restrictions.no_shorting ? "Disabled" : "Enabled"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b">
                    <span className="text-xs text-muted-foreground">Day Trade Buying Power Check</span>
                    <Badge variant="outline" className="text-[10px]">
                      {restrictions.dtbp_check || "entry"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b">
                    <span className="text-xs text-muted-foreground">Trade Confirm Email</span>
                    <Badge variant="outline" className="text-[10px]">
                      {restrictions.trade_confirm_email || "default"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-xs text-muted-foreground">Account Status</span>
                    <Badge
                      variant={isSuspended ? "destructive" : "default"}
                      className="text-[10px]"
                    >
                      {isSuspended ? "SUSPENDED" : "ACTIVE"}
                    </Badge>
                  </div>
                </div>

                <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 mt-2">
                  <Info className="h-3 w-3 text-amber-600" />
                  <AlertDescription className="text-[10px] text-amber-700 dark:text-amber-300">
                    <strong>India note:</strong> PDT rule requires $25K min balance. Indian users with &lt;$25K equity in a margin account are PDT-restricted to 3 day trades per 5 days. Use a cash account or maintain $25K+ to avoid PDT.
                  </AlertDescription>
                </Alert>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Suspend / Reinstate */}
      <Card className="border-red-200 dark:border-red-900">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-red-700 dark:text-red-400">
            <ShieldX className="h-4 w-4" />
            Account Suspension Controls
          </CardTitle>
          <CardDescription className="text-xs">
            Broker-level controls for compliance and AML enforcement
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isSuspended ? (
            <div className="flex items-center gap-3">
              <Alert className="border-red-300 bg-red-50 dark:bg-red-950/20 flex-1">
                <ShieldX className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-700 dark:text-red-300 text-xs">
                  This account is currently suspended. All trading is halted.
                </AlertDescription>
              </Alert>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" className="border-green-600 text-green-600 hover:bg-green-50 text-xs shrink-0">
                    <Unlock className="h-3 w-3 mr-1" />
                    Reinstate
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reinstate Account</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will re-activate the account and allow trading. Only do this after compliance review confirms the issue is resolved.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => reinstateMutation.mutate()}
                      disabled={reinstateMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {reinstateMutation.isPending ? "Reinstating…" : "Reinstate Account"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-xs">Suspension Reason (required)</Label>
              <Textarea
                value={suspendReason}
                onChange={e => setSuspendReason(e.target.value)}
                placeholder="e.g. AML alert triggered — pending investigation under PMLA / FEMA..."
                className="text-xs min-h-[60px]"
              />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={!suspendReason.trim()}
                    className="text-xs"
                  >
                    <Lock className="h-3 w-3 mr-1" />
                    Suspend Account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      Suspend Account?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This will immediately halt all trading. The user will not be able to place or cancel orders.
                      Reason: <em>{suspendReason}</em>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => suspendMutation.mutate()}
                      disabled={suspendMutation.isPending}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {suspendMutation.isPending ? "Suspending…" : "Confirm Suspend"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
