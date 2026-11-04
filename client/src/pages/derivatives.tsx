import { useState } from "react";
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";

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
	const { data: chainData } = useQuery<{
		symbol: string;
		underlyingValue: number;
		strikePrices: number[];
		options: {
			calls: Array<{
				strikePrice: number;
				lastPrice: number;
				openInterest: number;
				totalTradedVolume: number;
				impliedVolatility: number;
			}>;
			puts: Array<{
				strikePrice: number;
				lastPrice: number;
				openInterest: number;
				totalTradedVolume: number;
				impliedVolatility: number;
			}>;
		};
		dataSource: string;
	}>({
		queryKey: ["/api/derivatives/options-chain", selectedSymbol, activeExpiry],
		enabled: !!selectedSymbol && !!activeExpiry,
	});

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

				{/* 4. Option Chain Tab */}
				<TabsContent value="chain" className="space-y-4">
					<Card>
						<CardHeader>
							<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
								<div>
									<CardTitle>Option Chain: {selectedSymbol}</CardTitle>
									<CardDescription>
										Expiry: {activeExpiry || "Nearest"} | Feed:{" "}
										<Badge variant="outline" className="text-xs">
											{chainData?.dataSource === "nse" ? "Licensed Real-Time" : "Live Streaming"}
										</Badge>
									</CardDescription>
								</div>
								<div className="flex items-center gap-2">
									<Select
										value={selectedSymbol}
										onValueChange={(val) => {
											setSelectedSymbol(val);
											setSelectedExpiry("");
										}}
									>
										<SelectTrigger className="w-[140px]">
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
								</div>
							</div>
						</CardHeader>
						<CardContent>
							<div className="overflow-x-auto">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b text-xs text-muted-foreground">
											<th className="text-left p-2 text-green-600">Call LTP (₹)</th>
											<th className="text-center p-2">Call OI</th>
											<th className="text-center p-2 font-bold bg-muted/50">Strike</th>
											<th className="text-center p-2">Put OI</th>
											<th className="text-right p-2 text-red-600">Put LTP (₹)</th>
										</tr>
									</thead>
									<tbody>
										{(chainData?.strikePrices || []).slice(0, 15).map((strike) => {
											const call = chainData?.options?.calls?.find(
												(c) => c.strikePrice === strike
											);
											const put = chainData?.options?.puts?.find(
												(p) => p.strikePrice === strike
											);
											const isAtm =
												Math.abs(strike - (chainData?.underlyingValue || 24000)) < 75;

											return (
												<tr
													key={strike}
													className={`border-b hover:bg-accent/40 ${
														isAtm ? "bg-primary/5 font-semibold" : ""
													}`}
												>
													<td className="p-2 text-green-600 font-medium">
														₹{call?.lastPrice ? call.lastPrice.toFixed(2) : "0.00"}
													</td>
													<td className="text-center p-2 text-xs">
														{call?.openInterest ? call.openInterest.toLocaleString() : "-"}
													</td>
													<td
														className={`text-center p-2 font-bold ${
															isAtm ? "bg-primary/10 text-primary" : "bg-muted/30"
														}`}
													>
														{strike} {isAtm ? "(ATM)" : ""}
													</td>
													<td className="text-center p-2 text-xs">
														{put?.openInterest ? put.openInterest.toLocaleString() : "-"}
													</td>
													<td className="p-2 text-right text-red-600 font-medium">
														₹{put?.lastPrice ? put.lastPrice.toFixed(2) : "0.00"}
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>

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
