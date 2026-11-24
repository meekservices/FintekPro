import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Users,
	Building2,
	TrendingUp,
	FileText,
	Settings,
	DollarSign,
	UserPlus,
	BarChart3,
	Clock,
	CheckCircle2,
	AlertTriangle,
	Search,
	Download,
	ArrowUpRight,
	ArrowDownRight,
	Wallet,
	PiggyBank,
	Target,
	Shield as LucideShield,
	UserCheck,
	Briefcase,
	Activity,
	Zap,
	RefreshCw,
	CheckCircle,
} from "lucide-react";

export default function DistributionPartnerPortal() {
	const [, navigate] = useLocation();
	const { toast } = useToast();
	const [activeTab, setActiveTab] = useState("overview");
	const [searchQuery, setSearchQuery] = useState("");

	const { data: partnerProfile, isLoading: profileLoading } = useQuery({
		queryKey: ["/api/partner/profile"],
	});

	const { data: partnerStats, isLoading: statsLoading } = useQuery({
		queryKey: ["/api/partner/stats"],
	});

	const { data: agents, isLoading: agentsLoading } = useQuery({
		queryKey: ["/api/partner/agents"],
	});

	const { data: commissions, isLoading: commissionsLoading } = useQuery({
		queryKey: ["/api/partner/commissions"],
	});

	const { data: clients, isLoading: clientsLoading } = useQuery({
		queryKey: ["/api/partner/clients"],
	});

	const { data: recentActivity } = useQuery<
		Array<{
			id: string;
			type: string;
			title: string;
			description: string;
			timestamp: string;
		}>
	>({
		queryKey: ["/api/partner/activity"],
	});

	const { data: topAgents } = useQuery<
		Array<{
			id: string;
			name: string;
			clients: number;
			business: number;
			growth: number;
			rank: number;
		}>
	>({
		queryKey: ["/api/partner/top-agents"],
	});

	const { data: deskStatusData, refetch: refetchDesks } = useQuery<{
		success: boolean;
		data: {
			mode: "TEST_SANDBOX" | "PRODUCTION_LIVE";
			tier: "TIER_1_BASIC_LEAD_GEN" | "TIER_2_EXECUTION_READY" | "TIER_3_FULL_POWERHOUSE";
			config: {
				isAmfiMfdActive: boolean;
				isUpstoxDirectActive: boolean;
				isBondDistributionActive: boolean;
				isAlpacaUsActive: boolean;
				isSebiRiaActive: boolean;
			};
			licenses: Array<{
				id: string;
				desk: string;
				licenseType: string;
				registrationNumber: string | null;
				holderEntity: string;
				isVerified: boolean;
				status: string;
			}>;
		};
	}>({
		queryKey: ["/api/admin/desks/status"],
	});

	const { data: circuitsData, refetch: refetchCircuits } = useQuery<{
		success: boolean;
		data: Record<string, { state: string; failureCount: number; lastFailureTime: string | null }>;
	}>({
		queryKey: ["/api/admin/desks/circuits"],
	});

	const isLoading = profileLoading || statsLoading;

	if (isLoading) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-background via-blue-50/30 to-indigo-50/30 dark:from-background dark:via-blue-950/30 dark:to-indigo-950/30">
				<div className="container mx-auto p-6">
					<div className="flex items-center justify-center h-64">
						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3" />
						<div className="text-lg">Loading partner portal...</div>
					</div>
				</div>
			</div>
		);
	}

	interface PartnerStats {
		totalAgents: number;
		activeAgents: number;
		totalClients: number;
		totalAUM: number;
		totalCommissions: number;
		pendingCommissions: number;
		thisMonthBusiness: number;
		lastMonthBusiness: number;
	}

	const stats: PartnerStats = (partnerStats as PartnerStats) || {
		totalAgents: 0,
		activeAgents: 0,
		totalClients: 0,
		totalAUM: 0,
		totalCommissions: 0,
		pendingCommissions: 0,
		thisMonthBusiness: 0,
		lastMonthBusiness: 0,
	};

	const growthRate =
		stats.lastMonthBusiness > 0
			? (
					((stats.thisMonthBusiness - stats.lastMonthBusiness) /
						stats.lastMonthBusiness) *
					100
				).toFixed(1)
			: 0;

	return (
		<div
			className="min-h-screen bg-gradient-to-br from-background via-blue-50/30 to-indigo-50/30 dark:from-background dark:via-blue-950/30 dark:to-indigo-950/30"
			data-testid="distribution-partner-portal"
		>
			<div className="container mx-auto p-6">
				<div className="flex items-center justify-between mb-6">
					<div>
						<div className="flex items-center gap-2 mb-1">
							<Briefcase className="h-8 w-8 text-primary" />
							<h1 className="text-3xl font-bold text-foreground">
								Partner Portal
							</h1>
						</div>
						<p className="text-muted-foreground">
							Welcome back, {(partnerProfile as any)?.companyName || "Partner"}
						</p>
					</div>
					<div className="flex gap-2">
						<Badge
							variant="outline"
							className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
						>
							<LucideShield className="h-3 w-3 mr-1" />
							{(partnerProfile as any)?.commissionTier || "Standard"} Tier
						</Badge>
						{(partnerProfile as any)?.arnCode && (
							<Badge
								variant="outline"
								className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
							>
								ARN: {(partnerProfile as any).arnCode}
							</Badge>
						)}
					</div>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
					<Card className="border-l-4 border-l-blue-500">
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Total Partners
							</CardTitle>
							<Users className="h-4 w-4 text-blue-500" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">{stats.totalAgents}</div>
							<p className="text-xs text-muted-foreground">
								<span className="text-green-600">{stats.activeAgents}</span>{" "}
								active partners
							</p>
						</CardContent>
					</Card>

					<Card className="border-l-4 border-l-purple-500">
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Total Clients
							</CardTitle>
							<Building2 className="h-4 w-4 text-purple-500" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">{stats.totalClients}</div>
							<p className="text-xs text-muted-foreground">Across all partners</p>
						</CardContent>
					</Card>

					<Card className="border-l-4 border-l-emerald-500">
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">Total AUM</CardTitle>
							<Wallet className="h-4 w-4 text-emerald-500" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">
								₹{(stats.totalAUM / 10000000).toFixed(2)} Cr
							</div>
							<p className="text-xs text-muted-foreground">
								Assets under management
							</p>
						</CardContent>
					</Card>

					<Card className="border-l-4 border-l-amber-500">
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">This Month</CardTitle>
							<TrendingUp className="h-4 w-4 text-amber-500" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">
								₹{(stats.thisMonthBusiness / 100000).toFixed(2)} L
							</div>
							<p
								className={`text-xs flex items-center ${Number(growthRate) >= 0 ? "text-green-600" : "text-red-600"}`}
							>
								{Number(growthRate) >= 0 ? (
									<ArrowUpRight className="h-3 w-3" />
								) : (
									<ArrowDownRight className="h-3 w-3" />
								)}
								{growthRate}% from last month
							</p>
						</CardContent>
					</Card>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
					<Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-foreground">
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium text-foreground/90">
								Total Commissions Earned
							</CardTitle>
							<DollarSign className="h-5 w-5 text-foreground/80" />
						</CardHeader>
						<CardContent>
							<div className="text-3xl font-bold">
								₹{(stats.totalCommissions / 1000).toFixed(2)} K
							</div>
							<p className="text-sm text-foreground/70 mt-1">
								Lifetime earnings
							</p>
						</CardContent>
					</Card>

					<Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-foreground">
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium text-foreground/90">
								Pending Commissions
							</CardTitle>
							<Clock className="h-5 w-5 text-foreground/80" />
						</CardHeader>
						<CardContent>
							<div className="text-3xl font-bold">
								₹{(stats.pendingCommissions / 1000).toFixed(2)} K
							</div>
							<p className="text-sm text-foreground/70 mt-1">
								Awaiting settlement
							</p>
						</CardContent>
					</Card>

					<Card className="bg-gradient-to-br from-blue-500 to-indigo-600 text-foreground">
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium text-foreground/90">
								Commission Rate
							</CardTitle>
							<Target className="h-5 w-5 text-foreground/80" />
						</CardHeader>
						<CardContent>
							<div className="text-3xl font-bold">
								{(partnerProfile as any)?.commissionRate || "1.00"}%
							</div>
							<p className="text-sm text-foreground/70 mt-1">Current rate</p>
						</CardContent>
					</Card>
				</div>

				<Tabs value={activeTab} onValueChange={setActiveTab}>
					<ScrollableTabsList>
						<TabsTrigger value="overview" data-testid="tab-partner-overview">
							<BarChart3 className="h-4 w-4 mr-2" />
							Overview
						</TabsTrigger>
						<TabsTrigger value="agents" data-testid="tab-partner-agents">
							<Users className="h-4 w-4 mr-2" />
							Partner Network
						</TabsTrigger>
						<TabsTrigger value="clients" data-testid="tab-partner-clients">
							<Building2 className="h-4 w-4 mr-2" />
							Clients
						</TabsTrigger>
						<TabsTrigger
							value="commissions"
							data-testid="tab-partner-commissions"
						>
							<DollarSign className="h-4 w-4 mr-2" />
							Commissions
						</TabsTrigger>
						<TabsTrigger value="reports" data-testid="tab-partner-reports">
							<FileText className="h-4 w-4 mr-2" />
							Reports
						</TabsTrigger>
						<TabsTrigger value="desks" data-testid="tab-partner-desks">
							<LucideShield className="h-4 w-4 mr-2 text-indigo-400" />
							Desks & Gateways
						</TabsTrigger>
						<TabsTrigger value="settings" data-testid="tab-partner-settings">
							<Settings className="h-4 w-4 mr-2" />
							Settings
						</TabsTrigger>
					</ScrollableTabsList>

					<TabsContent value="overview" className="mt-6">
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
							<Card>
								<CardHeader>
									<CardTitle>Recent Activity</CardTitle>
									<CardDescription>
										Latest transactions and updates
									</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="space-y-4">
										{recentActivity && recentActivity.length > 0 ? (
											recentActivity.slice(0, 4).map((activity) => {
												const iconConfig: Record<
													string,
													{
														icon: typeof CheckCircle2;
														bgClass: string;
														iconClass: string;
													}
												> = {
													onboarding: {
														icon: CheckCircle2,
														bgClass:
															"bg-green-50 dark:bg-green-950/30 border-green-100 dark:border-green-900",
														iconClass: "text-green-600",
													},
													commission: {
														icon: DollarSign,
														bgClass:
															"bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900",
														iconClass: "text-blue-600",
													},
													kyc: {
														icon: AlertTriangle,
														bgClass:
															"bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900",
														iconClass: "text-amber-600",
													},
													agent: {
														icon: UserCheck,
														bgClass:
															"bg-purple-50 dark:bg-purple-950/30 border-purple-100 dark:border-purple-900",
														iconClass: "text-purple-600",
													},
												};
												const config =
													iconConfig[activity.type] || iconConfig.onboarding;
												const Icon = config.icon;
												return (
													<div
														key={activity.id}
														className={`flex items-center gap-4 p-3 rounded-lg border ${config.bgClass}`}
													>
														<Icon className={`h-5 w-5 ${config.iconClass}`} />
														<div className="flex-1">
															<p className="font-medium">{activity.title}</p>
															<p className="text-sm text-muted-foreground">
																{activity.description}
															</p>
														</div>
														<span className="text-xs text-muted-foreground">
															{activity.timestamp}
														</span>
													</div>
												);
											})
										) : (
											<p className="text-muted-foreground text-center py-4">
												No recent activity
											</p>
										)}
									</div>
								</CardContent>
							</Card>

							<Card>
								<CardHeader>
									<CardTitle>Top Performing Partners</CardTitle>
									<CardDescription>
										Based on this month's business
									</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="space-y-4">
										{topAgents && topAgents.length > 0 ? (
											topAgents.slice(0, 3).map((agent) => (
												<div
													key={agent.id || agent.rank}
													className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
												>
													<div className="flex items-center gap-3">
														<div
															className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
																agent.rank === 1
																	? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
																	: agent.rank === 2
																		? "bg-muted text-muted-foreground"
																		: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300"
															}`}
														>
															#{agent.rank}
														</div>
														<div>
															<p className="font-medium">{agent.name}</p>
															<p className="text-sm text-muted-foreground">
																{agent.clients} clients
															</p>
														</div>
													</div>
													<div className="text-right">
														<p className="font-bold">₹{agent.business} L</p>
														<p className="text-xs text-green-600">
															+{agent.growth}%
														</p>
													</div>
												</div>
											))
										) : (
											<p className="text-muted-foreground text-center py-4">
												No partner data available
											</p>
										)}
									</div>
								</CardContent>
							</Card>

							<Card className="lg:col-span-2">
								<CardHeader>
									<CardTitle>Partner Network Summary</CardTitle>
									<CardDescription>
										Distribution of your partner network
									</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
										<div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-center">
											<Users className="h-8 w-8 text-blue-600 mx-auto mb-2" />
											<p className="text-2xl font-bold">
												{stats.activeAgents || 0}
											</p>
											<p className="text-sm text-muted-foreground">
												Active Partners
											</p>
										</div>
										<div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg text-center">
											<UserCheck className="h-8 w-8 text-green-600 mx-auto mb-2" />
											<p className="text-2xl font-bold">0</p>
											<p className="text-sm text-muted-foreground">
												Field Executives
											</p>
										</div>
										<div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg text-center">
											<Briefcase className="h-8 w-8 text-purple-600 mx-auto mb-2" />
											<p className="text-2xl font-bold">0</p>
											<p className="text-sm text-muted-foreground">
												Business Associates
											</p>
										</div>
										<div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-center">
											<Clock className="h-8 w-8 text-amber-600 mx-auto mb-2" />
											<p className="text-2xl font-bold">0</p>
											<p className="text-sm text-muted-foreground">
												Pending Approval
											</p>
										</div>
									</div>
								</CardContent>
							</Card>
						</div>
					</TabsContent>

					<TabsContent value="agents" className="mt-6">
						<Card>
							<CardHeader>
								<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
									<div>
										<CardTitle>Partner Network Management</CardTitle>
										<CardDescription>
											Manage your partners, field executives, and business
											associates
										</CardDescription>
									</div>
									<div className="flex gap-2">
										<div className="relative">
											<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
											<Input
												placeholder="Search partners..."
												className="pl-9 w-64"
												value={searchQuery}
												onChange={(e) => setSearchQuery(e.target.value)}
												data-testid="input-search-agents"
											/>
										</div>
										<Button
											className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-foreground shadow-md"
											data-testid="button-add-agent"
											onClick={() => navigate("/partner-application")}
										>
											<UserPlus className="h-4 w-4 mr-2" />
											Add Partner
										</Button>
									</div>
								</div>
							</CardHeader>
							<CardContent>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Partner Name</TableHead>
											<TableHead>Level</TableHead>
											<TableHead>EUIN/ARN</TableHead>
											<TableHead>Clients</TableHead>
											<TableHead>AUM</TableHead>
											<TableHead>Commission</TableHead>
											<TableHead>Status</TableHead>
											<TableHead>Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{agentsLoading ? (
											<TableRow>
												<TableCell colSpan={8} className="text-center py-8">
													<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2" />
													Loading partners...
												</TableCell>
											</TableRow>
										) : (agents as any)?.length > 0 ? (
											(agents as any).map((agent: any, index: number) => (
												<TableRow key={agent.id || index}>
													<TableCell className="font-medium">
														{agent.fullName}
													</TableCell>
													<TableCell>
														<Badge
															variant="outline"
															className={
																agent.agentLevel === "master"
																	? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200"
																	: agent.agentLevel === "sub_agent"
																		? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
																		: "bg-muted text-foreground"
															}
														>
															{agent.agentLevel === "master"
																? "Partner"
																: agent.agentLevel === "sub_agent"
																	? "Field Executive"
																	: agent.agentLevel === "district_associate"
																		? "District Associate"
																		: agent.agentLevel === "field_associate"
																			? "Field Associate"
																			: "Business Associate"}
														</Badge>
													</TableCell>
													<TableCell>
														{agent.euinNumber || agent.arnCode || "-"}
													</TableCell>
													<TableCell>{agent.clientCount || 0}</TableCell>
													<TableCell>
														₹{((agent.totalAum || 0) / 100000).toFixed(2)} L
													</TableCell>
													<TableCell>
														₹{((agent.totalCommissions || 0) / 1000).toFixed(2)}{" "}
														K
													</TableCell>
													<TableCell>
														<Badge
															variant={agent.isActive ? "default" : "secondary"}
														>
															{agent.isActive ? "Active" : "Inactive"}
														</Badge>
													</TableCell>
													<TableCell>
														<Button
															variant="ghost"
															size="sm"
															className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950"
															data-testid={`button-view-agent-${index}`}
															onClick={() => navigate(`/agent-portal`)}
														>
															View
														</Button>
													</TableCell>
												</TableRow>
											))
										) : (
											<TableRow>
												<TableCell colSpan={8} className="text-center py-12">
													<Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
													<p className="text-lg font-medium mb-1">
														No partners in your network
													</p>
													<p className="text-muted-foreground mb-4">
														Start building your distribution network
													</p>
													<Button
														className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-foreground"
														data-testid="button-onboard-first-agent"
														onClick={() => navigate("/partner-application")}
													>
														<UserPlus className="h-4 w-4 mr-2" />
														Onboard First Partner
													</Button>
												</TableCell>
											</TableRow>
										)}
									</TableBody>
								</Table>
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="clients" className="mt-6">
						<Card>
							<CardHeader>
								<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
									<div>
										<CardTitle>Client Overview</CardTitle>
										<CardDescription>
											All clients across your partner network
										</CardDescription>
									</div>
									<div className="flex gap-2">
										<div className="relative">
											<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
											<Input
												placeholder="Search clients..."
												className="pl-9 w-64"
												data-testid="input-search-clients"
											/>
										</div>
										<Button
											variant="outline"
											className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950"
											data-testid="button-export-clients"
											onClick={() =>
												toast({
													title: "Export Started",
													description: "Preparing client data for export...",
												})
											}
										>
											<Download className="h-4 w-4 mr-2" />
											Export
										</Button>
									</div>
								</div>
							</CardHeader>
							<CardContent>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Client Name</TableHead>
											<TableHead>PAN</TableHead>
											<TableHead>Partner</TableHead>
											<TableHead>Portfolio Value</TableHead>
											<TableHead>KYC Status</TableHead>
											<TableHead>Last Activity</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{clientsLoading ? (
											<TableRow>
												<TableCell colSpan={6} className="text-center py-8">
													<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2" />
													Loading clients...
												</TableCell>
											</TableRow>
										) : (clients as any)?.length > 0 ? (
											(clients as any).map((client: any, index: number) => (
												<TableRow key={client.id || index}>
													<TableCell className="font-medium">
														{client.name}
													</TableCell>
													<TableCell>{client.panNumber || "-"}</TableCell>
													<TableCell>{client.agentName || "-"}</TableCell>
													<TableCell>
														₹
														{((client.portfolioValue || 0) / 100000).toFixed(2)}{" "}
														L
													</TableCell>
													<TableCell>
														<Badge
															variant={
																client.kycStatus === "verified"
																	? "default"
																	: "secondary"
															}
														>
															{client.kycStatus || "Pending"}
														</Badge>
													</TableCell>
													<TableCell>{client.lastActivity || "-"}</TableCell>
												</TableRow>
											))
										) : (
											<TableRow>
												<TableCell colSpan={6} className="text-center py-12">
													<Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
													<p className="text-lg font-medium mb-1">
														No clients yet
													</p>
													<p className="text-muted-foreground">
														Clients will appear here once partners onboard them
													</p>
												</TableCell>
											</TableRow>
										)}
									</TableBody>
								</Table>
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="commissions" className="mt-6">
						<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="text-sm font-medium">
										This Month
									</CardTitle>
									<PiggyBank className="h-4 w-4 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-bold">
										₹{((stats.thisMonthBusiness * 0.01) / 1000).toFixed(2)} K
									</div>
									<p className="text-xs text-muted-foreground">
										Estimated commission
									</p>
								</CardContent>
							</Card>

							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="text-sm font-medium">
										Pending Payout
									</CardTitle>
									<Clock className="h-4 w-4 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-bold">
										₹{(stats.pendingCommissions / 1000).toFixed(2)} K
									</div>
									<p className="text-xs text-muted-foreground">
										Next payout: 15th
									</p>
								</CardContent>
							</Card>

							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="text-sm font-medium">
										YTD Earnings
									</CardTitle>
									<DollarSign className="h-4 w-4 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-bold">
										₹{(stats.totalCommissions / 1000).toFixed(2)} K
									</div>
									<p className="text-xs text-muted-foreground">Year to date</p>
								</CardContent>
							</Card>
						</div>

						<Card>
							<CardHeader>
								<div className="flex items-center justify-between">
									<div>
										<CardTitle>Commission History</CardTitle>
										<CardDescription>
											Track your earnings and payouts
										</CardDescription>
									</div>
									<Button
										variant="outline"
										className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950"
										data-testid="button-download-statement"
										onClick={() =>
											toast({
												title: "Generating Statement",
												description:
													"Your commission statement will be ready for download shortly.",
											})
										}
									>
										<Download className="h-4 w-4 mr-2" />
										Download Statement
									</Button>
								</div>
							</CardHeader>
							<CardContent>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Date</TableHead>
											<TableHead>Type</TableHead>
											<TableHead>Description</TableHead>
											<TableHead>Amount</TableHead>
											<TableHead>Status</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{commissionsLoading ? (
											<TableRow>
												<TableCell colSpan={5} className="text-center py-8">
													Loading commissions...
												</TableCell>
											</TableRow>
										) : (commissions as any)?.length > 0 ? (
											(commissions as any).map((comm: any, index: number) => (
												<TableRow key={comm.id || index}>
													<TableCell>{comm.date}</TableCell>
													<TableCell>{comm.type}</TableCell>
													<TableCell>{comm.description}</TableCell>
													<TableCell className="font-medium text-green-600">
														₹{comm.amount}
													</TableCell>
													<TableCell>
														<Badge
															variant={
																comm.status === "paid" ? "default" : "secondary"
															}
														>
															{comm.status}
														</Badge>
													</TableCell>
												</TableRow>
											))
										) : (
											<TableRow>
												<TableCell colSpan={5} className="text-center py-12">
													<DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
													<p className="text-lg font-medium mb-1">
														No commission history yet
													</p>
													<p className="text-muted-foreground">
														Commissions will appear here as business is
														generated
													</p>
												</TableCell>
											</TableRow>
										)}
									</TableBody>
								</Table>
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="reports" className="mt-6">
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							{[
								{
									title: "AUM Report",
									desc: "Assets under management breakdown",
									icon: Wallet,
									testId: "aum",
								},
								{
									title: "Commission Report",
									desc: "Detailed commission breakdown",
									icon: DollarSign,
									testId: "commission",
								},
								{
									title: "Client Report",
									desc: "Client portfolio summaries",
									icon: Building2,
									testId: "client",
								},
								{
									title: "Partner Performance",
									desc: "Partner-wise business analysis",
									icon: Users,
									testId: "agent",
								},
								{
									title: "Transaction Report",
									desc: "All transactions history",
									icon: FileText,
									testId: "transaction",
								},
								{
									title: "Compliance Report",
									desc: "KYC and regulatory status",
									icon: LucideShield,
									testId: "compliance",
								},
							].map((report) => (
								<Card
									key={report.testId}
									className="cursor-pointer hover:shadow-md transition-shadow"
									data-testid={`card-report-${report.testId}`}
								>
									<CardHeader>
										<div className="flex items-center gap-3">
											<div className="p-2 bg-primary/10 rounded-lg">
												<report.icon className="h-5 w-5 text-primary" />
											</div>
											<div>
												<CardTitle className="text-lg">
													{report.title}
												</CardTitle>
												<CardDescription>{report.desc}</CardDescription>
											</div>
										</div>
									</CardHeader>
									<CardContent>
										<Button
											variant="outline"
											className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950"
											data-testid={`button-generate-${report.testId}-report`}
											onClick={() =>
												toast({
													title: "Generating Report",
													description: `Preparing ${report.title}...`,
												})
											}
										>
											<FileText className="h-4 w-4 mr-2" />
											Generate Report
										</Button>
									</CardContent>
								</Card>
							))}
						</div>
					</TabsContent>

					<TabsContent value="settings" className="mt-6">
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
							<Card>
								<CardHeader>
									<CardTitle>Partner Profile</CardTitle>
									<CardDescription>Your business information</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="grid grid-cols-2 gap-4">
										<div>
											<span className="text-sm font-medium text-muted-foreground block">
												Company Name
											</span>
											<p className="font-medium">
												{(partnerProfile as any)?.companyName || "-"}
											</p>
										</div>
										<div>
											<span className="text-sm font-medium text-muted-foreground block">
												Partner Type
											</span>
											<p className="font-medium">
												{(partnerProfile as any)?.partnerType || "-"}
											</p>
										</div>
										<div>
											<span className="text-sm font-medium text-muted-foreground block">
												Email
											</span>
											<p className="font-medium">
												{(partnerProfile as any)?.contactEmail || "-"}
											</p>
										</div>
										<div>
											<span className="text-sm font-medium text-muted-foreground block">
												Phone
											</span>
											<p className="font-medium">
												{(partnerProfile as any)?.contactPhone || "-"}
											</p>
										</div>
										<div>
											<span className="text-sm font-medium text-muted-foreground block">
												ARN Code
											</span>
											<p className="font-medium">
												{(partnerProfile as any)?.arnCode || "-"}
											</p>
										</div>
										<div>
											<span className="text-sm font-medium text-muted-foreground block">
												EUIN Number
											</span>
											<p className="font-medium">
												{(partnerProfile as any)?.euinNumber || "-"}
											</p>
										</div>
									</div>
									<Button
										variant="outline"
										className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950"
										data-testid="button-edit-profile"
										onClick={() => navigate("/profile")}
									>
										Edit Profile
									</Button>
								</CardContent>
							</Card>

							<Card>
								<CardHeader>
									<CardTitle>Bank Details</CardTitle>
									<CardDescription>For commission payouts</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="grid grid-cols-2 gap-4">
										<div>
											<span className="text-sm font-medium text-muted-foreground block">
												Account Holder
											</span>
											<p className="font-medium">
												{(partnerProfile as any)?.bankAccountHolderName || "-"}
											</p>
										</div>
										<div>
											<span className="text-sm font-medium text-muted-foreground block">
												Account Number
											</span>
											<p className="font-medium">
												{(partnerProfile as any)?.bankAccountNumber
													? "****" +
														(partnerProfile as any).bankAccountNumber.slice(-4)
													: "-"}
											</p>
										</div>
										<div>
											<span className="text-sm font-medium text-muted-foreground block">
												IFSC Code
											</span>
											<p className="font-medium">
												{(partnerProfile as any)?.ifscCode || "-"}
											</p>
										</div>
										<div>
											<span className="text-sm font-medium text-muted-foreground block">
												UPI ID
											</span>
											<p className="font-medium">
												{(partnerProfile as any)?.upiId || "-"}
											</p>
										</div>
									</div>
									<Button
										variant="outline"
										className="w-full border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950"
										data-testid="button-update-bank"
										onClick={() => navigate("/profile")}
									>
										Update Bank Details
									</Button>
								</CardContent>
							</Card>
						</div>
					</TabsContent>

					{/* Distribution Desks & Gateways Surveillance Tab */}
					<TabsContent value="desks" className="mt-6 space-y-6">
						<Card className="border-indigo-800/40 bg-gradient-to-r from-indigo-950/60 via-slate-900 to-indigo-950/40 text-foreground">
							<CardHeader>
								<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
									<div>
										<div className="flex items-center gap-2">
											<Badge
												variant="outline"
												className={
													deskStatusData?.data.mode === "TEST_SANDBOX"
														? "border-amber-500/50 bg-amber-500/10 text-amber-300 font-mono"
														: "border-emerald-500/50 bg-emerald-500/10 text-emerald-300 font-mono"
												}
											>
												<Activity className="w-3.5 h-3.5 mr-1" />
												{deskStatusData?.data.mode === "TEST_SANDBOX"
													? "Operating Mode: TEST SANDBOX (Simulated)"
													: "Operating Mode: PRODUCTION LIVE"}
											</Badge>
											<Badge
												variant="secondary"
												className="bg-indigo-900/60 text-indigo-200 border border-indigo-700/50"
											>
												{deskStatusData?.data.tier === "TIER_3_FULL_POWERHOUSE"
													? "Tier 3: Full Powerhouse"
													: deskStatusData?.data.tier === "TIER_2_EXECUTION_READY"
													? "Tier 2: Execution Ready"
													: "Tier 1: Basic Lead Gen"}
											</Badge>
										</div>
										<CardTitle className="text-xl font-bold mt-2 text-white">
											FintekPro Financial Services LLP — Distribution Desks
										</CardTitle>
										<CardDescription className="text-indigo-200/80">
											Status of licensed partner desks, execution gateways, and real-time partner circuit breakers.
										</CardDescription>
									</div>

									<Button
										size="sm"
										variant="outline"
										className="border-indigo-500/40 text-indigo-200 hover:text-white"
										onClick={() => {
											refetchDesks();
											refetchCircuits();
											toast({ title: "Desks Refreshed", description: "Updated desk licenses and circuit breaker states." });
										}}
									>
										<RefreshCw className="w-4 h-4 mr-2" />
										Refresh Gateways
									</Button>
								</div>
							</CardHeader>
						</Card>

						{/* Desk Cards Grid */}
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							{/* AMFI MFD Desk */}
							<Card className="border-border/70">
								<CardHeader className="pb-3">
									<div className="flex items-center justify-between">
										<CardTitle className="text-base font-bold flex items-center gap-2">
											<LucideShield className="w-4 h-4 text-emerald-400" />
											AMFI MFD Corporate Desk
										</CardTitle>
										<Badge
											variant={deskStatusData?.data.config.isAmfiMfdActive ? "default" : "outline"}
											className={deskStatusData?.data.config.isAmfiMfdActive ? "bg-emerald-600 text-white" : "text-muted-foreground"}
										>
											{deskStatusData?.data.config.isAmfiMfdActive ? "Active" : "Sandbox Mock"}
										</Badge>
									</div>
									<CardDescription className="text-xs">
										Regular Mutual Funds, SIPs, ELSS via KFintech IRIS & CAMS.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-2 text-xs">
									<div className="flex justify-between py-1 border-b border-border/40">
										<span className="text-muted-foreground">Entity:</span>
										<span className="font-medium">FintekPro Financial Services LLP</span>
									</div>
									<div className="flex justify-between py-1 border-b border-border/40">
										<span className="text-muted-foreground">ARN Status:</span>
										<span className="font-semibold text-emerald-400">AMFI Registered Distributor</span>
									</div>
									<div className="flex justify-between py-1">
										<span className="text-muted-foreground">Settlement:</span>
										<span>RTA Direct to AMC / BSE Star MF</span>
									</div>
								</CardContent>
							</Card>

							{/* Upstox Direct Desk */}
							<Card className="border-border/70">
								<CardHeader className="pb-3">
									<div className="flex items-center justify-between">
										<CardTitle className="text-base font-bold flex items-center gap-2">
											<Zap className="w-4 h-4 text-blue-400" />
											Upstox Equity & Debt Desk
										</CardTitle>
										<Badge
											variant={deskStatusData?.data.config.isUpstoxDirectActive ? "default" : "outline"}
											className={deskStatusData?.data.config.isUpstoxDirectActive ? "bg-blue-600 text-white" : "text-muted-foreground"}
										>
											{deskStatusData?.data.config.isUpstoxDirectActive ? "Active" : "Sandbox Mock"}
										</Badge>
									</div>
									<CardDescription className="text-xs">
										Direct Equities, Derivatives (F&O), and Direct MF via Upstox AP API.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-2 text-xs">
									<div className="flex justify-between py-1 border-b border-border/40">
										<span className="text-muted-foreground">Broker Partner:</span>
										<span className="font-medium">Upstox (RKSV Securities)</span>
									</div>
									<div className="flex justify-between py-1 border-b border-border/40">
										<span className="text-muted-foreground">Revenue Stream:</span>
										<span className="font-semibold text-blue-400">Trading API & Advisory Sub</span>
									</div>
									<div className="flex justify-between py-1">
										<span className="text-muted-foreground">Execution:</span>
										<span>Sub-broker AP Integration</span>
									</div>
								</CardContent>
							</Card>

							{/* Bonds & NCDs Desk */}
							<Card className="border-border/70">
								<CardHeader className="pb-3">
									<div className="flex items-center justify-between">
										<CardTitle className="text-base font-bold flex items-center gap-2">
											<Building2 className="w-4 h-4 text-purple-400" />
											Bonds & NCDs Desk
										</CardTitle>
										<Badge
											variant={deskStatusData?.data.config.isBondDistributionActive ? "default" : "outline"}
											className={deskStatusData?.data.config.isBondDistributionActive ? "bg-purple-600 text-white" : "text-muted-foreground"}
										>
											{deskStatusData?.data.config.isBondDistributionActive ? "Active" : "Sandbox Mock"}
										</Badge>
									</div>
									<CardDescription className="text-xs">
										Corporate Bonds, Non-Convertible Debentures (NCDs), SGBs & 54EC.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-2 text-xs">
									<div className="flex justify-between py-1 border-b border-border/40">
										<span className="text-muted-foreground">Desk Type:</span>
										<span className="font-medium">OBPP Debt Distribution</span>
									</div>
									<div className="flex justify-between py-1 border-b border-border/40">
										<span className="text-muted-foreground">Clearing House:</span>
										<span className="font-semibold text-purple-400">ICCL / NCL Settlement</span>
									</div>
									<div className="flex justify-between py-1">
										<span className="text-muted-foreground">Fixed Yield:</span>
										<span>8.50% - 11.25% p.a. Curated</span>
									</div>
								</CardContent>
							</Card>

							{/* Alpaca US Equities Desk */}
							<Card className="border-border/70">
								<CardHeader className="pb-3">
									<div className="flex items-center justify-between">
										<CardTitle className="text-base font-bold flex items-center gap-2">
											<TrendingUp className="w-4 h-4 text-amber-400" />
											Alpaca Global Equities Desk
										</CardTitle>
										<Badge
											variant={deskStatusData?.data.config.isAlpacaUsActive ? "default" : "outline"}
											className={deskStatusData?.data.config.isAlpacaUsActive ? "bg-amber-600 text-white" : "text-muted-foreground"}
										>
											{deskStatusData?.data.config.isAlpacaUsActive ? "Active" : "Sandbox Mock"}
										</Badge>
									</div>
									<CardDescription className="text-xs">
										US Equities, ETFs, and Fractional Shares under RBI LRS ($250k/yr).
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-2 text-xs">
									<div className="flex justify-between py-1 border-b border-border/40">
										<span className="text-muted-foreground">US Broker-Dealer:</span>
										<span className="font-medium">Alpaca Securities LLC (FINRA/SIPC)</span>
									</div>
									<div className="flex justify-between py-1 border-b border-border/40">
										<span className="text-muted-foreground">Foreign Referral:</span>
										<span className="font-semibold text-amber-400">Non-resident Broker Partner</span>
									</div>
									<div className="flex justify-between py-1">
										<span className="text-muted-foreground">FEMA Remittance:</span>
										<span>Form A2 + Outward Remittance</span>
									</div>
								</CardContent>
							</Card>

							{/* SEBI RIA AI Advisory Desk */}
							<Card className="border-border/70">
								<CardHeader className="pb-3">
									<div className="flex items-center justify-between">
										<CardTitle className="text-base font-bold flex items-center gap-2">
											<BarChart3 className="w-4 h-4 text-teal-400" />
											SEBI RIA Advisory Desk
										</CardTitle>
										<Badge
											variant={deskStatusData?.data.config.isSebiRiaActive ? "default" : "outline"}
											className={deskStatusData?.data.config.isSebiRiaActive ? "bg-teal-600 text-white" : "text-muted-foreground"}
										>
											{deskStatusData?.data.config.isSebiRiaActive ? "Active" : "Sandbox Mock"}
										</Badge>
									</div>
									<CardDescription className="text-xs">
										FASP-AI Decision Support Engine. Zero commission fee-only advice.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-2 text-xs">
									<div className="flex justify-between py-1 border-b border-border/40">
										<span className="text-muted-foreground">Model:</span>
										<span className="font-medium">SEBI (Investment Advisers) 2013</span>
									</div>
									<div className="flex justify-between py-1 border-b border-border/40">
										<span className="text-muted-foreground">Fee Model:</span>
										<span className="font-semibold text-teal-400">Fixed Flat Fee / Tiered</span>
									</div>
									<div className="flex justify-between py-1">
										<span className="text-muted-foreground">Chinese Wall:</span>
										<span>Strict Distribution Separation</span>
									</div>
								</CardContent>
							</Card>

							{/* Corporate FDs & Deposits Desk */}
							<Card className="border-border/70">
								<CardHeader className="pb-3">
									<div className="flex items-center justify-between">
										<CardTitle className="text-base font-bold flex items-center gap-2">
											<PiggyBank className="w-4 h-4 text-rose-400" />
											Corporate FDs & Deposits
										</CardTitle>
										<Badge variant="default" className="bg-rose-600 text-white">
											Active
										</Badge>
									</div>
									<CardDescription className="text-xs">
										High-yield AAA/AA+ Corporate FDs (Bajaj, Shriram, Mahindra, HDFC).
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-2 text-xs">
									<div className="flex justify-between py-1 border-b border-border/40">
										<span className="text-muted-foreground">Product Type:</span>
										<span className="font-medium">RBI Regulated NBFC Deposits</span>
									</div>
									<div className="flex justify-between py-1 border-b border-border/40">
										<span className="text-muted-foreground">Distribution Partner:</span>
										<span className="font-semibold text-rose-400">Direct NBFC Agency</span>
									</div>
									<div className="flex justify-between py-1">
										<span className="text-muted-foreground">Interest Rates:</span>
										<span>Up to 8.85% p.a. + Senior Citizen</span>
									</div>
								</CardContent>
							</Card>
						</div>

						{/* Real-Time Partner Circuit Breakers */}
						<Card className="border-border/70">
							<CardHeader>
								<CardTitle className="text-base font-bold flex items-center gap-2">
									<Zap className="w-5 h-5 text-amber-400" />
									Upstream Partner Gateways & Circuit Breakers
								</CardTitle>
								<CardDescription className="text-xs">
									Real-time health monitoring of third-party execution and account aggregation APIs.
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
									{[
										{ key: "UPSTOX", label: "Upstox Broker API", provider: "RKSV" },
										{ key: "KFINTECH", label: "KFintech IRIS", provider: "RTA" },
										{ key: "ALPACA", label: "Alpaca US Markets", provider: "US Broker" },
										{ key: "FINVU", label: "Finvu Account Aggregator", provider: "RBI AA" },
										{ key: "ANGEL_ONE", label: "Angel One SmartAPI", provider: "Broker" },
									].map(({ key, label, provider }) => {
										const circuit = circuitsData?.data?.[key];
										const isHealthy = !circuit || circuit.state === "CLOSED";

										return (
											<div
												key={key}
												className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-1.5"
											>
												<div className="flex items-center justify-between">
													<span className="text-[10px] text-muted-foreground uppercase font-mono">
														{provider}
													</span>
													<span
														className={`w-2 h-2 rounded-full ${
															isHealthy ? "bg-emerald-400" : "bg-red-500 animate-ping"
														}`}
													/>
												</div>
												<p className="font-semibold text-xs text-foreground truncate">{label}</p>
												<div className="flex items-center justify-between pt-1 text-[11px]">
													<span className="text-muted-foreground">State:</span>
													<span
														className={`font-mono font-bold ${
															isHealthy ? "text-emerald-400" : "text-rose-400"
														}`}
													>
														{circuit?.state || "HEALTHY"}
													</span>
												</div>
											</div>
										);
									})}
								</div>
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
