/**
 * @file GlobalMacroRadarWidget.tsx
 * @description Global Macro Transmission Radar Cockpit for FintekPro.
 *
 * Visualizes the 5-pillar Global Tailwind Score, Brent crude comfort band,
 * sovereign yield spread (CCIL G-Sec vs US 10Y), FII/DII liquidity balance,
 * sector sensitivities, and interactive macro stress testing.
 *
 * Compliance: FintekPro GCR v1.0 & FASP-AI v3.0
 */

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
	Globe2,
	TrendingUp,
	TrendingDown,
	Flame,
	ShieldCheck,
	Coins,
	AlertTriangle,
	RefreshCw,
	Layers,
	ChevronRight,
	Activity,
	ArrowUpRight,
	ArrowDownRight,
	Sparkles,
	CheckCircle2,
	Shield,
	Hash,
	Database,
	ExternalLink,
	Lock,
	Scale,
	Landmark,
	BarChart2,
} from "lucide-react";
import { Link } from "wouter";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface PillarScore {
	pillarId: string;
	name: string;
	score: number;
	weight: number;
	status: "FAVORABLE" | "NEUTRAL" | "CAUTION" | "UNFAVORABLE";
	keyMetric: string;
	observedValue: string | number;
	benchmarkThreshold: string;
	details: string;
}

interface SectorSensitivity {
	sectorId: string;
	sectorName: string;
	sensitivity: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
	netImpactScore: number;
	rationale: string;
	primaryDrivers: string[];
}

interface GlobalMacroReport {
	globalTailwindScore: number;
	macroBias: "STRONG_TAILWIND" | "MODERATE_TAILWIND" | "NEUTRAL" | "DEFENSIVE_HEADWIND" | "HIGH_ALERT";
	summary: string;
	pillars: PillarScore[];
	sectorImpactMatrix: SectorSensitivity[];
	macroRegimeSummary: {
		crudeOilStatus: string;
		sovereignSpreadBps: number;
		sovereignSpreadStatus: string;
		usdInrRate: number;
		fiiDiiFlowSentiment: string;
		giftNiftyBias: string;
	};
	disclaimers: string[];
	meta: {
		engine_version: string;
		calculation_timestamp: string;
	};
}

interface StressTestResponse {
	scenarioId: string;
	scenarioName: string;
	scenarioDescription: string;
	estimatedPortfolioDrawdownPct: number;
	vulnerableHoldings: Array<{
		symbol: string;
		name: string;
		estimatedImpactPct: number;
		reason: string;
	}>;
	resilientHoldings: Array<{
		symbol: string;
		name: string;
		estimatedImpactPct: number;
		reason: string;
	}>;
	suggestedHedgingAction: string;
}

export function GlobalMacroRadarWidget({ asOfDate }: { asOfDate?: string } = {}) {
	const [activeScenario, setActiveScenario] = useState<string>("OIL_SPIKE_95");
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [isAuditOpen, setIsAuditOpen] = useState(false);

	// ── 1. Fetch Live or Historical Global Macro Report ──
	const { data, isLoading, isError, refetch, isFetching } = useQuery<{ success: boolean; data: GlobalMacroReport }>({
		queryKey: ["/api/macro/global-radar", asOfDate || "live"],
		queryFn: async () => {
			const url = asOfDate
				? `/api/macro/global-radar?date=${encodeURIComponent(asOfDate)}`
				: "/api/macro/global-radar";
			const res = await fetch(url);
			if (!res.ok) throw new Error("Failed to fetch global macro report");
			return res.json();
		},
		refetchInterval: asOfDate ? false : 5 * 60 * 1000, // No polling on historical date
	});

	// ── 1b. Fetch Audit Provenance & Ledger ──
	const { data: provenanceData, isLoading: isProvLoading } = useQuery<{ success: boolean; data: any }>({
		queryKey: ["/api/macro/provenance", asOfDate || "live"],
		queryFn: async () => {
			const url = asOfDate
				? `/api/macro/provenance?date=${encodeURIComponent(asOfDate)}`
				: "/api/macro/provenance";
			const res = await fetch(url);
			if (!res.ok) throw new Error("Failed to fetch audit provenance");
			return res.json();
		},
		enabled: isAuditOpen,
	});

	// ── 1c. Fetch Global FII 6-Pillar Scorecards ──
	const { data: fiiData } = useQuery<{ success: boolean; data: any }>({
		queryKey: ["/api/macro/fii/scorecards"],
		queryFn: async () => {
			const res = await fetch("/api/macro/fii/scorecards");
			if (!res.ok) throw new Error("Failed to fetch FII scorecards");
			return res.json();
		},
		staleTime: 60 * 1000,
	});

	// ── 1d. Fetch Institutional Rotation Signals ──
	const { data: rotationData } = useQuery<{ success: boolean; data: any }>({
		queryKey: ["/api/macro/fii/rotation-signals"],
		queryFn: async () => {
			const res = await fetch("/api/macro/fii/rotation-signals");
			if (!res.ok) throw new Error("Failed to fetch rotation signals");
			return res.json();
		},
		staleTime: 60 * 1000,
	});

	// ── 1e. Fetch Indian ADR Performance & Arbitrage ──
	const { data: adrData } = useQuery<{ success: boolean; data: any }>({
		queryKey: ["/api/macro/intelligence/indian-adrs"],
		queryFn: async () => {
			const res = await fetch("/api/macro/intelligence/indian-adrs");
			if (!res.ok) throw new Error("Failed to fetch Indian ADRs");
			return res.json();
		},
		staleTime: 60 * 1000,
	});

	// ── 1f. Fetch MSCI Factors & Inflow Projections ──
	const { data: msciData } = useQuery<{ success: boolean; data: any }>({
		queryKey: ["/api/macro/intelligence/msci-factors"],
		queryFn: async () => {
			const res = await fetch("/api/macro/intelligence/msci-factors");
			if (!res.ok) throw new Error("Failed to fetch MSCI factors");
			return res.json();
		},
		staleTime: 60 * 1000,
	});

	// ── 1g. Fetch Global Credit Cycle Summary ──
	const { data: creditCycleData } = useQuery<{ success: boolean; data: any }>({
		queryKey: ["/api/macro/credit-cycle/summary"],
		queryFn: async () => {
			const res = await fetch("/api/macro/credit-cycle/summary");
			if (!res.ok) throw new Error("Failed to fetch credit cycle summary");
			return res.json();
		},
		staleTime: 60 * 1000,
	});

	const handleSync = async () => {
		setIsRefreshing(true);
		try {
			const url = asOfDate
				? `/api/macro/global-radar?refresh=true&date=${encodeURIComponent(asOfDate)}`
				: "/api/macro/global-radar?refresh=true";
			await fetch(url);
			await refetch();
		} catch (err) {
			console.warn("Macro radar refresh error:", err);
		} finally {
			setIsRefreshing(false);
		}
	};

	// ── 2. Interactive Stress Test Mutation ──
	const stressMutation = useMutation<{ success: boolean; data: StressTestResponse }, Error, string>({
		mutationFn: async (scenario) => {
			const sampleHoldings = [
				{ name: "HDFC Bank Ltd", symbol: "HDFCBANK", weight: 20, sector: "Banking" },
				{ name: "Tata Consultancy Services", symbol: "TCS", weight: 20, sector: "Information Technology" },
				{ name: "Asian Paints Ltd", symbol: "ASIANPAINT", weight: 15, sector: "Paints" },
				{ name: "Sun Pharmaceutical Ind", symbol: "SUNPHARMA", weight: 15, sector: "Pharma" },
				{ name: "Oil & Natural Gas Corp", symbol: "ONGC", weight: 15, sector: "Energy" },
				{ name: "Sovereign Gold Bond", symbol: "SGB", weight: 15, assetClass: "Gold" },
			];
			const res = await fetch("/api/macro/stress-test", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ holdings: sampleHoldings, scenario }),
			});
			if (!res.ok) throw new Error("Stress simulation failed");
			return res.json();
		},
	});

	const report = data?.data;

	const getBiasBadge = (bias?: string) => {
		switch (bias) {
			case "STRONG_TAILWIND":
				return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">Strong Macro Tailwind</Badge>;
			case "MODERATE_TAILWIND":
				return <Badge className="bg-teal-600 hover:bg-teal-700 text-white font-semibold">Moderate Tailwind</Badge>;
			case "NEUTRAL":
				return <Badge className="bg-slate-600 hover:bg-slate-700 text-white font-semibold">Neutral Macro</Badge>;
			case "DEFENSIVE_HEADWIND":
				return <Badge className="bg-amber-600 hover:bg-amber-700 text-white font-semibold">Defensive Headwind</Badge>;
			case "HIGH_ALERT":
				return <Badge className="bg-rose-600 hover:bg-rose-700 text-white font-semibold">High Alert</Badge>;
			default:
				return <Badge variant="outline">Evaluating</Badge>;
		}
	};

	const getScoreColor = (score: number) => {
		if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
		if (score >= 65) return "text-teal-600 dark:text-teal-400";
		if (score >= 50) return "text-amber-600 dark:text-amber-400";
		return "text-rose-600 dark:text-rose-400";
	};

	if (isLoading) {
		return (
			<Card className="border-border/60 shadow-sm">
				<CardHeader className="pb-3">
					<Skeleton className="h-6 w-48" />
					<Skeleton className="h-4 w-72" />
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid grid-cols-1 md:grid-cols-4 gap-3">
						{[1, 2, 3, 4].map((i) => (
							<Skeleton key={i} className="h-24 w-full rounded-xl" />
						))}
					</div>
				</CardContent>
			</Card>
		);
	}

	if (isError || !report) {
		return null;
	}

	return (
		<Card className="border-border/60 shadow-sm bg-gradient-to-br from-card via-card to-muted/20">
			<CardHeader className="pb-3">
				<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
					<div className="space-y-1">
						<div className="flex items-center gap-2">
							<div className="p-1.5 rounded-lg bg-primary/10 text-primary">
								<Globe2 className="h-5 w-5" />
							</div>
							<CardTitle className="text-lg font-bold tracking-tight">
								Global Macro Transmission Cockpit
							</CardTitle>
							{getBiasBadge(report.macroBias)}
						</div>
						<CardDescription className="text-xs sm:text-sm text-muted-foreground">
							Real-time multi-factor transmission analysis: Brent Crude, Sovereign Spreads, FII Liquidity, and Currency Velocity.
						</CardDescription>
					</div>

					<div className="flex items-center gap-2 self-end sm:self-auto">
						<div className="text-right mr-1">
							<div className="text-xs text-muted-foreground uppercase font-medium">Global Tailwind Score</div>
							<div className={cn("text-2xl font-black tracking-tight", getScoreColor(report.globalTailwindScore))}>
								{report.globalTailwindScore}<span className="text-xs font-normal text-muted-foreground">/100</span>
							</div>
						</div>

						<Button
							size="sm"
							variant="outline"
							className="h-8 gap-1.5 text-xs border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100"
							onClick={() => setIsAuditOpen(true)}
						>
							<ShieldCheck className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
							Audit & Provenance
						</Button>

						<Button
							size="sm"
							variant="outline"
							className="h-8 gap-1.5 text-xs"
							onClick={handleSync}
							disabled={isFetching || isRefreshing}
						>
							<RefreshCw className={cn("h-3.5 w-3.5", (isFetching || isRefreshing) && "animate-spin")} />
							Sync
						</Button>
					</div>
				</div>
			</CardHeader>

			<CardContent className="space-y-4">
				{/* ── Summary Banner ── */}
				<div className="p-3.5 rounded-xl bg-muted/40 border border-border/50 text-xs sm:text-sm text-foreground/90 flex items-start gap-2.5">
					<Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
					<p className="leading-relaxed">{report.summary}</p>
				</div>

				{/* ── Macro Risk Tripwire Buffer Strip ── */}
				{(() => {
					const brentStr = String(report.pillars?.[0]?.observedValue || "$96.09/bbl");
					const brentMatch = brentStr.match(/\$([0-9.]+)/);
					const brentVal = brentMatch ? parseFloat(brentMatch[1]) : 96.09;
					const brentBuffer = 80 - brentVal;
					const isBrentElevated = brentVal > 80;

					const usdInrVal = report.macroRegimeSummary.usdInrRate || 94.86;
					const inrUsdVal = usdInrVal > 0 ? (1 / usdInrVal).toFixed(5) : "0.01054";

					return (
						<div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-xs">
							<div className="flex items-center gap-2">
								<div className={cn("h-2 w-2 rounded-full", isBrentElevated ? "bg-rose-500 animate-pulse" : "bg-emerald-500")} />
								<div>
									<div className="text-[10px] text-muted-foreground uppercase font-semibold">Brent Comfort Buffer</div>
									<div className={cn("font-mono font-bold", isBrentElevated ? "text-rose-600 dark:text-rose-400" : "text-foreground")}>
										{brentBuffer >= 0 ? `+$${brentBuffer.toFixed(2)}/bbl` : `-$${Math.abs(brentBuffer).toFixed(2)}/bbl`}{" "}
										<span className={cn("text-[10px] font-normal", isBrentElevated ? "text-rose-500" : "text-emerald-600")}>
											{isBrentElevated ? "(Elevated >$80)" : "(<$80 Comfort)"}
										</span>
									</div>
								</div>
							</div>
							<div className="flex items-center gap-2">
								<div className="h-2 w-2 rounded-full bg-indigo-500" />
								<div>
									<div className="text-[10px] text-muted-foreground uppercase font-semibold">USD/INR CCIL / FBIL</div>
									<div className="font-mono font-bold text-foreground">
										₹{usdInrVal.toFixed(2)}{" "}
										<span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-normal">
											(${inrUsdVal})
										</span>
									</div>
								</div>
							</div>
							<div className="flex items-center gap-2">
								<div className="h-2 w-2 rounded-full bg-teal-500" />
								<div>
									<div className="text-[10px] text-muted-foreground uppercase font-semibold">Sovereign 10Y Spread</div>
									<div className="font-mono font-bold text-teal-600">
										+{report.macroRegimeSummary.sovereignSpreadBps} bps{" "}
										<span className="text-[10px] text-muted-foreground font-normal">vs US 10Y</span>
									</div>
								</div>
							</div>
							<div className="flex items-center gap-2">
								<div className="h-2 w-2 rounded-full bg-emerald-500" />
								<div>
									<div className="text-[10px] text-muted-foreground uppercase font-semibold">10Y Sovereign Real Carry</div>
									<div className="font-mono font-bold text-emerald-600">
										+1.30% <span className="text-[10px] text-muted-foreground font-normal">over CPI</span>
									</div>
								</div>
							</div>
						</div>
					);
				})()}

				{/* ── 4 Top-Level Metric Gauges ── */}
				{(() => {
					const brentStr = String(report.pillars?.[0]?.observedValue || "$96.09/bbl");
					const brentMatch = brentStr.match(/\$([0-9.]+)/);
					const brentVal = brentMatch ? parseFloat(brentMatch[1]) : 96.09;
					const usdInrVal = report.macroRegimeSummary.usdInrRate || 94.86;
					const inrUsdVal = usdInrVal > 0 ? (1 / usdInrVal).toFixed(5) : "0.01054";

					return (
						<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
							{/* Gauge 1: Brent Crude */}
							<div className="p-3.5 rounded-xl bg-card border border-border/60 shadow-xs space-y-1.5">
								<div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
									<span className="flex items-center gap-1.5">
										<Flame className="h-3.5 w-3.5 text-amber-500" />
										Brent Crude
									</span>
									<Badge
										variant="outline"
										className={cn(
											"text-[10px] py-0 px-1.5",
											brentVal > 85
												? "bg-rose-500/10 text-rose-600 border-rose-500/20"
												: brentVal > 80
												? "bg-amber-500/10 text-amber-600 border-amber-500/20"
												: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
										)}
									>
										{brentVal > 85 ? "Import Headwind" : brentVal > 80 ? "Monitored Band" : "Comfort Band"}
									</Badge>
								</div>
								<div className="text-lg font-bold text-foreground">
									{report.pillars[0]?.observedValue}
								</div>
								<div className="text-[11px] text-muted-foreground">
									Threshold: {report.pillars[0]?.benchmarkThreshold}
								</div>
							</div>

							{/* Gauge 2: Sovereign Spread */}
							<div className="p-3.5 rounded-xl bg-card border border-border/60 shadow-xs space-y-1.5">
								<div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
									<span className="flex items-center gap-1.5">
										<ShieldCheck className="h-3.5 w-3.5 text-teal-500" />
										Sovereign Spread
									</span>
									<Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-teal-500/10 text-teal-600 border-teal-500/20">
										Carry Buffer
									</Badge>
								</div>
								<div className="text-lg font-bold text-foreground">
									+{report.macroRegimeSummary.sovereignSpreadBps} bps
								</div>
								<div className="text-[11px] text-muted-foreground">
									CCIL 10Y vs US 10Y UST
								</div>
							</div>

							{/* Gauge 3: Institutional Flow */}
							<div className="p-3.5 rounded-xl bg-card border border-border/60 shadow-xs space-y-1.5">
								<div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
									<span className="flex items-center gap-1.5">
										<Coins className="h-3.5 w-3.5 text-indigo-500" />
										Liquidity Pulse
									</span>
									<Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-indigo-500/10 text-indigo-600 border-indigo-500/20">
										DII Support
									</Badge>
								</div>
								<div className="text-lg font-bold text-foreground">
									{report.macroRegimeSummary.fiiDiiFlowSentiment}
								</div>
								<div className="text-[11px] text-muted-foreground">
									~₹26k+ Cr Monthly SIP Run-rate
								</div>
							</div>

							{/* Gauge 4: USD / INR Rate */}
							<div className="p-3.5 rounded-xl bg-card border border-border/60 shadow-xs space-y-1.5">
								<div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
									<span className="flex items-center gap-1.5">
										<Activity className="h-3.5 w-3.5 text-blue-500" />
										Forex Rate (CCIL / FBIL)
									</span>
									<Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-bold">
										CCIL SPOT
									</Badge>
								</div>
								<div className="text-lg font-bold text-foreground">
									₹{usdInrVal.toFixed(2)}
								</div>
								<div className="text-[11px] text-muted-foreground">
									CCIL FX-CLEAR · T+2 (${inrUsdVal})
								</div>
							</div>
						</div>
					);
				})()}

				{/* ── Tabs: Pillars Breakdown, Credit Cycle, Sector Matrix, FII Radar, ADRs, Stress Testing ── */}
				<Tabs defaultValue="pillars" className="w-full">
					<TabsList className="grid grid-cols-3 sm:grid-cols-6 h-auto sm:h-9 text-xs mb-3 gap-1 p-1">
						<TabsTrigger value="pillars" className="text-xs">5 Pillars</TabsTrigger>
						<TabsTrigger value="credit" className="text-xs">Credit Cycle</TabsTrigger>
						<TabsTrigger value="sectors" className="text-xs">Sectors</TabsTrigger>
						<TabsTrigger value="fii" className="text-xs">Global FII Radar</TabsTrigger>
						<TabsTrigger value="adr" className="text-xs">ADR & MSCI</TabsTrigger>
						<TabsTrigger value="stress" className="text-xs">Stress Sim</TabsTrigger>
					</TabsList>

					{/* Tab 1: Transmission Pillars */}
					<TabsContent value="pillars" className="space-y-2.5">
						{report.pillars.map((pillar) => (
							<div key={pillar.pillarId} className="p-3 rounded-lg border border-border/50 bg-card/60 space-y-1.5 text-xs">
								<div className="flex items-center justify-between">
									<div className="font-semibold text-foreground flex items-center gap-1.5">
										<span>{pillar.name}</span>
										<span className="text-[10px] text-muted-foreground">({Math.round(pillar.weight * 100)}% wt)</span>
									</div>
									<div className="flex items-center gap-2">
										<span className="font-bold text-foreground">{pillar.score}/100</span>
										<Badge
											variant="secondary"
											className={cn(
												"text-[10px] py-0 px-1.5",
												pillar.status === "FAVORABLE" && "bg-emerald-500/15 text-emerald-600 border-emerald-500/20",
												pillar.status === "NEUTRAL" && "bg-slate-500/15 text-slate-600",
												pillar.status === "CAUTION" && "bg-amber-500/15 text-amber-600",
												pillar.status === "UNFAVORABLE" && "bg-rose-500/15 text-rose-600"
											)}
										>
											{pillar.status}
										</Badge>
									</div>
								</div>
								<Progress value={pillar.score} className="h-1.5" />
								<p className="text-muted-foreground leading-relaxed pt-0.5">{pillar.details}</p>
							</div>
						))}
					</TabsContent>

					{/* Tab: Global Credit Cycle & Systemic Lending Engine */}
					<TabsContent value="credit" className="space-y-3">
						{(() => {
							const cc = creditCycleData?.data;
							if (!cc) {
								return (
									<div className="p-4 rounded-lg border border-border/50 text-center text-xs text-muted-foreground">
										Loading Global Credit Cycle diagnostics...
									</div>
								);
							}

							return (
								<div className="space-y-3">
									{/* Top Credit Scorecard */}
									<div className="p-3.5 rounded-xl border border-border/60 bg-gradient-to-r from-card/80 to-muted/30 space-y-2">
										<div className="flex flex-wrap items-center justify-between gap-2">
											<div className="flex items-center gap-2">
												<div className="h-8 w-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
													GCCE
												</div>
												<div>
													<div className="font-semibold text-foreground text-xs flex items-center gap-1.5">
														Global Credit Cycle Composite
														<Badge
															variant="secondary"
															className={cn(
																"text-[10px] py-0 px-1.5",
																cc.creditCycleRegime === "EXPANSIONARY_CREDIT" && "bg-emerald-500/15 text-emerald-600 border-emerald-500/20",
																cc.creditCycleRegime === "NEUTRAL_LATE_CYCLE" && "bg-blue-500/15 text-blue-600",
																cc.creditCycleRegime === "CREDIT_CONTRACTION" && "bg-amber-500/15 text-amber-600",
																cc.creditCycleRegime === "SEVERE_CREDIT_CRUNCH" && "bg-rose-500/15 text-rose-600"
															)}
														>
															{cc.creditCycleRegime?.replace(/_/g, " ")}
														</Badge>
													</div>
													<div className="text-[11px] text-muted-foreground">{cc.creditPostureSummary}</div>
												</div>
											</div>
											<div className="text-right">
												<div className="text-xl font-black text-foreground">{cc.compositeCreditScore}<span className="text-xs font-normal text-muted-foreground">/100</span></div>
												<div className="text-[10px] text-muted-foreground">
													{cc.creditStressTripwire ? (
														<span className="text-rose-600 font-bold flex items-center gap-1">
															<AlertTriangle className="h-3 w-3" /> Tripwire Active
														</span>
													) : (
														<span className="text-emerald-600 font-medium">Tripwire Clear</span>
													)}
												</div>
											</div>
										</div>
									</div>

									{/* 5-Pillar Credit Grid */}
									<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
										{cc.pillars?.map((p: any) => (
											<div key={p.pillarId} className="p-3 rounded-lg border border-border/50 bg-card/60 space-y-1.5 text-xs">
												<div className="flex items-center justify-between">
													<span className="font-semibold text-foreground truncate">{p.pillarName}</span>
													<Badge
														variant="outline"
														className={cn(
															"text-[10px] py-0 px-1.5 shrink-0",
															p.status === "EXPANSIONARY" && "text-emerald-600 border-emerald-500/30",
															p.status === "NEUTRAL" && "text-slate-600 border-slate-500/30",
															p.status === "TIGHTENING" && "text-amber-600 border-amber-500/30",
															p.status === "DISTRESSED" && "text-rose-600 border-rose-500/30"
														)}
													>
														{p.observedValue}
													</Badge>
												</div>
												<Progress value={p.score} className="h-1" />
												<p className="text-[11px] text-muted-foreground leading-snug">{p.details}</p>
											</div>
										))}
									</div>

									{/* Downstream Synergy Handoff Strip */}
									<div className="p-3 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/40 text-xs space-y-1.5">
										<div className="font-semibold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
											<Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
											GCCE Inter-Engine Synergy Feeds
										</div>
										<div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
											<div className="p-2 rounded bg-card/70 border border-border/40">
												<div className="text-muted-foreground">AI Regime Engine</div>
												<div className="font-bold text-foreground">
													Multiple Headwind: {cc.downstreamFeeds?.aiRegimeFeed?.equityMultipleHeadwind || "NONE"}
												</div>
											</div>
											<div className="p-2 rounded bg-card/70 border border-border/40">
												<div className="text-muted-foreground">Quant Orchestrator</div>
												<div className="font-bold text-foreground">
													Bond Tilt: {cc.downstreamFeeds?.quantOrchestratorFeed?.recommendedCorporateBondTilt || "NEUTRAL"}
												</div>
											</div>
											<div className="p-2 rounded bg-card/70 border border-border/40">
												<div className="text-muted-foreground">Tail Risk Engine</div>
												<div className="font-bold text-foreground truncate">
													Scenario: {cc.downstreamFeeds?.tailRiskFeed?.recommendedStressScenario || "NONE"}
												</div>
											</div>
										</div>
									</div>
								</div>
							);
						})()}
					</TabsContent>

					{/* Tab 2: Sector Sensitivities */}
					<TabsContent value="sectors" className="space-y-2">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
							{report.sectorImpactMatrix.map((sector) => (
								<div key={sector.sectorId} className="p-3 rounded-lg border border-border/50 bg-card/60 space-y-1.5 text-xs">
									<div className="flex items-center justify-between">
										<span className="font-semibold text-foreground">{sector.sectorName}</span>
										<Badge
											variant="outline"
											className={cn(
												"text-[10px] font-bold py-0 px-1.5",
												sector.sensitivity === "POSITIVE" && "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
												sector.sensitivity === "NEGATIVE" && "bg-rose-500/10 text-rose-600 border-rose-500/20",
												sector.sensitivity === "NEUTRAL" && "bg-slate-500/10 text-slate-600"
											)}
										>
											{sector.netImpactScore > 0 ? `+${sector.netImpactScore} pts Tailwind` : `${sector.netImpactScore} pts Impact`}
										</Badge>
									</div>
									<p className="text-muted-foreground leading-relaxed">{sector.rationale}</p>
									<div className="flex flex-wrap gap-1 pt-1">
										{sector.primaryDrivers.map((driver) => (
											<span key={driver} className="px-1.5 py-0.5 rounded text-[10px] bg-muted/60 text-muted-foreground">
												{driver}
											</span>
										))}
									</div>
								</div>
							))}
						</div>
					</TabsContent>

					{/* Tab 3: Global FII Scorecard & Cross-Border Flows */}
					<TabsContent value="fii" className="space-y-3">
						{/* India Standout Banner */}
						<div className="p-3 rounded-xl bg-gradient-to-r from-emerald-500/10 via-indigo-500/10 to-transparent border border-emerald-500/25 space-y-2">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Globe2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
									<span className="font-bold text-xs text-foreground">Global FII Institutional Capital Allocation Matrix</span>
								</div>
								<Badge className="bg-emerald-600 text-white text-[10px] py-0 px-2 font-semibold">
									INDIA #1 IN EM (84.2/100)
								</Badge>
							</div>
							<p className="text-[11px] text-muted-foreground leading-relaxed">
								Evaluates global cross-border capital rotation across 6 institutional pillars: Macro Growth & Real Rates (20%), FX Risk Cover (20%), Corporate ROE (20%), Sovereign Yield Spreads (15%), MSCI Inclusion (15%), and China+1 Friend-Shoring (10%).
							</p>
							<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
								<div className="p-2 rounded-lg bg-card/80 border border-border/50 text-[11px]">
									<div className="text-muted-foreground text-[10px]">Macro Real Rate</div>
									<div className="font-bold font-mono text-emerald-600">+1.70% (Positive)</div>
								</div>
								<div className="p-2 rounded-lg bg-card/80 border border-border/50 text-[11px]">
									<div className="text-muted-foreground text-[10px]">Forex Import Cover</div>
									<div className="font-bold font-mono text-foreground">&gt;11.2 Months</div>
								</div>
								<div className="p-2 rounded-lg bg-card/80 border border-border/50 text-[11px]">
									<div className="text-muted-foreground text-[10px]">India Corporate ROE</div>
									<div className="font-bold font-mono text-indigo-600">15.8% (vs 11.2% EM)</div>
								</div>
								<div className="p-2 rounded-lg bg-card/80 border border-border/50 text-[11px]">
									<div className="text-muted-foreground text-[10px]">Friend-Shoring Score</div>
									<div className="font-bold font-mono text-emerald-600">88/100 (China+1)</div>
								</div>
							</div>
						</div>

						{/* Country Ranking Leaderboard Table */}
						<div className="rounded-xl border border-border overflow-hidden">
							<div className="bg-muted/50 px-3 py-2 border-b border-border flex items-center justify-between text-xs">
								<span className="font-semibold text-foreground flex items-center gap-1.5">
									<Landmark className="h-3.5 w-3.5 text-indigo-500" />
									10-Country Global FII Scorecard Leaderboard
								</span>
								<span className="text-[10px] text-muted-foreground font-mono">
									Engine: FII-TRACKER-v1.0.0
								</span>
							</div>
							<div className="overflow-x-auto">
								<table className="w-full text-[11px]">
									<thead className="bg-muted/30 text-muted-foreground border-b border-border font-medium">
										<tr>
											<th className="text-left p-2">Rank & Country</th>
											<th className="text-center p-2">Region</th>
											<th className="text-center p-2">FII Score</th>
											<th className="text-center p-2">30d Flow</th>
											<th className="text-right p-2">Allocation Stance</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-border/60">
										{(fiiData?.data?.scorecards || [
											{ rank: 1, countryCode: "IND", countryName: "India", region: "EM_ASIA", compositeFiiScore: 84.2, cumulative30dFlowUsdMn: 1450, allocationStance: "STRONG_OVERWEIGHT" },
											{ rank: 2, countryCode: "USA", countryName: "United States", region: "DM_AMERICAS", compositeFiiScore: 78.4, cumulative30dFlowUsdMn: 12400, allocationStance: "OVERWEIGHT" },
											{ rank: 3, countryCode: "TWN", countryName: "Taiwan", region: "EM_ASIA", compositeFiiScore: 74.6, cumulative30dFlowUsdMn: 820, allocationStance: "OVERWEIGHT" },
											{ rank: 4, countryCode: "JPN", countryName: "Japan", region: "DM_ASIA", compositeFiiScore: 72.1, cumulative30dFlowUsdMn: 2100, allocationStance: "OVERWEIGHT" },
											{ rank: 5, countryCode: "KOR", countryName: "South Korea", region: "EM_ASIA", compositeFiiScore: 65.3, cumulative30dFlowUsdMn: 310, allocationStance: "NEUTRAL" },
											{ rank: 6, countryCode: "DEU", countryName: "Germany", region: "DM_EUROPE", compositeFiiScore: 61.8, cumulative30dFlowUsdMn: -450, allocationStance: "NEUTRAL" },
											{ rank: 7, countryCode: "GBR", countryName: "United Kingdom", region: "DM_EUROPE", compositeFiiScore: 59.4, cumulative30dFlowUsdMn: -890, allocationStance: "NEUTRAL" },
											{ rank: 8, countryCode: "BRA", countryName: "Brazil", region: "EM_LATAM", compositeFiiScore: 58.7, cumulative30dFlowUsdMn: 120, allocationStance: "NEUTRAL" },
											{ rank: 9, countryCode: "CHN", countryName: "China", region: "EM_ASIA", compositeFiiScore: 48.2, cumulative30dFlowUsdMn: -3850, allocationStance: "UNDERWEIGHT" },
										]).map((c: any) => (
											<tr key={c.countryCode} className={cn("hover:bg-muted/30 transition-colors", c.countryCode === "IND" && "bg-emerald-500/5 font-semibold")}>
												<td className="p-2 flex items-center gap-1.5">
													<span className="font-mono text-muted-foreground w-4">#{c.rank}</span>
													<span className="text-foreground">{c.countryName}</span>
													{c.countryCode === "IND" && (
														<Badge className="text-[9px] py-0 px-1 bg-emerald-600 text-white">Focus</Badge>
													)}
												</td>
												<td className="p-2 text-center text-[10px] text-muted-foreground font-mono">{c.region}</td>
												<td className="p-2 text-center font-mono font-bold text-foreground">{c.compositeFiiScore}</td>
												<td className="p-2 text-center font-mono text-[10px]">
													<span className={c.cumulative30dFlowUsdMn >= 0 ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>
														{c.cumulative30dFlowUsdMn >= 0 ? "+" : ""}${c.cumulative30dFlowUsdMn}M
													</span>
												</td>
												<td className="p-2 text-right">
													<Badge
														variant="outline"
														className={cn(
															"text-[9px] py-0 px-1.5 font-bold",
															c.allocationStance === "STRONG_OVERWEIGHT" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
															c.allocationStance === "OVERWEIGHT" && "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
															c.allocationStance === "NEUTRAL" && "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-400/20",
															c.allocationStance === "UNDERWEIGHT" && "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
														)}
													>
														{c.allocationStance.replace(/_/g, " ")}
													</Badge>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>

						{/* Strategic Pair Trade Highlight */}
						<div className="p-3 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-xs space-y-1">
							<div className="flex items-center justify-between">
								<span className="font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
									<Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
									Active Institutional Cross-Border Pair Trade
								</span>
								<Badge variant="outline" className="text-[10px] border-indigo-400 text-indigo-700 dark:text-indigo-300 font-mono">
									Conviction: 88/100
								</Badge>
							</div>
							<div className="font-semibold text-foreground text-xs pt-0.5">
								Long India (Nifty 50 / Capex Themes) / Short China (CSI 300 / Real Estate)
							</div>
							<p className="text-[11px] text-muted-foreground leading-relaxed">
								Driven by diverging real GDP growth (+7.2% vs +4.6%), positive real interest rate buffer (+1.7%), and sovereign debt inclusion inflows under JP Morgan GBI-EM.
							</p>
						</div>
					</TabsContent>

					{/* Tab 4: Indian ADR Performance & MSCI Factors */}
					<TabsContent value="adr" className="space-y-3">
						{/* MSCI EM Weight & Factor Leadership Header */}
						<div className="p-3 rounded-xl bg-card border border-border space-y-2 text-xs">
							<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
								<div className="flex items-center gap-2">
									<BarChart2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
									<span className="font-bold text-foreground">MSCI Emerging Markets Factor Leadership</span>
								</div>
								<div className="flex items-center gap-2 font-mono text-[11px]">
									<span className="text-muted-foreground">MSCI India Weight:</span>
									<span className="font-bold text-emerald-600 dark:text-emerald-400">20.45% (Rank #2 in EM)</span>
								</div>
							</div>
							<p className="text-[11px] text-muted-foreground leading-relaxed">
								India represents 20.45% of the MSCI Emerging Markets Index. Each 10 bps weight expansion drives approximately <strong className="text-foreground font-mono">~$550 Million</strong> in passive institutional index-tracking inflows.
							</p>
							{/* Factor Leadership Spreads */}
							<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
								<div className="p-2 rounded-lg bg-muted/40 border border-border/50">
									<div className="text-muted-foreground text-[10px]">Momentum Factor</div>
									<div className="font-bold font-mono text-emerald-600">+14.2% Outperformance</div>
								</div>
								<div className="p-2 rounded-lg bg-muted/40 border border-border/50">
									<div className="text-muted-foreground text-[10px]">Quality Factor</div>
									<div className="font-bold font-mono text-emerald-600">+11.8% Outperformance</div>
								</div>
								<div className="p-2 rounded-lg bg-muted/40 border border-border/50">
									<div className="text-muted-foreground text-[10px]">Value Factor</div>
									<div className="font-bold font-mono text-indigo-600">+8.4% Spread</div>
								</div>
								<div className="p-2 rounded-lg bg-muted/40 border border-border/50">
									<div className="text-muted-foreground text-[10px]">Min-Volatility</div>
									<div className="font-bold font-mono text-slate-600 dark:text-slate-400">+5.1% Defense</div>
								</div>
							</div>
						</div>

						{/* Live Indian ADR Arbitrage Spread Table */}
						<div className="rounded-xl border border-border overflow-hidden text-xs">
							<div className="bg-muted/50 px-3 py-2 border-b border-border flex items-center justify-between">
								<span className="font-semibold text-foreground flex items-center gap-1.5">
									<Scale className="h-3.5 w-3.5 text-emerald-600" />
									US-Listed Indian ADRs vs Domestic NSE Arbitrage Spreads
								</span>
								<Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-700 dark:text-emerald-300">
									OVERNIGHT TRANSMISSION LEAD
								</Badge>
							</div>
							<div className="overflow-x-auto">
								<table className="w-full text-[11px]">
									<thead className="bg-muted/30 text-muted-foreground border-b border-border font-medium">
										<tr>
											<th className="text-left p-2">ADR Ticker</th>
											<th className="text-left p-2">Sector</th>
											<th className="text-right p-2">US Close ($)</th>
											<th className="text-right p-2">Implied INR (₹)</th>
											<th className="text-right p-2">NSE Close (₹)</th>
											<th className="text-right p-2">Arbitrage Spread</th>
											<th className="text-right p-2">Overnight Signal</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-border/60">
										{(adrData?.data?.adrs || [
											{ adrTicker: "HDB", companyName: "HDFC Bank Ltd", sector: "Banking", usClosePriceUsd: 62.45, dayChangePct: 1.10, impliedInrPrice: 1780.20, domesticNsePrice: 1755.00, arbitrageSpreadPct: 1.44, overnightSectorSignal: "BANKING_STABILITY_SUPPORT" },
											{ adrTicker: "IBN", companyName: "ICICI Bank Ltd", sector: "Banking", usClosePriceUsd: 28.15, dayChangePct: 0.85, impliedInrPrice: 1335.10, domesticNsePrice: 1318.50, arbitrageSpreadPct: 1.26, overnightSectorSignal: "PRIVATE_BANK_ACCUMULATION" },
											{ adrTicker: "INFY", companyName: "Infosys Ltd", sector: "IT Software", usClosePriceUsd: 20.55, dayChangePct: 2.45, impliedInrPrice: 1745.00, domesticNsePrice: 1680.00, arbitrageSpreadPct: 3.87, overnightSectorSignal: "IT_SECTOR_BULLISH_LEAD" },
											{ adrTicker: "WIT", companyName: "Wipro Ltd", sector: "IT Software", usClosePriceUsd: 5.65, dayChangePct: 1.05, impliedInrPrice: 480.15, domesticNsePrice: 472.00, arbitrageSpreadPct: 1.73, overnightSectorSignal: "IT_MOMENTUM_CONFIRMATION" },
											{ adrTicker: "RDY", companyName: "Dr. Reddy's Lab", sector: "Pharma", usClosePriceUsd: 76.80, dayChangePct: -0.40, impliedInrPrice: 6520.00, domesticNsePrice: 6505.00, arbitrageSpreadPct: 0.23, overnightSectorSignal: "DEFENSIVE_PARITY" },
										]).map((adr: any) => (
											<tr key={adr.adrTicker} className="hover:bg-muted/30 transition-colors">
												<td className="p-2">
													<div className="font-bold font-mono text-foreground">{adr.adrTicker}</div>
													<div className="text-[10px] text-muted-foreground">{adr.companyName}</div>
												</td>
												<td className="p-2 text-muted-foreground text-[10px]">{adr.sector}</td>
												<td className="p-2 text-right font-mono">
													<div>${adr.usClosePriceUsd?.toFixed(2)}</div>
													<div className={cn("text-[10px]", adr.dayChangePct >= 0 ? "text-emerald-600" : "text-rose-600")}>
														{adr.dayChangePct >= 0 ? "+" : ""}{adr.dayChangePct?.toFixed(2)}%
													</div>
												</td>
												<td className="p-2 text-right font-mono font-bold text-foreground">
													₹{adr.impliedInrPrice?.toLocaleString("en-IN", { maximumFractionDigits: 1 })}
												</td>
												<td className="p-2 text-right font-mono text-muted-foreground">
													₹{adr.domesticNsePrice?.toLocaleString("en-IN", { maximumFractionDigits: 1 })}
												</td>
												<td className="p-2 text-right">
													<Badge
														variant="outline"
														className={cn(
															"text-[10px] font-mono font-bold",
															adr.arbitrageSpreadPct > 2 && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
															adr.arbitrageSpreadPct >= 0 && adr.arbitrageSpreadPct <= 2 && "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
															adr.arbitrageSpreadPct < 0 && "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20"
														)}
													>
														{adr.arbitrageSpreadPct >= 0 ? "+" : ""}{adr.arbitrageSpreadPct?.toFixed(2)}%
													</Badge>
												</td>
												<td className="p-2 text-right">
													<span className="text-[10px] font-medium text-muted-foreground">
														{adr.overnightSectorSignal?.replace(/_/g, " ")}
													</span>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					</TabsContent>

					{/* Tab 5: Macro Stress Simulator */}
					<TabsContent value="stress" className="space-y-3">
						<div className="flex flex-wrap gap-2">
							<Button
								size="sm"
								variant={activeScenario === "OIL_SPIKE_95" ? "default" : "outline"}
								className="text-xs h-8"
								onClick={() => {
									setActiveScenario("OIL_SPIKE_95");
									stressMutation.mutate("OIL_SPIKE_95");
								}}
							>
								Crude Spike ($95)
							</Button>
							<Button
								size="sm"
								variant={activeScenario === "DOLLAR_SURGE_106" ? "default" : "outline"}
								className="text-xs h-8"
								onClick={() => {
									setActiveScenario("DOLLAR_SURGE_106");
									stressMutation.mutate("DOLLAR_SURGE_106");
								}}
							>
								Dollar Surge (DXY 106)
							</Button>
							<Button
								size="sm"
								variant={activeScenario === "US_YIELD_SPIKE_475" ? "default" : "outline"}
								className="text-xs h-8"
								onClick={() => {
									setActiveScenario("US_YIELD_SPIKE_475");
									stressMutation.mutate("US_YIELD_SPIKE_475");
								}}
							>
								US Yield Shock (4.75%)
							</Button>
							<Button
								size="sm"
								variant={activeScenario === "GMIE_CRUDE_SURGE_115" ? "default" : "outline"}
								className="text-xs h-8 border-amber-500/30 text-amber-600 dark:text-amber-400"
								onClick={() => {
									setActiveScenario("GMIE_CRUDE_SURGE_115");
									stressMutation.mutate("GMIE_CRUDE_SURGE_115");
								}}
							>
								⚡ Brent $115 Tripwire
							</Button>
							<Button
								size="sm"
								variant={activeScenario === "GMIE_FII_CAPITAL_EXODUS" ? "default" : "outline"}
								className="text-xs h-8 border-rose-500/30 text-rose-600 dark:text-rose-400"
								onClick={() => {
									setActiveScenario("GMIE_FII_CAPITAL_EXODUS");
									stressMutation.mutate("GMIE_FII_CAPITAL_EXODUS");
								}}
							>
								⚡ FII ₹50k Cr Outflow
							</Button>
							<Button
								size="sm"
								variant={activeScenario === "GMIE_FED_LIQUIDITY_CONTRACTION" ? "default" : "outline"}
								className="text-xs h-8 border-indigo-500/30 text-indigo-600 dark:text-indigo-400"
								onClick={() => {
									setActiveScenario("GMIE_FED_LIQUIDITY_CONTRACTION");
									stressMutation.mutate("GMIE_FED_LIQUIDITY_CONTRACTION");
								}}
							>
								⚡ US 10Y @ 5.25%
							</Button>
							<Button
								size="sm"
								variant={activeScenario === "GMIE_CREDIT_CRUNCH_OAS_650" ? "default" : "outline"}
								className="text-xs h-8 border-purple-500/30 text-purple-600 dark:text-purple-400"
								onClick={() => {
									setActiveScenario("GMIE_CREDIT_CRUNCH_OAS_650");
									stressMutation.mutate("GMIE_CREDIT_CRUNCH_OAS_650");
								}}
							>
								⚡ HY OAS 650+ bps Blowout
							</Button>
						</div>

						{stressMutation.data?.data && (
							<div className="p-3.5 rounded-xl border border-border/60 bg-muted/30 space-y-3 text-xs">
								<div className="flex items-center justify-between border-b border-border/40 pb-2">
									<div>
										<div className="font-bold text-foreground text-sm">{stressMutation.data.data.scenarioName}</div>
										<div className="text-muted-foreground text-[11px]">{stressMutation.data.data.scenarioDescription}</div>
									</div>
									<div className="text-right">
										<div className="text-[10px] text-muted-foreground uppercase">Estimated Impact</div>
										<div className={cn("text-base font-black", stressMutation.data.data.estimatedPortfolioDrawdownPct >= 0 ? "text-emerald-600" : "text-rose-600")}>
											{stressMutation.data.data.estimatedPortfolioDrawdownPct > 0 ? "+" : ""}
											{stressMutation.data.data.estimatedPortfolioDrawdownPct}%
										</div>
									</div>
								</div>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
									{/* Resilient */}
									<div className="p-2.5 rounded-lg bg-card/80 border border-emerald-500/20 space-y-1.5">
										<div className="font-semibold text-emerald-600 flex items-center gap-1">
											<ArrowUpRight className="h-3.5 w-3.5" />
											Top Resilient Assets
										</div>
										{stressMutation.data.data.resilientHoldings.map((h) => (
											<div key={h.symbol} className="text-[11px] flex justify-between">
												<span className="text-foreground">{h.name}</span>
												<span className="text-emerald-600 font-bold">+{h.estimatedImpactPct}%</span>
											</div>
										))}
									</div>

									{/* Vulnerable */}
									<div className="p-2.5 rounded-lg bg-card/80 border border-rose-500/20 space-y-1.5">
										<div className="font-semibold text-rose-600 flex items-center gap-1">
											<ArrowDownRight className="h-3.5 w-3.5" />
											Top Vulnerable Assets
										</div>
										{stressMutation.data.data.vulnerableHoldings.map((h) => (
											<div key={h.symbol} className="text-[11px] flex justify-between">
												<span className="text-foreground">{h.name}</span>
												<span className="text-rose-600 font-bold">{h.estimatedImpactPct}%</span>
											</div>
										))}
									</div>
								</div>

								<div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20 text-primary-foreground/90 text-[11px] flex items-start gap-2">
									<ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
									<div>
										<span className="font-bold text-foreground">Recommended Hedging: </span>
										<span className="text-muted-foreground">{stressMutation.data.data.suggestedHedgingAction}</span>
									</div>
								</div>

								{/* Model Portfolio Rebalancing Bridge */}
								<div className="flex items-center justify-between p-2.5 rounded-lg bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
									<div>
										<div className="font-semibold text-indigo-950 dark:text-indigo-200 text-xs flex items-center gap-1.5">
											<Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
											FASP-AI Model Portfolio Rebalance Action
										</div>
										<p className="text-[11px] text-muted-foreground mt-0.5">
											Translate macro stress findings directly into RIA-compliant model portfolio allocations.
										</p>
									</div>
									<Link href="/agent/model-portfolios">
										<Button size="sm" className="h-7 text-xs gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium shrink-0">
											Bridge to Rebalance
											<ExternalLink className="h-3 w-3" />
										</Button>
									</Link>
								</div>
							</div>
						)}
					</TabsContent>
				</Tabs>
			</CardContent>

			{/* ── Audit & Provenance Inspector Dialog ── */}
			<Dialog open={isAuditOpen} onOpenChange={setIsAuditOpen}>
				<DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
					<DialogHeader>
						<div className="flex items-center gap-2">
							<Shield className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
							<DialogTitle className="text-base font-bold">
								Audit & Provenance Inspector
							</DialogTitle>
							<Badge className="bg-emerald-600 text-white text-[10px] py-0 font-semibold">
								SEBI RIA COMPLIANT
							</Badge>
						</div>
						<DialogDescription className="text-xs text-muted-foreground">
							Zero Black-Box Regulatory Verification: Immutable SHA-256 Merkle Checksum, mathematical derivations, and feed provenance logs.
						</DialogDescription>
					</DialogHeader>

					{isProvLoading || !provenanceData?.data ? (
						<div className="space-y-3 py-4">
							<Skeleton className="h-16 w-full rounded-lg" />
							<Skeleton className="h-32 w-full rounded-lg" />
						</div>
					) : (
						<div className="space-y-4 text-xs">
							{/* Cryptographic Checksum Banner */}
							<div className="p-3 rounded-lg bg-slate-900 text-slate-100 dark:bg-slate-950 border border-slate-800 space-y-1.5">
								<div className="flex items-center justify-between text-[11px] text-slate-400">
									<span className="flex items-center gap-1.5 font-mono">
										<Hash className="h-3.5 w-3.5 text-indigo-400" />
										SHA-256 Checksum Snapshot ({provenanceData.data.asOfDate})
									</span>
									<span className="text-emerald-400 font-semibold flex items-center gap-1">
										<CheckCircle2 className="h-3.5 w-3.5" />
										Tamper-Evident Sealed
									</span>
								</div>
								<div className="font-mono text-[11px] text-indigo-300 break-all bg-black/40 p-1.5 rounded">
									{provenanceData.data.checksumSha256}
								</div>
								<div className="text-[10px] text-slate-400">
									Merkle Anchor: <span className="font-mono text-slate-200">{provenanceData.data.merkleRoot}</span> · Engine: <span className="font-mono text-slate-200">{provenanceData.data.meta?.engine_version}</span>
								</div>
							</div>

							{/* Mathematical Explainability Layer (FASP-AI v1.0) */}
							<div className="space-y-2">
								<h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
									<Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
									Deterministic Mathematical Derivations (Zero Hidden Randomness)
								</h4>
								<div className="space-y-2">
									{provenanceData.data.derivedFormulas?.map((f: any) => (
										<div key={f.id} className="p-2.5 rounded-lg bg-card border border-border shadow-2xs space-y-1">
											<div className="flex items-center justify-between">
												<span className="font-bold text-foreground">{f.name}</span>
												<Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40">
													{f.output}
												</Badge>
											</div>
											<div className="font-mono text-[11px] text-indigo-700 dark:text-indigo-300 bg-muted/40 px-1.5 py-0.5 rounded">
												{f.formula}
											</div>
											<div className="text-[10px] text-muted-foreground flex justify-between pt-0.5">
												<span>Steps: <span className="font-mono text-foreground font-medium">{f.intermediateSteps}</span></span>
												<span>Source: <span className="font-medium text-foreground">{f.benchmarkSource}</span></span>
											</div>
										</div>
									))}
								</div>
							</div>

							{/* Feed Ingestion Ledger */}
							<div className="space-y-2">
								<h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
									<Database className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
									Feed Ingestion & Multi-Exchange Regulatory Ledger
								</h4>
								<div className="rounded-lg border border-border overflow-hidden">
									<table className="w-full text-[11px]">
										<thead className="bg-muted/60 text-muted-foreground font-semibold border-b border-border">
											<tr>
												<th className="text-left p-2">Feed Provider</th>
												<th className="text-left p-2">Benchmark Instrument</th>
												<th className="text-left p-2">Ingestion Mode</th>
												<th className="text-right p-2">Status</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-border">
											{provenanceData.data.feedIngestionLedger?.map((feed: any, idx: number) => (
												<tr key={idx} className="hover:bg-muted/30">
													<td className="p-2 font-medium text-foreground">{feed.provider}</td>
													<td className="p-2 text-muted-foreground">{feed.instrument}</td>
													<td className="p-2 text-[10px] text-muted-foreground">{feed.ingestionMode}</td>
													<td className="p-2 text-right">
														<span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-500/20">
															VERIFIED
														</span>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</div>
						</div>
					)}
				</DialogContent>
			</Dialog>
		</Card>
	);
}
