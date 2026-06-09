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
	Target,
	Clock,
	CheckCircle2,
	Eye,
	ArrowRight,
	Search,
	RefreshCw,
	BarChart3,
	ArrowUpRight,
	Loader2,
	Sparkles,
	Users,
	Plus,
} from "lucide-react";
import { Link } from "wouter";
import {
	BarChart,
	Bar,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
	Cell,
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

export default function AgentDemoProgress() {
	const { toast } = useToast();
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState("all");
	const [convertDialog, setConvertDialog] = useState<{
		open: boolean;
		proposal: DemoProposal | null;
	}>({ open: false, proposal: null });

	// Fetch agent's demo proposals
	const {
		data: demoProposals = [],
		isLoading,
		refetch,
	} = useQuery<DemoProposal[]>({
		queryKey: ["/api/agent/demo-proposals"],
	});

	// Fetch agent's demo stats
	const { data: stats } = useQuery<DemoStats>({
		queryKey: ["/api/agent/demo-proposals/stats"],
	});

	// Convert demo mutation
	const convertMutation = useMutation({
		mutationFn: (proposalId: string) =>
			apiRequest(`/api/agent/demo-proposals/${proposalId}/convert`, {
				method: "POST",
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/agent/demo-proposals"],
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/agent/demo-proposals/stats"],
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

	// Calculate stats
	const calculatedStats: DemoStats = stats || {
		totalDemos: demos.length,
		converted: demos.filter(
			(d) => d.status === "converted" || d.demoConvertedAt,
		).length,
		pending: demos.filter((d) => d.status === "pending" && !d.demoConvertedAt)
			.length,
		conversionRate:
			(demos.filter((d) => d.status === "converted" || d.demoConvertedAt)
				.length /
				Math.max(demos.length, 1)) *
			100,
		avgTimeToConvert: 4.5,
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
			demo.title?.toLowerCase().includes(searchTerm.toLowerCase());
		const matchesStatus =
			statusFilter === "all" ||
			demo.status === statusFilter ||
			(statusFilter === "converted" && demo.demoConvertedAt);
		return matchesSearch && matchesStatus;
	});

	// Chart data
	const statusData = [
		{ name: "Pending", value: calculatedStats.pending, fill: "#3b82f6" },
		{ name: "Converted", value: calculatedStats.converted, fill: "#10b981" },
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
		return (
			<Badge variant="outline" className="text-green-400 border-green-500/30">
				Manual
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
		<div className="space-y-6 p-6">
			<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
				<div>
					<h1
						className="text-2xl font-bold text-foreground"
						data-testid="heading-demo-progress"
					>
						My Demo Progress
					</h1>
					<p className="text-muted-foreground mt-1">
						Track your demo proposals and conversion performance
					</p>
				</div>
				<div className="flex gap-2">
					<Link href="/proposal-builder">
						<Button
							className="bg-purple-600 hover:bg-purple-700"
							data-testid="button-create-proposal"
						>
							<Plus className="h-4 w-4 mr-2" />
							Create Proposal
						</Button>
					</Link>
					<Button
						variant="outline"
						onClick={() => refetch()}
						data-testid="button-refresh"
					>
						<RefreshCw className="h-4 w-4 mr-2" />
						Refresh
					</Button>
				</div>
			</div>

			{/* Summary Cards */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<Card className="bg-background border-border">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							My Demos
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
							<span className="text-xs text-green-400">Great progress!</span>
						</div>
					</CardContent>
				</Card>

				<Card className="bg-background border-border">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Pending Actions
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center justify-between">
							<div
								className="text-2xl font-bold text-amber-400"
								data-testid="text-pending"
							>
								{calculatedStats.pending}
							</div>
							<Clock className="h-8 w-8 text-amber-500" />
						</div>
						<p className="text-xs text-muted-foreground mt-2">
							Follow up to convert
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Performance Chart */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<Card className="bg-background border-border lg:col-span-1">
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-foreground">
							<BarChart3 className="h-5 w-5" />
							Status Overview
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="h-[200px]">
							<ResponsiveContainer width="100%" height="100%">
								<PieChart>
									<Pie
										data={statusData}
										dataKey="value"
										nameKey="name"
										cx="50%"
										cy="50%"
										outerRadius={70}
										label={({ name, value }) => `${name}: ${value}`}
									>
										{statusData.map((entry, index) => (
											<Cell key={`cell-${index}`} fill={entry.fill} />
										))}
									</Pie>
									<Tooltip
										contentStyle={{
											backgroundColor: "#1e293b",
											border: "1px solid #334155",
											borderRadius: "8px",
										}}
									/>
									<Legend wrapperStyle={{ color: "#9ca3af" }} />
								</PieChart>
							</ResponsiveContainer>
						</div>
					</CardContent>
				</Card>

				{/* Demo Proposals Table */}
				<Card className="bg-background border-border lg:col-span-2">
					<CardHeader>
						<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
							<div>
								<CardTitle className="text-foreground">
									My Demo Proposals
								</CardTitle>
								<CardDescription>
									Track engagement and convert demos to investments
								</CardDescription>
							</div>
							<div className="flex gap-2">
								<div className="relative">
									<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
									<Input
										placeholder="Search..."
										value={searchTerm}
										onChange={(e) => setSearchTerm(e.target.value)}
										className="pl-9 w-[150px] bg-card border-border"
										data-testid="input-search"
									/>
								</div>
								<Select value={statusFilter} onValueChange={setStatusFilter}>
									<SelectTrigger
										className="w-[120px] bg-card border-border"
										data-testid="select-status"
									>
										<SelectValue placeholder="Status" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All</SelectItem>
										<SelectItem value="pending">Pending</SelectItem>
										<SelectItem value="converted">Converted</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>
					</CardHeader>
					<CardContent>
						<ScrollArea className="h-[300px]">
							<Table>
								<TableHeader>
									<TableRow className="border-border">
										<TableHead className="text-muted-foreground">
											Client
										</TableHead>
										<TableHead className="text-muted-foreground">
											Proposal
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
										<TableHead className="text-muted-foreground text-right">
											Action
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{isLoading ? (
										<TableRow>
											<TableCell colSpan={6} className="text-center py-8">
												<Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-500" />
											</TableCell>
										</TableRow>
									) : filteredDemos.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={6}
												className="text-center py-8 text-muted-foreground"
											>
												No demos found
											</TableCell>
										</TableRow>
									) : (
										filteredDemos.map((demo) => (
											<TableRow
												key={demo.id}
												className="border-border hover:bg-card/50"
											>
												<TableCell>
													<div className="flex items-center gap-2">
														<Users className="h-4 w-4 text-muted-foreground" />
														<span className="text-foreground">
															{demo.clientName}
														</span>
													</div>
												</TableCell>
												<TableCell>
													<div>
														<div className="text-foreground text-sm">
															{demo.title}
														</div>
														<div className="text-xs text-muted-foreground">
															{getTimeAgo(demo.createdAt)}
														</div>
													</div>
												</TableCell>
												<TableCell className="text-right font-mono text-foreground">
													{formatCurrency(
														Number.parseFloat(
															demo.totalInvestmentAmount || "0",
														),
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
												<TableCell className="text-right">
													{!demo.demoConvertedAt &&
														demo.status !== "converted" && (
															<Button
																size="sm"
																onClick={() =>
																	setConvertDialog({
																		open: true,
																		proposal: demo,
																	})
																}
																className="bg-green-600 hover:bg-green-700"
																data-testid={`button-convert-${demo.id}`}
															>
																<ArrowRight className="h-3 w-3 mr-1" />
																Convert
															</Button>
														)}
													{demo.demoConvertedAt && (
														<span className="text-xs text-green-400">Done</span>
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
			</div>

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
							This will convert the demo to a real investment proposal.
						</DialogDescription>
					</DialogHeader>

					{convertDialog.proposal && (
						<div className="space-y-4 py-4">
							<div className="grid grid-cols-2 gap-4 text-sm">
								<div>
									<span className="text-muted-foreground">Client:</span>
									<p className="text-foreground font-medium">
										{convertDialog.proposal.clientName}
									</p>
								</div>
								<div>
									<span className="text-muted-foreground">Amount:</span>
									<p className="text-foreground font-medium">
										{formatCurrency(
											Number.parseFloat(
												convertDialog.proposal.totalInvestmentAmount || "0",
											),
										)}
									</p>
								</div>
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
							Convert
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
