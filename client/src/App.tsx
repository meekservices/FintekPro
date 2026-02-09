import { Switch, Route, useLocation, Redirect } from "wouter";
import { lazy, Suspense, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GDPRConsent } from "@/components/gdpr-consent";
import { ThemeProvider } from "@/contexts/theme-context";
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
import Home from "@/pages/home";
const Portfolio = lazy(() => import("@/pages/portfolio"));
const Markets = lazy(() => import("@/pages/markets"));
const IPO = lazy(() => import("@/pages/ipo"));
const PreIPO = lazy(() => import("@/pages/pre-ipo"));
const MutualFunds = lazy(() => import("@/pages/mutual-funds"));
const FundComparison = lazy(() => import("@/pages/fund-comparison"));
const PortfolioComparison = lazy(() => import("@/pages/portfolio-comparison"));
const Unlisted = lazy(() => import("@/pages/unlisted"));
const Loans = lazy(() => import("@/pages/loans"));
const NSDLServices = lazy(() => import("@/pages/nsdl-services"));
const CDSLServices = lazy(() => import("@/pages/cdsl-services"));
const CamsServices = lazy(() => import("@/pages/cams-services"));
const KfintechServices = lazy(() => import("@/pages/kfintech-services"));
const AgriculturalInsights = lazy(() => import("@/pages/agricultural-insights"));
const FinancialCalculators = lazy(() => import("@/pages/financial-calculators"));
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
const AdminPanel = lazy(() => import("@/pages/admin"));
const TesterDiagnostics = lazy(() => import("@/pages/tester-diagnostics"));
const PartnerPortal = lazy(() => import("@/pages/partner-portal"));
const Support = lazy(() => import("@/pages/support"));
const InvestSmart = lazy(() => import("@/pages/wealth-management"));
const Achievements = lazy(() => import("@/pages/achievements"));
const CapitalGainsReports = lazy(() => import("@/pages/capital-gains-reports"));
const ReportsHub = lazy(() => import("@/pages/reports-hub"));
const TransactionReports = lazy(() => import("@/pages/transaction-reports"));
const AgentDashboard = lazy(() => import("@/pages/agent-dashboard"));
const AgentPicks = lazy(() => import("@/pages/agent-picks"));
const IBTradingPage = lazy(() => import("@/pages/ib-trading"));
const StorePage = lazy(() => import("@/pages/store"));
const GiftCity = lazy(() => import("@/pages/gift-city"));
const Cart = lazy(() => import("@/pages/cart"));
const Orders = lazy(() => import("@/pages/orders"));
const ApiMonitorDemo = lazy(() => import("@/pages/api-monitor-demo"));
const ICICILoans = lazy(() => import("@/pages/icici-loans"));
const HDFCLoans = lazy(() => import("@/pages/hdfc-loans"));
const ClientAutoPopulate = lazy(() => import("@/pages/client-auto-populate"));
const Privacy = lazy(() => import("@/pages/privacy"));
const Terms = lazy(() => import("@/pages/terms"));
const RefundPolicy = lazy(() => import("@/pages/refund-policy"));
const InvestmentDisclaimer = lazy(() => import("@/pages/disclaimer"));
const AIF = lazy(() => import("@/pages/aif"));
const AIFDetail = lazy(() => import("@/pages/aif-detail"));
const PMS = lazy(() => import("@/pages/pms"));
const PMSDetail = lazy(() => import("@/pages/pms-detail"));
const AlternativeInvestments = lazy(() => import("@/pages/alternative-investments"));
const MldStore = lazy(() => import("@/pages/mld-store"));
const MldDetail = lazy(() => import("@/pages/mld-detail"));
const BajajFinance = lazy(() => import("@/pages/bajaj-finance"));
const TataCapital = lazy(() => import("@/pages/tata-capital"));
const PolicyBazaar = lazy(() => import("@/pages/policybazaar"));
const Cibil = lazy(() => import("@/pages/cibil"));
const Contact = lazy(() => import("@/pages/contact"));
const SupplierManagement = lazy(() => import("@/pages/supplier-management").then(m => ({ default: m.SupplierManagement })));
const Profile = lazy(() => import("@/pages/profile"));
import ProfileCompletionGuard from "@/components/ProfileCompletionGuard";
import { AppLayout } from "@/components/layout/app-layout";
import { AdminLayout } from "@/components/layout/admin-layout";
import { AgentLayout } from "@/components/layout/agent-layout";
import { PartnerLayout } from "@/components/layout/partner-layout";
import { LayoutResolver } from "@/components/layout/LayoutResolver";
import { useSubdomain } from "@/hooks/useSubdomain";
import { useAuth } from "@/hooks/useAuth";
import { IdleTimeoutManager } from "@/components/IdleTimeoutManager";
const AdminDashboard = lazy(() => import("@/pages/admin/dashboard"));
const SystemHealthMonitor = lazy(() => import("@/pages/admin/system-health"));
const EngineHealthCheck = lazy(() => import("@/pages/admin/engine-health-check"));
const RevenueAnalytics = lazy(() => import("@/pages/admin/revenue-analytics"));
const UserActivityTimeline = lazy(() => import("@/pages/admin/user-activity-timeline"));
const BulkOperations = lazy(() => import("@/pages/admin/bulk-operations"));
const ComplianceDashboardPage = lazy(() => import("@/pages/admin/compliance-dashboard"));
const NotificationManagement = lazy(() => import("@/pages/admin/notification-management"));
const FeatureFlags = lazy(() => import("@/pages/admin/feature-flags"));
const ParserConfigPage = lazy(() => import("@/pages/admin/parser-config"));
const AdminESignManagement = lazy(() => import("@/pages/admin/esign-management"));
const ReportBuilder = lazy(() => import("@/pages/admin/report-builder"));
const StakeholdersPage = lazy(() => import("@/pages/admin/stakeholders"));
const KycCompliancePage = lazy(() => import("@/pages/admin/kyc-compliance"));
const KycV2ManagementPage = lazy(() => import("@/pages/admin/kyc-v2-management"));
const FinancialOperationsPage = lazy(() => import("@/pages/admin/financial-operations"));
const APIConfiguration = lazy(() => import("@/pages/admin/api-configuration"));
const ProductionReadiness = lazy(() => import("@/pages/admin/production-readiness"));
const ReplitSuggestions = lazy(() => import("@/pages/admin/replit-suggestions"));
const ActivityCentre = lazy(() => import("@/pages/admin/activity-centre"));
const CkycDeferredDashboard = lazy(() => import("@/pages/admin/ckyc-deferred-dashboard"));
const ZohoDashboardPage = lazy(() => import("@/pages/admin/zoho-dashboard"));
const ZohoConnectionsPage = lazy(() => import("@/pages/admin/zoho-connections"));
const ZohoLogsPage = lazy(() => import("@/pages/admin/zoho-logs"));
const ZohoBooksPage = lazy(() => import("@/pages/admin/zoho-books"));
const ZohoImportPage = lazy(() => import("@/pages/admin-zoho-import"));
const AdminProspectDashboard = lazy(() => import("@/pages/admin-prospect-dashboard"));
const GlobalFeeModelAdmin = lazy(() => import("@/pages/admin/global-fee-model"));
const StoreManagement = lazy(() => import("@/pages/admin/store-management"));
const StoreInquiriesAdmin = lazy(() => import("@/pages/admin/store-inquiries"));
const BondSeedAdmin = lazy(() => import("@/pages/admin/bond-seed"));
const MldSeedAdmin = lazy(() => import("@/pages/admin/mld-seed"));
const AifSeedAdmin = lazy(() => import("@/pages/admin/aif-seed"));
const PmsSeedAdmin = lazy(() => import("@/pages/admin/pms-seed"));
const TaxServicesSeed = lazy(() => import("@/pages/admin/tax-services-seed"));
const GoldSeedAdmin = lazy(() => import("@/pages/admin/gold-seed"));
const LoansSeedAdmin = lazy(() => import("@/pages/admin/loans-seed"));
const MutualFundsSeeding = lazy(() => import("@/pages/admin/mutual-funds-seeding"));
const ListedStocksSeed = lazy(() => import("@/pages/admin/listed-stocks-seed"));
const ReitsInvitsSeed = lazy(() => import("@/pages/admin/reits-invits-seed"));
const GiftCityIfscSeed = lazy(() => import("@/pages/admin/gift-city-ifsc-seed"));
const GlobalSeedAdmin = lazy(() => import("@/pages/admin/global-seed"));
const RecommendationProductsAdmin = lazy(() => import("@/pages/admin/recommendation-products"));
const PicksManagement = lazy(() => import("@/pages/admin/picks-management"));
const McaDirectPayments = lazy(() => import("@/pages/admin/mca-direct-payments"));
const McaFinancialBackfill = lazy(() => import("@/pages/admin/mca-financial-backfill"));
const SeedUnlistedPage = lazy(() => import("@/pages/admin/seed-unlisted"));
const UnlistedPreviewPage = lazy(() => import("@/pages/admin/unlisted-preview"));
const UnlistedPricingPreviewPage = lazy(() => import("@/pages/admin/unlisted-pricing-preview"));
const DuplicateManagementPage = lazy(() => import("@/pages/admin/duplicate-management"));
const AdminThemeSettings = lazy(() => import("@/pages/admin/theme-settings"));
const ComprehensivePortfolio = lazy(() => import("@/pages/comprehensive-portfolio"));
const DocumentsPage = lazy(() => import("@/pages/documents"));
const BBPSPage = lazy(() => import("@/pages/BBPSPage"));
const DigiLockerPage = lazy(() => import("@/pages/DigiLockerPage"));
const LoanApplication = lazy(() => import("@/pages/loan-application"));
const LoanDashboard = lazy(() => import("@/pages/loan-dashboard"));
const LoanApplyPage = lazy(() => import("@/pages/loan-apply"));
const ProposalsPage = lazy(() => import("@/pages/proposals"));
const BrokingPage = lazy(() => import("@/pages/broking"));
const AgentPortal = lazy(() => import("@/pages/agent-portal"));
const DistributionPartnerPortal = lazy(() => import("@/pages/distribution-partner-portal"));
const FieldAgentPortal = lazy(() => import("@/pages/field-agent-portal"));
const AgentClientsPage = lazy(() => import("@/pages/agent-clients"));
const AgentCrmClient360 = lazy(() => import("@/pages/agent-crm-client-360"));
const AgentCrmPipeline = lazy(() => import("@/pages/agent-crm-pipeline"));
const AgentCrmTasks = lazy(() => import("@/pages/agent-crm-tasks"));
const AgentCrmAnalytics = lazy(() => import("@/pages/agent-crm-analytics"));
const AgentRecommendationControl = lazy(() => import("@/pages/agent-recommendation-control"));
const AgentTrainingPage = lazy(() => import("@/pages/agent-training"));
const AgentProposalsPage = lazy(() => import("@/pages/agent-proposals"));
const AgentClientAcquisitionPage = lazy(() => import("@/pages/agent-client-acquisition"));
const AgentDerivatives = lazy(() => import("@/pages/agent-derivatives"));
const AgentTaxCasesPage = lazy(() => import("@/pages/agent-tax-cases"));
const AgentKnowledgeHub = lazy(() => import("@/pages/agent-knowledge-hub"));
const AgentKnowledgeMarketBrief = lazy(() => import("@/pages/agent-knowledge-market-brief"));
const FestivalGreetingPreview = lazy(() => import("@/pages/agent/festival-greeting-preview"));
const AgentKnowledgeProducts = lazy(() => import("@/pages/agent-knowledge-products"));
const AgentKnowledgeExplanations = lazy(() => import("@/pages/agent-knowledge-explanations"));
const AgentKnowledgeCertifications = lazy(() => import("@/pages/agent-knowledge-certifications"));
const AgentInvestmentAdvisory = lazy(() => import("@/pages/agent-investment-advisory"));
const AgentBondRecommendations = lazy(() => import("@/pages/agent-bond-recommendations"));
const AgentStockAI = lazy(() => import("@/pages/agent-stock-ai"));
const AgentThemeSettings = lazy(() => import("@/pages/agent/theme-settings"));
const AgentResearchLists = lazy(() => import("@/pages/agent-research-lists"));
const AgentResearchListDetail = lazy(() => import("@/pages/agent-research-list-detail"));
const AgentScreener = lazy(() => import("@/pages/agent-screener"));
const AgentResearchAnalytics = lazy(() => import("@/pages/agent-research-analytics"));
const AgentTreasuryPage = lazy(() => import("@/pages/agent-treasury"));
const AgentRevenueCockpit = lazy(() => import("@/pages/agent-revenue-cockpit"));
const AgentLeadPipeline = lazy(() => import("@/pages/agent-lead-pipeline"));
const AgentLeadRegistry = lazy(() => import("@/pages/agent-lead-registry"));
const AgentClientProfile = lazy(() => import("@/pages/agent-client-profile"));
const AgentTasks = lazy(() => import("@/pages/agent-tasks"));
const AgentReportsHub = lazy(() => import("@/pages/agent-reports-hub"));
const AgentDemoProgress = lazy(() => import("@/pages/agent-demo-progress"));
const AgentPortfolioReportBuilder = lazy(() => import("@/pages/agent-portfolio-report-builder"));
const AgentSampleReport = lazy(() => import("@/pages/agent-sample-report"));
const AgentDemoProposalBuilder = lazy(() => import("@/pages/agent-demo-proposal-builder"));
const AgentZohoCRM = lazy(() => import("@/pages/agent-zoho-crm"));
const AgentLeaderboard = lazy(() => import("@/pages/agent-leaderboard"));
const AgentCommissionCalculator = lazy(() => import("@/pages/agent-commission-calculator"));
const AgentBulkCommunication = lazy(() => import("@/pages/agent-bulk-communication"));
const AgentCalendar = lazy(() => import("@/pages/agent-calendar"));
const AgentMeetings = lazy(() => import("@/pages/agent-meetings"));
const AgentESign = lazy(() => import("@/pages/agent-esign"));
const AgentClientOnboarding = lazy(() => import("@/pages/agent-client-onboarding"));
const AgentLoanApply = lazy(() => import("@/pages/agent/loan-apply"));
const AgentLoanMarketplace = lazy(() => import("@/pages/agent/loan-marketplace"));
const AgentLoanApplications = lazy(() => import("@/pages/agent/loan-applications"));
const AgentDSAPerformance = lazy(() => import("@/pages/agent/dsa-performance"));
const AgentPayoutClaims = lazy(() => import("@/pages/agent/payout-claims"));
const AdminAgentPayouts = lazy(() => import("@/pages/admin/agent-payouts"));
const AgentProspectProposals = lazy(() => import("@/pages/agent-prospect-proposals"));
const OnboardingPage = lazy(() => import("@/pages/onboarding"));
const PublicProposalPage = lazy(() => import("@/pages/public-proposal"));
const ManualKYCPage = lazy(() => import("@/pages/manual-kyc"));
const KycRejectionRekyc = lazy(() => import("@/pages/kyc-rejection-rekyc"));
const KYCProductEligibility = lazy(() => import("@/pages/kyc-product-eligibility"));
const NetWorthPage = lazy(() => import("@/pages/net-worth"));
const AdminProposalsPage = lazy(() => import("@/pages/admin-proposals"));
const ClientProposalsPage = lazy(() => import("@/pages/client-proposals"));
const MyProposalsPage = lazy(() => import("@/pages/my-proposals"));
const ClientSmartProposals = lazy(() => import("@/pages/client-smart-proposals"));
const TaxDocuments = lazy(() => import("@/pages/tax-documents"));
const ITRPrefilled = lazy(() => import("@/pages/itr-prefilled"));
const TaxDataCenter = lazy(() => import("@/pages/tax-data-center"));
const TaxSmartFiling = lazy(() => import("@/pages/tax-smart-filing"));
const OneClickTaxFiling = lazy(() => import("@/pages/one-click-tax-filing"));
const TaxITRPage = lazy(() => import("@/pages/tax-itr"));
const TaxITRSelfPage = lazy(() => import("@/pages/tax-itr-self"));
const TaxITRExpertPage = lazy(() => import("@/pages/tax-itr-expert"));
const TaxITRPreviewPage = lazy(() => import("@/pages/tax-itr-preview"));
const TaxITRPaymentPage = lazy(() => import("@/pages/tax-itr-payment"));
const TaxITRVerifyPage = lazy(() => import("@/pages/tax-itr-verify"));
const TaxNoticesPage = lazy(() => import("@/pages/tax-notices"));
const TaxDocumentVaultPage = lazy(() => import("@/pages/tax-document-vault"));
const TaxCADeskPage = lazy(() => import("@/pages/tax-ca-desk"));
const PropertyServices = lazy(() => import("@/pages/property-services"));
const LoanComparison = lazy(() => import("@/pages/loan-comparison"));
const LoanRecommendations = lazy(() => import("@/pages/loan-recommendations"));
const PartnerApplication = lazy(() => import("@/pages/partner-application"));
const InvestmentDashboard = lazy(() => import("@/pages/investment-dashboard"));
const NRIServices = lazy(() => import("@/pages/nri-services"));
const ITRTaxServices = lazy(() => import("@/pages/itr-tax-services"));
const DomesticTrading = lazy(() => import("@/pages/domestic-trading"));
const GlobalTrading = lazy(() => import("@/pages/global-trading"));
const GlobalAdvisoryPage = lazy(() => import("@/pages/global-advisory"));
const USTrading = lazy(() => import("@/pages/us-trading"));
const IntelligentTaxHub = lazy(() => import("@/pages/intelligent-tax-hub"));
const TaxReminderSubscription = lazy(() => import("@/pages/tax-reminder-subscription"));
const MLDs = lazy(() => import("@/pages/mlds"));
const UnifiedCart = lazy(() => import("@/pages/unified-cart"));
const Insurance = lazy(() => import("@/pages/insurance"));
const BankingProducts = lazy(() => import("@/pages/banking-products"));
const Bonds = lazy(() => import("@/pages/bonds"));
const BondCategoryPage = lazy(() => import("@/pages/bond-category"));
const BondDetailPage = lazy(() => import("@/pages/bond-detail"));
const FixedIncomeMarketplace = lazy(() => import("@/pages/fixed-income-marketplace"));
const FamilyList = lazy(() => import("@/pages/family-list"));
const FamilyDashboard = lazy(() => import("@/pages/family-dashboard"));
const AIChat = lazy(() => import("@/pages/ai-chat"));
const CorporateKYCPage = lazy(() => import("@/pages/CorporateKYCPage"));
const AlertsPage = lazy(() => import("@/pages/alerts"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const CreditReportPage = lazy(() => import("@/pages/credit-report"));
const DerivativesPage = lazy(() => import("@/pages/derivatives"));
const CommoditiesPage = lazy(() => import("@/pages/commodities"));
const CreditCardsPage = lazy(() => import("@/pages/credit-cards"));
const ProfessionalServicesPage = lazy(() => import("@/pages/professional-services"));
const ExpensesBudgets = lazy(() => import("@/pages/expenses-budgets"));
const AutoPopulationDashboard = lazy(() => import("@/pages/auto-population-dashboard"));
const GovernmentSchemes = lazy(() => import("@/pages/government-schemes"));
const ReferralProgram = lazy(() => import("@/pages/referral-program"));
const ScheduledReports = lazy(() => import("@/pages/scheduled-reports"));
const CompoundAlerts = lazy(() => import("@/pages/compound-alerts"));
const DashboardCustomize = lazy(() => import("@/pages/dashboard-customize"));
const ThemeSettings = lazy(() => import("@/pages/theme-settings"));
const AgentProspectWizard = lazy(() => import("@/pages/agent-prospect-wizard"));
const MarketingDashboard = lazy(() => import("@/pages/admin/marketing-dashboard"));
const FestivalMarketing = lazy(() => import("@/pages/admin/festival-marketing"));
const EmailCampaigns = lazy(() => import("@/pages/admin/email-campaigns"));
const WhatsAppCampaigns = lazy(() => import("@/pages/admin/whatsapp-campaigns"));
const SMSCampaigns = lazy(() => import("@/pages/admin/sms-campaigns"));
const SmsInbox = lazy(() => import("@/pages/admin/sms-inbox"));
const LeadProspecting = lazy(() => import("@/pages/admin/lead-prospecting"));
const McaIntelligence = lazy(() => import("@/pages/admin/mca-intelligence"));
const McaCompanyProfile = lazy(() => import("@/pages/admin/mca-company-profile"));
const ProspectAnalytics = lazy(() => import("@/pages/admin/prospect-analytics"));
const ClientIntelligence = lazy(() => import("@/pages/admin/client-intelligence"));
const MarketingAnalytics = lazy(() => import("@/pages/admin/marketing-analytics"));
const AgentPerformanceDashboard = lazy(() => import("@/pages/admin/agent-performance"));
const DemoProposalsTracking = lazy(() => import("@/pages/admin/demo-proposals"));
const AdminTaskOversight = lazy(() => import("@/pages/admin/task-oversight"));
const UserManagement = lazy(() => import("@/pages/admin/user-management"));
const CAManagement = lazy(() => import("@/pages/admin/ca-management"));
const PredictiveAnalytics = lazy(() => import("@/pages/PredictiveAnalytics"));
const UnlistedCompaniesAdmin = lazy(() => import("@/pages/admin/UnlistedCompaniesAdmin"));
const UnlistedNegotiations = lazy(() => import("@/pages/admin/UnlistedNegotiations"));
const UnlistedDashboard = lazy(() => import("@/pages/admin/unlisted-dashboard"));
const BondMarketplaceDashboard = lazy(() => import("@/pages/admin/bond-marketplace-dashboard"));
const GlobalAdvisoryManagement = lazy(() => import("@/pages/admin/global-advisory-management"));
const UnlistedOrders = lazy(() => import("@/pages/admin/unlisted-orders"));
const OrderAuditDashboard = lazy(() => import("@/pages/admin/order-audit"));
const UnlistedAuditLog = lazy(() => import("@/pages/admin/unlisted-audit-log"));
const UnlistedComplianceAlerts = lazy(() => import("@/pages/admin/unlisted-compliance-alerts"));
const UnlistedRegulatoryCompliance = lazy(() => import("@/pages/admin/unlisted-regulatory-compliance"));
const FixedIncomeAdmin = lazy(() => import("@/pages/admin/FixedIncomeAdmin"));
const BondCommissionSettings = lazy(() => import("@/pages/admin/bond-commission-settings"));
const CommissionMaster = lazy(() => import("@/pages/admin/commission-master"));
const AdminLoanManagement = lazy(() => import("@/pages/admin-loan-management"));
const AdminDsaLoanDashboard = lazy(() => import("@/pages/admin/dsa-loan-dashboard"));
const CommissionLedger = lazy(() => import("@/pages/admin/commission-ledger"));
const EligibilityMatrix = lazy(() => import("@/pages/admin/eligibility-matrix"));
const AdminDLM = lazy(() => import("@/pages/admin-dlm"));
const AdminDLMNegotiate = lazy(() => import("@/pages/admin-dlm-negotiate"));
const AdminStoreManager = lazy(() => import("@/pages/admin/store-manager"));
const BrowseUnlisted = lazy(() => import("@/pages/unlisted/BrowseUnlisted"));
const CompanyDetails = lazy(() => import("@/pages/unlisted/CompanyDetails"));
const CreateSellListing = lazy(() => import("@/pages/unlisted/CreateSellListing"));
const CreateBuyRequest = lazy(() => import("@/pages/unlisted/CreateBuyRequest"));
const MyOrders = lazy(() => import("@/pages/unlisted/MyOrders"));
const UnlistedCartPage = lazy(() => import("@/pages/unlisted/Cart"));
const CASupportDashboard = lazy(() => import("@/pages/ca-support-dashboard"));
const CASupportDetail = lazy(() => import("@/pages/ca-support-detail"));
const CARegistration = lazy(() => import("@/pages/ca-registration"));
const CADashboard = lazy(() => import("@/pages/ca-dashboard"));
const PartnerAgentDashboard = lazy(() => import("@/pages/partner-agent-dashboard"));
const PartnerCAManagement = lazy(() => import("@/pages/partner-ca-management"));
const AgentPayoutDashboard = lazy(() => import("@/pages/agent-payout-dashboard"));
const AdminPayoutManagement = lazy(() => import("@/pages/admin-payout-management"));
const AdminMappingRequests = lazy(() => import("@/pages/admin-mapping-requests"));
const FreshInvestmentDiscovery = lazy(() => import("@/pages/fresh-investment-discovery"));
const TDSCompliance = lazy(() => import("@/pages/tds-compliance"));
const AIProposalsPage = lazy(() => import("@/pages/ai-proposals"));
const AIProposalReviewPage = lazy(() => import("@/pages/ai-proposal-review"));
const AIStockPicks = lazy(() => import("@/pages/ai-stock-picks"));
const GoalsPage = lazy(() => import("@/pages/goals"));
const InvestableSurplusPage = lazy(() => import("@/pages/investable-surplus"));
const TaxComplianceForm15Page = lazy(() => import("@/pages/tax-compliance-form15"));
const RiskProfilingPage = lazy(() => import("@/pages/risk-profiling"));
const RiskQuestionnaireBuilder = lazy(() => import("@/pages/admin/risk-questionnaire-builder"));
const RiskComplianceExport = lazy(() => import("@/pages/admin/risk-compliance-export"));
const AdminDatabase = lazy(() => import("@/pages/admin/database"));
const AdminAadhaarConfig = lazy(() => import("@/pages/admin-aadhaar-config"));
const ExchangeFilingsAdmin = lazy(() => import("@/pages/admin/exchange-filings"));
const AdminApiUsage = lazy(() => import("@/pages/admin-api-usage"));
const AdminMFEnrichment = lazy(() => import("@/pages/admin-mf-enrichment"));
const AdminMfBenchmarks = lazy(() => import("@/pages/admin-mf-benchmarks"));
const AdminDataEnrichment = lazy(() => import("@/pages/admin-data-enrichment"));
const AdminMasterDsaClaims = lazy(() => import("@/pages/admin-master-dsa-claims"));
const AdminAiRecommendationTracking = lazy(() => import("@/pages/admin-ai-recommendation-tracking"));
const AdminReportsHub = lazy(() => import("@/pages/admin/reports-hub"));
const AdminAIInsights = lazy(() => import("@/pages/admin/ai-insights"));
const AdminAgentOversightPage = lazy(() => import("@/pages/admin/agent-oversight"));
const AdminAppointmentsDashboard = lazy(() => import("@/pages/admin/appointments-dashboard"));
const ClientTasks = lazy(() => import("@/pages/client-tasks"));
const ClientAIRecommendations = lazy(() => import("@/pages/client-ai-recommendations"));
const ClientReports = lazy(() => import("@/pages/client-reports"));
const ReitInvitPage = lazy(() => import("@/pages/reit-invit"));
const VideoKYC = lazy(() => import("@/pages/video-kyc"));
const PortfolioStressTest = lazy(() => import("@/pages/portfolio-stress-test"));
const DividendCalendar = lazy(() => import("@/pages/dividend-calendar"));
const TaxLossHarvesting = lazy(() => import("@/pages/tax-loss-harvesting"));
const TaxRegimeComparison = lazy(() => import("@/pages/tax-regime-comparison"));
const AgentFieldView = lazy(() => import("@/pages/agent-field-view"));
const AgentPerformance = lazy(() => import("@/pages/agent-performance"));
const NotificationPreferences = lazy(() => import("@/pages/notification-preferences"));
const AIPortfolioReport = lazy(() => import("@/pages/ai-portfolio-report"));
const PortfolioHoldings = lazy(() => import("@/pages/portfolio-holdings"));
const PortfolioGoals = lazy(() => import("@/pages/portfolio-goals"));
const PortfolioRetirement = lazy(() => import("@/pages/portfolio-retirement"));
const PortfolioAIInsights = lazy(() => import("@/pages/portfolio-ai-insights"));
const PortfolioRebalancing = lazy(() => import("@/pages/portfolio-rebalancing"));
const PortfolioImport = lazy(() => import("@/pages/portfolio-import"));
const TrackerPortfolioReport = lazy(() => import("@/pages/tracker-portfolio-report"));
const AgentExternalPortfolios = lazy(() => import("@/pages/agent-external-portfolios"));

function UserProtectedRoutes() {
  return (
    <ProfileCompletionGuard>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/dashboard" component={Home} />
        <Route path="/portfolio" component={Portfolio} />
        <Route path="/portfolio/holdings" component={PortfolioHoldings} />
        <Route path="/portfolio/goals" component={PortfolioGoals} />
        <Route path="/portfolio/retirement" component={PortfolioRetirement} />
        <Route path="/portfolio/ai-insights" component={PortfolioAIInsights} />
        <Route path="/portfolio/rebalancing" component={PortfolioRebalancing} />
        <Route path="/portfolio/import" component={PortfolioImport} />
        <Route path="/portfolio-stress-test" component={PortfolioStressTest} />
        <Route path="/dividend-calendar" component={DividendCalendar} />
        <Route path="/tax-loss-harvesting" component={TaxLossHarvesting} />
        <Route path="/tax-regime-comparison" component={TaxRegimeComparison} />
        <Route path="/agent-field-view" component={AgentFieldView} />
        <Route path="/agent-performance" component={AgentPerformance} />
        <Route path="/agent/external-portfolios" component={AgentExternalPortfolios} />
        <Route path="/notification-preferences" component={NotificationPreferences} />
        <Route path="/ai-portfolio-report" component={AIPortfolioReport} />
        <Route path="/risk-profiling" component={RiskProfilingPage} />
        <Route path="/analytics" component={PredictiveAnalytics} />
        <Route path="/comprehensive-portfolio">
          {() => (
            <Suspense fallback={<LoadingState variant="portfolio" />}>
              <ComprehensivePortfolio />
            </Suspense>
          )}
        </Route>
        <Route path="/broking" component={BrokingPage} />
        <Route path="/markets" component={Markets} />
        <Route path="/ipo" component={IPO} />
        <Route path="/pre-ipo" component={PreIPO} />
        <Route path="/mutual-funds" component={MutualFunds} />
        <Route path="/fund-comparison" component={FundComparison} />
        <Route path="/portfolio-comparison" component={PortfolioComparison} />
        <Route path="/unlisted" component={Unlisted} />
        <Route path="/unlisted/browse" component={BrowseUnlisted} />
        <Route path="/unlisted/company/:id" component={CompanyDetails} />
        <Route path="/unlisted/sell" component={CreateSellListing} />
        <Route path="/unlisted/buy" component={CreateBuyRequest} />
        <Route path="/unlisted/my-orders" component={MyOrders} />
        <Route path="/unlisted/cart" component={UnlistedCartPage} />
        <Route path="/bonds" component={Bonds} />
        <Route path="/bonds/category/:category" component={BondCategoryPage} />
        <Route path="/bonds/detail/:isin" component={BondDetailPage} />
        <Route path="/fixed-income" component={FixedIncomeMarketplace} />
        <Route path="/mlds" component={MLDs} />
        <Route path="/insurance" component={Insurance} />
        <Route path="/banking-products" component={BankingProducts} />
        <Route path="/loans" component={Loans} />
        <Route path="/nsdl-services" component={NSDLServices} />
        <Route path="/cdsl-services" component={CDSLServices} />
        <Route path="/cams-services" component={CamsServices} />
        <Route path="/kfintech-services" component={KfintechServices} />
        <Route path="/agricultural-insights" component={AgriculturalInsights} />
        <Route path="/calculators" component={FinancialCalculators} />
        <Route path="/partner-portal">
          {() => (
            <Suspense fallback={<LoadingState variant="partner-dashboard" />}>
              <DistributionPartnerPortal />
            </Suspense>
          )}
        </Route>
        <Route path="/partner">
          {() => (
            <Suspense fallback={<LoadingState variant="partner-dashboard" />}>
              <PartnerPortal />
            </Suspense>
          )}
        </Route>
        <Route path="/partner/ca-dashboard" component={CADashboard} />
        <Route path="/partner/agents" component={PartnerAgentDashboard} />
        <Route path="/partner/agent-performance" component={PartnerAgentDashboard} />
        <Route path="/partner/payouts">
          {() => (
            <Suspense fallback={<LoadingState variant="partner-dashboard" />}>
              <AgentPayoutClaims />
            </Suspense>
          )}
        </Route>
        <Route path="/partner/ca-management" component={PartnerCAManagement} />
        <Route path="/partner/ca-support" component={CASupportDashboard} />
        <Route path="/partner/ca-support/:id" component={CASupportDetail} />
        <Route path="/support" component={Support} />
        <Route path="/wealth" component={InvestSmart} />
        <Route path="/investsmart" component={InvestSmart} />
        <Route path="/wealth-management" component={InvestSmart} />
        <Route path="/proposals" component={ProposalsPage} />
        <Route path="/my-proposals" component={MyProposalsPage} />
        <Route path="/documents" component={DocumentsPage} />
        <Route path="/smart-proposals" component={ClientSmartProposals} />
        <Route path="/discover" component={FreshInvestmentDiscovery} />
        <Route path="/achievements" component={Achievements} />
        <Route path="/capital-gains" component={CapitalGainsReports} />
        <Route path="/reports" component={ReportsHub} />
        <Route path="/reports/tracker-portfolio" component={TrackerPortfolioReport} />
        <Route path="/my-tasks" component={ClientTasks} />
        <Route path="/ai-recommendations" component={ClientAIRecommendations} />
        <Route path="/my-reports" component={ClientReports} />
        <Route path="/transaction-reports" component={TransactionReports} />
        {/* Unified Tax & Compliance Module */}
        <Route path="/tax/itr" component={TaxITRPage} />
        <Route path="/tax/itr/self" component={TaxITRSelfPage} />
        <Route path="/tax/itr/expert" component={TaxITRExpertPage} />
        <Route path="/tax/itr/preview/:draftId" component={TaxITRPreviewPage} />
        <Route path="/tax/itr/payment/:draftId" component={TaxITRPaymentPage} />
        <Route path="/tax/itr/verify/:draftId" component={TaxITRVerifyPage} />
        <Route path="/tax/itr/:mode" component={TaxITRPage} />
        <Route path="/tax/15ca-cb" component={TaxComplianceForm15Page} />
        <Route path="/tax/notices" component={TaxNoticesPage} />
        <Route path="/tax/documents" component={TaxDocumentVaultPage} />
        <Route path="/tax/ca-desk" component={TaxCADeskPage} />
        {/* Unified Tax Services - Primary Route */}
        <Route path="/tax-hub" component={IntelligentTaxHub} />
        <Route path="/tax" component={TaxSmartFiling} />
        <Route path="/one-click-tax-filing" component={OneClickTaxFiling} />
        <Route path="/tax-reminder-subscription" component={TaxReminderSubscription} />
        {/* Legacy Tax Routes - Maintained for existing users */}
        <Route path="/tax-data-center" component={TaxDataCenter} />
        <Route path="/tax-documents" component={TaxDocuments} />
        <Route path="/itr-prefilled">
          {() => {
            // Smart redirect to unified tax filing with pre-filled flag
            window.location.href = "/tax?mode=prefilled";
            return null;
          }}
        </Route>
        {/* Unified Property Services Hub */}
        <Route path="/property" component={PropertyServices} />
        <Route path="/loan-comparison" component={LoanComparison} />
        <Route path="/loan-recommendations" component={LoanRecommendations} />
        <Route path="/partner-application/:lender">
          {() => (
            <Suspense fallback={<LoadingState variant="partner-dashboard" />}>
              <PartnerApplication />
            </Suspense>
          )}
        </Route>
        <Route path="/investment-dashboard" component={InvestmentDashboard} />
        <Route path="/ib-trading" component={IBTradingPage} />
        <Route path="/store" component={StorePage} />
        <Route path="/store/pms" component={PMS} />
        <Route path="/store/aif" component={AIF} />
        <Route path="/store/mld" component={MldStore} />
        <Route path="/chat" component={AIChat} />
        <Route path="/alerts" component={AlertsPage} />
        <Route path="/gift-city" component={GiftCity} />
        <Route path="/nri-services" component={NRIServices} />
        <Route path="/itr-tax-services" component={ITRTaxServices} />
        <Route path="/tds-compliance" component={TDSCompliance} />
        <Route path="/tax-compliance/form15" component={TaxComplianceForm15Page} />
        <Route path="/domestic-trading" component={DomesticTrading} />
        <Route path="/global-trading" component={GlobalTrading} />
        <Route path="/global-advisory" component={GlobalAdvisoryPage} />
        <Route path="/us-trading" component={USTrading} />
        <Route path="/cart" component={Cart} />
        <Route path="/unified-cart" component={UnifiedCart} />
        <Route path="/investment-cart" component={UnifiedCart} />
        <Route path="/orders" component={Orders} />
        <Route path="/api-monitor" component={ApiMonitorDemo} />
        <Route path="/icici-loans" component={ICICILoans} />
        <Route path="/hdfc-loans" component={HDFCLoans} />
        <Route path="/client-auto-populate" component={ClientAutoPopulate} />
        <Route path="/aif" component={AIF} />
        <Route path="/aif/:id" component={AIFDetail} />
        <Route path="/pms" component={PMS} />
        <Route path="/pms/:id" component={PMSDetail} />
        <Route path="/alternative-investments" component={AlternativeInvestments} />
        <Route path="/reit-invit" component={ReitInvitPage} />
        <Route path="/mld" component={MldStore} />
        <Route path="/mld/:id" component={MldDetail} />
        <Route path="/bajaj-finance" component={BajajFinance} />
        <Route path="/tata-capital" component={TataCapital} />
        <Route path="/policybazaar" component={PolicyBazaar} />
        <Route path="/cibil" component={Cibil} />
        <Route path="/contact" component={Contact} />
        <Route path="/suppliers" component={SupplierManagement} />
        <Route path="/bbps" component={BBPSPage} />
        <Route path="/digilocker" component={DigiLockerPage} />
        <Route path="/loan-application" component={LoanApplication} />
        <Route path="/loan-dashboard" component={LoanDashboard} />
        <Route path="/loan-apply" component={LoanApplyPage} />
        <Route path="/families" component={FamilyList} />
        <Route path="/families/:id" component={FamilyDashboard} />
        <Route path="/corporate-kyc" component={CorporateKYCPage} />
        {/* New Pages */}
        <Route path="/settings" component={SettingsPage} />
        <Route path="/credit-report" component={CreditReportPage} />
        <Route path="/derivatives" component={DerivativesPage} />
        <Route path="/expenses-budgets" component={ExpensesBudgets} />
        <Route path="/commodities" component={CommoditiesPage} />
        <Route path="/credit-cards" component={CreditCardsPage} />
        <Route path="/professional-services" component={ProfessionalServicesPage} />
        <Route path="/auto-populate" component={AutoPopulationDashboard} />
        <Route path="/government-schemes" component={GovernmentSchemes} />
        <Route path="/ai-proposals" component={AIProposalsPage} />
        <Route path="/ai-proposal-review" component={AIProposalReviewPage} />
        <Route path="/ai-stock-picks" component={AIStockPicks} />
        <Route path="/goals" component={GoalsPage} />
        <Route path="/referral-program" component={ReferralProgram} />
        <Route path="/scheduled-reports" component={ScheduledReports} />
        <Route path="/compound-alerts" component={CompoundAlerts} />
        <Route path="/dashboard-customize" component={DashboardCustomize} />
        <Route path="/theme-settings" component={ThemeSettings} />
        <Route path="/agent-prospect-wizard" component={AgentProspectWizard} />
        <Route path="/investable-surplus" component={InvestableSurplusPage} />
        <Route path="/ai-proposal-review/:id" component={AIProposalReviewPage} />
        {/* Admin seed pages accessible from main site for development */}
        <Route path="/admin/aif-seed">
          {() => <Suspense fallback={<LoadingState variant="dashboard" />}><AifSeedAdmin /></Suspense>}
        </Route>
        <Route path="/admin/pms-seed">
          {() => <Suspense fallback={<LoadingState variant="dashboard" />}><PmsSeedAdmin /></Suspense>}
        </Route>
        <Route path="/admin/mld-seed">
          {() => <Suspense fallback={<LoadingState variant="dashboard" />}><MldSeedAdmin /></Suspense>}
        </Route>
        <Route component={NotFound} />
      </Switch>
    </ProfileCompletionGuard>
  );
}

// Component to handle admin root redirect
function AdminRoot() {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const { withPortalParams } = useSubdomain();
  
  useEffect(() => {
    if (!isLoading && !user) {
      navigate(withPortalParams('/auth'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isLoading]);
  
  if (isLoading) {
    return <LoadingState variant="dashboard" />;
  }
  
  if (!user) {
    return <LoadingState variant="dashboard" />;
  }
  
  return (
    <AdminLayout>
      <AdminDashboard />
    </AdminLayout>
  );
}

function AdminRoutes() {
  return (
    <Switch>
      {/* Public auth routes - no AdminLayout wrapper */}
      <Route path="/auth" component={AuthPage} />
      <Route path="/admin/auth" component={AuthPage} />
      {/* Public proposal preview - accessible on all subdomains */}
      <Route path="/proposal/:shareToken" component={PublicProposalPage} />
      
      {/* Protected admin routes - wrapped in AdminLayout */}
      <Route path="/admin/dashboard">
        {() => (
          <AdminLayout>
            <AdminDashboard />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/stakeholders">
        {() => (
          <AdminLayout>
            <StakeholdersPage />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/kyc-compliance">
        {() => (
          <AdminLayout>
            <KycCompliancePage />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/kyc-v2-management">
        {() => (
          <AdminLayout>
            <KycV2ManagementPage />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/ckyc-deferred">
        {() => (
          <AdminLayout>
            <CkycDeferredDashboard />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/financial-operations">
        {() => (
          <AdminLayout>
            <FinancialOperationsPage />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/api-config">
        {() => (
          <AdminLayout>
            <APIConfiguration />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/api-configuration">
        {() => (
          <AdminLayout>
            <APIConfiguration />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/production-readiness">
        {() => (
          <AdminLayout>
            <ProductionReadiness />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/replit-suggestions">
        {() => <ReplitSuggestions />}
      </Route>
      <Route path="/admin/zoho-dashboard">
        {() => (
          <AdminLayout>
            <Suspense fallback={<LoadingState variant="dashboard" />}>
              <ZohoDashboardPage />
            </Suspense>
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/zoho-connections">
        {() => (
          <AdminLayout>
            <Suspense fallback={<LoadingState variant="dashboard" />}>
              <ZohoConnectionsPage />
            </Suspense>
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/zoho-logs">
        {() => (
          <AdminLayout>
            <Suspense fallback={<LoadingState variant="dashboard" />}>
              <ZohoLogsPage />
            </Suspense>
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/zoho-books">
        {() => (
          <AdminLayout>
            <Suspense fallback={<LoadingState variant="dashboard" />}>
              <ZohoBooksPage />
            </Suspense>
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/zoho-import">
        {() => (
          <AdminLayout>
            <Suspense fallback={<LoadingState variant="dashboard" />}>
              <ZohoImportPage />
            </Suspense>
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/marketing-dashboard">
        {() => (
          <AdminLayout>
            <MarketingDashboard />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/festival-marketing">
        {() => (
          <AdminLayout>
            <FestivalMarketing />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/email-campaigns">
        {() => (
          <AdminLayout>
            <EmailCampaigns />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/whatsapp-campaigns">
        {() => (
          <AdminLayout>
            <WhatsAppCampaigns />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/sms-campaigns">
        {() => (
          <AdminLayout>
            <SMSCampaigns />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/sms-inbox">
        {() => (
          <AdminLayout>
            <SmsInbox />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/lead-prospecting">
        {() => (
          <AdminLayout>
            <LeadProspecting />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/mca-intelligence">
        {() => (
          <AdminLayout>
            <McaIntelligence />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/mca-company/:cin?">
        {() => (
          <AdminLayout>
            <McaCompanyProfile />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/prospect-analytics">
        {() => (
          <AdminLayout>
            <ProspectAnalytics />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/prospect-dashboard">
        {() => (
          <Suspense fallback={<LoadingState variant="dashboard" />}>
            <AdminLayout>
              <AdminProspectDashboard />
            </AdminLayout>
          </Suspense>
        )}
      </Route>
      <Route path="/admin/client-intelligence">
        {() => (
          <AdminLayout>
            <ClientIntelligence />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/marketing-analytics">
        {() => (
          <AdminLayout>
            <MarketingAnalytics />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/agent-performance">
        {() => (
          <AdminLayout>
            <AgentPerformanceDashboard />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/demo-proposals">
        {() => (
          <AdminLayout>
            <DemoProposalsTracking />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/global-advisory">
        {() => (
          <AdminLayout>
            <GlobalAdvisoryManagement />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/global-fee-model">
        {() => (
          <Suspense fallback={<LoadingState variant="dashboard" />}>
            <AdminLayout>
              <GlobalFeeModelAdmin />
            </AdminLayout>
          </Suspense>
        )}
      </Route>
      <Route path="/admin/appointments">
        {() => <AdminAppointmentsDashboard />}
      </Route>
      <Route path="/admin/agent-oversight">
        {() => <AdminAgentOversightPage />}
      </Route>
      <Route path="/admin/ai-insights">
        {() => (
          <AdminLayout>
            <AdminAIInsights />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/task-oversight">
        {() => (
          <AdminLayout>
            <AdminTaskOversight />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/duplicates">
        {() => (
          <AdminLayout>
            <Suspense fallback={<LoadingState variant="dashboard" />}>
              <DuplicateManagementPage />
            </Suspense>
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/system-health">
        {() => (
          <AdminLayout>
            <SystemHealthMonitor />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/engine-health-check">
        {() => (
          <AdminLayout>
            <EngineHealthCheck />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/revenue-analytics">
        {() => (
          <AdminLayout>
            <RevenueAnalytics />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/user-activity">
        {() => (
          <AdminLayout>
            <UserActivityTimeline />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/bulk-operations">
        {() => (
          <AdminLayout>
            <BulkOperations />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/compliance-dashboard">
        {() => (
          <AdminLayout>
            <ComplianceDashboardPage />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/notification-management">
        {() => (
          <AdminLayout>
            <NotificationManagement />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/feature-flags">
        {() => (
          <AdminLayout>
            <FeatureFlags />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/parser-config">
        {() => (
          <AdminLayout>
            <ParserConfigPage />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/esign-management">
        {() => (
          <AdminLayout>
            <AdminESignManagement />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/report-builder">
        {() => (
          <AdminLayout>
            <ReportBuilder />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/order-audit">
        {() => (
          <AdminLayout>
            <OrderAuditDashboard />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/users">
        {() => (
          <AdminLayout>
            <UserManagement />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/ca-management">
        {() => (
          <AdminLayout>
            <CAManagement />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/payouts">
        {() => (
          <AdminLayout>
            <AdminPayoutManagement />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/mapping-requests">
        {() => (
          <AdminLayout>
            <AdminMappingRequests />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/store-management">
        {() => (
          <AdminLayout>
            <Suspense fallback={<LoadingState variant="dashboard" />}>
              <StoreManagement />
            </Suspense>
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/store-manager">
        {() => (
          <AdminLayout>
            <AdminStoreManager />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/store-inquiries">
        {() => (
          <AdminLayout>
            <Suspense fallback={<LoadingState variant="dashboard" />}>
              <StoreInquiriesAdmin />
            </Suspense>
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/store/seed-unlisted">
        {() => (
          <AdminLayout>
            <Suspense fallback={<LoadingState variant="dashboard" />}>
              <SeedUnlistedPage />
            </Suspense>
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/store/seed/pre-ipo-unlisted">
        {() => (
          <AdminLayout>
            <Suspense fallback={<LoadingState variant="dashboard" />}>
              <SeedUnlistedPage />
            </Suspense>
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/unlisted/preview/:id">
        {() => (
          <AdminLayout>
            <Suspense fallback={<LoadingState variant="dashboard" />}>
              <UnlistedPreviewPage />
            </Suspense>
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/unlisted/pricing-preview/:companyId">
        {() => (
          <AdminLayout>
            <Suspense fallback={<LoadingState variant="dashboard" />}>
              <UnlistedPricingPreviewPage />
            </Suspense>
          </AdminLayout>
        )}
      </Route>
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
      <Route path="/admin/unlisted/dashboard">
        {() => (
          <AdminLayout>
            <UnlistedDashboard />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/unlisted/orders">
        {() => (
          <AdminLayout>
            <UnlistedOrders />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/unlisted/audit-log">
        {() => (
          <AdminLayout>
            <UnlistedAuditLog />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/unlisted/compliance-alerts">
        {() => (
          <AdminLayout>
            <UnlistedComplianceAlerts />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/unlisted/regulatory-compliance">
        {() => (
          <AdminLayout>
            <UnlistedRegulatoryCompliance />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/unlisted/seed">
        {() => (
          <AdminLayout>
            <Suspense fallback={<LoadingState variant="dashboard" />}>
              <SeedUnlistedPage />
            </Suspense>
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/bonds/dashboard">
        {() => (
          <AdminLayout>
            <BondMarketplaceDashboard />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/bonds/sell-listings">
        {() => (
          <AdminLayout>
            <FixedIncomeAdmin defaultTab="marketplace" />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/bonds/buy-requests">
        {() => (
          <AdminLayout>
            <FixedIncomeAdmin defaultTab="marketplace" />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/bonds/deals">
        {() => (
          <AdminLayout>
            <FixedIncomeAdmin defaultTab="marketplace" />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/bonds/audit-log">
        {() => (
          <AdminLayout>
            <FixedIncomeAdmin defaultTab="audit" />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/fixed-income">
        {() => (
          <AdminLayout>
            <FixedIncomeAdmin />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/mca-payments">
        {() => (
          <AdminLayout>
            <Suspense fallback={<LoadingState variant="dashboard" />}>
              <McaDirectPayments />
            </Suspense>
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/mca-backfill">
        {() => (
          <AdminLayout>
            <Suspense fallback={<LoadingState variant="dashboard" />}>
              <McaFinancialBackfill />
            </Suspense>
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/bond-commission-settings">
        {() => (
          <AdminLayout>
            <BondCommissionSettings />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/commission-master">
        {() => (
          <AdminLayout>
            <CommissionMaster />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/loan-marketplace">
        {() => (
          <AdminLayout>
            <AdminLoanManagement />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/commission-ledger">
        {() => (
          <AdminLayout>
            <CommissionLedger />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/eligibility-matrix">
        {() => (
          <AdminLayout>
            <EligibilityMatrix />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/dsa-loans">
        {() => (
          <AdminLayout>
            <AdminDsaLoanDashboard />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/dlm">
        {() => (
          <AdminLayout>
            <AdminDLM />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/dlm/negotiate/:documentId">
        {() => (
          <AdminLayout>
            <AdminDLMNegotiate />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/documents">
        {() => (
          <AdminLayout>
            <AdminDLM />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/bond-seed">
        {() => (
          <AdminLayout>
            <Suspense fallback={<LoadingState variant="dashboard" />}>
              <BondSeedAdmin />
            </Suspense>
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/mld-seed">
        {() => (
          <AdminLayout>
            <Suspense fallback={<LoadingState variant="dashboard" />}>
              <MldSeedAdmin />
            </Suspense>
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/aif-seed">
        {() => (
          <AdminLayout>
            <Suspense fallback={<LoadingState variant="dashboard" />}>
              <AifSeedAdmin />
            </Suspense>
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/pms-seed">
        {() => (
          <AdminLayout>
            <Suspense fallback={<LoadingState variant="dashboard" />}>
              <PmsSeedAdmin />
            </Suspense>
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/mutual-funds">
        {() => {
          window.location.href = "/admin/mutual-funds-seeding";
          return null;
        }}
      </Route>
      <Route path="/admin/mutual-funds-seeding">
        {() => (
          <AdminLayout>
            <Suspense fallback={<LoadingState variant="dashboard" />}>
              <MutualFundsSeeding />
            </Suspense>
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/global-seed">
          <Suspense fallback={<LoadingState variant="dashboard" />}>
            <GlobalSeedAdmin />
          </Suspense>
        </Route>
        <Route path="/admin/listed-stocks-seed">
        {() => (
          <AdminLayout>
            <Suspense fallback={<LoadingState variant="dashboard" />}>
              <ListedStocksSeed />
            </Suspense>
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/reits-invits-seed">
        {() => (
          <AdminLayout>
            <Suspense fallback={<LoadingState variant="dashboard" />}>
              <ReitsInvitsSeed />
            </Suspense>
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/store/seed/reits-invits">
        {() => (
          <AdminLayout>
            <Suspense fallback={<LoadingState variant="dashboard" />}>
              <ReitsInvitsSeed />
            </Suspense>
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/store/seed/listed-securities">
        {() => (
          <AdminLayout>
            <Suspense fallback={<LoadingState variant="dashboard" />}>
              <ListedStocksSeed />
            </Suspense>
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/store/seed/aif">
        {() => (
          <AdminLayout>
            <Suspense fallback={<LoadingState variant="dashboard" />}>
              <AifSeedAdmin />
            </Suspense>
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/store/seed/gift-city-ifsc">
        {() => (
          <AdminLayout>
            <Suspense fallback={<LoadingState variant="dashboard" />}>
              <GiftCityIfscSeed />
            </Suspense>
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/store/seed/pms">
        {() => (
          <AdminLayout>
            <Suspense fallback={<LoadingState variant="dashboard" />}>
              <PmsSeedAdmin />
            </Suspense>
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/store/seed/services">
        {() => (
          <AdminLayout>
            <Suspense fallback={<LoadingState variant="dashboard" />}>
              <TaxServicesSeed />
            </Suspense>
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/store/seed/gold">
        {() => (
          <AdminLayout>
            <Suspense fallback={<LoadingState variant="dashboard" />}>
              <GoldSeedAdmin />
            </Suspense>
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/store/seed/loans">
        {() => (
          <AdminLayout>
            <Suspense fallback={<LoadingState variant="dashboard" />}>
              <LoansSeedAdmin />
            </Suspense>
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/recommendation-products">
        {() => (
          <AdminLayout>
            <Suspense fallback={<LoadingState variant="dashboard" />}>
              <RecommendationProductsAdmin />
            </Suspense>
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/picks">
        {() => (
          <Suspense fallback={<LoadingState variant="dashboard" />}>
            <PicksManagement />
          </Suspense>
        )}
      </Route>
      <Route path="/admin/reports">
        {() => (
          <AdminLayout>
            <AdminReportsHub />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/compliance">
        {() => (
          <AdminLayout>
            <RiskComplianceExport />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/theme-settings">
        {() => (
          <AdminLayout>
            <Suspense fallback={<LoadingState variant="dashboard" />}>
              <AdminThemeSettings />
            </Suspense>
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/aadhaar-config">
        {() => (
          <AdminLayout>
            <AdminAadhaarConfig />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/api-usage">
        {() => <AdminApiUsage />}
      </Route>
      <Route path="/admin/mf-benchmarks">
        <AdminMfBenchmarks />
      </Route>
      <Route path="/admin/mf-enrichment">
        {() => <AdminMFEnrichment />}
      </Route>
      <Route path="/admin/data-enrichment">
        {() => <AdminDataEnrichment />}
      </Route>
      <Route path="/admin/master-dsa-claims">
        {() => <AdminMasterDsaClaims />}
      </Route>
      <Route path="/admin/ai-recommendation-tracking">
        {() => (
          <AdminLayout>
            <AdminAiRecommendationTracking />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/risk-compliance-export">
        {() => (
          <AdminLayout>
            <RiskComplianceExport />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/database">
        {() => (
          <AdminLayout>
            <AdminDatabase />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/activity-centre">
        {() => (
          <AdminLayout>
            <ActivityCentre />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/exchange-filings">
        {() => (
          <AdminLayout>
            <ExchangeFilingsAdmin />
          </AdminLayout>
        )}
      </Route>
      {/* Generic admin root - must be after all specific /admin/* routes */}
      <Route path="/admin" component={AdminRoot} />
      <Route path="/" component={AdminRoot} />
      <Route component={NotFound} />
    </Switch>
  );
}

function PartnerRoutes() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/partner/auth" component={AuthPage} />
      {/* Public proposal preview - accessible on all subdomains */}
      <Route path="/proposal/:shareToken" component={PublicProposalPage} />
      <Route path="/">
        {() => (
          <PartnerLayout>
            <Suspense fallback={<LoadingState variant="partner-dashboard" />}>
              <DistributionPartnerPortal />
            </Suspense>
          </PartnerLayout>
        )}
      </Route>
      <Route path="/partner">
        {() => (
          <PartnerLayout>
            <Suspense fallback={<LoadingState variant="partner-dashboard" />}>
              <DistributionPartnerPortal />
            </Suspense>
          </PartnerLayout>
        )}
      </Route>
      <Route path="/partner-portal">
        {() => (
          <PartnerLayout>
            <Suspense fallback={<LoadingState variant="partner-dashboard" />}>
              <DistributionPartnerPortal />
            </Suspense>
          </PartnerLayout>
        )}
      </Route>
      <Route path="/products">
        {() => (
          <PartnerLayout>
            <Suspense fallback={<LoadingState variant="partner-dashboard" />}>
              <PartnerPortal />
            </Suspense>
          </PartnerLayout>
        )}
      </Route>
      <Route path="/agents">
        {() => (
          <PartnerLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentPortal />
            </Suspense>
          </PartnerLayout>
        )}
      </Route>
      <Route path="/partner/agents">
        {() => (
          <PartnerLayout>
            <Suspense fallback={<LoadingState variant="partner-dashboard" />}>
              <PartnerAgentDashboard />
            </Suspense>
          </PartnerLayout>
        )}
      </Route>
      <Route path="/ca-support">
        {() => (
          <PartnerLayout>
            <CASupportDashboard />
          </PartnerLayout>
        )}
      </Route>
      <Route path="/ca-support/:id">
        {() => (
          <PartnerLayout>
            <CASupportDetail />
          </PartnerLayout>
        )}
      </Route>
      <Route path="/partner/ca-support">
        {() => (
          <PartnerLayout>
            <CASupportDashboard />
          </PartnerLayout>
        )}
      </Route>
      <Route path="/partner/ca-support/:id">
        {() => (
          <PartnerLayout>
            <CASupportDetail />
          </PartnerLayout>
        )}
      </Route>
      <Route path="/partner/payouts">
        {() => (
          <PartnerLayout>
            <Suspense fallback={<LoadingState variant="partner-dashboard" />}>
              <AgentPayoutClaims />
            </Suspense>
          </PartnerLayout>
        )}
      </Route>
      <Route path="/partner/agent-performance">
        {() => (
          <PartnerLayout>
            <Suspense fallback={<LoadingState variant="partner-dashboard" />}>
              <PartnerAgentDashboard />
            </Suspense>
          </PartnerLayout>
        )}
      </Route>
      <Route path="/partner/ca-management">
        {() => (
          <PartnerLayout>
            <PartnerCAManagement />
          </PartnerLayout>
        )}
      </Route>
      <Route path="/mutual-funds">
        {() => (
          <PartnerLayout>
            <MutualFunds />
          </PartnerLayout>
        )}
      </Route>
      <Route path="/bonds">
        {() => (
          <PartnerLayout>
            <Bonds />
          </PartnerLayout>
        )}
      </Route>
      <Route path="/unlisted">
        {() => (
          <PartnerLayout>
            <Unlisted />
          </PartnerLayout>
        )}
      </Route>
      <Route path="/theme-settings">
        {() => (
          <PartnerLayout>
            <ThemeSettings />
          </PartnerLayout>
        )}
      </Route>
      <Route>
        {() => (
          <PartnerLayout>
            <NotFound />
          </PartnerLayout>
        )}
      </Route>
    </Switch>
  );
}

function AgentRoutes() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/agent/auth" component={AuthPage} />
      {/* Public proposal preview - accessible on all subdomains */}
      <Route path="/proposal/:shareToken" component={PublicProposalPage} />
      <Route path="/">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <FieldAgentPortal />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <FieldAgentPortal />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent-portal">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <FieldAgentPortal />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/picks">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentPicks />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/proposal-builder">
        {() => (
          <AgentLayout>
            <AgentProspectWizard />
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/zoho-crm">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentZohoCRM />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/clients">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentClientsPage />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/crm/clients/:clientId">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentCrmClient360 />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/crm/pipeline">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentCrmPipeline />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/crm/tasks">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentCrmTasks />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/crm/analytics">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentCrmAnalytics />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/training">
        {() => (
          <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
            <AgentTrainingPage />
          </Suspense>
        )}
      </Route>
      <Route path="/agent/recommendation-control">
        {() => (
          <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
            <AgentRecommendationControl />
          </Suspense>
        )}
      </Route>
      <Route path="/agent/investment-advisory">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentInvestmentAdvisory />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/bond-recommendations">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentBondRecommendations />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/derivatives">
        {() => (
          <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
            <AgentDerivatives />
          </Suspense>
        )}
      </Route>
      <Route path="/agent/stock-ai">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentStockAI />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/demo-progress">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentDemoProgress />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/dashboard">
        {() => (
          <AgentLayout>
            <AgentDashboard />
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/proposals">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentProposalsPage />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/client-acquisition">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentClientAcquisitionPage />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent-prospect-wizard">
        {() => (
          <AgentLayout>
            <AgentProspectWizard />
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/treasury">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentTreasuryPage />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/tax-cases">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentTaxCasesPage />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/knowledge-hub">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentKnowledgeHub />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/knowledge-hub/market-brief">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentKnowledgeMarketBrief />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/knowledge-hub/products">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentKnowledgeProducts />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/knowledge-hub/explanations">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentKnowledgeExplanations />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/knowledge-hub/certifications">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentKnowledgeCertifications />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/festival-greetings">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <FestivalGreetingPreview />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/revenue">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentRevenueCockpit />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/leads">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentLeadPipeline />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/clients/:id">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentClientProfile />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/lead-registry">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentLeadRegistry />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/tasks">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentTasks />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/reports">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentReportsHub />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/report-builder">
        {() => <Redirect to="/agent/report-builder" />}
      </Route>
      <Route path="/agent/report-builder">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentPortfolioReportBuilder />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/sample-report">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentSampleReport />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/leaderboard">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentLeaderboard />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/commission-calculator">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentCommissionCalculator />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/payouts">
        {() => (
          <AgentLayout>
            <AgentPayoutDashboard />
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/bulk-communication">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentBulkCommunication />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/calendar">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentCalendar />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/meetings">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentMeetings />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/esign">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentESign />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/loan-apply">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentLoanApply />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/loan-marketplace">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentLoanMarketplace />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/loan-applications">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentLoanApplications />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/dsa-performance">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentDSAPerformance />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/payout-claims">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentPayoutClaims />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/admin/agent-payouts">
        {() => (
          <AdminLayout>
            <Suspense fallback={<LoadingState variant="dashboard" />}>
              <AdminAgentPayouts />
            </Suspense>
          </AdminLayout>
        )}
      </Route>
      <Route path="/agent/onboard-client">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentClientOnboarding />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/kyc">
        {() => (
          <AgentLayout>
            <OnboardingPage />
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/orders">
        {() => (
          <AgentLayout>
            <MutualFunds />
          </AgentLayout>
        )}
      </Route>
      <Route path="/settings">
        {() => (
          <AgentLayout>
            <SettingsPage />
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/research-lists">
        {() => (
          <Suspense fallback={<LoadingState />}>
            <AgentResearchLists />
          </Suspense>
        )}
      </Route>
      <Route path="/agent/research-lists/:id">
        {() => (
          <Suspense fallback={<LoadingState />}>
            <AgentResearchListDetail />
          </Suspense>
        )}
      </Route>
      <Route path="/agent/screener">
        {() => (
          <Suspense fallback={<LoadingState />}>
            <AgentScreener />
          </Suspense>
        )}
      </Route>
      <Route path="/agent/research-analytics">
        {() => (
          <Suspense fallback={<LoadingState />}>
            <AgentResearchAnalytics />
          </Suspense>
        )}
      </Route>
      <Route path="/agent/theme-settings">
        {() => (
          <Suspense fallback={<LoadingState />}>
            <AgentThemeSettings />
          </Suspense>
        )}
      </Route>
      <Route path="/agent/settings">
        {() => (
          <AgentLayout>
            <SettingsPage />
          </AgentLayout>
        )}
      </Route>
      <Route>
        {() => (
          <AgentLayout>
            <NotFound />
          </AgentLayout>
        )}
      </Route>
    </Switch>
  );
}

function IdleTimeoutWrapper() {
  const { user } = useAuth();
  return <IdleTimeoutManager isAuthenticated={!!user} timeoutMinutes={15} />;
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
        <Route path="/auth" component={AuthPage} />
        <Route path="/profile" component={Profile} />
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
        
        {/* User routes - require both authentication and profile completion */}
        <Route component={UserProtectedRoutes} />
      </Switch>
    </LayoutResolver>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <NetworkProvider>
      <LowDataProvider>
        <ThemeProvider>
        <QueryClientProvider client={queryClient}>
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
              <Router />
            </TooltipProvider>
          </UnifiedCartProvider>
          </UserPreferencesProvider>
        </QueryClientProvider>
      </ThemeProvider>
        </LowDataProvider>
    </NetworkProvider>
    </ErrorBoundary>
  );
}

export default App;
