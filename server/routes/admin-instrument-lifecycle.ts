/**
 * Instrument Lifecycle Admin Routes
 *
 * Purpose: Admin-facing API endpoints for manual lifecycle management of
 *          instruments (unlisted → pre_ipo → listed transitions, name changes,
 *          ISIN changes). These are the "escape hatch" when automated detection
 *          does not fire.
 *
 * SEBI Compliance:
 *   - All manual overrides are audit-logged with admin user ID
 *   - No automated investment action is taken — only pick status updates
 *   - Requires admin role (enforced via requireAdmin middleware)
 *
 * Endpoints:
 *   POST /api/admin/instruments/lifecycle/override      — manual stage override
 *   POST /api/admin/instruments/lifecycle/sweep         — trigger full sweep now
 *   POST /api/admin/instruments/lifecycle/sweep/pre-ipo — promote sweep only
 *   GET  /api/admin/instruments/lifecycle/events        — audit log
 *   GET  /api/admin/instruments/lifecycle/isin-changes  — ISIN change log
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import { instrumentLifecycleManager } from "../services/instrument-lifecycle-manager";
import { instrumentLifecycleEvents, isinChangeLog } from "@shared/schema";
import { desc, sql } from "drizzle-orm";
import { requireAdmin } from "../middleware/roleMiddleware";

const router = Router();

// ── POST /override ────────────────────────────────────────────────────────────
/**
 * Manually override an instrument's lifecycle stage.
 * Body: { instrumentId, toStage, notes }
 */
router.post(
	"/override",
	requireAdmin,
	async (req: Request, res: Response) => {
		try {
			const { instrumentId, toStage, notes } = req.body as {
				instrumentId: string;
				toStage: string;
				notes?: string;
			};

			if (!instrumentId || !toStage) {
				return res.status(400).json({
					success: false,
					data: null,
					meta: { timestamp: new Date().toISOString(), version: "1.0" },
					error: {
						error_code: "MISSING_PARAMS",
						message: "instrumentId and toStage are required",
						retryable: false,
					},
				});
			}

			const validStages = ["unlisted", "pre_ipo", "listed", "inactive"];
			if (!validStages.includes(toStage)) {
				return res.status(400).json({
					success: false,
					data: null,
					meta: { timestamp: new Date().toISOString(), version: "1.0" },
					error: {
						error_code: "INVALID_STAGE",
						message: `toStage must be one of: ${validStages.join(", ")}`,
						retryable: false,
					},
				});
			}

			const adminId = (req as any).user?.id ?? "unknown";
			const result = await instrumentLifecycleManager.adminOverride(
				instrumentId,
				toStage as any,
				adminId,
				notes ?? "Manual admin override",
			);

			return res.json({
				success: result.success,
				data: { message: result.message },
				meta: { timestamp: new Date().toISOString(), version: "1.0" },
			});
		} catch (err: any) {
			return res.status(500).json({
				success: false,
				data: null,
				meta: { timestamp: new Date().toISOString(), version: "1.0" },
				error: {
					error_code: "LIFECYCLE_OVERRIDE_FAILED",
					message: err?.message ?? "Unknown error",
					retryable: false,
				},
			});
		}
	},
);

// ── POST /sweep ───────────────────────────────────────────────────────────────
/**
 * Trigger the full lifecycle sweep immediately (all 4 tasks).
 */
router.post("/sweep", requireAdmin, async (req: Request, res: Response) => {
	try {
		const result = await instrumentLifecycleManager.runFullSweep();
		return res.json({
			success: true,
			data: {
				promoted: result.promoted.length,
				listed: result.listed.length,
				nameChanges: result.nameChanges.length,
				isinChanges: result.isinChanges.length,
				latencyMs: result.latencyMs,
				details: result,
			},
			meta: { timestamp: new Date().toISOString(), version: "1.0" },
		});
	} catch (err: any) {
		return res.status(500).json({
			success: false,
			data: null,
			meta: { timestamp: new Date().toISOString(), version: "1.0" },
			error: {
				error_code: "LIFECYCLE_SWEEP_FAILED",
				message: err?.message ?? "Unknown error",
				retryable: true,
			},
		});
	}
});

// ── POST /sweep/pre-ipo ───────────────────────────────────────────────────────
/**
 * Trigger only the pre_ipo promotion sweep (unlisted → pre_ipo).
 */
router.post(
	"/sweep/pre-ipo",
	requireAdmin,
	async (req: Request, res: Response) => {
		try {
			const promoted = await instrumentLifecycleManager.promoteToPreIpo();
			return res.json({
				success: true,
				data: {
					promoted: promoted.length,
					instruments: promoted.map((p) => ({
						name: p.instrumentName,
						from: p.fromStage,
						to: p.toStage,
						detectedBy: p.detectedBy,
						picksExpired: p.picksExpired,
						picksCreated: p.picksCreated,
					})),
				},
				meta: { timestamp: new Date().toISOString(), version: "1.0" },
			});
		} catch (err: any) {
			return res.status(500).json({
				success: false,
				data: null,
				meta: { timestamp: new Date().toISOString(), version: "1.0" },
				error: {
					error_code: "PREIPO_SWEEP_FAILED",
					message: err?.message ?? "Unknown error",
					retryable: true,
				},
			});
		}
	},
);

// ── POST /sweep/listing ───────────────────────────────────────────────────────
/**
 * Trigger only the pre_ipo → listed sweep.
 */
router.post(
	"/sweep/listing",
	requireAdmin,
	async (req: Request, res: Response) => {
		try {
			const listed = await instrumentLifecycleManager.sweepPreIpoListings();
			return res.json({
				success: true,
				data: {
					listed: listed.length,
					instruments: listed.map((l) => ({
						name: l.instrumentName,
						exchange: l.exchange,
						symbol: l.exchangeSymbol,
						picksExpired: l.picksExpired,
					})),
				},
				meta: { timestamp: new Date().toISOString(), version: "1.0" },
			});
		} catch (err: any) {
			return res.status(500).json({
				success: false,
				data: null,
				meta: { timestamp: new Date().toISOString(), version: "1.0" },
				error: {
					error_code: "LISTING_SWEEP_FAILED",
					message: err?.message ?? "Unknown error",
					retryable: true,
				},
			});
		}
	},
);

// ── GET /events ────────────────────────────────────────────────────────────────
/**
 * Get instrument lifecycle audit log.
 * Query params: page (default 1), limit (default 50), transitionType
 */
router.get("/events", requireAdmin, async (req: Request, res: Response) => {
	try {
		const page = Math.max(1, Number(req.query.page) || 1);
		const limit = Math.min(100, Number(req.query.limit) || 50);
		const offset = (page - 1) * limit;

		const events = await db
			.select()
			.from(instrumentLifecycleEvents)
			.orderBy(desc(instrumentLifecycleEvents.createdAt))
			.limit(limit)
			.offset(offset);

		const totalResult = await db.execute(
			sql`SELECT COUNT(*)::int as total FROM instrument_lifecycle_events`,
		);
		const total = (totalResult as any).rows?.[0]?.total ?? 0;

		return res.json({
			success: true,
			data: events,
			meta: {
				timestamp: new Date().toISOString(),
				version: "1.0",
				page,
				limit,
				total,
			},
		});
	} catch (err: any) {
		return res.status(500).json({
			success: false,
			data: null,
			meta: { timestamp: new Date().toISOString(), version: "1.0" },
			error: {
				error_code: "EVENTS_FETCH_FAILED",
				message: err?.message,
				retryable: false,
			},
		});
	}
});

// ── GET /isin-changes ──────────────────────────────────────────────────────────
/**
 * Get ISIN change log.
 */
router.get(
	"/isin-changes",
	requireAdmin,
	async (req: Request, res: Response) => {
		try {
			const page = Math.max(1, Number(req.query.page) || 1);
			const limit = Math.min(100, Number(req.query.limit) || 50);
			const offset = (page - 1) * limit;

			const changes = await db
				.select()
				.from(isinChangeLog)
				.orderBy(desc(isinChangeLog.detectedAt))
				.limit(limit)
				.offset(offset);

			return res.json({
				success: true,
				data: changes,
				meta: {
					timestamp: new Date().toISOString(),
					version: "1.0",
					page,
					limit,
				},
			});
		} catch (err: any) {
			return res.status(500).json({
				success: false,
				data: null,
				meta: { timestamp: new Date().toISOString(), version: "1.0" },
				error: {
					error_code: "ISIN_CHANGES_FETCH_FAILED",
					message: err?.message,
					retryable: false,
				},
			});
		}
	},
);

export default router;
