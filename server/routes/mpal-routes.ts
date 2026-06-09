// @ts-nocheck
/**
 * MPAL API Routes
 *
 * Prefix: /api/mpal (registered in server/routes/index.ts)
 *
 * Endpoints:
 *   Financial Profile
 *     GET  /financial-profile
 *
 *   Broker Registry & Health
 *     GET  /brokers              → list all brokers + configured status + capabilities
 *     GET  /brokers/health       → live health check all configured brokers
 *     GET  /brokers/:id          → single broker status
 *
 *   Investment / Orders
 *     GET  /broker/:assetClass/quotes
 *     GET  /broker/:assetClass/positions
 *     POST /broker/:assetClass/orders    (idempotency-key aware)
 *     GET  /orders               → paginated broker_orders log
 *     GET  /orders/:id           → single order with live broker refresh option
 *
 *   Credit
 *     GET  /credit/products
 *     GET  /credit/eligibility
 *     POST /credit/applications
 *     GET  /credit/applications
 */

import { Router } from "express";
import { investmentRouter } from "../services/mpal/core/investmentRouter";
import { creditRouter } from "../services/mpal/core/creditRouter";
import { providerRegistry } from "../services/mpal/core/providerRegistry";
import { financialProfileEngine } from "../services/profile/financialProfileEngine";
import {
	BrokerUnavailableError,
	BrokerNotConfiguredError,
	BrokerError,
} from "../services/mpal/interfaces/IBroker";
import { logger } from "../logger";
import { requireAdmin } from "../middleware/roleMiddleware";

export const mpalRouter = Router();

// ─── Helper: map BrokerError → HTTP response ──────────────────────────────────
function brokerErrorResponse(res: any, err: any) {
	if (
		err instanceof BrokerUnavailableError ||
		err instanceof BrokerNotConfiguredError
	) {
		return res.status(503).json({
			success: false,
			error_code: err.error_code,
			message: err.message,
			retryable: err.retryable,
			meta: { timestamp: new Date().toISOString(), version: "1.0" },
		});
	}
	if (err instanceof BrokerError) {
		return res.status(502).json({
			success: false,
			error_code: err.error_code,
			message: err.message,
			retryable: err.retryable,
			meta: { timestamp: new Date().toISOString(), version: "1.0" },
		});
	}
	return res.status(500).json({
		success: false,
		error_code: "INTERNAL_ERROR",
		message: err?.message ?? "Internal Server Error",
		retryable: false,
		meta: { timestamp: new Date().toISOString(), version: "1.0" },
	});
}

// ==========================================
// MPAL: Financial Profile
// ==========================================
mpalRouter.get("/financial-profile", async (req, res) => {
	try {
		if (!req.user) return res.status(401).json({ error: "Unauthorized" });
		const profile = await financialProfileEngine.buildProfile(req.user!.id);
		res.json({
			success: true,
			data: {
				...profile,
				id: `prof_${req.user!.id}`,
				riskScore: "750",
				lastUpdated: new Date().toISOString(),
			},
			meta: { timestamp: new Date().toISOString(), version: "1.0" },
		});
	} catch (error) {
		logger.error("Error fetching financial profile", error);
		res.status(500).json({ error: "Internal Server Error" });
	}
});

// ==========================================
// MPAL: Broker Registry & Health
// ==========================================

/**
 * GET /api/mpal/brokers
 * Lists all registered brokers with their configured status and capabilities.
 * Does NOT require auth — safe for internal dashboards.
 */
mpalRouter.get("/brokers", (_req, res) => {
	const brokers = providerRegistry.getAllBrokers().map((b) => ({
		id: b.brokerId,
		configured: b.isConfigured(),
		capabilities: b.capabilities,
	}));
	res.json({
		success: true,
		data: brokers,
		meta: {
			timestamp: new Date().toISOString(),
			version: "1.0",
			total: brokers.length,
		},
	});
});

/**
 * GET /api/mpal/brokers/health
 * Runs healthCheck() on every registered broker (in parallel).
 * Timeout: 5s per broker. Returns partial results if some fail.
 */
mpalRouter.get("/brokers/health", async (_req, res) => {
	const brokers = providerRegistry.getAllBrokers();
	const results = await Promise.allSettled(
		brokers.map((b) => b.healthCheck(5000)),
	);
	const health = results.map((r, i) => {
		if (r.status === "fulfilled") return r.value;
		return {
			brokerId: brokers[i].brokerId,
			configured: brokers[i].isConfigured(),
			healthy: false,
			message: (r.reason as any)?.message ?? "Health check threw an exception",
			checkedAt: new Date().toISOString(),
		};
	});
	const allHealthy = health.every((h) => !h.configured || h.healthy);
	res.status(allHealthy ? 200 : 207).json({
		success: allHealthy,
		data: health,
		meta: { timestamp: new Date().toISOString(), version: "1.0" },
	});
});

/**
 * GET /api/mpal/brokers/:id
 * Single broker status + live health check.
 */
mpalRouter.get("/brokers/:id", async (req, res) => {
	const broker = providerRegistry
		.getAllBrokers()
		.find((b) => b.brokerId === req.params.id.toUpperCase());
	if (!broker) {
		return res
			.status(404)
			.json({
				success: false,
				error_code: "BROKER_NOT_FOUND",
				message: `Broker '${req.params.id}' not registered.`,
			});
	}
	const health = await broker.healthCheck(5000).catch((err) => ({
		brokerId: broker.brokerId,
		configured: broker.isConfigured(),
		healthy: false,
		message: err?.message,
		checkedAt: new Date().toISOString(),
	}));
	res.json({
		success: true,
		data: { id: broker.brokerId, capabilities: broker.capabilities, ...health },
		meta: { timestamp: new Date().toISOString(), version: "1.0" },
	});
});

// ==========================================
// MPAL: Broker / Investments
// ==========================================

mpalRouter.get("/broker/:assetClass/quotes", async (req, res) => {
	try {
		const { assetClass } = req.params;
		const quotes = await investmentRouter.getQuote(
			assetClass,
			(req.query.symbol as string) || "AAPL",
		);
		res.json({
			success: true,
			data: [quotes],
			meta: { timestamp: new Date().toISOString(), version: "1.0" },
		});
	} catch (error: any) {
		logger.error(`Error fetching quotes for ${req.params.assetClass}`, error);
		return brokerErrorResponse(res, error);
	}
});

mpalRouter.get("/broker/:assetClass/positions", async (req, res) => {
	try {
		if (!req.user) return res.status(401).json({ error: "Unauthorized" });
		const { assetClass } = req.params;
		const preferred = req.query.broker as string | undefined;
		const positions = await investmentRouter.getPositions(
			assetClass,
			req.user,
			preferred,
		);
		res.json({
			success: true,
			data: positions,
			meta: {
				timestamp: new Date().toISOString(),
				version: "1.0",
				total: positions.length,
			},
		});
	} catch (error: any) {
		logger.error(
			`Error fetching positions for ${req.params.assetClass}`,
			error,
		);
		return brokerErrorResponse(res, error);
	}
});

/**
 * POST /api/mpal/broker/:assetClass/orders
 *
 * Idempotency: pass x-idempotency-key header to make the request safe to retry.
 * Optional: pass ?broker=IIFL to prefer a specific broker.
 */
mpalRouter.post("/broker/:assetClass/orders", async (req, res) => {
	try {
		if (!req.user) return res.status(401).json({ error: "Unauthorized" });
		const { assetClass } = req.params;
		const preferred = req.query.broker as string | undefined;
		const idempotencyKey = req.headers["x-idempotency-key"] as
			| string
			| undefined;
		const order = await investmentRouter.executeOrder(
			assetClass,
			{ ...req.body, idempotencyKey },
			req.user,
			preferred,
		);
		res.json({
			success: true,
			data: order,
			meta: { timestamp: new Date().toISOString(), version: "1.0" },
		});
	} catch (error: any) {
		logger.error(`Error executing order for ${req.params.assetClass}`, error);
		return brokerErrorResponse(res, error);
	}
});

// ==========================================
// MPAL: Broker Orders Log
// ==========================================

/**
 * GET /api/mpal/orders
 * Paginated broker_orders table — supports ?page=1&limit=20&brokerId=IIFL&status=filled
 */
mpalRouter.get("/orders", async (req, res) => {
	try {
		if (!req.user) return res.status(401).json({ error: "Unauthorized" });
		const page = Number.parseInt(req.query.page as string) || 1;
		const limit = Math.min(
			Number.parseInt(req.query.limit as string) || 20,
			100,
		);
		const offset = (page - 1) * limit;
		const { db } = await import("../db");
		const { brokerOrders } = await import("../../shared/schema/mpal");
		const { eq, and, desc } = await import("drizzle-orm");

		const conditions: any[] = [eq(brokerOrders.userId, req.user!.id)];
		if (req.query.brokerId)
			conditions.push(eq(brokerOrders.brokerId, req.query.brokerId as string));
		if (req.query.status)
			conditions.push(eq(brokerOrders.status, req.query.status as string));

		const [orders, total] = await Promise.all([
			db
				.select()
				.from(brokerOrders)
				.where(and(...conditions))
				.orderBy(desc(brokerOrders.createdAt))
				.limit(limit)
				.offset(offset),
			db
				.select({ count: brokerOrders.id })
				.from(brokerOrders)
				.where(and(...conditions))
				.then((r) => r.length),
		]);

		res.json({
			success: true,
			data: orders,
			meta: {
				timestamp: new Date().toISOString(),
				version: "1.0",
				page,
				limit,
				total,
			},
		});
	} catch (err: any) {
		logger.error("Error fetching broker orders", err);
		res
			.status(500)
			.json({
				success: false,
				error_code: "FETCH_FAILED",
				message: err?.message,
			});
	}
});

/**
 * GET /api/mpal/orders/:id
 * Single order. Pass ?refresh=true to poll live status from broker.
 */
mpalRouter.get("/orders/:id", async (req, res) => {
	try {
		if (!req.user) return res.status(401).json({ error: "Unauthorized" });
		const { db } = await import("../db");
		const { brokerOrders } = await import("../../shared/schema/mpal");
		const { eq, and } = await import("drizzle-orm");

		const rows = await db
			.select()
			.from(brokerOrders)
			.where(
				and(
					eq(brokerOrders.id, req.params.id),
					eq(brokerOrders.userId, req.user!.id),
				),
			);
		if (!rows.length)
			return res
				.status(404)
				.json({ success: false, error_code: "ORDER_NOT_FOUND" });

		let order: any = rows[0];

		// Live refresh from broker if requested and order is still open
		if (
			req.query.refresh === "true" &&
			order.brokerOrderId &&
			["pending", "submitted", "partially_filled"].includes(order.status)
		) {
			try {
				const broker = providerRegistry.getBroker(order.brokerId);
				const live = await broker.getOrderStatus(order.brokerOrderId);
				// Update DB
				await db
					.update(brokerOrders)
					.set({
						status: live.status,
						filledQty: live.filledQty?.toString(),
						filledPrice: live.filledPrice?.toString(),
						updatedAt: new Date(),
					})
					.where(eq(brokerOrders.id, order.id));
				order = { ...order, ...live };
			} catch (e: any) {
				logger.warn(
					`[MPAL] Live order refresh failed for ${order.id}`,
					e?.message,
				);
			}
		}

		res.json({
			success: true,
			data: order,
			meta: { timestamp: new Date().toISOString(), version: "1.0" },
		});
	} catch (err: any) {
		logger.error("Error fetching broker order", err);
		res
			.status(500)
			.json({
				success: false,
				error_code: "FETCH_FAILED",
				message: err?.message,
			});
	}
});

// ==========================================
// MPAL: Credit / Borrowing
// ==========================================
mpalRouter.get("/credit/products", async (_req, res) => {
	try {
		const products = [
			{
				id: "prod_1",
				providerId: "M2P_LENDING",
				productType: "PERSONAL_LOAN",
				name: "Portfolio-Backed Express Loan",
				description: "Instant liquidity against your mutual fund portfolio.",
				interestRate: 10.5,
				minAmount: 10000,
				maxAmount: 500000,
				maxTenureMonths: 36,
				isActive: true,
			},
			{
				id: "prod_2",
				providerId: "SETU_AGGREGATOR",
				productType: "CREDIT_CARD",
				name: "FintekPro Premium Card",
				description: "High rewards credit card based on your net worth.",
				interestRate: 18.0,
				minAmount: 50000,
				maxAmount: 1000000,
				maxTenureMonths: 0,
				isActive: true,
			},
		];
		res.json({
			success: true,
			data: products,
			meta: { timestamp: new Date().toISOString(), version: "1.0" },
		});
	} catch (error) {
		logger.error("Error fetching credit products", error);
		res.status(500).json({ error: "Internal Server Error" });
	}
});

mpalRouter.get("/credit/eligibility", async (req, res) => {
	try {
		if (!req.user) return res.status(401).json({ error: "Unauthorized" });
		const { creditScoringEngine } = await import(
			"../services/mpal/core/creditRouter"
		);
		const scoring = (await (creditScoringEngine as any)?.scoreUser?.(
			req.user!.id,
		)) ?? { eligible: false, message: "Scoring engine not configured" };
		res.json({
			success: true,
			data: scoring,
			meta: { timestamp: new Date().toISOString(), version: "1.0" },
		});
	} catch (error) {
		logger.error("Error evaluating credit eligibility", error);
		res.status(500).json({ error: "Internal Server Error" });
	}
});

mpalRouter.post("/credit/applications", async (req, res) => {
	try {
		if (!req.user) return res.status(401).json({ error: "Unauthorized" });
		const application = { ...req.body, userId: req.user!.id };
		const result = await creditRouter.routeApplication(application);
		res.json({
			success: true,
			data: result,
			meta: { timestamp: new Date().toISOString(), version: "1.0" },
		});
	} catch (error) {
		logger.error("Error submitting credit application", error);
		res.status(500).json({ error: "Internal Server Error" });
	}
});

mpalRouter.get("/credit/applications", async (_req, res) => {
	res.json({
		success: true,
		data: [],
		meta: { timestamp: new Date().toISOString(), version: "1.0", total: 0 },
	});
});

// ==========================================
// MPAL Admin: Multibroker Earnings Dashboard
// ==========================================

/**
 * GET /api/mpal/admin/earnings
 *
 * Purpose   : Aggregates commission earnings, payout summaries, and order volume
 *             across all registered brokers (IRIS, IIFL, ALPACA) for admin monitoring.
 *
 * Auth      : requireAdmin — super-admin and finance-head only
 *
 * Query Params:
 *   ?days=30     — lookback window in days (default: 30, max: 365)
 *   ?brokerId=   — filter to one broker (optional)
 *
 * Response shape:
 *   { brokers[], summary{}, topProducts[], recentOrders[] }
 *
 * Commission Rates (from RevenueEngine):
 *   IRIS    → 0.50% trail on MF/NPS/AIF AUM
 *   IIFL    → 0.10% brokerage share on equity orders
 *   ALPACA  → 0.20% order-flow rebates on US equities
 */
mpalRouter.get("/admin/earnings", requireAdmin, async (req, res) => {
	try {
		const days = Math.min(Number.parseInt(req.query.days as string) || 30, 365);
		const brokerFilter = req.query.brokerId as string | undefined;

		const { db } = await import("../db");
		const { brokerOrders } = await import("../../shared/schema/mpal");
		const { sql, gte, and, eq } = await import("drizzle-orm");

		const since = new Date();
		since.setDate(since.getDate() - days);

		// Commission rates per broker (aligned with RevenueEngine)
		const COMMISSION_RATES: Record<
			string,
			{ rate: number; label: string; currency: string; domain: string }
		> = {
			IRIS: {
				rate: 0.005,
				label: "IRIS KFintech",
				currency: "INR",
				domain: "Mutual Funds / NPS / AIF",
			},
			IIFL: {
				rate: 0.001,
				label: "IIFL Securities",
				currency: "INR",
				domain: "Indian Equities / F&O",
			},
			ALPACA: {
				rate: 0.002,
				label: "Alpaca Markets",
				currency: "USD",
				domain: "US Equities / ETFs",
			},
		};

		// Build DB conditions
		const conditions: any[] = [gte(brokerOrders.createdAt, since)];
		if (brokerFilter)
			conditions.push(eq(brokerOrders.brokerId, brokerFilter.toUpperCase()));

		// Fetch all qualifying orders
		const orders = await db
			.select()
			.from(brokerOrders)
			.where(and(...conditions));

		// Aggregate per broker
		const brokerMap: Record<
			string,
			{
				brokerId: string;
				label: string;
				domain: string;
				currency: string;
				orderCount: number;
				filledCount: number;
				totalOrderValue: number;
				estimatedCommission: number;
				filledCommission: number;
				capabilityList: string[];
			}
		> = {};

		for (const order of orders) {
			const bid = order.brokerId || "UNKNOWN";
			if (!brokerMap[bid]) {
				const reg = COMMISSION_RATES[bid] ?? {
					rate: 0,
					label: bid,
					currency: "INR",
					domain: "—",
				};
				const regBroker = providerRegistry
					.getAllBrokers()
					.find((b) => b.brokerId === bid);
				brokerMap[bid] = {
					brokerId: bid,
					label: reg.label,
					domain: reg.domain,
					currency: reg.currency,
					orderCount: 0,
					filledCount: 0,
					totalOrderValue: 0,
					estimatedCommission: 0,
					filledCommission: 0,
					capabilityList: regBroker?.capabilities ?? [],
				};
			}
			const entry = brokerMap[bid];
			const rate = COMMISSION_RATES[bid]?.rate ?? 0;
			const val =
				Number.parseFloat(
					(order.requestedNotional as string) ??
						(order.requestedQty as string) ??
						"0",
				) || 0;
			entry.orderCount++;
			entry.totalOrderValue += val;
			entry.estimatedCommission += val * rate;
			if (order.status === "filled" || order.status === "completed") {
				const filledVal =
					Number.parseFloat((order.filledPrice as string) ?? "0") *
					Number.parseFloat((order.filledQty as string) ?? "0");
				entry.filledCount++;
				entry.filledCommission += filledVal * rate;
			}
		}

		const brokers = Object.values(brokerMap).map((b) => ({
			...b,
			successRate:
				b.orderCount > 0 ? Math.round((b.filledCount / b.orderCount) * 100) : 0,
			configured:
				providerRegistry
					.getAllBrokers()
					.find((x) => x.brokerId === b.brokerId)
					?.isConfigured() ?? false,
		}));

		// Summary totals (INR equivalent — USD amounts shown separately)
		const totalOrders = orders.length;
		const totalFilled = orders.filter(
			(o) => o.status === "filled" || o.status === "completed",
		).length;
		const totalCommissionINR = brokers
			.filter((b) => b.currency === "INR")
			.reduce((s, b) => s + b.filledCommission, 0);
		const totalCommissionUSD = brokers
			.filter((b) => b.currency === "USD")
			.reduce((s, b) => s + b.filledCommission, 0);

		// Top products by order count
		const productCounts: Record<
			string,
			{ assetClass: string; count: number; brokerId: string }
		> = {};
		for (const o of orders) {
			const key = `${o.assetClass || o.brokerId}`;
			if (!productCounts[key])
				productCounts[key] = {
					assetClass: o.assetClass || "UNKNOWN",
					count: 0,
					brokerId: o.brokerId,
				};
			productCounts[key].count++;
		}
		const topProducts = Object.values(productCounts)
			.sort((a, b) => b.count - a.count)
			.slice(0, 8);

		// Recent 20 orders (newest first)
		const recentOrders = [...orders]
			.sort(
				(a, b) =>
					new Date(b.createdAt as string).getTime() -
					new Date(a.createdAt as string).getTime(),
			)
			.slice(0, 20)
			.map((o) => ({
				id: o.id,
				brokerId: o.brokerId,
				assetClass: o.assetClass,
				side: o.side,
				status: o.status,
				symbol: o.symbol,
				requestedQty: o.requestedQty,
				requestedNotional: o.requestedNotional,
				filledQty: o.filledQty,
				filledPrice: o.filledPrice,
				createdAt: o.createdAt,
				idempotencyKey: o.idempotencyKey,
			}));

		// Registered broker health (all brokers — even unconfigured, to show admin what's missing)
		const allBrokerHealth = providerRegistry.getAllBrokers().map((b) => ({
			brokerId: b.brokerId,
			configured: b.isConfigured(),
			capabilities: b.capabilities,
			commissionRate: COMMISSION_RATES[b.brokerId]?.rate ?? 0,
			domain: COMMISSION_RATES[b.brokerId]?.domain ?? "—",
			currency: COMMISSION_RATES[b.brokerId]?.currency ?? "INR",
		}));

		logger.info("[MPAL Admin] Earnings aggregation complete", {
			event: "MPAL_ADMIN_EARNINGS_FETCHED",
			user_id: req.user?.id,
			days,
			totalOrders,
			brokersCount: brokers.length,
			latency_ms: 0,
			status: "success",
		});

		return res.json({
			success: true,
			data: {
				period: {
					days,
					since: since.toISOString(),
					until: new Date().toISOString(),
				},
				summary: {
					totalOrders,
					totalFilled,
					overallSuccessRate:
						totalOrders > 0 ? Math.round((totalFilled / totalOrders) * 100) : 0,
					totalCommissionINR: Math.round(totalCommissionINR),
					totalCommissionUSD: Number.parseFloat(totalCommissionUSD.toFixed(2)),
					activeBrokers: allBrokerHealth.filter((b) => b.configured).length,
					totalBrokers: allBrokerHealth.length,
				},
				brokers,
				allBrokerHealth,
				topProducts,
				recentOrders,
			},
			meta: { timestamp: new Date().toISOString(), version: "1.0" },
		});
	} catch (err: any) {
		logger.error("[MPAL Admin] Earnings aggregation failed", {
			error: err?.message,
		});
		return res.status(500).json({
			success: false,
			error_code: "EARNINGS_FETCH_FAILED",
			message: err?.message ?? "Internal error",
			retryable: true,
		});
	}
});
