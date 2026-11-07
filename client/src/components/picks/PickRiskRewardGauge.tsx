/**
 * @file PickRiskRewardGauge.tsx
 * @description Interactive Visual Risk-to-Reward Ratio Gauge & FASP-AI Factor Strip.
 * 
 * Complies with FintekPro GCR v1.0 & FASP-AI v1.0:
 * - Transparent calculation of entry risk vs reward potential
 * - Real-time visual tracking of CMP relative to Stoploss, Entry, and Target
 * - Piotroski F-Score & Multi-factor attribution indicators
 */

import React from "react";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, TrendingUp, Sparkles, CheckCircle2, AlertTriangle } from "lucide-react";

interface PickRiskRewardGaugeProps {
	recoPrice: number;
	currentPrice?: number;
	targetPrice: number;
	stoplossPrice: number;
	category?: string;
	keyMetrics?: Record<string, any>;
	confidenceScore?: number;
	compact?: boolean;
}

export const PickRiskRewardGauge: React.FC<PickRiskRewardGaugeProps> = ({
	recoPrice,
	currentPrice,
	targetPrice,
	stoplossPrice,
	category = "listed_stocks",
	keyMetrics,
	confidenceScore,
	compact = false,
}) => {
	const currencySymbol = category === "global_stocks" ? "$" : "₹";
	const cmp = currentPrice && currentPrice > 0 ? currentPrice : recoPrice;

	// Computations
	const entry = Number(recoPrice) || 1;
	const target = Number(targetPrice) || entry;
	const sl = Number(stoplossPrice) || entry * 0.95;

	const reward = Math.max(0, target - entry);
	const risk = Math.max(0.01, entry - sl);
	const rrRatio = risk > 0 ? (reward / risk).toFixed(1) : "0.0";

	const upsidePct = ((target - entry) / entry) * 100;
	const riskPct = ((entry - sl) / entry) * 100;
	const currentPnlPct = ((cmp - entry) / entry) * 100;

	// Calculate visual progress along the range [sl, target]
	const totalSpan = target - sl;
	const cmpPositionPct =
		totalSpan > 0 ? Math.min(100, Math.max(0, ((cmp - sl) / totalSpan) * 100)) : 50;
	const entryPositionPct =
		totalSpan > 0 ? Math.min(100, Math.max(0, ((entry - sl) / totalSpan) * 100)) : 50;

	// Factor attribution extraction from keyMetrics
	const fScore = keyMetrics?.piotroskiScore ?? keyMetrics?.fScore;
	const rsi = keyMetrics?.rsi ?? keyMetrics?.technicalRsi;
	const valuationScore = keyMetrics?.valuationScore ?? (keyMetrics?.peRatio ? (keyMetrics.peRatio < 25 ? 8.5 : 7.0) : null);
	const momentumScore = keyMetrics?.momentumScore ?? (rsi ? (rsi > 50 && rsi < 70 ? 9.0 : 7.5) : null);
	const newsGrounding = keyMetrics?.newsGrounding;

	const getRrBadgeClass = (rr: number) => {
		if (rr >= 2.5) return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
		if (rr >= 1.8) return "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30";
		return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30";
	};

	return (
		<div className={`space-y-2.5 rounded-lg border bg-muted/20 p-3 ${compact ? "text-xs" : "text-sm"}`}>
			{/* Header: Risk-to-Reward ratio & Status */}
			<div className="flex items-center justify-between gap-2 flex-wrap">
				<div className="flex items-center gap-1.5">
					<span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
						Risk / Reward
					</span>
					<Badge
						variant="outline"
						className={`font-mono font-bold text-[11px] px-2 py-0.5 ${getRrBadgeClass(Number(rrRatio))}`}
					>
						1 : {rrRatio}
					</Badge>
				</div>

				<div className="flex items-center gap-2 text-[11px]">
					<span className="text-muted-foreground">
						Max Risk: <strong className="text-rose-600 font-mono">-{riskPct.toFixed(1)}%</strong>
					</span>
					<span className="text-muted-foreground">·</span>
					<span className="text-muted-foreground">
						Upside: <strong className="text-emerald-600 font-mono">+{upsidePct.toFixed(1)}%</strong>
					</span>
				</div>
			</div>

			{/* Visual Multi-Zone Progress Slider */}
			<div className="relative pt-4 pb-2">
				{/* The underlying track bar */}
				<div className="h-2 w-full rounded-full bg-border overflow-hidden relative flex">
					{/* Red zone (Stoploss to Entry) */}
					<div
						className="h-full bg-rose-500/30"
						style={{ width: `${entryPositionPct}%` }}
					/>
					{/* Green zone (Entry to Target) */}
					<div
						className="h-full bg-emerald-500/40"
						style={{ width: `${100 - entryPositionPct}%` }}
					/>
				</div>

				{/* Entry Price Marker */}
				<div
					className="absolute top-2 w-0.5 h-6 bg-foreground/60 transform -translate-x-1/2"
					style={{ left: `${entryPositionPct}%` }}
					title={`Entry: ${currencySymbol}${entry.toLocaleString()}`}
				/>

				{/* CMP Current Marker Pin */}
				<div
					className="absolute top-0.5 transform -translate-x-1/2 flex flex-col items-center transition-all duration-300"
					style={{ left: `${cmpPositionPct}%` }}
				>
					<span
						className={`w-3 h-3 rounded-full border-2 border-background shadow-md ${
							currentPnlPct >= 0 ? "bg-emerald-500 animate-pulse" : "bg-rose-500 animate-pulse"
						}`}
					/>
				</div>

				{/* Labels Row below the bar */}
				<div className="flex justify-between items-center text-[10px] text-muted-foreground mt-2 font-mono">
					<div className="flex flex-col items-start">
						<span className="text-rose-600 font-semibold">SL {currencySymbol}{sl.toLocaleString()}</span>
						<span>-{riskPct.toFixed(1)}%</span>
					</div>

					<div className="flex flex-col items-center">
						<span className="font-semibold text-foreground">Entry {currencySymbol}{entry.toLocaleString()}</span>
						<span className={currentPnlPct >= 0 ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
							LTP {currencySymbol}{cmp.toLocaleString()} ({currentPnlPct >= 0 ? "+" : ""}{currentPnlPct.toFixed(1)}%)
						</span>
					</div>

					<div className="flex flex-col items-end">
						<span className="text-emerald-600 font-semibold">TGT {currencySymbol}{target.toLocaleString()}</span>
						<span>+{upsidePct.toFixed(1)}%</span>
					</div>
				</div>
			</div>

			{/* FASP-AI Factor Breakdown Strip */}
			<div className="pt-2 border-t border-border/40 flex items-center justify-between gap-1.5 flex-wrap text-[10px]">
				<div className="flex items-center gap-1.5 flex-wrap">
					{fScore !== undefined && fScore !== null && (
						<Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-background font-mono">
							Piotroski: <strong className="ml-1 text-primary">{fScore}/9</strong>
						</Badge>
					)}
					{rsi !== undefined && rsi !== null && (
						<Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-background font-mono">
							RSI(14): <strong className="ml-1">{Math.round(rsi)}</strong>
						</Badge>
					)}
					{valuationScore !== null && (
						<Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-background font-mono">
							Valuation: <strong className="ml-1 text-emerald-600">{Number(valuationScore).toFixed(1)}/10</strong>
						</Badge>
					)}
					{newsGrounding && (
						<Badge
							variant="outline"
							className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 flex items-center gap-0.5"
						>
							<CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" />
							Search Grounded
						</Badge>
					)}
				</div>

				{confidenceScore !== undefined && (
					<span className="text-muted-foreground font-mono">
						Model Conviction: <strong className="text-foreground">{confidenceScore}%</strong>
					</span>
				)}
			</div>
		</div>
	);
};
export default PickRiskRewardGauge;

