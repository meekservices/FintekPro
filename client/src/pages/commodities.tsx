import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
	TrendingUp,
	TrendingDown,
	Wheat,
	Droplet,
	Zap,
	Gem,
	Package,
	BarChart3,
	Activity,
	DollarSign,
	LineChart,
	Bot,
	Sparkles,
	CheckCircle2,
} from "lucide-react";
import { MarketChart } from "@/components/dashboard/market-chart";
import {
	InstrumentChatDialog,
	type ChatInstrumentTarget,
} from "@/components/screener/InstrumentChatDialog";
import { useToast } from "@/hooks/use-toast";

interface Commodity {
	id: string;
	name: string;
	symbol: string;
	exchange: "MCX" | "NCDEX";
	category: string;
	price: number;
	change: number;
	changePercent: number;
	volume: string;
	unit: string;
	cmxPrice?: number;
	cmxUnit?: string;
	trend?: string;
	macroImplication?: string;
}

interface RecentOrder {
	id: string;
	name: string;
	exchange: string;
	type: "Buy" | "Sell";
	quantity: number;
	price: number;
	status: string;
	time: string;
}

export default function CommoditiesPage() {
	const { toast } = useToast();
	const [selectedExchange, setSelectedExchange] = useState<
		"MCX" | "NCDEX" | "ALL"
	>("ALL");

	// Active tab state
	const [activeTab, setActiveTab] = useState<string>("market");

	// Interactive Chart state
	const [selectedChartCommodity, setSelectedChartCommodity] = useState<string>("GOLD");

	// Instrument AI Chat copilot state
	const [activeChatInstrument, setActiveChatInstrument] = useState<ChatInstrumentTarget | null>(null);
	const [isChatOpen, setIsChatOpen] = useState(false);

	// Trade order form state
	const [tradeExchange, setTradeExchange] = useState<string>("mcx");
	const [tradeCommodity, setTradeCommodity] = useState<string>("GOLD");
	const [tradeType, setTradeType] = useState<"Buy" | "Sell">("Buy");
	const [tradeQuantity, setTradeQuantity] = useState<number>(1);
	const [tradePrice, setTradePrice] = useState<string>("");
	const [tradeValidity, setTradeValidity] = useState<string>("day");
	const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([
		{
			id: "ord-1",
			name: "Gold 24K",
			exchange: "MCX",
			type: "Buy",
			quantity: 1,
			price: 138419,
			status: "Executed",
			time: "10:32 AM",
		},
		{
			id: "ord-2",
			name: "Crude Oil",
			exchange: "MCX",
			type: "Sell",
			quantity: 2,
			price: 6496,
			status: "Executed",
			time: "09:45 AM",
		},
	]);

	// Fetch commodities data with correct queryKey and envelope unwrapping
	const { data: rawData, isLoading } = useQuery<any>({
		queryKey: [
			selectedExchange === "ALL"
				? "/api/market/commodities"
				: `/api/market/commodities?exchange=${selectedExchange}`,
		],
	});

	const commodities: Commodity[] = useMemo(() => {
		if (!rawData) return [];
		if (Array.isArray(rawData)) return rawData;
		if (Array.isArray(rawData?.data)) return rawData.data;
		return [];
	}, [rawData]);

	const filteredCommodities = useMemo(() => {
		return selectedExchange === "ALL"
			? commodities
			: commodities.filter((c) => c.exchange === selectedExchange);
	}, [commodities, selectedExchange]);

	const handleOpenChat = (c: Commodity) => {
		setActiveChatInstrument({
			id: c.symbol,
			name: c.name,
			symbol: c.symbol,
			assetType: "commodity",
			type: "commodity",
			sector: c.category,
			currentPrice: c.price,
			price: c.price,
			unit: c.unit,
			changePercent: c.changePercent,
		});
		setIsChatOpen(true);
	};

	const getCategoryIcon = (category: string) => {
		switch (category) {
			case "Precious Metals":
				return <Gem className="h-5 w-5 text-amber-500" />;
			case "Energy":
				return <Zap className="h-5 w-5 text-orange-500" />;
			case "Base Metals":
				return <Package className="h-5 w-5 text-cyan-500" />;
			case "Agriculture":
				return <Wheat className="h-5 w-5 text-emerald-500" />;
			case "Spices":
				return <Droplet className="h-5 w-5 text-rose-500" />;
			default:
				return <Activity className="h-5 w-5 text-primary" />;
		}
	};

	const parseVolume = (volume: string | number): number => {
		if (typeof volume === "number") return volume;
		if (!volume) return 0;
		const str = String(volume).toUpperCase();
		if (str.includes("K"))
			return Number.parseFloat(str.replace("K", "")) * 1000;
		if (str.includes("M"))
			return Number.parseFloat(str.replace("M", "")) * 1000000;
		return Number.parseFloat(str) || 0;
	};

	const formatVolume = (volume: number): string => {
		if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`;
		if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
		return String(volume);
	};

	const marketStats = useMemo(() => {
		if (commodities.length === 0) {
			return {
				totalVolume: "0",
				advancers: 0,
				decliners: 0,
				topGainer: { name: "-", percent: 0 },
				topLoser: { name: "-", percent: 0 },
			};
		}

		const advancers = commodities.filter((c) => c.changePercent > 0).length;
		const decliners = commodities.filter((c) => c.changePercent < 0).length;
		const sorted = [...commodities].sort(
			(a, b) => b.changePercent - a.changePercent,
		);
		const topGainer = sorted[0];
		const topLoser = sorted[sorted.length - 1];
		const totalVolume = commodities.reduce(
			(sum, c) => sum + parseVolume(c.volume),
			0,
		);

		return {
			totalVolume: formatVolume(totalVolume),
			advancers,
			decliners,
			topGainer: topGainer
				? { name: topGainer.name, percent: topGainer.changePercent }
				: { name: "-", percent: 0 },
			topLoser: topLoser
				? { name: topLoser.name, percent: topLoser.changePercent }
				: { name: "-", percent: 0 },
		};
	}, [commodities]);

	// Resolve selected trade commodity price & margin
	const currentTradeComm = useMemo(() => {
		return (
			commodities.find((c) => c.symbol.toUpperCase() === tradeCommodity.toUpperCase()) ||
			commodities[0] || {
				name: "Gold 24K",
				symbol: "GOLD",
				price: 138419,
				unit: "10g",
				exchange: "MCX" as const,
			}
		);
	}, [commodities, tradeCommodity]);

	// Standard MCX lot size multiplier
	const lotMultiplier = useMemo(() => {
		const s = currentTradeComm.symbol.toUpperCase();
		if (s.includes("CRUDE")) return 100; // 100 bbl
		if (s.includes("NATURAL")) return 1250; // 1250 mmBtu
		return 1;
	}, [currentTradeComm]);

	const calculatedPrice = tradePrice ? Number(tradePrice) : currentTradeComm.price;
	const contractValue = calculatedPrice * lotMultiplier * Math.max(1, tradeQuantity);
	const requiredMargin = Math.round(contractValue * 0.12); // ~12% SPAN + Exposure Margin

	const handlePlaceOrder = () => {
		const order: RecentOrder = {
			id: `ord-${Date.now()}`,
			name: currentTradeComm.name,
			exchange: currentTradeComm.exchange,
			type: tradeType,
			quantity: tradeQuantity,
			price: calculatedPrice,
			status: "Submitted",
			time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
		};

		setRecentOrders((prev) => [order, ...prev]);
		toast({
			title: `${tradeType.toUpperCase()} Order Submitted: ${currentTradeComm.name}`,
			description: `Exchange: ${currentTradeComm.exchange} | Qty: ${tradeQuantity} Lot(s) @ ₹${calculatedPrice.toLocaleString("en-IN")} | Margin: ₹${requiredMargin.toLocaleString("en-IN")}`,
		});
	};

	return (
		<div className="container mx-auto py-6 px-4 max-w-7xl">
			{/* Page Header */}
			<div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
				<div className="flex items-center gap-3">
					<div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
						<Package className="h-8 w-8 text-amber-600 dark:text-amber-400" />
					</div>
					<div>
						<div className="flex items-center gap-2">
							<h1 className="text-3xl font-bold tracking-tight" data-testid="commodities-title">
								Commodities Trading & Benchmarks
							</h1>
							<Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
								MCX · NCDEX Live
							</Badge>
						</div>
						<p className="text-sm text-muted-foreground mt-0.5">
							Dual-quoted domestic MCX and global COMEX/ICE futures with FASP-AI Decision Support
						</p>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						className="gap-2 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
						onClick={() =>
							handleOpenChat(
								currentTradeComm as Commodity || {
									id: "GOLD",
									name: "MCX Gold & Macro Radar",
									symbol: "GOLD",
									exchange: "MCX",
									category: "Precious Metals",
									price: 138419,
									change: 0,
									changePercent: 0,
									volume: "10K",
									unit: "10g",
								}
							)
						}
					>
						<Bot className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
						<span>AI Commodity Copilot</span>
					</Button>
				</div>
			</div>

			{/* Market Stats Bar */}
			<div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-6">
				<Card>
					<CardContent className="pt-5 pb-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-xs text-muted-foreground font-medium">Total Volume</p>
								<p className="text-xl md:text-2xl font-bold font-mono mt-0.5">{marketStats.totalVolume}</p>
							</div>
							<BarChart3 className="h-7 w-7 text-blue-600 dark:text-blue-400" />
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="pt-5 pb-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-xs text-muted-foreground font-medium">Advancers</p>
								<p className="text-xl md:text-2xl font-bold text-green-600 dark:text-green-400 font-mono mt-0.5">
									{marketStats.advancers}
								</p>
							</div>
							<TrendingUp className="h-7 w-7 text-green-600 dark:text-green-400" />
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="pt-5 pb-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-xs text-muted-foreground font-medium">Decliners</p>
								<p className="text-xl md:text-2xl font-bold text-red-600 dark:text-red-400 font-mono mt-0.5">
									{marketStats.decliners}
								</p>
							</div>
							<TrendingDown className="h-7 w-7 text-red-600 dark:text-red-400" />
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="pt-5 pb-4">
						<div>
							<p className="text-xs text-muted-foreground font-medium">Top Gainer</p>
							<p className="font-semibold text-sm truncate mt-0.5">{marketStats.topGainer.name}</p>
							<p className="text-green-600 dark:text-green-400 font-bold text-sm font-mono">
								+{marketStats.topGainer.percent}%
							</p>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="pt-5 pb-4">
						<div>
							<p className="text-xs text-muted-foreground font-medium">Top Loser</p>
							<p className="font-semibold text-sm truncate mt-0.5">{marketStats.topLoser.name}</p>
							<p className="text-red-600 dark:text-red-400 font-bold text-sm font-mono">
								{marketStats.topLoser.percent}%
							</p>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Main Navigation Tabs */}
			<Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
				<ScrollableTabsList>
					<TabsTrigger value="market" data-testid="tab-market">
						<Activity className="h-4 w-4 mr-2" />
						Market Watch
					</TabsTrigger>
					<TabsTrigger value="chart" data-testid="tab-chart">
						<LineChart className="h-4 w-4 mr-2" />
						Interactive Charts
					</TabsTrigger>
					<TabsTrigger value="trade" data-testid="tab-trade">
						<DollarSign className="h-4 w-4 mr-2" />
						Place Order
					</TabsTrigger>
					<TabsTrigger value="metals" data-testid="tab-metals">
						<Gem className="h-4 w-4 mr-2" />
						Precious Metals
					</TabsTrigger>
					<TabsTrigger value="energy" data-testid="tab-energy">
						<Zap className="h-4 w-4 mr-2" />
						Energy
					</TabsTrigger>
					<TabsTrigger value="agri" data-testid="tab-agri">
						<Wheat className="h-4 w-4 mr-2" />
						Agriculture (NCDEX)
					</TabsTrigger>
				</ScrollableTabsList>

				{/* ── Market Watch Tab ────────────────────────────────────────── */}
				<TabsContent value="market" className="space-y-4">
					<Card>
						<CardHeader>
							<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
								<div>
									<CardTitle>Live Commodity Prices</CardTitle>
									<CardDescription>
										Real-time authoritative feeds from MCX India and NCDEX
									</CardDescription>
								</div>
								<Select
									value={selectedExchange}
									onValueChange={(value: any) => setSelectedExchange(value)}
								>
									<SelectTrigger className="w-36" data-testid="select-exchange">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="ALL">All Exchanges</SelectItem>
										<SelectItem value="MCX">MCX Only</SelectItem>
										<SelectItem value="NCDEX">NCDEX Only</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</CardHeader>
						<CardContent>
							{isLoading ? (
								<div className="p-8 text-center text-muted-foreground text-sm">
									Loading real-time commodity quotes...
								</div>
							) : filteredCommodities.length === 0 ? (
								<div className="p-8 text-center text-muted-foreground text-sm">
									No commodities available for selected exchange.
								</div>
							) : (
								<div className="space-y-3">
									{filteredCommodities.map((commodity) => (
										<div
											key={commodity.id || commodity.symbol}
											className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-xl hover:bg-accent/40 transition-colors gap-3"
											data-testid={`commodity-${commodity.id}`}
										>
											<div className="flex items-center gap-3.5">
												<div className="p-2.5 bg-muted rounded-lg flex-shrink-0">
													{getCategoryIcon(commodity.category)}
												</div>
												<div>
													<h4 className="font-semibold text-foreground text-sm sm:text-base">{commodity.name}</h4>
													<div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
														<span className="font-mono font-medium text-foreground">{commodity.symbol}</span>
														<Badge variant="outline" className="text-[10px] px-1.5 py-0">
															{commodity.exchange}
														</Badge>
														<span>• {commodity.category}</span>
														{commodity.cmxPrice && (
															<span className="hidden md:inline font-mono text-[11px] text-muted-foreground/80">
																(Global: ${commodity.cmxPrice} {commodity.cmxUnit || ""})
															</span>
														)}
													</div>
												</div>
											</div>

											<div className="flex items-center justify-between sm:justify-end gap-4">
												<div className="text-left sm:text-right">
													<p className="text-lg sm:text-xl font-bold font-mono text-foreground">
														₹{Number(commodity.price).toLocaleString("en-IN")}
													</p>
													<div className="flex items-center gap-2 sm:justify-end">
														<span
															className={`text-xs font-semibold font-mono ${commodity.change >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
														>
															{commodity.change >= 0 ? "+" : ""}
															{commodity.change}
														</span>
														<Badge
															variant={
																commodity.changePercent >= 0
																	? "default"
																	: "destructive"
															}
															className="text-[10px] font-mono px-1.5 py-0"
														>
															{commodity.changePercent >= 0 ? "+" : ""}
															{commodity.changePercent}%
														</Badge>
													</div>
													<p className="text-[10px] text-muted-foreground mt-0.5">
														Vol: {commodity.volume} • /{commodity.unit}
													</p>
												</div>

												<div className="flex items-center gap-1.5 flex-shrink-0">
													<Button
														variant="outline"
														size="sm"
														className="h-8 px-2.5 text-xs text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
														title="Chat with AI Copilot"
														onClick={() => handleOpenChat(commodity)}
													>
														<Bot className="h-3.5 w-3.5 mr-1" />
														<span className="hidden md:inline">AI Chat</span>
													</Button>
													<Button
														variant="default"
														size="sm"
														className="h-8 px-3 text-xs"
														onClick={() => {
															setTradeCommodity(commodity.symbol);
															setTradeExchange(commodity.exchange.toLowerCase());
															setActiveTab("trade");
														}}
													>
														Trade
													</Button>
												</div>
											</div>
										</div>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				{/* ── Interactive Candlestick Charts Tab ──────────────────────── */}
				<TabsContent value="chart" className="space-y-4">
					<Card>
						<CardHeader>
							<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
								<div>
									<CardTitle className="flex items-center gap-2">
										<LineChart className="h-5 w-5 text-primary" />
										Interactive Commodity Candlestick Chart
									</CardTitle>
									<CardDescription>
										Institutional OHLC candlestick feed via Upstox MCX & COMEX fallback
									</CardDescription>
								</div>
								<div className="flex items-center gap-2">
									<Select
										value={selectedChartCommodity}
										onValueChange={setSelectedChartCommodity}
									>
										<SelectTrigger className="w-48 font-medium">
											<SelectValue placeholder="Select commodity" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="GOLD">Gold 24K (MCX GOLD)</SelectItem>
											<SelectItem value="SILVER">Silver (MCX SILVER)</SelectItem>
											<SelectItem value="CRUDEOIL">Brent Crude (MCX CRUDEOIL)</SelectItem>
											<SelectItem value="NATURALGAS">Natural Gas (MCX NATURALGAS)</SelectItem>
											<SelectItem value="COPPER">Copper (MCX COPPER)</SelectItem>
										</SelectContent>
									</Select>

									<Button
										variant="outline"
										size="sm"
										className="gap-1.5 text-xs border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300"
										onClick={() => {
											const matched = commodities.find(
												(c) => c.symbol.toUpperCase() === selectedChartCommodity.toUpperCase()
											);
											if (matched) handleOpenChat(matched);
										}}
									>
										<Bot className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
										<span>Analyze Chart</span>
									</Button>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							<div className="rounded-xl border p-2 bg-background">
								<MarketChart symbol={selectedChartCommodity} />
							</div>
							<div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground p-3 rounded-lg bg-muted/40">
								<span>📊 Real-time session: MCX Morning (09:00 - 17:00 IST) & Evening (17:00 - 23:30/23:55 IST).</span>
								<span className="font-medium text-foreground">Dual-quoted against COMEX / ICE Global Benchmarks</span>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				{/* ── Trade Tab ────────────────────────────────────────────────── */}
				<TabsContent value="trade" className="space-y-6">
					<div className="grid lg:grid-cols-3 gap-6">
						<Card className="lg:col-span-2">
							<CardHeader>
								<CardTitle>Place Commodity Order</CardTitle>
								<CardDescription>
									Direct derivative order ticket on MCX and NCDEX
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid md:grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label>Exchange</Label>
										<Select value={tradeExchange} onValueChange={setTradeExchange}>
											<SelectTrigger data-testid="select-trade-exchange">
												<SelectValue placeholder="Select exchange" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="mcx">MCX (Commodity Derivatives)</SelectItem>
												<SelectItem value="ncdex">NCDEX (Agricultural Futures)</SelectItem>
											</SelectContent>
										</Select>
									</div>

									<div className="space-y-2">
										<Label>Commodity Contract</Label>
										<Select value={tradeCommodity} onValueChange={setTradeCommodity}>
											<SelectTrigger data-testid="select-commodity">
												<SelectValue placeholder="Select commodity" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="GOLD">Gold 24K (₹/10g)</SelectItem>
												<SelectItem value="SILVER">Silver (₹/kg)</SelectItem>
												<SelectItem value="CRUDEOIL">Crude Oil (₹/bbl · 100 bbl)</SelectItem>
												<SelectItem value="NATURALGAS">Natural Gas (₹/mmBtu · 1250 mmBtu)</SelectItem>
												<SelectItem value="COPPER">Copper (₹/kg · 2500 kg)</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>

								<div className="grid md:grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label>Order Side</Label>
										<div className="flex gap-2">
											<Button
												type="button"
												variant={tradeType === "Buy" ? "default" : "outline"}
												className={`flex-1 ${tradeType === "Buy" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
												onClick={() => setTradeType("Buy")}
												data-testid="button-buy-commodity"
											>
												Buy (Long)
											</Button>
											<Button
												type="button"
												variant={tradeType === "Sell" ? "destructive" : "outline"}
												className="flex-1"
												onClick={() => setTradeType("Sell")}
												data-testid="button-sell-commodity"
											>
												Sell (Short)
											</Button>
										</div>
									</div>

									<div className="space-y-2">
										<Label>Quantity (Lot Size: {lotMultiplier} units)</Label>
										<Input
											type="number"
											min="1"
											max="100"
											value={tradeQuantity}
											onChange={(e) => setTradeQuantity(Math.max(1, parseInt(e.target.value) || 1))}
											data-testid="input-commodity-quantity"
										/>
									</div>
								</div>

								<div className="grid md:grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label>Limit Price (Leave blank for Market LTP)</Label>
										<Input
											type="number"
											placeholder={`LTP: ₹${currentTradeComm.price.toLocaleString("en-IN")}`}
											value={tradePrice}
											onChange={(e) => setTradePrice(e.target.value)}
											data-testid="input-commodity-price"
										/>
									</div>

									<div className="space-y-2">
										<Label>Order Validity</Label>
										<Select value={tradeValidity} onValueChange={setTradeValidity}>
											<SelectTrigger data-testid="select-commodity-validity">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="day">Day (Valid for trading session)</SelectItem>
												<SelectItem value="ioc">IOC (Immediate or Cancel)</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>

								<div className="p-4 rounded-xl border bg-muted/30 space-y-2.5">
									<div className="flex justify-between text-sm">
										<span className="text-muted-foreground">Contract Notional Value</span>
										<span className="font-mono font-medium">₹{contractValue.toLocaleString("en-IN")}</span>
									</div>
									<div className="flex justify-between text-sm">
										<span className="text-muted-foreground">Estimated Initial Margin (~12%)</span>
										<span className="font-mono font-bold text-amber-600 dark:text-amber-400">
											₹{requiredMargin.toLocaleString("en-IN")}
										</span>
									</div>
									<div className="flex justify-between text-sm pt-1 border-t border-border">
										<span className="text-muted-foreground">Available Collateral / Cash Margin</span>
										<span className="font-mono font-semibold text-green-600 dark:text-green-400">
											₹5,00,000
										</span>
									</div>
								</div>

								<Button
									className="w-full h-11 text-base font-semibold"
									size="lg"
									onClick={handlePlaceOrder}
									data-testid="button-place-commodity-order"
								>
									Confirm & Place {tradeType} Order
								</Button>
							</CardContent>
						</Card>

						{/* Recent Orders Book */}
						<Card>
							<CardHeader>
								<CardTitle className="text-lg">Commodity Order Book</CardTitle>
								<CardDescription>Live session orders & fills</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="space-y-3">
									{recentOrders.map((ord) => (
										<div key={ord.id} className="p-3 border rounded-xl space-y-1.5 bg-card">
											<div className="flex justify-between items-start">
												<div>
													<p className="font-semibold text-sm">{ord.name}</p>
													<p className="text-xs text-muted-foreground">{ord.exchange} · {ord.time}</p>
												</div>
												<Badge variant={ord.type === "Buy" ? "default" : "destructive"} className="text-xs">
													{ord.type}
												</Badge>
											</div>
											<div className="flex justify-between text-xs pt-1 border-t border-border/60">
												<span className="text-muted-foreground">Qty: {ord.quantity} Lot</span>
												<span className="font-mono font-bold">₹{ord.price.toLocaleString("en-IN")}</span>
											</div>
											<div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
												<CheckCircle2 className="h-3 w-3" />
												<span>{ord.status}</span>
											</div>
										</div>
									))}
								</div>
							</CardContent>
						</Card>
					</div>
				</TabsContent>

				{/* ── Precious Metals Tab ─────────────────────────────────────── */}
				<TabsContent value="metals" className="space-y-4">
					<div className="grid md:grid-cols-2 gap-6">
						{commodities
							.filter((c) => c.category === "Precious Metals")
							.map((metal) => (
								<Card key={metal.id || metal.symbol} className="overflow-hidden">
									<CardHeader className="pb-3">
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-3">
												<div className="p-2.5 rounded-lg bg-amber-500/10">
													<Gem className="h-6 w-6 text-amber-500" />
												</div>
												<div>
													<CardTitle>{metal.name}</CardTitle>
													<CardDescription>
														{metal.exchange} • {metal.unit}
													</CardDescription>
												</div>
											</div>
											<Badge
												variant={
													metal.changePercent >= 0 ? "default" : "destructive"
												}
												className="font-mono"
											>
												{metal.changePercent >= 0 ? "+" : ""}
												{metal.changePercent}%
											</Badge>
										</div>
									</CardHeader>
									<CardContent className="space-y-4">
										<div>
											<p className="text-3xl font-bold font-mono text-foreground">
												₹{metal.price.toLocaleString("en-IN")}
											</p>
											<p
												className={`text-xs font-semibold mt-1 font-mono ${metal.change >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
											>
												{metal.change >= 0 ? "+" : ""}₹{metal.change} today
											</p>
										</div>
										<div className="flex justify-between text-xs text-muted-foreground pt-1 border-t">
											<span>24h Traded Volume</span>
											<span className="font-mono font-medium text-foreground">{metal.volume}</span>
										</div>
										<div className="grid grid-cols-2 gap-2 pt-2">
											<Button
												variant="outline"
												size="sm"
												className="gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800"
												onClick={() => handleOpenChat(metal)}
											>
												<Bot className="h-3.5 w-3.5" />
												AI Copilot
											</Button>
											<Button
												size="sm"
												className="text-xs"
												onClick={() => {
													setTradeCommodity(metal.symbol);
													setTradeExchange(metal.exchange.toLowerCase());
													setActiveTab("trade");
												}}
											>
												Trade {metal.symbol}
											</Button>
										</div>
									</CardContent>
								</Card>
							))}
					</div>
				</TabsContent>

				{/* ── Energy Tab ──────────────────────────────────────────────── */}
				<TabsContent value="energy" className="space-y-4">
					<div className="grid md:grid-cols-2 gap-6">
						{commodities
							.filter((c) => c.category === "Energy")
							.map((energy) => (
								<Card key={energy.id || energy.symbol} className="overflow-hidden">
									<CardHeader className="pb-3">
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-3">
												<div className="p-2.5 rounded-lg bg-orange-500/10">
													<Zap className="h-6 w-6 text-orange-500" />
												</div>
												<div>
													<CardTitle>{energy.name}</CardTitle>
													<CardDescription>
														{energy.exchange} • {energy.unit}
													</CardDescription>
												</div>
											</div>
											<Badge
												variant={
													energy.changePercent >= 0 ? "default" : "destructive"
												}
												className="font-mono"
											>
												{energy.changePercent >= 0 ? "+" : ""}
												{energy.changePercent}%
											</Badge>
										</div>
									</CardHeader>
									<CardContent className="space-y-4">
										<div>
											<p className="text-3xl font-bold font-mono text-foreground">
												₹{energy.price.toLocaleString("en-IN")}
											</p>
											<p
												className={`text-xs font-semibold mt-1 font-mono ${energy.change >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
											>
												{energy.change >= 0 ? "+" : ""}₹{energy.change} today
											</p>
										</div>
										<div className="flex justify-between text-xs text-muted-foreground pt-1 border-t">
											<span>24h Traded Volume</span>
											<span className="font-mono font-medium text-foreground">{energy.volume}</span>
										</div>
										<div className="grid grid-cols-2 gap-2 pt-2">
											<Button
												variant="outline"
												size="sm"
												className="gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800"
												onClick={() => handleOpenChat(energy)}
											>
												<Bot className="h-3.5 w-3.5" />
												AI Copilot
											</Button>
											<Button
												size="sm"
												className="text-xs"
												onClick={() => {
													setTradeCommodity(energy.symbol);
													setTradeExchange(energy.exchange.toLowerCase());
													setActiveTab("trade");
												}}
											>
												Trade {energy.symbol}
											</Button>
										</div>
									</CardContent>
								</Card>
							))}
					</div>
				</TabsContent>

				{/* ── Agriculture (NCDEX) Tab ─────────────────────────────────── */}
				<TabsContent value="agri" className="space-y-4">
					<div className="grid md:grid-cols-2 gap-6">
						{commodities
							.filter(
								(c) => c.category === "Agriculture" || c.category === "Spices",
							)
							.map((agri) => (
								<Card key={agri.id || agri.symbol} className="overflow-hidden">
									<CardHeader className="pb-3">
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-3">
												<div className="p-2.5 rounded-lg bg-emerald-500/10">
													<Wheat className="h-6 w-6 text-emerald-500" />
												</div>
												<div>
													<CardTitle>{agri.name}</CardTitle>
													<CardDescription>
														{agri.exchange} • {agri.unit}
													</CardDescription>
												</div>
											</div>
											<Badge
												variant={
													agri.changePercent >= 0 ? "default" : "destructive"
												}
												className="font-mono"
											>
												{agri.changePercent >= 0 ? "+" : ""}
												{agri.changePercent}%
											</Badge>
										</div>
									</CardHeader>
									<CardContent className="space-y-4">
										<div>
											<p className="text-3xl font-bold font-mono text-foreground">
												₹{agri.price.toLocaleString("en-IN")}
											</p>
											<p
												className={`text-xs font-semibold mt-1 font-mono ${agri.change >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
											>
												{agri.change >= 0 ? "+" : ""}₹{agri.change} today
											</p>
										</div>
										<div className="flex justify-between text-xs text-muted-foreground pt-1 border-t">
											<span>24h Traded Volume</span>
											<span className="font-mono font-medium text-foreground">{agri.volume}</span>
										</div>
										<div className="grid grid-cols-2 gap-2 pt-2">
											<Button
												variant="outline"
												size="sm"
												className="gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800"
												onClick={() => handleOpenChat(agri)}
											>
												<Bot className="h-3.5 w-3.5" />
												AI Copilot
											</Button>
											<Button
												size="sm"
												className="text-xs"
												onClick={() => {
													setTradeCommodity(agri.symbol);
													setTradeExchange(agri.exchange.toLowerCase());
													setActiveTab("trade");
												}}
											>
												Trade {agri.symbol}
											</Button>
										</div>
									</CardContent>
								</Card>
							))}
					</div>
				</TabsContent>
			</Tabs>

			{/* ── Universal Instrument AI Chat Dialog ──────────────────────── */}
			<InstrumentChatDialog
				instrument={activeChatInstrument}
				isOpen={isChatOpen}
				onClose={() => setIsChatOpen(false)}
			/>
		</div>
	);
}
