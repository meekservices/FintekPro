import { Express, Response } from "express";
import { db } from "../../db";
import { sql, desc, eq } from "drizzle-orm";
import {
	mutualFunds,
	signalResolutionLog,
	governancePolicy,
	kycFormProgress,
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

export function registerAdminPanelPart4Sub2Routes(app: Express): void {
	// Admin Dashboard - Overview statistics

	// Revenue Analytics API
	app.patch(
		"/api/admin/ckyc/:userId/status",
		requireAdmin,
		async (req, res) => {
			try {
				const { userId } = req.params;
				const { status, remarks } = req.body;

				const updated = await storage.updateCkycRecord(userId, {
					status: status,
					lastVerifiedAt: status === "verified" ? new Date() : null,
				});

				if (!updated) {
					return res.status(404).json({ error: "CKYC record not found" });
				}

				// Log status change
				await storage.addCkycStatusHistory({
					ckycRecordId: updated.id,
					newStatus: status,
					changedBy: req.user?.id || "admin",
					reason: remarks || `Status changed to ${status}`,
				});

				res.json(updated);
			} catch (error) {
				console.error("Error updating CKYC status:", error);
				res.status(500).json({ error: "Failed to update CKYC status" });
			}
		},
	);

	// CKYC compliance check for trading/investment activities
	app.get("/api/ckyc/:userId/compliance", async (req, res) => {
		try {
			const { userId } = req.params;
			const ckycRecord = await storage.getCkycRecord(userId);

			if (!ckycRecord) {
				return res.json({
					compliant: false,
					reason: "CKYC record not found",
					requiredActions: ["Complete CKYC registration"],
				});
			}

			const compliance = {
				compliant: ckycRecord.status === "verified",
				status: ckycRecord.status,
				ckycNumber: ckycRecord.ckycNumber,
				expiryDate: ckycRecord.expiryDate,
				reason:
					ckycRecord.status !== "verified"
						? `CKYC status is ${ckycRecord.status}`
						: null,
				requiredActions:
					ckycRecord.status === "pending"
						? ["Upload required documents", "Wait for verification"]
						: ckycRecord.status === "rejected"
							? ["Review rejection remarks", "Resubmit with correct documents"]
							: [],
			};

			res.json(compliance);
		} catch (error) {
			console.error("Error checking CKYC compliance:", error);
			res.status(500).json({ error: "Failed to check compliance" });
		}
	});

	// ============ CKYC PROGRESS MONITORING & NOTIFICATION API ROUTES ============
	// NOTE: These routes are temporarily disabled because the required storage methods
	// (createCkycNotificationTrigger, createCkycActionLog, etc.) are not yet implemented

	/* COMMENTED OUT - Missing storage methods
  // Admin: Create notification trigger for CKYC record
  app.post("/api/admin/ckyc/notifications", requireAdmin, async (req, res) => {
    try {
      const { ckycRecordId, triggerType, notificationMethod, recipientEmail, recipientMobile, subject, message, scheduledAt, triggerredBy, metadata } = req.body;
      
      // Validate CKYC record exists
      const ckycRecord = await storage.getCkycRecord(ckycRecordId);
      if (!ckycRecord) {
        return res.status(404).json({ error: "CKYC record not found" });
      }
      
      const trigger = await storage.createCkycNotificationTrigger({
        ckycRecordId,
        triggerType,
        notificationMethod,
        recipientEmail,
        recipientMobile, 
        subject,
        message,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        triggerredBy,
        metadata: metadata || {}
      });
      
      // Log the action
      await storage.createCkycActionLog({
        ckycRecordId,
        actionType: "trigger_notification",
        actionBy: triggerredBy,
        actionByType: "admin",
        actionDetails: `Created ${triggerType} notification trigger for ${notificationMethod}`,
        newValue: trigger
      });
      
      console.log(`📧 CKYC notification trigger created: ${trigger.id}`);
      res.status(201).json(trigger);
    } catch (error) {
      console.error("Error creating CKYC notification trigger:", error);
      res.status(500).json({ error: "Failed to create notification trigger" });
    }
  });
  */

	/* COMMENTED OUT - All remaining CKYC notification/progress routes use missing storage methods
  // Admin: Get notification triggers with filtering  
  app.get("/api/admin/ckyc/notifications", requireAdmin, async (req, res) => {
    try {
      const { ckycRecordId, status } = req.query;
      const triggers = await storage.getCkycNotificationTriggers(
        ckycRecordId as string,
        status as string
      );
      res.json(triggers);
    } catch (error) {
      console.error("Error fetching CKYC notification triggers:", error);
      res.status(500).json({ error: "Failed to fetch notification triggers" });
    }
  });

  // Admin: Update notification status manually
  app.patch("/api/admin/ckyc/notifications/:triggerId/status", requireAdmin, async (req, res) => {
    try {
      const { triggerId } = req.params;
      const { status, failureReason } = req.body;
      
      const updated = await storage.updateCkycNotificationStatus(
        triggerId, 
        status,
        status === "sent" ? new Date() : undefined,
        failureReason
      );
      
      if (!updated) {
        return res.status(404).json({ error: "Notification trigger not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating notification status:", error);
      res.status(500).json({ error: "Failed to update notification status" });
    }
  });

  // Admin: Create progress step for CKYC record
  app.post("/api/admin/ckyc/progress-steps", requireAdmin, async (req, res) => {
    try {
      const { ckycRecordId, stepName, stepDescription, stepOrder, estimatedCompletionTime, completedBy } = req.body;
      
      const step = await storage.createCkycProgressStep({
        ckycRecordId,
        stepName,
        stepStatus: "pending",
        stepDescription,
        stepOrder,
        estimatedCompletionTime,
        completedBy,
        isActive: true,
        metadata: {}
      });
      
      // Log the action
      await storage.createCkycActionLog({
        ckycRecordId,
        actionType: "status_update", 
        actionBy: completedBy || "admin",
        actionByType: "admin",
        actionDetails: `Created progress step: ${stepName}`,
        newValue: step
      });
      
      res.status(201).json(step);
    } catch (error) {
      console.error("Error creating CKYC progress step:", error);
      res.status(500).json({ error: "Failed to create progress step" });
    }
  });

  // Get CKYC progress steps for a record
  app.get("/api/ckyc/:ckycRecordId/progress", async (req, res) => {
    try {
      const { ckycRecordId } = req.params;
      const steps = await storage.getCkycProgressSteps(ckycRecordId);
      res.json(steps);
    } catch (error) {
      console.error("Error fetching CKYC progress steps:", error);
      res.status(500).json({ error: "Failed to fetch progress steps" });
    }
  });

  // Admin: Update progress step
  app.patch("/api/admin/ckyc/progress-steps/:stepId", requireAdmin, async (req, res) => {
    try {
      const { stepId } = req.params;
      const { stepStatus, completedAt, completedBy, actualCompletionTime } = req.body;
      
      const updated = await storage.updateCkycProgressStep(stepId, {
        stepStatus,
        completedAt: completedAt ? new Date(completedAt) : undefined,
        completedBy,
        actualCompletionTime
      });
      
      if (!updated) {
        return res.status(404).json({ error: "Progress step not found" });
      }
      
      // Log the action
      await storage.createCkycActionLog({
        ckycRecordId: updated.ckycRecordId,
        actionType: "status_update",
        actionBy: completedBy || "admin",
        actionByType: "admin", 
        actionDetails: `Updated progress step: ${updated.stepName} to ${stepStatus}`,
        previousValue: { stepStatus: "pending" },
        newValue: updated
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating CKYC progress step:", error);
      res.status(500).json({ error: "Failed to update progress step" });
    }
  });

  // Agent: Trigger notification (limited permissions)
  app.post("/api/agent/ckyc/notifications", async (req, res) => {
    try {
      const { ckycRecordId, notificationMethod, recipientEmail, recipientMobile, subject, message, triggerredBy } = req.body;
      
      // Validate CKYC record exists
      const ckycRecord = await storage.getCkycRecord(ckycRecordId);
      if (!ckycRecord) {
        return res.status(404).json({ error: "CKYC record not found" });
      }
      
      const trigger = await storage.createCkycNotificationTrigger({
        ckycRecordId,
        triggerType: "manual_trigger",
        notificationMethod,
        recipientEmail,
        recipientMobile,
        subject,
        message,
        triggerredBy,
        metadata: { source: "agent_panel" }
      });
      
      // Log the action
      await storage.createCkycActionLog({
        ckycRecordId,
        actionType: "trigger_notification",
        actionBy: triggerredBy,
        actionByType: "agent",
        actionDetails: `Agent triggered ${notificationMethod} notification`,
        newValue: trigger
      });
      
      console.log(`📧 Agent notification trigger created: ${trigger.id}`);
      res.status(201).json(trigger);
    } catch (error) {
      console.error("Error creating agent notification trigger:", error);
      res.status(500).json({ error: "Failed to create notification trigger" });
    }
  });

  // Get action logs for CKYC record
  app.get("/api/ckyc/:ckycRecordId/action-logs", async (req, res) => {
    try {
      const { ckycRecordId } = req.params;
      const logs = await storage.getCkycActionLogs(ckycRecordId);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching CKYC action logs:", error);
      res.status(500).json({ error: "Failed to fetch action logs" });
    }
  });

  // Admin: Get all action logs with filtering
  app.get("/api/admin/ckyc/action-logs", requireAdmin, async (req, res) => {
    try {
      const { actionBy } = req.query;
      const logs = await storage.getCkycActionLogs(undefined, actionBy as string);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching all CKYC action logs:", error);
      res.status(500).json({ error: "Failed to fetch action logs" });
    }
  });

  // Process pending notifications (background job endpoint)
  app.post("/api/admin/ckyc/process-notifications", requireAdmin, async (req, res) => {
    try {
      await storage.processPendingNotifications();
      res.json({ success: true, message: "Pending notifications processed" });
    } catch (error) {
      console.error("Error processing pending notifications:", error);
      res.status(500).json({ error: "Failed to process notifications" });
    }
  });
  END OF COMMENTED OUT CKYC ROUTES */

	// ============ KYC FORM PROGRESS API ROUTES ============

	// Get KYC form progress for current user
	app.get("/api/kyc-progress", async (req, res) => {
		try {
			const userId = req.user?.id || "central-test-user"; // Get from session
			const result = await db
				.select()
				.from(kycFormProgress)
				.where(eq(kycFormProgress.userId, userId))
				.limit(1);

			if (result.length === 0) {
				return res.status(404).json({ error: "No progress found" });
			}

			res.json(result[0]);
		} catch (error) {
			console.error("Error fetching KYC progress:", error);
			res.status(500).json({ error: "Failed to fetch KYC progress" });
		}
	});

	// Save/Update KYC form progress
}
