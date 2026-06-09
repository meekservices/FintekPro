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
} from "lucide-react";

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
	const [searchQuery, setSearchQuery] = useState("");
	const [periodFilter, setPeriodFilter] = useState("monthly");
	const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

	const { data: overviewData, isLoading } = useQuery<AgentOverviewData>({
		queryKey: ["/api/admin/agent-oversight", periodFilter],
	});

	const { data: agentDetail } = useQuery({
		queryKey: ["/api/admin/agent-oversight", selectedAgent],
		enabled: !!selectedAgent,
	});

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
							Agent Oversight Dashboard
						</h1>
						<p className="text-muted-foreground mt-2">
							Monitor agent performance, governance, and compliance
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
									<CardDescription>Total Agents</CardDescription>
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
							</TabsList>

							<TabsContent value="growth-usage" className="mt-6">
								<Card>
									<CardHeader>
										<div className="flex items-center justify-between">
											<div>
												<CardTitle>Growth-Optimized Mode by Agent</CardTitle>
												<CardDescription>
													Agents using advanced recommendation mode
												</CardDescription>
											</div>
											<div className="relative w-64">
												<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
												<Input
													placeholder="Search agents..."
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
													<TableHead>Agent Name</TableHead>
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
										<CardDescription>Agent overrides by type</CardDescription>
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
