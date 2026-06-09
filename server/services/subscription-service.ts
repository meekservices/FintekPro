// @ts-nocheck
import { db } from "../db";
import { eq, desc, and, sql } from "drizzle-orm";
import { users, platformSubscriptions } from "@shared/schema";
import { cashfreeService } from "../cashfree-service";
import { logger } from "../logger";

// ── Plan Definitions ──────────────────────────────────────────────────────────

export type PlanTier = "free" | "pro" | "elite";
export type BillingCycle = "monthly" | "annual";

export interface PlanConfig {
	tier: PlanTier;
	name: string;
	tagline: string;
	monthlyPriceInr: number | null;
	annualPriceInr: number | null;
	features: string[];
	fxSpreadPct: number; // FX spread percentage charged
	tradeFeInr: number | null; // Per-trade fee in INR (null = bundled/zero)
	cashYieldRetainedPct: number; // % of Alpaca cash yield FintekPro retains
	maxMonthlyTrades: number | null; // null = unlimited
	usTrading: boolean;
	realTimeData: boolean;
	aiReports: boolean;
	portfolioScoring: boolean;
	taxReports: boolean;
	advisorDashboard: boolean;
	dedicatedRM: boolean;
	apiAccess: boolean;
	highlight: boolean;
}

export const PLANS: Record<PlanTier, PlanConfig> = {
	free: {
		tier: "free",
		name: "Free",
		tagline: "Start your global investment journey",
		monthlyPriceInr: 0,
		annualPriceInr: 0,
		features: [
			"US stock investing via Alpaca",
			"Basic portfolio tracking",
			"Delayed market data",
			"Auto-generated research summaries",
			"5 trades per month",
		],
		fxSpreadPct: 1.0,
		tradeFeInr: 0,
		cashYieldRetainedPct: 1.5,
		maxMonthlyTrades: 5,
		usTrading: true,
		realTimeData: false,
		aiReports: false,
		portfolioScoring: false,
		taxReports: false,
		advisorDashboard: false,
		dedicatedRM: false,
		apiAccess: false,
		highlight: false,
	},
	pro: {
		tier: "pro",
		name: "Pro",
		tagline: "For serious investors who mean business",
		monthlyPriceInr: 999,
		annualPriceInr: 9999,
		features: [
			"Unlimited US trades",
			"Real-time US market data",
			"Advanced analytics dashboard",
			"AI research reports (DCF + comps)",
			"Portfolio health scoring",
			"Smart alerts (valuation, earnings, risk)",
			"India tax-ready capital gains reports",
			"Lower FX spread (0.5%)",
		],
		fxSpreadPct: 0.5,
		tradeFeInr: 10,
		cashYieldRetainedPct: 1.0,
		maxMonthlyTrades: null,
		usTrading: true,
		realTimeData: true,
		aiReports: true,
		portfolioScoring: true,
		taxReports: true,
		advisorDashboard: false,
		dedicatedRM: false,
		apiAccess: false,
		highlight: true,
	},
	elite: {
		tier: "elite",
		name: "Elite",
		tagline: "Institutional-grade wealth management",
		monthlyPriceInr: null,
		annualPriceInr: 25000,
		features: [
			"Everything in Pro",
			"Direct advisor dashboard",
			"Multi-asset portfolio view (global + India)",
			"Institutional-grade PMS-style reports",
			"Deal flow — pre-IPO & private markets",
			"Dedicated RM + WhatsApp desk",
			"API access for advisors/RIAs",
			"Lowest FX spread (0.25–0.4%)",
			"Zero per-trade fee (bundled)",
			"Alt data: insider trades, hedge fund tracking",
		],
		fxSpreadPct: 0.3,
		tradeFeInr: 0,
		cashYieldRetainedPct: 0.75,
		maxMonthlyTrades: null,
		usTrading: true,
		realTimeData: true,
		aiReports: true,
		portfolioScoring: true,
		taxReports: true,
		advisorDashboard: true,
		dedicatedRM: true,
		apiAccess: true,
		highlight: false,
	},
};

// ── Tier resolution helpers ───────────────────────────────────────────────────

export function isActivePlan(user: {
	planTier?: string | null;
	planExpiresAt?: Date | null;
}): boolean {
	if (!user.planTier || user.planTier === "free") return true; // free never expires
	if (!user.planExpiresAt) return false;
	return new Date(user.planExpiresAt) > new Date();
}

export function getEffectiveTier(user: {
	planTier?: string | null;
	planExpiresAt?: Date | null;
}): PlanTier {
	if (!isActivePlan(user)) return "free";
	return (user.planTier as PlanTier) || "free";
}

export function getPlanConfig(tier: PlanTier): PlanConfig {
	return PLANS[tier] || PLANS.free;
}

/** Calculate FX revenue on a remittance amount (in INR) */
export function calcFxRevenue(amountInr: number, tier: PlanTier): number {
	const spread = PLANS[tier]?.fxSpreadPct ?? 1.0;
	return Number.parseFloat(((amountInr * spread) / 100).toFixed(2));
}

/** Calculate per-trade fee (in INR) for a given tier */
export function calcTradeFee(tier: PlanTier): number {
	return PLANS[tier]?.tradeFeInr ?? 0;
}

// ── Price lookup ──────────────────────────────────────────────────────────────

export function getPriceInr(tier: PlanTier, cycle: BillingCycle): number {
	const plan = PLANS[tier];
	if (!plan) throw new Error(`Unknown tier: ${tier}`);
	if (cycle === "annual") return plan.annualPriceInr ?? 0;
	return plan.monthlyPriceInr ?? 0;
}

export function getValidityDays(cycle: BillingCycle): number {
	return cycle === "annual" ? 365 : 30;
}

// ── Subscription CRUD ─────────────────────────────────────────────────────────

export async function getUserSubscription(userId: string) {
	const [sub] = await db
		.select()
		.from(platformSubscriptions)
		.where(
			and(
				eq(platformSubscriptions.userId, userId),
				eq(platformSubscriptions.status, "active"),
			),
		)
		.orderBy(desc(platformSubscriptions.createdAt))
		.limit(1);
	return sub || null;
}

export async function getUserSubscriptionHistory(userId: string, limit = 10) {
	return db
		.select()
		.from(platformSubscriptions)
		.where(eq(platformSubscriptions.userId, userId))
		.orderBy(desc(platformSubscriptions.createdAt))
		.limit(limit);
}

export async function createCheckoutOrder(
	userId: string,
	tier: PlanTier,
	cycle: BillingCycle,
	userDetails: { email?: string; mobile?: string; name?: string },
): Promise<{
	orderId: string;
	paymentSessionId: string;
	paymentUrl: string;
	amountInr: number;
}> {
	const amountInr = getPriceInr(tier, cycle);
	if (amountInr <= 0) throw new Error("Cannot checkout for a free plan");

	const result = await cashfreeService.createOrder({
		amount: amountInr,
		userId,
		phone: userDetails.mobile || "9999999999",
		email: userDetails.email || `${userId}@fintekpro.com`,
		name: userDetails.name || "Investor",
		returnUrl: `${process.env.APP_BASE_URL || ""}/api/subscriptions/callback`,
	});

	if (!result.success || !result.orderId) {
		throw new Error(result.message || "Cashfree order creation failed");
	}

	// Persist a pending subscription record
	await db.insert(platformSubscriptions).values({
		userId,
		planTier: tier,
		billingCycle: cycle,
		amountPaise: amountInr * 100,
		currency: "INR",
		cashfreeOrderId: result.orderId,
		cashfreePaymentSessionId: result.paymentSessionId || null,
		status: "pending",
		metadata: { cycle, requestedAt: new Date().toISOString() },
	});

	return {
		orderId: result.orderId,
		paymentSessionId: result.paymentSessionId || "",
		paymentUrl: result.paymentUrl || "",
		amountInr,
	};
}

export async function activateSubscription(
	userId: string,
	cashfreeOrderId: string,
	cashfreePaymentId?: string,
): Promise<void> {
	// Find pending subscription
	const [pending] = await db
		.select()
		.from(platformSubscriptions)
		.where(
			and(
				eq(platformSubscriptions.userId, userId),
				eq(platformSubscriptions.cashfreeOrderId, cashfreeOrderId),
				eq(platformSubscriptions.status, "pending"),
			),
		)
		.limit(1);

	if (!pending) {
		throw new Error(
			`No pending subscription found for order ${cashfreeOrderId}`,
		);
	}

	const tier = pending.planTier as PlanTier;
	const cycle = pending.billingCycle as BillingCycle;
	const startsAt = new Date();
	const expiresAt = new Date(Date.now() + getValidityDays(cycle) * 86_400_000);

	// Activate the subscription record
	await db
		.update(platformSubscriptions)
		.set({
			status: "active",
			cashfreePaymentId: cashfreePaymentId || null,
			startsAt,
			expiresAt,
			updatedAt: new Date(),
		})
		.where(eq(platformSubscriptions.id, pending.id));

	// Update user's plan tier and expiry
	await db
		.update(users)
		.set({
			planTier: tier,
			planExpiresAt: expiresAt,
			cashfreeSubscriptionId: cashfreeOrderId,
			updatedAt: new Date(),
		})
		.where(eq(users.id, userId));

	logger.info(
		`[Subscription] Activated ${tier}/${cycle} for user ${userId}, expires ${expiresAt.toISOString()}`,
	);
}

export async function markSubscriptionFailed(orderId: string): Promise<void> {
	await db
		.update(platformSubscriptions)
		.set({ status: "failed", updatedAt: new Date() })
		.where(eq(platformSubscriptions.cashfreeOrderId, orderId));
}

// ── Admin analytics ───────────────────────────────────────────────────────────

export async function getRevenueStats() {
	const [result] = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'active') AS active_subscriptions,
      COUNT(*) FILTER (WHERE status = 'active' AND plan_tier = 'pro') AS pro_count,
      COUNT(*) FILTER (WHERE status = 'active' AND plan_tier = 'elite') AS elite_count,
      COALESCE(SUM(amount_paise) FILTER (WHERE status = 'active'), 0) AS total_revenue_paise,
      COALESCE(SUM(amount_paise) FILTER (
        WHERE status = 'active'
          AND created_at >= date_trunc('month', NOW())
      ), 0) AS mrr_paise,
      COALESCE(SUM(amount_paise) FILTER (
        WHERE status = 'active'
          AND created_at >= date_trunc('year', NOW())
      ), 0) AS arr_paise
    FROM platform_subscriptions
  `);

	// User-tier breakdown
	const tierRows = await db.execute(sql`
    SELECT plan_tier, COUNT(*) AS cnt
    FROM users
    WHERE plan_tier != 'free' AND plan_expires_at > NOW()
    GROUP BY plan_tier
  `);

	// Recent subscriptions
	const recent = await db
		.select()
		.from(platformSubscriptions)
		.orderBy(desc(platformSubscriptions.createdAt))
		.limit(20);

	return {
		stats: result,
		tierBreakdown: tierRows.rows,
		recent,
	};
}
