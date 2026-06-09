import { DatabaseStorage } from "../storage";
import type { CompanyFinancials, CompanyRatios } from "@shared/schema";
import { storage } from "../storage";

export interface ComplianceFlag {
	flagType: string;
	severity: "high" | "medium" | "low";
	message: string;
	blocksDeals: boolean;
}

export class ComplianceService {
	private storage: DatabaseStorage;

	constructor(storage: DatabaseStorage) {
		this.storage = storage;
	}

	/**
	 * Check company for compliance red flags
	 * Returns flags that may block deal creation
	 */
	async checkComplianceFlags(companyId: string): Promise<ComplianceFlag[]> {
		const flags: ComplianceFlag[] = [];

		const [financials, ratios] = await Promise.all([
			this.storage.getCompanyFinancials(companyId),
			this.storage.getCompanyRatios(companyId),
		]);

		const latestFinancials = financials[0];
		const latestRatios = ratios[0];

		// Check 1: Negative Networth
		if (latestFinancials) {
			const networth = Number(latestFinancials.networth);
			if (networth < 0) {
				flags.push({
					flagType: "NEGATIVE_NETWORTH",
					severity: "high",
					message: `Company has negative networth of ₹${networth.toLocaleString("en-IN")}. High liquidity risk.`,
					blocksDeals: true,
				});
			}
		}

		// Check 2: High Debt-to-Equity (> 2)
		if (latestRatios) {
			const debtEquity = Number(latestRatios.debtEquity);
			if (debtEquity > 2) {
				flags.push({
					flagType: "HIGH_DEBT_EQUITY",
					severity: "high",
					message: `Debt-to-Equity ratio of ${debtEquity.toFixed(2)} exceeds safe threshold of 2. High financial leverage.`,
					blocksDeals: true,
				});
			}

			// Check 3: Low Interest Coverage (< 2)
			const interestCoverage = Number(latestRatios.interestCoverage);
			if (interestCoverage && interestCoverage < 2) {
				flags.push({
					flagType: "LOW_INTEREST_COVERAGE",
					severity: "high",
					message: `Interest coverage ratio of ${interestCoverage.toFixed(2)} indicates difficulty in servicing debt.`,
					blocksDeals: true,
				});
			}

			// Check 4: Poor Current Ratio (< 1)
			const currentRatio = Number(latestRatios.currentRatio);
			if (currentRatio && currentRatio < 1) {
				flags.push({
					flagType: "LOW_LIQUIDITY",
					severity: "high",
					message: `Current ratio of ${currentRatio.toFixed(2)} indicates insufficient current assets to cover liabilities.`,
					blocksDeals: true,
				});
			}

			// Check 5: Negative ROE
			const roe = Number(latestRatios.roe);
			if (roe && roe < 0) {
				flags.push({
					flagType: "NEGATIVE_ROE",
					severity: "medium",
					message: `Return on Equity is negative (${roe.toFixed(2)}%), indicating losses.`,
					blocksDeals: false,
				});
			}

			// Check 6: Low ROCE (< 5%)
			const roce = Number(latestRatios.roce);
			if (roce && roce < 5) {
				flags.push({
					flagType: "LOW_ROCE",
					severity: "medium",
					message: `Return on Capital Employed is low (${roce.toFixed(2)}%). Company generating poor returns.`,
					blocksDeals: false,
				});
			}
		}

		// Check 7: Deteriorating Profitability
		if (financials && financials.length >= 2) {
			const currentProfit = Number(financials[0].netProfit);
			const previousProfit = Number(financials[1].netProfit);

			if (currentProfit < previousProfit * 0.8) {
				// > 20% decline
				flags.push({
					flagType: "DECLINING_PROFITABILITY",
					severity: "medium",
					message: `Net profit has declined by ${(((previousProfit - currentProfit) / previousProfit) * 100).toFixed(0)}% YoY.`,
					blocksDeals: false,
				});
			}
		}

		return flags;
	}

	/**
	 * Check if company has blocking red flags
	 */
	async hasBlockingFlags(companyId: string): Promise<boolean> {
		const flags = await this.checkComplianceFlags(companyId);
		return flags.some((f) => f.blocksDeals);
	}

	/**
	 * Get compliance risk score (0-100)
	 * Higher = riskier
	 */
	async getComplianceRiskScore(companyId: string): Promise<number> {
		const flags = await this.checkComplianceFlags(companyId);
		const highSeverityCount = flags.filter((f) => f.severity === "high").length;
		const mediumSeverityCount = flags.filter(
			(f) => f.severity === "medium",
		).length;
		const lowSeverityCount = flags.filter((f) => f.severity === "low").length;

		// Simple scoring: high=30pts, medium=15pts, low=5pts (max 100)
		const score =
			highSeverityCount * 30 + mediumSeverityCount * 15 + lowSeverityCount * 5;
		return Math.min(100, score);
	}
}

export const complianceService = new ComplianceService(storage);
