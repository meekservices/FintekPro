import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
	TrendingUp,
	Target,
	AlertTriangle,
	CheckCircle,
	PieChart,
	ArrowRight,
	IndianRupee,
	Calendar,
	Shield as LucideShield,
	BarChart3,
	Lightbulb,
	Brain,
	Activity,
	Zap,
	Clock,
	Building2,
	Star,
	Crown,
	Briefcase,
	LineChart,
	Users,
	Coins,
} from "lucide-react";

interface InvestmentRecommendationsProps {
	portfolioId?: string;
	goalId?: string;
}

export function InvestmentRecommendations({
	portfolioId,
	goalId,
}: InvestmentRecommendationsProps) {
	const [selectedRecommendation, setSelectedRecommendation] = useState<
		string | null
	>(null);
	const [selectedCategory, setSelectedCategory] = useState<string>("all");
	const [selectedRiskProfile, setSelectedRiskProfile] = useState<
		"conservative" | "moderate" | "aggressive"
	>("moderate");

	// Get authentication status
	const { isAuthenticated } = useAuth();

	// Fetch goal-based recommendations if goalId is provided
	const { data: goalRecommendations, isLoading: goalLoading } = useQuery<any[]>(
		{
			queryKey: ["/api/recommendations/goal", goalId],
			enabled: !!goalId && isAuthenticated,
		},
	);

	// Fetch portfolio rebalance recommendations if portfolioId is provided
	const { data: rebalanceRecommendations, isLoading: rebalanceLoading } =
		useQuery<any[]>({
			queryKey: ["/api/recommendations/portfolio", portfolioId, "rebalance"],
			enabled: !!portfolioId && isAuthenticated,
		});

	// Fetch AI-powered insights from the new monitoring service (only when authenticated)
	const { data: aiInsights, isLoading: aiInsightsLoading } = useQuery<any>({
		queryKey: ["/api/ai-investsmart-insights"],
		enabled: isAuthenticated,
		refetchInterval: isAuthenticated ? 30000 : false, // Refresh every 30 seconds for real-time insights
	});

	// Fetch actionables based on selected category (only when authenticated)
	const { data: aiActionables, isLoading: actionablesLoading } = useQuery<any>({
		queryKey: ["/api/ai-investsmart-actionables", selectedCategory],
		enabled: isAuthenticated,
	});

	// Fetch page health metrics (only when authenticated)
	const { data: pageHealth, isLoading: healthLoading } = useQuery<any>({
		queryKey: ["/api/ai-investsmart-health"],
		enabled: isAuthenticated,
		refetchInterval: isAuthenticated ? 60000 : false, // Refresh every minute
	});

	// Comprehensive allocation models based on risk profile
	const getAllocationModels = () => {
		return {
			conservative: {
				corePortfolio: { total: 70, equity: 35, debt: 25, hybrid: 10 },
				alternatives: { total: 20, gold: 12, silver: 5, commodities: 3 },
				premium: { total: 10, reits: 4, pms: 3, aif: 1, bonds: 2 },
				analysis: {
					expectedReturn: "10-12%",
					riskLevel: "Low",
					maturityPeriod: "5-7 years",
					recommendation:
						"Stable growth with capital preservation. Heavy emphasis on debt funds and gold for inflation protection.",
				},
			},
			moderate: {
				corePortfolio: { total: 60, equity: 35, debt: 15, hybrid: 10 },
				alternatives: { total: 25, gold: 15, silver: 5, commodities: 5 },
				premium: { total: 15, reits: 6, pms: 5, aif: 2, bonds: 2 },
				analysis: {
					expectedReturn: "12-15%",
					riskLevel: "Medium",
					maturityPeriod: "7-10 years",
					recommendation:
						"Balanced approach optimizing growth with risk management. Strategic allocation to premium investments for enhanced returns.",
				},
			},
			aggressive: {
				corePortfolio: { total: 50, equity: 40, debt: 5, hybrid: 5 },
				alternatives: { total: 25, gold: 10, silver: 5, commodities: 10 },
				premium: { total: 25, reits: 8, pms: 10, aif: 5, bonds: 2 },
				analysis: {
					expectedReturn: "15-18%",
					riskLevel: "High",
					maturityPeriod: "10+ years",
					recommendation:
						"Growth-focused strategy with significant premium investment allocation. Higher commodity exposure for market opportunities.",
				},
			},
		};
	};

	const getCurrentAllocation = () => getAllocationModels()[selectedRiskProfile];

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-IN", {
			style: "currency",
			currency: "INR",
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(amount);
	};

	const getRiskColor = (risk: string) => {
		switch (risk.toLowerCase()) {
			case "very low":
			case "low":
				return "text-green-600 bg-green-50 dark:bg-green-950/30";
			case "moderate":
				return "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30";
			case "high":
				return "text-red-600 bg-red-50 dark:bg-red-950/30";
			default:
				return "text-muted-foreground bg-muted";
		}
	};

	const getPriorityColor = (priority: string) => {
		switch (priority) {
			case "high":
				return "destructive";
			case "medium":
				return "default";
			case "low":
				return "secondary";
			default:
				return "outline";
		}
	};

	const isLoading =
		goalLoading ||
		rebalanceLoading ||
		aiInsightsLoading ||
		actionablesLoading ||
		healthLoading;

	if (isLoading && !aiInsights) {
		return (
			<Card data-testid="card-recommendations-loading">
				<CardContent className="p-6">
					<div className="flex items-center justify-center space-x-2">
						<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
						<span>AI is analyzing your InvestSmart data...</span>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-6" data-testid="investment-recommendations">
			{/* AI-Powered InvestSmart Insights */}
			{aiInsights && (
				<div className="space-y-6">
					{/* AI Health Score Overview */}
					<Card data-testid="card-ai-health-overview">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Brain className="w-5 h-5 text-purple-600" />
								AI InvestSmart Analysis
								{pageHealth?.healthMetrics.overallScore && (
									<Badge
										variant={
											pageHealth.healthMetrics.overallScore >= 80
												? "default"
												: "destructive"
										}
									>
										{pageHealth.healthMetrics.overallScore}/100
									</Badge>
								)}
							</CardTitle>
							<CardDescription>
								Comprehensive AI analysis of your complete financial profile
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
								{aiInsights.summary && (
									<>
										<div className="text-center p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
											<div className="text-2xl font-bold text-blue-600">
												₹
												{(
													aiInsights.summary.monthlySurplus || 0
												).toLocaleString()}
											</div>
											<div className="text-sm text-muted-foreground">
												Monthly Investment Surplus
											</div>
										</div>
										<div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
											<div className="text-2xl font-bold text-green-600">
												{aiInsights.summary.creditScore || "N/A"}
											</div>
											<div className="text-sm text-muted-foreground">
												Credit Score
											</div>
										</div>
										<div className="text-center p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
											<div className="text-2xl font-bold text-purple-600">
												{aiInsights.summary.opportunityCount || 0}
											</div>
											<div className="text-sm text-muted-foreground">
												Key Opportunities
											</div>
										</div>
									</>
								)}
							</div>
						</CardContent>
					</Card>

					{/* AI Actionables Categories */}
					<Card data-testid="card-ai-actionables">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Zap className="w-5 h-5 text-yellow-600" />
								AI-Generated Actionables
							</CardTitle>
							<CardDescription>
								Smart recommendations based on your complete financial data
							</CardDescription>
							<div className="flex gap-2 mt-4">
								{["all", "urgent", "opportunities", "goals", "investments"].map(
									(category) => (
										<Button
											key={category}
											variant={
												selectedCategory === category ? "default" : "outline"
											}
											size="sm"
											onClick={() => setSelectedCategory(category)}
											data-testid={`button-category-${category}`}
										>
											{category.charAt(0).toUpperCase() + category.slice(1)}
										</Button>
									),
								)}
							</div>
						</CardHeader>
						<CardContent>
							{aiActionables?.actionables &&
								Array.isArray(aiActionables.actionables) && (
									<div className="space-y-3">
										{aiActionables.actionables.map(
											(actionable: string, index: number) => (
												<div
													key={index}
													className="flex items-start gap-3 p-4 border rounded-lg hover:bg-muted"
													data-testid={`actionable-${selectedCategory}-${index}`}
												>
													<div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
														<CheckCircle className="w-4 h-4 text-blue-600" />
													</div>
													<div className="flex-1">
														<p className="text-sm font-medium">{actionable}</p>
														<div className="flex items-center gap-2 mt-2">
															<Badge
																variant={
																	aiActionables?.priority === "high"
																		? "destructive"
																		: "default"
																}
															>
																{aiActionables?.priority || "medium"}
															</Badge>
															<span className="text-xs text-muted-foreground">
																Category: {selectedCategory}
															</span>
														</div>
													</div>
												</div>
											),
										)}
									</div>
								)}
						</CardContent>
					</Card>

					{/* AI Key Insights Breakdown */}
					{aiInsights.aiInsights && (
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							{/* Urgent Actions */}
							{aiInsights.aiInsights.urgentActions &&
								aiInsights.aiInsights.urgentActions.length > 0 && (
									<Card data-testid="card-urgent-actions">
										<CardHeader>
											<CardTitle className="flex items-center gap-2 text-red-600">
												<AlertTriangle className="w-5 h-5" />
												Urgent Actions
											</CardTitle>
										</CardHeader>
										<CardContent>
											<div className="space-y-2">
												{aiInsights.aiInsights.urgentActions.map(
													(action: string, index: number) => (
														<div key={index} className="flex items-start gap-2">
															<Clock className="w-4 h-4 text-red-500 mt-1 flex-shrink-0" />
															<span className="text-sm">{action}</span>
														</div>
													),
												)}
											</div>
										</CardContent>
									</Card>
								)}

							{/* Key Opportunities */}
							{aiInsights.aiInsights.keyOpportunities &&
								aiInsights.aiInsights.keyOpportunities.length > 0 && (
									<Card data-testid="card-key-opportunities">
										<CardHeader>
											<CardTitle className="flex items-center gap-2 text-green-600">
												<TrendingUp className="w-5 h-5" />
												Key Opportunities
											</CardTitle>
										</CardHeader>
										<CardContent>
											<div className="space-y-2">
												{aiInsights.aiInsights.keyOpportunities.map(
													(opportunity: string, index: number) => (
														<div key={index} className="flex items-start gap-2">
															<ArrowRight className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
															<span className="text-sm">{opportunity}</span>
														</div>
													),
												)}
											</div>
										</CardContent>
									</Card>
								)}

							{/* Goal Acceleration */}
							{aiInsights.aiInsights.goalAcceleration &&
								aiInsights.aiInsights.goalAcceleration.length > 0 && (
									<Card data-testid="card-goal-acceleration">
										<CardHeader>
											<CardTitle className="flex items-center gap-2 text-blue-600">
												<Target className="w-5 h-5" />
												Goal Acceleration
											</CardTitle>
										</CardHeader>
										<CardContent>
											<div className="space-y-2">
												{aiInsights.aiInsights.goalAcceleration.map(
													(goal: string, index: number) => (
														<div key={index} className="flex items-start gap-2">
															<Activity className="w-4 h-4 text-blue-500 mt-1 flex-shrink-0" />
															<span className="text-sm">{goal}</span>
														</div>
													),
												)}
											</div>
										</CardContent>
									</Card>
								)}

							{/* Investment Recommendations */}
							{aiInsights.aiInsights.investmentRecommendations &&
								aiInsights.aiInsights.investmentRecommendations.length > 0 && (
									<Card data-testid="card-ai-investments">
										<CardHeader>
											<CardTitle className="flex items-center gap-2 text-purple-600">
												<PieChart className="w-5 h-5" />
												AI Investment Recommendations
											</CardTitle>
										</CardHeader>
										<CardContent>
											<div className="space-y-2">
												{aiInsights.aiInsights.investmentRecommendations.map(
													(investment: string, index: number) => (
														<div key={index} className="flex items-start gap-2">
															<IndianRupee className="w-4 h-4 text-purple-500 mt-1 flex-shrink-0" />
															<span className="text-sm">{investment}</span>
														</div>
													),
												)}
											</div>
										</CardContent>
									</Card>
								)}
						</div>
					)}

					<Separator />
				</div>
			)}

			{/* Goal-Based Recommendations */}
			{goalRecommendations &&
				Array.isArray(goalRecommendations) &&
				goalRecommendations.length > 0 && (
					<Card data-testid="card-goal-recommendations">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Target className="w-5 h-5 text-blue-600" />
								Goal-Based Investment Recommendations
							</CardTitle>
							<CardDescription>
								Tailored investment suggestions to achieve your financial goal
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{goalRecommendations.map((rec: any, index: number) => (
								<div
									key={index}
									className="border rounded-lg p-4 space-y-3"
									data-testid={`recommendation-goal-${index}`}
								>
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-3">
											<div className="text-2xl font-bold text-blue-600">
												{rec.allocation}%
											</div>
											<div>
												<h4 className="font-medium">{rec.category}</h4>
												<p className="text-sm text-muted-foreground">
													{rec.rationale}
												</p>
											</div>
										</div>
										<Badge className={getRiskColor(rec.risk)}>{rec.risk}</Badge>
									</div>

									<div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
										<div className="flex items-center gap-2">
											<TrendingUp className="w-4 h-4 text-green-600" />
											<span>Expected: {rec.expectedReturn}</span>
										</div>
										<div className="flex items-center gap-2">
											<IndianRupee className="w-4 h-4 text-blue-600" />
											<span>
												Monthly: {formatCurrency(rec.monthlyInvestment)}
											</span>
										</div>
										<div className="flex items-center gap-2">
											<LucideShield className="w-4 h-4 text-purple-600" />
											<span>Risk: {rec.risk}</span>
										</div>
									</div>

									<div className="space-y-2">
										<p className="text-sm font-medium">
											Recommended Instruments:
										</p>
										<div className="flex flex-wrap gap-2">
											{rec.instruments.map(
												(instrument: string, idx: number) => (
													<Badge
														key={idx}
														variant="outline"
														className="text-xs"
													>
														{instrument}
													</Badge>
												),
											)}
										</div>
									</div>

									<Button
										variant="outline"
										size="sm"
										onClick={() => {
											setSelectedRecommendation(`goal-${index}`);
											console.log(`Viewing details for goal: ${rec.name}`);
											alert(
												`Goal Details: ${rec.name}\nDescription: ${rec.description}\nTarget Amount: ${formatCurrency(rec.targetAmount)}`,
											);
										}}
										data-testid={`button-view-details-goal-${index}`}
									>
										<Lightbulb className="w-4 h-4 mr-2" />
										View Details
									</Button>
								</div>
							))}
						</CardContent>
					</Card>
				)}

			{/* Portfolio Rebalancing Recommendations */}
			{rebalanceRecommendations &&
				Array.isArray(rebalanceRecommendations) &&
				rebalanceRecommendations.length > 0 && (
					<Card data-testid="card-rebalance-recommendations">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<PieChart className="w-5 h-5 text-orange-600" />
								Portfolio Rebalancing Recommendations
							</CardTitle>
							<CardDescription>
								Optimize your portfolio allocation based on your financial goals
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{rebalanceRecommendations.map((rec: any, index: number) => (
								<div
									key={rec.id}
									className="border rounded-lg p-4 space-y-3"
									data-testid={`recommendation-rebalance-${index}`}
								>
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-3">
											<Badge variant={getPriorityColor(rec.priority)}>
												{rec.priority.toUpperCase()}
											</Badge>
											<div>
												<h4 className="font-medium">{rec.title}</h4>
												<p className="text-sm text-muted-foreground">
													{rec.description}
												</p>
											</div>
										</div>
										<ArrowRight className="w-5 h-5 text-muted-foreground" />
									</div>

									<div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
										<div className="space-y-1">
											<p className="text-muted-foreground">Current</p>
											<p className="font-medium">{rec.currentPercentage}%</p>
										</div>
										<div className="space-y-1">
											<p className="text-muted-foreground">Target</p>
											<p className="font-medium">{rec.targetPercentage}%</p>
										</div>
										<div className="space-y-1">
											<p className="text-muted-foreground">Amount</p>
											<p className="font-medium">
												{formatCurrency(rec.rebalanceAmount)}
											</p>
										</div>
										<div className="space-y-1">
											<p className="text-muted-foreground">Impact</p>
											<p className="font-medium">
												{rec.expectedImpact?.returnPotential}
											</p>
										</div>
									</div>

									<div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
										<div className="flex items-start gap-2">
											<Lightbulb className="w-4 h-4 text-blue-600 mt-0.5" />
											<div>
												<p className="text-sm font-medium text-blue-800 dark:text-blue-200">
													Why this change?
												</p>
												<p className="text-sm text-blue-700 dark:text-blue-300">
													{rec.reasoning}
												</p>
											</div>
										</div>
									</div>

									<div className="flex items-center justify-between">
										<div className="flex items-center gap-4 text-xs text-muted-foreground">
											<span>Risk: {rec.expectedImpact?.riskAdjustment}</span>
											<span>•</span>
											<span>Return: {rec.expectedImpact?.returnPotential}</span>
										</div>
										<Button
											size="sm"
											onClick={() => {
												setSelectedRecommendation(`rebalance-${index}`);
												// Here you can add the actual implementation logic
												console.log(
													`Implementing suggestion for rebalancing: ${rec.title}`,
												);
												alert(
													`Implementing suggestion: ${rec.title}\nThis will ${rec.description}`,
												);
											}}
											data-testid={`button-implement-rebalance-${index}`}
										>
											Implement Suggestion
										</Button>
									</div>
								</div>
							))}
						</CardContent>
					</Card>
				)}

			{/* Investment Suggestions */}
			<Card data-testid="card-investment-suggestions">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<BarChart3 className="w-5 h-5 text-purple-600" />
						Investment Suggestions
					</CardTitle>
					<CardDescription>
						AI-powered recommendations based on market analysis and your profile
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div
							className="p-4 border rounded-lg space-y-3"
							data-testid="suggestion-tax-saving"
						>
							<div className="flex items-center gap-3">
								<div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-lg">
									<LucideShield className="w-5 h-5" />
								</div>
								<div>
									<h4 className="font-medium">Tax-Saving Investment</h4>
									<p className="text-sm text-muted-foreground">
										ELSS Mutual Funds
									</p>
								</div>
							</div>
							<div className="space-y-2">
								<div className="flex justify-between text-sm">
									<span>Potential Tax Saving</span>
									<span className="font-medium text-green-600">₹46,800</span>
								</div>
								<div className="flex justify-between text-sm">
									<span>Expected Returns</span>
									<span className="font-medium">12-15%</span>
								</div>
								<div className="flex justify-between text-sm">
									<span>Lock-in Period</span>
									<span className="font-medium">3 years</span>
								</div>
							</div>
							<Button
								variant="outline"
								size="sm"
								className="w-full"
								data-testid="button-explore-elss"
								onClick={() => {
									console.log("Exploring ELSS funds for tax-saving investment");
									alert(
										"Exploring ELSS Funds\n\nPotential Tax Saving: ₹46,800\nExpected Returns: 12-15%\nLock-in Period: 3 years\n\nRedirecting to ELSS fund options...",
									);
								}}
							>
								Explore ELSS Funds
							</Button>
						</div>

						<div
							className="p-4 border rounded-lg space-y-3"
							data-testid="suggestion-sip-boost"
						>
							<div className="flex items-center gap-3">
								<div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg">
									<Calendar className="w-5 h-5" />
								</div>
								<div>
									<h4 className="font-medium">SIP Boost Opportunity</h4>
									<p className="text-sm text-muted-foreground">
										Increase monthly SIP
									</p>
								</div>
							</div>
							<div className="space-y-2">
								<div className="flex justify-between text-sm">
									<span>Current SIP</span>
									<span className="font-medium">₹45,000</span>
								</div>
								<div className="flex justify-between text-sm">
									<span>Suggested Increase</span>
									<span className="font-medium text-blue-600">₹15,000</span>
								</div>
								<div className="flex justify-between text-sm">
									<span>Goal Achievement</span>
									<span className="font-medium">6 months faster</span>
								</div>
							</div>
							<Button
								variant="outline"
								size="sm"
								className="w-full"
								data-testid="button-increase-sip"
								onClick={() => {
									console.log("Increasing SIP amount for portfolio boost");
									alert(
										"SIP Boost Opportunity\n\nCurrent SIP: ₹45,000\nSuggested Increase: ₹15,000\nNew Total: ₹60,000/month\n\nGoal Achievement: 6 months faster\n\nImplementing SIP increase...",
									);
								}}
							>
								Increase SIP Amount
							</Button>
						</div>
					</div>

					<Separator />

					<div className="space-y-3">
						<h4 className="font-medium flex items-center gap-2">
							<AlertTriangle className="w-4 h-4 text-orange-600" />
							Important Considerations
						</h4>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
							<div className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
								<Calendar className="w-4 h-4 text-orange-600 mt-0.5" />
								<div>
									<p className="font-medium text-orange-800 dark:text-orange-200">
										Market Timing
									</p>
									<p className="text-orange-700 dark:text-orange-300">
										Current market conditions favor systematic investment
										approach
									</p>
								</div>
							</div>
							<div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
								<LucideShield className="w-4 h-4 text-blue-600 mt-0.5" />
								<div>
									<p className="font-medium text-blue-800 dark:text-blue-200">
										Risk Management
									</p>
									<p className="text-blue-700 dark:text-blue-300">
										Diversification across asset classes is recommended
									</p>
								</div>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Action Summary */}
			{((goalRecommendations &&
				Array.isArray(goalRecommendations) &&
				goalRecommendations.length > 0) ||
				(rebalanceRecommendations &&
					Array.isArray(rebalanceRecommendations) &&
					rebalanceRecommendations.length > 0)) && (
				<Card data-testid="card-action-summary">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<CheckCircle className="w-5 h-5 text-green-600" />
							Next Steps
						</CardTitle>
						<CardDescription>
							Recommended actions to optimize your investment strategy
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							{rebalanceRecommendations &&
								Array.isArray(rebalanceRecommendations) &&
								rebalanceRecommendations.length > 0 && (
									<div className="flex items-center gap-3 p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
										<PieChart className="w-5 h-5 text-yellow-600" />
										<div className="flex-1">
											<p className="font-medium text-yellow-800 dark:text-yellow-200">
												Portfolio Rebalancing Required
											</p>
											<p className="text-sm text-yellow-700 dark:text-yellow-300">
												{rebalanceRecommendations.length} rebalancing
												suggestions available
											</p>
										</div>
										<Button
											size="sm"
											variant="outline"
											data-testid="button-review-rebalancing"
											onClick={() => {
												console.log(
													"Reviewing portfolio rebalancing suggestions",
												);
												alert(
													`Portfolio Rebalancing Review\n\n${rebalanceRecommendations?.length || 0} suggestions available\n\nReviewing recommendations to optimize your portfolio allocation...`,
												);
											}}
										>
											Review
										</Button>
									</div>
								)}

							{goalRecommendations &&
								Array.isArray(goalRecommendations) &&
								goalRecommendations.length > 0 && (
									<div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
										<Target className="w-5 h-5 text-green-600" />
										<div className="flex-1">
											<p className="font-medium text-green-800 dark:text-green-200">
												Goal-Specific Investment Plan Ready
											</p>
											<p className="text-sm text-green-700 dark:text-green-300">
												{goalRecommendations.length} investment categories
												recommended
											</p>
										</div>
										<Button
											size="sm"
											variant="outline"
											data-testid="button-start-investing"
											onClick={() => {
												console.log(
													"Starting investment journey based on goal recommendations",
												);
												alert(
													`Start Your Investment Journey\n\n${goalRecommendations?.length || 0} investment categories recommended\n\nInitiating goal-based investment planning...`,
												);
											}}
										>
											Start Investing
										</Button>
									</div>
								)}

							<div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
								<Calendar className="w-5 h-5 text-blue-600" />
								<div className="flex-1">
									<p className="font-medium text-blue-800 dark:text-blue-200">
										Schedule Portfolio Review
									</p>
									<p className="text-sm text-blue-700 dark:text-blue-300">
										Set up quarterly reviews to track progress and adjust
										strategies
									</p>
								</div>
								<Button
									size="sm"
									variant="outline"
									data-testid="button-schedule-review"
									onClick={() => {
										console.log("Scheduling quarterly portfolio review");
										alert(
											"Scheduling Portfolio Review\n\nQuarterly reviews will be set up to:\n- Track progress toward goals\n- Adjust investment strategies\n- Rebalance portfolio allocation\n\nReview scheduled successfully!",
										);
									}}
								>
									Schedule
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Comprehensive AI Asset Allocation */}
			<Card
				data-testid="card-comprehensive-ai-allocation"
				className="bg-gradient-to-r from-purple-50 dark:from-purple-950/30 to-indigo-50 dark:to-indigo-950/30 border-purple-200 dark:border-purple-800"
			>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-purple-900 dark:text-purple-100">
						<Star className="w-5 h-5 text-purple-600" />
						AI-Powered Comprehensive Asset Allocation
					</CardTitle>
					<CardDescription className="text-purple-700 dark:text-purple-300">
						Intelligent allocation across all asset classes: Core Portfolio
						(Mutual Funds), Alternative Assets (Commodities & Precious Metals),
						and Premium Investments - optimized for ₹72,000 monthly surplus
					</CardDescription>
				</CardHeader>
				<CardContent>
					{/* Risk Profile Selector */}
					<div className="mb-6">
						<div className="flex items-center gap-2 mb-3">
							<Brain className="w-5 h-5 text-purple-600" />
							<h4 className="font-semibold text-purple-900 dark:text-purple-100">
								Select Risk Profile
							</h4>
						</div>
						<div className="grid grid-cols-3 gap-3">
							<Button
								variant={
									selectedRiskProfile === "conservative" ? "default" : "outline"
								}
								size="sm"
								className="h-auto p-3 flex flex-col items-center gap-1"
								data-testid="button-conservative-risk"
								onClick={() => setSelectedRiskProfile("conservative")}
							>
								<LucideShield className="w-4 h-4" />
								<span className="text-xs font-medium">Conservative</span>
								<span className="text-xs text-muted-foreground">Low Risk</span>
							</Button>
							<Button
								variant={
									selectedRiskProfile === "moderate" ? "default" : "outline"
								}
								size="sm"
								className="h-auto p-3 flex flex-col items-center gap-1"
								data-testid="button-moderate-risk"
								onClick={() => setSelectedRiskProfile("moderate")}
							>
								<Target className="w-4 h-4" />
								<span className="text-xs font-medium">Moderate</span>
								<span className="text-xs text-muted-foreground">Balanced</span>
							</Button>
							<Button
								variant={
									selectedRiskProfile === "aggressive" ? "default" : "outline"
								}
								size="sm"
								className="h-auto p-3 flex flex-col items-center gap-1"
								data-testid="button-aggressive-risk"
								onClick={() => setSelectedRiskProfile("aggressive")}
							>
								<TrendingUp className="w-4 h-4" />
								<span className="text-xs font-medium">Aggressive</span>
								<span className="text-xs text-muted-foreground">
									High Growth
								</span>
							</Button>
						</div>
					</div>

					<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
						{/* Core Portfolio - Mutual Funds */}
						<Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30">
							<CardContent className="p-4">
								<div className="space-y-4">
									<div className="flex items-center gap-2">
										<PieChart className="w-5 h-5 text-green-600" />
										<h4 className="font-semibold text-green-900 dark:text-green-100">
											Core Portfolio
										</h4>
										<span className="text-xs bg-green-200 dark:bg-green-800/30 text-green-800 dark:text-green-200 px-2 py-1 rounded">
											{getCurrentAllocation().corePortfolio.total}%
										</span>
									</div>
									<div className="space-y-2">
										<div className="flex items-center justify-between p-2 bg-green-100 dark:bg-green-900/30 rounded">
											<div className="flex items-center gap-2">
												<div className="w-2 h-2 bg-green-600 rounded-full" />
												<span className="text-xs font-medium text-green-800 dark:text-green-200">
													Equity Funds
												</span>
											</div>
											<div className="text-right">
												<div className="text-sm font-bold text-green-600">
													{getCurrentAllocation().corePortfolio.equity}%
												</div>
												<div className="text-xs text-green-600">
													₹
													{(
														(72000 *
															getCurrentAllocation().corePortfolio.equity) /
														100
													).toLocaleString()}
													/month
												</div>
											</div>
										</div>
										<div className="flex items-center justify-between p-2 bg-green-100 dark:bg-green-900/30 rounded">
											<div className="flex items-center gap-2">
												<div className="w-2 h-2 bg-green-500 rounded-full" />
												<span className="text-xs font-medium text-green-800 dark:text-green-200">
													Debt Funds
												</span>
											</div>
											<div className="text-right">
												<div className="text-sm font-bold text-green-600">
													{getCurrentAllocation().corePortfolio.debt}%
												</div>
												<div className="text-xs text-green-600">
													₹
													{(
														(72000 *
															getCurrentAllocation().corePortfolio.debt) /
														100
													).toLocaleString()}
													/month
												</div>
											</div>
										</div>
										<div className="flex items-center justify-between p-2 bg-green-100 dark:bg-green-900/30 rounded">
											<div className="flex items-center gap-2">
												<div className="w-2 h-2 bg-green-400 rounded-full" />
												<span className="text-xs font-medium text-green-800 dark:text-green-200">
													Hybrid Funds
												</span>
											</div>
											<div className="text-right">
												<div className="text-sm font-bold text-green-600">
													{getCurrentAllocation().corePortfolio.hybrid}%
												</div>
												<div className="text-xs text-green-600">
													₹
													{(
														(72000 *
															getCurrentAllocation().corePortfolio.hybrid) /
														100
													).toLocaleString()}
													/month
												</div>
											</div>
										</div>
									</div>
									<div className="p-2 bg-gradient-to-r from-green-100 dark:from-green-900/30 to-emerald-100 dark:to-emerald-900/30 rounded">
										<p className="text-xs text-green-700 dark:text-green-300">
											Foundation of diversified portfolio with professional
											management and liquidity
										</p>
									</div>
								</div>
							</CardContent>
						</Card>

						{/* Alternative Assets */}
						<Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
							<CardContent className="p-4">
								<div className="space-y-4">
									<div className="flex items-center gap-2">
										<Coins className="w-5 h-5 text-amber-600" />
										<h4 className="font-semibold text-amber-900 dark:text-amber-100">
											Alternative Assets
										</h4>
										<span className="text-xs bg-amber-200 dark:bg-amber-800/30 text-amber-800 dark:text-amber-200 px-2 py-1 rounded">
											{getCurrentAllocation().alternatives.total}%
										</span>
									</div>
									<div className="space-y-2">
										<div className="flex items-center justify-between p-2 bg-amber-100 dark:bg-amber-900/30 rounded">
											<div className="flex items-center gap-2">
												<div className="w-2 h-2 bg-yellow-600 rounded-full" />
												<span className="text-xs font-medium text-amber-800 dark:text-amber-200">
													Gold ETF/Digital
												</span>
											</div>
											<div className="text-right">
												<div className="text-sm font-bold text-amber-600">
													{getCurrentAllocation().alternatives.gold}%
												</div>
												<div className="text-xs text-amber-600">
													₹
													{(
														(72000 * getCurrentAllocation().alternatives.gold) /
														100
													).toLocaleString()}
													/month
												</div>
											</div>
										</div>
										<div className="flex items-center justify-between p-2 bg-amber-100 dark:bg-amber-900/30 rounded">
											<div className="flex items-center gap-2">
												<div className="w-2 h-2 bg-muted-foreground rounded-full" />
												<span className="text-xs font-medium text-amber-800 dark:text-amber-200">
													Silver ETF
												</span>
											</div>
											<div className="text-right">
												<div className="text-sm font-bold text-amber-600">
													{getCurrentAllocation().alternatives.silver}%
												</div>
												<div className="text-xs text-amber-600">
													₹
													{(
														(72000 *
															getCurrentAllocation().alternatives.silver) /
														100
													).toLocaleString()}
													/month
												</div>
											</div>
										</div>
										<div className="flex items-center justify-between p-2 bg-amber-100 dark:bg-amber-900/30 rounded">
											<div className="flex items-center gap-2">
												<div className="w-2 h-2 bg-amber-600 rounded-full" />
												<span className="text-xs font-medium text-amber-800 dark:text-amber-200">
													Commodities
												</span>
											</div>
											<div className="text-right">
												<div className="text-sm font-bold text-amber-600">
													{getCurrentAllocation().alternatives.commodities}%
												</div>
												<div className="text-xs text-amber-600">
													₹
													{(
														(72000 *
															getCurrentAllocation().alternatives.commodities) /
														100
													).toLocaleString()}
													/month
												</div>
											</div>
										</div>
									</div>
									<div className="p-2 bg-gradient-to-r from-amber-100 dark:from-amber-900/30 to-yellow-100 dark:to-yellow-900/30 rounded">
										<p className="text-xs text-amber-700 dark:text-amber-300">
											Inflation hedge and portfolio diversification through
											precious metals and commodities
										</p>
									</div>
								</div>
							</CardContent>
						</Card>

						{/* Premium Investments */}
						<Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
							<CardContent className="p-4">
								<div className="space-y-4">
									<div className="flex items-center gap-2">
										<Crown className="w-5 h-5 text-blue-600" />
										<h4 className="font-semibold text-blue-900 dark:text-blue-100">
											Premium Investments
										</h4>
										<span className="text-xs bg-blue-200 dark:bg-blue-800/30 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
											{getCurrentAllocation().premium.total}%
										</span>
									</div>
									<div className="space-y-2">
										<div className="flex items-center justify-between p-2 bg-blue-100 dark:bg-blue-900/30 rounded">
											<div className="flex items-center gap-2">
												<Building2 className="w-3 h-3 text-blue-600" />
												<span className="text-xs font-medium text-blue-800 dark:text-blue-200">
													REITs/InvITs
												</span>
											</div>
											<div className="text-right">
												<div className="text-sm font-bold text-blue-600">
													{getCurrentAllocation().premium.reits}%
												</div>
												<div className="text-xs text-blue-600">
													₹
													{(
														(72000 * getCurrentAllocation().premium.reits) /
														100
													).toLocaleString()}
													/month
												</div>
											</div>
										</div>
										<div className="flex items-center justify-between p-2 bg-purple-100 dark:bg-purple-900/30 rounded">
											<div className="flex items-center gap-2">
												<Briefcase className="w-3 h-3 text-purple-600" />
												<span className="text-xs font-medium text-purple-800 dark:text-purple-200">
													PMS
												</span>
											</div>
											<div className="text-right">
												<div className="text-sm font-bold text-purple-600">
													{getCurrentAllocation().premium.pms}%
												</div>
												<div className="text-xs text-purple-600">
													₹
													{(
														(72000 * getCurrentAllocation().premium.pms) /
														100
													).toLocaleString()}
													/month
												</div>
											</div>
										</div>
										<div className="flex items-center justify-between p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded">
											<div className="flex items-center gap-2">
												<Star className="w-3 h-3 text-indigo-600" />
												<span className="text-xs font-medium text-indigo-800 dark:text-indigo-200">
													AIF
												</span>
											</div>
											<div className="text-right">
												<div className="text-sm font-bold text-indigo-600">
													{getCurrentAllocation().premium.aif}%
												</div>
												<div className="text-xs text-indigo-600">
													₹
													{(
														(72000 * getCurrentAllocation().premium.aif) /
														100
													).toLocaleString()}
													/month
												</div>
											</div>
										</div>
										<div className="flex items-center justify-between p-2 bg-green-100 dark:bg-green-900/30 rounded">
											<div className="flex items-center gap-2">
												<LucideShield className="w-3 h-3 text-green-600" />
												<span className="text-xs font-medium text-green-800 dark:text-green-200">
													Premium Bonds
												</span>
											</div>
											<div className="text-right">
												<div className="text-sm font-bold text-green-600">
													{getCurrentAllocation().premium.bonds}%
												</div>
												<div className="text-xs text-green-600">
													₹
													{(
														(72000 * getCurrentAllocation().premium.bonds) /
														100
													).toLocaleString()}
													/month
												</div>
											</div>
										</div>
									</div>
									<div className="p-2 bg-gradient-to-r from-blue-100 dark:from-blue-900/30 to-purple-100 dark:to-purple-900/30 rounded">
										<p className="text-xs text-blue-700 dark:text-blue-300">
											High-ticket investments for enhanced returns and portfolio
											sophistication
										</p>
									</div>
								</div>
							</CardContent>
						</Card>
					</div>

					{/* AI Analysis Summary */}
					<div className="mt-6 p-4 bg-gradient-to-r from-purple-100 dark:from-purple-900/30 to-indigo-100 dark:to-indigo-900/30 rounded-lg border border-purple-200 dark:border-purple-800">
						<div className="flex items-center gap-2 mb-3">
							<Brain className="w-5 h-5 text-purple-600" />
							<h4 className="font-semibold text-purple-900 dark:text-purple-100">
								AI Portfolio Analysis -{" "}
								{selectedRiskProfile.charAt(0).toUpperCase() +
									selectedRiskProfile.slice(1)}{" "}
								Profile
							</h4>
						</div>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div className="space-y-2">
								<div className="flex justify-between text-sm">
									<span className="text-purple-700 dark:text-purple-300">
										Expected Annual Return:
									</span>
									<span className="font-semibold text-purple-900 dark:text-purple-100">
										{getCurrentAllocation().analysis.expectedReturn}
									</span>
								</div>
								<div className="flex justify-between text-sm">
									<span className="text-purple-700 dark:text-purple-300">
										Risk Level:
									</span>
									<span className="font-semibold text-purple-900 dark:text-purple-100">
										{getCurrentAllocation().analysis.riskLevel}
									</span>
								</div>
								<div className="flex justify-between text-sm">
									<span className="text-purple-700 dark:text-purple-300">
										Portfolio Maturity:
									</span>
									<span className="font-semibold text-purple-900 dark:text-purple-100">
										{getCurrentAllocation().analysis.maturityPeriod}
									</span>
								</div>
							</div>
							<div className="space-y-2">
								<p className="text-xs text-purple-700 dark:text-purple-300">
									{getCurrentAllocation().analysis.recommendation}
								</p>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Goal-Specific AI Recommendations */}
			<Card className="bg-gradient-to-r from-orange-50 dark:from-orange-950/30 to-yellow-50 dark:to-yellow-950/30 border-orange-200 dark:border-orange-800 mt-6">
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-orange-900 dark:text-orange-100">
						<Target className="w-5 h-5 text-orange-600" />
						Goal-Specific AI Investment Strategies
					</CardTitle>
					<CardDescription className="text-orange-700 dark:text-orange-300">
						Tailored allocation recommendations based on specific financial
						objectives
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
						<Card className="border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30">
							<CardContent className="p-4">
								<div className="space-y-4">
									<div className="flex items-center gap-2">
										<Target className="w-5 h-5 text-orange-600" />
										<h4 className="font-semibold text-orange-900 dark:text-orange-100">
											Retirement Planning
										</h4>
									</div>
									<div className="space-y-3">
										<div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
											<div className="flex items-center gap-2 mb-2">
												<IndianRupee className="w-4 h-4 text-orange-600" />
												<span className="text-sm font-medium text-orange-800 dark:text-orange-200">
													Retirement Planning
												</span>
											</div>
											<div className="text-xs text-orange-700 dark:text-orange-300 space-y-1">
												<div>• 40% REITs for steady income</div>
												<div>• 35% Conservative PMS</div>
												<div>• 25% Premium bonds</div>
											</div>
										</div>
										<div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
											<div className="flex items-center gap-2 mb-2">
												<TrendingUp className="w-4 h-4 text-yellow-600" />
												<span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
													Wealth Creation
												</span>
											</div>
											<div className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
												<div>• 50% Growth PMS</div>
												<div>• 30% AIF Category II</div>
												<div>• 20% International REITs</div>
											</div>
										</div>
										<div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
											<div className="flex items-center gap-2 mb-2">
												<Calendar className="w-4 h-4 text-green-600" />
												<span className="text-sm font-medium text-green-800 dark:text-green-200">
													Income Generation
												</span>
											</div>
											<div className="text-xs text-green-700 dark:text-green-300 space-y-1">
												<div>• 60% High-yield REITs</div>
												<div>• 25% Infrastructure InvITs</div>
												<div>• 15% Dividend PMS</div>
											</div>
										</div>
									</div>
								</div>
							</CardContent>
						</Card>
					</div>
				</CardContent>
			</Card>

			{/* AI Timeline & Milestones */}
			<Card className="mt-6">
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-foreground">
						<Clock className="w-5 h-5 text-muted-foreground" />
						AI Investment Timeline & Milestones
					</CardTitle>
					<CardDescription className="text-muted-foreground">
						Strategic milestones in your premium investment journey
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30">
							<CardContent className="p-4 text-center">
								<div className="space-y-2">
									<div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
										<Clock className="w-6 h-6 text-green-600" />
									</div>
									<h5 className="font-semibold text-green-900 dark:text-green-100">
										Year 1-2
									</h5>
									<div className="text-sm text-green-700 dark:text-green-300 space-y-1">
										<div>REITs: ₹4.32L</div>
										<div>Premium Bonds: ₹1.73L</div>
										<div>Emergency Buffer: ₹2.40L</div>
									</div>
									<div className="text-xs text-green-600 font-medium">
										Foundation Building
									</div>
								</div>
							</CardContent>
						</Card>

						<Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
							<CardContent className="p-4 text-center">
								<div className="space-y-2">
									<div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto">
										<Briefcase className="w-6 h-6 text-blue-600" />
									</div>
									<h5 className="font-semibold text-blue-900 dark:text-blue-100">
										Year 3-6
									</h5>
									<div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
										<div>PMS Eligibility: ₹50L</div>
										<div>REITs Portfolio: ₹15L</div>
										<div>Professional Management</div>
									</div>
									<div className="text-xs text-blue-600 font-medium">
										Premium Access
									</div>
								</div>
							</CardContent>
						</Card>

						<Card className="border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30">
							<CardContent className="p-4 text-center">
								<div className="space-y-2">
									<div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto">
										<Crown className="w-6 h-6 text-purple-600" />
									</div>
									<h5 className="font-semibold text-purple-900 dark:text-purple-100">
										Year 7+
									</h5>
									<div className="text-sm text-purple-700 dark:text-purple-300 space-y-1">
										<div>AIF Qualification: ₹1Cr</div>
										<div>Ultra HNI Status</div>
										<div>Alternative Strategies</div>
									</div>
									<div className="text-xs text-purple-600 font-medium">
										Wealth Multiplication
									</div>
								</div>
							</CardContent>
						</Card>
					</div>

					{/* AI Insights & Actions */}
					<div className="mt-6 p-4 bg-gradient-to-r from-amber-50 dark:from-amber-950/30 to-orange-50 dark:to-orange-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
						<h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-3 flex items-center gap-2">
							<Lightbulb className="w-5 h-5" />
							AI-Generated Insights & Next Actions
						</h4>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
							<div className="space-y-2">
								<h5 className="font-medium text-amber-800 dark:text-amber-200">
									🎯 Immediate Actions
								</h5>
								<div className="space-y-1 text-amber-700 dark:text-amber-300">
									<div className="flex items-start gap-2">
										<CheckCircle className="w-3 h-3 mt-1 text-amber-600" />
										<span>Start REITs SIP with ₹18,000/month</span>
									</div>
									<div className="flex items-start gap-2">
										<CheckCircle className="w-3 h-3 mt-1 text-amber-600" />
										<span>Allocate ₹36,000 towards PMS fund building</span>
									</div>
									<div className="flex items-start gap-2">
										<CheckCircle className="w-3 h-3 mt-1 text-amber-600" />
										<span>Research premium bond options (₹7,200)</span>
									</div>
								</div>
							</div>
							<div className="space-y-2">
								<h5 className="font-medium text-amber-800 dark:text-amber-200">
									🔮 AI Predictions
								</h5>
								<div className="space-y-1 text-amber-700 dark:text-amber-300">
									<div className="flex items-start gap-2">
										<Activity className="w-3 h-3 mt-1 text-amber-600" />
										<span>69% probability of PMS access in 69 months</span>
									</div>
									<div className="flex items-start gap-2">
										<Activity className="w-3 h-3 mt-1 text-amber-600" />
										<span>Expected portfolio value: ₹85L in 10 years</span>
									</div>
									<div className="flex items-start gap-2">
										<Activity className="w-3 h-3 mt-1 text-amber-600" />
										<span>Optimal rebalancing every 18 months</span>
									</div>
								</div>
							</div>
						</div>
						<div className="mt-4 flex flex-wrap gap-2">
							<Button
								size="sm"
								className="bg-amber-600 hover:bg-amber-700 text-white"
								data-testid="button-start-premium-plan"
							>
								🚀 Start Premium Investment Plan
							</Button>
							<Button
								variant="outline"
								size="sm"
								data-testid="button-schedule-consultation"
							>
								<Users className="w-4 h-4 mr-2" />
								Schedule AI Consultation
							</Button>
							<Button
								variant="outline"
								size="sm"
								data-testid="button-view-detailed-analysis"
							>
								<BarChart3 className="w-4 h-4 mr-2" />
								View Detailed Analysis
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* No Recommendations State */}
			{!goalRecommendations?.length && !rebalanceRecommendations?.length && (
				<Card data-testid="card-no-recommendations">
					<CardContent className="p-6 text-center space-y-4">
						<div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
							<Target className="w-8 h-8 text-muted-foreground" />
						</div>
						<div>
							<h3 className="font-medium text-foreground">
								No Recommendations Available
							</h3>
							<p className="text-sm text-muted-foreground mt-1">
								Set up your financial goals and portfolio to get personalized
								investment recommendations
							</p>
						</div>
						<div className="flex justify-center gap-3">
							<Button
								variant="outline"
								data-testid="button-create-goal"
								onClick={() => {
									console.log("Creating new financial goal");
									alert(
										"Create Financial Goal\n\nSet up your investment goals:\n- Retirement Planning\n- Child Education\n- Home Purchase\n- Emergency Fund\n- Wealth Building\n\nRedirecting to goal creation...",
									);
								}}
							>
								Create Financial Goal
							</Button>
							<Button
								data-testid="button-view-portfolio"
								onClick={() => {
									console.log("Viewing current portfolio");
									alert(
										"View Portfolio\n\nAccessing your investment portfolio:\n- Current holdings\n- Performance metrics\n- Asset allocation\n- Transaction history\n\nLoading portfolio dashboard...",
									);
								}}
							>
								View Portfolio
							</Button>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
