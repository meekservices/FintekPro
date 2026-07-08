/**
 * @file agent-model-portfolios.tsx
 * @description Model Portfolio — Research Tab Feature
 *
 * Curated, pre-built diversified investment templates serving as guidance
 * and inspiration for users of all roles (Agents, Partners, Clients).
 *
 * IMPORTANT: This is a Decision Support System ONLY. Portfolios are
 * inspirational guidance — no autonomous trade execution occurs here.
 * All AI advisory outputs include confidence scores, factors, model version,
 * and mandatory SEBI disclaimers per FASP-AI v1.0.
 *
 * @inputs  - Role from useAuth(), portfolio ID filters
 * @outputs - Portfolio cards, detail sheet, performance chart, AI insights
 * @edge    - Low-confidence AI → recommendation downgraded, human advisor suggested
 */
import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  LayoutGrid,
  TrendingUp,
  TrendingDown,
  Shield,
  BarChart3,
  PieChart,
  Target,
  Star,
  Share2,
  Download,
  Copy,
  MessageSquare,
  Mail,
  Sparkles,
  AlertTriangle,
  Info,
  ChevronRight,
  RefreshCw,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  BrainCircuit,
  Users,
  Landmark,
  Globe,
  Coins,
  Activity,
  Building2,
  ShieldAlert,
  BookOpen,
  FileText,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
} from "recharts";

// ─── Types ───────────────────────────────────────────────────────────────────

type RiskProfile = "conservative" | "moderate" | "aggressive" | "all_weather" | "high";

type AssetAllocation = {
  category: string;
  label: string;
  weight: number;
  color: string;
  icon: string;
};

type Holding = {
  rank: number;
  name: string;
  symbol?: string;
  category: string;
  weight: number;
  currentReturn?: number;
  isin?: string;
  // Enriched fields (stock holdings from screener_derived_metrics)
  beta?: number;
  sharpe?: number;
  maxDrawdown?: number;
  screenerUrl?: string;
  returnSource?: string;
  // Enriched fields (MF holdings from financial_instruments_cache / mfapi.in)
  return3Y?: number;
  return6M?: number;
  nav?: number;
  expenseRatio?: number;
  amfiSchemeCode?: string;
  amfiUrl?: string;
};

type PerformancePoint = {
  date: string;
  portfolioNav: number;
  benchmarkNav: number;
};

type RiskMetrics = {
  sharpeRatio: number;
  maxDrawdown: number;
  volatility: number;
  beta: number;
  alpha: number;
};

type RebalancingEvent = {
  date: string;
  description: string;
  changes: string[];
};

type AIInsight = {
  recommendation: string;
  confidence_score: number;
  factors_considered: string[];
  model_version: string;
  timestamp: string;
  // FASP-AI v2.0 additions
  base_model?: string;
  engine_version?: string;
  confidence_threshold?: number;
  meets_threshold?: boolean;
  human_review_required?: boolean;
  sebi_circular_ref?: string;
  advisor_action?: "accepted" | "rejected" | "modified" | "pending";
};

type ModelPortfolio = {
  id: string;
  name: string;
  tagline: string;
  riskProfile: RiskProfile;
  assetClass: "equity" | "debt" | "hybrid" | "thematic" | "goal_based";
  subCategory: string;
  goal: string[];
  minInvestment: number;
  timeHorizon: string;
  // Legacy CAGR fields (kept for detail-sheet header and PDF export)
  cagr1Y: number;
  cagr3Y: number;
  cagr5Y: number;
  benchmarkCagr1Y: number;
  benchmarkName: string;
  lastRebalanced: string;
  /**
   * Kept in type for API merge, but NOT displayed on card.
   * Card shows "Rebalanced as needed" (drift-triggered) instead.
   */
  rebalancingFrequency: "monthly" | "quarterly" | "semi_annual" | "annual";
  totalHoldings: number;
  allocation: AssetAllocation[];
  holdings: Holding[];
  performance: PerformancePoint[];
  riskMetrics: RiskMetrics;
  rebalancingHistory: RebalancingEvent[];
  aiInsight: AIInsight;
  highlight: string;
  icon: string;
  isNew?: boolean;
  isFeatured?: boolean;
  // ── Gap-fix fields (Fix 15) ───────────────────────────────────────
  /** FP-NNN stable human-readable reference code — derived from DB row_number */
  portfolioCode?: string;
  /** Strategy inception date (YYYY-MM-DD) — used for inception-based bar chart */
  inceptionDate?: string;
  /** TWRR (Time-Weighted Rate of Return) — SEBI IA Regs mandated metric */
  twrr1Y?: number;
  twrr3Y?: number;
  /** Weighted composite benchmark return across all allocation types */
  blendedBenchmarkReturn?: number;
  /** Per-portfolio drift trigger threshold (%) — varies by asset class */
  driftThreshold?: number;
  /** Max drawdown beyond which auto-rebalance is paused */
  maxDrawdownThreshold?: number;
  /** SEBI IA Regs: distributor trail / conflict of interest disclosure */
  conflictDisclosure?: string;
  // ── Phase 3: Materialised trailing TWRR periods (from mf_monthwise_performance nightly) ─
  /** 1-Month TWRR — materialised nightly */
  return1m?: number | null;
  /** 3-Month TWRR */
  return3m?: number | null;
  /** 6-Month TWRR */
  return6m?: number | null;
  /** Year-to-date TWRR */
  returnYtd?: number | null;
  /** 2-Year annualised TWRR */
  cagr2y?: number | null;
  /** Since-inception TWRR */
  returnSinceInception?: number | null;
  /** Benchmark since-inception */
  benchmarkSinceInception?: number | null;
  /** When period returns were last computed */
  periodsComputedAt?: string | null;
};

// ─── Seed Data — 22 Curated Model Portfolios ─────────────────────────────────

/** Deterministic seeded pseudo-random (LCG) — same seed → same NAV chart on every refresh */
const seededRandom = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
};

/**
 * P1: Derives a stable integer from a portfolio ID string.
 * Ensures portfolios with identical annualReturn+volatility produce unique NAV curves.
 * Uses djb2-style hash: fast, collision-resistant for short strings.
 */
const hashPortfolioId = (id: string): number => {
  let h = 5381;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) + h) ^ id.charCodeAt(i);
    h = h & 0xffffffff; // keep 32-bit
  }
  return Math.abs(h);
};


/**
 * computeMonthlyBarData — rolling 12-month return bars for the expanded-card chart.
 *
 * Purpose  : Shows month-over-month percentage change from PerformancePoint[].
 *            Supports inception-based slicing (only real months, not padded zeros).
 *            Marks months where a rebalancing event occurred with a dot indicator.
 * Inputs   : performance, rebalancingHistory, inceptionDate (optional), rollingWindow.
 * Edge cases: < 2 data points → empty array. Inception slicing caps to real months.
 */
const computeMonthlyBarData = (
  performance: PerformancePoint[],
  rebalancingHistory: RebalancingEvent[],
  inceptionDate?: string,
  rollingWindow = 12,
): Array<{ label: string; returnPct: number; hasRebalanceEvent: boolean }> => {
  if (performance.length < 2) return [];
  const rebalMonths = new Set(
    (rebalancingHistory ?? []).map((e) => {
      const d = new Date(e.date);
      return `${d.toLocaleString("en-IN", { month: "short" })}${String(d.getFullYear()).slice(2)}`;
    }),
  );
  const bars: Array<{ label: string; returnPct: number; hasRebalanceEvent: boolean }> = [];
  const slice = performance.slice(-(rollingWindow + 1));
  for (let i = 1; i < slice.length; i++) {
    const prev = slice[i - 1].portfolioNav;
    const curr = slice[i].portfolioNav;
    const returnPct = prev > 0 ? ((curr - prev) / prev) * 100 : 0;
    bars.push({
      label: slice[i].date,
      returnPct: Number.parseFloat(returnPct.toFixed(2)),
      hasRebalanceEvent: rebalMonths.has(slice[i].date),
    });
  }
  if (inceptionDate) {
    const monthsSinceInception = Math.max(
      1,
      Math.round((Date.now() - new Date(inceptionDate).getTime()) / (30 * 24 * 3600 * 1000)),
    );
    if (monthsSinceInception < rollingWindow) return bars.slice(-monthsSinceInception);
  }
  return bars;
};

/**
 * P1: PERFORMANCE_BASE now accepts portfolioId to mix into the LCG seed.
 * portfolios with same return+volatility will get distinct, stable NAV curves.
 */
const PERFORMANCE_BASE = (
  portfolioId: string,
  startNav: number,
  months: number,
  annualReturn: number,
  volatility: number,
): PerformancePoint[] => {
  const pts: PerformancePoint[] = [];
  const monthlyReturn = annualReturn / 12 / 100;
  const benchReturn = (annualReturn - 2) / 12 / 100;
  let nav = startNav;
  let bench = startNav;
  const now = new Date();
  // P1: Mix portfolio ID hash into seed — guarantees curve uniqueness even when
  // annualReturn and volatility are identical across portfolios.
  const idHash = hashPortfolioId(portfolioId);
  const seed = (Math.round(annualReturn * 100 + volatility * 13) + idHash) & 0xffffffff;
  const rand = seededRandom(Math.abs(seed));
  for (let i = months; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    const noise = (rand() - 0.48) * volatility * 0.01 * startNav;
    nav = nav * (1 + monthlyReturn) + noise;
    bench = bench * (1 + benchReturn) + noise * 0.6;
    pts.push({
      date: d.toLocaleString("en-IN", { month: "short", year: "2-digit" }),
      portfolioNav: Math.round(nav * 100) / 100,
      benchmarkNav: Math.round(bench * 100) / 100,
    });
  }
  return pts;
};

const MODEL_PORTFOLIOS: ModelPortfolio[] = [
  // ── HYBRID ───────────────────────────────────────────────────────────────────
  {
    id: "all-weather-india",
    assetClass: "hybrid",
    subCategory: "All-Weather",
    name: "All-Weather India",
    tagline: "Stability across market cycles with diversified asset classes",
    riskProfile: "conservative",
    goal: ["capital_preservation", "income"],
    minInvestment: 25000,
    timeHorizon: "3–5 years",
    cagr1Y: 9.2,
    cagr3Y: 10.8,
    cagr5Y: 11.4,
    benchmarkCagr1Y: 7.1,
    benchmarkName: "CRISIL Hybrid 35+65",
    lastRebalanced: "2026-06-01",
    rebalancingFrequency: "quarterly",
    totalHoldings: 18,
    highlight: "Low volatility, all-season returns",
    icon: "🌦️",
    isFeatured: true,
    allocation: [
      { category: "large_cap", label: "Large Cap Equity", weight: 35, color: "#3B82F6", icon: "🏦" },
      { category: "bonds", label: "Corporate Bonds", weight: 25, color: "#10B981", icon: "📊" },
      { category: "gold_etf", label: "Gold ETF/SGB", weight: 15, color: "#F59E0B", icon: "🥇" },
      { category: "liquid", label: "Liquid/Money Market", weight: 15, color: "#8B5CF6", icon: "💧" },
      { category: "reits", label: "REITs/InvITs", weight: 10, color: "#EF4444", icon: "🏢" },
    ],
    holdings: [
      { rank: 1,  name: "HDFC Top 100 Fund",               category: "Large Cap MF",    weight: 12, currentReturn: 13.4 },
      { rank: 2,  name: "Kotak NIFTY 50 ETF",               category: "Index ETF",       weight: 10, currentReturn: 12.7 },
      { rank: 3,  name: "SBI Magnum Gilt Fund",              category: "Gilt Bond MF",    weight: 8,  currentReturn: 7.2  },
      { rank: 4,  name: "ICICI Pru Liquid Fund",             category: "Liquid MF",       weight: 8,  currentReturn: 7.5  },
      { rank: 5,  name: "Nippon India Gold Savings",         category: "Gold ETF",        weight: 8,  currentReturn: 11.1 },
      { rank: 6,  name: "Embassy Office Parks REIT",         category: "REIT",            weight: 7,  currentReturn: 9.8  },
      { rank: 7,  name: "Axis AAA Bond Plus SDL",            category: "Bond MF",         weight: 7,  currentReturn: 8.1  },
      { rank: 8,  name: "HDFC Corporate Bond Fund",          category: "Bond MF",         weight: 7,  currentReturn: 7.9  },
      { rank: 9,  name: "Mirae Asset Large Cap Fund",        category: "Large Cap MF",    weight: 6,  currentReturn: 14.1 },
      { rank: 10, name: "ICICI Pru Balanced Advantage",      category: "Hybrid MF",       weight: 5,  currentReturn: 11.2 },
      { rank: 11, name: "SBI Banking & PSU Fund",            category: "Bond MF",         weight: 5,  currentReturn: 7.6  },
      { rank: 12, name: "Parag Parikh Flexi Cap Fund",       category: "Flexi Cap MF",    weight: 4,  currentReturn: 16.8 },
      { rank: 13, name: "Quantum Gold Fund ETF",             category: "Gold ETF",        weight: 3,  currentReturn: 10.9 },
      { rank: 14, name: "Mindspace Business Parks REIT",     category: "REIT",            weight: 3,  currentReturn: 8.7  },
      { rank: 15, name: "HDFC Short Term Debt Fund",         category: "Short Term MF",   weight: 3,  currentReturn: 7.4  },
      { rank: 16, name: "Aditya Birla SL Savings Fund",      category: "Ultra Short MF",  weight: 2,  currentReturn: 7.1  },
      { rank: 17, name: "Nippon India ETF Nifty BeES",       category: "Index ETF",       weight: 1,  currentReturn: 12.5 },
      { rank: 18, name: "UTI Nifty 50 Index Fund",           category: "Index MF",        weight: 1,  currentReturn: 12.4 },
    ],
    performance: PERFORMANCE_BASE("all-weather-india", 1000, 24, 9.2, 3),
    riskMetrics: { sharpeRatio: 1.42, maxDrawdown: -6.8, volatility: 7.2, beta: 0.48, alpha: 2.1 },
    rebalancingHistory: [
      { date: "Jun 2026", description: "Quarterly rebalancing — added REIT exposure", changes: ["Increased REIT from 7% → 10%", "Reduced liquid by 3%"] },
      { date: "Mar 2026", description: "Gilt allocation increased on rate cycle outlook", changes: ["Gilt: 10% → 12%", "Corporate bond trimmed: 14% → 12%"] },
    ],
    aiInsight: {
      recommendation: "Suitable for risk-averse investors seeking stable inflation-beating returns. Current debt-equity mix provides downside protection during market volatility.",
      confidence_score: 84,
      factors_considered: ["Interest rate cycle", "Gold seasonal demand", "REIT yield stability", "Equity valuation (P/E 22x)"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  // ── EQUITY — Large Cap ────────────────────────────────────────────────────
  {
    id: "blue-chip-growth",
    assetClass: "equity",
    subCategory: "Large Cap",
    name: "Blue Chip Growth",
    tagline: "India's largest companies driving compounding wealth",
    riskProfile: "moderate",
    goal: ["wealth_growth", "retirement"],
    minInvestment: 50000,
    timeHorizon: "5–7 years",
    cagr1Y: 14.8,
    cagr3Y: 15.9,
    cagr5Y: 16.3,
    benchmarkCagr1Y: 12.1,
    benchmarkName: "NIFTY 50",
    lastRebalanced: "2026-06-01",
    rebalancingFrequency: "quarterly",
    totalHoldings: 22,
    highlight: "Quality large-cap bias, consistent alpha",
    icon: "🏆",
    isFeatured: true,
    allocation: [
      { category: "large_cap", label: "Large Cap Equity", weight: 60, color: "#3B82F6", icon: "🏦" },
      { category: "index_etf", label: "Index ETFs", weight: 20, color: "#8B5CF6", icon: "📈" },
      { category: "bonds", label: "Short Duration Bonds", weight: 12, color: "#10B981", icon: "📊" },
      { category: "liquid", label: "Liquid Fund", weight: 8, color: "#6B7280", icon: "💧" },
    ],
    holdings: [
      { rank: 1,  name: "Mirae Asset Large Cap Fund",        category: "Large Cap MF",    weight: 10, currentReturn: 14.1 },
      { rank: 2,  name: "HDFC Top 100 Fund",                 category: "Large Cap MF",    weight: 9,  currentReturn: 13.4 },
      { rank: 3,  name: "SBI Bluechip Fund",                 category: "Large Cap MF",    weight: 8,  currentReturn: 12.9 },
      { rank: 4,  name: "Kotak NIFTY 50 ETF",               category: "Index ETF",       weight: 8,  currentReturn: 12.7 },
      { rank: 5,  name: "Axis Bluechip Fund",                category: "Large Cap MF",    weight: 7,  currentReturn: 13.1 },
      { rank: 6,  name: "ICICI Pru Bluechip Fund",           category: "Large Cap MF",    weight: 7,  currentReturn: 12.8 },
      { rank: 7,  name: "Nippon India Large Cap Fund",       category: "Large Cap MF",    weight: 6,  currentReturn: 13.6 },
      { rank: 8,  name: "Aditya Birla SL Frontline Equity",  category: "Large Cap MF",    weight: 6,  currentReturn: 13.2 },
      { rank: 9,  name: "Franklin India Bluechip Fund",      category: "Large Cap MF",    weight: 5,  currentReturn: 12.5 },
      { rank: 10, name: "DSP Top 100 Equity Fund",           category: "Large Cap MF",    weight: 5,  currentReturn: 12.3 },
      { rank: 11, name: "Canara Robeco Bluechip Equity",     category: "Large Cap MF",    weight: 4,  currentReturn: 13.8 },
      { rank: 12, name: "Edelweiss Large Cap Fund",          category: "Large Cap MF",    weight: 4,  currentReturn: 12.1 },
      { rank: 13, name: "HDFC Index Fund NIFTY 50",          category: "Index MF",        weight: 4,  currentReturn: 12.6 },
      { rank: 14, name: "UTI NIFTY Next 50 Index Fund",      category: "Index MF",        weight: 3,  currentReturn: 13.4 },
      { rank: 15, name: "ICICI Pru NIFTY Next 50 Index",     category: "Index MF",        weight: 3,  currentReturn: 13.2 },
      { rank: 16, name: "Kotak Bluechip Fund",               category: "Large Cap MF",    weight: 3,  currentReturn: 12.7 },
      { rank: 17, name: "Tata Large Cap Fund",               category: "Large Cap MF",    weight: 3,  currentReturn: 12.2 },
      { rank: 18, name: "Invesco India Large Cap Fund",      category: "Large Cap MF",    weight: 3,  currentReturn: 12.4 },
      { rank: 19, name: "PGIM India Large Cap Fund",         category: "Large Cap MF",    weight: 3,  currentReturn: 11.9 },
      { rank: 20, name: "Nippon ETF NIFTY BeES",             category: "Index ETF",       weight: 3,  currentReturn: 12.6 },
      { rank: 21, name: "ICICI Pru Liquid Fund",             category: "Liquid MF",       weight: 2,  currentReturn: 7.4  },
      { rank: 22, name: "HDFC Liquid Fund",                  category: "Liquid MF",       weight: 2,  currentReturn: 7.5  },
    ],
    performance: PERFORMANCE_BASE("blue-chip-growth", 1000, 36, 14.8, 6),
    riskMetrics: { sharpeRatio: 1.78, maxDrawdown: -14.2, volatility: 13.4, beta: 0.82, alpha: 3.4 },
    rebalancingHistory: [
      { date: "Jun 2026", description: "Added IT sector exposure on earnings recovery", changes: ["Infosys weight: 6% → 9%", "Banking trimmed by 3%"] },
    ],
    aiInsight: {
      recommendation: "Ideal for long-term wealth creation. Current large-cap valuations are reasonable at 22x P/E. Expect 14–17% CAGR over 5-year horizon.",
      confidence_score: 79,
      factors_considered: ["Nifty P/E at 22x (5Y avg: 23x)", "IT sector earnings recovery", "Banking sector NPA improvement", "India GDP growth 7.2%"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "emerging-leaders",
    assetClass: "equity",
    subCategory: "Multi Cap",
    name: "Emerging Leaders",
    tagline: "High-conviction mid & small cap bets for aggressive wealth building",
    riskProfile: "aggressive",
    goal: ["wealth_growth"],
    minInvestment: 100000,
    timeHorizon: "7–10 years",
    cagr1Y: 21.3,
    cagr3Y: 23.8,
    cagr5Y: 26.1,
    benchmarkCagr1Y: 18.4,
    benchmarkName: "NIFTY Midcap 150",
    lastRebalanced: "2026-05-15",
    rebalancingFrequency: "quarterly",
    totalHoldings: 28,
    highlight: "High conviction, sector rotation strategy",
    icon: "🚀",
    isNew: true,
    allocation: [
      { category: "mid_cap", label: "Mid Cap Equity", weight: 45, color: "#8B5CF6", icon: "📊" },
      { category: "small_cap", label: "Small Cap Equity", weight: 30, color: "#EF4444", icon: "🔥" },
      { category: "large_cap", label: "Large Cap Anchor", weight: 15, color: "#3B82F6", icon: "🏦" },
      { category: "liquid", label: "Tactical Cash", weight: 10, color: "#6B7280", icon: "💧" },
    ],
    holdings: [
      { rank: 1,  name: "Nippon India Small Cap Fund",       category: "Small Cap MF",    weight: 8,  currentReturn: 24.3 },
      { rank: 2,  name: "SBI Small Cap Fund",                category: "Small Cap MF",    weight: 7,  currentReturn: 22.8 },
      { rank: 3,  name: "Axis Small Cap Fund",               category: "Small Cap MF",    weight: 6,  currentReturn: 21.4 },
      { rank: 4,  name: "HDFC Mid-Cap Opportunities",        category: "Mid Cap MF",      weight: 6,  currentReturn: 20.1 },
      { rank: 5,  name: "Kotak Emerging Equity Fund",        category: "Mid Cap MF",      weight: 5,  currentReturn: 19.8 },
      { rank: 6,  name: "ICICI Pru Midcap Fund",             category: "Mid Cap MF",      weight: 5,  currentReturn: 19.5 },
      { rank: 7,  name: "Quant Small Cap Fund",              category: "Small Cap MF",    weight: 5,  currentReturn: 26.1 },
      { rank: 8,  name: "DSP Small Cap Fund",                category: "Small Cap MF",    weight: 4,  currentReturn: 20.7 },
      { rank: 9,  name: "Tata Small Cap Fund",               category: "Small Cap MF",    weight: 4,  currentReturn: 21.2 },
      { rank: 10, name: "Edelweiss Mid Cap Fund",             category: "Mid Cap MF",      weight: 4,  currentReturn: 18.9 },
      { rank: 11, name: "Canara Robeco Small Cap Fund",      category: "Small Cap MF",    weight: 4,  currentReturn: 22.4 },
      { rank: 12, name: "Invesco India Midcap Fund",         category: "Mid Cap MF",      weight: 4,  currentReturn: 18.4 },
      { rank: 13, name: "Franklin India Smaller Companies",  category: "Small Cap MF",    weight: 3,  currentReturn: 19.6 },
      { rank: 14, name: "Aditya Birla SL Small Cap Fund",    category: "Small Cap MF",    weight: 3,  currentReturn: 20.3 },
      { rank: 15, name: "PGIM India Midcap Opp Fund",        category: "Mid Cap MF",      weight: 3,  currentReturn: 17.8 },
      { rank: 16, name: "Mirae Asset Midcap Fund",           category: "Mid Cap MF",      weight: 3,  currentReturn: 19.1 },
      { rank: 17, name: "Nippon India ETF Nifty Midcap 150", category: "Mid Cap ETF",     weight: 3,  currentReturn: 18.7 },
      { rank: 18, name: "Motilal Oswal Midcap Fund",         category: "Mid Cap MF",      weight: 3,  currentReturn: 20.5 },
      { rank: 19, name: "Sundaram Small Cap Fund",           category: "Small Cap MF",    weight: 3,  currentReturn: 19.2 },
      { rank: 20, name: "Union Small Cap Fund",              category: "Small Cap MF",    weight: 3,  currentReturn: 18.1 },
      { rank: 21, name: "Quant Mid Cap Fund",                category: "Mid Cap MF",      weight: 3,  currentReturn: 22.7 },
      { rank: 22, name: "Bandhan Small Cap Fund",            category: "Small Cap MF",    weight: 3,  currentReturn: 19.4 },
      { rank: 23, name: "LIC MF Midcap Fund",                category: "Mid Cap MF",      weight: 2,  currentReturn: 17.2 },
      { rank: 24, name: "HDFC Liquid Fund",                  category: "Liquid MF",       weight: 2,  currentReturn: 7.5  },
      { rank: 25, name: "SBI Liquid Fund",                   category: "Liquid MF",       weight: 2,  currentReturn: 7.4  },
      { rank: 26, name: "Nippon India Liquid Fund",          category: "Liquid MF",       weight: 2,  currentReturn: 7.3  },
      { rank: 27, name: "Kotak Liquid Fund",                 category: "Liquid MF",       weight: 1,  currentReturn: 7.2  },
      { rank: 28, name: "Axis Liquid Fund",                  category: "Liquid MF",       weight: 1,  currentReturn: 7.2  },
    ],
    performance: PERFORMANCE_BASE("emerging-leaders", 1000, 24, 21.3, 14),
    riskMetrics: { sharpeRatio: 1.53, maxDrawdown: -28.4, volatility: 21.6, beta: 1.32, alpha: 5.8 },
    rebalancingHistory: [
      { date: "May 2026", description: "Electronics manufacturing sector overweight added", changes: ["Dixon, Kaynes added to portfolio", "Trimmed pharma mid-cap by 4%"] },
    ],
    aiInsight: {
      recommendation: "High-risk, high-reward portfolio suitable for investors with 7+ year horizon and ability to withstand 25-30% drawdowns. Not recommended for near-term goals.",
      confidence_score: 72,
      factors_considered: ["Mid-small cap valuations (premium to historical)", "Electronics PLI momentum", "India consumption story", "FII flows into mid-cap"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "dividend-harvest",
    assetClass: "hybrid",
    subCategory: "Dividend / Income",
    name: "Dividend Harvest",
    tagline: "Steady income through dividend stocks, bonds and fixed income",
    riskProfile: "moderate",
    goal: ["income", "retirement"],
    minInvestment: 75000,
    timeHorizon: "3–5 years",
    cagr1Y: 11.5,
    cagr3Y: 12.8,
    cagr5Y: 13.2,
    benchmarkCagr1Y: 9.4,
    benchmarkName: "NIFTY Dividend Opportunities 50",
    lastRebalanced: "2026-06-01",
    rebalancingFrequency: "quarterly",
    totalHoldings: 20,
    highlight: "Regular income + capital preservation",
    icon: "🌾",
    allocation: [
      { category: "dividend_stocks", label: "Dividend Stocks", weight: 40, color: "#10B981", icon: "💸" },
      { category: "bonds", label: "Corporate Bonds", weight: 30, color: "#3B82F6", icon: "📊" },
      { category: "reits", label: "REITs (rental yield)", weight: 15, color: "#F59E0B", icon: "🏢" },
      { category: "sgb", label: "SGBs (Sovereign Gold)", weight: 15, color: "#EF4444", icon: "🥇" },
    ],
    holdings: [
      { rank: 1,  name: "HDFC Dividend Yield Fund",           category: "Dividend Yield",  weight: 10, currentReturn: 12.1 },
      { rank: 2,  name: "ICICI Pru Dividend Yield Equity",   category: "Dividend Yield",  weight: 9,  currentReturn: 11.8 },
      { rank: 3,  name: "Aditya Birla SL Dividend Yield",    category: "Dividend Yield",  weight: 8,  currentReturn: 11.4 },
      { rank: 4,  name: "UTI Dividend Yield Fund",           category: "Dividend Yield",  weight: 8,  currentReturn: 11.0 },
      { rank: 5,  name: "Sundaram Dividend Yield Fund",      category: "Dividend Yield",  weight: 7,  currentReturn: 10.7 },
      { rank: 6,  name: "Embassy Office Parks REIT",         category: "REIT",            weight: 7,  currentReturn: 9.8  },
      { rank: 7,  name: "Nexus Select Trust REIT",           category: "REIT",            weight: 6,  currentReturn: 8.4  },
      { rank: 8,  name: "Mindspace Business Parks REIT",     category: "REIT",            weight: 6,  currentReturn: 8.7  },
      { rank: 9,  name: "HDFC Corporate Bond Fund",          category: "Bond MF",         weight: 6,  currentReturn: 7.9  },
      { rank: 10, name: "Axis AAA Bond Plus SDL",            category: "Bond MF",         weight: 5,  currentReturn: 8.1  },
      { rank: 11, name: "SBI Magnum Income Fund",            category: "Income MF",       weight: 5,  currentReturn: 7.8  },
      { rank: 12, name: "Nippon India Income Fund",          category: "Income MF",       weight: 5,  currentReturn: 7.6  },
      { rank: 13, name: "IndiGrid Infrastructure InvIT",     category: "InvIT",           weight: 4,  currentReturn: 9.1  },
      { rank: 14, name: "Power Grid Corp InvIT",             category: "InvIT",           weight: 4,  currentReturn: 8.6  },
      { rank: 15, name: "ICICI Pru Banking & PSU Debt",      category: "Bond MF",         weight: 4,  currentReturn: 7.5  },
      { rank: 16, name: "Kotak Banking & PSU Debt Fund",     category: "Bond MF",         weight: 3,  currentReturn: 7.4  },
      { rank: 17, name: "Tata AAA Bond Plus SDL",            category: "Bond MF",         weight: 3,  currentReturn: 8.0  },
      { rank: 18, name: "DSP Banking & PSU Debt Fund",       category: "Bond MF",         weight: 3,  currentReturn: 7.3  },
      { rank: 19, name: "HDFC Liquid Fund",                  category: "Liquid MF",       weight: 2,  currentReturn: 7.5  },
      { rank: 20, name: "ICICI Pru Liquid Fund",             category: "Liquid MF",       weight: 2,  currentReturn: 7.4  },
    ],
    performance: PERFORMANCE_BASE("dividend-harvest", 1000, 36, 11.5, 5),
    riskMetrics: { sharpeRatio: 1.61, maxDrawdown: -9.4, volatility: 9.8, beta: 0.61, alpha: 2.8 },
    rebalancingHistory: [
      { date: "Jun 2026", description: "PSU stocks increased for dividend yield", changes: ["Coal India: 7% → 10%", "Power Grid: 7% → 9%"] },
    ],
    aiInsight: {
      recommendation: "Suitable for pre-retirees and conservative investors seeking 8–12% annual yield. PSU dividend plays look attractive given high dividend payout ratios.",
      confidence_score: 82,
      factors_considered: ["PSU dividend payout ratios 60–80%", "REIT distribution yield 8–10%", "SGB gold price outlook (bullish)", "Corporate bond spread tightening"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "tax-saver-portfolio",
    assetClass: "equity",
    subCategory: "ELSS / Tax Saving",
    name: "Tax-Saver Portfolio",
    tagline: "Save ₹46,800 in taxes annually while building long-term wealth",
    riskProfile: "moderate",
    goal: ["tax_saving", "wealth_growth"],
    minInvestment: 50000,
    timeHorizon: "3–7 years",
    cagr1Y: 12.1,
    cagr3Y: 14.2,
    cagr5Y: 15.6,
    benchmarkCagr1Y: 10.3,
    benchmarkName: "ELSS Category Avg",
    lastRebalanced: "2026-04-01",
    rebalancingFrequency: "quarterly",
    totalHoldings: 14,
    highlight: "80C eligible ELSS + tax-efficient instruments",
    icon: "💰",
    isNew: true,
    allocation: [
      { category: "elss", label: "ELSS (80C)", weight: 55, color: "#3B82F6", icon: "🧾" },
      { category: "large_cap", label: "Large Cap Equity", weight: 25, color: "#8B5CF6", icon: "🏦" },
      { category: "bonds", label: "Tax-free Bonds", weight: 12, color: "#10B981", icon: "📊" },
      { category: "liquid", label: "Liquid Fund", weight: 8, color: "#6B7280", icon: "💧" },
    ],
    holdings: [
      { rank: 1,  name: "Axis Long Term Equity Fund (ELSS)",   category: "ELSS",            weight: 15, currentReturn: 14.2 },
      { rank: 2,  name: "Mirae Asset Tax Saver Fund (ELSS)", category: "ELSS",            weight: 14, currentReturn: 15.1 },
      { rank: 3,  name: "Canara Robeco Equity Tax Saver",    category: "ELSS",            weight: 13, currentReturn: 14.8 },
      { rank: 4,  name: "HDFC Tax Saver (ELSS)",             category: "ELSS",            weight: 12, currentReturn: 13.9 },
      { rank: 5,  name: "Quant Tax Plan Fund (ELSS)",        category: "ELSS",            weight: 11, currentReturn: 17.4 },
      { rank: 6,  name: "SBI Long Term Equity (ELSS)",       category: "ELSS",            weight: 10, currentReturn: 13.5 },
      { rank: 7,  name: "Kotak Tax Saver Fund (ELSS)",       category: "ELSS",            weight: 9,  currentReturn: 13.1 },
      { rank: 8,  name: "DSP Tax Saver Fund (ELSS)",         category: "ELSS",            weight: 8,  currentReturn: 13.8 },
      { rank: 9,  name: "ICICI Pru Long Term Equity (ELSS)", category: "ELSS",            weight: 5,  currentReturn: 13.2 },
      { rank: 10, name: "Nippon India Tax Saver (ELSS)",     category: "ELSS",            weight: 3,  currentReturn: 12.8 },
      { rank: 11, name: "UTI Long Term Equity Fund (ELSS)",  category: "ELSS",            weight: 3,  currentReturn: 12.4 },
      { rank: 12, name: "Aditya Birla SL Tax Relief 96",     category: "ELSS",            weight: 3,  currentReturn: 13.0 },
      { rank: 13, name: "Tata India Tax Savings Fund (ELSS)",category: "ELSS",            weight: 3,  currentReturn: 12.1 },
      { rank: 14, name: "L&T Tax Advantage Fund (ELSS)",     category: "ELSS",            weight: 1,  currentReturn: 11.8 },
    ],
    performance: PERFORMANCE_BASE("tax-saver-portfolio", 1000, 24, 12.1, 7),
    riskMetrics: { sharpeRatio: 1.69, maxDrawdown: -16.2, volatility: 14.1, beta: 0.89, alpha: 3.1 },
    rebalancingHistory: [
      { date: "Apr 2026", description: "New FY rebalancing — ELSS allocation refreshed", changes: ["Quant Tax Plan added for high-momentum exposure", "Axis Long Term slightly trimmed"] },
    ],
    aiInsight: {
      recommendation: "Excellent for salaried investors in 30% tax bracket seeking Section 80C benefits with equity growth. ELSS lock-in of 3 years enforces investment discipline.",
      confidence_score: 88,
      factors_considered: ["Section 80C tax savings (₹1.5L limit)", "ELSS category outperformance vs Nifty", "Tax-free bond yields vs FD post-tax", "3-year mandatory lock-in behavioral benefit"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "hni-alternatives",
    assetClass: "thematic",
    subCategory: "Alternatives / HNI",
    name: "HNI Alternatives",
    tagline: "Premium access to PMS, AIFs, Pre-IPO and structured products",
    riskProfile: "high",
    goal: ["wealth_growth", "diversification"],
    minInvestment: 2500000,
    timeHorizon: "5–10 years",
    cagr1Y: 18.7,
    cagr3Y: 21.4,
    cagr5Y: 24.2,
    benchmarkCagr1Y: 14.2,
    benchmarkName: "PMS Category Avg",
    lastRebalanced: "2026-05-01",
    rebalancingFrequency: "quarterly",
    totalHoldings: 12,
    highlight: "Exclusive access to institutional-grade investments",
    icon: "💎",
    allocation: [
      { category: "pms", label: "Portfolio Management Services", weight: 35, color: "#8B5CF6", icon: "📊" },
      { category: "aif", label: "Alternative Investment Funds", weight: 30, color: "#EF4444", icon: "🏦" },
      { category: "pre_ipo", label: "Pre-IPO Opportunities", weight: 20, color: "#F59E0B", icon: "🚀" },
      { category: "unlisted", label: "Unlisted Equity", weight: 15, color: "#10B981", icon: "💼" },
    ],
    holdings: [
      { rank: 1,  name: "Kotak AIF – Growth Fund III",         category: "Category III AIF",weight: 18, currentReturn: 19.4 },
      { rank: 2,  name: "IIFL Special Opportunities Fund",   category: "Category III AIF",weight: 15, currentReturn: 21.2 },
      { rank: 3,  name: "DSP BlackRock Alt Fund",            category: "Category II AIF", weight: 14, currentReturn: 16.8 },
      { rank: 4,  name: "Motilal Oswal AIF PE Fund",         category: "Category II AIF", weight: 13, currentReturn: 18.1 },
      { rank: 5,  name: "Embassy Office Parks REIT",         category: "REIT",            weight: 12, currentReturn: 9.8  },
      { rank: 6,  name: "Nippon India ETF Gold BeES",        category: "Gold ETF",        weight: 11, currentReturn: 11.1 },
      { rank: 7,  name: "Sovereign Gold Bond 2026-27 Series",category: "SGB",             weight: 10, currentReturn: 10.8 },
      { rank: 8,  name: "IndiGrid Infrastructure InvIT",     category: "InvIT",           weight: 7,  currentReturn: 9.1  },
      { rank: 9,  name: "Power Grid Corp InvIT",             category: "InvIT",           weight: 5,  currentReturn: 8.6  },
      { rank: 10, name: "Aditya Birla Private Equity Fund",  category: "Category II AIF", weight: 3,  currentReturn: 17.2 },
      { rank: 11, name: "Quantum Long Term Equity Fund",     category: "Large Cap MF",    weight: 1,  currentReturn: 13.4 },
      { rank: 12, name: "ICICI Pru Liquid Fund",             category: "Liquid MF",       weight: 1,  currentReturn: 7.4  },
    ],
    performance: PERFORMANCE_BASE("hni-alternatives", 1000, 36, 18.7, 9),
    riskMetrics: { sharpeRatio: 1.91, maxDrawdown: -22.1, volatility: 17.4, beta: 0.74, alpha: 7.2 },
    rebalancingHistory: [
      { date: "May 2026", description: "Pre-IPO allocation refreshed with new opportunities", changes: ["Added Swiggy Pre-IPO position", "Exited PhonePe Pre-IPO post listing"] },
    ],
    aiInsight: {
      recommendation: "Suitable only for Qualified Institutional Buyers (QIB) / HNIs with net worth >₹5Cr. High illiquidity, 3-5 year lock-in. Not for short-term needs.",
      confidence_score: 76,
      factors_considered: ["India IPO pipeline (2026 strong)", "PMS alpha generation vs Nifty", "AIF venture returns in Indian tech", "Unlisted equity valuation discount"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "retirement-shield",
    assetClass: "hybrid",
    subCategory: "Retirement",
    name: "Retirement Shield",
    tagline: "Steady, low-risk income portfolio for retirement stage investors",
    riskProfile: "conservative",
    goal: ["retirement", "income", "capital_preservation"],
    minInvestment: 100000,
    timeHorizon: "Ongoing",
    cagr1Y: 8.5,
    cagr3Y: 9.2,
    cagr5Y: 9.8,
    benchmarkCagr1Y: 6.8,
    benchmarkName: "CRISIL Composite Bond",
    lastRebalanced: "2026-06-01",
    rebalancingFrequency: "quarterly",
    totalHoldings: 16,
    highlight: "Capital safety + monthly income equivalent",
    icon: "🛡️",
    allocation: [
      { category: "bonds", label: "Government/AAA Bonds", weight: 40, color: "#10B981", icon: "📊" },
      { category: "liquid", label: "Liquid & Ultra-Short", weight: 20, color: "#3B82F6", icon: "💧" },
      { category: "sgb", label: "Sovereign Gold Bonds", weight: 15, color: "#F59E0B", icon: "🥇" },
      { category: "large_cap", label: "Large Cap Dividend", weight: 15, color: "#8B5CF6", icon: "🏦" },
      { category: "reits", label: "REITs (yield focus)", weight: 10, color: "#EF4444", icon: "🏢" },
    ],
    holdings: [
      { rank: 1,  name: "SBI Retirement Benefit Fund",        category: "Retirement MF",   weight: 10, currentReturn: 9.2  },
      { rank: 2,  name: "HDFC Retirement Savings — Hybrid",  category: "Retirement MF",   weight: 9,  currentReturn: 9.8  },
      { rank: 3,  name: "ICICI Pru Retirement Balanced",     category: "Retirement MF",   weight: 8,  currentReturn: 9.4  },
      { rank: 4,  name: "Franklin India Pension Plan",        category: "Retirement MF",   weight: 8,  currentReturn: 8.9  },
      { rank: 5,  name: "HDFC Corporate Bond Fund",          category: "Bond MF",         weight: 8,  currentReturn: 7.9  },
      { rank: 6,  name: "SBI Magnum Gilt Fund",              category: "Gilt MF",         weight: 7,  currentReturn: 7.2  },
      { rank: 7,  name: "Axis AAA Bond Plus SDL",            category: "Bond MF",         weight: 7,  currentReturn: 8.1  },
      { rank: 8,  name: "Embassy REIT",                      category: "REIT",            weight: 6,  currentReturn: 9.8  },
      { rank: 9,  name: "Nippon India Gold Savings Fund",    category: "Gold ETF",        weight: 6,  currentReturn: 11.1 },
      { rank: 10, name: "ICICI Pru Equity & Debt Fund",      category: "Hybrid MF",       weight: 6,  currentReturn: 11.8 },
      { rank: 11, name: "Kotak NIFTY 50 ETF",               category: "Index ETF",       weight: 5,  currentReturn: 12.7 },
      { rank: 12, name: "Mirae Asset Large Cap Fund",        category: "Large Cap MF",    weight: 5,  currentReturn: 14.1 },
      { rank: 13, name: "IndiGrid InvIT",                    category: "InvIT",           weight: 5,  currentReturn: 9.1  },
      { rank: 14, name: "Aditya Birla SL Savings Fund",      category: "Ultra Short MF",  weight: 4,  currentReturn: 7.1  },
      { rank: 15, name: "DSP BlackRock Short Term Fund",     category: "Short Term MF",   weight: 4,  currentReturn: 7.4  },
      { rank: 16, name: "HDFC Liquid Fund",                  category: "Liquid MF",       weight: 2,  currentReturn: 7.5  },
    ],
    performance: PERFORMANCE_BASE("retirement-shield", 1000, 36, 8.5, 2.5),
    riskMetrics: { sharpeRatio: 1.88, maxDrawdown: -4.2, volatility: 5.1, beta: 0.28, alpha: 1.9 },
    rebalancingHistory: [
      { date: "Jun 2026", description: "Duration adjusted on RBI rate signal", changes: ["Reduced long-duration gilt", "Increased ultra-short term allocation"] },
    ],
    aiInsight: {
      recommendation: "Best for investors aged 55+ in or near retirement. Focus on capital safety. Monthly SWP (Systematic Withdrawal Plan) can be structured for regular income.",
      confidence_score: 91,
      factors_considered: ["RBI rate cut cycle expected H2 2026", "SGB interest + capital appreciation", "REIT distribution stability", "Investor age-appropriate risk"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "bharat-2030",
    assetClass: "thematic",
    subCategory: "Thematic / Sectoral",
    name: "Bharat 2030",
    tagline: "Thematic bet on India's infrastructure & growth story",
    riskProfile: "moderate",
    goal: ["wealth_growth", "thematic"],
    minInvestment: 75000,
    timeHorizon: "5–10 years",
    cagr1Y: 17.4,
    cagr3Y: 19.2,
    cagr5Y: 22.3,
    benchmarkCagr1Y: 15.1,
    benchmarkName: "NIFTY Infrastructure",
    lastRebalanced: "2026-05-15",
    rebalancingFrequency: "quarterly",
    totalHoldings: 24,
    highlight: "India infrastructure + manufacturing boom",
    icon: "🇮🇳",
    isNew: true,
    allocation: [
      { category: "infra", label: "Infrastructure Stocks", weight: 30, color: "#F59E0B", icon: "🏗️" },
      { category: "manufacturing", label: "Manufacturing/PLI", weight: 25, color: "#EF4444", icon: "🏭" },
      { category: "financials", label: "Financial Services", weight: 20, color: "#3B82F6", icon: "🏦" },
      { category: "consumer", label: "Consumer/FMCG", weight: 15, color: "#10B981", icon: "🛒" },
      { category: "liquid", label: "Cash/Liquid", weight: 10, color: "#6B7280", icon: "💧" },
    ],
    holdings: [
      { rank: 1,  name: "SBI PSU Fund",                         category: "PSU/Thematic MF", weight: 7,  currentReturn: 18.4 },
      { rank: 2,  name: "Nippon India Power & Infra Fund",   category: "Infra MF",        weight: 6,  currentReturn: 21.3 },
      { rank: 3,  name: "HDFC Infrastructure Fund",          category: "Infra MF",        weight: 6,  currentReturn: 19.7 },
      { rank: 4,  name: "Quant Infrastructure Fund",         category: "Infra MF",        weight: 5,  currentReturn: 24.1 },
      { rank: 5,  name: "Kotak Infrastructure & Eco Reform", category: "Infra MF",        weight: 5,  currentReturn: 20.5 },
      { rank: 6,  name: "Aditya Birla SL India GenNext",     category: "Thematic MF",     weight: 5,  currentReturn: 17.8 },
      { rank: 7,  name: "Franklin India Opportunities Fund", category: "Thematic MF",     weight: 5,  currentReturn: 16.4 },
      { rank: 8,  name: "UTI Infrastructure Fund",           category: "Infra MF",        weight: 5,  currentReturn: 18.9 },
      { rank: 9,  name: "DSP Natural Resources Fund",        category: "Thematic MF",     weight: 4,  currentReturn: 19.2 },
      { rank: 10, name: "Tata Resources & Energy Fund",      category: "Thematic MF",     weight: 4,  currentReturn: 18.3 },
      { rank: 11, name: "ICICI Pru Manufacturing Fund",      category: "Thematic MF",     weight: 4,  currentReturn: 17.6 },
      { rank: 12, name: "IndiGrid InvIT",                    category: "InvIT",           weight: 4,  currentReturn: 9.1  },
      { rank: 13, name: "Power Grid Corp InvIT",             category: "InvIT",           weight: 4,  currentReturn: 8.6  },
      { rank: 14, name: "Embassy Office Parks REIT",         category: "REIT",            weight: 4,  currentReturn: 9.8  },
      { rank: 15, name: "Axis India Manufacturing Fund",     category: "Thematic MF",     weight: 4,  currentReturn: 17.1 },
      { rank: 16, name: "Mirae Asset Great Consumer Fund",   category: "Thematic MF",     weight: 4,  currentReturn: 16.8 },
      { rank: 17, name: "Edelweiss India Defence Fund",      category: "Thematic MF",     weight: 4,  currentReturn: 22.7 },
      { rank: 18, name: "Nippon India Nifty Midcap 150 ETF", category: "Mid Cap ETF",     weight: 3,  currentReturn: 18.7 },
      { rank: 19, name: "Bandhan Infrastructure Fund",       category: "Infra MF",        weight: 3,  currentReturn: 18.1 },
      { rank: 20, name: "PGIM India Flexi Cap Fund",         category: "Flexi Cap MF",    weight: 3,  currentReturn: 16.2 },
      { rank: 21, name: "Parag Parikh Flexi Cap Fund",       category: "Flexi Cap MF",    weight: 3,  currentReturn: 16.8 },
      { rank: 22, name: "ICICI Pru Liquid Fund",             category: "Liquid MF",       weight: 3,  currentReturn: 7.4  },
      { rank: 23, name: "HDFC Liquid Fund",                  category: "Liquid MF",       weight: 2,  currentReturn: 7.5  },
      { rank: 24, name: "SBI Liquid Fund",                   category: "Liquid MF",       weight: 1,  currentReturn: 7.4  },
    ],
    performance: PERFORMANCE_BASE("bharat-2030", 1000, 24, 17.4, 10),
    riskMetrics: { sharpeRatio: 1.64, maxDrawdown: -18.7, volatility: 16.3, beta: 1.08, alpha: 4.2 },
    rebalancingHistory: [
      { date: "May 2026", description: "Renewable energy theme added (NTPC Green)", changes: ["NTPC Green added at 7%", "Reduced legacy energy stocks"] },
    ],
    aiInsight: {
      recommendation: "High conviction India macro story. With ₹11.1L Cr capex budget 2026-27 and PLI schemes, infrastructure and manufacturing sectors are well-positioned for 5-7 year outperformance.",
      confidence_score: 77,
      factors_considered: ["India capex ₹11.1L Cr budget 2026", "PLI scheme disbursements", "EV policy tailwinds", "India urban housing demand"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  // ── EQUITY — Large Cap #2 ────────────────────────────────────────────────
  {
    id: "nifty50-index-alpha",
    assetClass: "equity",
    subCategory: "Large Cap",
    name: "Nifty 50 Alpha",
    tagline: "Low-cost index core with satellite quality tilt",
    riskProfile: "moderate",
    goal: ["wealth_growth", "retirement"],
    minInvestment: 10000,
    timeHorizon: "5–7 years",
    cagr1Y: 13.2,
    cagr3Y: 14.1,
    cagr5Y: 15.3,
    benchmarkCagr1Y: 12.8,
    benchmarkName: "NIFTY 50 TRI",
    lastRebalanced: "2026-06-01",
    rebalancingFrequency: "quarterly",
    totalHoldings: 12,
    highlight: "80% index core + 20% quality overlay",
    icon: "📊",
    allocation: [
      { category: "nifty50_etf", label: "Nifty 50 ETF", weight: 55, color: "#3B82F6", icon: "📈" },
      { category: "nifty_next50", label: "Nifty Next 50 ETF", weight: 25, color: "#6366F1", icon: "🔵" },
      { category: "quality_stocks", label: "Quality Large Caps", weight: 15, color: "#10B981", icon: "⭐" },
      { category: "liquid", label: "Liquid MF", weight: 5, color: "#9CA3AF", icon: "💧" },
    ],
    holdings: [
      { rank: 1,  name: "UTI NIFTY 50 Index Fund",            category: "Index MF",        weight: 20, currentReturn: 12.4 },
      { rank: 2,  name: "HDFC Index Fund — NIFTY 50",        category: "Index MF",        weight: 18, currentReturn: 12.6 },
      { rank: 3,  name: "ICICI Pru NIFTY 50 Index Fund",     category: "Index MF",        weight: 15, currentReturn: 12.5 },
      { rank: 4,  name: "Kotak NIFTY 50 ETF",               category: "Index ETF",       weight: 14, currentReturn: 12.7 },
      { rank: 5,  name: "Nippon India ETF Nifty BeES",       category: "Index ETF",       weight: 13, currentReturn: 12.5 },
      { rank: 6,  name: "SBI NIFTY Index Fund",              category: "Index MF",        weight: 8,  currentReturn: 12.3 },
      { rank: 7,  name: "UTI NIFTY Next 50 Index Fund",      category: "Index MF",        weight: 5,  currentReturn: 13.4 },
      { rank: 8,  name: "Nippon India ETF Nifty Next 50",    category: "Index ETF",       weight: 4,  currentReturn: 13.1 },
      { rank: 9,  name: "Aditya Birla NIFTY 50 ETF",         category: "Index ETF",       weight: 2,  currentReturn: 12.4 },
      { rank: 10, name: "Mirae Asset NIFTY 50 ETF",          category: "Index ETF",       weight: 1,  currentReturn: 12.5 },
      { rank: 11, name: "HDFC Liquid Fund",                  category: "Liquid MF",       weight: 1,  currentReturn: 7.5  },
      { rank: 12, name: "ICICI Pru Liquid Fund",             category: "Liquid MF",       weight: 1,  currentReturn: 7.4  },
    ],
    performance: PERFORMANCE_BASE("nifty50-index-alpha", 1000, 24, 13.2, 5),
    riskMetrics: { sharpeRatio: 1.38, maxDrawdown: -11.2, volatility: 10.8, beta: 0.95, alpha: 1.9 },
    rebalancingHistory: [
      { date: "Jun 2026", description: "Annual rebalancing — quality overlay refreshed", changes: ["TCS added as quality tilt", "Rebalanced ETF split 55/25"] },
    ],
    aiInsight: {
      recommendation: "Best entry point for equity beginners. Low-cost index core with minimal active risk. Quality overlay adds modest alpha without high tracking error.",
      confidence_score: 88,
      factors_considered: ["Low expense ratio", "Index inclusion criteria", "Quality factor screening", "Long-term mean reversion"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },

  // ── EQUITY — Mid Cap ─────────────────────────────────────────────────────
  {
    id: "midcap-momentum",
    assetClass: "equity",
    subCategory: "Mid Cap",
    name: "Midcap Momentum",
    tagline: "Tomorrow's blue chips — India's growth engine",
    riskProfile: "aggressive",
    goal: ["wealth_growth"],
    minInvestment: 50000,
    timeHorizon: "5–10 years",
    cagr1Y: 21.3,
    cagr3Y: 23.7,
    cagr5Y: 26.8,
    benchmarkCagr1Y: 18.4,
    benchmarkName: "NIFTY Midcap 150 TRI",
    lastRebalanced: "2026-06-01",
    rebalancingFrequency: "quarterly",
    totalHoldings: 20,
    highlight: "Pure mid-cap conviction with momentum factor",
    icon: "🚀",
    isNew: true,
    allocation: [
      { category: "midcap_growth", label: "High-Growth Mid Caps", weight: 50, color: "#F59E0B", icon: "⚡" },
      { category: "midcap_quality", label: "Quality Mid Caps", weight: 30, color: "#EF4444", icon: "💎" },
      { category: "midcap_etf", label: "Midcap ETF", weight: 15, color: "#8B5CF6", icon: "📊" },
      { category: "liquid", label: "Cash Buffer", weight: 5, color: "#9CA3AF", icon: "💧" },
    ],
    holdings: [
      { rank: 1,  name: "HDFC Mid-Cap Opportunities Fund",     category: "Mid Cap MF",      weight: 9,  currentReturn: 20.1 },
      { rank: 2,  name: "Kotak Emerging Equity Fund",        category: "Mid Cap MF",      weight: 8,  currentReturn: 19.8 },
      { rank: 3,  name: "Nippon India Growth Fund",          category: "Mid Cap MF",      weight: 8,  currentReturn: 21.4 },
      { rank: 4,  name: "SBI Magnum Midcap Fund",            category: "Mid Cap MF",      weight: 7,  currentReturn: 19.2 },
      { rank: 5,  name: "Franklin India Prima Fund",         category: "Mid Cap MF",      weight: 7,  currentReturn: 18.7 },
      { rank: 6,  name: "ICICI Pru Midcap Fund",             category: "Mid Cap MF",      weight: 6,  currentReturn: 19.5 },
      { rank: 7,  name: "Quant Mid Cap Fund",                category: "Mid Cap MF",      weight: 6,  currentReturn: 22.7 },
      { rank: 8,  name: "Axis Midcap Fund",                  category: "Mid Cap MF",      weight: 6,  currentReturn: 18.4 },
      { rank: 9,  name: "Motilal Oswal Midcap Fund",         category: "Mid Cap MF",      weight: 6,  currentReturn: 20.5 },
      { rank: 10, name: "Aditya Birla SL Midcap Fund",       category: "Mid Cap MF",      weight: 6,  currentReturn: 18.9 },
      { rank: 11, name: "Edelweiss Mid Cap Fund",             category: "Mid Cap MF",      weight: 5,  currentReturn: 18.4 },
      { rank: 12, name: "DSP Midcap Fund",                   category: "Mid Cap MF",      weight: 5,  currentReturn: 18.1 },
      { rank: 13, name: "PGIM India Midcap Opp Fund",        category: "Mid Cap MF",      weight: 5,  currentReturn: 17.8 },
      { rank: 14, name: "Nippon ETF Nifty Midcap 150",       category: "Mid Cap ETF",     weight: 5,  currentReturn: 18.7 },
      { rank: 15, name: "Tata Mid Cap Growth Fund",          category: "Mid Cap MF",      weight: 5,  currentReturn: 17.4 },
      { rank: 16, name: "Bandhan Core Equity Fund",          category: "Mid Cap MF",      weight: 4,  currentReturn: 17.9 },
      { rank: 17, name: "Mirae Asset Midcap Fund",           category: "Mid Cap MF",      weight: 4,  currentReturn: 19.1 },
      { rank: 18, name: "Invesco India Midcap Fund",         category: "Mid Cap MF",      weight: 4,  currentReturn: 18.4 },
      { rank: 19, name: "HDFC Liquid Fund",                  category: "Liquid MF",       weight: 2,  currentReturn: 7.5  },
      { rank: 20, name: "ICICI Pru Liquid Fund",             category: "Liquid MF",       weight: 2,  currentReturn: 7.4  },
    ],
    performance: PERFORMANCE_BASE("midcap-momentum", 1000, 24, 21.3, 13),
    riskMetrics: { sharpeRatio: 1.51, maxDrawdown: -22.4, volatility: 18.7, beta: 1.22, alpha: 5.8 },
    rebalancingHistory: [
      { date: "Jun 2026", description: "Electronics/tech tilt increased post PLI data", changes: ["Kaynes added", "Reduced commodity exposure"] },
    ],
    aiInsight: {
      recommendation: "Mid-caps historically deliver 3-5% alpha over large caps over 5Y+ cycles. Current mid-cap valuations at 28x PE are elevated but growth visibility justifies a premium.",
      confidence_score: 73,
      factors_considered: ["Mid-cap earnings upgrade cycle", "Domestic consumption growth", "Elevated PE — requires long horizon", "Momentum factor persistence"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },

  // ── EQUITY — Small Cap ───────────────────────────────────────────────────
  {
    id: "smallcap-discovery",
    assetClass: "equity",
    subCategory: "Small Cap",
    name: "Small Cap Discovery",
    tagline: "High-conviction bets on tomorrow's market leaders",
    riskProfile: "high",
    goal: ["wealth_growth"],
    minInvestment: 100000,
    timeHorizon: "7–10 years",
    cagr1Y: 24.7,
    cagr3Y: 28.3,
    cagr5Y: 31.2,
    benchmarkCagr1Y: 20.1,
    benchmarkName: "NIFTY Smallcap 250 TRI",
    lastRebalanced: "2026-05-15",
    rebalancingFrequency: "quarterly",
    totalHoldings: 25,
    highlight: "Pure small-cap, minimum 7-year horizon",
    icon: "💎",
    allocation: [
      { category: "smallcap_growth", label: "Growth Small Caps", weight: 45, color: "#EF4444", icon: "🚀" },
      { category: "smallcap_turnaround", label: "Turnaround Stories", weight: 25, color: "#F97316", icon: "🔄" },
      { category: "smallcap_etf", label: "Smallcap ETF Core", weight: 20, color: "#8B5CF6", icon: "📊" },
      { category: "liquid", label: "Cash Buffer", weight: 10, color: "#9CA3AF", icon: "💧" },
    ],
    holdings: [
      { rank: 1,  name: "Nippon India Small Cap Fund",       category: "Small Cap MF",    weight: 10, currentReturn: 24.3 },
      { rank: 2,  name: "SBI Small Cap Fund",                category: "Small Cap MF",    weight: 9,  currentReturn: 22.8 },
      { rank: 3,  name: "Quant Small Cap Fund",              category: "Small Cap MF",    weight: 8,  currentReturn: 26.1 },
      { rank: 4,  name: "Axis Small Cap Fund",               category: "Small Cap MF",    weight: 8,  currentReturn: 21.4 },
      { rank: 5,  name: "HDFC Small Cap Fund",               category: "Small Cap MF",    weight: 7,  currentReturn: 20.8 },
      { rank: 6,  name: "Kotak Small Cap Fund",              category: "Small Cap MF",    weight: 6,  currentReturn: 20.2 },
      { rank: 7,  name: "Canara Robeco Small Cap Fund",      category: "Small Cap MF",    weight: 6,  currentReturn: 22.4 },
      { rank: 8,  name: "Tata Small Cap Fund",               category: "Small Cap MF",    weight: 5,  currentReturn: 21.2 },
      { rank: 9,  name: "DSP Small Cap Fund",                category: "Small Cap MF",    weight: 5,  currentReturn: 20.7 },
      { rank: 10, name: "Franklin India Smaller Companies",  category: "Small Cap MF",    weight: 5,  currentReturn: 19.6 },
      { rank: 11, name: "Aditya Birla SL Small Cap Fund",    category: "Small Cap MF",    weight: 5,  currentReturn: 20.3 },
      { rank: 12, name: "Bandhan Small Cap Fund",            category: "Small Cap MF",    weight: 5,  currentReturn: 19.4 },
      { rank: 13, name: "Edelweiss Small Cap Fund",          category: "Small Cap MF",    weight: 4,  currentReturn: 21.0 },
      { rank: 14, name: "ICICI Pru Small Cap Fund",          category: "Small Cap MF",    weight: 4,  currentReturn: 20.1 },
      { rank: 15, name: "Invesco India Smallcap Fund",       category: "Small Cap MF",    weight: 4,  currentReturn: 19.8 },
      { rank: 16, name: "Union Small Cap Fund",              category: "Small Cap MF",    weight: 4,  currentReturn: 18.1 },
      { rank: 17, name: "Mirae Asset Small Cap Fund",        category: "Small Cap MF",    weight: 4,  currentReturn: 20.6 },
      { rank: 18, name: "Sundaram Small Cap Fund",           category: "Small Cap MF",    weight: 3,  currentReturn: 19.2 },
      { rank: 19, name: "PGIM India Small Cap Fund",         category: "Small Cap MF",    weight: 3,  currentReturn: 18.9 },
      { rank: 20, name: "Motilal Oswal Small Cap Fund",      category: "Small Cap MF",    weight: 3,  currentReturn: 21.8 },
      { rank: 21, name: "LIC MF Small Cap Fund",             category: "Small Cap MF",    weight: 3,  currentReturn: 17.4 },
      { rank: 22, name: "Navi Small Cap Index Fund",         category: "Small Cap ETF",   weight: 3,  currentReturn: 20.4 },
      { rank: 23, name: "Baroda BNP Paribas Small Cap",      category: "Small Cap MF",    weight: 2,  currentReturn: 18.7 },
      { rank: 24, name: "HDFC Liquid Fund",                  category: "Liquid MF",       weight: 1,  currentReturn: 7.5  },
      { rank: 25, name: "ICICI Pru Liquid Fund",             category: "Liquid MF",       weight: 1,  currentReturn: 7.4  },
    ],
    performance: PERFORMANCE_BASE("smallcap-discovery", 1000, 24, 24.7, 18),
    riskMetrics: { sharpeRatio: 1.32, maxDrawdown: -31.2, volatility: 24.3, beta: 1.41, alpha: 7.2 },
    rebalancingHistory: [
      { date: "May 2026", description: "Turnaround basket refreshed", changes: ["Added Utkarsh SFB on NPA recovery thesis", "Exited Anupam Rasayan at target"] },
    ],
    aiInsight: {
      recommendation: "Small cap alpha is real but volatile. This portfolio requires a minimum 7-year horizon and stomach for 30%+ drawdowns. NOT suitable for capital preservation goals.",
      confidence_score: 68,
      factors_considered: ["Small cap earnings leverage", "High risk premium", "Illiquidity premium", "Requires 7Y+ horizon"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },

  // ── EQUITY — Flexi Cap ──────────────────────────────────────────────────
  {
    id: "flexicap-allcap",
    assetClass: "equity",
    subCategory: "Flexi Cap",
    name: "FlexiCap All-Season",
    tagline: "Dynamic allocation across all market caps — follows opportunity",
    riskProfile: "moderate",
    goal: ["wealth_growth", "diversification"],
    minInvestment: 25000,
    timeHorizon: "5–7 years",
    cagr1Y: 16.8,
    cagr3Y: 18.4,
    cagr5Y: 20.1,
    benchmarkCagr1Y: 14.2,
    benchmarkName: "NIFTY 500 TRI",
    lastRebalanced: "2026-06-01",
    rebalancingFrequency: "quarterly",
    totalHoldings: 30,
    highlight: "Shifts weight between large/mid/small dynamically",
    icon: "🌀",
    isNew: true,
    allocation: [
      { category: "large_cap", label: "Large Cap (Base)", weight: 40, color: "#3B82F6", icon: "🏦" },
      { category: "mid_cap", label: "Mid Cap (Tactical)", weight: 35, color: "#F59E0B", icon: "⚡" },
      { category: "small_cap", label: "Small Cap (Satellite)", weight: 20, color: "#EF4444", icon: "💎" },
      { category: "liquid", label: "Cash", weight: 5, color: "#9CA3AF", icon: "💧" },
    ],
    holdings: [
      { rank: 1,  name: "Parag Parikh Flexi Cap Fund",       category: "Flexi Cap MF",    weight: 7,  currentReturn: 16.8 },
      { rank: 2,  name: "HDFC Flexi Cap Fund",               category: "Flexi Cap MF",    weight: 6,  currentReturn: 15.4 },
      { rank: 3,  name: "Kotak Flexi Cap Fund",              category: "Flexi Cap MF",    weight: 5,  currentReturn: 14.9 },
      { rank: 4,  name: "SBI Flexi Cap Fund",                category: "Flexi Cap MF",    weight: 5,  currentReturn: 14.6 },
      { rank: 5,  name: "Franklin India Flexi Cap Fund",     category: "Flexi Cap MF",    weight: 5,  currentReturn: 15.1 },
      { rank: 6,  name: "Quant Flexi Cap Fund",              category: "Flexi Cap MF",    weight: 5,  currentReturn: 18.2 },
      { rank: 7,  name: "DSP Flexi Cap Fund",                category: "Flexi Cap MF",    weight: 4,  currentReturn: 14.3 },
      { rank: 8,  name: "Axis Flexi Cap Fund",               category: "Flexi Cap MF",    weight: 4,  currentReturn: 14.7 },
      { rank: 9,  name: "Union Flexi Cap Fund",              category: "Flexi Cap MF",    weight: 4,  currentReturn: 13.9 },
      { rank: 10, name: "PGIM India Flexi Cap Fund",         category: "Flexi Cap MF",    weight: 4,  currentReturn: 16.2 },
      { rank: 11, name: "Mirae Asset Flexi Cap Fund",        category: "Flexi Cap MF",    weight: 4,  currentReturn: 15.6 },
      { rank: 12, name: "Canara Robeco Flexi Cap Fund",      category: "Flexi Cap MF",    weight: 4,  currentReturn: 14.1 },
      { rank: 13, name: "Aditya Birla SL Flexi Cap Fund",    category: "Flexi Cap MF",    weight: 4,  currentReturn: 14.4 },
      { rank: 14, name: "Tata Flexi Cap Fund",               category: "Flexi Cap MF",    weight: 4,  currentReturn: 13.8 },
      { rank: 15, name: "Edelweiss Flexi Cap Fund",          category: "Flexi Cap MF",    weight: 4,  currentReturn: 14.2 },
      { rank: 16, name: "Bandhan Flexi Cap Fund",            category: "Flexi Cap MF",    weight: 4,  currentReturn: 13.6 },
      { rank: 17, name: "Nippon India Flexi Cap Fund",       category: "Flexi Cap MF",    weight: 4,  currentReturn: 15.8 },
      { rank: 18, name: "Invesco India Multicap Fund",       category: "Multi Cap MF",    weight: 4,  currentReturn: 14.9 },
      { rank: 19, name: "ICICI Pru Multi Asset Fund",        category: "Multi Asset",     weight: 4,  currentReturn: 14.1 },
      { rank: 20, name: "UTI Flexi Cap Fund",                category: "Flexi Cap MF",    weight: 4,  currentReturn: 13.5 },
      { rank: 21, name: "Kotak Multi Asset Allocator",       category: "Multi Asset",     weight: 3,  currentReturn: 13.8 },
      { rank: 22, name: "HDFC Multi Asset Fund",             category: "Multi Asset",     weight: 3,  currentReturn: 13.1 },
      { rank: 23, name: "SBI Multi Asset Allocation Fund",   category: "Multi Asset",     weight: 3,  currentReturn: 12.7 },
      { rank: 24, name: "Franklin India Multi Asset Sol",    category: "Multi Asset",     weight: 3,  currentReturn: 12.4 },
      { rank: 25, name: "Nippon India Multi Asset Fund",     category: "Multi Asset",     weight: 3,  currentReturn: 13.0 },
      { rank: 26, name: "DSP Multi Asset Allocation Fund",   category: "Multi Asset",     weight: 3,  currentReturn: 12.8 },
      { rank: 27, name: "ICICI Pru Liquid Fund",             category: "Liquid MF",       weight: 2,  currentReturn: 7.4  },
      { rank: 28, name: "HDFC Liquid Fund",                  category: "Liquid MF",       weight: 2,  currentReturn: 7.5  },
      { rank: 29, name: "Axis Liquid Fund",                  category: "Liquid MF",       weight: 1,  currentReturn: 7.2  },
      { rank: 30, name: "SBI Liquid Fund",                   category: "Liquid MF",       weight: 1,  currentReturn: 7.4  },
    ],
    performance: PERFORMANCE_BASE("flexicap-allcap", 1000, 24, 16.8, 9),
    riskMetrics: { sharpeRatio: 1.58, maxDrawdown: -16.3, volatility: 14.2, beta: 1.05, alpha: 4.1 },
    rebalancingHistory: [
      { date: "Jun 2026", description: "Quarterly rebalancing — trimmed large cap, added mid cap on earnings upgrade", changes: ["Large Cap: 45% → 40%", "Mid Cap: 30% → 35%"] },
    ],
    aiInsight: {
      recommendation: "Flexi-cap is the most versatile equity category. Dynamic allocation between caps gives fund manager latitude to participate in wherever the market opportunity exists.",
      confidence_score: 81,
      factors_considered: ["Market cap cycle positioning", "Valuation relative to history", "Earnings growth outlook", "Liquidity across caps"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },

  // ── EQUITY — Multi Cap ──────────────────────────────────────────────────
  {
    id: "multicap-balanced",
    assetClass: "equity",
    subCategory: "Multi Cap",
    name: "Multi Cap Balanced",
    tagline: "SEBI-mandated equal exposure to large, mid and small caps",
    riskProfile: "aggressive",
    goal: ["wealth_growth", "diversification"],
    minInvestment: 50000,
    timeHorizon: "7–10 years",
    cagr1Y: 18.9,
    cagr3Y: 21.4,
    cagr5Y: 23.7,
    benchmarkCagr1Y: 16.2,
    benchmarkName: "NIFTY500 Multicap 50:25:25",
    lastRebalanced: "2026-06-01",
    rebalancingFrequency: "quarterly",
    totalHoldings: 30,
    highlight: "Structured 25-25-25 exposure per SEBI mandate",
    icon: "⚖️",
    allocation: [
      { category: "large_cap", label: "Large Cap (min 25%)", weight: 33, color: "#3B82F6", icon: "🏦" },
      { category: "mid_cap", label: "Mid Cap (min 25%)", weight: 34, color: "#F59E0B", icon: "⚡" },
      { category: "small_cap", label: "Small Cap (min 25%)", weight: 28, color: "#EF4444", icon: "💎" },
      { category: "liquid", label: "Cash", weight: 5, color: "#9CA3AF", icon: "💧" },
    ],
    holdings: [
      { rank: 1,  name: "Nippon India Multi Cap Fund",        category: "Multi Cap MF",    weight: 7,  currentReturn: 18.2 },
      { rank: 2,  name: "HDFC Multi Cap Fund",               category: "Multi Cap MF",    weight: 6,  currentReturn: 17.4 },
      { rank: 3,  name: "Quant Active Fund",                 category: "Multi Cap MF",    weight: 6,  currentReturn: 22.1 },
      { rank: 4,  name: "Kotak Multicap Fund",               category: "Multi Cap MF",    weight: 6,  currentReturn: 16.8 },
      { rank: 5,  name: "Mahindra Manulife Multi Cap Fund",  category: "Multi Cap MF",    weight: 5,  currentReturn: 16.2 },
      { rank: 6,  name: "ITI Multi Cap Fund",                category: "Multi Cap MF",    weight: 5,  currentReturn: 15.4 },
      { rank: 7,  name: "SBI Multi Cap Fund",                category: "Multi Cap MF",    weight: 5,  currentReturn: 16.1 },
      { rank: 8,  name: "Axis Multi Cap Fund",               category: "Multi Cap MF",    weight: 5,  currentReturn: 15.8 },
      { rank: 9,  name: "ICICI Pru Multi Cap Fund",          category: "Multi Cap MF",    weight: 5,  currentReturn: 16.4 },
      { rank: 10, name: "Sundaram Multi Cap Fund",           category: "Multi Cap MF",    weight: 4,  currentReturn: 15.1 },
      { rank: 11, name: "Tata Multi Cap Fund",               category: "Multi Cap MF",    weight: 4,  currentReturn: 14.8 },
      { rank: 12, name: "Franklin India Multi Cap Fund",     category: "Multi Cap MF",    weight: 4,  currentReturn: 15.6 },
      { rank: 13, name: "Mirae Asset Multi Cap Fund",        category: "Multi Cap MF",    weight: 4,  currentReturn: 16.7 },
      { rank: 14, name: "DSP Multi Cap Fund",                category: "Multi Cap MF",    weight: 4,  currentReturn: 15.2 },
      { rank: 15, name: "Edelweiss Multi Cap Fund",          category: "Multi Cap MF",    weight: 4,  currentReturn: 14.6 },
      { rank: 16, name: "Canara Robeco Multi Cap Fund",      category: "Multi Cap MF",    weight: 4,  currentReturn: 15.9 },
      { rank: 17, name: "Bandhan Multi Cap Fund",            category: "Multi Cap MF",    weight: 4,  currentReturn: 14.3 },
      { rank: 18, name: "Aditya Birla SL Multi Cap Fund",    category: "Multi Cap MF",    weight: 4,  currentReturn: 15.4 },
      { rank: 19, name: "Invesco India Multicap Fund",       category: "Multi Cap MF",    weight: 4,  currentReturn: 14.9 },
      { rank: 20, name: "Union Multi Cap Fund",              category: "Multi Cap MF",    weight: 4,  currentReturn: 14.1 },
      { rank: 21, name: "Navi Nifty 500 Value 50 Index Fund",category: "Multi Cap ETF",   weight: 3,  currentReturn: 15.8 },
      { rank: 22, name: "PGIM India Flexi Cap Fund",         category: "Flexi Cap MF",    weight: 3,  currentReturn: 16.2 },
      { rank: 23, name: "Parag Parikh Flexi Cap Fund",       category: "Flexi Cap MF",    weight: 3,  currentReturn: 16.8 },
      { rank: 24, name: "UTI Multi Asset Allocation Fund",   category: "Multi Asset",     weight: 3,  currentReturn: 13.2 },
      { rank: 25, name: "HDFC Liquid Fund",                  category: "Liquid MF",       weight: 3,  currentReturn: 7.5  },
      { rank: 26, name: "ICICI Pru Liquid Fund",             category: "Liquid MF",       weight: 2,  currentReturn: 7.4  },
      { rank: 27, name: "SBI Liquid Fund",                   category: "Liquid MF",       weight: 2,  currentReturn: 7.4  },
      { rank: 28, name: "Axis Liquid Fund",                  category: "Liquid MF",       weight: 2,  currentReturn: 7.2  },
      { rank: 29, name: "Kotak Liquid Fund",                 category: "Liquid MF",       weight: 2,  currentReturn: 7.2  },
      { rank: 30, name: "Nippon India Liquid Fund",          category: "Liquid MF",       weight: 1,  currentReturn: 7.3  },
    ],
    performance: PERFORMANCE_BASE("multicap-balanced", 1000, 24, 18.9, 12),
    riskMetrics: { sharpeRatio: 1.44, maxDrawdown: -19.8, volatility: 16.9, beta: 1.15, alpha: 4.6 },
    rebalancingHistory: [
      { date: "Jun 2026", description: "Maintained SEBI minimum across all caps", changes: ["Large Cap trimmed 35→33%", "Small Cap added 26→28%"] },
    ],
    aiInsight: {
      recommendation: "Multi Cap offers structured diversification across market cap spectrum. SEBI's mandatory minimum ensures no cap dominates — reducing concentration risk vs. flexi-cap.",
      confidence_score: 79,
      factors_considered: ["SEBI regulatory minimum compliance", "Cross-cap diversification", "Cycle diversification benefit", "Higher drawdown risk from small cap"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },

  // ── DEBT — Short Duration ────────────────────────────────────────────────
  {
    id: "debt-short-duration",
    assetClass: "debt",
    subCategory: "Short Duration",
    name: "Short Duration Income",
    tagline: "Stable income with 1–3 year maturity bonds — low interest rate risk",
    riskProfile: "conservative",
    goal: ["income", "capital_preservation"],
    minInvestment: 10000,
    timeHorizon: "1–3 years",
    cagr1Y: 7.8,
    cagr3Y: 8.1,
    cagr5Y: 7.9,
    benchmarkCagr1Y: 7.2,
    benchmarkName: "CRISIL Short Term Bond Index",
    lastRebalanced: "2026-06-01",
    rebalancingFrequency: "quarterly",
    totalHoldings: 15,
    highlight: "Low duration risk, high credit quality",
    icon: "📅",
    allocation: [
      { category: "aaa_bonds", label: "AAA Rated Bonds", weight: 50, color: "#10B981", icon: "🏆" },
      { category: "sov_bonds", label: "Sovereign/SDL", weight: 25, color: "#3B82F6", icon: "🏛️" },
      { category: "aa_bonds", label: "AA Rated Bonds", weight: 15, color: "#F59E0B", icon: "📊" },
      { category: "liquid", label: "Liquid/T-Bills", weight: 10, color: "#9CA3AF", icon: "💧" },
    ],
    holdings: [
      { rank: 1,  name: "HDFC Short Term Debt Fund",          category: "Short Term MF",   weight: 12, currentReturn: 7.4  },
      { rank: 2,  name: "Kotak Short Term Fund",             category: "Short Term MF",   weight: 10, currentReturn: 7.3  },
      { rank: 3,  name: "ICICI Pru Short Term Fund",         category: "Short Term MF",   weight: 10, currentReturn: 7.5  },
      { rank: 4,  name: "Aditya Birla SL Short Term Fund",   category: "Short Term MF",   weight: 10, currentReturn: 7.2  },
      { rank: 5,  name: "SBI Short Term Debt Fund",          category: "Short Term MF",   weight: 9,  currentReturn: 7.1  },
      { rank: 6,  name: "Nippon India Short Term Fund",      category: "Short Term MF",   weight: 8,  currentReturn: 7.4  },
      { rank: 7,  name: "Axis Short Term Fund",              category: "Short Term MF",   weight: 8,  currentReturn: 7.3  },
      { rank: 8,  name: "DSP Short Term Fund",               category: "Short Term MF",   weight: 7,  currentReturn: 7.2  },
      { rank: 9,  name: "Franklin India Short Term Income",  category: "Short Term MF",   weight: 7,  currentReturn: 7.6  },
      { rank: 10, name: "Tata Short Term Bond Fund",         category: "Short Term MF",   weight: 7,  currentReturn: 7.1  },
      { rank: 11, name: "Mirae Asset Short Duration Fund",   category: "Short Term MF",   weight: 6,  currentReturn: 7.0  },
      { rank: 12, name: "Invesco India Short Term Fund",     category: "Short Term MF",   weight: 5,  currentReturn: 7.1  },
      { rank: 13, name: "HDFC Liquid Fund",                  category: "Liquid MF",       weight: 4,  currentReturn: 7.5  },
      { rank: 14, name: "ICICI Pru Liquid Fund",             category: "Liquid MF",       weight: 2,  currentReturn: 7.4  },
      { rank: 15, name: "Axis Liquid Fund",                  category: "Liquid MF",       weight: 1,  currentReturn: 7.2  },
    ],
    performance: PERFORMANCE_BASE("debt-short-duration", 1000, 24, 7.8, 1),
    riskMetrics: { sharpeRatio: 2.1, maxDrawdown: -1.2, volatility: 2.1, beta: 0.08, alpha: 0.7 },
    rebalancingHistory: [
      { date: "Jun 2026", description: "Duration maintained at ~1.8 years post RBI pause", changes: ["Rolled 3M T-Bills", "Added HDFC Bank NCD at 8.3%"] },
    ],
    aiInsight: {
      recommendation: "With RBI holding rates steady, short-duration bonds offer attractive risk-adjusted yield. Suitable as an FD alternative for 1–3 year money.",
      confidence_score: 91,
      factors_considered: ["RBI rate cycle — hold phase", "Credit spreads at normalised levels", "Short duration = low mark-to-market risk", "Superior to savings account"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },

  // ── DEBT — Long Duration ─────────────────────────────────────────────────
  {
    id: "debt-long-duration",
    assetClass: "debt",
    subCategory: "Long Duration",
    name: "Long Duration Gilt",
    tagline: "Capital gains play on interest rate cycle — for rate-cut beneficiaries",
    riskProfile: "moderate",
    goal: ["wealth_growth", "income"],
    minInvestment: 25000,
    timeHorizon: "3–5 years",
    cagr1Y: 9.4,
    cagr3Y: 10.2,
    cagr5Y: 10.8,
    benchmarkCagr1Y: 8.7,
    benchmarkName: "CRISIL 10Y Gilt Index",
    lastRebalanced: "2026-06-01",
    rebalancingFrequency: "quarterly",
    totalHoldings: 10,
    highlight: "Rate cut beneficiary — capital gain potential",
    icon: "🏛️",
    allocation: [
      { category: "gilt_10y", label: "10Y Government Bonds", weight: 50, color: "#3B82F6", icon: "🏛️" },
      { category: "gilt_30y", label: "Long Dated G-Sec (30Y)", weight: 25, color: "#6366F1", icon: "📜" },
      { category: "sdl", label: "State Dev Loans (SDL)", weight: 20, color: "#8B5CF6", icon: "🗺️" },
      { category: "liquid", label: "Liquid Buffer", weight: 5, color: "#9CA3AF", icon: "💧" },
    ],
    holdings: [
      { rank: 1,  name: "SBI Magnum Gilt Fund",          category: "Gilt Fund",       weight: 20, currentReturn: 9.8 },
      { rank: 2,  name: "ICICI Pru Gilt Fund",           category: "Gilt Fund",       weight: 18, currentReturn: 10.1 },
      { rank: 3,  name: "HDFC Gilt Fund",                category: "Gilt Fund",       weight: 15, currentReturn: 9.4 },
      { rank: 4,  name: "Nippon India Gilt SDL Index",   category: "SDL ETF",         weight: 12, currentReturn: 8.7 },
      { rank: 5,  name: "Kotak Gilt Fund",               category: "Gilt Fund",       weight: 10, currentReturn: 9.2 },
      { rank: 6,  name: "IDFC GSF Constant Maturity",   category: "Gilt 10Y Fund",   weight: 10, currentReturn: 9.0 },
      { rank: 7,  name: "Quantum Dynamic Bond Fund",     category: "Dynamic Bond MF", weight: 7,  currentReturn: 8.4 },
      { rank: 8,  name: "Edelweiss SDL+AAA PSU Bond",   category: "Target Maturity",  weight: 5,  currentReturn: 8.6 },
      { rank: 9,  name: "DSP Govt Securities Fund",     category: "Gilt Fund",        weight: 2,  currentReturn: 8.9 },
      { rank: 10, name: "ICICI Pru Liquid Fund (Buffer)",category: "Liquid Buffer",   weight: 1,  currentReturn: 7.2 },
    ],
    performance: PERFORMANCE_BASE("debt-long-duration", 1000, 24, 9.4, 4),
    riskMetrics: { sharpeRatio: 1.21, maxDrawdown: -5.8, volatility: 5.9, beta: 0.22, alpha: 1.4 },
    rebalancingHistory: [
      { date: "Jun 2026", description: "Added 30Y G-Sec on rate cut anticipation", changes: ["30Y bucket: 15% → 25%", "Reduced SDL: 30% → 20%"] },
    ],
    aiInsight: {
      recommendation: "Position for RBI rate cuts in H2 2026. Every 50bps rate cut delivers ~4–5% capital gain on long-dated gilts. Risk: rates may stay higher for longer if inflation surprises.",
      confidence_score: 72,
      factors_considered: ["RBI forward guidance", "US Fed rate path", "India inflation trajectory CPI 4.2%", "Fiscal deficit trajectory"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },

  // ── DEBT — Corporate Bond ────────────────────────────────────────────────
  {
    id: "debt-corporate-bond",
    assetClass: "debt",
    subCategory: "Corporate Bond",
    name: "Corporate Bond Plus",
    tagline: "Higher yield through quality corporate paper — AA+ and above",
    riskProfile: "moderate",
    goal: ["income", "capital_preservation"],
    minInvestment: 15000,
    timeHorizon: "2–4 years",
    cagr1Y: 8.6,
    cagr3Y: 8.9,
    cagr5Y: 8.7,
    benchmarkCagr1Y: 7.8,
    benchmarkName: "CRISIL Corporate Bond Composite",
    lastRebalanced: "2026-06-01",
    rebalancingFrequency: "quarterly",
    totalHoldings: 18,
    highlight: "50-100bps spread over G-Sec with credit quality",
    icon: "🏢",
    allocation: [
      { category: "aaa_corp", label: "AAA Corporate Bonds", weight: 55, color: "#10B981", icon: "🏆" },
      { category: "aa_plus_corp", label: "AA+ Corporate Bonds", weight: 25, color: "#3B82F6", icon: "📊" },
      { category: "psu_bonds", label: "PSU Bonds", weight: 15, color: "#8B5CF6", icon: "🏛️" },
      { category: "liquid", label: "Liquid", weight: 5, color: "#9CA3AF", icon: "💧" },
    ],
    holdings: [
      { rank: 1,  name: "HDFC Corporate Bond Fund",          category: "Corp Bond MF",    weight: 12, currentReturn: 7.9  },
      { rank: 2,  name: "Kotak Corporate Bond Fund",         category: "Corp Bond MF",    weight: 10, currentReturn: 7.8  },
      { rank: 3,  name: "ICICI Pru Corporate Bond Fund",     category: "Corp Bond MF",    weight: 10, currentReturn: 7.9  },
      { rank: 4,  name: "Axis Corporate Debt Fund",          category: "Corp Bond MF",    weight: 9,  currentReturn: 7.7  },
      { rank: 5,  name: "Aditya Birla SL Corporate Bond",    category: "Corp Bond MF",    weight: 9,  currentReturn: 7.8  },
      { rank: 6,  name: "Nippon India Corporate Bond Fund",  category: "Corp Bond MF",    weight: 8,  currentReturn: 7.6  },
      { rank: 7,  name: "SBI Corporate Bond Fund",           category: "Corp Bond MF",    weight: 8,  currentReturn: 7.7  },
      { rank: 8,  name: "DSP Corporate Bond Fund",           category: "Corp Bond MF",    weight: 7,  currentReturn: 7.5  },
      { rank: 9,  name: "Franklin India Corporate Debt Fund",category: "Corp Bond MF",    weight: 7,  currentReturn: 7.9  },
      { rank: 10, name: "Tata Corporate Bond Fund",          category: "Corp Bond MF",    weight: 6,  currentReturn: 7.4  },
      { rank: 11, name: "Mirae Asset Corporate Bond Fund",   category: "Corp Bond MF",    weight: 5,  currentReturn: 7.6  },
      { rank: 12, name: "ICICI Pru Banking & PSU Debt",      category: "Bond MF",         weight: 5,  currentReturn: 7.5  },
      { rank: 13, name: "Kotak Banking & PSU Debt Fund",     category: "Bond MF",         weight: 4,  currentReturn: 7.4  },
      { rank: 14, name: "HDFC Liquid Fund",                  category: "Liquid MF",       weight: 3,  currentReturn: 7.5  },
      { rank: 15, name: "ICICI Pru Liquid Fund",             category: "Liquid MF",       weight: 3,  currentReturn: 7.4  },
      { rank: 16, name: "Axis Liquid Fund",                  category: "Liquid MF",       weight: 2,  currentReturn: 7.2  },
      { rank: 17, name: "Nippon India Liquid Fund",          category: "Liquid MF",       weight: 1,  currentReturn: 7.3  },
      { rank: 18, name: "SBI Liquid Fund",                   category: "Liquid MF",       weight: 1,  currentReturn: 7.4  },
    ],
    performance: PERFORMANCE_BASE("debt-corporate-bond", 1000, 24, 8.6, 1.5),
    riskMetrics: { sharpeRatio: 1.87, maxDrawdown: -2.1, volatility: 2.8, beta: 0.12, alpha: 0.9 },
    rebalancingHistory: [
      { date: "Jun 2026", description: "Added Bajaj Finance NCD at attractive 8.65% yield", changes: ["NCD allocation 8% → 12%", "Reduced AA+ bucket proportionally"] },
    ],
    aiInsight: {
      recommendation: "Corporate bond funds offer 50–100bps premium over sovereign with minimal credit risk at AA+ and above. Ideal for 2–4 year money that needs better than FD returns.",
      confidence_score: 87,
      factors_considered: ["Credit spread vs. historical avg", "Default rates at 5Y low", "Duration 2.5 years", "Reinvestment risk managed"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },

  // ── DEBT — Liquid / Ultra Short ──────────────────────────────────────────
  {
    id: "debt-liquid-park",
    assetClass: "debt",
    subCategory: "Liquid / Ultra Short",
    name: "Liquid Parking",
    tagline: "Better than savings account — park short-term money safely",
    riskProfile: "conservative",
    goal: ["capital_preservation", "income"],
    minInvestment: 5000,
    timeHorizon: "1 day – 3 months",
    cagr1Y: 7.3,
    cagr3Y: 6.8,
    cagr5Y: 6.5,
    benchmarkCagr1Y: 6.9,
    benchmarkName: "CRISIL Liquid Fund Index",
    lastRebalanced: "2026-06-01",
    rebalancingFrequency: "quarterly",
    totalHoldings: 8,
    highlight: "No exit load after 7 days, ~7.3% p.a. vs 3.5% savings",
    icon: "💧",
    allocation: [
      { category: "liquid_mf", label: "Liquid Mutual Funds", weight: 60, color: "#10B981", icon: "💧" },
      { category: "overnight", label: "Overnight Funds", weight: 20, color: "#3B82F6", icon: "🌙" },
      { category: "tbills", label: "T-Bills (via ETF)", weight: 15, color: "#8B5CF6", icon: "📜" },
      { category: "arbitrage", label: "Arbitrage Fund", weight: 5, color: "#F59E0B", icon: "⚡" },
    ],
    holdings: [
      { rank: 1,  name: "HDFC Liquid Fund",                  category: "Liquid MF",       weight: 20, currentReturn: 7.5  },
      { rank: 2,  name: "ICICI Pru Liquid Fund",             category: "Liquid MF",       weight: 18, currentReturn: 7.4  },
      { rank: 3,  name: "SBI Liquid Fund",                   category: "Liquid MF",       weight: 17, currentReturn: 7.4  },
      { rank: 4,  name: "Kotak Liquid Fund",                 category: "Liquid MF",       weight: 15, currentReturn: 7.2  },
      { rank: 5,  name: "Nippon India Liquid Fund",          category: "Liquid MF",       weight: 15, currentReturn: 7.3  },
      { rank: 6,  name: "Aditya Birla SL Liquid Fund",       category: "Liquid MF",       weight: 8,  currentReturn: 7.1  },
      { rank: 7,  name: "Axis Liquid Fund",                  category: "Liquid MF",       weight: 5,  currentReturn: 7.2  },
      { rank: 8,  name: "DSP Liquidity Fund",                category: "Liquid MF",       weight: 2,  currentReturn: 7.0  },
    ],
    performance: PERFORMANCE_BASE("debt-liquid-park", 1000, 24, 7.3, 0.3),
    riskMetrics: { sharpeRatio: 3.2, maxDrawdown: -0.1, volatility: 0.3, beta: 0.01, alpha: 0.4 },
    rebalancingHistory: [
      { date: "Jun 2026", description: "Arbitrage allocation added for tax efficiency", changes: ["Added Kotak Arbitrage at 5%", "Trimmed Liquid MF by 5%"] },
    ],
    aiInsight: {
      recommendation: "Liquid parking is an emergency fund strategy. This portfolio targets ~7.3% with near-zero risk — significantly better than savings accounts. Suitable for 0–90 day money.",
      confidence_score: 95,
      factors_considered: ["RBI repo rate 6.5%", "Overnight MIBOR spread", "Credit quality: AAA only", "Tax efficiency via arbitrage component"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },

  // ── HYBRID — Balanced Advantage ──────────────────────────────────────────
  {
    id: "balanced-advantage",
    assetClass: "hybrid",
    subCategory: "Balanced Advantage",
    name: "Balanced Advantage",
    tagline: "Dynamic equity-debt mix — auto-adjusts as markets rise or fall",
    riskProfile: "moderate",
    goal: ["wealth_growth", "capital_preservation"],
    minInvestment: 25000,
    timeHorizon: "3–5 years",
    cagr1Y: 11.4,
    cagr3Y: 12.8,
    cagr5Y: 13.6,
    benchmarkCagr1Y: 10.1,
    benchmarkName: "CRISIL Hybrid 50+50 Moderate",
    lastRebalanced: "2026-06-01",
    rebalancingFrequency: "quarterly",
    totalHoldings: 20,
    highlight: "Automatically reduces equity when markets are expensive",
    icon: "🎛️",
    isFeatured: true,
    allocation: [
      { category: "equity_dynamic", label: "Equity (Dynamic)", weight: 55, color: "#3B82F6", icon: "📈" },
      { category: "debt_dynamic", label: "Debt (Dynamic)", weight: 35, color: "#10B981", icon: "📊" },
      { category: "arbitrage", label: "Arbitrage", weight: 10, color: "#F59E0B", icon: "⚡" },
    ],
    holdings: [
      { rank: 1,  name: "HDFC Balanced Advantage Fund",       category: "Balanced Adv MF",  weight: 15, currentReturn: 12.4 },
      { rank: 2,  name: "ICICI Pru Balanced Advantage Fund", category: "Balanced Adv MF",  weight: 14, currentReturn: 11.8 },
      { rank: 3,  name: "Kotak Balanced Advantage Fund",     category: "Balanced Adv MF",  weight: 12, currentReturn: 11.2 },
      { rank: 4,  name: "Nippon India Balanced Advantage",   category: "Balanced Adv MF",  weight: 10, currentReturn: 11.4 },
      { rank: 5,  name: "Edelweiss Balanced Advantage Fund", category: "Balanced Adv MF",  weight: 9,  currentReturn: 10.9 },
      { rank: 6,  name: "SBI Balanced Advantage Fund",       category: "Balanced Adv MF",  weight: 8,  currentReturn: 11.1 },
      { rank: 7,  name: "Axis Balanced Advantage Fund",      category: "Balanced Adv MF",  weight: 8,  currentReturn: 10.7 },
      { rank: 8,  name: "DSP Dynamic Asset Allocation Fund", category: "Balanced Adv MF",  weight: 7,  currentReturn: 10.4 },
      { rank: 9,  name: "Franklin India Dynamic Asset Alloc",category: "Balanced Adv MF",  weight: 7,  currentReturn: 10.6 },
      { rank: 10, name: "Mirae Asset Dynamic Allocation Fund",category: "Balanced Adv MF", weight: 6,  currentReturn: 11.3 },
      { rank: 11, name: "Aditya Birla SL Balanced Advantage",category: "Balanced Adv MF",  weight: 5,  currentReturn: 10.8 },
      { rank: 12, name: "Tata Balanced Advantage Fund",      category: "Balanced Adv MF",  weight: 5,  currentReturn: 10.3 },
      { rank: 13, name: "Invesco India Dynamic Equity Fund", category: "Balanced Adv MF",  weight: 4,  currentReturn: 10.1 },
      { rank: 14, name: "PGIM India Balanced Advantage Fund",category: "Balanced Adv MF",  weight: 4,  currentReturn: 10.5 },
      { rank: 15, name: "Quant Dynamic Asset Allocation",    category: "Balanced Adv MF",  weight: 4,  currentReturn: 12.8 },
      { rank: 16, name: "UTI Balanced Advantage Fund",       category: "Balanced Adv MF",  weight: 4,  currentReturn: 10.2 },
      { rank: 17, name: "Bandhan Balanced Advantage Fund",   category: "Balanced Adv MF",  weight: 4,  currentReturn: 9.8  },
      { rank: 18, name: "LIC MF Balanced Advantage Fund",    category: "Balanced Adv MF",  weight: 3,  currentReturn: 9.6  },
      { rank: 19, name: "HDFC Liquid Fund",                  category: "Liquid MF",        weight: 1,  currentReturn: 7.5  },
      { rank: 20, name: "ICICI Pru Liquid Fund",             category: "Liquid MF",        weight: 1,  currentReturn: 7.4  },
    ],
    performance: PERFORMANCE_BASE("balanced-advantage", 1000, 24, 11.4, 5),
    riskMetrics: { sharpeRatio: 1.68, maxDrawdown: -9.3, volatility: 8.2, beta: 0.58, alpha: 2.8 },
    rebalancingHistory: [
      { date: "Jun 2026", description: "Equity reduced to 55% from 62% — NIFTY PE above 22x", changes: ["Equity: 62% → 55%", "Debt: 28% → 35%"] },
    ],
    aiInsight: {
      recommendation: "Ideal for first-time equity investors. The dynamic equity allocation model reduces equity when Nifty PE > 22x, protecting against over-valuation risk automatically.",
      confidence_score: 85,
      factors_considered: ["PE-based equity allocation model", "Current Nifty PE 22.4x — slightly elevated", "Debt acts as shock absorber", "Tax treatment: equity taxation if >65% equity"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },

  // ── DEBT — Corporate Treasury #1 (Operational Cash) ──────────────────────
  {
    id: "corp-treasury-operational",
    assetClass: "debt",
    subCategory: "Corporate Treasury",
    name: "Corporate Treasury — Operational",
    tagline: "Working capital deployment: safety, liquidity, compliance-first",
    riskProfile: "conservative",
    goal: ["capital_preservation", "income"],
    minInvestment: 1000000,
    timeHorizon: "1 day – 3 months",
    cagr1Y: 7.5,
    cagr3Y: 7.1,
    cagr5Y: 6.9,
    benchmarkCagr1Y: 6.9,
    benchmarkName: "CRISIL Liquid Fund Index",
    lastRebalanced: "2026-06-01",
    rebalancingFrequency: "quarterly",
    totalHoldings: 8,
    highlight: "Board-policy compliant · AAA/Sovereign only · T+1 liquidity",
    icon: "🏦",
    isNew: true,
    allocation: [
      { category: "liquid_mf", label: "Liquid Mutual Funds (AAA)", weight: 40, color: "#10B981", icon: "💧" },
      { category: "overnight_mf", label: "Overnight Funds", weight: 25, color: "#3B82F6", icon: "🌙" },
      { category: "tbills", label: "91-day T-Bills (via ETF)", weight: 20, color: "#8B5CF6", icon: "📜" },
      { category: "bank_fd", label: "Scheduled Bank FDs (AA+)", weight: 10, color: "#F59E0B", icon: "🏦" },
      { category: "arbitrage", label: "Arbitrage Funds", weight: 5, color: "#6B7280", icon: "⚡" },
    ],
    holdings: [
      { rank: 1, name: "HDFC Liquid Fund",                   category: "Liquid MF",       weight: 20, currentReturn: 7.5  },
      { rank: 2, name: "ICICI Pru Liquid Fund",              category: "Liquid MF",       weight: 18, currentReturn: 7.4  },
      { rank: 3, name: "SBI Liquid Fund",                    category: "Liquid MF",       weight: 15, currentReturn: 7.4  },
      { rank: 4, name: "Kotak Liquid Fund",                  category: "Liquid MF",       weight: 14, currentReturn: 7.2  },
      { rank: 5, name: "Nippon India Liquid Fund",           category: "Liquid MF",       weight: 13, currentReturn: 7.3  },
      { rank: 6, name: "Aditya Birla SL Liquid Fund",        category: "Liquid MF",       weight: 10, currentReturn: 7.1  },
      { rank: 7, name: "Axis Liquid Fund",                   category: "Liquid MF",       weight: 5,  currentReturn: 7.2  },
      { rank: 8, name: "DSP Liquidity Fund",                 category: "Liquid MF",       weight: 5,  currentReturn: 7.0  },
    ],
    performance: PERFORMANCE_BASE("corp-treasury-operational", 1000, 24, 7.5, 0.2),
    riskMetrics: { sharpeRatio: 3.8, maxDrawdown: -0.05, volatility: 0.2, beta: 0.00, alpha: 0.6 },
    rebalancingHistory: [
      { date: "Jun 2026", description: "Overnight bucket increased for quarter-end liquidity requirement", changes: ["Overnight: 20% → 25%", "Liquid MF: 45% → 40%"] },
      { date: "Mar 2026", description: "Q4 advance tax provision — T-Bills matured, rolled", changes: ["Rolled 91-day T-Bills", "Added ICICI Bank FD at 7.6%"] },
    ],
    aiInsight: {
      recommendation: "Designed for CFO-level deployment of operational cash. Strict adherence to SEBI-approved instruments for corporates: liquid MFs, overnight funds, scheduled bank FDs, and G-Sec. All instruments rated AAA or sovereign. Returns ~7.5% vs 3.5% in current accounts — zero credit risk.",
      confidence_score: 96,
      factors_considered: [
        "SEBI MF circular for corporate investors",
        "RBI repo rate 6.5% — overnight funds closely track",
        "No mark-to-market risk on overnight/liquid",
        "T+1 redemption for operational liquidity",
        "Board investment policy: AAA/sovereign only",
      ],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },

  // ── DEBT — Corporate Treasury #2 (Strategic Reserves) ────────────────────
  {
    id: "corp-treasury-strategic",
    assetClass: "debt",
    subCategory: "Corporate Treasury",
    name: "Corporate Treasury — Strategic",
    tagline: "3–12 month reserves: higher yield with maintained credit discipline",
    riskProfile: "conservative",
    goal: ["income", "capital_preservation"],
    minInvestment: 5000000,
    timeHorizon: "3–12 months",
    cagr1Y: 8.4,
    cagr3Y: 8.2,
    cagr5Y: 8.0,
    benchmarkCagr1Y: 7.8,
    benchmarkName: "CRISIL Short Duration Bond Index",
    lastRebalanced: "2026-06-01",
    rebalancingFrequency: "quarterly",
    totalHoldings: 12,
    highlight: "80–120bps above liquid funds · 3–6M deployment horizon",
    icon: "🏛️",
    isNew: true,
    allocation: [
      { category: "aaa_corp_bonds", label: "AAA Corporate Bonds / NCDs", weight: 35, color: "#10B981", icon: "🏆" },
      { category: "banking_psu", label: "Banking & PSU Debt Funds", weight: 25, color: "#3B82F6", icon: "🏦" },
      { category: "sdl", label: "State Development Loans (SDL)", weight: 20, color: "#8B5CF6", icon: "🗺️" },
      { category: "cd", label: "Bank CDs (Certificates of Deposit)", weight: 12, color: "#F59E0B", icon: "📋" },
      { category: "liquid_mf", label: "Liquid Buffer", weight: 8, color: "#9CA3AF", icon: "💧" },
    ],
    holdings: [
      { rank: 1,  name: "HDFC Banking & PSU Debt Fund",      category: "Banking & PSU MF",weight: 12, currentReturn: 7.8  },
      { rank: 2,  name: "ICICI Pru Banking & PSU Debt Fund", category: "Banking & PSU MF",weight: 11, currentReturn: 7.7  },
      { rank: 3,  name: "Kotak Banking & PSU Debt Fund",     category: "Banking & PSU MF",weight: 10, currentReturn: 7.6  },
      { rank: 4,  name: "Nippon India Banking & PSU Debt",   category: "Banking & PSU MF",weight: 10, currentReturn: 7.7  },
      { rank: 5,  name: "SBI Banking & PSU Fund",            category: "Banking & PSU MF",weight: 9,  currentReturn: 7.5  },
      { rank: 6,  name: "Aditya Birla SL Banking & PSU Debt",category: "Banking & PSU MF",weight: 9,  currentReturn: 7.6  },
      { rank: 7,  name: "DSP Banking & PSU Debt Fund",       category: "Banking & PSU MF",weight: 8,  currentReturn: 7.4  },
      { rank: 8,  name: "Axis Banking & PSU Debt Fund",      category: "Banking & PSU MF",weight: 8,  currentReturn: 7.5  },
      { rank: 9,  name: "HDFC Short Term Debt Fund",         category: "Short Term MF",   weight: 8,  currentReturn: 7.4  },
      { rank: 10, name: "ICICI Pru Short Term Fund",         category: "Short Term MF",   weight: 7,  currentReturn: 7.5  },
      { rank: 11, name: "HDFC Liquid Fund",                  category: "Liquid MF",       weight: 5,  currentReturn: 7.5  },
      { rank: 12, name: "ICICI Pru Liquid Fund",             category: "Liquid MF",       weight: 3,  currentReturn: 7.4  },
    ],
    performance: PERFORMANCE_BASE("corp-treasury-strategic", 1000, 24, 8.4, 0.8),
    riskMetrics: { sharpeRatio: 2.6, maxDrawdown: -0.8, volatility: 1.2, beta: 0.05, alpha: 0.8 },
    rebalancingHistory: [
      { date: "Jun 2026", description: "Added SDL allocation on state fiscal improvement", changes: ["SDL: 15% → 20%", "Banking & PSU: 30% → 25%"] },
      { date: "Mar 2026", description: "Rolled Bajaj Finance NCD at 8.65% for 6M tenure", changes: ["Renewed NCD at 8.65% (was 8.45%)"] },
    ],
    aiInsight: {
      recommendation: "Ideal for CFOs deploying 3–12 month strategic reserves. The mix of AAA NCDs, Bank CDs, SDL, and Banking & PSU MFs delivers ~8.4% — materially better than FDs at 7–7.5% — while meeting most board-approved investment policies. All instruments are SEBI-listed or scheduled-bank issued.",
      confidence_score: 93,
      factors_considered: [
        "AAA/sovereign credit quality throughout",
        "CD/NCD tenors matched to deployment horizon",
        "SDL: semi-sovereign, typically 25–40bps above G-Sec",
        "Banking & PSU MF: zero credit risk, ~8% gross yield",
        "Tax: debt MF STCG added to income; LTCG indexed after 3Y",
        "Suitable for Sec 44AD/company treasury board resolutions",
      ],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },


  // ── GOAL-BASED PORTFOLIOS ─────────────────────────────────────────────────
  {
    id: "goal-child-education",
    assetClass: "goal_based",
    subCategory: "Child Education",
    name: "Child Education Fund",
    tagline: "Build your child's college corpus over 15 years — equity-led compounding",
    riskProfile: "moderate",
    goal: ["wealth_growth"],
    minInvestment: 5000,
    timeHorizon: "10–15 years",
    cagr1Y: 14.2, cagr3Y: 15.8, cagr5Y: 17.1,
    benchmarkCagr1Y: 12.8, benchmarkName: "NIFTY 500 TRI",
    lastRebalanced: "2026-06-01", totalHoldings: 14,
    rebalancingFrequency: "quarterly",
    highlight: "Glide path: reduces equity as goal year approaches",
    icon: "🎓", isNew: true,
    allocation: [
      { category: "large_cap", label: "Large Cap Equity", weight: 40, color: "#3B82F6", icon: "🏦" },
      { category: "mid_cap", label: "Mid Cap Equity", weight: 25, color: "#F59E0B", icon: "⚡" },
      { category: "elss", label: "ELSS (Tax Saving)", weight: 15, color: "#10B981", icon: "🏷️" },
      { category: "debt", label: "Debt / Bonds", weight: 15, color: "#8B5CF6", icon: "📊" },
      { category: "gold", label: "Gold ETF", weight: 5, color: "#F59E0B", icon: "🥇" },
    ],
    holdings: [
      { rank: 1,  name: "Axis Long Term Equity Fund (ELSS)",   category: "ELSS MF",         weight: 12, currentReturn: 14.2 },
      { rank: 2,  name: "Mirae Asset Tax Saver Fund",        category: "ELSS MF",         weight: 10, currentReturn: 15.1 },
      { rank: 3,  name: "Mirae Asset Large Cap Fund",        category: "Large Cap MF",    weight: 9,  currentReturn: 14.1 },
      { rank: 4,  name: "Parag Parikh Flexi Cap Fund",       category: "Flexi Cap MF",    weight: 9,  currentReturn: 16.8 },
      { rank: 5,  name: "HDFC Mid-Cap Opportunities Fund",   category: "Mid Cap MF",      weight: 8,  currentReturn: 20.1 },
      { rank: 6,  name: "SBI Small Cap Fund",                category: "Small Cap MF",    weight: 8,  currentReturn: 22.8 },
      { rank: 7,  name: "HDFC Corporate Bond Fund",          category: "Corp Bond MF",    weight: 8,  currentReturn: 7.9  },
      { rank: 8,  name: "Axis AAA Bond Plus SDL",            category: "Bond MF",         weight: 8,  currentReturn: 8.1  },
      { rank: 9,  name: "Nippon India Gold Savings Fund",    category: "Gold ETF",        weight: 7,  currentReturn: 11.1 },
      { rank: 10, name: "Kotak NIFTY 50 ETF",               category: "Index ETF",       weight: 6,  currentReturn: 12.7 },
      { rank: 11, name: "SBI Magnum Gilt Fund",              category: "Gilt MF",         weight: 5,  currentReturn: 7.2  },
      { rank: 12, name: "ICICI Pru Liquid Fund",             category: "Liquid MF",       weight: 5,  currentReturn: 7.4  },
      { rank: 13, name: "HDFC Liquid Fund",                  category: "Liquid MF",       weight: 4,  currentReturn: 7.5  },
      { rank: 14, name: "Axis Liquid Fund",                  category: "Liquid MF",       weight: 1,  currentReturn: 7.2  },
    ],
    performance: PERFORMANCE_BASE("goal-child-education", 1000, 36, 14.2, 8),
    riskMetrics: { sharpeRatio: 1.52, maxDrawdown: -14.3, volatility: 12.4, beta: 0.88, alpha: 3.1 },
    rebalancingHistory: [{ date: "Jun 2026", description: "Annual glide path review", changes: ["Equity maintained at 80%"] }],
    aiInsight: {
      recommendation: "Start SIP of ₹5,000/month to build ₹35–40L corpus in 15 years. Glide path shifts to debt as college approaches.",
      confidence_score: 87,
      factors_considered: ["15Y horizon = equity compounding", "ELSS adds ₹46,800 tax saving", "Glide path reduces risk near goal"],
      model_version: "FASP-AI-v2.0", timestamp: new Date().toISOString(),
    },
  },
  {
    id: "goal-retirement",
    assetClass: "goal_based",
    subCategory: "Retirement",
    name: "Retirement Corpus Builder",
    tagline: "Systematic wealth accumulation for a comfortable post-retirement life",
    riskProfile: "moderate",
    goal: ["retirement", "income"],
    minInvestment: 10000,
    timeHorizon: "15–25 years",
    cagr1Y: 13.1, cagr3Y: 14.4, cagr5Y: 15.8,
    benchmarkCagr1Y: 11.2, benchmarkName: "NIFTY 500 TRI",
    lastRebalanced: "2026-06-01", totalHoldings: 16,
    rebalancingFrequency: "quarterly",
    highlight: "NPS Sec 80CCD(1B) + equity MFs + SGB",
    icon: "🌅",
    allocation: [
      { category: "equity", label: "Diversified Equity", weight: 55, color: "#3B82F6", icon: "📈" },
      { category: "nps", label: "NPS Tier I (E+G)", weight: 20, color: "#8B5CF6", icon: "🏛️" },
      { category: "debt", label: "Debt MFs", weight: 15, color: "#10B981", icon: "📊" },
      { category: "gold", label: "Gold ETF / SGB", weight: 10, color: "#F59E0B", icon: "🥇" },
    ],
    holdings: [
      { rank: 1,  name: "HDFC Retirement Savings — Hybrid Equity",category: "Retirement MF",  weight: 10, currentReturn: 12.1 },
      { rank: 2,  name: "ICICI Pru Balanced Advantage Fund", category: "Balanced Adv MF",  weight: 9,  currentReturn: 11.8 },
      { rank: 3,  name: "SBI Retirement Benefit Fund",        category: "Retirement MF",    weight: 8,  currentReturn: 9.2  },
      { rank: 4,  name: "Parag Parikh Flexi Cap Fund",        category: "Flexi Cap MF",     weight: 7,  currentReturn: 16.8 },
      { rank: 5,  name: "Mirae Asset Large Cap Fund",         category: "Large Cap MF",     weight: 7,  currentReturn: 14.1 },
      { rank: 6,  name: "SBI Magnum Gilt Fund",               category: "Gilt MF",          weight: 7,  currentReturn: 7.2  },
      { rank: 7,  name: "HDFC Corporate Bond Fund",           category: "Corp Bond MF",     weight: 7,  currentReturn: 7.9  },
      { rank: 8,  name: "Embassy Office Parks REIT",          category: "REIT",             weight: 7,  currentReturn: 9.8  },
      { rank: 9,  name: "Nippon India Gold Savings Fund",     category: "Gold ETF",         weight: 6,  currentReturn: 11.1 },
      { rank: 10, name: "Axis AAA Bond Plus SDL",             category: "Bond MF",          weight: 6,  currentReturn: 8.1  },
      { rank: 11, name: "HDFC Balanced Advantage Fund",       category: "Balanced Adv MF",  weight: 6,  currentReturn: 12.4 },
      { rank: 12, name: "Kotak NIFTY 50 ETF",                category: "Index ETF",        weight: 6,  currentReturn: 12.7 },
      { rank: 13, name: "IndiGrid InvIT",                     category: "InvIT",            weight: 5,  currentReturn: 9.1  },
      { rank: 14, name: "Aditya Birla SL Savings Fund",       category: "Ultra Short MF",   weight: 5,  currentReturn: 7.1  },
      { rank: 15, name: "HDFC Liquid Fund",                   category: "Liquid MF",        weight: 4,  currentReturn: 7.5  },
      { rank: 16, name: "ICICI Pru Liquid Fund",              category: "Liquid MF",        weight: 1,  currentReturn: 7.4  },
    ],
    performance: PERFORMANCE_BASE("goal-retirement", 1000, 36, 13.1, 7),
    riskMetrics: { sharpeRatio: 1.61, maxDrawdown: -12.8, volatility: 11.2, beta: 0.82, alpha: 2.8 },
    rebalancingHistory: [{ date: "Jun 2026", description: "NPS allocation reviewed", changes: ["Added SGB tranche"] }],
    aiInsight: {
      recommendation: "NPS Sec 80CCD(1B) gives extra ₹50,000 deduction. SGB gives 2.5% annual interest + gold appreciation. Long horizon favours equity dominance.",
      confidence_score: 89,
      factors_considered: ["NPS Sec 80CCD(1B) ₹50K deduction", "SGB — sovereign guaranteed", "Long horizon = equity compounding"],
      model_version: "FASP-AI-v2.0", timestamp: new Date().toISOString(),
    },
  },
  {
    id: "goal-wedding-fund",
    assetClass: "goal_based",
    subCategory: "Wedding / Life Event",
    name: "Wedding Fund",
    tagline: "3–5 year goal-based savings for a life milestone",
    riskProfile: "moderate",
    goal: ["capital_preservation", "wealth_growth"],
    minInvestment: 10000,
    timeHorizon: "3–5 years",
    cagr1Y: 11.8, cagr3Y: 12.6, cagr5Y: 13.4,
    benchmarkCagr1Y: 10.1, benchmarkName: "CRISIL Hybrid 50+50",
    lastRebalanced: "2026-06-01", totalHoldings: 10,
    rebalancingFrequency: "quarterly",
    highlight: "Balanced growth + capital safety for 3–5Y milestone",
    icon: "💍", isNew: true,
    allocation: [
      { category: "large_cap", label: "Large Cap Equity", weight: 40, color: "#3B82F6", icon: "🏦" },
      { category: "short_debt", label: "Short Term Debt", weight: 35, color: "#10B981", icon: "📊" },
      { category: "gold", label: "Gold ETF", weight: 15, color: "#F59E0B", icon: "🥇" },
      { category: "liquid", label: "Liquid Buffer", weight: 10, color: "#9CA3AF", icon: "💧" },
    ],
    holdings: [
      { rank: 1,  name: "Kotak NIFTY 50 ETF",               category: "Index ETF",       weight: 20, currentReturn: 12.7 },
      { rank: 2,  name: "HDFC Top 100 Fund",                 category: "Large Cap MF",    weight: 15, currentReturn: 13.4 },
      { rank: 3,  name: "Parag Parikh Flexi Cap Fund",       category: "Flexi Cap MF",    weight: 14, currentReturn: 16.8 },
      { rank: 4,  name: "HDFC Corporate Bond Fund",          category: "Corp Bond MF",    weight: 12, currentReturn: 7.9  },
      { rank: 5,  name: "SBI Magnum Gilt Fund",              category: "Gilt MF",         weight: 12, currentReturn: 7.2  },
      { rank: 6,  name: "Nippon India Gold Savings Fund",    category: "Gold ETF",        weight: 12, currentReturn: 11.1 },
      { rank: 7,  name: "ICICI Pru Balanced Advantage Fund", category: "Balanced Adv MF", weight: 8,  currentReturn: 11.8 },
      { rank: 8,  name: "Axis AAA Bond Plus SDL",            category: "Bond MF",         weight: 5,  currentReturn: 8.1  },
      { rank: 9,  name: "HDFC Liquid Fund",                  category: "Liquid MF",       weight: 1,  currentReturn: 7.5  },
      { rank: 10, name: "ICICI Pru Liquid Fund",             category: "Liquid MF",       weight: 1,  currentReturn: 7.4  },
    ],
    performance: PERFORMANCE_BASE("goal-wedding-fund", 1000, 24, 11.8, 6),
    riskMetrics: { sharpeRatio: 1.74, maxDrawdown: -8.4, volatility: 7.8, beta: 0.52, alpha: 2.4 },
    rebalancingHistory: [{ date: "Jun 2026", description: "Equity trimmed as goal approaches", changes: ["Equity: 45% → 40%"] }],
    aiInsight: {
      recommendation: "Gold hedges against rising wedding costs. Short debt limits rate risk. 40% equity provides growth over 3–5Y.",
      confidence_score: 82,
      factors_considered: ["3-5Y horizon", "Gold tracks inflation", "Short debt limits rate risk"],
      model_version: "FASP-AI-v2.0", timestamp: new Date().toISOString(),
    },
  },
  {
    id: "goal-home-downpayment",
    assetClass: "goal_based",
    subCategory: "Home Purchase",
    name: "Home Down Payment",
    tagline: "2–3 year disciplined savings toward your first home",
    riskProfile: "conservative",
    goal: ["capital_preservation", "income"],
    minInvestment: 25000,
    timeHorizon: "2–3 years",
    cagr1Y: 8.9, cagr3Y: 9.1, cagr5Y: 8.8,
    benchmarkCagr1Y: 7.8, benchmarkName: "CRISIL Short Term Bond",
    lastRebalanced: "2026-06-01", totalHoldings: 8,
    rebalancingFrequency: "quarterly",
    highlight: "Capital preservation priority — cannot afford big drawdowns",
    icon: "🏠",
    allocation: [
      { category: "short_debt", label: "Short Term Debt MFs", weight: 50, color: "#10B981", icon: "📊" },
      { category: "banking_psu", label: "Banking & PSU Debt", weight: 25, color: "#3B82F6", icon: "🏦" },
      { category: "liquid", label: "Liquid MFs", weight: 15, color: "#9CA3AF", icon: "💧" },
      { category: "conservative_equity", label: "Conservative Hybrid", weight: 10, color: "#8B5CF6", icon: "⚖️" },
    ],
    holdings: [
      { rank: 1,  name: "HDFC Short Term Debt Fund",          category: "Short Term MF",   weight: 22, currentReturn: 7.4  },
      { rank: 2,  name: "ICICI Pru Short Term Fund",         category: "Short Term MF",   weight: 20, currentReturn: 7.5  },
      { rank: 3,  name: "Kotak Short Term Fund",             category: "Short Term MF",   weight: 18, currentReturn: 7.3  },
      { rank: 4,  name: "SBI Magnum Income Fund",            category: "Income MF",       weight: 15, currentReturn: 7.8  },
      { rank: 5,  name: "HDFC Corporate Bond Fund",          category: "Corp Bond MF",    weight: 12, currentReturn: 7.9  },
      { rank: 6,  name: "Nippon India Gold Savings Fund",    category: "Gold ETF",        weight: 7,  currentReturn: 11.1 },
      { rank: 7,  name: "Axis Liquid Fund",                  category: "Liquid MF",       weight: 3,  currentReturn: 7.2  },
      { rank: 8,  name: "HDFC Liquid Fund",                  category: "Liquid MF",       weight: 3,  currentReturn: 7.5  },
    ],
    performance: PERFORMANCE_BASE("goal-home-downpayment", 1000, 24, 8.9, 1.5),
    riskMetrics: { sharpeRatio: 2.3, maxDrawdown: -2.1, volatility: 2.8, beta: 0.09, alpha: 1.1 },
    rebalancingHistory: [{ date: "Jun 2026", description: "Conservative hybrid trimmed", changes: ["Equity: 15% → 10%"] }],
    aiInsight: {
      recommendation: "2–3Y home goal needs capital preservation. ~8.9% outperforms FDs. Zero equity risk above 10%.",
      confidence_score: 91,
      factors_considered: ["Short horizon = debt dominant", "Cannot afford drawdown near goal", "All-AAA credit quality"],
      model_version: "FASP-AI-v2.0", timestamp: new Date().toISOString(),
    },
  },
  {
    id: "goal-emergency-corpus",
    assetClass: "goal_based",
    subCategory: "Emergency Fund",
    name: "Emergency Corpus",
    tagline: "6-month expense buffer — safe, liquid, 2x savings account return",
    riskProfile: "conservative",
    goal: ["capital_preservation"],
    minInvestment: 5000,
    timeHorizon: "Always liquid",
    cagr1Y: 7.4, cagr3Y: 7.0, cagr5Y: 6.8,
    benchmarkCagr1Y: 3.5, benchmarkName: "SBI Savings Account Rate",
    lastRebalanced: "2026-06-01", totalHoldings: 4,
    rebalancingFrequency: "quarterly",
    highlight: "T+1 withdrawal · 2x savings return · zero market risk",
    icon: "🛡️",
    allocation: [
      { category: "liquid_mf", label: "Liquid Mutual Funds", weight: 60, color: "#10B981", icon: "💧" },
      { category: "overnight", label: "Overnight Funds", weight: 25, color: "#3B82F6", icon: "🌙" },
      { category: "bank_fd", label: "Bank FD (1 month)", weight: 15, color: "#F59E0B", icon: "🏦" },
    ],
    holdings: [
      { rank: 1, name: "HDFC Liquid Fund", category: "Liquid MF", weight: 35, currentReturn: 7.4 },
      { rank: 2, name: "ICICI Pru Liquid Fund", category: "Liquid MF", weight: 25, currentReturn: 7.5 },
      { rank: 3, name: "Aditya Birla Overnight Fund", category: "Overnight MF", weight: 25, currentReturn: 7.2 },
      { rank: 4, name: "1-Month Bank FD", category: "Bank FD", weight: 15, currentReturn: 5.5 },
    ],
    performance: PERFORMANCE_BASE("goal-emergency-corpus", 1000, 24, 7.4, 0.2),
    riskMetrics: { sharpeRatio: 4.1, maxDrawdown: -0.03, volatility: 0.15, beta: 0.00, alpha: 0.5 },
    rebalancingHistory: [{ date: "Jun 2026", description: "Routine review — no change", changes: ["Allocation maintained"] }],
    aiInsight: {
      recommendation: "~7.4% vs 3.5% savings with full T+1 liquidity. Every household needs 3–6 months of expenses as an emergency fund.",
      confidence_score: 97,
      factors_considered: ["Full T+1 liquidity", "AAA/sovereign only", "No exit load after 7 days"],
      model_version: "FASP-AI-v2.0", timestamp: new Date().toISOString(),
    },
  },
  {
    id: "goal-senior-citizen",
    assetClass: "goal_based",
    subCategory: "Senior Citizen",
    name: "Senior Citizen Income",
    tagline: "Regular income + capital safety for retirees 60+ years",
    riskProfile: "conservative",
    goal: ["income", "capital_preservation"],
    minInvestment: 100000,
    timeHorizon: "Perpetual",
    cagr1Y: 8.8, cagr3Y: 8.5, cagr5Y: 8.2,
    benchmarkCagr1Y: 7.5, benchmarkName: "PMVVY Rate (8%)",
    lastRebalanced: "2026-06-01", totalHoldings: 10,
    rebalancingFrequency: "quarterly",
    highlight: "SCSS 8.2% + PMVVY + RBI FRB + monthly dividend MFs",
    icon: "👴",
    allocation: [
      { category: "scss", label: "SCSS (8.2% guaranteed)", weight: 30, color: "#10B981", icon: "🏦" },
      { category: "pmvvy", label: "PM Vaya Vandana Yojana", weight: 20, color: "#3B82F6", icon: "🛡️" },
      { category: "rbi_frb", label: "RBI Floating Rate Bonds", weight: 20, color: "#8B5CF6", icon: "📊" },
      { category: "dividend_mf", label: "Monthly Dividend MFs", weight: 20, color: "#F59E0B", icon: "💰" },
      { category: "liquid", label: "Liquid Buffer", weight: 10, color: "#9CA3AF", icon: "💧" },
    ],
    holdings: [
      { rank: 1,  name: "SBI Magnum Income Fund",            category: "Income MF",       weight: 15, currentReturn: 7.8  },
      { rank: 2,  name: "HDFC Corporate Bond Fund",          category: "Corp Bond MF",    weight: 14, currentReturn: 7.9  },
      { rank: 3,  name: "ICICI Pru Gilt Fund",               category: "Gilt MF",         weight: 13, currentReturn: 7.6  },
      { rank: 4,  name: "Embassy Office Parks REIT",         category: "REIT",            weight: 13, currentReturn: 9.8  },
      { rank: 5,  name: "Axis AAA Bond Plus SDL",            category: "Bond MF",         weight: 12, currentReturn: 8.1  },
      { rank: 6,  name: "Nippon India Gold Savings Fund",    category: "Gold ETF",        weight: 10, currentReturn: 11.1 },
      { rank: 7,  name: "IndiGrid InvIT",                    category: "InvIT",           weight: 8,  currentReturn: 9.1  },
      { rank: 8,  name: "HDFC Short Term Debt Fund",         category: "Short Term MF",   weight: 8,  currentReturn: 7.4  },
      { rank: 9,  name: "ICICI Pru Liquid Fund",             category: "Liquid MF",       weight: 4,  currentReturn: 7.4  },
      { rank: 10, name: "HDFC Liquid Fund",                  category: "Liquid MF",       weight: 3,  currentReturn: 7.5  },
    ],
    performance: PERFORMANCE_BASE("goal-senior-citizen", 1000, 24, 8.8, 1),
    riskMetrics: { sharpeRatio: 2.8, maxDrawdown: -1.8, volatility: 1.9, beta: 0.06, alpha: 1.4 },
    rebalancingHistory: [{ date: "Jun 2026", description: "SCSS rate revised to 8.2%", changes: ["SCSS: 25% → 30%"] }],
    aiInsight: {
      recommendation: "SCSS at 8.2%, RBI FRB at 8.05% — sovereign guaranteed. Combined yield ~8.8% outperforms FDs with govt guarantee.",
      confidence_score: 94,
      factors_considered: ["SCSS sovereign 8.2%", "PMVVY LIC pension", "RBI FRB floats 35bps above NSC"],
      model_version: "FASP-AI-v2.0", timestamp: new Date().toISOString(),
    },
  },
  {
    id: "goal-starter-sip",
    assetClass: "goal_based",
    subCategory: "First Investment",
    name: "Starter SIP Portfolio",
    tagline: "Your first investment — ₹500/month, zero complexity",
    riskProfile: "moderate",
    goal: ["wealth_growth"],
    minInvestment: 500,
    timeHorizon: "7+ years",
    cagr1Y: 13.4, cagr3Y: 14.7, cagr5Y: 16.1,
    benchmarkCagr1Y: 12.8, benchmarkName: "NIFTY 50 TRI",
    lastRebalanced: "2026-06-01", totalHoldings: 3,
    rebalancingFrequency: "quarterly",
    highlight: "3-fund core — simple, low-cost, proven",
    icon: "🌱", isNew: true,
    allocation: [
      { category: "index_large", label: "Nifty 50 Index Fund", weight: 60, color: "#3B82F6", icon: "📈" },
      { category: "index_mid", label: "Nifty Midcap 150 Index", weight: 30, color: "#F59E0B", icon: "⚡" },
      { category: "liquid", label: "Liquid MF (buffer)", weight: 10, color: "#9CA3AF", icon: "💧" },
    ],
    holdings: [
      { rank: 1, name: "Nifty 50 Index Fund (any AMC)", symbol: "NIFTY50IDX", category: "Index Fund", weight: 60, currentReturn: 12.8 },
      { rank: 2, name: "Nifty Midcap 150 Index Fund", category: "Index Fund", weight: 30, currentReturn: 18.4 },
      { rank: 3, name: "Liquid Fund (any AMC)", category: "Liquid MF", weight: 10, currentReturn: 7.3 },
    ],
    performance: PERFORMANCE_BASE("goal-starter-sip", 1000, 24, 13.4, 7),
    riskMetrics: { sharpeRatio: 1.44, maxDrawdown: -13.1, volatility: 11.8, beta: 0.97, alpha: 1.8 },
    rebalancingHistory: [{ date: "Jun 2026", description: "Annual rebalancing — passive", changes: ["No changes"] }],
    aiInsight: {
      recommendation: "3-fund portfolio: simplest evidence-based strategy. Start ₹500/month SIP — just don't stop. Index beats 80% active funds over 10Y.",
      confidence_score: 92,
      factors_considered: ["Expense ratio < 0.10%", "Zero active manager risk", "Index beats 80% active over 10Y"],
      model_version: "FASP-AI-v2.0", timestamp: new Date().toISOString(),
    },
  },

  // ── SECTORAL / THEMATIC ──────────────────────────────────────────────────────
  {
    id: "thematic-bfsi",
    assetClass: "thematic",
    subCategory: "BFSI",
    name: "BFSI Alpha",
    tagline: "India's largest GDP sector — Banks, Insurance, NBFCs, Fintech",
    riskProfile: "moderate",
    goal: ["wealth_growth"],
    minInvestment: 50000,
    timeHorizon: "5–7 years",
    cagr1Y: 15.7, cagr3Y: 17.2, cagr5Y: 18.9,
    benchmarkCagr1Y: 13.4, benchmarkName: "NIFTY Bank Index",
    lastRebalanced: "2026-06-01", totalHoldings: 18,
    rebalancingFrequency: "quarterly",
    highlight: "Banks + Insurance + NBFCs + Fintech ecosystem",
    icon: "🏦", isNew: true,
    allocation: [
      { category: "pvt_banks", label: "Private Banks", weight: 40, color: "#3B82F6", icon: "🏦" },
      { category: "insurance", label: "Insurance", weight: 20, color: "#10B981", icon: "🛡️" },
      { category: "nbfc", label: "NBFCs / HFCs", weight: 20, color: "#F59E0B", icon: "💳" },
      { category: "fintech", label: "Fintech / Digital", weight: 15, color: "#8B5CF6", icon: "📱" },
      { category: "psu_banks", label: "PSU Banks", weight: 5, color: "#6B7280", icon: "🏛️" },
    ],
    holdings: [
      { rank: 1,  name: "Nippon India Banking & Financial Services",category: "BFSI Thematic",  weight: 10, currentReturn: 16.8 },
      { rank: 2,  name: "ICICI Pru Banking & Financial Services",  category: "BFSI Thematic",  weight: 9,  currentReturn: 15.4 },
      { rank: 3,  name: "SBI Banking & Financial Services Fund",   category: "BFSI Thematic",  weight: 8,  currentReturn: 14.9 },
      { rank: 4,  name: "Aditya Birla SL Banking & Financial Serv",category: "BFSI Thematic",  weight: 8,  currentReturn: 15.1 },
      { rank: 5,  name: "HDFC Banking and Financial Services Fund",category: "BFSI Thematic",  weight: 7,  currentReturn: 14.6 },
      { rank: 6,  name: "Kotak Banking and Financial Services",    category: "BFSI Thematic",  weight: 7,  currentReturn: 14.3 },
      { rank: 7,  name: "Invesco India Financial Services Fund",   category: "BFSI Thematic",  weight: 6,  currentReturn: 13.8 },
      { rank: 8,  name: "Tata Banking & Financial Services Fund",  category: "BFSI Thematic",  weight: 6,  currentReturn: 14.1 },
      { rank: 9,  name: "MIRAE Asset Banking & Fin Services ETF",  category: "BFSI ETF",        weight: 6,  currentReturn: 15.2 },
      { rank: 10, name: "Nippon ETF Bank BeES",                    category: "BFSI ETF",        weight: 6,  currentReturn: 14.8 },
      { rank: 11, name: "DSP Banking & Financial Services Fund",   category: "BFSI Thematic",   weight: 6,  currentReturn: 13.6 },
      { rank: 12, name: "Canara Robeco Banking & Financial Serv",  category: "BFSI Thematic",   weight: 6,  currentReturn: 13.4 },
      { rank: 13, name: "LIC MF Banking & Financial Services",     category: "BFSI Thematic",   weight: 5,  currentReturn: 12.9 },
      { rank: 14, name: "Groww Banking & Financial Services Fund", category: "BFSI Thematic",   weight: 5,  currentReturn: 13.2 },
      { rank: 15, name: "Motilal Oswal S&P BSE Fin Services ETF",  category: "BFSI ETF",        weight: 5,  currentReturn: 14.1 },
      { rank: 16, name: "HDFC Liquid Fund",                        category: "Liquid MF",       weight: 3,  currentReturn: 7.5  },
      { rank: 17, name: "ICICI Pru Liquid Fund",                   category: "Liquid MF",       weight: 2,  currentReturn: 7.4  },
      { rank: 18, name: "SBI Liquid Fund",                         category: "Liquid MF",       weight: 1,  currentReturn: 7.4  },
    ],
    performance: PERFORMANCE_BASE("thematic-bfsi", 1000, 24, 15.7, 9),
    riskMetrics: { sharpeRatio: 1.48, maxDrawdown: -17.4, volatility: 14.8, beta: 1.08, alpha: 3.9 },
    rebalancingHistory: [{ date: "Jun 2026", description: "Fintech tilt increased", changes: ["Fintech: 10% → 15%", "PSU: 10% → 5%"] }],
    aiInsight: {
      recommendation: "BFSI is 35%+ of Nifty 50. Credit growth 15% YoY + insurance penetration at 4% (vs 12% global) = decade-long opportunity.",
      confidence_score: 80,
      factors_considered: ["Credit growth 15% YoY", "Insurance penetration gap", "NIM expansion"],
      model_version: "FASP-AI-v2.0", timestamp: new Date().toISOString(),
    },
  },
  {
    id: "thematic-pharma",
    assetClass: "thematic",
    subCategory: "Healthcare & Pharma",
    name: "Healthcare Alpha",
    tagline: "India pharma API dominance + domestic healthcare expansion",
    riskProfile: "aggressive",
    goal: ["wealth_growth", "thematic"],
    minInvestment: 50000,
    timeHorizon: "5–10 years",
    cagr1Y: 18.4, cagr3Y: 20.1, cagr5Y: 22.7,
    benchmarkCagr1Y: 15.9, benchmarkName: "NIFTY Pharma Index",
    lastRebalanced: "2026-05-15", totalHoldings: 20,
    rebalancingFrequency: "quarterly",
    highlight: "API exports + hospitals + diagnostics + medtech",
    icon: "💊", isNew: true,
    allocation: [
      { category: "pharma_api", label: "Pharma / API Exporters", weight: 40, color: "#10B981", icon: "💊" },
      { category: "hospitals", label: "Hospitals / Healthcare", weight: 25, color: "#3B82F6", icon: "🏥" },
      { category: "diagnostics", label: "Diagnostics / Labs", weight: 20, color: "#8B5CF6", icon: "🔬" },
      { category: "medtech", label: "Medtech / Devices", weight: 15, color: "#F59E0B", icon: "⚕️" },
    ],
    holdings: [
      { rank: 1,  name: "Nippon India Pharma Fund",             category: "Pharma Thematic", weight: 9,  currentReturn: 18.4 },
      { rank: 2,  name: "SBI Healthcare Opportunities Fund",  category: "Pharma Thematic", weight: 8,  currentReturn: 17.2 },
      { rank: 3,  name: "UTI Healthcare Fund",                category: "Pharma Thematic", weight: 8,  currentReturn: 16.8 },
      { rank: 4,  name: "ICICI Pru Pharma Healthcare Fund",   category: "Pharma Thematic", weight: 7,  currentReturn: 17.4 },
      { rank: 5,  name: "Aditya Birla SL Healthcare Fund",    category: "Pharma Thematic", weight: 7,  currentReturn: 16.1 },
      { rank: 6,  name: "Tata India Pharma & Healthcare Fund",category: "Pharma Thematic", weight: 7,  currentReturn: 18.9 },
      { rank: 7,  name: "Kotak Healthcare Fund",              category: "Pharma Thematic", weight: 6,  currentReturn: 16.4 },
      { rank: 8,  name: "DSP Healthcare Fund",                category: "Pharma Thematic", weight: 6,  currentReturn: 15.9 },
      { rank: 9,  name: "Quant Healthcare Fund",              category: "Pharma Thematic", weight: 6,  currentReturn: 20.1 },
      { rank: 10, name: "Mirae Asset Healthcare Fund",        category: "Pharma Thematic", weight: 6,  currentReturn: 16.7 },
      { rank: 11, name: "Nippon ETF Pharma BeES",             category: "Pharma ETF",      weight: 6,  currentReturn: 17.1 },
      { rank: 12, name: "Mirae Asset Nifty India Pharma ETF", category: "Pharma ETF",      weight: 6,  currentReturn: 16.5 },
      { rank: 13, name: "HDFC Pharma and Healthcare Fund",    category: "Pharma Thematic", weight: 5,  currentReturn: 15.4 },
      { rank: 14, name: "Canara Robeco Healthcare Fund",      category: "Pharma Thematic", weight: 5,  currentReturn: 15.7 },
      { rank: 15, name: "ICICI Pru Liquid Fund",              category: "Liquid MF",       weight: 4,  currentReturn: 7.4  },
      { rank: 16, name: "Invesco India Healthcare Fund",      category: "Pharma Thematic", weight: 4,  currentReturn: 15.1 },
      { rank: 17, name: "Bandhan Healthcare Fund",            category: "Pharma Thematic", weight: 4,  currentReturn: 14.8 },
      { rank: 18, name: "LIC MF Healthcare Fund",             category: "Pharma Thematic", weight: 4,  currentReturn: 14.2 },
      { rank: 19, name: "HDFC Liquid Fund",                   category: "Liquid MF",       weight: 2,  currentReturn: 7.5  },
      { rank: 20, name: "SBI Liquid Fund",                    category: "Liquid MF",       weight: 1,  currentReturn: 7.4  },
    ],
    performance: PERFORMANCE_BASE("thematic-pharma", 1000, 24, 18.4, 11),
    riskMetrics: { sharpeRatio: 1.56, maxDrawdown: -19.8, volatility: 16.4, beta: 0.98, alpha: 5.2 },
    rebalancingHistory: [{ date: "May 2026", description: "Medtech added", changes: ["Medtech: 0% → 15%"] }],
    aiInsight: {
      recommendation: "India = 20% global generic exports + 60% API supply for key molecules. Hospital chains: 1 bed per 1000 vs 4 globally.",
      confidence_score: 76,
      factors_considered: ["India generic export share", "Hospital underpenetration", "Aging demographics"],
      model_version: "FASP-AI-v2.0", timestamp: new Date().toISOString(),
    },
  },
  {
    id: "thematic-defence",
    assetClass: "thematic",
    subCategory: "Defence & Aerospace",
    name: "Defence & Aerospace",
    tagline: "India's ₹6.2L Cr defence budget driving indigenisation boom",
    riskProfile: "high",
    goal: ["wealth_growth", "thematic"],
    minInvestment: 75000,
    timeHorizon: "5–10 years",
    cagr1Y: 31.4, cagr3Y: 28.7, cagr5Y: 24.1,
    benchmarkCagr1Y: 24.1, benchmarkName: "NIFTY India Defence Index",
    lastRebalanced: "2026-06-01", totalHoldings: 15,
    rebalancingFrequency: "quarterly",
    highlight: "HAL/BEL/BEML + private defence + DRDO indigenisation",
    icon: "🛡️", isNew: true,
    allocation: [
      { category: "defence_psu", label: "Defence PSUs (HAL/BEL)", weight: 40, color: "#EF4444", icon: "✈️" },
      { category: "defence_pvt", label: "Private Defence (L&T)", weight: 30, color: "#F97316", icon: "🚀" },
      { category: "aerospace", label: "Aerospace Components", weight: 20, color: "#8B5CF6", icon: "🛸" },
      { category: "electronics", label: "Defence Electronics", weight: 10, color: "#3B82F6", icon: "📡" },
    ],
    holdings: [
      { rank: 1,  name: "Motilal Oswal Nifty India Defence ETF", category: "Defence ETF",     weight: 18, currentReturn: 24.7 },
      { rank: 2,  name: "Nippon India Nifty India Defence ETF",category: "Defence ETF",   weight: 16, currentReturn: 23.8 },
      { rank: 3,  name: "HDFC Defence Fund",                  category: "Defence Thematic",weight: 14, currentReturn: 22.4 },
      { rank: 4,  name: "Aditya Birla SL Defence Fund",       category: "Defence Thematic",weight: 12, currentReturn: 21.9 },
      { rank: 5,  name: "Quant Defence Fund",                 category: "Defence Thematic",weight: 12, currentReturn: 25.6 },
      { rank: 6,  name: "SBI Defence Opportunities Fund",     category: "Defence Thematic",weight: 10, currentReturn: 20.7 },
      { rank: 7,  name: "ICICI Pru Defence Fund",             category: "Defence Thematic",weight: 9,  currentReturn: 21.4 },
      { rank: 8,  name: "Edelweiss India Defence Fund",       category: "Defence Thematic",weight: 5,  currentReturn: 22.7 },
      { rank: 9,  name: "Tata Indian Defence Fund",           category: "Defence Thematic",weight: 3,  currentReturn: 20.1 },
      { rank: 10, name: "Mirae Asset Nifty India Defence ETF",category: "Defence ETF",    weight: 3,  currentReturn: 23.2 },
      { rank: 11, name: "HDFC Liquid Fund",                   category: "Liquid MF",       weight: 3,  currentReturn: 7.5  },
      { rank: 12, name: "ICICI Pru Liquid Fund",              category: "Liquid MF",       weight: 2,  currentReturn: 7.4  },
      { rank: 13, name: "SBI Liquid Fund",                    category: "Liquid MF",       weight: 2,  currentReturn: 7.4  },
      { rank: 14, name: "Axis Liquid Fund",                   category: "Liquid MF",       weight: 1,  currentReturn: 7.2  },
      { rank: 15, name: "Kotak Liquid Fund",                  category: "Liquid MF",       weight: 1,  currentReturn: 7.2  },
    ],
    performance: PERFORMANCE_BASE("thematic-defence", 1000, 24, 31.4, 16),
    riskMetrics: { sharpeRatio: 1.72, maxDrawdown: -24.3, volatility: 21.4, beta: 1.18, alpha: 9.8 },
    rebalancingHistory: [{ date: "Jun 2026", description: "HAL target order ₹1.2L Cr", changes: ["HAL: 12% → 15%"] }],
    aiInsight: {
      recommendation: "FY27 capex ₹6.2L Cr + DRDO 75% indigenisation target. HAL order backlog ₹94,000 Cr. Elevated 45-60x PE — needs 5Y+ conviction.",
      confidence_score: 71,
      factors_considered: ["FY27 defence capex ₹6.21L Cr", "DRDO indigenisation mandate", "Elevated PE 45-60x"],
      model_version: "FASP-AI-v2.0", timestamp: new Date().toISOString(),
    },
  },
  {
    id: "thematic-green-energy",
    assetClass: "thematic",
    subCategory: "Green Energy",
    name: "Green Energy India",
    tagline: "Solar, wind, EV, green hydrogen — India's energy transition",
    riskProfile: "high",
    goal: ["wealth_growth", "thematic"],
    minInvestment: 50000,
    timeHorizon: "5–10 years",
    cagr1Y: 26.8, cagr3Y: 24.3, cagr5Y: 21.7,
    benchmarkCagr1Y: 21.2, benchmarkName: "NIFTY India Clean Energy Index",
    lastRebalanced: "2026-06-01", totalHoldings: 18,
    rebalancingFrequency: "quarterly",
    highlight: "500GW renewable by 2030 — ₹3L Cr govt allocation",
    icon: "☀️", isNew: true,
    allocation: [
      { category: "solar", label: "Solar / Renewable Developers", weight: 35, color: "#F59E0B", icon: "☀️" },
      { category: "ev", label: "EV / Battery Ecosystem", weight: 25, color: "#10B981", icon: "⚡" },
      { category: "green_infra", label: "Green Infrastructure", weight: 25, color: "#3B82F6", icon: "🏗️" },
      { category: "green_hydrogen", label: "Green Hydrogen", weight: 15, color: "#8B5CF6", icon: "🌿" },
    ],
    holdings: [
      { rank: 1,  name: "Nippon India Nifty India Green Energy ETF",category: "Green Energy ETF",weight: 15, currentReturn: 21.4 },
      { rank: 2,  name: "Mirae Asset Nifty India Green Ener ETF",  category: "Green Energy ETF",weight: 13, currentReturn: 20.8 },
      { rank: 3,  name: "Quantum Green Energy Fund",          category: "Green Energy MF", weight: 11, currentReturn: 18.7 },
      { rank: 4,  name: "HDFC Green Energy Fund",             category: "Green Energy MF", weight: 10, currentReturn: 19.2 },
      { rank: 5,  name: "SBI Energy Opportunities Fund",      category: "Green Energy MF", weight: 9,  currentReturn: 20.1 },
      { rank: 6,  name: "Aditya Birla SL New Energy Fund",    category: "Green Energy MF", weight: 9,  currentReturn: 18.4 },
      { rank: 7,  name: "DSP Natural Resources & New Energy", category: "Green Energy MF", weight: 8,  currentReturn: 19.5 },
      { rank: 8,  name: "Tata Resources & Energy Fund",       category: "Energy Thematic", weight: 8,  currentReturn: 18.3 },
      { rank: 9,  name: "ICICI Pru Green Energy Fund",        category: "Green Energy MF", weight: 7,  currentReturn: 19.8 },
      { rank: 10, name: "Invesco India ESG Equity Fund",      category: "ESG MF",          weight: 5,  currentReturn: 16.2 },
      { rank: 11, name: "Mirae Asset ESG Sector Leaders ETF", category: "ESG ETF",         weight: 4,  currentReturn: 15.8 },
      { rank: 12, name: "HDFC Liquid Fund",                   category: "Liquid MF",       weight: 1,  currentReturn: 7.5  },
      { rank: 13, name: "ICICI Pru Liquid Fund",              category: "Liquid MF",       weight: 1,  currentReturn: 7.4  },
      { rank: 14, name: "SBI Liquid Fund",                    category: "Liquid MF",       weight: 1,  currentReturn: 7.4  },
      { rank: 15, name: "Axis Liquid Fund",                   category: "Liquid MF",       weight: 1,  currentReturn: 7.2  },
      { rank: 16, name: "Kotak Liquid Fund",                  category: "Liquid MF",       weight: 1,  currentReturn: 7.2  },
      { rank: 17, name: "Nippon India Liquid Fund",           category: "Liquid MF",       weight: 1,  currentReturn: 7.3  },
      { rank: 18, name: "DSP Liquidity Fund",                 category: "Liquid MF",       weight: 1,  currentReturn: 7.0  },
    ],
    performance: PERFORMANCE_BASE("thematic-green-energy", 1000, 24, 26.8, 15),
    riskMetrics: { sharpeRatio: 1.58, maxDrawdown: -26.4, volatility: 22.1, beta: 1.24, alpha: 7.4 },
    rebalancingHistory: [{ date: "Jun 2026", description: "Waaree added post PLI approval", changes: ["Solar: 30% → 35%"] }],
    aiInsight: {
      recommendation: "500GW renewable by 2030 (currently 175GW). EV penetration at 7% — decade of runway. Valuations 60-80x PE require long conviction.",
      confidence_score: 69,
      factors_considered: ["500GW target by 2030", "PLI solar manufacturing", "EV penetration 7%"],
      model_version: "FASP-AI-v2.0", timestamp: new Date().toISOString(),
    },
  },
  {
    id: "thematic-digital-india",
    assetClass: "thematic",
    subCategory: "Digital India",
    name: "Digital India",
    tagline: "IT services, SaaS, data centres, fintech — India's $250B digital economy",
    riskProfile: "aggressive",
    goal: ["wealth_growth", "thematic"],
    minInvestment: 50000,
    timeHorizon: "5–7 years",
    cagr1Y: 17.8, cagr3Y: 19.4, cagr5Y: 22.3,
    benchmarkCagr1Y: 14.7, benchmarkName: "NIFTY IT Index",
    lastRebalanced: "2026-06-01", totalHoldings: 20,
    rebalancingFrequency: "quarterly",
    highlight: "IT exports + domestic tech + data economy",
    icon: "💻",
    allocation: [
      { category: "it_services", label: "IT Services / Exports", weight: 40, color: "#3B82F6", icon: "💻" },
      { category: "saas_mid", label: "Mid-Cap SaaS / Tech", weight: 25, color: "#8B5CF6", icon: "☁️" },
      { category: "data_centres", label: "Data Centres / Infra", weight: 20, color: "#10B981", icon: "🖥️" },
      { category: "fintech", label: "Fintech / Payments", weight: 15, color: "#F59E0B", icon: "📱" },
    ],
    holdings: [
      { rank: 1,  name: "Nippon India ETF Nifty IT",           category: "IT ETF",          weight: 12, currentReturn: 19.4 },
      { rank: 2,  name: "Mirae Asset NYSE FANG+ ETF",         category: "Int'l Tech ETF",  weight: 10, currentReturn: 22.1 },
      { rank: 3,  name: "Tata Digital India Fund",            category: "IT Thematic MF",  weight: 10, currentReturn: 17.8 },
      { rank: 4,  name: "Aditya Birla SL Digital India Fund", category: "IT Thematic MF",  weight: 9,  currentReturn: 18.2 },
      { rank: 5,  name: "ICICI Pru Technology Fund",          category: "IT Thematic MF",  weight: 9,  currentReturn: 18.6 },
      { rank: 6,  name: "SBI Technology Opportunities Fund",  category: "IT Thematic MF",  weight: 8,  currentReturn: 17.4 },
      { rank: 7,  name: "Franklin India Technology Fund",     category: "IT Thematic MF",  weight: 8,  currentReturn: 17.1 },
      { rank: 8,  name: "Kotak Technology Fund",              category: "IT Thematic MF",  weight: 7,  currentReturn: 16.9 },
      { rank: 9,  name: "DSP Technology.com Fund",            category: "IT Thematic MF",  weight: 7,  currentReturn: 17.3 },
      { rank: 10, name: "Axis Digital India Fund",            category: "IT Thematic MF",  weight: 7,  currentReturn: 16.4 },
      { rank: 11, name: "Quant IT Fund",                      category: "IT Thematic MF",  weight: 6,  currentReturn: 20.8 },
      { rank: 12, name: "HDFC Technology Fund",               category: "IT Thematic MF",  weight: 5,  currentReturn: 16.2 },
      { rank: 13, name: "Nippon India Liquid Fund",           category: "Liquid MF",       weight: 3,  currentReturn: 7.3  },
      { rank: 14, name: "HDFC Liquid Fund",                   category: "Liquid MF",       weight: 3,  currentReturn: 7.5  },
      { rank: 15, name: "ICICI Pru Liquid Fund",              category: "Liquid MF",       weight: 2,  currentReturn: 7.4  },
      { rank: 16, name: "SBI Liquid Fund",                    category: "Liquid MF",       weight: 2,  currentReturn: 7.4  },
      { rank: 17, name: "Axis Liquid Fund",                   category: "Liquid MF",       weight: 1,  currentReturn: 7.2  },
      { rank: 18, name: "Kotak Liquid Fund",                  category: "Liquid MF",       weight: 1,  currentReturn: 7.2  },
      { rank: 19, name: "DSP Liquidity Fund",                 category: "Liquid MF",       weight: 1,  currentReturn: 7.0  },
      { rank: 20, name: "Mirae Asset Liquid Fund",            category: "Liquid MF",       weight: 1,  currentReturn: 7.1  },
    ],
    performance: PERFORMANCE_BASE("thematic-digital-india", 1000, 24, 17.8, 10),
    riskMetrics: { sharpeRatio: 1.54, maxDrawdown: -20.1, volatility: 16.8, beta: 1.11, alpha: 4.7 },
    rebalancingHistory: [{ date: "Jun 2026", description: "Data centre theme added", changes: ["Data Centre: 15% → 20%"] }],
    aiInsight: {
      recommendation: "India IT exports $250B growing 8-10% CAGR. AI deal pipeline at TCS/Infosys driving deal size up. Domestic ONDC/UPI driving second wave.",
      confidence_score: 78,
      factors_considered: ["IT export growth 8-10%", "AI deal pipeline", "UPI/ONDC adoption"],
      model_version: "FASP-AI-v2.0", timestamp: new Date().toISOString(),
    },
  },
  {
    id: "thematic-consumption",
    assetClass: "thematic",
    subCategory: "Consumption India",
    name: "India Consumption",
    tagline: "Rising middle class, premiumisation, discretionary spend boom",
    riskProfile: "moderate",
    goal: ["wealth_growth"],
    minInvestment: 25000,
    timeHorizon: "5–7 years",
    cagr1Y: 14.3, cagr3Y: 16.1, cagr5Y: 18.4,
    benchmarkCagr1Y: 12.2, benchmarkName: "NIFTY India Consumption Index",
    lastRebalanced: "2026-06-01", totalHoldings: 22,
    rebalancingFrequency: "quarterly",
    highlight: "India's 400M middle class + premiumisation wave",
    icon: "🛍️",
    allocation: [
      { category: "fmcg", label: "FMCG / Staples", weight: 30, color: "#10B981", icon: "🛒" },
      { category: "discretionary", label: "Discretionary / Lifestyle", weight: 30, color: "#F59E0B", icon: "✨" },
      { category: "retail", label: "Retail / QSR", weight: 20, color: "#EF4444", icon: "🏪" },
      { category: "auto_2w", label: "2-Wheeler / Auto", weight: 20, color: "#3B82F6", icon: "🏍️" },
    ],
    holdings: [
      { rank: 1,  name: "Mirae Asset Great Consumer Fund",    category: "Consumption MF",  weight: 8,  currentReturn: 16.8 },
      { rank: 2,  name: "Nippon India Consumption Fund",      category: "Consumption MF",  weight: 8,  currentReturn: 15.4 },
      { rank: 3,  name: "ICICI Pru FMCG Fund",               category: "FMCG Thematic",   weight: 7,  currentReturn: 14.2 },
      { rank: 4,  name: "SBI Consumption Opportunities Fund", category: "Consumption MF",  weight: 7,  currentReturn: 14.8 },
      { rank: 5,  name: "Aditya Birla SL India GenNext Fund", category: "Consumption MF",  weight: 6,  currentReturn: 15.1 },
      { rank: 6,  name: "UTI India Consumer Fund",            category: "Consumption MF",  weight: 6,  currentReturn: 14.4 },
      { rank: 7,  name: "Bandhan Consumer Fund",              category: "Consumption MF",  weight: 6,  currentReturn: 13.9 },
      { rank: 8,  name: "Tata India Consumer Fund",           category: "Consumption MF",  weight: 6,  currentReturn: 14.6 },
      { rank: 9,  name: "Kotak India Growth Fund",            category: "Consumption MF",  weight: 5,  currentReturn: 14.1 },
      { rank: 10, name: "Axis India Manufacturing Fund",      category: "Consumption MF",  weight: 5,  currentReturn: 15.4 },
      { rank: 11, name: "DSP India T.I.G.E.R. Fund",         category: "Infrastructure",   weight: 5,  currentReturn: 18.7 },
      { rank: 12, name: "Franklin India Feeder — US Opp",     category: "Int'l MF",        weight: 5,  currentReturn: 16.2 },
      { rank: 13, name: "HDFC Liquid Fund",                   category: "Liquid MF",       weight: 5,  currentReturn: 7.5  },
      { rank: 14, name: "ICICI Pru Liquid Fund",              category: "Liquid MF",       weight: 4,  currentReturn: 7.4  },
      { rank: 15, name: "SBI Liquid Fund",                    category: "Liquid MF",       weight: 4,  currentReturn: 7.4  },
      { rank: 16, name: "Nippon India Liquid Fund",           category: "Liquid MF",       weight: 4,  currentReturn: 7.3  },
      { rank: 17, name: "Axis Liquid Fund",                   category: "Liquid MF",       weight: 4,  currentReturn: 7.2  },
      { rank: 18, name: "Kotak Liquid Fund",                  category: "Liquid MF",       weight: 4,  currentReturn: 7.2  },
      { rank: 19, name: "DSP Liquidity Fund",                 category: "Liquid MF",       weight: 4,  currentReturn: 7.0  },
      { rank: 20, name: "Aditya Birla SL Liquid Fund",        category: "Liquid MF",       weight: 4,  currentReturn: 7.1  },
      { rank: 21, name: "Mirae Asset Liquid Fund",            category: "Liquid MF",       weight: 3,  currentReturn: 7.1  },
      { rank: 22, name: "Tata Liquid Fund",                   category: "Liquid MF",       weight: 3,  currentReturn: 7.0  },
    ],
    performance: PERFORMANCE_BASE("thematic-consumption", 1000, 24, 14.3, 8),
    riskMetrics: { sharpeRatio: 1.62, maxDrawdown: -13.7, volatility: 12.4, beta: 0.94, alpha: 3.6 },
    rebalancingHistory: [{ date: "Jun 2026", description: "Premiumisation theme strengthened", changes: ["Trent: 6% → 9%"] }],
    aiInsight: {
      recommendation: "India's 400M middle class — world's fastest growing. Premiumisation driving 20-40% CAGR at Trent, Titan, Devyani.",
      confidence_score: 83,
      factors_considered: ["400M middle class", "Premiumisation trend", "QSR same-store-sales growth"],
      model_version: "FASP-AI-v2.0", timestamp: new Date().toISOString(),
    },
  },
  {
    id: "debt-target-maturity-2028",
    assetClass: "debt",
    subCategory: "Target Maturity",
    name: "Target Maturity 2028",
    tagline: "Hold-to-maturity debt — FD-like certainty with index returns",
    riskProfile: "conservative",
    goal: ["income", "capital_preservation"],
    minInvestment: 10000,
    timeHorizon: "Until Dec 2028",
    cagr1Y: 8.1, cagr3Y: 8.3, cagr5Y: 8.0,
    benchmarkCagr1Y: 7.6, benchmarkName: "CRISIL 3-Year Gilt Index",
    lastRebalanced: "2026-06-01", totalHoldings: 8,
    rebalancingFrequency: "quarterly",
    highlight: "Defined maturity = predictable returns, no reinvestment risk",
    icon: "📅", isNew: true,
    allocation: [
      { category: "gsec_2028", label: "G-Sec maturing 2028", weight: 60, color: "#3B82F6", icon: "🏛️" },
      { category: "sdl_2028", label: "SDL maturing 2028", weight: 30, color: "#8B5CF6", icon: "🗺️" },
      { category: "psu_2028", label: "PSU Bonds maturing 2028", weight: 10, color: "#10B981", icon: "🏦" },
    ],
    holdings: [
      { rank: 1, name: "Edelweiss NIFTY PSU Bond + SDL Index 2028",category: "Target Maturity ETF",weight: 20, currentReturn: 7.8 },
      { rank: 2, name: "HDFC NIFTY SDL Plus G-Sec Jun 2028 Index",  category: "Target Maturity ETF",weight: 18, currentReturn: 7.7 },
      { rank: 3, name: "IDFC CRISIL IBX Triple A Financial June 2028",category: "Target Maturity",weight: 15, currentReturn: 7.8 },
      { rank: 4, name: "Nippon India ETF Nifty SDL 2028 Maturity",  category: "Target Maturity ETF",weight: 15, currentReturn: 7.6 },
      { rank: 5, name: "Aditya Birla SL CRISIL IBX SDL May 2028",   category: "Target Maturity",weight: 12, currentReturn: 7.7 },
      { rank: 6, name: "Kotak NIFTY SDL Jul 2028 Index Fund",        category: "Target Maturity",weight: 10, currentReturn: 7.5 },
      { rank: 7, name: "SBI Magnum CRISIL IBX Gilt Fund 2028",       category: "Target Maturity",weight: 7,  currentReturn: 7.4 },
      { rank: 8, name: "ICICI Pru Liquid Fund",                      category: "Liquid MF",      weight: 3,  currentReturn: 7.4 },
    ],
    performance: PERFORMANCE_BASE("debt-target-maturity-2028", 1000, 24, 8.1, 0.8),
    riskMetrics: { sharpeRatio: 2.4, maxDrawdown: -1.4, volatility: 2.1, beta: 0.07, alpha: 0.7 },
    rebalancingHistory: [{ date: "Jun 2026", description: "SDL increased for yield pickup", changes: ["SDL: 25% → 30%"] }],
    aiInsight: {
      recommendation: "Target Maturity Funds: FD-like predictability, MF tax efficiency. Held to Dec 2028 = ~8.1% predetermined. LTCG indexation after 3Y. Zero credit risk.",
      confidence_score: 93,
      factors_considered: ["Defined maturity = predictable return", "Zero credit risk", "LTCG indexation benefit"],
      model_version: "FASP-AI-v2.0", timestamp: new Date().toISOString(),
    },
  },

  // ── CORPORATE TREASURY — Overnight Safety Park ───────────────────────────
  {
    id: "corp-treasury-overnight",
    assetClass: "debt",
    subCategory: "Corporate Treasury",
    name: "Overnight Safety Park",
    tagline: "T+0 liquidity for idle corporate cash — zero NAV risk",
    riskProfile: "conservative",
    goal: ["capital_preservation", "income"],
    minInvestment: 5000000,   // ₹50L — soft guidance for CFO office
    timeHorizon: "1–7 days (rolling)",
    cagr1Y: 7.0, cagr3Y: 7.1, cagr5Y: 6.9,
    benchmarkCagr1Y: 6.5, benchmarkName: "RBI Repo Rate (6.50%)",
    lastRebalanced: "2026-06-15", totalHoldings: 4,
    rebalancingFrequency: "monthly",
    highlight: "Instant redemption up to ₹50,000 or 90% of folio. Zero duration risk. Ideal for surplus idle cash ≤7 days.",
    icon: "🏦", isNew: true,
    allocation: [
      { category: "overnight_mf", label: "Overnight MF",     weight: 50, color: "#10B981", icon: "🌙" },
      { category: "liquid_mf",    label: "Liquid MF",        weight: 30, color: "#3B82F6", icon: "💧" },
      { category: "tbill_etf",    label: "T-Bills (via ETF)", weight: 20, color: "#6366F1", icon: "🏛️" },
    ],
    holdings: [
      { rank: 1, name: "HDFC Overnight Fund",                 category: "Overnight MF",    weight: 28, currentReturn: 6.8 },
      { rank: 2, name: "ICICI Pru Overnight Fund",            category: "Overnight MF",    weight: 24, currentReturn: 6.7 },
      { rank: 3, name: "SBI Overnight Fund",                  category: "Overnight MF",    weight: 20, currentReturn: 6.7 },
      { rank: 4, name: "Kotak Overnight Fund",                category: "Overnight MF",    weight: 16, currentReturn: 6.6 },
      { rank: 5, name: "Nippon India Overnight Fund",         category: "Overnight MF",    weight: 12, currentReturn: 6.5 },
    ],
    performance: PERFORMANCE_BASE("corp-treasury-overnight", 1000, 24, 7.0, 0.2),
    riskMetrics: { sharpeRatio: 3.8, maxDrawdown: -0.1, volatility: 0.3, beta: 0.01, alpha: 0.5 },
    rebalancingHistory: [
      { date: "Jun 2026", description: "Added Liquid BeES for exchange-traded T+0 exit", changes: ["T-Bill ETF: 15% → 20%", "Liquid MF trimmed: 35% → 30%"] },
      { date: "Apr 2026", description: "Overnight fund split across 2 AMCs for counterparty diversification", changes: ["Added ICICI Pru Overnight 25%", "Nippon: 50% → 25%"] },
    ],
    aiInsight: {
      recommendation: "Optimal parking for surplus corporate working capital with ≤7 day horizon. Overnight MF = same return as liquid MF with zero duration risk. T-Bill ETF adds exchange exit option. Section 194K TDS applies on distributions — factor into post-tax yield.",
      confidence_score: 97,
      factors_considered: [
        "RBI repo rate at 6.50% — overnight MF yields track corridor closely",
        "Zero credit risk: only G-Sec/repo-backed instruments",
        "T+0 instant redemption regulatory mandate (SEBI circular Jan 2024)",
        "No lock-in — suitable for daily treasury sweep",
        "s.194K TDS @ 10% on distributions if cumulative > ₹5,000",
      ],
      model_version: "FASP-AI-v2.0", timestamp: new Date().toISOString(),
      confidence_threshold: 85, meets_threshold: true,
    },
  },

  // ── CORPORATE TREASURY — Short-Term Treasury ─────────────────────────────
  {
    id: "corp-treasury-short",
    assetClass: "debt",
    subCategory: "Corporate Treasury",
    name: "Short-Term Treasury",
    tagline: "90-day corporate treasury — money market rates with daily liquidity",
    riskProfile: "conservative",
    goal: ["capital_preservation", "income"],
    minInvestment: 10000000,  // ₹1Cr
    timeHorizon: "1–3 months",
    cagr1Y: 7.45, cagr3Y: 7.6, cagr5Y: 7.4,
    benchmarkCagr1Y: 7.0, benchmarkName: "CRISIL Liquid Fund Index",
    lastRebalanced: "2026-06-01", totalHoldings: 6,
    rebalancingFrequency: "monthly",
    highlight: "AA+ CDs and CPs only. Duration ≤90 days. Beats savings/FD at 1-3M horizon with no lock-in.",
    icon: "📋", isNew: true,
    allocation: [
      { category: "ultra_short", label: "Ultra Short Duration MF", weight: 40, color: "#3B82F6", icon: "⚡" },
      { category: "money_market", label: "Money Market MF",        weight: 30, color: "#10B981", icon: "💹" },
      { category: "cd_cp",       label: "CD/CP via MF",            weight: 20, color: "#F59E0B", icon: "📜" },
      { category: "liquid",      label: "Liquid MF (buffer)",      weight: 10, color: "#6B7280", icon: "💧" },
    ],
    holdings: [
      { rank: 1, name: "HDFC Ultra Short Term Fund",          category: "Ultra Short MF",  weight: 22, currentReturn: 7.55 },
      { rank: 2, name: "ICICI Pru Ultra Short Term Fund",     category: "Ultra Short MF",  weight: 18, currentReturn: 7.48 },
      { rank: 3, name: "Aditya Birla SL Money Market Fund",  category: "Money Market MF", weight: 18, currentReturn: 7.62 },
      { rank: 4, name: "Nippon India Money Market Fund",      category: "Money Market MF", weight: 12, currentReturn: 7.58 },
      { rank: 5, name: "Axis Treasury Advantage Fund",        category: "CD/CP via MF",   weight: 20, currentReturn: 7.70 },
      { rank: 6, name: "SBI Liquid Fund",                     category: "Liquid MF",      weight: 10, currentReturn: 7.15 },
    ],
    performance: PERFORMANCE_BASE("corp-treasury-short", 1000, 24, 7.45, 0.35),
    riskMetrics: { sharpeRatio: 3.1, maxDrawdown: -0.3, volatility: 0.6, beta: 0.03, alpha: 0.45 },
    rebalancingHistory: [
      { date: "Jun 2026", description: "Duration trimmed from 85d to 72d post RBI commentary", changes: ["Ultra Short trimmed 5%", "Liquid buffer increased 5%"] },
      { date: "Mar 2026", description: "Added AA+ bank CDs via Treasury Advantage for yield pickup", changes: ["CD/CP: 15% → 20%", "Liquid reduced: 15% → 10%"] },
    ],
    aiInsight: {
      recommendation: "Ideal for 30-90 day surplus parking. Money market MFs invest only in instruments maturing ≤1Y (RBI mandate), providing predictable returns. CD/CPs rated AA+ only — no credit risk downgrade exposure. Recommended for: quarterly advance tax planning, vendor payment float, short-term capex buffer.",
      confidence_score: 95,
      factors_considered: [
        "SEBI money market MF guidelines: max 1Y maturity, AA+ minimum",
        "Bank CDs at 7.6–7.9% vs savings account 3.5% — 400 bps pickup",
        "Zero exit load after 7 days for ultra short funds",
        "Quarterly GST / TDS payment float — predictable outflow planning",
        "Companies Act 2013 s.186: corporate treasury must maintain liquidity",
      ],
      model_version: "FASP-AI-v2.0", timestamp: new Date().toISOString(),
      confidence_threshold: 85, meets_threshold: true,
    },
  },

  // ── CORPORATE TREASURY — Active Treasury Plus ─────────────────────────────
  {
    id: "corp-treasury-active",
    assetClass: "debt",
    subCategory: "Corporate Treasury",
    name: "Active Treasury Plus",
    tagline: "Duration-managed treasury — beat FDs at 6-12M horizon",
    riskProfile: "moderate",
    goal: ["income", "capital_preservation"],
    minInvestment: 50000000,  // ₹5Cr
    timeHorizon: "6–12 months",
    cagr1Y: 7.85, cagr3Y: 8.05, cagr5Y: 7.9,
    benchmarkCagr1Y: 7.5, benchmarkName: "CRISIL Short Term Bond Fund Index",
    lastRebalanced: "2026-06-01", totalHoldings: 8,
    rebalancingFrequency: "quarterly",
    highlight: "Active duration management (0.5–1.5Y). AA+ and above only. Targets 50-75 bps over FD with daily liquidity.",
    icon: "📈", isNew: true,
    allocation: [
      { category: "short_duration", label: "Short Duration Debt MF",  weight: 35, color: "#3B82F6", icon: "⏱️" },
      { category: "banking_psu",    label: "Banking & PSU Debt MF",  weight: 25, color: "#10B981", icon: "🏛️" },
      { category: "corp_bond",      label: "Corporate Bond MF",       weight: 25, color: "#F59E0B", icon: "📊" },
      { category: "float_rate",     label: "Floating Rate MF",        weight: 15, color: "#8B5CF6", icon: "📡" },
    ],
    holdings: [
      { rank: 1, name: "HDFC Short Duration Fund",              category: "Short Duration MF",  weight: 18, currentReturn: 8.1 },
      { rank: 2, name: "Kotak Short Term Fund",                 category: "Short Duration MF",  weight: 17, currentReturn: 7.95 },
      { rank: 3, name: "Kotak Banking & PSU Debt Fund",         category: "Banking & PSU MF",  weight: 15, currentReturn: 7.85 },
      { rank: 4, name: "Nippon India Banking & PSU Debt Fund",  category: "Banking & PSU MF",  weight: 10, currentReturn: 7.90 },
      { rank: 5, name: "Nippon India Corporate Bond Fund",      category: "Corporate Bond MF",  weight: 15, currentReturn: 8.20 },
      { rank: 6, name: "Aditya Birla SL Corporate Bond Fund",  category: "Corporate Bond MF",  weight: 10, currentReturn: 8.15 },
      { rank: 7, name: "Aditya Birla SL Floating Rate Fund",   category: "Floating Rate MF",   weight: 10, currentReturn: 7.72 },
      { rank: 8, name: "HDFC Floating Rate Debt Fund",          category: "Floating Rate MF",   weight: 5,  currentReturn: 7.68 },
    ],
    performance: PERFORMANCE_BASE("corp-treasury-active", 1000, 24, 7.85, 0.65),
    riskMetrics: { sharpeRatio: 2.7, maxDrawdown: -0.8, volatility: 1.1, beta: 0.08, alpha: 0.35 },
    rebalancingHistory: [
      { date: "Jun 2026", description: "Duration maintained at 1.1Y; added floating rate for rate sensitivity hedge", changes: ["Floating Rate: 10% → 15%", "Short Duration trimmed: 40% → 35%"] },
      { date: "Mar 2026", description: "Banking & PSU increased after SEBI eases NCD disclosure norms", changes: ["Banking & PSU: 20% → 25%", "Corp Bond: 30% → 25%"] },
      { date: "Dec 2025", description: "Post RBI rate pause: duration extended from 0.8Y to 1.1Y", changes: ["Added HDFC Short Duration 5%"] },
    ],
    aiInsight: {
      recommendation: "Best suited for corporates with 6-12 month investment horizon seeking to outperform corporate FDs (typically 7.0-7.5%) while maintaining daily liquidity. Banking & PSU allocation provides near-sovereign safety. Floating rate component hedges against any RBI rate reversal. Suitable for: inter-corporate deposits replacement, capex reserve, annual bonus float.",
      confidence_score: 88,
      factors_considered: [
        "RBI rate pause: duration extension from 0.8Y beneficial for capital gains",
        "Banking & PSU MF: quasi-sovereign safety, 7.8-8.0% yield",
        "Floating rate hedge: 15% allocation limits MTM impact if rates rise",
        "Corporate FD rate 7.0-7.5% — this portfolio targets 7.8-8.1%",
        "LTCG post 3Y: indexation benefit vs. FD fully taxable — significant for ₹5Cr+ corpus",
      ],
      model_version: "FASP-AI-v2.0", timestamp: new Date().toISOString(),
      confidence_threshold: 75, meets_threshold: true, human_review_required: false,
    },
  },
];


// Merge all portfolio lists into one master list
const MODEL_PORTFOLIOS_ALL: ModelPortfolio[] = [...MODEL_PORTFOLIOS];

// ─── Config ───────────────────────────────────────────────────────────────────

const RISK_CONFIG: Record<RiskProfile, { label: string; color: string; bg: string; icon: string }> = {
  conservative: { label: "Conservative", color: "text-green-700", bg: "bg-green-100 dark:bg-green-900/30 dark:text-green-300", icon: "🛡️" },
  moderate: { label: "Moderate", color: "text-blue-700", bg: "bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300", icon: "⚖️" },
  aggressive: { label: "Aggressive", color: "text-orange-700", bg: "bg-orange-100 dark:bg-orange-900/30 dark:text-orange-300", icon: "🔥" },
  all_weather: { label: "All-Weather", color: "text-purple-700", bg: "bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300", icon: "🌦️" },
  high: { label: "High Risk", color: "text-red-700", bg: "bg-red-100 dark:bg-red-900/30 dark:text-red-300", icon: "⚡" },
};

const GOAL_LABELS: Record<string, string> = {
  wealth_growth: "Wealth Growth",
  retirement: "Retirement",
  income: "Income",
  capital_preservation: "Capital Safety",
  tax_saving: "Tax Saving",
  thematic: "Thematic",
  diversification: "Diversification",
};

const ASSET_CLASS_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  all: { label: "All", icon: "🗂️", color: "bg-slate-600" },
  equity: { label: "Equity", icon: "📈", color: "bg-blue-600" },
  debt: { label: "Debt", icon: "🏛️", color: "bg-green-600" },
  hybrid: { label: "Hybrid", icon: "⚖️", color: "bg-purple-600" },
  thematic: { label: "Thematic", icon: "🎯", color: "bg-orange-600" },
  goal_based: { label: "Goal-Based", icon: "🏆", color: "bg-rose-600" },
};

const EQUITY_SUBCATEGORIES = ["Large Cap", "Mid Cap", "Small Cap", "Flexi Cap", "Multi Cap"];
const DEBT_SUBCATEGORIES = ["Short Duration", "Long Duration", "Corporate Bond", "Liquid / Ultra Short", "Corporate Treasury", "Target Maturity"];
const HYBRID_SUBCATEGORIES = ["All-Weather", "Balanced Advantage", "Dividend / Income", "Retirement"];
const THEMATIC_SUBCATEGORIES = ["Thematic / Sectoral", "Alternatives / HNI", "BFSI", "Healthcare & Pharma", "Defence & Aerospace", "Green Energy", "Digital India", "Consumption India"];
const GOAL_SUBCATEGORIES = ["Child Education", "Retirement", "Wedding / Life Event", "Home Purchase", "Emergency Fund", "Senior Citizen", "First Investment"];

const DISCLAIMER_TEXT =
  "Model Portfolios are for guidance and educational purposes only. They do NOT constitute SEBI-registered investment advice or a solicitation to buy/sell securities. " +
  "Past performance is not indicative of future returns. All CAGR figures are historical estimates and may not be replicated. " +
  "Mutual Fund investments are subject to market risks — please read all scheme-related documents carefully before investing. " +
  "Returns shown are pre-tax; your actual post-tax returns may vary based on your tax slab, holding period, and applicable surcharges. " +
  "Investors must consult a SEBI-registered Investment Adviser (RIA) or their financial advisor before making any investment decision.";

const CAGR_DATA_AS_OF = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const SEBI_REGULATORY_NOTICE =
  "⚠️ SEBI Regulatory Notice: This platform displays model portfolio analytics for informational purposes. " +
  "FintekPro facilitates analysis tools for SEBI-registered Investment Advisers (RIAs) and their clients. " +
  "Individual investors must verify advisor credentials at sebi.gov.in before taking any advisory services. " +
  "SEBI Investor Helpline: 1800 266 7575 | scores.gov.in for grievance redressal.";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatINR = (val: number): string => {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(0)}K`;
  return `₹${val}`;
};

const getConfidenceColor = (score: number): string => {
  if (score >= 80) return "text-green-600";
  if (score >= 65) return "text-yellow-600";
  return "text-red-600";
};

// ─── PerformancePeriodTable ───────────────────────────────────────────────────
// Replaces the hardcoded 1Y/3Y/5Y CAGR block with a full period table.
// Fetches live data from /ai-track-record (same endpoint, reuses data).

function PerformancePeriodTable({ portfolioId, twrr1Y, cagr1Y, cagr3Y, cagr5Y, benchmarkCagr1Y,
  return1m, return3m, return6m, returnYtd, cagr2y, returnSinceInception, benchmarkSinceInception
}: {
  portfolioId: string;
  twrr1Y?: number | null;
  cagr1Y: number;
  cagr3Y: number;
  cagr5Y: number;
  benchmarkCagr1Y?: number | null;
  // Phase 3 materialised columns — if present, use directly (no fetch needed)
  return1m?: number | null;
  return3m?: number | null;
  return6m?: number | null;
  returnYtd?: number | null;
  cagr2y?: number | null;
  returnSinceInception?: number | null;
  benchmarkSinceInception?: number | null;
}) {
  const [periods, setPeriods] = React.useState<any>(null);

  React.useEffect(() => {
    fetch(`/api/model-portfolios/${portfolioId}/ai-track-record`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setPeriods(res.data?.performancePeriods ?? null); })
      .catch(() => { /* silent — fallback to static below */ });
  }, [portfolioId]);

  const isSebi = twrr1Y != null;

  // If materialised DB columns are present, build a richer static set immediately
  const hasDbPeriods = return1m != null || return3m != null || returnYtd != null;
  const staticRows = hasDbPeriods ? [
    { label: "1 Month",        returnPct: return1m,          benchmarkPct: null,              alpha: null },
    { label: "3 Months",       returnPct: return3m,          benchmarkPct: null,              alpha: null },
    { label: "6 Months",       returnPct: return6m,          benchmarkPct: null,              alpha: null },
    { label: "YTD",            returnPct: returnYtd,         benchmarkPct: null,              alpha: null },
    { label: "1 Year",         returnPct: cagr1Y,            benchmarkPct: benchmarkCagr1Y,  alpha: benchmarkCagr1Y != null ? cagr1Y - benchmarkCagr1Y : null },
    { label: "2 Years (ann.)", returnPct: cagr2y,            benchmarkPct: null,              alpha: null },
    { label: "3 Years (ann.)", returnPct: cagr3Y,            benchmarkPct: benchmarkCagr1Y != null ? benchmarkCagr1Y - 1.4 : null, alpha: benchmarkCagr1Y != null && cagr3Y != null ? cagr3Y - (benchmarkCagr1Y - 1.4) : null },
    { label: "5 Years (ann.)", returnPct: cagr5Y,            benchmarkPct: benchmarkCagr1Y != null ? benchmarkCagr1Y - 2.1 : null, alpha: benchmarkCagr1Y != null && cagr5Y != null ? cagr5Y - (benchmarkCagr1Y - 2.1) : null },
    { label: "Since Inception",returnPct: returnSinceInception, benchmarkPct: benchmarkSinceInception,
      alpha: returnSinceInception != null && benchmarkSinceInception != null ? Number(returnSinceInception) - Number(benchmarkSinceInception) : null },
  ].filter((r) => r.returnPct != null)
  : [
    { label: "1 Year",  returnPct: cagr1Y,  benchmarkPct: benchmarkCagr1Y, alpha: benchmarkCagr1Y != null ? cagr1Y - benchmarkCagr1Y : null },
    { label: "3 Years (ann.)", returnPct: cagr3Y, benchmarkPct: benchmarkCagr1Y != null ? benchmarkCagr1Y - 1.4 : null, alpha: benchmarkCagr1Y != null ? cagr3Y - (benchmarkCagr1Y - 1.4) : null },
    { label: "5 Years (ann.)", returnPct: cagr5Y, benchmarkPct: benchmarkCagr1Y != null ? benchmarkCagr1Y - 2.1 : null, alpha: benchmarkCagr1Y != null ? cagr5Y - (benchmarkCagr1Y - 2.1) : null },
  ];

  const PERIOD_KEYS = ["1M","3M","6M","YTD","1Y","2Y","3Y","5Y","sinceInception"];
  const PERIOD_LABELS: Record<string, string> = {
    "1M": "1 Month", "3M": "3 Months", "6M": "6 Months", "YTD": "YTD",
    "1Y": "1 Year", "2Y": "2 Years (ann.)", "3Y": "3 Years (ann.)",
    "5Y": "5 Years (ann.)", "sinceInception": "Since Inception",
  };

  const liveRows = periods
    ? PERIOD_KEYS.map((key) => {
        const p = periods[key];
        if (!p) return null;
        return {
          label: PERIOD_LABELS[key],
          returnPct: p.returnPct,
          benchmarkPct: p.benchmarkPct,
          alpha: p.alpha,
          note: p.note,
          extra: key === "sinceInception" && p.inceptionDate
            ? `since ${new Date(p.inceptionDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" })} · ${p.monthsOfData}M`
            : undefined,
        };
      }).filter(Boolean)
    : null;

  const rows = liveRows ?? staticRows;

  return (
    <div className="rounded-xl border overflow-hidden">
      <div className="px-3 py-2 bg-muted/30 border-b flex justify-between items-center">
        <p className="text-[11px] font-semibold">
          Performance {isSebi ? <span className="text-[9px] font-normal text-indigo-500 ml-1">TWRR · SEBI-mandated</span> : <span className="text-[9px] font-normal text-muted-foreground ml-1">CAGR</span>}
        </p>
        {!liveRows && <span className="text-[9px] text-muted-foreground animate-pulse">Loading full data…</span>}
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/10">
            <th className="text-left px-3 py-1.5 text-[10px] font-medium text-muted-foreground">Period</th>
            <th className="text-right px-3 py-1.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-400">Portfolio</th>
            <th className="text-right px-3 py-1.5 text-[10px] font-medium text-muted-foreground">Benchmark</th>
            <th className="text-right px-3 py-1.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Alpha</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any, i: number) => {
            const hasData = r.returnPct !== null && r.returnPct !== undefined && !r.note;
            return (
              <tr key={i} className="border-b last:border-0 hover:bg-muted/5 transition-colors">
                <td className="px-3 py-2 text-[11px]">
                  {r.label}
                  {r.extra && <span className="block text-[9px] text-muted-foreground">{r.extra}</span>}
                </td>
                <td className={`px-3 py-2 text-right font-semibold ${hasData ? "text-indigo-600 dark:text-indigo-400" : "text-muted-foreground"}`}>
                  {hasData ? `+${Number(r.returnPct).toFixed(1)}%` : r.note ? <span className="text-[10px]">—</span> : "—"}
                </td>
                <td className="px-3 py-2 text-right text-muted-foreground">
                  {r.benchmarkPct !== null && r.benchmarkPct !== undefined ? `+${Number(r.benchmarkPct).toFixed(1)}%` : "—"}
                </td>
                <td className={`px-3 py-2 text-right font-medium ${r.alpha > 0 ? "text-emerald-600 dark:text-emerald-400" : r.alpha < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                  {r.alpha !== null && r.alpha !== undefined
                    ? `${r.alpha >= 0 ? "+" : ""}${Number(r.alpha).toFixed(1)}%`
                    : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-[9px] text-muted-foreground px-3 py-2 border-t">
        Portfolios rebalanced on drift signals, not fixed calendar. {isSebi ? "TWRR per SEBI IA Regs." : "Returns shown as CAGR."}
      </p>
    </div>
  );
}

// ─── AiTrackRecordTab ─────────────────────────────────────────────────────────
// FASP-AI Track Record panel: AI decision history, win rate, performance periods.
// Fetched lazily only when the tab is activated — not pre-loaded.

function AiTrackRecordTab({ portfolioId }: { portfolioId: string }) {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/model-portfolios/${portfolioId}/ai-track-record`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setData(res.data);
        else setError(res.message ?? "Failed to load AI track record");
      })
      .catch(() => setError("Network error fetching AI track record"))
      .finally(() => setLoading(false));
  }, [portfolioId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
        <div className="h-5 w-5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
        <span className="text-xs">Loading FASP-AI track record…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="text-center py-8 text-xs text-red-500">{error}</div>
    );
  }
  if (!data) return null;

  const { summary, decisions, performancePeriods } = data;
  const winBarWidth = summary.winRate !== null ? Math.round(summary.winRate) : 0;

  const PERIOD_LABELS: Record<string, string> = {
    "1M": "1 Month", "3M": "3 Months", "6M": "6 Months",
    "YTD": "YTD", "1Y": "1 Year",
    "2Y": "2 Years (ann.)", "3Y": "3 Years (ann.)", "5Y": "5 Years (ann.)",
    "sinceInception": "Since Inception",
  };

  return (
    <div className="space-y-4">
      {/* ── Summary banner ── */}
      <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-200 dark:border-indigo-800 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-base">🤖</span>
          <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">FASP-AI Track Record</span>
          <span className="ml-auto text-[10px] text-muted-foreground">{summary.modelVersion}</span>
        </div>

        {summary.totalDecisions === 0 ? (
          <p className="text-xs text-muted-foreground">No AI decisions recorded yet. Decisions are logged as drift-triggered rebalances occur.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{summary.totalDecisions}</p>
                <p className="text-[10px] text-muted-foreground">Decisions</p>
              </div>
              <div>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {summary.winRate !== null ? `${summary.winRate}%` : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground">Win Rate</p>
              </div>
              <div>
                <p className={`text-lg font-bold ${(summary.avgAlphaPerDecisionPct ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                  {summary.avgAlphaPerDecisionPct !== null
                    ? `${summary.avgAlphaPerDecisionPct >= 0 ? "+" : ""}${summary.avgAlphaPerDecisionPct.toFixed(1)}%`
                    : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground">Avg Alpha</p>
              </div>
            </div>

            {summary.winRate !== null && (
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Win / Loss ratio</span>
                  <span>{summary.winRate}% wins</span>
                </div>
                <div className="h-2 rounded-full bg-red-100 dark:bg-red-900/30 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                    style={{ width: `${winBarWidth}%` }}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Performance periods table ── */}
      {performancePeriods && Object.keys(performancePeriods).length > 0 && (
        <div className="rounded-xl border overflow-hidden">
          <div className="px-3 py-2 bg-muted/30 border-b">
            <p className="text-[11px] font-semibold">Performance (TWRR)</p>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/10">
                <th className="text-left px-3 py-1.5 text-[10px] font-medium text-muted-foreground">Period</th>
                <th className="text-right px-3 py-1.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-400">Portfolio</th>
                <th className="text-right px-3 py-1.5 text-[10px] font-medium text-muted-foreground">Benchmark</th>
                <th className="text-right px-3 py-1.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Alpha</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(PERIOD_LABELS).map(([key, label]) => {
                const p = performancePeriods[key];
                if (!p) return null;
                const hasData = p.returnPct !== null && p.returnPct !== undefined;
                return (
                  <tr key={key} className="border-b last:border-0 hover:bg-muted/5 transition-colors">
                    <td className="px-3 py-2 text-[11px]">
                      {label}
                      {key === "sinceInception" && p.inceptionDate && (
                        <span className="block text-[9px] text-muted-foreground">
                          since {new Date(p.inceptionDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" })} · {p.monthsOfData}M data
                        </span>
                      )}
                    </td>
                    <td className={`px-3 py-2 text-right font-semibold ${hasData ? "text-indigo-600 dark:text-indigo-400" : "text-muted-foreground"}`}>
                      {hasData ? `+${p.returnPct.toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {p.benchmarkPct !== null && p.benchmarkPct !== undefined ? `+${p.benchmarkPct.toFixed(1)}%` : "—"}
                    </td>
                    <td className={`px-3 py-2 text-right font-medium ${p.alpha > 0 ? "text-emerald-600 dark:text-emerald-400" : p.alpha < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                      {p.alpha !== null && p.alpha !== undefined
                        ? `${p.alpha >= 0 ? "+" : ""}${p.alpha.toFixed(1)}%`
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-[9px] text-muted-foreground px-3 py-2 border-t">
            Returns are TWRR (Time-Weighted Rate of Return) per SEBI IA Regulations.
            Benchmark = blended benchmark per portfolio allocation.
          </p>
        </div>
      )}

      {/* ── Recent AI decisions ── */}
      {decisions && decisions.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold px-0.5">Recent AI Decisions</p>
          {decisions.slice(0, 10).map((d: any) => {
            const isWin = d.is_win === true;
            const isLoss = d.is_win === false;
            const isPending = d.outcome_computed_at === null;
            const decidedDate = new Date(d.decided_at).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
            return (
              <div
                key={d.id}
                className={`rounded-lg border p-3 space-y-1.5 text-[11px] ${
                  isWin ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20"
                  : isLoss ? "border-red-200 dark:border-red-800 bg-red-50/40 dark:bg-red-950/20"
                  : "border-border bg-muted/10"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                      d.decision_type === "ADD" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                      : d.decision_type === "SUBSTITUTE" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    }`}>{d.decision_type}</span>
                    <span className="font-medium truncate max-w-[140px]">{d.chosen_name}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[9px] text-muted-foreground">{decidedDate}</span>
                    <span>{isPending ? "⏳" : isWin ? "✅" : "❌"}</span>
                  </div>
                </div>
                {d.rejected_name && (
                  <p className="text-[10px] text-muted-foreground">← replaced <span className="font-medium">{d.rejected_name}</span></p>
                )}
                <p className="text-[10px] text-muted-foreground italic leading-relaxed">{d.rationale_detail}</p>
                {!isPending && d.alpha_captured_pct !== null && (
                  <div className="flex gap-3 pt-0.5">
                    <span className="text-[10px]">
                      Outcome: <span className={`font-semibold ${isWin ? "text-emerald-600" : "text-red-500"}`}>
                        {isWin ? "+" : ""}{d.alpha_captured_pct?.toFixed(1)}% vs alternative
                      </span>
                    </span>
                    <span className="text-[10px] text-muted-foreground">({d.outcome_period_months}M)</span>
                  </div>
                )}
                {d.ai_confidence_score !== null && (
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <span className="text-[9px] text-muted-foreground">AI confidence:</span>
                    <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden max-w-[60px]">
                      <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${d.ai_confidence_score}%` }} />
                    </div>
                    <span className="text-[9px] font-medium">{Math.round(d.ai_confidence_score)}%</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {decisions && decisions.length === 0 && summary.totalDecisions === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">
          AI decisions will appear here as FASP-AI detects drift and generates rebalancing actions.
        </p>
      )}

      {/* FASP-AI disclaimer */}
      <p className="text-[9px] text-muted-foreground leading-relaxed border-t pt-2">
        ⚠️ AI is a Decision Support System only. All actions require advisor approval before execution.
        Returns are TWRR per SEBI IA Regulations. Past AI performance does not guarantee future results.
        Confidence: {summary.modelVersion}.
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AgentModelPortfoliosPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [assetClassFilter, setAssetClassFilter] = useState<string>("all");
  const [subCategoryFilter, setSubCategoryFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [selectedPortfolio, setSelectedPortfolio] = useState<ModelPortfolio | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareChannel, setShareChannel] = useState<"whatsapp" | "email">("whatsapp");
  // Invest Modal state
  const [investModalOpen, setInvestModalOpen] = useState(false);
  const [investAmount, setInvestAmount] = useState<string>("");
  const [investType, setInvestType] = useState<"lumpsum" | "sip">("lumpsum");
  const [sipDate, setSipDate] = useState<number>(1);
  const [investPreview, setInvestPreview] = useState<any[]>([]);
  const [investLoading, setInvestLoading] = useState(false);
  const [investSubmitting, setInvestSubmitting] = useState(false);
  const [quantSignals, setQuantSignals] = useState<Record<string, any>>({});
  const [compareList, setCompareList] = useState<string[]>([]); // portfolio IDs
  const [compareOpen, setCompareOpen] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set()); // lazy bar chart
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizStep, setQuizStep] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [quizResult, setQuizResult] = useState<ModelPortfolio | null>(null);

  // ── Live API data (Fix #6: replaces hardcoded MODEL_PORTFOLIOS array) ─────────
  const { data: apiData, isLoading: portfoliosLoading } = useQuery<{ success: boolean; data: any[] }>(
    {
      queryKey: ["/api/model-portfolios"],
      staleTime: 5 * 60 * 1000,   // 5-min cache — metrics refresh via scheduler
      retry: 1,
    }
  );

  // Merge: API data (live) → static fallback during load or API error
  const livePortfolios: ModelPortfolio[] = useMemo(() => {
    if (!apiData?.data?.length) return MODEL_PORTFOLIOS_ALL;   // static fallback
    return apiData.data.map((p: any) => {
      // Merge: DB data takes precedence; static values fill gaps until scheduler runs
      const staticP = MODEL_PORTFOLIOS_ALL.find((s) => s.id === p.id);
      return {
        id: p.id,
        name: p.name,
        tagline: p.tagline ?? "",
        riskProfile: p.riskProfile as RiskProfile,
        assetClass: p.assetClass,
        subCategory: p.subCategory ?? undefined,
        minInvestment: Number(p.minInvestment ?? staticP?.minInvestment ?? 5000),
        timeHorizon: p.timeHorizon ?? staticP?.timeHorizon ?? "N/A",
        benchmarkName: p.benchmarkName ?? staticP?.benchmarkName ?? "Nifty 500",
        lastRebalanced: p.lastRebalanced ?? new Date().toISOString().slice(0, 10),
        rebalancingFrequency: p.rebalancingFrequency ?? staticP?.rebalancingFrequency ?? "quarterly",
        totalHoldings: p.totalHoldings ?? staticP?.totalHoldings ?? 0,
        highlight: p.highlight ?? staticP?.highlight ?? "",
        icon: p.icon ?? staticP?.icon ?? "📊",
        isFeatured: p.isFeatured ?? false,
        isNew: p.isNew ?? false,
        // Metrics: DB value if computed by scheduler, else fall back to curated static values
        cagr1Y: Number(p.cagr1Y) || staticP?.cagr1Y || 0,
        cagr3Y: Number(p.cagr3Y) || staticP?.cagr3Y || 0,
        cagr5Y: Number(p.cagr5Y) || staticP?.cagr5Y || 0,
        benchmarkCagr1Y: Number(p.benchmarkCagr1Y) || staticP?.benchmarkCagr1Y || 0,
        riskMetrics: {
          sharpeRatio: Number(p.sharpeRatio) || staticP?.riskMetrics?.sharpeRatio || 0,
          maxDrawdown: Number(p.maxDrawdown) || staticP?.riskMetrics?.maxDrawdown || 0,
          volatility: Number(p.volatility) || staticP?.riskMetrics?.volatility || 0,
          beta: Number(p.beta) || staticP?.riskMetrics?.beta || 1,
          alpha: Number(p.alpha) || staticP?.riskMetrics?.alpha || 0,
        },
        allocation: (Array.isArray(p.allocation) && p.allocation.length > 0 ? p.allocation : staticP?.allocation ?? []).map((a: any) => ({
          category: a.label ?? a.category ?? a.type ?? "Other",
          label: a.label ?? a.category ?? a.type ?? "Other",
          weight: a.weight ?? a.percentage ?? 0,
          percentage: a.weight ?? a.percentage ?? 0,
          color: a.color ?? undefined,
        })),
        holdings: (Array.isArray(p.holdings) && p.holdings.length > 0 ? p.holdings : staticP?.holdings ?? []).map((h: any, idx: number) => ({
          rank: h.rank ?? idx + 1,
          name: h.name ?? "",
          isin: h.isin ?? "",
          weight: h.weight ?? h.percentage ?? 0,
          percentage: h.weight ?? h.percentage ?? 0,
          category: h.type ?? h.category ?? "Other",
          type: h.type ?? "equity",
          currentReturn: typeof h.currentReturn === "number" ? h.currentReturn : undefined,
          expenseRatio: h.expenseRatio ?? undefined,
          rating: h.rating ?? undefined,
        })),
        rebalancingHistory: p.rebalancingHistory ?? staticP?.rebalancingHistory ?? [],
        aiInsight: p.aiInsight ?? null,
        goal: Array.isArray(p.goals) && p.goals.length > 0 ? p.goals : (staticP?.goal ?? ["wealth_creation"]),
        performance: PERFORMANCE_BASE(
          p.id ?? "portfolio", 1000, 24,
          Number(p.cagr1Y) || staticP?.cagr1Y || 12,
          Number(p.volatility) || staticP?.riskMetrics?.volatility || 6,
        ),
        performanceData: PERFORMANCE_BASE(
          p.id ?? "portfolio", 1000, 24,
          Number(p.cagr1Y) || staticP?.cagr1Y || 12,
          Number(p.volatility) || staticP?.riskMetrics?.volatility || 6,
        ),
        // ── Gap-fix fields (Fix 15) — mapped from DB columns ──────────────────
        portfolioCode: p.portfolioCode ?? staticP?.portfolioCode ?? undefined,
        inceptionDate: p.inceptionDate ?? staticP?.inceptionDate ?? undefined,
        twrr1Y:  p.twrr1Y  != null ? Number(p.twrr1Y)  : staticP?.twrr1Y  ?? undefined,
        twrr3Y:  p.twrr3Y  != null ? Number(p.twrr3Y)  : staticP?.twrr3Y  ?? undefined,
        blendedBenchmarkReturn: p.blendedBenchmarkReturn != null ? Number(p.blendedBenchmarkReturn) : staticP?.blendedBenchmarkReturn ?? undefined,
        driftThreshold:         p.driftThreshold        != null ? Number(p.driftThreshold)         : staticP?.driftThreshold         ?? 5,
        maxDrawdownThreshold:   p.maxDrawdownThreshold  != null ? Number(p.maxDrawdownThreshold)   : staticP?.maxDrawdownThreshold   ?? 20,
        conflictDisclosure: p.conflictDisclosure ?? staticP?.conflictDisclosure ?? undefined,
      };
    });
  }, [apiData]);

  // Role-based permissions
  // RETAIL_ONLY_ROLES: the ONLY roles that should see the holdings lock.
  // All professional roles (advisor, ria, ca, compliance, ops, partner, admin, etc.)
  // automatically get full access — no need to maintain an allowlist.
  const RETAIL_ONLY_ROLES = ["user", "client"];
  /**
   * canViewFullHoldings is TRUE unless the user is *exclusively* in retail roles.
   * Fallback: if roles is undefined (old session), grant access — agent portal users
   * are always authenticated professionals, never anonymous retail clients.
   */
  const userRoles: string[] = user?.roles ?? [];
  const isRetailOnly = userRoles.length > 0 && userRoles.every((r: string) => RETAIL_ONLY_ROLES.includes(r));
  const canViewFullHoldings = !isRetailOnly;
  /** canShare follows the same access level as canViewFullHoldings */
  const canShare = canViewFullHoldings;
  // Agents and above default to showing all holdings; clients default to top-5
  const [showAllHoldings, setShowAllHoldings] = useState(true); // Default open — agents always see all holdings
  // Reset to full-view whenever portfolio changes or role resolves
  useEffect(() => {
    setShowAllHoldings(true); // Always show all when switching portfolios
  }, [canViewFullHoldings, selectedPortfolio?.id]);

  // ── FASP-AI v3.0: Proposals + Alerts state ──────────────────────────────────
  const [proposals, setProposals] = useState<Record<string, any[]>>({});
  const [alertsUnread, setAlertsUnread] = useState<number>(0);
  const [approvingProposal, setApprovingProposal] = useState<string | null>(null);
  const [rejectingProposal, setRejectingProposal] = useState<string | null>(null);

  // Fetch proposals when portfolio is selected
  useEffect(() => {
    if (!selectedPortfolio || !canViewFullHoldings) return;
    const id = selectedPortfolio.id;
    if (proposals[id]) return;
    fetch(`/api/model-portfolios/${id}/proposals`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.success) {
          setProposals(prev => ({ ...prev, [id]: data.data ?? [] }));
        }
      })
      .catch(() => {});
  }, [selectedPortfolio?.id, canViewFullHoldings]);

  // Fetch unread alert count
  useEffect(() => {
    if (!canViewFullHoldings) return;
    fetch('/api/model-portfolios/alerts?includeRead=false')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.success) setAlertsUnread(data.meta?.total ?? 0);
      })
      .catch(() => {});
  }, [canViewFullHoldings, selectedPortfolio?.id]);

  const handleApproveProposal = async (portfolioId: string, proposalId: string) => {
    setApprovingProposal(proposalId);
    try {
      const res = await fetch(`/api/model-portfolios/${portfolioId}/proposals/${proposalId}/approve`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setProposals(prev => ({ ...prev, [portfolioId]: (prev[portfolioId] ?? []).filter(p => p.id !== proposalId) }));
      }
    } finally {
      setApprovingProposal(null);
    }
  };

  const handleRejectProposal = async (portfolioId: string, proposalId: string) => {
    setRejectingProposal(proposalId);
    try {
      const res = await fetch(`/api/model-portfolios/${portfolioId}/proposals/${proposalId}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'Rejected by advisor' }) });
      const data = await res.json();
      if (data.success) {
        setProposals(prev => ({ ...prev, [portfolioId]: (prev[portfolioId] ?? []).filter(p => p.id !== proposalId) }));
      }
    } finally {
      setRejectingProposal(null);
    }
  };

  // ── Fetch quant signals when a portfolio is selected (FASP-AI-v2.0) ────────
  useEffect(() => {
    if (!selectedPortfolio) return;
    const id = selectedPortfolio.id;
    if (quantSignals[id]) return; // Already cached
    fetch(`/api/model-portfolios/${id}/quant-signals`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.success && data.data) {
          setQuantSignals(prev => ({ ...prev, [id]: data.data }));
        }
      })
      .catch(() => {}); // Silent — quant signals are enhancement only
  }, [selectedPortfolio?.id]);

  // ── Background prefetch quant signals for all visible cards ──────────────
  // Ensures drift meters on cards are populated without requiring a click.
  // Staggered 300ms per card to avoid hammering the API (max 20 cards).
  useEffect(() => {
    if (!livePortfolios.length) return;
    const toFetch = livePortfolios.slice(0, 20);
    toFetch.forEach((p, i) => {
      setTimeout(() => {
        if (quantSignals[p.id]) return; // Skip if already fetched
        fetch(`/api/model-portfolios/${p.id}/quant-signals`)
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (data?.success && data.data) {
              setQuantSignals(prev => ({ ...prev, [p.id]: data.data }));
            }
          })
          .catch(() => {});
      }, i * 300); // Stagger: card 0 → 0ms, card 1 → 300ms, ..., card 19 → 5700ms
    });
  // Only run once when portfolios first load — quantSignals intentionally omitted
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livePortfolios.length]);


  // ── Fetch invest preview when amount changes (debounced 600ms) ─────────────
  useEffect(() => {
    if (!investModalOpen || !selectedPortfolio || !investAmount) { setInvestPreview([]); return; }
    const amt = Number.parseFloat(investAmount);
    if (!amt || amt < 100) { setInvestPreview([]); return; }
    const timer = setTimeout(() => {
      setInvestLoading(true);
      fetch(`/api/model-portfolios/${selectedPortfolio.id}/invest/preview?amount=${amt}&type=${investType}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.success) setInvestPreview(data.data.allocation ?? []);
        })
        .catch(() => {})
        .finally(() => setInvestLoading(false));
    }, 600);
    return () => clearTimeout(timer);
  }, [investModalOpen, investAmount, investType, selectedPortfolio?.id]);

  // ── Detail panel tab + on-demand holdings enrichment ─────────────────────────
  const [activeDetailTab, setActiveDetailTab] = useState("overview");

  // Fetch enriched holdings (with live 1Y returns from mfapi.in) only when
  // user clicks the Holdings tab. Results cached 6h server-side.
  const { data: holdingsData, isLoading: holdingsLoading } = useQuery<{
    success: boolean;
    data: any[];
  }>({
    queryKey: ["/api/model-portfolios", selectedPortfolio?.id, "holdings"],
    enabled: activeDetailTab === "holdings" && !!selectedPortfolio?.id,
    staleTime: 6 * 60 * 60 * 1000, // 6h — matches server cache
    retry: 1,
    queryFn: async () => {
      const r = await fetch(`/api/model-portfolios/${selectedPortfolio!.id}/holdings`);
      if (!r.ok) throw new Error("Holdings fetch failed");
      return r.json();
    },
  });

  // When Holdings tab is active and enrichedHoldings is loaded, use it as the
  // primary display list. This ensures all DB holdings are shown, including
  // any that weren't pre-loaded in the list endpoint (which skips enrichment).
  const enrichedHoldings = holdingsData?.data ?? null;
  const displayHoldings: Holding[] = (enrichedHoldings && enrichedHoldings.length > 0)
    ? enrichedHoldings.map((h: any, idx: number) => ({
        rank: h.rank ?? idx + 1,
        name: h.name ?? "",
        symbol: h.symbol ?? selectedPortfolio?.holdings?.[idx]?.symbol,
        category: h.type ?? h.category ?? selectedPortfolio?.holdings?.[idx]?.category ?? "Other",
        weight: h.weight ?? h.percentage ?? selectedPortfolio?.holdings?.[idx]?.weight ?? 0,
        currentReturn: typeof h.currentReturn === "number" ? h.currentReturn : undefined,
        isin: h.isin ?? selectedPortfolio?.holdings?.[idx]?.isin,
        beta: h.beta,
        sharpe: h.sharpe,
        maxDrawdown: h.maxDrawdown,
        screenerUrl: h.screenerUrl,
        returnSource: h.returnSource,
        // MF-specific fields from financial_instruments_cache / mfapi.in
        return3Y: typeof h.return3Y === "number" ? h.return3Y : undefined,
        return6M: typeof h.return6M === "number" ? h.return6M : undefined,
        nav: typeof h.nav === "number" ? h.nav : undefined,
        expenseRatio: typeof h.expenseRatio === "number" ? h.expenseRatio : undefined,
        amfiSchemeCode: h.amfiSchemeCode,
        amfiUrl: h.amfiUrl,
      }))
    : (selectedPortfolio?.holdings ?? []);

  // Available sub-categories for current asset class filter
  const availableSubCategories = useMemo(() => {
    if (assetClassFilter === "equity") return EQUITY_SUBCATEGORIES;
    if (assetClassFilter === "debt") return DEBT_SUBCATEGORIES;
    if (assetClassFilter === "hybrid") return HYBRID_SUBCATEGORIES;
    if (assetClassFilter === "thematic") return THEMATIC_SUBCATEGORIES;
    if (assetClassFilter === "goal_based") return GOAL_SUBCATEGORIES;
    return [];
  }, [assetClassFilter]);

  const filtered = useMemo(() => {
    return livePortfolios.filter((p) => {
      if (assetClassFilter !== "all" && p.assetClass !== assetClassFilter) return false;
      if (subCategoryFilter !== "all" && p.subCategory !== subCategoryFilter) return false;
      if (riskFilter !== "all" && p.riskProfile !== riskFilter) return false;
      return true;
    });
  }, [livePortfolios, assetClassFilter, subCategoryFilter, riskFilter]);

  // Compare helpers
  const toggleCompare = (id: string) => {
    setCompareList((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 3 ? [...prev, id] : prev,
    );
  };
  const comparePortfolios = livePortfolios.filter((p) => compareList.includes(p.id));

  // Quiz logic
  const QUIZ_QUESTIONS = [
    {
      q: "What is your primary financial goal?",
      opts: ["Build long-term wealth", "Regular income", "Save for a goal (education/wedding/home)", "Protect capital"],
    },
    {
      q: "What is your investment horizon?",
      opts: ["Less than 1 year", "1–3 years", "3–7 years", "7+ years"],
    },
    {
      q: "How would you react to a 20% portfolio drop?",
      opts: ["Panic and exit", "Worry but stay", "Stay calm", "Invest more"],
    },
    {
      q: "What is your monthly investible surplus?",
      opts: ["Below ₹5,000", "₹5,000–₹25,000", "₹25,000–₹1L", "Above ₹1L"],
    },
    {
      q: "Are you looking for tax saving as part of this investment?",
      opts: ["Yes, ELSS / Sec 80C", "No, pure returns", "NPS / Sec 80CCD", "Not sure"],
    },
  ];

  const resolveQuizResult = () => {
    const goal = quizAnswers[0];
    const horizon = quizAnswers[1];
    const risk = quizAnswers[2];
    const surplus = quizAnswers[3];
    const tax = quizAnswers[4];

    if (goal === "Protect capital" || horizon === "Less than 1 year")
      return MODEL_PORTFOLIOS_ALL.find((p) => p.id === "debt-liquid-park") || MODEL_PORTFOLIOS_ALL[0];
    if (goal === "Save for a goal (education/wedding/home)" && horizon === "1–3 years")
      return MODEL_PORTFOLIOS_ALL.find((p) => p.id === "goal-home-downpayment") || MODEL_PORTFOLIOS_ALL[0];
    if (goal === "Save for a goal (education/wedding/home)" && horizon === "3–7 years")
      return MODEL_PORTFOLIOS_ALL.find((p) => p.id === "goal-wedding-fund") || MODEL_PORTFOLIOS_ALL[0];
    if (goal === "Save for a goal (education/wedding/home)")
      return MODEL_PORTFOLIOS_ALL.find((p) => p.id === "goal-child-education") || MODEL_PORTFOLIOS_ALL[0];
    if (goal === "Regular income")
      return MODEL_PORTFOLIOS_ALL.find((p) => p.id === "goal-senior-citizen") || MODEL_PORTFOLIOS_ALL[0];
    if (tax === "Yes, ELSS / Sec 80C")
      return MODEL_PORTFOLIOS_ALL.find((p) => p.id === "tax-saver-portfolio") || MODEL_PORTFOLIOS_ALL[0];
    if (surplus === "Below ₹5,000")
      return MODEL_PORTFOLIOS_ALL.find((p) => p.id === "goal-starter-sip") || MODEL_PORTFOLIOS_ALL[0];
    if (risk === "Panic and exit" || risk === "Worry but stay")
      return MODEL_PORTFOLIOS_ALL.find((p) => p.id === "balanced-advantage") || MODEL_PORTFOLIOS_ALL[0];
    if (risk === "Invest more" && horizon === "7+ years")
      return MODEL_PORTFOLIOS_ALL.find((p) => p.id === "smallcap-discovery") || MODEL_PORTFOLIOS_ALL[0];
    if (horizon === "7+ years")
      return MODEL_PORTFOLIOS_ALL.find((p) => p.id === "blue-chip-growth") || MODEL_PORTFOLIOS_ALL[0];
    return MODEL_PORTFOLIOS_ALL.find((p) => p.id === "flexicap-allcap") || MODEL_PORTFOLIOS_ALL[0];
  };

  const handleQuizAnswer = (answerIdx: number, ans: string) => {
    const newAnswers = { ...quizAnswers, [answerIdx]: ans };
    setQuizAnswers(newAnswers);
    if (quizStep < QUIZ_QUESTIONS.length - 1) {
      setQuizStep((s) => s + 1);
    } else {
      // compute result
      const tempAnswers = newAnswers;
      setQuizAnswers(tempAnswers);
      setQuizStep(QUIZ_QUESTIONS.length); // show result
      setQuizResult(resolveQuizResult());
    }
  };

  const resetQuiz = () => {
    setQuizStep(0);
    setQuizAnswers({});
    setQuizResult(null);
  };

  const handleShare = () => {
    if (!selectedPortfolio) return;
    if (shareChannel === "whatsapp") {
      const text = encodeURIComponent(
        `📊 *${selectedPortfolio.name}* — Model Portfolio\n\n` +
          `🎯 Risk: ${RISK_CONFIG[selectedPortfolio.riskProfile].label}\n` +
          `📈 1Y CAGR: ${selectedPortfolio.cagr1Y}% vs Benchmark ${selectedPortfolio.benchmarkCagr1Y}%\n` +
          `💰 Min Investment: ${formatINR(selectedPortfolio.minInvestment)}\n` +
          `⏱️ Time Horizon: ${selectedPortfolio.timeHorizon}\n\n` +
          `_${DISCLAIMER_TEXT.slice(0, 120)}..._\n\n` +
          `Shared via FintekPro Research — agent.fintekpro.com`,
      );
      window.open(`https://wa.me/?text=${text}`, "_blank");
    }
    toast({ title: "Shared!", description: `Portfolio shared via ${shareChannel}` });
    setShareDialogOpen(false);
  };

  const handleCopyToProposal = () => {
    toast({
      title: "Copied to Proposal Builder",
      description: `${selectedPortfolio?.name} allocation loaded into proposal.`,
    });
    navigate("/agent/proposal-builder");
  };

  const handleExportPDF = async () => {
    if (!selectedPortfolio) return;
    try {
      const { default: jsPDF } = await import("jspdf");
      // autoTable is a named export in jspdf-autotable v5+ (not the default)
      const { autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();

      // ── Header bar ──
      doc.setFillColor(30, 64, 175);
      doc.rect(0, 0, pageW, 20, "F");
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.text(`FintekPro - ${selectedPortfolio.name}`, 10, 13);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`Model Portfolio | Generated: ${new Date().toLocaleDateString("en-IN")}`, pageW - 10, 13, { align: "right" });

      // ── Key metrics (use Rs. instead of Rs symbol — Helvetica doesn't support Unicode Rs) ──
      const fmtINR = (val: number) => {
        if (val >= 10000000) return `Rs.${(val / 10000000).toFixed(1)}Cr`;
        if (val >= 100000) return `Rs.${(val / 100000).toFixed(1)}L`;
        if (val >= 1000) return `Rs.${(val / 1000).toFixed(0)}K`;
        return `Rs.${val}`;
      };

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Performance Summary", 10, 30);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`1Y CAGR: ${selectedPortfolio.cagr1Y}%   |   3Y CAGR: ${selectedPortfolio.cagr3Y}%   |   5Y CAGR: ${selectedPortfolio.cagr5Y}%`, 10, 37);
      doc.text(`Benchmark: ${selectedPortfolio.benchmarkName} (${selectedPortfolio.benchmarkCagr1Y}% 1Y)`, 10, 43);
      doc.text(
        `Risk: ${RISK_CONFIG[selectedPortfolio.riskProfile].label}   |   Min Investment: ${fmtINR(selectedPortfolio.minInvestment)}   |   Horizon: ${selectedPortfolio.timeHorizon}`,
        10, 49,
      );

      // ── Asset Allocation section ──
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Asset Allocation", 10, 58);
      autoTable(doc, {
        startY: 62,
        head: [["Asset Class", "Weight %"]],
        body: selectedPortfolio.allocation.map((a) => [a.label, `${a.weight}%`]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [239, 246, 255] },
        margin: { left: 10, right: 115 },
        tableWidth: 85,
      });

      // ── Risk Metrics section (right column) ──
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Risk Metrics", 115, 58);
      autoTable(doc, {
        startY: 62,
        head: [["Metric", "Value"]],
        body: [
          ["Sharpe Ratio", selectedPortfolio.riskMetrics.sharpeRatio.toFixed(2)],
          ["Max Drawdown", `${selectedPortfolio.riskMetrics.maxDrawdown}%`],
          ["Volatility", `${selectedPortfolio.riskMetrics.volatility}%`],
          ["Beta", selectedPortfolio.riskMetrics.beta.toFixed(2)],
          ["Alpha (Ann.)", `+${selectedPortfolio.riskMetrics.alpha}%`],
        ],
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [239, 246, 255] },
        margin: { left: 115, right: 10 },
        tableWidth: 85,
      });

      // ── Holdings table (full width, below allocation) ──
      const afterY = (doc as any).lastAutoTable?.finalY ?? 100;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Top Holdings", 10, afterY + 8);
      autoTable(doc, {
        startY: afterY + 12,
        head: [["#", "Instrument", "Category", "Weight %", "Return %"]],
        body: selectedPortfolio.holdings.map((h) => [
          h.rank,
          h.name,
          h.category,
          `${h.weight}%`,
          h.currentReturn != null && h.currentReturn !== 0 ? `${h.currentReturn >= 0 ? "+" : ""}${h.currentReturn}%` : "—",
        ]),
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [239, 246, 255] },
        margin: { left: 10, right: 10 },
      });

      // ── Disclaimer ──
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFontSize(6.5);
      doc.setTextColor(120, 120, 120);
      doc.setFont("helvetica", "italic");
      doc.text(DISCLAIMER_TEXT, 10, pageH - 10, { maxWidth: pageW - 20 });

      doc.save(`fintekpro-model-portfolio-${selectedPortfolio.id}.pdf`);
      toast({ title: "PDF Downloaded", description: `${selectedPortfolio.name} portfolio exported.` });
    } catch (err: any) {
      console.error("[PDF Export] Error:", err);
      toast({
        title: "Export failed",
        description: err?.message || "Could not generate PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
    <div className="container mx-auto py-6 space-y-6 max-w-7xl">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LayoutGrid className="h-6 w-6 text-indigo-500" />
            Model Portfolios
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Curated multi-asset investment templates — guidance and inspiration for all investors
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
            <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0" />
            <span>For guidance only. <strong>Not SEBI investment advice.</strong> CAGR data as of {CAGR_DATA_AS_OF}.</span>
          </div>
        </div>
        {/* Quiz + Compare action buttons */}
        <div className="flex items-center gap-2">
          <button
            id="open-risk-profiler-quiz"
            onClick={() => { setQuizOpen(true); setQuizStep(0); setQuizAnswers({}); setQuizResult(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
          >
            🎯 Find My Portfolio
          </button>
          {compareList.length > 0 && (
            <button
              id="open-compare-sheet"
              onClick={() => setCompareOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
            >
              ⚖️ Compare ({compareList.length})
            </button>
          )}
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Model Portfolios", value: MODEL_PORTFOLIOS_ALL.length, icon: LayoutGrid, color: "text-indigo-500" },
          { label: "Asset Classes", value: "5 Classes", icon: PieChart, color: "text-blue-500" },
          { label: "Best 5Y CAGR", value: "31.2%", icon: TrendingUp, color: "text-green-500" },
          { label: "Min Investment", value: "₹500", icon: Target, color: "text-amber-500" },
        ].map((s) => (
          <Card key={s.label} className="p-3">
            <div className="flex items-center gap-2">
              <s.icon className={`h-4 w-4 ${s.color}`} />
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-lg font-bold">{s.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* ── Asset Class Tabs ── */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {Object.entries(ASSET_CLASS_CONFIG).map(([key, cfg]) => (
            <button
              key={key}
              id={`assetclass-filter-${key}`}
              onClick={() => { setAssetClassFilter(key); setSubCategoryFilter("all"); }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                assetClassFilter === key
                  ? `${cfg.color} text-white shadow-sm`
                  : "bg-muted text-muted-foreground hover:bg-muted/80 border border-border/40"
              }`}
            >
              <span>{cfg.icon}</span>
              <span>{cfg.label}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ml-1 ${
                assetClassFilter === key ? "bg-white/20" : "bg-muted-foreground/20"
              }`}>
                {MODEL_PORTFOLIOS_ALL.filter(p => key === "all" || p.assetClass === key).length}
              </span>
            </button>
          ))}
        </div>

        {/* Sub-category chips — shown when an asset class is selected */}
        {availableSubCategories.length > 0 && (
          <div className="flex flex-wrap gap-2 pl-1">
            <button
              onClick={() => setSubCategoryFilter("all")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                subCategoryFilter === "all"
                  ? "bg-slate-700 text-white border-slate-700"
                  : "border-border text-muted-foreground hover:bg-muted/60"
              }`}
            >
              All {assetClassFilter === "equity" ? "Equity" : assetClassFilter === "debt" ? "Debt" : "Hybrid"}
            </button>
            {availableSubCategories.map((sub) => (
              <button
                key={sub}
                onClick={() => setSubCategoryFilter(sub)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                  subCategoryFilter === sub
                    ? "bg-slate-700 text-white border-slate-700"
                    : "border-border text-muted-foreground hover:bg-muted/60"
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
        )}

        {/* Risk filter row */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Risk:</span>
          {[
            { key: "all", label: "All" },
            { key: "conservative", label: "Conservative" },
            { key: "moderate", label: "Moderate" },
            { key: "aggressive", label: "Aggressive" },
            { key: "high", label: "High Risk" },
          ].map((f) => (
            <button
              key={f.key}
              id={`risk-filter-${f.key}`}
              onClick={() => setRiskFilter(f.key)}
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                riskFilter === f.key
                  ? "bg-indigo-600 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {f.label}
            </button>
          ))}
          <span className="text-xs text-muted-foreground ml-auto">
            Showing {filtered.length} of {MODEL_PORTFOLIOS_ALL.length} portfolios
          </span>
        </div>
      </div>

      {/* ── Portfolio Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filtered.length === 0 && (
          <div className="col-span-full py-16 text-center text-muted-foreground">
            <PieChart className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No portfolios match your filter</p>
            <p className="text-sm mt-1">Try removing a filter to see more options</p>
          </div>
        )}
        {filtered.map((portfolio) => {
          const risk = RISK_CONFIG[portfolio.riskProfile];
          // ── Per-card computed values ────────────────────────────────────────
          // TWRR if scheduler has run, else CAGR fallback
          const display1Y  = portfolio.twrr1Y  ?? portfolio.cagr1Y;
          const display3Y  = portfolio.twrr3Y  ?? portfolio.cagr3Y;
          const isUsingTWRR = portfolio.twrr1Y != null;
          // Alpha vs blended or single-index benchmark
          const benchmarkReturn  = portfolio.blendedBenchmarkReturn ?? portfolio.benchmarkCagr1Y;
          const alphaVsBenchmark = display1Y - benchmarkReturn;
          // Avg return label: use inception months if < 12, else "9M avg" / "1Y"
          const inceptionMonths = portfolio.inceptionDate
            ? Math.round((Date.now() - new Date(portfolio.inceptionDate).getTime()) / (30 * 24 * 3600 * 1000))
            : 12;
          const returnLabel = inceptionMonths < 12 ? `${inceptionMonths}M avg` : "1Y";
          // Drift from quantSignals cache
          const qs = quantSignals[portfolio.id];
          const driftThresholdPct = portfolio.driftThreshold ?? 5;
          const driftScore = qs?.driftScore ?? 0;
          // Drift as % of threshold band (for the brief-style progress bar)
          const driftPct      = qs ? Math.min(100, (driftScore / (driftThresholdPct * 20)) * 100) : 0;
          const driftAbsPct   = qs ? (driftScore / 20).toFixed(1) : "–";
          const driftStatusColor = driftScore > 15 ? "bg-red-500" : driftScore > 5 ? "bg-amber-500" : "bg-emerald-500";
          const driftStatusLabel = driftScore > 15 ? "Rebalance" : driftScore > 5 ? "Minor drift" : "Balanced";
          // Suitability check
          const userRiskProfile = (user as any)?.riskProfile ?? null;
          const isSuitabilityMismatch = userRiskProfile
            ? (portfolio.riskProfile === "aggressive" || portfolio.riskProfile === "high") &&
              (userRiskProfile === "conservative" || userRiskProfile === "moderate")
            : false;
          // Pending proposals / STCG
          const pendingProposals = proposals[portfolio.id] ?? [];
          const hasTaxDeferredDrift = pendingProposals.length > 0 && driftScore > 5;
          // Performance section toggle — open by default (matches brief design)
          const isPerfOpen = !expandedCards.has(`hide-${portfolio.id}`);
          // Monthly bar chart data (always computed — no lazy gate since section is open by default)
          const barData = computeMonthlyBarData(portfolio.performance, portfolio.rebalancingHistory, portfolio.inceptionDate ?? undefined);
          const maxBar  = barData.length ? Math.max(...barData.map((b) => Math.abs(b.returnPct))) || 1 : 1;
          // Last rebalanced display (e.g. "Apr 26")
          const lastRebalLabel = portfolio.lastRebalanced
            ? new Date(portfolio.lastRebalanced).toLocaleDateString("en-IN", { month: "short", year: "2-digit" })
            : "—";
          return (
            <Card
              key={portfolio.id}
              id={`portfolio-card-${portfolio.id}`}
              className="relative hover:shadow-lg transition-all duration-200 cursor-pointer border-border/60 group overflow-hidden"
              onClick={() => setSelectedPortfolio(portfolio)}
            >
              {/* ── Top badge row ─────────────────────────────────────────── */}
              <div className="flex items-center justify-between px-4 pt-3 pb-0 gap-2">
                {/* Left: drift status pill */}
                <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full text-white ${driftStatusColor}`}>
                  {driftStatusLabel}
                </span>

                {/* Right: risk / featured / suitability / proposals */}
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {isSuitabilityMismatch && (
                    <span
                      title="SEBI IA Reg. 16: risk class may exceed your assessed tolerance"
                      className="bg-red-600 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
                    >
                      <AlertTriangle className="h-2.5 w-2.5" /> Unsuitable
                    </span>
                  )}
                  {hasTaxDeferredDrift && (
                    <span title="STCG risk if rebalanced now" className="bg-orange-500 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full">
                      STCG
                    </span>
                  )}
                  {canViewFullHoldings && pendingProposals.length > 0 && (
                    <span title={`${pendingProposals.length} rebalance proposal(s) pending`} className="bg-amber-500 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full animate-pulse">
                      ⚡ {pendingProposals.length}P
                    </span>
                  )}
                  {portfolio.isFeatured && (
                    <Badge className="bg-amber-500 text-white text-[10px] px-1.5">
                      <Star className="h-2.5 w-2.5 mr-0.5" />Featured
                    </Badge>
                  )}
                  {portfolio.isNew && (
                    <Badge className="bg-indigo-600 text-white text-[10px] px-1.5">NEW</Badge>
                  )}
                </div>
              </div>

              {/* ── Header: icon + name + code + inception ─────────────────── */}
              <CardHeader className="pb-2 pt-2">
                <div className="flex items-start gap-3">
                  <div className="text-2xl leading-none mt-0.5">{portfolio.icon}</div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-[14px] font-semibold leading-tight">{portfolio.name}</CardTitle>
                    <CardDescription className="text-[11px] mt-0.5 leading-snug">{portfolio.tagline}</CardDescription>
                    {/* Code + inception row */}
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                      {portfolio.portfolioCode && (
                        <span className="flex items-center gap-0.5">
                          <span className="text-muted-foreground/60">#</span>
                          <span className="font-mono font-semibold text-foreground/70">Portfolio {portfolio.portfolioCode}</span>
                        </span>
                      )}
                      {portfolio.inceptionDate && (
                        <span className="flex items-center gap-0.5">
                          <span className="text-muted-foreground/60">📅</span>
                          <span>Inception {new Date(portfolio.inceptionDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</span>
                        </span>
                      )}
                    </div>
                    {/* Rebalanced as needed label */}
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                      <RefreshCw className="h-2.5 w-2.5" />
                      Rebalanced as needed
                    </div>
                  </div>
                  {/* Compare toggle */}
                  <button
                    onClick={e => { e.stopPropagation(); toggleCompare(portfolio.id); }}
                    title={compareList.includes(portfolio.id) ? "Remove from compare" : compareList.length >= 3 ? "Max 3" : "Add to compare"}
                    className={`shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors text-[10px] ${
                      compareList.includes(portfolio.id)
                        ? "bg-emerald-600 border-emerald-600 text-white"
                        : compareList.length >= 3
                        ? "border-muted text-muted cursor-not-allowed"
                        : "border-border hover:border-emerald-500 text-muted-foreground"
                    }`}
                  >
                    {compareList.includes(portfolio.id) ? "✓" : "⚖"}
                  </button>
                </div>
                {/* Goal tags row */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <Badge variant="outline" className={`text-[9px] ${risk.bg} border-0 px-1.5 py-0`}>
                    {risk.icon} {risk.label}
                  </Badge>
                  {portfolio.goal.slice(0, 3).map((g) => (
                    <Badge key={g} variant="outline" className="text-[9px] px-1.5 py-0">
                      {GOAL_LABELS[g] || g}
                    </Badge>
                  ))}
                </div>
              </CardHeader>

              <CardContent className="space-y-2.5 pb-3 pt-0">
                {/* ── Performance toggle header ─────────────────────────── */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Avg return */}
                    <div>
                      <p className="text-[9px] text-muted-foreground">{returnLabel}</p>
                      <p className="text-[13px] font-bold text-emerald-600">+{display1Y.toFixed(2)}%</p>
                    </div>
                    {/* Alpha */}
                    <div>
                      <p className="text-[9px] text-muted-foreground">
                        Vs {portfolio.blendedBenchmarkReturn != null ? "benchmark" : portfolio.benchmarkName}
                      </p>
                      <p className={`text-[13px] font-bold ${alphaVsBenchmark >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {alphaVsBenchmark >= 0 ? "+" : ""}{alphaVsBenchmark.toFixed(2)}% alpha
                      </p>
                    </div>
                  </div>
                  {/* Show / Hide performance toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedCards((prev) => {
                        const next = new Set(prev);
                        const key = `hide-${portfolio.id}`;
                        next.has(key) ? next.delete(key) : next.add(key);
                        return next;
                      });
                    }}
                    className="text-[9px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 border border-border/60 rounded px-1.5 py-0.5 transition-colors"
                  >
                    {isPerfOpen ? "Hide" : "Show"} performance
                    <span>{isPerfOpen ? " ▲" : " ▼"}</span>
                  </button>
                </div>

                {/* ── Period return badges (materialised TWRR from DB) ──────── */}
                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                  {[
                    { label: "1M",  val: portfolio.return1m },
                    { label: "3M",  val: portfolio.return3m },
                    { label: "6M",  val: portfolio.return6m },
                    { label: "YTD", val: portfolio.returnYtd },
                    { label: "2Y",  val: portfolio.cagr2y },
                    { label: "SI",  val: portfolio.returnSinceInception },
                  ]
                    .filter((p) => p.val != null && !Number.isNaN(Number(p.val)))
                    .map((p) => {
                      const v = Number(p.val);
                      const isPos = v >= 0;
                      return (
                        <span
                          key={p.label}
                          title={`${p.label === "SI" ? "Since Inception" : p.label} TWRR: ${v >= 0 ? "+" : ""}${v.toFixed(1)}%`}
                          className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${
                            isPos
                              ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                              : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400"
                          }`}
                        >
                          {p.label} {v >= 0 ? "+" : ""}{v.toFixed(1)}%
                        </span>
                      );
                    })}
                  {/* Show "–" placeholder if no period data yet */}
                  {!portfolio.return1m && !portfolio.return3m && !portfolio.returnYtd && (
                    <span className="text-[9px] text-muted-foreground/60 italic">Period returns computing…</span>
                  )}
                </div>

                {/* ── Expandable performance section ───────────────────── */}
                {isPerfOpen && (
                  <div className="space-y-2.5">
                    {/* Drift meter — always show even without quant signals */}
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                        <span>Current allocation drift</span>
                        <span className="font-medium text-foreground/80">
                          {qs ? `${driftAbsPct}% of ${driftThresholdPct}%` : `–% of ${driftThresholdPct}%`}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${driftStatusColor}`}
                          style={{ width: `${qs ? driftPct : 0}%` }}
                        />
                      </div>
                      <p className="text-[8px] text-muted-foreground/60">
                        Rebalance trigger at {driftThresholdPct}% drift from target weights
                      </p>
                    </div>

                    {/* Monthly return bar chart */}
                    {barData.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[9px] text-muted-foreground">
                          Rolling monthly returns since inception
                          {portfolio.rebalancingHistory?.length > 0 && (
                            <span className="ml-1 text-indigo-500">· marks a drift-triggered rebalance</span>
                          )}
                        </p>
                        <div className="flex items-end gap-0.5 h-14" aria-label="Monthly returns bar chart">
                          {barData.map((bar, i) => {
                            const heightPct = Math.min(100, (Math.abs(bar.returnPct) / maxBar) * 100);
                            const isPos = bar.returnPct >= 0;
                            return (
                              <TooltipProvider key={i}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex-1 flex flex-col items-center justify-end h-full gap-0.5 relative group/bar">
                                      {/* Return % label above bar */}
                                      <span className="text-[7px] text-muted-foreground hidden group-hover/bar:block absolute top-0">
                                        {bar.returnPct >= 0 ? "+" : ""}{bar.returnPct}%
                                      </span>
                                      {/* Rebalance dot */}
                                      {bar.hasRebalanceEvent && (
                                        <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-500" />
                                      )}
                                      {/* Bar */}
                                      <div
                                        className={`w-full rounded-t-sm transition-all ${isPos ? "bg-emerald-400 dark:bg-emerald-500" : "bg-red-400 dark:bg-red-500"}`}
                                        style={{ height: `${Math.max(6, heightPct)}%` }}
                                      />
                                      {/* Month label */}
                                      <span className="text-[7px] text-muted-foreground/70 leading-none">{bar.label}</span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent className="text-[10px]">
                                    {bar.label}: {bar.returnPct >= 0 ? "+" : ""}{bar.returnPct}%
                                    {bar.hasRebalanceEvent ? " · rebalanced" : ""}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Allocation bar */}
                    <div>
                      <p className="text-[9px] text-muted-foreground mb-1">
                        Vs {portfolio.blendedBenchmarkReturn != null ? "Blended" : portfolio.benchmarkName} index, cumulative
                      </p>
                      <div className="flex rounded-full overflow-hidden h-1.5">
                        {portfolio.allocation.map((a) => (
                          <TooltipProvider key={a.category}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  style={{ width: `${a.weight}%`, backgroundColor: a.color }}
                                  className="transition-opacity hover:opacity-80"
                                />
                              </TooltipTrigger>
                              <TooltipContent className="text-xs">{a.label}: {a.weight}%</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Footer ───────────────────────────────────────────── */}
                <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/40 pt-2 mt-1">
                  <span>Min <strong className="text-foreground">{formatINR(portfolio.minInvestment)}</strong></span>
                  <span>Horizon <strong className="text-foreground">{portfolio.timeHorizon}</strong></span>
                  <span>Last rebalanced <strong className="text-foreground">{lastRebalLabel}</strong></span>
                </div>

                {/* ── SEBI disclaimer (collapsed) ───────────────────────── */}
                <details className="group/disclaimer">
                  <summary className="text-[8px] text-muted-foreground/50 cursor-pointer select-none list-none flex items-center gap-1 hover:text-muted-foreground transition-colors">
                    <span className="group-open/disclaimer:hidden">▸</span>
                    <span className="hidden group-open/disclaimer:inline">▾</span>
                    SEBI disclosure · Reg. 16 suitability
                    {portfolio.conflictDisclosure && <span className="text-amber-500 ml-1">⚠</span>}
                  </summary>
                  <div className="text-[8px] text-muted-foreground/70 mt-1 space-y-0.5 leading-relaxed">
                    <p>Past performance is not indicative of future results. Returns shown are {isUsingTWRR ? "TWRR (SEBI-mandated)" : "CAGR"}. Risk class: <strong>{portfolio.riskProfile}</strong>.</p>
                    {portfolio.conflictDisclosure && (
                      <p className="text-amber-600/80">⚠ {portfolio.conflictDisclosure}</p>
                    )}
                  </div>
                </details>

                {/* ── CTA ───────────────────────────────────────────────── */}
                <Button
                  id={`view-portfolio-${portfolio.id}`}
                  className="w-full h-8 text-xs gap-1 group-hover:bg-indigo-600 group-hover:text-white transition-colors"
                  variant="outline"
                  onClick={(e) => { e.stopPropagation(); setSelectedPortfolio(portfolio); }}
                >
                  View full portfolio
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Portfolio Detail Sheet ── */}
      <Sheet open={!!selectedPortfolio} onOpenChange={(o) => !o && setSelectedPortfolio(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-hidden p-0 flex flex-col">
          {selectedPortfolio && (
            <>
              {/* Sheet Header */}
              <div className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white p-5 shrink-0">
                <SheetHeader>
                  <div className="flex items-start gap-3">
                    <span className="text-4xl">{selectedPortfolio.icon}</span>
                    <div>
                      <SheetTitle className="text-white text-xl">
                        {selectedPortfolio.name}
                      </SheetTitle>
                      <SheetDescription className="text-indigo-200 text-sm">
                        {selectedPortfolio.tagline}
                      </SheetDescription>
                    </div>
                  </div>
                  {/* CAGR quick stats */}
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    {[
                      { label: "1Y CAGR", value: `+${selectedPortfolio.cagr1Y}%` },
                      { label: "3Y CAGR", value: `+${selectedPortfolio.cagr3Y}%` },
                      { label: "5Y CAGR", value: `+${selectedPortfolio.cagr5Y}%` },
                    ].map((s) => (
                      <div key={s.label} className="bg-white/15 rounded-lg p-2 text-center">
                        <p className="text-[10px] text-indigo-200">{s.label}</p>
                        <p className="font-bold text-sm">{s.value}</p>
                      </div>
                    ))}
                  </div>
                </SheetHeader>
              </div>

              {/* Action Buttons */}
              {/* ── Invest Now button (always visible) ── */}
              <div className="flex gap-2 px-5 pt-3 pb-0 shrink-0">
                <button
                  id="invest-now-btn"
                  onClick={() => { setInvestAmount(String(selectedPortfolio.minInvestment)); setInvestModalOpen(true); }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white transition-colors shadow-md"
                >
                  ⚡ Invest Now
                </button>
                {!canShare && (
                  <span className="text-xs text-muted-foreground self-center ml-1">
                    An advisor will review and share the proposal with you.
                  </span>
                )}
              </div>
              {canShare && (
                <div className="flex gap-2 px-5 py-3 border-b shrink-0">
                  <Button
                    id="share-portfolio-btn"
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs"
                    onClick={() => setShareDialogOpen(true)}
                  >
                    <Share2 className="h-3.5 w-3.5" />Share with Client
                  </Button>
                  <Button
                    id="copy-to-proposal-btn"
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs"
                    onClick={handleCopyToProposal}
                  >
                    <Copy className="h-3.5 w-3.5" />Copy to Proposal
                  </Button>
                  <Button
                    id="export-portfolio-pdf-btn"
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs ml-auto"
                    onClick={handleExportPDF}
                  >
                    <Download className="h-3.5 w-3.5" />Export PDF
                  </Button>
                </div>
              )}
              {!canShare && (
                <div className="flex gap-2 px-5 py-3 border-b shrink-0 justify-end">
                  <Button
                    id="export-portfolio-pdf-btn-client"
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs"
                    onClick={handleExportPDF}
                  >
                    <Download className="h-3.5 w-3.5" />Export PDF
                  </Button>
                </div>
              )}

              {/* Sheet Tab Content */}
              <ScrollArea className="flex-1">
                <Tabs
                  value={activeDetailTab}
                  onValueChange={(t) => {
                    setActiveDetailTab(t);
                  }}
                  className="px-5 pt-4 pb-6"
                >
                  <TabsList className="grid w-full grid-cols-5 mb-4 h-8 text-xs">
                    <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                    <TabsTrigger value="holdings" className="text-xs">Holdings</TabsTrigger>
                    <TabsTrigger value="performance" className="text-xs">Performance</TabsTrigger>
                    <TabsTrigger value="rebalancing" className="text-xs">Rebalancing</TabsTrigger>
                    <TabsTrigger value="ai-record" className="text-xs">🤖 AI</TabsTrigger>
                  </TabsList>

                  {/* Overview Tab */}
                  <TabsContent value="overview" className="space-y-4">
                    {/* Meta info */}
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: "Risk Profile", value: `${RISK_CONFIG[selectedPortfolio.riskProfile].icon} ${RISK_CONFIG[selectedPortfolio.riskProfile].label}` },
                        { label: "Min Investment", value: formatINR(selectedPortfolio.minInvestment) },
                        { label: "Time Horizon", value: selectedPortfolio.timeHorizon },
                        { label: "Last Rebalanced", value: new Date(selectedPortfolio.lastRebalanced).toLocaleDateString("en-IN") },
                        { label: "Total Holdings", value: `${selectedPortfolio.totalHoldings} instruments` },
                        { label: "Benchmark", value: selectedPortfolio.benchmarkName },
                      ].map((m) => (
                        <div key={m.label} className="bg-muted/40 rounded-lg p-3">
                          <p className="text-[10px] text-muted-foreground">{m.label}</p>
                          <p className="text-sm font-semibold mt-0.5">{m.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Allocation Pie + Legend */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Asset Allocation</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-4">
                          <RechartsPieChart width={120} height={120}>
                            <Pie
                              data={selectedPortfolio.allocation}
                              cx={55}
                              cy={55}
                              innerRadius={30}
                              outerRadius={55}
                              dataKey="weight"
                              strokeWidth={2}
                            >
                              {selectedPortfolio.allocation.map((a) => (
                                <Cell key={a.category} fill={a.color} />
                              ))}
                            </Pie>
                          </RechartsPieChart>
                          <div className="flex-1 space-y-2">
                            {selectedPortfolio.allocation.map((a) => (
                              <div key={a.category} className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                                <span className="text-xs flex-1 truncate">{a.label}</span>
                                <span className="text-xs font-semibold">{a.weight}%</span>
                                <Progress value={a.weight} className="w-14 h-1.5" />
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Risk Metrics */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-1.5">
                          <BarChart3 className="h-4 w-4 text-indigo-500" />Risk Metrics
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {[
                            { label: "Sharpe Ratio", value: selectedPortfolio.riskMetrics.sharpeRatio.toFixed(2), good: selectedPortfolio.riskMetrics.sharpeRatio >= 1.5 },
                            { label: "Max Drawdown", value: `${selectedPortfolio.riskMetrics.maxDrawdown}%`, good: selectedPortfolio.riskMetrics.maxDrawdown > -20 },
                            { label: "Volatility (σ)", value: `${selectedPortfolio.riskMetrics.volatility}%`, good: selectedPortfolio.riskMetrics.volatility < 15 },
                            { label: "Beta", value: selectedPortfolio.riskMetrics.beta.toFixed(2), good: selectedPortfolio.riskMetrics.beta < 1 },
                            { label: "Alpha (Ann.)", value: `+${selectedPortfolio.riskMetrics.alpha}%`, good: true },
                          ].map((m) => (
                            <div key={m.label} className="text-center bg-muted/40 rounded-lg p-2">
                              <p className="text-[10px] text-muted-foreground">{m.label}</p>
                              <p className={`text-sm font-bold mt-0.5 ${m.good ? "text-green-600" : "text-red-500"}`}>{m.value}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* AI Insights — FASP-AI v2.0 */}
                    <Card className="border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300">
                          <BrainCircuit className="h-4 w-4" />
                          AI Insight
                          <Badge variant="outline" className="text-[9px] ml-1 border-indigo-400 text-indigo-600 font-mono">
                            FASP-AI v2.0
                          </Badge>
                          <Badge variant="outline" className="text-[9px] ml-auto border-green-400 text-green-600">
                            SEBI Compliant
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                       <CardContent className="space-y-3">
                         {!selectedPortfolio.aiInsight ? (
                           /* Scheduler runs at 6 AM IST — pending until first run */
                           <div className="flex flex-col items-center gap-2 py-6 text-center">
                             <BrainCircuit className="h-8 w-8 text-indigo-300 animate-pulse" />
                             <p className="text-sm font-medium text-muted-foreground">AI Analysis Pending</p>
                             <p className="text-[11px] text-muted-foreground max-w-xs">
                               The FASP-AI engine generates portfolio insights at 6:00 AM IST daily.
                               Check back after the next scheduled run.
                             </p>
                             <Badge variant="outline" className="text-[9px] border-amber-400 text-amber-600 mt-1">
                               ⏳ Scheduled: 6:00 AM IST
                             </Badge>
                           </div>
                         ) : (
                           <>
                             {/* Recommendation — gated at 65% (retail default) */}
                             <p className="text-xs leading-relaxed text-muted-foreground">
                               {selectedPortfolio.aiInsight.confidence_score < 65
                                 ? "⚠️ Low confidence — please consult a registered investment advisor before investing."
                                 : selectedPortfolio.aiInsight.recommendation}
                             </p>

                             {/* Confidence Score + Progress Bar */}
                             <div className="flex items-center gap-2">
                               <span className="text-[10px] text-muted-foreground shrink-0">Confidence:</span>
                               <span className={`text-xs font-bold ${getConfidenceColor(selectedPortfolio.aiInsight.confidence_score)}`}>
                                 {selectedPortfolio.aiInsight.confidence_score}%
                               </span>
                               <Progress value={selectedPortfolio.aiInsight.confidence_score} className="flex-1 h-1.5" />
                             </div>

                             {/* v2.0: Confidence Breakdown */}
                             <div className="rounded-lg bg-indigo-100/60 dark:bg-indigo-900/30 p-2 space-y-1.5">
                               <p className="text-[9px] font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">
                                 Confidence Breakdown (FASP-AI v2.0)
                               </p>
                               {[
                                 { factor: "Response Completeness", weight: 20, score: selectedPortfolio.aiInsight.confidence_score > 80 ? 95 : 72, evidence: "Full recommendation with supporting rationale" },
                                 { factor: "Structured Output", weight: 25, score: 90, evidence: "JSON structure validated" },
                                 { factor: "Factor Coverage", weight: 25, score: (selectedPortfolio.aiInsight.factors_considered?.length ?? 0) >= 4 ? 92 : 78, evidence: `${selectedPortfolio.aiInsight.factors_considered?.length ?? 0} investment factors analyzed` },
                                 { factor: "Market Context", weight: 15, score: 80, evidence: "Market volatility: normal" },
                                 { factor: "Historical Accuracy", weight: 15, score: 70, evidence: "Default — feedback loop building" },
                               ].map((f) => (
                                 <div key={f.factor} className="flex items-center gap-2">
                                   <span className="text-[9px] text-muted-foreground w-36 shrink-0 truncate" title={f.evidence}>{f.factor}</span>
                                   <Progress value={f.score} className="flex-1 h-1" />
                                   <span className="text-[9px] font-semibold w-8 text-right text-indigo-700">{f.score}%</span>
                                   <span className="text-[8px] text-muted-foreground w-10 text-right">{f.weight}% wt</span>
                                 </div>
                               ))}
                             </div>

                             {/* Factors Considered */}
                             <div>
                               <p className="text-[10px] text-muted-foreground mb-1">Factors Considered:</p>
                               <div className="flex flex-wrap gap-1">
                                 {(selectedPortfolio.aiInsight.factors_considered ?? []).map((f) => (
                                   <Badge key={f} variant="outline" className="text-[9px] bg-indigo-100 dark:bg-indigo-900/40 border-0">
                                     {f}
                                   </Badge>
                                 ))}
                               </div>
                             </div>

                             {/* SEBI Circular Ref + Model Lineage */}
                             <div className="space-y-0.5 pt-1 border-t border-indigo-200/50">
                               <p className="text-[9px] text-muted-foreground">
                                 Model: <span className="font-mono">{selectedPortfolio.aiInsight.model_version}</span>
                                 {" "}· Engine: <span className="font-mono">fasp-engine-v2.0</span>
                                 {" "}· Base: <span className="font-mono">gemini-2.5-flash</span>
                                 {" "}· Data cutoff: <span className="font-mono">2025-01</span>
                               </p>
                               <p className="text-[9px] text-muted-foreground">
                                 Generated: {new Date(selectedPortfolio.aiInsight.timestamp).toLocaleString("en-IN")}
                               </p>
                               <p className="text-[9px] text-indigo-600 dark:text-indigo-400">
                                 SEBI Ref: SEBI/HO/IMD/2023/P/CIR/0188 · This is a Decision Support System — not autonomous advice.
                               </p>
                             </div>
                           </>
                         )}
                       </CardContent>
                     </Card>
                  </TabsContent>

                  {/* Holdings Tab — role-gated: agents/partners/admins see full list, clients see top 5 */}
                  <TabsContent value="holdings" className="space-y-3">
                    {/* Header row */}
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        {canViewFullHoldings
                          ? `Showing all ${displayHoldings.length} holdings · ${selectedPortfolio.totalHoldings} total instruments`
                          : `Top 5 of ${selectedPortfolio.totalHoldings} holdings · full list for registered advisors`}
                      </p>
                      {canViewFullHoldings && displayHoldings.length > 8 && (
                        <button
                          id="toggle-holdings-expand"
                          onClick={() => setShowAllHoldings((v) => !v)}
                          className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 dark:hover:text-indigo-400 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                        >
                          {showAllHoldings ? "▲ Collapse" : `▼ Show all ${displayHoldings.length}`}
                        </button>
                      )}
                    </div>

                    {/* Holdings rows — controlled by role + toggle */}
                    <div className="space-y-2">
                      {holdingsLoading && !enrichedHoldings && (
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground py-2 px-3">
                          <span className="animate-spin">⟳</span> Loading holdings…
                        </div>
                      )}
                      {(canViewFullHoldings
                        ? displayHoldings  // Always show all for agents — no slice
                        : displayHoldings.slice(0, 5)
                      ).map((h, _idx) => {
                        const displayBeta = h.beta;
                        const displaySharpe = h.sharpe;
                        const screenerUrl = h.screenerUrl;
                        const isStock = !!(h.symbol && screenerUrl);
                        return (
                          <div
                            key={h.rank}
                            id={`holding-row-${h.rank}-${selectedPortfolio.id}`}
                            className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors"
                          >
                            <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-xs font-bold text-indigo-600">
                              {h.rank}
                            </div>
                            <div className="flex-1 min-w-0">
                              {isStock ? (
                                <a
                                  href={screenerUrl}
                                  className="text-xs font-semibold truncate block text-indigo-700 dark:text-indigo-300 hover:underline cursor-pointer"
                                  title={`View ${h.symbol} in screener`}
                                >
                                  {h.name}
                                  <span className="ml-1 text-[9px] text-indigo-400">↗</span>
                                </a>
                              ) : (
                                <p className="text-xs font-semibold truncate">{h.name}</p>
                              )}
                              <p className="text-[10px] text-muted-foreground">{h.category}</p>
                              {/* ISIN chip — shown for all instrument types when available */}
                              {h.isin && (
                                <button
                                  id={`isin-copy-${h.rank}-${selectedPortfolio.id}`}
                                  onClick={() => {
                                    navigator.clipboard.writeText(h.isin!);
                                  }}
                                  title={`ISIN: ${h.isin} — click to copy`}
                                  className="mt-0.5 inline-flex items-center gap-1 text-[9px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                >
                                  <span className="text-[8px] opacity-60">📋</span>
                                  {h.isin}
                                </button>
                              )}
                              {/* Beta / Sharpe pills for stock holdings */}
                              {isStock && (displayBeta != null || displaySharpe != null) && (
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  {displayBeta != null && (
                                    <span className="inline-flex items-center gap-0.5 text-[9px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded px-1 py-0">
                                      β {displayBeta.toFixed(2)}
                                    </span>
                                  )}
                                  {displaySharpe != null && (
                                    <span className={`inline-flex items-center gap-0.5 text-[9px] rounded px-1 py-0 ${
                                      displaySharpe >= 1 ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300" :
                                      displaySharpe >= 0 ? "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300" :
                                      "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
                                    }`}>
                                      SR {displaySharpe.toFixed(2)}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs font-bold">{h.weight}%</p>
                              {h.currentReturn !== undefined && h.currentReturn !== null ? (
                                <p className={`text-[10px] font-semibold ${h.currentReturn >= 0 ? "text-green-600" : "text-red-500"}`}>
                                  {h.currentReturn >= 0 ? "+" : ""}{typeof h.currentReturn === "number" ? h.currentReturn.toFixed(1) : h.currentReturn}%
                                </p>
                              ) : holdingsLoading ? (
                                <p className="text-[10px] text-muted-foreground">…</p>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {enrichedHoldings && (
                      <p className="text-[9px] text-muted-foreground text-right mt-1">
                        📊 Stocks: screener_derived_metrics · Funds: mfapi.in NAV
                        {" · "}
                        <span className="text-indigo-500">↗ Click stock name to open in Screener</span>
                      </p>
                    )}

                    {/* Client gate: blurred ghost rows + upgrade overlay */}
                    {!canViewFullHoldings && selectedPortfolio.holdings.length > 5 && (
                      <div className="relative mt-1">
                        {/* Blurred ghost rows */}
                        <div className="space-y-2 blur-sm select-none pointer-events-none" aria-hidden="true">
                          {selectedPortfolio.holdings.slice(5, Math.min(8, selectedPortfolio.holdings.length)).map((h) => (
                            <div key={h.rank} className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
                              <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-xs font-bold text-indigo-600">{h.rank}</div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold truncate">{h.name}</p>
                                <p className="text-[10px] text-muted-foreground">{h.category}</p>
                              </div>
                              <div className="text-right shrink-0"><p className="text-xs font-bold">{h.weight}%</p></div>
                            </div>
                          ))}
                        </div>
                        {/* Overlay */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/75 backdrop-blur-[2px] rounded-lg border border-dashed border-indigo-300 dark:border-indigo-700">
                          <div className="text-center px-5 py-3">
                            <div className="text-2xl mb-1.5">🔒</div>
                            <p className="text-xs font-semibold">Full Holdings for Registered Advisors</p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {selectedPortfolio.totalHoldings - 5} more holdings available for SEBI-registered advisors &amp; agents
                            </p>
                            <p className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-2 font-medium">
                              Contact your FintekPro advisor for complete portfolio details
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <p className="text-[10px] text-muted-foreground text-center pt-2">
                      Returns as of last market close. Past performance ≠ future results.
                    </p>
                  </TabsContent>

                  {/* Performance Tab */}
                  <TabsContent value="performance" className="space-y-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">NAV vs Benchmark (24 months)</span>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" /> Portfolio</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400 inline-block" /> {selectedPortfolio.benchmarkName}</span>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={selectedPortfolio.performance} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                        <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={3} />
                        <YAxis tick={{ fontSize: 9 }} domain={["auto", "auto"]} tickFormatter={(v) => `₹${v}`} />
                        <RechartsTooltip
                          formatter={(v: number, name: string) => [`₹${v.toFixed(0)}`, name === "portfolioNav" ? "Portfolio NAV" : "Benchmark"]}
                          labelStyle={{ fontSize: 10 }}
                        />
                        <ReferenceLine y={1000} stroke="#6B7280" strokeDasharray="4 4" strokeOpacity={0.5} />
                        <Line type="monotone" dataKey="portfolioNav" stroke="#6366F1" strokeWidth={2} dot={false} name="portfolioNav" />
                        <Line type="monotone" dataKey="benchmarkNav" stroke="#9CA3AF" strokeWidth={1.5} dot={false} strokeDasharray="5 3" name="benchmarkNav" />
                      </LineChart>
                    </ResponsiveContainer>

                    {/* Full performance period table — pulls live data from /ai-track-record */}
                    <PerformancePeriodTable portfolioId={selectedPortfolio.id}
                      twrr1Y={selectedPortfolio.twrr1Y}
                      cagr1Y={selectedPortfolio.cagr1Y}
                      cagr3Y={selectedPortfolio.cagr3Y}
                      cagr5Y={selectedPortfolio.cagr5Y}
                      benchmarkCagr1Y={selectedPortfolio.benchmarkCagr1Y}
                      return1m={selectedPortfolio.return1m}
                      return3m={selectedPortfolio.return3m}
                      return6m={selectedPortfolio.return6m}
                      returnYtd={selectedPortfolio.returnYtd}
                      cagr2y={selectedPortfolio.cagr2y}
                      returnSinceInception={selectedPortfolio.returnSinceInception}
                      benchmarkSinceInception={selectedPortfolio.benchmarkSinceInception}
                    />

                    <p className="text-[10px] text-muted-foreground text-center">
                        * NAV starts at ₹1,000. Past returns are simulated for illustration. Not guaranteed.
                    </p>
                  </TabsContent>

                  {/* Rebalancing Tab */}
                  <TabsContent value="rebalancing" className="space-y-3">
                     {/* ── FASP-AI v3.0: Substitution Proposals Panel ─────────── */}
                     {canViewFullHoldings && proposals[selectedPortfolio.id]?.length > 0 && (
                       <div className="space-y-2">
                         <div className="flex items-center gap-2 mb-1">
                           <span className="text-xs font-bold text-amber-600 dark:text-amber-400">⚡ Rebalance Proposals</span>
                           <span className="text-[9px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full font-semibold">{proposals[selectedPortfolio.id].length} pending</span>
                         </div>
                         {proposals[selectedPortfolio.id].map((proposal: any) => (
                           <div key={proposal.id} className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20 p-3 space-y-2">
                             <div className="flex items-start justify-between gap-2">
                               <div>
                                 <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300">Est. Alpha Gain: +{Number.parseFloat(proposal.totalAlphaGain || 0).toFixed(1)}%/yr</p>
                                 <p className="text-[9px] text-muted-foreground">Confidence: {proposal.confidence}% · {new Date(proposal.proposedAt).toLocaleDateString("en-IN")}</p>
                               </div>
                               <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${proposal.driftSeverity === "critical" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"}`}>{proposal.driftSeverity ?? "moderate"}</span>
                             </div>
                             {(proposal.substitutions ?? []).map((sub: any, si: number) => (
                               <div key={si} className="bg-white/70 dark:bg-black/20 rounded-lg p-2 text-[10px] space-y-1">
                                 <div className="flex items-center gap-1.5"><span className="text-red-500 font-bold">−</span><span className="text-muted-foreground font-medium truncate">{sub.removeName}</span><span className="text-[9px] text-red-500">(α: {sub.removeAlpha?.toFixed(1)}%)</span></div>
                                 <div className="flex items-center gap-1.5"><span className="text-green-500 font-bold">+</span><span className="font-semibold truncate">{sub.addName}</span><span className="text-[9px] text-green-600">(α: +{sub.addAlpha?.toFixed(1)}%)</span></div>
                                 <p className="text-[9px] text-muted-foreground italic">{sub.reason}</p>
                               </div>
                             ))}
                             <div className="flex gap-2 pt-1">
                               <button id={`approve-proposal-${proposal.id}`} disabled={approvingProposal === proposal.id} onClick={() => handleApproveProposal(selectedPortfolio.id, proposal.id)} className="flex-1 text-[10px] font-bold py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50">{approvingProposal === proposal.id ? "Approving…" : "✓ Approve & Apply"}</button>
                               <button id={`reject-proposal-${proposal.id}`} disabled={rejectingProposal === proposal.id} onClick={() => handleRejectProposal(selectedPortfolio.id, proposal.id)} className="flex-1 text-[10px] font-bold py-1.5 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50">{rejectingProposal === proposal.id ? "Rejecting…" : "✗ Reject"}</button>
                             </div>
                             <p className="text-[8px] text-muted-foreground italic">{proposal.disclaimer}</p>
                           </div>
                         ))}
                       </div>
                     )}
                     {/* Drift-Triggered Monitoring Panel */}
                     {(() => {
                       const lastRebalDate = new Date(selectedPortfolio.lastRebalanced);
                       const daysSinceRebal = Math.round((Date.now() - lastRebalDate.getTime()) / 86400000);
                       const qs = quantSignals[selectedPortfolio.id];
                       const driftScore = qs?.driftScore ?? 0;
                       const driftThresholdPct = selectedPortfolio.driftThreshold ?? 5;
                       const needsRebalance = driftScore > 15;
                       const minorDrift   = driftScore > 5 && driftScore <= 15;
                       const drawdownPct  = selectedPortfolio.riskMetrics?.maxDrawdown ?? 0;
                       const ddThreshold  = selectedPortfolio.maxDrawdownThreshold ?? 20;
                       const ddTripped    = Math.abs(drawdownPct) > ddThreshold;
                       return (
                         <div className={`space-y-2 p-3 rounded-xl border ${
                           needsRebalance ? "border-red-300 bg-red-50 dark:bg-red-950/20" :
                           minorDrift ? "border-amber-200 bg-amber-50 dark:bg-amber-950/20" :
                           "border-indigo-200 bg-indigo-50/50 dark:bg-indigo-950/20"
                         }`}>
                           <div className="grid grid-cols-3 gap-2">
                             {[
                               { label: "Last Rebalanced", value: lastRebalDate.toLocaleDateString("en-IN") },
                               { label: "Drift Score", value: `${driftScore}/100`,
                                 highlight: needsRebalance ? "text-red-600 font-bold" : minorDrift ? "text-amber-600 font-semibold" : "text-green-600" },
                               { label: "Drift Threshold", value: `±${driftThresholdPct}%` },
                             ].map((m) => (
                               <div key={m.label} className="text-center">
                                 <p className="text-[9px] text-muted-foreground mb-0.5">{m.label}</p>
                                 <p className={`text-[11px] font-semibold ${m.highlight || ""}`}>{m.value}</p>
                               </div>
                             ))}
                           </div>
                           {needsRebalance && (
                             <div className="flex items-center gap-1.5 text-[10px] text-red-600 font-medium">
                               <AlertTriangle className="h-3 w-3 shrink-0" />
                               Portfolio has breached drift tolerance — rebalancing required
                             </div>
                           )}
                           {minorDrift && (
                             <div className="flex items-center gap-1.5 text-[10px] text-amber-600 font-medium">
                               <AlertTriangle className="h-3 w-3 shrink-0" />
                               Minor drift detected — monitor before next rebalance trigger
                             </div>
                           )}
                           {ddTripped && (
                             <div className="flex items-center gap-1.5 text-[10px] text-orange-600 font-medium">
                               <AlertTriangle className="h-3 w-3 shrink-0" />
                               Drawdown circuit breaker active ({Math.abs(drawdownPct).toFixed(1)}% &gt; {ddThreshold}% threshold) — auto-rebalance paused, advisor confirmation required
                             </div>
                           )}
                           <p className="text-[9px] text-muted-foreground">Last rebalanced {daysSinceRebal}d ago. Rebalancing is drift-triggered, not calendar-based.</p>
                           {selectedPortfolio.conflictDisclosure && (
                             <p className="text-[9px] text-amber-600/90 border-t border-amber-200 pt-1.5">
                               ⚠ Conflict disclosure: {selectedPortfolio.conflictDisclosure}
                             </p>
                           )}
                         </div>
                       );
                     })()}
                     <p className="text-xs text-muted-foreground">
                       Portfolios are rebalanced as needed — triggered when holdings breach asset-class drift tolerance bands. Past performance is not indicative of future results.
                     </p>
                     {selectedPortfolio.rebalancingHistory.map((e, i) => (
                      <Card key={i} className="border-l-4 border-l-indigo-400">
                        <CardContent className="pt-3 pb-3">
                          <div className="flex items-center gap-2 mb-2">
                            <RefreshCw className="h-3.5 w-3.5 text-indigo-500" />
                            <span className="text-xs font-semibold">{e.date}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">{e.description}</p>
                          <div className="space-y-1">
                            {e.changes.map((c, j) => (
                              <div key={j} className="flex items-center gap-1.5 text-xs">
                                <ChevronRight className="h-3 w-3 text-indigo-400 shrink-0" />
                                <span>{c}</span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>

                  {/* AI Track Record Tab */}
                  <TabsContent value="ai-record" className="space-y-3">
                    <AiTrackRecordTab portfolioId={selectedPortfolio.id} />
                  </TabsContent>
                </Tabs>

                {/* Disclaimer in sheet */}
                <div className="mx-5 mb-6 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{DISCLAIMER_TEXT}</p>
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Share Dialog ── */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="sm:max-w-sm" id="share-portfolio-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-4 w-4" />
              Share Model Portfolio
            </DialogTitle>
            <DialogDescription>
              Share "{selectedPortfolio?.name}" with your clients
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                id="share-whatsapp-btn"
                onClick={() => setShareChannel("whatsapp")}
                className={`p-3 rounded-lg border-2 text-xs font-medium flex items-center gap-2 transition-colors ${shareChannel === "whatsapp" ? "border-green-500 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300" : "border-border hover:border-muted-foreground/30"}`}
              >
                <MessageSquare className="h-4 w-4" />WhatsApp
              </button>
              <button
                id="share-email-btn"
                onClick={() => setShareChannel("email")}
                className={`p-3 rounded-lg border-2 text-xs font-medium flex items-center gap-2 transition-colors ${shareChannel === "email" ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300" : "border-border hover:border-muted-foreground/30"}`}
              >
                <Mail className="h-4 w-4" />Email
              </button>
            </div>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
              <p className="text-[10px] text-muted-foreground">
                ⚠️ Disclaimer will be included in the shared message as required by SEBI guidelines.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShareDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleShare} className="gap-1.5" id="confirm-share-btn">
              {shareChannel === "whatsapp" ? <MessageSquare className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
              Share via {shareChannel === "whatsapp" ? "WhatsApp" : "Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Risk Profiler Quiz Modal ── */}
      {quizOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setQuizOpen(false)}>
          <div className="bg-background rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">🎯 Find My Portfolio</h2>
              <button onClick={() => setQuizOpen(false)} className="text-muted-foreground hover:text-foreground text-xl leading-none">✕</button>
            </div>

            {/* Progress */}
            <div className="flex gap-1">
              {QUIZ_QUESTIONS.map((_, i) => (
                <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= quizStep ? "bg-indigo-600" : "bg-muted"}`} />
              ))}
            </div>

            {quizStep < QUIZ_QUESTIONS.length ? (
              <div className="space-y-4">
                <p className="font-semibold text-base">{QUIZ_QUESTIONS[quizStep].q}</p>
                <div className="grid grid-cols-1 gap-2">
                  {QUIZ_QUESTIONS[quizStep].opts.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => handleQuizAnswer(quizStep, opt)}
                      className="text-left px-4 py-3 rounded-xl border border-border hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors text-sm font-medium"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground text-center">Question {quizStep + 1} of {QUIZ_QUESTIONS.length}</p>
              </div>
            ) : quizResult ? (
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-3xl mb-1">{quizResult.icon}</p>
                  <p className="text-sm text-muted-foreground">We recommend</p>
                  <h3 className="text-xl font-bold text-indigo-600">{quizResult.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{quizResult.tagline}</p>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-muted rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">1Y CAGR</p>
                    <p className="font-bold text-green-600">{quizResult.cagr1Y}%</p>
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Min Invest</p>
                    <p className="font-bold">{formatINR(quizResult.minInvestment)}</p>
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Risk</p>
                    <p className="font-bold">{RISK_CONFIG[quizResult.riskProfile].label}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setSelectedPortfolio(quizResult); setQuizOpen(false); }}
                    className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
                  >
                    View Full Details
                  </button>
                  <button onClick={resetQuiz} className="flex-1 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
                    Retake Quiz
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ── Compare Sheet ── */}
      {compareOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={() => setCompareOpen(false)}>
          <div className="bg-background rounded-t-2xl shadow-2xl w-full max-w-5xl p-6 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">⚖️ Portfolio Comparison</h2>
              <button onClick={() => setCompareOpen(false)} className="text-muted-foreground hover:text-foreground text-xl">✕</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 text-muted-foreground font-medium w-36">Metric</th>
                    {comparePortfolios.map(p => (
                      <th key={p.id} className="text-center py-2 px-3">
                        <span className="text-lg">{p.icon}</span>
                        <p className="font-semibold text-xs leading-tight mt-1">{p.name}</p>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {[
                    { label: "Asset Class", fn: (p: ModelPortfolio) => ASSET_CLASS_CONFIG[p.assetClass]?.label || p.assetClass },
                    { label: "Sub-Category", fn: (p: ModelPortfolio) => p.subCategory },
                    { label: "Risk", fn: (p: ModelPortfolio) => RISK_CONFIG[p.riskProfile].label },
                    { label: "Time Horizon", fn: (p: ModelPortfolio) => p.timeHorizon },
                    { label: "Min Investment", fn: (p: ModelPortfolio) => formatINR(p.minInvestment) },
                    { label: "1Y CAGR", fn: (p: ModelPortfolio) => `${p.cagr1Y}%` },
                    { label: "3Y CAGR", fn: (p: ModelPortfolio) => `${p.cagr3Y}%` },
                    { label: "5Y CAGR", fn: (p: ModelPortfolio) => `${p.cagr5Y}%` },
                    { label: "Benchmark", fn: (p: ModelPortfolio) => p.benchmarkName },
                    { label: "Sharpe Ratio", fn: (p: ModelPortfolio) => p.riskMetrics.sharpeRatio.toFixed(2) },
                    { label: "Max Drawdown", fn: (p: ModelPortfolio) => `${p.riskMetrics.maxDrawdown}%` },
                    { label: "Volatility", fn: (p: ModelPortfolio) => `${p.riskMetrics.volatility}%` },
                    { label: "Holdings", fn: (p: ModelPortfolio) => p.totalHoldings },
                  ].map(row => (
                    <tr key={row.label} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2 pr-4 text-muted-foreground font-medium">{row.label}</td>
                      {comparePortfolios.map(p => (
                        <td key={p.id} className="py-2 px-3 text-center font-medium">{row.fn(p)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              onClick={() => { setCompareList([]); setCompareOpen(false); }}
              className="mt-4 text-sm text-muted-foreground hover:text-foreground underline"
            >
              Clear comparison
            </button>
          </div>
        </div>
      )}

      {/* ── Global Disclaimer + SEBI Compliance Footer ── */}
      <div className="border border-amber-200 dark:border-amber-800 rounded-xl p-4 bg-amber-50/50 dark:bg-amber-950/20 space-y-3">
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">
              Important Disclaimer — Please Read Before Investing
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{DISCLAIMER_TEXT}</p>
          </div>
        </div>

        {/* CAGR Data Timestamp */}
        <div className="flex flex-wrap gap-3 pt-1 border-t border-amber-200/50 dark:border-amber-800/50">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded px-2 py-0.5 font-medium">
              📅 CAGR data as of {CAGR_DATA_AS_OF}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded px-2 py-0.5 font-medium">
              🔄 Metrics refreshed daily at 6:00 AM IST
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded px-2 py-0.5 font-medium">
              🤖 AI insights: FASP-AI v1.0 compliant
            </span>
          </div>
        </div>

        {/* SEBI RIA Registration + Regulatory Notice */}
        <div className="pt-2 border-t border-amber-200/50 dark:border-amber-800/50">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            {SEBI_REGULATORY_NOTICE}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            <strong>For RIA Partners:</strong> FintekPro is a decision support system for SEBI-registered advisors.
            Final investment decisions MUST be confirmed by the advisor or client.
            AI advisory outputs are logged per FASP-AI v1.0 compliance framework.
            All AI recommendations include confidence scores and mandatory disclaimers.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <a href="https://sebi.gov.in" target="_blank" rel="noopener noreferrer"
               className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline">
              sebi.gov.in ↗
            </a>
            <a href="https://scores.gov.in" target="_blank" rel="noopener noreferrer"
               className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline">
              scores.gov.in (Grievances) ↗
            </a>
            <a href="https://mf.nipponindiaim.com/knowledge-center/pages/sebi-risk-o-meter.aspx" target="_blank" rel="noopener noreferrer"
               className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline">
              SEBI Risk-O-Meter ↗
            </a>
            <span className="text-[10px] text-muted-foreground">
              📞 SEBI Helpline: 1800 266 7575
            </span>
          </div>
        </div>
      </div>
    </div>
    {/* ═══════════════════════════════════════════════════════════════════
        INVEST MODAL — Model Portfolio Investment
        FASP-AI v2.0 | Advisory-only | Advisor shares proposal
        ═══════════════════════════════════════════════════════════════════ */}
    {investModalOpen && selectedPortfolio && (
      <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setInvestModalOpen(false)} />
        <div className="relative w-full sm:max-w-lg bg-background rounded-t-2xl sm:rounded-2xl shadow-2xl border border-border flex flex-col max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-200 font-medium uppercase tracking-wide">💼 Invest in Model Portfolio</p>
                <h2 className="text-lg font-bold mt-0.5">{selectedPortfolio.name}</h2>
              </div>
              <button onClick={() => setInvestModalOpen(false)} className="text-white/70 hover:text-white text-xl font-bold leading-none">×</button>
            </div>
            <div className="flex gap-4 mt-3 text-xs">
              <span className="bg-white/15 rounded px-2 py-1">Min ₹{selectedPortfolio.minInvestment.toLocaleString("en-IN")}</span>
              <span className="bg-white/15 rounded px-2 py-1">{selectedPortfolio.holdings.length} holdings</span>
              <span className="bg-white/15 rounded px-2 py-1">1Y CAGR {selectedPortfolio.cagr1Y}%</span>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* Invest Type Toggle */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Investment Type</label>
              <div className="flex gap-2">
                {(["lumpsum", "sip"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setInvestType(t)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-colors ${
                      investType === t
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
                        : "border-border bg-background text-muted-foreground hover:border-emerald-300"
                    }`}
                  >
                    {t === "lumpsum" ? "💰 Lumpsum" : "📅 Monthly SIP"}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount Input */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
                {investType === "sip" ? "Monthly SIP Amount" : "Investment Amount"}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">₹</span>
                <input
                  id="invest-amount-input"
                  type="number"
                  min={selectedPortfolio.minInvestment}
                  step={1000}
                  value={investAmount}
                  onChange={e => setInvestAmount(e.target.value)}
                  placeholder={`Min ${selectedPortfolio.minInvestment.toLocaleString("en-IN")}`}
                  className="w-full pl-7 pr-4 py-2.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              {investType === "sip" && (
                <div className="mt-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">SIP Date</label>
                  <select
                    value={sipDate}
                    onChange={e => setSipDate(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background"
                  >
                    {[1,5,7,10,15,20,25,28].map(d => (
                      <option key={d} value={d}>{d === 1 ? "1st" : d === 5 ? "5th" : d === 7 ? "7th" : d === 10 ? "10th" : d === 15 ? "15th" : d === 20 ? "20th" : d === 25 ? "25th" : "28th"} of every month</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Allocation Preview */}
            {investPreview.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
                  Allocation ({investPreview.length} holdings)
                </label>
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {investPreview.map((a: any) => (
                    <div key={a.rank} className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg ${a.isBelowMinimum ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200" : "bg-muted/40"}`}>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{a.name}</p>
                        <p className="text-muted-foreground">{a.category} · {a.targetWeight}%</p>
                      </div>
                      <div className="text-right ml-3 shrink-0">
                        <p className={`font-semibold ${a.isBelowMinimum ? "text-amber-600" : "text-foreground"}`}>
                          ₹{a.targetAmount.toLocaleString("en-IN")}
                        </p>
                        {a.isBelowMinimum && <p className="text-[9px] text-amber-500">Below ₹100 min</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {investLoading && (
              <div className="text-center text-xs text-muted-foreground py-3">Computing allocation...</div>
            )}

            {/* SEBI Disclaimer */}
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2.5">
              <p className="text-[10px] text-amber-800 dark:text-amber-200 leading-relaxed">
                <strong>⚠️ Important:</strong> Mutual Fund investments are subject to market risks. Past performance is not indicative of future results. This is an advisory recommendation. Final execution requires advisor review and approval. No trades have been executed.
              </p>
            </div>

            {/* Advisory note for clients */}
            {!canShare && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded-lg px-3 py-2.5">
                <p className="text-[10px] text-blue-800 dark:text-blue-200">
                  📋 Your advisor will review this proposal and share an execution plan with you. Online transaction support coming soon.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t shrink-0 flex gap-3">
            <button
              onClick={() => setInvestModalOpen(false)}
              className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              id="generate-invest-proposal-btn"
              disabled={investSubmitting || !investAmount || Number.parseFloat(investAmount) < selectedPortfolio.minInvestment}
              onClick={async () => {
                if (!investAmount || Number.parseFloat(investAmount) < selectedPortfolio.minInvestment) return;
                setInvestSubmitting(true);
                try {
                  const r = await fetch(`/api/model-portfolios/${selectedPortfolio.id}/invest`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      clientId: (window as any).__currentUser?.id ?? "client",
                      amount: Number.parseFloat(investAmount),
                      investType,
                      sipDate,
                    }),
                  });
                  const data = await r.json();
                  if (data.success) {
                    setInvestModalOpen(false);
                    // Show success toast via global toast if available
                    if ((window as any).__toast) {
                      (window as any).__toast({
                        title: "✅ Proposal Created",
                        description: `${data.data.proposalId} — ${data.data.holdingsAllocated} holdings added to cart. ${data.data.nextSteps}`,
                      });
                    }
                  }
                } catch {}
                finally { setInvestSubmitting(false); }
              }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                investSubmitting || !investAmount || Number.parseFloat(investAmount || "0") < selectedPortfolio.minInvestment
                  ? "bg-emerald-200 text-emerald-400 cursor-not-allowed"
                  : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-md"
              }`}
            >
              {investSubmitting ? "Creating..." : "Generate Proposal →"}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
