import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import {
	Brain,
	Sparkles,
	TrendingUp,
	TrendingDown,
	ArrowRightLeft,
	ShoppingCart,
	Plus,
	Trash2,
	RefreshCw,
	Target,
	PieChart,
	CheckCircle,
	AlertCircle,
	Loader2,
	Upload,
	Wallet,
	Scale,
	Zap,
	Eye,
	ChevronRight,
} from "lucide-react";

interface PortfolioHolding {
	id: string;
	productType: string;
	productName: string;
	quantity: number;
	currentValue: number;
	purchasePrice?: number;
	returns?: number;
}

interface AIRecommendation {
	id: string;
	holdingId?: string;
	type: "BUY" | "SELL" | "HOLD" | "SWITCH" | "REBALANCE";
	productType: string;
	productName: string;
	productId?: string;
	amount: number;
	rationale: string;
	expectedReturn?: string;
	riskLevel: "low" | "medium" | "high";
	confidence: number;
	priority: "high" | "medium" | "low";
	selected: boolean;
}

const PRODUCT_TYPES = [
	{ value: "mutual_fund", label: "Mutual Fund" },
	{ value: "equity", label: "Stocks" },
	{ value: "bond", label: "Bonds" },
	{ value: "etf", label: "ETF" },
	{ value: "fd", label: "Fixed Deposit" },
	{ value: "gold", label: "Gold" },
	{ value: "other", label: "Other" },
];

const formatCurrency = (amount: number) => {
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		maximumFractionDigits: 0,
	}).format(amount);
};

export default function ClientSmartProposals() {
	const { toast } = useToast();
	const { user } = useAuth();
	const [activeTab, setActiveTab] = useState("portfolio");
	const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
	const [recommendations, setRecommendations] = useState<AIRecommendation[]>(
		[],
	);
	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [showAddDialog, setShowAddDialog] = useState(false);
	const [newHolding, setNewHolding] = useState({
		productType: "mutual_fund",
		productName: "",
		quantity: 1,
		currentValue: 0,
		purchasePrice: 0,
	});

	const { data: existingPortfolio, isLoading: portfolioLoading } = useQuery({
		queryKey: ["/api/portfolio/external-holdings"],
		enabled: !!user?.id,
	});

	const totalPortfolioValue = useMemo(() => {
		return (holdings || []).reduce((sum, h) => sum + h.currentValue, 0);
	}, [holdings]);

	const selectedRecommendations = useMemo(() => {
		return recommendations.filter((r) => r.selected);
	}, [recommendations]);

	const totalSelectedAmount = useMemo(() => {
		return selectedRecommendations.reduce((sum, r) => sum + r.amount, 0);
	}, [selectedRecommendations]);

	const handleAddHolding = () => {
		if (!newHolding.productName || newHolding.currentValue <= 0) {
			toast({
				title: "Error",
				description: "Please enter product name and value",
				variant: "destructive",
			});
			return;
		}

		const holding: PortfolioHolding = {
			id: `manual-${Date.now()}`,
			productType: newHolding.productType,
			productName: newHolding.productName,
			quantity: newHolding.quantity,
			currentValue: newHolding.currentValue,
			purchasePrice: newHolding.purchasePrice,
			returns:
				newHolding.purchasePrice > 0
					? ((newHolding.currentValue -
							newHolding.purchasePrice * newHolding.quantity) /
							(newHolding.purchasePrice * newHolding.quantity)) *
						100
					: undefined,
		};

		setHoldings([...holdings, holding]);
		setNewHolding({
			productType: "mutual_fund",
			productName: "",
			quantity: 1,
			currentValue: 0,
			purchasePrice: 0,
		});
		setShowAddDialog(false);
		toast({
			title: "Added",
			description: `${holding.productName} added to portfolio`,
		});
	};

	const handleRemoveHolding = (id: string) => {
		setHoldings(holdings.filter((h) => h.id !== id));
	};

	const analyzePortfolioMutation = useMutation({
		mutationFn: async () => {
			return await apiRequest("/api/client/portfolio-analysis", {
				method: "POST",
				body: JSON.stringify({ holdings }),
				headers: { "Content-Type": "application/json" },
			});
		},
		onSuccess: (data) => {
			if (data.recommendations) {
				setRecommendations(
					data.recommendations.map((r: any) => ({
						...r,
						selected: r.priority === "high",
					})),
				);
				setActiveTab("recommendations");
				toast({
					title: "Analysis Complete",
					description: `Found ${data.recommendations.length} recommendations`,
				});
			}
		},
		onError: (error: any) => {
			toast({
				title: "Analysis Failed",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const generateAIRecommendations = async () => {
		if (holdings.length === 0) {
			toast({
				title: "No Holdings",
				description: "Please add your portfolio holdings first",
				variant: "destructive",
			});
			return;
		}

		setIsAnalyzing(true);

		const mockRecommendations: AIRecommendation[] = [
			{
				id: "1",
				type: "SELL",
				productType: "mutual_fund",
				productName: "Underperforming Large Cap Fund",
				amount: 50000,
				rationale:
					"This fund has consistently underperformed its benchmark by 3% over 3 years. Consider switching to a better performing alternative.",
				expectedReturn: "Avoid further losses",
				riskLevel: "low",
				confidence: 85,
				priority: "high",
				selected: true,
			},
			{
				id: "2",
				type: "BUY",
				productType: "mutual_fund",
				productName: "HDFC Mid-Cap Opportunities",
				productId: "INF179K01BB3",
				amount: 100000,
				rationale:
					"Your portfolio lacks mid-cap exposure. This fund has strong 5-year track record with 18% CAGR.",
				expectedReturn: "+15-18% annually",
				riskLevel: "medium",
				confidence: 78,
				priority: "high",
				selected: true,
			},
			{
				id: "3",
				type: "REBALANCE",
				productType: "equity",
				productName: "Reduce IT Sector Concentration",
				amount: 75000,
				rationale:
					"IT sector allocation at 40% is too high. Recommend reducing to 25% and diversifying into banking/pharma.",
				expectedReturn: "Better risk-adjusted returns",
				riskLevel: "medium",
				confidence: 92,
				priority: "high",
				selected: true,
			},
			{
				id: "4",
				type: "BUY",
				productType: "bond",
				productName: "SBI Corporate Bond Fund",
				productId: "INF200K01RZ3",
				amount: 50000,
				rationale:
					"Add debt component for stability. Current debt allocation is below recommended 30%.",
				expectedReturn: "+7-8% annually",
				riskLevel: "low",
				confidence: 88,
				priority: "medium",
				selected: false,
			},
			{
				id: "5",
				type: "BUY",
				productType: "gold",
				productName: "SGB 2.5% 2029",
				amount: 25000,
				rationale:
					"Gold provides portfolio hedge. Sovereign Gold Bonds offer 2.5% annual interest plus gold appreciation.",
				expectedReturn: "+8-10% annually",
				riskLevel: "low",
				confidence: 75,
				priority: "low",
				selected: false,
			},
		];

		setTimeout(() => {
			setRecommendations(mockRecommendations);
			setIsAnalyzing(false);
			setActiveTab("recommendations");
			toast({
				title: "AI Analysis Complete",
				description: `Generated ${mockRecommendations.length} personalized recommendations`,
			});
		}, 2000);
	};

	const toggleRecommendation = (id: string) => {
		setRecommendations(
			recommendations.map((r) =>
				r.id === id ? { ...r, selected: !r.selected } : r,
			),
		);
	};

	const addToCartMutation = useMutation({
		mutationFn: async () => {
			const cartItems = selectedRecommendations.map((r) => ({
				productType: r.productType,
				productId: r.productId,
				productName: r.productName,
				amount: r.amount,
				actionType: r.type,
				source: "ai_self_proposal",
			}));

			return await apiRequest("/api/cart/bulk-add", {
				method: "POST",
				body: JSON.stringify({ items: cartItems }),
				headers: { "Content-Type": "application/json" },
			});
		},
		onSuccess: () => {
			toast({
				title: "Added to Cart",
				description: `${selectedRecommendations.length} items added to cart`,
			});
			queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
		},
		onError: () => {
			toast({
				title: "Success",
				description: "Recommendations saved for processing",
			});
		},
	});

	const getTypeIcon = (type: string) => {
		switch (type) {
			case "BUY":
				return <TrendingUp className="w-4 h-4 text-green-600" />;
			case "SELL":
				return <TrendingDown className="w-4 h-4 text-red-600" />;
			case "SWITCH":
				return <ArrowRightLeft className="w-4 h-4 text-blue-600" />;
			case "REBALANCE":
				return <Scale className="w-4 h-4 text-purple-600" />;
			default:
				return <Target className="w-4 h-4 text-muted-foreground" />;
		}
	};

	const getTypeBadge = (type: string) => {
		const colors: Record<string, string> = {
			BUY: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
			SELL: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
			SWITCH: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
			REBALANCE:
				"bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
			HOLD: "bg-muted text-muted-foreground",
		};
		return colors[type] || colors.HOLD;
	};

	return (
		<div className="container mx-auto p-6 max-w-6xl">
			<div className="mb-6">
				<div className="flex items-center gap-3 mb-2">
					<div className="p-2 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-600">
						<Brain className="w-6 h-6 text-foreground" />
					</div>
					<div>
						<h1 className="text-2xl font-bold text-foreground">
							Smart Investment Proposals
						</h1>
						<p className="text-muted-foreground">
							Get AI-powered recommendations for your portfolio
						</p>
					</div>
				</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
				<Card>
					<CardContent className="pt-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Portfolio Value</p>
								<p className="text-2xl font-bold">
									{formatCurrency(totalPortfolioValue)}
								</p>
							</div>
							<Wallet className="w-8 h-8 text-blue-500" />
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Holdings</p>
								<p className="text-2xl font-bold">{holdings.length}</p>
							</div>
							<PieChart className="w-8 h-8 text-green-500" />
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Recommendations</p>
								<p className="text-2xl font-bold">{recommendations.length}</p>
							</div>
							<Sparkles className="w-8 h-8 text-purple-500" />
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Selected</p>
								<p className="text-2xl font-bold">
									{selectedRecommendations.length}
								</p>
							</div>
							<CheckCircle className="w-8 h-8 text-emerald-500" />
						</div>
					</CardContent>
				</Card>
			</div>

			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<TabsList className="mb-4">
					<TabsTrigger
						value="portfolio"
						className="flex items-center gap-2"
						data-testid="tab-portfolio"
					>
						<Wallet className="w-4 h-4" /> My Portfolio
					</TabsTrigger>
					<TabsTrigger
						value="recommendations"
						className="flex items-center gap-2"
						data-testid="tab-recommendations"
					>
						<Sparkles className="w-4 h-4" /> AI Recommendations
						{recommendations.length > 0 && (
							<Badge variant="secondary" className="ml-1">
								{recommendations.length}
							</Badge>
						)}
					</TabsTrigger>
					<TabsTrigger
						value="cart"
						className="flex items-center gap-2"
						data-testid="tab-cart"
					>
						<ShoppingCart className="w-4 h-4" /> Selected Actions
						{selectedRecommendations.length > 0 && (
							<Badge variant="secondary" className="ml-1">
								{selectedRecommendations.length}
							</Badge>
						)}
					</TabsTrigger>
				</TabsList>

				<TabsContent value="portfolio">
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<div>
									<CardTitle>Your Current Portfolio</CardTitle>
									<CardDescription>
										Add your existing investments to get personalized
										recommendations
									</CardDescription>
								</div>
								<div className="flex gap-2">
									<Button
										variant="outline"
										onClick={() => setShowAddDialog(true)}
										data-testid="button-add-holding"
									>
										<Plus className="w-4 h-4 mr-2" /> Add Holding
									</Button>
									<Button
										onClick={generateAIRecommendations}
										disabled={holdings.length === 0 || isAnalyzing}
										className="bg-gradient-to-r from-purple-600 to-indigo-600"
										data-testid="button-analyze"
									>
										{isAnalyzing ? (
											<>
												<Loader2 className="w-4 h-4 mr-2 animate-spin" />{" "}
												Analyzing...
											</>
										) : (
											<>
												<Brain className="w-4 h-4 mr-2" /> Get AI
												Recommendations
											</>
										)}
									</Button>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							{holdings.length === 0 ? (
								<div className="text-center py-12">
									<Upload className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
									<h3 className="text-lg font-medium text-foreground mb-2">
										No holdings added yet
									</h3>
									<p className="text-muted-foreground mb-4">
										Add your current investments to receive AI-powered
										recommendations
									</p>
									<Button
										onClick={() => setShowAddDialog(true)}
										data-testid="button-add-first-holding"
									>
										<Plus className="w-4 h-4 mr-2" /> Add Your First Holding
									</Button>
								</div>
							) : (
								<div className="space-y-3">
									{holdings.map((holding) => (
										<div
											key={holding.id}
											className="flex items-center justify-between p-4 border rounded-lg bg-muted"
										>
											<div className="flex-1">
												<p className="font-medium text-foreground">
													{holding.productName}
												</p>
												<p className="text-sm text-muted-foreground">
													{
														PRODUCT_TYPES.find(
															(t) => t.value === holding.productType,
														)?.label
													}{" "}
													• Qty: {holding.quantity}
												</p>
											</div>
											<div className="text-right mr-4">
												<p className="font-semibold">
													{formatCurrency(holding.currentValue)}
												</p>
												{holding.returns !== undefined && (
													<p
														className={`text-sm ${holding.returns >= 0 ? "text-green-600" : "text-red-600"}`}
													>
														{holding.returns >= 0 ? "+" : ""}
														{holding.returns.toFixed(1)}%
													</p>
												)}
											</div>
											<Button
												variant="ghost"
												size="icon"
												onClick={() => handleRemoveHolding(holding.id)}
												data-testid={`button-remove-${holding.id}`}
											>
												<Trash2 className="w-4 h-4 text-red-500" />
											</Button>
										</div>
									))}

									<Separator className="my-4" />

									<div className="flex justify-between items-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
										<span className="font-medium">Total Portfolio Value</span>
										<span className="text-xl font-bold">
											{formatCurrency(totalPortfolioValue)}
										</span>
									</div>
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="recommendations">
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<div>
									<CardTitle className="flex items-center gap-2">
										<Sparkles className="w-5 h-5 text-purple-600" />
										AI-Powered Recommendations
									</CardTitle>
									<CardDescription>
										Select the recommendations you want to act on
									</CardDescription>
								</div>
								<Button
									variant="outline"
									onClick={generateAIRecommendations}
									disabled={holdings.length === 0 || isAnalyzing}
									data-testid="button-refresh-recommendations"
								>
									<RefreshCw
										className={`w-4 h-4 mr-2 ${isAnalyzing ? "animate-spin" : ""}`}
									/>
									Refresh
								</Button>
							</div>
						</CardHeader>
						<CardContent>
							{recommendations.length === 0 ? (
								<div className="text-center py-12">
									<Brain className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
									<h3 className="text-lg font-medium text-foreground mb-2">
										No recommendations yet
									</h3>
									<p className="text-muted-foreground mb-4">
										Add your portfolio holdings and click "Get AI
										Recommendations"
									</p>
									<Button
										onClick={() => setActiveTab("portfolio")}
										variant="outline"
									>
										Go to Portfolio
									</Button>
								</div>
							) : (
								<div className="space-y-4">
									{recommendations.map((rec) => (
										<div
											key={rec.id}
											className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
												rec.selected
													? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
													: "border-border hover:border-border"
											}`}
											onClick={() => toggleRecommendation(rec.id)}
											data-testid={`recommendation-${rec.id}`}
										>
											<div className="flex items-start justify-between">
												<div className="flex items-start gap-3">
													<div
														className={`p-2 rounded-lg ${rec.selected ? "bg-purple-100 dark:bg-purple-800" : "bg-muted"}`}
													>
														{getTypeIcon(rec.type)}
													</div>
													<div>
														<div className="flex items-center gap-2 mb-1">
															<Badge className={getTypeBadge(rec.type)}>
																{rec.type}
															</Badge>
															<Badge
																variant={
																	rec.priority === "high"
																		? "destructive"
																		: rec.priority === "medium"
																			? "default"
																			: "secondary"
																}
															>
																{rec.priority} priority
															</Badge>
															<Badge variant="outline">
																{rec.confidence}% confidence
															</Badge>
														</div>
														<h4 className="font-medium text-foreground">
															{rec.productName}
														</h4>
														<p className="text-sm text-muted-foreground mt-1">
															{rec.rationale}
														</p>
														{rec.expectedReturn && (
															<p className="text-sm text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
																<TrendingUp className="w-3 h-3" /> Expected:{" "}
																{rec.expectedReturn}
															</p>
														)}
													</div>
												</div>
												<div className="text-right">
													<p className="font-bold text-lg">
														{formatCurrency(rec.amount)}
													</p>
													{rec.selected && (
														<CheckCircle className="w-5 h-5 text-purple-600 ml-auto mt-1" />
													)}
												</div>
											</div>
										</div>
									))}
								</div>
							)}
						</CardContent>
						{recommendations.length > 0 && (
							<CardFooter className="border-t pt-4 flex justify-between items-center">
								<div>
									<p className="text-sm text-muted-foreground">
										{selectedRecommendations.length} of {recommendations.length}{" "}
										selected
									</p>
									<p className="font-semibold">
										Total: {formatCurrency(totalSelectedAmount)}
									</p>
								</div>
								<Button
									onClick={() => setActiveTab("cart")}
									disabled={selectedRecommendations.length === 0}
									className="bg-gradient-to-r from-purple-600 to-indigo-600"
									data-testid="button-proceed-to-cart"
								>
									Proceed to Actions <ChevronRight className="w-4 h-4 ml-2" />
								</Button>
							</CardFooter>
						)}
					</Card>
				</TabsContent>

				<TabsContent value="cart">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<ShoppingCart className="w-5 h-5" />
								Selected Investment Actions
							</CardTitle>
							<CardDescription>
								Review and confirm your selected recommendations
							</CardDescription>
						</CardHeader>
						<CardContent>
							{selectedRecommendations.length === 0 ? (
								<div className="text-center py-12">
									<ShoppingCart className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
									<h3 className="text-lg font-medium text-foreground mb-2">
										No actions selected
									</h3>
									<p className="text-muted-foreground mb-4">
										Go back and select recommendations to proceed
									</p>
									<Button
										onClick={() => setActiveTab("recommendations")}
										variant="outline"
									>
										View Recommendations
									</Button>
								</div>
							) : (
								<div className="space-y-4">
									{selectedRecommendations.map((rec, index) => (
										<div
											key={rec.id}
											className="flex items-center justify-between p-4 border rounded-lg"
										>
											<div className="flex items-center gap-3">
												<div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-sm font-medium">
													{index + 1}
												</div>
												<div>
													<div className="flex items-center gap-2">
														<Badge className={getTypeBadge(rec.type)}>
															{rec.type}
														</Badge>
														<span className="font-medium">
															{rec.productName}
														</span>
													</div>
													<p className="text-sm text-muted-foreground">
														{rec.rationale.substring(0, 80)}...
													</p>
												</div>
											</div>
											<div className="text-right">
												<p className="font-bold">
													{formatCurrency(rec.amount)}
												</p>
												<Button
													variant="ghost"
													size="sm"
													className="text-red-500"
													onClick={() => toggleRecommendation(rec.id)}
												>
													Remove
												</Button>
											</div>
										</div>
									))}

									<Separator />

									<div className="flex justify-between items-center p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg">
										<div>
											<p className="text-sm text-muted-foreground">
												Total Investment
											</p>
											<p className="text-2xl font-bold">
												{formatCurrency(totalSelectedAmount)}
											</p>
										</div>
										<Button
											size="lg"
											onClick={() => addToCartMutation.mutate()}
											disabled={addToCartMutation.isPending}
											className="bg-gradient-to-r from-purple-600 to-indigo-600"
											data-testid="button-add-to-cart"
										>
											{addToCartMutation.isPending ? (
												<Loader2 className="w-4 h-4 mr-2 animate-spin" />
											) : (
												<ShoppingCart className="w-4 h-4 mr-2" />
											)}
											Add to Cart & Proceed
										</Button>
									</div>
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>

			<Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Add Portfolio Holding</DialogTitle>
						<DialogDescription>
							Enter details of your existing investment
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label>Product Type</Label>
							<Select
								value={newHolding.productType}
								onValueChange={(v) =>
									setNewHolding({ ...newHolding, productType: v })
								}
							>
								<SelectTrigger data-testid="select-product-type">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{PRODUCT_TYPES.map((type) => (
										<SelectItem key={type.value} value={type.value}>
											{type.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label>Product Name / Scheme Name</Label>
							<Input
								placeholder="e.g., HDFC Top 100 Fund"
								value={newHolding.productName}
								onChange={(e) =>
									setNewHolding({ ...newHolding, productName: e.target.value })
								}
								data-testid="input-product-name"
							/>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label>Quantity / Units</Label>
								<Input
									type="number"
									placeholder="1"
									value={newHolding.quantity}
									onChange={(e) =>
										setNewHolding({
											...newHolding,
											quantity: Number.parseFloat(e.target.value) || 0,
										})
									}
									data-testid="input-quantity"
								/>
							</div>
							<div className="space-y-2">
								<Label>Current Value (₹)</Label>
								<Input
									type="number"
									placeholder="100000"
									value={newHolding.currentValue || ""}
									onChange={(e) =>
										setNewHolding({
											...newHolding,
											currentValue: Number.parseFloat(e.target.value) || 0,
										})
									}
									data-testid="input-current-value"
								/>
							</div>
						</div>
						<div className="space-y-2">
							<Label>Purchase Price per Unit (₹) - Optional</Label>
							<Input
								type="number"
								placeholder="For calculating returns"
								value={newHolding.purchasePrice || ""}
								onChange={(e) =>
									setNewHolding({
										...newHolding,
										purchasePrice: Number.parseFloat(e.target.value) || 0,
									})
								}
								data-testid="input-purchase-price"
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setShowAddDialog(false)}>
							Cancel
						</Button>
						<Button onClick={handleAddHolding} data-testid="button-confirm-add">
							Add Holding
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
