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
import { recalculateAllMetrics } from "../services/screener/derived-metrics-engine";
import { fmpUsageMonitor } from "../services/screener/fmp-usage-monitor";
import {
	runPriorityEnrichmentBatch,
	enrichSingleTier,
	getExtendedEnrichmentProgress,
} from "../services/screener/priority-enrichment-scheduler";
import { exchangeStockService } from "../services/exchange-stock-service";

const router = Router();

router.get("/api/screener/stocks", async (req, res) => {
	try {
		const filters: ScreenerFilters = {
			sector: req.query.sector as string,
			industry: req.query.industry as string,
			marketCapCategory: req.query.marketCapCategory as string,
			exchange: req.query.exchange as string,
			search: req.query.search as string,
			sortBy: req.query.sortBy as string,
			sortOrder: (req.query.sortOrder as "asc" | "desc") || "asc",
			page: req.query.page ? Number.parseInt(req.query.page as string) : 1,
			limit: req.query.limit ? Number.parseInt(req.query.limit as string) : 25,
		};

		if (req.query.minPE)
			filters.minPE = Number.parseFloat(req.query.minPE as string);
		if (req.query.maxPE)
			filters.maxPE = Number.parseFloat(req.query.maxPE as string);
		if (req.query.minPB)
			filters.minPB = Number.parseFloat(req.query.minPB as string);
		if (req.query.maxPB)
			filters.maxPB = Number.parseFloat(req.query.maxPB as string);
		if (req.query.minROE)
			filters.minROE = Number.parseFloat(req.query.minROE as string);
		if (req.query.maxROE)
			filters.maxROE = Number.parseFloat(req.query.maxROE as string);
		if (req.query.minDebtToEquity)
			filters.minDebtToEquity = Number.parseFloat(
				req.query.minDebtToEquity as string,
			);
		if (req.query.maxDebtToEquity)
			filters.maxDebtToEquity = Number.parseFloat(
				req.query.maxDebtToEquity as string,
			);
		if (req.query.minDividendYield)
			filters.minDividendYield = Number.parseFloat(
				req.query.minDividendYield as string,
			);
		if (req.query.maxDividendYield)
			filters.maxDividendYield = Number.parseFloat(
				req.query.maxDividendYield as string,
			);
		if (req.query.minCompositeScore)
			filters.minCompositeScore = Number.parseFloat(
				req.query.minCompositeScore as string,
			);
		if (req.query.maxCompositeScore)
			filters.maxCompositeScore = Number.parseFloat(
				req.query.maxCompositeScore as string,
			);
		if (req.query.minFintekRating)
			filters.minFintekRating = Number.parseInt(
				req.query.minFintekRating as string,
			);

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
		res
			.status(500)
			.json({ error: "Failed to get stock detail", message: err.message });
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
		const distribution = await getScreenerDistribution();
		res.json(distribution);
	} catch (err: any) {
		res
			.status(500)
			.json({ error: "Failed to get distribution", message: err.message });
	}
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
		const result = await recalculateAllMetrics();
		res.json(result);
	} catch (err: any) {
		res
			.status(500)
			.json({ error: "Metrics recalculation failed", message: err.message });
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
