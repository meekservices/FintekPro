import { Switch, Route, useLocation, Redirect } from "wouter";
import { lazy, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GDPRConsent } from "@/components/gdpr-consent";
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
import ChartAnalyzer from "@/pages/chart-analyzer";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import AdminPanel from "@/pages/admin";
import PartnerPortal from "@/pages/partner-portal";
import Support from "@/pages/support";
import InvestSmart from "@/pages/wealth-management";
import Achievements from "@/pages/achievements";
import CapitalGainsReports from "@/pages/capital-gains-reports";
import AgentDashboard from "@/pages/agent-dashboard";
import AgentDashboardNew from "@/pages/agent/dashboard";
import AgentClients from "@/pages/agent/clients";
import IBTradingPage from "@/pages/ib-trading";
import StorePage from "@/pages/store";
import GiftCity from "@/pages/gift-city";
import Cart from "@/pages/cart";
import ApiMonitorDemo from "@/pages/api-monitor-demo";
import ICICILoans from "@/pages/icici-loans";
import HDFCLoans from "@/pages/hdfc-loans";
import ClientAutoPopulate from "@/pages/client-auto-populate";
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";
import AIF from "@/pages/aif";
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
import { useSubdomain } from "@/hooks/useSubdomain";
import { useAuth } from "@/hooks/useAuth";
import { KycGate } from "@/components/kyc/kyc-gate";
import AdminDashboard from "@/pages/admin/dashboard";
import StakeholdersPage from "@/pages/admin/stakeholders";
import KycCompliancePage from "@/pages/admin/kyc-compliance";
import FinancialOperationsPage from "@/pages/admin/financial-operations";
import APIConfiguration from "@/pages/admin/api-configuration";
import ProductionReadiness from "@/pages/admin/production-readiness";
import ZohoDashboardPage from "@/pages/admin/zoho-dashboard";
import ZohoConnectionsPage from "@/pages/admin/zoho-connections";
import ZohoLogsPage from "@/pages/admin/zoho-logs";
import StoreManagement from "@/pages/admin/store-management";
import DuplicateManagementPage from "@/pages/admin/duplicate-management";
import BBPSPage from "@/pages/BBPSPage";
import DigiLockerPage from "@/pages/DigiLockerPage";
import LoanApplication from "@/pages/loan-application";
import LoanDashboard from "@/pages/loan-dashboard";
import ProposalsPage from "@/pages/proposals";
import BrokingPage from "@/pages/broking";
import AgentPortal from "@/pages/agent-portal";
import OnboardingPage from "@/pages/onboarding";
import SmartProductionKYC from "@/pages/smart-production-kyc";
import ManualKYCPage from "@/pages/manual-kyc";
import KYCDashboard from "@/pages/kyc-dashboard";
import NetWorthPage from "@/pages/net-worth";
import AdminProposalsPage from "@/pages/admin-proposals";
import AdminWhatsAppSetup from "@/pages/admin-whatsapp-setup";
import ClientProposalsPage from "@/pages/client-proposals";
import TaxDocuments from "@/pages/tax-documents";
import ITRPrefilled from "@/pages/itr-prefilled";
import TaxDataCenter from "@/pages/tax-data-center";
import OneClickTaxFiling from "@/pages/one-click-tax-filing";
import PropertyServices from "@/pages/property-services";
import LoanComparison from "@/pages/loan-comparison";
import LoanRecommendations from "@/pages/loan-recommendations";
import PartnerApplication from "@/pages/partner-application";
import InvestmentDashboard from "@/pages/investment-dashboard";
import NRIServices from "@/pages/nri-services";
import ITRTaxServices from "@/pages/itr-tax-services";
import DomesticTrading from "@/pages/domestic-trading";
import GlobalTrading from "@/pages/global-trading";
import IntelligentTaxHub from "@/pages/intelligent-tax-hub";
import TaxReminderSubscription from "@/pages/tax-reminder-subscription";
import MLDs from "@/pages/mlds";
import Insurance from "@/pages/insurance";
import BankingProducts from "@/pages/banking-products";
import Bonds from "@/pages/bonds";
import FamilyList from "@/pages/family-list";
import FamilyDashboard from "@/pages/family-dashboard";
import AIChat from "@/pages/ai-chat";
import CorporateKYCPage from "@/pages/CorporateKYCPage";
import NRIKYCPage from "@/pages/nri-kyc";
import AlertsPage from "@/pages/alerts";
import SettingsPage from "@/pages/settings";
import CreditReportPage from "@/pages/credit-report";
import DerivativesPage from "@/pages/derivatives";
import CommoditiesPage from "@/pages/commodities";
import CreditCardsPage from "@/pages/credit-cards";
import ProfessionalServicesPage from "@/pages/professional-services";
import ExpensesBudgets from "@/pages/expenses-budgets";
import AutoPopulationDashboard from "@/pages/auto-population-dashboard";
import AAConsentManagement from "@/pages/AAConsentManagement";
import AADiscoveredAccounts from "@/pages/AADiscoveredAccounts";
import MarketingDashboard from "@/pages/admin/marketing-dashboard";
import EmailCampaigns from "@/pages/admin/email-campaigns";
import WhatsAppCampaigns from "@/pages/admin/whatsapp-campaigns";
import LeadProspecting from "@/pages/admin/lead-prospecting";
import ClientIntelligence from "@/pages/admin/client-intelligence";
import MarketingAnalytics from "@/pages/admin/marketing-analytics";
import UserManagement from "@/pages/admin/user-management";
import SystemMonitoring from "@/pages/admin/system-monitoring";
import AuditLedger from "@/pages/admin/audit-ledger";
import AIFixSuggestions from "@/pages/admin/ai-fixes";
import PredictiveAnalytics from "@/pages/PredictiveAnalytics";

// Legacy KYC redirect component for backward compatibility
function LegacyKYCRedirect() {
  return <Redirect to="/smart-production-kyc" />;
}

function UserProtectedRoutes() {
  return (
    <ProfileCompletionGuard>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/dashboard" component={Home} />
        <Route path="/portfolio">{() => <KycGate><Portfolio /></KycGate>}</Route>
        <Route path="/analytics">{() => <KycGate><PredictiveAnalytics /></KycGate>}</Route>
        <Route path="/comprehensive-portfolio">{() => {
          const ComprehensivePortfolio = lazy(() => import("@/pages/comprehensive-portfolio"));
          return <KycGate><ComprehensivePortfolio /></KycGate>;
        }}</Route>
        <Route path="/broking">{() => <KycGate><BrokingPage /></KycGate>}</Route>
        <Route path="/markets" component={Markets} />
        <Route path="/ipo">{() => <KycGate><IPO /></KycGate>}</Route>
        <Route path="/pre-ipo">{() => <KycGate><PreIPO /></KycGate>}</Route>
        <Route path="/mutual-funds">{() => <KycGate><MutualFunds /></KycGate>}</Route>
        <Route path="/fund-comparison">{() => <KycGate><FundComparison /></KycGate>}</Route>
        <Route path="/portfolio-comparison">{() => <KycGate><PortfolioComparison /></KycGate>}</Route>
        <Route path="/unlisted">{() => <KycGate><Unlisted /></KycGate>}</Route>
        <Route path="/bonds">{() => <KycGate><Bonds /></KycGate>}</Route>
        <Route path="/mlds">{() => <KycGate><MLDs /></KycGate>}</Route>
        <Route path="/insurance">{() => <KycGate><Insurance /></KycGate>}</Route>
        <Route path="/banking-products">{() => <KycGate><BankingProducts /></KycGate>}</Route>
        <Route path="/loans" component={Loans} />
        <Route path="/nsdl-services" component={NSDLServices} />
        <Route path="/cdsl-services" component={CDSLServices} />
        <Route path="/cams-services" component={CamsServices} />
        <Route path="/kfintech-services" component={KfintechServices} />
        <Route path="/agricultural-insights" component={AgriculturalInsights} />
        <Route path="/calculators" component={FinancialCalculators} />
        <Route path="/chart-analyzer" component={ChartAnalyzer} />
        <Route path="/partner" component={PartnerPortal} />
        <Route path="/support" component={Support} />
        <Route path="/wealth" component={InvestSmart} />
        <Route path="/investsmart" component={InvestSmart} />
        <Route path="/wealth-management" component={InvestSmart} />
        <Route path="/proposals">{() => <KycGate><ProposalsPage /></KycGate>}</Route>
        <Route path="/my-proposals">{() => <KycGate><ClientProposalsPage /></KycGate>}</Route>
        <Route path="/achievements" component={Achievements} />
        <Route path="/capital-gains">{() => <KycGate><CapitalGainsReports /></KycGate>}</Route>
        {/* Unified Tax Services - Primary Route */}
        <Route path="/tax-hub" component={IntelligentTaxHub} />
        <Route path="/tax">{() => { window.location.href = '/tax-hub?tab=filing'; return null; }}</Route>
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
        <Route path="/ib-trading">{() => <KycGate><IBTradingPage /></KycGate>}</Route>
        <Route path="/store">{() => <KycGate><StorePage /></KycGate>}</Route>
        <Route path="/chat" component={AIChat} />
        <Route path="/alerts" component={AlertsPage} />
        <Route path="/gift-city">{() => <KycGate><GiftCity /></KycGate>}</Route>
        <Route path="/nri-services">{() => <KycGate><NRIServices /></KycGate>}</Route>
        <Route path="/itr-tax-services">{() => <KycGate><ITRTaxServices /></KycGate>}</Route>
        <Route path="/domestic-trading">{() => <KycGate><DomesticTrading /></KycGate>}</Route>
        <Route path="/global-trading">{() => <KycGate><GlobalTrading /></KycGate>}</Route>
        <Route path="/cart">{() => <KycGate><Cart /></KycGate>}</Route>
        <Route path="/api-monitor" component={ApiMonitorDemo} />
        <Route path="/icici-loans" component={ICICILoans} />
        <Route path="/hdfc-loans" component={HDFCLoans} />
        <Route path="/client-auto-populate" component={ClientAutoPopulate} />
        <Route path="/aif" component={AIF} />
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
        {/* Legacy KYC route - redirect to unified page */}
        <Route path="/corporate-kyc" component={LegacyKYCRedirect} />
        {/* New Pages */}
        <Route path="/settings" component={SettingsPage} />
        <Route path="/credit-report" component={CreditReportPage} />
        <Route path="/derivatives" component={DerivativesPage} />
        <Route path="/expenses-budgets" component={ExpensesBudgets} />
        <Route path="/commodities" component={CommoditiesPage} />
        <Route path="/credit-cards" component={CreditCardsPage} />
        <Route path="/professional-services" component={ProfessionalServicesPage} />
        <Route path="/auto-populate" component={AutoPopulationDashboard} />
        <Route path="/aa-consents">{() => <KycGate><AAConsentManagement /></KycGate>}</Route>
        <Route path="/aa-accounts">{() => <KycGate><AADiscoveredAccounts /></KycGate>}</Route>
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
      
      {/* Protected admin routes - wrapped in AdminLayout */}
      <Route path="/" component={AdminRoot} />
      
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
      <Route path="/admin/duplicates">
        {() => (
          <AdminLayout>
            <DuplicateManagementPage />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/system-monitoring">
        {() => (
          <AdminLayout>
            <SystemMonitoring />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/audit-ledger">
        {() => (
          <AdminLayout>
            <AuditLedger />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/ai-fixes">
        {() => (
          <AdminLayout>
            <AIFixSuggestions />
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
      <Route path="/admin/reports">
        {() => (
          <AdminLayout>
            <div className="text-center py-20">
              <h2 className="text-2xl font-bold text-white mb-4">Reports & Analytics</h2>
              <p className="text-gray-400">Coming soon...</p>
            </div>
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/compliance">
        {() => (
          <AdminLayout>
            <div className="text-center py-20">
              <h2 className="text-2xl font-bold text-white mb-4">Compliance Dashboard</h2>
              <p className="text-gray-400">Coming soon...</p>
            </div>
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
      <Route component={NotFound} />
    </Switch>
  );
}

function PartnerRoutes() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={AgentPortal} />
        <Route path="/partner-portal" component={AgentPortal} />
        <Route path="/auth" component={AuthPage} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function Router() {
  const { isAdminPortal, isPartnerPortal } = useSubdomain();

  // Render admin portal on admin subdomain
  if (isAdminPortal) {
    return <AdminRoutes />;
  }

  // Render partner portal on partner subdomain
  if (isPartnerPortal) {
    return <PartnerRoutes />;
  }

  // Render client portal on main domain
  return (
    <AppLayout>
      <Switch>
        {/* Public routes - no authentication or profile completion required */}
        <Route path="/auth" component={AuthPage} />
        <Route path="/profile" component={Profile} />
        
        {/* Smart Production KYC - Unified KYC workflow */}
        <Route path="/smart-production-kyc" component={SmartProductionKYC} />
        <Route path="/manual-kyc" component={ManualKYCPage} />
        <Route path="/kyc-dashboard" component={KYCDashboard} />
        <Route path="/net-worth" component={NetWorthPage} />
        
        {/* Legacy KYC routes - redirect to unified page for backward compatibility */}
        <Route path="/onboarding" component={LegacyKYCRedirect} />
        <Route path="/smart-kyc" component={LegacyKYCRedirect} />
        <Route path="/nri-kyc" component={LegacyKYCRedirect} />
        <Route path="/corporate-kyc" component={LegacyKYCRedirect} />
        
        <Route path="/privacy" component={Privacy} />
        <Route path="/terms" component={Terms} />
        
        {/* Agent/Admin routes - bypass profile completion but require authentication */}
        <Route path="/admin" component={AdminPanel} />
        <Route path="/admin/proposals" component={AdminProposalsPage} />
        <Route path="/admin/whatsapp-setup" component={AdminWhatsAppSetup} />
        <Route path="/agent" component={AgentDashboard} />
        <Route path="/agent/dashboard" component={AgentDashboardNew} />
        <Route path="/agent/clients" component={AgentClients} />
        
        {/* User routes - require both authentication and profile completion */}
        <Route component={UserProtectedRoutes} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <GDPRConsent />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
