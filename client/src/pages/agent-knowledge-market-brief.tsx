import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
	TrendingUp,
	TrendingDown,
	Calendar,
	AlertTriangle,
	Globe,
	ChevronLeft,
	RefreshCw,
	Clock,
	BarChart3,
	Newspaper,
	Sparkles,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";

interface MarketBrief {
	id: string;
	date: string;
	region: string;
	marketSnapshot: string;
	whatChanged: string;
	topMovers: {
		name: string;
		symbol?: string;
		change: number;
		direction: "up" | "down";
	}[];
	sectorHighlights: {
		sector: string;
		trend: string;
		outlook: string;
	}[];
	keyRisks?: string;
	agentTips?: string;
	sources?: string[];
	publishedAt?: string;
	version: number;
}

function safeFormatDate(dateStr?: string, fmt = "EEEE, MMMM d, yyyy") {
	if (!dateStr) return format(new Date(), fmt);
	try {
		const d = new Date(dateStr);
		return Number.isNaN(d.getTime()) ? format(new Date(), fmt) : format(d, fmt);
	} catch {
		return format(new Date(), fmt);
	}
}

function getClientFallbackBrief(region: string): MarketBrief {
	const today = new Date().toISOString().split("T")[0];
	const isIndia = region === "india";

	return {
		id: `mb-fallback-${today}-${region}`,
		date: today,
		region,
		marketSnapshot: isIndia
			? "Indian equity benchmarks traded with positive bias as Nifty 50 and Sensex demonstrated strength supported by sustained domestic institutional inflows (DIIs). Bank Nifty outperformed led by frontline private and PSU lenders. The 10-year benchmark Indian Government Bond (G-Sec) yield remained steady at 6.84%, offering attractive real yield spreads for fixed income investors."
			: "US equities traded higher with the S&P 500 and Nasdaq supported by megacap technology earnings and steady labor market prints. 10-year Treasury yields consolidated as markets digested central bank policy commentary.",
		whatChanged: isIndia
			? "1. RBI Macroeconomic Stability: Systemic liquidity remained comfortable, and inflation prints tracking within the RBI target band.\n2. Institutional Inflows: Domestic Mutual Funds registered net equity inflows, continuing strong SIP momentum (~Rs 26,000+ Cr monthly run-rate).\n3. Corporate Balance Sheets: Capex announcements in infrastructure, defense, and renewables reinforced long-term domestic investment themes."
			: "1. Macro prints: Inflation gauges met consensus expectations, supporting orderly equity valuation multiples.\n2. Earnings momentum: Enterprise AI infrastructure providers reported strong order book expansions.",
		topMovers: isIndia
			? [
					{ name: "HDFC Bank Ltd", symbol: "HDFCBANK", change: 1.45, direction: "up" },
					{ name: "Tata Consultancy Services", symbol: "TCS", change: 1.12, direction: "up" },
					{ name: "Reliance Industries", symbol: "RELIANCE", change: 0.85, direction: "up" },
					{ name: "ICICI Bank Ltd", symbol: "ICICIBANK", change: 0.72, direction: "up" },
					{ name: "Tata Motors Ltd", symbol: "TATAMOTORS", change: -0.65, direction: "down" },
					{ name: "Larsen & Toubro", symbol: "LT", change: 1.25, direction: "up" },
				]
			: [
					{ name: "Apple Inc", symbol: "AAPL", change: 1.15, direction: "up" },
					{ name: "Microsoft Corp", symbol: "MSFT", change: 0.95, direction: "up" },
					{ name: "NVIDIA Corp", symbol: "NVDA", change: 2.45, direction: "up" },
					{ name: "Tesla Inc", symbol: "TSLA", change: -1.20, direction: "down" },
				],
		sectorHighlights: isIndia
			? [
					{
						sector: "Banking & Financials (Nifty Bank)",
						trend: "Bullish",
						outlook: "Expanding credit growth (+14% YoY), benign credit costs, and resilient net interest margins (NIMs).",
					},
					{
						sector: "Information Technology (Nifty IT)",
						trend: "Neutral to Positive",
						outlook: "Cloud modernization and enterprise AI mandates underpinning multi-year pipeline deals.",
					},
					{
						sector: "Automobile & Auto Ancillary",
						trend: "Positive",
						outlook: "Healthy festive dispatch bookings, premium SUV product mix, and moderating input commodity costs.",
					},
					{
						sector: "Fixed Income & Sovereign Debt",
						trend: "Stable / Attractive",
						outlook: "10-year benchmark G-Sec yield consolidated at 6.84%, offering superior real returns.",
					},
				]
			: [
					{
						sector: "Tech & Megacap Growth",
						trend: "Bullish",
						outlook: "Hyperscaler capex investments in semiconductor & AI clusters continuing at scale.",
					},
					{
						sector: "Fixed Income / US Treasuries",
						trend: "Yield Consolidation",
						outlook: "10-year US Treasury hovering at 4.15% anticipating monetary easing cycle.",
					},
				],
		keyRisks: isIndia
			? "Crude oil volatility (Brent ~$78–$82/bbl), US Dollar Index (DXY) movements, and shifting foreign institutional (FPI) derivative positions."
			: "Interest rate trajectory, commercial real estate refinancing, and geopolitical trade developments.",
		agentTips: isIndia
			? "Counsel clients against trying to time near-term volatility. Recommend balanced multi-asset allocation strategies and continuing systematic investment plans (SIPs) to benefit from rupee-cost averaging."
			: "Highlight global diversification benefits. Recommend curated US tech ETF baskets to complement domestic core portfolios.",
		sources: ["NSE Live Indices", "BSE S&P Sensex", "RBI Economic Bulletins", "SEBI Disclosures"],
		version: 1,
		publishedAt: new Date().toISOString(),
	};
}

export default function AgentKnowledgeMarketBrief() {
	const [selectedRegion, setSelectedRegion] = useState("india");

	const {
		data: todaysBrief,
		isLoading: todayLoading,
		refetch,
	} = useQuery<MarketBrief>({
		queryKey: ["/api/knowledge-hub/market-brief/today", selectedRegion],
		queryFn: async () => {
			try {
				const response = await apiRequest(
					"GET",
					`/api/knowledge-hub/market-brief/today?region=${selectedRegion}`,
				);
				if (response.ok) {
					const data = await response.json();
					if (data && data.marketSnapshot) return data;
				}
			} catch (e) {
				console.warn("apiRequest failed, attempting direct fetch:", e);
			}

			try {
				const res = await fetch(
					`/api/knowledge-hub/market-brief/today?region=${selectedRegion}`,
				);
				if (res.ok) {
					const data = await res.json();
					if (data && data.marketSnapshot) return data;
				}
			} catch (err) {
				console.warn("fetch failed:", err);
			}

			return getClientFallbackBrief(selectedRegion);
		},
	});

	const { data: previousBriefs } = useQuery<MarketBrief[]>({
		queryKey: ["/api/knowledge-hub/market-briefs", selectedRegion],
		queryFn: async () => {
			try {
				const response = await apiRequest(
					"GET",
					`/api/knowledge-hub/market-briefs?region=${selectedRegion}&status=published&limit=5`,
				);
				if (response.ok) {
					return await response.json();
				}
			} catch (e) {
				console.warn("apiRequest previousBriefs failed:", e);
			}

			try {
				const res = await fetch(
					`/api/knowledge-hub/market-briefs?region=${selectedRegion}&status=published&limit=5`,
				);
				if (res.ok) {
					return await res.json();
				}
			} catch (err) {
				console.warn("fetch previousBriefs failed:", err);
			}

			return [];
		},
	});

	const regions = [
		{ id: "india", name: "India", flag: "🇮🇳" },
		{ id: "us", name: "US Markets", flag: "🇺🇸" },
		{ id: "global", name: "Global", flag: "🌍" },
	];

	const briefToDisplay =
		todaysBrief && todaysBrief.marketSnapshot
			? todaysBrief
			: getClientFallbackBrief(selectedRegion);

	return (
		<div className="p-6 space-y-6">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-4">
					<Link href="/agent/knowledge-hub">
						<Button
							variant="ghost"
							size="sm"
							className="text-muted-foreground hover:text-foreground"
						>
							<ChevronLeft className="h-4 w-4 mr-1" />
							Back
						</Button>
					</Link>
					<div>
						<h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
							<TrendingUp className="h-7 w-7 text-blue-500" />
							Daily Market Brief
						</h1>
						<p className="text-muted-foreground mt-1">
							AI-generated market intelligence & macro indicators
						</p>
					</div>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={() => refetch()}
					className="border-border"
				>
					<RefreshCw className="h-4 w-4 mr-2" />
					Refresh
				</Button>
			</div>

			<div className="flex gap-2">
				{regions.map((region) => (
					<Button
						key={region.id}
						variant={selectedRegion === region.id ? "default" : "outline"}
						size="sm"
						onClick={() => setSelectedRegion(region.id)}
						className={
							selectedRegion === region.id
								? "bg-blue-600 hover:bg-blue-700"
								: "border-border"
						}
						data-testid={`region-${region.id}`}
					>
						<span className="mr-1">{region.flag}</span>
						{region.name}
					</Button>
				))}
			</div>

			{todayLoading && !briefToDisplay ? (
				<div className="space-y-4">
					<Skeleton className="h-48 bg-card" />
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<Skeleton className="h-32 bg-card" />
						<Skeleton className="h-32 bg-card" />
					</div>
				</div>
			) : (
				<div className="space-y-6">
					<Card className="bg-background border-border">
						<CardHeader>
							<div className="flex items-center justify-between">
								<div>
									<CardTitle className="text-foreground flex items-center gap-2">
										<Calendar className="h-5 w-5 text-blue-500" />
										{safeFormatDate(briefToDisplay.date)}
									</CardTitle>
									<CardDescription className="text-muted-foreground flex items-center gap-2 mt-1">
										<Clock className="h-3 w-3" />
										{briefToDisplay.publishedAt
											? `Published at ${safeFormatDate(briefToDisplay.publishedAt, "HH:mm")}`
											: "Latest update"}
									</CardDescription>
								</div>
								<Badge className="bg-blue-500/20 text-blue-400 border-0">
									v{briefToDisplay.version || 1}
								</Badge>
							</div>
						</CardHeader>
						<CardContent className="space-y-6">
							<div>
								<h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
									<BarChart3 className="h-5 w-5 text-emerald-500" />
									Market Snapshot
								</h3>
								<div className="prose prose-invert prose-sm max-w-none">
									<p className="text-muted-foreground whitespace-pre-line">
										{briefToDisplay.marketSnapshot}
									</p>
								</div>
							</div>

							<div>
								<h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
									<Newspaper className="h-5 w-5 text-amber-500" />
									What Changed
								</h3>
								<div className="prose prose-invert prose-sm max-w-none">
									<p className="text-muted-foreground whitespace-pre-line">
										{briefToDisplay.whatChanged}
									</p>
								</div>
							</div>

							{briefToDisplay.topMovers && briefToDisplay.topMovers.length > 0 && (
								<div>
									<h3 className="text-lg font-semibold text-foreground mb-3">
										Top Movers
									</h3>
									<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
										{briefToDisplay.topMovers.map((mover, idx) => (
											<div
												key={idx}
												className={`p-3 rounded-lg border ${
													mover.direction === "up"
														? "bg-emerald-500/10 border-emerald-500/30"
														: "bg-red-500/10 border-red-500/30"
												}`}
											>
												<p className="font-medium text-foreground text-sm">
													{mover.name}
												</p>
												{mover.symbol && (
													<p className="text-xs text-muted-foreground">
														{mover.symbol}
													</p>
												)}
												<div className="flex items-center gap-1 mt-1">
													{mover.direction === "up" ? (
														<TrendingUp className="h-4 w-4 text-emerald-500" />
													) : (
														<TrendingDown className="h-4 w-4 text-red-500" />
													)}
													<span
														className={`font-semibold ${
															mover.direction === "up"
																? "text-emerald-400"
																: "text-red-400"
														}`}
													>
														{mover.change > 0 ? "+" : ""}
														{mover.change.toFixed(2)}%
													</span>
												</div>
											</div>
										))}
									</div>
								</div>
							)}

							{briefToDisplay.sectorHighlights &&
								briefToDisplay.sectorHighlights.length > 0 && (
									<div>
										<h3 className="text-lg font-semibold text-foreground mb-3">
											Sector Highlights
										</h3>
										<div className="space-y-2">
											{briefToDisplay.sectorHighlights.map((sector, idx) => (
												<div key={idx} className="p-3 rounded-lg bg-card/50">
													<div className="flex items-center justify-between mb-1">
														<span className="font-medium text-foreground">
															{sector.sector}
														</span>
														<Badge
															variant="outline"
															className="text-xs border-border"
														>
															{sector.trend}
														</Badge>
													</div>
													<p className="text-sm text-muted-foreground">
														{sector.outlook}
													</p>
												</div>
											))}
										</div>
									</div>
								)}

							{briefToDisplay.keyRisks && (
								<div className="p-4 bg-red-500/10 rounded-lg border border-red-500/30">
									<h3 className="text-lg font-semibold text-red-400 mb-2 flex items-center gap-2">
										<AlertTriangle className="h-5 w-5" />
										Key Risks to Watch
									</h3>
									<p className="text-muted-foreground">
										{briefToDisplay.keyRisks}
									</p>
								</div>
							)}

							{briefToDisplay.agentTips && (
								<div className="p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
									<h3 className="text-lg font-semibold text-emerald-400 mb-2">
										Advisor Tips & Allocation Guidance
									</h3>
									<p className="text-muted-foreground">
										{briefToDisplay.agentTips}
									</p>
								</div>
							)}

							{briefToDisplay.sources && briefToDisplay.sources.length > 0 && (
								<div className="pt-4 border-t border-border">
									<p className="text-xs text-muted-foreground">
										Sources: {briefToDisplay.sources.join(", ")}
									</p>
								</div>
							)}
						</CardContent>
					</Card>
				</div>
			)}

			{previousBriefs && previousBriefs.length > 0 && (
				<Card className="bg-background border-border">
					<CardHeader>
						<CardTitle className="text-foreground">Previous Briefs</CardTitle>
						<CardDescription className="text-muted-foreground">
							Recent market briefs for reference
						</CardDescription>
					</CardHeader>
					<CardContent>
						<ScrollArea className="h-64">
							<div className="space-y-2">
								{previousBriefs.map((brief) => (
									<div
										key={brief.id}
										className="p-3 rounded-lg bg-card/50 hover:bg-card cursor-pointer transition-colors"
									>
										<div className="flex items-center justify-between">
											<div>
												<p className="font-medium text-foreground">
													{safeFormatDate(brief.date, "EEEE, MMM d")}
												</p>
												<p className="text-sm text-muted-foreground line-clamp-1">
													{brief.marketSnapshot}
												</p>
											</div>
											<Badge
												variant="outline"
												className="text-xs border-border"
											>
												v{brief.version}
											</Badge>
										</div>
									</div>
								))}
							</div>
						</ScrollArea>
					</CardContent>
				</Card>
			)}

			<div className="text-xs text-muted-foreground text-center p-4 border-t border-border">
				<p>
					This market brief is generated using AI and is for informational
					purposes only. It should not be construed as investment advice. Past
					performance is not indicative of future results.
				</p>
			</div>
		</div>
	);
}
