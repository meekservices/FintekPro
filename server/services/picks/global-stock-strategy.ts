import { db } from "../../db";
import { sql } from "drizzle-orm";
import { logger } from "../../logger";
import { BaseStrategy } from "./base-strategy";
import { StrategyContext } from "./types";
import {
	DailyPickData,
	PickCategory,
	calculateSuggestedAllocation,
} from "../pick-of-the-day-service";

/**
 * Curated global stock pool with SECTOR tags for rotation.
 * Prices are June 2026 approximate levels — overridden by live Yahoo Finance data at pick time.
 * Returns are trailing 12M approximations as of June 2026.
 */
const GLOBAL_FALLBACK_POOL = [
	{
		name: "Apple Inc.",
		symbol: "AAPL",
		exchange: "NASDAQ",
		market: "us",
		lastPrice: 196,
		sector: "Technology",
		currency: "USD",
		peRatio: 31,
		returns1Y: 14,
	},
	{
		name: "Microsoft Corp.",
		symbol: "MSFT",
		exchange: "NASDAQ",
		market: "us",
		lastPrice: 432,
		sector: "Technology",
		currency: "USD",
		peRatio: 36,
		returns1Y: 22,
	},
	{
		name: "Alphabet Inc.",
		symbol: "GOOGL",
		exchange: "NASDAQ",
		market: "us",
		lastPrice: 178,
		sector: "Communication",
		currency: "USD",
		peRatio: 23,
		returns1Y: 28,
	},
	{
		name: "Amazon.com Inc.",
		symbol: "AMZN",
		exchange: "NASDAQ",
		market: "us",
		lastPrice: 205,
		sector: "Consumer/Cloud",
		currency: "USD",
		peRatio: 42,
		returns1Y: 30,
	},
	{
		name: "NVIDIA Corp.",
		symbol: "NVDA",
		exchange: "NASDAQ",
		market: "us",
		lastPrice: 145,
		sector: "Semiconductors",
		currency: "USD",
		peRatio: 48,
		returns1Y: 170,
	},
	{
		name: "Meta Platforms",
		symbol: "META",
		exchange: "NASDAQ",
		market: "us",
		lastPrice: 588,
		sector: "Communication",
		currency: "USD",
		peRatio: 26,
		returns1Y: 58,
	},
	{
		name: "Tesla Inc.",
		symbol: "TSLA",
		exchange: "NASDAQ",
		market: "us",
		lastPrice: 248,
		sector: "Auto/EV",
		currency: "USD",
		peRatio: 75,
		returns1Y: -12,
	},
	{
		name: "ASML Holding",
		symbol: "ASML",
		exchange: "NASDAQ",
		market: "us",
		lastPrice: 735,
		sector: "Semiconductors",
		currency: "USD",
		peRatio: 40,
		returns1Y: 12,
	},
	{
		name: "LVMH",
		symbol: "MC",
		exchange: "EPA",
		market: "europe",
		lastPrice: 595,
		sector: "Luxury",
		currency: "EUR",
		peRatio: 19,
		returns1Y: -8,
	},
	{
		name: "Taiwan Semiconductor (ADR)",
		symbol: "TSM",
		exchange: "NYSE",
		market: "us",
		lastPrice: 185,
		sector: "Semiconductors",
		currency: "USD",
		peRatio: 24,
		returns1Y: 82,
	},
];


/**
 * Phase 1 fix: Real scoring for global stocks (previously hardcoded 60).
 *
 * Signals:
 *  - 1Y return momentum (primary for global picks — trend following works globally)
 *  - P/E ratio (value screen)
 *  - Analyst consensus / known quality
 *  - Sector preference aligned with current global cycle
 */
function scoreGlobalStock(stock: any): number {
	let score = 0;

	// Momentum: 1Y return — strong momentum is the #1 global signal
	const returns1Y = Number.parseFloat(
		stock.returns1Y ?? stock.returns_1y ?? stock.returns1y ?? "0",
	);
	if (returns1Y > 50) score += 30;
	else if (returns1Y > 25) score += 22;
	else if (returns1Y > 10) score += 15;
	else if (returns1Y < -10) score -= 10; // avoid falling knives

	// Valuation: P/E ratio
	const pe = Number.parseFloat(
		stock.peRatio ?? stock.pe_ratio ?? stock.pe ?? "0",
	);
	if (pe > 0 && pe < 20) score += 15;
	else if (pe >= 20 && pe < 35) score += 10;
	else if (pe >= 35 && pe < 50) score += 5;
	else if (pe > 60) score -= 5; // overvalued territory

	// Sector cycle preference (AI/Semiconductor supercycle + defensive)
	const sector = (stock.sector || "").toLowerCase();
	if (sector.includes("semiconductor")) score += 15;
	else if (sector.includes("technology") || sector.includes("tech"))
		score += 12;
	else if (sector.includes("communication")) score += 10;
	else if (sector.includes("healthcare") || sector.includes("pharma"))
		score += 8;
	else if (sector.includes("consumer")) score += 6;
	else if (sector.includes("luxury")) score += 5;

	// Market preference: US markets have deeper liquidity for Indian investors
	if (stock.market === "us") score += 5;

	// Market cap proxy: higher price generally = more established (for global large caps)
	const price = Number.parseFloat(
		String(stock.lastPrice ?? stock.last_price ?? "0"),
	);
	if (price > 300) score += 5;
	else if (price > 100) score += 3;

	// ── Fix 9: USD/INR Currency risk flag ─────────────────────────────────────────
	// When INR depreciates sharply vs USD, Indian investors effectively pay
	// more for US stocks than their USD price suggests. This is a hidden cost
	// most advisors don't account for in pick selection.
	//
	// USD_INR_CURRENT is set by the daily enrichment scheduler (or falls back
	// to 84.5, the approximate rate as of July 2026).
	// USD_INR_3M is the rate 3 months ago (used for trend direction).
	//
	// Adjustment: only applied to USD-denominated global picks.
	if (stock.currency === "USD" || stock.market === "us") {
		const currentRate = Number(process.env.USD_INR_CURRENT || "84.5");
		const rate3mAgo = Number(process.env.USD_INR_3M || "83.0");
		if (currentRate > 0 && rate3mAgo > 0) {
			const depreciation = ((currentRate - rate3mAgo) / rate3mAgo) * 100;
			if (depreciation > 5) score -= 15;       // INR fell >5% in 3M — significant FX headwind
			else if (depreciation > 3) score -= 8;   // INR fell 3-5% — moderate FX headwind
			else if (depreciation < -2) score += 5;  // INR strengthened — global picks are cheaper
		}
	}

	return Math.max(score, 1);
}

export class GlobalStockStrategy extends BaseStrategy {
	category: PickCategory = "global_stocks";

	async generate(context: StrategyContext): Promise<DailyPickData | null> {
		try {
			// Phase 1 fix: ORDER BY meaningful signals (momentum + market cap), not RANDOM()
			// Wrap in nested try-catch: missing columns (pe_ratio etc.) fall through to GLOBAL_FALLBACK_POOL
			let rows: any[] = [];
			try {
				const dbStocks = await db.execute(sql`
        SELECT id, name, symbol, exchange, market, sector, currency,
               last_price        as "lastPrice",
               pe_ratio          as "peRatio",
               returns_1y        as "returns1Y",
               market_cap        as "marketCap",
               analyst_rating    as "analystRating"
        FROM global_instruments
        WHERE last_price IS NOT NULL AND last_price::numeric > 0
        ORDER BY
          COALESCE(returns_1y::numeric, 0) DESC,
          COALESCE(market_cap::numeric, 0) DESC
        LIMIT 20
      `);
				rows = (dbStocks.rows || []) as any[];
			} catch {
				// DB table missing or has different schema — fall through to curated pool
				rows = [];
				// Simpler fallback query using only core columns
				try {
					const simple = await db.execute(sql`
          SELECT id, name, symbol, exchange, market, sector, currency,
                 last_price as "lastPrice"
          FROM global_instruments
          WHERE last_price IS NOT NULL AND last_price::numeric > 0
          LIMIT 20
        `);
					rows = (simple.rows || []) as any[];
				} catch {
					// Table doesn't exist at all — use GLOBAL_FALLBACK_POOL
				}
			}

			// If DB has data, use it; otherwise fall back to curated pool
			const candidates = rows.length > 0 ? rows : GLOBAL_FALLBACK_POOL;

			// Phase 1 fix: filter recently-picked IDs
			const freshCandidates = candidates.filter(
				(s) => !context.recentIds.has(String(s.id || s.symbol)),
			);
			const pool = freshCandidates.length > 0 ? freshCandidates : candidates;

			// Phase 1 fix: score all candidates, pick top scorer (not random)
			const scored = pool
				.map((s) => ({ s, score: scoreGlobalStock(s) }))
				.sort((a, b) => b.score - a.score);

			const topStock = scored[0].s;
			const topScore = scored[0].score;
			const stockSymbol: string = topStock.symbol || "";

			// ── Live price refresh via Yahoo Finance (free, no key required) ────────
			// Overrides the stale DB price with an actual market quote.
			// US stocks: use symbol directly (e.g. TSM, NVDA)
			// Updates global_instruments in background for the next request.
			let livePrice: number | null = null;
			if (stockSymbol && topStock.market === "us") {
				try {
					const yahooFinance = (await import("yahoo-finance2")).default;
					const q = await (yahooFinance as any).quote(stockSymbol).catch(() => null);
					const yPrice = q?.regularMarketPrice ?? q?.ask ?? q?.bid;
					if (yPrice && Number.isFinite(Number(yPrice)) && Number(yPrice) > 0) {
						livePrice = Math.round(Number(yPrice) * 100) / 100;
						// Persist back to DB (fire-and-forget)
						if (topStock.id) {
							db.execute(sql`
								UPDATE global_instruments
								SET last_price = ${String(livePrice)}, last_updated = NOW()
								WHERE id = ${topStock.id}
							`).catch(() => {});
						}
					}
				} catch {
					// Yahoo Finance unavailable — fall through to DB/fallback price
				}
			}

			const currentPrice = livePrice ?? Number.parseFloat(
				String(topStock.lastPrice ?? topStock.last_price ?? "0"),
			);
			if (!currentPrice || currentPrice <= 0) return null;

			const { targetPct, stoplossPct } =
				this.getDynamicTargetStoploss("global_stocks");
			const targetPrice =
				Math.round(currentPrice * (1 + targetPct) * 100) / 100;
			const stoplossPrice =
				Math.round(currentPrice * (1 - stoplossPct) * 100) / 100;

			const returns1Y = Number.parseFloat(
				topStock.returns1Y ?? topStock.returns_1y ?? "0",
			);
			const pe = Number.parseFloat(
				topStock.peRatio ?? topStock.pe_ratio ?? "0",
			);

			const rationale = await context.service.generateRationale({
				category: "global_stocks",
				name: topStock.name,
				symbol: topStock.symbol,
				currentPrice,
				targetPrice,
				stoplossPrice,
				metrics: {
					sector: topStock.sector,
					exchange: topStock.exchange,
					currency: topStock.currency || "USD",
					returns1Y: returns1Y > 0 ? returns1Y : undefined,
					pe: pe > 0 ? pe : undefined,
					market: topStock.market || "us",
				},
			});

			// Phase 1 fix: riskLevel derived from volatility/PE, not hardcoded 'high'
			const riskLevel =
				pe > 50 || returns1Y > 80
					? "high" // momentum/overvalued names
					: pe < 25 && returns1Y >= 0
						? "medium" // value + stable
						: "high"; // default global = high (FX risk)

			const suggestedAllocation = calculateSuggestedAllocation(
				"global_stocks",
				riskLevel,
				this.getConfidenceScore("global_stocks", topScore, 80),
				{ marketCap: "Large Cap" },
			);

			return {
				category: "global_stocks",
				instrumentId: String(topStock.id || topStock.symbol),
				instrumentName: topStock.name,
				symbol: topStock.symbol,
				exchange: topStock.exchange || "NASDAQ",
				market: topStock.market || "us",
				recoDate: context.today,
				recoPrice: currentPrice,
				targetPrice,
				stoplossPrice,
				currentPrice,
				status: "live",
				expiryDate: this.getExpiryDate(90),
				rationale,
				riskLevel,
				suitableFor: this.deriveSuitableFor(riskLevel, "global_stocks"),
				timeHorizon: this.getTimeHorizon("global_stocks"),
				confidenceScore: this.getConfidenceScore("global_stocks", topScore, 80),
				sectorCategory: topStock.sector || "Global Equities",
				keyMetrics: {
					currency: topStock.currency || "USD",
					market: topStock.market || "us",
					lastPrice: currentPrice,
					returns1Y: returns1Y > 0 ? returns1Y : undefined,
					pe: pe > 0 ? pe : undefined,
					suggestedAllocation,
					dataSource: rows.length > 0 ? "live_db" : "fallback_curated",
				},
			};
		} catch (error) {
			logger.error("[GlobalStockStrategy] Error:", error instanceof Error ? error : new Error(String(error)));
			return null;
		}
	}

	/** Delegates to the shared scoreGlobalStock function. */
	score(instrument: any): number {
		return scoreGlobalStock(instrument);
	}

	async getLivePrice(instrumentId: string): Promise<number | null> {
		// Resolve instrumentId → symbol (may be DB numeric id or ticker directly)
		let symbol = instrumentId;
		if (/^\d+$/.test(instrumentId)) {
			// Numeric ID — resolve to symbol via DB
			try {
				const res = await db.execute(sql`
          SELECT symbol FROM global_instruments WHERE id = ${instrumentId} LIMIT 1
        `);
				const row = ((res.rows || []) as any[])[0];
				if (row?.symbol) symbol = row.symbol;
			} catch {
				// keep instrumentId as-is
			}
		}

		// Tier 1: FMP real-time per-symbol fetch (free plan supports single-symbol)
		const fmpKey = process.env.FMP_API_KEY;
		if (fmpKey && fmpKey.length > 8 && !["dummy","placeholder","xxx"].some(p => fmpKey.toLowerCase().includes(p))) {
			try {
				const resp = await fetch(
					`https://financialmodelingprep.com/stable/quote?symbol=${encodeURIComponent(symbol)}&apikey=${fmpKey}`,
					{ signal: AbortSignal.timeout(15000), headers: { Accept: "application/json" } },
				);
				if (resp.ok) {
					const data: any[] = await resp.json();
					const price = data?.[0]?.price;
					if (price != null && Number.isFinite(Number(price)) && Number(price) > 0) {
						// Update DB in background for next time
						db.execute(sql`
              UPDATE global_instruments
              SET last_price = ${String(price)}, last_updated = NOW()
              WHERE id = ${instrumentId} OR symbol = ${symbol}
            `).catch(() => {});
						return Number(price);
					}
				} else if (resp.status !== 402) {
					// 402 = premium plan required (non-US stocks) — skip silently
					logger.warn(`[GlobalStockLivePrice] FMP HTTP ${resp.status} for ${symbol}`);
				}
			} catch (err: unknown) {
				logger.warn(`[GlobalStockLivePrice] FMP timeout/error for ${symbol}`);
			}
		}

		// Tier 2: Alpha Vantage GLOBAL_QUOTE (supports US + international)
		const avKey = process.env.ALPHA_VANTAGE_API_KEY;
		if (avKey && avKey.length > 8 && !["dummy","placeholder","xxx"].some(p => avKey.toLowerCase().includes(p))) {
			try {
				const resp = await fetch(
					`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${avKey}`,
					{ signal: AbortSignal.timeout(12000), headers: { Accept: "application/json" } },
				);
				if (resp.ok) {
					const data: any = await resp.json();
					const quote = data?.["Global Quote"];
					const price = quote?.["05. price"];
					if (price && Number.isFinite(Number(price)) && Number(price) > 0) {
						db.execute(sql`
              UPDATE global_instruments
              SET last_price = ${String(price)}, last_updated = NOW()
              WHERE id = ${instrumentId} OR symbol = ${symbol}
            `).catch(() => {});
						return Number(price);
					}
				}
			} catch {
				logger.warn(`[GlobalStockLivePrice] AV timeout/error for ${symbol}`);
			}
		}

		// Tier 3: DB cache (last known price)
		try {
			const result = await db.execute(sql`
        SELECT last_price FROM global_instruments
        WHERE id = ${instrumentId} OR symbol = ${symbol}
        LIMIT 1
      `);
			const row = ((result.rows || []) as any[])[0];
			return row?.last_price ? Number.parseFloat(row.last_price) : null;
		} catch {
			return null;
		}
	}
}


