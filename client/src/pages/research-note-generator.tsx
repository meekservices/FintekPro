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
  X,
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
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
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
    onSuccess: (data: PreviewData) => {
      setPreviewData(data);
    },
    onError: (err: any) => {
      const msg: string = err?.message ?? "";
      const isRateLimit = msg.toLowerCase().includes("rate-limit") || msg.toLowerCase().includes("too many");
      toast({
        title: isRateLimit ? "Yahoo Finance Rate Limit" : "Data Fetch Failed",
        description: isRateLimit
          ? "Yahoo Finance is temporarily limiting requests. Please wait 30–60 seconds and try again."
          : (msg || "Failed to fetch data"),
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

  const handleSelect = (company: CompanySearchResult) => {
    setSelectedCompany(company);
    setSearchText(company.company_name);
    setShowDropdown(false);
    setPreviewData(null);
  };

  const handleClear = () => {
    setSelectedCompany(null);
    setSearchText("");
    setPreviewData(null);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const handlePreview = () => {
    if (!symbolToAnalyse) return;
    previewMutation.mutate(symbolToAnalyse);
  };

  const handleDownload = (type: "ppt" | "pdf" | "onepager") => {
    if (!symbolToAnalyse) return;
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
                  onChange={(e) => {
                    setSearchText(e.target.value);
                    setSelectedCompany(null);
                    setShowDropdown(true);
                  }}
                  onFocus={() => { if (searchText.length >= 2) setShowDropdown(true); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { setShowDropdown(false); handlePreview(); }
                    if (e.key === "Escape") setShowDropdown(false);
                  }}
                />
                {searchText && (
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={handleClear}
                    type="button"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}

                {showDropdown && debouncedSearch.length >= 2 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    {isSearching ? (
                      <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching...
                      </div>
                    ) : searchResults.length === 0 ? (
                      <div className="px-3 py-3 text-sm text-muted-foreground">No companies found. Try a different name or symbol.</div>
                    ) : (
                      searchResults.map((c) => (
                        <button
                          key={c.isin}
                          className="w-full text-left px-3 py-2.5 hover:bg-muted transition-colors border-b border-border/50 last:border-0"
                          onMouseDown={(e) => { e.preventDefault(); handleSelect(c); }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{c.company_name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">{c.symbol}</span>
                                {c.sector && <span className="ml-2 text-muted-foreground">· {c.sector}</span>}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{c.isin}</p>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
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
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-mono mt-0.5">
                    ISIN: {selectedCompany.isin} · NSE: {selectedCompany.symbol}
                  </p>
                </div>
                <Badge variant="outline" className="text-blue-700 border-blue-300 text-[10px] shrink-0">Selected</Badge>
              </div>
            )}

            {!selectedCompany && (
              <div className="mt-3 flex flex-wrap gap-2">
                {["RELIANCE", "TCS", "INFY", "HDFCBANK", "AJAXENGG"].map((s) => (
                  <button
                    key={s}
                    className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors font-mono"
                    onClick={() => { setSearchText(s); setSelectedCompany(null); setShowDropdown(true); setDebouncedSearch(s); }}
                    type="button"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
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
