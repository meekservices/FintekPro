import { Suspense, useEffect } from "react";
import { Redirect, Route, Switch, useLocation } from "wouter";
import { LoadingState } from "@/components/LoadingState";
import { AdminLayout } from "@/components/layout/admin-layout";
import { useAuth } from "@/hooks/useAuth";
import { useSubdomain } from "@/hooks/useSubdomain";
import AuthPage from "@/pages/auth-page";
import NotFound from "@/pages/not-found";
// ─── All lazy page imports — single source of truth ──────────────────────────
import {
	AdminDashboard,
	GoldenPricingDashboard,
	SystemHealthMonitor,
	EngineHealthCheck,
	MFAnalyticsOps,
	RevenueAnalytics,
	UserActivityTimeline,
	BulkOperations,
	ComplianceDashboardPage,
	SEBIMFCompliance,
	RegulatoryAuditNormsPage,
	AdminApprovalQueue,
	NotificationManagement,
	FeatureFlags,
	ParserConfigPage,
	AdminESignManagement,
	ReportBuilder,
	StakeholdersPage,
	KycCompliancePage,
	KycV2ManagementPage,
	FinancialOperationsPage,
	APIConfiguration,
	ProductionReadiness,
	ActivityCentre,
	CkycDeferredDashboard,
	ZohoDashboardPage,
	ZohoConnectionsPage,
	ZohoLogsPage,
	ZohoBooksPage,
	ZohoImportPage,
	AdminProspectDashboard,
	GlobalFeeModelAdmin,
	StoreManagement,
	StoreInquiriesAdmin,
	BondSeedAdmin,
	MldSeedAdmin,
	AifSeedAdmin,
	PmsSeedAdmin,
	TaxServicesSeed,
	GoldSeedAdmin,
	LoansSeedAdmin,
	MutualFundsSeeding,
	ListedStocksSeed,
	ReitsInvitsSeed,
	GiftCityIfscSeed,
	GlobalSeedAdmin,
	RecommendationProductsAdmin,
	PicksManagement,
	McaDirectPayments,
	McaFinancialBackfill,
	SeedUnlistedPage,
	UnlistedPreviewPage,
	UnlistedPricingPreviewPage,
	DuplicateManagementPage,
	AdminThemeSettings,
	InstitutionalData,
	MarketingDashboard,
	FestivalMarketing,
	EmailCampaigns,
	WhatsAppCampaigns,
	WhatsAppSetup,
	SMSCampaigns,
	SmsInbox,
	LeadProspecting,
	McaIntelligence,
	McaCompanyProfile,
	ProspectAnalytics,
	ClientIntelligence,
	MarketingAnalytics,
	AgentPerformanceDashboard,
	DemoProposalsTracking,
	AdminTaskOversight,
	UserManagement,
	CAManagement,
	UnlistedCompaniesAdmin,
	UnlistedNegotiations,
	UnlistedDashboard,
	BondMarketplaceDashboard,
	GlobalAdvisoryManagement,
	UnlistedOrders,
	OrderAuditDashboard,
	UnlistedAuditLog,
	UnlistedComplianceAlerts,
	UnlistedRegulatoryCompliance,
	FixedIncomeAdmin,
	BondCommissionSettings,
	CommissionMaster,
	AdminPartnerHierarchy,
	AdminFirmInventory,
	AdminLoanManagement,
	AdminDsaLoanDashboard,
	CommissionLedger,
	EligibilityMatrix,
	AdminDLM,
	AdminDLMNegotiate,
	AdminStoreManager,
	BrowseUnlisted,
	CompanyDetails,
	CASupportDashboard,
	CASupportDetail,
	CARegistration,
	CADashboard,
	PartnerAgentDashboard,
	PartnerCAManagement,
	PartnerTeamManagement,
	AgentPayoutDashboard,
	AdminPayoutManagement,
	AdminMappingRequests,
	FreshInvestmentDiscovery,
	TDSCompliance,
	TaxComplianceForm15Page,
	RiskProfilingPage,
	RiskQuestionnaireBuilder,
	RiskComplianceExport,
	AdminDatabase,
	AdminDataProviders,
	AdminKycFlow,
	ExchangeFilingsAdmin,
	AdminApiUsage,
	AdminMFEnrichment,
	AdminMfBenchmarks,
	AdminDataEnrichment,
	AdminMasterDsaClaims,
	AdminAiRecommendationTracking,
	AdminReportsHub,
	AdminAIInsights,
	AdminAgentOversightPage,
	AdminAppointmentsDashboard,
	AdminBrokerDashboard,
	AlpacaHubAdmin,
	AdminIrisOverview,
	MultibrokerEarnings,
	OpenAccountPage,
	AIPortfolioReport,
	Portfolio,
	MutualFunds,
	AIF,
	PMS,
	MldStore,
	Unlisted,
	Bonds,
	ManualKYCPage,
	KYCProductEligibility,
	NetWorthPage,
	ReitInvitPage,
	PortfolioStressTest,
	DividendCalendar,
	TaxLossHarvesting,
	TaxRegimeComparison,
	NotificationPreferences,
	PortfolioGoals,
	PortfolioRetirement,
	PortfolioAIInsights,
	PortfolioRebalancing,
	PortfolioImport,
	TrackerPortfolioReport,
	AgentExternalPortfolios,
	AgentInvestmentBaskets,
	AgentSipHealth,
	AgentPortfolioDrift,
	AgentMarketAlerts,
	PublicProfilePage,
	AgentTracker,
	AlpacaMarketExplorer,
	TreasuryDashboard,
	Profile,
	PublicProposalPage,
	AdminAgentPayouts,
	AgentProspectProposals,
	AgentIrisHub,
	AgentESign,
	AgentKycEmpanelment,
	KycRejectionRekyc,
	OnboardingPage,
	SettingsPage,
	PredictiveAnalytics,
	ComprehensivePortfolio,
	AdminProposalsPage,
	ClientProposalsPage,
	MyProposalsPage,
	ClientSmartProposals,
	ClientTasks,
	ClientAIRecommendations,
	ClientReports,
	AgentProspectWizard,
	GoalsPage,
	AIProposalsPage,
	AIProposalReviewPage,
	AIStockPicks,
	AgentPicks,
	AgentDashboard,
	FieldAgentPortal,
	AgentPortal,
	AgentClientsPage,
	AgentClientProfile,
	AgentTasks,
	FestivalGreetingPreview,
	AgentResearchLists,
	AgentResearchListDetail,
	ResearchNoteGenerator,
	AlpacaHubAgent,
	// Admin-only copilot pages
	AdminCopilotHub,
	CopilotAuditLogs,
	CopilotBiDashboard,
	CopilotBooksFinance,
	CopilotComplianceAlerts,
	CopilotCrmIntelligence,
	CopilotDeskIntelligence,
	CopilotEmailIntelligence,
	CopilotMeetings,
	CopilotProposalDrafts,
	CopilotTaskManager,
	// Additional pages used in admin routes
	BiometricSettingsPage,
	VideoKYC,
	PortfolioHoldings,
} from "@/routes/lazy-pages";

// Component to handle admin root redirect
function AdminRoot() {
	const { user, isLoading } = useAuth();
	const [, navigate] = useLocation();
	const { withPortalParams } = useSubdomain();

	// biome-ignore lint/correctness/useExhaustiveDependencies: withPortalParams is a stable subdomain helper — intentionally excluded to prevent infinite re-renders
	useEffect(() => {
		if (!isLoading && !user) {
			navigate(withPortalParams("/auth"));
		}
	}, [user, isLoading, navigate]);

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
			<Route path="/admin/multibroker-earnings">
				{() => (
					<AdminLayout>
						<Suspense fallback={<LoadingState variant="dashboard" />}>
							<MultibrokerEarnings />
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
			<Route path="/admin/api-usage">{() => <AdminApiUsage />}</Route>
			<Route path="/admin/mf-benchmarks">
				<AdminMfBenchmarks />
			</Route>
			<Route path="/admin/mf-enrichment">{() => <AdminMFEnrichment />}</Route>
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
			{/* Settings & Biometric - accessible to all portal users */}
			<Route path="/admin/settings">
				{() => (
					<AdminLayout>
						<Suspense fallback={<LoadingState variant="dashboard" />}>
							<SettingsPage />
						</Suspense>
					</AdminLayout>
				)}
			</Route>
			<Route path="/settings">
				{() => (
					<AdminLayout>
						<Suspense fallback={<LoadingState variant="dashboard" />}>
							<SettingsPage />
						</Suspense>
					</AdminLayout>
				)}
			</Route>
			<Route path="/biometric-settings">
				{() => (
					<AdminLayout>
						<Suspense fallback={<LoadingState variant="dashboard" />}>
							<BiometricSettingsPage />
						</Suspense>
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
			{/* ── Admin Copilot Routes ── */}
			<Route path="/admin/copilot">
				{() => (
					<AdminLayout>
						<Suspense fallback={<LoadingState variant="dashboard" />}>
							<AdminCopilotHub />
						</Suspense>
					</AdminLayout>
				)}
			</Route>
			<Route path="/admin/copilot/email">
				{() => (
					<AdminLayout>
						<Suspense fallback={<LoadingState variant="dashboard" />}>
							<CopilotEmailIntelligence />
						</Suspense>
					</AdminLayout>
				)}
			</Route>
			<Route path="/admin/copilot/proposals">
				{() => (
					<AdminLayout>
						<Suspense fallback={<LoadingState variant="dashboard" />}>
							<CopilotProposalDrafts />
						</Suspense>
					</AdminLayout>
				)}
			</Route>
			<Route path="/admin/copilot/tasks">
				{() => (
					<AdminLayout>
						<Suspense fallback={<LoadingState variant="dashboard" />}>
							<CopilotTaskManager />
						</Suspense>
					</AdminLayout>
				)}
			</Route>
			<Route path="/admin/copilot/audit-logs">
				{() => (
					<AdminLayout>
						<Suspense fallback={<LoadingState variant="dashboard" />}>
							<CopilotAuditLogs />
						</Suspense>
					</AdminLayout>
				)}
			</Route>
			<Route path="/admin/copilot/bi">
				{() => (
					<AdminLayout>
						<Suspense fallback={<LoadingState variant="dashboard" />}>
							<CopilotBiDashboard />
						</Suspense>
					</AdminLayout>
				)}
			</Route>
			<Route path="/admin/copilot/compliance">
				{() => (
					<AdminLayout>
						<Suspense fallback={<LoadingState variant="dashboard" />}>
							<CopilotComplianceAlerts />
						</Suspense>
					</AdminLayout>
				)}
			</Route>
			<Route path="/admin/copilot/crm">
				{() => (
					<AdminLayout>
						<Suspense fallback={<LoadingState variant="dashboard" />}>
							<CopilotCrmIntelligence />
						</Suspense>
					</AdminLayout>
				)}
			</Route>
			<Route path="/admin/copilot/desk">
				{() => (
					<AdminLayout>
						<Suspense fallback={<LoadingState variant="dashboard" />}>
							<CopilotDeskIntelligence />
						</Suspense>
					</AdminLayout>
				)}
			</Route>
			<Route path="/admin/copilot/finance">
				{() => (
					<AdminLayout>
						<Suspense fallback={<LoadingState variant="dashboard" />}>
							<CopilotBooksFinance />
						</Suspense>
					</AdminLayout>
				)}
			</Route>
			<Route path="/admin/copilot/meetings">
				{() => (
					<AdminLayout>
						<Suspense fallback={<LoadingState variant="dashboard" />}>
							<CopilotMeetings />
						</Suspense>
					</AdminLayout>
				)}
			</Route>
			<Route component={NotFound} />
		</Switch>
	);
}
