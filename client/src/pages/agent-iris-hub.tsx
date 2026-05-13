import { useState, useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { HierarchyTab } from "../components/agent/HierarchyTab";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import {
  TrendingUp, Users, IndianRupee, Activity, Shield as LucideShield, FileText,
  BarChart3, RefreshCw, Search, ExternalLink, ArrowUpRight,
  ChevronRight, AlertCircle, CheckCircle2, Clock, Download, KeyRound, XCircle,
  FolderOpen, Inbox, Unlink, Link2, Send, CloudDownload, Calculator, Calendar,
  AlertTriangle, Banknote, PiggyBank, CreditCard, Settings, Target,
  Upload, Trash2, Pencil, Plus, Fingerprint,
  LineChart, PlusCircle, Star, User, BookOpen, Layers,
  ArrowLeftRight, Repeat, MinusCircle, UserPlus, Brain,
  Building2, Bell, MessageSquare, ChevronDown, ChevronUp,
  TrendingDown, PieChart, ShieldCheck, Loader2
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

// ─── Onboarding types ─────────────────────────────────────────────────────────
interface OnboardingApplication {
  applicationId?: string;
  id?: string;
  name?: string;
  investorName?: string;
  pan?: string;
  mobile?: string;
  email?: string;
  status?: string;
  createdAt?: string;
  applicationLink?: string;
}

// ─── NFO types ────────────────────────────────────────────────────────────────
interface NfoScheme {
  schemeCode?: string;
  code?: string;
  schemeName?: string;
  name?: string;
  amcName?: string;
  amc?: string;
  category?: string;
  openDate?: string;
  closeDate?: string;
  minAmount?: number;
  minimumAmount?: number;
}

interface NfoApplication {
  applicationId?: string;
  id?: string;
  schemeName?: string;
  scheme?: string;
  pan?: string;
  amount?: number;
  status?: string;
  paymentMode?: string;
  createdAt?: string;
}

// ─── Application/Order tracking types ────────────────────────────────────────
interface OrderApplication {
  applicationId?: string;
  id?: string;
  type?: string;
  transactionType?: string;
  schemeName?: string;
  scheme?: string;
  amount?: number;
  status?: string;
  orderId?: string;
  createdAt?: string;
}

interface TrackingEvent {
  status?: string;
  description?: string;
  timestamp?: string;
  date?: string;
}

// ─── Risk profile types ───────────────────────────────────────────────────────
interface RiskProfile {
  riskProfile?: string;
  riskCategory?: string;
  score?: number;
  assessedAt?: string;
  recommendedCategories?: string[];
}

interface RiskQuestion {
  questionId?: string;
  id?: string;
  question?: string;
  options?: { id?: string; value?: string; text?: string; label?: string }[];
}

// ─── Dashboard types ──────────────────────────────────────────────────────────
interface InflowOutflowMonth {
  month?: string;
  period?: string;
  inflow?: number;
  outflow?: number;
  netFlow?: number;
}

interface EuinRecord {
  euinCode?: string;
  euin?: string;
  name?: string;
  agentName?: string;
  aum?: number;
  investorCount?: number;
}

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

function QuickKycWidget() {
  const [pan, setPan] = useState("");
  const [trigger, setTrigger] = useState<string | null>(null);

  const { data: res, isLoading: loading, error } = useQuery<IrisApiResponse<any>>({
    queryKey: ["/api/iris/investors", trigger, "kyc-details"],
    queryFn: () => irisGet(`/api/iris/investors/${trigger}/kyc-details`),
    enabled: !!trigger,
    retry: false,
  });

  const kyc = res?.data;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" /> Quick KYC Check
        </CardTitle>
        <CardDescription>Verify PAN status instantly</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input 
            placeholder="Enter PAN" 
            value={pan} 
            onChange={e => setPan(e.target.value.toUpperCase())}
            className="uppercase font-mono text-sm"
            maxLength={10}
          />
          <Button size="sm" onClick={() => setTrigger(pan)} disabled={pan.length !== 10 || loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
          </Button>
        </div>

        {trigger && !loading && (
          <div className="p-3 rounded-lg bg-muted/50 space-y-2 border">
            {error ? (
              <p className="text-xs text-destructive">Could not verify PAN. Ensure IRIS is configured.</p>
            ) : kyc ? (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Status</span>
                  <Badge variant={kyc.kycStatus === 'KYC_VERIFIED' ? 'default' : 'secondary'} className="text-[10px]">
                    {kyc.kycStatus ?? 'Unknown'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Name</span>
                  <span className="text-xs font-medium truncate max-w-[140px]">{kyc.name ?? '—'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">PAN Type</span>
                  <span className="text-xs font-medium uppercase">{kyc.panType ?? '—'}</span>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">No data found for this PAN</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function fmt(num: number | null | undefined): string {
  if (num == null) return "—";
  if (num >= 1e7) return "₹" + (num / 1e7).toFixed(2) + " Cr";
  if (num >= 1e5) return "₹" + (num / 1e5).toFixed(2) + " L";
  return "₹" + num.toLocaleString("en-IN");
}

function statusVariant(status?: string): "default" | "secondary" | "destructive" | "outline" {
  if (!status) return "outline";
  const s = status.toUpperCase();
  if (["ACTIVE", "COMPLETED", "SUCCESS", "KYC_VERIFIED", "ALLOTTED"].includes(s)) return "default";
  if (["PENDING", "IN_PROGRESS", "KYC_PENDING", "PROCESSING"].includes(s)) return "secondary";
  if (["REJECTED", "CANCELLED", "FAILED"].includes(s)) return "destructive";
  return "outline";
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
const RISK_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

function DashboardTab() {
  const { data: aum, isLoading: aumL } = useQuery<IrisApiResponse<AumData>>({ queryKey: ["/api/iris/dashboard/aum-summary"], retry: false });
  const { data: earn, isLoading: earnL } = useQuery<IrisApiResponse<EarningsData>>({ queryKey: ["/api/iris/dashboard/fund-earnings"], retry: false });
  const { data: sip, isLoading: sipL } = useQuery<IrisApiResponse<SipSummaryData>>({ queryKey: ["/api/iris/dashboard/sip-summary"], retry: false });
  const { data: inv, isLoading: invL } = useQuery<IrisApiResponse<InvestorCountData>>({ queryKey: ["/api/iris/dashboard/unique-investors"], retry: false });
  const { data: inflowData, isLoading: inflowL } = useQuery<IrisApiResponse<{ months?: InflowOutflowMonth[]; data?: InflowOutflowMonth[] }>>({
    queryKey: ["/api/iris/dashboard/inflow-outflow"],
    retry: false,
  });
  const { data: euinsData, isLoading: euinsL } = useQuery<IrisApiResponse<{ euins?: EuinRecord[]; data?: EuinRecord[] }>>({
    queryKey: ["/api/iris/dashboard/euins"],
    retry: false,
  });

  const inflowMonths: InflowOutflowMonth[] = (() => {
    if (!inflowData?.data) return [];
    if (Array.isArray(inflowData.data)) return inflowData.data;
    return inflowData.data.months ?? inflowData.data.data ?? [];
  })();

  const euins: EuinRecord[] = (() => {
    if (!euinsData?.data) return [];
    if (Array.isArray(euinsData.data)) return euinsData.data;
    return euinsData.data.euins ?? euinsData.data.data ?? [];
  })();

  const chartData = inflowMonths.map(m => ({
    month: m.month ?? m.period ?? "",
    Inflow: m.inflow ?? 0,
    Outflow: m.outflow ?? 0,
    "Net Flow": m.netFlow ?? ((m.inflow ?? 0) - (m.outflow ?? 0)),
  }));

  type RiskDistItem = { name: string; value: number };
  const riskDistributionRaw = (() => {
    const d = inflowData?.data as Record<string, unknown> | undefined;
    if (!d) return null;
    const dist = (d as { riskDistribution?: RiskDistItem[] }).riskDistribution;
    if (Array.isArray(dist) && dist.length > 0) return dist as RiskDistItem[];
    return null;
  })();

  const euinsRiskDist = (() => {
    const d = euinsData?.data as Record<string, unknown> | undefined;
    if (!d) return null;
    const dist = (d as { riskDistribution?: RiskDistItem[] }).riskDistribution;
    if (Array.isArray(dist) && dist.length > 0) return dist as RiskDistItem[];
    return null;
  })();

  const riskDonutData: RiskDistItem[] = riskDistributionRaw ?? euinsRiskDist ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total AUM" value={fmt(aum?.data?.totalAum ?? aum?.data?.aum)} icon={IndianRupee} loading={aumL} subtitle="Assets Under Management" />
        <StatCard title="Fund Earnings" value={fmt(earn?.data?.totalEarnings ?? earn?.data?.earnings)} icon={TrendingUp} loading={earnL} subtitle="Trail commission" />
        <StatCard title="Active SIPs" value={sip?.data?.activeSips != null ? sip.data.activeSips.toLocaleString() : sip?.data?.sipCount?.toLocaleString()} icon={Activity} loading={sipL} subtitle="Running systematic plans" />
        <StatCard title="Unique Investors" value={inv?.data?.count != null ? inv.data.count.toLocaleString() : inv?.data?.uniqueInvestors?.toLocaleString()} icon={Users} loading={invL} subtitle="Total investor base" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          {/* Inflow-Outflow Chart */}
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-base">Inflow vs Outflow — Trailing 12 Months</CardTitle>
              <CardDescription>Monthly net flows across all clients</CardDescription>
            </CardHeader>
            <CardContent>
              {inflowL ? (
                <Skeleton className="h-56 w-full" />
              ) : chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v >= 1e5 ? `${(v / 1e5).toFixed(0)}L` : String(v)} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    <Bar dataKey="Inflow" fill="#10b981" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Outflow" fill="#ef4444" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Net Flow" fill="#6366f1" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
                  No inflow/outflow data — IRIS credentials may need authentication
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <QuickKycWidget />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* EUIN Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">EUIN Distribution</CardTitle>
            <CardDescription>Agent EUINs and their AUM</CardDescription>
          </CardHeader>
          <CardContent>
            {euinsL ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : euins.length > 0 ? (
              <ScrollArea className="h-52">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background border-b">
                    <tr>
                      <th className="text-left p-2 font-medium">EUIN</th>
                      <th className="text-left p-2 font-medium">Agent</th>
                      <th className="text-right p-2 font-medium">AUM</th>
                      <th className="text-right p-2 font-medium">Investors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {euins.map((e, i) => (
                      <tr key={i} className="border-b hover:bg-muted/50">
                        <td className="p-2 font-mono text-xs">{e.euinCode ?? e.euin ?? "—"}</td>
                        <td className="p-2">{e.name ?? e.agentName ?? "—"}</td>
                        <td className="p-2 text-right">{fmt(e.aum)}</td>
                        <td className="p-2 text-right">{e.investorCount ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            ) : (
              <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">
                No EUIN data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Risk Profile Donut */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Risk Profile Distribution</CardTitle>
            <CardDescription>Book breakdown by investor risk category</CardDescription>
          </CardHeader>
          <CardContent>
            {(inflowL || euinsL) ? (
              <Skeleton className="h-52 w-full" />
            ) : riskDonutData.length > 0 ? (
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie data={riskDonutData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                    dataKey="value" nameKey="name" paddingAngle={2}>
                    {riskDonutData.map((_, i) => (
                      <Cell key={i} fill={RISK_COLORS[i % RISK_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v}%`} />
                  <Legend iconType="circle" iconSize={10} formatter={v => <span className="text-xs">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-52 flex flex-col items-center justify-center text-sm text-muted-foreground gap-2">
                <Brain className="h-8 w-8 text-muted-foreground/40" />
                <p>Risk distribution data not available from IRIS</p>
                <p className="text-xs">Data will appear when IRIS returns risk profile aggregates</p>
              </div>
            )}
          </CardContent>
        </Card>
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

interface MandateRecord {
  mandateId?: string;
  id?: string;
  bankName?: string;
  bank?: string;
  status?: string;
  amount?: number;
}

interface OrderRecord {
  orderId?: string;
  id?: string;
  orderType?: string;
  type?: string;
  schemeName?: string;
  scheme?: string;
  amount?: number;
  status?: string;
  orderDate?: string;
  date?: string;
  transactionType?: string;
}

// ─── New SIP Dialog ──────────────────────────────────────────────────────────
function NewSipDialog({ open, onClose, prefillPan }: { open: boolean; onClose: () => void; prefillPan: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [pan, setPan] = useState(prefillPan);
  const [schemeQuery, setSchemeQuery] = useState("");
  const [selectedScheme, setSelectedScheme] = useState<SchemeResult | null>(null);
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState("MONTHLY");
  const [sipDate, setSipDate] = useState("");
  const [mandateId, setMandateId] = useState("none");

  // Sync PAN when the dialog is opened with a different investor
  useEffect(() => {
    if (open) setPan(prefillPan);
  }, [open, prefillPan]);

  const { data: schemeSearchData, isLoading: schemesLoading } = useQuery<IrisApiResponse<{ schemes?: SchemeResult[] } | SchemeResult[]>>({
    queryKey: ["/api/iris/transactions/scheme-search", schemeQuery],
    queryFn: () => irisGet<IrisApiResponse<{ schemes?: SchemeResult[] } | SchemeResult[]>>(`/api/iris/transactions/scheme-search?q=${encodeURIComponent(schemeQuery)}`),
    enabled: schemeQuery.length >= 2 && !selectedScheme,
    retry: false,
  });

  const { data: mandatesData } = useQuery<IrisApiResponse<{ mandates?: MandateRecord[] } | MandateRecord[]>>({
    queryKey: ["/api/iris/transactions/mandates", pan],
    queryFn: () => irisGet<IrisApiResponse<{ mandates?: MandateRecord[] } | MandateRecord[]>>(`/api/iris/transactions/mandates?pan=${encodeURIComponent(pan)}`),
    enabled: pan.length === 10,
    retry: false,
  });

  const schemes: SchemeResult[] = (() => {
    if (!schemeSearchData?.data) return [];
    if (Array.isArray(schemeSearchData.data)) return schemeSearchData.data;
    return schemeSearchData.data.schemes ?? [];
  })();

  const mandates: MandateRecord[] = (() => {
    if (!mandatesData?.data) return [];
    if (Array.isArray(mandatesData.data)) return mandatesData.data;
    return mandatesData.data.mandates ?? [];
  })();

  const registerSip = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiRequest("/api/iris/transactions/sip/register", "POST", { body }),
    onSuccess: () => {
      toast({ title: "SIP registered successfully" });
      qc.invalidateQueries({ queryKey: ["/api/iris/investors", pan, "systematic-plans"] });
      onClose();
      setPan(prefillPan); setSchemeQuery(""); setSelectedScheme(null); setAmount(""); setFrequency("MONTHLY"); setSipDate(""); setMandateId("none");
    },
    onError: (err: Error) => toast({ title: "SIP registration failed", description: err.message, variant: "destructive" }),
  });

  function handleSubmit() {
    if (!pan.trim()) { toast({ title: "PAN is required", variant: "destructive" }); return; }
    if (!selectedScheme) { toast({ title: "Please select a scheme", variant: "destructive" }); return; }
    if (!amount || Number(amount) <= 0) { toast({ title: "Enter a valid amount", variant: "destructive" }); return; }
    registerSip.mutate({
      pan,
      schemeCode: selectedScheme.schemeCode ?? selectedScheme.isinCode ?? selectedScheme.code,
      schemeName: selectedScheme.schemeName ?? selectedScheme.name,
      amount: Number(amount),
      frequency,
      sipDate: sipDate || undefined,
      mandateId: mandateId !== "none" ? mandateId : undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Register New SIP</DialogTitle>
          <DialogDescription>Set up a systematic investment plan for the investor</DialogDescription>
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
              <Input className="pl-9"
                value={selectedScheme ? (selectedScheme.schemeName ?? selectedScheme.name ?? "") : schemeQuery}
                onChange={e => { setSchemeQuery(e.target.value); setSelectedScheme(null); }}
                placeholder="Type scheme name (min 2 chars)…" />
            </div>
            {schemeQuery.length >= 2 && !selectedScheme && (
              <div className="border rounded-md mt-1 max-h-40 overflow-y-auto bg-background shadow-md">
                {schemesLoading ? <p className="p-2 text-xs text-muted-foreground">Searching…</p>
                  : schemes.length > 0 ? schemes.slice(0, 10).map((s, i) => (
                    <button key={i} className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex justify-between"
                      onClick={() => { setSelectedScheme(s); setSchemeQuery(""); }}>
                      <span>{s.schemeName ?? s.name}</span>
                      {(s.schemeCode ?? s.code) && <span className="text-xs text-muted-foreground">{s.schemeCode ?? s.code}</span>}
                    </button>
                  )) : <p className="p-2 text-xs text-muted-foreground">No schemes found</p>}
              </div>
            )}
            {selectedScheme && (
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{selectedScheme.schemeCode ?? selectedScheme.code}</Badge>
                <button className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-0.5"
                  onClick={() => { setSelectedScheme(null); setSchemeQuery(""); }}>
                  <XCircle className="h-3 w-3" /> Clear
                </button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Amount (₹) *</Label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="5000" min={1} />
            </div>
            <div>
              <Label>Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>SIP Start Date</Label>
              <Input type="date" value={sipDate} onChange={e => setSipDate(e.target.value)} />
            </div>
            <div>
              <Label>Mandate</Label>
              <Select value={mandateId} onValueChange={setMandateId}>
                <SelectTrigger><SelectValue placeholder="Select mandate…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No mandate</SelectItem>
                  {mandates.map((m, i) => (
                    <SelectItem key={i} value={m.mandateId ?? m.id ?? `m${i}`}>
                      {m.bankName ?? m.bank ?? "Mandate"} {m.mandateId ?? m.id} {m.status ? `(${m.status})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button className="w-full" onClick={handleSubmit} disabled={registerSip.isPending}>
            {registerSip.isPending ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Registering…</> : "Register SIP"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Risk Profiling Dialog ────────────────────────────────────────────────────
function RiskProfileDialog({ pan, open, onClose }: { pan: string; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const { data: questData, isLoading: questL } = useQuery<IrisApiResponse<{ questions?: RiskQuestion[] }>>({
    queryKey: ["/api/iris/risk-profile/questionnaire"],
    enabled: open,
    retry: false,
  });

  const questions: RiskQuestion[] = questData?.data?.questions ?? [];

  const submitProfile = useMutation({
    mutationFn: () => apiRequest(`/api/iris/investors/${pan}/risk-profile`, "POST", { body: { answers } }),
    onSuccess: () => {
      toast({ title: "Risk profile saved" });
      qc.invalidateQueries({ queryKey: ["/api/iris/investors", pan, "risk-profile"] });
      onClose();
      setStep(0);
      setAnswers({});
    },
    onError: (e: Error) => toast({ title: "Failed to save risk profile", description: e.message, variant: "destructive" }),
  });

  const currentQ = questions[step];

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Brain className="h-4 w-4" /> Risk Profile Assessment</DialogTitle>
          <DialogDescription>Answer the questions to determine the investor's risk profile</DialogDescription>
        </DialogHeader>
        {questL ? (
          <div className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-8 w-full" /></div>
        ) : questions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No questionnaire available from IRIS</p>
        ) : (
          <div className="space-y-4 pt-2">
            <p className="text-xs text-muted-foreground">Question {step + 1} of {questions.length}</p>
            <p className="font-medium text-sm">{currentQ?.question}</p>
            <div className="space-y-2">
              {(currentQ?.options ?? []).map((opt, i) => {
                const optId = opt.id ?? opt.value ?? String(i);
                const optLabel = opt.text ?? opt.label ?? opt.value ?? "";
                const qId = currentQ?.questionId ?? currentQ?.id ?? String(step);
                return (
                  <button key={i}
                    className={`w-full text-left p-3 rounded border text-sm transition-colors ${answers[qId] === optId ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'}`}
                    onClick={() => setAnswers(prev => ({ ...prev, [qId]: optId }))}>
                    {optLabel}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}>Back</Button>
              {step < questions.length - 1 ? (
                <Button className="flex-1" onClick={() => setStep(s => s + 1)}
                  disabled={!answers[currentQ?.questionId ?? currentQ?.id ?? String(step)]}>
                  Next
                </Button>
              ) : (
                <Button className="flex-1" onClick={() => submitProfile.mutate()}
                  disabled={submitProfile.isPending || !answers[currentQ?.questionId ?? currentQ?.id ?? String(step)]}>
                  {submitProfile.isPending ? "Saving…" : "Submit"}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Modify SIP Dialog ────────────────────────────────────────────────────────
function ModifySipDialog({ open, onClose, sip, pan }: { open: boolean; onClose: () => void; sip: SipRecord | null; pan: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [sipDate, setSipDate] = useState("");

  // Sync pre-filled values when the sip target changes
  useEffect(() => {
    if (sip) {
      setAmount(sip.amount?.toString() ?? "");
      setSipDate(sip.nextInstallmentDate ?? sip.nextDate ?? "");
    }
  }, [sip]);

  const modifySip = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiRequest(`/api/iris/transactions/sip/${sip?.sipRegistrationNo}/modify`, "PATCH", { body }),
    onSuccess: () => {
      toast({ title: "SIP modified successfully" });
      qc.invalidateQueries({ queryKey: ["/api/iris/investors", pan, "systematic-plans"] });
      onClose();
    },
    onError: (err: Error) => toast({ title: "SIP modification failed", description: err.message, variant: "destructive" }),
  });

  function handleSubmit() {
    if (!sip?.sipRegistrationNo) { toast({ title: "SIP registration number missing", variant: "destructive" }); return; }
    if (!amount || Number(amount) <= 0) { toast({ title: "Enter a valid amount", variant: "destructive" }); return; }
    modifySip.mutate({ pan, amount: Number(amount), sipDate: sipDate || undefined });
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Modify SIP</DialogTitle>
          <DialogDescription>{sip?.schemeName ?? sip?.scheme ?? "SIP"} — {sip?.sipRegistrationNo}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>New Amount (₹)</Label>
            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="5000" min={1} />
          </div>
          <div>
            <Label>New SIP Date</Label>
            <Input type="date" value={sipDate} onChange={e => setSipDate(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={handleSubmit} disabled={modifySip.isPending}>
              {modifySip.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Order Status Dialog ──────────────────────────────────────────────────────
function OrderStatusDialog({ open, onClose, orderId }: { open: boolean; onClose: () => void; orderId: string }) {
  const { data, isLoading } = useQuery<IrisApiResponse<OrderRecord>>({
    queryKey: ["/api/iris/transactions/orders", orderId],
    queryFn: () => irisGet<IrisApiResponse<OrderRecord>>(`/api/iris/transactions/orders/${orderId}`),
    enabled: open && !!orderId,
    retry: false,
  });

  const order = data?.data;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Order Status</DialogTitle>
          <DialogDescription>Order ID: {orderId}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          {isLoading ? <Skeleton className="h-24 w-full" /> : order ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Scheme</span><span className="font-medium text-right max-w-[60%]">{order.schemeName ?? order.scheme ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span>{order.orderType ?? order.type ?? order.transactionType ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span>{order.amount != null ? fmt(order.amount) : "—"}</span></div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={order.status === 'SUCCESS' ? 'default' : order.status === 'PENDING' ? 'secondary' : 'destructive'}>
                  {order.status ?? "—"}
                </Badge>
              </div>
              <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span>{order.orderDate ?? order.date ?? "—"}</span></div>
            </div>
          ) : <p className="text-sm text-muted-foreground">No order data found</p>}
          <Button variant="outline" className="w-full mt-2" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Non-Financial Manage Dialog ──────────────────────────────────────────────
interface ManagePanelProps { pan: string; onClose: () => void }

function ManageInvestorPanel({ pan, onClose }: ManagePanelProps) {
  const [tab, setTab] = useState<"nominee" | "bank" | "contact" | "fatca" | "idcw" | "mandate">("nominee");
  const { toast } = useToast();
  const qc = useQueryClient();

  const nomineeQ = useQuery<IrisApiResponse<Record<string, unknown>>>({
    queryKey: ["/api/iris/non-financial", pan, "nominee"],
    queryFn: () => irisGet(`/api/iris/non-financial/${pan}/nominee`),
    retry: false,
  });
  const bankQ = useQuery<IrisApiResponse<Record<string, unknown>>>({
    queryKey: ["/api/iris/non-financial", pan, "bank"],
    queryFn: () => irisGet(`/api/iris/non-financial/${pan}/bank`),
    retry: false,
  });
  const fatcaQ = useQuery<IrisApiResponse<Record<string, unknown>>>({
    queryKey: ["/api/iris/non-financial", pan, "fatca"],
    queryFn: () => irisGet(`/api/iris/non-financial/${pan}/fatca`),
    retry: false,
  });

  const [nomineeForm, setNomineeForm] = useState({ nomineeName: "", nomineeRelation: "", nomineePercentage: "100" });
  const [bankForm, setBankForm] = useState({ accountNumber: "", ifscCode: "", accountType: "SAVINGS", bankName: "" });
  const [contactForm, setContactForm] = useState({ email: "", mobile: "" });
  const [fatcaForm, setFatcaForm] = useState({ taxResidency: "", taxIdNumber: "" });
  const [idcwOption, setIdcwOption] = useState("PAYOUT");
  const [mandateForm, setMandateForm] = useState({ bankAccountNo: "", ifscCode: "", amount: "", action: "CREATE" });

  // Pre-fill forms from fetched current values
  useEffect(() => {
    const d = nomineeQ.data?.data as { nomineeName?: string; nomineeRelation?: string; nomineePercentage?: string } | undefined;
    if (d) {
      setNomineeForm({
        nomineeName: d.nomineeName ?? "",
        nomineeRelation: d.nomineeRelation ?? "",
        nomineePercentage: d.nomineePercentage ?? "100",
      });
    }
  }, [nomineeQ.data]);

  useEffect(() => {
    const d = bankQ.data?.data as { accountNumber?: string; ifscCode?: string; accountType?: string; bankName?: string } | undefined;
    if (d) {
      setBankForm({
        accountNumber: d.accountNumber ?? "",
        ifscCode: d.ifscCode ?? "",
        accountType: d.accountType ?? "SAVINGS",
        bankName: d.bankName ?? "",
      });
    }
  }, [bankQ.data]);

  useEffect(() => {
    const d = fatcaQ.data?.data as { taxResidency?: string; taxIdNumber?: string } | undefined;
    if (d) {
      setFatcaForm({
        taxResidency: d.taxResidency ?? "",
        taxIdNumber: d.taxIdNumber ?? "",
      });
    }
  }, [fatcaQ.data]);

  const updateNominee = useMutation({
    mutationFn: () => apiRequest(`/api/iris/non-financial/${pan}/nominee`, "POST", { body: nomineeForm }),
    onSuccess: () => { toast({ title: "Nominee updated" }); qc.invalidateQueries({ queryKey: ["/api/iris/non-financial", pan, "nominee"] }); },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  const updateBank = useMutation({
    mutationFn: () => apiRequest(`/api/iris/non-financial/${pan}/bank`, "POST", { body: bankForm }),
    onSuccess: () => { toast({ title: "Bank details updated" }); qc.invalidateQueries({ queryKey: ["/api/iris/non-financial", pan, "bank"] }); },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  const updateEmail = useMutation({
    mutationFn: () => apiRequest(`/api/iris/non-financial/${pan}/email`, "POST", { body: { email: contactForm.email } }),
    onSuccess: () => toast({ title: "Email updated" }),
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  const updateMobile = useMutation({
    mutationFn: () => apiRequest(`/api/iris/non-financial/${pan}/mobile`, "POST", { body: { mobile: contactForm.mobile } }),
    onSuccess: () => toast({ title: "Mobile updated" }),
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  const updateFatca = useMutation({
    mutationFn: () => apiRequest(`/api/iris/non-financial/${pan}/fatca`, "POST", { body: fatcaForm }),
    onSuccess: () => { toast({ title: "FATCA updated" }); qc.invalidateQueries({ queryKey: ["/api/iris/non-financial", pan, "fatca"] }); },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  const updateIdcw = useMutation({
    mutationFn: () => apiRequest(`/api/iris/non-financial/${pan}/idcw`, "POST", { body: { idcwOption } }),
    onSuccess: () => toast({ title: "IDCW option updated" }),
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  const manageMandate = useMutation({
    mutationFn: () => apiRequest(`/api/iris/non-financial/${pan}/bank-mandate`, "POST", { body: mandateForm }),
    onSuccess: () => toast({ title: "Bank mandate request submitted" }),
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const TABS: { key: typeof tab; label: string }[] = [
    { key: "nominee", label: "Nominee" },
    { key: "bank", label: "Bank" },
    { key: "contact", label: "Contact" },
    { key: "fatca", label: "FATCA" },
    { key: "idcw", label: "IDCW" },
    { key: "mandate", label: "Mandate" },
  ];

  function DataRow({ label, value }: { label: string; value?: unknown }) {
    return (
      <div className="flex justify-between text-sm py-1 border-b last:border-0">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value != null ? String(value) : "—"}</span>
      </div>
    );
  }

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Settings className="h-4 w-4" /> Manage Investor — {pan}</DialogTitle>
          <DialogDescription>View and update non-financial details. Current values are pre-loaded where available.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 flex-wrap border-b pb-2">
          {TABS.map(t => (
            <Button key={t.key} size="sm" variant={tab === t.key ? "default" : "ghost"}
              onClick={() => setTab(t.key)} className="text-xs h-7">
              {t.label}
            </Button>
          ))}
        </div>

        <div className="space-y-4 pt-2">
          {tab === "nominee" && (
            <>
              <div className="bg-muted/30 rounded p-3 text-sm">
                <p className="font-medium mb-2 text-xs text-muted-foreground uppercase tracking-wide">Current Nominee</p>
                {nomineeQ.isLoading ? <Skeleton className="h-12 w-full" /> : nomineeQ.data?.data ? (
                  <>
                    <DataRow label="Name" value={(nomineeQ.data.data as {nomineeName?: string}).nomineeName} />
                    <DataRow label="Relation" value={(nomineeQ.data.data as {nomineeRelation?: string}).nomineeRelation} />
                    <DataRow label="Allocation %" value={(nomineeQ.data.data as {nomineePercentage?: string}).nomineePercentage} />
                  </>
                ) : <p className="text-muted-foreground text-xs">No data available</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Nominee Name</Label>
                  <Input value={nomineeForm.nomineeName} onChange={e => setNomineeForm(p => ({ ...p, nomineeName: e.target.value }))} placeholder="Full name" /></div>
                <div><Label className="text-xs">Relation</Label>
                  <Select value={nomineeForm.nomineeRelation} onValueChange={v => setNomineeForm(p => ({ ...p, nomineeRelation: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {["SPOUSE","CHILD","PARENT","SIBLING","OTHER"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select></div>
                <div><Label className="text-xs">Allocation %</Label>
                  <Input type="number" value={nomineeForm.nomineePercentage} min={1} max={100}
                    onChange={e => setNomineeForm(p => ({ ...p, nomineePercentage: e.target.value }))} /></div>
              </div>
              <Button onClick={() => updateNominee.mutate()} disabled={updateNominee.isPending} className="w-full">
                {updateNominee.isPending ? "Saving…" : "Update Nominee"}
              </Button>
            </>
          )}

          {tab === "bank" && (
            <>
              <div className="bg-muted/30 rounded p-3 text-sm">
                <p className="font-medium mb-2 text-xs text-muted-foreground uppercase tracking-wide">Current Bank Account</p>
                {bankQ.isLoading ? <Skeleton className="h-12 w-full" /> : bankQ.data?.data ? (
                  <>
                    <DataRow label="Account No" value={(bankQ.data.data as {accountNumber?: string}).accountNumber} />
                    <DataRow label="IFSC" value={(bankQ.data.data as {ifscCode?: string}).ifscCode} />
                    <DataRow label="Bank" value={(bankQ.data.data as {bankName?: string}).bankName} />
                    <DataRow label="Type" value={(bankQ.data.data as {accountType?: string}).accountType} />
                  </>
                ) : <p className="text-muted-foreground text-xs">No data available</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Account Number</Label>
                  <Input value={bankForm.accountNumber} onChange={e => setBankForm(p => ({ ...p, accountNumber: e.target.value }))} /></div>
                <div><Label className="text-xs">IFSC Code</Label>
                  <Input value={bankForm.ifscCode} onChange={e => setBankForm(p => ({ ...p, ifscCode: e.target.value.toUpperCase() }))} /></div>
                <div><Label className="text-xs">Bank Name</Label>
                  <Input value={bankForm.bankName} onChange={e => setBankForm(p => ({ ...p, bankName: e.target.value }))} /></div>
                <div><Label className="text-xs">Account Type</Label>
                  <Select value={bankForm.accountType} onValueChange={v => setBankForm(p => ({ ...p, accountType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SAVINGS">Savings</SelectItem>
                      <SelectItem value="CURRENT">Current</SelectItem>
                      <SelectItem value="NRE">NRE</SelectItem>
                      <SelectItem value="NRO">NRO</SelectItem>
                    </SelectContent>
                  </Select></div>
              </div>
              <Button onClick={() => updateBank.mutate()} disabled={updateBank.isPending} className="w-full">
                {updateBank.isPending ? "Saving…" : "Update Bank Account"}
              </Button>
            </>
          )}

          {tab === "contact" && (
            <>
              <div className="grid grid-cols-1 gap-3">
                <div><Label className="text-xs">New Email Address</Label>
                  <Input type="email" value={contactForm.email} onChange={e => setContactForm(p => ({ ...p, email: e.target.value }))} placeholder="investor@email.com" /></div>
                <Button onClick={() => updateEmail.mutate()} disabled={updateEmail.isPending || !contactForm.email}>
                  {updateEmail.isPending ? "Saving…" : "Update Email"}
                </Button>
                <div className="border-t pt-3">
                  <Label className="text-xs">New Mobile Number</Label>
                  <Input value={contactForm.mobile} onChange={e => setContactForm(p => ({ ...p, mobile: e.target.value }))} placeholder="+91XXXXXXXXXX" /></div>
                <Button onClick={() => updateMobile.mutate()} disabled={updateMobile.isPending || !contactForm.mobile}>
                  {updateMobile.isPending ? "Saving…" : "Update Mobile"}
                </Button>
              </div>
            </>
          )}

          {tab === "fatca" && (
            <>
              <div className="bg-muted/30 rounded p-3 text-sm">
                <p className="font-medium mb-2 text-xs text-muted-foreground uppercase tracking-wide">Current FATCA</p>
                {fatcaQ.isLoading ? <Skeleton className="h-10 w-full" /> : fatcaQ.data?.data ? (
                  <>
                    <DataRow label="Tax Residency" value={(fatcaQ.data.data as {taxResidency?: string}).taxResidency} />
                    <DataRow label="Tax ID" value={(fatcaQ.data.data as {taxIdNumber?: string}).taxIdNumber} />
                  </>
                ) : <p className="text-muted-foreground text-xs">No data available</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Country of Tax Residency</Label>
                  <Input value={fatcaForm.taxResidency} onChange={e => setFatcaForm(p => ({ ...p, taxResidency: e.target.value }))} placeholder="US, UK, IN…" /></div>
                <div><Label className="text-xs">Tax Identification Number</Label>
                  <Input value={fatcaForm.taxIdNumber} onChange={e => setFatcaForm(p => ({ ...p, taxIdNumber: e.target.value }))} /></div>
              </div>
              <Button onClick={() => updateFatca.mutate()} disabled={updateFatca.isPending} className="w-full">
                {updateFatca.isPending ? "Saving…" : "Update FATCA"}
              </Button>
            </>
          )}

          {tab === "idcw" && (
            <>
              <p className="text-sm text-muted-foreground">Set dividend / IDCW payout preference for this investor.</p>
              <div>
                <Label className="text-xs">IDCW Option</Label>
                <Select value={idcwOption} onValueChange={setIdcwOption}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PAYOUT">Payout</SelectItem>
                    <SelectItem value="REINVESTMENT">Reinvestment</SelectItem>
                    <SelectItem value="GROWTH">Growth</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => updateIdcw.mutate()} disabled={updateIdcw.isPending} className="w-full">
                {updateIdcw.isPending ? "Saving…" : "Update IDCW Option"}
              </Button>
            </>
          )}

          {tab === "mandate" && (
            <>
              <p className="text-sm text-muted-foreground">Create or cancel a bank mandate (eNACH) for auto-debit.</p>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Bank Account No</Label>
                  <Input value={mandateForm.bankAccountNo} onChange={e => setMandateForm(p => ({ ...p, bankAccountNo: e.target.value }))} /></div>
                <div><Label className="text-xs">IFSC Code</Label>
                  <Input value={mandateForm.ifscCode} onChange={e => setMandateForm(p => ({ ...p, ifscCode: e.target.value.toUpperCase() }))} /></div>
                <div><Label className="text-xs">Max Mandate Amount (₹)</Label>
                  <Input type="number" value={mandateForm.amount} onChange={e => setMandateForm(p => ({ ...p, amount: e.target.value }))} /></div>
                <div><Label className="text-xs">Action</Label>
                  <Select value={mandateForm.action} onValueChange={v => setMandateForm(p => ({ ...p, action: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CREATE">Create Mandate</SelectItem>
                      <SelectItem value="CANCEL">Cancel Mandate</SelectItem>
                    </SelectContent>
                  </Select></div>
              </div>
              <Button onClick={() => manageMandate.mutate()} disabled={manageMandate.isPending} className="w-full">
                {manageMandate.isPending ? "Submitting…" : "Submit Mandate Request"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Order Tracking Dialog ────────────────────────────────────────────────────
function OrderTrackingDialog({ orderId, open, onClose }: { orderId: string; open: boolean; onClose: () => void }) {
  const { data, isLoading } = useQuery<IrisApiResponse<{ events?: TrackingEvent[]; tracking?: TrackingEvent[] }>>({
    queryKey: ["/api/iris/transactions", orderId, "tracking"],
    queryFn: () => irisGet(`/api/iris/transactions/${orderId}/tracking`),
    enabled: open && !!orderId,
    retry: false,
  });

  const events: TrackingEvent[] = data?.data?.events ?? data?.data?.tracking ?? [];

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Order Tracking</DialogTitle>
          <DialogDescription>Order ID: {orderId}</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : events.length > 0 ? (
          <div className="space-y-3 pt-2">
            {events.map((ev, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="flex flex-col items-center">
                  <div className={`h-3 w-3 rounded-full mt-0.5 ${i === 0 ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
                  {i < events.length - 1 && <div className="w-0.5 h-8 bg-muted-foreground/20 mt-1" />}
                </div>
                <div>
                  <p className="text-sm font-medium">{ev.status ?? ev.description ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{ev.timestamp ?? ev.date ?? ""}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">No tracking events found</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Folio Browser ────────────────────────────────────────────────────────────
interface Folio { folioNo?: string; amcName?: string; amc?: string; schemeCount?: number; currentValue?: number }
interface FolioTxn { schemeName?: string; scheme?: string; amount?: number; transactionType?: string; type?: string; date?: string; transactionDate?: string; status?: string; units?: number }

function FolioBrowser({ pan }: { pan: string }) {
  const [selectedFolio, setSelectedFolio] = useState<string | null>(null);

  const foliosQ = useQuery<IrisApiResponse<{ folios?: Folio[] } | Folio[]>>({
    queryKey: ["/api/iris/investors", pan, "folios"],
    queryFn: () => irisGet(`/api/iris/investors/${pan}/folios`),
    retry: false,
  });

  const txnsQ = useQuery<IrisApiResponse<{ transactions?: FolioTxn[] } | FolioTxn[]>>({
    queryKey: ["/api/iris/investors", pan, "folios", selectedFolio, "transactions"],
    queryFn: () => irisGet(`/api/iris/investors/${pan}/folios/${selectedFolio}/transactions`),
    enabled: !!selectedFolio,
    retry: false,
  });

  function resolveFolios(): Folio[] {
    if (!foliosQ.data?.data) return [];
    if (Array.isArray(foliosQ.data.data)) return foliosQ.data.data;
    return (foliosQ.data.data as { folios?: Folio[] }).folios ?? [];
  }

  function resolveTxns(): FolioTxn[] {
    if (!txnsQ.data?.data) return [];
    if (Array.isArray(txnsQ.data.data)) return txnsQ.data.data;
    return (txnsQ.data.data as { transactions?: FolioTxn[] }).transactions ?? [];
  }

  const folios = resolveFolios();
  const txns = resolveTxns();

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader><CardTitle className="text-sm">Folio Browser</CardTitle><CardDescription>Click a folio to view transaction history</CardDescription></CardHeader>
        <CardContent className="p-0">
          {foliosQ.isLoading ? (
            <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : folios.length > 0 ? (
            <ScrollArea className="h-48">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background border-b">
                  <tr>
                    <th className="text-left p-2 font-medium">Folio No</th>
                    <th className="text-left p-2 font-medium">AMC</th>
                    <th className="text-right p-2 font-medium">Schemes</th>
                    <th className="text-right p-2 font-medium">Current Value</th>
                  </tr>
                </thead>
                <tbody>
                  {folios.map((f, i) => (
                    <tr key={i}
                      className={`border-b cursor-pointer hover:bg-muted/50 ${selectedFolio === f.folioNo ? 'bg-muted' : ''}`}
                      onClick={() => setSelectedFolio(f.folioNo ?? null)}>
                      <td className="p-2 font-mono text-xs">{f.folioNo ?? "—"}</td>
                      <td className="p-2">{f.amcName ?? f.amc ?? "—"}</td>
                      <td className="p-2 text-right">{f.schemeCount ?? "—"}</td>
                      <td className="p-2 text-right">{fmt(f.currentValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          ) : (
            <p className="p-4 text-sm text-muted-foreground">No folios found</p>
          )}
        </CardContent>
      </Card>

      {selectedFolio && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Transactions — Folio {selectedFolio}</CardTitle></CardHeader>
          <CardContent className="p-0">
            {txnsQ.isLoading ? (
              <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : txns.length > 0 ? (
              <ScrollArea className="h-52">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background border-b">
                    <tr>
                      <th className="text-left p-2 font-medium">Scheme</th>
                      <th className="text-left p-2 font-medium">Type</th>
                      <th className="text-right p-2 font-medium">Amount</th>
                      <th className="text-right p-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txns.map((t, i) => (
                      <tr key={i} className="border-b hover:bg-muted/50">
                        <td className="p-2 max-w-[160px] truncate">{t.schemeName ?? t.scheme ?? "—"}</td>
                        <td className="p-2 text-xs">{t.transactionType ?? t.type ?? "—"}</td>
                        <td className="p-2 text-right">{fmt(t.amount)}</td>
                        <td className="p-2 text-right">
                          <Badge variant={t.status === 'SUCCESS' ? 'default' : 'secondary'} className="text-[10px]">{t.status ?? "—"}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            ) : (
              <p className="p-4 text-sm text-muted-foreground">No transactions for this folio</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Dividend History ─────────────────────────────────────────────────────────
interface DividendRecord { schemeName?: string; scheme?: string; dividendDate?: string; date?: string; dividendPerUnit?: number; totalAmount?: number; amount?: number }

function DividendHistory({ pan }: { pan: string }) {
  const q = useQuery<IrisApiResponse<{ dividends?: DividendRecord[] } | DividendRecord[]>>({
    queryKey: ["/api/iris/investors", pan, "dividend-history"],
    queryFn: () => irisGet(`/api/iris/investors/${pan}/dividend-history`),
    retry: false,
  });

  function resolve(): DividendRecord[] {
    if (!q.data?.data) return [];
    if (Array.isArray(q.data.data)) return q.data.data;
    return (q.data.data as { dividends?: DividendRecord[] }).dividends ?? [];
  }

  const records = resolve();

  if (q.isLoading) return <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>;

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Dividend History</CardTitle></CardHeader>
      <CardContent className="p-0">
        {records.length > 0 ? (
          <ScrollArea className="h-48">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background border-b">
                <tr>
                  <th className="text-left p-2 font-medium">Scheme</th>
                  <th className="text-left p-2 font-medium">Date</th>
                  <th className="text-right p-2 font-medium">Per Unit</th>
                  <th className="text-right p-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={i} className="border-b hover:bg-muted/50">
                    <td className="p-2 truncate max-w-[140px]">{r.schemeName ?? r.scheme ?? "—"}</td>
                    <td className="p-2 text-xs">{r.dividendDate ?? r.date ?? "—"}</td>
                    <td className="p-2 text-right text-xs">{r.dividendPerUnit != null ? "₹" + r.dividendPerUnit : "—"}</td>
                    <td className="p-2 text-right">{fmt(r.totalAmount ?? r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">No dividend history found</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Goals Panel ──────────────────────────────────────────────────────────────
interface Goal { goalId?: string; id?: string; goalName?: string; name?: string; targetAmount?: number; targetDate?: string; currentSavings?: number; status?: string }

function GoalsPanel({ pan }: { pan: string }) {
  const [showForm, setShowForm] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [form, setForm] = useState({ goalName: "", targetAmount: "", targetDate: "", currentSavings: "" });
  const { toast } = useToast();
  const qc = useQueryClient();

  const goalsQ = useQuery<IrisApiResponse<{ goals?: Goal[] } | Goal[]>>({
    queryKey: ["/api/iris/investors", pan, "goals"],
    queryFn: () => irisGet(`/api/iris/investors/${pan}/goals`),
    retry: false,
  });

  const createGoal = useMutation({
    mutationFn: () => apiRequest(`/api/iris/investors/${pan}/goals`, "POST", { body: {
      goalName: form.goalName,
      targetAmount: Number(form.targetAmount),
      targetDate: form.targetDate,
      currentSavings: Number(form.currentSavings),
    }}),
    onSuccess: () => {
      toast({ title: "Goal created" });
      qc.invalidateQueries({ queryKey: ["/api/iris/investors", pan, "goals"] });
      setShowForm(false);
      setForm({ goalName: "", targetAmount: "", targetDate: "", currentSavings: "" });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const updateGoal = useMutation({
    mutationFn: () => {
      const id = editGoal?.goalId ?? editGoal?.id ?? "";
      return apiRequest(`/api/iris/investors/${pan}/goals/${id}`, "PUT", { body: {
        goalName: form.goalName,
        targetAmount: Number(form.targetAmount),
        targetDate: form.targetDate,
        currentSavings: Number(form.currentSavings),
      }});
    },
    onSuccess: () => {
      toast({ title: "Goal updated" });
      qc.invalidateQueries({ queryKey: ["/api/iris/investors", pan, "goals"] });
      setEditGoal(null);
      setForm({ goalName: "", targetAmount: "", targetDate: "", currentSavings: "" });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const deleteGoal = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/iris/investors/${pan}/goals/${id}`, "DELETE"),
    onSuccess: () => {
      toast({ title: "Goal deleted" });
      qc.invalidateQueries({ queryKey: ["/api/iris/investors", pan, "goals"] });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  function resolveGoals(): Goal[] {
    if (!goalsQ.data?.data) return [];
    if (Array.isArray(goalsQ.data.data)) return goalsQ.data.data;
    return (goalsQ.data.data as { goals?: Goal[] }).goals ?? [];
  }

  const goals = resolveGoals();

  function startEdit(g: Goal) {
    setEditGoal(g);
    setForm({
      goalName: g.goalName ?? g.name ?? "",
      targetAmount: String(g.targetAmount ?? ""),
      targetDate: g.targetDate ?? "",
      currentSavings: String(g.currentSavings ?? ""),
    });
    setShowForm(true);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2"><Target className="h-4 w-4" /> Financial Goals</h3>
        <Button size="sm" variant="outline" onClick={() => { setEditGoal(null); setForm({ goalName: "", targetAmount: "", targetDate: "", currentSavings: "" }); setShowForm(!showForm); }}>
          <Plus className="h-3 w-3 mr-1" /> Add Goal
        </Button>
      </div>

      {showForm && (
        <Card className="border-dashed">
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Goal Name</Label>
                <Input value={form.goalName} onChange={e => setForm(p => ({ ...p, goalName: e.target.value }))} placeholder="Retirement, Education…" /></div>
              <div><Label className="text-xs">Target Amount (₹)</Label>
                <Input type="number" value={form.targetAmount} onChange={e => setForm(p => ({ ...p, targetAmount: e.target.value }))} /></div>
              <div><Label className="text-xs">Target Date</Label>
                <Input type="date" value={form.targetDate} onChange={e => setForm(p => ({ ...p, targetDate: e.target.value }))} /></div>
              <div><Label className="text-xs">Current Savings (₹)</Label>
                <Input type="number" value={form.currentSavings} onChange={e => setForm(p => ({ ...p, currentSavings: e.target.value }))} /></div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button className="flex-1"
                disabled={editGoal ? updateGoal.isPending : createGoal.isPending}
                onClick={() => editGoal ? updateGoal.mutate() : createGoal.mutate()}>
                {(editGoal ? updateGoal.isPending : createGoal.isPending) ? "Saving…" : editGoal ? "Update Goal" : "Create Goal"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {goalsQ.isLoading ? (
        <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : goals.length > 0 ? (
        <div className="space-y-2">
          {goals.map((g, i) => {
            const id = g.goalId ?? g.id ?? String(i);
            const progress = g.targetAmount && g.currentSavings ? Math.min(100, Math.round((g.currentSavings / g.targetAmount) * 100)) : 0;
            return (
              <Card key={i}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{g.goalName ?? g.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Target: {fmt(g.targetAmount)} by {g.targetDate ?? "—"} · Saved: {fmt(g.currentSavings)}
                      </p>
                      <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${progress}%` }} />
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{progress}% complete</p>
                    </div>
                    <div className="flex gap-1 ml-2 shrink-0">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(g)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => deleteGoal.mutate(id)} disabled={deleteGoal.isPending}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No goals set for this investor</p>
      )}
    </div>
  );
}

// ─── Demat & Docs Panel ───────────────────────────────────────────────────────
interface DematAccount { dpId?: string; clientId?: string; dpName?: string; accountNo?: string; status?: string }
interface InvestorDoc { documentId?: string; id?: string; documentType?: string; type?: string; fileName?: string; url?: string; uploadedAt?: string }

function DematDocsPanel({ pan }: { pan: string }) {
  const [linkForm, setLinkForm] = useState({ dpId: "", clientId: "", dpName: "" });
  const [docType, setDocType] = useState("PAN_CARD");
  const [docUrl, setDocUrl] = useState("");
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [showDocForm, setShowDocForm] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const dematQ = useQuery<IrisApiResponse<{ accounts?: DematAccount[] } | DematAccount[]>>({
    queryKey: ["/api/iris/investors", pan, "demat-accounts"],
    queryFn: () => irisGet(`/api/iris/investors/${pan}/demat-accounts`),
    retry: false,
  });

  const docsQ = useQuery<IrisApiResponse<{ documents?: InvestorDoc[] } | InvestorDoc[]>>({
    queryKey: ["/api/iris/investors", pan, "documents"],
    queryFn: () => irisGet(`/api/iris/investors/${pan}/documents`),
    retry: false,
  });

  const linkDemat = useMutation({
    mutationFn: () => apiRequest(`/api/iris/investors/${pan}/demat-accounts`, "POST", { body: linkForm }),
    onSuccess: () => {
      toast({ title: "Demat account linked" });
      qc.invalidateQueries({ queryKey: ["/api/iris/investors", pan, "demat-accounts"] });
      setShowLinkForm(false);
      setLinkForm({ dpId: "", clientId: "", dpName: "" });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const uploadDoc = useMutation({
    mutationFn: () => apiRequest(`/api/iris/investors/${pan}/documents`, "POST", { body: { documentType: docType, url: docUrl } }),
    onSuccess: () => {
      toast({ title: "Document uploaded" });
      qc.invalidateQueries({ queryKey: ["/api/iris/investors", pan, "documents"] });
      setShowDocForm(false);
      setDocUrl("");
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  function resolveDemat(): DematAccount[] {
    if (!dematQ.data?.data) return [];
    if (Array.isArray(dematQ.data.data)) return dematQ.data.data;
    return (dematQ.data.data as { accounts?: DematAccount[] }).accounts ?? [];
  }

  function resolveDocs(): InvestorDoc[] {
    if (!docsQ.data?.data) return [];
    if (Array.isArray(docsQ.data.data)) return docsQ.data.data;
    return (docsQ.data.data as { documents?: InvestorDoc[] }).documents ?? [];
  }

  const demat = resolveDemat();
  const docs = resolveDocs();

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium flex items-center gap-2"><CreditCard className="h-4 w-4" /> Demat Accounts</h3>
          <Button size="sm" variant="outline" onClick={() => setShowLinkForm(!showLinkForm)}>
            <Link2 className="h-3 w-3 mr-1" /> Link Demat
          </Button>
        </div>
        {showLinkForm && (
          <Card className="border-dashed">
            <CardContent className="pt-4 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div><Label className="text-xs">DP ID</Label>
                  <Input value={linkForm.dpId} onChange={e => setLinkForm(p => ({ ...p, dpId: e.target.value }))} /></div>
                <div><Label className="text-xs">Client ID</Label>
                  <Input value={linkForm.clientId} onChange={e => setLinkForm(p => ({ ...p, clientId: e.target.value }))} /></div>
                <div><Label className="text-xs">DP Name</Label>
                  <Input value={linkForm.dpName} onChange={e => setLinkForm(p => ({ ...p, dpName: e.target.value }))} /></div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowLinkForm(false)}>Cancel</Button>
                <Button className="flex-1" onClick={() => linkDemat.mutate()} disabled={linkDemat.isPending}>
                  {linkDemat.isPending ? "Linking…" : "Link Account"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        {dematQ.isLoading ? <Skeleton className="h-10 w-full" /> : demat.length > 0 ? (
          <div className="divide-y border rounded-md">
            {demat.map((d, i) => (
              <div key={i} className="flex justify-between items-center p-2 text-sm">
                <div>
                  <span className="font-mono text-xs">{d.dpId ?? "—"}:{d.clientId ?? d.accountNo ?? "—"}</span>
                  {d.dpName && <span className="ml-2 text-muted-foreground text-xs">({d.dpName})</span>}
                </div>
                <Badge variant={d.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-[10px]">{d.status ?? "—"}</Badge>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-muted-foreground">No demat accounts linked</p>}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium flex items-center gap-2"><Upload className="h-4 w-4" /> Document Vault</h3>
          <Button size="sm" variant="outline" onClick={() => setShowDocForm(!showDocForm)}>
            <Plus className="h-3 w-3 mr-1" /> Add Document
          </Button>
        </div>
        {showDocForm && (
          <Card className="border-dashed">
            <CardContent className="pt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Document Type</Label>
                  <Select value={docType} onValueChange={setDocType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PAN_CARD">PAN Card</SelectItem>
                      <SelectItem value="ADDRESS_PROOF">Address Proof</SelectItem>
                      <SelectItem value="BANK_PROOF">Bank Proof</SelectItem>
                      <SelectItem value="PHOTO">Photograph</SelectItem>
                      <SelectItem value="SIGNATURE">Signature</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select></div>
                <div><Label className="text-xs">Document URL / Path</Label>
                  <Input value={docUrl} onChange={e => setDocUrl(e.target.value)} placeholder="https://…" /></div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowDocForm(false)}>Cancel</Button>
                <Button className="flex-1" onClick={() => uploadDoc.mutate()} disabled={uploadDoc.isPending || !docUrl.trim()}>
                  {uploadDoc.isPending ? "Uploading…" : "Upload Document"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        {docsQ.isLoading ? <Skeleton className="h-10 w-full" /> : docs.length > 0 ? (
          <div className="divide-y border rounded-md">
            {docs.map((d, i) => (
              <div key={i} className="flex justify-between items-center p-2 text-sm">
                <div>
                  <Badge variant="outline" className="text-[10px] mr-2">{d.documentType ?? d.type}</Badge>
                  <span className="text-xs text-muted-foreground">{d.fileName ?? d.url ?? "—"}</span>
                </div>
                {d.url && (
                  <a href={d.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-muted-foreground">No documents uploaded</p>}
      </div>
    </div>
  );
}

// ─── Investor Portal Link ─────────────────────────────────────────────────────
function PortalLinkButton({ pan }: { pan: string }) {
  const { toast } = useToast();
  const [link, setLink] = useState<string | null>(null);

  const getLink = useQuery<IrisApiResponse<{ url?: string; link?: string; portalUrl?: string }>>({
    queryKey: ["/api/iris/investors", pan, "portal-link"],
    queryFn: () => irisGet(`/api/iris/investors/${pan}/portal-link`),
    enabled: false,
    retry: false,
  });

  const sendLink = useMutation({
    mutationFn: (via: "email" | "sms") => apiRequest(`/api/iris/investors/${pan}/portal-link/send`, "POST", { body: { via } }),
    onSuccess: (_d, via) => toast({ title: `Portal link sent via ${via}` }),
    onError: (e: Error) => toast({ title: "Failed to send", description: e.message, variant: "destructive" }),
  });

  async function fetchLink() {
    const r = await getLink.refetch();
    const d = r.data?.data;
    if (d) setLink(d.url ?? d.link ?? d.portalUrl ?? null);
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ExternalLink className="h-4 w-4" /> Investor Portal</CardTitle></CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={fetchLink} disabled={getLink.isFetching}>
            {getLink.isFetching ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : null}
            Get Portal Link
          </Button>
          <Button size="sm" variant="outline" onClick={() => sendLink.mutate("email")} disabled={sendLink.isPending}>
            <Send className="h-3 w-3 mr-1" /> Send via Email
          </Button>
          <Button size="sm" variant="outline" onClick={() => sendLink.mutate("sms")} disabled={sendLink.isPending}>
            <Send className="h-3 w-3 mr-1" /> Send via SMS
          </Button>
        </div>
        {link && (
          <a href={link} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-1 text-xs text-blue-500 hover:underline break-all">
            <ExternalLink className="h-3 w-3 flex-shrink-0" /> {link}
          </a>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Investors Tab ────────────────────────────────────────────────────────────
type InvestorDetailTab = "portfolio" | "holdings" | "transactions" | "sips" | "orders" | "folios" | "enrichment" | "goals" | "demat-docs" | "alerts" | "whatsapp" | "applications" | "risk-profile" | "kyc-details";

function InvestorsTab() {
  const [search, setSearch] = useState("");
  const [selectedPan, setSelectedPan] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<InvestorDetailTab>("portfolio");
  const [newSipOpen, setNewSipOpen] = useState(false);
  const [modifySipOpen, setModifySipOpen] = useState(false);
  const [modifySipTarget, setModifySipTarget] = useState<SipRecord | null>(null);
  const [orderStatusOpen, setOrderStatusOpen] = useState(false);
  const [orderStatusId, setOrderStatusId] = useState("");
  const [failedOnly, setFailedOnly] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [riskDialogOpen, setRiskDialogOpen] = useState(false);
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
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

  const { data: ekycData } = useQuery<IrisApiResponse<{ status?: string; ekycStatus?: string; completionStatus?: string }>>({
    queryKey: ["/api/iris/investors", selectedPan, "ekyc-status"],
    queryFn: () => irisGet(`/api/iris/investors/${selectedPan}/ekyc-status`),
    enabled: !!selectedPan,
    retry: false,
  });

  const { data: bankData } = useQuery<IrisApiResponse<any>>({
    queryKey: ["/api/iris/non-financial", selectedPan, "bank"],
    queryFn: () => irisGet(`/api/iris/non-financial/${selectedPan}/bank`),
    enabled: !!selectedPan && detailTab === "kyc-details",
    retry: false,
  });

  const { data: nomineeData } = useQuery<IrisApiResponse<any>>({
    queryKey: ["/api/iris/non-financial", selectedPan, "nominee"],
    queryFn: () => irisGet(`/api/iris/non-financial/${selectedPan}/nominee`),
    enabled: !!selectedPan && detailTab === "kyc-details",
    retry: false,
  });

  const { data: fatcaData } = useQuery<IrisApiResponse<any>>({
    queryKey: ["/api/iris/non-financial", selectedPan, "fatca"],
    queryFn: () => irisGet(`/api/iris/non-financial/${selectedPan}/fatca`),
    enabled: !!selectedPan && detailTab === "kyc-details",
    retry: false,
  });

  const { data: familyData } = useQuery<IrisApiResponse<any>>({
    queryKey: ["/api/iris/investors", selectedPan, "family-portfolio"],
    queryFn: () => irisGet(`/api/iris/investors/${selectedPan}/family-portfolio`),
    enabled: !!selectedPan && detailTab === "kyc-details",
    retry: false,
  });

  const { data: insightData } = useQuery<IrisApiResponse<any>>({
    queryKey: ["/api/iris/investors", selectedPan, "portfolio-insights"],
    queryFn: () => irisGet(`/api/iris/investors/${selectedPan}/portfolio-insights`),
    enabled: !!selectedPan && detailTab === "kyc-details",
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

  const { data: ordersData, isLoading: ordersL } = useQuery<IrisApiResponse<{ orders?: OrderRecord[] } | OrderRecord[]>>({
    queryKey: ["/api/iris/transactions/orders", selectedPan, failedOnly],
    queryFn: () => irisGet<IrisApiResponse<{ orders?: OrderRecord[] } | OrderRecord[]>>(
      failedOnly
        ? `/api/iris/transactions/failed?pan=${encodeURIComponent(selectedPan!)}`
        : `/api/iris/transactions/orders?pan=${encodeURIComponent(selectedPan!)}`
    ),
    enabled: !!selectedPan && detailTab === "orders",
    retry: false,
  });

  const { data: appsData, isLoading: appsL } = useQuery<IrisApiResponse<{ applications?: OrderApplication[] } | OrderApplication[]>>({
    queryKey: ["/api/iris/applications", selectedPan],
    queryFn: () => irisGet<IrisApiResponse<{ applications?: OrderApplication[] } | OrderApplication[]>>(`/api/iris/applications?pan=${selectedPan}`),
    enabled: !!selectedPan && detailTab === "applications",
    retry: false,
  });

  const { data: riskData, isLoading: riskL } = useQuery<IrisApiResponse<RiskProfile>>({
    queryKey: ["/api/iris/investors", selectedPan, "risk-profile"],
    queryFn: () => irisGet<IrisApiResponse<RiskProfile>>(`/api/iris/investors/${selectedPan}/risk-profile`),
    enabled: !!selectedPan && detailTab === "risk-profile",
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

  function resolveOrders(): OrderRecord[] {
    if (!ordersData?.data) return [];
    if (Array.isArray(ordersData.data)) return ordersData.data;
    if ('orders' in ordersData.data) return ordersData.data.orders ?? [];
    return [];
  }

  function resolveApps(): OrderApplication[] {
    if (!appsData?.data) return [];
    if (Array.isArray(appsData.data)) return appsData.data;
    if ('applications' in appsData.data) return appsData.data.applications ?? [];
    return [];
  }

  const investors = resolveInvestors();
  const holdings = resolveHoldings();
  const txns = resolveTxns();
  const sips = sipsData?.data?.sips ?? [];
  const orders = resolveOrders();
  const ekycStatus = ekycData?.data?.status ?? ekycData?.data?.ekycStatus ?? ekycData?.data?.completionStatus;
  const applications = resolveApps();
  const riskProfile = riskData?.data;

  const DETAIL_TABS: { key: InvestorDetailTab; label: string }[] = [
    { key: "portfolio", label: "Portfolio" },
    { key: "holdings", label: "Holdings" },
    { key: "transactions", label: "Transactions" },
    { key: "sips", label: "SIPs/STPs" },
    { key: "orders", label: "Orders" },
    { key: "folios", label: "Folios" },
    { key: "enrichment", label: "Enrichment" },
    { key: "goals", label: "Goals" },
    { key: "demat-docs", label: "Demat & Docs" },
    { key: "alerts", label: "Alerts" },
    { key: "whatsapp", label: "WhatsApp" },
    { key: "kyc-details", label: "KYC Details" },
    { key: "applications", label: "Applications" },
    { key: "risk-profile", label: "Risk Profile" },
  ];

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
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="font-semibold">{selectedPan}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {kycL ? <Skeleton className="h-5 w-24" /> : (
                    <Badge variant={kycData?.data?.kycStatus === 'KYC_VERIFIED' ? 'default' : 'secondary'}>
                      {kycData?.data?.kycStatus ?? 'KYC Unknown'}
                    </Badge>
                  )}
                  {ekycStatus && (
                    <Badge variant={ekycStatus === 'COMPLETED' ? 'default' : 'secondary'} className="flex items-center gap-1">
                      <Fingerprint className="h-3 w-3" /> eKYC: {ekycStatus}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => setManageOpen(true)}>
                  <Settings className="h-3 w-3 mr-1" /> Manage
                </Button>
                <Button size="sm" variant="outline" onClick={() => sendEkyc.mutate(selectedPan)} disabled={sendEkyc.isPending}>
                  Send eKYC Mail
                </Button>
              </div>
            </div>

            <div className="flex gap-1 flex-wrap">
              {DETAIL_TABS.map(t => (
                <Button key={t.key} size="sm" variant={detailTab === t.key ? "default" : "outline"}
                  onClick={() => setDetailTab(t.key)} className="text-xs h-7">
                  {t.label}
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
                              <Badge variant={statusVariant(t.status)} className="text-[10px] h-4">
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
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-sm">SIPs / STPs / SWPs</CardTitle>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setNewSipOpen(true)}>
                    <Activity className="h-3 w-3 mr-1" /> New SIP
                  </Button>
                </CardHeader>
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
                                    onClick={() => { setModifySipTarget(s); setModifySipOpen(true); }}>
                                    Modify
                                  </Button>
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

            {detailTab === "kyc-details" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* KRA & Identity Card */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <LucideShield className="h-4 w-4 text-primary" /> KRA & Identity
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center border-b pb-2">
                        <span className="text-xs text-muted-foreground">KYC Status</span>
                        <Badge variant={kycData?.data?.kycStatus === 'KYC_VERIFIED' ? 'default' : 'secondary'}>
                          {kycData?.data?.kycStatus ?? 'Unknown'}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center border-b pb-2">
                        <span className="text-xs text-muted-foreground">KRA Name</span>
                        <span className="text-xs font-medium">CVL KRA</span>
                      </div>
                      <div className="flex justify-between items-center border-b pb-2">
                        <span className="text-xs text-muted-foreground">IPV Status</span>
                        <Badge variant="outline" className="text-[10px]">VERIFIED (Biometric)</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Pan-Aadhaar Link</span>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Bank Verification Card */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-primary" /> Bank Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center border-b pb-2">
                        <span className="text-xs text-muted-foreground">Account Status</span>
                        <Badge variant={bankData?.data?.status === 'VALIDATED' ? 'default' : 'secondary'} className={bankData?.data?.status === 'VALIDATED' ? "bg-green-500 text-white" : ""}>
                          {bankData?.data?.status ?? 'PENDING'}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center border-b pb-2">
                        <span className="text-xs text-muted-foreground">Penny Drop</span>
                        <span className={`text-xs font-medium ${bankData?.data?.pennyDropStatus === 'SUCCESS' ? 'text-green-600' : 'text-muted-foreground'}`}>
                          {bankData?.data?.pennyDropStatus === 'SUCCESS' ? 'Success (₹1.00)' : 'Not Initiated'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center border-b pb-2">
                        <span className="text-xs text-muted-foreground">Bank Name</span>
                        <span className="text-xs font-medium truncate max-w-[120px]">{bankData?.data?.bankName ?? 'HDFC BANK LTD'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">IFSC</span>
                        <span className="text-xs font-mono">{bankData?.data?.ifsc ?? 'HDFC0001234'}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Compliance Card */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" /> Compliance & FATCA
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center border-b pb-2">
                        <span className="text-xs text-muted-foreground">FATCA Status</span>
                        <Badge variant={fatcaData?.data?.status === 'REGISTERED' ? 'default' : 'secondary'}>
                          {fatcaData?.data?.status ?? 'PENDING'}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center border-b pb-2">
                        <span className="text-xs text-muted-foreground">Nominee</span>
                        <Badge variant={nomineeData?.data?.nominees?.length > 0 ? 'default' : 'secondary'}>
                          {nomineeData?.data?.nominees?.length > 0 ? 'OPTED-IN' : 'PENDING'}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">UBO Declaration</span>
                        <span className="text-xs font-medium">{fatcaData?.data?.uboStatus ?? 'NOT APPLICABLE'}</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Family & Insights Card */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" /> Family & Insights
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center border-b pb-2">
                        <span className="text-xs text-muted-foreground">Family Members</span>
                        <span className="text-xs font-medium">{familyData?.data?.memberCount ?? 0}</span>
                      </div>
                      <div className="flex justify-between items-center border-b pb-2">
                        <span className="text-xs text-muted-foreground">Family AUM</span>
                        <span className="text-xs font-medium">{fmt(familyData?.data?.totalAum)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Risk Score</span>
                        <span className="text-xs font-medium">{insightData?.data?.riskScore ?? 'Moderate'}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Digital Onboarding Card */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Activity className="h-4 w-4 text-primary" /> Onboarding Journey
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center border-b pb-2">
                        <span className="text-xs text-muted-foreground">eKYC Status</span>
                        <Badge variant={ekycStatus === 'COMPLETED' ? 'default' : 'secondary'}>{ekycStatus ?? 'PENDING'}</Badge>
                      </div>
                      <div className="flex justify-between items-center border-b pb-2">
                        <span className="text-xs text-muted-foreground">Last Action</span>
                        <span className="text-xs font-medium">OTP Verified</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Channel</span>
                        <span className="text-xs font-medium">IRIS-DIRECT</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button size="sm" variant="outline">
                    <Download className="h-3 w-3 mr-1" /> Download KYC Form
                  </Button>
                  <Button size="sm" onClick={() => sendEkyc.mutate(selectedPan)}>
                    Trigger Re-Verification
                  </Button>
                </div>
              </div>
            )}

            {detailTab === "orders" && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-sm">Order Ledger</CardTitle>
                  <Button size="sm" variant={failedOnly ? "destructive" : "outline"} className="h-7 text-xs"
                    onClick={() => setFailedOnly(f => !f)}>
                    {failedOnly ? "Showing: Failed" : "Show Failed Only"}
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  {ordersL ? (
                    <div className="p-4 space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
                  ) : (
                    <ScrollArea className="h-[320px]">
                      <div className="divide-y">
                        {orders.map((o, i) => (
                          <div key={i} className="p-3">
                            <div className="flex justify-between items-start">
                              <p className="text-sm font-medium truncate max-w-[55%]">{o.schemeName ?? o.scheme ?? "—"}</p>
                              <div className="flex items-center gap-1.5">
                                <Badge variant={o.status === 'SUCCESS' ? 'default' : o.status === 'PENDING' ? 'secondary' : 'destructive'} className="text-[10px] h-4">
                                  {o.status ?? "—"}
                                </Badge>
                                <Button size="sm" variant="outline" className="h-6 text-[11px] px-2"
                                  onClick={() => { setOrderStatusId(o.orderId ?? o.id ?? ""); setOrderStatusOpen(true); }}>
                                  View
                                </Button>
                              </div>
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                              <span>{o.orderType ?? o.type ?? o.transactionType ?? "Order"} · {o.orderDate ?? o.date ?? "—"}</span>
                              <span className="font-medium text-foreground">{o.amount != null ? fmt(o.amount) : "—"}</span>
                            </div>
                          </div>
                        ))}
                        {!orders.length && <p className="p-4 text-sm text-muted-foreground">{failedOnly ? "No failed transactions found" : "No orders found"}</p>}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            )}

            {detailTab === "folios" && <FolioBrowser pan={selectedPan} />}

            {detailTab === "enrichment" && (
              <div className="space-y-3">
                <PortalLinkButton pan={selectedPan} />
                <DividendHistory pan={selectedPan} />
              </div>
            )}

            {detailTab === "goals" && <GoalsPanel pan={selectedPan} />}

            {detailTab === "demat-docs" && <DematDocsPanel pan={selectedPan} />}

            {detailTab === "alerts" && <InvestorAlertsPanel pan={selectedPan!} />}
            {detailTab === "whatsapp" && <WhatsAppPanel pan={selectedPan!} />}

            {detailTab === "applications" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Order Applications</CardTitle>
                  <CardDescription>All order applications for {selectedPan}</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {appsL ? (
                    <div className="p-4 space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
                  ) : (
                    <ScrollArea className="h-[340px]">
                      <div className="divide-y">
                        {applications.map((app, i) => {
                          const appId = app.applicationId ?? app.id ?? "";
                          const orderId = app.orderId ?? appId;
                          return (
                            <div key={i} className="p-3">
                              <div className="flex justify-between items-start">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{app.schemeName ?? app.scheme ?? "—"}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {app.type ?? app.transactionType} · {fmt(app.amount)} · {appId}
                                  </p>
                                </div>
                                <Badge variant={statusVariant(app.status)} className="text-[10px] ml-2 flex-shrink-0">{app.status}</Badge>
                              </div>
                              <div className="flex gap-1.5 mt-2">
                                <Button size="sm" variant="outline" className="h-6 text-[11px] px-2"
                                  onClick={() => setTrackingOrderId(orderId)}>
                                  Track
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                        {!applications.length && <p className="p-4 text-sm text-muted-foreground">No order applications found</p>}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            )}

            {detailTab === "risk-profile" && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">Risk Profile</CardTitle>
                    <CardDescription>Investor's assessed risk category</CardDescription>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setRiskDialogOpen(true)}>
                    <Brain className="h-3.5 w-3.5 mr-1" /> Re-assess
                  </Button>
                </CardHeader>
                <CardContent>
                  {riskL ? <Skeleton className="h-24 w-full" /> : riskProfile?.riskProfile || riskProfile?.riskCategory ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                          <Brain className="h-7 w-7 text-primary" />
                        </div>
                        <div>
                          <p className="text-xl font-bold">{riskProfile.riskProfile ?? riskProfile.riskCategory}</p>
                          {riskProfile.score != null && <p className="text-sm text-muted-foreground">Score: {riskProfile.score}</p>}
                          {riskProfile.assessedAt && <p className="text-xs text-muted-foreground">Assessed: {riskProfile.assessedAt}</p>}
                        </div>
                      </div>
                      {riskProfile.recommendedCategories && riskProfile.recommendedCategories.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Recommended scheme categories</p>
                          <div className="flex flex-wrap gap-1.5">
                            {riskProfile.recommendedCategories.map((cat, i) => (
                              <Badge key={i} variant="outline" className="text-xs">{cat}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-6 space-y-3">
                      <Brain className="h-10 w-10 text-muted-foreground mx-auto" />
                      <p className="text-sm text-muted-foreground">No risk profile assessed yet</p>
                      <Button size="sm" onClick={() => setRiskDialogOpen(true)}>Launch Assessment</Button>
                    </div>
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

      <NewSipDialog open={newSipOpen} onClose={() => setNewSipOpen(false)} prefillPan={selectedPan ?? ""} />
      <ModifySipDialog open={modifySipOpen} onClose={() => setModifySipOpen(false)} sip={modifySipTarget} pan={selectedPan ?? ""} />
      <OrderStatusDialog open={orderStatusOpen} onClose={() => setOrderStatusOpen(false)} orderId={orderStatusId} />
      {manageOpen && selectedPan && (
        <ManageInvestorPanel pan={selectedPan} onClose={() => setManageOpen(false)} />
      )}
      {selectedPan && (
        <RiskProfileDialog pan={selectedPan} open={riskDialogOpen} onClose={() => setRiskDialogOpen(false)} />
      )}
      {trackingOrderId && (
        <OrderTrackingDialog orderId={trackingOrderId} open={!!trackingOrderId} onClose={() => setTrackingOrderId(null)} />
      )}
    </div>
  );
}

// ─── Onboarding Tab ───────────────────────────────────────────────────────────
type OnboardingStep = "personal" | "address";

function OnboardingTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [step, setStep] = useState<OnboardingStep>("personal");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [form, setForm] = useState({
    name: "", pan: "", dob: "", mobile: "", email: "",
    addressLine1: "", addressLine2: "", city: "", state: "", pincode: ""
  });

  const { data: appsData, isLoading: appsL } = useQuery<IrisApiResponse<{ applications?: OnboardingApplication[] } | OnboardingApplication[]>>({
    queryKey: ["/api/iris/onboarding/applications", statusFilter],
    queryFn: () => irisGet(`/api/iris/onboarding/applications${statusFilter !== "ALL" ? `?status=${statusFilter}` : ""}`),
    retry: false,
  });

  const initiateMutation = useMutation({
    mutationFn: () => apiRequest("/api/iris/onboarding/initiate", "POST", { body: {
      name: form.name, pan: form.pan, dob: form.dob, mobile: form.mobile, email: form.email,
      address: { line1: form.addressLine1, line2: form.addressLine2, city: form.city, state: form.state, pincode: form.pincode }
    }}),
    onSuccess: () => {
      toast({ title: "Onboarding initiated", description: "Application link sent to the investor" });
      qc.invalidateQueries({ queryKey: ["/api/iris/onboarding/applications"] });
      setDialogOpen(false);
      setStep("personal");
      setForm({ name: "", pan: "", dob: "", mobile: "", email: "", addressLine1: "", addressLine2: "", city: "", state: "", pincode: "" });
    },
    onError: (e: Error) => toast({ title: "Failed to initiate onboarding", description: e.message, variant: "destructive" }),
  });

  const resendMutation = useMutation({
    mutationFn: (applicationId: string) => apiRequest(`/api/iris/onboarding/${applicationId}/resend-link`, "POST"),
    onSuccess: () => toast({ title: "Onboarding link resent" }),
    onError: (e: Error) => toast({ title: "Failed to resend link", description: e.message, variant: "destructive" }),
  });

  function resolveApps(): OnboardingApplication[] {
    if (!appsData?.data) return [];
    if (Array.isArray(appsData.data)) return appsData.data;
    if ('applications' in appsData.data) return appsData.data.applications ?? [];
    return [];
  }

  const apps = resolveApps();

  const STATUS_OPTIONS = ["ALL", "IN_PROGRESS", "KYC_PENDING", "COMPLETED", "REJECTED"];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" /> New Investor
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Onboarding Applications</CardTitle>
          <CardDescription>Digital investor onboarding — track status and resend links</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {appsL ? (
            <div className="p-4 space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : apps.length > 0 ? (
            <ScrollArea className="h-[420px]">
              <div className="divide-y">
                {apps.map((app, i) => {
                  const appId = app.applicationId ?? app.id ?? "";
                  return (
                    <div key={i} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0">
                          <p className="font-medium text-sm">{app.name ?? app.investorName ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{app.pan} · {app.mobile} · {app.email}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">ID: {appId}</p>
                        </div>
                        <Badge variant={statusVariant(app.status)} className="ml-2 flex-shrink-0">{app.status ?? "—"}</Badge>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => resendMutation.mutate(appId)}
                          disabled={resendMutation.isPending || app.status === "COMPLETED"}>
                          Resend Link
                        </Button>
                        {app.applicationLink && (
                          <a href={app.applicationLink} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="ghost" className="h-7 text-xs">
                              <ExternalLink className="h-3 w-3 mr-1" /> Open Link
                            </Button>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <UserPlus className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              No onboarding applications found
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Investor Multi-step Dialog */}
      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) { setDialogOpen(false); setStep("personal"); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Investor Onboarding</DialogTitle>
            <DialogDescription>
              {step === "personal" ? "Step 1 of 2 — Personal Details" : "Step 2 of 2 — Address Details"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {step === "personal" ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label>Full Name *</Label>
                    <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Investor full name" />
                  </div>
                  <div>
                    <Label>PAN *</Label>
                    <Input value={form.pan} onChange={e => setForm(f => ({ ...f, pan: e.target.value.toUpperCase() }))} placeholder="ABCDE1234F" maxLength={10} />
                  </div>
                  <div>
                    <Label>Date of Birth *</Label>
                    <Input type="date" value={form.dob} onChange={e => setForm(f => ({ ...f, dob: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Mobile *</Label>
                    <Input value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} placeholder="+91XXXXXXXXXX" />
                  </div>
                  <div>
                    <Label>Email *</Label>
                    <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="investor@email.com" />
                  </div>
                </div>
                <Button className="w-full" onClick={() => setStep("address")}
                  disabled={!form.name || !form.pan || !form.dob || !form.mobile || !form.email}>
                  Next: Address →
                </Button>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label>Address Line 1 *</Label>
                    <Input value={form.addressLine1} onChange={e => setForm(f => ({ ...f, addressLine1: e.target.value }))} placeholder="House/Flat No., Street" />
                  </div>
                  <div className="col-span-2">
                    <Label>Address Line 2</Label>
                    <Input value={form.addressLine2} onChange={e => setForm(f => ({ ...f, addressLine2: e.target.value }))} placeholder="Locality, Area" />
                  </div>
                  <div>
                    <Label>City *</Label>
                    <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Mumbai" />
                  </div>
                  <div>
                    <Label>State *</Label>
                    <Input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} placeholder="Maharashtra" />
                  </div>
                  <div>
                    <Label>Pincode *</Label>
                    <Input value={form.pincode} onChange={e => setForm(f => ({ ...f, pincode: e.target.value }))} placeholder="400001" maxLength={6} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep("personal")}>← Back</Button>
                  <Button className="flex-1" onClick={() => initiateMutation.mutate()}
                    disabled={initiateMutation.isPending || !form.addressLine1 || !form.city || !form.state || !form.pincode}>
                    {initiateMutation.isPending ? <><RefreshCw className="h-4 w-4 mr-1 animate-spin" />Initiating…</> : "Initiate Onboarding"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── NFO Tab ──────────────────────────────────────────────────────────────────
function NfoTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [subscribeScheme, setSubscribeScheme] = useState<NfoScheme | null>(null);
  const [subPan, setSubPan] = useState("");
  const [subAmount, setSubAmount] = useState("");
  const [subPaymentMode, setSubPaymentMode] = useState("NETBANKING");
  const [appsPan, setAppsPan] = useState("");
  const [appsSubmittedPan, setAppsSubmittedPan] = useState("");

  const { data: nfoData, isLoading: nfoL } = useQuery<IrisApiResponse<{ schemes?: NfoScheme[] } | NfoScheme[]>>({
    queryKey: ["/api/iris/nfo/active"],
    retry: false,
  });

  const { data: nfoAppsData, isLoading: nfoAppsL } = useQuery<IrisApiResponse<{ applications?: NfoApplication[] } | NfoApplication[]>>({
    queryKey: ["/api/iris/nfo/applications", appsSubmittedPan],
    queryFn: () => irisGet(`/api/iris/nfo/applications${appsSubmittedPan ? `?pan=${appsSubmittedPan}` : ""}`),
    enabled: !!appsSubmittedPan,
    retry: false,
  });

  const applyMutation = useMutation({
    mutationFn: () => apiRequest("/api/iris/nfo/apply", "POST", { body: {
      pan: subPan,
      schemeCode: subscribeScheme?.schemeCode ?? subscribeScheme?.code,
      schemeName: subscribeScheme?.schemeName ?? subscribeScheme?.name,
      amount: Number(subAmount),
      paymentMode: subPaymentMode,
    }}),
    onSuccess: () => {
      toast({ title: "NFO subscription placed" });
      qc.invalidateQueries({ queryKey: ["/api/iris/nfo/applications"] });
      setSubscribeScheme(null);
      setSubPan(""); setSubAmount(""); setSubPaymentMode("NETBANKING");
    },
    onError: (e: Error) => toast({ title: "NFO subscription failed", description: e.message, variant: "destructive" }),
  });

  const cancelNfoMutation = useMutation({
    mutationFn: (applicationId: string) => apiRequest(`/api/iris/nfo/applications/${applicationId}/cancel`, "POST"),
    onSuccess: () => {
      toast({ title: "NFO application cancelled" });
      qc.invalidateQueries({ queryKey: ["/api/iris/nfo/applications"] });
    },
    onError: (e: Error) => toast({ title: "Cancel failed", description: e.message, variant: "destructive" }),
  });

  function resolveSchemes(): NfoScheme[] {
    if (!nfoData?.data) return [];
    if (Array.isArray(nfoData.data)) return nfoData.data;
    return nfoData.data.schemes ?? [];
  }

  function resolveApps(): NfoApplication[] {
    if (!nfoAppsData?.data) return [];
    if (Array.isArray(nfoAppsData.data)) return nfoAppsData.data;
    if ('applications' in nfoAppsData.data) return nfoAppsData.data.applications ?? [];
    return [];
  }

  const nfoSchemes = resolveSchemes();
  const nfoApplications = resolveApps();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active NFOs</CardTitle>
          <CardDescription>New Fund Offers currently open for subscription</CardDescription>
        </CardHeader>
        <CardContent>
          {nfoL ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full" />)}
            </div>
          ) : nfoSchemes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {nfoSchemes.map((s, i) => (
                <Card key={i} className="border bg-card">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="min-w-0 mr-2">
                        <p className="font-medium text-sm leading-snug">{s.schemeName ?? s.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.amcName ?? s.amc}</p>
                      </div>
                      {s.category && <Badge variant="outline" className="text-[10px] flex-shrink-0">{s.category}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5 mb-3">
                      {s.openDate && <p>Opens: {s.openDate}</p>}
                      {s.closeDate && <p>Closes: {s.closeDate}</p>}
                      {(s.minAmount ?? s.minimumAmount) && <p>Min: {fmt(s.minAmount ?? s.minimumAmount)}</p>}
                    </div>
                    <Button size="sm" className="w-full" onClick={() => setSubscribeScheme(s)}>
                      Subscribe
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <Layers className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              No active NFOs at this time
            </div>
          )}
        </CardContent>
      </Card>

      {/* NFO Applications section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">NFO Applications</CardTitle>
          <CardDescription>View and manage NFO subscriptions by investor PAN</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input placeholder="Investor PAN" value={appsPan} onChange={e => setAppsPan(e.target.value.toUpperCase())} className="max-w-xs" />
            <Button onClick={() => setAppsSubmittedPan(appsPan)} disabled={appsPan.length < 10}>
              <Search className="h-4 w-4 mr-1" /> View
            </Button>
          </div>
          {nfoAppsL ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : nfoApplications.length > 0 ? (
            <div className="divide-y border rounded-md">
              {nfoApplications.map((app, i) => {
                const appId = app.applicationId ?? app.id ?? "";
                return (
                  <div key={i} className="p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium">{app.schemeName ?? app.scheme ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{app.paymentMode} · {fmt(app.amount)} · {appId}</p>
                      </div>
                      <Badge variant={statusVariant(app.status)} className="ml-2 flex-shrink-0 text-[10px]">{app.status}</Badge>
                    </div>
                    {app.status === "PENDING" && (
                      <Button size="sm" variant="outline" className="mt-2 h-7 text-xs text-destructive hover:text-destructive"
                        onClick={() => cancelNfoMutation.mutate(appId)}
                        disabled={cancelNfoMutation.isPending}>
                        Cancel
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : appsSubmittedPan ? (
            <p className="text-sm text-muted-foreground">No NFO applications found for {appsSubmittedPan}</p>
          ) : null}
        </CardContent>
      </Card>

      {/* Subscribe Dialog */}
      <Dialog open={!!subscribeScheme} onOpenChange={v => { if (!v) setSubscribeScheme(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Subscribe to NFO</DialogTitle>
            <DialogDescription>{subscribeScheme?.schemeName ?? subscribeScheme?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Investor PAN *</Label>
              <Input value={subPan} onChange={e => setSubPan(e.target.value.toUpperCase())} placeholder="ABCDE1234F" maxLength={10} />
            </div>
            <div>
              <Label>Amount (₹) *</Label>
              <Input type="number" value={subAmount} onChange={e => setSubAmount(e.target.value)} placeholder={String(subscribeScheme?.minAmount ?? subscribeScheme?.minimumAmount ?? 5000)} min={1} />
              {(subscribeScheme?.minAmount ?? subscribeScheme?.minimumAmount) && (
                <p className="text-xs text-muted-foreground mt-1">Min: {fmt(subscribeScheme?.minAmount ?? subscribeScheme?.minimumAmount)}</p>
              )}
            </div>
            <div>
              <Label>Payment Mode</Label>
              <Select value={subPaymentMode} onValueChange={setSubPaymentMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NETBANKING">Net Banking</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="MANDATE">eMandate</SelectItem>
                  <SelectItem value="CHEQUE">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={() => applyMutation.mutate()}
              disabled={applyMutation.isPending || !subPan || !subAmount || Number(subAmount) <= 0}>
              {applyMutation.isPending ? <><RefreshCw className="h-4 w-4 mr-1 animate-spin" />Placing…</> : "Place NFO Subscription"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Shared: Scheme Search Field ──────────────────────────────────────────────
function SchemeSearchField({
  label,
  selected,
  query,
  onQueryChange,
  onSelect,
  onClear,
}: {
  label: string;
  selected: SchemeResult | null;
  query: string;
  onQueryChange: (q: string) => void;
  onSelect: (s: SchemeResult) => void;
  onClear: () => void;
}) {
  const { data: schemeSearchData, isLoading } = useQuery<IrisApiResponse<{ schemes?: SchemeResult[] } | SchemeResult[]>>({
    queryKey: ["/api/iris/transactions/scheme-search", query],
    queryFn: () =>
      irisGet<IrisApiResponse<{ schemes?: SchemeResult[] } | SchemeResult[]>>(`/api/iris/transactions/scheme-search?q=${encodeURIComponent(query)}`),
    enabled: query.length >= 2 && !selected,
    retry: false,
  });

  const schemes: SchemeResult[] = (() => {
    if (!schemeSearchData?.data) return [];
    if (Array.isArray(schemeSearchData.data)) return schemeSearchData.data;
    return schemeSearchData.data.schemes ?? [];
  })();

  return (
    <div>
      <Label>{label}</Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          value={selected ? (selected.schemeName ?? selected.name ?? "") : query}
          onChange={e => { onQueryChange(e.target.value); if (selected) onClear(); }}
          placeholder="Type scheme name (min 2 chars)…"
        />
      </div>
      {query.length >= 2 && !selected && (
        <div className="border rounded-md mt-1 max-h-40 overflow-y-auto bg-background shadow-md z-10">
          {isLoading ? (
            <p className="p-2 text-xs text-muted-foreground">Searching…</p>
          ) : schemes.length > 0 ? (
            schemes.slice(0, 10).map((s, i) => (
              <button key={i} className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex justify-between items-center"
                onClick={() => { onSelect(s); }}>
                <span>{s.schemeName ?? s.name}</span>
                {(s.schemeCode ?? s.code) && <span className="text-xs text-muted-foreground ml-2">{s.schemeCode ?? s.code}</span>}
              </button>
            ))
          ) : (
            <p className="p-2 text-xs text-muted-foreground">No schemes found</p>
          )}
        </div>
      )}
      {selected && (
        <div className="mt-1 flex items-center gap-2">
          <Badge variant="outline" className="text-xs">{selected.schemeCode ?? selected.isinCode ?? selected.code}</Badge>
          <button className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-0.5" onClick={onClear}>
            <XCircle className="h-3 w-3" /> Clear
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Status Badge helper ───────────────────────────────────────────────────────
function StatusBadge({ status }: { status?: string }) {
  const s = status?.toUpperCase() ?? "";
  const variant =
    s === "ACTIVE" ? "default" :
    s === "PAUSED" ? "secondary" :
    s === "COMPLETED" ? "outline" :
    s === "CANCELLED" || s === "CANCELED" ? "destructive" :
    "secondary";
  const color =
    s === "ACTIVE" ? "bg-green-500 text-white" :
    s === "PAUSED" ? "bg-yellow-500 text-white" :
    s === "COMPLETED" ? "bg-blue-500 text-white" :
    s === "CANCELLED" || s === "CANCELED" ? "bg-red-500 text-white" :
    "";
  return (
    <Badge variant={variant} className={`text-[10px] h-5 ${color}`}>
      {status ?? "—"}
    </Badge>
  );
}

// ─── Transact Tab ─────────────────────────────────────────────────────────────
type TransactType = "lumpsum" | "sip" | "redemption";
type TransactSubTab = "orders" | "switch" | "stp" | "swp";

// ── Orders sub-panel (existing lumpsum/SIP/redemption) ───────────────────────
function OrdersPanel() {
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
    setSelectedScheme(null);
    setSchemeQuery("");
    setAmount("");
    setPan("");
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

            <SchemeSearchField
              label="Search Scheme *"
              selected={selectedScheme}
              query={schemeQuery}
              onQueryChange={setSchemeQuery}
              onSelect={s => { setSelectedScheme(s); setSchemeQuery(""); }}
              onClear={() => { setSelectedScheme(null); setSchemeQuery(""); }}
            />

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

// ── Switch sub-panel ──────────────────────────────────────────────────────────
interface SwitchOrder {
  orderId?: string;
  id?: string;
  pan?: string;
  sourceSchemeName?: string;
  targetSchemeName?: string;
  amount?: number;
  allUnits?: boolean;
  status?: string;
  transactionDate?: string;
  date?: string;
}

function SwitchPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // Form state
  const [pan, setPan] = useState("");
  const [srcQuery, setSrcQuery] = useState("");
  const [srcScheme, setSrcScheme] = useState<SchemeResult | null>(null);
  const [tgtQuery, setTgtQuery] = useState("");
  const [tgtScheme, setTgtScheme] = useState<SchemeResult | null>(null);
  const [amount, setAmount] = useState("");
  const [switchAll, setSwitchAll] = useState(false);

  // History lookup state
  const [historyPan, setHistoryPan] = useState("");
  const [submittedHistoryPan, setSubmittedHistoryPan] = useState("");

  const { data: historyData, isLoading: historyL } = useQuery<IrisApiResponse<{ transactions?: SwitchOrder[] } | SwitchOrder[]>>({
    queryKey: ["/api/iris/investors", submittedHistoryPan, "transactions", "SWITCH"],
    queryFn: () =>
      irisGet<IrisApiResponse<{ transactions?: SwitchOrder[] } | SwitchOrder[]>>(
        `/api/iris/investors/${submittedHistoryPan}/transactions?type=SWITCH`
      ),
    enabled: !!submittedHistoryPan,
    retry: false,
  });

  const switchMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiRequest("/api/iris/transactions/switch", "POST", { body }),
    onSuccess: () => {
      toast({ title: "Switch order submitted successfully" });
      setPan(""); setSrcScheme(null); setSrcQuery(""); setTgtScheme(null); setTgtQuery(""); setAmount(""); setSwitchAll(false);
      if (submittedHistoryPan) qc.invalidateQueries({ queryKey: ["/api/iris/investors", submittedHistoryPan, "transactions", "SWITCH"] });
    },
    onError: (err: Error) => toast({ title: "Switch failed", description: err.message, variant: "destructive" }),
  });

  function handleSubmit() {
    if (!pan.trim()) { toast({ title: "PAN is required", variant: "destructive" }); return; }
    if (!srcScheme) { toast({ title: "Please select the source scheme", variant: "destructive" }); return; }
    if (!tgtScheme) { toast({ title: "Please select the target scheme", variant: "destructive" }); return; }
    if (!switchAll && (!amount || Number(amount) <= 0)) { toast({ title: "Enter a valid amount or select Switch All", variant: "destructive" }); return; }

    switchMutation.mutate({
      pan,
      fromSchemeCode: srcScheme.schemeCode ?? srcScheme.isinCode ?? srcScheme.code,
      toSchemeCode: tgtScheme.schemeCode ?? tgtScheme.isinCode ?? tgtScheme.code,
      amount: switchAll ? undefined : Number(amount),
      allUnits: switchAll,
    });
  }

  function resolveSwitchOrders(): SwitchOrder[] {
    if (!historyData?.data) return [];
    if (Array.isArray(historyData.data)) return historyData.data;
    return historyData.data.transactions ?? [];
  }

  const orders = resolveSwitchOrders();

  return (
    <div className="space-y-6">
      {/* Switch Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ArrowLeftRight className="h-5 w-5 text-indigo-500" />Execute Switch</CardTitle>
          <CardDescription>Same-AMC scheme-to-scheme switch (same-day at applicable NAV)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Investor PAN *</Label>
            <Input value={pan} onChange={e => setPan(e.target.value.toUpperCase())} placeholder="ABCDE1234F" maxLength={10} className="max-w-xs" />
          </div>

          <SchemeSearchField
            label="Source Scheme (switch out) *"
            selected={srcScheme}
            query={srcQuery}
            onQueryChange={setSrcQuery}
            onSelect={s => { setSrcScheme(s); setSrcQuery(""); }}
            onClear={() => { setSrcScheme(null); setSrcQuery(""); }}
          />

          <SchemeSearchField
            label="Target Scheme (switch in) *"
            selected={tgtScheme}
            query={tgtQuery}
            onQueryChange={setTgtQuery}
            onSelect={s => { setTgtScheme(s); setTgtQuery(""); }}
            onClear={() => { setTgtScheme(null); setTgtQuery(""); }}
          />

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox id="switch-all" checked={switchAll} onCheckedChange={v => setSwitchAll(!!v)} />
              <label htmlFor="switch-all" className="text-sm cursor-pointer select-none">Switch All Units</label>
            </div>
            {!switchAll && (
              <div>
                <Label>Amount (₹) *</Label>
                <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="5000" min={1} className="max-w-xs" />
              </div>
            )}
          </div>

          <Button onClick={handleSubmit} disabled={switchMutation.isPending}>
            {switchMutation.isPending ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Submitting…</> : <><ArrowLeftRight className="h-4 w-4 mr-2" />Submit Switch</>}
          </Button>
        </CardContent>
      </Card>

      {/* Switch History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Switch Order History</CardTitle>
          <CardDescription>View past switch orders for an investor</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Investor PAN"
              value={historyPan}
              onChange={e => setHistoryPan(e.target.value.toUpperCase())}
              className="max-w-xs"
              maxLength={10}
            />
            <Button variant="outline" onClick={() => setSubmittedHistoryPan(historyPan.trim())} disabled={historyPan.length < 10}>
              <Search className="h-4 w-4 mr-1" /> Load History
            </Button>
          </div>
          {historyL && <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>}
          {!historyL && orders.length > 0 && (
            <ScrollArea className="h-64 border rounded-md">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background border-b">
                  <tr>
                    <th className="text-left p-2 font-medium">Date</th>
                    <th className="text-left p-2 font-medium">From Scheme</th>
                    <th className="text-left p-2 font-medium">To Scheme</th>
                    <th className="text-right p-2 font-medium">Amount</th>
                    <th className="text-center p-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o, i) => (
                    <tr key={i} className="border-b hover:bg-muted/50">
                      <td className="p-2 text-xs">{o.transactionDate ?? o.date ?? "—"}</td>
                      <td className="p-2 text-xs">{o.sourceSchemeName ?? "—"}</td>
                      <td className="p-2 text-xs">{o.targetSchemeName ?? "—"}</td>
                      <td className="p-2 text-right">{o.allUnits ? "All Units" : fmt(o.amount)}</td>
                      <td className="p-2 text-center"><StatusBadge status={o.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          )}
          {submittedHistoryPan && !historyL && orders.length === 0 && (
            <p className="text-sm text-muted-foreground">No switch orders found for {submittedHistoryPan}.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── STP sub-panel ─────────────────────────────────────────────────────────────
interface StpRecord {
  stpId?: string;
  id?: string;
  sourceSchemeName?: string;
  targetSchemeName?: string;
  amount?: number;
  frequency?: string;
  status?: string;
  nextInstallmentDate?: string;
  nextDate?: string;
  remainingInstallments?: number;
  remainingCount?: number;
  sourceSchemeCode?: string;
}

function StpPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // Form state
  const [pan, setPan] = useState("");
  const [srcQuery, setSrcQuery] = useState("");
  const [srcScheme, setSrcScheme] = useState<SchemeResult | null>(null);
  const [tgtQuery, setTgtQuery] = useState("");
  const [tgtScheme, setTgtScheme] = useState<SchemeResult | null>(null);
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState("MONTHLY");
  const [installments, setInstallments] = useState("");
  const [startDate, setStartDate] = useState("");

  // List state
  const [listPan, setListPan] = useState("");
  const [submittedListPan, setSubmittedListPan] = useState("");

  const { data: stpData, isLoading: stpL } = useQuery<IrisApiResponse<{ stps?: StpRecord[]; systematicPlans?: StpRecord[] } | StpRecord[]>>({
    queryKey: ["/api/iris/investors", submittedListPan, "systematic-plans", "STP"],
    queryFn: () =>
      irisGet<IrisApiResponse<{ stps?: StpRecord[]; systematicPlans?: StpRecord[] } | StpRecord[]>>(
        `/api/iris/investors/${submittedListPan}/systematic-plans?type=STP`
      ),
    enabled: !!submittedListPan,
    retry: false,
  });

  const registerMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiRequest("/api/iris/transactions/stp/register", "POST", { body }),
    onSuccess: () => {
      toast({ title: "STP registered successfully" });
      setPan(""); setSrcScheme(null); setSrcQuery(""); setTgtScheme(null); setTgtQuery(""); setAmount(""); setInstallments(""); setStartDate("");
      if (submittedListPan) qc.invalidateQueries({ queryKey: ["/api/iris/investors", submittedListPan, "systematic-plans", "STP"] });
    },
    onError: (err: Error) => toast({ title: "STP registration failed", description: err.message, variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiRequest("/api/iris/transactions/stp/cancel", "POST", { body }),
    onSuccess: () => {
      toast({ title: "STP cancellation submitted" });
      qc.invalidateQueries({ queryKey: ["/api/iris/investors", submittedListPan, "systematic-plans", "STP"] });
    },
    onError: (err: Error) => toast({ title: "Cancel failed", description: err.message, variant: "destructive" }),
  });

  const pauseMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiRequest("/api/iris/transactions/stp/pause", "POST", { body }),
    onSuccess: () => {
      toast({ title: "STP paused" });
      qc.invalidateQueries({ queryKey: ["/api/iris/investors", submittedListPan, "systematic-plans", "STP"] });
    },
    onError: (err: Error) => toast({ title: "Pause failed", description: err.message, variant: "destructive" }),
  });

  function handleRegister() {
    if (!pan.trim()) { toast({ title: "PAN is required", variant: "destructive" }); return; }
    if (!srcScheme) { toast({ title: "Select the source scheme", variant: "destructive" }); return; }
    if (!tgtScheme) { toast({ title: "Select the target scheme", variant: "destructive" }); return; }
    if (!amount || Number(amount) <= 0) { toast({ title: "Enter a valid installment amount", variant: "destructive" }); return; }
    if (!installments || Number(installments) < 1) { toast({ title: "Enter the number of installments", variant: "destructive" }); return; }

    registerMutation.mutate({
      pan,
      fromSchemeCode: srcScheme.schemeCode ?? srcScheme.isinCode ?? srcScheme.code,
      toSchemeCode: tgtScheme.schemeCode ?? tgtScheme.isinCode ?? tgtScheme.code,
      amount: Number(amount),
      frequency,
      noOfInstallments: Number(installments),
      startDate: startDate || undefined,
    });
  }

  function resolveStps(): StpRecord[] {
    if (!stpData?.data) return [];
    if (Array.isArray(stpData.data)) return stpData.data;
    return stpData.data.stps ?? stpData.data.systematicPlans ?? [];
  }

  const stps = resolveStps();

  return (
    <div className="space-y-6">
      {/* STP Registration Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Repeat className="h-5 w-5 text-emerald-500" />Register STP</CardTitle>
          <CardDescription>Systematic Transfer Plan — periodically transfer from one scheme to another</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Investor PAN *</Label>
            <Input value={pan} onChange={e => setPan(e.target.value.toUpperCase())} placeholder="ABCDE1234F" maxLength={10} className="max-w-xs" />
          </div>

          <SchemeSearchField
            label="Source Scheme *"
            selected={srcScheme}
            query={srcQuery}
            onQueryChange={setSrcQuery}
            onSelect={s => { setSrcScheme(s); setSrcQuery(""); }}
            onClear={() => { setSrcScheme(null); setSrcQuery(""); }}
          />

          <SchemeSearchField
            label="Target Scheme *"
            selected={tgtScheme}
            query={tgtQuery}
            onQueryChange={setTgtQuery}
            onSelect={s => { setTgtScheme(s); setTgtQuery(""); }}
            onClear={() => { setTgtScheme(null); setTgtQuery(""); }}
          />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label>Installment Amount (₹) *</Label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="1000" min={1} />
            </div>
            <div>
              <Label>Frequency *</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>No. of Installments *</Label>
              <Input type="number" value={installments} onChange={e => setInstallments(e.target.value)} placeholder="12" min={1} />
            </div>
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
          </div>

          <Button onClick={handleRegister} disabled={registerMutation.isPending}>
            {registerMutation.isPending ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Registering…</> : <><Repeat className="h-4 w-4 mr-2" />Register STP</>}
          </Button>
        </CardContent>
      </Card>

      {/* Active STPs List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Active STPs</CardTitle>
          <CardDescription>View and manage existing STP registrations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Investor PAN"
              value={listPan}
              onChange={e => setListPan(e.target.value.toUpperCase())}
              className="max-w-xs"
              maxLength={10}
            />
            <Button variant="outline" onClick={() => setSubmittedListPan(listPan.trim())} disabled={listPan.length < 10}>
              <Search className="h-4 w-4 mr-1" /> Load STPs
            </Button>
          </div>
          {stpL && <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>}
          {!stpL && stps.length > 0 && (
            <div className="divide-y border rounded-md">
              {stps.map((s, i) => (
                <div key={i} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.sourceSchemeName ?? "Source Scheme"}</p>
                      <p className="text-xs text-muted-foreground">→ {s.targetSchemeName ?? "Target Scheme"}</p>
                      <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground mt-1">
                        <span>{fmt(s.amount)}/{s.frequency?.toLowerCase()}</span>
                        <span>Next: {s.nextInstallmentDate ?? s.nextDate ?? "—"}</span>
                        <span>Remaining: {s.remainingInstallments ?? s.remainingCount ?? "—"}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <StatusBadge status={s.status} />
                      {(s.status?.toUpperCase() === "ACTIVE" || s.status?.toUpperCase() === "PAUSED") && (
                        <div className="flex gap-1">
                          {s.status?.toUpperCase() === "ACTIVE" && (
                            <Button size="sm" variant="outline" className="h-6 text-[11px] px-2"
                              disabled={pauseMutation.isPending}
                              onClick={() => pauseMutation.mutate({ pan: submittedListPan, stpId: s.stpId ?? s.id, sourceSchemeCode: s.sourceSchemeCode })}>
                              Pause
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="h-6 text-[11px] px-2 text-destructive hover:text-destructive"
                            disabled={cancelMutation.isPending}
                            onClick={() => cancelMutation.mutate({ pan: submittedListPan, stpId: s.stpId ?? s.id, sourceSchemeCode: s.sourceSchemeCode })}>
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {submittedListPan && !stpL && stps.length === 0 && (
            <p className="text-sm text-muted-foreground">No active STPs found for {submittedListPan}.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── SWP sub-panel ─────────────────────────────────────────────────────────────
interface SwpRecord {
  swpId?: string;
  id?: string;
  schemeName?: string;
  scheme?: string;
  amount?: number;
  frequency?: string;
  status?: string;
  nextWithdrawalDate?: string;
  nextDate?: string;
  remainingInstallments?: number;
  remainingCount?: number;
  schemeCode?: string;
}

function SwpPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // Form state
  const [pan, setPan] = useState("");
  const [schemeQuery, setSchemeQuery] = useState("");
  const [selectedScheme, setSelectedScheme] = useState<SchemeResult | null>(null);
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState("MONTHLY");
  const [installments, setInstallments] = useState("");
  const [startDate, setStartDate] = useState("");

  // List state
  const [listPan, setListPan] = useState("");
  const [submittedListPan, setSubmittedListPan] = useState("");

  const { data: swpData, isLoading: swpL } = useQuery<IrisApiResponse<{ swps?: SwpRecord[]; systematicPlans?: SwpRecord[] } | SwpRecord[]>>({
    queryKey: ["/api/iris/investors", submittedListPan, "systematic-plans", "SWP"],
    queryFn: () =>
      irisGet<IrisApiResponse<{ swps?: SwpRecord[]; systematicPlans?: SwpRecord[] } | SwpRecord[]>>(
        `/api/iris/investors/${submittedListPan}/systematic-plans?type=SWP`
      ),
    enabled: !!submittedListPan,
    retry: false,
  });

  const registerMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiRequest("/api/iris/transactions/swp/register", "POST", { body }),
    onSuccess: () => {
      toast({ title: "SWP registered successfully" });
      setPan(""); setSelectedScheme(null); setSchemeQuery(""); setAmount(""); setInstallments(""); setStartDate("");
      if (submittedListPan) qc.invalidateQueries({ queryKey: ["/api/iris/investors", submittedListPan, "systematic-plans", "SWP"] });
    },
    onError: (err: Error) => toast({ title: "SWP registration failed", description: err.message, variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiRequest("/api/iris/transactions/swp/cancel", "POST", { body }),
    onSuccess: () => {
      toast({ title: "SWP cancellation submitted" });
      qc.invalidateQueries({ queryKey: ["/api/iris/investors", submittedListPan, "systematic-plans", "SWP"] });
    },
    onError: (err: Error) => toast({ title: "Cancel failed", description: err.message, variant: "destructive" }),
  });

  const pauseMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiRequest("/api/iris/transactions/swp/pause", "POST", { body }),
    onSuccess: () => {
      toast({ title: "SWP paused" });
      qc.invalidateQueries({ queryKey: ["/api/iris/investors", submittedListPan, "systematic-plans", "SWP"] });
    },
    onError: (err: Error) => toast({ title: "Pause failed", description: err.message, variant: "destructive" }),
  });

  function handleRegister() {
    if (!pan.trim()) { toast({ title: "PAN is required", variant: "destructive" }); return; }
    if (!selectedScheme) { toast({ title: "Select a scheme", variant: "destructive" }); return; }
    if (!amount || Number(amount) <= 0) { toast({ title: "Enter a valid withdrawal amount", variant: "destructive" }); return; }
    if (!installments || Number(installments) < 1) { toast({ title: "Enter the number of installments", variant: "destructive" }); return; }

    registerMutation.mutate({
      pan,
      schemeCode: selectedScheme.schemeCode ?? selectedScheme.isinCode ?? selectedScheme.code,
      schemeName: selectedScheme.schemeName ?? selectedScheme.name,
      amount: Number(amount),
      frequency,
      noOfInstallments: Number(installments),
      startDate: startDate || undefined,
    });
  }

  function resolveSwps(): SwpRecord[] {
    if (!swpData?.data) return [];
    if (Array.isArray(swpData.data)) return swpData.data;
    return swpData.data.swps ?? swpData.data.systematicPlans ?? [];
  }

  const swps = resolveSwps();

  return (
    <div className="space-y-6">
      {/* SWP Registration Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MinusCircle className="h-5 w-5 text-rose-500" />Register SWP</CardTitle>
          <CardDescription>Systematic Withdrawal Plan — regular redemptions from a scheme</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Investor PAN *</Label>
            <Input value={pan} onChange={e => setPan(e.target.value.toUpperCase())} placeholder="ABCDE1234F" maxLength={10} className="max-w-xs" />
          </div>

          <SchemeSearchField
            label="Scheme *"
            selected={selectedScheme}
            query={schemeQuery}
            onQueryChange={setSchemeQuery}
            onSelect={s => { setSelectedScheme(s); setSchemeQuery(""); }}
            onClear={() => { setSelectedScheme(null); setSchemeQuery(""); }}
          />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label>Withdrawal Amount (₹) *</Label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="1000" min={1} />
            </div>
            <div>
              <Label>Frequency *</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>No. of Installments *</Label>
              <Input type="number" value={installments} onChange={e => setInstallments(e.target.value)} placeholder="12" min={1} />
            </div>
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
          </div>

          <Button onClick={handleRegister} disabled={registerMutation.isPending}>
            {registerMutation.isPending ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Registering…</> : <><MinusCircle className="h-4 w-4 mr-2" />Register SWP</>}
          </Button>
        </CardContent>
      </Card>

      {/* Active SWPs List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Active SWPs</CardTitle>
          <CardDescription>View and manage existing SWP registrations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Investor PAN"
              value={listPan}
              onChange={e => setListPan(e.target.value.toUpperCase())}
              className="max-w-xs"
              maxLength={10}
            />
            <Button variant="outline" onClick={() => setSubmittedListPan(listPan.trim())} disabled={listPan.length < 10}>
              <Search className="h-4 w-4 mr-1" /> Load SWPs
            </Button>
          </div>
          {swpL && <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>}
          {!swpL && swps.length > 0 && (
            <div className="divide-y border rounded-md">
              {swps.map((s, i) => (
                <div key={i} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.schemeName ?? s.scheme ?? "Scheme"}</p>
                      <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground mt-1">
                        <span>{fmt(s.amount)}/{s.frequency?.toLowerCase()}</span>
                        <span>Next: {s.nextWithdrawalDate ?? s.nextDate ?? "—"}</span>
                        <span>Remaining: {s.remainingInstallments ?? s.remainingCount ?? "—"}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <StatusBadge status={s.status} />
                      {(s.status?.toUpperCase() === "ACTIVE" || s.status?.toUpperCase() === "PAUSED") && (
                        <div className="flex gap-1">
                          {s.status?.toUpperCase() === "ACTIVE" && (
                            <Button size="sm" variant="outline" className="h-6 text-[11px] px-2"
                              disabled={pauseMutation.isPending}
                              onClick={() => pauseMutation.mutate({ pan: submittedListPan, swpId: s.swpId ?? s.id, schemeCode: s.schemeCode })}>
                              Pause
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="h-6 text-[11px] px-2 text-destructive hover:text-destructive"
                            disabled={cancelMutation.isPending}
                            onClick={() => cancelMutation.mutate({ pan: submittedListPan, swpId: s.swpId ?? s.id, schemeCode: s.schemeCode })}>
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {submittedListPan && !swpL && swps.length === 0 && (
            <p className="text-sm text-muted-foreground">No active SWPs found for {submittedListPan}.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── TransactTab wrapper with sub-tabs ─────────────────────────────────────────
function TransactTab() {
  const [subTab, setSubTab] = useState<TransactSubTab>("orders");

  const subTabs: { value: TransactSubTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { value: "orders", label: "Purchase / SIP / Redeem", icon: ArrowUpRight },
    { value: "switch", label: "Switch", icon: ArrowLeftRight },
    { value: "stp", label: "STP", icon: Repeat },
    { value: "swp", label: "SWP", icon: MinusCircle },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 flex-wrap border-b pb-2">
        {subTabs.map(({ value, label, icon: Icon }) => (
          <Button
            key={value}
            size="sm"
            variant={subTab === value ? "default" : "ghost"}
            onClick={() => setSubTab(value)}
            className="h-8 text-xs"
          >
            <Icon className="h-3.5 w-3.5 mr-1" />
            {label}
          </Button>
        ))}
      </div>

      {subTab === "orders" && <OrdersPanel />}
      {subTab === "switch" && <SwitchPanel />}
      {subTab === "stp" && <StpPanel />}
      {subTab === "swp" && <SwpPanel />}
    </div>
  );
}

// ─── FD Types ─────────────────────────────────────────────────────────────────
interface FdOrder {
  orderId?: string;
  id?: string;
  productName?: string;
  name?: string;
  pan?: string;
  amount?: number;
  maturityDate?: string;
  maturityValue?: number;
  status?: string;
  tenureMonths?: number;
  interestRate?: number;
}

interface FdMaturity {
  orderId?: string;
  pan?: string;
  investorName?: string;
  productName?: string;
  amount?: number;
  maturityDate?: string;
  maturityValue?: number;
}

interface FdPrematureClose {
  penalty?: number;
  penaltyAmount?: number;
  finalPayout?: number;
  netPayout?: number;
  effectiveRate?: number;
  daysElapsed?: number;
}

interface FdInterestResult {
  maturityAmount?: number;
  interestEarned?: number;
  effectiveYield?: number;
}

// ─── Products Tab ─────────────────────────────────────────────────────────────
function ProductsTab() {
  const { data: aif, isLoading: aifL } = useQuery<IrisApiResponse<{ links?: ProductLink[] } | ProductLink[]>>({ queryKey: ["/api/iris/products/aif-links"], retry: false });
  const { data: pms, isLoading: pmsL } = useQuery<IrisApiResponse<{ links?: ProductLink[] } | ProductLink[]>>({ queryKey: ["/api/iris/products/pms-links"], retry: false });
  const { data: fd, isLoading: fdL } = useQuery<IrisApiResponse<{ products?: ProductLink[] } | ProductLink[]>>({ queryKey: ["/api/iris/products/fixed-deposits"], retry: false });
  const { data: nps, isLoading: npsL } = useQuery<IrisApiResponse<{ links?: ProductLink[] } | ProductLink[]>>({ queryKey: ["/api/iris/products/nps-links"], retry: false });

  // FD order history state
  const [fdPan, setFdPan] = useState("");
  const [fdSubmittedPan, setFdSubmittedPan] = useState("");
  const [prematureOrder, setPrematureOrder] = useState<FdOrder | null>(null);
  const [prematureData, setPrematureData] = useState<FdPrematureClose | null>(null);
  const [prematureDialogOpen, setPrematureDialogOpen] = useState(false);

  // FD maturity calendar state
  const [maturityDays, setMaturityDays] = useState("30");

  // FD interest calculator state
  const [calcAmount, setCalcAmount] = useState("");
  const [calcTenure, setCalcTenure] = useState("");
  const [calcRate, setCalcRate] = useState("");
  const [calcCompounding, setCalcCompounding] = useState("QUARTERLY");
  const [calcResult, setCalcResult] = useState<FdInterestResult | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);

  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: fdOrdersData, isLoading: fdOrdersL } = useQuery<IrisApiResponse<{ orders?: FdOrder[] } | FdOrder[]>>({
    queryKey: ["/api/iris/products/fixed-deposits/orders", fdSubmittedPan],
    queryFn: () => irisGet<IrisApiResponse<{ orders?: FdOrder[] } | FdOrder[]>>(`/api/iris/products/fixed-deposits/orders?pan=${encodeURIComponent(fdSubmittedPan)}`),
    enabled: !!fdSubmittedPan,
    retry: false,
  });

  const { data: maturityData, isLoading: maturityL } = useQuery<IrisApiResponse<{ maturities?: FdMaturity[] } | FdMaturity[]>>({
    queryKey: ["/api/iris/products/fixed-deposits/maturity", maturityDays],
    queryFn: () => irisGet<IrisApiResponse<{ maturities?: FdMaturity[] } | FdMaturity[]>>(`/api/iris/products/fixed-deposits/maturity?days=${maturityDays}`),
    retry: false,
  });

  const prematurePreviewMutation = useMutation({
    mutationFn: (orderId: string) =>
      apiRequest(`/api/iris/products/fixed-deposits/orders/${orderId}/premature-closure`, "POST", { body: { preview: true } }),
    onSuccess: (data: any) => {
      const d = data?.data ?? data;
      setPrematureData(d as FdPrematureClose);
    },
    onError: (err: Error) => toast({ title: "Could not fetch premature closure details", description: err.message, variant: "destructive" }),
  });

  const prematureCloseMutation = useMutation({
    mutationFn: (orderId: string) =>
      apiRequest(`/api/iris/products/fixed-deposits/orders/${orderId}/premature-closure`, "POST", { body: { confirm: true } }),
    onSuccess: () => {
      toast({ title: "Premature closure initiated successfully" });
      setPrematureDialogOpen(false);
      setPrematureOrder(null);
      setPrematureData(null);
      qc.invalidateQueries({ queryKey: ["/api/iris/products/fixed-deposits/orders", fdSubmittedPan] });
    },
    onError: (err: Error) => toast({ title: "Premature closure failed", description: err.message, variant: "destructive" }),
  });

  function openPrematureDialog(order: FdOrder) {
    setPrematureOrder(order);
    setPrematureData(null);
    setPrematureDialogOpen(true);
    const id = order.orderId ?? order.id ?? "";
    if (id) prematurePreviewMutation.mutate(id);
  }

  async function runInterestCalc() {
    if (!calcAmount || !calcTenure || !calcRate) {
      toast({ title: "Please fill all calculator fields", variant: "destructive" });
      return;
    }
    setCalcLoading(true);
    setCalcResult(null);
    try {
      const qs = new URLSearchParams({ amount: calcAmount, tenureMonths: calcTenure, rate: calcRate, compounding: calcCompounding });
      const data = await irisGet<IrisApiResponse<FdInterestResult>>(`/api/iris/products/fixed-deposits/interest-calculator?${qs}`);
      if (data?.data) {
        setCalcResult(data.data);
      } else {
        const p = Number(calcAmount);
        const r = Number(calcRate) / 100;
        const n = calcCompounding === "MONTHLY" ? 12 : calcCompounding === "QUARTERLY" ? 4 : calcCompounding === "HALF_YEARLY" ? 2 : 1;
        const t = Number(calcTenure) / 12;
        const maturity = p * Math.pow(1 + r / n, n * t);
        setCalcResult({ maturityAmount: maturity, interestEarned: maturity - p, effectiveYield: ((maturity - p) / p) * 100 });
      }
    } catch {
      const p = Number(calcAmount);
      const r = Number(calcRate) / 100;
      const n = calcCompounding === "MONTHLY" ? 12 : calcCompounding === "QUARTERLY" ? 4 : calcCompounding === "HALF_YEARLY" ? 2 : 1;
      const t = Number(calcTenure) / 12;
      const maturity = p * Math.pow(1 + r / n, n * t);
      setCalcResult({ maturityAmount: maturity, interestEarned: maturity - p, effectiveYield: ((maturity - p) / p) * 100 });
    } finally {
      setCalcLoading(false);
    }
  }

  function resolveFdOrders(): FdOrder[] {
    if (!fdOrdersData?.data) return [];
    if (Array.isArray(fdOrdersData.data)) return fdOrdersData.data;
    if ('orders' in fdOrdersData.data) return fdOrdersData.data.orders ?? [];
    return [];
  }

  function resolveMaturities(): FdMaturity[] {
    if (!maturityData?.data) return [];
    if (Array.isArray(maturityData.data)) return maturityData.data;
    if ('maturities' in maturityData.data) return maturityData.data.maturities ?? [];
    return [];
  }

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

  const fdOrders = resolveFdOrders();
  const maturities = resolveMaturities();

  return (
    <div className="space-y-6">
      {/* ── Product Links ──────────────────────────────────────────────────────── */}
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

      {/* ── FD Order History ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Banknote className="h-5 w-5 text-blue-500" />FD Order History</CardTitle>
          <CardDescription>View placed FD orders by investor PAN. Initiate premature closure if needed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Investor PAN (e.g. ABCDE1234F)"
              value={fdPan}
              onChange={e => setFdPan(e.target.value.toUpperCase())}
              className="max-w-xs"
            />
            <Button onClick={() => setFdSubmittedPan(fdPan.trim())} disabled={fdPan.length < 10 || fdOrdersL}>
              {fdOrdersL ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
              Load Orders
            </Button>
          </div>
          {fdSubmittedPan && (
            fdOrdersL ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : fdOrders.length > 0 ? (
              <ScrollArea className="h-64 border rounded-md">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background border-b">
                    <tr>
                      <th className="text-left p-2 font-medium">Order ID</th>
                      <th className="text-left p-2 font-medium">Product</th>
                      <th className="text-right p-2 font-medium">Amount</th>
                      <th className="text-right p-2 font-medium">Maturity Date</th>
                      <th className="text-center p-2 font-medium">Status</th>
                      <th className="text-center p-2 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fdOrders.map((o, i) => (
                      <tr key={i} className="border-b hover:bg-muted/50">
                        <td className="p-2 font-mono text-xs">{o.orderId ?? o.id ?? "—"}</td>
                        <td className="p-2">{o.productName ?? o.name ?? "—"}</td>
                        <td className="p-2 text-right">{fmt(o.amount)}</td>
                        <td className="p-2 text-right text-xs">{o.maturityDate ?? "—"}</td>
                        <td className="p-2 text-center">
                          <Badge variant={o.status === "ACTIVE" ? "default" : o.status === "MATURED" ? "secondary" : "outline"} className="text-xs">
                            {o.status ?? "—"}
                          </Badge>
                        </td>
                        <td className="p-2 text-center">
                          {o.status === "ACTIVE" && (
                            <Button size="sm" variant="outline" className="h-7 text-xs text-destructive hover:text-destructive"
                              onClick={() => openPrematureDialog(o)}>
                              Premature Close
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            ) : (
              <p className="text-sm text-muted-foreground">No FD orders found for {fdSubmittedPan}.</p>
            )
          )}
        </CardContent>
      </Card>

      {/* ── Premature Closure Dialog ───────────────────────────────────────────── */}
      <Dialog open={prematureDialogOpen} onOpenChange={v => { if (!v) { setPrematureDialogOpen(false); setPrematureOrder(null); setPrematureData(null); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Premature FD Closure</DialogTitle>
            <DialogDescription>
              Order: <span className="font-mono">{prematureOrder?.orderId ?? prematureOrder?.id ?? "—"}</span> — {prematureOrder?.productName ?? prematureOrder?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            {prematurePreviewMutation.isPending ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : prematureData ? (
              <div className="space-y-2">
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Penalty</span>
                    <span className="text-destructive font-medium">{fmt(prematureData.penalty ?? prematureData.penaltyAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Final Payout</span>
                    <span className="font-semibold">{fmt(prematureData.finalPayout ?? prematureData.netPayout)}</span>
                  </div>
                  {prematureData.effectiveRate != null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Effective Rate</span>
                      <span>{prematureData.effectiveRate.toFixed(2)}%</span>
                    </div>
                  )}
                  {prematureData.daysElapsed != null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Days Elapsed</span>
                      <span>{prematureData.daysElapsed}</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Penalty deducted from principal due to early withdrawal. This action is irreversible.</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Penalty details not available from IRIS. Proceeding will initiate the closure.</p>
            )}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => { setPrematureDialogOpen(false); setPrematureOrder(null); setPrematureData(null); }}>Cancel</Button>
              <Button variant="destructive" className="flex-1"
                onClick={() => { const id = prematureOrder?.orderId ?? prematureOrder?.id ?? ""; if (id) prematureCloseMutation.mutate(id); }}
                disabled={prematureCloseMutation.isPending}>
                {prematureCloseMutation.isPending ? "Closing…" : "Confirm Closure"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── FD Maturity Calendar ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5 text-green-500" />FD Maturity Calendar</CardTitle>
          <CardDescription>Upcoming FD maturities across the distributor's book</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 items-center">
            <span className="text-sm text-muted-foreground">Show maturities in next</span>
            <Select value={maturityDays} onValueChange={setMaturityDays}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="60">60 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {maturityL ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : maturities.length > 0 ? (
            <ScrollArea className="h-56 border rounded-md">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background border-b">
                  <tr>
                    <th className="text-left p-2 font-medium">Maturity Date</th>
                    <th className="text-left p-2 font-medium">Investor PAN</th>
                    <th className="text-left p-2 font-medium">Product</th>
                    <th className="text-right p-2 font-medium">Amount</th>
                    <th className="text-right p-2 font-medium">Maturity Value</th>
                  </tr>
                </thead>
                <tbody>
                  {maturities.map((m, i) => (
                    <tr key={i} className="border-b hover:bg-muted/50">
                      <td className="p-2 text-xs font-medium">{m.maturityDate ?? "—"}</td>
                      <td className="p-2 font-mono text-xs">{m.pan ?? "—"}</td>
                      <td className="p-2">{m.productName ?? "—"}</td>
                      <td className="p-2 text-right">{fmt(m.amount)}</td>
                      <td className="p-2 text-right font-medium">{fmt(m.maturityValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          ) : (
            <p className="text-sm text-muted-foreground">No FD maturities in the next {maturityDays} days.</p>
          )}
        </CardContent>
      </Card>

      {/* ── FD Interest Calculator ────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5 text-purple-500" />FD Interest Calculator</CardTitle>
          <CardDescription>Estimate FD returns based on amount, tenure, rate, and compounding frequency</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Principal Amount (₹)</Label>
              <Input type="number" placeholder="100000" value={calcAmount} onChange={e => setCalcAmount(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Tenure (months)</Label>
              <Input type="number" placeholder="12" value={calcTenure} onChange={e => setCalcTenure(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Interest Rate (% p.a.)</Label>
              <Input type="number" placeholder="7.5" step="0.01" value={calcRate} onChange={e => setCalcRate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Compounding</Label>
              <Select value={calcCompounding} onValueChange={setCalcCompounding}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                  <SelectItem value="HALF_YEARLY">Half-yearly</SelectItem>
                  <SelectItem value="ANNUALLY">Annually</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={runInterestCalc} disabled={calcLoading}>
            {calcLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : <Calculator className="h-4 w-4 mr-1" />}
            Calculate
          </Button>
          {calcResult && (
            <div className="grid grid-cols-3 gap-3 mt-2">
              <div className="bg-muted rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Maturity Amount</p>
                <p className="font-bold text-base">{fmt(calcResult.maturityAmount)}</p>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Interest Earned</p>
                <p className="font-bold text-base text-green-600">{fmt(calcResult.interestEarned)}</p>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Effective Yield</p>
                <p className="font-bold text-base">{calcResult.effectiveYield != null ? calcResult.effectiveYield.toFixed(2) + "%" : "—"}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── NPS Tab ──────────────────────────────────────────────────────────────────
interface NpsSubscriber {
  name?: string;
  subscriberName?: string;
  pran?: string;
  status?: string;
  tier?: string;
  tierType?: string;
  dateOfBirth?: string;
  mobile?: string;
  email?: string;
}

interface NpsAllocation {
  assetClass?: string;
  percentage?: number;
  currentValue?: number;
}

interface NpsFundValue {
  schemeName?: string;
  scheme?: string;
  nav?: number;
  units?: number;
  currentValue?: number;
  tier?: string;
}

interface NpsTransaction {
  date?: string;
  transactionDate?: string;
  type?: string;
  transactionType?: string;
  amount?: number;
  status?: string;
}

function NpsTab() {
  const [pranInput, setPranInput] = useState("");
  const [pran, setPran] = useState("");
  const [schemeChangeOpen, setSchemeChangeOpen] = useState(false);
  const [withdrawalOpen, setWithdrawalOpen] = useState(false);

  // Scheme change form state
  const [newFundManager, setNewFundManager] = useState("");
  const [newAssetClass, setNewAssetClass] = useState("");

  // Partial withdrawal form state
  const [withdrawalReason, setWithdrawalReason] = useState("");
  const [withdrawalAmount, setWithdrawalAmount] = useState("");

  const { toast } = useToast();

  const { data: subscriberData, isLoading: subL } = useQuery<IrisApiResponse<NpsSubscriber>>({
    queryKey: ["/api/iris/nps/subscriber", pran],
    queryFn: () => irisGet<IrisApiResponse<NpsSubscriber>>(`/api/iris/nps/subscriber/${pran}`),
    enabled: !!pran,
    retry: false,
  });

  const { data: portfolioData, isLoading: portfolioL } = useQuery<IrisApiResponse<{ allocations?: NpsAllocation[]; allocation?: NpsAllocation[] }>>({
    queryKey: ["/api/iris/nps/subscriber", pran, "portfolio"],
    queryFn: () => irisGet<IrisApiResponse<{ allocations?: NpsAllocation[]; allocation?: NpsAllocation[] }>>(`/api/iris/nps/subscriber/${pran}/portfolio`),
    enabled: !!pran,
    retry: false,
  });

  const { data: fundValuesData, isLoading: fundL } = useQuery<IrisApiResponse<{ funds?: NpsFundValue[]; fundValues?: NpsFundValue[] } | NpsFundValue[]>>({
    queryKey: ["/api/iris/nps/subscriber", pran, "fund-values"],
    queryFn: () => irisGet<IrisApiResponse<{ funds?: NpsFundValue[]; fundValues?: NpsFundValue[] } | NpsFundValue[]>>(`/api/iris/nps/subscriber/${pran}/fund-values`),
    enabled: !!pran,
    retry: false,
  });

  const { data: txnsData, isLoading: txnL } = useQuery<IrisApiResponse<{ transactions?: NpsTransaction[] } | NpsTransaction[]>>({
    queryKey: ["/api/iris/nps/subscriber", pran, "transactions"],
    queryFn: () => irisGet<IrisApiResponse<{ transactions?: NpsTransaction[] } | NpsTransaction[]>>(`/api/iris/nps/subscriber/${pran}/transactions`),
    enabled: !!pran,
    retry: false,
  });

  const schemeChangeMutation = useMutation({
    mutationFn: () => apiRequest(`/api/iris/nps/subscriber/${pran}/scheme-change`, "POST", {
      body: { newFundManager, assetClass: newAssetClass },
    }),
    onSuccess: () => {
      toast({ title: "Scheme change request submitted" });
      setSchemeChangeOpen(false);
      setNewFundManager("");
      setNewAssetClass("");
    },
    onError: (err: Error) => toast({ title: "Scheme change failed", description: err.message, variant: "destructive" }),
  });

  const withdrawalMutation = useMutation({
    mutationFn: () => apiRequest(`/api/iris/nps/subscriber/${pran}/partial-withdrawal`, "POST", {
      body: { reason: withdrawalReason, amount: Number(withdrawalAmount) },
    }),
    onSuccess: () => {
      toast({ title: "Partial withdrawal request submitted" });
      setWithdrawalOpen(false);
      setWithdrawalReason("");
      setWithdrawalAmount("");
    },
    onError: (err: Error) => toast({ title: "Withdrawal request failed", description: err.message, variant: "destructive" }),
  });

  function resolveAllocations(): NpsAllocation[] {
    const d = portfolioData?.data;
    if (!d) return [];
    return d.allocations ?? d.allocation ?? [];
  }

  function resolveFundValues(): NpsFundValue[] {
    const d = fundValuesData?.data;
    if (!d) return [];
    if (Array.isArray(d)) return d;
    return d.funds ?? d.fundValues ?? [];
  }

  function resolveNpsTxns(): NpsTransaction[] {
    const d = txnsData?.data;
    if (!d) return [];
    if (Array.isArray(d)) return d;
    return d.transactions ?? [];
  }

  const subscriber = subscriberData?.data;
  const allocations = resolveAllocations();
  const fundValues = resolveFundValues();
  const npsTxns = resolveNpsTxns();

  return (
    <div className="space-y-6">
      {/* ── PRAN Search ────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><PiggyBank className="h-5 w-5 text-orange-500" />NPS Subscriber Lookup</CardTitle>
          <CardDescription>Enter PRAN to view subscriber details, portfolio allocation, and fund values</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="PRAN (12-digit number)"
              value={pranInput}
              onChange={e => setPranInput(e.target.value.replace(/\D/g, "").slice(0, 12))}
              className="max-w-xs font-mono"
            />
            <Button onClick={() => setPran(pranInput.trim())} disabled={pranInput.length !== 12 || subL}>
              {subL ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
              Search
            </Button>
          </div>

          {pran && subscriber && (
            <div className="space-y-4">
              {/* Subscriber Detail Card */}
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-base">{subscriber.name ?? subscriber.subscriberName ?? "—"}</p>
                    <p className="text-sm text-muted-foreground font-mono">{pran}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant={subscriber.status === "ACTIVE" ? "default" : "secondary"}>{subscriber.status ?? "Unknown"}</Badge>
                      {(subscriber.tier ?? subscriber.tierType) && <Badge variant="outline">{subscriber.tier ?? subscriber.tierType}</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setSchemeChangeOpen(true)}>
                      <RefreshCw className="h-3.5 w-3.5 mr-1" /> Change Scheme
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setWithdrawalOpen(true)}>
                      <IndianRupee className="h-3.5 w-3.5 mr-1" /> Partial Withdrawal
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                  {subscriber.dateOfBirth && <div><span className="text-muted-foreground">DOB: </span>{subscriber.dateOfBirth}</div>}
                  {subscriber.mobile && <div><span className="text-muted-foreground">Mobile: </span>{subscriber.mobile}</div>}
                  {subscriber.email && <div><span className="text-muted-foreground">Email: </span>{subscriber.email}</div>}
                </div>
              </div>

              {/* Portfolio Allocation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Portfolio Allocation</CardTitle></CardHeader>
                  <CardContent>
                    {portfolioL ? <Skeleton className="h-24 w-full" /> : allocations.length > 0 ? (
                      <div className="space-y-2">
                        {allocations.map((a, i) => (
                          <div key={i} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="font-medium">{a.assetClass ?? "—"}</span>
                              <span>{a.percentage != null ? a.percentage.toFixed(1) + "%" : "—"}</span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-1.5">
                              <div className="bg-primary rounded-full h-1.5" style={{ width: `${a.percentage ?? 0}%` }} />
                            </div>
                            {a.currentValue != null && (
                              <p className="text-xs text-muted-foreground text-right">{fmt(a.currentValue)}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-sm text-muted-foreground">No allocation data</p>}
                  </CardContent>
                </Card>

                {/* Fund Values Table */}
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Fund Values</CardTitle></CardHeader>
                  <CardContent>
                    {fundL ? <Skeleton className="h-24 w-full" /> : fundValues.length > 0 ? (
                      <div className="divide-y">
                        {fundValues.map((f, i) => (
                          <div key={i} className="py-2 text-sm">
                            <p className="font-medium truncate">{f.schemeName ?? f.scheme ?? "—"}</p>
                            <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
                              <span>NAV: {f.nav != null ? "₹" + f.nav.toFixed(4) : "—"} · Units: {f.units != null ? f.units.toFixed(3) : "—"}</span>
                              <span className="font-medium text-foreground">{fmt(f.currentValue)}</span>
                            </div>
                            {f.tier && <Badge variant="outline" className="text-[10px] h-4 mt-0.5">{f.tier}</Badge>}
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-sm text-muted-foreground">No fund value data</p>}
                  </CardContent>
                </Card>
              </div>

              {/* NPS Transaction History */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Transaction History</CardTitle></CardHeader>
                <CardContent>
                  {txnL ? (
                    <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
                  ) : npsTxns.length > 0 ? (
                    <ScrollArea className="h-52 border rounded-md">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-background border-b">
                          <tr>
                            <th className="text-left p-2 font-medium">Date</th>
                            <th className="text-left p-2 font-medium">Type</th>
                            <th className="text-right p-2 font-medium">Amount</th>
                            <th className="text-center p-2 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {npsTxns.map((t, i) => (
                            <tr key={i} className="border-b hover:bg-muted/50">
                              <td className="p-2 text-xs">{t.date ?? t.transactionDate ?? "—"}</td>
                              <td className="p-2">{t.type ?? t.transactionType ?? "—"}</td>
                              <td className="p-2 text-right">{fmt(t.amount)}</td>
                              <td className="p-2 text-center">
                                <Badge variant={t.status === "SUCCESS" ? "default" : t.status === "PENDING" ? "secondary" : "destructive"} className="text-[10px] h-4">
                                  {t.status ?? "—"}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </ScrollArea>
                  ) : (
                    <p className="text-sm text-muted-foreground">No transaction history available</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {pran && !subL && !subscriber && (
            <p className="text-sm text-muted-foreground">No subscriber found for PRAN {pran}.</p>
          )}
          {subL && <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>}
        </CardContent>
      </Card>

      {/* ── NPS Scheme Change Dialog ──────────────────────────────────────────── */}
      <Dialog open={schemeChangeOpen} onOpenChange={setSchemeChangeOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>NPS Scheme Change</DialogTitle>
            <DialogDescription>Change the fund manager or asset class allocation for PRAN {pran}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>New Fund Manager</Label>
              <Select value={newFundManager} onValueChange={setNewFundManager}>
                <SelectTrigger><SelectValue placeholder="Select fund manager" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SBI">SBI Pension Funds</SelectItem>
                  <SelectItem value="LIC">LIC Pension Fund</SelectItem>
                  <SelectItem value="UTI">UTI Retirement Solutions</SelectItem>
                  <SelectItem value="HDFC">HDFC Pension Management</SelectItem>
                  <SelectItem value="ICICI">ICICI Prudential Pension Funds</SelectItem>
                  <SelectItem value="KOTAK">Kotak Mahindra Pension Fund</SelectItem>
                  <SelectItem value="ADITYA_BIRLA">Aditya Birla Sun Life Pension</SelectItem>
                  <SelectItem value="TATA">Tata Pension Management</SelectItem>
                  <SelectItem value="MAX_LIFE">Max Life Pension Fund</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Asset Class (optional)</Label>
              <Select value={newAssetClass} onValueChange={setNewAssetClass}>
                <SelectTrigger><SelectValue placeholder="Select asset class" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="E">Class E (Equity)</SelectItem>
                  <SelectItem value="C">Class C (Corporate Bonds)</SelectItem>
                  <SelectItem value="G">Class G (Government Securities)</SelectItem>
                  <SelectItem value="A">Class A (Alternative Assets)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setSchemeChangeOpen(false)}>Cancel</Button>
              <Button className="flex-1"
                onClick={() => schemeChangeMutation.mutate()}
                disabled={schemeChangeMutation.isPending || !newFundManager}>
                {schemeChangeMutation.isPending ? "Submitting…" : "Submit Request"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── NPS Partial Withdrawal Dialog ────────────────────────────────────── */}
      <Dialog open={withdrawalOpen} onOpenChange={setWithdrawalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>NPS Partial Withdrawal</DialogTitle>
            <DialogDescription>Raise a partial withdrawal request for PRAN {pran}. Up to 25% of own contributions allowed after 3 years.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Withdrawal Reason *</Label>
              <Select value={withdrawalReason} onValueChange={setWithdrawalReason}>
                <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="HIGHER_EDUCATION">Higher Education of children</SelectItem>
                  <SelectItem value="MARRIAGE">Marriage of children</SelectItem>
                  <SelectItem value="HOUSE_PURCHASE">Purchase / construction of house</SelectItem>
                  <SelectItem value="CRITICAL_ILLNESS">Treatment of critical illness</SelectItem>
                  <SelectItem value="DISABILITY">Disability (≥75%)</SelectItem>
                  <SelectItem value="SKILL_DEVELOPMENT">Skill development / self-employment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Withdrawal Amount (₹) *</Label>
              <Input
                type="number"
                placeholder="Enter amount"
                value={withdrawalAmount}
                onChange={e => setWithdrawalAmount(e.target.value)}
                min={1}
              />
            </div>
            <p className="text-xs text-muted-foreground">Supporting documents (e.g., medical certificate, admission letter) must be uploaded via the PFRDA portal separately.</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setWithdrawalOpen(false)}>Cancel</Button>
              <Button className="flex-1"
                onClick={() => withdrawalMutation.mutate()}
                disabled={withdrawalMutation.isPending || !withdrawalReason || !withdrawalAmount}>
                {withdrawalMutation.isPending ? "Submitting…" : "Submit Request"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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

// ─── Analytics Tab ────────────────────────────────────────────────────────────
function AnalyticsTab() {
  const [pan, setPan] = useState("");
  const [submittedPan, setSubmittedPan] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const xirrQuery = useQuery<{ success: boolean; data: { xirr?: number; absoluteReturn?: number; cagr?: number; investedValue?: number; currentValue?: number } }>({
    queryKey: ["/api/iris/analytics/xirr", submittedPan, fromDate, toDate],
    queryFn: () => irisGet(`/api/iris/analytics/xirr/${submittedPan}${fromDate || toDate ? '?' + new URLSearchParams(Object.fromEntries(Object.entries({ fromDate, toDate }).filter(([, v]) => v))).toString() : ''}`),
    enabled: !!submittedPan,
    retry: false,
  });

  const portfolioXirrQuery = useQuery<{ success: boolean; data: { xirr?: number; portfolioXirr?: number } }>({
    queryKey: ["/api/iris/analytics/portfolio-xirr", submittedPan],
    queryFn: () => irisGet(`/api/iris/analytics/portfolio-xirr/${submittedPan}`),
    enabled: !!submittedPan,
    retry: false,
  });

  const returnsQuery = useQuery<{ success: boolean; data: { schemes?: Array<{ schemeName?: string; absoluteReturn?: number; xirr?: number; cagr?: number; investedValue?: number; currentValue?: number }> } }>({
    queryKey: ["/api/iris/analytics/returns", submittedPan],
    queryFn: () => irisGet(`/api/iris/analytics/returns/${submittedPan}`),
    enabled: !!submittedPan,
    retry: false,
  });

  const sipXirrQuery = useQuery<{ success: boolean; data: { sipXirr?: number; xirr?: number; sips?: Array<{ schemeName?: string; xirr?: number; amount?: number }> } }>({
    queryKey: ["/api/iris/analytics/sip-returns", submittedPan],
    queryFn: () => irisGet(`/api/iris/analytics/sip-returns/${submittedPan}`),
    enabled: !!submittedPan,
    retry: false,
  });

  const taxHarvestQuery = useQuery<{ success: boolean; data: { opportunities?: Array<{ schemeName?: string; units?: number; currentValue?: number; purchaseValue?: number; gainLoss?: number; ltcgExemption?: number; exitLoadApplicable?: boolean; holdingDays?: number; taxSaving?: number }> } }>({
    queryKey: ["/api/iris/portfolio/tax-harvest", submittedPan],
    queryFn: () => irisGet(`/api/iris/portfolio/tax-harvest/${submittedPan}`),
    enabled: !!submittedPan,
    retry: false,
  });

  function handleLoad() {
    if (pan.length < 10) return;
    setSubmittedPan(pan.trim().toUpperCase());
  }

  const xirr = xirrQuery.data?.data;
  const portfolioXirr = portfolioXirrQuery.data?.data;
  const schemes = returnsQuery.data?.data?.schemes ?? [];
  const sipXirr = sipXirrQuery.data?.data;
  const taxOpps = taxHarvestQuery.data?.data?.opportunities ?? [];
  const loading = xirrQuery.isLoading || portfolioXirrQuery.isLoading;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LineChart className="h-5 w-5 text-primary" /> Investor Analytics
          </CardTitle>
          <CardDescription>Enter a PAN to load XIRR, returns breakdown, SIP XIRR and tax harvest opportunities.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <Label>Investor PAN</Label>
              <Input value={pan} onChange={e => setPan(e.target.value.toUpperCase())} placeholder="ABCDE1234F" maxLength={10} className="w-40" />
            </div>
            <div>
              <Label>From Date</Label>
              <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-38" />
            </div>
            <div>
              <Label>To Date</Label>
              <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-38" />
            </div>
            <Button onClick={handleLoad} disabled={pan.length < 10}>
              {loading ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
              Load Analytics
            </Button>
          </div>
        </CardContent>
      </Card>

      {submittedPan && (
        <>
          {/* XIRR Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Overall XIRR"
              value={xirr?.xirr != null ? `${xirr.xirr.toFixed(2)}%` : undefined}
              subtitle="Annualised return"
              icon={TrendingUp}
              loading={xirrQuery.isLoading}
            />
            <StatCard
              title="Portfolio XIRR"
              value={portfolioXirr?.xirr != null ? `${portfolioXirr.xirr.toFixed(2)}%` : portfolioXirr?.portfolioXirr != null ? `${portfolioXirr.portfolioXirr.toFixed(2)}%` : undefined}
              subtitle="Full portfolio view"
              icon={BarChart3}
              loading={portfolioXirrQuery.isLoading}
            />
            <StatCard
              title="SIP XIRR"
              value={sipXirr?.sipXirr != null ? `${sipXirr.sipXirr.toFixed(2)}%` : sipXirr?.xirr != null ? `${sipXirr.xirr.toFixed(2)}%` : undefined}
              subtitle="Systematic investments only"
              icon={Activity}
              loading={sipXirrQuery.isLoading}
            />
            <StatCard
              title="Absolute Return"
              value={xirr?.absoluteReturn != null ? `${xirr.absoluteReturn.toFixed(2)}%` : undefined}
              subtitle={xirr?.currentValue != null ? fmt(xirr.currentValue) : undefined}
              icon={IndianRupee}
              loading={xirrQuery.isLoading}
            />
          </div>

          {/* Portfolio XIRR Trend — bar chart across schemes sorted by XIRR */}
          {schemes.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Portfolio XIRR Trend (by Scheme)</CardTitle></CardHeader>
              <CardContent>
                {returnsQuery.isLoading ? <Skeleton className="h-28 w-full" /> : (
                  <div className="space-y-2">
                    {[...schemes].sort((a, b) => (b.xirr ?? 0) - (a.xirr ?? 0)).slice(0, 8).map((s, i) => {
                      const max = Math.max(...schemes.map(x => Math.abs(x.xirr ?? 0)), 1);
                      const pct = Math.min(Math.abs((s.xirr ?? 0) / max) * 100, 100);
                      const isPos = (s.xirr ?? 0) >= 0;
                      return (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className="w-40 truncate text-muted-foreground">{s.schemeName ?? '—'}</span>
                          <div className="flex-1 bg-muted rounded h-5 relative overflow-hidden">
                            <div
                              className={`absolute left-0 top-0 h-full rounded ${isPos ? 'bg-green-500' : 'bg-red-400'}`}
                              style={{ width: `${pct}%` }}
                            />
                            <span className={`absolute right-2 top-0 h-full flex items-center font-medium ${isPos ? 'text-green-700' : 'text-red-600'}`}>
                              {s.xirr != null ? `${s.xirr.toFixed(1)}%` : '—'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Returns Breakdown */}
          {schemes.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Returns Breakdown by Scheme</CardTitle></CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-72">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-background border-b">
                      <tr>
                        <th className="text-left p-3 font-medium">Scheme</th>
                        <th className="text-right p-3 font-medium">Invested</th>
                        <th className="text-right p-3 font-medium">Current</th>
                        <th className="text-right p-3 font-medium">Abs Return</th>
                        <th className="text-right p-3 font-medium">XIRR</th>
                        <th className="text-right p-3 font-medium">CAGR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schemes.map((s, i) => (
                        <tr key={i} className="border-b hover:bg-muted/50">
                          <td className="p-3 max-w-[200px] truncate">{s.schemeName ?? '—'}</td>
                          <td className="p-3 text-right">{fmt(s.investedValue)}</td>
                          <td className="p-3 text-right">{fmt(s.currentValue)}</td>
                          <td className={`p-3 text-right ${(s.absoluteReturn ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {s.absoluteReturn != null ? `${s.absoluteReturn.toFixed(2)}%` : '—'}
                          </td>
                          <td className={`p-3 text-right ${(s.xirr ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {s.xirr != null ? `${s.xirr.toFixed(2)}%` : '—'}
                          </td>
                          <td className={`p-3 text-right ${(s.cagr ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {s.cagr != null ? `${s.cagr.toFixed(2)}%` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {returnsQuery.isLoading && (
            <Card><CardContent className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</CardContent></Card>
          )}

          {/* SIP XIRR per scheme */}
          {(sipXirr?.sips?.length ?? 0) > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">SIP-specific XIRR</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {sipXirr!.sips!.map((s, i) => (
                    <div key={i} className="p-3 flex justify-between items-center">
                      <span className="text-sm truncate max-w-[60%]">{s.schemeName ?? '—'}</span>
                      <div className="flex items-center gap-3 text-sm">
                        {s.amount != null && <span className="text-muted-foreground">{fmt(s.amount)}/mo</span>}
                        <span className={`font-medium ${(s.xirr ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {s.xirr != null ? `${s.xirr.toFixed(2)}%` : '—'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tax Harvest */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <IndianRupee className="h-4 w-4 text-amber-500" /> Tax Harvest Opportunities
              </CardTitle>
              <CardDescription>Holdings where selling now qualifies for LTCG exemption or avoids exit load, ranked by potential tax saving.</CardDescription>
            </CardHeader>
            <CardContent>
              {taxHarvestQuery.isLoading ? (
                <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : taxOpps.length > 0 ? (
                <ScrollArea className="h-72">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-background border-b">
                      <tr>
                        <th className="text-left p-3 font-medium">Scheme</th>
                        <th className="text-right p-3 font-medium">Days</th>
                        <th className="text-right p-3 font-medium">Current Value</th>
                        <th className="text-right p-3 font-medium">Gain/Loss</th>
                        <th className="text-right p-3 font-medium">LTCG Exempt</th>
                        <th className="text-right p-3 font-medium">Tax Saving</th>
                        <th className="text-center p-3 font-medium">Exit Load</th>
                        <th className="text-center p-3 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {taxOpps.map((op, i) => (
                        <tr key={i} className="border-b hover:bg-muted/50">
                          <td className="p-3 max-w-[160px] truncate">{op.schemeName ?? '—'}</td>
                          <td className="p-3 text-right">{op.holdingDays ?? '—'}</td>
                          <td className="p-3 text-right">{fmt(op.currentValue)}</td>
                          <td className={`p-3 text-right ${(op.gainLoss ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmt(op.gainLoss)}</td>
                          <td className="p-3 text-right">{op.ltcgExemption != null ? fmt(op.ltcgExemption) : '—'}</td>
                          <td className="p-3 text-right font-medium text-green-600">{op.taxSaving != null ? fmt(op.taxSaving) : '—'}</td>
                          <td className="p-3 text-center">
                            <Badge variant={op.exitLoadApplicable ? 'destructive' : 'default'} className="text-[10px]">
                              {op.exitLoadApplicable ? 'Yes' : 'No'}
                            </Badge>
                          </td>
                          <td className="p-3 text-center">
                            <Button size="sm" variant="outline" className="h-6 text-[11px] px-2"
                              onClick={() => {
                                const schemeCode = (op as { schemeCode?: string }).schemeCode;
                                const url = schemeCode
                                  ? `/api/iris/transactions/place-redemption`
                                  : undefined;
                                if (!url) { alert('Open Transact tab to initiate redemption for: ' + (op.schemeName ?? 'this scheme')); return; }
                              }}>
                              Redeem
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              ) : taxHarvestQuery.isError ? (
                <p className="text-sm text-muted-foreground">Tax harvest data unavailable for this PAN.</p>
              ) : (
                <p className="text-sm text-muted-foreground">No tax harvest opportunities found.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Research Tab ──────────────────────────────────────────────────────────────
type ResearchSection = "search" | "compare" | "browse";

function ResearchTab() {
  const [section, setSection] = useState<ResearchSection>("search");
  const [schemeQuery, setSchemeQuery] = useState("");
  const [selectedScheme, setSelectedScheme] = useState<SchemeResult | null>(null);
  const [navPeriod, setNavPeriod] = useState("1M");
  const [compareList, setCompareList] = useState<SchemeResult[]>([]);
  const [compareQuery, setCompareQuery] = useState("");
  const [browseCategory, setBrowseCategory] = useState("");
  const [browseSubcategory, setBrowseSubcategory] = useState("ALL");
  const [riskProfile, setRiskProfile] = useState("ANY");

  const schemeSearchData = useQuery<{ success: boolean; data: { schemes?: SchemeResult[] } | SchemeResult[] }>({
    queryKey: ["/api/iris/transactions/scheme-search", schemeQuery],
    queryFn: () => irisGet(`/api/iris/transactions/scheme-search?q=${encodeURIComponent(schemeQuery)}`),
    enabled: schemeQuery.length >= 2 && !selectedScheme,
    retry: false,
  });

  const compareSearchData = useQuery<{ success: boolean; data: { schemes?: SchemeResult[] } | SchemeResult[] }>({
    queryKey: ["/api/iris/transactions/scheme-search", "compare", compareQuery],
    queryFn: () => irisGet(`/api/iris/transactions/scheme-search?q=${encodeURIComponent(compareQuery)}`),
    enabled: compareQuery.length >= 2,
    retry: false,
  });

  const schemeCode = selectedScheme?.schemeCode ?? selectedScheme?.isinCode ?? selectedScheme?.code ?? "";

  const navHistoryQuery = useQuery<{ success: boolean; data: { history?: Array<{ date: string; nav: number }> } }>({
    queryKey: ["/api/iris/schemes", schemeCode, "nav-history", navPeriod],
    queryFn: () => irisGet(`/api/iris/schemes/${schemeCode}/nav-history?period=${navPeriod}`),
    enabled: !!schemeCode,
    retry: false,
  });

  const performanceQuery = useQuery<{ success: boolean; data: { returns?: { oneYear?: number; threeYear?: number; fiveYear?: number }; stdDeviation?: number; sharpe?: number; expenseRatio?: number } }>({
    queryKey: ["/api/iris/schemes", schemeCode, "performance"],
    queryFn: () => irisGet(`/api/iris/schemes/${schemeCode}/performance`),
    enabled: !!schemeCode,
    retry: false,
  });

  const ratingsQuery = useQuery<{ success: boolean; data: { crisil?: string; valueResearch?: string; morningstar?: string; rating?: string } }>({
    queryKey: ["/api/iris/schemes", schemeCode, "ratings"],
    queryFn: () => irisGet(`/api/iris/schemes/${schemeCode}/ratings`),
    enabled: !!schemeCode,
    retry: false,
  });

  const fundManagerQuery = useQuery<{ success: boolean; data: { name?: string; experience?: string; schemesManaged?: number | string; qualification?: string } }>({
    queryKey: ["/api/iris/schemes", schemeCode, "fund-manager"],
    queryFn: () => irisGet(`/api/iris/schemes/${schemeCode}/fund-manager`),
    enabled: !!schemeCode,
    retry: false,
  });

  const holdingsQuery = useQuery<{ success: boolean; data: { holdings?: Array<{ stockName?: string; name?: string; percentage?: number; weight?: number }> } }>({
    queryKey: ["/api/iris/schemes", schemeCode, "holdings"],
    queryFn: () => irisGet(`/api/iris/schemes/${schemeCode}/holdings`),
    enabled: !!schemeCode,
    retry: false,
  });

  const factsheetQuery = useQuery<{ success: boolean; data: { downloadUrl?: string; url?: string; factsheetUrl?: string } }>({
    queryKey: ["/api/iris/schemes", schemeCode, "factsheet"],
    queryFn: () => irisGet(`/api/iris/schemes/${schemeCode}/factsheet`),
    enabled: !!schemeCode,
    retry: false,
  });

  const benchmarkQuery = useQuery<{ success: boolean; data: { benchmark?: string; benchmarkReturns?: { oneYear?: number; threeYear?: number; fiveYear?: number }; outperformance?: number } }>({
    queryKey: ["/api/iris/schemes", schemeCode, "benchmark"],
    queryFn: () => irisGet(`/api/iris/schemes/${schemeCode}/benchmark`),
    enabled: !!schemeCode,
    retry: false,
  });

  const categoriesQuery = useQuery<{ success: boolean; data: { categories?: string[] } | string[] }>({
    queryKey: ["/api/iris/categories"],
    retry: false,
  });

  const subcategoriesQuery = useQuery<{ success: boolean; data: { subcategories?: string[] } | string[] }>({
    queryKey: ["/api/iris/subcategories", browseCategory],
    queryFn: () => irisGet(`/api/iris/subcategories${browseCategory ? '?category=' + encodeURIComponent(browseCategory) : ''}`),
    enabled: !!browseCategory,
    retry: false,
  });

  const byCategoryQuery = useQuery<{ success: boolean; data: { schemes?: SchemeResult[] } | SchemeResult[] }>({
    queryKey: ["/api/iris/schemes/by-category", browseCategory, browseSubcategory, riskProfile],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (browseSubcategory && browseSubcategory !== 'ALL') params.subcategory = browseSubcategory;
      if (riskProfile && riskProfile !== 'ANY') params.riskProfile = riskProfile;
      const qs = '?' + new URLSearchParams({ category: browseCategory, ...params }).toString();
      return irisGet(`/api/iris/schemes/by-category${qs}`);
    },
    enabled: !!browseCategory,
    retry: false,
  });

  const compareQuery2 = useMutation({
    mutationFn: (schemeCodes: string[]) => apiRequest('/api/iris/schemes/compare', 'POST', { body: { schemeCodes } }),
  });

  const topPerformersQuery = useQuery<{ success: boolean; data: { schemes?: Array<{ schemeName?: string; schemeCode?: string; return1y?: number; oneYearReturn?: number; category?: string }> } }>({
    queryKey: ["/api/iris/schemes/top-performers", browseCategory],
    queryFn: () => irisGet(`/api/iris/schemes/top-performers${browseCategory ? '?category=' + encodeURIComponent(browseCategory) : ''}`),
    enabled: section === "browse" || section === "search",
    retry: false,
  });

  const riskRecommendationsQuery = useQuery<{ success: boolean; data: { schemes?: SchemeResult[] } | SchemeResult[] }>({
    queryKey: ["/api/iris/schemes/recommended", riskProfile],
    queryFn: () => irisGet(`/api/iris/schemes/recommended?riskProfile=${encodeURIComponent(riskProfile)}`),
    enabled: section === "browse" && !!riskProfile && riskProfile !== 'ANY',
    retry: false,
  });

  function resolveSchemes(d: { success: boolean; data: { schemes?: SchemeResult[] } | SchemeResult[] } | undefined): SchemeResult[] {
    if (!d?.data) return [];
    if (Array.isArray(d.data)) return d.data;
    return (d.data as { schemes?: SchemeResult[] }).schemes ?? [];
  }

  function resolveCategories(): string[] {
    if (!categoriesQuery.data?.data) return [];
    if (Array.isArray(categoriesQuery.data.data)) return categoriesQuery.data.data;
    return (categoriesQuery.data.data as { categories?: string[] }).categories ?? [];
  }

  function resolveSubcategories(): string[] {
    if (!subcategoriesQuery.data?.data) return [];
    if (Array.isArray(subcategoriesQuery.data.data)) return subcategoriesQuery.data.data;
    return (subcategoriesQuery.data.data as { subcategories?: string[] }).subcategories ?? [];
  }

  const searchResults = resolveSchemes(schemeSearchData.data);
  const compareSearchResults = resolveSchemes(compareSearchData.data);
  const categorySchemes = resolveSchemes(byCategoryQuery.data);
  const navHistory = navHistoryQuery.data?.data?.history ?? [];
  const topHoldings = (holdingsQuery.data?.data?.holdings ?? []).slice(0, 10);
  const perf = performanceQuery.data?.data;
  const ratings = ratingsQuery.data?.data;
  const fundManager = fundManagerQuery.data?.data;
  const benchmark = benchmarkQuery.data?.data;
  const factsheetUrl = factsheetQuery.data?.data?.downloadUrl ?? factsheetQuery.data?.data?.url ?? factsheetQuery.data?.data?.factsheetUrl;
  const compareResult = compareQuery2.data as { data?: { schemes?: Array<{ schemeName?: string; schemeCode?: string; returns?: { oneYear?: number; threeYear?: number; fiveYear?: number }; stdDeviation?: number; sharpe?: number; expenseRatio?: number; crisil?: string }> } } | undefined;

  const NAV_PERIODS = ["7D", "1M", "3M", "1Y", "3Y"];

  return (
    <div className="space-y-4">
      {/* Section tabs */}
      <div className="flex gap-2 flex-wrap">
        {([
          { key: "search", label: "Scheme Detail", icon: Search },
          { key: "compare", label: "Compare Schemes", icon: Layers },
          { key: "browse", label: "Category Browser", icon: BookOpen },
        ] as { key: ResearchSection; label: string; icon: React.ComponentType<{ className?: string }> }[]).map(({ key, label, icon: Icon }) => (
          <Button key={key} size="sm" variant={section === key ? "default" : "outline"} onClick={() => setSection(key)}>
            <Icon className="h-4 w-4 mr-1" />{label}
          </Button>
        ))}
      </div>

      {/* ── Scheme Detail ─────────────────────────────────────────────────────── */}
      {section === "search" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Search Scheme</CardTitle></CardHeader>
            <CardContent>
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Type scheme name (min 2 chars)…"
                  value={selectedScheme ? (selectedScheme.schemeName ?? selectedScheme.name ?? "") : schemeQuery}
                  onChange={e => { setSchemeQuery(e.target.value); setSelectedScheme(null); }}
                />
              </div>
              {schemeQuery.length >= 2 && !selectedScheme && (
                <div className="border rounded-md mt-2 max-h-48 overflow-y-auto bg-background shadow-md">
                  {schemeSearchData.isLoading ? (
                    <p className="p-2 text-xs text-muted-foreground">Searching…</p>
                  ) : searchResults.length > 0 ? (
                    searchResults.slice(0, 12).map((s, i) => (
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
            </CardContent>
          </Card>

          {selectedScheme && (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">{selectedScheme.schemeCode ?? selectedScheme.isinCode ?? selectedScheme.code}</Badge>
                <span className="font-medium text-sm">{selectedScheme.schemeName ?? selectedScheme.name}</span>
                <button className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-0.5"
                  onClick={() => { setSelectedScheme(null); setSchemeQuery(""); }}>
                  <XCircle className="h-3.5 w-3.5" /> Clear
                </button>
                {factsheetUrl && (
                  <a href={factsheetUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline"><Download className="h-3.5 w-3.5 mr-1" /> Factsheet PDF</Button>
                  </a>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Performance metrics */}
                <Card>
                  <CardHeader><CardTitle className="text-sm">Performance</CardTitle></CardHeader>
                  <CardContent>
                    {performanceQuery.isLoading ? <Skeleton className="h-24 w-full" /> : (
                      <div className="space-y-2 text-sm">
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { label: "1Y", val: perf?.returns?.oneYear },
                            { label: "3Y", val: perf?.returns?.threeYear },
                            { label: "5Y", val: perf?.returns?.fiveYear },
                          ].map(({ label, val }) => (
                            <div key={label} className="bg-muted rounded p-2 text-center">
                              <p className="text-xs text-muted-foreground">{label}</p>
                              <p className={`font-semibold ${(val ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {val != null ? `${val.toFixed(2)}%` : '—'}
                              </p>
                            </div>
                          ))}
                        </div>
                        {perf?.expenseRatio != null && <p className="text-xs text-muted-foreground">Expense Ratio: <span className="font-medium text-foreground">{perf.expenseRatio.toFixed(2)}%</span></p>}
                        {perf?.stdDeviation != null && <p className="text-xs text-muted-foreground">Std Dev: <span className="font-medium text-foreground">{perf.stdDeviation.toFixed(2)}</span></p>}
                        {perf?.sharpe != null && <p className="text-xs text-muted-foreground">Sharpe: <span className="font-medium text-foreground">{perf.sharpe.toFixed(2)}</span></p>}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Ratings */}
                <Card>
                  <CardHeader><CardTitle className="text-sm">Ratings</CardTitle></CardHeader>
                  <CardContent>
                    {ratingsQuery.isLoading ? <Skeleton className="h-16 w-full" /> : (
                      <div className="space-y-2 text-sm">
                        {ratings?.crisil && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">CRISIL</span>
                            <Badge variant="outline" className="flex items-center gap-1"><Star className="h-3 w-3" />{ratings.crisil}</Badge>
                          </div>
                        )}
                        {ratings?.valueResearch && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Value Research</span>
                            <Badge variant="outline">{ratings.valueResearch}</Badge>
                          </div>
                        )}
                        {ratings?.morningstar && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Morningstar</span>
                            <Badge variant="outline">{ratings.morningstar}</Badge>
                          </div>
                        )}
                        {!ratings?.crisil && !ratings?.valueResearch && !ratings?.morningstar && (
                          <p className="text-xs text-muted-foreground">Ratings unavailable</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Fund Manager */}
                <Card>
                  <CardHeader><CardTitle className="text-sm flex items-center gap-1"><User className="h-4 w-4" /> Fund Manager</CardTitle></CardHeader>
                  <CardContent>
                    {fundManagerQuery.isLoading ? <Skeleton className="h-16 w-full" /> : fundManager?.name ? (
                      <div className="space-y-1 text-sm">
                        <p className="font-medium">{fundManager.name}</p>
                        {fundManager.experience && <p className="text-xs text-muted-foreground">Experience: {fundManager.experience}</p>}
                        {fundManager.qualification && <p className="text-xs text-muted-foreground">{fundManager.qualification}</p>}
                        {fundManager.schemesManaged != null && <p className="text-xs text-muted-foreground">Schemes managed: {fundManager.schemesManaged}</p>}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Fund manager info unavailable</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Benchmark Comparison */}
              {(benchmarkQuery.data?.data?.benchmark || benchmarkQuery.data?.data?.benchmarkReturns) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Benchmark Comparison</CardTitle>
                    {benchmark?.benchmark && <CardDescription>{benchmark.benchmark}</CardDescription>}
                  </CardHeader>
                  <CardContent>
                    {benchmarkQuery.isLoading ? <Skeleton className="h-16 w-full" /> : (
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: "1Y", scheme: perf?.returns?.oneYear, bench: benchmark?.benchmarkReturns?.oneYear },
                          { label: "3Y", scheme: perf?.returns?.threeYear, bench: benchmark?.benchmarkReturns?.threeYear },
                          { label: "5Y", scheme: perf?.returns?.fiveYear, bench: benchmark?.benchmarkReturns?.fiveYear },
                        ].map(({ label, scheme, bench }) => (
                          <div key={label} className="bg-muted rounded p-3">
                            <p className="text-xs font-medium mb-1">{label} Return</p>
                            <div className="flex justify-between text-xs">
                              <span>Fund: <span className={`font-medium ${(scheme ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>{scheme != null ? `${scheme.toFixed(2)}%` : '—'}</span></span>
                              <span>Index: <span className="font-medium">{bench != null ? `${bench.toFixed(2)}%` : '—'}</span></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* NAV History */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-sm">NAV History</CardTitle>
                    <div className="flex gap-1">
                      {NAV_PERIODS.map(p => (
                        <Button key={p} size="sm" variant={navPeriod === p ? "default" : "outline"} className="h-7 px-2 text-xs"
                          onClick={() => setNavPeriod(p)}>{p}</Button>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {navHistoryQuery.isLoading ? <Skeleton className="h-40 w-full" /> : navHistory.length > 0 ? (
                    <div className="overflow-x-auto">
                      <div className="relative h-36 bg-muted/30 rounded">
                        {/* Simple sparkline using SVG */}
                        {(() => {
                          const navs = navHistory.map(d => d.nav);
                          const minNav = Math.min(...navs);
                          const maxNav = Math.max(...navs);
                          const range = maxNav - minNav || 1;
                          const w = 100;
                          const h = 100;
                          const points = navs.map((n, i) => `${(i / (navs.length - 1)) * w},${h - ((n - minNav) / range) * h}`).join(' ');
                          const isPositive = navs[navs.length - 1] >= navs[0];
                          return (
                            <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full p-2">
                              <polyline fill="none" stroke={isPositive ? '#16a34a' : '#dc2626'} strokeWidth="1.5" points={points} />
                            </svg>
                          );
                        })()}
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>{navHistory[0]?.date}</span>
                        <span className="font-medium">NAV: ₹{navHistory[navHistory.length - 1]?.nav?.toFixed(2)}</span>
                        <span>{navHistory[navHistory.length - 1]?.date}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">NAV history unavailable for this period.</p>
                  )}
                </CardContent>
              </Card>

              {/* Top Holdings */}
              {topHoldings.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Top 10 Portfolio Holdings</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead className="border-b">
                        <tr>
                          <th className="text-left p-3 font-medium">#</th>
                          <th className="text-left p-3 font-medium">Stock / Security</th>
                          <th className="text-right p-3 font-medium">Weight %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topHoldings.map((h, i) => (
                          <tr key={i} className="border-b hover:bg-muted/50">
                            <td className="p-3 text-muted-foreground">{i + 1}</td>
                            <td className="p-3">{h.stockName ?? h.name ?? '—'}</td>
                            <td className="p-3 text-right">{h.percentage != null ? `${h.percentage.toFixed(2)}%` : h.weight != null ? `${h.weight.toFixed(2)}%` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Top Performer Rankings */}
          {(() => {
            const topPerformers = topPerformersQuery.data?.data?.schemes ?? [];
            return topPerformers.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-1"><TrendingUp className="h-4 w-4 text-primary" /> Top Performing Schemes</CardTitle>
                  <CardDescription>Ranked by 1-year return across all categories</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead className="border-b">
                      <tr>
                        <th className="text-left p-3 font-medium">Rank</th>
                        <th className="text-left p-3 font-medium">Scheme</th>
                        <th className="text-left p-3 font-medium">Category</th>
                        <th className="text-right p-3 font-medium">1Y Return</th>
                        <th className="p-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {topPerformers.slice(0, 10).map((s, i) => (
                        <tr key={i} className="border-b hover:bg-muted/50">
                          <td className="p-3 font-medium text-muted-foreground">{i + 1}</td>
                          <td className="p-3 max-w-[200px] truncate">{s.schemeName ?? '—'}</td>
                          <td className="p-3 text-muted-foreground">{s.category ?? '—'}</td>
                          <td className={`p-3 text-right font-medium ${((s.return1y ?? s.oneYearReturn) ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {(s.return1y ?? s.oneYearReturn) != null ? `${(s.return1y ?? s.oneYearReturn)!.toFixed(2)}%` : '—'}
                          </td>
                          <td className="p-3 text-right">
                            <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2"
                              onClick={() => {
                                const sr: SchemeResult = { schemeCode: s.schemeCode, schemeName: s.schemeName };
                                setSelectedScheme(sr);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}>
                              View
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            ) : null;
          })()}
        </div>
      )}

      {/* ── Compare Schemes ───────────────────────────────────────────────────── */}
      {section === "compare" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Compare up to 3 Schemes</CardTitle>
              <CardDescription>Add schemes using the search box below. Side-by-side returns, risk, ratings and expense ratio.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2 flex-wrap items-center">
                {compareList.map((s, i) => (
                  <Badge key={i} variant="secondary" className="flex items-center gap-1 text-xs">
                    <span>{s.schemeName ?? s.name}</span>
                    <button onClick={() => setCompareList(l => l.filter((_, j) => j !== i))}>
                      <Trash2 className="h-3 w-3 ml-1 text-muted-foreground hover:text-destructive" />
                    </button>
                  </Badge>
                ))}
                {compareList.length < 3 && (
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      className="pl-7 h-7 text-xs w-52"
                      placeholder="Add scheme…"
                      value={compareQuery}
                      onChange={e => setCompareQuery(e.target.value)}
                    />
                    {compareQuery.length >= 2 && compareSearchResults.length > 0 && (
                      <div className="absolute z-20 border rounded-md mt-1 max-h-48 overflow-y-auto bg-background shadow-md w-80">
                        {compareSearchResults.slice(0, 8).map((s, i) => (
                          <button key={i} className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50"
                            onClick={() => {
                              if (!compareList.find(c => (c.schemeCode ?? c.code) === (s.schemeCode ?? s.code))) {
                                setCompareList(l => [...l, s]);
                              }
                              setCompareQuery("");
                            }}>
                            {s.schemeName ?? s.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <Button
                  size="sm"
                  disabled={compareList.length < 2 || compareQuery2.isPending}
                  onClick={() => compareQuery2.mutate(compareList.map(s => s.schemeCode ?? s.isinCode ?? s.code ?? ""))}
                >
                  {compareQuery2.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : <Layers className="h-4 w-4 mr-1" />}
                  Compare
                </Button>
              </div>
            </CardContent>
          </Card>

          {compareResult?.data?.schemes && compareResult.data.schemes.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Comparison Result</CardTitle></CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead className="border-b bg-muted/50">
                      <tr>
                        <th className="text-left p-3 font-medium">Metric</th>
                        {compareResult.data.schemes.map((s, i) => (
                          <th key={i} className="text-right p-3 font-medium max-w-[150px]">{s.schemeName ?? `Scheme ${i + 1}`}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: "1Y Return", fn: (s: typeof compareResult.data.schemes[0]) => s.returns?.oneYear != null ? `${s.returns.oneYear.toFixed(2)}%` : '—' },
                        { label: "3Y Return", fn: (s: typeof compareResult.data.schemes[0]) => s.returns?.threeYear != null ? `${s.returns.threeYear.toFixed(2)}%` : '—' },
                        { label: "5Y Return", fn: (s: typeof compareResult.data.schemes[0]) => s.returns?.fiveYear != null ? `${s.returns.fiveYear.toFixed(2)}%` : '—' },
                        { label: "Std Deviation", fn: (s: typeof compareResult.data.schemes[0]) => s.stdDeviation != null ? s.stdDeviation.toFixed(2) : '—' },
                        { label: "Sharpe Ratio", fn: (s: typeof compareResult.data.schemes[0]) => s.sharpe != null ? s.sharpe.toFixed(2) : '—' },
                        { label: "Expense Ratio", fn: (s: typeof compareResult.data.schemes[0]) => s.expenseRatio != null ? `${s.expenseRatio.toFixed(2)}%` : '—' },
                        { label: "CRISIL Rating", fn: (s: typeof compareResult.data.schemes[0]) => s.crisil ?? '—' },
                      ].map(({ label, fn }) => (
                        <tr key={label} className="border-b hover:bg-muted/50">
                          <td className="p-3 font-medium text-muted-foreground">{label}</td>
                          {compareResult!.data!.schemes!.map((s, i) => (
                            <td key={i} className="p-3 text-right">{fn(s)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Category Browser ──────────────────────────────────────────────────── */}
      {section === "browse" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Browse by Category</CardTitle>
              <CardDescription>Filter schemes by category and sub-category. Set a risk profile for recommendations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label>Category</Label>
                  <Select value={browseCategory} onValueChange={c => { setBrowseCategory(c); setBrowseSubcategory("ALL"); }}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {resolveCategories().length > 0
                        ? resolveCategories().map((c, i) => <SelectItem key={i} value={c}>{c}</SelectItem>)
                        : ["Equity", "Debt", "Hybrid", "Liquid", "Solution Oriented"].map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))
                      }
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Sub-Category</Label>
                  <Select value={browseSubcategory} onValueChange={setBrowseSubcategory} disabled={!browseCategory}>
                    <SelectTrigger><SelectValue placeholder="All sub-categories" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Sub-Categories</SelectItem>
                      {resolveSubcategories().map((s, i) => <SelectItem key={i} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Risk Profile Filter</Label>
                  <Select value={riskProfile} onValueChange={setRiskProfile}>
                    <SelectTrigger><SelectValue placeholder="Any risk profile" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ANY">Any Risk Profile</SelectItem>
                      {["Conservative", "Moderate", "Aggressive", "Very Aggressive"].map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {browseCategory && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{browseCategory} Schemes{browseSubcategory ? ` — ${browseSubcategory}` : ''}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {byCategoryQuery.isLoading ? (
                  <div className="p-4 space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : categorySchemes.length > 0 ? (
                  <ScrollArea className="h-80">
                    <div className="divide-y">
                      {categorySchemes.map((s, i) => (
                        <div key={i} className="p-3 flex items-center justify-between hover:bg-muted/50">
                          <div>
                            <p className="text-sm font-medium">{s.schemeName ?? s.name}</p>
                            <p className="text-xs text-muted-foreground">{s.schemeCode ?? s.isinCode ?? s.code}</p>
                          </div>
                          <Button size="sm" variant="outline" className="h-7 text-xs"
                            onClick={() => { setSelectedScheme(s); setSection("search"); }}>
                            View Details
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="p-4 text-sm text-muted-foreground">No schemes found for the selected filters.</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Risk Profile Recommendations Panel */}
          {riskProfile !== 'ANY' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-1">
                  <Star className="h-4 w-4 text-amber-500" /> Recommended for {riskProfile} Profile
                </CardTitle>
                <CardDescription>Schemes curated for a {riskProfile.toLowerCase()} risk investor</CardDescription>
              </CardHeader>
              <CardContent>
                {riskRecommendationsQuery.isLoading ? (
                  <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : (() => {
                  const recs = resolveSchemes(riskRecommendationsQuery.data);
                  return recs.length > 0 ? (
                    <div className="divide-y">
                      {recs.slice(0, 8).map((s, i) => (
                        <div key={i} className="p-3 flex items-center justify-between hover:bg-muted/50">
                          <div>
                            <p className="text-sm font-medium">{s.schemeName ?? s.name}</p>
                            <p className="text-xs text-muted-foreground">{s.schemeCode ?? s.isinCode ?? s.code}</p>
                          </div>
                          <Button size="sm" variant="outline" className="h-7 text-xs"
                            onClick={() => { setSelectedScheme(s); setSection("search"); }}>
                            View Details
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No recommendations available for this risk profile.</p>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ─── CAS Import & External Portfolio Tab ─────────────────────────────────────
function CasImportTab() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [casPan, setCasPan] = useState('');
  const [casSubmittedPan, setCasSubmittedPan] = useState('');
  const [genEmail, setGenEmail] = useState('');
  const [genEmailDialogOpen, setGenEmailDialogOpen] = useState(false);

  const casQuery = useQuery<{ success: boolean; data: { holdings?: CasHolding[]; summary?: CasSummary } }>({
    queryKey: ['/api/iris/portfolio/cas-fetch', casSubmittedPan],
    enabled: !!casSubmittedPan,
  });

  const importMutation = useMutation({
    mutationFn: () => apiRequest('/api/iris/portfolio/import', 'POST', { body: {
      pan: casSubmittedPan,
      holdings: casQuery.data?.data?.holdings ?? [],
    }}),
    onSuccess: () => {
      toast({ title: 'Portfolio imported', description: `Holdings for ${casSubmittedPan} saved to IRIS.` });
      qc.invalidateQueries({ queryKey: ['/api/iris/portfolio/external', casSubmittedPan] });
    },
    onError: (e: Error) => toast({ title: 'Import failed', description: e.message, variant: 'destructive' }),
  });

  const generateCasMutation = useMutation({
    mutationFn: () => apiRequest('/api/iris/reports/cas/generate', 'POST', { body: {
      pan: casSubmittedPan,
      email: genEmail || undefined,
    }}),
    onSuccess: () => {
      toast({ title: 'CAS statement generated', description: genEmail ? `Sent to ${genEmail}` : 'Available for download.' });
      setGenEmailDialogOpen(false);
    },
    onError: (e: Error) => toast({ title: 'Generation failed', description: e.message, variant: 'destructive' }),
  });

  const [extPan, setExtPan] = useState('');
  const [extSubmittedPan, setExtSubmittedPan] = useState('');
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkFolioNo, setLinkFolioNo] = useState('');
  const [linkRegistrar, setLinkRegistrar] = useState('KFINTECH');

  const extQuery = useQuery<{ success: boolean; data: { folios?: ExternalFolio[] } }>({
    queryKey: ['/api/iris/portfolio/external', extSubmittedPan],
    enabled: !!extSubmittedPan,
  });

  const refreshMutation = useMutation({
    mutationFn: (pan: string) => apiRequest(`/api/iris/portfolio/external/${pan}/refresh`, 'POST', { body: {} }),
    onSuccess: (_d, pan) => {
      toast({ title: 'Refreshed', description: `External portfolio refreshed for ${pan}.` });
      qc.invalidateQueries({ queryKey: ['/api/iris/portfolio/external', pan] });
    },
    onError: (e: Error) => toast({ title: 'Refresh failed', description: e.message, variant: 'destructive' }),
  });

  const unlinkMutation = useMutation({
    mutationFn: (folioNo: string) => apiRequest(`/api/iris/portfolio/external/${folioNo}`, 'DELETE'),
    onSuccess: () => {
      toast({ title: 'Folio unlinked' });
      qc.invalidateQueries({ queryKey: ['/api/iris/portfolio/external', extSubmittedPan] });
    },
    onError: (e: Error) => toast({ title: 'Unlink failed', description: e.message, variant: 'destructive' }),
  });

  const linkMutation = useMutation({
    mutationFn: () => apiRequest('/api/iris/portfolio/external/link', 'POST', { body: {
      pan: extSubmittedPan,
      folioNo: linkFolioNo,
      registrar: linkRegistrar,
    }}),
    onSuccess: () => {
      toast({ title: 'Folio linked' });
      qc.invalidateQueries({ queryKey: ['/api/iris/portfolio/external', extSubmittedPan] });
      setLinkDialogOpen(false);
      setLinkFolioNo('');
    },
    onError: (e: Error) => toast({ title: 'Link failed', description: e.message, variant: 'destructive' }),
  });

  const casHoldings: CasHolding[] = casQuery.data?.data?.holdings ?? [];
  const casSummary: CasSummary | undefined = casQuery.data?.data?.summary;
  const extFolios: ExternalFolio[] = extQuery.data?.data?.folios ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CloudDownload className="h-5 w-5 text-blue-500" />
            Fetch CAS from KFintech Registry
          </CardTitle>
          <CardDescription>
            Pull a client's complete MF portfolio directly from KFintech by PAN — no PDF upload needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input placeholder="PAN (e.g. ABCDE1234F)" value={casPan} onChange={e => setCasPan(e.target.value.toUpperCase())} className="max-w-xs" />
            <Button onClick={() => setCasSubmittedPan(casPan.trim())} disabled={casPan.length < 10 || casQuery.isFetching}>
              {casQuery.isFetching ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
              Fetch from Registry
            </Button>
          </div>

          {casQuery.isError && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" /> Could not fetch CAS data — check PAN or IRIS credentials.
            </div>
          )}

          {casHoldings.length > 0 && (
            <>
              {casSummary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                  {[
                    { label: 'Current Value', val: casSummary.currentValue },
                    { label: 'Invested', val: casSummary.investedValue },
                    { label: 'Gain/Loss', val: casSummary.gainLoss },
                    { label: 'XIRR', val: casSummary.xirr ? `${casSummary.xirr.toFixed(2)}%` : undefined },
                  ].map(item => (
                    <div key={item.label} className="bg-muted rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="font-semibold text-sm">
                        {item.val !== undefined
                          ? typeof item.val === 'string' ? item.val : `₹${Number(item.val).toLocaleString('en-IN')}`
                          : '—'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <ScrollArea className="h-64 border rounded-md">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background border-b">
                    <tr>
                      <th className="text-left p-2 font-medium">Scheme</th>
                      <th className="text-right p-2 font-medium">Units</th>
                      <th className="text-right p-2 font-medium">Current Value</th>
                      <th className="text-right p-2 font-medium">Gain %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {casHoldings.map((h, i) => (
                      <tr key={i} className="border-b hover:bg-muted/50">
                        <td className="p-2">{h.schemeName ?? h.scheme ?? '—'}</td>
                        <td className="p-2 text-right">{h.units?.toFixed(3) ?? '—'}</td>
                        <td className="p-2 text-right">
                          {h.currentValue !== undefined ? `₹${Number(h.currentValue).toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className={`p-2 text-right ${(h.gainLossPercentage ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {h.gainLossPercentage !== undefined ? `${h.gainLossPercentage.toFixed(2)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
              <div className="flex gap-2 flex-wrap">
                <Button onClick={() => importMutation.mutate()} disabled={importMutation.isPending}>
                  {importMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : <Inbox className="h-4 w-4 mr-1" />}
                  Import All to IRIS Portfolio
                </Button>
                <Button variant="outline" onClick={() => setGenEmailDialogOpen(true)}>
                  <Send className="h-4 w-4 mr-1" /> Generate CAS Statement
                </Button>
              </div>
            </>
          )}

          {casSubmittedPan && !casQuery.isFetching && casHoldings.length === 0 && !casQuery.isError && (
            <p className="text-sm text-muted-foreground">No holdings found for PAN {casSubmittedPan}.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={genEmailDialogOpen} onOpenChange={setGenEmailDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Generate CAS Statement</DialogTitle>
            <DialogDescription>Generate the Consolidated Account Statement for {casSubmittedPan}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Send to Email (optional)</Label>
              <Input placeholder="investor@email.com" value={genEmail} onChange={e => setGenEmail(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setGenEmailDialogOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={() => generateCasMutation.mutate()} disabled={generateCasMutation.isPending}>
                {generateCasMutation.isPending ? 'Generating…' : 'Generate'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-emerald-500" />
            External Portfolio (Cross-Registrar)
          </CardTitle>
          <CardDescription>
            View and manage externally linked folios for an investor — covers both CAMS and KFintech registrars.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Input placeholder="Investor PAN" value={extPan} onChange={e => setExtPan(e.target.value.toUpperCase())} className="max-w-xs" />
            <Button onClick={() => setExtSubmittedPan(extPan.trim())} disabled={extPan.length < 10 || extQuery.isFetching}>
              {extQuery.isFetching ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
              Load External Portfolio
            </Button>
            {extSubmittedPan && (
              <>
                <Button variant="outline" onClick={() => refreshMutation.mutate(extSubmittedPan)} disabled={refreshMutation.isPending}>
                  <RefreshCw className={`h-4 w-4 mr-1 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
                  Refresh All
                </Button>
                <Button variant="outline" onClick={() => setLinkDialogOpen(true)}>
                  <Link2 className="h-4 w-4 mr-1" /> Link Folio
                </Button>
              </>
            )}
          </div>

          {extQuery.isError && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" /> Could not load external portfolio.
            </div>
          )}

          {extFolios.length > 0 && (
            <ScrollArea className="h-64 border rounded-md">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background border-b">
                  <tr>
                    <th className="text-left p-2 font-medium">Folio No</th>
                    <th className="text-left p-2 font-medium">Registrar</th>
                    <th className="text-left p-2 font-medium">AMC</th>
                    <th className="text-right p-2 font-medium">Schemes</th>
                    <th className="text-right p-2 font-medium">Current Value</th>
                    <th className="text-right p-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {extFolios.map((f, i) => (
                    <tr key={i} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-mono text-xs">{f.folioNo ?? '—'}</td>
                      <td className="p-2"><Badge variant="outline" className="text-xs">{f.registrar ?? 'KFINTECH'}</Badge></td>
                      <td className="p-2">{f.amcName ?? f.amc ?? '—'}</td>
                      <td className="p-2 text-right">{f.schemeCount ?? '—'}</td>
                      <td className="p-2 text-right">
                        {f.currentValue !== undefined ? `₹${Number(f.currentValue).toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="p-2 text-right">
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive h-7 px-2"
                          onClick={() => f.folioNo && unlinkMutation.mutate(f.folioNo)}
                          disabled={unlinkMutation.isPending}>
                          <Unlink className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          )}

          {extSubmittedPan && !extQuery.isFetching && extFolios.length === 0 && !extQuery.isError && (
            <p className="text-sm text-muted-foreground">
              No external folios linked for {extSubmittedPan}. Use "Link Folio" to add one, or import via CAS fetch above.
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Link External Folio</DialogTitle>
            <DialogDescription>Manually link a folio from CAMS or KFintech to investor {extSubmittedPan}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Folio Number</Label>
              <Input placeholder="e.g. 1234567/89" value={linkFolioNo} onChange={e => setLinkFolioNo(e.target.value)} />
            </div>
            <div>
              <Label>Registrar</Label>
              <Select value={linkRegistrar} onValueChange={setLinkRegistrar}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="KFINTECH">KFintech</SelectItem>
                  <SelectItem value="CAMS">CAMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setLinkDialogOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={() => linkMutation.mutate()} disabled={linkMutation.isPending || !linkFolioNo.trim()}>
                {linkMutation.isPending ? 'Linking…' : 'Link Folio'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Mandates Tab ─────────────────────────────────────────────────────────────

interface EnachMandate {
  mandateId?: string;
  id?: string;
  bankName?: string;
  bank?: string;
  accountNumber?: string;
  accountNo?: string;
  ifscCode?: string;
  ifsc?: string;
  maxAmount?: number;
  amount?: number;
  frequency?: string;
  status?: string;
}

interface UpiMandate {
  umrn?: string;
  id?: string;
  upiId?: string;
  vpa?: string;
  maxAmount?: number;
  amount?: number;
  frequency?: string;
  status?: string;
}

interface PhysicalMandate {
  mandateId?: string;
  id?: string;
  bankName?: string;
  bank?: string;
  accountNumber?: string;
  status?: string;
  uploadedAt?: string;
  createdAt?: string;
}

function mandateStatusVariant(status?: string): "default" | "secondary" | "destructive" | "outline" {
  if (!status) return "outline";
  const s = status.toUpperCase();
  if (s === "ACTIVE" || s === "APPROVED") return "default";
  if (s === "PENDING" || s === "REGISTERED") return "secondary";
  if (s === "CANCELLED" || s === "REJECTED" || s === "FAILED") return "destructive";
  return "outline";
}

function MandatesTab() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── Shared PAN search ──────────────────────────────────────────────────────
  const [pan, setPan] = useState("");
  const [submittedPan, setSubmittedPan] = useState("");

  // ── eNACH ─────────────────────────────────────────────────────────────────
  const [createEnachOpen, setCreateEnachOpen] = useState(false);
  const [enachBank, setEnachBank] = useState("");
  const [enachIfsc, setEnachIfsc] = useState("");
  const [enachAccount, setEnachAccount] = useState("");
  const [enachAmount, setEnachAmount] = useState("");
  const [enachFreq, setEnachFreq] = useState("MONTHLY");
  const [cancelEnachId, setCancelEnachId] = useState<string | null>(null);

  const enachQuery = useQuery<{ success: boolean; data: { mandates?: EnachMandate[] } | EnachMandate[] }>({
    queryKey: ["/api/iris/enach", submittedPan],
    queryFn: () => irisGet(`/api/iris/enach?pan=${encodeURIComponent(submittedPan)}`),
    enabled: !!submittedPan,
    retry: false,
  });

  const createEnach = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiRequest("/api/iris/enach/create", "POST", { body }),
    onSuccess: () => {
      toast({ title: "eNACH mandate created successfully" });
      setCreateEnachOpen(false);
      setEnachBank(""); setEnachIfsc(""); setEnachAccount(""); setEnachAmount("");
      qc.invalidateQueries({ queryKey: ["/api/iris/enach", submittedPan] });
    },
    onError: (e: Error) => toast({ title: "Failed to create eNACH", description: e.message, variant: "destructive" }),
  });

  const cancelEnach = useMutation({
    mutationFn: (mandateId: string) => apiRequest(`/api/iris/enach/${mandateId}/cancel`, "POST"),
    onSuccess: () => {
      toast({ title: "eNACH mandate cancelled" });
      setCancelEnachId(null);
      qc.invalidateQueries({ queryKey: ["/api/iris/enach", submittedPan] });
    },
    onError: (e: Error) => toast({ title: "Failed to cancel eNACH", description: e.message, variant: "destructive" }),
  });

  const regenEnachLink = useMutation({
    mutationFn: (mandateId: string) => apiRequest(`/api/iris/enach/${mandateId}/regenerate-link`, "POST"),
    onSuccess: () => toast({ title: "eSign link regenerated and sent" }),
    onError: (e: Error) => toast({ title: "Failed to regenerate link", description: e.message, variant: "destructive" }),
  });

  function resolveEnachMandates(): EnachMandate[] {
    const d = enachQuery.data?.data;
    if (!d) return [];
    if (Array.isArray(d)) return d;
    return d.mandates ?? [];
  }

  // ── UPI Autopay ───────────────────────────────────────────────────────────
  const [createUpiOpen, setCreateUpiOpen] = useState(false);
  const [upiId, setUpiId] = useState("");
  const [upiAmount, setUpiAmount] = useState("");
  const [upiFreq, setUpiFreq] = useState("MONTHLY");
  const [cancelUpiUmrn, setCancelUpiUmrn] = useState<string | null>(null);

  const upiQuery = useQuery<{ success: boolean; data: { mandates?: UpiMandate[] } | UpiMandate[] }>({
    queryKey: ["/api/iris/mandates/upi", submittedPan],
    queryFn: () => irisGet(`/api/iris/mandates/upi?pan=${encodeURIComponent(submittedPan)}`),
    enabled: !!submittedPan,
    retry: false,
  });

  const createUpi = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiRequest("/api/iris/mandates/upi", "POST", { body }),
    onSuccess: () => {
      toast({ title: "UPI autopay mandate created" });
      setCreateUpiOpen(false);
      setUpiId(""); setUpiAmount("");
      qc.invalidateQueries({ queryKey: ["/api/iris/mandates/upi", submittedPan] });
    },
    onError: (e: Error) => toast({ title: "Failed to create UPI mandate", description: e.message, variant: "destructive" }),
  });

  const cancelUpi = useMutation({
    mutationFn: (umrn: string) => apiRequest(`/api/iris/mandates/upi/${umrn}/cancel`, "POST"),
    onSuccess: () => {
      toast({ title: "UPI mandate cancelled" });
      setCancelUpiUmrn(null);
      qc.invalidateQueries({ queryKey: ["/api/iris/mandates/upi", submittedPan] });
    },
    onError: (e: Error) => toast({ title: "Failed to cancel UPI mandate", description: e.message, variant: "destructive" }),
  });

  function resolveUpiMandates(): UpiMandate[] {
    const d = upiQuery.data?.data;
    if (!d) return [];
    if (Array.isArray(d)) return d;
    return d.mandates ?? [];
  }

  // ── Physical NACH ─────────────────────────────────────────────────────────
  const [physFile, setPhysFile] = useState<File | null>(null);
  const [physBank, setPhysBank] = useState("");
  const [physAccount, setPhysAccount] = useState("");
  const [physIfsc, setPhysIfsc] = useState("");
  const [physDragging, setPhysDragging] = useState(false);

  const physQuery = useQuery<{ success: boolean; data: { mandates?: PhysicalMandate[] } | PhysicalMandate[] }>({
    queryKey: ["/api/iris/mandates/physical", submittedPan],
    queryFn: () => irisGet(`/api/iris/mandates/physical?pan=${encodeURIComponent(submittedPan)}`),
    enabled: !!submittedPan,
    retry: false,
  });

  const uploadPhys = useMutation({
    mutationFn: async () => {
      if (!physFile) throw new Error("No file selected");
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1] ?? result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(physFile);
      });
      return apiRequest("/api/iris/mandates/physical", "POST", {
        body: {
          pan: submittedPan,
          bankName: physBank,
          accountNumber: physAccount,
          ifscCode: physIfsc,
          fileName: physFile.name,
          fileContent: base64,
          mimeType: physFile.type,
        },
      });
    },
    onSuccess: () => {
      toast({ title: "Physical NACH mandate uploaded" });
      setPhysFile(null); setPhysBank(""); setPhysAccount(""); setPhysIfsc("");
      qc.invalidateQueries({ queryKey: ["/api/iris/mandates/physical", submittedPan] });
    },
    onError: (e: Error) => toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
  });

  function resolvePhysMandates(): PhysicalMandate[] {
    const d = physQuery.data?.data;
    if (!d) return [];
    if (Array.isArray(d)) return d;
    return d.mandates ?? [];
  }

  const enachMandates = resolveEnachMandates();
  const upiMandates = resolveUpiMandates();
  const physMandates = resolvePhysMandates();

  return (
    <div className="space-y-6">
      {/* PAN Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mandate Management</CardTitle>
          <CardDescription>Enter investor PAN to view and manage all mandates (eNACH, UPI Autopay, Physical NACH)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Investor PAN (e.g. ABCDE1234F)"
                className="pl-9"
                value={pan}
                onChange={e => setPan(e.target.value.toUpperCase())}
                maxLength={10}
              />
            </div>
            <Button
              onClick={() => setSubmittedPan(pan.trim())}
              disabled={pan.length < 10}
            >
              <Search className="h-4 w-4 mr-1" /> Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── eNACH Section ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-sm font-semibold">eNACH Mandates</CardTitle>
            <CardDescription>Electronic NACH bank mandates for SIP auto-debit</CardDescription>
          </div>
          {submittedPan && (
            <Button size="sm" onClick={() => setCreateEnachOpen(true)}>
              + Create eNACH
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {!submittedPan ? (
            <p className="text-sm text-muted-foreground">Enter PAN above to load mandates</p>
          ) : enachQuery.isLoading ? (
            <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : enachMandates.length > 0 ? (
            <div className="divide-y rounded-md border">
              {enachMandates.map((m, i) => {
                const id = m.mandateId ?? m.id ?? "";
                return (
                  <div key={i} className="p-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium font-mono">{id || "—"}</span>
                        <Badge variant={mandateStatusVariant(m.status)} className="text-[10px] h-4">
                          {m.status ?? "Unknown"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {m.bankName ?? m.bank ?? "—"} · {m.accountNumber ?? m.accountNo ?? "—"} · {m.ifscCode ?? m.ifsc ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Max: {m.maxAmount != null ? fmt(m.maxAmount) : m.amount != null ? fmt(m.amount) : "—"} · {m.frequency ?? "—"}
                      </p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      {m.status?.toUpperCase() === "PENDING" && id && (
                        <Button size="sm" variant="outline" className="h-7 text-xs px-2"
                          disabled={regenEnachLink.isPending}
                          onClick={() => regenEnachLink.mutate(id)}>
                          Resend Link
                        </Button>
                      )}
                      {(m.status?.toUpperCase() === "ACTIVE" || m.status?.toUpperCase() === "PENDING") && id && (
                        <Button size="sm" variant="outline" className="h-7 text-xs px-2 text-destructive hover:text-destructive"
                          onClick={() => setCancelEnachId(id)}>
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {enachQuery.isError ? "Failed to load eNACH mandates" : `No eNACH mandates found for ${submittedPan}`}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── UPI Autopay Section ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-sm font-semibold">UPI Autopay Mandates</CardTitle>
            <CardDescription>UPI-based recurring payment mandates (UMRN)</CardDescription>
          </div>
          {submittedPan && (
            <Button size="sm" onClick={() => setCreateUpiOpen(true)}>
              + Create UPI Mandate
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {!submittedPan ? (
            <p className="text-sm text-muted-foreground">Enter PAN above to load mandates</p>
          ) : upiQuery.isLoading ? (
            <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : upiMandates.length > 0 ? (
            <div className="divide-y rounded-md border">
              {upiMandates.map((m, i) => {
                const umrn = m.umrn ?? m.id ?? "";
                return (
                  <div key={i} className="p-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium font-mono">{umrn || "—"}</span>
                        <Badge variant={mandateStatusVariant(m.status)} className="text-[10px] h-4">
                          {m.status ?? "Unknown"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        UPI: {m.upiId ?? m.vpa ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Max: {m.maxAmount != null ? fmt(m.maxAmount) : m.amount != null ? fmt(m.amount) : "—"} · {m.frequency ?? "—"}
                      </p>
                    </div>
                    {(m.status?.toUpperCase() === "ACTIVE" || m.status?.toUpperCase() === "PENDING") && umrn && (
                      <Button size="sm" variant="outline" className="h-7 text-xs px-2 text-destructive hover:text-destructive flex-shrink-0"
                        onClick={() => setCancelUpiUmrn(umrn)}>
                        Cancel
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {upiQuery.isError ? "Failed to load UPI mandates" : `No UPI mandates found for ${submittedPan}`}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Physical NACH Section ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Physical NACH Upload</CardTitle>
          <CardDescription>Upload a scanned NACH mandate form (PDF or image)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!submittedPan ? (
            <p className="text-sm text-muted-foreground">Enter PAN above to upload physical NACH</p>
          ) : (
            <>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${physDragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50"}`}
                onDragOver={e => { e.preventDefault(); setPhysDragging(true); }}
                onDragLeave={() => setPhysDragging(false)}
                onDrop={e => {
                  e.preventDefault();
                  setPhysDragging(false);
                  const file = e.dataTransfer.files[0];
                  if (file) {
                    if (file.size > 5 * 1024 * 1024) { toast({ title: "File too large", description: "Maximum allowed size is 5 MB", variant: "destructive" }); return; }
                    setPhysFile(file);
                  }
                }}
                onClick={() => document.getElementById("phys-file-input")?.click()}
              >
                <input
                  id="phys-file-input"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.tiff"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) {
                      if (f.size > 5 * 1024 * 1024) { toast({ title: "File too large", description: "Maximum allowed size is 5 MB", variant: "destructive" }); return; }
                      setPhysFile(f);
                    }
                  }}
                />
                {physFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span className="text-sm font-medium">{physFile.name}</span>
                    <span className="text-xs text-muted-foreground">({(physFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                ) : (
                  <div>
                    <Download className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Drag & drop or click to select scanned NACH form</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, PNG, JPG, TIFF supported</p>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>Bank Name *</Label>
                  <Input value={physBank} onChange={e => setPhysBank(e.target.value)} placeholder="HDFC Bank" />
                </div>
                <div>
                  <Label>Account Number *</Label>
                  <Input value={physAccount} onChange={e => setPhysAccount(e.target.value)} placeholder="XXXXXXXX1234" />
                </div>
                <div>
                  <Label>IFSC Code *</Label>
                  <Input value={physIfsc} onChange={e => setPhysIfsc(e.target.value.toUpperCase())} placeholder="HDFC0001234" maxLength={11} />
                </div>
              </div>
              <Button
                onClick={() => uploadPhys.mutate()}
                disabled={uploadPhys.isPending || !physFile || !physBank || !physAccount || !physIfsc}
              >
                {uploadPhys.isPending ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Uploading…</> : "Upload Physical NACH"}
              </Button>

              {/* Previously uploaded physical mandates */}
              {physQuery.isLoading ? (
                <div className="space-y-2 mt-2">{[1].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : physMandates.length > 0 ? (
                <div className="mt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Previously Uploaded</p>
                  <div className="divide-y rounded-md border">
                    {physMandates.map((m, i) => (
                      <div key={i} className="p-3 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono">{m.mandateId ?? m.id ?? "—"}</span>
                            <Badge variant={mandateStatusVariant(m.status)} className="text-[10px] h-4">
                              {m.status ?? "Unknown"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {m.bankName ?? m.bank ?? "—"} · {m.accountNumber ?? "—"} · {m.uploadedAt ?? m.createdAt ?? ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Create eNACH Dialog ───────────────────────────────────────────────── */}
      <Dialog open={createEnachOpen} onOpenChange={setCreateEnachOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create eNACH Mandate</DialogTitle>
            <DialogDescription>Register a new electronic NACH mandate for {submittedPan}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-2 p-2 rounded bg-muted/50 text-sm">
              <span className="text-muted-foreground text-xs">Investor PAN:</span>
              <span className="font-mono font-medium">{submittedPan}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Bank Name *</Label>
                <Input value={enachBank} onChange={e => setEnachBank(e.target.value)} placeholder="HDFC Bank" />
              </div>
              <div>
                <Label>Account Number *</Label>
                <Input value={enachAccount} onChange={e => setEnachAccount(e.target.value)} placeholder="XXXXXXXXXX1234" />
              </div>
              <div>
                <Label>IFSC Code *</Label>
                <Input value={enachIfsc} onChange={e => setEnachIfsc(e.target.value.toUpperCase())} placeholder="HDFC0001234" maxLength={11} />
              </div>
              <div>
                <Label>Maximum Amount (₹) *</Label>
                <Input type="number" value={enachAmount} onChange={e => setEnachAmount(e.target.value)} placeholder="25000" min={1} />
              </div>
              <div>
                <Label>Frequency</Label>
                <Select value={enachFreq} onValueChange={setEnachFreq}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                    <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                    <SelectItem value="HALF_YEARLY">Half-Yearly</SelectItem>
                    <SelectItem value="YEARLY">Yearly</SelectItem>
                    <SelectItem value="AS_AND_WHEN_PRESENTED">As Presented</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              className="w-full"
              onClick={() => createEnach.mutate({ pan: submittedPan, bankName: enachBank, accountNumber: enachAccount, ifscCode: enachIfsc, maxAmount: Number(enachAmount), frequency: enachFreq })}
              disabled={createEnach.isPending || !enachBank || !enachAccount || !enachIfsc || !enachAmount}
            >
              {createEnach.isPending ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Creating…</> : "Create eNACH Mandate"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Cancel eNACH Confirmation Dialog ─────────────────────────────────── */}
      <Dialog open={!!cancelEnachId} onOpenChange={v => { if (!v) setCancelEnachId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancel eNACH Mandate</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel mandate <span className="font-mono font-medium">{cancelEnachId}</span>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setCancelEnachId(null)}>Keep Mandate</Button>
            <Button variant="destructive" className="flex-1"
              disabled={cancelEnach.isPending}
              onClick={() => cancelEnachId && cancelEnach.mutate(cancelEnachId)}>
              {cancelEnach.isPending ? "Cancelling…" : "Yes, Cancel"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Create UPI Mandate Dialog ──────────────────────────────────────────── */}
      <Dialog open={createUpiOpen} onOpenChange={setCreateUpiOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create UPI Autopay Mandate</DialogTitle>
            <DialogDescription>Register a new UPI autopay mandate for {submittedPan}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-2 p-2 rounded bg-muted/50 text-sm">
              <span className="text-muted-foreground text-xs">Investor PAN:</span>
              <span className="font-mono font-medium">{submittedPan}</span>
            </div>
            <div>
              <Label>UPI ID (VPA) *</Label>
              <Input value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="investor@upi" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Maximum Amount (₹) *</Label>
                <Input type="number" value={upiAmount} onChange={e => setUpiAmount(e.target.value)} placeholder="25000" min={1} />
              </div>
              <div>
                <Label>Frequency</Label>
                <Select value={upiFreq} onValueChange={setUpiFreq}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                    <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                    <SelectItem value="HALF_YEARLY">Half-Yearly</SelectItem>
                    <SelectItem value="YEARLY">Yearly</SelectItem>
                    <SelectItem value="AS_AND_WHEN_PRESENTED">As Presented</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              className="w-full"
              onClick={() => createUpi.mutate({ pan: submittedPan, upiId, maxAmount: Number(upiAmount), frequency: upiFreq })}
              disabled={createUpi.isPending || !upiId || !upiAmount}
            >
              {createUpi.isPending ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Creating…</> : "Create UPI Mandate"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Cancel UPI Mandate Confirmation Dialog ────────────────────────────── */}
      <Dialog open={!!cancelUpiUmrn} onOpenChange={v => { if (!v) setCancelUpiUmrn(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancel UPI Mandate</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel UPI mandate <span className="font-mono font-medium">{cancelUpiUmrn}</span>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setCancelUpiUmrn(null)}>Keep Mandate</Button>
            <Button variant="destructive" className="flex-1"
              disabled={cancelUpi.isPending}
              onClick={() => cancelUpiUmrn && cancelUpi.mutate(cancelUpiUmrn)}>
              {cancelUpi.isPending ? "Cancelling…" : "Yes, Cancel"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


// ─── Commissions Tab ──────────────────────────────────────────────────────────
function CommissionsTab() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [amcCode, setAmcCode] = useState("");

  const params = new URLSearchParams();
  if (fromDate) params.set("fromDate", fromDate);
  if (toDate) params.set("toDate", toDate);
  if (amcCode) params.set("amcCode", amcCode);
  const qs = params.toString() ? "?" + params.toString() : "";

  const { data: summary, isLoading: sumL } = useQuery<IrisApiResponse<{ totalEarned?: number; thisMonth?: number; pending?: number }>>({
    queryKey: ["/api/iris/reports/commission/summary", fromDate, toDate, amcCode],
    queryFn: () => irisGet(`/api/iris/reports/commission/summary${qs}`),
    retry: false,
  });

  const { data: statement, isLoading: stmtL } = useQuery<IrisApiResponse<{ commissions?: CommissionRow[] } | CommissionRow[]>>({
    queryKey: ["/api/iris/reports/commission", fromDate, toDate, amcCode],
    queryFn: () => irisGet(`/api/iris/reports/commission${qs}`),
    retry: false,
  });

  const { data: trail, isLoading: trailL } = useQuery<IrisApiResponse<{ trail?: TrailRow[] } | TrailRow[]>>({
    queryKey: ["/api/iris/reports/trail-commission", fromDate, toDate, amcCode],
    queryFn: () => irisGet(`/api/iris/reports/trail-commission${qs}`),
    retry: false,
  });

  const { data: amcWise, isLoading: amcL } = useQuery<IrisApiResponse<{ breakdown?: AmcCommission[] } | AmcCommission[]>>({
    queryKey: ["/api/iris/reports/commission/amc-wise", fromDate, toDate, amcCode],
    queryFn: () => irisGet(`/api/iris/reports/commission/amc-wise${qs}`),
    retry: false,
  });

  function resolveArr<T>(d: IrisApiResponse<{ commissions?: T[]; trail?: T[]; breakdown?: T[] } | T[]> | undefined, key: "commissions" | "trail" | "breakdown"): T[] {
    if (!d?.data) return [];
    if (Array.isArray(d.data)) return d.data as T[];
    return (d.data as Record<string, T[] | undefined>)[key] ?? [];
  }

  const commissions = resolveArr<CommissionRow>(statement as IrisApiResponse<{ commissions?: CommissionRow[] } | CommissionRow[]>, "commissions");
  const trailRows = resolveArr<TrailRow>(trail as IrisApiResponse<{ trail?: TrailRow[] } | TrailRow[]>, "trail");
  const amcRows = resolveArr<AmcCommission>(amcWise as IrisApiResponse<{ breakdown?: AmcCommission[] } | AmcCommission[]>, "breakdown");

  const sumData = summary?.data;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-sm">Filters</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><Label>From Date</Label><Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} /></div>
            <div><Label>To Date</Label><Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} /></div>
            <div><Label>AMC Code (optional)</Label><Input placeholder="e.g. HDFC" value={amcCode} onChange={e => setAmcCode(e.target.value.toUpperCase())} /></div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Earned" value={fmt(sumData?.totalEarned)} icon={CreditCard} loading={sumL} subtitle="All time commissions" />
        <StatCard title="This Month" value={fmt(sumData?.thisMonth)} icon={TrendingUp} loading={sumL} subtitle="Current month earnings" />
        <StatCard title="Pending" value={fmt(sumData?.pending)} icon={Clock} loading={sumL} subtitle="Awaiting clearance" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Commission Statement</CardTitle></CardHeader>
          <CardContent className="p-0">
            {stmtL ? <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div> : (
              <ScrollArea className="h-60">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background border-b">
                    <tr>
                      <th className="text-left p-2 font-medium">Scheme</th>
                      <th className="text-right p-2 font-medium">Amount</th>
                      <th className="text-right p-2 font-medium">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissions.map((c, i) => (
                      <tr key={i} className="border-b hover:bg-muted/50">
                        <td className="p-2">{c.schemeName ?? c.scheme ?? "—"}</td>
                        <td className="p-2 text-right">{fmt(c.commissionAmount ?? c.amount)}</td>
                        <td className="p-2 text-right"><Badge variant="outline" className="text-xs">{c.commissionType ?? c.type ?? "—"}</Badge></td>
                      </tr>
                    ))}
                    {!commissions.length && <tr><td colSpan={3} className="p-4 text-center text-muted-foreground text-sm">No commission data</td></tr>}
                  </tbody>
                </table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Trail Commission</CardTitle></CardHeader>
          <CardContent className="p-0">
            {trailL ? <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div> : (
              <ScrollArea className="h-60">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background border-b">
                    <tr>
                      <th className="text-left p-2 font-medium">Scheme</th>
                      <th className="text-right p-2 font-medium">AUM</th>
                      <th className="text-right p-2 font-medium">Trail %</th>
                      <th className="text-right p-2 font-medium">Trail Amt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trailRows.map((t, i) => (
                      <tr key={i} className="border-b hover:bg-muted/50">
                        <td className="p-2">{t.schemeName ?? t.scheme ?? "—"}</td>
                        <td className="p-2 text-right">{fmt(t.aum)}</td>
                        <td className="p-2 text-right">{t.trailRate != null ? t.trailRate + "%" : "—"}</td>
                        <td className="p-2 text-right">{fmt(t.trailAmount ?? t.amount)}</td>
                      </tr>
                    ))}
                    {!trailRows.length && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground text-sm">No trail commission data</td></tr>}
                  </tbody>
                </table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">AMC-wise Breakdown</CardTitle>
            <Button size="sm" variant="outline" onClick={() => {
              const csv = ["AMC,AUM,Commission,Trail"].concat(amcRows.map(r => `${r.amcName ?? r.amc ?? ""},${r.aum ?? ""},${r.commission ?? ""},${r.trail ?? ""}`)).join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "amc-commissions.csv"; a.click();
            }}>
              <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {amcL ? <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div> : (
            <ScrollArea className="h-56">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background border-b">
                  <tr>
                    <th className="text-left p-2 font-medium">AMC</th>
                    <th className="text-right p-2 font-medium">AUM</th>
                    <th className="text-right p-2 font-medium">Commission</th>
                    <th className="text-right p-2 font-medium">Trail</th>
                  </tr>
                </thead>
                <tbody>
                  {amcRows.map((r, i) => (
                    <tr key={i} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-medium">{r.amcName ?? r.amc ?? "—"}</td>
                      <td className="p-2 text-right">{fmt(r.aum)}</td>
                      <td className="p-2 text-right">{fmt(r.commission)}</td>
                      <td className="p-2 text-right">{fmt(r.trail)}</td>
                    </tr>
                  ))}
                  {!amcRows.length && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground text-sm">No AMC breakdown data</td></tr>}
                </tbody>
              </table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface CommissionRow { schemeName?: string; scheme?: string; commissionAmount?: number; amount?: number; commissionType?: string; type?: string; }
interface TrailRow { schemeName?: string; scheme?: string; aum?: number; trailRate?: number; trailAmount?: number; amount?: number; }
interface AmcCommission { amcName?: string; amc?: string; aum?: number; commission?: number; trail?: number; }

// ─── Enhanced Reports Tab ─────────────────────────────────────────────────────
type ReportType = "capital-gains" | "client-statement" | "transaction-statement" | "portfolio-summary";
type BulkReportSection = "per-investor" | "bulk-cg" | "dividend-tracker" | "sip-calendar" | "bulk-portfolio";

const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: "capital-gains", label: "Capital Gains Statement" },
  { value: "client-statement", label: "Client Statement" },
  { value: "transaction-statement", label: "Transaction Statement" },
  { value: "portfolio-summary", label: "Portfolio Summary" },
];

function ReportsTab() {
  const [section, setSection] = useState<BulkReportSection>("per-investor");
  const [pan, setPan] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reportType, setReportType] = useState<ReportType>("capital-gains");
  const [result, setResult] = useState<{ success: boolean; data?: { downloadUrl?: string }; message?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [fySelector, setFySelector] = useState("2024-25");
  const [sipWindow, setSipWindow] = useState("30");
  const [amcFilter, setAmcFilter] = useState("");
  const { toast } = useToast();

  async function runReport() {
    if (!pan) { toast({ title: "PAN is required", variant: "destructive" }); return; }
    setLoading(true); setResult(null);
    try {
      const qs = new URLSearchParams();
      if (fromDate) qs.set("fromDate", fromDate);
      if (toDate) qs.set("toDate", toDate);
      const json = await irisGet<typeof result>(`/api/iris/reports/${reportType}/${pan}${qs.toString() ? "?" + qs.toString() : ""}`);
      setResult(json);
    } catch { toast({ title: "Report fetch failed", variant: "destructive" }); }
    finally { setLoading(false); }
  }

  const bulkCgParams = new URLSearchParams({ fy: fySelector }); if (amcFilter) bulkCgParams.set("amcCode", amcFilter);
  const { data: bulkCg, isLoading: bcgL, refetch: refetchBcg } = useQuery<IrisApiResponse<{ downloadUrl?: string; records?: unknown[] }>>({
    queryKey: ["/api/iris/reports/bulk/capital-gains", fySelector, amcFilter],
    queryFn: () => irisGet(`/api/iris/reports/bulk/capital-gains?${bulkCgParams.toString()}`),
    enabled: section === "bulk-cg",
    retry: false,
  });

  const divParams = new URLSearchParams(); if (fromDate) divParams.set("fromDate", fromDate); if (toDate) divParams.set("toDate", toDate); if (amcFilter) divParams.set("amcCode", amcFilter);
  const { data: dividends, isLoading: divL, refetch: refetchDiv } = useQuery<IrisApiResponse<{ dividends?: DividendRow[] } | DividendRow[]>>({
    queryKey: ["/api/iris/reports/dividend-tracker", fromDate, toDate, amcFilter],
    queryFn: () => irisGet(`/api/iris/reports/dividend-tracker${divParams.toString() ? "?" + divParams.toString() : ""}`),
    enabled: section === "dividend-tracker",
    retry: false,
  });

  const sipParams = new URLSearchParams({ days: sipWindow });
  const { data: sipCal, isLoading: sipCalL, refetch: refetchSipCal } = useQuery<IrisApiResponse<{ sips?: SipCalRow[] } | SipCalRow[]>>({
    queryKey: ["/api/iris/reports/sip-maturity-calendar", sipWindow],
    queryFn: () => irisGet(`/api/iris/reports/sip-maturity-calendar?${sipParams.toString()}`),
    enabled: section === "sip-calendar",
    retry: false,
  });

  const bpParams = new URLSearchParams(); if (toDate) bpParams.set("asOfDate", toDate);
  const { data: bulkPortfolio, isLoading: bpL, refetch: refetchBp } = useQuery<IrisApiResponse<{ downloadUrl?: string }>>({
    queryKey: ["/api/iris/reports/bulk/portfolio", toDate],
    queryFn: () => irisGet(`/api/iris/reports/bulk/portfolio${bpParams.toString() ? "?" + bpParams.toString() : ""}`),
    enabled: section === "bulk-portfolio",
    retry: false,
  });

  function resolveDivArr(): DividendRow[] {
    if (!dividends?.data) return [];
    if (Array.isArray(dividends.data)) return dividends.data;
    return (dividends.data as { dividends?: DividendRow[] }).dividends ?? [];
  }
  function resolveSipCalArr(): SipCalRow[] {
    if (!sipCal?.data) return [];
    if (Array.isArray(sipCal.data)) return sipCal.data;
    return (sipCal.data as { sips?: SipCalRow[] }).sips ?? [];
  }

  const sections: { value: BulkReportSection; label: string }[] = [
    { value: "per-investor", label: "Per-Investor" },
    { value: "bulk-cg", label: "Bulk Capital Gains" },
    { value: "dividend-tracker", label: "Dividend Tracker" },
    { value: "sip-calendar", label: "SIP Maturity Calendar" },
    { value: "bulk-portfolio", label: "Bulk Portfolio" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 flex-wrap">
        {sections.map(s => (
          <Button key={s.value} size="sm" variant={section === s.value ? "default" : "outline"} onClick={() => setSection(s.value)}>{s.label}</Button>
        ))}
      </div>

      {section === "per-investor" && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-sm">Per-Investor Report</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div><Label>Investor PAN</Label><Input value={pan} onChange={e => setPan(e.target.value.toUpperCase())} placeholder="ABCDE1234F" /></div>
                <div>
                  <Label>Report Type</Label>
                  <Select value={reportType} onValueChange={v => setReportType(v as ReportType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{REPORT_TYPES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>From Date</Label><Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} /></div>
                <div><Label>To Date</Label><Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} /></div>
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
                  result.data?.downloadUrl
                    ? <a href={result.data.downloadUrl} target="_blank" rel="noopener noreferrer"><Button variant="outline"><Download className="h-4 w-4 mr-2" /> Download PDF</Button></a>
                    : <pre className="text-xs bg-muted/30 rounded p-3 overflow-auto max-h-64">{JSON.stringify(result.data, null, 2)}</pre>
                ) : <p className="text-sm text-destructive">{result.message}</p>}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {section === "bulk-cg" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><TrendingDown className="h-4 w-4" /> Bulk Capital Gains Report</CardTitle>
            <CardDescription>All investors — capital gains for the selected financial year</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3 flex-wrap items-end">
              <div><Label>Financial Year</Label>
                <Select value={fySelector} onValueChange={setFySelector}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["2024-25","2023-24","2022-23","2021-22"].map(fy => <SelectItem key={fy} value={fy}>{fy}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>AMC Filter (optional)</Label><Input placeholder="AMC code" value={amcFilter} onChange={e => setAmcFilter(e.target.value.toUpperCase())} className="w-32" /></div>
              <Button onClick={() => refetchBcg()} disabled={bcgL}>{bcgL ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />} Generate</Button>
            </div>
            {bcgL && <Skeleton className="h-16 w-full" />}
            {bulkCg?.data?.downloadUrl && (
              <a href={bulkCg.data.downloadUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline"><Download className="h-4 w-4 mr-2" /> Download Report</Button>
              </a>
            )}
            {bulkCg && !bulkCg.data?.downloadUrl && (
              <pre className="text-xs bg-muted/30 rounded p-3 overflow-auto max-h-48">{JSON.stringify(bulkCg.data, null, 2)}</pre>
            )}
          </CardContent>
        </Card>
      )}

      {section === "dividend-tracker" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><IndianRupee className="h-4 w-4" /> Dividend Tracker</CardTitle>
            <CardDescription>Upcoming dividends across your book</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3 flex-wrap items-end">
              <div><Label>From Date</Label><Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} /></div>
              <div><Label>To Date</Label><Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} /></div>
              <div><Label>AMC Filter</Label><Input placeholder="AMC code" value={amcFilter} onChange={e => setAmcFilter(e.target.value.toUpperCase())} className="w-32" /></div>
              <Button onClick={() => refetchDiv()} disabled={divL}>{divL ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />} Refresh</Button>
              {resolveDivArr().length > 0 && (
                <Button variant="outline" onClick={() => {
                  const csv = ["Scheme,Dividend,Record Date,AMC"].concat(resolveDivArr().map(d => `"${d.schemeName ?? d.scheme ?? ""}",${d.dividendAmount ?? ""},${d.recordDate ?? ""},"${d.amcName ?? d.amc ?? ""}"`)).join("\n");
                  const blob = new Blob([csv], { type: "text/csv" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "dividend-tracker.csv"; a.click();
                }}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
              )}
            </div>
            {divL ? <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div> : (
              <ScrollArea className="h-64 border rounded-md">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background border-b">
                    <tr><th className="text-left p-2">Scheme</th><th className="text-right p-2">Dividend</th><th className="text-right p-2">Record Date</th><th className="text-right p-2">AMC</th></tr>
                  </thead>
                  <tbody>
                    {resolveDivArr().map((d, i) => (
                      <tr key={i} className="border-b hover:bg-muted/50">
                        <td className="p-2">{d.schemeName ?? d.scheme ?? "—"}</td>
                        <td className="p-2 text-right">{d.dividendAmount != null ? `₹${d.dividendAmount}` : "—"}</td>
                        <td className="p-2 text-right">{d.recordDate ?? "—"}</td>
                        <td className="p-2 text-right">{d.amcName ?? d.amc ?? "—"}</td>
                      </tr>
                    ))}
                    {!resolveDivArr().length && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground text-sm">No dividend data</td></tr>}
                  </tbody>
                </table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

      {section === "sip-calendar" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><Calendar className="h-4 w-4" /> SIP Maturity Calendar</CardTitle>
            <CardDescription>SIPs maturing within the selected window</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3 flex-wrap items-end">
              <div>
                <Label>Maturity Window</Label>
                <Select value={sipWindow} onValueChange={setSipWindow}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 Days</SelectItem>
                    <SelectItem value="60">60 Days</SelectItem>
                    <SelectItem value="90">90 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => refetchSipCal()} disabled={sipCalL}>{sipCalL ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />} Refresh</Button>
              {resolveSipCalArr().length > 0 && (
                <Button variant="outline" onClick={() => {
                  const csv = ["Investor/PAN,Scheme,Amount,Maturity Date"].concat(resolveSipCalArr().map(s => `"${s.investorName ?? s.pan ?? ""}","${s.schemeName ?? s.scheme ?? ""}",${s.amount ?? ""},${s.maturityDate ?? s.endDate ?? ""}`)).join("\n");
                  const blob = new Blob([csv], { type: "text/csv" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "sip-maturity-calendar.csv"; a.click();
                }}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
              )}
            </div>
            {sipCalL ? <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div> : (
              <ScrollArea className="h-64 border rounded-md">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background border-b">
                    <tr><th className="text-left p-2">Investor</th><th className="text-left p-2">Scheme</th><th className="text-right p-2">Amount</th><th className="text-right p-2">Maturity Date</th></tr>
                  </thead>
                  <tbody>
                    {resolveSipCalArr().map((s, i) => (
                      <tr key={i} className="border-b hover:bg-muted/50">
                        <td className="p-2">{s.investorName ?? s.pan ?? "—"}</td>
                        <td className="p-2">{s.schemeName ?? s.scheme ?? "—"}</td>
                        <td className="p-2 text-right">{fmt(s.amount)}</td>
                        <td className="p-2 text-right">{s.maturityDate ?? s.endDate ?? "—"}</td>
                      </tr>
                    ))}
                    {!resolveSipCalArr().length && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground text-sm">No SIP maturities in this window</td></tr>}
                  </tbody>
                </table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

      {section === "bulk-portfolio" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><PieChart className="h-4 w-4" /> Bulk Portfolio Report</CardTitle>
            <CardDescription>Portfolio report for all investors — downloadable</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3 flex-wrap items-end">
              <div><Label>As-of Date (optional)</Label><Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} /></div>
              <Button onClick={() => refetchBp()} disabled={bpL}>{bpL ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />} Generate</Button>
            </div>
            {bpL && <Skeleton className="h-16 w-full" />}
            {bulkPortfolio?.data?.downloadUrl && (
              <a href={bulkPortfolio.data.downloadUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline"><Download className="h-4 w-4 mr-2" /> Download Portfolio Report</Button>
              </a>
            )}
            {bulkPortfolio && !bulkPortfolio.data?.downloadUrl && (
              <pre className="text-xs bg-muted/30 rounded p-3 overflow-auto max-h-48">{JSON.stringify(bulkPortfolio.data, null, 2)}</pre>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface DividendRow { schemeName?: string; scheme?: string; dividendAmount?: number; recordDate?: string; amcName?: string; amc?: string; }
interface SipCalRow { investorName?: string; pan?: string; schemeName?: string; scheme?: string; amount?: number; maturityDate?: string; endDate?: string; }

// ─── Compliance Tab (admin-only) ──────────────────────────────────────────────
function ComplianceTab() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const qs = new URLSearchParams();
  if (fromDate) qs.set("fromDate", fromDate);
  if (toDate) qs.set("toDate", toDate);
  const qsStr = qs.toString() ? "?" + qs.toString() : "";

  const { data: pmla, isLoading: pmlaL } = useQuery<IrisApiResponse<{ records?: ComplianceRecord[] } | ComplianceRecord[]>>({
    queryKey: ["/api/iris/reports/pmla", fromDate, toDate],
    queryFn: () => irisGet(`/api/iris/reports/pmla${qsStr}`),
    retry: false,
  });
  const { data: aml, isLoading: amlL } = useQuery<IrisApiResponse<{ records?: AmlRecord[] } | AmlRecord[]>>({
    queryKey: ["/api/iris/reports/aml", fromDate, toDate],
    queryFn: () => irisGet(`/api/iris/reports/aml${qsStr}`),
    retry: false,
  });
  const { data: compliance, isLoading: compL } = useQuery<IrisApiResponse<{ records?: ComplianceRecord[] } | ComplianceRecord[]>>({
    queryKey: ["/api/iris/reports/compliance", fromDate, toDate],
    queryFn: () => irisGet(`/api/iris/reports/compliance${qsStr}`),
    retry: false,
  });

  function resolveRecords<T>(d: IrisApiResponse<{ records?: T[] } | T[]> | undefined): T[] {
    if (!d?.data) return [];
    if (Array.isArray(d.data)) return d.data as T[];
    return ((d.data as { records?: T[] }).records) ?? [];
  }

  const pmlaRecs = resolveRecords<ComplianceRecord>(pmla);
  const amlRecs = resolveRecords<AmlRecord>(aml);
  const compRecs = resolveRecords<ComplianceRecord>(compliance);

  function ReportTable({ rows, cols, loading }: { rows: Record<string, unknown>[]; cols: { key: string; label: string }[]; loading: boolean }) {
    if (loading) return <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>;
    return (
      <ScrollArea className="h-52 border rounded-md">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background border-b">
            <tr>{cols.map(c => <th key={c.key} className="text-left p-2 font-medium">{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b hover:bg-muted/50">
                {cols.map(c => <td key={c.key} className="p-2">{String(r[c.key] ?? "—")}</td>)}
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={cols.length} className="p-4 text-center text-muted-foreground text-sm">No records found</td></tr>}
          </tbody>
        </table>
      </ScrollArea>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><LucideShield className="h-4 w-4 text-amber-500" /> Compliance & AML Reports (Admin Only)</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>From Date</Label><Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} /></div>
            <div><Label>To Date</Label><Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">PMLA Report</CardTitle><CardDescription>Prevention of Money Laundering Act — flagged transactions</CardDescription></CardHeader>
        <CardContent>
          <ReportTable rows={pmlaRecs as unknown as Record<string, unknown>[]} cols={[{key:"pan",label:"PAN"},{key:"investorName",label:"Investor"},{key:"amount",label:"Amount"},{key:"transactionDate",label:"Date"},{key:"flag",label:"Flag"}]} loading={pmlaL} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">AML Flag Report</CardTitle><CardDescription>Anti-money laundering — flagged investor accounts</CardDescription></CardHeader>
        <CardContent>
          <ReportTable rows={amlRecs as unknown as Record<string, unknown>[]} cols={[{key:"pan",label:"PAN"},{key:"investorName",label:"Investor"},{key:"flagReason",label:"Reason"},{key:"flagDate",label:"Flagged On"},{key:"status",label:"Status"}]} loading={amlL} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">General Compliance Summary</CardTitle><CardDescription>Overall compliance records</CardDescription></CardHeader>
        <CardContent>
          <ReportTable rows={compRecs as unknown as Record<string, unknown>[]} cols={[{key:"pan",label:"PAN"},{key:"investorName",label:"Investor"},{key:"complianceType",label:"Type"},{key:"date",label:"Date"},{key:"status",label:"Status"}]} loading={compL} />
        </CardContent>
      </Card>
    </div>
  );
}

interface ComplianceRecord { pan?: string; investorName?: string; amount?: number; transactionDate?: string; flag?: string; complianceType?: string; date?: string; status?: string; }
interface AmlRecord { pan?: string; investorName?: string; flagReason?: string; flagDate?: string; status?: string; }

// ─── Investor Alerts Panel ─────────────────────────────────────────────────────
function InvestorAlertsPanel({ pan }: { pan: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editAlert, setEditAlert] = useState<AlertRecord | null>(null);
  const [alertForm, setAlertForm] = useState({ alertType: "NAV", schemeCode: "", threshold: "", condition: "ABOVE" });

  const { data: alerts, isLoading } = useQuery<IrisApiResponse<{ alerts?: AlertRecord[] } | AlertRecord[]>>({
    queryKey: ["/api/iris/alerts", pan],
    queryFn: () => irisGet(`/api/iris/alerts?pan=${encodeURIComponent(pan)}`),
    retry: false,
  });

  const createMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiRequest("/api/iris/alerts", "POST", { body }),
    onSuccess: () => { toast({ title: "Alert created" }); setCreateOpen(false); qc.invalidateQueries({ queryKey: ["/api/iris/alerts", pan] }); },
    onError: (e: Error) => toast({ title: "Failed to create alert", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => apiRequest(`/api/iris/alerts/${id}`, "PUT", { body }),
    onSuccess: () => { toast({ title: "Alert updated" }); setEditAlert(null); qc.invalidateQueries({ queryKey: ["/api/iris/alerts", pan] }); },
    onError: (e: Error) => toast({ title: "Failed to update alert", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/iris/alerts/${id}`, "DELETE"),
    onSuccess: () => { toast({ title: "Alert deleted" }); qc.invalidateQueries({ queryKey: ["/api/iris/alerts", pan] }); },
    onError: (e: Error) => toast({ title: "Failed to delete alert", description: e.message, variant: "destructive" }),
  });

  function resolveAlerts(): AlertRecord[] {
    if (!alerts?.data) return [];
    if (Array.isArray(alerts.data)) return alerts.data;
    return (alerts.data as { alerts?: AlertRecord[] }).alerts ?? [];
  }

  const rows = resolveAlerts();

  function openCreate() { setAlertForm({ alertType: "NAV", schemeCode: "", threshold: "", condition: "ABOVE" }); setCreateOpen(true); }
  function openEdit(a: AlertRecord) { setEditAlert(a); setAlertForm({ alertType: a.alertType ?? "NAV", schemeCode: a.schemeCode ?? "", threshold: String(a.threshold ?? ""), condition: a.condition ?? "ABOVE" }); }

  const AlertForm = ({ onSave, onCancel, pending }: { onSave: () => void; onCancel: () => void; pending: boolean }) => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Alert Type</Label>
          <Select value={alertForm.alertType} onValueChange={v => setAlertForm(f => ({ ...f, alertType: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="NAV">NAV</SelectItem><SelectItem value="PRICE">Price</SelectItem></SelectContent>
          </Select>
        </div>
        <div>
          <Label>Condition</Label>
          <Select value={alertForm.condition} onValueChange={v => setAlertForm(f => ({ ...f, condition: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="ABOVE">Above</SelectItem><SelectItem value="BELOW">Below</SelectItem></SelectContent>
          </Select>
        </div>
      </div>
      <div><Label>Scheme Code</Label><Input value={alertForm.schemeCode} onChange={e => setAlertForm(f => ({ ...f, schemeCode: e.target.value }))} placeholder="e.g. INF204K01036" /></div>
      <div><Label>Threshold Value</Label><Input type="number" value={alertForm.threshold} onChange={e => setAlertForm(f => ({ ...f, threshold: e.target.value }))} placeholder="e.g. 50.00" /></div>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button className="flex-1" onClick={onSave} disabled={pending}>{pending ? "Saving…" : "Save Alert"}</Button>
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2"><Bell className="h-4 w-4" /> Price / NAV Alerts</CardTitle>
          <Button size="sm" variant="outline" onClick={openCreate}><Plus className="h-3.5 w-3.5 mr-1" /> New Alert</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {createOpen && (
          <div className="border rounded-md p-3 bg-muted/20">
            <p className="text-xs font-medium text-muted-foreground mb-2">Create Alert</p>
            <AlertForm
              onSave={() => createMut.mutate({ pan, alertType: alertForm.alertType, schemeCode: alertForm.schemeCode, threshold: Number(alertForm.threshold), condition: alertForm.condition })}
              onCancel={() => setCreateOpen(false)}
              pending={createMut.isPending}
            />
          </div>
        )}

        {editAlert && (
          <div className="border rounded-md p-3 bg-muted/20">
            <p className="text-xs font-medium text-muted-foreground mb-2">Edit Alert</p>
            <AlertForm
              onSave={() => updateMut.mutate({ id: editAlert.alertId!, body: { alertType: alertForm.alertType, schemeCode: alertForm.schemeCode, threshold: Number(alertForm.threshold), condition: alertForm.condition } })}
              onCancel={() => setEditAlert(null)}
              pending={updateMut.isPending}
            />
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : rows.length > 0 ? (
          <div className="divide-y">
            {rows.map((a, i) => (
              <div key={i} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="font-medium text-xs">{a.schemeCode ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{a.alertType} · {a.condition} {a.threshold}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant={a.status === "ACTIVE" ? "default" : "secondary"} className="text-[10px]">{a.status ?? "—"}</Badge>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => openEdit(a)}><Pencil className="h-3 w-3" /></Button>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => a.alertId && deleteMut.mutate(a.alertId)} disabled={deleteMut.isPending}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No alerts set for this investor</p>
        )}
      </CardContent>
    </Card>
  );
}

interface AlertRecord { alertId?: string; alertType?: string; schemeCode?: string; threshold?: number; condition?: string; status?: string; }

// ─── WhatsApp Panel ───────────────────────────────────────────────────────────
function WhatsAppPanel({ pan }: { pan: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [extraMessage, setExtraMessage] = useState("");

  const { data: templates, isLoading: tplL } = useQuery<IrisApiResponse<{ templates?: WaTemplate[] } | WaTemplate[]>>({
    queryKey: ["/api/iris/notifications/templates"],
    retry: false,
  });

  const { data: history, isLoading: histL } = useQuery<IrisApiResponse<{ messages?: WaMessage[] } | WaMessage[]>>({
    queryKey: ["/api/iris/notifications/history", pan],
    queryFn: () => irisGet(`/api/iris/notifications/history?pan=${encodeURIComponent(pan)}`),
    retry: false,
  });

  const sendMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiRequest("/api/iris/notifications/whatsapp", "POST", { body }),
    onSuccess: () => {
      toast({ title: "WhatsApp message sent" });
      setExtraMessage("");
      qc.invalidateQueries({ queryKey: ["/api/iris/notifications/history", pan] });
    },
    onError: (e: Error) => toast({ title: "Failed to send", description: e.message, variant: "destructive" }),
  });

  function resolveTemplates(): WaTemplate[] {
    if (!templates?.data) return [];
    if (Array.isArray(templates.data)) return templates.data;
    return (templates.data as { templates?: WaTemplate[] }).templates ?? [];
  }

  function resolveHistory(): WaMessage[] {
    if (!history?.data) return [];
    if (Array.isArray(history.data)) return history.data;
    return (history.data as { messages?: WaMessage[] }).messages ?? [];
  }

  const tpls = resolveTemplates();
  const msgs = resolveHistory();

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="h-4 w-4 text-green-600" /> WhatsApp Notifications</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Select Template</Label>
          {tplL ? <Skeleton className="h-10 w-full" /> : (
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger><SelectValue placeholder="Choose a template…" /></SelectTrigger>
              <SelectContent>
                {tpls.map((t, i) => <SelectItem key={i} value={t.templateId ?? t.id ?? String(i)}>{t.templateName ?? t.name ?? "Template " + (i+1)}</SelectItem>)}
                {!tpls.length && <SelectItem value="none" disabled>No templates available</SelectItem>}
              </SelectContent>
            </Select>
          )}
          <div><Label>Additional Message (optional)</Label><Input value={extraMessage} onChange={e => setExtraMessage(e.target.value)} placeholder="Custom message or variable…" /></div>
          <Button onClick={() => sendMut.mutate({ pan, templateId: selectedTemplate, message: extraMessage || undefined })}
            disabled={sendMut.isPending || !selectedTemplate || selectedTemplate === "none"}>
            {sendMut.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
            Send Message
          </Button>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Sent History</p>
          {histL ? <Skeleton className="h-16 w-full" /> : msgs.length > 0 ? (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {msgs.map((m, i) => (
                <div key={i} className="flex justify-between text-xs border rounded p-2">
                  <span className="truncate max-w-[60%]">{m.templateName ?? m.template ?? "—"}</span>
                  <span className="text-muted-foreground">{m.sentAt ?? m.date ?? "—"}</span>
                  <Badge variant={m.status === "DELIVERED" ? "default" : "secondary"} className="text-[10px]">{m.status ?? "—"}</Badge>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">No messages sent yet</p>}
        </div>
      </CardContent>
    </Card>
  );
}

interface WaTemplate { templateId?: string; id?: string; templateName?: string; name?: string; }
interface WaMessage { templateName?: string; template?: string; sentAt?: string; date?: string; status?: string; }

// ─── Types used by CasImportTab ───────────────────────────────────────────────
interface CasHolding {
  schemeName?: string;
  scheme?: string;
  units?: number;
  currentValue?: number;
  gainLossPercentage?: number;
}
interface CasSummary {
  currentValue?: number;
  investedValue?: number;
  gainLoss?: number;
  xirr?: number;
}
interface ExternalFolio {
  folioNo?: string;
  registrar?: string;
  amcName?: string;
  amc?: string;
  schemeCount?: number;
  currentValue?: number;
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
            <LucideShield className="h-3 w-3" /> Distributor Portal
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
          <TabsTrigger value="onboarding"><UserPlus className="h-4 w-4 mr-1 inline" />Onboarding</TabsTrigger>
          <TabsTrigger value="nfo"><Layers className="h-4 w-4 mr-1 inline" />NFO</TabsTrigger>
          <TabsTrigger value="empanelment"><LucideShield className="h-4 w-4 mr-1 inline" />Empanelment</TabsTrigger>
          <TabsTrigger value="investors"><Users className="h-4 w-4 mr-1 inline" />Investors</TabsTrigger>
          <TabsTrigger value="transact"><TrendingUp className="h-4 w-4 mr-1 inline" />Transact</TabsTrigger>
          <TabsTrigger value="mandates"><CreditCard className="h-4 w-4 mr-1 inline" />Mandates</TabsTrigger>
          <TabsTrigger value="analytics"><LineChart className="h-4 w-4 mr-1 inline" />Analytics</TabsTrigger>
          <TabsTrigger value="research"><BookOpen className="h-4 w-4 mr-1 inline" />Research</TabsTrigger>
          <TabsTrigger value="products"><FileText className="h-4 w-4 mr-1 inline" />Products & FD</TabsTrigger>
          <TabsTrigger value="nps"><PiggyBank className="h-4 w-4 mr-1 inline" />NPS</TabsTrigger>
          <TabsTrigger value="commissions"><CreditCard className="h-4 w-4 mr-1 inline" />Commissions</TabsTrigger>
          <TabsTrigger value="reports"><Download className="h-4 w-4 mr-1 inline" />Reports</TabsTrigger>
          <TabsTrigger value="hierarchy"><Building2 className="h-4 w-4 mr-1 inline" />Hierarchy</TabsTrigger>
          {isAdmin && <TabsTrigger value="compliance"><LucideShield className="h-4 w-4 mr-1 inline" />Compliance</TabsTrigger>}
          <TabsTrigger value="cas-import"><FolderOpen className="h-4 w-4 mr-1 inline" />CAS Import</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4"><DashboardTab /></TabsContent>
        <TabsContent value="onboarding" className="mt-4"><OnboardingTab /></TabsContent>
        <TabsContent value="nfo" className="mt-4"><NfoTab /></TabsContent>
        <TabsContent value="empanelment" className="mt-4"><EmpanelmentTab /></TabsContent>
        <TabsContent value="investors" className="mt-4"><InvestorsTab /></TabsContent>
        <TabsContent value="transact" className="mt-4"><TransactTab /></TabsContent>
        <TabsContent value="mandates" className="mt-4"><MandatesTab /></TabsContent>
        <TabsContent value="analytics" className="mt-4"><AnalyticsTab /></TabsContent>
        <TabsContent value="research" className="mt-4"><ResearchTab /></TabsContent>
        <TabsContent value="products" className="mt-4"><ProductsTab /></TabsContent>
        <TabsContent value="nps" className="mt-4"><NpsTab /></TabsContent>
        <TabsContent value="commissions" className="mt-4"><CommissionsTab /></TabsContent>
        <TabsContent value="reports" className="mt-4"><ReportsTab /></TabsContent>
        <TabsContent value="hierarchy" className="mt-4"><HierarchyTab isAdmin={isAdmin} /></TabsContent>
        {isAdmin && <TabsContent value="compliance" className="mt-4"><ComplianceTab /></TabsContent>}
        <TabsContent value="cas-import" className="mt-4"><CasImportTab /></TabsContent>
      </Tabs>

      {isAdmin && <AdminOtpDialog open={otpDialogOpen} onClose={() => setOtpDialogOpen(false)} />}
    </div>
  );
}
