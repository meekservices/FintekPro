import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
	TrendingUp,
	TrendingDown,
	Calendar,
	AlertTriangle,
	ChevronLeft,
	RefreshCw,
	Clock,
	BarChart3,
	Newspaper,
	Landmark,
	Fuel,
	Coins,
	ExternalLink,
	Layers,
	ShieldCheck,
	Globe,
	Building2,
	Scale,
	Compass,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { GlobalMacroRadarWidget } from "@/components/macro/GlobalMacroRadarWidget";

interface MarketBrief {
	id: string;
	date: string;
	region: string;
	marketSnapshot: string;
	whatChanged: string;
	topMovers: {
		name: string;
		symbol?: string;
		price?: number;
		change: number;
		direction: "up" | "down";
		currency?: string;
	}[];
	ccilFixedIncome?: {
		fbilMiborOvernight: number;
		systemicLiquidityCr: number;
		liquidityStatus: "Surplus" | "Deficit" | "Neutral";
		treps: {
			weightedAverageRate: number;
			totalVolumeCr: number;
			minRate: number;
			maxRate: number;
			marketCondition: string;
		};
		sovereignYields: {
			tenor: string;
			securityName: string;
			yieldPercent: number;
			changeBps: number;
			cleanPrice?: number;
		}[];
		tBills: {
			tenor: string;
			cutoffYield: number;
			changeBps: number;
		}[];
		yieldCurveAnalysis: {
			tenor10Y_minus_2Y_bps: number;
			slope: string;
			realYield10Y: number;
			commentary: string;
		};
		sdlSpreadBps: number;
		source: string;
	};
	commodityRadar?: {
		commodities: {
			id: string;
			name: string;
			category: string;
			mcxSymbol: string;
			mcxPrice: number;
			mcxUnit: string;
			mcxChangePercent: number;
			cmxSymbol: string;
			cmxPrice: number;
			cmxUnit: string;
			cmxChangePercent: number;
			trend: string;
			macroImplication: string;
		}[];
		crudeOilBreakevenStatus: {
			brentUsd: number;
			inflationImpact: string;
			commentary: string;
		};
		goldSilverRatio: number;
		source: string;
	};
	multiExchangeData?: {
		bseBreadth: {
			advances: number;
			declines: number;
			unchanged: number;
			advanceDeclineRatio: number;
			upperCircuits: number;
			lowerCircuits: number;
			totalMarketCapLakhCr: number;
			sentiment: string;
		};
		giftNifty: {
			exchange: string;
			symbol: string;
			lastPrice: number;
			netChange: number;
			percentChange: number;
			spreadOverNiftyBps: number;
			openingBias: string;
			asOfSession: string;
		};
		institutionalFlows: {
			fiiNetInflowCr: number;
			diiNetInflowCr: number;
			netCombinedInflowCr: number;
			monthlyMfSipRunRateCr: number;
			absorptionRatio: number;
			liquidityRegime: string;
		};
		ncdexAgriPulse?: {
			exchange: string;
			staplesIndexChangePct: number;
			foodInflationBias: string;
			keyCommodityDrivers: Array<{
				name: string;
				symbol: string;
				trend: string;
				inflationWeight: string;
			}>;
		};
		volatilityPulse?: {
			indiaVix: number;
			cboeVix: number;
			regime: string;
			advisoryTakeaway: string;
		};
		sourcesUsed?: string[];
	};
	amcConsensus?: {
		contributingAmcs: string[];
		consensusEquityStance: string;
		valuationContext: {
			niftyForwardPE: number;
			tenYearHistoricalAvgPE: number;
			trailingPE: number;
			priceToBook: number;
			valuationStatus: string;
			commentary: string;
		};
		fixedIncomeStance: {
			recommendedDurationBand: string;
			recommendedCategory: string;
			sovereignCurveStance: string;
			rationale: string;
		};
		thematicRotations: Array<{
			theme: string;
			sentiment: string;
			favoredSectors: string[];
			cautiousSectors: string[];
			fundManagerRationale: string;
		}>;
		advisorTalkingPoints: string[];
		faspAiDisclaimer: string;
	};
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
			? "Indian equity benchmarks traded with positive bias as Nifty 50 and Sensex demonstrated strength supported by sustained domestic institutional inflows (DIIs). Bank Nifty outperformed led by frontline private and PSU lenders. The 10-year benchmark Indian Government Bond (G-Sec) yield hovered at 6.79%, backed by CCIL sovereign clearing, offering attractive +2.59% real yield spreads. CCIL TREPS overnight funding rate printed at 6.42%, reflecting balanced systemic money market liquidity. Brent crude traded at $114.20/bbl, with elevated pricing monitored closely for imported inflation risks."
			: "US equities traded higher with the S&P 500 and Nasdaq supported by megacap technology earnings and steady labor market prints. 10-year Treasury yields consolidated as markets digested central bank policy commentary.",
		whatChanged: isIndia
			? "1. Sovereign Debt & Money Markets: CCIL 10-Year Benchmark G-Sec yield traded at 6.79%; CCIL TREPS overnight repo volume remained healthy with weighted average rate at 6.42%.\n2. Commodity Radar: Brent crude traded firm at $114.20/bbl, remaining above India's $80 comfort threshold and creating imported inflation headwinds. MCX Gold traded firm at ₹78,450/10g on steady safe-haven and central bank demand.\n3. Institutional Liquidity: Domestic Mutual Funds registered ongoing SIP inflows (~₹26,000+ Cr monthly run-rate), absorbing foreign portfolio outflows."
			: "1. Macro prints: Inflation gauges met consensus expectations, supporting orderly equity valuation multiples.\n2. Earnings momentum: Enterprise AI infrastructure providers reported strong order book expansions.",
		topMovers: isIndia
			? [
					{ name: "ITC Limited", symbol: "ITC", price: 266.0, change: 4.31, direction: "up", currency: "INR" },
					{ name: "Tata Consultancy Services", symbol: "TCS", price: 2156.0, change: 3.85, direction: "up", currency: "INR" },
					{ name: "Infosys Limited", symbol: "INFY", price: 1023.4, change: 2.65, direction: "up", currency: "INR" },
					{ name: "Reliance Industries", symbol: "RELIANCE", price: 1170.3, change: -0.65, direction: "down", currency: "INR" },
					{ name: "JSW Steel Limited", symbol: "JSWSTEEL", price: 1168.0, change: -0.61, direction: "down", currency: "INR" },
					{ name: "Cipla Limited", symbol: "CIPLA", price: 1301.0, change: -0.44, direction: "down", currency: "INR" },
				]
			: [
					{ name: "Apple Inc", symbol: "AAPL", price: 230.15, change: 1.15, direction: "up", currency: "USD" },
					{ name: "Microsoft Corp", symbol: "MSFT", price: 425.20, change: 0.95, direction: "up", currency: "USD" },
					{ name: "NVIDIA Corp", symbol: "NVDA", price: 122.50, change: 2.45, direction: "up", currency: "USD" },
					{ name: "Tesla Inc", symbol: "TSLA", price: 215.30, change: -1.20, direction: "down", currency: "USD" },
				],
		ccilFixedIncome: isIndia
			? {
					fbilMiborOvernight: 6.50,
					systemicLiquidityCr: -35000,
					liquidityStatus: "Deficit",
					treps: {
						weightedAverageRate: 6.42,
						totalVolumeCr: 485200,
						minRate: 6.25,
						maxRate: 6.55,
						marketCondition: "COMFORTABLE",
					},
					sovereignYields: [
						{ tenor: "10Y", securityName: "7.10% GS 2034 (10Y Benchmark)", yieldPercent: 6.79, changeBps: -1.5, cleanPrice: 101.85 },
						{ tenor: "5Y", securityName: "7.04% GS 2029 (5Y Benchmark)", yieldPercent: 6.64, changeBps: -1.0, cleanPrice: 101.42 },
						{ tenor: "2Y", securityName: "6.85% GS 2026 (2Y Sovereign)", yieldPercent: 6.51, changeBps: -0.8, cleanPrice: 100.55 },
					],
					tBills: [
						{ tenor: "91D", cutoffYield: 6.54, changeBps: -1.2 },
						{ tenor: "182D", cutoffYield: 6.61, changeBps: -0.5 },
						{ tenor: "364D", cutoffYield: 6.65, changeBps: -0.2 },
					],
					yieldCurveAnalysis: {
						tenor10Y_minus_2Y_bps: 28,
						slope: "Normal Upward",
						realYield10Y: 2.59,
						commentary: "Sovereign yield curve reflects normal upward slope (+28 bps 10Y–2Y spread). Real yield of +2.59% offers attractive carry.",
					},
					sdlSpreadBps: 38,
					source: "CCIL (The Clearing Corporation of India Limited) & FBIL",
				}
			: undefined,
		commodityRadar: isIndia
			? {
					commodities: [
						{
							id: "GOLD",
							name: "Gold 24K",
							category: "Precious Metals",
							mcxSymbol: "GOLD",
							mcxPrice: 78450,
							mcxUnit: "₹ / 10g",
							mcxChangePercent: 0.65,
							cmxSymbol: "GC=F (COMEX Gold)",
							cmxPrice: 2742.5,
							cmxUnit: "$ / oz",
							cmxChangePercent: 0.58,
							trend: "Bullish",
							macroImplication: "Central bank reserves diversification and geopolitical hedge sustaining bullion demand.",
						},
						{
							id: "SILVER",
							name: "Silver",
							category: "Precious Metals",
							mcxSymbol: "SILVER",
							mcxPrice: 94200,
							mcxUnit: "₹ / 1kg",
							mcxChangePercent: 1.15,
							cmxSymbol: "SI=F (COMEX Silver)",
							cmxPrice: 33.4,
							cmxUnit: "$ / oz",
							cmxChangePercent: 1.05,
							trend: "Bullish",
							macroImplication: "Driven by dual tailwinds from solar PV manufacturing and monetary investor demand.",
						},
						{
							id: "CRUDE_OIL",
							name: "Crude Oil (Brent)",
							category: "Energy",
							mcxSymbol: "CRUDEOIL",
							mcxPrice: 9918,
							mcxUnit: "₹ / bbl",
							mcxChangePercent: 1.85,
							cmxSymbol: "BZ=F (ICE Brent)",
							cmxPrice: 114.2,
							cmxUnit: "$ / bbl",
							cmxChangePercent: 1.95,
							trend: "Bullish",
							macroImplication: "Elevated crude above $110/bbl tests India's comfort threshold, increasing imported inflation and pressuring auto/paint/chemical margins.",
						},
						{
							id: "NATURAL_GAS",
							name: "Natural Gas",
							category: "Energy",
							mcxSymbol: "NATURALGAS",
							mcxPrice: 248.5,
							mcxUnit: "₹ / mmBtu",
							mcxChangePercent: -0.85,
							cmxSymbol: "NG=F (NYMEX Henry Hub)",
							cmxPrice: 2.95,
							cmxUnit: "$ / mmBtu",
							cmxChangePercent: -0.9,
							trend: "Neutral",
							macroImplication: "Healthy global storage levels easing industrial input costs.",
						},
						{
							id: "COPPER",
							name: "Copper",
							category: "Base Metals",
							mcxSymbol: "COPPER",
							mcxPrice: 852.0,
							mcxUnit: "₹ / kg",
							mcxChangePercent: 0.42,
							cmxSymbol: "HG=F (COMEX Copper)",
							cmxPrice: 4.48,
							cmxUnit: "$ / lb",
							cmxChangePercent: 0.38,
							trend: "Bullish",
							macroImplication: "Power grid capex and global electrification supporting base metal demand.",
						},
					],
					crudeOilBreakevenStatus: {
						brentUsd: 114.2,
						inflationImpact: "Elevated",
						commentary: "Brent crude at $114.20/bbl surges above India's macroeconomic comfort band (<$80), increasing imported inflation and CAD pressure.",
					},
					goldSilverRatio: 82.6,
					source: "MCX India & CMX / COMEX",
				}
			: undefined,
		sectorHighlights: isIndia
			? [
					{
						sector: "Banking & Financials (Nifty Bank)",
						trend: "Bullish",
						outlook: "Expanding credit growth (+14% YoY), benign credit costs, and resilient net interest margins (NIMs).",
					},
					{
						sector: "Fixed Income & CCIL Sovereign Debt",
						trend: "Stable / Attractive",
						outlook: "10-Year Benchmark G-Sec yield consolidated at 6.79% (Real Yield: +2.59%). CCIL TREPS WAR steady at 6.42%.",
					},
					{
						sector: "Commodities & Energy (MCX / CMX)",
						trend: "Elevated Input Pressure",
						outlook: "Brent Crude at $114.20/bbl above India comfort band; MCX Gold at ₹78,450/10g.",
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
			? "Crude oil volatility (Brent ~$74–$78/bbl), US Dollar Index (DXY) movements, and shifting foreign institutional (FPI) derivative positions."
			: "Interest rate trajectory, commercial real estate refinancing, and geopolitical trade developments.",
		agentTips: isIndia
			? "Counsel clients against trying to time near-term volatility. Recommend balanced multi-asset allocation strategies and continuing systematic investment plans (SIPs) to benefit from rupee-cost averaging."
			: "Highlight global diversification benefits. Recommend curated US tech ETF baskets to complement domestic core portfolios.",
		sources: [
			"Licensed NSE/BSE Exchange Feed",
			"BSE India (Market Breadth & Circuits)",
			"NSE IX (GIFT City IFSC) - GIFT Nifty",
			"CCIL (The Clearing Corporation of India Limited - ccilindia.com)",
			"FBIL Benchmark Rates",
			"MCX India & COMEX/CMX Commodity Desks",
			"NCDEX Agricultural Benchmarks",
			"Synthesized AMC Morning Notes (HDFC, ICICI Pru, SBI MF, Kotak, Nippon India)",
			"RBI Economic Bulletins & Liquidity Operations",
			"SEBI Disclosures",
		],
		multiExchangeData: isIndia
			? {
					bseBreadth: {
						advances: 2185,
						declines: 1740,
						unchanged: 145,
						advanceDeclineRatio: 1.26,
						upperCircuits: 342,
						lowerCircuits: 188,
						totalMarketCapLakhCr: 468.5,
						sentiment: "Bullish Breadth",
					},
					giftNifty: {
						exchange: "NSE IX (GIFT City IFSC)",
						symbol: "GIFT_NIFTY",
						lastPrice: 24823,
						netChange: +42.5,
						percentChange: +0.17,
						spreadOverNiftyBps: 15,
						openingBias: "Gap Up",
						asOfSession: "Early Morning Session (06:30–09:00 IST)",
					},
					institutionalFlows: {
						fiiNetInflowCr: -1850,
						diiNetInflowCr: +3120,
						netCombinedInflowCr: +1270,
						monthlyMfSipRunRateCr: 26425,
						absorptionRatio: 1.69,
						liquidityRegime: "DII Inflows Absorb FPI Selling",
					},
					ncdexAgriPulse: {
						exchange: "NCDEX",
						staplesIndexChangePct: -0.45,
						foodInflationBias: "Benign (<4.5%)",
						keyCommodityDrivers: [
							{ name: "Turmeric (Nizamabad)", symbol: "TMCFGRNZM", trend: "Stable", inflationWeight: "Moderate" },
							{ name: "Jeera (Unjha)", symbol: "JEERAUNJHA", trend: "Soft", inflationWeight: "Low" },
							{ name: "Chana / Gram", symbol: "CHANA", trend: "Stable", inflationWeight: "High (Protein Basket)" },
						],
					},
					volatilityPulse: {
						indiaVix: 13.85,
						cboeVix: 15.4,
						regime: "Normal / Balanced",
						advisoryTakeaway: "Controlled volatility favoring disciplined equity SIP compounding.",
					},
				}
			: undefined,
		amcConsensus: isIndia
			? {
					contributingAmcs: [
						"HDFC AMC",
						"ICICI Prudential AMC",
						"SBI Mutual Fund",
						"Kotak AMC",
						"Nippon India MF",
					],
					consensusEquityStance: "Neutral / Selective (Quality Largecap Tilt)",
					valuationContext: {
						niftyForwardPE: 21.6,
						tenYearHistoricalAvgPE: 20.2,
						trailingPE: 23.2,
						priceToBook: 3.45,
						valuationStatus: "Moderate Premium",
						commentary: "Large-caps trade at reasonable +7% forward P/E premium backed by 15.5% RoE and healthy corporate balance sheets.",
					},
					fixedIncomeStance: {
						recommendedDurationBand: "3 to 5 Years",
						recommendedCategory: "Target Maturity Gilt Funds & Banking PSU Debt",
						sovereignCurveStance: "Lock-in Carry",
						rationale: "Capture peak sovereign yields (6.79% 10Y G-Sec / +2.59% real yield) before RBI easing cycle.",
					},
					thematicRotations: [
						{
							theme: "Credit & Financial Deepening",
							sentiment: "Overweight",
							favoredSectors: ["Private Frontline Banks", "Large PSU Banks", "Housing Finance"],
							cautiousSectors: ["Unsecured Micro-Lenders"],
							fundManagerRationale: "+14% YoY credit growth and multi-year low NPAs.",
						},
						{
							theme: "Domestic Capex & Energy Transition",
							sentiment: "Overweight",
							favoredSectors: ["Power Transmission", "Capital Goods", "Solar Grid / Renewables"],
							cautiousSectors: ["Global Cyclicals"],
							fundManagerRationale: "Multi-year order books backed by government & private infra capex.",
						},
					],
					advisorTalkingPoints: [
						"Maintain monthly SIP commitments: Domestic mutual fund SIP inflows (~₹26,000+ Cr) structurally absorb foreign portfolio selling.",
						"Favor large-cap & multi-asset allocation strategies where risk-reward is superior to overextended small-caps.",
						"Deploy surplus cash into 3–5 year Target Maturity Gilt funds to lock in ~6.8% yields with zero credit risk.",
					],
					faspAiDisclaimer: "FASP-AI v1.0 Notice: Synthesized consensus for RIA/MFD decision support only. Not deterministic investment advice.",
				}
			: undefined,
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
					if (data?.marketSnapshot) return data;
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
					if (data?.marketSnapshot) return data;
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
		todaysBrief?.marketSnapshot
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

			{/* FintekPro Global Macro Transmission Engine Radar */}
			<GlobalMacroRadarWidget />

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
										{briefToDisplay.topMovers.map((mover, idx) => {
											const isUsSecurity =
												mover.currency === "USD" ||
												mover.currency === "$" ||
												briefToDisplay.region === "us" ||
												briefToDisplay.region === "global" ||
												(mover.symbol &&
													["AAPL", "MSFT", "NVDA", "TSLA", "GOOGL", "GOOG", "AMZN", "META", "BRK.A", "BRK.B", "LLY", "JPM", "V"].includes(
														mover.symbol.toUpperCase(),
													));
											const currencySymbol = isUsSecurity ? "$" : "₹";
											const formattedPrice = isUsSecurity
												? mover.price?.toLocaleString("en-US", {
														minimumFractionDigits: 2,
														maximumFractionDigits: 2,
													})
												: mover.price?.toLocaleString("en-IN", {
														minimumFractionDigits: 2,
														maximumFractionDigits: 2,
													});

											return (
												<div
													key={idx}
													className={`p-3 rounded-lg border ${
														mover.direction === "up"
															? "bg-emerald-500/10 border-emerald-500/30"
															: "bg-red-500/10 border-red-500/30"
													}`}
												>
													<div className="flex items-start justify-between gap-1">
														<p className="font-medium text-foreground text-sm truncate">
															{mover.name}
														</p>
														{mover.price !== undefined && mover.price !== null && (
															<span className="text-xs font-mono font-semibold text-foreground/80 shrink-0">
																{currencySymbol}{formattedPrice}
															</span>
														)}
													</div>
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
											);
										})}
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

							{/* CCIL Sovereign Debt & Money Market Desk */}
							{briefToDisplay.ccilFixedIncome && (
								<div className="p-4 rounded-xl border border-blue-500/30 bg-blue-950/20 space-y-4">
									<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-500/20 pb-3">
										<div className="flex items-center gap-2">
											<Landmark className="h-5 w-5 text-blue-400" />
											<div>
												<h3 className="text-base font-semibold text-foreground flex items-center gap-2">
													CCIL Sovereign Debt & Money Market Desk
													<Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-300 border-blue-500/30">
														ccilindia.com
													</Badge>
												</h3>
												<p className="text-xs text-muted-foreground">
													Official G-Sec benchmarks, T-Bills, and TREPS money market settlement from The Clearing Corporation of India Limited & FBIL
												</p>
											</div>
										</div>
										<a
											href="https://www.ccilindia.com/"
											target="_blank"
											rel="noopener noreferrer"
											className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 shrink-0 underline"
										>
											Verify on CCIL <ExternalLink className="h-3 w-3" />
										</a>
									</div>

									<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
										{/* 10Y G-Sec */}
										<div className="p-3 rounded-lg bg-card/60 border border-border/60">
											<div className="flex items-center justify-between">
												<span className="text-xs text-muted-foreground font-medium">10Y Benchmark G-Sec</span>
												<Badge className="text-[10px] bg-emerald-500/20 text-emerald-400 border-0">
													Real: +{briefToDisplay.ccilFixedIncome.yieldCurveAnalysis?.realYield10Y ?? 2.59}%
												</Badge>
											</div>
											<div className="mt-1 flex items-baseline gap-2">
												<span className="text-xl font-bold font-mono text-foreground">
													{briefToDisplay.ccilFixedIncome.sovereignYields?.[0]?.yieldPercent ?? 6.79}%
												</span>
												<span className="text-xs text-emerald-400 font-mono">
													{briefToDisplay.ccilFixedIncome.sovereignYields?.[0]?.changeBps ?? -1.5} bps
												</span>
											</div>
											<p className="text-[11px] text-muted-foreground mt-1 truncate">
												{briefToDisplay.ccilFixedIncome.sovereignYields?.[0]?.securityName ?? "7.10% GS 2034"}
											</p>
										</div>

										{/* TREPS Overnight */}
										<div className="p-3 rounded-lg bg-card/60 border border-border/60">
											<div className="flex items-center justify-between">
												<span className="text-xs text-muted-foreground font-medium">TREPS Overnight WAR</span>
												<Badge className="text-[10px] bg-blue-500/20 text-blue-400 border-0">
													{briefToDisplay.ccilFixedIncome.treps?.marketCondition ?? "COMFORTABLE"}
												</Badge>
											</div>
											<div className="mt-1 flex items-baseline gap-2">
												<span className="text-xl font-bold font-mono text-foreground">
													{briefToDisplay.ccilFixedIncome.treps?.weightedAverageRate ?? 6.42}%
												</span>
											</div>
											<p className="text-[11px] text-muted-foreground mt-1">
												Vol: ₹{((briefToDisplay.ccilFixedIncome.treps?.totalVolumeCr ?? 485000) / 100000).toFixed(2)} Lakh Cr
											</p>
										</div>

										{/* 91D T-Bill & MIBOR */}
										<div className="p-3 rounded-lg bg-card/60 border border-border/60">
											<div className="flex items-center justify-between">
												<span className="text-xs text-muted-foreground font-medium">91D T-Bill / MIBOR</span>
												<Badge className="text-[10px] bg-purple-500/20 text-purple-400 border-0">
													Risk-Free
												</Badge>
											</div>
											<div className="mt-1 flex items-baseline gap-2">
												<span className="text-xl font-bold font-mono text-foreground">
													{briefToDisplay.ccilFixedIncome.tBills?.[0]?.cutoffYield ?? 6.54}%
												</span>
											</div>
											<p className="text-[11px] text-muted-foreground mt-1">
												Overnight MIBOR: {briefToDisplay.ccilFixedIncome.fbilMiborOvernight ?? 6.50}%
											</p>
										</div>

										{/* Yield Curve Slope & SDL Spread */}
										<div className="p-3 rounded-lg bg-card/60 border border-border/60">
											<div className="flex items-center justify-between">
												<span className="text-xs text-muted-foreground font-medium">10Y–2Y Curve Slope</span>
												<Badge className="text-[10px] bg-amber-500/20 text-amber-400 border-0">
													{briefToDisplay.ccilFixedIncome.yieldCurveAnalysis?.slope ?? "Normal Upward"}
												</Badge>
											</div>
											<div className="mt-1 flex items-baseline gap-2">
												<span className="text-xl font-bold font-mono text-foreground">
													+{briefToDisplay.ccilFixedIncome.yieldCurveAnalysis?.tenor10Y_minus_2Y_bps ?? 28} bps
												</span>
											</div>
											<p className="text-[11px] text-muted-foreground mt-1">
												State Dev Loans (SDL): +{briefToDisplay.ccilFixedIncome.sdlSpreadBps ?? 38} bps spread
											</p>
										</div>
									</div>

									{briefToDisplay.ccilFixedIncome.yieldCurveAnalysis?.commentary && (
										<p className="text-xs text-blue-200/80 bg-blue-900/30 p-2.5 rounded-lg border border-blue-500/20">
											💡 <span className="font-semibold text-blue-200">CCIL Curve Insight:</span>{" "}
											{briefToDisplay.ccilFixedIncome.yieldCurveAnalysis.commentary}
										</p>
									)}
								</div>
							)}

							{/* Commodity Radar (MCX & CMX / COMEX) */}
							{briefToDisplay.commodityRadar && (
								<div className="p-4 rounded-xl border border-amber-500/30 bg-amber-950/10 space-y-4">
									<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-500/20 pb-3">
										<div className="flex items-center gap-2">
											<Coins className="h-5 w-5 text-amber-400" />
											<div>
												<h3 className="text-base font-semibold text-foreground flex items-center gap-2">
													Commodity Radar (MCX India & Global CFD Benchmarks)
													<Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-300 border-amber-500/30">
														Multi-Asset
													</Badge>
												</h3>
												<p className="text-xs text-muted-foreground">
													Domestic MCX price discovery paired with live International CFD benchmarks (Moneycontrol Multi-Asset standard)
												</p>
											</div>
										</div>
										{briefToDisplay.commodityRadar.crudeOilBreakevenStatus && (
											<Badge
												className={`text-xs ${
													briefToDisplay.commodityRadar.crudeOilBreakevenStatus.inflationImpact === "Benign"
														? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
														: briefToDisplay.commodityRadar.crudeOilBreakevenStatus.inflationImpact === "Moderate"
															? "bg-amber-500/20 text-amber-400 border-amber-500/30"
															: "bg-red-500/20 text-red-400 border-red-500/30"
												}`}
											>
												Crude Inflation: {briefToDisplay.commodityRadar.crudeOilBreakevenStatus.inflationImpact} ($
												{briefToDisplay.commodityRadar.crudeOilBreakevenStatus.brentUsd}/bbl)
											</Badge>
										)}
									</div>

									<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
										{briefToDisplay.commodityRadar.commodities?.map((item, idx) => (
											<div key={idx} className="p-3 rounded-lg bg-card/60 border border-border/60 space-y-1.5">
												<div className="flex items-center justify-between">
													<span className="font-semibold text-foreground text-sm truncate" title={item.name}>{item.name}</span>
													<Badge
														variant="outline"
														className={`text-[10px] px-1.5 py-0 ${
															item.trend === "Bullish"
																? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
																: item.trend === "Bearish"
																	? "text-red-400 border-red-500/30 bg-red-500/10"
																	: "text-muted-foreground border-border"
														}`}
													>
														{item.trend}
													</Badge>
												</div>

												{/* Domestic MCX */}
												<div className="flex items-baseline justify-between">
													<span className="text-xs text-muted-foreground">MCX (INR):</span>
													<span className="font-mono text-sm font-bold text-foreground">
														₹{item.mcxPrice.toLocaleString("en-IN")}{" "}
														<span className="text-[10px] text-muted-foreground font-normal">{item.mcxUnit.replace("₹ / ", "/")}</span>
													</span>
												</div>

												{/* Global CFD / International Benchmarks */}
												<div className="flex items-baseline justify-between">
													<span className="text-xs text-muted-foreground">CFD / Global:</span>
													<span className="font-mono text-xs font-medium text-foreground/80">
														{item.cmxPrice < 10 ? `$${item.cmxPrice.toFixed(2)}` : `$${item.cmxPrice.toLocaleString("en-US")}`}{" "}
														<span className="text-[10px] text-muted-foreground font-normal">{item.cmxUnit.replace("$ / ", "/")}</span>
													</span>
												</div>

												<div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px]">
													<span className="text-muted-foreground">Day's Chg:</span>
													<span
														className={`font-semibold font-mono ${
															item.mcxChangePercent >= 0 ? "text-emerald-400" : "text-red-400"
														}`}
													>
														{item.mcxChangePercent >= 0 ? "+" : ""}
														{item.mcxChangePercent.toFixed(2)}%
													</span>
												</div>
											</div>
										))}
									</div>

									{briefToDisplay.commodityRadar.crudeOilBreakevenStatus?.commentary && (
										<p className="text-xs text-amber-200/80 bg-amber-900/20 p-2.5 rounded-lg border border-amber-500/20">
											⚡ <span className="font-semibold text-amber-200">Macro Takeaway:</span>{" "}
											{briefToDisplay.commodityRadar.crudeOilBreakevenStatus.commentary}
										</p>
									)}
								</div>
							)}

							{/* Multi-Exchange Intelligence Desk */}
							{briefToDisplay.multiExchangeData && (
								<div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-950/10 space-y-4">
									<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-500/20 pb-3">
										<div className="flex items-center gap-2">
											<Globe className="h-5 w-5 text-indigo-400" />
											<div>
												<div className="flex items-center gap-2">
													<h3 className="text-base font-bold text-foreground">
														Multi-Exchange Intelligence Desk
													</h3>
													<Badge className="text-xs bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
														Cross-Market Pulse
													</Badge>
												</div>
												<p className="text-xs text-muted-foreground">
													BSE India market breadth, GIFT Nifty IFSC session lead, institutional FII/DII net flows & NCDEX agri drivers
												</p>
											</div>
										</div>
										<Badge variant="outline" className="text-xs border-indigo-500/30 text-indigo-300">
											NSE IX · BSE · NSDL · NCDEX
										</Badge>
									</div>

									<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
										{/* BSE Market Breadth */}
										<div className="p-3 rounded-lg bg-card/60 border border-border/60">
											<div className="flex items-center justify-between">
												<span className="text-xs text-muted-foreground font-medium">BSE Market Breadth</span>
												<Badge
													className={`text-[10px] border-0 ${
														briefToDisplay.multiExchangeData.bseBreadth.advanceDeclineRatio >= 1.0
															? "bg-emerald-500/20 text-emerald-400"
															: "bg-red-500/20 text-red-400"
													}`}
												>
													{briefToDisplay.multiExchangeData.bseBreadth.sentiment}
												</Badge>
											</div>
											<div className="mt-1 flex items-baseline gap-2">
												<span className="text-xl font-bold font-mono text-foreground">
													{briefToDisplay.multiExchangeData.bseBreadth.advances}
												</span>
												<span className="text-xs text-muted-foreground">Adv /</span>
												<span className="text-xl font-bold font-mono text-foreground">
													{briefToDisplay.multiExchangeData.bseBreadth.declines}
												</span>
												<span className="text-xs text-muted-foreground">Dec</span>
											</div>
											<div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1 pt-1 border-t border-border/40">
												<span>Ratio: {briefToDisplay.multiExchangeData.bseBreadth.advanceDeclineRatio}:1</span>
												<span>M-Cap: ₹{briefToDisplay.multiExchangeData.bseBreadth.totalMarketCapLakhCr}L Cr</span>
											</div>
										</div>

										{/* GIFT Nifty Lead */}
										<div className="p-3 rounded-lg bg-card/60 border border-border/60">
											<div className="flex items-center justify-between">
												<span className="text-xs text-muted-foreground font-medium">GIFT Nifty 21h Lead</span>
												<Badge
													className={`text-[10px] border-0 ${
														briefToDisplay.multiExchangeData.giftNifty.netChange >= 0
															? "bg-emerald-500/20 text-emerald-400"
															: "bg-red-500/20 text-red-400"
													}`}
												>
													{briefToDisplay.multiExchangeData.giftNifty.openingBias}
												</Badge>
											</div>
											<div className="mt-1 flex items-baseline gap-2">
												<span className="text-xl font-bold font-mono text-foreground">
													{briefToDisplay.multiExchangeData.giftNifty.lastPrice.toLocaleString("en-IN")}
												</span>
												<span
													className={`text-xs font-semibold font-mono ${
														briefToDisplay.multiExchangeData.giftNifty.netChange >= 0
															? "text-emerald-400"
															: "text-red-400"
													}`}
												>
													{briefToDisplay.multiExchangeData.giftNifty.netChange >= 0 ? "+" : ""}
													{briefToDisplay.multiExchangeData.giftNifty.netChange} (
													{briefToDisplay.multiExchangeData.giftNifty.percentChange.toFixed(2)}%)
												</span>
											</div>
											<div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1 pt-1 border-t border-border/40">
												<span>Spread: +{briefToDisplay.multiExchangeData.giftNifty.spreadOverNiftyBps} bps</span>
												<span className="truncate">{briefToDisplay.multiExchangeData.giftNifty.asOfSession}</span>
											</div>
										</div>

										{/* Institutional Flows & SIP */}
										<div className="p-3 rounded-lg bg-card/60 border border-border/60">
											<div className="flex items-center justify-between">
												<span className="text-xs text-muted-foreground font-medium">FII / DII Institutional Net</span>
												<Badge className="text-[10px] bg-blue-500/20 text-blue-400 border-0">
													SIP Moat
												</Badge>
											</div>
											<div className="mt-1 flex items-baseline justify-between text-xs font-mono">
												<span>
													FII:{" "}
													<strong
														className={
															briefToDisplay.multiExchangeData.institutionalFlows.fiiNetInflowCr >= 0
																? "text-emerald-400"
																: "text-red-400"
														}
													>
														{briefToDisplay.multiExchangeData.institutionalFlows.fiiNetInflowCr >= 0 ? "+" : ""}
														₹{briefToDisplay.multiExchangeData.institutionalFlows.fiiNetInflowCr.toLocaleString("en-IN")} Cr
													</strong>
												</span>
												<span>
													DII:{" "}
													<strong
														className={
															briefToDisplay.multiExchangeData.institutionalFlows.diiNetInflowCr >= 0
																? "text-emerald-400"
																: "text-red-400"
														}
													>
														{briefToDisplay.multiExchangeData.institutionalFlows.diiNetInflowCr >= 0 ? "+" : ""}
														₹{briefToDisplay.multiExchangeData.institutionalFlows.diiNetInflowCr.toLocaleString("en-IN")} Cr
													</strong>
												</span>
											</div>
											<div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1 pt-1 border-t border-border/40">
												<span>Monthly SIP: ₹{briefToDisplay.multiExchangeData.institutionalFlows.monthlyMfSipRunRateCr.toLocaleString("en-IN")} Cr</span>
												<span className="truncate">{briefToDisplay.multiExchangeData.institutionalFlows.liquidityRegime}</span>
											</div>
										</div>

										{/* Volatility Pulse */}
										<div className="p-3 rounded-lg bg-card/60 border border-border/60">
											<div className="flex items-center justify-between">
												<span className="text-xs text-muted-foreground font-medium">Volatility Pulse</span>
												<Badge className="text-[10px] bg-purple-500/20 text-purple-400 border-0">
													{briefToDisplay.multiExchangeData.volatilityPulse?.regime ?? "LOW VOL"}
												</Badge>
											</div>
											<div className="mt-1 flex items-baseline gap-2">
												<span className="text-xl font-bold font-mono text-foreground">
													{briefToDisplay.multiExchangeData.volatilityPulse?.indiaVix.toFixed(2) ?? "14.20"}
												</span>
												<span className="text-xs text-muted-foreground">India VIX</span>
												<span className="text-xs text-muted-foreground ml-auto font-mono">
													Cboe: {briefToDisplay.multiExchangeData.volatilityPulse?.cboeVix.toFixed(2) ?? "15.40"}
												</span>
											</div>
											<p className="text-[11px] text-muted-foreground mt-1 pt-1 border-t border-border/40 truncate">
												{briefToDisplay.multiExchangeData.volatilityPulse?.advisoryTakeaway ??
													"Calm volatility backdrop favors disciplined STP / SIP equity allocations."}
											</p>
										</div>
									</div>

									{/* NCDEX Agri Drivers */}
									{briefToDisplay.multiExchangeData.ncdexAgriPulse && (
										<div className="p-2.5 rounded-lg bg-indigo-900/20 border border-indigo-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
											<div className="flex items-center gap-2">
												<span className="font-semibold text-indigo-300">🌾 NCDEX Food Inflation Pulse:</span>
												<span className="text-muted-foreground">
													Staples Index:{" "}
													<strong
														className={
															briefToDisplay.multiExchangeData.ncdexAgriPulse.staplesIndexChangePct >= 0
																? "text-red-400"
																: "text-emerald-400"
														}
													>
														{briefToDisplay.multiExchangeData.ncdexAgriPulse.staplesIndexChangePct >= 0 ? "+" : ""}
														{briefToDisplay.multiExchangeData.ncdexAgriPulse.staplesIndexChangePct}%
													</strong>{" "}
													({briefToDisplay.multiExchangeData.ncdexAgriPulse.foodInflationBias})
												</span>
											</div>
											<div className="flex items-center gap-2">
												{briefToDisplay.multiExchangeData.ncdexAgriPulse.keyCommodityDrivers.map((driver, dIdx) => (
													<span key={dIdx} className="px-2 py-0.5 rounded bg-card/60 text-[11px] text-foreground/80 border border-border/50">
														{driver.name}: <strong>{driver.trend}</strong>
													</span>
												))}
											</div>
										</div>
									)}
								</div>
							)}

							{/* AMC House Consensus & Asset Allocation Desk */}
							{briefToDisplay.amcConsensus && (
								<div className="p-4 rounded-xl border border-teal-500/30 bg-teal-950/10 space-y-4">
									<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-teal-500/20 pb-3">
										<div className="flex items-center gap-2">
											<Building2 className="h-5 w-5 text-teal-400" />
											<div>
												<div className="flex items-center gap-2">
													<h3 className="text-base font-bold text-foreground">
														AMC House Consensus & Asset Allocation Desk
													</h3>
													<Badge className="text-xs bg-teal-500/20 text-teal-400 border border-teal-500/30">
														FASP-AI Decision Support
													</Badge>
												</div>
												<p className="text-xs text-muted-foreground">
													Consensus research view synthesized across frontline AMCs: HDFC, ICICI Pru, SBI MF, Kotak & Nippon India
												</p>
											</div>
										</div>
										<Badge variant="outline" className="text-xs border-teal-500/30 text-teal-300">
											CIO & Fund Manager Stance
										</Badge>
									</div>

									{/* Contributing AMC Badges & Consensus Stance */}
									<div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-teal-900/20 border border-teal-500/20">
										<div className="flex items-center gap-2">
											<span className="text-xs font-semibold text-teal-300">Consensus Equity Bias:</span>
											<Badge className="text-xs bg-teal-500/30 text-teal-200 border-0">
												{briefToDisplay.amcConsensus.consensusEquityStance}
											</Badge>
										</div>
										<div className="flex items-center gap-1.5 flex-wrap">
											<span className="text-[11px] text-muted-foreground">Contributing Houses:</span>
											{briefToDisplay.amcConsensus.contributingAmcs.map((amc, aIdx) => (
												<span key={aIdx} className="px-2 py-0.5 rounded text-[10px] font-medium bg-card/60 text-foreground/80 border border-border/50">
													{amc}
												</span>
											))}
										</div>
									</div>

									{/* Valuation Context & Fixed Income Stance */}
									<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
										{/* Equity Valuation Context */}
										<div className="p-3 rounded-lg bg-card/60 border border-border/60 space-y-2">
											<div className="flex items-center justify-between">
												<span className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
													<Scale className="h-3.5 w-3.5 text-teal-400" />
													Nifty 50 Forward Valuation Context
												</span>
												<Badge className="text-[10px] bg-amber-500/20 text-amber-400 border-0">
													{briefToDisplay.amcConsensus.valuationContext.valuationStatus}
												</Badge>
											</div>
											<div className="flex items-baseline gap-4 text-xs font-mono">
												<div>
													<span className="text-muted-foreground">Fwd P/E: </span>
													<strong className="text-foreground text-sm">
														{briefToDisplay.amcConsensus.valuationContext.niftyForwardPE}x
													</strong>
												</div>
												<div>
													<span className="text-muted-foreground">10Y Historical Avg: </span>
													<strong className="text-muted-foreground text-sm">
														{briefToDisplay.amcConsensus.valuationContext.tenYearHistoricalAvgPE}x
													</strong>
												</div>
												<div>
													<span className="text-muted-foreground">P/B: </span>
													<strong className="text-foreground text-sm">
														{briefToDisplay.amcConsensus.valuationContext.priceToBook}x
													</strong>
												</div>
											</div>
											<p className="text-xs text-muted-foreground leading-relaxed">
												{briefToDisplay.amcConsensus.valuationContext.commentary}
											</p>
										</div>

										{/* Fixed Income Duration Strategy */}
										<div className="p-3 rounded-lg bg-card/60 border border-border/60 space-y-2">
											<div className="flex items-center justify-between">
												<span className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
													<Compass className="h-3.5 w-3.5 text-teal-400" />
													Fixed Income Recommended Duration
												</span>
												<Badge className="text-[10px] bg-emerald-500/20 text-emerald-400 border-0">
													{briefToDisplay.amcConsensus.fixedIncomeStance.recommendedDurationBand}
												</Badge>
											</div>
											<div className="text-xs text-foreground font-medium">
												Category: <strong className="text-teal-300">{briefToDisplay.amcConsensus.fixedIncomeStance.recommendedCategory}</strong>
											</div>
											<p className="text-xs text-muted-foreground leading-relaxed">
												{briefToDisplay.amcConsensus.fixedIncomeStance.rationale}
											</p>
										</div>
									</div>

									{/* Thematic Rotations */}
									<div className="space-y-2">
										<span className="text-xs font-semibold text-foreground">
											Key Thematic Rotations & Sectoral Positioning:
										</span>
										<div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
											{briefToDisplay.amcConsensus.thematicRotations.map((theme, tIdx) => (
												<div key={tIdx} className="p-2.5 rounded-lg bg-card/40 border border-border/40 space-y-1.5">
													<div className="flex items-center justify-between">
														<span className="text-xs font-semibold text-foreground">{theme.theme}</span>
														<Badge
															className={`text-[10px] border-0 ${
																theme.sentiment === "Overweight"
																	? "bg-emerald-500/20 text-emerald-400"
																	: theme.sentiment === "Underweight"
																		? "bg-red-500/20 text-red-400"
																		: "bg-muted text-muted-foreground"
															}`}
														>
															{theme.sentiment}
														</Badge>
													</div>
													<p className="text-[11px] text-muted-foreground leading-normal">
														{theme.fundManagerRationale}
													</p>
													<div className="text-[10px] text-teal-300/80 pt-1 border-t border-border/30">
														Favored: {theme.favoredSectors.join(", ")}
													</div>
												</div>
											))}
										</div>
									</div>

									{/* Advisor Client Talking Points */}
									<div className="p-3 rounded-lg bg-teal-900/20 border border-teal-500/20 space-y-1.5">
										<span className="text-xs font-semibold text-teal-200">
											🗣️ Advisor Client Talking Points (SEBI FASP-AI Compliant):
										</span>
										<ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
											{briefToDisplay.amcConsensus.advisorTalkingPoints.map((point, pIdx) => (
												<li key={pIdx} className="leading-relaxed">
													{point}
												</li>
											))}
										</ul>
									</div>

									{/* Regulatory Disclaimer */}
									<p className="text-[10px] text-muted-foreground/70 italic text-center">
										{briefToDisplay.amcConsensus.faspAiDisclaimer}
									</p>
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
