/**
 * @file PortfolioBacktestModal.tsx
 * @description Universal Backtesting Dialog for Model Portfolios and Proposals.
 * Displays interactive historical simulations with Equity Curves, Drawdown profiles,
 * Risk KPIs, Calendar Year returns, and SEBI-compliant disclaimers.
 */

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveContainer,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import {
  BarChart3,
  RefreshCw,
  Info,
  Copy,
  Check,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export interface PortfolioBacktestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portfolioId?: string;
  portfolioName?: string;
  proposalId?: string;
  initialBenchmark?: string;
  customConstituents?: Array<{
    symbol: string;
    name?: string;
    weight: number;
    type?: string;
    assetClass?: string;
    schemeCode?: string;
    isin?: string;
  }>;
}

export function PortfolioBacktestModal({
  open,
  onOpenChange,
  portfolioId,
  portfolioName = "Model Portfolio",
  proposalId,
  initialBenchmark = "NIFTY50",
  customConstituents,
}: PortfolioBacktestModalProps) {
  const { toast } = useToast();

  // Configuration State
  const [mode, setMode] = useState<"lumpsum" | "sip">("lumpsum");
  const [period, setPeriod] = useState<"1Y" | "3Y" | "5Y" | "max">("3Y");
  const [initialAmount, setInitialAmount] = useState<number>(100000);
  const [monthlySipAmount, setMonthlySipAmount] = useState<number>(10000);
  const [rebalanceFrequency, setRebalanceFrequency] = useState<
    "none" | "monthly" | "quarterly" | "annual"
  >("quarterly");
  const [benchmarkCode, setBenchmarkCode] = useState<string>(initialBenchmark);
  const [curveType, setCurveType] = useState<"value" | "rebased">("value");

  // Loading & Data State
  const [loading, setLoading] = useState<boolean>(false);
  const [report, setReport] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const fetchBacktest = async (force = false) => {
    if (!open) return;
    setLoading(true);
    setError(null);

    try {
      let endpoint = "";
      let payload: any = {
        mode,
        period,
        rebalanceFrequency,
        benchmarkCode,
        forceRefresh: force,
      };

      if (mode === "lumpsum") {
        payload.initialAmount = initialAmount;
      } else {
        payload.monthlySipAmount = monthlySipAmount;
      }

      if (portfolioId) {
        endpoint = `/api/model-portfolios/${portfolioId}/backtest`;
      } else if (proposalId) {
        endpoint = `/api/unified-proposals/${proposalId}/backtest`;
      } else if (customConstituents && customConstituents.length > 0) {
        endpoint = "/api/model-portfolios/backtest-custom";
        payload.strategyName = portfolioName;
        payload.constituents = customConstituents;
      } else {
        throw new Error("No portfolio or proposal identifier provided");
      }

      const res = await apiRequest("POST", endpoint, payload);
      const json = await res.json();

      if (json.success && json.data) {
        setReport(json.data);
      } else if (json.data) {
        setReport(json.data);
      } else {
        throw new Error(json.message || "Failed to generate backtest report");
      }
    } catch (err: any) {
      console.error("[BacktestModal] Error running backtest:", err);
      setError(err.message || "Could not complete backtest");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchBacktest();
    }
  }, [open, portfolioId, proposalId, period, mode, rebalanceFrequency, benchmarkCode]);

  const copySummaryToClipboard = () => {
    if (!report) return;
    const summary = `📊 *Backtest Report: ${report.strategyName}*
• Mode: ${report.mode === "sip" ? `SIP (₹${report.monthlySipAmount?.toLocaleString()}/mo)` : `Lump-Sum (₹${report.initialAmount?.toLocaleString()})`}
• Horizon: ${report.startDate} to ${report.endDate} (${period})
• Benchmark: ${report.benchmarkName}
• Portfolio CAGR: ${report.metrics.cagr}% vs Benchmark: ${report.metrics.benchmarkCagr}%
• Total Return: ${report.metrics.totalReturn}%
• Sharpe Ratio: ${report.metrics.sharpeRatio}
• Max Drawdown: ${report.metrics.maxDrawdown}%
• Final Corpus: ₹${report.metrics.finalValue?.toLocaleString()}
(Engine: ${report.engineVersion} · Powered by FintekPro DSS)`;

    navigator.clipboard.writeText(summary);
    setCopied(true);
    toast({
      title: "Summary Copied",
      description: "Backtest KPI summary copied to clipboard.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const formatINR = (val: number) => {
    if (val == null || Number.isNaN(val)) return "₹0";
    return `₹${Math.round(val).toLocaleString("en-IN")}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-6 overflow-hidden">
        {/* Header */}
        <DialogHeader className="space-y-1 pb-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  <span>{portfolioName}</span>
                  <Badge variant="outline" className="text-xs bg-indigo-50/50 text-indigo-700 font-mono">
                    Historical Backtest
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Simulate risk, compounding returns, and market crash resilience with periodic rebalancing
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={copySummaryToClipboard}
                disabled={!report || loading}
                className="h-8 gap-1.5 text-xs"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                Copy Summary
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => fetchBacktest(true)}
                disabled={loading}
                className="h-8 gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                Re-Run
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Interactive Controls Bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 py-3 px-1 border-b bg-muted/20 rounded-lg my-2 shrink-0 text-xs">
          {/* Mode */}
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">Investment Mode</Label>
            <div className="flex rounded-md p-0.5 bg-muted">
              <button
                type="button"
                onClick={() => setMode("lumpsum")}
                className={`flex-1 py-1 px-2 rounded text-[11px] font-medium transition-colors ${
                  mode === "lumpsum" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                Lump-Sum
              </button>
              <button
                type="button"
                onClick={() => setMode("sip")}
                className={`flex-1 py-1 px-2 rounded text-[11px] font-medium transition-colors ${
                  mode === "sip" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                Monthly SIP
              </button>
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">
              {mode === "lumpsum" ? "Initial Capital (₹)" : "Monthly SIP (₹)"}
            </Label>
            <Input
              type="number"
              value={mode === "lumpsum" ? initialAmount : monthlySipAmount}
              onChange={(e) => {
                const val = Number(e.target.value) || 0;
                if (mode === "lumpsum") setInitialAmount(val);
                else setMonthlySipAmount(val);
              }}
              className="h-8 text-xs font-mono"
            />
          </div>

          {/* Lookback Horizon */}
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">Horizon Period</Label>
            <Select value={period} onValueChange={(val: any) => setPeriod(val)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1Y">1 Year (12M)</SelectItem>
                <SelectItem value="3Y">3 Years (36M)</SelectItem>
                <SelectItem value="5Y">5 Years (60M)</SelectItem>
                <SelectItem value="max">Max (10 Years)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Rebalancing Frequency */}
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">Rebalancing</Label>
            <Select value={rebalanceFrequency} onValueChange={(val: any) => setRebalanceFrequency(val)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Buy & Hold (None)</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly (Recommended)</SelectItem>
                <SelectItem value="annual">Annually</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Benchmark */}
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">Benchmark</Label>
            <Select value={benchmarkCode} onValueChange={(val) => setBenchmarkCode(val)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Benchmark" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NIFTY50">NIFTY 50 TRI</SelectItem>
                <SelectItem value="NIFTY500">NIFTY 500 TRI</SelectItem>
                <SelectItem value="NIFTYMIDCAP150">NIFTY Midcap 150</SelectItem>
                <SelectItem value="CRISIL_HYBRID">CRISIL Hybrid 35:65</SelectItem>
                <SelectItem value="CRISIL_DEBT">CRISIL Composite Debt</SelectItem>
                <SelectItem value="GOLD">Domestic Gold</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 rounded-lg text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading && !report && (
            <div className="py-20 flex flex-col items-center justify-center space-y-3">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
              <p className="text-xs text-muted-foreground">
                Executing multi-asset historical alignment & price simulation...
              </p>
            </div>
          )}

          {report && (
            <>
              {/* Executive Summary KPI Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
                {/* CAGR */}
                <Card className="border-indigo-100 dark:border-indigo-900 bg-gradient-to-br from-indigo-50/40 to-white dark:from-indigo-950/20 dark:to-background">
                  <CardContent className="p-2.5">
                    <p className="text-[10px] text-muted-foreground font-medium">CAGR</p>
                    <p className="text-base font-bold text-indigo-600 mt-0.5">
                      {report.metrics.cagr >= 0 ? "+" : ""}
                      {report.metrics.cagr}%
                    </p>
                    <p className="text-[9px] text-muted-foreground truncate">
                      vs {report.metrics.benchmarkCagr}% Bench
                    </p>
                  </CardContent>
                </Card>

                {/* Total Return */}
                <Card className="border-border/60">
                  <CardContent className="p-2.5">
                    <p className="text-[10px] text-muted-foreground font-medium">Total Return</p>
                    <p className="text-base font-bold text-foreground mt-0.5">
                      {report.metrics.totalReturn >= 0 ? "+" : ""}
                      {report.metrics.totalReturn}%
                    </p>
                    <p className="text-[9px] text-emerald-600 font-medium truncate">
                      {report.metrics.totalReturn >= report.metrics.benchmarkTotalReturn ? "Outperforming" : "Lagging"}
                    </p>
                  </CardContent>
                </Card>

                {/* Sharpe Ratio */}
                <Card className="border-border/60">
                  <CardContent className="p-2.5">
                    <p className="text-[10px] text-muted-foreground font-medium">Sharpe Ratio</p>
                    <p className="text-base font-bold text-foreground mt-0.5">
                      {report.metrics.sharpeRatio}
                    </p>
                    <p className="text-[9px] text-muted-foreground">Rf = 6.5% G-Sec</p>
                  </CardContent>
                </Card>

                {/* Sortino Ratio */}
                <Card className="border-border/60">
                  <CardContent className="p-2.5">
                    <p className="text-[10px] text-muted-foreground font-medium">Sortino Ratio</p>
                    <p className="text-base font-bold text-foreground mt-0.5">
                      {report.metrics.sortinoRatio}
                    </p>
                    <p className="text-[9px] text-muted-foreground">Downside risk</p>
                  </CardContent>
                </Card>

                {/* Max Drawdown */}
                <Card className="border-border/60">
                  <CardContent className="p-2.5">
                    <p className="text-[10px] text-muted-foreground font-medium">Max Drawdown</p>
                    <p className="text-base font-bold text-red-600 mt-0.5">
                      {report.metrics.maxDrawdown}%
                    </p>
                    <p className="text-[9px] text-muted-foreground truncate">
                      vs {report.metrics.benchmarkMaxDrawdown}%
                    </p>
                  </CardContent>
                </Card>

                {/* Volatility */}
                <Card className="border-border/60">
                  <CardContent className="p-2.5">
                    <p className="text-[10px] text-muted-foreground font-medium">Annual Volatility</p>
                    <p className="text-base font-bold text-foreground mt-0.5">
                      {report.metrics.annualizedVolatility}%
                    </p>
                    <p className="text-[9px] text-muted-foreground">Std Dev (252d)</p>
                  </CardContent>
                </Card>

                {/* Alpha */}
                <Card className="border-border/60">
                  <CardContent className="p-2.5">
                    <p className="text-[10px] text-muted-foreground font-medium">Jensen's Alpha</p>
                    <p className="text-base font-bold text-emerald-600 mt-0.5">
                      {report.metrics.alpha >= 0 ? "+" : ""}
                      {report.metrics.alpha}%
                    </p>
                    <p className="text-[9px] text-muted-foreground">Beta: {report.metrics.beta}</p>
                  </CardContent>
                </Card>

                {/* Final Value */}
                <Card className="border-emerald-200 dark:border-emerald-900 bg-emerald-50/30 dark:bg-emerald-950/20">
                  <CardContent className="p-2.5">
                    <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">Final Corpus</p>
                    <p className="text-base font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                      {formatINR(report.metrics.finalValue)}
                    </p>
                    <p className="text-[9px] text-muted-foreground truncate">
                      Invested: {formatINR(report.metrics.totalInvested)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Tabs Visualizations */}
              <Tabs defaultValue="equity" className="w-full">
                <div className="flex items-center justify-between border-b pb-2">
                  <TabsList className="h-8">
                    <TabsTrigger value="equity" className="text-xs">
                      📈 Growth Curve
                    </TabsTrigger>
                    <TabsTrigger value="drawdown" className="text-xs">
                      📉 Underwater Drawdown
                    </TabsTrigger>
                    <TabsTrigger value="annual" className="text-xs">
                      📅 Annual Returns
                    </TabsTrigger>
                    <TabsTrigger value="constituents" className="text-xs">
                      📋 Constituents ({report.constituents?.length || 0})
                    </TabsTrigger>
                  </TabsList>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">Scale:</span>
                    <Button
                      variant={curveType === "value" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setCurveType("value")}
                      className="h-6 text-[10px] px-2"
                    >
                      Rupee Value
                    </Button>
                    <Button
                      variant={curveType === "rebased" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setCurveType("rebased")}
                      className="h-6 text-[10px] px-2"
                    >
                      Base 100
                    </Button>
                  </div>
                </div>

                {/* Equity Curve Tab */}
                <TabsContent value="equity" className="pt-3">
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={report.equityCurve}>
                        <defs>
                          <linearGradient id="portGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                          </linearGradient>
                          <linearGradient id="benchGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10 }}
                          tickFormatter={(str) => {
                            const [y, m] = str.split("-");
                            return `${m}/${y.substring(2)}`;
                          }}
                        />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          domain={["auto", "auto"]}
                          tickFormatter={(v) => (curveType === "value" ? `₹${(v / 1000).toFixed(0)}k` : v)}
                        />
                        <RechartsTooltip
                          formatter={(value: any, name: string) => [
                            curveType === "value" ? formatINR(Number(value)) : Number(value).toFixed(2),
                            name === "portfolioValue" || name === "rebasedPortfolio"
                              ? report.strategyName
                              : report.benchmarkName,
                          ]}
                          labelFormatter={(label) => `Date: ${label}`}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                          formatter={(val) =>
                            val === "portfolioValue" || val === "rebasedPortfolio"
                              ? `${report.strategyName} (Portfolio)`
                              : `${report.benchmarkName} (Benchmark)`
                          }
                        />
                        <Area
                          type="monotone"
                          dataKey={curveType === "value" ? "portfolioValue" : "rebasedPortfolio"}
                          stroke="#4f46e5"
                          strokeWidth={2}
                          fill="url(#portGrad)"
                        />
                        <Line
                          type="monotone"
                          dataKey={curveType === "value" ? "benchmarkValue" : "rebasedBenchmark"}
                          stroke="#64748b"
                          strokeWidth={1.5}
                          strokeDasharray="4 4"
                          dot={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>

                {/* Underwater Drawdown Tab */}
                <TabsContent value="drawdown" className="pt-3">
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={report.drawdownCurve}>
                        <defs>
                          <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.0} />
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0.3} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10 }}
                          tickFormatter={(str) => {
                            const [y, m] = str.split("-");
                            return `${m}/${y.substring(2)}`;
                          }}
                        />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} domain={["auto", 0]} />
                        <RechartsTooltip
                          formatter={(value: any, name: string) => [
                            `${Number(value).toFixed(2)}%`,
                            name === "portfolioDrawdown" ? "Portfolio Drawdown" : "Benchmark Drawdown",
                          ]}
                        />
                        <ReferenceLine y={0} stroke="#64748b" />
                        <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                        <Area
                          type="monotone"
                          dataKey="portfolioDrawdown"
                          stroke="#ef4444"
                          strokeWidth={1.5}
                          fill="url(#ddGrad)"
                        />
                        <Line
                          type="monotone"
                          dataKey="benchmarkDrawdown"
                          stroke="#94a3b8"
                          strokeWidth={1}
                          strokeDasharray="3 3"
                          dot={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>

                {/* Annual Returns Tab */}
                <TabsContent value="annual" className="pt-3">
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={report.yearByYearReturns}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                        <RechartsTooltip
                          formatter={(value: any, name: string) => [
                            `${Number(value).toFixed(2)}%`,
                            name === "portfolioReturn" ? "Portfolio" : "Benchmark",
                          ]}
                        />
                        <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                        <ReferenceLine y={0} stroke="#64748b" />
                        <Bar dataKey="portfolioReturn" name="Portfolio Return" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="benchmarkReturn" name="Benchmark Return" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>

                {/* Constituents Breakdown Tab */}
                <TabsContent value="constituents" className="pt-2">
                  <div className="border rounded-lg overflow-hidden max-h-[260px] overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/50 border-b text-[10px] uppercase font-semibold text-muted-foreground sticky top-0">
                        <tr>
                          <th className="py-2 px-3">Instrument</th>
                          <th className="py-2 px-2 text-right">Target Weight</th>
                          <th className="py-2 px-2 text-right">Start NAV</th>
                          <th className="py-2 px-2 text-right">End NAV</th>
                          <th className="py-2 px-2 text-right">Return (%)</th>
                          <th className="py-2 px-2 text-right">CAGR</th>
                          <th className="py-2 px-2 text-right">Max DD</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {report.constituents?.map((c: any, idx: number) => (
                          <tr key={idx} className="hover:bg-muted/20">
                            <td className="py-2 px-3">
                              <div className="font-medium text-foreground">{c.name}</div>
                              <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-1.5">
                                <span>{c.symbol}</span>
                                <span>·</span>
                                <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                                  {c.assetClass}
                                </Badge>
                              </div>
                            </td>
                            <td className="py-2 px-2 text-right font-medium">{c.weight}%</td>
                            <td className="py-2 px-2 text-right text-muted-foreground font-mono">
                              ₹{c.startPrice}
                            </td>
                            <td className="py-2 px-2 text-right text-muted-foreground font-mono">₹{c.endPrice}</td>
                            <td
                              className={`py-2 px-2 text-right font-semibold ${
                                c.totalReturn >= 0 ? "text-emerald-600" : "text-red-600"
                              }`}
                            >
                              {c.totalReturn >= 0 ? "+" : ""}
                              {c.totalReturn}%
                            </td>
                            <td className="py-2 px-2 text-right font-medium">{c.cagr}%</td>
                            <td className="py-2 px-2 text-right text-red-600">{c.maxDrawdown}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>
              </Tabs>

              {/* SEBI Statutory Risk Disclaimer & Engine Footer */}
              <div className="p-3 bg-muted/40 rounded-lg text-[10px] text-muted-foreground space-y-1 mt-2">
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Info className="w-3.5 h-3.5 text-indigo-600" />
                  <span>SEBI Regulatory & Methodology Disclosures</span>
                </div>
                <p>
                  • Backtesting is performed using historical price series with {rebalanceFrequency} rebalancing and common-period benchmark alignment.
                </p>
                <p>
                  • Past performance is not indicative of future returns. Investments in securities are subject to market risks. Read all offer documents carefully.
                </p>
                <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[9px]">
                  <span>Engine: {report.engineVersion} · Standard: FASP-AI v3.1</span>
                  <span>Calculated: {new Date(report.calculationTimestamp).toLocaleString("en-IN")}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
