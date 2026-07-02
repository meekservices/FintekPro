import { Router } from "express";
import { db } from "../db";
import { sql, eq, desc } from "drizzle-orm";
import {
	screenerGrowthMetrics,
	screenerKeyMetrics,
	screenerDcfValuations,
	screenerCompanyRatings,
	screenerAnalystTargets,
	screenerAnalystGrades,
	screenerInstitutionalHolders,
	screenerInsiderTrades,
	screenerStockNews,
	screenerTechnicalIndicators,
} from "@shared/schema";
import {
	queryScreener,
	getStockDetail,
	getScreenerStats,
	getScreenerDistribution,
	type ScreenerFilters,
} from "../services/screener/screener-query-engine";
import {
	enrichStockProfiles,
	enrichFinancialRatios,
	enrichPriceHistory,
	seedScreenerFromFmp,
	seedFromListedStocks,
	seedUnlistedToScreener,
	isProductionEnrichmentAllowed,
	runDailyEnrichmentBatch,
	getEnrichmentProgress,
} from "../services/screener/enrichment-service";
import { recalculateAllMetrics, runOHLCVReturnPass } from "../services/screener/derived-metrics-engine";
import { ingestPriceHistory, ingestBenchmarkSymbols } from "../services/screener/screener-price-history-service";
import { fmpUsageMonitor } from "../services/screener/fmp-usage-monitor";
import {
	runPriorityEnrichmentBatch,
	enrichSingleTier,
	getExtendedEnrichmentProgress,
} from "../services/screener/priority-enrichment-scheduler";
import { exchangeStockService } from "../services/exchange-stock-service";
import { computePivotLevels } from "../services/screener/technical-calculator";
import {
	getShareholdingForSymbol,
	runShareholdingBatchJob,
} from "../services/screener/shareholding-service";

const router = Router();

// ── Distribution cache — 5-min TTL to reduce DB load on full-table joins ─────
// The distribution query joins 3700+ screener_stocks + derived_metrics rows.
// Since distribution data changes only on enrichment runs (not per-request),
// a 5-min server-side cache cuts DB queries by ~98% under normal page traffic.
const DIST_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let _distCache: { data: unknown; ts: number } | null = null;

/** Returns cached distribution or recomputes it and caches the result. */
async function getCachedDistribution(): Promise<unknown> {
	const now = Date.now();
	if (_distCache && now - _distCache.ts < DIST_CACHE_TTL_MS) {
		return _distCache.data;
	}
	const data = await getScreenerDistribution();
	_distCache = { data, ts: now };
	return data;
}

/** Call this whenever enrichment runs to force a fresh distribution on next request. */
export function invalidateDistributionCache(): void {
	_distCache = null;
}


router.get("/api/screener/stocks", async (req, res) => {
	try {
		const f = req.query;
		const p = (k: string) => f[k] ? Number.parseFloat(f[k] as string) : undefined;
		const pi = (k: string) => f[k] ? Number.parseInt(f[k] as string) : undefined;

		const filters: ScreenerFilters = {
			// Universe
			sector: f.sector as string,
			industry: f.industry as string,
			marketCapCategory: f.marketCapCategory as string,
			exchange: f.exchange as string,
			index: f.index as string,
			search: f.search as string,
			sortBy: f.sortBy as string,
			sortOrder: (f.sortOrder as "asc" | "desc") || "asc",
			page: pi("page") || 1,
			limit: pi("limit") || 25,
			// Fundamentals
			minPE: p("minPE"), maxPE: p("maxPE"),
			minPB: p("minPB"), maxPB: p("maxPB"),
			minROE: p("minROE"), maxROE: p("maxROE"),
			minROCE: p("minROCE"), maxROCE: p("maxROCE"),
			minDebtToEquity: p("minDebtToEquity"), maxDebtToEquity: p("maxDebtToEquity"),
			minDividendYield: p("minDividendYield"), maxDividendYield: p("maxDividendYield"),
			minCurrentRatio: p("minCurrentRatio"), maxCurrentRatio: p("maxCurrentRatio"),
			minEPS: p("minEPS"),
			// Scoring
			minCompositeScore: p("minCompositeScore"), maxCompositeScore: p("maxCompositeScore"),
			minFintekRating: pi("minFintekRating"),
			minPiotroski: pi("minPiotroski"), maxPiotroski: pi("maxPiotroski"),
			technicalRating: f.technicalRating as string,
			// Returns (all computed from OHLCV — never static)
			minReturn1W: p("minReturn1W"), maxReturn1W: p("maxReturn1W"),
			minReturn1M: p("minReturn1M"), maxReturn1M: p("maxReturn1M"),
			minReturn3M: p("minReturn3M"), maxReturn3M: p("maxReturn3M"),
			minReturn6M: p("minReturn6M"), maxReturn6M: p("maxReturn6M"),
			minReturn1Y: p("minReturn1Y"), maxReturn1Y: p("maxReturn1Y"),
			minReturnYTD: p("minReturnYTD"), maxReturnYTD: p("maxReturnYTD"),
			// Risk
			minBeta: p("minBeta"), maxBeta: p("maxBeta"),
			minSharpe: p("minSharpe"),
			maxDrawdown: p("maxDrawdown"),
			// Technical
			minRSI: p("minRSI"), maxRSI: p("maxRSI"),
			// Shareholding
			minPromoterHolding: p("minPromoterHolding"), maxPromoterHolding: p("maxPromoterHolding"),
			minFIIHolding: p("minFIIHolding"), maxFIIHolding: p("maxFIIHolding"),
			minDIIHolding: p("minDIIHolding"),
			maxPledged: p("maxPledged"),
		};

		const result = await queryScreener(filters);

		// Auto-add missing stock: when a search query returns 0 results, look it up from NSE/BSE
		if (
			result.total === 0 &&
			filters.search &&
			filters.search.trim().length >= 2
		) {
			const lookup = await exchangeStockService.lookupAndAddStock(
				filters.search.trim(),
			);
			if (lookup.found) {
				console.log(
					`[Screener] Auto-added "${filters.search}" from exchange — re-querying`,
				);
				const retryResult = await queryScreener(filters);
				return res.json({ ...retryResult, autoAdded: true });
			}
		}

		res.json(result);
	} catch (err: any) {
		console.error("[Screener] Query error:", err.message);
		res
			.status(500)
			.json({ error: "Failed to query screener", message: err.message });
	}
});

router.get("/api/screener/stocks/:symbol", async (req, res) => {
	try {
		const result = await getStockDetail(req.params.symbol);
		if (!result) {
			return res.status(404).json({ error: "Stock not found" });
		}
		res.json(result);
	} catch (err: any) {
		res.status(500).json({ error: "Failed to get stock detail", message: err.message });
	}
});

/**
 * GET /api/screener/stocks/:symbol/pivots
 * Computes all 4 pivot level methods (Classic, Fibonacci, Camarilla, Woodie)
 * from the previous session's OHLCV. Always computed on-demand — values change daily.
 */
router.get("/api/screener/stocks/:symbol/pivots", async (req, res) => {
	try {
		const { symbol } = req.params;
		// Fetch previous session OHLCV from screener_technical_indicators
		const [ti] = await db
			.select()
			.from(screenerTechnicalIndicators)
			.where(eq(screenerTechnicalIndicators.symbol, symbol))
			.orderBy(desc(screenerTechnicalIndicators.date))
			.limit(1);

		if (!ti || !ti.high || !ti.low || !ti.close) {
			return res.status(404).json({
				error: "Price data not available",
				message: `No OHLCV data found for ${symbol}. Enrichment may be pending.`,
			});
		}

		const pivots = computePivotLevels(
			Number(ti.high),
			Number(ti.low),
			Number(ti.close),
			Number(ti.open) || undefined,
		);

		res.json({
			success: true,
			data: {
				symbol,
				basedOn: { date: ti.date, high: ti.high, low: ti.low, close: ti.close, open: ti.open },
				pivots,
			},
			meta: { timestamp: new Date().toISOString(), version: "1.0" },
		});
	} catch (err: any) {
		res.status(500).json({ error: "Failed to compute pivots", message: err.message });
	}
});

/**
 * GET /api/screener/stocks/:symbol/shareholding
 * Returns latest quarterly shareholding pattern for a stock.
 * Promoter%, FII%, DII%, Public%, Pledged% with QoQ changes.
 */
router.get("/api/screener/stocks/:symbol/shareholding", async (req, res) => {
	try {
		const { symbol } = req.params;
		const data = await getShareholdingForSymbol(symbol);
		if (!data) {
			return res.status(404).json({
				error: "Shareholding data not available",
				message: `No shareholding data found for ${symbol}. Run shareholding enrichment batch first.`,
			});
		}
		res.json({
			success: true,
			data,
			meta: { timestamp: new Date().toISOString(), version: "1.0" },
		});
	} catch (err: any) {
		res.status(500).json({ error: "Failed to get shareholding", message: err.message });
	}
});

router.get("/api/screener/stats", async (req, res) => {
	try {
		const [dbStats, apiUsage] = await Promise.all([
			getScreenerStats(),
			fmpUsageMonitor.getDailyStats(),
		]);
		res.json({ database: dbStats, apiUsage });
	} catch (err: any) {
		res
			.status(500)
			.json({ error: "Failed to get stats", message: err.message });
	}
});

router.get("/api/screener/distribution", async (req, res) => {
	try {
		const distribution = await getCachedDistribution();
		res.json(distribution);
	} catch (err: any) {
		res
			.status(500)
			.json({ error: "Failed to get distribution", message: err.message });
	}
});

// Admin: force-invalidate the distribution cache (e.g. after bulk enrichment)
router.post("/api/screener/distribution/bust", async (_req, res) => {
	invalidateDistributionCache();
	res.json({ success: true, message: "Distribution cache invalidated" });
});

router.get("/api/screener/admin/enrichment-progress", async (req, res) => {
	try {
		const progress = await getEnrichmentProgress();
		const apiUsage = await fmpUsageMonitor.getDailyStats();
		res.json({ progress, apiUsage });
	} catch (err: any) {
		res
			.status(500)
			.json({
				error: "Failed to get enrichment progress",
				message: err.message,
			});
	}
});

router.post("/api/screener/admin/seed", async (req, res) => {
	try {
		const exchange = (req.body?.exchange as string) || "NSE";
		const limit = req.body?.limit || 50;
		const result = await seedScreenerFromFmp(exchange, limit);
		res.json(result);
	} catch (err: any) {
		res.status(500).json({ error: "Seed failed", message: err.message });
	}
});

router.post("/api/screener/admin/seed-from-db", async (req, res) => {
	try {
		const limit = req.body?.limit || 50;
		const result = await seedFromListedStocks(limit);
		res.json(result);
	} catch (err: any) {
		res.status(500).json({ error: "DB seed failed", message: err.message });
	}
});

router.post("/api/screener/admin/seed-unlisted", async (req, res) => {
	try {
		const limit = req.body?.limit || 50;
		const result = await seedUnlistedToScreener(limit);
		res.json(result);
	} catch (err: any) {
		res
			.status(500)
			.json({ error: "Unlisted seed failed", message: err.message });
	}
});

router.post("/api/screener/admin/enrich/profiles", async (req, res) => {
	try {
		if (!isProductionEnrichmentAllowed() && !req.body?.force) {
			return res.json({
				task: "stock_profiles",
				processed: 0,
				errors: 0,
				skipped: 0,
				apiCallsUsed: 0,
				remaining: 0,
				message:
					"FMP enrichment restricted to production. Use force=true to override.",
			});
		}
		const batchSize = req.body?.batchSize || 10;
		const result = await enrichStockProfiles(batchSize);
		res.json(result);
	} catch (err: any) {
		res
			.status(500)
			.json({ error: "Profile enrichment failed", message: err.message });
	}
});

router.post("/api/screener/admin/enrich/ratios", async (req, res) => {
	try {
		if (!isProductionEnrichmentAllowed() && !req.body?.force) {
			return res.json({
				task: "financial_ratios",
				processed: 0,
				errors: 0,
				skipped: 0,
				apiCallsUsed: 0,
				remaining: 0,
				message:
					"FMP enrichment restricted to production. Use force=true to override.",
			});
		}
		const batchSize = req.body?.batchSize || 5;
		const result = await enrichFinancialRatios(batchSize);
		res.json(result);
	} catch (err: any) {
		res
			.status(500)
			.json({ error: "Ratio enrichment failed", message: err.message });
	}
});

router.post("/api/screener/admin/enrich/prices", async (req, res) => {
	try {
		if (!isProductionEnrichmentAllowed() && !req.body?.force) {
			return res.json({
				task: "price_history",
				processed: 0,
				errors: 0,
				skipped: 0,
				apiCallsUsed: 0,
				remaining: 0,
				message:
					"FMP enrichment restricted to production. Use force=true to override.",
			});
		}
		const batchSize = req.body?.batchSize || 3;
		const result = await enrichPriceHistory(batchSize);
		res.json(result);
	} catch (err: any) {
		res
			.status(500)
			.json({ error: "Price enrichment failed", message: err.message });
	}
});

router.post("/api/screener/admin/enrich/daily-batch", async (req, res) => {
	try {
		if (!isProductionEnrichmentAllowed() && !req.body?.force) {
			return res.json({
				message:
					"Daily enrichment restricted to production. Use force=true to override.",
				totalApiCalls: 0,
			});
		}
		const result = await runDailyEnrichmentBatch({
			ratiosBatchSize: req.body?.ratiosBatchSize || 150,
			pricesBatchSize: req.body?.pricesBatchSize || 90,
			maxApiCalls: req.body?.maxApiCalls || 240,
		});
		res.json(result);
	} catch (err: any) {
		res
			.status(500)
			.json({ error: "Daily enrichment batch failed", message: err.message });
	}
});

router.post("/api/screener/admin/recalculate-metrics", async (req, res) => {
	try {
		// Phase 1: bulk SQL score update (fast, ~2s). Returns immediately.
		const result = await recalculateAllMetrics();
		res.json({
			...result,
			background: "OHLCV return pass running in background (~90s)",
			meta: { timestamp: new Date().toISOString(), version: "1.0" },
		});
		// Phase 2: per-symbol OHLCV returns (slow, ~90s). Fire and forget.
		void runOHLCVReturnPass().then(r =>
			console.log(`[Metrics] Background OHLCV pass done: ${r.processed} symbols, ${r.errors} errors`)
		).catch(err =>
			console.error("[Metrics] Background OHLCV pass failed:", err?.message)
		);
	} catch (err: any) {
		res
			.status(500)
			.json({ error: "Metrics recalculation failed", message: err.message });
	}
});

/**
 * POST /api/screener/admin/normalize-market-caps
 * One-shot fix: normalises market_cap_category to lowercase codes
 * ('Micro Cap' -> 'micro', 'Large Cap' -> 'large', etc.) and recomputes
 * from market_cap_value for stocks where category is NULL or unrecognised.
 * Safe to run multiple times (idempotent). Also triggered automatically
 * by recalculateAllMetrics().
 */
router.post("/api/screener/admin/normalize-market-caps", async (req, res) => {
	try {
		const result = await db.execute(sql`
      UPDATE screener_stocks SET market_cap_category =
        CASE
          WHEN LOWER(market_cap_category) IN ('mega cap','mega')    THEN 'mega'
          WHEN LOWER(market_cap_category) IN ('large cap','large')  THEN 'large'
          WHEN LOWER(market_cap_category) IN ('mid cap','mid')      THEN 'mid'
          WHEN LOWER(market_cap_category) IN ('small cap','small')  THEN 'small'
          WHEN LOWER(market_cap_category) IN ('micro cap','micro')  THEN 'micro'
          WHEN market_cap_value IS NOT NULL AND market_cap_value::numeric >= 1000000000000 THEN 'mega'
          WHEN market_cap_value IS NOT NULL AND market_cap_value::numeric >= 200000000000  THEN 'large'
          WHEN market_cap_value IS NOT NULL AND market_cap_value::numeric >= 50000000000   THEN 'mid'
          WHEN market_cap_value IS NOT NULL AND market_cap_value::numeric >= 5000000000    THEN 'small'
          WHEN market_cap_value IS NOT NULL AND market_cap_value::numeric >  0             THEN 'micro'
          ELSE market_cap_category
        END
      WHERE is_active = true
        AND (
          market_cap_category ~ '[A-Z ]'
          OR (market_cap_category IS NULL AND market_cap_value IS NOT NULL)
        )
    `);
		const updated = (result as any)?.rowCount ?? 0;
		res.json({
			success: true,
			updated,
			message: `Normalised ${updated} market_cap_category values`,
			meta: { timestamp: new Date().toISOString(), version: "1.0" },
		});
	} catch (err: any) {
		res.status(500).json({ error: "Market cap normalisation failed", message: err.message });
	}
});

/**
 * POST /api/screener/admin/sync-to-listed-stocks
 * Copies return1Y, return3Y, beta, volatility from screener_derived_metrics → listed_stocks.
 * Bridges the screener pipeline (80%+ return/beta coverage) to the recommendation engine
 * which reads listed_stocks for pick generation and scoring.
 *
 * Safe to run multiple times (idempotent UPDATE WHERE symbol matches).
 * Run this after /recalculate-metrics has completed.
 */
router.post("/api/screener/admin/sync-to-listed-stocks", async (req, res) => {
	try {
		const result = await db.execute(sql`
      UPDATE listed_stocks ls
      SET
        returns_1y    = sdm.return_1y,
        returns_3y    = sdm.return_3y,
        returns_1m    = sdm.return_1m,
        returns_3m    = sdm.return_3m,
        returns_6m    = sdm.return_6m,
        beta          = sdm.beta,
        volatility    = sdm.volatility_30d,
        last_updated  = NOW()
      FROM screener_derived_metrics sdm
      WHERE UPPER(ls.symbol) = UPPER(sdm.symbol)
        AND (
          sdm.return_1y IS NOT NULL
          OR sdm.beta IS NOT NULL
        )
    `);
		const rowCount = (result as any).rowCount ?? (result as any).count ?? 0;
		console.log(`[SyncToListed] Updated ${rowCount} listed_stocks rows from screener_derived_metrics`);
		res.json({
			success: true,
			updated: rowCount,
			message: `Synced screener_derived_metrics → listed_stocks for ${rowCount} symbols`,
			meta: { timestamp: new Date().toISOString(), version: "1.0" },
		});
	} catch (err: any) {
		console.error("[SyncToListed] Error:", err?.message);
		res.status(500).json({ error: "Sync failed", message: err.message });
	}
});

/**
 * POST /api/screener/admin/shareholding-refresh
 * Triggers full quarterly shareholding batch (BSE → NSE fallback) for all stocks.
 * Safe to run multiple times — uses UPSERT on (symbol, quarter_date).
 */
router.post("/api/screener/admin/shareholding-refresh", async (req, res) => {
	try {
		const limit = req.body?.limit ? Number(req.body.limit) : 100;
		const result = await runShareholdingBatchJob(limit);
		res.json({
			success: true,
			...result,
			meta: { timestamp: new Date().toISOString(), version: "1.0" },
		});
	} catch (err: any) {
		res.status(500).json({
			success: false,
			error: "Shareholding batch failed",
			message: err.message,
			meta: { timestamp: new Date().toISOString(), version: "1.0" },
		});
	}
});

/**
 * POST /api/screener/admin/shareholding-refresh/:symbol
 * Refresh shareholding for a single symbol (on-demand).
 */
router.post("/api/screener/admin/shareholding-refresh/:symbol", async (req, res) => {
	try {
		const { symbol } = req.params;
		const data = await getShareholdingForSymbol(symbol.toUpperCase());
		res.json({
			success: true,
			data,
			meta: { timestamp: new Date().toISOString(), version: "1.0" },
		});
	} catch (err: any) {
		res.status(500).json({
			success: false,
			error: "Single-symbol shareholding refresh failed",
			message: err.message,
			meta: { timestamp: new Date().toISOString(), version: "1.0" },
		});
	}
});

/**
 * POST /api/screener/admin/fetch-price-history
 * Synchronously ingest 5-year OHLCV from Yahoo Finance into screener_price_history.
 * Holds the HTTP connection open while processing (keeps Cloud Run CPU active).
 * Body: { limit?: number (default 200), offset?: number (default 0), force?: boolean }
 * Tip: run parallel curl calls with --max-time 120 to cover all symbol offsets.
 */
router.post("/api/screener/admin/fetch-price-history", async (req, res) => {
	try {
		const limit  = Number(req.body?.limit  ?? 200);
		const offset = Number(req.body?.offset ?? 0);
		const force  = Boolean(req.body?.force ?? false);

		// SYNCHRONOUS — await result so Cloud Run keeps CPU active throughout
		const result = await ingestPriceHistory(limit, force, offset);

		console.log(
			`[PriceHistory] Batch complete: ok=${result.succeeded} failed=${result.failed} rows=${result.totalRows}`,
		);

		res.json({
			success: true,
			processed: result.processed,
			succeeded: result.succeeded,
			failed: result.failed,
			totalRows: result.totalRows,
			meta: { timestamp: new Date().toISOString(), version: "1.0" },
		});
	} catch (err: any) {
		res.status(500).json({
			success: false,
			error: "Price history ingestion failed",
			message: err.message,
			meta: { timestamp: new Date().toISOString(), version: "1.0" },
		});
	}
});

/**
 * POST /api/screener/admin/fetch-benchmarks
 * Fetch and persist 5-year OHLCV for market index benchmarks (^NSEI, ^BSESN, ^NSEBANK).
 * Stored as-is in screener_price_history; used as beta benchmark in recalculate-metrics.
 * Body: { tickers?: string[] } — defaults to ["^NSEI", "^BSESN", "^NSEBANK"]
 */
router.post("/api/screener/admin/fetch-benchmarks", async (req, res) => {
	try {
		const tickers: string[] = req.body?.tickers ?? ["^NSEI", "^BSESN", "^NSEBANK"];
		const results = await ingestBenchmarkSymbols(tickers);
		res.json({
			success: true,
			results,
			meta: { timestamp: new Date().toISOString(), version: "1.0" },
		});
	} catch (err: any) {
		res.status(500).json({
			success: false,
			error: "Benchmark ingestion failed",
			message: err.message,
			meta: { timestamp: new Date().toISOString(), version: "1.0" },
		});
	}
});

router.get("/api/screener/admin/api-usage", async (req, res) => {
	try {
		const stats = await fmpUsageMonitor.getDailyStats();
		res.json(stats);
	} catch (err: any) {
		res
			.status(500)
			.json({ error: "Failed to get API usage", message: err.message });
	}
});

router.get("/api/screener/admin/extended-progress", async (req, res) => {
	try {
		const progress = await getExtendedEnrichmentProgress();
		const apiUsage = await fmpUsageMonitor.getDailyStats();
		res.json({ ...progress, apiUsage });
	} catch (err: any) {
		res
			.status(500)
			.json({ error: "Failed to get extended progress", message: err.message });
	}
});

router.post("/api/screener/admin/enrich/priority-batch", async (req, res) => {
	try {
		if (!isProductionEnrichmentAllowed() && !req.body?.force) {
			return res.json({
				message:
					"Priority enrichment restricted to production. Use force=true to override.",
				totalApiCalls: 0,
			});
		}
		const budgetSplit = req.body?.budgetSplit || undefined;
		const maxApiCalls = req.body?.maxApiCalls || 240;
		const result = await runPriorityEnrichmentBatch(budgetSplit, maxApiCalls);
		res.json(result);
	} catch (err: any) {
		res
			.status(500)
			.json({ error: "Priority batch failed", message: err.message });
	}
});

router.post("/api/screener/admin/enrich/tier/:tierNumber", async (req, res) => {
	try {
		if (!isProductionEnrichmentAllowed() && !req.body?.force) {
			return res.json({
				message:
					"Tier enrichment restricted to production. Use force=true to override.",
				totalApiCalls: 0,
			});
		}
		const tierNumber = Number.parseInt(req.params.tierNumber) as 1 | 2 | 3 | 4;
		if (![1, 2, 3, 4].includes(tierNumber)) {
			return res
				.status(400)
				.json({ error: "Invalid tier number. Must be 1-4." });
		}
		const budget = req.body?.budget || 50;
		const result = await enrichSingleTier(tierNumber, budget);
		res.json(result);
	} catch (err: any) {
		res
			.status(500)
			.json({
				error: `Tier ${req.params.tierNumber} enrichment failed`,
				message: err.message,
			});
	}
});

router.get("/api/screener/stocks/:symbol/growth", async (req, res) => {
	try {
		const symbol = req.params.symbol;
		const rows = await db
			.select()
			.from(screenerGrowthMetrics)
			.where(eq(screenerGrowthMetrics.symbol, symbol))
			.orderBy(desc(screenerGrowthMetrics.date))
			.limit(5);
		res.json({ data: rows });
	} catch (err: any) {
		res.status(500).json({ error: err.message });
	}
});

router.get("/api/screener/stocks/:symbol/key-metrics", async (req, res) => {
	try {
		const symbol = req.params.symbol;
		const rows = await db
			.select()
			.from(screenerKeyMetrics)
			.where(eq(screenerKeyMetrics.symbol, symbol))
			.orderBy(desc(screenerKeyMetrics.date))
			.limit(5);
		res.json({ data: rows });
	} catch (err: any) {
		res.status(500).json({ error: err.message });
	}
});

router.get("/api/screener/stocks/:symbol/dcf", async (req, res) => {
	try {
		const symbol = req.params.symbol;
		const rows = await db
			.select()
			.from(screenerDcfValuations)
			.where(eq(screenerDcfValuations.symbol, symbol))
			.orderBy(desc(screenerDcfValuations.date))
			.limit(1);
		res.json({ data: rows });
	} catch (err: any) {
		res.status(500).json({ error: err.message });
	}
});

router.get("/api/screener/stocks/:symbol/rating", async (req, res) => {
	try {
		const symbol = req.params.symbol;
		const rows = await db
			.select()
			.from(screenerCompanyRatings)
			.where(eq(screenerCompanyRatings.symbol, symbol))
			.orderBy(desc(screenerCompanyRatings.date))
			.limit(1);
		res.json({ data: rows });
	} catch (err: any) {
		res.status(500).json({ error: err.message });
	}
});

router.get("/api/screener/stocks/:symbol/analyst-targets", async (req, res) => {
	try {
		const symbol = req.params.symbol;
		const rows = await db
			.select()
			.from(screenerAnalystTargets)
			.where(eq(screenerAnalystTargets.symbol, symbol))
			.orderBy(desc(screenerAnalystTargets.publishedDate))
			.limit(10);
		res.json({ data: rows });
	} catch (err: any) {
		res.status(500).json({ error: err.message });
	}
});

router.get("/api/screener/stocks/:symbol/analyst-grades", async (req, res) => {
	try {
		const symbol = req.params.symbol;
		const rows = await db
			.select()
			.from(screenerAnalystGrades)
			.where(eq(screenerAnalystGrades.symbol, symbol))
			.orderBy(desc(screenerAnalystGrades.publishedDate))
			.limit(10);
		res.json({ data: rows });
	} catch (err: any) {
		res.status(500).json({ error: err.message });
	}
});

router.get(
	"/api/screener/stocks/:symbol/institutional-holders",
	async (req, res) => {
		try {
			const symbol = req.params.symbol;
			const rows = await db
				.select()
				.from(screenerInstitutionalHolders)
				.where(eq(screenerInstitutionalHolders.symbol, symbol))
				.orderBy(desc(screenerInstitutionalHolders.dateReported))
				.limit(20);
			res.json({ data: rows });
		} catch (err: any) {
			res.status(500).json({ error: err.message });
		}
	},
);

router.get("/api/screener/stocks/:symbol/insider-trades", async (req, res) => {
	try {
		const symbol = req.params.symbol;
		const rows = await db
			.select()
			.from(screenerInsiderTrades)
			.where(eq(screenerInsiderTrades.symbol, symbol))
			.orderBy(desc(screenerInsiderTrades.transactionDate))
			.limit(20);
		res.json({ data: rows });
	} catch (err: any) {
		res.status(500).json({ error: err.message });
	}
});

router.get("/api/screener/stocks/:symbol/news", async (req, res) => {
	try {
		const symbol = req.params.symbol;
		const rows = await db
			.select()
			.from(screenerStockNews)
			.where(eq(screenerStockNews.symbol, symbol))
			.orderBy(desc(screenerStockNews.publishedDate))
			.limit(10);
		res.json({ data: rows });
	} catch (err: any) {
		res.status(500).json({ error: err.message });
	}
});

router.get("/api/screener/stocks/:symbol/technicals", async (req, res) => {
	try {
		const symbol = req.params.symbol;
		const rows = await db
			.select()
			.from(screenerTechnicalIndicators)
			.where(eq(screenerTechnicalIndicators.symbol, symbol))
			.orderBy(desc(screenerTechnicalIndicators.date))
			.limit(1);
		res.json({ data: rows });
	} catch (err: any) {
		res.status(500).json({ error: err.message });
	}
});

router.get("/api/screener/calendar/earnings", async (req, res) => {
	try {
		const result = await db.execute(
			sql`SELECT * FROM screener_earnings_calendar ORDER BY date ASC LIMIT 100`,
		);
		res.json({ data: (result as any).rows || result });
	} catch (err: any) {
		res.status(500).json({ error: err.message });
	}
});

router.get("/api/screener/calendar/dividends", async (req, res) => {
	try {
		const result = await db.execute(
			sql`SELECT * FROM screener_dividend_calendar ORDER BY date ASC LIMIT 100`,
		);
		res.json({ data: (result as any).rows || result });
	} catch (err: any) {
		res.status(500).json({ error: err.message });
	}
});

router.get("/api/screener/calendar/splits", async (req, res) => {
	try {
		const result = await db.execute(
			sql`SELECT * FROM screener_split_calendar ORDER BY date ASC LIMIT 100`,
		);
		res.json({ data: (result as any).rows || result });
	} catch (err: any) {
		res.status(500).json({ error: err.message });
	}
});

router.get("/api/screener/calendar/ipos", async (req, res) => {
	try {
		const result = await db.execute(
			sql`SELECT * FROM screener_ipo_calendar ORDER BY date ASC LIMIT 100`,
		);
		res.json({ data: (result as any).rows || result });
	} catch (err: any) {
		res.status(500).json({ error: err.message });
	}
});

router.get("/api/screener/calendar/economic", async (req, res) => {
	try {
		const result = await db.execute(
			sql`SELECT * FROM screener_economic_calendar ORDER BY date ASC LIMIT 100`,
		);
		res.json({ data: (result as any).rows || result });
	} catch (err: any) {
		res.status(500).json({ error: err.message });
	}
});

router.get("/api/screener/sector-performance", async (req, res) => {
	try {
		const result = await db.execute(
			sql`SELECT * FROM screener_sector_performance ORDER BY date DESC, changes_percentage DESC LIMIT 50`,
		);
		res.json({ data: (result as any).rows || result });
	} catch (err: any) {
		res.status(500).json({ error: err.message });
	}
});

export default router;
