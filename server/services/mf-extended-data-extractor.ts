/**
 * MF Extended Data Extractor Service
 *
 * Parses extendedData JSONB field and extracts structured fields:
 * - exitLoadPercent, exitLoadDays
 * - minLumpsumAmount, minSipAmount
 * - launchDate
 */

import { db } from "../db";
import {
	getProductionDb,
	hasProductionDb,
	requireProductionDb,
	getEnrichmentReadDb,
	getEnrichmentWriteDb,
} from "../db";
import { mutualFunds } from "@shared/schema";
import { sql, isNull, or, and } from "drizzle-orm";

interface ExtendedDataContent {
	exitLoad?: string;
	minInvestment?: number | string;
	minSipAmount?: number | string;
	launchDate?: string;
	fundManager?: string;
	currentNav?: number;
	navDate?: string;
	returns?: {
		"1y"?: number;
		"3y"?: number;
		"5y"?: number;
	};
	[key: string]: any;
}

interface ParsedExitLoad {
	percent: number | null;
	days: number | null;
}

interface ExtractionStats {
	totalFunds: number;
	withExtendedData: number;
	exitLoadExtracted: number;
	minLumpsumExtracted: number;
	minSipExtracted: number;
	launchDateExtracted: number;
	percentExtracted: number;
}

interface ExtractionProgress {
	status: "idle" | "running" | "completed" | "error";
	processedFunds: number;
	totalFunds: number;
	exitLoadUpdated: number;
	minAmountsUpdated: number;
	launchDateUpdated: number;
	currentStep: string;
	errors: string[];
}

let extractionProgress: ExtractionProgress = {
	status: "idle",
	processedFunds: 0,
	totalFunds: 0,
	exitLoadUpdated: 0,
	minAmountsUpdated: 0,
	launchDateUpdated: 0,
	currentStep: "",
	errors: [],
};

class MFExtendedDataExtractor {
	private static instance: MFExtendedDataExtractor;

	private constructor() {
		console.log("✅ MF Extended Data Extractor Service initialized");
	}

	static getInstance(): MFExtendedDataExtractor {
		if (!MFExtendedDataExtractor.instance) {
			MFExtendedDataExtractor.instance = new MFExtendedDataExtractor();
		}
		return MFExtendedDataExtractor.instance;
	}

	getProgress(): ExtractionProgress {
		return { ...extractionProgress };
	}

	resetProgress(): void {
		extractionProgress = {
			status: "idle",
			processedFunds: 0,
			totalFunds: 0,
			exitLoadUpdated: 0,
			minAmountsUpdated: 0,
			launchDateUpdated: 0,
			currentStep: "",
			errors: [],
		};
	}

	/**
	 * Parse exit load text into structured data
	 * Handles formats like:
	 * - "1% if redeemed within 1 year"
	 * - "0.5% within 30 days"
	 * - "Nil"
	 * - "1% for redemption within 365 days"
	 * - "Exit Load is 1% if redeemed within 1 Year"
	 * - "0.0070% for Day 1 to Day 6"
	 * - "1% up to 365 days"
	 * - "1% before 1 year"
	 */
	parseExitLoadText(text: string | null | undefined): ParsedExitLoad {
		if (!text) {
			return { percent: null, days: null };
		}

		const normalizedText = text.toLowerCase().trim();

		// Check for nil/none/zero patterns
		if (
			normalizedText === "nil" ||
			normalizedText === "none" ||
			normalizedText === "0" ||
			normalizedText === "0%" ||
			normalizedText === "no exit load" ||
			normalizedText === "n.a." ||
			normalizedText.includes("no exit load") ||
			normalizedText.includes("nil exit")
		) {
			return { percent: 0, days: 0 };
		}

		const result: ParsedExitLoad = { percent: null, days: null };

		// Pattern 1: Range format "X% for Day 1 to Day Y" or "X% from day 1 to day Y"
		const rangePattern = /(\d+\.?\d*)\s*%.*?day\s*(\d+)\s*to\s*day\s*(\d+)/i;
		const rangeMatch = normalizedText.match(rangePattern);
		if (rangeMatch) {
			result.percent = Number.parseFloat(rangeMatch[1]);
			result.days = Number.parseInt(rangeMatch[3]); // Use end of range
			return result;
		}

		// Pattern 2: "X% if redeemed/exit within/before/up to Y year(s)/month(s)/day(s)"
		const withinPattern =
			/(\d+\.?\d*)\s*%\s*(?:if\s+(?:redeemed|exit|withdrawn)\s+)?(?:within|before|up\s*to|for|upto)\s+(\d+)\s*(year|month|day|week)s?/i;
		const withinMatch = normalizedText.match(withinPattern);
		if (withinMatch) {
			result.percent = Number.parseFloat(withinMatch[1]);
			const timeValue = Number.parseInt(withinMatch[2]);
			const timeUnit = withinMatch[3].toLowerCase();

			switch (timeUnit) {
				case "year":
					result.days = timeValue * 365;
					break;
				case "month":
					result.days = timeValue * 30;
					break;
				case "week":
					result.days = timeValue * 7;
					break;
				case "day":
					result.days = timeValue;
					break;
			}
			return result;
		}

		// Pattern 3: "X% for redemption before Y days" or "X% before Y days"
		const beforeDaysPattern =
			/(\d+\.?\d*)\s*%.*?(?:before|up\s*to|upto|within)\s*(\d+)\s*days?/i;
		const beforeDaysMatch = normalizedText.match(beforeDaysPattern);
		if (beforeDaysMatch) {
			result.percent = Number.parseFloat(beforeDaysMatch[1]);
			result.days = Number.parseInt(beforeDaysMatch[2]);
			return result;
		}

		// Pattern 4: "X% within Y days" (simple format)
		const simpleDaysPattern = /(\d+\.?\d*)\s*%.*?(\d+)\s*days?/i;
		const simpleDaysMatch = normalizedText.match(simpleDaysPattern);
		if (simpleDaysMatch) {
			result.percent = Number.parseFloat(simpleDaysMatch[1]);
			result.days = Number.parseInt(simpleDaysMatch[2]);
			return result;
		}

		// Pattern 5: Just percentage with time context in text
		const percentPattern = /(\d+\.?\d*)\s*%/;
		const percentMatch = normalizedText.match(percentPattern);
		if (percentMatch) {
			result.percent = Number.parseFloat(percentMatch[1]);

			// Try to find time period from context
			if (/1\s*year|12\s*month|365\s*day/i.test(normalizedText)) {
				result.days = 365;
			} else if (/6\s*month|180\s*day/i.test(normalizedText)) {
				result.days = 180;
			} else if (/3\s*month|90\s*day/i.test(normalizedText)) {
				result.days = 90;
			} else if (/1\s*month|30\s*day/i.test(normalizedText)) {
				result.days = 30;
			} else if (/7\s*day|1\s*week/i.test(normalizedText)) {
				result.days = 7;
			} else if (/(\d+)\s*day/i.test(normalizedText)) {
				const dayMatch = normalizedText.match(/(\d+)\s*day/i);
				if (dayMatch) result.days = Number.parseInt(dayMatch[1]);
			}

			return result;
		}

		return result;
	}

	/**
	 * Parse amount strings like "5000", "5,000", "Rs. 5000", "₹5000", "₹5000/-"
	 * Handles: currency symbols, commas, trailing dashes, "per month/sip" suffixes
	 */
	parseAmount(value: number | string | null | undefined): number | null {
		if (value === null || value === undefined) return null;

		if (typeof value === "number") {
			return value > 0 ? value : null;
		}

		let strValue = value.toString().trim();

		// Remove common suffixes first
		strValue = strValue
			.replace(/\s*(per\s*(month|sip|annum|year|investment))/gi, "")
			.replace(/\s*(only|minimum|min)/gi, "")
			.replace(/\/-$/g, "") // Handle "₹5000/-"
			.replace(/-$/g, "");

		// Remove currency symbols, commas, spaces, and other non-numeric chars
		const cleaned = strValue
			.replace(/[₹$Rs.INR,\s]/gi, "")
			.replace(/[^\d.]/g, "") // Keep only digits and decimal point
			.trim();

		const parsed = Number.parseFloat(cleaned);
		return !Number.isNaN(parsed) && parsed > 0 ? parsed : null;
	}

	/**
	 * Parse date strings in various formats:
	 * - ISO: 2020-01-15
	 * - DD-MM-YYYY: 15-01-2020
	 * - DD/MM/YYYY: 15/01/2020
	 * - DD MMM YYYY: 15 Jan 2020
	 * - MMM DD, YYYY: Jan 15, 2020
	 */
	parseDate(dateStr: string | null | undefined): Date | null {
		if (!dateStr) return null;

		const trimmed = dateStr.trim();

		// Try ISO format first (YYYY-MM-DD)
		if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
			const date = new Date(trimmed);
			if (!Number.isNaN(date.getTime())) return date;
		}

		// DD-MM-YYYY format
		const dashMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
		if (dashMatch) {
			const [, day, month, year] = dashMatch;
			const date = new Date(
				`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`,
			);
			if (!Number.isNaN(date.getTime())) return date;
		}

		// DD/MM/YYYY format
		const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
		if (slashMatch) {
			const [, day, month, year] = slashMatch;
			const date = new Date(
				`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`,
			);
			if (!Number.isNaN(date.getTime())) return date;
		}

		// DD MMM YYYY format (e.g., "15 Jan 2020" or "15-Jan-2020")
		const monthNames: Record<string, string> = {
			jan: "01",
			feb: "02",
			mar: "03",
			apr: "04",
			may: "05",
			jun: "06",
			jul: "07",
			aug: "08",
			sep: "09",
			oct: "10",
			nov: "11",
			dec: "12",
		};

		const ddMmmYyyy = trimmed.match(
			/^(\d{1,2})[\s\-]*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s\-,]*(\d{4})$/i,
		);
		if (ddMmmYyyy) {
			const [, day, month, year] = ddMmmYyyy;
			const monthNum = monthNames[month.toLowerCase().substring(0, 3)];
			if (monthNum) {
				const date = new Date(`${year}-${monthNum}-${day.padStart(2, "0")}`);
				if (!Number.isNaN(date.getTime())) return date;
			}
		}

		// MMM DD, YYYY format (e.g., "Jan 15, 2020")
		const mmmDdYyyy = trimmed.match(
			/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s\-]*(\d{1,2})[\s,]*(\d{4})$/i,
		);
		if (mmmDdYyyy) {
			const [, month, day, year] = mmmDdYyyy;
			const monthNum = monthNames[month.toLowerCase().substring(0, 3)];
			if (monthNum) {
				const date = new Date(`${year}-${monthNum}-${day.padStart(2, "0")}`);
				if (!Number.isNaN(date.getTime())) return date;
			}
		}

		// Fallback: try native Date parsing
		try {
			const date = new Date(trimmed);
			if (
				!Number.isNaN(date.getTime()) &&
				date.getFullYear() > 1990 &&
				date.getFullYear() < 2100
			) {
				return date;
			}
		} catch {
			// Parsing failed
		}

		return null;
	}

	/**
	 * Extract data from extendedData JSONB for a single fund
	 */
	extractFromExtendedData(extendedData: ExtendedDataContent | null): {
		exitLoadPercent: number | null;
		exitLoadDays: number | null;
		minLumpsumAmount: number | null;
		minSipAmount: number | null;
		launchDate: Date | null;
	} {
		const result = {
			exitLoadPercent: null as number | null,
			exitLoadDays: null as number | null,
			minLumpsumAmount: null as number | null,
			minSipAmount: null as number | null,
			launchDate: null as Date | null,
		};

		if (!extendedData) return result;

		// Extract exit load
		const exitLoadParsed = this.parseExitLoadText(extendedData.exitLoad);
		result.exitLoadPercent = exitLoadParsed.percent;
		result.exitLoadDays = exitLoadParsed.days;

		// Extract min investment amounts
		result.minLumpsumAmount = this.parseAmount(extendedData.minInvestment);
		result.minSipAmount = this.parseAmount(extendedData.minSipAmount);

		// Extract launch date
		result.launchDate = this.parseDate(extendedData.launchDate);

		return result;
	}

	/**
	 * Get extraction statistics
	 */
	async getExtractionStats(): Promise<ExtractionStats> {
		const [stats] = await getEnrichmentReadDb(db)
			.select({
				total: sql<number>`COUNT(*)`,
				withExtended: sql<number>`COUNT(*) FILTER (WHERE ${mutualFunds.extendedData} IS NOT NULL)`,
				withExitLoad: sql<number>`COUNT(*) FILTER (WHERE ${mutualFunds.exitLoadPercent} IS NOT NULL)`,
				withMinLumpsum: sql<number>`COUNT(*) FILTER (WHERE ${mutualFunds.minLumpsumAmount} IS NOT NULL)`,
				withMinSip: sql<number>`COUNT(*) FILTER (WHERE ${mutualFunds.minSipAmount} IS NOT NULL)`,
				withLaunchDate: sql<number>`COUNT(*) FILTER (WHERE ${mutualFunds.launchDate} IS NOT NULL)`,
			})
			.from(mutualFunds);

		const total = Number(stats?.total || 0);
		const extracted = Math.min(
			Number(stats?.withExitLoad || 0),
			Number(stats?.withMinLumpsum || 0),
		);

		return {
			totalFunds: total,
			withExtendedData: Number(stats?.withExtended || 0),
			exitLoadExtracted: Number(stats?.withExitLoad || 0),
			minLumpsumExtracted: Number(stats?.withMinLumpsum || 0),
			minSipExtracted: Number(stats?.withMinSip || 0),
			launchDateExtracted: Number(stats?.withLaunchDate || 0),
			percentExtracted: total > 0 ? Math.round((extracted / total) * 100) : 0,
		};
	}

	/**
	 * Extract and update all funds with extendedData
	 */
	async extractAllFunds(
		options: {
			forceRefresh?: boolean;
			batchSize?: number;
		} = {},
	): Promise<{
		fundsProcessed: number;
		exitLoadUpdated: number;
		minAmountsUpdated: number;
		launchDateUpdated: number;
		errors: string[];
	}> {
		const { forceRefresh = false, batchSize = 500 } = options;

		if (!requireProductionDb("MFExtendedDataExtractor")) {
			return {
				fundsProcessed: 0,
				exitLoadUpdated: 0,
				minAmountsUpdated: 0,
				launchDateUpdated: 0,
				errors: [
					"PRODUCTION_DATABASE_URL not set. Enrichment runs on production only.",
				],
			};
		}

		if (extractionProgress.status === "running") {
			throw new Error("Extraction already in progress");
		}

		this.resetProgress();
		extractionProgress.status = "running";
		extractionProgress.currentStep = "Querying funds with extendedData...";

		const stats = {
			fundsProcessed: 0,
			exitLoadUpdated: 0,
			minAmountsUpdated: 0,
			launchDateUpdated: 0,
			errors: [] as string[],
		};

		try {
			// Query funds with extendedData that need extraction
			const whereConditions = forceRefresh
				? sql`${mutualFunds.extendedData} IS NOT NULL`
				: sql`${mutualFunds.extendedData} IS NOT NULL AND (
            ${mutualFunds.exitLoadPercent} IS NULL OR
            ${mutualFunds.minLumpsumAmount} IS NULL OR
            ${mutualFunds.minSipAmount} IS NULL OR
            ${mutualFunds.launchDate} IS NULL
          )`;

			const funds = await getEnrichmentReadDb(db)
				.select({
					id: mutualFunds.id,
					schemeCode: mutualFunds.schemeCode,
					extendedData: mutualFunds.extendedData,
					exitLoadPercent: mutualFunds.exitLoadPercent,
					minLumpsumAmount: mutualFunds.minLumpsumAmount,
					minSipAmount: mutualFunds.minSipAmount,
					launchDate: mutualFunds.launchDate,
				})
				.from(mutualFunds)
				.where(whereConditions);

			extractionProgress.totalFunds = funds.length;
			extractionProgress.currentStep = `Processing ${funds.length} funds...`;

			console.log(
				`[MFExtendedDataExtractor] Processing ${funds.length} funds with extendedData`,
			);

			// Process in batches
			for (let i = 0; i < funds.length; i += batchSize) {
				const batch = funds.slice(i, i + batchSize);
				extractionProgress.currentStep = `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(funds.length / batchSize)}...`;

				for (const fund of batch) {
					try {
						const extendedData =
							fund.extendedData as ExtendedDataContent | null;
						const extracted = this.extractFromExtendedData(extendedData);

						const updates: Record<string, any> = {};
						let hasUpdate = false;

						// Only update NULL fields unless forceRefresh
						if (
							(fund.exitLoadPercent === null || forceRefresh) &&
							extracted.exitLoadPercent !== null
						) {
							updates.exitLoadPercent = extracted.exitLoadPercent.toString();
							if (extracted.exitLoadDays !== null) {
								updates.exitLoadDays = extracted.exitLoadDays;
							}
							stats.exitLoadUpdated++;
							hasUpdate = true;
						}

						if (
							(fund.minLumpsumAmount === null || forceRefresh) &&
							extracted.minLumpsumAmount !== null
						) {
							updates.minLumpsumAmount = extracted.minLumpsumAmount.toString();
							stats.minAmountsUpdated++;
							hasUpdate = true;
						}

						if (
							(fund.minSipAmount === null || forceRefresh) &&
							extracted.minSipAmount !== null
						) {
							updates.minSipAmount = extracted.minSipAmount.toString();
							hasUpdate = true;
						}

						if (
							(fund.launchDate === null || forceRefresh) &&
							extracted.launchDate !== null
						) {
							updates.launchDate = extracted.launchDate;
							stats.launchDateUpdated++;
							hasUpdate = true;
						}

						if (hasUpdate) {
							updates.lastUpdated = new Date();
							await getEnrichmentWriteDb()
								.update(mutualFunds)
								.set(updates)
								.where(sql`${mutualFunds.id} = ${fund.id}`);
						}

						stats.fundsProcessed++;
						extractionProgress.processedFunds++;
						extractionProgress.exitLoadUpdated = stats.exitLoadUpdated;
						extractionProgress.minAmountsUpdated = stats.minAmountsUpdated;
						extractionProgress.launchDateUpdated = stats.launchDateUpdated;
					} catch (error: any) {
						stats.errors.push(`Fund ${fund.schemeCode}: ${error.message}`);
						extractionProgress.errors.push(
							`Fund ${fund.schemeCode}: ${error.message}`,
						);
					}
				}
			}

			extractionProgress.status = "completed";
			extractionProgress.currentStep = "Extraction completed";

			console.log(
				`[MFExtendedDataExtractor] Completed: ${stats.exitLoadUpdated} exit loads, ${stats.minAmountsUpdated} min amounts, ${stats.launchDateUpdated} launch dates`,
			);
		} catch (error: any) {
			extractionProgress.status = "error";
			extractionProgress.currentStep = `Error: ${error.message}`;
			stats.errors.push(error.message);
			console.error("[MFExtendedDataExtractor] Error:", error.message);
		}

		return stats;
	}
}

export const mfExtendedDataExtractor = MFExtendedDataExtractor.getInstance();
export default mfExtendedDataExtractor;
