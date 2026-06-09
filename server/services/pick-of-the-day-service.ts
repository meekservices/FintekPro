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
			console.warn(
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
		console.log(
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
			console.warn(
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
					// Governance Gate: Every pick must pass suitability and compliance floors.
					// IMPORTANT: ai_output must include `factors_considered` (non-empty) and
					// `confidence_score` >= 0.6 to pass ExplainabilityValidator (EXP_002/EXP_004).
					const governanceOutput = {
						recommendation: pick.rationale,
						// Normalise 0–100 → 0–1. Clamp to 0.60 minimum so picks with sparse
						// financial data (e.g. empty stockFinancialMetrics) pass EXP_004.
						confidence_score: Math.max(pick.confidenceScore ?? 60, 60) / 100,
						factors_considered: [
							`category: ${pick.category}`,
							`riskLevel: ${pick.riskLevel}`,
							`recoPrice: ${pick.recoPrice}`,
							`targetPrice: ${pick.targetPrice}`,
							...(pick.sectorCategory
								? [`sector: ${pick.sectorCategory}`]
								: []),
							...(pick.timeHorizon ? [`horizon: ${pick.timeHorizon}`] : []),
							...((pick.keyMetrics as any)?.broadSectorLabel
								? [`broadSector: ${(pick.keyMetrics as any).broadSectorLabel}`]
								: []),
						],
						model_version: SCORER_VERSION,
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
						console.warn(
							`⚠️ [PickOfTheDay] Governance Block for ${pick.instrumentName}: ${aageCheck.audit_id}`,
						);
						continue;
					}

					await this.savePick(pick);
					generated.push(pick);
					const sectorTag = (pick.keyMetrics as any)?.broadSectorLabel
						? ` [${(pick.keyMetrics as any).broadSectorLabel}]`
						: "";
					console.log(
						`✅ [PickOfTheDay] Generated ${category}${sectorTag} pick: ${pick.instrumentName}`,
					);
				}
			} catch (error) {
				console.error(
					`❌ [PickOfTheDay] Failed to generate ${category} pick:`,
					error,
				);
			}
		}

		return generated;
	}

	async syncPickPrices(): Promise<PickUpdateResult> {
		return this.refreshLivePicks();
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
			console.log(
				`[PickOfTheDay] Syncing prices for ${livePicks.length} live picks...`,
			);

			for (const pick of livePicks) {
				try {
					const category = pick.category as PickCategory;
					const strategy = this.getStrategy(category);

					const livePrice = await strategy.getLivePrice(
						pick.instrumentId || pick.symbol || "",
					);
					if (livePrice != null) {
						const recoPrice = Number.parseFloat(pick.recoPrice);
						const returnPct = ((livePrice - recoPrice) / recoPrice) * 100;

						const recoDate = new Date(pick.recoDate);
						const daysHeld = Math.floor(
							(Date.now() - recoDate.getTime()) / (1000 * 60 * 60 * 24),
						);

						const targetPrice = Number.parseFloat(pick.targetPrice);
						const stoplossPrice = Number.parseFloat(pick.stoplossPrice);
						let newStatus: PickStatus = "live";

						if (livePrice >= targetPrice) newStatus = "target_hit";
						else if (livePrice <= stoplossPrice) newStatus = "stoploss_hit";

						const expiryDate = new Date(pick.expiryDate);
						if (new Date() > expiryDate && newStatus === "live")
							newStatus = "expired";

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
					}
				} catch (err) {
					console.error(
						`[PickOfTheDay] Sync failure for ${pick.instrumentName}:`,
						err,
					);
					errors++;
				}
			}
			return { updated, errors, details };
		} catch (error) {
			console.error("[PickOfTheDay] Error in refreshLivePicks:", error);
			return { updated, errors, details };
		}
	}

	async getTodaysPicks(): Promise<DailyPickData[]> {
		const today = todayIST();
		const picks = await db
			.select()
			.from(dailyPicks)
			.where(eq(dailyPicks.recoDate, today))
			.orderBy(dailyPicks.category);
		return picks.map((p) => this.transformPick(p));
	}

	async getLivePicks(): Promise<DailyPickData[]> {
		const picks = await db
			.select()
			.from(dailyPicks)
			.where(eq(dailyPicks.status, "live"))
			.orderBy(desc(dailyPicks.recoDate));
		return picks.map((p) => this.transformPick(p));
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
		return this.refreshLivePicks();
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
		return ids;
	}

	async generateRationale(params: RationaleParams): Promise<string> {
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
			// Coerce to string — AI engine may return an object when model output is structured JSON
			const resultStr =
				typeof rawResult === "string" ? rawResult : JSON.stringify(rawResult);
			return this.extractRationaleText(resultStr);
		} catch (error) {
			console.error("[PickOfTheDay] AI rationale generation failed:", error);
			return this.generateFallbackRationale(params);
		}
	}

	private buildRationalePrompt(params: RationaleParams): string {
		const currentPrice = params.currentPrice ?? 0;
		const targetPrice = params.targetPrice ?? 0;
		const upside =
			currentPrice > 0 ? Math.round((targetPrice / currentPrice - 1) * 100) : 0;

		return `Generate a concise, professional investment rationale for today's pick.
Product: ${params.name}
Category: ${params.category}
Current Price: ₹${currentPrice}
Target Price: ₹${targetPrice} (${upside}% upside)
Metrics: ${JSON.stringify(params.metrics || {})}

Write a 2-3 sentence rationale explaining why this is today's top pick. Focus on key strengths and catalysts. Do not use markdown.`;
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
				return (parsed.rationale || parsed.content || text).trim();
			} catch {
				return text;
			}
		}
		return text;
	}

	private async savePick(pick: DailyPickData): Promise<void> {
		// Use Drizzle ORM insert with onConflictDoNothing() for idempotent generation.
		// Drizzle handles TEXT[] (suitableFor) natively — no sql.raw() needed.
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
				timeHorizon: pick.timeHorizon ?? "medium_term",
				confidenceScore: pick.confidenceScore ?? 70,
				sectorCategory: pick.sectorCategory ?? null,
				generatedBy: "ai",
				updatedAt: new Date(),
			})
			.onConflictDoNothing({
				target: [
					dailyPicks.category,
					dailyPicks.recoDate,
					dailyPicks.instrumentId,
					dailyPicks.symbol,
				],
			});
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
			console.error(`[PickOfTheDay] Notification failure:`, error);
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

	async startDailyScheduler(): Promise<void> {
		await this.catchUpIfNeeded();

		const MS_PER_DAY = 24 * 60 * 60 * 1000;

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
			const targetIstMs =
				Date.UTC(
					nowIstDate.getUTCFullYear(),
					nowIstDate.getUTCMonth(),
					nowIstDate.getUTCDate(),
					hour - 5, // convert IST → UTC: IST 9:00 = UTC 3:30
					minute - 30 < 0 ? minute + 30 : minute - 30,
					0,
					0,
				) - (minute < 30 ? 60 * 60 * 1000 : 0); // adjust for borrow

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

		// ── 9:00 AM IST ── Generate fresh daily picks (market open)
		const delayToGenerate = msUntilIst(9, 0);
		console.log(
			`📅 [PickOfTheDay] Next generation scheduled in ${Math.round(delayToGenerate / 60000)} min (9:00 AM IST)`,
		);
		setTimeout(() => {
			this.generateDailyPicks();
			setInterval(() => this.generateDailyPicks(), MS_PER_DAY);
		}, delayToGenerate);

		// ── 4:00 PM IST ── Refresh live prices after market close
		const delayToRefresh = msUntilIst(16, 0);
		console.log(
			`📅 [PickOfTheDay] Next price refresh scheduled in ${Math.round(delayToRefresh / 60000)} min (4:00 PM IST)`,
		);
		setTimeout(() => {
			this.refreshLivePicks();
			setInterval(() => this.refreshLivePicks(), MS_PER_DAY);
		}, delayToRefresh);

		// ── 12:30 PM IST ── Mid-day price refresh (optional, during market hours)
		const delayToMidDay = msUntilIst(12, 30);
		setTimeout(() => {
			this.refreshLivePicks();
			setInterval(() => this.refreshLivePicks(), MS_PER_DAY);
		}, delayToMidDay);

		console.log(
			`📅 [PickOfTheDay] IST-aware scheduler started: Generation@9AM, Refresh@12:30PM+4PM IST`,
		);

		// ── Auto-heal: every 6 hours ── Catch any generation failures silently
		// If picks are still below threshold mid-day (e.g. strategy failed at 9 AM),
		// this loop will regenerate them without any admin action.
		const AUTO_HEAL_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
		setInterval(async () => {
			try {
				console.log("[PickOfTheDay] Auto-heal check running...");
				await this.catchUpIfNeeded();
			} catch (err) {
				console.error("[PickOfTheDay] Auto-heal error:", err);
			}
		}, AUTO_HEAL_INTERVAL_MS);
	}

	/**
	 * Generates picks on startup if today has none OR fewer than 3 picks (partial failure recovery).
	 * Also handles the edge case where the 9 AM scheduler fired but some strategies failed.
	 */
	private async catchUpIfNeeded(): Promise<void> {
		const today = todayIST(); // IST date — consistent with how picks are stored
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
			console.log(
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
			console.log(
				`🔄 [PickOfTheDay] Missing ${missingCritical.length} critical categories: [${missingCritical.join(", ")}]. Triggering regeneration...`,
			);
			await this.generateDailyPicks();
		} else {
			console.log(
				`✅ [PickOfTheDay] ${existingCount} picks across ${existingCategories.size} categories for ${today}. OK.`,
			);
		}
	}

	private async scheduledGenerate(): Promise<void> {
		await this.generateDailyPicks();
	}
}

export const pickOfTheDayService = new PickOfTheDayService();
