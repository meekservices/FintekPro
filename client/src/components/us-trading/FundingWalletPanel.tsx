/**
 * Funding Wallet Panel
 * Shows the user's dedicated virtual bank account details for LRS/SWIFT deposit.
 * Also shows deposit history and (in sandbox) a "Simulate Deposit" button.
 */
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Building2, Copy, RefreshCw, CheckCircle2, Landmark, AlertTriangle,
  BadgeIndianRupee, DollarSign, FlaskConical,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface FundingWalletPanelProps {
  alpacaAccountId: string;
  isSandbox?: boolean;
}

export default function FundingWalletPanel({ alpacaAccountId, isSandbox }: FundingWalletPanelProps) {
  const { toast } = useToast();
  const [simAmount, setSimAmount] = useState("1000");
  const [copied, setCopied] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery<{
    success: boolean;
    wallet: any;
    details: any[];
    transfers: any[];
  }>({
    queryKey: ["/api/us-trading/broker/accounts", alpacaAccountId, "funding-wallet"],
    queryFn: () => fetch(`/api/us-trading/broker/accounts/${alpacaAccountId}/funding-wallet`).then(r => r.json()),
    staleTime: 60_000,
  });

  const simulateMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/us-trading/broker/accounts/${alpacaAccountId}/funding-wallet/deposit-simulation`, {
      amount_usd: parseFloat(simAmount),
    }),
    onSuccess: () => {
      toast({ title: "Simulated deposit triggered", description: `$${simAmount} deposit queued in sandbox` });
      queryClient.invalidateQueries({ queryKey: ["/api/us-trading/broker/accounts", alpacaAccountId, "funding-wallet"] });
    },
    onError: (e: any) => toast({ title: "Simulation failed", description: e.message, variant: "destructive" }),
  });

  function copyToClipboard(value: string, label: string) {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
      toast({ title: "Copied!", description: `${label} copied to clipboard` });
    });
  }

  function CopyButton({ value, label }: { value: string; label: string }) {
    return (
      <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => copyToClipboard(value, label)}>
        {copied === label ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    );
  }

  const wallet = data?.wallet;
  const details: any[] = data?.details ?? [];
  const transfers: any[] = data?.transfers ?? [];

  const bankDetail = details[0];

  return (
    <div className="space-y-5">
      {/* LRS Info Banner */}
      <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
        <BadgeIndianRupee className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-sm text-blue-700 dark:text-blue-300">
          <strong>LRS (Liberalised Remittance Scheme):</strong> RBI allows up to USD 250,000 per financial year for overseas investment. Wire your INR to the account below — your bank handles the SWIFT transfer and TCS deduction.
        </AlertDescription>
      </Alert>

      {/* Wallet Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Wire Details Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Landmark className="h-4 w-4 text-primary" /> Your Dedicated Deposit Account
            </CardTitle>
            <CardDescription className="text-xs">
              Use these details to wire USD from your Indian bank. Reference your account ID.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!bankDetail ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                No deposit details available yet. Contact support to activate your funding wallet.
              </div>
            ) : (
              <dl className="space-y-3 text-sm">
                {[
                  { label: "Beneficiary Name", value: bankDetail.account_name },
                  { label: "Account Number", value: bankDetail.account_number, mono: true },
                  { label: "Routing Number", value: bankDetail.routing_number },
                  { label: "SWIFT / BIC", value: bankDetail.swift_code },
                  { label: "Bank Name", value: bankDetail.bank_name },
                  { label: "Bank Address", value: bankDetail.bank_address },
                  { label: "Currency", value: bankDetail.currency },
                  { label: "Reference / Memo", value: bankDetail.reference || wallet?.id, mono: true },
                ].filter(r => r.value).map(({ label, value, mono }) => (
                  <div key={label} className="flex items-start justify-between gap-2">
                    <dt className="text-muted-foreground shrink-0 min-w-[120px]">{label}</dt>
                    <dd className={`font-medium text-right flex items-center gap-1 ${mono ? "font-mono text-xs" : ""}`}>
                      {value}
                      <CopyButton value={value!} label={label} />
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>

        {/* Status + Sandbox simulation */}
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">Wallet Status</span>
                <Badge className={
                  wallet?.status === "ACTIVE" ? "bg-green-100 text-green-700" :
                  "bg-yellow-100 text-yellow-700"
                }>
                  {wallet?.status || "PENDING"}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" />
                Wallet ID: <span className="font-mono">{wallet?.id?.slice(0, 16)}…</span>
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <DollarSign className="h-3.5 w-3.5" />
                Currency: {wallet?.currency || "USD"}
              </div>
              <Button variant="ghost" size="sm" className="mt-3 h-7 gap-1 text-xs" onClick={() => refetch()}>
                <RefreshCw className="h-3 w-3" /> Refresh
              </Button>
            </CardContent>
          </Card>

          {/* Sandbox simulation */}
          {isSandbox && (
            <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <FlaskConical className="h-4 w-4 text-amber-600" /> Sandbox: Simulate Deposit
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Amount (USD)</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      type="number"
                      value={simAmount}
                      onChange={e => setSimAmount(e.target.value)}
                      className="h-8 text-sm"
                      min="1"
                    />
                    <Button
                      size="sm"
                      className="h-8 shrink-0"
                      onClick={() => simulateMutation.mutate()}
                      disabled={simulateMutation.isPending}
                    >
                      {simulateMutation.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : "Simulate"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Triggers a test deposit in the sandbox environment.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Transfer History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Deposit History</CardTitle>
        </CardHeader>
        <CardContent>
          {transfers.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              No deposits yet. Wire funds to the account above to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs">{t.created_at ? new Date(t.created_at).toLocaleDateString("en-IN") : "—"}</TableCell>
                    <TableCell className="font-medium">${parseFloat(t.amount || "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell>{t.currency || "USD"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        t.status === "COMPLETE" ? "text-green-700 border-green-300" :
                        t.status === "PENDING" ? "text-yellow-700 border-yellow-300" :
                        "text-red-700 border-red-300"
                      }>
                        {t.status || "PENDING"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
