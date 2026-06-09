import { Router, Request, Response } from "express";
import AMLService from "./aml-service";

// Define extended request interface for authenticated routes
interface AuthenticatedRequest extends Request {
	user: {
		id: string;
		role?: string;
	};
}

// Authentication middleware (copied from routes.ts)
const requireAuth = (req: any, res: any, next: any) => {
	if (!req.user) {
		// SECURITY: Development bypass removed - all environments now require proper authentication
		// const isDevelopment = !process.env.NODE_ENV || process.env.NODE_ENV === 'development' || process.env.REPL_ID;
		// if (isDevelopment) {
		//   req.user = { id: 'demo-user-1', role: 'admin' };
		//   return next();
		// }
		return res.status(401).json({ message: "Unauthorized" });
	}
	next();
};

const router = Router();

// Initialize AML Service
const amlService = new AMLService({
	sanctionScannerApiKey: process.env.SANCTION_SCANNER_API_KEY,
	complyCubeApiKey: process.env.COMPLYCUBE_API_KEY,
	sumsubApiKey: process.env.SUMSUB_API_KEY,
	shuftiProApiKey: process.env.SHUFTI_PRO_API_KEY,
	environment: process.env.NODE_ENV === "production" ? "production" : "sandbox",
});

// AML Screening Endpoints

// Perform full AML/KYC screening for a user
router.post(
	"/api/agent/aml/screen/:userId",
	requireAuth,
	async (req: Request, res: Response) => {
		try {
			// Check if user has agent/admin role
			if (
				(req.user as any)?.role !== "agent" &&
				(req.user as any)?.role !== "admin" &&
				(req.user as any)?.role !== "super_admin"
			) {
				return res.status(403).json({ error: "Agent access required" });
			}

			const {
				firstName,
				lastName,
				dateOfBirth,
				nationality,
				countryOfResidence,
				passportNumber,
			} = req.body;
			const userId = req.params.userId;

			const userData = {
				firstName,
				lastName,
				dateOfBirth,
				nationality,
				countryOfResidence,
				passportNumber,
				userId,
			};

			const screeningResult = await amlService.performFullScreening(userData);

			// Log screening event for compliance audit trail
			console.log("[AML] User screening completed", {
				userId,
				screeningId: screeningResult.screeningId,
				status: screeningResult.status,
				riskScore: screeningResult.riskProfile.riskScore,
				timestamp: new Date().toISOString(),
			});

			res.json(screeningResult);
		} catch (error) {
			console.error("[AML] Screening error:", error);
			res.status(500).json({ error: "Failed to complete AML screening" });
		}
	},
);

// Get AML screening history for a user - Agent Only
router.get(
	"/api/agent/aml/history/:userId",
	requireAuth,
	async (req: Request, res: Response) => {
		try {
			// Check if user has agent/admin role
			if (
				(req.user as any)?.role !== "agent" &&
				(req.user as any)?.role !== "admin" &&
				(req.user as any)?.role !== "super_admin"
			) {
				return res.status(403).json({ error: "Agent access required" });
			}

			const { userId } = req.params;

			// Mock screening history - replace with actual database query
			const history = [
				{
					screeningId: "scr_abc123def456",
					completedAt: new Date("2025-01-01"),
					status: "clear",
					riskScore: 15,
					riskLevel: "low",
				},
				{
					screeningId: "scr_def456ghi789",
					completedAt: new Date("2024-12-01"),
					status: "flagged",
					riskScore: 45,
					riskLevel: "medium",
				},
			];

			res.json({ userId, screenings: history });
		} catch (error) {
			console.error("[AML] History retrieval error:", error);
			res.status(500).json({ error: "Failed to retrieve screening history" });
		}
	},
);

// Transaction Monitoring

// Monitor a specific transaction for AML compliance
router.post(
	"/api/aml/monitor-transaction",
	requireAuth,
	async (req: Request, res: Response) => {
		try {
			const { amount, currency, fromCountry, toCountry, transactionType } =
				req.body;
			const userId = (req.user as any)!.id;

			const transactionData = {
				userId,
				amount,
				currency,
				fromCountry,
				toCountry,
				transactionType,
			};

			const alerts = await amlService.monitorTransaction(transactionData);

			if (alerts.length > 0) {
				console.log("[AML] Transaction alerts generated", {
					userId,
					alertCount: alerts.length,
					alerts: alerts.map((a) => ({
						alertId: a.alertId,
						type: a.alertType,
						risk: a.riskScore,
					})),
				});
			}

			res.json({
				transaction: transactionData,
				alerts,
				status: alerts.length > 0 ? "flagged" : "clear",
			});
		} catch (error) {
			console.error("[AML] Transaction monitoring error:", error);
			res.status(500).json({ error: "Failed to monitor transaction" });
		}
	},
);

// Get transaction alerts for a user
router.get(
	"/api/aml/alerts/:userId",
	requireAuth,
	async (req: Request, res: Response) => {
		try {
			const { userId } = req.params;
			const { status } = req.query;

			// Verify access permissions
			if (
				(req.user as any)!.id !== userId &&
				(req.user as any)!.role !== "admin"
			) {
				return res.status(403).json({ error: "Access denied" });
			}

			// Mock alerts data - replace with actual database query
			let alerts = [
				{
					alertId: "alt_abc123def456",
					transactionId: "txn_789012345",
					alertType: "unusual_volume",
					riskScore: 70,
					description: "Large transaction amount: USD 15000",
					status: "open",
					createdAt: new Date("2025-01-15"),
				},
				{
					alertId: "alt_def456ghi789",
					transactionId: "txn_345678901",
					alertType: "high_risk_country",
					riskScore: 85,
					description: "Transaction involving high-risk jurisdiction",
					status: "investigating",
					createdAt: new Date("2025-01-10"),
				},
			];

			// Filter by status if provided
			if (status) {
				alerts = alerts.filter((alert) => alert.status === status);
			}

			res.json({ userId, alerts });
		} catch (error) {
			console.error("[AML] Alerts retrieval error:", error);
			res.status(500).json({ error: "Failed to retrieve alerts" });
		}
	},
);

// Risk Assessment and Compliance

// Get current risk profile for a user
router.get(
	"/api/aml/risk-profile/:userId",
	requireAuth,
	async (req: Request, res: Response) => {
		try {
			const { userId } = req.params;

			// Verify access permissions
			if (
				(req.user as any)!.id !== userId &&
				(req.user as any)!.role !== "admin"
			) {
				return res.status(403).json({ error: "Access denied" });
			}

			// Trigger periodic review if needed
			const screeningResult = await amlService.performPeriodicReview(userId);

			res.json({
				userId,
				riskProfile: screeningResult.riskProfile,
				lastScreening: screeningResult.completedAt,
				status: screeningResult.status,
			});
		} catch (error) {
			console.error("[AML] Risk profile error:", error);
			res.status(500).json({ error: "Failed to retrieve risk profile" });
		}
	},
);

// Trigger Enhanced Due Diligence (EDD)
router.post(
	"/api/aml/trigger-edd",
	requireAuth,
	async (req: Request, res: Response) => {
		try {
			const { userId, reason } = req.body;

			// Only admin can trigger EDD
			if ((req.user as any)!.role !== "admin") {
				return res.status(403).json({ error: "Admin access required" });
			}

			const eddResult = await amlService.triggerEDD(userId, reason);

			console.log("[AML] EDD triggered", {
				eddId: eddResult.eddId,
				userId,
				reason,
				triggeredBy: (req.user as any)!.id,
				timestamp: new Date().toISOString(),
			});

			res.json(eddResult);
		} catch (error) {
			console.error("[AML] EDD trigger error:", error);
			res.status(500).json({ error: "Failed to trigger EDD" });
		}
	},
);

// Administrative and Compliance Endpoints

// Generate compliance report (Admin only)
router.get(
	"/api/aml/compliance-report",
	requireAuth,
	async (req: Request, res: Response) => {
		try {
			// Only admin can access compliance reports
			if ((req.user as any)!.role !== "admin") {
				return res.status(403).json({ error: "Admin access required" });
			}

			const { startDate, endDate } = req.query;

			const start = startDate
				? new Date(startDate as string)
				: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
			const end = endDate ? new Date(endDate as string) : new Date();

			const report = await amlService.generateComplianceReport(start, end);

			res.json({
				period: { startDate: start, endDate: end },
				report,
				generatedAt: new Date(),
				generatedBy: (req.user as any)!.id,
			});
		} catch (error) {
			console.error("[AML] Compliance report error:", error);
			res.status(500).json({ error: "Failed to generate compliance report" });
		}
	},
);

// Update alert status (Admin only)
router.put(
	"/api/aml/alerts/:alertId/status",
	requireAuth,
	async (req: Request, res: Response) => {
		try {
			const { alertId } = req.params;
			const { status, resolution, notes } = req.body;

			// Only admin can update alert status
			if ((req.user as any)!.role !== "admin") {
				return res.status(403).json({ error: "Admin access required" });
			}

			// Mock status update - replace with actual database update
			const updatedAlert = {
				alertId,
				status,
				resolution,
				notes,
				updatedAt: new Date(),
				updatedBy: (req.user as any)!.id,
			};

			console.log("[AML] Alert status updated", updatedAlert);

			res.json(updatedAlert);
		} catch (error) {
			console.error("[AML] Alert update error:", error);
			res.status(500).json({ error: "Failed to update alert status" });
		}
	},
);

// Batch screening for multiple users (Admin only)
router.post(
	"/api/aml/batch-screen",
	requireAuth,
	async (req: Request, res: Response) => {
		try {
			const { userIds } = req.body;

			// Only admin can perform batch screening
			if ((req.user as any)!.role !== "admin") {
				return res.status(403).json({ error: "Admin access required" });
			}

			if (!Array.isArray(userIds) || userIds.length === 0) {
				return res.status(400).json({ error: "User IDs array is required" });
			}

			if (userIds.length > 100) {
				return res.status(400).json({ error: "Maximum 100 users per batch" });
			}

			// Process users in batches to avoid overwhelming the system
			const results = [];
			for (const userId of userIds) {
				try {
					const screeningResult =
						await amlService.performPeriodicReview(userId);
					results.push({
						userId,
						status: "completed",
						result: screeningResult,
					});
				} catch (error) {
					results.push({
						userId,
						status: "failed",
						error: (error as Error).message,
					});
				}
			}

			console.log("[AML] Batch screening completed", {
				totalUsers: userIds.length,
				successful: results.filter((r) => r.status === "completed").length,
				failed: results.filter((r) => r.status === "failed").length,
				batchId: `batch_${Date.now()}`,
				executedBy: (req.user as any)!.id,
			});

			res.json({
				batchId: `batch_${Date.now()}`,
				totalUsers: userIds.length,
				results,
				completedAt: new Date(),
			});
		} catch (error) {
			console.error("[AML] Batch screening error:", error);
			res.status(500).json({ error: "Failed to complete batch screening" });
		}
	},
);

// Health check endpoint for AML service
router.get("/api/aml/health", async (req: Request, res: Response) => {
	try {
		const healthStatus = {
			status: "healthy",
			timestamp: new Date(),
			services: {
				sanctionScanner: "operational",
				complyCube: "operational",
				sumsub: "operational",
				database: "operational",
			},
			version: "1.0.0",
		};

		res.json(healthStatus);
	} catch (error) {
		console.error("[AML] Health check error:", error);
		res.status(500).json({
			status: "unhealthy",
			timestamp: new Date(),
			error: "Service unavailable",
		});
	}
});

export default router;
