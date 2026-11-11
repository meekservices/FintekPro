import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sparkles,
  Play,
  RotateCcw,
  Download,
  Info,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  ShieldCheck,
  Zap,
  Gem,
  Award,
  Wallet,
  Users,
  Compass,
} from "lucide-react";

export interface ScreenerInPreset {
  id: string;
  title: string;
  description: string;
  category: string;
  query: string;
  badge: string;
  icon?: any;
}

export const SCREENER_IN_PRESETS: ScreenerInPreset[] = [
  {
    id: "garp",
    title: "Growth at Reasonable Price (GARP)",
    description: "Strong 3-year growth compounders trading at reasonable P/E and low PEG",
    category: "Growth & Value",
    query: "Market Capitalization > 1000 AND Price to Earning < 30 AND PEG < 1.5 AND ROCE > 18% AND Sales Growth 3Y > 15%",
    badge: "Classic GARP",
    icon: TrendingUp,
  },
  {
    id: "low-pe-high-roce",
    title: "Low P/E with High ROCE",
    description: "High capital efficiency bargains with low debt",
    category: "Value",
    query: "Price to Earning < 20 AND ROCE > 20% AND Debt to Equity < 0.5 AND Current Price > 50",
    badge: "Deep Value",
    icon: Gem,
  },
  {
    id: "debt-free-champions",
    title: "Debt Free / Low Debt Champions",
    description: "Zero debt or almost debt free balance sheets generating solid returns",
    category: "Quality",
    query: "Debt to Equity < 0.1 AND ROCE > 15% AND Return on Equity > 15% AND Market Capitalization > 500",
    badge: "Safe Balance Sheet",
    icon: ShieldCheck,
  },
  {
    id: "piotroski-high-quality",
    title: "Piotroski High Quality (Score 7-9)",
    description: "Top forensic financial health and operational turnaround strength",
    category: "Forensic Quality",
    query: "Piotroski Score >= 7 AND Return on Equity > 12% AND Market Capitalization > 1000",
    badge: "Top Health",
    icon: Award,
  },
  {
    id: "magic-formula",
    title: "Joel Greenblatt Magic Formula",
    description: "Top ranked stocks by combined high return on capital and high earnings yield",
    category: "Formula Investing",
    query: "Magic Formula Rank <= 250 AND ROCE > 15% AND Market Capitalization > 1000",
    badge: "Magic Formula",
    icon: Sparkles,
  },
  {
    id: "high-dividend-fcf",
    title: "High Dividend Yield with Cash Flow",
    description: "Generous dividend yield backed by sound debt profile and profitability",
    category: "Income",
    query: "Dividend Yield > 3% AND Debt to Equity < 0.8 AND Return on Equity > 12%",
    badge: "Income Compounder",
    icon: Wallet,
  },
  {
    id: "cash-rich-bargains",
    title: "Cash Rich Deep Value",
    description: "Companies generating high free cash flow relative to market cap",
    category: "Cash Flow",
    query: "Free Cash Flow Yield > 4% AND Price to Book < 3.5 AND Debt to Equity < 0.4",
    badge: "Cash Cows",
    icon: Zap,
  },
  {
    id: "institutional-accumulation",
    title: "Institutional Accumulation",
    description: "Heavy FII & DII backing with high FintekPro score and low pledge",
    category: "Institutional",
    query: "FII Holding > 12% AND DII Holding > 10% AND FintekPro Score > 70 AND Pledged Shares < 5%",
    badge: "FII + DII Inflow",
    icon: Users,
  },
  {
    id: "momentum-52w-high",
    title: "52-Week High Breakouts",
    description: "Trading near 52-week highs with bullish RSI and positive return",
    category: "Momentum",
    query: "% from 52W High > -8 AND RSI > 50 AND ROCE > 15% AND 1Y Return > 15%",
    badge: "Breakout",
    icon: Compass,
  },
];

const METRIC_CHIPS = [
  { label: "Market Cap > 1000", snippet: "Market Capitalization > 1000 AND " },
  { label: "P/E < 25", snippet: "Price to Earning < 25 AND " },
  { label: "PEG < 1.0", snippet: "PEG < 1.0 AND " },
  { label: "PEG < 1.5", snippet: "PEG < 1.5 AND " },
  { label: "P/B < 3", snippet: "Price to Book < 3 AND " },
  { label: "ROCE > 18%", snippet: "ROCE > 18% AND " },
  { label: "ROE > 15%", snippet: "Return on Equity > 15% AND " },
  { label: "Debt/Eq < 0.5", snippet: "Debt to Equity < 0.5 AND " },
  { label: "Sales 3Y > 15%", snippet: "Sales Growth 3Y > 15% AND " },
  { label: "Profit 3Y > 15%", snippet: "Profit Growth 3Y > 15% AND " },
  { label: "OPM > 15%", snippet: "Operating Margin > 15% AND " },
  { label: "Promoter > 50%", snippet: "Promoter Holding > 50% AND " },
  { label: "FII > 10%", snippet: "FII Holding > 10% AND " },
  { label: "DII > 10%", snippet: "DII Holding > 10% AND " },
  { label: "Piotroski ≥ 7", snippet: "Piotroski Score >= 7 AND " },
  { label: "Div Yield > 2%", snippet: "Dividend Yield > 2% AND " },
  { label: "FCF Yield > 3%", snippet: "Free Cash Flow Yield > 3% AND " },
  { label: "Graham > CMP", snippet: "Graham Number > 100 AND " },
  { label: "RSI > 50", snippet: "RSI > 50 AND " },
];

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  onRunQuery: (q: string) => void;
  onExportCsv?: () => void;
  totalMatches?: number;
  isLoading?: boolean;
}

export const ScreenerInQuerySection: React.FC<Props> = ({
  query,
  onQueryChange,
  onRunQuery,
  onExportCsv,
  totalMatches,
  isLoading,
}) => {
  const [localQuery, setLocalQuery] = useState(query);
  const [validation, setValidation] = useState<{
    valid: boolean;
    clauses: Array<{ raw: string; field: string; operator: string; value: number }>;
    error?: string;
  }>({ valid: true, clauses: [] });
  const [showCheatSheet, setShowCheatSheet] = useState(false);

  useEffect(() => {
    setLocalQuery(query);
  }, [query]);

  // Client-side quick parser validation
  useEffect(() => {
    if (!localQuery.trim()) {
      setValidation({ valid: true, clauses: [] });
      return;
    }

    const rawClauses = localQuery
      .split(/\bAND\b|\r?\n/i)
      .map((s) => s.trim())
      .filter(Boolean);

    const parsed: Array<{ raw: string; field: string; operator: string; value: number }> = [];
    let err: string | undefined;

    for (const raw of rawClauses) {
      const match = raw.match(/^([a-zA-Z0-9_\s/%-]+?)\s*(>=|<=|>|<|!=|=|≥|≤)\s*([0-9.,-]+)\s*(cr|crore|%|x)?$/i);
      if (match) {
        let op = match[2];
        if (op === "≥") op = ">=";
        if (op === "≤") op = "<=";
        parsed.push({
          raw,
          field: match[1].trim(),
          operator: op,
          value: parseFloat(match[3].replace(/,/g, "")),
        });
      } else {
        err = `Condition format check: "${raw}". Use format: [Metric] [Operator] [Value], e.g. "ROCE > 15%"`;
      }
    }

    setValidation({
      valid: !err,
      clauses: parsed,
      error: err,
    });
  }, [localQuery]);

  const handleApplyPreset = (preset: ScreenerInPreset) => {
    setLocalQuery(preset.query);
    onQueryChange(preset.query);
    onRunQuery(preset.query);
  };

  const handleInsertChip = (snippet: string) => {
    let next = localQuery ? `${localQuery.trim()} AND ${snippet.replace(/ AND $/, "")}` : snippet.replace(/ AND $/, "");
    setLocalQuery(next);
    onQueryChange(next);
  };

  const handleClear = () => {
    setLocalQuery("");
    onQueryChange("");
    onRunQuery("");
  };

  const handleExecute = () => {
    onQueryChange(localQuery);
    onRunQuery(localQuery);
  };

  return (
    <div className="space-y-3">
      {/* ── Preset Screens Bar ─────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5 pb-1">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-primary" /> Popular Screens:
        </span>
        {SCREENER_IN_PRESETS.map((p) => {
          const Icon = p.icon || TrendingUp;
          const isActive = localQuery.trim() === p.query.trim();
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => handleApplyPreset(p)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all shrink-0 ${
                isActive
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "bg-background hover:bg-muted text-foreground border-border/80"
              }`}
              title={p.description}
            >
              <Icon className="h-3 w-3 shrink-0" />
              <span>{p.title}</span>
              <span className={`text-[10px] px-1 rounded-full ${isActive ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"}`}>
                {p.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Main Query Box ─────────────────────────────────────────────────────── */}
      <Card className="border border-border/80 shadow-xs bg-gradient-to-b from-card to-background">
        <CardContent className="p-3 sm:p-4 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-primary/10 rounded-md">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="text-xs font-bold flex items-center gap-1.5">
                  Institutional Formula Query
                  <Badge variant="outline" className="text-[10px] h-4 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border-emerald-300">
                    FintekPro DB · 3,300+ Stocks
                  </Badge>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Filter FintekPro database using custom metric formulas, comparison operators ({">="}, {"<="}, {">"}, {"<"}, {"="}), and AND
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setShowCheatSheet(!showCheatSheet)}
              >
                <HelpCircle className="h-3.5 w-3.5 mr-1" />
                {showCheatSheet ? "Hide Metrics" : "Supported Metrics"}
              </Button>
              {onExportCsv && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={onExportCsv}
                  title="Export matching stocks to CSV"
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Export CSV
                </Button>
              )}
            </div>
          </div>

          {/* Textarea for formula query */}
          <div className="relative">
            <textarea
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleExecute();
                }
              }}
              rows={2}
              placeholder="e.g. Market Capitalization > 1000 AND Price to Earning < 25 AND ROCE > 15% AND Debt to equity < 1"
              className="w-full font-mono text-xs p-2.5 rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary shadow-inner resize-y min-h-[56px] leading-relaxed"
            />
          </div>

          {/* Quick Metric Insertion Chips */}
          <div className="flex flex-wrap items-center gap-1 pb-0.5 text-[11px]">
            <span className="text-muted-foreground shrink-0 font-medium mr-1 text-[10px] uppercase tracking-wider">
              Quick Add:
            </span>
            {METRIC_CHIPS.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleInsertChip(chip.snippet)}
                className="px-2 py-0.5 rounded bg-muted/60 hover:bg-muted text-foreground border border-border/50 text-[11px] font-mono shrink-0 transition-colors"
              >
                + {chip.label}
              </button>
            ))}
          </div>

          {/* Query validation & parsed pill badges */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/60">
            <div className="flex items-center gap-1.5 flex-wrap">
              {validation.error ? (
                <div className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{validation.error}</span>
                </div>
              ) : validation.clauses.length > 0 ? (
                <div className="flex items-center gap-1 flex-wrap">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span className="text-[11px] text-muted-foreground mr-1">Parsed criteria:</span>
                  {validation.clauses.map((c, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="font-mono text-[10px] px-1.5 py-0 h-4 bg-muted border border-border/80"
                    >
                      {c.field} {c.operator} {c.value}
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  <span>Showing complete universe from FintekPro database. Enter formula query above or pick a popular screen.</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {totalMatches !== undefined && (
                <span className="text-xs font-semibold font-mono text-muted-foreground">
                  <span className="text-foreground font-bold">{totalMatches.toLocaleString()}</span> stocks match
                </span>
              )}
              {localQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={handleClear}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
              <Button
                variant="default"
                size="sm"
                className="h-7 px-3 text-xs font-semibold shadow-xs"
                onClick={handleExecute}
                disabled={isLoading}
              >
                <Play className="h-3 w-3 mr-1 fill-current" />
                {isLoading ? "Running..." : "Run Screen"}
              </Button>
            </div>
          </div>

          {/* Metrics Cheat-Sheet Drawer */}
          {showCheatSheet && (
            <div className="mt-2 pt-2 border-t border-border/60 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div className="space-y-1 p-2 rounded bg-muted/30 border border-border/40">
                <div className="font-semibold text-foreground text-[10px] uppercase tracking-wider">Valuation</div>
                <div className="font-mono text-[10px] space-y-0.5 text-muted-foreground">
                  <div>Market Capitalization (Cr)</div>
                  <div>Current Price (₹)</div>
                  <div>Price to Earning (P/E)</div>
                  <div>PEG Ratio (P/E to Growth)</div>
                  <div>Price to Book (P/B)</div>
                  <div>EV to EBITDA</div>
                  <div>Graham Number</div>
                  <div>Earnings Yield (%)</div>
                </div>
              </div>

              <div className="space-y-1 p-2 rounded bg-muted/30 border border-border/40">
                <div className="font-semibold text-foreground text-[10px] uppercase tracking-wider">Quality & Margins</div>
                <div className="font-mono text-[10px] space-y-0.5 text-muted-foreground">
                  <div>ROCE (%)</div>
                  <div>Return on Equity (ROE %)</div>
                  <div>ROIC (%)</div>
                  <div>Operating Margin (OPM %)</div>
                  <div>Net Profit Margin (NPM %)</div>
                  <div>Free Cash Flow (Cr)</div>
                  <div>FCF Yield (%)</div>
                </div>
              </div>

              <div className="space-y-1 p-2 rounded bg-muted/30 border border-border/40">
                <div className="font-semibold text-foreground text-[10px] uppercase tracking-wider">Solvency & Health</div>
                <div className="font-mono text-[10px] space-y-0.5 text-muted-foreground">
                  <div>Debt to Equity (x)</div>
                  <div>Interest Coverage (x)</div>
                  <div>Current Ratio (x)</div>
                  <div>Piotroski Score (0-9)</div>
                  <div>Altman Z-Score</div>
                  <div>Magic Formula Rank</div>
                </div>
              </div>

              <div className="space-y-1 p-2 rounded bg-muted/30 border border-border/40">
                <div className="font-semibold text-foreground text-[10px] uppercase tracking-wider">Growth & Ownership</div>
                <div className="font-mono text-[10px] space-y-0.5 text-muted-foreground">
                  <div>Sales Growth 3Y (%)</div>
                  <div>Profit Growth 3Y (%)</div>
                  <div>Promoter Holding (%)</div>
                  <div>FII Holding (%)</div>
                  <div>DII Holding (%)</div>
                  <div>Pledged Shares (%)</div>
                  <div>RSI (14), 1Y Return</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

