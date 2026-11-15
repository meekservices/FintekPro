/**
 * Admin Surveillance & Real-Time Incident Response Routes
 * Adheres strictly to FintekPro GCR v1.0 & SEBI/RBI FASP-AI v1.0
 *
 * Endpoints:
 *  - GET  /api/admin/surveillance/metrics      — Real-time operational surveillance metrics & kill-switch status
 *  - GET  /api/admin/surveillance/incidents    — Paginated/filtered incident stream (runtime, illegal, process flow)
 *  - POST /api/admin/surveillance/kill-switch  — Manually trip or disengage trade/execution kill switch
 *  - POST /api/admin/surveillance/incidents/:id/action — Acknowledge, resolve, or quarantine an incident
 *  - POST /api/admin/surveillance/report       — Ingest an incident report from client/services
 *
 * @module surveillance-routes
 * @version 1.0.0
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAdmin } from "../../middleware/roleMiddleware";
import {
	surveillanceIncidentEngine,
	SurveillanceDomain,
	IncidentSeverity,
	IncidentStatus,
} from "../../services/surveillance-incident-engine";
import { logger } from "../../logger";

export const surveillanceRouter = Router();
const ROUTE_VERSION = "1.0.0";

// ── Validation Schemas ────────────────────────────────────────────────────────

const killSwitchSchema = z.object({
	scope: z.enum(["global", "orders", "mutual_funds", "derivatives", "us_trading"]).default("orders"),
	active: z.boolean(),
	reason: z.string().min(5, "Reason must be at least 5 characters long"),
});

const incidentActionSchema = z.object({
	action: z.enum(["resolve", "acknowledge", "quarantine"]),
	note: z.string().min(3, "Resolution note is required"),
});

const incidentReportSchema = z.object({
	domain: z.enum(["runtime_error", "illegal_activity", "process_flow_error"]),
	errorCode: z.string().min(2),
	severity: z.enum(["low", "medium", "high", "critical"]),
	message: z.string().min(3),
	source: z.string().min(2),
	context: z.record(z.string(), z.unknown()).optional(),
	requiresImmediateHalt: z.boolean().optional(),
});

// ── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/surveillance/metrics
 * Returns real-time metrics, active kill-switch status, and incident breakdown.
 */
surveillanceRouter.get("/metrics", requireAdmin, (req: Request, res: Response) => {
	const startTs = Date.now();
	try {
		const metrics = surveillanceIncidentEngine.getMetrics();
		return res.status(200).json({
			success: true,
			data: metrics,
			meta: {
				timestamp: new Date().toISOString(),
				version: ROUTE_VERSION,
				latencyMs: Date.now() - startTs,
			},
		});
	} catch (err: any) {
		logger.error(`[SurveillanceRoutes] Metrics fetch failed: ${err.message}`);
		return res.status(500).json({
			success: false,
			error: {
				error_code: "SURVEILLANCE_METRICS_ERROR",
				message: err.message,
				retryable: false,
			},
		});
	}
});

/**
 * GET /api/admin/surveillance/incidents
 * Returns filtered list of incidents.
 */
surveillanceRouter.get("/incidents", requireAdmin, (req: Request, res: Response) => {
	const startTs = Date.now();
	try {
		const { domain, severity, status, limit } = req.query;

		const incidents = surveillanceIncidentEngine.getIncidents({
			domain: domain ? (domain as SurveillanceDomain) : undefined,
			severity: severity ? (severity as IncidentSeverity) : undefined,
			status: status ? (status as IncidentStatus) : undefined,
			limit: limit ? Number(limit) : 50,
		});

		return res.status(200).json({
			success: true,
			data: incidents,
			meta: {
				total: incidents.length,
				timestamp: new Date().toISOString(),
				version: ROUTE_VERSION,
				latencyMs: Date.now() - startTs,
			},
		});
	} catch (err: any) {
		logger.error(`[SurveillanceRoutes] Incidents query failed: ${err.message}`);
		return res.status(500).json({
			success: false,
			error: {
				error_code: "SURVEILLANCE_INCIDENTS_QUERY_ERROR",
				message: err.message,
				retryable: false,
			},
		});
	}
});

/**
 * POST /api/admin/surveillance/kill-switch
 * Manually trips or resets the trade/execution kill switch.
 */
surveillanceRouter.post("/kill-switch", requireAdmin, (req: Request, res: Response) => {
	const startTs = Date.now();
	const parsed = killSwitchSchema.safeParse(req.body);
	if (!parsed.success) {
		return res.status(400).json({
			success: false,
			error: {
				error_code: "INVALID_KILL_SWITCH_REQUEST",
				message: parsed.error.issues.map((i) => i.message).join(", "),
				retryable: false,
			},
		});
	}

	const { scope, active, reason } = parsed.data;
	const adminUser = (req as any).user?.email || (req as any).user?.id || "admin";

	try {
		let state;
		if (active) {
			state = surveillanceIncidentEngine.tripKillSwitch(scope, reason, adminUser, false);
		} else {
			state = surveillanceIncidentEngine.resetKillSwitch(scope, adminUser, reason);
		}

		logger.warn(`[SurveillanceRoutes] Kill switch updated: scope=${scope}, active=${active}, by=${adminUser}`);

		return res.status(200).json({
			success: true,
			data: state,
			meta: {
				timestamp: new Date().toISOString(),
				version: ROUTE_VERSION,
				latencyMs: Date.now() - startTs,
			},
		});
	} catch (err: any) {
		logger.error(`[SurveillanceRoutes] Failed to toggle kill switch: ${err.message}`);
		return res.status(500).json({
			success: false,
			error: {
				error_code: "KILL_SWITCH_UPDATE_ERROR",
				message: err.message,
				retryable: false,
			},
		});
	}
});

/**
 * POST /api/admin/surveillance/incidents/:id/action
 * Resolves or overrides an incident.
 */
surveillanceRouter.post("/incidents/:id/action", requireAdmin, async (req: Request, res: Response) => {
	const startTs = Date.now();
	const { id } = req.params;
	const parsed = incidentActionSchema.safeParse(req.body);

	if (!parsed.success) {
		return res.status(400).json({
			success: false,
			error: {
				error_code: "INVALID_ACTION_REQUEST",
				message: parsed.error.issues.map((i) => i.message).join(", "),
				retryable: false,
			},
		});
	}

	const { note } = parsed.data;
	const adminUser = (req as any).user?.email || (req as any).user?.id || "admin";

	try {
		const updated = await surveillanceIncidentEngine.resolveIncident(id, adminUser, note);
		if (!updated) {
			return res.status(404).json({
				success: false,
				error: {
					error_code: "INCIDENT_NOT_FOUND",
					message: `Incident with ID ${id} was not found.`,
					retryable: false,
				},
			});
		}

		return res.status(200).json({
			success: true,
			data: updated,
			meta: {
				timestamp: new Date().toISOString(),
				version: ROUTE_VERSION,
				latencyMs: Date.now() - startTs,
			},
		});
	} catch (err: any) {
		logger.error(`[SurveillanceRoutes] Failed to resolve incident: ${err.message}`);
		return res.status(500).json({
			success: false,
			error: {
				error_code: "INCIDENT_ACTION_ERROR",
				message: err.message,
				retryable: false,
			},
		});
	}
});

/**
 * POST /api/admin/surveillance/report
 * Programmatic ingestion of incidents from other system modules or background workers.
 */
surveillanceRouter.post("/report", requireAdmin, async (req: Request, res: Response) => {
	const startTs = Date.now();
	const parsed = incidentReportSchema.safeParse(req.body);

	if (!parsed.success) {
		return res.status(400).json({
			success: false,
			error: {
				error_code: "INVALID_INCIDENT_REPORT",
				message: parsed.error.issues.map((i) => i.message).join(", "),
				retryable: false,
			},
		});
	}

	try {
		const result = await surveillanceIncidentEngine.reportIncident({
			domain: parsed.data.domain,
			errorCode: parsed.data.errorCode,
			severity: parsed.data.severity,
			message: parsed.data.message,
			source: parsed.data.source,
			context: parsed.data.context as any,
			requiresImmediateHalt: parsed.data.requiresImmediateHalt,
		});

		return res.status(201).json({
			success: true,
			data: result,
			meta: {
				timestamp: new Date().toISOString(),
				version: ROUTE_VERSION,
				latencyMs: Date.now() - startTs,
			},
		});
	} catch (err: any) {
		logger.error(`[SurveillanceRoutes] Failed to report incident: ${err.message}`);
		return res.status(500).json({
			success: false,
			error: {
				error_code: "INCIDENT_REPORT_ERROR",
				message: err.message,
				retryable: false,
			},
		});
	}
});
