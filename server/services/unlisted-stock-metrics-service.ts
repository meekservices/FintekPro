/**
 * Unlisted Stock Metrics Service
 *
 * Calculates and refreshes financial ratios for all unlisted companies
 * using real MCA financial data and proper regulatory-compliant formulas.
 *
 * Formulas (SEBI/RBI compliant):
 * - ROE = Net Profit / Networth × 100
 * - ROA = Net Profit / Total Assets × 100
 * - ROCE = EBIT / Capital Employed × 100 (Capital Employed = Networth + Long-term Debt)
 * - P/E = Current Price / EPS (EPS = Net Profit / Shares Outstanding)
 * - P/B = Current Price / Book Value per Share (BVPS = Networth / Shares Outstanding)
 * - Debt/Equity = Total Debt / Networth
 * - PAT Margin = Net Profit / Revenue × 100
 * - EBITDA Margin = EBITDA / Revenue × 100
 *
 * Data Sources:
 * - MCA financial data (via CredHive API)
 * - Current trading prices from unlisted marketplace
 */

import { db } from "../db";
import {
	unlistedCompanies,
	companyFinancials,
	companyRatios,
} from "@shared/schema";
import { eq, desc, and, sql, isNotNull } from "drizzle-orm";

interface UnlistedMetricsResult {
	companyId: string;
	companyName: string;
	financialYear: string;
	roe: number | null;
	roa: number | null;
	roce: number | null;
	peRatio: number | null;
	pbRatio: number | null;
	debtEquity: number | null;
	marginPat: number | null;
	marginEbitda: number | null;
	eps: number | null;
	bookValuePerShare: number | null;
	dataSource: string;
}

interface BatchRefreshResult {
	totalCompanies: number;
	successfulUpdates: number;
	failedUpdates: number;
	skippedNoFinancials: number;
	errors: string[];
	refreshedAt: Date;
}

interface AuditLogEntry {
	companyId: string;
	companyName: string;
	ratios: Partial<UnlistedMetricsResult>;
	formula: string;
	dataSource: string;
	calculatedAt: Date;
}

class UnlistedStockMetricsService {
	private auditLog: AuditLogEntry[] = [];

	/**
	 * Calculate all financial ratios for a single unlisted company
	 */
	async calculateMetricsForCompany(
		companyId: string,
	): Promise<UnlistedMetricsResult | null> {
		try {
			const [company] = await db
				.select()
				.from(unlistedCompanies)
				.where(eq(unlistedCompanies.id, companyId))
				.limit(1);

			if (!company) {
				console.log(`[UnlistedMetrics] Company not found: ${companyId}`);
				return null;
			}

			const [latestFinancial] = await db
				.select()
				.from(companyFinancials)
				.where(eq(companyFinancials.companyId, companyId))
				.orderBy(desc(companyFinancials.financialYear))
				.limit(1);

			if (!latestFinancial) {
				console.log(`[UnlistedMetrics] No financial data for: ${company.name}`);
				return null;
			}

			const netProfit = Number.parseFloat(
				latestFinancial.netProfit || latestFinancial.pat || "0",
			);
			const networth = Number.parseFloat(latestFinancial.networth || "0");
			const totalDebt = Number.parseFloat(latestFinancial.totalDebt || "0");
			const totalAssets = Number.parseFloat(latestFinancial.totalAssets || "0");
			const revenue = Number.parseFloat(latestFinancial.revenue || "0");
			const ebitda = Number.parseFloat(latestFinancial.ebitda || "0");
			const pbt = Number.parseFloat(latestFinancial.pbt || "0");
			const longTermDebt = Number.parseFloat(
				latestFinancial.longTermDebt || "0",
			);
			const shareCapital = Number.parseFloat(
				latestFinancial.shareCapital || company.paidUpCapital || "0",
			);

			const currentPrice = Number.parseFloat(company.currentPrice || "0");
			const faceValue = Number.parseFloat(company.faceValue || "10");

			const sharesOutstanding = faceValue > 0 ? shareCapital / faceValue : 0;

			const roe = networth > 0 ? (netProfit / networth) * 100 : null;
			const roa = totalAssets > 0 ? (netProfit / totalAssets) * 100 : null;

			const capitalEmployed = networth + longTermDebt;
			const ebit = ebitda || pbt;
			const roce =
				capitalEmployed > 0 && ebit > 0 ? (ebit / capitalEmployed) * 100 : null;

			const marginPat = revenue > 0 ? (netProfit / revenue) * 100 : null;
			const marginEbitda =
				revenue > 0 && ebitda > 0 ? (ebitda / revenue) * 100 : null;

			const eps = sharesOutstanding > 0 ? netProfit / sharesOutstanding : null;
			const peRatio =
				eps && eps > 0 && currentPrice > 0 ? currentPrice / eps : null;

			const bookValuePerShare =
				sharesOutstanding > 0 ? networth / sharesOutstanding : null;
			const pbRatio =
				bookValuePerShare && bookValuePerShare > 0 && currentPrice > 0
					? currentPrice / bookValuePerShare
					: null;

			const debtEquity = networth > 0 ? totalDebt / networth : null;

			const result: UnlistedMetricsResult = {
				companyId,
				companyName: company.name,
				financialYear: latestFinancial.financialYear || "Unknown",
				roe,
				roa,
				roce,
				peRatio,
				pbRatio,
				debtEquity,
				marginPat,
				marginEbitda,
				eps,
				bookValuePerShare,
				dataSource: "mca_financials",
			};

			this.auditLog.push({
				companyId,
				companyName: company.name,
				ratios: result,
				formula:
					"ROE=PAT/Networth, ROCE=EBIT/CE, P/E=Price/EPS, P/B=Price/BVPS",
				dataSource: "mca_financials",
				calculatedAt: new Date(),
			});

			return result;
		} catch (error: any) {
			console.error(
				`[UnlistedMetrics] Error calculating for ${companyId}:`,
				error.message,
			);
			return null;
		}
	}

	/**
	 * Update ratios for a single company in the database
	 */
	async updateCompanyRatios(companyId: string): Promise<boolean> {
		try {
			const metrics = await this.calculateMetricsForCompany(companyId);

			if (!metrics) {
				return false;
			}

			const [existingRatios] = await db
				.select()
				.from(companyRatios)
				.where(
					and(
						eq(companyRatios.companyId, companyId),
						eq(companyRatios.financialYear, metrics.financialYear),
					),
				)
				.limit(1);

			const ratiosData: any = {
				companyId,
				financialYear: metrics.financialYear,
				roe: metrics.roe?.toFixed(2) || null,
				roa: metrics.roa?.toFixed(2) || null,
				roce: metrics.roce?.toFixed(2) || null,
				peRatio: metrics.peRatio?.toFixed(2) || null,
				pbRatio: metrics.pbRatio?.toFixed(2) || null,
				debtEquity: metrics.debtEquity?.toFixed(2) || null,
				marginPat: metrics.marginPat?.toFixed(2) || null,
				marginEbitda: metrics.marginEbitda?.toFixed(2) || null,
				dataSource: "calculated_mca",
				updatedAt: new Date(),
			};

			if (existingRatios) {
				await db
					.update(companyRatios)
					.set(ratiosData)
					.where(eq(companyRatios.id, existingRatios.id));
			} else {
				await db.insert(companyRatios).values(ratiosData);
			}

			console.log(
				`[UnlistedMetrics] Updated ${metrics.companyName}: ROE=${metrics.roe?.toFixed(2)}%, P/E=${metrics.peRatio?.toFixed(2) || "N/A"}`,
			);
			return true;
		} catch (error: any) {
			console.error(
				`[UnlistedMetrics] Failed to update ${companyId}:`,
				error.message,
			);
			return false;
		}
	}

	/**
	 * Batch refresh ratios for all unlisted companies with financial data
	 */
	async batchRefreshAllRatios(): Promise<BatchRefreshResult> {
		console.log(
			"[UnlistedMetrics] Starting batch refresh of all unlisted company ratios...",
		);

		const startTime = Date.now();
		const result: BatchRefreshResult = {
			totalCompanies: 0,
			successfulUpdates: 0,
			failedUpdates: 0,
			skippedNoFinancials: 0,
			errors: [],
			refreshedAt: new Date(),
		};

		try {
			const companies = await db
				.select({
					id: unlistedCompanies.id,
					name: unlistedCompanies.name,
				})
				.from(unlistedCompanies)
				.where(eq(unlistedCompanies.status, "active"));

			result.totalCompanies = companies.length;
			console.log(
				`[UnlistedMetrics] Found ${companies.length} active unlisted companies`,
			);

			for (const company of companies) {
				const hasFinancials = await db
					.select({ id: companyFinancials.id })
					.from(companyFinancials)
					.where(eq(companyFinancials.companyId, company.id))
					.limit(1);

				if (hasFinancials.length === 0) {
					result.skippedNoFinancials++;
					continue;
				}

				const success = await this.updateCompanyRatios(company.id);

				if (success) {
					result.successfulUpdates++;
				} else {
					result.failedUpdates++;
					result.errors.push(`Failed to update: ${company.name}`);
				}

				await new Promise((resolve) => setTimeout(resolve, 50));
			}

			const duration = Date.now() - startTime;
			console.log(`[UnlistedMetrics] Batch refresh completed in ${duration}ms`);
			console.log(`  - Successful: ${result.successfulUpdates}`);
			console.log(`  - Failed: ${result.failedUpdates}`);
			console.log(`  - Skipped (no financials): ${result.skippedNoFinancials}`);

			await this.persistRefreshLog(result);
		} catch (error: any) {
			console.error("[UnlistedMetrics] Batch refresh failed:", error.message);
			result.errors.push(error.message);
		}

		return result;
	}

	/**
	 * Persist refresh log to database for audit trail
	 */
	private async persistRefreshLog(result: BatchRefreshResult): Promise<void> {
		try {
			await db.execute(sql`
        INSERT INTO financial_metrics_refresh_log (
          job_type, started_at, completed_at, 
          total_processed, successful_updates, failed_updates,
          status, error_message
        ) VALUES (
          'unlisted_stocks',
          ${result.refreshedAt},
          NOW(),
          ${result.totalCompanies},
          ${result.successfulUpdates},
          ${result.failedUpdates},
          ${result.errors.length > 0 ? "completed_with_errors" : "completed"},
          ${result.errors.length > 0 ? result.errors.join("; ") : null}
        )
      `);
		} catch (error) {
			console.error("[UnlistedMetrics] Failed to persist refresh log:", error);
		}
	}

	/**
	 * Get audit log for regulatory compliance
	 */
	getAuditLog(): AuditLogEntry[] {
		return this.auditLog;
	}

	/**
	 * Get methodology documentation for audit purposes
	 */
	getMethodologyDocumentation(): object {
		return {
			service: "UnlistedStockMetricsService",
			version: "1.0.0",
			dataSource: "MCA Filings via CredHive API",
			formulas: {
				ROE: {
					formula: "(Net Profit / Networth) × 100",
					unit: "percentage",
					description:
						"Return on Equity - measures profitability relative to shareholders equity",
				},
				ROA: {
					formula: "(Net Profit / Total Assets) × 100",
					unit: "percentage",
					description:
						"Return on Assets - measures efficiency in using assets to generate profits",
				},
				ROCE: {
					formula: "(EBIT / Capital Employed) × 100",
					capitalEmployed: "Networth + Long-term Debt",
					unit: "percentage",
					description:
						"Return on Capital Employed - measures returns on all capital invested",
				},
				PE_Ratio: {
					formula: "Current Price / EPS",
					EPS: "Net Profit / Shares Outstanding",
					sharesOutstanding: "Paid-up Capital / Face Value",
					unit: "ratio",
					description:
						"Price to Earnings ratio - valuation relative to earnings",
				},
				PB_Ratio: {
					formula: "Current Price / Book Value per Share",
					BVPS: "Networth / Shares Outstanding",
					unit: "ratio",
					description: "Price to Book ratio - valuation relative to book value",
				},
				Debt_Equity: {
					formula: "Total Debt / Networth",
					unit: "ratio",
					description: "Leverage ratio measuring debt relative to equity",
				},
				PAT_Margin: {
					formula: "(Net Profit / Revenue) × 100",
					unit: "percentage",
					description: "Net profit margin - profitability after all expenses",
				},
				EBITDA_Margin: {
					formula: "(EBITDA / Revenue) × 100",
					unit: "percentage",
					description:
						"Operating profitability before depreciation and amortization",
				},
			},
			compliance: {
				regulatory: "SEBI (LODR) Regulations, Companies Act 2013",
				auditTrail: "All calculations logged with timestamp and data source",
				dataIntegrity: "MCA-sourced financial data with verification flags",
			},
		};
	}
}

export const unlistedStockMetricsService = new UnlistedStockMetricsService();
