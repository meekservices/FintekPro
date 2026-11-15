/**
 * Admin Trade & Broker Reconciliation Routes
 * Adheres strictly to FintekPro GCR v1.0 & SEBI System Audit Norms
 *
 * Endpoints:
 *  - GET  /api/admin/reconciliation/latest      — Latest T+1 multi-broker reconciliation report
 *  - GET  /api/admin/reconciliation/history     — Historical reconciliation runs
 *  - POST /api/admin/reconciliation/run         — Trigger manual / on-demand reconciliation
 *  - POST /api/admin/reconciliation/discrepancies/:id/resolve — Resolve or adjust an identified discrepancy
 *
 * @module reconciliation-routes
 * @version 1.0.0
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAdmin } from "../../middleware/roleMiddleware";
import { tradeReconciliationEngine } from "../../services/trade-reconciliation-engine";
import { logger } from "../../logger";

export const tradeReconciliationRouter = Router();
const ROUTE_VERSION = "1.0.0";

const resolveDiscrepancySchema = z.object({
	note: z.string().min(3, "Resolution note must be provided"),
	action: z.enum(["AUTO_SYNC_STATUS", "REFUND_UNLINKED_PAYMENT", "FLAG_FOR_COMPLIANCE_REVIEW", "ADJUST_LEDGER_BALANCE"]).default("AUTO_SYNC_STATUS"),
});

/**
 * GET /api/admin/reconciliation/latest
 * Returns latest reconciliation report.
 */
tradeReconciliationRouter.get("/latest", requireAdmin, async (_req: Request, res: Response) => {
	const startTs = Date.now();
	try {
		const report = await tradeReconciliationEngine.getLatestReport();
		return res.status(200).json({
			success: true,
			data: report,
			meta: {
				timestamp: new Date().toISOString(),
				version: ROUTE_VERSION,
				latencyMs: Date.now() - startTs,
			},
		});
	} catch (err: any) {
		logger.error(`[TradeReconciliationRoutes] Fetch latest failed: ${err.message}`);
		return res.status(500).json({
			success: false,
			error: {
				error_code: "RECONCILIATION_REPORT_ERROR",
				message: err.message,
				retryable: false,
			},
		});
	}
});

/**
 * GET /api/admin/reconciliation/history
 * Returns historical reconciliation runs.
 */
tradeReconciliationRouter.get("/history", requireAdmin, (_req: Request, res: Response) => {
	const startTs = Date.now();
	try {
		const history = tradeReconciliationEngine.getReportsHistory();
		return res.status(200).json({
			success: true,
			data: history,
			meta: {
				total: history.length,
				timestamp: new Date().toISOString(),
				version: ROUTE_VERSION,
				latencyMs: Date.now() - startTs,
			},
		});
	} catch (err: any) {
		logger.error(`[TradeReconciliationRoutes] Fetch history failed: ${err.message}`);
		return res.status(500).json({
			success: false,
			error: {
				error_code: "RECONCILIATION_HISTORY_ERROR",
				message: err.message,
				retryable: false,
			},
		});
	}
});

/**
 * POST /api/admin/reconciliation/run
 * Triggers an on-demand reconciliation run.
 */
tradeReconciliationRouter.post("/run", requireAdmin, async (req: Request, res: Response) => {
	const startTs = Date.now();
	const adminUser = (req as any).user?.email || (req as any).user?.id || "admin";

	try {
		const report = await tradeReconciliationEngine.runReconciliation(adminUser);
		return res.status(200).json({
			success: true,
			data: report,
			meta: {
				timestamp: new Date().toISOString(),
				version: ROUTE_VERSION,
				latencyMs: Date.now() - startTs,
			},
		});
	} catch (err: any) {
		logger.error(`[TradeReconciliationRoutes] Manual reconciliation run failed: ${err.message}`);
		return res.status(500).json({
			success: false,
			error: {
				error_code: "MANUAL_RECONCILIATION_FAILED",
				message: err.message,
				retryable: false,
			},
		});
	}
});

/**
 * POST /api/admin/reconciliation/discrepancies/:id/resolve
 * Resolves a specific discrepancy item.
 */
tradeReconciliationRouter.post("/discrepancies/:id/resolve", requireAdmin, (req: Request, res: Response) => {
	const startTs = Date.now();
	const { id } = req.params;
	const parsed = resolveDiscrepancySchema.safeParse(req.body);

	if (!parsed.success) {
		return res.status(400).json({
			success: false,
			error: {
				error_code: "INVALID_DISCREPANCY_RESOLUTION",
				message: parsed.error.issues.map((i) => i.message).join(", "),
				retryable: false,
			},
		});
	}

	const adminUser = (req as any).user?.email || (req as any).user?.id || "admin";

	try {
		const resolved = tradeReconciliationEngine.resolveDiscrepancy(id, adminUser, parsed.data.note);
		if (!resolved) {
			return res.status(404).json({
				success: false,
				error: {
					error_code: "DISCREPANCY_NOT_FOUND",
					message: `Discrepancy ${id} not found in active discrepancy registry.`,
					retryable: false,
				},
			});
		}

		return res.status(200).json({
			success: true,
			data: resolved,
			meta: {
				timestamp: new Date().toISOString(),
				version: ROUTE_VERSION,
				latencyMs: Date.now() - startTs,
			},
		});
	} catch (err: any) {
		logger.error(`[TradeReconciliationRoutes] Discrepancy resolution failed: ${err.message}`);
		return res.status(500).json({
			success: false,
			error: {
				error_code: "DISCREPANCY_RESOLVE_ERROR",
				message: err.message,
				retryable: false,
			},
		});
	}
});
