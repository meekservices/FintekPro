import { Router, Request, Response } from "express";
import { z } from "zod";
import {
	ProposalFlowGatekeeper,
	createPhaseValidationMiddleware,
} from "../services/proposal-flow-gatekeeper";
import { WhatIfSimulatorEngine } from "../services/proposal-whatif-engine";
import { GoalBenchmarkMapper } from "../services/goal-benchmark-mapper";
import { ProposalVerdictNormalizer } from "../services/proposal-verdict-normalizer";
import { ProposalSipAttribution } from "../services/proposal-sip-attribution";
import { ReportDependencyResolver } from "../services/report-dependency-resolver";
import { ReportLabelRegistry } from "../services/report-label-registry";
import {
	generateRegulatorGradePdf,
	type ProposalPdfConfig,
} from "../services/reports/regulator-grade-pdf-renderer";
import { proposalAuditService } from "../services/proposal-audit-service";
import { requireAgent } from "../middleware/auth";

const router = Router();

router.use(requireAgent);

// Deferred init — waits 3 s for schema-repairs to create goal_benchmark_mapping,
// then retries up to 5 × with 2 s backoff. See routes-1 for full implementation.
// This file and routes-1 share the same GoalBenchmarkMapper singleton so only
// one actually runs; the second call is a no-op (rows already seeded, 0 inserts).
(function scheduleBenchmarkInit2() {
	const MAX = 5;
	const DELAY = 2000;
	let n = 0;
	const tryIt = async () => {
		n++;
		try {
			await GoalBenchmarkMapper.initializeDefaults();
		} catch (e: any) {
			if (n < MAX) setTimeout(tryIt, DELAY);
		}
	};
	setTimeout(tryIt, 3000);
})();

const PdfConfigSchema = z.object({
	proposalId: z.string().optional(),
	version: z.string(),
	client: z.object({
		name: z.string(),
		pan: z.string().optional(),
		email: z.string().optional(),
		phone: z.string().optional(),
	}),
	advisor: z.object({
		name: z.string(),
		arnId: z.string().optional(),
		riaId: z.string().optional(),
		email: z.string().optional(),
	}),
	investmentGoals: z.object({
		primaryGoal: z.string(),
		investmentHorizon: z.string(),
		targetAmount: z.number(),
		monthlyContribution: z.number(),
	}),
	riskProfile: z.object({
		score: z.number(),
		category: z.enum([
			"conservative",
			"moderate",
			"aggressive",
			"very_aggressive",
		]),
		tolerance: z.string(),
		version: z.string().optional(),
	}),
	proposedAllocation: z.object({
		equity: z.number(),
		debt: z.number(),
		gold: z.number(),
		realestate: z.number(),
		cash: z.number(),
		totalValue: z.number(),
	}),
	sections: z.object({
		coverPage: z.boolean(),
		tableOfContents: z.boolean(),
		executiveSummary: z.boolean(),
		portfolioOverview: z.boolean(),
		productRecommendations: z.boolean(),
		capitalGainsSummary: z.boolean(),
		exitLoadSummary: z.boolean(),
		taxImpactSummary: z.boolean(),
		rebalancingSipRecommendations: z.boolean(),
		portfolioHealthScore: z.boolean(),
		expenseRatioAnalysis: z.boolean(),
		riskHeatMap: z.boolean(),
		benchmarkComparison: z.boolean(),
		whatIfScenarios: z.boolean(),
		dividendProjection: z.boolean(),
		priorityRecommendations: z.boolean(),
		portfolioGrowthProjection: z.boolean(),
		mandatoryDisclaimers: z.boolean(),
		advisorDeclaration: z.boolean(),
	}),
	settings: z.object({
		orientation: z.enum(["portrait", "landscape"]),
	}),
	generatedBy: z.string().optional(),
	generatedByRole: z.enum(["agent", "admin", "system"]).optional(),
	downloadedBy: z.string().optional(),
	existingAllocation: z
		.object({
			equity: z.number(),
			debt: z.number(),
			gold: z.number(),
			realestate: z.number(),
			cash: z.number(),
			totalValue: z.number(),
		})
		.optional(),
	existingHoldings: z.array(z.any()).optional(),
	verdicts: z.array(z.any()).optional(),
	capitalGains: z.any().optional(),
	exitLoads: z.array(z.any()).optional(),
	taxImpact: z.any().optional(),
	sipRecommendations: z.array(z.any()).optional(),
	portfolioHealth: z.any().optional(),
	expenseAnalysis: z.any().optional(),
	riskHeatMap: z.any().optional(),
	benchmarkComparison: z.any().optional(),
	whatIfScenarios: z.array(z.any()).optional(),
	dividendProjection: z.any().optional(),
	priorityRecommendations: z.array(z.any()).optional(),
	growthProjection: z.any().optional(),
});

const OverrideLogSchema = z.object({
	eventType: z.string(),
	payloadBefore: z.record(z.string(), z.any()).optional(),
	payloadAfter: z.record(z.string(), z.any()).optional(),
	actorId: z.string(),
	actorRole: z.enum(["agent", "admin", "compliance"]),
	reason: z.string().min(1, "Override reason is required"),
	approvedBy: z.string().optional(),
});

const BenchmarkOverrideSchema = z.object({
	before: z.record(z.string(), z.any()),
	after: z.record(z.string(), z.any()),
	actorId: z.string(),
	reason: z.string().min(1, "Override reason is required"),
});

const SectionToggleSchema = z.object({
	sectionCode: z.string(),
	before: z.boolean(),
	after: z.boolean(),
	actorId: z.string(),
	actorRole: z.enum(["agent", "admin"]),
	reason: z.string().optional(),
});

// ===== FLOW STATE ENDPOINTS =====

router.delete(
	"/sips/:proposalId/:instrumentName",
	async (req: Request, res: Response) => {
		try {
			const { proposalId, instrumentName } = req.params;
			const result = await ProposalSipAttribution.deleteSipRecommendation(
				proposalId,
				instrumentName,
			);
			res.json(result);
		} catch (error: any) {
			res.status(500).json({ error: error.message });
		}
	},
);

// ===== REPORT SECTIONS ENDPOINTS =====

router.get(
	"/report-sections/:proposalId",
	async (req: Request, res: Response) => {
		try {
			const { proposalId } = req.params;
			const sections =
				await ReportDependencyResolver.resolveAllSections(proposalId);
			res.json({ proposalId, sections });
		} catch (error: any) {
			res.status(500).json({ error: error.message });
		}
	},
);

router.post(
	"/report-sections/:proposalId/toggle",
	async (req: Request, res: Response) => {
		try {
			const { proposalId } = req.params;
			const { sectionCode, enabled, byAgent } = req.body;
			const result = await ReportDependencyResolver.toggleSection(
				proposalId,
				sectionCode,
				enabled,
				byAgent,
			);
			res.json(result);
		} catch (error: any) {
			res.status(500).json({ error: error.message });
		}
	},
);

router.get(
	"/report-sections/:proposalId/enabled",
	async (req: Request, res: Response) => {
		try {
			const { proposalId } = req.params;
			const sections =
				await ReportDependencyResolver.getEnabledSections(proposalId);
			res.json({ proposalId, enabledSections: sections });
		} catch (error: any) {
			res.status(500).json({ error: error.message });
		}
	},
);

router.post(
	"/report-sections/:proposalId/auto-select",
	async (req: Request, res: Response) => {
		try {
			const { proposalId } = req.params;
			const enabledSections =
				await ReportDependencyResolver.autoSelectSections(proposalId);
			res.json({ proposalId, enabledSections });
		} catch (error: any) {
			res.status(500).json({ error: error.message });
		}
	},
);

// ===== LABEL REGISTRY ENDPOINTS =====

router.get("/labels", async (req: Request, res: Response) => {
	try {
		const labels = ReportLabelRegistry.getAllLabels();
		res.json({ labels });
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

router.get("/labels/:key", async (req: Request, res: Response) => {
	try {
		const { key } = req.params;
		const entry = ReportLabelRegistry.getLabelEntry(key);
		if (entry) {
			res.json(entry);
		} else {
			res.status(404).json({ error: "Label not found" });
		}
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

router.post("/labels/correct", async (req: Request, res: Response) => {
	try {
		const { text } = req.body;
		const corrected = ReportLabelRegistry.correctTypo(text);
		res.json({ original: text, corrected });
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

router.get("/labels/category/:prefix", async (req: Request, res: Response) => {
	try {
		const { prefix } = req.params;
		let labels;
		switch (prefix) {
			case "goal":
				labels = ReportLabelRegistry.getGoalLabels();
				break;
			case "risk":
				labels = ReportLabelRegistry.getRiskProfileLabels();
				break;
			case "phase":
				labels = ReportLabelRegistry.getPhaseLabels();
				break;
			case "scenario":
				labels = ReportLabelRegistry.getScenarioLabels();
				break;
			case "verdict":
				labels = ReportLabelRegistry.getVerdictLabels();
				break;
			default:
				labels = ReportLabelRegistry.getLabelsForCategory(prefix);
		}
		res.json({ labels });
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

// ===== PDF GENERATION ENDPOINTS =====

router.post(
	"/pdf/:proposalId/generate",
	async (req: Request, res: Response) => {
		try {
			const { proposalId } = req.params;

			// Validate request body using Zod schema
			const parseResult = PdfConfigSchema.safeParse(req.body);
			if (!parseResult.success) {
				return res.status(400).json({
					error: "Invalid PDF configuration",
					details: parseResult.error.flatten().fieldErrors,
				});
			}

			const validatedConfig = parseResult.data;
			const config: ProposalPdfConfig = {
				...validatedConfig,
				proposalId,
			} as ProposalPdfConfig;

			// Generate PDF
			const result = await generateRegulatorGradePdf(config);

			// Record PDF metadata in audit service
			await proposalAuditService.recordPdfMetadata(
				proposalId,
				result,
				validatedConfig.generatedBy || "system",
				validatedConfig.generatedByRole || "agent",
				config.client?.pan,
				config.riskProfile?.version,
				config.benchmarkComparison?.benchmarkCode,
			);

			// Log PDF generation audit event
			await proposalAuditService.logPdfGenerated(
				proposalId,
				result.version,
				result.hash,
				result.sectionsIncluded,
				validatedConfig.generatedBy || "system",
			);

			res.json({
				success: true,
				proposalId,
				version: result.version,
				hash: result.hash,
				totalPages: result.totalPages,
				sectionsIncluded: result.sectionsIncluded,
				metadata: result.metadata,
			});
		} catch (error: any) {
			res.status(500).json({ error: error.message });
		}
	},
);

router.post(
	"/pdf/:proposalId/download",
	async (req: Request, res: Response) => {
		try {
			const { proposalId } = req.params;

			// Validate request body using Zod schema
			const parseResult = PdfConfigSchema.safeParse(req.body);
			if (!parseResult.success) {
				return res.status(400).json({
					error: "Invalid PDF configuration",
					details: parseResult.error.flatten().fieldErrors,
				});
			}

			const validatedConfig = parseResult.data;
			const config: ProposalPdfConfig = {
				...validatedConfig,
				proposalId,
			} as ProposalPdfConfig;

			// Generate PDF
			const result = await generateRegulatorGradePdf(config);

			// Record download audit event
			const actorId = validatedConfig.downloadedBy || "unknown";
			await proposalAuditService.logPdfDownloaded(
				proposalId,
				result.version,
				result.hash,
				actorId,
				req.ip,
			);

			// Increment download count
			await proposalAuditService.recordPdfDownload(proposalId, result.hash);

			// Set response headers for PDF download
			res.setHeader("Content-Type", "application/pdf");
			res.setHeader(
				"Content-Disposition",
				`attachment; filename="proposal_${proposalId}_${result.version}.pdf"`,
			);
			res.setHeader("X-PDF-Hash", result.hash);
			res.setHeader("X-PDF-Version", result.version);
			res.setHeader("X-PDF-Pages", result.totalPages.toString());

			res.send(result.pdfBuffer);
		} catch (error: any) {
			res.status(500).json({ error: error.message });
		}
	},
);

router.get("/pdf/:proposalId/history", async (req: Request, res: Response) => {
	try {
		const { proposalId } = req.params;
		const history =
			await proposalAuditService.getPdfMetadataHistory(proposalId);
		res.json({ proposalId, history });
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

router.post("/pdf/:proposalId/verify", async (req: Request, res: Response) => {
	try {
		const { proposalId } = req.params;
		const { hash } = req.body;

		if (!hash) {
			return res.status(400).json({ error: "hash is required" });
		}

		const isValid = await proposalAuditService.verifyPdfHash(proposalId, hash);
		res.json({ proposalId, hash, verified: isValid });
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

// ===== AUDIT TRAIL ENDPOINTS =====

router.get("/audit/:proposalId", async (req: Request, res: Response) => {
	try {
		const { proposalId } = req.params;
		const auditTrail = await proposalAuditService.getAuditTrail(proposalId);
		res.json({ proposalId, auditTrail });
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

router.get(
	"/audit/:proposalId/overrides",
	async (req: Request, res: Response) => {
		try {
			const { proposalId } = req.params;
			const overrides =
				await proposalAuditService.getOverrideEvents(proposalId);
			res.json({ proposalId, overrides });
		} catch (error: any) {
			res.status(500).json({ error: error.message });
		}
	},
);

router.get(
	"/audit/:proposalId/chain-integrity",
	async (req: Request, res: Response) => {
		try {
			const { proposalId } = req.params;
			const integrity =
				await proposalAuditService.verifyChainIntegrity(proposalId);
			res.json({ proposalId, ...integrity });
		} catch (error: any) {
			res.status(500).json({ error: error.message });
		}
	},
);

router.get("/audit/:proposalId/export", async (req: Request, res: Response) => {
	try {
		const { proposalId } = req.params;
		const { format } = req.query;

		const bundle = await proposalAuditService.exportAuditBundle(proposalId);

		if (format === "csv") {
			res.setHeader("Content-Type", "text/csv");
			res.setHeader(
				"Content-Disposition",
				`attachment; filename="audit_${proposalId}.csv"`,
			);
			res.send(bundle.csv);
		} else {
			res.json(bundle.json);
		}
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

router.get("/audit/retention/stats", async (req: Request, res: Response) => {
	try {
		const stats = await proposalAuditService.getRetentionStats();
		res.json(stats);
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

router.post("/audit/retention/archive", async (req: Request, res: Response) => {
	try {
		const archivedCount = await proposalAuditService.archiveExpiredEvents();
		res.json({ success: true, archivedCount });
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

// ===== ROLE-BASED OVERRIDE LOGGING ENDPOINTS =====

router.post(
	"/audit/:proposalId/log-override",
	async (req: Request, res: Response) => {
		try {
			const { proposalId } = req.params;

			// Validate request body using Zod schema
			const parseResult = OverrideLogSchema.safeParse(req.body);
			if (!parseResult.success) {
				return res.status(400).json({
					error: "Invalid override log request",
					details: parseResult.error.flatten().fieldErrors,
				});
			}

			const validated = parseResult.data;

			const event = await proposalAuditService.logEvent({
				proposalId,
				eventType: validated.eventType as any,
				eventAction: "OVERRIDDEN",
				actorId: validated.actorId,
				actorRole: validated.actorRole,
				payloadBefore: validated.payloadBefore,
				payloadAfter: validated.payloadAfter,
				isOverride: true,
				overrideReason: validated.reason,
				overrideApprovedBy: validated.approvedBy,
			});

			res.json({ success: true, eventId: event.id, checksum: event.checksum });
		} catch (error: any) {
			res.status(500).json({ error: error.message });
		}
	},
);

router.post(
	"/audit/:proposalId/log-benchmark-override",
	async (req: Request, res: Response) => {
		try {
			const { proposalId } = req.params;

			// Validate request body using Zod schema
			const parseResult = BenchmarkOverrideSchema.safeParse(req.body);
			if (!parseResult.success) {
				return res.status(400).json({
					error: "Invalid benchmark override request",
					details: parseResult.error.flatten().fieldErrors,
				});
			}

			const validated = parseResult.data;

			const event = await proposalAuditService.logBenchmarkOverridden(
				proposalId,
				validated.before,
				validated.after,
				validated.actorId,
				validated.reason,
			);
			res.json({ success: true, eventId: event.id, checksum: event.checksum });
		} catch (error: any) {
			res.status(500).json({ error: error.message });
		}
	},
);

router.post(
	"/audit/:proposalId/log-section-toggle",
	async (req: Request, res: Response) => {
		try {
			const { proposalId } = req.params;

			// Validate request body using Zod schema
			const parseResult = SectionToggleSchema.safeParse(req.body);
			if (!parseResult.success) {
				return res.status(400).json({
					error: "Invalid section toggle request",
					details: parseResult.error.flatten().fieldErrors,
				});
			}

			const validated = parseResult.data;

			const event = await proposalAuditService.logReportSectionToggled(
				proposalId,
				validated.sectionCode,
				validated.before,
				validated.after,
				validated.actorId,
				validated.actorRole,
				validated.reason,
			);

			res.json({ success: true, eventId: event.id, checksum: event.checksum });
		} catch (error: any) {
			res.status(500).json({ error: error.message });
		}
	},
);

export default router;
