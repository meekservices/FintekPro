/**
 * Compliance Gate Routes
 *
 * Exposes a pre-flight readiness check so the frontend can show compliance
 * warnings BEFORE the user attempts a transaction, rather than failing at
 * the point of submission.
 *
 * GET /api/compliance/transaction-readiness?type=MF|US_EQUITY
 *  → Returns all 7 gate statuses for the current authenticated user
 */

import {
	type Express,
	type Request,
	type Response,
	type NextFunction,
} from "express";
import { isAuthenticated } from "../auth-setup";
import {
	runComplianceChecks,
	type TransactionType,
} from "../middleware/transactionComplianceGate";
import { logger } from "../logger";

function requireAuth(req: Request, res: Response, next: NextFunction) {
	return isAuthenticated(req, res, next);
}

export function registerComplianceGateRoutes(app: Express): void {
	/**
	 * GET /api/compliance/transaction-readiness
	 *
	 * Returns per-gate compliance status for the current user.
	 * The frontend uses this to render a compliance checklist widget
	 * before the invest/order form is submitted.
	 *
	 * Query params:
	 *   type — 'MF' (default) | 'US_EQUITY'
	 *   action — 'purchase' (default) | 'redemption' | 'sip' | 'stp'
	 */
	app.get(
		"/api/compliance/transaction-readiness",
		requireAuth,
		async (req: Request, res: Response) => {
			const userId = (req as any).user?.id as string;
			const rawType = ((req.query.type as string) ?? "MF").toUpperCase();
			const transactionType: TransactionType =
				rawType === "US_EQUITY" ? "US_EQUITY" : "MF";
			const action = (req.query.action as string) ?? "purchase";

			const startMs = Date.now();

			try {
				const result = await runComplianceChecks(userId, transactionType, res, {
					action: action as any,
				});

				logger.info("TRANSACTION_READINESS_CHECKED", {
					user_id: userId,
					transaction_type: transactionType,
					overall_ready: result.passed,
					latency_ms: Date.now() - startMs,
					status: "ok",
				});

				return res.status(200).json({
					success: true,
					data: {
						ready: result.passed,
						transactionType,
						gates: result.gates.map((g) => ({
							gate: g.gate,
							name: g.gateName,
							passed: g.passed,
							errorCode: g.errorCode ?? null,
							message: g.message ?? null,
							retryable: g.retryable,
							remediationUrl: g.remediationUrl ?? null,
						})),
						summary: result.passed
							? "All compliance checks passed. You are ready to transact."
							: `Blocked at Gate ${result.failingGate?.gate}: ${result.failingGate?.gateName}`,
					},
					meta: {
						timestamp: new Date().toISOString(),
						version: "1.0",
					},
				});
			} catch (err) {
				logger.error("[ComplianceGate] Readiness check error", {
					user_id: userId,
					err,
				});
				return res.status(500).json({
					success: false,
					error: "COMPLIANCE_CHECK_FAILED",
					message: "Unable to complete compliance check. Please try again.",
					meta: { timestamp: new Date().toISOString(), version: "1.0" },
				});
			}
		},
	);
}
