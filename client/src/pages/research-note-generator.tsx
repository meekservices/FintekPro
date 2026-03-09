import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AgentLayout } from "@/components/layout/agent-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  FileText,
  PresentationIcon,
  Download,
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  Building2,
  BarChart3,
  Target,
  ShieldAlert,
  Loader2,
  Info,
  DollarSign,
  Percent,
} from "lucide-react";

interface FinancialData {
  price: number | null;
  previousClose: number | null;
  marketCap: number | null;
  pe: number | null;
  eps: number | null;
  roe: number | null;
  debtToEquity: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  dividendYield: number | null;
  beta: number | null;
  targetMeanPrice: number | null;
  currency: string;
}

interface RatingBreakdown {
  fundamentals: number;
  valuation: number;
  momentum: number;
}

interface RatingResult {
  rating: string;
  score: number;
  breakdown: RatingBreakdown;
  rationale: string;
}

interface PriceLevels {
  support: number;
  resistance: number;
  stopLoss: number;
  target1: number;
  target2: number;
}

interface PreviewData {
  symbol: string;
  companyName: string;
  exchange: string;
  financials: FinancialData;
  rating: RatingResult;
  levels: PriceLevels;
  weekRange52Position: string;
  valuationSummary: string;
  generatedAt: string;
}

function fmt(val: number | null, prefix = "", suffix = "", decimals = 2): string {
  if (val === null || val === undefined) return "N/A";
  return `${prefix}${val.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;
}

function fmtPct(val: number | null): string {
  if (val === null || val === undefined) return "N/A";
  return `${(val * 100).toFixed(2)}%`;
}

function fmtCap(val: number | null): string {
  if (!val) return "N/A";
  if (val >= 1e12) return `₹${(val / 1e12).toFixed(2)}T`;
  if (val >= 1e9) return `₹${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e7) return `₹${(val / 1e7).toFixed(2)} Cr`;
  return `₹${val.toFixed(0)}`;
}

function RatingBadge({ rating }: { rating: string }) {
  const isBuy = rating.includes("BUY");
  const isHold = rating === "HOLD";
  const color = isBuy ? "bg-green-600" : isHold ? "bg-amber-500" : "bg-red-600";
  const Icon = isBuy ? TrendingUp : isHold ? Minus : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-white font-bold text-sm ${color}`}>
      <Icon className="h-4 w-4" />
      {rating}
    </span>
  );
}

function ScoreBar({ label, score, weight }: { label: string; score: number; weight: string }) {
  const color = score >= 65 ? "bg-green-500" : score >= 45 ? "bg-amber-400" : "bg-red-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label} <span className="text-xs">({weight})</span></span>
        <span className="font-semibold">{score}/100</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function MetricCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? "border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800" : "bg-card"}`}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-base font-bold ${highlight ? "text-blue-700 dark:text-blue-300" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

export default function ResearchNoteGenerator() {
  const [query, setQuery] = useState("");
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const { toast } = useToast();

  const previewMutation = useMutation({
    mutationFn: async (symbol: string) => {
      return await apiRequest("/api/research-note/preview", "POST", { body: { symbol } });
    },
    onSuccess: (data: PreviewData) => {
      setPreviewData(data);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to fetch data", variant: "destructive" });
    },
  });

  const downloadMutation = useMutation({
    mutationFn: async ({ type }: { type: "ppt" | "pdf" | "onepager" }) => {
      const res = await fetch(`/api/research-note/generate/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: query }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Generation failed");
      }
      const blob = await res.blob();
      const contentDisposition = res.headers.get("Content-Disposition") || "";
      const match = contentDisposition.match(/filename="(.+?)"/);
      const filename = match ? match[1] : `Research_${type}.${type === "ppt" ? "pptx" : "pdf"}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast({ title: "Download started", description: "Your report is downloading." });
    },
    onError: (err: any) => {
      toast({ title: "Download failed", description: err.message || "An error occurred", variant: "destructive" });
    },
  });

  const handlePreview = () => {
    if (!query.trim()) return;
    previewMutation.mutate(query.trim());
  };

  const handleDownload = (type: "ppt" | "pdf" | "onepager") => {
    if (!query.trim()) return;
    downloadMutation.mutate({ type });
  };

  const d = previewData;
  const f = d?.financials;

  return (
    <AgentLayout>
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6 text-blue-600" />
              Research Note Generator
            </h1>
            <p className="text-muted-foreground mt-1">Generate institutional-grade research reports for any listed company</p>
          </div>
          <div className="text-right text-xs text-muted-foreground hidden md:block">
            <p className="font-medium text-foreground">Sangram Kesari Mohanty, CFP</p>
            <p>FintekPro Research</p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Company Search</CardTitle>
            <CardDescription>Enter ISIN, NSE symbol, or company name (e.g. RELIANCE, AJAXENGG, TCS.NS)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="e.g. RELIANCE, AJAXENGG, TCS, INFY..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handlePreview()}
                />
              </div>
              <Button onClick={handlePreview} disabled={!query.trim() || previewMutation.isPending}>
                {previewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <BarChart3 className="h-4 w-4 mr-2" />}
                Analyse
              </Button>
            </div>
          </CardContent>
        </Card>

        {previewMutation.isPending && (
          <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
            <CardContent className="py-8 flex items-center justify-center gap-3 text-blue-600">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="font-medium">Fetching financial data and running models...</span>
            </CardContent>
          </Card>
        )}

        {d && f && (
          <>
            <Card>
              <CardContent className="pt-5">
                <div className="flex flex-wrap items-start gap-4 justify-between">
                  <div>
                    <h2 className="text-xl font-bold">{d.companyName}</h2>
                    <p className="text-sm text-muted-foreground">{d.symbol} · {d.exchange}</p>
                    <p className="text-xs text-muted-foreground mt-1">Generated: {d.generatedAt}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <RatingBadge rating={d.rating.rating} />
                    <span className="text-sm font-medium text-muted-foreground">Score: {d.rating.score}/100</span>
                  </div>
                </div>

                <Separator className="my-4" />

                <p className="text-sm italic text-muted-foreground mb-4">{d.rating.rationale}</p>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Score Breakdown</h3>
                  <ScoreBar label="Fundamentals" score={d.rating.breakdown.fundamentals} weight="40%" />
                  <ScoreBar label="Valuation" score={d.rating.breakdown.valuation} weight="30%" />
                  <ScoreBar label="Momentum" score={d.rating.breakdown.momentum} weight="30%" />
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-blue-500" /> Financial Snapshot
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    <MetricCard label="Current Price" value={fmt(f.price, f.currency === "INR" ? "₹" : "$")} highlight />
                    <MetricCard label="Market Cap" value={fmtCap(f.marketCap)} />
                    <MetricCard label="P/E Ratio" value={fmt(f.pe)} />
                    <MetricCard label="EPS" value={fmt(f.eps, f.currency === "INR" ? "₹" : "$")} />
                    <MetricCard label="ROE" value={fmtPct(f.roe)} />
                    <MetricCard label="Debt / Equity" value={fmt(f.debtToEquity)} />
                    <MetricCard label="Revenue Growth" value={fmtPct(f.revenueGrowth)} />
                    <MetricCard label="Earnings Growth" value={fmtPct(f.earningsGrowth)} />
                    <MetricCard label="Dividend Yield" value={fmtPct(f.dividendYield)} />
                    <MetricCard label="Beta" value={fmt(f.beta)} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Target className="h-4 w-4 text-purple-500" /> Technical Levels
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <MetricCard label="Support" value={fmt(d.levels.support, f.currency === "INR" ? "₹" : "$")} />
                    <MetricCard label="Resistance" value={fmt(d.levels.resistance, f.currency === "INR" ? "₹" : "$")} />
                    <MetricCard label="Stop Loss" value={fmt(d.levels.stopLoss, f.currency === "INR" ? "₹" : "$")} />
                    <MetricCard label="Target 1" value={fmt(d.levels.target1, f.currency === "INR" ? "₹" : "$")} highlight />
                    <MetricCard label="Target 2" value={fmt(d.levels.target2, f.currency === "INR" ? "₹" : "$")} highlight />
                    <MetricCard label="Analyst Target" value={fmt(f.targetMeanPrice, f.currency === "INR" ? "₹" : "$")} />
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
                    <p><span className="font-medium">52W High:</span> {fmt(f.fiftyTwoWeekHigh, f.currency === "INR" ? "₹" : "$")} · <span className="font-medium">Low:</span> {fmt(f.fiftyTwoWeekLow, f.currency === "INR" ? "₹" : "$")}</p>
                    <p className="text-muted-foreground">{d.weekRange52Position}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-muted bg-muted/20">
              <CardContent className="pt-4">
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Info className="h-4 w-4 mt-0.5 shrink-0" />
                  <p>{d.valuationSummary}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Download className="h-5 w-5 text-blue-600" />
                  Download Reports
                </CardTitle>
                <CardDescription>All reports are branded with FintekPro Research and prepared by Sangram Kesari Mohanty, CFP</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <PresentationIcon className="h-5 w-5 text-orange-500" />
                      <div>
                        <p className="font-semibold text-sm">Research PPT</p>
                        <p className="text-xs text-muted-foreground">5-slide institutional presentation</p>
                      </div>
                    </div>
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => handleDownload("ppt")}
                      disabled={downloadMutation.isPending}
                    >
                      {downloadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                      Download .pptx
                    </Button>
                  </div>

                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-red-500" />
                      <div>
                        <p className="font-semibold text-sm">Research PDF</p>
                        <p className="text-xs text-muted-foreground">Full A4 research report</p>
                      </div>
                    </div>
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => handleDownload("pdf")}
                      disabled={downloadMutation.isPending}
                    >
                      {downloadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                      Download PDF
                    </Button>
                  </div>

                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Percent className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="font-semibold text-sm">One-Page Note</p>
                        <p className="text-xs text-muted-foreground">Quick client summary</p>
                      </div>
                    </div>
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => handleDownload("onepager")}
                      disabled={downloadMutation.isPending}
                    >
                      {downloadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                      Download PDF
                    </Button>
                  </div>
                </div>

                <div className="mt-4 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
                  <div className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
                    <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                    <p>
                      <strong>Disclaimer:</strong> These reports are for informational purposes only and do not constitute investment advice.
                      Past performance is not indicative of future results. Please consult your financial advisor before making any investment decisions.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {!d && !previewMutation.isPending && (
          <Card className="border-dashed">
            <CardContent className="py-16 flex flex-col items-center text-center text-muted-foreground gap-3">
              <Building2 className="h-10 w-10 opacity-40" />
              <div>
                <p className="font-medium text-foreground">Enter a company to get started</p>
                <p className="text-sm mt-1">Search by NSE symbol (e.g. RELIANCE), ISIN, or company name.</p>
                <p className="text-sm">FintekPro will fetch live financial data and generate your report.</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {["RELIANCE", "TCS", "INFY", "HDFCBANK", "AJAXENGG"].map((ex) => (
                  <Badge
                    key={ex}
                    variant="secondary"
                    className="cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30"
                    onClick={() => { setQuery(ex); }}
                  >
                    {ex}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AgentLayout>
  );
}
