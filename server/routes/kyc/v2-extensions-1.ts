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
import { maskEmail, maskMobile, maskPan } from "../../utils/pii-utils";

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

export function registerKycV2ExtensionPart1Routes(app: Express) {
	// ============================================================
	// VIDEO KYC ROUTES (BE-KYC-011)
	// ============================================================

	app.post("/api/kyc/video/initiate", requireAuth, async (req: any, res) => {
		try {
			const { sessionId, reason, scheduledAt } = req.body;
			if (!sessionId) {
				return res
					.status(400)
					.json({ success: false, error: "Session ID is required" });
			}

			const result = await kycVideoService.initiate({
				sessionId,
				userId: req.user.id,
				reason: reason || "ADMIN_REQUEST",
				scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
				initiatedBy: req.user.id,
				initiatedByRole: req.user.role,
			});

			res.json(result);
		} catch (error) {
			res
				.status(500)
				.json({ success: false, error: "Failed to initiate Video KYC" });
		}
	});

	app.post(
		"/api/kyc/video/complete",
		requireAdminOrAgent,
		async (req: any, res) => {
			try {
				const {
					videoKycId,
					status,
					recordingHash,
					officerNotes,
					failureReason,
				} = req.body;
				if (!videoKycId || !recordingHash) {
					return res
						.status(400)
						.json({
							success: false,
							error: "Video KYC ID and recording hash are required",
						});
				}

				const result = await kycVideoService.complete({
					videoKycId,
					officerId: req.user.id,
					status: status || "COMPLETED",
					recordingHash,
					officerNotes,
					failureReason,
				});

				res.json(result);
			} catch (error) {
				res
					.status(500)
					.json({ success: false, error: "Failed to complete Video KYC" });
			}
		},
	);

	app.get("/api/kyc/video/:sessionId", requireAuth, async (req: any, res) => {
		try {
			const result = await kycVideoService.getSession(req.params.sessionId);
			res.json(result);
		} catch (error) {
			res
				.status(500)
				.json({ success: false, error: "Failed to get Video KYC session" });
		}
	});

	app.get(
		"/api/kyc/video/user/sessions",
		requireAuth,
		async (req: any, res) => {
			try {
				const sessions = await kycVideoService.getSessionsByUser(req.user.id);
				res.json({ success: true, sessions });
			} catch (error) {
				res
					.status(500)
					.json({ success: false, error: "Failed to get Video KYC sessions" });
			}
		},
	);

	app.get(
		"/api/kyc/video/admin/pending",
		requireAdminOrAgent,
		async (req: any, res) => {
			try {
				const sessions = await kycVideoService.getPendingSessions();

				// Mask User ID if it looks like an email or mobile
				const maskedSessions = sessions.map((session) => ({
					...session,
					userId: session.userId.includes("@")
						? maskEmail(session.userId)
						: session.userId.match(/^\d{10}$/)
							? maskMobile(session.userId)
							: session.userId,
				}));

				res.json({ success: true, sessions: maskedSessions });
			} catch (error) {
				res
					.status(500)
					.json({ success: false, error: "Failed to get pending sessions" });
			}
		},
	);

	// ============================================================
	// MAKER-CHECKER ROUTES (BE-KYC-012)
	// ============================================================

	app.post(
		"/api/kyc/approval/submit",
		requireAdminOrAgent,
		async (req: any, res) => {
			try {
				const { sessionId, userId, entityType, makerNotes } = req.body;
				if (!sessionId || !userId || !entityType) {
					return res
						.status(400)
						.json({
							success: false,
							error: "Session ID, user ID, and entity type are required",
						});
				}

				const result = await kycMakerCheckerService.submit({
					sessionId,
					userId,
					entityType,
					makerId: req.user.id,
					makerNotes,
				});

				res.json(result);
			} catch (error) {
				res
					.status(500)
					.json({ success: false, error: "Failed to submit for approval" });
			}
		},
	);

	app.post("/api/kyc/approval/approve", requireAdmin, async (req: any, res) => {
		try {
			const { approvalId, notes } = req.body;
			if (!approvalId) {
				return res
					.status(400)
					.json({ success: false, error: "Approval ID is required" });
			}

			const result = await kycMakerCheckerService.approve({
				approvalId,
				checkerId: req.user.id,
				checkerIpAddress: req.ip,
				notes,
			});

			res.json(result);
		} catch (error) {
			res.status(500).json({ success: false, error: "Failed to approve" });
		}
	});

	app.post("/api/kyc/approval/reject", requireAdmin, async (req: any, res) => {
		try {
			const { approvalId, notes, rejectionReason } = req.body;
			if (!approvalId) {
				return res
					.status(400)
					.json({ success: false, error: "Approval ID is required" });
			}

			const result = await kycMakerCheckerService.reject({
				approvalId,
				checkerId: req.user.id,
				checkerIpAddress: req.ip,
				notes,
				rejectionReason,
			});

			res.json(result);
		} catch (error) {
			res.status(500).json({ success: false, error: "Failed to reject" });
		}
	});

	app.get("/api/kyc/approval/pending", requireAdmin, async (req: any, res) => {
		try {
			const approvals = await kycMakerCheckerService.getPendingApprovals();

			const maskedApprovals = approvals.map((approval) => ({
				...approval,
				userId: approval.userId.includes("@")
					? maskEmail(approval.userId)
					: approval.userId.match(/^\d{10}$/)
						? maskMobile(approval.userId)
						: approval.userId,
				makerId: approval.makerId.includes("@")
					? maskEmail(approval.makerId)
					: approval.makerId,
			}));

			res.json({ success: true, approvals: maskedApprovals });
		} catch (error) {
			res
				.status(500)
				.json({ success: false, error: "Failed to get pending approvals" });
		}
	});

	app.get("/api/kyc/approval/history", requireAdmin, async (req: any, res) => {
		try {
			const limit = Number.parseInt(req.query.limit as string) || 50;
			const approvals = await kycMakerCheckerService.getApprovalHistory(limit);

			const maskedApprovals = approvals.map((approval) => ({
				...approval,
				userId: approval.userId.includes("@")
					? maskEmail(approval.userId)
					: approval.userId.match(/^\d{10}$/)
						? maskMobile(approval.userId)
						: approval.userId,
				makerId: approval.makerId.includes("@")
					? maskEmail(approval.makerId)
					: approval.makerId,
				checkerId: approval.checkerId?.includes("@")
					? maskEmail(approval.checkerId)
					: approval.checkerId,
			}));

			res.json({ success: true, approvals: maskedApprovals });
		} catch (error) {
			res
				.status(500)
				.json({ success: false, error: "Failed to get approval history" });
		}
	});

	// ============================================================
	// REJECTION & RE-KYC ROUTES (BE-KYC-013)
	// ============================================================

	app.post("/api/kyc/reject", requireAdminOrAgent, async (req: any, res) => {
		try {
			const {
				sessionId,
				userId,
				reasonCode,
				reasonDescription,
				rekycRequired,
			} = req.body;
			if (!sessionId || !userId || !reasonCode) {
				return res
					.status(400)
					.json({
						success: false,
						error: "Session ID, user ID, and reason code are required",
					});
			}

			const result = await kycRejectionService.reject({
				sessionId,
				userId,
				reasonCode,
				reasonDescription,
				rejectedBy: req.user.id,
				rejectedByRole: req.user.role,
				rekycRequired,
			});

			res.json(result);
		} catch (error) {
			res.status(500).json({ success: false, error: "Failed to reject KYC" });
		}
	});

	app.post("/api/kyc/resubmit", requireAuth, async (req: any, res) => {
		try {
			const { oldSessionId } = req.body;
			if (!oldSessionId) {
				return res
					.status(400)
					.json({ success: false, error: "Old session ID is required" });
			}

			const result = await kycRejectionService.resubmit({
				oldSessionId,
				userId: req.user.id,
				initiatedBy: req.user.id,
				initiatedByRole: req.user.role,
			});

			res.json(result);
		} catch (error) {
			res.status(500).json({ success: false, error: "Failed to resubmit KYC" });
		}
	});

	// ============================================================
	// USER-INITIATED RE-KYC: Verified Document Change Request
	// Regulatory basis: SEBI KYC Master Circular 2024 —
	// changes to PAN/DOB on a verified KYC require fresh re-verification.
	// ============================================================

	app.post(
		"/api/kyc/request-document-change",
		requireAuth,
		async (req: any, res) => {
			try {
				const { field, newValue, reason, notes } = req.body;
				const userId = req.user.id;

				const validFields: Record<string, string> = {
					panNumber: "PAN Number",
					dateOfBirth: "Date of Birth",
				};
				const validReasons: Record<string, string> = {
					DATA_ENTRY_ERROR: "Data entry error during original KYC",
					DOB_CORRECTION: "Date of birth correction (e.g., wrong year entered)",
					PAN_CORRECTION: "PAN card correction / replacement by IT Dept",
					MARRIAGE_NAME: "Name change due to marriage (linked to PAN)",
					LEGAL_NAME_CHANGE: "Legal name/DOB change (court order)",
					OTHER: "Other (describe in notes)",
				};

				if (!field || !validFields[field]) {
					return res
						.status(400)
						.json({
							success: false,
							error:
								"Invalid field. Only panNumber and dateOfBirth changes require Re-KYC.",
						});
				}
				if (!reason || !validReasons[reason]) {
					return res
						.status(400)
						.json({ success: false, error: "A valid reason is required." });
				}
				if (!newValue || !newValue.trim()) {
					return res
						.status(400)
						.json({ success: false, error: "New value is required." });
				}
				if (
					field === "panNumber" &&
					!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(newValue.toUpperCase())
				) {
					return res
						.status(400)
						.json({
							success: false,
							error: "Invalid PAN format. Must be like ABCDE1234F.",
						});
				}

				const trackingId = `RKC-${Date.now().toString(36).toUpperCase()}-${userId.slice(-4).toUpperCase()}`;

				await db.insert(kycAuditLogs).values({
					userId,
					accessedBy: userId,
					accessType: "document_change_request",
					dataFieldsAccessed: [field],
					purpose: `Re-KYC request — ${validFields[field]} change: ${validReasons[reason]}${notes ? ` | Notes: ${notes.trim().substring(0, 500)}` : ""}`,
					apiEndpoint: "/api/kyc/request-document-change",
					ipAddress: (
						req.ip ||
						req.socket?.remoteAddress ||
						"unknown"
					).toString(),
					userAgent: req.headers["user-agent"] || "unknown",
					requestId: trackingId,
					regulatoryPurpose: "KYC",
					accessStatus: "pending",
					complianceCheckPassed: false,
				} as any);

				return res.json({
					success: true,
					trackingId,
					message: `Your request to update ${validFields[field]} has been received and logged.`,
					expectedTimeline: "5–10 business days",
					nextSteps: [
						"Our compliance team will review your request within 2 business days.",
						"You will receive an email/SMS with a link to complete the Re-KYC process.",
						"Your existing KYC status and all services remain active during this process.",
						"If the change is approved, a fresh KYC verification session will be initiated.",
					],
					regulatoryNote:
						"As per SEBI KYC Master Circular 2024 and PMLA Rules 2005, any change to PAN or Date of Birth on a verified KYC record requires a fresh KYC verification (Re-KYC).",
				});
			} catch (error: any) {
				console.error("[KYC Document Change Request]", error);
				res
					.status(500)
					.json({
						success: false,
						error:
							"Failed to submit document change request. Please try again.",
					});
			}
		},
	);

	app.post("/api/kyc/dispute", requireAuth, async (req: any, res) => {
		try {
			const { rejectionId, disputeNotes } = req.body;
			if (!rejectionId || !disputeNotes) {
				return res
					.status(400)
					.json({
						success: false,
						error: "Rejection ID and dispute notes are required",
					});
			}

			const result = await kycRejectionService.fileDispute({
				rejectionId,
				disputeNotes,
				filedBy: req.user.id,
			});

			res.json(result);
		} catch (error) {
			res.status(500).json({ success: false, error: "Failed to file dispute" });
		}
	});

	app.get("/api/kyc/disputes", requireAdmin, async (req: any, res) => {
		try {
			const status = req.query.status as string | undefined;
			const disputes = await kycRejectionService.getDisputes(status);
			res.json({ success: true, disputes });
		} catch (error) {
			res.status(500).json({ success: false, error: "Failed to get disputes" });
		}
	});

	app.get(
		"/api/kyc/rejections/user/:userId",
		requireAuth,
		async (req: any, res) => {
			try {
				const targetUserId = req.params.userId;
				const requester = req.user;
				const isPrivileged =
					requester.role === "admin" ||
					requester.role === "agent" ||
					requester.role === "superadmin";
				if (!isPrivileged && requester.id !== targetUserId) {
					return res
						.status(403)
						.json({
							success: false,
							error: "Forbidden: you may only view your own rejection records",
						});
				}
				const rejections =
					await kycRejectionService.getRejectionsByUser(targetUserId);
				res.json({ success: true, rejections });
			} catch (error) {
				res
					.status(500)
					.json({ success: false, error: "Failed to get rejections" });
			}
		},
	);

	app.get("/api/kyc/rejection-reasons", requireAuth, async (req: any, res) => {
		try {
			const reasons = kycRejectionService.getReasonCodes();
			res.json({ success: true, reasons });
		} catch (error) {
			res
				.status(500)
				.json({ success: false, error: "Failed to get rejection reasons" });
		}
	});

	// ============================================================
	// PRODUCT ELIGIBILITY ROUTES (BE-KYC-014)
	// ============================================================

	app.get(
		"/api/kyc/product-eligibility",
		requireAuth,
		async (req: any, res) => {
			try {
				const profile = req.user;
				const userState = {
					kycTier: profile.kycTier || "basic",
					kycTierStatus: profile.kycTierStatus || "provisional",
					amlRiskLevel: profile.amlRiskLevel || null,
					fatcaSigned: profile.fatcaStatus === "Y",
					videoKycDone: false,
					makerCheckerApproved: false,
					femaCompliant: false,
				};

				const eligibility =
					await kycProductEligibilityService.checkEligibility(userState);
				res.json({ success: true, eligibility });
			} catch (error) {
				res
					.status(500)
					.json({
						success: false,
						error: "Failed to check product eligibility",
					});
			}
		},
	);

	// ============================================================
	// KYC GAP SUGGESTIONS ENDPOINT (BE-KYC-GAPS)
	// ============================================================

	app.get("/api/kyc/gap", requireAuth, async (req: any, res) => {
		try {
			const { productCode } = req.query;

			// productCode is required — gap is always product-specific
			if (!productCode || typeof productCode !== "string") {
				return res
					.status(400)
					.json({
						success: false,
						error: "productCode query parameter is required",
					});
			}

			const profile = req.user;

			// Admin/compliance roles never see KYC gaps — they have full access
			const adminRoles = [
				"superadmin",
				"admin",
				"master_agent",
				"compliance_officer",
				"compliance_team",
				"bd_head",
				"bd_team",
				"finance_head",
				"finance_team",
				"ops_head",
				"ops_team",
				"hr_head",
				"hr_team",
				"tech_head",
				"tech_backend",
				"tech_frontend",
				"tech_devops",
				"regulatory_auditor",
				"tester",
			];
			const userRoles: string[] =
				profile.roles || (profile.role ? [profile.role] : ["user"]);
			const isAdmin = userRoles.some((r: string) => adminRoles.includes(r));

			if (isAdmin) {
				return res.json({ success: true, hasGap: false, isAdmin: true });
			}

			const userState = {
				kycTier: profile.kycTier || "basic",
				kycTierStatus: profile.kycTierStatus || "provisional",
				amlRiskLevel: profile.amlRiskLevel || null,
				fatcaSigned: profile.fatcaStatus === "Y",
				videoKycDone: false,
				makerCheckerApproved: false,
				femaCompliant: false,
			};

			// Determine role category for messaging
			const isSubAgent = userRoles.some((r: string) => r === "sub_agent");
			const isAgent = userRoles.some((r: string) =>
				["agent", "associate"].includes(r),
			);
			const isPartner = userRoles.some((r: string) =>
				["partner", "partner_ops"].includes(r),
			);

			let roleCategory: "client" | "agent" | "partner" | "sub_agent" = "client";
			if (isSubAgent) roleCategory = "sub_agent";
			else if (isAgent) roleCategory = "agent";
			else if (isPartner) roleCategory = "partner";

			// Sub-agents cannot execute transactions directly
			if (roleCategory === "sub_agent") {
				return res.json({
					success: true,
					hasGap: true,
					roleCategory,
					message:
						"Transaction execution is handled by your supervising partner/agent. Please contact them to proceed.",
					missingItems: [],
					currentTier: userState.kycTier,
					requiredTier: null,
					productCode: productCode || null,
					wizardDeepLink: null,
				});
			}

			// Fetch eligibility for the given product
			const eligibility = await kycProductEligibilityService.checkSingleProduct(
				productCode,
				userState,
			);

			if (!eligibility) {
				return res.json({
					success: true,
					hasGap: false,
					productCode,
					message: "Product not found in eligibility matrix",
				});
			}

			// Build structured missing items list with human-readable labels & wizard deep-links
			const CONDITION_META: Record<
				string,
				{ label: string; description: string; wizardStep: number }
			> = {
				AML_OK: {
					label: "AML Screening",
					description: "Anti-money laundering risk check must pass",
					wizardStep: 5,
				},
				FATCA_SIGNED: {
					label: "FATCA Declaration",
					description: "Foreign Account Tax Compliance declaration required",
					wizardStep: 5,
				},
				VIDEO_KYC_DONE: {
					label: "Video KYC",
					description: "Live video verification with a KYC officer",
					wizardStep: 4,
				},
				MAKER_CHECKER_APPROVED: {
					label: "Manual Approval",
					description: "Compliance team review and approval required",
					wizardStep: 5,
				},
				FEMA_COMPLIANT: {
					label: "FEMA Compliance",
					description: "Foreign Exchange Management Act compliance declaration",
					wizardStep: 5,
				},
			};

			const TIER_META: Record<
				string,
				{ label: string; description: string; wizardStep: number }
			> = {
				basic: {
					label: "Basic KYC",
					description: "Complete PAN + Aadhaar verification",
					wizardStep: 1,
				},
				enhanced: {
					label: "Enhanced KYC",
					description: "Bank linking + additional document verification",
					wizardStep: 3,
				},
				accredited_investor: {
					label: "Accredited Investor KYC",
					description:
						"Full verification including net worth proof and Video KYC",
					wizardStep: 4,
				},
			};

			const missingItems: Array<{
				key: string;
				label: string;
				description: string;
				wizardStep: number;
				type: "tier" | "condition" | "limit";
			}> = [];
			// Start at Infinity so the first item properly sets the lowest step
			let lowestWizardStep = Number.POSITIVE_INFINITY;

			if (!eligibility.eligible) {
				// Check if tier upgrade needed
				const tierOrder = ["basic", "enhanced", "accredited_investor"];
				const currentTierIdx = tierOrder.indexOf(userState.kycTier);
				const requiredTierIdx = tierOrder.indexOf(eligibility.requiredTier);

				if (currentTierIdx < requiredTierIdx) {
					const tierMeta = TIER_META[eligibility.requiredTier];
					if (tierMeta) {
						missingItems.push({
							key: `tier_${eligibility.requiredTier}`,
							label: `Upgrade to ${tierMeta.label}`,
							description: tierMeta.description,
							wizardStep: tierMeta.wizardStep,
							type: "tier",
						});
						lowestWizardStep = Math.min(lowestWizardStep, tierMeta.wizardStep);
					}
				}

				// Check missing conditions
				for (const cond of eligibility.missingConditions) {
					const meta = CONDITION_META[cond];
					if (meta) {
						missingItems.push({
							key: cond,
							label: meta.label,
							description: meta.description,
							wizardStep: meta.wizardStep,
							type: "condition",
						});
						lowestWizardStep = Math.min(lowestWizardStep, meta.wizardStep);
					} else {
						missingItems.push({
							key: cond,
							label: cond.replace(/_/g, " "),
							description: "Required for product eligibility",
							wizardStep: 1,
							type: "condition",
						});
						lowestWizardStep = Math.min(lowestWizardStep, 1);
					}
				}
			}

			// Check for transaction amount limits (eligible but limited by max amount cap)
			let amountLimitMessage: string | null = null;
			if (eligibility.maxAmount && eligibility.maxAmount > 0) {
				const formattedLimit = new Intl.NumberFormat("en-IN", {
					style: "currency",
					currency: "INR",
					maximumFractionDigits: 0,
				}).format(eligibility.maxAmount);
				amountLimitMessage = `Your current KYC tier limits transactions to ${formattedLimit}. Complete Enhanced KYC to raise this limit.`;
				missingItems.push({
					key: "amount_limit",
					label: `Transaction limit: ${formattedLimit}`,
					description: amountLimitMessage,
					wizardStep: 3,
					type: "limit",
				});
				lowestWizardStep = Math.min(lowestWizardStep, 3);
			}

			const hasGap = !eligibility.eligible || missingItems.length > 0;
			// If lowestWizardStep is still Infinity (no missing items), no deep-link needed
			const resolvedStep = Number.isFinite(lowestWizardStep)
				? lowestWizardStep
				: 1;
			const wizardDeepLink =
				missingItems.length > 0 ? `/onboarding?step=${resolvedStep}` : null;

			// Role-specific messaging
			const roleMessages: Record<typeof roleCategory, string> = {
				client:
					"Complete your personal KYC verification to access this product.",
				agent:
					"Your empanelment or KYC certification is incomplete. Complete the required steps to enable transactions for your clients.",
				partner:
					"Your partner empanelment requirements are incomplete. Please complete the certification gaps to proceed.",
				sub_agent:
					"Contact your supervising partner/agent to execute this transaction.",
			};

			return res.json({
				success: true,
				hasGap,
				roleCategory,
				message: hasGap ? roleMessages[roleCategory] : null,
				missingItems,
				currentTier: userState.kycTier,
				requiredTier: eligibility?.requiredTier || null,
				productCode: productCode || null,
				productName: eligibility?.productName || null,
				wizardDeepLink,
				amountLimitMessage,
			});
		} catch (error) {
			console.error("[KYC Gap] Error computing gap:", error);
			res
				.status(500)
				.json({ success: false, error: "Failed to compute KYC gap" });
		}
	});
}
