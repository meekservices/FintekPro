/**
 * Finnhub Financial Data Service
 * Secondary data source for financial enrichment
 *
 * Rate Limits (Free Tier):
 * - 60 API calls/minute
 * - Uses exponential backoff retry strategy
 *
 * Provides:
 * - Company profile and basic financials
 * - Income statements, balance sheets, cash flow
 * - Basic metrics and ratios
 * - Stock quotes for listed equivalents
 */

import axios, { AxiosInstance } from "axios";
import { ExternalServiceError, ValidationError } from "../utils/errors";
import { requestDedupeService } from "./request-deduplication-service";
import { CircuitBreaker, CircuitOpenError } from "../utils/circuit-breaker";

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || "";
const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";

// Rate limiting configuration
const RATE_LIMIT_PER_MINUTE = 60;
const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export interface FinnhubCompanyProfile {
	ticker: string;
	name: string;
	country: string;
	currency: string;
	exchange: string;
	ipo: string;
	marketCapitalization: number;
	shareOutstanding: number;
	logo: string;
	phone: string;
	weburl: string;
	finnhubIndustry: string;
}

export interface FinnhubFinancialStatement {
	symbol: string;
	financials: Array<{
		period: string;
		year: number;
		quarter?: number;
		revenue?: number;
		costOfGoodsSold?: number;
		grossProfit?: number;
		operatingExpenses?: number;
		operatingIncome?: number;
		ebit?: number;
		ebitda?: number;
		interestExpense?: number;
		taxExpense?: number;
		netIncome?: number;
		eps?: number;
		epsDiluted?: number;
		totalAssets?: number;
		totalLiabilities?: number;
		totalEquity?: number;
		totalDebt?: number;
		cashAndShortTermInvestments?: number;
		currentAssets?: number;
		currentLiabilities?: number;
		operatingCashFlow?: number;
		investingCashFlow?: number;
		financingCashFlow?: number;
		freeCashFlow?: number;
	}>;
}

export interface FinnhubBasicFinancials {
	symbol: string;
	metric: {
		"52WeekHigh"?: number;
		"52WeekLow"?: number;
		peBasicExclExtraTTM?: number;
		pbAnnual?: number;
		revenuePerShareTTM?: number;
		roaRfy?: number;
		roeTTM?: number;
		currentRatioAnnual?: number;
		quickRatioAnnual?: number;
		debtEquityAnnual?: number;
		dividendYieldIndicatedAnnual?: number;
		marketCapitalization?: number;
		netProfitMarginTTM?: number;
		operatingMarginTTM?: number;
		grossMarginTTM?: number;
	};
	series?: {
		annual?: {
			revenue?: Array<{ period: string; v: number }>;
			netIncome?: Array<{ period: string; v: number }>;
		};
	};
}

export interface FinnhubSearchResult {
	count: number;
	result: Array<{
		description: string;
		displaySymbol: string;
		symbol: string;
		type: string;
	}>;
}

export interface FinnhubFetchResult<T> {
	success: boolean;
	data?: T;
	source: "finnhub";
	retrievedAt: Date;
	error?: string;
	rateLimitRemaining?: number;
}

class FinnhubService {
	private client: AxiosInstance;
	private isConfigured: boolean;
	private requestCount: number = 0;
	private windowStart: number = Date.now();
	private circuitBreaker = new CircuitBreaker({
		name: "Finnhub",
		failureThreshold: 5,
		cooldownMs: 30_000,
		successThreshold: 2,
	});

	constructor() {
		this.isConfigured = Boolean(FINNHUB_API_KEY);

		this.client = axios.create({
			baseURL: FINNHUB_BASE_URL,
			params: {
				token: FINNHUB_API_KEY,
			},
			timeout: 15000,
		});

		if (!this.isConfigured) {
			console.warn(
				"⚠️ FINNHUB_API_KEY not configured. Finnhub service will not be available.",
			);
		} else {
			console.log("✅ Finnhub service initialized");
		}
	}

	isReady(): boolean {
		return this.isConfigured;
	}

	getStatus(): {
		configured: boolean;
		baseUrl: string;
		rateLimitRemaining: number;
		circuitBreaker: ReturnType<CircuitBreaker["getStatus"]>;
	} {
		return {
			configured: this.isConfigured,
			baseUrl: FINNHUB_BASE_URL,
			rateLimitRemaining: this.getRateLimitRemaining(),
			circuitBreaker: this.circuitBreaker.getStatus(),
		};
	}

	private getRateLimitRemaining(): number {
		const now = Date.now();
		if (now - this.windowStart >= RATE_LIMIT_WINDOW_MS) {
			this.requestCount = 0;
			this.windowStart = now;
		}
		return RATE_LIMIT_PER_MINUTE - this.requestCount;
	}

	private async checkRateLimit(): Promise<void> {
		const remaining = this.getRateLimitRemaining();
		if (remaining <= 0) {
			const waitTime = RATE_LIMIT_WINDOW_MS - (Date.now() - this.windowStart);
			console.log(`[Finnhub] Rate limit reached, waiting ${waitTime}ms`);
			await new Promise((resolve) => setTimeout(resolve, waitTime));
			this.requestCount = 0;
			this.windowStart = Date.now();
		}
		this.requestCount++;
	}

	private async retryWithBackoff<T>(
		fn: () => Promise<T>,
		retries: number = MAX_RETRIES,
	): Promise<T> {
		let lastError: Error | null = null;

		for (let attempt = 0; attempt <= retries; attempt++) {
			try {
				await this.checkRateLimit();
				// Wrap each attempt in the circuit breaker
				return await this.circuitBreaker.execute(() => fn());
			} catch (error: any) {
				// Circuit open — fast-fail, no retries
				if (error instanceof CircuitOpenError) throw error;
				lastError = error;

				if (error.response?.status === 429) {
					const delay = BASE_DELAY_MS * 2 ** attempt;
					console.log(
						`[Finnhub] Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${retries + 1})`,
					);
					await new Promise((resolve) => setTimeout(resolve, delay));
				} else if (error.response?.status >= 500) {
					const delay = BASE_DELAY_MS * 2 ** attempt;
					console.log(
						`[Finnhub] Server error, retrying in ${delay}ms (attempt ${attempt + 1}/${retries + 1})`,
					);
					await new Promise((resolve) => setTimeout(resolve, delay));
				} else {
					throw error;
				}
			}
		}

		throw lastError || new Error("Max retries exceeded");
	}

	async searchSymbol(
		query: string,
	): Promise<FinnhubFetchResult<FinnhubSearchResult>> {
		if (!this.isConfigured) {
			return {
				success: false,
				source: "finnhub",
				retrievedAt: new Date(),
				error: "Finnhub not configured",
			};
		}

		try {
			const response = await this.retryWithBackoff(() =>
				this.client.get("/search", { params: { q: query } }),
			);

			return {
				success: true,
				data: response.data,
				source: "finnhub",
				retrievedAt: new Date(),
				rateLimitRemaining: this.getRateLimitRemaining(),
			};
		} catch (error: any) {
			console.error(`[Finnhub] Search error for "${query}": ${error.message}`);
			return {
				success: false,
				source: "finnhub",
				retrievedAt: new Date(),
				error: error.message,
			};
		}
	}

	async getCompanyProfile(
		symbol: string,
	): Promise<FinnhubFetchResult<FinnhubCompanyProfile>> {
		if (!this.isConfigured) {
			return {
				success: false,
				source: "finnhub",
				retrievedAt: new Date(),
				error: "Finnhub not configured",
			};
		}

		const dedupeKey = requestDedupeService.createKey(
			"finnhub",
			"profile",
			symbol,
		);

		return requestDedupeService.dedupe(
			dedupeKey,
			async () => {
				try {
					const response = await this.retryWithBackoff(() =>
						this.client.get("/stock/profile2", { params: { symbol } }),
					);

					if (!response.data || Object.keys(response.data).length === 0) {
						return {
							success: false,
							source: "finnhub",
							retrievedAt: new Date(),
							error: "Company not found",
						};
					}

					return {
						success: true,
						data: response.data,
						source: "finnhub",
						retrievedAt: new Date(),
						rateLimitRemaining: this.getRateLimitRemaining(),
					};
				} catch (error: any) {
					console.error(
						`[Finnhub] Profile error for ${symbol}: ${error.message}`,
					);
					return {
						success: false,
						source: "finnhub",
						retrievedAt: new Date(),
						error: error.message,
					};
				}
			},
			5 * 60 * 1000,
		); // Keep result cached for 5 minutes after first call
	}

	async getBasicFinancials(
		symbol: string,
	): Promise<FinnhubFetchResult<FinnhubBasicFinancials>> {
		if (!this.isConfigured) {
			return {
				success: false,
				source: "finnhub",
				retrievedAt: new Date(),
				error: "Finnhub not configured",
			};
		}

		const dedupeKey = requestDedupeService.createKey(
			"finnhub",
			"financials",
			symbol,
		);

		return requestDedupeService.dedupe(
			dedupeKey,
			async () => {
				try {
					const response = await this.retryWithBackoff(() =>
						this.client.get("/stock/metric", {
							params: { symbol, metric: "all" },
						}),
					);

					return {
						success: true,
						data: response.data,
						source: "finnhub",
						retrievedAt: new Date(),
						rateLimitRemaining: this.getRateLimitRemaining(),
					};
				} catch (error: any) {
					console.error(
						`[Finnhub] Financials error for ${symbol}: ${error.message}`,
					);
					return {
						success: false,
						source: "finnhub",
						retrievedAt: new Date(),
						error: error.message,
					};
				}
			},
			5 * 60 * 1000,
		); // Keep result cached for 5 minutes after first call
	}

	async getFinancialStatements(
		symbol: string,
		statementType: "bs" | "ic" | "cf" = "ic",
		frequency: "annual" | "quarterly" = "annual",
	): Promise<FinnhubFetchResult<any>> {
		if (!this.isConfigured) {
			return {
				success: false,
				source: "finnhub",
				retrievedAt: new Date(),
				error: "Finnhub not configured",
			};
		}

		try {
			const response = await this.retryWithBackoff(() =>
				this.client.get(`/stock/financials-reported`, {
					params: { symbol, freq: frequency },
				}),
			);

			return {
				success: true,
				data: response.data,
				source: "finnhub",
				retrievedAt: new Date(),
				rateLimitRemaining: this.getRateLimitRemaining(),
			};
		} catch (error: any) {
			console.error(
				`[Finnhub] Statements error for ${symbol}: ${error.message}`,
			);
			return {
				success: false,
				source: "finnhub",
				retrievedAt: new Date(),
				error: error.message,
			};
		}
	}

	async healthCheck(): Promise<{
		status: "healthy" | "unhealthy" | "unconfigured";
		message: string;
		responseTime?: number;
		rateLimitRemaining?: number;
	}> {
		if (!this.isConfigured) {
			return {
				status: "unconfigured",
				message: "Finnhub API key not configured",
			};
		}

		const startTime = Date.now();
		try {
			await this.client.get("/stock/profile2", { params: { symbol: "AAPL" } });

			return {
				status: "healthy",
				message: "Finnhub API is accessible",
				responseTime: Date.now() - startTime,
				rateLimitRemaining: this.getRateLimitRemaining(),
			};
		} catch (error: any) {
			return {
				status: "unhealthy",
				message: error.message,
				responseTime: Date.now() - startTime,
			};
		}
	}

	convertToStandardFormat(
		finnhubData: FinnhubBasicFinancials,
		companyId: string,
		financialYear: string,
	): {
		companyId: string;
		financialYear: string;
		source: "finnhub";
		retrievedAt: Date;
		metrics: {
			peRatio?: number;
			pbRatio?: number;
			roe?: number;
			roa?: number;
			currentRatio?: number;
			quickRatio?: number;
			debtEquity?: number;
			netProfitMargin?: number;
			operatingMargin?: number;
			grossMargin?: number;
			marketCap?: number;
		};
	} {
		const metric = finnhubData.metric;

		return {
			companyId,
			financialYear,
			source: "finnhub",
			retrievedAt: new Date(),
			metrics: {
				peRatio: metric.peBasicExclExtraTTM,
				pbRatio: metric.pbAnnual,
				roe: metric.roeTTM,
				roa: metric.roaRfy,
				currentRatio: metric.currentRatioAnnual,
				quickRatio: metric.quickRatioAnnual,
				debtEquity: metric.debtEquityAnnual,
				netProfitMargin: metric.netProfitMarginTTM,
				operatingMargin: metric.operatingMarginTTM,
				grossMargin: metric.grossMarginTTM,
				marketCap: metric.marketCapitalization,
			},
		};
	}
}

export const finnhubService = new FinnhubService();
