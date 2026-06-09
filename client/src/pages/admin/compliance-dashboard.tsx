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
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Shield as LucideShield,
	Calendar,
	AlertTriangle,
	CheckCircle,
	Clock,
	FileText,
	Scale,
	Building2,
	RefreshCw,
	Bell,
	ExternalLink,
	Download,
	Target,
	TrendingUp,
	CircleDot,
	MessageSquare,
	Users,
	Timer,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
	format,
	formatDistanceToNow,
	addDays,
	isPast,
	isWithinInterval,
} from "date-fns";
import { ForensicAuditTrail } from "@/components/regulatory/ForensicAuditTrail";
import { useLocation } from "wouter";

interface ComplianceDeadline {
	id: string;
	title: string;
	regulator: "SEBI" | "RBI" | "IRDAI" | "MCA" | "ITD";
	dueDate: string;
	status: "completed" | "pending" | "overdue" | "upcoming";
	priority: "high" | "medium" | "low";
	description: string;
	documentLink?: string;
}

interface ComplianceStatus {
	category: string;
	totalRequirements: number;
	compliant: number;
	nonCompliant: number;
	percentage: number;
}

interface RegulatoryGap {
	id: string;
	title: string;
	description: string;
	regulator: "SEBI" | "RBI" | "IRDAI" | "MCA" | "ITD";
	riskLevel: "high" | "medium" | "low";
	status: "not_started" | "in_progress" | "completed" | "deferred";
	category: string;
	estimatedEffort: "low" | "medium" | "high";
	regulatoryReference?: string;
	targetCompletionDate?: string;
	actualCompletionDate?: string;
}

interface GrievanceMetrics {
	total: number;
	byStatus: Record<string, number>;
	byCategory: Record<string, number>;
	byPriority: Record<string, number>;
	avgResolutionDays: number;
	slaBreaches: number;
	escalated: number;
	resolvedThisMonth: number;
	pendingOverdue: number;
}

interface ComplianceDashboardData {
	overallScore: number;
	forensicStatus?: {
		status: "passed" | "failed" | "warning";
		lastCheckedAt: string;
		totalVerified: number;
		issuesFound: number;
	};
	deadlines: ComplianceDeadline[];
	statusByCategory: ComplianceStatus[];
	recentUpdates: { title: string; date: string; regulator: string }[];
	alerts: { id: string; severity: string; message: string; date: string }[];
	regulatoryGaps: RegulatoryGap[];
}

const regulatorColors: Record<string, string> = {
	SEBI: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
	RBI: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
	IRDAI:
		"bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
	MCA: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
	ITD: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

export default function ComplianceDashboard() {
	const { data, isLoading, refetch, isFetching } =
		useQuery<ComplianceDashboardData>({
			queryKey: ["/api/admin/compliance-dashboard"],
		});

	const [location] = useLocation();
	const searchParams = new URLSearchParams(window.location.search);
	const defaultTab = searchParams.get("alertId") ? "forensic" : "deadlines";

	const { data: grievanceData } = useQuery<{
		success: boolean;
		data: GrievanceMetrics;
	}>({
		queryKey: ["/api/admin/grievances/metrics"],
	});

	const grievanceMetrics = grievanceData?.data;

	if (isLoading) {
		return (
			<div className="p-6 space-y-6">
				<Skeleton className="h-8 w-64" />
				<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
					{[...Array(4)].map((_, i) => (
						<Skeleton key={i} className="h-32" />
					))}
				</div>
			</div>
		);
	}

	const getStatusColor = (status: string) => {
		switch (status) {
			case "completed":
				return "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200";
			case "pending":
				return "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200";
			case "overdue":
				return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200";
			case "upcoming":
				return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200";
			default:
				return "bg-muted text-foreground";
		}
	};

	const getPriorityColor = (priority: string) => {
		switch (priority) {
			case "high":
				return "border-l-4 border-l-red-500";
			case "medium":
				return "border-l-4 border-l-amber-500";
			case "low":
				return "border-l-4 border-l-blue-500";
			default:
				return "";
		}
	};

	const overdueCount =
		data?.deadlines?.filter((d) => d.status === "overdue").length || 0;
	const upcomingCount =
		data?.deadlines?.filter(
			(d) => d.status === "upcoming" || d.status === "pending",
		).length || 0;

	return (
		<div className="p-6 space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold text-foreground">
						Compliance Dashboard
					</h1>
					<p className="text-sm text-muted-foreground">
						SEBI, RBI, and regulatory compliance tracking
					</p>
				</div>
				<Button
					onClick={() => refetch()}
					disabled={isFetching}
					variant="outline"
					data-testid="button-refresh"
				>
					<RefreshCw
						className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`}
					/>
					Refresh
				</Button>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-5 gap-4">
				<Card className="bg-gradient-to-br from-emerald-500 to-green-600 text-foreground">
					<CardHeader className="pb-2">
						<CardTitle className="text-lg flex items-center gap-2">
							<LucideShield className="w-5 h-5" />
							Compliance Score
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-4xl font-bold">{data?.overallScore || 0}%</p>
						<Progress
							value={data?.overallScore || 0}
							className="mt-2 bg-card/20"
						/>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium flex items-center gap-2">
							<AlertTriangle className="w-4 h-4 text-red-600" />
							Overdue Items
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p
							className="text-2xl font-bold text-red-600"
							data-testid="text-overdue"
						>
							{overdueCount}
						</p>
						<p className="text-xs text-muted-foreground">
							Require immediate action
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium flex items-center gap-2">
							<Clock className="w-4 h-4 text-amber-600" />
							Upcoming Deadlines
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p
							className="text-2xl font-bold text-amber-600"
							data-testid="text-upcoming"
						>
							{upcomingCount}
						</p>
						<p className="text-xs text-muted-foreground">Next 30 days</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium flex items-center gap-2">
							<Bell className="w-4 h-4 text-blue-600" />
							Active Alerts
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-2xl font-bold text-blue-600">
							{data?.alerts?.length || 0}
						</p>
						<p className="text-xs text-muted-foreground">Regulatory updates</p>
					</CardContent>
				</Card>

				<Card
					className={
						data?.forensicStatus?.status === "failed"
							? "border-red-500 bg-red-50 dark:bg-red-900/10"
							: ""
					}
				>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium flex items-center gap-2">
							<LucideShield
								className={`w-4 h-4 ${data?.forensicStatus?.status === "failed" ? "text-red-600" : "text-emerald-600"}`}
							/>
							Forensic Integrity
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center gap-2">
							<p
								className={`text-2xl font-bold ${data?.forensicStatus?.status === "failed" ? "text-red-600" : "text-emerald-600"}`}
							>
								{data?.forensicStatus?.status === "failed"
									? "BREACHED"
									: "VERIFIED"}
							</p>
							{data?.forensicStatus?.status === "passed" && (
								<CheckCircle className="w-5 h-5 text-emerald-600" />
							)}
						</div>
						<p className="text-xs text-muted-foreground">
							{data?.forensicStatus?.totalVerified || 0} records secured via
							HMAC-SHA256
						</p>
					</CardContent>
				</Card>
			</div>

			<Tabs defaultValue={defaultTab} className="w-full">
				<TabsList>
					<TabsTrigger value="deadlines" data-testid="tab-deadlines">
						Deadlines
					</TabsTrigger>
					<TabsTrigger value="status" data-testid="tab-status">
						Status by Category
					</TabsTrigger>
					<TabsTrigger value="updates" data-testid="tab-updates">
						Regulatory Updates
					</TabsTrigger>
					<TabsTrigger value="gaps" data-testid="tab-gaps">
						Regulatory Gaps
					</TabsTrigger>
					<TabsTrigger value="grievances" data-testid="tab-grievances">
						SEBI SCORES
					</TabsTrigger>
					<TabsTrigger value="forensic" data-testid="tab-forensic">
						Forensic Audit
					</TabsTrigger>
				</TabsList>

				<TabsContent value="deadlines" className="mt-4">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Calendar className="w-5 h-5" />
								Compliance Calendar
							</CardTitle>
							<CardDescription>
								Upcoming regulatory deadlines and filings
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-3">
								{(data?.deadlines || []).map((deadline) => (
									<div
										key={deadline.id}
										className={`p-4 border rounded-lg ${getPriorityColor(deadline.priority)}`}
										data-testid={`deadline-${deadline.id}`}
									>
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-3">
												<Badge className={regulatorColors[deadline.regulator]}>
													{deadline.regulator}
												</Badge>
												<span className="font-medium">{deadline.title}</span>
												<Badge className={getStatusColor(deadline.status)}>
													{deadline.status === "completed" && (
														<CheckCircle className="w-3 h-3 mr-1" />
													)}
													{deadline.status === "overdue" && (
														<AlertTriangle className="w-3 h-3 mr-1" />
													)}
													{deadline.status}
												</Badge>
											</div>
											<div className="flex items-center gap-2">
												<span className="text-sm text-muted-foreground">
													{format(new Date(deadline.dueDate), "MMM dd, yyyy")}
												</span>
												{deadline.documentLink && (
													<Button size="sm" variant="ghost">
														<ExternalLink className="w-4 h-4" />
													</Button>
												)}
											</div>
										</div>
										<p className="mt-2 text-sm text-muted-foreground">
											{deadline.description}
										</p>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="status" className="mt-4">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{(data?.statusByCategory || []).map((category) => (
							<Card key={category.category}>
								<CardHeader className="pb-2">
									<CardTitle className="text-lg flex items-center gap-2">
										<Scale className="w-5 h-5" />
										{category.category}
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="space-y-3">
										<div className="flex items-center justify-between">
											<span className="text-sm text-muted-foreground">
												Compliance Rate
											</span>
											<span className="font-bold">{category.percentage}%</span>
										</div>
										<Progress value={category.percentage} />
										<div className="flex items-center justify-between text-sm">
											<div className="flex items-center gap-1">
												<CheckCircle className="w-4 h-4 text-emerald-600" />
												<span>{category.compliant} Compliant</span>
											</div>
											<div className="flex items-center gap-1">
												<AlertTriangle className="w-4 h-4 text-red-600" />
												<span>{category.nonCompliant} Non-compliant</span>
											</div>
										</div>
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				</TabsContent>

				<TabsContent value="updates" className="mt-4">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<FileText className="w-5 h-5" />
								Recent Regulatory Updates
							</CardTitle>
							<CardDescription>
								Latest circulars and notifications from regulators
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								{(data?.recentUpdates || []).map((update, index) => (
									<div
										key={index}
										className="flex items-center justify-between p-3 border rounded-lg"
										data-testid={`update-${index}`}
									>
										<div className="flex items-center gap-3">
											<Badge
												className={
													regulatorColors[
														update.regulator as keyof typeof regulatorColors
													] || "bg-muted"
												}
											>
												{update.regulator}
											</Badge>
											<span className="font-medium">{update.title}</span>
										</div>
										<div className="flex items-center gap-2">
											<span className="text-sm text-muted-foreground">
												{format(new Date(update.date), "MMM dd, yyyy")}
											</span>
											<Button size="sm" variant="ghost">
												<Download className="w-4 h-4" />
											</Button>
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="gaps" className="mt-4">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Target className="w-5 h-5" />
								Regulatory Gaps Tracker
							</CardTitle>
							<CardDescription>
								Track and manage compliance gaps across SEBI, RBI, IRDAI, MCA,
								and ITD regulations
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
								<div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
									<div className="text-sm text-red-600 dark:text-red-400 font-medium">
										High Risk
									</div>
									<div className="text-2xl font-bold text-red-700 dark:text-red-300">
										{
											(data?.regulatoryGaps || []).filter(
												(g) =>
													g.riskLevel === "high" && g.status !== "completed",
											).length
										}
									</div>
								</div>
								<div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
									<div className="text-sm text-amber-600 dark:text-amber-400 font-medium">
										Medium Risk
									</div>
									<div className="text-2xl font-bold text-amber-700 dark:text-amber-300">
										{
											(data?.regulatoryGaps || []).filter(
												(g) =>
													g.riskLevel === "medium" && g.status !== "completed",
											).length
										}
									</div>
								</div>
								<div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
									<div className="text-sm text-blue-600 dark:text-blue-400 font-medium">
										In Progress
									</div>
									<div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
										{
											(data?.regulatoryGaps || []).filter(
												(g) => g.status === "in_progress",
											).length
										}
									</div>
								</div>
								<div className="p-3 bg-emerald-50 dark:bg-emerald-950 rounded-lg border border-emerald-200 dark:border-emerald-800">
									<div className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
										Completed
									</div>
									<div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
										{
											(data?.regulatoryGaps || []).filter(
												(g) => g.status === "completed",
											).length
										}
									</div>
								</div>
							</div>

							<div className="space-y-3">
								{(data?.regulatoryGaps || []).map((gap) => (
									<div
										key={gap.id}
										className={`p-4 border rounded-lg ${
											gap.riskLevel === "high"
												? "border-l-4 border-l-red-500"
												: gap.riskLevel === "medium"
													? "border-l-4 border-l-amber-500"
													: "border-l-4 border-l-blue-500"
										}`}
										data-testid={`gap-${gap.id}`}
									>
										<div className="flex items-start justify-between">
											<div className="flex-1">
												<div className="flex items-center gap-2 flex-wrap">
													<Badge className={regulatorColors[gap.regulator]}>
														{gap.regulator}
													</Badge>
													<Badge
														className={
															gap.status === "completed"
																? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300"
																: gap.status === "in_progress"
																	? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
																	: gap.status === "deferred"
																		? "bg-muted text-foreground"
																		: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300"
														}
													>
														{gap.status === "completed" && (
															<CheckCircle className="w-3 h-3 mr-1" />
														)}
														{gap.status === "in_progress" && (
															<TrendingUp className="w-3 h-3 mr-1" />
														)}
														{gap.status === "not_started" && (
															<CircleDot className="w-3 h-3 mr-1" />
														)}
														{gap.status.replace("_", " ")}
													</Badge>
													<Badge
														variant="outline"
														className={
															gap.riskLevel === "high"
																? "border-red-500 text-red-700 dark:text-red-300"
																: gap.riskLevel === "medium"
																	? "border-amber-500 text-amber-700 dark:text-amber-300"
																	: "border-blue-500 text-blue-700 dark:text-blue-300"
														}
													>
														{gap.riskLevel} risk
													</Badge>
													<Badge variant="outline">
														{gap.estimatedEffort} effort
													</Badge>
												</div>
												<h4 className="font-medium mt-2">{gap.title}</h4>
												<p className="text-sm text-muted-foreground mt-1">
													{gap.description}
												</p>
												{gap.regulatoryReference && (
													<p className="text-xs text-muted-foreground mt-2 font-mono">
														Ref: {gap.regulatoryReference}
													</p>
												)}
											</div>
											<div className="text-right text-sm ml-4">
												{gap.status === "completed" &&
												gap.actualCompletionDate ? (
													<div className="text-emerald-600 dark:text-emerald-400">
														Completed{" "}
														{format(
															new Date(gap.actualCompletionDate),
															"MMM dd, yyyy",
														)}
													</div>
												) : gap.targetCompletionDate ? (
													<div
														className={
															isPast(new Date(gap.targetCompletionDate))
																? "text-red-600"
																: "text-muted-foreground"
														}
													>
														Target:{" "}
														{format(
															new Date(gap.targetCompletionDate),
															"MMM dd, yyyy",
														)}
													</div>
												) : null}
											</div>
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="grievances" className="mt-4">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<MessageSquare className="w-5 h-5" />
								SEBI SCORES - Investor Grievance Management
							</CardTitle>
							<CardDescription>
								Track and manage investor complaints per SEBI Circular
								SEBI/HO/OIAE/IGRD/CIR/P/2023/155 (30-day SLA)
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="mb-6 grid grid-cols-1 md:grid-cols-5 gap-3">
								<div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
									<div className="text-sm text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
										<Users className="w-4 h-4" />
										Total Complaints
									</div>
									<div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
										{grievanceMetrics?.total || 0}
									</div>
								</div>
								<div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
									<div className="text-sm text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
										<Clock className="w-4 h-4" />
										Pending
									</div>
									<div className="text-2xl font-bold text-amber-700 dark:text-amber-300">
										{(grievanceMetrics?.byStatus?.submitted || 0) +
											(grievanceMetrics?.byStatus?.acknowledged || 0) +
											(grievanceMetrics?.byStatus?.under_review || 0)}
									</div>
								</div>
								<div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
									<div className="text-sm text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
										<AlertTriangle className="w-4 h-4" />
										Overdue (SLA Breach)
									</div>
									<div className="text-2xl font-bold text-red-700 dark:text-red-300">
										{grievanceMetrics?.pendingOverdue || 0}
									</div>
								</div>
								<div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
									<div className="text-sm text-purple-600 dark:text-purple-400 font-medium flex items-center gap-1">
										<TrendingUp className="w-4 h-4" />
										Escalated
									</div>
									<div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
										{grievanceMetrics?.escalated || 0}
									</div>
								</div>
								<div className="p-3 bg-emerald-50 dark:bg-emerald-950 rounded-lg border border-emerald-200 dark:border-emerald-800">
									<div className="text-sm text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
										<CheckCircle className="w-4 h-4" />
										Resolved (This Month)
									</div>
									<div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
										{grievanceMetrics?.resolvedThisMonth || 0}
									</div>
								</div>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
								<div className="p-4 border rounded-lg">
									<h4 className="font-medium mb-3 flex items-center gap-2">
										<Timer className="w-4 h-4" />
										SLA Performance
									</h4>
									<div className="space-y-2">
										<div className="flex justify-between items-center">
											<span className="text-sm text-muted-foreground">
												Average Resolution Time
											</span>
											<span className="font-bold">
												{grievanceMetrics?.avgResolutionDays || 0} days
											</span>
										</div>
										<div className="flex justify-between items-center">
											<span className="text-sm text-muted-foreground">
												SLA Target
											</span>
											<span className="font-medium">30 days</span>
										</div>
										<div className="flex justify-between items-center">
											<span className="text-sm text-muted-foreground">
												SLA Breaches (Total)
											</span>
											<span
												className={`font-bold ${(grievanceMetrics?.slaBreaches || 0) > 0 ? "text-red-600" : "text-emerald-600"}`}
											>
												{grievanceMetrics?.slaBreaches || 0}
											</span>
										</div>
									</div>
								</div>
								<div className="p-4 border rounded-lg">
									<h4 className="font-medium mb-3">Complaints by Priority</h4>
									<div className="space-y-2">
										<div className="flex justify-between items-center">
											<Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
												Critical
											</Badge>
											<span className="font-bold">
												{grievanceMetrics?.byPriority?.critical || 0}
											</span>
										</div>
										<div className="flex justify-between items-center">
											<Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300">
												High
											</Badge>
											<span className="font-bold">
												{grievanceMetrics?.byPriority?.high || 0}
											</span>
										</div>
										<div className="flex justify-between items-center">
											<Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300">
												Medium
											</Badge>
											<span className="font-bold">
												{grievanceMetrics?.byPriority?.medium || 0}
											</span>
										</div>
										<div className="flex justify-between items-center">
											<Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
												Low
											</Badge>
											<span className="font-bold">
												{grievanceMetrics?.byPriority?.low || 0}
											</span>
										</div>
									</div>
								</div>
							</div>

							<div className="p-4 border rounded-lg bg-muted/30">
								<h4 className="font-medium mb-2">Regulatory Compliance</h4>
								<p className="text-sm text-muted-foreground">
									SEBI SCORES (SEBI Complaints Redress System) integration
									enables investors to lodge and track complaints against market
									intermediaries. All complaints must be resolved within 30 days
									as per SEBI guidelines.
								</p>
								<div className="mt-3 flex gap-2 flex-wrap">
									<Badge variant="outline" className="text-xs">
										SEBI Circular SEBI/HO/OIAE/IGRD/CIR/P/2023/155
									</Badge>
									<Badge variant="outline" className="text-xs">
										30-day SLA
									</Badge>
									<Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300 text-xs">
										<CheckCircle className="w-3 h-3 mr-1" />
										Implemented
									</Badge>
								</div>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="forensic" className="mt-4">
					<ForensicAuditTrail />
				</TabsContent>
			</Tabs>
		</div>
	);
}
