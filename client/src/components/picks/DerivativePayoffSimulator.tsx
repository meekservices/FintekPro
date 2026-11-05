/**
 * @file DerivativePayoffSimulator.tsx
 * @description Interactive Multi-Leg Options Payoff Curve & Terminal Expiry Price Simulator.
 * 
 * Computes exact analytical payoff across all strategy legs for any underlying spot price (S_T),
 * rendering an interactive AreaChart and touch-enabled price scrubber slider.
 * 
 * FintekPro GCR v1.0 & FASP-AI v1.0 Compliant:
 * - Deterministic payoff calculation (no random drift)
 * - Clear explainability: Net P&L (₹), % Return on Capital, Breakeven marks
 * - Mobile responsive with touch slider
 */

import React, { useState, useMemo } from "react";
import {
	ResponsiveContainer,
	AreaChart,
	Area,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ReferenceLine,
} from "recharts";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
	TrendingUp,
	TrendingDown,
	Sliders,
	ChevronDown,
	ChevronUp,
	Activity,
} from "lucide-react";

export interface StrategyLegItem {
	action: "BUY" | "SELL" | string;
	type: "CE" | "PE" | string;
	strikePrice?: number;
	premium?: number;
	quantity?: number;
	name?: string;
}

export interface DerivativePayoffSimulatorProps {
	symbol: string;
	currentSpot: number;
	legs: StrategyLegItem[];
	lotSize?: number;
	isCreditStrategy?: boolean;
	netPremium?: number;
	maxProfit?: number | string;
	maxLoss?: number | string;
	breakeven?: number | number[];
	marginRequired?: number;
}

/**
 * Calculates deterministic portfolio payoff at terminal spot price S_T.
 */
function calculatePayoffAtExpiry(spot: number, legs: StrategyLegItem[], lotSize: number): number {
	let totalPerShare = 0;
	for (const leg of legs) {
		const isBuy = String(leg.action).toUpperCase() === "BUY";
		const isCall = String(leg.type).toUpperCase() === "CE";
		const strike = Number(leg.strikePrice || spot);
		const premium = Number(leg.premium || 0);
		const qty = Number(leg.quantity || 1);

		let intrinsic = 0;
		if (isCall) {
			intrinsic = Math.max(0, spot - strike);
		} else {
			intrinsic = Math.max(0, strike - spot);
		}

		// Buyer: intrinsic - premium; Seller: premium - intrinsic
		const legPayoff = isBuy ? intrinsic - premium : premium - intrinsic;
		totalPerShare += legPayoff * qty;
	}
	return Math.round(totalPerShare * lotSize);
}

export const DerivativePayoffSimulator: React.FC<DerivativePayoffSimulatorProps> = ({
	symbol,
	currentSpot,
	legs,
	lotSize = 65,
	isCreditStrategy = false,
	netPremium = 0,
	maxProfit: _maxProfit,
	maxLoss: _maxLoss,
	breakeven,
	marginRequired,
}) => {
	const [isOpen, setIsOpen] = useState(false);
	const [simulatedSpot, setSimulatedSpot] = useState<number>(currentSpot);

	// Generate discrete spot price points across +/- 5% of current spot
	const { minPrice, maxPrice, step, chartData } = useMemo(() => {
		const baseSpot = currentSpot > 0 ? currentSpot : 25000;
		const rangePct = 0.05; // 5% range
		const minP = Math.round((baseSpot * (1 - rangePct)) / 10) * 10;
		const maxP = Math.round((baseSpot * (1 + rangePct)) / 10) * 10;
		const totalSteps = 25;
		const stepSize = Math.max(10, Math.round((maxP - minP) / totalSteps / 10) * 10);

		const data: Array<{
			spot: number;
			pnl: number;
			profit: number;
			loss: number;
		}> = [];

		for (let p = minP; p <= maxP; p += stepSize) {
			const pnl = calculatePayoffAtExpiry(p, legs, lotSize);
			data.push({
				spot: p,
				pnl,
				profit: pnl >= 0 ? pnl : 0,
				loss: pnl < 0 ? pnl : 0,
			});
		}

		return {
			minPrice: minP,
			maxPrice: maxP,
			step: stepSize,
			chartData: data,
		};
	}, [currentSpot, legs, lotSize]);

	// Calculate PnL at the user-scrubbed simulated spot price
	const currentSimPnl = useMemo(() => {
		return calculatePayoffAtExpiry(simulatedSpot, legs, lotSize);
	}, [simulatedSpot, legs, lotSize]);

	const simDiffPct = currentSpot > 0
		? (((simulatedSpot - currentSpot) / currentSpot) * 100).toFixed(1)
		: "0.0";

	// Capital base for % return calculation (margin for seller, premium for buyer)
	const capitalBase = useMemo(() => {
		if (isCreditStrategy && marginRequired && marginRequired > 0) {
			return marginRequired;
		}
		if (netPremium > 0) {
			return Math.round(netPremium * lotSize);
		}
		return Math.round(currentSpot * lotSize * 0.1);
	}, [isCreditStrategy, marginRequired, netPremium, lotSize, currentSpot]);

	const returnOnCapital = capitalBase > 0
		? ((currentSimPnl / capitalBase) * 100).toFixed(1)
		: "0.0";

	return (
		<div className="rounded-lg border border-indigo-200/90 dark:border-indigo-900/60 bg-gradient-to-b from-indigo-50/30 to-background dark:from-indigo-950/20 dark:to-background overflow-hidden text-xs">
			{/* Accordion Header / Toggle */}
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="w-full flex items-center justify-between p-2.5 hover:bg-muted/40 transition-colors"
			>
				<div className="flex items-center gap-2">
					<Activity className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
					<span className="font-bold text-foreground">
						Interactive Payoff Simulation (P&L at Expiry)
					</span>
					<Badge variant="outline" className="text-[9px] px-1.5 py-0 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300">
						Live Curve
					</Badge>
				</div>
				<div className="flex items-center gap-2">
					<span className="text-[10px] text-muted-foreground hidden sm:inline">
						{isOpen ? "Collapse Simulation" : "Simulate Any Index Level"}
					</span>
					{isOpen ? (
						<ChevronUp className="h-4 w-4 text-muted-foreground" />
					) : (
						<ChevronDown className="h-4 w-4 text-muted-foreground" />
					)}
				</div>
			</button>

			{/* Collapsible Content */}
			{isOpen && (
				<div className="p-3 pt-1 space-y-3 border-t border-indigo-100 dark:border-indigo-900/40">
					{/* Interactive Price Scrubber */}
					<div className="p-2.5 rounded-md bg-muted/40 border space-y-2">
						<div className="flex items-center justify-between flex-wrap gap-2 min-w-0">
							<div className="flex items-center gap-1.5 flex-wrap min-w-0">
								<Sliders className="h-3.5 w-3.5 text-primary shrink-0" />
								<span className="text-[11px] font-semibold text-foreground">
									Simulated {symbol} Price at Expiry:
								</span>
								<span className="font-mono font-bold text-xs text-primary">
									₹{simulatedSpot.toLocaleString("en-IN")}
								</span>
								<span className="text-[10px] text-muted-foreground font-mono">
									({Number(simDiffPct) >= 0 ? "+" : ""}{simDiffPct}%)
								</span>
							</div>
							<div className="flex items-center gap-1.5 flex-wrap shrink-0">
								<span className="text-[10px] text-muted-foreground uppercase font-semibold">
									Simulated P&L:
								</span>
								<span
									className={`font-mono font-bold text-xs sm:text-sm flex items-center gap-0.5 ${
										currentSimPnl >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
									}`}
								>
									{currentSimPnl >= 0 ? (
										<TrendingUp className="h-3 w-3 shrink-0" />
									) : (
										<TrendingDown className="h-3 w-3 shrink-0" />
									)}
									{currentSimPnl >= 0 ? "+" : ""}₹{currentSimPnl.toLocaleString("en-IN")}
									<span className="text-[10px] font-normal ml-0.5">
										({Number(returnOnCapital) >= 0 ? "+" : ""}{returnOnCapital}% RoC)
									</span>
								</span>
							</div>
						</div>

						{/* Slider */}
						<Slider
							value={[simulatedSpot]}
							min={minPrice}
							max={maxPrice}
							step={step}
							onValueChange={(val) => setSimulatedSpot(val[0])}
							className="py-1 cursor-pointer"
						/>

						<div className="flex justify-between text-[9px] text-muted-foreground font-mono">
							<span>Min: ₹{minPrice.toLocaleString("en-IN")} (-5%)</span>
							<button
								type="button"
								onClick={() => setSimulatedSpot(currentSpot)}
								className="text-primary hover:underline font-semibold"
							>
								Reset to Spot (₹{currentSpot.toLocaleString("en-IN")})
							</button>
							<span>Max: ₹{maxPrice.toLocaleString("en-IN")} (+5%)</span>
						</div>
					</div>

					{/* Recharts Area Curve */}
					<div className="h-40 w-full pt-1">
						<ResponsiveContainer width="100%" height="100%">
							<AreaChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
								<defs>
									<linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
										<stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
										<stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
									</linearGradient>
									<linearGradient id="lossGrad" x1="0" y1="1" x2="0" y2="0">
										<stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
										<stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
									</linearGradient>
								</defs>
								<CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
								<XAxis
									dataKey="spot"
									tick={{ fontSize: 9 }}
									tickFormatter={(val) => `₹${val}`}
									interval="preserveStartEnd"
								/>
								<YAxis
									tick={{ fontSize: 9 }}
									tickFormatter={(val) => `${val >= 0 ? "+" : ""}₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
								/>
								<Tooltip
									formatter={(val: number) => [
										`${val >= 0 ? "+" : ""}₹${val.toLocaleString("en-IN")}`,
										"Terminal P&L",
									]}
									labelFormatter={(label) => `${symbol} Spot: ₹${Number(label).toLocaleString("en-IN")}`}
									contentStyle={{
										backgroundColor: "hsl(var(--card))",
										borderColor: "hsl(var(--border))",
										borderRadius: "8px",
										fontSize: "11px",
									}}
								/>
								{/* Zero Line */}
								<ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 2" strokeWidth={1} />
								{/* Current Spot Vertical Line */}
								<ReferenceLine
									x={currentSpot}
									stroke="#3b82f6"
									strokeDasharray="3 3"
									label={{
										value: "LTP",
										position: "top",
										fill: "#3b82f6",
										fontSize: 9,
										fontWeight: "bold",
									}}
								/>
								{/* Breakeven Vertical Line(s) */}
								{Array.isArray(breakeven) ? (
									breakeven.map((be, idx) => (
										<ReferenceLine
											key={idx}
											x={be}
											stroke="#f59e0b"
											strokeDasharray="2 2"
											label={{
												value: `BE ${idx + 1}`,
												position: "insideTop",
												fill: "#f59e0b",
												fontSize: 8,
											}}
										/>
									))
								) : breakeven ? (
									<ReferenceLine
										x={Number(breakeven)}
										stroke="#f59e0b"
										strokeDasharray="2 2"
										label={{
											value: "BE",
											position: "insideTop",
											fill: "#f59e0b",
											fontSize: 8,
										}}
									/>
								) : null}
								{/* Profit and Loss Areas */}
								<Area
									type="monotone"
									dataKey="profit"
									stroke="#10b981"
									strokeWidth={2}
									fill="url(#profitGrad)"
									name="Profit"
								/>
								<Area
									type="monotone"
									dataKey="loss"
									stroke="#f43f5e"
									strokeWidth={2}
									fill="url(#lossGrad)"
									name="Loss"
								/>
							</AreaChart>
						</ResponsiveContainer>
					</div>

					{/* Legend & Key Takeaway Strip */}
					<div className="flex items-center justify-between text-[10px] text-muted-foreground flex-wrap gap-2 pt-1 border-t">
						<div className="flex items-center gap-3">
							<span className="flex items-center gap-1">
								<span className="w-2 h-2 rounded-full bg-emerald-500" /> Profit Zone
							</span>
							<span className="flex items-center gap-1">
								<span className="w-2 h-2 rounded-full bg-rose-500" /> Loss Zone
							</span>
							<span className="flex items-center gap-1">
								<span className="w-2 h-0.5 bg-blue-500" /> Live LTP
							</span>
							<span className="flex items-center gap-1">
								<span className="w-2 h-0.5 bg-amber-500" /> Breakeven
							</span>
						</div>
						<span className="italic opacity-80 text-[9px]">
							*Payoff calculated at contract expiration (DTE=0)
						</span>
					</div>
				</div>
			)}
		</div>
	);
};

