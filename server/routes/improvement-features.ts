import { Router, Request, Response } from "express";
import { improvementFeaturesService } from "../services/improvement-features-service";
import { z } from "zod";

const router = Router();

const widgetUpdateSchema = z.object({
	widgets: z.array(
		z.object({
			id: z.string(),
			enabled: z.boolean(),
			position: z.number(),
			size: z.enum(["small", "medium", "large"]),
		}),
	),
});

const referralInviteSchema = z.object({
	email: z.string().email(),
	phone: z.string().optional(),
});

const scheduledReportSchema = z.object({
	reportType: z.string(),
	reportName: z.string(),
	frequency: z.enum(["daily", "weekly", "monthly", "quarterly"]),
	dayOfWeek: z.number().optional(),
	dayOfMonth: z.number().optional(),
	deliveryEmail: z.string().email(),
});

const compoundAlertSchema = z.object({
	name: z.string(),
	symbol: z.string(),
	conditions: z.array(
		z.object({
			type: z.string(),
			value: z.number(),
			unit: z.string().optional(),
			operator: z.string().optional(),
		}),
	),
	conditionLogic: z.enum(["AND", "OR"]).optional(),
	notifyEmail: z.boolean().optional(),
	notifySms: z.boolean().optional(),
	notifyPush: z.boolean().optional(),
});

const themePrefsSchema = z.object({
	themeMode: z.string().optional(),
	autoSwitchEnabled: z.boolean().optional(),
	lightModeStart: z.string().optional(),
	darkModeStart: z.string().optional(),
	reducedMotion: z.boolean().optional(),
	highContrast: z.boolean().optional(),
});

router.get("/dashboard/widgets", async (req: Request, res: Response) => {
	try {
		const userId = (req as any).user?.id;
		if (!userId) {
			return res.status(401).json({ error: "Authentication required" });
		}

		const widgets =
			await improvementFeaturesService.getDashboardWidgets(userId);
		res.json({ success: true, widgets });
	} catch (error) {
		console.error("Error getting dashboard widgets:", error);
		res.status(500).json({ error: "Failed to get widgets" });
	}
});

router.put("/dashboard/widgets", async (req: Request, res: Response) => {
	try {
		const userId = (req as any).user?.id;
		if (!userId) {
			return res.status(401).json({ error: "Authentication required" });
		}

		const { widgets } = widgetUpdateSchema.parse(req.body);
		const success = await improvementFeaturesService.updateDashboardWidgets(
			userId,
			widgets,
		);

		res.json({ success });
	} catch (error) {
		console.error("Error updating dashboard widgets:", error);
		res.status(500).json({ error: "Failed to update widgets" });
	}
});

router.get("/referral/code", async (req: Request, res: Response) => {
	try {
		const userId = (req as any).user?.id;
		if (!userId) {
			return res.status(401).json({ error: "Authentication required" });
		}

		const code = await improvementFeaturesService.getUserReferralCode(userId);
		res.json({ success: true, referralCode: code });
	} catch (error) {
		console.error("Error getting referral code:", error);
		res.status(500).json({ error: "Failed to get referral code" });
	}
});

router.get("/referral/stats", async (req: Request, res: Response) => {
	try {
		const userId = (req as any).user?.id;
		if (!userId) {
			return res.status(401).json({ error: "Authentication required" });
		}

		const stats = await improvementFeaturesService.getReferralStats(userId);
		res.json({ success: true, stats });
	} catch (error) {
		console.error("Error getting referral stats:", error);
		res.status(500).json({ error: "Failed to get referral stats" });
	}
});

router.post("/referral/invite", async (req: Request, res: Response) => {
	try {
		const userId = (req as any).user?.id;
		if (!userId) {
			return res.status(401).json({ error: "Authentication required" });
		}

		const { email, phone } = referralInviteSchema.parse(req.body);
		const result = await improvementFeaturesService.sendReferralInvite(
			userId,
			email,
			phone,
		);

		res.json(result);
	} catch (error) {
		console.error("Error sending referral invite:", error);
		res.status(500).json({ error: "Failed to send invite" });
	}
});

router.get("/reports/scheduled", async (req: Request, res: Response) => {
	try {
		const userId = (req as any).user?.id;
		if (!userId) {
			return res.status(401).json({ error: "Authentication required" });
		}

		const reports =
			await improvementFeaturesService.getScheduledReports(userId);
		res.json({ success: true, reports });
	} catch (error) {
		console.error("Error getting scheduled reports:", error);
		res.status(500).json({ error: "Failed to get reports" });
	}
});

router.post("/reports/scheduled", async (req: Request, res: Response) => {
	try {
		const userId = (req as any).user?.id;
		if (!userId) {
			return res.status(401).json({ error: "Authentication required" });
		}

		const data = scheduledReportSchema.parse(req.body);
		const result = await improvementFeaturesService.createScheduledReport(
			userId,
			data,
		);

		res.json(result);
	} catch (error) {
		console.error("Error creating scheduled report:", error);
		res.status(500).json({ error: "Failed to create report" });
	}
});

router.get("/alerts/compound", async (req: Request, res: Response) => {
	try {
		const userId = (req as any).user?.id;
		if (!userId) {
			return res.status(401).json({ error: "Authentication required" });
		}

		const alerts = await improvementFeaturesService.getCompoundAlerts(userId);
		res.json({ success: true, alerts });
	} catch (error) {
		console.error("Error getting compound alerts:", error);
		res.status(500).json({ error: "Failed to get alerts" });
	}
});

router.post("/alerts/compound", async (req: Request, res: Response) => {
	try {
		const userId = (req as any).user?.id;
		if (!userId) {
			return res.status(401).json({ error: "Authentication required" });
		}

		const data = compoundAlertSchema.parse(req.body);
		const result = await improvementFeaturesService.createCompoundAlert(
			userId,
			data,
		);

		res.json(result);
	} catch (error) {
		console.error("Error creating compound alert:", error);
		res.status(500).json({ error: "Failed to create alert" });
	}
});

router.get("/trending", async (req: Request, res: Response) => {
	try {
		const category = req.query.category as string | undefined;
		const investments =
			await improvementFeaturesService.getTrendingInvestments(category);
		res.json({ success: true, investments });
	} catch (error) {
		console.error("Error getting trending investments:", error);
		res.status(500).json({ error: "Failed to get trending" });
	}
});

router.get("/theme", async (req: Request, res: Response) => {
	try {
		const userId = (req as any).user?.id;
		if (!userId) {
			return res.json({
				success: true,
				preferences: {
					themeMode: "system",
					autoSwitchEnabled: false,
					lightModeStart: "07:00",
					darkModeStart: "19:00",
					reducedMotion: false,
					highContrast: false,
				},
			});
		}

		const preferences =
			await improvementFeaturesService.getThemePreferences(userId);
		res.json({ success: true, preferences });
	} catch (error) {
		console.error("Error getting theme preferences:", error);
		res.status(500).json({ error: "Failed to get theme" });
	}
});

router.put("/theme", async (req: Request, res: Response) => {
	try {
		const userId = (req as any).user?.id;
		if (!userId) {
			return res.status(401).json({ error: "Authentication required" });
		}

		const prefs = themePrefsSchema.parse(req.body);
		const success = await improvementFeaturesService.updateThemePreferences(
			userId,
			prefs,
		);

		res.json({ success });
	} catch (error) {
		console.error("Error updating theme preferences:", error);
		res.status(500).json({ error: "Failed to update theme" });
	}
});

router.get("/search", async (req: Request, res: Response) => {
	try {
		const query = req.query.q as string;
		const category = (req.query.category as string) || "all";

		if (!query || query.length < 3) {
			return res.json({
				success: true,
				results: {
					stocks: [],
					mutualFunds: [],
					bonds: [],
					goals: [],
					orders: [],
				},
			});
		}

		const userId = (req as any).user?.id;
		const results = await improvementFeaturesService.globalSearch(
			query,
			userId,
			category,
		);
		res.json({ success: true, results });
	} catch (error) {
		console.error("Error in global search:", error);
		res.status(500).json({ error: "Search failed" });
	}
});

export default router;
