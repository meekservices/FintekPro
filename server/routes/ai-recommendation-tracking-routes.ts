/* eslint-disable no-console */
import { Router, Request, Response } from "express";
import { db } from "../db";
import { aiRecommendationTracking } from "../../shared/schema";
import { aiRecommendationTrackingService } from "../services/ai-recommendation-tracking-service";
import { insertAiRecommendationTrackingSchema } from "../../shared/schema";
import { z } from "zod";
import { eq, desc, and, sql } from "drizzle-orm";
import { wrapAdvisoryResponse } from "../utils/fasp-ai-response";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
	try {
		const validatedData = insertAiRecommendationTrackingSchema.parse(req.body);
		const recommendation =
			await aiRecommendationTrackingService.recordRecommendation(validatedData);
		res.status(201).json(recommendation);
	} catch (error) {
		if (error instanceof z.ZodError) {
			res
				.status(400)
				.json({ error: "Validation error", details: error.issues });
		} else {
			console.error("Error recording recommendation:", error);
			res.status(500).json({ error: "Failed to record recommendation" });
		}
	}
});

router.get("/", async (req: Request, res: Response) => {
	try {
		const { status, assetType, sector, source } = req.query;
		const page = Math.max(1, parseInt(req.query.page as string) || 1);
		const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
		const offset = (page - 1) * limit;

		const conditions = [];
		if (status) conditions.push(eq(aiRecommendationTracking.status, status as string));
		if (assetType) conditions.push(eq(aiRecommendationTracking.assetType, assetType as string));
		if (sector) conditions.push(eq(aiRecommendationTracking.sector, sector as string));
		if (source) conditions.push(eq(aiRecommendationTracking.source, source as string));
		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const [items, [{ count }]] = await Promise.all([
			db.select().from(aiRecommendationTracking).where(whereClause).orderBy(desc(aiRecommendationTracking.createdAt)).limit(limit).offset(offset),
			db.select({ count: sql<number>`count(*)` }).from(aiRecommendationTracking).where(whereClause),
		]);

		res.json({
			success: true,
			data: items.map((r) => wrapAdvisoryResponse(r)),
			meta: {
				page,
				limit,
				total: Number(count),
				totalPages: Math.ceil(Number(count) / limit),
				timestamp: new Date().toISOString(),
				version: "1.0",
			},
		});
	} catch (error) {
		console.error("Error fetching recommendations:", error);
		res.status(500).json({ error: "Failed to fetch recommendations" });
	}
});

router.get("/pending", async (req: Request, res: Response) => {
	try {
		const page = Math.max(1, parseInt(req.query.page as string) || 1);
		const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
		const offset = (page - 1) * limit;
		const whereClause = eq(aiRecommendationTracking.status, "pending");

		const [items, [{ count }]] = await Promise.all([
			db.select().from(aiRecommendationTracking).where(whereClause).orderBy(aiRecommendationTracking.expiryDate).limit(limit).offset(offset),
			db.select({ count: sql<number>`count(*)` }).from(aiRecommendationTracking).where(whereClause),
		]);

		res.json({
			success: true,
			data: items.map((r) => wrapAdvisoryResponse(r)),
			meta: {
				page,
				limit,
				total: Number(count),
				totalPages: Math.ceil(Number(count) / limit),
				timestamp: new Date().toISOString(),
				version: "1.0",
			},
		});
	} catch (error) {
		console.error("Error fetching pending recommendations:", error);
		res.status(500).json({ error: "Failed to fetch pending recommendations" });
	}
});

router.get("/metrics", async (req: Request, res: Response) => {
	try {
		const { dateFrom, dateTo } = req.query;
		const metrics = await aiRecommendationTrackingService.getSuccessMetrics(
			dateFrom ? new Date(dateFrom as string) : undefined,
			dateTo ? new Date(dateTo as string) : undefined,
		);
		res.json(metrics);
	} catch (error) {
		console.error("Error fetching metrics:", error);
		res.status(500).json({ error: "Failed to fetch metrics" });
	}
});

router.get("/metrics/sector", async (req: Request, res: Response) => {
	try {
		const metrics = await aiRecommendationTrackingService.getMetricsBySector();
		res.json(metrics);
	} catch (error) {
		console.error("Error fetching sector metrics:", error);
		res.status(500).json({ error: "Failed to fetch sector metrics" });
	}
});

router.get("/metrics/timeframe", async (req: Request, res: Response) => {
	try {
		const metrics =
			await aiRecommendationTrackingService.getMetricsByTimeframe();
		res.json(metrics);
	} catch (error) {
		console.error("Error fetching timeframe metrics:", error);
		res.status(500).json({ error: "Failed to fetch timeframe metrics" });
	}
});

router.get("/metrics/asset-type", async (req: Request, res: Response) => {
	try {
		const metrics =
			await aiRecommendationTrackingService.getMetricsByAssetType();
		res.json(metrics);
	} catch (error) {
		console.error("Error fetching asset type metrics:", error);
		res.status(500).json({ error: "Failed to fetch asset type metrics" });
	}
});

router.get("/trends", async (req: Request, res: Response) => {
	try {
		const days = req.query.days
			? Number.parseInt(req.query.days as string)
			: 30;
		const trends = await aiRecommendationTrackingService.getTrendData(days);
		res.json(trends);
	} catch (error) {
		console.error("Error fetching trends:", error);
		res.status(500).json({ error: "Failed to fetch trends" });
	}
});

router.get("/top-performing", async (req: Request, res: Response) => {
	try {
		const limit = req.query.limit
			? Number.parseInt(req.query.limit as string)
			: 10;
		const recommendations =
			await aiRecommendationTrackingService.getTopPerformingRecommendations(
				limit,
			);
		res.json(wrapAdvisoryResponse(recommendations));
	} catch (error) {
		console.error("Error fetching top performing:", error);
		res
			.status(500)
			.json({ error: "Failed to fetch top performing recommendations" });
	}
});

router.get("/worst-performing", async (req: Request, res: Response) => {
	try {
		const limit = req.query.limit
			? Number.parseInt(req.query.limit as string)
			: 10;
		const recommendations =
			await aiRecommendationTrackingService.getWorstPerformingRecommendations(
				limit,
			);
		res.json(wrapAdvisoryResponse(recommendations));
	} catch (error) {
		console.error("Error fetching worst performing:", error);
		res
			.status(500)
			.json({ error: "Failed to fetch worst performing recommendations" });
	}
});

router.get("/:id", async (req: Request, res: Response) => {
	try {
		const recommendation =
			await aiRecommendationTrackingService.getRecommendation(req.params.id);
		if (!recommendation) {
			return res.status(404).json({ error: "Recommendation not found" });
		}
		res.json(wrapAdvisoryResponse(recommendation));
	} catch (error) {
		console.error("Error fetching recommendation:", error);
		res.status(500).json({ error: "Failed to fetch recommendation" });
	}
});

router.patch("/:id/price", async (req: Request, res: Response) => {
	try {
		const { currentPrice, highestPrice, lowestPrice } = req.body;
		await aiRecommendationTrackingService.updateRecommendationPrice(
			req.params.id,
			Number.parseFloat(currentPrice),
			highestPrice ? Number.parseFloat(highestPrice) : undefined,
			lowestPrice ? Number.parseFloat(lowestPrice) : undefined,
		);
		res.json({ success: true });
	} catch (error) {
		console.error("Error updating price:", error);
		res.status(500).json({ error: "Failed to update price" });
	}
});

router.patch("/:id/resolve", async (req: Request, res: Response) => {
	try {
		const { status, currentPrice, note } = req.body;
		const recommendation =
			await aiRecommendationTrackingService.resolveRecommendation(
				req.params.id,
				status,
				Number.parseFloat(currentPrice),
				note,
			);
		if (!recommendation) {
			return res.status(404).json({ error: "Recommendation not found" });
		}
		res.json(wrapAdvisoryResponse(recommendation));
	} catch (error) {
		console.error("Error resolving recommendation:", error);
		res.status(500).json({ error: "Failed to resolve recommendation" });
	}
});

router.post("/check-expired", async (req: Request, res: Response) => {
	try {
		const count =
			await aiRecommendationTrackingService.checkAndUpdateExpiredRecommendations();
		res.json({ expiredCount: count });
	} catch (error) {
		console.error("Error checking expired:", error);
		res.status(500).json({ error: "Failed to check expired recommendations" });
	}
});

router.delete("/:id", async (req: Request, res: Response) => {
	try {
		await aiRecommendationTrackingService.deleteRecommendation(req.params.id);
		res.json({ success: true });
	} catch (error) {
		console.error("Error deleting recommendation:", error);
		res.status(500).json({ error: "Failed to delete recommendation" });
	}
});

export default router;
