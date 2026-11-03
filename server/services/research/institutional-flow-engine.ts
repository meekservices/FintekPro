/**
 * @file institutional-flow-engine.ts
 * @description Institutional Ownership & Block/Bulk Deal Footprint Engine for FintekPro.
 *              Analyzes regulatory disclosures from NSE/BSE:
 *              - Block & Bulk Deals (>₹10 Cr or >0.5% equity)
 *              - Mutual Fund Month-over-Month (MoM) Accumulation/Distribution
 *              - Promoter Pledging & SAST Insider Buying/Selling Alerts
 *
 * GCR v1.0 & FASP-AI v1.0 Compliance:
 * - Deterministic Output: Same disclosure inputs ALWAYS produce identical sentiment scores & alerts.
 * - Every payload exposes engine_version, calculation_timestamp, inputs_used, formula_applied, intermediate_steps.
 * - Strict TypeScript typing with zero unverified any.
 * - JSDoc documentation on all exported functions.
 */

export const INSTITUTIONAL_FLOW_ENGINE_VERSION = "1.0.0";

export interface BlockDealRecord {
	date: string;
	clientName: string;
	dealType: "BUY" | "SELL";
	quantity: number;
	tradePrice: number;
	valueInrCrores: number;
	isFiiOrDii: boolean; // Foreign or Domestic Institutional Investor
}

export interface InstitutionalFlowInput {
	symbol: string;
	blockDeals30d: BlockDealRecord[];
	promoterPledgePct?: number; // e.g. 15.5%
	promoterHoldingChangeMoM?: number; // e.g. +0.45% or -1.2%
	mutualFundHoldingChangeMoM?: number; // e.g. +1.1%
	fiiHoldingChangeQoQ?: number; // e.g. +0.8%
}

export interface InstitutionalFlowResult {
	engine_version: string;
	calculation_timestamp: string;
	symbol: string;
	institutionalSentimentScore: number; // 0 - 100
	classification:
		| "STRONG_INSTITUTIONAL_ACCUMULATION"
		| "MODERATE_INFLOW"
		| "NEUTRAL_BALANCED"
		| "INSTITUTIONAL_DISTRIBUTION"
		| "PROMOTER_PLEDGE_RED_FLAG";
	blockDealSummary: {
		totalBlockBuyValueCr: number;
		totalBlockSellValueCr: number;
		netBlockFlowCr: number;
		dominantBuyer?: string;
		dominantSeller?: string;
	};
	alerts: {
		type: "BULLISH_INSIDER" | "BULLISH_BLOCK" | "BEARISH_DUMP" | "PLEDGE_RISK" | "NEUTRAL";
		message: string;
	}[];
	inputs_used: {
		symbol: string;
		blockDealsCount: number;
		promoterPledgePct: number | null;
	};
	formula_applied: string;
	intermediate_steps: {
		netInstitutionalFlowCr: number;
		promoterPledgeRiskLevel: string;
		fundConvictionScore: number;
	};
	explanation: string;
}

/**
 * Analyzes institutional ownership and block/bulk deal flows for a given symbol.
 *
 * @param input - Block deal transactions, promoter pledging %, and MF holding changes
 * @param customTimestamp - Evaluation timestamp (defaults to current date)
 * @returns Complete institutional footprint analysis and smart-money conviction score
 */
export function analyzeInstitutionalFlow(
	input: InstitutionalFlowInput,
	customTimestamp?: string,
): InstitutionalFlowResult {
	const timestamp = customTimestamp || new Date().toISOString();
	const { symbol, blockDeals30d, promoterPledgePct, promoterHoldingChangeMoM, mutualFundHoldingChangeMoM } = input;

	let totalBuyCr = 0;
	let totalSellCr = 0;
	let dominantBuyer: string | undefined;
	let dominantSeller: string | undefined;
	let maxBuyVal = 0;
	let maxSellVal = 0;

	for (const deal of blockDeals30d) {
		if (deal.dealType === "BUY") {
			totalBuyCr += deal.valueInrCrores;
			if (deal.valueInrCrores > maxBuyVal) {
				maxBuyVal = deal.valueInrCrores;
				dominantBuyer = deal.clientName;
			}
		} else {
			totalSellCr += deal.valueInrCrores;
			if (deal.valueInrCrores > maxSellVal) {
				maxSellVal = deal.valueInrCrores;
				dominantSeller = deal.clientName;
			}
		}
	}

	const netBlockFlowCr = +(totalBuyCr - totalSellCr).toFixed(2);
	const alerts: Array<{ type: "BULLISH_INSIDER" | "BULLISH_BLOCK" | "BEARISH_DUMP" | "PLEDGE_RISK" | "NEUTRAL"; message: string }> = [];

	let score = 50; // Neutral baseline

	// 1. Block Deal Flow Impact
	if (netBlockFlowCr >= 25.0) {
		score += 20;
		alerts.push({
			type: "BULLISH_BLOCK",
			message: `Net Institutional Block Inflow: +₹${netBlockFlowCr} Cr over 30 days` + (dominantBuyer ? ` led by ${dominantBuyer}.` : "."),
		});
	} else if (netBlockFlowCr <= -25.0) {
		score -= 20;
		alerts.push({
			type: "BEARISH_DUMP",
			message: `Heavy Institutional Block Selling: Net -₹${Math.abs(netBlockFlowCr)} Cr outflow over 30 days.`,
		});
	}

	// 2. Promoter Pledging Risk
	let pledgeRisk = "LOW";
	if (promoterPledgePct != null) {
		if (promoterPledgePct >= 25.0) {
			pledgeRisk = "CRITICAL";
			score -= 25;
			alerts.push({
				type: "PLEDGE_RISK",
				message: `High Promoter Pledging Alert: ${promoterPledgePct}% of promoter shares are encumbered. Significant margin call/liquidation risk.`,
			});
		} else if (promoterPledgePct >= 10.0) {
			pledgeRisk = "MODERATE";
			score -= 8;
		}
	}

	// 3. Insider Buying / Promoter Change
	if (promoterHoldingChangeMoM != null) {
		if (promoterHoldingChangeMoM >= 0.25) {
			score += 15;
			alerts.push({
				type: "BULLISH_INSIDER",
				message: `Promoter Stake Increase: Promoters raised holding by +${promoterHoldingChangeMoM}% via open market purchases.`,
			});
		} else if (promoterHoldingChangeMoM <= -0.50) {
			score -= 15;
			alerts.push({
				type: "BEARISH_DUMP",
				message: `Promoter Stake Reduction: Promoters trimmed stake by ${promoterHoldingChangeMoM}%. Caution advised.`,
			});
		}
	}

	// 4. Mutual Fund Holding MoM Conviction
	let fundScore = 50;
	if (mutualFundHoldingChangeMoM != null) {
		if (mutualFundHoldingChangeMoM >= 0.50) {
			score += 12;
			fundScore = 85;
		} else if (mutualFundHoldingChangeMoM <= -0.50) {
			score -= 12;
			fundScore = 25;
		}
	}

	// Clamp final score
	score = Math.min(100, Math.max(0, Math.round(score)));

	let classification:
		| "STRONG_INSTITUTIONAL_ACCUMULATION"
		| "MODERATE_INFLOW"
		| "NEUTRAL_BALANCED"
		| "INSTITUTIONAL_DISTRIBUTION"
		| "PROMOTER_PLEDGE_RED_FLAG" = "NEUTRAL_BALANCED";

	if (pledgeRisk === "CRITICAL") {
		classification = "PROMOTER_PLEDGE_RED_FLAG";
	} else if (score >= 75) {
		classification = "STRONG_INSTITUTIONAL_ACCUMULATION";
	} else if (score >= 60) {
		classification = "MODERATE_INFLOW";
	} else if (score <= 35) {
		classification = "INSTITUTIONAL_DISTRIBUTION";
	}

	if (alerts.length === 0) {
		alerts.push({
			type: "NEUTRAL",
			message: "Institutional holdings and block flows are balanced within normal variance.",
		});
	}

	const explanation = `Institutional Sentiment: ${classification.replace(/_/g, " ")} (${score}/100). Net Block Flow: ₹${netBlockFlowCr > 0 ? "+" : ""}${netBlockFlowCr} Cr.` +
		(promoterPledgePct ? ` Promoter Pledge: ${promoterPledgePct}%.` : "");

	return {
		engine_version: INSTITUTIONAL_FLOW_ENGINE_VERSION,
		calculation_timestamp: timestamp,
		symbol,
		institutionalSentimentScore: score,
		classification,
		blockDealSummary: {
			totalBlockBuyValueCr: +totalBuyCr.toFixed(2),
			totalBlockSellValueCr: +totalSellCr.toFixed(2),
			netBlockFlowCr,
			dominantBuyer,
			dominantSeller,
		},
		alerts,
		inputs_used: {
			symbol,
			blockDealsCount: blockDeals30d.length,
			promoterPledgePct: promoterPledgePct ?? null,
		},
		formula_applied:
			"INSTITUTIONAL_FOOTPRINT_V1 = NetBlockFlow_30d(Cr) + PromoterPledgePenalty + InsiderHoldingDelta + MfHoldingDelta",
		intermediate_steps: {
			netInstitutionalFlowCr: netBlockFlowCr,
			promoterPledgeRiskLevel: pledgeRisk,
			fundConvictionScore: fundScore,
		},
		explanation,
	};
}

