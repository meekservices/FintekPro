import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
	TrendingUp,
	TrendingDown,
	Target,
	BarChart3,
	Calendar,
	Calculator,
	Layers,
	Activity,
	RefreshCw,
	ChevronRight,
	Sparkles,
	ArrowUpDown,
	Info,
	Plus,
	Trash2,
} from "lucide-react";
import {
	LineChart,
	Line,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
	ReferenceLine,
	Area,
	AreaChart,
} from "recharts";

interface OptionData {
	strikePrice: number;
	expiryDate: string;
	optionType: "CE" | "PE";
	openInterest: number;
	changeinOpenInterest: number;
	totalTradedVolume: number;
	impliedVolatility: number;
	lastPrice: number;
	change: number;
	pChange: number;
	bidQty: number;
	bidPrice: number;
	askQty: number;
	askPrice: number;
	underlyingValue: number;
}

interface OptionsChain {
	symbol: string;
	underlyingValue: number;
	expiryDates: string[];
	strikePrices: number[];
	options: {
		calls: OptionData[];
		puts: OptionData[];
	};
	timestamp: string;
}

interface FuturesData {
	symbol: string;
	expiryDate: string;
	lastPrice: number;
	change: number;
	pChange: number;
	openInterest: number;
	changeinOpenInterest: number;
	totalTradedVolume: number;
	underlyingValue: number;
	premium: number;
	basis: number;
	basisPct: number;
}

interface Greeks {
	delta: number;
	gamma: number;
	theta: number;
	vega: number;
	rho: number;
	impliedVolatility: number;
}

interface StrategyLeg {
	id: string;
	type: "call" | "put" | "stock" | "future";
	action: "buy" | "sell";
	strikePrice: number;
	quantity: number;
	premium: number;
	expiryDate?: string;
}

interface PopularStrategy {
	name: string;
	description: string;
	outlook: "bullish" | "bearish" | "neutral" | "volatile";
	legs: Omit<StrategyLeg, "id" | "quantity" | "strikePrice" | "premium">[];
	riskReward: string;
}

export default function AgentDerivatives() {
	const { toast } = useToast();
	const [selectedSymbol, setSelectedSymbol] = useState("NIFTY");
	const [selectedExpiry, setSelectedExpiry] = useState<string>("");
	const [strategyLegs, setStrategyLegs] = useState<StrategyLeg[]>([]);
	const [showITM, setShowITM] = useState(true);
	const [selectedOption, setSelectedOption] = useState<OptionData | null>(null);

	const { data: symbolsData } = useQuery<{
		symbols: string[];
		lotSizes: Record<string, number>;
	}>({
		queryKey: ["/api/derivatives/symbols"],
	});

	const {
		data: optionsChain,
		isLoading: isLoadingChain,
		refetch: refetchChain,
	} = useQuery<OptionsChain>({
		queryKey: [
			"/api/derivatives/options-chain",
			selectedSymbol,
			selectedExpiry,
		],
		enabled: !!selectedSymbol,
	});

	const { data: futuresData, isLoading: isLoadingFutures } = useQuery<{
		symbol: string;
		futures: FuturesData[];
	}>({
		queryKey: ["/api/derivatives/futures", selectedSymbol],
		enabled: !!selectedSymbol,
	});

	const { data: strategiesData } = useQuery<{ strategies: PopularStrategy[] }>({
		queryKey: ["/api/derivatives/strategies"],
	});

	const { data: expiryCalendar } = useQuery<{
		calendar: { date: string; type: "weekly" | "monthly"; symbols: string[] }[];
	}>({
		queryKey: ["/api/derivatives/expiry-calendar"],
	});

	const greeksMutation = useMutation({
		mutationFn: async (params: {
			spotPrice: number;
			strikePrice: number;
			daysToExpiry: number;
			volatility: number;
			optionType: "call" | "put";
		}) => {
			const res = await apiRequest("/api/derivatives/greeks", {
				method: "POST",
				body: JSON.stringify(params),
				headers: { "Content-Type": "application/json" },
			});
			return res as Greeks;
		},
	});

	const payoffMutation = useMutation({
		mutationFn: async (params: { legs: any[]; spotPrice: number }) => {
			const res = await apiRequest("/api/derivatives/strategy-payoff", {
				method: "POST",
				body: JSON.stringify(params),
				headers: { "Content-Type": "application/json" },
			});
			return res;
		},
	});

	const marginMutation = useMutation({
		mutationFn: async (params: { symbol: string; legs: any[] }) => {
			const res = await apiRequest("/api/derivatives/margin", {
				method: "POST",
				body: JSON.stringify(params),
				headers: { "Content-Type": "application/json" },
			});
			return res;
		},
	});

	const handleSymbolChange = (symbol: string) => {
		setSelectedSymbol(symbol);
		setSelectedExpiry("");
		setStrategyLegs([]);
	};

	const addLegFromOption = (option: OptionData, action: "buy" | "sell") => {
		const newLeg: StrategyLeg = {
			id: Date.now().toString(),
			type: option.optionType === "CE" ? "call" : "put",
			action,
			strikePrice: option.strikePrice,
			quantity: 1,
			premium: option.lastPrice,
			expiryDate: option.expiryDate,
		};
		setStrategyLegs([...strategyLegs, newLeg]);
		toast({
			title: "Leg Added",
			description: `${action === "buy" ? "Buy" : "Sell"} ${option.optionType} ${option.strikePrice} @ ₹${option.lastPrice.toFixed(2)}`,
		});
	};

	const removeLeg = (id: string) => {
		setStrategyLegs(strategyLegs.filter((leg) => leg.id !== id));
	};

	const updateLegQuantity = (id: string, quantity: number) => {
		setStrategyLegs(
			strategyLegs.map((leg) => (leg.id === id ? { ...leg, quantity } : leg)),
		);
	};

	const calculatePayoff = () => {
		if (strategyLegs.length === 0 || !optionsChain) return;

		const legs = strategyLegs.map((leg) => ({
			type: leg.type,
			action: leg.action,
			strikePrice: leg.strikePrice,
			quantity: leg.quantity * (symbolsData?.lotSizes[selectedSymbol] || 1),
			premium: leg.premium,
		}));

		payoffMutation.mutate({ legs, spotPrice: optionsChain.underlyingValue });
		marginMutation.mutate({ symbol: selectedSymbol, legs });
	};

	const getATMStrike = () => {
		if (!optionsChain) return 0;
		const interval = selectedSymbol === "BANKNIFTY" ? 100 : 50;
		return Math.round(optionsChain.underlyingValue / interval) * interval;
	};

	const filteredCalls =
		optionsChain?.options.calls.filter((c) => {
			if (!showITM) return c.strikePrice >= getATMStrike();
			return true;
		}) || [];

	const filteredPuts =
		optionsChain?.options.puts.filter((p) => {
			if (!showITM) return p.strikePrice <= getATMStrike();
			return true;
		}) || [];

	const formatNumber = (num: number) => {
		if (num >= 10000000) return (num / 10000000).toFixed(2) + " Cr";
		if (num >= 100000) return (num / 100000).toFixed(2) + " L";
		if (num >= 1000) return (num / 1000).toFixed(2) + " K";
		return num.toFixed(0);
	};

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold" data-testid="text-page-title">
						F&O Analytics
					</h1>
					<p className="text-muted-foreground">
						Futures & Options analysis with Greeks and strategy builder
					</p>
				</div>
				<div className="flex items-center gap-4">
					<Select value={selectedSymbol} onValueChange={handleSymbolChange}>
						<SelectTrigger className="w-48" data-testid="select-symbol">
							<SelectValue placeholder="Select Symbol" />
						</SelectTrigger>
						<SelectContent>
							{symbolsData?.symbols.map((symbol) => (
								<SelectItem key={symbol} value={symbol}>
									{symbol}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Button
						variant="outline"
						onClick={() => refetchChain()}
						data-testid="button-refresh"
					>
						<RefreshCw className="h-4 w-4 mr-2" />
						Refresh
					</Button>
				</div>
			</div>

			{optionsChain && (
				<div className="grid grid-cols-4 gap-4">
					<Card>
						<CardContent className="p-4">
							<div className="flex items-center justify-between">
								<span className="text-sm text-muted-foreground">
									Spot Price
								</span>
								<Activity className="h-4 w-4 text-muted-foreground" />
							</div>
							<p className="text-2xl font-bold" data-testid="text-spot-price">
								₹
								{optionsChain.underlyingValue.toLocaleString("en-IN", {
									maximumFractionDigits: 2,
								})}
							</p>
						</CardContent>
					</Card>
					<Card>
						<CardContent className="p-4">
							<div className="flex items-center justify-between">
								<span className="text-sm text-muted-foreground">
									ATM Strike
								</span>
								<Target className="h-4 w-4 text-muted-foreground" />
							</div>
							<p className="text-2xl font-bold" data-testid="text-atm-strike">
								{getATMStrike()}
							</p>
						</CardContent>
					</Card>
					<Card>
						<CardContent className="p-4">
							<div className="flex items-center justify-between">
								<span className="text-sm text-muted-foreground">Lot Size</span>
								<Layers className="h-4 w-4 text-muted-foreground" />
							</div>
							<p className="text-2xl font-bold" data-testid="text-lot-size">
								{symbolsData?.lotSizes[selectedSymbol] || "-"}
							</p>
						</CardContent>
					</Card>
					<Card>
						<CardContent className="p-4">
							<div className="flex items-center justify-between">
								<span className="text-sm text-muted-foreground">Expiry</span>
								<Calendar className="h-4 w-4 text-muted-foreground" />
							</div>
							<Select
								value={selectedExpiry || optionsChain.expiryDates[0]}
								onValueChange={setSelectedExpiry}
							>
								<SelectTrigger className="mt-1" data-testid="select-expiry">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{optionsChain.expiryDates.map((exp) => (
										<SelectItem key={exp} value={exp}>
											{new Date(exp).toLocaleDateString("en-IN", {
												day: "2-digit",
												month: "short",
											})}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</CardContent>
					</Card>
				</div>
			)}

			<Tabs defaultValue="chain" className="space-y-4">
				<ScrollableTabsList>
					<TabsTrigger value="chain" data-testid="tab-chain">
						<BarChart3 className="h-4 w-4 mr-2" />
						Options Chain
					</TabsTrigger>
					<TabsTrigger value="futures" data-testid="tab-futures">
						<TrendingUp className="h-4 w-4 mr-2" />
						Futures
					</TabsTrigger>
					<TabsTrigger value="strategy" data-testid="tab-strategy">
						<Layers className="h-4 w-4 mr-2" />
						Strategy Builder
					</TabsTrigger>
					<TabsTrigger value="greeks" data-testid="tab-greeks">
						<Calculator className="h-4 w-4 mr-2" />
						Greeks Calculator
					</TabsTrigger>
					<TabsTrigger value="calendar" data-testid="tab-calendar">
						<Calendar className="h-4 w-4 mr-2" />
						Expiry Calendar
					</TabsTrigger>
				</ScrollableTabsList>

				<TabsContent value="chain" className="space-y-4">
					<Card>
						<CardHeader className="pb-2">
							<div className="flex items-center justify-between">
								<CardTitle>Options Chain - {selectedSymbol}</CardTitle>
								<div className="flex items-center gap-2">
									<Label className="text-sm">Show ITM</Label>
									<Switch
										checked={showITM}
										onCheckedChange={setShowITM}
										data-testid="switch-itm"
									/>
								</div>
							</div>
							<CardDescription>
								Click on premium to add to strategy
							</CardDescription>
						</CardHeader>
						<CardContent>
							{isLoadingChain ? (
								<div className="flex items-center justify-center h-64">
									<RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
								</div>
							) : (
								<div className="overflow-x-auto">
									<Table>
										<TableHeader>
											<TableRow className="bg-green-50 dark:bg-green-950">
												<TableHead className="text-center">OI</TableHead>
												<TableHead className="text-center">Chg OI</TableHead>
												<TableHead className="text-center">Volume</TableHead>
												<TableHead className="text-center">IV%</TableHead>
												<TableHead className="text-center text-green-600">
													CALLS
												</TableHead>
												<TableHead className="text-center font-bold bg-muted">
													STRIKE
												</TableHead>
												<TableHead className="text-center text-red-600">
													PUTS
												</TableHead>
												<TableHead className="text-center">IV%</TableHead>
												<TableHead className="text-center">Volume</TableHead>
												<TableHead className="text-center">Chg OI</TableHead>
												<TableHead className="text-center">OI</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{optionsChain?.strikePrices.slice(5, 26).map((strike) => {
												const call = filteredCalls.find(
													(c) => c.strikePrice === strike,
												);
												const put = filteredPuts.find(
													(p) => p.strikePrice === strike,
												);
												const isATM = strike === getATMStrike();
												const isITMCall =
													strike < (optionsChain?.underlyingValue || 0);
												const isITMPut =
													strike > (optionsChain?.underlyingValue || 0);

												return (
													<TableRow
														key={strike}
														className={`${isATM ? "bg-yellow-50 dark:bg-yellow-950" : ""}`}
													>
														<TableCell
															className={`text-center text-xs ${isITMCall ? "bg-green-50 dark:bg-green-950/50" : ""}`}
														>
															{call ? formatNumber(call.openInterest) : "-"}
														</TableCell>
														<TableCell
															className={`text-center text-xs ${isITMCall ? "bg-green-50 dark:bg-green-950/50" : ""} ${call?.changeinOpenInterest && call.changeinOpenInterest > 0 ? "text-green-600" : "text-red-600"}`}
														>
															{call
																? formatNumber(call.changeinOpenInterest)
																: "-"}
														</TableCell>
														<TableCell
															className={`text-center text-xs ${isITMCall ? "bg-green-50 dark:bg-green-950/50" : ""}`}
														>
															{call
																? formatNumber(call.totalTradedVolume)
																: "-"}
														</TableCell>
														<TableCell
															className={`text-center text-xs ${isITMCall ? "bg-green-50 dark:bg-green-950/50" : ""}`}
														>
															{call ? call.impliedVolatility.toFixed(1) : "-"}
														</TableCell>
														<TableCell
															className={`text-center ${isITMCall ? "bg-green-50 dark:bg-green-950/50" : ""}`}
														>
															{call && (
																<div className="flex items-center justify-center gap-1">
																	<Button
																		variant="ghost"
																		size="sm"
																		className="h-6 px-2 text-green-600 hover:bg-green-100 dark:bg-green-900/30"
																		onClick={() =>
																			addLegFromOption(call, "buy")
																		}
																		data-testid={`button-buy-call-${strike}`}
																	>
																		B
																	</Button>
																	<span
																		className={`font-medium ${call.pChange >= 0 ? "text-green-600" : "text-red-600"}`}
																	>
																		{call.lastPrice.toFixed(2)}
																	</span>
																	<Button
																		variant="ghost"
																		size="sm"
																		className="h-6 px-2 text-red-600 hover:bg-red-100 dark:bg-red-900/30"
																		onClick={() =>
																			addLegFromOption(call, "sell")
																		}
																		data-testid={`button-sell-call-${strike}`}
																	>
																		S
																	</Button>
																</div>
															)}
														</TableCell>
														<TableCell className="text-center font-bold bg-muted">
															{strike}
															{isATM && (
																<Badge
																	variant="outline"
																	className="ml-1 text-xs"
																>
																	ATM
																</Badge>
															)}
														</TableCell>
														<TableCell
															className={`text-center ${isITMPut ? "bg-red-50 dark:bg-red-950/50" : ""}`}
														>
															{put && (
																<div className="flex items-center justify-center gap-1">
																	<Button
																		variant="ghost"
																		size="sm"
																		className="h-6 px-2 text-green-600 hover:bg-green-100 dark:bg-green-900/30"
																		onClick={() => addLegFromOption(put, "buy")}
																		data-testid={`button-buy-put-${strike}`}
																	>
																		B
																	</Button>
																	<span
																		className={`font-medium ${put.pChange >= 0 ? "text-green-600" : "text-red-600"}`}
																	>
																		{put.lastPrice.toFixed(2)}
																	</span>
																	<Button
																		variant="ghost"
																		size="sm"
																		className="h-6 px-2 text-red-600 hover:bg-red-100 dark:bg-red-900/30"
																		onClick={() =>
																			addLegFromOption(put, "sell")
																		}
																		data-testid={`button-sell-put-${strike}`}
																	>
																		S
																	</Button>
																</div>
															)}
														</TableCell>
														<TableCell
															className={`text-center text-xs ${isITMPut ? "bg-red-50 dark:bg-red-950/50" : ""}`}
														>
															{put ? put.impliedVolatility.toFixed(1) : "-"}
														</TableCell>
														<TableCell
															className={`text-center text-xs ${isITMPut ? "bg-red-50 dark:bg-red-950/50" : ""}`}
														>
															{put ? formatNumber(put.totalTradedVolume) : "-"}
														</TableCell>
														<TableCell
															className={`text-center text-xs ${isITMPut ? "bg-red-50 dark:bg-red-950/50" : ""} ${put?.changeinOpenInterest && put.changeinOpenInterest > 0 ? "text-green-600" : "text-red-600"}`}
														>
															{put
																? formatNumber(put.changeinOpenInterest)
																: "-"}
														</TableCell>
														<TableCell
															className={`text-center text-xs ${isITMPut ? "bg-red-50 dark:bg-red-950/50" : ""}`}
														>
															{put ? formatNumber(put.openInterest) : "-"}
														</TableCell>
													</TableRow>
												);
											})}
										</TableBody>
									</Table>
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="futures" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle>Futures - {selectedSymbol}</CardTitle>
							<CardDescription>
								Current, Next, and Far month contracts
							</CardDescription>
						</CardHeader>
						<CardContent>
							{isLoadingFutures ? (
								<div className="flex items-center justify-center h-32">
									<RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
								</div>
							) : (
								<div className="grid grid-cols-3 gap-4">
									{futuresData?.futures.map((fut, idx) => (
										<Card
											key={fut.expiryDate}
											className={idx === 0 ? "border-primary" : ""}
										>
											<CardHeader className="pb-2">
												<div className="flex items-center justify-between">
													<CardTitle className="text-lg">
														{["Current", "Next", "Far"][idx]} Month
													</CardTitle>
													{idx === 0 && <Badge>Active</Badge>}
												</div>
												<CardDescription>
													{new Date(fut.expiryDate).toLocaleDateString(
														"en-IN",
														{ day: "2-digit", month: "short", year: "numeric" },
													)}
												</CardDescription>
											</CardHeader>
											<CardContent className="space-y-4">
												<div className="flex items-center justify-between">
													<span className="text-2xl font-bold">
														₹
														{fut.lastPrice.toLocaleString("en-IN", {
															maximumFractionDigits: 2,
														})}
													</span>
													<Badge
														variant={
															fut.pChange >= 0 ? "default" : "destructive"
														}
														className="flex items-center gap-1"
													>
														{fut.pChange >= 0 ? (
															<TrendingUp className="h-3 w-3" />
														) : (
															<TrendingDown className="h-3 w-3" />
														)}
														{fut.pChange.toFixed(2)}%
													</Badge>
												</div>
												<Separator />
												<div className="grid grid-cols-2 gap-2 text-sm">
													<div>
														<span className="text-muted-foreground">Basis</span>
														<p
															className={`font-medium ${fut.basis >= 0 ? "text-green-600" : "text-red-600"}`}
														>
															₹{fut.basis.toFixed(2)} ({fut.basisPct.toFixed(2)}
															%)
														</p>
													</div>
													<div>
														<span className="text-muted-foreground">OI</span>
														<p className="font-medium">
															{formatNumber(fut.openInterest)}
														</p>
													</div>
													<div>
														<span className="text-muted-foreground">
															Volume
														</span>
														<p className="font-medium">
															{formatNumber(fut.totalTradedVolume)}
														</p>
													</div>
													<div>
														<span className="text-muted-foreground">
															OI Change
														</span>
														<p
															className={`font-medium ${fut.changeinOpenInterest >= 0 ? "text-green-600" : "text-red-600"}`}
														>
															{formatNumber(fut.changeinOpenInterest)}
														</p>
													</div>
												</div>
											</CardContent>
										</Card>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="strategy" className="space-y-4">
					<div className="grid grid-cols-2 gap-4">
						<Card>
							<CardHeader>
								<CardTitle>Strategy Builder</CardTitle>
								<CardDescription>
									Build multi-leg options strategies
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								{strategyLegs.length === 0 ? (
									<div className="text-center py-8 text-muted-foreground">
										<Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
										<p>No legs added yet</p>
										<p className="text-sm">
											Click on options in the chain to add legs
										</p>
									</div>
								) : (
									<>
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>Type</TableHead>
													<TableHead>Strike</TableHead>
													<TableHead>Action</TableHead>
													<TableHead>Qty</TableHead>
													<TableHead>Premium</TableHead>
													<TableHead />
												</TableRow>
											</TableHeader>
											<TableBody>
												{strategyLegs.map((leg) => (
													<TableRow key={leg.id}>
														<TableCell>
															<Badge
																variant={
																	leg.type === "call" ? "default" : "secondary"
																}
															>
																{(leg.type || "call").toUpperCase()}
															</Badge>
														</TableCell>
														<TableCell>{leg.strikePrice}</TableCell>
														<TableCell>
															<Badge
																variant={
																	leg.action === "buy"
																		? "outline"
																		: "destructive"
																}
															>
																{(leg.action || "buy").toUpperCase()}
															</Badge>
														</TableCell>
														<TableCell>
															<Input
																type="number"
																value={leg.quantity}
																onChange={(e) =>
																	updateLegQuantity(
																		leg.id,
																		Number.parseInt(e.target.value) || 1,
																	)
																}
																className="w-16 h-8"
																min={1}
																data-testid={`input-qty-${leg.id}`}
															/>
														</TableCell>
														<TableCell>₹{leg.premium.toFixed(2)}</TableCell>
														<TableCell>
															<Button
																variant="ghost"
																size="sm"
																onClick={() => removeLeg(leg.id)}
																data-testid={`button-remove-${leg.id}`}
															>
																<Trash2 className="h-4 w-4 text-red-500" />
															</Button>
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
										<Button
											onClick={calculatePayoff}
											className="w-full"
											data-testid="button-analyze"
										>
											<Sparkles className="h-4 w-4 mr-2" />
											Analyze Strategy
										</Button>
									</>
								)}
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Popular Strategies</CardTitle>
								<CardDescription>Pre-built option strategies</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="space-y-2">
									{strategiesData?.strategies.slice(0, 6).map((strategy) => (
										<div
											key={strategy.name}
											className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
										>
											<div>
												<p className="font-medium">{strategy.name}</p>
												<p className="text-xs text-muted-foreground">
													{strategy.description}
												</p>
											</div>
											<div className="flex items-center gap-2">
												<Badge
													variant={
														strategy.outlook === "bullish"
															? "default"
															: strategy.outlook === "bearish"
																? "destructive"
																: strategy.outlook === "volatile"
																	? "secondary"
																	: "outline"
													}
												>
													{strategy.outlook}
												</Badge>
												<ChevronRight className="h-4 w-4" />
											</div>
										</div>
									))}
								</div>
							</CardContent>
						</Card>
					</div>

					{payoffMutation.data && (
						<Card>
							<CardHeader>
								<div className="flex items-center justify-between">
									<div>
										<CardTitle>{payoffMutation.data.strategy}</CardTitle>
										<CardDescription>Payoff analysis at expiry</CardDescription>
									</div>
									{marginMutation.data && (
										<div className="text-right">
											<p className="text-sm text-muted-foreground">
												Total Margin Required
											</p>
											<p className="text-xl font-bold">
												₹
												{marginMutation.data.totalMargin.toLocaleString(
													"en-IN",
												)}
											</p>
										</div>
									)}
								</div>
							</CardHeader>
							<CardContent>
								<div className="grid grid-cols-4 gap-4 mb-6">
									<div className="p-4 rounded-lg bg-green-50 dark:bg-green-950">
										<p className="text-sm text-muted-foreground">Max Profit</p>
										<p className="text-xl font-bold text-green-600">
											{payoffMutation.data.maxProfit === "unlimited"
												? "Unlimited"
												: `₹${payoffMutation.data.maxProfit.toLocaleString("en-IN")}`}
										</p>
									</div>
									<div className="p-4 rounded-lg bg-red-50 dark:bg-red-950">
										<p className="text-sm text-muted-foreground">Max Loss</p>
										<p className="text-xl font-bold text-red-600">
											{payoffMutation.data.maxLoss === "unlimited"
												? "Unlimited"
												: `₹${Math.abs(payoffMutation.data.maxLoss).toLocaleString("en-IN")}`}
										</p>
									</div>
									<div className="p-4 rounded-lg bg-muted">
										<p className="text-sm text-muted-foreground">Breakeven</p>
										<p className="text-xl font-bold">
											{payoffMutation.data.breakeven.length > 0
												? payoffMutation.data.breakeven
														.map((b: number) => b.toFixed(0))
														.join(", ")
												: "-"}
										</p>
									</div>
									{marginMutation.data && (
										<div className="p-4 rounded-lg bg-muted">
											<p className="text-sm text-muted-foreground">Premium</p>
											<p className="text-xl font-bold">
												₹{marginMutation.data.premium.toLocaleString("en-IN")}
											</p>
										</div>
									)}
								</div>
								<ResponsiveContainer width="100%" height={300}>
									<AreaChart data={payoffMutation.data.payoffData}>
										<CartesianGrid strokeDasharray="3 3" />
										<XAxis
											dataKey="price"
											tickFormatter={(v) => v.toFixed(0)}
										/>
										<YAxis tickFormatter={(v) => `₹${v.toFixed(0)}`} />
										<Tooltip
											formatter={(value: number) => [
												`₹${value.toFixed(2)}`,
												"P&L",
											]}
											labelFormatter={(label) => `Spot: ${label}`}
										/>
										<ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
										<defs>
											<linearGradient
												id="profitGradient"
												x1="0"
												y1="0"
												x2="0"
												y2="1"
											>
												<stop
													offset="0%"
													stopColor="#22c55e"
													stopOpacity={0.3}
												/>
												<stop
													offset="50%"
													stopColor="#22c55e"
													stopOpacity={0}
												/>
												<stop
													offset="50%"
													stopColor="#ef4444"
													stopOpacity={0}
												/>
												<stop
													offset="100%"
													stopColor="#ef4444"
													stopOpacity={0.3}
												/>
											</linearGradient>
										</defs>
										<Area
											type="monotone"
											dataKey="profit"
											stroke="#2563eb"
											fill="url(#profitGradient)"
										/>
									</AreaChart>
								</ResponsiveContainer>
							</CardContent>
						</Card>
					)}
				</TabsContent>

				<TabsContent value="greeks" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle>Greeks Calculator</CardTitle>
							<CardDescription>
								Calculate option Greeks using Black-Scholes model
							</CardDescription>
						</CardHeader>
						<CardContent>
							<GreeksCalculator
								spotPrice={optionsChain?.underlyingValue || 0}
								onCalculate={greeksMutation.mutate}
								result={greeksMutation.data}
								isLoading={greeksMutation.isPending}
							/>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="calendar" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle>Expiry Calendar</CardTitle>
							<CardDescription>Upcoming F&O expiry dates</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-2">
								{expiryCalendar?.calendar.map((exp) => (
									<div
										key={exp.date}
										className="flex items-center justify-between p-4 rounded-lg border"
									>
										<div className="flex items-center gap-4">
											<div
												className={`w-12 h-12 rounded-lg flex items-center justify-center ${exp.type === "monthly" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
											>
												<span className="text-lg font-bold">
													{new Date(exp.date).getDate()}
												</span>
											</div>
											<div>
												<p className="font-medium">
													{new Date(exp.date).toLocaleDateString("en-IN", {
														weekday: "long",
														day: "2-digit",
														month: "short",
														year: "numeric",
													})}
												</p>
												<div className="flex items-center gap-2 mt-1">
													<Badge
														variant={
															exp.type === "monthly" ? "default" : "outline"
														}
													>
														{exp.type}
													</Badge>
													<span className="text-xs text-muted-foreground">
														{exp.symbols.slice(0, 5).join(", ")}
														{exp.symbols.length > 5
															? ` +${exp.symbols.length - 5} more`
															: ""}
													</span>
												</div>
											</div>
										</div>
										<div className="text-right">
											<p className="text-sm text-muted-foreground">
												Days to expiry
											</p>
											<p className="text-xl font-bold">
												{Math.ceil(
													(new Date(exp.date).getTime() - Date.now()) /
														(1000 * 60 * 60 * 24),
												)}
											</p>
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}

function GreeksCalculator({
	spotPrice,
	onCalculate,
	result,
	isLoading,
}: {
	spotPrice: number;
	onCalculate: (params: any) => void;
	result?: Greeks;
	isLoading: boolean;
}) {
	const [strike, setStrike] = useState(spotPrice || 24500);
	const [days, setDays] = useState(7);
	const [iv, setIV] = useState(15);
	const [optionType, setOptionType] = useState<"call" | "put">("call");

	const handleCalculate = () => {
		onCalculate({
			spotPrice,
			strikePrice: strike,
			daysToExpiry: days,
			volatility: iv,
			optionType,
		});
	};

	return (
		<div className="grid grid-cols-2 gap-6">
			<div className="space-y-4">
				<div className="grid grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label>Spot Price</Label>
						<Input
							value={spotPrice.toFixed(2)}
							disabled
							data-testid="input-spot-price"
						/>
					</div>
					<div className="space-y-2">
						<Label>Strike Price</Label>
						<Input
							type="number"
							value={strike}
							onChange={(e) =>
								setStrike(Number.parseFloat(e.target.value) || 0)
							}
							data-testid="input-strike-price"
						/>
					</div>
					<div className="space-y-2">
						<Label>Days to Expiry</Label>
						<Input
							type="number"
							value={days}
							onChange={(e) => setDays(Number.parseInt(e.target.value) || 1)}
							min={1}
							data-testid="input-days"
						/>
					</div>
					<div className="space-y-2">
						<Label>Implied Volatility (%)</Label>
						<Input
							type="number"
							value={iv}
							onChange={(e) => setIV(Number.parseFloat(e.target.value) || 15)}
							data-testid="input-iv"
						/>
					</div>
				</div>
				<div className="space-y-2">
					<Label>Option Type</Label>
					<Select
						value={optionType}
						onValueChange={(v: "call" | "put") => setOptionType(v)}
					>
						<SelectTrigger data-testid="select-option-type">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="call">Call Option (CE)</SelectItem>
							<SelectItem value="put">Put Option (PE)</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<Button
					onClick={handleCalculate}
					disabled={isLoading}
					className="w-full"
					data-testid="button-calculate-greeks"
				>
					{isLoading ? (
						<RefreshCw className="h-4 w-4 mr-2 animate-spin" />
					) : (
						<Calculator className="h-4 w-4 mr-2" />
					)}
					Calculate Greeks
				</Button>
			</div>

			{result && (
				<div className="grid grid-cols-2 gap-4">
					<div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950">
						<div className="flex items-center gap-2 mb-2">
							<span className="text-2xl font-bold">Δ</span>
							<span className="text-sm text-muted-foreground">Delta</span>
						</div>
						<p className="text-3xl font-bold">{result.delta.toFixed(4)}</p>
						<p className="text-xs text-muted-foreground mt-1">
							Price change per ₹1 move
						</p>
					</div>
					<div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950">
						<div className="flex items-center gap-2 mb-2">
							<span className="text-2xl font-bold">Γ</span>
							<span className="text-sm text-muted-foreground">Gamma</span>
						</div>
						<p className="text-3xl font-bold">{result.gamma.toFixed(4)}</p>
						<p className="text-xs text-muted-foreground mt-1">
							Delta change per ₹1 move
						</p>
					</div>
					<div className="p-4 rounded-lg bg-red-50 dark:bg-red-950">
						<div className="flex items-center gap-2 mb-2">
							<span className="text-2xl font-bold">Θ</span>
							<span className="text-sm text-muted-foreground">Theta</span>
						</div>
						<p className="text-3xl font-bold">{result.theta.toFixed(2)}</p>
						<p className="text-xs text-muted-foreground mt-1">
							Daily time decay (₹)
						</p>
					</div>
					<div className="p-4 rounded-lg bg-green-50 dark:bg-green-950">
						<div className="flex items-center gap-2 mb-2">
							<span className="text-2xl font-bold">ν</span>
							<span className="text-sm text-muted-foreground">Vega</span>
						</div>
						<p className="text-3xl font-bold">{result.vega.toFixed(2)}</p>
						<p className="text-xs text-muted-foreground mt-1">
							Price change per 1% IV
						</p>
					</div>
					<div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950 col-span-2">
						<div className="flex items-center gap-2 mb-2">
							<span className="text-2xl font-bold">ρ</span>
							<span className="text-sm text-muted-foreground">Rho</span>
						</div>
						<p className="text-3xl font-bold">{result.rho.toFixed(2)}</p>
						<p className="text-xs text-muted-foreground mt-1">
							Price change per 1% interest rate
						</p>
					</div>
				</div>
			)}
		</div>
	);
}
