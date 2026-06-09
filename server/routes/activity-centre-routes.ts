import { Router, Request, Response } from "express";
import { activityInsightsService } from "../services/activity-insights-service";
import { requestLatencyTracker } from "../services/request-latency-tracker";

const router = Router();

router.get("/metrics", async (_req: Request, res: Response): Promise<void> => {
	try {
		const metrics = await activityInsightsService.getActivityMetrics();
		res.json({ success: true, metrics });
	} catch (error) {
		console.error("[ActivityCentre] Error fetching metrics:", error);
		res
			.status(500)
			.json({ success: false, message: "Failed to fetch metrics" });
	}
});

router.get("/insights", async (_req: Request, res: Response): Promise<void> => {
	try {
		const cached = activityInsightsService.getCachedInsights();
		const lastAnalysis = activityInsightsService.getLastAnalysisTime();

		const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
		const needsRefresh = !lastAnalysis || lastAnalysis < fiveMinutesAgo;

		if (needsRefresh || cached.length === 0) {
			const metrics = await activityInsightsService.getActivityMetrics();
			const insights =
				await activityInsightsService.generateAIInsights(metrics);
			res.json({
				success: true,
				insights,
				lastAnalysis: activityInsightsService.getLastAnalysisTime(),
				fromCache: false,
			});
		} else {
			res.json({
				success: true,
				insights: cached,
				lastAnalysis,
				fromCache: true,
			});
		}
	} catch (error) {
		console.error("[ActivityCentre] Error generating insights:", error);
		res
			.status(500)
			.json({ success: false, message: "Failed to generate insights" });
	}
});

router.post(
	"/insights/refresh",
	async (_req: Request, res: Response): Promise<void> => {
		try {
			const metrics = await activityInsightsService.getActivityMetrics();
			const insights =
				await activityInsightsService.generateAIInsights(metrics);
			res.json({
				success: true,
				insights,
				lastAnalysis: activityInsightsService.getLastAnalysisTime(),
			});
		} catch (error) {
			console.error("[ActivityCentre] Error refreshing insights:", error);
			res
				.status(500)
				.json({ success: false, message: "Failed to refresh insights" });
		}
	},
);

router.get("/activity", async (req: Request, res: Response): Promise<void> => {
	try {
		const limit = Number.parseInt(req.query.limit as string) || 50;
		const activity = await activityInsightsService.getRecentActivity(limit);
		res.json({ success: true, activity });
	} catch (error) {
		console.error("[ActivityCentre] Error fetching activity:", error);
		res
			.status(500)
			.json({ success: false, message: "Failed to fetch activity" });
	}
});

router.get(
	"/security-alerts",
	async (_req: Request, res: Response): Promise<void> => {
		try {
			const alerts = await activityInsightsService.getSecurityAlerts();
			res.json({ success: true, alerts });
		} catch (error) {
			console.error("[ActivityCentre] Error fetching security alerts:", error);
			res
				.status(500)
				.json({ success: false, message: "Failed to fetch security alerts" });
		}
	},
);

router.get("/latency", async (_req: Request, res: Response): Promise<void> => {
	try {
		const metrics = requestLatencyTracker.getMetrics();
		const slowEndpoints = requestLatencyTracker.getSlowEndpoints();
		res.json({ success: true, metrics, slowEndpoints });
	} catch (error) {
		console.error("[ActivityCentre] Error fetching latency metrics:", error);
		res
			.status(500)
			.json({ success: false, message: "Failed to fetch latency metrics" });
	}
});

router.get(
	"/kyc/stuck-users",
	async (_req: Request, res: Response): Promise<void> => {
		try {
			const users = await activityInsightsService.getStuckKycUsers();
			res.json({ success: true, users });
		} catch (error) {
			console.error("[ActivityCentre] Error fetching stuck KYC users:", error);
			res
				.status(500)
				.json({ success: false, message: "Failed to fetch stuck KYC users" });
		}
	},
);

export default router;
