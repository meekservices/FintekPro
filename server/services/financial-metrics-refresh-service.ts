/* eslint-disable no-console */
// @ts-nocheck
import { db } from "../db";
import * as schema from "@shared/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { financialMetricsCalculator } from "./financial-metrics-calculator";
import { fetchWithTimeout } from "../utils/fetch-with-timeout";
import { indianApiService } from "./indian-api-service";

interface CredHiveFinancialData {
	revenue?: number;
	ebitda?: number;
	pat?: number;
	eps?: number;
	book_value?: number;
	total_assets?: number;
	total_liabilities?: number;
	total_equity?: number;
	total_debt?: number;
	cash_and_equivalents?: number;
	operating_cash_flow?: number;
	free_cash_flow?: number;
	current_assets?: number;
	current_liabilities?: number;
	inventory?: number;
	receivables?: number;
	payables?: number;
	depreciation?: number;
	interest_expense?: number;
	gross_profit?: number;
	operating_income?: number;
	shares_outstanding?: number;
	dividend_per_share?: number;
	retained_earnings?: number;
}

export class FinancialMetricsRefreshService {
	private credhiveBaseUrl = "https://api.probe42.in/probe_data_api";
	private finnhubBaseUrl = "https://finnhub.io/api/v1";

	constructor() {
		console.log("✅ Financial Metrics Refresh Service initialized");
	}

	async refreshStockMetrics(stockId: string): Promise<boolean> {
		try {
			const stock = await db.query.listedStocks.findFirst({
				where: eq(schema.listedStocks.id, stockId),
			});

			if (!stock) {
				console.error(`[FinancialMetricsRefresh] Stock not found: ${stockId}`);
				return false;
			}

			console.log(
				`[FinancialMetricsRefresh] Refreshing metrics for ${stock.symbol}`,
			);

			// Fetch financial data from available sources
			const financialData = await this.fetchStockFinancials(stock);
			if (!financialData) {
				console.warn(
					`[FinancialMetricsRefresh] No financial data available for ${stock.symbol}`,
				);
				return false;
			}

			// Get historical data for CAGR calculations
			const historicalData = await this.getHistoricalMetrics(stockId, 5);

			// Calculate all metrics
			const metrics = financialMetricsCalculator.calculateAllMetrics(
				financialData,
				historicalData,
				financialData.epsEstimateNextYear,
			);

			// Get current fiscal year
			const now = new Date();
			const fiscalYear =
				now.getMonth() >= 3
					? `${now.getFullYear()}-${(now.getFullYear() + 1).toString().slice(-2)}`
					: `${now.getFullYear() - 1}-${now.getFullYear().toString().slice(-2)}`;

			// Upsert metrics
			await this.upsertStockMetrics(
				stockId,
				stock.symbol,
				stock.isin || "",
				fiscalYear,
				metrics,
			);

			console.log(
				`[FinancialMetricsRefresh] Successfully refreshed metrics for ${stock.symbol}`,
			);
			return true;
		} catch (error) {
			console.error(
				`[FinancialMetricsRefresh] Error refreshing metrics for ${stockId}:`,
				error,
				// Surface the underlying Postgres error (hidden behind Drizzle's "Failed query" wrapper)
				(error as any)?.cause ?? (error as any)?.original ?? '',
			);
			return false;
		}
	}

	private async fetchStockFinancials(stock: schema.ListedStock): Promise<any> {
		// ── Tier 1: IndianAPI (primary — NSE-native, licensed financial data) ─────
		const indianApiData = await this.fetchFromIndianAPI(stock);
		if (indianApiData) return indianApiData;

		// ── Tier 2: Screener.in (web — full ratios + P&L + B/S + C/F + CAGR) ────
		const screenerData = await this.fetchFromScreenerIn(stock);
		if (screenerData) return screenerData;

		// ── Tier 3: Yahoo Finance (global — income stmt + key stats + ratios) ────
		const yahooData = await this.fetchFromYahooFinance(stock);
		if (yahooData) return yahooData;

		// ── Tier 4: CredHive / Probe42 (unlisted companies fallback) ─────────────
		const credhiveData = await this.fetchFromCredhive(stock);
		if (credhiveData) return credhiveData;

		// ── Tier 5: Finnhub (global metrics fallback) ─────────────────────────────
		const finnhubData = await this.fetchFromFinnhub(stock.symbol);
		if (finnhubData) return finnhubData;

		// ── Tier 6: Basic data from the listed_stocks record itself ───────────────
		return {
			currentPrice: Number.parseFloat(stock.currentPrice?.toString() || "0"),
			marketCap: Number.parseFloat(stock.marketCapValue?.toString() || "0"),
			eps: Number.parseFloat(stock.eps?.toString() || "0"),
			bookValuePerShare: Number.parseFloat(stock.bookValue?.toString() || "0"),
			roe: Number.parseFloat(stock.roe?.toString() || "0") / 100,
			roce: Number.parseFloat(stock.roce?.toString() || "0") / 100,
			dividendYield: Number.parseFloat(stock.dividendYield?.toString() || "0") / 100,
			_source: "LISTED_STOCKS_BASIC",
		};
	}

	/**
	 * Fetch financial ratios and statements for an NSE-listed stock from IndianAPI.
	 *
	 * @purpose Primary data source for listed stock fundamentals — NSE-native,
	 *          SEBI-grade financial data including P&L, Balance Sheet, Cash Flow,
	 *          and key ratios (PE, PB, ROE, ROCE, D/E, dividend yield, etc.)
	 * @inputs  stock — ListedStock record (needs symbol for NSE lookup)
	 * @outputs FinancialData object compatible with financialMetricsCalculator, or null on failure
	 * @edge    Returns null if INDIAN_API_KEY not configured or API call fails — caller falls through to next tier
	 */
	private async fetchFromIndianAPI(stock: schema.ListedStock): Promise<any> {
		if (!indianApiService.isReady()) return null;

		const symbol = stock.symbol?.toUpperCase();
		if (!symbol) return null;

		try {
			// Fetch P&L, Balance Sheet, Cash Flow, and Ratios in parallel
			const [plRes, bsRes, cfRes, ratiosRes] = await Promise.all([
				indianApiService.getProfitLoss(symbol, 5).catch(() => null),
				indianApiService.getBalanceSheet(symbol, 5).catch(() => null),
				indianApiService.getCashFlow(symbol, 5).catch(() => null),
				indianApiService.getRatios(symbol).catch(() => null),
			]);

			const pl = plRes?.success && Array.isArray(plRes.data) && plRes.data.length > 0
				? plRes.data : null;
			const bs = bsRes?.success && Array.isArray(bsRes.data) && bsRes.data.length > 0
				? bsRes.data : null;
			const cf = cfRes?.success && Array.isArray(cfRes.data) && cfRes.data.length > 0
				? cfRes.data : null;
			const ratios = ratiosRes?.success && ratiosRes.data ? ratiosRes.data : null;

			// Require at least ratios or P&L to proceed
			if (!ratios && !pl) {
				console.warn(`[FinancialMetricsRefresh] IndianAPI returned no usable data for ${symbol}`);
				return null;
			}

			// Use most recent year (last entry from IndianAPI list)
			const latestPl = pl ? pl[pl.length - 1] : null;
			const prevPl   = pl && pl.length > 1 ? pl[pl.length - 2] : null;
			const latestBs = bs ? bs[bs.length - 1] : null;
			const latestCf = cf ? cf[cf.length - 1] : null;

			// Unit normalisation: IndianAPI returns values in Crores
			// financialMetricsCalculator expects raw numbers (treat as-is — Cr is fine for ratios)
			const toNum = (v: any) => (v != null && !Number.isNaN(Number(v)) ? Number(v) : 0);

			const revenue           = toNum(latestPl?.revenue);
			const ebitda            = toNum(latestPl?.ebitda);
			const netIncome         = toNum(latestPl?.pat);
			const eps               = toNum(latestPl?.eps) || toNum(stock.eps);
			const totalAssets       = toNum(latestBs?.total_assets);
			const totalLiabilities  = toNum(latestBs?.total_liabilities);
			const totalEquity       = toNum(latestBs?.networth);
			const totalDebt         = toNum(latestBs?.total_debt);
			const cash              = toNum(latestBs?.cash_and_bank);
			const currentAssets     = toNum(latestBs?.current_assets);
			const currentLiabilities = toNum(latestBs?.current_liabilities);
			const operatingCashFlow = toNum(latestCf?.operating_cash_flow);
			const freeCashFlow      = toNum(latestCf?.free_cash_flow) ||
				(operatingCashFlow - Math.abs(toNum(latestCf?.capex)));
			const currentPrice      = toNum(stock.currentPrice) || toNum(stock.lastVwap);
			const marketCap         = toNum(stock.marketCapValue);
			const bookValuePerShare = toNum(stock.bookValue);

			// Derived ratios — prefer IndianAPI ratios object, fall back to computed
			const roe = ratios?.roe != null
				? ratios.roe / 100
				: (totalEquity > 0 ? netIncome / totalEquity : toNum(stock.roe) / 100);
			const roce = ratios?.roce != null
				? ratios.roce / 100
				: toNum(stock.roce) / 100;
			const debtToEquity = ratios?.debt_equity != null
				? ratios.debt_equity
				: (totalEquity > 0 ? totalDebt / totalEquity : 0);
			const currentRatio = ratios?.current_ratio != null
				? ratios.current_ratio
				: (currentLiabilities > 0 ? currentAssets / currentLiabilities : 0);
			const quickRatio = ratios?.quick_ratio != null
				? ratios.quick_ratio
				: (currentLiabilities > 0 ? (currentAssets - toNum(latestBs?.inventory)) / currentLiabilities : 0);
			const interestCoverage = ratios?.interest_coverage != null
				? ratios.interest_coverage
				: 0;
			const pegRatio = ratios?.peg_ratio != null ? ratios.peg_ratio : null;
			const dividendYield = ratios?.dividend_yield != null
				? ratios.dividend_yield / 100
				: toNum(stock.dividendYield) / 100;

			// YoY revenue/earnings growth from P&L history
			const revenueGrowthYoy = prevPl?.revenue && prevPl.revenue > 0 && latestPl?.revenue
				? (latestPl.revenue - prevPl.revenue) / prevPl.revenue
				: null;
			const epsGrowthYoy = prevPl?.eps && Math.abs(prevPl.eps) > 0 && latestPl?.eps
				? (latestPl.eps - prevPl.eps) / Math.abs(prevPl.eps)
				: null;
			const netIncomeGrowthYoy = prevPl?.pat && Math.abs(prevPl.pat) > 0 && latestPl?.pat
				? (latestPl.pat - prevPl.pat) / Math.abs(prevPl.pat)
				: null;

			// Margins
			const grossMargin     = toNum(latestPl?.gross_profit) > 0 && revenue > 0
				? toNum(latestPl.gross_profit) / revenue : 0;
			const operatingMargin = latestPl?.operating_margin != null
				? toNum(latestPl.operating_margin) / 100
				: (revenue > 0 ? ebitda / revenue : 0);
			const netMargin = revenue > 0 ? netIncome / revenue : 0;
			const ebitdaMargin = revenue > 0 ? ebitda / revenue : 0;
			const fcfMargin = revenue > 0 ? freeCashFlow / revenue : 0;

			console.log(
				`[FinancialMetricsRefresh] IndianAPI data fetched for ${symbol}: ` +
				`rev=${revenue}Cr, PAT=${netIncome}Cr, ROE=${(roe * 100).toFixed(1)}%, ` +
				`PE=${ratios?.pe_ratio ?? "N/A"}, D/E=${debtToEquity.toFixed(2)}`
			);

			return {
				// Prices (from listed_stocks)
				currentPrice,
				marketCap,
				eps,
				bookValuePerShare,
				// Income statement
				revenue,
				ebitda,
				ebit: ebitda * 0.9, // approximation when ebit not available
				netIncome,
				// Balance sheet
				totalAssets,
				totalLiabilities,
				totalEquity,
				totalDebt,
				cash,
				currentAssets,
				currentLiabilities,
				// Cash flow
				operatingCashFlow,
				freeCashFlow,
				// Profitability ratios
				roe,
				roa: totalAssets > 0 ? netIncome / totalAssets : 0,
				roce,
				grossMargin,
				operatingMargin,
				netMargin,
				ebitdaMargin,
				fcfMargin,
				// Leverage/liquidity
				debtToEquity,
				currentRatio,
				quickRatio,
				interestCoverage,
				// Valuation
				peRatio: ratios?.pe_ratio ?? (eps > 0 ? currentPrice / eps : null),
				pbRatio: ratios?.pb_ratio ?? (bookValuePerShare > 0 ? currentPrice / bookValuePerShare : null),
				pegRatio,
				// Dividends
				dividendYield,
				// Growth (YoY)
				revenueGrowthYoy,
				epsGrowthYoy,
				netIncomeGrowthYoy,
				// Shares outstanding (derived from market cap / price)
				sharesOutstanding: currentPrice > 0 ? marketCap / currentPrice : 0,
				// Source metadata (GCR: every output must expose engine version)
				_source: "INDIAN_API",
				_fetchedAt: new Date().toISOString(),
			};
		} catch (err: any) {
			console.warn(
				`[FinancialMetricsRefresh] IndianAPI fetch failed for ${symbol}:`,
				err?.message?.slice(0, 200),
			);
			return null;
		}
	}

	/**
	 * Fetch financial ratios and statements for an NSE-listed stock from Screener.in.
	 *
	 * @purpose Tier-2 source — scrapes Screener.in for full fundamentals (P&L, B/S, C/F,
	 *          ratios, CAGR). Reuses the existing `fetchFromScreener` function from
	 *          dataService.ts so there is no duplicate scraping logic.
	 * @inputs  stock — ListedStock record (uses symbol for NSE lookup)
	 * @outputs FinancialData object or null if scrape fails / returns empty data
	 * @edge    Screener.in may rate-limit or block Cloud Run IPs; always wrapped in try/catch
	 */
	private async fetchFromScreenerIn(stock: schema.ListedStock): Promise<any> {
		const symbol = stock.symbol?.toUpperCase();
		if (!symbol) return null;

		try {
			const { fetchFromScreener } = await import("../modules/research/dataService");
			const sd = await fetchFromScreener(symbol);

			// Require at least ROE or revenue to be non-null — reject empty ScreenerData
			if (!sd || (sd.roe == null && sd.revenue == null && sd.pe == null)) return null;

			const toNum = (v: any, fallback = 0) =>
				v != null && !Number.isNaN(Number(v)) ? Number(v) : fallback;

			const currentPrice = toNum(sd.currentPrice) || toNum(stock.currentPrice) || toNum(stock.lastVwap);
			const marketCap    = toNum(sd.marketCapCr) * 1e7 || toNum(stock.marketCapValue); // Cr → raw

			console.log(
				`[FinancialMetricsRefresh] Screener.in data fetched for ${symbol}: ` +
				`rev=${sd.revenue}Cr, netInc=${sd.netIncome}Cr, ROE=${sd.roe != null ? (sd.roe * 100).toFixed(1) : "N/A"}%, ` +
				`PE=${sd.pe ?? "N/A"}, D/E=${sd.debtToEquity ?? "N/A"}, ` +
				`RevCAGR3Y=${sd.salesCagr3Y ?? "N/A"}%`
			);

			return {
				// Price / market data
				currentPrice,
				marketCap,
				eps: toNum(stock.eps),
				bookValuePerShare: toNum(sd.bookValue) || toNum(stock.bookValue),
				// Income statement (₹ Crore from Screener — treated as-is for ratios)
				revenue:           toNum(sd.revenue),
				ebitda:            sd.operatingMargin != null && sd.revenue != null
					? toNum(sd.revenue) * toNum(sd.operatingMargin) : 0,
				netIncome:         toNum(sd.netIncome),
				// Cash flow
				operatingCashFlow: toNum(sd.operatingCashFlow),
				freeCashFlow:      toNum(sd.freeCashFlow),
				// Profitability
				roe:               sd.roe,
				roa:               null, // not in ScreenerData
				roce:              sd.roce,
				grossMargin:       null,
				operatingMargin:   sd.operatingMargin,
				netMargin:         sd.revenue && sd.netIncome
					? toNum(sd.netIncome) / toNum(sd.revenue) : null,
				// Leverage / liquidity
				debtToEquity:      sd.debtToEquity,
				currentRatio:      null,
				quickRatio:        null,
				interestCoverage:  null,
				// Valuation
				peRatio:           sd.pe,
				pbRatio:           sd.pb,
				pegRatio:          null,
				dividendYield:     sd.dividendYield,
				// Growth
				revenueGrowthYoy:  sd.revenueGrowth,
				epsGrowthYoy:      sd.earningsGrowth,
				netIncomeGrowthYoy: sd.earningsGrowth,
				// CAGR (from Screener historical tables)
				revenueCagr3y:     sd.salesCagr3Y != null ? sd.salesCagr3Y / 100 : null,
				revenueCagr5y:     sd.salesCagr5Y != null ? sd.salesCagr5Y / 100 : null,
				patCagr3y:         sd.profitCagr3Y != null ? sd.profitCagr3Y / 100 : null,
				patCagr5y:         sd.profitCagr5Y != null ? sd.profitCagr5Y / 100 : null,
				// Shares / metadata
				sharesOutstanding: currentPrice > 0 ? marketCap / currentPrice : 0,
				_source: "SCREENER_IN",
				_fetchedAt: new Date().toISOString(),
			};
		} catch (err: any) {
			console.warn(
				`[FinancialMetricsRefresh] Screener.in fetch failed for ${symbol}:`,
				err?.message?.slice(0, 200),
			);
			return null;
		}
	}

	/**
	 * Fetch financial ratios and income statement from Yahoo Finance for an NSE stock.
	 *
	 * @purpose Tier-3 source — uses Yahoo Finance v10 quoteSummary API with modules
	 *          `financialData`, `defaultKeyStatistics`, `summaryDetail` to fetch
	 *          revenue, margins, D/E, EPS, market cap, dividend yield, beta, etc.
	 *          Uses `<SYMBOL>.NS` suffix for NSE-listed Indian stocks.
	 * @inputs  stock — ListedStock record (uses symbol + exchange for suffix resolution)
	 * @outputs FinancialData object or null if API call fails / no data
	 * @edge    Yahoo Finance blocks Cloud Run IPs intermittently; wrapped in try/catch.
	 *          Google Finance has no public API — not applicable.
	 */
	private async fetchFromYahooFinance(stock: schema.ListedStock): Promise<any> {
		const symbol = stock.symbol?.toUpperCase();
		if (!symbol) return null;

		// Resolve exchange suffix (.NS for NSE, .BO for BSE)
		const exchange = (stock.exchange ?? "NSE").toUpperCase();
		const suffix   = exchange === "BSE" ? ".BO" : ".NS";
		const ySym     = `${symbol}${suffix}`;

		try {
			// Yahoo Finance v10 quoteSummary — no auth needed, returns rich fundamentals
			const modules = "financialData,defaultKeyStatistics,summaryDetail,incomeStatementHistory";
			const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ySym)}?modules=${modules}`;
			const res = await fetchWithTimeout(url, {
				timeoutMs: 12_000,
				headers: {
					"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
					Accept: "application/json",
				},
			});

			if (!res.ok) {
				console.warn(`[FinancialMetricsRefresh] Yahoo Finance HTTP ${res.status} for ${ySym}`);
				return null;
			}

			const body = await res.json() as any;
			const result = body?.quoteSummary?.result?.[0];
			if (!result) return null;

			const fd  = result.financialData  ?? {};       // margins, revenue, ratios
			const ks  = result.defaultKeyStatistics ?? {}; // PE, PB, EPS, beta, etc.
			const sd  = result.summaryDetail  ?? {};       // dividend yield, market cap
			const is  = result.incomeStatementHistory?.incomeStatementHistory?.[0] ?? {};

			const pf  = (v: any) => (typeof v === "object" && v?.raw != null ? v.raw : v);
			const toN = (v: any) => {
				const n = Number(pf(v));
				return Number.isFinite(n) ? n : 0;
			};

			const revenue      = toN(fd.totalRevenue ?? is.totalRevenue);
			const netIncome    = toN(fd.netIncomeToCommon ?? is.netIncome);
			const grossProfit  = toN(is.grossProfit);
			const ebitda       = toN(fd.ebitda);
			const totalCash    = toN(fd.totalCash);
			const totalDebt    = toN(fd.totalDebt);
			const currentPrice = toN(fd.currentPrice) || toN(stock.currentPrice);
			const marketCap    = toN(sd.marketCap) || toN(stock.marketCapValue);
			const eps          = toN(ks.trailingEps) || toN(stock.eps);
			const bvps         = toN(ks.bookValue) || toN(stock.bookValue);

			// Require at minimum revenue or net income to be non-zero
			if (revenue === 0 && netIncome === 0 && eps === 0) return null;

			console.log(
				`[FinancialMetricsRefresh] Yahoo Finance data fetched for ${ySym}: ` +
				`rev=₹${(revenue / 1e7).toFixed(0)}Cr, PAT=₹${(netIncome / 1e7).toFixed(0)}Cr, ` +
				`PE=${toN(ks.trailingPE).toFixed(1)}, D/E=${toN(fd.debtToEquity).toFixed(2)}`
			);

			return {
				// Price / market
				currentPrice,
				marketCap,
				eps,
				bookValuePerShare: bvps,
				// Income statement (raw INR from Yahoo — divide by 1e7 for Cr)
				revenue,
				ebitda,
				netIncome,
				grossProfit,
				// Cash / debt
				cash:       totalCash,
				totalDebt,
				// Profitability
				roe:        toN(fd.returnOnEquity),
				roa:        toN(fd.returnOnAssets),
				roce:       null,
				grossMargin:     toN(fd.grossMargins),
				operatingMargin: toN(fd.operatingMargins),
				netMargin:       toN(fd.profitMargins),
				ebitdaMargin:    revenue > 0 ? ebitda / revenue : 0,
				// Leverage / liquidity
				debtToEquity:    toN(fd.debtToEquity) / 100, // Yahoo returns as %, e.g. 45.23
				currentRatio:    toN(fd.currentRatio),
				quickRatio:      toN(fd.quickRatio),
				// Valuation
				peRatio:         toN(ks.trailingPE) || toN(ks.forwardPE),
				pbRatio:         toN(ks.priceToBook),
				pegRatio:        toN(ks.pegRatio) || null,
				// Dividends
				dividendYield:   toN(sd.dividendYield),
				// Growth (Yahoo TTM revenue/earnings growth)
				revenueGrowthYoy:   toN(fd.revenueGrowth),
				epsGrowthYoy:       toN(fd.earningsGrowth),
				netIncomeGrowthYoy: toN(fd.earningsGrowth),
				// Misc
				beta:            toN(ks.beta),
				sharesOutstanding: toN(ks.sharesOutstanding) || (currentPrice > 0 ? marketCap / currentPrice : 0),
				epsEstimateNextYear: toN(ks.forwardEps),
				_source: "YAHOO_FINANCE",
				_fetchedAt: new Date().toISOString(),
			};
		} catch (err: any) {
			console.warn(
				`[FinancialMetricsRefresh] Yahoo Finance fetch failed for ${ySym}:`,
				err?.message?.slice(0, 200),
			);
			return null;
		}
	}

	private async fetchFromCredhive(stock: schema.ListedStock): Promise<any> {
		const apiKey = process.env.PROBE42_API_KEY;
		if (!apiKey) return null;

		try {
			// Fetch from company_financials table if available
			// NOTE: companyFinancials.companyId links to unlistedCompanies — listed stocks won't
			// have a match, so this will return null gracefully and fall through to Finnhub/basic.
			const companyFinancialsRecord = await db.query.companyFinancials?.findFirst({
				where: eq(schema.companyFinancials.companyId, stock.cin || ""),
				orderBy: [desc(schema.companyFinancials.financialYear)],
			});

			if (companyFinancialsRecord) {
				return {
					revenue: Number.parseFloat(
						companyFinancialsRecord.revenue?.toString() || "0",
					),
					ebitda: Number.parseFloat(
						companyFinancialsRecord.ebitda?.toString() || "0",
					),
					ebit:
						Number.parseFloat(companyFinancialsRecord.ebitda?.toString() || "0") *
						0.85,
					netIncome: Number.parseFloat(
						companyFinancialsRecord.pat?.toString() || "0",
					),
					totalAssets: Number.parseFloat(
						companyFinancialsRecord.totalAssets?.toString() || "0",
					),
					totalLiabilities: Number.parseFloat(
						companyFinancialsRecord.totalLiabilities?.toString() || "0",
					),
					totalEquity: Number.parseFloat(
						companyFinancialsRecord.networth?.toString() || "0",
					),
					totalDebt: Number.parseFloat(
						companyFinancialsRecord.totalDebt?.toString() || "0",
					),
					cash:
						Number.parseFloat(companyFinancialsRecord.reserves?.toString() || "0") *
						0.1,
					operatingCashFlow: Number.parseFloat(
						companyFinancialsRecord.operatingCashFlow?.toString() || "0",
					),
					currentPrice: Number.parseFloat(
						stock.currentPrice?.toString() || "0",
					),
					marketCap: Number.parseFloat(stock.marketCapValue?.toString() || "0"),
					eps: Number.parseFloat(stock.eps?.toString() || "0"),
					bookValuePerShare: Number.parseFloat(
						stock.bookValue?.toString() || "0",
					),
					sharesOutstanding:
						Number.parseFloat(stock.marketCapValue?.toString() || "0") /
						Number.parseFloat(stock.currentPrice?.toString() || "1"),
				};
			}

			return null;
		} catch (error) {
			console.warn(
				`[FinancialMetricsRefresh] CredHive fetch failed for ${stock.symbol}:`,
				error,
			);
			return null;
		}
	}

	private async fetchFromFinnhub(symbol: string): Promise<any> {
		const apiKey = process.env.FINNHUB_API_KEY;
		if (!apiKey) return null;

		try {
			const response = await fetchWithTimeout(
				`${this.finnhubBaseUrl}/stock/metric?symbol=${symbol}.NS&metric=all&token=${apiKey}`,
				{ timeoutMs: 15_000 },
			);

			if (!response.ok) return null;

			const data = await response.json();
			const metric = data.metric || {};

			return {
				currentPrice: metric["52WeekHigh"] || 0,
				marketCap: metric.marketCapitalization || 0,
				eps: metric.epsBasicExclExtraItemsAnnual || 0,
				bookValuePerShare: metric.bookValuePerShareAnnual || 0,
				revenue: metric.revenuePerShareAnnual || 0,
				netIncome: metric.netIncomePerShareAnnual || 0,
				roe: metric.roeTTM || 0,
				roa: metric.roaTTM || 0,
				currentRatio: metric.currentRatioQuarterly || 0,
				debtToEquity: metric.totalDebt2TotalEquityQuarterly || 0,
				grossMargin: metric.grossMarginAnnual || 0,
				operatingMargin: metric.operatingMarginAnnual || 0,
				netMargin: metric.netProfitMarginAnnual || 0,
				dividendYield: metric.dividendYieldIndicatedAnnual || 0,
				beta: metric.beta || 1,
				epsEstimateNextYear: metric.epsEstimateNextYear || 0,
			};
		} catch (error) {
			console.warn(
				`[FinancialMetricsRefresh] Finnhub fetch failed for ${symbol}:`,
				error,
			);
			return null;
		}
	}

	private async getHistoricalMetrics(
		stockId: string,
		years: number,
	): Promise<any[]> {
		try {
			const historicalRecords = await db
				.select()
				.from(schema.stockFinancialMetrics)
				.where(eq(schema.stockFinancialMetrics.stockId, stockId))
				.orderBy(desc(schema.stockFinancialMetrics.fiscalYear))
				.limit(years);

			return historicalRecords.map((record) => ({
				fiscalYear: record.fiscalYear,
				data: {
					revenue: Number.parseFloat(record.revenue?.toString() || "0"),
					ebitda: Number.parseFloat(record.ebitda?.toString() || "0"),
					ebit: Number.parseFloat(record.ebit?.toString() || "0"),
					netIncome: Number.parseFloat(record.netIncome?.toString() || "0"),
					eps: Number.parseFloat(record.eps?.toString() || "0"),
					bookValuePerShare: Number.parseFloat(
						record.bookValuePerShare?.toString() || "0",
					),
					freeCashFlow: Number.parseFloat(
						record.freeCashFlow?.toString() || "0",
					),
					operatingCashFlow: Number.parseFloat(
						record.operatingCashFlow?.toString() || "0",
					),
					totalAssets: Number.parseFloat(record.totalAssets?.toString() || "0"),
					totalEquity: Number.parseFloat(record.totalEquity?.toString() || "0"),
					totalDebt: Number.parseFloat(record.totalDebt?.toString() || "0"),
					grossProfit:
						Number.parseFloat(record.revenue?.toString() || "0") *
						Number.parseFloat(record.grossMargin?.toString() || "0"),
				},
			}));
		} catch (error) {
			console.warn(
				`[FinancialMetricsRefresh] Error fetching historical metrics:`,
				error,
			);
			return [];
		}
	}

	private async upsertStockMetrics(
		stockId: string,
		symbol: string,
		isin: string,
		fiscalYear: string,
		metrics: Partial<schema.InsertStockFinancialMetrics>,
	): Promise<void> {
		const existing = await db.query.stockFinancialMetrics.findFirst({
			where: and(
				eq(schema.stockFinancialMetrics.stockId, stockId),
				eq(schema.stockFinancialMetrics.fiscalYear, fiscalYear),
			),
		});

		if (existing) {
			await db
				.update(schema.stockFinancialMetrics)
				.set({
					...metrics,
					lastUpdated: new Date(),
				})
				.where(eq(schema.stockFinancialMetrics.id, existing.id));
		} else {
			await db.insert(schema.stockFinancialMetrics).values({
				stockId,
				symbol,
				isin,
				fiscalYear,
				...metrics,
				dataSource: (metrics as any).dataSource ?? "financial_metrics_refresh",
				dataQuality: "complete",
			});
		}
	}

	async refreshAllStockMetrics(
		batchSize: number = 50,
	): Promise<{ success: number; failed: number }> {
		const stocks = await db.select().from(schema.listedStocks).limit(batchSize);

		let success = 0;
		let failed = 0;

		for (const stock of stocks) {
			const result = await this.refreshStockMetrics(stock.id);
			if (result) success++;
			else failed++;

			// Rate limiting
			await new Promise((resolve) => setTimeout(resolve, 100));
		}

		console.log(
			`[FinancialMetricsRefresh] Batch complete: ${success} success, ${failed} failed`,
		);
		return { success, failed };
	}

	async getStockMetricsHistory(
		stockId: string,
		years?: number,
	): Promise<schema.StockFinancialMetrics[]> {
		let query = db
			.select()
			.from(schema.stockFinancialMetrics)
			.where(eq(schema.stockFinancialMetrics.stockId, stockId))
			.orderBy(desc(schema.stockFinancialMetrics.fiscalYear));

		if (years) {
			query = query.limit(years) as any;
		}

		return await query;
	}

	async getLatestStockMetrics(
		stockId: string,
	): Promise<schema.StockFinancialMetrics | null> {
		const result = await db.query.stockFinancialMetrics.findFirst({
			where: eq(schema.stockFinancialMetrics.stockId, stockId),
			orderBy: [desc(schema.stockFinancialMetrics.fiscalYear)],
		});
		return result || null;
	}

	async getMetricsBySymbol(
		symbol: string,
	): Promise<schema.StockFinancialMetrics[]> {
		return await db
			.select()
			.from(schema.stockFinancialMetrics)
			.where(eq(schema.stockFinancialMetrics.symbol, symbol))
			.orderBy(desc(schema.stockFinancialMetrics.fiscalYear));
	}

	async getMetricsTrend(
		stockId: string,
		metricNames: string[],
		years: number = 5,
	): Promise<Record<string, { year: string; value: number }[]>> {
		const metrics = await this.getStockMetricsHistory(stockId, years);

		const trends: Record<string, { year: string; value: number }[]> = {};

		for (const metricName of metricNames) {
			trends[metricName] = metrics
				.map((m) => ({
					year: m.fiscalYear,
					value: Number.parseFloat((m as any)[metricName]?.toString() || "0"),
				}))
				.reverse();
		}

		return trends;
	}

	async compareStocks(
		stockIds: string[],
		metricNames: string[],
	): Promise<Record<string, Record<string, number | null>>> {
		const comparison: Record<string, Record<string, number | null>> = {};

		for (const stockId of stockIds) {
			const latestMetrics = await this.getLatestStockMetrics(stockId);
			if (!latestMetrics) continue;

			comparison[stockId] = {};
			for (const metricName of metricNames) {
				const value = (latestMetrics as any)[metricName];
				comparison[stockId][metricName] = value
					? Number.parseFloat(value.toString())
					: null;
			}
		}

		return comparison;
	}

	async getSectorAverages(sector: string): Promise<Record<string, number>> {
		const stocks = await db
			.select()
			.from(schema.listedStocks)
			.where(eq(schema.listedStocks.broadSector, sector));

		if (stocks.length === 0) return {};

		const stockIds = stocks.map((s) => s.id);
		const metrics = await db
			.select()
			.from(schema.stockFinancialMetrics)
			.where(inArray(schema.stockFinancialMetrics.stockId, stockIds));

		const latestByStock = new Map<string, schema.StockFinancialMetrics>();
		for (const m of metrics) {
			const existing = latestByStock.get(m.stockId || "");
			if (!existing || m.fiscalYear > existing.fiscalYear) {
				latestByStock.set(m.stockId || "", m);
			}
		}

		const metricsToAverage = [
			"trailingPe",
			"priceToBook",
			"roe",
			"roce",
			"debtToEquity",
			"netMargin",
			"revenueGrowthYoy",
			"piotroskiFScore",
		];

		const averages: Record<string, number> = {};
		for (const metricName of metricsToAverage) {
			const values = Array.from(latestByStock.values())
				.map((m) =>
					Number.parseFloat((m as any)[metricName]?.toString() || "0"),
				)
				.filter((v) => v !== 0 && !Number.isNaN(v));

			if (values.length > 0) {
				averages[metricName] =
					values.reduce((a, b) => a + b, 0) / values.length;
			}
		}

		return averages;
	}
}

export const financialMetricsRefreshService =
	new FinancialMetricsRefreshService();
