import { Suspense } from "react";
import { Redirect, Route, Switch } from "wouter";
import { LoadingState } from "@/components/LoadingState";
import { PartnerLayout } from "@/components/layout/partner-layout";
import { lazyWithRetry } from "@/lib/lazy-with-retry";
import AuthPage from "@/pages/auth-page";
import NotFound from "@/pages/not-found";

const AgentPortal = lazyWithRetry(() => import("@/pages/agent-portal"));
const AgentPayoutClaims = lazyWithRetry(
	() => import("@/pages/agent/payout-claims"),
);
const BiometricSettingsPage = lazyWithRetry(
	() => import("@/pages/biometric-settings"),
);
const Bonds = lazyWithRetry(() => import("@/pages/bonds"));
const CASupportDashboard = lazyWithRetry(
	() => import("@/pages/ca-support-dashboard"),
);
const CASupportDetail = lazyWithRetry(
	() => import("@/pages/ca-support-detail"),
);
const DistributionPartnerPortal = lazyWithRetry(
	() => import("@/pages/distribution-partner-portal"),
);
const MutualFunds = lazyWithRetry(() => import("@/pages/mutual-funds"));
const OnboardingPage = lazyWithRetry(() => import("@/pages/onboarding"));
const PartnerAgentDashboard = lazyWithRetry(
	() => import("@/pages/partner-agent-dashboard"),
);
const PartnerCAManagement = lazyWithRetry(
	() => import("@/pages/partner-ca-management"),
);
const PartnerMyProfile = lazyWithRetry(
	() => import("@/pages/partner/my-profile"),
);
const PartnerPortal = lazyWithRetry(() => import("@/pages/partner-portal"));
const PartnerRegister = lazyWithRetry(() => import("@/pages/partner-register"));
const PartnerRevenueSheet = lazyWithRetry(
	() => import("@/pages/partner/revenue-sheet"),
);
const PartnerTeamManagement = lazyWithRetry(
	() => import("@/pages/partner-team-management"),
);
const Profile = lazyWithRetry(() => import("@/pages/profile"));
const PublicProposalPage = lazyWithRetry(
	() => import("@/pages/public-proposal"),
);
const SettingsPage = lazyWithRetry(() => import("@/pages/settings"));
const ThemeSettings = lazyWithRetry(() => import("@/pages/theme-settings"));
const Unlisted = lazyWithRetry(() => import("@/pages/unlisted"));
const VideoKYC = lazyWithRetry(() => import("@/pages/video-kyc"));

function PartnerLoading() {
	return <LoadingState variant="partner-dashboard" />;
}

function PartnerShell({ children }: { children: React.ReactNode }) {
	return <PartnerLayout>{children}</PartnerLayout>;
}

export function PartnerRoutes() {
	return (
		<Switch>
			<Route path="/auth" component={AuthPage} />
			<Route path="/partner/auth" component={AuthPage} />
			<Route path="/partner/register">
				{() => (
					<Suspense
						fallback={
							<div className="min-h-screen bg-indigo-950 flex items-center justify-center">
								<div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-violet-500" />
							</div>
						}
					>
						<PartnerRegister />
					</Suspense>
				)}
			</Route>
			<Route path="/proposal/:shareToken" component={PublicProposalPage} />
			<Route path="/">
				{() => (
					<PartnerShell>
						<Suspense fallback={<PartnerLoading />}>
							<DistributionPartnerPortal />
						</Suspense>
					</PartnerShell>
				)}
			</Route>
			<Route path="/partner">
				{() => (
					<PartnerShell>
						<Suspense fallback={<PartnerLoading />}>
							<DistributionPartnerPortal />
						</Suspense>
					</PartnerShell>
				)}
			</Route>
			<Route path="/partner-portal">
				{() => (
					<PartnerShell>
						<Suspense fallback={<PartnerLoading />}>
							<DistributionPartnerPortal />
						</Suspense>
					</PartnerShell>
				)}
			</Route>
			<Route path="/partner/revenue-sheet">
				{() => (
					<PartnerShell>
						<Suspense fallback={<PartnerLoading />}>
							<PartnerRevenueSheet />
						</Suspense>
					</PartnerShell>
				)}
			</Route>
			<Route path="/products">
				{() => (
					<PartnerShell>
						<Suspense fallback={<PartnerLoading />}>
							<PartnerPortal />
						</Suspense>
					</PartnerShell>
				)}
			</Route>
			<Route path="/partner/agents">
				{() => (
					<PartnerShell>
						<Suspense fallback={<PartnerLoading />}>
							<PartnerAgentDashboard />
						</Suspense>
					</PartnerShell>
				)}
			</Route>
			<Route path="/partner/my-team">
				{() => (
					<PartnerShell>
						<Suspense fallback={<PartnerLoading />}>
							<PartnerTeamManagement />
						</Suspense>
					</PartnerShell>
				)}
			</Route>
			<Route path="/partner/my-profile">
				{() => (
					<PartnerShell>
						<Suspense fallback={<PartnerLoading />}>
							<PartnerMyProfile />
						</Suspense>
					</PartnerShell>
				)}
			</Route>
			<Route path="/ca-support">
				{() => (
					<PartnerShell>
						<CASupportDashboard />
					</PartnerShell>
				)}
			</Route>
			<Route path="/ca-support/:id">
				{() => (
					<PartnerShell>
						<CASupportDetail />
					</PartnerShell>
				)}
			</Route>
			<Route path="/partner/ca-support">
				{() => (
					<PartnerShell>
						<Suspense fallback={<PartnerLoading />}>
							<CASupportDashboard />
						</Suspense>
					</PartnerShell>
				)}
			</Route>
			<Route path="/partner/ca-support/:id">
				{() => (
					<PartnerShell>
						<Suspense fallback={<PartnerLoading />}>
							<CASupportDetail />
						</Suspense>
					</PartnerShell>
				)}
			</Route>
			<Route path="/partner/payouts">
				{() => (
					<PartnerShell>
						<Suspense fallback={<PartnerLoading />}>
							<AgentPayoutClaims />
						</Suspense>
					</PartnerShell>
				)}
			</Route>
			<Route path="/partner/agent-performance">
				{() => (
					<PartnerShell>
						<Suspense fallback={<PartnerLoading />}>
							<PartnerAgentDashboard />
						</Suspense>
					</PartnerShell>
				)}
			</Route>
			<Route path="/partner/ca-management">
				{() => (
					<PartnerShell>
						<Suspense fallback={<PartnerLoading />}>
							<PartnerCAManagement />
						</Suspense>
					</PartnerShell>
				)}
			</Route>
			<Route path="/partner/ca-dashboard">
				{() => (
					<PartnerShell>
						<Suspense fallback={<PartnerLoading />}>
							<PartnerCAManagement />
						</Suspense>
					</PartnerShell>
				)}
			</Route>
			<Route path="/partner/ca-clients">
				{() => (
					<PartnerShell>
						<Suspense fallback={<PartnerLoading />}>
							<PartnerCAManagement />
						</Suspense>
					</PartnerShell>
				)}
			</Route>
			<Route path="/mutual-funds">
				{() => (
					<PartnerShell>
						<MutualFunds />
					</PartnerShell>
				)}
			</Route>
			<Route path="/bonds">
				{() => (
					<PartnerShell>
						<Bonds />
					</PartnerShell>
				)}
			</Route>
			<Route path="/unlisted">
				{() => (
					<PartnerShell>
						<Unlisted />
					</PartnerShell>
				)}
			</Route>
			<Route path="/theme-settings">
				{() => (
					<PartnerShell>
						<ThemeSettings />
					</PartnerShell>
				)}
			</Route>
			<Route path="/settings">
				{() => (
					<PartnerShell>
						<Suspense fallback={<PartnerLoading />}>
							<SettingsPage />
						</Suspense>
					</PartnerShell>
				)}
			</Route>
			<Route path="/biometric-settings">
				{() => (
					<PartnerShell>
						<Suspense fallback={<PartnerLoading />}>
							<BiometricSettingsPage />
						</Suspense>
					</PartnerShell>
				)}
			</Route>
			<Route path="/profile">
				{() => (
					<PartnerShell>
						<Suspense fallback={<PartnerLoading />}>
							<Profile />
						</Suspense>
					</PartnerShell>
				)}
			</Route>
			<Route path="/onboarding" component={OnboardingPage} />
			<Route path="/video-kyc" component={VideoKYC} />
			<Route path="/kyc-dashboard">
				<Redirect to="/profile?tab=kyc-dashboard" />
			</Route>
			<Route path="/kyc/complete">
				<Redirect to="/profile?tab=kyc-dashboard" />
			</Route>
			<Route>
				{() => (
					<PartnerShell>
						<NotFound />
					</PartnerShell>
				)}
			</Route>
		</Switch>
	);
}
