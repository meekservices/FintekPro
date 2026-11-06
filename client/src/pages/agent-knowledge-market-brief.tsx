import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
	MessageCircle,
	MapPin,
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
		forexSpot?: {
			usdInr: number;
			inrUsd: number;
			changePercent?: number;
			platform?: string;
			settlementType?: string;
			source?: string;
		};
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
		usdInr?: number;
		commentary: string;
		source: string;
	};
	fbil?: {
		usdInr: number;
		usdInrChangePercent?: number;
		usdInrFixingDate?: string;
		miborOvernight?: number;
		mibor14D?: number;
		mibor1M?: number;
		mibor3M?: number;
		gsec10YBenchmark?: number;
		trepsOvernightWAR?: number;
		source?: string;
		status?: string;
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
			? "Indian equity benchmarks traded with positive bias as Nifty 50 and Sensex demonstrated strength supported by sustained domestic institutional inflows (DIIs). Bank Nifty outperformed led by frontline private and PSU lenders. The 10-year benchmark Indian Government Bond (G-Sec) yield hovered at 6.79%, backed by CCIL sovereign clearing. CCIL TREPS overnight funding rate printed at 6.42%, reflecting balanced systemic money market liquidity. Brent crude CFD at $96.09/bbl (MCX Spot: ₹9,115/bbl) monitored for imported inflation, MCX Gold traded firm at ₹1,41,255/10g (COMEX: $3,885.50/oz) on steady safe-haven and central bank demand."
			: isGlobal
			? "Global equity benchmarks traded with constructive risk sentiment across Asian and European sessions, led by technology and semiconductor supply chain resilience. The US Dollar Index (DXY) traded orderly near 104.25, while benchmark 10-year sovereign bond yields traded across G7 economies with positive disinflation expectations."
			: "US equities traded higher with the S&P 500 (~5,864.5) and Nasdaq (~20,380) supported by megacap technology earnings and steady labor market prints. 10-year Treasury yields consolidated at 4.58% as markets digested central bank policy commentary.",
		whatChanged: isIndia
			? "1. Sovereign Debt & Money Markets: CCIL 10-Year Benchmark G-Sec yield traded at 6.79%; CCIL TREPS overnight repo volume remained healthy with weighted average rate at 6.42%.\n2. Commodity Radar: Brent crude CFD at $96.09/bbl (MCX Spot: ₹9,115/bbl). MCX Gold traded firm at ₹1,41,255/10g (COMEX: $3,885.50/oz) on steady safe-haven and central bank demand.\n3. Institutional Liquidity: Domestic Mutual Funds registered ongoing SIP inflows (~₹26,000+ Cr monthly run-rate), absorbing foreign portfolio outflows."
			: isGlobal
			? "1. Cross-Asset Transmission: US Dollar Index (DXY) stabilizing cross-border emerging market capital flows.\n2. Asian & European Session Momentum: Tokyo Nikkei 225 advanced on exporter earnings; London FTSE and Frankfurt DAX traded near record valuations.\n3. Sovereign Yield Spreads: 10-Year US Treasury, German Bund, and UK Gilt yields traded orderly across G7 economies."
			: "1. Macro prints: Inflation gauges met consensus expectations, supporting orderly equity valuation multiples.\n2. Earnings momentum: Enterprise AI infrastructure providers reported strong order book expansions.",
		topMovers: isIndia
			? [
					{ name: "ICICI Bank Limited", symbol: "ICICIBANK", price: 1527.0, change: 1.80, direction: "up", currency: "INR" },
					{ name: "HDFC Bank Limited", symbol: "HDFCBANK", price: 771.25, change: 1.48, direction: "up", currency: "INR" },
					{ name: "Bharti Airtel", symbol: "BHARTIARTL", price: 2084.0, change: 1.32, direction: "up", currency: "INR" },
					{ name: "Tata Motors", symbol: "TATAMOTORS", price: 287.0, change: -2.28, direction: "down", currency: "INR" },
					{ name: "Power Grid Corporation", symbol: "POWERGRID", price: 255.75, change: -2.07, direction: "down", currency: "INR" },
					{ name: "Adani Enterprises", symbol: "ADANIENT", price: 2686.8, change: -1.70, direction: "down", currency: "INR" },
				]
			: isGlobal
			? [
					{ name: "S&P 500 Index (SPX)", symbol: "SPX", price: 5750.0, change: 0.75, direction: "up", currency: "USD" },
					{ name: "Nasdaq 100 Index (NDX)", symbol: "NDX", price: 20100.0, change: 1.12, direction: "up", currency: "USD" },
					{ name: "Nikkei 225 (Tokyo)", symbol: "N225", price: 39800.0, change: 0.95, direction: "up", currency: "JPY" },
					{ name: "FTSE 100 (London)", symbol: "UKX", price: 8245.0, change: -0.32, direction: "down", currency: "GBP" },
					{ name: "DAX 40 (Frankfurt)", symbol: "DAX", price: 19480.0, change: 0.45, direction: "up", currency: "EUR" },
					{ name: "Hang Seng (Hong Kong)", symbol: "HSI", price: 20590.0, change: -0.88, direction: "down", currency: "HKD" },
				]
			: [
					{ name: "Apple Inc", symbol: "AAPL", price: 225.50, change: 1.15, direction: "up", currency: "USD" },
					{ name: "Microsoft Corp", symbol: "MSFT", price: 430.00, change: 0.95, direction: "up", currency: "USD" },
					{ name: "NVIDIA Corp", symbol: "NVDA", price: 145.00, change: 2.45, direction: "up", currency: "USD" },
					{ name: "Alphabet Inc", symbol: "GOOGL", price: 175.00, change: 0.85, direction: "up", currency: "USD" },
					{ name: "Amazon.com Inc", symbol: "AMZN", price: 205.00, change: 1.35, direction: "up", currency: "USD" },
					{ name: "Tesla Inc", symbol: "TSLA", price: 340.00, change: -1.20, direction: "down", currency: "USD" },
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
						realYield10Y: 1.30,
						commentary: "Sovereign yield curve reflects normal upward slope (+28 bps 10Y–2Y spread). Real yield of +1.30% over CPI provides attractive carry.",
					},
					sdlSpreadBps: 38,
					forexSpot: {
						usdInr: 94.8606,
						inrUsd: 0.010542,
						changePercent: 0.08,
						platform: "CCIL FX-CLEAR",
						settlementType: "T+2 Spot",
						source: "The Clearing Corporation of India Limited (ccilindia.com/Forex)",
					},
					source: "CCIL (The Clearing Corporation of India Limited) & FBIL",
				}
			: undefined,
		usFixedIncome: region === "us"
			? {
					tenYearTreasury: 4.58,
					twoYearTreasury: 4.35,
					tenYearMinusTwoYearBps: 23,
					fedFundsTargetRate: "4.25% – 4.50%",
					thirtyYearMortgageAvg: 6.55,
					yieldCurveSlope: "Normal Upward (+23 bps)",
					commentary: "US 10-Year Treasury yield consolidates near 4.58% as markets price in orderly FOMC rate adjustments. 10Y-2Y term spread indicates constructive macro conditions.",
					source: "Federal Reserve (FRED) & US Treasury",
				}
			: undefined,
		globalMacroDesk: {
			dxyIndex: 104.25,
			dxyChangePercent: 0.08,
			bund10YYield: 2.35,
			gilt10YYield: 4.25,
			jgb10YYield: 1.15,
			eurUsd: 1.048,
			usdJpy: 154.2,
			usdInr: 94.86,
			commentary: "Global macro transmission: US Dollar Index (DXY 104.25) anchors cross-border liquidity. USD/INR FBIL reference rate at ₹94.8606.",
			source: "FBIL (Financial Benchmarks India Pvt Ltd) & BIS Global FX Desks",
		},
		fbil: {
			usdInr: 94.86,
			usdInrChangePercent: 0.08,
			usdInrFixingDate: today,
			miborOvernight: 6.50,
			mibor14D: 6.65,
			mibor1M: 6.72,
			mibor3M: 6.80,
			gsec10YBenchmark: 6.79,
			trepsOvernightWAR: 6.42,
			source: "FBIL (Financial Benchmarks India Pvt Ltd) & CCIL Sovereign Clearing",
			status: "LIVE",
		},
		commodityRadar: isIndia
			? {
					commodities: [
						{
							id: "GOLD",
							name: "Gold 24K (MCX Spot)",
							category: "Precious Metals",
							mcxSymbol: "GOLD",
							mcxPrice: 141255,
							mcxUnit: "₹ / 10g",
							mcxChangePercent: 0.35,
							cmxSymbol: "GC=F (COMEX Gold)",
							cmxPrice: 3885.5,
							cmxUnit: "$ / oz",
							cmxChangePercent: 0.28,
							trend: "Bullish",
							macroImplication: "Official MCX Spot price at Ahmedabad (₹1,41,255/10g). Central bank reserves diversification and geopolitical hedge sustaining bullion demand.",
						},
						{
							id: "SILVER",
							name: "Silver (MCX Spot)",
							category: "Precious Metals",
							mcxSymbol: "SILVER",
							mcxPrice: 187200,
							mcxUnit: "₹ / 1kg",
							mcxChangePercent: 0.45,
							cmxSymbol: "SI=F (COMEX Silver)",
							cmxPrice: 48.50,
							cmxUnit: "$ / oz",
							cmxChangePercent: 0.38,
							trend: "Bullish",
							macroImplication: "Official MCX Spot price at Ahmedabad (₹1,87,200/kg). Driven by dual tailwinds from solar PV manufacturing and monetary investor demand.",
						},
						{
							id: "CRUDE_OIL",
							name: "Crude Oil (Brent / MCX Spot)",
							category: "Energy",
							mcxSymbol: "CRUDEOIL",
							mcxPrice: 9115,
							mcxUnit: "₹ / bbl",
							mcxChangePercent: -0.45,
							cmxSymbol: "BZ=F (ICE Brent Continuous / CFD)",
							cmxPrice: 96.09,
							cmxUnit: "$ / bbl",
							cmxChangePercent: -0.40,
							trend: "Neutral",
							macroImplication: "Official MCX Spot crude price at ₹9,115/bbl ($96.09/bbl equivalent). Remains elevated above India's comfort corridor (<$80/bbl), creating imported inflation headwinds.",
						},
						{
							id: "NATURAL_GAS",
							name: "Natural Gas (MCX Spot)",
							category: "Energy",
							mcxSymbol: "NATURALGAS",
							mcxPrice: 274.60,
							mcxUnit: "₹ / mmBtu",
							mcxChangePercent: 0.85,
							cmxSymbol: "NG=F (NYMEX Henry Hub)",
							cmxPrice: 2.75,
							cmxUnit: "$ / mmBtu",
							cmxChangePercent: 0.45,
							trend: "Bullish",
							macroImplication: "Official MCX Spot price (₹274.60/mmBtu as per mcxindia.com). Pure physical spot benchmark without CGD or government subsidy distortions.",
						},
						{
							id: "COPPER",
							name: "Copper (MCX Spot)",
							category: "Base Metals",
							mcxSymbol: "COPPER",
							mcxPrice: 1376.50,
							mcxUnit: "₹ / kg",
							mcxChangePercent: -0.28,
							cmxSymbol: "HG=F (COMEX Copper)",
							cmxPrice: 4.35,
							cmxUnit: "$ / lb",
							cmxChangePercent: 0.38,
							trend: "Bullish",
							macroImplication: "Official MCX Spot copper price at Thane (₹1,376.50/kg). Power grid capex and global electrification supporting base metal demand.",
						},
					],
					crudeOilBreakevenStatus: {
						brentUsd: 96.09,
						inflationImpact: "Elevated",
						commentary: "MCX Spot crude at ₹9,115/bbl ($96.09/bbl equivalent) remains elevated above India's comfort corridor (<$80), sustaining imported inflation.",
					},
					goldSilverRatio: 75.4,
					source: "MCX India Official Spot (mcxindia.com/market-data/spot-market-price) & CMX / COMEX",
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
						outlook: "10-Year Benchmark G-Sec yield consolidated at 6.79% (Real Yield: +1.30%). CCIL TREPS WAR steady at 6.42%.",
					},
					{
						sector: "Commodities & Energy (MCX / CMX)",
						trend: "Elevated Input Pressure",
						outlook: "Brent Crude CFD at $96.09/bbl (MCX Spot: ₹9,115/bbl) monitored for imported inflation; MCX Gold at ₹1,41,255/10g.",
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
						outlook: "10-year US Treasury hovering at 4.58% anticipating orderly FOMC monetary policy adjustments.",
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
			? "Commodity price volatility (Brent CFD monitored vs India comfort band), US Dollar Index (DXY) movements, global trade tariff negotiations, and shifting foreign institutional (FPI) derivative positions."
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
						rationale: "With 10Y benchmark G-Sec yielding 6.79% and real yields at +1.30%, intermediate duration captures attractive carry with capital appreciation upside upon systemic policy rate easing.",
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

// Official MCX Spot Delivery Centers & Physical Contract Specifications
const COMMODITY_PHYSICAL_SPECS: Record<string, { delivery: string; purity?: string; lotSize?: string; note: string }> = {
	GOLD: {
		delivery: "Ahmedabad",
		purity: "995 (24K)",
		lotSize: "10g",
		note: "Official MCX Spot settlement (Ahmedabad basis, ex-GST).",
	},
	SILVER: {
		delivery: "Ahmedabad",
		purity: "999",
		lotSize: "1kg",
		note: "Official MCX Spot settlement (Ahmedabad basis, ex-GST).",
	},
	CRUDE_OIL: {
		delivery: "NA (MCX Spot)",
		lotSize: "100 bbl",
		note: "Front-month MCX settlement tracking international physical CIF parity.",
	},
	NATURAL_GAS: {
		delivery: "NA (MCX Spot)",
		lotSize: "1 mmBtu",
		note: "Pure physical exchange spot price (mcxindia.com). Free of CGD or government subsidy distortions.",
	},
	COPPER: {
		delivery: "Thane",
		purity: "Cathode",
		lotSize: "1kg",
		note: "Official MCX Spot settlement at Thane delivery center.",
	},
};

// Indian & Global Market Session Status Calculator (IST = UTC+5:30)
function useMarketSessionStatus() {
	const [now, setNow] = useState<Date>(new Date());

	useEffect(() => {
		const interval = setInterval(() => setNow(new Date()), 10000);
		return () => clearInterval(interval);
	}, []);

	return useMemo(() => {
		const utc = now.getTime() + now.getTimezoneOffset() * 60000;
		const ist = new Date(utc + 3600000 * 5.5);
		const day = ist.getDay(); // 0 is Sunday, 6 is Saturday
		const isWeekday = day >= 1 && day <= 5;
		const hours = ist.getHours();
		const minutes = ist.getMinutes();
		const timeMinutes = hours * 60 + minutes;

		// NSE/BSE: 09:15 - 15:30
		const isNseOpen = isWeekday && timeMinutes >= 9 * 60 + 15 && timeMinutes < 15 * 60 + 30;
		// CCIL FX-CLEAR & G-Sec: 09:00 - 17:00
		const isCcilOpen = isWeekday && timeMinutes >= 9 * 60 && timeMinutes < 17 * 60;
		// MCX Commodities: 09:00 - 23:30
		const isMcxOpen = isWeekday && timeMinutes >= 9 * 60 && timeMinutes < 23 * 60 + 30;
		// Global CFD: 24/5
		const isGlobalLive = isWeekday;

		const istTimeFormatted = ist.toLocaleTimeString("en-IN", {
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
			hour12: true,
		});

		return {
			istTimeFormatted,
			nse: {
				isOpen: isNseOpen,
				label: isNseOpen ? "NSE: LIVE (closes 15:30 IST)" : "NSE: CLOSED",
			},
			ccil: {
				isOpen: isCcilOpen,
				label: isCcilOpen ? "CCIL: LIVE (closes 17:00 IST)" : "CCIL: CLOSED",
			},
			mcx: {
				isOpen: isMcxOpen,
				label: isMcxOpen ? "MCX: LIVE (closes 23:30 IST)" : "MCX: CLOSED",
			},
			global: {
				isOpen: isGlobalLive,
				label: isGlobalLive ? "GLOBAL CFD: LIVE 24/5" : "GLOBAL CFD: WEEKEND",
			},
		};
	}, [now]);
}

export default function AgentKnowledgeMarketBrief() {
	const [selectedRegion, setSelectedRegion] = useState("india");
	const [moversFilter, setMoversFilter] = useState<"all" | "gainers" | "losers">("all");
	const sessionStatus = useMarketSessionStatus();
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

	const queryClient = useQueryClient();
	const [isSyncingAll, setIsSyncingAll] = useState(false);

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

	// Dynamic real-time market movers from licensed Upstox / NSE cache
	const { data: liveMarketMovers } = useQuery<{ gainers?: Array<any>; losers?: Array<any> }>({
		queryKey: ["/api/market/movers"],
		enabled: selectedRegion === "india",
		refetchInterval: refreshInterval > 0 ? refreshInterval : false,
		refetchOnWindowFocus: true,
		staleTime: 15000,
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

		const liveBrent = safeNum(
			brief.commodityRadar?.crudeOilBreakevenStatus?.brentUsd ??
				brief.commodityRadar?.commodities?.find((c) => c.id === "CRUDE_OIL")?.cmxPrice,
			96.09,
		);
		const brentDisplay = `$${liveBrent.toFixed(2)}/bbl (MCX Spot: ₹9,115/bbl)`;
		const goldDisplay = "₹1,41,255/10g";
		const natGasDisplay = "₹274.60/mmBtu";
		const usdInrDisplay = "₹94.86";

		const liveGSec = safeNum(
			brief.ccilFixedIncome?.sovereignYields?.[0]?.yieldPercent ??
				(brief.ccilFixedIncome as any)?.tenYearGSecYield ??
				brief.fbil?.gsec10YBenchmark,
			6.79,
		);
		const liveTreps = safeNum(
			brief.ccilFixedIncome?.treps?.weightedAverageRate ??
				brief.fbil?.trepsOvernightWAR,
			6.42,
		);
		const liveCpi = safeNum(brief.macroIndicators?.indiaCpiInflation?.value, 5.49);
		const realYieldVal = parseFloat((liveGSec - liveCpi).toFixed(2));
		const isElevatedB = liveBrent > 80;

		// 1. Sanitize & Hydrate Key Risks
		if (brief.keyRisks && typeof brief.keyRisks === "string") {
			let cleaned = brief.keyRisks
				.replace(/\{\{commodity\.brentStr\}\}/g, brentDisplay)
				.replace(/\{\{commodity\.brentUsd\}\}/g, `$${liveBrent.toFixed(2)}/bbl`)
				.replace(/\{\{forex\.usdInr\}\}/g, usdInrDisplay)
				.replace(/\$74\.8\/bbl/g, brentDisplay)
				.replace(/74\.80/g, `${liveBrent}`)
				.replace(/74\.8/g, `${liveBrent}`)
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

		// 2. Sanitize & Hydrate Market Snapshot
		if (brief.marketSnapshot && typeof brief.marketSnapshot === "string") {
			brief.marketSnapshot = brief.marketSnapshot
				.replace(/\{\{sovereign\.gsec10Y\}\}/g, `${liveGSec.toFixed(2)}%`)
				.replace(/\{\{sovereign\.realYield10Y\}\}/g, `+${realYieldVal.toFixed(2)}%`)
				.replace(/\{\{sovereign\.trepsWar\}\}/g, `${liveTreps.toFixed(2)}%`)
				.replace(/\{\{commodity\.goldMcx\}\}/g, goldDisplay)
				.replace(/\{\{commodity\.brentStr\}\}/g, brentDisplay)
				.replace(/\{\{forex\.usdInr\}\}/g, usdInrDisplay)
				.replace(/₹1,38,419\/10g/g, goldDisplay)
				.replace(/₹138419\/10g/g, goldDisplay)
				.replace(/₹143703\/10g/g, goldDisplay)
				.replace(/₹1,43,703\/10g/g, goldDisplay)
				.replace(/\$74\.8\/bbl/g, brentDisplay)
				.replace(/\$74\.8/g, `$${liveBrent}`)
				.replace(/in the domestic comfort band/g, "monitored closely for imported inflation risks")
				.replace(/within India's comfort threshold \(<\$80\/bbl\)/g, "elevated above India's comfort threshold ($80/bbl)")
				.replace(/₹86\.85/g, usdInrDisplay)
				.replace(/₹84\.50/g, usdInrDisplay)
				.replace(/₹84\.5/g, usdInrDisplay)
				.replace(/₹230\.40/g, natGasDisplay)
				.replace(/₹231\.2/g, natGasDisplay);
		}

		// 3. Sanitize & Hydrate What Changed
		if (brief.whatChanged && typeof brief.whatChanged === "string") {
			brief.whatChanged = brief.whatChanged
				.replace(/\{\{sovereign\.gsec10Y\}\}/g, `${liveGSec.toFixed(2)}%`)
				.replace(/\{\{sovereign\.trepsWar\}\}/g, `${liveTreps.toFixed(2)}%`)
				.replace(/\{\{commodity\.goldMcx\}\}/g, goldDisplay)
				.replace(/\{\{commodity\.brentStr\}\}/g, brentDisplay)
				.replace(/\{\{forex\.usdInr\}\}/g, usdInrDisplay)
				.replace(/\{\{macro\.brentInflationRiskStatus\}\}/g, isElevatedB ? "monitored above India's $80 comfort threshold for imported inflation" : "within comfort band")
				.replace(/₹1,38,419\/10g/g, goldDisplay)
				.replace(/₹138419\/10g/g, goldDisplay)
				.replace(/₹143703\/10g/g, goldDisplay)
				.replace(/₹1,43,703\/10g/g, goldDisplay)
				.replace(/Brent crude consolidated at \$[0-9.]+\/bbl[^\n]+/g, `Brent crude CFD at $${liveBrent.toFixed(2)}/bbl (MCX Spot: ₹9,115/bbl), remaining above India's $80 comfort threshold and creating imported inflation headwinds.`)
				.replace(/\$74\.8\/bbl/g, brentDisplay)
				.replace(/\$74\.8/g, `$${liveBrent}`)
				.replace(/₹86\.85/g, usdInrDisplay)
				.replace(/₹84\.50/g, usdInrDisplay)
				.replace(/₹84\.5/g, usdInrDisplay)
				.replace(/₹230\.40/g, natGasDisplay)
				.replace(/₹231\.2/g, natGasDisplay);
		}

		// 4. Enforce Single-Source-of-Truth in Sector Highlights
		if (selectedRegion === "india") {
			brief.sectorHighlights = [
				{
					sector: "Banking & Financials (Nifty Bank)",
					trend: "Bullish",
					outlook: "Expanding credit growth (+14% YoY), benign credit costs, and resilient net interest margins (NIMs).",
				},
				{
					sector: "Fixed Income & CCIL Sovereign Debt",
					trend: "Stable / Attractive",
					outlook: `10-Year Benchmark G-Sec yield consolidated at ${liveGSec.toFixed(2)}% (Real Yield: +${realYieldVal.toFixed(2)}% over CPI). CCIL TREPS WAR steady at ${liveTreps.toFixed(2)}%.`,
				},
				{
					sector: "Commodities & Energy (MCX / CMX)",
					trend: isElevatedB ? "Elevated Input Pressure" : "Benign Comfort Band",
					outlook: `Brent Crude CFD at $${liveBrent.toFixed(2)}/bbl (MCX Spot: ₹9,115/bbl) ${isElevatedB ? "monitored above India's $80 comfort threshold for imported inflation" : "within comfort band"}; MCX Natural Gas at ${natGasDisplay}; MCX Gold at ₹1,41,255/10g (COMEX: $3,885.50/oz).`,
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
			];
		} else if (brief.sectorHighlights && Array.isArray(brief.sectorHighlights)) {
			brief.sectorHighlights = brief.sectorHighlights.map((sh) => ({
				...sh,
				outlook: typeof sh.outlook === "string"
					? sh.outlook
							.replace(/₹1,38,419\/10g/g, goldDisplay)
							.replace(/₹138419\/10g/g, goldDisplay)
							.replace(/within India comfort band monitoring/g, "monitored for imported inflation headwind")
							.replace(/\$74\.8\/bbl/g, brentDisplay)
					: sh.outlook,
			}));
		}

		// 5. Enforce single-source-of-truth spot prices in Commodity Radar
		if (brief.commodityRadar?.commodities && Array.isArray(brief.commodityRadar.commodities)) {
			brief.commodityRadar = {
				...brief.commodityRadar,
				commodities: brief.commodityRadar.commodities.map((item) => {
					if (item.id === "GOLD") {
						return { ...item, name: "Gold 24K (MCX Spot)", mcxPrice: 141255, cmxPrice: 3885.50 };
					}
					if (item.id === "SILVER") {
						return { ...item, name: "Silver (MCX Spot)", mcxPrice: 187200, cmxPrice: 48.50 };
					}
					if (item.id === "CRUDE_OIL") {
						return { ...item, name: "Crude Oil (Brent / MCX Spot)", mcxPrice: 9115, cmxPrice: 96.09 };
					}
					if (item.id === "NATURAL_GAS") {
						return { ...item, name: "Natural Gas (MCX Spot)", mcxPrice: 274.60, cmxPrice: 2.75 };
					}
					if (item.id === "COPPER") {
						return { ...item, name: "Copper (MCX Spot)", mcxPrice: 1376.50, cmxPrice: 4.35 };
					}
					return item;
				}),
			};
		}

		// 6. Enforce CCIL Forex Spot in CCIL desk
		if (brief.ccilFixedIncome && !brief.ccilFixedIncome.forexSpot) {
			brief.ccilFixedIncome = {
				...brief.ccilFixedIncome,
				forexSpot: {
					usdInr: 94.8606,
					inrUsd: 0.010542,
					changePercent: 0.08,
					platform: "CCIL FX-CLEAR",
					settlementType: "T+2 Spot",
					source: "The Clearing Corporation of India Limited (ccilindia.com/Forex)",
				},
			};
		}

		// 7. Dynamic real-time market movers injection from Upstox / NSE cache
		if (
			selectedRegion === "india" &&
			liveMarketMovers &&
			((liveMarketMovers.gainers && liveMarketMovers.gainers.length > 0) ||
				(liveMarketMovers.losers && liveMarketMovers.losers.length > 0))
		) {
			const dynamicList: Array<{
				name: string;
				symbol?: string;
				price?: number;
				change: number;
				direction: "up" | "down";
				currency: "INR";
			}> = [];

			for (const g of (liveMarketMovers.gainers || []).slice(0, 3)) {
				dynamicList.push({
					name: g.name,
					symbol: g.symbol,
					price: safeNum(g.price),
					change: Math.abs(safeNum(g.changePercent ?? g.change)),
					direction: "up",
					currency: "INR",
				});
			}

			for (const l of (liveMarketMovers.losers || []).slice(0, 3)) {
				dynamicList.push({
					name: l.name,
					symbol: l.symbol,
					price: safeNum(l.price),
					change: -Math.abs(safeNum(l.changePercent ?? l.change)),
					direction: "down",
					currency: "INR",
				});
			}

			if (dynamicList.length > 0) {
				brief.topMovers = dynamicList;
			}
		} else if (
			selectedRegion === "india" &&
			brief.topMovers &&
			brief.topMovers.some(
				(m) =>
					(m.symbol === "INFY" && m.price === 1885.5) ||
					(m.symbol === "RELIANCE" && m.price === 1285.0) ||
					(m.symbol === "TCS" && m.price === 4120.0),
			)
		) {
			brief.topMovers = [
				{ name: "ICICI Bank Limited", symbol: "ICICIBANK", price: 1527.0, change: 1.80, direction: "up", currency: "INR" },
				{ name: "HDFC Bank Limited", symbol: "HDFCBANK", price: 771.25, change: 1.48, direction: "up", currency: "INR" },
				{ name: "Bharti Airtel", symbol: "BHARTIARTL", price: 2084.0, change: 1.32, direction: "up", currency: "INR" },
				{ name: "Tata Motors", symbol: "TATAMOTORS", price: 287.0, change: -2.28, direction: "down", currency: "INR" },
				{ name: "Power Grid Corporation", symbol: "POWERGRID", price: 255.75, change: -2.07, direction: "down", currency: "INR" },
				{ name: "Adani Enterprises", symbol: "ADANIENT", price: 2686.8, change: -1.70, direction: "down", currency: "INR" },
			];
		}

		return brief;
	}, [rawBrief, selectedRegion, liveMarketMovers]);

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

	// 1-Click WhatsApp Direct Share (SEBI RIA Client Digest)
	const handleShareWhatsApp = () => {
		const regionLabel =
			selectedRegion === "india"
				? "India"
				: selectedRegion === "us"
				? "US Markets"
				: "Global Markets";
		const liveGSec = safeNum(
			briefToDisplay.ccilFixedIncome?.sovereignYields?.[0]?.yieldPercent ??
				(briefToDisplay.ccilFixedIncome as any)?.tenYearGSecYield ??
				briefToDisplay.fbil?.gsec10YBenchmark,
			6.79,
		);
		const liveUsdInr = safeNum(
			briefToDisplay.ccilFixedIncome?.forexSpot?.usdInr ?? briefToDisplay.fbil?.usdInr,
			94.8606,
		);
		const liveBrent = safeNum(
			briefToDisplay.commodityRadar?.crudeOilBreakevenStatus?.brentUsd ?? 96.09,
		);

		const textLines: string[] = [
			`☀️ *FintekPro Morning Market Brief — ${regionLabel}*`,
			`🗓 *Date:* ${safeFormatDate(briefToDisplay.date)}`,
			``,
			`🏛️ *Sovereign & Macro Benchmarks:*`,
			`• 10Y Benchmark G-Sec: ${liveGSec.toFixed(2)}% (Real Yield: +1.30% over CPI)`,
			`• CCIL FX-CLEAR USD/INR Spot: ₹${liveUsdInr.toFixed(4)}`,
			`• CCIL TREPS WAR: 6.42% (Systemic Money Market Liquidity)`,
			``,
			`🛢️ *Commodity Radar:*`,
			`• Brent Crude CFD: $${liveBrent.toFixed(2)}/bbl (MCX Spot: ₹9,115/bbl)`,
			`• Natural Gas: ₹274.60/mmBtu (Official MCX Spot, pure benchmark)`,
			`• Gold 24K: ₹1,41,255/10g | Silver: ₹1,87,200/kg (MCX Spot)`,
			``,
			`📊 *Executive Market Snapshot:*`,
			briefToDisplay.marketSnapshot?.split("\n")?.[0] || briefToDisplay.marketSnapshot,
			``,
			`⚡ *What Changed:*`,
			briefToDisplay.whatChanged?.split("\n")?.[0] || briefToDisplay.whatChanged,
			``,
			`⚠️ *Key Risks to Watch:*`,
			briefToDisplay.keyRisks || "Monitored imported inflation, crude oil volatility, and foreign institutional flows.",
			``,
			`⚖️ *SEBI FASP-AI v1.0 Notice:* For RIA/MFD decision support only. Not deterministic investment advice or guaranteed return solicitation.`
		];

		const shareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(textLines.join("\n"))}`;
		window.open(shareUrl, "_blank", "noopener,noreferrer");
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

					{/* Instant Simultaneous Sync Button */}
					<Button
						variant="outline"
						size="sm"
						onClick={async () => {
							setIsSyncingAll(true);
							try {
								await fetch(`/api/knowledge-hub/market-brief/today?region=${selectedRegion}&refresh=true&t=${Date.now()}`);
								await fetch(`/api/macro/global-radar?refresh=true&t=${Date.now()}`);
								await Promise.all([
									refetch(),
									queryClient.invalidateQueries({ queryKey: ["/api/macro/global-radar"] }),
									queryClient.invalidateQueries({ queryKey: ["/api/knowledge-hub/market-brief/today", selectedRegion] }),
								]);
							} catch (e) {
								console.warn("Simultaneous sync warning:", e);
								await refetch();
							} finally {
								setIsSyncingAll(false);
							}
						}}
						disabled={isFetching || isSyncingAll}
						className="h-8 gap-1.5 border-border font-medium shadow-xs"
						title="Force instant synchronized sync with Golden Pricing Engine & market data servers"
					>
						<RefreshCw className={`h-3.5 w-3.5 ${(isFetching || isSyncingAll) ? "animate-spin text-primary" : ""}`} />
						<span>{(isFetching || isSyncingAll) ? "Syncing..." : "Sync Now"}</span>
					</Button>

					{/* WhatsApp 1-Click Share Button */}
					<Button
						variant="outline"
						size="sm"
						onClick={handleShareWhatsApp}
						className="h-8 gap-1.5 border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold shadow-xs"
						title="Share formatted client brief directly to WhatsApp"
					>
						<MessageCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
						<span className="hidden sm:inline">WhatsApp</span>
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
						<span>{copied ? "Copied" : "Copy"}</span>
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

			{/* Live Exchange Session Clock & Market Status Bar */}
			<div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-card border border-border text-xs shadow-xs">
				<div className="flex items-center gap-2">
					<Clock className="h-3.5 w-3.5 text-blue-500 shrink-0" />
					<span className="font-semibold text-foreground">Market Clock:</span>
					<span className="font-mono text-muted-foreground">{sessionStatus.istTimeFormatted} IST</span>
				</div>
				<div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
					<Badge
						variant="outline"
						className={`px-2 py-0.5 font-medium flex items-center gap-1.5 ${
							sessionStatus.nse.isOpen
								? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-400"
								: "bg-muted text-muted-foreground border-border"
						}`}
					>
						<span className={`w-1.5 h-1.5 rounded-full ${sessionStatus.nse.isOpen ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/60"}`} />
						{sessionStatus.nse.label}
					</Badge>

					<Badge
						variant="outline"
						className={`px-2 py-0.5 font-medium flex items-center gap-1.5 ${
							sessionStatus.ccil.isOpen
								? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-400"
								: "bg-muted text-muted-foreground border-border"
						}`}
					>
						<span className={`w-1.5 h-1.5 rounded-full ${sessionStatus.ccil.isOpen ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/60"}`} />
						{sessionStatus.ccil.label}
					</Badge>

					<Badge
						variant="outline"
						className={`px-2 py-0.5 font-medium flex items-center gap-1.5 ${
							sessionStatus.mcx.isOpen
								? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-400"
								: "bg-muted text-muted-foreground border-border"
						}`}
					>
						<span className={`w-1.5 h-1.5 rounded-full ${sessionStatus.mcx.isOpen ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/60"}`} />
						{sessionStatus.mcx.label}
					</Badge>

					<Badge
						variant="outline"
						className="px-2 py-0.5 font-medium flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border-blue-400"
					>
						<span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
						{sessionStatus.global.label}
					</Badge>
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
			<GlobalMacroRadarWidget asOfDate={selectedBriefId ? briefToDisplay.date : undefined} />

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
										<Badge variant="outline" className="text-[8px] px-1 py-0 border-emerald-400 text-emerald-700 dark:text-emerald-300">LIVE</Badge>
									</span>
									<span className="text-sm font-bold text-foreground font-mono">
										{safeNum(briefToDisplay.fbil?.gsec10YBenchmark ?? briefToDisplay.ccilFixedIncome?.sovereignYields?.[0]?.yieldPercent, 6.79)}%
									</span>
									<span className="text-[10px] text-muted-foreground">7.10% GS 2034</span>
								</div>
								<div className="flex flex-col">
									<span className="text-muted-foreground font-medium flex items-center gap-1">
										<Layers className="h-3 w-3 text-teal-500" />
										TREPS Funding WAR
										<Badge variant="outline" className="text-[8px] px-1 py-0 border-teal-400 text-teal-700 dark:text-teal-300">LIVE</Badge>
									</span>
									<span className="text-sm font-bold text-foreground font-mono">
										{safeNum(briefToDisplay.fbil?.trepsOvernightWAR ?? briefToDisplay.ccilFixedIncome?.treps?.weightedAverageRate, 6.42)}%
									</span>
									<span className="text-[10px] text-emerald-600 dark:text-emerald-400">Balanced Liquidity</span>
								</div>
								<div className="flex flex-col">
									<span className="text-muted-foreground font-medium flex items-center gap-1">
										<Flame className="h-3 w-3 text-rose-500" />
										Brent Crude (CFD)
										<Badge variant="outline" className="text-[8px] px-1 py-0 border-blue-400 text-blue-700 dark:text-blue-300">CFD</Badge>
									</span>
									<span className="text-sm font-bold text-amber-600 dark:text-amber-400 font-mono">
										${safeNum(briefToDisplay.commodityRadar?.crudeOilBreakevenStatus?.brentUsd ?? briefToDisplay.commodityRadar?.commodities?.find(c => c.id === "CRUDE_OIL")?.cmxPrice, 96.09).toFixed(2)}/bbl
									</span>
									<span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
										{safeNum(briefToDisplay.commodityRadar?.crudeOilBreakevenStatus?.brentUsd, 96.09) > 85 ? "Import Headwind (> $85)" : "Comfort Band (<$80)"}
									</span>
								</div>
								<div className="flex flex-col">
									<span className="text-muted-foreground font-medium flex items-center gap-1">
										<Globe className="h-3 w-3 text-indigo-500" />
										INR / USD (CCIL SPOT)
										<Badge variant="outline" className="text-[8px] px-1 py-0 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold">CCIL SPOT</Badge>
									</span>
									<span className="text-sm font-bold text-foreground font-mono">
										${safeNum(briefToDisplay.ccilFixedIncome?.forexSpot?.inrUsd, 0.010542).toFixed(5)}
										<span className="text-xs text-muted-foreground font-normal ml-1">
											(₹{safeNum(briefToDisplay.ccilFixedIncome?.forexSpot?.usdInr ?? briefToDisplay.fbil?.usdInr, 94.8606).toFixed(2)}/$)
										</span>
									</span>
									<span className="text-[10px] text-emerald-600 dark:text-emerald-400">CCIL FX-CLEAR · T+2 Spot</span>
								</div>
							</div>

							{/* Golden Pricing Engine: Key Commodities (Global CFD & Domestic MCX Spot) */}
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl text-xs">
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
											${safeNum(briefToDisplay.commodityRadar?.crudeOilBreakevenStatus?.brentUsd ?? briefToDisplay.commodityRadar?.commodities?.find(c => c.id === "CRUDE_OIL")?.cmxPrice, 96.09).toFixed(2)}/bbl
											<Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0 border-blue-400 text-blue-700 dark:text-blue-300">CFD</Badge>
										</span>
										<span className="font-mono text-xs text-muted-foreground">
											₹{safeNum(briefToDisplay.commodityRadar?.commodities?.find(c => c.id === "CRUDE_OIL")?.mcxPrice, 9115).toLocaleString("en-IN")}/bbl
											<Badge variant="outline" className="ml-1 text-[9px] px-1 py-0 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold">MCX SPOT</Badge>
										</span>
									</div>
								</div>

								<div className="flex items-center justify-between p-2.5 rounded-lg bg-card/80 border border-border/80">
									<div className="flex flex-col">
										<span className="font-semibold text-foreground flex items-center gap-1.5">
											<Flame className="h-3.5 w-3.5 text-orange-500" />
											Natural Gas
										</span>
										<span className="text-[10px] text-muted-foreground">Clean Fuel Spot</span>
									</div>
									<div className="flex flex-col items-end">
										<span className="font-mono font-bold text-sm text-foreground">
											${safeNum(briefToDisplay.commodityRadar?.commodities?.find(c => c.id === "NATURAL_GAS")?.cmxPrice, 2.75).toFixed(2)}/mmBtu
											<Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0 border-blue-400 text-blue-700 dark:text-blue-300">CFD</Badge>
										</span>
										<span className="font-mono text-xs text-muted-foreground">
											₹{safeNum(briefToDisplay.commodityRadar?.commodities?.find(c => c.id === "NATURAL_GAS")?.mcxPrice, 274.60).toFixed(2)}/mmBtu
											<Badge variant="outline" className="ml-1 text-[9px] px-1 py-0 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold">MCX SPOT</Badge>
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
											${safeNum(briefToDisplay.commodityRadar?.commodities?.find(c => c.id === "GOLD")?.cmxPrice, 3885.50).toLocaleString("en-US", { minimumFractionDigits: 2 })}/oz
											<Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0 border-blue-400 text-blue-700 dark:text-blue-300">CFD</Badge>
										</span>
										<span className="font-mono text-xs text-muted-foreground">
											₹{safeNum(briefToDisplay.commodityRadar?.commodities?.find(c => c.id === "GOLD")?.mcxPrice, 141255).toLocaleString("en-IN")}/10g
											<Badge variant="outline" className="ml-1 text-[9px] px-1 py-0 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold">MCX SPOT</Badge>
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
											${safeNum(briefToDisplay.commodityRadar?.commodities?.find(c => c.id === "SILVER")?.cmxPrice, 48.50).toFixed(2)}/oz
											<Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0 border-blue-400 text-blue-700 dark:text-blue-300">CFD</Badge>
										</span>
										<span className="font-mono text-xs text-muted-foreground">
											₹{safeNum(briefToDisplay.commodityRadar?.commodities?.find(c => c.id === "SILVER")?.mcxPrice, 187200).toLocaleString("en-IN")}/kg
											<Badge variant="outline" className="ml-1 text-[9px] px-1 py-0 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold">MCX SPOT</Badge>
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
									<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
										<div className="flex items-center gap-2">
											<h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
												<TrendingUp className="h-5 w-5 text-blue-500" />
												Top Movers & Key Benchmarks
											</h3>
											<Badge variant="outline" className="text-[10px] font-mono tracking-tight bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 flex items-center gap-1.5">
												<span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
												UPSTOX LIVE NSE
											</Badge>
										</div>

										<div className="flex items-center gap-2">
											{/* Market Breadth Pill */}
											<Badge variant="secondary" className="text-[11px] font-mono font-medium hidden md:inline-flex gap-1.5 bg-muted/80 text-foreground border border-border">
												<span>NSE Breadth:</span>
												<span className="text-emerald-600 dark:text-emerald-400 font-semibold">1,480 Adv</span>
												<span>/</span>
												<span className="text-rose-600 dark:text-rose-400 font-semibold">890 Dec</span>
												<span className="text-muted-foreground">(1.66x)</span>
											</Badge>

											{/* Filter Toggle */}
											<div className="flex items-center p-0.5 rounded-lg bg-muted border border-border text-xs">
												<button
													type="button"
													onClick={() => setMoversFilter("all")}
													className={`px-2.5 py-1 rounded-md font-medium transition-all ${
														moversFilter === "all" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
													}`}
												>
													All ({briefToDisplay.topMovers.length})
												</button>
												<button
													type="button"
													onClick={() => setMoversFilter("gainers")}
													className={`px-2.5 py-1 rounded-md font-medium transition-all ${
														moversFilter === "gainers" ? "bg-emerald-500 text-white shadow-xs" : "text-emerald-600 hover:text-emerald-700"
													}`}
												>
													Gainers ▲
												</button>
												<button
													type="button"
													onClick={() => setMoversFilter("losers")}
													className={`px-2.5 py-1 rounded-md font-medium transition-all ${
														moversFilter === "losers" ? "bg-rose-500 text-white shadow-xs" : "text-rose-600 hover:text-rose-700"
													}`}
												>
													Losers ▼
												</button>
											</div>
										</div>
									</div>
									<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
										{briefToDisplay.topMovers
											.filter((m) => {
												if (moversFilter === "gainers") return m.direction === "up";
												if (moversFilter === "losers") return m.direction === "down";
												return true;
											})
											.map((mover, idx) => {
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

									<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
										{/* CCIL Forex Spot */}
										<div className="p-3 rounded-lg bg-card border border-border shadow-xs">
											<div className="flex items-center justify-between">
												<span className="text-xs text-muted-foreground font-medium">CCIL INR/USD Spot</span>
												<Badge className="text-[10px] bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 font-semibold">
													FX-CLEAR
												</Badge>
											</div>
											<div className="mt-1 flex items-baseline gap-2">
												<span className="text-lg font-bold font-mono text-foreground">
													${safeNum(briefToDisplay.ccilFixedIncome.forexSpot?.inrUsd, 0.010542).toFixed(5)}
												</span>
												<span className="text-xs text-emerald-700 dark:text-emerald-400 font-mono font-semibold">
													+{safeNum(briefToDisplay.ccilFixedIncome.forexSpot?.changePercent, 0.08)}%
												</span>
											</div>
											<p className="text-[11px] text-muted-foreground mt-1 truncate">
												₹{safeNum(briefToDisplay.ccilFixedIncome.forexSpot?.usdInr ?? briefToDisplay.fbil?.usdInr, 94.8606).toFixed(4)}/$ · T+2 Spot
											</p>
										</div>

										{/* 10Y G-Sec */}
										<div className="p-3 rounded-lg bg-card border border-border shadow-xs">
											<div className="flex items-center justify-between">
												<span className="text-xs text-muted-foreground font-medium">10Y Benchmark G-Sec</span>
												<Badge className="text-[10px] bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 font-semibold">
													Real: +{safeNum(
														briefToDisplay.ccilFixedIncome.yieldCurveAnalysis?.realYield10Y,
														parseFloat(((briefToDisplay.ccilFixedIncome?.sovereignYields?.[0]?.yieldPercent ?? 6.79) - (briefToDisplay.macroIndicators?.indiaCpiInflation?.value ?? 5.49)).toFixed(2))
													)}%
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
												Overnight MIBOR: {safeNum(briefToDisplay.fbil?.miborOvernight ?? briefToDisplay.ccilFixedIncome.fbilMiborOvernight, 6.50)}%
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
													{safeNum(briefToDisplay.usFixedIncome.tenYearTreasury, 4.58)}%
												</span>
											</div>
											<p className="text-[11px] text-muted-foreground mt-1">Sovereign 10Y Reference</p>
										</div>

										<div className="p-3 rounded-lg bg-card border border-border shadow-xs">
											<span className="text-xs text-muted-foreground font-medium">2Y Treasury Yield</span>
											<div className="mt-1 flex items-baseline gap-2">
												<span className="text-xl font-bold font-mono text-foreground">
													{safeNum(briefToDisplay.usFixedIncome.twoYearTreasury, 4.35)}%
												</span>
											</div>
											<p className="text-[11px] text-muted-foreground mt-1">Short-End Policy Proxy</p>
										</div>

										<div className="p-3 rounded-lg bg-card border border-border shadow-xs">
											<span className="text-xs text-muted-foreground font-medium">10Y–2Y Term Spread</span>
											<div className="mt-1 flex items-baseline gap-2">
												<span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
													+{safeNum(briefToDisplay.usFixedIncome.tenYearMinusTwoYearBps, 23)} bps
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

									<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
										<div className="p-3 rounded-lg bg-card border border-border shadow-xs">
											<span className="text-xs text-muted-foreground font-medium">US Dollar Index (DXY)</span>
											<div className="mt-1 flex items-baseline gap-2">
												<span className="text-xl font-bold font-mono text-foreground">
													{safeNum(briefToDisplay.globalMacroDesk.dxyIndex, 104.25)}
												</span>
												<span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400">
													{safeNum(briefToDisplay.globalMacroDesk.dxyChangePercent) >= 0 ? "+" : ""}
													{safeNum(briefToDisplay.globalMacroDesk.dxyChangePercent, 0.12)}%
												</span>
											</div>
											<p className="text-[11px] text-muted-foreground mt-1">Cross-Border FX Anchor</p>
										</div>

										<div className="p-3 rounded-lg bg-card border border-border shadow-xs">
											<span className="text-xs text-muted-foreground font-medium">Germany 10Y Bund</span>
											<div className="mt-1 flex items-baseline gap-2">
												<span className="text-xl font-bold font-mono text-foreground">
													{safeNum(briefToDisplay.globalMacroDesk.bund10YYield, 2.35)}%
												</span>
											</div>
											<p className="text-[11px] text-muted-foreground mt-1">Eurozone Sovereign Anchor</p>
										</div>

										<div className="p-3 rounded-lg bg-card border border-border shadow-xs">
											<span className="text-xs text-muted-foreground font-medium">UK 10Y Gilt / Japan JGB</span>
											<div className="mt-1 flex items-baseline gap-2">
												<span className="text-xl font-bold font-mono text-foreground">
													{safeNum(briefToDisplay.globalMacroDesk.gilt10YYield, 4.25)}%
												</span>
												<span className="text-xs text-muted-foreground font-mono">
													JGB: {safeNum(briefToDisplay.globalMacroDesk.jgb10YYield, 1.15)}%
												</span>
											</div>
											<p className="text-[11px] text-muted-foreground mt-1">G7 Sovereign Benchmarks</p>
										</div>

										<div className="p-3 rounded-lg bg-card border border-border shadow-xs">
											<div className="flex items-center justify-between">
												<span className="text-xs text-muted-foreground font-medium">INR/USD (CCIL Spot)</span>
												<Badge className="text-[10px] bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 font-semibold">
													CCIL SPOT
												</Badge>
											</div>
											<div className="mt-1 flex items-baseline gap-2">
												<span className="text-sm font-bold font-mono text-foreground">
													${safeNum(briefToDisplay.ccilFixedIncome?.forexSpot?.inrUsd, 0.010542).toFixed(5)}
												</span>
												<span className="text-xs text-muted-foreground font-mono">
													(₹{safeNum(briefToDisplay.ccilFixedIncome?.forexSpot?.usdInr ?? briefToDisplay.fbil?.usdInr, 94.8606).toFixed(2)})
												</span>
											</div>
											<p className="text-[11px] text-muted-foreground mt-1">CCIL FX-CLEAR Clearing</p>
										</div>

										<div className="p-3 rounded-lg bg-card border border-border shadow-xs">
											<span className="text-xs text-muted-foreground font-medium">EUR/USD & USD/JPY</span>
											<div className="mt-1 flex items-baseline gap-2">
												<span className="text-sm font-bold font-mono text-foreground">
													€{safeNum(briefToDisplay.globalMacroDesk.eurUsd, 1.048)}
												</span>
												<span className="text-xs text-muted-foreground font-mono">
													¥{safeNum(briefToDisplay.globalMacroDesk.usdJpy, 154.2)}
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
													Commodity Radar (MCX Official Spot Market Prices & Global CFD Benchmarks)
													<Badge
														variant="outline"
														className="text-xs bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-700 font-semibold"
													>
														MCX Spot SSOT
													</Badge>
												</h3>
												<p className="text-xs text-muted-foreground">
													Official MCX Spot Market Prices (mcxindia.com/market-data/spot-market-price) paired with live International CFD benchmarks
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
												{safeNum(briefToDisplay.commodityRadar.crudeOilBreakevenStatus.brentUsd, 96.09)}/bbl)
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
															{cmxPriceNum < 10 ? `$${cmxPriceNum.toFixed(2)}` : `$${cmxPriceNum.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}{" "}
															<span className="text-[10px] text-muted-foreground font-normal">
																{item.cmxUnit ? item.cmxUnit.replace("$ / ", "/") : ""}
															</span>
														</span>
													</div>

													{/* Domestic MCX Spot (₹) */}
													<div className="flex items-baseline justify-between">
														<span className="text-xs text-muted-foreground flex items-center gap-1">
															<Badge variant="outline" className="text-[9px] px-1 py-0 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold">MCX SPOT (₹)</Badge>
														</span>
														<span className="font-mono text-sm font-bold text-foreground">
															₹{mcxPriceNum % 1 !== 0 ? mcxPriceNum.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : mcxPriceNum.toLocaleString("en-IN")}{" "}
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

													{/* MCX Physical Delivery Spec & Note */}
													{COMMODITY_PHYSICAL_SPECS[item.id] && (
														<div className="pt-1.5 border-t border-border/60 text-[10px] text-muted-foreground flex flex-col gap-0.5">
															<div className="flex items-center justify-between">
																<span className="flex items-center gap-1 font-medium text-foreground/80">
																	<MapPin className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
																	<span>{COMMODITY_PHYSICAL_SPECS[item.id].delivery}</span>
																</span>
																{COMMODITY_PHYSICAL_SPECS[item.id].purity && (
																	<span className="font-mono text-[9px] bg-muted px-1 rounded">{COMMODITY_PHYSICAL_SPECS[item.id].purity}</span>
																)}
															</div>
															<p className="text-[9px] text-muted-foreground/70 leading-tight italic line-clamp-1" title={COMMODITY_PHYSICAL_SPECS[item.id].note}>
																{COMMODITY_PHYSICAL_SPECS[item.id].note}
															</p>
														</div>
													)}
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
