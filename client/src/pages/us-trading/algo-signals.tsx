/**
 * AlgoSignalsView — FintekPro US Trading Hub
 *
 * FASP-AI v1.0: Decision Support System only.
 * Every signal shows confidence, factors, model version, and mandatory disclaimer.
 * "Approve" flows into the order placement confirmation, NOT direct execution.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Zap, TrendingUp, TrendingDown, Minus, AlertTriangle,
  ChevronDown, ChevronUp, RefreshCw, CheckCircle, XCircle,
  BarChart3, Info, Loader2, Activity, Target, ShieldAlert,
  BarChart2, Eye
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SignalFactors {
  currentPrice: number;
  sma20: number;
  sma50: number;
  rsi14: number;
  volumeRatio: number;
  momentum20d: number;
  high20d: number;
  low20d: number;
  atr14: number;
  smaScore: number;
  rsiScore: number;
  momentumScore: number;
}

interface AlgoSignal {
  id: number;
  symbol: string;
  companyName?: string;
  strategy: string;
  signal: "buy" | "sell" | "watch" | "hold";
  confidenceScore: number;
  suggestedQty?: string;
  suggestedNotional?: string;
  entryPrice?: string;
  targetPrice?: string;
  stopLossPrice?: string;
  factors?: SignalFactors;
  modelVersion: string;
  riskProfile?: string;
  status: "pending" | "approved" | "rejected" | "expired";
  disclaimer?: string;
  expiresAt?: string;
  createdAt: string;
}

interface Performance {
  total: number;
  approved: number;
  rejected: number;
  pending: number;
  expired: number;
  bySignal: Record<string, number>;
  avgConfidence: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SIGNAL_META = {
  buy:   { label: "BUY",   color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: TrendingUp },
  sell:  { label: "SELL",  color: "text-rose-500",    bg: "bg-rose-500/10",    border: "border-rose-500/20",    icon: TrendingDown },
  watch: { label: "WATCH", color: "text-amber-500",   bg: "bg-amber-500/10",   border: "border-amber-500/20",   icon: Eye },
  hold:  { label: "HOLD",  color: "text-slate-400",   bg: "bg-slate-500/10",   border: "border-slate-500/20",   icon: Minus },
};

function confidenceColor(score: number) {
  if (score >= 75) return "text-emerald-500";
  if (score >= 60) return "text-blue-500";
  if (score >= 40) return "text-amber-500";
  return "text-slate-400";
}

function scoreBar(score: number) {
  // score is -1 to +1, normalize to 0-100
  return Math.round((score + 1) / 2 * 100);
}

// ─── Signal Card ─────────────────────────────────────────────────────────────

function SignalCard({
  signal,
  onApprove,
  onReject,
  isActing,
}: {
  signal: AlgoSignal;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  isActing: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = SIGNAL_META[signal.signal] ?? SIGNAL_META.hold;
  const Icon = meta.icon;
  const factors = signal.factors;
  const isPending = signal.status === "pending";

  return (
    <Card className={cn(
      "border rounded-3xl overflow-hidden transition-all duration-300 group",
      "bg-card/80 backdrop-blur-sm shadow-xl hover:shadow-2xl",
      signal.status === "approved" && "opacity-60 saturate-50",
      signal.status === "rejected" && "opacity-40",
    )}>
      {/* Header */}
      <div className={cn("p-6 border-b", meta.bg, meta.border, "border")}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg", meta.bg)}>
              <Icon className={cn("h-6 w-6", meta.color)} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xl font-black tracking-tight">{signal.symbol}</span>
                <Badge className={cn("text-[10px] font-black uppercase px-2 py-0.5 rounded-full border-0", meta.bg, meta.color)}>
                  {meta.label}
                </Badge>
                {signal.riskProfile && (
                  <Badge variant="outline" className="text-[9px] font-bold uppercase">
                    {signal.riskProfile}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-bold mt-0.5 uppercase tracking-wider">
                {signal.strategy.replace(/_/g, " ")} · {signal.modelVersion}
              </p>
            </div>
          </div>

          {/* Confidence Badge */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className={cn("text-3xl font-black tabular-nums", confidenceColor(signal.confidenceScore))}>
              {signal.confidenceScore}%
            </span>
            <span className="text-[9px] text-muted-foreground font-black uppercase tracking-widest">Confidence</span>
            <Progress value={signal.confidenceScore} className="w-20 h-1.5 mt-1" />
          </div>
        </div>
      </div>

      <CardContent className="p-6 space-y-5">
        {/* Price Levels */}
        {signal.entryPrice && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Entry",    value: signal.entryPrice,    color: "text-foreground" },
              { label: "Target",   value: signal.targetPrice,   color: "text-emerald-500" },
              { label: "Stop",     value: signal.stopLossPrice, color: "text-rose-500" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-muted/40 rounded-2xl p-4 text-center">
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
                <p className={cn("text-sm font-black tabular-nums", color)}>
                  ${parseFloat(value || "0").toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Suggested size */}
        {signal.suggestedNotional && (
          <div className="flex items-center justify-between text-sm px-1">
            <span className="text-muted-foreground font-bold">Suggested Size</span>
            <span className="font-black">${parseFloat(signal.suggestedNotional).toLocaleString()} USD</span>
          </div>
        )}

        {/* Expand Factors */}
        {factors && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="w-full flex items-center justify-between text-xs text-muted-foreground font-black uppercase tracking-widest hover:text-foreground transition-colors py-2 border-t"
          >
            <span>Signal Factors</span>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        )}

        {expanded && factors && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
            {[
              {
                label: "SMA Crossover",
                detail: `SMA-20: $${factors.sma20.toFixed(2)} vs SMA-50: $${factors.sma50.toFixed(2)}`,
                score: factors.smaScore,
                hint: factors.sma20 > factors.sma50 ? "Bullish crossover ↑" : "Bearish crossover ↓",
                hintColor: factors.sma20 > factors.sma50 ? "text-emerald-500" : "text-rose-500",
              },
              {
                label: "RSI (14)",
                detail: `RSI: ${factors.rsi14.toFixed(1)}${factors.rsi14 < 30 ? " — Oversold" : factors.rsi14 > 70 ? " — Overbought" : " — Neutral"}`,
                score: factors.rsiScore,
                hint: factors.rsi14 < 30 ? "Buy signal" : factors.rsi14 > 70 ? "Sell signal" : "No signal",
                hintColor: factors.rsi14 < 30 ? "text-emerald-500" : factors.rsi14 > 70 ? "text-rose-500" : "text-muted-foreground",
              },
              {
                label: "Momentum (20d)",
                detail: `${factors.momentum20d > 0 ? "+" : ""}${factors.momentum20d.toFixed(1)}% · Vol ratio: ${factors.volumeRatio.toFixed(2)}x`,
                score: factors.momentumScore,
                hint: factors.volumeRatio > 1.3 ? "High volume conviction" : "Normal volume",
                hintColor: factors.volumeRatio > 1.3 ? "text-blue-500" : "text-muted-foreground",
              },
            ].map(({ label, detail, score, hint, hintColor }) => (
              <div key={label} className="bg-muted/30 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black">{label}</span>
                  <span className={cn("text-xs font-bold", hintColor)}>{hint}</span>
                </div>
                <p className="text-[10px] text-muted-foreground font-mono">{detail}</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        score > 0 ? "bg-emerald-500" : "bg-rose-500",
                        "ml-auto"
                      )}
                      style={{
                        width: `${Math.abs(score) * 100}%`,
                        marginLeft: score > 0 ? "50%" : undefined,
                        marginRight: score < 0 ? "50%" : undefined,
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-black tabular-nums w-10 text-right">
                    {score > 0 ? "+" : ""}{(score * 100).toFixed(0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Disclaimer */}
        <div className="flex items-start gap-2 p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            <span className="font-black text-amber-500">Risk Disclosure: </span>
            This signal is for informational purposes only. Not financial advice.
            Past performance does not guarantee future results. Capital is at risk.
          </p>
        </div>

        {/* Status badge for non-pending */}
        {!isPending && (
          <div className={cn(
            "flex items-center gap-2 p-3 rounded-2xl text-xs font-bold",
            signal.status === "approved" && "bg-emerald-500/10 text-emerald-600",
            signal.status === "rejected" && "bg-rose-500/10 text-rose-600",
            signal.status === "expired"  && "bg-slate-500/10 text-slate-500",
          )}>
            {signal.status === "approved" && <CheckCircle className="h-4 w-4" />}
            {signal.status === "rejected" && <XCircle className="h-4 w-4" />}
            {signal.status === "expired"  && <AlertTriangle className="h-4 w-4" />}
            Signal {signal.status.charAt(0).toUpperCase() + signal.status.slice(1)}
          </div>
        )}

        {/* Actions */}
        {isPending && (
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 rounded-2xl border-rose-200 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 font-bold"
              onClick={() => onReject(signal.id)}
              disabled={isActing}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
            <Button
              size="sm"
              className="flex-1 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-500/20"
              onClick={() => onApprove(signal.id)}
              disabled={isActing}
            >
              {isActing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Review &amp; Approve
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Generate Panel ──────────────────────────────────────────────────────────

function GeneratePanel({ onGenerated }: { onGenerated: () => void }) {
  const [symbols, setSymbols] = useState("AAPL,MSFT,GOOGL,NVDA,TSLA");
  const [riskProfile, setRiskProfile] = useState("moderate");
  const [horizon, setHorizon] = useState("medium");
  const { toast } = useToast();

  const generateMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/us-trading/algo/signals/generate", {
        symbols: symbols.split(",").map(s => s.trim()).filter(Boolean),
        riskProfile,
        investmentHorizon: horizon,
      }),
    onSuccess: (data: any) => {
      toast({
        title: `${data.data?.generated ?? 0} signals generated`,
        description: "Review each signal before acting.",
      });
      onGenerated();
    },
    onError: (err: any) => {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Card className="border-none shadow-2xl rounded-3xl bg-gradient-to-br from-slate-900 to-indigo-950 text-white overflow-hidden relative">
      <div className="absolute top-0 right-0 p-12 opacity-5">
        <Zap className="h-48 w-48" />
      </div>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center">
            <Zap className="h-5 w-5 text-yellow-400" />
          </div>
          <div>
            <CardTitle className="text-white text-lg font-black">Generate Signals</CardTitle>
            <CardDescription className="text-white/50 text-xs font-bold">
              Composite SMA + RSI + Momentum analysis
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 relative z-10">
        <div>
          <label className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-1.5 block">
            Symbols (comma-separated, max 20)
          </label>
          <input
            value={symbols}
            onChange={e => setSymbols(e.target.value.toUpperCase())}
            className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-sm font-mono text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 transition-all"
            placeholder="AAPL, MSFT, GOOGL..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-1.5 block">Risk Profile</label>
            <select
              value={riskProfile}
              onChange={e => setRiskProfile(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-sm text-white font-bold focus:outline-none focus:ring-2 focus:ring-yellow-400/40 appearance-none cursor-pointer"
            >
              <option value="conservative" className="bg-slate-900">Conservative</option>
              <option value="moderate"     className="bg-slate-900">Moderate</option>
              <option value="aggressive"   className="bg-slate-900">Aggressive</option>
              <option value="very_aggressive" className="bg-slate-900">Very Aggressive</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-1.5 block">Horizon</label>
            <select
              value={horizon}
              onChange={e => setHorizon(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-sm text-white font-bold focus:outline-none focus:ring-2 focus:ring-yellow-400/40 appearance-none cursor-pointer"
            >
              <option value="short"  className="bg-slate-900">Short Term</option>
              <option value="medium" className="bg-slate-900">Medium Term</option>
              <option value="long"   className="bg-slate-900">Long Term</option>
            </select>
          </div>
        </div>

        {/* Strategy badges */}
        <div className="flex gap-2 flex-wrap">
          {["SMA Crossover", "RSI Mean Reversion", "Momentum"].map(s => (
            <Badge key={s} className="bg-white/10 text-white/70 border-white/20 text-[9px] font-bold rounded-full px-3">
              ✓ {s}
            </Badge>
          ))}
        </div>

        <Button
          className="w-full rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-black font-black shadow-xl shadow-yellow-400/20 h-12 text-sm"
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
        >
          {generateMutation.isPending ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing markets...</>
          ) : (
            <><Zap className="h-4 w-4 mr-2" />Run Signal Analysis</>
          )}
        </Button>

        <p className="text-[10px] text-white/30 text-center font-bold leading-relaxed">
          Signals expire at NYSE close (4 PM ET). Not financial advice.
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Performance Panel ────────────────────────────────────────────────────────

function PerformancePanel() {
  const { data, isLoading } = useQuery<{ success: boolean; data: Performance }>({
    queryKey: ["/api/us-trading/algo/performance"],
    staleTime: 30_000,
  });

  const perf = data?.data;

  if (isLoading) return (
    <Card className="border-none shadow-xl rounded-3xl p-8 flex items-center justify-center bg-card">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </Card>
  );

  if (!perf || perf.total === 0) return (
    <Card className="border-none shadow-xl rounded-3xl bg-card">
      <CardContent className="p-8 text-center text-muted-foreground">
        <Activity className="h-8 w-8 mx-auto mb-3 opacity-30" />
        <p className="text-sm font-bold">No signal history yet.</p>
        <p className="text-xs mt-1">Generate your first signals to see performance.</p>
      </CardContent>
    </Card>
  );

  return (
    <Card className="border-none shadow-xl rounded-3xl bg-card">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-black flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-primary" /> Signal Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Total",     value: perf.total,    color: "text-foreground" },
            { label: "Approved",  value: perf.approved, color: "text-emerald-500" },
            { label: "Rejected",  value: perf.rejected, color: "text-rose-500" },
            { label: "Avg Conf.", value: `${perf.avgConfidence}%`, color: confidenceColor(perf.avgConfidence) },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-muted/40 rounded-2xl p-4 text-center">
              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
              <p className={cn("text-xl font-black tabular-nums", color)}>{value}</p>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          {Object.entries(perf.bySignal).filter(([, v]) => v > 0).map(([signal, count]) => {
            const meta = SIGNAL_META[signal as keyof typeof SIGNAL_META];
            return (
              <div key={signal} className="flex items-center gap-3">
                <Badge className={cn("text-[9px] font-black w-14 justify-center", meta?.bg, meta?.color)}>
                  {signal.toUpperCase()}
                </Badge>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", signal === "buy" ? "bg-emerald-500" : signal === "sell" ? "bg-rose-500" : "bg-amber-400")}
                    style={{ width: `${Math.round((count / perf.total) * 100)}%` }}
                  />
                </div>
                <span className="text-xs font-black w-6 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function AlgoSignalsView() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [actingId, setActingId] = useState<number | null>(null);

  const { data: signalsData, isLoading, refetch } = useQuery<{ success: boolean; data: AlgoSignal[] }>({
    queryKey: ["/api/us-trading/algo/signals", statusFilter],
    queryFn: () =>
      apiRequest("GET", `/api/us-trading/algo/signals?status=${statusFilter === "all" ? "" : statusFilter}&limit=50`),
    staleTime: 15_000,
  });

  const signals = signalsData?.data ?? [];

  const approveMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/us-trading/algo/signals/${id}/approve`, {}),
    onMutate: (id) => setActingId(id),
    onSuccess: (_, id) => {
      toast({ title: "Signal approved", description: "Signal marked as approved. Place your order when ready." });
      queryClient.invalidateQueries({ queryKey: ["/api/us-trading/algo/signals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/us-trading/algo/performance"] });
      setActingId(null);
    },
    onError: (err: any) => {
      toast({ title: "Approval failed", description: err.message, variant: "destructive" });
      setActingId(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/us-trading/algo/signals/${id}/reject`, {}),
    onMutate: (id) => setActingId(id),
    onSuccess: () => {
      toast({ title: "Signal dismissed" });
      queryClient.invalidateQueries({ queryKey: ["/api/us-trading/algo/signals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/us-trading/algo/performance"] });
      setActingId(null);
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
      setActingId(null);
    },
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tighter flex items-center gap-3">
            <Zap className="h-7 w-7 text-yellow-500" /> Algo Signals
          </h1>
          <p className="text-muted-foreground text-sm font-bold mt-1">
            AI-powered decision support · SMA + RSI + Momentum composite
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl font-bold gap-2"
          onClick={() => refetch()}
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* FASP-AI Disclaimer Banner */}
      <div className="flex items-start gap-3 p-5 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
        <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-black text-amber-600 dark:text-amber-400">Decision Support System (DSS) — Not Autonomous Trading</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Signals generated by algo-v1.0 are algorithmic suggestions only. They do not constitute financial advice
            or a guarantee of returns. All trade execution requires explicit user confirmation. Capital is at risk.
            Consult a SEBI-registered Investment Advisor before acting.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Generate + Performance */}
        <div className="space-y-6">
          <GeneratePanel onGenerated={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/us-trading/algo/signals"] });
            queryClient.invalidateQueries({ queryKey: ["/api/us-trading/algo/performance"] });
          }} />
          <PerformancePanel />
        </div>

        {/* Right: Signal list */}
        <div className="lg:col-span-2 space-y-6">
          {/* Filter tabs */}
          <div className="flex gap-2 flex-wrap">
            {(["pending", "approved", "rejected", "all"] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-all",
                  statusFilter === s
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Empty */}
          {!isLoading && signals.length === 0 && (
            <Card className="border-none shadow-xl rounded-3xl bg-card">
              <CardContent className="p-16 text-center">
                <div className="w-16 h-16 bg-muted rounded-3xl flex items-center justify-center mx-auto mb-4">
                  <Zap className="h-8 w-8 text-muted-foreground opacity-30" />
                </div>
                <p className="font-black text-lg text-foreground">No signals yet</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Enter symbols on the left and click <span className="font-bold text-primary">Run Signal Analysis</span>.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Signal cards */}
          <div className="space-y-5">
            {signals.map(signal => (
              <SignalCard
                key={signal.id}
                signal={signal}
                onApprove={(id) => approveMutation.mutate(id)}
                onReject={(id) => rejectMutation.mutate(id)}
                isActing={actingId === signal.id && (approveMutation.isPending || rejectMutation.isPending)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
