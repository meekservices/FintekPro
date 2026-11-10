import { db } from "../db";
import { aiRegimeHistory, aiPriceHistory, listedStocks } from "@shared/schema";
import { eq, desc, sql, gte, and, asc } from "drizzle-orm";
import { aiAnalyticsEngine } from "./ai-analytics-engine";
import { telemetryBus } from "./engine-telemetry-bus";
import { globalMarketIntelligenceEngine } from "./macro/global-market-intelligence-engine";
import { logger } from "../logger";

export type RegimeLabel = "bull" | "bear" | "sideways" | "high_vol";

export interface RegimeSignal {
	name: string;
	value: number;
	weight: number;
	regime: RegimeLabel;
	description: string;
}

export interface RegimeDetectionResult {
	regimeLabel: RegimeLabel;
	confidence: number;
	signals: RegimeSignal[];
	scores: {
		bull: number;
		bear: number;
		sideways: number;
		high_vol: number;
	};
	marketData: {
		niftyClose: number;
		niftyChange: number;
		indiaVix: number;
		advanceDeclineRatio: number;
		pctAbove50DMA: number;
		pctAbove200DMA: number;
		volatility20d: number;
		volatility60d: number;
		trendStrength: number;
		momentum: Record<number, number>;
	};
}

export interface RegimeHistoryEntry {
	date: string;
	regimeLabel: RegimeLabel;
	confidence: number;
	niftyClose: number;
	volatilityScore: number;
	breadthScore: number;
}

export class AIRegimeDetectionEngine {
	async detectCurrentRegime(): Promise<RegimeDetectionResult> {
		// Tier 2: Check distributed L2 Redis cache (5-minute TTL)
		try {
			const { getSharedRedis } = await import("../utils/redis-client");
			const redis = await getSharedRedis();
			if (redis?.isOpen) {
				const cached = await redis.get("cache:ai_regime:current");
				if (cached) {
					return JSON.parse(cached);
				}
			}
		} catch {
			/* non-fatal fallback */
		}

		try {
			const priceData = await this.fetchNiftyPrices(120);

			if (priceData.length < 10) {
				return this.generateDefaultRegime();
			}

			const prices = priceData.map((p) => p.close);
			const returns = aiAnalyticsEngine.pricesToReturns(prices);
			const currentPrice = prices[prices.length - 1];
			const previousPrice =
				prices.length >= 2 ? prices[prices.length - 2] : currentPrice;
			const niftyChange =
				previousPrice > 0
					? ((currentPrice - previousPrice) / previousPrice) * 100
					: 0;

			const signals: RegimeSignal[] = [];

			const volResult = aiAnalyticsEngine.computeVolatilityClustering(
				returns,
				10,
				60,
			);
			let volRegime: RegimeLabel = "sideways";
			let volDescription = "Volatility is within normal range";
			if (volResult.volRatio > 1.5 && volResult.zScore > 2) {
				volRegime = "high_vol";
				volDescription = `Elevated volatility: ratio ${volResult.volRatio.toFixed(2)}, z-score ${volResult.zScore.toFixed(2)}`;
			} else if (volResult.volRatio < 0.7) {
				volRegime = "sideways";
				volDescription = `Low volatility environment: ratio ${volResult.volRatio.toFixed(2)}`;
			}
			signals.push({
				name: "Volatility Clustering",
				value: volResult.volRatio,
				weight: 0.25,
				regime: volRegime,
				description: volDescription,
			});

			const trendResult = aiAnalyticsEngine.computeTrendStrength(prices, 50);
			let trendRegime: RegimeLabel = "sideways";
			let trendDescription = "No clear trend direction";
			if (trendResult.r2 > 0.6 && trendResult.slope > 0) {
				trendRegime = "bull";
				trendDescription = `Strong uptrend: R² ${trendResult.r2.toFixed(2)}, slope ${trendResult.slope.toFixed(4)}`;
			} else if (trendResult.r2 > 0.6 && trendResult.slope < 0) {
				trendRegime = "bear";
				trendDescription = `Strong downtrend: R² ${trendResult.r2.toFixed(2)}, slope ${trendResult.slope.toFixed(4)}`;
			}
			signals.push({
				name: "Trend Strength",
				value: trendResult.r2,
				weight: 0.25,
				regime: trendRegime,
				description: trendDescription,
			});

			const momentumResult = aiAnalyticsEngine.computeMomentum(
				prices,
				[5, 10, 20, 50],
			);
			let momRegime: RegimeLabel = "sideways";
			let momDescription = "Neutral momentum";
			if (momentumResult.avgMomentum > 0.02) {
				momRegime = "bull";
				momDescription = `Positive momentum: avg ${(momentumResult.avgMomentum * 100).toFixed(2)}%`;
			} else if (momentumResult.avgMomentum < -0.02) {
				momRegime = "bear";
				momDescription = `Negative momentum: avg ${(momentumResult.avgMomentum * 100).toFixed(2)}%`;
			}
			signals.push({
				name: "Momentum",
				value: momentumResult.avgMomentum,
				weight: 0.2,
				regime: momRegime,
				description: momDescription,
			});

			let maRegime: RegimeLabel = "sideways";
			let maDescription = "Mixed moving average signals";
			if (prices.length >= 200) {
				const sma50 = prices.slice(-50).reduce((a, b) => a + b, 0) / 50;
				const sma200 = prices.slice(-200).reduce((a, b) => a + b, 0) / 200;
				if (currentPrice > sma50 && currentPrice > sma200) {
					maRegime = "bull";
					maDescription = `Price above 50-DMA (${sma50.toFixed(0)}) and 200-DMA (${sma200.toFixed(0)})`;
				} else if (currentPrice < sma50 && currentPrice < sma200) {
					maRegime = "bear";
					maDescription = `Price below 50-DMA (${sma50.toFixed(0)}) and 200-DMA (${sma200.toFixed(0)})`;
				}
			} else if (prices.length >= 50) {
				const sma50 = prices.slice(-50).reduce((a, b) => a + b, 0) / 50;
				if (currentPrice > sma50) {
					maRegime = "bull";
					maDescription = `Price above 50-DMA (${sma50.toFixed(0)})`;
				} else {
					maRegime = "bear";
					maDescription = `Price below 50-DMA (${sma50.toFixed(0)})`;
				}
			}
			signals.push({
				name: "Moving Average",
				value: currentPrice,
				weight: 0.15,
				regime: maRegime,
				description: maDescription,
			});

			const indiaVix = this.estimateVIX(returns);
			let vixRegime: RegimeLabel = "sideways";
			let vixDescription = `India VIX proxy: ${indiaVix.toFixed(1)}`;
			if (indiaVix > 25) {
				vixRegime = "high_vol";
				vixDescription = `High VIX (${indiaVix.toFixed(1)}) - elevated fear`;
			} else if (indiaVix > 20) {
				vixRegime = "bear";
				vixDescription = `Elevated VIX (${indiaVix.toFixed(1)}) - cautious market`;
			} else if (indiaVix < 14) {
				vixRegime = "bull";
				vixDescription = `Low VIX (${indiaVix.toFixed(1)}) - complacent/bullish market`;
			}
			signals.push({
				name: "VIX Signal",
				value: indiaVix,
				weight: 0.1,
				regime: vixRegime,
				description: vixDescription,
			});

			const breadth = await this.estimateMarketBreadth();
			let breadthRegime: RegimeLabel = "sideways";
			let breadthDescription = `A/D ratio: ${breadth.ratio.toFixed(2)}`;
			if (breadth.ratio > 1.5) {
				breadthRegime = "bull";
				breadthDescription = `Broad advance: A/D ratio ${breadth.ratio.toFixed(2)}`;
			} else if (breadth.ratio < 0.7) {
				breadthRegime = "bear";
				breadthDescription = `Broad decline: A/D ratio ${breadth.ratio.toFixed(2)}`;
			}
			signals.push({
				name: "Market Breadth",
				value: breadth.ratio,
				weight: 0.05,
				regime: breadthRegime,
				description: breadthDescription,
			});

			// ── Synergy Upgrade 1: Global Market Intelligence Engine (GMIE) Feed ─
			try {
				const gmieReport = await globalMarketIntelligenceEngine.getIntelligenceReport(false);
				if (gmieReport) {
					let macroRegime: RegimeLabel = "sideways";
					let macroDesc = "Neutral global macro and capital flow balance";

					if (
						gmieReport.macroRegime === "GLOBAL_RISK_ON" ||
						(gmieReport.macroRegime === "DOMESTIC_DECOUPLING" &&
							gmieReport.capitalFlows.diiAbsorptionRatio >= 1.2)
					) {
						macroRegime = "bull";
						macroDesc = `Global risk-on / resilient DII absorption (IAR: ${gmieReport.capitalFlows.diiAbsorptionRatio}x, IDI: ${gmieReport.indiaDecouplingScore}σ)`;
					} else if (
						gmieReport.macroRegime === "LIQUIDITY_CONTRACTION" ||
						(gmieReport.macroRegime === "GLOBAL_RISK_OFF" &&
							gmieReport.capitalFlows.diiAbsorptionRatio < 0.9)
					) {
						macroRegime = "bear";
						macroDesc = `Global liquidity contraction / capital flight pressure (IAR: ${gmieReport.capitalFlows.diiAbsorptionRatio}x)`;
					}

					signals.push({
						name: "Global Macro & Capital Flows",
						value: gmieReport.indiaDecouplingScore,
						weight: 0.15,
						regime: macroRegime,
						description: macroDesc,
					});
				}
			} catch (gmieErr: any) {
				logger.warn("[AIRegime] GMIE signal injection unavailable, relying on domestic cues", {
					error: gmieErr?.message,
				});
			}

			const scores: Record<RegimeLabel, number> = {
				bull: 0,
				bear: 0,
				sideways: 0,
				high_vol: 0,
			};
			for (const signal of signals) {
				scores[signal.regime] += signal.weight;
			}

			const winningRegime = (
				Object.entries(scores) as [RegimeLabel, number][]
			).sort((a, b) => b[1] - a[1])[0][0];

			const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
			const confidence = Math.min(
				95,
				Math.round((scores[winningRegime] / totalWeight) * 100),
			);

			const vol20d =
				returns.length >= 20
					? aiAnalyticsEngine.annualizeVolatility(
							Math.sqrt(returns.slice(-20).reduce((s, r) => s + r * r, 0) / 20),
						)
					: 0;
			const vol60d =
				returns.length >= 60
					? aiAnalyticsEngine.annualizeVolatility(
							Math.sqrt(returns.slice(-60).reduce((s, r) => s + r * r, 0) / 60),
						)
					: 0;

			const t0 = Date.now();
			const detectionResult = {
				regimeLabel: winningRegime,
				confidence,
				signals,
				scores: {
					bull: scores.bull,
					bear: scores.bear,
					sideways: scores.sideways,
					high_vol: scores.high_vol,
				},
				marketData: {
					niftyClose: currentPrice,
					niftyChange,
					indiaVix,
					advanceDeclineRatio: breadth.ratio,
					pctAbove50DMA: breadth.pctAbove50DMA,
					pctAbove200DMA: breadth.pctAbove200DMA,
					volatility20d: vol20d,
					volatility60d: vol60d,
					trendStrength: trendResult.r2,
					momentum: momentumResult.momentum,
				},
			};

			// ── Regime Propagation: publish to telemetry bus ──
			// All other engines (pick engine, portfolio optimizer) read the shared
			// regime via telemetryBus.getLatestRegime() instead of computing their own.
			telemetryBus.report({
				engineId: "ai-regime-detection",
				engineName: "AI Regime Detection Engine",
				category: "Risk & Regime",
				reportedAt: new Date().toISOString(),
				latencyMs: Date.now() - t0,
				qualityScore: Math.min(100, Math.round(confidence)),
				itemsProcessed: signals.length,
				errorCount: 0,
				meta: {
					regime: winningRegime,
					confidence,
					niftyClose: currentPrice,
					indiaVix,
				},
			});

			// Cache in Redis with 300s TTL (5 minutes)
			try {
				const { getSharedRedis } = await import("../utils/redis-client");
				const redis = await getSharedRedis();
				if (redis?.isOpen) {
					await redis.setEx("cache:ai_regime:current", 300, JSON.stringify(detectionResult));
				}
			} catch {}

			return detectionResult;
		} catch (error) {
			logger.error("[RegimeDetection] Error detecting regime:", error instanceof Error ? error : new Error(String(error)));
			return this.generateDefaultRegime();
		}
	}

	async persistRegime(result: RegimeDetectionResult): Promise<void> {
		const today = new Date().toISOString().split("T")[0];
		try {
			await db.execute(sql`
        INSERT INTO ai_regime_history (
          regime_date, regime_label, confidence,
          volatility_score, breadth_score, trend_score, momentum_score,
          signal_details, nifty_close, nifty_change, india_vix, advance_decline_ratio
        ) VALUES (
          ${today},
          ${result.regimeLabel},
          ${result.confidence},
          ${result.marketData.volatility20d},
          ${result.marketData.advanceDeclineRatio},
          ${result.marketData.trendStrength},
          ${result.marketData.momentum[20] ?? 0},
          ${JSON.stringify({ signals: result.signals, scores: result.scores })}::jsonb,
          ${result.marketData.niftyClose},
          ${result.marketData.niftyChange},
          ${result.marketData.indiaVix},
          ${result.marketData.advanceDeclineRatio}
        )
        ON CONFLICT (regime_date) DO UPDATE SET
          regime_label = EXCLUDED.regime_label,
          confidence = EXCLUDED.confidence,
          volatility_score = EXCLUDED.volatility_score,
          breadth_score = EXCLUDED.breadth_score,
          trend_score = EXCLUDED.trend_score,
          momentum_score = EXCLUDED.momentum_score,
          signal_details = EXCLUDED.signal_details,
          nifty_close = EXCLUDED.nifty_close,
          nifty_change = EXCLUDED.nifty_change,
          india_vix = EXCLUDED.india_vix,
          advance_decline_ratio = EXCLUDED.advance_decline_ratio
      `);
			logger.info(
				`[RegimeDetection] Persisted regime: ${result.regimeLabel} (${result.confidence}%) for ${today}`,
			);
		} catch (error) {
			logger.error("[RegimeDetection] Error persisting regime:", error instanceof Error ? error : new Error(String(error)));
		}
	}

	async getCurrentRegime(): Promise<RegimeHistoryEntry | null> {
		try {
			const rows = await db
				.select()
				.from(aiRegimeHistory)
				.orderBy(desc(aiRegimeHistory.regimeDate))
				.limit(1);

			if (rows.length === 0) return null;

			const row = rows[0];
			return {
				date: row.regimeDate,
				regimeLabel: row.regimeLabel as RegimeLabel,
				confidence: Number.parseFloat(row.confidence),
				niftyClose: Number.parseFloat(row.niftyClose || "0"),
				volatilityScore: Number.parseFloat(row.volatilityScore || "0"),
				breadthScore: Number.parseFloat(row.breadthScore || "0"),
			};
		} catch (error) {
			logger.error("[RegimeDetection] Error fetching current regime:", error instanceof Error ? error : new Error(String(error)));
			return null;
		}
	}

	async getRegimeHistory(days: number = 90): Promise<RegimeHistoryEntry[]> {
		try {
			const cutoff = new Date();
			cutoff.setDate(cutoff.getDate() - days);
			const cutoffStr = cutoff.toISOString().split("T")[0];

			const rows = await db
				.select()
				.from(aiRegimeHistory)
				.where(gte(aiRegimeHistory.regimeDate, cutoffStr))
				.orderBy(desc(aiRegimeHistory.regimeDate));

			return rows.map((row) => ({
				date: row.regimeDate,
				regimeLabel: row.regimeLabel as RegimeLabel,
				confidence: Number.parseFloat(row.confidence),
				niftyClose: Number.parseFloat(row.niftyClose || "0"),
				volatilityScore: Number.parseFloat(row.volatilityScore || "0"),
				breadthScore: Number.parseFloat(row.breadthScore || "0"),
			}));
		} catch (error) {
			logger.error("[RegimeDetection] Error fetching regime history:", error instanceof Error ? error : new Error(String(error)));
			return [];
		}
	}

	async getRegimeDistribution(
		days: number = 90,
	): Promise<Record<RegimeLabel, number>> {
		const distribution: Record<RegimeLabel, number> = {
			bull: 0,
			bear: 0,
			sideways: 0,
			high_vol: 0,
		};
		try {
			const cutoff = new Date();
			cutoff.setDate(cutoff.getDate() - days);
			const cutoffStr = cutoff.toISOString().split("T")[0];

			const rows = await db.execute(sql`
        SELECT regime_label, COUNT(*) as count
        FROM ai_regime_history
        WHERE regime_date >= ${cutoffStr}
        GROUP BY regime_label
      `);

			const resultRows = (rows as any).rows || rows;
			for (const row of resultRows) {
				const label = row.regime_label as RegimeLabel;
				if (label in distribution) {
					distribution[label] = Number.parseInt(row.count || "0");
				}
			}
		} catch (error) {
			logger.error(
				"[RegimeDetection] Error fetching regime distribution:",
				error instanceof Error ? error : new Error(String(error)),
			);
		}
		return distribution;
	}

	private async fetchNiftyPrices(
		days: number,
	): Promise<{ date: string; close: number }[]> {
		try {
			const cutoff = new Date();
			cutoff.setDate(cutoff.getDate() - Math.ceil(days * 1.5));
			const cutoffStr = cutoff.toISOString().split("T")[0];
			const todayStr = new Date().toISOString().split("T")[0];

			// ── Tier 1: market_index_nav (official benchmark table) ─────────────
			try {
				const indexNavRows = await db.execute(sql`
					SELECT min.nav_date::text as date, min.close_value as close
					FROM market_index_nav min
					JOIN market_indices mi ON mi.id = min.index_id
					WHERE mi.index_code IN ('NIFTY50', 'NIFTY 50', '^NSEI')
						AND min.nav_date >= ${cutoffStr}::date
						AND min.close_value IS NOT NULL
					ORDER BY min.nav_date ASC
					LIMIT ${days}
				`);
				const inRows = (indexNavRows as any).rows || indexNavRows;
				if (inRows && inRows.length >= 10) {
					return inRows.map((r: any) => ({
						date: r.date,
						close: Number.parseFloat(r.close),
					}));
				}
			} catch {
				/* fall through to Tier 2 */
			}

			// ── Tier 2: golden_prices (authoritative pricing engine table) ─────
			try {
				const goldenRows = await db.execute(sql`
					SELECT price_date as date, price as close
					FROM golden_prices
					WHERE symbol IN ('NIFTY50', 'NIFTY 50', 'NIFTY', '^NSEI', 'NSE_INDEX|Nifty 50')
						AND price_date >= ${cutoffStr}
						AND price IS NOT NULL
					ORDER BY price_date ASC
					LIMIT ${days}
				`);
				const gpRows = (goldenRows as any).rows || goldenRows;
				if (gpRows && gpRows.length >= 10) {
					return gpRows.map((r: any) => ({
						date: r.date,
						close: Number.parseFloat(r.close),
					}));
				}
			} catch {
				/* fall through to Tier 3 */
			}

			// ── Tier 3: Upstox Developer API (licensed live historical candles) ─
			try {
				const { upstoxMarketDataService } = await import("./upstox-market-data-service");
				if (upstoxMarketDataService.isReady()) {
					const upstoxRes = await upstoxMarketDataService.getHistoricalData(
						"NIFTY 50",
						"day",
						cutoffStr,
						todayStr,
						"NSE",
					);
					if (upstoxRes.success && Array.isArray(upstoxRes.data) && upstoxRes.data.length >= 10) {
						return upstoxRes.data.map((c) => ({
							date: c.timestamp.split("T")[0],
							close: c.close,
						}));
					}
				}
			} catch {
				/* fall through to Tier 4 */
			}

			// ── Tier 4: ai_price_history & screener_price_history ──────────────
			const aiPrices = await db
				.select({
					priceDate: aiPriceHistory.priceDate,
					close: aiPriceHistory.close,
				})
				.from(aiPriceHistory)
				.where(
					and(
						sql`${aiPriceHistory.assetId} IN ('NIFTY50', '^NSEI')`,
						gte(aiPriceHistory.priceDate, cutoffStr),
					),
				)
				.orderBy(asc(aiPriceHistory.priceDate))
				.limit(days);

			if (aiPrices.length >= 10) {
				return aiPrices.map((p) => ({
					date: p.priceDate,
					close: Number.parseFloat(p.close),
				}));
			}

			const screenerPrices = await db.execute(sql`
        SELECT date, close
        FROM screener_price_history
        WHERE symbol IN ('NIFTY50', 'NSEI', '^NSEI')
          AND date >= ${cutoffStr}
          AND close IS NOT NULL
        ORDER BY date ASC
        LIMIT ${days}
      `);

			const screenerRows = (screenerPrices as any).rows || screenerPrices;
			if (screenerRows && screenerRows.length >= 10) {
				return screenerRows.map((r: any) => ({
					date: r.date,
					close: Number.parseFloat(r.close),
				}));
			}

			// ── Tier 5 Fallback: Deterministic PRNG seeded by day-of-year ───────
			return this.generateSyntheticNiftyPrices(days);
		} catch (error) {
			logger.error("[RegimeDetection] Error fetching Nifty prices:", error instanceof Error ? error : new Error(String(error)));
			return this.generateSyntheticNiftyPrices(days);
		}
	}

	private generateSyntheticNiftyPrices(
		days: number,
	): { date: string; close: number }[] {
		// BUG-3 FIX: Replace Math.random() with a deterministic day-seed formula.
		// GCR v1.0 mandates "same input → same output ALWAYS (no hidden randomness)".
		// The previous implementation produced different regime labels on each invocation,
		// making the synthetic fallback unreproducible and untestable.
		//
		// New formula: dailyReturn = ((dayOfYear * 1013 + dayIndex * 37) % 201 - 100) / 10000
		//   - dayOfYear: 1–366, provides date-anchored variance
		//   - dayIndex:  loop counter, keeps adjacent days distinct
		//   - Result: ±1% range (conservative, appropriate for a flat/sideways synthetic baseline)
		//   - Fully deterministic: same date → same price series every run
		const basePrice = 22000;
		const result: { date: string; close: number }[] = [];
		let price = basePrice;
		let dayIndex = 0;

		for (let i = days; i >= 0; i--) {
			const d = new Date();
			d.setDate(d.getDate() - i);
			const dayOfWeek = d.getDay();
			if (dayOfWeek === 0 || dayOfWeek === 6) continue;

			// Deterministic seed: combine day-of-year with loop counter
			const dayOfYear = Math.floor(
				(d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86_400_000,
			);
			const pseudoRand = ((dayOfYear * 1013 + dayIndex * 37) % 201 - 100) / 10000;
			price = price * (1 + pseudoRand);
			result.push({
				date: d.toISOString().split("T")[0],
				close: Math.round(price * 100) / 100,
			});
			dayIndex++;
		}
		return result;
	}

	private async estimateMarketBreadth(): Promise<{
		advances: number;
		declines: number;
		ratio: number;
		pctAbove50DMA: number;
		pctAbove200DMA: number;
	}> {
		// ── Cross-Engine Synergy: Ingest live multi-exchange market breadth ──
		try {
			const { multiExchangeMarketService } = await import("./multi-exchange-market-service");
			const snap = await multiExchangeMarketService.getMultiExchangeSnapshot();
			if (snap?.success && snap.data?.bseBreadth && snap.data.bseBreadth.advances > 0) {
				const bb = snap.data.bseBreadth;
				return {
					advances: bb.advances,
					declines: bb.declines,
					ratio: bb.advanceDeclineRatio,
					pctAbove50DMA: bb.pctAbove50Dma ?? 50,
					pctAbove200DMA: bb.pctAbove200Dma ?? 50,
				};
			}
		} catch {
			/* non-fatal fallback to DB */
		}

		try {
			const stocks = await db
				.select({
					currentPrice: listedStocks.currentPrice,
					dayChangePercent: listedStocks.dayChangePercent,
					weekHigh52: listedStocks.weekHigh52,
					weekLow52: listedStocks.weekLow52,
				})
				.from(listedStocks)
				.where(
					and(
						eq(listedStocks.isPublished, true),
						sql`${listedStocks.currentPrice} IS NOT NULL`,
					),
				)
				.limit(500);

			if (stocks.length === 0) {
				return {
					advances: 50,
					declines: 50,
					ratio: 1.0,
					pctAbove50DMA: 50,
					pctAbove200DMA: 50,
				};
			}

			let advances = 0;
			let declines = 0;
			let above50DMA = 0;
			let above200DMA = 0;
			let validCount = 0;

			for (const stock of stocks) {
				const changePercent = Number.parseFloat(stock.dayChangePercent || "0");
				if (changePercent > 0) advances++;
				else if (changePercent < 0) declines++;

				const price = Number.parseFloat(stock.currentPrice || "0");
				const high52 = Number.parseFloat(stock.weekHigh52 || "0");
				const low52 = Number.parseFloat(stock.weekLow52 || "0");

				if (price > 0 && high52 > 0 && low52 > 0) {
					validCount++;
					const midpoint = (high52 + low52) / 2;
					const upperQuartile = low52 + (high52 - low52) * 0.75;
					if (price > midpoint) above50DMA++;
					if (price > upperQuartile) above200DMA++;
				}
			}

			const ratio =
				declines > 0 ? advances / declines : advances > 0 ? 2.0 : 1.0;
			const pctAbove50DMA =
				validCount > 0 ? (above50DMA / validCount) * 100 : 50;
			const pctAbove200DMA =
				validCount > 0 ? (above200DMA / validCount) * 100 : 50;

			return { advances, declines, ratio, pctAbove50DMA, pctAbove200DMA };
		} catch (error) {
			logger.error(
				"[RegimeDetection] Error estimating market breadth:",
				error instanceof Error ? error : new Error(String(error)),
			);
			return {
				advances: 50,
				declines: 50,
				ratio: 1.0,
				pctAbove50DMA: 50,
				pctAbove200DMA: 50,
			};
		}
	}

	estimateVIX(returns: number[]): number {
		if (returns.length < 20) return 15;
		const recentReturns = returns.slice(-20);
		const variance =
			recentReturns.reduce((sum, r) => sum + r * r, 0) / recentReturns.length;
		const dailyVol = Math.sqrt(variance);
		const annualizedVol = dailyVol * Math.sqrt(252);
		const vixProxy = annualizedVol * 100;
		return Math.max(8, Math.min(50, vixProxy));
	}

	private generateDefaultRegime(): RegimeDetectionResult {
		return {
			regimeLabel: "sideways",
			confidence: 30,
			signals: [
				{
					name: "Default",
					value: 0,
					weight: 1.0,
					regime: "sideways",
					description:
						"Insufficient data for regime detection - defaulting to sideways",
				},
			],
			scores: { bull: 0, bear: 0, sideways: 1.0, high_vol: 0 },
			marketData: {
				niftyClose: 0,
				niftyChange: 0,
				indiaVix: 15,
				advanceDeclineRatio: 1.0,
				pctAbove50DMA: 50,
				pctAbove200DMA: 50,
				volatility20d: 0,
				volatility60d: 0,
				trendStrength: 0,
				momentum: {},
			},
		};
	}
}

export const aiRegimeDetectionEngine = new AIRegimeDetectionEngine();
