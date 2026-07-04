import { Express, Response } from "express";
import { db } from "../../db";
import { sql, desc, eq } from "drizzle-orm";
import {
	mutualFunds,
	signalResolutionLog,
	governancePolicy,
} from "@shared/schema";
import { signalOrchestrator } from "../../services/signal-orchestrator";
import { storage } from "../../storage";
import { adminService } from "../../admin-service";
import ckycDeferredRoutes from "./ckyc-deferred-routes";
import { registerSEBIComplianceRoutes } from "./sebi-compliance-routes";
import { auditIntegrityChecker } from "../../services/audit-integrity-checker";
import { platformStatsCache } from "../../services/platform-stats-cache";
import { riaValidationService } from "../../services/ria-validation-service";
import { insuranceSuitabilityService } from "../../services/insurance-suitability-service";
import { proxyToInsurance } from "../../clients/insurance-client";
import { beneficialOwnershipService } from "../../services/beneficial-ownership-service";
import { sebiScoresService } from "../../services/sebi-scores-service";
import { mfReturnsSyncService } from "../../services/mf-returns-sync-service";
import { requireAdmin } from "../../middleware/roleMiddleware";

let _agentNotifTableReady = false;
async function ensureAgentNotificationsTable() {
	// De-dup guard: ensureSharedRouteTables() in schema-repairs.ts runs this at boot.
	// hasRun flag prevents redundant DB DDL calls across 11 admin modules.
	if (_agentNotifTableReady) return;
	_agentNotifTableReady = true;
	try {
		await db.execute(sql`
      CREATE TABLE IF NOT EXISTS agent_notifications (
        id          SERIAL PRIMARY KEY,
        agent_id    VARCHAR(255) NOT NULL,
        title       TEXT NOT NULL,
        body        TEXT NOT NULL,
        type        TEXT NOT NULL DEFAULT 'info',
        link        TEXT,
        read_at     TIMESTAMPTZ,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
		await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_agent_notifications_agent_id
        ON agent_notifications(agent_id)
    `);
		console.log("✅ [AgentNotifications] Table ready");
	} catch (err: any) {
		console.error("[AgentNotifications] Table init error:", err.message);
	}
}
ensureAgentNotificationsTable();

export function registerAdminPanelPart2Routes(app: Express): void {
	// Admin Dashboard - Overview statistics

	// Revenue Analytics API
	app.get(
		"/api/compliance/beneficial-ownership-requirements",
		async (req, res) => {
			try {
				res.json({
					success: true,
					data: {
						requiredDisclosures:
							beneficialOwnershipService.getRequiredDisclosures(),
						thresholds: beneficialOwnershipService.getSBOThresholds(),
						regulatoryReference:
							"Companies (Significant Beneficial Owners) Rules 2018",
					},
				});
			} catch (error: any) {
				res.status(500).json({ success: false, error: error.message });
			}
		},
	);

	// SEBI SCORES Grievance Management API (SEBI Complaint Redress System)
	// Submit a new grievance complaint
	app.post("/api/grievance/submit", async (req, res) => {
		if (!(req as any).user) {
			return res
				.status(401)
				.json({
					success: false,
					error: "Authentication required to submit grievance",
				});
		}
		try {
			const { complainant, category, subcategory, details } = req.body;

			if (!complainant || !category || !details) {
				return res.status(400).json({
					success: false,
					error: "complainant, category, and details are required",
				});
			}

			if (!complainant.name || !complainant.email || !complainant.phone) {
				return res.status(400).json({
					success: false,
					error: "complainant must include name, email, and phone",
				});
			}

			if (!details.description) {
				return res.status(400).json({
					success: false,
					error: "details must include description",
				});
			}

			const clientId = (req as any).user.id;
			const complaint = await sebiScoresService.submitComplaint({
				clientId,
				complainant,
				category,
				subcategory,
				details,
			});

			res.json({
				success: true,
				data: complaint,
				message: `Grievance submitted successfully. Reference: ${complaint.scoresReferenceNumber}`,
			});
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	});

	// Get complaint by ID
	app.get("/api/grievance/:complaintId", async (req, res) => {
		if (!(req as any).user) {
			return res
				.status(401)
				.json({ success: false, error: "Authentication required" });
		}
		try {
			const complaint = sebiScoresService.getComplaint(req.params.complaintId);
			if (!complaint) {
				return res
					.status(404)
					.json({ success: false, error: "Complaint not found" });
			}
			res.json({ success: true, data: complaint });
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	});

	// Get complaint by SCORES reference number
	app.get("/api/grievance/reference/:scoresRef", async (req, res) => {
		if (!(req as any).user) {
			return res
				.status(401)
				.json({ success: false, error: "Authentication required" });
		}
		try {
			const complaint = sebiScoresService.getComplaintByReference(
				req.params.scoresRef,
			);
			if (!complaint) {
				return res
					.status(404)
					.json({ success: false, error: "Complaint not found" });
			}
			res.json({ success: true, data: complaint });
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	});

	// Get client's complaints
	app.get("/api/grievance/client/:clientId", async (req, res) => {
		if (!(req as any).user) {
			return res
				.status(401)
				.json({ success: false, error: "Authentication required" });
		}
		try {
			const complaints = sebiScoresService.getClientComplaints(
				req.params.clientId,
			);
			res.json({
				success: true,
				data: complaints,
				meta: { count: complaints.length },
			});
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	});

	// Get my complaints (current user)
	app.get("/api/grievance/my-complaints", async (req, res) => {
		if (!(req as any).user) {
			return res
				.status(401)
				.json({ success: false, error: "Authentication required" });
		}
		try {
			const clientId = (req as any).user.id;
			const complaints = sebiScoresService.getClientComplaints(clientId);
			res.json({
				success: true,
				data: complaints,
				meta: { count: complaints.length },
			});
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	});

	// Get complaint category options
	app.get("/api/grievance/categories", async (req, res) => {
		try {
			res.json({
				success: true,
				data: sebiScoresService.getCategoryOptions(),
			});
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	});

	// Admin: Get all complaints with filters
	app.get("/api/admin/grievances", requireAdmin, async (req, res) => {
		try {
			const {
				status,
				category,
				priority,
				isEscalated,
				assignedTo,
				fromDate,
				toDate,
			} = req.query;

			const filters: any = {};
			if (status) filters.status = status as string;
			if (category) filters.category = category as string;
			if (priority) filters.priority = priority as string;
			if (isEscalated !== undefined)
				filters.isEscalated = isEscalated === "true";
			if (assignedTo) filters.assignedTo = assignedTo as string;
			if (fromDate) filters.fromDate = new Date(fromDate as string);
			if (toDate) filters.toDate = new Date(toDate as string);

			const complaints = sebiScoresService.getAllComplaints(
				Object.keys(filters).length > 0 ? filters : undefined,
			);

			res.json({
				success: true,
				data: complaints,
				meta: { count: complaints.length },
			});
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	});

	// Admin: Get grievance metrics
	app.get("/api/admin/grievances/metrics", requireAdmin, async (req, res) => {
		try {
			const metrics = sebiScoresService.getMetrics();
			res.json({ success: true, data: metrics });
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	});

	// Admin: Get overdue complaints (SLA breached)
	app.get("/api/admin/grievances/overdue", requireAdmin, async (req, res) => {
		try {
			const overdue = sebiScoresService.getOverdueComplaints();
			res.json({
				success: true,
				data: overdue,
				meta: { count: overdue.length },
			});
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	});

	// Admin: Get complaints nearing SLA deadline
	app.get(
		"/api/admin/grievances/pending-escalation",
		requireAdmin,
		async (req, res) => {
			try {
				const pending = sebiScoresService.getPendingEscalations();
				res.json({
					success: true,
					data: pending,
					meta: { count: pending.length },
				});
			} catch (error: any) {
				res.status(500).json({ success: false, error: error.message });
			}
		},
	);

	// Admin: Acknowledge complaint
	app.post(
		"/api/admin/grievances/:complaintId/acknowledge",
		requireAdmin,
		async (req, res) => {
			try {
				const acknowledgedBy = (req as any).user.id;
				const complaint = await sebiScoresService.acknowledgeComplaint(
					req.params.complaintId,
					acknowledgedBy,
				);
				if (!complaint) {
					return res
						.status(404)
						.json({ success: false, error: "Complaint not found" });
				}
				res.json({ success: true, data: complaint });
			} catch (error: any) {
				res.status(500).json({ success: false, error: error.message });
			}
		},
	);

	// Admin: Update complaint
	app.patch(
		"/api/admin/grievances/:complaintId",
		requireAdmin,
		async (req, res) => {
			try {
				const { status, priority, assignedTo, assignedToName, internalNote } =
					req.body;
				const updatedBy = (req as any).user.id;
				const updatedByName =
					(req as any).user.email || (req as any).user.firstName || "Admin";

				const complaint = await sebiScoresService.updateComplaint(
					req.params.complaintId,
					{
						status,
						priority,
						assignedTo,
						assignedToName,
						internalNote,
						noteAddedBy: updatedBy,
						noteAddedByName: updatedByName,
						updatedBy,
					},
				);

				if (!complaint) {
					return res
						.status(404)
						.json({ success: false, error: "Complaint not found" });
				}
				res.json({ success: true, data: complaint });
			} catch (error: any) {
				res.status(500).json({ success: false, error: error.message });
			}
		},
	);

	// Admin: Resolve complaint
	app.post(
		"/api/admin/grievances/:complaintId/resolve",
		requireAdmin,
		async (req, res) => {
			try {
				const { resolutionType, summary, actionTaken, compensationProvided } =
					req.body;

				if (!resolutionType || !summary || !actionTaken) {
					return res.status(400).json({
						success: false,
						error: "resolutionType, summary, and actionTaken are required",
					});
				}

				const resolvedBy = (req as any).user.id;
				const resolvedByName =
					(req as any).user.email || (req as any).user.firstName || "Admin";

				const complaint = await sebiScoresService.resolveComplaint(
					req.params.complaintId,
					{
						resolutionType,
						summary,
						actionTaken,
						compensationProvided,
						resolvedBy,
						resolvedByName,
					},
				);

				if (!complaint) {
					return res
						.status(404)
						.json({ success: false, error: "Complaint not found" });
				}
				res.json({ success: true, data: complaint });
			} catch (error: any) {
				res.status(500).json({ success: false, error: error.message });
			}
		},
	);

	// Admin: Close complaint
	app.post(
		"/api/admin/grievances/:complaintId/close",
		requireAdmin,
		async (req, res) => {
			try {
				const { reason } = req.body;
				const closedBy = (req as any).user.id;

				const complaint = await sebiScoresService.closeComplaint(
					req.params.complaintId,
					closedBy,
					reason,
				);
				if (!complaint) {
					return res
						.status(404)
						.json({ success: false, error: "Complaint not found" });
				}
				res.json({ success: true, data: complaint });
			} catch (error: any) {
				res.status(500).json({ success: false, error: error.message });
			}
		},
	);

	// Admin: Escalate complaint
	app.post(
		"/api/admin/grievances/:complaintId/escalate",
		requireAdmin,
		async (req, res) => {
			try {
				const { reason } = req.body;
				if (!reason) {
					return res
						.status(400)
						.json({ success: false, error: "Escalation reason is required" });
				}

				const escalatedBy = (req as any).user.id;
				const complaint = await sebiScoresService.escalateComplaint(
					req.params.complaintId,
					escalatedBy,
					reason,
				);
				if (!complaint) {
					return res
						.status(404)
						.json({ success: false, error: "Complaint not found" });
				}
				res.json({ success: true, data: complaint });
			} catch (error: any) {
				res.status(500).json({ success: false, error: error.message });
			}
		},
	);

	// Admin: Add communication to complaint
	app.post(
		"/api/admin/grievances/:complaintId/communication",
		requireAdmin,
		async (req, res) => {
			try {
				const { type, direction, content, subject } = req.body;

				if (!type || !direction || !content) {
					return res.status(400).json({
						success: false,
						error: "type, direction, and content are required",
					});
				}

				const sentBy = (req as any).user.id;
				const complaint = await sebiScoresService.addCommunication(
					req.params.complaintId,
					type,
					direction,
					content,
					subject,
					sentBy,
				);

				if (!complaint) {
					return res
						.status(404)
						.json({ success: false, error: "Complaint not found" });
				}
				res.json({ success: true, data: complaint });
			} catch (error: any) {
				res.status(500).json({ success: false, error: error.message });
			}
		},
	);

	// Admin: Check SLA breaches
	app.get("/api/admin/grievances/sla-check", requireAdmin, async (req, res) => {
		try {
			const result = await sebiScoresService.checkSlaBreaches();
			res.json({
				success: true,
				data: result,
				meta: {
					breachedCount: result.breached.length,
					nearingDeadlineCount: result.nearingDeadline.length,
				},
			});
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	});

	// Notification Management API
	app.get("/api/admin/notifications/config", requireAdmin, async (req, res) => {
		res.json({
			channels: [
				{
					id: "email",
					name: "Email (SMTP)",
					type: "email",
					enabled: true,
					config: {},
				},
				{
					id: "sms",
					name: "SMS (Twilio)",
					type: "sms",
					enabled: !!process.env.TWILIO_ACCOUNT_SID,
					config: {},
				},
				{
					id: "whatsapp",
					name: "WhatsApp",
					type: "whatsapp",
					enabled: !!process.env.TWILIO_ACCOUNT_SID,
					config: {},
				},
				{
					id: "push",
					name: "Push Notifications",
					type: "push",
					enabled: false,
					config: {},
				},
			],
			templates: [
				{
					id: "1",
					name: "Welcome Email",
					channel: "email",
					subject: "Welcome to FintekPro",
					body: "Hello {{name}}...",
					variables: ["name", "email"],
					active: true,
				},
				{
					id: "2",
					name: "KYC Approved",
					channel: "email",
					subject: "KYC Verified",
					body: "Your KYC is approved...",
					variables: ["name"],
					active: true,
				},
				{
					id: "3",
					name: "OTP SMS",
					channel: "sms",
					body: "Your OTP is {{otp}}",
					variables: ["otp"],
					active: true,
				},
				{
					id: "4",
					name: "Order Confirmation",
					channel: "whatsapp",
					body: "Order {{orderId}} confirmed",
					variables: ["orderId", "amount"],
					active: true,
				},
			],
			rules: [
				{
					id: "1",
					event: "user.registered",
					channels: ["email"],
					template: "Welcome Email",
					enabled: true,
				},
				{
					id: "2",
					event: "kyc.approved",
					channels: ["email", "sms"],
					template: "KYC Approved",
					enabled: true,
				},
				{
					id: "3",
					event: "order.created",
					channels: ["email", "whatsapp"],
					template: "Order Confirmation",
					enabled: true,
				},
			],
			stats: { sent24h: 156, delivered: 148, failed: 8 },
		});
	});

	// Feature Flags API
	app.get("/api/admin/feature-flags", requireAdmin, async (req, res) => {
		try {
			// Fetch feature flags from database
			const flagsResult = await db.execute(sql`
        SELECT 
          id, flag_key as key, flag_name as name, description, 
          is_enabled as enabled, 
          COALESCE((targeting_rules->>'percentRollout')::int, 100) as "rolloutPercentage",
          COALESCE(enabled_environments, ARRAY[]::text[]) as "targetAudience",
          created_at as "createdAt", updated_at as "updatedAt"
        FROM platform_feature_flags
        ORDER BY created_at DESC
      `);

			// Fetch A/B tests from database
			const testsResult = await db.execute(sql`
        SELECT 
          id, name, status, variants, metric,
          sample_size as "sampleSize", winner,
          start_date as "startDate", end_date as "endDate"
        FROM ab_tests
        ORDER BY created_at DESC
      `);

			// Count active flags and running tests
			const activeFlagsResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM platform_feature_flags WHERE is_enabled = true
      `);
			const runningTestsResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM ab_tests WHERE status = 'running'
      `);
			const totalUsersResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM users
      `);

			const flags = flagsResult.rows.map((row: any) => ({
				id: row.id,
				name: row.name,
				key: row.key,
				description: row.description || "",
				enabled: row.enabled || false,
				rolloutPercentage: row.rolloutPercentage || 100,
				targetAudience: row.targetAudience || [],
				createdAt: row.createdAt,
				updatedAt: row.updatedAt,
			}));

			const abTests = testsResult.rows.map((row: any) => ({
				id: row.id,
				name: row.name,
				status: row.status,
				variants: row.variants || [],
				metric: row.metric,
				sampleSize: row.sampleSize || 0,
				winner: row.winner,
				startDate: row.startDate,
				endDate: row.endDate,
			}));

			res.json({
				flags,
				abTests,
				stats: {
					activeFlags: Number(activeFlagsResult.rows[0]?.count || 0),
					runningTests: Number(runningTestsResult.rows[0]?.count || 0),
					totalUsers: Number(totalUsersResult.rows[0]?.count || 0),
				},
			});
		} catch (error: any) {
			console.error("[Feature Flags] Error fetching data:", error.message);
			res.status(500).json({ error: "Failed to fetch feature flags" });
		}
	});

	// Create new feature flag
	app.post("/api/admin/feature-flags", requireAdmin, async (req, res) => {
		try {
			const {
				name,
				key,
				description,
				enabled,
				rolloutPercentage,
				targetAudience,
			} = req.body;

			if (!name || !key) {
				return res.status(400).json({ error: "Name and key are required" });
			}

			const result = await db.execute(sql`
        INSERT INTO platform_feature_flags (flag_key, flag_name, description, is_enabled, targeting_rules)
        VALUES (${key}, ${name}, ${description || ""}, ${enabled || false}, ${JSON.stringify({ percentRollout: rolloutPercentage || 100 })}::jsonb)
        RETURNING id
      `);

			res.json({
				success: true,
				id: result.rows[0]?.id,
				message: "Feature flag created",
			});
		} catch (error: any) {
			console.error("[Feature Flags] Create error:", error.message);
			if (error.message?.includes("unique")) {
				return res.status(400).json({ error: "Flag key already exists" });
			}
			res.status(500).json({ error: "Failed to create feature flag" });
		}
	});

	// Update feature flag
	app.put(
		"/api/admin/feature-flags/:flagId",
		requireAdmin,
		async (req, res) => {
			try {
				const { flagId } = req.params;
				const { name, description, rolloutPercentage, targetAudience } =
					req.body;

				await db.execute(sql`
        UPDATE platform_feature_flags 
        SET flag_name = COALESCE(${name}, flag_name),
            description = COALESCE(${description}, description),
            targeting_rules = CASE 
              WHEN ${rolloutPercentage}::int IS NOT NULL 
              THEN jsonb_set(COALESCE(targeting_rules, '{}'::jsonb), '{percentRollout}', to_jsonb(${rolloutPercentage}::int))
              ELSE targeting_rules
            END,
            updated_at = NOW()
        WHERE id = ${flagId}
      `);

				res.json({ success: true, message: "Feature flag updated" });
			} catch (error: any) {
				console.error("[Feature Flags] Update error:", error.message);
				res.status(500).json({ error: "Failed to update feature flag" });
			}
		},
	);

	// Delete feature flag
	app.delete(
		"/api/admin/feature-flags/:flagId",
		requireAdmin,
		async (req, res) => {
			try {
				const { flagId } = req.params;

				await db.execute(
					sql`DELETE FROM platform_feature_flags WHERE id = ${flagId}`,
				);

				res.json({ success: true, message: "Feature flag deleted" });
			} catch (error: any) {
				console.error("[Feature Flags] Delete error:", error.message);
				res.status(500).json({ error: "Failed to delete feature flag" });
			}
		},
	);

	// Create new A/B test
	app.post("/api/admin/ab-tests", requireAdmin, async (req, res) => {
		try {
			const { name, testKey, metric, variants, status } = req.body;

			if (!name || !testKey || !metric) {
				return res
					.status(400)
					.json({ error: "Name, test key, and metric are required" });
			}

			const result = await db.execute(sql`
        INSERT INTO ab_tests (name, test_key, metric, variants, status, start_date)
        VALUES (${name}, ${testKey}, ${metric}, ${JSON.stringify(variants || [])}::jsonb, ${status || "draft"}, NOW())
        RETURNING id
      `);

			res.json({
				success: true,
				id: result.rows[0]?.id,
				message: "A/B test created",
			});
		} catch (error: any) {
			console.error("[A/B Tests] Create error:", error.message);
			if (error.message?.includes("unique")) {
				return res.status(400).json({ error: "Test key already exists" });
			}
			res.status(500).json({ error: "Failed to create A/B test" });
		}
	});

	// Update A/B test status
	app.patch(
		"/api/admin/ab-tests/:testId/status",
		requireAdmin,
		async (req, res) => {
			try {
				const { testId } = req.params;
				const { status, winner } = req.body;

				let query;
				if (status === "completed" && winner) {
					query = sql`
          UPDATE ab_tests 
          SET status = ${status}, winner = ${winner}, end_date = NOW(), updated_at = NOW()
          WHERE id = ${testId}
        `;
				} else {
					query = sql`
          UPDATE ab_tests 
          SET status = ${status}, updated_at = NOW()
          WHERE id = ${testId}
        `;
				}

				await db.execute(query);
				res.json({ success: true, message: `Test ${status}` });
			} catch (error: any) {
				console.error("[A/B Tests] Status update error:", error.message);
				res.status(500).json({ error: "Failed to update test status" });
			}
		},
	);

	// Delete A/B test
	app.delete("/api/admin/ab-tests/:testId", requireAdmin, async (req, res) => {
		try {
			const { testId } = req.params;

			await db.execute(sql`DELETE FROM ab_tests WHERE id = ${testId}`);

			res.json({ success: true, message: "A/B test deleted" });
		} catch (error: any) {
			console.error("[A/B Tests] Delete error:", error.message);
			res.status(500).json({ error: "Failed to delete A/B test" });
		}
	});

	// AI Insights API - Returns arrays as expected by frontend
}
