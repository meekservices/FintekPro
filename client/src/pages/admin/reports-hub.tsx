import { useState } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import type { LucideIcon } from "lucide-react";
import {
	FileText,
	Download,
	Calendar,
	TrendingUp,
	PieChart,
	BarChart3,
	Search,
	RefreshCw,
	Clock,
	CheckCircle,
	Loader2,
	Shield as LucideShield,
	Users,
	IndianRupee,
	Activity,
	AlertTriangle,
	Server,
	Cpu,
	FileWarning,
	UserCheck,
	Briefcase,
	Target,
	LineChart,
	Wallet,
	FileCheck,
	ScrollText,
	History,
	Gauge,
} from "lucide-react";

interface PlatformReport {
	id: string;
	name: string;
	description: string;
	category: "business" | "compliance" | "revenue" | "operations";
	icon: LucideIcon;
	lastGenerated: string;
	status: "ready" | "generating" | "scheduled" | "failed";
	size?: string;
	frequency: string;
}

const PLATFORM_REPORTS: PlatformReport[] = [
	{
		id: "aum_report",
		name: "AUM Report",
		description:
			"Total assets under management across all clients and products",
		category: "business",
		icon: Wallet,
		lastGenerated: "2024-12-22",
		status: "ready",
		size: "4.2 MB",
		frequency: "Daily",
	},
	{
		id: "client_acquisition",
		name: "Client Acquisition",
		description: "New client onboarding trends and conversion metrics",
		category: "business",
		icon: Users,
		lastGenerated: "2024-12-22",
		status: "ready",
		size: "2.8 MB",
		frequency: "Weekly",
	},
	{
		id: "agent_performance_summary",
		name: "Agent Performance Summary",
		description: "Aggregated performance metrics for all agents",
		category: "business",
		icon: Target,
		lastGenerated: "2024-12-21",
		status: "ready",
		size: "5.1 MB",
		frequency: "Weekly",
	},
	{
		id: "market_analysis",
		name: "Market Analysis",
		description: "Market trends, sector performance, and investment insights",
		category: "business",
		icon: LineChart,
		lastGenerated: "2024-12-22",
		status: "generating",
		frequency: "Daily",
	},
	{
		id: "kyc_compliance_status",
		name: "KYC Compliance Status",
		description: "Platform-wide KYC verification and compliance rates",
		category: "compliance",
		icon: UserCheck,
		lastGenerated: "2024-12-22",
		status: "ready",
		size: "3.5 MB",
		frequency: "Daily",
	},
	{
		id: "regulatory_filings",
		name: "Regulatory Filings",
		description: "SEBI, RBI and other regulatory filing status and deadlines",
		category: "compliance",
		icon: FileCheck,
		lastGenerated: "2024-12-20",
		status: "ready",
		size: "1.9 MB",
		frequency: "Monthly",
	},
	{
		id: "audit_trail",
		name: "Audit Trail",
		description: "Complete audit log of all platform activities and changes",
		category: "compliance",
		icon: ScrollText,
		lastGenerated: "2024-12-22",
		status: "ready",
		size: "12.4 MB",
		frequency: "Daily",
	},
	{
		id: "risk_assessment",
		name: "Risk Assessment",
		description: "Platform risk exposure and client risk profile distribution",
		category: "compliance",
		icon: AlertTriangle,
		lastGenerated: "2024-12-21",
		status: "scheduled",
		frequency: "Weekly",
	},
	{
		id: "commission_summary",
		name: "Commission Summary",
		description: "Total commissions earned across all products and agents",
		category: "revenue",
		icon: IndianRupee,
		lastGenerated: "2024-12-22",
		status: "ready",
		size: "2.1 MB",
		frequency: "Daily",
	},
	{
		id: "revenue_trends",
		name: "Revenue Trends",
		description: "Historical revenue analysis with growth projections",
		category: "revenue",
		icon: TrendingUp,
		lastGenerated: "2024-12-21",
		status: "ready",
		size: "3.8 MB",
		frequency: "Weekly",
	},
	{
		id: "payout_history",
		name: "Payout History",
		description: "Agent and partner payout records and pending settlements",
		category: "revenue",
		icon: History,
		lastGenerated: "2024-12-20",
		status: "ready",
		size: "4.5 MB",
		frequency: "Weekly",
	},
	{
		id: "revenue_by_product",
		name: "Revenue by Product",
		description: "Revenue breakdown by mutual funds, bonds, PMS, AIF, etc.",
		category: "revenue",
		icon: PieChart,
		lastGenerated: "2024-12-22",
		status: "ready",
		size: "2.6 MB",
		frequency: "Daily",
	},
	{
		id: "system_health",
		name: "System Health",
		description: "Platform uptime, response times, and infrastructure metrics",
		category: "operations",
		icon: Server,
		lastGenerated: "2024-12-22",
		status: "ready",
		size: "1.2 MB",
		frequency: "Hourly",
	},
	{
		id: "api_usage",
		name: "API Usage",
		description: "Third-party API calls, rate limits, and integration health",
		category: "operations",
		icon: Cpu,
		lastGenerated: "2024-12-22",
		status: "ready",
		size: "2.9 MB",
		frequency: "Daily",
	},
	{
		id: "error_logs",
		name: "Error Logs",
		description: "Application errors, exceptions, and failure analysis",
		category: "operations",
		icon: FileWarning,
		lastGenerated: "2024-12-22",
		status: "ready",
		size: "5.7 MB",
		frequency: "Hourly",
	},
	{
		id: "user_activity",
		name: "User Activity",
		description: "Active users, session analytics, and feature usage metrics",
		category: "operations",
		icon: Activity,
		lastGenerated: "2024-12-22",
		status: "generating",
		frequency: "Daily",
	},
];

export default function AdminReportsHub() {
	const { toast } = useToast();
	const [activeTab, setActiveTab] = useState("business");
	const [searchQuery, setSearchQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [dateRange, setDateRange] = useState<string>("last_7_days");
	const [isRefreshing, setIsRefreshing] = useState(false);

	const filteredReports = PLATFORM_REPORTS.filter((report) => {
		const matchesSearch =
			report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			report.description.toLowerCase().includes(searchQuery.toLowerCase());
		const matchesCategory = report.category === activeTab;
		const matchesStatus =
			statusFilter === "all" || report.status === statusFilter;
		return matchesSearch && matchesCategory && matchesStatus;
	});

	const formatDate = (dateStr: string) =>
		new Date(dateStr).toLocaleDateString("en-IN", {
			day: "numeric",
			month: "short",
			year: "numeric",
		});

	const handleDownloadReport = (report: PlatformReport) => {
		if (report.status !== "ready") {
			toast({
				title: "Report Not Available",
				description: `${report.name} is currently ${report.status}`,
				variant: "destructive",
			});
			return;
		}
		toast({
			title: "Downloading Report",
			description: `${report.name} (${report.size})`,
		});
	};

	const handleRefreshAll = () => {
		setIsRefreshing(true);
		setTimeout(() => {
			setIsRefreshing(false);
			toast({
				title: "Reports Refreshed",
				description: "All report data has been updated",
			});
		}, 2000);
	};

	const getCategoryColor = (category: string) => {
		switch (category) {
			case "business":
				return "bg-blue-500/20 text-blue-400";
			case "compliance":
				return "bg-emerald-500/20 text-emerald-400";
			case "revenue":
				return "bg-amber-500/20 text-amber-400";
			case "operations":
				return "bg-purple-500/20 text-purple-400";
			default:
				return "bg-muted/20 text-muted-foreground";
		}
	};

	const getStatusConfig = (status: string) => {
		switch (status) {
			case "ready":
				return {
					color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
					label: "Ready",
					icon: CheckCircle,
				};
			case "generating":
				return {
					color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
					label: "Generating",
					icon: Loader2,
				};
			case "scheduled":
				return {
					color: "bg-amber-500/20 text-amber-400 border-amber-500/30",
					label: "Scheduled",
					icon: Clock,
				};
			case "failed":
				return {
					color: "bg-red-500/20 text-red-400 border-red-500/30",
					label: "Failed",
					icon: AlertTriangle,
				};
			default:
				return {
					color: "bg-muted/20 text-muted-foreground border-border/30",
					label: status,
					icon: FileText,
				};
		}
	};

	const getCategoryStats = (category: string) => {
		const categoryReports = PLATFORM_REPORTS.filter(
			(r) => r.category === category,
		);
		const ready = categoryReports.filter((r) => r.status === "ready").length;
		return { total: categoryReports.length, ready };
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
				<div>
					<h1
						className="text-2xl font-bold text-foreground flex items-center gap-2"
						data-testid="text-page-title"
					>
						<BarChart3 className="h-7 w-7 text-blue-500" />
						Platform Reports
					</h1>
					<p className="text-muted-foreground mt-1">
						Aggregated platform analytics and compliance reports
					</p>
				</div>
				<div className="flex items-center gap-3">
					<div className="relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search reports..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-10 w-64 bg-card border-border text-foreground"
							data-testid="input-search-reports"
						/>
					</div>
					<Button
						variant="outline"
						className="border-border text-muted-foreground hover:bg-card"
						onClick={handleRefreshAll}
						disabled={isRefreshing}
						data-testid="button-refresh-reports"
					>
						<RefreshCw
							className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
						/>
						Refresh
					</Button>
				</div>
			</div>

			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				{(["business", "compliance", "revenue", "operations"] as const).map(
					(category) => {
						const stats = getCategoryStats(category);
						const categoryIcons = {
							business: Briefcase,
							compliance: LucideShield,
							revenue: IndianRupee,
							operations: Gauge,
						};
						const Icon = categoryIcons[category];
						return (
							<Card
								key={category}
								className="bg-card/50 border-border"
								data-testid={`stat-${category}`}
							>
								<CardContent className="p-4">
									<div className="flex justify-between items-start">
										<div>
											<p className="text-muted-foreground text-sm capitalize">
												{category}
											</p>
											<p className="text-2xl font-bold text-foreground">
												{stats.ready}/{stats.total}
											</p>
											<p className="text-xs text-muted-foreground">
												Reports Ready
											</p>
										</div>
										<div
											className={`p-2 rounded-lg ${getCategoryColor(category)}`}
										>
											<Icon className="h-5 w-5" />
										</div>
									</div>
								</CardContent>
							</Card>
						);
					},
				)}
			</div>

			<div className="flex flex-col md:flex-row gap-4">
				<Select value={dateRange} onValueChange={setDateRange}>
					<SelectTrigger
						className="w-48 bg-card border-border"
						data-testid="select-date-range"
					>
						<Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
						<SelectValue placeholder="Date Range" />
					</SelectTrigger>
					<SelectContent className="bg-card border-border">
						<SelectItem value="today">Today</SelectItem>
						<SelectItem value="last_7_days">Last 7 Days</SelectItem>
						<SelectItem value="last_30_days">Last 30 Days</SelectItem>
						<SelectItem value="last_quarter">Last Quarter</SelectItem>
						<SelectItem value="ytd">Year to Date</SelectItem>
						<SelectItem value="all_time">All Time</SelectItem>
					</SelectContent>
				</Select>
				<Select value={statusFilter} onValueChange={setStatusFilter}>
					<SelectTrigger
						className="w-48 bg-card border-border"
						data-testid="select-status-filter"
					>
						<SelectValue placeholder="Filter by Status" />
					</SelectTrigger>
					<SelectContent className="bg-card border-border">
						<SelectItem value="all">All Status</SelectItem>
						<SelectItem value="ready">Ready</SelectItem>
						<SelectItem value="generating">Generating</SelectItem>
						<SelectItem value="scheduled">Scheduled</SelectItem>
						<SelectItem value="failed">Failed</SelectItem>
					</SelectContent>
				</Select>
			</div>

			<Tabs
				value={activeTab}
				onValueChange={setActiveTab}
				className="space-y-4"
			>
				<TabsList className="bg-card border-border">
					<TabsTrigger
						value="business"
						className="data-[state=active]:bg-blue-600"
						data-testid="tab-business"
					>
						<Briefcase className="h-4 w-4 mr-2" />
						Business Analytics
					</TabsTrigger>
					<TabsTrigger
						value="compliance"
						className="data-[state=active]:bg-emerald-600"
						data-testid="tab-compliance"
					>
						<LucideShield className="h-4 w-4 mr-2" />
						Compliance
					</TabsTrigger>
					<TabsTrigger
						value="revenue"
						className="data-[state=active]:bg-amber-600"
						data-testid="tab-revenue"
					>
						<IndianRupee className="h-4 w-4 mr-2" />
						Revenue
					</TabsTrigger>
					<TabsTrigger
						value="operations"
						className="data-[state=active]:bg-purple-600"
						data-testid="tab-operations"
					>
						<Activity className="h-4 w-4 mr-2" />
						Operations
					</TabsTrigger>
				</TabsList>

				{(["business", "compliance", "revenue", "operations"] as const).map(
					(category) => (
						<TabsContent key={category} value={category} className="space-y-4">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								{filteredReports.map((report) => {
									const Icon = report.icon;
									const statusConfig = getStatusConfig(report.status);
									const StatusIcon = statusConfig.icon;
									return (
										<Card
											key={report.id}
											className="bg-card/50 border-border hover:border-border transition-colors"
											data-testid={`report-card-${report.id}`}
										>
											<CardHeader className="pb-2">
												<div className="flex items-start justify-between">
													<div
														className={`p-3 rounded-lg ${getCategoryColor(report.category)}`}
													>
														<Icon className="h-6 w-6" />
													</div>
													<Badge className={statusConfig.color}>
														<StatusIcon
															className={`h-3 w-3 mr-1 ${report.status === "generating" ? "animate-spin" : ""}`}
														/>
														{statusConfig.label}
													</Badge>
												</div>
												<CardTitle className="text-foreground text-lg mt-3">
													{report.name}
												</CardTitle>
												<CardDescription className="text-muted-foreground">
													{report.description}
												</CardDescription>
											</CardHeader>
											<CardContent>
												<div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
													<div className="flex items-center gap-4">
														<span className="flex items-center gap-1">
															<Clock className="h-3 w-3" />
															{formatDate(report.lastGenerated)}
														</span>
														<span className="flex items-center gap-1">
															<RefreshCw className="h-3 w-3" />
															{report.frequency}
														</span>
													</div>
													{report.size && (
														<span className="text-muted-foreground">
															{report.size}
														</span>
													)}
												</div>
												<Button
													className={`w-full ${report.status === "ready" ? "bg-blue-600 hover:bg-blue-700" : "bg-muted cursor-not-allowed"}`}
													onClick={() => handleDownloadReport(report)}
													disabled={report.status !== "ready"}
													data-testid={`button-download-${report.id}`}
												>
													<Download className="h-4 w-4 mr-2" />
													{report.status === "ready"
														? "Download Report"
														: report.status === "generating"
															? "Generating..."
															: report.status === "scheduled"
																? "Scheduled"
																: "Unavailable"}
												</Button>
											</CardContent>
										</Card>
									);
								})}
							</div>
							{filteredReports.length === 0 && (
								<div className="text-center py-12 text-muted-foreground">
									<FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
									<p>No reports found matching your criteria</p>
								</div>
							)}
						</TabsContent>
					),
				)}
			</Tabs>
		</div>
	);
}
