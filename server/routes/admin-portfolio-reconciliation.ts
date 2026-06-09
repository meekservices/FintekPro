// @ts-nocheck
/**
 * Admin Portfolio Reconciliation Routes
 *
 * Provides admin and agent access to reconciliation results and discrepancy management.
 *
 * Routes:
 *   GET  /api/admin/reconciliation/summary         → Latest run stats across all clients
 *   GET  /api/admin/reconciliation/discrepancies   → All HIGH/CRITICAL discrepancies (paginated)
 *   GET  /api/admin/reconciliation/client/:id      → Latest reconciliation for a specific client
 *   POST /api/admin/reconciliation/run             → Trigger reconciliation (on-demand)
 *   POST /api/admin/reconciliation/run/:clientId   → Trigger for single client
 *   PATCH /api/admin/reconciliation/resolve/:id    → Mark a discrepancy as resolved
 *
 * Security: requireAdmin (admin role only)
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { requireAdmin } from "../middleware/roleMiddleware";
import { portfolioReconciliationEngine } from "../services/portfolio-reconciliation-engine";
import { logger } from "../logger";

const router = Router();

const API_VERSION = "2.0.0";

function ok(data: unknown) {
	return {
		success: true,
		data,
		meta: { timestamp: new Date().toISOString(), version: API_VERSION },
	};
}
function err(message: string, code = "RECON_ERROR") {
	return {
		success: false,
		error: { error_code: code, message, retryable: false },
		meta: { timestamp: new Date().toISOString(), version: API_VERSION },
	};
}

// ─── GET /summary ─────────────────────────────────────────────────────────────

/**
 * Returns an aggregate summary of the latest reconciliation run:
 * total clients reconciled, total discrepancies by severity, last run time.
 */
router.get("/summary", requireAdmin, async (req: Request, res: Response) => {
	try {
		const result = await db.execute(sql`
      SELECT
        COUNT(DISTINCT client_id)::int                                  AS total_clients,
        SUM(total_discrepancies)::int                                   AS total_discrepancies,
        SUM(critical_count)::int                                        AS critical_count,
        SUM(high_count)::int                                            AS high_count,
        SUM(medium_count)::int                                          AS medium_count,
        SUM(low_count)::int                                             AS low_count,
        COUNT(*) FILTER (WHERE status = 'success')::int                 AS successful_runs,
        COUNT(*) FILTER (WHERE status = 'partial')::int                 AS partial_runs,
        COUNT(*) FILTER (WHERE status = 'error')::int                   AS error_runs,
        MAX(run_at)                                                     AS last_run_at,
        MIN(run_at)                                                     AS first_run_at
      FROM portfolio_reconciliation_log
      WHERE run_at >= NOW() - INTERVAL '24 hours'
    `);

		const rows = (result as any).rows ?? result;
		const summary = rows[0] ?? {};

		// Also get clients with CRITICAL issues
		const criticalClients = await db.execute(sql`
      SELECT client_id, critical_count, high_count, run_at
      FROM portfolio_reconciliation_log
      WHERE run_at >= NOW() - INTERVAL '24 hours'
        AND critical_count > 0
      ORDER BY critical_count DESC
      LIMIT 10
    `);

		return res.json(
			ok({
				summary,
				criticalClients: (criticalClients as any).rows ?? criticalClients,
				generatedAt: new Date().toISOString(),
			}),
		);
	} catch (e: any) {
		logger.error("[ReconAPI] summary error", { message: e.message });
		return res.status(500).json(err(e.message));
	}
});

// ─── GET /discrepancies ───────────────────────────────────────────────────────

/**
 * Returns paginated list of unresolved HIGH/CRITICAL discrepancies.
 * Query: ?severity=CRITICAL,HIGH  ?type=QUANTITY_MISMATCH  ?clientId=xxx
 *         ?resolved=false  ?page=1  ?limit=50
 */
router.get(
	"/discrepancies",
	requireAdmin,
	async (req: Request, res: Response) => {
		try {
			const page = Math.max(
				1,
				Number.parseInt((req.query.page as string) ?? "1", 10),
			);
			const limit = Math.min(
				200,
				Math.max(1, Number.parseInt((req.query.limit as string) ?? "50", 10)),
			);
			const offset = (page - 1) * limit;
			const resolvedFilter = req.query.resolved === "true";
			const severityParam = (req.query.severity as string) ?? "CRITICAL,HIGH";
			const severities = severityParam.split(",").map((s) => s.trim());
			const clientIdParam = req.query.clientId as string | undefined;
			const typeParam = req.query.type as string | undefined;

			const severityList = severities.map((s) => `'${s}'`).join(",");

			const rows = await db.execute(sql`
      SELECT d.*, u.email, u.name
      FROM portfolio_holding_discrepancies d
      LEFT JOIN users u ON u.id = d.client_id
      WHERE d.severity = ANY(ARRAY[${sql.raw(severityList)}]::text[])
        AND d.resolved = ${resolvedFilter}
        ${clientIdParam ? sql`AND d.client_id = ${clientIdParam}` : sql``}
        ${typeParam ? sql`AND d.discrepancy_type = ${typeParam}` : sql``}
      ORDER BY 
        CASE d.severity WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
        d.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

			const countResult = await db.execute(sql`
      SELECT COUNT(*)::int AS total
      FROM portfolio_holding_discrepancies d
      WHERE d.severity = ANY(ARRAY[${sql.raw(severityList)}]::text[])
        AND d.resolved = ${resolvedFilter}
        ${clientIdParam ? sql`AND d.client_id = ${clientIdParam}` : sql``}
        ${typeParam ? sql`AND d.discrepancy_type = ${typeParam}` : sql``}
    `);

			const total = ((countResult as any).rows ?? countResult)[0]?.total ?? 0;

			return res.json(
				ok({
					discrepancies: (rows as any).rows ?? rows,
					pagination: {
						page,
						limit,
						total,
						totalPages: Math.ceil(total / limit),
					},
				}),
			);
		} catch (e: any) {
			logger.error("[ReconAPI] discrepancies error", { message: e.message });
			return res.status(500).json(err(e.message));
		}
	},
);

// ─── GET /client/:clientId ────────────────────────────────────────────────────

/**
 * Returns the latest reconciliation result for a specific client.
 */
router.get(
	"/client/:clientId",
	requireAdmin,
	async (req: Request, res: Response) => {
		try {
			const { clientId } = req.params;

			const logResult = await db.execute(sql`
      SELECT * FROM portfolio_reconciliation_log
      WHERE client_id = ${clientId}
      ORDER BY run_at DESC
      LIMIT 1
    `);

			const discrepancyResult = await db.execute(sql`
      SELECT * FROM portfolio_holding_discrepancies
      WHERE client_id = ${clientId}
        AND resolved = false
      ORDER BY 
        CASE severity WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
        created_at DESC
      LIMIT 50
    `);

			const log = ((logResult as any).rows ?? logResult)[0] ?? null;
			const discrepancies =
				(discrepancyResult as any).rows ?? discrepancyResult;

			return res.json(ok({ log, discrepancies }));
		} catch (e: any) {
			logger.error("[ReconAPI] client detail error", { message: e.message });
			return res.status(500).json(err(e.message));
		}
	},
);

// ─── POST /run ────────────────────────────────────────────────────────────────

/**
 * Triggers an on-demand full reconciliation run (all clients).
 * Runs in the background — returns immediately with a job ID.
 * Admin only.
 */
router.post("/run", requireAdmin, async (req: Request, res: Response) => {
	const start = Date.now();
	const runId = `recon-${Date.now()}`;

	logger.info("[ReconAPI] On-demand full reconciliation triggered", {
		event: "RECON_ADMIN_TRIGGER",
		user_id: (req as any).user?.id,
		runId,
	});

	// Fire in background
	portfolioReconciliationEngine
		.reconcileAllClients()
		.then((stats) => {
			logger.info("[ReconAPI] On-demand reconciliation complete", {
				event: "RECON_ADMIN_DONE",
				runId,
				latency_ms: Date.now() - start,
				...stats,
			});
		})
		.catch((e) => {
			logger.error("[ReconAPI] On-demand reconciliation failed", {
				runId,
				message: e?.message,
			});
		});

	return res.json(
		ok({
			runId,
			message:
				"Portfolio reconciliation started in background. Check /summary in ~2 minutes.",
			triggeredAt: new Date().toISOString(),
		}),
	);
});

// ─── POST /run/:clientId ──────────────────────────────────────────────────────

/**
 * Triggers on-demand reconciliation for a single client.
 * Waits for completion and returns the result.
 */
router.post(
	"/run/:clientId",
	requireAdmin,
	async (req: Request, res: Response) => {
		const { clientId } = req.params;
		const start = Date.now();

		try {
			logger.info(
				"[ReconAPI] Single-client on-demand reconciliation triggered",
				{
					event: "RECON_ADMIN_SINGLE_TRIGGER",
					user_id: (req as any).user?.id,
					target_client: clientId,
				},
			);

			const result =
				await portfolioReconciliationEngine.reconcileClient(clientId);

			logger.info("[ReconAPI] Single-client reconciliation complete", {
				event: "RECON_ADMIN_SINGLE_DONE",
				target_client: clientId,
				latency_ms: Date.now() - start,
				discrepancies: result.summary.total,
			});

			return res.json(ok(result));
		} catch (e: any) {
			logger.error("[ReconAPI] Single-client reconciliation failed", {
				message: e.message,
			});
			return res.status(500).json(err(e.message));
		}
	},
);

// ─── PATCH /resolve/:id ───────────────────────────────────────────────────────

/**
 * Marks a discrepancy as resolved by an admin.
 * Body: { resolution_note: string }
 */
router.patch(
	"/resolve/:id",
	requireAdmin,
	async (req: Request, res: Response) => {
		const { id } = req.params;
		const { resolution_note } = req.body;
		const adminId = (req as any).user?.id;

		if (!resolution_note) {
			return res
				.status(400)
				.json(err("resolution_note is required", "VALIDATION_ERROR"));
		}

		try {
			await db.execute(sql`
      UPDATE portfolio_holding_discrepancies
      SET resolved = true,
          resolved_at = NOW(),
          resolved_by = ${adminId},
          resolution_note = ${resolution_note}
      WHERE id = ${Number.parseInt(id, 10)}
        AND resolved = false
    `);

			logger.info("[ReconAPI] Discrepancy resolved", {
				event: "RECON_DISCREPANCY_RESOLVED",
				user_id: adminId,
				discrepancy_id: id,
			});

			return res.json(
				ok({ id, resolved: true, resolvedAt: new Date().toISOString() }),
			);
		} catch (e: any) {
			logger.error("[ReconAPI] resolve error", { message: e.message });
			return res.status(500).json(err(e.message));
		}
	},
);

export default router;
