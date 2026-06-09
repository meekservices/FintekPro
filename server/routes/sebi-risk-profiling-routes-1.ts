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
router.get("/questionnaire", requireAuth, async (req, res) => {
	try {
		const questionnaire = await sebiRiskScoringService.getQuestionnaire();
		res.json({
			success: true,
			data: questionnaire,
		});
	} catch (error: any) {
		console.error("Error fetching questionnaire:", error);
		res.status(500).json({
			success: false,
			error: "Failed to fetch questionnaire",
			message: error.message,
		});
	}
});

/**
 * GET /api/sebi-risk-profiling/profiles
 * Get all risk profile master data
 */
router.get("/profiles", async (req, res) => {
	try {
		const profiles = await sebiRiskScoringService.getRiskProfilesMaster();
		res.json({
			success: true,
			data: profiles,
		});
	} catch (error: any) {
		console.error("Error fetching risk profiles:", error);
		res.status(500).json({
			success: false,
			error: "Failed to fetch risk profiles",
		});
	}
});

/**
 * POST /api/sebi-risk-profiling/calculate
 * Calculate risk score from questionnaire answers
 */
router.post("/calculate", async (req, res) => {
	try {
		const { answers, clientInfo } = req.body;

		if (!answers || !Array.isArray(answers) || answers.length === 0) {
			return res.status(400).json({
				success: false,
				error: "Answers are required",
			});
		}

		const result = await sebiRiskScoringService.calculateRiskScore(
			answers,
			clientInfo || {},
		);

		res.json({
			success: true,
			data: result,
		});
	} catch (error: any) {
		console.error("Error calculating risk score:", error);
		res.status(500).json({
			success: false,
			error: "Failed to calculate risk score",
			message: error.message,
		});
	}
});

/**
 * POST /api/sebi-risk-profiling/submit
 * Submit and save risk assessment
 */
router.post("/submit", async (req, res) => {
	try {
		const { userId, pan, answers, clientInfo } = req.body;

		if (!userId || !pan) {
			return res.status(400).json({
				success: false,
				error: "User ID and PAN are required",
			});
		}

		if (!answers || !Array.isArray(answers) || answers.length === 0) {
			return res.status(400).json({
				success: false,
				error: "Answers are required",
			});
		}

		// Calculate score
		const scoreResult = await sebiRiskScoringService.calculateRiskScore(
			answers,
			clientInfo || {},
		);

		// Save assessment
		const assessment = await sebiRiskScoringService.saveAssessment(
			userId,
			pan.toUpperCase(),
			scoreResult,
			answers,
			{
				assessmentType: "initial",
				clientIp: req.ip,
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
 * GET /api/sebi-risk-profiling/assessment/:userId
 * Get user's active risk assessment
 */
router.get("/assessment/:userId", async (req, res) => {
	try {
		const { userId } = req.params;
		const assessment = await sebiRiskScoringService.getActiveAssessment(userId);

		if (!assessment) {
			return res.status(404).json({
				success: false,
				error: "No active risk assessment found",
			});
		}

		res.json({
			success: true,
			data: assessment,
		});
	} catch (error: any) {
		console.error("Error fetching assessment:", error);
		res.status(500).json({
			success: false,
			error: "Failed to fetch assessment",
		});
	}
});

/**
 * GET /api/sebi-risk-profiling/assessment/pan/:pan
 * Get risk assessment by PAN
 */
router.get("/assessment/pan/:pan", async (req, res) => {
	try {
		const { pan } = req.params;
		const assessment = await sebiRiskScoringService.getAssessmentByPAN(
			pan.toUpperCase(),
		);

		if (!assessment) {
			return res.status(404).json({
				success: false,
				error: "No active risk assessment found for this PAN",
			});
		}

		res.json({
			success: true,
			data: assessment,
		});
	} catch (error: any) {
		console.error("Error fetching assessment by PAN:", error);
		res.status(500).json({
			success: false,
			error: "Failed to fetch assessment",
		});
	}
});

/**
 * GET /api/sebi-risk-profiling/history/:userId
 * Get user's assessment history
 */
router.get("/history/:userId", async (req, res) => {
	try {
		const { userId } = req.params;
		const history = await sebiRiskScoringService.getAssessmentHistory(userId);

		res.json({
			success: true,
			data: history,
		});
	} catch (error: any) {
		console.error("Error fetching assessment history:", error);
		res.status(500).json({
			success: false,
			error: "Failed to fetch assessment history",
		});
	}
});

/**
 * GET /api/sebi-risk-profiling/needs-revalidation/:userId
 * Check if user needs annual revalidation
 */
router.get("/needs-revalidation/:userId", async (req, res) => {
	try {
		const { userId } = req.params;
		const needsRevalidation =
			await sebiRiskScoringService.needsRevalidation(userId);

		res.json({
			success: true,
			data: { needsRevalidation },
		});
	} catch (error: any) {
		console.error("Error checking revalidation:", error);
		res.status(500).json({
			success: false,
			error: "Failed to check revalidation status",
		});
	}
});

/**
 * POST /api/sebi-risk-profiling/eligibility/check
 * Check product eligibility for a specific profile
 */
router.post("/eligibility/check", async (req, res) => {
	try {
		const { profileCode, productType } = req.body;

		if (!profileCode || !productType) {
			return res.status(400).json({
				success: false,
				error: "Profile code and product type are required",
			});
		}

		const eligibility = await sebiRiskScoringService.checkProductEligibility(
			profileCode,
			productType,
		);

		res.json({
			success: true,
			data: eligibility,
		});
	} catch (error: any) {
		console.error("Error checking eligibility:", error);
		res.status(500).json({
			success: false,
			error: "Failed to check eligibility",
		});
	}
});

/**
 * GET /api/sebi-risk-profiling/eligibility/matrix/:profileCode
 * Get full product eligibility matrix for a profile
 */
router.get("/eligibility/matrix/:profileCode", async (req, res) => {
	try {
		const { profileCode } = req.params;
		const matrix =
			await sebiRiskScoringService.getProductEligibilityMatrix(profileCode);

		res.json({
			success: true,
			data: matrix,
		});
	} catch (error: any) {
		console.error("Error fetching eligibility matrix:", error);
		res.status(500).json({
			success: false,
			error: "Failed to fetch eligibility matrix",
		});
	}
});

/**
 * GET /api/sebi-risk-profiling/audit-logs
 * Export audit logs for compliance (Admin only)
 */
router.get("/audit-logs", requireAdmin, async (req, res) => {
	try {
		const { userId, fromDate, toDate, actionCategory } = req.query;

		const filters: any = {};
		if (userId) filters.userId = userId as string;
		if (fromDate) filters.fromDate = new Date(fromDate as string);
		if (toDate) filters.toDate = new Date(toDate as string);
		if (actionCategory) filters.actionCategory = actionCategory as string;

		const logs = await sebiRiskScoringService.getAuditLogs(filters);

		res.json({
			success: true,
			data: logs,
			count: logs.length,
		});
	} catch (error: any) {
		console.error("Error fetching audit logs:", error);
		res.status(500).json({
			success: false,
			error: "Failed to fetch audit logs",
		});
	}
});

/**
 * POST /api/sebi-risk-profiling/initialize
 * Initialize default data (Admin only, first-time setup)
 */
router.post("/initialize", requireAdmin, async (req, res) => {
	try {
		await sebiRiskScoringService.initializeDefaultData();

		res.json({
			success: true,
			message: "SEBI Risk Profiling data initialized successfully",
		});
	} catch (error: any) {
		console.error("Error initializing data:", error);
		res.status(500).json({
			success: false,
			error: "Failed to initialize data",
			message: error.message,
		});
	}
});

// ============================================
// ADMIN ENDPOINTS
// ============================================

/**
 * GET /api/sebi-risk-profiling/admin/categories
 * Get all questionnaire categories (admin)
 */
router.get("/admin/categories", requireAdmin, async (req, res) => {
	try {
		const categories = await sebiRiskScoringService.getCategories();
		res.json({ success: true, data: categories });
	} catch (error: any) {
		console.error("Error fetching categories:", error);
		res
			.status(500)
			.json({ success: false, error: "Failed to fetch categories" });
	}
});

/**
 * GET /api/sebi-risk-profiling/admin/questions
 * Get all questions (admin)
 */
router.get("/admin/questions", requireAdmin, async (req, res) => {
	try {
		const questions = await sebiRiskScoringService.getQuestions();
		res.json({ success: true, data: questions });
	} catch (error: any) {
		console.error("Error fetching questions:", error);
		res
			.status(500)
			.json({ success: false, error: "Failed to fetch questions" });
	}
});

/**
 * GET /api/sebi-risk-profiling/admin/product-matrix
 * Get product suitability matrix (admin)
 */
router.get("/admin/product-matrix", requireAdmin, async (req, res) => {
	try {
		const matrix = await sebiRiskScoringService.getProductMatrix();
		res.json({ success: true, data: matrix });
	} catch (error: any) {
		console.error("Error fetching product matrix:", error);
		res
			.status(500)
			.json({ success: false, error: "Failed to fetch product matrix" });
	}
});

/**
 * PUT /api/sebi-risk-profiling/admin/category-weights
 * Update category weights (admin)
 */
router.put("/admin/category-weights", requireAdmin, async (req, res) => {
	try {
		const { weights } = req.body;
		if (!weights || typeof weights !== "object") {
			return res
				.status(400)
				.json({ success: false, error: "Weights object required" });
		}
		await sebiRiskScoringService.updateCategoryWeights(weights);
		res.json({ success: true, message: "Weights updated successfully" });
	} catch (error: any) {
		console.error("Error updating weights:", error);
		res.status(500).json({ success: false, error: "Failed to update weights" });
	}
});

/**
 * POST /api/sebi-risk-profiling/admin/categories
 * Create a new category (admin)
 */

export default router;
