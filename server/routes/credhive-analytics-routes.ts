/**
 * CredHive Analytics Routes
 *
 * Exposes company intelligence and lead scoring endpoints
 * powered by CredHive data (replaces former Probe42 analytics).
 */

import { Router, type Request, type Response } from "express";
import { getCredhiveAnalyticsService } from "../services/credhive-analytics-service";
import { requireAdmin } from "../middleware/roleMiddleware";

const router = Router();

/**
 * GET /api/admin/analytics/health
 * Basic health check for the analytics service.
 */
router.get("/health", requireAdmin, (_req: Request, res: Response) => {
	res.json({
		status: "ok",
		provider: "credhive",
		timestamp: new Date().toISOString(),
	});
});

/**
 * POST /api/admin/analytics/prospecting-alerts
 * Returns leads that meet financial thresholds for high-value prospecting.
 * Body: { minRevenue?: number, minProfit?: number, minLeadScore?: number }
 */
router.post(
	"/prospecting-alerts",
	requireAdmin,
	async (req: any, res: Response) => {
		try {
			const { minRevenue, minProfit, minLeadScore } = req.body ?? {};
			const service = getCredhiveAnalyticsService();
			const alerts = await service.checkProspectingThresholds({
				minRevenue,
				minProfit,
				minLeadScore,
			});
			res.json({ success: true, count: alerts.length, alerts });
		} catch (error: any) {
			console.error("[Analytics] prospecting-alerts error:", error.message);
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

/**
 * GET /api/admin/analytics/lead-score/:cin
 * Calculates a smart lead score for a company by CIN using CredHive.
 */
router.get(
	"/lead-score/:cin",
	requireAdmin,
	async (req: any, res: Response) => {
		try {
			const { cin } = req.params;
			const service = getCredhiveAnalyticsService();
			const score = await service.calculateSmartLeadScore(cin);
			if (!score) {
				return res
					.status(404)
					.json({ success: false, error: "Insufficient data for scoring" });
			}
			res.json({ success: true, score });
		} catch (error: any) {
			console.error("[Analytics] lead-score error:", error.message);
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

export default router;
