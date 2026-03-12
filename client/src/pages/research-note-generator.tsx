import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AgentLayout } from "@/components/layout/agent-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  FileText, PresentationIcon, Download, Search,
  TrendingUp, TrendingDown, Minus, Building2,
  BarChart3, Target, ShieldAlert, Loader2, Info,
  DollarSign, Percent, X, AlertTriangle, Users,
  ChevronRight, Sparkles, TableIcon, Activity, Layers,
  CheckCircle2, XCircle, ListChecks,
} from "lucide-react";

interface FinancialData {
  price: number | null;
  previousClose: number | null;
  marketCap: number | null;
  pe: number | null;
  eps: number | null;
  roe: number | null;
  roce: number | null;
  pbRatio: number | null;
  bookValue: number | null;
  faceValue: number | null;
  vwap: number | null;
  debtToEquity: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  dividendYield: number | null;
  beta: number | null;
  targetMeanPrice: number | null;
  currency: string;
  returns1M: number | null;
  returns6M: number | null;
  returns1Y: number | null;
}

interface RatingBreakdown { fundamentals: number; valuation: number; momentum: number; }
interface RatingResult { rating: string; score: number; breakdown: RatingBreakdown; rationale: string; }
interface PriceLevels { support: number; resistance: number; stopLoss: number; target1: number; target2: number; }

interface PriceTarget {
  peBased: number | null;
  pbBased: number | null;
  blended: number | null;
  upside: number | null;
  bear: number | null;
  base: number | null;
  bull: number | null;
  method: string;
}

interface ShareholdingData {
  promoterPct: number | null;
  promoterPrevPct: number | null;
  promoterChange: number | null;
  fiiPct: number | null;
  diiPct: number | null;
  publicPct: number | null;
  pledgedPct: number | null;
  quarter: string | null;
}

interface PeerData {
  symbol: string;
  name: string;
  price: number | null;
  pe: number | null;
  pb: number | null;
  roe: number | null;
  marketCapFormatted: string;
  dividendYield: number | null;
}

interface HistoricalTable {
  headers: string[];
  rows: { label: string; values: (number | null)[] }[];
}

interface SectorAverages {
  avgPE: number | null;
  avgPB: number | null;
  avgROE: number | null;
  stockCount: number;
}

interface CommentaryData {
  industryTrends: string;
  expansionPlans: string;
  outlook: string;
}

interface DataQuality {
  price: { source: string; fetchedAt: string };
  fundamentals: { source: string; scrapedAt: string | null; ageHours: number | null };
  peers: { source: string; enrichedAt: string; count: number };
  shareholding: { source: string };
  sectorAvg: { source: string; stockCount: number };
}

interface PreviewData {
  symbol: string;
  companyName: string;
  exchange: string;
  sector: string | null;
  industry: string | null;
  financials: FinancialData;
  rating: RatingResult;
  levels: PriceLevels;
  weekRange52Position: string;
  valuationSummary: string;
  generatedAt: string;
  priceTarget: PriceTarget | null;
  peg: number | null;
  thesis: string[];
  risks: string[];
  shareholding: ShareholdingData | null;
  peers: PeerData[];
  sectorAvg: SectorAverages | null;
  commentary: CommentaryData | null;
  managementNote: string;
  dataQuality?: DataQuality;
  companyDescription: string | null;
  plHistory: HistoricalTable | null;
  bsHistory: HistoricalTable | null;
  cfHistory: HistoricalTable | null;
  ratiosHistory: HistoricalTable | null;
  quarterlyHistory: HistoricalTable | null;
  salesCagr3Y: number | null;
  salesCagr5Y: number | null;
  profitCagr3Y: number | null;
  profitCagr5Y: number | null;
  keyPoints?: { pros: string[]; cons: string[] };
}

interface CompanySearchResult {
  symbol: string;
  isin: string;
  company_name: string;
  sector: string | null;
  nse_code: string | null;
  bse_code: string | null;
}

function fmt(val: number | null, prefix = "", suffix = "", decimals = 2): string {
  if (val === null || val === undefined) return "N/A";
  return `${prefix}${val.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;
}

function fmtPct(val: number | null): string {
  if (val === null || val === undefined) return "N/A";
  return `${(val * 100).toFixed(2)}%`;
}

function signPct(val: number | null): string {
  if (val === null || val === undefined) return "N/A";
  const s = (val * 100).toFixed(1);
  return val >= 0 ? `+${s}%` : `${s}%`;
}

function fmtCap(val: number | null, currency = "INR"): string {
  if (!val) return "N/A";
  if (currency === "INR") {
    if (val >= 1e12) return `₹${(val / 1e12).toFixed(2)} L Cr`;
    if (val >= 1e9) return `₹${(val / 1e9).toFixed(2)} K Cr`;
    if (val >= 1e7) return `₹${(val / 1e7).toFixed(2)} Cr`;
    return `₹${val.toFixed(0)}`;
  }
  return `$${val.toFixed(0)}`;
}

function priceRs(val: number | null): string {
  if (val === null) return "N/A";
  return `₹${Math.round(val).toLocaleString("en-IN")}`;
}

function RatingBadge({ rating }: { rating: string }) {
  const isBuy = rating.includes("BUY");
  const isHold = rating === "HOLD";
  const color = isBuy ? "bg-green-600" : isHold ? "bg-amber-500" : "bg-red-600";
  const Icon = isBuy ? TrendingUp : isHold ? Minus : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-white font-bold text-sm ${color}`}>
      <Icon className="h-4 w-4" />{rating}
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

function MetricCard({ label, value, highlight, subText }: { label: string; value: string; highlight?: boolean; subText?: string }) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? "border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800" : "bg-card"}`}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-base font-bold ${highlight ? "text-blue-700 dark:text-blue-300" : "text-foreground"}`}>{value}</p>
      {subText && <p className="text-xs text-muted-foreground mt-0.5">{subText}</p>}
    </div>
  );
}

export default function ResearchNoteGenerator() {
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<CompanySearchResult | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const { toast } = useToast();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchText), 280);
    return () => clearTimeout(t);
  }, [searchText]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data: searchResults = [], isFetching: isSearching } = useQuery<CompanySearchResult[]>({
    queryKey: ["/api/research-note/search", debouncedSearch],
    queryFn: async () => {
      if (debouncedSearch.length < 2) return [];
      return apiRequest(`/api/research-note/search?q=${encodeURIComponent(debouncedSearch)}`, "GET");
    },
    enabled: debouncedSearch.length >= 2,
    staleTime: 30000,
  });

  const symbolToAnalyse = selectedCompany ? selectedCompany.symbol : searchText.trim();

  const previewMutation = useMutation({
    mutationFn: async (symbol: string) => {
      return await apiRequest("/api/research-note/preview", "POST", { body: { symbol } });
    },
    onSuccess: (data: PreviewData) => { setPreviewData(data); },
    onError: (err: any) => {
      const msg: string = err?.message ?? "";
      const isRateLimit = msg.toLowerCase().includes("rate-limit") || msg.toLowerCase().includes("too many");
      toast({
        title: isRateLimit ? "Yahoo Finance Rate Limit" : "Data Fetch Failed",
        description: isRateLimit ? "Yahoo Finance is temporarily limiting requests. Please wait 30–60 seconds and try again." : (msg || "Failed to fetch data"),
        variant: "destructive",
        duration: isRateLimit ? 10000 : 5000,
      });
    },
  });

  const downloadMutation = useMutation({
    mutationFn: async ({ type }: { type: "ppt" | "pdf" | "onepager" }) => {
      const res = await fetch(`/api/research-note/generate/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: symbolToAnalyse }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Generation failed");
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const match = cd.match(/filename="(.+?)"/);
      const filename = match ? match[1] : `Research_${type}.${type === "ppt" ? "pptx" : "pdf"}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => toast({ title: "Download started", description: "Your report is downloading." }),
    onError: (err: any) => toast({ title: "Download failed", description: err.message || "An error occurred", variant: "destructive" }),
  });

  const handleSelect = (company: CompanySearchResult) => {
    setSelectedCompany(company);
    setSearchText(company.company_name);
    setShowDropdown(false);
    setPreviewData(null);
  };
  const handleClear = () => { setSelectedCompany(null); setSearchText(""); setPreviewData(null); setShowDropdown(false); inputRef.current?.focus(); };
  const handlePreview = () => { if (!symbolToAnalyse) return; previewMutation.mutate(symbolToAnalyse); };
  const handleDownload = (type: "ppt" | "pdf" | "onepager") => { if (!symbolToAnalyse) return; downloadMutation.mutate({ type }); };

  const d = previewData;
  const f = d?.financials;
  const cp = f?.currency === "INR" ? "₹" : "$";

  return (
    <AgentLayout>
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6 text-blue-600" />
              Research Note Generator
            </h1>
            <p className="text-muted-foreground mt-1">Generate institutional-grade equity research reports for any listed company</p>
          </div>
          <div className="text-right text-xs text-muted-foreground hidden md:block">
            <p className="font-medium text-foreground">FintekPro Research</p>
            <p>Institutional Research Desk</p>
          </div>
        </div>

        {/* Search */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Company Search</CardTitle>
            <CardDescription>Search from FintekPro database by company name, NSE symbol, or ISIN</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 items-start">
              <div className="relative flex-1" ref={dropdownRef}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                <Input
                  ref={inputRef}
                  className="pl-9 pr-8"
                  placeholder="Type company name, symbol (RELIANCE, TCS) or ISIN..."
                  value={searchText}
                  onChange={(e) => { setSearchText(e.target.value); setSelectedCompany(null); setShowDropdown(true); }}
                  onFocus={() => { if (searchText.length >= 2) setShowDropdown(true); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { setShowDropdown(false); handlePreview(); } if (e.key === "Escape") setShowDropdown(false); }}
                />
                {searchText && (
                  <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={handleClear} type="button">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                {showDropdown && debouncedSearch.length >= 2 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    {isSearching ? (
                      <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching...</div>
                    ) : searchResults.length === 0 ? (
                      <div className="px-3 py-3 text-sm text-muted-foreground">No companies found.</div>
                    ) : searchResults.map((c) => (
                      <button key={c.isin} className="w-full text-left px-3 py-2.5 hover:bg-muted transition-colors border-b border-border/50 last:border-0" onMouseDown={(e) => { e.preventDefault(); handleSelect(c); }}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{c.company_name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">{c.symbol}</span>
                              {c.sector && <span className="ml-2">· {c.sector}</span>}
                            </p>
                          </div>
                          <p className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">{c.isin}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button onClick={handlePreview} disabled={!symbolToAnalyse || previewMutation.isPending}>
                {previewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <BarChart3 className="h-4 w-4 mr-2" />}
                Analyse
              </Button>
            </div>

            {selectedCompany && (
              <div className="mt-3 flex items-center gap-3 px-3 py-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <Building2 className="h-4 w-4 text-blue-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200 truncate">{selectedCompany.company_name}</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-mono mt-0.5">ISIN: {selectedCompany.isin} · NSE: {selectedCompany.symbol}</p>
                </div>
                <Badge variant="outline" className="text-blue-700 border-blue-300 text-[10px] shrink-0">Selected</Badge>
              </div>
            )}

            {!selectedCompany && (
              <div className="mt-3 flex flex-wrap gap-2">
                {["RELIANCE", "TCS", "INFY", "HDFCBANK", "AJAXENGG"].map((s) => (
                  <button key={s} className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors font-mono"
                    onClick={() => { setSearchText(s); setSelectedCompany(null); setShowDropdown(true); setDebouncedSearch(s); }} type="button">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Loading */}
        {previewMutation.isPending && (
          <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
            <CardContent className="py-8 flex items-center justify-center gap-3 text-blue-600">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="font-medium">Fetching live data, running valuation models, generating AI commentary...</span>
            </CardContent>
          </Card>
        )}

        {d && f && (
          <>
            {/* Header card */}
            <Card>
              <CardContent className="pt-5">
                <div className="flex flex-wrap items-start gap-4 justify-between">
                  <div>
                    <h2 className="text-xl font-bold">{d.companyName}</h2>
                    <p className="text-sm text-muted-foreground">
                      {d.symbol.replace(".NS","").replace(".BO","")} · {d.exchange}
                      {d.sector && <span> · {d.sector}</span>}
                      {d.industry && d.industry !== d.sector && <span> · {d.industry}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Generated: {d.generatedAt}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <RatingBadge rating={d.rating.rating} />
                    <span className="text-sm font-medium text-muted-foreground">Score: {d.rating.score}/100</span>
                  </div>
                </div>
                <Separator className="my-4" />
                {/* Data quality / freshness badge */}
                {d.dataQuality && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${d.dataQuality.price.source === "NSE_LIVE" ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                      Price · {d.dataQuality.price.source.replace("_", " ")}
                    </span>
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${d.dataQuality.fundamentals.source === "SCREENER_LIVE" ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-800" : "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/40 dark:text-slate-400"}`}>
                      Fundamentals · {d.dataQuality.fundamentals.source === "DB_CACHE"
                        ? `DB Cache${d.dataQuality.fundamentals.ageHours !== null ? ` (${d.dataQuality.fundamentals.ageHours}h ago)` : ""}`
                        : "Screener Live"}
                    </span>
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${d.dataQuality.shareholding.source === "NSE_LIVE" ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800" : "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900/40 dark:text-slate-500"}`}>
                      Shareholding · {d.dataQuality.shareholding.source === "NSE_LIVE" ? "Live" : "Unavailable"}
                    </span>
                    {d.dataQuality.sectorAvg.stockCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-800">
                        Sector Avg · {d.dataQuality.sectorAvg.stockCount} stocks
                      </span>
                    )}
                  </div>
                )}
                <p className="text-sm italic text-muted-foreground mb-4">{d.rating.rationale}</p>
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Score Breakdown</h3>
                  <ScoreBar label="Fundamentals" score={d.rating.breakdown.fundamentals} weight="40%" />
                  <ScoreBar label="Valuation" score={d.rating.breakdown.valuation} weight="30%" />
                  <ScoreBar label="Momentum" score={d.rating.breakdown.momentum} weight="30%" />
                </div>
              </CardContent>
            </Card>

            {/* Price Target + Scenario */}
            {d.priceTarget?.blended && (
              <Card className="border-blue-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Target className="h-4 w-4 text-blue-600" /> Price Target & Valuation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-3 text-center">
                      <p className="text-xs text-red-600 dark:text-red-400 font-medium">Bear Case</p>
                      <p className="text-lg font-bold text-red-700 dark:text-red-300">{priceRs(d.priceTarget.bear)}</p>
                    </div>
                    <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border-2 border-blue-400 p-3 text-center">
                      <p className="text-xs text-blue-600 font-medium">Base Target (FintekPro Est.)</p>
                      <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{priceRs(d.priceTarget.blended)}</p>
                      <p className="text-xs font-medium mt-1" style={{ color: (d.priceTarget.upside ?? 0) >= 0 ? "#16a34a" : "#dc2626" }}>
                        {(d.priceTarget.upside ?? 0) >= 0 ? "▲" : "▼"} {Math.abs(d.priceTarget.upside ?? 0).toFixed(1)}% from CMP
                      </p>
                    </div>
                    <div className="rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-3 text-center">
                      <p className="text-xs text-green-600 dark:text-green-400 font-medium">Bull Case</p>
                      <p className="text-lg font-bold text-green-700 dark:text-green-300">{priceRs(d.priceTarget.bull)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>Method: <strong className="text-foreground">{d.priceTarget.method}</strong></span>
                    {d.peg !== null && <span>PEG Ratio: <strong className="text-foreground">{d.peg.toFixed(2)}x</strong></span>}
                    {d.priceTarget.peBased && <span>PE-Based: <strong className="text-foreground">{priceRs(d.priceTarget.peBased)}</strong></span>}
                    {d.priceTarget.pbBased && <span>PB-Based: <strong className="text-foreground">{priceRs(d.priceTarget.pbBased)}</strong></span>}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Financial Snapshot + Technical */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4 text-blue-500" /> Financial Snapshot</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    <MetricCard label="Current Price" value={fmt(f.price, cp)} highlight />
                    <MetricCard label="Market Cap" value={fmtCap(f.marketCap, f.currency)} />
                    <MetricCard label="P/E Ratio" value={fmt(f.pe)} />
                    <MetricCard label="EPS" value={fmt(f.eps, cp)} />
                    <MetricCard label="ROE" value={fmtPct(f.roe)} />
                    <MetricCard label="ROCE" value={fmtPct(f.roce)} />
                    <MetricCard label="P/B Ratio" value={f.pbRatio !== null ? fmt(f.pbRatio, "", "x") : "N/A"} />
                    <MetricCard label="Book Value" value={fmt(f.bookValue, cp)} />
                    <MetricCard label="Debt / Equity" value={fmt(f.debtToEquity)} />
                    <MetricCard label="Dividend Yield" value={fmtPct(f.dividendYield)} />
                    <MetricCard label="Revenue Growth" value={fmtPct(f.revenueGrowth)} />
                    <MetricCard label="Earnings Growth" value={fmtPct(f.earningsGrowth)} />
                    <MetricCard label="Face Value" value={fmt(f.faceValue, cp)} />
                    <MetricCard label="VWAP" value={fmt(f.vwap, cp)} />
                  </div>
                  {(f.returns1M !== null || f.returns1Y !== null) && (
                    <div className="mt-3 pt-3 border-t grid grid-cols-3 gap-2 text-center">
                      {[["1M", f.returns1M], ["6M", f.returns6M], ["1Y", f.returns1Y]].map(([label, val]) => (
                        <div key={String(label)}>
                          <p className="text-xs text-muted-foreground">{label} Return</p>
                          <p className={`text-sm font-bold ${(val as number | null) === null ? "text-muted-foreground" : (val as number) >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {(val as number | null) !== null ? signPct(val as number) : "N/A"}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4 text-purple-500" /> Technical Levels</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <MetricCard label="Support" value={fmt(d.levels.support, cp)} />
                    <MetricCard label="Resistance" value={fmt(d.levels.resistance, cp)} />
                    <MetricCard label="Stop Loss" value={fmt(d.levels.stopLoss, cp)} />
                    <MetricCard label="Target 1" value={fmt(d.levels.target1, cp)} highlight />
                    <MetricCard label="Target 2" value={fmt(d.levels.target2, cp)} highlight />
                    <MetricCard label="Price Target" value={d.priceTarget?.blended ? `${priceRs(d.priceTarget.blended)} (Est.)` : fmt(f.targetMeanPrice, cp)} highlight={!!d.priceTarget?.blended} />
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
                    <p><span className="font-medium">52W High:</span> {fmt(f.fiftyTwoWeekHigh, cp)} · <span className="font-medium">Low:</span> {fmt(f.fiftyTwoWeekLow, cp)}</p>
                    <p className="text-muted-foreground">{d.weekRange52Position}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Company Description */}
            {d.companyDescription && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4 text-slate-600" /> About the Company</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-foreground leading-relaxed">{d.companyDescription}</p>
                </CardContent>
              </Card>
            )}

            {/* CAGR Callout Badges */}
            {(d.salesCagr3Y !== null || d.salesCagr5Y !== null || d.profitCagr3Y !== null || d.profitCagr5Y !== null) && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-blue-600" /> Growth Rates (CAGR)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: "Revenue 3Y CAGR", val: d.salesCagr3Y },
                      { label: "Revenue 5Y CAGR", val: d.salesCagr5Y },
                      { label: "Profit 3Y CAGR", val: d.profitCagr3Y },
                      { label: "Profit 5Y CAGR", val: d.profitCagr5Y },
                    ].filter(x => x.val !== null).map(({ label, val }) => {
                      const pct = ((val as number) * 100);
                      const positive = pct >= 0;
                      return (
                        <div key={label} className={`rounded-lg border px-3 py-2 text-center min-w-[110px] ${positive ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"}`}>
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <p className={`text-base font-bold ${positive ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
                            {positive ? "+" : ""}{pct.toFixed(1)}%
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Multi-Year P&L */}
            {d.plHistory && d.plHistory.rows.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><TableIcon className="h-4 w-4 text-blue-600" /> Multi-Year Profit & Loss (₹ Cr)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-blue-50 dark:bg-blue-950/20">
                          <th className="text-left py-2 px-2 font-semibold text-muted-foreground min-w-[130px]">Metric</th>
                          {d.plHistory.headers.map(h => (
                            <th key={h} className="text-right py-2 px-2 font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                          ))}
                          {(d.salesCagr5Y !== null || d.salesCagr3Y !== null) && (
                            <th className="text-right py-2 px-2 font-semibold text-blue-700 dark:text-blue-400 whitespace-nowrap">5Y CAGR</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {d.plHistory.rows.map((row, ri) => {
                          const isPercent = row.label.toLowerCase().includes("opm") || row.label.toLowerCase().includes("%");
                          const isEps = row.label.toLowerCase().includes("eps");
                          const cagr = row.label.toLowerCase().includes("sales") ? d.salesCagr5Y :
                                       row.label.toLowerCase().includes("net profit") ? d.profitCagr5Y : null;
                          return (
                            <tr key={row.label} className={`border-b last:border-0 ${ri % 2 === 0 ? "" : "bg-muted/30"}`}>
                              <td className="py-1.5 px-2 font-medium text-foreground">{row.label}</td>
                              {row.values.map((v, vi) => {
                                const prev = vi > 0 ? row.values[vi - 1] : null;
                                const trend = v !== null && prev !== null && prev !== 0 ? (v > prev ? "text-green-600" : v < prev ? "text-red-600" : "") : "";
                                const display = v === null ? "—" : isPercent ? `${v.toFixed(1)}%` : isEps ? v.toFixed(2) : v.toLocaleString("en-IN", { maximumFractionDigits: 0 });
                                return <td key={vi} className={`text-right py-1.5 px-2 ${trend}`}>{display}</td>;
                              })}
                              {(d.salesCagr5Y !== null || d.salesCagr3Y !== null) && (
                                <td className="text-right py-1.5 px-2 font-semibold">
                                  {cagr !== null ? (
                                    <span className={cagr >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}>
                                      {cagr >= 0 ? "+" : ""}{(cagr * 100).toFixed(1)}%
                                    </span>
                                  ) : "—"}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quarterly Results */}
            {d.quarterlyHistory && d.quarterlyHistory.rows.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4 text-purple-600" /> Quarterly Results (₹ Cr)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-purple-50 dark:bg-purple-950/20">
                          <th className="text-left py-2 px-2 font-semibold text-muted-foreground min-w-[130px]">Metric</th>
                          {d.quarterlyHistory.headers.map((h, i) => (
                            <th key={h} className={`text-right py-2 px-2 font-semibold whitespace-nowrap ${i === d.quarterlyHistory!.headers.length - 1 ? "text-purple-700 dark:text-purple-400" : "text-muted-foreground"}`}>{h}</th>
                          ))}
                          <th className="text-right py-2 px-2 font-semibold text-muted-foreground">QoQ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.quarterlyHistory.rows.map((row, ri) => {
                          const isPercent = row.label.toLowerCase().includes("opm") || row.label.toLowerCase().includes("%");
                          const isEps = row.label.toLowerCase().includes("eps");
                          const lastTwo = row.values.slice(-2);
                          const qoq = lastTwo.length === 2 && lastTwo[0] !== null && lastTwo[1] !== null && lastTwo[0] !== 0
                            ? ((lastTwo[1] - lastTwo[0]) / Math.abs(lastTwo[0])) : null;
                          return (
                            <tr key={row.label} className={`border-b last:border-0 ${ri % 2 === 0 ? "" : "bg-muted/30"}`}>
                              <td className="py-1.5 px-2 font-medium text-foreground">{row.label}</td>
                              {row.values.map((v, vi) => {
                                const isLatest = vi === row.values.length - 1;
                                const display = v === null ? "—" : isPercent ? `${v.toFixed(1)}%` : isEps ? v.toFixed(2) : v.toLocaleString("en-IN", { maximumFractionDigits: 0 });
                                return (
                                  <td key={vi} className={`text-right py-1.5 px-2 ${isLatest ? "font-semibold text-purple-700 dark:text-purple-400" : ""}`}>
                                    {display}
                                  </td>
                                );
                              })}
                              <td className="text-right py-1.5 px-2 font-semibold">
                                {qoq !== null ? (
                                  <span className={qoq >= 0 ? "text-green-600" : "text-red-600"}>
                                    {qoq >= 0 ? "▲" : "▼"} {Math.abs(qoq * 100).toFixed(1)}%
                                  </span>
                                ) : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Key Efficiency Ratios */}
            {d.ratiosHistory && d.ratiosHistory.rows.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-teal-600" /> Key Efficiency Ratios (5-Year Trend)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-teal-50 dark:bg-teal-950/20">
                          <th className="text-left py-2 px-2 font-semibold text-muted-foreground min-w-[160px]">Metric</th>
                          {d.ratiosHistory.headers.map(h => (
                            <th key={h} className="text-right py-2 px-2 font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {d.ratiosHistory.rows.map((row, ri) => {
                          const isPercent = row.label.toLowerCase().includes("roce") || row.label.toLowerCase().includes("%");
                          return (
                            <tr key={row.label} className={`border-b last:border-0 ${ri % 2 === 0 ? "" : "bg-muted/30"}`}>
                              <td className="py-1.5 px-2 font-medium text-foreground">{row.label}</td>
                              {row.values.map((v, vi) => {
                                const display = v === null ? "—" : isPercent ? `${v.toFixed(1)}%` : v.toFixed(0);
                                return <td key={vi} className="text-right py-1.5 px-2">{display}</td>;
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Balance Sheet Snapshot */}
            {d.bsHistory && d.bsHistory.rows.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Layers className="h-4 w-4 text-amber-600" /> Balance Sheet Snapshot (₹ Cr)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-amber-50 dark:bg-amber-950/20">
                          <th className="text-left py-2 px-2 font-semibold text-muted-foreground min-w-[130px]">Metric</th>
                          {d.bsHistory.headers.map(h => (
                            <th key={h} className="text-right py-2 px-2 font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {d.bsHistory.rows.map((row, ri) => (
                          <tr key={row.label} className={`border-b last:border-0 ${ri % 2 === 0 ? "" : "bg-muted/30"}`}>
                            <td className="py-1.5 px-2 font-medium text-foreground">{row.label}</td>
                            {row.values.map((v, vi) => (
                              <td key={vi} className="text-right py-1.5 px-2">{v !== null ? v.toLocaleString("en-IN", { maximumFractionDigits: 0 }) : "—"}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Valuation Snapshot */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-blue-600" /> Valuation Snapshot
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {/* P/E Ratio */}
                  {d.financials.pe !== null && (() => {
                    const v = d.financials.pe!;
                    const { label, color } = v < 15
                      ? { label: "Attractive", color: "green" }
                      : v < 30
                      ? { label: "Moderate", color: "amber" }
                      : { label: "Premium", color: "red" };
                    const border = color === "green" ? "border-l-green-500 bg-green-50/50 dark:bg-green-950/20"
                      : color === "amber" ? "border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20"
                      : "border-l-red-500 bg-red-50/50 dark:bg-red-950/20";
                    const text = color === "green" ? "text-green-700 dark:text-green-400"
                      : color === "amber" ? "text-amber-700 dark:text-amber-400"
                      : "text-red-700 dark:text-red-400";
                    return (
                      <div className={`border-l-4 ${border} rounded-r-lg p-3 space-y-1`}>
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">P/E Ratio</p>
                        <p className="text-xl font-bold text-foreground">{v.toFixed(1)}x</p>
                        <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded ${text}`}>{label}</span>
                      </div>
                    );
                  })()}

                  {/* ROE */}
                  {d.financials.roe !== null && (() => {
                    const v = d.financials.roe!;
                    const pct = v > 1 ? v : v * 100;
                    const { label, color } = pct >= 20
                      ? { label: "High ROE", color: "green" }
                      : pct >= 10
                      ? { label: "Moderate", color: "amber" }
                      : { label: "Low ROE", color: "red" };
                    const border = color === "green" ? "border-l-green-500 bg-green-50/50 dark:bg-green-950/20"
                      : color === "amber" ? "border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20"
                      : "border-l-red-500 bg-red-50/50 dark:bg-red-950/20";
                    const text = color === "green" ? "text-green-700 dark:text-green-400"
                      : color === "amber" ? "text-amber-700 dark:text-amber-400"
                      : "text-red-700 dark:text-red-400";
                    return (
                      <div className={`border-l-4 ${border} rounded-r-lg p-3 space-y-1`}>
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Return on Equity</p>
                        <p className="text-xl font-bold text-foreground">{pct.toFixed(1)}%</p>
                        <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded ${text}`}>{label}</span>
                      </div>
                    );
                  })()}

                  {/* P/B Ratio */}
                  {d.financials.pbRatio !== null && (() => {
                    const v = d.financials.pbRatio!;
                    const { label, color } = v < 1
                      ? { label: "Below Book", color: "green" }
                      : v < 3
                      ? { label: "Fair Value", color: "green" }
                      : v < 6
                      ? { label: "Premium", color: "amber" }
                      : { label: "High Premium", color: "red" };
                    const border = color === "green" ? "border-l-green-500 bg-green-50/50 dark:bg-green-950/20"
                      : color === "amber" ? "border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20"
                      : "border-l-red-500 bg-red-50/50 dark:bg-red-950/20";
                    const text = color === "green" ? "text-green-700 dark:text-green-400"
                      : color === "amber" ? "text-amber-700 dark:text-amber-400"
                      : "text-red-700 dark:text-red-400";
                    return (
                      <div className={`border-l-4 ${border} rounded-r-lg p-3 space-y-1`}>
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Price / Book</p>
                        <p className="text-xl font-bold text-foreground">{v.toFixed(2)}x</p>
                        <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded ${text}`}>{label}</span>
                      </div>
                    );
                  })()}

                  {/* Debt / Equity */}
                  {d.financials.debtToEquity !== null && (() => {
                    const v = d.financials.debtToEquity!;
                    const { label, color } = v < 0.5
                      ? { label: "Debt-Free", color: "green" }
                      : v < 1.5
                      ? { label: "Manageable", color: "amber" }
                      : { label: "Leveraged", color: "red" };
                    const border = color === "green" ? "border-l-green-500 bg-green-50/50 dark:bg-green-950/20"
                      : color === "amber" ? "border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20"
                      : "border-l-red-500 bg-red-50/50 dark:bg-red-950/20";
                    const text = color === "green" ? "text-green-700 dark:text-green-400"
                      : color === "amber" ? "text-amber-700 dark:text-amber-400"
                      : "text-red-700 dark:text-red-400";
                    return (
                      <div className={`border-l-4 ${border} rounded-r-lg p-3 space-y-1`}>
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Debt / Equity</p>
                        <p className="text-xl font-bold text-foreground">{v.toFixed(2)}x</p>
                        <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded ${text}`}>{label}</span>
                      </div>
                    );
                  })()}

                  {/* ROCE / Revenue Growth */}
                  {(d.financials.roce !== null || d.financials.revenueGrowth !== null) && (() => {
                    if (d.financials.roce !== null) {
                      const v = d.financials.roce!;
                      const pct = v > 1 ? v : v * 100;
                      const { label, color } = pct >= 15
                        ? { label: "Excellent", color: "green" }
                        : pct >= 10
                        ? { label: "Decent", color: "amber" }
                        : { label: "Weak", color: "red" };
                      const border = color === "green" ? "border-l-green-500 bg-green-50/50 dark:bg-green-950/20"
                        : color === "amber" ? "border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20"
                        : "border-l-red-500 bg-red-50/50 dark:bg-red-950/20";
                      const text = color === "green" ? "text-green-700 dark:text-green-400"
                        : color === "amber" ? "text-amber-700 dark:text-amber-400"
                        : "text-red-700 dark:text-red-400";
                      return (
                        <div className={`border-l-4 ${border} rounded-r-lg p-3 space-y-1`}>
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">ROCE</p>
                          <p className="text-xl font-bold text-foreground">{pct.toFixed(1)}%</p>
                          <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded ${text}`}>{label}</span>
                        </div>
                      );
                    }
                    const v = d.financials.revenueGrowth!;
                    const pct = v > 1 ? v : v * 100;
                    const { label, color } = pct > 15
                      ? { label: "High Growth", color: "green" }
                      : pct > 0
                      ? { label: "Positive", color: "amber" }
                      : { label: "Declining", color: "red" };
                    const border = color === "green" ? "border-l-green-500 bg-green-50/50 dark:bg-green-950/20"
                      : color === "amber" ? "border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20"
                      : "border-l-red-500 bg-red-50/50 dark:bg-red-950/20";
                    const text = color === "green" ? "text-green-700 dark:text-green-400"
                      : color === "amber" ? "text-amber-700 dark:text-amber-400"
                      : "text-red-700 dark:text-red-400";
                    return (
                      <div className={`border-l-4 ${border} rounded-r-lg p-3 space-y-1`}>
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Revenue Growth</p>
                        <p className="text-xl font-bold text-foreground">{pct > 0 ? "+" : ""}{pct.toFixed(1)}%</p>
                        <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded ${text}`}>{label}</span>
                      </div>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>

            {/* Investment Thesis */}
            {d.thesis && d.thesis.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4 text-green-600" /> Investment Thesis</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {d.thesis.map((bullet, i) => (
                    <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900">
                      <div className="shrink-0 w-5 h-5 rounded-full bg-green-600 text-white text-xs flex items-center justify-center font-bold mt-0.5">{i + 1}</div>
                      <p className="text-sm text-foreground">{bullet}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Risk Factors */}
            {d.risks && d.risks.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-600" /> Key Risk Factors</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {d.risks.map((risk, i) => (
                    <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900">
                      <div className="shrink-0 w-5 h-5 rounded-full bg-red-600 text-white text-xs flex items-center justify-center font-bold mt-0.5">{i + 1}</div>
                      <p className="text-sm text-foreground">{risk}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Peer Comparison */}
            {d.peers && d.peers.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4 text-indigo-600" /> Peer Comparison</CardTitle>
                  {d.sector && <p className="text-xs text-muted-foreground">Sector: {d.sector}</p>}
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 text-muted-foreground font-medium">Company</th>
                          <th className="text-right py-2 text-muted-foreground font-medium">Price</th>
                          <th className="text-right py-2 text-muted-foreground font-medium">P/E</th>
                          <th className="text-right py-2 text-muted-foreground font-medium">P/B</th>
                          <th className="text-right py-2 text-muted-foreground font-medium">ROE</th>
                          <th className="text-right py-2 text-muted-foreground font-medium">Div Yld</th>
                          <th className="text-right py-2 text-muted-foreground font-medium">Mkt Cap</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Target stock row */}
                        <tr className="border-b bg-blue-50 dark:bg-blue-950/20">
                          <td className="py-2 font-semibold text-blue-700 dark:text-blue-300">
                            {d.companyName.length > 22 ? d.companyName.slice(0, 22) + "…" : d.companyName}
                            <span className="ml-2 text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded">YOU</span>
                          </td>
                          <td className="text-right py-2 font-bold">{f.price ? `₹${Math.round(f.price).toLocaleString("en-IN")}` : "N/A"}</td>
                          <td className="text-right py-2">{f.pe?.toFixed(1) ?? "N/A"}</td>
                          <td className="text-right py-2">{f.pbRatio !== null ? f.pbRatio.toFixed(1) : "N/A"}</td>
                          <td className="text-right py-2">{fmtPct(f.roe)}</td>
                          <td className="text-right py-2">{fmtPct(f.dividendYield)}</td>
                          <td className="text-right py-2">{fmtCap(f.marketCap, f.currency)}</td>
                        </tr>
                        {d.peers.map((peer) => (
                          <tr key={peer.symbol} className="border-b last:border-0 hover:bg-muted/40">
                            <td className="py-2 text-foreground">
                              {peer.name.length > 22 ? peer.name.slice(0, 22) + "…" : peer.name}
                              <span className="ml-1 text-[10px] text-muted-foreground font-mono">({peer.symbol})</span>
                            </td>
                            <td className="text-right py-2">{peer.price ? `₹${Math.round(peer.price).toLocaleString("en-IN")}` : "N/A"}</td>
                            <td className="text-right py-2">{peer.pe?.toFixed(1) ?? "N/A"}</td>
                            <td className="text-right py-2">{peer.pb !== null ? peer.pb.toFixed(1) : "N/A"}</td>
                            <td className="text-right py-2">{fmtPct(peer.roe)}</td>
                            <td className="text-right py-2">{peer.dividendYield !== null ? fmtPct(peer.dividendYield) : "—"}</td>
                            <td className="text-right py-2">{peer.marketCapFormatted}</td>
                          </tr>
                        ))}
                        {d.sectorAvg && (
                          <tr className="border-t bg-muted/30">
                            <td className="py-1.5 text-xs text-muted-foreground italic">Sector Average ({d.sectorAvg.stockCount} stocks)</td>
                            <td className="text-right py-1.5 text-xs text-muted-foreground">—</td>
                            <td className="text-right py-1.5 text-xs text-muted-foreground">{d.sectorAvg.avgPE?.toFixed(1) ?? "—"}</td>
                            <td className="text-right py-1.5 text-xs text-muted-foreground">{d.sectorAvg.avgPB?.toFixed(1) ?? "—"}</td>
                            <td className="text-right py-1.5 text-xs text-muted-foreground">{fmtPct(d.sectorAvg.avgROE)}</td>
                            <td className="text-right py-1.5 text-xs text-muted-foreground">—</td>
                            <td className="text-right py-1.5 text-xs text-muted-foreground">—</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Shareholding */}
            {d.shareholding && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Percent className="h-4 w-4 text-violet-600" /> Shareholding Pattern</CardTitle>
                  {d.shareholding.quarter && <p className="text-xs text-muted-foreground">As of {d.shareholding.quarter}</p>}
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    {[
                      { label: "Promoter", val: d.shareholding.promoterPct, change: d.shareholding.promoterChange, color: "blue" },
                      { label: "FII / FPI", val: d.shareholding.fiiPct, change: null, color: "purple" },
                      { label: "DII / MF", val: d.shareholding.diiPct, change: null, color: "green" },
                      { label: "Public", val: d.shareholding.publicPct, change: null, color: "amber" },
                    ].map(({ label, val, change, color }) => (
                      <div key={label} className={`rounded-lg border p-3 bg-${color}-50 dark:bg-${color}-950/20 border-${color}-200 dark:border-${color}-800`}>
                        <p className={`text-xs font-medium text-${color}-700 dark:text-${color}-300`}>{label}</p>
                        <p className={`text-xl font-bold text-${color}-800 dark:text-${color}-200`}>{val !== null ? `${val.toFixed(1)}%` : "N/A"}</p>
                        {change !== null && (
                          <p className={`text-xs mt-0.5 ${change >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(2)}% QoQ
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  {d.shareholding.pledgedPct !== null && d.shareholding.pledgedPct > 0 && (
                    <div className={`flex items-center gap-2 text-xs p-2 rounded ${d.shareholding.pledgedPct > 10 ? "bg-red-50 dark:bg-red-950/20 text-red-700" : "bg-amber-50 dark:bg-amber-950/20 text-amber-700"}`}>
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      Pledged shares: {d.shareholding.pledgedPct.toFixed(1)}%
                      {d.shareholding.pledgedPct > 10 && " — elevated pledge is an overhang risk"}
                    </div>
                  )}
                  {d.shareholding.promoterChange !== null && d.shareholding.promoterChange < -1.5 && (
                    <div className="flex items-center gap-2 text-xs p-2 rounded bg-red-50 dark:bg-red-950/20 text-red-700 mt-2">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      Promoter holding declined {Math.abs(d.shareholding.promoterChange).toFixed(1)}% QoQ — watch for further movement
                    </div>
                  )}
                  {d.managementNote && (
                    <p className="text-xs text-muted-foreground mt-3 italic">{d.managementNote}</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Key Points from Screener.in */}
            {d.keyPoints && (d.keyPoints.pros.length > 0 || d.keyPoints.cons.length > 0) && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-blue-600" /> Key Points
                  </CardTitle>
                  <p className="text-[10px] text-muted-foreground">Machine-generated highlights from Screener.in · Exercise caution and do your own analysis</p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {d.keyPoints.pros.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-green-700 dark:text-green-400 mb-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Strengths
                        </div>
                        <ul className="space-y-1.5">
                          {d.keyPoints.pros.map((p, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                              <span>{p}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {d.keyPoints.cons.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-400 mb-1">
                          <XCircle className="h-3.5 w-3.5" /> Risks & Concerns
                        </div>
                        <ul className="space-y-1.5">
                          {d.keyPoints.cons.map((c, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                              <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                              <span>{c}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* AI Industry Commentary */}
            {d.commentary && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-500" /> Industry Trends & Sector Outlook</CardTitle>
                  <p className="text-[10px] text-muted-foreground">AI-generated overview based on sector dynamics and company profile</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: "Industry Trends & Tailwinds", text: d.commentary.industryTrends },
                    { label: "Expansion & Strategic Initiatives", text: d.commentary.expansionPlans },
                    { label: "Investor Outlook", text: d.commentary.outlook },
                  ].map(({ label, text }) => (
                    <div key={label} className="flex items-start gap-3">
                      <ChevronRight className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-0.5">{label}</p>
                        <p className="text-sm text-foreground">{text}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Download Reports */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Download className="h-5 w-5 text-blue-600" /> Download Reports</CardTitle>
                <CardDescription>All reports are branded with FintekPro Research</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <PresentationIcon className="h-5 w-5 text-orange-500" />
                      <div>
                        <p className="font-semibold text-sm">Research PPT</p>
                        <p className="text-xs text-muted-foreground">10-slide institutional presentation</p>
                      </div>
                    </div>
                    <Button className="w-full" variant="outline" onClick={() => handleDownload("ppt")} disabled={downloadMutation.isPending}>
                      {downloadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                      Download .pptx
                    </Button>
                  </div>
                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-red-500" />
                      <div>
                        <p className="font-semibold text-sm">Research PDF</p>
                        <p className="text-xs text-muted-foreground">3-page institutional report</p>
                      </div>
                    </div>
                    <Button className="w-full" variant="outline" onClick={() => handleDownload("pdf")} disabled={downloadMutation.isPending}>
                      {downloadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                      Download PDF
                    </Button>
                  </div>
                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Percent className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="font-semibold text-sm">One-Page Note</p>
                        <p className="text-xs text-muted-foreground">Quick reference with target price</p>
                      </div>
                    </div>
                    <Button className="w-full" variant="outline" onClick={() => handleDownload("onepager")} disabled={downloadMutation.isPending}>
                      {downloadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                      Download PDF
                    </Button>
                  </div>
                </div>
                <div className="mt-4 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
                  <div className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
                    <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                    <p><strong>Disclaimer:</strong> These reports are for informational purposes only and do not constitute investment advice. Past performance is not indicative of future results. Please consult a SEBI-registered investment advisor before making any investment decisions.</p>
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
                <p className="text-sm">Live data + valuation models + AI sector commentary.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AgentLayout>
  );
}
