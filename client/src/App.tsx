import { Switch, Route, useLocation, Redirect } from "wouter";
import { Suspense, useEffect } from "react";
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
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
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
import {
  LandingPage, ExcelAddin, Profile, PublicProfilePage, PublicProposalPage,
  OnboardingPage, CARegistration, ManualKYCPage, KYCProductEligibility,
  VideoKYC, KycRejectionRekyc, NetWorthPage, PricingPage, Privacy, Terms,
  RefundPolicy, InvestmentDisclaimer, TesterDiagnostics, AdminProposalsPage,
  UnlistedCompaniesAdmin, UnlistedNegotiations, AdminPanel, AgentDashboard,
} from "@/routes/lazy-pages";




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
