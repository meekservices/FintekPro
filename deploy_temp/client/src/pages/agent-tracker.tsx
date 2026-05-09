import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader,
  DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Activity, TrendingUp, Wallet, Users, AlertTriangle, RefreshCw,
  ChevronRight, BarChart2, HeartPulse, Layers, Coins, Building2,
  CheckCircle2, Info, Plug, ArrowUpRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface TrackerData {
  summary: {
    totalAUM: number;
    totalEquity: number;
    totalDebt: number;
    totalGold: number;
    totalAlternatives: number;
    aumChange: number | null;
  };
  sipBook: {
    activeSips: number;
    expiringSips: number;
    lapsedSips: number;
    monthlySipValue: number;
    netNewThisMonth: number;
  };
  commission: {
    monthlyTrailEstimate: number;
    annualTrailEstimate: number;
    note: string;
  };
  monthlyTrend: { month: string; aum: number; label: string }[];
  topAmcs: { name: string; aum: number; sipCount: number; trailMonthly: number }[];
  clientConnectivity: { total: number; withHoldings: number; mfcentralCapable: number };
  pendingActions: { sigsExpiring: number; kycPending: number; totalActions: number };
  mfcentralEnabled: boolean;
  irisEnabled: boolean;
  generatedAt: string;
}

const AMC_COLORS = [
  "#2563EB", "#16A34A", "#DC2626", "#D97706", "#7C3AED",
  "#0891B2", "#DB2777", "#65A30D", "#EA580C", "#6B7280",
];

function fmt(n: number): string {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(0)}K`;
  return `₹${n.toFixed(0)}`;
}

function fmtSipAmt(n: number): string {
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L/mo`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(0)}K/mo`;
  return `₹${n}/mo`;
}

export default function AgentTracker() {
  const { toast } = useToast();
  const [connectOpen, setConnectOpen] = useState(false);
  const [pan, setPan] = useState("");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [otpStep, setOtpStep] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: tracker, isLoading, refetch } = useQuery<TrackerData>({
    queryKey: ["/api/agent/tracker"],
  });

  const handleInitiate = async () => {
    if (!pan || !mobile) {
      toast({ title: "PAN and mobile are required", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const r = await apiRequest("POST", "/api/agent/mfcentral/initiate", { pan, mobile });
      const data = await r.json();
      if (data.requestId) {
        setRequestId(data.requestId);
        setOtpStep(true);
        toast({ title: "OTP Sent", description: data.message || "Check client's registered mobile" });
      } else {
        toast({ title: "Failed", description: data.error || "Could not initiate", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to contact MFCentral", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (!requestId || !otp) return;
    setIsSubmitting(true);
    try {
      const r = await apiRequest("POST", "/api/agent/mfcentral/verify", { requestId, otp });
      const data = await r.json();
      if (data.success) {
        toast({ title: "Portfolio Imported!", description: data.message });
        setConnectOpen(false);
        setPan(""); setMobile(""); setOtp("");
        setOtpStep(false); setRequestId(null);
        refetch();
      } else {
        toast({ title: "OTP Invalid", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Verification failed", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleIrisSync = async () => {
    if (!pan) {
      toast({ title: "PAN is required", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      // Step 1: Fetch live CAS data from registry
      const fetchResp = await apiRequest("GET", `/api/iris/portfolio/cas-fetch/${pan}`);
      const fetchData = await fetchResp.json();
      
      if (!fetchData.success) {
        throw new Error(fetchData.message || "Registry fetch failed");
      }

      // Step 2: Import into Iris tracking (this triggers local sync on backend)
      const importResp = await apiRequest("POST", "/api/iris/portfolio/import", {
        pan,
        holdings: fetchData.data?.holdings || []
      });
      const importData = await importResp.json();

      if (importData.success) {
        toast({ 
          title: "Iris Sync Successful", 
          description: `Portfolio for ${pan} has been synced to your business tracker.` 
        });
        setConnectOpen(false);
        setPan(""); setMobile("");
        refetch();
      } else {
        toast({ title: "Sync Failed", description: importData.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ 
        title: "Iris Error", 
        description: err.message || "Failed to sync via Iris KFintech", 
        variant: "destructive" 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  const t = tracker;
  const totalAUM = t?.summary.totalAUM ?? 0;
  const equityPct = totalAUM > 0 ? Math.round((t!.summary.totalEquity / totalAUM) * 100) : 0;
  const debtPct = totalAUM > 0 ? Math.round((t!.summary.totalDebt / totalAUM) * 100) : 0;
  const goldPct = totalAUM > 0 ? Math.round((t!.summary.totalGold / totalAUM) * 100) : 0;
  const altPct = totalAUM > 0 ? Math.round((t!.summary.totalAlternatives / totalAUM) * 100) : 0;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-blue-600" />
            Business Tracker
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your complete MF book — AUM, SIPs, trail income, powered by IRIS KFintech
          </p>
        </div>
        <div className="flex items-center gap-2">
          {t?.mfcentralEnabled && (
            <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
              <CheckCircle2 className="w-3 h-3 mr-1" /> MFCentral Ready
            </Badge>
          )}
          {t?.irisEnabled && (
            <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
              <RefreshCw className="w-3 h-3 mr-1" /> Iris Sync Ready
            </Badge>
          )}
          {!t?.mfcentralEnabled && !t?.irisEnabled && (
            <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
              <Info className="w-3 h-3 mr-1" /> Stub Mode
            </Badge>
          )}

          <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plug className="w-4 h-4" /> Connect Client Portfolio
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Connect Client via IRIS (KFintech)</DialogTitle>
                <DialogDescription>
                  Import external holdings into your business tracker engine.
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue={t?.irisEnabled ? "iris" : "mfcentral"} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="iris" disabled={!t?.irisEnabled}>IRIS (Registry)</TabsTrigger>
                  <TabsTrigger value="mfcentral" disabled={!t?.mfcentralEnabled}>MFCentral (OTP)</TabsTrigger>
                </TabsList>

                <TabsContent value="mfcentral" className="pt-4">
                  {!otpStep ? (
                    <div className="space-y-4">
                      <div>
                        <Label>Client PAN</Label>
                        <Input placeholder="ABCDE1234F" value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} maxLength={10} />
                      </div>
                      <div>
                        <Label>Client Registered Mobile</Label>
                        <Input placeholder="9876543210" value={mobile} onChange={(e) => setMobile(e.target.value)} maxLength={10} type="tel" />
                      </div>
                      <Button onClick={handleInitiate} disabled={isSubmitting} className="w-full">
                        {isSubmitting ? "Sending OTP..." : "Send OTP to Client"}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        OTP sent to client's mobile via MFCentral.
                      </p>
                      <div>
                        <Label>OTP</Label>
                        <Input placeholder="6-digit OTP" value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} />
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setOtpStep(false)} className="flex-1">Back</Button>
                        <Button onClick={handleVerify} disabled={isSubmitting} className="flex-1">
                          {isSubmitting ? "Verifying..." : "Verify & Import"}
                        </Button>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="iris" className="pt-4">
                  <div className="space-y-4">
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 mb-4">
                      <p className="text-sm text-blue-700 font-medium">Registry Direct Fetch</p>
                      <p className="text-xs text-blue-600 mt-1">
                        Fetches structured KFintech + CAMS holdings directly via the IRIS API. Fast, reliable, and OTP-less for previously linked clients.
                      </p>
                    </div>
                    <div>
                      <Label>Client PAN</Label>
                      <Input placeholder="ABCDE1234F" value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} maxLength={10} />
                    </div>
                    <Button onClick={handleIrisSync} disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700">
                      {isSubmitting ? "Communicating with IRIS..." : "Sync via IRIS Registry"}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>

          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* ── Row 1: 4 Summary Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* AUM Book */}
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-blue-600">AUM Book</span>
              <Layers className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{fmt(totalAUM)}</p>
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-xs text-blue-700">
                <span>Equity {equityPct}%</span>
                <span>Debt {debtPct}%</span>
              </div>
              <Progress value={equityPct} className="h-1.5 bg-blue-200" />
            </div>
            <div className="flex gap-2 mt-2 text-xs text-blue-700">
              {goldPct > 0 && <span>Gold {goldPct}%</span>}
              {altPct > 0 && <span>Alt {altPct}%</span>}
            </div>
          </CardContent>
        </Card>

        {/* SIP Book */}
        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-green-600">SIP Book</span>
              <HeartPulse className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-green-900 dark:text-green-100">
              {t?.sipBook.activeSips ?? 0}
              <span className="text-sm font-normal ml-1">active</span>
            </p>
            <p className="text-sm text-green-700 mt-1">
              {fmtSipAmt(t?.sipBook.monthlySipValue ?? 0)}
            </p>
            <div className="flex gap-1 mt-2 flex-wrap">
              {(t?.sipBook.expiringSips ?? 0) > 0 && (
                <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 text-xs px-1">
                  {t?.sipBook.expiringSips} expiring
                </Badge>
              )}
              {(t?.sipBook.lapsedSips ?? 0) > 0 && (
                <Badge variant="destructive" className="text-xs px-1">
                  {t?.sipBook.lapsedSips} lapsed
                </Badge>
              )}
              {(t?.sipBook.netNewThisMonth ?? 0) > 0 && (
                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 text-xs px-1">
                  +{t?.sipBook.netNewThisMonth} new
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Trail Commission */}
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-purple-600">Trail Income</span>
              <Coins className="w-4 h-4 text-purple-500" />
            </div>
            <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
              {fmt(t?.commission.monthlyTrailEstimate ?? 0)}
            </p>
            <p className="text-xs text-purple-600 mt-1">estimated / month</p>
            <p className="text-sm font-medium text-purple-700 mt-2">
              {fmt(t?.commission.annualTrailEstimate ?? 0)}/yr projected
            </p>
          </CardContent>
        </Card>

        {/* Client Connectivity */}
        <Card className="bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-900 border-teal-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-teal-600">Clients</span>
              <Users className="w-4 h-4 text-teal-500" />
            </div>
            <p className="text-2xl font-bold text-teal-900 dark:text-teal-100">
              {t?.clientConnectivity.total ?? 0}
            </p>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-xs text-teal-700">
                <span>With holdings</span>
                <span>{t?.clientConnectivity.withHoldings ?? 0}</span>
              </div>
              <Progress
                value={t?.clientConnectivity.total ? ((t.clientConnectivity.withHoldings / t.clientConnectivity.total) * 100) : 0}
                className="h-1.5 bg-teal-200"
              />
            </div>
            <p className="text-xs text-teal-600 mt-2">
              {t?.clientConnectivity.mfcentralCapable ?? 0} IRIS/KFintech linked
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 2: AUM Trend + AMC Bar Chart ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly AUM Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              AUM Growth (6 Months)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(t?.monthlyTrend ?? []).some((m) => m.aum > 0) ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={t?.monthlyTrend ?? []} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="aumGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => fmt(v)} tick={{ fontSize: 10 }} width={55} />
                  <Tooltip formatter={(v: number) => [fmt(v), "AUM"]} />
                  <Area type="monotone" dataKey="aum" stroke="#2563EB" strokeWidth={2} fill="url(#aumGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex flex-col items-center justify-center text-muted-foreground">
                <BarChart2 className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">No holding-date data yet</p>
                <p className="text-xs mt-1">Import portfolios via IRIS Registry to see trend</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top AMCs Bar Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-500" />
              Top AMCs by AUM
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(t?.topAmcs ?? []).length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={t?.topAmcs.slice(0, 8) ?? []}
                  layout="vertical"
                  margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" tickFormatter={(v) => fmt(v)} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                  <Tooltip formatter={(v: number) => [fmt(v), "AUM"]} />
                  <Bar dataKey="aum" radius={[0, 4, 4, 0]}>
                    {(t?.topAmcs.slice(0, 8) ?? []).map((_, i) => (
                      <Cell key={i} fill={AMC_COLORS[i % AMC_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex flex-col items-center justify-center text-muted-foreground">
                <Building2 className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">No AMC data yet</p>
                <p className="text-xs mt-1">Connect client portfolios to see breakdown</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 3: AMC Table + Pending Actions ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AMC Table */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">AMC-wise AUM &amp; Trail Estimate</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(t?.topAmcs ?? []).length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-3 font-medium text-muted-foreground">AMC</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">AUM</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">SIPs</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Trail/mo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(t?.topAmcs ?? []).map((amc, i) => (
                      <tr key={amc.name} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="p-3 flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: AMC_COLORS[i % AMC_COLORS.length] }}
                          />
                          {amc.name}
                        </td>
                        <td className="p-3 text-right font-medium">{fmt(amc.aum)}</td>
                        <td className="p-3 text-right text-muted-foreground">{amc.sipCount}</td>
                        <td className="p-3 text-right text-green-600 font-medium">{fmt(amc.trailMonthly)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/20 font-semibold">
                      <td className="p-3">Total</td>
                      <td className="p-3 text-right">{fmt(totalAUM)}</td>
                      <td className="p-3 text-right">{t?.sipBook.activeSips ?? 0}</td>
                      <td className="p-3 text-right text-green-600">{fmt(t?.commission.monthlyTrailEstimate ?? 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <Layers className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No portfolio data yet</p>
                <p className="text-xs mt-1">Use the "Connect Client Portfolio" button above</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Actions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Pending Actions
              {(t?.pendingActions.totalActions ?? 0) > 0 && (
                <Badge variant="destructive" className="text-xs ml-auto">
                  {t?.pendingActions.totalActions}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* SIPs Expiring */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-100">
              <div className="flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-amber-500" />
                <div>
                  <p className="text-sm font-medium">SIPs Expiring</p>
                  <p className="text-xs text-muted-foreground">Next 30 days</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-amber-600">{t?.sipBook.expiringSips ?? 0}</span>
                <Link href="/agent/sip-health">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Lapsed SIPs */}
            {(t?.sipBook.lapsedSips ?? 0) > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-100">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <div>
                    <p className="text-sm font-medium">Lapsed SIPs</p>
                    <p className="text-xs text-muted-foreground">Renewal needed</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-red-600">{t?.sipBook.lapsedSips}</span>
                  <Link href="/agent/sip-health">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {/* Clients without holdings */}
            {(t?.clientConnectivity.total ?? 0) > (t?.clientConnectivity.withHoldings ?? 0) && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-100">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium">No Holdings</p>
                    <p className="text-xs text-muted-foreground">Sync via IRIS Registry</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-blue-600">
                  {(t?.clientConnectivity.total ?? 0) - (t?.clientConnectivity.withHoldings ?? 0)}
                </span>
              </div>
            )}

            {(t?.pendingActions.totalActions ?? 0) === 0 &&
              (t?.clientConnectivity.total ?? 0) <= (t?.clientConnectivity.withHoldings ?? 0) && (
                <div className="flex flex-col items-center py-6 text-center text-muted-foreground">
                  <CheckCircle2 className="w-8 h-8 text-green-500 mb-2" />
                  <p className="text-sm font-medium text-green-600">All clear!</p>
                  <p className="text-xs mt-1">No pending actions</p>
                </div>
              )}

            {/* Quick links */}
            <div className="pt-2 space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quick Links</p>
              <Link href="/agent/sip-health">
                <Button variant="ghost" size="sm" className="w-full justify-start gap-2 h-8 text-xs">
                  <HeartPulse className="w-3 h-3" /> SIP Health Monitor
                  <ArrowUpRight className="w-3 h-3 ml-auto" />
                </Button>
              </Link>
              <Link href="/agent/portfolio-drift">
                <Button variant="ghost" size="sm" className="w-full justify-start gap-2 h-8 text-xs">
                  <Activity className="w-3 h-3" /> Portfolio Drift
                  <ArrowUpRight className="w-3 h-3 ml-auto" />
                </Button>
              </Link>
              <Link href="/agent/clients">
                <Button variant="ghost" size="sm" className="w-full justify-start gap-2 h-8 text-xs">
                  <Users className="w-3 h-3" /> My Clients
                  <ArrowUpRight className="w-3 h-3 ml-auto" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer note */}
      <p className="text-xs text-muted-foreground text-center">
        Trail commission is an estimate based on AUM × standard trail rates (0.8% equity, 0.1% debt p.a.).
        Actual payouts depend on AMC commission structures. Data from IRIS (CAS Fetch) last updated:{" "}
        {t?.generatedAt ? new Date(t.generatedAt).toLocaleString("en-IN") : "—"}
      </p>
    </div>
  );
}
