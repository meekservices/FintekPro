/**
 * @file smart-order-routing-engine.ts
 * @description Institutional Smart Order Routing (SOR) & SEBI Impact Cost Engine for FintekPro.
 *              Evaluates multi-exchange National Best Bid & Offer (NBBO across NSE & BSE),
 *              computes SEBI-mandated Market Impact Cost, and generates algorithmic TWAP/VWAP slices.
 *
 * GCR v1.0 & FASP-AI v1.0 Compliance:
 * - Deterministic Output: Same market depth inputs ALWAYS yield identical exchange routing & slice schedules.
 * - Every payload exposes engine_version, calculation_timestamp, inputs_used, formula_applied, intermediate_steps.
 * - Strict TypeScript typing with zero unverified any.
 * - JSDoc documentation on all exported functions.
 */

export const SOR_ENGINE_VERSION = "1.1.0";

/**
 * Aligns price to standard Indian exchange tick size (NSE & BSE minimum price variation ₹0.05).
 */
export function alignToTick(price: number, tick = 0.05): number {
	if (price <= 0) return 0.05;
	return +(Math.round(price / tick) * tick).toFixed(2);
}

export interface DepthLevel {
	price: number;
	quantity: number;
	ordersCount?: number;
}

export interface ExchangeOrderBook {
	exchange: "NSE" | "BSE";
	symbol: string;
	bids: DepthLevel[]; // Ordered highest price to lowest
	asks: DepthLevel[]; // Ordered lowest price to highest
	lastTradedPrice: number;
	dayVolume: number;
}

export interface SorOrderRequest {
	symbol: string;
	side: "BUY" | "SELL";
	quantity: number;
	preferredBroker?: "UPSTOX" | "DHAN" | "AUTO";
	maxAllowedImpactCostBps?: number; // Default: 35 bps (0.35%)
	nseBook: ExchangeOrderBook;
	bseBook?: ExchangeOrderBook;
}

export interface OrderSlice {
	sliceNumber: number;
	quantity: number;
	targetExchange: "NSE" | "BSE";
	estimatedLimitPrice: number;
	delaySecondsFromStart: number;
	suggestedOrderType: "LIMIT" | "MARKET";
}

export interface SorRoutingPlan {
	engine_version: string;
	calculation_timestamp: string;
	symbol: string;
	side: "BUY" | "SELL";
	totalQuantity: number;
	selectedPrimaryExchange: "NSE" | "BSE";
	bestExecutionPrice: number;
	idealMidPrice: number;
	estimatedImpactCostBps: number; // in basis points (1 bp = 0.01%)
	estimatedImpactCostPct: number; // in %
	isSlicingRecommended: boolean;
	recommendedSlices: OrderSlice[];
	brokerRouting: {
		recommendedBroker: "UPSTOX" | "DHAN";
		rationale: string;
	};
	exchangeComparison: {
		nseBestBid: number;
		nseBestAsk: number;
		nseSpreadBps: number;
		bseBestBid?: number;
		bseBestAsk?: number;
		bseSpreadBps?: number;
		bestExchangeReason: string;
	};
	inputs_used: {
		symbol: string;
		side: "BUY" | "SELL";
		quantity: number;
		hasBseBook: boolean;
	};
	formula_applied: string;
	intermediate_steps: {
		fillWeightedAveragePrice: number;
		liquidityDepthAvailable: number;
		totalSlicesCount: number;
	};
}

/**
 * Calculates weighted average execution price from order book depth.
 */
function simulateFillAcrossDepth(
	levels: DepthLevel[],
	neededQty: number,
	fallbackPrice: number,
): { avgPrice: number; filledQty: number } {
	let remaining = neededQty;
	let totalCost = 0;
	let filled = 0;

	for (const level of levels) {
		const take = Math.min(remaining, level.quantity);
		totalCost += take * level.price;
		filled += take;
		remaining -= take;
		if (remaining <= 0) break;
	}

	if (remaining > 0) {
		// Slippage penalty for orders exceeding depth
		const penaltyMultiplier = 1.008; // 0.8% slippage penalty
		totalCost += remaining * (fallbackPrice * penaltyMultiplier);
		filled += remaining;
	}

	return {
		avgPrice: filled > 0 ? +(totalCost / filled).toFixed(4) : fallbackPrice,
		filledQty: filled,
	};
}

/**
 * Computes Smart Order Routing plan with NBBO exchange selection, SEBI impact cost, and execution slices.
 *
 * @param request - Order requirements and live NSE/BSE order books
 * @param customTimestamp - Evaluation timestamp (defaults to current date)
 * @returns Fully deterministic routing plan and slice schedule
 */
export function generateSmartRoutingPlan(
	request: SorOrderRequest,
	customTimestamp?: string,
): SorRoutingPlan {
	const timestamp = customTimestamp || new Date().toISOString();
	const { symbol, side, quantity, nseBook, bseBook, maxAllowedImpactCostBps = 35 } = request;

	const nseBestBid = nseBook.bids[0]?.price ?? nseBook.lastTradedPrice;
	const nseBestAsk = nseBook.asks[0]?.price ?? nseBook.lastTradedPrice;
	const nseSpread = nseBestAsk - nseBestBid;
	const nseMid = (nseBestBid + nseBestAsk) / 2;
	const nseSpreadBps = nseMid > 0 ? +((nseSpread / nseMid) * 10000).toFixed(1) : 0;

	let bseBestBid: number | undefined;
	let bseBestAsk: number | undefined;
	let bseSpreadBps: number | undefined;

	let selectedExchange: "NSE" | "BSE" = "NSE";
	let bestReason = "NSE selected: Dominant liquidity and tightest spread.";

	if (bseBook && bseBook.bids.length > 0 && bseBook.asks.length > 0) {
		bseBestBid = bseBook.bids[0].price;
		bseBestAsk = bseBook.asks[0].price;
		const bseMid = (bseBestBid + bseBestAsk) / 2;
		bseSpreadBps = bseMid > 0 ? +(((bseBestAsk - bseBestBid) / bseMid) * 10000).toFixed(1) : 0;

		if (side === "BUY" && bseBestAsk < nseBestAsk) {
			selectedExchange = "BSE";
			bestReason = `BSE selected for BUY: Best ask price (₹${bseBestAsk}) is better than NSE (₹${nseBestAsk}).`;
		} else if (side === "SELL" && bseBestBid > nseBestBid) {
			selectedExchange = "BSE";
			bestReason = `BSE selected for SELL: Best bid price (₹${bseBestBid}) is higher than NSE (₹${nseBestBid}).`;
		}
	}

	const activeBook = selectedExchange === "BSE" && bseBook ? bseBook : nseBook;
	const relevantDepth = side === "BUY" ? activeBook.asks : activeBook.bids;
	const idealMidPrice = nseMid;

	// Simulate depth fill
	const { avgPrice: fillWap } = simulateFillAcrossDepth(
		relevantDepth,
		quantity,
		side === "BUY" ? nseBestAsk : nseBestBid,
	);

	// SEBI Impact Cost Formula: |Execution Price - Ideal Mid Price| / Ideal Mid Price * 100
	const impactCostPct = idealMidPrice > 0 ? +(Math.abs(fillWap - idealMidPrice) / idealMidPrice * 100).toFixed(3) : 0;
	const impactCostBps = +(impactCostPct * 100).toFixed(1);

	// Determine if slicing is recommended (TWAP slicing)
	const isSlicingRecommended = impactCostBps > maxAllowedImpactCostBps || quantity >= 5000;
	const recommendedSlices: OrderSlice[] = [];

	if (isSlicingRecommended) {
		const slicesCount = quantity >= 10000 ? 5 : 3;
		const sliceSize = Math.floor(quantity / slicesCount);
		const remainder = quantity % slicesCount;

		for (let i = 0; i < slicesCount; i++) {
			const qty = i === slicesCount - 1 ? sliceSize + remainder : sliceSize;
			recommendedSlices.push({
				sliceNumber: i + 1,
				quantity: qty,
				targetExchange: selectedExchange,
				estimatedLimitPrice: side === "BUY" ? alignToTick(fillWap * 1.002) : alignToTick(fillWap * 0.998),
				delaySecondsFromStart: i * 180, // 3-minute intervals (TWAP participation)
				suggestedOrderType: "LIMIT",
			});
		}
	} else {
		const selectedBestAsk = selectedExchange === "BSE" && bseBestAsk ? bseBestAsk : nseBestAsk;
		const selectedBestBid = selectedExchange === "BSE" && bseBestBid ? bseBestBid : nseBestBid;
		recommendedSlices.push({
			sliceNumber: 1,
			quantity,
			targetExchange: selectedExchange,
			estimatedLimitPrice: side === "BUY" ? alignToTick(selectedBestAsk) : alignToTick(selectedBestBid),
			delaySecondsFromStart: 0,
			suggestedOrderType: "LIMIT",
		});
	}

	// Broker routing recommendation
	const recommendedBroker: "UPSTOX" | "DHAN" = request.preferredBroker && request.preferredBroker !== "AUTO"
		? request.preferredBroker
		: selectedExchange === "BSE" ? "DHAN" : "UPSTOX";

	const brokerRationale = recommendedBroker === "UPSTOX"
		? "Routed via Upstox API v2: Optimal low-latency direct connectivity to NSE equity segment."
		: "Routed via Dhan HQ API: Superior BSE order routing and zero-brokerage delivery configuration.";

	return {
		engine_version: SOR_ENGINE_VERSION,
		calculation_timestamp: timestamp,
		symbol,
		side,
		totalQuantity: quantity,
		selectedPrimaryExchange: selectedExchange,
		bestExecutionPrice: fillWap,
		idealMidPrice: +idealMidPrice.toFixed(2),
		estimatedImpactCostBps: impactCostBps,
		estimatedImpactCostPct: impactCostPct,
		isSlicingRecommended,
		recommendedSlices,
		brokerRouting: {
			recommendedBroker,
			rationale: brokerRationale,
		},
		exchangeComparison: {
			nseBestBid,
			nseBestAsk,
			nseSpreadBps,
			bseBestBid,
			bseBestAsk,
			bseSpreadBps,
			bestExchangeReason: bestReason,
		},
		inputs_used: {
			symbol,
			side,
			quantity,
			hasBseBook: Boolean(bseBook),
		},
		formula_applied:
			"SEBI_IMPACT_COST = |FillWAP - IdealMid| / IdealMid * 10,000 bps | NBBO(NSE, BSE) | TWAP_Slice(3m intervals)",
		intermediate_steps: {
			fillWeightedAveragePrice: fillWap,
			liquidityDepthAvailable: relevantDepth.reduce((a, b) => a + b.quantity, 0),
			totalSlicesCount: recommendedSlices.length,
		},
	};
}

