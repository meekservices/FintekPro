import { Suspense } from "react";
import { Route, Switch } from "wouter";
import { LoadingState } from "@/components/LoadingState";
import ProfileCompletionGuard from "@/components/ProfileCompletionGuard";
import NotFound from "@/pages/not-found";
// ─── All lazy page imports — single source of truth ──────────────────────────
import {
  Home, Portfolio, Markets, IPO, PreIPO, MutualFunds, FundComparison,
  PortfolioComparison, Unlisted, Loans, NSDLServices, CDSLServices,
  CamsServices, KfintechServices, AgriculturalInsights, FinancialCalculators,
  AdminPanel, TesterDiagnostics, PartnerPortal, Support, InvestSmart,
  Achievements, CapitalGainsReports, ReportsHub, TransactionReports,
  AgentDashboard, AgentPicks, IBTradingPage, StorePage, GiftCity, Cart,
  Orders, ApiMonitorDemo, ICICILoans, HDFCLoans, ClientAutoPopulate,
  Privacy, Terms, RefundPolicy, PricingPage, InvestmentDisclaimer, ExcelAddin,
  AIF, AIFDetail, PMS, PMSDetail, AlternativeInvestments, MldStore, MldDetail,
  BajajFinance, TataCapital, PolicyBazaar, Cibil, Contact, SupplierManagement,
  Profile, AdminDashboard, GoldenPricingDashboard, SystemHealthMonitor,
  EngineHealthCheck, MFAnalyticsOps, RevenueAnalytics, UserActivityTimeline,
  BulkOperations, ComplianceDashboardPage, SEBIMFCompliance,
  RegulatoryAuditNormsPage, AdminApprovalQueue, NotificationManagement,
  FeatureFlags, ParserConfigPage, AdminESignManagement, ReportBuilder,
  StakeholdersPage, KycCompliancePage, KycV2ManagementPage,
  FinancialOperationsPage, APIConfiguration, ProductionReadiness,
  ActivityCentre, CkycDeferredDashboard, ZohoDashboardPage,
  ZohoConnectionsPage, ZohoLogsPage, ZohoBooksPage, ZohoImportPage,
  AdminProspectDashboard, GlobalFeeModelAdmin, StoreManagement,
  StoreInquiriesAdmin, BondSeedAdmin, MldSeedAdmin, AifSeedAdmin,
  PmsSeedAdmin, TaxServicesSeed, GoldSeedAdmin, LoansSeedAdmin,
  MutualFundsSeeding, ListedStocksSeed, ReitsInvitsSeed, GiftCityIfscSeed,
  GlobalSeedAdmin, RecommendationProductsAdmin, PicksManagement,
  McaDirectPayments, McaFinancialBackfill, SeedUnlistedPage,
  UnlistedPreviewPage, UnlistedPricingPreviewPage, DuplicateManagementPage,
  AdminThemeSettings, InstitutionalData, ComprehensivePortfolio,
  DocumentsPage, BBPSPage, DigiLockerPage, LoanApplication, LoanDashboard,
  LoanApplyPage, BrokingPage, AgentPortal, DistributionPartnerPortal,
  FieldAgentPortal, AgentClientsPage, AgentUsClientAccounts,
  AgentCrmClient360, AgentCrmPipeline, AgentCrmTasks, AgentCrmAnalytics,
  AgentRecommendationControl, AgentTrainingPage, AgentProposalsPage,
  AgentClientAcquisitionPage, AgentDerivatives, AgentTaxCasesPage,
  AgentKnowledgeHub, AgentKnowledgeMarketBrief, FestivalGreetingPreview,
  AgentKnowledgeProducts, AgentKnowledgeExplanations,
  AgentKnowledgeCertifications, AgentInvestmentAdvisory,
  AgentBondRecommendations, AgentStockAI, AgentThemeSettings,
  AgentResearchLists, AgentResearchListDetail, ResearchNoteGenerator,
  AgentHniLeaderboard, AgentDealMatcher, AgentScreener,
  AgentResearchAnalytics, AgentTreasuryPage, AgentRevenueCockpit,
  AgentQuantAnalytics, AgentLeadPipeline, AgentClientProfile, AgentTasks,
  AgentReportsHub, AgentDemoProgress, AgentPortfolioReportBuilder,
  AgentSampleReport, AgentDemoProposalBuilder, AgentZohoCRM, AgentLeaderboard,
  AgentCommissionCalculator, AgentBulkCommunication, AgentCalendar,
  AgentMeetings, AgentESign, AgentClientOnboarding, AgentLoanApply,
  AgentLoanApplications, AgentLoanMarketplace, AgentDSAPerformance,
  AgentPayoutClaims, AgentRevenueSheet, PartnerRevenueSheet, PartnerMyProfile,
  PartnerRegister, AdvisorBrandProfile, PublicAdvisorProfile, AdminAgentPayouts,
  AgentProspectProposals, OnboardingPage, AgentKycEmpanelment, AgentIrisHub,
  PublicProposalPage, ManualKYCPage, KycRejectionRekyc, KYCProductEligibility,
  NetWorthPage, AdminProposalsPage, ClientProposalsPage, MyProposalsPage,
  ClientSmartProposals, TaxDocuments, ITRPrefilled, TaxDataCenter,
  TaxSmartFiling, OneClickTaxFiling, TaxITRPage, TaxITRSelfPage,
  TaxITRExpertPage, TaxITRPreviewPage, TaxITRPaymentPage, TaxITRVerifyPage,
  TaxNoticesPage, TaxDocumentVaultPage, TaxCADeskPage, IntelligentTaxHub,
  TaxReminderSubscription, MLDs, UnifiedCart, Insurance, BankingProducts,
  Bonds, BondCategoryPage, BondDetailPage, FixedIncomeMarketplace, FamilyList,
  FamilyDashboard, AIChat, CorporateKYCPage, AlertsPage, SettingsPage,
  BiometricSettingsPage, CreditReportPage, DerivativesPage, CommoditiesPage,
  CreditCardsPage, ProfessionalServicesPage, ExpensesBudgets,
  AutoPopulationDashboard, GovernmentSchemes, AIProposalsPage,
  AIProposalReviewPage, AIStockPicks, GoalsPage, ReferralProgram,
  ScheduledReports, CompoundAlerts, DashboardCustomize, ThemeSettings,
  AgentProspectWizard, InvestableSurplusPage, MarketingDashboard,
  FestivalMarketing, EmailCampaigns, WhatsAppCampaigns, WhatsAppSetup,
  SMSCampaigns, SmsInbox, LeadProspecting, McaIntelligence, McaCompanyProfile,
  ProspectAnalytics, ClientIntelligence, MarketingAnalytics,
  AgentPerformanceDashboard, DemoProposalsTracking, AdminTaskOversight,
  UserManagement, CAManagement, PredictiveAnalytics, UnlistedCompaniesAdmin,
  UnlistedNegotiations, UnlistedDashboard, BondMarketplaceDashboard,
  GlobalAdvisoryManagement, UnlistedOrders, OrderAuditDashboard,
  UnlistedAuditLog, UnlistedComplianceAlerts, UnlistedRegulatoryCompliance,
  FixedIncomeAdmin, BondCommissionSettings, CommissionMaster,
  AdminPartnerHierarchy, AdminFirmInventory, AdminLoanManagement,
  AdminDsaLoanDashboard, CommissionLedger, EligibilityMatrix, AdminDLM,
  AdminDLMNegotiate, AdminStoreManager, BrowseUnlisted, CompanyDetails,
  CreateSellListing, CreateBuyRequest, MyOrders, UnlistedCartPage,
  CASupportDashboard, CASupportDetail, CARegistration, CADashboard,
  PartnerAgentDashboard, PartnerCAManagement, PartnerTeamManagement,
  AgentPayoutDashboard, AdminPayoutManagement, AdminMappingRequests,
  FreshInvestmentDiscovery, TDSCompliance, TaxComplianceForm15Page,
  RiskProfilingPage, RiskQuestionnaireBuilder, RiskComplianceExport,
  AdminDatabase, AdminDataProviders, AdminKycFlow, ExchangeFilingsAdmin,
  AdminApiUsage, AdminMFEnrichment, AdminMfBenchmarks, AdminDataEnrichment,
  AdminMasterDsaClaims, AdminAiRecommendationTracking, AdminReportsHub,
  AdminAIInsights, AdminAgentOversightPage, AdminAppointmentsDashboard,
  AdminBrokerDashboard, AlpacaHubAdmin, AlpacaHubAgent, AdminIrisOverview,
  OpenAccountPage, ClientTasks, ClientAIRecommendations, ClientReports,
  ReitInvitPage, VideoKYC, PortfolioStressTest, DividendCalendar,
  TaxLossHarvesting, TaxRegimeComparison, AgentFieldView, AgentPerformance,
  NotificationPreferences, AIPortfolioReport, PortfolioGoals,
  PortfolioRetirement, PortfolioAIInsights, PortfolioRebalancing,
  PortfolioImport, TrackerPortfolioReport, AgentExternalPortfolios,
  AgentInvestmentBaskets, AgentSipHealth, AgentPortfolioDrift,
  AgentMarketAlerts, PublicProfilePage, AgentTracker, AlpacaMarketExplorer,
  TreasuryDashboard, AlpacaClientHub, USTrading, GlobalAdvisoryPage,
  GlobalTrading, DomesticTrading, ITRTaxServices, NRIServices,
  InvestmentDashboard, PartnerApplication, LoanRecommendations, LoanComparison,
  PropertyServices, ProposalsRedirect as ProposalsPage,
  PortfolioHoldings, LandingPage,
} from "@/routes/lazy-pages";

export function UserProtectedRoutes() {
  return (
    <ProfileCompletionGuard>
      <Switch>
        <Route path="/dashboard" component={Home} />
        <Route path="/treasury-dashboard" component={TreasuryDashboard} />
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
        <Route path="/alpaca-market-explorer" component={AlpacaMarketExplorer} />
        <Route component={NotFound} />

      </Switch>
    </ProfileCompletionGuard>
  );
}

