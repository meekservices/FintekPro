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
} from "lucide-react";
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

export function GlobalMacroRadarWidget() {
	const [activeScenario, setActiveScenario] = useState<"OIL_SPIKE_95" | "DOLLAR_SURGE_106" | "US_YIELD_SPIKE_475">("OIL_SPIKE_95");

	// ── 1. Fetch Live Global Macro Report ──
	const { data, isLoading, isError, refetch, isFetching } = useQuery<{ success: boolean; data: GlobalMacroReport }>({
		queryKey: ["/api/macro/global-radar"],
		queryFn: async () => {
			const res = await fetch("/api/macro/global-radar");
			if (!res.ok) throw new Error("Failed to fetch global macro report");
			return res.json();
		},
		refetchInterval: 5 * 60 * 1000, // 5 min auto refresh
	});

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

					<div className="flex items-center gap-3 self-end sm:self-auto">
						<div className="text-right">
							<div className="text-xs text-muted-foreground uppercase font-medium">Global Tailwind Score</div>
							<div className={cn("text-2xl font-black tracking-tight", getScoreColor(report.globalTailwindScore))}>
								{report.globalTailwindScore}<span className="text-xs font-normal text-muted-foreground">/100</span>
							</div>
						</div>

						<Button
							size="sm"
							variant="outline"
							className="h-8 gap-1.5 text-xs"
							onClick={() => refetch()}
							disabled={isFetching}
						>
							<RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
							Sync
						</Button>
					</div>
				</div>
			</CardHeader>

			<CardContent className="space-y-5">
				{/* ── Summary Banner ── */}
				<div className="p-3.5 rounded-xl bg-muted/40 border border-border/50 text-xs sm:text-sm text-foreground/90 flex items-start gap-2.5">
					<Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
					<p className="leading-relaxed">{report.summary}</p>
				</div>

				{/* ── 4 Top-Level Metric Gauges ── */}
				<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
					{/* Gauge 1: Brent Crude */}
					<div className="p-3.5 rounded-xl bg-card border border-border/60 shadow-xs space-y-1.5">
						<div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
							<span className="flex items-center gap-1.5">
								<Flame className="h-3.5 w-3.5 text-amber-500" />
								Brent Crude
							</span>
							<Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
								Comfort Band
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
								Forex Rate
							</span>
							<Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-blue-500/10 text-blue-600 border-blue-500/20">
								Orderly
							</Badge>
						</div>
						<div className="text-lg font-bold text-foreground">
							₹{report.macroRegimeSummary.usdInrRate.toFixed(2)}
						</div>
						<div className="text-[11px] text-muted-foreground">
							USD / INR Exchange Rate
						</div>
					</div>
				</div>

				{/* ── Tabs: Pillars Breakdown, Sector Matrix, Stress Testing ── */}
				<Tabs defaultValue="pillars" className="w-full">
					<TabsList className="grid grid-cols-3 h-9 text-xs mb-3">
						<TabsTrigger value="pillars" className="text-xs">5 Transmission Pillars</TabsTrigger>
						<TabsTrigger value="sectors" className="text-xs">Sector Sensitivities</TabsTrigger>
						<TabsTrigger value="stress" className="text-xs">Macro Stress Simulator</TabsTrigger>
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

					{/* Tab 3: Macro Stress Simulator */}
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
							</div>
						)}
					</TabsContent>
				</Tabs>
			</CardContent>
		</Card>
	);
}
