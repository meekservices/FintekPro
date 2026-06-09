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
import { maskPan, maskEmail, maskMobile } from "../../utils/pii-utils";

async function ensureAgentNotificationsTable() {
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

export function registerAdminPanelPart4Sub1Sub2Routes(app: Express): void {
	// Admin Dashboard - Overview statistics

	// Revenue Analytics API
	app.get("/api/ckyc/:userId/documents", async (req, res) => {
		try {
			const { userId } = req.params;
			const documents = await storage.getCkycDocuments(userId);
			res.json(documents);
		} catch (error) {
			console.error("Error fetching CKYC documents:", error);
			res.status(500).json({ error: "Failed to fetch documents" });
		}
	});

	// Get CKYC status history
	app.get("/api/ckyc/:userId/history", async (req, res) => {
		try {
			const { userId } = req.params;
			const history = await storage.getCkycStatusHistory(userId);
			res.json(history);
		} catch (error) {
			console.error("Error fetching CKYC status history:", error);
			res.status(500).json({ error: "Failed to fetch status history" });
		}
	});

	// Agent CKYC API endpoints for care agents
	app.get("/api/agent/ckyc-clients", async (req, res) => {
		try {
			const records = await storage.getAllCkycRecords();
			res.json(records);
		} catch (error) {
			console.error("Error fetching CKYC clients for agent:", error);
			res.status(500).json({ error: "Failed to fetch CKYC clients" });
		}
	});

	app.get("/api/agent/notifications", async (req: any, res) => {
		try {
			const agentId = req.user?.id;
			if (!agentId) return res.status(401).json({ error: "Unauthorized" });
			const notifications = await storage.getAgentNotifications(agentId);
			res.json(notifications);
		} catch (error) {
			console.error("Error fetching agent notifications:", error);
			res.status(500).json({ error: "Failed to fetch notifications" });
		}
	});

	app.post("/api/agent/notifications/:id/read", async (req: any, res) => {
		try {
			await storage.markAgentNotificationRead(req.params.id);
			res.json({ success: true });
		} catch (error) {
			console.error("Error marking notification read:", error);
			res.status(500).json({ error: "Failed to mark notification read" });
		}
	});

	app.post("/api/agent/ckyc/notifications", async (req, res) => {
		try {
			const notificationData = {
				...req.body,
				status: "pending",
				createdAt: new Date(),
				triggerredBy: "care_agent",
			};

			const notification =
				await storage.createCkycNotificationTrigger(notificationData);

			// For agent-created notifications, mark them as sent immediately
			// In a real implementation, you'd queue them for actual delivery
			setTimeout(async () => {
				try {
					await (storage as any).updateNotificationTrigger(notification.id, {
						status: "sent",
						sentAt: new Date(),
					});
					console.log(
						`📱 Agent notification sent: ${notificationData.subject}`,
					);
				} catch (error) {
					console.error("Error updating notification status:", error);
				}
			}, 1000);

			res.json(notification);
		} catch (error) {
			console.error("Error creating agent notification:", error);
			res.status(500).json({ error: "Failed to create notification" });
		}
	});

	// Admin: Get all CKYC records with pagination
	app.get("/api/admin/ckyc", requireAdmin, async (req, res) => {
		try {
			const { status, page = "1", limit = "50" } = req.query as any;
			const records = await storage.getAllCkycRecords({
				status,
				page: Number.parseInt(page),
				limit: Number.parseInt(limit),
			});

			const maskedRecords = records.map((record: any) => ({
				...record,
				panNumber: record.panNumber
					? maskPan(record.panNumber)
					: record.panNumber,
				emailAddress: record.emailAddress
					? maskEmail(record.emailAddress)
					: record.emailAddress,
				mobileNumber: record.mobileNumber
					? maskMobile(record.mobileNumber)
					: record.mobileNumber,
				aadharNumber: record.aadharNumber
					? "********" + record.aadharNumber.slice(-4)
					: record.aadharNumber,
				ckycNumber: record.ckycNumber
					? "********" + record.ckycNumber.slice(-4)
					: record.ckycNumber,
			}));

			res.json(maskedRecords);
		} catch (error) {
			console.error("Error fetching all CKYC records:", error);
			res.status(500).json({ error: "Failed to fetch CKYC records" });
		}
	});

	// Admin: Update CKYC verification status
}
