import { AIAdvisoryDisclosure } from "@/components/regulatory/AIAdvisoryDisclosure";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Brain,
	TrendingUp,
	TrendingDown,
	RefreshCw,
	Calculator,
	Sparkles,
	Target,
	Clock,
	IndianRupee,
	Eye,
	X,
	ShoppingCart,
	Scale,
	Percent,
	ArrowUpRight,
	ArrowDownRight,
	ChevronDown,
	Filter,
	Zap,
	Star,
} from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { queryClient } from "@/lib/queryClient";

interface AIRecommendation {
	id: string;
	type: "buy" | "sell" | "hold" | "rebalance" | "tax_optimization";
	title: string;
	description: string;
	expectedBenefit: string;
	riskLevel: "low" | "medium" | "high";
	confidenceScore: number;
	priority: "high" | "medium" | "low";
	symbol?: string;
	sector?: string;
	reasoning: string;
}

const TYPE_CONFIG = {
	buy: {
		label: "Buy Signal",
		icon: TrendingUp,
		color:
			"bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
		iconColor: "text-emerald-600",
	},
	sell: {
		label: "Sell Signal",
		icon: TrendingDown,
		color:
			"bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
		iconColor: "text-red-600",
	},
	hold: {
		label: "Hold",
		icon: Target,
		color:
			"bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
		iconColor: "text-blue-600",
	},
	rebalance: {
		label: "Rebalance",
		icon: Scale,
		color:
			"bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
		iconColor: "text-purple-600",
	},
	tax_optimization: {
		label: "Tax Optimization",
		icon: Calculator,
		color:
			"bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
		iconColor: "text-amber-600",
	},
};

const RISK_CONFIG = {
	low: {
		label: "Low Risk",
		color:
			"bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
	},
	medium: {
		label: "Medium Risk",
		color:
			"bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
	},
	high: {
		label: "High Risk",
		color:
			"bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
	},
};

const PRIORITY_CONFIG = {
	high: {
		label: "High Priority",
		color:
			"bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
	},
	medium: {
		label: "Medium",
		color:
			"bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
	},
	low: { label: "Low", color: "bg-muted text-muted-foreground border-border" },
};

// Transform AI MF recommendations to display format
function transformMFRecommendation(
	mfRec: any,
	index: number,
): AIRecommendation {
	if (!mfRec) return null as any;

	const signal = mfRec.signal?.toLowerCase() || "hold";
	let type: AIRecommendation["type"] = "hold";
	let priority: AIRecommendation["priority"] = "medium";

	if (signal === "buy" || signal === "buy_more") {
		type = "buy";
		priority =
			mfRec.metrics?.fintekproRating &&
			Number(mfRec.metrics.fintekproRating) >= 4
				? "high"
				: "medium";
	} else if (signal === "exit" || signal === "switch") {
		type = "sell";
		priority = "high";
	}

	const expenseRatio = mfRec.metrics?.expenseRatio
		? Number.parseFloat(String(mfRec.metrics.expenseRatio))
		: 1;
	const riskLevel: AIRecommendation["riskLevel"] =
		expenseRatio > 2 ? "high" : expenseRatio > 1 ? "medium" : "low";

	const rating = Math.min(
		5,
		Math.max(1, Number(mfRec.metrics?.fintekproRating) || 3),
	);
	const stars = "★".repeat(rating) + "☆".repeat(5 - rating);

	// Safely parse CAGR as number
	const cagr1Y =
		mfRec.metrics?.cagr1Y != null
			? Number.parseFloat(String(mfRec.metrics.cagr1Y))
			: null;
	const expectedBenefit =
		cagr1Y != null && !Number.isNaN(cagr1Y)
			? `${cagr1Y > 0 ? "+" : ""}${cagr1Y.toFixed(1)}% 1Y returns`
			: "Diversification benefit";

	const schemeName = mfRec.schemeName || "Mutual Fund";
	const shortName = schemeName.split(" ").slice(0, 4).join(" ");

	return {
		id: `mf-${index}-${mfRec.schemeCode || Date.now()}`,
		type,
		title:
			type === "buy"
				? `Consider Adding ${shortName}`
				: type === "sell"
					? `Review ${shortName}`
					: `Hold ${shortName}`,
		description:
			mfRec.rationale ||
			"AI-powered mutual fund recommendation based on FintekPro analysis.",
		expectedBenefit,
		riskLevel,
		confidenceScore: Number(mfRec.confidence) || 75,
		priority,
		symbol: mfRec.schemeCode,
		sector: mfRec.category || "Mutual Fund",
		reasoning: `FintekPro Rating: ${stars}. ${mfRec.fundHouse || "Top AMC"}. Category: ${mfRec.category || "Diversified"}. ${expenseRatio ? `Expense Ratio: ${expenseRatio.toFixed(2)}%` : ""}`,
	};
}

export default function ClientAIRecommendations() {
	const [activeTab, setActiveTab] = useState("all");
	const [priorityFilter, setPriorityFilter] = useState<string>("all");
	const [dismissedIds, setDismissedIds] = useState<string[]>([]);

	// Fetch AI MF recommendations
	const {
		data: mfRecommendations,
		isLoading: isMFLoading,
		refetch: refetchMF,
	} = useQuery({
		queryKey: ["/api/ai-mf/recommendations"],
	});

	// Fetch commodity recommendations for diversification
	const { data: commodityRecs, isLoading: isCommodityLoading } = useQuery({
		queryKey: ["/api/ai-mf/commodity-fof"],
	});

	// Transform MF recommendations to display format
	const aiMFRecs: AIRecommendation[] = (
		(mfRecommendations as any)?.recommendations?.map((rec: any, i: number) =>
			transformMFRecommendation(rec, i),
		) || []
	).filter((rec: any) => rec !== null);

	// Add commodity recommendations as rebalance suggestions
	const commodityRebalanceRecs: AIRecommendation[] =
		(commodityRecs as any)?.recommendations
			?.slice(0, 2)
			.map((rec: any, i: number) => ({
				...transformMFRecommendation(rec, i + 100),
				type: "rebalance" as const,
				title: `Add Gold/Commodity Exposure`,
				description: `Consider ${rec.schemeName} for 5-10% portfolio allocation to protect against market volatility.`,
				expectedBenefit: "Downside protection",
				reasoning: `Gold/Commodity funds provide portfolio diversification and hedge against inflation. FintekPro recommends 5-10% allocation.`,
			})) || [];

	// Fetch tax optimization recommendations from API
	const { data: taxOptimizations } = useQuery({
		queryKey: ["/api/tax/loss-harvesting/opportunities"],
	});

	// Transform tax optimization data to recommendations format
	const taxOptRecs: AIRecommendation[] = (
		(taxOptimizations as any)?.opportunities || []
	).map((opp: any, i: number) => ({
		id: `tax-${i}-${opp.symbol || Date.now()}`,
		type: "tax_optimization" as const,
		title: opp.title || "Tax Optimization Opportunity",
		description:
			opp.description ||
			"AI-identified tax saving opportunity based on your portfolio.",
		expectedBenefit: opp.potentialSavings
			? `Save ₹${Number(opp.potentialSavings).toLocaleString("en-IN")}`
			: "Tax savings available",
		riskLevel: "low" as const,
		confidenceScore: opp.confidence || 85,
		priority: opp.priority || ("medium" as const),
		symbol: opp.symbol,
		sector: opp.sector || "Tax Planning",
		reasoning:
			opp.reasoning ||
			"AI analysis of your portfolio identified this tax optimization opportunity.",
	}));

	// Combine all AI-generated recommendations (no sample/mock data)
	const allRecommendations = [
		...aiMFRecs,
		...commodityRebalanceRecs,
		...taxOptRecs,
	];

	const isLoading = isMFLoading || isCommodityLoading;

	const activeRecommendations = allRecommendations.filter(
		(rec) => !dismissedIds.includes(rec.id),
	);

	const filteredRecommendations = activeRecommendations.filter((rec) => {
		const matchesTab =
			activeTab === "all" ||
			(activeTab === "buy" && rec.type === "buy") ||
			(activeTab === "sell" && rec.type === "sell") ||
			(activeTab === "rebalancing" && rec.type === "rebalance") ||
			(activeTab === "tax" && rec.type === "tax_optimization");

		const matchesPriority =
			priorityFilter === "all" || rec.priority === priorityFilter;

		return matchesTab && matchesPriority;
	});

	const stats = {
		total: activeRecommendations.length,
		highPriority: activeRecommendations.filter((r) => r.priority === "high")
			.length,
		potentialGains: activeRecommendations.filter(
			(r) => r.type === "buy" || r.type === "tax_optimization",
		).length,
		lastUpdated: new Date().toLocaleTimeString("en-IN", {
			hour: "2-digit",
			minute: "2-digit",
		}),
	};

	const handleDismiss = (id: string) => {
		setDismissedIds([...dismissedIds, id]);
	};

	const handleRefresh = () => {
		refetchMF();
		queryClient.invalidateQueries({ queryKey: ["/api/ai-mf/commodity-fof"] });
	};

	const getConfidenceColor = (score: number) => {
		if (score >= 90) return "text-emerald-600";
		if (score >= 75) return "text-blue-600";
		if (score >= 60) return "text-amber-600";
		return "text-muted-foreground";
	};

	return (
		<div
			className="min-h-screen bg-muted p-6"
			data-testid="client-ai-recommendations-page"
		>
			<div className="max-w-6xl mx-auto space-y-6">
				<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
					<div>
						<h1
							className="text-2xl font-bold text-foreground flex items-center gap-2"
							data-testid="text-page-title"
						>
							<Brain className="h-7 w-7 text-blue-600" />
							AI Investment Insights
						</h1>
						<p className="text-muted-foreground mt-1">
							Personalized investment recommendations based on your risk profile
							and portfolio
						</p>
					</div>
					<div className="flex items-center gap-2">
						<Badge
							className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
							data-testid="badge-ai-powered"
						>
							<Sparkles className="h-3 w-3 mr-1" />
							AI-Powered
						</Badge>
						<Button
							variant="outline"
							size="sm"
							className="border-border"
							data-testid="button-refresh"
						>
							<RefreshCw className="h-4 w-4 mr-1" />
							Refresh
						</Button>
					</div>
				</div>

				<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
					<Card
						className="bg-card border-border shadow-sm"
						data-testid="card-total-recommendations"
					>
						<CardContent className="p-4">
							<div className="flex items-center gap-3">
								<div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
									<Zap className="h-5 w-5 text-blue-600" />
								</div>
								<div>
									<p className="text-muted-foreground text-sm">
										Total Recommendations
									</p>
									<p
										className="text-2xl font-bold text-foreground"
										data-testid="text-total-count"
									>
										{stats.total}
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card
						className="bg-card border-border shadow-sm"
						data-testid="card-high-priority"
					>
						<CardContent className="p-4">
							<div className="flex items-center gap-3">
								<div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
									<Target className="h-5 w-5 text-red-600" />
								</div>
								<div>
									<p className="text-muted-foreground text-sm">High Priority</p>
									<p
										className="text-2xl font-bold text-foreground"
										data-testid="text-high-priority-count"
									>
										{stats.highPriority}
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card
						className="bg-card border-border shadow-sm"
						data-testid="card-potential-gains"
					>
						<CardContent className="p-4">
							<div className="flex items-center gap-3">
								<div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
									<ArrowUpRight className="h-5 w-5 text-emerald-600" />
								</div>
								<div>
									<p className="text-muted-foreground text-sm">
										Potential Gains
									</p>
									<p
										className="text-2xl font-bold text-foreground"
										data-testid="text-gains-count"
									>
										{stats.potentialGains}
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card
						className="bg-card border-border shadow-sm"
						data-testid="card-last-updated"
					>
						<CardContent className="p-4">
							<div className="flex items-center gap-3">
								<div className="p-2 rounded-lg bg-muted">
									<Clock className="h-5 w-5 text-muted-foreground" />
								</div>
								<div>
									<p className="text-muted-foreground text-sm">Last Updated</p>
									<p
										className="text-sm font-medium text-foreground"
										data-testid="text-last-updated"
									>
										{stats.lastUpdated}
									</p>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>

				<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
					<Tabs
						value={activeTab}
						onValueChange={setActiveTab}
						className="w-full md:w-auto"
					>
						<TabsList className="bg-card border border-border shadow-sm">
							<TabsTrigger
								value="all"
								className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
								data-testid="tab-all"
							>
								All
							</TabsTrigger>
							<TabsTrigger
								value="buy"
								className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
								data-testid="tab-buy"
							>
								Buy Signals
							</TabsTrigger>
							<TabsTrigger
								value="sell"
								className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
								data-testid="tab-sell"
							>
								Sell Signals
							</TabsTrigger>
							<TabsTrigger
								value="rebalancing"
								className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
								data-testid="tab-rebalancing"
							>
								Rebalancing
							</TabsTrigger>
							<TabsTrigger
								value="tax"
								className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
								data-testid="tab-tax"
							>
								Tax Optimization
							</TabsTrigger>
						</TabsList>
					</Tabs>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="outline"
								className="border-border"
								data-testid="button-priority-filter"
							>
								<Filter className="h-4 w-4 mr-2" />
								Priority:{" "}
								{priorityFilter === "all"
									? "All"
									: priorityFilter.charAt(0).toUpperCase() +
										priorityFilter.slice(1)}
								<ChevronDown className="h-4 w-4 ml-2" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem
								onClick={() => setPriorityFilter("all")}
								data-testid="filter-all"
							>
								All Priorities
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => setPriorityFilter("high")}
								data-testid="filter-high"
							>
								High Priority
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => setPriorityFilter("medium")}
								data-testid="filter-medium"
							>
								Medium Priority
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => setPriorityFilter("low")}
								data-testid="filter-low"
							>
								Low Priority
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				<Card className="bg-card border-border shadow-sm">
					<CardContent className="p-0">
						<ScrollArea className="h-[600px]">
							<div className="divide-y divide-gray-100">
								{filteredRecommendations.length === 0 ? (
									<div className="p-8 text-center">
										<Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
										<p className="text-muted-foreground">
											No recommendations found for this filter
										</p>
									</div>
								) : (
									filteredRecommendations.map((rec) => {
										const typeConfig = TYPE_CONFIG[rec.type];
										const Icon = typeConfig.icon;
										return (
											<div
												key={rec.id}
												className="p-5 hover:bg-muted transition-colors"
												data-testid={`recommendation-card-${rec.id}`}
											>
												<div className="flex items-start gap-4">
													<div
														className={`p-3 rounded-lg border ${typeConfig.color}`}
													>
														<Icon
															className={`h-6 w-6 ${typeConfig.iconColor}`}
														/>
													</div>
													<div className="flex-1 min-w-0">
														<div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
															<div className="flex-1">
																<div className="flex items-center gap-2 flex-wrap mb-2">
																	<h3
																		className="font-semibold text-foreground"
																		data-testid={`rec-title-${rec.id}`}
																	>
																		{rec.title}
																	</h3>
																	<Badge
																		variant="outline"
																		className={typeConfig.color}
																		data-testid={`rec-type-${rec.id}`}
																	>
																		{typeConfig.label}
																	</Badge>
																	{rec.symbol && (
																		<Badge
																			variant="outline"
																			className="bg-muted text-muted-foreground border-border"
																			data-testid={`rec-symbol-${rec.id}`}
																		>
																			{rec.symbol}
																		</Badge>
																	)}
																</div>
																<p
																	className="text-muted-foreground text-sm mb-3"
																	data-testid={`rec-description-${rec.id}`}
																>
																	{rec.description}
																</p>

																<div className="flex items-center gap-4 flex-wrap mb-3">
																	<div className="flex items-center gap-1">
																		{rec.type === "buy" ||
																		rec.type === "tax_optimization" ? (
																			<ArrowUpRight className="h-4 w-4 text-emerald-600" />
																		) : rec.type === "sell" ? (
																			<ArrowDownRight className="h-4 w-4 text-red-600" />
																		) : (
																			<Target className="h-4 w-4 text-blue-600" />
																		)}
																		<span
																			className={`text-sm font-medium ${
																				rec.type === "buy" ||
																				rec.type === "tax_optimization"
																					? "text-emerald-600"
																					: rec.type === "sell"
																						? "text-red-600"
																						: "text-blue-600"
																			}`}
																			data-testid={`rec-benefit-${rec.id}`}
																		>
																			{rec.expectedBenefit}
																		</span>
																	</div>
																	<Badge
																		variant="outline"
																		className={RISK_CONFIG[rec.riskLevel].color}
																		data-testid={`rec-risk-${rec.id}`}
																	>
																		{RISK_CONFIG[rec.riskLevel].label}
																	</Badge>
																	<div className="flex items-center gap-1">
																		<Percent className="h-4 w-4 text-muted-foreground" />
																		<span
																			className={`text-sm font-medium ${getConfidenceColor(rec.confidenceScore)}`}
																			data-testid={`rec-confidence-${rec.id}`}
																		>
																			{rec.confidenceScore}% AI Confidence
																		</span>
																	</div>
																</div>

																<div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-800 mb-3">
																	<div className="flex items-start gap-2">
																		<Sparkles className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
																		<div>
																			<p className="text-blue-700 dark:text-blue-300 text-xs font-medium">
																				AI Analysis
																			</p>
																			<p
																				className="text-blue-600 text-sm mt-0.5"
																				data-testid={`rec-reasoning-${rec.id}`}
																			>
																				{rec.reasoning}
																			</p>
																		</div>
																	</div>
																</div>

																<div className="flex items-center gap-2 flex-wrap">
																	<Badge
																		variant="outline"
																		className={
																			PRIORITY_CONFIG[rec.priority].color
																		}
																		data-testid={`rec-priority-${rec.id}`}
																	>
																		{PRIORITY_CONFIG[rec.priority].label}
																	</Badge>
																	{rec.sector && (
																		<Badge
																			variant="outline"
																			className="bg-muted text-muted-foreground border-border"
																		>
																			{rec.sector}
																		</Badge>
																	)}
																</div>
															</div>

															<div className="flex items-center gap-2 flex-shrink-0 lg:flex-col lg:items-end">
																<Button
																	size="sm"
																	className="bg-blue-600 hover:bg-blue-700 text-white"
																	data-testid={`button-view-details-${rec.id}`}
																>
																	<Eye className="h-4 w-4 mr-1" />
																	View Details
																</Button>
																<Button
																	size="sm"
																	variant="outline"
																	className="border-border text-muted-foreground hover:bg-muted"
																	onClick={() => handleDismiss(rec.id)}
																	data-testid={`button-dismiss-${rec.id}`}
																>
																	<X className="h-4 w-4 mr-1" />
																	Dismiss
																</Button>
															</div>
														</div>
													</div>
												</div>
											</div>
										);
									})
								)}
							</div>
						</ScrollArea>
					</CardContent>
				</Card>

				<Card className="bg-gradient-to-r from-blue-50 dark:from-blue-950/30 to-indigo-50 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
					<CardContent className="p-6">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-3">
								<div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
									<Brain className="h-5 w-5 text-blue-600" />
								</div>
								<div>
									<h3 className="font-semibold text-foreground mb-1">
										How AI Recommendations Work
									</h3>
									<p className="text-muted-foreground text-sm">
										Our AI analyzes your portfolio, risk profile, market trends,
										and tax situation to provide personalized suggestions.
									</p>
								</div>
							</div>
							<Button
								variant="outline"
								className="border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:bg-blue-900/30"
								data-testid="button-learn-more"
							>
								Learn More
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
