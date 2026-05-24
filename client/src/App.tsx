import { Switch, Route, useLocation, Redirect } from "wouter";
import { Suspense, useEffect } from "react";
import { lazyWithRetry } from "./lib/lazy-with-retry";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GDPRConsent } from "@/components/gdpr-consent";
import { ThemeProvider } from "@/contexts/theme-context";
import { PortalThemeProvider } from "@/components/portal/PortalThemeProvider";
import { LowDataProvider } from "@/contexts/LowDataContext";
import { UnifiedCartProvider } from "@/contexts/UnifiedCartContext";
import { UserPreferencesProvider } from "@/hooks/use-user-preferences";
import { NetworkProvider } from "@/hooks/use-network-state";
import { NetworkStatusBanner } from "@/components/NetworkStatusBanner";
import { UpdateNotificationBanner } from "@/components/UpdateNotificationBanner";
import { VersionCheckModal } from "@/components/VersionCheckModal";
import { DSCBackgroundSync } from "@/components/DSCBackgroundSync";
import { GlobalActionQueueMonitor } from "@/components/GlobalActionQueueMonitor";
import { LoadingState } from "@/components/LoadingState";
import { AdminRoutes } from "@/routes/admin.routes";
import { AgentRoutes } from "@/routes/agent.routes";
import { PartnerRoutes } from "@/routes/partner.routes";
import { UserProtectedRoutes } from "@/routes/user.routes";
const Home = lazyWithRetry(() => import("@/pages/home"));
const Portfolio = lazyWithRetry(() => import("@/pages/portfolio"));
const Markets = lazyWithRetry(() => import("@/pages/markets"));
const IPO = lazyWithRetry(() => import("@/pages/ipo"));
const PreIPO = lazyWithRetry(() => import("@/pages/pre-ipo"));
const MutualFunds = lazyWithRetry(() => import("@/pages/mutual-funds"));
const FundComparison = lazyWithRetry(() => import("@/pages/fund-comparison"));
const PortfolioComparison = lazyWithRetry(() => import("@/pages/portfolio-comparison"));
const Unlisted = lazyWithRetry(() => import("@/pages/unlisted"));
const Loans = lazyWithRetry(() => import("@/pages/loans"));
const NSDLServices = lazyWithRetry(() => import("@/pages/nsdl-services"));
const CDSLServices = lazyWithRetry(() => import("@/pages/cdsl-services"));
const CamsServices = lazyWithRetry(() => import("@/pages/cams-services"));
const KfintechServices = lazyWithRetry(() => import("@/pages/kfintech-services"));
const AgriculturalInsights = lazyWithRetry(() => import("@/pages/agricultural-insights"));
const FinancialCalculators = lazyWithRetry(() => import("@/pages/financial-calculators"));
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
const AdminPanel = lazyWithRetry(() => import("@/pages/admin"));
const TesterDiagnostics = lazyWithRetry(() => import("@/pages/tester-diagnostics"));
const PartnerPortal = lazyWithRetry(() => import("@/pages/partner-portal"));
const Support = lazyWithRetry(() => import("@/pages/support"));
const InvestSmart = lazyWithRetry(() => import("@/pages/wealth-management"));
const Achievements = lazyWithRetry(() => import("@/pages/achievements"));
const CapitalGainsReports = lazyWithRetry(() => import("@/pages/capital-gains-reports"));
const ReportsHub = lazyWithRetry(() => import("@/pages/reports-hub"));
const TransactionReports = lazyWithRetry(() => import("@/pages/transaction-reports"));
const AgentDashboard = lazyWithRetry(() => import("@/pages/agent-dashboard"));
const AgentPicks = lazyWithRetry(() => import("@/pages/agent-picks"));
const IBTradingPage = lazyWithRetry(() => import("@/pages/ib-trading"));
const StorePage = lazyWithRetry(() => import("@/pages/store"));
const GiftCity = lazyWithRetry(() => import("@/pages/gift-city"));
const Cart = lazyWithRetry(() => import("@/pages/cart"));
const Orders = lazyWithRetry(() => import("@/pages/orders"));
const ApiMonitorDemo = lazyWithRetry(() => import("@/pages/api-monitor-demo"));
const ICICILoans = lazyWithRetry(() => import("@/pages/icici-loans"));
const HDFCLoans = lazyWithRetry(() => import("@/pages/hdfc-loans"));
const ClientAutoPopulate = lazyWithRetry(() => import("@/pages/client-auto-populate"));
const Privacy = lazyWithRetry(() => import("@/pages/privacy"));
const Terms = lazyWithRetry(() => import("@/pages/terms"));
const RefundPolicy = lazyWithRetry(() => import("@/pages/refund-policy"));
const PricingPage = lazyWithRetry(() => import("@/pages/pricing"));
const InvestmentDisclaimer = lazyWithRetry(() => import("@/pages/disclaimer"));
const ExcelAddin = lazyWithRetry(() => import("@/pages/excel-addin"));
const AIF = lazyWithRetry(() => import("@/pages/aif"));
const AIFDetail = lazyWithRetry(() => import("@/pages/aif-detail"));
const PMS = lazyWithRetry(() => import("@/pages/pms"));
const PMSDetail = lazyWithRetry(() => import("@/pages/pms-detail"));
const AlternativeInvestments = lazyWithRetry(() => import("@/pages/alternative-investments"));
const MldStore = lazyWithRetry(() => import("@/pages/mld-store"));
const MldDetail = lazyWithRetry(() => import("@/pages/mld-detail"));
const BajajFinance = lazyWithRetry(() => import("@/pages/bajaj-finance"));
const TataCapital = lazyWithRetry(() => import("@/pages/tata-capital"));
const PolicyBazaar = lazyWithRetry(() => import("@/pages/policybazaar"));
const Cibil = lazyWithRetry(() => import("@/pages/cibil"));
const Contact = lazyWithRetry(() => import("@/pages/contact"));
const SupplierManagement = lazyWithRetry(() => import("@/pages/supplier-management").then(m => ({ default: m.SupplierManagement })));
const Profile = lazyWithRetry(() => import("@/pages/profile"));
import ProfileCompletionGuard from "@/components/ProfileCompletionGuard";
import { AppLayout } from "@/components/layout/app-layout";
import { AdminLayout } from "@/components/layout/admin-layout";
import { AgentLayout } from "@/components/layout/agent-layout";
import { PartnerLayout } from "@/components/layout/partner-layout";
import { LayoutResolver } from "@/components/layout/LayoutResolver";
import { useSubdomain } from "@/hooks/useSubdomain";
import { useAuth } from "@/hooks/useAuth";
import { IdleTimeoutManager } from "@/components/IdleTimeoutManager";
import { UniversalKYCWall } from "@/components/UniversalKYCWall";
const AdminDashboard = lazyWithRetry(() => import("@/pages/admin/dashboard"));
const GoldenPricingDashboard = lazyWithRetry(() => import("@/pages/admin/golden-pricing-dashboard"));
const SystemHealthMonitor = lazyWithRetry(() => import("@/pages/admin/system-health"));
const EngineHealthCheck = lazyWithRetry(() => import("@/pages/admin/engine-health-check"));
const MFAnalyticsOps = lazyWithRetry(() => import("@/pages/admin/mf-analytics-ops"));
const RevenueAnalytics = lazyWithRetry(() => import("@/pages/admin/revenue-analytics"));
const UserActivityTimeline = lazyWithRetry(() => import("@/pages/admin/user-activity-timeline"));
const BulkOperations = lazyWithRetry(() => import("@/pages/admin/bulk-operations"));
const ComplianceDashboardPage = lazyWithRetry(() => import("@/pages/admin/compliance-dashboard"));
const SEBIMFCompliance = lazyWithRetry(() => import("@/pages/admin/sebi-mf-compliance"));
const RegulatoryAuditNormsPage = lazyWithRetry(() => import("@/pages/admin/regulatory-audit-norms"));
const AdminApprovalQueue = lazyWithRetry(() => import("@/pages/admin/approval-queue"));
const NotificationManagement = lazyWithRetry(() => import("@/pages/admin/notification-management"));
const FeatureFlags = lazyWithRetry(() => import("@/pages/admin/feature-flags"));
const ParserConfigPage = lazyWithRetry(() => import("@/pages/admin/parser-config"));
const AdminESignManagement = lazyWithRetry(() => import("@/pages/admin/esign-management"));
const ReportBuilder = lazyWithRetry(() => import("@/pages/admin/report-builder"));
const StakeholdersPage = lazyWithRetry(() => import("@/pages/admin/stakeholders"));
const KycCompliancePage = lazyWithRetry(() => import("@/pages/admin/kyc-compliance"));
const KycV2ManagementPage = lazyWithRetry(() => import("@/pages/admin/kyc-v2-management"));
const FinancialOperationsPage = lazyWithRetry(() => import("@/pages/admin/financial-operations"));
const APIConfiguration = lazyWithRetry(() => import("@/pages/admin/api-configuration"));
const ProductionReadiness = lazyWithRetry(() => import("@/pages/admin/production-readiness"));

const ActivityCentre = lazyWithRetry(() => import("@/pages/admin/activity-centre"));
const CkycDeferredDashboard = lazyWithRetry(() => import("@/pages/admin/ckyc-deferred-dashboard"));
const ZohoDashboardPage = lazyWithRetry(() => import("@/pages/admin/zoho-dashboard"));
const ZohoConnectionsPage = lazyWithRetry(() => import("@/pages/admin/zoho-connections"));
const ZohoLogsPage = lazyWithRetry(() => import("@/pages/admin/zoho-logs"));
const ZohoBooksPage = lazyWithRetry(() => import("@/pages/admin/zoho-books"));
const ZohoImportPage = lazyWithRetry(() => import("@/pages/admin-zoho-import"));
const AdminProspectDashboard = lazyWithRetry(() => import("@/pages/admin-prospect-dashboard"));
const GlobalFeeModelAdmin = lazyWithRetry(() => import("@/pages/admin/global-fee-model"));
const StoreManagement = lazyWithRetry(() => import("@/pages/admin/store-management"));
const StoreInquiriesAdmin = lazyWithRetry(() => import("@/pages/admin/store-inquiries"));
const BondSeedAdmin = lazyWithRetry(() => import("@/pages/admin/bond-seed"));
const MldSeedAdmin = lazyWithRetry(() => import("@/pages/admin/mld-seed"));
const AifSeedAdmin = lazyWithRetry(() => import("@/pages/admin/aif-seed"));
const PmsSeedAdmin = lazyWithRetry(() => import("@/pages/admin/pms-seed"));
const TaxServicesSeed = lazyWithRetry(() => import("@/pages/admin/tax-services-seed"));
const GoldSeedAdmin = lazyWithRetry(() => import("@/pages/admin/gold-seed"));
const LoansSeedAdmin = lazyWithRetry(() => import("@/pages/admin/loans-seed"));
const MutualFundsSeeding = lazyWithRetry(() => import("@/pages/admin/mutual-funds-seeding"));
const ListedStocksSeed = lazyWithRetry(() => import("@/pages/admin/listed-stocks-seed"));
const ReitsInvitsSeed = lazyWithRetry(() => import("@/pages/admin/reits-invits-seed"));
const GiftCityIfscSeed = lazyWithRetry(() => import("@/pages/admin/gift-city-ifsc-seed"));
const GlobalSeedAdmin = lazyWithRetry(() => import("@/pages/admin/global-seed"));
const RecommendationProductsAdmin = lazyWithRetry(() => import("@/pages/admin/recommendation-products"));
const PicksManagement = lazyWithRetry(() => import("@/pages/admin/picks-management"));
const McaDirectPayments = lazyWithRetry(() => import("@/pages/admin/mca-direct-payments"));
const McaFinancialBackfill = lazyWithRetry(() => import("@/pages/admin/mca-financial-backfill"));
const SeedUnlistedPage = lazyWithRetry(() => import("@/pages/admin/seed-unlisted"));
const UnlistedPreviewPage = lazyWithRetry(() => import("@/pages/admin/unlisted-preview"));
const UnlistedPricingPreviewPage = lazyWithRetry(() => import("@/pages/admin/unlisted-pricing-preview"));
const DuplicateManagementPage = lazyWithRetry(() => import("@/pages/admin/duplicate-management"));
const AdminThemeSettings = lazyWithRetry(() => import("@/pages/admin/theme-settings"));
const InstitutionalData = lazyWithRetry(() => import("@/pages/admin/institutional-data"));
const ComprehensivePortfolio = lazyWithRetry(() => import("@/pages/comprehensive-portfolio"));
const DocumentsPage = lazyWithRetry(() => import("@/pages/documents"));
const BBPSPage = lazyWithRetry(() => import("@/pages/BBPSPage"));
const DigiLockerPage = lazyWithRetry(() => import("@/pages/DigiLockerPage"));
const LoanApplication = lazyWithRetry(() => import("@/pages/loan-application"));
const LoanDashboard = lazyWithRetry(() => import("@/pages/loan-dashboard"));
const LoanApplyPage = lazyWithRetry(() => import("@/pages/loan-apply"));
const ProposalsPage = lazyWithRetry(() => import("@/pages/proposals"));
const BrokingPage = lazyWithRetry(() => import("@/pages/broking"));
const AgentPortal = lazyWithRetry(() => import("@/pages/agent-portal"));
const DistributionPartnerPortal = lazyWithRetry(() => import("@/pages/distribution-partner-portal"));
const FieldAgentPortal = lazyWithRetry(() => import("@/pages/field-agent-portal"));
const AgentClientsPage = lazyWithRetry(() => import("@/pages/agent-clients"));
const AgentUsClientAccounts = lazyWithRetry(() => import("@/pages/agent/us-client-accounts"));
const AgentCrmClient360 = lazyWithRetry(() => import("@/pages/agent-crm-client-360"));
const AgentCrmPipeline = lazyWithRetry(() => import("@/pages/agent-crm-pipeline"));
const AgentCrmTasks = lazyWithRetry(() => import("@/pages/agent-crm-tasks"));
const AgentCrmAnalytics = lazyWithRetry(() => import("@/pages/agent-crm-analytics"));
const AgentRecommendationControl = lazyWithRetry(() => import("@/pages/agent-recommendation-control"));
const AgentTrainingPage = lazyWithRetry(() => import("@/pages/agent-training"));
const AgentProposalsPage = lazyWithRetry(() => import("@/pages/agent-proposals"));
const AgentClientAcquisitionPage = lazyWithRetry(() => import("@/pages/agent-client-acquisition"));
const AgentDerivatives = lazyWithRetry(() => import("@/pages/agent-derivatives"));
const AgentTaxCasesPage = lazyWithRetry(() => import("@/pages/agent-tax-cases"));
const AgentKnowledgeHub = lazyWithRetry(() => import("@/pages/agent-knowledge-hub"));
const AgentKnowledgeMarketBrief = lazyWithRetry(() => import("@/pages/agent-knowledge-market-brief"));
const FestivalGreetingPreview = lazyWithRetry(() => import("@/pages/agent/festival-greeting-preview"));
const AgentKnowledgeProducts = lazyWithRetry(() => import("@/pages/agent-knowledge-products"));
const AgentKnowledgeExplanations = lazyWithRetry(() => import("@/pages/agent-knowledge-explanations"));
const AgentKnowledgeCertifications = lazyWithRetry(() => import("@/pages/agent-knowledge-certifications"));
const AgentInvestmentAdvisory = lazyWithRetry(() => import("@/pages/agent-investment-advisory"));
const AgentBondRecommendations = lazyWithRetry(() => import("@/pages/agent-bond-recommendations"));
const AgentStockAI = lazyWithRetry(() => import("@/pages/agent-stock-ai"));
const AgentThemeSettings = lazyWithRetry(() => import("@/pages/agent/theme-settings"));
const AgentResearchLists = lazyWithRetry(() => import("@/pages/agent-research-lists"));
const AgentResearchListDetail = lazyWithRetry(() => import("@/pages/agent-research-list-detail"));
const ResearchNoteGenerator = lazyWithRetry(() => import("@/pages/research-note-generator"));
const AgentHniLeaderboard = lazyWithRetry(() => import("@/pages/agent-hni-leaderboard"));
const AgentDealMatcher = lazyWithRetry(() => import("@/pages/agent-deal-matcher"));
const AgentScreener = lazyWithRetry(() => import("@/pages/agent-screener"));
const AgentResearchAnalytics = lazyWithRetry(() => import("@/pages/agent-research-analytics"));
const AgentTreasuryPage = lazyWithRetry(() => import("@/pages/agent-treasury"));
const AgentRevenueCockpit = lazyWithRetry(() => import("@/pages/agent-revenue-cockpit"));
const AgentQuantAnalytics = lazyWithRetry(() => import("@/pages/agent-quant-analytics"));
const AgentLeadPipeline = lazyWithRetry(() => import("@/pages/agent-lead-pipeline"));
const AgentClientProfile = lazyWithRetry(() => import("@/pages/agent-client-profile"));
const AgentTasks = lazyWithRetry(() => import("@/pages/agent-tasks"));
const AgentReportsHub = lazyWithRetry(() => import("@/pages/agent-reports-hub"));
const AgentDemoProgress = lazyWithRetry(() => import("@/pages/agent-demo-progress"));
const AgentPortfolioReportBuilder = lazyWithRetry(() => import("@/pages/agent-portfolio-report-builder"));
const AgentSampleReport = lazyWithRetry(() => import("@/pages/agent-sample-report"));
const AgentDemoProposalBuilder = lazyWithRetry(() => import("@/pages/agent-demo-proposal-builder"));
const AgentZohoCRM = lazyWithRetry(() => import("@/pages/agent-zoho-crm"));
const AgentLeaderboard = lazyWithRetry(() => import("@/pages/agent-leaderboard"));
const AgentCommissionCalculator = lazyWithRetry(() => import("@/pages/agent-commission-calculator"));
const AgentBulkCommunication = lazyWithRetry(() => import("@/pages/agent-bulk-communication"));
const AgentCalendar = lazyWithRetry(() => import("@/pages/agent-calendar"));
const AgentMeetings = lazyWithRetry(() => import("@/pages/agent-meetings"));
const AgentESign = lazyWithRetry(() => import("@/pages/agent-esign"));
const AgentClientOnboarding = lazyWithRetry(() => import("@/pages/agent-client-onboarding"));
const AgentLoanApply = lazyWithRetry(() => import("@/pages/agent/loan-apply"));
const AgentLoanApplications = lazyWithRetry(() => import("@/pages/agent/loan-applications"));
const AgentLoanMarketplace = lazyWithRetry(() => import("@/pages/agent/loan-marketplace"));
const AgentDSAPerformance = lazyWithRetry(() => import("@/pages/agent/dsa-performance"));
const AgentPayoutClaims = lazyWithRetry(() => import("@/pages/agent/payout-claims"));
const AgentRevenueSheet = lazyWithRetry(() => import("@/pages/agent/revenue-sheet"));
const PartnerRevenueSheet = lazyWithRetry(() => import("@/pages/partner/revenue-sheet"));
const PartnerMyProfile = lazyWithRetry(() => import("@/pages/partner/my-profile"));
const PartnerRegister = lazyWithRetry(() => import("@/pages/partner-register"));
const AdvisorBrandProfile = lazyWithRetry(() => import("@/pages/agent/advisor-brand-profile"));
const PublicAdvisorProfile = lazyWithRetry(() => import("@/pages/public-advisor-profile"));
const AdminAgentPayouts = lazyWithRetry(() => import("@/pages/admin/agent-payouts"));
const AgentProspectProposals = lazyWithRetry(() => import("@/pages/agent-prospect-proposals"));
const OnboardingPage = lazyWithRetry(() => import("@/pages/onboarding"));
const AgentKycEmpanelment = lazyWithRetry(() => import("@/pages/agent-kyc-empanelment"));
const AgentIrisHub = lazyWithRetry(() => import("@/pages/agent-iris-hub"));
const PublicProposalPage = lazyWithRetry(() => import("@/pages/public-proposal"));
const LandingPage = lazyWithRetry(() => import("@/pages/landing"));
const ManualKYCPage = lazyWithRetry(() => import("@/pages/manual-kyc"));
const KycRejectionRekyc = lazyWithRetry(() => import("@/pages/kyc-rejection-rekyc"));
const KYCProductEligibility = lazyWithRetry(() => import("@/pages/kyc-product-eligibility"));
const NetWorthPage = lazyWithRetry(() => import("@/pages/net-worth"));
const AdminProposalsPage = lazyWithRetry(() => import("@/pages/admin-proposals"));
const ClientProposalsPage = lazyWithRetry(() => import("@/pages/client-proposals"));
const MyProposalsPage = lazyWithRetry(() => import("@/pages/my-proposals"));
const ClientSmartProposals = lazyWithRetry(() => import("@/pages/client-smart-proposals"));
const TaxDocuments = lazyWithRetry(() => import("@/pages/tax-documents"));
const ITRPrefilled = lazyWithRetry(() => import("@/pages/itr-prefilled"));
const TaxDataCenter = lazyWithRetry(() => import("@/pages/tax-data-center"));
const TaxSmartFiling = lazyWithRetry(() => import("@/pages/tax-smart-filing"));
const OneClickTaxFiling = lazyWithRetry(() => import("@/pages/one-click-tax-filing"));
const TaxITRPage = lazyWithRetry(() => import("@/pages/tax-itr"));
const TaxITRSelfPage = lazyWithRetry(() => import("@/pages/tax-itr-self"));
const TaxITRExpertPage = lazyWithRetry(() => import("@/pages/tax-itr-expert"));
const TaxITRPreviewPage = lazyWithRetry(() => import("@/pages/tax-itr-preview"));
const TaxITRPaymentPage = lazyWithRetry(() => import("@/pages/tax-itr-payment"));
const TaxITRVerifyPage = lazyWithRetry(() => import("@/pages/tax-itr-verify"));
const TaxNoticesPage = lazyWithRetry(() => import("@/pages/tax-notices"));
const TaxDocumentVaultPage = lazyWithRetry(() => import("@/pages/tax-document-vault"));
const TaxCADeskPage = lazyWithRetry(() => import("@/pages/tax-ca-desk"));
const PropertyServices = lazyWithRetry(() => import("@/pages/property-services"));
const LoanComparison = lazyWithRetry(() => import("@/pages/loan-comparison"));
const LoanRecommendations = lazyWithRetry(() => import("@/pages/loan-recommendations"));
const PartnerApplication = lazyWithRetry(() => import("@/pages/partner-application"));
const InvestmentDashboard = lazyWithRetry(() => import("@/pages/investment-dashboard"));
const NRIServices = lazyWithRetry(() => import("@/pages/nri-services"));
const ITRTaxServices = lazyWithRetry(() => import("@/pages/itr-tax-services"));
const DomesticTrading = lazyWithRetry(() => import("@/pages/domestic-trading"));
const GlobalTrading = lazyWithRetry(() => import("@/pages/global-trading"));
const GlobalAdvisoryPage = lazyWithRetry(() => import("@/pages/global-advisory"));
const USTrading = lazyWithRetry(() => import("@/pages/us-trading"));
const AlpacaClientHub = lazyWithRetry(() => import("@/pages/us-trading/hub"));
const IntelligentTaxHub = lazyWithRetry(() => import("@/pages/intelligent-tax-hub"));
const TaxReminderSubscription = lazyWithRetry(() => import("@/pages/tax-reminder-subscription"));
const MLDs = lazyWithRetry(() => import("@/pages/mlds"));
const UnifiedCart = lazyWithRetry(() => import("@/pages/unified-cart"));
const Insurance = lazyWithRetry(() => import("@/pages/insurance"));
const BankingProducts = lazyWithRetry(() => import("@/pages/banking-products"));
const Bonds = lazyWithRetry(() => import("@/pages/bonds"));
const BondCategoryPage = lazyWithRetry(() => import("@/pages/bond-category"));
const BondDetailPage = lazyWithRetry(() => import("@/pages/bond-detail"));
const FixedIncomeMarketplace = lazyWithRetry(() => import("@/pages/fixed-income-marketplace"));
const FamilyList = lazyWithRetry(() => import("@/pages/family-list"));
const FamilyDashboard = lazyWithRetry(() => import("@/pages/family-dashboard"));
const AIChat = lazyWithRetry(() => import("@/pages/ai-chat"));
const CorporateKYCPage = lazyWithRetry(() => import("@/pages/CorporateKYCPage"));
const AlertsPage = lazyWithRetry(() => import("@/pages/alerts"));
const SettingsPage = lazyWithRetry(() => import("@/pages/settings"));
const BiometricSettingsPage = lazyWithRetry(() => import("@/pages/biometric-settings"));
const CreditReportPage = lazyWithRetry(() => import("@/pages/credit-report"));
const DerivativesPage = lazyWithRetry(() => import("@/pages/derivatives"));
const CommoditiesPage = lazyWithRetry(() => import("@/pages/commodities"));
const CreditCardsPage = lazyWithRetry(() => import("@/pages/credit-cards"));
const ProfessionalServicesPage = lazyWithRetry(() => import("@/pages/professional-services"));
const ExpensesBudgets = lazyWithRetry(() => import("@/pages/expenses-budgets"));
const AutoPopulationDashboard = lazyWithRetry(() => import("@/pages/auto-population-dashboard"));
const GovernmentSchemes = lazyWithRetry(() => import("@/pages/government-schemes"));
const ReferralProgram = lazyWithRetry(() => import("@/pages/referral-program"));
const ScheduledReports = lazyWithRetry(() => import("@/pages/scheduled-reports"));
const CompoundAlerts = lazyWithRetry(() => import("@/pages/compound-alerts"));
const DashboardCustomize = lazyWithRetry(() => import("@/pages/dashboard-customize"));
const ThemeSettings = lazyWithRetry(() => import("@/pages/theme-settings"));
const AgentProspectWizard = lazyWithRetry(() => import("@/pages/agent-prospect-wizard"));
const MarketingDashboard = lazyWithRetry(() => import("@/pages/admin/marketing-dashboard"));
const FestivalMarketing = lazyWithRetry(() => import("@/pages/admin/festival-marketing"));
const EmailCampaigns = lazyWithRetry(() => import("@/pages/admin/email-campaigns"));
const WhatsAppCampaigns = lazyWithRetry(() => import("@/pages/admin/whatsapp-campaigns"));
const WhatsAppSetup = lazyWithRetry(() => import("@/pages/admin/whatsapp-setup"));
const SMSCampaigns = lazyWithRetry(() => import("@/pages/admin/sms-campaigns"));
const SmsInbox = lazyWithRetry(() => import("@/pages/admin/sms-inbox"));
const LeadProspecting = lazyWithRetry(() => import("@/pages/admin/lead-prospecting"));
const McaIntelligence = lazyWithRetry(() => import("@/pages/admin/mca-intelligence"));
const McaCompanyProfile = lazyWithRetry(() => import("@/pages/admin/mca-company-profile"));
const ProspectAnalytics = lazyWithRetry(() => import("@/pages/admin/prospect-analytics"));
const ClientIntelligence = lazyWithRetry(() => import("@/pages/admin/client-intelligence"));
const MarketingAnalytics = lazyWithRetry(() => import("@/pages/admin/marketing-analytics"));
const AgentPerformanceDashboard = lazyWithRetry(() => import("@/pages/admin/agent-performance"));
const DemoProposalsTracking = lazyWithRetry(() => import("@/pages/admin/demo-proposals"));
const AdminTaskOversight = lazyWithRetry(() => import("@/pages/admin/task-oversight"));
const UserManagement = lazyWithRetry(() => import("@/pages/admin/user-management"));
const CAManagement = lazyWithRetry(() => import("@/pages/admin/ca-management"));
const PredictiveAnalytics = lazyWithRetry(() => import("@/pages/PredictiveAnalytics"));
const UnlistedCompaniesAdmin = lazyWithRetry(() => import("@/pages/admin/UnlistedCompaniesAdmin"));
const UnlistedNegotiations = lazyWithRetry(() => import("@/pages/admin/UnlistedNegotiations"));
const UnlistedDashboard = lazyWithRetry(() => import("@/pages/admin/unlisted-dashboard"));
const BondMarketplaceDashboard = lazyWithRetry(() => import("@/pages/admin/bond-marketplace-dashboard"));
const GlobalAdvisoryManagement = lazyWithRetry(() => import("@/pages/admin/global-advisory-management"));
const UnlistedOrders = lazyWithRetry(() => import("@/pages/admin/unlisted-orders"));
const OrderAuditDashboard = lazyWithRetry(() => import("@/pages/admin/order-audit"));
const UnlistedAuditLog = lazyWithRetry(() => import("@/pages/admin/unlisted-audit-log"));
const UnlistedComplianceAlerts = lazyWithRetry(() => import("@/pages/admin/unlisted-compliance-alerts"));
const UnlistedRegulatoryCompliance = lazyWithRetry(() => import("@/pages/admin/unlisted-regulatory-compliance"));
const FixedIncomeAdmin = lazyWithRetry(() => import("@/pages/admin/FixedIncomeAdmin"));
const BondCommissionSettings = lazyWithRetry(() => import("@/pages/admin/bond-commission-settings"));
const CommissionMaster = lazyWithRetry(() => import("@/pages/admin/commission-master"));
const AdminPartnerHierarchy = lazyWithRetry(() => import("@/pages/admin/partner-hierarchy"));
const AdminFirmInventory = lazyWithRetry(() => import("@/pages/admin/firm-inventory"));
const AdminLoanManagement = lazyWithRetry(() => import("@/pages/admin-loan-management"));
const AdminDsaLoanDashboard = lazyWithRetry(() => import("@/pages/admin/dsa-loan-dashboard"));
const CommissionLedger = lazyWithRetry(() => import("@/pages/admin/commission-ledger"));
const EligibilityMatrix = lazyWithRetry(() => import("@/pages/admin/eligibility-matrix"));
const AdminDLM = lazyWithRetry(() => import("@/pages/admin-dlm"));
const AdminDLMNegotiate = lazyWithRetry(() => import("@/pages/admin-dlm-negotiate"));
const AdminStoreManager = lazyWithRetry(() => import("@/pages/admin/store-manager"));
const BrowseUnlisted = lazyWithRetry(() => import("@/pages/unlisted/BrowseUnlisted"));
const CompanyDetails = lazyWithRetry(() => import("@/pages/unlisted/CompanyDetails"));
const CreateSellListing = lazyWithRetry(() => import("@/pages/unlisted/CreateSellListing"));
const CreateBuyRequest = lazyWithRetry(() => import("@/pages/unlisted/CreateBuyRequest"));
const MyOrders = lazyWithRetry(() => import("@/pages/unlisted/MyOrders"));
const UnlistedCartPage = lazyWithRetry(() => import("@/pages/unlisted/Cart"));
const CASupportDashboard = lazyWithRetry(() => import("@/pages/ca-support-dashboard"));
const CASupportDetail = lazyWithRetry(() => import("@/pages/ca-support-detail"));
const CARegistration = lazyWithRetry(() => import("@/pages/ca-registration"));
const CADashboard = lazyWithRetry(() => import("@/pages/ca-dashboard"));
const PartnerAgentDashboard = lazyWithRetry(() => import("@/pages/partner-agent-dashboard"));
const PartnerCAManagement = lazyWithRetry(() => import("@/pages/partner-ca-management"));
const PartnerTeamManagement = lazyWithRetry(() => import("@/pages/partner-team-management"));
const AgentPayoutDashboard = lazyWithRetry(() => import("@/pages/agent-payout-dashboard"));
const AdminPayoutManagement = lazyWithRetry(() => import("@/pages/admin-payout-management"));
const AdminMappingRequests = lazyWithRetry(() => import("@/pages/admin-mapping-requests"));
const FreshInvestmentDiscovery = lazyWithRetry(() => import("@/pages/fresh-investment-discovery"));
const TDSCompliance = lazyWithRetry(() => import("@/pages/tds-compliance"));
const AIProposalsPage = lazyWithRetry(() => import("@/pages/ai-proposals"));
const AIProposalReviewPage = lazyWithRetry(() => import("@/pages/ai-proposal-review"));
const AIStockPicks = lazyWithRetry(() => import("@/pages/agent-picks"));
const GoalsPage = lazyWithRetry(() => import("@/pages/goals"));
const InvestableSurplusPage = lazyWithRetry(() => import("@/pages/investable-surplus"));
const TaxComplianceForm15Page = lazyWithRetry(() => import("@/pages/tax-compliance-form15"));
const RiskProfilingPage = lazyWithRetry(() => import("@/pages/risk-profiling"));
const RiskQuestionnaireBuilder = lazyWithRetry(() => import("@/pages/admin/risk-questionnaire-builder"));
const RiskComplianceExport = lazyWithRetry(() => import("@/pages/admin/risk-compliance-export"));
const AdminDatabase = lazyWithRetry(() => import("@/pages/admin/database"));
const AdminDataProviders = lazyWithRetry(() => import("@/pages/admin/data-providers"));
const AdminKycFlow = lazyWithRetry(() => import("@/pages/admin-kyc-flow"));
const ExchangeFilingsAdmin = lazyWithRetry(() => import("@/pages/admin/exchange-filings"));
const AdminApiUsage = lazyWithRetry(() => import("@/pages/admin-api-usage"));
const AdminMFEnrichment = lazyWithRetry(() => import("@/pages/admin-mf-enrichment"));
const AdminMfBenchmarks = lazyWithRetry(() => import("@/pages/admin-mf-benchmarks"));
const AdminDataEnrichment = lazyWithRetry(() => import("@/pages/admin-data-enrichment"));
const AdminMasterDsaClaims = lazyWithRetry(() => import("@/pages/admin-master-dsa-claims"));
const AdminAiRecommendationTracking = lazyWithRetry(() => import("@/pages/admin-ai-recommendation-tracking"));
const AdminReportsHub = lazyWithRetry(() => import("@/pages/admin/reports-hub"));
const AdminAIInsights = lazyWithRetry(() => import("@/pages/admin/ai-insights"));
const AdminAgentOversightPage = lazyWithRetry(() => import("@/pages/admin/agent-oversight"));
const AdminAppointmentsDashboard = lazyWithRetry(() => import("@/pages/admin/appointments-dashboard"));
const AdminBrokerDashboard = lazyWithRetry(() => import("@/pages/admin/broker-dashboard"));
const AlpacaHubAdmin = lazyWithRetry(() => import("@/pages/admin/alpaca-hub"));
const AlpacaHubAgent = lazyWithRetry(() => import("@/pages/agent/alpaca-hub"));
const AdminIrisOverview = lazyWithRetry(() => import("@/pages/admin/iris-overview"));
const OpenAccountPage = lazyWithRetry(() => import("@/pages/us-trading/open-account"));
const ClientTasks = lazyWithRetry(() => import("@/pages/client-tasks"));
const ClientAIRecommendations = lazyWithRetry(() => import("@/pages/client-ai-recommendations"));
const ClientReports = lazyWithRetry(() => import("@/pages/client-reports"));
const ReitInvitPage = lazyWithRetry(() => import("@/pages/reit-invit"));
const VideoKYC = lazyWithRetry(() => import("@/pages/video-kyc"));
const PortfolioStressTest = lazyWithRetry(() => import("@/pages/portfolio-stress-test"));
const DividendCalendar = lazyWithRetry(() => import("@/pages/dividend-calendar"));
const TaxLossHarvesting = lazyWithRetry(() => import("@/pages/tax-loss-harvesting"));
const TaxRegimeComparison = lazyWithRetry(() => import("@/pages/tax-regime-comparison"));
const AgentFieldView = lazyWithRetry(() => import("@/pages/agent-field-view"));
const AgentPerformance = lazyWithRetry(() => import("@/pages/agent-performance"));
const NotificationPreferences = lazyWithRetry(() => import("@/pages/notification-preferences"));
const AIPortfolioReport = lazyWithRetry(() => import("@/pages/ai-portfolio-report"));
const PortfolioHoldings = lazyWithRetry(() => import("@/pages/portfolio-holdings"));
const PortfolioGoals = lazyWithRetry(() => import("@/pages/portfolio-goals"));
const PortfolioRetirement = lazyWithRetry(() => import("@/pages/portfolio-retirement"));
const PortfolioAIInsights = lazyWithRetry(() => import("@/pages/portfolio-ai-insights"));
const PortfolioRebalancing = lazyWithRetry(() => import("@/pages/portfolio-rebalancing"));
const PortfolioImport = lazyWithRetry(() => import("@/pages/portfolio-import"));
const TrackerPortfolioReport = lazyWithRetry(() => import("@/pages/tracker-portfolio-report"));
const AgentExternalPortfolios = lazyWithRetry(() => import("@/pages/agent-external-portfolios"));
const AgentInvestmentBaskets = lazyWithRetry(() => import("@/pages/agent-investment-baskets"));
const AgentSipHealth = lazyWithRetry(() => import("@/pages/agent-sip-health"));
const AgentPortfolioDrift = lazyWithRetry(() => import("@/pages/agent-portfolio-drift"));
const AgentMarketAlerts = lazyWithRetry(() => import("@/pages/agent-market-alerts"));
const PublicProfilePage = lazyWithRetry(() => import("@/pages/PublicProfilePage"));
const AgentTracker = lazyWithRetry(() => import("@/pages/agent-tracker"));
const AlpacaMarketExplorer = lazyWithRetry(() => import("@/pages/alpaca-market-explorer"));


const TreasuryDashboard = lazyWithRetry(() => import("@/pages/treasury-dashboard"));

function IdleTimeoutWrapper() {
  const { user } = useAuth();
  return <IdleTimeoutManager isAuthenticated={!!user} timeoutMinutes={60} />;
}

function Router() {
  const { isAdminPortal, isPartnerPortal, isAgentPortal } = useSubdomain();

  // Render admin portal on admin subdomain
  if (isAdminPortal) {
    return (<Suspense fallback={<LoadingState />}><IdleTimeoutWrapper /><AdminRoutes /></Suspense>);
  }

  // Render partner portal on partner subdomain
  if (isPartnerPortal) {
    return (<Suspense fallback={<LoadingState />}><IdleTimeoutWrapper /><PartnerRoutes /></Suspense>);
  }

  // Render agent portal on agent subdomain
  if (isAgentPortal) {
    return (<Suspense fallback={<LoadingState />}><IdleTimeoutWrapper /><AgentRoutes /></Suspense>);
  }

  // Render client portal on main domain
  return (
    <Suspense fallback={<LoadingState />}>
    <LayoutResolver>
      <IdleTimeoutWrapper />
      <Switch>
        {/* Public routes - no authentication or profile completion required */}
        <Route path="/" component={LandingPage} />
        <Route path="/auth" component={AuthPage} />
        <Route path="/excel-addin" component={ExcelAddin} />
        <Route path="/profile" component={Profile} />
        <Route path="/profile/p/:code" component={PublicProfilePage} />
        <Route path="/proposal/:shareToken" component={PublicProposalPage} />
        <Route path="/onboarding" component={OnboardingPage} />
        <Route path="/ca-registration" component={CARegistration} />
        <Route path="/manual-kyc" component={ManualKYCPage} />
        <Route path="/kyc-dashboard">
          <Redirect to="/profile?tab=kyc-dashboard" />
        </Route>
        <Route path="/kyc/complete">
          <Redirect to="/profile?tab=kyc-dashboard" />
        </Route>
        <Route path="/product-eligibility" component={KYCProductEligibility} />
        <Route path="/video-kyc" component={VideoKYC} />
        <Route path="/kyc-rejections" component={KycRejectionRekyc} />
        <Route path="/net-worth" component={NetWorthPage} />
        <Route path="/pricing" component={PricingPage} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/terms" component={Terms} />
        <Route path="/refund-policy" component={RefundPolicy} />
        <Route path="/disclaimer" component={InvestmentDisclaimer} />
        
        {/* Agent/Admin routes - bypass profile completion but require authentication */}
        <Route path="/tester-diagnostics" component={TesterDiagnostics} />
        <Route path="/admin/proposals" component={AdminProposalsPage} />
        <Route path="/admin/unlisted/companies">
          {() => (
            <AdminLayout>
              <UnlistedCompaniesAdmin />
            </AdminLayout>
          )}
        </Route>
        <Route path="/admin/unlisted/negotiations">
          {() => (
            <AdminLayout>
              <UnlistedNegotiations />
            </AdminLayout>
          )}
        </Route>
        <Route path="/admin" component={AdminPanel} />
        <Route path="/agent" component={AgentDashboard} />
        
        <Route path="/p/:code" component={PublicProfilePage} />
        {/* User routes - require both authentication and profile completion */}
        <Route component={UserProtectedRoutes} />
      </Switch>
    </LayoutResolver>
    </Suspense>
  );
}

function App() {
  useEffect(() => {
    const loader = document.getElementById('initial-loader');
    if (loader) loader.remove();
    // Clear all stale-chunk reload guards so every portal recovers cleanly after a deploy.
    // These are set by lazyWithRetry and the vite:preloadError handler.
    sessionStorage.removeItem('preload-err-reload');
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith('chunk-reload-')) sessionStorage.removeItem(key);
    }
  }, []);
  return (
    <ErrorBoundary>
      <NetworkProvider>
      <LowDataProvider>
        <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <PortalThemeProvider>
          <UserPreferencesProvider>
          <UnifiedCartProvider>
            <TooltipProvider>
              <VersionCheckModal />
              <UpdateNotificationBanner />
              <NetworkStatusBanner />
              <GlobalActionQueueMonitor />
              <DSCBackgroundSync />
              <Toaster />
              <GDPRConsent />
              <UniversalKYCWall>
                <Router />
              </UniversalKYCWall>
            </TooltipProvider>
          </UnifiedCartProvider>
          </UserPreferencesProvider>
          </PortalThemeProvider>
        </QueryClientProvider>
      </ThemeProvider>
        </LowDataProvider>
    </NetworkProvider>
    </ErrorBoundary>
  );
}

export default App;
