import type { Express, Request } from "express";
import { alpacaSseService } from './services/alpaca-sse-service';
import { registerSecurityMasterCreditRatingRoutes } from './routes/security-master-credit-ratings';
import { registerBondsMarketRoutes } from './routes/bonds-market';
import { registerCommoditiesMarketRoutes } from './routes/commodities-market';
import { registerMarketDataRoutes } from './routes/market-data';
import { registerPortfolioCoreRoutes } from './routes/portfolio-core';
import { registerRiskProfilesPartnerAppsRoutes } from './routes/risk-profiles-partner-apps';
import { registerAIFPMSSystemRoutes } from './routes/aif-pms-system-proposals';
import { registerLoanProvidersRoutes } from './routes/loan-providers';
import { registerBankAccountsDematRoutes } from './routes/bank-accounts-demat';
import { registerTaxFilingRoutes } from './routes/tax-filing';
import { registerBBPSPanConsentRoutes } from './routes/bbps-pan-consent';
import { registerInvestmentIdeasRoutes } from './routes/investment-ideas';
import { registerKYCAdminSupportRoutes } from './routes/kyc-admin-support';
import { registerAgentProspectAcquisitionRoutes } from './routes/agent-prospect-acquisition';
import { registerUserProfileKYCRoutes } from './routes/user-profile-kyc';
import { registerFinancialGoalsRoutes } from './routes/financial-goals';
import { registerAdminMiscRoutes } from './routes/admin-misc-routes';
import { registerPlatformStatsRoutes } from './routes/platform-stats-routes';
import { registerAdminComplianceTestRoutes } from './routes/admin-compliance-test-routes';
import { registerPortfolioCompareAISIPRoutes } from './routes/portfolio-compare-ai-sip';
import { registerFamilyCollaborationRoutes } from './routes/family-collaboration';
import { registerAlertSystemRoutes } from './routes/alert-system';
import { registerSystemAdminRoutes } from './routes/system-admin';
import { registerIrisKfintechRoutes } from './routes/iris-kfintech-routes';
import { executionGuard } from "./middleware/execution-guard";
import { proxyToInsurance } from './clients/insurance-client';
import { registerCrmRoutes } from './routes/crm';
import { registerZohoBooksRoutes } from './routes/zoho-books';
import { registerTaxRoutes } from './routes/tax';
import { registerPaymentRoutes } from './routes/payments';
import { registerBBPSRoutes } from './routes/bbps';
import { registerCapitalGainsRoutes } from './routes/capital-gains';
import { registerAdminPanelRoutes } from './routes/admin';
import aiGovernanceRouter from './routes/admin/ai-governance';
import { registerPartnerPortalRoutes } from './routes/partner';
import { registerPortalSystemRoutes } from './routes/portal-system';
import { registerKYCWizardRoutes } from './routes/kyc';
import { registerKycV2ExtensionRoutes } from './routes/kyc/v2-extensions';
import { registerStockExchangeRoutes } from './routes/stock-exchange';
import { registerBankingRoutes } from './routes/banking';
import { registerLoanRoutes, registerLoanProcessingRoutes, registerLoanComparisonRoutes } from './routes/loans';
import { registerLoanCommissionRoutes } from './routes/loan-commission-routes';
import { registerEligibilityMatrixRoutes } from './routes/eligibility-matrix-routes';
import { registerRevenueSheetRoutes } from './routes/revenue-sheet-routes';
import { registerPreIPORoutes } from './routes/pre-ipo';
import { registerCartRoutes } from './routes/cart';
import { registerDLMRoutes } from './routes/dlm-routes';
import dsaLoanRoutes from "./routes/dsa-loan-routes";
import adminDsaLoanRoutes from "./routes/admin-dsa-loan-routes";
import agentLoanRoutes from "./routes/agent-loan-routes";
import adminAgentPayoutRoutes from "./routes/admin-agent-payout-routes";
import developerFinanceRoutes from "./routes/developer-finance-routes";
import { registerFinancialDataRoutes } from './routes/financial-data-routes';
import { webauthnRouter } from './routes/webauthn-routes';
import knowledgeHubRoutes from './routes/knowledge-hub-routes';
import mcaIntelligenceRoutes from './routes/mca-intelligence-routes';
import mcaDirectPaymentRoutes from './routes/mca-direct-payment-routes';
import mcaFinancialBackfillRoutes from './routes/mca-financial-backfill-routes';
import researchWorkspaceRoutes from './routes/research-workspace';
import researchNoteRoutes from './routes/research-note-routes';
import goldenPricingRoutes from './routes/golden-pricing-routes';
import screenerRoutes from './routes/screener-routes';
import intrinsicValueRoutes from './routes/intrinsic-value';
import signatureRoutes from './routes/signature-routes';
import userSignatureESignRoutes from './routes/user-signature-esign-routes';
import { mcaFinancialRefreshScheduler } from "./services/mca-financial-refresh-scheduler";
import { registerSandboxWebhookRoutes } from './routes/sandbox-webhooks';
import { createServer, type Server } from "http";
import { storage } from "./storage";

// Extend Express Request to include partner property
declare global {
  namespace Express {
    interface Request {
      partner?: any;
    }
  }
}
import { sql, eq, and, or, like, desc, asc, count, inArray, gte, lte, lt } from "drizzle-orm";
import { db } from "./db";
import { setupAuth as setupReplitAuth, isAuthenticated } from "./replitAuth";
import { setupAuth as setupLocalAuth } from "./auth";
import { insertPortfolioSchema, insertPortfolioHoldingSchema, insertWatchlistSchema, insertMutualFundSchema, insertCapitalGainsReportSchema, insertTransactionReportSchema, insertTransactionRecordSchema, insertCkycRecordSchema, insertCkycDocumentSchema, userCart, userCartItems, storeProducts, storeCategories, storeProductInquiries, storeTransactionLogs, fundComparisons, portfolioComparisons, comparisonHistory, insertFamilyGroupSchema, insertFamilyMemberSchema, insertFamilyGoalSchema, insertFamilyGoalContributionSchema, insertFamilyActivityLogSchema, insertFamilyDiscussionSchema, insertFamilyBudgetSchema, kycFormProgress, insertProductAccountPreferenceSchema, mutualFunds, mutualFundAmcs, agentLeads, prospectClients, proposalInteractions, proposalApprovals, insertProspectClientSchema, insertProposalInteractionSchema, insertProposalApprovalSchema, prospectProposals } from "@shared/schema";
import { marketStoryService, type MarketData as StoryMarketData } from "./market-story-service";
import { generateMarketInsight, analyzePortfolio, generateInvestmentStory, explainFinancialConcept } from "./gemini";
import { whatsappService } from "./whatsapp";
import { marketingService } from "./marketing-automation";
import { portfolioIntelligence } from "./portfolio-intelligence";
import { adminService } from "./admin-service";
import { partnerService } from "./partner-service";
import { z } from "zod";
import { NseIndia } from 'stock-nse-india';
import { comprehensiveAIFPMSAPI } from "./comprehensive-aif-pms-api";
import { camsApi } from './cams-api';
import { kfintechApi } from './kfintech-api';
import { iciciBankAPI } from './icici-bank-api';
import { hdfcBankAPI } from './hdfc-bank-api';
import './notification-service'; // Initialize notification service with auto-processing
import { complianceMonitor } from './compliance-monitor';
import { errorMonitor, errorMonitoringMiddleware, globalErrorHandler } from './error-monitor';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// const API = require('indian-stock-exchange'); // Removed due to security vulnerabilities
import { finnhubService } from './finnhub-service';
import { bajajFinanceAPI } from './bajaj-finance-api';
import { tataCapitalAPI } from './tata-capital-api';
import { InsuranceMarketplaceAPI } from './policybazaar-api';
import { CibilAPI } from './cibil-api';
import { getPersonalizedLoanRecommendations, trackLoanRecommendationAction } from './intelligent-loan-recommendations';
import { clientEnrichmentService } from './client-enrichment-service';
import { aiTransactionTrackerService } from './ai-transaction-tracker';
import { aiInvestSmartMonitorService } from './ai-investsmart-monitor';
import amlRoutes from './aml-routes';
import { ZohoCommerceAPI, type ZohoCommerceConfig } from './zoho-commerce-api';
import { zohoCommerceConfig, zohoProducts, zohoCategories, zohoOrders, zohoCustomers, zohoInventory, zohoWebhooks, zohoSyncLogs, insertZohoCommerceConfigSchema, insertZohoProductSchema, insertZohoCategorySchema, insertZohoOrderSchema, insertCreditProfileSchema, insertLoanRequestSchema, insertLoanApplicationMarketplaceSchema, insertApplicationDocumentSchema, insertPartnerApplicationDocumentSchema } from '@shared/schema';
import BBPSService from './services/bbpsService';
import { BbpsExpenseIntegration } from './bbps-expense-integration';
import { digilockerService } from './services/digilockerService';
import { amfiService } from './amfi-service';
import { bseService } from './bse-service';
import { validateKYC } from './kyc-middleware';
import { requireLevel1, requireLevel2, injectKYCLevel, checkProductAccess, getAccessibleProducts, getUserKYCLevel } from './middleware/kyc-level-gate';
import { MultiSourceMFService } from './services/multisource-mf-service';
import { ObjectStorageService, ObjectNotFoundError } from './objectStorage';
import { randomUUID, randomInt } from 'crypto';
import { ObjectPermission } from './objectAcl';
import AIPortfolioService from './ai-portfolio-service';
import { FundComparisonService } from './services/fund-comparison-service';
import { PortfolioComparisonService } from './services/portfolio-comparison-service';
import { LoanOrchestrator } from './loan-marketplace/loan-orchestrator';
import { taxOrchestrator } from './services/tax-orchestrator';
import { PANConsentService } from './services/pan-consent-service';
import { sandboxKYCService } from './services/sandbox-kyc-service';
import { apiUsageTrackingService } from "./services/api-usage-tracking-service";
import { sandboxITRService } from './sandbox-itr-service';
import { sandboxTDSService } from './sandbox-tds-service';
import { unifiedOCRService, type DocumentMimeType, type DocumentHint } from './services/unified-ocr-service';
import { AadhaarMockService } from './services/aadhaar-mock-service';
import { CashfreeAadhaarService } from './services/cashfree-aadhaar-service';
import { unifiedAadhaarService } from './services/unified-aadhaar-service';
import { DemographicProtectionService } from './services/demographic-protection-service';
import { sandboxPANService } from './sandbox-pan-api';
import { authBridgeCKYCService } from './authbridge-ckyc-api';
import { KRAStatusService } from './services/kra-status-service';
import { providerRegistry, type UnifiedApplicationData } from './partner-application-adapters';
import { insertPartnerApplicationSchema, insertCashfreeTransactionSchema, insertPhonePeTransactionSchema } from '@shared/schema';
import { cashfreeService } from './cashfree-service';
import { phonePeService } from './phonepe-service';
import { mutualFundsRefreshJob } from './mutual-funds-refresh-job';
import { registerAgentItrRoutes } from './agent-itr-routes';
import { registerForm15Routes } from './form15-routes';
import { initReKYCCron } from './rekyc-cron';
import { seedProducts } from './seed-products';
import { seedDefaultAgent } from './seed-default-agent';
import { nseNcbApi } from './nseNcbApi';
import { bseBondApi } from './bseBondApi';
import { bseDirectApi } from './bseDirectApi';
import { governmentSecurities, corporateBonds, bondOrders, bondHoldings, insertBondOrderSchema } from '@shared/schema';
import { businessIntelligence } from './business-intelligence-service';
import { isProductionEnvironment } from './utils/enrichment-guard';
import { bondOrderNotificationService } from "./services/bond-order-notification-service";
import { verifyBankAccountPennyDrop, validateIFSC, validateAccountNumber, isNameMatchAcceptable } from './penny-drop-service';
import { lookupIFSC, isValidIFSCFormat } from './ifsc-lookup-service';
import { ProductAccountService } from './product-account-service';
import { BSEStarKYCService } from './services/bse-star-kyc-service';
import { marketMoversCache } from './services/market-movers-cache';
import { platformStatsCache } from './services/platform-stats-cache';
import * as schema from "@shared/schema";
import adminMutualFundsRoutes from "./routes/admin-mutual-funds-routes";
import adminGlobalInstrumentsRoutes from "./routes/admin-global-instruments";
import adminApiUsageRoutes from "./routes/admin-api-usage-routes";
import derivativesRoutes from "./routes/derivatives-routes";
import excelAddinRoutes from "./routes/excel-addin-routes";
import taxServicesRoutes from "./routes/tax-services-routes";
import listedStocksAdminRoutes from "./routes/listed-stocks-admin";
import demoProposalsRoutes, { agentDemoRouter } from "./routes/demo-proposals";
import schemeGovernanceRoutes from "./routes/scheme-governance-routes";
import stockEnrichmentRoutes from "./routes/stock-enrichment-routes";
import exchangeStockSyncRoutes from './routes/exchange-stock-sync';
import unifiedCartRoutes from "./routes/unified-cart";
import aiProposalRoutes from "./routes/ai-proposal-routes";
import goalPlanningRoutes from "./routes/goal-planning-routes";
import recommendationProductsRoutes, { publicRouter as recommendationProductsPublicRoutes } from "./routes/recommendation-products";
import investableSurplusRoutes from "./routes/investable-surplus-routes";
import riskSuitabilityRoutes from "./routes/risk-suitability-routes";
import returnForecastingRoutes from "./routes/return-forecasting-routes";
import assetAllocationRoutes from "./routes/asset-allocation-routes";
import portfolioImportRoutes from "./routes/portfolio-import";
import casStatementRoutes from "./routes/cas-statement-routes";
import clientDocumentsRoutes from "./routes/client-documents-routes";
import treasuryRoutes from "./routes/treasury-routes";
import proposalExecutionRoutes from "./routes/proposal-execution-routes";
import explainabilityRoutes from "./routes/explainability-routes";
import investmentAdvisoryComplianceRoutes from "./routes/investment-advisory-compliance-routes";
import { setupChatRoutes } from './routes/chat-routes';
import { registerAIStockRecommendationRoutes } from './routes/ai-stock-recommendation-routes';
import { registerAgentAdvisoryRoutes } from "./routes/agent-advisory";
import onboardingInvitationsRoutes from "./routes/onboarding-invitations";
import prospectProposalsRoutes from "./routes/prospect-proposals";
import instrumentsRoutes from "./routes/instruments";
import storeAifPmsRoutes from "./routes/store-aif-pms";
import itrPricingRoutes from "./routes/itr-pricing";
import platformFeesRoutes from "./routes/platform-fees";
import subscriptionRoutes from "./routes/subscription";
import storeMldRoutes from "./routes/store-mld";
import giftCityRoutes from "./routes/gift-city-routes";
import aiInvestmentRoutes from "./routes/ai-investment-routes";
import unifiedAdvisoryRoutes from "./routes/unified-advisory-routes";
import bondRecommendationsRoutes from "./routes/bond-recommendations";
import fixedIncomeStatusRoutes from "./routes/fixed-income-status-routes";
import commodityRecommendationsRoutes from "./routes/commodity-recommendations";
import { taxRoutes } from "./tax-routes";
import meetingBookingsRoutes from "./routes/meeting-bookings";
import sebiRiskProfilingRoutes from "./routes/sebi-risk-profiling-routes";
import portfolioReportsRoutes from "./routes/portfolio-reports";
import kycFlowRoutes from "./routes/kyc-flow-routes";
import cashfreeVrsRoutes from "./routes/cashfree-vrs-routes";
import kycEngineRoutes from "./routes/kyc-engine-routes";
import aiRecommendationTrackingRoutes from "./routes/ai-recommendation-tracking-routes";
import errorTrackingRoutes from "./routes/error-tracking-routes";
import testerDiagnosticsRoutes from "./routes/tester-diagnostics-routes";
import engineHealthCheckRoutes from "./routes/engine-health-check";
import mfAnalyticsAdminRoutes from "./routes/mf-analytics-admin";
import activityCentreRoutes from "./routes/activity-centre-routes";
import taskOversightRoutes from "./routes/task-oversight-routes";
import usTradingRoutes from "./routes/us-trading";
import { registerBondTradingOrdersRoutes } from './routes/bond-trading-orders';
import { registerReportsInlineRoutes } from './routes/reports-inline';
import { registerMFMonthwiseRoutes } from './routes/mf-monthwise';
import { registerAgentCapitalGainsRoutes } from './routes/agent-capital-gains';
import { registerAIInvestmentOrchestratorRoutes } from "./routes/ai-investment-orchestrator-routes";
import { registerProfitOptimizedRoutes } from "./routes/profit-optimized-routes";
import { registerAgentGovernanceRoutes } from "./routes/agent-governance-routes";
import { registerLeadLeakageRoutes } from "./routes/lead-leakage-routes";
import { registerAppointmentManagementRoutes } from "./routes/appointment-management-routes";
import unifiedPortfolioRoutes from "./routes/unified-portfolio-routes";
import aiRebalancingRoutes from "./routes/ai-rebalancing-routes";
import unifiedProposalsRoutes from "./routes/unified-proposals-routes";
import proposalBuilderRoutes from "./routes/proposal-builder-routes";
import globalAdvisoryRoutes from "./routes/global-advisory";
import feeModeRoutes from "./routes/fee-mode";
import cacheAdminRoutes from "./routes/cache-admin";
import quantAdminRoutes from "./routes/quant-admin-routes";
import parserAdminRoutes from "./routes/parser-admin";
import institutionalRoutes from "./routes/institutional-routes";
import historicalNavRoutes from "./routes/historical-nav";
import { cacheCleanupScheduler } from "./services/cache-cleanup-scheduler";
import { exitLoadSyncScheduler } from "./services/exit-load-sync-scheduler";
import exchangeFilingsRoutes from "./routes/exchange-filings-routes";
import financialMetricsRoutes from './routes/financial-metrics-routes';
import financialMetricsAdminRoutes from './routes/financial-metrics-admin';
import aaConsentRoutes from './routes/aa-consent-routes';
import portfolioStagingRoutes from './routes/portfolio-staging-routes';
import stockIntersectionRoutes from './routes/stock-intersection';
import overlapIntelligenceRoutes from './routes/overlap-intelligence';
import sipSimulatorRoutes from './routes/sip-simulator';
import sebiAuditRoutes from './routes/sebi-audit';
export async function registerRoutes(app: Express, existingServer?: Server): Promise<Server> {
  const server = existingServer || createServer(app);
  registerSecurityMasterCreditRatingRoutes(app);
  
  // Health check endpoint - skip if already registered in index.ts (fast boot mode)
  if (!existingServer) {
    app.get("/api/health", (req, res) => {
      res.status(200).json({ 
        status: "ok", 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });
  }

  app.get("/sitemap.xml", (req, res) => {
    const isProduction = process.env.NODE_ENV === 'production' || process.env.REPLIT_DEPLOYMENT === '1';
    const baseUrl = isProduction ? 'https://fintekpro.in' : (req.protocol + '://' + req.get('host'));
    const today = new Date().toISOString().split('T')[0];
    const publicRoutes = [
      { loc: '/', priority: '1.0', changefreq: 'daily' },
      { loc: '/markets', priority: '0.9', changefreq: 'daily' },
      { loc: '/mutual-funds', priority: '0.8', changefreq: 'daily' },
      { loc: '/ipo', priority: '0.7', changefreq: 'daily' },
      { loc: '/bonds', priority: '0.7', changefreq: 'daily' },
      { loc: '/unlisted', priority: '0.7', changefreq: 'weekly' },
      { loc: '/loans', priority: '0.7', changefreq: 'weekly' },
      { loc: '/calculators', priority: '0.6', changefreq: 'monthly' },
      { loc: '/login', priority: '0.5', changefreq: 'monthly' },
      { loc: '/register', priority: '0.5', changefreq: 'monthly' },
    ];
    const urls = publicRoutes.map(r =>
      `  <url>\n    <loc>${baseUrl}${r.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${r.changefreq}</changefreq>\n    <priority>${r.priority}</priority>\n  </url>`
    ).join('\n');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
    res.set('Content-Type', 'application/xml');
    res.send(xml);
  });

  // Diagnostics endpoint to help debug production issues (admin only)
  app.get("/api/internal/diagnostics", async (req, res) => {
    const diagnostics: Record<string, any> = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      checks: {}
    };
    
    // Check database connectivity
    try {
      const result = await db.execute(sql`SELECT 1 as test`);
      diagnostics.checks.database = { status: 'ok', message: 'Database connection successful' };
    } catch (error: any) {
      diagnostics.checks.database = { 
        status: 'error', 
        message: error.message,
        code: error.code 
      };
    }
    
    // Check required environment variables
    const requiredEnvVars = ['DATABASE_URL', 'SESSION_SECRET'];
    const optionalApiVars = ['SANDBOX_API_KEY', 'PROBE42_API_KEY', 'CASHFREE_APP_ID'];
    
    diagnostics.checks.environment = {
      required: requiredEnvVars.reduce((acc, key) => {
        acc[key] = !!process.env[key] ? 'set' : 'missing';
        return acc;
      }, {} as Record<string, string>),
      optional: optionalApiVars.reduce((acc, key) => {
        acc[key] = !!process.env[key] ? 'set' : 'not_set';
        return acc;
      }, {} as Record<string, string>)
    };
    
    // Check MCA service availability
    try {
      const { mcaIntelligenceService } = await import('./services/mca-intelligence-service');
      diagnostics.checks.mcaService = { 
        status: 'initialized',
        sandboxConfigured: !!process.env.SANDBOX_API_KEY
      };
    } catch (error: any) {
      diagnostics.checks.mcaService = { status: 'error', message: error.message };
    }
    
    // Check Cashfree payment gateway configuration
    try {
      const { cashfreeService } = await import('./cashfree-service');
      const hasCredentials = cashfreeService.hasValidCredentials();
      const cfPgAppId = process.env.CASHFREE_PG_APP_ID || process.env.CASHFREE_APP_ID;
      const cfPgSecret = process.env.CASHFREE_PG_SECRET_KEY || process.env.CASHFREE_SECRET_KEY;
      const cfSidAppId = process.env.CASHFREE_SECUREID_APP_ID || process.env.CASHFREE_VERIFICATION_APP_ID;
      diagnostics.checks.cashfree = {
        status: hasCredentials ? 'configured' : 'missing_credentials',
        pgAppIdSet: !!cfPgAppId,
        pgSecretKeySet: !!cfPgSecret,
        pgAppIdLength: cfPgAppId?.length || 0,
        secureIdAppIdSet: !!cfSidAppId,
        environment: process.env.CASHFREE_PG_ENVIRONMENT || process.env.CASHFREE_ENVIRONMENT || (process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'SANDBOX')
      };
    } catch (error: any) {
      diagnostics.checks.cashfree = { status: 'error', message: error.message };
    }
    
    const hasErrors = Object.values(diagnostics.checks).some((check: any) => check.status === 'error');
    res.status(hasErrors ? 503 : 200).json(diagnostics);
  });

  // Initialize market movers cache at startup (production only - external API calls + DB writes)
  if (isProductionEnvironment()) {
    marketMoversCache.initialize().catch(err => console.error("Failed to initialize market movers cache:", err));
  } else {
    console.log('⏭️ [MarketMoversCache] Initialization skipped (development mode - production only)');
  }
  // Initialize platform stats cache at startup (production only - periodic DB queries)
  if (isProductionEnvironment()) {
    platformStatsCache.initialize().catch(err => console.error("Failed to initialize platform stats cache:", err));
  } else {
    console.log('⏭️ [PlatformStatsCache] Initialization skipped (development mode - production only)');
  }
  // Initialize API usage tracking service
  apiUsageTrackingService.initialize().catch(err => console.error("Failed to initialize API usage tracking:", err)); // Deferred startup
  
  // Auth middleware is set up in index.ts before registerRoutes is called
  // to prevent duplicate session/auth strategy registration

  // Apply execution guard middleware for SEBI-compliant offline protection
  app.use(executionGuard({ logExecution: true, blockOfflineExecution: true }));
  
  // Initialize user passwords with proper hashing
  await storage.initializeUserPasswords();
  
  // Initialize AI Portfolio Service
  const aiPortfolioService = new AIPortfolioService(storage as any);
  
  // Initialize Multi-Source Mutual Fund Service with database persistence
  const multiSourceMFService = new MultiSourceMFService(storage as any);
  
  // Initialize BBPS-Expense Integration Service
  const bbpsExpenseIntegration = new BbpsExpenseIntegration(storage as any);
  
  // Initialize Product Account Service
  const productAccountService = new ProductAccountService(storage as any);
  
  // WhatsApp Web (QR-code) client — enabled via ENABLE_WHATSAPP=true
  // In production, use the admin endpoint GET /api/admin/whatsapp/qr to scan the QR.
  if (process.env.ENABLE_WHATSAPP === 'true') {
    try {
      await whatsappService.initialize();
      console.log('✅ WhatsApp Web client initialized');
    } catch (error) {
      console.log('⚠️ WhatsApp Web client init failed (non-critical):', error instanceof Error ? error.message : error);
    }
  } else {
    console.log('⏭️ [WhatsApp Web] Skipped — set ENABLE_WHATSAPP=true to enable');
  }

  // Start mutual funds background refresh job (production only - writes to DB)
  if (isProductionEnvironment()) {
    mutualFundsRefreshJob.start();
  } else {
    console.log("⏭️ [MF Refresh Job] Skipped (development mode - production only)");
  }
  registerAgentItrRoutes(app);
  registerForm15Routes(app);
  
  // Start Re-KYC reminder cron job (production only - sends notifications)
  if (isProductionEnvironment()) {
    initReKYCCron();
  } else {
    console.log("⏭️ [Re-KYC Cron] Skipped (development mode - production only)");
  }
  
  // Check products - no auto-seeding with mock data
  try {
    const existingProducts = await storage.getProducts({ category: 'mutual_fund' });
    if (!existingProducts || existingProducts.length === 0) {
      console.log('📦 No products found in database. Use admin panel to add products.');
    }
  } catch (error) {
    console.log('⚠️ Product check skipped:', error instanceof Error ? error.message : 'Unknown error');
  }
  
  // Seed default agent (production only - no mock data on production DB from development)
  if (isProductionEnvironment()) {
    try {
      await seedDefaultAgent();
    } catch (error) {
      console.log('⚠️ Default agent seeding skipped:', error instanceof Error ? error.message : 'Unknown error');
    }
  } else {
    console.log('⏭️ [DefaultAgent] Seeding skipped (development mode - no mock data on production DB)');
  }
  
  // Activity tracking middleware
  app.use((req: any, res: any, next: any) => {
    // Track API calls for authenticated users
    if (req.user && req.url.startsWith('/api/') && !req.url.includes('/admin/activities')) {
      adminService.logActivity({
        userId: req.user!.id,
        action: 'api_call',
        resource: req.url,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        details: { method: req.method }
      }).catch(console.error);
    }
    next();
  });

  // Admin middleware to check admin role
  const requireAdmin = async (req: any, res: any, next: any) => {
    // SECURITY: Development bypass removed - all environments now require proper authentication
    // if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
    //   // Mock admin user for testing
    //   req.user = { 
    //     id: 'dc41e192-05de-481c-b1cc-947d8ea42cff',
    //     role: 'admin',
    //     email: 'skmohanty0@gmail.com'
    //   };
    //   return next();
    // }
    
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    const isAdmin = await adminService.isAdmin(req.user.id);
    if (!isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }
    
    next();
  };

  // WhatsApp Web admin endpoints (requireAdmin is now in scope)
  registerAdminMiscRoutes(app);
  await registerPlatformStatsRoutes(app);

  // Route registrations from platform-stats-routes
  // Admin Mutual Funds Management Routes
  app.use("/api/admin", requireAdmin, adminMutualFundsRoutes);
  app.use("/api/admin/global-instruments", requireAdmin, adminGlobalInstrumentsRoutes);
  app.use(adminApiUsageRoutes);
  app.use("/api/derivatives", derivativesRoutes);
  app.use("/api/excel", excelAddinRoutes);
  console.log("✅ Excel Add-in routes registered (/api/excel/*)");
  app.use("/api/admin/tax-services", requireAdmin, taxServicesRoutes);
  app.use("/api/unified-cart", unifiedCartRoutes);
  app.use("/api/admin", requireAdmin, listedStocksAdminRoutes);
  app.use("/api/admin/stocks", requireAdmin, stockEnrichmentRoutes);
  app.use("/api/admin/demo-proposals", requireAdmin, demoProposalsRoutes);
  app.use("/api/admin/scheme-governance", requireAdmin, schemeGovernanceRoutes);
  app.use("/api/agent/demo-proposals", isAuthenticated, agentDemoRouter);
  app.use("/api/agent", portfolioImportRoutes);
  app.use("/api/cas-statement", isAuthenticated, casStatementRoutes);
  app.use(signatureRoutes);
  app.use(userSignatureESignRoutes);
  app.use("/api/client", isAuthenticated, clientDocumentsRoutes);
  app.use("/api/admin/exchange-sync", requireAdmin, exchangeStockSyncRoutes);
  // AI Proposal Engine Routes
  app.use("/api/ai-proposals", aiProposalRoutes);
  app.use("/api/goals", goalPlanningRoutes);
  app.use("/api/surplus", investableSurplusRoutes);
  app.use("/api/risk", riskSuitabilityRoutes);
  app.use("/api/returns", returnForecastingRoutes);
  app.use("/api/allocation", assetAllocationRoutes);
  app.use("/api/treasury", treasuryRoutes);
  app.use("/api/execution", proposalExecutionRoutes);
  app.use("/api/explainability", explainabilityRoutes);
  app.use("/api/advisory-compliance", investmentAdvisoryComplianceRoutes);
  registerAgentAdvisoryRoutes(app);
  registerAIStockRecommendationRoutes(app);
  registerAIInvestmentOrchestratorRoutes(app);
  registerProfitOptimizedRoutes(app);
  registerAgentGovernanceRoutes(app);
  registerLeadLeakageRoutes(app);
  registerAppointmentManagementRoutes(app);
  app.use(onboardingInvitationsRoutes);
  app.use(prospectProposalsRoutes);
  app.use(instrumentsRoutes);
  app.use("/api/store", storeAifPmsRoutes);
  app.use("/api/admin/itr-pricing", requireAdmin, itrPricingRoutes);
  app.use("/api/admin/platform-fees", requireAdmin, platformFeesRoutes);
  console.log("✅ ITR Pricing routes registered");
  app.use("/api/store", storeMldRoutes);
  app.use("/api/store/gift-city", giftCityRoutes);
  app.use("/api/ai-investment", aiInvestmentRoutes);
  app.use("/api/unified-advisory", unifiedAdvisoryRoutes);
  app.use("/api/bond-recommendations", bondRecommendationsRoutes);
  app.use("/api/commodity-recommendations", commodityRecommendationsRoutes);
  app.use("/api/fixed-income", fixedIncomeStatusRoutes);
  app.use("/api/tax", taxRoutes);
  app.use("/api/meetings", meetingBookingsRoutes);
  app.use("/api/sebi-risk-profiling", sebiRiskProfilingRoutes);
  app.use(portfolioReportsRoutes);
  app.use("/api/ai-recommendations-tracking", aiRecommendationTrackingRoutes);
  app.use("/api/errors", errorTrackingRoutes);
  app.use("/api/tester", testerDiagnosticsRoutes);
  app.use("/api/engine-health", engineHealthCheckRoutes);
  console.log("✅ Engine Health Check routes registered");
  app.use(mfAnalyticsAdminRoutes);
  app.use(institutionalRoutes);
  console.log("✅ Institutional routes registered");
  console.log("✅ MF Analytics Admin routes registered");
  app.use("/api/activity-centre", activityCentreRoutes);
  app.use("/api/admin/task-oversight", taskOversightRoutes);
  console.log("✅ Task Oversight routes registered");
  console.log("✅ Activity Centre routes registered");
  app.use("/api/us-trading", usTradingRoutes);
  app.use(unifiedPortfolioRoutes);
  app.use(aiRebalancingRoutes);
  app.use("/api/unified-proposals", unifiedProposalsRoutes);
  app.use("/api/proposal-builder", proposalBuilderRoutes);
  console.log("✅ Proposal Builder routes registered");
  console.log("✅ US Trading routes registered");
  // Start Alpaca SSE event streams (trade fills, account/journal/transfer status)
  if (process.env.ALPACA_API_KEY) {
    alpacaSseService.start(["trade_updates", "account_updates", "journal_updates", "transfer_updates"]);
    console.log("✅ Alpaca SSE event streams started");
  } else {
    console.log("⏭️ [AlpacaSSE] Skipped — ALPACA_API_KEY not configured");
  }
  console.log("✅ Unified Portfolio routes registered");
  console.log("✅ AI Rebalancing routes registered");
  console.log("✅ Unified Proposals routes registered");
  console.log("✅ Error Tracking routes registered");
  console.log("✅ Tester Diagnostics routes registered");
  console.log("✅ AI Recommendation Tracking routes registered");
  
  // KYC Flow Configuration Routes (unified single source of truth for all KYC providers)
  app.use("/api/admin/kyc", requireAdmin, kycFlowRoutes);
  console.log("✅ KYC Flow Configuration routes registered");

  // Cashfree VRS (Secure ID) Routes — admin testing for all verification APIs
  app.use("/api/admin/cashfree-vrs", cashfreeVrsRoutes);
  console.log("✅ Cashfree VRS (Secure ID) routes registered (/api/admin/cashfree-vrs/*)");

  
  // KYC Engine Routes (orchestration, identity, consent, admin)
  app.use("/api/kyc-engine", kycEngineRoutes);
  console.log("✅ KYC Engine routes registered");
  
  // Quant Infrastructure Admin Routes
  app.use("/api/admin/quant", requireAdmin, quantAdminRoutes);
  console.log("✅ Quant Admin routes registered");
  
  // Cache Admin Routes (Data Caching & Cost Optimization)
  app.use("/api/admin/cache", requireAdmin, cacheAdminRoutes);
  app.use("/api/admin/parser", requireAdmin, parserAdminRoutes);
  console.log("✅ Parser Admin routes registered");
  app.use("/api/admin/exchange-filings", requireAdmin, exchangeFilingsRoutes);
  console.log("✅ Exchange Filings routes registered (admin-only)");
  if (isProductionEnvironment()) {
    cacheCleanupScheduler.initialize();
  } else {
    console.log('⏭️ [CacheCleanupScheduler] Skipped (development mode - production only)');
  }
  console.log("✅ Cache Admin routes registered");
  
  // Historical NAV Data Service (Portfolio Metrics from Real Data)
  app.use("/api/historical-nav", historicalNavRoutes);
  console.log("✅ Historical NAV Data routes registered");
  console.log("⏭️ [HistoricalNavRefresh] Auto-refresh disabled — MFAPI dependency removed");
  
  // Global Advisory Routes (EPIC 1 & 2)
  app.use("/api/global-advisory", globalAdvisoryRoutes);
  console.log("✅ Global Advisory routes registered");
  
  // Client Fee Mode Routes (Advisory + Platform vs Platform-Only)
  app.use("/api/fee-mode", feeModeRoutes);
  console.log("✅ Client Fee Mode routes registered");
  
  // Subscription & Monetization Routes (Cashfree-powered)
  app.use("/api/subscriptions", subscriptionRoutes);
  console.log("✅ Subscription & Monetization routes registered");
  
  // Improvement Features Routes (Dashboard, Referral, Reports, Alerts, Theme)
  const improvementFeaturesRoutes = (await import("./routes/improvement-features")).default;
  app.use("/api/features", improvementFeaturesRoutes);
  console.log("✅ Improvement Features routes registered");
  
  // Agent Prospect Wizard Routes
  const agentProspectWizardRoutes = (await import("./routes/agent-prospect-wizard")).default;
  app.use("/api/agent-wizard", agentProspectWizardRoutes);
  console.log("✅ Agent Prospect Wizard routes registered");
  
  const agentEmpanelmentRoutes = (await import("./routes/agent-empanelment")).default;
  app.use("/api/agent/empanelment", agentEmpanelmentRoutes);
  console.log("✅ Agent Empanelment KYC routes registered");
  
  // Knowledge Hub Routes
  app.use("/api/knowledge-hub", knowledgeHubRoutes);
  app.use("/api/research-lists", isAuthenticated, researchWorkspaceRoutes);
  app.use("/api/research-note", researchNoteRoutes);
  app.use(screenerRoutes);
  console.log("✅ Knowledge Hub & Screener routes registered");
  
  // Golden Source Pricing Engine (Bloomberg-style multi-source golden price)
  app.use("/api/pricing", goldenPricingRoutes);
  console.log("✅ Golden Source Pricing Engine routes registered (/api/pricing/*)");
  
  // MCA Intelligence Routes (Query Console, Filing Tracker, Analytics)
  app.use("/api/mca", mcaIntelligenceRoutes);
  app.use("/api/mca/direct-payments", mcaDirectPaymentRoutes);
  console.log("✅ MCA Direct Payment routes registered");
  app.use("/api/admin/mca-backfill", mcaFinancialBackfillRoutes);
  console.log("✅ MCA Financial Backfill routes registered");
  if (isProductionEnvironment()) {
    mcaFinancialRefreshScheduler.start();
    console.log("✅ MCA Financial Refresh Scheduler started (daily auto-refresh)");
  
    const { quantRetrainingScheduler } = await import('./services/quant/quant-retraining-scheduler');
    quantRetrainingScheduler.start();
    console.log("✅ Quant Retraining Scheduler started (automated model lifecycle)");
  } else {
    console.log("⏭️ [MCA Refresh/Quant Retraining] Skipped (development mode - production only)");
  }
  console.log("✅ MCA Intelligence routes registered");
  
  app.use("/api/admin/recommendation-products", recommendationProductsRoutes);
  app.use("/api/recommendation-products", recommendationProductsPublicRoutes);
  console.log("✅ Recommendation Products routes registered");
  
  app.use("/api/financial-metrics", financialMetricsRoutes);
  app.use("/api/admin/financial-metrics", requireAdmin, financialMetricsAdminRoutes);
  app.use("/api/aa", aaConsentRoutes);
  console.log("✅ Financial Metrics routes registered");
  
  // Intrinsic Value Calculator Routes
  app.use("/api", intrinsicValueRoutes);
  console.log("✅ Intrinsic Value Calculator routes registered");
  app.use("/api/portfolio/staging", portfolioStagingRoutes);
  
  // Stock Intersection Analysis routes
  app.use("/api/stock-intersection", stockIntersectionRoutes);
  
  // Overlap Intelligence Engine routes
  app.use("/api/portfolio", overlapIntelligenceRoutes);
  console.log("✅ Overlap Intelligence Engine routes registered");
  
  // SIP Simulator and SEBI Audit routes
  app.use("/api/sip", sipSimulatorRoutes);
  app.use("/api/sebi-audit", sebiAuditRoutes);
  console.log("✅ SIP Simulator and SEBI Audit routes registered");
  registerReportsInlineRoutes(app);
  registerMFMonthwiseRoutes(app);
  registerAgentCapitalGainsRoutes(app);
  registerAdminComplianceTestRoutes(app);

  // =================================================================
  // CLIENT ENRICHMENT API ENDPOINTS
  // =================================================================

  // Comprehensive client enrichment endpoint
  app.post("/api/client/enrich", clientEnrichmentService.enrichClient);

  // Get client enrichment history
  app.get("/api/client/enrichment/history", clientEnrichmentService.getEnrichmentHistory);

  // Get detailed enrichment insights
  app.get("/api/client/enrichment/:enrichmentId", clientEnrichmentService.getEnrichmentInsights);

  // Get available enrichment data sources
  app.get("/api/client/enrichment/sources", clientEnrichmentService.getEnrichmentSources);

  // =================================================================
  // AI TRANSACTION TRACKING API ENDPOINTS
  // =================================================================

  // Track a new transaction with AI analysis
  app.post("/api/transactions/track", aiTransactionTrackerService.trackTransaction);

  // Analyze user's transaction patterns
  app.get("/api/transactions/analyze", aiTransactionTrackerService.analyzeTransactions);

  // Get transaction history with AI insights
  app.get("/api/transactions/history", aiTransactionTrackerService.getTransactionHistory);

  // Get transaction alerts and anomalies
  app.get("/api/transactions/alerts", aiTransactionTrackerService.getTransactionAlerts);

  // =================================================================
  // AI INVESTSMART MONITOR API ENDPOINTS
  // =================================================================

  // Get comprehensive AI insights for InvestSmart page
  app.get("/api/ai-investsmart-insights", aiInvestSmartMonitorService.getAIInsights);

  // Get AI-generated actionables based on current data
  app.get("/api/ai-investsmart-actionables", aiInvestSmartMonitorService.getActionables);

  // Monitor InvestSmart page health and generate alerts
  app.get("/api/ai-investsmart-health", aiInvestSmartMonitorService.monitorPageHealth);
  
  registerBondsMarketRoutes(app);
  registerBondTradingOrdersRoutes(app);
  registerCommoditiesMarketRoutes(app);
  registerMarketDataRoutes(app);
  registerPortfolioCoreRoutes(app);
  registerRiskProfilesPartnerAppsRoutes(app);
  registerAIFPMSSystemRoutes(app);
  registerLoanProvidersRoutes(app);
  registerBankAccountsDematRoutes(app);
  registerTaxFilingRoutes(app);
  registerBBPSPanConsentRoutes(app);
  registerInvestmentIdeasRoutes(app);
  registerKYCAdminSupportRoutes(app);
  registerKYCWizardRoutes(app);
  registerAgentProspectAcquisitionRoutes(app);
  registerUserProfileKYCRoutes(app);
  registerFinancialGoalsRoutes(app);
  registerPortfolioCompareAISIPRoutes(app);
  registerStockExchangeRoutes(app);
  registerSandboxWebhookRoutes(app);
  registerBankingRoutes(app);
  registerLoanRoutes(app);
  await registerLoanProcessingRoutes(app);
  registerLoanComparisonRoutes(app);
  app.use("/api/dsa-loans", dsaLoanRoutes);
  app.use("/api/admin/dsa-loans", adminDsaLoanRoutes);
  app.use("/api/agent/loans", isAuthenticated, agentLoanRoutes);
  app.use("/api/admin/agent-payouts", isAuthenticated, adminAgentPayoutRoutes);
  app.use("/api/developer-finance", developerFinanceRoutes);
  console.log("✅ DSA Multi-Financier Loan routes registered");
  registerLoanCommissionRoutes(app);
  registerEligibilityMatrixRoutes(app);
  registerRevenueSheetRoutes(app);
  registerPreIPORoutes(app);
  registerCartRoutes(app);
  registerPartnerPortalRoutes(app);
  registerPortalSystemRoutes(app);
  
  // Document Lifecycle Management (DLM) System
  registerFinancialDataRoutes(app);
  app.use("/api/webauthn", webauthnRouter);
  console.log("✅ WebAuthn Biometric Authentication routes registered");
  registerDLMRoutes(app);
  app.use(aiGovernanceRouter);
  console.log('✅ AI Governance routes registered');

  // Extracted domain route modules (P3 — routes.ts size reduction)
  registerFamilyCollaborationRoutes(app);
  registerAlertSystemRoutes(app);
  registerSystemAdminRoutes(app);
  registerIrisKfintechRoutes(app);
  
  return server;
}
