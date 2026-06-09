/**
 * Order Operations Cron Domain
 *
 * Unified investment orders: stale payment cleanup, processing timeout,
 * KYC upgrade reminders.
 * All jobs are production-only.
 */

import cron from "node-cron";
import { isProductionEnvironment } from "./utils/enrichment-guard";

export function initializeOrderOpsCrons(): void {
	if (!isProductionEnvironment()) {
		console.log(
			"⏭️ [ExpiryWarning/StaleOrders/ProcessingTimeout/KYCReminders] Skipped (development mode - production only)",
		);
		return;
	}

	// ── Stale unified order cleanup — every 6 hours ────────────────────────────
	// Auto-cancel orders stuck in 'initiated' or 'payment_pending' for > 24 hours
	cron.schedule("0 */6 * * *", async () => {
		console.log("[CRON] Starting stale order cleanup...");
		try {
			const { db } = await import("./db");
			const { unifiedOrders, users } = await import("@shared/schema");
			const { eq, and, lt, inArray } = await import("drizzle-orm");

			const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
			const staleOrders = await db
				.select({
					id: unifiedOrders.id,
					orderNumber: unifiedOrders.orderNumber,
					userId: unifiedOrders.userId,
					productName: unifiedOrders.productName,
					amount: unifiedOrders.amount,
					status: unifiedOrders.status,
					createdAt: unifiedOrders.createdAt,
				})
				.from(unifiedOrders)
				.where(
					and(
						inArray(unifiedOrders.status, ["initiated", "payment_pending"]),
						lt(unifiedOrders.createdAt, twentyFourHoursAgo),
					),
				)
				.limit(100);

			if (staleOrders.length === 0) {
				console.log("[CRON] No stale orders found");
				return;
			}

			let cancelled = 0;
			let failed = 0;
			for (const order of staleOrders) {
				try {
					await db
						.update(unifiedOrders)
						.set({
							status: "expired",
							paymentStatus: "expired",
							executionStatus: "cancelled",
							failureReason:
								"Order expired - no payment received within 24 hours",
							updatedAt: new Date(),
						} as any)
						.where(eq(unifiedOrders.id, order.id));

					console.log(
						`[CRON] Order ${order.orderNumber} expired (created: ${order.createdAt})`,
					);
					cancelled++;

					try {
						const { emailService } = await import("./email-service");
						const user = await db
							.select()
							.from(users)
							.where(eq(users.id, order.userId ?? ""))
							.limit(1);
						if (user[0]?.email) {
							const productName = order.productName || "Product";
							const orderAmount = order.amount
								? Number.parseFloat(order.amount).toLocaleString("en-IN")
								: "N/A";
							await emailService.sendEmail({
								to: user[0].email,
								subject: `❌ Order Expired - ${order.orderNumber}`,
								html: `<h2>Order Expired</h2><p>Your order <strong>${order.orderNumber}</strong> for <strong>${productName}</strong> has expired due to incomplete payment. Amount: ₹${orderAmount}. Please place a new order if you still wish to proceed.</p>`,
								text: `Your order ${order.orderNumber} for ${productName} has expired. Amount: ₹${orderAmount}. Please place a new order if you still wish to proceed.`,
							});
						}
					} catch (notifyErr) {
						console.error(
							`[CRON] Failed to send expiry notification for order ${order.orderNumber}:`,
							notifyErr,
						);
					}
				} catch (orderError: any) {
					console.error(
						`[CRON] Failed to expire order ${order.orderNumber}:`,
						orderError.message,
					);
					failed++;
				}
			}
			console.log(
				`[CRON] Stale order cleanup: ${cancelled} expired, ${failed} failed`,
			);
		} catch (error: any) {
			console.error("[CRON] Stale order cleanup failed:", error.message);
		}
	});

	// ── Processing order timeout — every hour at :15 ────────────────────────────
	// Auto-fail orders stuck in 'processing' for > 4 hours (execution failure)
	cron.schedule("15 * * * *", async () => {
		console.log("[CRON] Checking for stuck processing orders...");
		try {
			const { db } = await import("./db");
			const { unifiedOrders } = await import("@shared/schema");
			const { eq, and, lt } = await import("drizzle-orm");

			const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
			const stuckOrders = await db
				.select({
					id: unifiedOrders.id,
					orderNumber: unifiedOrders.orderNumber,
					status: unifiedOrders.status,
					updatedAt: unifiedOrders.updatedAt,
				})
				.from(unifiedOrders)
				.where(
					and(
						eq(unifiedOrders.status, "processing"),
						lt(unifiedOrders.updatedAt, fourHoursAgo),
					),
				)
				.limit(50);

			if (stuckOrders.length === 0) {
				console.log("[CRON] No stuck processing orders found");
				return;
			}

			let flagged = 0;
			for (const order of stuckOrders) {
				try {
					await db
						.update(unifiedOrders)
						.set({
							status: "execution_failed",
							executionStatus: "failed",
							failureReason:
								"Order processing timed out - requires manual review",
							updatedAt: new Date(),
						} as any)
						.where(eq(unifiedOrders.id, order.id));
					console.warn(
						`[CRON] Order ${order.orderNumber} marked execution_failed (stuck since: ${order.updatedAt})`,
					);
					flagged++;
				} catch (orderError: any) {
					console.error(
						`[CRON] Failed to flag stuck order ${order.orderNumber}:`,
						orderError.message,
					);
				}
			}
			console.log(
				`[CRON] Stuck order check: ${flagged} orders flagged for review`,
			);
		} catch (error: any) {
			console.error("[CRON] Stuck order check failed:", error.message);
		}
	});

	// ── KYC upgrade reminders — every 4 hours at :30 ───────────────────────────
	cron.schedule("30 */4 * * *", async () => {
		console.log("[CRON] Processing KYC upgrade reminders...");
		try {
			const { kycUpgradeNotificationService } = await import(
				"./services/kyc-upgrade-notification-service"
			);
			const stats =
				await kycUpgradeNotificationService.processScheduledReminders();
			console.log(
				`[CRON] KYC reminders: processed ${stats.processed}, sent ${stats.sent}`,
			);
		} catch (error: any) {
			console.error("[CRON] KYC reminder job failed:", error.message);
		}
	});

	// ── Alpaca Order Reconciliation — every 4 hours at :00 ─────────────────────
	cron.schedule("0 */4 * * *", async () => {
		console.log("[CRON] Starting Alpaca order reconciliation...");
		try {
			const { alpacaReconciliationService } = await import(
				"./services/alpaca/trading/reconciliationService"
			);
			const stats = await alpacaReconciliationService.reconcileAllUsers();
			console.log(
				`[CRON] Alpaca reconciliation complete. Synced: ${stats.totalSynced} orders.`,
			);
		} catch (error: any) {
			console.error("[CRON] Alpaca reconciliation job failed:", error.message);
		}
	});
}
