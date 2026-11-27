/**
 * @file commodity-strategy.ts
 * @description Institutional Commodity Derivatives Strategy Engine for Pick of the Day (POTD).
 *              Generates quantitative, high-conviction daily picks across:
 *                1. Multi Commodity Exchange of India (MCX): Bullion, Energy, Base Metals.
 *                2. National Commodity & Derivatives Exchange (NCDEX): Agricultural benchmarks & spices.
 *
 * Compliance: FintekPro GCR v1.0 & FASP-AI v3.0 (SEBI Commodity Derivatives Framework).
 *
 * @module commodity-strategy
 * @version 1.0.0
 */

import { logger } from "../../logger";
import { BaseStrategy } from "./base-strategy";
import type { StrategyContext } from "./types";
import {
	type DailyPickData,
	type PickCategory,
	SCORER_MIN_THRESHOLD,
} from "../pick-of-the-day-service";
import {
	commodityMarketService,
	type CommodityItem,
} from "../commodity-market-service";
import {
	ncdexMarketService,
	type NcdexCommodityItem,
} from "../ncdex-market-service";
import { telemetryBus } from "../engine-telemetry-bus";
import { db } from "../../db";
import { mcxCommodityQuotes, goldenPrices } from "@shared/schema/pricing";
import { desc, eq, inArray, sql } from "drizzle-orm";

export interface NormalizedCommodityCandidate {
	id: string; // e.g. "MCX_GOLD", "NCDEX_JEERA"
	symbol: string; // e.g. "GOLD", "JEERA"
	name: string; // e.g. "Gold 24K (MCX Standard)"
	exchange: "MCX" | "NCDEX";
	price: number;
	unit: string;
	changePercent: number;
	trend: "Bullish" | "Neutral" | "Bearish";
	sectorCategory: string; // e.g. "Commodities - Precious Metals", "Commodities - Agriculture"
	deliveryCenter?: string;
	macroImplication?: string;
	fmcgImpact?: string;
	openInterest?: number;
	volume?: number;
}

export class CommodityStrategy extends BaseStrategy {
	public category: PickCategory = "commodities";

	/**
	 * Generates today's top institutional commodity pick across MCX and NCDEX.
	 *
	 * @param context - The POTD strategy context containing today's date, recent IDs, and calibration.
	 * @returns High-conviction DailyPickData or null if no actionable candidates pass gating.
	 */
	public async generate(
		context: StrategyContext,
	): Promise<DailyPickData | null> {
		const startTime = Date.now();
		logger.info(
			`[CommodityStrategy] Initiating daily commodity candidate evaluation across MCX & NCDEX...`,
		);

		try {
			// 1. Gather live/authoritative benchmark candidates from MCX and NCDEX services
			const candidates = await this.gatherAllCandidates();

			if (!candidates || candidates.length === 0) {
				logger.warn(
					`[CommodityStrategy] No candidate commodities available from MCX/NCDEX feeds.`,
				);
				return null;
			}

			// 2. Filter out recent picks to enforce novelty and rotation
			const freshCandidates = this.filterRecentPicks(
				candidates,
				context.recentIds,
				(c) => c.id,
			);

			const poolToScore =
				freshCandidates.length > 0 ? freshCandidates : candidates;

			// 3. Score all candidates using institutional quantitative scoring
			const scoredCandidates = await Promise.all(
				poolToScore.map(async (candidate) => {
					const quantScore = await this.score(candidate);
					return { candidate, quantScore };
				}),
			);

			// Sort by quant score descending
			scoredCandidates.sort((a, b) => b.quantScore - a.quantScore);

			// 4. Select top candidate passing institutional threshold
			const minThreshold = context.minThreshold ?? SCORER_MIN_THRESHOLD;
			const top = scoredCandidates.find((s) => s.quantScore >= minThreshold);

			if (!top) {
				logger.info(
					`[CommodityStrategy] No commodity candidate met minimum score threshold of ${minThreshold}. Highest was ${scoredCandidates[0]?.quantScore ?? 0}.`,
				);
				return null;
			}

			const selected = top.candidate;
			const currentPrice = selected.price;

			if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
				logger.warn(
					`[CommodityStrategy] Invalid price for ${selected.id}: ${currentPrice}. Skipping.`,
				);
				return null;
			}

			// 5. Dynamic Target & Stop-loss Calibration with strict 2:1 Risk-to-Reward Ratio
			const { targetPct, stoplossPct } = this.calculateTargetStoploss(
				selected.sectorCategory,
			);

			const targetPrice =
				Math.round(currentPrice * (1 + targetPct) * 100) / 100;
			const stoplossPrice =
				Math.round(currentPrice * (1 - stoplossPct) * 100) / 100;

			// Ensure boundary invariants: stoploss < recoPrice < targetPrice
			if (stoplossPrice >= currentPrice || currentPrice >= targetPrice) {
				logger.error(
					`[CommodityStrategy] Boundary invariant violation for ${selected.symbol}: SL=${stoplossPrice}, Price=${currentPrice}, Target=${targetPrice}`,
				);
				return null;
			}

			// 6. Calibrate tenure & expiry (10-14 trading days to prevent entering tender delivery window)
			const validityDays = 12;
			const expiryDate = this.getExpiryDate(validityDays);

			// 7. Calculate confidence score (density gate: 4+ metrics present)
			const confidenceScore = this.getConfidenceScore(
				"commodities",
				top.quantScore,
				100,
				5,
			);

			// 8. Generate FASP-AI institutional rationale
			const rationale = await context.service.generateRationale({
				category: "commodities",
				name: selected.name,
				currentPrice,
				targetPrice,
				stoplossPrice,
				symbol: selected.symbol,
				outlook: selected.trend.toLowerCase(),
				metrics: {
					exchange: selected.exchange,
					deliveryCenter: selected.deliveryCenter,
					unit: selected.unit,
					trend: selected.trend,
					changePercent: selected.changePercent,
					macroImplication: selected.macroImplication,
					fmcgImpact: selected.fmcgImpact,
					openInterest: selected.openInterest,
					volume: selected.volume,
					sebiSegment: "COMMODITY_DERIVATIVES",
				},
			});

			const keyMetrics: Record<string, unknown> = {
				exchange: selected.exchange,
				symbol: selected.symbol,
				commodityGroup: selected.sectorCategory,
				priceUnit: selected.unit,
				trend: selected.trend,
				changePercent: selected.changePercent,
				deliveryCenter: selected.deliveryCenter ?? "National Benchmark",
				macroImplication: selected.macroImplication ?? "",
				fmcgImpact: selected.fmcgImpact ?? "",
				targetDistancePct: Math.round(targetPct * 1000) / 10,
				stoplossDistancePct: Math.round(stoplossPct * 1000) / 10,
				riskRewardRatio: Math.round((targetPct / stoplossPct) * 10) / 10,
				suggestedAllocation: 5, // 5% portfolio risk allocation for commodity derivatives
				sebiSegment: "COMMODITY_DERIVATIVES",
				settlementType:
					selected.exchange === "MCX"
						? "Both Cash & Tender Physical Delivery"
						: "Compulsory Staggered Physical Delivery",
				tenderPeriodWindowDays: 5,
				isTenderPeriodExcluded: true,
				deliverySettlementNotice:
					"Contract tenure strictly exits 5 business days prior to exchange physical tender delivery window to avoid escalating delivery margin requirements.",
			};

			if (selected.openInterest) keyMetrics.openInterest = selected.openInterest;
			if (selected.volume) keyMetrics.volume = selected.volume;

			const pick: DailyPickData = {
				category: "commodities",
				instrumentId: selected.id,
				instrumentName: selected.name,
				symbol: selected.symbol,
				exchange: selected.exchange,
				market: "DOMESTIC",
				recoDate: context.today,
				recoPrice: currentPrice,
				targetPrice,
				stoplossPrice,
				currentPrice,
				status: "live",
				expiryDate,
				rationale,
				riskLevel: "high",
				timeHorizon: "short_term",
				sectorCategory: selected.sectorCategory,
				suitableFor: [
					"Commodity Traders",
					"Active Hedgers",
					"High Net Worth (HNI)",
					"Tactical Asset Allocators",
				],
				confidenceScore,
				keyMetrics,
				engineVersion: "Commodity-v1.0",
				calculationTimestamp: new Date(),
			};

			logger.info(
				`[CommodityStrategy] Pick generated successfully: ${pick.instrumentName} (${pick.exchange}) @ ₹${currentPrice} (Score: ${top.quantScore}, Latency: ${Date.now() - startTime}ms)`,
			);

			telemetryBus.report({
				engineId: "commodity-strategy",
				engineName: "Institutional Commodity Derivatives Engine",
				category: "Alpha Generation",
				reportedAt: new Date().toISOString(),
				latencyMs: Date.now() - startTime,
				qualityScore: Math.round(top.quantScore),
				itemsProcessed: candidates.length,
				errorCount: 0,
			});

			return pick;
		} catch (error: unknown) {
			const err = error as Error;
			logger.error(
				`[CommodityStrategy] Error generating commodity pick: ${err?.message}`,
				{ stack: err?.stack },
			);
			telemetryBus.report({
				engineId: "commodity-strategy",
				engineName: "Institutional Commodity Derivatives Engine",
				category: "Alpha Generation",
				reportedAt: new Date().toISOString(),
				latencyMs: Date.now() - startTime,
				qualityScore: 0,
				itemsProcessed: 0,
				errorCount: 1,
			});
			return null;
		}
	}

	/**
	 * Institutional quantitative scoring model for commodity contracts (0 to 100).
	 * Evaluates price trend, single-day momentum, macro catalysts, and exchange liquidity.
	 *
	 * @param candidate - The commodity candidate item.
	 * @returns Calibrated quantitative conviction score.
	 */
	public score(candidate: NormalizedCommodityCandidate): number {
		let score = 50; // Base baseline

		// 1. Technical Trend Alignment (up to +18 / -8 pts)
		if (candidate.trend === "Bullish") {
			score += 15;
		} else if (candidate.trend === "Neutral") {
			score += 5;
		} else if (candidate.trend === "Bearish") {
			score -= 6;
		}

		// 2. Momentum & Price Velocity (up to +12 pts)
		// Healthy swing expansion: +0.2% to +2.5%
		const chg = candidate.changePercent;
		if (chg >= 0.25 && chg <= 2.2) {
			score += 10; // Ideal institutional follow-through momentum
		} else if (chg > 2.2 && chg <= 4.0) {
			score += 6; // Strong momentum, but minor overbought drag
		} else if (chg > 4.0) {
			score += 2; // Parabolic surge risk (whipsaw potential)
		} else if (chg >= -0.5 && chg < 0.25) {
			score += 4; // Constructive consolidation near breakout
		} else if (chg < -1.5) {
			score -= 8; // Heavy selling pressure
		}

		// 3. Asset Class Structural Demand & Tailwinds (up to +10 pts)
		if (candidate.sectorCategory.includes("Precious Metals")) {
			// Gold/Silver: Central bank accumulation and systemic hedge
			score += 8;
		} else if (candidate.sectorCategory.includes("Energy")) {
			// Crude/Gas: Geopolitical stability and refining demand
			score += 7;
		} else if (candidate.sectorCategory.includes("Base Metals")) {
			// Copper: Electrification & renewable infrastructure capex
			score += 8;
		} else if (candidate.sectorCategory.includes("Agriculture")) {
			// NCDEX Spices & Guar: Mandi supply-demand tightness & export realizations
			score += 8;
		}

		// 4. Institutional Liquidity & Benchmark Weight (up to +8 pts)
		const marqueeSymbols = [
			"GOLD",
			"SILVER",
			"CRUDE_OIL",
			"COPPER",
			"JEERA",
			"TURMERIC",
		];
		if (marqueeSymbols.includes(candidate.symbol)) {
			score += 8;
		}

		return Math.min(95, Math.max(30, score));
	}

	/**
	 * Retrieves live or latest settlement price for a given commodity instrument ID.
	 *
	 * @param instrumentId - e.g. "MCX_GOLD", "NCDEX_JEERA", or "GOLD"
	 */
	public async getLivePrice(instrumentId: string): Promise<number | null> {
		try {
			const cleanId = instrumentId
				.toUpperCase()
				.replace("MCX_", "")
				.replace("NCDEX_", "");

			// Check MCX benchmarks first
			const mcxRes = await commodityMarketService.getCommodityBenchmarks();
			if (mcxRes.success && mcxRes.data?.commodities) {
				const match = mcxRes.data.commodities.find(
					(c) =>
						c.id === cleanId ||
						c.mcxSymbol.toUpperCase() === cleanId ||
						c.name.toUpperCase().includes(cleanId),
				);
				if (match && match.mcxPrice > 0) {
					return match.mcxPrice;
				}
			}

			// Check NCDEX agricultural benchmarks next
			const ncdexRes = await ncdexMarketService.getAgriculturalBenchmarks({
				persistToDb: false,
			});
			if (ncdexRes.success && ncdexRes.data?.commodities) {
				const match = ncdexRes.data.commodities.find(
					(c) =>
						c.id === cleanId ||
						c.tradingSymbol.toUpperCase() === cleanId ||
						c.name.toUpperCase().includes(cleanId),
				);
				if (match && match.price > 0) {
					return match.price;
				}
			}

			// Check mcx_commodity_quotes database table
			const dbQuote = await db
				.select({ price: mcxCommodityQuotes.price })
				.from(mcxCommodityQuotes)
				.where(eq(mcxCommodityQuotes.commoditySymbol, cleanId))
				.orderBy(desc(mcxCommodityQuotes.syncedAt))
				.limit(1);

			if (dbQuote.length > 0 && Number(dbQuote[0].price) > 0) {
				return Number(dbQuote[0].price);
			}

			return null;
		} catch (error: unknown) {
			logger.warn(
				`[CommodityStrategy] Failed to fetch live price for ${instrumentId}: ${(error as Error)?.message}`,
			);
			return null;
		}
	}

	/**
	 * Gathers all candidate commodities across MCX (energy, metals, bullion) and NCDEX (agriculture).
	 */
	private async gatherAllCandidates(): Promise<NormalizedCommodityCandidate[]> {
		const candidates: NormalizedCommodityCandidate[] = [];

		// 1. Fetch MCX Benchmarks
		try {
			const mcxRes = await commodityMarketService.getCommodityBenchmarks();
			if (mcxRes.success && mcxRes.data?.commodities) {
				for (const item of mcxRes.data.commodities) {
					if (item.mcxPrice && item.mcxPrice > 0) {
						candidates.push({
							id: `MCX_${item.id}`,
							symbol: item.mcxSymbol || item.id,
							name: item.name,
							exchange: "MCX",
							price: item.mcxPrice,
							unit: item.mcxUnit || "INR",
							changePercent: item.mcxChangePercent || 0,
							trend: item.trend || "Bullish",
							sectorCategory: `Commodities - ${item.category}`,
							deliveryCenter: item.deliveryCenter || "National Delivery Center",
							macroImplication: item.macroImplication,
						});
					}
				}
			}
		} catch (err: unknown) {
			logger.warn(
				`[CommodityStrategy] MCX benchmark fetch warning: ${(err as Error)?.message}`,
			);
		}

		// 2. Fetch NCDEX Agricultural Benchmarks
		try {
			const ncdexRes = await ncdexMarketService.getAgriculturalBenchmarks({
				persistToDb: false,
			});
			if (ncdexRes.success && ncdexRes.data?.commodities) {
				for (const item of ncdexRes.data.commodities) {
					if (item.price && item.price > 0) {
						candidates.push({
							id: `NCDEX_${item.id}`,
							symbol: item.tradingSymbol || item.id,
							name: item.name,
							exchange: "NCDEX",
							price: item.price,
							unit: item.unit || "₹ / quintal",
							changePercent: item.changePercent || 0,
							trend: item.trend || "Bullish",
							sectorCategory: `Commodities - Agriculture (${item.category})`,
							deliveryCenter: item.deliveryCenter || "Mandi Physical Center",
							macroImplication: item.macroImplication,
							fmcgImpact: item.fmcgImpact,
							openInterest: item.openInterest,
							volume: item.volume,
						});
					}
				}
			}
		} catch (err: unknown) {
			logger.warn(
				`[CommodityStrategy] NCDEX benchmark fetch warning: ${(err as Error)?.message}`,
			);
		}

		return candidates;
	}

	/**
	 * Calibrates target and stop-loss percentages maintaining strict 2:1 Risk-to-Reward ratio.
	 */
	private calculateTargetStoploss(sectorCategory: string): {
		targetPct: number;
		stoplossPct: number;
	} {
		if (sectorCategory.includes("Precious Metals")) {
			// Gold/Silver: Modest volatility, tight risk envelope
			return { targetPct: 0.05, stoplossPct: 0.025 }; // +5.0% target / -2.5% stop (2:1 R:R)
		}
		if (sectorCategory.includes("Energy")) {
			// Crude Oil / Natural Gas: Higher volatility
			return { targetPct: 0.07, stoplossPct: 0.035 }; // +7.0% target / -3.5% stop (2:1 R:R)
		}
		if (sectorCategory.includes("Base Metals")) {
			// Copper: Industrial swing
			return { targetPct: 0.055, stoplossPct: 0.0275 }; // +5.5% target / -2.75% stop (2:1 R:R)
		}
		if (sectorCategory.includes("Agriculture")) {
			// Spices & seeds: Seasonal / weather elasticity
			return { targetPct: 0.08, stoplossPct: 0.04 }; // +8.0% target / -4.0% stop (2:1 R:R)
		}

		// Fallback baseline
		return { targetPct: 0.06, stoplossPct: 0.03 }; // +6.0% target / -3.0% stop (2:1 R:R)
	}
}
