import axios from "axios";
import { format, subMonths, subYears, parseISO } from "date-fns";

// MF API base URL - free JSON API for Indian mutual funds
const MF_API_BASE = "https://api.mfapi.in/mf";

export interface NAVData {
	date: string;
	nav: string;
}

export interface MutualFundInfo {
	meta: {
		scheme_code: string;
		scheme_name: string;
		scheme_category: string;
		scheme_type: string;
		fund_house: string;
	};
	data: NAVData[];
	status: string;
}

export interface CalculatedReturns {
	"1M": number | null;
	"6M": number | null;
	"1Y": number | null;
	"3Y": number | null;
	"5Y": number | null;
}

export interface FundPerformance {
	schemeCode: string;
	schemeName: string;
	fundHouse: string;
	category: string;
	currentNav: number;
	returns: CalculatedReturns;
	returnStrings: {
		"1M": string;
		"6M": string;
		"1Y": string;
		"3Y": string;
		"5Y": string;
	};
	lastUpdated: string;
}

class AMFIService {
	private cache: Map<string, { data: any; timestamp: number }> = new Map();
	private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours cache

	/**
	 * Get cached data or fetch if expired
	 */
	private async getCachedData(
		key: string,
		fetcher: () => Promise<any>,
	): Promise<any> {
		const cached = this.cache.get(key);
		const now = Date.now();

		if (cached && now - cached.timestamp < this.CACHE_TTL) {
			return cached.data;
		}

		try {
			const data = await fetcher();
			this.cache.set(key, { data, timestamp: now });
			return data;
		} catch (error) {
			// Return stale cache if available
			if (cached) {
				console.warn(`AMFI API failed, using stale cache for ${key}:`, error);
				return cached.data;
			}
			throw error;
		}
	}

	/**
	 * Fetch all available mutual fund scheme codes
	 */
	async getAllSchemeCodes(): Promise<string[]> {
		return this.getCachedData("all_schemes", async () => {
			const response = await axios.get(`${MF_API_BASE}`, { timeout: 10000 });
			return response.data.map((fund: any) => fund.schemeCode);
		});
	}

	/**
	 * Fetch mutual fund data with historical NAV
	 */
	async getMutualFundData(schemeCode: string): Promise<MutualFundInfo> {
		return this.getCachedData(`fund_${schemeCode}`, async () => {
			const response = await axios.get(`${MF_API_BASE}/${schemeCode}`, {
				timeout: 15000,
				headers: {
					"User-Agent":
						"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
				},
			});

			if (!response.data || !response.data.data) {
				throw new Error(`No data found for scheme code: ${schemeCode}`);
			}

			return response.data;
		});
	}

	/**
	 * Find NAV closest to target date
	 */
	private findNAVForDate(
		navData: NAVData[],
		targetDate: Date,
		maxDaysBack: number = 7,
	): NAVData | null {
		// Sort NAV data by date (most recent first)
		const sortedData = navData.sort(
			(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
		);

		const targetTime = targetDate.getTime();

		for (const nav of sortedData) {
			const navDate = new Date(nav.date);
			const daysDiff =
				Math.abs(targetTime - navDate.getTime()) / (1000 * 60 * 60 * 24);

			if (navDate <= targetDate && daysDiff <= maxDaysBack) {
				return nav;
			}
		}

		return null;
	}

	/**
	 * Calculate annualized return between two NAV values
	 */
	private calculateAnnualizedReturn(
		startNav: number,
		endNav: number,
		years: number,
	): number {
		if (years <= 0 || startNav <= 0) return 0;
		return ((endNav / startNav) ** (1 / years) - 1) * 100;
	}

	/**
	 * Calculate simple return for periods less than 1 year
	 */
	private calculateSimpleReturn(startNav: number, endNav: number): number {
		if (startNav <= 0) return 0;
		return ((endNav - startNav) / startNav) * 100;
	}

	/**
	 * Calculate all performance metrics for a mutual fund
	 */
	async calculateFundPerformance(
		schemeCode: string,
	): Promise<FundPerformance | null> {
		try {
			const fundData = await this.getMutualFundData(schemeCode);

			if (!fundData.data || fundData.data.length === 0) {
				console.warn(`No NAV data available for scheme: ${schemeCode}`);
				return null;
			}

			// Get current NAV (most recent)
			const currentNAV = fundData.data[0];
			const currentNav = Number.parseFloat(currentNAV.nav);

			// Calculate target dates
			const today = new Date();
			const oneMonthAgo = subMonths(today, 1);
			const sixMonthsAgo = subMonths(today, 6);
			const oneYearAgo = subYears(today, 1);
			const threeYearsAgo = subYears(today, 3);
			const fiveYearsAgo = subYears(today, 5);

			// Find NAV values for each target date
			const navOneMonth = this.findNAVForDate(fundData.data, oneMonthAgo);
			const navSixMonth = this.findNAVForDate(fundData.data, sixMonthsAgo);
			const navOneYear = this.findNAVForDate(fundData.data, oneYearAgo);
			const navThreeYear = this.findNAVForDate(
				fundData.data,
				threeYearsAgo,
				14,
			); // Allow 14 days back for longer periods
			const navFiveYear = this.findNAVForDate(fundData.data, fiveYearsAgo, 30); // Allow 30 days back for 5 year

			// Calculate returns
			const returns: CalculatedReturns = {
				"1M": navOneMonth
					? this.calculateSimpleReturn(
							Number.parseFloat(navOneMonth.nav),
							currentNav,
						)
					: null,
				"6M": navSixMonth
					? this.calculateSimpleReturn(
							Number.parseFloat(navSixMonth.nav),
							currentNav,
						)
					: null,
				"1Y": navOneYear
					? this.calculateAnnualizedReturn(
							Number.parseFloat(navOneYear.nav),
							currentNav,
							1,
						)
					: null,
				"3Y": navThreeYear
					? this.calculateAnnualizedReturn(
							Number.parseFloat(navThreeYear.nav),
							currentNav,
							3,
						)
					: null,
				"5Y": navFiveYear
					? this.calculateAnnualizedReturn(
							Number.parseFloat(navFiveYear.nav),
							currentNav,
							5,
						)
					: null,
			};

			// Format return strings
			const returnStrings = {
				"1M":
					returns["1M"] !== null
						? `${returns["1M"] >= 0 ? "+" : ""}${returns["1M"].toFixed(2)}%`
						: "N/A",
				"6M":
					returns["6M"] !== null
						? `${returns["6M"] >= 0 ? "+" : ""}${returns["6M"].toFixed(2)}%`
						: "N/A",
				"1Y":
					returns["1Y"] !== null
						? `${returns["1Y"] >= 0 ? "+" : ""}${returns["1Y"].toFixed(2)}%`
						: "N/A",
				"3Y":
					returns["3Y"] !== null
						? `${returns["3Y"] >= 0 ? "+" : ""}${returns["3Y"].toFixed(2)}%`
						: "N/A",
				"5Y":
					returns["5Y"] !== null
						? `${returns["5Y"] >= 0 ? "+" : ""}${returns["5Y"].toFixed(2)}%`
						: "N/A",
			};

			return {
				schemeCode,
				schemeName: fundData.meta.scheme_name,
				fundHouse: fundData.meta.fund_house,
				category: fundData.meta.scheme_category,
				currentNav: currentNav,
				returns,
				returnStrings,
				lastUpdated: currentNAV.date,
			};
		} catch (error) {
			console.error(
				`Error calculating performance for scheme ${schemeCode}:`,
				error,
			);
			return null;
		}
	}

	/**
	 * Get top performing funds from popular scheme codes
	 */
	async getPopularFundsWithPerformance(): Promise<FundPerformance[]> {
		// Popular scheme codes for different categories
		const popularSchemeCodes = [
			// Large Cap
			"119551", // SBI BlueChip Fund
			"120503", // ICICI Pru BlueChip Fund
			"120716", // Axis BlueChip Fund

			// Multi Cap / Flexi Cap
			"112316", // Parag Parikh Flexi Cap Fund
			"119591", // Kotak Flexicap Fund
			"120716", // Nippon India Multi Cap Fund

			// Mid Cap
			"104259", // DSP Midcap Fund
			"119598", // Kotak Emerging Equity Scheme
			"100127", // HDFC Mid-Cap Opportunities Fund

			// Small Cap
			"119552", // SBI Small Cap Fund
			"112675", // Nippon India Small Cap Fund
			"119836", // Kotak Small Cap Fund

			// ELSS (Tax Saving)
			"119074", // Axis Long Term Equity Fund
			"118834", // Mirae Asset Tax Saver Fund
			"120716", // DSP Tax Saver Fund
		];

		const results: FundPerformance[] = [];
		const batchSize = 5; // Process in batches to avoid overwhelming the API

		for (let i = 0; i < popularSchemeCodes.length; i += batchSize) {
			const batch = popularSchemeCodes.slice(i, i + batchSize);

			const batchPromises = batch.map(async (code) => {
				try {
					const performance = await this.calculateFundPerformance(code);
					return performance;
				} catch (error) {
					console.warn(`Failed to fetch data for scheme ${code}:`, error);
					return null;
				}
			});

			const batchResults = await Promise.allSettled(batchPromises);

			batchResults.forEach((result) => {
				if (result.status === "fulfilled" && result.value) {
					results.push(result.value);
				}
			});

			// Add a small delay between batches to be respectful to the API
			if (i + batchSize < popularSchemeCodes.length) {
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}
		}

		return results.sort(
			(a, b) => (b.returns["1Y"] || 0) - (a.returns["1Y"] || 0),
		);
	}

	/**
	 * Search funds by name or scheme code
	 */
	async searchFunds(query: string): Promise<FundPerformance[]> {
		try {
			// First get all schemes
			const schemeCodes = await this.getAllSchemeCodes();

			// For search, we'll limit to first 10 matches to avoid overloading
			const matchingSchemeCodes = schemeCodes.slice(0, 10);

			const searchPromises = matchingSchemeCodes.map(async (code) => {
				try {
					const fundData = await this.getMutualFundData(code);

					// Check if fund name matches search query
					if (
						fundData.meta.scheme_name
							.toLowerCase()
							.includes(query.toLowerCase()) ||
						fundData.meta.fund_house
							.toLowerCase()
							.includes(query.toLowerCase()) ||
						code === query
					) {
						return await this.calculateFundPerformance(code);
					}

					return null;
				} catch (error) {
					return null;
				}
			});

			const results = await Promise.allSettled(searchPromises);

			return results
				.filter(
					(result): result is PromiseFulfilledResult<FundPerformance> =>
						result.status === "fulfilled" && result.value !== null,
				)
				.map((result) => result.value)
				.slice(0, 20); // Limit search results
		} catch (error) {
			console.error("Error searching funds:", error);
			return [];
		}
	}

	/**
	 * Get fund categories with sample funds
	 */
	async getFundCategories(): Promise<
		Array<{
			name: string;
			description: string;
			riskLevel: string;
			funds: FundPerformance[];
		}>
	> {
		const categorizedFunds = await this.getPopularFundsWithPerformance();

		// Group funds by category
		const categories = new Map<string, FundPerformance[]>();

		categorizedFunds.forEach((fund) => {
			const category = this.normalizeCategoryName(fund.category);
			if (!categories.has(category)) {
				categories.set(category, []);
			}
			categories.get(category)!.push(fund);
		});

		// Convert to structured format
		const result: Array<{
			name: string;
			description: string;
			riskLevel: string;
			funds: FundPerformance[];
		}> = [];

		Array.from(categories.entries()).forEach(([categoryName, funds]) => {
			if (funds.length > 0) {
				result.push({
					name: categoryName,
					description: this.getCategoryDescription(categoryName),
					riskLevel: this.getCategoryRiskLevel(categoryName),
					funds: funds.slice(0, 5), // Limit to 5 funds per category
				});
			}
		});

		return result;
	}

	/**
	 * Normalize category names from AMFI data
	 */
	private normalizeCategoryName(category: string): string {
		const normalized = category.toLowerCase();

		if (normalized.includes("large cap") || normalized.includes("bluechip")) {
			return "Large Cap Funds";
		}
		if (normalized.includes("mid cap")) {
			return "Mid Cap Funds";
		}
		if (normalized.includes("small cap")) {
			return "Small Cap Funds";
		}
		if (normalized.includes("multi cap") || normalized.includes("flexi cap")) {
			return "Multi Cap Funds";
		}
		if (normalized.includes("elss") || normalized.includes("tax saver")) {
			return "ELSS Funds";
		}
		if (normalized.includes("debt") || normalized.includes("bond")) {
			return "Debt Funds";
		}
		if (normalized.includes("hybrid") || normalized.includes("balanced")) {
			return "Hybrid Funds";
		}

		return category;
	}

	/**
	 * Get category description
	 */
	private getCategoryDescription(categoryName: string): string {
		const descriptions: Record<string, string> = {
			"Large Cap Funds": "Invest in top 100 companies by market cap",
			"Mid Cap Funds": "Invest in companies ranked 101-250 by market cap",
			"Small Cap Funds":
				"Invest in companies ranked beyond 250th by market cap",
			"Multi Cap Funds":
				"Flexible allocation across large, mid & small cap stocks",
			"ELSS Funds": "Equity Linked Savings Scheme with tax benefits",
			"Debt Funds": "Invest in fixed income securities",
			"Hybrid Funds": "Balanced allocation between equity and debt",
		};

		return descriptions[categoryName] || "Diversified mutual fund scheme";
	}

	/**
	 * Get category risk level
	 */
	private getCategoryRiskLevel(categoryName: string): string {
		const riskLevels: Record<string, string> = {
			"Large Cap Funds": "Moderate",
			"Mid Cap Funds": "Moderate to High",
			"Small Cap Funds": "High",
			"Multi Cap Funds": "Moderate to High",
			"ELSS Funds": "Moderate to High",
			"Debt Funds": "Low to Moderate",
			"Hybrid Funds": "Moderate",
		};

		return riskLevels[categoryName] || "Moderate";
	}
}

// Singleton instance
export const amfiService = new AMFIService();
