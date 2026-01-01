import { Switch, Route, useLocation, Redirect } from "wouter";
import { lazy, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GDPRConsent } from "@/components/gdpr-consent";
import { ThemeProvider } from "@/contexts/theme-context";
import { LowDataProvider } from "@/contexts/LowDataContext";
import { UnifiedCartProvider } from "@/contexts/UnifiedCartContext";
import { NetworkProvider } from "@/hooks/use-network-state";
import { NetworkStatusBanner } from "@/components/NetworkStatusBanner";
import { DSCBackgroundSync } from "@/components/DSCBackgroundSync";
import { GlobalActionQueueMonitor } from "@/components/GlobalActionQueueMonitor";
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
import PartnerPortal from "@/pages/partner-portal";
import Support from "@/pages/support";
import InvestSmart from "@/pages/wealth-management";
import Achievements from "@/pages/achievements";
import CapitalGainsReports from "@/pages/capital-gains-reports";
import ReportsHub from "@/pages/reports-hub";
import TransactionReports from "@/pages/transaction-reports";
import AgentDashboard from "@/pages/agent-dashboard";
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
import AdminDashboard from "@/pages/admin/dashboard";
import SystemHealthMonitor from "@/pages/admin/system-health";
import RevenueAnalytics from "@/pages/admin/revenue-analytics";
import UserActivityTimeline from "@/pages/admin/user-activity-timeline";
import BulkOperations from "@/pages/admin/bulk-operations";
import ComplianceDashboardPage from "@/pages/admin/compliance-dashboard";
import NotificationManagement from "@/pages/admin/notification-management";
import FeatureFlags from "@/pages/admin/feature-flags";
import ReportBuilder from "@/pages/admin/report-builder";
import StakeholdersPage from "@/pages/admin/stakeholders";
import KycCompliancePage from "@/pages/admin/kyc-compliance";
import FinancialOperationsPage from "@/pages/admin/financial-operations";
import APIConfiguration from "@/pages/admin/api-configuration";
import ProductionReadiness from "@/pages/admin/production-readiness";
import ReplitSuggestions from "@/pages/admin/replit-suggestions";
import ErrorCommandCenter from "@/pages/admin/error-command-center";
import ZohoDashboardPage from "@/pages/admin/zoho-dashboard";
import ZohoConnectionsPage from "@/pages/admin/zoho-connections";
import ZohoLogsPage from "@/pages/admin/zoho-logs";
import ZohoBooksPage from "@/pages/admin/zoho-books";
import StoreManagement from "@/pages/admin/store-management";
import BondSeedAdmin from "@/pages/admin/bond-seed";
import MldSeedAdmin from "@/pages/admin/mld-seed";
import AifSeedAdmin from "@/pages/admin/aif-seed";
import PmsSeedAdmin from "@/pages/admin/pms-seed";
import MutualFundsSeeding from "@/pages/admin/mutual-funds-seeding";
import ListedStocksSeed from "@/pages/admin/listed-stocks-seed";
import SeedUnlistedPage from "@/pages/admin/seed-unlisted";
import UnlistedPreviewPage from "@/pages/admin/unlisted-preview";
import UnlistedPricingPreviewPage from "@/pages/admin/unlisted-pricing-preview";
import DuplicateManagementPage from "@/pages/admin/duplicate-management";
import BBPSPage from "@/pages/BBPSPage";
import DigiLockerPage from "@/pages/DigiLockerPage";
import LoanApplication from "@/pages/loan-application";
import LoanDashboard from "@/pages/loan-dashboard";
import ProposalsPage from "@/pages/proposals";
import BrokingPage from "@/pages/broking";
import AgentPortal from "@/pages/agent-portal";
import DistributionPartnerPortal from "@/pages/distribution-partner-portal";
import FieldAgentPortal from "@/pages/field-agent-portal";
import AgentClientsPage from "@/pages/agent-clients";
import AgentCrmClient360 from "@/pages/agent-crm-client-360";
import AgentCrmPipeline from "@/pages/agent-crm-pipeline";
import AgentCrmTasks from "@/pages/agent-crm-tasks";
import AgentCrmAnalytics from "@/pages/agent-crm-analytics";
import AgentInvestmentAdvisory from "@/pages/agent-investment-advisory";
import AgentRecommendationControl from "@/pages/agent-recommendation-control";
import AgentTrainingPage from "@/pages/agent-training";
import AgentProposalsPage from "@/pages/agent-proposals";
import AgentClientAcquisitionPage from "@/pages/agent-client-acquisition";
import AgentBondRecommendations from "@/pages/agent-bond-recommendations";
import AgentStockAI from "@/pages/agent-stock-ai";
import AgentDerivatives from "@/pages/agent-derivatives";
import AgentTreasuryPage from "@/pages/agent-treasury";
import AgentTaxCasesPage from "@/pages/agent-tax-cases";
import AgentRevenueCockpit from "@/pages/agent-revenue-cockpit";
import AgentLeadPipeline from "@/pages/agent-lead-pipeline";
import AgentClientProfile from "@/pages/agent-client-profile";
import AgentTasks from "@/pages/agent-tasks";
import AgentReportsHub from "@/pages/agent-reports-hub";
import AgentDemoProgress from "@/pages/agent-demo-progress";
import AgentPortfolioReportBuilder from "@/pages/agent-portfolio-report-builder";
import AgentDemoProposalBuilder from "@/pages/agent-demo-proposal-builder";
import AgentLeaderboard from "@/pages/agent-leaderboard";
import AgentCommissionCalculator from "@/pages/agent-commission-calculator";
import AgentBulkCommunication from "@/pages/agent-bulk-communication";
import AgentCalendar from "@/pages/agent-calendar";
import AgentESign from "@/pages/agent-esign";
import AgentClientOnboarding from "@/pages/agent-client-onboarding";
import OnboardingPage from "@/pages/onboarding";
import PublicProposalPage from "@/pages/public-proposal";
import ManualKYCPage from "@/pages/manual-kyc";
import NetWorthPage from "@/pages/net-worth";
import AdminProposalsPage from "@/pages/admin-proposals";
import ClientProposalsPage from "@/pages/client-proposals";
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
import PartnerApplication from "@/pages/partner-application";
import InvestmentDashboard from "@/pages/investment-dashboard";
import NRIServices from "@/pages/nri-services";
import ITRTaxServices from "@/pages/itr-tax-services";
import DomesticTrading from "@/pages/domestic-trading";
import GlobalTrading from "@/pages/global-trading";
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
import MarketingDashboard from "@/pages/admin/marketing-dashboard";
import EmailCampaigns from "@/pages/admin/email-campaigns";
import WhatsAppCampaigns from "@/pages/admin/whatsapp-campaigns";
import LeadProspecting from "@/pages/admin/lead-prospecting";
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
import UnlistedOrders from "@/pages/admin/unlisted-orders";
import OrderAuditDashboard from "@/pages/admin/order-audit";
import UnlistedAuditLog from "@/pages/admin/unlisted-audit-log";
import UnlistedComplianceAlerts from "@/pages/admin/unlisted-compliance-alerts";
import FixedIncomeAdmin from "@/pages/admin/FixedIncomeAdmin";
import BondCommissionSettings from "@/pages/admin/bond-commission-settings";
import CommissionMaster from "@/pages/admin/commission-master";
import AdminLoanManagement from "@/pages/admin-loan-management";
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
import AdminAadhaarConfig from "@/pages/admin-aadhaar-config";
import AdminApiUsage from "@/pages/admin-api-usage";
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

function UserProtectedRoutes() {
  return (
    <ProfileCompletionGuard>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/dashboard" component={Home} />
        <Route path="/portfolio" component={Portfolio} />
        <Route path="/portfolio-stress-test" component={PortfolioStressTest} />
        <Route path="/dividend-calendar" component={DividendCalendar} />
        <Route path="/tax-loss-harvesting" component={TaxLossHarvesting} />
        <Route path="/tax-regime-comparison" component={TaxRegimeComparison} />
        <Route path="/agent-field-view" component={AgentFieldView} />
        <Route path="/agent-performance" component={AgentPerformance} />
        <Route path="/notification-preferences" component={NotificationPreferences} />
        <Route path="/ai-portfolio-report" component={AIPortfolioReport} />
        <Route path="/risk-profiling" component={RiskProfilingPage} />
        <Route path="/analytics" component={PredictiveAnalytics} />
        <Route path="/comprehensive-portfolio">{() => {
          const ComprehensivePortfolio = lazy(() => import("@/pages/comprehensive-portfolio"));
          return <ComprehensivePortfolio />;
        }}</Route>
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
        <Route path="/partner" component={PartnerPortal} />
        <Route path="/partner/ca-dashboard" component={CADashboard} />
        <Route path="/partner/ca-support" component={CASupportDashboard} />
        <Route path="/partner/ca-support/:id" component={CASupportDetail} />
        <Route path="/support" component={Support} />
        <Route path="/wealth" component={InvestSmart} />
        <Route path="/investsmart" component={InvestSmart} />
        <Route path="/wealth-management" component={InvestSmart} />
        <Route path="/proposals" component={ProposalsPage} />
        <Route path="/my-proposals" component={ClientProposalsPage} />
        <Route path="/achievements" component={Achievements} />
        <Route path="/capital-gains" component={CapitalGainsReports} />
        <Route path="/reports" component={ReportsHub} />
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
        <Route path="/partner-application/:lender" component={PartnerApplication} />
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
        <Route path="/investable-surplus" component={InvestableSurplusPage} />
        <Route path="/ai-proposal-review/:id" component={AIProposalReviewPage} />
        {/* Admin seed pages accessible from main site for development */}
        <Route path="/admin/aif-seed" component={AifSeedAdmin} />
        <Route path="/admin/pms-seed" component={PmsSeedAdmin} />
        <Route path="/admin/mld-seed" component={MldSeedAdmin} />
      </Switch>
    </ProfileCompletionGuard>
  );
}

// Component to handle admin root redirect
function AdminRoot() {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();
  
  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/auth');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isLoading]);
  
  if (isLoading) {
    return null;
  }
  
  if (!user) {
    return null;
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
      
      {/* Protected admin routes - wrapped in AdminLayout */}
      <Route path="/" component={AdminRoot} />
      <Route path="/admin" component={AdminRoot} />
      
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
        {() => (
          <AdminLayout>
            <ReplitSuggestions />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/zoho-dashboard">
        {() => (
          <AdminLayout>
            <ZohoDashboardPage />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/zoho-connections">
        {() => (
          <AdminLayout>
            <ZohoConnectionsPage />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/zoho-logs">
        {() => (
          <AdminLayout>
            <ZohoLogsPage />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/zoho-books">
        {() => (
          <AdminLayout>
            <ZohoBooksPage />
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
      <Route path="/admin/lead-prospecting">
        {() => (
          <AdminLayout>
            <LeadProspecting />
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
      <Route path="/admin/appointments">
        {() => (
          <AdminLayout>
            <AdminAppointmentsDashboard />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/agent-oversight">
        {() => (
          <AdminLayout>
            <AdminAgentOversightPage />
          </AdminLayout>
        )}
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
            <DuplicateManagementPage />
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
      <Route path="/admin/store-management">
        {() => (
          <AdminLayout>
            <StoreManagement />
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
      <Route path="/admin/store/seed-unlisted">
        {() => (
          <AdminLayout>
            <SeedUnlistedPage />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/unlisted/preview/:id">
        {() => (
          <AdminLayout>
            <UnlistedPreviewPage />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/unlisted/pricing-preview/:companyId">
        {() => (
          <AdminLayout>
            <UnlistedPricingPreviewPage />
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
      <Route path="/admin/unlisted/seed">
        {() => (
          <AdminLayout>
            <SeedUnlistedPage />
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
            <BondSeedAdmin />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/mld-seed">
        {() => (
          <AdminLayout>
            <MldSeedAdmin />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/aif-seed">
        {() => (
          <AdminLayout>
            <AifSeedAdmin />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/pms-seed">
        {() => (
          <AdminLayout>
            <PmsSeedAdmin />
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
            <MutualFundsSeeding />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/listed-stocks-seed">
        {() => (
          <AdminLayout>
            <ListedStocksSeed />
          </AdminLayout>
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
      <Route path="/admin/aadhaar-config">
        {() => (
          <AdminLayout>
            <AdminAadhaarConfig />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/api-usage">
        {() => (
          <AdminLayout>
            <AdminApiUsage />
          </AdminLayout>
        )}
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
            <div className="text-center py-20">
              <h2 className="text-2xl font-bold text-white mb-4">Database Management</h2>
              <p className="text-gray-400">Coming soon...</p>
            </div>
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/error-command-center" component={ErrorCommandCenter} />
      <Route component={NotFound} />
    </Switch>
  );
}

function PartnerRoutes() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/partner/auth" component={AuthPage} />
      <Route path="/">
        {() => (
          <PartnerLayout>
            <DistributionPartnerPortal />
          </PartnerLayout>
        )}
      </Route>
      <Route path="/partner">
        {() => (
          <PartnerLayout>
            <DistributionPartnerPortal />
          </PartnerLayout>
        )}
      </Route>
      <Route path="/partner-portal">
        {() => (
          <PartnerLayout>
            <DistributionPartnerPortal />
          </PartnerLayout>
        )}
      </Route>
      <Route path="/products">
        {() => (
          <PartnerLayout>
            <PartnerPortal />
          </PartnerLayout>
        )}
      </Route>
      <Route path="/agents">
        {() => (
          <PartnerLayout>
            <AgentPortal />
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
      <Route path="/">
        {() => (
          <AgentLayout>
            <FieldAgentPortal />
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent">
        {() => (
          <AgentLayout>
            <FieldAgentPortal />
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent-portal">
        {() => (
          <AgentLayout>
            <FieldAgentPortal />
          </AgentLayout>
        )}
      </Route>
      <Route path="/proposal-builder">
        {() => (
          <AgentLayout>
            <AgentDemoProposalBuilder />
          </AgentLayout>
        )}
      </Route>
      <Route path="/prospect-proposals">
        {() => (
          <AgentLayout>
            <AgentDemoProposalBuilder />
          </AgentLayout>
        )}
      </Route>
      <Route path="/clients">
        {() => (
          <AgentLayout>
            <AgentClientsPage />
          </AgentLayout>
        )}
      </Route>
      <Route path="/crm/clients/:clientId">
        {() => (
          <AgentLayout>
            <AgentCrmClient360 />
          </AgentLayout>
        )}
      </Route>
      <Route path="/crm/pipeline">
        {() => (
          <AgentLayout>
            <AgentCrmPipeline />
          </AgentLayout>
        )}
      </Route>
      <Route path="/crm/tasks">
        {() => (
          <AgentLayout>
            <AgentCrmTasks />
          </AgentLayout>
        )}
      </Route>
      <Route path="/crm/analytics">
        {() => (
          <AgentLayout>
            <AgentCrmAnalytics />
          </AgentLayout>
        )}
      </Route>
      <Route path="/agent-training">
        {() => <AgentTrainingPage />}
      </Route>
      <Route path="/recommendation-control">
        {() => (
          <AgentLayout>
            <AgentRecommendationControl />
          </AgentLayout>
        )}
      </Route>
      <Route path="/investment-advisory">
        {() => (
          <AgentLayout>
            <AgentInvestmentAdvisory />
          </AgentLayout>
        )}
      </Route>
      <Route path="/bond-recommendations">
        {() => (
          <AgentLayout>
            <AgentBondRecommendations />
          </AgentLayout>
        )}
      </Route>
      <Route path="/derivatives">
        {() => (
          <AgentLayout>
            <AgentDerivatives />
          </AgentLayout>
        )}
      </Route>
      <Route path="/stock-ai">
        {() => (
          <AgentLayout>
            <AgentStockAI />
          </AgentLayout>
        )}
      </Route>
      <Route path="/demo-progress">
        {() => (
          <AgentLayout>
            <AgentDemoProgress />
          </AgentLayout>
        )}
      </Route>
      <Route path="/dashboard">
        {() => (
          <AgentLayout>
            <AgentDashboard />
          </AgentLayout>
        )}
      </Route>
      <Route path="/proposals">
        {() => (
          <AgentLayout>
            <AgentProposalsPage />
          </AgentLayout>
        )}
      </Route>
      <Route path="/client-acquisition">
        {() => (
          <AgentLayout>
            <AgentClientAcquisitionPage />
          </AgentLayout>
        )}
      </Route>
      <Route path="/treasury">
        {() => (
          <AgentLayout>
            <AgentTreasuryPage />
          </AgentLayout>
        )}
      </Route>
      <Route path="/tax-cases">
        {() => (
          <AgentLayout>
            <AgentTaxCasesPage />
          </AgentLayout>
        )}
      </Route>
      <Route path="/revenue">
        {() => (
          <AgentLayout>
            <AgentRevenueCockpit />
          </AgentLayout>
        )}
      </Route>
      <Route path="/leads">
        {() => (
          <AgentLayout>
            <AgentLeadPipeline />
          </AgentLayout>
        )}
      </Route>
      <Route path="/clients/:id">
        {() => (
          <AgentLayout>
            <AgentClientProfile />
          </AgentLayout>
        )}
      </Route>
      <Route path="/tasks">
        {() => (
          <AgentLayout>
            <AgentTasks />
          </AgentLayout>
        )}
      </Route>
      <Route path="/reports">
        {() => (
          <AgentLayout>
            <AgentReportsHub />
          </AgentLayout>
        )}
      </Route>
      <Route path="/report-builder">
        {() => (
          <AgentLayout>
            <AgentPortfolioReportBuilder />
          </AgentLayout>
        )}
      </Route>
      <Route path="/leaderboard">
        {() => (
          <AgentLayout>
            <AgentLeaderboard />
          </AgentLayout>
        )}
      </Route>
      <Route path="/commission-calculator">
        {() => (
          <AgentLayout>
            <AgentCommissionCalculator />
          </AgentLayout>
        )}
      </Route>
      <Route path="/bulk-communication">
        {() => (
          <AgentLayout>
            <AgentBulkCommunication />
          </AgentLayout>
        )}
      </Route>
      <Route path="/calendar">
        {() => (
          <AgentLayout>
            <AgentCalendar />
          </AgentLayout>
        )}
      </Route>
      <Route path="/esign">
        {() => (
          <AgentLayout>
            <AgentESign />
          </AgentLayout>
        )}
      </Route>
      <Route path="/onboard-client">
        {() => (
          <AgentLayout>
            <AgentClientOnboarding />
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

function Router() {
  const { isAdminPortal, isPartnerPortal, isAgentPortal } = useSubdomain();

  // Render admin portal on admin subdomain
  if (isAdminPortal) {
    return <AdminRoutes />;
  }

  // Render partner portal on partner subdomain
  if (isPartnerPortal) {
    return <PartnerRoutes />;
  }

  // Render agent portal on agent subdomain
  if (isAgentPortal) {
    return <AgentRoutes />;
  }

  // Render client portal on main domain
  return (
    <LayoutResolver>
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
        <Route path="/video-kyc" component={VideoKYC} />
        <Route path="/net-worth" component={NetWorthPage} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/terms" component={Terms} />
        
        {/* Agent/Admin routes - bypass profile completion but require authentication */}
        <Route path="/admin" component={AdminPanel} />
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
          <UnifiedCartProvider>
            <TooltipProvider>
              <NetworkStatusBanner />
              <GlobalActionQueueMonitor />
              <DSCBackgroundSync />
              <Toaster />
              <GDPRConsent />
              <Router />
            </TooltipProvider>
          </UnifiedCartProvider>
        </QueryClientProvider>
      </ThemeProvider>
        </LowDataProvider>
    </NetworkProvider>
    </ErrorBoundary>
  );
}

export default App;
