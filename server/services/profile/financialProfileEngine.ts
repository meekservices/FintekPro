import { logger } from "../../logger";
import { uniPortfolioService } from "../portfolio/uniPortfolioService";
import { db } from "../../db";
import { creditApplications } from "../../../shared/schema/mpal";
import { eq, and, sql, sum } from "drizzle-orm";

export class FinancialProfileEngine {
	/**
	 * Combines Investments (UniPortfolio — all brokers) and Credit (Loans/Cards)
	 * into a Unified Financial Profile for AI advisory and net-worth calculation.
	 *
	 * The UniPortfolio is fetched via uniPortfolioService, which:
	 *   - Pulls from ALL configured brokers (IRIS, Alpaca, IIFL, ...)
	 *   - Uses stable portfolioId = "unified_{userId}" for quant engine
	 *   - Includes drift + rebalancing analysis (cached 5 min)
	 *
	 * Inputs  : userId — FintekPro user ID
	 * Outputs : Unified financial profile with investments + credit + net worth
	 * Edge cases: broker failures → partial portfolio, profile still returns
	 */
	async buildProfile(userId: string) {
		logger.info(
			`[FinancialProfileEngine] Building unified profile for user ${userId}`,
			{
				event: "FINANCIAL_PROFILE_BUILD",
				user_id: userId,
				status: "building",
			},
		);

		// 1. Fetch UniPortfolio (all brokers, drift, rebalancing — cached 5 min)
		let totalValue = 0;
		let positions: any[] = [];
		let portfolioId = `unified_${userId}`;
		let assetClassWeights: Record<string, number> = {};
		let countryWeights = { IN: 0, US: 0, OTHER: 0 };
		let driftDetected = false;
		let staleBrokers: string[] = [];

		try {
			const snapshot = await uniPortfolioService.getSnapshot(userId);
			totalValue = snapshot.summary.totalValueInr;
			positions = snapshot.holdings;
			portfolioId = snapshot.portfolioId;
			assetClassWeights = snapshot.summary.assetClassWeights;
			countryWeights = snapshot.summary.countryWeights;
			driftDetected = snapshot.analysis.drift.has_drifted;
			staleBrokers = snapshot.analysis.staleBrokers;
		} catch (e) {
			logger.warn(
				`[FinancialProfileEngine] Could not fetch UniPortfolio: ${e}`,
				{
					event: "FINANCIAL_PROFILE_PORTFOLIO_WARN",
					user_id: userId,
					status: "partial",
				},
			);
		}

		// 2. Fetch actual credit liabilities from DB
		const liabilities = await this.fetchActualLiabilities(userId);
		const creditUtilization = this.calculateUtilization(liabilities);

		const netWorth = totalValue - liabilities.totalOutstanding;

		return {
			userId,
			portfolioId, // stable "unified_{userId}" — quant engine reference key
			netWorth,
			totalAssets: totalValue,
			totalLiabilities: liabilities.totalOutstanding,
			creditUtilization,
			investmentAllocation: {
				totalValue,
				positions,
				assetClassWeights,
				countryWeights,
			},
			// Portfolio health signals for AI advisory (FASP-AI v1.0)
			portfolioHealth: {
				driftDetected,
				staleBrokers,
				dataComplete: staleBrokers.length === 0,
			},
		};
	}

	private async fetchActualLiabilities(userId: string) {
		try {
			const activeLoans = await db
				.select({ totalAmount: sum(creditApplications.amountRequested) })
				.from(creditApplications)
				.where(
					and(
						eq(creditApplications.userId, userId),
						sql`${creditApplications.status} IN ('APPROVED', 'DISBURSED')`,
					),
				);
			const totalOutstanding = Number(activeLoans[0]?.totalAmount || 0);
			return {
				totalOutstanding,
				totalLimit: totalOutstanding > 0 ? totalOutstanding * 2 : 500000,
			};
		} catch (error) {
			logger.error(`[FinancialProfileEngine] Error fetching live liabilities`, {
				event: "FINANCIAL_PROFILE_LIABILITIES_ERROR",
				user_id: userId,
				error: (error as any)?.message,
				status: "error",
			});
			return { totalOutstanding: 0, totalLimit: 0 };
		}
	}

	private calculateUtilization(liabilities: any) {
		if (!liabilities.totalLimit || liabilities.totalLimit === 0) return 0;
		return (liabilities.totalOutstanding / liabilities.totalLimit) * 100;
	}
}

export const financialProfileEngine = new FinancialProfileEngine();
