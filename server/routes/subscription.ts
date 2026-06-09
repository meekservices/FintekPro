import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
	PLANS,
	getPriceInr,
	getUserSubscription,
	getUserSubscriptionHistory,
	createCheckoutOrder,
	activateSubscription,
	markSubscriptionFailed,
	getRevenueStats,
	getEffectiveTier,
	getPlanConfig,
	type PlanTier,
	type BillingCycle,
} from "../services/subscription-service";
import { cashfreeService } from "../cashfree-service";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";
import { logger } from "../logger";

const router = Router();

// ── GET /api/subscriptions/plans ─────────────────────────────────────────────
// Public — returns the 3-tier plan catalogue
router.get("/plans", (_req, res) => {
	const catalogue = Object.values(PLANS).map((p) => ({
		tier: p.tier,
		name: p.name,
		tagline: p.tagline,
		monthlyPriceInr: p.monthlyPriceInr,
		annualPriceInr: p.annualPriceInr,
		features: p.features,
		fxSpreadPct: p.fxSpreadPct,
		tradeFeeInr: p.tradeFeInr,
		usTrading: p.usTrading,
		realTimeData: p.realTimeData,
		aiReports: p.aiReports,
		portfolioScoring: p.portfolioScoring,
		taxReports: p.taxReports,
		advisorDashboard: p.advisorDashboard,
		dedicatedRM: p.dedicatedRM,
		apiAccess: p.apiAccess,
		highlight: p.highlight,
	}));
	res.json({ success: true, plans: catalogue });
});

// ── GET /api/subscriptions/status ─────────────────────────────────────────────
// Auth — returns the calling user's current plan
router.get("/status", requireAuth, async (req: any, res) => {
	try {
		const userId = req.user?.id;
		if (!userId) return res.status(401).json({ error: "Unauthorized" });

		const [user] = await db
			.select()
			.from(users)
			.where(eq(users.id, userId))
			.limit(1);
		if (!user) return res.status(404).json({ error: "User not found" });

		const tier = getEffectiveTier(user as any);
		const plan = getPlanConfig(tier);
		const activeSub = await getUserSubscription(userId);

		res.json({
			success: true,
			tier,
			planName: plan.name,
			planExpiresAt: user.planExpiresAt || null,
			isActive: tier !== "free",
			fxSpreadPct: plan.fxSpreadPct,
			tradeFeeInr: plan.tradeFeInr,
			features: plan.features,
			subscription: activeSub || null,
		});
	} catch (err: any) {
		logger.error("[Subscription] status error:", err.message);
		res.status(500).json({ error: "Failed to fetch subscription status" });
	}
});

// ── GET /api/subscriptions/history ────────────────────────────────────────────
router.get("/history", requireAuth, async (req: any, res) => {
	try {
		const userId = req.user?.id;
		if (!userId) return res.status(401).json({ error: "Unauthorized" });

		const history = await getUserSubscriptionHistory(userId);
		res.json({ success: true, history });
	} catch (err: any) {
		res.status(500).json({ error: "Failed to fetch subscription history" });
	}
});

// ── POST /api/subscriptions/checkout ──────────────────────────────────────────
// Auth — creates a Cashfree order and returns payment URL
router.post("/checkout", requireAuth, async (req: any, res) => {
	try {
		const userId = req.user?.id;
		if (!userId) return res.status(401).json({ error: "Unauthorized" });

		const { tier, cycle } = req.body as { tier: PlanTier; cycle: BillingCycle };

		if (!tier || !cycle) {
			return res.status(400).json({ error: "tier and cycle are required" });
		}
		if (!["pro", "elite"].includes(tier)) {
			return res.status(400).json({ error: "tier must be pro or elite" });
		}
		if (!["monthly", "annual"].includes(cycle)) {
			return res.status(400).json({ error: "cycle must be monthly or annual" });
		}
		if (tier === "elite" && cycle === "monthly") {
			return res
				.status(400)
				.json({ error: "Elite is only available on annual billing" });
		}

		const amountInr = getPriceInr(tier, cycle);

		const [user] = await db
			.select()
			.from(users)
			.where(eq(users.id, userId))
			.limit(1);
		if (!user) return res.status(404).json({ error: "User not found" });

		const order = await createCheckoutOrder(userId, tier, cycle, {
			email: user.email || undefined,
			mobile: user.mobile || undefined,
			name:
				[user.firstName, user.lastName].filter(Boolean).join(" ") || "Investor",
		});

		res.json({
			success: true,
			orderId: order.orderId,
			paymentSessionId: order.paymentSessionId,
			paymentUrl: order.paymentUrl,
			amountInr,
			tier,
			cycle,
		});
	} catch (err: any) {
		logger.error("[Subscription] checkout error:", err.message);
		res.status(500).json({ error: err.message || "Checkout failed" });
	}
});

// ── POST /api/subscriptions/verify ────────────────────────────────────────────
// Auth — verifies Cashfree payment and activates subscription
router.post("/verify", requireAuth, async (req: any, res) => {
	try {
		const userId = req.user?.id;
		if (!userId) return res.status(401).json({ error: "Unauthorized" });

		const { orderId } = req.body as { orderId: string };
		if (!orderId) return res.status(400).json({ error: "orderId required" });

		const status = await cashfreeService.getOrderStatus(orderId);
		if (!status) return res.status(404).json({ error: "Order not found" });

		if (status.orderStatus === "PAID") {
			await activateSubscription(userId, orderId, status.transactionId);
			return res.json({ success: true, status: "activated" });
		}

		if (
			status.orderStatus === "EXPIRED" ||
			status.orderStatus === "CANCELLED"
		) {
			await markSubscriptionFailed(orderId);
			return res.json({
				success: false,
				status: status.orderStatus.toLowerCase(),
			});
		}

		res.json({ success: false, status: status.orderStatus.toLowerCase() });
	} catch (err: any) {
		logger.error("[Subscription] verify error:", err.message);
		res.status(500).json({ error: err.message || "Verification failed" });
	}
});

// ── GET /api/subscriptions/callback (Cashfree redirect) ───────────────────────
router.get("/callback", async (req, res) => {
	const { order_id } = req.query as { order_id?: string };
	if (!order_id) return res.redirect("/pricing?status=error");

	try {
		const status = await cashfreeService.getOrderStatus(order_id);
		if (status?.orderStatus === "PAID") {
			return res.redirect(`/pricing?status=success&order=${order_id}`);
		}
		res.redirect(`/pricing?status=pending&order=${order_id}`);
	} catch {
		res.redirect("/pricing?status=error");
	}
});

// ── POST /api/subscriptions/webhook ───────────────────────────────────────────
// Cashfree webhook — activates subscription on PAYMENT_SUCCESS
router.post("/webhook", async (req, res) => {
	try {
		const event = req.body;
		logger.info("[Subscription] Cashfree webhook received:", event?.type);

		if (event?.type === "PAYMENT_SUCCESS_WEBHOOK") {
			const orderId: string = event?.data?.order?.order_id;
			const paymentId: string = event?.data?.payment?.cf_payment_id;

			if (!orderId) return res.status(400).json({ error: "Missing order_id" });

			// Find the pending subscription to get the userId
			const { platformSubscriptions } = await import("@shared/schema");
			const { and: _and, eq: _eq } = await import("drizzle-orm");
			const [pending] = await db
				.select()
				.from(platformSubscriptions)
				.where(
					_and(
						_eq(platformSubscriptions.cashfreeOrderId, orderId),
						_eq(platformSubscriptions.status, "pending"),
					),
				)
				.limit(1);

			if (pending) {
				await activateSubscription(pending.userId, orderId, String(paymentId));
				logger.info(
					`[Subscription] Webhook activated subscription for order ${orderId}`,
				);
			}
		}

		res.json({ received: true });
	} catch (err: any) {
		logger.error("[Subscription] webhook error:", err.message);
		res.status(500).json({ error: "Webhook processing failed" });
	}
});

// ── GET /api/subscriptions/admin/revenue ──────────────────────────────────────
router.get("/admin/revenue", requireAdmin, async (_req, res) => {
	try {
		const data = await getRevenueStats();
		res.json({ success: true, ...data });
	} catch (err: any) {
		logger.error("[Subscription] admin revenue error:", err.message);
		res.status(500).json({ error: "Failed to fetch revenue stats" });
	}
});

export default router;
