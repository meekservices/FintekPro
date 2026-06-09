import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { LoadingState } from "@/components/LoadingState";
import { Link } from "wouter";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
	Building2,
	TrendingUp,
	ShoppingCart,
	Package,
	AlertTriangle,
	CheckCircle,
	XCircle,
	Clock,
	Activity,
	DollarSign,
	Users,
	Shield as LucideShield,
	FileText,
	ArrowRight,
	RefreshCw,
	BarChart3,
	AlertCircle,
	Info,
	Ban,
	Gavel,
	Zap,
} from "lucide-react";

interface HealthReport {
	staleValuations: Array<{
		companyId: string;
		companyName: string;
		lastValuationDate: string | null;
		daysSinceValuation: number | null;
		valuationStatus: string;
	}>;
	complianceFlagged: Array<{
		companyId: string;
		companyName: string;
		complianceStatus: string;
		blockReasons: unknown;
	}>;
	enrichmentFailures: Array<{
		companyId: string;
		companyName: string;
		enrichmentFailedAt: string;
	}>;
	summary: {
		totalStale: number;
		totalComplianceFlagged: number;
		totalEnrichmentFailed: number;
		reportGeneratedAt: string;
	};
}

interface DashboardMetrics {
	totalCompanies: number;
	activeCompanies: number;
	suspendedCompanies: number;
	companiesNeedingPricing: number;
	companiesWithDraftPrices: number;
	highRiskCompanies: number;
	activeSellListings: number;
	activeBuyRequests: number;
	pendingDeals: number;
	completedDealsLast7Days: number;
	tradingVolumeLast7Days: number;
}

interface ComplianceAlert {
	id: string;
	type: "error" | "warning" | "info";
	title: string;
	description: string;
	companyId?: string;
	companyName?: string;
	createdAt: string;
}

interface DashboardData {
	metrics: DashboardMetrics;
	complianceAlerts: ComplianceAlert[];
	recentActivity: {
		newListingsToday: number;
		newBuyRequestsToday: number;
	};
}

const formatCurrency = (value: number): string => {
	if (value >= 10000000) {
		return `₹${(value / 10000000).toFixed(2)} Cr`;
	}
	if (value >= 100000) {
		return `₹${(value / 100000).toFixed(2)} L`;
	}
	return `₹${value.toLocaleString("en-IN")}`;
};

const MetricCard = ({
	title,
	value,
	description,
	icon: Icon,
	trend,
	link,
	variant = "default",
}: {
	title: string;
	value: number | string;
	description?: string;
	icon: any;
	trend?: "up" | "down" | "neutral";
	link?: string;
	variant?: "default" | "success" | "warning" | "error";
}) => {
	const variantStyles = {
		default: "border-border bg-muted/50",
		success: "border-green-700 bg-green-900/20",
		warning: "border-yellow-700 bg-yellow-900/20",
		error: "border-red-700 bg-red-900/20",
	};

	const iconColors = {
		default: "text-blue-400",
		success: "text-green-400",
		warning: "text-yellow-400",
		error: "text-red-400",
	};

	const content = (
		<Card
			className={`${variantStyles[variant]} hover:bg-muted/70 transition-colors cursor-pointer`}
			data-testid={`metric-card-${title.toLowerCase().replace(/\s+/g, "-")}`}
		>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle className="text-sm font-medium text-muted-foreground">
					{title}
				</CardTitle>
				<Icon className={`h-5 w-5 ${iconColors[variant]}`} />
			</CardHeader>
			<CardContent>
				<div className="text-2xl font-bold text-foreground">{value}</div>
				{description && (
					<p className="text-xs text-muted-foreground mt-1">{description}</p>
				)}
				{trend && (
					<div
						className={`text-xs mt-1 ${trend === "up" ? "text-green-400" : trend === "down" ? "text-red-400" : "text-muted-foreground"}`}
					>
						{trend === "up" ? "↑" : trend === "down" ? "↓" : "→"} vs last week
					</div>
				)}
			</CardContent>
		</Card>
	);

	if (link) {
		return <Link href={link}>{content}</Link>;
	}

	return content;
};

const AlertItem = ({ alert }: { alert: ComplianceAlert }) => {
	const icons = {
		error: <XCircle className="h-5 w-5 text-red-500" />,
		warning: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
		info: <Info className="h-5 w-5 text-blue-500" />,
	};

	const bgColors = {
		error: "bg-red-900/20 border-red-800",
		warning: "bg-yellow-900/20 border-yellow-800",
		info: "bg-blue-900/20 border-blue-800",
	};

	return (
		<div
			className={`flex items-start gap-3 p-3 rounded-lg border ${bgColors[alert.type]}`}
			data-testid={`alert-${alert.id}`}
		>
			{icons[alert.type]}
			<div className="flex-1">
				<p className="text-sm font-medium text-foreground">{alert.title}</p>
				<p className="text-xs text-muted-foreground mt-0.5">
					{alert.description}
				</p>
			</div>
			{alert.companyId && (
				<Link href={`/admin/unlisted/preview/${alert.companyId}`}>
					<Button
						variant="ghost"
						size="sm"
						className="text-xs"
						data-testid={`button-view-${alert.id}`}
					>
						View
					</Button>
				</Link>
			)}
		</div>
	);
};

export default function UnlistedDashboard() {
	const { user, isLoading: authLoading } = useAuth();
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const {
		data: responseData,
		isLoading,
		error,
		refetch,
	} = useQuery<{ success: boolean; data: DashboardData }>({
		queryKey: ["/api/unlisted/admin/dashboard-metrics"],
		refetchInterval: 60000,
	});

	const {
		data: healthData,
		isLoading: healthLoading,
		refetch: refetchHealth,
	} = useQuery<{ success: boolean; data: HealthReport }>({
		queryKey: ["/api/unlisted/admin/health"],
		refetchInterval: 300000,
	});

	const stalenessMutation = useMutation({
		mutationFn: () =>
			apiRequest("POST", "/api/unlisted/admin/valuation/check-stale"),
		onSuccess: (data: any) => {
			toast({
				title: "Staleness sweep complete",
				description: data?.message || "Valuation statuses updated.",
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/unlisted/admin/health"],
			});
		},
		onError: () =>
			toast({
				title: "Sweep failed",
				description: "Could not run staleness check.",
				variant: "destructive",
			}),
	});

	if (authLoading) {
		return <LoadingState />;
	}

	if (!user || !user.roles?.includes("admin")) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-background">
				<Card className="bg-card border-border max-w-md">
					<CardHeader>
						<CardTitle className="text-foreground text-center">
							Access Denied
						</CardTitle>
						<CardDescription className="text-muted-foreground text-center">
							Admin privileges required to access this page.
						</CardDescription>
					</CardHeader>
				</Card>
			</div>
		);
	}

	if (isLoading) {
		return <LoadingState />;
	}

	const data = responseData?.data;

	if (error || !data) {
		return (
			<div className="p-6">
				<Alert variant="destructive">
					<AlertTriangle className="h-4 w-4" />
					<AlertTitle>Error</AlertTitle>
					<AlertDescription>Failed to load dashboard metrics</AlertDescription>
				</Alert>
			</div>
		);
	}

	const { metrics, complianceAlerts, recentActivity } = data;

	return (
		<div className="space-y-6 p-6">
			<div className="flex justify-between items-center">
				<div>
					<h1 className="text-3xl font-bold text-foreground">
						Unlisted Marketplace Dashboard
					</h1>
					<p className="text-muted-foreground mt-1">
						Overview of marketplace activity and compliance status
					</p>
				</div>
				<Button
					variant="outline"
					onClick={() => refetch()}
					className="border-border"
					data-testid="button-refresh-dashboard"
				>
					<RefreshCw className="h-4 w-4 mr-2" />
					Refresh
				</Button>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<MetricCard
					title="Total Companies"
					value={metrics.totalCompanies}
					description={`${metrics.activeCompanies} active`}
					icon={Building2}
					link="/admin/unlisted/companies"
				/>
				<MetricCard
					title="Active Sell Listings"
					value={metrics.activeSellListings}
					description={`+${recentActivity.newListingsToday} today`}
					icon={Package}
					link="/admin/unlisted/orders"
					variant="success"
				/>
				<MetricCard
					title="Active Buy Requests"
					value={metrics.activeBuyRequests}
					description={`+${recentActivity.newBuyRequestsToday} today`}
					icon={ShoppingCart}
					link="/admin/unlisted/orders"
					variant="success"
				/>
				<MetricCard
					title="Trading Volume (7d)"
					value={formatCurrency(metrics.tradingVolumeLast7Days)}
					description={`${metrics.completedDealsLast7Days} deals completed`}
					icon={TrendingUp}
				/>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<MetricCard
					title="Pending Deals"
					value={metrics.pendingDeals}
					description="Awaiting settlement"
					icon={Clock}
					variant={metrics.pendingDeals > 10 ? "warning" : "default"}
				/>
				<MetricCard
					title="Needs Pricing"
					value={metrics.companiesNeedingPricing}
					description="Companies without prices"
					icon={DollarSign}
					link="/admin/unlisted/companies"
					variant={metrics.companiesNeedingPricing > 5 ? "warning" : "default"}
				/>
				<MetricCard
					title="Draft Prices"
					value={metrics.companiesWithDraftPrices}
					description="Pending review/publish"
					icon={FileText}
					link="/admin/unlisted/companies"
				/>
				<MetricCard
					title="High Risk"
					value={metrics.highRiskCompanies}
					description="Blocked or flagged"
					icon={LucideShield}
					variant={metrics.highRiskCompanies > 0 ? "error" : "default"}
				/>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<Card className="lg:col-span-2 bg-card border-border">
					<CardHeader>
						<div className="flex items-center justify-between">
							<div>
								<CardTitle className="text-foreground">
									Compliance Alerts
								</CardTitle>
								<CardDescription>Issues requiring attention</CardDescription>
							</div>
							<Badge
								variant={
									complianceAlerts.length > 0 ? "destructive" : "secondary"
								}
							>
								{complianceAlerts.length} alerts
							</Badge>
						</div>
					</CardHeader>
					<CardContent>
						{complianceAlerts.length === 0 ? (
							<div className="flex flex-col items-center justify-center py-8 text-center">
								<CheckCircle className="h-12 w-12 text-green-500 mb-3" />
								<p className="text-foreground font-medium">All Clear</p>
								<p className="text-muted-foreground text-sm">
									No compliance issues detected
								</p>
							</div>
						) : (
							<div className="space-y-3">
								{complianceAlerts.map((alert) => (
									<AlertItem key={alert.id} alert={alert} />
								))}
							</div>
						)}
					</CardContent>
				</Card>

				<Card className="bg-card border-border">
					<CardHeader>
						<CardTitle className="text-foreground">Quick Actions</CardTitle>
						<CardDescription>Common admin tasks</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						<Link href="/admin/unlisted/companies">
							<Button
								variant="outline"
								className="w-full justify-between border-border"
								data-testid="button-manage-companies"
							>
								<span className="flex items-center gap-2">
									<Building2 className="h-4 w-4" />
									Manage Companies
								</span>
								<ArrowRight className="h-4 w-4" />
							</Button>
						</Link>
						<Link href="/admin/unlisted/orders">
							<Button
								variant="outline"
								className="w-full justify-between border-border"
								data-testid="button-manage-orders"
							>
								<span className="flex items-center gap-2">
									<Package className="h-4 w-4" />
									Order Management
								</span>
								<ArrowRight className="h-4 w-4" />
							</Button>
						</Link>
						<Link href="/admin/unlisted/negotiations">
							<Button
								variant="outline"
								className="w-full justify-between border-border"
								data-testid="button-negotiations"
							>
								<span className="flex items-center gap-2">
									<Activity className="h-4 w-4" />
									Negotiations
								</span>
								<ArrowRight className="h-4 w-4" />
							</Button>
						</Link>
						<Link href="/admin/unlisted/audit-log">
							<Button
								variant="outline"
								className="w-full justify-between border-border"
								data-testid="button-audit-log"
							>
								<span className="flex items-center gap-2">
									<FileText className="h-4 w-4" />
									Audit Log
								</span>
								<ArrowRight className="h-4 w-4" />
							</Button>
						</Link>
						<Separator className="my-2 bg-muted" />
						<Link href="/admin/unlisted/seed">
							<Button
								variant="outline"
								className="w-full justify-between border-border text-green-400 hover:text-green-300"
								data-testid="button-seed-data"
							>
								<span className="flex items-center gap-2">
									<BarChart3 className="h-4 w-4" />
									Seed Test Data
								</span>
								<ArrowRight className="h-4 w-4" />
							</Button>
						</Link>
					</CardContent>
				</Card>
			</div>

			<Card className="bg-card border-border">
				<CardHeader>
					<CardTitle className="text-foreground">Trading Status</CardTitle>
					<CardDescription>Current marketplace state</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
						<div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
							<div className="p-2 rounded-full bg-green-900/50">
								<CheckCircle className="h-5 w-5 text-green-400" />
							</div>
							<div>
								<p className="text-sm font-medium text-foreground">
									{metrics.activeCompanies}
								</p>
								<p className="text-xs text-muted-foreground">Active Trading</p>
							</div>
						</div>
						<div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
							<div className="p-2 rounded-full bg-yellow-900/50">
								<Clock className="h-5 w-5 text-yellow-400" />
							</div>
							<div>
								<p className="text-sm font-medium text-foreground">
									{metrics.companiesWithDraftPrices}
								</p>
								<p className="text-xs text-muted-foreground">Pending Review</p>
							</div>
						</div>
						<div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
							<div className="p-2 rounded-full bg-orange-900/50">
								<Ban className="h-5 w-5 text-orange-400" />
							</div>
							<div>
								<p className="text-sm font-medium text-foreground">
									{metrics.suspendedCompanies}
								</p>
								<p className="text-xs text-muted-foreground">Suspended</p>
							</div>
						</div>
						<div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
							<div className="p-2 rounded-full bg-red-900/50">
								<XCircle className="h-5 w-5 text-red-400" />
							</div>
							<div>
								<p className="text-sm font-medium text-foreground">
									{metrics.highRiskCompanies}
								</p>
								<p className="text-xs text-muted-foreground">Blocked</p>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* ── Institutional Governance Health ── */}
			<Card className="bg-card border-border">
				<CardHeader className="pb-3">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<Gavel className="h-5 w-5 text-primary" />
							<CardTitle className="text-foreground text-lg">
								Institutional Governance Health
							</CardTitle>
						</div>
						<div className="flex gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={() => refetchHealth()}
								disabled={healthLoading}
							>
								<RefreshCw
									className={`h-3.5 w-3.5 mr-1 ${healthLoading ? "animate-spin" : ""}`}
								/>
								Refresh
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => stalenessMutation.mutate()}
								disabled={stalenessMutation.isPending}
							>
								<Zap className="h-3.5 w-3.5 mr-1" />
								{stalenessMutation.isPending
									? "Running…"
									: "Run Staleness Sweep"}
							</Button>
						</div>
					</div>
					<CardDescription className="text-muted-foreground">
						Valuation governance, compliance flags, and enrichment status
						{healthData?.data?.summary?.reportGeneratedAt && (
							<span className="ml-2 text-xs">
								· Last checked{" "}
								{format(
									new Date(healthData.data.summary.reportGeneratedAt),
									"dd MMM yyyy HH:mm",
								)}
							</span>
						)}
					</CardDescription>
				</CardHeader>
				<CardContent>
					{healthLoading ? (
						<div className="flex items-center justify-center py-8">
							<RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
							<span className="ml-2 text-sm text-muted-foreground">
								Loading health report…
							</span>
						</div>
					) : healthData?.data ? (
						<div className="space-y-4">
							{/* Summary Badges */}
							<div className="flex flex-wrap gap-3">
								<div
									className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${healthData.data.summary.totalStale > 0 ? "bg-red-950/30 border-red-800" : "bg-green-950/30 border-green-800"}`}
								>
									<Clock
										className={`h-4 w-4 ${healthData.data.summary.totalStale > 0 ? "text-red-400" : "text-green-400"}`}
									/>
									<span className="text-sm font-medium text-foreground">
										{healthData.data.summary.totalStale}
									</span>
									<span className="text-xs text-muted-foreground">
										Stale Valuations
									</span>
								</div>
								<div
									className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${healthData.data.summary.totalComplianceFlagged > 0 ? "bg-yellow-950/30 border-yellow-800" : "bg-green-950/30 border-green-800"}`}
								>
									<LucideShield
										className={`h-4 w-4 ${healthData.data.summary.totalComplianceFlagged > 0 ? "text-yellow-400" : "text-green-400"}`}
									/>
									<span className="text-sm font-medium text-foreground">
										{healthData.data.summary.totalComplianceFlagged}
									</span>
									<span className="text-xs text-muted-foreground">
										Compliance Flagged
									</span>
								</div>
								<div
									className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${healthData.data.summary.totalEnrichmentFailed > 0 ? "bg-orange-950/30 border-orange-800" : "bg-green-950/30 border-green-800"}`}
								>
									<AlertCircle
										className={`h-4 w-4 ${healthData.data.summary.totalEnrichmentFailed > 0 ? "text-orange-400" : "text-green-400"}`}
									/>
									<span className="text-sm font-medium text-foreground">
										{healthData.data.summary.totalEnrichmentFailed}
									</span>
									<span className="text-xs text-muted-foreground">
										Enrichment Failures
									</span>
								</div>
							</div>

							{/* Stale Valuations List */}
							{healthData.data.staleValuations.length > 0 && (
								<div>
									<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
										Stale / Unvalued Instruments
									</p>
									<div className="space-y-1 max-h-48 overflow-y-auto">
										{healthData.data.staleValuations
											.slice(0, 10)
											.map((item) => (
												<div
													key={item.companyId}
													className="flex items-center justify-between p-2 rounded bg-muted/40 text-sm"
												>
													<span className="font-medium text-foreground truncate max-w-[50%]">
														{item.companyName}
													</span>
													<div className="flex items-center gap-2">
														{item.daysSinceValuation !== null ? (
															<span className="text-xs text-muted-foreground">
																{item.daysSinceValuation}d ago
															</span>
														) : (
															<span className="text-xs text-muted-foreground">
																Never valued
															</span>
														)}
														<Badge variant="destructive" className="text-xs">
															{item.valuationStatus}
														</Badge>
													</div>
												</div>
											))}
										{healthData.data.staleValuations.length > 10 && (
											<p className="text-xs text-muted-foreground text-center pt-1">
												+{healthData.data.staleValuations.length - 10} more
											</p>
										)}
									</div>
								</div>
							)}

							{/* Enrichment Failures */}
							{healthData.data.enrichmentFailures.length > 0 && (
								<div>
									<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
										Enrichment Failures
									</p>
									<div className="space-y-1 max-h-32 overflow-y-auto">
										{healthData.data.enrichmentFailures
											.slice(0, 8)
											.map((item) => (
												<div
													key={item.companyId}
													className="flex items-center justify-between p-2 rounded bg-muted/40 text-sm"
												>
													<span className="font-medium text-foreground truncate max-w-[60%]">
														{item.companyName}
													</span>
													<span className="text-xs text-orange-400">
														{format(
															new Date(item.enrichmentFailedAt),
															"dd MMM HH:mm",
														)}
													</span>
												</div>
											))}
									</div>
								</div>
							)}

							{healthData.data.summary.totalStale === 0 &&
								healthData.data.summary.totalComplianceFlagged === 0 &&
								healthData.data.summary.totalEnrichmentFailed === 0 && (
									<div className="flex items-center gap-2 text-sm text-green-400 py-2">
										<CheckCircle className="h-4 w-4" />
										All instruments are current — no governance issues detected.
									</div>
								)}
						</div>
					) : (
						<p className="text-sm text-muted-foreground">
							Health data unavailable. Refresh to retry.
						</p>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
