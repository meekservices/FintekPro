import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { logger } from "./logger";
import { insertUserSchema, users } from "@shared/schema";
import { eq, or, and, sql, desc, ilike } from "drizzle-orm";
import { db } from "./db";
import { emailService } from "./email-service";
import { whatsappService } from "./whatsapp";
import { smsService } from "./services/sms-service";
import { encryptionService } from "./encryption-service";
import { fileURLToPath } from "url";
import path from "path";
import multer from "multer";
import fs from "fs";
import { apiResponse } from "./utils/responses";
import { auditLog } from "./middleware/audit-trail";
import { creditRatingsService } from "./services/credit-ratings-service";
import { symbolMappingService } from "./services/symbol-mapping-service";
import { registerAuditExportRoutes } from "./routes/admin/audit-export-routes";
import { maskEmail, maskMobile } from "./utils/pii-utils";
import usTradingRoutes from "./routes/us-trading";
import agentRoutes from "./agent-routes";
import agentTrackerRoutes from "./routes/agent-tracker";
import { registerAgentCapitalGainPart1Part1Routes } from "./routes/agent-capital-gains-1-1";
import agentRevenueRoutes from "./routes/agent-revenue-routes";
import agentBasketsRoutes from "./routes/agent-baskets";
import agentSipHealthRoutes from "./routes/agent-sip-health";
import agentPortfolioDriftRoutes from "./routes/agent-portfolio-drift";
import agentClientOrdersRoutes from "./routes/agent-client-orders";
import agentMarketAlertsRoutes from "./routes/agent-market-alerts";
import meetingRoutes from "./routes/meeting-bookings-1";
import meetingRoutes2 from "./routes/meeting-bookings-2";
import unifiedCartRouter from "./routes/unified-cart";
import { registerKYCWizardRoutes } from "./routes/kyc/index";
import { registerKycV2ExtensionRoutes } from "./routes/kyc/v2-extensions";
import { registerOrderRoutes } from "./order-routes";
import { taxRoutes } from "./tax-routes";
import { registerKYCVaultRoutes } from "./kyc-vault-routes";
import { orchestratorRouter } from "./routes/orchestrator-routes";
import { registerAppointmentManagementRoutes } from "./routes/appointment-management-routes";
import { setupChatRoutes } from "./routes/chat-routes";
import complianceRoutes from "./compliance-routes";
import amlRoutes from "./aml-routes";
import orderStatusRoutes from "./routes/fixed-income-status-routes";
import aiInvestmentRoutes from "./routes/ai-investment-routes";
import { registerAIStockRecommendationRoutes } from "./routes/ai-stock-recommendation-routes";
import engineHealthRoutes from "./routes/engine-health-check";
import { registerMarketDataRoutes } from "./routes/market-data";
import { registerMarketNewsRoutes } from "./routes/market-news-routes";
import { registerPlatformStatsRoutes } from "./routes/platform-stats-routes";
import { registerPortalSystemRoutes } from "./routes/portal-system";
import { registerBondsMarketRoutes } from "./routes/bonds-market";
import { registerUserProfileKYCRoutes } from "./routes/user-profile-kyc";
import yieldCurveRoutes from "./routes/yield-curve";
import { registerReportsInlineRoutes } from "./routes/reports-inline";
import adminMutualFundsRouter from "./routes/admin-mutual-funds-routes";
import adminESignRouter from "./routes/admin-esign-routes";
import adminAadhaarRouter from "./routes/admin-aadhaar-routes";
import adminDsaLoanRouter from "./routes/admin-dsa-loan-routes";
import agentLoanRouter from "./routes/agent-loan-routes";
import adminApiUsageRouter from "./routes/admin-api-usage-routes";
import { registerAdminComplianceTestRoutes } from "./routes/admin-compliance-test-routes";
import adminAgentPayoutRouter from "./routes/admin-agent-payout-routes";
import adminDatabaseRouter from "./routes/admin-database";
import adminGlobalInstrumentsRouter from "./routes/admin-global-instruments";
import instrumentsRouter from "./routes/instruments-1"; // /api/instruments/search, /price/:isin
import schemeGovernanceRouter from "./routes/scheme-governance-routes"; // /api/scheme-governance/*
import reitInvitRouter from "./routes/reit-invit-routes"; // /api/reit-invit/reits, /invits, /market-overview

import policyStatusRouter from "./routes/admin/policy-status-routes";
import aiGovernanceRouter from "./routes/admin/ai-governance";
import { registerAdminPanelRoutes } from "./routes/admin/index";

import liveMFDataRouter from "./routes/live-mf-data-routes";
import marketIntelligenceRouter from "./routes/market-intelligence-routes";
import treasuryCopilotRoutes from "./routes/treasury-copilot-routes";
import treasuryRoutes from "./routes/treasury-routes";
import versionRouter from "./routes/version";
import { registerBankingRoutes } from "./routes/banking";
import prospectWizardRoutes1 from "./routes/agent-prospect-wizard-1";
import prospectWizardRoutes2 from "./routes/agent-prospect-wizard-5-2";
import prospectWizardRoutes_w2 from "./routes/agent-prospect-wizard-2";
import prospectWizardRoutes_w3_1_2 from "./routes/agent-prospect-wizard-3-1-2";
import prospectWizardRoutes_w3_2 from "./routes/agent-prospect-wizard-3-2";
import prospectWizardRoutes_w4_1 from "./routes/agent-prospect-wizard-4-1";
import prospectWizardRoutes_w4_2 from "./routes/agent-prospect-wizard-4-2";
import prospectWizardRoutes_w5_1 from "./routes/agent-prospect-wizard-5-1";
import prospectWizardRoutes_w3_1_1_2 from "./routes/agent-prospect-wizard-3-1-1-2";
import { registerAgentCapitalGainPart1Part2Routes } from "./routes/agent-capital-gains-1-2";
import { registerAgentCapitalGainPart1Routes } from "./routes/agent-capital-gains-1";
import { registerAgentCapitalGainPart2Part2Routes } from "./routes/agent-capital-gains-2-2";
import { registerAgentAdvisoryPart1Routes } from "./routes/agent-advisory-1";
import { registerAgentAdvisoryPart2Routes } from "./routes/agent-advisory-2";
import { registerAgentAdvisoryPart3Routes } from "./routes/agent-advisory-3";
import { registerAgentProspectAcquisitionPart1Routes } from "./routes/agent-prospect-acquisition-1";
import testerDiagnosticsRoutes from "./routes/tester-diagnostics-routes";
import researchNoteRouter from "./routes/research-note-routes";
import researchWorkspaceRouter from "./routes/research-workspace";
import smallcaseRouter from "./routes/smallcase-routes";
import screenerRouter from "./routes/screener-routes";
import { instrumentScreenerRouter } from "./routes/instrument-screener-routes";
import errorTrackingRouter from "./routes/error-tracking-routes";
import { Router } from "express";

// ── Previously-missing route modules (fix: all portals returning 404) ─────────
import { registerRoleRoutes } from "./role-routes";
import { registerAlertSystemRoutes } from "./routes/alert-system";
import { registerKYCAdminSupportRoutes } from "./routes/kyc-admin-support";
import { registerPartnerPortalRoutes } from "./routes/partner/index";
import { registerUserManagementRoutes } from "./user-management-routes";
import { registerStakeholderRoutes } from "./stakeholder-routes";
import { registerSystemAdminRoutes } from "./routes/system-admin";
import { registerUpstoxTokenRoutes } from "./routes/upstox-token-routes";
import { registerIrisKfintechRoutes } from "./routes/iris-kfintech-routes";
import { registerIrisLasRoutes } from "./routes/iris-las-routes";
import { registerIrisKycRoutes } from "./routes/iris-kyc-routes";
import { registerIrisStaffRoutes } from "./routes/iris-staff-routes";
import { registerIrisInvestorProfileRoutes } from "./routes/iris-investor-profile-routes";
import zohoRouter from "./zoho/routes";

import zohoHealthRouter from "./zoho/health-check";
import { registerZohoBooksRoutes } from "./routes/zoho-books";
import { registerClientPortalRoutes } from "./routes/client-portal-routes";
import { registerAgentPortalEnhancementRoutes } from "./routes/agent-portal-routes";
import { registerPartnerPortalEnhancementRoutes } from "./routes/partner-portal-routes";

import { registerCasPortfolioUploadRoutes } from "./routes/cas-portfolio-upload-routes";
import { registerComplianceGateRoutes } from "./routes/compliance-gate-routes";
import { registerCrmRoutes } from "./routes/crm";
import { registerLoanRoutes } from "./routes/loans/index";
import { registerPaymentRoutes } from "./routes/payments/index";
import { registerCapitalGainsRoutes } from "./routes/capital-gains";
import { registerPortfolioCoreRoutes } from "./routes/portfolio-core";
import { registerFinancialGoalsRoutes } from "./routes/financial-goals";
import { registerFamilyCollaborationRoutes } from "./routes/family-collaboration";
import { registerTaxFilingRoutes } from "./routes/tax-filing";
import { registerDLMRoutes } from "./routes/dlm-routes";
import { registerRevenueSheetRoutes } from "./routes/revenue-sheet-routes";
import { registerLoanCommissionRoutes } from "./routes/loan-commission-routes";
import { registerPartnerHierarchyRoutes } from "./routes/partner/hierarchy-routes";
import { registerPartnerAgentManagementRoutes } from "./routes/partner/agent-management-routes";
import { registerMasterAgentApprovalRoutes } from "./routes/master-agent-approval-routes";
import { registerEligibilityMatrixRoutes } from "./routes/eligibility-matrix-routes";
import { registerInvestmentIdeasRoutes } from "./routes/investment-ideas";
import { registerPreIPORoutes } from "./routes/pre-ipo";
import { registerFinancialDataRoutes } from "./routes/financial-data-routes";
import { registerFemaComplianceRoutes } from "./routes/fema-compliance";
import { registerLeadLeakageRoutes } from "./routes/lead-leakage-routes";
import signatureRouter from "./routes/signature-routes";
import userSignatureESignRouter from "./routes/user-signature-esign-routes";
import esignRouter from "./routes/esign-routes"; // /api/esign/*, /api/agent/esign/requests
import esignAiRouter from "./routes/esign-ai-routes"; // /api/esign/ai/*
import documentUploadRouter from "./routes/document-upload-routes"; // /api/documents/upload/for-signing
import unifiedProposalsRouter from "./routes/unified-proposals-routes";
import improvementFeaturesRouter from "./routes/improvement-features";

// ── Proposal Builder + Agent Portal Engines (previously orphaned) ─────────────
import prospectProposalsRouter from "./routes/prospect-proposals";
import proposalBuilderRouter from "./routes/proposal-builder-routes";
import sipSimulatorRouter from "./routes/sip-simulator";
import sebiAuditRouter from "./routes/sebi-audit";
import faspAIv2Router from "./routes/fasp-ai-v2-routes";
import { agentDemoRouter } from "./routes/demo-proposals";
import { registerPortfolioCompareAISIPRoutes } from "./routes/portfolio-compare-ai-sip";
import stockIntersectionRouter from "./routes/stock-intersection";
import { registerAgentAdvisoryPart4Routes } from "./routes/agent-advisory-4";
import overlapIntelligenceRouter from "./routes/overlap-intelligence"; // /api/portfolio/intelligence, /simulate-impact, /optimize-sip, /goal-based-score
import { modelPortfoliosRouter } from "./routes/model-portfolios-route"; // /api/model-portfolios — engine audit Fix #6
import { agentLeadInboxRouter } from "./routes/agent-lead-inbox"; // /api/agent/leads
import { exploriumWebhookRouter } from "./routes/explorium-webhook-routes"; // /api/webhooks/explorium
import { agentGeoCoverageRouter } from "./routes/agent-geo-coverage-routes"; // /api/agent/geo-coverage
// Director phone enrichment is CredHive-only — no external phone provider needed.
// EasyLeadz webhook route is deprecated (kept as dead file for historical reference).
// import { registerEasyLeadzWebhookRoutes } from "./routes/easyleadz-callback-routes";
import { registerTruecallerBusinessRoutes } from "./routes/truecaller-business-routes"; // /api/calling/*

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for file uploads
const storage_config = multer.diskStorage({
	destination: (req, file, cb) => {
		const uploadDir = "uploads";
		if (!fs.existsSync(uploadDir)) {
			fs.mkdirSync(uploadDir, { recursive: true });
		}
		cb(null, uploadDir);
	},
	filename: (req, file, cb) => {
		const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
		cb(
			null,
			file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
		);
	},
});

const upload = multer({
	storage: storage_config,
	limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
	fileFilter: (req, file, cb) => {
		const allowedTypes = [".jpg", ".jpeg", ".png", ".pdf", ".doc", ".docx"];
		const ext = path.extname(file.originalname).toLowerCase();
		if (allowedTypes.includes(ext)) {
			cb(null, true);
		} else {
			cb(
				new Error(
					"Invalid file type. Only JPG, PNG, PDF, and Word documents are allowed.",
				),
			);
		}
	},
});

export async function registerRoutes(app: Express): Promise<Server> {
	// setupAuth is now handled in the main index.ts boot sequence Phase 3
	// setupAuth(app);

	// Note: Health check is now handled in Phase 1 of index.ts for immediate availability
	/*
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });
  */

	// Search users API (Admin & Agent)
	app.get("/api/users/search", async (req, res) => {
		if (!req.isAuthenticated()) return apiResponse.unauthorized(res);

		try {
			const query = ((req.query.q as string) || "").trim();
			const roles = ((req.query.roles as string) || "")
				.split(",")
				.filter(Boolean);

			if (!query && roles.length === 0) {
				return apiResponse.badRequest(
					res,
					"Search query or role filter is required",
				);
			}

			let whereClause: any;

			if (query) {
				whereClause = or(
					ilike(users.userId, `%${query}%`),
					ilike(users.email, `%${query}%`),
					ilike(users.mobile, `%${query}%`),
					ilike(users.firstName, `%${query}%`),
					ilike(users.lastName, `%${query}%`),
					ilike(users.userId, `%${query}%`),
				);
			}

			if (roles.length > 0) {
				const roleClause = sql`${users.roles} ?| array[${sql.raw(roles.map((r) => `'${r}'`).join(","))}]`;
				whereClause = whereClause ? and(whereClause, roleClause) : roleClause;
			}

			const results = await db
				.select({
					id: users.id,
					userId: users.userId,
					email: users.email,
					mobile: users.mobile,
					firstName: users.firstName,
					lastName: users.lastName,
					roles: users.roles,
					isActive: users.isActive,
				})
				.from(users)
				.where(whereClause)
				.limit(20);

			const maskedResults = results.map((u) => ({
				...u,
				email: maskEmail(u.email),
				mobile: maskMobile(u.mobile),
			}));

			return apiResponse.success(res, maskedResults);
		} catch (error) {
			logger.error("User search error:", error as Error);
			return apiResponse.serverError(res);
		}
	});

	// Basic admin stats
	app.get("/api/admin/stats", async (req, res) => {
		if (!req.isAuthenticated() || !req.user?.roles?.includes("admin")) {
			return apiResponse.unauthorized(res);
		}

		try {
			const [userCount] = await db
				.select({ count: sql<number>`count(*)` })
				.from(users);
			const [activeUsers] = await db
				.select({ count: sql<number>`count(*)` })
				.from(users)
				.where(eq(users.isActive, true));

			return apiResponse.success(res, {
				totalUsers: Number(userCount.count),
				activeUsers: Number(activeUsers.count),
				systemStatus: "Healthy",
				uptime: process.uptime(),
			});
		} catch (error) {
			logger.error("Admin stats error:", error as Error);
			return apiResponse.serverError(res);
		}
	});

	// Compliance Audit Export Routes
	registerAuditExportRoutes(app);

	// US Trading & Alpaca Broker Routes
	app.use("/api/us-trading", usTradingRoutes);

	// REIT & InvIT investment product routes
	app.use("/api/reit-invit", reitInvitRouter);

	// Business Logic Routes
	app.use("/api/agent", agentRoutes);
	app.use("/api/agent", agentTrackerRoutes);
	registerAgentCapitalGainPart1Part1Routes(app); // Registered to fix /api/agent/activity 404
	app.use("/api/agent", agentRevenueRoutes);
	app.use("/api/agent", agentBasketsRoutes);
	app.use("/api/agent", agentSipHealthRoutes);
	app.use("/api/agent", agentPortfolioDriftRoutes);
	app.use("/api/agent", agentClientOrdersRoutes);
	app.use("/api/agent", agentMarketAlertsRoutes);

	// Agent Wizard & Prospect Management Routes
	// NOTE: static routes (no path params) must come before parametric ones.
	// wizard-3-1-2 (GET /prospects/:id/holdings) and wizard-3-2 (POST /prospects/:id/holdings)
	// are mounted AFTER wizard-2 (analyze-portfolio) which has only static paths — safe ordering.
	app.use("/api/agent-wizard", prospectWizardRoutes1);
	app.use("/api/agent-wizard", prospectWizardRoutes2);
	app.use("/api/agent-wizard", prospectWizardRoutes_w2);        // analyze-portfolio, rebalancing-suggestions, generate-proposal
	app.use("/api/agent-wizard", prospectWizardRoutes_w3_1_2);   // GET prospects/:id/holdings, GET prospects/:id/portfolio
	app.use("/api/agent-wizard", prospectWizardRoutes_w3_2);     // POST/PUT/DELETE prospects/:id/holdings, GET zoho/status
	app.use("/api/agent-wizard", prospectWizardRoutes_w4_1);     // zoho/team-agents, zoho/import/leads, zoho/import/contacts
	app.use("/api/agent-wizard", prospectWizardRoutes_w4_2);     // zoho/webhook, listed/unlisted stock data
	app.use("/api/agent-wizard", prospectWizardRoutes_w5_1);     // scoring sub-routes
	app.use("/api/agent-wizard", prospectWizardRoutes_w3_1_1_2); // proposal-analytics
	registerAgentCapitalGainPart1Part2Routes(app);
	registerAgentCapitalGainPart1Routes(app);
	registerAgentCapitalGainPart2Part2Routes(app);
	registerAgentAdvisoryPart1Routes(app);
	registerAgentAdvisoryPart2Routes(app);
	registerAgentAdvisoryPart3Routes(app);
	registerAgentProspectAcquisitionPart1Routes(app);

	app.use("/api/meetings", meetingRoutes);
	app.use("/api/meetings", meetingRoutes2);
	app.use("/api/unified-cart", unifiedCartRouter);

	// Named export registrations
	registerOrderRoutes(app);
	app.use("/api/tax", taxRoutes);
	registerKYCVaultRoutes(app);
	// KYC Broker Orchestrator — diff, submit, status
	app.use("/api/orchestrator", orchestratorRouter);

	// Chat routes setup
	const chatRouter = Router();
	setupChatRoutes(chatRouter, storage, (req, res, next) => {
		if (!req.isAuthenticated())
			return res.status(401).json({ error: "Unauthorized" });
		next();
	});
	app.use(chatRouter);

	app.use("/api/compliance", complianceRoutes);
	app.use("/api/aml", amlRoutes);
	app.use("/api/fixed-income", orderStatusRoutes);
	app.use("/api/ai-investment", aiInvestmentRoutes);
	app.use("/api/ai/copilot", treasuryCopilotRoutes);
	app.use("/api/treasury", treasuryRoutes);
	app.use("/api/engine-health", engineHealthRoutes); // matches UI calls: /api/engine-health/run, /registry, /gemini-deep-audit
	app.use("/api/engine", engineHealthRoutes); // backward-compat alias

	// Missing Production Routes
	registerMarketDataRoutes(app);
	registerMarketNewsRoutes(app);   // ET Markets news aggregator
	registerPlatformStatsRoutes(app);
	registerPortalSystemRoutes(app);
	registerBondsMarketRoutes(app);
	registerUserProfileKYCRoutes(app);
	registerBankingRoutes(app);
	registerKYCWizardRoutes(app);
	registerKycV2ExtensionRoutes(app);
	app.use(versionRouter);
	app.use("/api/bonds/yield-curve", yieldCurveRoutes);

	// Specialized registrations
	registerAppointmentManagementRoutes(app);
	registerReportsInlineRoutes(app);
	app.use("/api/admin/mutual-funds", adminMutualFundsRouter);
	app.use(adminESignRouter);
	app.use(adminAadhaarRouter);
	app.use("/api/admin/dsa-loans", adminDsaLoanRouter);
	app.use("/api/agent/loans", agentLoanRouter); // Agent DSA loan referral + IRIS LAS intercept
	app.use(adminApiUsageRouter);
	registerAdminComplianceTestRoutes(app);

	// Mounted missing admin/governance/database routes
	app.use("/api/admin/agent-payouts", adminAgentPayoutRouter);
	app.use("/api/admin/database", adminDatabaseRouter);
	app.use("/api/admin/global-instruments", adminGlobalInstrumentsRouter);
	app.use(instrumentsRouter); // /api/instruments/search + /api/instruments/price/:isin (proposal builder ISIN lookup)

	// Scheme governance: MF rename log, transaction rules, stock rename management
	app.use("/api/scheme-governance", schemeGovernanceRouter);

	app.use("/api/admin", policyStatusRouter); // /status is router path, so prefix is /api/admin
	app.use(aiGovernanceRouter); // router already has full /api/admin/ai/... paths
	registerAdminPanelRoutes(app);
	registerAIStockRecommendationRoutes(app);

	// Research Note routes (/api/research-note/search, /preview, etc.)
	app.use("/api/research-note", researchNoteRouter);

	// Research Lists / Saved Screeners (/api/research-lists/screeners, etc.)
	app.use("/api/research-lists", researchWorkspaceRouter);

	// Smallcase Gateway routes (/api/smallcase/auth/token, /transaction/create, etc.)
	// Gracefully inactive when SMALLCASE_GATEWAY_NAME / SMALLCASE_SECRET not set.
	app.use("/api/smallcase", smallcaseRouter);

	// Stock Screener routes (/api/screener/stocks, /stats, /distribution, etc.)
	app.use("/", screenerRouter);
	// ── Universal instrument screener: MF, Bonds, ETFs ──────────────────────
	app.use("/api/screener", instrumentScreenerRouter);

	app.use("/api/live-mf", liveMFDataRouter);
	app.use("/api/tester/diagnostics", testerDiagnosticsRoutes);

	// ── Market Intelligence (IndianAPI.in Growth Plan — 31 endpoints) ──────────
	// Routes: /api/market/*, /api/stocks/:symbol/*, /api/mutual-funds/*, /api/ipo/*
	app.use(marketIntelligenceRouter);

	// Error tracking routes — must be mounted WITHOUT CSRF for /ingest
	// (called from ErrorBoundary/componentDidCatch where no CSRF token is available)
	app.use("/api/errors", errorTrackingRouter);

	// ── FIX: Register previously-missing route modules ────────────────────────
	// These routes were defined in server route files but never wired to Express,
	// causing 404s on admin, partner, and main portals.
	registerRoleRoutes(app); // /api/agent/dashboard/overview, recent-activity
	registerAlertSystemRoutes(app); // /api/alerts
	registerKYCAdminSupportRoutes(app); // /api/admin/kyc/dashboard and KYC support APIs
	registerPartnerPortalRoutes(app); // /api/partner/ca-status and all partner APIs
	registerUserManagementRoutes(app); // /api/admin/users and user management
	registerStakeholderRoutes(app); // /api/admin/stakeholders
	registerSystemAdminRoutes(app); // /api/admin/system/* routes
	registerUpstoxTokenRoutes(app); // /api/admin/upstox/* — token rotation & health
	registerIrisKfintechRoutes(app); // /api/iris/* KFintech integration
	registerIrisLasRoutes(app);       // /api/iris/las/* LAS/LAMF pledge-and-lend lifecycle
	registerIrisKycRoutes(app);       // /api/iris/kyc/* — unified KYC + multi-broker vault write-back
	registerIrisStaffRoutes(app);     // /api/iris/staff/* — employees, RMs, branches, sub-brokers, EUINs, partner
	registerIrisInvestorProfileRoutes(app); // /api/iris/investors/:pan/* — profile updates, goals, demat, portal

	// ── Zoho API (CRM, Campaigns, Sign, Meeting, Webhook, Books) ──────────────
	app.use("/api/zoho", zohoRouter);         // /api/zoho/* — CRM, Campaigns, Webhooks, Sign
	app.use("/api/zoho", zohoHealthRouter);   // /api/zoho/health — connection health
	registerZohoBooksRoutes(app);             // /api/admin/zoho-books/* — accounting

	// ── Portal feature routes ────────────────────────────────────────────────
	registerClientPortalRoutes(app);              // /api/client/* — instrument catalog, KYC, portfolio
	registerAgentPortalEnhancementRoutes(app);    // /api/agent/portal/* — KYC initiation, instruments by KYC level, Zoho sync
	registerPartnerPortalEnhancementRoutes(app);  // /api/partner/portal/* — dashboard, referrals, catalog, Zoho deal sync
	registerCasPortfolioUploadRoutes(app); // /api/portfolio/upload-cas-pdf + /api/portfolio/sync-status
	registerComplianceGateRoutes(app); // GET /api/compliance/transaction-readiness
	registerCrmRoutes(app); // /api/crm/* client relationship management
	registerLoanRoutes(app); // /api/loans/* loan marketplace
	registerPaymentRoutes(app); // /api/payments/*
	registerCapitalGainsRoutes(app); // /api/capital-gains/*
	registerPortfolioCoreRoutes(app); // /api/portfolio/* core endpoints
	registerFinancialGoalsRoutes(app); // /api/goals/*
	registerFamilyCollaborationRoutes(app); // /api/family/*
	registerTaxFilingRoutes(app); // /api/tax-filing/*
	registerDLMRoutes(app); // /api/dlm/* deal lifecycle
	registerRevenueSheetRoutes(app); // /api/revenue-sheet/*
	registerLoanCommissionRoutes(app); // /api/loan-commission/*
	registerPartnerHierarchyRoutes(app); // /api/partner/hierarchy/*
	registerPartnerAgentManagementRoutes(app); // /api/partner/agents/* — partner manages agents (with/without EUIN)
	registerMasterAgentApprovalRoutes(app);     // /api/master-agent/pending-transactions/* — master agent approval queue
	registerEligibilityMatrixRoutes(app); // /api/eligibility-matrix/*
	registerInvestmentIdeasRoutes(app); // /api/investment-alerts/*
	registerPreIPORoutes(app); // /api/pre-ipo/*
	registerFinancialDataRoutes(app); // /api/financial-data/*
	registerFemaComplianceRoutes(app); // /api/fema/*
	registerLeadLeakageRoutes(app); // /api/lead-leakage/*
	app.use(signatureRouter);
	app.use(userSignatureESignRouter);
	app.use(esignRouter); // /api/esign/*, /api/agent/esign/requests
	app.use("/api/esign/ai", esignAiRouter); // /api/esign/ai/analyze, /api/esign/ai/annotations/*
	app.use("/api/documents", documentUploadRouter); // /api/documents/upload/for-signing, /preview, /download
	app.use("/api/unified-proposals", unifiedProposalsRouter);
	app.use("/api/features", improvementFeaturesRouter);

	// ── Proposal Builder Engine Routes (fix: all proposal builder engines returning 404) ──
	// Prospect Proposals: GET/POST /api/agent/prospect-proposals and sub-routes
	app.use("/", prospectProposalsRouter);

	// Proposal Builder phase-lock, verdicts, SIPs, benchmarks, what-if, PDF, audit
	app.use("/api/proposal-builder", proposalBuilderRouter);

	// SIP Simulator: POST /api/sip/simulate, POST /api/sip/training-prompts
	app.use("/api/sip", sipSimulatorRouter);

	// SEBI Audit: GET /api/sebi-audit/summary/:proposalId, /api/sebi-audit/log
	app.use("/api/sebi-audit", sebiAuditRouter);

	// FASP-AI v2.0: advisory feedback, drift alerts, audit trail, confidence breakdown
	app.use("/api/fasp", faspAIv2Router);

	// Agent Demo Proposals: GET/POST /api/agent/demo-proposals, POST .../generate-pdf
	app.use("/api/agent/demo-proposals", agentDemoRouter);

	// Portfolio Compare + AI SIP routes (uses app directly with full /api/* paths)
	registerPortfolioCompareAISIPRoutes(app);

	// Stock Intersection / Overlap Analysis: POST /api/stock-intersection/analyze
	app.use("/api/stock-intersection", stockIntersectionRouter);

	// Agent Advisory Part 4: fair-backtest, portfolio-difference, validate-override, etc.
	registerAgentAdvisoryPart4Routes(app);

	// Portfolio Intelligence: /api/portfolio/intelligence, /simulate-impact, /optimize-sip, /goal-based-score
	app.use("/api/portfolio", overlapIntelligenceRouter);

	// Model Portfolios: /api/model-portfolios, /api/model-portfolios/:id (engine audit Fix #6)
	app.use("/api/model-portfolios", modelPortfoliosRouter);

	// Profile Sharing Toggle
	app.patch("/api/user/profile/sharing", async (req, res) => {
		if (!req.isAuthenticated()) return apiResponse.unauthorized(res);
		try {
			const { enabled } = req.body;
			await db
				.update(users)
				.set({ shareableProfileEnabled: enabled })
				.where(eq(users.id, req.user!.id));

			return apiResponse.success(res, { success: true });
		} catch (error) {
			logger.error("Profile sharing toggle error:", error as Error);
			return apiResponse.serverError(res);
		}
	});

	// ── Lead Pipeline & Geo Routes ─────────────────────────────────────────────
	app.use("/api/agent/leads", agentLeadInboxRouter);
	app.use("/api/webhooks", exploriumWebhookRouter);
	app.use("/api/agent/geo-coverage", agentGeoCoverageRouter);

	// ── Phone Enrichment & Calling ─────────────────────────────────────────────
	// Director contact enrichment is handled in-process by DirectorContactService
	// (CredHive-only). No external phone-provider webhook endpoint needed.
	// Truecaller Business: verified caller ID for outbound agent calls
	registerTruecallerBusinessRoutes(app);  // POST /api/calling/pre-call-setup
	                                        // POST /api/calling/register-agent-number
	                                        // GET  /api/calling/truecaller-status

	const httpServer = createServer(app);
	return httpServer;
}
