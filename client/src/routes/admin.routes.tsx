import { Suspense, useEffect } from "react";
import { Redirect, Route, Switch, useLocation } from "wouter";
import { LoadingState } from "@/components/LoadingState";
import { AdminLayout } from "@/components/layout/admin-layout";
import { lazyWithRetry } from "@/lib/lazy-with-retry";
import { useAuth } from "@/hooks/useAuth";
import { useSubdomain } from "@/hooks/useSubdomain";
import AuthPage from "@/pages/auth-page";
import NotFound from "@/pages/not-found";

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

export function AdminRoutes() {
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
      <Route path="/admin/approval-queue">
        {() => (
          <AdminLayout>
            <Suspense fallback={<LoadingState variant="dashboard" />}>
              <AdminApprovalQueue />
            </Suspense>
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


