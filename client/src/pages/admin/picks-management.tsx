import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
	Loader2,
	TrendingUp,
	Target,
	BarChart3,
	Clock,
	RefreshCw,
	CheckCircle,
	XCircle,
	AlertTriangle,
	Zap,
	Calendar,
} from "lucide-react";
import { format } from "date-fns";
import { AdminLayout } from "@/components/layout/admin-layout";
import { queryClient } from "@/lib/queryClient";

const CATEGORIES = [
	{ value: "all", label: "All Categories" },
	{ value: "listed_stocks", label: "Listed Stocks" },
	{ value: "mutual_funds", label: "Mutual Funds" },
	{ value: "bonds", label: "Bonds" },
	{ value: "unlisted", label: "Unlisted Companies" },
	{ value: "global_stocks", label: "Global Stocks" },
	{ value: "etfs", label: "ETFs" },
	{ value: "reits_invits", label: "REITs/InvITs" },
	{ value: "fixed_deposits", label: "Fixed Deposits" },
	{ value: "sgb", label: "SGBs" },
	{ value: "derivatives", label: "Derivatives" },
];

const STATUSES = [
	{ value: "all", label: "All Statuses" },
	{ value: "live", label: "Live" },
	{ value: "target_hit", label: "Target Hit" },
	{ value: "stoploss_hit", label: "Stoploss Hit" },
	{ value: "expired", label: "Expired" },
];

interface DailyPick {
	id: number;
	category: string;
	instrumentId: string;
	instrumentName: string;
	isin?: string;
	symbol?: string;
	recoDate: string;
	recoPrice: string;
	targetPrice: string;
	stoplossPrice: string;
	currentPrice?: string;
	status: string;
	expiryDate: string;
	returnPct?: string;
	daysHeld?: number;
	rationale: string;
	riskLevel: string;
	suitableFor?: string[];
	timeHorizon?: string;
	confidenceScore?: number;
	sectorCategory?: string;
	generatedBy: string;
	createdAt: string;
}

function getStatusBadge(status: string) {
	switch (status) {
		case "live":
			return (
				<Badge className="bg-green-500">
					<Clock className="h-3 w-3 mr-1" />
					Live
				</Badge>
			);
		case "target_hit":
			return (
				<Badge className="bg-blue-500">
					<CheckCircle className="h-3 w-3 mr-1" />
					Target Hit
				</Badge>
			);
		case "stoploss_hit":
			return (
				<Badge variant="destructive">
					<XCircle className="h-3 w-3 mr-1" />
					Stoploss Hit
				</Badge>
			);
		case "expired":
			return (
				<Badge variant="secondary">
					<AlertTriangle className="h-3 w-3 mr-1" />
					Expired
				</Badge>
			);
		default:
			return <Badge variant="outline">{status}</Badge>;
	}
}

export default function PicksMonitor() {
	const [categoryFilter, setCategoryFilter] = useState("all");
	const [statusFilter, setStatusFilter] = useState("all");

	const {
		data: picksData,
		isLoading,
		refetch,
		dataUpdatedAt,
	} = useQuery<{ success: boolean; picks: DailyPick[] }>({
		queryKey: ["/api/picks/admin/list", categoryFilter, statusFilter],
		queryFn: async () => {
			const params = new URLSearchParams();
			if (categoryFilter !== "all") params.set("category", categoryFilter);
			if (statusFilter !== "all") params.set("status", statusFilter);
			params.set("limit", "200");
			const res = await fetch(`/api/picks/admin/list?${params}`);
			return res.json();
		},
		refetchInterval: 5 * 60 * 1000, // auto-refresh every 5 minutes
	});

	const { data: statsData } = useQuery<{ success: boolean; stats: any }>({
		queryKey: ["/api/picks/stats"],
		refetchInterval: 5 * 60 * 1000,
	});

	const picks = picksData?.picks || [];
	const stats = statsData?.stats;

	// Compute today's IST date client-side for display
	const todayIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
		.toISOString()
		.split("T")[0];
	const todayPicks = picks.filter((p) => p.recoDate === todayIST);
	const todayCategoryCount = new Set(todayPicks.map((p) => p.category)).size;

	return (
		<AdminLayout>
			<div className="p-6 space-y-6">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-3xl font-bold">Pick of the Day — Monitor</h1>
						<p className="text-muted-foreground mt-1">
							Fully automated. Generation runs at{" "}
							<span className="font-medium">9:00 AM IST</span> daily. Price
							refresh at <span className="font-medium">12:30 PM</span> and{" "}
							<span className="font-medium">4:00 PM IST</span>. Auto-heal every
							6 hours.
						</p>
					</div>
					<div className="flex items-center gap-3">
						<div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
							<Zap className="h-4 w-4 text-green-600 dark:text-green-400" />
							<span className="text-sm font-medium text-green-700 dark:text-green-300">
								Fully Automated
							</span>
						</div>
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								refetch();
								queryClient.invalidateQueries({
									queryKey: ["/api/picks/stats"],
								});
							}}
						>
							<RefreshCw className="h-4 w-4 mr-2" />
							Refresh
						</Button>
					</div>
				</div>

				{/* Automation Status Banner */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800">
						<CardContent className="pt-5 pb-4">
							<div className="flex items-center gap-3">
								<Calendar className="h-8 w-8 text-blue-600 dark:text-blue-400" />
								<div>
									<div className="text-sm text-blue-700 dark:text-blue-300 font-medium">
										Today's Picks ({todayIST})
									</div>
									<div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
										{todayPicks.length}
									</div>
									<div className="text-xs text-blue-600 dark:text-blue-400">
										{todayCategoryCount} categories covered
									</div>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border-emerald-200 dark:border-emerald-800">
						<CardContent className="pt-5 pb-4">
							<div className="flex items-center gap-3">
								<TrendingUp className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
								<div>
									<div className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
										Live Picks (all time)
									</div>
									<div className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
										{stats?.livePicks ?? "—"}
									</div>
									<div className="text-xs text-emerald-600 dark:text-emerald-400">
										{stats?.totalPicks ?? 0} total generated
									</div>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-800">
						<CardContent className="pt-5 pb-4">
							<div className="flex items-center gap-3">
								<Target className="h-8 w-8 text-purple-600 dark:text-purple-400" />
								<div>
									<div className="text-sm text-purple-700 dark:text-purple-300 font-medium">
										Hit Rate
									</div>
									<div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
										{stats?.hitRate != null
											? `${stats.hitRate.toFixed(1)}%`
											: "—"}
									</div>
									<div className="text-xs text-purple-600 dark:text-purple-400">
										Avg return:{" "}
										{stats?.avgReturn != null
											? `${stats.avgReturn.toFixed(1)}%`
											: "—"}
									</div>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Per-Category breakdown */}
				{stats?.byCategory && Object.keys(stats.byCategory).length > 0 && (
					<Card>
						<CardHeader>
							<CardTitle className="text-base flex items-center gap-2">
								<BarChart3 className="h-4 w-4" />
								Category Performance
							</CardTitle>
							<CardDescription>
								Historical hit rate and average return per instrument category
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
								{Object.entries(
									stats.byCategory as Record<
										string,
										{
											total: number;
											hits: number;
											hitRate: number;
											avgReturn: number;
										}
									>,
								).map(([cat, s]) => (
									<div key={cat} className="p-3 rounded-lg border bg-muted/30">
										<div className="text-xs font-medium text-muted-foreground capitalize mb-1">
											{cat.replace("_", " ")}
										</div>
										<div className="text-sm font-bold">
											{s.hitRate.toFixed(0)}% hit rate
										</div>
										<div className="text-xs text-muted-foreground">
											{s.total} picks • avg {s.avgReturn.toFixed(1)}%
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				)}

				{/* Picks Table — Read-only */}
				<Card>
					<CardHeader>
						<div className="flex items-center justify-between">
							<div>
								<CardTitle>All Picks</CardTitle>
								<CardDescription>
									Read-only view — picks are generated automatically by the AI
									engine
									{dataUpdatedAt
										? ` · Last refreshed ${format(new Date(dataUpdatedAt), "HH:mm:ss")}`
										: ""}
								</CardDescription>
							</div>
							<div className="flex gap-2">
								<Select
									value={categoryFilter}
									onValueChange={setCategoryFilter}
								>
									<SelectTrigger className="w-[180px]">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{CATEGORIES.map((cat) => (
											<SelectItem key={cat.value} value={cat.value}>
												{cat.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<Select value={statusFilter} onValueChange={setStatusFilter}>
									<SelectTrigger className="w-[150px]">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{STATUSES.map((s) => (
											<SelectItem key={s.value} value={s.value}>
												{s.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
					</CardHeader>
					<CardContent>
						{isLoading ? (
							<div className="flex items-center justify-center py-12">
								<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
								<span className="ml-3 text-muted-foreground">
									Loading picks...
								</span>
							</div>
						) : picks.length === 0 ? (
							<div className="text-center py-12">
								<Zap className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
								<p className="text-muted-foreground font-medium">
									No picks found for the selected filters.
								</p>
								<p className="text-sm text-muted-foreground mt-1">
									The engine generates picks automatically at 9:00 AM IST.
								</p>
							</div>
						) : (
							<ScrollArea className="h-[520px]">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Instrument</TableHead>
											<TableHead>Category</TableHead>
											<TableHead>Sector</TableHead>
											<TableHead>Date</TableHead>
											<TableHead>Horizon</TableHead>
											<TableHead>Confidence</TableHead>
											<TableHead className="text-right">Reco Price</TableHead>
											<TableHead className="text-right">Target</TableHead>
											<TableHead className="text-right">Stoploss</TableHead>
											<TableHead className="text-right">Return %</TableHead>
											<TableHead>Status</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{picks.map((pick) => (
											<TableRow key={pick.id}>
												<TableCell>
													<div>
														<div className="font-medium text-sm">
															{pick.instrumentName}
														</div>
														<div className="text-xs text-muted-foreground">
															{pick.symbol || pick.isin || "—"}
														</div>
													</div>
												</TableCell>
												<TableCell>
													<Badge variant="outline" className="text-xs">
														{CATEGORIES.find((c) => c.value === pick.category)
															?.label || pick.category}
													</Badge>
												</TableCell>
												<TableCell>
													<span className="text-xs text-muted-foreground">
														{pick.sectorCategory || "—"}
													</span>
												</TableCell>
												<TableCell className="text-sm">
													{format(new Date(pick.recoDate), "d MMM yy")}
												</TableCell>
												<TableCell>
													<Badge variant="secondary" className="text-xs">
														{(pick.timeHorizon || "medium_term").replace(
															"_",
															" ",
														)}
													</Badge>
												</TableCell>
												<TableCell>
													<div className="flex items-center gap-1.5">
														<div
															className={`w-2 h-2 rounded-full ${
																(pick.confidenceScore || 70) >= 80
																	? "bg-green-500"
																	: (pick.confidenceScore || 70) >= 60
																		? "bg-yellow-500"
																		: "bg-red-500"
															}`}
														/>
														<span className="text-sm">
															{pick.confidenceScore || 70}%
														</span>
													</div>
												</TableCell>
												<TableCell className="text-right font-medium text-sm">
													₹
													{Number.parseFloat(pick.recoPrice).toLocaleString(
														"en-IN",
													)}
												</TableCell>
												<TableCell className="text-right text-green-600 text-sm">
													₹
													{Number.parseFloat(pick.targetPrice).toLocaleString(
														"en-IN",
													)}
												</TableCell>
												<TableCell className="text-right text-red-500 text-sm">
													₹
													{Number.parseFloat(pick.stoplossPrice).toLocaleString(
														"en-IN",
													)}
												</TableCell>
												<TableCell className="text-right">
													{pick.returnPct != null && pick.returnPct !== "" ? (
														<span
															className={`text-sm font-medium ${Number.parseFloat(pick.returnPct) >= 0 ? "text-green-600" : "text-red-500"}`}
														>
															{Number.parseFloat(pick.returnPct) >= 0
																? "+"
																: ""}
															{Number.parseFloat(pick.returnPct).toFixed(2)}%
														</span>
													) : (
														<span className="text-muted-foreground text-xs">
															—
														</span>
													)}
												</TableCell>
												<TableCell>{getStatusBadge(pick.status)}</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</ScrollArea>
						)}
					</CardContent>
				</Card>
			</div>
		</AdminLayout>
	);
}
