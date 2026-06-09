import type {
	IDataProvider,
	CompanyProfile,
	FinancialRatios,
	FinancialStatement,
	HistoricalPrice,
	StockScreenerResult,
} from "./data-provider";

export interface ProviderHealth {
	name: string;
	isAvailable: boolean;
	isHealthy: boolean;
	successCount: number;
	failureCount: number;
	totalCalls: number;
	successRate: number;
	avgLatencyMs: number;
	lastSuccess: string | null;
	lastFailure: string | null;
	lastError: string | null;
	consecutiveFailures: number;
	rateLimitHits: number;
	registeredAt: string;
}

interface ProviderEntry {
	provider: IDataProvider;
	priority: number;
	metrics: {
		successCount: number;
		failureCount: number;
		totalCalls: number;
		latencySum: number;
		lastSuccess: Date | null;
		lastFailure: Date | null;
		lastError: string | null;
		consecutiveFailures: number;
		rateLimitHits: number;
		registeredAt: Date;
	};
}

export interface RegistryStats {
	providers: ProviderHealth[];
	fallbacksTriggered: number;
	totalRequests: number;
	primaryProvider: string;
}

type ProviderMethod =
	| "getCompanyProfile"
	| "getRatios"
	| "getIncomeStatement"
	| "getBalanceSheet"
	| "getCashFlow"
	| "getHistoricalPrices"
	| "getStockScreener"
	| "getQuote";

const UNHEALTHY_THRESHOLD = 5;
const COOLDOWN_MS = 5 * 60 * 1000;

class DataProviderRegistry {
	private providers: Map<string, ProviderEntry> = new Map();
	private fallbacksTriggered = 0;
	private totalRequests = 0;

	register(provider: IDataProvider, priority: number = 100): void {
		this.providers.set(provider.name, {
			provider,
			priority,
			metrics: {
				successCount: 0,
				failureCount: 0,
				totalCalls: 0,
				latencySum: 0,
				lastSuccess: null,
				lastFailure: null,
				lastError: null,
				consecutiveFailures: 0,
				rateLimitHits: 0,
				registeredAt: new Date(),
			},
		});
		console.log(
			`[ProviderRegistry] Registered: ${provider.name} (priority: ${priority})`,
		);
	}

	private getOrderedProviders(): ProviderEntry[] {
		return Array.from(this.providers.values()).sort(
			(a, b) => a.priority - b.priority,
		);
	}

	private isProviderHealthy(entry: ProviderEntry): boolean {
		if (entry.metrics.consecutiveFailures >= UNHEALTHY_THRESHOLD) {
			if (entry.metrics.lastFailure) {
				const elapsed = Date.now() - entry.metrics.lastFailure.getTime();
				if (elapsed > COOLDOWN_MS) {
					entry.metrics.consecutiveFailures = 0;
					return true;
				}
			}
			return false;
		}
		return true;
	}

	private recordSuccess(entry: ProviderEntry, latencyMs: number): void {
		entry.metrics.successCount++;
		entry.metrics.totalCalls++;
		entry.metrics.latencySum += latencyMs;
		entry.metrics.lastSuccess = new Date();
		entry.metrics.consecutiveFailures = 0;
	}

	private recordFailure(entry: ProviderEntry, error: string): void {
		entry.metrics.failureCount++;
		entry.metrics.totalCalls++;
		entry.metrics.lastFailure = new Date();
		entry.metrics.lastError = error;
		entry.metrics.consecutiveFailures++;
		if (error.toLowerCase().includes("rate limit") || error.includes("429")) {
			entry.metrics.rateLimitHits++;
		}
	}

	async executeWithFallback<T>(
		method: ProviderMethod,
		args: any[],
		defaultValue: T,
	): Promise<{ result: T; provider: string }> {
		this.totalRequests++;
		const ordered = this.getOrderedProviders();
		let usedFallback = false;

		for (const entry of ordered) {
			if (!this.isProviderHealthy(entry)) {
				usedFallback = true;
				continue;
			}

			const fn = (entry.provider as any)[method];
			if (typeof fn !== "function") continue;

			const start = Date.now();
			try {
				const result = await fn.apply(entry.provider, args);
				const latency = Date.now() - start;
				this.recordSuccess(entry, latency);

				if (
					result === null ||
					result === undefined ||
					(Array.isArray(result) && result.length === 0)
				) {
					usedFallback = true;
					continue;
				}

				if (usedFallback) this.fallbacksTriggered++;
				return { result: result as T, provider: entry.provider.name };
			} catch (err: any) {
				const latency = Date.now() - start;
				this.recordFailure(entry, err.message || "Unknown error");
				usedFallback = true;
			}
		}

		return { result: defaultValue, provider: "none" };
	}

	async getCompanyProfile(
		symbol: string,
	): Promise<{ result: CompanyProfile | null; provider: string }> {
		return this.executeWithFallback<CompanyProfile | null>(
			"getCompanyProfile",
			[symbol],
			null,
		);
	}

	async getRatios(
		symbol: string,
	): Promise<{ result: FinancialRatios | null; provider: string }> {
		return this.executeWithFallback<FinancialRatios | null>(
			"getRatios",
			[symbol],
			null,
		);
	}

	async getIncomeStatement(
		symbol: string,
		period?: string,
	): Promise<{ result: FinancialStatement[]; provider: string }> {
		return this.executeWithFallback<FinancialStatement[]>(
			"getIncomeStatement",
			[symbol, period],
			[],
		);
	}

	async getBalanceSheet(
		symbol: string,
		period?: string,
	): Promise<{ result: FinancialStatement[]; provider: string }> {
		return this.executeWithFallback<FinancialStatement[]>(
			"getBalanceSheet",
			[symbol, period],
			[],
		);
	}

	async getCashFlow(
		symbol: string,
		period?: string,
	): Promise<{ result: FinancialStatement[]; provider: string }> {
		return this.executeWithFallback<FinancialStatement[]>(
			"getCashFlow",
			[symbol, period],
			[],
		);
	}

	async getHistoricalPrices(
		symbol: string,
		from?: string,
		to?: string,
	): Promise<{ result: HistoricalPrice[]; provider: string }> {
		return this.executeWithFallback<HistoricalPrice[]>(
			"getHistoricalPrices",
			[symbol, from, to],
			[],
		);
	}

	async getStockScreener(
		marketCapMin?: number,
		exchange?: string,
		limit?: number,
	): Promise<{ result: StockScreenerResult[]; provider: string }> {
		return this.executeWithFallback<StockScreenerResult[]>(
			"getStockScreener",
			[marketCapMin, exchange, limit],
			[],
		);
	}

	async getQuote(
		symbol: string,
	): Promise<{
		result: {
			price: number;
			change: number;
			changePercent: number;
			volume: number;
		} | null;
		provider: string;
	}> {
		return this.executeWithFallback<{
			price: number;
			change: number;
			changePercent: number;
			volume: number;
		} | null>("getQuote", [symbol], null);
	}

	getStats(): RegistryStats {
		const providers: ProviderHealth[] = [];
		const ordered = this.getOrderedProviders();

		for (const entry of ordered) {
			const total = entry.metrics.totalCalls;
			providers.push({
				name: entry.provider.name,
				isAvailable: true,
				isHealthy: this.isProviderHealthy(entry),
				successCount: entry.metrics.successCount,
				failureCount: entry.metrics.failureCount,
				totalCalls: total,
				successRate:
					total > 0
						? Math.round((entry.metrics.successCount / total) * 100)
						: 100,
				avgLatencyMs:
					total > 0
						? Math.round(
								entry.metrics.latencySum / entry.metrics.successCount,
							) || 0
						: 0,
				lastSuccess: entry.metrics.lastSuccess?.toISOString() || null,
				lastFailure: entry.metrics.lastFailure?.toISOString() || null,
				lastError: entry.metrics.lastError,
				consecutiveFailures: entry.metrics.consecutiveFailures,
				rateLimitHits: entry.metrics.rateLimitHits,
				registeredAt: entry.metrics.registeredAt.toISOString(),
			});
		}

		return {
			providers,
			fallbacksTriggered: this.fallbacksTriggered,
			totalRequests: this.totalRequests,
			primaryProvider: ordered[0]?.provider.name || "none",
		};
	}

	getProviderNames(): string[] {
		return Array.from(this.providers.keys());
	}

	resetMetrics(providerName?: string): void {
		if (providerName) {
			const entry = this.providers.get(providerName);
			if (entry) {
				entry.metrics = {
					successCount: 0,
					failureCount: 0,
					totalCalls: 0,
					latencySum: 0,
					lastSuccess: null,
					lastFailure: null,
					lastError: null,
					consecutiveFailures: 0,
					rateLimitHits: 0,
					registeredAt: entry.metrics.registeredAt,
				};
			}
		} else {
			for (const entry of this.providers.values()) {
				entry.metrics = {
					successCount: 0,
					failureCount: 0,
					totalCalls: 0,
					latencySum: 0,
					lastSuccess: null,
					lastFailure: null,
					lastError: null,
					consecutiveFailures: 0,
					rateLimitHits: 0,
					registeredAt: entry.metrics.registeredAt,
				};
			}
			this.fallbacksTriggered = 0;
			this.totalRequests = 0;
		}
	}
}

let registryInstance: DataProviderRegistry | null = null;

export function getProviderRegistry(): DataProviderRegistry {
	if (!registryInstance) {
		registryInstance = new DataProviderRegistry();

		const { getDataProvider } = require("./fmp-provider");
		const { getAlphaVantageProvider } = require("./alpha-vantage-provider");

		const fmpProvider = getDataProvider();
		const avProvider = getAlphaVantageProvider();

		registryInstance.register(fmpProvider, 1);
		registryInstance.register(avProvider, 2);

		console.log(
			"✅ [ProviderRegistry] Initialized with FMP (primary) + AlphaVantage (fallback)",
		);
	}
	return registryInstance;
}

export type { DataProviderRegistry };
