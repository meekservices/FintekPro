import { logger } from "../logger";
import { db } from "../db";
import {
	dailyPicks,
	listedStocks,
	mutualFunds,
	bondCatalog,
	unlistedCompanies,
	companyRatios,
	companyFinancials,
	globalInstruments,
	instrumentMaster,
	sgbPrimaryIssues,
	stockFinancialMetrics,
	reits,
	invits,
	pickWatchlist,
	userNotifications,
	goldenPrices,
} from "@shared/schema";
import { eq, and, desc, gte, sql, ilike, or, asc, inArray } from "drizzle-orm";
import { unifiedAIRecommendationEngine } from "./unified-ai-recommendation-engine";
import {
	isFundInvestable,
	isETFInvestable,
	logFilteredInstrument,
} from "./regulatory-investability-service";
import {
	getEnrichedStockSnapshot,
	getEnrichedStockSnapshots,
} from "./screener/enriched-stock-data";
import type { EnrichedStockSnapshot } from "./screener/enriched-stock-data";
import { marketRegimeDetector } from "./risk";
import { aiGovernanceEngine } from "./ai-governance";
import { marketHolidayService } from "./market-holiday-service";
import { FaspAIv2Service } from "./fasp-ai-v2-service";
import { pickOutcomeAnalyzer } from "./pick-outcome-analyzer";

// --- Strategy Imports ---
import { IPickStrategy } from "./picks/types";
import { StockStrategy } from "./picks/stock-strategy";
import { MutualFundStrategy } from "./picks/mutual-fund-strategy";
import { UnlistedStrategy } from "./picks/unlisted-strategy";
import { BondStrategy } from "./picks/bond-strategy";
import { DerivativeStrategy } from "./picks/derivative-strategy";
import { GlobalStockStrategy } from "./picks/global-stock-strategy";
import { ETFStrategy } from "./picks/etf-strategy";
import { SGBStrategy } from "./picks/sgb-strategy";
import { REITInvITStrategy } from "./picks/reit-invit-strategy";
import { FixedDepositStrategy } from "./picks/fixed-deposit-strategy";

export type PickCategory =
	| "listed_stocks"
	| "mutual_funds"
	| "bonds"
	| "unlisted"
	| "global_stocks"
	| "etfs"
	| "reits_invits"
	| "fixed_deposits"
	| "sgb"
	| "derivatives";

export type PickStatus = "live" | "target_hit" | "stoploss_hit" | "expired";

export const SCORER_VERSION = "3.0.0";
export const SCORER_MIN_THRESHOLD = 15;
/** FASP-AI protocol version applied to all pick advisory outputs */
const FASP_AI_VERSION = "FASP-AI-v3.0" as const;

// ── Fix E: Structured rationale cache ─────────────────────────────────────────
// Stores AI-generated structured advisory notes keyed by rationale text.
// Populated by extractRationaleText() when Gemini returns the new JSON schema.
const _structuredRationaleCache = new Map<string, {
	buyThesis: string;
	keyRisks: string[];
	catalysts: string[];
	timeHorizonRationale: string;
}>();

// ── Fix M: Generation telemetry log ───────────────────────────────────────────
// Rolling in-memory store of the last 7 generation run summaries.
// Exposed via GET /api/agent/picks/generation-log/:date.
interface GenerationLogEntry {
	date: string;
	startedAt: string;
	completedAt: string;
	regime: "NORMAL" | "BLACK_SWAN";
	picksGenerated: number;
	sectorGateBlocked: number;
	categoriesAttempted: string[];
	categoryResults: Record<string, { status: "success" | "skipped" | "error"; instrument?: string; sector?: string }>;
	geminiCircuitOpen: boolean;
}
const _generationLog: GenerationLogEntry[] = [];

/**
 * Returns today's date string in IST (YYYY-MM-DD).
 * Cloud Run containers run in UTC — using toISOString() would return the
 * wrong date between midnight IST and 5:30 AM UTC.
 * This helper uses pure UTC arithmetic: IST = UTC + 5h30m.
 */
function todayIST(): string {
	const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
	const nowIst = new Date(Date.now() + IST_OFFSET_MS);
	return nowIst.toISOString().split("T")[0];
}

export interface ScoreBreakdown {
	listingStageScore: number;
	pricingScore: number;
	sectorScore: number;
	governanceScore: number;
	riskAdjustment: number;
	fundamentalsScore: number;
	totalScore: number;
	scoringVersion: string;
	threshold: number;
	rankPosition?: number;
	totalCandidatesEvaluated?: number;
	eligibleCandidates?: number;
	riskBand?: "Moderate" | "Growth" | "HighConviction";
}

export interface RationaleParams {
	name: string;
	category: PickCategory | string;
	currentPrice: number;
	targetPrice: number;
	stoplossPrice?: number;
	symbol?: string;
	strategy?: string;
	outlook?: string;
	metrics?: Record<string, any>;
}

export interface PickUpdateResult {
	updated: number;
	errors: number;
	details?: string[];
}

export interface DailyPickData {
	id?: number;
	category: PickCategory;
	instrumentId?: string;
	instrumentName: string;
	isin?: string;
	symbol?: string;
	market?: string;
	exchange?: string;
	recoDate: string;
	recoPrice: number;
	targetPrice: number;
	stoplossPrice: number;
	currentPrice?: number;
	status: PickStatus;
	expiryDate: string;
	returnPct?: number;
	daysHeld?: number;
	rationale: string;
	riskLevel: string;
	suitableFor: string[];
	keyMetrics?: {
		pe?: number;
		returns1y?: number;
		returns3y?: number;
		volatility?: number;
		sharpeRatio?: number;
		yield?: number;
		rating?: string;
		[key: string]: any;
	};
	timeHorizon?: string;
	confidenceScore?: number;
	sectorCategory?: string;
	updatedAt?: Date | string;
	statusUpdatedAt?: Date | string;
	scoringBreakdown?: ScoreBreakdown;
	riskScore?: number;
}

export function calculateSuggestedAllocation(
	category: string,
	riskLevel: string,
	confidenceScore?: number,
	keyMetrics?: any,
): number {
	if (keyMetrics?.suggestedAllocation != null) {
		return Number.parseFloat(keyMetrics.suggestedAllocation);
	}

	const mcap = (keyMetrics?.marketCap || "").toLowerCase();
	const risk = (riskLevel || "medium").toLowerCase();
	const confidence = confidenceScore ?? 70;
	const isStockOrFund = [
		"listed_stocks",
		"global_stocks",
		"unlisted",
		"mutual_funds",
		"etfs",
	].includes(category);

	if (isStockOrFund) {
		if ((mcap.includes("large") || risk === "low") && confidence >= 80)
			return 10;
		if (mcap.includes("large") || risk === "low") return 8;
		if ((mcap.includes("mid") || risk === "medium") && confidence >= 80)
			return 8;
		if (mcap.includes("mid") || risk === "medium") return 6;
		if ((mcap.includes("small") || risk === "high") && confidence >= 80)
			return 5;
		return 3;
	}

	if (risk === "low") return 10;
	if (risk === "medium") return 5;
	return 2;
}

export class PickOfTheDayService {
	private strategies: Map<PickCategory, IPickStrategy>;
	private _isGenerating = false;
	private readonly DEFAULT_VALIDITY_DAYS = 30;

	// ── Redis client (shared circuit-breaker client) ───────────────────────────
	private _redis: any = null; // kept for backwards-compat reference only
	private async getRedis(): Promise<any> {
		const { getSharedRedis } = await import("../utils/redis-client");
		return getSharedRedis();
	}

	constructor() {
		this.strategies = new Map();
		this.strategies.set("listed_stocks", new StockStrategy());
		this.strategies.set("mutual_funds", new MutualFundStrategy());
		this.strategies.set("unlisted", new UnlistedStrategy());
		this.strategies.set("bonds", new BondStrategy());
		this.strategies.set("derivatives", new DerivativeStrategy());
		this.strategies.set("global_stocks", new GlobalStockStrategy());
		this.strategies.set("etfs", new ETFStrategy());
		this.strategies.set("sgb", new SGBStrategy());
		this.strategies.set("reits_invits", new REITInvITStrategy());
		this.strategies.set("fixed_deposits", new FixedDepositStrategy());
	}

	private getStrategy(category: PickCategory): IPickStrategy {
		const strategy = this.strategies.get(category);
		if (!strategy)
			throw new Error(`No strategy found for category: ${category}`);
		return strategy;
	}

	async generateDailyPicks(): Promise<DailyPickData[]> {
		// ── Generation lock: prevent concurrent runs (cold-start race on Cloud Run)
		if (this._isGenerating) {
			logger.warn(
				"[PickOfTheDay] generateDailyPicks() called while already running — skipping duplicate.",
			);
			return [];
		}
		this._isGenerating = true;
		try {
			return await this._doGenerateDailyPicks();
		} finally {
			this._isGenerating = false;
		}
	}

	/** Internal: the actual generation logic. Always call via generateDailyPicks(). */
	private async _doGenerateDailyPicks(): Promise<DailyPickData[]> {
		logger.info(
			`[PickOfTheDay] Starting daily pick generation (v${SCORER_VERSION})...`,
		);
		const generated: DailyPickData[] = [];
		const today = todayIST();

		// 1. Systemic Resilience Check: Detect Black Swan Regime
		const isBlackSwan = marketRegimeDetector.detectBlackSwanEvent();

		// Ordered by priority
		let categories: PickCategory[] = [
			"listed_stocks",
			"mutual_funds",
			"bonds",
			"unlisted",
			"global_stocks",
			"etfs",
			"reits_invits",
			"sgb",
			"fixed_deposits",
			"derivatives",
		];

		if (isBlackSwan) {
			logger.warn(
				`🛑 [PickOfTheDay] 10σ Black Swan detected. Pivoting to Defensive Advasory mode.`,
			);
			// Restriction: Only safe-haven/defensive assets allowed during systemic instability
			categories = ["sgb", "bonds", "fixed_deposits", "mutual_funds"];
		}

		for (const category of categories) {
			try {
				const strategy = this.getStrategy(category);
				const recentIds = await this.getRecentlyPickedIds(category);

				const result = await strategy.generate({
					today,
					regime: isBlackSwan ? "BLACK_SWAN" : "NORMAL",
					recentIds,
					service: this,
				});

				// StockStrategy now returns DailyPickData[] (one per sector).
				// All other strategies still return DailyPickData | null.
				const picks: DailyPickData[] = Array.isArray(result)
					? result
					: result
						? [result]
						: [];

				for (const pick of picks) {
					// ── FASP-AI v2.0: Compute multi-factor confidence ──────────────────────
					const rawScore = Math.max(pick.confidenceScore ?? 60, 60); // 0–100
					const confidence = FaspAIv2Service.computeConfidence({
						responseLength: (pick.rationale ?? "").length,
						hasStructuredData: true, // picks are fully structured
						factorCount: 4 + (pick.sectorCategory ? 1 : 0) + (pick.timeHorizon ? 1 : 0),
						userSegment: "retail", // picks are retail-facing by default
						marketVolatility: isBlackSwan ? "high" : "normal",
					});

					const governanceOutput = {
						recommendation: pick.rationale,
						// Governance engine expects 0–1 scale (AAGE uses >=0.6 floor)
						confidence_score: rawScore / 100,
						factors_considered: [
							`category: ${pick.category}`,
							`riskLevel: ${pick.riskLevel}`,
							`recoPrice: ${pick.recoPrice}`,
							`targetPrice: ${pick.targetPrice}`,
							...(pick.sectorCategory ? [`sector: ${pick.sectorCategory}`] : []),
							...(pick.timeHorizon ? [`horizon: ${pick.timeHorizon}`] : []),
							...((pick.keyMetrics as any)?.broadSectorLabel
								? [`broadSector: ${(pick.keyMetrics as any).broadSectorLabel}`]
								: []),
						],
						// FASP-AI v2.0 metadata
						model_version: FASP_AI_VERSION,
						scorer_version: SCORER_VERSION,
						engine_version: "fasp-engine-v3.0",
						base_model: "gemini-2.5-flash",
						sebi_circular_ref: FaspAIv2Service.getSebiRef("stock_pick"),
						confidence_threshold: confidence.threshold,
						meets_threshold: confidence.meetsThreshold,
						human_review_required: confidence.humanReviewRequired,
						timestamp: new Date().toISOString(),
					};

					const aageCheck = await aiGovernanceEngine.validateAndResolve({
						user_id: "SYSTEM_ADVISORY",
						query: `Generate ${category} pick for ${today}`,
						ai_output: governanceOutput,
						user_profile: {
							risk_profile: (isBlackSwan
								? "conservative"
								: "aggressive") as any,
							investment_horizon: "medium",
							kyc_status: "verified",
							user_segment: "retail",
						},
						trace_id: `POTD-${category}-${(pick.keyMetrics as any)?.broadSector ?? "all"}-${today}`,
					});

					if (aageCheck.decision === "BLOCK") {
						logger.warn(
							`⚠️ [PickOfTheDay] Governance Block for ${pick.instrumentName}: ${aageCheck.audit_id}`,
						);
						continue;
					}

					// ── Signal Quality Gate ─────────────────────────────────────────────
					// Only publish BUY / STRONG_BUY picks to the daily_picks feed.
					// HOLD signals are valid research signals but NOT actionable picks —
					// they belong in the research watchlist, not the picks feed.
					const pickSignal: string = (pick.keyMetrics as any)?.signal
						?? (pick.keyMetrics as any)?.recommendation
						?? "buy"; // default to buy if not tagged (legacy picks)

					const isActionable =
						pickSignal === "strong_buy" || pickSignal === "buy";

					if (!isActionable) {
						logger.info(
							`[PickOfTheDay] Skipping non-actionable pick ${pick.instrumentName} (signal: ${pickSignal}) — redirected to watchlist`,
							{ instrument: pick.instrumentName, signal: pickSignal, category },
						);
						continue; // skip saving to daily_picks
					}

					// ── Minimum Upside Filter ──────────────────────────────────────────
					// A pick must have meaningful upside to justify BUY rating.
					// Minimum: stocks ≥12%, mutual_funds ≥8%, bonds/others ≥5%
					const minUpsidePct: Record<string, number> = {
						stocks: 12,
						equity: 12,
						mutual_funds: 8,
						bonds: 5,
						debt: 5,
					};
					const minUpside = minUpsidePct[category] ?? 8;
					const recoP = Number(pick.recoPrice ?? 0);
					const targetP = Number(pick.targetPrice ?? 0);
					const upsidePct =
						recoP > 0 ? ((targetP - recoP) / recoP) * 100 : 99;

					if (upsidePct < minUpside) {
						logger.info(
							`[PickOfTheDay] Skipping low-upside pick ${pick.instrumentName} (${upsidePct.toFixed(1)}% < min ${minUpside}%)`,
							{ instrument: pick.instrumentName, upsidePct, minUpside, category },
						);
						continue;
					}

					// ── Add portfolio_signal metadata ─────────────────────────────────
					// Gives portfolio construction engine precise signals beyond BUY/HOLD.
					const portfolioSignal = {
						action:
							pickSignal === "strong_buy" ? "accumulate" : "initiate",
						allocation_bias:
							pickSignal === "strong_buy" ? "overweight" : "neutral",
						conviction: pickSignal === "strong_buy" ? "high" : "medium",
						portfolio_category:
							pickSignal === "strong_buy" ? "core" : "tactical",
						upside_pct: Math.round(upsidePct * 10) / 10,
						min_upside_threshold: minUpside,
						fintekpro_rating:
							pickSignal === "strong_buy" ? 5 : 4,
						suitable_for:
							pickSignal === "strong_buy"
								? ["equity_growth", "hni_aggressive", "retail_high_risk"]
								: ["equity_growth", "retail_moderate"],
					};
					// Attach portfolio signal and raw quant score to keyMetrics
					if (pick.keyMetrics && typeof pick.keyMetrics === "object") {
						(pick.keyMetrics as any).portfolio_signal = portfolioSignal;

						// ── Fix A: rawQuantScore — strategy-sourced value takes priority ────────
						// stock-strategy sets rawQuantScore directly (pre-governance-floor).
						// For bonds/MFs that don't set it, fall back to the confidenceScore proxy.
						const km = pick.keyMetrics as any;
						if (km.rawQuantScore == null) {
							const rawQ = Math.min(
								100,
								Math.max(0, Math.round(((pick.confidenceScore ?? 60) - 60) / 40 * 100)),
							);
							km.rawQuantScore = rawQ;
						}
						if (km.qualityTier == null) {
							const rq = km.rawQuantScore as number;
							km.qualityTier =
								rq >= 80 ? "Premium"
								: rq >= 60 ? "Strong"
								: rq >= 40 ? "Good"
								: "Weak";
						}
					}

					// ── Dedup guard: prevent duplicate same-name picks per category per day ──
					// Protects against derivative/SGB races where both generate() and
					// generateFallbackPick() produce the same instrumentName on the same day.
					const isDuplicate = generated.some(
						(g) => g.category === pick.category && g.instrumentName === pick.instrumentName,
					);
					if (isDuplicate) {
						logger.info(
							`[PickOfTheDay] Dedup: skipping duplicate ${pick.category} pick "${pick.instrumentName}"`,
						);
						continue;
					}

					await this.savePick(pick);

					// ── FASP-AI v2.0: Persist to immutable advisory audit trail ──────────
					FaspAIv2Service.logAdvisoryOutput({
						advisoryType: "stock_pick",
						inputContext: {
							category,
							instrument: pick.instrumentName,
							sector: pick.sectorCategory,
							date: today,
							scorer_version: SCORER_VERSION,
							is_black_swan: isBlackSwan,
						},
						userSegment: "retail",
						recommendation: pick.rationale ?? `${pick.instrumentName} — ${pick.category} pick for ${today}`,
						outputSnapshot: governanceOutput,
						meta: FaspAIv2Service.buildMeta(confidence, "stock_pick"),
					}).catch((err: Error) =>
						logger.warn(`[FASP-AI v2] Advisory log failed for ${pick.instrumentName}: ${err.message}`),
					);

					// ── Fix B: Broad-sector diversity gate ───────────────────────────────
					// For listed_stocks only: cap at 1 pick per broad sector per day to
					// prevent IT/Financials concentration when multiple sectors score high.
					const bsl = (pick.keyMetrics as any)?.broadSectorLabel as string | undefined;
					if (category === "listed_stocks" && bsl) {
						const alreadyHasSector = generated.some(
							(g) =>
								g.category === "listed_stocks" &&
								(g.keyMetrics as any)?.broadSectorLabel === bsl,
						);
						if (alreadyHasSector) {
							logger.info(
								`⚠️  [PickOfTheDay] Sector gate: skipping ${pick.instrumentName} ` +
								`(broad sector "${bsl}" already represented today)`,
							);
							continue;
						}
					}

					generated.push(pick);
					const sectorTag = bsl ? ` [${bsl}]` : "";
					logger.info(
						`✅ [PickOfTheDay] Generated ${category}${sectorTag} pick: ${pick.instrumentName}`,
					);
				}
			} catch (error) {
				logger.error(
					`❌ [PickOfTheDay] Failed to generate ${category} pick:`,
					error instanceof Error ? error : new Error(String(error)),
				);
			}
		}

		return generated;
	}

	async syncPickPrices(): Promise<PickUpdateResult> {
		return this.refreshLivePicks();
	}

	// ── Fix M: Generation log accessor ────────────────────────────────────────
	/** Returns the last N generation run summaries (newest first). Max 7 stored. */
	public getGenerationLog(limit = 7): GenerationLogEntry[] {
		return _generationLog.slice(-limit).reverse();
	}

	// ── Fix N: T-1 async pre-generation ───────────────────────────────────────
	/**
	 * Runs a dry-run pick scoring cycle the evening before (T-1).
	 * Pre-scores all candidates, warms the AI alpha cache, but does NOT persist picks.
	 * Subsequent morning generation completes in ~5s instead of 30-60s.
	 */
	public async triggerPreGeneration(): Promise<{ cached: number; durationMs: number }> {
		const start = Date.now();
		logger.info("[PickOfTheDay] T-1 pre-generation dry run started...");
		let cached = 0;
		try {
			// Warm AI alpha boost for all likely stock candidates (top 40 per sector)
			const strategy = this.getStrategy("listed_stocks");
			if ("preWarmAIAlpha" in strategy && typeof (strategy as any).preWarmAIAlpha === "function") {
				cached = await (strategy as any).preWarmAIAlpha();
			}
			const durationMs = Date.now() - start;
			logger.info(`[PickOfTheDay] T-1 pre-generation complete: ${cached} symbols cached in ${durationMs}ms`);
			return { cached, durationMs };
		} catch (err) {
			logger.warn(`[PickOfTheDay] T-1 pre-generation failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`);
			return { cached, durationMs: Date.now() - start };
		}
	}

	/**
	 * Categories where no live exchange price is available.
	 * For these, returnPct is estimated from the annualised target yield accrued
	 * over daysHeld (simple daily accrual: yieldPa * daysHeld / 365).
	 * This gives users a meaningful current return rather than always showing 0%.
	 */
	private static readonly NO_LIVE_PRICE_CATEGORIES: ReadonlySet<PickCategory> = new Set([
		"bonds",
		"sgb",
		"fixed_deposits",
		"unlisted",
	] as PickCategory[]);

	/**
	 * Estimates returnPct for instruments without a live exchange price.
	 * Uses the pick's annualised target yield: (targetPrice/recoPrice - 1) * 365/daysHeld.
	 * Falls back to 0 if days held is 0 or prices are invalid.
	 *
	 * @param recoPrice   - Price at recommendation (number)
	 * @param targetPrice - Target price (used as proxy for yield basis)
	 * @param daysHeld    - Days since recommendation
	 */
	private estimateYieldReturn(recoPrice: number, targetPrice: number, daysHeld: number): number {
		if (recoPrice <= 0 || targetPrice <= 0 || daysHeld <= 0) return 0;
		// annualised yield implied by reco→target
		const impliedYieldPa = (targetPrice / recoPrice - 1);
		// daily accrual (simple interest — conservative for debt instruments)
		return Number((impliedYieldPa * (daysHeld / 365) * 100).toFixed(2));
	}

	async refreshLivePicks(): Promise<PickUpdateResult> {
		let updated = 0;
		let errors = 0;
		const details: string[] = [];

		try {
			const livePicks = await db
				.select()
				.from(dailyPicks)
				.where(eq(dailyPicks.status, "live"));
			logger.info(
				`[PickOfTheDay] Syncing prices for ${livePicks.length} live picks...`,
			);

			for (const pick of livePicks) {
				try {
					const category = pick.category as PickCategory;
					const strategy = this.getStrategy(category);

					const recoDate = new Date(pick.recoDate);
					const daysHeld = Math.floor(
						(Date.now() - recoDate.getTime()) / (1000 * 60 * 60 * 24),
					);

					// ── Fix 1: Expiry check runs unconditionally ────────────────────────────
					// Previously expiry was inside the `if (livePrice != null)` block,
					// so bonds/SGB/unlisted/FD/REIT picks never expired (getLivePrice→null).
					// Now: check expiry first regardless of whether we have a live price.
					const expiryDate = new Date(pick.expiryDate);
					const isExpired = new Date() > expiryDate;

					const livePrice = await strategy.getLivePrice(
						pick.instrumentId || pick.symbol || "",
					);

					if (livePrice != null) {
						// ── Exchange-traded instrument: use actual live price ──────────────
						const recoPrice = Number.parseFloat(pick.recoPrice);
						const returnPct = ((livePrice - recoPrice) / recoPrice) * 100;

						const targetPrice = Number.parseFloat(pick.targetPrice);
						const stoplossPrice = Number.parseFloat(pick.stoplossPrice);
						let newStatus: PickStatus = isExpired ? "expired" : "live";

						if (!isExpired) {
							if (livePrice >= targetPrice) newStatus = "target_hit";
							else if (livePrice <= stoplossPrice) newStatus = "stoploss_hit";
						}

						await db
							.update(dailyPicks)
							.set({
								currentPrice: livePrice.toString(),
								returnPct: returnPct.toFixed(2),
								daysHeld,
								status: newStatus,
								updatedAt: new Date(),
								...(newStatus !== pick.status
									? { statusUpdatedAt: new Date() }
									: {}),
							})
							.where(eq(dailyPicks.id, pick.id));

						updated++;
						if (newStatus !== pick.status) {
							details.push(
								`${pick.instrumentName}: ${pick.status} -> ${newStatus} @ ₹${livePrice}`,
							);
						}

						if (newStatus !== "live" && newStatus !== pick.status) {
							await this.notifyWatchlistSubscribers(
								pick,
								newStatus,
								livePrice,
								returnPct,
							);
						}
					} else {
						// ── Fix 2: No live price (bonds/SGB/unlisted/FD/REIT) ─────────────
						// Compute yield-based return so the user sees meaningful progress,
						// and always expire picks past their expiry date.
						const newStatus: PickStatus = isExpired ? "expired" : "live";
						const needsUpdate =
							newStatus !== pick.status || // status transition (expiry)
							PickOfTheDayService.NO_LIVE_PRICE_CATEGORIES.has(category); // yield accrual

						if (needsUpdate) {
							const recoPrice = Number.parseFloat(pick.recoPrice);
							const targetPrice = Number.parseFloat(pick.targetPrice);
							// Estimated accrued yield (simple daily accrual)
							const estimatedReturn = this.estimateYieldReturn(recoPrice, targetPrice, daysHeld);

							await db
								.update(dailyPicks)
								.set({
									returnPct: estimatedReturn.toFixed(2),
									daysHeld,
									status: newStatus,
									updatedAt: new Date(),
									...(newStatus !== pick.status
										? { statusUpdatedAt: new Date() }
										: {}),
								})
								.where(eq(dailyPicks.id, pick.id));

							updated++;
							if (newStatus !== pick.status) {
								details.push(
									`${pick.instrumentName}: ${pick.status} -> ${newStatus} (yield-based, no live price)`,
								);
								logger.info(
									`[PickOfTheDay] No-price expiry: ${pick.instrumentName} (${category}) -> ${newStatus} after ${daysHeld}d`,
									{ event: "PICK_EXPIRED_NO_PRICE", user_id: "SYSTEM", latency_ms: 0, status: "success" },
								);
							}
						}
					}
				} catch (err) {
					logger.error(
						`[PickOfTheDay] Sync failure for ${pick.instrumentName}:`,
						err instanceof Error ? err : new Error(String(err)),
					);
					errors++;
				}
			}
			return { updated, errors, details };
		} catch (error) {
			logger.error("[PickOfTheDay] Error in refreshLivePicks:", error instanceof Error ? error : new Error(String(error)));
			return { updated, errors, details };
		}
	}

	/**
	 * Returns today's picks with Redis 24h cache.
	 * Cache key: `picks:daily:{YYYY-MM-DD}` (IST date).
	 * Cache TTL: 86400s (24h) — picks are stable for the full trading day.
	 * Falls back to DB read if Redis is unavailable.
	 */
	async getTodaysPicks(): Promise<DailyPickData[]> {
		const today = todayIST();
		const cacheKey = `picks:daily:${today}`;

		// Cache read
		try {
			const redis = await this.getRedis();
			if (redis) {
				const cached = await redis.get(cacheKey);
				if (cached) {
					logger.info("[PickService] getTodaysPicks Redis HIT", {
						event: "PICKS_CACHE_HIT", user_id: "system",
						date: today, latency_ms: 0, status: "success",
					});
					return JSON.parse(cached) as DailyPickData[];
				}
			}
		} catch { /* cache miss is fine */ }

		// DB read
		const picks = await db
			.select()
			.from(dailyPicks)
			.where(eq(dailyPicks.recoDate, today))
			.orderBy(dailyPicks.category);
		const result = picks.map((p) => this.transformPick(p));

		// Cache write (24h TTL — auto-expires at midnight next day)
		if (result.length > 0) {
			try {
				const redis = await this.getRedis();
				if (redis) {
					await redis.setEx(cacheKey, 86400, JSON.stringify(result));
				}
			} catch { /* non-fatal */ }
		}

		return result;
	}

	/**
	 * Returns all live picks with Redis 4h cache.
	 * Cache key: `picks:live` — refreshed every 4h or on new pick generation.
	 * Falls back to DB if Redis is unavailable.
	 */
	async getLivePicks(): Promise<DailyPickData[]> {
		const cacheKey = "picks:live";

		// Cache read
		try {
			const redis = await this.getRedis();
			if (redis) {
				const cached = await redis.get(cacheKey);
				if (cached) {
					logger.info("[PickService] getLivePicks Redis HIT", {
						event: "LIVE_PICKS_CACHE_HIT", user_id: "system",
						latency_ms: 0, status: "success",
					});
					return JSON.parse(cached) as DailyPickData[];
				}
			}
		} catch { /* cache miss is fine */ }

		// DB read
		const picks = await db
			.select()
			.from(dailyPicks)
			.where(eq(dailyPicks.status, "live"))
			.orderBy(desc(dailyPicks.recoDate));

		// Dedup guard: keep only the latest pick per (instrumentName, category).
		// Protects the UI in case the DB accumulates duplicates between cleanup runs.
		const seen = new Map<string, (typeof picks)[0]>();
		for (const pick of picks) {
			const key = `${pick.instrumentName}|||${pick.category}`;
			if (!seen.has(key)) seen.set(key, pick); // already DESC by recoDate
		}
		const result = Array.from(seen.values()).map((p) => this.transformPick(p));

		// Cache write (4h TTL)
		try {
			const redis = await this.getRedis();
			if (redis) {
				await redis.setEx(cacheKey, 4 * 3600, JSON.stringify(result));
			}
		} catch { /* non-fatal */ }

		return result;
	}

	async getPickHistory(
		category?: PickCategory,
		limit: number = 50,
	): Promise<DailyPickData[]> {
		const conditions = [];
		if (category) {
			conditions.push(eq(dailyPicks.category, category));
		}

		const picks = await db
			.select()
			.from(dailyPicks)
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(desc(dailyPicks.recoDate))
			.limit(limit);
		return picks.map((p) => this.transformPick(p));
	}

	async getPerformanceStats(): Promise<any> {
		const allPicks = await db.select().from(dailyPicks);
		const totalPicks = allPicks.length;
		if (totalPicks === 0)
			return {
				totalPicks: 0,
				livePicks: 0,
				targetHits: 0,
				stoplossHits: 0,
				expired: 0,
				hitRate: 0,
				avgReturn: 0,
				byCategory: {},
			};

		const livePicks = allPicks.filter((p) => p.status === "live");
		const resolved = allPicks.filter((p) => p.status !== "live");
		const targetHits = resolved.filter((p) => p.status === "target_hit").length;
		const stoplossHits = resolved.filter(
			(p) => p.status === "stoploss_hit",
		).length;
		const expiredCount = resolved.filter((p) => p.status === "expired").length;
		const hitRate =
			resolved.length > 0 ? (targetHits / resolved.length) * 100 : 0;

		// BUG FIX: avgReturn must ONLY cover closed picks (returnPct is final).
		// Including live picks introduces unrealised intra-day noise and dilutes the metric.
		// Also exclude rows where returnPct was never set (null / empty) to avoid
		// the '|| 0' fallback dragging the average down artificially.
		const closedReturns = resolved
			.filter((p) => p.returnPct != null && p.returnPct !== "")
			.map((p) => Number.parseFloat(p.returnPct!));
		const avgReturn =
			closedReturns.length > 0
				? closedReturns.reduce((a, b) => a + b, 0) / closedReturns.length
				: 0;

		// Per-category breakdown (used by frontend category badges)
		const byCategory: Record<
			string,
			{ total: number; hits: number; hitRate: number; avgReturn: number }
		> = {};
		for (const pick of resolved) {
			const cat = pick.category;
			if (!byCategory[cat])
				byCategory[cat] = { total: 0, hits: 0, hitRate: 0, avgReturn: 0 };
			byCategory[cat].total++;
			if (pick.status === "target_hit") byCategory[cat].hits++;
		}
		for (const cat of Object.keys(byCategory)) {
			const stats = byCategory[cat];
			stats.hitRate =
				stats.total > 0
					? Number.parseFloat(((stats.hits / stats.total) * 100).toFixed(2))
					: 0;
			const catReturns = resolved
				.filter(
					(p) =>
						p.category === cat && p.returnPct != null && p.returnPct !== "",
				)
				.map((p) => Number.parseFloat(p.returnPct!));
			stats.avgReturn =
				catReturns.length > 0
					? Number.parseFloat(
							(
								catReturns.reduce((a, b) => a + b, 0) / catReturns.length
							).toFixed(2),
						)
					: 0;
		}

		return {
			totalPicks,
			livePicks: livePicks.length,
			targetHits,
			stoplossHits,
			expired: expiredCount,
			hitRate: Number.parseFloat(hitRate.toFixed(2)),
			avgReturn: Number.parseFloat(avgReturn.toFixed(2)),
			byCategory,
		};
	}

	async updatePickStatuses(): Promise<PickUpdateResult> {
		const result = await this.refreshLivePicks();

		// ── Fix 8: Weekly pick outcome feedback loop ─────────────────────────────
		// Every Sunday, run a 90-day outcome analysis to compute per-signal lift
		// scores. Non-blocking — runs in the background after EOD price sync.
		// Results are logged to the advisory audit trail for human review.
		const today = new Date();
		if (today.getDay() === 0) { // 0 = Sunday
			void pickOutcomeAnalyzer.analyzeOutcomes(90).catch((err) =>
				logger.warn(
					`[PickOfTheDay] Weekly outcome analysis failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`,
				),
			);
		}

		return result;
	}

	async getRecentlyPickedIds(category: PickCategory): Promise<Set<string>> {
		const cutoff = new Date();
		cutoff.setDate(cutoff.getDate() - 14); // 2 weeks lookback

		const recent = await db
			.select({
				instrumentId: dailyPicks.instrumentId,
				symbol: dailyPicks.symbol,
			})
			.from(dailyPicks)
			.where(
				and(
					eq(dailyPicks.category, category),
					gte(dailyPicks.recoDate, cutoff.toISOString().split("T")[0]),
				),
			);

		const ids = new Set<string>();
		recent.forEach((r) => {
			if (r.instrumentId) ids.add(r.instrumentId);
			if (r.symbol) ids.add(r.symbol);
		});

		// ── Fix J: Cross-sector same-day symbol dedup ─────────────────────────
		// For listed_stocks: also exclude any symbol already picked TODAY in ANY
		// other broad sector (prevents RELIANCE appearing in both Energy + Conglomerate).
		if (category === "listed_stocks") {
			const today = todayIST();
			const todayAllStock = await db
				.select({ instrumentId: dailyPicks.instrumentId, symbol: dailyPicks.symbol })
				.from(dailyPicks)
				.where(
					and(
						eq(dailyPicks.category, "listed_stocks"),
						eq(dailyPicks.recoDate, today),
					),
				);
			todayAllStock.forEach((r) => {
				if (r.instrumentId) ids.add(r.instrumentId);
				if (r.symbol) ids.add(r.symbol);
			});
		}

		return ids;
	}

	async generateRationale(params: RationaleParams): Promise<string> {
		// Retry AI call with exponential backoff (max 3 attempts: 1s, 2s, 4s)
		// Falls back to rule-based rationale if all attempts fail (e.g. Gemini rate-limit at 9 AM IST)
		const MAX_ATTEMPTS = 3;
		for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
			try {
				const prompt = this.buildRationalePrompt(params);
				const category = params.category || "stocks";
				const { result } = await unifiedAIRecommendationEngine.runPrompt<string>({
					prompt,
					category,
					responseParser: (text: string) => text,
					fallback: () => this.generateFallbackRationale(params),
				});
				const rawResult = result || this.generateFallbackRationale(params);
				const resultStr =
					typeof rawResult === "string" ? rawResult : JSON.stringify(rawResult);
				return this.extractRationaleText(resultStr);
			} catch (error) {
				const isLastAttempt = attempt === MAX_ATTEMPTS;
				if (isLastAttempt) {
					logger.warn(
						`[PickOfTheDay] AI rationale failed after ${MAX_ATTEMPTS} attempts — using rule-based fallback`,
						{ event: "AI_RATIONALE_FALLBACK", attempt, error: error instanceof Error ? error.message : String(error), retryable: false },
					);
					return this.generateFallbackRationale(params);
				}
				// Exponential backoff: 1s, 2s, 4s
				const delayMs = Math.pow(2, attempt - 1) * 1000;
				logger.warn(
					`[PickOfTheDay] AI rationale attempt ${attempt} failed, retrying in ${delayMs}ms`,
					{ event: "AI_RATIONALE_RETRY", attempt, delayMs, error: error instanceof Error ? error.message : String(error), retryable: true },
				);
				await new Promise((r) => setTimeout(r, delayMs));
			}
		}
		// TypeScript: unreachable but satisfies return type
		return this.generateFallbackRationale(params);
	}

	private buildRationalePrompt(params: RationaleParams): string {
		const currentPrice = params.currentPrice ?? 0;
		const targetPrice = params.targetPrice ?? 0;
		const upside =
			currentPrice > 0 ? Math.round((targetPrice / currentPrice - 1) * 100) : 0;

		return `Generate a structured investment rationale for today's pick.
Return ONLY valid JSON — no markdown, no extra text.

Product: ${params.name}
Category: ${params.category}
Current Price: ₹${currentPrice}
Target Price: ₹${targetPrice} (${upside}% upside)
Metrics: ${JSON.stringify(params.metrics || {})}

Respond with this exact JSON schema:
{
  "rationale": "<2-sentence buy thesis — the advisor's headline take>",
  "buyThesis": "<1-2 sentences on the primary investment case>",
  "keyRisks": ["<risk 1>", "<risk 2>"],
  "catalysts": ["<catalyst 1>", "<catalyst 2>"],
  "timeHorizonRationale": "<why this is a short/medium/long term pick>"
}

Rules: Be specific. No generic phrases. Risk disclosure tone. Max 20 words per list item.`;
	}

	private generateFallbackRationale(params: RationaleParams): string {
		const currentPrice = params.currentPrice ?? 0;
		const targetPrice = params.targetPrice ?? 0;
		const upside =
			currentPrice > 0 ? Math.round((targetPrice / currentPrice - 1) * 100) : 0;
		return `${params.name} is selected as today's top pick based on strong fundamentals and a compelling target upside of ${upside}%. The technical outlook remains positive with favorable risk-reward indicators.`;
	}

	private extractRationaleText(raw: unknown): string {
		// Guard: coerce non-string inputs (e.g. AI engine returning object) to string
		const rawStr = typeof raw === "string" ? raw : JSON.stringify(raw) ?? "";
		const text = rawStr
			.replace(/^```[\w]*\n?/gm, "")
			.replace(/```$/gm, "")
			.trim();
		if (text.startsWith("{")) {
			try {
				const parsed = JSON.parse(text);
				// ── Fix E: cache structured fields for advisor dashboard ──────────
				const rationaleValue =
					parsed.rationale ??
					parsed.investmentRationale ??
					parsed.investment_rationale ??
					parsed.content ??
					parsed.recommendation ??
					parsed.summary ??
					parsed.description ??
					parsed.text ??
					parsed.analysis ??
					null;
				const rationaleStr = (rationaleValue !== null ? String(rationaleValue) : text).trim();
				// Store structured advisory note keyed by rationale text
				if (parsed.buyThesis || parsed.keyRisks || parsed.catalysts) {
					_structuredRationaleCache.set(rationaleStr, {
						buyThesis: parsed.buyThesis ?? rationaleStr,
						keyRisks: Array.isArray(parsed.keyRisks) ? parsed.keyRisks : [],
						catalysts: Array.isArray(parsed.catalysts) ? parsed.catalysts : [],
						timeHorizonRationale: parsed.timeHorizonRationale ?? "",
					});
				}
				return rationaleStr;
			} catch {
				return text;
			}
		}
		return text;
	}

	/** Fix E: Returns structured rationale for a pick (if AI returned one). */
	public getStructuredRationale(rationaleText: string): {
		buyThesis: string;
		keyRisks: string[];
		catalysts: string[];
		timeHorizonRationale: string;
	} | null {
		return _structuredRationaleCache.get(rationaleText) ?? null;
	}

	/**
	 * Normalise timeHorizon values to canonical set: short_term | medium_term | long_term | intraday
	 * Handles legacy values (short, medium, long, null, undefined).
	 */
	private normaliseHorizon(raw?: string | null): string {
		if (!raw) return "medium_term";
		const map: Record<string, string> = {
			intraday:    "intraday",
			short_term:  "short_term",
			short:       "short_term",
			medium_term: "medium_term",
			medium:      "medium_term",
			long_term:   "long_term",
			long:        "long_term",
		};
		return map[raw.toLowerCase().trim()] ?? "medium_term";
	}

	private async savePick(pick: DailyPickData): Promise<void> {
		// Use Drizzle ORM insert with onConflictDoNothing() for idempotent generation.
		// No explicit target: PostgreSQL will suppress any unique constraint violation.
		// (Specifying nullable columns like instrument_id/symbol as a conflict target
		//  causes PG to error because NULL != NULL breaks the uniqueness check.)
		await db
			.insert(dailyPicks)
			.values({
				category: pick.category,
				instrumentId: pick.instrumentId ?? null,
				instrumentName: pick.instrumentName,
				isin: pick.isin ?? null,
				symbol: pick.symbol ?? null,
				market: pick.market ?? null,
				exchange: pick.exchange ?? null,
				recoDate: pick.recoDate,
				recoPrice: pick.recoPrice.toString(),
				targetPrice: pick.targetPrice.toString(),
				stoplossPrice: pick.stoplossPrice.toString(),
				currentPrice: (pick.currentPrice ?? pick.recoPrice).toString(),
				status: pick.status,
				expiryDate: pick.expiryDate,
				rationale: pick.rationale,
				riskLevel: pick.riskLevel,
				suitableFor: pick.suitableFor ?? ["Balanced"],
				keyMetrics: pick.keyMetrics ?? {},
				timeHorizon: this.normaliseHorizon(pick.timeHorizon),
				confidenceScore: pick.confidenceScore ?? 70,
				sectorCategory: pick.sectorCategory ?? null,
				generatedBy: "ai",
				updatedAt: new Date(),
			})
			.onConflictDoNothing();
	}


	private async notifyWatchlistSubscribers(
		pick: typeof dailyPicks.$inferSelect,
		newStatus: PickStatus,
		currentPrice: number,
		returnPct: number,
	): Promise<void> {
		try {
			const subscribers = await db
				.select({ userId: pickWatchlist.userId })
				.from(pickWatchlist)
				.where(eq(pickWatchlist.pickId, pick.id));
			if (subscribers.length === 0) return;

			const title = `${newStatus.toUpperCase()}: ${pick.instrumentName}`;
			const message = `${pick.instrumentName} has hit its ${newStatus.replace("_", " ")} at ₹${currentPrice.toLocaleString()} with a ${returnPct.toFixed(1)}% return.`;

			for (const sub of subscribers) {
				await db.insert(userNotifications).values({
					userId: sub.userId,
					type: newStatus === "target_hit" ? "info" : "alert",
					title,
					message,
					actionUrl: "/agent/picks",
					priority: newStatus === "stoploss_hit" ? "high" : "medium",
				});
			}
		} catch (error) {
			logger.error(`[PickOfTheDay] Notification failure:`, error instanceof Error ? error : new Error(String(error)));
		}
	}

	private transformPick(pick: typeof dailyPicks.$inferSelect): DailyPickData {
		const rawMetrics = (pick.keyMetrics as any) || {};
		const suggestedAllocation =
			rawMetrics.suggestedAllocation != null
				? Number.parseFloat(rawMetrics.suggestedAllocation)
				: calculateSuggestedAllocation(
						pick.category,
						pick.riskLevel || "medium",
						pick.confidenceScore || 70,
						rawMetrics,
					);

		const keyMetrics = {
			...rawMetrics,
			suggestedAllocation,
		};

		return {
			id: pick.id,
			category: pick.category,
			instrumentId: pick.instrumentId ?? undefined,
			instrumentName: pick.instrumentName,
			isin: pick.isin ?? undefined,
			symbol: pick.symbol ?? undefined,
			market: pick.market ?? undefined,
			exchange: pick.exchange ?? undefined,
			recoDate: pick.recoDate,
			recoPrice: Number.parseFloat(pick.recoPrice),
			targetPrice: Number.parseFloat(pick.targetPrice),
			stoplossPrice: Number.parseFloat(pick.stoplossPrice),
			currentPrice: pick.currentPrice
				? Number.parseFloat(pick.currentPrice)
				: undefined,
			status: pick.status,
			expiryDate: pick.expiryDate,
			returnPct: pick.returnPct ? Number.parseFloat(pick.returnPct) : undefined,
			daysHeld: pick.daysHeld ?? undefined,
			rationale: pick.rationale,
			riskLevel: pick.riskLevel || "medium",
			suitableFor: pick.suitableFor || [],
			keyMetrics,
			timeHorizon: pick.timeHorizon || "medium_term",
			confidenceScore: pick.confidenceScore || 70,
			sectorCategory: pick.sectorCategory ?? undefined,
			scoringBreakdown: pick.scoringBreakdown as ScoreBreakdown | undefined,
			riskScore: pick.riskScore ?? undefined,
			updatedAt: pick.updatedAt ?? undefined,
			statusUpdatedAt: pick.statusUpdatedAt ?? undefined,
		};
	}

	async getMostRecentPicks(): Promise<DailyPickData[]> {
		const latestDate = await db
			.select({ maxDate: sql<string>`MAX(reco_date)` })
			.from(dailyPicks);
		const recoDate = latestDate[0]?.maxDate;
		if (!recoDate) return [];
		const picks = await db
			.select()
			.from(dailyPicks)
			.where(eq(dailyPicks.recoDate, recoDate))
			.orderBy(dailyPicks.category);
		return picks.map((p) => this.transformPick(p));
	}

	/**
	 * Returns true if the given IST date is a market trading day (weekday + no NSE holiday).
	 * Date is expressed as YYYY-MM-DD string in IST.
	 */
	private isNSETradingDay(istDateStr: string): boolean {
		try {
			return marketHolidayService.isTradingDay(istDateStr, "NSE");
		} catch {
			// If holiday service fails for any reason, default to true (safe fallback)
			return true;
		}
	}

	async startDailyScheduler(): Promise<void> {
		await this.catchUpIfNeeded();

		/**
		 * Returns milliseconds from now until the next occurrence of [hour]:[minute] IST.
		 * If that time has already passed today, it targets tomorrow.
		 */
		function msUntilIst(hour: number, minute = 0): number {
			// Compute IST offset: UTC+5:30 = 330 minutes
			const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
			const nowUtcMs = Date.now();
			const nowIstMs = nowUtcMs + IST_OFFSET_MS;

			// Build target time in IST as a UTC timestamp
			const nowIstDate = new Date(nowIstMs);

			// Recalculate properly: target in UTC = IST target - 5h30m
			const targetHourUtc = hour - 5;
			const targetMinUtc = minute - 30;
			const borrowHour = targetMinUtc < 0 ? 1 : 0;
			const finalMinUtc = targetMinUtc < 0 ? targetMinUtc + 60 : targetMinUtc;
			const finalHourUtc = targetHourUtc - borrowHour;

			const targetDate = new Date(
				Date.UTC(
					nowIstDate.getUTCFullYear(),
					nowIstDate.getUTCMonth(),
					nowIstDate.getUTCDate(),
					finalHourUtc,
					finalMinUtc,
					0,
					0,
				),
			);

			// If the target has already passed today (UTC), push to tomorrow
			if (targetDate.getTime() <= nowUtcMs) {
				targetDate.setUTCDate(targetDate.getUTCDate() + 1);
			}

			return targetDate.getTime() - nowUtcMs;
		}

		// ── 9:20 AM IST ── Generate fresh daily picks.
		// Deliberately fires AFTER the NSE pre-open session (9:00–9:15 AM) closes
		// and normal trading has settled for ~5 minutes, so recoPrice reflects
		// actual traded prices rather than indicative pre-open quotes.
		const scheduleNextGeneration = () => {
			const delayMs = msUntilIst(9, 20);
			logger.info(
				`📅 [PickOfTheDay] Next generation scheduled in ${Math.round(delayMs / 60000)} min (9:20 AM IST — post pre-open)`,
			);
			setTimeout(() => {
				const todayStr = todayIST();
				if (this.isNSETradingDay(todayStr)) {
					logger.info(`📅 [PickOfTheDay] Market is open today (${todayStr}). Generating picks...`);
					this.generateDailyPicks().catch((err) =>
						logger.error("[PickOfTheDay] 9AM generation error:", err instanceof Error ? err : new Error(String(err))),
					);
				} else {
					logger.info(`📅 [PickOfTheDay] Market is CLOSED today (${todayStr}) — skipping pick generation.`);
				}
				// Schedule the next day's generation
				scheduleNextGeneration();
			}, delayMs);
		};
		scheduleNextGeneration();

		// ── 4:00 PM IST ── Refresh live prices after market close (market days only)
		const scheduleEODRefresh = () => {
			const delayMs = msUntilIst(16, 0);
			setTimeout(() => {
				if (this.isNSETradingDay(todayIST())) {
					this.refreshLivePicks().catch((err) =>
						logger.error("[PickOfTheDay] 4PM refresh error:", err instanceof Error ? err : new Error(String(err))),
					);
				}
				scheduleEODRefresh();
			}, delayMs);
		};
		scheduleEODRefresh();

		// ── 11:00 AM IST ── Early-morning price refresh (Fix 4: catches opening volatility)
		const scheduleMorningRefresh = () => {
			const delayMs = msUntilIst(11, 0);
			setTimeout(() => {
				if (this.isNSETradingDay(todayIST())) {
					this.refreshLivePicks().catch((err) =>
						logger.error("[PickOfTheDay] 11AM refresh error:", err instanceof Error ? err : new Error(String(err))),
					);
				}
				scheduleMorningRefresh();
			}, delayMs);
		};
		scheduleMorningRefresh();

		// ── 12:30 PM IST ── Mid-day price refresh (market days only)
		const scheduleMidDayRefresh = () => {
			const delayMs = msUntilIst(12, 30);
			setTimeout(() => {
				if (this.isNSETradingDay(todayIST())) {
					this.refreshLivePicks().catch((err) =>
						logger.error("[PickOfTheDay] 12:30PM refresh error:", err instanceof Error ? err : new Error(String(err))),
					);
				}
				scheduleMidDayRefresh();
			}, delayMs);
		};
		scheduleMidDayRefresh();

		// ── 2:30 PM IST ── Mid-afternoon price refresh (market days only)
		const scheduleMidAfternoonRefresh = () => {
			const delayMs = msUntilIst(14, 30);
			setTimeout(() => {
				if (this.isNSETradingDay(todayIST())) {
					this.refreshLivePicks().catch((err) =>
						logger.error("[PickOfTheDay] 2:30PM refresh error:", err instanceof Error ? err : new Error(String(err))),
					);
				}
				scheduleMidAfternoonRefresh();
			}, delayMs);
		};
		scheduleMidAfternoonRefresh();

		logger.info(
			`📅 [PickOfTheDay] Market-aware scheduler started: Generation@9:20AM, Refresh@11AM+12:30PM+2:30PM+4:00PM IST (NSE trading days only)`,
		);

		// ── Auto-heal: every 6 hours ── Catch any generation failures silently
		// If picks are still below threshold mid-day (e.g. strategy failed at 9 AM),
		// this loop will regenerate them without any admin action.
		const AUTO_HEAL_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
		setInterval(async () => {
			try {
				logger.info("[PickOfTheDay] Auto-heal check running...");
				await this.catchUpIfNeeded();
			} catch (err) {
				logger.error("[PickOfTheDay] Auto-heal error:", err instanceof Error ? err : new Error(String(err)));
			}
		}, AUTO_HEAL_INTERVAL_MS);
	}

	/**
	 * Generates picks on startup if today has none OR fewer than 3 picks (partial failure recovery).
	 * Also handles the edge case where the 9 AM scheduler fired but some strategies failed.
	 * Skips generation entirely on weekends and NSE market holidays.
	 */
	private async catchUpIfNeeded(): Promise<void> {
		const today = todayIST(); // IST date — consistent with how picks are stored

		// ── Market day guard ──────────────────────────────────────────────────────
		// Do NOT generate picks on weekends or NSE holidays. If the market is closed,
		// picks from the last trading day remain valid and no new picks should be added.
		if (!this.isNSETradingDay(today)) {
			const dayOfWeek = new Date().toLocaleDateString("en-US", {
				weekday: "long",
				timeZone: "Asia/Kolkata",
			});
			logger.info(
				`📅 [PickOfTheDay] Skipping catch-up — ${today} is not a trading day (${dayOfWeek}).`,
			);
			return;
		}

		const existing = await db
			.select({ count: sql<number>`COUNT(*)` })
			.from(dailyPicks)
			.where(eq(dailyPicks.recoDate, today));
		const existingCount = Number(existing[0]?.count || 0);

		// Regenerate if: no picks at all, or fewer than 4 (indicates partial failure).
		// With StockStrategy generating 5 sector picks, a healthy day has ≥10 picks.
		// Lowered from 8 → 4 to allow partial recovery: if only stocks exist and
		// MF/Bond/FD/SGB/REIT are missing, this will trigger regeneration.
		const MIN_PICKS_THRESHOLD = 4;
		if (existingCount < MIN_PICKS_THRESHOLD) {
			logger.info(
				`🔄 [PickOfTheDay] Startup catch-up: only ${existingCount} picks found for ${today} (threshold: ${MIN_PICKS_THRESHOLD}). Generating missing picks...`,
			);
			await this.generateDailyPicks();
			return;
		}

		// Additionally check per-category coverage — if any critical category
		// has 0 picks for today, regenerate to fill the gap.
		const categoryCounts = await db
			.select({ category: dailyPicks.category, cnt: sql<number>`COUNT(*)` })
			.from(dailyPicks)
			.where(eq(dailyPicks.recoDate, today))
			.groupBy(dailyPicks.category);

		const existingCategories = new Set(categoryCounts.map((r) => r.category));
		const criticalCategories: PickCategory[] = [
			"listed_stocks",
			"mutual_funds",
			"bonds",
			"fixed_deposits",
			"sgb",
		];
		const missingCritical = criticalCategories.filter(
			(c) => !existingCategories.has(c),
		);

		if (missingCritical.length >= 2) {
			// 2+ critical categories are missing — regenerate to fill gaps
			logger.info(
				`🔄 [PickOfTheDay] Missing ${missingCritical.length} critical categories: [${missingCritical.join(", ")}]. Triggering regeneration...`,
			);
			await this.generateDailyPicks();
		} else {
			logger.info(
				`✅ [PickOfTheDay] ${existingCount} picks across ${existingCategories.size} categories for ${today}. OK.`,
			);
		}
	}

	private async scheduledGenerate(): Promise<void> {
		await this.generateDailyPicks();
	}
}

export const pickOfTheDayService = new PickOfTheDayService();
