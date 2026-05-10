/**
 * Funding Wallet Panel
 * Shows the user's dedicated virtual bank account details for LRS/SWIFT deposit.
 * Includes step-by-step SWIFT wire guide for Indian investors.
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
import { Separator } from "@/components/ui/separator";
import {
  Building2, Copy, RefreshCw, CheckCircle2, Landmark, AlertTriangle,
  BadgeIndianRupee, DollarSign, FlaskConical, Info, ArrowRight, FileText,
  Globe, Receipt, ShieldCheck,
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
  const [showGuide, setShowGuide] = useState(false);

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

  const { data: swiftData } = useQuery<{ success: boolean; instructions: any }>({
    queryKey: ["/api/us-trading/funding/swift-instructions"],
    staleTime: 3_600_000,
  });

  const simulateMutation = useMutation({
    mutationFn: () => apiRequest(`/api/us-trading/broker/accounts/${alpacaAccountId}/funding-wallet/deposit-simulation`, {
      method: "POST",
      body: JSON.stringify({ amount_usd: parseFloat(simAmount) }),
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
  const swiftInstructions = swiftData?.instructions;

  return (
    <div className="space-y-5">
      {/* LRS Info Banner */}
      <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
        <BadgeIndianRupee className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-sm text-blue-700 dark:text-blue-300">
          <strong>LRS (Liberalised Remittance Scheme) — RBI Master Direction:</strong> RBI allows up to USD 250,000 per financial year for overseas portfolio investment. Wire USD from your AD Category-I bank (SBI, HDFC, ICICI, Axis, etc.) using the account details below.
        </AlertDescription>
      </Alert>

      {/* TCS Disclosure Banner — Finance Act 2023 */}
      <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-sm text-amber-700 dark:text-amber-300">
          <strong>TCS Notice (Finance Act 2023 — Section 206C(1G)):</strong> Your AD bank will collect <strong>20% Tax at Source (TCS)</strong> on LRS remittances exceeding ₹7 lakh per financial year (effective October 1, 2023). TCS is creditable against your income tax when you file ITR. Keep Form 26AS updated.
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
              Wire USD from your Indian bank to this account. Always use your account ID as the reference/memo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!bankDetail ? (
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground text-center py-2">
                  Your personal USD account details will appear here once your account is active.
                </div>
                {/* Show intermediary details from SWIFT instructions as reference */}
                {swiftInstructions && (
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-xs">
                    <p className="font-medium text-foreground">Standard Intermediary Bank Reference:</p>
                    {[
                      { label: "Intermediary Bank", value: swiftInstructions.intermediary_bank_name },
                      { label: "SWIFT / BIC", value: swiftInstructions.intermediary_swift_bic, mono: true },
                      { label: "ABA / Routing", value: swiftInstructions.intermediary_aba, mono: true },
                      { label: "Currency", value: swiftInstructions.currency },
                    ].map(({ label, value, mono }) => (
                      <div key={label} className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">{label}</span>
                        <span className={`font-medium flex items-center gap-1 ${mono ? "font-mono" : ""}`}>
                          {value}
                          <CopyButton value={value!} label={label} />
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <dl className="space-y-3 text-sm">
                {[
                  { label: "Beneficiary Name", value: bankDetail.account_name },
                  { label: "Account Number", value: bankDetail.account_number, mono: true },
                  { label: "Routing Number (ABA)", value: bankDetail.routing_number, mono: true },
                  { label: "SWIFT / BIC", value: bankDetail.swift_code, mono: true },
                  { label: "Bank Name", value: bankDetail.bank_name },
                  { label: "Bank Address", value: bankDetail.bank_address },
                  { label: "Currency", value: bankDetail.currency || "USD" },
                  { label: "Reference / Memo", value: bankDetail.reference || wallet?.id, mono: true },
                ].filter(r => r.value).map(({ label, value, mono }) => (
                  <div key={label} className="flex items-start justify-between gap-2">
                    <dt className="text-muted-foreground shrink-0 min-w-[140px]">{label}</dt>
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
                Wallet ID: <span className="font-mono">{wallet?.id?.slice(0, 16) ?? "—"}…</span>
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <DollarSign className="h-3.5 w-3.5" />
                Currency: {wallet?.currency || "USD"}
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <Globe className="h-3.5 w-3.5" />
                Purpose Code: S0001 (LRS Portfolio Investment)
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

      {/* SWIFT Wire Guide — Accordion */}
      <Card>
        <CardHeader className="pb-3 cursor-pointer" onClick={() => setShowGuide(g => !g)}>
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              How to Wire from India — Step-by-Step LRS Guide
            </span>
            <ArrowRight className={`h-4 w-4 text-muted-foreground transition-transform ${showGuide ? "rotate-90" : ""}`} />
          </CardTitle>
        </CardHeader>
        {showGuide && (
          <CardContent className="space-y-4 pt-0">
            <Separator />

            {/* Intermediary Bank Details */}
            {swiftInstructions && (
              <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4 space-y-2">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                  Intermediary / Correspondent Bank (SWIFT)
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  {[
                    { label: "Bank Name", value: swiftInstructions.intermediary_bank_name },
                    { label: "SWIFT / BIC", value: swiftInstructions.intermediary_swift_bic, mono: true },
                    { label: "ABA Routing", value: swiftInstructions.intermediary_aba, mono: true },
                    { label: "Address", value: swiftInstructions.intermediary_address },
                  ].map(({ label, value, mono }) => (
                    <div key={label}>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className={`font-medium text-foreground flex items-center gap-1 ${mono ? "font-mono text-xs" : "text-sm"}`}>
                        {value}
                        <CopyButton value={value!} label={label} />
                      </p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Note: Your beneficiary account number is unique to your FintekPro account — shown above in the Wire Details section.
                </p>
              </div>
            )}

            {/* Steps */}
            <div className="space-y-3">
              {(swiftInstructions?.steps ?? defaultSteps).map((s: any) => (
                <div key={s.step} className="flex gap-3">
                  <div className="flex-none w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                    {s.step}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{s.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Compliance Callouts */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="flex items-start gap-2 bg-muted/40 rounded-lg p-3">
                <Receipt className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold">Form A2</p>
                  <p className="text-xs text-muted-foreground">Required at your AD bank for every LRS wire transfer</p>
                </div>
              </div>
              <div className="flex items-start gap-2 bg-muted/40 rounded-lg p-3">
                <ShieldCheck className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold">Purpose Code: S0001</p>
                  <p className="text-xs text-muted-foreground">RBI code for overseas portfolio investment under FEMA</p>
                </div>
              </div>
              <div className="flex items-start gap-2 bg-muted/40 rounded-lg p-3">
                <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold">LRS Limit: $250,000/FY</p>
                  <p className="text-xs text-muted-foreground">Resets April 1. PAN linked to Aadhaar mandatory</p>
                </div>
              </div>
            </div>

            {/* Important Notes */}
            {swiftInstructions?.important_notes && (
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-amber-700 mb-2">Important Notes</p>
                <ul className="space-y-1">
                  {swiftInstructions.important_notes.map((note: string, i: number) => (
                    <li key={i} className="text-xs text-amber-700 dark:text-amber-300 flex items-start gap-1.5">
                      <span className="mt-1 shrink-0">•</span>
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        )}
      </Card>

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

const defaultSteps = [
  { step: 1, title: "Get your unique USD account details", description: "Find your dedicated Alpaca beneficiary account number in the Funding Wallet section above." },
  { step: 2, title: "Visit your AD bank's LRS/forex desk", description: "Authorised dealers: SBI, HDFC, ICICI, Axis, Kotak, YES Bank. Also: Wise, HDFC Remit." },
  { step: 3, title: "Fill Form A2", description: "FEMA declaration — purpose: 'Overseas portfolio investment in US listed equities'. Purpose code: S0001." },
  { step: 4, title: "Provide PAN and KYC", description: "PAN mandatory for LRS. Ensure PAN is linked to Aadhaar (post-April 2023 requirement)." },
  { step: 5, title: "Initiate SWIFT wire transfer in USD", description: "Send USD (not INR) to your Alpaca account. Include your account ID as the payment reference/memo." },
  { step: 6, title: "Track settlement (2–5 business days)", description: "International SWIFT wires typically settle in 2–5 business days. Check your Deposit History above." },
  { step: 7, title: "Maintain ITR records", description: "Report US assets in Schedule FA, US income in Schedule FSI. Consult a CA for DTAA benefits." },
];
