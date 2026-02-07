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
import Portfolio from "@/pages/portfolio";
import Markets from "@/pages/markets";
import IPO from "@/pages/ipo";
import PreIPO from "@/pages/pre-ipo";
import MutualFunds from "@/pages/mutual-funds";
import FundComparison from "@/pages/fund-comparison";
import PortfolioComparison from "@/pages/portfolio-comparison";
import Unlisted from "@/pages/unlisted";
import Loans from "@/pages/loans";
import NSDLServices from "@/pages/nsdl-services";
import CDSLServices from "@/pages/cdsl-services";
import CamsServices from "@/pages/cams-services";
import KfintechServices from "@/pages/kfintech-services";
import AgriculturalInsights from "@/pages/agricultural-insights";
import FinancialCalculators from "@/pages/financial-calculators";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import AdminPanel from "@/pages/admin";
import TesterDiagnostics from "@/pages/tester-diagnostics";
const PartnerPortal = lazy(() => import("@/pages/partner-portal"));
import Support from "@/pages/support";
import InvestSmart from "@/pages/wealth-management";
import Achievements from "@/pages/achievements";
import CapitalGainsReports from "@/pages/capital-gains-reports";
import ReportsHub from "@/pages/reports-hub";
import TransactionReports from "@/pages/transaction-reports";
import AgentDashboard from "@/pages/agent-dashboard";
import AgentPicks from "@/pages/agent-picks";
import IBTradingPage from "@/pages/ib-trading";
import StorePage from "@/pages/store";
import GiftCity from "@/pages/gift-city";
import Cart from "@/pages/cart";
import Orders from "@/pages/orders";
import ApiMonitorDemo from "@/pages/api-monitor-demo";
import ICICILoans from "@/pages/icici-loans";
import HDFCLoans from "@/pages/hdfc-loans";
import ClientAutoPopulate from "@/pages/client-auto-populate";
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";
import RefundPolicy from "@/pages/refund-policy";
import InvestmentDisclaimer from "@/pages/disclaimer";
import AIF from "@/pages/aif";
import AIFDetail from "@/pages/aif-detail";
import PMS from "@/pages/pms";
import PMSDetail from "@/pages/pms-detail";
import AlternativeInvestments from "@/pages/alternative-investments";
import MldStore from "@/pages/mld-store";
import MldDetail from "@/pages/mld-detail";
import BajajFinance from "@/pages/bajaj-finance";
import TataCapital from "@/pages/tata-capital";
import PolicyBazaar from "@/pages/policybazaar";
import Cibil from "@/pages/cibil";
import Contact from "@/pages/contact";
import { SupplierManagement } from "@/pages/supplier-management";
import Profile from "@/pages/profile";
import ProfileCompletionGuard from "@/components/ProfileCompletionGuard";
import { AppLayout } from "@/components/layout/app-layout";
import { AdminLayout } from "@/components/layout/admin-layout";
import { AgentLayout } from "@/components/layout/agent-layout";
import { PartnerLayout } from "@/components/layout/partner-layout";
import { LayoutResolver } from "@/components/layout/LayoutResolver";
import { useSubdomain } from "@/hooks/useSubdomain";
import { useAuth } from "@/hooks/useAuth";
import { IdleTimeoutManager } from "@/components/IdleTimeoutManager";
import AdminDashboard from "@/pages/admin/dashboard";
import SystemHealthMonitor from "@/pages/admin/system-health";
import EngineHealthCheck from "@/pages/admin/engine-health-check";
import RevenueAnalytics from "@/pages/admin/revenue-analytics";
import UserActivityTimeline from "@/pages/admin/user-activity-timeline";
import BulkOperations from "@/pages/admin/bulk-operations";
import ComplianceDashboardPage from "@/pages/admin/compliance-dashboard";
import NotificationManagement from "@/pages/admin/notification-management";
import FeatureFlags from "@/pages/admin/feature-flags";
import ParserConfigPage from "@/pages/admin/parser-config";
import AdminESignManagement from "@/pages/admin/esign-management";
import ReportBuilder from "@/pages/admin/report-builder";
import StakeholdersPage from "@/pages/admin/stakeholders";
import KycCompliancePage from "@/pages/admin/kyc-compliance";
import FinancialOperationsPage from "@/pages/admin/financial-operations";
import APIConfiguration from "@/pages/admin/api-configuration";
import ProductionReadiness from "@/pages/admin/production-readiness";
import ReplitSuggestions from "@/pages/admin/replit-suggestions";
import ActivityCentre from "@/pages/admin/activity-centre";
import CkycDeferredDashboard from "@/pages/admin/ckyc-deferred-dashboard";
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
import BBPSPage from "@/pages/BBPSPage";
import DigiLockerPage from "@/pages/DigiLockerPage";
import LoanApplication from "@/pages/loan-application";
import LoanDashboard from "@/pages/loan-dashboard";
import LoanApplyPage from "@/pages/loan-apply";
import ProposalsPage from "@/pages/proposals";
import BrokingPage from "@/pages/broking";
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
import OnboardingPage from "@/pages/onboarding";
import PublicProposalPage from "@/pages/public-proposal";
import ManualKYCPage from "@/pages/manual-kyc";
import NetWorthPage from "@/pages/net-worth";
import AdminProposalsPage from "@/pages/admin-proposals";
import ClientProposalsPage from "@/pages/client-proposals";
import MyProposalsPage from "@/pages/my-proposals";
import ClientSmartProposals from "@/pages/client-smart-proposals";
import TaxDocuments from "@/pages/tax-documents";
import ITRPrefilled from "@/pages/itr-prefilled";
import TaxDataCenter from "@/pages/tax-data-center";
import TaxSmartFiling from "@/pages/tax-smart-filing";
import OneClickTaxFiling from "@/pages/one-click-tax-filing";
import TaxITRPage from "@/pages/tax-itr";
import TaxITRSelfPage from "@/pages/tax-itr-self";
import TaxITRExpertPage from "@/pages/tax-itr-expert";
import TaxITRPreviewPage from "@/pages/tax-itr-preview";
import TaxITRPaymentPage from "@/pages/tax-itr-payment";
import TaxITRVerifyPage from "@/pages/tax-itr-verify";
import TaxNoticesPage from "@/pages/tax-notices";
import TaxDocumentVaultPage from "@/pages/tax-document-vault";
import TaxCADeskPage from "@/pages/tax-ca-desk";
import PropertyServices from "@/pages/property-services";
import LoanComparison from "@/pages/loan-comparison";
import LoanRecommendations from "@/pages/loan-recommendations";
const PartnerApplication = lazy(() => import("@/pages/partner-application"));
import InvestmentDashboard from "@/pages/investment-dashboard";
import NRIServices from "@/pages/nri-services";
import ITRTaxServices from "@/pages/itr-tax-services";
import DomesticTrading from "@/pages/domestic-trading";
import GlobalTrading from "@/pages/global-trading";
import GlobalAdvisoryPage from "@/pages/global-advisory";
import USTrading from "@/pages/us-trading";
import IntelligentTaxHub from "@/pages/intelligent-tax-hub";
import TaxReminderSubscription from "@/pages/tax-reminder-subscription";
import MLDs from "@/pages/mlds";
import UnifiedCart from "@/pages/unified-cart";
import Insurance from "@/pages/insurance";
import BankingProducts from "@/pages/banking-products";
import Bonds from "@/pages/bonds";
import BondCategoryPage from "@/pages/bond-category";
import BondDetailPage from "@/pages/bond-detail";
import FixedIncomeMarketplace from "@/pages/fixed-income-marketplace";
import FamilyList from "@/pages/family-list";
import FamilyDashboard from "@/pages/family-dashboard";
import AIChat from "@/pages/ai-chat";
import CorporateKYCPage from "@/pages/CorporateKYCPage";
import AlertsPage from "@/pages/alerts";
import SettingsPage from "@/pages/settings";
import CreditReportPage from "@/pages/credit-report";
import DerivativesPage from "@/pages/derivatives";
import CommoditiesPage from "@/pages/commodities";
import CreditCardsPage from "@/pages/credit-cards";
import ProfessionalServicesPage from "@/pages/professional-services";
import ExpensesBudgets from "@/pages/expenses-budgets";
import AutoPopulationDashboard from "@/pages/auto-population-dashboard";
import GovernmentSchemes from "@/pages/government-schemes";
import ReferralProgram from "@/pages/referral-program";
import ScheduledReports from "@/pages/scheduled-reports";
import CompoundAlerts from "@/pages/compound-alerts";
import DashboardCustomize from "@/pages/dashboard-customize";
import ThemeSettings from "@/pages/theme-settings";
import AgentProspectWizard from "@/pages/agent-prospect-wizard";
import MarketingDashboard from "@/pages/admin/marketing-dashboard";
import FestivalMarketing from "@/pages/admin/festival-marketing";
import EmailCampaigns from "@/pages/admin/email-campaigns";
import WhatsAppCampaigns from "@/pages/admin/whatsapp-campaigns";
import SMSCampaigns from "@/pages/admin/sms-campaigns";
import SmsInbox from "@/pages/admin/sms-inbox";
import LeadProspecting from "@/pages/admin/lead-prospecting";
import McaIntelligence from "@/pages/admin/mca-intelligence";
import McaCompanyProfile from "@/pages/admin/mca-company-profile";
import ProspectAnalytics from "@/pages/admin/prospect-analytics";
import ClientIntelligence from "@/pages/admin/client-intelligence";
import MarketingAnalytics from "@/pages/admin/marketing-analytics";
import AgentPerformanceDashboard from "@/pages/admin/agent-performance";
import DemoProposalsTracking from "@/pages/admin/demo-proposals";
import AdminTaskOversight from "@/pages/admin/task-oversight";
import UserManagement from "@/pages/admin/user-management";
import CAManagement from "@/pages/admin/ca-management";
import PredictiveAnalytics from "@/pages/PredictiveAnalytics";
import UnlistedCompaniesAdmin from "@/pages/admin/UnlistedCompaniesAdmin";
import UnlistedNegotiations from "@/pages/admin/UnlistedNegotiations";
import UnlistedDashboard from "@/pages/admin/unlisted-dashboard";
import BondMarketplaceDashboard from "@/pages/admin/bond-marketplace-dashboard";
import GlobalAdvisoryManagement from "@/pages/admin/global-advisory-management";
import UnlistedOrders from "@/pages/admin/unlisted-orders";
import OrderAuditDashboard from "@/pages/admin/order-audit";
import UnlistedAuditLog from "@/pages/admin/unlisted-audit-log";
import UnlistedComplianceAlerts from "@/pages/admin/unlisted-compliance-alerts";
import UnlistedRegulatoryCompliance from "@/pages/admin/unlisted-regulatory-compliance";
import FixedIncomeAdmin from "@/pages/admin/FixedIncomeAdmin";
import BondCommissionSettings from "@/pages/admin/bond-commission-settings";
import CommissionMaster from "@/pages/admin/commission-master";
import AdminLoanManagement from "@/pages/admin-loan-management";
import AdminDsaLoanDashboard from "@/pages/admin/dsa-loan-dashboard";
import CommissionLedger from "@/pages/admin/commission-ledger";
import EligibilityMatrix from "@/pages/admin/eligibility-matrix";
import AdminDLM from "@/pages/admin-dlm";
import AdminDLMNegotiate from "@/pages/admin-dlm-negotiate";
import AdminStoreManager from "@/pages/admin/store-manager";
import BrowseUnlisted from "@/pages/unlisted/BrowseUnlisted";
import CompanyDetails from "@/pages/unlisted/CompanyDetails";
import CreateSellListing from "@/pages/unlisted/CreateSellListing";
import CreateBuyRequest from "@/pages/unlisted/CreateBuyRequest";
import MyOrders from "@/pages/unlisted/MyOrders";
import UnlistedCartPage from "@/pages/unlisted/Cart";
import CASupportDashboard from "@/pages/ca-support-dashboard";
import CASupportDetail from "@/pages/ca-support-detail";
import CARegistration from "@/pages/ca-registration";
import CADashboard from "@/pages/ca-dashboard";
import PartnerAgentDashboard from "@/pages/partner-agent-dashboard";
import PartnerCAManagement from "@/pages/partner-ca-management";
import AgentPayoutDashboard from "@/pages/agent-payout-dashboard";
import AdminPayoutManagement from "@/pages/admin-payout-management";
import AdminMappingRequests from "@/pages/admin-mapping-requests";
import FreshInvestmentDiscovery from "@/pages/fresh-investment-discovery";
import TDSCompliance from "@/pages/tds-compliance";
import AIProposalsPage from "@/pages/ai-proposals";
import AIProposalReviewPage from "@/pages/ai-proposal-review";
import AIStockPicks from '@/pages/ai-stock-picks';
import GoalsPage from "@/pages/goals";
import InvestableSurplusPage from "@/pages/investable-surplus";
import TaxComplianceForm15Page from "@/pages/tax-compliance-form15";
import RiskProfilingPage from "@/pages/risk-profiling";
import RiskQuestionnaireBuilder from "@/pages/admin/risk-questionnaire-builder";
import RiskComplianceExport from "@/pages/admin/risk-compliance-export";
import AdminDatabase from "@/pages/admin/database";
import AdminAadhaarConfig from "@/pages/admin-aadhaar-config";
import ExchangeFilingsAdmin from "@/pages/admin/exchange-filings";
import AdminApiUsage from "@/pages/admin-api-usage";
import AdminMFEnrichment from "@/pages/admin-mf-enrichment";
import AdminMfBenchmarks from "@/pages/admin-mf-benchmarks";
import AdminDataEnrichment from "@/pages/admin-data-enrichment";
import AdminAiRecommendationTracking from "@/pages/admin-ai-recommendation-tracking";
import AdminReportsHub from "@/pages/admin/reports-hub";
import AdminAIInsights from "@/pages/admin/ai-insights";
import AdminAgentOversightPage from "@/pages/admin/agent-oversight";
import AdminAppointmentsDashboard from "@/pages/admin/appointments-dashboard";
import ClientTasks from "@/pages/client-tasks";
import ClientAIRecommendations from "@/pages/client-ai-recommendations";
import ClientReports from "@/pages/client-reports";
import ReitInvitPage from "@/pages/reit-invit";
import VideoKYC from "@/pages/video-kyc";
import PortfolioStressTest from "@/pages/portfolio-stress-test";
import DividendCalendar from "@/pages/dividend-calendar";
import TaxLossHarvesting from "@/pages/tax-loss-harvesting";
import TaxRegimeComparison from "@/pages/tax-regime-comparison";
import AgentFieldView from "@/pages/agent-field-view";
import AgentPerformance from "@/pages/agent-performance";
import NotificationPreferences from "@/pages/notification-preferences";
import AIPortfolioReport from "@/pages/ai-portfolio-report";
import PortfolioHoldings from "@/pages/portfolio-holdings";
import PortfolioGoals from "@/pages/portfolio-goals";
import PortfolioRetirement from "@/pages/portfolio-retirement";
import PortfolioAIInsights from "@/pages/portfolio-ai-insights";
import PortfolioRebalancing from "@/pages/portfolio-rebalancing";
import PortfolioImport from "@/pages/portfolio-import";
import TrackerPortfolioReport from "@/pages/tracker-portfolio-report";
import AgentExternalPortfolios from "@/pages/agent-external-portfolios";

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
        <Route path="/partner/proposals">
          {() => (
            <Suspense fallback={<LoadingState variant="partner-dashboard" />}>
              <AgentProspectProposals />
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
      <Route path="/partner/proposals">
        {() => (
          <PartnerLayout>
            <Suspense fallback={<LoadingState variant="partner-dashboard" />}>
              <AgentProspectProposals />
            </Suspense>
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
    return (<><IdleTimeoutWrapper /><AdminRoutes /></>);
  }

  // Render partner portal on partner subdomain
  if (isPartnerPortal) {
    return (<><IdleTimeoutWrapper /><PartnerRoutes /></>);
  }

  // Render agent portal on agent subdomain
  if (isAgentPortal) {
    return (<><IdleTimeoutWrapper /><AgentRoutes /></>);
  }

  // Render client portal on main domain
  return (
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
        <Route path="/video-kyc" component={VideoKYC} />
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
