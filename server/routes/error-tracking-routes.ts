// @ts-nocheck
import { Router, Request, Response } from "express";
import { errorTrackingService } from "../services/error-tracking-service";
import { errorWebhookService } from "../services/error-webhook-service";
import { errorSpikeDetectionService } from "../services/error-spike-detection-service";
import { errorDigestService } from "../services/error-digest-service";
import { errorIngestionSchema } from "../../shared/schema";
import { z } from "zod";

const router = Router();

router.post("/ingest", async (req: Request, res: Response) => {
	try {
		const validatedData = errorIngestionSchema.parse(req.body);

		const ipAddress = req.ip || req.socket.remoteAddress || undefined;

		const error = await errorTrackingService.ingestError(
			validatedData,
			ipAddress,
		);

		// Send critical alert only on first occurrence (occurrenceCount === 1) to prevent
		// duplicate emails every time the same error is reported again.
		const isFirstOccurrence = error.occurrenceCount === 1;
		if (
			isFirstOccurrence &&
			(validatedData.severity === "critical" ||
				validatedData.severity === "error")
		) {
			errorDigestService
				.sendCriticalAlert({
					id: error.id,
					errorCode: validatedData.errorCode,
					severity: validatedData.severity,
					module: validatedData.context.module,
					message: validatedData.message,
					stackTrace: validatedData.stack,
					transactionId: validatedData.context.transactionId,
				})
				.catch((err) =>
					console.error("[ErrorDigest] Critical alert failed:", err),
				);
		}

		res.status(201).json({
			success: true,
			errorId: error.id,
			sentryEventId: error.sentryEventId,
		});
	} catch (err) {
		if (err instanceof z.ZodError) {
			res.status(400).json({
				success: false,
				error: "Validation error",
				details: err.issues,
			});
		} else {
			console.error("Error ingesting error log:", err);
			res.status(500).json({
				success: false,
				error: "Failed to ingest error",
			});
		}
	}
});

router.get("/", async (req: Request, res: Response) => {
	try {
		const {
			severity,
			status,
			module,
			errorCode,
			dateFrom,
			dateTo,
			clientId,
			agentId,
			search,
			limit,
			offset,
		} = req.query;

		const result = await errorTrackingService.getErrors({
			severity: severity as string,
			status: status as string,
			module: module as string,
			errorCode: errorCode as string,
			dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
			dateTo: dateTo ? new Date(dateTo as string) : undefined,
			clientId: clientId as string,
			agentId: agentId as string,
			search: search as string,
			limit: limit ? Number.parseInt(limit as string) : undefined,
			offset: offset ? Number.parseInt(offset as string) : undefined,
		});

		res.json(result);
	} catch (err) {
		console.error("Error fetching errors:", err);
		res.status(500).json({ error: "Failed to fetch errors" });
	}
});

router.get("/metrics", async (req: Request, res: Response) => {
	try {
		const { dateFrom, dateTo } = req.query;

		const metrics = await errorTrackingService.getMetrics(
			dateFrom ? new Date(dateFrom as string) : undefined,
			dateTo ? new Date(dateTo as string) : undefined,
		);

		res.json(metrics);
	} catch (err) {
		console.error("Error fetching error metrics:", err);
		res.status(500).json({ error: "Failed to fetch metrics" });
	}
});

router.get("/critical", async (req: Request, res: Response) => {
	try {
		const limit = req.query.limit
			? Number.parseInt(req.query.limit as string)
			: 10;
		const errors = await errorTrackingService.getRecentCriticalErrors(limit);
		res.json(errors);
	} catch (err) {
		console.error("Error fetching critical errors:", err);
		res.status(500).json({ error: "Failed to fetch critical errors" });
	}
});

router.get("/webhooks", async (req: Request, res: Response) => {
	try {
		const webhooks = await errorWebhookService.getAllWebhookConfigs();
		res.json(webhooks);
	} catch (err) {
		console.error("Error fetching webhooks:", err);
		res.status(500).json({ error: "Failed to fetch webhooks" });
	}
});

router.post("/webhooks", async (req: Request, res: Response) => {
	try {
		const userId = (req as any).user?.id;
		const {
			name,
			provider,
			webhookUrl,
			environment,
			triggerOnCritical,
			triggerOnSpike,
			triggerModules,
			cooldownMinutes,
		} = req.body;

		if (!name || !provider || !webhookUrl) {
			return res
				.status(400)
				.json({ error: "Missing required fields: name, provider, webhookUrl" });
		}

		if (!["slack", "teams", "discord", "generic"].includes(provider)) {
			return res
				.status(400)
				.json({
					error: "Invalid provider. Must be: slack, teams, discord, or generic",
				});
		}

		const webhook = await errorWebhookService.createWebhookConfig({
			name,
			provider,
			webhookUrl,
			environment,
			triggerOnCritical,
			triggerOnSpike,
			triggerModules,
			cooldownMinutes,
			createdBy: userId,
		});

		res.status(201).json(webhook);
	} catch (err) {
		console.error("Error creating webhook:", err);
		res.status(500).json({ error: "Failed to create webhook" });
	}
});

router.patch("/webhooks/:id", async (req: Request, res: Response) => {
	try {
		const {
			name,
			webhookUrl,
			isEnabled,
			environment,
			triggerOnCritical,
			triggerOnSpike,
			triggerModules,
			cooldownMinutes,
		} = req.body;

		const updated = await errorWebhookService.updateWebhookConfig(
			req.params.id,
			{
				name,
				webhookUrl,
				isEnabled,
				environment,
				triggerOnCritical,
				triggerOnSpike,
				triggerModules,
				cooldownMinutes,
			},
		);

		if (!updated) {
			return res.status(404).json({ error: "Webhook not found" });
		}

		res.json(updated);
	} catch (err) {
		console.error("Error updating webhook:", err);
		res.status(500).json({ error: "Failed to update webhook" });
	}
});

router.delete("/webhooks/:id", async (req: Request, res: Response) => {
	try {
		await errorWebhookService.deleteWebhookConfig(req.params.id);
		res.json({ success: true });
	} catch (err) {
		console.error("Error deleting webhook:", err);
		res.status(500).json({ error: "Failed to delete webhook" });
	}
});

router.post("/webhooks/:id/test", async (req: Request, res: Response) => {
	try {
		const result = await errorWebhookService.testWebhook(req.params.id);
		res.json(result);
	} catch (err) {
		console.error("Error testing webhook:", err);
		res.status(500).json({ error: "Failed to test webhook" });
	}
});

router.get("/thresholds", async (req: Request, res: Response) => {
	try {
		const thresholds = await errorWebhookService.getAllThresholds();
		res.json(thresholds);
	} catch (err) {
		console.error("Error fetching thresholds:", err);
		res.status(500).json({ error: "Failed to fetch thresholds" });
	}
});

router.post("/thresholds", async (req: Request, res: Response) => {
	try {
		const userId = (req as any).user?.id;
		const {
			module,
			errorCode,
			windowMinutes,
			occurrenceThreshold,
			autoEscalateToCritical,
		} = req.body;

		const threshold = await errorWebhookService.createThresholdConfig({
			module,
			errorCode,
			windowMinutes,
			occurrenceThreshold,
			autoEscalateToCritical,
			createdBy: userId,
		});

		res.status(201).json(threshold);
	} catch (err) {
		console.error("Error creating threshold:", err);
		res.status(500).json({ error: "Failed to create threshold" });
	}
});

router.patch("/thresholds/:id", async (req: Request, res: Response) => {
	try {
		const {
			windowMinutes,
			occurrenceThreshold,
			isEnabled,
			autoEscalateToCritical,
		} = req.body;

		const updated = await errorWebhookService.updateThreshold(req.params.id, {
			windowMinutes,
			occurrenceThreshold,
			isEnabled,
			autoEscalateToCritical,
		});

		if (!updated) {
			return res.status(404).json({ error: "Threshold not found" });
		}

		res.json(updated);
	} catch (err) {
		console.error("Error updating threshold:", err);
		res.status(500).json({ error: "Failed to update threshold" });
	}
});

router.delete("/thresholds/:id", async (req: Request, res: Response) => {
	try {
		await errorWebhookService.deleteThreshold(req.params.id);
		res.json({ success: true });
	} catch (err) {
		console.error("Error deleting threshold:", err);
		res.status(500).json({ error: "Failed to delete threshold" });
	}
});

router.get("/alerts/history", async (req: Request, res: Response) => {
	try {
		const limit = req.query.limit
			? Number.parseInt(req.query.limit as string)
			: 50;
		const history = await errorWebhookService.getAlertHistory(limit);
		res.json(history);
	} catch (err) {
		console.error("Error fetching alert history:", err);
		res.status(500).json({ error: "Failed to fetch alert history" });
	}
});

router.get("/spike-summary", async (req: Request, res: Response) => {
	try {
		const summary = await errorSpikeDetectionService.getModuleSpikeSummary();
		res.json(summary);
	} catch (err) {
		console.error("Error fetching spike summary:", err);
		res.status(500).json({ error: "Failed to fetch spike summary" });
	}
});

const feedbackValidationSchema = z.object({
	errorId: z.string().uuid().optional().nullable(),
	feedbackText: z.string().min(1).max(2000),
	url: z.string().url().optional().nullable(),
	userAgent: z.string().max(500).optional().nullable(),
});

router.post("/feedback", async (req: Request, res: Response) => {
	try {
		const validatedData = feedbackValidationSchema.parse(req.body);
		const { errorId, feedbackText, url, userAgent } = validatedData;

		const userId = (req as any).user?.id;
		const userEmail = (req as any).user?.email;

		const { db } = await import("../db");
		const { errorUserFeedback } = await import("../../shared/schema");

		const [feedback] = await db
			.insert(errorUserFeedback)
			.values({
				errorLedgerId: errorId || null,
				errorId: errorId || null,
				userId: userId || null,
				userEmail: userEmail || null,
				feedbackText: feedbackText.trim().substring(0, 2000),
				url: url || null,
				userAgent: userAgent || null,
				status: "new",
			})
			.returning();

		console.log("[ErrorFeedback] Received feedback:", {
			errorId,
			userId,
			feedbackLength: feedbackText.length,
		});

		res.status(201).json({ success: true, feedbackId: feedback.id });
	} catch (err) {
		if (err instanceof z.ZodError) {
			return res.status(400).json({
				error: "Validation error",
				details: err.issues,
			});
		}
		console.error("Error submitting feedback:", err);
		res.status(500).json({ error: "Failed to submit feedback" });
	}
});

router.get("/export", async (req: Request, res: Response) => {
	try {
		const {
			severity,
			status,
			module,
			errorCode,
			dateFrom,
			dateTo,
			format = "csv",
		} = req.query;

		const result = await errorTrackingService.getErrors({
			severity: severity as string,
			status: status as string,
			module: module as string,
			errorCode: errorCode as string,
			dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
			dateTo: dateTo ? new Date(dateTo as string) : undefined,
			limit: 1000,
			offset: 0,
		});

		const errors = result.errors;
		const dateStr = new Date().toISOString().split("T")[0];

		if (format === "json") {
			const jsonExport = {
				exportedAt: new Date().toISOString(),
				filters: { severity, status, module, errorCode, dateFrom, dateTo },
				totalErrors: errors.length,
				errors: errors.map((err) => ({
					id: err.id,
					errorCode: err.errorCode,
					severity: err.severity,
					status: err.status,
					module: err.module,
					source: err.source,
					message: err.message,
					stackTrace: err.stackTrace,
					transactionId: err.transactionId,
					panMasked: err.panMasked,
					clientId: err.clientId,
					agentId: err.agentId,
					occurrenceCount: err.occurrenceCount,
					firstOccurrence: err.firstOccurrence,
					lastOccurrence: err.lastOccurrence,
					createdAt: err.createdAt,
					aiAnalysis: err.aiAnalysis,
				})),
			};

			res.setHeader("Content-Type", "application/json");
			res.setHeader(
				"Content-Disposition",
				`attachment; filename=errors_export_${dateStr}.json`,
			);
			res.send(JSON.stringify(jsonExport, null, 2));
			return;
		}

		const csvHeaders = [
			"ID",
			"Error Code",
			"Severity",
			"Status",
			"Module",
			"Source",
			"Message",
			"Transaction ID",
			"PAN (Masked)",
			"Occurrences",
			"First Occurrence",
			"Last Occurrence",
			"Created At",
		].join(",");

		const csvRows = errors.map((err) =>
			[
				`"${err.id}"`,
				`"${err.errorCode}"`,
				`"${err.severity}"`,
				`"${err.status}"`,
				`"${err.module}"`,
				`"${err.source}"`,
				`"${(err.message || "").replace(/"/g, '""').substring(0, 200)}"`,
				`"${err.transactionId || ""}"`,
				`"${err.panMasked || ""}"`,
				err.occurrenceCount || 1,
				`"${err.firstOccurrence || ""}"`,
				`"${err.lastOccurrence || ""}"`,
				`"${err.createdAt || ""}"`,
			].join(","),
		);

		const csvContent = [csvHeaders, ...csvRows].join("\n");

		res.setHeader("Content-Type", "text/csv");
		res.setHeader(
			"Content-Disposition",
			`attachment; filename=errors_export_${dateStr}.csv`,
		);
		res.send(csvContent);
	} catch (err) {
		console.error("Error exporting errors:", err);
		res.status(500).json({ error: "Failed to export errors" });
	}
});

// AI-powered error analysis routes (GPT-4o.1)
router.post("/ai-analyze/:id", async (req: Request, res: Response) => {
	try {
		const analysis = await errorTrackingService.analyzeErrorWithAI(
			req.params.id,
		);

		if (!analysis) {
			return res
				.status(404)
				.json({ error: "Error not found or analysis failed" });
		}

		res.json({
			success: true,
			errorId: req.params.id,
			analysis,
		});
	} catch (err) {
		console.error("Error analyzing error with AI:", err);
		res.status(500).json({ error: "Failed to analyze error with AI" });
	}
});

router.post("/ai-analyze-patterns", async (req: Request, res: Response) => {
	try {
		const { errorIds } = req.body;

		if (!errorIds || !Array.isArray(errorIds) || errorIds.length === 0) {
			return res.status(400).json({ error: "errorIds array is required" });
		}

		if (errorIds.length > 20) {
			return res
				.status(400)
				.json({ error: "Maximum 20 errors can be analyzed at once" });
		}

		const analysis = await errorTrackingService.analyzeErrorPatterns(errorIds);

		res.json({
			success: true,
			errorCount: errorIds.length,
			...analysis,
		});
	} catch (err) {
		console.error("Error analyzing error patterns:", err);
		res.status(500).json({ error: "Failed to analyze error patterns" });
	}
});

// Get Replit deployment context
router.get("/replit-context", async (req: Request, res: Response) => {
	try {
		const context = errorTrackingService.getReplitContext();
		res.json({
			success: true,
			context,
			supportUrl: "https://replit.com/support",
			docsUrl: "https://docs.replit.com",
		});
	} catch (err) {
		console.error("Error fetching Replit context:", err);
		res.status(500).json({ error: "Failed to fetch Replit context" });
	}
});

// Generate support report for a single error
router.get("/support-report/:id", async (req: Request, res: Response) => {
	try {
		const result = await errorTrackingService.generateSupportReport(
			req.params.id,
		);

		if (!result.success) {
			return res.status(404).json({ error: result.error });
		}

		res.json({
			success: true,
			errorId: req.params.id,
			textReport: result.report,
			jsonReport: result.jsonReport,
			supportActions: {
				replitSupport: "https://replit.com/support",
				replitCommunity: "https://ask.replit.com",
				replitDocs: "https://docs.replit.com",
				copyToClipboard: true,
				downloadAsFile: true,
			},
		});
	} catch (err) {
		console.error("Error generating support report:", err);
		res.status(500).json({ error: "Failed to generate support report" });
	}
});

// Generate batch support report for multiple errors
router.post("/support-report/batch", async (req: Request, res: Response) => {
	try {
		const { errorIds } = req.body;

		if (!errorIds || !Array.isArray(errorIds) || errorIds.length === 0) {
			return res.status(400).json({ error: "errorIds array is required" });
		}

		if (errorIds.length > 50) {
			return res
				.status(400)
				.json({ error: "Maximum 50 errors can be included in a batch report" });
		}

		const result =
			await errorTrackingService.generateBatchSupportReport(errorIds);

		if (!result.success) {
			return res
				.status(400)
				.json({
					error: result.errors?.join(", ") || "Failed to generate batch report",
				});
		}

		res.json({
			success: true,
			errorCount: result.errorCount,
			textReport: result.report,
			supportActions: {
				replitSupport: "https://replit.com/support",
				replitCommunity: "https://ask.replit.com",
				replitDocs: "https://docs.replit.com",
				copyToClipboard: true,
				downloadAsFile: true,
			},
		});
	} catch (err) {
		console.error("Error generating batch support report:", err);
		res.status(500).json({ error: "Failed to generate batch support report" });
	}
});

// Dynamic routes MUST be defined after all static routes
router.get("/:id", async (req: Request, res: Response) => {
	try {
		const error = await errorTrackingService.getErrorById(req.params.id);

		if (!error) {
			return res.status(404).json({ error: "Error not found" });
		}

		res.json(error);
	} catch (err) {
		console.error("Error fetching error details:", err);
		res.status(500).json({ error: "Failed to fetch error details" });
	}
});

router.patch("/:id/status", async (req: Request, res: Response) => {
	try {
		const { status, resolutionNote } = req.body;
		const userId = (req as any).user?.id;

		if (!userId) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		if (
			!["open", "acknowledged", "in_progress", "resolved", "ignored"].includes(
				status,
			)
		) {
			return res.status(400).json({ error: "Invalid status" });
		}

		const updated = await errorTrackingService.updateErrorStatus(
			req.params.id,
			status,
			userId,
			resolutionNote,
		);

		if (!updated) {
			return res.status(404).json({ error: "Error not found" });
		}

		res.json(updated);
	} catch (err) {
		console.error("Error updating error status:", err);
		res.status(500).json({ error: "Failed to update error status" });
	}
});

router.post("/digest/generate", async (req: Request, res: Response) => {
	try {
		const digest = await errorDigestService.generateDailyDigest();

		if (!digest) {
			return res.json({
				success: true,
				message: "No errors to report",
				digest: null,
			});
		}

		res.json({ success: true, digest });
	} catch (err) {
		console.error("Error generating digest:", err);
		res.status(500).json({ error: "Failed to generate digest" });
	}
});

router.post("/digest/send", async (req: Request, res: Response) => {
	try {
		const digest = await errorDigestService.generateDailyDigest();

		if (!digest) {
			return res.json({
				success: true,
				message: "No errors to report - email not sent",
			});
		}

		const sent = await errorDigestService.sendDigestEmail(digest);

		res.json({
			success: sent,
			message: sent
				? "Digest email sent to admins"
				: "Failed to send digest email",
			digest,
		});
	} catch (err) {
		console.error("Error sending digest:", err);
		res.status(500).json({ error: "Failed to send digest" });
	}
});

router.post("/critical-alert", async (req: Request, res: Response) => {
	try {
		const { error } = req.body;

		if (!error) {
			return res.status(400).json({ error: "Error object required" });
		}

		await errorDigestService.sendCriticalAlert(error);

		res.json({ success: true, message: "Critical alert sent" });
	} catch (err) {
		console.error("Error sending critical alert:", err);
		res.status(500).json({ error: "Failed to send critical alert" });
	}
});

export default router;
