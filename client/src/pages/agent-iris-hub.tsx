import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import {
  TrendingUp, Users, IndianRupee, Activity, Shield, FileText,
  BarChart3, RefreshCw, Search, ExternalLink, ArrowUpRight,
  ChevronRight, AlertCircle, CheckCircle2, Clock, Download, KeyRound, XCircle
} from "lucide-react";

// ─── IRIS API types ───────────────────────────────────────────────────────────

interface IrisStatusData {
  configured: boolean;
  authenticated: boolean;
  tokenExpiresAt?: number;
}

interface IrisApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface AumData { totalAum?: number; aum?: number }
interface EarningsData { totalEarnings?: number; earnings?: number }
interface SipSummaryData { activeSips?: number; sipCount?: number }
interface InvestorCountData { count?: number; uniqueInvestors?: number }

interface AmcEmpanelment {
  amcName?: string;
  name?: string;
  amcCode?: string;
  code?: string;
  status?: string;
  empanelmentId?: string;
}

interface FdProduct { name?: string; productName?: string; status?: string }
interface NpsData { status?: string; distributor?: string }

interface IrisInvestor {
  pan?: string;
  PAN?: string;
  name?: string;
  investorName?: string;
  mobile?: string;
  mobileNo?: string;
}

interface KycData { kycStatus?: string; kycType?: string }

interface PortfolioSummary {
  currentValue?: number;
  investedValue?: number;
  gainLoss?: number;
  xirr?: number;
}

interface Holding {
  schemeName?: string;
  scheme?: string;
  units?: number;
  currentValue?: number;
  gainLossPercentage?: number;
}

interface Transaction {
  schemeName?: string;
  scheme?: string;
  amount?: number;
  transactionType?: string;
  type?: string;
  transactionDate?: string;
  date?: string;
  status?: string;
}

interface SipRecord {
  schemeName?: string;
  scheme?: string;
  amount?: number;
  frequency?: string;
  status?: string;
  nextInstallmentDate?: string;
  nextDate?: string;
  schemeCode?: string;
  isinCode?: string;
  sipRegistrationNo?: string;
  folioNo?: string;
}

interface SchemeResult {
  schemeCode?: string;
  isinCode?: string;
  code?: string;
  schemeName?: string;
  name?: string;
}

interface FundHouse { fundName?: string; name?: string }

interface ProductLink { url?: string; link?: string; name?: string; title?: string; productName?: string }

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function irisGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  const json = await res.json() as T;
  if (!res.ok) {
    const msg = (json as { message?: string })?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

function fmt(num: number | null | undefined): string {
  if (num == null) return "—";
  if (num >= 1e7) return "₹" + (num / 1e7).toFixed(2) + " Cr";
  if (num >= 1e5) return "₹" + (num / 1e5).toFixed(2) + " L";
  return "₹" + num.toLocaleString("en-IN");
}

// ─── Components ───────────────────────────────────────────────────────────────

function StatCard({ title, value, subtitle, icon: Icon, loading }: {
  title: string;
  value?: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {loading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className="text-2xl font-bold mt-1">{value ?? "—"}</p>}
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function IrisStatusBadge() {
  const { data, isLoading } = useQuery<IrisApiResponse<IrisStatusData>>({
    queryKey: ["/api/iris/status"],
    retry: false,
  });
  const status = data?.data;
  if (isLoading) return <Skeleton className="h-6 w-32" />;
  return (
    <div className="flex items-center gap-3">
      {status?.authenticated ? (
        <Badge className="bg-green-500 text-white">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Connected
        </Badge>
      ) : status?.configured ? (
        <Badge variant="secondary">
          <Clock className="h-3 w-3 mr-1" /> Credentials set, not authenticated
        </Badge>
      ) : (
        <Badge variant="destructive">
          <AlertCircle className="h-3 w-3 mr-1" /> Not configured
        </Badge>
      )}
      {status?.tokenExpiresAt && (
        <span className="text-xs text-muted-foreground">
          Token expires: {new Date(status.tokenExpiresAt).toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}

// ─── Dashboard Tab ─────────────────────────────────────────────────────────────
function DashboardTab() {
  const { data: aum, isLoading: aumL } = useQuery<IrisApiResponse<AumData>>({ queryKey: ["/api/iris/dashboard/aum-summary"], retry: false });
  const { data: earn, isLoading: earnL } = useQuery<IrisApiResponse<EarningsData>>({ queryKey: ["/api/iris/dashboard/fund-earnings"], retry: false });
  const { data: sip, isLoading: sipL } = useQuery<IrisApiResponse<SipSummaryData>>({ queryKey: ["/api/iris/dashboard/sip-summary"], retry: false });
  const { data: inv, isLoading: invL } = useQuery<IrisApiResponse<InvestorCountData>>({ queryKey: ["/api/iris/dashboard/unique-investors"], retry: false });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total AUM" value={fmt(aum?.data?.totalAum ?? aum?.data?.aum)} icon={IndianRupee} loading={aumL} subtitle="Assets Under Management" />
        <StatCard title="Fund Earnings" value={fmt(earn?.data?.totalEarnings ?? earn?.data?.earnings)} icon={TrendingUp} loading={earnL} subtitle="Trail commission" />
        <StatCard title="Active SIPs" value={sip?.data?.activeSips != null ? sip.data.activeSips.toLocaleString() : sip?.data?.sipCount?.toLocaleString()} icon={Activity} loading={sipL} subtitle="Running systematic plans" />
        <StatCard title="Unique Investors" value={inv?.data?.count != null ? inv.data.count.toLocaleString() : inv?.data?.uniqueInvestors?.toLocaleString()} icon={Users} loading={invL} subtitle="Total investor base" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">IRIS / KFintech Status</CardTitle>
          <CardDescription>MF, AIF, PMS, FD, NPS execution via IRIS distributor platform</CardDescription>
        </CardHeader>
        <CardContent><IrisStatusBadge /></CardContent>
      </Card>
    </div>
  );
}

// ─── Empanelment Tab ──────────────────────────────────────────────────────────
function EmpanelmentTab() {
  const { data: amcList, isLoading: amcL } = useQuery<IrisApiResponse<{ amcs?: AmcEmpanelment[] }>>({ queryKey: ["/api/iris/empanelment/amc-list"], retry: false });
  const { data: fd, isLoading: fdL } = useQuery<IrisApiResponse<{ products?: FdProduct[] }>>({ queryKey: ["/api/iris/empanelment/fd-status"], retry: false });
  const { data: nps, isLoading: npsL } = useQuery<IrisApiResponse<NpsData>>({ queryKey: ["/api/iris/empanelment/nps-status"], retry: false });
  const { toast } = useToast();

  const resendEsign = useMutation({
    mutationFn: (empanelmentId: string) =>
      apiRequest("/api/iris/empanelment/resend-esign", "POST", { body: { empanelmentId } }),
    onSuccess: () => toast({ title: "eSign link sent successfully" }),
    onError: () => toast({ title: "Failed to send eSign link", variant: "destructive" }),
  });

  const amcData: AmcEmpanelment[] = amcList?.data?.amcs ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Fixed Deposit Empanelment</CardTitle></CardHeader>
          <CardContent>
            {fdL ? <Skeleton className="h-10 w-full" /> : (
              <div className="space-y-2">
                {(fd?.data?.products ?? []).map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span>{p.name ?? p.productName}</span>
                    <Badge variant={p.status === 'ACTIVE' ? 'default' : 'secondary'}>{p.status}</Badge>
                  </div>
                ))}
                {!(fd?.data?.products?.length) && <p className="text-sm text-muted-foreground">No FD empanelment data</p>}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">NPS Distributor Empanelment</CardTitle></CardHeader>
          <CardContent>
            {npsL ? <Skeleton className="h-10 w-full" /> : (
              nps?.data ? (
                <div className="flex items-center gap-2">
                  <Badge variant={nps.data.status === 'ACTIVE' ? 'default' : 'secondary'}>{nps.data.status ?? 'Unknown'}</Badge>
                  {nps.data.distributor && <span className="text-sm text-muted-foreground">{nps.data.distributor}</span>}
                </div>
              ) : <p className="text-sm text-muted-foreground">No NPS empanelment data</p>
            )}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">AMC Empanelment Status</CardTitle>
          <CardDescription>MF fund house empanelment — click resend to trigger eSign email</CardDescription>
        </CardHeader>
        <CardContent>
          {amcL ? (
            <div className="space-y-2">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : amcData.length > 0 ? (
            <div className="divide-y">
              {amcData.map((amc, i) => (
                <div key={i} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{amc.amcName ?? amc.name}</p>
                    <p className="text-xs text-muted-foreground">{amc.amcCode ?? amc.code}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={amc.status === 'ACTIVE' ? 'default' : amc.status === 'PENDING' ? 'secondary' : 'outline'}>
                      {amc.status ?? 'Unknown'}
                    </Badge>
                    {amc.status !== 'ACTIVE' && amc.empanelmentId && (
                      <Button size="sm" variant="outline"
                        onClick={() => resendEsign.mutate(amc.empanelmentId!)}
                        disabled={resendEsign.isPending}>
                        Resend eSign
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No AMC empanelment data available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── SIP action types ────────────────────────────────────────────────────────
interface SipActionPayload {
  pan: string;
  schemeCode?: string;
  sipRegistrationNo?: string;
  folioNo?: string;
  action: "pause" | "cancel";
}

// ─── Investors Tab ────────────────────────────────────────────────────────────
type InvestorDetailTab = "portfolio" | "holdings" | "transactions" | "sips";

function InvestorsTab() {
  const [search, setSearch] = useState("");
  const [selectedPan, setSelectedPan] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<InvestorDetailTab>("portfolio");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: investorsData, isLoading: invL } = useQuery<IrisApiResponse<{ investors?: IrisInvestor[] } | IrisInvestor[]>>({
    queryKey: ["/api/iris/investors", search],
    queryFn: () => irisGet<IrisApiResponse<{ investors?: IrisInvestor[] } | IrisInvestor[]>>(`/api/iris/investors${search ? `?search=${encodeURIComponent(search)}` : ""}`),
    retry: false,
  });

  const { data: kycData, isLoading: kycL } = useQuery<IrisApiResponse<KycData>>({
    queryKey: ["/api/iris/investors", selectedPan, "kyc"],
    queryFn: () => irisGet<IrisApiResponse<KycData>>(`/api/iris/investors/${selectedPan}/kyc`),
    enabled: !!selectedPan,
    retry: false,
  });

  const { data: portfolioData, isLoading: portfolioL } = useQuery<IrisApiResponse<PortfolioSummary>>({
    queryKey: ["/api/iris/investors", selectedPan, "portfolio-summary"],
    queryFn: () => irisGet<IrisApiResponse<PortfolioSummary>>(`/api/iris/investors/${selectedPan}/portfolio-summary`),
    enabled: !!selectedPan,
    retry: false,
  });

  const { data: holdingsData, isLoading: holdingsL } = useQuery<IrisApiResponse<{ holdings?: Holding[]; investments?: Holding[] }>>({
    queryKey: ["/api/iris/investors", selectedPan, "investments"],
    queryFn: () => irisGet<IrisApiResponse<{ holdings?: Holding[]; investments?: Holding[] }>>(`/api/iris/investors/${selectedPan}/investments`),
    enabled: !!selectedPan && detailTab === "holdings",
    retry: false,
  });

  const { data: txnsData, isLoading: txnsL } = useQuery<IrisApiResponse<{ transactions?: Transaction[] } | Transaction[]>>({
    queryKey: ["/api/iris/investors", selectedPan, "transactions"],
    queryFn: () => irisGet<IrisApiResponse<{ transactions?: Transaction[] } | Transaction[]>>(`/api/iris/investors/${selectedPan}/transactions`),
    enabled: !!selectedPan && detailTab === "transactions",
    retry: false,
  });

  const { data: sipsData, isLoading: sipsL } = useQuery<IrisApiResponse<{ sips?: SipRecord[] }>>({
    queryKey: ["/api/iris/investors", selectedPan, "systematic-plans"],
    queryFn: () => irisGet<IrisApiResponse<{ sips?: SipRecord[] }>>(`/api/iris/investors/${selectedPan}/systematic-plans`),
    enabled: !!selectedPan && (detailTab === "sips" || detailTab === "portfolio"),
    retry: false,
  });

  const sendEkyc = useMutation({
    mutationFn: (pan: string) => apiRequest(`/api/iris/investors/${pan}/send-ekyc-mail`, "POST"),
    onSuccess: () => toast({ title: "eKYC mail sent" }),
    onError: () => toast({ title: "Failed to send eKYC mail", variant: "destructive" }),
  });

  const sipPause = useMutation({
    mutationFn: (payload: SipActionPayload) =>
      apiRequest("/api/iris/transactions/sip/pause", "POST", { body: payload }),
    onSuccess: () => {
      toast({ title: "SIP paused successfully" });
      qc.invalidateQueries({ queryKey: ["/api/iris/investors", selectedPan, "systematic-plans"] });
    },
    onError: (err: Error) => toast({ title: "Failed to pause SIP", description: err.message, variant: "destructive" }),
  });

  const sipCancel = useMutation({
    mutationFn: (payload: SipActionPayload) =>
      apiRequest("/api/iris/transactions/sip/cancel", "POST", { body: payload }),
    onSuccess: () => {
      toast({ title: "SIP cancellation submitted" });
      qc.invalidateQueries({ queryKey: ["/api/iris/investors", selectedPan, "systematic-plans"] });
    },
    onError: (err: Error) => toast({ title: "Failed to cancel SIP", description: err.message, variant: "destructive" }),
  });

  function resolveInvestors(): IrisInvestor[] {
    if (!investorsData?.data) return [];
    if (Array.isArray(investorsData.data)) return investorsData.data;
    if ('investors' in investorsData.data) return investorsData.data.investors ?? [];
    return [];
  }

  function resolveHoldings(): Holding[] {
    if (!holdingsData?.data) return [];
    return holdingsData.data.holdings ?? holdingsData.data.investments ?? [];
  }

  function resolveTxns(): Transaction[] {
    if (!txnsData?.data) return [];
    if (Array.isArray(txnsData.data)) return txnsData.data;
    if ('transactions' in txnsData.data) return txnsData.data.transactions ?? [];
    return [];
  }

  const investors = resolveInvestors();
  const holdings = resolveHoldings();
  const txns = resolveTxns();
  const sips = sipsData?.data?.sips ?? [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      <div className="md:col-span-2 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, PAN…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Card>
          <CardContent className="p-0">
            {invL ? (
              <div className="p-4 space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : investors.length > 0 ? (
              <ScrollArea className="h-[420px]">
                <div className="divide-y">
                  {investors.map((inv, i) => {
                    const pan = inv.pan ?? inv.PAN ?? "";
                    return (
                      <button key={i}
                        className={`w-full flex items-center justify-between p-3 hover:bg-muted/50 text-left transition-colors ${selectedPan === pan ? 'bg-muted' : ''}`}
                        onClick={() => { setSelectedPan(pan); setDetailTab("portfolio"); }}>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{inv.name ?? inv.investorName}</p>
                          <p className="text-xs text-muted-foreground">{pan} · {inv.mobile ?? inv.mobileNo ?? ''}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : (
              <p className="p-4 text-sm text-muted-foreground">No investors found</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="md:col-span-3">
        {selectedPan ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{selectedPan}</p>
                <div className="flex items-center gap-2 mt-1">
                  {kycL ? <Skeleton className="h-5 w-24" /> : (
                    <Badge variant={kycData?.data?.kycStatus === 'KYC_VERIFIED' ? 'default' : 'secondary'}>
                      {kycData?.data?.kycStatus ?? 'KYC Unknown'}
                    </Badge>
                  )}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => sendEkyc.mutate(selectedPan)} disabled={sendEkyc.isPending}>
                Send eKYC Mail
              </Button>
            </div>

            <div className="flex gap-1 flex-wrap">
              {(["portfolio", "holdings", "transactions", "sips"] as InvestorDetailTab[]).map(tab => (
                <Button key={tab} size="sm" variant={detailTab === tab ? "default" : "outline"}
                  onClick={() => setDetailTab(tab)} className="capitalize text-xs">
                  {tab === "sips" ? "SIPs/STPs" : tab}
                </Button>
              ))}
            </div>

            {detailTab === "portfolio" && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Portfolio Summary</CardTitle></CardHeader>
                <CardContent>
                  {portfolioL ? <Skeleton className="h-20 w-full" /> : (
                    <div className="grid grid-cols-2 gap-3">
                      <div><p className="text-xs text-muted-foreground">Current Value</p><p className="font-semibold">{fmt(portfolioData?.data?.currentValue)}</p></div>
                      <div><p className="text-xs text-muted-foreground">Invested</p><p className="font-semibold">{fmt(portfolioData?.data?.investedValue)}</p></div>
                      <div>
                        <p className="text-xs text-muted-foreground">Gain/Loss</p>
                        <p className={`font-semibold ${(portfolioData?.data?.gainLoss ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {fmt(portfolioData?.data?.gainLoss)}
                        </p>
                      </div>
                      <div><p className="text-xs text-muted-foreground">XIRR</p><p className="font-semibold">{portfolioData?.data?.xirr ?? "—"}%</p></div>
                    </div>
                  )}
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Running SIPs</p>
                    {sipsL ? <Skeleton className="h-10 w-full" /> : sips.length > 0 ? (
                      <div className="space-y-1">
                        {sips.slice(0, 4).map((s, i) => (
                          <div key={i} className="flex justify-between text-xs">
                            <span className="truncate max-w-[65%]">{s.schemeName ?? s.scheme}</span>
                            <span>{fmt(s.amount)}/mo</span>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-xs text-muted-foreground">No running SIPs</p>}
                  </div>
                </CardContent>
              </Card>
            )}

            {detailTab === "holdings" && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Fund-wise Holdings</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {holdingsL ? (
                    <div className="p-4 space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
                  ) : (
                    <ScrollArea className="h-[320px]">
                      <div className="divide-y">
                        {holdings.map((h, i) => (
                          <div key={i} className="p-3">
                            <p className="text-sm font-medium">{h.schemeName ?? h.scheme}</p>
                            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                              <span>{h.units != null ? Number(h.units).toFixed(3) + " units" : ""}</span>
                              <span className="font-medium text-foreground">{fmt(h.currentValue)}</span>
                            </div>
                            {h.gainLossPercentage != null && (
                              <p className={`text-xs mt-0.5 ${h.gainLossPercentage >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {h.gainLossPercentage.toFixed(2)}%
                              </p>
                            )}
                          </div>
                        ))}
                        {!holdings.length && <p className="p-4 text-sm text-muted-foreground">No holdings data</p>}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            )}

            {detailTab === "transactions" && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Transaction History</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {txnsL ? (
                    <div className="p-4 space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
                  ) : (
                    <ScrollArea className="h-[320px]">
                      <div className="divide-y">
                        {txns.map((t, i) => (
                          <div key={i} className="p-3">
                            <div className="flex justify-between">
                              <p className="text-sm font-medium truncate max-w-[60%]">{t.schemeName ?? t.scheme}</p>
                              <p className="text-sm">{fmt(t.amount)}</p>
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                              <span>{t.transactionType ?? t.type} · {t.transactionDate ?? t.date}</span>
                              <Badge variant={t.status === 'SUCCESS' ? 'default' : t.status === 'PENDING' ? 'secondary' : 'destructive'} className="text-[10px] h-4">
                                {t.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                        {!txns.length && <p className="p-4 text-sm text-muted-foreground">No transaction history</p>}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            )}

            {detailTab === "sips" && (
              <Card>
                <CardHeader><CardTitle className="text-sm">SIPs / STPs / SWPs</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {sipsL ? (
                    <div className="p-4 space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
                  ) : (
                    <ScrollArea className="h-[320px]">
                      <div className="divide-y">
                        {sips.map((s, i) => {
                          const sipPayloadBase: Omit<SipActionPayload, "action"> = {
                            pan: selectedPan!,
                            schemeCode: s.schemeCode ?? s.isinCode,
                            sipRegistrationNo: s.sipRegistrationNo,
                            folioNo: s.folioNo,
                          };
                          return (
                            <div key={i} className="p-3">
                              <div className="flex justify-between items-start">
                                <p className="text-sm font-medium truncate max-w-[60%]">{s.schemeName ?? s.scheme}</p>
                                <Badge variant={s.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-[10px] h-4">{s.status}</Badge>
                              </div>
                              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                <span>{fmt(s.amount)}/mo · {s.frequency}</span>
                                <span>Next: {s.nextInstallmentDate ?? s.nextDate ?? "—"}</span>
                              </div>
                              {s.status === 'ACTIVE' && (
                                <div className="flex gap-1.5 mt-2">
                                  <Button size="sm" variant="outline" className="h-6 text-[11px] px-2"
                                    disabled={sipPause.isPending}
                                    onClick={() => sipPause.mutate({ ...sipPayloadBase, action: "pause" })}>
                                    Pause
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-6 text-[11px] px-2 text-destructive hover:text-destructive"
                                    disabled={sipCancel.isPending}
                                    onClick={() => sipCancel.mutate({ ...sipPayloadBase, action: "cancel" })}>
                                    Cancel
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {!sips.length && <p className="p-4 text-sm text-muted-foreground">No systematic plans</p>}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <Card className="flex items-center justify-center min-h-[300px]">
            <p className="text-sm text-muted-foreground">Select an investor to view details</p>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── Transact Tab ─────────────────────────────────────────────────────────────
type TransactType = "lumpsum" | "sip" | "redemption";

function TransactTab() {
  const [modalOpen, setModalOpen] = useState(false);
  const [transactType, setTransactType] = useState<TransactType>("lumpsum");
  const [pan, setPan] = useState("");
  const [schemeQuery, setSchemeQuery] = useState("");
  const [selectedScheme, setSelectedScheme] = useState<SchemeResult | null>(null);
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState("MONTHLY");
  const { toast } = useToast();

  const { data: fundsData } = useQuery<IrisApiResponse<{ funds?: FundHouse[] } | FundHouse[]>>({
    queryKey: ["/api/iris/transactions/funds"],
    retry: false,
  });

  const funds: FundHouse[] = (() => {
    if (!fundsData?.data) return [];
    if (Array.isArray(fundsData.data)) return fundsData.data;
    return fundsData.data.funds ?? [];
  })();

  const { data: schemeSearchData, isLoading: schemesLoading } = useQuery<IrisApiResponse<{ schemes?: SchemeResult[] } | SchemeResult[]>>({
    queryKey: ["/api/iris/transactions/scheme-search", schemeQuery],
    queryFn: () =>
      irisGet<IrisApiResponse<{ schemes?: SchemeResult[] } | SchemeResult[]>>(`/api/iris/transactions/scheme-search?q=${encodeURIComponent(schemeQuery)}`),
    enabled: schemeQuery.length >= 2 && !selectedScheme,
    retry: false,
  });

  const schemes: SchemeResult[] = (() => {
    if (!schemeSearchData?.data) return [];
    if (Array.isArray(schemeSearchData.data)) return schemeSearchData.data;
    return schemeSearchData.data.schemes ?? [];
  })();

  const placeOrder = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiRequest(
        transactType === "redemption"
          ? "/api/iris/transactions/place-redemption"
          : "/api/iris/transactions/place-order",
        "POST",
        { body }
      ),
    onSuccess: () => {
      toast({ title: "Transaction submitted successfully" });
      setModalOpen(false);
      setPan("");
      setAmount("");
      setSelectedScheme(null);
      setSchemeQuery("");
    },
    onError: (err: Error) =>
      toast({ title: "Transaction failed", description: err.message, variant: "destructive" }),
  });

  function handleSubmit() {
    if (!pan.trim()) { toast({ title: "PAN is required", variant: "destructive" }); return; }
    if (!selectedScheme) { toast({ title: "Please select a scheme", variant: "destructive" }); return; }
    if (!amount || Number(amount) <= 0) { toast({ title: "Enter a valid amount", variant: "destructive" }); return; }

    const body: Record<string, unknown> = {
      pan,
      schemeCode: selectedScheme.schemeCode ?? selectedScheme.isinCode ?? selectedScheme.code,
      schemeName: selectedScheme.schemeName ?? selectedScheme.name,
      amount: Number(amount),
      transactionType: transactType.toUpperCase(),
    };
    if (transactType === "sip") body.frequency = frequency;
    placeOrder.mutate(body);
  }

  function openModal(type: TransactType) {
    setTransactType(type);
    setModalOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <Button onClick={() => openModal("lumpsum")}><ArrowUpRight className="h-4 w-4 mr-1" /> Lumpsum Purchase</Button>
        <Button variant="outline" onClick={() => openModal("sip")}><Activity className="h-4 w-4 mr-1" /> Start SIP</Button>
        <Button variant="outline" onClick={() => openModal("redemption")}><IndianRupee className="h-4 w-4 mr-1" /> Redemption</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Available Fund Houses</CardTitle></CardHeader>
        <CardContent>
          {funds.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {funds.slice(0, 12).map((f, i) => (
                <div key={i} className="text-xs p-2 rounded border bg-muted/30">{f.fundName ?? f.name}</div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Fund data unavailable — IRIS credentials may need re-authentication</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{transactType === "lumpsum" ? "Lumpsum Purchase" : transactType === "sip" ? "Start SIP" : "Redemption"}</DialogTitle>
            <DialogDescription>Enter investor and scheme details to place the order</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Investor PAN *</Label>
              <Input value={pan} onChange={e => setPan(e.target.value.toUpperCase())} placeholder="ABCDE1234F" maxLength={10} />
            </div>

            <div>
              <Label>Search Scheme *</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={selectedScheme ? (selectedScheme.schemeName ?? selectedScheme.name ?? "") : schemeQuery}
                  onChange={e => { setSchemeQuery(e.target.value); setSelectedScheme(null); }}
                  placeholder="Type scheme name (min 2 chars)…"
                />
              </div>
              {schemeQuery.length >= 2 && !selectedScheme && (
                <div className="border rounded-md mt-1 max-h-40 overflow-y-auto bg-background shadow-md z-10">
                  {schemesLoading ? (
                    <p className="p-2 text-xs text-muted-foreground">Searching…</p>
                  ) : schemes.length > 0 ? (
                    schemes.slice(0, 10).map((s, i) => (
                      <button key={i} className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex justify-between items-center"
                        onClick={() => { setSelectedScheme(s); setSchemeQuery(""); }}>
                        <span>{s.schemeName ?? s.name}</span>
                        {(s.schemeCode ?? s.code) && <span className="text-xs text-muted-foreground ml-2">{s.schemeCode ?? s.code}</span>}
                      </button>
                    ))
                  ) : (
                    <p className="p-2 text-xs text-muted-foreground">No schemes found</p>
                  )}
                </div>
              )}
              {selectedScheme && (
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{selectedScheme.schemeCode ?? selectedScheme.isinCode ?? selectedScheme.code}</Badge>
                  <button className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-0.5"
                    onClick={() => { setSelectedScheme(null); setSchemeQuery(""); }}>
                    <XCircle className="h-3 w-3" /> Clear
                  </button>
                </div>
              )}
            </div>

            <div>
              <Label>Amount (₹) *</Label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="5000" min={1} />
            </div>

            {transactType === "sip" && (
              <div>
                <Label>Frequency</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                    <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                    <SelectItem value="YEARLY">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button className="w-full" onClick={handleSubmit} disabled={placeOrder.isPending}>
              {placeOrder.isPending
                ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Submitting…</>
                : "Submit Transaction"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Products Tab ─────────────────────────────────────────────────────────────
function ProductsTab() {
  const { data: aif, isLoading: aifL } = useQuery<IrisApiResponse<{ links?: ProductLink[] } | ProductLink[]>>({ queryKey: ["/api/iris/products/aif-links"], retry: false });
  const { data: pms, isLoading: pmsL } = useQuery<IrisApiResponse<{ links?: ProductLink[] } | ProductLink[]>>({ queryKey: ["/api/iris/products/pms-links"], retry: false });
  const { data: fd, isLoading: fdL } = useQuery<IrisApiResponse<{ products?: ProductLink[] } | ProductLink[]>>({ queryKey: ["/api/iris/products/fixed-deposits"], retry: false });
  const { data: nps, isLoading: npsL } = useQuery<IrisApiResponse<{ links?: ProductLink[] } | ProductLink[]>>({ queryKey: ["/api/iris/products/nps-links"], retry: false });

  function resolveItems(d: IrisApiResponse<{ links?: ProductLink[] } | { products?: ProductLink[] } | ProductLink[]> | undefined): ProductLink[] {
    if (!d?.data) return [];
    if (Array.isArray(d.data)) return d.data;
    if ('links' in d.data) return d.data.links ?? [];
    if ('products' in d.data) return d.data.products ?? [];
    return [];
  }

  function LinkList({ items, isLoading }: { items: ProductLink[]; isLoading: boolean }) {
    if (isLoading) return <Skeleton className="h-16 w-full" />;
    if (!items.length) return <p className="text-sm text-muted-foreground">No data available</p>;
    return (
      <div className="space-y-2">
        {items.map((item, i) => (
          <a key={i} href={item.url ?? item.link ?? '#'} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-between p-2 rounded hover:bg-muted/50 text-sm">
            <span>{item.name ?? item.title ?? item.productName}</span>
            <ExternalLink className="h-3 w-3 text-muted-foreground" />
          </a>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">AIF Links</CardTitle><CardDescription>Alternative Investment Funds</CardDescription></CardHeader>
        <CardContent><LinkList items={resolveItems(aif)} isLoading={aifL} /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">PMS Links</CardTitle><CardDescription>Portfolio Management Services</CardDescription></CardHeader>
        <CardContent><LinkList items={resolveItems(pms)} isLoading={pmsL} /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Fixed Deposits</CardTitle><CardDescription>FD product brochures</CardDescription></CardHeader>
        <CardContent><LinkList items={resolveItems(fd)} isLoading={fdL} /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">NPS Links</CardTitle><CardDescription>National Pension System onboarding</CardDescription></CardHeader>
        <CardContent><LinkList items={resolveItems(nps)} isLoading={npsL} /></CardContent>
      </Card>
    </div>
  );
}

// ─── Reports Tab ──────────────────────────────────────────────────────────────
type ReportType = "capital-gains" | "client-statement" | "transaction-statement" | "portfolio-summary";

const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: "capital-gains", label: "Capital Gains Statement" },
  { value: "client-statement", label: "Client Statement" },
  { value: "transaction-statement", label: "Transaction Statement" },
  { value: "portfolio-summary", label: "Portfolio Summary" },
];

function ReportsTab() {
  const [pan, setPan] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reportType, setReportType] = useState<ReportType>("capital-gains");
  const [result, setResult] = useState<{ success: boolean; data?: { downloadUrl?: string }; message?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function runReport() {
    if (!pan) { toast({ title: "PAN is required", variant: "destructive" }); return; }
    setLoading(true);
    setResult(null);
    try {
      const qs = new URLSearchParams();
      if (fromDate) qs.set("fromDate", fromDate);
      if (toDate) qs.set("toDate", toDate);
      const json = await irisGet<typeof result>(`/api/iris/reports/${reportType}/${pan}${qs.toString() ? '?' + qs.toString() : ''}`);
      setResult(json);
    } catch {
      toast({ title: "Report fetch failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">Download Reports</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label>Investor PAN</Label>
              <Input value={pan} onChange={e => setPan(e.target.value.toUpperCase())} placeholder="ABCDE1234F" />
            </div>
            <div>
              <Label>Report Type</Label>
              <Select value={reportType} onValueChange={v => setReportType(v as ReportType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>From Date</Label>
              <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
            </div>
            <div>
              <Label>To Date</Label>
              <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
            </div>
          </div>
          <Button onClick={runReport} disabled={loading}>
            {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            {loading ? "Fetching…" : "Get Report"}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Report Result</CardTitle></CardHeader>
          <CardContent>
            {result.success ? (
              result.data?.downloadUrl ? (
                <a href={result.data.downloadUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline"><Download className="h-4 w-4 mr-2" /> Download PDF</Button>
                </a>
              ) : (
                <pre className="text-xs bg-muted/30 rounded p-3 overflow-auto max-h-64">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              )
            ) : (
              <p className="text-sm text-destructive">{result.message}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Admin OTP Re-auth Dialog (admin-only) ────────────────────────────────────
function AdminOtpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<"send" | "verify">("send");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const sendOtp = useMutation({
    mutationFn: () => apiRequest("/api/iris/auth/send-otp", "POST", { body: { mobile } }),
    onSuccess: () => { toast({ title: "OTP sent to registered mobile" }); setStep("verify"); },
    onError: (err: Error) => toast({ title: "Failed to send OTP", description: err.message, variant: "destructive" }),
  });

  const submitOtp = useMutation({
    mutationFn: () => apiRequest("/api/iris/auth/submit-otp", "POST", { body: { otp } }),
    onSuccess: () => {
      toast({ title: "IRIS re-authenticated successfully" });
      qc.invalidateQueries({ queryKey: ["/api/iris/status"] });
      onClose();
      setStep("send");
      setOtp("");
      setMobile("");
    },
    onError: (err: Error) => toast({ title: "OTP verification failed", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> IRIS Re-Authentication</DialogTitle>
          <DialogDescription>Re-authenticate IRIS token via OTP when the session expires. Admin only.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {step === "send" ? (
            <>
              <div>
                <Label>Registered Mobile (optional)</Label>
                <Input value={mobile} onChange={e => setMobile(e.target.value)} placeholder="+91XXXXXXXXXX" />
              </div>
              <Button className="w-full" onClick={() => sendOtp.mutate()} disabled={sendOtp.isPending}>
                {sendOtp.isPending ? "Sending…" : "Send OTP"}
              </Button>
            </>
          ) : (
            <>
              <div>
                <Label>Enter OTP</Label>
                <Input value={otp} onChange={e => setOtp(e.target.value)} placeholder="6-digit OTP" maxLength={6} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep("send")}>Back</Button>
                <Button className="flex-1" onClick={() => submitOtp.mutate()} disabled={submitOtp.isPending || otp.length < 4}>
                  {submitOtp.isPending ? "Verifying…" : "Verify OTP"}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AgentIrisHub() {
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const { user } = useAuth();
  const userRoles: string[] = (user as { roles?: string[]; role?: string } | null)?.roles ?? [];
  const singleRole = (user as { roles?: string[]; role?: string } | null)?.role ?? "";
  const isAdmin = userRoles.includes("admin") || userRoles.includes("superadmin") || singleRole === "admin" || singleRole === "superadmin";

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">IRIS / KFintech</h1>
          <p className="text-muted-foreground text-sm mt-1">
            MF, AIF, PMS, FD, NPS &amp; SIF execution — all in one place
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <Shield className="h-3 w-3" /> Distributor Portal
          </Badge>
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={() => setOtpDialogOpen(true)}>
              <KeyRound className="h-3 w-3 mr-1" /> Re-auth OTP
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="dashboard"><BarChart3 className="h-4 w-4 mr-1 inline" />Dashboard</TabsTrigger>
          <TabsTrigger value="empanelment"><Shield className="h-4 w-4 mr-1 inline" />Empanelment</TabsTrigger>
          <TabsTrigger value="investors"><Users className="h-4 w-4 mr-1 inline" />Investors</TabsTrigger>
          <TabsTrigger value="transact"><TrendingUp className="h-4 w-4 mr-1 inline" />Transact</TabsTrigger>
          <TabsTrigger value="products"><FileText className="h-4 w-4 mr-1 inline" />Products</TabsTrigger>
          <TabsTrigger value="reports"><Download className="h-4 w-4 mr-1 inline" />Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4"><DashboardTab /></TabsContent>
        <TabsContent value="empanelment" className="mt-4"><EmpanelmentTab /></TabsContent>
        <TabsContent value="investors" className="mt-4"><InvestorsTab /></TabsContent>
        <TabsContent value="transact" className="mt-4"><TransactTab /></TabsContent>
        <TabsContent value="products" className="mt-4"><ProductsTab /></TabsContent>
        <TabsContent value="reports" className="mt-4"><ReportsTab /></TabsContent>
      </Tabs>

      {isAdmin && <AdminOtpDialog open={otpDialogOpen} onClose={() => setOtpDialogOpen(false)} />}
    </div>
  );
}
