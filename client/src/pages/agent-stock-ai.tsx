import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	CardFooter,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, fetchCsrfToken } from "@/lib/queryClient";
import {
	Brain,
	TrendingUp,
	TrendingDown,
	BarChart3,
	Target,
	AlertTriangle,
	CheckCircle2,
	Clock,
	RefreshCw,
	Lightbulb,
	ArrowRight,
	ArrowUpRight,
	ArrowDownRight,
	Zap,
	Activity,
	LineChart,
	CandlestickChart,
	Layers,
	Timer,
	Calendar,
	DollarSign,
	Percent,
	Shield as LucideShield,
	ShieldAlert,
	Info,
	ChevronRight,
	Star,
	Flame,
	Eye,
	Play,
	Pause,
} from "lucide-react";

interface StockRecommendation {
	id: string;
	symbol: string;
	name: string;
	exchange: string;
	sector: string;
	currentPrice: number;
	entryPrice: number;
	targetPrice: number;
	stopLoss: number;
	action: "BUY" | "SELL" | "HOLD";
	confidence: number;
	riskScore: number;
	expectedReturn: number;
	timeHorizon: string;
	technicalIndicators: {
		rsi: number;
		macd: string;
		movingAverage50: number;
		movingAverage200: number;
		volumeTrend: string;
		supportLevel: number;
		resistanceLevel: number;
	};
	aiRationale: string;
	keyDrivers: string[];
	risks: string[];
	newsImpact?: string;
}

interface DerivativeRecommendation {
	id: string;
	symbol: string;
	underlying: string;
	instrumentType: "FUTURES" | "CALL_OPTION" | "PUT_OPTION";
	strikePrice?: number;
	expiryDate: string;
	lotSize: number;
	currentPremium: number;
	entryPrice: number;
	targetPrice: number;
	stopLoss: number;
	action: "BUY" | "SELL";
	confidence: number;
	riskScore: number;
	expectedReturn: number;
	maxProfit?: number;
	maxLoss?: number;
	breakeven?: number;
	greeks?: {
		delta: number;
		gamma: number;
		theta: number;
		vega: number;
		iv: number;
	};
	aiRationale: string;
	strategy: string;
	risks: string[];
}

interface RecommendationParams {
	category: "stocks" | "derivatives";
	timeHorizon: string;
	investmentAmount: number;
	riskTolerance: string;
	sectors?: string[];
	marketCap?: string;
	tradingStyle?: string;
	derivativeType?: string;
}

const TIME_HORIZONS = [
	{
		id: "intraday",
		label: "Intraday",
		description: "Same day trades",
		icon: Zap,
		color: "text-red-500",
		duration: "Minutes to hours",
	},
	{
		id: "ultra_short",
		label: "Ultra Short",
		description: "1-5 trading days",
		icon: Timer,
		color: "text-orange-500",
		duration: "1-5 days",
	},
	{
		id: "short_term",
		label: "Short Term",
		description: "1-4 weeks",
		icon: Clock,
		color: "text-yellow-500",
		duration: "1-4 weeks",
	},
	{
		id: "medium_term",
		label: "Medium Term",
		description: "1-6 months",
		icon: Calendar,
		color: "text-green-500",
		duration: "1-6 months",
	},
	{
		id: "long_term",
		label: "Long Term",
		description: "6+ months",
		icon: TrendingUp,
		color: "text-blue-500",
		duration: "6+ months",
	},
];

const DERIVATIVE_TYPES = [
	{ id: "futures", label: "Futures", description: "Index & Stock Futures" },
	{
		id: "options_call",
		label: "Call Options",
		description: "Bullish option strategies",
	},
	{
		id: "options_put",
		label: "Put Options",
		description: "Bearish option strategies",
	},
	{ id: "spreads", label: "Spreads", description: "Multi-leg strategies" },
];

const SECTORS = [
	"Banking",
	"IT",
	"Pharma",
	"Auto",
	"FMCG",
	"Energy",
	"Metals",
	"Realty",
	"Infra",
	"Media",
];

const MARKET_CAPS = [
	{ value: "large", label: "Large Cap (>₹20,000 Cr)" },
	{ value: "mid", label: "Mid Cap (₹5,000-20,000 Cr)" },
	{ value: "small", label: "Small Cap (<₹5,000 Cr)" },
	{ value: "all", label: "All Market Caps" },
];

export default function AgentStockAI() {
	const { toast } = useToast();
	const [mainTab, setMainTab] = useState("stocks");
	const [timeHorizon, setTimeHorizon] = useState("short_term");
	const [derivativeTimeHorizon, setDerivativeTimeHorizon] =
		useState("intraday");
	const [derivativeType, setDerivativeType] = useState("futures");
	const [showResults, setShowResults] = useState(false);

	const [params, setParams] = useState<RecommendationParams>({
		category: "stocks",
		timeHorizon: "short_term",
		investmentAmount: 100000,
		riskTolerance: "moderate",
		sectors: [],
		marketCap: "all",
		tradingStyle: "momentum",
		derivativeType: "futures",
	});

	const [stockRecommendations, setStockRecommendations] = useState<
		StockRecommendation[]
	>([]);
	const [derivativeRecommendations, setDerivativeRecommendations] = useState<
		DerivativeRecommendation[]
	>([]);

	// Fetch CSRF token on mount so the first POST doesn't fail with 'Invalid CSRF token'
	useEffect(() => {
		fetchCsrfToken();
	}, []);

	const generateMutation = useMutation({
		mutationFn: async (requestParams: RecommendationParams) => {
			return await apiRequest("/api/stock-ai/generate", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(requestParams),
			});
		},
		onSuccess: (data) => {
			if (data?.stocks) {
				setStockRecommendations(data.stocks);
			}
			if (data?.derivatives) {
				setDerivativeRecommendations(data.derivatives);
			}
			setShowResults(true);
			toast({
				title: "AI Analysis Complete",
				description: `Generated ${(data?.stocks?.length || 0) + (data?.derivatives?.length || 0)} recommendations`,
			});
		},
		onError: (error: any) => {
			toast({
				title: "Analysis Failed",
				description: error.message || "Failed to generate recommendations",
				variant: "destructive",
			});
		},
	});

	const handleGenerate = () => {
		const requestParams: RecommendationParams = {
			...params,
			category: mainTab as "stocks" | "derivatives",
			timeHorizon: mainTab === "stocks" ? timeHorizon : derivativeTimeHorizon,
			derivativeType: mainTab === "derivatives" ? derivativeType : undefined,
		};
		generateMutation.mutate(requestParams);
	};

	const getRiskColor = (score: number) => {
		if (score <= 3) return "text-green-500";
		if (score <= 6) return "text-yellow-500";
		return "text-red-500";
	};

	const getActionColor = (action: string) => {
		if (action === "BUY")
			return "bg-green-500/10 text-green-500 border-green-500/30";
		if (action === "SELL")
			return "bg-red-500/10 text-red-500 border-red-500/30";
		return "bg-yellow-500/10 text-yellow-500 border-yellow-500/30";
	};

	const getConfidenceColor = (confidence: number) => {
		if (confidence >= 80) return "text-green-500";
		if (confidence >= 60) return "text-yellow-500";
		return "text-orange-500";
	};

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
			<div className="max-w-7xl mx-auto space-y-6">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
							<Brain className="h-8 w-8 text-emerald-500" />
							Stock AI
						</h1>
						<p className="text-muted-foreground mt-1">
							AI-powered stock and derivatives recommendations for your clients
						</p>
					</div>
					<div className="flex items-center gap-3">
						<Badge
							variant="outline"
							className="text-emerald-400 border-emerald-500/50"
						>
							<Activity className="h-3 w-3 mr-1" />
							Market Open
						</Badge>
						<Button
							variant="outline"
							size="sm"
							className="border-border text-muted-foreground"
							data-testid="button-refresh-market"
						>
							<RefreshCw className="h-4 w-4 mr-2" />
							Refresh Data
						</Button>
					</div>
				</div>

				<Tabs value={mainTab} onValueChange={setMainTab} className="space-y-6">
					<ScrollableTabsList className="bg-background/50 border border-border p-1">
						<TabsTrigger
							value="stocks"
							className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
							data-testid="tab-stocks"
						>
							<LineChart className="h-4 w-4 mr-2" />
							Stocks
						</TabsTrigger>
						<TabsTrigger
							value="derivatives"
							className="data-[state=active]:bg-purple-600 data-[state=active]:text-white"
							data-testid="tab-derivatives"
						>
							<CandlestickChart className="h-4 w-4 mr-2" />
							Derivatives (F&O)
						</TabsTrigger>
					</ScrollableTabsList>

					<TabsContent value="stocks" className="space-y-6">
						<Card className="bg-background/50 border-border">
							<CardHeader>
								<CardTitle className="text-foreground flex items-center gap-2">
									<Target className="h-5 w-5 text-emerald-500" />
									Investment Horizon
								</CardTitle>
								<CardDescription>
									Select the time frame for stock recommendations
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="grid grid-cols-5 gap-3">
									{TIME_HORIZONS.map((horizon) => {
										const Icon = horizon.icon;
										const isActive = timeHorizon === horizon.id;
										return (
											<button
												key={horizon.id}
												onClick={() => {
													setTimeHorizon(horizon.id);
													setParams({ ...params, timeHorizon: horizon.id });
												}}
												className={`p-4 rounded-lg border transition-all text-left ${
													isActive
														? "bg-emerald-600/20 border-emerald-500 ring-2 ring-emerald-500/30"
														: "bg-card/50 border-border hover:border-border"
												}`}
												data-testid={`horizon-${horizon.id}`}
											>
												<Icon
													className={`h-6 w-6 mb-2 ${isActive ? "text-emerald-400" : horizon.color}`}
												/>
												<p
													className={`font-medium ${isActive ? "text-emerald-400" : "text-foreground"}`}
												>
													{horizon.label}
												</p>
												<p className="text-xs text-muted-foreground mt-1">
													{horizon.duration}
												</p>
											</button>
										);
									})}
								</div>
							</CardContent>
						</Card>

						<div className="grid grid-cols-3 gap-6">
							<Card className="bg-background/50 border-border">
								<CardHeader>
									<CardTitle className="text-foreground text-sm">
										Investment Amount
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="flex items-center gap-2">
										<span className="text-muted-foreground">₹</span>
										<Input
											type="number"
											value={params.investmentAmount}
											onChange={(e) =>
												setParams({
													...params,
													investmentAmount: Number(e.target.value),
												})
											}
											className="bg-card border-border text-foreground"
											data-testid="input-investment-amount"
										/>
									</div>
									<div className="flex gap-2">
										{[50000, 100000, 500000, 1000000].map((amount) => (
											<Button
												key={amount}
												variant="outline"
												size="sm"
												onClick={() =>
													setParams({ ...params, investmentAmount: amount })
												}
												className={`text-xs ${params.investmentAmount === amount ? "bg-emerald-600/20 border-emerald-500" : "border-border"}`}
											>
												{amount >= 100000
													? `₹${amount / 100000}L`
													: `₹${amount / 1000}K`}
											</Button>
										))}
									</div>
								</CardContent>
							</Card>

							<Card className="bg-background/50 border-border">
								<CardHeader>
									<CardTitle className="text-foreground text-sm">
										Risk Tolerance
									</CardTitle>
								</CardHeader>
								<CardContent>
									<Select
										value={params.riskTolerance}
										onValueChange={(value) =>
											setParams({ ...params, riskTolerance: value })
										}
									>
										<SelectTrigger
											className="bg-card border-border text-foreground"
											data-testid="select-risk"
										>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="very_conservative">
												Very Conservative (Minimal Risk)
											</SelectItem>
											<SelectItem value="conservative">
												Conservative (Low Risk)
											</SelectItem>
											<SelectItem value="moderate">
												Moderate (Balanced)
											</SelectItem>
											<SelectItem value="aggressive">
												Aggressive (High Risk)
											</SelectItem>
											<SelectItem value="very_aggressive">
												Very Aggressive (Maximum Risk)
											</SelectItem>
										</SelectContent>
									</Select>
									<p className="text-xs text-muted-foreground mt-2">
										{params.riskTolerance === "very_conservative" &&
											"Capital preservation priority with minimal return expectations"}
										{params.riskTolerance === "conservative" &&
											"Focus on stable, blue-chip stocks with lower volatility"}
										{params.riskTolerance === "moderate" &&
											"Balanced mix of growth and value stocks"}
										{params.riskTolerance === "aggressive" &&
											"Higher-beta stocks with greater return potential"}
										{params.riskTolerance === "very_aggressive" &&
											"Maximum returns focus with high volatility stocks"}
									</p>
								</CardContent>
							</Card>

							<Card className="bg-background/50 border-border">
								<CardHeader>
									<CardTitle className="text-foreground text-sm">
										Market Cap Preference
									</CardTitle>
								</CardHeader>
								<CardContent>
									<Select
										value={params.marketCap}
										onValueChange={(value) =>
											setParams({ ...params, marketCap: value })
										}
									>
										<SelectTrigger
											className="bg-card border-border text-foreground"
											data-testid="select-marketcap"
										>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{MARKET_CAPS.map((cap) => (
												<SelectItem key={cap.value} value={cap.value}>
													{cap.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</CardContent>
							</Card>
						</div>

						<Card className="bg-background/50 border-border">
							<CardHeader>
								<CardTitle className="text-foreground text-sm">
									Sector Focus (Optional)
								</CardTitle>
								<CardDescription>
									Leave empty for diversified recommendations
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="flex flex-wrap gap-2">
									{SECTORS.map((sector) => {
										const isSelected = params.sectors?.includes(sector);
										return (
											<Badge
												key={sector}
												variant="outline"
												className={`cursor-pointer transition-colors ${
													isSelected
														? "bg-emerald-600/20 border-emerald-500 text-emerald-400"
														: "border-border text-muted-foreground hover:border-border"
												}`}
												onClick={() => {
													const newSectors = isSelected
														? params.sectors?.filter((s) => s !== sector) || []
														: [...(params.sectors || []), sector];
													setParams({ ...params, sectors: newSectors });
												}}
											>
												{sector}
											</Badge>
										);
									})}
								</div>
							</CardContent>
						</Card>

						<Button
							onClick={handleGenerate}
							disabled={generateMutation.isPending}
							className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-6 text-lg"
							data-testid="button-generate-stock"
						>
							{generateMutation.isPending ? (
								<>
									<RefreshCw className="h-5 w-5 mr-2 animate-spin" />
									Analyzing Markets...
								</>
							) : (
								<>
									<Brain className="h-5 w-5 mr-2" />
									Generate Stock Recommendations
								</>
							)}
						</Button>

						{showResults && stockRecommendations.length > 0 && (
							<div className="space-y-4">
								<div className="flex items-center justify-between">
									<h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
										<Lightbulb className="h-5 w-5 text-yellow-500" />
										AI Recommendations ({stockRecommendations.length})
									</h3>
									<Badge variant="outline" className="text-muted-foreground">
										{TIME_HORIZONS.find((h) => h.id === timeHorizon)?.label}{" "}
										Horizon
									</Badge>
								</div>

								<div className="grid gap-4">
									{stockRecommendations.map((stock) => (
										<Card
											key={stock.id}
											className="bg-background/50 border-border overflow-hidden"
										>
											<CardContent className="p-0">
												<div className="flex">
													<div
														className={`w-2 ${stock.action === "BUY" ? "bg-green-500" : stock.action === "SELL" ? "bg-red-500" : "bg-yellow-500"}`}
													/>
													<div className="flex-1 p-4">
														<div className="flex items-start justify-between mb-4">
															<div>
																<div className="flex items-center gap-3">
																	<h4 className="text-lg font-bold text-foreground">
																		{stock.symbol}
																	</h4>
																	<Badge
																		className={getActionColor(stock.action)}
																	>
																		{stock.action === "BUY" && (
																			<ArrowUpRight className="h-3 w-3 mr-1" />
																		)}
																		{stock.action === "SELL" && (
																			<ArrowDownRight className="h-3 w-3 mr-1" />
																		)}
																		{stock.action}
																	</Badge>
																	<Badge
																		variant="outline"
																		className="text-muted-foreground"
																	>
																		{stock.sector}
																	</Badge>
																</div>
																<p className="text-muted-foreground text-sm">
																	{stock.name}
																</p>
															</div>
															<div className="text-right">
																<p className="text-2xl font-bold text-foreground">
																	₹
																	{(Number(stock.currentPrice) || 0).toFixed(2)}
																</p>
																<p
																	className={`text-sm flex items-center justify-end gap-1 ${getConfidenceColor(stock.confidence)}`}
																>
																	<Star className="h-3 w-3" />
																	{stock.confidence}% Confidence
																</p>
															</div>
														</div>

														<div className="grid grid-cols-4 gap-4 mb-4">
															<div className="bg-card/50 rounded-lg p-3">
																<p className="text-xs text-muted-foreground">
																	Entry
																</p>
																<p className="text-lg font-semibold text-foreground">
																	₹{(Number(stock.entryPrice) || 0).toFixed(2)}
																</p>
															</div>
															<div className="bg-card/50 rounded-lg p-3">
																<p className="text-xs text-muted-foreground">
																	Target
																</p>
																<p className="text-lg font-semibold text-green-400">
																	₹{(Number(stock.targetPrice) || 0).toFixed(2)}
																</p>
															</div>
															<div className="bg-card/50 rounded-lg p-3">
																<p className="text-xs text-muted-foreground">
																	Stop Loss
																</p>
																<p className="text-lg font-semibold text-red-400">
																	₹{(Number(stock.stopLoss) || 0).toFixed(2)}
																</p>
															</div>
															<div className="bg-card/50 rounded-lg p-3">
																<p className="text-xs text-muted-foreground">
																	Expected Return
																</p>
																<p
																	className={`text-lg font-semibold ${(Number(stock.expectedReturn) || 0) >= 0 ? "text-green-400" : "text-red-400"}`}
																>
																	{(Number(stock.expectedReturn) || 0) >= 0
																		? "+"
																		: ""}
																	{(Number(stock.expectedReturn) || 0).toFixed(
																		1,
																	)}
																	%
																</p>
															</div>
														</div>

														<div className="grid grid-cols-2 gap-4 mb-4">
															<div className="bg-card/30 rounded-lg p-3">
																<p className="text-xs text-muted-foreground mb-2">
																	Technical Indicators
																</p>
																<div className="grid grid-cols-2 gap-2 text-xs">
																	<div className="flex justify-between">
																		<span className="text-muted-foreground">
																			RSI
																		</span>
																		<span
																			className={`font-medium ${stock.technicalIndicators.rsi > 70 ? "text-red-400" : stock.technicalIndicators.rsi < 30 ? "text-green-400" : "text-foreground"}`}
																		>
																			{stock.technicalIndicators.rsi}
																		</span>
																	</div>
																	<div className="flex justify-between">
																		<span className="text-muted-foreground">
																			MACD
																		</span>
																		<span
																			className={`font-medium ${stock.technicalIndicators.macd === "Bullish" ? "text-green-400" : "text-red-400"}`}
																		>
																			{stock.technicalIndicators.macd}
																		</span>
																	</div>
																	<div className="flex justify-between">
																		<span className="text-muted-foreground">
																			MA50
																		</span>
																		<span className="text-foreground font-medium">
																			₹
																			{
																				stock.technicalIndicators
																					.movingAverage50
																			}
																		</span>
																	</div>
																	<div className="flex justify-between">
																		<span className="text-muted-foreground">
																			MA200
																		</span>
																		<span className="text-foreground font-medium">
																			₹
																			{
																				stock.technicalIndicators
																					.movingAverage200
																			}
																		</span>
																	</div>
																	<div className="flex justify-between">
																		<span className="text-muted-foreground">
																			Support
																		</span>
																		<span className="text-green-400 font-medium">
																			₹{stock.technicalIndicators.supportLevel}
																		</span>
																	</div>
																	<div className="flex justify-between">
																		<span className="text-muted-foreground">
																			Resistance
																		</span>
																		<span className="text-red-400 font-medium">
																			₹
																			{
																				stock.technicalIndicators
																					.resistanceLevel
																			}
																		</span>
																	</div>
																</div>
															</div>

															<div className="bg-card/30 rounded-lg p-3">
																<p className="text-xs text-muted-foreground mb-2">
																	AI Analysis
																</p>
																<p className="text-sm text-muted-foreground">
																	{stock.aiRationale}
																</p>
															</div>
														</div>

														<div className="flex items-center justify-between">
															<div className="flex items-center gap-4">
																<div className="flex items-center gap-2">
																	<LucideShield
																		className={`h-4 w-4 ${getRiskColor(stock.riskScore)}`}
																	/>
																	<span className="text-xs text-muted-foreground">
																		Risk: {stock.riskScore}/10
																	</span>
																</div>
																<div className="flex gap-1">
																	{stock.keyDrivers
																		.slice(0, 3)
																		.map((driver, i) => (
																			<Badge
																				key={i}
																				variant="outline"
																				className="text-xs border-border text-muted-foreground"
																			>
																				{driver}
																			</Badge>
																		))}
																</div>
															</div>
															<Button
																size="sm"
																className="bg-emerald-600 hover:bg-emerald-700"
																data-testid={`button-add-${stock.symbol}`}
															>
																Add to Proposal
															</Button>
														</div>
													</div>
												</div>
											</CardContent>
										</Card>
									))}
								</div>
							</div>
						)}
					</TabsContent>

					<TabsContent value="derivatives" className="space-y-6">
						<Card className="bg-background/50 border-border">
							<CardHeader>
								<CardTitle className="text-foreground flex items-center gap-2">
									<Layers className="h-5 w-5 text-purple-500" />
									Derivative Type
								</CardTitle>
								<CardDescription>Select F&O instrument type</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="grid grid-cols-4 gap-3">
									{DERIVATIVE_TYPES.map((type) => {
										const isActive = derivativeType === type.id;
										return (
											<button
												key={type.id}
												onClick={() => {
													setDerivativeType(type.id);
													setParams({ ...params, derivativeType: type.id });
												}}
												className={`p-4 rounded-lg border transition-all text-left ${
													isActive
														? "bg-purple-600/20 border-purple-500 ring-2 ring-purple-500/30"
														: "bg-card/50 border-border hover:border-border"
												}`}
												data-testid={`derivative-${type.id}`}
											>
												<CandlestickChart
													className={`h-6 w-6 mb-2 ${isActive ? "text-purple-400" : "text-muted-foreground"}`}
												/>
												<p
													className={`font-medium ${isActive ? "text-purple-400" : "text-foreground"}`}
												>
													{type.label}
												</p>
												<p className="text-xs text-muted-foreground mt-1">
													{type.description}
												</p>
											</button>
										);
									})}
								</div>
							</CardContent>
						</Card>

						<Card className="bg-background/50 border-border">
							<CardHeader>
								<CardTitle className="text-foreground flex items-center gap-2">
									<Target className="h-5 w-5 text-purple-500" />
									Trading Horizon
								</CardTitle>
								<CardDescription>
									Select time frame for F&O recommendations
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="grid grid-cols-5 gap-3">
									{TIME_HORIZONS.filter((h) =>
										["intraday", "ultra_short", "short_term"].includes(h.id),
									).map((horizon) => {
										const Icon = horizon.icon;
										const isActive = derivativeTimeHorizon === horizon.id;
										return (
											<button
												key={horizon.id}
												onClick={() => setDerivativeTimeHorizon(horizon.id)}
												className={`p-4 rounded-lg border transition-all text-left ${
													isActive
														? "bg-purple-600/20 border-purple-500 ring-2 ring-purple-500/30"
														: "bg-card/50 border-border hover:border-border"
												}`}
												data-testid={`derivative-horizon-${horizon.id}`}
											>
												<Icon
													className={`h-6 w-6 mb-2 ${isActive ? "text-purple-400" : horizon.color}`}
												/>
												<p
													className={`font-medium ${isActive ? "text-purple-400" : "text-foreground"}`}
												>
													{horizon.label}
												</p>
												<p className="text-xs text-muted-foreground mt-1">
													{horizon.duration}
												</p>
											</button>
										);
									})}
								</div>
							</CardContent>
						</Card>

						<Alert className="bg-amber-500/10 border-amber-500/30">
							<AlertTriangle className="h-4 w-4 text-amber-500" />
							<AlertDescription className="text-amber-200">
								<strong>Risk Warning:</strong> Derivatives are complex
								instruments with high risk. Only recommend to clients with
								appropriate experience and risk tolerance.
							</AlertDescription>
						</Alert>

						<div className="grid grid-cols-3 gap-6">
							<Card className="bg-background/50 border-border">
								<CardHeader>
									<CardTitle className="text-foreground text-sm">
										Capital Allocation
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="flex items-center gap-2">
										<span className="text-muted-foreground">₹</span>
										<Input
											type="number"
											value={params.investmentAmount}
											onChange={(e) =>
												setParams({
													...params,
													investmentAmount: Number(e.target.value),
												})
											}
											className="bg-card border-border text-foreground"
											data-testid="input-derivative-amount"
										/>
									</div>
								</CardContent>
							</Card>

							<Card className="bg-background/50 border-border">
								<CardHeader>
									<CardTitle className="text-foreground text-sm">
										Risk Profile
									</CardTitle>
								</CardHeader>
								<CardContent>
									<Select
										value={params.riskTolerance}
										onValueChange={(value) =>
											setParams({ ...params, riskTolerance: value })
										}
									>
										<SelectTrigger
											className="bg-card border-border text-foreground"
											data-testid="select-derivative-risk"
										>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="very_conservative">
												Very Conservative - Capital Protection
											</SelectItem>
											<SelectItem value="conservative">
												Conservative - Low Exposure
											</SelectItem>
											<SelectItem value="moderate">
												Moderate - Hedged Positions
											</SelectItem>
											<SelectItem value="aggressive">
												Aggressive - Directional Trades
											</SelectItem>
											<SelectItem value="very_aggressive">
												Very Aggressive - High Leverage
											</SelectItem>
										</SelectContent>
									</Select>
								</CardContent>
							</Card>

							<Card className="bg-background/50 border-border">
								<CardHeader>
									<CardTitle className="text-foreground text-sm">
										Trading Style
									</CardTitle>
								</CardHeader>
								<CardContent>
									<Select
										value={params.tradingStyle}
										onValueChange={(value) =>
											setParams({ ...params, tradingStyle: value })
										}
									>
										<SelectTrigger
											className="bg-card border-border text-foreground"
											data-testid="select-trading-style"
										>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="momentum">Momentum Trading</SelectItem>
											<SelectItem value="mean_reversion">
												Mean Reversion
											</SelectItem>
											<SelectItem value="breakout">Breakout Trading</SelectItem>
											<SelectItem value="hedging">
												Hedging/Protection
											</SelectItem>
										</SelectContent>
									</Select>
								</CardContent>
							</Card>
						</div>

						<Button
							onClick={handleGenerate}
							disabled={generateMutation.isPending}
							className="w-full bg-purple-600 hover:bg-purple-700 text-white py-6 text-lg"
							data-testid="button-generate-derivatives"
						>
							{generateMutation.isPending ? (
								<>
									<RefreshCw className="h-5 w-5 mr-2 animate-spin" />
									Analyzing F&O Markets...
								</>
							) : (
								<>
									<Brain className="h-5 w-5 mr-2" />
									Generate F&O Recommendations
								</>
							)}
						</Button>

						{showResults && derivativeRecommendations.length > 0 && (
							<div className="space-y-4">
								<div className="flex items-center justify-between">
									<h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
										<Flame className="h-5 w-5 text-orange-500" />
										F&O Recommendations ({derivativeRecommendations.length})
									</h3>
								</div>

								<div className="grid gap-4">
									{derivativeRecommendations.map((derivative) => (
										<Card
											key={derivative.id}
											className="bg-background/50 border-border overflow-hidden"
										>
											<CardContent className="p-0">
												<div className="flex">
													<div
														className={`w-2 ${derivative.action === "BUY" ? "bg-green-500" : "bg-red-500"}`}
													/>
													<div className="flex-1 p-4">
														<div className="flex items-start justify-between mb-4">
															<div>
																<div className="flex items-center gap-3">
																	<h4 className="text-lg font-bold text-foreground">
																		{derivative.symbol}
																	</h4>
																	<Badge
																		className={
																			derivative.action === "BUY"
																				? "bg-green-500/10 text-green-500 border-green-500/30"
																				: "bg-red-500/10 text-red-500 border-red-500/30"
																		}
																	>
																		{derivative.action}
																	</Badge>
																	<Badge
																		variant="outline"
																		className="text-purple-400 border-purple-500/30"
																	>
																		{(
																			derivative.instrumentType || "option"
																		).replace("_", " ")}
																	</Badge>
																</div>
																<p className="text-muted-foreground text-sm">
																	{derivative.underlying} | Lot Size:{" "}
																	{derivative.lotSize} | Expiry:{" "}
																	{derivative.expiryDate}
																</p>
															</div>
															<div className="text-right">
																<p className="text-2xl font-bold text-foreground">
																	₹
																	{(
																		Number(derivative.currentPremium) || 0
																	).toFixed(2)}
																</p>
																<p
																	className={`text-sm flex items-center justify-end gap-1 ${getConfidenceColor(derivative.confidence)}`}
																>
																	<Star className="h-3 w-3" />
																	{derivative.confidence}% Confidence
																</p>
															</div>
														</div>

														<div className="grid grid-cols-5 gap-4 mb-4">
															<div className="bg-card/50 rounded-lg p-3">
																<p className="text-xs text-muted-foreground">
																	Entry
																</p>
																<p className="text-lg font-semibold text-foreground">
																	₹
																	{(Number(derivative.entryPrice) || 0).toFixed(
																		2,
																	)}
																</p>
															</div>
															<div className="bg-card/50 rounded-lg p-3">
																<p className="text-xs text-muted-foreground">
																	Target
																</p>
																<p className="text-lg font-semibold text-green-400">
																	₹
																	{(
																		Number(derivative.targetPrice) || 0
																	).toFixed(2)}
																</p>
															</div>
															<div className="bg-card/50 rounded-lg p-3">
																<p className="text-xs text-muted-foreground">
																	Stop Loss
																</p>
																<p className="text-lg font-semibold text-red-400">
																	₹
																	{(Number(derivative.stopLoss) || 0).toFixed(
																		2,
																	)}
																</p>
															</div>
															{derivative.breakeven && (
																<div className="bg-card/50 rounded-lg p-3">
																	<p className="text-xs text-muted-foreground">
																		Breakeven
																	</p>
																	<p className="text-lg font-semibold text-yellow-400">
																		₹
																		{(
																			Number(derivative.breakeven) || 0
																		).toFixed(2)}
																	</p>
																</div>
															)}
															<div className="bg-card/50 rounded-lg p-3">
																<p className="text-xs text-muted-foreground">
																	Max Profit/Loss
																</p>
																<p className="text-sm font-semibold">
																	<span className="text-green-400">
																		+₹{derivative.maxProfit?.toLocaleString()}
																	</span>
																	<span className="text-muted-foreground">
																		{" "}
																		/{" "}
																	</span>
																	<span className="text-red-400">
																		-₹{derivative.maxLoss?.toLocaleString()}
																	</span>
																</p>
															</div>
														</div>

														{derivative.greeks && (
															<div className="bg-card/30 rounded-lg p-3 mb-4">
																<p className="text-xs text-muted-foreground mb-2">
																	Option Greeks
																</p>
																<div className="grid grid-cols-5 gap-4 text-xs">
																	<div className="text-center">
																		<span className="text-muted-foreground block">
																			Delta
																		</span>
																		<span className="text-foreground font-medium">
																			{typeof derivative.greeks.delta ===
																			"number"
																				? derivative.greeks.delta.toFixed(2)
																				: "N/A"}
																		</span>
																	</div>
																	<div className="text-center">
																		<span className="text-muted-foreground block">
																			Gamma
																		</span>
																		<span className="text-foreground font-medium">
																			{typeof derivative.greeks.gamma ===
																			"number"
																				? derivative.greeks.gamma.toFixed(4)
																				: "N/A"}
																		</span>
																	</div>
																	<div className="text-center">
																		<span className="text-muted-foreground block">
																			Theta
																		</span>
																		<span className="text-red-400 font-medium">
																			{typeof derivative.greeks.theta ===
																			"number"
																				? derivative.greeks.theta.toFixed(2)
																				: "N/A"}
																		</span>
																	</div>
																	<div className="text-center">
																		<span className="text-muted-foreground block">
																			Vega
																		</span>
																		<span className="text-foreground font-medium">
																			{typeof derivative.greeks.vega ===
																			"number"
																				? derivative.greeks.vega.toFixed(2)
																				: "N/A"}
																		</span>
																	</div>
																	<div className="text-center">
																		<span className="text-muted-foreground block">
																			IV
																		</span>
																		<span className="text-purple-400 font-medium">
																			{typeof derivative.greeks.iv === "number"
																				? `${derivative.greeks.iv.toFixed(1)}%`
																				: "N/A"}
																		</span>
																	</div>
																</div>
															</div>
														)}

														<div className="bg-card/30 rounded-lg p-3 mb-4">
															<p className="text-xs text-muted-foreground mb-1">
																Strategy: {derivative.strategy}
															</p>
															<p className="text-sm text-muted-foreground">
																{derivative.aiRationale}
															</p>
														</div>

														<div className="flex items-center justify-between">
															<div className="flex items-center gap-4">
																<div className="flex items-center gap-2">
																	<ShieldAlert
																		className={`h-4 w-4 ${getRiskColor(derivative.riskScore)}`}
																	/>
																	<span className="text-xs text-muted-foreground">
																		Risk: {derivative.riskScore}/10
																	</span>
																</div>
															</div>
															<Button
																size="sm"
																className="bg-purple-600 hover:bg-purple-700"
																data-testid={`button-add-derivative-${derivative.id}`}
															>
																Add to Proposal
															</Button>
														</div>
													</div>
												</div>
											</CardContent>
										</Card>
									))}
								</div>
							</div>
						)}
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
