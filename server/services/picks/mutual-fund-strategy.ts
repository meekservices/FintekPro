import { db } from "../../db";
import { mutualFunds } from "@shared/schema";
import { and, eq, sql } from "drizzle-orm";
import { BaseStrategy } from "./base-strategy";
import { StrategyContext } from "./types";
import { DailyPickData, PickCategory } from "../pick-of-the-day-service";
import { isFundInvestable } from "../regulatory-investability-service";

export class MutualFundStrategy extends BaseStrategy {
	category: PickCategory = "mutual_funds";

	async generate(context: StrategyContext): Promise<DailyPickData | null> {
		try {
			const funds = await db
				.select()
				.from(mutualFunds)
				.where(
					and(
						eq(mutualFunds.isPublished, true),
						sql`${mutualFunds.nav} IS NOT NULL`,
						sql`${mutualFunds.nav}::float > 0`,
						sql`(${mutualFunds.category} IS NULL OR ${mutualFunds.category} NOT ILIKE '%ETF%')`,
						sql`${mutualFunds.schemeName} NOT ILIKE '%ETF%'`,
						sql`(${mutualFunds.lastUpdated} IS NULL OR ${mutualFunds.lastUpdated} > NOW() - INTERVAL '45 days')`,
					),
				)
				.limit(100);

			if (funds.length === 0) return null;

			const nonEtfFunds = funds.filter((fund) => {
				const name = (fund.schemeName || "").toUpperCase();
				const cat = (fund.category || "").toUpperCase();
				return !(name.includes("ETF") || cat.includes("ETF"));
			});

			const investableFunds = nonEtfFunds.filter(
				(fund) =>
					isFundInvestable({
						schemeName: fund.schemeName,
						category: fund.category || undefined,
						purchaseAllowed: true,
					}).investable,
			);

			const freshFunds = this.filterRecentPicks(
				investableFunds,
				context.recentIds,
				(f) => f.schemeCode,
			);

			const scoredFunds = freshFunds
				.map((fund) => ({
					fund,
					score: this.score(fund),
				}))
				.sort((a, b) => b.score - a.score);

			if (scoredFunds.length === 0) return null;

			const topFund = scoredFunds[0].fund;
			const currentNav = Number.parseFloat(topFund.nav || "0");
			const { targetPct, stoplossPct } =
				this.getDynamicTargetStoploss("mutual_funds");
			const targetNav = Math.round(currentNav * (1 + targetPct) * 100) / 100;
			const stoplossNav =
				Math.round(currentNav * (1 - stoplossPct) * 100) / 100;

			const rationale = await context.service.generateRationale({
				category: "mutual_funds",
				name: topFund.schemeName,
				currentPrice: currentNav,
				targetPrice: targetNav,
				stoplossPrice: stoplossNav,
				metrics: {
					returns1y: topFund.returns1y,
					returns3y: topFund.returns3y,
					smartRating: topFund.crisilRating,
					expenseRatio: topFund.expenseRatio,
				},
			});

			return {
				category: "mutual_funds",
				instrumentId: topFund.schemeCode,
				instrumentName: topFund.schemeName,
				isin: topFund.isin || undefined,
				symbol: topFund.schemeCode,
				recoDate: context.today,
				recoPrice: currentNav,
				targetPrice: targetNav,
				stoplossPrice: stoplossNav,
				currentPrice: currentNav,
				status: "live",
				expiryDate: this.getExpiryDate(90),
				rationale,
				riskLevel: topFund.riskLevel || "medium",
				suitableFor: this.deriveSuitableFor(
					topFund.riskLevel || "medium",
					"mutual_funds",
				),
				timeHorizon: this.getTimeHorizon("mutual_funds"),
				confidenceScore: this.getConfidenceScore(
					"mutual_funds",
					scoredFunds[0].score,
					70,
				),
				sectorCategory: topFund.category || undefined,
				keyMetrics: {
					cmp: currentNav,
					nav: currentNav,
					returns1y: topFund.returns1y
						? Number.parseFloat(topFund.returns1y)
						: undefined,
					returns3y: topFund.returns3y
						? Number.parseFloat(topFund.returns3y)
						: undefined,
					smartRating: topFund.crisilRating || undefined,
					fundHouse: topFund.fundHouse || undefined,
					category: topFund.category || undefined,
					expenseRatio: topFund.expenseRatio
						? Number.parseFloat(topFund.expenseRatio)
						: null,
					riskLevel: topFund.riskLevel || undefined,
				},
			};
		} catch (error) {
			console.error("[MutualFundStrategy] Error:", error);
			return null;
		}
	}

	score(fund: any): number {
		let score = 0;
		const smartRating = fund.crisilRating
			? Number.parseInt(fund.crisilRating)
			: 0;
		if (smartRating >= 5) score += 25;
		else if (smartRating >= 3) score += 15;

		const returns1y = fund.returns1y ? Number.parseFloat(fund.returns1y) : 0;
		if (returns1y > 20) score += 20;
		else if (returns1y > 12) score += 15;

		const expenseRatio = fund.expenseRatio
			? Number.parseFloat(fund.expenseRatio)
			: 2;
		if (expenseRatio < 0.5) score += 15;
		else if (expenseRatio < 1.5) score += 5;

		return score;
	}

	async getLivePrice(instrumentId: string): Promise<number | null> {
		const row = await db
			.select({ nav: mutualFunds.nav })
			.from(mutualFunds)
			.where(eq(mutualFunds.schemeCode, instrumentId))
			.limit(1);
		return row[0]?.nav ? Number.parseFloat(row[0].nav) : null;
	}
}
