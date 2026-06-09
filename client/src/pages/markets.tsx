import { MarketChart } from "@/components/dashboard/market-chart";
import { MarketMovers } from "@/components/dashboard/market-movers";
import { MarketNews } from "@/components/dashboard/market-news";
import { MarketStatus } from "@/components/dashboard/market-status";
import { NSEData } from "@/components/dashboard/nse-data";
import { BSEData } from "@/components/dashboard/bse-data";
import { MCXData } from "@/components/dashboard/mcx-data";
import { NCDEXData } from "@/components/dashboard/ncdex-data";
import { MSEIData } from "@/components/dashboard/msei-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { useMarketQuote, useMarketIndices } from "@/hooks/use-market-data";
import { GLOBAL_INDICES } from "@/lib/constants";
import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
	StoryViewer,
	type MarketStoryData,
} from "@/components/market/story-viewer";
import { useToast } from "@/hooks/use-toast";
import {
	Search,
	TrendingUp,
	TrendingDown,
	Activity,
	Sparkles,
	Zap,
	Globe,
	BarChart3,
	PieChart,
	Target,
	Clock,
	Eye,
	Filter,
	RefreshCw,
	Bookmark,
	AlertCircle,
	IndianRupee,
	Percent,
	Volume2,
	Calendar,
} from "lucide-react";
import { AgriculturalTooltip } from "@/components/agricultural-tooltip";
import { CurrencySelector } from "@/components/CurrencySelector";
import { CurrencyDisplay } from "@/components/CurrencyDisplay";
import { useQuery } from "@tanstack/react-query";

export default function Markets() {
	const [searchSymbol, setSearchSymbol] = useState("");
	const [selectedSymbol, setSelectedSymbol] = useState("^NSEI");
	const [currentStory, setCurrentStory] = useState<MarketStoryData | null>(
		null,
	);
	const [activeExchange, setActiveExchange] = useState("nse");
	const [watchlist, setWatchlist] = useState<string[]>([
		"^NSEI",
		"^BSESN",
		"^GSPC",
	]);
	const [selectedCurrency, setSelectedCurrency] = useState("INR");

	const { data: indices } = useMarketIndices();
	const { data: symbolQuote } = useMarketQuote(searchSymbol.toUpperCase());
	const { toast } = useToast();

	// Fetch exchange rates for currency conversion
	const { data: exchangeRates } = useQuery({
		queryKey: ["/api/currencies/rates", selectedCurrency],
		queryFn: async () => {
			const response = await fetch(
				`/api/currencies/rates?base=${selectedCurrency}`,
			);
			if (!response.ok) throw new Error("Failed to fetch exchange rates");
			return response.json();
		},
	});

	// Convert price to selected currency
	const convertPrice = (
		priceInINR: number,
		fromCurrency: string = "INR",
	): number => {
		if (selectedCurrency === fromCurrency) return priceInINR;

		if (exchangeRates?.rates) {
			const rate = exchangeRates.rates[selectedCurrency];
			if (rate) {
				return priceInINR * rate;
			}
		}
		return priceInINR;
	};

	// Mutation for generating AI market stories
	const generateStoryMutation = useMutation({
		mutationFn: async ({
			symbols,
			useCurrentData = true,
		}: { symbols?: string[]; useCurrentData?: boolean }) => {
			const response = await apiRequest("/api/market/story/generate", "POST", {
				body: {
					symbols: symbols || GLOBAL_INDICES.map((idx) => idx.symbol),
					useCurrentData,
				},
			});
			return response.json();
		},
		onSuccess: (storyData: MarketStoryData) => {
			setCurrentStory(storyData);
			toast({
				title: "Market Story Generated!",
				description:
					"AI has analyzed the market trends and created your story.",
			});
		},
		onError: (error: Error) => {
			toast({
				title: "Story Generation Failed",
				description:
					error.message || "Failed to generate market story. Please try again.",
				variant: "destructive",
			});
		},
	});

	const handleGenerateStory = () => {
		generateStoryMutation.mutate({
			symbols: GLOBAL_INDICES.map((idx) => idx.symbol),
			useCurrentData: true,
		});
	};

	const handleSearch = (e: React.FormEvent) => {
		e.preventDefault();
		if (searchSymbol.trim()) {
			setSelectedSymbol(searchSymbol.toUpperCase());
		}
	};

	const addToWatchlist = (symbol: string) => {
		if (!watchlist.includes(symbol)) {
			setWatchlist([...watchlist, symbol]);
			toast({
				title: "Added to Watchlist",
				description: `${symbol} has been added to your watchlist.`,
			});
		}
	};

	const removeFromWatchlist = (symbol: string) => {
		setWatchlist(watchlist.filter((s) => s !== symbol));
		toast({
			title: "Removed from Watchlist",
			description: `${symbol} has been removed from your watchlist.`,
		});
	};

	const marketSummary = {
		totalVolume: "₹45,230 Cr",
		avgChange: "+1.24%",
		activeStocks: "2,847",
		marketCap: "₹284.5L Cr",
	};

	return (
		<div className="space-y-8" data-testid="markets-page">
			<div className="space-y-6">
				{/* Global Indices Dashboard */}
				<section className="mb-8" data-testid="global-indices">
					<div className="flex items-center justify-between mb-6">
						<h2 className="text-3xl font-bold text-foreground flex items-center">
							<Globe className="h-8 w-8 mr-3 text-blue-600" />
							Global Market Indices
						</h2>
						<div className="flex items-center gap-3">
							<div className="flex items-center gap-2">
								<span className="text-sm text-muted-foreground">
									Display in:
								</span>
								<CurrencySelector
									value={selectedCurrency}
									onChange={setSelectedCurrency}
									className="w-40"
								/>
							</div>
							<Button variant="outline" size="sm">
								<Eye className="h-4 w-4 mr-2" />
								View All
							</Button>
						</div>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
						{GLOBAL_INDICES.map((index) => {
							const indexData = indices?.find((i) => i.symbol === index.symbol);
							const isPositive = (indexData?.changePercent || 0) >= 0;
							const isInWatchlist = watchlist.includes(index.symbol);

							return (
								<Card
									key={index.symbol}
									className="group hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border-0 shadow-lg"
									onClick={() => setSelectedSymbol(index.symbol)}
									data-testid={`index-card-${index.symbol}`}
								>
									<CardContent className="p-6">
										<div className="flex items-center justify-between mb-3">
											<Badge variant="outline" className="text-xs font-medium">
												{index.region}
											</Badge>
											<div className="flex items-center gap-2">
												<Button
													variant="ghost"
													size="sm"
													className="h-8 w-8 p-0"
													onClick={(e) => {
														e.stopPropagation();
														isInWatchlist
															? removeFromWatchlist(index.symbol)
															: addToWatchlist(index.symbol);
													}}
												>
													<Bookmark
														className={`h-4 w-4 ${isInWatchlist ? "fill-current text-blue-600" : "text-muted-foreground"}`}
													/>
												</Button>
												{isPositive ? (
													<TrendingUp className="h-5 w-5 text-green-600" />
												) : (
													<TrendingDown className="h-5 w-5 text-red-600" />
												)}
											</div>
										</div>

										<h3 className="font-bold text-lg text-foreground mb-2 group-hover:text-blue-600 transition-colors">
											{index.name}
										</h3>

										<div className="space-y-2">
											{indexData?.price ? (
												<>
													<p
														className="text-2xl font-bold text-foreground"
														data-testid={`index-price-${index.symbol}`}
													>
														<CurrencyDisplay
															amount={convertPrice(indexData.price, "INR")}
															currency={selectedCurrency}
														/>
													</p>
													{selectedCurrency !== "INR" && (
														<p className="text-xs text-muted-foreground">
															≈ ₹
															{indexData.price.toLocaleString(undefined, {
																minimumFractionDigits: 2,
																maximumFractionDigits: 2,
															})}{" "}
															INR
														</p>
													)}
												</>
											) : (
												<p className="text-2xl font-bold text-foreground">
													Loading...
												</p>
											)}

											<div className="flex items-center justify-between">
												<p
													className={`text-sm font-semibold px-2 py-1 rounded ${
														isPositive
															? "text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30"
															: "text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30"
													}`}
													data-testid={`index-change-${index.symbol}`}
												>
													{indexData ? (
														<>
															{isPositive ? "+" : ""}
															{indexData.changePercent?.toFixed(2)}%
														</>
													) : (
														"Loading..."
													)}
												</p>

												<p className="text-sm text-muted-foreground">
													{indexData ? (
														<>
															{isPositive ? "+" : ""}
															{indexData.change?.toFixed(2)}
														</>
													) : (
														"Loading..."
													)}
												</p>
											</div>
										</div>
									</CardContent>
								</Card>
							);
						})}
					</div>
				</section>

				{/* AI Generated Market Story */}
				{currentStory && (
					<section className="mb-8" data-testid="ai-story-section">
						<StoryViewer
							story={currentStory}
							onRefresh={() => handleGenerateStory()}
							isRefreshing={generateStoryMutation.isPending}
						/>
					</section>
				)}

				{/* Main Market Dashboard */}
				<section
					className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8"
					data-testid="market-dashboard"
				>
					{/* Enhanced Market Chart */}
					<div className="lg:col-span-2">
						<Card className="shadow-xl border-0">
							<CardHeader className="border-b border-border">
								<div className="flex items-center justify-between">
									<CardTitle className="text-xl font-bold text-foreground flex items-center">
										<BarChart3 className="h-6 w-6 mr-3 text-blue-600" />
										Live Chart - {selectedSymbol}
									</CardTitle>
									<div className="flex items-center gap-2">
										<Badge
											variant="outline"
											className="flex items-center gap-1"
										>
											<div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
											Live
										</Badge>
										<Button variant="outline" size="sm">
											<Calendar className="h-4 w-4 mr-2" />
											1D
										</Button>
									</div>
								</div>
							</CardHeader>
							<CardContent className="p-6">
								<MarketChart symbol={selectedSymbol} />
							</CardContent>
						</Card>
					</div>

					{/* Market Status & Stock Details */}
					<div className="space-y-6">
						<MarketStatus />

						{/* Enhanced Stock Quote Details */}
						<Card className="shadow-xl border-0">
							<CardHeader className="border-b border-border">
								<CardTitle className="flex items-center gap-2">
									<Target className="h-5 w-5 text-blue-600" />
									Stock Details
								</CardTitle>
							</CardHeader>
							<CardContent className="p-6">
								{searchSymbol && symbolQuote ? (
									<div className="space-y-6" data-testid="stock-quote-details">
										<div className="text-center pb-4 border-b border-border">
											<h3 className="font-bold text-2xl text-foreground mb-2">
												{searchSymbol.toUpperCase()}
											</h3>
											<p className="text-4xl font-bold text-blue-600 mb-2">
												₹{symbolQuote.c?.toFixed(2)}
											</p>
											<div
												className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
													symbolQuote.d >= 0
														? "text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30"
														: "text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30"
												}`}
											>
												{symbolQuote.d >= 0 ? "+" : ""}₹
												{symbolQuote.d?.toFixed(2)}(
												{symbolQuote.dp >= 0 ? "+" : ""}
												{symbolQuote.dp?.toFixed(2)}%)
											</div>
										</div>

										<div className="grid grid-cols-2 gap-4 text-sm">
											{[
												{
													label: "High",
													value: `₹${symbolQuote.h?.toFixed(2)}`,
													color: "text-green-600",
												},
												{
													label: "Low",
													value: `₹${symbolQuote.l?.toFixed(2)}`,
													color: "text-red-600",
												},
												{
													label: "Open",
													value: `₹${symbolQuote.o?.toFixed(2)}`,
													color: "text-foreground",
												},
												{
													label: "Prev Close",
													value: `₹${symbolQuote.pc?.toFixed(2)}`,
													color: "text-foreground",
												},
											].map((item, index) => (
												<div key={index} className="bg-muted rounded-lg p-3">
													<p className="text-muted-foreground mb-1">
														{item.label}
													</p>
													<p className={`font-bold text-lg ${item.color}`}>
														{item.value}
													</p>
												</div>
											))}
										</div>

										<Button
											className="w-full"
											onClick={() => addToWatchlist(searchSymbol.toUpperCase())}
										>
											<Bookmark className="h-4 w-4 mr-2" />
											Add to Watchlist
										</Button>
									</div>
								) : (
									<div className="text-center py-12">
										<Search className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
										<p className="text-muted-foreground mb-2 font-medium">
											No Stock Selected
										</p>
										<p className="text-sm text-muted-foreground">
											Search for a stock symbol above to view detailed quote
											information
										</p>
									</div>
								)}
							</CardContent>
						</Card>
					</div>
				</section>

				{/* Market Data Tabs */}
				<section className="mb-8">
					<Tabs defaultValue="exchanges" className="w-full">
						<div className="flex items-center justify-between mb-6">
							<h2 className="text-3xl font-bold text-foreground">
								Market Data
							</h2>
						</div>
						<ScrollableTabsList>
							<TabsTrigger
								value="exchanges"
								className="flex items-center gap-2 flex-shrink-0"
							>
								<Activity className="h-4 w-4" />
								Exchanges
							</TabsTrigger>
							<TabsTrigger
								value="movers"
								className="flex items-center gap-2 flex-shrink-0"
							>
								<TrendingUp className="h-4 w-4" />
								Movers
							</TabsTrigger>
							<TabsTrigger
								value="news"
								className="flex items-center gap-2 flex-shrink-0"
							>
								<AlertCircle className="h-4 w-4" />
								News
							</TabsTrigger>
						</ScrollableTabsList>

						<TabsContent value="exchanges" className="space-y-8">
							{/* Indian Stock Exchanges */}
							<div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
								<Card className="shadow-xl border-0">
									<CardHeader className="border-b border-border">
										<CardTitle className="text-xl font-semibold text-foreground">
											NSE (National Stock Exchange)
										</CardTitle>
									</CardHeader>
									<CardContent className="p-6">
										<NSEData />
									</CardContent>
								</Card>

								<Card className="shadow-xl border-0">
									<CardHeader className="border-b border-border">
										<CardTitle className="text-xl font-semibold text-foreground">
											BSE (Bombay Stock Exchange)
										</CardTitle>
									</CardHeader>
									<CardContent className="p-6">
										<BSEData />
									</CardContent>
								</Card>
							</div>

							{/* Commodities Exchanges */}
							<div className="space-y-8">
								<Card className="shadow-xl border-0">
									<CardHeader className="border-b border-border">
										<CardTitle className="text-xl font-semibold text-foreground">
											<AgriculturalTooltip searchTerm="commodity">
												MCX Commodities Live Data
											</AgriculturalTooltip>
										</CardTitle>
									</CardHeader>
									<CardContent className="p-6">
										<MCXData />
									</CardContent>
								</Card>

								<Card className="shadow-xl border-0">
									<CardHeader className="border-b border-border">
										<CardTitle className="text-xl font-semibold text-foreground">
											<AgriculturalTooltip searchTerm="agricultural commodity">
												NCDEX Agricultural Commodities
											</AgriculturalTooltip>
										</CardTitle>
									</CardHeader>
									<CardContent className="p-6">
										<NCDEXData />
									</CardContent>
								</Card>

								<Card className="shadow-xl border-0">
									<CardHeader className="border-b border-border">
										<CardTitle className="text-xl font-semibold text-foreground">
											MSEI Metropolitan Stock Exchange
										</CardTitle>
									</CardHeader>
									<CardContent className="p-6">
										<MSEIData />
									</CardContent>
								</Card>
							</div>
						</TabsContent>

						<TabsContent value="movers" className="space-y-6">
							<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
								<MarketMovers />
								<Card className="shadow-xl border-0">
									<CardHeader className="border-b border-border">
										<CardTitle className="text-xl font-semibold text-foreground flex items-center">
											<PieChart className="h-5 w-5 mr-2 text-blue-600" />
											Sector Performance
										</CardTitle>
									</CardHeader>
									<CardContent className="p-6">
										<div className="space-y-4">
											{[
												{
													sector: "Technology",
													change: "+2.8%",
													color:
														"text-green-600 bg-green-50 dark:bg-green-950/30",
												},
												{
													sector: "Banking",
													change: "+1.2%",
													color:
														"text-green-600 bg-green-50 dark:bg-green-950/30",
												},
												{
													sector: "Pharmaceuticals",
													change: "-0.5%",
													color: "text-red-600 bg-red-50 dark:bg-red-950/30",
												},
												{
													sector: "Automobiles",
													change: "+0.9%",
													color:
														"text-green-600 bg-green-50 dark:bg-green-950/30",
												},
												{
													sector: "Real Estate",
													change: "-1.3%",
													color: "text-red-600 bg-red-50 dark:bg-red-950/30",
												},
											].map((item, index) => (
												<div
													key={index}
													className="flex items-center justify-between p-3 bg-muted rounded-lg"
												>
													<span className="font-medium text-foreground">
														{item.sector}
													</span>
													<span
														className={`px-2 py-1 rounded text-sm font-semibold ${item.color}`}
													>
														{item.change}
													</span>
												</div>
											))}
										</div>
									</CardContent>
								</Card>
							</div>
						</TabsContent>

						<TabsContent value="news" className="space-y-6">
							<MarketNews />
						</TabsContent>
					</Tabs>
				</section>

				{/* Watchlist Section */}
				{watchlist.length > 0 && (
					<section className="mb-8">
						<div className="flex items-center justify-between mb-6">
							<h2 className="text-3xl font-bold text-foreground flex items-center">
								<Bookmark className="h-8 w-8 mr-3 text-blue-600" />
								Your Watchlist
							</h2>
							<Badge variant="secondary">{watchlist.length} items</Badge>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
							{watchlist.map((symbol) => {
								const indexData = indices?.find((i) => i.symbol === symbol);
								const isPositive = (indexData?.changePercent || 0) >= 0;

								return (
									<Card
										key={symbol}
										className="hover:shadow-lg transition-shadow cursor-pointer"
									>
										<CardContent className="p-4">
											<div className="flex items-center justify-between mb-2">
												<span className="font-semibold text-sm text-foreground">
													{symbol}
												</span>
												<Button
													variant="ghost"
													size="sm"
													className="h-6 w-6 p-0"
													onClick={() => removeFromWatchlist(symbol)}
												>
													<Bookmark className="h-3 w-3 fill-current text-blue-600" />
												</Button>
											</div>
											<p className="font-bold text-lg">
												{indexData?.price?.toFixed(2) || "Loading..."}
											</p>
											<p
												className={`text-xs font-medium ${isPositive ? "text-green-600" : "text-red-600"}`}
											>
												{indexData
													? `${isPositive ? "+" : ""}${indexData.changePercent?.toFixed(2)}%`
													: "Loading..."}
											</p>
										</CardContent>
									</Card>
								);
							})}
						</div>
					</section>
				)}
			</div>
		</div>
	);
}
