import { logger } from "../logger";
import { db } from "../db";
import {
	aiRecommendationTracking,
	type AiRecommendationTracking,
	type InsertAiRecommendationTracking,
} from "../../shared/schema";
import { eq, desc, and, gte, lte, sql, count, avg } from "drizzle-orm";

interface SuccessMetrics {
	totalRecommendations: number;
	pendingRecommendations: number;
	resolvedRecommendations: number;
	hitTarget: number;
	missedTarget: number;
	stoppedOut: number;
	expired: number;
	successRate: number;
	averageReturn: number;
	averageConfidence: number;
}

interface SectorMetrics {
	sector: string;
	total: number;
	successRate: number;
	avgReturn: number;
}

interface TimeframeMetrics {
	timeframe: string;
	total: number;
	successRate: number;
	avgReturn: number;
}

interface AssetTypeMetrics {
	assetType: string;
	total: number;
	successRate: number;
	avgReturn: number;
}

interface TrendDataPoint {
	date: string;
	successRate: number;
	totalRecommendations: number;
}

export class AiRecommendationTrackingService {
	constructor() {
		logger.info("✅ AI Recommendation Tracking Service initialized");
	}

	async recordRecommendation(
		data: InsertAiRecommendationTracking,
	): Promise<AiRecommendationTracking> {
		const [recommendation] = await db
			.insert(aiRecommendationTracking)
			.values(data)
			.returning();
		return recommendation;
	}

	async getRecommendation(
		id: string,
	): Promise<AiRecommendationTracking | undefined> {
		const [recommendation] = await db
			.select()
			.from(aiRecommendationTracking)
			.where(eq(aiRecommendationTracking.id, id));
		return recommendation;
	}

	async getAllRecommendations(filters?: {
		status?: string;
		assetType?: string;
		sector?: string;
		source?: string;
		limit?: number;
		offset?: number;
	}): Promise<AiRecommendationTracking[]> {
		let query = db.select().from(aiRecommendationTracking);

		const conditions = [];
		if (filters?.status) {
			conditions.push(eq(aiRecommendationTracking.status, filters.status));
		}
		if (filters?.assetType) {
			conditions.push(
				eq(aiRecommendationTracking.assetType, filters.assetType),
			);
		}
		if (filters?.sector) {
			conditions.push(eq(aiRecommendationTracking.sector, filters.sector));
		}
		if (filters?.source) {
			conditions.push(eq(aiRecommendationTracking.source, filters.source));
		}

		if (conditions.length > 0) {
			query = query.where(and(...conditions)) as any;
		}

		query = query.orderBy(desc(aiRecommendationTracking.createdAt)) as any;

		if (filters?.limit) {
			query = query.limit(filters.limit) as any;
		}
		if (filters?.offset) {
			query = query.offset(filters.offset) as any;
		}

		return query;
	}

	async getPendingRecommendations(): Promise<AiRecommendationTracking[]> {
		return db
			.select()
			.from(aiRecommendationTracking)
			.where(eq(aiRecommendationTracking.status, "pending"))
			.orderBy(aiRecommendationTracking.expiryDate);
	}

	async updateRecommendationPrice(
		id: string,
		currentPrice: number,
		highestPrice?: number,
		lowestPrice?: number,
	): Promise<void> {
		const recommendation = await this.getRecommendation(id);
		if (!recommendation) return;

		const updates: Partial<AiRecommendationTracking> = {
			currentPrice: currentPrice.toString(),
			updatedAt: new Date(),
		};

		if (highestPrice !== undefined) {
			const existingHigh = recommendation.highestPrice
				? Number.parseFloat(recommendation.highestPrice)
				: 0;
			updates.highestPrice = Math.max(existingHigh, highestPrice).toString();
		}

		if (lowestPrice !== undefined) {
			const existingLow = recommendation.lowestPrice
				? Number.parseFloat(recommendation.lowestPrice)
				: Number.POSITIVE_INFINITY;
			updates.lowestPrice = Math.min(existingLow, lowestPrice).toString();
		}

		await db
			.update(aiRecommendationTracking)
			.set(updates)
			.where(eq(aiRecommendationTracking.id, id));
	}

	async resolveRecommendation(
		id: string,
		status: "hit_target" | "missed_target" | "stopped_out" | "expired",
		currentPrice: number,
		note?: string,
	): Promise<AiRecommendationTracking | undefined> {
		const recommendation = await this.getRecommendation(id);
		if (!recommendation) return undefined;

		const entryPrice = Number.parseFloat(recommendation.entryPrice);
		const actualReturn = ((currentPrice - entryPrice) / entryPrice) * 100;

		const [updated] = await db
			.update(aiRecommendationTracking)
			.set({
				status,
				currentPrice: currentPrice.toString(),
				actualReturn: actualReturn.toFixed(2),
				resolvedAt: new Date(),
				resolutionNote: note,
				updatedAt: new Date(),
			})
			.where(eq(aiRecommendationTracking.id, id))
			.returning();

		return updated;
	}

	async getSuccessMetrics(
		dateFrom?: Date,
		dateTo?: Date,
	): Promise<SuccessMetrics> {
		const conditions = [];
		if (dateFrom) {
			conditions.push(gte(aiRecommendationTracking.createdAt, dateFrom));
		}
		if (dateTo) {
			conditions.push(lte(aiRecommendationTracking.createdAt, dateTo));
		}

		let query = db.select().from(aiRecommendationTracking);
		if (conditions.length > 0) {
			query = query.where(and(...conditions)) as any;
		}

		const recommendations = await query;

		const totalRecommendations = recommendations.length;
		const pendingRecommendations = recommendations.filter(
			(r) => r.status === "pending",
		).length;
		const resolvedRecommendations = recommendations.filter(
			(r) => r.status !== "pending",
		).length;
		const hitTarget = recommendations.filter(
			(r) => r.status === "hit_target",
		).length;
		const missedTarget = recommendations.filter(
			(r) => r.status === "missed_target",
		).length;
		const stoppedOut = recommendations.filter(
			(r) => r.status === "stopped_out",
		).length;
		const expired = recommendations.filter(
			(r) => r.status === "expired",
		).length;

		const successRate =
			resolvedRecommendations > 0
				? (hitTarget / resolvedRecommendations) * 100
				: 0;

		const resolvedWithReturns = recommendations.filter(
			(r) => r.actualReturn !== null,
		);
		const averageReturn =
			resolvedWithReturns.length > 0
				? resolvedWithReturns.reduce(
						(sum, r) => sum + Number.parseFloat(r.actualReturn || "0"),
						0,
					) / resolvedWithReturns.length
				: 0;

		const averageConfidence =
			totalRecommendations > 0
				? recommendations.reduce(
						(sum, r) => sum + Number.parseFloat(r.confidenceScore),
						0,
					) / totalRecommendations
				: 0;

		return {
			totalRecommendations,
			pendingRecommendations,
			resolvedRecommendations,
			hitTarget,
			missedTarget,
			stoppedOut,
			expired,
			successRate: Math.round(successRate * 100) / 100,
			averageReturn: Math.round(averageReturn * 100) / 100,
			averageConfidence: Math.round(averageConfidence * 100) / 100,
		};
	}

	async getMetricsBySector(): Promise<SectorMetrics[]> {
		const recommendations = await db
			.select()
			.from(aiRecommendationTracking)
			.where(sql`${aiRecommendationTracking.sector} IS NOT NULL`);

		const sectorMap = new Map<
			string,
			{ total: number; hits: number; returns: number[] }
		>();

		for (const rec of recommendations) {
			const sector = rec.sector || "Unknown";
			if (!sectorMap.has(sector)) {
				sectorMap.set(sector, { total: 0, hits: 0, returns: [] });
			}
			const data = sectorMap.get(sector)!;
			data.total++;
			if (rec.status === "hit_target") data.hits++;
			if (rec.actualReturn)
				data.returns.push(Number.parseFloat(rec.actualReturn));
		}

		return Array.from(sectorMap.entries()).map(([sector, data]) => ({
			sector,
			total: data.total,
			successRate:
				data.total > 0 ? Math.round((data.hits / data.total) * 10000) / 100 : 0,
			avgReturn:
				data.returns.length > 0
					? Math.round(
							(data.returns.reduce((a, b) => a + b, 0) / data.returns.length) *
								100,
						) / 100
					: 0,
		}));
	}

	async getMetricsByTimeframe(): Promise<TimeframeMetrics[]> {
		const recommendations = await db.select().from(aiRecommendationTracking);

		const timeframeMap = new Map<
			string,
			{ total: number; hits: number; returns: number[] }
		>();
		const timeframeLabels: Record<number, string> = {
			7: "1 Week",
			30: "1 Month",
			90: "3 Months",
			180: "6 Months",
			365: "1 Year",
		};

		for (const rec of recommendations) {
			const label =
				timeframeLabels[rec.timeframeInDays] || `${rec.timeframeInDays} Days`;
			if (!timeframeMap.has(label)) {
				timeframeMap.set(label, { total: 0, hits: 0, returns: [] });
			}
			const data = timeframeMap.get(label)!;
			data.total++;
			if (rec.status === "hit_target") data.hits++;
			if (rec.actualReturn)
				data.returns.push(Number.parseFloat(rec.actualReturn));
		}

		return Array.from(timeframeMap.entries()).map(([timeframe, data]) => ({
			timeframe,
			total: data.total,
			successRate:
				data.total > 0 ? Math.round((data.hits / data.total) * 10000) / 100 : 0,
			avgReturn:
				data.returns.length > 0
					? Math.round(
							(data.returns.reduce((a, b) => a + b, 0) / data.returns.length) *
								100,
						) / 100
					: 0,
		}));
	}

	async getMetricsByAssetType(): Promise<AssetTypeMetrics[]> {
		const recommendations = await db.select().from(aiRecommendationTracking);

		const assetMap = new Map<
			string,
			{ total: number; hits: number; returns: number[] }
		>();

		for (const rec of recommendations) {
			const assetType = rec.assetType;
			if (!assetMap.has(assetType)) {
				assetMap.set(assetType, { total: 0, hits: 0, returns: [] });
			}
			const data = assetMap.get(assetType)!;
			data.total++;
			if (rec.status === "hit_target") data.hits++;
			if (rec.actualReturn)
				data.returns.push(Number.parseFloat(rec.actualReturn));
		}

		return Array.from(assetMap.entries()).map(([assetType, data]) => ({
			assetType,
			total: data.total,
			successRate:
				data.total > 0 ? Math.round((data.hits / data.total) * 10000) / 100 : 0,
			avgReturn:
				data.returns.length > 0
					? Math.round(
							(data.returns.reduce((a, b) => a + b, 0) / data.returns.length) *
								100,
						) / 100
					: 0,
		}));
	}

	async getTrendData(days: number = 30): Promise<TrendDataPoint[]> {
		const startDate = new Date();
		startDate.setDate(startDate.getDate() - days);

		const recommendations = await db
			.select()
			.from(aiRecommendationTracking)
			.where(gte(aiRecommendationTracking.createdAt, startDate))
			.orderBy(aiRecommendationTracking.createdAt);

		const dateMap = new Map<string, { total: number; hits: number }>();

		for (const rec of recommendations) {
			const date = rec.createdAt?.toISOString().split("T")[0] || "";
			if (!dateMap.has(date)) {
				dateMap.set(date, { total: 0, hits: 0 });
			}
			const data = dateMap.get(date)!;
			data.total++;
			if (rec.status === "hit_target") data.hits++;
		}

		return Array.from(dateMap.entries())
			.map(([date, data]) => ({
				date,
				successRate:
					data.total > 0
						? Math.round((data.hits / data.total) * 10000) / 100
						: 0,
				totalRecommendations: data.total,
			}))
			.sort((a, b) => a.date.localeCompare(b.date));
	}

	async getTopPerformingRecommendations(
		limit: number = 10,
	): Promise<AiRecommendationTracking[]> {
		return db
			.select()
			.from(aiRecommendationTracking)
			.where(eq(aiRecommendationTracking.status, "hit_target"))
			.orderBy(
				desc(sql`CAST(${aiRecommendationTracking.actualReturn} AS DECIMAL)`),
			)
			.limit(limit);
	}

	async getWorstPerformingRecommendations(
		limit: number = 10,
	): Promise<AiRecommendationTracking[]> {
		return db
			.select()
			.from(aiRecommendationTracking)
			.where(
				sql`${aiRecommendationTracking.status} IN ('missed_target', 'stopped_out')`,
			)
			.orderBy(sql`CAST(${aiRecommendationTracking.actualReturn} AS DECIMAL)`)
			.limit(limit);
	}

	async checkAndUpdateExpiredRecommendations(): Promise<number> {
		const now = new Date();
		const expired = await db
			.select()
			.from(aiRecommendationTracking)
			.where(
				and(
					eq(aiRecommendationTracking.status, "pending"),
					lte(aiRecommendationTracking.expiryDate, now),
				),
			);

		let count = 0;
		for (const rec of expired) {
			const currentPrice = rec.currentPrice
				? Number.parseFloat(rec.currentPrice)
				: Number.parseFloat(rec.entryPrice);
			await this.resolveRecommendation(
				rec.id,
				"expired",
				currentPrice,
				"Expired without hitting target",
			);
			count++;
		}

		return count;
	}

	async deleteRecommendation(id: string): Promise<boolean> {
		const result = await db
			.delete(aiRecommendationTracking)
			.where(eq(aiRecommendationTracking.id, id));
		return true;
	}
}

export const aiRecommendationTrackingService =
	new AiRecommendationTrackingService();
