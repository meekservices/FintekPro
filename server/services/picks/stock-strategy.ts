import { logger } from "../../logger";
import { db } from "../../db";
import {
	listedStocks,
	goldenPrices,
	stockFinancialMetrics,
} from "@shared/schema";
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

// ── Fix D: Gemini quota circuit breaker ───────────────────────────────────────
// After CIRCUIT_FAIL_THRESHOLD consecutive quota/rate-limit errors within
// CIRCUIT_WINDOW_MS, the circuit opens and all AI alpha calls skip Gemini
// entirely for CIRCUIT_COOLDOWN_MS (15 min). This prevents 40-symbol pre-warm
// from exhausting Gemini quota at 9 AM IST and ensures quant score still runs.
const _geminiCircuit = {
	failures: 0,           // consecutive quota-error count
	openAt: 0,             // timestamp when circuit opened (0 = closed)
	lastFailureAt: 0,      // timestamp of most recent failure
};
const CIRCUIT_FAIL_THRESHOLD = 3;
const CIRCUIT_WINDOW_MS = 5 * 60 * 1000;   // 5-min window for consecutive failures
const CIRCUIT_COOLDOWN_MS = 15 * 60 * 1000; // 15-min cooldown once open

/** Returns true if the circuit is OPEN (Gemini calls should be skipped). */
function isGeminiCircuitOpen(): boolean {
	if (_geminiCircuit.openAt === 0) return false;
	if (Date.now() - _geminiCircuit.openAt > CIRCUIT_COOLDOWN_MS) {
		// Auto-reset after cooldown
		_geminiCircuit.failures = 0;
		_geminiCircuit.openAt = 0;
		_geminiCircuit.lastFailureAt = 0;
		return false;
	}
	return true;
}

/** Called on every Gemini quota/rate-limit error. Opens the circuit after threshold. */
function recordGeminiFailure(): void {
	const now = Date.now();
	// Reset counter if last failure was more than CIRCUIT_WINDOW_MS ago
	if (now - _geminiCircuit.lastFailureAt > CIRCUIT_WINDOW_MS) {
		_geminiCircuit.failures = 0;
	}
	_geminiCircuit.failures++;
	_geminiCircuit.lastFailureAt = now;
	if (_geminiCircuit.failures >= CIRCUIT_FAIL_THRESHOLD && _geminiCircuit.openAt === 0) {
		_geminiCircuit.openAt = now;
		// Use process.stderr to avoid circular logger import issues at module level
		process.stderr.write(
			`[StockStrategy] Gemini circuit OPENED after ${CIRCUIT_FAIL_THRESHOLD} consecutive quota errors. ` +
			`Quant-only mode for ${CIRCUIT_COOLDOWN_MS / 60000} min.\n`,
		);
	}
}

/** Called on a successful Gemini response — resets the failure counter. */
function recordGeminiSuccess(): void {
	_geminiCircuit.failures = 0;
	_geminiCircuit.lastFailureAt = 0;
}

// ── Fix 5: Nifty 50 1Y return cache ──────────────────────────────────────────
// Used for relative momentum scoring: stock 1Y return − Nifty 1Y return.
// Refreshed once per day via Yahoo Finance v8 (no API key, no rate limit).
// Falls back to a calibrated 15% if fetch fails.
let _nifty1YCache: { value: number | null; ts: number } = { value: null, ts: 0 };
const NIFTY_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Returns the Nifty 50 trailing 1-year return (as a percentage).
 * Returns null only until the first successful fetch; thereafter uses the
 * cached value. Non-fatal — if fetch fails the cache retains the last value.
 */
function getNifty1YReturn(): number | null {
	if (
		_nifty1YCache.value !== null &&
		Date.now() - _nifty1YCache.ts < NIFTY_CACHE_TTL_MS
	) {
		return _nifty1YCache.value;
	}
	// Kick off background refresh — non-blocking
	void (async () => {
		try {
			const url =
				"https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI?range=1y&interval=1mo";
			const res = await fetch(url, {
				headers: { "User-Agent": "Mozilla/5.0" },
				signal: AbortSignal.timeout(5000),
			});
			if (!res.ok) return;
			const json = await res.json();
			const closes: number[] =
				json?.chart?.result?.[0]?.indicators?.adjclose?.[0]?.adjclose ?? [];
			if (closes.length >= 2) {
				const first = closes.find((c) => c != null);
				const last = closes.findLast((c) => c != null);
				if (first && last && first > 0) {
					const ret1Y = ((last - first) / first) * 100;
					_nifty1YCache = { value: Math.round(ret1Y * 10) / 10, ts: Date.now() };
					logger.info(`[StockStrategy] Nifty 1Y return refreshed: ${_nifty1YCache.value}%`);
				}
			}
		} catch {
			// Non-fatal — use cached or default
		}
	})();
	// Return last known value or calibrated default
	return _nifty1YCache.value ?? 15; // 15% = approximate long-run Nifty avg
}

// ── Fix 6: Earnings calendar exclusion cache ──────────────────────────────────
// Per-symbol cache: true = has board meeting (results) in next N days.
const _earningsBlacklist = new Map<string, { hasEarnings: boolean; ts: number }>();
const EARNINGS_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Returns true if the stock has a board meeting to discuss quarterly results
 * within the next `daysAhead` calendar days.
 * Non-fatal: returns false on any error so the pick generation continues.
 *
 * @param symbol  NSE ticker symbol
 * @param daysAhead  Look-forward window (default 3)
 */
async function hasEarningsInNextNDays(
	symbol: string,
	daysAhead = 3,
): Promise<boolean> {
	const cached = _earningsBlacklist.get(symbol);
	if (cached && Date.now() - cached.ts < EARNINGS_CACHE_TTL_MS) {
		return cached.hasEarnings;
	}
	try {
		// Lightweight NSE board-meetings check using the exported NseIndiaProvider instance
		const { nseIndiaProviderInstance } = await import("../market-movers-cache");
		const report = await nseIndiaProviderInstance.fetchCorporateReports(symbol);
		const today = new Date();
		const cutoff = new Date(today);
		cutoff.setDate(cutoff.getDate() + daysAhead);
		const todayStr = today.toISOString().split("T")[0];
		const cutoffStr = cutoff.toISOString().split("T")[0];

		const hasEarnings = report.boardMeetings.some((m: any) => {
			const mtgDate = m.meetingDate ?? "";
			const purpose = (m.purpose ?? "").toLowerCase();
			// Match only results / financial results meetings — not AGMs or dividend meetings
			const isResultsMeeting =
				purpose.includes("result") ||
				purpose.includes("financial") ||
				purpose.includes("quarterly");
			return isResultsMeeting && mtgDate >= todayStr && mtgDate <= cutoffStr;
		});

		_earningsBlacklist.set(symbol, { hasEarnings, ts: Date.now() });
		return hasEarnings;
	} catch {
		return false; // non-fatal
	}
}

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

			// ── Fix 1: 2-day broad-sector dedup ─────────────────────────────────────
			// Prevents the same broad sector (e.g. IT) from being picked 3 days in a row.
			// Reads the last 2 days of stock picks from dailyPicks and tracks which
			// broadSector IDs were used. Non-fatal: if DB fails, proceed without dedup.
			const recentBroadSectors = new Set<string>();
			try {
				const { dailyPicks } = await import("@shared/schema");
				const { gte, eq } = await import("drizzle-orm");
				const twoDaysAgo = new Date();
				twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
				const recentPicks = await db
					.select({ keyMetrics: dailyPicks.keyMetrics })
					.from(dailyPicks)
					.where(
						and(
							eq(dailyPicks.category, "listed_stocks"),
							gte(dailyPicks.recoDate, twoDaysAgo.toISOString().split("T")[0]),
						),
					);
				for (const p of recentPicks) {
					const km = p.keyMetrics as Record<string, any> | null;
					if (km?.broadSector) recentBroadSectors.add(String(km.broadSector));
				}
				if (recentBroadSectors.size > 0) {
					logger.info(`[StockStrategy] Fix 1: excluding ${recentBroadSectors.size} recently-used broad sectors: ${[...recentBroadSectors].join(", ")}`);
				}
			} catch {
				// Non-fatal — proceed without sector dedup
			}

			for (const broadSector of BROAD_SECTORS) {
				// Fix 1: Skip sectors used in the last 2 days
				if (recentBroadSectors.has(broadSector.id) && results.length > 0) {
					logger.info(`[StockStrategy] Fix 1: skipping ${broadSector.label} (recently used)`);
					continue;
				}
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
			// ── Candidate pool: 40 per sector (was 8) ──────────────────────────────
			// Larger pool gives the multi-factor scorer real differentiation room.
			// After usedIds dedup + 5% upside guard + circuit filter, 8 candidates
			// left almost no choice. 40 candidates is processed by runConcurrent(4)
			// so no extra latency from concurrency.
			.limit(40);

		// Fallback to listedStocks if listedStocks has no sector data
		if (stocks.length === 0) {
			const screenerConditions = broadSector.keywords.map((kw) =>
				ilike(listedStocks.sector, `%${kw}%`),
			);
			const screenerRows = await db
				.select()
				.from(listedStocks)
				.where(
					and(
						eq(listedStocks.isActive, true),
						sql`${listedStocks.currentPrice} IS NOT NULL`,
						sql`CAST(${listedStocks.currentPrice} AS DECIMAL) > 50`,
						or(...screenerConditions),
					),
				)
				// Screener fallback also uses the larger 40-candidate pool
				.limit(40);

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
						lastUpdated: new Date(), // listedStocks.updatedAt not in schema; use current time
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

		// ── Fix 6: Earnings calendar exclusion (3-day forward) ──────────────────
		// Stocks with a board meeting (quarterly results) in the next 3 days carry
		// 3x normal binary event risk. Exclude them from this run's candidate pool.
		// The filter is async + parallel; any individual NSE API failure means that
		// stock is kept in the pool (non-fatal: we never drop to zero candidates
		// due to a broken API call).
		let eligibleStocks = freshStocks;
		try {
			const earningsFlags = await Promise.allSettled(
				freshStocks.map((s) =>
					s.symbol
						? hasEarningsInNextNDays(s.symbol)
						: Promise.resolve(false),
				),
			);
			const beforeCount = freshStocks.length;
			eligibleStocks = freshStocks.filter((_, i) => {
				const result = earningsFlags[i];
				return result.status === "fulfilled" ? !result.value : true;
			});
			const excluded = beforeCount - eligibleStocks.length;
			if (excluded > 0) {
				logger.info(
					`[StockStrategy] ${broadSector.label}: earnings exclusion removed ${excluded}/${beforeCount} candidates`,
				);
			}
			// Safety: if ALL candidates have earnings this week, fall back to full pool
			if (eligibleStocks.length === 0) eligibleStocks = freshStocks;
		} catch {
			eligibleStocks = freshStocks; // non-fatal fallback
		}

		// Fetch enriched snapshots for scoring
		const symbols = eligibleStocks
			.map((s) => s.symbol)
			.filter(Boolean) as string[];
		let enrichedSnapshots: Map<string, EnrichedStockSnapshot> = new Map();
		try {
			enrichedSnapshots = await getEnrichedStockSnapshots(symbols);
		} catch {
			/* non-fatal — scoring degrades gracefully */
		}

		// Score all candidates, pick the top scorer
		// ── Fix 2: Pre-warm AI alpha cache in parallel ──────────────────────────
		await Promise.allSettled(
			eligibleStocks
				.filter((s) => s.symbol)
				.map((s) =>
					this.getAIAlphaBoost(
						s,
						s.symbol ? enrichedSnapshots.get(s.symbol.toUpperCase()) || null : null,
					),
				),
		);

		const scoringTasks = eligibleStocks.map((stock) => async () => ({
			stock,
			enriched: stock.symbol
				? enrichedSnapshots.get(stock.symbol.toUpperCase()) || null
				: null,
			score: await this.score(
				stock,
				stock.symbol
					? enrichedSnapshots.get(stock.symbol.toUpperCase()) || null
					: null,
				context, // Fix 2: pass context for regime-aware scoring
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
		const { targetPct, stoplossPct, atrPct } = this.getDynamicTargetStoploss(
			"listed_stocks",
			volatility,
			currentPrice,
		);
		const targetPrice = Math.round(currentPrice * (1 + targetPct) * 100) / 100;
		const stoplossPrice =
			Math.round(currentPrice * (1 - stoplossPct) * 100) / 100;

		// ── Minimum upside guard ────────────────────────────────────────────
		// If the live price has already run up to within 5% of the target,
		// there is no meaningful upside left.
		const MIN_UPSIDE_PCT = 0.05;
		const remainingUpside = (targetPrice - currentPrice) / currentPrice;
		if (remainingUpside < MIN_UPSIDE_PCT) {
			logger.warn(
				`[StockStrategy] ${topStock.symbol}: upside to target is only ${(remainingUpside * 100).toFixed(1)}% — below 5% minimum. Discarding.`,
			);
			return null;
		}

		// ── #2: Reward-to-Risk gate (min 1.5:1) ───────────────────────────────────
		// ATR stoploss is computed but we must verify the final R:R is adequate.
		// A 6% target with 5.5% stoploss has R:R of 1.09 — too thin to publish.
		// Minimum R:R of 1.5:1 ensures the position is worth the risk taken.
		const rrRatio = (targetPrice - currentPrice) / Math.max(currentPrice - stoplossPrice, 0.01);
		if (rrRatio < 1.5) {
			logger.warn(
				`[StockStrategy] ${topStock.symbol}: R:R ratio ${rrRatio.toFixed(2)} < 1.5 minimum. Discarding.`,
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
		// ── #5: Updated score normalisation max (70 → 120) ──────────────────────────
		// P0 Alpha factors (Beneish, Interest Coverage, Quick Ratio, RSI, Volume,
		// 52-week positioning) added ~50 pts to the theoretical max score.
		// Using 70 caused confScore > 100 clipping. 120 reflects current signal set.
		const STOCK_SCORE_MAX = 120;
		const confidenceScore = this.getConfidenceScore(
			"listed_stocks",
			topScore,
			STOCK_SCORE_MAX,
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
				broadSector: broadSector.id,
				broadSectorLabel: sectorLabel,
				broadSectorIcon: broadSector.icon,
				broadSectorColor: broadSector.color,
				marketCap: topStock.marketCap || undefined,
				analystRating: topStock.analystRating || undefined,
				roic: topEnriched?.fundamentals?.roic ?? directRoic ?? null,
				rsi: topEnriched?.technicals?.rsi ?? directRsi ?? null,
				suggestedAllocation,
				rawQuantScore: Math.min(100, Math.round((topScore / STOCK_SCORE_MAX) * 100)),
				qualityTier:
					Math.round((topScore / STOCK_SCORE_MAX) * 100) >= 80 ? "Premium"
					: Math.round((topScore / STOCK_SCORE_MAX) * 100) >= 60 ? "Strong"
					: Math.round((topScore / STOCK_SCORE_MAX) * 100) >= 40 ? "Good"
					: "Weak",
				atr14Pct: atrPct,
				// #2: expose R:R ratio in keyMetrics for advisor transparency
				rewardToRiskRatio: Math.round(rrRatio * 100) / 100,
			},
		};
	}

	async score(
		stock: any,
		enriched?: EnrichedStockSnapshot | null,
		/** Optional StrategyContext — used for Fix 2 market-regime-aware score multipliers */
		context?: StrategyContext | null,
	): Promise<number> {
		let score = 0;

		const analystRating = stock.analystRating?.toLowerCase() || "";
		if (analystRating.includes("strong buy")) score += 25;
		else if (analystRating.includes("buy")) score += 20;

		// ── Fix 2a: prefer screener OHLCV return_1y over stale listed_stocks.returns1Y ──
		// screener_derived_metrics.return_1y is computed nightly from OHLCV price history.
		// listed_stocks.returns1Y is a static FMP column updated infrequently.
		const returns1Y = enriched?.performance?.return1Y
			?? (stock.returns1Y ? Number.parseFloat(stock.returns1Y) : 0);
		if (returns1Y > 30) score += 20;
		else if (returns1Y > 15) score += 15;

		// ── Fix 5: Relative Momentum — returns vs Nifty 50 benchmark ──────────────
		// Absolute 1Y return of 20% looks great, but if Nifty returned 25%, this
		// stock is actually a momentum laggard — bad pick signal.
		// relativeMomentum = stock1Y − nifty1Y
		// +15%+ relative outperformance → strong signal boost
		// −10%+ underperformance → meaningful penalty (momentum loser)
		const nifty1Y = getNifty1YReturn(); // lightweight cached fetch
		if (nifty1Y !== null) {
			const relMomentum = returns1Y - nifty1Y;
			if (relMomentum >= 15) score += 12;       // Strong relative outperformer
			else if (relMomentum >= 5) score += 6;    // Moderate outperformer
			else if (relMomentum <= -10) score -= 10; // Clear momentum laggard
		}

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
			const screenerReturn1Y = enriched?.performance?.return1Y
				?? (stock.returns1Y ? Number.parseFloat(stock.returns1Y) : 0);
			if (pos52w >= 0.90 && screenerReturn1Y < 0) score -= 10;
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

			// ── Fix 2b: FintekPro screener composite quality signal ──
			// compositeScore (0–100): holistic quality+value+growth+risk blend
			const cs = enriched.derivedMetrics?.compositeScore ?? 0;
			if (cs >= 75) score += 15;       // strong buy-zone quality
			else if (cs >= 60) score += 8;   // moderate quality signal

			// fintekRating (1–5): platform advisory rating
			const fr = enriched.derivedMetrics?.fintekRating ?? 0;
			if (fr >= 4) score += 10;        // Buy / Strong Buy
			else if (fr === 3) score += 5;   // Hold

			// ── Fix 2c: beta/maxDrawdown risk penalty ──
			// High beta stocks in down markets are distribution traps.
			// Severe drawdown history (-40%+) = systemic risk in portfolio.
			const beta = enriched.performance?.beta;
			if (beta != null && beta > 1.8) score -= 8;  // very high market sensitivity
			const maxDd = enriched.performance?.maxDrawdown1Y;
			if (maxDd != null && maxDd < -40) score -= 10; // severe 1Y drawdown
		}

		// ── AI Alpha Boost (merged from Stock AI engine) ───────────────────────────
		// Queries the unified AI recommendation engine for additional conviction.
		// Adds up to +20 points based on AI-assessed signal strength.
		// Non-fatal: if AI is unavailable, pick generation continues with quant score only.
		if (stock.symbol) {
			const aiBoost = await this.getAIAlphaBoost(stock, enriched);
			score += aiBoost;
		}

		// ── #1: Volume / liquidity quality signal ──────────────────────────────────
		// A stock can score perfectly on fundamentals yet be illiquid (500 shares/day).
		// Illiquid picks cause advisors to move the stock 2–3% on entry alone.
		// daily turnover ≈ averageVolume × price gives a proxy for liquidity depth.
		// Uses curPrice (parsed from stock.currentPrice in 52w block above).
		const avgVolume = stock.averageVolume ? Number.parseFloat(stock.averageVolume) : null;
		if (avgVolume !== null && curPrice && curPrice > 0) {
			const dailyTurnover = avgVolume * curPrice; // in ₹
			if (dailyTurnover >= 50_000_000) score += 10;      // >₹5 Cr daily — highly liquid
			else if (dailyTurnover >= 10_000_000) score += 5;  // >₹1 Cr daily — adequate
			else if (dailyTurnover < 2_000_000) score -= 15;   // <₹20L daily — illiquid trap
		}

		// ── #4: RSI momentum entry signal ─────────────────────────────────────────
		// RSI computed from golden_prices and pre-populated in keyMetrics.
		// Using it in score() lets the engine prefer ideal entry zones and avoid
		// overbought stocks, even when fundamentals are strong.
		// RSI 40–65: healthy trend momentum, ideal entry zone
		// RSI < 30:  oversold — contrarian entry (only for fundamentally sound stocks)
		// RSI > 75:  overbought — poor entry timing, avoid regardless of fundamentals
		const rsiForScore = enriched?.technicals?.rsi ?? null;
		if (rsiForScore !== null) {
			if (rsiForScore >= 40 && rsiForScore <= 65) score += 8;  // Ideal entry zone
			else if (rsiForScore < 30) score += 5;                   // Oversold — contrarian entry
			else if (rsiForScore > 75) score -= 12;                  // Overbought — poor timing
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

		// ── Fix 2: Market-regime-aware score multipliers ──────────────────────────
		// Adjust signal weights based on current market regime from detectRegime().
		// BEAR/HIGH_VOL: boost defensive characteristics, penalise high-beta momentum.
		// NEUTRAL:       shift weight towards value (low-PE, high-ROIC) signals.
		// BULL:          momentum weights already optimised — no additional adjustment.
		const regime = context?.regime ?? "BULL";
		if (regime === "BEAR" || regime === "HIGH_VOL") {
			// ✔ Dividend yield → safe harbour income premium in volatile markets
			if (stock.dividendYield) {
				const dy = Number.parseFloat(stock.dividendYield);
				if (dy >= 3) score += 12;       // strong income floor
				else if (dy >= 1.5) score += 6; // moderate yield buffer
			}
			// ✔ Low beta → defensive profile (less drawdown in falling markets)
			const betaRegime = enriched?.performance?.beta ?? (stock.beta ? Number.parseFloat(stock.beta) : null);
			if (betaRegime !== null) {
				if (betaRegime < 0.7) score += 10;       // very defensive
				else if (betaRegime < 1.0) score += 5;   // mild defensive
				else if (betaRegime > 1.5) score -= 12;  // high-beta = magnified drawdown risk
			}
			// ✘ Fast-falling stocks get extra penalty in bear regime
			const ret1M = stock.returns1M ? Number.parseFloat(stock.returns1M) : null;
			if (ret1M !== null && ret1M < -5) score -= 8;
		} else if (regime === "NEUTRAL") {
			// Sideways market: reward value + quality compounders
			const pe = stock.peRatio ? Number.parseFloat(stock.peRatio) : 0;
			if (pe > 0 && pe < 12) score += 8;  // deep value bonus in range-bound markets
			if (advancedMetrics.roic && advancedMetrics.roic > 25) score += 6; // high ROIC compounder
		}

		return Math.max(0, score);
	}


	/**
	 * Queries the unified AI recommendation engine for an alpha conviction boost.
	 * Returns 0–20 additional score points based on AI signal strength.
	 * Results are cached per symbol for 4 hours to avoid repeated API calls per batch run.
	 *
	 * @param stock - The stock row from listedStocks or listedStocks.
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

		// ── Fix D: Circuit breaker check ────────────────────────────────────────
		// Skip Gemini entirely if the circuit is open (quota exhausted).
		if (isGeminiCircuitOpen()) {
			logger.warn(`[StockStrategy] Gemini circuit OPEN — skipping AI alpha for ${symbol} (quant-only mode)`);
			_aiAlphaCache.set(symbol, { score: 0, ts: Date.now() });
			return 0;
		}

		try {
			const pe = stock.peRatio ? Number.parseFloat(stock.peRatio) : undefined;
			const roe =
				enriched?.fundamentals?.roe ??
				(stock.roe ? Number.parseFloat(stock.roe) : undefined);
			// Fix 2d: prefer screener OHLCV return in AI boost context data
			const returns1Y = enriched?.performance?.return1Y
				?? (stock.returns1Y ? Number.parseFloat(stock.returns1Y) : undefined);
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
			recordGeminiSuccess();
			_aiAlphaCache.set(symbol, { score: boost, ts: Date.now() });
			return boost;
		} catch (err) {
			// Identify quota/rate-limit errors to feed the circuit breaker
			const msg = err instanceof Error ? err.message : String(err);
			const isQuotaError = /429|quota|rate.?limit|resource.?exhausted/i.test(msg);
			if (isQuotaError) {
				recordGeminiFailure();
			}
			// AI unavailable — non-fatal, quant score is sufficient
			logger.warn(
				`[StockStrategy] AI alpha boost unavailable for ${symbol}: ${msg}`,
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

		// ── #6: Pre-fetch enriched snapshots for fallback pool ────────────────────
		// Previously score(s, null) was called, losing RSI, ROE, EPS growth, beta,
		// composite score signals. Fallback picks now score with full signal coverage.
		const fallbackSymbols = pool.map(s => s.symbol).filter((x): x is string => Boolean(x));
		let fallbackEnriched: Map<string, EnrichedStockSnapshot> = new Map();
		try {
			fallbackEnriched = await getEnrichedStockSnapshots(fallbackSymbols);
		} catch { /* non-fatal — score degrades to quant-only */ }

		// Score with enriched data (quant + fundamental signals, no AI to preserve speed)
		const scored = (
			await runConcurrent(
				pool.map((s) => async () => ({
					s,
					score: await this.score(
						s,
						s.symbol ? fallbackEnriched.get(s.symbol.toUpperCase()) ?? null : null,
					),
				})),
				4,
			)
		).sort((a, b) => b.score - a.score);

		const { s: top } = scored[0];
		const topFallbackEnriched = top.symbol ? fallbackEnriched.get(top.symbol.toUpperCase()) ?? null : null;
		// Fetch live price for fallback pick too — same staleness fix as primary path
		const liveAtGeneration = await this.getLivePrice(top.id).catch(() => null);
		const currentPrice = (liveAtGeneration ?? 0) > 0
			? liveAtGeneration!
			: Number.parseFloat(top.currentPrice || "0");
		if (currentPrice <= 0) return null;

		const volatility = top.volatility
			? Number.parseFloat(top.volatility)
			: undefined;
		const { targetPct, stoplossPct, atrPct: atrPctFb } = this.getDynamicTargetStoploss(
			"listed_stocks",
			volatility,
			currentPrice,
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
		const STOCK_SCORE_MAX = 120; // consistent with primary sector path
		const confidenceScore = this.getConfidenceScore("listed_stocks", scored[0].score, STOCK_SCORE_MAX);
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
				roic: topFallbackEnriched?.fundamentals?.roic ?? null,
				rsi: topFallbackEnriched?.technicals?.rsi ?? null,
				suggestedAllocation,
				rawQuantScore: Math.min(100, Math.round((scored[0].score / STOCK_SCORE_MAX) * 100)),
				qualityTier:
					Math.round((scored[0].score / STOCK_SCORE_MAX) * 100) >= 80 ? "Premium"
					: Math.round((scored[0].score / STOCK_SCORE_MAX) * 100) >= 60 ? "Strong"
					: Math.round((scored[0].score / STOCK_SCORE_MAX) * 100) >= 40 ? "Good"
					: "Weak",
				atr14Pct: atrPctFb,
			},
		};
	}
}
