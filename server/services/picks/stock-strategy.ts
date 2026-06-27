import { logger } from "../../logger";
import { db } from "../../db";
import {
	listedStocks,
	goldenPrices,
	stockFinancialMetrics,
} from "@shared/schema";
import { screenerStocks } from "@shared/schema/screener";
import { and, eq, sql, gte, asc, desc, count, or, ilike } from "drizzle-orm";

import { BaseStrategy } from "./base-strategy";
import { StrategyContext } from "./types";
import {
	DailyPickData,
	PickCategory,
	calculateSuggestedAllocation,
} from "../pick-of-the-day-service";
import {
	getEnrichedStockSnapshots,
	EnrichedStockSnapshot,
} from "../screener/enriched-stock-data";
import { FinancialMetricsCalculator } from "../financial-metrics-calculator";
import { unifiedAIRecommendationEngine } from "../unified-ai-recommendation-engine";
import { indianApiService } from "../indian-api-service";

const financialMetricsCalculator = new FinancialMetricsCalculator();

/**
 * AI Alpha boost cache: keyed by symbol, stores the last AI conviction score (0-20)
 * for up to CACHE_TTL_MS milliseconds to avoid repeated Gemini calls per run.
 */
const _aiAlphaCache = new Map<string, { score: number; ts: number }>();
const AI_ALPHA_CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

// ── Broad-sector taxonomy ─────────────────────────────────────────────────────
// Maps 5 investor-friendly broad sectors to the keyword patterns found in the
// `sector` and `broad_sector` columns of listed_stocks (185 granular values).
export const BROAD_SECTORS = [
	{
		id: "banking_finance",
		label: "Banking & Finance",
		icon: "🏦",
		color: "#3B82F6",
		keywords: [
			"bank",
			"finance",
			"financial",
			"nbfc",
			"insurance",
			"capital",
			"invest",
			"brokerage",
			"microfinance",
			"housing finance",
		],
	},
	{
		id: "information_technology",
		label: "Information Technology",
		icon: "💻",
		color: "#8B5CF6",
		keywords: [
			"it ",
			"software",
			"technology",
			"tech",
			"digital",
			"saas",
			"computer",
			"data",
			"internet",
			"semiconductor",
			"telecom",
		],
	},
	{
		id: "healthcare_pharma",
		label: "Healthcare & Pharma",
		icon: "💊",
		color: "#10B981",
		keywords: [
			"pharma",
			"health",
			"medical",
			"hospital",
			"biotech",
			"diagnostics",
			"drug",
			"healthcare",
			"life science",
		],
	},
	{
		id: "auto_infra",
		label: "Auto & Capital Goods",
		icon: "🏭",
		color: "#F59E0B",
		keywords: [
			"auto",
			"automobile",
			"vehicle",
			"infrastructure",
			"capital good",
			"engineering",
			"construction",
			"cement",
			"steel",
			"metal",
			"energy",
			"power",
			"oil",
			"gas",
			"mining",
			"realty",
			"real estate",
		],
	},
	{
		id: "fmcg_consumer",
		label: "FMCG & Consumer",
		icon: "🛒",
		color: "#EF4444",
		keywords: [
			"fmcg",
			"consumer",
			"retail",
			"food",
			"beverage",
			"textile",
			"apparel",
			"media",
			"entertainment",
			"hotel",
			"hospitality",
			"agri",
			"agriculture",
			"chemical",
		],
	},
] as const;

export type BroadSectorId = (typeof BROAD_SECTORS)[number]["id"];

/**
 * Maps a granular NSE/BSE sector string to one of the 5 broad sector IDs.
 * Falls back to the last sector (FMCG/Consumer) if no keyword matches.
 */
export function mapToBroadSector(
	sector: string | null | undefined,
): BroadSectorId {
	if (!sector) return "fmcg_consumer";
	const lower = sector.toLowerCase();
	for (const bs of BROAD_SECTORS) {
		if (bs.keywords.some((kw) => lower.includes(kw))) return bs.id;
	}
	return "fmcg_consumer"; // catch-all
}

/**
 * Simple concurrency limiter — runs `tasks` with at most `concurrency` running
 * simultaneously. Replaces p-limit without adding a dependency.
 * @param tasks  Array of async thunks (() => Promise<T>)
 * @param concurrency  Max parallel executions
 */
async function runConcurrent<T>(
	tasks: Array<() => Promise<T>>,
	concurrency: number,
): Promise<T[]> {
	const results: T[] = new Array(tasks.length);
	let index = 0;

	async function worker(): Promise<void> {
		while (index < tasks.length) {
			const i = index++;
			results[i] = await tasks[i]();
		}
	}

	const workers = Array.from(
		{ length: Math.min(concurrency, tasks.length) },
		worker,
	);
	await Promise.all(workers);
	return results;
}

/** Cached flag: undefined = unchecked, true = has rows, false = empty table */
let _metricsTableHasData: boolean | undefined;

export class StockStrategy extends BaseStrategy {
	category: PickCategory = "listed_stocks";

	/**
	 * Generates one pick per broad sector (up to 5).
	 * Returns an array so the caller (pick-of-the-day-service) can governance-gate each independently.
	 *
	 * @param context - Scheduler context including today's date, market regime, and recently-picked IDs.
	 * @returns Array of DailyPickData (may be empty on failure), or null on hard error.
	 */
	async generate(context: StrategyContext): Promise<DailyPickData[] | null> {
		try {
			const results: DailyPickData[] = [];
			const usedIds = new Set<string>(context.recentIds ?? []);

			for (const broadSector of BROAD_SECTORS) {
				try {
					const pick = await this.pickBestForSector(
						broadSector,
						context,
						usedIds,
					);
					if (pick) {
						results.push(pick);
						// Prevent the same stock appearing in multiple sectors
						if (pick.instrumentId) usedIds.add(pick.instrumentId);
					}
				} catch (sectorErr) {
					logger.warn(
						`[StockStrategy] Failed to pick for sector ${broadSector.label}: ${sectorErr instanceof Error ? sectorErr.message : String(sectorErr)}`,
					);
				}
			}

			if (results.length === 0) {
				logger.warn(
					"[StockStrategy] No sector picks generated — all sectors failed or were empty",
				);
				// ── Cross-sector fallback: pick best available stock without sector filter ──
				// This guarantees at least one stock pick per day even when AI is unavailable.
				try {
					const fallbackPick = await this.pickBestStockFallback(context);
					if (fallbackPick) {
						logger.info(
							`[StockStrategy] Fallback pick: ${fallbackPick.symbol} (${fallbackPick.sectorCategory})`,
						);
						return [fallbackPick];
					}
				} catch (fallbackErr) {
					logger.error("[StockStrategy] Fallback also failed:", fallbackErr instanceof Error ? fallbackErr : new Error(String(fallbackErr)));
				}
				return null;
			}

			logger.info(
				`[StockStrategy] Generated ${results.length} sector picks: ${results.map((p) => `${p.sectorCategory} → ${p.symbol}`).join(", ")}`,
			);
			return results;
		} catch (error) {
			logger.error("[StockStrategy] Fatal error:", error instanceof Error ? error : new Error(String(error)));
			return null;
		}
	}

	/**
	 * Picks the single best stock for a given broad sector.
	 * Fetches up to 8 candidates, scores them, returns the top scorer.
	 *
	 * @param broadSector - One of the 5 BROAD_SECTORS definitions.
	 * @param context     - Strategy context (today, recentIds, service).
	 * @param usedIds     - Already-selected stock IDs to exclude (cross-sector dedup).
	 * @returns A DailyPickData for the best stock in this sector, or null if none qualify.
	 */
	private async pickBestForSector(
		broadSector: (typeof BROAD_SECTORS)[number],
		context: StrategyContext,
		usedIds: Set<string>,
	): Promise<DailyPickData | null> {
		// Build keyword filter — match any of the sector's keywords in the sector column
		const sectorConditions = broadSector.keywords.map((kw) =>
			ilike(listedStocks.sector, `%${kw}%`),
		);
		const broadSectorConditions = broadSector.keywords.map((kw) =>
			ilike(listedStocks.broadSector, `%${kw}%`),
		);

		let stocks = await db
			.select()
			.from(listedStocks)
			.where(
				and(
					eq(listedStocks.isPublished, true),
					sql`${listedStocks.currentPrice} IS NOT NULL`,
					sql`CAST(${listedStocks.currentPrice} AS DECIMAL) > 50`,
					// ── Circuit breaker filter ──────────────────────────────────────
					// Exclude stocks at or near lower circuit (day_change_percent ≤ -9.5%)
					// Exclude stocks at upper circuit gap-ups (day_change_percent ≥ +9.5%)
					// Both indicate illiquidity / circuit-locked price.
					sql`(
						${listedStocks.dayChangePercent} IS NULL
						OR (
							CAST(${listedStocks.dayChangePercent} AS DECIMAL) > -9.5
							AND CAST(${listedStocks.dayChangePercent} AS DECIMAL) < 9.5
						)
					)`,
					// Exclude zero-volume stocks (circuit-locked, no buyers/sellers)
					sql`(
						${listedStocks.averageVolume} IS NULL
						OR CAST(${listedStocks.averageVolume} AS DECIMAL) > 0
					)`,
					or(or(...sectorConditions), or(...broadSectorConditions)),
				),
			)
			.limit(8);

		// Fallback to screenerStocks if listedStocks has no sector data
		if (stocks.length === 0) {
			const screenerConditions = broadSector.keywords.map((kw) =>
				ilike(screenerStocks.sector, `%${kw}%`),
			);
			const screenerRows = await db
				.select()
				.from(screenerStocks)
				.where(
					and(
						eq(screenerStocks.isActive, true),
						sql`${screenerStocks.currentPrice} IS NOT NULL`,
						sql`CAST(${screenerStocks.currentPrice} AS DECIMAL) > 50`,
						or(...screenerConditions),
					),
				)
				.limit(8);

			stocks = screenerRows.map(
				(r) =>
					({
						id: r.id,
						symbol: r.symbol,
						companyName: r.companyName,
						currentPrice: r.currentPrice,
						sector: r.sector ?? null,
						marketCap: r.marketCapCategory ?? null,
						peRatio: null,
						pbRatio: null,
						dividendYield: null,
						eps: null,
						bookValue: null,
						roe: null,
						roce: null,
						returns1M: null,
						returns3M: null,
						returns6M: null,
						returns1Y: null,
						returns3Y: null,
						returns5Y: null,
						beta: null,
						volatility: null,
						riskLevel: null,
						analystRating: null,
						targetPrice: null,
						numberOfAnalysts: null,
						averageVolume: null,
						faceValue: "10",
						lotSize: 1,
						minimumInvestment: "0",
						isPublished: false,
						publishedAt: null,
						publishedBy: null,
						selectionNotes: null,
						investmentThesis: null,
						historicalStartDate: null,
						historicalEndDate: null,
						historicalComplete: false,
						lastDailyUpdate: null,
						isActive: r.isActive ?? true,
						dataSource: r.dataSource ?? "screener",
						enrichmentStatus: "partial",
						lastEnrichedAt: null,
						enrichmentSource: null,
						lastUpdated: r.updatedAt ?? new Date(),
						createdAt: r.createdAt ?? new Date(),
						previousClose: null,
						dayChange: null,
						dayChangePercent: null,
						weekHigh52: null,
						weekLow52: null,
						marketCapValue: r.marketCapValue ?? null,
						isin: r.isin ?? null,
						bseCode: null,
						nseCode: null,
						cin: null,
						companyPan: null,
						broadSector: null,
						industry: r.industry ?? null,
						indexMembership: [],
						exchangeInfo: {},
					}) as typeof listedStocks.$inferSelect,
			);
		}

		// Exclude stocks already picked for another sector today
		const freshStocks = stocks.filter((s) => !usedIds.has(s.id));
		if (freshStocks.length === 0) return null;

		// Fetch enriched snapshots for scoring
		const symbols = freshStocks
			.map((s) => s.symbol)
			.filter(Boolean) as string[];
		let enrichedSnapshots: Map<string, EnrichedStockSnapshot> = new Map();
		try {
			enrichedSnapshots = await getEnrichedStockSnapshots(symbols);
		} catch {
			/* non-fatal — scoring degrades gracefully */
		}

		// Score all candidates, pick the top scorer
		const scoringTasks = freshStocks.map((stock) => async () => ({
			stock,
			enriched: stock.symbol
				? enrichedSnapshots.get(stock.symbol.toUpperCase()) || null
				: null,
			score: await this.score(
				stock,
				stock.symbol
					? enrichedSnapshots.get(stock.symbol.toUpperCase()) || null
					: null,
			),
		}));
		const scored = (await runConcurrent(scoringTasks, 4)).sort(
			(a, b) => b.score - a.score,
		);
		if (scored.length === 0) return null;

		const {
			stock: topStock,
			enriched: topEnriched,
			score: topScore,
		} = scored[0];
		// ── Fetch live price at generation time ──────────────────────────────
		// Fetching live price at pick-generation time (not stale DB value) so that
		// recoPrice and target are computed against the actual market price.
		// This prevents the YAAP-type bug where the DB price is e.g. ₹140 from
		// last night, target is computed as ₹161, but the stock already opened
		// at ₹158 today and the target is almost reached at the moment of publishing.
		const liveAtGeneration = await this.getLivePrice(topStock.id).catch(() => null);
		const currentPrice = (liveAtGeneration ?? 0) > 0
			? liveAtGeneration!
			: Number.parseFloat(topStock.currentPrice || "0");
		if (currentPrice <= 0) return null;

		const volatility = topStock.volatility
			? Number.parseFloat(topStock.volatility)
			: undefined;
		const { targetPct, stoplossPct } = this.getDynamicTargetStoploss(
			"listed_stocks",
			volatility,
		);
		const targetPrice = Math.round(currentPrice * (1 + targetPct) * 100) / 100;
		const stoplossPrice =
			Math.round(currentPrice * (1 - stoplossPct) * 100) / 100;

		// ── Minimum upside guard ────────────────────────────────────────────
		// If the live price has already run up to within 5% of the target,
		// there is no meaningful upside left. Discard this pick so the engine
		// tries the next-best candidate in the sector.
		// Catches the YAAP scenario: recommended at ₹152, market already at target.
		const MIN_UPSIDE_PCT = 0.05; // require at least 5% headroom to target
		const remainingUpside = (targetPrice - currentPrice) / currentPrice;
		if (remainingUpside < MIN_UPSIDE_PCT) {
			logger.warn(
				`[StockStrategy] ${topStock.symbol}: upside to target is only ${(remainingUpside * 100).toFixed(1)}% — below 5% minimum. Discarding.`,
			);
			return null;
		}

		let directRsi: number | null = null;
		let directRoic: number | null = null;
		if (!topEnriched?.fundamentals?.roic && topStock.roce)
			directRoic = Number.parseFloat(topStock.roce);
		if (!topEnriched?.technicals?.rsi && (topStock.isin || topStock.symbol))
			directRsi = await this.fetchRsiFromGoldenPrices(topStock);

		const sectorLabel = broadSector.label;
		const rationale = await context.service.generateRationale({
			category: "listed_stocks",
			name: topStock.companyName || topStock.symbol,
			symbol: topStock.symbol,
			currentPrice,
			targetPrice,
			stoplossPrice,
			metrics: {
				pe: topStock.peRatio || undefined,
				roic: topEnriched?.fundamentals?.roic ?? directRoic ?? undefined,
				rsi: topEnriched?.technicals?.rsi ?? directRsi ?? undefined,
				returns1y: topStock.returns1Y || undefined,
			},
		});

		const exchange = topStock.nseCode
			? "NSE"
			: topStock.bseCode
				? "BSE"
				: "NSE";
		const riskLevel = this.getRiskLevel(volatility ?? 20);
		const confidenceScore = this.getConfidenceScore(
			"listed_stocks",
			topScore,
			70,
		);
		const suggestedAllocation = calculateSuggestedAllocation(
			"listed_stocks",
			riskLevel,
			confidenceScore,
			{ marketCap: topStock.marketCap },
		);

		return {
			category: "listed_stocks",
			instrumentId: topStock.id,
			instrumentName: topStock.companyName || topStock.symbol,
			isin: topStock.isin || undefined,
			symbol: topStock.symbol,
			exchange,
			recoDate: context.today,
			recoPrice: currentPrice,
			targetPrice,
			stoplossPrice,
			currentPrice,
			status: "live",
			expiryDate: this.getExpiryDate(this.DEFAULT_VALIDITY_DAYS),
			rationale,
			riskLevel,
			suitableFor: this.deriveSuitableFor(riskLevel, "listed_stocks"),
			timeHorizon: this.getTimeHorizon("listed_stocks"),
			confidenceScore,
			// Store both the granular sector and the broad sector label for UI grouping
			sectorCategory: topStock.sector || sectorLabel,
			keyMetrics: {
				cmp: currentPrice,
				pe: topStock.peRatio ? Number.parseFloat(topStock.peRatio) : undefined,
				returns1y: topStock.returns1Y
					? Number.parseFloat(topStock.returns1Y)
					: undefined,
				returns3y: topStock.returns3Y
					? Number.parseFloat(topStock.returns3Y)
					: undefined,
				volatility: volatility,
				sector: topStock.sector || sectorLabel,
				broadSector: broadSector.id, // ← used by the UI for grouping
				broadSectorLabel: sectorLabel, // ← human-readable label
				broadSectorIcon: broadSector.icon,
				broadSectorColor: broadSector.color,
				marketCap: topStock.marketCap || undefined,
				analystRating: topStock.analystRating || undefined,
				roic: topEnriched?.fundamentals?.roic ?? directRoic ?? null,
				rsi: topEnriched?.technicals?.rsi ?? directRsi ?? null,
				suggestedAllocation,
			},
		};
	}

	async score(
		stock: any,
		enriched?: EnrichedStockSnapshot | null,
	): Promise<number> {
		let score = 0;

		const analystRating = stock.analystRating?.toLowerCase() || "";
		if (analystRating.includes("strong buy")) score += 25;
		else if (analystRating.includes("buy")) score += 20;

		const returns1Y = stock.returns1Y ? Number.parseFloat(stock.returns1Y) : 0;
		if (returns1Y > 30) score += 20;
		else if (returns1Y > 15) score += 15;

		const pe = stock.peRatio ? Number.parseFloat(stock.peRatio) : 0;
		if (pe > 0 && pe < 15) score += 15;
		else if (pe >= 15 && pe < 25) score += 10;

		if (stock.marketCap === "Large Cap") score += 10;
		else if (stock.marketCap === "Mid Cap") score += 8;

		const advancedMetrics = await this.calculateAdvancedMetrics(stock);
		if (advancedMetrics.piotroskiFScore && advancedMetrics.piotroskiFScore >= 8)
			score += 15;
		if (advancedMetrics.roic && advancedMetrics.roic > 20) score += 10;

		// ── P0 Alpha Factor A: 52-Week Positioning ──────────────────────────────────
		// Near 52-week high = momentum leader (breakout candidate).
		// Near 52-week low + good fundamentals = value entry point.
		// Near 52w high WITH negative recent momentum = distribution risk → penalise.
		const weekHigh52 = stock.weekHigh52 ? Number.parseFloat(stock.weekHigh52) : null;
		const weekLow52  = stock.weekLow52  ? Number.parseFloat(stock.weekLow52)  : null;
		const curPrice   = stock.currentPrice ? Number.parseFloat(stock.currentPrice) : null;
		if (weekHigh52 && weekLow52 && curPrice && weekHigh52 > weekLow52) {
			const range52 = weekHigh52 - weekLow52;
			const pos52w = (curPrice - weekLow52) / range52; // 0 = at 52w low, 1 = at 52w high
			if (pos52w >= 0.80) score += 12;      // Near 52w high — momentum leader / breakout
			else if (pos52w <= 0.30) score += 8;  // Near 52w low — value entry (contrarian)
			// Penalty: near all-time high with recent negative momentum = distribution
			const returns1Y = stock.returns1Y ? Number.parseFloat(stock.returns1Y) : 0;
			if (pos52w >= 0.90 && returns1Y < 0) score -= 10;
		}

		// ── P0 Alpha Factor B: Beneish M-Score (Earnings Manipulation Detector) ─────
		// M-Score < -2.22: very unlikely manipulation → earnings quality PREMIUM.
		// M-Score > -1.78: possible manipulation → STRONG PENALTY (avoid at all costs).
		// Named after Prof. Messod Beneish — catches Enron-style accounting.
		if (advancedMetrics.beneishMScore !== undefined) {
			const m = advancedMetrics.beneishMScore;
			if (m < -2.99) score += 15;           // Very clean earnings quality
			else if (m < -2.22) score += 8;        // Clean earnings
			else if (m > -1.78) score -= 20;       // Likely manipulation → hard avoid
		}

		// ── P0 Alpha Factor C: Interest Coverage + Quick Ratio (Distress Filter) ────
		// Interest coverage < 1 = company can't service debt = distress trap.
		// Quick ratio < 0.5 = severe near-term liquidity risk.
		// These filters catch "cheap PE" stocks that are actually leveraged traps.
		if (advancedMetrics.interestCoverage !== undefined) {
			const ic = advancedMetrics.interestCoverage;
			if (ic > 5) score += 10;              // Very safe debt serviceability
			else if (ic > 2) score += 5;           // Adequate coverage
			else if (ic < 1) score -= 25;          // Cannot cover interest → distress trap
		}
		if (advancedMetrics.quickRatio !== undefined) {
			const qr = advancedMetrics.quickRatio;
			if (qr > 1.5) score += 8;             // Strong short-term liquidity
			else if (qr < 0.5) score -= 15;        // Severe liquidity risk
		}

		if (enriched) {
			if (enriched.fundamentals?.roe && enriched.fundamentals.roe > 15)
				score += 8;
			if (enriched.growth?.epsGrowth && enriched.growth.epsGrowth > 20)
				score += 8;
		}

		// ── AI Alpha Boost (merged from Stock AI engine) ───────────────────────────
		// Queries the unified AI recommendation engine for additional conviction.
		// Adds up to +20 points based on AI-assessed signal strength.
		// Non-fatal: if AI is unavailable, pick generation continues with quant score only.
		if (stock.symbol) {
			const aiBoost = await this.getAIAlphaBoost(stock, enriched);
			score += aiBoost;
		}

		// ── Day-change circuit penalty ──────────────────────────────────────
		// Heavily penalise stocks whose day change is near lower circuit.
		// This is a safety net on top of the SQL filter: if DB data is slightly
		// stale and circuit hit is not yet reflected in day_change_percent,
		// the penalty drops the score below any reasonable threshold.
		const dayChangePct = stock.dayChangePercent
			? Number.parseFloat(stock.dayChangePercent)
			: null;
		if (dayChangePct !== null && dayChangePct <= -7) score -= 40; // near/at lower circuit
		if (dayChangePct !== null && dayChangePct >= 7) score -= 15;  // near upper circuit gap-up

		return Math.max(0, score);
	}

	/**
	 * Queries the unified AI recommendation engine for an alpha conviction boost.
	 * Returns 0–20 additional score points based on AI signal strength.
	 * Results are cached per symbol for 4 hours to avoid repeated API calls per batch run.
	 *
	 * @param stock - The stock row from listedStocks or screenerStocks.
	 * @param enriched - Optional enriched snapshot with fundamentals/technicals.
	 * @returns A score boost in the range [0, 20]. Returns 0 on any error.
	 */
	private async getAIAlphaBoost(
		stock: any,
		enriched?: EnrichedStockSnapshot | null,
	): Promise<number> {
		const symbol: string = stock.symbol || "";
		if (!symbol) return 0;

		// Check cache first to avoid repeated Gemini calls within the same batch
		const cached = _aiAlphaCache.get(symbol);
		if (cached && Date.now() - cached.ts < AI_ALPHA_CACHE_TTL_MS) {
			return cached.score;
		}

		try {
			const pe = stock.peRatio ? Number.parseFloat(stock.peRatio) : undefined;
			const roe =
				enriched?.fundamentals?.roe ??
				(stock.roe ? Number.parseFloat(stock.roe) : undefined);
			const returns1Y = stock.returns1Y
				? Number.parseFloat(stock.returns1Y)
				: undefined;
			const sector = stock.sector || stock.broadSector || "Equity";
			const currentPrice = stock.currentPrice
				? Number.parseFloat(stock.currentPrice)
				: undefined;

			// Build a ProductData object for the unified engine's analyzeProduct method
			const productData = {
				id: stock.id || symbol,
				name: stock.companyName || symbol,
				category: "stocks" as const,
				ticker: symbol,
				isin: stock.isin,
				sector,
				currentPrice,
				peRatio: pe,
				returns1Y,
				dividendYield: stock.dividendYield
					? Number.parseFloat(stock.dividendYield)
					: undefined,
				rawData: {
					roe,
					marketCap: stock.marketCap,
					analystRating: stock.analystRating,
					returns3Y: stock.returns3Y
						? Number.parseFloat(stock.returns3Y)
						: undefined,
					volatility: stock.volatility
						? Number.parseFloat(stock.volatility)
						: undefined,
				},
			};

			const analysis =
				await unifiedAIRecommendationEngine.analyzeProduct(productData);

			// Map the overall score (0-100) to a boost (0-20 pts).
			// Only apply a meaningful boost for buy-rated, high-confidence picks.
			let boost = 0;
			if (analysis.recommendation === "buy" && analysis.confidenceScore >= 60) {
				boost = Math.round((analysis.overallScore / 100) * 20);
			} else if (analysis.recommendation === "buy") {
				boost = Math.round((analysis.overallScore / 100) * 10);
			}

			boost = Math.max(0, Math.min(20, boost));
			_aiAlphaCache.set(symbol, { score: boost, ts: Date.now() });
			return boost;
		} catch (err) {
			// AI unavailable — non-fatal, quant score is sufficient
			logger.warn(
				`[StockStrategy] AI alpha boost unavailable for ${symbol}: ${err instanceof Error ? err.message : String(err)}`,
			);
			_aiAlphaCache.set(symbol, { score: 0, ts: Date.now() });
			return 0;
		}
	}

	private async calculateAdvancedMetrics(
		stock: any,
	): Promise<{
		piotroskiFScore?: number;
		roic?: number;
		beneishMScore?: number;
		interestCoverage?: number;
		quickRatio?: number;
	}> {
		try {
			if (!stock.id && !stock.symbol) return {};

			// One-time table check: if stockFinancialMetrics is empty, skip all 30
			// per-stock queries and return {} immediately. Cached for the batch run.
			if (_metricsTableHasData === false) return {};
			if (_metricsTableHasData === undefined) {
				const [{ value }] = await db
					.select({ value: count() })
					.from(stockFinancialMetrics);
				_metricsTableHasData = (value ?? 0) > 0;
				if (!_metricsTableHasData) {
					logger.info(
						"[StockStrategy] stockFinancialMetrics table is empty — skipping advanced metrics for this batch",
					);
					return {};
				}
			}

			// Fetch the most recent metrics row for this stock
			const rows = await db
				.select({
					piotroskiFScore: stockFinancialMetrics.piotroskiFScore,
					roic: stockFinancialMetrics.roic,
					roa: stockFinancialMetrics.roa,
					operatingCashFlow: stockFinancialMetrics.operatingCashFlow,
					debtToEquity: stockFinancialMetrics.debtToEquity,
					currentRatio: stockFinancialMetrics.currentRatio,
					grossMargin: stockFinancialMetrics.grossMargin,
					assetTurnover: stockFinancialMetrics.assetTurnover,
					netIncome: stockFinancialMetrics.netIncome,
					// ── P0 Alpha Factors ────────────────────────────────────────────
					beneishMScore: stockFinancialMetrics.beneishMScore,       // earnings manipulation detector
					interestCoverage: stockFinancialMetrics.interestCoverage, // debt serviceability
					quickRatio: stockFinancialMetrics.quickRatio,             // liquidity quality
				})
				.from(stockFinancialMetrics)
				.where(
					stock.id
						? eq(stockFinancialMetrics.stockId, stock.id)
						: eq(stockFinancialMetrics.symbol, stock.symbol),
				)
				.orderBy(desc(stockFinancialMetrics.fiscalYear))
				.limit(1);

			if (rows.length === 0) return {};
			const m = rows[0];

			const roic = m.roic ? Number.parseFloat(m.roic) : undefined;
			const beneishMScore = m.beneishMScore ? Number.parseFloat(m.beneishMScore) : undefined;
			const interestCoverage = m.interestCoverage ? Number.parseFloat(m.interestCoverage) : undefined;
			const quickRatio = m.quickRatio ? Number.parseFloat(m.quickRatio) : undefined;

			// Use pre-computed Piotroski F-Score if available
			if (m.piotroskiFScore != null) {
				return { piotroskiFScore: m.piotroskiFScore, roic, beneishMScore, interestCoverage, quickRatio };
			}

			// Derive a simplified Piotroski-style score from available ratios (4 signals)
			// Full 9-signal score requires 2-year comparison; we score what we can
			let score = 0;
			if (m.roa && Number.parseFloat(m.roa) > 0) score++; // ROA positive
			if (m.operatingCashFlow && Number.parseFloat(m.operatingCashFlow) > 0)
				score++; // OCF positive
			if (m.debtToEquity && Number.parseFloat(m.debtToEquity) < 0.5) score++; // Low leverage
			if (m.currentRatio && Number.parseFloat(m.currentRatio) > 1.5) score++; // Good liquidity
			if (m.grossMargin && Number.parseFloat(m.grossMargin) > 0.3) score++; // Healthy margins
			if (m.assetTurnover && Number.parseFloat(m.assetTurnover) > 0.5) score++; // Efficient assets
			if (m.netIncome && Number.parseFloat(m.netIncome) > 0) score++; // Profitable

			// Scale to 0–9 range proportionally (7 signals → 9)
			const scaledScore = Math.round((score / 7) * 9);
			return { piotroskiFScore: scaledScore, roic, beneishMScore, interestCoverage, quickRatio };
		} catch (err) {
			logger.warn("[StockStrategy] calculateAdvancedMetrics failed:", { error: err instanceof Error ? err.message : String(err) });
			return {};
		}
	}

	private async fetchRsiFromGoldenPrices(stock: any): Promise<number | null> {
		try {
			const cutoff = new Date();
			cutoff.setDate(cutoff.getDate() - 35);
			const priceRows = await db
				.select({
					price: goldenPrices.price,
					priceDate: goldenPrices.priceDate,
				})
				.from(goldenPrices)
				.where(
					and(
						stock.isin
							? eq(goldenPrices.isin, stock.isin)
							: eq(goldenPrices.symbol, stock.symbol!),
						gte(goldenPrices.priceDate, cutoff.toISOString().split("T")[0]),
					),
				)
				.orderBy(asc(goldenPrices.priceDate))
				.limit(40);

			if (priceRows.length >= 15) {
				const closes = priceRows.map((r) => Number.parseFloat(r.price));
				let gains = 0,
					losses = 0;
				for (let i = closes.length - 14; i < closes.length; i++) {
					const diff = closes[i] - closes[i - 1];
					if (diff > 0) gains += diff;
					else losses += Math.abs(diff);
				}
				const avgGain = gains / 14;
				const avgLoss = losses / 14;
				return avgLoss === 0
					? 100
					: Math.round((100 - 100 / (1 + avgGain / avgLoss)) * 100) / 100;
			}
			return null;
		} catch {
			return null;
		}
	}

	/**
	 * Returns the most recent known price for a listed NSE/BSE stock.
	 *
	 * Tier 1 (intraday only — 9:15 AM to 3:30 PM IST):
	 *   FMP real-time quote using symbol.NS (e.g. "RELIANCE.NS").
	 *   Same FMP integration used by GlobalStockStrategy for US stocks.
	 *   Only called during NSE trading window to preserve rate limits.
	 *
	 * Tier 2: Yahoo Finance v8/chart API — open, no key, works 24/7.
	 *   Returns last traded price even after market close.
	 *   FIXES: stocks showing 0.0% return after market hours (e.g. KAMAHOLD, NEPHROCARE).
	 *
	 * Tier 3: Most recent row in `golden_prices` (updated by Pricing Engine @ 9 PM IST
	 *   and MoneyControl sync @ 9:05 PM) — freshest post-market close price.
	 *
	 * Tier 4: `listed_stocks.currentPrice` — updated by enrichment batch (last resort).
	 *
	 * @param instrumentId - UUID of the listed_stocks row.
	 */
	async getLivePrice(instrumentId: string): Promise<number | null> {
		try {
			// Fetch stock base data (ISIN, symbol, currentPrice fallback)
			const stockRow = await db
				.select({ currentPrice: listedStocks.currentPrice, isin: listedStocks.isin, symbol: listedStocks.symbol })
				.from(listedStocks)
				.where(eq(listedStocks.id, instrumentId))
				.limit(1);

			if (!stockRow[0]) return null;

			const { isin, symbol, currentPrice: fallbackPrice } = stockRow[0];

			// ── Market hours check (used by Tier 0 + Tier 1) ────────────────────────
			const nowUtcH = new Date().getUTCHours();
			const nowUtcM = new Date().getUTCMinutes();
			const utcMinutes = nowUtcH * 60 + nowUtcM;
			const NSE_OPEN_UTC = 3 * 60 + 45;   // 9:15 AM IST
			const NSE_CLOSE_UTC = 10 * 60;       // 3:30 PM IST
			const isNSEMarketHours = utcMinutes >= NSE_OPEN_UTC && utcMinutes <= NSE_CLOSE_UTC;

			// ── Tier 0: IndianAPI (primary Indian market source, 5-min cache) ────────
			// Growth plan — 300 req/min dedicated server. Called first during market hours.
			// Falls through silently on error so Tier 1 (FMP) is tried next.
			if (symbol && isNSEMarketHours) {
				try {
					const quoteResult = await indianApiService.getStockQuote(symbol, "NSE");
					const price = quoteResult.data?.current_price;
					if (price != null && Number.isFinite(price) && price > 0) {
						logger.info(`[StockStrategy.getLivePrice] Tier 0 (IndianAPI) for ${symbol}: ₹${price}`);
						// Write-back to pre-warm Tier 4
						db.update(listedStocks)
							.set({ currentPrice: String(price) })
							.where(eq(listedStocks.id, instrumentId))
							.catch(() => {});
						return price;
					}
				} catch (err: any) {
					logger.warn(`[StockStrategy.getLivePrice] IndianAPI Tier 0 failed for ${symbol}: ${err?.message || err}`);
				}
			}

			// ── Tier 1: FMP intraday (NSE market hours only) ────────────────────────

			if (symbol && isNSEMarketHours) {
				const fmpKey = process.env.FMP_API_KEY;
				if (fmpKey && fmpKey.length > 8 && !["dummy", "placeholder", "xxx"].some(p => fmpKey.toLowerCase().includes(p))) {
					try {
						const nseSymbol = `${symbol.toUpperCase()}.NS`;
						const resp = await fetch(
							`https://financialmodelingprep.com/stable/quote?symbol=${encodeURIComponent(nseSymbol)}&apikey=${fmpKey}`,
							{ signal: AbortSignal.timeout(8000), headers: { Accept: "application/json" } },
						);
						if (resp.ok) {
							const data: any[] = await resp.json();
							const price = data?.[0]?.price;
							if (price != null && Number.isFinite(Number(price)) && Number(price) > 0) {
								// Write back to listedStocks in background so next run is pre-warmed
								db.update(listedStocks)
									.set({ currentPrice: String(price) })
									.where(eq(listedStocks.id, instrumentId))
									.catch(() => {});
								return Number(price);
							}
						}
					} catch (err: any) {
						logger.warn(`[StockStrategy.getLivePrice] FMP timeout for ${symbol}.NS: ${err?.message || err}`);
					}
				}
			}

			// ── Tier 2: Yahoo Finance v8/chart API (open endpoint, 24/7, no API key) ─
			// ROOT FIX for 0.0% return bug: FMP is skipped outside market hours,
			// so off-hours picks fell back to recoPrice (= 0% return).
			//
			// SANITY GUARD: Yahoo's regularMarketPrice can carry stale/corporate-action
			// adjusted prices (e.g. NEPHROCARE showed ₹234.8 while 52w-high was ₹183).
			// Strategy: use 5d OHLC closes array → most recent non-null close.
			// OHLC closes are the actual exchange-cleared prices and are immune to
			// Yahoo's meta.regularMarketPrice staleness on rights issues / stock splits.
			// If OHLC is unavailable, fall back to regularMarketPrice with a 3× sanity cap
			// against the DB baseline (fallbackPrice).
			if (symbol) {
				try {
					const nseSymbol = `${symbol.toUpperCase()}.NS`;
					// Use range=5d to get recent OHLC array — last non-null close = actual price
					const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(nseSymbol)}?interval=1d&range=5d`;
					const resp = await fetch(yahooUrl, {
						signal: AbortSignal.timeout(7000),
						headers: {
							"User-Agent": "Mozilla/5.0 (compatible; FintekPro/2.0)",
							Accept: "application/json",
						},
					});
					if (resp.ok) {
						const data: any = await resp.json();
						const result = data?.chart?.result?.[0];
						const meta = result?.meta;
						const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? [];

						// Prefer last non-null OHLC close (actual exchange price, corporate-action immune)
						let price: number | null = null;
						for (let i = closes.length - 1; i >= 0; i--) {
							if (closes[i] != null && Number.isFinite(closes[i]) && closes[i]! > 0) {
								price = closes[i];
								break;
							}
						}

						// Fallback to meta.regularMarketPrice only if OHLC is empty
						if (price === null) {
							const metaPrice = meta?.regularMarketPrice ?? meta?.previousClose;
							if (metaPrice != null && Number.isFinite(Number(metaPrice)) && Number(metaPrice) > 0) {
								// Sanity check: reject if >3× the DB baseline (catches stale rights-adjusted data)
								const baseline = fallbackPrice ? Number.parseFloat(fallbackPrice) : 0;
								if (baseline <= 0 || Number(metaPrice) <= baseline * 3) {
									price = Number(metaPrice);
								} else {
									logger.warn(
										`[StockStrategy.getLivePrice] Yahoo meta price ₹${metaPrice} > 3× baseline ₹${baseline} for ${nseSymbol} — rejected, falling through`
									);
								}
							}
						}

						if (price !== null && price > 0) {
							logger.info(`[StockStrategy.getLivePrice] Yahoo v8/chart OK for ${nseSymbol}: ₹${price}`);
							// Write back so Tier 4 is pre-warmed for next run
							db.update(listedStocks)
								.set({ currentPrice: String(price) })
								.where(eq(listedStocks.id, instrumentId))
								.catch(() => {});
							return price;
						}
					}
				} catch (err: any) {
					logger.warn(`[StockStrategy.getLivePrice] Yahoo v8 failed for ${symbol}: ${err?.message || err}`);
				}
			}

			// ── Tier 3: golden_prices — most recent row by date ─────────────────────
			if (isin || symbol) {
				const gpRow = await db
					.select({ price: goldenPrices.price, priceDate: goldenPrices.priceDate })
					.from(goldenPrices)
					.where(
						isin
							? eq(goldenPrices.isin, isin)
							: eq(goldenPrices.symbol, symbol!),
					)
					.orderBy(desc(goldenPrices.priceDate))
					.limit(1);

				if (gpRow[0]?.price) {
					const gpPrice = Number.parseFloat(gpRow[0].price);
					if (gpPrice > 0) return gpPrice;
				}
			}

			// ── Tier 4: listedStocks.currentPrice ───────────────────────────────────
			return fallbackPrice ? Number.parseFloat(fallbackPrice) : null;
		} catch {
			return null;
		}
	}

	/**
	 * Cross-sector fallback: picks the single best available published stock
	 * without any sector filter, using a template rationale (no AI call).
	 * Called when all 5 broad-sector picks fail (typically AI quota exhaustion).
	 */
	private async pickBestStockFallback(
		context: StrategyContext,
	): Promise<DailyPickData | null> {
		// Query best published stocks regardless of sector
		const candidates = await db
			.select()
			.from(listedStocks)
			.where(
				and(
					eq(listedStocks.isPublished, true),
					sql`${listedStocks.currentPrice} IS NOT NULL`,
					sql`CAST(${listedStocks.currentPrice} AS DECIMAL) > 50`,
					// Circuit breaker: same guard as primary sector picks
					sql`(
						${listedStocks.dayChangePercent} IS NULL
						OR (
							CAST(${listedStocks.dayChangePercent} AS DECIMAL) > -9.5
							AND CAST(${listedStocks.dayChangePercent} AS DECIMAL) < 9.5
						)
					)`,
					sql`(
						${listedStocks.averageVolume} IS NULL
						OR CAST(${listedStocks.averageVolume} AS DECIMAL) > 0
					)`,
				),
			)
			.orderBy(
				// Prioritise analyst-rated Buy stocks, then by 1Y returns
				sql`CASE WHEN LOWER(analyst_rating) LIKE '%strong buy%' THEN 0 WHEN LOWER(analyst_rating) LIKE '%buy%' THEN 1 ELSE 2 END`,
				desc(listedStocks.returns1Y),
			)
			.limit(20);

		if (candidates.length === 0) return null;

		// Exclude recently-picked stocks
		const fresh = candidates.filter(
			(s) => !context.recentIds.has(s.id),
		);
		const pool = fresh.length > 0 ? fresh : candidates;

		// Score without AI (quant-only)
		const scored = (
			await runConcurrent(
				pool.map((s) => async () => ({ s, score: await this.score(s, null) })),
				4,
			)
		).sort((a, b) => b.score - a.score);

		const { s: top } = scored[0];
		// Fetch live price for fallback pick too — same staleness fix as primary path
		const liveAtGeneration = await this.getLivePrice(top.id).catch(() => null);
		const currentPrice = (liveAtGeneration ?? 0) > 0
			? liveAtGeneration!
			: Number.parseFloat(top.currentPrice || "0");
		if (currentPrice <= 0) return null;

		const volatility = top.volatility
			? Number.parseFloat(top.volatility)
			: undefined;
		const { targetPct, stoplossPct } = this.getDynamicTargetStoploss(
			"listed_stocks",
			volatility,
		);
		const targetPrice = Math.round(currentPrice * (1 + targetPct) * 100) / 100;
		const stoplossPrice =
			Math.round(currentPrice * (1 - stoplossPct) * 100) / 100;

		// Upside guard: same 5% minimum as primary sector path
		const remainingUpside = (targetPrice - currentPrice) / currentPrice;
		if (remainingUpside < 0.05) {
			logger.warn(`[StockStrategy/fallback] ${top.symbol}: upside ${(remainingUpside * 100).toFixed(1)}% < 5% minimum. Returning null.`);
			return null;
		}

		const riskLevel = this.getRiskLevel(volatility ?? 20);
		const confidenceScore = this.getConfidenceScore("listed_stocks", scored[0].score, 70);
		const suggestedAllocation = calculateSuggestedAllocation(
			"listed_stocks",
			riskLevel,
			confidenceScore,
			{ marketCap: top.marketCap },
		);

		// Template rationale — no AI needed
		const pe = top.peRatio ? ` P/E ${Number.parseFloat(top.peRatio).toFixed(1)}x,` : "";
		const ret1y = top.returns1Y ? ` +${Number.parseFloat(top.returns1Y).toFixed(1)}% 1Y return,` : "";
		const rationale =
			`${top.companyName || top.symbol} (${top.sector || "Equity"}) shows quant-positive signals:${pe}${ret1y}` +
			` analyst rating: ${top.analystRating || "not rated"}. Entry at ₹${currentPrice.toFixed(2)},` +
			` target ₹${targetPrice.toFixed(2)} (+${(targetPct * 100).toFixed(1)}%), stop-loss ₹${stoplossPrice.toFixed(2)}.` +
			` Market risk applies. This is a quantitative signal — please validate with your advisor.`;

		const exchange = top.nseCode ? "NSE" : top.bseCode ? "BSE" : "NSE";
		const broadSector = mapToBroadSector(top.sector);
		const bsMeta = BROAD_SECTORS.find((b) => b.id === broadSector) ?? BROAD_SECTORS[0];

		return {
			category: "listed_stocks",
			instrumentId: top.id,
			instrumentName: top.companyName || top.symbol,
			isin: top.isin || undefined,
			symbol: top.symbol,
			exchange,
			recoDate: context.today,
			recoPrice: currentPrice,
			targetPrice,
			stoplossPrice,
			currentPrice,
			status: "live",
			expiryDate: this.getExpiryDate(this.DEFAULT_VALIDITY_DAYS),
			rationale,
			riskLevel,
			suitableFor: this.deriveSuitableFor(riskLevel, "listed_stocks"),
			timeHorizon: this.getTimeHorizon("listed_stocks"),
			confidenceScore,
			sectorCategory: top.sector || bsMeta.label,
			keyMetrics: {
				cmp: currentPrice,
				pe: top.peRatio ? Number.parseFloat(top.peRatio) : undefined,
				returns1y: top.returns1Y ? Number.parseFloat(top.returns1Y) : undefined,
				volatility,
				sector: top.sector || bsMeta.label,
				broadSector: bsMeta.id,
				broadSectorLabel: bsMeta.label,
				broadSectorIcon: bsMeta.icon,
				broadSectorColor: bsMeta.color,
				marketCap: top.marketCap || undefined,
				analystRating: top.analystRating || undefined,
				roic: null,
				rsi: null,
				suggestedAllocation,
			},
		};
	}
}
