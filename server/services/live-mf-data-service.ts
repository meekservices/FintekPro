// @ts-nocheck
import axios from "axios";
import { db } from "../db";
import { mutualFunds } from "@shared/schema";
import { eq, sql, desc } from "drizzle-orm";
import { mfApiHistoricalService } from "./mfapi-historical-service";

interface LiveNavData {
	schemeCode: string;
	schemeName: string;
	nav: number;
	date: string;
	fundHouse: string;
	schemeType: string;
	schemeCategory: string;
}

interface CachedData {
	data: Map<string, LiveNavData>;
	timestamp: number;
}

class LiveMFDataService {
	private navCache: CachedData | null = null;
	private readonly CACHE_TTL = 60 * 60 * 1000; // 1 hour
	private readonly AMFI_NAV_URL = "https://www.amfiindia.com/spages/NAVAll.txt";
	private isRefreshing = false;

	async getLiveNav(schemeCode: string): Promise<LiveNavData | null> {
		await this.ensureCacheValid();
		return this.navCache?.data.get(schemeCode) || null;
	}

	async getLiveNavBatch(
		schemeCodes: string[],
	): Promise<Map<string, LiveNavData>> {
		await this.ensureCacheValid();
		const result = new Map<string, LiveNavData>();

		for (const code of schemeCodes) {
			const data = this.navCache?.data.get(code);
			if (data) {
				result.set(code, data);
			}
		}

		return result;
	}

	/**
	 * Calculate accurate point-to-point returns using MFapi.in historical NAV data.
	 * This fetches actual NAV values from 1Y/3Y/5Y ago and calculates true CAGR.
	 */
	async calculateReturns(
		schemeCode: string,
	): Promise<{
		returns1y: number;
		returns3y: number;
		returns5y: number;
	} | null> {
		try {
			// Use MFapi.in for accurate historical returns calculation
			const historicalReturns =
				await mfApiHistoricalService.calculateReturns(schemeCode);

			if (historicalReturns) {
				return {
					returns1y: historicalReturns.returns1y,
					returns3y: historicalReturns.returns3y,
					returns5y: historicalReturns.returns5y,
				};
			}

			// Fallback to database values if MFapi.in fails
			console.warn(
				`[LiveMFData] MFapi.in failed for ${schemeCode}, falling back to database`,
			);
			return this.getDatabaseReturns(schemeCode);
		} catch (error) {
			console.error(`Error calculating returns for ${schemeCode}:`, error);
			return this.getDatabaseReturns(schemeCode);
		}
	}

	/**
	 * Get returns from database as fallback when MFapi.in is unavailable
	 */
	private async getDatabaseReturns(
		schemeCode: string,
	): Promise<{
		returns1y: number;
		returns3y: number;
		returns5y: number;
	} | null> {
		try {
			const fund = await db
				.select({
					returns1y: mutualFunds.returns1y,
					returns3y: mutualFunds.returns3y,
					returns5y: mutualFunds.returns5y,
				})
				.from(mutualFunds)
				.where(eq(mutualFunds.schemeCode, schemeCode))
				.limit(1);

			if (fund.length > 0) {
				return {
					returns1y: Number.parseFloat(fund[0].returns1y || "0"),
					returns3y: Number.parseFloat(fund[0].returns3y || "0"),
					returns5y: Number.parseFloat(fund[0].returns5y || "0"),
				};
			}

			return null;
		} catch (error) {
			console.error(
				`Error fetching database returns for ${schemeCode}:`,
				error,
			);
			return null;
		}
	}

	private async ensureCacheValid(): Promise<void> {
		const now = Date.now();

		if (this.navCache && now - this.navCache.timestamp < this.CACHE_TTL) {
			return;
		}

		if (this.isRefreshing) {
			await this.waitForRefresh();
			return;
		}

		await this.refreshCache();
	}

	private async waitForRefresh(): Promise<void> {
		const maxWait = 30000;
		const checkInterval = 500;
		let waited = 0;

		while (this.isRefreshing && waited < maxWait) {
			await new Promise((resolve) => setTimeout(resolve, checkInterval));
			waited += checkInterval;
		}
	}

	async refreshCache(maxRetries: number = 3): Promise<boolean> {
		if (this.isRefreshing) {
			console.log("[LiveMFData] Refresh already in progress, waiting...");
			await this.waitForRefresh();
			return !!this.navCache?.data?.size;
		}

		this.isRefreshing = true;
		console.log("[LiveMFData] Refreshing NAV cache from AMFI...");

		let lastError: Error | null = null;

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				const response = await axios.get(this.AMFI_NAV_URL, {
					timeout: 90000, // 90 second timeout for large file
					headers: {
						"User-Agent": "FintekPro/1.0",
						Accept: "text/plain",
					},
				});

				const navData = this.parseAmfiData(response.data);

				if (navData.size < 1000) {
					console.warn(
						`[LiveMFData] Suspicious data - only ${navData.size} funds parsed. Retrying...`,
					);
					lastError = new Error("Insufficient data parsed");
					continue;
				}

				this.navCache = {
					data: navData,
					timestamp: Date.now(),
				};

				console.log(
					`[LiveMFData] Cache refreshed with ${navData.size} funds (attempt ${attempt})`,
				);
				this.isRefreshing = false;
				return true;
			} catch (error: any) {
				lastError = error;
				console.error(
					`[LiveMFData] Refresh attempt ${attempt} failed:`,
					error.message,
				);

				if (attempt < maxRetries) {
					// Exponential backoff: 2s, 4s, 8s
					const delay = 2 ** attempt * 1000;
					console.log(`[LiveMFData] Retrying in ${delay / 1000}s...`);
					await new Promise((resolve) => setTimeout(resolve, delay));
				}
			}
		}

		console.error(
			"[LiveMFData] All refresh attempts failed:",
			lastError?.message,
		);
		this.isRefreshing = false;
		return false;
	}

	private parseAmfiData(rawData: string): Map<string, LiveNavData> {
		const navMap = new Map<string, LiveNavData>();
		const lines = rawData.split("\n");

		let currentFundHouse = "";
		let currentSchemeType = "";
		let currentCategory = "";

		for (const line of lines) {
			const trimmedLine = line.trim();

			if (!trimmedLine) continue;

			if (!trimmedLine.includes(";")) {
				if (trimmedLine.includes("Mutual Fund")) {
					currentFundHouse = trimmedLine;
				} else if (
					trimmedLine.includes("Open Ended") ||
					trimmedLine.includes("Close Ended") ||
					trimmedLine.includes("Interval Fund")
				) {
					currentSchemeType = trimmedLine;
				} else if (trimmedLine.length > 3 && !trimmedLine.match(/^\d/)) {
					currentCategory = trimmedLine;
				}
				continue;
			}

			const parts = trimmedLine.split(";");
			if (parts.length >= 5) {
				const schemeCode = parts[0].trim();
				const schemeName = parts[1].trim();
				const navStr = parts[4].trim();
				const dateStr = parts[5]?.trim() || "";

				const nav = Number.parseFloat(navStr);

				if (schemeCode && schemeName && !Number.isNaN(nav) && nav > 0) {
					navMap.set(schemeCode, {
						schemeCode,
						schemeName,
						nav,
						date: dateStr,
						fundHouse: currentFundHouse,
						schemeType: currentSchemeType,
						schemeCategory: currentCategory,
					});
				}
			}
		}

		return navMap;
	}

	async updateDatabaseWithLiveData(
		schemeCodes?: string[],
		batchSize: number = 100,
	): Promise<{ updated: number; failed: number }> {
		await this.ensureCacheValid();

		let updated = 0;
		let failed = 0;

		// If no specific codes provided, only update funds that exist in our database (not all 13k)
		let codesToUpdate: string[];

		if (schemeCodes) {
			codesToUpdate = schemeCodes;
		} else {
			// Get only funds that exist in database to avoid updating non-existent records
			const existingFunds = await db
				.select({ schemeCode: mutualFunds.schemeCode })
				.from(mutualFunds)
				.limit(5000); // Cap at 5000 for performance

			codesToUpdate = existingFunds
				.map((f) => f.schemeCode)
				.filter((code) => this.navCache?.data.has(code));
		}

		console.log(
			`[LiveMFData] Updating ${codesToUpdate.length} funds in database (batch size: ${batchSize})...`,
		);

		// Process in batches to avoid overwhelming the database
		for (let i = 0; i < codesToUpdate.length; i += batchSize) {
			const batch = codesToUpdate.slice(i, i + batchSize);

			await Promise.all(
				batch.map(async (schemeCode) => {
					try {
						const liveData = this.navCache?.data.get(schemeCode);
						if (!liveData) return;

						// Only update NAV - skip returns calculation during batch sync for performance
						await db
							.update(mutualFunds)
							.set({
								nav: liveData.nav.toString(),
							})
							.where(eq(mutualFunds.schemeCode, schemeCode));

						updated++;
					} catch (error) {
						failed++;
					}
				}),
			);

			// Small delay between batches to avoid overwhelming the database
			if (i + batchSize < codesToUpdate.length) {
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
		}

		console.log(
			`[LiveMFData] Database update complete: ${updated} updated, ${failed} failed`,
		);
		return { updated, failed };
	}

	async syncNewFundsFromAmfi(): Promise<number> {
		await this.ensureCacheValid();

		if (!this.navCache) return 0;

		const existingFunds = await db
			.select({ schemeCode: mutualFunds.schemeCode })
			.from(mutualFunds);

		const existingCodes = new Set(existingFunds.map((f) => f.schemeCode));
		let added = 0;

		for (const [schemeCode, data] of this.navCache.data) {
			if (!existingCodes.has(schemeCode)) {
				try {
					await db.insert(mutualFunds).values({
						schemeCode: data.schemeCode,
						schemeName: data.schemeName,
						nav: data.nav.toString(),
						fundHouse: data.fundHouse || "Unknown",
						category: data.schemeCategory || "Other",
						subCategory: data.schemeType || "",
						isActive: true,
					});
					added++;
				} catch (error) {
					// Ignore duplicate errors
				}
			}
		}

		console.log(`[LiveMFData] Added ${added} new funds from AMFI`);
		return added;
	}

	getCacheStats(): { size: number; age: number; isValid: boolean } {
		const now = Date.now();
		return {
			size: this.navCache?.data.size || 0,
			age: this.navCache
				? Math.round((now - this.navCache.timestamp) / 1000)
				: -1,
			isValid: this.navCache
				? now - this.navCache.timestamp < this.CACHE_TTL
				: false,
		};
	}

	async getEnhancedFundData(schemeCode: string): Promise<{
		liveNav: number | null;
		returns: { returns1y: number; returns3y: number; returns5y: number } | null;
		lastUpdated: string;
		isLive: boolean;
	}> {
		const liveData = await this.getLiveNav(schemeCode);
		const returns = await this.calculateReturns(schemeCode);

		return {
			liveNav: liveData?.nav || null,
			returns,
			lastUpdated: liveData?.date || new Date().toISOString().split("T")[0],
			isLive: !!liveData,
		};
	}

	async getFundByIsin(isin: string): Promise<{
		schemeCode: string;
		schemeName: string;
		fundHouse: string;
		category: string;
		nav: number;
		planType: string;
	} | null> {
		try {
			const fund = await db
				.select({
					schemeCode: mutualFunds.schemeCode,
					schemeName: mutualFunds.schemeName,
					fundHouse: mutualFunds.fundHouse,
					category: mutualFunds.category,
					nav: mutualFunds.nav,
					planType: mutualFunds.planType,
					extendedData: mutualFunds.extendedData,
				})
				.from(mutualFunds)
				.where(sql`${mutualFunds.extendedData}->>'isin' = ${isin}`)
				.limit(1);

			if (fund.length > 0) {
				return {
					schemeCode: fund[0].schemeCode,
					schemeName: fund[0].schemeName,
					fundHouse: fund[0].fundHouse || "",
					category: fund[0].category || "",
					nav: Number.parseFloat(fund[0].nav || "0"),
					planType: fund[0].planType || "Regular",
				};
			}
			return null;
		} catch (error) {
			console.error(`[LiveMFData] Error fetching fund by ISIN ${isin}:`, error);
			return null;
		}
	}

	async getFundsByIsinBatch(isins: string[]): Promise<
		Map<
			string,
			{
				schemeCode: string;
				schemeName: string;
				fundHouse: string;
				category: string;
				nav: number;
				planType: string;
			}
		>
	> {
		const result = new Map();

		if (isins.length === 0) return result;

		try {
			const funds = await db
				.select({
					schemeCode: mutualFunds.schemeCode,
					schemeName: mutualFunds.schemeName,
					fundHouse: mutualFunds.fundHouse,
					category: mutualFunds.category,
					nav: mutualFunds.nav,
					planType: mutualFunds.planType,
					extendedData: mutualFunds.extendedData,
				})
				.from(mutualFunds)
				.where(
					sql`${mutualFunds.extendedData}->>'isin' IN (${sql.join(
						isins.map((i) => sql`${i}`),
						sql`, `,
					)})`,
				);

			for (const fund of funds) {
				const isin = (fund.extendedData as any)?.isin;
				if (isin) {
					result.set(isin, {
						schemeCode: fund.schemeCode,
						schemeName: fund.schemeName,
						fundHouse: fund.fundHouse || "",
						category: fund.category || "",
						nav: Number.parseFloat(fund.nav || "0"),
						planType: fund.planType || "Regular",
					});
				}
			}
		} catch (error) {
			console.error(`[LiveMFData] Error fetching funds by ISIN batch:`, error);
		}

		return result;
	}

	async searchFunds(
		query: string,
		limit: number = 20,
	): Promise<
		Array<{
			schemeCode: string;
			schemeName: string;
			fundHouse: string;
			category: string;
			nav: number;
			planType: string;
			isin: string;
		}>
	> {
		try {
			if (!query || query.length < 2) return [];

			const searchPattern = `%${query.toLowerCase()}%`;

			const funds = await db
				.select({
					schemeCode: mutualFunds.schemeCode,
					schemeName: mutualFunds.schemeName,
					fundHouse: mutualFunds.fundHouse,
					category: mutualFunds.category,
					nav: mutualFunds.nav,
					planType: mutualFunds.planType,
					extendedData: mutualFunds.extendedData,
				})
				.from(mutualFunds)
				.where(sql`LOWER(${mutualFunds.schemeName}) LIKE ${searchPattern}`)
				.limit(limit);

			return funds.map((fund) => ({
				schemeCode: fund.schemeCode,
				schemeName: fund.schemeName,
				fundHouse: fund.fundHouse || "",
				category: fund.category || "",
				nav: Number.parseFloat(fund.nav || "0"),
				planType: fund.planType || "Regular",
				isin: (fund.extendedData as any)?.isin || "",
			}));
		} catch (error) {
			console.error(`[LiveMFData] Error searching funds:`, error);
			return [];
		}
	}
}

export const liveMFDataService = new LiveMFDataService();
