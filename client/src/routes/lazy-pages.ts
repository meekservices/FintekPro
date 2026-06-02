/**
 * @file lazy-pages.ts
 * @description Single source of truth for all lazy-loaded page components.
 *
 * BEFORE: Each route file (user.routes.tsx, agent.routes.tsx, admin.routes.tsx,
 *         App.tsx) declared its own copy of every lazy import — 370+ components
 *         declared 4× each = 1480+ redundant declarations.
 *
 * AFTER: Declare here once, import everywhere.
 *
 * Usage in route files:
 *   import { Portfolio, MutualFunds, AgentDashboard } from "@/routes/lazy-pages";
 */
import { lazyWithRetry } from "@/lib/lazy-with-retry";

// ─── Core User Pages ──────────────────────────────────────────────────────────
export const Home = lazyWithRetry(() => import("@/pages/home"));
export const Portfolio = lazyWithRetry(() => import("@/pages/portfolio"));
export const Markets = lazyWithRetry(() => import("@/pages/markets"));
export const IPO = lazyWithRetry(() => import("@/pages/ipo"));
export const PreIPO = lazyWithRetry(() => import("@/pages/pre-ipo"));
export const MutualFunds = lazyWithRetry(() => import("@/pages/mutual-funds"));
export const FundComparison = lazyWithRetry(() => import("@/pages/fund-comparison"));
export const PortfolioComparison = lazyWithRetry(() => import("@/pages/portfolio-comparison"));
export const Unlisted = lazyWithRetry(() => import("@/pages/unlisted"));
export const Loans = lazyWithRetry(() => import("@/pages/loans"));
export const NSDLServices = lazyWithRetry(() => import("@/pages/nsdl-services"));
export const CDSLServices = lazyWithRetry(() => import("@/pages/cdsl-services"));
export const CamsServices = lazyWithRetry(() => import("@/pages/cams-services"));
export const KfintechServices = lazyWithRetry(() => import("@/pages/kfintech-services"));
export const AgriculturalInsights = lazyWithRetry(() => import("@/pages/agricultural-insights"));
export const FinancialCalculators = lazyWithRetry(() => import("@/pages/financial-calculators"));
export const AdminPanel = lazyWithRetry(() => import("@/pages/admin"));
export const TesterDiagnostics = lazyWithRetry(() => import("@/pages/tester-diagnostics"));
export const PartnerPortal = lazyWithRetry(() => import("@/pages/partner-portal"));
export const Support = lazyWithRetry(() => import("@/pages/support"));
export const InvestSmart = lazyWithRetry(() => import("@/pages/wealth-management"));
export const Achievements = lazyWithRetry(() => import("@/pages/achievements"));
export const CapitalGainsReports = lazyWithRetry(() => import("@/pages/capital-gains-reports"));
export const ReportsHub = lazyWithRetry(() => import("@/pages/reports-hub"));
export const TransactionReports = lazyWithRetry(() => import("@/pages/transaction-reports"));
export const AgentDashboard = lazyWithRetry(() => import("@/pages/agent-dashboard"));
export const AgentPicks = lazyWithRetry(() => import("@/pages/agent-picks"));
export const IBTradingPage = lazyWithRetry(() => import("@/pages/ib-trading"));
export const StorePage = lazyWithRetry(() => import("@/pages/store"));
export const GiftCity = lazyWithRetry(() => import("@/pages/gift-city"));
export const Cart = lazyWithRetry(() => import("@/pages/cart"));
export const Orders = lazyWithRetry(() => import("@/pages/orders"));
export const ApiMonitorDemo = lazyWithRetry(() => import("@/pages/api-monitor-demo"));
export const ICICILoans = lazyWithRetry(() => import("@/pages/icici-loans"));
export const HDFCLoans = lazyWithRetry(() => import("@/pages/hdfc-loans"));
export const ClientAutoPopulate = lazyWithRetry(() => import("@/pages/client-auto-populate"));
export const Privacy = lazyWithRetry(() => import("@/pages/privacy"));
export const Terms = lazyWithRetry(() => import("@/pages/terms"));
export const RefundPolicy = lazyWithRetry(() => import("@/pages/refund-policy"));
export const PricingPage = lazyWithRetry(() => import("@/pages/pricing"));
export const InvestmentDisclaimer = lazyWithRetry(() => import("@/pages/disclaimer"));
export const ExcelAddin = lazyWithRetry(() => import("@/pages/excel-addin"));
export const AIF = lazyWithRetry(() => import("@/pages/aif"));
export const AIFDetail = lazyWithRetry(() => import("@/pages/aif-detail"));
export const PMS = lazyWithRetry(() => import("@/pages/pms"));
export const PMSDetail = lazyWithRetry(() => import("@/pages/pms-detail"));
export const AlternativeInvestments = lazyWithRetry(() => import("@/pages/alternative-investments"));
export const MldStore = lazyWithRetry(() => import("@/pages/mld-store"));
export const MldDetail = lazyWithRetry(() => import("@/pages/mld-detail"));
export const BajajFinance = lazyWithRetry(() => import("@/pages/bajaj-finance"));
export const TataCapital = lazyWithRetry(() => import("@/pages/tata-capital"));
export const PolicyBazaar = lazyWithRetry(() => import("@/pages/policybazaar"));
export const Cibil = lazyWithRetry(() => import("@/pages/cibil"));
export const Contact = lazyWithRetry(() => import("@/pages/contact"));
export const SupplierManagement = lazyWithRetry(() => import("@/pages/supplier-management").then(m => ({ default: m.SupplierManagement })));
export const Profile = lazyWithRetry(() => import("@/pages/profile"));

// ─── Admin Dashboard & Management ────────────────────────────────────────────
export const AdminDashboard = lazyWithRetry(() => import("@/pages/admin/dashboard"));
export const GoldenPricingDashboard = lazyWithRetry(() => import("@/pages/admin/golden-pricing-dashboard"));
export const SystemHealthMonitor = lazyWithRetry(() => import("@/pages/admin/system-health"));
export const EngineHealthCheck = lazyWithRetry(() => import("@/pages/admin/engine-health-check"));
export const MFAnalyticsOps = lazyWithRetry(() => import("@/pages/admin/mf-analytics-ops"));
export const RevenueAnalytics = lazyWithRetry(() => import("@/pages/admin/revenue-analytics"));
export const UserActivityTimeline = lazyWithRetry(() => import("@/pages/admin/user-activity-timeline"));
export const BulkOperations = lazyWithRetry(() => import("@/pages/admin/bulk-operations"));
export const ComplianceDashboardPage = lazyWithRetry(() => import("@/pages/admin/compliance-dashboard"));
export const SEBIMFCompliance = lazyWithRetry(() => import("@/pages/admin/sebi-mf-compliance"));
export const RegulatoryAuditNormsPage = lazyWithRetry(() => import("@/pages/admin/regulatory-audit-norms"));
export const AdminApprovalQueue = lazyWithRetry(() => import("@/pages/admin/approval-queue"));
export const NotificationManagement = lazyWithRetry(() => import("@/pages/admin/notification-management"));
export const FeatureFlags = lazyWithRetry(() => import("@/pages/admin/feature-flags"));
export const ParserConfigPage = lazyWithRetry(() => import("@/pages/admin/parser-config"));
export const AdminESignManagement = lazyWithRetry(() => import("@/pages/admin/esign-management"));
export const ReportBuilder = lazyWithRetry(() => import("@/pages/admin/report-builder"));
export const StakeholdersPage = lazyWithRetry(() => import("@/pages/admin/stakeholders"));
export const KycCompliancePage = lazyWithRetry(() => import("@/pages/admin/kyc-compliance"));
export const KycV2ManagementPage = lazyWithRetry(() => import("@/pages/admin/kyc-v2-management"));
export const FinancialOperationsPage = lazyWithRetry(() => import("@/pages/admin/financial-operations"));
export const APIConfiguration = lazyWithRetry(() => import("@/pages/admin/api-configuration"));
export const ProductionReadiness = lazyWithRetry(() => import("@/pages/admin/production-readiness"));
export const ActivityCentre = lazyWithRetry(() => import("@/pages/admin/activity-centre"));
export const CkycDeferredDashboard = lazyWithRetry(() => import("@/pages/admin/ckyc-deferred-dashboard"));
export const ZohoDashboardPage = lazyWithRetry(() => import("@/pages/admin/zoho-dashboard"));
export const ZohoConnectionsPage = lazyWithRetry(() => import("@/pages/admin/zoho-connections"));
export const ZohoLogsPage = lazyWithRetry(() => import("@/pages/admin/zoho-logs"));
export const ZohoBooksPage = lazyWithRetry(() => import("@/pages/admin/zoho-books"));
export const ZohoImportPage = lazyWithRetry(() => import("@/pages/admin-zoho-import"));
export const AdminProspectDashboard = lazyWithRetry(() => import("@/pages/admin-prospect-dashboard"));
export const GlobalFeeModelAdmin = lazyWithRetry(() => import("@/pages/admin/global-fee-model"));
export const StoreManagement = lazyWithRetry(() => import("@/pages/admin/store-management"));
export const StoreInquiriesAdmin = lazyWithRetry(() => import("@/pages/admin/store-inquiries"));
export const BondSeedAdmin = lazyWithRetry(() => import("@/pages/admin/bond-seed"));
export const MldSeedAdmin = lazyWithRetry(() => import("@/pages/admin/mld-seed"));
export const AifSeedAdmin = lazyWithRetry(() => import("@/pages/admin/aif-seed"));
export const PmsSeedAdmin = lazyWithRetry(() => import("@/pages/admin/pms-seed"));
export const TaxServicesSeed = lazyWithRetry(() => import("@/pages/admin/tax-services-seed"));
export const GoldSeedAdmin = lazyWithRetry(() => import("@/pages/admin/gold-seed"));
export const LoansSeedAdmin = lazyWithRetry(() => import("@/pages/admin/loans-seed"));
export const MutualFundsSeeding = lazyWithRetry(() => import("@/pages/admin/mutual-funds-seeding"));
export const ListedStocksSeed = lazyWithRetry(() => import("@/pages/admin/listed-stocks-seed"));
export const ReitsInvitsSeed = lazyWithRetry(() => import("@/pages/admin/reits-invits-seed"));
export const GiftCityIfscSeed = lazyWithRetry(() => import("@/pages/admin/gift-city-ifsc-seed"));
export const GlobalSeedAdmin = lazyWithRetry(() => import("@/pages/admin/global-seed"));
export const RecommendationProductsAdmin = lazyWithRetry(() => import("@/pages/admin/recommendation-products"));
export const PicksManagement = lazyWithRetry(() => import("@/pages/admin/picks-management"));
export const McaDirectPayments = lazyWithRetry(() => import("@/pages/admin/mca-direct-payments"));
export const McaFinancialBackfill = lazyWithRetry(() => import("@/pages/admin/mca-financial-backfill"));
export const SeedUnlistedPage = lazyWithRetry(() => import("@/pages/admin/seed-unlisted"));
export const UnlistedPreviewPage = lazyWithRetry(() => import("@/pages/admin/unlisted-preview"));
export const UnlistedPricingPreviewPage = lazyWithRetry(() => import("@/pages/admin/unlisted-pricing-preview"));
export const DuplicateManagementPage = lazyWithRetry(() => import("@/pages/admin/duplicate-management"));
export const AdminThemeSettings = lazyWithRetry(() => import("@/pages/admin/theme-settings"));
export const InstitutionalData = lazyWithRetry(() => import("@/pages/admin/institutional-data"));

// ─── Portfolio ────────────────────────────────────────────────────────────────
export const ComprehensivePortfolio = lazyWithRetry(() => import("@/pages/comprehensive-portfolio"));
export const PortfolioGoals = lazyWithRetry(() => import("@/pages/portfolio-goals"));
export const PortfolioRetirement = lazyWithRetry(() => import("@/pages/portfolio-retirement"));
export const PortfolioAIInsights = lazyWithRetry(() => import("@/pages/portfolio-ai-insights"));
export const PortfolioRebalancing = lazyWithRetry(() => import("@/pages/portfolio-rebalancing"));
export const PortfolioImport = lazyWithRetry(() => import("@/pages/portfolio-import"));
export const PortfolioStressTest = lazyWithRetry(() => import("@/pages/portfolio-stress-test"));
export const TrackerPortfolioReport = lazyWithRetry(() => import("@/pages/tracker-portfolio-report"));
export const AIPortfolioReport = lazyWithRetry(() => import("@/pages/ai-portfolio-report"));

// ─── Utility / Legal ─────────────────────────────────────────────────────────
export const DocumentsPage = lazyWithRetry(() => import("@/pages/documents"));
export const BBPSPage = lazyWithRetry(() => import("@/pages/BBPSPage"));
export const DigiLockerPage = lazyWithRetry(() => import("@/pages/DigiLockerPage"));
export const LoanApplication = lazyWithRetry(() => import("@/pages/loan-application"));
export const LoanDashboard = lazyWithRetry(() => import("@/pages/loan-dashboard"));
export const LoanApplyPage = lazyWithRetry(() => import("@/pages/loan-apply"));
export const BrokingPage = lazyWithRetry(() => import("@/pages/broking"));

// ─── Agent / Advisor ─────────────────────────────────────────────────────────
export const AgentPortal = lazyWithRetry(() => import("@/pages/agent-portal"));
export const DistributionPartnerPortal = lazyWithRetry(() => import("@/pages/distribution-partner-portal"));
export const FieldAgentPortal = lazyWithRetry(() => import("@/pages/field-agent-portal"));
export const AgentClientsPage = lazyWithRetry(() => import("@/pages/agent-clients"));
export const AgentUsClientAccounts = lazyWithRetry(() => import("@/pages/agent/us-client-accounts"));
export const AgentCrmClient360 = lazyWithRetry(() => import("@/pages/agent-crm-client-360"));
export const AgentCrmPipeline = lazyWithRetry(() => import("@/pages/agent-crm-pipeline"));
export const AgentCrmTasks = lazyWithRetry(() => import("@/pages/agent-crm-tasks"));
export const AgentCrmAnalytics = lazyWithRetry(() => import("@/pages/agent-crm-analytics"));
export const AgentRecommendationControl = lazyWithRetry(() => import("@/pages/agent-recommendation-control"));
export const AgentTrainingPage = lazyWithRetry(() => import("@/pages/agent-training"));
export const AgentProposalsPage = lazyWithRetry(() => import("@/pages/agent-proposals"));
export const AgentClientAcquisitionPage = lazyWithRetry(() => import("@/pages/agent-client-acquisition"));
export const AgentDerivatives = lazyWithRetry(() => import("@/pages/agent-derivatives"));
export const AgentTaxCasesPage = lazyWithRetry(() => import("@/pages/agent-tax-cases"));
export const AgentKnowledgeHub = lazyWithRetry(() => import("@/pages/agent-knowledge-hub"));
export const AgentKnowledgeMarketBrief = lazyWithRetry(() => import("@/pages/agent-knowledge-market-brief"));
export const FestivalGreetingPreview = lazyWithRetry(() => import("@/pages/agent/festival-greeting-preview"));
export const AgentKnowledgeProducts = lazyWithRetry(() => import("@/pages/agent-knowledge-products"));
export const AgentKnowledgeExplanations = lazyWithRetry(() => import("@/pages/agent-knowledge-explanations"));
export const AgentKnowledgeCertifications = lazyWithRetry(() => import("@/pages/agent-knowledge-certifications"));
export const AgentInvestmentAdvisory = lazyWithRetry(() => import("@/pages/agent-investment-advisory"));
export const AgentBondRecommendations = lazyWithRetry(() => import("@/pages/agent-bond-recommendations"));
export const AgentStockAI = lazyWithRetry(() => import("@/pages/agent-stock-ai"));
export const AgentThemeSettings = lazyWithRetry(() => import("@/pages/agent/theme-settings"));
export const AgentResearchLists = lazyWithRetry(() => import("@/pages/agent-research-lists"));
export const AgentResearchListDetail = lazyWithRetry(() => import("@/pages/agent-research-list-detail"));
export const ResearchNoteGenerator = lazyWithRetry(() => import("@/pages/research-note-generator"));
export const AgentHniLeaderboard = lazyWithRetry(() => import("@/pages/agent-hni-leaderboard"));
export const AgentDealMatcher = lazyWithRetry(() => import("@/pages/agent-deal-matcher"));
export const AgentScreener = lazyWithRetry(() => import("@/pages/agent-screener"));
export const AgentResearchAnalytics = lazyWithRetry(() => import("@/pages/agent-research-analytics"));
export const AgentTreasuryPage = lazyWithRetry(() => import("@/pages/agent-treasury"));
export const AgentRevenueCockpit = lazyWithRetry(() => import("@/pages/agent-revenue-cockpit"));
export const AgentQuantAnalytics = lazyWithRetry(() => import("@/pages/agent-quant-analytics"));
export const AgentLeadPipeline = lazyWithRetry(() => import("@/pages/agent-lead-pipeline"));
export const AgentClientProfile = lazyWithRetry(() => import("@/pages/agent-client-profile"));
export const AgentTasks = lazyWithRetry(() => import("@/pages/agent-tasks"));
export const AgentReportsHub = lazyWithRetry(() => import("@/pages/agent-reports-hub"));
export const AgentDemoProgress = lazyWithRetry(() => import("@/pages/agent-demo-progress"));
export const AgentPortfolioReportBuilder = lazyWithRetry(() => import("@/pages/agent-portfolio-report-builder"));
export const AgentSampleReport = lazyWithRetry(() => import("@/pages/agent-sample-report"));
export const AgentDemoProposalBuilder = lazyWithRetry(() => import("@/pages/agent-demo-proposal-builder"));
export const AgentZohoCRM = lazyWithRetry(() => import("@/pages/agent-zoho-crm"));
export const AgentLeaderboard = lazyWithRetry(() => import("@/pages/agent-leaderboard"));
export const AgentCommissionCalculator = lazyWithRetry(() => import("@/pages/agent-commission-calculator"));
export const AgentBulkCommunication = lazyWithRetry(() => import("@/pages/agent-bulk-communication"));
export const AgentCalendar = lazyWithRetry(() => import("@/pages/agent-calendar"));
export const AgentMeetings = lazyWithRetry(() => import("@/pages/agent-meetings"));
export const AgentESign = lazyWithRetry(() => import("@/pages/agent-esign"));
export const AgentClientOnboarding = lazyWithRetry(() => import("@/pages/agent-client-onboarding"));
export const AgentLoanApply = lazyWithRetry(() => import("@/pages/agent/loan-apply"));
export const AgentLoanApplications = lazyWithRetry(() => import("@/pages/agent/loan-applications"));
export const AgentLoanMarketplace = lazyWithRetry(() => import("@/pages/agent/loan-marketplace"));
export const AgentDSAPerformance = lazyWithRetry(() => import("@/pages/agent/dsa-performance"));
export const AgentPayoutClaims = lazyWithRetry(() => import("@/pages/agent/payout-claims"));
export const AgentRevenueSheet = lazyWithRetry(() => import("@/pages/agent/revenue-sheet"));
export const AgentExternalPortfolios = lazyWithRetry(() => import("@/pages/agent-external-portfolios"));
export const AgentInvestmentBaskets = lazyWithRetry(() => import("@/pages/agent-investment-baskets"));
export const AgentSipHealth = lazyWithRetry(() => import("@/pages/agent-sip-health"));
export const AgentPortfolioDrift = lazyWithRetry(() => import("@/pages/agent-portfolio-drift"));
export const AgentMarketAlerts = lazyWithRetry(() => import("@/pages/agent-market-alerts"));
export const AgentTracker = lazyWithRetry(() => import("@/pages/agent-tracker"));
export const AgentFieldView = lazyWithRetry(() => import("@/pages/agent-field-view"));
export const AgentPerformance = lazyWithRetry(() => import("@/pages/agent-performance"));
export const AlpacaHubAgent = lazyWithRetry(() => import("@/pages/agent/alpaca-hub"));
export const AdvisorBrandProfile = lazyWithRetry(() => import("@/pages/agent/advisor-brand-profile"));

// ─── Partner ──────────────────────────────────────────────────────────────────
export const PartnerRevenueSheet = lazyWithRetry(() => import("@/pages/partner/revenue-sheet"));
export const PartnerMyProfile = lazyWithRetry(() => import("@/pages/partner/my-profile"));
export const PartnerRegister = lazyWithRetry(() => import("@/pages/partner-register"));
export const PartnerAgentDashboard = lazyWithRetry(() => import("@/pages/partner-agent-dashboard"));
export const PartnerCAManagement = lazyWithRetry(() => import("@/pages/partner-ca-management"));
export const PartnerTeamManagement = lazyWithRetry(() => import("@/pages/partner-team-management"));

// ─── Client-Facing ────────────────────────────────────────────────────────────
export const PublicAdvisorProfile = lazyWithRetry(() => import("@/pages/public-advisor-profile"));
export const PublicProfilePage = lazyWithRetry(() => import("@/pages/PublicProfilePage"));
export const AgentProspectProposals = lazyWithRetry(() => import("@/pages/agent-prospect-proposals"));
export const OnboardingPage = lazyWithRetry(() => import("@/pages/onboarding"));
export const AgentKycEmpanelment = lazyWithRetry(() => import("@/pages/agent-kyc-empanelment"));
export const AgentIrisHub = lazyWithRetry(() => import("@/pages/agent-iris-hub"));
export const PublicProposalPage = lazyWithRetry(() => import("@/pages/public-proposal"));
export const ManualKYCPage = lazyWithRetry(() => import("@/pages/manual-kyc"));
export const KycRejectionRekyc = lazyWithRetry(() => import("@/pages/kyc-rejection-rekyc"));
export const KYCProductEligibility = lazyWithRetry(() => import("@/pages/kyc-product-eligibility"));
export const NetWorthPage = lazyWithRetry(() => import("@/pages/net-worth"));
export const AdminProposalsPage = lazyWithRetry(() => import("@/pages/admin-proposals"));
export const ClientProposalsPage = lazyWithRetry(() => import("@/pages/client-proposals"));
export const MyProposalsPage = lazyWithRetry(() => import("@/pages/my-proposals"));
export const ClientSmartProposals = lazyWithRetry(() => import("@/pages/client-smart-proposals"));
export const ClientTasks = lazyWithRetry(() => import("@/pages/client-tasks"));
export const ClientAIRecommendations = lazyWithRetry(() => import("@/pages/client-ai-recommendations"));
export const ClientReports = lazyWithRetry(() => import("@/pages/client-reports"));

// ─── Tax & Compliance ─────────────────────────────────────────────────────────
export const TaxDocuments = lazyWithRetry(() => import("@/pages/tax-documents"));
export const ITRPrefilled = lazyWithRetry(() => import("@/pages/itr-prefilled"));
export const TaxDataCenter = lazyWithRetry(() => import("@/pages/tax-data-center"));
export const TaxSmartFiling = lazyWithRetry(() => import("@/pages/tax-smart-filing"));
export const OneClickTaxFiling = lazyWithRetry(() => import("@/pages/one-click-tax-filing"));
export const TaxITRPage = lazyWithRetry(() => import("@/pages/tax-itr"));
export const TaxITRSelfPage = lazyWithRetry(() => import("@/pages/tax-itr-self"));
export const TaxITRExpertPage = lazyWithRetry(() => import("@/pages/tax-itr-expert"));
export const TaxITRPreviewPage = lazyWithRetry(() => import("@/pages/tax-itr-preview"));
export const TaxITRPaymentPage = lazyWithRetry(() => import("@/pages/tax-itr-payment"));
export const TaxITRVerifyPage = lazyWithRetry(() => import("@/pages/tax-itr-verify"));
export const TaxNoticesPage = lazyWithRetry(() => import("@/pages/tax-notices"));
export const TaxDocumentVaultPage = lazyWithRetry(() => import("@/pages/tax-document-vault"));
export const TaxCADeskPage = lazyWithRetry(() => import("@/pages/tax-ca-desk"));
export const IntelligentTaxHub = lazyWithRetry(() => import("@/pages/intelligent-tax-hub"));
export const TaxReminderSubscription = lazyWithRetry(() => import("@/pages/tax-reminder-subscription"));
export const TDSCompliance = lazyWithRetry(() => import("@/pages/tds-compliance"));
export const TaxComplianceForm15Page = lazyWithRetry(() => import("@/pages/tax-compliance-form15"));
export const TaxLossHarvesting = lazyWithRetry(() => import("@/pages/tax-loss-harvesting"));
export const TaxRegimeComparison = lazyWithRetry(() => import("@/pages/tax-regime-comparison"));
export const ITRTaxServices = lazyWithRetry(() => import("@/pages/itr-tax-services"));

// ─── Investments & Trading ────────────────────────────────────────────────────
export const MLDs = lazyWithRetry(() => import("@/pages/mlds"));
export const ReitInvitPage = lazyWithRetry(() => import("@/pages/reit-invit"));
export const Bonds = lazyWithRetry(() => import("@/pages/bonds"));
export const BondCategoryPage = lazyWithRetry(() => import("@/pages/bond-category"));
export const BondDetailPage = lazyWithRetry(() => import("@/pages/bond-detail"));
export const FixedIncomeMarketplace = lazyWithRetry(() => import("@/pages/fixed-income-marketplace"));
export const DomesticTrading = lazyWithRetry(() => import("@/pages/domestic-trading"));
export const GlobalTrading = lazyWithRetry(() => import("@/pages/global-trading"));
export const GlobalAdvisoryPage = lazyWithRetry(() => import("@/pages/global-advisory"));
export const USTrading = lazyWithRetry(() => import("@/pages/us-trading"));
export const AlpacaClientHub = lazyWithRetry(() => import("@/pages/us-trading/hub"));
export const OpenAccountPage = lazyWithRetry(() => import("@/pages/us-trading/open-account"));
export const AlpacaMarketExplorer = lazyWithRetry(() => import("@/pages/alpaca-market-explorer"));
export const AlpacaHubAdmin = lazyWithRetry(() => import("@/pages/admin/alpaca-hub"));
export const DividendCalendar = lazyWithRetry(() => import("@/pages/dividend-calendar"));
export const DerivativesPage = lazyWithRetry(() => import("@/pages/derivatives"));
export const CommoditiesPage = lazyWithRetry(() => import("@/pages/commodities"));

// ─── Finance & Banking ────────────────────────────────────────────────────────
export const UnifiedCart = lazyWithRetry(() => import("@/pages/unified-cart"));
export const Insurance = lazyWithRetry(() => import("@/pages/insurance"));
export const BankingProducts = lazyWithRetry(() => import("@/pages/banking-products"));
export const FamilyList = lazyWithRetry(() => import("@/pages/family-list"));
export const FamilyDashboard = lazyWithRetry(() => import("@/pages/family-dashboard"));
export const AIChat = lazyWithRetry(() => import("@/pages/ai-chat"));
export const CorporateKYCPage = lazyWithRetry(() => import("@/pages/CorporateKYCPage"));
export const AlertsPage = lazyWithRetry(() => import("@/pages/alerts"));
export const SettingsPage = lazyWithRetry(() => import("@/pages/settings"));
export const BiometricSettingsPage = lazyWithRetry(() => import("@/pages/biometric-settings"));
export const CreditReportPage = lazyWithRetry(() => import("@/pages/credit-report"));
export const CreditCardsPage = lazyWithRetry(() => import("@/pages/credit-cards"));
export const ProfessionalServicesPage = lazyWithRetry(() => import("@/pages/professional-services"));
export const ExpensesBudgets = lazyWithRetry(() => import("@/pages/expenses-budgets"));
export const AutoPopulationDashboard = lazyWithRetry(() => import("@/pages/auto-population-dashboard"));
export const GovernmentSchemes = lazyWithRetry(() => import("@/pages/government-schemes"));
export const ReferralProgram = lazyWithRetry(() => import("@/pages/referral-program"));
export const ScheduledReports = lazyWithRetry(() => import("@/pages/scheduled-reports"));
export const CompoundAlerts = lazyWithRetry(() => import("@/pages/compound-alerts"));
export const DashboardCustomize = lazyWithRetry(() => import("@/pages/dashboard-customize"));
export const ThemeSettings = lazyWithRetry(() => import("@/pages/theme-settings"));
export const PropertyServices = lazyWithRetry(() => import("@/pages/property-services"));
export const LoanComparison = lazyWithRetry(() => import("@/pages/loan-comparison"));
export const LoanRecommendations = lazyWithRetry(() => import("@/pages/loan-recommendations"));
export const PartnerApplication = lazyWithRetry(() => import("@/pages/partner-application"));
export const InvestmentDashboard = lazyWithRetry(() => import("@/pages/investment-dashboard"));
export const NRIServices = lazyWithRetry(() => import("@/pages/nri-services"));
export const NSDLServices2 = NSDLServices; // alias
export const FreshInvestmentDiscovery = lazyWithRetry(() => import("@/pages/fresh-investment-discovery"));
export const NotificationPreferences = lazyWithRetry(() => import("@/pages/notification-preferences"));
export const VideoKYC = lazyWithRetry(() => import("@/pages/video-kyc"));

// ─── AI & Analytics ───────────────────────────────────────────────────────────
export const AIProposalsPage = lazyWithRetry(() => import("@/pages/ai-proposals"));
export const AIProposalReviewPage = lazyWithRetry(() => import("@/pages/ai-proposal-review"));
export const AIStockPicks = lazyWithRetry(() => import("@/pages/agent-picks"));
export const GoalsPage = lazyWithRetry(() => import("@/pages/goals"));
export const InvestableSurplusPage = lazyWithRetry(() => import("@/pages/investable-surplus"));
export const RiskProfilingPage = lazyWithRetry(() => import("@/pages/risk-profiling"));
export const PredictiveAnalytics = lazyWithRetry(() => import("@/pages/PredictiveAnalytics"));

// ─── Admin Unlisted & Bonds ───────────────────────────────────────────────────
export const UnlistedCompaniesAdmin = lazyWithRetry(() => import("@/pages/admin/UnlistedCompaniesAdmin"));
export const UnlistedNegotiations = lazyWithRetry(() => import("@/pages/admin/UnlistedNegotiations"));
export const UnlistedDashboard = lazyWithRetry(() => import("@/pages/admin/unlisted-dashboard"));
export const BondMarketplaceDashboard = lazyWithRetry(() => import("@/pages/admin/bond-marketplace-dashboard"));
export const GlobalAdvisoryManagement = lazyWithRetry(() => import("@/pages/admin/global-advisory-management"));
export const UnlistedOrders = lazyWithRetry(() => import("@/pages/admin/unlisted-orders"));
export const OrderAuditDashboard = lazyWithRetry(() => import("@/pages/admin/order-audit"));
export const UnlistedAuditLog = lazyWithRetry(() => import("@/pages/admin/unlisted-audit-log"));
export const UnlistedComplianceAlerts = lazyWithRetry(() => import("@/pages/admin/unlisted-compliance-alerts"));
export const UnlistedRegulatoryCompliance = lazyWithRetry(() => import("@/pages/admin/unlisted-regulatory-compliance"));
export const FixedIncomeAdmin = lazyWithRetry(() => import("@/pages/admin/FixedIncomeAdmin"));
export const BondCommissionSettings = lazyWithRetry(() => import("@/pages/admin/bond-commission-settings"));
export const CommissionMaster = lazyWithRetry(() => import("@/pages/admin/commission-master"));
export const AdminPartnerHierarchy = lazyWithRetry(() => import("@/pages/admin/partner-hierarchy"));
export const AdminFirmInventory = lazyWithRetry(() => import("@/pages/admin/firm-inventory"));
export const AdminLoanManagement = lazyWithRetry(() => import("@/pages/admin-loan-management"));
export const AdminDsaLoanDashboard = lazyWithRetry(() => import("@/pages/admin/dsa-loan-dashboard"));
export const CommissionLedger = lazyWithRetry(() => import("@/pages/admin/commission-ledger"));
export const EligibilityMatrix = lazyWithRetry(() => import("@/pages/admin/eligibility-matrix"));
export const AdminDLM = lazyWithRetry(() => import("@/pages/admin-dlm"));
export const AdminDLMNegotiate = lazyWithRetry(() => import("@/pages/admin-dlm-negotiate"));
export const AdminStoreManager = lazyWithRetry(() => import("@/pages/admin/store-manager"));

// ─── Unlisted User Pages ──────────────────────────────────────────────────────
export const BrowseUnlisted = lazyWithRetry(() => import("@/pages/unlisted/BrowseUnlisted"));
export const CompanyDetails = lazyWithRetry(() => import("@/pages/unlisted/CompanyDetails"));
export const CreateSellListing = lazyWithRetry(() => import("@/pages/unlisted/CreateSellListing"));
export const CreateBuyRequest = lazyWithRetry(() => import("@/pages/unlisted/CreateBuyRequest"));
export const MyOrders = lazyWithRetry(() => import("@/pages/unlisted/MyOrders"));
export const UnlistedCartPage = lazyWithRetry(() => import("@/pages/unlisted/Cart"));

// ─── CA / Partner Support ─────────────────────────────────────────────────────
export const CASupportDashboard = lazyWithRetry(() => import("@/pages/ca-support-dashboard"));
export const CASupportDetail = lazyWithRetry(() => import("@/pages/ca-support-detail"));
export const CARegistration = lazyWithRetry(() => import("@/pages/ca-registration"));
export const CADashboard = lazyWithRetry(() => import("@/pages/ca-dashboard"));
export const AgentPayoutDashboard = lazyWithRetry(() => import("@/pages/agent-payout-dashboard"));
export const AdminPayoutManagement = lazyWithRetry(() => import("@/pages/admin-payout-management"));
export const AdminMappingRequests = lazyWithRetry(() => import("@/pages/admin-mapping-requests"));
export const AdminAgentPayouts = lazyWithRetry(() => import("@/pages/admin/agent-payouts"));

// ─── Risk & Compliance ────────────────────────────────────────────────────────
export const RiskQuestionnaireBuilder = lazyWithRetry(() => import("@/pages/admin/risk-questionnaire-builder"));
export const RiskComplianceExport = lazyWithRetry(() => import("@/pages/admin/risk-compliance-export"));
export const AdminDatabase = lazyWithRetry(() => import("@/pages/admin/database"));
export const AdminDataProviders = lazyWithRetry(() => import("@/pages/admin/data-providers"));
export const AdminKycFlow = lazyWithRetry(() => import("@/pages/admin-kyc-flow"));
export const ExchangeFilingsAdmin = lazyWithRetry(() => import("@/pages/admin/exchange-filings"));
export const AdminApiUsage = lazyWithRetry(() => import("@/pages/admin-api-usage"));
export const AdminMFEnrichment = lazyWithRetry(() => import("@/pages/admin-mf-enrichment"));
export const AdminMfBenchmarks = lazyWithRetry(() => import("@/pages/admin-mf-benchmarks"));
export const AdminDataEnrichment = lazyWithRetry(() => import("@/pages/admin-data-enrichment"));
export const AdminMasterDsaClaims = lazyWithRetry(() => import("@/pages/admin-master-dsa-claims"));
export const AdminAiRecommendationTracking = lazyWithRetry(() => import("@/pages/admin-ai-recommendation-tracking"));
export const AdminReportsHub = lazyWithRetry(() => import("@/pages/admin/reports-hub"));
export const AdminAIInsights = lazyWithRetry(() => import("@/pages/admin/ai-insights"));
export const AdminAgentOversightPage = lazyWithRetry(() => import("@/pages/admin/agent-oversight"));
export const AdminAppointmentsDashboard = lazyWithRetry(() => import("@/pages/admin/appointments-dashboard"));
export const AdminBrokerDashboard = lazyWithRetry(() => import("@/pages/admin/broker-dashboard"));
export const AdminIrisOverview = lazyWithRetry(() => import("@/pages/admin/iris-overview"));
export const MultibrokerEarnings = lazyWithRetry(() => import("@/pages/admin/multibroker-earnings"));

// ─── Marketing & CRM ─────────────────────────────────────────────────────────
export const MarketingDashboard = lazyWithRetry(() => import("@/pages/admin/marketing-dashboard"));
export const FestivalMarketing = lazyWithRetry(() => import("@/pages/admin/festival-marketing"));
export const EmailCampaigns = lazyWithRetry(() => import("@/pages/admin/email-campaigns"));
export const WhatsAppCampaigns = lazyWithRetry(() => import("@/pages/admin/whatsapp-campaigns"));
export const WhatsAppSetup = lazyWithRetry(() => import("@/pages/admin/whatsapp-setup"));
export const SMSCampaigns = lazyWithRetry(() => import("@/pages/admin/sms-campaigns"));
export const SmsInbox = lazyWithRetry(() => import("@/pages/admin/sms-inbox"));
export const LeadProspecting = lazyWithRetry(() => import("@/pages/admin/lead-prospecting"));
export const McaIntelligence = lazyWithRetry(() => import("@/pages/admin/mca-intelligence"));
export const McaCompanyProfile = lazyWithRetry(() => import("@/pages/admin/mca-company-profile"));
export const ProspectAnalytics = lazyWithRetry(() => import("@/pages/admin/prospect-analytics"));
export const ClientIntelligence = lazyWithRetry(() => import("@/pages/admin/client-intelligence"));
export const MarketingAnalytics = lazyWithRetry(() => import("@/pages/admin/marketing-analytics"));
export const AgentPerformanceDashboard = lazyWithRetry(() => import("@/pages/admin/agent-performance"));
export const DemoProposalsTracking = lazyWithRetry(() => import("@/pages/admin/demo-proposals"));
export const AdminTaskOversight = lazyWithRetry(() => import("@/pages/admin/task-oversight"));
export const UserManagement = lazyWithRetry(() => import("@/pages/admin/user-management"));
export const CAManagement = lazyWithRetry(() => import("@/pages/admin/ca-management"));
export const AgentProspectWizard = lazyWithRetry(() => import("@/pages/agent-prospect-wizard"));

// ─── Admin-Only: Copilot Pages ────────────────────────────────────────────────
export const AdminCopilotHub = lazyWithRetry(() => import("@/pages/admin/copilot/index"));
export const CopilotAuditLogs = lazyWithRetry(() => import("@/pages/admin/copilot/audit-logs"));
export const CopilotBiDashboard = lazyWithRetry(() => import("@/pages/admin/copilot/bi-dashboard"));
export const CopilotBooksFinance = lazyWithRetry(() => import("@/pages/admin/copilot/books-finance"));
export const CopilotComplianceAlerts = lazyWithRetry(() => import("@/pages/admin/copilot/compliance-alerts"));
export const CopilotCrmIntelligence = lazyWithRetry(() => import("@/pages/admin/copilot/crm-intelligence"));
export const CopilotDeskIntelligence = lazyWithRetry(() => import("@/pages/admin/copilot/desk-intelligence"));
export const CopilotEmailIntelligence = lazyWithRetry(() => import("@/pages/admin/copilot/email-intelligence"));
export const CopilotMeetings = lazyWithRetry(() => import("@/pages/admin/copilot/meetings"));
export const CopilotProposalDrafts = lazyWithRetry(() => import("@/pages/admin/copilot/proposal-drafts"));
export const CopilotTaskManager = lazyWithRetry(() => import("@/pages/admin/copilot/task-manager"));

// ─── Miscellaneous ────────────────────────────────────────────────────────────
export const TreasuryDashboard = lazyWithRetry(() => import("@/pages/treasury-dashboard"));
export const AlpacaHubAdminPage = AlpacaHubAdmin; // alias used in admin routes
// NOTE: proposals.tsx is a redirect shim — use wouter <Redirect> instead
export const ProposalsRedirect = lazyWithRetry(() => import("@/pages/proposals"));
// ─── Additional / Previously Missing ─────────────────────────────────────────
export const LandingPage = lazyWithRetry(() => import("@/pages/landing"));
export const PortfolioHoldings = lazyWithRetry(() => import("@/pages/portfolio-holdings"));
