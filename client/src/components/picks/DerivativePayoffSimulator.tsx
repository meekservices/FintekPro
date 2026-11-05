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
	Line,
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
	Calendar,
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
	daysToExpiry?: number;
	impliedVolatility?: number;
}

/* =======================================================================
   Black-Scholes & Greeks Calculation Engine (Deterministic, SEBI Compliant)
   ======================================================================= */

/** Cumulative Standard Normal Distribution approximation (Abramowitz & Stegun) */
function cdfNormal(x: number): number {
	const a1 = 0.254829592;
	const a2 = -0.284496736;
	const a3 = 1.421413741;
	const a4 = -1.453152027;
	const a5 = 1.061405429;
	const p = 0.3275911;

	const sign = x < 0 ? -1 : 1;
	const absX = Math.abs(x) / Math.SQRT2;

	const t = 1.0 / (1.0 + p * absX);
	const erf =
		1.0 -
		(((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) *
			Math.exp(-absX * absX);

	return 0.5 * (1.0 + sign * erf);
}

/** Standard Normal Probability Density Function */
function pdfNormal(x: number): number {
	return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

interface BlackScholesResult {
	price: number;
	delta: number;
	gamma: number;
	theta: number; // daily theta in rupees
	vega: number; // vega per 1% IV
}

/**
 * Computes European option price & Greeks via Black-Scholes formula.
 */
function blackScholes(
	spot: number,
	strike: number,
	timeInYears: number,
	volatility: number,
	riskFreeRate: number = 0.07,
	isCall: boolean = true,
): BlackScholesResult {
	if (timeInYears <= 0.0001) {
		const intrinsic = isCall ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
		const delta = isCall ? (spot > strike ? 1 : 0) : spot < strike ? -1 : 0;
		return { price: intrinsic, delta, gamma: 0, theta: 0, vega: 0 };
	}

	const s = Math.max(0.01, spot);
	const k = Math.max(0.01, strike);
	const sigma = Math.max(0.01, volatility);
	const r = riskFreeRate;
	const t = timeInYears;

	const sqrtT = Math.sqrt(t);
	const d1 = (Math.log(s / k) + (r + 0.5 * sigma * sigma) * t) / (sigma * sqrtT);
	const d2 = d1 - sigma * sqrtT;

	const nd1 = cdfNormal(d1);
	const nd2 = cdfNormal(d2);
	const nPrimeD1 = pdfNormal(d1);

	let price = 0;
	let delta = 0;

	if (isCall) {
		price = s * nd1 - k * Math.exp(-r * t) * nd2;
		delta = nd1;
	} else {
		price = k * Math.exp(-r * t) * cdfNormal(-d2) - s * cdfNormal(-d1);
		delta = nd1 - 1;
	}

	const gamma = nPrimeD1 / (s * sigma * sqrtT);
	// Theta per year, converted to per day (/365)
	const thetaAnnual =
		-(s * nPrimeD1 * sigma) / (2 * sqrtT) -
		(isCall
			? r * k * Math.exp(-r * t) * nd2
			: -r * k * Math.exp(-r * t) * cdfNormal(-d2));
	const thetaDaily = thetaAnnual / 365;
	const vega = s * sqrtT * nPrimeD1 * 0.01; // 1% change

	return {
		price: Math.max(0, price),
		delta,
		gamma,
		theta: thetaDaily,
		vega,
	};
}

/**
 * Calculates deterministic portfolio payoff at terminal spot price S_T (DTE = 0).
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

/**
 * Calculates portfolio P&L on a specific Target Date (T+n) prior to expiration.
 */
function calculatePayoffAtTargetDate(
	spot: number,
	legs: StrategyLegItem[],
	lotSize: number,
	remainingDte: number,
	iv: number = 0.14,
): number {
	if (remainingDte <= 0) {
		return calculatePayoffAtExpiry(spot, legs, lotSize);
	}
	const timeInYears = remainingDte / 365;
	let totalPerShare = 0;

	for (const leg of legs) {
		const isBuy = String(leg.action).toUpperCase() === "BUY";
		const isCall = String(leg.type).toUpperCase() === "CE";
		const strike = Number(leg.strikePrice || spot);
		const entryPremium = Number(leg.premium || 0);
		const qty = Number(leg.quantity || 1);

		const bs = blackScholes(spot, strike, timeInYears, iv, 0.07, isCall);
		const currentOptionPrice = bs.price;

		const legPnl = isBuy
			? currentOptionPrice - entryPremium
			: entryPremium - currentOptionPrice;
		totalPerShare += legPnl * qty;
	}
	return Math.round(totalPerShare * lotSize);
}

/**
 * Calculates net portfolio Greeks aggregated across all legs.
 */
function calculatePortfolioGreeks(
	spot: number,
	legs: StrategyLegItem[],
	lotSize: number,
	dte: number,
	iv: number = 0.14,
) {
	const timeInYears = Math.max(0.001, dte / 365);
	let netDelta = 0;
	let netGamma = 0;
	let netTheta = 0;
	let netVega = 0;

	for (const leg of legs) {
		const isBuy = String(leg.action).toUpperCase() === "BUY";
		const isCall = String(leg.type).toUpperCase() === "CE";
		const strike = Number(leg.strikePrice || spot);
		const qty = Number(leg.quantity || 1);
		const mult = (isBuy ? 1 : -1) * qty * lotSize;

		const bs = blackScholes(spot, strike, timeInYears, iv, 0.07, isCall);
		netDelta += bs.delta * mult;
		netGamma += bs.gamma * mult;
		netTheta += bs.theta * mult;
		netVega += bs.vega * mult;
	}

	return {
		netDelta: Number(netDelta.toFixed(2)),
		netGamma: Number((netGamma * 100).toFixed(3)),
		netTheta: Math.round(netTheta),
		netVega: Math.round(netVega),
	};
}

/**
 * Calculates Probability of Profit (POP) using normal distribution of log-returns.
 */
function calculateProbabilityOfProfit(
	spot: number,
	breakeven: number | number[] | undefined,
	dte: number,
	iv: number = 0.14,
	isCreditStrategy: boolean = false,
): number {
	if (!breakeven || dte <= 0 || spot <= 0) return 50;

	const t = Math.max(0.001, dte / 365);
	const sigma = iv;
	const sqrtT = Math.sqrt(t);

	const probAbove = (price: number) => {
		const d2 = (Math.log(spot / price) + (0.07 - 0.5 * sigma * sigma) * t) / (sigma * sqrtT);
		return cdfNormal(d2);
	};

	const probBelow = (price: number) => {
		return 1 - probAbove(price);
	};

	if (Array.isArray(breakeven) && breakeven.length >= 2) {
		const lower = Math.min(breakeven[0], breakeven[1]);
		const upper = Math.max(breakeven[0], breakeven[1]);

		const probBetween = Math.max(0, probAbove(lower) - probAbove(upper));

		// For credit strategy (e.g. Short Strangle, Iron Condor), profit is INSIDE the breakevens
		// For debit strategy (e.g. Long Straddle), profit is OUTSIDE the breakevens
		const pop = isCreditStrategy ? probBetween : 1 - probBetween;
		return Math.min(99, Math.max(1, Math.round(pop * 100)));
	} else if (typeof breakeven === "number") {
		const pop = isCreditStrategy ? probAbove(breakeven) : probBelow(breakeven);
		return Math.min(99, Math.max(1, Math.round(pop * 100)));
	}

	return 50;
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
	daysToExpiry = 7,
	impliedVolatility = 0.14,
}) => {
	const [isOpen, setIsOpen] = useState(false);
	const [simulatedSpot, setSimulatedSpot] = useState<number>(currentSpot);
	// Target days remaining: 0 means Expiry, daysToExpiry means Today (T+0)
	const [targetDte, setTargetDte] = useState<number>(0);

	// Portfolio Greeks & Probability of Profit
	const greeks = useMemo(() => {
		return calculatePortfolioGreeks(
			currentSpot,
			legs,
			lotSize,
			daysToExpiry,
			impliedVolatility,
		);
	}, [currentSpot, legs, lotSize, daysToExpiry, impliedVolatility]);

	const pop = useMemo(() => {
		return calculateProbabilityOfProfit(
			currentSpot,
			breakeven,
			daysToExpiry,
			impliedVolatility,
			isCreditStrategy,
		);
	}, [currentSpot, breakeven, daysToExpiry, impliedVolatility, isCreditStrategy]);

	// 1-Sigma Expected Move (68% normal probability cone)
	const expectedMove = useMemo(() => {
		if (currentSpot <= 0) return 0;
		return Math.round(
			currentSpot * impliedVolatility * Math.sqrt(Math.max(1, daysToExpiry) / 365),
		);
	}, [currentSpot, impliedVolatility, daysToExpiry]);

	const expectedRange = useMemo(() => {
		return [currentSpot - expectedMove, currentSpot + expectedMove];
	}, [currentSpot, expectedMove]);

	// Generate discrete spot price points across +/- 6% of current spot
	const { minPrice, maxPrice, step, chartData } = useMemo(() => {
		const baseSpot = currentSpot > 0 ? currentSpot : 25000;
		const rangePct = 0.06; // 6% range to show full wings
		const minP = Math.round((baseSpot * (1 - rangePct)) / 10) * 10;
		const maxP = Math.round((baseSpot * (1 + rangePct)) / 10) * 10;
		const totalSteps = 28;
		const stepSize = Math.max(10, Math.round((maxP - minP) / totalSteps / 10) * 10);

		const data: Array<{
			spot: number;
			pnl: number;
			profit: number;
			loss: number;
			targetPnl: number;
		}> = [];

		for (let p = minP; p <= maxP; p += stepSize) {
			const expiryPnl = calculatePayoffAtExpiry(p, legs, lotSize);
			const targetPnl = calculatePayoffAtTargetDate(
				p,
				legs,
				lotSize,
				targetDte,
				impliedVolatility,
			);
			data.push({
				spot: p,
				pnl: expiryPnl,
				profit: expiryPnl >= 0 ? expiryPnl : 0,
				loss: expiryPnl < 0 ? expiryPnl : 0,
				targetPnl,
			});
		}

		return {
			minPrice: minP,
			maxPrice: maxP,
			step: stepSize,
			chartData: data,
		};
	}, [currentSpot, legs, lotSize, targetDte, impliedVolatility]);

	// Calculate PnL at the user-scrubbed simulated spot price
	const currentExpirySimPnl = useMemo(() => {
		return calculatePayoffAtExpiry(simulatedSpot, legs, lotSize);
	}, [simulatedSpot, legs, lotSize]);

	const currentTargetSimPnl = useMemo(() => {
		return calculatePayoffAtTargetDate(
			simulatedSpot,
			legs,
			lotSize,
			targetDte,
			impliedVolatility,
		);
	}, [simulatedSpot, legs, lotSize, targetDte, impliedVolatility]);

	const activeSimPnl = targetDte > 0 ? currentTargetSimPnl : currentExpirySimPnl;

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
		? ((activeSimPnl / capitalBase) * 100).toFixed(1)
		: "0.0";

	return (
		<div className="rounded-lg border border-indigo-200/90 dark:border-indigo-900/60 bg-gradient-to-b from-indigo-50/30 to-background dark:from-indigo-950/20 dark:to-background overflow-hidden text-xs">
			{/* Accordion Header / Toggle */}
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="w-full flex items-center justify-between p-2.5 hover:bg-muted/40 transition-colors"
			>
				<div className="flex items-center gap-2 flex-wrap">
					<Activity className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
					<span className="font-bold text-foreground">
						Interactive Payoff & Greeks Simulator
					</span>
					<Badge
						variant="outline"
						className={`text-[9.5px] px-1.5 py-0 font-bold ${
							pop >= 60
								? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-400"
								: pop >= 45
									? "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/50 dark:text-blue-400"
									: "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/50 dark:text-amber-400"
						}`}
					>
						POP {pop}%
					</Badge>
					<Badge
						variant="outline"
						className="text-[9px] px-1.5 py-0 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300"
					>
						{targetDte > 0 ? `T+${daysToExpiry - targetDte} Live Curve` : "Expiry Curve"}
					</Badge>
				</div>
				<div className="flex items-center gap-2">
					<span className="text-[10px] text-muted-foreground hidden sm:inline">
						{isOpen ? "Collapse Simulation" : "Simulate Index & Greeks"}
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
					{/* Institutional Portfolio Greeks Strip */}
					<div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-2 rounded-lg bg-card/90 border text-[11px]">
						<div>
							<span className="text-[9.5px] text-muted-foreground uppercase font-semibold">
								Net Delta (Δ)
							</span>
							<p className={`font-mono font-bold ${greeks.netDelta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
								{greeks.netDelta >= 0 ? "+" : ""}{greeks.netDelta}
							</p>
						</div>
						<div>
							<span className="text-[9.5px] text-muted-foreground uppercase font-semibold">
								Daily Theta (Θ)
							</span>
							<p className={`font-mono font-bold ${greeks.netTheta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
								{greeks.netTheta >= 0 ? "+" : ""}₹{greeks.netTheta.toLocaleString("en-IN")}/day
							</p>
						</div>
						<div>
							<span className="text-[9.5px] text-muted-foreground uppercase font-semibold">
								Net Vega (ν)
							</span>
							<p className="font-mono font-bold text-foreground">
								{greeks.netVega >= 0 ? "+" : ""}₹{greeks.netVega.toLocaleString("en-IN")}/1% IV
							</p>
						</div>
						<div>
							<span className="text-[9.5px] text-muted-foreground uppercase font-semibold">
								Expected 1σ Move
							</span>
							<p className="font-mono font-bold text-purple-600 dark:text-purple-400">
								±₹{expectedMove.toLocaleString("en-IN")}
							</p>
						</div>
						<div>
							<span className="text-[9.5px] text-muted-foreground uppercase font-semibold">
								Prob of Profit (POP)
							</span>
							<p className={`font-mono font-bold ${pop >= 55 ? "text-emerald-600 dark:text-emerald-400" : "text-blue-600 dark:text-blue-400"}`}>
								{pop}%
							</p>
						</div>
					</div>

					{/* Time Decay / Target Date Selector Strip */}
					<div className="p-2.5 rounded-md bg-muted/30 border space-y-1.5">
						<div className="flex items-center justify-between flex-wrap gap-1">
							<div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
								<Calendar className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
								<span>Payoff Target Date:</span>
								<span className="font-mono font-bold text-primary">
									{targetDte === 0
										? "At Expiry (DTE: 0 Days)"
										: targetDte === daysToExpiry
											? `Today (T+0, DTE: ${daysToExpiry} Days)`
											: `Target Date (DTE: ${targetDte} Days)`}
								</span>
							</div>
							<div className="flex items-center gap-1">
								<button
									type="button"
									onClick={() => setTargetDte(daysToExpiry)}
									className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
										targetDte === daysToExpiry
											? "bg-primary text-primary-foreground border-primary"
											: "bg-background hover:bg-muted text-muted-foreground"
									}`}
								>
									Today (T+0)
								</button>
								<button
									type="button"
									onClick={() => setTargetDte(Math.round(daysToExpiry / 2))}
									className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
										targetDte === Math.round(daysToExpiry / 2) && targetDte > 0
											? "bg-primary text-primary-foreground border-primary"
											: "bg-background hover:bg-muted text-muted-foreground"
									}`}
								>
									Mid-Life
								</button>
								<button
									type="button"
									onClick={() => setTargetDte(0)}
									className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
										targetDte === 0
											? "bg-primary text-primary-foreground border-primary"
											: "bg-background hover:bg-muted text-muted-foreground"
									}`}
								>
									Expiry (T+{daysToExpiry})
								</button>
							</div>
						</div>
						{daysToExpiry > 0 && (
							<Slider
								value={[targetDte]}
								min={0}
								max={daysToExpiry}
								step={1}
								onValueChange={(val) => setTargetDte(val[0])}
								className="py-1 cursor-pointer"
							/>
						)}
					</div>

					{/* Interactive Price Scrubber */}
					<div className="p-2.5 rounded-md bg-muted/40 border space-y-2">
						<div className="flex items-center justify-between flex-wrap gap-2 min-w-0">
							<div className="flex items-center gap-1.5 flex-wrap min-w-0">
								<Sliders className="h-3.5 w-3.5 text-primary shrink-0" />
								<span className="text-[11px] font-semibold text-foreground">
									Simulated {symbol} Price:
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
									Simulated P&L ({targetDte > 0 ? `DTE ${targetDte}` : "Expiry"}):
								</span>
								<span
									className={`font-mono font-bold text-xs sm:text-sm flex items-center gap-0.5 ${
										activeSimPnl >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
									}`}
								>
									{activeSimPnl >= 0 ? (
										<TrendingUp className="h-3 w-3 shrink-0" />
									) : (
										<TrendingDown className="h-3 w-3 shrink-0" />
									)}
									{activeSimPnl >= 0 ? "+" : ""}₹{activeSimPnl.toLocaleString("en-IN")}
									<span className="text-[10px] font-normal ml-0.5">
										({Number(returnOnCapital) >= 0 ? "+" : ""}{returnOnCapital}% RoC)
									</span>
								</span>
							</div>
						</div>

						{/* Price Slider */}
						<Slider
							value={[simulatedSpot]}
							min={minPrice}
							max={maxPrice}
							step={step}
							onValueChange={(val) => setSimulatedSpot(val[0])}
							className="py-1 cursor-pointer"
						/>

						<div className="flex justify-between text-[9px] text-muted-foreground font-mono">
							<span>Min: ₹{minPrice.toLocaleString("en-IN")} (-6%)</span>
							<button
								type="button"
								onClick={() => setSimulatedSpot(currentSpot)}
								className="text-primary hover:underline font-semibold"
							>
								Reset to Spot (₹{currentSpot.toLocaleString("en-IN")})
							</button>
							<span>Max: ₹{maxPrice.toLocaleString("en-IN")} (+6%)</span>
						</div>
					</div>

					{/* Recharts Area Curve with Dual Target & Expiry Lines */}
					<div className="h-44 w-full pt-1">
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
									formatter={(val: number, name: string) => [
										`${val >= 0 ? "+" : ""}₹${val.toLocaleString("en-IN")}`,
										name === "targetPnl" ? `Target Date P&L (DTE: ${targetDte})` : "Expiry P&L",
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
								{/* 1-Sigma Expected Move Lines */}
								{expectedRange[0] >= minPrice && (
									<ReferenceLine
										x={expectedRange[0]}
										stroke="#a855f7"
										strokeDasharray="2 2"
										label={{
											value: "-1σ",
											position: "insideTopLeft",
											fill: "#a855f7",
											fontSize: 8,
										}}
									/>
								)}
								{expectedRange[1] <= maxPrice && (
									<ReferenceLine
										x={expectedRange[1]}
										stroke="#a855f7"
										strokeDasharray="2 2"
										label={{
											value: "+1σ",
											position: "insideTopRight",
											fill: "#a855f7",
											fontSize: 8,
										}}
									/>
								)}
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
								{/* Profit and Loss Areas for Expiry */}
								<Area
									type="monotone"
									dataKey="profit"
									stroke="#10b981"
									strokeWidth={2}
									fill="url(#profitGrad)"
									name="profit"
								/>
								<Area
									type="monotone"
									dataKey="loss"
									stroke="#f43f5e"
									strokeWidth={2}
									fill="url(#lossGrad)"
									name="loss"
								/>
								{/* Live Target Date Curve (Dashed Sky Line) */}
								{targetDte > 0 && (
									<Line
										type="monotone"
										dataKey="targetPnl"
										stroke="#0284c7"
										strokeWidth={2.5}
										dot={false}
										name="targetPnl"
									/>
								)}
							</AreaChart>
						</ResponsiveContainer>
					</div>

					{/* Legend & Key Takeaway Strip */}
					<div className="flex items-center justify-between text-[10px] text-muted-foreground flex-wrap gap-2 pt-1 border-t">
						<div className="flex items-center gap-2.5 flex-wrap">
							<span className="flex items-center gap-1">
								<span className="w-2 h-2 rounded-full bg-emerald-500" /> Expiry Profit
							</span>
							<span className="flex items-center gap-1">
								<span className="w-2 h-2 rounded-full bg-rose-500" /> Expiry Loss
							</span>
							{targetDte > 0 && (
								<span className="flex items-center gap-1 text-sky-600 dark:text-sky-400 font-semibold">
									<span className="w-2.5 h-0.5 bg-sky-500" /> Target Date (DTE: {targetDte})
								</span>
							)}
							<span className="flex items-center gap-1">
								<span className="w-2 h-0.5 bg-blue-500" /> Live LTP
							</span>
							<span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
								<span className="w-2 h-0.5 bg-purple-500" /> ±1σ Cone (68%)
							</span>
							<span className="flex items-center gap-1">
								<span className="w-2 h-0.5 bg-amber-500" /> Breakeven
							</span>
						</div>
						<span className="italic opacity-80 text-[9px]">
							*Pricing via FintekPro Black-Scholes Engine (Risk-free: 7%, IV: {(impliedVolatility * 100).toFixed(0)}%)
						</span>
					</div>
				</div>
			)}
		</div>
	);
};

