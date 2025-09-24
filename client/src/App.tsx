import { Switch, Route } from "wouter";
import { lazy } from "react";
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
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import AdminPanel from "@/pages/admin-panel";
import PartnerPortal from "@/pages/partner-portal";
import Support from "@/pages/support";
import InvestSmart from "@/pages/wealth-management";
import Achievements from "@/pages/achievements";
import CapitalGainsReports from "@/pages/capital-gains-reports";
import WhatsAppAuthPage from "@/pages/whatsapp-auth-page";
import AgentDashboard from "@/pages/agent-dashboard";
import IBTradingPage from "@/pages/ib-trading";
import Store from "@/pages/store";
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
import BBPSPage from "@/pages/BBPSPage";
import DigiLockerPage from "@/pages/DigiLockerPage";
import LoanApplication from "@/pages/loan-application";
import LoanDashboard from "@/pages/loan-dashboard";
import ProposalsPage from "@/pages/proposals";
import BrokingPage from "@/pages/broking";
import AgentPortal from "@/pages/agent-portal";
import OnboardingPage from "@/pages/onboarding";
import AdminProposalsPage from "@/pages/admin-proposals";
import ClientProposalsPage from "@/pages/client-proposals";

function UserProtectedRoutes() {
  return (
    <AppLayout>
      <ProfileCompletionGuard>
        <Switch>
          <Route path="/" component={Home} />
        <Route path="/dashboard" component={Home} />
        <Route path="/portfolio" component={Portfolio} />
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
        <Route path="/loans" component={Loans} />
        <Route path="/nsdl-services" component={NSDLServices} />
        <Route path="/cdsl-services" component={CDSLServices} />
        <Route path="/cams-services" component={CamsServices} />
        <Route path="/kfintech-services" component={KfintechServices} />
        <Route path="/agricultural-insights" component={AgriculturalInsights} />
        <Route path="/calculators" component={FinancialCalculators} />
        <Route path="/partner" component={PartnerPortal} />
        <Route path="/support" component={Support} />
        <Route path="/wealth" component={InvestSmart} />
        <Route path="/investsmart" component={InvestSmart} />
        <Route path="/wealth-management" component={InvestSmart} />
        <Route path="/proposals" component={ProposalsPage} />
        <Route path="/my-proposals" component={ClientProposalsPage} />
        <Route path="/achievements" component={Achievements} />
        <Route path="/capital-gains" component={CapitalGainsReports} />
        <Route path="/ib-trading" component={IBTradingPage} />
        <Route path="/store" component={Store} />
        <Route path="/cart" component={Cart} />
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
        </Switch>
      </ProfileCompletionGuard>
    </AppLayout>
  );
}

function Router() {
  return (
    <Switch>
      {/* Public routes - no authentication or profile completion required */}
      <Route path="/auth" component={AuthPage} />
      <Route path="/whatsapp-login" component={WhatsAppAuthPage} />
      <Route path="/profile" component={Profile} />
      <Route path="/onboarding" component={OnboardingPage} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      
      {/* Agent/Admin routes - bypass profile completion but require authentication */}
      <Route path="/admin" component={AdminPanel} />
      <Route path="/admin/proposals" component={AdminProposalsPage} />
      <Route path="/agent" component={AgentDashboard} />
      <Route path="/agent-portal" component={AgentPortal} />
      
      {/* User routes - require both authentication and profile completion */}
      <Route component={UserProtectedRoutes} />
    </Switch>
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
