import { logger } from "../../logger";

// Mock simple cache for exchange rates
const rateCache = new Map<string, { rate: number; timestamp: number }>();
const RATE_CACHE_TTL = 3600000; // 1 hour

export class ValuationEngine {
	/**
	 * Retrieves the current exchange rate between two currencies
	 */
	async getExchangeRate(from: string, to: string): Promise<number> {
		const pair = `${from}_${to}`;

		if (rateCache.has(pair)) {
			const cached = rateCache.get(pair)!;
			if (Date.now() - cached.timestamp < RATE_CACHE_TTL) {
				return cached.rate;
			}
		}

		try {
			logger.debug(`[ValuationEngine] Fetching live exchange rate for ${pair}`);

			// In a real implementation, this would call an external API like Fixer, OpenExchangeRates, etc.
			// For now, we mock it.
			let rate = 1;
			if (from === "USD" && to === "INR") {
				rate = 83.5; // Mock current approximate rate
			} else if (from === "INR" && to === "USD") {
				rate = 1 / 83.5;
			}

			rateCache.set(pair, {
				rate,
				timestamp: Date.now(),
			});

			return rate;
		} catch (error: any) {
			logger.error(`[ValuationEngine] Failed to fetch exchange rate`, {
				error: error.message,
			});
			// Fallback to cache if available
			if (rateCache.has(pair)) {
				return rateCache.get(pair)!.rate;
			}
			throw error;
		}
	}

	/**
	 * Converts an amount from one currency to another
	 */
	async convert(amount: number, from: string, to: string): Promise<number> {
		if (from === to) return amount;
		const rate = await this.getExchangeRate(from, to);
		return amount * rate;
	}
}

export const valuationEngine = new ValuationEngine();
