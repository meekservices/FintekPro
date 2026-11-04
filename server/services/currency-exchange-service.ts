/* eslint-disable no-console */
import { db } from "../db";
import { currencyRates } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "../logger";

interface ExchangeRateResponse {
	base: string;
	rates: Record<string, number>;
	date: string;
}

export class CurrencyExchangeService {
	private static instance: CurrencyExchangeService;
	private supportedCurrencies = [
		"INR",
		"USD",
		"EUR",
		"GBP",
		"JPY",
		"AUD",
		"CAD",
		"SGD",
		"AED",
		"SEK",
		"CHF",
	];
	private refreshInterval: NodeJS.Timeout | null = null;
	private quotaDay: string = "";
	private quotaDailyCount: number = 0;

	private constructor() {}

	static getInstance(): CurrencyExchangeService {
		if (!CurrencyExchangeService.instance) {
			CurrencyExchangeService.instance = new CurrencyExchangeService();
		}
		return CurrencyExchangeService.instance;
	}

	getSupportedCurrencies(): string[] {
		return [...this.supportedCurrencies];
	}

	private async delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Ingests live interbank mid-market FX rates from AllRatesToday.
	 * Sourced from Reuters / Refinitiv interbank feeds.
	 *
	 * Cost Optimization:
	 * A single HTTP call fetches USD against all 8 target currencies.
	 * Automatically cross-calculates INR and target cross pairs.
	 * Strictly respects the 300 requests/month free tier with an in-memory daily quota guard.
	 *
	 * @returns {Promise<boolean>} true if successfully fetched and updated, false otherwise.
	 */
	async updateRatesFromAllRatesToday(): Promise<boolean> {
		const apiKey = process.env.ALL_RATES_TODAY_API_KEY;
		if (!apiKey) return false;

		const today = new Date().toISOString().split("T")[0];
		if (this.quotaDay !== today) {
			this.quotaDay = today;
			this.quotaDailyCount = 0;
		}

		// Hard ceiling: max 8 calls/day ensures we stay under 250 calls/month (budget: 300)
		if (this.quotaDailyCount >= 8) {
			logger.info(
				"[CurrencyExchangeService] AllRatesToday daily free quota ceiling reached (8 calls). Skipping until tomorrow.",
			);
			return false;
		}

		try {
			const targetList = this.supportedCurrencies
				.filter((c) => c !== "USD")
				.join(",");
			const url = `https://allratestoday.com/api/v1/rates?source=USD&target=${targetList}`;

			const res = await fetch(url, {
				headers: { Authorization: `Bearer ${apiKey}` },
				signal: AbortSignal.timeout(8000),
			});

			if (!res.ok) {
				logger.warn(
					`[CurrencyExchangeService] AllRatesToday returned HTTP ${res.status}: ${res.statusText}`,
				);
				return false;
			}

			const items = (await res.json()) as Array<{
				rate: number;
				source: string;
				target: string;
				time: string;
			}>;

			if (!Array.isArray(items) || items.length === 0) {
				return false;
			}

			this.quotaDailyCount++;
			const ratesMap: Record<string, number> = { USD: 1.0 };
			for (const item of items) {
				if (item.target && typeof item.rate === "number" && item.rate > 0) {
					ratesMap[item.target] = item.rate;
				}
			}

			const usdInr = ratesMap["INR"];
			if (!usdInr || usdInr <= 0) {
				logger.warn(
					"[CurrencyExchangeService] AllRatesToday did not return a valid USD/INR rate",
				);
				return false;
			}

			const now = new Date();
			const upsertRows: Array<{
				baseCurrency: string;
				targetCurrency: string;
				exchangeRate: string;
				dataSource: string;
				lastUpdated: Date;
			}> = [];

			// 1. USD <-> Target pairs
			for (const [target, rate] of Object.entries(ratesMap)) {
				if (target === "USD") continue;
				upsertRows.push({
					baseCurrency: "USD",
					targetCurrency: target,
					exchangeRate: rate.toString(),
					dataSource: "allratestoday",
					lastUpdated: now,
				});
				upsertRows.push({
					baseCurrency: target,
					targetCurrency: "USD",
					exchangeRate: (1 / rate).toFixed(8),
					dataSource: "allratestoday",
					lastUpdated: now,
				});
			}

			// 2. INR <-> Target pairs (Derived cross rates)
			// Target/INR = usdInr / rateAgainstUsd
			// INR/Target = rateAgainstUsd / usdInr
			for (const [target, rateAgainstUsd] of Object.entries(ratesMap)) {
				if (target === "INR") continue;
				const targetToInr = usdInr / rateAgainstUsd;
				const inrToTarget = rateAgainstUsd / usdInr;

				upsertRows.push({
					baseCurrency: target,
					targetCurrency: "INR",
					exchangeRate: targetToInr.toFixed(8),
					dataSource: "allratestoday",
					lastUpdated: now,
				});
				upsertRows.push({
					baseCurrency: "INR",
					targetCurrency: target,
					exchangeRate: inrToTarget.toFixed(8),
					dataSource: "allratestoday",
					lastUpdated: now,
				});
			}

			for (const row of upsertRows) {
				await db
					.insert(currencyRates)
					.values({
						baseCurrency: row.baseCurrency,
						targetCurrency: row.targetCurrency,
						exchangeRate: row.exchangeRate,
						dataSource: row.dataSource,
					})
					.onConflictDoUpdate({
						target: [
							currencyRates.baseCurrency,
							currencyRates.targetCurrency,
						],
						set: {
							exchangeRate: row.exchangeRate,
							dataSource: row.dataSource,
							lastUpdated: now,
						},
					});
			}

			logger.info(
				`[CurrencyExchangeService] ✅ AllRatesToday ingested ${upsertRows.length} rates in 1 API call (Daily usage: ${this.quotaDailyCount}/8). USD/INR: ${usdInr}`,
			);
			return true;
		} catch (err: any) {
			logger.warn(
				`[CurrencyExchangeService] AllRatesToday fetch warning: ${err?.message || err}`,
			);
			return false;
		}
	}

	async fetchExchangeRates(
		baseCurrency: string = "INR",
	): Promise<Record<string, number>> {
		const apiKey = process.env.EXCHANGE_RATE_API_KEY;
		const url = apiKey
			? `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${baseCurrency}`
			: `https://api.exchangerate-api.com/v4/latest/${baseCurrency}`;

		const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });

		if (!response.ok) {
			throw new Error(`Failed to fetch exchange rates: ${response.statusText}`);
		}

		const data = await response.json();
		const rates = apiKey ? data.conversion_rates : data.rates;
		return rates;
	}

	async updateCurrencyRates(baseCurrency: string = "INR"): Promise<void> {
		try {
			const rates = await this.fetchExchangeRates(baseCurrency);

			for (const [targetCurrency, rate] of Object.entries(rates)) {
				if (this.supportedCurrencies.includes(targetCurrency)) {
					await db
						.insert(currencyRates)
						.values({
							baseCurrency,
							targetCurrency,
							exchangeRate: rate.toString(),
							dataSource: "exchangerate-api",
						})
						.onConflictDoUpdate({
							target: [
								currencyRates.baseCurrency,
								currencyRates.targetCurrency,
							],
							set: {
								exchangeRate: rate.toString(),
								lastUpdated: new Date(),
							},
						});
				}
			}
		} catch (error) {
			throw error;
		}
	}

	async convertAmount(
		amount: number,
		fromCurrency: string,
		toCurrency: string,
	): Promise<number> {
		if (fromCurrency === toCurrency) {
			return amount;
		}

		try {
			// Fetch the exchange rate from database
			const rate = await db.query.currencyRates.findFirst({
				where: and(
					eq(currencyRates.baseCurrency, fromCurrency),
					eq(currencyRates.targetCurrency, toCurrency),
				),
			});

			if (rate) {
				return amount * Number.parseFloat(rate.exchangeRate);
			}

			// If not found, try inverse rate
			const inverseRate = await db.query.currencyRates.findFirst({
				where: and(
					eq(currencyRates.baseCurrency, toCurrency),
					eq(currencyRates.targetCurrency, fromCurrency),
				),
			});

			if (inverseRate) {
				return amount / Number.parseFloat(inverseRate.exchangeRate);
			}

			// If still not found, fetch fresh rates
			await this.updateCurrencyRates(fromCurrency);

			const freshRate = await db.query.currencyRates.findFirst({
				where: and(
					eq(currencyRates.baseCurrency, fromCurrency),
					eq(currencyRates.targetCurrency, toCurrency),
				),
			});

			if (freshRate) {
				return amount * Number.parseFloat(freshRate.exchangeRate);
			}

			throw new Error(
				`Unable to find exchange rate from ${fromCurrency} to ${toCurrency}`,
			);
		} catch (error) {
			console.error(
				`Error converting amount from ${fromCurrency} to ${toCurrency}:`,
				error,
			);
			throw error;
		}
	}

	/**
	 * Retrieves the exchange rate between two currencies.
	 * Purpose: Returns 1 unit of fromCurrency expressed in toCurrency.
	 * e.g. getExchangeRate("USD", "INR") => 94.60
	 */
	async getExchangeRate(
		fromCurrency: string,
		toCurrency: string,
	): Promise<number> {
		if (fromCurrency === toCurrency) {
			return 1.0;
		}
		return this.convertAmount(1.0, fromCurrency, toCurrency);
	}

	async initializeRates(): Promise<void> {
		console.log("🔄 Initializing currency exchange rates...");

		// 1. Try AllRatesToday first (1 single call refreshes all pairs, saving quota)
		const allRatesSuccess = await this.updateRatesFromAllRatesToday();
		if (allRatesSuccess) {
			console.log(
				"✅ Currency exchange rates successfully initialized via AllRatesToday interbank feed",
			);
			return;
		}

		// 2. Fallback to existing ExchangeRate-API provider
		let successCount = 0;
		let failCount = 0;

		for (const currency of this.supportedCurrencies) {
			try {
				await this.updateCurrencyRates(currency);
				successCount++;
			} catch (err: any) {
				failCount++;
				if (failCount === 1) {
					console.warn(
						`⚠️ Currency rate fetch limited (${err.message || "rate limited"}). Using cached rates for remaining currencies.`,
					);
				}
			}
			if (failCount === 0) {
				await this.delay(1500);
			} else {
				break;
			}
		}

		console.log(
			`✅ Currency exchange rates initialized (${successCount} updated, ${failCount > 0 ? failCount + " using cached" : "all fresh"})`,
		);
	}

	startAutoRefresh(): void {
		// Run every 4 hours during market days (max 6 calls/day with strict quota guard)
		this.refreshInterval = setInterval(
			async () => {
				console.log("🔄 Auto-refreshing currency exchange rates...");
				const success = await this.updateRatesFromAllRatesToday();
				if (!success) {
					try {
						await this.updateCurrencyRates("INR");
					} catch {
						// Silently continue - rates will use cached values
					}
				}
			},
			4 * 60 * 60 * 1000,
		);

		console.log("✅ Currency auto-refresh started (4-hour interval with AllRatesToday quota guard)");
	}

	stopAutoRefresh(): void {
		if (this.refreshInterval) {
			clearInterval(this.refreshInterval);
			this.refreshInterval = null;
			console.log("Currency auto-refresh stopped");
		}
	}
}

export const currencyExchangeService = CurrencyExchangeService.getInstance();
