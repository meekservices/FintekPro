export interface CompanyProfile {
	symbol: string;
	companyName: string;
	exchange: string;
	sector: string;
	industry: string;
	marketCap: number;
	price: number;
	currency: string;
	country: string;
	isin?: string;
	description?: string;
}

export interface FinancialRatios {
	symbol: string;
	period: string;
	date?: string;
	peRatio?: number;
	forwardPe?: number;       // forward P/E from quote or key-metrics endpoint
	pegRatio?: number;        // price-to-earnings-growth ratio
	pbRatio?: number;
	evToEbitda?: number;
	priceToSales?: number;
	roe?: number;
	roce?: number;
	roa?: number;
	netProfitMargin?: number;
	operatingMargin?: number;
	grossMargin?: number;
	debtToEquity?: number;
	currentRatio?: number;
	quickRatio?: number;
	interestCoverage?: number;
	eps?: number;
	bookValue?: number;
	dividendYield?: number;
	dividendPayout?: number;
	revenueGrowth?: number;
	earningsGrowth?: number;
	freeCashFlowPerShare?: number;
}

export interface FinancialStatement {
	symbol: string;
	date: string;
	period: string;
	revenue?: number;
	netIncome?: number;
	grossProfit?: number;
	operatingIncome?: number;
	totalDebt?: number;
	totalEquity?: number;
	totalAssets?: number;
	/** totalCurrentLiabilities from balance sheet — used for Capital Employed = Assets - CL */
	currentLiabilities?: number;
	operatingCashFlow?: number;
	freeCashFlow?: number;
	capitalExpenditure?: number;
}

export interface HistoricalPrice {
	symbol: string;
	date: string;
	open: number;
	high: number;
	low: number;
	close: number;
	adjClose: number;
	volume: number;
	changePercent: number;
}

export interface StockScreenerResult {
	symbol: string;
	companyName: string;
	marketCap: number;
	price: number;
	sector: string;
	industry: string;
	exchange: string;
	country: string;
}

export interface IDataProvider {
	name: string;
	getCompanyProfile(symbol: string): Promise<CompanyProfile | null>;
	getRatios(symbol: string): Promise<FinancialRatios | null>;
	getIncomeStatement(
		symbol: string,
		period?: string,
	): Promise<FinancialStatement[]>;
	getBalanceSheet(
		symbol: string,
		period?: string,
	): Promise<FinancialStatement[]>;
	getCashFlow(symbol: string, period?: string): Promise<FinancialStatement[]>;
	getHistoricalPrices(
		symbol: string,
		from?: string,
		to?: string,
	): Promise<HistoricalPrice[]>;
	getStockScreener(
		marketCapMin?: number,
		exchange?: string,
		limit?: number,
	): Promise<StockScreenerResult[]>;
	getQuote(
		symbol: string,
	): Promise<{
		price: number;
		change: number;
		changePercent: number;
		volume: number;
	} | null>;
}
