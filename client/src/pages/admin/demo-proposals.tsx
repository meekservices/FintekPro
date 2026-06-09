import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
	FileText,
	TrendingUp,
	Users,
	Target,
	Clock,
	CheckCircle2,
	XCircle,
	Eye,
	ArrowRight,
	Search,
	Download,
	RefreshCw,
	BarChart3,
	ArrowUpRight,
	Loader2,
	Sparkles,
} from "lucide-react";
import {
	BarChart,
	Bar,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
	Cell,
	FunnelChart,
	Funnel,
	LabelList,
	PieChart,
	Pie,
	Legend,
} from "recharts";
import { format, differenceInDays, differenceInHours } from "date-fns";

interface DemoProposal {
	id: string;
	clientId: string;
	clientName: string;
	clientEmail: string;
	agentId: string;
	agentName: string;
	title: string;
	description: string;
	proposalSource: string;
	totalInvestmentAmount: string;
	status: string;
	isDemo: boolean;
	demoViewCount: number;
	demoLastViewedAt: string | null;
	demoConvertedAt: string | null;
	demoConvertedBy: string | null;
	createdAt: string;
	updatedAt: string;
}

interface DemoStats {
	totalDemos: number;
	converted: number;
	pending: number;
	expired: number;
	conversionRate: number;
	avgTimeToConvert: number;
	totalDemoValue: number;
	convertedValue: number;
}

const formatCurrency = (value: number) => {
	if (value >= 10000000) {
		return `₹${(value / 10000000).toFixed(2)} Cr`;
	}
	if (value >= 100000) {
		return `₹${(value / 100000).toFixed(2)} L`;
	}
	if (value >= 1000) {
		return `₹${(value / 1000).toFixed(1)} K`;
	}
	return `₹${value.toFixed(0)}`;
};

const CHART_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899"];

export default function DemoProposalsTracking() {
	const { toast } = useToast();
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState("all");
	const [sourceFilter, setSourceFilter] = useState("all");
	const [convertDialog, setConvertDialog] = useState<{
		open: boolean;
		proposal: DemoProposal | null;
	}>({ open: false, proposal: null });

	// Fetch demo proposals
	const {
		data: demoProposals = [],
		isLoading,
		refetch,
	} = useQuery<DemoProposal[]>({
		queryKey: ["/api/admin/demo-proposals"],
	});

	// Fetch demo stats
	const { data: stats } = useQuery<DemoStats>({
		queryKey: ["/api/admin/demo-proposals/stats"],
	});

	// Convert demo mutation
	const convertMutation = useMutation({
		mutationFn: (proposalId: string) =>
			apiRequest(`/api/admin/demo-proposals/${proposalId}/convert`, {
				method: "POST",
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/demo-proposals"],
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/demo-proposals/stats"],
			});
			setConvertDialog({ open: false, proposal: null });
			toast({
				title: "Demo Converted",
				description:
					"The demo proposal has been converted to a real investment proposal",
			});
		},
		onError: (error: any) => {
			toast({
				title: "Conversion Failed",
				description: error.message || "Failed to convert demo proposal",
				variant: "destructive",
			});
		},
	});

	const demos = demoProposals;

	// Calculate stats from demos
	const calculatedStats: DemoStats = stats || {
		totalDemos: demos.length,
		converted: demos.filter(
			(d) => d.status === "converted" || d.demoConvertedAt,
		).length,
		pending: demos.filter((d) => d.status === "pending" && !d.demoConvertedAt)
			.length,
		expired: demos.filter((d) => d.status === "expired").length,
		conversionRate:
			(demos.filter((d) => d.status === "converted" || d.demoConvertedAt)
				.length /
				demos.length) *
			100,
		avgTimeToConvert: 5.2,
		totalDemoValue: demos.reduce(
			(sum, d) => sum + Number.parseFloat(d.totalInvestmentAmount || "0"),
			0,
		),
		convertedValue: demos
			.filter((d) => d.status === "converted" || d.demoConvertedAt)
			.reduce(
				(sum, d) => sum + Number.parseFloat(d.totalInvestmentAmount || "0"),
				0,
			),
	};

	// Filter demos
	const filteredDemos = demos.filter((demo) => {
		const matchesSearch =
			demo.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
			demo.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
			demo.agentName?.toLowerCase().includes(searchTerm.toLowerCase());
		const matchesStatus =
			statusFilter === "all" || demo.status === statusFilter;
		const matchesSource =
			sourceFilter === "all" || demo.proposalSource === sourceFilter;
		return matchesSearch && matchesStatus && matchesSource;
	});

	// Funnel data
	const funnelData = [
		{
			name: "Demos Created",
			value: calculatedStats.totalDemos,
			fill: "#3b82f6",
		},
		{
			name: "Viewed (3+ times)",
			value: demos.filter((d) => d.demoViewCount >= 3).length,
			fill: "#8b5cf6",
		},
		{
			name: "Engaged",
			value: demos.filter((d) => d.demoViewCount >= 5).length,
			fill: "#f59e0b",
		},
		{ name: "Converted", value: calculatedStats.converted, fill: "#10b981" },
	];

	// Source distribution
	const sourceData = [
		{
			name: "AI Generated",
			value: demos.filter((d) => d.proposalSource === "ai").length,
			fill: "#3b82f6",
		},
		{
			name: "Agent Created",
			value: demos.filter((d) => d.proposalSource === "agent").length,
			fill: "#10b981",
		},
		{
			name: "Hybrid",
			value: demos.filter((d) => d.proposalSource === "hybrid").length,
			fill: "#8b5cf6",
		},
	];

	const getStatusBadge = (status: string, demoConvertedAt: string | null) => {
		if (demoConvertedAt || status === "converted") {
			return (
				<Badge className="bg-green-500/20 text-green-400 border-green-500/30">
					Converted
				</Badge>
			);
		}
		if (status === "pending") {
			return (
				<Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
					Pending
				</Badge>
			);
		}
		if (status === "expired") {
			return (
				<Badge className="bg-muted/20 text-muted-foreground border-border">
					Expired
				</Badge>
			);
		}
		return (
			<Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
				{status}
			</Badge>
		);
	};

	const getSourceBadge = (source: string) => {
		if (source === "ai") {
			return (
				<Badge variant="outline" className="text-blue-400 border-blue-500/30">
					<Sparkles className="h-3 w-3 mr-1" />
					AI
				</Badge>
			);
		}
		if (source === "agent") {
			return (
				<Badge variant="outline" className="text-green-400 border-green-500/30">
					Agent
				</Badge>
			);
		}
		return (
			<Badge variant="outline" className="text-purple-400 border-purple-500/30">
				Hybrid
			</Badge>
		);
	};

	const getTimeAgo = (dateString: string) => {
		const days = differenceInDays(new Date(), new Date(dateString));
		if (days === 0) {
			const hours = differenceInHours(new Date(), new Date(dateString));
			return hours === 0 ? "Just now" : `${hours}h ago`;
		}
		return `${days}d ago`;
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
				<div>
					<h1
						className="text-2xl font-bold text-foreground"
						data-testid="heading-demo-proposals"
					>
						Demo Proposal Tracking
					</h1>
					<p className="text-muted-foreground mt-1">
						Track demo proposals and facilitate conversion to real investments
					</p>
				</div>
				<div className="flex gap-2">
					<Button
						variant="outline"
						onClick={() => refetch()}
						data-testid="button-refresh-demos"
					>
						<RefreshCw className="h-4 w-4 mr-2" />
						Refresh
					</Button>
					<Button variant="outline" data-testid="button-export-demos">
						<Download className="h-4 w-4 mr-2" />
						Export
					</Button>
				</div>
			</div>

			{/* Summary Cards */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<Card className="bg-background border-border">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Total Demo Proposals
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center justify-between">
							<div
								className="text-2xl font-bold text-foreground"
								data-testid="text-total-demos"
							>
								{calculatedStats.totalDemos}
							</div>
							<FileText className="h-8 w-8 text-blue-500" />
						</div>
						<p className="text-xs text-muted-foreground mt-2">
							Value: {formatCurrency(calculatedStats.totalDemoValue)}
						</p>
					</CardContent>
				</Card>

				<Card className="bg-background border-border">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Converted
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center justify-between">
							<div
								className="text-2xl font-bold text-green-400"
								data-testid="text-converted"
							>
								{calculatedStats.converted}
							</div>
							<CheckCircle2 className="h-8 w-8 text-green-500" />
						</div>
						<p className="text-xs text-muted-foreground mt-2">
							Value: {formatCurrency(calculatedStats.convertedValue)}
						</p>
					</CardContent>
				</Card>

				<Card className="bg-background border-border">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Conversion Rate
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center justify-between">
							<div
								className="text-2xl font-bold text-foreground"
								data-testid="text-conversion-rate"
							>
								{calculatedStats.conversionRate.toFixed(1)}%
							</div>
							<Target className="h-8 w-8 text-purple-500" />
						</div>
						<div className="flex items-center mt-2">
							<ArrowUpRight className="h-4 w-4 text-green-400 mr-1" />
							<span className="text-xs text-green-400">
								+5.2% vs last month
							</span>
						</div>
					</CardContent>
				</Card>

				<Card className="bg-background border-border">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Avg. Time to Convert
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center justify-between">
							<div
								className="text-2xl font-bold text-foreground"
								data-testid="text-avg-time"
							>
								{calculatedStats.avgTimeToConvert.toFixed(1)} days
							</div>
							<Clock className="h-8 w-8 text-amber-500" />
						</div>
						<p className="text-xs text-muted-foreground mt-2">
							Pending: {calculatedStats.pending} demos
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Charts */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<Card className="bg-background border-border">
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-foreground">
							<BarChart3 className="h-5 w-5" />
							Conversion Funnel
						</CardTitle>
						<CardDescription>Demo to conversion pipeline</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="h-[300px]">
							<ResponsiveContainer width="100%" height="100%">
								<BarChart data={funnelData} layout="vertical">
									<CartesianGrid strokeDasharray="3 3" stroke="#374151" />
									<XAxis type="number" tick={{ fill: "#9ca3af" }} />
									<YAxis
										dataKey="name"
										type="category"
										width={120}
										tick={{ fill: "#9ca3af" }}
									/>
									<Tooltip
										contentStyle={{
											backgroundColor: "#1e293b",
											border: "1px solid #334155",
											borderRadius: "8px",
										}}
										labelStyle={{ color: "#fff" }}
									/>
									<Bar dataKey="value" radius={[0, 4, 4, 0]}>
										{funnelData.map((entry, index) => (
											<Cell key={`cell-${index}`} fill={entry.fill} />
										))}
									</Bar>
								</BarChart>
							</ResponsiveContainer>
						</div>
					</CardContent>
				</Card>

				<Card className="bg-background border-border">
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-foreground">
							<Sparkles className="h-5 w-5" />
							Demo Source Distribution
						</CardTitle>
						<CardDescription>AI vs Agent generated demos</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="h-[300px]">
							<ResponsiveContainer width="100%" height="100%">
								<PieChart>
									<Pie
										data={sourceData}
										dataKey="value"
										nameKey="name"
										cx="50%"
										cy="50%"
										outerRadius={100}
										label={({ name, percent }) =>
											`${name}: ${(percent * 100).toFixed(0)}%`
										}
										labelLine={false}
									>
										{sourceData.map((entry, index) => (
											<Cell key={`cell-${index}`} fill={entry.fill} />
										))}
									</Pie>
									<Tooltip
										contentStyle={{
											backgroundColor: "#1e293b",
											border: "1px solid #334155",
											borderRadius: "8px",
										}}
										labelStyle={{ color: "#fff" }}
									/>
									<Legend wrapperStyle={{ color: "#9ca3af" }} />
								</PieChart>
							</ResponsiveContainer>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Demo Proposals Table */}
			<Card className="bg-background border-border">
				<CardHeader>
					<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
						<div>
							<CardTitle className="text-foreground">Demo Proposals</CardTitle>
							<CardDescription>
								All demo proposals with conversion status
							</CardDescription>
						</div>
						<div className="flex flex-wrap gap-2">
							<div className="relative">
								<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<Input
									placeholder="Search demos..."
									value={searchTerm}
									onChange={(e) => setSearchTerm(e.target.value)}
									className="pl-9 w-[200px] bg-card border-border"
									data-testid="input-search-demos"
								/>
							</div>
							<Select value={statusFilter} onValueChange={setStatusFilter}>
								<SelectTrigger
									className="w-[140px] bg-card border-border"
									data-testid="select-status-filter"
								>
									<SelectValue placeholder="Status" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Status</SelectItem>
									<SelectItem value="pending">Pending</SelectItem>
									<SelectItem value="converted">Converted</SelectItem>
									<SelectItem value="expired">Expired</SelectItem>
								</SelectContent>
							</Select>
							<Select value={sourceFilter} onValueChange={setSourceFilter}>
								<SelectTrigger
									className="w-[140px] bg-card border-border"
									data-testid="select-source-filter"
								>
									<SelectValue placeholder="Source" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Sources</SelectItem>
									<SelectItem value="ai">AI Generated</SelectItem>
									<SelectItem value="agent">Agent Created</SelectItem>
									<SelectItem value="hybrid">Hybrid</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<ScrollArea className="h-[500px]">
						<Table>
							<TableHeader>
								<TableRow className="border-border">
									<TableHead className="text-muted-foreground">
										Proposal
									</TableHead>
									<TableHead className="text-muted-foreground">
										Client
									</TableHead>
									<TableHead className="text-muted-foreground">Agent</TableHead>
									<TableHead className="text-muted-foreground">
										Source
									</TableHead>
									<TableHead className="text-muted-foreground text-right">
										Amount
									</TableHead>
									<TableHead className="text-muted-foreground text-center">
										Views
									</TableHead>
									<TableHead className="text-muted-foreground">
										Status
									</TableHead>
									<TableHead className="text-muted-foreground">
										Created
									</TableHead>
									<TableHead className="text-muted-foreground text-right">
										Actions
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{isLoading ? (
									<TableRow>
										<TableCell colSpan={9} className="text-center py-8">
											<Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-500" />
											<p className="mt-2 text-muted-foreground">
												Loading demo proposals...
											</p>
										</TableCell>
									</TableRow>
								) : filteredDemos.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={9}
											className="text-center py-8 text-muted-foreground"
										>
											No demo proposals found
										</TableCell>
									</TableRow>
								) : (
									filteredDemos.map((demo) => (
										<TableRow
											key={demo.id}
											className="border-border hover:bg-card/50"
										>
											<TableCell>
												<div>
													<div className="font-medium text-foreground">
														{demo.title}
													</div>
													<div className="text-xs text-muted-foreground">
														{demo.id}
													</div>
												</div>
											</TableCell>
											<TableCell>
												<div>
													<div className="text-foreground">
														{demo.clientName}
													</div>
													<div className="text-xs text-muted-foreground">
														{demo.clientEmail}
													</div>
												</div>
											</TableCell>
											<TableCell className="text-muted-foreground">
												{demo.agentName}
											</TableCell>
											<TableCell>
												{getSourceBadge(demo.proposalSource)}
											</TableCell>
											<TableCell className="text-right font-mono text-foreground">
												{formatCurrency(
													Number.parseFloat(demo.totalInvestmentAmount || "0"),
												)}
											</TableCell>
											<TableCell className="text-center">
												<div className="flex items-center justify-center gap-1">
													<Eye className="h-3 w-3 text-muted-foreground" />
													<span className="text-foreground">
														{demo.demoViewCount}
													</span>
												</div>
											</TableCell>
											<TableCell>
												{getStatusBadge(demo.status, demo.demoConvertedAt)}
											</TableCell>
											<TableCell className="text-muted-foreground">
												{getTimeAgo(demo.createdAt)}
											</TableCell>
											<TableCell className="text-right">
												{!demo.demoConvertedAt &&
													demo.status !== "converted" &&
													demo.status !== "expired" && (
														<Button
															size="sm"
															onClick={() =>
																setConvertDialog({ open: true, proposal: demo })
															}
															className="bg-green-600 hover:bg-green-700"
															data-testid={`button-convert-${demo.id}`}
														>
															<ArrowRight className="h-3 w-3 mr-1" />
															Convert
														</Button>
													)}
												{demo.demoConvertedAt && (
													<span className="text-xs text-green-400">
														Converted {getTimeAgo(demo.demoConvertedAt)}
													</span>
												)}
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</ScrollArea>
				</CardContent>
			</Card>

			{/* Convert Dialog */}
			<Dialog
				open={convertDialog.open}
				onOpenChange={(open) =>
					setConvertDialog({
						open,
						proposal: open ? convertDialog.proposal : null,
					})
				}
			>
				<DialogContent className="bg-background border-border">
					<DialogHeader>
						<DialogTitle className="text-foreground">
							Convert Demo to Investment
						</DialogTitle>
						<DialogDescription>
							This will convert the demo proposal to a real investment proposal
							and notify the client.
						</DialogDescription>
					</DialogHeader>

					{convertDialog.proposal && (
						<div className="space-y-4 py-4">
							<div className="grid grid-cols-2 gap-4 text-sm">
								<div>
									<span className="text-muted-foreground">Proposal:</span>
									<p className="text-foreground font-medium">
										{convertDialog.proposal.title}
									</p>
								</div>
								<div>
									<span className="text-muted-foreground">Client:</span>
									<p className="text-foreground font-medium">
										{convertDialog.proposal.clientName}
									</p>
								</div>
								<div>
									<span className="text-muted-foreground">
										Investment Amount:
									</span>
									<p className="text-foreground font-medium">
										{formatCurrency(
											Number.parseFloat(
												convertDialog.proposal.totalInvestmentAmount || "0",
											),
										)}
									</p>
								</div>
								<div>
									<span className="text-muted-foreground">Demo Views:</span>
									<p className="text-foreground font-medium">
										{convertDialog.proposal.demoViewCount}
									</p>
								</div>
							</div>
							<div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
								<p className="text-sm text-green-400">
									Converting this demo will mark it as a real investment
									proposal and enable payment processing.
								</p>
							</div>
						</div>
					)}

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setConvertDialog({ open: false, proposal: null })}
						>
							Cancel
						</Button>
						<Button
							onClick={() =>
								convertDialog.proposal &&
								convertMutation.mutate(convertDialog.proposal.id)
							}
							disabled={convertMutation.isPending}
							className="bg-green-600 hover:bg-green-700"
							data-testid="button-confirm-convert"
						>
							{convertMutation.isPending ? (
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
							) : (
								<CheckCircle2 className="h-4 w-4 mr-2" />
							)}
							Confirm Conversion
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
