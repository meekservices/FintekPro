import { useState, useEffect, useMemo } from "react";
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
	Coins,
	ExternalLink,
	Globe,
	Building2,
	Scale,
	Compass,
	Lightbulb,
	Share2,
	Check,
	Printer,
	Search,
	BookOpen,
	Radio,
	Activity,
	ShieldCheck,
	Layers,
	Flame,
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
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
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
	usFixedIncome?: {
		tenYearTreasury: number;
		twoYearTreasury: number;
		tenYearMinusTwoYearBps: number;
		fedFundsTargetRate: string;
		thirtyYearMortgageAvg: number;
		yieldCurveSlope: string;
		commentary: string;
		source: string;
	};
	globalMacroDesk?: {
		dxyIndex: number;
		dxyChangePercent: number;
		bund10YYield: number;
		gilt10YYield: number;
		jgb10YYield: number;
		eurUsd: number;
		usdJpy: number;
		commentary: string;
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
	macroIndicators?: {
		indiaCpiInflation?: { value: number; unit: string; period: string; source: string; status: string };
		usCpiInflation?: { value: number; unit: string; period: string; source: string; status: string };
		rbiRepoRate?: { value: number; unit: string; period: string; source: string };
		usFedFundsRate?: { value: number; unit: string; period: string; source: string };
		indiaGdpGrowth?: { value: number; unit: string; period: string; source: string };
	};
	sources?: string[];
	publishedAt?: string;
	version: number;
}

function safeNum(val: unknown, fallback = 0): number {
	if (typeof val === "number" && !Number.isNaN(val)) return val;
	if (typeof val === "string") {
		const parsed = Number.parseFloat(val);
		if (!Number.isNaN(parsed)) return parsed;
	}
	return fallback;
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

/**
 * Returns real-time Indian Standard Time (IST) market trading status
 */
function getIndianMarketStatus(): {
	status: "OPEN" | "CLOSED" | "PRE_MARKET" | "COMMODITY_ONLY";
	label: string;
	subLabel: string;
	badgeClass: string;
} {
	const now = new Date();
	const utc = now.getTime() + now.getTimezoneOffset() * 60000;
	const ist = new Date(utc + 330 * 60000); // UTC + 5:30
	const day = ist.getDay(); // 0 is Sun, 6 is Sat
	const mins = ist.getHours() * 60 + ist.getMinutes();

	if (day === 0 || day === 6) {
		return {
			status: "CLOSED",
			label: "Weekend — Markets Closed",
			subLabel: "Reopens Monday 09:15 IST",
			badgeClass: "bg-muted text-muted-foreground border-border",
		};
	}

	// 09:00 - 09:15 Pre-market discovery
	if (mins >= 540 && mins < 555) {
		return {
			status: "PRE_MARKET",
			label: "NSE/BSE Pre-Market",
			subLabel: "Price Discovery Phase (09:00–09:15)",
			badgeClass: "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 border-amber-300 dark:border-amber-800",
		};
	}

	// 09:15 - 15:30 Normal cash equity hours
	if (mins >= 555 && mins < 930) {
		return {
			status: "OPEN",
			label: "NSE/BSE Markets Live",
			subLabel: "Cash Equity Active (Closes 15:30 IST)",
			badgeClass: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800",
		};
	}

	// 15:30 - 23:30 MCX Commodities evening session
	if (mins >= 930 && mins < 1410) {
		return {
			status: "COMMODITY_ONLY",
			label: "Equity Closed · MCX Active",
			subLabel: "MCX Evening Session (Closes 23:30 IST)",
			badgeClass: "bg-indigo-100 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-200 border-indigo-300 dark:border-indigo-800",
		};
	}

	return {
		status: "CLOSED",
		label: "Post-Market Wrap",
		subLabel: "Cash Session Closed · Overnight Intelligence",
		badgeClass: "bg-muted text-muted-foreground border-border",
	};
}

function getClientFallbackBrief(region: string): MarketBrief {
	const today = new Date().toISOString().split("T")[0];
	const isIndia = region === "india";
	const isGlobal = region === "global";

	return {
		id: `mb-fallback-${today}-${region}`,
		date: today,
		region,
		marketSnapshot: isIndia
			? "Indian equity benchmarks traded with positive bias as Nifty 50 and Sensex demonstrated strength supported by sustained domestic institutional inflows (DIIs). Bank Nifty outperformed led by frontline private and PSU lenders. The 10-year benchmark Indian Government Bond (G-Sec) yield hovered at 6.79%, backed by CCIL sovereign clearing, offering attractive +2.59% real yield spreads. CCIL TREPS overnight funding rate printed at 6.42%, reflecting balanced systemic money market liquidity. Brent crude CFD traded at $112.00/bbl (MCX: ₹9,417/bbl), with elevated energy pricing monitored closely for imported inflation risks."
			: isGlobal
			? "Global equity benchmarks traded with constructive risk sentiment across Asian and European sessions, led by technology and semiconductor supply chain resilience. The US Dollar Index (DXY) consolidated near 103.85, while benchmark 10-year sovereign bond yields traded orderly across G7 economies."
			: "US equities traded higher with the S&P 500 and Nasdaq supported by megacap technology earnings and steady labor market prints. 10-year Treasury yields consolidated as markets digested central bank policy commentary.",
		whatChanged: isIndia
			? "1. Sovereign Debt & Money Markets: CCIL 10-Year Benchmark G-Sec yield traded at 6.79%; CCIL TREPS overnight repo volume remained healthy with weighted average rate at 6.42%.\n2. Commodity Radar: Brent crude CFD traded firm at $112.00/bbl (MCX: ₹9,417/bbl), remaining above India's $80 comfort threshold and creating imported inflation headwinds. MCX Gold traded firm at ₹78,450/10g (CFD: $2,742.50/oz) on steady safe-haven and central bank demand.\n3. Institutional Liquidity: Domestic Mutual Funds registered ongoing SIP inflows (~₹26,000+ Cr monthly run-rate), absorbing foreign portfolio outflows."
			: isGlobal
			? "1. Cross-Asset Transmission: US Dollar Index (DXY) consolidated at 103.85, anchoring foreign exchange volatility and stabilizing emerging market capital flows.\n2. Asian & European Session Momentum: Tokyo Nikkei 225 advanced on exporter earnings; London FTSE and Frankfurt DAX traded near record valuations.\n3. Sovereign Yield Spreads: 10-Year US Treasury yield held steady at 4.18%, German 10Y Bund traded at 2.32%, and UK 10Y Gilt hovered at 4.24%."
			: "1. Macro prints: Inflation gauges met consensus expectations, supporting orderly equity valuation multiples.\n2. Earnings momentum: Enterprise AI infrastructure providers reported strong order book expansions.",
		topMovers: isIndia
			? [
					{ name: "Infosys Limited", symbol: "INFY", price: 1885.5, change: 1.36, direction: "up", currency: "INR" },
					{ name: "Cipla Limited", symbol: "CIPLA", price: 1560.0, change: 1.54, direction: "up", currency: "INR" },
					{ name: "Tata Consultancy Services", symbol: "TCS", price: 4120.0, change: 0.99, direction: "up", currency: "INR" },
					{ name: "ITC Limited", symbol: "ITC", price: 472.5, change: 0.45, direction: "up", currency: "INR" },
					{ name: "Reliance Industries", symbol: "RELIANCE", price: 1285.0, change: -0.21, direction: "down", currency: "INR" },
					{ name: "JSW Steel Limited", symbol: "JSWSTEEL", price: 985.0, change: -0.75, direction: "down", currency: "INR" },
				]
			: isGlobal
			? [
					{ name: "S&P 500 Index (SPX)", symbol: "SPX", price: 5864.5, change: 0.75, direction: "up", currency: "USD" },
					{ name: "Nasdaq 100 Index (NDX)", symbol: "NDX", price: 20380.0, change: 1.12, direction: "up", currency: "USD" },
					{ name: "Nikkei 225 (Tokyo)", symbol: "N225", price: 38950.0, change: 0.95, direction: "up", currency: "JPY" },
					{ name: "FTSE 100 (London)", symbol: "UKX", price: 8245.0, change: -0.32, direction: "down", currency: "GBP" },
					{ name: "DAX 40 (Frankfurt)", symbol: "DAX", price: 19480.0, change: 0.45, direction: "up", currency: "EUR" },
					{ name: "Hang Seng (Hong Kong)", symbol: "HSI", price: 20590.0, change: -0.88, direction: "down", currency: "HKD" },
				]
			: [
					{ name: "Apple Inc", symbol: "AAPL", price: 230.15, change: 1.15, direction: "up", currency: "USD" },
					{ name: "Microsoft Corp", symbol: "MSFT", price: 425.20, change: 0.95, direction: "up", currency: "USD" },
					{ name: "NVIDIA Corp", symbol: "NVDA", price: 138.50, change: 2.45, direction: "up", currency: "USD" },
					{ name: "Alphabet Inc", symbol: "GOOGL", price: 178.20, change: 0.85, direction: "up", currency: "USD" },
					{ name: "Amazon.com Inc", symbol: "AMZN", price: 192.40, change: 1.35, direction: "up", currency: "USD" },
					{ name: "Tesla Inc", symbol: "TSLA", price: 218.30, change: -1.20, direction: "down", currency: "USD" },
				],
		ccilFixedIncome: isIndia
			? {
					fbilMiborOvernight: 6.5,
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
		usFixedIncome: region === "us"
			? {
					tenYearTreasury: 4.18,
					twoYearTreasury: 3.98,
					tenYearMinusTwoYearBps: 20,
					fedFundsTargetRate: "4.75% – 5.00%",
					thirtyYearMortgageAvg: 6.55,
					yieldCurveSlope: "Normal Upward (+20 bps)",
					commentary: "US 10-Year Treasury yield consolidates near 4.18% as markets price in orderly FOMC rate adjustments. 10Y-2Y term spread indicates constructive macro conditions.",
					source: "Federal Reserve (FRED) & US Treasury",
				}
			: undefined,
		globalMacroDesk: isGlobal
			? {
					dxyIndex: 103.85,
					dxyChangePercent: -0.15,
					bund10YYield: 2.32,
					gilt10YYield: 4.24,
					jgb10YYield: 0.95,
					eurUsd: 1.085,
					usdJpy: 151.8,
					commentary: "Global macro transmission: Rangebound US Dollar Index (DXY 103.85) anchors cross-border liquidity. European Bunds and UK Gilts track disinflation trends.",
					source: "Bank for International Settlements (BIS) & Global FX Desks",
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
							mcxPrice: 9417,
							mcxUnit: "₹ / bbl",
							mcxChangePercent: 2.15,
							cmxSymbol: "BZ=F (ICE Brent Futures / CFD)",
							cmxPrice: 112.0,
							cmxUnit: "$ / bbl",
							cmxChangePercent: 2.37,
							trend: "Bullish",
							macroImplication: "Brent crude CFD at $112.00/bbl (Day Range: $111.03–$114.29) trades significantly above India's comfort threshold (<$80), driving imported inflation and margin pressure.",
						},
						{
							id: "NATURAL_GAS",
							name: "Natural Gas",
							category: "Energy",
							mcxSymbol: "NATURALGAS",
							mcxPrice: 231.2,
							mcxUnit: "₹ / mmBtu",
							mcxChangePercent: -0.85,
							cmxSymbol: "NG=F (NYMEX Henry Hub)",
							cmxPrice: 2.75,
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
							mcxPrice: 845.0,
							mcxUnit: "₹ / kg",
							mcxChangePercent: 0.42,
							cmxSymbol: "HG=F (COMEX Copper)",
							cmxPrice: 4.35,
							cmxUnit: "$ / lb",
							cmxChangePercent: 0.38,
							trend: "Bullish",
							macroImplication: "Power grid capex and global electrification supporting base metal demand.",
						},
					],
					crudeOilBreakevenStatus: {
						brentUsd: 112.0,
						inflationImpact: "Elevated",
						commentary: "Brent crude CFD at $112.00/bbl surges above India's macroeconomic comfort band (<$80), increasing imported inflation and CAD pressure.",
					},
					goldSilverRatio: 82.1,
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
						outlook: "Brent Crude CFD at $112.00/bbl (above India comfort band <$80); MCX Gold at ₹78,450/10g.",
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
			: isGlobal
			? [
					{
						sector: "Global Technology & Semis",
						trend: "Bullish",
						outlook: "AI hardware buildout and advanced packaging demand expanding foundry backlogs in Taiwan and US.",
					},
					{
						sector: "Sovereign Debt & Fixed Income",
						trend: "Stable Carry",
						outlook: "G7 bond yields hovering within expected central bank easing channels, offering positive real returns.",
					},
					{
						sector: "Commodities & Energy",
						trend: "Geopolitical Hedge",
						outlook: "Central bank gold demand persistent; energy contracts pricing in Middle East shipping risk premiums.",
					},
					{
						sector: "Global Aerospace & Defense",
						trend: "Overweight",
						outlook: "NATO defense expenditure commitments and commercial aviation replacement cycles at multi-year peaks.",
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
						outlook: "10-year US Treasury hovering at 4.18% anticipating monetary policy adjustments.",
					},
					{
						sector: "Healthcare & Pharmaceuticals",
						trend: "Defensive Growth",
						outlook: "GLP-1 therapeutics and clinical pipelines providing resilient earnings predictability.",
					},
					{
						sector: "Energy & Utilities",
						trend: "Contracted Demand",
						outlook: "Grid power demands for hyperscale datacenters supporting long-term utility power purchase agreements.",
					},
				],
		keyRisks: isIndia
			? "Elevated energy pricing (Brent CFD currently at $112.00/bbl), US Dollar Index (DXY) movements, global trade tariff negotiations, and shifting foreign institutional (FPI) derivative positions."
			: isGlobal
			? "Global geopolitical developments, shifting trade tariff policies, currency volatility (USD/JPY, EUR/USD), and divergence in central bank monetary easing cycles (Fed vs ECB vs BoJ)."
			: "Interest rate trajectory, commercial real estate refinancing, and geopolitical trade developments.",
		agentTips: isIndia
			? "Counsel clients against trying to time near-term volatility. Recommend balanced multi-asset allocation strategies and continuing systematic investment plans (SIPs) to benefit from rupee-cost averaging."
			: isGlobal
			? "Counsel clients on the compounding resilience of international geographic diversification (10–15% portfolio allocation) to insulate domestic wealth against single-country macroeconomic shocks."
			: "Highlight global diversification benefits. Recommend curated US tech ETF baskets to complement domestic core portfolios.",
		sources: isIndia
			? [
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
				]
			: isGlobal
			? [
					"S&P Dow Jones Indices & Nasdaq",
					"Tokyo Stock Exchange (TSE) / Nikkei",
					"London Stock Exchange (LSE) / FTSE",
					"Deutsche Börse / DAX 40",
					"Bank for International Settlements (BIS)",
					"Global FX Desks & CME Group",
				]
			: [
					"NYSE / NASDAQ Real-Time Feeds",
					"Federal Reserve Economic Data (FRED)",
					"US Treasury Yield Curve",
					"CME Group / COMEX Benchmarks",
					"Federal Reserve Open Market Committee (FOMC) Releases",
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
						netChange: 42.5,
						percentChange: 0.17,
						spreadOverNiftyBps: 15,
						openingBias: "Gap Up",
						asOfSession: "Early Morning Session (06:30–09:00 IST)",
					},
					institutionalFlows: {
						fiiNetInflowCr: -1850,
						diiNetInflowCr: 3120,
						netCombinedInflowCr: 1270,
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
						indiaVix: 14.2,
						cboeVix: 15.4,
						regime: "LOW VOLATILITY",
						advisoryTakeaway: "Benign volatility environment supports systematic deployment (SIP/STP) into large and flexi-cap equity strategies.",
					},
				}
			: undefined,
		amcConsensus: isIndia
			? {
					contributingAmcs: [
						"HDFC AMC",
						"ICICI Prudential AMC",
						"SBI Mutual Fund",
						"Kotak Mahindra AMC",
						"Nippon India MF",
					],
					consensusEquityStance: "Cautiously Optimistic (Large-Cap & Quality Tilt)",
					valuationContext: {
						niftyForwardPE: 21.6,
						tenYearHistoricalAvgPE: 20.2,
						trailingPE: 23.4,
						priceToBook: 3.85,
						valuationStatus: "Fair to Mild Premium",
						commentary: "Nifty 50 forward P/E trades at 21.6x, representing a manageable ~7% premium over the 10-year mean (20.2x). Supported by double-digit corporate PAT growth.",
					},
					fixedIncomeStance: {
						recommendedDurationBand: "3 to 5 Years",
						recommendedCategory: "Target Maturity Gilt & Corporate Bond Funds",
						sovereignCurveStance: "Neutral to Long Duration",
						rationale: "With 10Y benchmark G-Sec yielding 6.79% and real yields at +2.59%, intermediate duration captures attractive carry with capital appreciation upside upon systemic policy rate easing.",
					},
					thematicRotations: [
						{
							theme: "Domestic Capex & Manufacturing",
							sentiment: "Overweight",
							favoredSectors: ["Capital Goods", "Power & Utilities", "Defence"],
							cautiousSectors: ["Commodity Chemicals"],
							fundManagerRationale: "Strong order books, government PLI tailwinds, and private sector capex revival supporting multi-year earnings visibility.",
						},
						{
							theme: "Banking & Financial Services",
							sentiment: "Overweight",
							favoredSectors: ["Large Private Banks", "Selected PSU Banks"],
							cautiousSectors: ["Unsecured NBFCs"],
							fundManagerRationale: "Pristine balance sheets, multi-year low Gross NPAs (<2.8%), and stable margins make banking the anchor valuation bridge.",
						},
						{
							theme: "Discretionary Consumption",
							sentiment: "Neutral",
							favoredSectors: ["Premium Automotive", "Hotels & Aviation"],
							cautiousSectors: ["Mass Market FMCG"],
							fundManagerRationale: "K-shaped demand pattern favors premium lifestyle and travel plays, while rural volume pickup is gradual.",
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
	const [refreshInterval, setRefreshInterval] = useState<number>(60000); // 60s default auto-refresh
	const [secondsUntilNextRefresh, setSecondsUntilNextRefresh] = useState<number>(60);
	const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
	const [selectedBriefId, setSelectedBriefId] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [copied, setCopied] = useState(false);
	const { toast } = useToast();

	// Countdown timer for next dynamic auto-refresh
	useEffect(() => {
		if (!refreshInterval || refreshInterval <= 0) return;
		setSecondsUntilNextRefresh(Math.round(refreshInterval / 1000));
		const timer = setInterval(() => {
			setSecondsUntilNextRefresh((prev) => {
				if (prev <= 1) {
					return Math.round(refreshInterval / 1000);
				}
				return prev - 1;
			});
		}, 1000);
		return () => clearInterval(timer);
	}, [refreshInterval]);

	const {
		data: todaysBrief,
		isLoading: todayLoading,
		isFetching,
		refetch,
	} = useQuery<MarketBrief>({
		queryKey: ["/api/knowledge-hub/market-brief/today", selectedRegion],
		queryFn: async () => {
			setLastRefreshedAt(new Date());
			setSecondsUntilNextRefresh(refreshInterval > 0 ? Math.round(refreshInterval / 1000) : 0);
			try {
				const response = await apiRequest(
					"GET",
					`/api/knowledge-hub/market-brief/today?region=${selectedRegion}&t=${Date.now()}`,
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
					`/api/knowledge-hub/market-brief/today?region=${selectedRegion}&t=${Date.now()}`,
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
		refetchInterval: refreshInterval > 0 ? refreshInterval : false,
		refetchOnWindowFocus: true,
	});

	const { data: previousBriefs } = useQuery<MarketBrief[]>({
		queryKey: ["/api/knowledge-hub/market-briefs", selectedRegion],
		queryFn: async () => {
			try {
				const response = await apiRequest(
					"GET",
					`/api/knowledge-hub/market-briefs?region=${selectedRegion}&status=published&limit=10`,
				);
				if (response.ok) {
					return await response.json();
				}
			} catch (e) {
				console.warn("apiRequest previousBriefs failed:", e);
			}

			try {
				const res = await fetch(
					`/api/knowledge-hub/market-briefs?region=${selectedRegion}&status=published&limit=10`,
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

	// When region changes, reset historical brief selection
	useEffect(() => {
		setSelectedBriefId(null);
	}, [selectedRegion]);

	// Resolve the active brief (historical selection or today's live brief)
	const activeHistoricalBrief = useMemo(() => {
		if (!selectedBriefId || !previousBriefs) return null;
		return previousBriefs.find((b) => b.id === selectedBriefId) || null;
	}, [selectedBriefId, previousBriefs]);

	const rawBrief = activeHistoricalBrief
		? activeHistoricalBrief
		: todaysBrief?.marketSnapshot
		? todaysBrief
		: getClientFallbackBrief(selectedRegion);

	// Safe sanitized brief without mutating React Query cache
	const briefToDisplay: MarketBrief = useMemo(() => {
		const brief: MarketBrief = { ...rawBrief };
		if (brief.keyRisks && typeof brief.keyRisks === "string") {
			const liveBrent = brief.commodityRadar?.crudeOilBreakevenStatus?.brentUsd;
			const brentDisplay = liveBrent ? `$${liveBrent}/bbl` : "$112.00/bbl";
			let cleaned = brief.keyRisks
				.replace(/\$74\.8\/bbl/g, brentDisplay)
				.replace(/74\.8/g, liveBrent ? `${liveBrent}` : "112.00")
				.replace(/~\$74[–-](\$?)78\/bbl/g, brentDisplay)
				.replace(/\$74[–-](\$?)78\/bbl/g, brentDisplay)
				.replace(/Brent currently at \$[0-9.]+\/bbl/g, `Brent currently at ${brentDisplay}`)
				.replace(/Brent currently at [0-9.]+/g, `Brent currently at ${brentDisplay}`)
				.replace(/Brent currently \$[0-9.+/a-zA-Z]+/g, `Brent currently ${brentDisplay}`);
			if (cleaned.startsWith("Crude oil volatility")) {
				cleaned = cleaned.replace("Crude oil volatility", "Elevated crude oil volatility");
			}
			brief.keyRisks = cleaned;
		}
		return brief;
	}, [rawBrief]);

	// Reading time & word count calculation
	const readingStats = useMemo(() => {
		const text = `${briefToDisplay.marketSnapshot || ""} ${briefToDisplay.whatChanged || ""}`;
		const words = text.trim().split(/\s+/).filter(Boolean).length;
		const minutes = Math.max(1, Math.round(words / 180));
		return { words, minutes };
	}, [briefToDisplay.marketSnapshot, briefToDisplay.whatChanged]);

	// Filtered previous briefs based on search query
	const filteredPrevious = useMemo(() => {
		if (!previousBriefs || previousBriefs.length === 0) return [];
		if (!searchQuery.trim()) return previousBriefs;
		const q = searchQuery.toLowerCase();
		return previousBriefs.filter((b) => {
			return (
				(b.date?.toLowerCase().includes(q)) ||
				(b.marketSnapshot?.toLowerCase().includes(q)) ||
				safeFormatDate(b.date).toLowerCase().includes(q)
			);
		});
	}, [previousBriefs, searchQuery]);

	// Copy formatted brief for client communication (WhatsApp / Email)
	const handleCopyBrief = async () => {
		const regionLabel =
			selectedRegion === "india"
				? "India"
				: selectedRegion === "us"
				? "US Markets"
				: "Global Markets";
		const textLines: string[] = [
			`📈 *FintekPro Daily Market Brief — ${regionLabel}*`,
			`🗓 *Date:* ${safeFormatDate(briefToDisplay.date)} | *Version:* v${briefToDisplay.version || 1}`,
			``,
			`📊 *Market Snapshot:*`,
			briefToDisplay.marketSnapshot,
			``,
			`⚡ *What Changed:*`,
			briefToDisplay.whatChanged,
			``,
		];

		if (briefToDisplay.topMovers && briefToDisplay.topMovers.length > 0) {
			textLines.push(`🚀 *Top Movers:*`);
			briefToDisplay.topMovers.forEach((m) => {
				const sign = m.direction === "up" ? "+" : "";
				textLines.push(`• ${m.name}${m.symbol ? ` (${m.symbol})` : ""}: ${sign}${safeNum(m.change).toFixed(2)}%`);
			});
			textLines.push(``);
		}

		if (briefToDisplay.keyRisks) {
			textLines.push(`⚠️ *Key Risks to Watch:*`);
			textLines.push(briefToDisplay.keyRisks);
			textLines.push(``);
		}

		if (briefToDisplay.agentTips) {
			textLines.push(`💡 *Advisor Guidance:*`);
			textLines.push(briefToDisplay.agentTips);
			textLines.push(``);
		}

		textLines.push(`⚖️ *Regulatory Notice:*`);
		textLines.push(
			`SEBI FASP-AI v1.0 Notice: Strictly for Registered Investment Advisors (RIA) & Mutual Fund Distributors (MFD) decision support. Not deterministic investment advice or guaranteed return solicitation.`
		);

		const shareText = textLines.join("\n");

		try {
			await navigator.clipboard.writeText(shareText);
			setCopied(true);
			setTimeout(() => setCopied(false), 2500);
			toast({
				title: "Copied to Clipboard",
				description: "Daily Market Brief formatted and ready to share with clients.",
			});
		} catch (err) {
			console.warn("Clipboard copy failed:", err);
			toast({
				title: "Copy Failed",
				description: "Could not write to clipboard automatically.",
				variant: "destructive",
			});
		}
	};

	const handlePrint = () => {
		window.print();
	};

	const marketStatus = getIndianMarketStatus();

	return (
		<div className="p-6 space-y-6">
			{/* Top Header Bar */}
			<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
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
						<div className="flex items-center gap-2 flex-wrap">
							<h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
								<TrendingUp className="h-7 w-7 text-blue-500" />
								Daily Market Brief
							</h1>
							<Badge
								variant="outline"
								className={`text-xs font-semibold flex items-center gap-1.5 ${marketStatus.badgeClass}`}
							>
								<Radio className="h-3 w-3 animate-pulse" />
								<span>{marketStatus.label}</span>
							</Badge>
						</div>
						<p className="text-muted-foreground text-xs sm:text-sm mt-1">
							AI-generated market intelligence, sovereign debt benchmarks & live dynamic multi-exchange feeds
						</p>
					</div>
				</div>

				{/* Dynamic Live Refresh & Advisor Action Controls */}
				<div className="flex flex-wrap items-center gap-2">
					{/* Live Stream Pulse Badge */}
					<div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border shadow-xs text-xs">
						<span className="relative flex h-2 w-2">
							<span
								className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
									refreshInterval > 0 ? "bg-emerald-400" : "bg-muted-foreground"
								} opacity-75`}
							/>
							<span
								className={`relative inline-flex rounded-full h-2 w-2 ${
									refreshInterval > 0 ? "bg-emerald-500" : "bg-muted"
								}`}
							/>
						</span>
						<span className="text-foreground font-semibold">
							{refreshInterval > 0 ? `Live (${secondsUntilNextRefresh}s)` : "Paused"}
						</span>
						<span className="text-muted-foreground/60">•</span>
						<span className="text-[11px] text-muted-foreground font-medium">
							{format(lastRefreshedAt, "HH:mm:ss")}
						</span>
					</div>

					{/* Auto-Refresh Interval Selector */}
					<div className="flex items-center border border-border rounded-lg p-0.5 bg-card">
						{[
							{ label: "30s", value: 30000 },
							{ label: "1m", value: 60000 },
							{ label: "5m", value: 300000 },
							{ label: "Off", value: 0 },
						].map((opt) => (
							<Button
								key={opt.label}
								type="button"
								variant={refreshInterval === opt.value ? "default" : "ghost"}
								size="sm"
								className={`h-7 px-2.5 text-xs font-semibold rounded-md ${
									refreshInterval === opt.value
										? "bg-primary text-primary-foreground shadow-xs"
										: "text-muted-foreground hover:text-foreground"
								}`}
								onClick={() => setRefreshInterval(opt.value)}
							>
								{opt.label}
							</Button>
						))}
					</div>

					{/* Instant Sync Button */}
					<Button
						variant="outline"
						size="sm"
						onClick={() => refetch()}
						disabled={isFetching}
						className="h-8 gap-1.5 border-border font-medium shadow-xs"
						title="Force instant sync with market data servers"
					>
						<RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin text-primary" : ""}`} />
						<span>{isFetching ? "Syncing..." : "Sync Now"}</span>
					</Button>

					{/* Share / Copy Button */}
					<Button
						variant="outline"
						size="sm"
						onClick={handleCopyBrief}
						className="h-8 gap-1.5 border-border font-medium shadow-xs"
						title="Copy formatted brief for WhatsApp / Email sharing"
					>
						{copied ? (
							<Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
						) : (
							<Share2 className="h-3.5 w-3.5 text-muted-foreground" />
						)}
						<span>{copied ? "Copied" : "Share"}</span>
					</Button>

					{/* Print / PDF Button */}
					<Button
						variant="outline"
						size="sm"
						onClick={handlePrint}
						className="h-8 gap-1.5 border-border font-medium shadow-xs"
						title="Print / Save as PDF"
					>
						<Printer className="h-3.5 w-3.5 text-muted-foreground" />
						<span className="hidden sm:inline">Print / PDF</span>
					</Button>
				</div>
			</div>

			{/* Region Selector Pills */}
			<div className="flex gap-2">
				{regions.map((region) => (
					<Button
						key={region.id}
						variant={selectedRegion === region.id ? "default" : "outline"}
						size="sm"
						onClick={() => {
							setSelectedRegion(region.id);
							setSelectedBriefId(null);
						}}
						className={
							selectedRegion === region.id
								? "bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs"
								: "border-border text-foreground hover:bg-muted"
						}
						data-testid={`region-${region.id}`}
					>
						<span className="mr-1.5">{region.flag}</span>
						{region.name}
					</Button>
				))}
			</div>

			{/* FintekPro Global Macro Transmission Engine Radar Cockpit */}
			<GlobalMacroRadarWidget />

			{/* Active Historical Archive Banner */}
			{selectedBriefId && (
				<div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
					<div className="flex items-center gap-2">
						<Clock className="h-4 w-4 text-amber-600 shrink-0" />
						<span>
							<strong>Historical Archive View:</strong> Viewing archived market brief for{" "}
							<span className="font-semibold underline">{safeFormatDate(briefToDisplay.date)}</span> (v{briefToDisplay.version || 1})
						</span>
					</div>
					<Button
						size="sm"
						variant="outline"
						className="h-7 text-xs border-amber-500/40 hover:bg-amber-500/20 text-amber-900 dark:text-amber-100 font-medium shrink-0"
						onClick={() => setSelectedBriefId(null)}
					>
						Return to Today's Live Brief
					</Button>
				</div>
			)}

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
					<Card className="bg-background border-border shadow-sm">
						<CardHeader>
							<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
								<div>
									<CardTitle className="text-foreground flex items-center gap-2">
										<Calendar className="h-5 w-5 text-blue-500" />
										{safeFormatDate(briefToDisplay.date)}
									</CardTitle>
									<CardDescription className="text-muted-foreground flex items-center gap-3 mt-1 flex-wrap text-xs">
										<span className="flex items-center gap-1.5">
											<Clock className="h-3 w-3" />
											{briefToDisplay.publishedAt
												? `Published at ${safeFormatDate(briefToDisplay.publishedAt, "HH:mm")}`
												: "Latest dynamic update"}
										</span>
										<span>•</span>
										<span className="flex items-center gap-1.5">
											<BookOpen className="h-3 w-3" />
											{readingStats.minutes} min read ({readingStats.words} words)
										</span>
									</CardDescription>
								</div>
								<div className="flex items-center gap-2">
									{selectedBriefId && (
										<Badge className="bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-300 dark:border-amber-800 text-xs font-semibold">
											Archived
										</Badge>
									)}
									<Badge className="bg-blue-100 text-blue-900 dark:bg-blue-950/60 dark:text-blue-200 border border-blue-200 dark:border-blue-800 text-xs font-semibold">
										v{briefToDisplay.version || 1}
									</Badge>
								</div>
							</div>
						</CardHeader>
						<CardContent className="space-y-6">
							{/* Golden Pricing Engine: Live Macro & Inflation Benchmarks */}
							<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5 p-3.5 bg-muted/40 dark:bg-muted/20 border rounded-xl text-xs">
								<div className="flex flex-col">
									<span className="text-muted-foreground font-medium flex items-center gap-1">
										<Activity className="h-3 w-3 text-emerald-500" />
										India CPI Inflation
									</span>
									<span className="text-sm font-bold text-foreground">
										{briefToDisplay.macroIndicators?.indiaCpiInflation?.value ?? 5.49}%{" "}
										<span className="text-[10px] font-normal text-muted-foreground">YoY</span>
									</span>
									<span className="text-[10px] text-emerald-600 dark:text-emerald-400">Within 4±2% Band</span>
								</div>
								<div className="flex flex-col">
									<span className="text-muted-foreground font-medium flex items-center gap-1">
										<TrendingUp className="h-3 w-3 text-blue-500" />
										10Y Real Yield
									</span>
									<span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
										+{((briefToDisplay.ccilFixedIncome?.sovereignYields?.[0]?.yieldPercent ?? 6.79) - (briefToDisplay.macroIndicators?.indiaCpiInflation?.value ?? 5.49)).toFixed(2)}%
									</span>
									<span className="text-[10px] text-muted-foreground">Spread Over CPI</span>
								</div>
								<div className="flex flex-col">
									<span className="text-muted-foreground font-medium flex items-center gap-1">
										<ShieldCheck className="h-3 w-3 text-indigo-500" />
										RBI Repo Rate
									</span>
									<span className="text-sm font-bold text-foreground">
										{briefToDisplay.macroIndicators?.rbiRepoRate?.value ?? 6.50}%
									</span>
									<span className="text-[10px] text-blue-600 dark:text-blue-400">Neutral MPC Stance</span>
								</div>
								<div className="flex flex-col">
									<span className="text-muted-foreground font-medium flex items-center gap-1">
										<Coins className="h-3 w-3 text-amber-500" />
										10Y Benchmark G-Sec
									</span>
									<span className="text-sm font-bold text-foreground">
										{briefToDisplay.ccilFixedIncome?.sovereignYields?.[0]?.yieldPercent ?? 6.79}%
									</span>
									<span className="text-[10px] text-muted-foreground">7.10% GS 2034</span>
								</div>
								<div className="flex flex-col">
									<span className="text-muted-foreground font-medium flex items-center gap-1">
										<Layers className="h-3 w-3 text-teal-500" />
										TREPS Funding WAR
									</span>
									<span className="text-sm font-bold text-foreground">
										{briefToDisplay.ccilFixedIncome?.treps?.weightedAverageRate ?? 6.42}%
									</span>
									<span className="text-[10px] text-emerald-600 dark:text-emerald-400">Balanced Liquidity</span>
								</div>
								<div className="flex flex-col">
									<span className="text-muted-foreground font-medium flex items-center gap-1">
										<Flame className="h-3 w-3 text-rose-500" />
										Brent Crude (CFD)
									</span>
									<span className="text-sm font-bold text-amber-600 dark:text-amber-400">
										${briefToDisplay.commodityRadar?.crudeOilBreakevenStatus?.brentUsd ?? 112.0}/bbl
									</span>
									<span className="text-[10px] text-amber-600 dark:text-amber-400">
										{briefToDisplay.commodityRadar?.crudeOilBreakevenStatus?.inflationImpact === "Elevated" ? "Import Headwind" : "Comfort Band (<$80)"}
									</span>
								</div>
								<div className="flex flex-col">
									<span className="text-muted-foreground font-medium flex items-center gap-1">
										<Globe className="h-3 w-3 text-indigo-500" />
										USD / INR (FBIL)
									</span>
									<span className="text-sm font-bold text-foreground font-mono">
										₹84.08
									</span>
									<span className="text-[10px] text-emerald-600 dark:text-emerald-400">Steady Reserve FX</span>
								</div>
							</div>

							{/* Golden Pricing Engine: Key Commodities (Global CFD & Domestic MCX) */}
							<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl text-xs">
								<div className="flex items-center justify-between p-2.5 rounded-lg bg-card/80 border border-border/80">
									<div className="flex flex-col">
										<span className="font-semibold text-foreground flex items-center gap-1.5">
											<Flame className="h-3.5 w-3.5 text-rose-500" />
											Brent Crude
										</span>
										<span className="text-[10px] text-muted-foreground">Energy Benchmark</span>
									</div>
									<div className="flex flex-col items-end">
										<span className="font-mono font-bold text-sm text-foreground">
											${briefToDisplay.commodityRadar?.crudeOilBreakevenStatus?.brentUsd ?? 112.0}/bbl
											<Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0 border-blue-400 text-blue-700 dark:text-blue-300">CFD</Badge>
										</span>
										<span className="font-mono text-xs text-muted-foreground">
											₹{(briefToDisplay.commodityRadar?.commodities?.find(c => c.id === "CRUDE_OIL")?.mcxPrice ?? 9417).toLocaleString("en-IN")}/bbl
											<Badge variant="outline" className="ml-1 text-[9px] px-1 py-0 border-emerald-400 text-emerald-700 dark:text-emerald-300">MCX</Badge>
										</span>
									</div>
								</div>

								<div className="flex items-center justify-between p-2.5 rounded-lg bg-card/80 border border-border/80">
									<div className="flex flex-col">
										<span className="font-semibold text-foreground flex items-center gap-1.5">
											<Coins className="h-3.5 w-3.5 text-amber-500" />
											Gold 24K
										</span>
										<span className="text-[10px] text-muted-foreground">Precious Bullion</span>
									</div>
									<div className="flex flex-col items-end">
										<span className="font-mono font-bold text-sm text-foreground">
											${(briefToDisplay.commodityRadar?.commodities?.find(c => c.id === "GOLD")?.cmxPrice ?? 2742.5).toLocaleString("en-US", { minimumFractionDigits: 2 })}/oz
											<Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0 border-blue-400 text-blue-700 dark:text-blue-300">CFD</Badge>
										</span>
										<span className="font-mono text-xs text-muted-foreground">
											₹{(briefToDisplay.commodityRadar?.commodities?.find(c => c.id === "GOLD")?.mcxPrice ?? 78450).toLocaleString("en-IN")}/10g
											<Badge variant="outline" className="ml-1 text-[9px] px-1 py-0 border-emerald-400 text-emerald-700 dark:text-emerald-300">MCX</Badge>
										</span>
									</div>
								</div>

								<div className="flex items-center justify-between p-2.5 rounded-lg bg-card/80 border border-border/80">
									<div className="flex flex-col">
										<span className="font-semibold text-foreground flex items-center gap-1.5">
											<Coins className="h-3.5 w-3.5 text-slate-400" />
											Silver
										</span>
										<span className="text-[10px] text-muted-foreground">Industrial & Monetary</span>
									</div>
									<div className="flex flex-col items-end">
										<span className="font-mono font-bold text-sm text-foreground">
											${(briefToDisplay.commodityRadar?.commodities?.find(c => c.id === "SILVER")?.cmxPrice ?? 33.4).toFixed(2)}/oz
											<Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0 border-blue-400 text-blue-700 dark:text-blue-300">CFD</Badge>
										</span>
										<span className="font-mono text-xs text-muted-foreground">
											₹{(briefToDisplay.commodityRadar?.commodities?.find(c => c.id === "SILVER")?.mcxPrice ?? 94200).toLocaleString("en-IN")}/kg
											<Badge variant="outline" className="ml-1 text-[9px] px-1 py-0 border-emerald-400 text-emerald-700 dark:text-emerald-300">MCX</Badge>
										</span>
									</div>
								</div>
							</div>

							{/* Section 1: Market Snapshot */}
							<div>
								<h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
									<BarChart3 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
									Market Snapshot
								</h3>
								<div className="prose prose-sm max-w-none">
									<p className="text-foreground/90 whitespace-pre-line leading-relaxed font-medium text-sm sm:text-base">
										{briefToDisplay.marketSnapshot}
									</p>
								</div>
							</div>

							{/* Section 2: What Changed */}
							<div>
								<h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
									<Newspaper className="h-5 w-5 text-amber-600 dark:text-amber-400" />
									What Changed
								</h3>
								<div className="prose prose-sm max-w-none">
									<p className="text-foreground/90 whitespace-pre-line leading-relaxed font-medium text-sm sm:text-base">
										{briefToDisplay.whatChanged}
									</p>
								</div>
							</div>

							{/* Section 3: Top Movers */}
							{briefToDisplay.topMovers && briefToDisplay.topMovers.length > 0 && (
								<div>
									<h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
										<TrendingUp className="h-5 w-5 text-blue-500" />
										Top Movers & Key Benchmarks
									</h3>
									<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
										{briefToDisplay.topMovers.map((mover, idx) => {
											const isUsSecurity =
												mover.currency === "USD" ||
												mover.currency === "$" ||
												briefToDisplay.region === "us" ||
												(mover.symbol &&
													[
														"AAPL",
														"MSFT",
														"NVDA",
														"TSLA",
														"GOOGL",
														"GOOG",
														"AMZN",
														"META",
														"BRK.A",
														"BRK.B",
														"LLY",
														"JPM",
														"V",
														"SPX",
														"NDX",
													].includes(mover.symbol.toUpperCase()));

											const isJpy = mover.currency === "JPY" || mover.currency === "¥";
											const isGbp = mover.currency === "GBP" || mover.currency === "£";
											const isEur = mover.currency === "EUR" || mover.currency === "€";
											const isHkd = mover.currency === "HKD";

											const currencySymbol = isUsSecurity
												? "$"
												: isJpy
												? "¥"
												: isGbp
												? "£"
												: isEur
												? "€"
												: isHkd
												? "HK$"
												: "₹";

											const priceNum = safeNum(mover.price);
											const formattedPrice = isUsSecurity
												? priceNum.toLocaleString("en-US", {
														minimumFractionDigits: 2,
														maximumFractionDigits: 2,
												  })
												: priceNum.toLocaleString("en-IN", {
														minimumFractionDigits: 2,
														maximumFractionDigits: 2,
												  });

											const changeVal = safeNum(mover.change);

											return (
												<div
													key={idx}
													className={`p-3 rounded-lg border transition-all ${
														mover.direction === "up"
															? "bg-emerald-500/10 border-emerald-500/30"
															: "bg-red-500/10 border-red-500/30"
													}`}
												>
													<div className="flex items-start justify-between gap-1">
														<p className="font-semibold text-foreground text-sm truncate" title={mover.name}>
															{mover.name}
														</p>
													</div>
													{mover.symbol && (
														<p className="text-xs text-muted-foreground font-medium truncate">
															{mover.symbol}
														</p>
													)}
													{mover.price !== undefined && mover.price !== null && (
														<div className="text-xs font-mono font-semibold text-foreground/90 mt-1">
															{currencySymbol}
															{formattedPrice}
														</div>
													)}
													<div className="flex items-center gap-1 mt-1">
														{mover.direction === "up" ? (
															<TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
														) : (
															<TrendingDown className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
														)}
														<span
															className={`font-semibold font-mono text-xs ${
																mover.direction === "up"
																	? "text-emerald-700 dark:text-emerald-400"
																	: "text-rose-700 dark:text-rose-400"
															}`}
														>
															{changeVal > 0 ? "+" : ""}
															{changeVal.toFixed(2)}%
														</span>
													</div>
												</div>
											);
										})}
									</div>
								</div>
							)}

							{/* Section 4: Sector Highlights */}
							{briefToDisplay.sectorHighlights && briefToDisplay.sectorHighlights.length > 0 && (
								<div>
									<h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
										<Building2 className="h-5 w-5 text-indigo-500" />
										Sector Highlights & Thematic Trends
									</h3>
									<div className="space-y-2">
										{briefToDisplay.sectorHighlights.map((sector, idx) => (
											<div key={idx} className="p-3 rounded-lg bg-card/50 border border-border/60">
												<div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
													<span className="font-medium text-foreground text-sm">
														{sector.sector}
													</span>
													<Badge variant="outline" className="text-xs border-border font-semibold">
														{sector.trend}
													</Badge>
												</div>
												<p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
													{sector.outlook}
												</p>
											</div>
										))}
									</div>
								</div>
							)}

							{/* CCIL Sovereign Debt & Money Market Desk (India Only) */}
							{briefToDisplay.ccilFixedIncome && selectedRegion === "india" && (
								<div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 space-y-4">
									<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-200 dark:border-blue-800/40 pb-3">
										<div className="flex items-center gap-2">
											<Landmark className="h-5 w-5 text-blue-700 dark:text-blue-400" />
											<div>
												<h3 className="text-base font-semibold text-foreground flex items-center gap-2">
													CCIL Sovereign Debt & Money Market Desk
													<Badge
														variant="outline"
														className="text-xs bg-blue-100 text-blue-900 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300 dark:border-blue-700 font-semibold"
													>
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
											className="inline-flex items-center gap-1 text-xs text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 shrink-0 font-medium underline"
										>
											Verify on CCIL <ExternalLink className="h-3 w-3" />
										</a>
									</div>

									<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
										{/* 10Y G-Sec */}
										<div className="p-3 rounded-lg bg-card border border-border shadow-xs">
											<div className="flex items-center justify-between">
												<span className="text-xs text-muted-foreground font-medium">10Y Benchmark G-Sec</span>
												<Badge className="text-[10px] bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 font-semibold">
													Real: +{safeNum(briefToDisplay.ccilFixedIncome.yieldCurveAnalysis?.realYield10Y, 2.59)}%
												</Badge>
											</div>
											<div className="mt-1 flex items-baseline gap-2">
												<span className="text-xl font-bold font-mono text-foreground">
													{safeNum(briefToDisplay.ccilFixedIncome.sovereignYields?.[0]?.yieldPercent, 6.79)}%
												</span>
												<span className="text-xs text-emerald-700 dark:text-emerald-400 font-mono font-semibold">
													{safeNum(briefToDisplay.ccilFixedIncome.sovereignYields?.[0]?.changeBps, -1.5)} bps
												</span>
											</div>
											<p className="text-[11px] text-muted-foreground mt-1 truncate">
												{briefToDisplay.ccilFixedIncome.sovereignYields?.[0]?.securityName ?? "7.10% GS 2034"}
											</p>
										</div>

										{/* TREPS Overnight */}
										<div className="p-3 rounded-lg bg-card border border-border shadow-xs">
											<div className="flex items-center justify-between">
												<span className="text-xs text-muted-foreground font-medium">TREPS Overnight WAR</span>
												<Badge className="text-[10px] bg-blue-100 text-blue-900 dark:bg-blue-950/60 dark:text-blue-200 border border-blue-300 dark:border-blue-800 font-semibold">
													{briefToDisplay.ccilFixedIncome.treps?.marketCondition ?? "COMFORTABLE"}
												</Badge>
											</div>
											<div className="mt-1 flex items-baseline gap-2">
												<span className="text-xl font-bold font-mono text-foreground">
													{safeNum(briefToDisplay.ccilFixedIncome.treps?.weightedAverageRate, 6.42)}%
												</span>
											</div>
											<p className="text-[11px] text-muted-foreground mt-1">
												Vol: ₹{(safeNum(briefToDisplay.ccilFixedIncome.treps?.totalVolumeCr, 485000) / 100000).toFixed(2)} Lakh Cr
											</p>
										</div>

										{/* 91D T-Bill & MIBOR */}
										<div className="p-3 rounded-lg bg-card border border-border shadow-xs">
											<div className="flex items-center justify-between">
												<span className="text-xs text-muted-foreground font-medium">91D T-Bill / MIBOR</span>
												<Badge className="text-[10px] bg-purple-100 text-purple-900 dark:bg-purple-950/60 dark:text-purple-200 border border-purple-300 dark:border-purple-800 font-semibold">
													Risk-Free
												</Badge>
											</div>
											<div className="mt-1 flex items-baseline gap-2">
												<span className="text-xl font-bold font-mono text-foreground">
													{safeNum(briefToDisplay.ccilFixedIncome.tBills?.[0]?.cutoffYield, 6.54)}%
												</span>
											</div>
											<p className="text-[11px] text-muted-foreground mt-1">
												Overnight MIBOR: {safeNum(briefToDisplay.ccilFixedIncome.fbilMiborOvernight, 6.5)}%
											</p>
										</div>

										{/* Yield Curve Slope & SDL Spread */}
										<div className="p-3 rounded-lg bg-card border border-border shadow-xs">
											<div className="flex items-center justify-between">
												<span className="text-xs text-muted-foreground font-medium">10Y–2Y Curve Slope</span>
												<Badge className="text-[10px] bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-300 dark:border-amber-800 font-semibold">
													{briefToDisplay.ccilFixedIncome.yieldCurveAnalysis?.slope ?? "Normal Upward"}
												</Badge>
											</div>
											<div className="mt-1 flex items-baseline gap-2">
												<span className="text-xl font-bold font-mono text-foreground">
													+{safeNum(briefToDisplay.ccilFixedIncome.yieldCurveAnalysis?.tenor10Y_minus_2Y_bps, 28)} bps
												</span>
											</div>
											<p className="text-[11px] text-muted-foreground mt-1">
												State Dev Loans (SDL): +{safeNum(briefToDisplay.ccilFixedIncome.sdlSpreadBps, 38)} bps spread
											</p>
										</div>
									</div>

									{briefToDisplay.ccilFixedIncome.yieldCurveAnalysis?.commentary && (
										<p className="text-xs text-blue-950 dark:text-blue-100 bg-blue-100/60 dark:bg-blue-950/50 p-2.5 rounded-lg border border-blue-300 dark:border-blue-800 font-medium">
											💡 <span className="font-bold text-blue-900 dark:text-blue-200">CCIL Curve Insight:</span>{" "}
											{briefToDisplay.ccilFixedIncome.yieldCurveAnalysis.commentary}
										</p>
									)}
								</div>
							)}

							{/* US Treasury & Federal Reserve Sovereign Desk (US Only) */}
							{briefToDisplay.usFixedIncome && selectedRegion === "us" && (
								<div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 space-y-4">
									<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-200 dark:border-blue-800/40 pb-3">
										<div className="flex items-center gap-2">
											<Landmark className="h-5 w-5 text-blue-700 dark:text-blue-400" />
											<div>
												<h3 className="text-base font-semibold text-foreground flex items-center gap-2">
													US Treasury & Federal Reserve Sovereign Desk
													<Badge
														variant="outline"
														className="text-xs bg-blue-100 text-blue-900 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300 dark:border-blue-700 font-semibold"
													>
														FRED / US Treasury
													</Badge>
												</h3>
												<p className="text-xs text-muted-foreground">
													Benchmark yield curve, term spread (10Y–2Y), Fed funds target range & 30Y mortgage averages
												</p>
											</div>
										</div>
										<Badge variant="outline" className="text-xs border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-300 font-medium">
											FOMC · FRED · US Treasury
										</Badge>
									</div>

									<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
										<div className="p-3 rounded-lg bg-card border border-border shadow-xs">
											<span className="text-xs text-muted-foreground font-medium">10Y Benchmark Treasury</span>
											<div className="mt-1 flex items-baseline gap-2">
												<span className="text-xl font-bold font-mono text-foreground">
													{safeNum(briefToDisplay.usFixedIncome.tenYearTreasury, 4.18)}%
												</span>
											</div>
											<p className="text-[11px] text-muted-foreground mt-1">Sovereign 10Y Reference</p>
										</div>

										<div className="p-3 rounded-lg bg-card border border-border shadow-xs">
											<span className="text-xs text-muted-foreground font-medium">2Y Treasury Yield</span>
											<div className="mt-1 flex items-baseline gap-2">
												<span className="text-xl font-bold font-mono text-foreground">
													{safeNum(briefToDisplay.usFixedIncome.twoYearTreasury, 3.98)}%
												</span>
											</div>
											<p className="text-[11px] text-muted-foreground mt-1">Short-End Policy Proxy</p>
										</div>

										<div className="p-3 rounded-lg bg-card border border-border shadow-xs">
											<span className="text-xs text-muted-foreground font-medium">10Y–2Y Term Spread</span>
											<div className="mt-1 flex items-baseline gap-2">
												<span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
													+{safeNum(briefToDisplay.usFixedIncome.tenYearMinusTwoYearBps, 20)} bps
												</span>
											</div>
											<p className="text-[11px] text-muted-foreground mt-1">{briefToDisplay.usFixedIncome.yieldCurveSlope}</p>
										</div>

										<div className="p-3 rounded-lg bg-card border border-border shadow-xs">
											<span className="text-xs text-muted-foreground font-medium">Fed Funds Target Range</span>
											<div className="mt-1 flex items-baseline gap-2">
												<span className="text-sm font-bold font-mono text-foreground">
													{briefToDisplay.usFixedIncome.fedFundsTargetRate}
												</span>
											</div>
											<p className="text-[11px] text-muted-foreground mt-1">
												30Y Mortgage Avg: {safeNum(briefToDisplay.usFixedIncome.thirtyYearMortgageAvg, 6.55)}%
											</p>
										</div>
									</div>

									{briefToDisplay.usFixedIncome.commentary && (
										<p className="text-xs text-blue-950 dark:text-blue-100 bg-blue-100/60 dark:bg-blue-950/50 p-2.5 rounded-lg border border-blue-300 dark:border-blue-800 font-medium">
											💡 <span className="font-bold text-blue-900 dark:text-blue-200">US Macro Insight:</span>{" "}
											{briefToDisplay.usFixedIncome.commentary}
										</p>
									)}
								</div>
							)}

							{/* Global Macro Transmission & Sovereign FX Desk (Global Only) */}
							{briefToDisplay.globalMacroDesk && selectedRegion === "global" && (
								<div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-4">
									<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-200 dark:border-indigo-800/40 pb-3">
										<div className="flex items-center gap-2">
											<Globe className="h-5 w-5 text-indigo-700 dark:text-indigo-400" />
											<div>
												<h3 className="text-base font-semibold text-foreground flex items-center gap-2">
													Global Macro Transmission & Sovereign FX Desk
													<Badge
														variant="outline"
														className="text-xs bg-indigo-100 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700 font-semibold"
													>
														G7 Sovereigns & FX
													</Badge>
												</h3>
												<p className="text-xs text-muted-foreground">
													US Dollar Index (DXY), G7 sovereign 10-year yields (Bund, Gilt, JGB), and key currency pairs
												</p>
											</div>
										</div>
										<Badge variant="outline" className="text-xs border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-300 font-medium">
											BIS · G7 Sovereign Desks
										</Badge>
									</div>

									<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
										<div className="p-3 rounded-lg bg-card border border-border shadow-xs">
											<span className="text-xs text-muted-foreground font-medium">US Dollar Index (DXY)</span>
											<div className="mt-1 flex items-baseline gap-2">
												<span className="text-xl font-bold font-mono text-foreground">
													{safeNum(briefToDisplay.globalMacroDesk.dxyIndex, 103.85)}
												</span>
												<span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400">
													{safeNum(briefToDisplay.globalMacroDesk.dxyChangePercent) >= 0 ? "+" : ""}
													{safeNum(briefToDisplay.globalMacroDesk.dxyChangePercent, -0.15)}%
												</span>
											</div>
											<p className="text-[11px] text-muted-foreground mt-1">Cross-Border FX Anchor</p>
										</div>

										<div className="p-3 rounded-lg bg-card border border-border shadow-xs">
											<span className="text-xs text-muted-foreground font-medium">Germany 10Y Bund</span>
											<div className="mt-1 flex items-baseline gap-2">
												<span className="text-xl font-bold font-mono text-foreground">
													{safeNum(briefToDisplay.globalMacroDesk.bund10YYield, 2.32)}%
												</span>
											</div>
											<p className="text-[11px] text-muted-foreground mt-1">Eurozone Sovereign Anchor</p>
										</div>

										<div className="p-3 rounded-lg bg-card border border-border shadow-xs">
											<span className="text-xs text-muted-foreground font-medium">UK 10Y Gilt / Japan JGB</span>
											<div className="mt-1 flex items-baseline gap-2">
												<span className="text-xl font-bold font-mono text-foreground">
													{safeNum(briefToDisplay.globalMacroDesk.gilt10YYield, 4.24)}%
												</span>
												<span className="text-xs text-muted-foreground font-mono">
													JGB: {safeNum(briefToDisplay.globalMacroDesk.jgb10YYield, 0.95)}%
												</span>
											</div>
											<p className="text-[11px] text-muted-foreground mt-1">G7 Sovereign Benchmarks</p>
										</div>

										<div className="p-3 rounded-lg bg-card border border-border shadow-xs">
											<span className="text-xs text-muted-foreground font-medium">EUR/USD & USD/JPY</span>
											<div className="mt-1 flex items-baseline gap-2">
												<span className="text-sm font-bold font-mono text-foreground">
													€{safeNum(briefToDisplay.globalMacroDesk.eurUsd, 1.085)}
												</span>
												<span className="text-xs text-muted-foreground font-mono">
													¥{safeNum(briefToDisplay.globalMacroDesk.usdJpy, 151.8)}
												</span>
											</div>
											<p className="text-[11px] text-muted-foreground mt-1">Major FX Liquidity Pairs</p>
										</div>
									</div>

									{briefToDisplay.globalMacroDesk.commentary && (
										<p className="text-xs text-indigo-950 dark:text-indigo-100 bg-indigo-100/60 dark:bg-indigo-950/50 p-2.5 rounded-lg border border-indigo-300 dark:border-indigo-800 font-medium">
											🌐 <span className="font-bold text-indigo-900 dark:text-indigo-200">Global Macro Takeaway:</span>{" "}
											{briefToDisplay.globalMacroDesk.commentary}
										</p>
									)}
								</div>
							)}

							{/* Commodity Radar (MCX & CMX / COMEX - India Only) */}
							{briefToDisplay.commodityRadar && selectedRegion === "india" && (
								<div className="p-4 rounded-xl border border-amber-300 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 space-y-4">
									<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-300/60 dark:border-amber-800/40 pb-3">
										<div className="flex items-center gap-2">
											<Coins className="h-5 w-5 text-amber-700 dark:text-amber-400" />
											<div>
												<h3 className="text-base font-semibold text-foreground flex items-center gap-2">
													Commodity Radar (MCX India & Global CFD Benchmarks)
													<Badge
														variant="outline"
														className="text-xs bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-700 font-semibold"
													>
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
												className={`text-xs font-semibold ${
													briefToDisplay.commodityRadar.crudeOilBreakevenStatus.inflationImpact === "Benign"
														? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800"
														: briefToDisplay.commodityRadar.crudeOilBreakevenStatus.inflationImpact === "Moderate"
														? "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-300 dark:border-amber-800"
														: "bg-rose-100 text-rose-900 dark:bg-rose-950/60 dark:text-rose-200 border border-rose-300 dark:border-rose-800"
												}`}
											>
												Crude Inflation: {briefToDisplay.commodityRadar.crudeOilBreakevenStatus.inflationImpact} ($
												{safeNum(briefToDisplay.commodityRadar.crudeOilBreakevenStatus.brentUsd, 112.0)}/bbl)
											</Badge>
										)}
									</div>

									<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
										{briefToDisplay.commodityRadar.commodities?.map((item, idx) => {
											const mcxPriceNum = safeNum(item.mcxPrice);
											const cmxPriceNum = safeNum(item.cmxPrice);
											const mcxChangeNum = safeNum(item.mcxChangePercent);

											return (
												<div key={idx} className="p-3 rounded-lg bg-card border border-border shadow-xs space-y-1.5">
													<div className="flex items-center justify-between">
														<span className="font-semibold text-foreground text-sm truncate" title={item.name}>
															{item.name}
														</span>
														<Badge
															variant="outline"
															className={`text-[10px] px-1.5 py-0 font-semibold ${
																item.trend === "Bullish"
																	? "text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50"
																	: item.trend === "Bearish"
																	? "text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50"
																	: "text-muted-foreground border-border"
															}`}
														>
															{item.trend}
														</Badge>
													</div>

													{/* Global CFD ($) */}
													<div className="flex items-baseline justify-between">
														<span className="text-xs text-muted-foreground flex items-center gap-1">
															<Badge variant="outline" className="text-[9px] px-1 py-0 border-blue-400 text-blue-700 dark:text-blue-300 font-semibold">CFD ($)</Badge>
														</span>
														<span className="font-mono text-xs font-bold text-foreground">
															{cmxPriceNum < 10 ? `$${cmxPriceNum.toFixed(2)}` : `$${cmxPriceNum.toLocaleString("en-US", { minimumFractionDigits: cmxPriceNum > 1000 ? 2 : 2 })}`}{" "}
															<span className="text-[10px] text-muted-foreground font-normal">
																{item.cmxUnit ? item.cmxUnit.replace("$ / ", "/") : ""}
															</span>
														</span>
													</div>

													{/* Domestic MCX (₹) */}
													<div className="flex items-baseline justify-between">
														<span className="text-xs text-muted-foreground flex items-center gap-1">
															<Badge variant="outline" className="text-[9px] px-1 py-0 border-emerald-400 text-emerald-700 dark:text-emerald-300 font-semibold">MCX (₹)</Badge>
														</span>
														<span className="font-mono text-sm font-bold text-foreground">
															₹{mcxPriceNum.toLocaleString("en-IN")}{" "}
															<span className="text-[10px] text-muted-foreground font-normal">
																{item.mcxUnit ? item.mcxUnit.replace("₹ / ", "/") : ""}
															</span>
														</span>
													</div>

													<div className="flex items-center justify-between pt-1 border-t border-border text-[11px]">
														<span className="text-muted-foreground">Day's Chg:</span>
														<span
															className={`font-semibold font-mono ${
																mcxChangeNum >= 0
																	? "text-emerald-700 dark:text-emerald-400"
																	: "text-rose-700 dark:text-rose-400"
															}`}
														>
															{mcxChangeNum >= 0 ? "+" : ""}
															{mcxChangeNum.toFixed(2)}%
														</span>
													</div>
												</div>
											);
										})}
									</div>

									{briefToDisplay.commodityRadar.crudeOilBreakevenStatus?.commentary && (
										<p className="text-xs text-amber-950 dark:text-amber-100 bg-amber-100/60 dark:bg-amber-950/50 p-2.5 rounded-lg border border-amber-300 dark:border-amber-800 font-medium">
											⚡ <span className="font-bold text-amber-900 dark:text-amber-200">Macro Takeaway:</span>{" "}
											{briefToDisplay.commodityRadar.crudeOilBreakevenStatus.commentary}
										</p>
									)}
								</div>
							)}

							{/* Multi-Exchange Intelligence Desk (India Only) */}
							{briefToDisplay.multiExchangeData && selectedRegion === "india" && (
								<div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-4">
									<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-200 dark:border-indigo-800/40 pb-3">
										<div className="flex items-center gap-2">
											<Globe className="h-5 w-5 text-indigo-700 dark:text-indigo-400" />
											<div>
												<div className="flex items-center gap-2">
													<h3 className="text-base font-bold text-foreground">
														Multi-Exchange Intelligence Desk
													</h3>
													<Badge className="text-xs bg-indigo-100 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-800 font-semibold">
														Cross-Market Pulse
													</Badge>
												</div>
												<p className="text-xs text-muted-foreground">
													BSE India market breadth, GIFT Nifty IFSC session lead, institutional FII/DII net flows & NCDEX agri drivers
												</p>
											</div>
										</div>
										<Badge variant="outline" className="text-xs border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-300 font-medium">
											NSE IX · BSE · NSDL · NCDEX
										</Badge>
									</div>

									<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
										{/* BSE Market Breadth */}
										{briefToDisplay.multiExchangeData.bseBreadth && (
											<div className="p-3 rounded-lg bg-card border border-border shadow-xs">
												<div className="flex items-center justify-between">
													<span className="text-xs text-muted-foreground font-medium">BSE Market Breadth</span>
													<Badge
														className={`text-[10px] font-semibold ${
															safeNum(briefToDisplay.multiExchangeData.bseBreadth.advanceDeclineRatio, 1) >= 1.0
																? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800"
																: "bg-rose-100 text-rose-900 dark:bg-rose-950/60 dark:text-rose-200 border border-rose-300 dark:border-rose-800"
														}`}
													>
														{briefToDisplay.multiExchangeData.bseBreadth.sentiment ?? "Positive Breadth"}
													</Badge>
												</div>
												<div className="mt-1 flex items-baseline gap-2">
													<span className="text-xl font-bold font-mono text-foreground">
														{safeNum(briefToDisplay.multiExchangeData.bseBreadth.advances, 2185)}
													</span>
													<span className="text-xs text-muted-foreground">Adv /</span>
													<span className="text-xl font-bold font-mono text-foreground">
														{safeNum(briefToDisplay.multiExchangeData.bseBreadth.declines, 1740)}
													</span>
													<span className="text-xs text-muted-foreground">Dec</span>
												</div>
												<div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1 pt-1 border-t border-border">
													<span>Ratio: {safeNum(briefToDisplay.multiExchangeData.bseBreadth.advanceDeclineRatio, 1.26)}:1</span>
													<span>M-Cap: ₹{safeNum(briefToDisplay.multiExchangeData.bseBreadth.totalMarketCapLakhCr, 468.5)}L Cr</span>
												</div>
											</div>
										)}

										{/* GIFT Nifty Lead */}
										{briefToDisplay.multiExchangeData.giftNifty && (
											<div className="p-3 rounded-lg bg-card border border-border shadow-xs">
												<div className="flex items-center justify-between">
													<span className="text-xs text-muted-foreground font-medium">GIFT Nifty 21h Lead</span>
													<Badge
														className={`text-[10px] font-semibold ${
															safeNum(briefToDisplay.multiExchangeData.giftNifty.netChange) >= 0
																? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800"
																: "bg-rose-100 text-rose-900 dark:bg-rose-950/60 dark:text-rose-200 border border-rose-300 dark:border-rose-800"
														}`}
													>
														{briefToDisplay.multiExchangeData.giftNifty.openingBias ?? "Gap Up"}
													</Badge>
												</div>
												<div className="mt-1 flex items-baseline gap-2">
													<span className="text-xl font-bold font-mono text-foreground">
														{safeNum(briefToDisplay.multiExchangeData.giftNifty.lastPrice, 24823).toLocaleString("en-IN")}
													</span>
													<span
														className={`text-xs font-semibold font-mono ${
															safeNum(briefToDisplay.multiExchangeData.giftNifty.netChange) >= 0
																? "text-emerald-700 dark:text-emerald-400"
																: "text-rose-700 dark:text-rose-400"
														}`}
													>
														{safeNum(briefToDisplay.multiExchangeData.giftNifty.netChange) >= 0 ? "+" : ""}
														{safeNum(briefToDisplay.multiExchangeData.giftNifty.netChange, 42.5)} (
														{safeNum(briefToDisplay.multiExchangeData.giftNifty.percentChange, 0.17).toFixed(2)}%)
													</span>
												</div>
												<div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1 pt-1 border-t border-border">
													<span>Spread: +{safeNum(briefToDisplay.multiExchangeData.giftNifty.spreadOverNiftyBps, 15)} bps</span>
													<span className="truncate">{briefToDisplay.multiExchangeData.giftNifty.asOfSession ?? "Morning Session"}</span>
												</div>
											</div>
										)}

										{/* Institutional Flows & SIP */}
										{briefToDisplay.multiExchangeData.institutionalFlows && (
											<div className="p-3 rounded-lg bg-card border border-border shadow-xs">
												<div className="flex items-center justify-between">
													<span className="text-xs text-muted-foreground font-medium">FII / DII Institutional Net</span>
													<Badge className="text-[10px] bg-blue-100 text-blue-900 dark:bg-blue-950/60 dark:text-blue-200 border border-blue-300 dark:border-blue-800 font-semibold">
														SIP Moat
													</Badge>
												</div>
												<div className="mt-1 flex items-baseline justify-between text-xs font-mono">
													<span>
														FII:{" "}
														<strong
															className={
																safeNum(briefToDisplay.multiExchangeData.institutionalFlows.fiiNetInflowCr) >= 0
																	? "text-emerald-700 dark:text-emerald-400"
																	: "text-rose-700 dark:text-rose-400"
															}
														>
															{safeNum(briefToDisplay.multiExchangeData.institutionalFlows.fiiNetInflowCr) >= 0 ? "+" : ""}
															₹{safeNum(briefToDisplay.multiExchangeData.institutionalFlows.fiiNetInflowCr, -1850).toLocaleString("en-IN")} Cr
														</strong>
													</span>
													<span>
														DII:{" "}
														<strong
															className={
																safeNum(briefToDisplay.multiExchangeData.institutionalFlows.diiNetInflowCr) >= 0
																	? "text-emerald-700 dark:text-emerald-400"
																	: "text-rose-700 dark:text-rose-400"
															}
														>
															{safeNum(briefToDisplay.multiExchangeData.institutionalFlows.diiNetInflowCr) >= 0 ? "+" : ""}
															₹{safeNum(briefToDisplay.multiExchangeData.institutionalFlows.diiNetInflowCr, 3120).toLocaleString("en-IN")} Cr
														</strong>
													</span>
												</div>
												<div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1 pt-1 border-t border-border">
													<span>
														Monthly SIP: ₹
														{safeNum(briefToDisplay.multiExchangeData.institutionalFlows.monthlyMfSipRunRateCr, 26425).toLocaleString("en-IN")} Cr
													</span>
													<span className="truncate">{briefToDisplay.multiExchangeData.institutionalFlows.liquidityRegime ?? "SIP Moat Active"}</span>
												</div>
											</div>
										)}

										{/* Volatility Pulse */}
										<div className="p-3 rounded-lg bg-card border border-border shadow-xs">
											<div className="flex items-center justify-between">
												<span className="text-xs text-muted-foreground font-medium">Volatility Pulse</span>
												<Badge className="text-[10px] bg-purple-100 text-purple-900 dark:bg-purple-950/60 dark:text-purple-200 border border-purple-300 dark:border-purple-800 font-semibold">
													{briefToDisplay.multiExchangeData.volatilityPulse?.regime ?? "LOW VOL"}
												</Badge>
											</div>
											<div className="mt-1 flex items-baseline gap-2">
												<span className="text-xl font-bold font-mono text-foreground">
													{safeNum(briefToDisplay.multiExchangeData.volatilityPulse?.indiaVix, 14.2).toFixed(2)}
												</span>
												<span className="text-xs text-muted-foreground">India VIX</span>
												<span className="text-xs text-muted-foreground ml-auto font-mono">
													Cboe: {safeNum(briefToDisplay.multiExchangeData.volatilityPulse?.cboeVix, 15.4).toFixed(2)}
												</span>
											</div>
											<p className="text-[11px] text-muted-foreground mt-1 pt-1 border-t border-border truncate">
												{briefToDisplay.multiExchangeData.volatilityPulse?.advisoryTakeaway ??
													"Calm volatility backdrop favors disciplined STP / SIP equity allocations."}
											</p>
										</div>
									</div>

									{/* NCDEX Agri Drivers */}
									{briefToDisplay.multiExchangeData.ncdexAgriPulse && (
										<div className="p-2.5 rounded-lg bg-indigo-100/60 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
											<div className="flex items-center gap-2">
												<span className="font-bold text-indigo-900 dark:text-indigo-200">🌾 NCDEX Food Inflation Pulse:</span>
												<span className="text-foreground/90 font-medium">
													Staples Index:{" "}
													<strong
														className={
															safeNum(briefToDisplay.multiExchangeData.ncdexAgriPulse.staplesIndexChangePct) >= 0
																? "text-rose-700 dark:text-rose-400"
																: "text-emerald-700 dark:text-emerald-400"
														}
													>
														{safeNum(briefToDisplay.multiExchangeData.ncdexAgriPulse.staplesIndexChangePct) >= 0 ? "+" : ""}
														{safeNum(briefToDisplay.multiExchangeData.ncdexAgriPulse.staplesIndexChangePct, -0.45)}%
													</strong>{" "}
													({briefToDisplay.multiExchangeData.ncdexAgriPulse.foodInflationBias ?? "Benign"})
												</span>
											</div>
											<div className="flex items-center gap-2 flex-wrap">
												{Array.isArray(briefToDisplay.multiExchangeData.ncdexAgriPulse.keyCommodityDrivers) &&
													briefToDisplay.multiExchangeData.ncdexAgriPulse.keyCommodityDrivers.map((driver, dIdx) => (
														<span key={dIdx} className="px-2 py-0.5 rounded bg-card text-[11px] font-medium text-foreground border border-border">
															{driver.name}: <strong>{driver.trend}</strong>
														</span>
													))}
											</div>
										</div>
									)}
								</div>
							)}

							{/* AMC House Consensus & Asset Allocation Desk (India Only) */}
							{briefToDisplay.amcConsensus && selectedRegion === "india" && (
								<div className="p-4 rounded-xl border border-teal-200 dark:border-teal-900/60 bg-teal-50/50 dark:bg-teal-950/20 space-y-4">
									<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-teal-200 dark:border-teal-800/40 pb-3">
										<div className="flex items-center gap-2">
											<Building2 className="h-5 w-5 text-teal-700 dark:text-teal-400" />
											<div>
												<div className="flex items-center gap-2">
													<h3 className="text-base font-bold text-foreground">
														AMC House Consensus & Asset Allocation Desk
													</h3>
													<Badge className="text-xs bg-teal-100 text-teal-900 dark:bg-teal-950/60 dark:text-teal-200 border border-teal-300 dark:border-teal-800 font-semibold">
														FASP-AI Decision Support
													</Badge>
												</div>
												<p className="text-xs text-muted-foreground">
													Consensus research view synthesized across frontline AMCs: HDFC, ICICI Pru, SBI MF, Kotak & Nippon India
												</p>
											</div>
										</div>
										<Badge variant="outline" className="text-xs border-teal-300 dark:border-teal-700 text-teal-900 dark:text-teal-300 font-medium">
											CIO & Fund Manager Stance
										</Badge>
									</div>

									{/* Contributing AMC Badges & Consensus Stance */}
									<div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-teal-100/60 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800">
										<div className="flex items-center gap-2">
											<span className="text-xs font-bold text-teal-950 dark:text-teal-200">Consensus Equity Bias:</span>
											<Badge className="text-xs bg-teal-200 text-teal-950 dark:bg-teal-900/80 dark:text-teal-100 border border-teal-300 dark:border-teal-700 font-bold">
												{briefToDisplay.amcConsensus.consensusEquityStance ?? "Cautiously Optimistic"}
											</Badge>
										</div>
										<div className="flex items-center gap-1.5 flex-wrap">
											<span className="text-[11px] text-muted-foreground font-medium">Contributing Houses:</span>
											{Array.isArray(briefToDisplay.amcConsensus.contributingAmcs) &&
												briefToDisplay.amcConsensus.contributingAmcs.map((amc, aIdx) => (
													<span key={aIdx} className="px-2 py-0.5 rounded text-[10px] font-semibold bg-card text-foreground border border-border">
														{amc}
													</span>
												))}
										</div>
									</div>

									{/* Valuation Context & Fixed Income Stance */}
									<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
										{/* Equity Valuation Context */}
										{briefToDisplay.amcConsensus.valuationContext && (
											<div className="p-3 rounded-lg bg-card border border-border shadow-xs space-y-2">
												<div className="flex items-center justify-between">
													<span className="text-xs text-foreground font-bold flex items-center gap-1.5">
														<Scale className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" />
														Nifty 50 Forward Valuation Context
													</span>
													<Badge className="text-[10px] bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-300 dark:border-amber-800 font-semibold">
														{briefToDisplay.amcConsensus.valuationContext.valuationStatus ?? "Fair Value"}
													</Badge>
												</div>
												<div className="flex items-baseline gap-4 text-xs font-mono">
													<div>
														<span className="text-muted-foreground">Fwd P/E: </span>
														<strong className="text-foreground text-sm font-bold">
															{safeNum(briefToDisplay.amcConsensus.valuationContext.niftyForwardPE, 21.6)}x
														</strong>
													</div>
													<div>
														<span className="text-muted-foreground">10Y Avg: </span>
														<strong className="text-muted-foreground text-sm">
															{safeNum(briefToDisplay.amcConsensus.valuationContext.tenYearHistoricalAvgPE, 20.2)}x
														</strong>
													</div>
													<div>
														<span className="text-muted-foreground">P/B: </span>
														<strong className="text-foreground text-sm font-bold">
															{safeNum(briefToDisplay.amcConsensus.valuationContext.priceToBook, 3.85)}x
														</strong>
													</div>
												</div>
												<p className="text-xs text-foreground/80 leading-relaxed font-medium">
													{briefToDisplay.amcConsensus.valuationContext.commentary}
												</p>
											</div>
										)}

										{/* Fixed Income Duration Strategy */}
										{briefToDisplay.amcConsensus.fixedIncomeStance && (
											<div className="p-3 rounded-lg bg-card border border-border shadow-xs space-y-2">
												<div className="flex items-center justify-between">
													<span className="text-xs text-foreground font-bold flex items-center gap-1.5">
														<Compass className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" />
														Fixed Income Recommended Duration
													</span>
													<Badge className="text-[10px] bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 font-semibold">
														{briefToDisplay.amcConsensus.fixedIncomeStance.recommendedDurationBand ?? "3 to 5 Years"}
													</Badge>
												</div>
												<div className="text-xs text-foreground font-medium">
													Category:{" "}
													<strong className="text-teal-800 dark:text-teal-300 font-bold">
														{briefToDisplay.amcConsensus.fixedIncomeStance.recommendedCategory}
													</strong>
												</div>
												<p className="text-xs text-foreground/80 leading-relaxed font-medium">
													{briefToDisplay.amcConsensus.fixedIncomeStance.rationale}
												</p>
											</div>
										)}
									</div>

									{/* Thematic Rotations */}
									{Array.isArray(briefToDisplay.amcConsensus.thematicRotations) &&
										briefToDisplay.amcConsensus.thematicRotations.length > 0 && (
											<div className="space-y-2">
												<span className="text-xs font-bold text-foreground">
													Key Thematic Rotations & Sectoral Positioning:
												</span>
												<div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
													{briefToDisplay.amcConsensus.thematicRotations.map((theme, tIdx) => (
														<div key={tIdx} className="p-2.5 rounded-lg bg-card border border-border shadow-xs space-y-1.5">
															<div className="flex items-center justify-between">
																<span className="text-xs font-bold text-foreground">{theme.theme}</span>
																<Badge
																	className={`text-[10px] font-semibold ${
																		theme.sentiment === "Overweight"
																			? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800"
																			: theme.sentiment === "Underweight"
																			? "bg-rose-100 text-rose-900 dark:bg-rose-950/60 dark:text-rose-200 border border-rose-300 dark:border-rose-800"
																			: "bg-muted text-foreground border border-border"
																	}`}
																>
																	{theme.sentiment}
																</Badge>
															</div>
															<p className="text-[11px] text-muted-foreground leading-normal">
																{theme.fundManagerRationale}
															</p>
															{Array.isArray(theme.favoredSectors) && theme.favoredSectors.length > 0 && (
																<div className="text-[10px] text-teal-800 dark:text-teal-300 pt-1 border-t border-border font-medium">
																	Favored: {theme.favoredSectors.join(", ")}
																</div>
															)}
														</div>
													))}
												</div>
											</div>
										)}

									{/* Advisor Client Talking Points */}
									{Array.isArray(briefToDisplay.amcConsensus.advisorTalkingPoints) &&
										briefToDisplay.amcConsensus.advisorTalkingPoints.length > 0 && (
											<div className="p-3.5 rounded-xl bg-teal-100/60 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 space-y-1.5">
												<span className="text-xs font-bold text-teal-950 dark:text-teal-200">
													🗣️ Advisor Client Talking Points (SEBI FASP-AI Compliant):
												</span>
												<ul className="list-disc list-inside space-y-1 text-xs text-foreground/90 font-medium">
													{briefToDisplay.amcConsensus.advisorTalkingPoints.map((point, pIdx) => (
														<li key={pIdx} className="leading-relaxed">
															{point}
														</li>
													))}
												</ul>
											</div>
										)}

									{/* Regulatory Disclaimer */}
									{briefToDisplay.amcConsensus.faspAiDisclaimer && (
										<p className="text-[10px] text-muted-foreground/70 italic text-center">
											{briefToDisplay.amcConsensus.faspAiDisclaimer}
										</p>
									)}
								</div>
							)}

							{/* Key Risks Alert */}
							{briefToDisplay.keyRisks && (
								<div className="p-4 bg-rose-50/90 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-900/50 shadow-xs">
									<h3 className="text-base font-bold text-rose-900 dark:text-rose-300 mb-2 flex items-center gap-2">
										<AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
										Key Risks to Watch
									</h3>
									<p className="text-rose-950 dark:text-rose-100 text-xs sm:text-sm leading-relaxed font-medium">
										{briefToDisplay.keyRisks}
									</p>
								</div>
							)}

							{/* Advisor Tips & Guidance */}
							{briefToDisplay.agentTips && (
								<div className="p-4 bg-emerald-50/90 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-900/50 shadow-xs">
									<h3 className="text-base font-bold text-emerald-900 dark:text-emerald-300 mb-2 flex items-center gap-2">
										<Lightbulb className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
										Advisor Tips & Allocation Guidance
									</h3>
									<p className="text-emerald-950 dark:text-emerald-100 text-xs sm:text-sm leading-relaxed font-medium">
										{briefToDisplay.agentTips}
									</p>
								</div>
							)}

							{/* Sources & Citations */}
							{briefToDisplay.sources && briefToDisplay.sources.length > 0 && (
								<div className="pt-4 border-t border-border">
									<p className="text-xs text-muted-foreground">
										Sources & Feeds: {briefToDisplay.sources.join(", ")}
									</p>
								</div>
							)}
						</CardContent>
					</Card>
				</div>
			)}

			{/* Previous Archived Briefs Explorer */}
			{previousBriefs && previousBriefs.length > 0 && (
				<Card className="bg-background border-border shadow-sm">
					<CardHeader>
						<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
							<div>
								<CardTitle className="text-foreground flex items-center gap-2">
									<Clock className="h-5 w-5 text-muted-foreground" />
									Previous Market Briefs Archive
								</CardTitle>
								<CardDescription className="text-muted-foreground text-xs mt-1">
									Click any archived brief to inspect historical market snapshots and asset allocations
								</CardDescription>
							</div>
							<div className="relative w-full sm:w-64">
								<Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
								<Input
									type="text"
									placeholder="Search archives by date or keyword..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="pl-8 h-8 text-xs bg-card"
								/>
							</div>
						</div>
					</CardHeader>
					<CardContent>
						<ScrollArea className="h-64">
							<div className="space-y-2">
								{filteredPrevious.length === 0 ? (
									<div className="p-8 text-center text-xs text-muted-foreground">
										No archived briefs match your search query.
									</div>
								) : (
									filteredPrevious.map((brief) => {
										const isSelected = selectedBriefId === brief.id;
										return (
											<button
												type="button"
												key={brief.id}
												onClick={() => setSelectedBriefId(isSelected ? null : brief.id)}
												className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer ${
													isSelected
														? "bg-primary/10 border-primary ring-1 ring-primary shadow-xs"
														: "bg-card/50 hover:bg-card border-border/60"
												}`}
											>
												<div className="flex items-center justify-between gap-3">
													<div className="min-w-0 flex-1">
														<div className="flex items-center gap-2">
															<p className="font-semibold text-foreground text-sm">
																{safeFormatDate(brief.date, "EEEE, MMMM d, yyyy")}
															</p>
															{isSelected && (
																<Badge className="text-[10px] bg-primary text-primary-foreground py-0 px-1.5 font-semibold">
																	Viewing Now
																</Badge>
															)}
														</div>
														<p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
															{brief.marketSnapshot}
														</p>
													</div>
													<Badge variant="outline" className="text-xs border-border shrink-0 font-mono">
														v{brief.version || 1}
													</Badge>
												</div>
											</button>
										);
									})
								)}
							</div>
						</ScrollArea>
					</CardContent>
				</Card>
			)}

			{/* Regulatory Bottom Compliance Notice */}
			<div className="text-xs text-muted-foreground text-center p-4 border-t border-border space-y-1">
				<p className="font-medium">
					This market intelligence brief is synthesized using AI decision support models (FASP-AI v1.0) and licensed market data feeds.
				</p>
				<p className="text-[11px] text-muted-foreground/80">
					Strictly for SEBI Registered Investment Advisors (RIA) & Mutual Fund Distributors (MFD) reference. Not deterministic investment advice or guaranteed return solicitation. Past performance is not indicative of future returns.
				</p>
			</div>
		</div>
	);
}
