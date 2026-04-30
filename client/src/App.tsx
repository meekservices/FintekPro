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
const AgentTracker = lazyWithRetry(() => import("@/pages/agent-tracker"));

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
        <Route path="/partner/my-team" component={PartnerTeamManagement} />
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
        <Route path="/us-trading" component={AlpacaClientHub} />
        <Route path="/us-trading/hub" component={AlpacaClientHub} />
        <Route path="/us-trading/classic" component={USTrading} />
        <Route path="/us-trading/open-account" component={OpenAccountPage} />
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
        <Route path="/biometric-settings" component={BiometricSettingsPage} />
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
      <Route path="/admin/institutional-data">
        {() => (
          <AdminLayout>
            <InstitutionalData />
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
      <Route path="/admin/whatsapp-setup">
        {() => (
          <AdminLayout>
            <WhatsAppSetup />
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
      <Route path="/admin/pricing-engine">
        {() => (
          <AdminLayout>
            <GoldenPricingDashboard />
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
      <Route path="/admin/mf-analytics-ops">
        {() => (
          <AdminLayout>
            <MFAnalyticsOps />
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
      <Route path="/admin/regulatory-audit-norms">
        {() => (
          <AdminLayout>
            <Suspense fallback={<LoadingState variant="dashboard" />}>
              <RegulatoryAuditNormsPage />
            </Suspense>
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
      <Route path="/admin/sebi-mf-compliance">
        {() => (
          <AdminLayout>
            <Suspense fallback={<LoadingState variant="dashboard" />}>
              <SEBIMFCompliance />
            </Suspense>
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
      <Route path="/admin/broker-dashboard">
        {() => (
          <AdminLayout>
            <Suspense fallback={<LoadingState variant="dashboard" />}>
              <AdminBrokerDashboard />
            </Suspense>
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/alpaca-hub">
        {() => (
          <AdminLayout>
            <Suspense fallback={<LoadingState variant="dashboard" />}>
              <AlpacaHubAdmin />
            </Suspense>
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/iris">
        {() => (
          <AdminLayout>
            <Suspense fallback={<LoadingState variant="dashboard" />}>
              <AdminIrisOverview />
            </Suspense>
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
      <Route path="/admin/partner-hierarchy">
        {() => (
          <AdminLayout>
            <AdminPartnerHierarchy />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/firm-inventory">
        {() => (
          <AdminLayout>
            <AdminFirmInventory />
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
      <Route path="/admin/kyc-flow">
        {() => (
          <AdminLayout>
            <AdminKycFlow />
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
      <Route path="/admin/data-providers">
        {() => (
          <AdminLayout>
            <AdminDataProviders />
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
      {/* KYC & onboarding flow - admin users go through the same flow as clients */}
      <Route path="/profile" component={Profile} />
      <Route path="/onboarding" component={OnboardingPage} />
      <Route path="/manual-kyc" component={ManualKYCPage} />
      <Route path="/video-kyc" component={VideoKYC} />
      <Route path="/kyc-rejections" component={KycRejectionRekyc} />
      <Route path="/product-eligibility" component={KYCProductEligibility} />
      <Route path="/ca-registration" component={CARegistration} />
      <Route path="/net-worth" component={NetWorthPage} />
      <Route path="/kyc-dashboard">
        <Redirect to="/profile?tab=kyc-dashboard" />
      </Route>
      <Route path="/kyc/complete">
        <Redirect to="/profile?tab=kyc-dashboard" />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function PartnerRoutes() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/partner/auth" component={AuthPage} />
      <Route path="/partner/register">
        {() => (
          <Suspense fallback={<div className="min-h-screen bg-indigo-950 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-violet-500"></div></div>}>
            <PartnerRegister />
          </Suspense>
        )}
      </Route>
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
      <Route path="/partner/revenue-sheet">
        {() => (
          <PartnerLayout>
            <Suspense fallback={<LoadingState variant="partner-dashboard" />}>
              <PartnerRevenueSheet />
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
      <Route path="/partner/my-team">
        {() => (
          <PartnerLayout>
            <Suspense fallback={<LoadingState variant="partner-dashboard" />}>
              <PartnerTeamManagement />
            </Suspense>
          </PartnerLayout>
        )}
      </Route>
      <Route path="/partner/my-profile">
        {() => (
          <PartnerLayout>
            <Suspense fallback={<LoadingState variant="partner-dashboard" />}>
              <PartnerMyProfile />
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
      {/* KYC & Profile — partners share the same full profile/KYC page */}
      <Route path="/profile">
        {() => (
          <PartnerLayout>
            <Suspense fallback={<LoadingState variant="partner-dashboard" />}>
              <Profile />
            </Suspense>
          </PartnerLayout>
        )}
      </Route>
      <Route path="/onboarding" component={OnboardingPage} />
      <Route path="/video-kyc" component={VideoKYC} />
      <Route path="/kyc-dashboard">
        <Redirect to="/profile?tab=kyc-dashboard" />
      </Route>
      <Route path="/kyc/complete">
        <Redirect to="/profile?tab=kyc-dashboard" />
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

// AgentRoot: shows AuthPage if not logged in, FieldAgentPortal if logged in.
// This makes /?agent=true work as the agent sign-in page directly.
function AgentRoot() {
  const { user, isLoading, error } = useAuth();
  
  if (isLoading) return <LoadingState variant="agent-dashboard" />;
  
  // If we get a persistent error and no user, show the auth page as fallback.
  // This prevents the "white page" (stuck loading) issue if the initial auth check fails.
  if (error && !user) {
    console.warn("⚠️ Agent Portal authentication check failed:", error);
    return <AuthPage />;
  }
  
  if (!user) return <AuthPage />;
  
  return (
    <AgentLayout>
      <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
        <FieldAgentPortal />
      </Suspense>
    </AgentLayout>
  );
}


function AgentRoutes() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/agent/auth" component={AuthPage} />
      <Route path="/agent/login" component={AuthPage} />
      {/* Public proposal preview - accessible on all subdomains */}
      <Route path="/proposal/:shareToken" component={PublicProposalPage} />
      <Route path="/agent/advisor-profile">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AdvisorBrandProfile />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/" component={AgentRoot} />
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
      <Route path="/agent/tracker">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentTracker />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/baskets">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentInvestmentBaskets />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/sip-health">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentSipHealth />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/portfolio-drift">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentPortfolioDrift />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/market-alerts">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentMarketAlerts />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/advisor/:code">
        {() => (
          <Suspense fallback={<LoadingState />}>
            <PublicAdvisorProfile />
          </Suspense>
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
      <Route path="/agent/us-client-accounts">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentUsClientAccounts />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/alpaca-hub">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AlpacaHubAgent />
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
      <Route path="/agent/loan-applications">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentLoanApplications />
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
      <Route path="/agent/revenue-sheet">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentRevenueSheet />
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
            <AgentKycEmpanelment />
          </AgentLayout>
        )}
      </Route>
      <Route path="/onboarding">
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
      <Route path="/agent/quant-analytics">
        {() => (
          <Suspense fallback={<LoadingState />}>
            <AgentLayout>
              <AgentQuantAnalytics />
            </AgentLayout>
          </Suspense>
        )}
      </Route>
      <Route path="/agent/research/generate">
        {() => (
          <Suspense fallback={<LoadingState />}>
            <ResearchNoteGenerator />
          </Suspense>
        )}
      </Route>
      <Route path="/agent/hni-leaderboard">
        {() => (
          <Suspense fallback={<LoadingState />}>
            <AgentHniLeaderboard />
          </Suspense>
        )}
      </Route>
      <Route path="/agent/deal-matcher">
        {() => (
          <Suspense fallback={<LoadingState />}>
            <AgentDealMatcher />
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
      <Route path="/profile">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <Profile />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/kyc-rejections">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <KycRejectionRekyc />
            </Suspense>
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent/iris">
        {() => (
          <AgentLayout>
            <Suspense fallback={<LoadingState variant="agent-dashboard" />}>
              <AgentIrisHub />
            </Suspense>
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
        <Route path="/excel-addin" component={ExcelAddin} />
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
