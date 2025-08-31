import { Switch, Route } from "wouter";
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
import Unlisted from "@/pages/unlisted";
import Loans from "@/pages/loans";
import NSDLServices from "@/pages/nsdl-services";
import CDSLServices from "@/pages/cdsl-services";
import AgriculturalInsights from "@/pages/agricultural-insights";
import FinancialCalculators from "@/pages/financial-calculators";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import ProfilePage from "@/pages/profile";
import AdminPanel from "@/pages/admin-panel";
import PartnerPortal from "@/pages/partner-portal";
import Support from "@/pages/support";
import WealthManagement from "@/pages/wealth-management";
import Achievements from "@/pages/achievements";
import CapitalGainsReports from "@/pages/capital-gains-reports";
import WhatsAppAuthPage from "@/pages/whatsapp-auth-page";
import CkycVerification from "@/pages/ckyc-verification";
import AgentDashboard from "@/pages/agent-dashboard";
import IBTradingPage from "@/pages/ib-trading";
import Store from "@/pages/store";
import ApiMonitorDemo from "@/pages/api-monitor-demo";
import ICICIBanking from "@/pages/icici-banking";
import HDFCBanking from "@/pages/hdfc-banking";
import ClientAutoPopulate from "@/pages/client-auto-populate";
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";
import AIF from "@/pages/aif";
import { SupplierManagement } from "@/pages/supplier-management";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={Home} />
      <Route path="/portfolio" component={Portfolio} />
      <Route path="/markets" component={Markets} />
      <Route path="/ipo" component={IPO} />
      <Route path="/pre-ipo" component={PreIPO} />
      <Route path="/mutual-funds" component={MutualFunds} />
      <Route path="/unlisted" component={Unlisted} />
      <Route path="/loans" component={Loans} />
      <Route path="/nsdl-services" component={NSDLServices} />
      <Route path="/cdsl-services" component={CDSLServices} />
      <Route path="/agricultural-insights" component={AgriculturalInsights} />
      <Route path="/calculators" component={FinancialCalculators} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/whatsapp-login" component={WhatsAppAuthPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/admin" component={AdminPanel} />
      <Route path="/agent" component={AgentDashboard} />
      <Route path="/partner" component={PartnerPortal} />
      <Route path="/support" component={Support} />
      <Route path="/wealth" component={WealthManagement} />
      <Route path="/wealth-management" component={WealthManagement} />
      <Route path="/achievements" component={Achievements} />
      <Route path="/capital-gains" component={CapitalGainsReports} />
      <Route path="/ckyc" component={CkycVerification} />
      <Route path="/ib-trading" component={IBTradingPage} />
      <Route path="/store" component={Store} />
      <Route path="/api-monitor" component={ApiMonitorDemo} />
      <Route path="/icici-banking" component={ICICIBanking} />
      <Route path="/hdfc-banking" component={HDFCBanking} />
      <Route path="/client-auto-populate" component={ClientAutoPopulate} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/aif" component={AIF} />
      <Route path="/suppliers" component={SupplierManagement} />
      <Route component={NotFound} />
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
