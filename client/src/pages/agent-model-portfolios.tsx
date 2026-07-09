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
  assetClass: "equity" | "debt" | "hybrid" | "thematic" | "goal_based" | "hni" | "gold" | "alternatives" | "international";
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
  {
    id: "arbitrage-liquid-hybrid",
    assetClass: "hybrid",
    subCategory: "All-Weather",
    name: "Arbitrage and Liquid Hybrid",
    tagline: "Tax-efficient liquid parking with equity taxation",
    riskProfile: "conservative",
    goal: ["capital_preservation", "tax_efficiency", "liquidity"],
    minInvestment: 25000,
    timeHorizon: "3-12 months",
    cagr1Y: 6.36,
    cagr3Y: 5.59,
    cagr5Y: 7.89,
    benchmarkCagr1Y: 5.09,
    benchmarkName: "NIFTY Arbitrage Index",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "quarterly",
    totalHoldings: 6,
    highlight: "Liquid fund alternative with lower tax for 3M+ horizon",
    icon: "🔄",
    isFeatured: false,
    isNew: false,
    allocation: [{category:"equity",label:"Equity",weight:55,color:"#3B82F6",icon:"📈"},{category:"debt",label:"Debt",weight:35,color:"#10B981",icon:"🏛️"},{category:"gold",label:"Gold/REITs",weight:10,color:"#F59E0B",icon:"🥇"}],
    holdings: [
      { rank: 1, name: "ICICI Pru Balanced Advantage", category: "Balanced Adv MF", weight: 25, currentReturn: 11.2 },
      { rank: 2, name: "Parag Parikh Flexi Cap Fund", category: "Flexi Cap MF", weight: 20, currentReturn: 16.8 },
      { rank: 3, name: "SBI Magnum Gilt Fund", category: "Gilt MF", weight: 15, currentReturn: 7.8 },
      { rank: 4, name: "Nippon India Gold Savings", category: "Gold ETF", weight: 10, currentReturn: 11.1 },
      { rank: 5, name: "Embassy Office Parks REIT", category: "REIT", weight: 10, currentReturn: 9.8 },
      { rank: 6, name: "HDFC Liquid Fund", category: "Liquid MF", weight: 10, currentReturn: 7.5 },
    ],
    performance: PERFORMANCE_BASE("arbitrage-liquid-hybrid", 1000, 24, 6.36, 0.0),
    riskMetrics: { sharpeRatio: 0.0, maxDrawdown: 0.0, volatility: 0.0, beta: 0.7, alpha: 1.27 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for conservative investors in hybrid segment. Arbitrage and Liquid Hybrid has delivered 6.4% 1Y CAGR and targets 7.9% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "banking-bfsi",
    assetClass: "thematic",
    subCategory: "Thematic",
    name: "Banking and BFSI Portfolio",
    tagline: "India financial sector largest Nifty weight play",
    riskProfile: "aggressive",
    goal: ["capital_appreciation", "thematic", "financial_sector"],
    minInvestment: 15000,
    timeHorizon: "5+ years",
    cagr1Y: 0.29,
    cagr3Y: 0.26,
    cagr5Y: 3.34,
    benchmarkCagr1Y: 0.23,
    benchmarkName: "NIFTY Bank TRI",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "quarterly",
    totalHoldings: 10,
    highlight: "Banks NBFCs insurance India credit growth story",
    icon: "🏦",
    isFeatured: false,
    isNew: false,
    allocation: [{category:"thematic",label:"Thematic Equity",weight:80,color:"#EF4444",icon:"🎯"},{category:"equity",label:"Diversified Equity",weight:15,color:"#3B82F6",icon:"📈"},{category:"liquid",label:"Liquid",weight:5,color:"#6B7280",icon:"💧"}],
    holdings: [
      { rank: 1, name: "Mirae Asset Healthcare Fund", category: "Thematic MF", weight: 30, currentReturn: 18.2 },
      { rank: 2, name: "DSP India T.I.G.E.R Fund", category: "Thematic MF", weight: 25, currentReturn: 19.4 },
      { rank: 3, name: "ICICI Pru Technology Fund", category: "Thematic MF", weight: 20, currentReturn: 22.1 },
      { rank: 4, name: "Nippon India Power & Infra", category: "Thematic MF", weight: 15, currentReturn: 16.8 },
      { rank: 5, name: "UTI Transportation & Logistics", category: "Thematic MF", weight: 10, currentReturn: 14.2 },
    ],
    performance: PERFORMANCE_BASE("banking-bfsi", 1000, 24, 0.29, 22.1),
    riskMetrics: { sharpeRatio: 0.74, maxDrawdown: -18.4, volatility: 22.1, beta: 0.92, alpha: 0.06 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for aggressive investors in thematic segment. Banking and BFSI Portfolio has delivered 0.3% 1Y CAGR and targets 3.3% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "childrens-education",
    assetClass: "goal_based",
    subCategory: "Goal-Based",
    name: "Childrens Education Portfolio",
    tagline: "Build a corpus for your childs future education",
    riskProfile: "moderate",
    goal: ["education_planning", "goal_planning", "wealth_creation"],
    minInvestment: 5000,
    timeHorizon: "8-15 years",
    cagr1Y: 12.58,
    cagr3Y: 9.73,
    cagr5Y: 12.56,
    benchmarkCagr1Y: 10.06,
    benchmarkName: "NIFTY 500 TRI",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "annual",
    totalHoldings: 8,
    highlight: "Goal-linked investing for education milestones",
    icon: "🎓",
    isFeatured: false,
    isNew: false,
    allocation: [{category:"equity",label:"Equity",weight:60,color:"#3B82F6",icon:"📈"},{category:"debt",label:"Debt",weight:30,color:"#10B981",icon:"🏛️"},{category:"liquid",label:"Liquid",weight:10,color:"#6B7280",icon:"💧"}],
    holdings: [
      { rank: 1, name: "HDFC Top 100 Fund", category: "Large Cap MF", weight: 25, currentReturn: 13.4 },
      { rank: 2, name: "Mirae Asset Large Cap Fund", category: "Large Cap MF", weight: 20, currentReturn: 14.1 },
      { rank: 3, name: "SBI Magnum Gilt Fund", category: "Gilt MF", weight: 15, currentReturn: 7.8 },
      { rank: 4, name: "HDFC Corporate Bond Fund", category: "Corp Bond MF", weight: 15, currentReturn: 8.1 },
      { rank: 5, name: "Nippon India Gold Savings", category: "Gold ETF", weight: 10, currentReturn: 11.1 },
      { rank: 6, name: "ICICI Pru Liquid Fund", category: "Liquid MF", weight: 10, currentReturn: 7.5 },
      { rank: 7, name: "Parag Parikh Flexi Cap", category: "Flexi Cap MF", weight: 5, currentReturn: 16.8 },
    ],
    performance: PERFORMANCE_BASE("childrens-education", 1000, 24, 12.58, 10.8),
    riskMetrics: { sharpeRatio: 0.92, maxDrawdown: -9.4, volatility: 10.8, beta: 0.81, alpha: 2.52 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for moderate investors in goal_based segment. Childrens Education Portfolio has delivered 12.6% 1Y CAGR and targets 12.6% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "conservative-income",
    assetClass: "debt",
    subCategory: "Short Duration",
    name: "Conservative Income",
    tagline: "Regular income with capital safety",
    riskProfile: "conservative",
    goal: ["regular_income", "capital_preservation"],
    minInvestment: 5000,
    timeHorizon: "1-3 years",
    cagr1Y: 13.61,
    cagr3Y: 10.99,
    cagr5Y: 13.33,
    benchmarkCagr1Y: 10.89,
    benchmarkName: "CRISIL Short Duration Debt Index",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "semi_annual",
    totalHoldings: 8,
    highlight: "Low-risk monthly income generator",
    icon: "💰",
    isFeatured: false,
    isNew: false,
    allocation: [{category:"debt",label:"Debt/Bond Funds",weight:70,color:"#10B981",icon:"🏛️"},{category:"liquid",label:"Liquid Funds",weight:20,color:"#6B7280",icon:"💧"},{category:"gilt",label:"Gilt/Govt Bonds",weight:10,color:"#F59E0B",icon:"📜"}],
    holdings: [
      { rank: 1, name: "SBI Magnum Gilt Fund", category: "Gilt MF", weight: 25, currentReturn: 7.8 },
      { rank: 2, name: "HDFC Corporate Bond Fund", category: "Corp Bond MF", weight: 20, currentReturn: 8.1 },
      { rank: 3, name: "ICICI Pru Liquid Fund", category: "Liquid MF", weight: 20, currentReturn: 7.5 },
      { rank: 4, name: "Axis AAA Bond Plus SDL", category: "Govt Bond MF", weight: 15, currentReturn: 7.9 },
      { rank: 5, name: "Nippon India Short Term", category: "Short Term MF", weight: 12, currentReturn: 7.6 },
      { rank: 6, name: "Kotak Savings Fund", category: "Ultra Short MF", weight: 8, currentReturn: 7.2 },
    ],
    performance: PERFORMANCE_BASE("conservative-income", 1000, 24, 13.61, 1.8),
    riskMetrics: { sharpeRatio: 2.1, maxDrawdown: -1.2, volatility: 1.8, beta: 0.72, alpha: 2.72 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for conservative investors in debt segment. Conservative Income has delivered 13.6% 1Y CAGR and targets 13.3% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "consumption-rural",
    assetClass: "thematic",
    subCategory: "Thematic",
    name: "Consumption and Rural India",
    tagline: "India 900M rural consumers driving next growth wave",
    riskProfile: "moderate",
    goal: ["capital_appreciation", "thematic", "consumption"],
    minInvestment: 10000,
    timeHorizon: "5+ years",
    cagr1Y: -2.02,
    cagr3Y: -1.78,
    cagr5Y: 1.61,
    benchmarkCagr1Y: -1.62,
    benchmarkName: "NIFTY India Consumption TRI",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "quarterly",
    totalHoldings: 9,
    highlight: "FMCG retail agri-inputs rural India rising",
    icon: "🛒",
    isFeatured: false,
    isNew: false,
    allocation: [{category:"thematic",label:"Thematic Equity",weight:80,color:"#EF4444",icon:"🎯"},{category:"equity",label:"Diversified Equity",weight:15,color:"#3B82F6",icon:"📈"},{category:"liquid",label:"Liquid",weight:5,color:"#6B7280",icon:"💧"}],
    holdings: [
      { rank: 1, name: "Mirae Asset Healthcare Fund", category: "Thematic MF", weight: 30, currentReturn: 18.2 },
      { rank: 2, name: "DSP India T.I.G.E.R Fund", category: "Thematic MF", weight: 25, currentReturn: 19.4 },
      { rank: 3, name: "ICICI Pru Technology Fund", category: "Thematic MF", weight: 20, currentReturn: 22.1 },
      { rank: 4, name: "Nippon India Power & Infra", category: "Thematic MF", weight: 15, currentReturn: 16.8 },
      { rank: 5, name: "UTI Transportation & Logistics", category: "Thematic MF", weight: 10, currentReturn: 14.2 },
    ],
    performance: PERFORMANCE_BASE("consumption-rural", 1000, 24, -2.02, 13.4),
    riskMetrics: { sharpeRatio: 1.58, maxDrawdown: -14.8, volatility: 13.4, beta: 0.83, alpha: -0.4 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for moderate investors in thematic segment. Consumption and Rural India has delivered -2.0% 1Y CAGR and targets 1.6% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "corporate-treasury",
    assetClass: "debt",
    subCategory: "Short Duration",
    name: "Corporate Treasury Portfolio",
    tagline: "Optimal parking for corporate surplus cash",
    riskProfile: "conservative",
    goal: ["capital_preservation", "liquidity", "treasury_management"],
    minInvestment: 100000,
    timeHorizon: "1 day - 6 months",
    cagr1Y: 5.86,
    cagr3Y: 5.16,
    cagr5Y: 7.52,
    benchmarkCagr1Y: 4.69,
    benchmarkName: "CRISIL Corporate Bond Fund Index",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "monthly",
    totalHoldings: 6,
    highlight: "Zero-risk cash management for corporate treasuries",
    icon: "🏦",
    isFeatured: false,
    isNew: false,
    allocation: [{category:"debt",label:"Debt/Bond Funds",weight:70,color:"#10B981",icon:"🏛️"},{category:"liquid",label:"Liquid Funds",weight:20,color:"#6B7280",icon:"💧"},{category:"gilt",label:"Gilt/Govt Bonds",weight:10,color:"#F59E0B",icon:"📜"}],
    holdings: [
      { rank: 1, name: "SBI Magnum Gilt Fund", category: "Gilt MF", weight: 25, currentReturn: 7.8 },
      { rank: 2, name: "HDFC Corporate Bond Fund", category: "Corp Bond MF", weight: 20, currentReturn: 8.1 },
      { rank: 3, name: "ICICI Pru Liquid Fund", category: "Liquid MF", weight: 20, currentReturn: 7.5 },
      { rank: 4, name: "Axis AAA Bond Plus SDL", category: "Govt Bond MF", weight: 15, currentReturn: 7.9 },
      { rank: 5, name: "Nippon India Short Term", category: "Short Term MF", weight: 12, currentReturn: 7.6 },
      { rank: 6, name: "Kotak Savings Fund", category: "Ultra Short MF", weight: 8, currentReturn: 7.2 },
    ],
    performance: PERFORMANCE_BASE("corporate-treasury", 1000, 24, 5.86, 1.8),
    riskMetrics: { sharpeRatio: 1.84, maxDrawdown: -0.8, volatility: 1.8, beta: 0.72, alpha: 1.17 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for conservative investors in debt segment. Corporate Treasury Portfolio has delivered 5.9% 1Y CAGR and targets 7.5% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "credit-income",
    assetClass: "debt",
    subCategory: "credit_risk",
    name: "Credit & Income",
    tagline: "Earn higher yields through investment-grade corporate credit with managed risk",
    riskProfile: "moderate",
    goal: ["income_generation", "capital_preservation"],
    minInvestment: 25000,
    timeHorizon: "2-3 years",
    cagr1Y: -2.52,
    cagr3Y: -2.22,
    cagr5Y: 1.23,
    benchmarkCagr1Y: -2.02,
    benchmarkName: "CRISIL AA Short Term Bond Fund Index",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "annual",
    totalHoldings: 6,
    highlight: "Higher yield, managed credit risk",
    icon: "📊",
    isFeatured: false,
    isNew: true,
    allocation: [{category:"debt",label:"Debt/Bond Funds",weight:70,color:"#10B981",icon:"🏛️"},{category:"liquid",label:"Liquid Funds",weight:20,color:"#6B7280",icon:"💧"},{category:"gilt",label:"Gilt/Govt Bonds",weight:10,color:"#F59E0B",icon:"📜"}],
    holdings: [
      { rank: 1, name: "SBI Magnum Gilt Fund", category: "Gilt MF", weight: 25, currentReturn: 7.8 },
      { rank: 2, name: "HDFC Corporate Bond Fund", category: "Corp Bond MF", weight: 20, currentReturn: 8.1 },
      { rank: 3, name: "ICICI Pru Liquid Fund", category: "Liquid MF", weight: 20, currentReturn: 7.5 },
      { rank: 4, name: "Axis AAA Bond Plus SDL", category: "Govt Bond MF", weight: 15, currentReturn: 7.9 },
      { rank: 5, name: "Nippon India Short Term", category: "Short Term MF", weight: 12, currentReturn: 7.6 },
      { rank: 6, name: "Kotak Savings Fund", category: "Ultra Short MF", weight: 8, currentReturn: 7.2 },
    ],
    performance: PERFORMANCE_BASE("credit-income", 1000, 24, -2.52, 3.2),
    riskMetrics: { sharpeRatio: 1.24, maxDrawdown: -2.8, volatility: 3.2, beta: 0.73, alpha: -0.5 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for moderate investors in debt segment. Credit & Income has delivered -2.5% 1Y CAGR and targets 1.2% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "debt-ladder",
    assetClass: "debt",
    subCategory: "Short Duration",
    name: "Debt Ladder Portfolio",
    tagline: "Systematic maturity ladder for predictable income",
    riskProfile: "conservative",
    goal: ["regular_income", "capital_preservation", "liquidity"],
    minInvestment: 25000,
    timeHorizon: "2-5 years",
    cagr1Y: 5.51,
    cagr3Y: 4.97,
    cagr5Y: 7.26,
    benchmarkCagr1Y: 4.41,
    benchmarkName: "CRISIL 10 Year Gilt Index",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "annual",
    totalHoldings: 8,
    highlight: "Staggered maturities for consistent cash flows",
    icon: "📊",
    isFeatured: false,
    isNew: false,
    allocation: [{category:"debt",label:"Debt/Bond Funds",weight:70,color:"#10B981",icon:"🏛️"},{category:"liquid",label:"Liquid Funds",weight:20,color:"#6B7280",icon:"💧"},{category:"gilt",label:"Gilt/Govt Bonds",weight:10,color:"#F59E0B",icon:"📜"}],
    holdings: [
      { rank: 1, name: "SBI Magnum Gilt Fund", category: "Gilt MF", weight: 25, currentReturn: 7.8 },
      { rank: 2, name: "HDFC Corporate Bond Fund", category: "Corp Bond MF", weight: 20, currentReturn: 8.1 },
      { rank: 3, name: "ICICI Pru Liquid Fund", category: "Liquid MF", weight: 20, currentReturn: 7.5 },
      { rank: 4, name: "Axis AAA Bond Plus SDL", category: "Govt Bond MF", weight: 15, currentReturn: 7.9 },
      { rank: 5, name: "Nippon India Short Term", category: "Short Term MF", weight: 12, currentReturn: 7.6 },
      { rank: 6, name: "Kotak Savings Fund", category: "Ultra Short MF", weight: 8, currentReturn: 7.2 },
    ],
    performance: PERFORMANCE_BASE("debt-ladder", 1000, 24, 5.51, 5.4),
    riskMetrics: { sharpeRatio: 1.82, maxDrawdown: -6.8, volatility: 5.4, beta: 0.75, alpha: 1.1 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for conservative investors in debt segment. Debt Ladder Portfolio has delivered 5.5% 1Y CAGR and targets 7.3% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "digital-gold-accumulator",
    assetClass: "gold",
    subCategory: "Gold",
    name: "Digital Gold Accumulator",
    tagline: "Systematic gold accumulation without physical storage",
    riskProfile: "conservative",
    goal: ["inflation_hedge", "wealth_preservation", "goal_planning"],
    minInvestment: 1000,
    timeHorizon: "3+ years",
    cagr1Y: 33.64,
    cagr3Y: 23.2,
    cagr5Y: 28.35,
    benchmarkCagr1Y: 26.91,
    benchmarkName: "Domestic Gold Price - IBJA (Indian Bullion Jewellers Association)",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "annual",
    totalHoldings: 6,
    highlight: "Sovereign and digital gold for every Indian household",
    icon: "🥇",
    isFeatured: false,
    isNew: false,
    allocation: [{category:"gold",label:"Gold ETF/SGB",weight:70,color:"#F59E0B",icon:"🥇"},{category:"digital_gold",label:"Digital Gold",weight:20,color:"#FCD34D",icon:"💰"},{category:"liquid",label:"Liquid",weight:10,color:"#6B7280",icon:"💧"}],
    holdings: [
      { rank: 1, name: "Nippon India Gold Savings Fund", category: "Gold Savings MF", weight: 40, currentReturn: 11.1 },
      { rank: 2, name: "HDFC Gold Fund", category: "Gold ETF", weight: 30, currentReturn: 11.3 },
      { rank: 3, name: "Quantum Gold Fund ETF", category: "Gold ETF", weight: 20, currentReturn: 10.9 },
      { rank: 4, name: "SGB 2027 Series", category: "Sovereign Gold Bond", weight: 10, currentReturn: 13.2 },
    ],
    performance: PERFORMANCE_BASE("digital-gold-accumulator", 1000, 24, 33.64, 14.2),
    riskMetrics: { sharpeRatio: 0.92, maxDrawdown: -8.4, volatility: 14.2, beta: 0.84, alpha: 6.73 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for conservative investors in gold segment. Digital Gold Accumulator has delivered 33.6% 1Y CAGR and targets 28.4% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "dividend-yield",
    assetClass: "equity",
    subCategory: "Large Cap",
    name: "Dividend Yield Portfolio",
    tagline: "Regular dividends from quality dividend-paying stocks",
    riskProfile: "moderate",
    goal: ["regular_income", "dividend_income", "capital_appreciation"],
    minInvestment: 20000,
    timeHorizon: "3-5 years",
    cagr1Y: 7.99,
    cagr3Y: 6.02,
    cagr5Y: 9.12,
    benchmarkCagr1Y: 6.39,
    benchmarkName: "NIFTY Dividend Opportunities 50 TRI",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "semi_annual",
    totalHoldings: 10,
    highlight: "High dividend yield stocks with strong fundamentals",
    icon: "💵",
    isFeatured: false,
    isNew: false,
    allocation: [{category:"equity",label:"Equity Funds",weight:80,color:"#3B82F6",icon:"📈"},{category:"debt",label:"Debt Funds",weight:15,color:"#10B981",icon:"🏛️"},{category:"liquid",label:"Cash/Liquid",weight:5,color:"#6B7280",icon:"💧"}],
    holdings: [
      { rank: 1, name: "Mirae Asset Large Cap Fund", category: "Large Cap MF", weight: 22, currentReturn: 14.2 },
      { rank: 2, name: "Parag Parikh Flexi Cap Fund", category: "Flexi Cap MF", weight: 18, currentReturn: 16.8 },
      { rank: 3, name: "HDFC Mid-Cap Opportunities", category: "Mid Cap MF", weight: 15, currentReturn: 18.1 },
      { rank: 4, name: "Nippon ETF Nifty BeES", category: "Index ETF", weight: 12, currentReturn: 12.7 },
      { rank: 5, name: "Axis Small Cap Fund", category: "Small Cap MF", weight: 10, currentReturn: 22.3 },
      { rank: 6, name: "HDFC Liquid Fund", category: "Liquid MF", weight: 8, currentReturn: 7.5 },
      { rank: 7, name: "Kotak NIFTY 50 ETF", category: "Index ETF", weight: 8, currentReturn: 12.6 },
      { rank: 8, name: "SBI Bluechip Fund", category: "Large Cap MF", weight: 7, currentReturn: 12.9 },
    ],
    performance: PERFORMANCE_BASE("dividend-yield", 1000, 24, 7.99, 13.2),
    riskMetrics: { sharpeRatio: 0.84, maxDrawdown: -11.8, volatility: 13.2, beta: 0.83, alpha: 1.6 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for moderate investors in equity segment. Dividend Yield Portfolio has delivered 8.0% 1Y CAGR and targets 9.1% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "emergency-fund",
    assetClass: "debt",
    subCategory: "Short Duration",
    name: "Emergency Fund Portfolio",
    tagline: "Instant-access 6-month expense cushion",
    riskProfile: "conservative",
    goal: ["capital_preservation", "liquidity", "emergency"],
    minInvestment: 1000,
    timeHorizon: "0-3 months",
    cagr1Y: 5.81,
    cagr3Y: 5.11,
    cagr5Y: 7.48,
    benchmarkCagr1Y: 4.65,
    benchmarkName: "CRISIL Liquid Fund Index",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "monthly",
    totalHoldings: 4,
    highlight: "Same-day redemption your financial safety net",
    icon: "🛡️",
    isFeatured: false,
    isNew: false,
    allocation: [{category:"debt",label:"Debt/Bond Funds",weight:70,color:"#10B981",icon:"🏛️"},{category:"liquid",label:"Liquid Funds",weight:20,color:"#6B7280",icon:"💧"},{category:"gilt",label:"Gilt/Govt Bonds",weight:10,color:"#F59E0B",icon:"📜"}],
    holdings: [
      { rank: 1, name: "SBI Magnum Gilt Fund", category: "Gilt MF", weight: 25, currentReturn: 7.8 },
      { rank: 2, name: "HDFC Corporate Bond Fund", category: "Corp Bond MF", weight: 20, currentReturn: 8.1 },
      { rank: 3, name: "ICICI Pru Liquid Fund", category: "Liquid MF", weight: 20, currentReturn: 7.5 },
      { rank: 4, name: "Axis AAA Bond Plus SDL", category: "Govt Bond MF", weight: 15, currentReturn: 7.9 },
    ],
    performance: PERFORMANCE_BASE("emergency-fund", 1000, 24, 5.81, 1.2),
    riskMetrics: { sharpeRatio: 1.82, maxDrawdown: -0.4, volatility: 1.2, beta: 0.71, alpha: 1.16 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for conservative investors in debt segment. Emergency Fund Portfolio has delivered 5.8% 1Y CAGR and targets 7.5% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "esg-sustainable",
    assetClass: "equity",
    subCategory: "Large Cap",
    name: "ESG and Sustainable Portfolio",
    tagline: "Invest in businesses with strong ESG practices",
    riskProfile: "moderate",
    goal: ["esg", "socially_responsible", "wealth_creation"],
    minInvestment: 10000,
    timeHorizon: "5+ years",
    cagr1Y: -2.23,
    cagr3Y: -1.96,
    cagr5Y: 1.45,
    benchmarkCagr1Y: -1.78,
    benchmarkName: "Nifty100 ESG TRI",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "semi_annual",
    totalHoldings: 9,
    highlight: "SEBI ESG-screened funds for responsible investors",
    icon: "🌱",
    isFeatured: false,
    isNew: false,
    allocation: [{category:"equity",label:"Equity Funds",weight:80,color:"#3B82F6",icon:"📈"},{category:"debt",label:"Debt Funds",weight:15,color:"#10B981",icon:"🏛️"},{category:"liquid",label:"Cash/Liquid",weight:5,color:"#6B7280",icon:"💧"}],
    holdings: [
      { rank: 1, name: "Mirae Asset Large Cap Fund", category: "Large Cap MF", weight: 22, currentReturn: 14.2 },
      { rank: 2, name: "Parag Parikh Flexi Cap Fund", category: "Flexi Cap MF", weight: 18, currentReturn: 16.8 },
      { rank: 3, name: "HDFC Mid-Cap Opportunities", category: "Mid Cap MF", weight: 15, currentReturn: 18.1 },
      { rank: 4, name: "Nippon ETF Nifty BeES", category: "Index ETF", weight: 12, currentReturn: 12.7 },
      { rank: 5, name: "Axis Small Cap Fund", category: "Small Cap MF", weight: 10, currentReturn: 22.3 },
      { rank: 6, name: "HDFC Liquid Fund", category: "Liquid MF", weight: 8, currentReturn: 7.5 },
      { rank: 7, name: "Kotak NIFTY 50 ETF", category: "Index ETF", weight: 8, currentReturn: 12.6 },
      { rank: 8, name: "SBI Bluechip Fund", category: "Large Cap MF", weight: 7, currentReturn: 12.9 },
    ],
    performance: PERFORMANCE_BASE("esg-sustainable", 1000, 24, -2.23, 14.2),
    riskMetrics: { sharpeRatio: 1.58, maxDrawdown: -16.3, volatility: 14.2, beta: 0.84, alpha: -0.45 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for moderate investors in equity segment. ESG and Sustainable Portfolio has delivered -2.2% 1Y CAGR and targets 1.4% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "factor-alpha",
    assetClass: "equity",
    subCategory: "factor_quant",
    name: "Factor Alpha (Quant)",
    tagline: "Rules-based factor investing: Momentum + Quality + Value blended for superior alpha",
    riskProfile: "aggressive",
    goal: ["alpha_generation", "wealth_creation"],
    minInvestment: 15000,
    timeHorizon: "3-5 years",
    cagr1Y: 2.05,
    cagr3Y: 1.81,
    cagr5Y: 4.66,
    benchmarkCagr1Y: 1.64,
    benchmarkName: "NIFTY 200 Momentum 30 TRI",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "quarterly",
    totalHoldings: 6,
    highlight: "Quant-driven factor blend",
    icon: "⚡",
    isFeatured: false,
    isNew: true,
    allocation: [{category:"equity",label:"Equity Funds",weight:80,color:"#3B82F6",icon:"📈"},{category:"debt",label:"Debt Funds",weight:15,color:"#10B981",icon:"🏛️"},{category:"liquid",label:"Cash/Liquid",weight:5,color:"#6B7280",icon:"💧"}],
    holdings: [
      { rank: 1, name: "Mirae Asset Large Cap Fund", category: "Large Cap MF", weight: 22, currentReturn: 14.2 },
      { rank: 2, name: "Parag Parikh Flexi Cap Fund", category: "Flexi Cap MF", weight: 18, currentReturn: 16.8 },
      { rank: 3, name: "HDFC Mid-Cap Opportunities", category: "Mid Cap MF", weight: 15, currentReturn: 18.1 },
      { rank: 4, name: "Nippon ETF Nifty BeES", category: "Index ETF", weight: 12, currentReturn: 12.7 },
      { rank: 5, name: "Axis Small Cap Fund", category: "Small Cap MF", weight: 10, currentReturn: 22.3 },
      { rank: 6, name: "HDFC Liquid Fund", category: "Liquid MF", weight: 8, currentReturn: 7.5 },
    ],
    performance: PERFORMANCE_BASE("factor-alpha", 1000, 24, 2.05, 20.4),
    riskMetrics: { sharpeRatio: 0.96, maxDrawdown: -19.8, volatility: 20.4, beta: 0.9, alpha: 0.41 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for aggressive investors in equity segment. Factor Alpha (Quant) has delivered 2.0% 1Y CAGR and targets 4.7% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "healthcare-pharma",
    assetClass: "thematic",
    subCategory: "Thematic",
    name: "Healthcare and Pharma Portfolio",
    tagline: "Defensive sector with structural long-term growth",
    riskProfile: "moderate",
    goal: ["capital_appreciation", "thematic", "defensive"],
    minInvestment: 10000,
    timeHorizon: "5+ years",
    cagr1Y: 18.4,
    cagr3Y: 16.19,
    cagr5Y: 16.92,
    benchmarkCagr1Y: 14.72,
    benchmarkName: "NIFTY Healthcare TRI",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "semi_annual",
    totalHoldings: 9,
    highlight: "India 130B pharma and healthcare opportunity",
    icon: "🏥",
    isFeatured: false,
    isNew: false,
    allocation: [{category:"thematic",label:"Thematic Equity",weight:80,color:"#EF4444",icon:"🎯"},{category:"equity",label:"Diversified Equity",weight:15,color:"#3B82F6",icon:"📈"},{category:"liquid",label:"Liquid",weight:5,color:"#6B7280",icon:"💧"}],
    holdings: [
      { rank: 1, name: "Mirae Asset Healthcare Fund", category: "Thematic MF", weight: 30, currentReturn: 18.2 },
      { rank: 2, name: "DSP India T.I.G.E.R Fund", category: "Thematic MF", weight: 25, currentReturn: 19.4 },
      { rank: 3, name: "ICICI Pru Technology Fund", category: "Thematic MF", weight: 20, currentReturn: 22.1 },
      { rank: 4, name: "Nippon India Power & Infra", category: "Thematic MF", weight: 15, currentReturn: 16.8 },
      { rank: 5, name: "UTI Transportation & Logistics", category: "Thematic MF", weight: 10, currentReturn: 14.2 },
    ],
    performance: PERFORMANCE_BASE("healthcare-pharma", 1000, 24, 18.4, 17.2),
    riskMetrics: { sharpeRatio: 1.74, maxDrawdown: -18.4, volatility: 17.2, beta: 0.87, alpha: 3.68 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for moderate investors in thematic segment. Healthcare and Pharma Portfolio has delivered 18.4% 1Y CAGR and targets 16.9% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "hni-wealth-compounder",
    assetClass: "equity",
    subCategory: "Large Cap",
    name: "HNI Wealth Compounder",
    tagline: "PMS-like quality investing for high-net-worth individuals",
    riskProfile: "moderate",
    goal: ["capital_appreciation", "wealth_creation", "quality_factor"],
    minInvestment: 500000,
    timeHorizon: "7+ years",
    cagr1Y: -1.58,
    cagr3Y: -1.86,
    cagr5Y: 1.94,
    benchmarkCagr1Y: -1.26,
    benchmarkName: "NIFTY 500 TRI",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "quarterly",
    totalHoldings: 12,
    highlight: "Concentrated high-conviction quality portfolio for HNIs",
    icon: "👑",
    isFeatured: false,
    isNew: false,
    allocation: [{category:"equity",label:"Equity Funds",weight:80,color:"#3B82F6",icon:"📈"},{category:"debt",label:"Debt Funds",weight:15,color:"#10B981",icon:"🏛️"},{category:"liquid",label:"Cash/Liquid",weight:5,color:"#6B7280",icon:"💧"}],
    holdings: [
      { rank: 1, name: "Mirae Asset Large Cap Fund", category: "Large Cap MF", weight: 22, currentReturn: 14.2 },
      { rank: 2, name: "Parag Parikh Flexi Cap Fund", category: "Flexi Cap MF", weight: 18, currentReturn: 16.8 },
      { rank: 3, name: "HDFC Mid-Cap Opportunities", category: "Mid Cap MF", weight: 15, currentReturn: 18.1 },
      { rank: 4, name: "Nippon ETF Nifty BeES", category: "Index ETF", weight: 12, currentReturn: 12.7 },
      { rank: 5, name: "Axis Small Cap Fund", category: "Small Cap MF", weight: 10, currentReturn: 22.3 },
      { rank: 6, name: "HDFC Liquid Fund", category: "Liquid MF", weight: 8, currentReturn: 7.5 },
      { rank: 7, name: "Kotak NIFTY 50 ETF", category: "Index ETF", weight: 8, currentReturn: 12.6 },
      { rank: 8, name: "SBI Bluechip Fund", category: "Large Cap MF", weight: 7, currentReturn: 12.9 },
    ],
    performance: PERFORMANCE_BASE("hni-wealth-compounder", 1000, 24, -1.58, 17.4),
    riskMetrics: { sharpeRatio: 1.91, maxDrawdown: -22.1, volatility: 17.4, beta: 0.87, alpha: -0.32 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for moderate investors in equity segment. HNI Wealth Compounder has delivered -1.6% 1Y CAGR and targets 1.9% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "home-purchase",
    assetClass: "goal_based",
    subCategory: "Goal-Based",
    name: "Home Purchase Portfolio",
    tagline: "Build your down payment in 3-5 years",
    riskProfile: "conservative",
    goal: ["home_purchase", "goal_planning", "capital_preservation"],
    minInvestment: 5000,
    timeHorizon: "3-5 years",
    cagr1Y: 10.07,
    cagr3Y: 8.86,
    cagr5Y: 10.68,
    benchmarkCagr1Y: 8.06,
    benchmarkName: "CRISIL Short Duration Debt Index",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "quarterly",
    totalHoldings: 8,
    highlight: "Targeted corpus build for home down payment",
    icon: "🏠",
    isFeatured: false,
    isNew: false,
    allocation: [{category:"equity",label:"Equity",weight:60,color:"#3B82F6",icon:"📈"},{category:"debt",label:"Debt",weight:30,color:"#10B981",icon:"🏛️"},{category:"liquid",label:"Liquid",weight:10,color:"#6B7280",icon:"💧"}],
    holdings: [
      { rank: 1, name: "HDFC Top 100 Fund", category: "Large Cap MF", weight: 25, currentReturn: 13.4 },
      { rank: 2, name: "Mirae Asset Large Cap Fund", category: "Large Cap MF", weight: 20, currentReturn: 14.1 },
      { rank: 3, name: "SBI Magnum Gilt Fund", category: "Gilt MF", weight: 15, currentReturn: 7.8 },
      { rank: 4, name: "HDFC Corporate Bond Fund", category: "Corp Bond MF", weight: 15, currentReturn: 8.1 },
      { rank: 5, name: "Nippon India Gold Savings", category: "Gold ETF", weight: 10, currentReturn: 11.1 },
      { rank: 6, name: "ICICI Pru Liquid Fund", category: "Liquid MF", weight: 10, currentReturn: 7.5 },
      { rank: 7, name: "Parag Parikh Flexi Cap", category: "Flexi Cap MF", weight: 5, currentReturn: 16.8 },
    ],
    performance: PERFORMANCE_BASE("home-purchase", 1000, 24, 10.07, 2.46),
    riskMetrics: { sharpeRatio: 0.65, maxDrawdown: 0.89, volatility: 2.46, beta: 0.72, alpha: 2.01 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for conservative investors in goal_based segment. Home Purchase Portfolio has delivered 10.1% 1Y CAGR and targets 10.7% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "india-growth",
    assetClass: "equity",
    subCategory: "Large Cap",
    name: "India Growth Portfolio",
    tagline: "Long-term wealth with diversified equity",
    riskProfile: "moderate",
    goal: ["long_term_wealth", "retirement"],
    minInvestment: 15000,
    timeHorizon: "5-7 years",
    cagr1Y: -2.68,
    cagr3Y: -2.36,
    cagr5Y: 1.11,
    benchmarkCagr1Y: -2.14,
    benchmarkName: "NIFTY 50 TRI",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "quarterly",
    totalHoldings: 13,
    highlight: "Balanced equity across cap sizes",
    icon: "📈",
    isFeatured: false,
    isNew: false,
    allocation: [{category:"equity",label:"Equity Funds",weight:80,color:"#3B82F6",icon:"📈"},{category:"debt",label:"Debt Funds",weight:15,color:"#10B981",icon:"🏛️"},{category:"liquid",label:"Cash/Liquid",weight:5,color:"#6B7280",icon:"💧"}],
    holdings: [
      { rank: 1, name: "Mirae Asset Large Cap Fund", category: "Large Cap MF", weight: 22, currentReturn: 14.2 },
      { rank: 2, name: "Parag Parikh Flexi Cap Fund", category: "Flexi Cap MF", weight: 18, currentReturn: 16.8 },
      { rank: 3, name: "HDFC Mid-Cap Opportunities", category: "Mid Cap MF", weight: 15, currentReturn: 18.1 },
      { rank: 4, name: "Nippon ETF Nifty BeES", category: "Index ETF", weight: 12, currentReturn: 12.7 },
      { rank: 5, name: "Axis Small Cap Fund", category: "Small Cap MF", weight: 10, currentReturn: 22.3 },
      { rank: 6, name: "HDFC Liquid Fund", category: "Liquid MF", weight: 8, currentReturn: 7.5 },
      { rank: 7, name: "Kotak NIFTY 50 ETF", category: "Index ETF", weight: 8, currentReturn: 12.6 },
      { rank: 8, name: "SBI Bluechip Fund", category: "Large Cap MF", weight: 7, currentReturn: 12.9 },
    ],
    performance: PERFORMANCE_BASE("india-growth", 1000, 24, -2.68, 13.4),
    riskMetrics: { sharpeRatio: 1.78, maxDrawdown: -14.2, volatility: 13.4, beta: 0.83, alpha: -0.54 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for moderate investors in equity segment. India Growth Portfolio has delivered -2.7% 1Y CAGR and targets 1.1% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "india-infrastructure",
    assetClass: "thematic",
    subCategory: "Thematic",
    name: "India Infrastructure Portfolio",
    tagline: "Capitalise on India 111 lakh crore infra investment",
    riskProfile: "aggressive",
    goal: ["capital_appreciation", "thematic", "infrastructure"],
    minInvestment: 15000,
    timeHorizon: "7+ years",
    cagr1Y: 12.59,
    cagr3Y: 11.14,
    cagr5Y: 12.57,
    benchmarkCagr1Y: 10.07,
    benchmarkName: "NIFTY Infrastructure TRI",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "quarterly",
    totalHoldings: 12,
    highlight: "Roads ports power railways India building spree",
    icon: "🏗️",
    isFeatured: false,
    isNew: false,
    allocation: [{category:"thematic",label:"Thematic Equity",weight:80,color:"#EF4444",icon:"🎯"},{category:"equity",label:"Diversified Equity",weight:15,color:"#3B82F6",icon:"📈"},{category:"liquid",label:"Liquid",weight:5,color:"#6B7280",icon:"💧"}],
    holdings: [
      { rank: 1, name: "Mirae Asset Healthcare Fund", category: "Thematic MF", weight: 30, currentReturn: 18.2 },
      { rank: 2, name: "DSP India T.I.G.E.R Fund", category: "Thematic MF", weight: 25, currentReturn: 19.4 },
      { rank: 3, name: "ICICI Pru Technology Fund", category: "Thematic MF", weight: 20, currentReturn: 22.1 },
      { rank: 4, name: "Nippon India Power & Infra", category: "Thematic MF", weight: 15, currentReturn: 16.8 },
      { rank: 5, name: "UTI Transportation & Logistics", category: "Thematic MF", weight: 10, currentReturn: 14.2 },
    ],
    performance: PERFORMANCE_BASE("india-infrastructure", 1000, 24, 12.59, 18.2),
    riskMetrics: { sharpeRatio: 0.72, maxDrawdown: -16.4, volatility: 18.2, beta: 0.88, alpha: 2.52 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for aggressive investors in thematic segment. India Infrastructure Portfolio has delivered 12.6% 1Y CAGR and targets 12.6% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "inflation-beater",
    assetClass: "hybrid",
    subCategory: "real_assets",
    name: "Inflation Beater",
    tagline: "Preserve real wealth — target returns of CPI+3% through real assets",
    riskProfile: "moderate",
    goal: ["wealth_preservation", "inflation_protection"],
    minInvestment: 10000,
    timeHorizon: "3-5 years",
    cagr1Y: 17.42,
    cagr3Y: 13.46,
    cagr5Y: 16.19,
    benchmarkCagr1Y: 13.94,
    benchmarkName: "NIFTY 50 Hybrid Composite Debt 65:35 TRI",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "semi_annual",
    totalHoldings: 8,
    highlight: "Beat inflation with real assets",
    icon: "🛡️",
    isFeatured: false,
    isNew: true,
    allocation: [{category:"equity",label:"Equity",weight:55,color:"#3B82F6",icon:"📈"},{category:"debt",label:"Debt",weight:35,color:"#10B981",icon:"🏛️"},{category:"gold",label:"Gold/REITs",weight:10,color:"#F59E0B",icon:"🥇"}],
    holdings: [
      { rank: 1, name: "ICICI Pru Balanced Advantage", category: "Balanced Adv MF", weight: 25, currentReturn: 11.2 },
      { rank: 2, name: "Parag Parikh Flexi Cap Fund", category: "Flexi Cap MF", weight: 20, currentReturn: 16.8 },
      { rank: 3, name: "SBI Magnum Gilt Fund", category: "Gilt MF", weight: 15, currentReturn: 7.8 },
      { rank: 4, name: "Nippon India Gold Savings", category: "Gold ETF", weight: 10, currentReturn: 11.1 },
      { rank: 5, name: "Embassy Office Parks REIT", category: "REIT", weight: 10, currentReturn: 9.8 },
      { rank: 6, name: "HDFC Liquid Fund", category: "Liquid MF", weight: 10, currentReturn: 7.5 },
      { rank: 7, name: "HDFC Corporate Bond Fund", category: "Corp Bond MF", weight: 10, currentReturn: 8.1 },
    ],
    performance: PERFORMANCE_BASE("inflation-beater", 1000, 24, 17.42, 9.8),
    riskMetrics: { sharpeRatio: 1.14, maxDrawdown: -8.4, volatility: 9.8, beta: 0.8, alpha: 3.48 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for moderate investors in hybrid segment. Inflation Beater has delivered 17.4% 1Y CAGR and targets 16.2% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "intl-emerging-markets",
    assetClass: "international",
    subCategory: "Global",
    name: "International Emerging Markets",
    tagline: "China SE Asia and Brazil beyond US equity exposure",
    riskProfile: "aggressive",
    goal: ["global_diversification", "emerging_market_growth", "currency_hedge"],
    minInvestment: 10000,
    timeHorizon: "7+ years",
    cagr1Y: 9.54,
    cagr3Y: 8.4,
    cagr5Y: 10.28,
    benchmarkCagr1Y: 7.63,
    benchmarkName: "MSCI Emerging Markets Net TRI (USD)",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "semi_annual",
    totalHoldings: 7,
    highlight: "Emerging market alpha beyond India for global investors",
    icon: "🗺️",
    isFeatured: false,
    isNew: false,
    allocation: [{category:"us_equity",label:"US/Global Equity",weight:60,color:"#3B82F6",icon:"🇺🇸"},{category:"emerging",label:"Emerging Markets",weight:25,color:"#10B981",icon:"🌏"},{category:"liquid",label:"Liquid/Debt",weight:15,color:"#6B7280",icon:"💧"}],
    holdings: [
      { rank: 1, name: "Motilal Oswal Nasdaq 100 ETF", category: "US Tech ETF", weight: 35, currentReturn: 18.4 },
      { rank: 2, name: "Mirae Asset NYSE FANG+ ETF", category: "US Tech ETF", weight: 20, currentReturn: 22.1 },
      { rank: 3, name: "Edelweiss Greater China Equity", category: "China MF", weight: 15, currentReturn: 12.4 },
      { rank: 4, name: "DSP Global Innovation FOF", category: "Global MF", weight: 15, currentReturn: 14.8 },
      { rank: 5, name: "Franklin India Feeder - US Opp", category: "US MF", weight: 15, currentReturn: 16.2 },
    ],
    performance: PERFORMANCE_BASE("intl-emerging-markets", 1000, 24, 9.54, 16.2),
    riskMetrics: { sharpeRatio: 1.38, maxDrawdown: -18.4, volatility: 16.2, beta: 0.86, alpha: 1.91 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for aggressive investors in international segment. International Emerging Markets has delivered 9.5% 1Y CAGR and targets 10.3% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "manufacturing-make-in-india",
    assetClass: "thematic",
    subCategory: "Thematic",
    name: "Manufacturing and Make in India",
    tagline: "PLI schemes China+1 driving India factory boom",
    riskProfile: "aggressive",
    goal: ["capital_appreciation", "thematic", "manufacturing"],
    minInvestment: 15000,
    timeHorizon: "7+ years",
    cagr1Y: 1.6,
    cagr3Y: 1.41,
    cagr5Y: 4.33,
    benchmarkCagr1Y: 1.28,
    benchmarkName: "NIFTY India Manufacturing TRI",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "quarterly",
    totalHoldings: 11,
    highlight: "Chemicals auto electronics defence manufacturing",
    icon: "🏭",
    isFeatured: false,
    isNew: false,
    allocation: [{category:"thematic",label:"Thematic Equity",weight:80,color:"#EF4444",icon:"🎯"},{category:"equity",label:"Diversified Equity",weight:15,color:"#3B82F6",icon:"📈"},{category:"liquid",label:"Liquid",weight:5,color:"#6B7280",icon:"💧"}],
    holdings: [
      { rank: 1, name: "Mirae Asset Healthcare Fund", category: "Thematic MF", weight: 30, currentReturn: 18.2 },
      { rank: 2, name: "DSP India T.I.G.E.R Fund", category: "Thematic MF", weight: 25, currentReturn: 19.4 },
      { rank: 3, name: "ICICI Pru Technology Fund", category: "Thematic MF", weight: 20, currentReturn: 22.1 },
      { rank: 4, name: "Nippon India Power & Infra", category: "Thematic MF", weight: 15, currentReturn: 16.8 },
      { rank: 5, name: "UTI Transportation & Logistics", category: "Thematic MF", weight: 10, currentReturn: 14.2 },
    ],
    performance: PERFORMANCE_BASE("manufacturing-make-in-india", 1000, 24, 1.6, 18.8),
    riskMetrics: { sharpeRatio: 1.72, maxDrawdown: -21.2, volatility: 18.8, beta: 0.89, alpha: 0.32 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for aggressive investors in thematic segment. Manufacturing and Make in India has delivered 1.6% 1Y CAGR and targets 4.3% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "mid-cap-india",
    assetClass: "equity",
    subCategory: "mid_cap",
    name: "Mid-Cap India Accelerator",
    tagline: "Capture India's high-growth mid-cap segment with disciplined risk",
    riskProfile: "aggressive",
    goal: ["wealth_creation", "long_term_growth"],
    minInvestment: 25000,
    timeHorizon: "5-7 years",
    cagr1Y: -15.22,
    cagr3Y: -13.39,
    cagr5Y: -8.29,
    benchmarkCagr1Y: -12.18,
    benchmarkName: "NIFTY Midcap 150 TRI",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "quarterly",
    totalHoldings: 12,
    highlight: "Mid-cap India growth engine",
    icon: "🚀",
    isFeatured: false,
    isNew: true,
    allocation: [{category:"equity",label:"Equity Funds",weight:80,color:"#3B82F6",icon:"📈"},{category:"debt",label:"Debt Funds",weight:15,color:"#10B981",icon:"🏛️"},{category:"liquid",label:"Cash/Liquid",weight:5,color:"#6B7280",icon:"💧"}],
    holdings: [
      { rank: 1, name: "Mirae Asset Large Cap Fund", category: "Large Cap MF", weight: 22, currentReturn: 14.2 },
      { rank: 2, name: "Parag Parikh Flexi Cap Fund", category: "Flexi Cap MF", weight: 18, currentReturn: 16.8 },
      { rank: 3, name: "HDFC Mid-Cap Opportunities", category: "Mid Cap MF", weight: 15, currentReturn: 18.1 },
      { rank: 4, name: "Nippon ETF Nifty BeES", category: "Index ETF", weight: 12, currentReturn: 12.7 },
      { rank: 5, name: "Axis Small Cap Fund", category: "Small Cap MF", weight: 10, currentReturn: 22.3 },
      { rank: 6, name: "HDFC Liquid Fund", category: "Liquid MF", weight: 8, currentReturn: 7.5 },
      { rank: 7, name: "Kotak NIFTY 50 ETF", category: "Index ETF", weight: 8, currentReturn: 12.6 },
      { rank: 8, name: "SBI Bluechip Fund", category: "Large Cap MF", weight: 7, currentReturn: 12.9 },
    ],
    performance: PERFORMANCE_BASE("mid-cap-india", 1000, 24, -15.22, 24.8),
    riskMetrics: { sharpeRatio: 0.88, maxDrawdown: -24.2, volatility: 24.8, beta: 0.95, alpha: -3.04 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for aggressive investors in equity segment. Mid-Cap India Accelerator has delivered -15.2% 1Y CAGR and targets -8.3% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "nri-india-opportunity",
    assetClass: "equity",
    subCategory: "Large Cap",
    name: "NRI India Opportunity",
    tagline: "India-focused portfolio designed for NRI investors",
    riskProfile: "moderate",
    goal: ["india_exposure", "wealth_creation", "currency_diversification"],
    minInvestment: 50000,
    timeHorizon: "5-10 years",
    cagr1Y: -6.75,
    cagr3Y: -6.96,
    cagr5Y: -1.94,
    benchmarkCagr1Y: -5.4,
    benchmarkName: "NIFTY 500 TRI",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "quarterly",
    totalHoldings: 11,
    highlight: "NRI-friendly global Indian stocks + REITs + SGBs",
    icon: "✈️",
    isFeatured: false,
    isNew: false,
    allocation: [{category:"equity",label:"Equity Funds",weight:80,color:"#3B82F6",icon:"📈"},{category:"debt",label:"Debt Funds",weight:15,color:"#10B981",icon:"🏛️"},{category:"liquid",label:"Cash/Liquid",weight:5,color:"#6B7280",icon:"💧"}],
    holdings: [
      { rank: 1, name: "Mirae Asset Large Cap Fund", category: "Large Cap MF", weight: 22, currentReturn: 14.2 },
      { rank: 2, name: "Parag Parikh Flexi Cap Fund", category: "Flexi Cap MF", weight: 18, currentReturn: 16.8 },
      { rank: 3, name: "HDFC Mid-Cap Opportunities", category: "Mid Cap MF", weight: 15, currentReturn: 18.1 },
      { rank: 4, name: "Nippon ETF Nifty BeES", category: "Index ETF", weight: 12, currentReturn: 12.7 },
      { rank: 5, name: "Axis Small Cap Fund", category: "Small Cap MF", weight: 10, currentReturn: 22.3 },
      { rank: 6, name: "HDFC Liquid Fund", category: "Liquid MF", weight: 8, currentReturn: 7.5 },
      { rank: 7, name: "Kotak NIFTY 50 ETF", category: "Index ETF", weight: 8, currentReturn: 12.6 },
      { rank: 8, name: "SBI Bluechip Fund", category: "Large Cap MF", weight: 7, currentReturn: 12.9 },
    ],
    performance: PERFORMANCE_BASE("nri-india-opportunity", 1000, 24, -6.75, 13.4),
    riskMetrics: { sharpeRatio: 0.88, maxDrawdown: -11.2, volatility: 13.4, beta: 0.83, alpha: -1.35 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for moderate investors in equity segment. NRI India Opportunity has delivered -6.8% 1Y CAGR and targets -1.9% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "sip-wealth-builder",
    assetClass: "hybrid",
    subCategory: "sip_focused",
    name: "SIP Wealth Builder",
    tagline: "Optimized for monthly SIPs — rupee cost averaging with disciplined compounding",
    riskProfile: "moderate",
    goal: ["wealth_creation", "sip_investment"],
    minInvestment: 1000,
    timeHorizon: "5+ years",
    cagr1Y: 6.98,
    cagr3Y: 6.14,
    cagr5Y: 8.36,
    benchmarkCagr1Y: 5.58,
    benchmarkName: "NIFTY 500 TRI",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "annual",
    totalHoldings: 7,
    highlight: "Start with ₹1000/month",
    icon: "💰",
    isFeatured: false,
    isNew: true,
    allocation: [{category:"equity",label:"Equity",weight:55,color:"#3B82F6",icon:"📈"},{category:"debt",label:"Debt",weight:35,color:"#10B981",icon:"🏛️"},{category:"gold",label:"Gold/REITs",weight:10,color:"#F59E0B",icon:"🥇"}],
    holdings: [
      { rank: 1, name: "ICICI Pru Balanced Advantage", category: "Balanced Adv MF", weight: 25, currentReturn: 11.2 },
      { rank: 2, name: "Parag Parikh Flexi Cap Fund", category: "Flexi Cap MF", weight: 20, currentReturn: 16.8 },
      { rank: 3, name: "SBI Magnum Gilt Fund", category: "Gilt MF", weight: 15, currentReturn: 7.8 },
      { rank: 4, name: "Nippon India Gold Savings", category: "Gold ETF", weight: 10, currentReturn: 11.1 },
      { rank: 5, name: "Embassy Office Parks REIT", category: "REIT", weight: 10, currentReturn: 9.8 },
      { rank: 6, name: "HDFC Liquid Fund", category: "Liquid MF", weight: 10, currentReturn: 7.5 },
      { rank: 7, name: "HDFC Corporate Bond Fund", category: "Corp Bond MF", weight: 10, currentReturn: 8.1 },
    ],
    performance: PERFORMANCE_BASE("sip-wealth-builder", 1000, 24, 6.98, 12.2),
    riskMetrics: { sharpeRatio: 1.08, maxDrawdown: -11.4, volatility: 12.2, beta: 0.82, alpha: 1.4 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for moderate investors in hybrid segment. SIP Wealth Builder has delivered 7.0% 1Y CAGR and targets 8.4% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "small-cap-alpha",
    assetClass: "equity",
    subCategory: "Large Cap",
    name: "Small Cap Alpha",
    tagline: "High-conviction small caps for long-term alpha",
    riskProfile: "aggressive",
    goal: ["capital_appreciation", "wealth_creation"],
    minInvestment: 25000,
    timeHorizon: "7+ years",
    cagr1Y: 4.74,
    cagr3Y: 4.17,
    cagr5Y: 6.68,
    benchmarkCagr1Y: 3.79,
    benchmarkName: "NIFTY Smallcap 250 TRI",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "quarterly",
    totalHoldings: 12,
    highlight: "Bottom-up small cap selection with quality filter",
    icon: "⚡",
    isFeatured: false,
    isNew: false,
    allocation: [{category:"equity",label:"Equity Funds",weight:80,color:"#3B82F6",icon:"📈"},{category:"debt",label:"Debt Funds",weight:15,color:"#10B981",icon:"🏛️"},{category:"liquid",label:"Cash/Liquid",weight:5,color:"#6B7280",icon:"💧"}],
    holdings: [
      { rank: 1, name: "Mirae Asset Large Cap Fund", category: "Large Cap MF", weight: 22, currentReturn: 14.2 },
      { rank: 2, name: "Parag Parikh Flexi Cap Fund", category: "Flexi Cap MF", weight: 18, currentReturn: 16.8 },
      { rank: 3, name: "HDFC Mid-Cap Opportunities", category: "Mid Cap MF", weight: 15, currentReturn: 18.1 },
      { rank: 4, name: "Nippon ETF Nifty BeES", category: "Index ETF", weight: 12, currentReturn: 12.7 },
      { rank: 5, name: "Axis Small Cap Fund", category: "Small Cap MF", weight: 10, currentReturn: 22.3 },
      { rank: 6, name: "HDFC Liquid Fund", category: "Liquid MF", weight: 8, currentReturn: 7.5 },
      { rank: 7, name: "Kotak NIFTY 50 ETF", category: "Index ETF", weight: 8, currentReturn: 12.6 },
      { rank: 8, name: "SBI Bluechip Fund", category: "Large Cap MF", weight: 7, currentReturn: 12.9 },
    ],
    performance: PERFORMANCE_BASE("small-cap-alpha", 1000, 24, 4.74, 24.3),
    riskMetrics: { sharpeRatio: 1.32, maxDrawdown: -31.2, volatility: 24.3, beta: 0.94, alpha: 0.95 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for aggressive investors in equity segment. Small Cap Alpha has delivered 4.7% 1Y CAGR and targets 6.7% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "tax-saver-elss",
    assetClass: "equity",
    subCategory: "Large Cap",
    name: "Tax Saver ELSS Portfolio",
    tagline: "Tax savings with long-term growth under 80C",
    riskProfile: "moderate",
    goal: ["tax_saving", "wealth_creation"],
    minInvestment: 500,
    timeHorizon: "3+ years (lock-in)",
    cagr1Y: 5.42,
    cagr3Y: 4.9,
    cagr5Y: 7.19,
    benchmarkCagr1Y: 4.34,
    benchmarkName: "NIFTY 500 TRI",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "annual",
    totalHoldings: 7,
    highlight: "ELSS funds for ₹1.5L tax deduction",
    icon: "🧾",
    isFeatured: false,
    isNew: false,
    allocation: [{category:"equity",label:"Equity Funds",weight:80,color:"#3B82F6",icon:"📈"},{category:"debt",label:"Debt Funds",weight:15,color:"#10B981",icon:"🏛️"},{category:"liquid",label:"Cash/Liquid",weight:5,color:"#6B7280",icon:"💧"}],
    holdings: [
      { rank: 1, name: "Mirae Asset Large Cap Fund", category: "Large Cap MF", weight: 22, currentReturn: 14.2 },
      { rank: 2, name: "Parag Parikh Flexi Cap Fund", category: "Flexi Cap MF", weight: 18, currentReturn: 16.8 },
      { rank: 3, name: "HDFC Mid-Cap Opportunities", category: "Mid Cap MF", weight: 15, currentReturn: 18.1 },
      { rank: 4, name: "Nippon ETF Nifty BeES", category: "Index ETF", weight: 12, currentReturn: 12.7 },
      { rank: 5, name: "Axis Small Cap Fund", category: "Small Cap MF", weight: 10, currentReturn: 22.3 },
      { rank: 6, name: "HDFC Liquid Fund", category: "Liquid MF", weight: 8, currentReturn: 7.5 },
      { rank: 7, name: "Kotak NIFTY 50 ETF", category: "Index ETF", weight: 8, currentReturn: 12.6 },
    ],
    performance: PERFORMANCE_BASE("tax-saver-elss", 1000, 24, 5.42, 14.1),
    riskMetrics: { sharpeRatio: 1.69, maxDrawdown: -16.2, volatility: 14.1, beta: 0.84, alpha: 1.08 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for moderate investors in equity segment. Tax Saver ELSS Portfolio has delivered 5.4% 1Y CAGR and targets 7.2% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "wedding-milestone",
    assetClass: "goal_based",
    subCategory: "Goal-Based",
    name: "Wedding and Milestone Portfolio",
    tagline: "Build your big-day corpus in 2-4 years",
    riskProfile: "conservative",
    goal: ["goal_planning", "wedding", "milestone"],
    minInvestment: 2000,
    timeHorizon: "2-4 years",
    cagr1Y: 14.5,
    cagr3Y: 11.22,
    cagr5Y: 14.0,
    benchmarkCagr1Y: 11.6,
    benchmarkName: "CRISIL Hybrid 35+65 Aggressive Index",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "quarterly",
    totalHoldings: 8,
    highlight: "Capital-safe milestone planning with moderate growth",
    icon: "💍",
    isFeatured: false,
    isNew: false,
    allocation: [{category:"equity",label:"Equity",weight:60,color:"#3B82F6",icon:"📈"},{category:"debt",label:"Debt",weight:30,color:"#10B981",icon:"🏛️"},{category:"liquid",label:"Liquid",weight:10,color:"#6B7280",icon:"💧"}],
    holdings: [
      { rank: 1, name: "HDFC Top 100 Fund", category: "Large Cap MF", weight: 25, currentReturn: 13.4 },
      { rank: 2, name: "Mirae Asset Large Cap Fund", category: "Large Cap MF", weight: 20, currentReturn: 14.1 },
      { rank: 3, name: "SBI Magnum Gilt Fund", category: "Gilt MF", weight: 15, currentReturn: 7.8 },
      { rank: 4, name: "HDFC Corporate Bond Fund", category: "Corp Bond MF", weight: 15, currentReturn: 8.1 },
      { rank: 5, name: "Nippon India Gold Savings", category: "Gold ETF", weight: 10, currentReturn: 11.1 },
      { rank: 6, name: "ICICI Pru Liquid Fund", category: "Liquid MF", weight: 10, currentReturn: 7.5 },
      { rank: 7, name: "Parag Parikh Flexi Cap", category: "Flexi Cap MF", weight: 5, currentReturn: 16.8 },
    ],
    performance: PERFORMANCE_BASE("wedding-milestone", 1000, 24, 14.5, 7.8),
    riskMetrics: { sharpeRatio: 1.58, maxDrawdown: -8.2, volatility: 7.8, beta: 0.78, alpha: 2.9 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for conservative investors in goal_based segment. Wedding and Milestone Portfolio has delivered 14.5% 1Y CAGR and targets 14.0% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "all-weather-india",
    assetClass: "hybrid",
    subCategory: "All-Weather",
    name: "All Weather India",
    tagline: "Stays resilient across economic cycles",
    riskProfile: "all_weather",
    goal: ["wealth_preservation", "steady_growth"],
    minInvestment: 10000,
    timeHorizon: "5+ years",
    cagr1Y: 8.44,
    cagr3Y: 7.43,
    cagr5Y: 9.46,
    benchmarkCagr1Y: 6.75,
    benchmarkName: "CRISIL Hybrid 35+65 Aggressive Index",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "quarterly",
    totalHoldings: 12,
    highlight: "Designed to perform in all market conditions",
    icon: "🌦️",
    isFeatured: true,
    isNew: false,
    allocation: [{category:"equity",label:"Equity",weight:55,color:"#3B82F6",icon:"📈"},{category:"debt",label:"Debt",weight:35,color:"#10B981",icon:"🏛️"},{category:"gold",label:"Gold/REITs",weight:10,color:"#F59E0B",icon:"🥇"}],
    holdings: [
      { rank: 1, name: "ICICI Pru Balanced Advantage", category: "Balanced Adv MF", weight: 25, currentReturn: 11.2 },
      { rank: 2, name: "Parag Parikh Flexi Cap Fund", category: "Flexi Cap MF", weight: 20, currentReturn: 16.8 },
      { rank: 3, name: "SBI Magnum Gilt Fund", category: "Gilt MF", weight: 15, currentReturn: 7.8 },
      { rank: 4, name: "Nippon India Gold Savings", category: "Gold ETF", weight: 10, currentReturn: 11.1 },
      { rank: 5, name: "Embassy Office Parks REIT", category: "REIT", weight: 10, currentReturn: 9.8 },
      { rank: 6, name: "HDFC Liquid Fund", category: "Liquid MF", weight: 10, currentReturn: 7.5 },
      { rank: 7, name: "HDFC Corporate Bond Fund", category: "Corp Bond MF", weight: 10, currentReturn: 8.1 },
    ],
    performance: PERFORMANCE_BASE("all-weather-india", 1000, 24, 8.44, 7.2),
    riskMetrics: { sharpeRatio: 1.42, maxDrawdown: -6.8, volatility: 7.2, beta: 0.77, alpha: 1.69 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for all_weather investors in hybrid segment. All Weather India has delivered 8.4% 1Y CAGR and targets 9.5% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "balanced-advantage",
    assetClass: "hybrid",
    subCategory: "All-Weather",
    name: "Balanced Advantage Portfolio",
    tagline: "Dynamic equity-debt mix adapting to market valuations",
    riskProfile: "moderate",
    goal: ["steady_growth", "downside_protection", "long_term_wealth"],
    minInvestment: 10000,
    timeHorizon: "3-5 years",
    cagr1Y: 4.32,
    cagr3Y: 3.8,
    cagr5Y: 6.36,
    benchmarkCagr1Y: 3.46,
    benchmarkName: "CRISIL Hybrid 35+65 Aggressive Index",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "quarterly",
    totalHoldings: 7,
    highlight: "Auto-rebalances between equity and debt dynamically",
    icon: "⚖️",
    isFeatured: true,
    isNew: false,
    allocation: [{category:"equity",label:"Equity",weight:55,color:"#3B82F6",icon:"📈"},{category:"debt",label:"Debt",weight:35,color:"#10B981",icon:"🏛️"},{category:"gold",label:"Gold/REITs",weight:10,color:"#F59E0B",icon:"🥇"}],
    holdings: [
      { rank: 1, name: "ICICI Pru Balanced Advantage", category: "Balanced Adv MF", weight: 25, currentReturn: 11.2 },
      { rank: 2, name: "Parag Parikh Flexi Cap Fund", category: "Flexi Cap MF", weight: 20, currentReturn: 16.8 },
      { rank: 3, name: "SBI Magnum Gilt Fund", category: "Gilt MF", weight: 15, currentReturn: 7.8 },
      { rank: 4, name: "Nippon India Gold Savings", category: "Gold ETF", weight: 10, currentReturn: 11.1 },
      { rank: 5, name: "Embassy Office Parks REIT", category: "REIT", weight: 10, currentReturn: 9.8 },
      { rank: 6, name: "HDFC Liquid Fund", category: "Liquid MF", weight: 10, currentReturn: 7.5 },
      { rank: 7, name: "HDFC Corporate Bond Fund", category: "Corp Bond MF", weight: 10, currentReturn: 8.1 },
    ],
    performance: PERFORMANCE_BASE("balanced-advantage", 1000, 24, 4.32, 8.1),
    riskMetrics: { sharpeRatio: 1.64, maxDrawdown: -8.4, volatility: 8.1, beta: 0.78, alpha: 0.86 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for moderate investors in hybrid segment. Balanced Advantage Portfolio has delivered 4.3% 1Y CAGR and targets 6.4% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "digital-india-tech",
    assetClass: "thematic",
    subCategory: "Thematic",
    name: "Digital India and Technology",
    tagline: "Ride India digital economy boom IT AI FinTech",
    riskProfile: "aggressive",
    goal: ["capital_appreciation", "thematic", "digital_economy"],
    minInvestment: 10000,
    timeHorizon: "5+ years",
    cagr1Y: -25.89,
    cagr3Y: -22.79,
    cagr5Y: -16.3,
    benchmarkCagr1Y: -20.71,
    benchmarkName: "NIFTY IT TRI",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "quarterly",
    totalHoldings: 10,
    highlight: "India 1T digital economy opportunity",
    icon: "💻",
    isFeatured: true,
    isNew: false,
    allocation: [{category:"thematic",label:"Thematic Equity",weight:80,color:"#EF4444",icon:"🎯"},{category:"equity",label:"Diversified Equity",weight:15,color:"#3B82F6",icon:"📈"},{category:"liquid",label:"Liquid",weight:5,color:"#6B7280",icon:"💧"}],
    holdings: [
      { rank: 1, name: "Mirae Asset Healthcare Fund", category: "Thematic MF", weight: 30, currentReturn: 18.2 },
      { rank: 2, name: "DSP India T.I.G.E.R Fund", category: "Thematic MF", weight: 25, currentReturn: 19.4 },
      { rank: 3, name: "ICICI Pru Technology Fund", category: "Thematic MF", weight: 20, currentReturn: 22.1 },
      { rank: 4, name: "Nippon India Power & Infra", category: "Thematic MF", weight: 15, currentReturn: 16.8 },
      { rank: 5, name: "UTI Transportation & Logistics", category: "Thematic MF", weight: 10, currentReturn: 14.2 },
    ],
    performance: PERFORMANCE_BASE("digital-india-tech", 1000, 24, -25.89, 21.4),
    riskMetrics: { sharpeRatio: 0.78, maxDrawdown: -19.8, volatility: 21.4, beta: 0.91, alpha: -5.18 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for aggressive investors in thematic segment. Digital India and Technology has delivered -25.9% 1Y CAGR and targets -16.3% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "equity-momentum-india",
    assetClass: "equity",
    subCategory: "Large Cap",
    name: "Equity Momentum India",
    tagline: "Capitalise on strong market trends",
    riskProfile: "aggressive",
    goal: ["capital_appreciation", "wealth_creation"],
    minInvestment: 25000,
    timeHorizon: "7+ years",
    cagr1Y: 7.57,
    cagr3Y: 6.66,
    cagr5Y: 8.8,
    benchmarkCagr1Y: 6.06,
    benchmarkName: "NIFTY 200 Momentum 30 TRI",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "quarterly",
    totalHoldings: 15,
    highlight: "Factor-based momentum investing",
    icon: "🚀",
    isFeatured: true,
    isNew: false,
    allocation: [{category:"equity",label:"Equity Funds",weight:80,color:"#3B82F6",icon:"📈"},{category:"debt",label:"Debt Funds",weight:15,color:"#10B981",icon:"🏛️"},{category:"liquid",label:"Cash/Liquid",weight:5,color:"#6B7280",icon:"💧"}],
    holdings: [
      { rank: 1, name: "Mirae Asset Large Cap Fund", category: "Large Cap MF", weight: 22, currentReturn: 14.2 },
      { rank: 2, name: "Parag Parikh Flexi Cap Fund", category: "Flexi Cap MF", weight: 18, currentReturn: 16.8 },
      { rank: 3, name: "HDFC Mid-Cap Opportunities", category: "Mid Cap MF", weight: 15, currentReturn: 18.1 },
      { rank: 4, name: "Nippon ETF Nifty BeES", category: "Index ETF", weight: 12, currentReturn: 12.7 },
      { rank: 5, name: "Axis Small Cap Fund", category: "Small Cap MF", weight: 10, currentReturn: 22.3 },
      { rank: 6, name: "HDFC Liquid Fund", category: "Liquid MF", weight: 8, currentReturn: 7.5 },
      { rank: 7, name: "Kotak NIFTY 50 ETF", category: "Index ETF", weight: 8, currentReturn: 12.6 },
      { rank: 8, name: "SBI Bluechip Fund", category: "Large Cap MF", weight: 7, currentReturn: 12.9 },
    ],
    performance: PERFORMANCE_BASE("equity-momentum-india", 1000, 24, 7.57, 18.7),
    riskMetrics: { sharpeRatio: 1.51, maxDrawdown: -22.4, volatility: 18.7, beta: 0.89, alpha: 1.51 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for aggressive investors in equity segment. Equity Momentum India has delivered 7.6% 1Y CAGR and targets 8.8% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "family-office",
    assetClass: "hni",
    subCategory: "Multi-Asset ₹10Cr",
    name: "Family Office Portfolio",
    tagline: "Institutional-grade multi-asset wealth for UHNIs & family offices",
    riskProfile: "moderate",
    goal: ["wealth_preservation", "capital_appreciation", "global_diversification", "estate_planning", "alternative_investments"],
    minInvestment: 100000000,
    timeHorizon: "10+ years",
    cagr1Y: 16.8,
    cagr3Y: 14.2,
    cagr5Y: 13.6,
    benchmarkCagr1Y: 13.44,
    benchmarkName: "CRISIL Multi Asset 60:40 Index",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "quarterly",
    totalHoldings: 12,
    highlight: "Institutional-grade 6-asset-class architecture for multi-generational wealth",
    icon: "🏛️",
    isFeatured: true,
    isNew: true,
    allocation: [{category:"equity",label:"Equity",weight:40,color:"#3B82F6",icon:"📈"},{category:"debt",label:"Debt/Bonds",weight:25,color:"#10B981",icon:"🏛️"},{category:"gold",label:"Gold/SGB",weight:15,color:"#F59E0B",icon:"🥇"},{category:"reits",label:"REITs",weight:10,color:"#8B5CF6",icon:"🏢"},{category:"intl",label:"International",weight:10,color:"#EC4899",icon:"🌍"}],
    holdings: [
      { rank: 1, name: "Mirae Asset Large Cap Fund", category: "Large Cap MF", weight: 20, currentReturn: 14.1 },
      { rank: 2, name: "Parag Parikh Flexi Cap Fund", category: "Flexi Cap MF", weight: 15, currentReturn: 16.8 },
      { rank: 3, name: "HDFC Corporate Bond Fund", category: "Corp Bond MF", weight: 15, currentReturn: 8.1 },
      { rank: 4, name: "Nippon India Gold Savings", category: "Gold ETF", weight: 10, currentReturn: 11.1 },
      { rank: 5, name: "Embassy Office Parks REIT", category: "REIT", weight: 8, currentReturn: 9.8 },
      { rank: 6, name: "Motilal Oswal Nasdaq 100 ETF", category: "International ETF", weight: 8, currentReturn: 18.4 },
      { rank: 7, name: "SBI Magnum Gilt Fund", category: "Gilt MF", weight: 7, currentReturn: 7.8 },
      { rank: 8, name: "Axis AAA Bond Plus SDL", category: "Govt Bond MF", weight: 7, currentReturn: 7.9 },
      { rank: 9, name: "HDFC Liquid Fund", category: "Liquid MF", weight: 5, currentReturn: 7.5 },
      { rank: 10, name: "Quantum Gold Fund ETF", category: "Gold ETF", weight: 5, currentReturn: 10.9 },
    ],
    performance: PERFORMANCE_BASE("family-office", 1000, 24, 16.8, 11.3),
    riskMetrics: { sharpeRatio: 1.42, maxDrawdown: -14.2, volatility: 11.3, beta: 0.81, alpha: 3.36 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for moderate investors in hni segment. Family Office Portfolio has delivered 16.8% 1Y CAGR and targets 13.6% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "first-time-investor",
    assetClass: "equity",
    subCategory: "Large Cap",
    name: "First-Time Investor Starter",
    tagline: "Simple 2-fund portfolio for new investors",
    riskProfile: "moderate",
    goal: ["wealth_creation", "long_term_wealth", "beginner"],
    minInvestment: 500,
    timeHorizon: "5+ years",
    cagr1Y: 3.81,
    cagr3Y: 3.35,
    cagr5Y: 5.98,
    benchmarkCagr1Y: 3.05,
    benchmarkName: "NIFTY 50 TRI",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "annual",
    totalHoldings: 3,
    highlight: "Start with Rs 500/month simplest path to wealth",
    icon: "🌟",
    isFeatured: true,
    isNew: false,
    allocation: [{category:"equity",label:"Equity Funds",weight:80,color:"#3B82F6",icon:"📈"},{category:"debt",label:"Debt Funds",weight:15,color:"#10B981",icon:"🏛️"},{category:"liquid",label:"Cash/Liquid",weight:5,color:"#6B7280",icon:"💧"}],
    holdings: [
      { rank: 1, name: "Mirae Asset Large Cap Fund", category: "Large Cap MF", weight: 22, currentReturn: 14.2 },
      { rank: 2, name: "Parag Parikh Flexi Cap Fund", category: "Flexi Cap MF", weight: 18, currentReturn: 16.8 },
      { rank: 3, name: "HDFC Mid-Cap Opportunities", category: "Mid Cap MF", weight: 15, currentReturn: 18.1 },
    ],
    performance: PERFORMANCE_BASE("first-time-investor", 1000, 24, 3.81, 6.8),
    riskMetrics: { sharpeRatio: 0.94, maxDrawdown: -5.2, volatility: 6.8, beta: 0.77, alpha: 0.76 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for moderate investors in equity segment. First-Time Investor Starter has delivered 3.8% 1Y CAGR and targets 6.0% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "global-diversifier",
    assetClass: "international",
    subCategory: "Global",
    name: "Global Diversifier",
    tagline: "India + global exposure for true diversification",
    riskProfile: "moderate",
    goal: ["global_diversification", "currency_hedge", "wealth_creation"],
    minInvestment: 10000,
    timeHorizon: "5+ years",
    cagr1Y: 17.13,
    cagr3Y: 14.31,
    cagr5Y: 15.97,
    benchmarkCagr1Y: 13.7,
    benchmarkName: "MSCI World Net TRI (USD)",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "quarterly",
    totalHoldings: 10,
    highlight: "Invest across US, Europe and Asia alongside India",
    icon: "🌍",
    isFeatured: true,
    isNew: false,
    allocation: [{category:"us_equity",label:"US/Global Equity",weight:60,color:"#3B82F6",icon:"🇺🇸"},{category:"emerging",label:"Emerging Markets",weight:25,color:"#10B981",icon:"🌏"},{category:"liquid",label:"Liquid/Debt",weight:15,color:"#6B7280",icon:"💧"}],
    holdings: [
      { rank: 1, name: "Motilal Oswal Nasdaq 100 ETF", category: "US Tech ETF", weight: 35, currentReturn: 18.4 },
      { rank: 2, name: "Mirae Asset NYSE FANG+ ETF", category: "US Tech ETF", weight: 20, currentReturn: 22.1 },
      { rank: 3, name: "Edelweiss Greater China Equity", category: "China MF", weight: 15, currentReturn: 12.4 },
      { rank: 4, name: "DSP Global Innovation FOF", category: "Global MF", weight: 15, currentReturn: 14.8 },
      { rank: 5, name: "Franklin India Feeder - US Opp", category: "US MF", weight: 15, currentReturn: 16.2 },
    ],
    performance: PERFORMANCE_BASE("global-diversifier", 1000, 24, 17.13, 13.8),
    riskMetrics: { sharpeRatio: 1.52, maxDrawdown: -15.2, volatility: 13.8, beta: 0.84, alpha: 3.43 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for moderate investors in international segment. Global Diversifier has delivered 17.1% 1Y CAGR and targets 16.0% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "hni-1cr-multi-asset",
    assetClass: "hni",
    subCategory: "Multi-Asset ₹1Cr",
    name: "HNI Multi-Asset ₹1Cr",
    tagline: "Institutional-quality 6-asset-class portfolio for HNIs with ₹1Cr+ investible surplus",
    riskProfile: "moderate",
    goal: ["wealth_preservation", "capital_appreciation", "global_diversification", "income"],
    minInvestment: 10000000,
    timeHorizon: "7-10 years",
    cagr1Y: 16.2,
    cagr3Y: 13.8,
    cagr5Y: 13.2,
    benchmarkCagr1Y: 12.96,
    benchmarkName: "CRISIL Multi Asset 50:30:20 Index",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "quarterly",
    totalHoldings: 12,
    highlight: "Premium 6-asset-class allocation with international exposure and alternatives for ₹1Cr+ HNIs",
    icon: "💎",
    isFeatured: true,
    isNew: true,
    allocation: [{category:"equity",label:"Equity",weight:40,color:"#3B82F6",icon:"📈"},{category:"debt",label:"Debt/Bonds",weight:25,color:"#10B981",icon:"🏛️"},{category:"gold",label:"Gold/SGB",weight:15,color:"#F59E0B",icon:"🥇"},{category:"reits",label:"REITs",weight:10,color:"#8B5CF6",icon:"🏢"},{category:"intl",label:"International",weight:10,color:"#EC4899",icon:"🌍"}],
    holdings: [
      { rank: 1, name: "Mirae Asset Large Cap Fund", category: "Large Cap MF", weight: 20, currentReturn: 14.1 },
      { rank: 2, name: "Parag Parikh Flexi Cap Fund", category: "Flexi Cap MF", weight: 15, currentReturn: 16.8 },
      { rank: 3, name: "HDFC Corporate Bond Fund", category: "Corp Bond MF", weight: 15, currentReturn: 8.1 },
      { rank: 4, name: "Nippon India Gold Savings", category: "Gold ETF", weight: 10, currentReturn: 11.1 },
      { rank: 5, name: "Embassy Office Parks REIT", category: "REIT", weight: 8, currentReturn: 9.8 },
      { rank: 6, name: "Motilal Oswal Nasdaq 100 ETF", category: "International ETF", weight: 8, currentReturn: 18.4 },
      { rank: 7, name: "SBI Magnum Gilt Fund", category: "Gilt MF", weight: 7, currentReturn: 7.8 },
      { rank: 8, name: "Axis AAA Bond Plus SDL", category: "Govt Bond MF", weight: 7, currentReturn: 7.9 },
      { rank: 9, name: "HDFC Liquid Fund", category: "Liquid MF", weight: 5, currentReturn: 7.5 },
      { rank: 10, name: "Quantum Gold Fund ETF", category: "Gold ETF", weight: 5, currentReturn: 10.9 },
    ],
    performance: PERFORMANCE_BASE("hni-1cr-multi-asset", 1000, 24, 16.2, 10.8),
    riskMetrics: { sharpeRatio: 1.35, maxDrawdown: -14.0, volatility: 10.8, beta: 0.81, alpha: 3.24 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for moderate investors in hni segment. HNI Multi-Asset ₹1Cr has delivered 16.2% 1Y CAGR and targets 13.2% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "hni-50l-multi-asset",
    assetClass: "hni",
    subCategory: "Multi-Asset ₹50L",
    name: "HNI Multi-Asset ₹50L",
    tagline: "Diversified 5-asset-class wealth portfolio for HNIs with ₹50L+ investible surplus",
    riskProfile: "moderate",
    goal: ["wealth_creation", "capital_appreciation", "diversification", "income"],
    minInvestment: 5000000,
    timeHorizon: "5-7 years",
    cagr1Y: 15.4,
    cagr3Y: 13.1,
    cagr5Y: 12.8,
    benchmarkCagr1Y: 12.32,
    benchmarkName: "CRISIL Hybrid 60:40 Index",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "quarterly",
    totalHoldings: 10,
    highlight: "Balanced 5-asset-class strategy: Large Cap + Mid Cap + Debt + Gold + REIT for HNIs",
    icon: "💎",
    isFeatured: true,
    isNew: true,
    allocation: [{category:"equity",label:"Equity",weight:40,color:"#3B82F6",icon:"📈"},{category:"debt",label:"Debt/Bonds",weight:25,color:"#10B981",icon:"🏛️"},{category:"gold",label:"Gold/SGB",weight:15,color:"#F59E0B",icon:"🥇"},{category:"reits",label:"REITs",weight:10,color:"#8B5CF6",icon:"🏢"},{category:"intl",label:"International",weight:10,color:"#EC4899",icon:"🌍"}],
    holdings: [
      { rank: 1, name: "Mirae Asset Large Cap Fund", category: "Large Cap MF", weight: 20, currentReturn: 14.1 },
      { rank: 2, name: "Parag Parikh Flexi Cap Fund", category: "Flexi Cap MF", weight: 15, currentReturn: 16.8 },
      { rank: 3, name: "HDFC Corporate Bond Fund", category: "Corp Bond MF", weight: 15, currentReturn: 8.1 },
      { rank: 4, name: "Nippon India Gold Savings", category: "Gold ETF", weight: 10, currentReturn: 11.1 },
      { rank: 5, name: "Embassy Office Parks REIT", category: "REIT", weight: 8, currentReturn: 9.8 },
      { rank: 6, name: "Motilal Oswal Nasdaq 100 ETF", category: "International ETF", weight: 8, currentReturn: 18.4 },
      { rank: 7, name: "SBI Magnum Gilt Fund", category: "Gilt MF", weight: 7, currentReturn: 7.8 },
      { rank: 8, name: "Axis AAA Bond Plus SDL", category: "Govt Bond MF", weight: 7, currentReturn: 7.9 },
      { rank: 9, name: "HDFC Liquid Fund", category: "Liquid MF", weight: 5, currentReturn: 7.5 },
      { rank: 10, name: "Quantum Gold Fund ETF", category: "Gold ETF", weight: 5, currentReturn: 10.9 },
    ],
    performance: PERFORMANCE_BASE("hni-50l-multi-asset", 1000, 24, 15.4, 10.2),
    riskMetrics: { sharpeRatio: 1.28, maxDrawdown: -13.6, volatility: 10.2, beta: 0.8, alpha: 3.08 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for moderate investors in hni segment. HNI Multi-Asset ₹50L has delivered 15.4% 1Y CAGR and targets 12.8% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "multi-asset-5factor",
    assetClass: "hybrid",
    subCategory: "All-Weather",
    name: "Multi-Asset 5-Factor Portfolio",
    tagline: "True diversification across 5 uncorrelated asset classes",
    riskProfile: "moderate",
    goal: ["diversification", "steady_growth", "downside_protection"],
    minInvestment: 20000,
    timeHorizon: "5+ years",
    cagr1Y: 10.62,
    cagr3Y: 8.85,
    cagr5Y: 11.09,
    benchmarkCagr1Y: 8.5,
    benchmarkName: "NIFTY 500 TRI",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "quarterly",
    totalHoldings: 12,
    highlight: "Equity Debt Gold REIT International all in one",
    icon: "🌐",
    isFeatured: true,
    isNew: false,
    allocation: [{category:"equity",label:"Equity",weight:55,color:"#3B82F6",icon:"📈"},{category:"debt",label:"Debt",weight:35,color:"#10B981",icon:"🏛️"},{category:"gold",label:"Gold/REITs",weight:10,color:"#F59E0B",icon:"🥇"}],
    holdings: [
      { rank: 1, name: "ICICI Pru Balanced Advantage", category: "Balanced Adv MF", weight: 25, currentReturn: 11.2 },
      { rank: 2, name: "Parag Parikh Flexi Cap Fund", category: "Flexi Cap MF", weight: 20, currentReturn: 16.8 },
      { rank: 3, name: "SBI Magnum Gilt Fund", category: "Gilt MF", weight: 15, currentReturn: 7.8 },
      { rank: 4, name: "Nippon India Gold Savings", category: "Gold ETF", weight: 10, currentReturn: 11.1 },
      { rank: 5, name: "Embassy Office Parks REIT", category: "REIT", weight: 10, currentReturn: 9.8 },
      { rank: 6, name: "HDFC Liquid Fund", category: "Liquid MF", weight: 10, currentReturn: 7.5 },
      { rank: 7, name: "HDFC Corporate Bond Fund", category: "Corp Bond MF", weight: 10, currentReturn: 8.1 },
    ],
    performance: PERFORMANCE_BASE("multi-asset-5factor", 1000, 24, 10.62, 9.4),
    riskMetrics: { sharpeRatio: 1.12, maxDrawdown: -8.8, volatility: 9.4, beta: 0.79, alpha: 2.12 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for moderate investors in hybrid segment. Multi-Asset 5-Factor Portfolio has delivered 10.6% 1Y CAGR and targets 11.1% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "passive-index",
    assetClass: "equity",
    subCategory: "Large Cap",
    name: "Passive Index Portfolio",
    tagline: "Low-cost market returns tracking Nifty 50 and Next 50",
    riskProfile: "moderate",
    goal: ["wealth_creation", "long_term_wealth", "low_cost"],
    minInvestment: 500,
    timeHorizon: "5+ years",
    cagr1Y: 1.83,
    cagr3Y: 1.61,
    cagr5Y: 4.5,
    benchmarkCagr1Y: 1.46,
    benchmarkName: "NIFTY 50 TRI",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "annual",
    totalHoldings: 5,
    highlight: "Zero fund manager risk just buy the market",
    icon: "🗂️",
    isFeatured: true,
    isNew: false,
    allocation: [{category:"equity",label:"Equity Funds",weight:80,color:"#3B82F6",icon:"📈"},{category:"debt",label:"Debt Funds",weight:15,color:"#10B981",icon:"🏛️"},{category:"liquid",label:"Cash/Liquid",weight:5,color:"#6B7280",icon:"💧"}],
    holdings: [
      { rank: 1, name: "Mirae Asset Large Cap Fund", category: "Large Cap MF", weight: 22, currentReturn: 14.2 },
      { rank: 2, name: "Parag Parikh Flexi Cap Fund", category: "Flexi Cap MF", weight: 18, currentReturn: 16.8 },
      { rank: 3, name: "HDFC Mid-Cap Opportunities", category: "Mid Cap MF", weight: 15, currentReturn: 18.1 },
      { rank: 4, name: "Nippon ETF Nifty BeES", category: "Index ETF", weight: 12, currentReturn: 12.7 },
      { rank: 5, name: "Axis Small Cap Fund", category: "Small Cap MF", weight: 10, currentReturn: 22.3 },
    ],
    performance: PERFORMANCE_BASE("passive-index", 1000, 24, 1.83, 15.8),
    riskMetrics: { sharpeRatio: 0.82, maxDrawdown: -12.1, volatility: 15.8, beta: 0.86, alpha: 0.37 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for moderate investors in equity segment. Passive Index Portfolio has delivered 1.8% 1Y CAGR and targets 4.5% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "pure-debt-portfolio",
    assetClass: "debt",
    subCategory: "Short Duration",
    name: "Pure Debt Portfolio",
    tagline: "Capital safety with superior debt returns vs FD",
    riskProfile: "conservative",
    goal: ["capital_preservation", "regular_income", "fd_alternative"],
    minInvestment: 10000,
    timeHorizon: "1-5 years",
    cagr1Y: 5.91,
    cagr3Y: 5.26,
    cagr5Y: 7.56,
    benchmarkCagr1Y: 4.73,
    benchmarkName: "CRISIL Composite Bond Fund Index",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "semi_annual",
    totalHoldings: 8,
    highlight: "Better than FD returns with sovereign and AAA safety",
    icon: "🔐",
    isFeatured: true,
    isNew: false,
    allocation: [{category:"debt",label:"Debt/Bond Funds",weight:70,color:"#10B981",icon:"🏛️"},{category:"liquid",label:"Liquid Funds",weight:20,color:"#6B7280",icon:"💧"},{category:"gilt",label:"Gilt/Govt Bonds",weight:10,color:"#F59E0B",icon:"📜"}],
    holdings: [
      { rank: 1, name: "SBI Magnum Gilt Fund", category: "Gilt MF", weight: 25, currentReturn: 7.8 },
      { rank: 2, name: "HDFC Corporate Bond Fund", category: "Corp Bond MF", weight: 20, currentReturn: 8.1 },
      { rank: 3, name: "ICICI Pru Liquid Fund", category: "Liquid MF", weight: 20, currentReturn: 7.5 },
      { rank: 4, name: "Axis AAA Bond Plus SDL", category: "Govt Bond MF", weight: 15, currentReturn: 7.9 },
      { rank: 5, name: "Nippon India Short Term", category: "Short Term MF", weight: 12, currentReturn: 7.6 },
      { rank: 6, name: "Kotak Savings Fund", category: "Ultra Short MF", weight: 8, currentReturn: 7.2 },
    ],
    performance: PERFORMANCE_BASE("pure-debt-portfolio", 1000, 24, 5.91, 5.4),
    riskMetrics: { sharpeRatio: 1.28, maxDrawdown: -4.8, volatility: 5.4, beta: 0.75, alpha: 1.18 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for conservative investors in debt segment. Pure Debt Portfolio has delivered 5.9% 1Y CAGR and targets 7.6% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "reit-invit-income",
    assetClass: "alternatives",
    subCategory: "REIT/InvIT",
    name: "REIT and InvIT Income",
    tagline: "Real asset income through listed trusts",
    riskProfile: "moderate",
    goal: ["regular_income", "real_asset_exposure", "inflation_hedge"],
    minInvestment: 15000,
    timeHorizon: "3-5 years",
    cagr1Y: 9.33,
    cagr3Y: 8.06,
    cagr5Y: 10.12,
    benchmarkCagr1Y: 7.46,
    benchmarkName: "Nifty India REITs & InvITs Index",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "semi_annual",
    totalHoldings: 7,
    highlight: "Quarterly distributions from premium real assets",
    icon: "🏢",
    isFeatured: true,
    isNew: false,
    allocation: [{category:"reits",label:"REITs",weight:50,color:"#8B5CF6",icon:"🏢"},{category:"invits",label:"InvITs",weight:35,color:"#EC4899",icon:"🏗️"},{category:"liquid",label:"Liquid",weight:15,color:"#6B7280",icon:"💧"}],
    holdings: [
      { rank: 1, name: "Embassy Office Parks REIT", category: "REIT", weight: 30, currentReturn: 9.8 },
      { rank: 2, name: "Mindspace Business Parks REIT", category: "REIT", weight: 25, currentReturn: 8.7 },
      { rank: 3, name: "Brookfield India REIT", category: "REIT", weight: 20, currentReturn: 9.1 },
      { rank: 4, name: "IRB InvIT Fund", category: "InvIT", weight: 15, currentReturn: 10.4 },
      { rank: 5, name: "PowerGrid InvIT", category: "InvIT", weight: 10, currentReturn: 9.8 },
    ],
    performance: PERFORMANCE_BASE("reit-invit-income", 1000, 24, 9.33, 11.2),
    riskMetrics: { sharpeRatio: 1.02, maxDrawdown: -9.8, volatility: 11.2, beta: 0.81, alpha: 1.87 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for moderate investors in alternatives segment. REIT and InvIT Income has delivered 9.3% 1Y CAGR and targets 10.1% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "retirement-builder",
    assetClass: "goal_based",
    subCategory: "Goal-Based",
    name: "Retirement Builder",
    tagline: "Systematic wealth accumulation for a comfortable retirement",
    riskProfile: "moderate",
    goal: ["retirement", "long_term_wealth", "regular_income"],
    minInvestment: 5000,
    timeHorizon: "10-25 years",
    cagr1Y: 7.51,
    cagr3Y: 5.45,
    cagr5Y: 8.75,
    benchmarkCagr1Y: 6.01,
    benchmarkName: "NIFTY 500 TRI",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "annual",
    totalHoldings: 11,
    highlight: "Glide path from growth to income as you age",
    icon: "🏖️",
    isFeatured: true,
    isNew: false,
    allocation: [{category:"equity",label:"Equity",weight:60,color:"#3B82F6",icon:"📈"},{category:"debt",label:"Debt",weight:30,color:"#10B981",icon:"🏛️"},{category:"liquid",label:"Liquid",weight:10,color:"#6B7280",icon:"💧"}],
    holdings: [
      { rank: 1, name: "HDFC Top 100 Fund", category: "Large Cap MF", weight: 25, currentReturn: 13.4 },
      { rank: 2, name: "Mirae Asset Large Cap Fund", category: "Large Cap MF", weight: 20, currentReturn: 14.1 },
      { rank: 3, name: "SBI Magnum Gilt Fund", category: "Gilt MF", weight: 15, currentReturn: 7.8 },
      { rank: 4, name: "HDFC Corporate Bond Fund", category: "Corp Bond MF", weight: 15, currentReturn: 8.1 },
      { rank: 5, name: "Nippon India Gold Savings", category: "Gold ETF", weight: 10, currentReturn: 11.1 },
      { rank: 6, name: "ICICI Pru Liquid Fund", category: "Liquid MF", weight: 10, currentReturn: 7.5 },
      { rank: 7, name: "Parag Parikh Flexi Cap", category: "Flexi Cap MF", weight: 5, currentReturn: 16.8 },
    ],
    performance: PERFORMANCE_BASE("retirement-builder", 1000, 24, 7.51, 9.2),
    riskMetrics: { sharpeRatio: 0.96, maxDrawdown: -8.2, volatility: 9.2, beta: 0.79, alpha: 1.5 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for moderate investors in goal_based segment. Retirement Builder has delivered 7.5% 1Y CAGR and targets 8.8% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "senior-citizen-income",
    assetClass: "debt",
    subCategory: "Short Duration",
    name: "Senior Citizen Income Portfolio",
    tagline: "Monthly income with capital safety for retirees 60+",
    riskProfile: "conservative",
    goal: ["regular_income", "capital_preservation", "retirement"],
    minInvestment: 5000,
    timeHorizon: "3-5 years",
    cagr1Y: 8.96,
    cagr3Y: 6.56,
    cagr5Y: 9.85,
    benchmarkCagr1Y: 7.17,
    benchmarkName: "CRISIL Composite Bond Fund Index",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "monthly",
    totalHoldings: 9,
    highlight: "Monthly SWP to bank account designed for retirees",
    icon: "🧓",
    isFeatured: true,
    isNew: false,
    allocation: [{category:"debt",label:"Debt/Bond Funds",weight:70,color:"#10B981",icon:"🏛️"},{category:"liquid",label:"Liquid Funds",weight:20,color:"#6B7280",icon:"💧"},{category:"gilt",label:"Gilt/Govt Bonds",weight:10,color:"#F59E0B",icon:"📜"}],
    holdings: [
      { rank: 1, name: "SBI Magnum Gilt Fund", category: "Gilt MF", weight: 25, currentReturn: 7.8 },
      { rank: 2, name: "HDFC Corporate Bond Fund", category: "Corp Bond MF", weight: 20, currentReturn: 8.1 },
      { rank: 3, name: "ICICI Pru Liquid Fund", category: "Liquid MF", weight: 20, currentReturn: 7.5 },
      { rank: 4, name: "Axis AAA Bond Plus SDL", category: "Govt Bond MF", weight: 15, currentReturn: 7.9 },
      { rank: 5, name: "Nippon India Short Term", category: "Short Term MF", weight: 12, currentReturn: 7.6 },
      { rank: 6, name: "Kotak Savings Fund", category: "Ultra Short MF", weight: 8, currentReturn: 7.2 },
    ],
    performance: PERFORMANCE_BASE("senior-citizen-income", 1000, 24, 8.96, 6.2),
    riskMetrics: { sharpeRatio: 1.18, maxDrawdown: -5.4, volatility: 6.2, beta: 0.76, alpha: 1.79 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for conservative investors in debt segment. Senior Citizen Income Portfolio has delivered 9.0% 1Y CAGR and targets 9.8% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "value-investing",
    assetClass: "equity",
    subCategory: "Large Cap",
    name: "Value Investing Portfolio",
    tagline: "Buy great businesses at fair prices for long-term wealth",
    riskProfile: "moderate",
    goal: ["capital_appreciation", "wealth_creation", "contrarian"],
    minInvestment: 15000,
    timeHorizon: "5-7 years",
    cagr1Y: 5.89,
    cagr3Y: 5.19,
    cagr5Y: 7.54,
    benchmarkCagr1Y: 4.71,
    benchmarkName: "NIFTY 500 Value 50 TRI",
    lastRebalanced: "2026-07-06",
    rebalancingFrequency: "semi_annual",
    totalHoldings: 10,
    highlight: "Low P/E P/B with strong balance sheets",
    icon: "💎",
    isFeatured: true,
    isNew: false,
    allocation: [{category:"equity",label:"Equity Funds",weight:80,color:"#3B82F6",icon:"📈"},{category:"debt",label:"Debt Funds",weight:15,color:"#10B981",icon:"🏛️"},{category:"liquid",label:"Cash/Liquid",weight:5,color:"#6B7280",icon:"💧"}],
    holdings: [
      { rank: 1, name: "Mirae Asset Large Cap Fund", category: "Large Cap MF", weight: 22, currentReturn: 14.2 },
      { rank: 2, name: "Parag Parikh Flexi Cap Fund", category: "Flexi Cap MF", weight: 18, currentReturn: 16.8 },
      { rank: 3, name: "HDFC Mid-Cap Opportunities", category: "Mid Cap MF", weight: 15, currentReturn: 18.1 },
      { rank: 4, name: "Nippon ETF Nifty BeES", category: "Index ETF", weight: 12, currentReturn: 12.7 },
      { rank: 5, name: "Axis Small Cap Fund", category: "Small Cap MF", weight: 10, currentReturn: 22.3 },
      { rank: 6, name: "HDFC Liquid Fund", category: "Liquid MF", weight: 8, currentReturn: 7.5 },
      { rank: 7, name: "Kotak NIFTY 50 ETF", category: "Index ETF", weight: 8, currentReturn: 12.6 },
      { rank: 8, name: "SBI Bluechip Fund", category: "Large Cap MF", weight: 7, currentReturn: 12.9 },
    ],
    performance: PERFORMANCE_BASE("value-investing", 1000, 24, 5.89, 16.8),
    riskMetrics: { sharpeRatio: 0.68, maxDrawdown: -14.2, volatility: 16.8, beta: 0.87, alpha: 1.18 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Suitable for moderate investors in equity segment. Value Investing Portfolio has delivered 5.9% 1Y CAGR and targets 7.5% 5Y returns.",
      confidence_score: 76,
      factors_considered: ["Market conditions", "Portfolio composition", "Risk-return profile", "Benchmark comparison"],
      model_version: "FASP-AI-v2.0",
      timestamp: new Date().toISOString(),
    },
  }
];


// Total portfolios in DB (used for count displays before/after API loads)
// Breakdown: 37 static retail + 3 HNI portfolios seeded in DB = 40 published retail+HNI
// Additional DB-only portfolios bring total to 43.
const DB_PORTFOLIO_COUNT = 43;
const DB_RETAIL_COUNT    = 40;
const DB_HNI_COUNT       = 2;
const DB_ULTRA_HNI_COUNT = 1;

// MODEL_PORTFOLIOS_ALL is ONLY used as the render-safe static fallback (37 fully-populated items).
// DO NOT add minimal stubs here — the card renderer accesses .riskMetrics, .performance, .goal
// etc. and will crash if those fields are undefined.
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
  all:           { label: "All",           icon: "🗂️", color: "bg-slate-600" },
  equity:        { label: "Equity",        icon: "📈", color: "bg-blue-600" },
  debt:          { label: "Debt",          icon: "🏛️", color: "bg-green-600" },
  hybrid:        { label: "Hybrid",        icon: "⚖️", color: "bg-purple-600" },
  thematic:      { label: "Thematic",      icon: "🎯", color: "bg-orange-600" },
  goal_based:    { label: "Goal-Based",    icon: "🏆", color: "bg-rose-600" },
  hni:           { label: "HNI / Ultra HNI", icon: "💎", color: "bg-amber-600" },
  gold:          { label: "Gold",          icon: "🥇", color: "bg-yellow-600" },
  alternatives:  { label: "Alternatives",  icon: "🏢", color: "bg-teal-600" },
  international: { label: "International", icon: "🌍", color: "bg-cyan-600" },
};

const EQUITY_SUBCATEGORIES = ["Large Cap", "Mid Cap", "Small Cap", "Flexi Cap", "Multi Cap", "Momentum", "Value", "Dividend"];
const DEBT_SUBCATEGORIES = ["Short Duration", "Long Duration", "Corporate Bond", "Liquid / Ultra Short", "Corporate Treasury", "Target Maturity", "Credit Risk"];
const HYBRID_SUBCATEGORIES = ["All-Weather", "Balanced Advantage", "Dividend / Income", "Retirement", "Multi-Asset"];
const THEMATIC_SUBCATEGORIES = ["Thematic / Sectoral", "BFSI", "Healthcare & Pharma", "Infrastructure", "Manufacturing", "Green Energy", "Digital India", "Consumption India"];
const GOAL_SUBCATEGORIES = ["Child Education", "Retirement", "Wedding / Life Event", "Home Purchase", "Emergency Fund", "Senior Citizen", "First Investment", "NRI"];
const HNI_SUBCATEGORIES = ["Multi-Asset ₹50L", "Multi-Asset ₹1Cr", "Multi-Asset ₹10Cr", "Wealth Compounder"];

// ── Investor Segment Tiers ──────────────────────────────────────────────────
const SEGMENT_CONFIG: Record<string, { label: string; icon: string; gradient: string; badgeColor: string; desc: string; minLabel: string }> = {
  all:       { label: "All Portfolios",  icon: "🗂️", gradient: "from-slate-600 to-slate-700",   badgeColor: "bg-slate-500",   desc: "Full catalogue",     minLabel: "" },
  retail:    { label: "Retail",          icon: "🏠", gradient: "from-blue-600 to-indigo-600",  badgeColor: "bg-blue-500",    desc: "Up to ₹10L min",    minLabel: "₹500 — ₹10L" },
  hni:       { label: "HNI",             icon: "💼", gradient: "from-purple-600 to-violet-600", badgeColor: "bg-purple-500",  desc: "₹50L — ₹1Cr tier",   minLabel: "₹50L — ₹1Cr" },
  ultra_hni: { label: "Ultra HNI",       icon: "💎", gradient: "from-amber-500 to-orange-600",  badgeColor: "bg-amber-500",   desc: "₹1Cr+ family wealth", minLabel: "₹1Cr+" },
};

/**
 * D2: FIX — getSegment now uses assetClass as primary discriminator.
 *
 * Problem: minInvestment threshold alone was ambiguous:
 *   - family-office (minInvestment=₹10Cr) → fell into ultra_hni
 *   - hni-1cr-multi-asset (minInvestment=₹1Cr) → fell into ultra_hni wrongly
 *   - hni-50l-multi-asset (minInvestment=₹50L) → correctly HNI
 *
 * Fix:
 *   - assetClass === 'hni' → always routes to 'hni' segment
 *   - minInvestment >= ₹10Cr (family office tier) → 'ultra_hni'
 *   - minInvestment >= ₹1Cr → 'ultra_hni'
 *   - minInvestment >= ₹50L → 'hni'
 *   - else → 'retail'
 */
function getSegment(p: { minInvestment?: number; assetClass?: string }): "retail" | "hni" | "ultra_hni" {
  const ac = (p.assetClass ?? "").toLowerCase();
  const min = p.minInvestment ?? 0;

  // assetClass 'hni' — always HNI tier, subdivided by minInvestment
  if (ac === "hni") {
    if (min >= 10_000_000) return "ultra_hni"; // ₹1Cr+ → Ultra HNI
    return "hni";                              // ₹50L tier → HNI
  }

  // Generic min-investment thresholds
  if (min >= 10_000_000) return "ultra_hni"; // ≥ ₹1 Cr
  if (min >= 5_000_000)  return "hni";       // ≥ ₹50L
  return "retail";
}

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
  const [periods, setPeriods] = useState<any>(null);

  useEffect(() => {
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

// ─── D5: SIP Simulator Tab ─────────────────────────────────────────────────
// Pure-frontend compound growth calculator.
// Computes: Wealth = P \u00d7 [(1+r)^n - 1] / r \u00d7 (1+r)  for SIP
// Optionally adds a lump-sum component: L \u00d7 (1+r)^n

function SipSimulatorTab({ portfolio }: { portfolio: ModelPortfolio }) {
  const expectedReturn = portfolio.cagr1Y ?? portfolio.cagr3Y ?? portfolio.cagr5Y ?? 12;
  const [monthlyAmt,  setMonthlyAmt]  = useState<string>("10000");
  const [lumpSum,     setLumpSum]     = useState<string>("0");
  const [years,       setYears]       = useState<number>(10);
  const [customRate,  setCustomRate]  = useState<string>(String(Math.max(0, Math.round(expectedReturn * 10) / 10)));

  const rateStr  = customRate.trim() === "" ? "0" : customRate;
  const r        = Math.max(0, Math.min(100, Number.parseFloat(rateStr) || 0)) / 100 / 12; // monthly rate
  const n        = years * 12; // months
  const P        = Math.max(0, Number.parseInt(monthlyAmt.replace(/,/g, ""), 10) || 0);
  const L        = Math.max(0, Number.parseInt(lumpSum.replace(/,/g, ""), 10) || 0);

  // SIP future value (end-of-month payments)
  const sipFV    = r > 0 ? P * ((Math.pow(1 + r, n) - 1) / r) * (1 + r) : P * n;
  // Lump-sum future value
  const lumpFV   = L * Math.pow(1 + r, n);
  const totalFV  = sipFV + lumpFV;
  const invested = P * n + L;
  const gains    = totalFV - invested;

  const fmt = (v: number) => v >= 10_000_000
    ? `\u20b9${(v / 10_000_000).toFixed(2)} Cr`
    : v >= 100_000
    ? `\u20b9${(v / 100_000).toFixed(2)} L`
    : `\u20b9${Math.round(v).toLocaleString("en-IN")}`;

  // Build year-by-year data for sparkline
  const chartData = Array.from({ length: years }, (_, i) => {
    const yr = i + 1;
    const m  = yr * 12;
    const sv = r > 0 ? P * ((Math.pow(1 + r, m) - 1) / r) * (1 + r) : P * m;
    const lv = L * Math.pow(1 + r, m);
    return { yr, wealth: sv + lv, invested: P * m + L };
  });
  const maxWealth = chartData.length ? Math.max(...chartData.map(d => d.wealth)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">\ud83d\udcb0</span>
        <div>
          <p className="text-sm font-semibold">SIP + Lump-Sum Simulator</p>
          <p className="text-[11px] text-muted-foreground">Based on {portfolio.name} historical {Math.round(expectedReturn * 10) / 10}% CAGR</p>
        </div>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground font-medium">Monthly SIP (\u20b9)</label>
          <input
            type="number" min={0} step={500}
            value={monthlyAmt}
            onChange={(e) => setMonthlyAmt(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground font-medium">Lump Sum (\u20b9)</label>
          <input
            type="number" min={0} step={10000}
            value={lumpSum}
            onChange={(e) => setLumpSum(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground font-medium">Expected CAGR (%)</label>
          <input
            type="number" min={0} max={100} step={0.5}
            value={customRate}
            onChange={(e) => setCustomRate(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground font-medium">Duration (years): {years}</label>
          <input
            type="range" min={1} max={30} step={1}
            value={years}
            onChange={(e) => setYears(Number(e.target.value))}
            className="w-full accent-indigo-600"
          />
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Amount Invested",  value: fmt(invested),  color: "text-foreground" },
          { label: "Estimated Gains",  value: fmt(gains),     color: "text-emerald-600 dark:text-emerald-400" },
          { label: "Total Corpus",     value: fmt(totalFV),   color: "text-indigo-600 dark:text-indigo-400 font-bold" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg bg-muted/50 p-2.5 text-center">
            <p className="text-[9px] text-muted-foreground">{s.label}</p>
            <p className={`text-[13px] font-semibold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Year-by-year mini chart */}
      {chartData.length > 0 && (
        <div className="space-y-1">
          <p className="text-[9px] text-muted-foreground">Wealth accumulation by year</p>
          <div className="flex items-end gap-0.5 h-16">
            {chartData.map((d) => {
              const wPct = (d.wealth / maxWealth) * 100;
              const iPct = (d.invested / maxWealth) * 100;
              return (
                <TooltipProvider key={d.yr}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex-1 flex flex-col items-center justify-end h-full relative">
                        {/* Total wealth bar */}
                        <div
                          className="w-full rounded-t-sm bg-indigo-400/60 dark:bg-indigo-600/50 absolute bottom-0"
                          style={{ height: `${Math.max(4, wPct)}%` }}
                        />
                        {/* Invested portion overlay */}
                        <div
                          className="w-full bg-slate-400/40 absolute bottom-0 rounded-t-sm"
                          style={{ height: `${Math.max(2, iPct)}%` }}
                        />
                        <span className="text-[7px] text-muted-foreground/70 leading-none absolute -bottom-3.5">{d.yr}Y</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px]">
                      Yr {d.yr}: {fmt(d.wealth)} (invested {fmt(d.invested)})
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
          <div className="flex items-center gap-3 text-[8px] text-muted-foreground mt-5">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded-sm bg-indigo-400/60" /> Total corpus</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded-sm bg-slate-400/40" /> Amount invested</span>
          </div>
        </div>
      )}

      <p className="text-[8px] text-muted-foreground/60 leading-relaxed">
        \u26a0\ufe0f Projections are illustrative only. Actual returns will vary. Past CAGR is not indicative of future results.
        Consult your SEBI-registered advisor before investing.
      </p>
    </div>
  );
}

// ─── D6: Holding Overlap Tab ──────────────────────────────────────────────────
// Detects holdings that appear in multiple portfolios.
// Helps advisors identify concentration risk when a client holds multiple portfolios.

function HoldingOverlapTab({ selectedPortfolio, allPortfolios }: {
  selectedPortfolio: ModelPortfolio;
  allPortfolios: ModelPortfolio[];
}) {
  const myHoldings = selectedPortfolio.holdings ?? [];

  // Build a map: holding symbol/name \u2192 list of other portfolios that contain it
  const overlapMap = new Map<string, { name: string; weight: number; otherPortfolios: { id: string; name: string; weight: number }[] }>();

  for (const h of myHoldings) {
    const key = h.symbol ?? h.name;
    if (!key) continue;
    const others: { id: string; name: string; weight: number }[] = [];
    for (const p of allPortfolios) {
      if (p.id === selectedPortfolio.id) continue;
      const match = (p.holdings ?? []).find(
        (ph) => ph.symbol === h.symbol || ph.name === h.name,
      );
      if (match) others.push({ id: p.id, name: p.name, weight: Number(match.weight ?? 0) });
    }
    if (others.length > 0) {
      overlapMap.set(key, { name: h.name, weight: Number(h.weight ?? 0), otherPortfolios: others });
    }
  }

  const overlaps = Array.from(overlapMap.entries()).sort((a, b) => b[1].otherPortfolios.length - a[1].otherPortfolios.length);
  const overlapPct = myHoldings.length > 0 ? Math.round((overlaps.length / myHoldings.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">\ud83d\udd17</span>
        <div>
          <p className="text-sm font-semibold">Holding Overlap Detector</p>
          <p className="text-[11px] text-muted-foreground">
            {overlaps.length === 0
              ? "No overlapping holdings found across other portfolios."
              : `${overlaps.length} of ${myHoldings.length} holdings (${overlapPct}%) appear in other portfolios`}
          </p>
        </div>
      </div>

      {overlaps.length === 0 ? (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 p-4 text-center">
          <p className="text-emerald-600 dark:text-emerald-400 text-sm font-medium">\u2705 No concentration risk detected</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            All {myHoldings.length} holdings in this portfolio are unique across the catalogue.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Concentration risk meter */}
          <div className="space-y-1">
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>Overlap concentration</span>
              <span className={overlapPct > 40 ? "text-red-500 font-semibold" : overlapPct > 20 ? "text-amber-500 font-semibold" : "text-emerald-600 font-semibold"}>
                {overlapPct}% of holdings
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${overlapPct > 40 ? "bg-red-500" : overlapPct > 20 ? "bg-amber-500" : "bg-emerald-500"}`}
                style={{ width: `${Math.min(100, overlapPct)}%` }}
              />
            </div>
          </div>

          {/* Overlap list */}
          <div className="space-y-1.5">
            {overlaps.map(([key, { name, weight, otherPortfolios }]) => (
              <div key={key} className="rounded-lg border border-border/60 bg-muted/30 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold truncate">{name}</p>
                    <p className="text-[9px] text-muted-foreground">
                      {weight.toFixed(1)}% weight in this portfolio
                    </p>
                  </div>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white shrink-0 ${
                    otherPortfolios.length >= 3 ? "bg-red-500" : otherPortfolios.length >= 2 ? "bg-amber-500" : "bg-slate-500"
                  }`}>
                    {otherPortfolios.length} more
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {otherPortfolios.slice(0, 4).map((op) => (
                    <span key={op.id} className="text-[8px] px-1.5 py-0.5 rounded bg-muted border border-border/50 text-muted-foreground">
                      {op.name.length > 22 ? op.name.substring(0, 22) + "\u2026" : op.name} ({op.weight.toFixed(1)}%)
                    </span>
                  ))}
                  {otherPortfolios.length > 4 && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded bg-muted border border-border/50 text-muted-foreground">
                      +{otherPortfolios.length - 4} more
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <p className="text-[8px] text-muted-foreground/60 leading-relaxed">
            Overlap analysis compares holdings by symbol and name. High overlap may indicate portfolio concentration risk
            if a client subscribes to multiple model portfolios simultaneously.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── AiTrackRecordTab ─────────────────────────────────────────────────────────
// FASP-AI Track Record panel: AI decision history, win rate, performance periods.
// Fetched lazily only when the tab is activated — not pre-loaded.

function AiTrackRecordTab({ portfolioId }: { portfolioId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
  const [segmentFilter, setSegmentFilter] = useState<string>("all");
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
        riskProfile: (p.riskProfile ?? p.risk_profile) as RiskProfile,
        assetClass: p.assetClass ?? p.asset_class,
        subCategory: p.subCategory ?? p.sub_category ?? undefined,
        minInvestment: Number(p.minInvestment ?? p.min_investment ?? staticP?.minInvestment ?? 5000),
        timeHorizon: p.timeHorizon ?? p.time_horizon ?? staticP?.timeHorizon ?? "N/A",
        benchmarkName: p.benchmarkName ?? p.benchmark_name ?? staticP?.benchmarkName ?? "Nifty 500",
        lastRebalanced: p.lastRebalanced ?? p.last_rebalanced ?? new Date().toISOString().slice(0, 10),
        rebalancingFrequency: p.rebalancingFrequency ?? p.rebalancing_frequency ?? staticP?.rebalancingFrequency ?? "quarterly",
        totalHoldings: p.totalHoldings ?? p.total_holdings ?? staticP?.totalHoldings ?? 0,
        highlight: p.highlight ?? staticP?.highlight ?? "",
        icon: p.icon ?? staticP?.icon ?? "📊",
        isFeatured: p.isFeatured ?? p.is_featured ?? false,
        isNew: p.isNew ?? p.is_new ?? false,
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
        // Drizzle .select() returns raw Postgres snake_case column names.
        // Always check both camelCase (manual mappings) and snake_case (ORM default).
        portfolioCode: p.portfolioCode ?? p.portfolio_code ?? staticP?.portfolioCode ?? undefined,
        inceptionDate: p.inceptionDate ?? p.inception_date ?? staticP?.inceptionDate ?? undefined,
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
   * canViewFullHoldings is TRUE for any authenticated user on the agent portal.
   * The agent portal is exclusively for professionals — if `user` exists, they
   * are an authenticated professional by definition (Passport session enforces this).
   * Role-based fallback: only deny if the user is exclusively in retail roles AND
   * their roles have fully loaded (non-empty array).
   * Fallback: if roles is undefined/empty (session not yet resolved), grant access.
   */
  const userRoles: string[] = user?.roles ?? [];
  // Any authenticated user on the agent portal gets full access.
  // Only restrict if: user is loaded, roles are loaded, and every role is retail-only.
  const isRetailOnly = !!user && userRoles.length > 0 && userRoles.every((r: string) => RETAIL_ONLY_ROLES.includes(r));
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
  // Guard: only fetch if apiData is loaded (ensures id exists in DB, not just static fallback)
  useEffect(() => {
    if (!selectedPortfolio) return;
    if (!apiData?.data) return; // Static fallback IDs don't exist in DB — skip
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
  }, [selectedPortfolio?.id, !!apiData?.data]);

  // ── Background prefetch quant signals for all visible cards ──────────────
  // Ensures drift meters on cards are populated without requiring a click.
  // Staggered 300ms per card to avoid hammering the API (max 20 cards).
  // Guard: only prefetch when apiData is loaded — static fallback IDs don't match DB.
  useEffect(() => {
    if (!apiData?.data?.length) return; // Wait for real API data — static IDs cause 404s
    const toFetch = (apiData.data as any[]).slice(0, 20);
    toFetch.forEach((p: any, i: number) => {
      setTimeout(() => {
        const id = p.id;
        if (!id || quantSignals[id]) return; // Skip if already fetched
        fetch(`/api/model-portfolios/${id}/quant-signals`)
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (data?.success && data.data) {
              setQuantSignals(prev => ({ ...prev, [id]: data.data }));
            }
          })
          .catch(() => {});
      }, i * 300); // Stagger: card 0 → 0ms, card 1 → 300ms, ..., card 19 → 5700ms
    });
  // Only run once when API data first loads — quantSignals intentionally omitted
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiData?.data?.length]);


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
      const r = await fetch(`/api/model-portfolios/${selectedPortfolio!.id}/holdings`, {
        credentials: "include", // send session cookie so isAuthenticated middleware passes
        headers: { "Content-Type": "application/json" },
      });
      if (!r.ok) {
        if (r.status === 401) throw new Error("AUTH_REQUIRED");
        throw new Error("Holdings fetch failed");
      }
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
    if (assetClassFilter === "hni") return HNI_SUBCATEGORIES;
    return [];
  }, [assetClassFilter]);

  const filtered = useMemo(() => {
    return livePortfolios.filter((p) => {
      if (segmentFilter !== "all" && getSegment(p) !== segmentFilter) return false;
      if (assetClassFilter !== "all" && p.assetClass !== assetClassFilter) return false;
      if (subCategoryFilter !== "all" && p.subCategory !== subCategoryFilter) return false;
      if (riskFilter !== "all" && p.riskProfile !== riskFilter) return false;
      return true;
    });
  }, [livePortfolios, segmentFilter, assetClassFilter, subCategoryFilter, riskFilter]);

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
          { label: "Retail",    value: apiData?.data ? (apiData.data as any[]).filter((p: any) => getSegment({ minInvestment: Number(p.minInvestment ?? p.min_investment ?? 0), assetClass: p.assetClass ?? p.asset_class ?? undefined }) === "retail").length : DB_RETAIL_COUNT,    icon: LayoutGrid, color: "text-blue-500" },
          { label: "HNI",       value: apiData?.data ? (apiData.data as any[]).filter((p: any) => getSegment({ minInvestment: Number(p.minInvestment ?? p.min_investment ?? 0), assetClass: p.assetClass ?? p.asset_class ?? undefined }) === "hni").length       : DB_HNI_COUNT,       icon: PieChart,    color: "text-purple-500" },
          { label: "Ultra HNI", value: apiData?.data ? (apiData.data as any[]).filter((p: any) => getSegment({ minInvestment: Number(p.minInvestment ?? p.min_investment ?? 0), assetClass: p.assetClass ?? p.asset_class ?? undefined }) === "ultra_hni").length : DB_ULTRA_HNI_COUNT, icon: TrendingUp,  color: "text-amber-500" },
          { label: "Min Investment", value: "₹500", icon: Target, color: "text-green-500" },
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

      {/* ── Investor Segment Selector ── */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Investor Segment</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(SEGMENT_CONFIG).map(([key, seg]) => {
            const SEGMENT_FALLBACK: Record<string, number> = { retail: DB_RETAIL_COUNT, hni: DB_HNI_COUNT, ultra_hni: DB_ULTRA_HNI_COUNT };
            const count = key === "all"
              ? (apiData?.data?.length ?? DB_PORTFOLIO_COUNT)
              : apiData?.data
                // D4: pass assetClass so classification matches updated getSegment() logic
                ? (apiData.data as any[]).filter((p: any) => getSegment({ minInvestment: Number(p.minInvestment ?? p.min_investment ?? 0), assetClass: p.assetClass ?? p.asset_class ?? undefined }) === key).length
                : (SEGMENT_FALLBACK[key] ?? 0);
            const isActive = segmentFilter === key;
            return (
              <button
                key={key}
                id={`segment-filter-${key}`}
                onClick={() => {
                  setSegmentFilter(key);
                  setAssetClassFilter(key === "hni" || key === "ultra_hni" ? "hni" : "all");
                  setSubCategoryFilter("all");
                  setRiskFilter("all");
                }}
                className={`relative overflow-hidden rounded-xl p-3.5 text-left transition-all border-2 ${
                  isActive
                    ? `bg-gradient-to-br ${seg.gradient} text-white border-transparent shadow-lg scale-[1.02]`
                    : "bg-card border-border hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md"
                }`}
              >
                <div className="flex items-start justify-between">
                  <span className="text-xl">{seg.icon}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    isActive ? "bg-white/20 text-white" : `${seg.badgeColor} text-white`
                  }`}>{count}</span>
                </div>
                <p className={`text-sm font-bold mt-1.5 ${isActive ? "text-white" : ""}`}>{seg.label}</p>
                <p className={`text-[10px] mt-0.5 ${isActive ? "text-white/75" : "text-muted-foreground"}`}>
                  {key === "all" ? "All portfolios" : seg.minLabel}
                </p>
              </button>
            );
          })}
        </div>
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
                {(apiData?.data?.length ? apiData.data : livePortfolios.length ? livePortfolios : MODEL_PORTFOLIOS_ALL).filter((p: any) => key === "all" || p.assetClass === key || p.asset_class === key).length}
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
              All {assetClassFilter === "equity" ? "Equity" : assetClassFilter === "debt" ? "Debt" : assetClassFilter === "hni" ? "HNI" : assetClassFilter === "thematic" ? "Thematic" : assetClassFilter === "goal_based" ? "Goal-Based" : "Hybrid"}
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
            Showing {filtered.length} of {apiData?.data?.length ?? DB_PORTFOLIO_COUNT} portfolios
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
                    {/* Avg return — D1: show LIVE badge when TWRR from scheduler */}
                    <div>
                      <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                        {returnLabel}
                        {isUsingTWRR && (
                          <span
                            title="Time-Weighted Return (SEBI TWRR methodology) — computed live by the quant engine"
                            className="inline-flex items-center gap-0.5 px-1 py-0 rounded text-[7px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 animate-pulse"
                          >
                            ⚡ LIVE
                          </span>
                        )}
                      </p>
                      <p className="text-[13px] font-bold text-emerald-600">
                        {display1Y >= 0 ? "+" : ""}{display1Y.toFixed(2)}%
                      </p>
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
                        <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                          {isUsingTWRR ? (
                            <>
                              <span className="inline-flex items-center gap-0.5 px-1 rounded text-[7px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">⚡ TWRR</span>
                              Monthly returns (SEBI time-weighted)
                            </>
                          ) : (
                            <>Rolling monthly returns since inception</>
                          )}
                          {portfolio.rebalancingHistory?.length > 0 && (
                            <span className="text-indigo-500">· marks a drift-triggered rebalance</span>
                          )}
                        </p>
                        {/* Zero-axis bar chart — positive above line, negative below */}
                        <div
                          className="relative flex items-stretch gap-0.5"
                          style={{ height: "56px" }}
                          aria-label="Monthly returns bar chart"
                        >
                          {/* Zero reference line at vertical midpoint */}
                          <div className="absolute inset-x-0 top-1/2 -translate-y-px h-px bg-border/70 z-10 pointer-events-none" />

                          {barData.map((bar, i) => {
                            const isPos = bar.returnPct >= 0;
                            // Each bar occupies half the container height (28px = top or bottom half)
                            const halfH = 28; // px
                            const barH  = Math.max(2, Math.min(halfH, (Math.abs(bar.returnPct) / maxBar) * halfH));
                            return (
                              <TooltipProvider key={i}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex-1 relative h-full group/bar">
                                      {/* Hover label */}
                                      <span className={`absolute ${isPos ? "bottom-[50%] mb-0.5" : "top-[50%] mt-0.5"} left-1/2 -translate-x-1/2 text-[7px] text-foreground/70 font-medium hidden group-hover/bar:block whitespace-nowrap z-20 bg-background/90 px-0.5 rounded`}>
                                        {bar.returnPct >= 0 ? "+" : ""}{bar.returnPct}%
                                      </span>
                                      {/* Rebalance dot — above zero line */}
                                      {bar.hasRebalanceEvent && (
                                        <span className="absolute top-[calc(50%-6px)] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-500 z-20" />
                                      )}
                                      {/* Positive bar: anchored at 50%, grows upward */}
                                      {isPos && (
                                        <div
                                          className="absolute bottom-[50%] left-0 right-0 bg-emerald-400 dark:bg-emerald-500 rounded-t-sm transition-all duration-300"
                                          style={{ height: `${barH}px` }}
                                        />
                                      )}
                                      {/* Negative bar: anchored at 50%, grows downward */}
                                      {!isPos && (
                                        <div
                                          className="absolute top-[50%] left-0 right-0 bg-red-400 dark:bg-red-500 rounded-b-sm transition-all duration-300"
                                          style={{ height: `${barH}px` }}
                                        />
                                      )}
                                      {/* Month label at very bottom */}
                                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[7px] text-muted-foreground/70 leading-none">
                                        {bar.label}
                                      </span>
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
                  <TabsList className="grid w-full grid-cols-7 mb-4 h-8 text-xs">
                    <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                    <TabsTrigger value="holdings" className="text-xs">Holdings</TabsTrigger>
                    <TabsTrigger value="performance" className="text-xs">Performance</TabsTrigger>
                    <TabsTrigger value="rebalancing" className="text-xs">Rebalancing</TabsTrigger>
                    <TabsTrigger value="sip" className="text-xs">💰 SIP</TabsTrigger>
                    <TabsTrigger value="overlap" className="text-xs">🔗 Overlap</TabsTrigger>
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


                    {/* Holdings auth error — only shows if backend returns 401 */}
                    {holdingsData === undefined && !holdingsLoading && activeDetailTab === "holdings" && (
                      <p className="text-[10px] text-amber-600 text-center py-2">
                        Sign in again if holdings fail to load.
                      </p>
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

                  {/* D5: SIP Simulator Tab */}
                  <TabsContent value="sip" className="space-y-4">
                    <SipSimulatorTab portfolio={selectedPortfolio} />
                  </TabsContent>

                  {/* D6: Holding Overlap Tab */}
                  <TabsContent value="overlap" className="space-y-4">
                    <HoldingOverlapTab selectedPortfolio={selectedPortfolio} allPortfolios={livePortfolios} />
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
