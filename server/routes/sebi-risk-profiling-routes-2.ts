// @ts-nocheck
/**
 * SEBI-Aligned Risk Profiling API Routes
 * Provides endpoints for:
 * - Risk assessment questionnaire
 * - Score calculation with SEBI overrides
 * - Product suitability checks (hard gate)
 * - Audit log export
 */

import { Router } from "express";
import { sebiRiskScoringService } from "../services/sebi-risk-scoring-service";
import { requireAdmin, requireAuth } from "../middleware/roleMiddleware";

const router = Router();

/**
 * GET /api/sebi-risk-profiling/questionnaire
 * Get the active risk assessment questionnaire (requires auth)
 */
router.post("/admin/categories", requireAdmin, async (req, res) => {
	try {
		const result = await sebiRiskScoringService.createCategory(req.body);
		res.json({ success: true, data: result });
	} catch (error: any) {
		console.error("Error creating category:", error);
		res
			.status(500)
			.json({ success: false, error: "Failed to create category" });
	}
});

/**
 * PUT /api/sebi-risk-profiling/admin/categories/:id
 * Update a category (admin)
 */
router.put("/admin/categories/:id", requireAdmin, async (req, res) => {
	try {
		const { id } = req.params;
		await sebiRiskScoringService.updateCategory(id, req.body);
		res.json({ success: true, message: "Category updated" });
	} catch (error: any) {
		console.error("Error updating category:", error);
		res
			.status(500)
			.json({ success: false, error: "Failed to update category" });
	}
});

/**
 * POST /api/sebi-risk-profiling/admin/questions
 * Create a new question (admin)
 */
router.post("/admin/questions", requireAdmin, async (req, res) => {
	try {
		const result = await sebiRiskScoringService.createQuestion(req.body);
		res.json({ success: true, data: result });
	} catch (error: any) {
		console.error("Error creating question:", error);
		res
			.status(500)
			.json({ success: false, error: "Failed to create question" });
	}
});

/**
 * PUT /api/sebi-risk-profiling/admin/questions/:id
 * Update a question (admin)
 */
router.put("/admin/questions/:id", requireAdmin, async (req, res) => {
	try {
		const { id } = req.params;
		await sebiRiskScoringService.updateQuestion(id, req.body);
		res.json({ success: true, message: "Question updated" });
	} catch (error: any) {
		console.error("Error updating question:", error);
		res
			.status(500)
			.json({ success: false, error: "Failed to update question" });
	}
});

/**
 * DELETE /api/sebi-risk-profiling/admin/questions/:id
 * Soft delete a question (admin)
 */
router.delete("/admin/questions/:id", requireAdmin, async (req, res) => {
	try {
		const { id } = req.params;
		await sebiRiskScoringService.deleteQuestion(id);
		res.json({ success: true, message: "Question deactivated" });
	} catch (error: any) {
		console.error("Error deleting question:", error);
		res
			.status(500)
			.json({ success: false, error: "Failed to delete question" });
	}
});

/**
 * POST /api/sebi-risk-profiling/admin/product-matrix
 * Create a new product suitability entry (admin)
 */
router.post("/admin/product-matrix", requireAdmin, async (req, res) => {
	try {
		const result = await sebiRiskScoringService.createProductSuitability(
			req.body,
		);
		res.json({ success: true, data: result });
	} catch (error: any) {
		console.error("Error creating product:", error);
		res.status(500).json({ success: false, error: "Failed to create product" });
	}
});

/**
 * PUT /api/sebi-risk-profiling/admin/product-matrix/:id
 * Update product suitability (admin)
 */
router.put("/admin/product-matrix/:id", requireAdmin, async (req, res) => {
	try {
		const { id } = req.params;
		await sebiRiskScoringService.updateProductSuitability(id, req.body);
		res.json({ success: true, message: "Product suitability updated" });
	} catch (error: any) {
		console.error("Error updating product:", error);
		res.status(500).json({ success: false, error: "Failed to update product" });
	}
});

// ============================================
// AI DYNAMIC RISK ENGINE
// ============================================

/**
 * POST /api/sebi-risk-profiling/ai/analyze
 * Trigger AI analysis for risk profile adjustment (admin only)
 */
router.post("/ai/analyze", requireAdmin, async (req, res) => {
	try {
		const { userId, triggerType, triggerDetails } = req.body;
		if (!userId || !triggerType) {
			return res
				.status(400)
				.json({ success: false, error: "userId and triggerType required" });
		}
		const recommendation = await sebiRiskScoringService.analyzeAndRecommend(
			userId,
			triggerType,
			triggerDetails || {},
		);
		res.json({ success: true, data: recommendation });
	} catch (error: any) {
		console.error("Error in AI analysis:", error);
		res.status(500).json({ success: false, error: "AI analysis failed" });
	}
});

/**
 * GET /api/sebi-risk-profiling/ai/recommendations/my
 * Get current user's pending AI recommendations
 */
router.get("/ai/recommendations/my", requireAuth, async (req, res) => {
	try {
		const user = (req as any).user;
		if (!user?.id) {
			return res
				.status(401)
				.json({ success: false, error: "Not authenticated" });
		}
		const recommendations =
			await sebiRiskScoringService.getPendingRecommendations(user.id);
		res.json({ success: true, data: recommendations });
	} catch (error: any) {
		console.error("Error fetching recommendations:", error);
		res
			.status(500)
			.json({ success: false, error: "Failed to fetch recommendations" });
	}
});

/**
 * GET /api/sebi-risk-profiling/ai/recommendations/:userId
 * Get pending AI recommendations for a user (admin only)
 */
router.get("/ai/recommendations/:userId", requireAdmin, async (req, res) => {
	try {
		const { userId } = req.params;
		const recommendations =
			await sebiRiskScoringService.getPendingRecommendations(userId);
		res.json({ success: true, data: recommendations });
	} catch (error: any) {
		console.error("Error fetching recommendations:", error);
		res
			.status(500)
			.json({ success: false, error: "Failed to fetch recommendations" });
	}
});

/**
 * POST /api/sebi-risk-profiling/ai/resolve/:id
 * Resolve an AI recommendation (admin only)
 */
router.post("/ai/resolve/:id", requireAdmin, async (req, res) => {
	try {
		const { id } = req.params;
		const { resolution, notes } = req.body;
		const user = (req as any).user;
		await sebiRiskScoringService.resolveAiRecommendation(
			id,
			resolution,
			user?.id || "system",
			notes,
		);
		res.json({ success: true, message: "Recommendation resolved" });
	} catch (error: any) {
		console.error("Error resolving recommendation:", error);
		res
			.status(500)
			.json({ success: false, error: "Failed to resolve recommendation" });
	}
});

// ============================================
// COMPLIANCE EXPORT
// ============================================

/**
 * GET /api/sebi-risk-profiling/compliance/report
 * Generate compliance report (admin)
 */
router.get("/compliance/report", requireAdmin, async (req, res) => {
	try {
		const { fromDate, toDate, reportType = "summary" } = req.query;

		const from = fromDate
			? new Date(fromDate as string)
			: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
		const to = toDate ? new Date(toDate as string) : new Date();

		const report = await sebiRiskScoringService.generateComplianceReport({
			fromDate: from,
			toDate: to,
			reportType: reportType as "summary" | "detailed" | "audit",
		});

		res.json({ success: true, data: report });
	} catch (error: any) {
		console.error("Error generating report:", error);
		res
			.status(500)
			.json({ success: false, error: "Failed to generate report" });
	}
});

/**
 * GET /api/sebi-risk-profiling/compliance/export/csv
 * Export compliance data as CSV (admin)
 */
router.get("/compliance/export/csv", requireAdmin, async (req, res) => {
	try {
		const { fromDate, toDate } = req.query;

		const from = fromDate
			? new Date(fromDate as string)
			: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
		const to = toDate ? new Date(toDate as string) : new Date();

		const csvData = await sebiRiskScoringService.exportComplianceCSV({
			fromDate: from,
			toDate: to,
		});

		res.setHeader("Content-Type", "text/csv");
		res.setHeader(
			"Content-Disposition",
			`attachment; filename=sebi_risk_compliance_${from.toISOString().split("T")[0]}_${to.toISOString().split("T")[0]}.csv`,
		);
		res.send(
			csvData.assessmentsCSV +
				"\n\n--- AUDIT LOGS ---\n\n" +
				csvData.auditLogsCSV,
		);
	} catch (error: any) {
		console.error("Error exporting CSV:", error);
		res.status(500).json({ success: false, error: "Failed to export CSV" });
	}
});

/**
 * GET /api/sebi-risk-profiling/my-profile
 * Get current user's risk profile (for client dashboard/badges)
 */
router.get("/my-profile", requireAuth, async (req, res) => {
	try {
		const user = (req as any).user;
		if (!user?.id) {
			return res.status(401).json({
				success: false,
				error: "User not authenticated",
			});
		}

		const assessment = await sebiRiskScoringService.getActiveAssessment(
			user.id,
		);

		if (!assessment) {
			return res.status(404).json({
				success: false,
				error: "No risk profile found. Please complete risk assessment.",
			});
		}

		// Transform to frontend-expected format
		res.json({
			id: assessment.id,
			userId: assessment.userId,
			panNumber: assessment.pan,
			riskScore: Number.parseFloat(
				String(assessment.adjustedScore || assessment.rawScore),
			),
			riskTier: assessment.profileCode,
			tierLabel:
				assessment.profileCode === "RP1"
					? "Conservative"
					: assessment.profileCode === "RP2"
						? "Moderately Conservative"
						: assessment.profileCode === "RP3"
							? "Moderate"
							: assessment.profileCode === "RP4"
								? "Moderately Aggressive"
								: "Aggressive",
			assessmentDate: assessment.createdAt,
			validUntil:
				assessment.expiresAt ||
				new Date(
					new Date(assessment.createdAt).getTime() + 365 * 24 * 60 * 60 * 1000,
				),
			categoryScores: assessment.categoryScores || {},
			sebiOverrideApplied: assessment.hasOverride || false,
			sebiOverrideReason: assessment.overrideReason,
			originalTier: assessment.originalProfileCode,
		});
	} catch (error: any) {
		console.error("Error fetching user risk profile:", error);
		res.status(500).json({
			success: false,
			error: "Failed to fetch risk profile",
		});
	}
});

/**
 * POST /api/sebi-risk-profiling/submit-assessment
 * Submit risk assessment with questionnaire responses (auth required)
 */
router.post("/submit-assessment", requireAuth, async (req, res) => {
	try {
		const user = (req as any).user;
		if (!user?.id) {
			return res.status(401).json({
				success: false,
				error: "User not authenticated",
			});
		}

		const { questionnaireVersion, responses } = req.body;

		if (
			!questionnaireVersion ||
			!responses ||
			Object.keys(responses).length === 0
		) {
			return res.status(400).json({
				success: false,
				error: "Questionnaire version and responses are required",
			});
		}

		// Convert responses object to answers array
		const answers = Object.entries(responses).map(
			([questionId, response]: [string, any]) => ({
				questionId: Number.parseInt(questionId),
				selectedOption: response.selectedOption,
				score: response.score,
				questionCode: `Q_${questionId}`,
				optionCode: response.selectedOption,
			}),
		);

		// Get client info from user profile
		const clientInfo = {
			age: user.dateOfBirth
				? Math.floor(
						(Date.now() - new Date(user.dateOfBirth).getTime()) /
							(365.25 * 24 * 60 * 60 * 1000),
					)
				: undefined,
		};

		// Calculate score
		const scoreResult = await sebiRiskScoringService.calculateRiskScore(
			answers,
			clientInfo,
		);

		// Save assessment
		const assessment = await sebiRiskScoringService.saveAssessment(
			user.id,
			user.pan?.toUpperCase() || "PENDING",
			scoreResult,
			answers,
			{
				assessmentType: "initial",
				questionnaireVersion,
				clientIp: req.ip || "",
				assessorRole: "client",
			},
		);

		res.json({
			success: true,
			data: {
				assessment,
				scoreResult,
			},
		});
	} catch (error: any) {
		console.error("Error submitting risk assessment:", error);
		res.status(500).json({
			success: false,
			error: "Failed to submit risk assessment",
			message: error.message,
		});
	}
});

/**
 * GET /api/sebi-risk-profiling/product-eligibility
 * Get product eligibility for current user's risk profile
 */
router.get("/product-eligibility", requireAuth, async (req, res) => {
	try {
		const user = (req as any).user;
		if (!user?.id) {
			return res.status(401).json({
				success: false,
				error: "User not authenticated",
			});
		}

		const assessment = await sebiRiskScoringService.getActiveAssessment(
			user.id,
		);

		if (!assessment) {
			return res.status(404).json({
				success: false,
				error: "No risk profile found",
			});
		}

		const matrix = await sebiRiskScoringService.getProductEligibilityMatrix(
			assessment.profileCode,
		);

		// Transform to frontend-expected format
		const eligibility = matrix.map((item) => ({
			productType: item.productTypeLabel,
			isEligible: item.isEligible,
			reason: item.reason,
		}));

		res.json(eligibility);
	} catch (error: any) {
		console.error("Error fetching product eligibility:", error);
		res.status(500).json({
			success: false,
			error: "Failed to fetch product eligibility",
		});
	}
});

export default router;
