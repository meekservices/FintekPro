/**
 * @file upstox-reconciliation-service.ts
 * @description End-of-Day (EOD) and Periodic Post-Trade Order & Position Reconciliation Service
 * for Upstox Demat and Algorithmic Trading accounts (SEBI IA & Stock Broker Compliance).
 */

import { db } from "../db";
import { unifiedOrders, strategyBacktestRuns } from "@shared/schema";
import { eq, and, inArray, gte, lte, desc } from "drizzle-orm";
import { upstoxMarketDataService } from "./upstox-market-data-service";
import { auditLogService } from "./audit-log-service";
import { logger } from "../logger";

export interface UpstoxReconciliationReport {
	id: string;
	timestamp: string;
	exchange: "NSE" | "BSE";
	totalOrdersChecked: number;
	matchedOrders: number;
	mismatchedOrders: number;
	discrepancies: Array<{
		orderId: string;
		orderNumber: string;
		symbol: string;
		expectedStatus: string;
		brokerStatus?: string;
		reason: string;
	}>;
	status: "SUCCESS" | "WARNING" | "FAILED";
	engineVersion: string;
}

export class UpstoxReconciliationService {
	private readonly ENGINE_VERSION = "upstox-reconciliation-v1.0";

	/**
	 * Runs End-of-Day reconciliation across all active Upstox orders for today.
	 * Scheduled at 15:45 IST (weekdays after NSE/BSE closing).
	 */
	async runEODReconciliation(): Promise<UpstoxReconciliationReport> {
		const startMs = Date.now();
		const todayStr = new Date().toISOString().split("T")[0];
		const reportId = `EOD-UPSTOX-${todayStr}-${Date.now()}`;

		logger.info("[UpstoxReconciliation] Starting End-of-Day trade reconciliation...", {
			reportId,
			date: todayStr,
		});

		const discrepancies: UpstoxReconciliationReport["discrepancies"] = [];
		let matchedCount = 0;
		let totalCount = 0;

		try {
			// Query today's orders routed to Upstox / NSE
			const todayOrders = await db
				.select()
				.from(unifiedOrders)
				.where(
					and(
						gte(unifiedOrders.createdAt, new Date(`${todayStr}T00:00:00.000Z`)),
						lte(unifiedOrders.createdAt, new Date(`${todayStr}T23:59:59.999Z`)),
					),
				)
				.limit(500);

			totalCount = todayOrders.length;

			for (const order of todayOrders) {
				const isUpstox =
					(order.metadata as any)?.broker === "UPSTOX" ||
					(order.metadata as any)?.exchange === "NSE" ||
					(order.metadata as any)?.exchange === "BSE";

				if (!isUpstox) continue;

				// Verify order status
				if (order.status === "executed" && !order.executionPrice) {
					discrepancies.push({
						orderId: String(order.id),
						orderNumber: order.orderNumber,
						symbol: (order.metadata as any)?.symbol || "UNKNOWN",
						expectedStatus: "executed",
						reason: "Executed order missing executionPrice in ledger",
					});
				} else if (order.status === "processing" || order.status === "initiated") {
					// Orders still pending at EOD must be flagged
					discrepancies.push({
						orderId: String(order.id),
						orderNumber: order.orderNumber,
						symbol: (order.metadata as any)?.symbol || "UNKNOWN",
						expectedStatus: "executed_or_cancelled",
						brokerStatus: order.status,
						reason: "Order left open past market close (3:30 PM IST)",
					});
				} else {
					matchedCount++;
				}
			}

			const status = discrepancies.length === 0 ? "SUCCESS" : "WARNING";

			const report: UpstoxReconciliationReport = {
				id: reportId,
				timestamp: new Date().toISOString(),
				exchange: "NSE",
				totalOrdersChecked: totalCount,
				matchedOrders: matchedCount,
				mismatchedOrders: discrepancies.length,
				discrepancies,
				status,
				engineVersion: this.ENGINE_VERSION,
			};

			// Log to immutable audit trail
			await auditLogService.log("EOD_RECONCILIATION", "UPSTOX_NSE_EOD", {
				userId: "system",
				userRole: "compliance",
				entityType: "reconciliation_report",
				entityId: reportId,
				newState: {
					totalChecked: totalCount,
					matched: matchedCount,
					discrepanciesCount: discrepancies.length,
					status,
				},
				metadata: {
					requestPath: "cron:upstox-reconciliation",
				},
			});

			logger.info("[UpstoxReconciliation] EOD reconciliation completed", {
				reportId,
				totalChecked: totalCount,
				discrepanciesCount: discrepancies.length,
				latency_ms: Date.now() - startMs,
				status,
			});

			return report;
		} catch (error: any) {
			logger.error("[UpstoxReconciliation] Error during EOD reconciliation", {
				error: error.message,
			});

			return {
				id: reportId,
				timestamp: new Date().toISOString(),
				exchange: "NSE",
				totalOrdersChecked: totalCount,
				matchedOrders: matchedCount,
				mismatchedOrders: discrepancies.length,
				discrepancies,
				status: "FAILED",
				engineVersion: this.ENGINE_VERSION,
			};
		}
	}
}

export const upstoxReconciliationService = new UpstoxReconciliationService();

