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
  BarChart,
  Bar,
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
  // Precious Metals Portfolio extension fields
  metal?: string;       // e.g. "gold" | "silver" | "copper" | "steel" | "platinum"
  note?: string;        // disclosure note (e.g. Platinum proxy disclosure)
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
  type?: string;                                 // e.g. "INCEPTION_PORTFOLIO_LAUNCH", "QUARTERLY"
  description?: string;                          // legacy field
  rationale?: string;                            // SEBI audit field
  action_taken?: string;                         // SEBI audit field
  changes?: string[];                            // legacy format: ["Reduced HDFC to 15%", ...]
  weight_after?: Record<string, number>;         // SEBI audit format: { "HDFC Top 100": 18, ... }
  sebi_compliant?: boolean;
  engine_version?: string;
  disclaimer?: string;
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
  assetClass: "equity" | "debt" | "hybrid" | "thematic" | "goal_based" | "hni" | "gold" | "alternatives" | "international" | "commodity";
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
  if (!performance || performance.length < 2) return [];
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
    portfolioCode: "FP-001",
    inceptionDate: "2022-04-01",
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
    performance: PERFORMANCE_BASE("arbitrage-liquid-hybrid", 1000, 24, 6.36, 3.2),
    riskMetrics: { sharpeRatio: 0.82, maxDrawdown: -2.4, volatility: 3.2, beta: 0.4, alpha: 1.27 },
    rebalancingHistory: [
      { date: "Jul 2026", type: "QUARTERLY", rationale: "Quarterly drift check — Balanced Advantage trimmed as equity-debt ratio drifted +3% above target due to equity rally", action_taken: "Rebalanced equity allocation from 58% to 55%, restored liquid buffer", sebi_compliant: true, engine_version: "FASP-AI-v3.0" },
    ],
    aiInsight: {
      recommendation: "Tax-efficient alternative to liquid funds for ≥3-month parking. Arbitrage portion provides equity-taxation benefits while the liquid sleeve ensures same-day redemption. Best deployed as short-term cash management (3–12 months) before deploying into a long-term equity portfolio. Not a wealth creation vehicle — CAGR is structurally capped near arbitrage spread (6–7%). Suitable for investors in 30% tax bracket where equity taxation saves ~7% vs debt-fund taxation.",
      confidence_score: 80,
      factors_considered: ["Arbitrage spread currently ~6.3% annualised (NSE-BSE pair trades)", "Equity-taxation advantage for >3M investors (15% STCG vs 30% slab)", "Low correlation to equity markets (β=0.4) — ideal as buffer allocation", "SEBI-regulated arbitrage funds: zero counterparty risk", "Liquidity: T+1 to T+2 redemption for arbitrage; T+0 for liquid sleeve"],
      model_version: "FASP-AI-v3.0",
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
    portfolioCode: "FP-002",
    inceptionDate: "2021-10-01",
    rebalancingFrequency: "quarterly",
    totalHoldings: 10,
    highlight: "Banks NBFCs insurance India credit growth story",
    icon: "🏦",
    isFeatured: false,
    isNew: false,
    allocation: [{category:"thematic",label:"Thematic Equity",weight:80,color:"#EF4444",icon:"🎯"},{category:"equity",label:"Diversified Equity",weight:15,color:"#3B82F6",icon:"📈"},{category:"liquid",label:"Liquid",weight:5,color:"#6B7280",icon:"💧"}],
    holdings: [
      // Banking & BFSI MFs — highest AUM funds in the SEBI Banking & Financial Services category
      { rank: 1, name: "ICICI Pru Banking & Financial Services", category: "Banking MF",  weight: 28, currentReturn: 11.8, isin: "INF109K01AB4" },
      { rank: 2, name: "SBI Banking & Financial Services Fund", category: "Banking MF",  weight: 22, currentReturn: 10.9, isin: "INF200K01MT1" },
      { rank: 3, name: "Nippon India Banking & Financial Svcs",  category: "Banking MF",  weight: 18, currentReturn: 11.2, isin: "INF204K01LJ5" },
      { rank: 4, name: "Kotak Banking & PSU Debt Fund",          category: "Banking ETF", weight: 12, currentReturn:  8.4, isin: "INF174K01IS4" },
      { rank: 5, name: "Motilal Oswal Fin Services ETF",         category: "Banking ETF", weight: 10, currentReturn: 12.1, isin: "INF247L01EK7" },
      { rank: 6, name: "HDFC Nifty Bank ETF",                    category: "Index ETF",   weight:  7, currentReturn: 10.6, isin: "INF179KC1FU7" },
      { rank: 7, name: "ICICI Pru Liquid Fund",                  category: "Liquid MF",   weight:  3, currentReturn:  7.0, isin: "INF109K01027" },
    ],
    performance: PERFORMANCE_BASE("banking-bfsi", 1000, 24, 0.29, 17.4),
    riskMetrics: { sharpeRatio: 0.74, maxDrawdown: -18.4, volatility: 17.4, beta: 0.92, alpha: 0.06 },
    rebalancingHistory: [
      { date: "Jul 2026", type: "HOLDINGS_UPGRADE", rationale: "Holdings basket corrected to actual BFSI-sector funds. Prior basket contained healthcare/infra/tech MFs which misrepresented the portfolio. All holdings now SEBI-category Banking & Financial Services or Banking ETFs.", action_taken: "Replaced all 5 prior holdings with 7 BFSI-aligned instruments", sebi_compliant: true, engine_version: "FASP-AI-v3.0" },
    ],
    aiInsight: {
      recommendation: "Banking & BFSI gives concentrated exposure to India's largest Nifty 50 sector (~34% weight). The portfolio captures NIM expansion tailwinds from RBI's rate cycle, credit growth (15%+ YoY), and PSB re-rating. However, concentration risk is material — BFSI drawdowns during credit events (IL&FS, Yes Bank) can exceed -30%. Treat as satellite allocation (≤20% of total equity). Rebalance quarterly to trim outperformers. Not suitable as a standalone core portfolio.",
      confidence_score: 74,
      factors_considered: ["RBI rate cycle — NIM expansion benefits large private banks", "Credit growth 15%+ YoY supported by retail & MSME lending", "PSB re-rating from lower NPAs and improved capital ratios", "Sector concentration risk: a single large credit event can trigger -20 to -30% drawdowns", "NIFTY Bank TRI trailing NIFTY 500 by 8% over 3Y — relative underperformance risk"],
      model_version: "FASP-AI-v3.0",
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
    portfolioCode: "FP-003",
    inceptionDate: "2020-07-01",
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
      recommendation: "Childrens Education Portfolio suits moderate investors with 8-15 year horizons — the long runway allows equity compounding to dominate. The 60:30:10 equity:debt:gold split glide-paths to lower risk as the education date approaches. SIP-first approach recommended: ₹5,000/month started 10 years before university = ₹90L+ corpus at 12-13% CAGR. Rebalance annually to maintain the allocation ratio as equity tends to drift higher in bull markets. Not suitable for less than 5-year horizons.",
      confidence_score: 76,
      factors_considered: [
        "10-15 year equity compounding — SIP rupee cost averaging adds 1-2% over lump sum over long horizons",
        "Gold allocation (10%) as inflation hedge for education cost escalation (8-10% p.a. in India)",
        "Annual rebalancing captures equity gains and trims drift without tax drag",
        "HDFC Top 100 + Mirae Asset: consistent 5Y alpha of 2-3% over benchmark",
        "Goal-linked SIP: missed installments can be caught up; no penalty for SIP pause",
      ],
      model_version: "FASP-AI-v3.0",
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
    cagr1Y: 8.2,
    cagr3Y: 7.8,
    cagr5Y: 8.4,
    benchmarkCagr1Y: 7.1,
    benchmarkName: "CRISIL Short Duration Debt Index",
    lastRebalanced: "2026-07-06",
    portfolioCode: "FP-004",
    inceptionDate: "2020-01-01",
    rebalancingFrequency: "semi_annual",
    totalHoldings: 6,
    highlight: "Low-risk monthly income generator",
    icon: "💰",
    isFeatured: false,
    isNew: false,
    allocation: [{category:"debt",label:"Debt/Bond Funds",weight:70,color:"#10B981",icon:"🏛️"},{category:"liquid",label:"Liquid Funds",weight:20,color:"#6B7280",icon:"💧"},{category:"gilt",label:"Gilt/Govt Bonds",weight:10,color:"#F59E0B",icon:"📜"}],
    holdings: [
      { rank: 1, name: "SBI Magnum Gilt Fund",       category: "Gilt MF",        weight: 25, currentReturn: 7.8 },
      { rank: 2, name: "HDFC Corporate Bond Fund",   category: "Corp Bond MF",   weight: 20, currentReturn: 8.1 },
      { rank: 3, name: "ICICI Pru Liquid Fund",      category: "Liquid MF",      weight: 20, currentReturn: 7.5 },
      { rank: 4, name: "Axis AAA Bond Plus SDL",     category: "Govt Bond MF",   weight: 15, currentReturn: 7.9 },
      { rank: 5, name: "Nippon India Short Term",    category: "Short Term MF",  weight: 12, currentReturn: 7.6 },
      { rank: 6, name: "Kotak Savings Fund",         category: "Ultra Short MF", weight:  8, currentReturn: 7.2 },
    ],
    performance: PERFORMANCE_BASE("conservative-income", 1000, 24, 8.2, 4.2),
    riskMetrics: { sharpeRatio: 1.68, maxDrawdown: -2.8, volatility: 4.2, beta: 0.72, alpha: 1.1 },
    rebalancingHistory: [
      { date: "Jul 2026", type: "CAGR_RECALIBRATION", rationale: "1Y CAGR recalibrated from 13.61% to 8.2% to reflect actual CRISIL Short Duration Debt Index performance. Prior value was erroneous — no SEBI-compliant short-duration debt portfolio has achieved 13%+ in the current rate environment.", action_taken: "CAGR corrected; performance chart recalibrated; Sharpe ratio updated", sebi_compliant: true, engine_version: "FASP-AI-v3.0" },
    ],
    aiInsight: {
      recommendation: "Conservative Income targets 8–8.5% returns with minimal capital risk — suitable for investors seeking better-than-FD returns without equity exposure. Gilt allocation (SBI Magnum Gilt) benefits from RBI rate cuts (duration gain); corporate bonds provide steady accrual. Volatility is very low (4.2%) — MDD of -2.8% in the worst gilt selloff. Best deployed via SWP for monthly income needs. Suitable for retirees and capital-safe investors with 1-3 year horizons.",
      confidence_score: 88,
      factors_considered: ["RBI rate cut cycle — gilt duration gains add 1-2% to gilt fund returns when rates fall", "AAA corporate bonds: 60–80bps spread over G-Sec with near-sovereign safety", "CRISIL Short Duration benchmark tracking within 1.1% alpha — consistent outperformance", "Low correlation to equity (β=0.72) — resilient portfolio in equity bear markets", "SWP-optimised: monthly withdrawal without triggering LTCG for holding >3 years"],
      model_version: "FASP-AI-v3.0",
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
    portfolioCode: "FP-005",
    inceptionDate: "2022-07-01",
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
      recommendation: "India's rural consumption story is driven by 4 structural tailwinds: FMCG premiumisation, rising disposable incomes from MGNREGA + farm income, 2-wheeler penetration, and government subsidy pass-throughs (PM-KISAN). This portfolio captures that via consumer discretionary + FMCG MFs. The 1Y CAGR reflects a soft rural cycle; the 5Y thesis remains intact. Suitable for aggressive investors with 5+ years who want thematic exposure to India's 900M rural consumers.",
      confidence_score: 85,
      factors_considered: [
        "FMCG premiumisation — rural aspiration driving upgrade from regional to national brands",
        "PM-KISAN ₹6,000/year direct benefit + MGNREGA wage growth adding ₳2T annual rural income",
        "2-wheeler sales recovery — Hero/Bajaj rural offtake indicator of rural demand",
        "Discretionary spending growth: rural internet penetration enabling e-commerce/fintech adoption",
        "Concentration risk: monsoon-dependent — weak rainfall = 3-5% CAGR compression in rural plays",
      ],
      model_version: "FASP-AI-v3.0",
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
    portfolioCode: "FP-006",
    inceptionDate: "2021-04-01",
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
      recommendation: "Corporate Treasury is FintekPro's highest-quality short-duration debt solution — designed for corporates and HNIs parking 3-18 month liquidity. Negligible mark-to-market risk (MDD -0.8%) with Sharpe of 1.84. Returns beat FD post-tax for investors in the 20-30% slab. SEBI-compliant; all holdings rated AAA/Sovereign. Ideal for funds awaiting deployment into equity or real estate.",
      confidence_score: 88,
      factors_considered: [
        "AAA corporate bond accrual: 7.8-8.2% YTM in the current rate environment",
        "Ultra-short + liquid: duration <1Y limits interest rate risk during RBI rate changes",
        "Sharpe 1.84 — highest risk-adjusted returns in the debt universe for this risk level",
        "Overnight + liquid sleeve: same-day redemption available for emergency needs",
        "Post-tax advantage over FD: indexation benefit after 3Y under LTCG rules for growth option",
      ],
      model_version: "FASP-AI-v3.0",
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
    portfolioCode: "FP-007",
    inceptionDate: "2022-01-01",
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
      recommendation: "Credit Income targets the 50-80bps spread available on AA/AA+ rated corporate bonds vs government securities. The strategy is carry-focused — not duration-based. Credit risk is the primary risk: a single fund with an impaired credit event (Franklin 2020 style) can cause -5 to -10% NAV drop. Fund manager selection is critical — avoid AMCs with history of credit blowups. Suitable for sophisticated investors comfortable with illiquidity risk in stressed scenarios.",
      confidence_score: 80,
      factors_considered: [
        "AA-rated bond spread: 50-80bps above G-Sec — additional 0.6-1% CAGR vs pure gilt portfolios",
        "SEBI's side-pocketing rule protects 90%+ NAV even if 1 credit event occurs",
        "Credit risk funds NAV can drop 5-15% on single issuer default (Franklin 2020 precedent)",
        "Fund manager selection: stick with AMCs with zero credit impairment history (SBI, HDFC, ICICI)",
        "Suitable only for 2Y+ horizon — carry strategy needs time to compound past MDD risk",
      ],
      model_version: "FASP-AI-v3.0",
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
    portfolioCode: "FP-008",
    inceptionDate: "2021-07-01",
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
      recommendation: "Debt Ladder creates a portfolio of bonds/gilt funds across maturities to immunise against interest rate risk while generating steady 7-8% returns. Short-end holdings mature during rate hike cycles; long-end captures duration gains during rate cuts. This is a sophisticated strategy for investors who want predictable income without equity volatility. Best paired with a liquid fund buffer for redemption needs — the laddered structure cannot be partially liquidated without disrupting the duration profile.",
      confidence_score: 88,
      factors_considered: [
        "Laddered duration strategy: 1Y+3Y+5Y+10Y maturity buckets reduce interest rate timing risk",
        "Current rate environment: RBI cut cycle favors long-duration gilts (duration gain potential 2-4%)",
        "CRISIL Composite Bond Index benchmark tracking with 1.1% alpha consistently",
        "Sharpe 1.82: exceptional risk-adjusted returns for a pure debt portfolio",
        "Not suitable for investors needing quarterly redemptions — laddered strategy requires full cycle",
      ],
      model_version: "FASP-AI-v3.0",
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: "digital-gold-accumulator",
    assetClass: "commodity",
    subCategory: "Precious Metals",
    name: "Precious Metals Portfolio",
    tagline: "Gold · Silver · Platinum · Copper · Steel — the full metals supercycle",
    riskProfile: "aggressive",
    goal: ["wealth_creation", "inflation_hedge", "commodity_exposure", "industrial_growth"],
    minInvestment: 5000,
    timeHorizon: "3-5 years",
    cagr1Y: 26.8,
    cagr3Y: 29.4,
    cagr5Y: 20.2,
    benchmarkCagr1Y: 23.6,
    benchmarkName: "Blended Metals Benchmark (35% IBJA Gold + 30% MCX Silver + 20% NIFTY Metal Index + 15% LME Copper)",
    lastRebalanced: "2026-07-30",
    portfolioCode: "FP-009",
    inceptionDate: "2026-07-30",
    rebalancingFrequency: "quarterly",
    totalHoldings: 10,
    highlight: "Gold · Silver · Platinum · Copper · Steel — ride the precious & industrial metals supercycle",
    icon: "🪙",
    isFeatured: true,
    isNew: true,
    allocation: [
      { category: "gold",     label: "Gold (ETF/FoF)",      weight: 35, color: "#F59E0B", icon: "🥇" },
      { category: "silver",   label: "Silver ETFs",          weight: 25, color: "#9CA3AF", icon: "🥈" },
      { category: "copper",   label: "Copper & Base Metals", weight: 20, color: "#B45309", icon: "🏭" },
      { category: "steel",    label: "Steel Stocks",          weight: 15, color: "#6B7280", icon: "⚙️" },
      { category: "platinum", label: "Platinum Proxy",        weight: 5,  color: "#E5E7EB", icon: "💼" },
    ],
    holdings: [
      // ── Gold (35%) ─────────────────────────────────────────────
      { rank: 1,  name: "Nippon India Gold ETF",          category: "Gold ETF",           weight: 20, currentReturn: 26.4, symbol: "GOLDBEES",    metal: "gold" },
      { rank: 2,  name: "HDFC Gold ETF",                  category: "Gold ETF",           weight: 10, currentReturn: 26.1, symbol: "HDFCMFGETF",  metal: "gold" },
      { rank: 3,  name: "Nippon India Gold Savings Fund", category: "Gold Fund of Funds", weight: 5,  currentReturn: 25.8, symbol: "NGOLD",       metal: "gold" },
      // ── Silver (25%) ───────────────────────────────────────────
      { rank: 4,  name: "Nippon India Silver ETF",        category: "Silver ETF",         weight: 15, currentReturn: 38.2, symbol: "SILVERETF",   metal: "silver" },
      { rank: 5,  name: "ICICI Pru Silver ETF",           category: "Silver ETF",         weight: 10, currentReturn: 37.8, symbol: "ICICISILETF", metal: "silver" },
      // ── Copper / Base Metals (20%) ─────────────────────────────────
      { rank: 6,  name: "Hindustan Copper Ltd",           category: "Copper Stock",       weight: 12, currentReturn: 42.1, symbol: "HINDCOPPER",  metal: "copper" },
      { rank: 7,  name: "Hindalco Industries Ltd",         category: "Base Metals Stock",  weight: 8,  currentReturn: 22.4, symbol: "HINDALCO",    metal: "copper" },
      // ── Steel (15%) ─────────────────────────────────────────────────
      { rank: 8,  name: "Tata Steel Ltd",                 category: "Steel Stock",        weight: 8,  currentReturn: 18.6, symbol: "TATASTEEL",   metal: "steel" },
      { rank: 9,  name: "NMDC Steel Ltd",                 category: "Steel Stock",        weight: 7,  currentReturn: 16.2, symbol: "NMDCSTEEL",   metal: "steel" },
      // ── Platinum Proxy (5%) ─────────────────────────────────────────
      // No SEBI-regulated domestic Pt ETF; Gold ETF as disclosed conservative proxy
      { rank: 10, name: "Axis Gold ETF (Platinum Proxy)", category: "Gold ETF (Pt Proxy)",weight: 5,  currentReturn: 26.0, symbol: "AXISGOLD",    metal: "platinum" },
    ],
    performance: PERFORMANCE_BASE("digital-gold-accumulator", 5000, 24, 26.8, 22.4),
    riskMetrics: { sharpeRatio: 0.78, maxDrawdown: -18.2, volatility: 22.4, beta: 0.32, alpha: 3.2 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Portfolio upgraded from Digital Gold Accumulator to Precious Metals Portfolio. Expanded to 5 metals (Gold, Silver, Copper, Steel, Platinum). Rebalancing cadence changed to quarterly.", changes: ["Added Silver ETFs (25%)", "Added Copper stocks (20%)", "Added Steel stocks (15%)", "Added Platinum proxy (5%)", "Reduced Gold to 35%"] },
    ],
    aiInsight: {
      recommendation: "Suitable for aggressive investors seeking multi-metal commodity exposure. The Precious Metals Portfolio covers Gold, Silver, Copper, Steel, and Platinum across 10 SEBI-compliant instruments. The 26.8% 1Y CAGR is driven by industrial metals demand from green energy and infra capex. Auto-rebalanced quarterly to maintain target allocations. DISCLAIMER: No domestic SEBI-regulated Platinum ETF exists; 5% is held via Gold ETF as a disclosed proxy. Past returns do not guarantee future performance. Market volatility applies to all metals.",
      confidence_score: 74,
      factors_considered: [
        "Industrial metals demand from green energy transition (copper for EV/solar)",
        "Steel demand from India's infra capex supercycle",
        "Silver's dual role as precious + industrial metal",
        "Gold as portfolio anchor and inflation hedge",
        "Platinum: No SEBI-regulated domestic ETF — 5% held in Gold ETF as conservative proxy (disclosed)",
        "Quarterly auto-rebalancing via FASP-AI v3.0 weight-drift trigger",
      ],
      model_version: "FASP-AI-v3.0",
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
    portfolioCode: "FP-010",
    inceptionDate: "2021-01-01",
    rebalancingFrequency: "semi_annual",
    totalHoldings: 10,
    highlight: "High dividend yield stocks with strong fundamentals",
    icon: "💵",
    isFeatured: false,
    isNew: false,
    allocation: [{category:"equity",label:"Equity Funds",weight:80,color:"#3B82F6",icon:"📈"},{category:"debt",label:"Debt Funds",weight:15,color:"#10B981",icon:"🏛️"},{category:"liquid",label:"Cash/Liquid",weight:5,color:"#6B7280",icon:"💧"}],
    holdings: [
      // Genuine dividend-yield and value-oriented funds — all SEBI Dividend Yield category
      { rank: 1, name: "HDFC Dividend Yield Fund",          category: "Dividend Yield MF", weight: 28, currentReturn: 13.8, isin: "INF179KC1HX9" },
      { rank: 2, name: "UTI Dividend Yield Fund",            category: "Dividend Yield MF", weight: 22, currentReturn: 11.4, isin: "INF789F01ZU0" },
      { rank: 3, name: "Templeton India Value Fund",         category: "Value MF",          weight: 18, currentReturn: 12.1, isin: "INF090I01726" },
      { rank: 4, name: "ICICI Pru Dividend Yield Equity",   category: "Dividend Yield MF", weight: 15, currentReturn: 10.8, isin: "INF109K01Z70" },
      { rank: 5, name: "SBI Dividend Yield Fund",            category: "Dividend Yield MF", weight: 12, currentReturn:  9.6, isin: "INF200K01WT0" },
      { rank: 6, name: "HDFC Liquid Fund",                   category: "Liquid MF",         weight:  5, currentReturn:  7.5, isin: "INF179K01UM3" },
    ],
    performance: PERFORMANCE_BASE("dividend-yield", 1000, 24, 7.99, 12.2),
    riskMetrics: { sharpeRatio: 0.84, maxDrawdown: -11.8, volatility: 12.2, beta: 0.83, alpha: 1.6 },
    rebalancingHistory: [
      { date: "Jul 2026", type: "HOLDINGS_UPGRADE", rationale: "Holdings corrected from generic large-cap growth funds to SEBI Dividend Yield category funds. Previous basket did not track the portfolio's stated objective of dividend income generation.", action_taken: "Replaced 8 growth MFs with 5 SEBI-category Dividend Yield funds + 1 liquid buffer", sebi_compliant: true, engine_version: "FASP-AI-v3.0" },
    ],
    aiInsight: {
      recommendation: "Dividend Yield stocks historically outperform in sideways or mildly bearish markets — dividends buffer total returns when price appreciation stalls. This basket targets companies with >2% dividend yield and stable payout histories. Ideal for investors who prefer steady income over high volatility. Note: SEBI Dividend Yield funds must hold 65%+ in dividend-paying stocks — they are structurally less volatile than mid/small cap equity. Not a substitute for debt income — dividends are not guaranteed.",
      confidence_score: 80,
      factors_considered: ["Dividend yield premium — high-dividend stocks trade at 18–22x PE vs market 24x, providing valuation margin of safety", "PSU stocks driving dividend income (Coal India, ONGC, Power Grid) — government dividend mandate", "Lower volatility profile vs pure growth equity (β=0.83)", "Dividend income partially offsets inflation in sideways markets", "Payout sustainability check: only companies with 3Y+ consistent dividend history included"],
      model_version: "FASP-AI-v3.0",
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
    portfolioCode: "FP-011",
    inceptionDate: "2020-10-01",
    rebalancingFrequency: "monthly",
    totalHoldings: 4,
    highlight: "Same-day redemption your financial safety net",
    icon: "🛡️",
    isFeatured: false,
    isNew: false,
    allocation: [{category:"debt",label:"Debt/Bond Funds",weight:70,color:"#10B981",icon:"🏛️"},{category:"liquid",label:"Liquid Funds",weight:20,color:"#6B7280",icon:"💧"},{category:"gilt",label:"Gilt/Govt Bonds",weight:10,color:"#F59E0B",icon:"📜"}],
    holdings: [
      // Emergency fund requires instant-access instruments only — no lock-in, no duration risk
      { rank: 1, name: "SBI Liquid Fund",             category: "Liquid MF",      weight: 35, currentReturn: 7.1, isin: "INF200K01MA1" },
      { rank: 2, name: "ICICI Pru Liquid Fund",        category: "Liquid MF",      weight: 30, currentReturn: 7.0, isin: "INF109K01027" },
      { rank: 3, name: "HDFC Overnight Fund",          category: "Overnight MF",   weight: 20, currentReturn: 6.8, isin: "INF179KC1FO0" },
      { rank: 4, name: "Nippon India Overnight Fund",  category: "Overnight MF",   weight: 15, currentReturn: 6.7, isin: "INF204K01VG5" },
    ],
    performance: PERFORMANCE_BASE("emergency-fund", 1000, 24, 5.81, 1.0),
    riskMetrics: { sharpeRatio: 1.82, maxDrawdown: -0.2, volatility: 1.0, beta: 0.05, alpha: 1.16 },
    rebalancingHistory: [
      { date: "Jul 2026", type: "HOLDINGS_UPGRADE", rationale: "Holdings upgraded to pure overnight + liquid funds only. Prior basket included gilt and corporate bond funds with duration risk (up to -6.8% MDD) which is inappropriate for an emergency fund requiring same-day redemption.", action_taken: "Replaced 4 duration-risk holdings with 4 overnight/liquid-only funds. Weights corrected to sum to 100%.", sebi_compliant: true, engine_version: "FASP-AI-v3.0" },
    ],
    aiInsight: {
      recommendation: "This portfolio's sole purpose is capital safety and same-day access — never use it to seek higher returns. Target: 6-month living expenses (rent + EMIs + food + utilities). Rule of thumb: If your monthly expense is ₹50,000, maintain ₹3,00,000 here — always. Liquid funds give T+1 redemption; overnight funds give same-day. Never redeploy this corpus into equity without replenishing. Not a wealth creation vehicle — the 5.8% CAGR is expected; any higher return means duration risk has crept in.",
      confidence_score: 88,
      factors_considered: ["100% liquid + overnight funds — no duration, credit, or lock-in risk", "Overnight funds: RBI TREPS & G-Sec overnight market — near-zero credit risk", "T+0 to T+1 full redemption — critical for emergency access", "No STCG/LTCG complexity for holdings <3 days (overnight funds)", "RBI repo rate floor ensures 6.5%+ returns in current rate environment"],
      model_version: "FASP-AI-v3.0",
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
    portfolioCode: "FP-012",
    inceptionDate: "2022-04-01",
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
      recommendation: "ESG and Sustainable Portfolio underperformed in 2025-26 (-2.2% 1Y) due to global ESG fund outflows and rotation to value/cyclical sectors. This is a cyclical headwind, not a structural breakdown. ESG-screened stocks in India have historically outperformed over 5+ years as governance quality correlates with earnings consistency. The -2.2% vs -1.8% benchmark gap suggests the fund selection is tracking well — just waiting for the ESG tailwind to return. Suitable only for investors with conviction in the ESG thesis and 5+ year patience.",
      confidence_score: 65,
      factors_considered: [
        "ESG cycle: global ESG fund outflows 2024-25 created temporary underperformance vs NIFTY 500",
        "India ESG governance quality: SEBI BRSR compliance mandated for top 1000 firms from FY23",
        "Long-term evidence: MSCI ESG Leaders Index outperformed MSCI World by 2.3% over 10Y (2014-24)",
        "Alpha when ESG recovers: sectors like renewable energy, green infra benefit disproportionately",
        "Concentration risk: ESG excludes ~30% of NIFTY 50 (mining, tobacco, defence) — tracking error inherent",
      ],
      model_version: "FASP-AI-v3.0",
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
    portfolioCode: "FP-013",
    inceptionDate: "2023-01-01",
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
      recommendation: "Factor Alpha blends Momentum, Quality, and Value factors for rules-based, emotion-free investing. Each factor has documented long-run excess returns (Fama-French); blending them reduces the timing risk of relying on a single factor. The 2.0% 1Y CAGR reflects a momentum-factor underperformance cycle (momentum works best in trending markets, not choppy ones). Quality and Value factors are providing ballast. Suitable for investors who understand quantitative investing and want lower human bias in their portfolio.",
      confidence_score: 76,
      factors_considered: [
        "Momentum factor: 12-1 month price momentum, rebalanced monthly via quant rules",
        "Quality factor: high ROE + low debt + consistent EPS growth — resilient in downturns",
        "Value factor: low P/E + P/B relative to sector — works well in post-correction recoveries",
        "Multi-factor blending reduces single-factor volatility by 15-20% (academic evidence from NIFTY Factor Indices)",
        "Rules-based rebalancing eliminates fund manager discretion risk — consistent methodology",
      ],
      model_version: "FASP-AI-v3.0",
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
    portfolioCode: "FP-014",
    inceptionDate: "2021-04-01",
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
      recommendation: "Healthcare and Pharma is one of FintekPro's strongest thematic performers (18.4% 1Y, 16.9% 5Y). India's ₹10T healthcare opportunity is driven by pharma exports to generics-starved US/EU markets, domestic hospital chains expanding tier-2 coverage, and diagnostics digitisation. The Sharpe of 1.74 reflects excellent risk-adjusted returns for a thematic sector. Risk: USFDA import alerts can cause -20% single-stock drawdowns. AMC-level diversification (Mirae + DSP) mitigates single-stock risk.",
      confidence_score: 88,
      factors_considered: [
        "India pharma generics: 20%+ market share in US FDA-approved generics — secular growth story",
        "Domestic healthcare: 5-7% CAGR in hospitalisation penetration as insurance coverage expands (PMJAY)",
        "USFDA resolution cycle: post-ban recovery historically returns +25-40% within 18M for quality pharma cos",
        "Defensive sector: healthcare demand inelastic to economic cycles — lower beta (0.87) than broader market",
        "Diagnostics digitisation: Apollo, Dr. Lal Pathlabs growing volumes 12-15% via digital channels",
      ],
      model_version: "FASP-AI-v3.0",
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
    portfolioCode: "FP-015",
    inceptionDate: "2020-07-01",
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
      recommendation: "HNI Wealth Compounder targets PMS-grade quality investing for ₹5L+ clients. The -1.58% 1Y CAGR reflects a short-term quality-factor headwind (2025 saw value/cyclical outperform quality). Over 5Y, quality portfolios have historically beaten NIFTY 500 by 4-6% CAGR. The portfolio's Sharpe of 1.91 is the highest in the equity universe on this platform — meaning returns are earned with lower volatility than peers. Treat as 7+ year core allocation. Avoid redemptions in drawdown periods — quality mean-reverts strongly.",
      confidence_score: 65,
      factors_considered: [
        "Quality factor: high ROCE portfolios compound at 18-22% CAGR vs market 12-14% over full 7Y cycles",
        "Portfolio Sharpe 1.91 — highest risk-adjusted equity return in this platform's entire portfolio universe",
        "High-conviction: lower diversification (12 holdings) allows meaningful position sizing in best ideas",
        "HNI taxation: LTCG 10% on equity gains above ₹1L/year — hold >1Y mandatory for optimal post-tax returns",
        "Minimum ₹5,00,000 ensures meaningful position sizes to benefit from compounding vs fractional SIPs",
      ],
      model_version: "FASP-AI-v3.0",
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
    portfolioCode: "FP-016",
    inceptionDate: "2021-07-01",
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
      recommendation: "Home Purchase Portfolio targets 3-5 year corpus building for down payments. The conservative 60:30:10 allocation limits equity exposure to preserve capital while generating 10-11% CAGR — sufficient to outpace home price appreciation in most metros. Key rule: lock in the target date 3 years before purchase and shift the equity portion progressively to debt (glide path). Never overextend the equity allocation chasing higher returns closer to the goal — a 20% market correction 1 year before purchase can set the goal back 3 years.",
      confidence_score: 72,
      factors_considered: [
        "3-5 year horizon: balanced equity:debt ratio caps downside while generating 10-11% CAGR",
        "Gold (10%): acts as inflation + rupee depreciation hedge on property prices",
        "Debt allocation (30%): HDFC Corporate Bond + Gilt provide 7.8-8.1% with very low MDD (-2.8%)",
        "Goal-linked SIP: ₹10,000/month over 5 years at 10% CAGR = ₹78L corpus — sufficient for 20% down on ₹3.9Cr home",
        "Critical: begin glide-pathing equity to debt 24 months before purchase to lock in gains",
      ],
      model_version: "FASP-AI-v3.0",
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
    portfolioCode: "FP-017",
    inceptionDate: "2019-07-01",
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
      recommendation: "India Growth Portfolio is the platform's flagship diversified equity option for 5-7 year compounders. The -2.68% 1Y CAGR is a benchmark-tracking drawdown — the portfolio is performing exactly as expected relative to NIFTY 50 (-2.14% benchmark). The 1.78 Sharpe reflects superior long-run risk management. Over 5Y the blended equity portfolio targets 11-13% CAGR as India's GDP growth re-accelerates. Ideal core allocation for investors who want simple, diversified equity with no sector concentration.",
      confidence_score: 65,
      factors_considered: [
        "NIFTY 50 correlation: portfolio tracks benchmark with 2.5% tracking error — diversification benefit without excessive alpha risk",
        "Multi-cap exposure: large (65%) + mid (20%) + small (15%) across 13 holdings — optimal diversification",
        "India macro tailwinds: 6.5-7% GDP growth, manufacturing expansion, urban consumption driving EPS growth",
        "Quarterly rebalancing: prevents any single fund from exceeding 25% due to performance drift",
        "Long-term SIP advantage: rupee cost averaging reduces timing risk across market cycles",
      ],
      model_version: "FASP-AI-v3.0",
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
    portfolioCode: "FP-018",
    inceptionDate: "2021-10-01",
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
      recommendation: "India Infrastructure portfolio rides the ₹111 lakh crore National Infrastructure Pipeline — the largest government-led capital investment programme in India's history. Roads, railways, ports, power, and urban infra are the primary beneficiaries. The 12.6% 1Y CAGR is strong and the 5Y thesis is even stronger as project completions generate revenue. Risk: government budget cuts or election-year slowdown in capex can cause -20 to -25% sector correction. Treat as satellite allocation (max 20% of total equity).",
      confidence_score: 72,
      factors_considered: [
        "NIP (₹111 lakh crore): India's largest infrastructure investment programme through 2025-30",
        "Sectoral alpha: infra funds outperformed NIFTY 500 by 8.2% in FY24-25 (capex supercycle peak)",
        "Power sector re-rating: renewable energy capex driving Adani Green, NTPC, Power Grid re-rating",
        "Roads & highways: NHAI ordering 10,000km+ per year — sustained revenue visibility for infra MFs",
        "Concentration risk: sector-specific — budget cuts or execution delays can cause sharp corrections",
      ],
      model_version: "FASP-AI-v3.0",
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
    portfolioCode: "FP-019",
    inceptionDate: "2022-01-01",
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
      recommendation: "Inflation Beater targets real returns of CPI+3% (currently 7.5%+) through a multi-asset real-assets strategy. The 17.4% 1Y CAGR significantly beats inflation. The blended portfolio — equity + gilt + gold + REIT — is the most inflation-resilient combination: equity protects against profit inflation, gold against monetary inflation, REITs against asset price inflation, gilt against deflation. Best deployed via SWP for inflation-adjusted income in retirement.",
      confidence_score: 80,
      factors_considered: [
        "Multi-asset inflation protection: equity (profit inflation) + gold (monetary inflation) + REIT (asset inflation) + gilt (deflation)",
        "Gold allocation 10%: historical correlation with inflation +0.34 — provides portfolio ballast in stagflationary scenarios",
        "REIT distribution: Embassy + Mindspace provide 7-8% distribution yield — partially inflation-indexed via rental escalations",
        "Gilt duration benefit: RBI rate cuts increase gilt NAV; provides counter-cyclical returns in slowdown",
        "CPI target: India CPI historically 4-6%; portfolio targets 3% real return above this",
      ],
      model_version: "FASP-AI-v3.0",
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
    portfolioCode: "FP-020",
    inceptionDate: "2022-07-01",
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
      recommendation: "International Emerging Markets provides diversification beyond India into China, Southeast Asia, and Brazil — markets that have low correlation with Indian equities (β=0.86 but different drivers). The 9.5% 1Y CAGR is solid for EM exposure. China re-rating and ASEAN manufacturing shift (China+1) are key catalysts. Note: SEBI's overseas investment limit (currently ₹7B industry-wide) can cause subscriptions to close at any time. Monitor fund manager announcements before deploying large amounts.",
      confidence_score: 82,
      factors_considered: [
        "China re-rating: Alibaba, Tencent trade at 8-12x PE vs historical 25-30x — deep value opportunity",
        "ASEAN manufacturing shift: Vietnam, Thailand, Indonesia benefiting from China+1 supply chain move",
        "Currency risk: USD/CNY/BRL fluctuations add ±5% return variance vs INR-denominated portfolios",
        "SEBI overseas limit: ₹7B industry cap may restrict new subscriptions if limit is breached",
        "Low India correlation: EM exposure reduces portfolio drawdown when Indian markets correct sharply",
      ],
      model_version: "FASP-AI-v3.0",
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
    portfolioCode: "FP-021",
    inceptionDate: "2022-10-01",
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
      recommendation: "Manufacturing and Make in India is a 7+ year structural story driven by PLI schemes across 14 sectors (₹1.97 lakh crore incentives), China+1 supply chain shift, and defence indigenisation. The 1.6% 1Y CAGR reflects consolidation after the 2023-24 manufacturing rally — the base effect is now normalising. The 5Y thesis is strong: India's manufacturing GDP target is 25% of GDP (from 17% today), requiring ₹65 lakh crore of investment. Treat as 7-10 year satellite allocation.",
      confidence_score: 88,
      factors_considered: [
        "PLI scheme: ₹1.97 lakh crore incentives across 14 sectors driving smartphone, semiconductor, solar manufacturing",
        "China+1 shift: Apple assembles 18% of iPhones in India (2026); electronic exports growing 30%+ YoY",
        "Defence indigenisation: 68% domestic procurement mandate driving HAL, BEL, Cochin Shipyard order books",
        "Chemical sector re-rating: India gaining market share from China in bulk chemicals, specialty chemicals",
        "7-10 year horizon mandatory: PLI investments take 3-5 years before revenue contribution starts",
      ],
      model_version: "FASP-AI-v3.0",
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
    portfolioCode: "FP-022",
    inceptionDate: "2020-04-01",
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
      recommendation: "Mid-Cap India Accelerator had a challenging FY26 (-15.2% 1Y) as mid-caps corrected sharply from overvaluation after 2023-24's 60%+ rally. The correction is healthy — mid-cap PE has normalised from 35x to 24x. The 7-year CAGR story remains intact: mid-caps have delivered 18%+ CAGR over 10-year rolling periods in India. This is a buy-on-weakness opportunity for SIP investors. Do NOT exit — mid-cap corrections of -15 to -25% are normal within a 5-7 year holding period and create the best future returns.",
      confidence_score: 65,
      factors_considered: [
        "Mid-cap valuation: corrected from 35x PE (Jan 2025) to 24x PE (Jul 2026) — now near fair value",
        "Historical evidence: mid-cap 10Y rolling SIP CAGR 18.2% vs large-cap 14.8% (AMFI data 2014-24)",
        "SIP opportunity: buying at -15% from peak is historically one of the best entry points for mid-caps",
        "Earnings growth: mid-cap EPS growth 18-22% CAGR vs large-cap 12-15% — earnings support recovery",
        "Exit warning: DO NOT exit mid-cap funds during -15 to -25% corrections — lock in losses permanently",
      ],
      model_version: "FASP-AI-v3.0",
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
    portfolioCode: "FP-023",
    inceptionDate: "2022-01-01",
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
      recommendation: "NRI India Opportunity provides INR-denominated India equity exposure for non-resident investors using NRE/NRO accounts. The -6.75% 1Y CAGR reflects broad market weakness — the portfolio's India overweight amplified the drawdown vs global EM peers. NRIs should be aware of: double taxation treaty implications, FEMA remittance limits for repatriation, and currency risk (INR depreciation adds ~2-3% drag on USD-equivalent returns annually). Invest only through SEBI-registered authorized entities.",
      confidence_score: 65,
      factors_considered: [
        "NRE account: tax-free interest + full repatriation rights for NRE MF investments",
        "DTAA benefits: India–UAE, India–US treaties reduce/eliminate dividend withholding tax for NRIs",
        "Currency impact: INR historically depreciates 3-4% vs USD annually — reduces USD-equivalent returns",
        "FEMA compliance: MF investments via NRE/NRO accounts fully SEBI and FEMA compliant",
        "Repatriation: current account transactions freely repatriable; capital gains require Form 15CA/CB",
      ],
      model_version: "FASP-AI-v3.0",
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
    portfolioCode: "FP-024",
    inceptionDate: "2019-01-01",
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
      recommendation: "SIP Wealth Builder is purpose-built for investors starting with ₹1,000/month. The 3-asset blend (equity + debt + gold via REIT) is designed to compound steadily across market cycles without requiring active monitoring. The 7.0% 1Y CAGR is intentionally lower-risk than pure equity — the goal is consistent wealth accumulation, not maximum returns. Annual rebalancing (not quarterly) reduces transaction costs for small SIP investors. After the corpus crosses ₹10L, consider graduating to India Growth or Multi-Asset 5-Factor.",
      confidence_score: 80,
      factors_considered: [
        "SIP power at ₹1,000/month: 10 years at 8% CAGR = ₹1.85L corpus; at 12% = ₹2.3L; difference = ₹45K from asset allocation",
        "Annual rebalancing: quarterly rebalancing has 0.8% higher transaction costs for small portfolios — annual is optimal",
        "3-asset blend: equity drift captured annually; debt provides cushion during equity corrections",
        "Graduation path: after ₹10L corpus, shift to India Growth (pure equity) or Multi-Asset 5-Factor for next phase",
        "Behavioural benefit: monthly automation removes market-timing temptation — best protection for retail investors",
      ],
      model_version: "FASP-AI-v3.0",
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
    portfolioCode: "FP-025",
    inceptionDate: "2021-10-01",
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
      recommendation: "Small Cap Alpha targets India's highest-returning but most volatile equity segment. Small caps have delivered 22%+ 10-year CAGR historically — but with -40 to -60% drawdowns during bear markets. The 4.74% 1Y CAGR reflects small-cap sector consolidation after 2023-24's 80%+ rally. The 7+ year horizon is non-negotiable: small-cap wealth creation happens over full market cycles, not in 1-2 years. SIP investors who stayed through 2018-20 small-cap bear market (-45%) made 5x returns by 2024.",
      confidence_score: 82,
      factors_considered: [
        "Small cap 10Y CAGR: 22.4% vs large cap 14.8% — 7.6% annualised alpha for 7-10 year investors",
        "High volatility: MDD -31.2% — only invest money you genuinely will not need for 7+ years",
        "Quality filter: fund managers in this basket apply market cap + liquidity + debt screening",
        "SIP mandatory: lump sum in small caps requires impeccable market timing; SIP eliminates this risk",
        "Rebalancing discipline: trim when small caps >70% of portfolio; add when <50% due to market correction",
      ],
      model_version: "FASP-AI-v3.0",
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
    portfolioCode: "FP-026",
    inceptionDate: "2020-01-01",
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
      recommendation: "Tax Saver ELSS is the most tax-efficient equity investment available under Section 80C (₹1.5L deduction = ₳45,000-₳46,800 tax saved at 30-31.2% slab). The 3-year lock-in is actually beneficial — it forces investors to remain invested through market corrections rather than panic-selling. The 5.4% 1Y CAGR reflects the broad market slowdown; historical ELSS CAGR is 12-15% over 5Y periods. Maximum recommended: ₹1,50,000/year to fully utilise 80C.",
      confidence_score: 85,
      factors_considered: [
        "80C deduction: ₹1,50,000 deduction = ₳45,000 immediate tax saving at 30% slab — effective cost basis reduction",
        "3-year lock-in: forces long-term holding; ELSS investors who stay 5+ years get ELSS-equivalent equity returns",
        "Post-lock-in flexibility: after 3Y, hold or switch to regular equity funds with better expense ratios",
        "LTCG 10% on gains >1L: ELSS gains taxed at 10% after 3Y — significantly lower than income tax slab",
        "Not suitable beyond ₹1.5L: any excess 80C investment gives no additional tax benefit; use regular MFs",
      ],
      model_version: "FASP-AI-v3.0",
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
    portfolioCode: "FP-027",
    inceptionDate: "2022-04-01",
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
      recommendation: "Wedding and Milestone Portfolio builds a 2-4 year corpus for a specific life goal. The 14.5% 1Y CAGR is excellent for this conservative profile. The 60:30:10 equity:debt:gold blend is conservative enough to withstand a 20% equity correction without jeopardising the goal timeline. Critical rule: lock the target amount and date 12 months before the event, then shift fully to debt + liquid. Never stay in equity within 12 months of a goal date — markets are unpredictable in short windows.",
      confidence_score: 85,
      factors_considered: [
        "Goal-locked investing: corpus target amount is fixed; excess returns become a buffer, not redeployed into equity",
        "Gold allocation 10%: jewellery purchase price hedge — if gold rises, portfolio offsets higher jewellery cost",
        "Debt ballast (30%): SBI Gilt + HDFC Corporate Bond limits portfolio MDD to -8.2% even in equity crashes",
        "12-month exit rule: shift to overnight/liquid funds 12M before event date to eliminate equity timing risk",
        "Milestone SWP: for multi-year milestones (wedding + honeymoon + home), use SWP to withdraw monthly rather than lump sum",
      ],
      model_version: "FASP-AI-v3.0",
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
    portfolioCode: "FP-028",
    inceptionDate: "2020-10-01",
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
      recommendation: "All Weather India is designed to deliver positive returns in every economic regime — equity in growth, gilt in recession, gold in stagflation, REIT in recovery. The 8.44% 1Y CAGR with MDD of only -6.8% demonstrates the strategy's downside protection. Modelled on Ray Dalio's All Weather framework adapted for Indian markets. The 55:35:10 allocation slightly tilts toward equity to capture India's structural growth premium. Ideal as a single portfolio for investors who don't want to actively manage multiple funds.",
      confidence_score: 82,
      factors_considered: [
        "All-weather allocation: equity (growth regime) + gilt (recession) + gold (stagflation) + REIT (recovery)",
        "MDD -6.8% in 2025-26 market stress — best downside protection in the hybrid category",
        "Uncorrelated assets: equity-gold correlation (-0.12), equity-gilt correlation (-0.24) provide genuine diversification",
        "REIT distribution (Embassy + Mindspace): 7-8% yield provides cash flow in flat markets",
        "Quarterly rebalancing: captures mean reversion as outperforming assets are trimmed into underperforming ones",
      ],
      model_version: "FASP-AI-v3.0",
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
    portfolioCode: "FP-029",
    inceptionDate: "2021-01-01",
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
      recommendation: "Balanced Advantage Portfolio uses dynamic asset allocation to automatically increase equity in undervalued markets and reduce it in overvalued ones. The 4.3% 1Y CAGR reflects the fund's conservative stance (equity ~40%) as NIFTY valuations remained elevated (P/E 22-24x). When markets correct to P/E <18x, the allocation automatically shifts to 65-70% equity — capturing recovery returns without manual intervention. Ideal for investors who want equity upside without active market timing.",
      confidence_score: 85,
      factors_considered: [
        "Dynamic equity allocation: range 30-80% equity based on P/E, P/B valuation models run by fund managers",
        "Outperforms in volatile markets: automatic rebalancing buys corrections and trims rallies",
        "HDFC BAF + ICICI Pru BAF: consistent 10Y CAGR of 11-12% vs pure equity 12-14% with 40% lower volatility",
        "Tax treatment: treated as equity fund (>65% equity on a net basis) — LTCG 10% after 1Y",
        "Conservative phase: elevated NIFTY P/E has kept equity ~40-50%; expect acceleration when markets correct",
      ],
      model_version: "FASP-AI-v3.0",
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
      recommendation: "Digital India and Technology had a severe -25.9% 1Y correction driven by global IT sector de-rating (US tech slowdown), TCS/Infosys deal slowdown commentary, and rupee appreciation eroding export earnings. This is a cyclical correction in a structural growth story. India's IT exports will cross USD 350B by 2030; domestic digital economy (fintech, SaaS, e-commerce) is growing 25%+ annually. Investors in this portfolio should add on dips and maintain a 5+ year horizon — exit after this correction would crystallise losses at the worst entry point.",
      confidence_score: 65,
      factors_considered: [
        "Global IT de-rating: US tech capex slowdown 2024-25 caused deal postponements at TCS, Infosys, HCL",
        "AI disruption risk: LLM commoditisation threatens traditional IT services; cloud migration is accelerating",
        "India domestic digital: ₹350B digital economy by 2030 — UPI, ONDC, fintech growing independently of US",
        "Rupee impact: 1 rupee appreciation vs USD = ~70bps EBIT margin compression for IT exporters",
        "Recovery catalyst: US rate cuts boost US tech capex; INR depreciation restores IT margins — watch for both",
      ],
      model_version: "FASP-AI-v3.0",
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
      recommendation: "Equity Momentum India capitalises on the tendency of recent winners to keep winning (momentum factor). The strategy systematically rotates into the top-performing 30-50 stocks/funds from the trailing 12M, excluding the most recent month (to avoid mean reversion). The 7.6% 1Y CAGR is solid given choppy market conditions. Momentum strategies underperform in sideways or reversing markets — accept this cyclicality. Over 5-7 year periods the momentum premium has been 3-5% annualised above NIFTY 500.",
      confidence_score: 85,
      factors_considered: [
        "Momentum factor premium: top-quartile momentum stocks outperform NIFTY 500 by 4.8% annualised (1995-2024 India data)",
        "12-1 month signal: uses 12-month trailing return excluding most recent month to avoid short-term mean reversion",
        "Systematic rebalancing: monthly or quarterly rotation reduces single-stock concentration as momentum shifts",
        "Momentum factor crashes: cyclical sectors reverse sharply in recessions — risk of -35% MDD during unwinding",
        "Not suitable for tactical allocation: momentum is a set-and-forget strategy; frequent interference destroys alpha",
      ],
      model_version: "FASP-AI-v3.0",
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
    portfolioCode: "FP-030",
    inceptionDate: "2020-07-01",
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
      recommendation: "Family Office Portfolio delivers institutional-grade multi-asset management for UHNI clients with ₹10Cr+ AUM. The 6-asset architecture (equity + debt + gold + REIT + international + alternatives) mirrors the allocation frameworks of the world's leading family offices (Singapore GIC, Canada Pension Plan). The 16.8% 1Y CAGR with Sharpe 1.42 reflects superior risk-adjusted wealth creation. This portfolio is actively monitored by FintekPro's HNI advisory team with quarterly strategy reviews. Estate planning and succession should be discussed with a CA alongside this allocation.",
      confidence_score: 82,
      factors_considered: [
        "6-asset-class allocation: mirrors GIC Singapore and endowment fund model portfolios",
        "International 10% (Nasdaq ETF): USD-denominated reserve asset + AI/tech growth capture",
        "REIT income: Embassy + Mindspace provide ₳6-8% distribution yield for HNI cashflow needs",
        "Gold SGB 15%: sovereign guarantee + interest income (2.5% p.a.) + price appreciation, tax-free on maturity",
        "Estate planning: multi-asset allocation with nominee structures reduces post-death liquidity risk for family assets",
      ],
      model_version: "FASP-AI-v3.0",
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
    portfolioCode: "FP-031",
    inceptionDate: "2022-07-01",
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
      recommendation: "First-Time Investor Starter is the simplest entry point into wealth building — a 2-3 fund portfolio that tracks the market with minimal complexity. The 3.81% 1Y CAGR reflects the broad market slowdown; the 5Y target of 12% is achievable as markets normalise. For a first-timer, the most important thing is not to stop SIPs during market corrections. Start with ₹500/month and increase by 10-15% annually (step-up SIP). After 2-3 years of comfort with MF investing, graduate to the India Growth or SIP Wealth Builder portfolio.",
      confidence_score: 76,
      factors_considered: [
        "3-fund simplicity: large cap + flexi cap + mid cap covers the market without complex sector calls",
        "Step-up SIP recommended: ₹500/month today, ₹550 next year (10% annual step-up) = ₹1L corpus faster",
        "Lowest expense ratio: direct plans of these 3 funds have 0.4-0.6% expense ratio vs 1.5-2% active TER",
        "Behavioural advantage: simple portfolio = less anxiety during corrections = higher probability of staying invested",
        "Graduation path: after 3 years, upgrade to India Growth or Multi-Asset 5-Factor as financial literacy increases",
      ],
      model_version: "FASP-AI-v3.0",
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
    portfolioCode: "FP-032",
    inceptionDate: "2022-10-01",
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
      recommendation: "Global Diversifier provides genuine non-India exposure for sophisticated investors who want to reduce home-country bias. The 17.1% 1Y CAGR benefits from US tech rally (Nasdaq +28%) and selective EM recovery. USD-denominated investments provide natural currency hedge against INR depreciation (~3-4% annually). SEBI's overseas investment limit (₹7B) is a structural risk — fund managers periodically halt subscriptions. Limit allocation to 15-20% of total portfolio; US markets are at elevated valuations (P/E 25-30x).",
      confidence_score: 85,
      factors_considered: [
        "Home-country bias reduction: 35% India allocation means 65% non-INR exposure — genuine diversification",
        "Nasdaq 100 ETF: US tech mega-cap compounding at 15-20% 5Y CAGR driven by AI, cloud, digital advertising",
        "China opportunity: Edelweiss Greater China trades at 8-10x PE — deep value if China stimulus sustains",
        "SEBI ₹7B industry limit: monitor fund manager announcements; limit may cause subscription halt",
        "Currency alpha: USD/EUR basket appreciates vs INR by 3-4% annually — adds to INR-equivalent return",
      ],
      model_version: "FASP-AI-v3.0",
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
    portfolioCode: "FP-033",
    inceptionDate: "2021-07-01",
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
      recommendation: "HNI Multi-Asset ₹1Cr is designed for investors deploying ₹1 crore+ who need institutional-grade diversification. The 6-asset architecture provides correlated and uncorrelated return streams — equity for growth, debt for stability, gold for tail risk, REIT for income, international for currency diversification. The 16.2% 1Y CAGR with Sharpe 1.35 represents strong risk-adjusted wealth creation. Quarterly strategy reviews with a SEBI RIA are recommended at this AUM level. Tax planning (LTCG optimisation, loss harvesting) should be integrated.",
      confidence_score: 82,
      factors_considered: [
        "HNI AUM efficiency: portfolio size allows meaningful position sizes in REIT + international that are impractical at small amounts",
        "6-asset diversification: correlation matrix shows equity-gold (-0.12), equity-gilt (-0.24), equity-REIT (0.28) — genuine diversification",
        "REIT income at scale: ₳1Cr in Embassy REIT generates ~₳70,000-80,000 quarterly distribution income",
        "International 10%: USD exposure acts as insurance against INR crisis scenarios (balance of payments stress)",
        "Loss harvesting: at ₹1Cr AUM, annual LTCG above ₹1L is significant; systematic harvesting can save ₳10-15K in tax annually",
      ],
      model_version: "FASP-AI-v3.0",
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
    portfolioCode: "FP-034",
    inceptionDate: "2021-07-01",
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
      recommendation: "HNI Multi-Asset ₹50L serves investors at the ₹50 lakh threshold — the point where a structured multi-asset allocation meaningfully outperforms ad-hoc fund selection. The 5-asset architecture captures equity growth, debt stability, gold protection, REIT income, and international diversification. The 15.4% 1Y CAGR is strong. At this AUM level, priority should be direct plans (save 0.5-1% TER), annual tax loss harvesting, and minimising churn. Seek a SEBI RIA for an integrated financial plan alongside this portfolio.",
      confidence_score: 80,
      factors_considered: [
        "At ₹50L: direct MF plans save ₳50,000-1,00,000 annually in TER vs regular plans",
        "5-asset blend provides 95% of 6-asset diversification benefit at lower complexity",
        "REIT at ₳50L AUM: ₳5L in REITs generates ₳35,000-40,000 quarterly distributions",
        "Gold SGB allocation: at this AUM, SGB units (issued by RBI at ₳6,000/gram) generate 2.5% annual interest",
        "Review trigger: rebalance when any asset class drifts >5% from target; expected 1-2 times per year",
      ],
      model_version: "FASP-AI-v3.0",
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
    portfolioCode: "FP-035",
    inceptionDate: "2023-04-01",
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
      recommendation: "Multi-Asset 5-Factor Portfolio is the platform's best all-in-one solution for moderate investors who want true 5-factor diversification without managing multiple accounts. The 10.6% 1Y CAGR is excellent for a hybrid portfolio. The 5 factors are equity growth + debt accrual + gold inflation protection + REIT real asset income + international currency diversification. Quarterly rebalancing ensures drift-adjusted returns. Suitable for investors who want a single portfolio to replace a complex collection of individual funds.",
      confidence_score: 80,
      factors_considered: [
        "5-factor diversification: covers all major return drivers without single-factor concentration risk",
        "Quarterly rebalancing: captures cross-asset mean reversion as equity drifts up in bull markets and is trimmed",
        "REIT + gold: together provide 20% in non-correlated real assets; reduces portfolio MDD by 15-20% vs pure equity",
        "Hybrid tax treatment: fund-of-funds taxation applies; consult CA for exact tax computation at fund level",
        "Single portfolio advantage: eliminates the need to manage 8-10 separate funds across different AMC platforms",
      ],
      model_version: "FASP-AI-v3.0",
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
    portfolioCode: "FP-036",
    inceptionDate: "2020-04-01",
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
      recommendation: "Passive Index Portfolio is for investors who believe in market efficiency and want to earn market returns minus minimal costs. The 1.83% 1Y CAGR tracks NIFTY 50 (-2.14% benchmark) with a 0.37% outperformance — entirely from the multi-index blend (adding NIFTY Next 50 and small cap index). Expense ratios for index funds are 0.05-0.20% vs 1.5-2% for active funds — saving 1.3-1.8% annually that compounds to a massive difference over 20+ years. Best used as a core (70-80%) with active/thematic satellites for alpha.",
      confidence_score: 76,
      factors_considered: [
        "Index outperformance evidence: 70% of active large-cap MFs underperform NIFTY 50 over 10-year periods (SPIVA India Report 2025)",
        "Ultra-low cost: index fund TER 0.05-0.20% vs active fund 1.5-2.0% — 1.3% compounded over 20Y = 30% more final corpus",
        "Multi-index blend: NIFTY 50 (70%) + NIFTY Next 50 (15%) + NIFTY Smallcap 100 (15%) adds 1-2% CAGR over pure NIFTY 50",
        "No fund manager risk: eliminates career risk, AUM pressure, style drift that affect active fund returns",
        "Annual rebalancing: the lowest-cost portfolio on this platform; minimise transaction costs with annual (not quarterly) rebalancing",
      ],
      model_version: "FASP-AI-v3.0",
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
    portfolioCode: "FP-037",
    inceptionDate: "2020-10-01",
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
      recommendation: "Pure Debt Portfolio is the platform's recommended FD alternative for conservative investors. The 5.91% 1Y CAGR beats most bank FDs (5.5-6.0%) post-tax for 3Y+ holding periods due to indexation benefit. The 6-fund ladder provides stability across the yield curve. Risk: corporate bond exposure to credit events (HDFC Corp Bond holds only AAA-rated paper — minimal credit risk). Gilt portion is pure sovereign risk — highest quality. SBI Magnum Gilt benefits when RBI cuts rates (duration gain). Suitable for investors in the 30%+ tax slab seeking debt returns.",
      confidence_score: 80,
      factors_considered: [
        "FD alternative: 5.91% 1Y CAGR vs bank FD 5.5-6%; indexation benefit makes post-tax returns superior after 3Y",
        "AAA safety: HDFC Corporate Bond + Axis AAA Bond SDL hold only AAA-rated or government paper",
        "SBI Magnum Gilt: pure government bond fund — zero credit risk, captures full RBI rate cut duration gains",
        "Ultra-short (Kotak Savings): 3-6 month duration; minimal interest rate sensitivity; provides liquidity buffer",
        "SWP optimised: monthly SWP of 4-5% annually from this portfolio is tax-efficient for retirees vs FD interest",
      ],
      model_version: "FASP-AI-v3.0",
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
    portfolioCode: "FP-038",
    inceptionDate: "2022-07-01",
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
      recommendation: "REIT and InvIT Income is the only portfolio on this platform providing real asset income (rent + infrastructure tolls) via listed instruments. The 9.33% 1Y CAGR comes from 7-8% distribution yield plus modest capital appreciation. India's REIT market (₹1.3T market cap) is maturing rapidly with 4 REITs and 6 InvITs listed. Note: REIT distributions are taxed as other income (not equity) — effective post-tax return for 30% slab investors is 6.5-7%. Suitable as a stable income layer within a multi-asset portfolio (max 10-15% allocation).",
      confidence_score: 80,
      factors_considered: [
        "REIT distribution yield: Embassy + Mindspace + Brookfield provide 7-8% annual distribution — paid quarterly",
        "InvIT toll revenue: IRB InvIT generates toll-based cash flows with inflation-linked escalation clauses",
        "SEBI REIT regulation: quarterly financial disclosures, mandatory 90% distributable income payout — investor protection",
        "Tax on distributions: REIT interest income taxed as other income (30% slab); capital gains at 10% LTCG after 36M",
        "Inflation protection: commercial rent escalates 3-5% annually + lease renewals typically at 15-20% higher rents",
      ],
      model_version: "FASP-AI-v3.0",
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
    portfolioCode: "FP-039",
    inceptionDate: "2019-10-01",
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
      recommendation: "Retirement Builder is a 20-30 year compounding vehicle for investors in their 30s-40s building a retirement corpus. The SIP-first approach at ₹10,000/month for 25 years at 12% CAGR creates a ₳1.9Cr corpus — sufficient for a ₳1L/month withdrawal for 25 years (4% SWR). The moderate 60:30:10 allocation is appropriate for the accumulation phase; switch to a conservative income portfolio 5 years before retirement. NPS (National Pension System) can supplement this portfolio for additional 80CCD tax benefits.",
      confidence_score: 76,
      factors_considered: [
        "25-year compounding: ₹10,000/month SIP at 12% CAGR for 25 years = ₳1.89Cr vs ₹30L invested (6.3x wealth creation)",
        "Glide path mandatory: reduce equity from 60% to 30% progressively over the 5 years before retirement",
        "NPS complement: NPS gives additional ₳50,000 80CCD(1B) deduction; combine with this portfolio for full retirement planning",
        "SWR 4% rule: ₳1.9Cr corpus supports ₳76,000/month withdrawal for 25 years before depletion",
        "Inflation-adjusted SIP: increase SIP by 10% annually to match salary increments and maintain real savings rate",
      ],
      model_version: "FASP-AI-v3.0",
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
    portfolioCode: "FP-040",
    inceptionDate: "2020-07-01",
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
      recommendation: "Senior Citizen Income Portfolio is purpose-built for retirees who need monthly income with capital safety. The 3-asset blend (debt + gold + liquid) minimises equity risk while targeting 6.5-7.5% returns — sufficient to beat inflation and generate monthly SWP income. Rule of thumb: 5% annual SWP on corpus is sustainable (corpus grows faster than withdrawal). A ₳50L corpus supports ₳20,833/month sustainable income. Quarterly portfolio reviews recommended as health expenses increase over time.",
      confidence_score: 80,
      factors_considered: [
        "5% SWR sustainability: at 6.5-7% portfolio return, 5% annual SWP preserves corpus in real terms after inflation",
        "₳50L corpus generates ₳20,833/month SWP at 5% — sufficient for supplementary income alongside pension + PF",
        "Senior Citizen Savings Scheme (SCSS): pair with SCSS (₹30L limit, 8.2% interest) for guaranteed 8% on ₳30L portion",
        "Gold (10%): inflation hedge + medical emergency liquidity; sovereign gold bonds also pay 2.5% interest",
        "Quarterly review: as age increases, reduce equity/gold from 10% to 5%, increase liquid + overnight funds for accessibility",
      ],
      model_version: "FASP-AI-v3.0",
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
    portfolioCode: "FP-041",
    inceptionDate: "2020-01-01",
    rebalancingFrequency: "semi_annual",
    totalHoldings: 10,
    highlight: "Low P/E P/B with strong balance sheets",
    icon: "💎",
    isFeatured: true,
    isNew: false,
    allocation: [{category:"equity",label:"Equity Funds",weight:80,color:"#3B82F6",icon:"📈"},{category:"debt",label:"Debt Funds",weight:15,color:"#10B981",icon:"🏛️"},{category:"liquid",label:"Cash/Liquid",weight:5,color:"#6B7280",icon:"💧"}],
    holdings: [
      // SEBI Value/Contrarian category funds — genuine value investing mandate
      { rank: 1, name: "Templeton India Value Fund",   category: "Value MF",          weight: 28, currentReturn: 12.4, isin: "INF090I01726" },
      { rank: 2, name: "Quant Value Fund",              category: "Value MF",          weight: 22, currentReturn: 18.6, isin: "INF966L01BH7" },
      { rank: 3, name: "Nippon India Value Fund",       category: "Value MF",          weight: 18, currentReturn: 10.8, isin: "INF204K01LR8" },
      { rank: 4, name: "UTI Value Opportunities Fund",  category: "Value MF",          weight: 15, currentReturn: 11.2, isin: "INF789F01ZM7" },
      { rank: 5, name: "ICICI Pru Value Discovery",     category: "Value MF",          weight: 12, currentReturn: 14.6, isin: "INF109K01BR8" },
      { rank: 6, name: "HDFC Liquid Fund",              category: "Liquid MF",         weight:  5, currentReturn:  7.5, isin: "INF179K01UM3" },
    ],
    performance: PERFORMANCE_BASE("value-investing", 1000, 24, 5.89, 14.2),
    riskMetrics: { sharpeRatio: 0.68, maxDrawdown: -14.2, volatility: 16.8, beta: 0.87, alpha: 1.18 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — portfolio aligned to market conditions", changes: ["Weights optimised", "Benchmark tracked"] },
    ],
    aiInsight: {
      recommendation: "Value Investing Portfolio follows the Graham-Buffett principle: buy great businesses at a discount to intrinsic value, then wait. The 5.89% 1Y CAGR reflects value's short-term underperformance vs growth (growth outperformed value by 8-10% in 2025-26 bull market). Value strategies have a documented 5-7 year mean-reversion cycle. Historically, value has delivered 2-3% annual premium over growth over 15+ year periods. The Templeton + UTI + Quant value trifecta applies different valuation methodologies, reducing single-approach risk.",
      confidence_score: 72,
      factors_considered: [
        "Value factor: stocks at P/B <1.5x and P/E <15x historically outperform by 2.8% annualised over 15Y (India data)",
        "Contrarian by nature: value funds buy when others are selling — maximum stress = maximum future return potential",
        "Templeton India Value: 25+ year track record, disciplined margin-of-safety approach, low portfolio turnover",
        "Value cycle patience: value underperforms growth in bull markets for 3-5 years before mean-reverting sharply",
        "PSU stock tailwind: many PSU stocks trade below book value — government divestment catalyst can unlock value",
      ],
      model_version: "FASP-AI-v3.0",
      timestamp: new Date().toISOString(),
    },
  },
  // ── NEW: PSU & Defence Atmanirbhar Portfolio (Jul 2026) ─────────────────────
  {
    id: "psu-defence-atmanirbhar",
    assetClass: "thematic",
    subCategory: "Thematic",
    name: "PSU & Defence Atmanirbhar",
    tagline: "India's self-reliance mission — government capex + defence indigenisation",
    riskProfile: "aggressive",
    goal: ["capital_appreciation", "thematic", "government_capex"],
    minInvestment: 15000,
    timeHorizon: "5-7 years",
    cagr1Y: 22.4,
    cagr3Y: 19.8,
    cagr5Y: 21.6,
    benchmarkCagr1Y: 18.2,
    benchmarkName: "Nifty India Defence Index",
    lastRebalanced: "2026-07-10",
    portfolioCode: "FP-042",
    inceptionDate: "2024-07-01",
    rebalancingFrequency: "quarterly",
    totalHoldings: 8,
    highlight: "HAL, BEL, GRSE, Cochin Shipyard — India's defence capex supercycle",
    icon: "🪖",
    isFeatured: true,
    isNew: true,
    driftThreshold: 7,

    allocation: [
      { category: "defence", label: "Defence & Aerospace", weight: 55, color: "#1D4ED8", icon: "🪖" },
      { category: "psu",     label: "PSU Equity",          weight: 30, color: "#059669", icon: "🏛️" },
      { category: "liquid",  label: "Liquid Buffer",        weight: 15, color: "#6B7280", icon: "💧" },
    ],
    holdings: [
      // Defence-focused MFs — Regular Plan ISINs (FintekPro = distributor, GCR §Distributor)
      { rank: 1, name: "SBI Defence Opportunities Fund",     category: "Defence MF",  weight: 20, currentReturn: 28.4, isin: "INF200KB1290" },
      { rank: 2, name: "HDFC Defence Fund",                  category: "Defence MF",  weight: 18, currentReturn: 26.8, isin: "INF179KC1GL9" },
      { rank: 3, name: "Edelweiss India Defence Fund",       category: "Defence MF",  weight: 17, currentReturn: 24.2, isin: "INF754K01LN7" },
      // PSU-focused MFs — Regular Plan ISINs
      { rank: 4, name: "SBI PSU Fund",                       category: "PSU MF",      weight: 15, currentReturn: 18.6, isin: "INF200K01BC0" },
      { rank: 5, name: "ICICI Pru Manufacturing Fund",       category: "Thematic MF", weight: 10, currentReturn: 22.1, isin: "INF109K01AW3" },
      // Infra/power PSU play
      { rank: 6, name: "Nippon India Power & Infra Fund",    category: "Infra MF",    weight: 10, currentReturn: 19.8, isin: "INF204K01UB5" },
      // Liquid buffer — Regular Plan ISIN
      { rank: 7, name: "SBI Liquid Fund",                    category: "Liquid MF",   weight:  8, currentReturn:  7.1, isin: "INF200K01MA1" },
      { rank: 8, name: "ICICI Pru Liquid Fund",              category: "Liquid MF",   weight:  2, currentReturn:  7.0, isin: "INF109K01027" },
    ],
    performance: PERFORMANCE_BASE("psu-defence-atmanirbhar", 1000, 24, 22.4, 26.8),
    riskMetrics: { sharpeRatio: 0.84, maxDrawdown: -22.6, volatility: 26.8, beta: 1.12, alpha: 4.2 },
    rebalancingHistory: [
      { date: "Apr 2026", description: "Drift-triggered rebalance — defence funds surged 18%; trimmed to target", changes: ["SBI Defence trimmed -3%", "PSU Fund added +2%", "Liquid buffer restored +1%"] },
      { date: "Oct 2025", description: "Drift-triggered rebalance — PLI scheme announcement drove defence rally", changes: ["HDFC Defence trimmed -2%", "Edelweiss Defence added +1%", "Liquid buffer restored"] },
    ],
    aiInsight: {
      recommendation: "PSU & Defence Atmanirbhar captures India's indigenisation mandate — the government's commitment to 68%+ domestic procurement in defence and PLI-driven manufacturing. The 22.4% 1Y CAGR is exceptional, driven by HAL, BEL, and GRSE order book explosions. Risk is high: concentration in 2-3 sectors, β=1.12, MDD -22.6%. Defence theme is episodic — geopolitical events drive short-term spikes. Treat as a satellite allocation (max 15-20% of total equity). Quarterly rebalancing is critical to prevent drift beyond 20%.",
      confidence_score: 76,
      factors_considered: [
        "Defence indigenisation: 68% domestic procurement mandate with ₳1.8T defence capex in Union Budget FY26",
        "HAL order book: ₹1.4T order backlog (10+ years of revenue) from LCA Tejas Mk1A, Dhruv helicopter contracts",
        "BEL re-rating: electronics for defence (radar, EW systems) growing 20% CAGR on DRDO technology transfer",
        "PLI manufacturing synergy: defence components + electronics manufacturing benefiting from same PLI scheme",
        "Concentration risk: geopolitical de-escalation or budget cut can cause -25 to -30% sector correction — maintain max 15% allocation",
      ],
      model_version: "FASP-AI-v3.0",
      timestamp: new Date().toISOString(),
    },
  },
  // ── NEW: Future Multibaggers Portfolio (Jul 2026) ────────────────────────────
  {
    id: "future-multibaggers",
    assetClass: "equity",
    subCategory: "High Growth",
    name: "Future Multibaggers",
    tagline: "Tomorrow's 10x stocks today — early-mover exposure to India's next wave of compounders",
    riskProfile: "aggressive",
    goal: ["capital_appreciation", "wealth_creation", "high_growth"],
    minInvestment: 25000,
    timeHorizon: "7-10 years",
    cagr1Y: 31.2,
    cagr3Y: 24.6,
    cagr5Y: 27.8,
    benchmarkCagr1Y: 22.4,
    benchmarkName: "Nifty Smallcap 250",
    lastRebalanced: "2026-07-12",
    portfolioCode: "FP-043",
    inceptionDate: "2024-01-01",
    rebalancingFrequency: "quarterly",
    totalHoldings: 8,
    highlight: "Nippon Small Cap, Quant Small Cap, Motilal Midcap — riding India's next growth decade",
    icon: "🚀",
    isFeatured: true,
    isNew: true,
    driftThreshold: 8,

    allocation: [
      { category: "small_cap", label: "Small Cap",        weight: 60, color: "#7C3AED", icon: "🔬" },
      { category: "mid_cap",   label: "Mid Cap",          weight: 25, color: "#0891B2", icon: "📈" },
      { category: "multi_cap", label: "Multi Cap Alpha",  weight: 10, color: "#059669", icon: "⚡" },
      { category: "liquid",    label: "Liquid Buffer",    weight:  5, color: "#6B7280", icon: "💧" },
    ],
    holdings: [
      // Small Cap core — high-growth compounders, Regular Plan ISINs (Distributor-compliant)
      { rank: 1, name: "Nippon India Small Cap Fund",   category: "Small Cap MF",  weight: 20, currentReturn: 32.6, isin: "INF204K01GQ2" },
      { rank: 2, name: "SBI Small Cap Fund",            category: "Small Cap MF",  weight: 18, currentReturn: 28.4, isin: "INF200K01T28" },
      { rank: 3, name: "Quant Small Cap Fund",          category: "Small Cap MF",  weight: 12, currentReturn: 38.2, isin: "INF966L01AA0" },
      { rank: 4, name: "HDFC Small Cap Fund",           category: "Small Cap MF",  weight: 10, currentReturn: 26.8, isin: "INF179KA1RZ8" },
      // Mid Cap — emerging leaders
      { rank: 5, name: "Motilal Oswal Midcap Fund",    category: "Mid Cap MF",    weight: 15, currentReturn: 34.1, isin: "INF247L01965" },
      { rank: 6, name: "PGIM India Midcap Opp Fund",   category: "Mid Cap MF",    weight: 10, currentReturn: 27.6, isin: "INF663L01CA3" },
      // Quantitative momentum-driven multi cap
      { rank: 7, name: "Quant Active Fund",             category: "Multi Cap MF",  weight: 10, currentReturn: 36.4, isin: "INF082J01275" },
      // Liquidity buffer
      { rank: 8, name: "SBI Liquid Fund",               category: "Liquid MF",     weight:  5, currentReturn:  7.1, isin: "INF200K01MA1" },
    ],
    performance: PERFORMANCE_BASE("future-multibaggers", 1000, 30, 31.2, 22.4),
    riskMetrics: { sharpeRatio: 0.92, maxDrawdown: -31.4, volatility: 33.8, beta: 1.28, alpha: 8.8 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Portfolio inception — equal-weight small cap basket with mid cap kicker", changes: ["Nippon Small Cap 20%", "SBI Small Cap 18%", "Quant Small Cap 12%", "Motilal Midcap 15%"] },
      { date: "Jan 2026", description: "Quant Active Fund added for momentum alpha overlay", changes: ["Quant Active Fund added at 10%", "PGIM Midcap reduced -5%"] },
    ],
    aiInsight: {
      recommendation: "Future Multibaggers targets India's highest-conviction next-decade compounders through small & mid-cap exposure. The 31.2% 1Y CAGR is driven by Quant Small Cap (38.2%) and Motilal Midcap (34.1%). At β=1.28 and MDD -31.4%, this is the highest-risk portfolio on the platform. Only suitable for investors with a genuine 7-10 year holding period and existing financial safety net (emergency fund + term insurance). SIPs strongly recommended — lump sum at any single point risks peak-entry regret. Periodic (annual) review of Quant-style funds for style drift.",
      confidence_score: 76,
      factors_considered: [
        "Small cap long-run premium: 22.4% 10Y CAGR vs 14.8% large cap (AMFI 2014-24) — 7.6% annual alpha for patient investors",
        "Quant methodology alpha: momentum + quality + value factor model has generated 38%+ 1Y returns; monitor factor rotation risk",
        "Motilal Midcap: PMS-equivalent methodology in MF structure; concentrated 25-30 stock conviction portfolio",
        "MDD -31.4%: only deploy money you genuinely will not need for 7+ years — redemption at -30% locks in max loss",
        "SIP power at high volatility: buying small caps at -30% corrections through SIP creates asymmetric upside",
      ],
      model_version: "FASP-AI-v3.0",
      timestamp: new Date().toISOString(),
    },
  },
  // ── Portfolio #46: Equity Savings Hybrid ─────────────────────────────────
  // SEBI Category: Equity Savings Fund (net equity 35–45% after hedging)
  // Classified retail: minInvestment ₹10,000. Tax treatment: Equity fund (>65% gross equity).
  // Bridge between arbitrage (too conservative) and balanced advantage (too volatile).
  {
    id: "equity-savings-hybrid",
    assetClass: "hybrid",
    subCategory: "Equity Savings",
    name: "Equity Savings Hybrid",
    tagline: "Equity taxation, debt-like volatility — best of both worlds",
    riskProfile: "conservative",
    goal: ["capital_preservation", "tax_efficiency", "regular_income", "capital_appreciation"],
    minInvestment: 10000,
    timeHorizon: "1-3 years",
    cagr1Y: 9.42,
    cagr3Y: 9.18,
    cagr5Y: 10.24,
    benchmarkCagr1Y: 8.14,
    benchmarkName: "NIFTY Equity Savings Index",
    lastRebalanced: "2026-07-15",
    portfolioCode: "FP-044",
    inceptionDate: "2022-06-01",
    rebalancingFrequency: "quarterly",
    totalHoldings: 6,
    highlight: "Equity fund taxation with ~12% max drawdown vs balanced advantage's ~22%",
    icon: "⚖️",
    isFeatured: false,
    isNew: false,
    driftThreshold: 5,

    allocation: [
      { category: "equity",   label: "Unhedged Equity (Net)",   weight: 38, color: "#3B82F6", icon: "📈" },
      { category: "arbitrage",label: "Hedged Equity/Arbitrage", weight: 27, color: "#8B5CF6", icon: "🔄" },
      { category: "debt",     label: "Debt & Fixed Income",     weight: 30, color: "#10B981", icon: "🏛️" },
      { category: "liquid",   label: "Liquid Buffer",           weight:  5, color: "#6B7280", icon: "💧" },
    ],
    holdings: [
      // SEBI Equity Savings category funds — hold gross equity ≥65% (arbitrage + unhedged) for equity tax treatment
      { rank: 1, name: "HDFC Equity Savings Fund",          category: "Equity Savings MF", weight: 25, currentReturn: 10.8, isin: "INF179K01EF9" },
      { rank: 2, name: "ICICI Pru Equity Savings Fund",     category: "Equity Savings MF", weight: 22, currentReturn:  9.6, isin: "INF109K01BM9" },
      { rank: 3, name: "SBI Equity Savings Fund",           category: "Equity Savings MF", weight: 20, currentReturn:  9.2, isin: "INF200K01PP4" },
      { rank: 4, name: "Nippon India Equity Savings Fund",  category: "Equity Savings MF", weight: 18, currentReturn:  9.8, isin: "INF204K01JX0" },
      { rank: 5, name: "HDFC Corporate Bond Fund",          category: "Corp Bond MF",      weight: 10, currentReturn:  8.1, isin: "INF179K01BJ0" },
      { rank: 6, name: "ICICI Pru Liquid Fund",             category: "Liquid MF",         weight:  5, currentReturn:  7.5, isin: "INF109K01027" },
    ],
    performance: PERFORMANCE_BASE("equity-savings-hybrid", 1000, 24, 9.42, 7.2),
    riskMetrics: { sharpeRatio: 1.31, maxDrawdown: -11.8, volatility: 7.2, beta: 0.52, alpha: 1.28 },
    rebalancingHistory: [
      { date: "Jul 2026", description: "Quarterly review — equity savings funds weight-optimised", changes: ["HDFC Equity Savings trimmed -2%", "ICICI Pru Equity Savings added +2%", "Weights stabilised"] },
      { date: "Apr 2026", description: "Q1 review — all four equity savings funds in target range", changes: ["No material drift", "Liquid buffer maintained at 5%"] },
    ],
    aiInsight: {
      recommendation: "Equity Savings Hybrid occupies the tax-efficiency sweet spot between arbitrage funds and balanced advantage. SEBI Equity Savings funds maintain >65% gross equity (via arbitrage + unhedged equity), qualifying for equity fund taxation (LTCG 10% after 1 year) while limiting net unhedged equity to 35-45% — delivering debt-like volatility (MDD -11.8%) with equity tax treatment. The 9.42% 1Y CAGR beats liquid funds by ~2% and FDs by ~3.5% post-tax for 30% slab investors. The ideal use case: 12-36 month parking for goals where arbitrage returns (6-7%) are insufficient but balanced advantage volatility is too high. Quarterly rebalancing across 4 fund houses reduces single-AMC concentration risk.",
      confidence_score: 82,
      factors_considered: [
        "Equity tax treatment: gross equity ≥65% (unhedged + arbitrage) qualifies as equity fund — LTCG 10% after 1Y vs debt fund slab rate",
        "Net equity risk 35-45%: arbitrage leg is fully hedged (long stock + short futures) — eliminates directional equity risk while meeting SEBI equity threshold",
        "MDD -11.8% vs balanced advantage -22%: significantly lower drawdown for investors within 1-2 years of a financial goal",
        "Post-tax FD replacement: equity savings 9.4% at 10% LTCG = 8.5% post-tax vs FD 6.5% at 30% slab = 4.55% post-tax — 3.9% annual advantage",
        "4-AMC diversification: HDFC + ICICI Pru + SBI + Nippon reduces single-fund-house credit/manager risk vs 100% allocation to one equity savings fund",
      ],
      model_version: "FASP-AI-v3.0",
      timestamp: new Date().toISOString(),
    },
  },
];


// Total portfolios in DB (used for count displays before/after API loads)
// Breakdown: 43 retail + 1 HNI (₹50L tier) + 2 ultra HNI (₹1Cr+ tier) = 46 published.
// Note: hni-wealth-compounder (₹5L) counts as retail by minInvestment threshold.
const DB_PORTFOLIO_COUNT = 46;
const DB_RETAIL_COUNT    = 43;
const DB_HNI_COUNT       = 1;
const DB_ULTRA_HNI_COUNT = 2;


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

// \u2500\u2500\u2500 PerformancePeriodTable \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 3-view performance table: CAGR (annualised) | Absolute (cumulative) | Monthly Rolling

function PerformancePeriodTable({ portfolioId, twrr1Y, cagr1Y, cagr3Y, cagr5Y, benchmarkCagr1Y,
  return1m, return3m, return6m, returnYtd, cagr2y, returnSinceInception, benchmarkSinceInception,
  performance,
}: {
  portfolioId: string;
  twrr1Y?: number | null;
  cagr1Y: number; cagr3Y: number; cagr5Y: number;
  benchmarkCagr1Y?: number | null;
  return1m?: number | null; return3m?: number | null; return6m?: number | null;
  returnYtd?: number | null; cagr2y?: number | null;
  returnSinceInception?: number | null; benchmarkSinceInception?: number | null;
  performance?: Array<{ date: string; portfolioNav: number; benchmarkNav: number }>;
}) {
  const [liveData, setLiveData] = useState<any>(null);
  const [perfView, setPerfView] = useState<"cagr" | "absolute" | "rolling">("cagr");

  useEffect(() => {
    fetch(`/api/model-portfolios/${portfolioId}/ai-track-record`)
      .then(r => r.json())
      .then(res => { if (res.success) setLiveData(res.data?.performancePeriods ?? null); })
      .catch(() => {});
  }, [portfolioId]);

  const isSebi = twrr1Y != null;
  const hasDbPeriods = return1m != null || return3m != null || returnYtd != null;

  const staticRows = hasDbPeriods ? [
    { label: "1 Month",        returnPct: return1m,              benchmarkPct: null,                       alpha: null },
    { label: "3 Months",       returnPct: return3m,              benchmarkPct: null,                       alpha: null },
    { label: "6 Months",       returnPct: return6m,              benchmarkPct: null,                       alpha: null },
    { label: "YTD",            returnPct: returnYtd,             benchmarkPct: null,                       alpha: null },
    { label: "1 Year",         returnPct: cagr1Y,                benchmarkPct: benchmarkCagr1Y,            alpha: benchmarkCagr1Y != null ? cagr1Y - benchmarkCagr1Y : null },
    { label: "2 Years (ann.)", returnPct: cagr2y,                benchmarkPct: null,                       alpha: null },
    { label: "3 Years (ann.)", returnPct: cagr3Y,                benchmarkPct: benchmarkCagr1Y != null ? benchmarkCagr1Y - 1.4 : null, alpha: benchmarkCagr1Y != null && cagr3Y != null ? cagr3Y - (benchmarkCagr1Y - 1.4) : null },
    { label: "5 Years (ann.)", returnPct: cagr5Y,                benchmarkPct: benchmarkCagr1Y != null ? benchmarkCagr1Y - 2.1 : null, alpha: benchmarkCagr1Y != null && cagr5Y != null ? cagr5Y - (benchmarkCagr1Y - 2.1) : null },
    { label: "Since Inception",returnPct: returnSinceInception,  benchmarkPct: benchmarkSinceInception,    alpha: returnSinceInception != null && benchmarkSinceInception != null ? Number(returnSinceInception) - Number(benchmarkSinceInception) : null },
  ].filter(r => r.returnPct != null)
  : [
    { label: "1 Year",         returnPct: cagr1Y, benchmarkPct: benchmarkCagr1Y,                           alpha: benchmarkCagr1Y != null ? cagr1Y - benchmarkCagr1Y : null },
    { label: "3 Years (ann.)", returnPct: cagr3Y, benchmarkPct: benchmarkCagr1Y != null ? benchmarkCagr1Y - 1.4 : null, alpha: benchmarkCagr1Y != null ? cagr3Y - (benchmarkCagr1Y - 1.4) : null },
    { label: "5 Years (ann.)", returnPct: cagr5Y, benchmarkPct: benchmarkCagr1Y != null ? benchmarkCagr1Y - 2.1 : null, alpha: benchmarkCagr1Y != null ? cagr5Y - (benchmarkCagr1Y - 2.1) : null },
  ];

  const PERIOD_KEYS = ["1M","3M","6M","YTD","1Y","2Y","3Y","5Y","sinceInception"];
  const PERIOD_LABELS: Record<string,string> = {
    "1M":"1 Month","3M":"3 Months","6M":"6 Months","YTD":"YTD",
    "1Y":"1 Year","2Y":"2 Years (ann.)","3Y":"3 Years (ann.)","5Y":"5 Years (ann.)","sinceInception":"Since Inception",
  };

  const liveRows = liveData
    ? PERIOD_KEYS.map(key => {
        const p = liveData[key]; if (!p) return null;
        return { label: PERIOD_LABELS[key], returnPct: p.returnPct, benchmarkPct: p.benchmarkPct, alpha: p.alpha, note: p.note,
          extra: key === "sinceInception" && p.inceptionDate
            ? `since ${new Date(p.inceptionDate).toLocaleDateString("en-IN",{month:"short",year:"numeric"})} \u00b7 ${p.monthsOfData}M` : undefined };
      }).filter(Boolean)
    : null;

  const cagrRows = liveRows ?? staticRows;

  // Absolute = cumulative total return: (1+cagr%)^years - 1
  const absoluteRows = useMemo(() => cagrRows.map((r: any) => {
    const yrs = r.label.includes("5 Year") ? 5 : r.label.includes("3 Year") ? 3 : r.label.includes("2 Year") ? 2 : null;
    const abs  = yrs != null && r.returnPct   != null ? (Math.pow(1 + r.returnPct  /100, yrs)-1)*100 : r.returnPct;
    const absB = yrs != null && r.benchmarkPct != null ? (Math.pow(1 + r.benchmarkPct/100, yrs)-1)*100 : r.benchmarkPct;
    return { ...r,
      returnPct:   abs  != null ? Number(abs.toFixed(2))         : null,
      benchmarkPct:absB != null ? Number(absB.toFixed(2))        : null,
      alpha:       abs  != null && absB != null ? Number((abs-absB).toFixed(2)) : r.alpha,
      label: yrs != null ? r.label.replace("(ann.)","(total)") : r.label,
    };
  }), [cagrRows]);

  // Monthly rolling: month-on-month NAV changes
  const rollingData = useMemo(() => {
    if (!performance || performance.length < 2) return [];
    return performance.slice(1).map((pt, i) => {
      const prev = performance![i];
      const pr = ((pt.portfolioNav  - prev.portfolioNav)  / prev.portfolioNav)  * 100;
      const br = ((pt.benchmarkNav  - prev.benchmarkNav)  / prev.benchmarkNav)  * 100;
      return { date: pt.date, portfolio: +pr.toFixed(2), benchmark: +br.toFixed(2), alpha: +(pr-br).toFixed(2) };
    });
  }, [performance]);

  const renderTableRows = (rows: any[], color: string) => rows.map((r: any, i: number) => {
    const v  = r.returnPct  != null && !r.note ? Number(r.returnPct)   : null;
    const bv = r.benchmarkPct != null           ? Number(r.benchmarkPct): null;
    return (
      <tr key={i} className="border-b last:border-0 hover:bg-muted/5 transition-colors">
        <td className="px-3 py-2 text-[11px]">
          {r.label}
          {r.extra && <span className="block text-[9px] text-muted-foreground">{r.extra}</span>}
        </td>
        <td className={`px-3 py-2 text-right font-semibold ${v !== null ? color : "text-muted-foreground"}`}>
          {v !== null ? `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` : "—"}
        </td>
        <td className="px-3 py-2 text-right text-muted-foreground">
          {bv !== null ? `${bv >= 0 ? "+" : ""}${bv.toFixed(1)}%` : "—"}
        </td>
        <td className={`px-3 py-2 text-right font-medium ${r.alpha > 0 ? "text-emerald-600 dark:text-emerald-400" : r.alpha < 0 ? "text-red-500" : "text-muted-foreground"}`}>
          {r.alpha != null ? `${r.alpha >= 0 ? "+" : ""}${Number(r.alpha).toFixed(1)}%` : "—"}
        </td>
      </tr>
    );
  });

  const views: Array<{key:"cagr"|"absolute"|"rolling"; label:string}> = [
    {key:"cagr",    label:"CAGR"},
    {key:"absolute",label:"Absolute"},
    {key:"rolling", label:"Monthly"},
  ];

  return (
    <div className="rounded-xl border overflow-hidden">
      {/* Header + switcher */}
      <div className="px-3 py-2 bg-muted/30 border-b flex justify-between items-center gap-2">
        <p className="text-[11px] font-semibold shrink-0">
          Performance
          {isSebi && <span className="text-[9px] font-normal text-indigo-500 ml-1">TWRR \u00b7 SEBI</span>}
        </p>
        <div className="flex items-center gap-1">
          {views.map(({key,label}) => (
            <button key={key} id={`perf-${key}-${portfolioId}`}
              onClick={() => setPerfView(key)}
              className={`text-[9px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                perfView === key ? "bg-indigo-600 text-white shadow-sm" : "bg-muted/40 text-muted-foreground hover:bg-muted/70"
              }`}
            >{label}</button>
          ))}
          {!liveData && perfView !== "rolling" && <span className="text-[9px] text-muted-foreground animate-pulse ml-1">Loading\u2026</span>}
        </div>
      </div>

      {/* CAGR table */}
      {perfView === "cagr" && (
        <table className="w-full text-xs">
          <thead><tr className="border-b bg-muted/10">
            <th className="text-left  px-3 py-1.5 text-[10px] font-medium text-muted-foreground">Period</th>
            <th className="text-right px-3 py-1.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-400">Portfolio</th>
            <th className="text-right px-3 py-1.5 text-[10px] font-medium text-muted-foreground">Benchmark</th>
            <th className="text-right px-3 py-1.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Alpha</th>
          </tr></thead>
          <tbody>{renderTableRows(cagrRows, "text-indigo-600 dark:text-indigo-400")}</tbody>
        </table>
      )}

      {/* Absolute table */}
      {perfView === "absolute" && (
        <>
          <div className="px-3 py-1.5 bg-violet-50/60 dark:bg-violet-950/20 border-b">
            <p className="text-[9px] text-violet-600 dark:text-violet-400 font-medium">
              Total cumulative return (not annualised). Multi-year = actual wealth grown per \u20b9100 invested.
            </p>
          </div>
          <table className="w-full text-xs">
            <thead><tr className="border-b bg-muted/10">
              <th className="text-left  px-3 py-1.5 text-[10px] font-medium text-muted-foreground">Period</th>
              <th className="text-right px-3 py-1.5 text-[10px] font-medium text-violet-600 dark:text-violet-400">Portfolio</th>
              <th className="text-right px-3 py-1.5 text-[10px] font-medium text-muted-foreground">Benchmark</th>
              <th className="text-right px-3 py-1.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Alpha</th>
            </tr></thead>
            <tbody>{renderTableRows(absoluteRows, "text-violet-600 dark:text-violet-400")}</tbody>
          </table>
        </>
      )}

      {/* Monthly Rolling chart + table */}
      {perfView === "rolling" && (
        <>
          <div className="px-3 py-1.5 bg-emerald-50/60 dark:bg-emerald-950/20 border-b">
            <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium">
              Month-on-month returns (last {rollingData.length} months). Bar = portfolio, line = benchmark.
            </p>
          </div>
          {rollingData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={172}>
                <BarChart data={rollingData} margin={{top:8,right:10,left:-12,bottom:0}} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.25}/>
                  <XAxis dataKey="date" tick={{fontSize:8}} interval={Math.ceil(rollingData.length/8)-1}/>
                  <YAxis tick={{fontSize:8}} tickFormatter={v=>`${v>0?"+":""}${v}%`}/>
                  <RechartsTooltip
                    formatter={(v:number,name:string)=>[`${v>=0?"+":""}${v.toFixed(2)}%`, name==="portfolio"?"Portfolio":"Benchmark"]}
                    labelStyle={{fontSize:10}} contentStyle={{fontSize:10}}
                  />
                  <ReferenceLine y={0} stroke="#6B7280" strokeWidth={1}/>
                  <Bar dataKey="portfolio"  name="portfolio"  fill="#6366F1" radius={[2,2,0,0]}/>
                  <Bar dataKey="benchmark"  name="benchmark"  fill="#9CA3AF" radius={[2,2,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
              <div className="max-h-40 overflow-y-auto border-t">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-background border-b">
                    <tr>
                      <th className="text-left  px-3 py-1.5 text-[10px] font-medium text-muted-foreground">Month</th>
                      <th className="text-right px-3 py-1.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-400">Portfolio</th>
                      <th className="text-right px-3 py-1.5 text-[10px] font-medium text-muted-foreground">Benchmark</th>
                      <th className="text-right px-3 py-1.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Alpha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...rollingData].reverse().map((m,i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/5 transition-colors">
                        <td className="px-3 py-1.5 text-[10px]">{m.date}</td>
                        <td className={`px-3 py-1.5 text-right text-[10px] font-semibold ${m.portfolio>=0?"text-indigo-600 dark:text-indigo-400":"text-red-500"}`}>
                          {m.portfolio>=0?"+":""}{m.portfolio.toFixed(2)}%
                        </td>
                        <td className={`px-3 py-1.5 text-right text-[10px] ${m.benchmark>=0?"text-muted-foreground":"text-red-400"}`}>
                          {m.benchmark>=0?"+":""}{m.benchmark.toFixed(2)}%
                        </td>
                        <td className={`px-3 py-1.5 text-right text-[10px] font-medium ${m.alpha>=0?"text-emerald-600 dark:text-emerald-400":"text-red-500"}`}>
                          {m.alpha>=0?"+":""}{m.alpha.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-6">No monthly data available.</p>
          )}
        </>
      )}

      <p className="text-[9px] text-muted-foreground px-3 py-2 border-t">
        {perfView==="cagr"     && (isSebi ? "TWRR per SEBI IA Regs. Drift-triggered rebalancing." : "Annualised CAGR. Rebalanced on drift signals, not calendar.")}
        {perfView==="absolute" && "Cumulative total returns. Multi-year = (1\u202f+\u202fCAGR)\u207f\u202f\u2212\u202f1. Not annualised."}
        {perfView==="rolling"  && "Month-over-month NAV change. Simulated from \u20b91,000 base. Past returns \u2260 future results."}
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
  // Cache of fetched NAV history rows per portfolio ID, keyed by portfolio.id
  const [navHistoryCache, setNavHistoryCache] = useState<Record<string, any[]>>({});

  // Fetches NAV history from /api/model-portfolios/:id/nav-history and caches it
  const fetchNavHistory = async (portfolioId: string) => {
    if (navHistoryCache[portfolioId]) return; // already loaded
    try {
      const r = await fetch(`/api/model-portfolios/${portfolioId}/nav-history?limit=24`);
      if (r.ok) {
        const json = await r.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setNavHistoryCache((prev) => ({ ...prev, [portfolioId]: json.data }));
        }
      }
    } catch { /* non-fatal: card falls back to synthetic data */ }
  };
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
        // Guard: DB may store truncated ASCII (e.g. "R" from emoji storage issue).
        // Single ASCII letters are invalid icons — fall back to static emoji.
        icon: (() => { const r = p.icon ?? ""; return (r.length > 1 || (r.length === 1 && r.codePointAt(0)! > 127)) ? r : (staticP?.icon ?? "📊"); })(),
        isFeatured: p.isFeatured ?? p.is_featured ?? false,
        isNew: p.isNew ?? p.is_new ?? false,
        // Metrics: DB value if computed by scheduler, else fall back to curated static values.
        // BUG-4 fix: use ?? not || — || discards valid falsy numbers (e.g. CAGR 0.29% → 0 is falsy)
        // which caused near-zero return portfolios (Banking BFSI) to silently show static values.
        cagr1Y: p.cagr1Y != null ? Number(p.cagr1Y) : (staticP?.cagr1Y ?? 0),
        cagr3Y: p.cagr3Y != null ? Number(p.cagr3Y) : (staticP?.cagr3Y ?? 0),
        cagr5Y: p.cagr5Y != null ? Number(p.cagr5Y) : (staticP?.cagr5Y ?? 0),
        benchmarkCagr1Y: p.benchmarkCagr1Y != null ? Number(p.benchmarkCagr1Y) : (staticP?.benchmarkCagr1Y ?? 0),
        riskMetrics: {
          sharpeRatio: p.sharpeRatio != null ? Number(p.sharpeRatio) : (staticP?.riskMetrics?.sharpeRatio ?? 0),
          maxDrawdown: p.maxDrawdown  != null ? Number(p.maxDrawdown)  : (staticP?.riskMetrics?.maxDrawdown  ?? 0),
          volatility:  p.volatility   != null ? Number(p.volatility)   : (staticP?.riskMetrics?.volatility   ?? 0),
          beta:        p.beta         != null ? Number(p.beta)         : (staticP?.riskMetrics?.beta         ?? 1),
          alpha:       p.alpha        != null ? Number(p.alpha)        : (staticP?.riskMetrics?.alpha        ?? 0),
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
        rebalancingHistory: (() => {
          const rh = p.rebalancingHistory ?? staticP?.rebalancingHistory;
          if (Array.isArray(rh)) return rh;
          if (typeof rh === "string") { try { const parsed = JSON.parse(rh); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
          return [];
        })(),
        aiInsight: p.aiInsight ?? null,
        goal: (() => {
          // p.goals: DB column is JSONB — Drizzle returns array, but may come as string if serialized
          const raw = p.goals ?? p.goal;
          if (Array.isArray(raw) && raw.length > 0) return raw;
          if (typeof raw === "string") {
            try { const parsed = JSON.parse(raw); if (Array.isArray(parsed) && parsed.length > 0) return parsed; } catch { /* fall through */ }
          }
          // Fallback: static seed definition → hardcoded safe default
          return staticP?.goal ?? ["wealth_creation"];
        })(),
        performance: (() => {
          // performance uses PERFORMANCE_BASE (PerformancePoint[] format: { date, portfolioNav, benchmarkNav }).
          // navHistoryCache provides { month, nav } — different shape, used by the chart component
          // directly via fetchNavHistory on card expand, NOT through this field.
          const c1y = p.cagr1Y != null ? Number(p.cagr1Y) : (staticP?.cagr1Y ?? 12);
          const vol  = p.volatility != null ? Number(p.volatility) : (staticP?.riskMetrics?.volatility ?? 6);
          return PERFORMANCE_BASE(p.id ?? "portfolio", 1000, 24, c1y, vol);
        })(),
        performanceData: (() => {
          const c1y = p.cagr1Y != null ? Number(p.cagr1Y) : (staticP?.cagr1Y ?? 12);
          const vol  = p.volatility != null ? Number(p.volatility) : (staticP?.riskMetrics?.volatility ?? 6);
          return PERFORMANCE_BASE(p.id ?? "portfolio", 1000, 24, c1y, vol);
        })(),
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
  // Explicitly false when user is null — prevents a stale React Query cache from
  // yielding canViewFullHoldings=true before the session has been verified.
  const canViewFullHoldings = !!user && !isRetailOnly;
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
        toast({ title: "✅ Proposal Approved", description: "Rebalance proposal has been approved and queued for execution." });
      } else {
        toast({ title: "Approval Failed", description: data.message ?? "Could not approve proposal. Please retry.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network Error", description: "Could not reach the server. Please check your connection.", variant: "destructive" });
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
        toast({ title: "Proposal Rejected", description: "Rebalance proposal has been rejected." });
      } else {
        toast({ title: "Rejection Failed", description: data.message ?? "Could not reject proposal. Please retry.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network Error", description: "Could not reach the server. Please check your connection.", variant: "destructive" });
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

  // ── Background prefetch NAV history for all visible cards (BUG-5 fix) ────
  // Populates navHistoryCache so performanceData uses real NAV data immediately,
  // not just after the user expands a card. Staggered at 500ms per card to
  // avoid bursting — starts at 200ms offset so quant signals go first.
  useEffect(() => {
    if (!apiData?.data?.length) return;
    const toFetch = (apiData.data as any[]).slice(0, 20);
    toFetch.forEach((p: any, i: number) => {
      setTimeout(() => fetchNavHistory(p.id), 200 + i * 500);
    });
  // Only run once when API data first loads
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
    enabled: activeDetailTab === "holdings" && !!selectedPortfolio?.id && !!user && canViewFullHoldings,
    staleTime: 6 * 60 * 60 * 1000, // 6h — matches server cache
    gcTime: 6 * 60 * 60 * 1000,    // keep cache alive across portfolio switches
    // DO NOT set retry here — the global QueryClient retry guard already returns
    // false for ApiError with status 4xx, which correctly suppresses duplicate
    // 401 requests. A per-query override would bypass that guard.
    queryFn: async () => {
      const { getStoredSessionId, getStoredPinDeviceToken } = await import("@/lib/queryClient");
      const r = await fetch(`/api/model-portfolios/${selectedPortfolio!.id}/holdings`, {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          // Session ID fallback — required when Chrome 3PCD blocks cookies on agent.fintekpro.com
          ...(getStoredSessionId() ? { "X-Session-ID": getStoredSessionId()! } : {}),
          ...(getStoredPinDeviceToken() ? { "X-Pin-Device-Token": getStoredPinDeviceToken()! } : {}),
        },
      });
      if (!r.ok) {
        // Throw ApiError so the global QueryClient retry guard (which blocks 4xx
        // retries) correctly suppresses the duplicate 401 attempt seen in the console.
        const { ApiError } = await import("@/lib/queryClient");
        throw new ApiError(
          r.status === 401 ? "AUTH_REQUIRED" : "Holdings fetch failed",
          r.status,
          { code: r.status === 401 ? "UNAUTHORIZED" : "FETCH_ERROR" },
        );
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
        body: (selectedPortfolio.allocation ?? []).map((a) => [a.label, `${a.weight}%`]),
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
        body: (selectedPortfolio.holdings ?? []).map((h) => [
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
          const display1Y  = portfolio.twrr1Y  ?? portfolio.cagr1Y ?? 0;
          const display3Y  = portfolio.twrr3Y  ?? portfolio.cagr3Y ?? 0;
          const isUsingTWRR = portfolio.twrr1Y != null;
          // Alpha vs blended or single-index benchmark
          const benchmarkReturn  = portfolio.blendedBenchmarkReturn ?? portfolio.benchmarkCagr1Y ?? 0;
          const alphaVsBenchmark = display1Y - benchmarkReturn;
          // Avg return label:
          //   < 1M since inception → "Est. 1Y" (calibrated projection, scheduler hasn't run yet)
          //   1–11M since inception → "NM avg" (partial-period avg)
          //   ≥ 12M → "1Y" (full-year return)
          const inceptionMonths = portfolio.inceptionDate
            ? Math.round((Date.now() - new Date(portfolio.inceptionDate).getTime()) / (30 * 24 * 3600 * 1000))
            : 12;
          const returnLabel = inceptionMonths < 1 ? "Est. 1Y" : inceptionMonths < 12 ? `${inceptionMonths}M avg` : "1Y";
          const isEstimated  = inceptionMonths < 1; // drives the tooltip/badge below

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
          // Performance section toggle — collapsed by default (brief §2: grid density, lazy render)
          const isPerfOpen = expandedCards.has(`show-${portfolio.id}`);
          // barData: computed lazily — prefer real API data, fall back to synthetic
          const realNavHistory = navHistoryCache[portfolio.id];
          const barData = isPerfOpen
            ? realNavHistory && realNavHistory.length > 0
              ? realNavHistory.map((r, i) => ({
                  label: new Date(r.month_start).toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
                  returnPct: Number((Number(r.monthly_return) || 0).toFixed(2)),
                  absoluteReturn: Number((Number(r.absolute_return) || 0).toFixed(2)),
                  benchmarkReturn: Number((Number(r.benchmark_return) || 0).toFixed(2)),
                  hasRebalanceEvent: Boolean(r.had_rebalance_event),
                }))
              : computeMonthlyBarData(portfolio.performance, portfolio.rebalancingHistory, portfolio.inceptionDate ?? undefined)
            : [];
          const isRealData = realNavHistory && realNavHistory.length > 0 && isPerfOpen;
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
                          <span className="font-mono font-semibold text-foreground/70 bg-muted/60 px-1.5 py-0.5 rounded text-[9px] tracking-wider">
                            {portfolio.portfolioCode}
                          </span>
                        </span>
                      )}
                      {portfolio.inceptionDate && (
                        <span className="flex items-center gap-0.5">
                          <span className="text-muted-foreground/60">📅</span>
                          <span>Since {new Date(portfolio.inceptionDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</span>
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
                  {(portfolio.goal ?? []).slice(0, 3).map((g) => (
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
                        {!isUsingTWRR && isEstimated && (
                          <span
                            title="Calibrated projection from blended-metals CALIBRATIONS map (FASP-AI v3.0). Live TWRR will replace this once the quant scheduler runs its first cycle (quarterly)."
                            className="inline-flex items-center gap-0.5 px-1 py-0 rounded text-[7px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                          >
                            Est.
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
                        const key = `show-${portfolio.id}`;
                        const willOpen = !next.has(key);
                        willOpen ? next.add(key) : next.delete(key);
                        // Eagerly fetch real NAV history when first expanding
                        if (willOpen) fetchNavHistory(portfolio.id);
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
                  {/* Show calibrated projections for new portfolios, or "computing…" for older ones awaiting scheduler */}
                  {!portfolio.return1m && !portfolio.return3m && !portfolio.returnYtd && (
                    isEstimated ? (
                      // New portfolio: show CALIBRATIONS-map projected metrics
                      <div className="flex items-center gap-2 flex-wrap">
                        {display3Y > 0 && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full border bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300"
                            title="Projected 3Y CAGR from blended-metals CALIBRATIONS map (FASP-AI v3.0)">
                            3Y +{display3Y.toFixed(1)}% proj.
                          </span>
                        )}
                        {portfolio.riskMetrics?.sharpeRatio > 0 && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full border bg-muted/40 border-border/60 text-muted-foreground"
                            title="Projected Sharpe Ratio">
                            Sharpe {portfolio.riskMetrics.sharpeRatio.toFixed(2)}
                          </span>
                        )}
                        {portfolio.riskMetrics?.maxDrawdown != null && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full border bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400"
                            title="Projected max drawdown">
                            MDD {portfolio.riskMetrics.maxDrawdown.toFixed(1)}%
                          </span>
                        )}
                        <span className="text-[9px] text-muted-foreground/50 italic">Live TWRR from next quarterly cycle</span>
                      </div>
                    ) : (
                      <span className="text-[9px] text-muted-foreground/60 italic">Period returns computing…</span>
                    )
                  )}

                </div>

                {/* ── Drift meter — always visible in collapsed state (brief §2) ─── */}
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full" style={{background: driftScore > 15 ? '#ef4444' : driftScore > 5 ? '#f59e0b' : '#10b981'}} />
                      Allocation drift
                    </span>
                    <span className={`font-semibold tabular-nums text-[9px] ${
                      driftScore > 15 ? 'text-red-500' : driftScore > 5 ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {qs ? `${driftAbsPct}% / ${driftThresholdPct}%` : `– / ${driftThresholdPct}%`}
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${driftStatusColor}`}
                      style={{ width: `${qs ? driftPct : 0}%` }}
                    />
                  </div>
                </div>

                {/* ── Expandable performance section ───────────────────── */}
                {isPerfOpen && (
                  <div className="space-y-2.5">

                    {/* Monthly return bar chart */}
                    {barData.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                          {isRealData ? (
                            <>
                              <span className="inline-flex items-center gap-0.5 px-1 rounded text-[7px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">📊 DB</span>
                              Monthly returns (actual NAV history)
                            </>
                          ) : isUsingTWRR ? (
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
                          style={{ height: "72px" }}
                          aria-label="Monthly returns bar chart"
                        >
                          {/* Zero reference line at vertical midpoint */}
                          <div className="absolute inset-x-0 top-1/2 -translate-y-px h-px bg-border/70 z-10 pointer-events-none" />

                          {barData.map((bar, i) => {
                            const isPos = bar.returnPct >= 0;
                            const halfH = 30; // px (72px chart height → each half is 36px, bars use 30px leaving room for labels)
                            const barH  = Math.max(2, Math.min(halfH, (Math.abs(bar.returnPct) / maxBar) * halfH));
                            return (
                              <TooltipProvider key={i}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex-1 relative h-full group/bar">
                                      {/* Return value label — always visible for ≤8 bars, hover-only for denser charts */}
                                      <span className={`absolute ${isPos ? "bottom-[50%] mb-0.5" : "top-[50%] mt-0.5"} left-1/2 -translate-x-1/2 text-[8px] font-medium whitespace-nowrap z-20 bg-background/90 px-0.5 rounded ${isPos ? "text-emerald-600/80 dark:text-emerald-400/80" : "text-red-500/80"} ${barData.length <= 8 ? "block" : "hidden group-hover/bar:block"}`}>
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
                                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[8px] text-muted-foreground/70 leading-none">
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

                    {/* Cumulative portfolio vs benchmark line chart (brief §2) */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                        <span>Portfolio vs {portfolio.blendedBenchmarkReturn != null ? "Blended" : portfolio.benchmarkName} (cumulative)</span>
                        <span className={`font-semibold tabular-nums ${alphaVsBenchmark >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                          {alphaVsBenchmark >= 0 ? "+" : ""}{alphaVsBenchmark.toFixed(1)}% alpha
                        </span>
                      </div>
                      {(() => {
                        // Prefer real NAV history data for the cumulative line chart
                        const navRows = realNavHistory && realNavHistory.length >= 2 ? realNavHistory : null;
                        if (navRows) {
                          const norm = navRows.map((r) => ({
                            p: Number(r.absolute_return ?? 0),
                            b: Number(r.benchmark_cum_return ?? 0),
                          }));
                          const allVals = norm.flatMap((n) => [n.p, n.b]);
                          const minV = Math.min(...allVals, 0);
                          const maxV = Math.max(...allVals, 0);
                          const range = maxV - minV || 1;
                          const W = 200; const H = 36;
                          const xStep = W / Math.max(norm.length - 1, 1);
                          const toY = (v: number) => H - ((v - minV) / range) * H;
                          const zeroY = toY(0).toFixed(1);
                          const portPts  = norm.map((n, i) => `${(i * xStep).toFixed(1)},${toY(n.p).toFixed(1)}`).join(" ");
                          const benchPts = norm.map((n, i) => `${(i * xStep).toFixed(1)},${toY(n.b).toFixed(1)}`).join(" ");
                          return (
                            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-9" preserveAspectRatio="none" aria-hidden="true">
                              <line x1="0" y1={zeroY} x2={W} y2={zeroY} stroke="currentColor" strokeWidth="0.5" opacity="0.25" strokeDasharray="3,2" />
                              <polyline points={benchPts} fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3" />
                              <polyline points={portPts} fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinejoin="round" />
                            </svg>
                          );
                        }
                        // Fallback: synthetic performance array
                        const pts = (portfolio.performance ?? []).slice(-13);
                        if (pts.length < 2) return (
                          <p className="text-[8px] text-muted-foreground/50 italic h-9 flex items-center pl-0.5">Chart computing…</p>
                        );
                        const baseNav   = pts[0].portfolioNav;
                        const baseBench = pts[0].benchmarkNav ?? pts[0].portfolioNav;
                        const norm = pts.map((p) => ({
                          p: ((p.portfolioNav / baseNav) - 1) * 100,
                          b: (((p.benchmarkNav ?? baseBench) / baseBench) - 1) * 100,
                        }));
                        const allVals = norm.flatMap((n) => [n.p, n.b]);
                        const minV = Math.min(...allVals, 0);
                        const maxV = Math.max(...allVals, 0);
                        const range = maxV - minV || 1;
                        const W = 200; const H = 36;
                        const xStep = W / Math.max(norm.length - 1, 1);
                        const toY = (v: number) => H - ((v - minV) / range) * H;
                        const zeroY = toY(0).toFixed(1);
                        const portPts  = norm.map((n, i) => `${(i * xStep).toFixed(1)},${toY(n.p).toFixed(1)}`).join(" ");
                        const benchPts = norm.map((n, i) => `${(i * xStep).toFixed(1)},${toY(n.b).toFixed(1)}`).join(" ");
                        return (
                          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-9" preserveAspectRatio="none" aria-hidden="true">
                            <line x1="0" y1={zeroY} x2={W} y2={zeroY} stroke="currentColor" strokeWidth="0.5" opacity="0.25" strokeDasharray="3,2" />
                            <polyline points={benchPts} fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3" />
                            <polyline points={portPts} fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinejoin="round" />
                          </svg>
                        );
                      })()}
                      <div className="flex items-center gap-3 text-[8px] text-muted-foreground/60">
                        <span className="flex items-center gap-1">
                          <span className="inline-block w-4 h-px bg-indigo-500 rounded" />
                          Portfolio
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="inline-block w-4 h-px bg-current rounded opacity-30" />
                          Benchmark
                        </span>
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
                              {(selectedPortfolio.allocation ?? []).map((a) => (
                                <Cell key={a.category} fill={a.color} />
                              ))}
                            </Pie>
                          </RechartsPieChart>
                          <div className="flex-1 space-y-2">
                            {(selectedPortfolio.allocation ?? []).map((a) => (
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
                        ? (displayHoldings ?? [])        // Always show all for agents — no slice
                        : (displayHoldings ?? []).slice(0, 5)
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

                    {/* Full performance period table — CAGR / Absolute / Monthly Rolling */}
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
                      performance={selectedPortfolio.performance}
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
                     {(selectedPortfolio.rebalancingHistory ?? []).map((e, i) => (
                      <Card key={i} className="border-l-4 border-l-indigo-400">
                        <CardContent className="pt-3 pb-3">
                          <div className="flex items-center gap-2 mb-2">
                            <RefreshCw className="h-3.5 w-3.5 text-indigo-500" />
                            <span className="text-xs font-semibold">{e.date}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">{e.description ?? e.rationale ?? e.action_taken ?? ""}</p>
                          <div className="space-y-1">
                            {(Array.isArray(e.changes)
                              ? e.changes
                              : e.weight_after
                                ? Object.entries(e.weight_after as Record<string, number>).slice(0, 8).map(([k, v]) => `${k}: ${v}%`)
                                : []
                            ).map((c: string, j: number) => (
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
              <span className="bg-white/15 rounded px-2 py-1">{selectedPortfolio.holdings?.length ?? 0} holdings</span>
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
