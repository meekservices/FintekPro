import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import {
	BarChart3,
	Target,
	Users,
	Phone,
	Mail,
	Video,
	FileText,
	TrendingUp,
	IndianRupee,
	CheckCircle2,
	Clock,
	AlertTriangle,
	ArrowRight,
} from "lucide-react";
import {
	ResponsiveContainer,
	BarChart,
	Bar,
	XAxis,
	YAxis,
	Tooltip,
	Cell,
	PieChart,
	Pie,
} from "recharts";

interface CrmAnalytics {
	pipelineByStage: Record<string, { count: number; value: number }>;
	taskStats: { pending: number; completed: number; overdue: number };
	interactionsByType: Record<string, number>;
	totalPipelineValue: number;
	wonValue: number;
}

const stageColors: Record<string, string> = {
	lead: "#3b82f6",
	qualified: "#06b6d4",
	proposal: "#8b5cf6",
	negotiation: "#f97316",
	won: "#10b981",
	lost: "#ef4444",
};

const interactionIcons: Record<string, any> = {
	call: Phone,
	email: Mail,
	meeting: Video,
	note: FileText,
};

export default function AgentCrmAnalytics() {
	const { user } = useAuth();

	const { data: analytics, isLoading } = useQuery<CrmAnalytics>({
		queryKey: ["/api/crm/analytics/dashboard", { agentId: user?.id }],
		enabled: !!user?.id,
		refetchInterval: 60000,
	});

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-64">
				<div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500" />
			</div>
		);
	}

	const pipelineData = analytics
		? Object.entries(analytics.pipelineByStage)
				.filter(([stage]) => !["won", "lost"].includes(stage))
				.map(([stage, data]) => ({
					stage: stage.charAt(0).toUpperCase() + stage.slice(1),
					count: data.count,
					value: data.value / 100000,
					fill: stageColors[stage],
				}))
		: [];

	const interactionData = analytics
		? Object.entries(analytics.interactionsByType).map(([type, count]) => ({
				name: type.charAt(0).toUpperCase() + type.slice(1),
				value: count,
			}))
		: [];

	const totalInteractions = interactionData.reduce(
		(sum, i) => sum + i.value,
		0,
	);
	const totalTasks =
		(analytics?.taskStats?.pending || 0) +
		(analytics?.taskStats?.completed || 0);
	const completionRate =
		totalTasks > 0
			? Math.round(((analytics?.taskStats?.completed || 0) / totalTasks) * 100)
			: 0;

	const activeDeals = pipelineData.reduce((sum, d) => sum + d.count, 0);
	const wonDeals = analytics?.pipelineByStage?.won?.count || 0;
	const lostDeals = analytics?.pipelineByStage?.lost?.count || 0;
	const winRate =
		wonDeals + lostDeals > 0
			? Math.round((wonDeals / (wonDeals + lostDeals)) * 100)
			: 0;

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1
						className="text-2xl font-bold flex items-center gap-2"
						data-testid="text-analytics-title"
					>
						<BarChart3 className="h-6 w-6 text-emerald-500" />
						CRM Analytics
					</h1>
					<p className="text-sm text-muted-foreground">
						Performance insights and metrics
					</p>
				</div>
			</div>

			<div className="grid grid-cols-4 gap-4">
				<Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
					<CardContent className="pt-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-xs text-muted-foreground">Pipeline Value</p>
								<p className="text-2xl font-bold text-emerald-400">
									₹{((analytics?.totalPipelineValue || 0) / 100000).toFixed(1)}L
								</p>
							</div>
							<div className="p-2 rounded-lg bg-emerald-500/20">
								<Target className="h-5 w-5 text-emerald-400" />
							</div>
						</div>
					</CardContent>
				</Card>

				<Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
					<CardContent className="pt-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-xs text-muted-foreground">Won Value</p>
								<p className="text-2xl font-bold text-green-400">
									₹{((analytics?.wonValue || 0) / 100000).toFixed(1)}L
								</p>
							</div>
							<div className="p-2 rounded-lg bg-green-500/20">
								<IndianRupee className="h-5 w-5 text-green-400" />
							</div>
						</div>
					</CardContent>
				</Card>

				<Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
					<CardContent className="pt-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-xs text-muted-foreground">Win Rate</p>
								<p className="text-2xl font-bold text-blue-400">{winRate}%</p>
							</div>
							<div className="p-2 rounded-lg bg-blue-500/20">
								<TrendingUp className="h-5 w-5 text-blue-400" />
							</div>
						</div>
					</CardContent>
				</Card>

				<Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
					<CardContent className="pt-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-xs text-muted-foreground">Active Deals</p>
								<p className="text-2xl font-bold text-purple-400">
									{activeDeals}
								</p>
							</div>
							<div className="p-2 rounded-lg bg-purple-500/20">
								<Users className="h-5 w-5 text-purple-400" />
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			<div className="grid grid-cols-2 gap-6">
				<Card>
					<CardHeader>
						<CardTitle className="text-base flex items-center gap-2">
							<Target className="h-4 w-4 text-emerald-500" />
							Pipeline by Stage
						</CardTitle>
					</CardHeader>
					<CardContent>
						{pipelineData.length > 0 ? (
							<ResponsiveContainer width="100%" height={200}>
								<BarChart data={pipelineData} layout="vertical">
									<XAxis type="number" hide />
									<YAxis
										type="category"
										dataKey="stage"
										width={80}
										fontSize={12}
									/>
									<Tooltip
										formatter={(value: any, name: string) => [
											name === "value" ? `₹${value}L` : value,
											name === "value" ? "Value" : "Deals",
										]}
										contentStyle={{
											background: "#1a1a1a",
											border: "none",
											borderRadius: 8,
										}}
									/>
									<Bar dataKey="count" name="Deals" radius={4}>
										{pipelineData.map((entry, index) => (
											<Cell key={`cell-${index}`} fill={entry.fill} />
										))}
									</Bar>
								</BarChart>
							</ResponsiveContainer>
						) : (
							<div className="h-[200px] flex items-center justify-center text-muted-foreground">
								No pipeline data yet
							</div>
						)}
						<Link
							href="/crm/pipeline"
							className="flex items-center gap-1 text-sm text-emerald-400 hover:underline mt-2"
						>
							View Pipeline <ArrowRight className="h-3 w-3" />
						</Link>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="text-base flex items-center gap-2">
							<Phone className="h-4 w-4 text-blue-500" />
							Interactions (Last 30 Days)
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-2 gap-4">
							{Object.entries(analytics?.interactionsByType || {}).map(
								([type, count]) => {
									const Icon = interactionIcons[type] || FileText;
									return (
										<div
											key={type}
											className="flex items-center gap-3 p-3 rounded-lg border"
										>
											<div className="p-2 rounded-lg bg-blue-500/20">
												<Icon className="h-4 w-4 text-blue-400" />
											</div>
											<div>
												<p className="text-xl font-bold">{count}</p>
												<p className="text-xs text-muted-foreground capitalize">
													{type}s
												</p>
											</div>
										</div>
									);
								},
							)}
							{Object.keys(analytics?.interactionsByType || {}).length ===
								0 && (
								<div className="col-span-2 py-8 text-center text-muted-foreground">
									No interactions logged yet
								</div>
							)}
						</div>
						<div className="mt-4 pt-4 border-t">
							<p className="text-sm text-muted-foreground">
								Total:{" "}
								<span className="font-medium text-foreground">
									{totalInteractions}
								</span>{" "}
								interactions
							</p>
						</div>
					</CardContent>
				</Card>
			</div>

			<div className="grid grid-cols-3 gap-6">
				<Card>
					<CardHeader>
						<CardTitle className="text-base flex items-center gap-2">
							<CheckCircle2 className="h-4 w-4 text-emerald-500" />
							Task Completion
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							<div className="flex items-center justify-between">
								<span className="text-3xl font-bold">{completionRate}%</span>
								<Badge
									variant={
										completionRate >= 80
											? "default"
											: completionRate >= 50
												? "secondary"
												: "destructive"
									}
								>
									{completionRate >= 80
										? "Excellent"
										: completionRate >= 50
											? "Good"
											: "Needs Attention"}
								</Badge>
							</div>
							<Progress value={completionRate} className="h-2" />
							<div className="grid grid-cols-3 gap-2 text-center">
								<div className="p-2 rounded border">
									<p className="text-lg font-bold text-yellow-400">
										{analytics?.taskStats?.pending || 0}
									</p>
									<p className="text-xs text-muted-foreground">Pending</p>
								</div>
								<div className="p-2 rounded border">
									<p className="text-lg font-bold text-emerald-400">
										{analytics?.taskStats?.completed || 0}
									</p>
									<p className="text-xs text-muted-foreground">Done</p>
								</div>
								<div className="p-2 rounded border">
									<p className="text-lg font-bold text-red-400">
										{analytics?.taskStats?.overdue || 0}
									</p>
									<p className="text-xs text-muted-foreground">Overdue</p>
								</div>
							</div>
						</div>
						<Link
							href="/crm/tasks"
							className="flex items-center gap-1 text-sm text-emerald-400 hover:underline mt-4"
						>
							View Tasks <ArrowRight className="h-3 w-3" />
						</Link>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="text-base flex items-center gap-2">
							<TrendingUp className="h-4 w-4 text-purple-500" />
							Deal Stages
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							{Object.entries(analytics?.pipelineByStage || {}).map(
								([stage, data]) => (
									<div
										key={stage}
										className="flex items-center justify-between"
									>
										<div className="flex items-center gap-2">
											<div
												className={`h-2 w-2 rounded-full`}
												style={{ backgroundColor: stageColors[stage] }}
											/>
											<span className="text-sm capitalize">{stage}</span>
										</div>
										<div className="flex items-center gap-2">
											<Badge variant="outline">{data.count}</Badge>
											<span className="text-xs text-muted-foreground">
												₹{(data.value / 100000).toFixed(1)}L
											</span>
										</div>
									</div>
								),
							)}
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="text-base flex items-center gap-2">
							<AlertTriangle className="h-4 w-4 text-orange-500" />
							Quick Actions
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-2">
							<Link href="/crm/pipeline">
								<div className="p-3 rounded-lg border hover:border-emerald-500 cursor-pointer transition-colors">
									<div className="flex items-center justify-between">
										<span className="text-sm font-medium">View Pipeline</span>
										<ArrowRight className="h-4 w-4 text-muted-foreground" />
									</div>
								</div>
							</Link>
							<Link href="/crm/tasks">
								<div className="p-3 rounded-lg border hover:border-emerald-500 cursor-pointer transition-colors">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2">
											<span className="text-sm font-medium">Check Tasks</span>
											{(analytics?.taskStats?.overdue || 0) > 0 && (
												<Badge variant="destructive" className="text-xs">
													{analytics?.taskStats?.overdue} overdue
												</Badge>
											)}
										</div>
										<ArrowRight className="h-4 w-4 text-muted-foreground" />
									</div>
								</div>
							</Link>
							<Link href="/clients">
								<div className="p-3 rounded-lg border hover:border-emerald-500 cursor-pointer transition-colors">
									<div className="flex items-center justify-between">
										<span className="text-sm font-medium">
											Client Directory
										</span>
										<ArrowRight className="h-4 w-4 text-muted-foreground" />
									</div>
								</div>
							</Link>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
