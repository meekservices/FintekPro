/**
 * Compliance Gate Routes
 *
 * Exposes a pre-flight readiness check so the frontend can show compliance
 * warnings BEFORE the user attempts a transaction, rather than failing at
 * the point of submission.
 *
 * GET /api/compliance/transaction-readiness?type=MF|US_EQUITY
 *  → Returns all 7 gate statuses for the current authenticated user
 */

import {
	type Express,
	type Request,
	type Response,
	type NextFunction,
} from "express";
import { isAuthenticated } from "../auth-setup";
import {
	runComplianceChecks,
	type TransactionType,
} from "../middleware/transactionComplianceGate";
import { logger } from "../logger";

function requireAuth(req: Request, res: Response, next: NextFunction) {
	return isAuthenticated(req, res, next);
}

export function registerComplianceGateRoutes(app: Express): void {
	/**
	 * GET /api/compliance/transaction-readiness
	 *
	 * Returns per-gate compliance status for the current user.
	 * The frontend uses this to render a compliance checklist widget
	 * before the invest/order form is submitted.
	 *
	 * Query params:
	 *   type — 'MF' (default) | 'US_EQUITY'
	 *   action — 'purchase' (default) | 'redemption' | 'sip' | 'stp'
	 */
	app.get(
		"/api/compliance/transaction-readiness",
		requireAuth,
		async (req: Request, res: Response) => {
			const userId = (req as any).user?.id as string;
			const rawType = ((req.query.type as string) ?? "MF").toUpperCase();
			const transactionType: TransactionType =
				rawType === "US_EQUITY"
					? "US_EQUITY"
					: rawType === "PMS"
						? "PMS"
						: rawType === "AIF"
							? "AIF"
							: "MF";
			const action = (req.query.action as string) ?? "purchase";
			const amount = req.query.amount ? Number(req.query.amount) : undefined;

			const startMs = Date.now();

			try {
				const result = await runComplianceChecks(userId, transactionType, res, {
					action: action as any,
					amount,
				});

				logger.info("TRANSACTION_READINESS_CHECKED", {
					user_id: userId,
					transaction_type: transactionType,
					overall_ready: result.passed,
					latency_ms: Date.now() - startMs,
					status: "ok",
				});

				return res.status(200).json({
					success: true,
					data: {
						ready: result.passed,
						transactionType,
						gates: result.gates.map((g) => ({
							gate: g.gate,
							name: g.gateName,
							passed: g.passed,
							errorCode: g.errorCode ?? null,
							message: g.message ?? null,
							retryable: g.retryable,
							remediationUrl: g.remediationUrl ?? null,
						})),
						summary: result.passed
							? "All compliance checks passed. You are ready to transact."
							: `Blocked at Gate ${result.failingGate?.gate}: ${result.failingGate?.gateName}`,
					},
					meta: {
						timestamp: new Date().toISOString(),
						version: "1.0",
					},
				});
			} catch (err) {
				logger.error("[ComplianceGate] Readiness check error", {
					user_id: userId,
					err,
				});
				return res.status(500).json({
					success: false,
					error: "COMPLIANCE_CHECK_FAILED",
					message: "Unable to complete compliance check. Please try again.",
					meta: { timestamp: new Date().toISOString(), version: "1.0" },
				});
			}
		},
	);

	/**
	 * GET /api/compliance/rules
	 *
	 * Returns the statutory SEBI Mutual Fund & Model Portfolio holding compliance rulebook
	 * (Seventh Schedule caps, group/sector limits, categorizations, and passive breach guidelines).
	 */
	app.get("/api/compliance/rules", async (_req: Request, res: Response) => {
		try {
			const { sebiHoldingComplianceService } = await import(
				"../services/sebi-holding-compliance-service"
			);
			const rulebook = sebiHoldingComplianceService.getSebiRulebook();
			return res.status(200).json({
				success: true,
				data: rulebook,
				meta: {
					timestamp: new Date().toISOString(),
					version: rulebook.version,
				},
			});
		} catch (err: any) {
			logger.error("[ComplianceGate] Failed to fetch SEBI rulebook", { error: err?.message });
			return res.status(500).json({
				success: false,
				error: "RULEBOOK_FETCH_FAILED",
				message: err?.message || "Failed to fetch SEBI rulebook",
				meta: { timestamp: new Date().toISOString(), version: "1.0" },
			});
		}
	});

	/**
	 * GET /api/compliance/model-portfolios/:id
	 *
	 * Audits a specific Model Portfolio against statutory SEBI Seventh Schedule & Categorization limits.
	 */
	app.get("/api/compliance/model-portfolios/:id", async (req: Request, res: Response) => {
		try {
			const { sebiHoldingComplianceService } = await import(
				"../services/sebi-holding-compliance-service"
			);
			const report = await sebiHoldingComplianceService.auditPortfolioHoldingCompliance(
				req.params.id
			);
			return res.status(200).json({
				success: true,
				data: report,
				meta: report.meta,
			});
		} catch (err: any) {
			logger.error("[ComplianceGate] Model portfolio audit error", {
				portfolio_id: req.params.id,
				error: err?.message,
			});
			return res.status(500).json({
				success: false,
				error: "COMPLIANCE_AUDIT_FAILED",
				message: err?.message || "Unable to audit model portfolio holding compliance",
				meta: { timestamp: new Date().toISOString(), version: "1.0" },
			});
		}
	});

	/**
	 * GET /api/compliance/proposals/:proposalId
	 *
	 * Audits an Advisory Investment Proposal against SEBI concentration caps before client sign-off.
	 */
	app.get("/api/compliance/proposals/:proposalId", async (req: Request, res: Response) => {
		try {
			const { sebiHoldingComplianceService } = await import(
				"../services/sebi-holding-compliance-service"
			);
			const report = await sebiHoldingComplianceService.auditProposalHoldingCompliance(
				req.params.proposalId
			);
			return res.status(200).json({
				success: true,
				data: report,
				meta: report.meta,
			});
		} catch (err: any) {
			logger.error("[ComplianceGate] Proposal audit error", {
				proposal_id: req.params.proposalId,
				error: err?.message,
			});
			return res.status(500).json({
				success: false,
				error: "PROPOSAL_AUDIT_FAILED",
				message: err?.message || "Unable to audit proposal holding compliance",
				meta: { timestamp: new Date().toISOString(), version: "1.0" },
			});
		}
	});

	/**
	 * POST /api/compliance/sweep
	 *
	 * Runs a comprehensive SEBI compliance sweep across all model portfolios.
	 */
	app.post("/api/compliance/sweep", requireAuth, async (req: Request, res: Response) => {
		try {
			const { sebiHoldingComplianceService } = await import(
				"../services/sebi-holding-compliance-service"
			);
			const auditSummary = await sebiHoldingComplianceService.auditAllModelPortfolios();
			return res.status(200).json({
				success: true,
				data: auditSummary,
				meta: {
					timestamp: new Date().toISOString(),
					version: "SEBI-COMPLIANCE-v1.0",
				},
			});
		} catch (err: any) {
			logger.error("[ComplianceGate] Compliance sweep error", { error: err?.message });
			return res.status(500).json({
				success: false,
				error: "COMPLIANCE_SWEEP_FAILED",
				message: err?.message || "Failed to execute compliance sweep",
				meta: { timestamp: new Date().toISOString(), version: "1.0" },
			});
		}
	});

	/**
	 * POST /api/compliance/model-portfolios/enforce-all
	 *
	 * Enforces SEBI statutory rules on ALL model portfolios (Retail MF, HNI PMS, UHNI AIF)
	 * and persists the compliance report directly into model_portfolios.sebi_compliance_rules.
	 */
	app.post(
		"/api/compliance/model-portfolios/enforce-all",
		requireAuth,
		async (_req: Request, res: Response) => {
			try {
				const { sebiHoldingComplianceService } = await import(
					"../services/sebi-holding-compliance-service"
				);
				const result =
					await sebiHoldingComplianceService.enforceAndRecordAllPortfoliosCompliance();
				return res.status(200).json({
					success: true,
					data: result,
					meta: {
						timestamp: new Date().toISOString(),
						version: "SEBI-COMPLIANCE-v1.0",
					},
				});
			} catch (err: any) {
				logger.error("[ComplianceGate] Enforce all portfolios compliance error", {
					error: err?.message,
				});
				return res.status(500).json({
					success: false,
					error: "COMPLIANCE_ENFORCE_FAILED",
					message: err?.message || "Failed to enforce compliance on all portfolios",
					meta: { timestamp: new Date().toISOString(), version: "1.0" },
				});
			}
		},
	);

	/**
	 * GET /api/compliance/model-portfolios
	 *
	 * Retrieves SEBI compliance implementation status for all model portfolios.
	 */
	app.get("/api/compliance/model-portfolios", async (_req: Request, res: Response) => {
		try {
			const { db } = await import("../db");
			const { modelPortfolios } = await import("@shared/schema");
			const portfolios = await db
				.select({
					id: modelPortfolios.id,
					name: modelPortfolios.name,
					portfolioTier: modelPortfolios.portfolioTier,
					vehicleType: modelPortfolios.vehicleType,
					statutoryMinInvestment: modelPortfolios.statutoryMinInvestment,
					sebiRegulatoryRegime: modelPortfolios.sebiRegulatoryRegime,
					sebiRegulationRef: modelPortfolios.sebiRegulationRef,
					custodyStructure: modelPortfolios.custodyStructure,
					sebiComplianceRules: modelPortfolios.sebiComplianceRules,
					updatedAt: modelPortfolios.updatedAt,
				})
				.from(modelPortfolios);

			return res.status(200).json({
				success: true,
				data: portfolios,
				total: portfolios.length,
				meta: {
					timestamp: new Date().toISOString(),
					version: "1.0",
				},
			});
		} catch (err: any) {
			logger.error("[ComplianceGate] Get model portfolios compliance error", {
				error: err?.message,
			});
			return res.status(500).json({
				success: false,
				error: "COMPLIANCE_PORTFOLIOS_FETCH_FAILED",
				message: err?.message || "Failed to fetch model portfolios compliance",
				meta: { timestamp: new Date().toISOString(), version: "1.0" },
			});
		}
	});

	/**
	 * POST /api/compliance/mf/audit
	 *
	 * Audits a proposed Mutual Fund transaction against SEBI (Mutual Funds) Regulations, 1996 and AMFI norms.
	 */
	app.post("/api/compliance/mf/audit", requireAuth, async (req: Request, res: Response) => {
		try {
			const userId = (req as any).user?.id as string;
			const { mfComplianceService } = await import(
				"../services/mf-compliance-service"
			);
			const report = await mfComplianceService.auditMfCompliance({
				userId,
				investmentAmount: Number(req.body.investmentAmount || 0),
				actionType: req.body.actionType || "lumpsum",
				schemeCode: req.body.schemeCode || "GENERIC_MF",
				schemeName: req.body.schemeName || "Mutual Fund Scheme",
				category: req.body.category,
				schemeRiskLevel: req.body.schemeRiskLevel,
				euin: req.body.euin,
				isExecutionOnly: req.body.isExecutionOnly,
				hasNominee: req.body.hasNominee,
				nomineeOptOut: req.body.nomineeOptOut,
				suitabilityWarningAcknowledged: req.body.suitabilityWarningAcknowledged,
				orderPlacementTime: req.body.orderPlacementTime,
			});
			return res.status(200).json({
				success: true,
				data: report,
				meta: {
					timestamp: new Date().toISOString(),
					version: report.meta.engineVersion,
				},
			});
		} catch (err: any) {
			logger.error("[ComplianceGate] MF audit error", { error: err?.message });
			return res.status(500).json({
				success: false,
				error: "MF_AUDIT_FAILED",
				message: err?.message || "Failed to audit MF compliance",
				meta: { timestamp: new Date().toISOString(), version: "1.0" },
			});
		}
	});

	/**
	 * POST /api/compliance/pms/audit
	 *
	 * Audits a proposed PMS transaction against SEBI (Portfolio Managers) Regulations, 2020.
	 */
	app.post("/api/compliance/pms/audit", requireAuth, async (req: Request, res: Response) => {
		try {
			const userId = (req as any).user?.id as string;
			const { pmsComplianceService } = await import(
				"../services/pms-compliance-service"
			);
			const report = await pmsComplianceService.auditPmsCompliance({
				userId,
				investmentAmount: Number(req.body.investmentAmount || 0),
				pmsName: req.body.pmsName || "PMS Multi-Asset Portfolio",
				sebiRegistrationNo: req.body.sebiRegistrationNo,
				executionType: req.body.executionType || "discretionary",
				clientDematAccount: req.body.clientDematAccount,
				custodianName: req.body.custodianName,
				riskProfileScore: req.body.riskProfileScore ? Number(req.body.riskProfileScore) : undefined,
				pmsRiskCategory: req.body.pmsRiskCategory,
				formCAcknowledged: req.body.formCAcknowledged,
				imaSigned: req.body.imaSigned,
			});
			return res.status(200).json({
				success: true,
				data: report,
				meta: {
					timestamp: new Date().toISOString(),
					version: report.meta.engineVersion,
				},
			});
		} catch (err: any) {
			logger.error("[ComplianceGate] PMS audit error", { error: err?.message });
			return res.status(500).json({
				success: false,
				error: "PMS_AUDIT_FAILED",
				message: err?.message || "Failed to audit PMS compliance",
				meta: { timestamp: new Date().toISOString(), version: "1.0" },
			});
		}
	});

	/**
	 * POST /api/compliance/aif/audit
	 *
	 * Audits a proposed AIF subscription commitment against SEBI (Alternative Investment Funds) Regulations, 2012.
	 */
	app.post("/api/compliance/aif/audit", requireAuth, async (req: Request, res: Response) => {
		try {
			const userId = (req as any).user?.id as string;
			const { aifComplianceService } = await import(
				"../services/aif-compliance-service"
			);
			const report = await aifComplianceService.auditAifCompliance({
				userId,
				committedAmount: Number(req.body.committedAmount || 0),
				initialPaymentAmount: req.body.initialPaymentAmount ? Number(req.body.initialPaymentAmount) : undefined,
				fundName: req.body.fundName || "Alternative Investment Fund",
				sebiRegistrationNo: req.body.sebiRegistrationNo,
				aifCategory: req.body.aifCategory || "CAT_II",
				isEmployeeOrDirector: req.body.isEmployeeOrDirector,
				ppmAcknowledged: req.body.ppmAcknowledged,
				contributionAgreementSigned: req.body.contributionAgreementSigned,
				plannedLeverageRatio: req.body.plannedLeverageRatio ? Number(req.body.plannedLeverageRatio) : undefined,
			});
			return res.status(200).json({
				success: true,
				data: report,
				meta: {
					timestamp: new Date().toISOString(),
					version: report.meta.engineVersion,
				},
			});
		} catch (err: any) {
			logger.error("[ComplianceGate] AIF audit error", { error: err?.message });
			return res.status(500).json({
				success: false,
				error: "AIF_AUDIT_FAILED",
				message: err?.message || "Failed to audit AIF compliance",
				meta: { timestamp: new Date().toISOString(), version: "1.0" },
			});
		}
	});
}

