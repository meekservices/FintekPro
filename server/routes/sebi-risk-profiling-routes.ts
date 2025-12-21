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
      data: questionnaire
    });
  } catch (error: any) {
    console.error("Error fetching questionnaire:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch questionnaire",
      message: error.message
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
      data: profiles
    });
  } catch (error: any) {
    console.error("Error fetching risk profiles:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch risk profiles"
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
        error: "Answers are required"
      });
    }

    const result = await sebiRiskScoringService.calculateRiskScore(answers, clientInfo || {});
    
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error("Error calculating risk score:", error);
    res.status(500).json({
      success: false,
      error: "Failed to calculate risk score",
      message: error.message
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
        error: "User ID and PAN are required"
      });
    }

    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Answers are required"
      });
    }

    // Calculate score
    const scoreResult = await sebiRiskScoringService.calculateRiskScore(answers, clientInfo || {});

    // Save assessment
    const assessment = await sebiRiskScoringService.saveAssessment(
      userId,
      pan.toUpperCase(),
      scoreResult,
      answers,
      {
        assessmentType: "initial",
        clientIp: req.ip,
        assessorRole: "client"
      }
    );

    res.json({
      success: true,
      data: {
        assessment,
        scoreResult
      }
    });
  } catch (error: any) {
    console.error("Error submitting risk assessment:", error);
    res.status(500).json({
      success: false,
      error: "Failed to submit risk assessment",
      message: error.message
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
        error: "No active risk assessment found"
      });
    }

    res.json({
      success: true,
      data: assessment
    });
  } catch (error: any) {
    console.error("Error fetching assessment:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch assessment"
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
    const assessment = await sebiRiskScoringService.getAssessmentByPAN(pan.toUpperCase());

    if (!assessment) {
      return res.status(404).json({
        success: false,
        error: "No active risk assessment found for this PAN"
      });
    }

    res.json({
      success: true,
      data: assessment
    });
  } catch (error: any) {
    console.error("Error fetching assessment by PAN:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch assessment"
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
      data: history
    });
  } catch (error: any) {
    console.error("Error fetching assessment history:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch assessment history"
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
    const needsRevalidation = await sebiRiskScoringService.needsRevalidation(userId);

    res.json({
      success: true,
      data: { needsRevalidation }
    });
  } catch (error: any) {
    console.error("Error checking revalidation:", error);
    res.status(500).json({
      success: false,
      error: "Failed to check revalidation status"
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
        error: "Profile code and product type are required"
      });
    }

    const eligibility = await sebiRiskScoringService.checkProductEligibility(profileCode, productType);

    res.json({
      success: true,
      data: eligibility
    });
  } catch (error: any) {
    console.error("Error checking eligibility:", error);
    res.status(500).json({
      success: false,
      error: "Failed to check eligibility"
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
    const matrix = await sebiRiskScoringService.getProductEligibilityMatrix(profileCode);

    res.json({
      success: true,
      data: matrix
    });
  } catch (error: any) {
    console.error("Error fetching eligibility matrix:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch eligibility matrix"
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
      count: logs.length
    });
  } catch (error: any) {
    console.error("Error fetching audit logs:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch audit logs"
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
      message: "SEBI Risk Profiling data initialized successfully"
    });
  } catch (error: any) {
    console.error("Error initializing data:", error);
    res.status(500).json({
      success: false,
      error: "Failed to initialize data",
      message: error.message
    });
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
        error: "User not authenticated"
      });
    }

    const assessment = await sebiRiskScoringService.getActiveAssessment(user.id);
    
    if (!assessment) {
      return res.status(404).json({
        success: false,
        error: "No risk profile found. Please complete risk assessment."
      });
    }

    // Transform to frontend-expected format
    res.json({
      id: assessment.id,
      userId: assessment.userId,
      panNumber: assessment.pan,
      riskScore: parseFloat(String(assessment.adjustedScore || assessment.rawScore)),
      riskTier: assessment.profileCode,
      tierLabel: assessment.profileCode === 'RP1' ? 'Conservative' :
                 assessment.profileCode === 'RP2' ? 'Moderately Conservative' :
                 assessment.profileCode === 'RP3' ? 'Moderate' :
                 assessment.profileCode === 'RP4' ? 'Moderately Aggressive' :
                 'Aggressive',
      assessmentDate: assessment.createdAt,
      validUntil: assessment.expiresAt || new Date(new Date(assessment.createdAt).getTime() + 365 * 24 * 60 * 60 * 1000),
      categoryScores: assessment.categoryScores || {},
      sebiOverrideApplied: assessment.hasOverride || false,
      sebiOverrideReason: assessment.overrideReason,
      originalTier: assessment.originalProfileCode
    });
  } catch (error: any) {
    console.error("Error fetching user risk profile:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch risk profile"
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
        error: "User not authenticated"
      });
    }

    const { questionnaireVersion, responses } = req.body;

    if (!questionnaireVersion || !responses || Object.keys(responses).length === 0) {
      return res.status(400).json({
        success: false,
        error: "Questionnaire version and responses are required"
      });
    }

    // Convert responses object to answers array
    const answers = Object.entries(responses).map(([questionId, response]: [string, any]) => ({
      questionId: parseInt(questionId),
      selectedOption: response.selectedOption,
      score: response.score,
      questionCode: `Q_${questionId}`,
      optionCode: response.selectedOption
    }));

    // Get client info from user profile
    const clientInfo = {
      age: user.dateOfBirth ? Math.floor((Date.now() - new Date(user.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : undefined
    };

    // Calculate score
    const scoreResult = await sebiRiskScoringService.calculateRiskScore(answers, clientInfo);

    // Save assessment
    const assessment = await sebiRiskScoringService.saveAssessment(
      user.id,
      user.pan?.toUpperCase() || 'PENDING',
      scoreResult,
      answers,
      {
        assessmentType: "initial",
        questionnaireVersion,
        clientIp: req.ip || '',
        assessorRole: "client"
      }
    );

    res.json({
      success: true,
      data: {
        assessment,
        scoreResult
      }
    });
  } catch (error: any) {
    console.error("Error submitting risk assessment:", error);
    res.status(500).json({
      success: false,
      error: "Failed to submit risk assessment",
      message: error.message
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
        error: "User not authenticated"
      });
    }

    const assessment = await sebiRiskScoringService.getActiveAssessment(user.id);
    
    if (!assessment) {
      return res.status(404).json({
        success: false,
        error: "No risk profile found"
      });
    }

    const matrix = await sebiRiskScoringService.getProductEligibilityMatrix(assessment.profileCode);
    
    // Transform to frontend-expected format
    const eligibility = matrix.map(item => ({
      productType: item.productTypeLabel,
      isEligible: item.isEligible,
      reason: item.reason
    }));

    res.json(eligibility);
  } catch (error: any) {
    console.error("Error fetching product eligibility:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch product eligibility"
    });
  }
});

export default router;
