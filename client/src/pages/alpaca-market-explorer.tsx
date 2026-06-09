import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
	Search,
	TrendingUp,
	TrendingDown,
	Activity,
	BarChart3,
	Info,
	Star,
	StarOff,
	RefreshCw,
	ArrowUpRight,
	ArrowDownRight,
	Clock,
	ExternalLink,
	ShieldCheck,
	Zap,
} from "lucide-react";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
	ResponsiveContainer,
	AreaChart,
	Area,
	XAxis,
	YAxis,
	Tooltip,
	CartesianGrid,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/app-layout";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

// --- Types ---

interface StockQuote {
	symbol: string;
	price: number;
	change: number;
	changePercent: number;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
	timestamp: number;
	bid?: number;
	ask?: number;
}

interface StockBar {
	timestamp: string;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
}

interface SymbolResult {
	symbol: string;
	name: string;
	primaryExchange: string;
}

// --- Components ---

const GlassCard = ({
	children,
	className = "",
}: { children: React.ReactNode; className?: string }) => (
	<Card
		className={`bg-background/40 backdrop-blur-md border-border/50 shadow-xl overflow-hidden ${className}`}
	>
		{children}
	</Card>
);

const PriceDisplay = ({ value, change }: { value: number; change: number }) => {
	const isPositive = change >= 0;
	return (
		<div className="flex flex-col items-start">
			<span className="text-4xl font-bold tracking-tighter">
				$
				{value.toLocaleString(undefined, {
					minimumFractionDigits: 2,
					maximumFractionDigits: 2,
				})}
			</span>
			<div
				className={`flex items-center gap-1 text-sm font-medium ${isPositive ? "text-emerald-500" : "text-rose-500"}`}
			>
				{isPositive ? (
					<TrendingUp className="w-4 h-4" />
				) : (
					<TrendingDown className="w-4 h-4" />
				)}
				<span>
					{isPositive ? "+" : ""}
					{change.toFixed(2)} ({isPositive ? "+" : ""}
					{((change / (value - change)) * 100).toFixed(2)}%)
				</span>
			</div>
		</div>
	);
};

export default function AlpacaMarketExplorer() {
	const { toast } = useToast();
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedSymbol, setSelectedSymbol] = useState("AAPL");
	const [timeframe, setTimeframe] = useState("1Day");
	const [watchlist, setWatchlist] = useState<string[]>(() => {
		const saved = localStorage.getItem("alpaca_watchlist");
		return saved
			? JSON.parse(saved)
			: ["AAPL", "TSLA", "MSFT", "NVDA", "BTCUSD"];
	});

	useEffect(() => {
		localStorage.setItem("alpaca_watchlist", JSON.stringify(watchlist));
	}, [watchlist]);

	// --- API Queries ---

	const { data: status } = useQuery({
		queryKey: ["alpaca-market-status"],
		queryFn: async () => {
			const res = await fetch("/api/alpaca/market/status");
			if (!res.ok) throw new Error("Failed to fetch market status");
			return res.json();
		},
		refetchInterval: 30000,
	});

	const { data: searchResults, isLoading: isSearching } = useQuery({
		queryKey: ["alpaca-search", searchQuery],
		queryFn: async () => {
			if (!searchQuery) return [];
			const res = await fetch(
				`/api/alpaca/market/search?q=${encodeURIComponent(searchQuery)}`,
			);
			if (!res.ok) throw new Error("Search failed");
			return res.json() as Promise<SymbolResult[]>;
		},
		enabled: searchQuery.length > 1,
	});

	const {
		data: quote,
		isLoading: isLoadingQuote,
		refetch: refetchQuote,
	} = useQuery({
		queryKey: ["alpaca-quote", selectedSymbol],
		queryFn: async () => {
			const res = await fetch(`/api/alpaca/market/quote/${selectedSymbol}`);
			if (!res.ok) throw new Error("Failed to fetch quote");
			return res.json() as Promise<StockQuote>;
		},
		refetchInterval: 10000, // Update every 10s
	});

	const { data: bars, isLoading: isLoadingBars } = useQuery({
		queryKey: ["alpaca-bars", selectedSymbol, timeframe],
		queryFn: async () => {
			const res = await fetch(
				`/api/alpaca/market/bars/${selectedSymbol}?timeframe=${timeframe}`,
			);
			if (!res.ok) throw new Error("Failed to fetch chart data");
			const data = await res.json();
			return data[selectedSymbol] as StockBar[];
		},
	});

	// --- Handlers ---

	const toggleWatchlist = (symbol: string) => {
		if (watchlist.includes(symbol)) {
			setWatchlist(watchlist.filter((s) => s !== symbol));
			toast({
				title: "Removed from Watchlist",
				description: `${symbol} removed.`,
			});
		} else {
			setWatchlist([...watchlist, symbol]);
			toast({ title: "Added to Watchlist", description: `${symbol} added.` });
		}
	};

	// --- Derived Data ---

	const chartData = useMemo(() => {
		if (!bars) return [];
		return bars.map((bar) => ({
			time:
				timeframe === "1Day" || timeframe === "1Week"
					? new Date(bar.timestamp).toLocaleDateString(undefined, {
							month: "short",
							day: "numeric",
						})
					: new Date(bar.timestamp).toLocaleTimeString(undefined, {
							hour: "2-digit",
							minute: "2-digit",
						}),
			price: bar.close,
			timestamp: new Date(bar.timestamp).getTime(),
		}));
	}, [bars, timeframe]);

	return (
		<AppLayout>
			<div className="container mx-auto p-4 space-y-6 max-w-7xl animate-in fade-in duration-700">
				{/* Header Section */}
				<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
					<div>
						<h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
							Market Explorer
						</h1>
						<p className="text-muted-foreground flex items-center gap-2 mt-1">
							<Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
							Powered by Alpaca Real-Time SIP Feed
						</p>
					</div>

					<div className="flex items-center gap-3">
						<Badge
							variant={status?.success ? "outline" : "destructive"}
							className="h-7 px-3 flex gap-2 items-center border-emerald-500/30 text-emerald-500 bg-emerald-500/10"
						>
							<div
								className={`w-2 h-2 rounded-full ${status?.success ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`}
							/>
							{status?.success ? "Live Stream Active" : "Disconnected"}
						</Badge>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => refetchQuote()}
							className="rounded-full"
						>
							<RefreshCw
								className={`w-4 h-4 ${isLoadingQuote ? "animate-spin" : ""}`}
							/>
						</Button>
					</div>
				</div>

				{/* Main Grid */}
				<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
					{/* Left Sidebar: Search & Watchlist */}
					<div className="lg:col-span-3 space-y-6">
						<GlassCard>
							<CardContent className="p-4 space-y-4">
								<div className="relative">
									<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
									<Input
										placeholder="Search symbols..."
										className="pl-9 bg-background/50 border-border/40 focus-visible:ring-primary/30"
										value={searchQuery}
										onChange={(e) =>
											setSearchQuery(e.target.value.toUpperCase())
										}
									/>
								</div>

								<AnimatePresence>
									{searchQuery.length > 0 && (
										<motion.div
											initial={{ opacity: 0, y: -10 }}
											animate={{ opacity: 1, y: 0 }}
											exit={{ opacity: 0, y: -10 }}
											className="absolute z-50 w-full left-0 mt-2 px-4"
										>
											<Card className="bg-popover/90 backdrop-blur-xl border-border/50 shadow-2xl">
												<ScrollArea className="h-64">
													{isSearching ? (
														<div className="p-4 space-y-2">
															<Skeleton className="h-10 w-full" />
															<Skeleton className="h-10 w-full" />
															<Skeleton className="h-10 w-full" />
														</div>
													) : searchResults?.length === 0 ? (
														<div className="p-8 text-center text-muted-foreground">
															No results found
														</div>
													) : (
														<div className="p-2">
															{searchResults?.map((res) => (
																<button
																	key={res.symbol}
																	onClick={() => {
																		setSelectedSymbol(res.symbol);
																		setSearchQuery("");
																	}}
																	className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors group text-left"
																>
																	<div>
																		<div className="font-bold flex items-center gap-2">
																			{res.symbol}
																			<Badge
																				variant="secondary"
																				className="text-[10px] h-4 px-1"
																			>
																				{res.primaryExchange}
																			</Badge>
																		</div>
																		<div className="text-xs text-muted-foreground truncate max-w-[150px]">
																			{res.name}
																		</div>
																	</div>
																	<ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
																</button>
															))}
														</div>
													)}
												</ScrollArea>
											</Card>
										</motion.div>
									)}
								</AnimatePresence>

								<div className="pt-2">
									<div className="flex items-center justify-between mb-3 px-1">
										<span className="text-sm font-semibold flex items-center gap-2">
											<Star className="w-4 h-4 text-amber-500 fill-amber-500" />
											Watchlist
										</span>
										<Badge variant="outline" className="text-[10px]">
											{watchlist.length}
										</Badge>
									</div>
									<div className="space-y-1">
										{watchlist.map((sym) => (
											<button
												key={sym}
												onClick={() => setSelectedSymbol(sym)}
												className={`w-full flex items-center justify-between p-2.5 rounded-lg transition-all ${
													selectedSymbol === sym
														? "bg-primary/10 border border-primary/20"
														: "hover:bg-accent/50 border border-transparent"
												}`}
											>
												<span className="font-bold text-sm">{sym}</span>
												<div className="flex items-center gap-2">
													<Activity className="w-3 h-3 text-muted-foreground" />
												</div>
											</button>
										))}
									</div>
								</div>
							</CardContent>
						</GlassCard>

						<GlassCard>
							<CardContent className="p-4">
								<h3 className="text-sm font-bold flex items-center gap-2 mb-3">
									<Clock className="w-4 h-4 text-blue-400" />
									Recent Activity
								</h3>
								<div className="space-y-4">
									{[1, 2, 3].map((i) => (
										<div key={i} className="flex gap-3 items-start">
											<div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
											<div className="text-xs leading-tight">
												<span className="text-blue-400 font-medium">
													System Alert:
												</span>{" "}
												High volatility detected in {selectedSymbol}.
												<div className="text-[10px] text-muted-foreground mt-1">
													2 mins ago
												</div>
											</div>
										</div>
									))}
								</div>
							</CardContent>
						</GlassCard>
					</div>

					{/* Main Content: Chart & Stats */}
					<div className="lg:col-span-9 space-y-6">
						{/* Asset Profile Header */}
						<GlassCard className="p-6">
							<div className="flex flex-col md:flex-row justify-between gap-6">
								<div className="space-y-1">
									<div className="flex items-center gap-3">
										<h2 className="text-4xl font-black tracking-tight">
											{selectedSymbol}
										</h2>
										<Button
											variant="ghost"
											size="icon"
											onClick={() => toggleWatchlist(selectedSymbol)}
											className="rounded-full h-8 w-8"
										>
											{watchlist.includes(selectedSymbol) ? (
												<Star className="w-5 h-5 text-amber-500 fill-amber-500" />
											) : (
												<StarOff className="w-5 h-5 text-muted-foreground" />
											)}
										</Button>
									</div>
									<div className="text-muted-foreground font-medium flex items-center gap-2">
										{isLoadingQuote ? (
											<Skeleton className="h-4 w-32" />
										) : (
											"United States Equity • Common Stock"
										)}
									</div>
								</div>

								{isLoadingQuote ? (
									<div className="space-y-2">
										<Skeleton className="h-10 w-40" />
										<Skeleton className="h-4 w-24" />
									</div>
								) : (
									quote && (
										<PriceDisplay value={quote.price} change={quote.change} />
									)
								)}
							</div>

							<div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-8 pt-6 border-t border-border/30">
								<div>
									<div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">
										Open
									</div>
									<div className="text-lg font-bold">
										${quote?.open?.toFixed(2) || "—"}
									</div>
								</div>
								<div>
									<div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">
										High
									</div>
									<div className="text-lg font-bold">
										${quote?.high?.toFixed(2) || "—"}
									</div>
								</div>
								<div>
									<div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">
										Low
									</div>
									<div className="text-lg font-bold">
										${quote?.low?.toFixed(2) || "—"}
									</div>
								</div>
								<div>
									<div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">
										Volume
									</div>
									<div className="text-lg font-bold">
										{(quote?.volume || 0).toLocaleString()}
									</div>
								</div>
							</div>
						</GlassCard>

						{/* Chart Section */}
						<GlassCard>
							<CardHeader className="pb-0 flex flex-row items-center justify-between">
								<div>
									<CardTitle className="text-lg font-bold flex items-center gap-2">
										<BarChart3 className="w-4 h-4 text-primary" />
										Market Performance
									</CardTitle>
								</div>
								<Tabs
									value={timeframe}
									onValueChange={setTimeframe}
									className="w-auto"
								>
									<TabsList className="bg-background/50 border-border/40">
										<TabsTrigger value="1Min" className="text-[10px] h-7 px-2">
											1M
										</TabsTrigger>
										<TabsTrigger value="1Hour" className="text-[10px] h-7 px-2">
											1H
										</TabsTrigger>
										<TabsTrigger value="1Day" className="text-[10px] h-7 px-2">
											1D
										</TabsTrigger>
										<TabsTrigger value="1Week" className="text-[10px] h-7 px-2">
											1W
										</TabsTrigger>
									</TabsList>
								</Tabs>
							</CardHeader>
							<CardContent className="pt-6 h-[400px]">
								{isLoadingBars ? (
									<div className="w-full h-full flex flex-col items-center justify-center gap-4">
										<div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
										<p className="text-sm text-muted-foreground animate-pulse">
											Aggregating market bars...
										</p>
									</div>
								) : (
									<ResponsiveContainer width="100%" height="100%">
										<AreaChart data={chartData}>
											<defs>
												<linearGradient
													id="colorPrice"
													x1="0"
													y1="0"
													x2="0"
													y2="1"
												>
													<stop
														offset="5%"
														stopColor="hsl(var(--primary))"
														stopOpacity={0.3}
													/>
													<stop
														offset="95%"
														stopColor="hsl(var(--primary))"
														stopOpacity={0}
													/>
												</linearGradient>
											</defs>
											<CartesianGrid
												strokeDasharray="3 3"
												vertical={false}
												stroke="hsl(var(--border))"
												opacity={0.3}
											/>
											<XAxis
												dataKey="time"
												axisLine={false}
												tickLine={false}
												tick={{
													fill: "hsl(var(--muted-foreground))",
													fontSize: 10,
												}}
												minTickGap={30}
											/>
											<YAxis hide domain={["auto", "auto"]} />
											<Tooltip
												contentStyle={{
													backgroundColor: "hsl(var(--popover))",
													borderColor: "hsl(var(--border))",
													borderRadius: "12px",
													boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
													fontSize: "12px",
													fontWeight: "bold",
												}}
												itemStyle={{ color: "hsl(var(--primary))" }}
											/>
											<Area
												type="monotone"
												dataKey="price"
												stroke="hsl(var(--primary))"
												strokeWidth={2.5}
												fillOpacity={1}
												fill="url(#colorPrice)"
												animationDuration={1500}
											/>
										</AreaChart>
									</ResponsiveContainer>
								)}
							</CardContent>
						</GlassCard>

						{/* Bottom Panels */}
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							<GlassCard>
								<CardHeader>
									<CardTitle className="text-base flex items-center gap-2">
										<Info className="w-4 h-4 text-blue-400" />
										Company Insights
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="flex justify-between text-sm">
										<span className="text-muted-foreground">Exchange</span>
										<span className="font-bold">NASDAQ / NYSE</span>
									</div>
									<Separator className="bg-border/30" />
									<div className="flex justify-between text-sm">
										<span className="text-muted-foreground">Currency</span>
										<span className="font-bold">USD</span>
									</div>
									<Separator className="bg-border/30" />
									<div className="flex justify-between text-sm">
										<span className="text-muted-foreground">
											Trading Status
										</span>
										<Badge className="bg-emerald-500/20 text-emerald-500 border-none">
											ACTIVE
										</Badge>
									</div>
									<Button
										variant="outline"
										className="w-full mt-2 gap-2 text-xs h-9"
									>
										View Full Profile
										<ExternalLink className="w-3 h-3" />
									</Button>
								</CardContent>
							</GlassCard>

							<GlassCard>
								<CardHeader>
									<CardTitle className="text-base flex items-center gap-2">
										<ShieldCheck className="w-4 h-4 text-emerald-400" />
										Execution Quality
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="flex items-center gap-4 p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
										<div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-500">
											<Zap className="w-6 h-6 fill-emerald-500" />
										</div>
										<div>
											<div className="font-bold text-sm">
												SIP Feed Aggregation
											</div>
											<div className="text-[10px] text-muted-foreground">
												Sub-millisecond latency on NBBO quotes.
											</div>
										</div>
									</div>
									<p className="text-[11px] text-muted-foreground mt-4 italic">
										* NBBO (National Best Bid and Offer) is a regulation that
										requires brokers to execute customer trades at the best
										available ask and bid prices.
									</p>
								</CardContent>
							</GlassCard>
						</div>
					</div>
				</div>
			</div>
		</AppLayout>
	);
}
