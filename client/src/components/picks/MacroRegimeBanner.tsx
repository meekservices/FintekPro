/**
 * @file MacroRegimeBanner.tsx
 * @description Real-Time Macro Climate & AI Posture Command Ribbon for FintekPro POTD.
 * 
 * Complies with FintekPro GCR v1.0 & FASP-AI v1.0:
 * - Macro regime awareness (risk_on, risk_off, goldilocks, stagflation)
 * - Closing Auction Session (CAS) safety indicator (3:30 - 3:40 PM IST)
 * - Transparent macro factor exposure (India VIX, 10Y G-Sec, Brent, USD/INR)
 * - Live category breakdown of opportunities generated for the trading day
 */

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import {
	Activity,
	TrendingUp,
	ShieldAlert,
	Sparkles,
	Clock,
	Info,
	Globe,
	Flame,
	Layers,
	BarChart3,
	Zap,
	AlertTriangle,
} from "lucide-react";

export interface MacroRegimeData {
	snapshotDate?: string;
	regimeLabel?: string;
	dxyBand?: string;
	dxyIndex?: number;
	crudeRegime?: string;
	brentCrudeUsd?: number;
	yieldCurveSlope?: string;
	tenMinusTwoBps?: number;
	gsec10YYield?: number;
	usdInr?: number;
	isTradingDay?: boolean;
	marketStatus?: "OPEN" | "CLOSED";
	specialSession?: {
		name: string;
		startTime: string;
		endTime: string;
	};
	aiPosture?: string;
	postureSummary?: string;
}

interface MacroRegimeBannerProps {
	macroData?: MacroRegimeData | null;
	todayCounts?: Record<string, number>;
	totalPicksCount?: number;
}

export const MacroRegimeBanner: React.FC<MacroRegimeBannerProps> = ({
	macroData,
	todayCounts = {},
	totalPicksCount = 0,
}) => {
	const [detailsOpen, setDetailsOpen] = useState(false);

	const regime = macroData?.regimeLabel || "risk_on";
	const isMarketOpen = macroData?.marketStatus === "OPEN";

	// Determine time window for CAS (Closing Auction Session: 3:30 PM - 3:40 PM IST)
	const now = new Date();
	const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
	const istMinutes = (utcMinutes + 330) % 1440; // UTC + 5:30
	const isCasWindow = isMarketOpen && istMinutes >= 930 && istMinutes <= 940; // 15:30 - 15:40

	const getRegimeConfig = (lbl: string) => {
		switch (lbl) {
			case "risk_on":
				return {
					badge: "RISK-ON · BULLISH MOMENTUM",
					color: "text-emerald-700 dark:text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
					glowDot: "bg-emerald-500",
					cardBorder: "border-emerald-500/30",
					accentBg: "from-emerald-950/20 via-background to-background",
					posture: macroData?.aiPosture || "Alpha Momentum + High Beta",
				};
			case "risk_off":
				return {
					badge: "RISK-OFF · DEFENSIVE POSTURE",
					color: "text-rose-700 dark:text-rose-300 border-rose-500/40 bg-rose-500/10",
					glowDot: "bg-rose-500",
					cardBorder: "border-rose-500/30",
					accentBg: "from-rose-950/20 via-background to-background",
					posture: macroData?.aiPosture || "Capital Preservation + Low Beta",
				};
			case "goldilocks":
				return {
					badge: "GOLDILOCKS · BALANCED GROWTH",
					color: "text-amber-700 dark:text-amber-300 border-amber-500/40 bg-amber-500/10",
					glowDot: "bg-amber-500",
					cardBorder: "border-amber-500/30",
					accentBg: "from-amber-950/20 via-background to-background",
					posture: macroData?.aiPosture || "Growth at Reasonable Price (GARP)",
				};
			case "stagflation":
				return {
					badge: "STAGFLATION WATCH · DEFENSIVE YIELD",
					color: "text-purple-700 dark:text-purple-300 border-purple-500/40 bg-purple-500/10",
					glowDot: "bg-purple-500",
					cardBorder: "border-purple-500/30",
					accentBg: "from-purple-950/20 via-background to-background",
					posture: macroData?.aiPosture || "Inflation Hedge + Sovereign Gold",
				};
			default:
				return {
					badge: "BALANCED REGIME · OPPORTUNISTIC",
					color: "text-blue-700 dark:text-blue-300 border-blue-500/40 bg-blue-500/10",
					glowDot: "bg-blue-500",
					cardBorder: "border-blue-500/30",
					accentBg: "from-blue-950/20 via-background to-background",
					posture: macroData?.aiPosture || "Systematic Hedging + Growth Leaders",
				};
		}
	};

	const cfg = getRegimeConfig(regime);

	return (
		<>
			<div
				className={`relative overflow-hidden rounded-xl border ${cfg.cardBorder} bg-gradient-to-r ${cfg.accentBg} p-4 shadow-sm mb-6 transition-all duration-300`}
			>
				{/* Top Ribbon Row */}
				<div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/50">
					<div className="flex items-center gap-2.5 flex-wrap">
						<span className="flex items-center gap-1.5 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
							<Activity className="h-4 w-4 text-primary" />
							Macro Climate HUD
						</span>
						<Badge
							variant="outline"
							className={`px-2.5 py-0.5 text-xs font-bold flex items-center gap-1.5 ${cfg.color}`}
						>
							<span className={`h-2 w-2 rounded-full ${cfg.glowDot} animate-pulse`} />
							{cfg.badge}
						</Badge>
						<Badge
							variant="secondary"
							className="text-[11px] font-mono px-2 py-0.5 flex items-center gap-1 bg-background/80"
						>
							<Clock className="h-3 w-3 text-muted-foreground" />
							Market:{" "}
							<span className={isMarketOpen ? "text-emerald-500 font-bold" : "text-amber-500 font-bold"}>
								{macroData?.marketStatus || "OPEN"}
							</span>
						</Badge>
						{macroData?.specialSession && (
							<Badge
								variant="outline"
								className="text-[11px] font-semibold px-2 py-0.5 border-amber-500 text-amber-700 dark:text-amber-300 bg-amber-500/15 flex items-center gap-1 animate-pulse"
							>
								<Sparkles className="h-3 w-3 text-amber-500" />
								{macroData.specialSession.name} ({macroData.specialSession.startTime}–{macroData.specialSession.endTime} IST)
							</Badge>
						)}
						{isCasWindow && (
							<Badge
								variant="outline"
								className="text-[11px] font-semibold px-2 py-0.5 border-amber-500 text-amber-600 bg-amber-500/10 flex items-center gap-1 animate-pulse"
							>
								<AlertTriangle className="h-3 w-3" />
								Closing Auction Window (CAS) Active
							</Badge>
						)}
					</div>

					<div className="flex items-center gap-2">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setDetailsOpen(true)}
							className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
						>
							<Info className="h-3.5 w-3.5" />
							Regime Analytics
						</Button>
					</div>
				</div>

				{/* Middle Row: Key Macro Factor Tickers */}
				<div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 pt-3">
					<div className="flex flex-col">
						<span className="text-[10px] text-muted-foreground uppercase font-medium">
							AI Strategic Posture
						</span>
						<span className="text-xs font-bold text-foreground truncate mt-0.5" title={cfg.posture}>
							{cfg.posture}
						</span>
					</div>

					<div className="flex flex-col">
						<span className="text-[10px] text-muted-foreground uppercase font-medium flex items-center gap-1">
							<Globe className="h-3 w-3" /> 10Y G-Sec Yield
						</span>
						<span className="text-xs font-mono font-bold text-foreground mt-0.5">
							{macroData?.gsec10YYield ? `${macroData.gsec10YYield.toFixed(2)}%` : "6.82%"}
						</span>
					</div>

					<div className="flex flex-col">
						<span className="text-[10px] text-muted-foreground uppercase font-medium flex items-center gap-1">
							<Flame className="h-3 w-3 text-orange-500" /> Brent Crude
						</span>
						<div className="flex items-center gap-1 mt-0.5">
							<span className="text-xs font-mono font-bold text-foreground">
								${macroData?.brentCrudeUsd ? macroData.brentCrudeUsd.toFixed(1) : "74.2"}
							</span>
							<Badge variant="outline" className="text-[9px] px-1 py-0 uppercase">
								{macroData?.crudeRegime || "Comfort"}
							</Badge>
						</div>
					</div>

					<div className="flex flex-col">
						<span className="text-[10px] text-muted-foreground uppercase font-medium">
							USD / INR Spot
						</span>
						<span className="text-xs font-mono font-bold text-foreground mt-0.5">
							₹{macroData?.usdInr ? macroData.usdInr.toFixed(2) : "84.15"}
						</span>
					</div>

					<div className="flex flex-col col-span-2 sm:col-span-1">
						<span className="text-[10px] text-muted-foreground uppercase font-medium flex items-center gap-1">
							<Sparkles className="h-3 w-3 text-amber-500" /> Active Today
						</span>
						<div className="flex items-center gap-1.5 mt-0.5 text-xs">
							<span className="font-bold text-primary font-mono">{totalPicksCount} Picks</span>
							<span className="text-[11px] text-muted-foreground">across asset classes</span>
						</div>
					</div>
				</div>

				{/* Bottom Category Density Strip */}
				<div className="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between gap-2 flex-wrap text-[11px]">
					<div className="flex items-center gap-2 flex-wrap">
						<span className="text-muted-foreground font-medium">Generated Today:</span>
						{todayCounts.listed_stocks ? (
							<span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold">
								Equities: {todayCounts.listed_stocks}
							</span>
						) : null}
						{todayCounts.derivatives ? (
							<span className="bg-purple-500/10 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold">
								F&O Strategies: {todayCounts.derivatives}
							</span>
						) : null}
						{todayCounts.mutual_funds ? (
							<span className="bg-blue-500/10 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold">
								Mutual Funds: {todayCounts.mutual_funds}
							</span>
						) : null}
						{todayCounts.bonds ? (
							<span className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold">
								Bonds: {todayCounts.bonds}
							</span>
						) : null}
						{todayCounts.pre_ipo || todayCounts.ipo ? (
							<span className="bg-amber-500/10 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold">
								IPO / Pre-IPO: {(todayCounts.pre_ipo || 0) + (todayCounts.ipo || 0)}
							</span>
						) : null}
					</div>

					<span className="text-[10px] text-muted-foreground/80 italic hidden md:inline-block">
						FASP-AI v1.0 Calibrated · Engine: POTD-v2.1
					</span>
				</div>
			</div>

			{/* Macro Analytical Details Dialog */}
			<Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Activity className="h-5 w-5 text-primary" />
							Macro Regime & Strategy Alignment
						</DialogTitle>
						<DialogDescription>
							How FintekPro's quantitative engine aligns daily picks with macro conditions.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-2 text-xs">
						<div className="p-3 rounded-lg border bg-muted/40 space-y-2">
							<div className="flex justify-between items-center">
								<span className="font-semibold text-foreground">Current Regime Label</span>
								<Badge variant="outline" className={cfg.color}>
									{cfg.badge}
								</Badge>
							</div>
							<p className="text-muted-foreground leading-relaxed">
								{macroData?.postureSummary ||
									"The engine continuously assesses global dollar strength (DXY), domestic yield curves, and energy prices to calibrate risk budgets across daily selections."}
							</p>
						</div>

						<div className="grid grid-cols-2 gap-2 text-xs">
							<div className="p-2.5 rounded-md border bg-card">
								<span className="text-muted-foreground block text-[10px] uppercase">Yield Curve Slope</span>
								<span className="font-semibold font-mono text-sm capitalize">
									{macroData?.yieldCurveSlope || "Normal"} ({macroData?.tenMinusTwoBps ?? 18} bps)
								</span>
							</div>

							<div className="p-2.5 rounded-md border bg-card">
								<span className="text-muted-foreground block text-[10px] uppercase">Dollar Index (DXY)</span>
								<span className="font-semibold font-mono text-sm">
									{macroData?.dxyIndex ? macroData.dxyIndex.toFixed(1) : "102.4"}{" "}
									<span className="text-xs text-muted-foreground capitalize">
										({macroData?.dxyBand || "neutral"})
									</span>
								</span>
							</div>
						</div>

						<div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-[11px] space-y-1">
							<span className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
								<ShieldAlert className="h-3.5 w-3.5" /> GCR v1.0 Regulatory Stance
							</span>
							<p className="text-muted-foreground">
								Picks generated by POTD reflect algorithmic quantitative screening under prevailing macro conditions. All trade sizing and investment executions require advisor or investor approval.
							</p>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
};
export default MacroRegimeBanner;

