import { Suspense } from "react";
import { Redirect, Route, Switch } from "wouter";
import { LoadingState } from "@/components/LoadingState";
import { AdminLayout } from "@/components/layout/admin-layout";
import { AgentLayout } from "@/components/layout/agent-layout";
import { useAuth } from "@/hooks/useAuth";
import AuthPage from "@/pages/auth-page";
import NotFound from "@/pages/not-found";
// ─── All lazy page imports — single source of truth ──────────────────────────
import {
  Home, Portfolio, MutualFunds, AIF, PMS, MldStore, Unlisted, Bonds,
  FieldAgentPortal, AgentPortal, AgentDashboard, AgentPicks, AgentProspectWizard,
  AgentZohoCRM, AgentClientsPage, AgentUsClientAccounts, AgentCrmClient360,
  AgentCrmPipeline, AgentCrmTasks, AgentCrmAnalytics, AgentTracker,
  AgentInvestmentBaskets, AgentSipHealth, AgentPortfolioDrift, AgentMarketAlerts,
  PublicAdvisorProfile, AdvisorBrandProfile, AgentTrainingPage,
  AgentRecommendationControl, AgentInvestmentAdvisory, AgentBondRecommendations,
  AgentDerivatives, AgentStockAI, AgentDemoProgress, AgentProposalsPage,
  AgentClientAcquisitionPage, AgentTreasuryPage, AgentTaxCasesPage,
  AgentKnowledgeHub, AgentKnowledgeMarketBrief, FestivalGreetingPreview,
  AgentKnowledgeProducts, AgentKnowledgeExplanations, AgentKnowledgeCertifications,
  AgentRevenueCockpit, AgentUsClientAccounts as _AgentUsClientAccounts,
  AlpacaHubAgent, AgentLeadPipeline, AgentClientProfile, AgentTasks, AgentReportsHub,
  AgentPortfolioReportBuilder, AgentSampleReport, AgentLeaderboard,
  AgentCommissionCalculator, AgentBulkCommunication, AgentCalendar, AgentMeetings,
  AgentESign, AgentLoanApply, AgentLoanApplications, AgentLoanMarketplace,
  AgentDSAPerformance, AgentPayoutClaims, AgentRevenueSheet, AdminAgentPayouts,
  AgentClientOnboarding, AgentKycEmpanelment, OnboardingPage, AgentResearchLists,
  AgentResearchListDetail, AgentScreener, AgentResearchAnalytics, AgentQuantAnalytics,
  ResearchNoteGenerator, AgentHniLeaderboard, AgentDealMatcher, AgentThemeSettings,
  SettingsPage, Profile, KycRejectionRekyc, AgentIrisHub, PublicProposalPage,
  AgentPayoutDashboard, AgentProspectProposals, AgentIrisHub as _AgentIrisHub,
  ManualKYCPage, KYCProductEligibility, NetWorthPage, PartnerApplication,
  AgentExternalPortfolios, AlpacaMarketExplorer, AgentFieldView,
} from "@/routes/lazy-pages";

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


export function AgentRoutes() {
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
      {/* Alias with correct /agent prefix for nav consistency */}
      <Route path="/agent/kyc-rejections">
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

