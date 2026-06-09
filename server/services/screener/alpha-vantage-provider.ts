import type {
	IDataProvider,
	CompanyProfile,
	FinancialRatios,
	FinancialStatement,
	HistoricalPrice,
	StockScreenerResult,
} from "./data-provider";

const AV_BASE_URL = "https://www.alphavantage.co/query";

const avWarnThrottle: Record<string, number> = {};
function avThrottledWarn(key: string, msg: string) {
	const now = Date.now();
	if (!avWarnThrottle[key] || now - avWarnThrottle[key] > 3600000) {
		console.warn(msg);
		avWarnThrottle[key] = now;
	}
}

class AlphaVantageProvider implements IDataProvider {
	name = "ALPHA_VANTAGE";
	private apiKey: string;
	private callCount = 0;
	private callWindowStart = Date.now();
	private readonly MAX_CALLS_PER_MINUTE = 5;
	private readonly MAX_CALLS_PER_DAY = 500;
	private dailyCalls = 0;
	private dailyResetAt = Date.now() + 86400000;

	constructor() {
		this.apiKey = process.env.ALPHA_VANTAGE_API_KEY || "";
		if (!this.apiKey) {
			console.warn("[AlphaVantage] No ALPHA_VANTAGE_API_KEY found");
		} else {
			console.log("✅ [AlphaVantage] Provider initialized");
		}
	}

	private async rateLimit(): Promise<boolean> {
		const now = Date.now();
		if (now > this.dailyResetAt) {
			this.dailyCalls = 0;
			this.dailyResetAt = now + 86400000;
		}
		if (this.dailyCalls >= this.MAX_CALLS_PER_DAY) {
			avThrottledWarn("daily", "[AlphaVantage] Daily rate limit reached");
			return false;
		}
		if (now - this.callWindowStart > 60000) {
			this.callCount = 0;
			this.callWindowStart = now;
		}
		if (this.callCount >= this.MAX_CALLS_PER_MINUTE) {
			const waitMs = 60000 - (now - this.callWindowStart) + 500;
			await new Promise((r) => setTimeout(r, waitMs));
			this.callCount = 0;
			this.callWindowStart = Date.now();
		}
		return true;
	}

	private async fetchAV<T>(params: Record<string, string>): Promise<T | null> {
		if (!this.apiKey) return null;
		if (!(await this.rateLimit())) return null;

		const queryParams = new URLSearchParams({ ...params, apikey: this.apiKey });
		const url = `${AV_BASE_URL}?${queryParams}`;

		try {
			const response = await fetch(url, {
				signal: AbortSignal.timeout(15000),
				headers: { Accept: "application/json", "User-Agent": "FintekPro/2.5" },
			});

			this.callCount++;
			this.dailyCalls++;

			if (!response.ok) {
				avThrottledWarn(
					`http_${response.status}`,
					`[AlphaVantage] HTTP ${response.status}`,
				);
				return null;
			}

			const data = await response.json();

			if (data["Error Message"]) {
				return null;
			}
			if (data.Note || data.Information) {
				avThrottledWarn("ratelimit", "[AlphaVantage] API rate limit reached");
				return null;
			}

			return data as T;
		} catch (err: any) {
			avThrottledWarn("fetch", `[AlphaVantage] Request failed: ${err.message}`);
			return null;
		}
	}

	async getCompanyProfile(symbol: string): Promise<CompanyProfile | null> {
		const data = await this.fetchAV<any>({
			function: "OVERVIEW",
			symbol,
		});
		if (!data || !data.Symbol) return null;

		return {
			symbol: data.Symbol,
			companyName: data.Name || symbol,
			exchange: data.Exchange || "Unknown",
			sector: data.Sector || "Unknown",
			industry: data.Industry || "Unknown",
			marketCap: Number.parseFloat(data.MarketCapitalization) || 0,
			price: 0,
			currency: data.Currency || "USD",
			country: data.Country || "US",
			description: data.Description,
		};
	}

	async getRatios(symbol: string): Promise<FinancialRatios | null> {
		const data = await this.fetchAV<any>({
			function: "OVERVIEW",
			symbol,
		});
		if (!data || !data.Symbol) return null;

		return {
			symbol: data.Symbol,
			period: "TTM",
			peRatio: Number.parseFloat(data.PERatio) || undefined,
			pbRatio: Number.parseFloat(data.PriceToBookRatio) || undefined,
			evToEbitda: Number.parseFloat(data.EVToEBITDA) || undefined,
			priceToSales: Number.parseFloat(data.PriceToSalesRatioTTM) || undefined,
			roe: Number.parseFloat(data.ReturnOnEquityTTM) || undefined,
			roa: Number.parseFloat(data.ReturnOnAssetsTTM) || undefined,
			netProfitMargin: Number.parseFloat(data.ProfitMargin) || undefined,
			operatingMargin: Number.parseFloat(data.OperatingMarginTTM) || undefined,
			eps: Number.parseFloat(data.EPS) || undefined,
			bookValue: Number.parseFloat(data.BookValue) || undefined,
			dividendYield: Number.parseFloat(data.DividendYield) || undefined,
			dividendPayout: Number.parseFloat(data.PayoutRatio) || undefined,
			revenueGrowth:
				Number.parseFloat(data.QuarterlyRevenueGrowthYOY) || undefined,
			earningsGrowth:
				Number.parseFloat(data.QuarterlyEarningsGrowthYOY) || undefined,
		};
	}

	async getIncomeStatement(
		symbol: string,
		period = "annual",
	): Promise<FinancialStatement[]> {
		const func = period === "quarter" ? "INCOME_STATEMENT" : "INCOME_STATEMENT";
		const data = await this.fetchAV<any>({ function: func, symbol });
		if (!data) return [];

		const reports =
			period === "quarter" ? data.quarterlyReports : data.annualReports;
		if (!Array.isArray(reports)) return [];

		return reports.slice(0, 5).map((r: any) => ({
			symbol,
			date: r.fiscalDateEnding,
			period: period === "quarter" ? "Q" : "FY",
			revenue: Number.parseFloat(r.totalRevenue) || undefined,
			netIncome: Number.parseFloat(r.netIncome) || undefined,
			grossProfit: Number.parseFloat(r.grossProfit) || undefined,
			operatingIncome: Number.parseFloat(r.operatingIncome) || undefined,
		}));
	}

	async getBalanceSheet(
		symbol: string,
		period = "annual",
	): Promise<FinancialStatement[]> {
		const data = await this.fetchAV<any>({ function: "BALANCE_SHEET", symbol });
		if (!data) return [];

		const reports =
			period === "quarter" ? data.quarterlyReports : data.annualReports;
		if (!Array.isArray(reports)) return [];

		return reports.slice(0, 5).map((r: any) => ({
			symbol,
			date: r.fiscalDateEnding,
			period: period === "quarter" ? "Q" : "FY",
			totalDebt:
				(Number.parseFloat(r.longTermDebt) || 0) +
				(Number.parseFloat(r.shortTermDebt) || 0),
			totalEquity: Number.parseFloat(r.totalShareholderEquity) || undefined,
			totalAssets: Number.parseFloat(r.totalAssets) || undefined,
		}));
	}

	async getCashFlow(
		symbol: string,
		period = "annual",
	): Promise<FinancialStatement[]> {
		const data = await this.fetchAV<any>({ function: "CASH_FLOW", symbol });
		if (!data) return [];

		const reports =
			period === "quarter" ? data.quarterlyReports : data.annualReports;
		if (!Array.isArray(reports)) return [];

		return reports.slice(0, 5).map((r: any) => ({
			symbol,
			date: r.fiscalDateEnding,
			period: period === "quarter" ? "Q" : "FY",
			operatingCashFlow: Number.parseFloat(r.operatingCashflow) || undefined,
			freeCashFlow:
				(Number.parseFloat(r.operatingCashflow) || 0) -
					Math.abs(Number.parseFloat(r.capitalExpenditures) || 0) || undefined,
			capitalExpenditure: Number.parseFloat(r.capitalExpenditures) || undefined,
		}));
	}

	async getHistoricalPrices(
		symbol: string,
		from?: string,
		to?: string,
	): Promise<HistoricalPrice[]> {
		const data = await this.fetchAV<any>({
			function: "TIME_SERIES_DAILY",
			symbol,
			outputsize: "compact",
		});
		if (!data) return [];

		const timeSeries = data["Time Series (Daily)"];
		if (!timeSeries) return [];

		const entries = Object.entries(timeSeries)
			.filter(([date]) => {
				if (from && date < from) return false;
				if (to && date > to) return false;
				return true;
			})
			.slice(0, 100);

		return entries.map(([date, values]: [string, any]) => ({
			symbol,
			date,
			open: Number.parseFloat(values["1. open"]) || 0,
			high: Number.parseFloat(values["2. high"]) || 0,
			low: Number.parseFloat(values["3. low"]) || 0,
			close: Number.parseFloat(values["4. close"]) || 0,
			adjClose: Number.parseFloat(values["4. close"]) || 0,
			volume: Number.parseInt(values["5. volume"]) || 0,
			changePercent: 0,
		}));
	}

	async getStockScreener(
		_marketCapMin?: number,
		_exchange?: string,
		_limit?: number,
	): Promise<StockScreenerResult[]> {
		return [];
	}

	async getQuote(
		symbol: string,
	): Promise<{
		price: number;
		change: number;
		changePercent: number;
		volume: number;
	} | null> {
		const data = await this.fetchAV<any>({
			function: "GLOBAL_QUOTE",
			symbol,
		});
		if (!data) return null;

		const q = data["Global Quote"];
		if (!q || !q["05. price"]) return null;

		return {
			price: Number.parseFloat(q["05. price"]) || 0,
			change: Number.parseFloat(q["09. change"]) || 0,
			changePercent:
				Number.parseFloat((q["10. change percent"] || "0").replace("%", "")) ||
				0,
			volume: Number.parseInt(q["06. volume"]) || 0,
		};
	}

	getUsageStats() {
		return {
			dailyCalls: this.dailyCalls,
			maxDaily: this.MAX_CALLS_PER_DAY,
			minuteCalls: this.callCount,
			maxPerMinute: this.MAX_CALLS_PER_MINUTE,
			remaining: this.MAX_CALLS_PER_DAY - this.dailyCalls,
		};
	}
}

let avInstance: AlphaVantageProvider | null = null;

export function getAlphaVantageProvider(): AlphaVantageProvider {
	if (!avInstance) {
		avInstance = new AlphaVantageProvider();
	}
	return avInstance;
}

export type { AlphaVantageProvider };
