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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import {
  TrendingUp, Users, IndianRupee, Activity, Shield, FileText,
  BarChart3, RefreshCw, Search, ExternalLink, ArrowUpRight,
  ChevronRight, AlertCircle, CheckCircle2, Clock, Download, KeyRound, XCircle,
  FolderOpen, Inbox, Unlink, Link2, Send, CloudDownload, Calculator, Calendar,
  AlertTriangle, Banknote, PiggyBank
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

// ─── Investors Tab ────────────────────────────────────────────────────────────
type InvestorDetailTab = "portfolio" | "holdings" | "transactions" | "sips" | "orders";

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

  const investors = resolveInvestors();
  const holdings = resolveHoldings();
  const txns = resolveTxns();
  const sips = sipsData?.data?.sips ?? [];
  const orders = resolveOrders();

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
              {(["portfolio", "holdings", "transactions", "sips", "orders"] as InvestorDetailTab[]).map(tab => (
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

// ─── CAS Import & External Portfolio Tab ─────────────────────────────────────
function CasImportTab() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── CAS from Registry ──────────────────────────────────────────────────────
  const [casPan, setCasPan] = useState('');
  const [casSubmittedPan, setCasSubmittedPan] = useState('');
  const [genEmail, setGenEmail] = useState('');
  const [genEmailDialogOpen, setGenEmailDialogOpen] = useState(false);

  const casQuery = useQuery<{ success: boolean; data: { holdings?: CasHolding[]; summary?: CasSummary } }>({
    queryKey: ['/api/iris/portfolio/cas-fetch', casSubmittedPan],
    enabled: !!casSubmittedPan,
  });

  const importMutation = useMutation({
    mutationFn: () => apiRequest('/api/iris/portfolio/import', 'POST', {
      pan: casSubmittedPan,
      holdings: casQuery.data?.data?.holdings ?? [],
    }),
    onSuccess: () => {
      toast({ title: 'Portfolio imported', description: `Holdings for ${casSubmittedPan} saved to IRIS.` });
      qc.invalidateQueries({ queryKey: ['/api/iris/portfolio/external', casSubmittedPan] });
    },
    onError: (e: Error) => toast({ title: 'Import failed', description: e.message, variant: 'destructive' }),
  });

  const generateCasMutation = useMutation({
    mutationFn: () => apiRequest('/api/iris/reports/cas/generate', 'POST', {
      pan: casSubmittedPan,
      email: genEmail || undefined,
    }),
    onSuccess: () => {
      toast({ title: 'CAS statement generated', description: genEmail ? `Sent to ${genEmail}` : 'Available for download.' });
      setGenEmailDialogOpen(false);
    },
    onError: (e: Error) => toast({ title: 'Generation failed', description: e.message, variant: 'destructive' }),
  });

  // ── External Portfolio ─────────────────────────────────────────────────────
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
    mutationFn: (pan: string) => apiRequest(`/api/iris/portfolio/external/${pan}/refresh`, 'POST', {}),
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
    mutationFn: () => apiRequest('/api/iris/portfolio/external/link', 'POST', {
      pan: extSubmittedPan,
      folioNo: linkFolioNo,
      registrar: linkRegistrar,
    }),
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

      {/* ── Section 1: Fetch CAS from Registry ──────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CloudDownload className="h-5 w-5 text-blue-500" />
            Fetch CAS from KFintech Registry
          </CardTitle>
          <CardDescription>
            Pull a client's complete MF portfolio directly from KFintech by PAN — no PDF upload needed.
            Data is sourced live from the registrar's registry.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="PAN (e.g. ABCDE1234F)"
              value={casPan}
              onChange={e => setCasPan(e.target.value.toUpperCase())}
              className="max-w-xs"
            />
            <Button
              onClick={() => setCasSubmittedPan(casPan.trim())}
              disabled={casPan.length < 10 || casQuery.isFetching}
            >
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
                <Button
                  onClick={() => importMutation.mutate()}
                  disabled={importMutation.isPending}
                >
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

      {/* ── Generate CAS Statement Dialog ─────────────────────────────────────── */}
      <Dialog open={genEmailDialogOpen} onOpenChange={setGenEmailDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Generate CAS Statement</DialogTitle>
            <DialogDescription>
              Generate the Consolidated Account Statement for {casSubmittedPan}.
              Optionally send it to the investor's email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Send to Email (optional)</Label>
              <Input
                placeholder="investor@email.com"
                value={genEmail}
                onChange={e => setGenEmail(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setGenEmailDialogOpen(false)}>Cancel</Button>
              <Button
                className="flex-1"
                onClick={() => generateCasMutation.mutate()}
                disabled={generateCasMutation.isPending}
              >
                {generateCasMutation.isPending ? 'Generating…' : 'Generate'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Section 2: External Portfolio ──────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-emerald-500" />
            External Portfolio (Cross-Registrar)
          </CardTitle>
          <CardDescription>
            View and manage externally linked folios for an investor — covers both CAMS and KFintech registrars.
            Imported via CAS or manually linked.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Input
              placeholder="Investor PAN"
              value={extPan}
              onChange={e => setExtPan(e.target.value.toUpperCase())}
              className="max-w-xs"
            />
            <Button
              onClick={() => setExtSubmittedPan(extPan.trim())}
              disabled={extPan.length < 10 || extQuery.isFetching}
            >
              {extQuery.isFetching ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
              Load External Portfolio
            </Button>
            {extSubmittedPan && (
              <>
                <Button
                  variant="outline"
                  onClick={() => refreshMutation.mutate(extSubmittedPan)}
                  disabled={refreshMutation.isPending}
                >
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
                      <td className="p-2">
                        <Badge variant="outline" className="text-xs">{f.registrar ?? 'KFINTECH'}</Badge>
                      </td>
                      <td className="p-2">{f.amcName ?? f.amc ?? '—'}</td>
                      <td className="p-2 text-right">{f.schemeCount ?? '—'}</td>
                      <td className="p-2 text-right">
                        {f.currentValue !== undefined ? `₹${Number(f.currentValue).toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="p-2 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive h-7 px-2"
                          onClick={() => f.folioNo && unlinkMutation.mutate(f.folioNo)}
                          disabled={unlinkMutation.isPending}
                        >
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

      {/* ── Link Folio Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Link External Folio</DialogTitle>
            <DialogDescription>
              Manually link a folio from CAMS or KFintech to investor {extSubmittedPan}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Folio Number</Label>
              <Input
                placeholder="e.g. 1234567/89"
                value={linkFolioNo}
                onChange={e => setLinkFolioNo(e.target.value)}
              />
            </div>
            <div>
              <Label>Registrar</Label>
              <Select value={linkRegistrar} onValueChange={setLinkRegistrar}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="KFINTECH">KFintech</SelectItem>
                  <SelectItem value="CAMS">CAMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setLinkDialogOpen(false)}>Cancel</Button>
              <Button
                className="flex-1"
                onClick={() => linkMutation.mutate()}
                disabled={linkMutation.isPending || !linkFolioNo.trim()}
              >
                {linkMutation.isPending ? 'Linking…' : 'Link Folio'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

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
          <TabsTrigger value="products"><FileText className="h-4 w-4 mr-1 inline" />Products & FD</TabsTrigger>
          <TabsTrigger value="nps"><PiggyBank className="h-4 w-4 mr-1 inline" />NPS</TabsTrigger>
          <TabsTrigger value="reports"><Download className="h-4 w-4 mr-1 inline" />Reports</TabsTrigger>
          <TabsTrigger value="cas-import"><FolderOpen className="h-4 w-4 mr-1 inline" />CAS Import</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4"><DashboardTab /></TabsContent>
        <TabsContent value="empanelment" className="mt-4"><EmpanelmentTab /></TabsContent>
        <TabsContent value="investors" className="mt-4"><InvestorsTab /></TabsContent>
        <TabsContent value="transact" className="mt-4"><TransactTab /></TabsContent>
        <TabsContent value="products" className="mt-4"><ProductsTab /></TabsContent>
        <TabsContent value="nps" className="mt-4"><NpsTab /></TabsContent>
        <TabsContent value="reports" className="mt-4"><ReportsTab /></TabsContent>
        <TabsContent value="cas-import" className="mt-4"><CasImportTab /></TabsContent>
      </Tabs>

      {isAdmin && <AdminOtpDialog open={otpDialogOpen} onClose={() => setOtpDialogOpen(false)} />}
    </div>
  );
}
