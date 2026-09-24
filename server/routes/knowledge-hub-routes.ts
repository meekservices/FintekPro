// @ts-nocheck
import { Router, Request, Response, NextFunction } from "express";
import { knowledgeHubService } from "../services/knowledge-hub-service";
import { nismLmsService } from "../services/nism-lms-service";
import { irdaiPospTrainingService } from "../services/irdai-posp-training-service";
import { requireAuth, requireRole } from "../middleware/roleMiddleware";

const router = Router();

const asyncHandler =
	(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
	(req: Request, res: Response, next: NextFunction) =>
		Promise.resolve(fn(req, res, next)).catch(next);

router.get(
	"/config",
	requireAuth,
	asyncHandler(async (req, res) => {
		const config = await knowledgeHubService.getConfig();
		res.json(config);
	}),
);

router.put(
	"/config",
	requireRole("super_admin", "admin"),
	asyncHandler(async (req, res) => {
		const userId = (req as any).user?.id || "system";
		const result = await knowledgeHubService.updateConfig(userId, req.body);
		res.json(result);
	}),
);

router.get(
	"/dashboard",
	requireAuth,
	asyncHandler(async (req, res) => {
		const agentId = (req as any).user?.id;
		const stats = await knowledgeHubService.getDashboardStats(agentId);
		res.json(stats);
	}),
);

router.get(
	"/market-brief/today",
	requireAuth,
	asyncHandler(async (req, res) => {
		const region = (req.query.region as string) || "india";
		const brief = await knowledgeHubService.getTodaysBrief(region);

		if (brief) {
			await knowledgeHubService.logAuditEvent({
				userId: (req as any).user?.id || "anonymous",
				userRole: (req as any).user?.roles?.[0] || "agent",
				eventType: "brief_viewed",
				resourceType: "market_brief",
				resourceId: brief.id,
				contentId: brief.id,
				contentVersion: brief.version,
				ipAddress: req.ip,
				userAgent: req.headers["user-agent"],
			});
		}

		res.json(
			brief || {
				message: "No market brief available for today",
				fallback: true,
			},
		);
	}),
);

router.get(
	"/market-brief/latest",
	requireAuth,
	asyncHandler(async (req, res) => {
		const region = (req.query.region as string) || "india";
		const brief = await knowledgeHubService.getLatestApprovedBrief(region);
		res.json(brief);
	}),
);

router.get(
	"/market-briefs",
	requireAuth,
	asyncHandler(async (req, res) => {
		const { region, status, limit } = req.query;
		const briefs = await knowledgeHubService.getMarketBriefs({
			region: region as string,
			status: status as string,
			limit: limit ? Number.parseInt(limit as string) : 10,
		});
		res.json(briefs);
	}),
);

router.post(
	"/market-brief",
	requireRole("super_admin", "admin"),
	asyncHandler(async (req, res) => {
		const result = await knowledgeHubService.createMarketBrief(req.body);
		res.json(result[0]);
	}),
);

router.post(
	"/market-brief/:id/approve",
	requireRole("super_admin", "admin"),
	asyncHandler(async (req, res) => {
		const { id } = req.params;
		const approverId = (req as any).user?.id || "system";
		const result = await knowledgeHubService.approveMarketBrief(id, approverId);
		res.json(result[0]);
	}),
);

router.post(
	"/market-brief/:id/reject",
	requireRole("super_admin", "admin"),
	asyncHandler(async (req, res) => {
		const { id } = req.params;
		const reviewerId = (req as any).user?.id || "system";
		const { reason } = req.body;
		const result = await knowledgeHubService.rejectMarketBrief(
			id,
			reviewerId,
			reason,
		);
		res.json(result[0]);
	}),
);

router.get(
	"/products",
	requireAuth,
	asyncHandler(async (req, res) => {
		const { productType, riskProfile, status } = req.query;
		const products = await knowledgeHubService.getProductKnowledge({
			productType: productType as string,
			riskProfile: riskProfile as string,
			status: status as string,
		});

		await knowledgeHubService.logAuditEvent({
			userId: (req as any).user?.id || "anonymous",
			userRole: (req as any).user?.roles?.[0] || "agent",
			eventType: "knowledge_accessed",
			resourceType: "product_knowledge",
			actionDetails: { filter: { productType, riskProfile } },
			ipAddress: req.ip,
			userAgent: req.headers["user-agent"],
		});

		res.json(products);
	}),
);

router.get(
	"/products/:id",
	requireAuth,
	asyncHandler(async (req, res) => {
		const product = await knowledgeHubService.getProductKnowledgeById(
			req.params.id,
		);
		if (!product) {
			return res.status(404).json({ error: "Product knowledge not found" });
		}

		await knowledgeHubService.logAuditEvent({
			userId: (req as any).user?.id || "anonymous",
			userRole: (req as any).user?.roles?.[0] || "agent",
			eventType: "knowledge_accessed",
			resourceType: "product_knowledge",
			resourceId: product.id,
			contentId: product.id,
			contentVersion: product.version,
			ipAddress: req.ip,
			userAgent: req.headers["user-agent"],
		});

		res.json(product);
	}),
);

router.post(
	"/products",
	requireRole("super_admin", "admin"),
	asyncHandler(async (req, res) => {
		const createdBy = (req as any).user?.id || "system";
		const result = await knowledgeHubService.createProductKnowledge(
			req.body,
			createdBy,
		);
		res.json(result[0]);
	}),
);

router.put(
	"/products/:id",
	requireRole("super_admin", "admin"),
	asyncHandler(async (req, res) => {
		const editedBy = (req as any).user?.id || "system";
		const result = await knowledgeHubService.updateProductKnowledge(
			req.params.id,
			req.body,
			editedBy,
		);
		res.json(result[0]);
	}),
);

router.post(
	"/products/:id/publish",
	requireRole("super_admin", "admin"),
	asyncHandler(async (req, res) => {
		const publishedBy = (req as any).user?.id || "system";
		const result = await knowledgeHubService.publishProductKnowledge(
			req.params.id,
			publishedBy,
		);
		res.json(result[0]);
	}),
);

router.get(
	"/explanations",
	requireAuth,
	asyncHandler(async (req, res) => {
		const { category } = req.query;
		const templates = await knowledgeHubService.getExplanationTemplates({
			category: category as string,
		});
		res.json(templates);
	}),
);

router.post(
	"/explanations/:id/use",
	requireAuth,
	asyncHandler(async (req, res) => {
		const { id } = req.params;
		await knowledgeHubService.incrementTemplateUsage(id);
		res.json({ success: true });
	}),
);

router.post(
	"/simplify",
	requireAuth,
	asyncHandler(async (req, res) => {
		const { text } = req.body;
		if (!text || typeof text !== "string") {
			return res.status(400).json({ error: "Text is required" });
		}
		const simplified = await knowledgeHubService.simplifyTextWithAI(text);
		res.json({ simplified });
	}),
);

router.get(
	"/explanations/:id",
	requireAuth,
	asyncHandler(async (req, res) => {
		const template = await knowledgeHubService.getExplanationTemplateById(
			req.params.id,
		);
		if (!template) {
			return res.status(404).json({ error: "Explanation template not found" });
		}
		res.json(template);
	}),
);

router.post(
	"/explanations",
	requireRole("super_admin", "admin"),
	asyncHandler(async (req, res) => {
		const createdBy = (req as any).user?.id || "system";
		const result = await knowledgeHubService.createExplanationTemplate(
			req.body,
			createdBy,
		);
		res.json(result[0]);
	}),
);

router.post(
	"/explanations/:id/share",
	requireAuth,
	asyncHandler(async (req, res) => {
		const { clientId, clientName, shareMethod } = req.body;
		const template = await knowledgeHubService.getExplanationTemplateById(
			req.params.id,
		);

		if (!template) {
			return res.status(404).json({ error: "Template not found" });
		}

		await knowledgeHubService.logAuditEvent({
			userId: (req as any).user?.id || "anonymous",
			userRole: (req as any).user?.roles?.[0] || "agent",
			eventType: "explanation_shared",
			resourceType: "explanation_template",
			resourceId: template.id,
			clientId,
			clientName,
			actionDetails: { shareMethod },
			ipAddress: req.ip,
			userAgent: req.headers["user-agent"],
		});

		res.json({
			success: true,
			message: "Explanation shared and logged for compliance",
		});
	}),
);

router.get(
	"/asset-insights",
	requireAuth,
	asyncHandler(async (req, res) => {
		const { assetClass } = req.query;
		const insights = await knowledgeHubService.getAssetClassInsights(
			assetClass as string,
		);
		res.json(insights);
	}),
);

router.get(
	"/disclaimers",
	requireAuth,
	asyncHandler(async (req, res) => {
		const { category } = req.query;
		const disclaimers = await knowledgeHubService.getDisclaimers(
			category as string,
		);
		res.json(disclaimers);
	}),
);

router.get(
	"/disclaimers/active/:category",
	requireAuth,
	asyncHandler(async (req, res) => {
		const disclaimer = await knowledgeHubService.getActiveDisclaimer(
			req.params.category,
		);
		res.json(disclaimer);
	}),
);

router.post(
	"/disclaimers",
	requireRole("super_admin", "admin"),
	asyncHandler(async (req, res) => {
		const createdBy = (req as any).user?.id || "system";
		const result = await knowledgeHubService.createDisclaimer(
			req.body,
			createdBy,
		);
		res.json(result[0]);
	}),
);

router.get(
	"/certifications",
	requireAuth,
	asyncHandler(async (req, res) => {
		const agentId = (req as any).user?.id;
		const certifications =
			await knowledgeHubService.getAgentCertifications(agentId);
		res.json(certifications);
	}),
);

router.get(
	"/certifications/my",
	requireAuth,
	asyncHandler(async (req, res) => {
		const agentId = (req as any).user?.id;
		const certifications =
			await knowledgeHubService.getAgentCertifications(agentId);
		res.json(certifications);
	}),
);

router.post(
	"/certifications",
	requireAuth,
	asyncHandler(async (req, res) => {
		const agentId = (req as any).user?.id;
		const result = await knowledgeHubService.addAgentCertification(
			agentId,
			req.body,
		);

		await knowledgeHubService.logAuditEvent({
			userId: agentId,
			userRole: (req as any).user?.roles?.[0] || "agent",
			eventType: "certification_updated",
			resourceType: "agent_certification",
			resourceId: result[0].id,
			actionDetails: { certificationType: req.body.certificationType },
			ipAddress: req.ip,
			userAgent: req.headers["user-agent"],
		});

		res.json(result[0]);
	}),
);

router.get(
	"/quizzes",
	requireAuth,
	asyncHandler(async (req, res) => {
		const { level } = req.query;
		const quizzes = await knowledgeHubService.getCertificationQuizzes(
			level as string,
		);
		res.json(quizzes);
	}),
);

router.post(
	"/quizzes/:id/submit",
	requireAuth,
	asyncHandler(async (req, res) => {
		const { answers } = req.body;
		const agentId = (req as any).user?.id;
		const quizId = req.params.id;

		if (!answers || typeof answers !== "object") {
			return res.status(400).json({ error: "Answers are required" });
		}

		const result = await knowledgeHubService.scoreAndSubmitQuizAttempt(
			quizId,
			agentId,
			answers,
		);

		await knowledgeHubService.logAuditEvent({
			userId: agentId,
			userRole: (req as any).user?.roles?.[0] || "agent",
			eventType: "certification_updated",
			resourceType: "quiz_attempt",
			resourceId: result.attemptId,
			actionDetails: { quizId, score: result.score, passed: result.passed },
			ipAddress: req.ip,
			userAgent: req.headers["user-agent"],
		});

		res.json(result);
	}),
);

router.get(
	"/quizzes/attempts",
	requireAuth,
	asyncHandler(async (req, res) => {
		const agentId = (req as any).user?.id;
		const { quizId } = req.query;
		const attempts = await knowledgeHubService.getQuizAttempts(
			agentId,
			quizId as string,
		);
		res.json(attempts);
	}),
);

router.get(
	"/audit-logs",
	requireRole("super_admin", "admin"),
	asyncHandler(async (req, res) => {
		const { userId, eventType, startDate, endDate, limit } = req.query;
		const logs = await knowledgeHubService.getAuditLogs({
			userId: userId as string,
			eventType: eventType as string,
			startDate: startDate ? new Date(startDate as string) : undefined,
			endDate: endDate ? new Date(endDate as string) : undefined,
			limit: limit ? Number.parseInt(limit as string) : 100,
		});
		res.json(logs);
	}),
);

// ── NISM E-Learning LMS (LTI 1.3 / xAPI) Routes ─────────────────────────────

// GET /api/knowledge-hub/nism/courses — list accredited NISM courses with progress
router.get(
	"/nism/courses",
	requireAuth,
	asyncHandler(async (req, res) => {
		const agentId = (req as any).user?.id;
		const courses = await nismLmsService.getCoursesWithAgentStatus(agentId);
		res.json({ success: true, courses });
	}),
);

// POST /api/knowledge-hub/nism/courses/:courseId/enroll — enroll in course
router.post(
	"/nism/courses/:courseId/enroll",
	requireAuth,
	asyncHandler(async (req, res) => {
		const agentId = (req as any).user?.id;
		const { courseId } = req.params;
		const result = await nismLmsService.enrollAgent(agentId, courseId);
		res.json(result);
	}),
);

// POST /api/knowledge-hub/nism/courses/:courseId/launch — LTI 1.3 SSO launch
router.post(
	"/nism/courses/:courseId/launch",
	requireAuth,
	asyncHandler(async (req, res) => {
		const user = (req as any).user;
		const agentId = user?.id;
		const agentName = `${user?.firstName || "Advisor"} ${user?.lastName || ""}`.trim();
		const agentEmail = user?.email || "advisor@fintekpro.com";
		const { courseId } = req.params;

		const launchData = await nismLmsService.generateLtiLaunch(
			agentId,
			courseId,
			agentName,
			agentEmail,
		);

		await knowledgeHubService.logAuditEvent({
			userId: agentId,
			userRole: user?.roles?.[0] || "agent",
			eventType: "nism_course_launched",
			resourceType: "nism_lms_course",
			resourceId: courseId,
			actionDetails: { courseId, launchUrl: launchData.launchUrl },
			ipAddress: req.ip,
			userAgent: req.headers["user-agent"],
		});

		res.json({ success: true, ...launchData });
	}),
);

// POST /api/knowledge-hub/nism/xapi/statements — Ingest xAPI / TinCan statement webhook
router.post(
	"/nism/xapi/statements",
	asyncHandler(async (req, res) => {
		const statement = req.body;
		if (!statement || !statement.actor || !statement.verb || !statement.object) {
			return res.status(400).json({ error: "Invalid xAPI statement format" });
		}

		const result = await nismLmsService.ingestXApiStatement(statement);
		res.json(result);
	}),
);

// GET /api/knowledge-hub/nism/summary — NISM metrics and CPE summary
router.get(
	"/nism/summary",
	requireAuth,
	asyncHandler(async (req, res) => {
		const agentId = (req as any).user?.id;
		const summary = await nismLmsService.getAgentSummary(agentId);
		res.json({ success: true, summary });
	}),
);

// ── IRDAI POSP 15-Hour Mandatory Training Routes ─────────────────────────────

// GET /api/knowledge-hub/irdai/modules — list 15-hr POSP modules & training summary
router.get(
	"/irdai/modules",
	requireAuth,
	asyncHandler(async (req, res) => {
		const agentId = (req as any).user?.id;
		const data = await irdaiPospTrainingService.getModulesWithProgress(agentId);
		res.json({ success: true, ...data });
	}),
);

// POST /api/knowledge-hub/irdai/heartbeat — record 60-second verified engagement
router.post(
	"/irdai/heartbeat",
	requireAuth,
	asyncHandler(async (req, res) => {
		const agentId = (req as any).user?.id;
		const { moduleId } = req.body;
		if (!moduleId) {
			return res.status(400).json({ error: "moduleId is required" });
		}
		const result = await irdaiPospTrainingService.recordHeartbeat(agentId, moduleId);
		res.json(result);
	}),
);

// GET /api/knowledge-hub/irdai/exam/questions — fetch 50 MCQs
router.get(
	"/irdai/exam/questions",
	requireAuth,
	asyncHandler(async (req, res) => {
		const agentId = (req as any).user?.id;
		const data = await irdaiPospTrainingService.getExamQuestions(agentId);
		res.json(data);
	}),
);

// POST /api/knowledge-hub/irdai/exam/submit — submit POSP exam
router.post(
	"/irdai/exam/submit",
	requireAuth,
	asyncHandler(async (req, res) => {
		const user = (req as any).user;
		const agentId = user?.id;
		const candidateName = `${user?.firstName || "Candidate"} ${user?.lastName || ""}`.trim();
		const { answers } = req.body;

		if (!answers || typeof answers !== "object") {
			return res.status(400).json({ error: "Answers object is required" });
		}

		const result = await irdaiPospTrainingService.submitExam(agentId, answers, candidateName);

		await knowledgeHubService.logAuditEvent({
			userId: agentId,
			userRole: user?.roles?.[0] || "agent",
			eventType: "irdai_posp_exam_submitted",
			resourceType: "irdai_posp_examination",
			resourceId: result.certificateNumber || "attempt",
			actionDetails: {
				scorePercentage: result.scorePercentage,
				passed: result.passed,
				certificateNumber: result.certificateNumber,
			},
			ipAddress: req.ip,
			userAgent: req.headers["user-agent"],
		});

		res.json(result);
	}),
);

export default router;
