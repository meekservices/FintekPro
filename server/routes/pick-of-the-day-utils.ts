import { logger } from "../logger";
import { db } from "../db";
import {
	listedStocks,
	mutualFunds,
	bondCatalog,
	unlistedCompanies,
	globalInstruments,
	instrumentMaster,
	dailyPicks,
} from "@shared/schema";
import { eq, sql, inArray, and } from "drizzle-orm";
import { calculateSuggestedAllocation } from "../services/pick-of-the-day-service";

export const REGULATORY_DISCLAIMER =
	"Investment recommendations are AI-generated and for informational purposes only. Past performance does not guarantee future results. Investors should conduct independent due diligence and consult a SEBI-registered investment advisor before making investment decisions. FintekPro does not guarantee accuracy of third-party data. Data sourced from NSE, BSE, AMFI, Alpha Vantage, and Yahoo Finance.";

export const DATA_SOURCES: Record<
	string,
	{ name: string; type: string; refreshInterval: string }
> = {
	listed_stocks: {
		name: "NSE/BSE Exchange Feed",
		type: "Real-time (15-min delay)",
		refreshInterval: "Every 4 hours",
	},
	mutual_funds: {
		name: "AMFI NAV Service",
		type: "End-of-day NAV",
		refreshInterval: "Daily after 11:30 PM IST",
	},
	bonds: {
		name: "NSE/BSE Bond Catalog",
		type: "Daily pricing",
		refreshInterval: "Daily",
	},
	global_stocks: {
		name: "Alpha Vantage / Yahoo Finance",
		type: "Near real-time",
		refreshInterval: "Every 30 minutes",
	},
	etfs: {
		name: "NSE/Yahoo Finance",
		type: "Near real-time",
		refreshInterval: "Every 30 minutes",
	},
	reits_invits: {
		name: "NSE India / Yahoo Finance",
		type: "Daily pricing",
		refreshInterval: "Every 6 hours",
	},
	sgb: {
		name: "RBI / Gold Spot Price",
		type: "Gold-linked valuation",
		refreshInterval: "Daily",
	},
	unlisted: {
		name: "FintekPro OTC Desk",
		type: "Dealer quote",
		refreshInterval: "On update",
	},
	derivatives: {
		name: "NSE F&O Data / Options Chain",
		type: "Real-time (15-min delay)",
		refreshInterval: "Every 4 hours",
	},
	fixed_deposits: {
		name: "RBI / Issuer Rate Cards",
		type: "Current interest rates",
		refreshInterval: "Weekly",
	},
};

export async function getLiveInstrumentPrice(
	pick: any,
): Promise<number | null> {
	try {
		switch (pick.category) {
			case "listed_stocks": {
				const row = await db
					.select({ currentPrice: listedStocks.currentPrice, symbol: listedStocks.symbol })
					.from(listedStocks)
					.where(eq(listedStocks.id, pick.instrumentId))
					.limit(1);
				const dbPrice = row[0]?.currentPrice ? Number.parseFloat(row[0].currentPrice) : null;
				if (dbPrice && dbPrice > 0) return dbPrice;
				// DB price missing/zero — try Yahoo Finance live feed (.NS for NSE)
				const sym = row[0]?.symbol || pick.symbol;
				if (sym) {
					try {
						const yahooFinance = (await import("yahoo-finance2")).default;
						const q = await (yahooFinance as any).quote(`${sym}.NS`).catch(() => null)
							|| await (yahooFinance as any).quote(`${sym}.BO`).catch(() => null);
						const yPrice = q?.regularMarketPrice ?? q?.ask;
						if (yPrice && Number.isFinite(Number(yPrice)) && Number(yPrice) > 0) {
							const lp = Math.round(Number(yPrice) * 100) / 100;
							// Write back to DB so next request uses cached price
							db.update(listedStocks)
								.set({ currentPrice: String(lp) })
								.where(eq(listedStocks.id, pick.instrumentId))
								.catch(() => {});
							return lp;
						}
					} catch { /* Yahoo Finance unavailable */ }
				}
				return null;
			}
			case "mutual_funds": {
				const row = await db
					.select({ nav: mutualFunds.nav })
					.from(mutualFunds)
					.where(eq(mutualFunds.schemeCode, pick.instrumentId))
					.limit(1);
				return row[0]?.nav ? Number.parseFloat(row[0].nav) : null;
			}
			case "bonds": {
				const row = await db
					.select({ cleanPrice: bondCatalog.cleanPrice })
					.from(bondCatalog)
					.where(eq(bondCatalog.id, pick.instrumentId))
					.limit(1);
				return row[0]?.cleanPrice ? Number.parseFloat(row[0].cleanPrice) : null;
			}
			case "unlisted": {
				const row = await db
					.select({ publishedBuyPrice: unlistedCompanies.publishedBuyPrice })
					.from(unlistedCompanies)
					.where(eq(unlistedCompanies.id, pick.instrumentId))
					.limit(1);
				return row[0]?.publishedBuyPrice
					? Number.parseFloat(row[0].publishedBuyPrice)
					: null;
			}
			case "etfs": {
				const row = await db
					.select({ lastPrice: instrumentMaster.lastPrice })
					.from(instrumentMaster)
					.where(eq(instrumentMaster.id, pick.instrumentId))
					.limit(1);
				return row[0]?.lastPrice ? Number.parseFloat(row[0].lastPrice) : null;
			}
			case "global_stocks": {
				const row = await db
					.select({ lastPrice: globalInstruments.lastPrice })
					.from(globalInstruments)
					.where(eq(globalInstruments.id, pick.instrumentId))
					.limit(1);
				return row[0]?.lastPrice ? Number.parseFloat(row[0].lastPrice) : null;
			}
			case "reits_invits": {
				const result = await db.execute(sql`
          SELECT current_price FROM reits WHERE id::text = ${pick.instrumentId}
          UNION ALL SELECT current_price FROM invits WHERE id::text = ${pick.instrumentId}
          LIMIT 1
        `);
				const reitRow = (result as any).rows?.[0] || (result as any)[0];
				const dbReitPrice = reitRow?.current_price ? Number.parseFloat(reitRow.current_price) : null;
				if (dbReitPrice && dbReitPrice > 0) return dbReitPrice;
				// DB stale — try Yahoo Finance with NSE suffix (REITs like INDIGRID, EMBASSY trade on NSE)
				const reitSym = pick.symbol;
				if (reitSym) {
					try {
						const yahooFinance = (await import("yahoo-finance2")).default;
						const q = await (yahooFinance as any).quote(`${reitSym}.NS`).catch(() => null);
						const yPrice = q?.regularMarketPrice;
						if (yPrice && Number.isFinite(Number(yPrice)) && Number(yPrice) > 0) {
							return Math.round(Number(yPrice) * 100) / 100;
						}
					} catch { /* Yahoo Finance unavailable */ }
				}
				return null;
			}
			case "sgb": {
				const goldResult = await db.execute(sql`
          SELECT current_price, last_updated FROM commodity_prices WHERE symbol = 'GOLD' ORDER BY last_updated DESC LIMIT 1
        `);
				const goldRow = (goldResult as any).rows?.[0] || (goldResult as any)[0];
				if (goldRow?.current_price) {
					const priceVal = Number.parseFloat(goldRow.current_price);
					const ageHours = goldRow.last_updated
						? (Date.now() - new Date(goldRow.last_updated).getTime()) / 3600000
						: 999;
					// Only use DB gold price if fresh (< 7 days) and in expected INR/gram range
					if (priceVal > 4000 && ageHours < 168) return priceVal;
				}
				// DB stale — fetch gold from Yahoo Finance (GC=F + USDINR=X)
				try {
					const yahooFinance = (await import("yahoo-finance2")).default;
					const [gcQ, usdInrQ] = await Promise.all([
						(yahooFinance as any).quote("GC=F").catch(() => null),
						(yahooFinance as any).quote("USDINR=X").catch(() => null),
					]);
					const goldUsd = gcQ?.regularMarketPrice;
					const usdInr = usdInrQ?.regularMarketPrice ?? 83.5;
					if (goldUsd && Number.isFinite(goldUsd) && goldUsd > 1000) {
						return Math.round((goldUsd * usdInr / 31.1035) * 10) / 10;
					}
				} catch { /* Yahoo Finance unavailable */ }
				return null;
			}
			case "derivatives": {
				// For derivatives: return current option premium * lotSize (not the underlying index level)
				const derivSym = pick.symbol || pick.instrumentId;
				if (!derivSym) return null;
				try {
					const { derivativesService } = await import("../services/derivatives-service");
					const chain = await (derivativesService as any).getOptionsChain(derivSym);
					const spotPrice = chain.underlyingValue;
					if (!spotPrice || spotPrice <= 0) return null;
					const km = typeof pick.keyMetrics === "string" ? JSON.parse(pick.keyMetrics) : (pick.keyMetrics || {});
					const lotSize: number = km.lotSize || ({ NIFTY: 25, BANKNIFTY: 15, FINNIFTY: 40 } as Record<string, number>)[derivSym] || 50;
					const strikePrice: number = km.strikePrice;
					const strategy: string = km.strategy || "Long Call";
					// Try to find the specific strike in the chain
					const callOption = strikePrice && chain.options?.calls?.find((c: any) => c.strikePrice === strikePrice);
					const putOption = strikePrice && chain.options?.puts?.find((p: any) => p.strikePrice === strikePrice);
					const callPrice = callOption?.lastPrice || 0;
					const putPrice = putOption?.lastPrice || 0;
					// Compute current strategy value
					let premiumNow = 0;
					if (strategy.includes("Straddle") || strategy.includes("Strangle")) {
						premiumNow = callPrice + putPrice;
					} else if (strategy.toLowerCase().includes("put") || strategy.toLowerCase().includes("bear")) {
						premiumNow = putPrice;
					} else {
						premiumNow = callPrice;
					}
					// If specific strike prices found, use them; else approximate from spot
					const effectivePremium = premiumNow > 0 ? premiumNow : spotPrice * 0.0045;
					return Math.round(effectivePremium * lotSize * 100) / 100;
				} catch { return null; }
			}
			case "fixed_deposits": {
				// FDs don't have a market price — return the stored recoPrice (principal investment)
				return pick.recoPrice ? Number.parseFloat(pick.recoPrice) : 100_000;
			}
			default:
				return null;
		}

	} catch {
		return null;
	}
}

export async function enrichPicksWithDataSource(picks: any[]) {
	const categoryLastUpdated: Record<string, string> = {};
	const now = new Date();
	const expiredPickIds: number[] = [];
	const picksToUpdateInDb: {
		id: number;
		currentPrice: string;
		returnPct: string;
		daysHeld: number;
		status: string;
	}[] = [];

	for (const pick of picks) {
		if (pick.status === "live" && pick.expiryDate) {
			const expiry = new Date(pick.expiryDate);
			if (expiry < now) {
				pick.status = "expired";
				if (pick.id) expiredPickIds.push(pick.id);
			}
		}

		if (pick.recoDate) {
			pick.daysHeld = Math.floor(
				(now.getTime() - new Date(pick.recoDate).getTime()) /
					(1000 * 60 * 60 * 24),
			);
		}

		if (pick.status === "live" && pick.instrumentId) {
			try {
				const freshPrice = await getLiveInstrumentPrice(pick);
				if (freshPrice !== null && freshPrice > 0) {
					pick.currentPrice = freshPrice;
					pick.lastPriceUpdate = now.toISOString();

					if (pick.recoPrice) {
						const recoPrice = Number.parseFloat(pick.recoPrice);
						if (recoPrice > 0) {
							pick.returnPct = Number.parseFloat(
								(((freshPrice - recoPrice) / recoPrice) * 100).toFixed(2),
							);
						}
					}

					let newStatus = "live";
					if (
						pick.targetPrice &&
						freshPrice >= Number.parseFloat(pick.targetPrice)
					)
						newStatus = "target_hit";
					else if (
						pick.stoplossPrice &&
						freshPrice <= Number.parseFloat(pick.stoplossPrice)
					)
						newStatus = "stoploss_hit";
					if (newStatus !== pick.status) pick.status = newStatus;

					if (pick.id) {
						picksToUpdateInDb.push({
							id: pick.id,
							currentPrice: freshPrice.toString(),
							returnPct: pick.returnPct?.toString() ?? "0",
							daysHeld: pick.daysHeld ?? 0,
							status: pick.status,
						});
					}
				}
			} catch {}
		}

		const source = DATA_SOURCES[pick.category];
		pick.priceDataSource = source?.name || "Unknown";
		pick.priceDataType = source?.type || "Unknown";
		pick.priceRefreshInterval = source?.refreshInterval || "Unknown";

		if (pick.lastPriceUpdate || pick.updatedAt || pick.statusUpdatedAt) {
			const updatedAt =
				pick.lastPriceUpdate || pick.statusUpdatedAt || pick.updatedAt;
			pick.lastPriceUpdate = updatedAt;
			const cat = pick.category;
			if (
				!categoryLastUpdated[cat] ||
				new Date(updatedAt) > new Date(categoryLastUpdated[cat])
			) {
				categoryLastUpdated[cat] = updatedAt;
			}
		}

		const ageHours = pick.lastPriceUpdate
			? (Date.now() - new Date(pick.lastPriceUpdate).getTime()) /
				(1000 * 60 * 60)
			: null;

		if (ageHours === null) {
			pick.dataFreshness = "unknown";
		} else if (ageHours < 1) {
			pick.dataFreshness = "live";
		} else if (ageHours < 6) {
			pick.dataFreshness = "recent";
		} else if (ageHours < 24) {
			pick.dataFreshness = "delayed";
		} else {
			pick.dataFreshness = "stale";
		}

		// RSI/ROIC enrichment for listed stocks — only fetch if not already cached
		if (pick.category === "listed_stocks" && pick.symbol && pick.keyMetrics) {
			const km =
				typeof pick.keyMetrics === "string"
					? JSON.parse(pick.keyMetrics)
					: pick.keyMetrics;
			const needsRsi = km.rsi == null;
			const needsRoic = km.roic == null;
			const needsAllocation = km.suggestedAllocation == null;

			if (needsAllocation) {
				km.suggestedAllocation = calculateSuggestedAllocation(
					pick.category,
					pick.riskLevel || "medium",
					pick.confidenceScore || 70,
					km,
				);
			}

			if (needsRsi || needsRoic) {
				let metricsUpdated = false;
				try {
					if (needsRoic) {
						// Primary: screener_key_metrics (FMP enrichment data)
						const screenerRoic = await db.execute(
							sql`SELECT roic FROM screener_key_metrics WHERE symbol = ${pick.symbol.toUpperCase()} AND roic IS NOT NULL ORDER BY date DESC LIMIT 1`,
						).catch(() => ({ rows: [] }));
						const skRow = (screenerRoic as any).rows?.[0];
						if (skRow?.roic != null) {
							km.roic = Number.parseFloat(skRow.roic);
							metricsUpdated = true;
						} else {
							// Secondary: listed_stocks.roce
							const stockRow = await db.execute(
								sql`SELECT roce FROM listed_stocks WHERE symbol = ${pick.symbol} AND roce IS NOT NULL LIMIT 1`,
							);
							const row = (stockRow as any).rows?.[0];
							if (row?.roce != null) {
								km.roic = Number.parseFloat(row.roce);
								metricsUpdated = true;
							}
						}
					}
					if (needsRsi) {
						// Primary: screener_technical_indicators (FMP RSI data stored as rsi_14 column)
						const screenerRsi = await db.execute(
							sql`SELECT rsi_14 FROM screener_technical_indicators WHERE symbol = ${pick.symbol.toUpperCase()} AND rsi_14 IS NOT NULL ORDER BY date DESC LIMIT 1`,
						).catch(() => ({ rows: [] }));
						const srRow = (screenerRsi as any).rows?.[0];
						if (srRow?.rsi_14 != null) {
							km.rsi = Math.round(Number.parseFloat(srRow.rsi_14) * 100) / 100;
							metricsUpdated = true;
						} else {
							// Secondary: goldenPrices (live computation from 35d price history)
							const cutoff = new Date();
							cutoff.setDate(cutoff.getDate() - 35);
							const gpRows = await db.execute(sql`
								SELECT price FROM golden_prices
								WHERE symbol = ${pick.symbol}
								  AND price_date >= ${cutoff.toISOString().split("T")[0]}
								ORDER BY price_date ASC
								LIMIT 40
							`).catch(() => ({ rows: [] }));
							const closes = ((gpRows as any).rows || [])
								.map((r: any) => Number.parseFloat(r.price))
								.filter((n: number) => Number.isFinite(n));
							if (closes.length >= 15) {
								let gains = 0, losses = 0;
								for (let i = closes.length - 14; i < closes.length; i++) {
									const diff = closes[i] - closes[i - 1];
									if (diff > 0) gains += diff;
									else losses += Math.abs(diff);
								}
								const avgGain = gains / 14;
								const avgLoss = losses / 14;
								km.rsi = avgLoss === 0 ? 100 : Math.round((100 - 100 / (1 + avgGain / avgLoss)) * 100) / 100;
								metricsUpdated = true;
							} else {
								// Tertiary: Yahoo Finance (last resort)
								const yahooFinance = (await import("yahoo-finance2")).default;
								const suffixes = [".NS", ".BO"];
								for (const suffix of suffixes) {
									if (km.rsi != null) break;
									try {
										const yahooSymbol = `${pick.symbol}${suffix}`;
										const endDate = new Date();
										const startDate = new Date();
										startDate.setDate(startDate.getDate() - 30);
										const chartResult = await yahooFinance.chart(yahooSymbol, {
											period1: startDate,
											period2: endDate,
											interval: "1d",
										});
										const quotes = chartResult?.quotes;
										if (quotes && quotes.length >= 15) {
											const closes2 = quotes
												.map((q: any) => q.close)
												.filter((c: any) => c != null);
											if (closes2.length >= 15) {
												let gains2 = 0, losses2 = 0;
												for (let i = 1; i <= 14; i++) {
													const diff =
														closes2[closes2.length - i] -
														closes2[closes2.length - i - 1];
													if (diff > 0) gains2 += diff;
													else losses2 += Math.abs(diff);
												}
												const avgGain2 = gains2 / 14;
												const avgLoss2 = losses2 / 14;
												km.rsi =
													avgLoss2 === 0
														? 100
														: Math.round(
																(100 - 100 / (1 + avgGain2 / avgLoss2)) * 100,
															) / 100;
												metricsUpdated = true;
											}
										}
									} catch {}
								}
							}
						}
					}
					pick.keyMetrics = km;

					// ✅ Persist updated metrics back to DB so next request skips live fetch
					if (metricsUpdated && pick.id) {
						db.update(dailyPicks)
							.set({ keyMetrics: km, updatedAt: new Date() })
							.where(eq(dailyPicks.id, pick.id))
							.catch((err) =>
								logger.warn(
									`[PickEnrich] Failed to cache metrics for pick ${pick.id}:`,
									err,
								),
							);
					}
				} catch (err) {
					logger.warn(
						`[PickEnrich] RSI/ROIC enrichment failed for ${pick.symbol}:`,
						{ error: err instanceof Error ? err.message : String(err) },
					);
				}
			}
		}

		// ── screener_derived_metrics enrichment (beta, sharpe, return1y) ──────
		// Fills missing performance/risk metrics for listed stock picks from the
		// OHLCV-computed screener_derived_metrics table (80–86% symbol coverage).
		// Runs AFTER the RSI/ROIC block so it can batch with the same DB round-trip.
		if (pick.category === "listed_stocks" && pick.symbol && pick.keyMetrics) {
			const km =
				typeof pick.keyMetrics === "string"
					? JSON.parse(pick.keyMetrics)
					: pick.keyMetrics;

			const needsBeta   = km.beta == null;
			const needsSharpe = km.sharpe == null;
			const needsReturn = km.returns1y == null;

			if (needsBeta || needsSharpe || needsReturn) {
				try {
					const dmRow = await db.execute(sql`
            SELECT return_1y, return_3y, beta, sharpe_ratio_1y, max_drawdown_1y, volatility_30d
            FROM screener_derived_metrics
            WHERE symbol = ${pick.symbol.toUpperCase()}
            LIMIT 1
          `).catch(() => ({ rows: [] }));
					const r = (dmRow as any).rows?.[0];
					if (r) {
						let dmUpdated = false;
						if (needsReturn && r.return_1y != null) {
							km.returns1y = Math.round(Number(r.return_1y) * 10000) / 10000;
							dmUpdated = true;
						}
						if (r.return_3y != null && km.returns3y == null) {
							km.returns3y = Math.round(Number(r.return_3y) * 10000) / 10000;
							dmUpdated = true;
						}
						if (needsBeta && r.beta != null) {
							km.beta = Math.round(Number(r.beta) * 10000) / 10000;
							dmUpdated = true;
						}
						if (needsSharpe && r.sharpe_ratio_1y != null) {
							km.sharpe = Math.round(Number(r.sharpe_ratio_1y) * 10000) / 10000;
							dmUpdated = true;
						}
						if (r.max_drawdown_1y != null && km.maxDrawdown == null) {
							km.maxDrawdown = Math.round(Number(r.max_drawdown_1y) * 10000) / 10000;
							dmUpdated = true;
						}
						pick.keyMetrics = km;

						// Persist so subsequent requests skip this fetch
						if (dmUpdated && pick.id) {
							db.update(dailyPicks)
								.set({ keyMetrics: km, updatedAt: new Date() })
								.where(eq(dailyPicks.id, pick.id))
								.catch((err) =>
									logger.warn(
										`[PickEnrich] screener_derived_metrics cache write failed for pick ${pick.id}:`,
										err,
									),
								);
						}
					}
				} catch (err) {
					logger.warn(
						`[PickEnrich] screener_derived_metrics enrichment failed for ${pick.symbol}:`,
						{ error: err instanceof Error ? err.message : String(err) },
					);
				}
			}
		}
	}

	if (expiredPickIds.length > 0) {
		try {
			// Use Drizzle's update method instead of raw SQL to avoid ANY() error
			await db
				.update(dailyPicks)
				.set({ status: "expired", updatedAt: new Date() })
				.where(
					and(
						inArray(dailyPicks.id, expiredPickIds),
						eq(dailyPicks.status, "live" as any),
					),
				);
		} catch (err) {
			logger.warn("[PickOfDay] Failed to auto-expire picks in DB:",
				{ error: err instanceof Error ? err.message : String(err) });
		}
	}

	if (picksToUpdateInDb.length > 0) {
		// Fire-and-forget price sync — log failures instead of silently swallowing
		Promise.all(
			picksToUpdateInDb.map((u) =>
				db
					.update(dailyPicks)
					.set({
						currentPrice: u.currentPrice,
						returnPct: u.returnPct,
						daysHeld: u.daysHeld,
						status: u.status as any,
						updatedAt: new Date(),
					})
					.where(eq(dailyPicks.id, u.id))
					.catch((err) =>
						logger.warn(
							`[PickEnrich] DB price update failed for pick ${u.id}:`,
							err,
						),
					),
			),
		).catch((err) =>
			logger.error("[PickEnrich] Batch price update error:", err),
		);
	}

	return { picks, categoryLastUpdated };
}
