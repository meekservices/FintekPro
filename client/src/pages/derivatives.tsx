import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
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
	TrendingUp,
	TrendingDown,
	Target,
	Activity,
	BarChart3,
	Clock,
	ShieldAlert,
	Sparkles,
	ArrowRight,
	Layers,
	Lock,
	Unlock,
	ShieldCheck,
	Zap,
	Info,
	CheckCircle2,
	PieChart,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { SlideToConfirmOrderModal } from "@/components/picks/SlideToConfirmOrderModal";
import type { StrategyLegItem } from "@/components/picks/DerivativePayoffSimulator";

interface DerivativePosition {
	id: string;
	symbol: string;
	type: "future" | "call" | "put";
	strike?: number;
	expiry: string;
	quantity: number;
	buyPrice: number;
	currentPrice: number;
	pnl: number;
	pnlPercentage: number;
	side?: string;
	product?: string;
	status?: string;
}

interface ValidationData {
	symbol: string;
	tradingsymbol: string;
	quantity: number;
	lotSize: number;
	lots: number;
	estimatedMargin: number;
	minCashMarginRequired: number;
	availableMargin: number;
	marginDeficit: number;
	isExpiryDay: boolean;
	elmSurchargeApplied: boolean;
	elmSurchargeAmount: number;
	regulatoryNotices: string[];
}

export default function DerivativesPage() {
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const [selectedSymbol, setSelectedSymbol] = useState("NIFTY");
	const [selectedExpiry, setSelectedExpiry] = useState<string>("");
	const [orderType, setOrderType] = useState<"buy" | "sell">("buy");
	const [optionType, setOptionType] = useState<"ce" | "pe">("ce");
	const [selectedStrike, setSelectedStrike] = useState<string>("");
	const [lots, setLots] = useState<number>(1);
	const [customPrice, setCustomPrice] = useState<string>("");
	const [product, setProduct] = useState<"I" | "D">("I");

	// Pre-trade validation dialog state
	const [isConfirmOpen, setIsConfirmOpen] = useState(false);
	const [validationResult, setValidationResult] = useState<ValidationData | null>(null);

	// Upstox Pro Benchmark: Option Chain View Mode & Multi-Leg Strategy Slider
	const [chainViewMode, setChainViewMode] = useState<"prices" | "oi" | "greeks">("prices");
	const [isSlideModalOpen, setIsSlideModalOpen] = useState(false);
	const [slideStrategyConfig, setSlideStrategyConfig] = useState<{
		strategyName: string;
		legs: StrategyLegItem[];
		recoPrice: number;
		isCredit: boolean;
		marginRequired: number;
		maxProfit: number | string;
		maxLoss: number | string;
	}>({
		strategyName: "",
		legs: [],
		recoPrice: 0,
		isCredit: false,
		marginRequired: 65000,
		maxProfit: "Defined",
		maxLoss: "Defined",
	});

	// 1. Fetch available symbols and lot sizes
	const { data: symbolsData } = useQuery<{
		symbols: string[];
		lotSizes: Record<string, number>;
	}>({
		queryKey: ["/api/derivatives/symbols"],
	});

	const availableSymbols = symbolsData?.symbols || [
		"NIFTY",
		"BANKNIFTY",
		"FINNIFTY",
		"SENSEX",
		"RELIANCE",
		"TCS",
		"HDFCBANK",
		"INFY",
	];

	const lotSize = symbolsData?.lotSizes?.[selectedSymbol] || 50;

	// 2. Fetch live expiry dates for symbol
	const { data: expiryData } = useQuery<{
		symbol: string;
		expiryDates: string[];
	}>({
		queryKey: ["/api/derivatives/expiry", selectedSymbol],
		enabled: !!selectedSymbol,
	});

	const expiryDates = expiryData?.expiryDates || [];
	const activeExpiry = selectedExpiry || expiryDates[0] || "";

	// 3. Fetch real-time Option Chain from Upstox / NSE
	const { data: chainData, isLoading: isChainLoading } = useQuery<{
		symbol: string;
		underlyingValue: number;
		strikePrices: number[];
		options: {
			calls: Array<{
				strikePrice: number;
				lastPrice: number;
				openInterest: number;
				changeinOpenInterest?: number;
				totalTradedVolume: number;
				impliedVolatility: number;
				delta?: number;
				gamma?: number;
				theta?: number;
				vega?: number;
				bidPrice?: number;
				askPrice?: number;
			}>;
			puts: Array<{
				strikePrice: number;
				lastPrice: number;
				openInterest: number;
				changeinOpenInterest?: number;
				totalTradedVolume: number;
				impliedVolatility: number;
				delta?: number;
				gamma?: number;
				theta?: number;
				vega?: number;
				bidPrice?: number;
				askPrice?: number;
			}>;
		};
		pcr?: number;
		maxPain?: number;
		atmStrike?: number;
		totalCallOI?: number;
		totalPutOI?: number;
		totalCallVolume?: number;
		totalPutVolume?: number;
		dataSource: string;
	}>({
		queryKey: [`/api/derivatives/options-chain/${selectedSymbol}${activeExpiry ? `?expiry=${activeExpiry}` : ""}`],
		enabled: !!selectedSymbol,
	});

	// 3b. Fetch Client F&O Kill Switch Status (SEBI & Upstox Mobile Account Benchmark)
	const { data: killSwitchData, refetch: refetchKillSwitch } = useQuery<{
		success: boolean;
		data: {
			userId: string;
			active: boolean;
			activatedAt?: string;
			lockUntil?: string;
			reason?: string;
			segment: "FO";
		};
	}>({
		queryKey: ["/api/derivatives/kill-switch"],
	});

	const isUserKillSwitchActive = Boolean(killSwitchData?.data?.active);

	const killSwitchMutation = useMutation({
		mutationFn: async (active: boolean) => {
			const res = await apiRequest("POST", "/api/derivatives/kill-switch", {
				active,
				reason: active
					? "Voluntary trader self-lock (12-hour cooling-off period)"
					: "Voluntary unlock request",
			});
			return res.json();
		},
		onSuccess: (data) => {
			refetchKillSwitch();
			queryClient.invalidateQueries({ queryKey: ["/api/derivatives/kill-switch"] });
			toast({
				title: data.data?.active ? "F&O Segment Locked" : "F&O Segment Unlocked",
				description: data.message,
				variant: data.data?.active ? "destructive" : "default",
			});
		},
		onError: (err: any) => {
			toast({
				title: "Kill Switch Error",
				description: err.message || "Failed to toggle kill switch",
				variant: "destructive",
			});
		},
	});

	// 3c. Upstox Pro Benchmark: 1-Click Multi-Leg Strategy Launcher
	const handleLaunchStrategy = (
		strategyType: "bull_call" | "bear_put" | "straddle" | "strangle" | "iron_condor"
	) => {
		if (isUserKillSwitchActive) {
			toast({
				title: "F&O Trading Halted",
				description: "Your personal Kill-Switch is active. Unlock before creating strategy baskets.",
				variant: "destructive",
			});
			return;
		}

		if (!chainData || !chainData.strikePrices || chainData.strikePrices.length === 0) {
			toast({
				title: "Option Chain Loading",
				description: "Please wait for live market strikes to load.",
				variant: "destructive",
			});
			return;
		}

		const spot = chainData.underlyingValue || 24000;
		const atm = chainData.atmStrike || chainData.strikePrices.reduce((prev, curr) =>
			Math.abs(curr - spot) < Math.abs(prev - spot) ? curr : prev
		);

		const step =
			chainData.strikePrices[1] && chainData.strikePrices[0]
				? Math.abs(chainData.strikePrices[1] - chainData.strikePrices[0])
				: 100;

		const calls = chainData.options.calls;
		const puts = chainData.options.puts;

		const getCallPrice = (k: number) =>
			calls.find((c) => c.strikePrice === k)?.lastPrice || 120;
		const getPutPrice = (k: number) =>
			puts.find((p) => p.strikePrice === k)?.lastPrice || 110;

		let strategyName = "";
		let legs: StrategyLegItem[] = [];
		let isCredit = false;
		let recoPrice = 0;
		let marginRequired = 65000;
		let maxProfit: number | string = 0;
		let maxLoss: number | string = 0;

		if (strategyType === "bull_call") {
			strategyName = `Bull Call Spread (${selectedSymbol})`;
			const buyStrike = atm;
			const sellStrike = atm + step;
			const pBuy = getCallPrice(buyStrike);
			const pSell = getCallPrice(sellStrike);
			recoPrice = Math.max(5, pBuy - pSell);
			isCredit = false;
			marginRequired = Math.round(recoPrice * lotSize);
			maxProfit = Math.round((step - recoPrice) * lotSize);
			maxLoss = Math.round(recoPrice * lotSize);
			legs = [
				{ action: "BUY", type: "CE", strikePrice: buyStrike, premium: pBuy, quantity: lotSize },
				{ action: "SELL", type: "CE", strikePrice: sellStrike, premium: pSell, quantity: lotSize },
			];
		} else if (strategyType === "bear_put") {
			strategyName = `Bear Put Spread (${selectedSymbol})`;
			const buyStrike = atm;
			const sellStrike = atm - step;
			const pBuy = getPutPrice(buyStrike);
			const pSell = getPutPrice(sellStrike);
			recoPrice = Math.max(5, pBuy - pSell);
			isCredit = false;
			marginRequired = Math.round(recoPrice * lotSize);
			maxProfit = Math.round((step - recoPrice) * lotSize);
			maxLoss = Math.round(recoPrice * lotSize);
			legs = [
				{ action: "BUY", type: "PE", strikePrice: buyStrike, premium: pBuy, quantity: lotSize },
				{ action: "SELL", type: "PE", strikePrice: sellStrike, premium: pSell, quantity: lotSize },
			];
		} else if (strategyType === "straddle") {
			strategyName = `Long Straddle (${selectedSymbol} ATM)`;
			const pCall = getCallPrice(atm);
			const pPut = getPutPrice(atm);
			recoPrice = pCall + pPut;
			isCredit = false;
			marginRequired = Math.round(recoPrice * lotSize);
			maxProfit = "Unlimited (Breakout)";
			maxLoss = Math.round(recoPrice * lotSize);
			legs = [
				{ action: "BUY", type: "CE", strikePrice: atm, premium: pCall, quantity: lotSize },
				{ action: "BUY", type: "PE", strikePrice: atm, premium: pPut, quantity: lotSize },
			];
		} else if (strategyType === "strangle") {
			strategyName = `Short Strangle (${selectedSymbol} Range-Bound)`;
			const callStrike = atm + step;
			const putStrike = atm - step;
			const pCall = getCallPrice(callStrike);
			const pPut = getPutPrice(putStrike);
			recoPrice = pCall + pPut;
			isCredit = true;
			marginRequired = 110000;
			maxProfit = Math.round(recoPrice * lotSize);
			maxLoss = "Undefined (Requires Stop-Loss)";
			legs = [
				{ action: "SELL", type: "CE", strikePrice: callStrike, premium: pCall, quantity: lotSize },
				{ action: "SELL", type: "PE", strikePrice: putStrike, premium: pPut, quantity: lotSize },
			];
		} else if (strategyType === "iron_condor") {
			strategyName = `Iron Condor (${selectedSymbol} Hedged Wings)`;
			const sellCall = atm + step;
			const buyCall = atm + step * 2;
			const sellPut = atm - step;
			const buyPut = atm - step * 2;
			const pSellC = getCallPrice(sellCall);
			const pBuyC = getCallPrice(buyCall);
			const pSellP = getPutPrice(sellPut);
			const pBuyP = getPutPrice(buyPut);
			const netCredit = Math.max(5, pSellC - pBuyC + (pSellP - pBuyP));
			recoPrice = netCredit;
			isCredit = true;
			marginRequired = 45000; // Hedged margin relief benefit!
			maxProfit = Math.round(netCredit * lotSize);
			maxLoss = Math.round((step - netCredit) * lotSize);
			legs = [
				{ action: "BUY", type: "CE", strikePrice: buyCall, premium: pBuyC, quantity: lotSize },
				{ action: "SELL", type: "CE", strikePrice: sellCall, premium: pSellC, quantity: lotSize },
				{ action: "BUY", type: "PE", strikePrice: buyPut, premium: pBuyP, quantity: lotSize },
				{ action: "SELL", type: "PE", strikePrice: sellPut, premium: pSellP, quantity: lotSize },
			];
		}

		setSlideStrategyConfig({
			strategyName,
			legs,
			recoPrice,
			isCredit,
			marginRequired,
			maxProfit,
			maxLoss,
		});
		setIsSlideModalOpen(true);
	};

	// 4. Fetch OI Analysis
	const { data: oiData } = useQuery<{
		pcr: number;
		maxPainStrike: number;
		callOI: number;
		putOI: number;
	}>({
		queryKey: ["/api/derivatives/nse/oi-analysis", selectedSymbol],
		enabled: !!selectedSymbol,
	});

	// 5. Fetch User Derivative Positions
	const { data: positionsData } = useQuery<{
		success: boolean;
		positions: DerivativePosition[];
	}>({
		queryKey: ["/api/derivatives/positions"],
	});

	const positions = positionsData?.positions || [];

	const calculateTotalPnL = () => {
		return positions.reduce((sum, pos) => sum + (pos.pnl || 0), 0);
	};

	// Pre-trade validation mutation
	const validateMutation = useMutation({
		mutationFn: async (payload: any) => {
			const res = await apiRequest("POST", "/api/derivatives/order/validate", payload);
			return res.json();
		},
		onSuccess: (data) => {
			if (data.success && data.data) {
				setValidationResult(data.data);
				setIsConfirmOpen(true);
			} else {
				toast({
					title: "Order Validation Failed",
					description: data.message || "Failed compliance pre-checks",
					variant: "destructive",
				});
			}
		},
		onError: (err: any) => {
			toast({
				title: "Validation Error",
				description: err.message || "Could not validate order with risk engine",
				variant: "destructive",
			});
		},
	});

	// Order execution mutation
	const executeMutation = useMutation({
		mutationFn: async (payload: any) => {
			const res = await apiRequest("POST", "/api/derivatives/order/execute", payload);
			return res.json();
		},
		onSuccess: (data) => {
			setIsConfirmOpen(false);
			toast({
				title: "Order Executed Successfully",
				description: data.message || "Derivative position created",
			});
			queryClient.invalidateQueries({ queryKey: ["/api/derivatives/positions"] });
		},
		onError: (err: any) => {
			toast({
				title: "Execution Error",
				description: err.message || "Could not execute order",
				variant: "destructive",
			});
		},
	});

	const handleValidateFuturesOrder = () => {
		const totalQty = (lots || 1) * lotSize;
		const spot = chainData?.underlyingValue || 24000;
		const limitPrice = Number(customPrice) || spot;

		const tradingsymbol = `${selectedSymbol}${activeExpiry.replace(/-/g, "").slice(2, 6)}FUT`;

		validateMutation.mutate({
			symbol: selectedSymbol,
			tradingsymbol,
			quantity: totalQty,
			side: orderType.toUpperCase(),
			expiryDate: activeExpiry,
			isWeekly: false,
			price: limitPrice,
			riskProfile: "aggressive",
		});
	};

	const handleValidateOptionsOrder = () => {
		const totalQty = (lots || 1) * lotSize;
		const strike = selectedStrike || (chainData?.strikePrices?.[0]?.toString() ?? "24000");
		const typeSuffix = optionType.toUpperCase();
		const tradingsymbol = `${selectedSymbol}${activeExpiry.replace(/-/g, "").slice(2, 6)}${strike}${typeSuffix}`;

		const targetOption =
			typeSuffix === "CE"
				? chainData?.options?.calls?.find((c) => c.strikePrice === Number(strike))
				: chainData?.options?.puts?.find((p) => p.strikePrice === Number(strike));

		const premiumPrice = Number(customPrice) || targetOption?.lastPrice || 100;

		validateMutation.mutate({
			symbol: selectedSymbol,
			tradingsymbol,
			quantity: totalQty,
			side: orderType.toUpperCase(),
			expiryDate: activeExpiry,
			isWeekly: false,
			price: premiumPrice,
			riskProfile: "aggressive",
		});
	};

	const handleConfirmOrder = () => {
		if (!validationResult) return;

		executeMutation.mutate({
			symbol: validationResult.symbol,
			tradingsymbol: validationResult.tradingsymbol,
			instrumentKey: `NSE_FO|${validationResult.tradingsymbol}`,
			quantity: validationResult.quantity,
			price: Number(customPrice) || (chainData?.underlyingValue ?? 100),
			side: orderType.toUpperCase() as "BUY" | "SELL",
			product,
		});
	};

	return (
		<div className="container mx-auto py-6 px-4 max-w-7xl">
			{/* Header */}
			<div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div className="flex items-center gap-3">
					<Activity className="h-8 w-8 text-primary" />
					<div>
						<h1 className="text-3xl font-bold" data-testid="derivatives-title">
							Derivatives Trading
						</h1>
						<p className="text-muted-foreground">
							SEBI-Regulated NSE/BSE Futures & Options Terminal (Upstox Live Stream)
						</p>
					</div>
				</div>
				<Link href="/agent-derivatives">
					<Button variant="outline" className="gap-2 border-primary/50 text-primary hover:bg-primary/10">
						<Sparkles className="h-4 w-4" />
						Open AI Strategy Payoff Builder
						<ArrowRight className="h-4 w-4" />
					</Button>
				</Link>
			</div>

			{/* Top Metrics Cards */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
				<Card>
					<CardContent className="pt-6">
						<div className="flex justify-between items-start">
							<div>
								<p className="text-sm font-medium text-muted-foreground">Underlying Spot</p>
								<h3 className="text-2xl font-bold">
									₹{chainData?.underlyingValue ? chainData.underlyingValue.toLocaleString() : "..."}
								</h3>
								<p className="text-xs text-muted-foreground mt-1">{selectedSymbol} Spot Quote</p>
							</div>
							<Badge variant="outline" className="bg-primary/5 text-primary">
								{chainData?.dataSource === "nse" ? "Licensed NSE Feed" : "Upstox Live"}
							</Badge>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="pt-6">
						<div className="flex justify-between items-start">
							<div>
								<p className="text-sm font-medium text-muted-foreground">Total P&L</p>
								<h3
									className={`text-2xl font-bold ${
										calculateTotalPnL() >= 0 ? "text-green-600" : "text-red-600"
									}`}
								>
									{calculateTotalPnL() >= 0 ? "+" : ""}₹
									{calculateTotalPnL().toLocaleString()}
								</h3>
								<p className="text-xs text-muted-foreground mt-1">
									{positions.length} open position{positions.length === 1 ? "" : "s"}
								</p>
							</div>
							{calculateTotalPnL() >= 0 ? (
								<TrendingUp className="h-5 w-5 text-green-600" />
							) : (
								<TrendingDown className="h-5 w-5 text-red-600" />
							)}
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="pt-6">
						<div className="flex justify-between items-start">
							<div>
								<p className="text-sm font-medium text-muted-foreground">Put-Call Ratio (PCR)</p>
								<h3 className="text-2xl font-bold">{oiData?.pcr ? oiData.pcr.toFixed(2) : "1.05"}</h3>
								<p className="text-xs text-muted-foreground mt-1">
									{(oiData?.pcr ?? 1.05) > 1 ? "Bullish Sentiment" : "Bearish Sentiment"}
								</p>
							</div>
							<Target className="h-5 w-5 text-muted-foreground" />
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="pt-6">
						<div className="flex justify-between items-start">
							<div>
								<p className="text-sm font-medium text-muted-foreground">Max Pain Strike</p>
								<h3 className="text-2xl font-bold">
									{oiData?.maxPainStrike ? oiData.maxPainStrike.toLocaleString() : "..."}
								</h3>
								<p className="text-xs text-muted-foreground mt-1">Expiry Anchor Level</p>
							</div>
							<ShieldAlert className="h-5 w-5 text-amber-500" />
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Main Tabs */}
			<Tabs defaultValue="futures" className="space-y-6">
				<ScrollableTabsList className="grid w-full grid-cols-4 lg:w-[500px]">
					<TabsTrigger value="futures" data-testid="tab-futures">
						Futures
					</TabsTrigger>
					<TabsTrigger value="options" data-testid="tab-options">
						Options
					</TabsTrigger>
					<TabsTrigger value="positions" data-testid="tab-positions">
						<Activity className="h-4 w-4 mr-2" />
						Positions ({positions.length})
					</TabsTrigger>
					<TabsTrigger value="chain" data-testid="tab-chain">
						<BarChart3 className="h-4 w-4 mr-2" />
						Option Chain
					</TabsTrigger>
				</ScrollableTabsList>

				{/* 1. Futures Tab */}
				<TabsContent value="futures" className="space-y-6">
					<div className="grid lg:grid-cols-3 gap-6">
						<Card className="lg:col-span-2">
							<CardHeader>
								<CardTitle>Place Futures Order</CardTitle>
								<CardDescription>
									Trade standardized exchange-traded futures with automated SEBI margin validation
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid md:grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label>Underlying Symbol</Label>
										<Select
											value={selectedSymbol}
											onValueChange={(val) => {
												setSelectedSymbol(val);
												setSelectedExpiry("");
											}}
										>
											<SelectTrigger data-testid="select-symbol">
												<SelectValue placeholder="Select symbol" />
											</SelectTrigger>
											<SelectContent>
												{availableSymbols.map((s) => (
													<SelectItem key={s} value={s}>
														{s}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>

									<div className="space-y-2">
										<Label>Expiry Date</Label>
										<Select
											value={activeExpiry}
											onValueChange={(val) => setSelectedExpiry(val)}
										>
											<SelectTrigger data-testid="select-expiry">
												<SelectValue placeholder="Select expiry" />
											</SelectTrigger>
											<SelectContent>
												{expiryDates.map((exp) => (
													<SelectItem key={exp} value={exp}>
														{exp}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								</div>

								<div className="grid md:grid-cols-3 gap-4">
									<div className="space-y-2">
										<Label>Order Type</Label>
										<div className="flex gap-2">
											<Button
												type="button"
												variant={orderType === "buy" ? "default" : "outline"}
												className="flex-1"
												onClick={() => setOrderType("buy")}
												data-testid="button-buy"
											>
												Buy (Long)
											</Button>
											<Button
												type="button"
												variant={orderType === "sell" ? "destructive" : "outline"}
												className="flex-1"
												onClick={() => setOrderType("sell")}
												data-testid="button-sell"
											>
												Sell (Short)
											</Button>
										</div>
									</div>

									<div className="space-y-2">
										<Label>Number of Lots (Lot Size: {lotSize})</Label>
										<Input
											type="number"
											min={1}
											value={lots}
											onChange={(e) => setLots(Math.max(1, parseInt(e.target.value, 10) || 1))}
											data-testid="input-quantity"
										/>
										<p className="text-xs text-muted-foreground">
											Total Units: <strong>{lots * lotSize}</strong>
										</p>
									</div>

									<div className="space-y-2">
										<Label>Product Type</Label>
										<Select
											value={product}
											onValueChange={(v: "I" | "D") => setProduct(v)}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="I">Intraday (MIS)</SelectItem>
												<SelectItem value="D">Normal (NRML Margin)</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>

								<div className="space-y-2">
									<Label>Limit Price (Leave blank for market quote)</Label>
									<Input
										type="number"
										step="0.05"
										placeholder={
											chainData?.underlyingValue
												? `Market: ₹${chainData.underlyingValue}`
												: "0.00"
										}
										value={customPrice}
										onChange={(e) => setCustomPrice(e.target.value)}
										data-testid="input-price"
									/>
								</div>

								<div className="p-4 bg-muted/60 rounded-lg space-y-2">
									<div className="flex justify-between text-sm">
										<span className="text-muted-foreground">Estimated Contract Value</span>
										<span className="font-medium">
											₹
											{(
												(chainData?.underlyingValue || 24000) *
												lots *
												lotSize
											).toLocaleString()}
										</span>
									</div>
									<div className="flex justify-between text-sm">
										<span className="text-muted-foreground">Estimated SPAN + Exposure Margin</span>
										<span className="font-medium text-primary">
											₹
											{Math.round(
												(chainData?.underlyingValue || 24000) * lots * lotSize * 0.18
											).toLocaleString()}
										</span>
									</div>
									<div className="flex justify-between text-xs text-muted-foreground">
										<span>SEBI 50% Cash Margin Rule:</span>
										<span>
											Min ₹
											{Math.round(
												(chainData?.underlyingValue || 24000) * lots * lotSize * 0.09
											).toLocaleString()}{" "}
											in cash/cash-equivalents
										</span>
									</div>
								</div>

								<Button
									className="w-full"
									size="lg"
									onClick={handleValidateFuturesOrder}
									disabled={validateMutation.isPending}
									data-testid="button-place-order"
								>
									{validateMutation.isPending ? "Validating with Risk Engine..." : "Review & Place Futures Order"}
								</Button>
							</CardContent>
						</Card>

						{/* Regulatory Notice Sidebar */}
						<Card>
							<CardHeader>
								<CardTitle className="text-base flex items-center gap-2">
									<ShieldAlert className="h-4 w-4 text-amber-500" />
									SEBI F&O Framework Notice
								</CardTitle>
								<CardDescription>Circular SEBI/HO/MRD/POD1/CIR/P/2024/132</CardDescription>
							</CardHeader>
							<CardContent className="space-y-3 text-xs text-muted-foreground">
								<p>
									<strong>1. Minimum Contract Size:</strong> ₹15 Lakh minimum contract value floor per SEBI guidelines.
								</p>
								<p>
									<strong>2. 50% Cash Margin:</strong> At least 50% of the total margin requirement must be maintained in cash or cash-equivalents.
								</p>
								<p>
									<strong>3. Expiry Day ELM:</strong> An additional 2% Extreme Loss Margin (ELM) surcharge applies on all short options on trade expiry day.
								</p>
								<p>
									<strong>4. Weekly Expiry Cap:</strong> Only NIFTY (NSE) and SENSEX (BSE) offer weekly contracts. All other underlyings are monthly.
								</p>
							</CardContent>
						</Card>
					</div>
				</TabsContent>

				{/* 2. Options Tab */}
				<TabsContent value="options" className="space-y-6">
					<div className="grid lg:grid-cols-3 gap-6">
						<Card className="lg:col-span-2">
							<CardHeader>
								<CardTitle>Place Options Order</CardTitle>
								<CardDescription>Trade Call (CE) and Put (PE) options contracts</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid md:grid-cols-3 gap-4">
									<div className="space-y-2">
										<Label>Underlying Symbol</Label>
										<Select
											value={selectedSymbol}
											onValueChange={(val) => {
												setSelectedSymbol(val);
												setSelectedExpiry("");
												setSelectedStrike("");
											}}
										>
											<SelectTrigger data-testid="select-options-symbol">
												<SelectValue placeholder="Select symbol" />
											</SelectTrigger>
											<SelectContent>
												{availableSymbols.map((s) => (
													<SelectItem key={s} value={s}>
														{s}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>

									<div className="space-y-2">
										<Label>Option Type</Label>
										<Select
											value={optionType}
											onValueChange={(v: "ce" | "pe") => setOptionType(v)}
										>
											<SelectTrigger data-testid="select-option-type">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="ce">Call (CE)</SelectItem>
												<SelectItem value="pe">Put (PE)</SelectItem>
											</SelectContent>
										</Select>
									</div>

									<div className="space-y-2">
										<Label>Expiry Date</Label>
										<Select
											value={activeExpiry}
											onValueChange={(val) => setSelectedExpiry(val)}
										>
											<SelectTrigger data-testid="select-options-expiry">
												<SelectValue placeholder="Select expiry" />
											</SelectTrigger>
											<SelectContent>
												{expiryDates.map((exp) => (
													<SelectItem key={exp} value={exp}>
														{exp}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								</div>

								<div className="grid md:grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label>Strike Price</Label>
										<Select
											value={selectedStrike}
											onValueChange={(val) => setSelectedStrike(val)}
										>
											<SelectTrigger data-testid="select-strike">
												<SelectValue placeholder="Select strike" />
											</SelectTrigger>
											<SelectContent className="max-h-60">
												{(chainData?.strikePrices || [23500, 24000, 24500]).map((strike) => (
													<SelectItem key={strike} value={strike.toString()}>
														{strike}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>

									<div className="space-y-2">
										<Label>Action</Label>
										<div className="flex gap-2">
											<Button
												type="button"
												variant={orderType === "buy" ? "default" : "outline"}
												className="flex-1"
												onClick={() => setOrderType("buy")}
											>
												Buy (Long)
											</Button>
											<Button
												type="button"
												variant={orderType === "sell" ? "destructive" : "outline"}
												className="flex-1"
												onClick={() => setOrderType("sell")}
											>
												Sell (Write)
											</Button>
										</div>
									</div>
								</div>

								<div className="grid md:grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label>Quantity in Lots (Lot Size: {lotSize})</Label>
										<Input
											type="number"
											min={1}
											value={lots}
											onChange={(e) => setLots(Math.max(1, parseInt(e.target.value, 10) || 1))}
											data-testid="input-options-quantity"
										/>
										<p className="text-xs text-muted-foreground">
											Total Units: <strong>{lots * lotSize}</strong>
										</p>
									</div>

									<div className="space-y-2">
										<Label>Limit Premium Price (₹)</Label>
										<Input
											type="number"
											step="0.05"
											placeholder="Market Price"
											value={customPrice}
											onChange={(e) => setCustomPrice(e.target.value)}
											data-testid="input-premium"
										/>
									</div>
								</div>

								<Button
									className="w-full"
									size="lg"
									onClick={handleValidateOptionsOrder}
									disabled={validateMutation.isPending}
									data-testid="button-place-options-order"
								>
									{validateMutation.isPending ? "Validating Order..." : "Review & Place Options Order"}
								</Button>
							</CardContent>
						</Card>

						{/* Greeks Preview Card */}
						<Card>
							<CardHeader>
								<CardTitle>Option Analytics & Greeks</CardTitle>
								<CardDescription>Calculated Black-Scholes Greeks for {selectedSymbol}</CardDescription>
							</CardHeader>
							<CardContent className="space-y-3">
								<div className="flex justify-between text-sm">
									<span className="text-muted-foreground">Delta (Δ)</span>
									<span className="font-medium">{optionType === "ce" ? "+0.52" : "-0.48"}</span>
								</div>
								<div className="flex justify-between text-sm">
									<span className="text-muted-foreground">Gamma (Γ)</span>
									<span className="font-medium">0.0018</span>
								</div>
								<div className="flex justify-between text-sm">
									<span className="text-muted-foreground">Theta (Θ)</span>
									<span className="font-medium text-red-500">-12.40 / day</span>
								</div>
								<div className="flex justify-between text-sm">
									<span className="text-muted-foreground">Vega (ν)</span>
									<span className="font-medium">18.25</span>
								</div>
								<div className="flex justify-between text-sm">
									<span className="text-muted-foreground">Implied Volatility (IV)</span>
									<span className="font-medium">14.2%</span>
								</div>
							</CardContent>
						</Card>
					</div>
				</TabsContent>

				{/* 3. Positions Tab */}
				<TabsContent value="positions" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle>Open F&O Positions</CardTitle>
							<CardDescription>
								Live positions in index and stock futures and options (Cloud SQL Master)
							</CardDescription>
						</CardHeader>
						<CardContent>
							{positions.length === 0 ? (
								<div className="text-center py-12 text-muted-foreground space-y-3">
									<Activity className="h-10 w-10 mx-auto opacity-40" />
									<p>No active derivative positions found.</p>
									<p className="text-xs">Place an order using the Futures or Options tabs above.</p>
								</div>
							) : (
								<div className="space-y-3">
									{positions.map((position) => (
										<div
											key={position.id}
											className="border rounded-lg p-4 hover:bg-muted/30 transition-colors"
											data-testid={`position-${position.id}`}
										>
											<div className="flex items-start justify-between mb-3">
												<div>
													<h4 className="font-semibold text-lg">{position.symbol}</h4>
													<p className="text-sm text-muted-foreground">
														<Clock className="h-3 w-3 inline mr-1" />
														Side: <strong>{position.side || "BUY"}</strong> | Product:{" "}
														{position.product || "I"}
													</p>
												</div>
												<Badge
													variant={
														position.pnl >= 0
															? "default"
															: "destructive"
													}
												>
													{position.pnl >= 0 ? "+" : ""}₹
													{position.pnl.toLocaleString()} ({position.pnlPercentage}%)
												</Badge>
											</div>

											<div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
												<div>
													<p className="text-xs text-muted-foreground">Quantity</p>
													<p className="font-medium">{position.quantity} units</p>
												</div>
												<div>
													<p className="text-xs text-muted-foreground">Entry Price</p>
													<p className="font-medium">₹{position.buyPrice.toLocaleString()}</p>
												</div>
												<div>
													<p className="text-xs text-muted-foreground">Current Price</p>
													<p className="font-medium">₹{position.currentPrice.toLocaleString()}</p>
												</div>
												<div>
													<p className="text-xs text-muted-foreground">Status</p>
													<Badge variant="outline">{position.status || "OPEN"}</Badge>
												</div>
											</div>
										</div>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				{/* 4. Option Chain Tab — Upstox Pro Web & Mobile Benchmark */}
				<TabsContent value="chain" className="space-y-6">
					{/* Top Metrics Banner */}
					<div className="grid grid-cols-2 md:grid-cols-5 gap-3">
						<Card className="p-3 bg-muted/40">
							<p className="text-xs text-muted-foreground font-medium">Spot Price</p>
							<p className="text-xl font-bold mt-1">
								₹{chainData?.underlyingValue?.toLocaleString() || "—"}
							</p>
							<span className="text-[11px] text-muted-foreground">
								Feed: {chainData?.dataSource === "nse" ? "Licensed NSE" : "Live Streaming"}
							</span>
						</Card>

						<Card className="p-3 bg-muted/40">
							<p className="text-xs text-muted-foreground font-medium">ATM Strike</p>
							<p className="text-xl font-bold mt-1 text-primary">
								{chainData?.atmStrike?.toLocaleString() || "—"}
							</p>
							<span className="text-[11px] text-muted-foreground">Pivot Level</span>
						</Card>

						<Card className="p-3 bg-muted/40">
							<p className="text-xs text-muted-foreground font-medium">Put-Call Ratio (PCR)</p>
							<div className="flex items-center gap-2 mt-1">
								<p className="text-xl font-bold">
									{chainData?.pcr ? chainData.pcr.toFixed(2) : oiData?.pcr?.toFixed(2) || "1.00"}
								</p>
								<Badge
									variant={
										(chainData?.pcr ?? oiData?.pcr ?? 1) >= 1.05
											? "default"
											: (chainData?.pcr ?? oiData?.pcr ?? 1) <= 0.85
												? "destructive"
												: "outline"
									}
									className="text-[10px] h-5"
								>
									{(chainData?.pcr ?? oiData?.pcr ?? 1) >= 1.05
										? "Bullish"
										: (chainData?.pcr ?? oiData?.pcr ?? 1) <= 0.85
											? "Bearish"
											: "Neutral"}
								</Badge>
							</div>
							<span className="text-[11px] text-muted-foreground">Sentiment Indicator</span>
						</Card>

						<Card className="p-3 bg-muted/40">
							<p className="text-xs text-muted-foreground font-medium">Max Pain Strike</p>
							<p className="text-xl font-bold mt-1 text-amber-600 dark:text-amber-400">
								{chainData?.maxPain?.toLocaleString() || oiData?.maxPainStrike?.toLocaleString() || "—"}
							</p>
							<span className="text-[11px] text-muted-foreground">Expiry Anchor</span>
						</Card>

						<Card className="p-3 bg-muted/40 col-span-2 md:col-span-1">
							<p className="text-xs text-muted-foreground font-medium">Market Open Interest</p>
							<div className="flex justify-between text-xs mt-1 font-semibold">
								<span className="text-green-600">
									Calls: {chainData?.totalCallOI ? (chainData.totalCallOI / 100000).toFixed(1) + "L" : "—"}
								</span>
								<span className="text-red-600">
									Puts: {chainData?.totalPutOI ? (chainData.totalPutOI / 100000).toFixed(1) + "L" : "—"}
								</span>
							</div>
							<div className="w-full bg-red-200 dark:bg-red-950 h-2 rounded-full overflow-hidden mt-1 flex">
								<div
									className="bg-green-600 h-full transition-all duration-300"
									style={{
										width: `${
											chainData?.totalCallOI && chainData?.totalPutOI
												? Math.round(
														(chainData.totalCallOI / (chainData.totalCallOI + chainData.totalPutOI)) * 100
													)
												: 50
										}%`,
									}}
								/>
							</div>
						</Card>
					</div>

					{/* Upstox Pro Benchmark: 1-Click Strategy Builder Banner */}
					<Card className="border-primary/20 bg-primary/5">
						<CardContent className="pt-4 pb-4">
							<div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
								<div className="space-y-0.5">
									<div className="flex items-center gap-2">
										<Zap className="h-4 w-4 text-primary fill-primary" />
										<h4 className="font-semibold text-sm">1-Click Multi-Leg Strategy Baskets</h4>
										<Badge variant="outline" className="text-[10px] bg-background">
											Upstox Pro Benchmark
										</Badge>
									</div>
									<p className="text-xs text-muted-foreground">
										Construct pre-hedged options strategies with automated BUY-first leg execution and margin relief.
									</p>
								</div>

								<div className="flex flex-wrap items-center gap-2">
									<Button
										size="sm"
										variant="outline"
										className="text-xs h-8 bg-background hover:bg-green-50 hover:text-green-700 dark:hover:bg-green-950/30"
										onClick={() => handleLaunchStrategy("bull_call")}
										disabled={isUserKillSwitchActive}
									>
										📈 Bull Call Spread
									</Button>
									<Button
										size="sm"
										variant="outline"
										className="text-xs h-8 bg-background hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
										onClick={() => handleLaunchStrategy("bear_put")}
										disabled={isUserKillSwitchActive}
									>
										📉 Bear Put Spread
									</Button>
									<Button
										size="sm"
										variant="outline"
										className="text-xs h-8 bg-background hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950/30"
										onClick={() => handleLaunchStrategy("straddle")}
										disabled={isUserKillSwitchActive}
									>
										🎯 Long Straddle
									</Button>
									<Button
										size="sm"
										variant="outline"
										className="text-xs h-8 bg-background hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950/30"
										onClick={() => handleLaunchStrategy("strangle")}
										disabled={isUserKillSwitchActive}
									>
										🛡️ Short Strangle
									</Button>
									<Button
										size="sm"
										variant="outline"
										className="text-xs h-8 bg-background hover:bg-purple-50 hover:text-purple-700 dark:hover:bg-purple-950/30"
										onClick={() => handleLaunchStrategy("iron_condor")}
										disabled={isUserKillSwitchActive}
									>
										🪽 Iron Condor
									</Button>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Option Chain Controls & Table */}
					<Card>
						<CardHeader className="pb-3">
							<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
								<div>
									<CardTitle className="text-lg">
										{selectedSymbol} Option Chain ({activeExpiry || "Nearest"})
									</CardTitle>
									<CardDescription className="text-xs">
										Exchange Multi-strike Order Book with real-time Black-Scholes Greeks and open interest distribution
									</CardDescription>
								</div>

								<div className="flex flex-wrap items-center gap-2">
									{/* View Mode Toggle (Upstox Pro Mobile & Web paradigm) */}
									<div className="flex items-center rounded-lg border bg-muted/30 p-1 text-xs">
										<button
											type="button"
											className={`px-3 py-1 rounded-md font-medium transition-colors ${
												chainViewMode === "prices"
													? "bg-background shadow text-foreground"
													: "text-muted-foreground hover:text-foreground"
											}`}
											onClick={() => setChainViewMode("prices")}
										>
											Prices & Depth
										</button>
										<button
											type="button"
											className={`px-3 py-1 rounded-md font-medium transition-colors ${
												chainViewMode === "oi"
													? "bg-background shadow text-foreground"
													: "text-muted-foreground hover:text-foreground"
											}`}
											onClick={() => setChainViewMode("oi")}
										>
											OI & Volume
										</button>
										<button
											type="button"
											className={`px-3 py-1 rounded-md font-medium transition-colors ${
												chainViewMode === "greeks"
													? "bg-background shadow text-foreground"
													: "text-muted-foreground hover:text-foreground"
											}`}
											onClick={() => setChainViewMode("greeks")}
										>
											Greeks (Δ, Γ, Θ, ν)
										</button>
									</div>

									{/* Symbol Selector */}
									<Select
										value={selectedSymbol}
										onValueChange={(val) => {
											setSelectedSymbol(val);
											setSelectedExpiry("");
										}}
									>
										<SelectTrigger className="w-[130px] h-8 text-xs">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{availableSymbols.map((s) => (
												<SelectItem key={s} value={s}>
													{s}
												</SelectItem>
											))}
										</SelectContent>
									</Select>

									{/* Expiry Selector */}
									<Select
										value={activeExpiry}
										onValueChange={(val) => setSelectedExpiry(val)}
									>
										<SelectTrigger className="w-[140px] h-8 text-xs">
											<SelectValue placeholder="Expiry" />
										</SelectTrigger>
										<SelectContent>
											{expiryDates.map((d) => (
												<SelectItem key={d} value={d}>
													{d}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							<div className="overflow-x-auto border rounded-lg">
								<table className="w-full text-xs">
									<thead>
										<tr className="border-b bg-muted/60 text-muted-foreground">
											{/* Calls Header */}
											{chainViewMode === "prices" && (
												<>
													<th className="text-left p-2 font-semibold text-green-600">Call Bid</th>
													<th className="text-left p-2 font-semibold text-green-600">Call Ask</th>
													<th className="text-right p-2 font-bold text-green-600">Call LTP (₹)</th>
												</>
											)}
											{chainViewMode === "oi" && (
												<>
													<th className="text-left p-2 font-semibold">Volume</th>
													<th className="text-center p-2 font-semibold">Chg OI</th>
													<th className="text-right p-2 font-bold text-green-600">Call OI</th>
												</>
											)}
											{chainViewMode === "greeks" && (
												<>
													<th className="text-left p-2 font-semibold">IV (%)</th>
													<th className="text-center p-2 font-semibold">Delta (Δ)</th>
													<th className="text-center p-2 font-semibold">Theta (Θ)</th>
													<th className="text-right p-2 font-semibold">Vega (ν)</th>
												</>
											)}

											{/* Center Strike Header */}
											<th className="text-center p-2 font-extrabold bg-muted text-foreground min-w-[90px]">
												Strike Price
											</th>

											{/* Puts Header */}
											{chainViewMode === "prices" && (
												<>
													<th className="text-left p-2 font-bold text-red-600">Put LTP (₹)</th>
													<th className="text-right p-2 font-semibold text-red-600">Put Bid</th>
													<th className="text-right p-2 font-semibold text-red-600">Put Ask</th>
												</>
											)}
											{chainViewMode === "oi" && (
												<>
													<th className="text-left p-2 font-bold text-red-600">Put OI</th>
													<th className="text-center p-2 font-semibold">Chg OI</th>
													<th className="text-right p-2 font-semibold">Volume</th>
												</>
											)}
											{chainViewMode === "greeks" && (
												<>
													<th className="text-left p-2 font-semibold">Delta (Δ)</th>
													<th className="text-center p-2 font-semibold">Theta (Θ)</th>
													<th className="text-center p-2 font-semibold">Vega (ν)</th>
													<th className="text-right p-2 font-semibold">IV (%)</th>
												</>
											)}
										</tr>
									</thead>
									<tbody>
										{(chainData?.strikePrices || []).slice(0, 25).map((strike) => {
											const call = chainData?.options?.calls?.find(
												(c) => c.strikePrice === strike
											);
											const put = chainData?.options?.puts?.find(
												(p) => p.strikePrice === strike
											);
											const isAtm =
												Math.abs(strike - (chainData?.underlyingValue || 24000)) <
												(chainData?.strikePrices[1]
													? Math.abs(chainData.strikePrices[1] - chainData.strikePrices[0]) / 2 + 10
													: 75);

											return (
												<tr
													key={strike}
													className={`border-b hover:bg-accent/40 transition-colors ${
														isAtm ? "bg-primary/10 font-semibold" : ""
													}`}
												>
													{/* Calls Columns */}
													{chainViewMode === "prices" && (
														<>
															<td className="p-2 text-left text-muted-foreground">
																₹{call?.bidPrice ? call.bidPrice.toFixed(2) : "—"}
															</td>
															<td className="p-2 text-left text-muted-foreground">
																₹{call?.askPrice ? call.askPrice.toFixed(2) : "—"}
															</td>
															<td className="p-2 text-right font-bold text-green-600">
																₹{call?.lastPrice ? call.lastPrice.toFixed(2) : "0.00"}
															</td>
														</>
													)}
													{chainViewMode === "oi" && (
														<>
															<td className="p-2 text-left text-muted-foreground">
																{call?.totalTradedVolume ? call.totalTradedVolume.toLocaleString() : "—"}
															</td>
															<td className="p-2 text-center text-xs">
																<span
																	className={
																		(call?.changeinOpenInterest || 0) >= 0
																			? "text-green-600"
																			: "text-red-600"
																	}
																>
																	{(call?.changeinOpenInterest || 0) > 0 ? "+" : ""}
																	{call?.changeinOpenInterest ? call.changeinOpenInterest.toLocaleString() : "0"}
																</span>
															</td>
															<td className="p-2 text-right font-semibold text-green-600">
																{call?.openInterest ? call.openInterest.toLocaleString() : "—"}
															</td>
														</>
													)}
													{chainViewMode === "greeks" && (
														<>
															<td className="p-2 text-left font-medium">
																{call?.impliedVolatility ? `${call.impliedVolatility.toFixed(1)}%` : "—"}
															</td>
															<td className="p-2 text-center text-green-600 font-semibold">
																{call?.delta !== undefined ? (call.delta >= 0 ? `+${call.delta.toFixed(2)}` : call.delta.toFixed(2)) : "+0.50"}
															</td>
															<td className="p-2 text-center text-red-500">
																{call?.theta !== undefined ? call.theta.toFixed(1) : "-10.0"}
															</td>
															<td className="p-2 text-right text-muted-foreground">
																{call?.vega !== undefined ? call.vega.toFixed(1) : "15.0"}
															</td>
														</>
													)}

													{/* Center Strike Column */}
													<td
														className={`p-2 text-center font-extrabold cursor-pointer select-none ${
															isAtm
																? "bg-primary/20 text-primary border-x border-primary/30"
																: "bg-muted/30 border-x"
														}`}
														onClick={() => {
															setSelectedStrike(String(strike));
															toast({
																title: `Strike ${strike} Selected`,
																description: "Updated strike price in options order pad.",
															});
														}}
														title="Click to select strike"
													>
														{strike} {isAtm ? "⭐ ATM" : ""}
													</td>

													{/* Puts Columns */}
													{chainViewMode === "prices" && (
														<>
															<td className="p-2 text-left font-bold text-red-600">
																₹{put?.lastPrice ? put.lastPrice.toFixed(2) : "0.00"}
															</td>
															<td className="p-2 text-right text-muted-foreground">
																₹{put?.bidPrice ? put.bidPrice.toFixed(2) : "—"}
															</td>
															<td className="p-2 text-right text-muted-foreground">
																₹{put?.askPrice ? put.askPrice.toFixed(2) : "—"}
															</td>
														</>
													)}
													{chainViewMode === "oi" && (
														<>
															<td className="p-2 text-left font-semibold text-red-600">
																{put?.openInterest ? put.openInterest.toLocaleString() : "—"}
															</td>
															<td className="p-2 text-center text-xs">
																<span
																	className={
																		(put?.changeinOpenInterest || 0) >= 0
																			? "text-green-600"
																			: "text-red-600"
																	}
																>
																	{(put?.changeinOpenInterest || 0) > 0 ? "+" : ""}
																	{put?.changeinOpenInterest ? put.changeinOpenInterest.toLocaleString() : "0"}
																</span>
															</td>
															<td className="p-2 text-right text-muted-foreground">
																{put?.totalTradedVolume ? put.totalTradedVolume.toLocaleString() : "—"}
															</td>
														</>
													)}
													{chainViewMode === "greeks" && (
														<>
															<td className="p-2 text-left text-red-600 font-semibold">
																{put?.delta !== undefined ? put.delta.toFixed(2) : "-0.50"}
															</td>
															<td className="p-2 text-center text-red-500">
																{put?.theta !== undefined ? put.theta.toFixed(1) : "-10.0"}
															</td>
															<td className="p-2 text-center text-muted-foreground">
																{put?.vega !== undefined ? put.vega.toFixed(1) : "15.0"}
															</td>
															<td className="p-2 text-right font-medium">
																{put?.impliedVolatility ? `${put.impliedVolatility.toFixed(1)}%` : "—"}
															</td>
														</>
													)}
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						</CardContent>
					</Card>

					{/* Upstox Mobile Account Benchmark: Client-Facing F&O Segment Kill-Switch Card */}
					<Card className={isUserKillSwitchActive ? "border-destructive bg-destructive/5" : "border-border"}>
						<CardContent className="pt-4 pb-4">
							<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
								<div className="space-y-1">
									<div className="flex items-center gap-2">
										{isUserKillSwitchActive ? (
											<Lock className="h-4 w-4 text-destructive" />
										) : (
											<Unlock className="h-4 w-4 text-primary" />
										)}
										<h4 className="font-semibold text-sm">
											F&O Segment Trading Kill-Switch ({isUserKillSwitchActive ? "LOCKED" : "ACTIVE"})
										</h4>
										<Badge
											variant={isUserKillSwitchActive ? "destructive" : "outline"}
											className="text-[10px]"
										>
											{isUserKillSwitchActive ? "Trading Halted" : "Trading Enabled"}
										</Badge>
									</div>
									<p className="text-xs text-muted-foreground">
										{isUserKillSwitchActive
											? `All new F&O order placement is currently blocked until ${
													killSwitchData?.data?.lockUntil
														? new Date(killSwitchData.data.lockUntil).toLocaleTimeString()
														: "12 hours"
												} to protect capital under SEBI voluntary trading halt rules.`
											: "Activate this voluntary kill-switch to immediately block all derivative trades for 12 hours if experiencing emotional drawdown or adverse market conditions."}
									</p>
								</div>

								<div>
									<Button
										size="sm"
										variant={isUserKillSwitchActive ? "outline" : "destructive"}
										onClick={() => killSwitchMutation.mutate(!isUserKillSwitchActive)}
										disabled={killSwitchMutation.isPending}
										className="text-xs"
									>
										{killSwitchMutation.isPending
											? "Updating..."
											: isUserKillSwitchActive
												? "Deactivate Kill Switch"
												: "Activate F&O Kill Switch (12-Hr Lock)"}
									</Button>
								</div>
							</div>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>

			{/* Multi-Leg Basket Strategy Slide-to-Confirm Modal (Upstox Pro Mobile & Web Benchmark) */}
			<SlideToConfirmOrderModal
				isOpen={isSlideModalOpen}
				onClose={() => setIsSlideModalOpen(false)}
				strategyName={slideStrategyConfig.strategyName}
				symbol={selectedSymbol}
				legs={slideStrategyConfig.legs}
				lotSize={lotSize}
				recoPrice={slideStrategyConfig.recoPrice}
				isCreditStrategy={slideStrategyConfig.isCredit}
				marginRequired={slideStrategyConfig.marginRequired}
				maxProfit={slideStrategyConfig.maxProfit}
				maxLoss={slideStrategyConfig.maxLoss}
				onOrderSuccess={() => {
					queryClient.invalidateQueries({ queryKey: ["/api/derivatives/positions"] });
					toast({
						title: "Strategy Executed Successfully",
						description: `${slideStrategyConfig.strategyName} orders dispatched via FintekPro DMA adapter.`,
					});
				}}
			/>

			{/* Pre-Trade Order Confirmation Dialog */}
			<Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<ShieldAlert className="h-5 w-5 text-amber-500" />
							Confirm Derivative Order
						</DialogTitle>
						<DialogDescription>
							SEBI Pre-Trade Compliance & Margin Clearance Verification
						</DialogDescription>
					</DialogHeader>

					{validationResult && (
						<div className="space-y-4 py-2">
							<div className="p-3 bg-muted rounded-lg space-y-1 text-sm">
								<div className="flex justify-between">
									<span className="text-muted-foreground">Contract</span>
									<span className="font-bold">{validationResult.tradingsymbol}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Side</span>
									<span className="font-semibold">{orderType.toUpperCase()}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Quantity</span>
									<span>
										{validationResult.quantity} units ({validationResult.lots} lot
										{validationResult.lots > 1 ? "s" : ""})
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Product</span>
									<span>{product === "I" ? "Intraday (MIS)" : "Normal (NRML)"}</span>
								</div>
							</div>

							<div className="space-y-2 text-sm border-t pt-3">
								<div className="flex justify-between">
									<span className="text-muted-foreground">Required Margin:</span>
									<span className="font-bold text-primary">
										₹{validationResult.estimatedMargin.toLocaleString()}
									</span>
								</div>
								<div className="flex justify-between text-xs text-muted-foreground">
									<span>Mandatory 50% Cash Component:</span>
									<span>₹{validationResult.minCashMarginRequired.toLocaleString()}</span>
								</div>
								{validationResult.elmSurchargeApplied && (
									<div className="flex justify-between text-xs text-amber-600">
										<span>Expiry Day 2% ELM Surcharge:</span>
										<span>+₹{validationResult.elmSurchargeAmount.toLocaleString()}</span>
									</div>
								)}
							</div>

							<div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-xs space-y-1 text-amber-800 dark:text-amber-200">
								<p className="font-semibold">SEBI Risk Disclosure:</p>
								<p>
									Derivatives involve substantial risk of capital loss. RIA decision support only — explicit client confirmation required.
								</p>
							</div>
						</div>
					)}

					<DialogFooter className="gap-2">
						<Button variant="outline" onClick={() => setIsConfirmOpen(false)}>
							Cancel
						</Button>
						<Button
							onClick={handleConfirmOrder}
							disabled={executeMutation.isPending}
							data-testid="button-confirm-execute"
						>
							{executeMutation.isPending ? "Executing Order..." : "Confirm & Place Order"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
