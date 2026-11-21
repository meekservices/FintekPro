import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/admin-layout";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
	Users,
	TrendingUp,
	AlertTriangle,
	CheckCircle2,
	Eye,
	Search,
	Download,
	BarChart3,
	Shield as LucideShield,
	Activity,
	AlertCircle,
	ShieldAlert,
	Power,
	RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface AgentOverviewData {
	totalAgents: number;
	activeAgents: number;
	growthModeUsage: {
		total: number;
		byAgent: Array<{
			agentId: string;
			agentName: string;
			count: number;
			complianceRate: number;
		}>;
	};
	overrideStats: {
		total: number;
		byType: {
			mode_downgrade: number;
			asset_class_lock: number;
			allocation_cap: number;
		};
		complianceRate: number;
	};
	performanceScores: {
		average: number;
		distribution: {
			excellent: number;
			good: number;
			average: number;
			needsImprovement: number;
		};
	};
	complianceAlerts: Array<{
		type: string;
		count: number;
		severity: string;
	}>;
}

export default function AdminAgentOversightPage() {
	const { toast } = useToast();
	const [searchQuery, setSearchQuery] = useState("");
	const [periodFilter, setPeriodFilter] = useState("monthly");
	const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
	const [surveillanceDomainFilter, setSurveillanceDomainFilter] = useState("all");
	const [isTogglingKillSwitch, setIsTogglingKillSwitch] = useState(false);

	const { data: overviewData, isLoading } = useQuery<AgentOverviewData>({
		queryKey: ["/api/admin/agent-oversight", periodFilter],
	});

	const { data: agentDetail } = useQuery({
		queryKey: ["/api/admin/agent-oversight", selectedAgent],
		enabled: !!selectedAgent,
	});

	const { data: surveillanceMetrics, refetch: refetchMetrics } = useQuery<{ success: boolean; data: any }>({
		queryKey: ["/api/admin/surveillance/metrics"],
		refetchInterval: 8000,
	});

	const { data: surveillanceIncidents, refetch: refetchIncidents, isLoading: incidentsLoading } = useQuery<{ success: boolean; data: any[] }>({
		queryKey: ["/api/admin/surveillance/incidents", surveillanceDomainFilter],
		queryFn: async () => {
			const url = surveillanceDomainFilter === "all"
				? "/api/admin/surveillance/incidents"
				: `/api/admin/surveillance/incidents?domain=${surveillanceDomainFilter}`;
			const res = await apiRequest("GET", url);
			return res.json();
		},
		refetchInterval: 8000,
	});

	const toggleKillSwitch = async (scope = "orders", currentlyActive = false) => {
		try {
			setIsTogglingKillSwitch(true);
			const nextActive = !currentlyActive;
			const res = await apiRequest("POST", "/api/admin/surveillance/kill-switch", {
				scope,
				active: nextActive,
				reason: nextActive
					? "Manual emergency trip by Administrator from Partner Oversight Console"
					: "Manual reset and operational clearance by Administrator",
			});
			const data = await res.json();
			if (data.success) {
				toast({
					title: nextActive ? "🚨 Kill Switch Engaged" : "🟢 Kill Switch Disengaged",
					description: nextActive
						? `Execution pipeline for ${scope} is now HALTED.`
						: `Execution pipeline for ${scope} has been restored to normal.`,
					variant: nextActive ? "destructive" : "default",
				});
				refetchMetrics();
				refetchIncidents();
			} else {
				toast({
					title: "Action Failed",
					description: data.error?.message || "Could not update kill switch.",
					variant: "destructive",
				});
			}
		} catch (err: any) {
			toast({
				title: "Network Error",
				description: err.message,
				variant: "destructive",
			});
		} finally {
			setIsTogglingKillSwitch(false);
		}
	};

	const handleResolveIncident = async (id: string) => {
		try {
			const res = await apiRequest("POST", `/api/admin/surveillance/incidents/${id}/action`, {
				action: "resolve",
				note: "Reviewed and resolved by Administrator from Oversight Console",
			});
			const data = await res.json();
			if (data.success) {
				toast({
					title: "Incident Resolved",
					description: `Incident ${id} has been marked as resolved.`,
				});
				refetchMetrics();
				refetchIncidents();
			}
		} catch (err: any) {
			toast({
				title: "Error",
				description: err.message,
				variant: "destructive",
			});
		}
	};

	const getSeverityColor = (severity: string) => {
		switch (severity) {
			case "critical":
				return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200";
			case "high":
				return "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200";
			case "medium":
				return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200";
			default:
				return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200";
		}
	};

	const getScoreColor = (score: number) => {
		if (score >= 90) return "text-green-600";
		if (score >= 75) return "text-blue-600";
		if (score >= 60) return "text-yellow-600";
		return "text-red-600";
	};

	return (
		<AdminLayout>
			<div className="p-6 space-y-6">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-3xl font-bold flex items-center gap-3">
							<Users className="h-8 w-8 text-primary" />
							Partner Oversight Dashboard
						</h1>
						<p className="text-muted-foreground mt-2">
							Monitor partner performance, governance, and compliance
						</p>
					</div>
					<div className="flex items-center gap-4">
						<Select value={periodFilter} onValueChange={setPeriodFilter}>
							<SelectTrigger className="w-40">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="weekly">Weekly</SelectItem>
								<SelectItem value="monthly">Monthly</SelectItem>
								<SelectItem value="quarterly">Quarterly</SelectItem>
							</SelectContent>
						</Select>
						<Button variant="outline">
							<Download className="h-4 w-4 mr-2" />
							Export Report
						</Button>
					</div>
				</div>

				{isLoading ? (
					<div className="flex items-center justify-center py-12">
						<div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
					</div>
				) : (
					<>
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
							<Card>
								<CardHeader className="pb-2">
									<CardDescription>Total Partners</CardDescription>
									<CardTitle className="text-3xl">
										{overviewData?.totalAgents || 0}
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="flex items-center gap-2 text-sm text-muted-foreground">
										<Activity className="h-4 w-4" />
										<span>
											{overviewData?.activeAgents || 0} active this period
										</span>
									</div>
								</CardContent>
							</Card>

							<Card>
								<CardHeader className="pb-2">
									<CardDescription>Growth-Optimized Usage</CardDescription>
									<CardTitle className="text-3xl">
										{overviewData?.growthModeUsage?.total || 0}
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="flex items-center gap-2 text-sm text-yellow-600">
										<TrendingUp className="h-4 w-4" />
										<span>recommendations this period</span>
									</div>
								</CardContent>
							</Card>

							<Card>
								<CardHeader className="pb-2">
									<CardDescription>Override Compliance</CardDescription>
									<CardTitle className="text-3xl">
										{overviewData?.overrideStats?.complianceRate || 0}%
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="flex items-center gap-2 text-sm text-green-600">
										<CheckCircle2 className="h-4 w-4" />
										<span>
											{overviewData?.overrideStats?.total || 0} total overrides
										</span>
									</div>
								</CardContent>
							</Card>

							<Card>
								<CardHeader className="pb-2">
									<CardDescription>Avg Performance Score</CardDescription>
									<CardTitle
										className={`text-3xl ${getScoreColor(overviewData?.performanceScores?.average || 0)}`}
									>
										{overviewData?.performanceScores?.average || 0}
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="flex items-center gap-2 text-sm text-muted-foreground">
										<BarChart3 className="h-4 w-4" />
										<span>out of 100</span>
									</div>
								</CardContent>
							</Card>
						</div>

						{overviewData?.complianceAlerts &&
							overviewData.complianceAlerts.length > 0 && (
								<Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/30/50">
									<CardHeader>
										<CardTitle className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
											<AlertTriangle className="h-5 w-5" />
											Compliance Alerts
										</CardTitle>
									</CardHeader>
									<CardContent>
										<div className="flex flex-wrap gap-4">
											{overviewData.complianceAlerts.map((alert, index) => (
												<Badge
													key={index}
													className={getSeverityColor(alert.severity)}
												>
													{alert.type.replace(/_/g, " ")}: {alert.count}
												</Badge>
											))}
										</div>
									</CardContent>
								</Card>
							)}

						<Tabs defaultValue="growth-usage">
							<TabsList>
								<TabsTrigger value="growth-usage">
									Growth-Optimized Usage
								</TabsTrigger>
								<TabsTrigger value="overrides">Override Activity</TabsTrigger>
								<TabsTrigger value="performance">
									Performance Distribution
								</TabsTrigger>
								<TabsTrigger value="surveillance" className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
									<ShieldAlert className="h-4 w-4" />
									Surveillance & Kill-Switch
								</TabsTrigger>
							</TabsList>

							<TabsContent value="growth-usage" className="mt-6">
								<Card>
									<CardHeader>
										<div className="flex items-center justify-between">
											<div>
												<CardTitle>Growth-Optimized Mode by Partner</CardTitle>
												<CardDescription>
													Partners using advanced recommendation mode
												</CardDescription>
											</div>
											<div className="relative w-64">
												<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
												<Input
													placeholder="Search partners..."
													value={searchQuery}
													onChange={(e) => setSearchQuery(e.target.value)}
													className="pl-10"
												/>
											</div>
										</div>
									</CardHeader>
									<CardContent>
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>Partner Name</TableHead>
													<TableHead className="text-center">
														Usage Count
													</TableHead>
													<TableHead className="text-center">
														Compliance Rate
													</TableHead>
													<TableHead className="text-center">Status</TableHead>
													<TableHead className="text-right">Actions</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{overviewData?.growthModeUsage?.byAgent?.map(
													(agent) => (
														<TableRow
															key={agent.agentId}
															data-testid={`agent-row-${agent.agentId}`}
														>
															<TableCell className="font-medium">
																{agent.agentName}
															</TableCell>
															<TableCell className="text-center">
																{agent.count}
															</TableCell>
															<TableCell className="text-center">
																<Badge
																	variant={
																		agent.complianceRate >= 95
																			? "default"
																			: "destructive"
																	}
																>
																	{agent.complianceRate}%
																</Badge>
															</TableCell>
															<TableCell className="text-center">
																{agent.complianceRate >= 95 ? (
																	<Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
																		<CheckCircle2 className="h-3 w-3 mr-1" />
																		Compliant
																	</Badge>
																) : (
																	<Badge className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200">
																		<AlertCircle className="h-3 w-3 mr-1" />
																		Review Needed
																	</Badge>
																)}
															</TableCell>
															<TableCell className="text-right">
																<Button
																	variant="ghost"
																	size="sm"
																	onClick={() =>
																		setSelectedAgent(agent.agentId)
																	}
																>
																	<Eye className="h-4 w-4" />
																</Button>
															</TableCell>
														</TableRow>
													),
												)}
											</TableBody>
										</Table>
									</CardContent>
								</Card>
							</TabsContent>

							<TabsContent value="overrides" className="mt-6">
								<Card>
									<CardHeader>
										<CardTitle>Override Activity Summary</CardTitle>
										<CardDescription>Partner overrides by type</CardDescription>
									</CardHeader>
									<CardContent>
										<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
											<div className="p-4 border rounded-lg">
												<div className="flex items-center justify-between mb-2">
													<span className="text-sm text-muted-foreground">
														Mode Downgrades
													</span>
													<Badge variant="outline">
														{overviewData?.overrideStats?.byType
															?.mode_downgrade || 0}
													</Badge>
												</div>
												<Progress
													value={
														((overviewData?.overrideStats?.byType
															?.mode_downgrade || 0) /
															(overviewData?.overrideStats?.total || 1)) *
														100
													}
												/>
											</div>
											<div className="p-4 border rounded-lg">
												<div className="flex items-center justify-between mb-2">
													<span className="text-sm text-muted-foreground">
														Asset Class Locks
													</span>
													<Badge variant="outline">
														{overviewData?.overrideStats?.byType
															?.asset_class_lock || 0}
													</Badge>
												</div>
												<Progress
													value={
														((overviewData?.overrideStats?.byType
															?.asset_class_lock || 0) /
															(overviewData?.overrideStats?.total || 1)) *
														100
													}
												/>
											</div>
											<div className="p-4 border rounded-lg">
												<div className="flex items-center justify-between mb-2">
													<span className="text-sm text-muted-foreground">
														Allocation Caps
													</span>
													<Badge variant="outline">
														{overviewData?.overrideStats?.byType
															?.allocation_cap || 0}
													</Badge>
												</div>
												<Progress
													value={
														((overviewData?.overrideStats?.byType
															?.allocation_cap || 0) /
															(overviewData?.overrideStats?.total || 1)) *
														100
													}
												/>
											</div>
										</div>
									</CardContent>
								</Card>
							</TabsContent>

							<TabsContent value="performance" className="mt-6">
								<Card>
									<CardHeader>
										<CardTitle>Performance Score Distribution</CardTitle>
										<CardDescription>
											Agent performance categorization
										</CardDescription>
									</CardHeader>
									<CardContent>
										<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
											<div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950/30">
												<div className="text-2xl font-bold text-green-700 dark:text-green-300">
													{overviewData?.performanceScores?.distribution
														?.excellent || 0}
												</div>
												<div className="text-sm text-green-600">
													Excellent (90+)
												</div>
											</div>
											<div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/30">
												<div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
													{overviewData?.performanceScores?.distribution
														?.good || 0}
												</div>
												<div className="text-sm text-blue-600">
													Good (75-89)
												</div>
											</div>
											<div className="p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-950/30">
												<div className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
													{overviewData?.performanceScores?.distribution
														?.average || 0}
												</div>
												<div className="text-sm text-yellow-600">
													Average (60-74)
												</div>
											</div>
											<div className="p-4 border rounded-lg bg-red-50 dark:bg-red-950/30">
												<div className="text-2xl font-bold text-red-700 dark:text-red-300">
													{overviewData?.performanceScores?.distribution
														?.needsImprovement || 0}
												</div>
												<div className="text-sm text-red-600">
													Needs Improvement (&lt;60)
												</div>
											</div>
										</div>
									</CardContent>
								</Card>
							</TabsContent>

							<TabsContent value="surveillance" className="mt-6 space-y-6">
								{/* Emergency Controls Header */}
								<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
									<Card className="border-red-300 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20 col-span-1 md:col-span-2">
										<CardHeader className="pb-3">
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-2">
													<ShieldAlert className="h-6 w-6 text-red-600 dark:text-red-400" />
													<CardTitle className="text-xl">Execution Kill-Switch Controller</CardTitle>
												</div>
												<Badge
													className={
														surveillanceMetrics?.data?.killSwitchStates?.orders?.active
															? "bg-red-600 text-white font-bold"
															: "bg-green-600 text-white font-bold"
													}
												>
													{surveillanceMetrics?.data?.killSwitchStates?.orders?.active
														? "KILL-SWITCH ENGAGED (HALTED)"
														: "SYSTEM ACTIVE (NORMAL)"}
												</Badge>
											</div>
											<CardDescription>
												Instantly halts all trade execution, order placement, and mutating workflows across the platform during severe runtime anomalies or illegal activity.
											</CardDescription>
										</CardHeader>
										<CardContent className="flex items-center justify-between pt-0">
											<div className="text-xs text-muted-foreground">
												Last updated: {surveillanceMetrics?.data?.killSwitchStates?.orders?.triggeredAt
													? new Date(surveillanceMetrics.data.killSwitchStates.orders.triggeredAt).toLocaleTimeString()
													: "N/A"}{" "}
												| Scope: <strong>orders & execution</strong>
											</div>
											<Button
												variant={surveillanceMetrics?.data?.killSwitchStates?.orders?.active ? "outline" : "destructive"}
												size="sm"
												disabled={isTogglingKillSwitch}
												onClick={() =>
													toggleKillSwitch(
														"orders",
														surveillanceMetrics?.data?.killSwitchStates?.orders?.active ?? false
													)
												}
												className="gap-1.5 font-semibold"
											>
												<Power className="h-4 w-4" />
												{surveillanceMetrics?.data?.killSwitchStates?.orders?.active
													? "Disengage Kill-Switch (Resume)"
													: "EMERGENCY TRIP KILL-SWITCH"}
											</Button>
										</CardContent>
									</Card>

									<Card>
										<CardHeader className="pb-2">
											<CardDescription>Quarantined Transactions</CardDescription>
											<CardTitle className="text-3xl text-orange-600">
												{surveillanceMetrics?.data?.quarantinedTransactions || 0}
											</CardTitle>
										</CardHeader>
										<CardContent className="text-xs text-muted-foreground">
											Orders held for Compliance Officer review due to gate violations.
										</CardContent>
									</Card>
								</div>

								{/* Surveillance Incident Ledger */}
								<Card>
									<CardHeader>
										<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
											<div>
												<CardTitle className="flex items-center gap-2">
													<Activity className="h-5 w-5 text-primary" />
													Real-Time Surveillance & Incident Stream
												</CardTitle>
												<CardDescription>
													Monitoring runtime errors, market abuse / illegal activities, and process flow integrity with automatic mitigation.
												</CardDescription>
											</div>
											<div className="flex items-center gap-3">
												<Select
													value={surveillanceDomainFilter}
													onValueChange={(val) => setSurveillanceDomainFilter(val)}
												>
													<SelectTrigger className="w-[200px]">
														<SelectValue placeholder="All Domains" />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="all">All Domains</SelectItem>
														<SelectItem value="runtime_error">Runtime Errors</SelectItem>
														<SelectItem value="illegal_activity">Illegal / Abuse Activities</SelectItem>
														<SelectItem value="process_flow_error">Process Flow Errors</SelectItem>
													</SelectContent>
												</Select>
												<Button
													variant="outline"
													size="icon"
													onClick={() => {
														refetchMetrics();
														refetchIncidents();
													}}
													title="Refresh Incidents"
												>
													<RefreshCw className="h-4 w-4" />
												</Button>
											</div>
										</div>
									</CardHeader>
									<CardContent>
										{incidentsLoading ? (
											<div className="py-8 text-center text-muted-foreground">Loading surveillance ledger...</div>
										) : !surveillanceIncidents?.data || surveillanceIncidents.data.length === 0 ? (
											<div className="py-12 text-center">
												<CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-2" />
												<h4 className="text-sm font-semibold">All Systems Operating Normally</h4>
												<p className="text-xs text-muted-foreground mt-1">
													No active runtime errors, illegal activities, or process flow deviations detected.
												</p>
											</div>
										) : (
											<Table>
												<TableHeader>
													<TableRow>
														<TableHead>Time</TableHead>
														<TableHead>Domain</TableHead>
														<TableHead>Error Code & Message</TableHead>
														<TableHead>Severity</TableHead>
														<TableHead>Immediate Actions</TableHead>
														<TableHead>Status</TableHead>
														<TableHead className="text-right">Action</TableHead>
													</TableRow>
												</TableHeader>
												<TableBody>
													{surveillanceIncidents.data.map((incident: any) => (
														<TableRow key={incident.id}>
															<TableCell className="text-xs text-muted-foreground whitespace-nowrap">
																{new Date(incident.timestamp).toLocaleTimeString()}
															</TableCell>
															<TableCell>
																<Badge variant="outline" className="text-xs capitalize">
																	{incident.domain.replace(/_/g, " ")}
																</Badge>
															</TableCell>
															<TableCell>
																<div className="font-mono text-xs font-semibold">{incident.errorCode}</div>
																<div className="text-xs text-muted-foreground line-clamp-1 max-w-md">
																	{incident.message}
																</div>
															</TableCell>
															<TableCell>
																<Badge className={getSeverityColor(incident.severity)}>
																	{incident.severity}
																</Badge>
															</TableCell>
															<TableCell>
																<div className="flex flex-wrap gap-1">
																	{incident.actionsTaken?.map((action: string, idx: number) => (
																		<span
																			key={idx}
																			className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono"
																		>
																			{action.replace(/_/g, " ")}
																		</span>
																	))}
																</div>
															</TableCell>
															<TableCell>
																<Badge
																	variant={incident.status === "active" ? "destructive" : "secondary"}
																	className="text-xs"
																>
																	{incident.status}
																</Badge>
															</TableCell>
															<TableCell className="text-right">
																{incident.status === "active" ? (
																	<Button
																		variant="outline"
																		size="sm"
																		onClick={() => handleResolveIncident(incident.id)}
																		className="text-xs h-7"
																	>
																		Resolve
																	</Button>
																) : (
																	<span className="text-xs text-muted-foreground">Resolved</span>
																)}
															</TableCell>
														</TableRow>
													))}
												</TableBody>
											</Table>
										)}
									</CardContent>
								</Card>
							</TabsContent>
						</Tabs>
					</>
				)}

				<Dialog
					open={!!selectedAgent}
					onOpenChange={() => setSelectedAgent(null)}
				>
					<DialogContent className="max-w-2xl">
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2">
								<LucideShield className="h-5 w-5" />
								Agent Details
							</DialogTitle>
							<DialogDescription>
								Detailed view of agent activity and compliance
							</DialogDescription>
						</DialogHeader>
						<div className="py-4">
							<p className="text-muted-foreground text-center">
								Agent detail view would load here for agent: {selectedAgent}
							</p>
						</div>
					</DialogContent>
				</Dialog>
			</div>
		</AdminLayout>
	);
}
