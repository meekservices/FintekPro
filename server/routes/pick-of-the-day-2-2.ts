import { Router, Request, Response, NextFunction } from "express";
import {
	pickOfTheDayService,
	PickCategory,
} from "../services/pick-of-the-day-service";
import { db } from "../db";
import {
	dailyPicks,
	listedStocks,
	mutualFunds,
	bondCatalog,
	unlistedCompanies,
	globalInstruments,
	instrumentMaster,
	sgbPrimaryIssues,
	pickWatchlist,
	pickPriceAlerts,
	investmentProposals,
	investmentProposalItems,
	userNotifications,
} from "@shared/schema";
import { eq, like, or, sql, desc, and, count } from "drizzle-orm";
import nodemailer from "nodemailer";
import { z } from "zod";
import { requireAuth, requireAdmin } from "../middleware/roleMiddleware";
import { REGULATORY_DISCLAIMER } from "./pick-of-the-day-utils";
import { logger } from "../logger";

const watchlistAddSchema = z.object({
	pickId: z.number(),
	notes: z.string().optional(),
	priceAlertEnabled: z.boolean().optional(),
	alertThreshold: z.number().optional(),
	alertType: z
		.enum(["above", "below", "target_hit", "stoploss_hit"])
		.optional(),
});

const proposalAddSchema = z.object({
	pickId: z.number(),
	proposalId: z.string().optional(),
	amount: z.number().optional(),
	notes: z.string().optional(),
});

const shareSchema = z.object({
	pickId: z.number(),
	channel: z.enum(["email", "whatsapp"]),
	recipientEmail: z.string().email().optional(),
	recipientPhone: z.string().optional(),
	customMessage: z.string().optional(),
});

const alertUpdateSchema = z.object({
	priceAlertEnabled: z.boolean().optional(),
	alertThreshold: z.number().optional(),
	alertType: z
		.enum(["above", "below", "target_hit", "stoploss_hit"])
		.optional(),
});

const router = Router();

// --- Core Routes ---

router.get("/", requireAuth, async (req, res) => {
	try {
		const { category, sync } = req.query;
		let query = db.select().from(dailyPicks);

		if (category) {
			query = query.where(eq(dailyPicks.category, category as any)) as any;
		}

		const picks = await query.orderBy(desc(dailyPicks.recoDate));

		// Optional sync if requested (e.g. from admin or specialized trigger)
		if (sync === "true") {
			await pickOfTheDayService.refreshLivePicks();
		}

		// ── Normalize picks before sending to client ────────────────────────────
		// Guards against:
		//   • confidenceScore stored as raw quant score (e.g. 8600) instead of 0–100
		//     This happens when legacy/admin-created picks bypass getConfidenceScore()
		//   • timeHorizon = NULL on picks created before the column was added
		const VALID_HORIZONS = new Set(["short_term", "medium_term", "long_term"]);
		const normalizedPicks = picks.map((p) => {
			// Clamp confidenceScore to 0–100. If value > 100 treat as raw integer
			// score that was never converted (e.g. 8600 → 86, 7000 → 70).
			const rawScore = Number(p.confidenceScore ?? 70);
			const confidenceScore = rawScore > 100
				? Math.min(100, Math.round(rawScore / 100))
				: Math.min(100, Math.max(0, rawScore));

			// Normalise horizon: NULL or unrecognised values → "medium_term"
			const timeHorizon = VALID_HORIZONS.has(p.timeHorizon ?? "")
				? p.timeHorizon
				: "medium_term";

			return { ...p, confidenceScore, timeHorizon };
		});

		res.json({
			success: true,
			picks: normalizedPicks,
			disclaimer: REGULATORY_DISCLAIMER,
		});
	} catch (error) {
		logger.error("[PicksAPI] Error fetching picks:", error instanceof Error ? error : new Error(String(error)));
		res.status(500).json({ success: false, error: "Failed to fetch picks" });
	}
});


router.post("/generate", requireAdmin, async (req, res) => {
	try {
		const picks = await pickOfTheDayService.generateDailyPicks();
		res.json({
			success: true,
			message: `Generated ${picks.length} new picks`,
			picks,
		});
	} catch (error) {
		console.error("[API] Error generating picks:", error);
		res.status(500).json({ success: false, error: "Failed to generate picks" });
	}
});

router.get("/stats/enhanced", requireAuth, async (req, res) => {
	try {
		const overallResult = await db.execute(sql`
      SELECT
        COUNT(*) as total_picks,
        COUNT(*) FILTER (WHERE status = 'live') as live_picks,
        COUNT(*) FILTER (WHERE status IN ('target_hit','stoploss_hit','expired')) as completed_picks,
        COUNT(*) FILTER (WHERE status = 'target_hit') as target_hits,
        COUNT(*) FILTER (WHERE status = 'stoploss_hit') as stoploss_hits,
        COALESCE(AVG(return_pct::numeric) FILTER (WHERE status IN ('target_hit','stoploss_hit','expired')), 0) as avg_return,
        COALESCE(AVG(days_held) FILTER (WHERE status IN ('target_hit','stoploss_hit','expired')), 0) as avg_days_held
      FROM daily_picks
    `);

		const r =
			(overallResult as any).rows?.[0] || (overallResult as any)[0] || {};
		const completedCount = Number.parseInt(r.completed_picks || "0");
		const targetHitsCount = Number.parseInt(r.target_hits || "0");
		const hitRate =
			completedCount > 0 ? (targetHitsCount / completedCount) * 100 : 0;

		const catResult = await db.execute(sql`
      SELECT
        category,
        COUNT(*) FILTER (WHERE status IN ('target_hit','stoploss_hit','expired')) as total,
        COUNT(*) FILTER (WHERE status = 'target_hit') as target_hits,
        COUNT(*) FILTER (WHERE status = 'stoploss_hit') as stoploss_hits,
        COALESCE(AVG(return_pct::numeric) FILTER (WHERE status IN ('target_hit','stoploss_hit','expired')), 0) as avg_return
      FROM daily_picks
      GROUP BY category
    `);

		const categoryStats: Record<string, any> = {};
		for (const cr of (catResult as any).rows || catResult) {
			const total = Number.parseInt(cr.total || "0");
			const th = Number.parseInt(cr.target_hits || "0");
			categoryStats[cr.category] = {
				total,
				targetHits: th,
				stoplossHits: Number.parseInt(cr.stoploss_hits || "0"),
				avgReturn:
					Math.round(Number.parseFloat(cr.avg_return || "0") * 100) / 100,
				hitRate: total > 0 ? Math.round((th / total) * 100 * 100) / 100 : 0,
			};
		}

		const monthResult = await db.execute(sql`
      SELECT
        SUBSTRING(reco_date, 1, 7) as month,
        COUNT(*) as picks,
        COUNT(*) FILTER (WHERE status = 'target_hit') as hits,
        COALESCE(AVG(return_pct::numeric), 0) as avg_return
      FROM daily_picks
      WHERE status IN ('target_hit','stoploss_hit','expired')
      GROUP BY SUBSTRING(reco_date, 1, 7)
      ORDER BY month
    `);

		const monthlyPerformance: Record<string, any> = {};
		for (const mr of (monthResult as any).rows || monthResult) {
			const picks = Number.parseInt(mr.picks || "0");
			monthlyPerformance[mr.month] = {
				picks,
				hitRate:
					picks > 0
						? Math.round(
								(Number.parseInt(mr.hits || "0") / picks) * 100 * 100,
							) / 100
						: 0,
				avgReturn:
					Math.round(Number.parseFloat(mr.avg_return || "0") * 100) / 100,
			};
		}

		const confResult = await db.execute(sql`
      SELECT
        (COALESCE(confidence_score, 70) / 10) * 10 as bucket,
        COUNT(*) as predictions,
        COUNT(*) FILTER (WHERE status = 'target_hit') as correct
      FROM daily_picks
      WHERE status IN ('target_hit','stoploss_hit','expired')
      GROUP BY bucket
      ORDER BY bucket
    `);

		const confidenceAccuracy: Record<
			number,
			{ predictions: number; correct: number }
		> = {};
		for (const cr of (confResult as any).rows || confResult) {
			confidenceAccuracy[Number.parseInt(cr.bucket)] = {
				predictions: Number.parseInt(cr.predictions || "0"),
				correct: Number.parseInt(cr.correct || "0"),
			};
		}

		res.json({
			success: true,
			stats: {
				overall: {
					totalPicks: Number.parseInt(r.total_picks || "0"),
					livePicks: Number.parseInt(r.live_picks || "0"),
					completedPicks: completedCount,
					targetHits: targetHitsCount,
					stoplossHits: Number.parseInt(r.stoploss_hits || "0"),
					hitRate: Math.round(hitRate * 100) / 100,
					avgReturn:
						Math.round(Number.parseFloat(r.avg_return || "0") * 100) / 100,
					avgDaysHeld: Math.round(Number.parseFloat(r.avg_days_held || "0")),
				},
				byCategory: categoryStats,
				monthlyTrend: monthlyPerformance,
				confidenceCalibration: confidenceAccuracy,
			},
		});
	} catch (error) {
		console.error("[API] Error fetching enhanced stats:", error);
		res
			.status(500)
			.json({ success: false, error: "Failed to fetch enhanced stats" });
	}
});

// ==========================================
// ADD TO PROPOSAL INTEGRATION
// ==========================================

router.post("/add-to-proposal", requireAuth, async (req, res) => {
	try {
		const parseResult = proposalAddSchema.safeParse(req.body);
		if (!parseResult.success) {
			return res
				.status(400)
				.json({
					success: false,
					error: "Invalid request",
					details: parseResult.error.issues,
				});
		}

		const userId = (req as any).user.id;
		const { pickId, proposalId, amount, notes } = parseResult.data;

		const [pick] = await db
			.select()
			.from(dailyPicks)
			.where(eq(dailyPicks.id, pickId));
		if (!pick) {
			return res.status(404).json({ success: false, error: "Pick not found" });
		}

		let targetProposalId = proposalId;

		if (targetProposalId) {
			const [existingProposal] = await db
				.select()
				.from(investmentProposals)
				.where(eq(investmentProposals.id, targetProposalId));

			if (!existingProposal) {
				return res
					.status(404)
					.json({ success: false, error: "Proposal not found" });
			}

			if (
				existingProposal.agentId !== userId &&
				existingProposal.clientId !== userId
			) {
				return res
					.status(403)
					.json({
						success: false,
						error: "You do not have access to this proposal",
					});
			}
		} else {
			const existingDraft = await db
				.select()
				.from(investmentProposals)
				.where(
					and(
						eq(investmentProposals.agentId, userId),
						eq(investmentProposals.status, "pending"),
					),
				)
				.limit(1);

			if (existingDraft.length > 0) {
				targetProposalId = existingDraft[0].id;
			} else {
				const newId = `PICK-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
				const [newProposal] = await db
					.insert(investmentProposals)
					.values({
						id: newId,
						clientId: userId,
						agentId: userId,
						proposalSource: "agent",
						title: "Pick of the Day Proposal",
						description: "Investment proposal based on recommended picks",
						recommendations: [],
						totalInvestmentAmount: "0",
						status: "pending",
					})
					.returning();
				targetProposalId = newProposal.id;
			}
		}

		const productType = getProductTypeFromCategory(pick.category);
		const productCode =
			pick.isin || pick.symbol || pick.instrumentId || pick.id.toString();

		const itemId = `ITEM-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

		const [proposalItem] = await db
			.insert(investmentProposalItems)
			.values({
				id: itemId,
				proposalId: targetProposalId,
				productType,
				productCode,
				productName: pick.instrumentName,
				category: pick.category,
				recommendedAmount: amount?.toString() || "10000",
				allocationPercentage: "0",
				selectionReason: pick.rationale,
				expectedOutcome: `Target: ${pick.targetPrice}, Stoploss: ${pick.stoplossPrice}`,
			})
			.returning();

		res.json({
			success: true,
			message: "Pick added to proposal",
			proposalId: targetProposalId,
			proposalItem,
		});
	} catch (error) {
		console.error("[API] Error adding pick to proposal:", error);
		res
			.status(500)
			.json({ success: false, error: "Failed to add to proposal" });
	}
});

function getProductTypeFromCategory(category: string): string {
	const mapping: Record<string, string> = {
		listed_stocks: "equity",
		mutual_funds: "mutual_fund",
		bonds: "bond",
		global_stocks: "global_equity",
		etfs: "etf",
		sgb: "sgb",
		unlisted: "unlisted_equity",
		reits_invits: "reit_invit",
		fixed_deposits: "fixed_deposit",
	};
	return mapping[category] || "other";
}

// ==========================================
// SHARE FUNCTIONALITY (Email/WhatsApp)
// ==========================================

router.post("/share", requireAuth, async (req, res) => {
	try {
		const parseResult = shareSchema.safeParse(req.body);
		if (!parseResult.success) {
			return res
				.status(400)
				.json({
					success: false,
					error: "Invalid request",
					details: parseResult.error.issues,
				});
		}

		const { pickId, channel, recipientEmail, recipientPhone, customMessage } =
			parseResult.data;
		const user = (req as any).user;

		const [pick] = await db
			.select()
			.from(dailyPicks)
			.where(eq(dailyPicks.id, pickId));
		if (!pick) {
			return res.status(404).json({ success: false, error: "Pick not found" });
		}

		const shareMessage = generateShareMessage(
			pick,
			customMessage,
			user.name || user.email,
		);

		if (channel === "email" && recipientEmail) {
			await sendEmailShare(recipientEmail, pick, shareMessage);
			res.json({ success: true, message: "Pick shared via email" });
		} else if (channel === "whatsapp") {
			const whatsappUrl = recipientPhone
				? generateWhatsAppLink(recipientPhone, shareMessage)
				: `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
			res.json({
				success: true,
				message: "WhatsApp share link generated",
				whatsappUrl,
			});
		} else if (channel === "email" && !recipientEmail) {
			res
				.status(400)
				.json({ success: false, error: "Email address is required" });
		} else {
			res.status(400).json({ success: false, error: "Invalid channel" });
		}
	} catch (error) {
		console.error("[API] Error sharing pick:", error);
		res.status(500).json({ success: false, error: "Failed to share pick" });
	}
});

function generateShareMessage(
	pick: any,
	customMessage: string | undefined,
	agentName: string,
): string {
	const returnPotential = (
		((Number.parseFloat(pick.targetPrice) - Number.parseFloat(pick.recoPrice)) /
			Number.parseFloat(pick.recoPrice)) *
		100
	).toFixed(1);

	let message = `🎯 Investment Recommendation from ${agentName}\n\n`;
	message += `📈 ${pick.instrumentName}\n`;
	message += `Category: ${pick.category.replace("_", " ").toUpperCase()}\n`;
	message += `Current Price: ₹${Number.parseFloat(pick.currentPrice || pick.recoPrice).toLocaleString()}\n`;
	message += `Target Price: ₹${Number.parseFloat(pick.targetPrice).toLocaleString()} (+${returnPotential}%)\n`;
	message += `Stop Loss: ₹${Number.parseFloat(pick.stoplossPrice).toLocaleString()}\n`;
	message += `Risk Level: ${pick.riskLevel || "Medium"}\n`;
	message += `Time Horizon: ${(pick.timeHorizon || "medium_term").replace("_", " ")}\n\n`;
	message += `📝 ${pick.rationale.substring(0, 200)}...\n\n`;

	if (customMessage) {
		message += `💬 Personal Note: ${customMessage}\n\n`;
	}

	message += `⚠️ Disclaimer: This is not investment advice. Please consult a SEBI-registered advisor before investing.`;

	return message;
}

async function sendEmailShare(
	recipientEmail: string,
	pick: any,
	message: string,
): Promise<void> {
	const transporter = nodemailer.createTransport({
		service: "gmail",
		auth: {
			user: process.env.EMAIL_USER || process.env.GMAIL_USER,
			pass: process.env.EMAIL_PASS || process.env.GMAIL_PASS,
		},
	});

	await transporter.sendMail({
		from: process.env.EMAIL_USER || process.env.GMAIL_USER,
		to: recipientEmail,
		subject: `Investment Recommendation: ${pick.instrumentName}`,
		text: message,
		html: `<pre style="font-family: Arial, sans-serif; white-space: pre-wrap;">${message}</pre>`,
	});
}

function generateWhatsAppLink(phone: string, message: string): string {
	const cleanPhone = phone.replace(/\D/g, "");
	const encodedMessage = encodeURIComponent(message);
	return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}

// ==========================================
// CLIENT SUITABILITY MATCHING
// ==========================================

router.get("/:id/suitability", requireAuth, async (req, res) => {
	try {
		const pickId = Number.parseInt(req.params.id);
		const {
			clientRiskProfile,
			investmentGoal,
			timeHorizon: clientTimeHorizon,
		} = req.query;

		const [pick] = await db
			.select()
			.from(dailyPicks)
			.where(eq(dailyPicks.id, pickId));
		if (!pick) {
			return res.status(404).json({ success: false, error: "Pick not found" });
		}

		const suitabilityScore = calculateSuitabilityScore(pick, {
			riskProfile: clientRiskProfile as string,
			investmentGoal: investmentGoal as string,
			timeHorizon: clientTimeHorizon as string,
		});

		res.json({
			success: true,
			pickId,
			suitability: {
				score: suitabilityScore.overall,
				riskMatch: suitabilityScore.riskMatch,
				timeHorizonMatch: suitabilityScore.timeHorizonMatch,
				goalAlignment: suitabilityScore.goalAlignment,
				recommendation: suitabilityScore.recommendation,
				warnings: suitabilityScore.warnings,
			},
		});
	} catch (error) {
		console.error("[API] Error calculating suitability:", error);
		res
			.status(500)
			.json({ success: false, error: "Failed to calculate suitability" });
	}
});

function calculateSuitabilityScore(
	pick: any,
	clientProfile: {
		riskProfile?: string;
		investmentGoal?: string;
		timeHorizon?: string;
	},
): {
	overall: number;
	riskMatch: number;
	timeHorizonMatch: number;
	goalAlignment: number;
	recommendation: string;
	warnings: string[];
} {
	const warnings: string[] = [];
	let riskMatch = 70;
	let timeHorizonMatch = 70;
	let goalAlignment = 70;

	const pickRisk = pick.riskLevel || "medium";
	const clientRisk = clientProfile.riskProfile || "moderate";

	const riskMap: Record<string, number> = {
		low: 1,
		medium: 2,
		high: 3,
		conservative: 1,
		moderate: 2,
		aggressive: 3,
	};
	const pickRiskLevel = riskMap[pickRisk.toLowerCase()] || 2;
	const clientRiskLevel = riskMap[clientRisk.toLowerCase()] || 2;

	if (pickRiskLevel === clientRiskLevel) {
		riskMatch = 100;
	} else if (Math.abs(pickRiskLevel - clientRiskLevel) === 1) {
		riskMatch = 70;
	} else {
		riskMatch = 40;
		warnings.push(
			`Risk mismatch: Pick is ${pickRisk} risk but client prefers ${clientRisk}`,
		);
	}

	const pickHorizon = pick.timeHorizon || "medium_term";
	const clientHorizon = clientProfile.timeHorizon || "medium_term";

	if (pickHorizon === clientHorizon) {
		timeHorizonMatch = 100;
	} else if (
		(pickHorizon.includes("short") && clientHorizon.includes("medium")) ||
		(pickHorizon.includes("medium") && clientHorizon.includes("long"))
	) {
		timeHorizonMatch = 75;
	} else {
		timeHorizonMatch = 50;
		warnings.push(
			`Time horizon mismatch: Pick is ${pickHorizon.replace("_", " ")} but client prefers ${clientHorizon.replace("_", " ")}`,
		);
	}

	const goal = clientProfile.investmentGoal?.toLowerCase() || "growth";
	const category = pick.category;

	if (
		goal === "income" &&
		["bonds", "sgb", "fixed_deposits", "reits_invits"].includes(category)
	) {
		goalAlignment = 100;
	} else if (
		goal === "growth" &&
		["listed_stocks", "mutual_funds", "etfs", "global_stocks"].includes(
			category,
		)
	) {
		goalAlignment = 100;
	} else if (
		goal === "speculation" &&
		["unlisted", "global_stocks"].includes(category)
	) {
		goalAlignment = 100;
	} else {
		goalAlignment = 60;
	}

	const overall = Math.round(
		riskMatch * 0.4 + timeHorizonMatch * 0.3 + goalAlignment * 0.3,
	);

	let recommendation: string;
	if (overall >= 80) {
		recommendation =
			"Highly Suitable - This pick aligns well with the client profile";
	} else if (overall >= 60) {
		recommendation = "Moderately Suitable - Consider with some adjustments";
	} else {
		recommendation =
			"Low Suitability - Significant profile mismatch, proceed with caution";
	}

	return {
		overall,
		riskMatch,
		timeHorizonMatch,
		goalAlignment,
		recommendation,
		warnings,
	};
}

// ==========================================
// PRICE REFRESH
// ==========================================

router.post("/refresh-prices", requireAdmin, async (req, res) => {
	try {
		console.log("[API] Triggering price refresh for live picks");
		const result = await pickOfTheDayService.refreshLivePicks();
		res.json({
			success: true,
			message: `Refreshed prices for ${result.updated} picks`,
			...result,
		});
	} catch (error) {
		console.error("[API] Error refreshing prices:", error);
		res.status(500).json({ success: false, error: "Failed to refresh prices" });
	}
});

// ==========================================
// PRICE ALERTS
// ==========================================

router.get("/alerts/history", requireAuth, async (req, res) => {
	try {
		const userId = (req as any).user.id;
		const limit = Number.parseInt(req.query.limit as string) || 50;

		const alerts = await db
			.select({
				alert: pickPriceAlerts,
				pick: dailyPicks,
			})
			.from(pickPriceAlerts)
			.innerJoin(dailyPicks, eq(pickPriceAlerts.pickId, dailyPicks.id))
			.where(eq(pickPriceAlerts.userId, userId))
			.orderBy(desc(pickPriceAlerts.createdAt))
			.limit(limit);

		res.json({ success: true, alerts });
	} catch (error) {
		console.error("[API] Error fetching alert history:", error);
		res
			.status(500)
			.json({ success: false, error: "Failed to fetch alert history" });
	}
});

export default router;
