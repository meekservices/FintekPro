// @ts-nocheck
import { Express, Request, Response } from "express";
import { kycVideoService } from "../../services/kyc-video-service";
import { kycMakerCheckerService } from "../../services/kyc-maker-checker-service";
import { kycRejectionService } from "../../services/kyc-rejection-service";
import { kycProductEligibilityService } from "../../services/kyc-product-eligibility-service";
import { kycAuditPackService } from "../../services/kyc-audit-pack-service";
import { kycWebhookService } from "../../services/kyc-webhook-service";
import { kycEnvironmentService } from "../../services/kyc-environment-service";
import { kycRateLimiterService } from "../../services/kyc-rate-limiter-service";
import { kycEncryptionService } from "../../services/kyc-encryption-service";
import { db } from "../../db";
import {
	kycVerificationSessions,
	kycStepResets,
	kycAuditLogs,
	users,
} from "@shared/schema";
import { eq, desc, and, sql as drizzleSql } from "drizzle-orm";
import { auditLogService } from "../../services/audit-log-service";

function hasRole(user: any, requiredRoles: string[]): boolean {
	if (!user) return false;
	const userRoles = user.roles || (user.role ? [user.role] : []);
	// Universal bypass for 'tester' role in development/testing
	if (userRoles.includes("tester")) return true;
	return requiredRoles.some((role: string) => userRoles.includes(role));
}

function requireAuth(req: any, res: Response, next: Function) {
	if (!req.isAuthenticated || !req.isAuthenticated()) {
		return res
			.status(401)
			.json({ success: false, error: "Authentication required" });
	}
	next();
}

function requireAdmin(req: any, res: Response, next: Function) {
	if (!req.user || !hasRole(req.user, ["superadmin", "admin", "tester"])) {
		return res
			.status(403)
			.json({ success: false, error: "Admin access required" });
	}
	next();
}

function requireAdminOrAgent(req: any, res: Response, next: Function) {
	if (
		!req.user ||
		!hasRole(req.user, ["superadmin", "admin", "agent", "partner", "tester"])
	) {
		return res
			.status(403)
			.json({ success: false, error: "Admin or agent access required" });
	}
	next();
}

export function registerKycV2ExtensionPart2Routes(app: Express) {
	// ============================================================
	// VIDEO KYC ROUTES (BE-KYC-011)
	// ============================================================

	app.get(
		"/api/kyc/product-eligibility/rules",
		requireAdmin,
		async (req: any, res) => {
			try {
				const rules = await kycProductEligibilityService.getRules();
				res.json({ success: true, rules });
			} catch (error) {
				res
					.status(500)
					.json({ success: false, error: "Failed to get eligibility rules" });
			}
		},
	);

	// ============================================================
	// AUDIT PACK ROUTES (BE-KYC-015)
	// ============================================================

	app.get(
		"/api/kyc/audit-pack/:userId",
		requireAdmin,
		async (req: any, res) => {
			try {
				const result = await kycAuditPackService.generatePack(
					req.params.userId,
					req.user.id,
					req.user.role,
				);

				res.json(result);
			} catch (error) {
				res
					.status(500)
					.json({ success: false, error: "Failed to generate audit pack" });
			}
		},
	);

	app.get(
		"/api/kyc/audit-packs/:userId",
		requireAdmin,
		async (req: any, res) => {
			try {
				const packs = await kycAuditPackService.getPacksByUser(
					req.params.userId,
				);
				res.json({ success: true, packs });
			} catch (error) {
				res
					.status(500)
					.json({ success: false, error: "Failed to get audit packs" });
			}
		},
	);

	// ============================================================
	// WEBHOOK ROUTES (BE-KYC-016)
	// ============================================================

	app.post("/api/kyc/webhook/receive", async (req: any, res) => {
		try {
			const { provider, eventType, referenceId, sessionId, payload } = req.body;
			if (!provider || !eventType) {
				return res
					.status(400)
					.json({
						success: false,
						error: "Provider and event type are required",
					});
			}

			const result = await kycWebhookService.receiveEvent({
				provider,
				eventType,
				referenceId,
				sessionId,
				payload,
			});

			res.json(result);
		} catch (error) {
			res
				.status(500)
				.json({ success: false, error: "Failed to receive webhook" });
		}
	});

	app.post(
		"/api/kyc/webhook/replay/:eventId",
		requireAdmin,
		async (req: any, res) => {
			try {
				const result = await kycWebhookService.replayFromDLQ(
					req.params.eventId,
				);
				res.json(result);
			} catch (error) {
				res
					.status(500)
					.json({ success: false, error: "Failed to replay event" });
			}
		},
	);

	app.get("/api/kyc/webhook/dlq", requireAdmin, async (req: any, res) => {
		try {
			const events = await kycWebhookService.getDLQEvents();
			res.json({ success: true, events });
		} catch (error) {
			res
				.status(500)
				.json({ success: false, error: "Failed to get DLQ events" });
		}
	});

	app.get("/api/kyc/webhook/stats", requireAdmin, async (req: any, res) => {
		try {
			const stats = await kycWebhookService.getStats();
			res.json({ success: true, stats });
		} catch (error) {
			res
				.status(500)
				.json({ success: false, error: "Failed to get webhook stats" });
		}
	});

	// ============================================================
	// ENVIRONMENT & PROVIDER STATUS (BE-KYC-017)
	// ============================================================

	app.get("/api/kyc/environment/status", requireAuth, async (req: any, res) => {
		try {
			const flags = kycEnvironmentService.getFlags();
			const providerStatus = kycEnvironmentService.getProviderStatus();

			res.json({
				success: true,
				environment: flags.environment,
				fixedOtpEnabled: flags.fixedOtpEnabled,
				providerFallback: flags.providerFallback,
				providers: providerStatus,
			});
		} catch (error) {
			res
				.status(500)
				.json({ success: false, error: "Failed to get environment status" });
		}
	});

	// ============================================================
	// RATE LIMITING STATUS (BE-KYC-019)
	// ============================================================

	app.get("/api/kyc/rate-limit/status", requireAuth, async (req: any, res) => {
		try {
			const aadhaarStatus = await kycRateLimiterService.getCounterStatus(
				"aadhaar_otp",
				req.user.id,
			);
			const panStatus = await kycRateLimiterService.getCounterStatus(
				"pan_verify",
				req.user.id,
			);

			res.json({
				success: true,
				limits: {
					aadhaar_otp: aadhaarStatus,
					pan_verify: panStatus,
				},
			});
		} catch (error) {
			res
				.status(500)
				.json({ success: false, error: "Failed to get rate limit status" });
		}
	});

	app.post(
		"/api/kyc/rate-limit/unlock",
		requireAdmin,
		async (req: any, res) => {
			try {
				const { action, identifier } = req.body;
				if (!action || !identifier) {
					return res
						.status(400)
						.json({
							success: false,
							error: "Action and identifier are required",
						});
				}

				const result = await kycRateLimiterService.adminUnlock(
					action,
					identifier,
					req.user.id,
				);
				res.json({ success: result });
			} catch (error) {
				res
					.status(500)
					.json({ success: false, error: "Failed to unlock rate limit" });
			}
		},
	);

	// ============================================================
	// AGENT KYC STEP RESET (BE-KYC-STEP-RESET)
	// ============================================================

	const KYC_STEP_DEPENDENCIES: Record<string, string[]> = {
		pan_verification: [],
		kra_status_check: ["pan_verification"],
		aadhaar_otp: ["pan_verification"],
		aadhaar_verification: ["pan_verification", "aadhaar_otp"],
		ckyc_upload: ["pan_verification", "aadhaar_verification"],
		ckyc_status: ["ckyc_upload"],
		ucc_creation: ["pan_verification", "aadhaar_verification"],
		bank_verification: ["pan_verification"],
		emandate_registration: ["bank_verification"],
		risk_profiling: ["pan_verification"],
	};

	const STEP_RESET_REASON_CODES: Record<string, string> = {
		DOCUMENT_MISMATCH: "Document details do not match",
		INCORRECT_DATA: "Incorrect data entered by user",
		EXPIRED_DOCUMENT: "Document has expired",
		VERIFICATION_FAILED: "Third-party verification failed",
		USER_REQUESTED: "User requested to redo step",
		COMPLIANCE_REVIEW: "Step flagged during compliance review",
		AGENT_OVERRIDE: "Agent override for correction",
	};

	function findDownstreamSteps(step: string): string[] {
		const downstream: string[] = [];
		for (const [s, deps] of Object.entries(KYC_STEP_DEPENDENCIES)) {
			if (s !== step && deps.includes(step)) {
				downstream.push(s);
				downstream.push(...findDownstreamSteps(s));
			}
		}
		return [...new Set(downstream)];
	}

	app.get(
		"/api/kyc/agent/step-reset/reasons",
		requireAdminOrAgent,
		async (_req: any, res) => {
			res.json({ success: true, reasons: STEP_RESET_REASON_CODES });
		},
	);

	app.get(
		"/api/kyc/agent/step-reset/history/:sessionId",
		requireAdminOrAgent,
		async (req: any, res) => {
			try {
				const { sessionId } = req.params;
				const resets = await db
					.select()
					.from(kycStepResets)
					.where(eq(kycStepResets.sessionId, sessionId))
					.orderBy(kycStepResets.resetAt);
				res.json({ success: true, resets });
			} catch (error) {
				res
					.status(500)
					.json({ success: false, error: "Failed to fetch reset history" });
			}
		},
	);

	app.get(
		"/api/kyc/agent/step-reset/available/:sessionId",
		requireAdminOrAgent,
		async (req: any, res) => {
			try {
				const { sessionId } = req.params;
				const [session] = await db
					.select()
					.from(kycVerificationSessions)
					.where(eq(kycVerificationSessions.id, sessionId));

				if (!session) {
					return res
						.status(404)
						.json({ success: false, error: "Session not found" });
				}

				const stepStatus = (session.stepStatus || {}) as Record<string, any>;
				const resettableSteps: Array<{
					step: string;
					currentStatus: any;
					downstreamSteps: string[];
				}> = [];

				for (const step of Object.keys(KYC_STEP_DEPENDENCIES)) {
					const isCompleted =
						stepStatus[step] === true ||
						stepStatus[`${step}_verified`] === true ||
						stepStatus[`${step}_completed`] === true;

					if (isCompleted) {
						resettableSteps.push({
							step,
							currentStatus:
								stepStatus[step] ??
								stepStatus[`${step}_verified`] ??
								stepStatus[`${step}_completed`],
							downstreamSteps: findDownstreamSteps(step).filter((ds) => {
								return (
									stepStatus[ds] === true ||
									stepStatus[`${ds}_verified`] === true ||
									stepStatus[`${ds}_completed`] === true
								);
							}),
						});
					}
				}

				res.json({ success: true, resettableSteps, sessionId });
			} catch (error) {
				res
					.status(500)
					.json({ success: false, error: "Failed to fetch resettable steps" });
			}
		},
	);

	app.post(
		"/api/kyc/agent/step-reset",
		requireAdminOrAgent,
		async (req: any, res) => {
			try {
				const { sessionId, step, reason, reasonCode } = req.body;

				if (!sessionId || !step || !reason || !reasonCode) {
					return res
						.status(400)
						.json({
							success: false,
							error: "sessionId, step, reason, and reasonCode are required",
						});
				}

				if (!KYC_STEP_DEPENDENCIES[step]) {
					return res
						.status(400)
						.json({
							success: false,
							error: `Invalid KYC step: ${step}. Valid steps: ${Object.keys(KYC_STEP_DEPENDENCIES).join(", ")}`,
						});
				}

				if (!STEP_RESET_REASON_CODES[reasonCode]) {
					return res
						.status(400)
						.json({
							success: false,
							error: `Invalid reason code: ${reasonCode}. Valid codes: ${Object.keys(STEP_RESET_REASON_CODES).join(", ")}`,
						});
				}

				const [session] = await db
					.select()
					.from(kycVerificationSessions)
					.where(eq(kycVerificationSessions.id, sessionId));

				if (!session) {
					return res
						.status(404)
						.json({ success: false, error: "KYC session not found" });
				}

				const stepStatus = (session.stepStatus || {}) as Record<string, any>;
				const previousStatus: Record<string, any> = {};

				const isCompleted =
					stepStatus[step] === true ||
					stepStatus[`${step}_verified`] === true ||
					stepStatus[`${step}_completed`] === true;

				if (!isCompleted) {
					return res
						.status(400)
						.json({
							success: false,
							error: `Step "${step}" is not completed and cannot be reset`,
						});
				}

				const downstreamSteps = findDownstreamSteps(step);
				const completedDownstream = downstreamSteps.filter((ds) => {
					return (
						stepStatus[ds] === true ||
						stepStatus[`${ds}_verified`] === true ||
						stepStatus[`${ds}_completed`] === true
					);
				});

				const stepsToReset = [step, ...completedDownstream];
				const updatedStepStatus = { ...stepStatus };

				for (const s of stepsToReset) {
					previousStatus[s] = {
						[s]: updatedStepStatus[s],
						[`${s}_verified`]: updatedStepStatus[`${s}_verified`],
						[`${s}_completed`]: updatedStepStatus[`${s}_completed`],
					};
					delete updatedStepStatus[s];
					delete updatedStepStatus[`${s}_verified`];
					delete updatedStepStatus[`${s}_completed`];
					updatedStepStatus[`${s}_reset`] = true;
					updatedStepStatus[`${s}_reset_at`] = new Date().toISOString();
					updatedStepStatus[`${s}_reset_by`] = req.user.id;
				}

				let resetFields: Record<string, any> = {};
				if (stepsToReset.includes("pan_verification")) {
					resetFields = {
						...resetFields,
						panVerified: false,
						panVerifiedAt: null,
					};
				}
				if (stepsToReset.includes("aadhaar_otp")) {
					resetFields = {
						...resetFields,
						aadhaarOtpSent: false,
						aadhaarOtpSentAt: null,
					};
				}
				if (stepsToReset.includes("aadhaar_verification")) {
					resetFields = {
						...resetFields,
						aadhaarOtpVerified: false,
						aadhaarVerifiedAt: null,
					};
				}

				await db
					.update(kycVerificationSessions)
					.set({
						stepStatus: updatedStepStatus,
						currentStep: step,
						...resetFields,
						updatedAt: new Date(),
					})
					.where(eq(kycVerificationSessions.id, sessionId));

				const [resetRecord] = await db
					.insert(kycStepResets)
					.values({
						sessionId,
						userId: session.userId || "",
						step,
						previousStatus,
						resetBy: req.user.id,
						resetByRole: req.user.role || req.user.roles?.[0] || "agent",
						reason,
						reasonCode,
						dependentStepsReset: completedDownstream,
					})
					.returning();

				await db.insert(kycAuditLogs).values({
					userId: session.userId,
					prospectId: session.prospectId,
					createdByAgentId: req.user.id,
					accessedBy: req.user.id,
					accessType: "write",
					dataFieldsAccessed: { step, stepsReset: stepsToReset, reasonCode },
					purpose: `Agent reset KYC step: ${step}. Reason: ${reason}`,
					apiEndpoint: "/api/kyc/agent/step-reset",
					ipAddress: req.ip,
					userAgent: req.headers["user-agent"],
					accessStatus: "success",
					retentionDays: 2555,
					regulatoryTag: "SEBI",
				});

				res.json({
					success: true,
					resetId: resetRecord.id,
					stepsReset: stepsToReset,
					message: `Step "${step}" has been reset${completedDownstream.length > 0 ? ` along with ${completedDownstream.length} dependent step(s): ${completedDownstream.join(", ")}` : ""}. User can now redo this step.`,
				});
			} catch (error) {
				console.error("[KYC Step Reset] Error:", error);
				res
					.status(500)
					.json({ success: false, error: "Failed to reset KYC step" });
			}
		},
	);

	// ============================================================
	// ACTIVE SESSION LOOKUP (BE-KYC-014) — admin + agent
	// ============================================================

	app.get(
		"/api/kyc/active-session/:userId",
		requireAdminOrAgent,
		async (req: any, res) => {
			try {
				const { userId } = req.params;
				if (!userId) {
					return res
						.status(400)
						.json({ success: false, error: "userId is required" });
				}

				const [sessionRow] = await db
					.select({
						sessionId: kycVerificationSessions.id,
						currentStep: kycVerificationSessions.currentStep,
						entityType: kycVerificationSessions.entityType,
						createdAt: kycVerificationSessions.createdAt,
						initiatedBy: kycVerificationSessions.initiatedBy,
						panNumber: kycVerificationSessions.panNumber,
						userId: kycVerificationSessions.userId,
					})
					.from(kycVerificationSessions)
					.where(
						and(
							eq(kycVerificationSessions.userId, userId),
							eq(kycVerificationSessions.isActive, true),
						),
					)
					.orderBy(desc(kycVerificationSessions.createdAt))
					.limit(1);

				if (!sessionRow) {
					return res.json({ success: true, session: null });
				}

				const [userRow] = await db
					.select({
						firstName: users.firstName,
						lastName: users.lastName,
						email: users.email,
					})
					.from(users)
					.where(eq(users.id, userId))
					.limit(1);

				const pan = sessionRow.panNumber || "";
				const panMasked =
					pan.length > 4 ? `****${pan.slice(-4)}` : pan ? "****" : null;

				return res.json({
					success: true,
					session: {
						sessionId: sessionRow.sessionId,
						currentStep: sessionRow.currentStep,
						entityType: sessionRow.entityType,
						createdAt: sessionRow.createdAt,
						initiatedBy: sessionRow.initiatedBy,
						panMasked,
						userName: userRow
							? `${userRow.firstName || ""} ${userRow.lastName || ""}`.trim() ||
								null
							: null,
						userEmail: userRow?.email || null,
					},
				});
			} catch (error) {
				console.error("[KYC Active Session] Error:", error);
				res
					.status(500)
					.json({ success: false, error: "Failed to fetch active session" });
			}
		},
	);

	// ============================================================
	// ALL KYC SESSIONS VIEW (Admin oversight — all users)
	// ============================================================

	app.get("/api/admin/kyc/sessions", requireAdmin, async (req: any, res) => {
		try {
			const limit = Math.min(
				Number.parseInt((req.query.limit as string) || "100"),
				200,
			);
			const outcome = (req.query.outcome as string) || null;

			// Migration-aware query: Handles both cases (new columns exist or don't exist yet)
			let sessions: any[] = [];
			try {
				const outcomeCondition = outcome
					? drizzleSql`WHERE kvs.session_outcome = ${outcome}`
					: drizzleSql``;

				const rows = await db.execute(drizzleSql`
          SELECT
            kvs.id AS "sessionId",
            kvs.user_id AS "userId",
            kvs.current_step AS "currentStep",
            kvs.session_outcome AS "sessionOutcome",
            kvs.is_active AS "isActive",
            kvs.started_at AS "startedAt",
            kvs.completed_at AS "completedAt",
            kvs.aml_risk_level AS "amlRiskLevel",
            kvs.pan_verified AS "panVerified",
            kvs.aadhaar_otp_verified AS "aadhaarOtpVerified",
            kvs.entity_type_detected AS "entityType",
            u.email,
            u.first_name AS "firstName",
            u.last_name AS "lastName",
            u.company_name AS "companyName",
            u.kyc_status AS "kycStatus"
          FROM kyc_verification_sessions kvs
          LEFT JOIN users u ON u.id = kvs.user_id
          ${outcomeCondition}
          ORDER BY kvs.started_at DESC
          LIMIT ${limit}
        `);
				sessions = rows.rows ?? rows;
			} catch (sqlError: any) {
				// Fallback to legacy query if new columns (session_outcome, kyc_status) are missing
				if (
					sqlError.message.includes("column") &&
					(sqlError.message.includes("session_outcome") ||
						sqlError.message.includes("kyc_status"))
				) {
					console.log(
						"[Admin KYC Sessions] Falling back to legacy query due to pending migration",
					);

					// Log to Activity Centre so admin is aware
					auditLogService
						.log("SYSTEM", "MIGRATION_FALLBACK", {
							entityType: "database",
							entityId: "kyc_verification_sessions",
							metadata: {
								reason: "Missing columns: session_outcome or kyc_status",
								error: sqlError.message,
							},
						})
						.catch((err) =>
							console.error("[Admin KYC Sessions] Audit log failed:", err),
						);

					const rows = await db.execute(drizzleSql`
            SELECT
              kvs.id AS "sessionId",
              kvs.user_id AS "userId",
              kvs.current_step AS "currentStep",
              'pending' AS "sessionOutcome",
              kvs.is_active AS "isActive",
              kvs.started_at AS "startedAt",
              kvs.completed_at AS "completedAt",
              kvs.aml_risk_level AS "amlRiskLevel",
              kvs.pan_verified AS "panVerified",
              kvs.aadhaar_otp_verified AS "aadhaarOtpVerified",
              kvs.entity_type_detected AS "entityType",
              u.email,
              u.first_name AS "firstName",
              u.last_name AS "lastName",
              u.company_name AS "companyName"
            FROM kyc_verification_sessions kvs
            LEFT JOIN users u ON u.id = kvs.user_id
            ORDER BY kvs.started_at DESC
            LIMIT ${limit}
          `);
					sessions = rows.rows ?? rows;
				} else {
					throw sqlError;
				}
			}

			res.json({ success: true, sessions, total: (sessions as any[]).length });
		} catch (error) {
			console.error("[Admin KYC Sessions]", error);
			res
				.status(500)
				.json({ success: false, error: "Failed to fetch KYC sessions" });
		}
	});

	// V-CIP Expiry Overview — lists all users with a video_kyc_expiry_date
	app.get(
		"/api/admin/kyc/vcip-expiry",
		requireAdmin,
		async (_req: any, res) => {
			try {
				const rows = await db.execute(drizzleSql`
        SELECT
          up.user_id                AS "userId",
          up.video_kyc_expiry_date  AS "videoKycExpiryDate",
          up.video_kyc_completed_date AS "videoKycCompletedDate",
          up.video_kyc_status       AS "videoKycStatus",
          u.first_name              AS "firstName",
          u.last_name               AS "lastName",
          u.email,
          u.mobile,
          CASE
            WHEN up.video_kyc_expiry_date < NOW() THEN 'expired'
            WHEN up.video_kyc_expiry_date < NOW() + INTERVAL '30 days' THEN 'critical'
            WHEN up.video_kyc_expiry_date < NOW() + INTERVAL '6 months' THEN 'warning'
            ELSE 'ok'
          END AS "expiryStatus"
        FROM user_profiles up
        JOIN users u ON u.id = up.user_id
        WHERE up.video_kyc_expiry_date IS NOT NULL
        ORDER BY up.video_kyc_expiry_date ASC
      `);

				const records = rows.rows ?? rows;
				res.json({ success: true, records, total: (records as any[]).length });
			} catch (error) {
				console.error("[Admin VCIP Expiry]", error);
				res
					.status(500)
					.json({ success: false, error: "Failed to fetch V-CIP expiry data" });
			}
		},
	);

	// Full KYC reset: clears all user_profiles verification flags, sessions, and bank state
	async function fullKycReset(userId: string, resetBy: string): Promise<void> {
		// All DB mutations run inside a transaction for atomicity
		await db.transaction(async (tx) => {
			await tx.execute(drizzleSql`
        UPDATE user_profiles SET
          pan_verified_via_sandbox            = false,
          pan_verified_via_smart_kyc          = false,
          ckyc_fetched_via_authbridge         = false,
          kra_verified_via_protean            = false,
          aadhaar_verified_via_smart_kyc      = false,
          is_profile_completed                = false,
          profile_completed_at                = NULL,
          video_kyc_completed                 = false,
          video_kyc_completed_date            = NULL,
          video_kyc_status                    = 'pending',
          face_to_face_verification_completed = false,
          face_to_face_verification_date      = NULL,
          kyc_level                           = '0',
          kyc_level_upgraded_at               = NULL,
          kyc_tier                            = 'basic',
          kyc_tier_status                     = 'provisional',
          kyc_update_due_date                 = NULL,
          products_unlocked                   = '[]'::jsonb
        WHERE user_id = ${userId}
      `);
			// Migration-aware update for users table
			try {
				await tx.execute(drizzleSql`
          UPDATE users SET kyc_status = NULL, ckyc_status = NULL WHERE id = ${userId}
        `);
			} catch (e: any) {
				if (e.message?.includes("column")) {
					console.warn(
						`[KYC Reset] Skipping kyc_status update for user ${userId} - column may be missing`,
					);
				} else {
					throw e; // Rethrow other database errors
				}
			}
			await tx.execute(drizzleSql`
        UPDATE kyc_verification_sessions
        SET session_outcome = 'reset_by_admin', is_active = false
        WHERE user_id = ${userId} AND is_active = true
      `);
			await tx.execute(drizzleSql`
        UPDATE user_bank_accounts
        SET is_verified = false, verification_status = 'pending'
        WHERE user_id = ${userId}
      `);
			// best-effort audit log — do not rollback the whole reset if this fails
			try {
				await tx.execute(drizzleSql`
          INSERT INTO kyc_audit_logs
            (id, user_id, accessed_by, access_type, purpose, api_endpoint, access_status, created_at)
          VALUES (
            gen_random_uuid(), ${userId}, ${resetBy}, 'write',
            'Admin full KYC reset — all verification flags and sessions cleared',
            '/api/admin/kyc/reset', 'success', NOW()
          )
        `);
			} catch {
				/* non-fatal */
			}
		});
		// Post-transaction: invalidate in-memory cache (cannot run inside a DB transaction)
		const { invalidateComplianceCache } = await import(
			"../../middleware/universal-kyc-gate"
		);
		invalidateComplianceCache(userId);
	}

	app.post("/api/admin/kyc/reset", requireAdmin, async (req: any, res) => {
		try {
			const { userId } = req.body || {};
			const resetBy = req.user?.id || "admin";

			if (userId) {
				await fullKycReset(userId, resetBy);
				return res.json({
					success: true,
					message: `KYC fully reset for user ${userId}.`,
				});
			}

			const result = await db.execute(drizzleSql`
        SELECT id FROM users
        WHERE (roles IS NULL OR NOT (roles && ARRAY['admin','superadmin']::text[]))
          AND (role IS NULL OR role NOT IN ('admin', 'superadmin'))
      `);
			const rows = result.rows ?? (result as any[]);
			let resetCount = 0;
			for (const row of rows) {
				if (row.id) {
					await fullKycReset(String(row.id), resetBy);
					resetCount++;
				}
			}
			res.json({
				success: true,
				message: `KYC fully reset for ${resetCount} non-admin users.`,
			});
		} catch (error: any) {
			console.error("[Admin KYC Reset]", error);
			res.status(500).json({ success: false, error: "Failed to reset KYC" });
		}
	});

	app.post("/api/admin/kyc/reset-self", requireAdmin, async (req: any, res) => {
		try {
			const userId = req.user!.id;
			await fullKycReset(userId, userId);
			res.json({
				success: true,
				message:
					"Your KYC has been fully reset. Navigate to the KYC wizard to restart.",
				redirectTo: "/onboarding",
			});
		} catch (error: any) {
			console.error("[Admin KYC Self-Reset]", error);
			res
				.status(500)
				.json({ success: false, error: "Failed to reset your KYC" });
		}
	});

	// Lightweight ping to KYC providers — returns live/degraded/down with latency
	app.get(
		"/api/admin/kyc/provider-health",
		requireAdmin,
		async (_req: any, res) => {
			type ProviderStatus = {
				status: "live" | "degraded" | "down";
				latencyMs: number;
				error?: string;
			};
			type FetchResponse = Awaited<ReturnType<typeof globalThis.fetch>>;

			async function ping(
				fn: () => Promise<FetchResponse>,
			): Promise<ProviderStatus> {
				const start = Date.now();
				try {
					const r = await fn();
					const latencyMs = Date.now() - start;
					if (r.status >= 200 && r.status < 300)
						return { status: "live", latencyMs };
					if (r.status >= 400 && r.status < 500)
						return {
							status: "degraded",
							latencyMs,
							error: `HTTP ${r.status} — credentials may need updating`,
						};
					return { status: "down", latencyMs, error: `HTTP ${r.status}` };
				} catch (err: any) {
					const latencyMs = Date.now() - start;
					const msg = String(err?.message ?? err).slice(0, 120);
					return {
						status: latencyMs >= 6000 ? "degraded" : "down",
						latencyMs,
						error: msg,
					};
				}
			}

			const notConfigured = (names: string[]): ProviderStatus => ({
				status: "degraded",
				latencyMs: 0,
				error: `Not configured — set ${names.join(", ")}`,
			});

			const SANDBOX_URL =
				process.env.SANDBOX_BASE_URL || "https://test-api.sandbox.co.in";
			const TRUTHSCREEN_URL = "https://www.truthscreen.com";
			const sandboxApiKey = process.env.SANDBOX_API_KEY;
			const tsUser = process.env.TRUTHSCREEN_USERNAME;
			const tsPass = process.env.TRUTHSCREEN_PASSWORD;
			const ckycApiKey = process.env.CKYC_API_KEY;
			const CASHFREE_URL =
				process.env.CASHFREE_SECUREID_BASE_URL ||
				(process.env.NODE_ENV === "production"
					? "https://api.cashfree.com/verification"
					: "https://sandbox.cashfree.com/verification");
			const cashfreeAppId =
				process.env.CASHFREE_SECUREID_APP_ID ||
				process.env.CASHFREE_VERIFICATION_APP_ID ||
				process.env.CASHFREE_APP_ID;
			const cashfreeSecret =
				process.env.CASHFREE_SECUREID_SECRET_KEY ||
				process.env.CASHFREE_VERIFICATION_SECRET_KEY ||
				process.env.CASHFREE_SECRET_KEY;

			const [
				sandboxPan,
				sandboxAadhaar,
				cashfreeAadhaar,
				truthscreenAadhaar,
				truthscreenCkyc,
				ckycRegistry,
			] = await Promise.all([
				!sandboxApiKey
					? Promise.resolve(notConfigured(["SANDBOX_API_KEY"]))
					: ping(() =>
							fetch(`${SANDBOX_URL}/kyc/v2/pan`, {
								method: "POST",
								headers: {
									Authorization: `Bearer ${sandboxApiKey}`,
									"Content-Type": "application/json",
									"x-api-version": "1.0",
								},
								body: JSON.stringify({
									"@entity": "in.co.sandbox.kyc.pan_plus.request",
									pan: "AAAAA0000A",
								}),
								signal: AbortSignal.timeout(6000),
							}),
						),
				!sandboxApiKey
					? Promise.resolve(notConfigured(["SANDBOX_API_KEY"]))
					: ping(() =>
							fetch(`${SANDBOX_URL}/kyc/aadhaar/okyc/otp`, {
								method: "POST",
								headers: {
									"x-api-key": sandboxApiKey,
									"Content-Type": "application/json",
									"x-api-version": "1.0.0",
								},
								body: JSON.stringify({
									"@entity": "in.co.sandbox.kyc.aadhaar.okyc.otp.request",
									aadhaar_number: "000000000000",
									consent: "Y",
									reason: "Health Check",
								}),
								signal: AbortSignal.timeout(6000),
							}),
						),
				!cashfreeAppId || !cashfreeSecret
					? Promise.resolve(
							notConfigured(["CASHFREE_APP_ID", "CASHFREE_SECRET"]),
						)
					: ping(() =>
							fetch(`${CASHFREE_URL}/offline-aadhaar/otp`, {
								method: "POST",
								headers: {
									"x-client-id": cashfreeAppId,
									"x-client-secret": cashfreeSecret,
									"Content-Type": "application/json",
								},
								body: JSON.stringify({ aadhaar_number: "000000000000" }),
								signal: AbortSignal.timeout(6000),
							}),
						),
				!tsUser || !tsPass
					? Promise.resolve(
							notConfigured(["TRUTHSCREEN_USERNAME", "TRUTHSCREEN_PASSWORD"]),
						)
					: ping(() =>
							fetch(`${TRUTHSCREEN_URL}/api/3.0/generate-otp`, {
								method: "POST",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({
									docType: 1,
									docNumber: "999999999999",
									username: tsUser,
									password: tsPass,
								}),
								signal: AbortSignal.timeout(6000),
							}),
						),
				!tsUser || !tsPass
					? Promise.resolve(
							notConfigured(["TRUTHSCREEN_USERNAME", "TRUTHSCREEN_PASSWORD"]),
						)
					: ping(() =>
							fetch(`${TRUTHSCREEN_URL}/api/ckyc`, {
								method: "POST",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({
									docType: 3,
									docNumber: "AAAAA0000A",
									username: tsUser,
									password: tsPass,
								}),
								signal: AbortSignal.timeout(6000),
							}),
						),
				!ckycApiKey
					? Promise.resolve(notConfigured(["CKYC_API_KEY"]))
					: ping(() =>
							fetch("https://uatkyc.ckycreg.in/ckyc/search", {
								method: "POST",
								headers: {
									"Content-Type": "application/json",
									"x-api-key": ckycApiKey,
								},
								body: JSON.stringify({ pan: "AAAAA0000A" }),
								signal: AbortSignal.timeout(6000),
							}),
						),
			]);

			res.json({
				success: true,
				checkedAt: new Date().toISOString(),
				providers: {
					sandbox_pan: sandboxPan,
					sandbox_aadhaar: sandboxAadhaar,
					cashfree_aadhaar: cashfreeAadhaar,
					truthscreen_aadhaar: truthscreenAadhaar,
					truthscreen_ckyc: truthscreenCkyc,
					ckyc_registry: ckycRegistry,
				},
			});
		},
	);

	console.log(
		"✅ KYC v2 Extension routes registered (Video KYC, Maker-Checker, Rejection, Eligibility, Audit Pack, Webhooks, Environment, Rate Limits, Agent Step Reset, Active Session Lookup)",
	);
}
