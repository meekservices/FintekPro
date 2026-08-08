import { logger } from "../logger";
import { db } from "../db";
import { dailyPicks, aiUserInteractions, aiUserProfiles } from "@shared/schema";
import { eq, and, desc, sql, gte, count } from "drizzle-orm";
import { aiAnalyticsEngine } from "./ai-analytics-engine";

export type InteractionType =
	| "view"
	| "click"
	| "invest"
	| "exit"
	| "watchlist_add"
	| "share"
	| "dismiss";

export interface InteractionEvent {
	userId: string;
	pickId: number;
	interactionType: InteractionType;
	metadata?: {
		amount?: number;
		exitPrice?: number;
		pnl?: number;
		holdingDays?: number;
		source?: string;
		[key: string]: any;
	};
	sessionId?: string;
	deviceType?: string;
}

export interface UserProfile {
	userId: string;
	riskToleranceScore: number;
	engagementScore: number;
	preferredCategories: string[];
	avgHoldingDays: number;
	avgInvestmentAmount: number;
	totalInteractions: number;
	investmentCount: number;
	profitableTradesRatio: number;
	preferredRiskLevel: string;
	lastActiveAt: string;
}

export interface PersonalizedPick {
	pickId: number;
	instrumentName: string;
	category: string;
	baseScore: number;
	personalizedScore: number;
	personalizedBoost: number;
	matchReasons: string[];
	riskMatch: boolean;
	categoryMatch: boolean;
}

export interface PersonalizationFactors {
	categoryPreference: number;
	riskAlignment: number;
	engagementBoost: number;
	recencyPenalty: number;
}

const CATEGORY_RISK_MAP: Record<string, number> = {
	derivatives: 90,
	unlisted: 85,
	listed_stocks: 50,
	global_stocks: 55,
	etfs: 45,
	reits_invits: 40,
	mutual_funds: 35,
	bonds: 20,
	sgb: 15,
	fixed_deposits: 10,
};

const INTERACTION_WEIGHTS: Record<string, number> = {
	invest: 5,
	click: 2,
	view: 1,
	watchlist_add: 3,
	share: 2,
	exit: 1,
	dismiss: -1,
};

class AIFeedbackEngine {
	async logInteraction(event: InteractionEvent): Promise<void> {
		try {
			if (!event.userId || !event.pickId || !event.interactionType) {
				logger.warn(
					"[AIFeedbackEngine] Invalid interaction event, missing required fields",
				);
				return;
			}

			const [pick] = await db
				.select({ id: dailyPicks.id })
				.from(dailyPicks)
				.where(eq(dailyPicks.id, event.pickId))
				.limit(1);

			if (!pick) {
				logger.warn(
					`[AIFeedbackEngine] Pick ${event.pickId} not found, skipping interaction`,
				);
				return;
			}

			await db.insert(aiUserInteractions).values({
				userId: event.userId,
				pickId: event.pickId,
				interactionType: event.interactionType,
				metadata: event.metadata || null,
				sessionId: event.sessionId || null,
				deviceType: event.deviceType || null,
			});

			if (
				event.interactionType === "invest" ||
				event.interactionType === "exit"
			) {
				setImmediate(() => {
					this.updateUserProfile(event.userId).catch((err) =>
						logger.error(
							`[AIFeedbackEngine] Async profile update failed for ${event.userId}:`,
							err,
						),
					);
				});
			}
		} catch (error) {
			logger.error("[AIFeedbackEngine] Error logging interaction:", error instanceof Error ? error : new Error(String(error)));
		}
	}

	async logBatchInteractions(events: InteractionEvent[]): Promise<void> {
		try {
			if (!events || events.length === 0) return;

			const validEvents = events.filter(
				(e) => e.userId && e.pickId && e.interactionType,
			);
			if (validEvents.length === 0) return;

			const values = validEvents.map((event) => ({
				userId: event.userId,
				pickId: event.pickId,
				interactionType: event.interactionType,
				metadata: event.metadata || null,
				sessionId: event.sessionId || null,
				deviceType: event.deviceType || null,
			}));

			await db.insert(aiUserInteractions).values(values);

			const usersToUpdate = new Set(
				validEvents
					.filter(
						(e) =>
							e.interactionType === "invest" || e.interactionType === "exit",
					)
					.map((e) => e.userId),
			);

			for (const userId of usersToUpdate) {
				setImmediate(() => {
					this.updateUserProfile(userId).catch((err) =>
						logger.error(
							`[AIFeedbackEngine] Async batch profile update failed for ${userId}:`,
							err,
						),
					);
				});
			}
		} catch (error) {
			logger.error(
				"[AIFeedbackEngine] Error in batch interaction logging:",
				error instanceof Error ? error : new Error(String(error)),
			);
		}
	}

	async updateUserProfile(userId: string): Promise<UserProfile> {
		const interactions = await db
			.select({
				id: aiUserInteractions.id,
				pickId: aiUserInteractions.pickId,
				interactionType: aiUserInteractions.interactionType,
				metadata: aiUserInteractions.metadata,
				createdAt: aiUserInteractions.createdAt,
			})
			.from(aiUserInteractions)
			.where(eq(aiUserInteractions.userId, userId))
			.orderBy(desc(aiUserInteractions.createdAt));

		const pickIds = [...new Set(interactions.map((i) => i.pickId))];
		const pickDetailsMap = new Map<
			number,
			{ category: string; riskLevel: string | null }
		>();

		if (pickIds.length > 0) {
			const picks = await db
				.select({
					id: dailyPicks.id,
					category: dailyPicks.category,
					riskLevel: dailyPicks.riskLevel,
				})
				.from(dailyPicks)
				.where(
					sql`${dailyPicks.id} IN (${sql.join(
						pickIds.map((id) => sql`${id}`),
						sql`, `,
					)})`,
				);

			for (const p of picks) {
				pickDetailsMap.set(p.id, {
					category: p.category,
					riskLevel: p.riskLevel,
				});
			}
		}

		const investInteractions = interactions.filter(
			(i) => i.interactionType === "invest",
		);
		const exitInteractions = interactions.filter(
			(i) => i.interactionType === "exit",
		);

		let riskToleranceScore = 50;
		if (investInteractions.length > 0) {
			let weightedRiskSum = 0;
			let weightCount = 0;
			for (const inv of investInteractions) {
				const pickDetail = pickDetailsMap.get(inv.pickId);
				if (pickDetail) {
					const categoryRisk = CATEGORY_RISK_MAP[pickDetail.category] ?? 50;
					weightedRiskSum += categoryRisk;
					weightCount++;
				}
			}
			if (weightCount > 0) {
				riskToleranceScore = Math.round(weightedRiskSum / weightCount);
			}
		}
		riskToleranceScore = Math.max(0, Math.min(100, riskToleranceScore));

		const now = new Date();
		const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
		const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

		const interactionsLast30d = interactions.filter(
			(i) => i.createdAt && new Date(i.createdAt) >= thirtyDaysAgo,
		).length;
		const interactionsLast7d = interactions.filter(
			(i) => i.createdAt && new Date(i.createdAt) >= sevenDaysAgo,
		).length;
		const engagementScore = Math.min(
			100,
			interactionsLast30d * 3 + interactionsLast7d * 10,
		);

		const categoryScores = new Map<string, number>();
		for (const interaction of interactions) {
			const pickDetail = pickDetailsMap.get(interaction.pickId);
			if (!pickDetail) continue;
			const weight = INTERACTION_WEIGHTS[interaction.interactionType] ?? 0;
			const current = categoryScores.get(pickDetail.category) || 0;
			categoryScores.set(pickDetail.category, current + weight);
		}
		const preferredCategories = [...categoryScores.entries()]
			.sort((a, b) => b[1] - a[1])
			.filter(([, score]) => score > 0)
			.map(([cat]) => cat);

		let avgHoldingDays = 0;
		const holdingDaysValues: number[] = [];
		for (const exit of exitInteractions) {
			const meta = exit.metadata as any;
			if (meta?.holdingDays && typeof meta.holdingDays === "number") {
				holdingDaysValues.push(meta.holdingDays);
			}
		}
		if (holdingDaysValues.length > 0) {
			avgHoldingDays =
				Math.round(
					(holdingDaysValues.reduce((a, b) => a + b, 0) /
						holdingDaysValues.length) *
						100,
				) / 100;
		}

		let avgInvestmentAmount = 0;
		const investAmounts: number[] = [];
		for (const inv of investInteractions) {
			const meta = inv.metadata as any;
			if (meta?.amount && typeof meta.amount === "number") {
				investAmounts.push(meta.amount);
			}
		}
		if (investAmounts.length > 0) {
			avgInvestmentAmount =
				Math.round(
					(investAmounts.reduce((a, b) => a + b, 0) / investAmounts.length) *
						100,
				) / 100;
		}

		let profitableTradesRatio = 0;
		if (exitInteractions.length > 0) {
			const profitableTrades = exitInteractions.filter((e) => {
				const meta = e.metadata as any;
				return meta?.pnl && typeof meta.pnl === "number" && meta.pnl > 0;
			}).length;
			profitableTradesRatio =
				Math.round((profitableTrades / exitInteractions.length) * 10000) /
				10000;
		}

		const preferredRiskLevel = this.mapRiskScore(riskToleranceScore);

		const lastActiveAt =
			interactions.length > 0 && interactions[0].createdAt
				? new Date(interactions[0].createdAt).toISOString()
				: new Date().toISOString();

		const profile: UserProfile = {
			userId,
			riskToleranceScore,
			engagementScore,
			preferredCategories,
			avgHoldingDays,
			avgInvestmentAmount,
			totalInteractions: interactions.length,
			investmentCount: investInteractions.length,
			profitableTradesRatio,
			preferredRiskLevel,
			lastActiveAt,
		};

		await db
			.insert(aiUserProfiles)
			.values({
				userId,
				riskToleranceScore: String(riskToleranceScore),
				engagementScore: String(engagementScore),
				preferredCategories: preferredCategories,
				avgHoldingDays: String(avgHoldingDays),
				avgInvestmentAmount: String(avgInvestmentAmount),
				totalInteractions: interactions.length,
				investmentCount: investInteractions.length,
				profitableTradesRatio: String(profitableTradesRatio),
				preferredRiskLevel,
				lastActiveAt: new Date(lastActiveAt),
				profileVersion: 1,
			})
			.onConflictDoUpdate({
				target: aiUserProfiles.userId,
				set: {
					riskToleranceScore: String(riskToleranceScore),
					engagementScore: String(engagementScore),
					preferredCategories: preferredCategories,
					avgHoldingDays: String(avgHoldingDays),
					avgInvestmentAmount: String(avgInvestmentAmount),
					totalInteractions: interactions.length,
					investmentCount: investInteractions.length,
					profitableTradesRatio: String(profitableTradesRatio),
					preferredRiskLevel,
					lastActiveAt: new Date(lastActiveAt),
					updatedAt: new Date(),
					profileVersion: sql`${aiUserProfiles.profileVersion} + 1`,
				},
			});

		return profile;
	}

	async getUserProfile(userId: string): Promise<UserProfile | null> {
		const [existing] = await db
			.select()
			.from(aiUserProfiles)
			.where(eq(aiUserProfiles.userId, userId))
			.limit(1);

		if (existing) {
			return {
				userId: existing.userId,
				riskToleranceScore: Number.parseFloat(
					existing.riskToleranceScore || "50",
				),
				engagementScore: Number.parseFloat(existing.engagementScore || "0"),
				preferredCategories: (existing.preferredCategories as string[]) || [],
				avgHoldingDays: Number.parseFloat(existing.avgHoldingDays || "0"),
				avgInvestmentAmount: Number.parseFloat(
					existing.avgInvestmentAmount || "0",
				),
				totalInteractions: existing.totalInteractions || 0,
				investmentCount: existing.investmentCount || 0,
				profitableTradesRatio: Number.parseFloat(
					existing.profitableTradesRatio || "0",
				),
				preferredRiskLevel: existing.preferredRiskLevel || "medium",
				lastActiveAt: existing.lastActiveAt
					? new Date(existing.lastActiveAt).toISOString()
					: new Date().toISOString(),
			};
		}

		const [hasInteractions] = await db
			.select({ cnt: count() })
			.from(aiUserInteractions)
			.where(eq(aiUserInteractions.userId, userId));

		if (hasInteractions && Number(hasInteractions.cnt) > 0) {
			return this.updateUserProfile(userId);
		}

		return null;
	}

	async getPersonalizedPicks(
		userId: string,
		limit: number = 10,
	): Promise<PersonalizedPick[]> {
		const profile = await this.getUserProfile(userId);

		const livePicks = await db
			.select()
			.from(dailyPicks)
			.where(eq(dailyPicks.status, "live"))
			.orderBy(desc(dailyPicks.recoDate))
			.limit(Math.max(limit * 10, 100)); // cap DB fetch; rank and slice to `limit` below

		if (livePicks.length === 0) return [];

		if (!profile) {
			return livePicks.slice(0, limit).map((pick) => ({
				pickId: pick.id,
				instrumentName: pick.instrumentName,
				category: pick.category,
				baseScore: (pick.confidenceScore || 70) / 100,
				personalizedScore: (pick.confidenceScore || 70) / 100,
				personalizedBoost: 0,
				matchReasons: [],
				riskMatch: false,
				categoryMatch: false,
			}));
		}

		let recentViews = new Set<number>();
		try {
			const recentViewInteractions = await db
				.select({ pickId: aiUserInteractions.pickId })
				.from(aiUserInteractions)
				.where(
					and(
						eq(aiUserInteractions.userId, userId),
						eq(aiUserInteractions.interactionType, "view"),
						gte(
							aiUserInteractions.createdAt,
							new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
						),
					),
				);
			recentViews = new Set(recentViewInteractions.map((r) => r.pickId));
		} catch {
			// non-critical
		}

		const top3Categories = profile.preferredCategories.slice(0, 3);

		const personalizedPicks: PersonalizedPick[] = livePicks.map((pick) => {
			const factors = this.computePersonalizationFactors(
				pick,
				profile,
				recentViews,
			);

			const baseScore = (pick.confidenceScore || 70) / 100;
			const boost =
				factors.categoryPreference +
				factors.riskAlignment +
				factors.engagementBoost -
				factors.recencyPenalty;
			const personalizedScore = Math.max(0, Math.min(1, baseScore + boost));

			const matchReasons: string[] = [];
			const categoryMatch = top3Categories.includes(pick.category);
			const riskMatch = pick.riskLevel === profile.preferredRiskLevel;

			if (categoryMatch)
				matchReasons.push(`Matches your preferred category: ${pick.category}`);
			if (riskMatch)
				matchReasons.push(
					`Risk level aligns with your profile: ${pick.riskLevel}`,
				);
			if (factors.engagementBoost > 0.01)
				matchReasons.push("Boosted for active engagement");
			if (factors.recencyPenalty > 0) matchReasons.push("Recently viewed");

			return {
				pickId: pick.id,
				instrumentName: pick.instrumentName,
				category: pick.category,
				baseScore: Math.round(baseScore * 1000) / 1000,
				personalizedScore: Math.round(personalizedScore * 1000) / 1000,
				personalizedBoost: Math.round(boost * 1000) / 1000,
				matchReasons,
				riskMatch,
				categoryMatch,
			};
		});

		personalizedPicks.sort((a, b) => b.personalizedScore - a.personalizedScore);
		return personalizedPicks.slice(0, limit);
	}

	async getInteractionHistory(
		userId: string,
		limit: number = 50,
	): Promise<any[]> {
		const result = await db
			.select({
				interactionId: aiUserInteractions.id,
				pickId: aiUserInteractions.pickId,
				interactionType: aiUserInteractions.interactionType,
				metadata: aiUserInteractions.metadata,
				sessionId: aiUserInteractions.sessionId,
				deviceType: aiUserInteractions.deviceType,
				createdAt: aiUserInteractions.createdAt,
				instrumentName: dailyPicks.instrumentName,
				category: dailyPicks.category,
				symbol: dailyPicks.symbol,
				recoPrice: dailyPicks.recoPrice,
				targetPrice: dailyPicks.targetPrice,
				currentPrice: dailyPicks.currentPrice,
				status: dailyPicks.status,
				riskLevel: dailyPicks.riskLevel,
			})
			.from(aiUserInteractions)
			.innerJoin(dailyPicks, eq(aiUserInteractions.pickId, dailyPicks.id))
			.where(eq(aiUserInteractions.userId, userId))
			.orderBy(desc(aiUserInteractions.createdAt))
			.limit(limit);

		return result;
	}

	async getEngagementStats(userId: string): Promise<any> {
		const interactions = await db
			.select({
				interactionType: aiUserInteractions.interactionType,
				metadata: aiUserInteractions.metadata,
				createdAt: aiUserInteractions.createdAt,
				pickId: aiUserInteractions.pickId,
			})
			.from(aiUserInteractions)
			.where(eq(aiUserInteractions.userId, userId));

		const totalInteractions = interactions.length;

		const interactionsByType: Record<string, number> = {};
		for (const i of interactions) {
			interactionsByType[i.interactionType] =
				(interactionsByType[i.interactionType] || 0) + 1;
		}

		const activeDays = new Set(
			interactions
				.filter((i) => i.createdAt)
				.map((i) => new Date(i.createdAt!).toISOString().split("T")[0]),
		).size;

		const pickIds = [...new Set(interactions.map((i) => i.pickId))];
		const categoryMap = new Map<string, number>();
		if (pickIds.length > 0) {
			const picks = await db
				.select({ id: dailyPicks.id, category: dailyPicks.category })
				.from(dailyPicks)
				.where(
					sql`${dailyPicks.id} IN (${sql.join(
						pickIds.map((id) => sql`${id}`),
						sql`, `,
					)})`,
				);

			const pickCategoryMap = new Map(picks.map((p) => [p.id, p.category]));
			for (const i of interactions) {
				const cat = pickCategoryMap.get(i.pickId);
				if (cat) {
					categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
				}
			}
		}

		const mostEngagedCategories = [...categoryMap.entries()]
			.sort((a, b) => b[1] - a[1])
			.map(([category, count]) => ({ category, count }));

		const investEvents = interactions.filter(
			(i) => i.interactionType === "invest",
		);
		const exitEvents = interactions.filter((i) => i.interactionType === "exit");

		let totalInvested = 0;
		for (const inv of investEvents) {
			const meta = inv.metadata as any;
			if (meta?.amount && typeof meta.amount === "number") {
				totalInvested += meta.amount;
			}
		}

		let totalPnL = 0;
		let wins = 0;
		for (const exit of exitEvents) {
			const meta = exit.metadata as any;
			if (meta?.pnl && typeof meta.pnl === "number") {
				totalPnL += meta.pnl;
				if (meta.pnl > 0) wins++;
			}
		}

		const winRate =
			exitEvents.length > 0
				? Math.round((wins / exitEvents.length) * 10000) / 10000
				: 0;

		return {
			totalInteractions,
			interactionsByType,
			activeDays,
			mostEngagedCategories,
			investmentSummary: {
				totalInvested: Math.round(totalInvested * 100) / 100,
				totalPnL: Math.round(totalPnL * 100) / 100,
				totalExits: exitEvents.length,
				winRate,
			},
		};
	}

	private computePersonalizationFactors(
		pick: any,
		profile: UserProfile,
		recentViews: Set<number>,
	): PersonalizationFactors {
		const top3Categories = profile.preferredCategories.slice(0, 3);
		const categoryPreference = top3Categories.includes(pick.category)
			? 0.15
			: 0;

		const riskAlignment =
			pick.riskLevel === profile.preferredRiskLevel ? 0.1 : 0;

		const engagementBoost = 0.05 * (profile.engagementScore / 100);

		const recencyPenalty = recentViews.has(pick.id) ? 0.05 : 0;

		return {
			categoryPreference,
			riskAlignment,
			engagementBoost,
			recencyPenalty,
		};
	}

	private mapRiskScore(score: number): string {
		if (score <= 33) return "low";
		if (score <= 66) return "medium";
		return "high";
	}
}

export const aiFeedbackEngine = new AIFeedbackEngine();
