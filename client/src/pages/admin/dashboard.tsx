import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Users,
	Activity,
	ShieldCheck,
	TrendingUp,
	TrendingDown,
	DollarSign,
	FileCheck,
	AlertTriangle,
	ArrowRight,
	RefreshCw,
	Clock,
	UserPlus,
	Briefcase,
	Building2,
	CheckCircle,
	XCircle,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
	AreaChart,
	Area,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
	BarChart,
	Bar,
	PieChart,
	Pie,
	Cell,
} from "recharts";

interface DashboardStats {
	totalClients: number;
	activeClients: number;
	newClientsToday: number;
	totalLogins: number;
	avgSessionTime: string;
	clientGrowthPercent: number;
	peakLogins: number;
	loginsToday: number;
	userGrowthData?: { name: string; users: number }[];
	userStats: {
		totalUsers: number;
		activeUsers: number;
		businessClients: number;
		newUsersToday: number;
		totalLogins: number;
		avgSessionTime: string;
	};
	activityMetrics: {
		dailyActiveUsers: number;
		weeklyActiveUsers: number;
		monthlyActiveUsers: number;
	};
	platformInsights: {
		registrationTrend: string;
		engagementRate: number;
		revenue: number;
	};
}

interface KycStats {
	pendingKyc: number;
	approvedToday: number;
	rejectedToday: number;
	pendingDocuments: number;
	activeAlerts: number;
	tier1Count: number;
	tier2Count: number;
	tier3Count: number;
}

interface StakeholderStats {
	totalPartners: number;
	activePartners: number;
	totalAgents: number;
	activeAgents: number;
	totalSuppliers: number;
	activeSuppliers: number;
}

interface PendingOrdersCount {
	unlistedPending: number;
	bondPending: number;
	total: number;
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function AdminDashboard() {
	const {
		data: dashboardData,
		isLoading: dashboardLoading,
		refetch: refetchDashboard,
	} = useQuery<DashboardStats>({
		queryKey: ["/api/admin/dashboard"],
	});

	const { data: kycResponse, isLoading: kycLoading } = useQuery<{
		success: boolean;
		data: KycStats;
	}>({
		queryKey: ["/api/admin/kyc/dashboard"],
	});
	const kycStats = kycResponse?.data;

	const { data: stakeholderResponse, isLoading: stakeholderLoading } =
		useQuery<{ stats: StakeholderStats }>({
			queryKey: ["/api/admin/stakeholders/stats"],
		});
	const stakeholderStats = stakeholderResponse?.stats;

	const { data: pendingOrdersData, isLoading: ordersLoading } =
		useQuery<PendingOrdersCount>({
			queryKey: ["/api/admin/pending-orders/count"],
		});

	const userGrowthData = dashboardData?.userGrowthData || [
		{ name: "Mon", users: 0 },
		{ name: "Tue", users: 0 },
		{ name: "Wed", users: 0 },
		{ name: "Thu", users: 0 },
		{ name: "Fri", users: 0 },
		{ name: "Sat", users: 0 },
		{ name: "Sun", users: 0 },
	];

	const kycDistribution = kycStats
		? [
				{
					name: "Tier 1 (Basic)",
					value: kycStats.tier1Count || 0,
					color: "#3b82f6",
				},
				{
					name: "Tier 2 (Enhanced)",
					value: kycStats.tier2Count || 0,
					color: "#10b981",
				},
				{
					name: "Tier 3 (Accredited)",
					value: kycStats.tier3Count || 0,
					color: "#f59e0b",
				},
			]
		: [];

	const formatNumber = (num: number | undefined) => {
		if (num === undefined) return "0";
		if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
		if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
		return num.toString();
	};

	const formatCurrency = (amount: number | undefined) => {
		if (amount === undefined) return "₹0";
		return new Intl.NumberFormat("en-IN", {
			style: "currency",
			currency: "INR",
			maximumFractionDigits: 0,
		}).format(amount);
	};

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1
						className="text-3xl font-bold text-foreground"
						data-testid="text-dashboard-title"
					>
						Admin Dashboard
					</h1>
					<p className="text-muted-foreground mt-1">
						Real-time platform overview and key metrics
					</p>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={() => refetchDashboard()}
					className="border-border text-muted-foreground hover:bg-muted"
					data-testid="btn-refresh-dashboard"
				>
					<RefreshCw className="w-4 h-4 mr-2" />
					Refresh
				</Button>
			</div>

			{/* Primary Metrics */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				{/* Total Users */}
				<Card className="bg-card border-border border-l-4 border-l-blue-500">
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Total Users
						</CardTitle>
						<Users className="h-4 w-4 text-blue-400" />
					</CardHeader>
					<CardContent>
						{dashboardLoading ? (
							<Skeleton className="h-8 w-24 bg-muted" />
						) : (
							<>
								<div
									className="text-2xl font-bold text-foreground"
									data-testid="text-total-users"
								>
									{formatNumber(dashboardData?.totalClients)}
								</div>
								<div className="flex items-center gap-1 mt-1">
									{(dashboardData?.clientGrowthPercent || 0) > 0 ? (
										<>
											<TrendingUp className="h-3 w-3 text-green-400" />
											<span className="text-xs text-green-400">
												+{dashboardData?.clientGrowthPercent}% this month
											</span>
										</>
									) : (
										<span className="text-xs text-muted-foreground">
											No change this month
										</span>
									)}
								</div>
							</>
						)}
					</CardContent>
				</Card>

				{/* Active Users */}
				<Card className="bg-card border-border border-l-4 border-l-green-500">
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Active Users
						</CardTitle>
						<Activity className="h-4 w-4 text-green-400" />
					</CardHeader>
					<CardContent>
						{dashboardLoading ? (
							<Skeleton className="h-8 w-24 bg-muted" />
						) : (
							<>
								<div
									className="text-2xl font-bold text-foreground"
									data-testid="text-active-users"
								>
									{formatNumber(dashboardData?.activeClients)}
								</div>
								<p className="text-xs text-muted-foreground mt-1">
									{dashboardData?.loginsToday || 0} logins today
								</p>
							</>
						)}
					</CardContent>
				</Card>

				{/* Business Clients */}
				<Card className="bg-card border-border border-l-4 border-l-purple-500">
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Business Clients
						</CardTitle>
						<Building2 className="h-4 w-4 text-purple-400" />
					</CardHeader>
					<CardContent>
						{dashboardLoading ? (
							<Skeleton className="h-8 w-24 bg-muted" />
						) : (
							<>
								<div
									className="text-2xl font-bold text-foreground"
									data-testid="text-business-clients"
								>
									{formatNumber(dashboardData?.userStats?.businessClients)}
								</div>
								<p className="text-xs text-purple-400 mt-1">
									Corporate accounts
								</p>
							</>
						)}
					</CardContent>
				</Card>

				{/* Platform Revenue */}
				<Card className="bg-card border-border border-l-4 border-l-amber-500">
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Platform Revenue
						</CardTitle>
						<DollarSign className="h-4 w-4 text-amber-400" />
					</CardHeader>
					<CardContent>
						{dashboardLoading ? (
							<Skeleton className="h-8 w-24 bg-muted" />
						) : (
							<>
								<div
									className="text-2xl font-bold text-foreground"
									data-testid="text-revenue"
								>
									{formatCurrency(dashboardData?.platformInsights?.revenue)}
								</div>
								<p className="text-xs text-amber-400 mt-1">Monthly revenue</p>
							</>
						)}
					</CardContent>
				</Card>
			</div>

			{/* Quick Actions Panel */}
			<Card className="bg-card border-border border-t-4 border-t-blue-500/40">
				<CardHeader>
					<CardTitle className="text-foreground flex items-center gap-2">
						<Clock className="w-5 h-5 text-blue-400" />
						Quick Actions
					</CardTitle>
					<CardDescription className="text-muted-foreground">
						Items requiring immediate attention
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
						<Link href="/admin/kyc-compliance">
							<div
								className="bg-orange-50 dark:bg-orange-950/20 rounded-lg p-4 hover:bg-orange-100 dark:hover:bg-orange-950/40 transition-colors cursor-pointer border border-orange-200 dark:border-orange-900"
								data-testid="link-pending-kyc"
							>
								<div className="flex items-center justify-between mb-2">
									<FileCheck className="w-8 h-8 text-orange-500" />
									{kycLoading ? (
										<Skeleton className="h-8 w-12 bg-muted" />
									) : (
										<span className="text-2xl font-bold text-orange-500">
											{kycStats?.pendingKyc || 0}
										</span>
									)}
								</div>
								<p className="text-sm font-medium text-foreground">
									Pending KYC Reviews
								</p>
								<div className="flex items-center gap-1 mt-2 text-xs text-orange-500 font-medium">
									Review Now <ArrowRight className="w-3 h-3" />
								</div>
							</div>
						</Link>

						<Link href="/admin/duplicates">
							<div
								className="bg-red-50 dark:bg-red-950/20 rounded-lg p-4 hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors cursor-pointer border border-red-200 dark:border-red-900"
								data-testid="link-compliance-alerts"
							>
								<div className="flex items-center justify-between mb-2">
									<AlertTriangle className="w-8 h-8 text-red-500" />
									{kycLoading ? (
										<Skeleton className="h-8 w-12 bg-muted" />
									) : (
										<span className="text-2xl font-bold text-red-500">
											{kycStats?.activeAlerts || 0}
										</span>
									)}
								</div>
								<p className="text-sm font-medium text-foreground">Active Alerts</p>
								<div className="flex items-center gap-1 mt-2 text-xs text-red-500 font-medium">
									View Alerts <ArrowRight className="w-3 h-3" />
								</div>
							</div>
						</Link>

						<Link href="/admin/stakeholders">
							<div
								className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4 hover:bg-green-100 dark:hover:bg-green-950/40 transition-colors cursor-pointer border border-green-200 dark:border-green-900"
								data-testid="link-new-registrations"
							>
								<div className="flex items-center justify-between mb-2">
									<UserPlus className="w-8 h-8 text-green-500" />
									{dashboardLoading ? (
										<Skeleton className="h-8 w-12 bg-muted" />
									) : (
										<span className="text-2xl font-bold text-green-500">
											{dashboardData?.newClientsToday || 0}
										</span>
									)}
								</div>
								<p className="text-sm font-medium text-foreground">
									New Registrations Today
								</p>
								<div className="flex items-center gap-1 mt-2 text-xs text-green-500 font-medium">
									View Users <ArrowRight className="w-3 h-3" />
								</div>
							</div>
						</Link>

						<Link href="/admin/unlisted/orders">
							<div
								className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4 hover:bg-blue-100 dark:hover:bg-blue-950/40 transition-colors cursor-pointer border border-blue-200 dark:border-blue-900"
								data-testid="link-pending-orders"
							>
								<div className="flex items-center justify-between mb-2">
									<Briefcase className="w-8 h-8 text-blue-500" />
									{ordersLoading ? (
										<Skeleton className="h-8 w-12 bg-muted" />
									) : (
										<span className="text-2xl font-bold text-blue-500">
											{pendingOrdersData?.total || 0}
										</span>
									)}
								</div>
								<p className="text-sm font-medium text-foreground">Pending Orders</p>
								<div className="flex items-center gap-1 mt-2 text-xs text-blue-500 font-medium">
									Manage Orders <ArrowRight className="w-3 h-3" />
								</div>
							</div>
						</Link>
					</div>
				</CardContent>
			</Card>

			{/* Charts Row */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* User Growth Chart */}
				<Card className="bg-card border-border">
					<CardHeader>
						<CardTitle className="text-foreground">
							User Growth (Last 7 Days)
						</CardTitle>
						<CardDescription className="text-muted-foreground">
							Daily new user registrations
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="h-[250px]">
							<ResponsiveContainer width="100%" height="100%">
								<AreaChart data={userGrowthData}>
									<defs>
										<linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
											<stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
											<stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
										</linearGradient>
									</defs>
									<CartesianGrid strokeDasharray="3 3" stroke="#374151" />
									<XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
									<YAxis stroke="#9ca3af" fontSize={12} />
									<Tooltip
										contentStyle={{
											backgroundColor: "#1f2937",
											border: "1px solid #374151",
											borderRadius: "8px",
										}}
										labelStyle={{ color: "#fff" }}
									/>
									<Area
										type="monotone"
										dataKey="users"
										stroke="#3b82f6"
										fillOpacity={1}
										fill="url(#colorUsers)"
									/>
								</AreaChart>
							</ResponsiveContainer>
						</div>
					</CardContent>
				</Card>

				{/* KYC Distribution */}
				<Card className="bg-card border-border">
					<CardHeader>
						<CardTitle className="text-foreground">
							KYC Tier Distribution
						</CardTitle>
						<CardDescription className="text-muted-foreground">
							Users by verification level
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="h-[250px] flex items-center">
							{kycLoading ? (
								<div className="flex-1 flex items-center justify-center">
									<Skeleton className="h-40 w-40 rounded-full bg-muted" />
								</div>
							) : kycDistribution.some((d) => d.value > 0) ? (
								<div className="flex items-center w-full">
									<div className="flex-1">
										<ResponsiveContainer width="100%" height={200}>
											<PieChart>
												<Pie
													data={kycDistribution}
													cx="50%"
													cy="50%"
													innerRadius={50}
													outerRadius={80}
													paddingAngle={5}
													dataKey="value"
												>
													{kycDistribution.map((entry, index) => (
														<Cell key={`cell-${index}`} fill={entry.color} />
													))}
												</Pie>
												<Tooltip
													contentStyle={{
														backgroundColor: "#1f2937",
														border: "1px solid #374151",
														borderRadius: "8px",
													}}
												/>
											</PieChart>
										</ResponsiveContainer>
									</div>
									<div className="flex-1 space-y-3">
										{kycDistribution.map((item, index) => (
											<div key={index} className="flex items-center gap-3">
												<div
													className="w-3 h-3 rounded-full"
													style={{ backgroundColor: item.color }}
												/>
												<div className="flex-1">
													<p className="text-sm text-muted-foreground">
														{item.name}
													</p>
													<p className="text-lg font-bold text-foreground">
														{item.value}
													</p>
												</div>
											</div>
										))}
									</div>
								</div>
							) : (
								<div className="flex-1 flex items-center justify-center text-muted-foreground">
									No KYC data available
								</div>
							)}
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Stakeholder Overview */}
			<Card className="bg-card border-border">
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="text-foreground">
								Stakeholder Overview
							</CardTitle>
							<CardDescription className="text-muted-foreground">
								Partners, agents, and suppliers status
							</CardDescription>
						</div>
						<Link href="/admin/stakeholders">
							<Button
								variant="outline"
								size="sm"
								className="border-border text-muted-foreground"
								data-testid="btn-view-stakeholders"
							>
								View All <ArrowRight className="w-4 h-4 ml-2" />
							</Button>
						</Link>
					</div>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
						<div className="bg-muted/50 rounded-lg p-4">
							<div className="flex items-center gap-3 mb-3">
								<div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
									<Building2 className="w-5 h-5 text-blue-400" />
								</div>
								<div>
									<p className="text-muted-foreground text-sm">Partners</p>
									{stakeholderLoading ? (
										<Skeleton className="h-6 w-16 bg-muted" />
									) : (
										<p className="text-xl font-bold text-foreground">
											{stakeholderStats?.totalPartners || 0}
										</p>
									)}
								</div>
							</div>
							<div className="flex items-center gap-2">
								<Badge
									variant="outline"
									className="bg-green-500/10 text-green-400 border-green-500/30"
								>
									<CheckCircle className="w-3 h-3 mr-1" />
									{stakeholderStats?.activePartners || 0} Active
								</Badge>
							</div>
						</div>

						<div className="bg-muted/50 rounded-lg p-4">
							<div className="flex items-center gap-3 mb-3">
								<div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
									<Users className="w-5 h-5 text-green-400" />
								</div>
								<div>
									<p className="text-muted-foreground text-sm">Agents</p>
									{stakeholderLoading ? (
										<Skeleton className="h-6 w-16 bg-muted" />
									) : (
										<p className="text-xl font-bold text-foreground">
											{stakeholderStats?.totalAgents || 0}
										</p>
									)}
								</div>
							</div>
							<div className="flex items-center gap-2">
								<Badge
									variant="outline"
									className="bg-green-500/10 text-green-400 border-green-500/30"
								>
									<CheckCircle className="w-3 h-3 mr-1" />
									{stakeholderStats?.activeAgents || 0} Active
								</Badge>
							</div>
						</div>

						<div className="bg-muted/50 rounded-lg p-4">
							<div className="flex items-center gap-3 mb-3">
								<div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
									<Briefcase className="w-5 h-5 text-purple-400" />
								</div>
								<div>
									<p className="text-muted-foreground text-sm">Suppliers</p>
									{stakeholderLoading ? (
										<Skeleton className="h-6 w-16 bg-muted" />
									) : (
										<p className="text-xl font-bold text-foreground">
											{stakeholderStats?.totalSuppliers || 0}
										</p>
									)}
								</div>
							</div>
							<div className="flex items-center gap-2">
								<Badge
									variant="outline"
									className="bg-green-500/10 text-green-400 border-green-500/30"
								>
									<CheckCircle className="w-3 h-3 mr-1" />
									{stakeholderStats?.activeSuppliers || 0} Active
								</Badge>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* System Status */}
			<Card className="bg-card border-border">
				<CardHeader>
					<CardTitle className="text-foreground flex items-center gap-2">
						<ShieldCheck className="w-5 h-5 text-green-400" />
						System Status
					</CardTitle>
					<CardDescription className="text-muted-foreground">
						All systems operational
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
						{[
							{
								name: "API Server",
								status: "operational",
								uptime: "99.99%",
								icon: Activity,
							},
							{
								name: "Database",
								status: "operational",
								uptime: "100%",
								icon: ShieldCheck,
							},
							{
								name: "Payment Gateway",
								status: "operational",
								uptime: "99.95%",
								icon: DollarSign,
							},
							{
								name: "Email Service",
								status: "operational",
								uptime: "99.98%",
								icon: TrendingUp,
							},
						].map((service) => (
							<div key={service.name} className="bg-muted/50 rounded-lg p-4">
								<div className="flex items-center justify-between mb-2">
									<service.icon className="w-5 h-5 text-muted-foreground" />
									<div className="flex items-center gap-2">
										<div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
										<span className="text-xs text-green-400 capitalize">
											{service.status}
										</span>
									</div>
								</div>
								<p className="font-medium text-foreground">{service.name}</p>
								<p className="text-sm text-muted-foreground">
									Uptime: {service.uptime}
								</p>
							</div>
						))}
					</div>
				</CardContent>
			</Card>

			{/* KYC Activity Today */}
			<Card className="bg-card border-border">
				<CardHeader>
					<CardTitle className="text-foreground">KYC Activity Today</CardTitle>
					<CardDescription className="text-muted-foreground">
						Approvals and rejections
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
						<div className="flex items-center gap-4">
							<div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
								<CheckCircle className="w-6 h-6 text-green-400" />
							</div>
							<div>
								<p className="text-muted-foreground text-sm">Approved Today</p>
								{kycLoading ? (
									<Skeleton className="h-8 w-16 bg-muted" />
								) : (
									<p className="text-2xl font-bold text-green-400">
										{kycStats?.approvedToday || 0}
									</p>
								)}
							</div>
						</div>

						<div className="flex items-center gap-4">
							<div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
								<XCircle className="w-6 h-6 text-red-400" />
							</div>
							<div>
								<p className="text-muted-foreground text-sm">Rejected Today</p>
								{kycLoading ? (
									<Skeleton className="h-8 w-16 bg-muted" />
								) : (
									<p className="text-2xl font-bold text-red-400">
										{kycStats?.rejectedToday || 0}
									</p>
								)}
							</div>
						</div>

						<div className="flex items-center gap-4">
							<div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center">
								<Clock className="w-6 h-6 text-orange-400" />
							</div>
							<div>
								<p className="text-muted-foreground text-sm">
									Pending Documents
								</p>
								{kycLoading ? (
									<Skeleton className="h-8 w-16 bg-muted" />
								) : (
									<p className="text-2xl font-bold text-orange-400">
										{kycStats?.pendingDocuments || 0}
									</p>
								)}
							</div>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
