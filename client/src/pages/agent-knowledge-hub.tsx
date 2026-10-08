import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
	BookOpen,
	TrendingUp,
	FileCheck,
	Lightbulb,
	Shield as LucideShield,
	Clock,
	ArrowRight,
	AlertTriangle,
	ChevronRight,
	BarChart3,
	RefreshCw,
	GraduationCap,
	Search,
	ExternalLink,
	CheckCircle2,
	Layers,
	ChevronLeft,
	HelpCircle,
	X,
	Sparkles,
} from "lucide-react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";

interface DashboardStats {
	hasTodaysBrief: boolean;
	todaysBrief: {
		id: string;
		date: string;
		region: string;
		marketSnapshot: string;
		whatChanged: string;
		keyRisks?: string;
		publishedAt?: string;
	} | null;
	productCardsCount: number;
	explanationTemplatesCount: number;
	certificationsCount: number;
	assetInsightsCount: number;
}

interface Disclaimer {
	id: string;
	content: string;
	shortContent?: string;
	version: number;
}

interface CpeStatusData {
	totalCertificates: number;
	criticalRenewals: number;
	upcomingRenewals: number;
	certifications: {
		id: string;
		certificateType: string;
		code: string;
		title: string;
		certificateNumber: string;
		issuedAt: string;
		expiresAt: string;
		daysRemaining: number;
		urgency: "critical" | "warning" | "good";
		cpeHoursRequired: number;
		cpeHoursEarned: number;
		cpeCompleted: boolean;
		cpeBookingUrl: string;
		renewalEligible: boolean;
	}[];
}

interface Flashcard {
	id: string;
	category: string;
	question: string;
	answer: string;
	significance: string;
}

interface AssetClassInsight {
	id: string;
	assetClass: string;
	title: string;
	summary: string;
	detailedContent?: string;
	keyMetrics?: Record<string, any>;
	currentTrends?: Array<{ trend: string; impact?: string; description?: string }>;
	featuredProducts?: Array<{ name: string; type: string; minInv: string; rationale: string }>;
	status: string;
	displayOrder?: number;
	publishedAt?: string;
}

const fallbackClientInsights: Record<string, AssetClassInsight> = {
	mutual_funds: {
		id: "aci-mutual-funds",
		assetClass: "mutual_funds",
		title: "Mutual Funds (Direct & Regular)",
		summary: "Pooled investment vehicles regulated under SEBI (Mutual Funds) Regulations, 1996. Offering liquid, transparent access across Equity, Debt, and Hybrid strategies with systematic investment plans (SIPs).",
		detailedContent: `### Regulatory Framework & Categorization
Mutual Funds in India are strictly governed by SEBI's 2017 Categorization & Rationalization circular, segregating schemes into 5 broad buckets:
1. **Equity Schemes**: Multi-Cap, Large-Cap, Large & Mid Cap, Mid-Cap, Small-Cap, Flexi-Cap, ELSS, Sectoral/Thematic, Value/Contra. Minimum 65% equity exposure required for domestic equity taxation.
2. **Debt Schemes**: Overnight, Liquid, Ultra Short, Money Market, Short Duration, Corporate Bond, Banking & PSU, Gilt.
3. **Hybrid Schemes**: Conservative Hybrid, Balanced Hybrid, Aggressive Hybrid (65-80% equity), Dynamic Asset Allocation / Balanced Advantage, Multi-Asset Allocation (min 10% in 3 asset classes).
4. **Solution Oriented**: Retirement, Children's Funds (5-year lock-in).
5. **Other Schemes**: Index Funds, ETFs, Fund of Funds (FoFs).

### FY25-26 Budget Tax Architecture (Section 112A & 111A)
- **Equity Schemes (>65% Equity)**:
  - **LTCG (Holding > 12 months)**: Taxed at 12.5% on annual gains exceeding ₹1.25 Lakhs (enhanced from ₹1 Lakh under Budget 2024).
  - **STCG (Holding ≤ 12 months)**: Taxed at 20% flat (increased from 15% under Section 111A).
- **Debt Schemes (≤35% Equity)**:
  - Acquired on or after April 1, 2023: Taxed at investor's applicable marginal income tax slab rate as Short-Term Capital Gains under Section 50AA, without indexation.
- **Hybrid & Multi-Asset Schemes**:
  - Schemes with 35% to 65% domestic equity: Holding period 24 months for LTCG, taxed at 12.5% without indexation; STCG at slab rate.

### Advisor Suitability & Risk Profiling
- SIP compounding remains the bedrock of Indian retail wealth accumulation, with industry monthly run-rates sustaining above ₹26,000 Crores.
- Ideal for retail through HNI investors seeking active fund manager alpha or low-cost index tracking.`,
		keyMetrics: {
			totalAUM: "₹67.25+ Lakh Cr",
			monthlySipRunRate: "₹26,450+ Cr/month",
			benchmark10YCagr: "14.8% p.a. (Nifty 50 TRI)",
			settlementCycle: "T+1 (Equity/Debt) / T+2 (International)",
			typicalHorizon: "3 to 7+ Years",
			riskProfile: "Low to Very High (Categorized)",
			taxationRule: "12.5% LTCG (>₹1.25L) | 20% STCG | Debt at Slab",
		},
		currentTrends: [
			{
				trend: "Record Domestic SIP Inflows",
				impact: "positive",
				description: "Retail investors contribute over ₹26,000 Cr every month via SIPs, providing domestic liquidity buffers against foreign portfolio volatility.",
			},
			{
				trend: "Rapid Expansion of Multi-Asset Allocation Funds",
				impact: "positive",
				description: "Surge in multi-asset strategies dynamically rebalancing domestic equity, fixed income, and gold/commodities with equity taxation advantages.",
			},
			{
				trend: "Rise of Smart Beta & Factor Passives",
				impact: "neutral",
				description: "Advisors increasingly blending active alpha funds with low-cost Nifty Momentum and Low Volatility 30 index funds.",
			},
		],
		featuredProducts: [
			{
				name: "Multi-Asset Allocation Balanced Strategy",
				type: "Hybrid Mutual Fund",
				minInv: "₹1,000 (SIP)",
				rationale: "Automated dynamic rebalancing across equities, debt, and gold with low portfolio volatility.",
			},
			{
				name: "Large & Mid Cap Alpha Growth Fund",
				type: "Equity Mutual Fund",
				minInv: "₹1,000 (SIP)",
				rationale: "Combines large-cap corporate stability with mid-cap earnings acceleration for long-term compounders.",
			},
			{
				name: "Corporate Bond Fund (Banking & PSU)",
				type: "Debt Mutual Fund",
				minInv: "₹5,000",
				rationale: "High credit quality sovereign & AAA PSU exposure minimizing default risk while generating steady accruals.",
			},
		],
		status: "published",
	},
	stocks: {
		id: "aci-stocks",
		assetClass: "stocks",
		title: "Direct Equities (Listed Stocks)",
		summary: "Direct equity shares listed on NSE and BSE offering fractional ownership in India's leading corporations. Primary engine for wealth creation, corporate dividends, and long-term GDP compounding.",
		detailedContent: `### Market Ecosystem & SEBI Regulatory Oversight
Direct equities represent ownership stakes in publicly listed companies on the National Stock Exchange (NSE) and Bombay Stock Exchange (BSE), regulated under SEBI (Listing Obligations and Disclosure Requirements) Regulations, 2015 (LODR).

### Market Capitalization Segregation (SEBI Standard)
- **Large-Cap**: Top 100 companies by full market capitalization. Institutional favorites characterized by stable return on capital, robust balance sheets, and steady cash flows.
- **Mid-Cap**: 101st to 250th companies by market capitalization. High-growth enterprises expanding market share, offering superior earnings CAGR.
- **Small-Cap**: 251st company onwards. High beta, high volatility companies offering multibagger upside but sensitive to economic cycles.

### Settlement & Operational Safeguards
- **T+1 Rolling Settlement**: Indian equity markets operate on an ultra-efficient T+1 settlement cycle (with optional T+0 facility for top liquid scrips).
- **Direct Demat Credit**: Securities are held safely in investor Demat accounts via NSDL or CDSL with dual-factor client verification.

### FY25-26 Budget Taxation Framework
- **Long-Term Capital Gains (LTCG - Section 112A)**: Holding period > 12 months. Taxed at 12.5% on capital gains exceeding ₹1.25 Lakh exemption threshold.
- **Short-Term Capital Gains (STCG - Section 111A)**: Holding period ≤ 12 months. Taxed at 20% flat.
- **Dividend Income**: Taxable in the hands of the investor at applicable personal income tax slab rates; TDS of 10% deducted if dividend exceeds ₹5,000.`,
		keyMetrics: {
			totalMarketCap: "₹450+ Lakh Cr (BSE Listed M-Cap)",
			benchmark10YCagr: "13.6% p.a. (Sensex TRI) / 14.2% (Nifty 50)",
			marketPE: "22.8x (Nifty 50 P/E)",
			settlementCycle: "T+1 Settlement (NSDL / CDSL Demat)",
			typicalHorizon: "5 to 10+ Years",
			riskProfile: "High to Very High",
			taxationRule: "12.5% LTCG (>₹1.25L) | 20% STCG | Dividends at Slab",
		},
		currentTrends: [
			{
				trend: "India Manufacturing & Capex Cycle",
				impact: "positive",
				description: "Production-Linked Incentive (PLI) schemes, defense indigenization, and private capex driving multi-year order books for industrials.",
			},
			{
				trend: "Direct Demat Participation Surge",
				impact: "positive",
				description: "Active Demat accounts crossed 160 million with strong retail liquidity absorption across secondary markets and IPOs.",
			},
		],
		featuredProducts: [
			{
				name: "Nifty 50 Bluechip Core Basket",
				type: "Direct Equities",
				minInv: "Market Lot",
				rationale: "Diversified exposure to India's top 50 corporate pillars across banking, IT, energy, FMCG, and automobiles.",
			},
			{
				name: "Manufacturing & Infrastructure Growth Portfolio",
				type: "Thematic Direct Equity",
				minInv: "₹25,000",
				rationale: "High-conviction portfolio riding capital expenditure, defense indigenization, and supply-chain re-shoring.",
			},
		],
		status: "published",
	},
	bonds_ncds: {
		id: "aci-bonds-ncds",
		assetClass: "bonds_ncds",
		title: "Bonds & Corporate NCDs",
		summary: "Fixed-income securities encompassing Sovereign Government Securities (G-Secs), State Development Loans (SDLs), and CRISIL/ICRA AAA/AA+ rated Corporate Non-Convertible Debentures.",
		detailedContent: `### Regulatory Framework & Asset Protection
Fixed income instruments in India are regulated under the dual supervision of the Reserve Bank of India (RBI) and SEBI (Issue and Listing of Non-Convertible Securities) Regulations, 2021 (NCS Regulations).

### Asset Sub-Categories & Risk Spectrum
1. **Central Government Securities (G-Secs)**: Zero credit risk / sovereign backing. Benchmark 10-year G-Sec yields currently range between 6.75% and 6.85%.
2. **State Development Loans (SDLs)**: State government issuances offering 25-45 bps spread over central G-Secs with implicit sovereign assurance.
3. **Public Sector Undertaking (PSU) Bonds**: AAA-rated issuances from government-backed entities like PFC, REC, NABARD, and IRFC.
4. **Corporate Non-Convertible Debentures (NCDs)**: Senior secured debt instruments from private enterprises offering regular coupon payments (monthly, quarterly, or annual).

### FY25-26 Budget Taxation Framework (Section 50AA)
- **Market-Linked Debentures (MLDs) & Specified Debt Securities**:
  - Capital gains arising from transfer or redemption are deemed as Short-Term Capital Gains regardless of holding period and taxed at investor's applicable marginal income tax slab.
- **Regular Listed Corporate Bonds & G-Secs**:
  - Coupon / Interest payments: Taxable at applicable slab rates.
  - Transfer of listed bonds on stock exchanges: Holding period > 12 months taxed at 12.5% without indexation; STCG at applicable slab rate.`,
		keyMetrics: {
			benchmark10YYield: "6.75% - 6.85% (GOI 10Y Benchmark)",
			corporateAaaSpread: "+60 to +85 bps (7.45% - 7.75% YTM)",
			creditRatingQuality: "Sovereign / AAA / AA+ Regulated",
			settlementCycle: "T+1 via CCIL / Exchange Clearing Corp",
			typicalHorizon: "1 to 10 Years (Matched to Duration)",
			riskProfile: "Low to Moderate (Credit & Duration Risk)",
			taxationRule: "Interest at Slab Rate | Listed Bond LTCG 12.5%",
		},
		currentTrends: [
			{
				trend: "Global Sovereign Bond Index Inclusion",
				impact: "positive",
				description: "JP Morgan GBI-EM and Bloomberg Emerging Market index inclusion driving structural foreign institutional inflows into Fully Accessible Route (FAR) G-Secs.",
			},
			{
				trend: "RBI Interest Rate Easing Cycle Anticipation",
				impact: "positive",
				description: "Expected policy rate cuts position medium-to-long duration debt funds and 7-10 year G-Secs for duration capital appreciation.",
			},
		],
		featuredProducts: [
			{
				name: "7.10% GS 2034 Sovereign 10-Year Benchmark G-Sec",
				type: "Government Security",
				minInv: "₹10,000",
				rationale: "Absolute sovereign safety with semi-annual coupon distributions and secondary exchange liquidity.",
			},
			{
				name: "NABARD / PFC AAA Senior Secured Corporate NCD",
				type: "Public Sector Enterprise Bond",
				minInv: "₹10,000",
				rationale: "Top-tier AAA credit rating offering 7.65% annual yield with high capital safety.",
			},
		],
		status: "published",
	},
	global_etfs: {
		id: "aci-global-etfs",
		assetClass: "global_etfs",
		title: "Global ETFs & International Equities",
		summary: "Cross-border investment vehicles providing geographic diversification into leading global corporations across the US (S&P 500, Nasdaq 100), Europe, and developed markets under RBI LRS guidelines.",
		detailedContent: `### Regulatory Framework & International Exposure
Indian residents can invest in international securities through two primary channels:
1. **Domestic Mutual Funds / Feeder ETFs**: Listed on Indian exchanges investing in overseas securities or fund-of-funds.
2. **Direct Overseas Investing under RBI Liberalized Remittance Scheme (LRS)**: Allows resident individuals to remit up to **USD 250,000** per financial year for permitted capital account transactions including overseas equities, US ETFs, and index funds.

### Strategic Portfolio Rationale
- **Currency Depreciation Hedge**: Historically, the Indian Rupee (INR) has depreciated against the US Dollar (USD) at ~3.0% to 3.5% CAGR, providing an organic currency return booster for Indian investors holding USD assets.
- **Participating in Global Innovation**: Provides direct ownership of global technology giants (Apple, Microsoft, NVIDIA, Alphabet, Amazon), pharmaceutical leaders, and semiconductor supply chains.

### FY25-26 Budget Taxation Framework & TCS
- **RBI TCS (Tax Collected at Source)**:
  - Remittances up to ₹7 Lakhs/year: Nil TCS.
  - Remittances exceeding ₹7 Lakhs/year: 20% TCS collected at source by authorized dealer banks (fully adjustable or refundable against annual income tax liability).
- **Capital Gains Taxation (Post-Budget 2024)**:
  - **Unlisted Foreign Shares / Direct US ETFs**: Holding period > 24 months classified as Long-Term Capital Gains, taxed at **12.5%** without indexation.
  - Short-Term Capital Gains (Holding ≤ 24 months): Taxed at investor's applicable marginal slab rates.`,
		keyMetrics: {
			geographicReach: "US (S&P 500 / Nasdaq 100), Europe, Global Tech",
			rbiLrsQuota: "$250,000 USD / financial year / individual",
			historicalInrUsdDepr: "~3.0% - 3.5% p.a. organic currency tailwind",
			settlementCycle: "T+1 (US Markets & Domestic Feeder ETFs)",
			typicalHorizon: "5 to 7+ Years",
			riskProfile: "Moderate to High (Market & FX Risk)",
			taxationRule: "12.5% LTCG (>24m) | Slab STCG | 20% TCS > ₹7L",
		},
		currentTrends: [
			{
				trend: "Global Artificial Intelligence & Hyperscaler Momentum",
				impact: "positive",
				description: "Leading US technology and semiconductor manufacturers generating exponential cash flow growth driven by enterprise AI deployments.",
			},
			{
				trend: "Direct LRS Route Becoming Primary Channel",
				impact: "positive",
				description: "With Indian mutual funds near SEBI/RBI overseas limits, HNIs and tech professionals increasingly use direct LRS accounts.",
			},
		],
		featuredProducts: [
			{
				name: "Vanguard S&P 500 ETF (VOO)",
				type: "US Broad Market ETF",
				minInv: "Fractional Shares ($1)",
				rationale: "Lowest-cost (0.03% expense ratio) access to the 500 largest US publicly traded corporations.",
			},
			{
				name: "Invesco QQQ Trust (Nasdaq 100)",
				type: "US Innovation & Tech ETF",
				minInv: "Fractional Shares ($1)",
				rationale: "Targeted exposure to global leaders in enterprise cloud, cybersecurity, biotechnology, and generative AI.",
			},
		],
		status: "published",
	},
	aif_pms: {
		id: "aci-aif-pms",
		assetClass: "aif_pms",
		title: "AIF & PMS (Alternative Investments & Portfolio Management)",
		summary: "Sophisticated, bespoke investment strategies for High Net Worth Individuals (HNIs) and Family Offices, regulated under SEBI (AIF) Regulations, 2012 and SEBI (PMS) Regulations, 2020.",
		detailedContent: `### Regulatory Framework & Minimum Ticket Sizes
SEBI provides stringent investor protection and governance standards for bespoke wealth vehicles:
1. **Portfolio Management Services (PMS)**: Governed by SEBI (Portfolio Managers) Regulations, 2020.
   - **Minimum Ticket Size**: **₹50 Lakhs** per client.
   - **Structure**: Discretionary (manager takes decisions), Non-Discretionary, or Advisory. Securities remain in the client's own separate Demat account.
2. **Alternative Investment Funds (AIF)**: Governed by SEBI (Alternative Investment Funds) Regulations, 2012.
   - **Minimum Ticket Size**: **₹1.00 Crore** (₹25 Lakhs for accredited investors).
   - **Category I AIF**: Venture Capital Funds (VCF), SME Funds, Social Venture Funds, Infrastructure Funds.
   - **Category II AIF**: Private Equity Funds, Debt Funds, Real Estate Funds, Special Situations Funds.
   - **Category III AIF**: Long-Short Hedge Funds, Complex Derivative Strategies, Quantitative Public Equity Alpha Funds.
3. **SEBI Specialized Investment Funds (SIF / New Asset Class)**:
   - SEBI's newly approved bridge category between Mutual Funds and PMS with a **₹10 Lakh** minimum investment threshold.

### Taxation Treatment (Category-Specific)
- **PMS**: Pass-through structure. Every buy/sell transaction reflects directly in the client's Demat and is taxed as normal direct equity/debt capital gains (12.5% LTCG, 20% STCG).
- **Category I & II AIF**: Statutory pass-through tax status under Section 115UB of the Income Tax Act.
- **Category III AIF**: Taxed at the investment fund level at the Maximum Marginal Rate (MMR) of income tax.`,
		keyMetrics: {
			sebiMinTicketPms: "₹50 Lakhs (SEBI Regulatory Minimum)",
			sebiMinTicketAif: "₹1.00 Crore (Cat I, II, III AIF)",
			industryCombinedAum: "₹11.50+ Lakh Cr",
			feeStructures: "1.5%-2% Mgmt Fee + 10-20% Hurdle Carry",
			typicalHorizon: "3 to 7 Years (Lock-ins in PE/Debt AIFs)",
			riskProfile: "High to Very High (Sophisticated Investors)",
			taxationRule: "Pass-Through (Cat I/II & PMS) | MMR Fund Level (Cat III)",
		},
		currentTrends: [
			{
				trend: "Private Credit Boom in Category II AIFs",
				impact: "positive",
				description: "Senior secured structured credit funds delivering 13.5% to 16% net internal rate of return (IRR) with 1.8x asset coverage.",
			},
			{
				trend: "SEBI Specialized Investment Fund (SIF) Regime",
				impact: "positive",
				description: "New ₹10 Lakhs ticket framework offering long-short and inverse hedging strategies previously restricted to ₹1 Cr AIFs.",
			},
		],
		featuredProducts: [
			{
				name: "Pioneer Concentrated Multicap PMS",
				type: "Discretionary Equity PMS",
				minInv: "₹50 Lakhs",
				rationale: "High-conviction 18-22 stock portfolio focused on compounding businesses with 20%+ return on equity (ROE).",
			},
			{
				name: "Senior Secured Corporate Credit Fund (Cat II AIF)",
				type: "Private Debt AIF",
				minInv: "₹1 Crore",
				rationale: "Targeting 14% gross IRR with quarterly cash yield distributions and senior first-charge collateral security.",
			},
		],
		status: "published",
	},
};

export default function AgentKnowledgeHub() {
	const [searchQuery, setSearchQuery] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const [showFlashcards, setShowFlashcards] = useState(false);
	const [flashcardCategory, setFlashcardCategory] = useState("all");
	const [currentCardIndex, setCurrentCardIndex] = useState(0);
	const [isCardFlipped, setIsCardFlipped] = useState(false);

	const [selectedAssetClassId, setSelectedAssetClassId] = useState<string | null>(() => {
		if (typeof window === "undefined") return null;
		const params = new URLSearchParams(window.location.search);
		return params.get("assetClass") || null;
	});

	const { data: assetInsights = [] } = useQuery<AssetClassInsight[]>({
		queryKey: ["/api/knowledge-hub/asset-insights"],
	});

	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedQuery(searchQuery.trim());
		}, 250);
		return () => clearTimeout(timer);
	}, [searchQuery]);

	const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
		queryKey: ["/api/knowledge-hub/dashboard"],
	});

	const { data: disclaimer } = useQuery<Disclaimer>({
		queryKey: ["/api/knowledge-hub/disclaimers/active/general"],
	});

	const { data: cpeData } = useQuery<{ success: boolean; totalCertificates: number; criticalRenewals: number; upcomingRenewals: number; certifications: CpeStatusData["certifications"] }>({
		queryKey: ["/api/knowledge-hub/cpe-expiry-status"],
	});

	const { data: searchResults, isFetching: searchFetching } = useQuery<{
		success: boolean;
		total: number;
		results: {
			category: "Products" | "Templates" | "Certifications" | "Market Intelligence";
			title: string;
			description: string;
			link: string;
			badge?: string;
		}[];
	}>({
		queryKey: ["/api/knowledge-hub/omnisearch", debouncedQuery],
		queryFn: async () => {
			const res = await fetch(`/api/knowledge-hub/omnisearch?q=${encodeURIComponent(debouncedQuery)}`);
			return res.json();
		},
		enabled: debouncedQuery.length >= 2,
	});

	const { data: flashcardsData } = useQuery<{ success: boolean; flashcards: Flashcard[] }>({
		queryKey: ["/api/knowledge-hub/flashcards", flashcardCategory],
		queryFn: async () => {
			const res = await fetch(`/api/knowledge-hub/flashcards?category=${encodeURIComponent(flashcardCategory)}`);
			return res.json();
		},
		enabled: showFlashcards,
	});

	const quickLinks = [
		{
			title: "Today's Market Brief",
			description: "AI-generated daily market intelligence",
			icon: TrendingUp,
			href: "/agent/knowledge-hub/market-brief",
			color: "text-blue-500",
			bgColor: "bg-blue-500/10",
		},
		{
			title: "Product Knowledge Cards",
			description: "Comprehensive product information",
			icon: FileCheck,
			href: "/agent/knowledge-hub/products",
			color: "text-emerald-500",
			bgColor: "bg-emerald-500/10",
		},
		{
			title: "Client Explanations",
			description: "Ready-to-use explanation templates",
			icon: Lightbulb,
			href: "/agent/knowledge-hub/explanations",
			color: "text-amber-500",
			bgColor: "bg-amber-500/10",
		},
		{
			title: "NISM & IRDAI Academy",
			description: "Accredited NISM/POSP courses, CPE credits & practice tests",
			icon: GraduationCap,
			href: "/agent/knowledge-hub/certifications",
			color: "text-emerald-500",
			bgColor: "bg-emerald-500/10",
		},
	];

	const assetClasses = [
		{ id: "mutual_funds", name: "Mutual Funds", icon: "📊", highlight: "₹67L+ Cr AUM • 14.8% 10Y CAGR", description: "SEBI regulated pooled schemes with dynamic SIP run-rates" },
		{ id: "stocks", name: "Stocks", icon: "📈", highlight: "NSE/BSE T+1 • 22.8x P/E", description: "Direct listed equities with high-conviction compound growth" },
		{ id: "bonds_ncds", name: "Bonds & NCDs", icon: "🏛️", highlight: "6.8% - 7.7% YTM • Sovereign / AAA", description: "Fixed income capital preservation with predictable cash flows" },
		{ id: "global_etfs", name: "Global ETFs", icon: "🌍", highlight: "$250k LRS • S&P 500 & Tech", description: "Cross-border dollar asset accumulation & USD currency hedge" },
		{ id: "aif_pms", name: "AIF/PMS", icon: "💎", highlight: "₹50L PMS / ₹1Cr AIF • Alpha", description: "Bespoke wealth vehicles with concentrated non-correlated alpha" },
	];

	const flashcards = flashcardsData?.flashcards || [];
	const currentCard = flashcards[currentCardIndex] || null;

	const handleNextCard = () => {
		setIsCardFlipped(false);
		setCurrentCardIndex((prev) => (prev + 1) % (flashcards.length || 1));
	};

	const handlePrevCard = () => {
		setIsCardFlipped(false);
		setCurrentCardIndex((prev) => (prev - 1 + flashcards.length) % (flashcards.length || 1));
	};

	if (statsLoading) {
		return (
			<div className="p-6 space-y-6">
				<Skeleton className="h-10 w-64 bg-card" />
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
					{[1, 2, 3, 4].map((i) => (
						<Skeleton key={i} className="h-32 bg-card" />
					))}
				</div>
				<Skeleton className="h-64 bg-card" />
			</div>
		);
	}

	return (
		<div className="p-6 space-y-6">
			{/* Top Header */}
			<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
						<BookOpen className="h-7 w-7 text-emerald-500" />
						Agent Knowledge Hub
					</h1>
					<p className="text-muted-foreground mt-1">
						Market intelligence, product knowledge, and regulatory compliance tools
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							setShowFlashcards(true);
							setCurrentCardIndex(0);
							setIsCardFlipped(false);
						}}
						className="border-primary/40 text-primary hover:bg-primary/10 gap-1.5"
					>
						<Layers className="h-4 w-4" />
						Revision Flashcards
					</Button>
					<Badge
						variant="outline"
						className="border-emerald-500/50 text-emerald-400"
					>
						<Clock className="h-3 w-3 mr-1" />
						Updated {format(new Date(), "MMM d, HH:mm")}
					</Badge>
				</div>
			</div>

			{/* Knowledge Hub Omnisearch Bar */}
			<div className="relative">
				<div className="relative flex items-center">
					<Search className="absolute left-3.5 h-4 w-4 text-muted-foreground pointer-events-none" />
					<Input
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Search products, client explanation templates, NISM/IRDAI syllabus, or market briefs..."
						className="pl-10 pr-10 py-6 text-sm bg-card/60 border-border focus-visible:ring-emerald-500"
					/>
					{searchQuery && (
						<button
							onClick={() => setSearchQuery("")}
							className="absolute right-3.5 text-muted-foreground hover:text-foreground"
						>
							<X className="h-4 w-4" />
						</button>
					)}
				</div>

				{/* Omnisearch Results Dropdown */}
				{debouncedQuery.length >= 2 && (
					<Card className="absolute z-50 left-0 right-0 mt-2 shadow-2xl border-emerald-500/30 bg-background/95 backdrop-blur-md max-h-96 overflow-y-auto">
						<CardContent className="p-3">
							<div className="flex items-center justify-between pb-2 mb-2 border-b border-border/50 text-xs text-muted-foreground">
								<span>
									{searchFetching
										? "Searching Knowledge Hub..."
										: `Found ${searchResults?.total || 0} results for "${debouncedQuery}"`}
								</span>
								<span className="text-[11px] text-emerald-400">Click any result to view</span>
							</div>

							{searchResults?.results?.length === 0 && !searchFetching ? (
								<div className="py-6 text-center text-sm text-muted-foreground">
									No matching knowledge cards or templates found. Try searching for terms like "Flexi Cap", "Budget 2024", or "NISM".
								</div>
							) : (
								<div className="space-y-1.5">
									{searchResults?.results?.map((res, idx) => (
										<Link key={idx} href={res.link}>
											<div className="p-2.5 rounded-lg hover:bg-card/90 transition-colors cursor-pointer border border-transparent hover:border-border flex items-start justify-between gap-3">
												<div className="space-y-0.5">
													<div className="flex items-center gap-2">
														<span className="font-semibold text-sm text-foreground">
															{res.title}
														</span>
														{res.badge && (
															<Badge variant="outline" className="text-[10px] py-0 px-1.5">
																{res.badge}
															</Badge>
														)}
													</div>
													<p className="text-xs text-muted-foreground line-clamp-1">
														{res.description}
													</p>
												</div>
												<Badge className="text-[10px] shrink-0 bg-primary/10 text-primary border-primary/20">
													{res.category}
												</Badge>
											</div>
										</Link>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				)}
			</div>

			{disclaimer && (
				<Alert className="bg-amber-500/10 border-amber-500/30">
					<AlertTriangle className="h-4 w-4 text-amber-500" />
					<AlertTitle className="text-amber-400">Disclaimer</AlertTitle>
					<AlertDescription className="text-amber-200/80 text-sm">
						{disclaimer.shortContent || disclaimer.content}
					</AlertDescription>
				</Alert>
			)}

			{/* Quick Links Grid */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				{quickLinks.map((link) => (
					<Link key={link.href} href={link.href}>
						<Card
							className="bg-background border-border hover:border-border transition-colors cursor-pointer h-full"
							data-testid={`card-${link.title.toLowerCase().replace(/\s+/g, "-")}`}
						>
							<CardContent className="p-4">
								<div
									className={`w-10 h-10 rounded-lg ${link.bgColor} flex items-center justify-center mb-3`}
								>
									<link.icon className={`h-5 w-5 ${link.color}`} />
								</div>
								<h3 className="font-semibold text-foreground mb-1">
									{link.title}
								</h3>
								<p className="text-sm text-muted-foreground">
									{link.description}
								</p>
								<div className="flex items-center mt-3 text-sm text-emerald-400">
									<span>View</span>
									<ChevronRight className="h-4 w-4 ml-1" />
								</div>
							</CardContent>
						</Card>
					</Link>
				))}
			</div>

			{/* 3-Year Certification Expiry & CPE Renewal Tracker */}
			{cpeData?.certifications && cpeData.certifications.length > 0 && (
				<Card className="bg-background border-border">
					<CardHeader className="pb-3">
						<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
							<div>
								<CardTitle className="text-foreground flex items-center gap-2 text-base sm:text-lg">
									<GraduationCap className="h-5 w-5 text-emerald-500" />
									Certification Expiry & CPE Renewal Cockpit
								</CardTitle>
								<CardDescription className="text-xs sm:text-sm text-muted-foreground">
									Monitors 3-year SEBI/AMFI NISM and IRDAI accreditation validity & mandatory CPE credits
								</CardDescription>
							</div>
							<Link href="/agent/knowledge-hub/certifications">
								<Button variant="outline" size="sm" className="text-xs h-8 border-border">
									Launch Academy
									<ArrowRight className="h-3.5 w-3.5 ml-1.5" />
								</Button>
							</Link>
						</div>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							{cpeData.certifications.map((cert) => {
								const daysPct = Math.min(100, Math.round((cert.daysRemaining / (3 * 365)) * 100));
								return (
									<div
										key={cert.id}
										className="p-3.5 rounded-lg border border-border bg-card/40 space-y-3"
									>
										<div className="flex items-start justify-between gap-2">
											<div>
												<div className="flex items-center gap-2">
													<Badge variant="outline" className="text-[10px] font-semibold">
														{cert.certificateType}
													</Badge>
													<span className="font-semibold text-sm text-foreground">
														{cert.code}
													</span>
												</div>
												<p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
													{cert.title}
												</p>
											</div>
											<Badge
												className={
													cert.urgency === "critical"
														? "bg-red-500/20 text-red-400 border-red-500/30 text-[11px]"
														: cert.urgency === "warning"
														? "bg-amber-500/20 text-amber-400 border-amber-500/30 text-[11px]"
														: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[11px]"
												}
											>
												{cert.daysRemaining} days left
											</Badge>
										</div>

										<div className="space-y-1">
											<div className="flex justify-between text-xs text-muted-foreground">
												<span>Validity Countdown</span>
												<span>Expires: {cert.expiresAt}</span>
											</div>
											<Progress value={daysPct} className="h-1.5" />
										</div>

										<div className="flex items-center justify-between pt-1 border-t border-border/50 text-xs">
											<div className="flex items-center gap-1.5 text-muted-foreground">
												<CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
												<span>CPE: {cert.cpeHoursEarned}/{cert.cpeHoursRequired} hrs</span>
											</div>
											<a
												href={cert.cpeBookingUrl}
												target="_blank"
												rel="noopener noreferrer"
												className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium"
											>
												Book Renewal Slot
												<ExternalLink className="h-3 w-3" />
											</a>
										</div>
									</div>
								);
							})}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Today's Market Brief */}
			{(() => {
				const defaultBrief = {
					id: "mb-today-default",
					date: new Date().toISOString().split("T")[0],
					region: "india",
					marketSnapshot: "Indian equity benchmarks traded with positive bias as Nifty 50 and Sensex demonstrated strength supported by sustained domestic institutional inflows (DIIs). Bank Nifty outperformed led by frontline private and PSU lenders.",
					whatChanged: "Macroeconomic liquidity indicators remained stable with resilient institutional participation and continuous SIP momentum.",
					keyRisks: "Global crude volatility and shifting foreign institutional derivative positions.",
					publishedAt: new Date().toISOString(),
				};
				const briefToDisplay = stats?.todaysBrief || defaultBrief;

				return (
					<Card className="bg-background border-border">
						<CardHeader className="pb-3">
							<div className="flex items-center justify-between">
								<CardTitle className="text-foreground flex items-center gap-2">
									<TrendingUp className="h-5 w-5 text-blue-500" />
									Today's Market Brief
								</CardTitle>
								<Badge className="bg-blue-500/20 text-blue-400 border-0">
									{(briefToDisplay.region || "india").toUpperCase()}
								</Badge>
							</div>
							<CardDescription className="text-muted-foreground">
								{format(new Date(briefToDisplay.date), "EEEE, MMMM d, yyyy")}
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<div>
									<h4 className="text-sm font-medium text-muted-foreground mb-2">
										Market Snapshot
									</h4>
									<p className="text-muted-foreground text-sm line-clamp-3">
										{briefToDisplay.marketSnapshot}
									</p>
								</div>
								<div>
									<h4 className="text-sm font-medium text-muted-foreground mb-2">
										What Changed
									</h4>
									<p className="text-muted-foreground text-sm line-clamp-2">
										{briefToDisplay.whatChanged}
									</p>
								</div>
								{briefToDisplay.keyRisks && (
									<div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
										<h4 className="text-sm font-medium text-red-400 mb-1">
											Key Risks
										</h4>
										<p className="text-muted-foreground text-sm">
											{briefToDisplay.keyRisks}
										</p>
									</div>
								)}
								<Link href="/agent/knowledge-hub/market-brief">
									<Button
										variant="outline"
										className="w-full border-border hover:bg-card"
									>
										Read Full Brief
										<ArrowRight className="h-4 w-4 ml-2" />
									</Button>
								</Link>
							</div>
						</CardContent>
					</Card>
				);
			})()}

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<Card className="bg-background border-border">
					<CardHeader className="pb-3">
						<div className="flex items-center justify-between">
							<div>
								<CardTitle className="text-foreground flex items-center gap-2">
									<BarChart3 className="h-5 w-5 text-emerald-500" />
									Asset Class Insights
								</CardTitle>
								<CardDescription className="text-muted-foreground">
									Deep-dive institutional intelligence & regulatory frameworks across 5 core asset classes
								</CardDescription>
							</div>
							<Badge variant="outline" className="text-xs text-emerald-400 border-emerald-500/30">
								5 Configured
							</Badge>
						</div>
					</CardHeader>
					<CardContent>
						<div className="space-y-2">
							{assetClasses.map((asset) => (
								<button
									type="button"
									key={asset.id}
									onClick={() => setSelectedAssetClassId(asset.id)}
									className="w-full text-left flex items-center justify-between p-3 rounded-lg bg-card/50 hover:bg-card hover:border-emerald-500/30 border border-transparent cursor-pointer transition-all group"
									data-testid={`asset-${asset.id.replace(/_/g, "-")}`}
								>
									<div className="flex items-center gap-3">
										<span className="text-xl p-1.5 rounded-md bg-background/80 group-hover:scale-110 transition-transform">
											{asset.icon}
										</span>
										<div>
											<div className="text-foreground font-medium text-sm flex items-center gap-2">
												{asset.name}
												<span className="text-[11px] font-normal text-muted-foreground hidden sm:inline">
													• {asset.description}
												</span>
											</div>
											<p className="text-xs text-emerald-400/90 font-medium mt-0.5">
												{asset.highlight}
											</p>
										</div>
									</div>
									<div className="flex items-center gap-1 text-xs text-emerald-400 group-hover:translate-x-0.5 transition-transform shrink-0">
										<span className="font-medium">View Analysis</span>
										<ChevronRight className="h-4 w-4" />
									</div>
								</button>
							))}
						</div>
					</CardContent>
				</Card>

				<Card className="bg-background border-border">
					<CardHeader>
						<CardTitle className="text-foreground flex items-center gap-2">
							<LucideShield className="h-5 w-5 text-purple-500" />
							Your Knowledge Stats
						</CardTitle>
						<CardDescription className="text-muted-foreground">
							Track your learning progress
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-2 gap-4">
							<div className="p-4 rounded-lg bg-card/50 text-center">
								<p className="text-3xl font-bold text-foreground">
									{stats?.productCardsCount || 0}
								</p>
								<p className="text-sm text-muted-foreground">Product Cards</p>
							</div>
							<div className="p-4 rounded-lg bg-card/50 text-center">
								<p className="text-3xl font-bold text-foreground">
									{stats?.explanationTemplatesCount || 0}
								</p>
								<p className="text-sm text-muted-foreground">Templates</p>
							</div>
							<div className="p-4 rounded-lg bg-card/50 text-center">
								<p className="text-3xl font-bold text-foreground">
									{stats?.certificationsCount || 0}
								</p>
								<p className="text-sm text-muted-foreground">Certifications</p>
							</div>
							<div className="p-4 rounded-lg bg-card/50 text-center">
								<p className="text-3xl font-bold text-foreground">
									{stats?.assetInsightsCount || 0}
								</p>
								<p className="text-sm text-muted-foreground">Insights</p>
							</div>
						</div>
						<div className="mt-4 pt-4 border-t border-border">
							<Link href="/agent/knowledge-hub/certifications">
								<Button
									variant="outline"
									className="w-full border-border hover:bg-card"
								>
									Manage Certifications
									<ArrowRight className="h-4 w-4 ml-2" />
								</Button>
							</Link>
						</div>
					</CardContent>
				</Card>
			</div>

			{disclaimer && (
				<div className="text-xs text-muted-foreground text-center p-4 border-t border-border">
					<p>{disclaimer.content}</p>
					<p className="mt-1">Disclaimer Version: v{disclaimer.version}</p>
				</div>
			)}

			{/* Interactive Spaced-Repetition Flashcards Modal */}
			<Dialog open={showFlashcards} onOpenChange={setShowFlashcards}>
				<DialogContent className="max-w-xl bg-background border-border">
					<DialogHeader>
						<div className="flex items-center justify-between">
							<DialogTitle className="flex items-center gap-2 text-lg">
								<Layers className="h-5 w-5 text-emerald-500" />
								Regulatory & Quantitative Flashcards
							</DialogTitle>
						</div>
						<DialogDescription>
							High-yield spaced repetition revision for SEBI, NISM, and IRDAI mastery. Click the card to flip between Question and Answer.
						</DialogDescription>
					</DialogHeader>

					{/* Category Selector */}
					<div className="flex flex-wrap gap-1.5 my-2">
						{[
							{ id: "all", label: "All Topics" },
							{ id: "Formulas & Quant", label: "Formulas & Quant" },
							{ id: "Budget 2024 Tax Laws", label: "Budget 2024 Tax" },
							{ id: "IRDAI Compliance", label: "IRDAI Rules" },
							{ id: "SEBI Code of Conduct", label: "SEBI Conduct" },
						].map((cat) => (
							<Button
								key={cat.id}
								variant={flashcardCategory === cat.id ? "default" : "outline"}
								size="sm"
								className="text-xs h-7 px-2.5"
								onClick={() => {
									setFlashcardCategory(cat.id);
									setCurrentCardIndex(0);
									setIsCardFlipped(false);
								}}
							>
								{cat.label}
							</Button>
						))}
					</div>

					{/* Flashcard Body */}
					{currentCard ? (
						<div className="space-y-4">
							<button
								type="button"
								onClick={() => setIsCardFlipped(!isCardFlipped)}
								className={`min-h-[220px] p-6 rounded-xl border cursor-pointer transition-all duration-300 flex flex-col justify-between text-left w-full ${
									isCardFlipped
										? "bg-emerald-950/20 border-emerald-500/40 text-foreground"
										: "bg-card/70 border-border hover:border-emerald-500/30"
								}`}
							>
								<div className="flex items-center justify-between">
									<Badge variant="outline" className="text-xs font-semibold">
										{currentCard.category}
									</Badge>
									<span className="text-xs text-muted-foreground flex items-center gap-1">
										<HelpCircle className="h-3.5 w-3.5" />
										{isCardFlipped ? "Showing Answer" : "Click card to flip"}
									</span>
								</div>

								<div className="my-4">
									{isCardFlipped ? (
										<div className="space-y-2">
											<p className="text-xs uppercase tracking-wider text-emerald-400 font-semibold">
												Regulatory Answer & Formula
											</p>
											<p className="text-sm font-medium text-foreground whitespace-pre-line leading-relaxed">
												{currentCard.answer}
											</p>
											<div className="pt-2 border-t border-emerald-500/20 text-xs text-muted-foreground">
												<span className="font-semibold text-emerald-300">Statutory Key: </span>
												{currentCard.significance}
											</div>
										</div>
									) : (
										<div className="space-y-2">
											<p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
												Core Question
											</p>
											<p className="text-base font-semibold text-foreground leading-snug">
												{currentCard.question}
											</p>
										</div>
									)}
								</div>

								<div className="text-right text-xs text-muted-foreground">
									Card {currentCardIndex + 1} of {flashcards.length}
								</div>
							</button>

							{/* Navigation Controls */}
							<div className="flex items-center justify-between">
								<Button
									variant="outline"
									size="sm"
									onClick={handlePrevCard}
									disabled={flashcards.length <= 1}
								>
									<ChevronLeft className="h-4 w-4 mr-1" />
									Previous
								</Button>
								<Button
									variant="secondary"
									size="sm"
									onClick={() => setIsCardFlipped(!isCardFlipped)}
								>
									<RefreshCw className="h-4 w-4 mr-1" />
									{isCardFlipped ? "Show Question" : "Reveal Answer"}
								</Button>
								<Button
									variant="outline"
									size="sm"
									onClick={handleNextCard}
									disabled={flashcards.length <= 1}
								>
									Next
									<ChevronRight className="h-4 w-4 ml-1" />
								</Button>
							</div>
						</div>
					) : (
						<div className="py-8 text-center text-sm text-muted-foreground">
							No flashcards found for this topic.
						</div>
					)}
				</DialogContent>
			</Dialog>

			{/* Asset Class Insights Deep-Dive Dialog */}
			<Dialog
				open={!!selectedAssetClassId}
				onOpenChange={(open) => {
					if (!open) setSelectedAssetClassId(null);
				}}
			>
				<DialogContent className="max-w-3xl max-h-[90vh] bg-background border-border flex flex-col p-0">
					{(() => {
						if (!selectedAssetClassId) return null;
						const activeInsight =
							assetInsights.find((i) => i.assetClass === selectedAssetClassId) ||
							fallbackClientInsights[selectedAssetClassId] ||
							null;

						if (!activeInsight) return null;

						const currentAssetMeta = assetClasses.find((a) => a.id === selectedAssetClassId) || {
							icon: "📊",
							name: activeInsight.title,
						};

						return (
							<>
								<DialogHeader className="p-6 pb-4 border-b border-border">
									<div className="flex items-center justify-between gap-3">
										<div className="flex items-center gap-3">
											<span className="text-3xl p-2 rounded-xl bg-card border border-border">
												{currentAssetMeta.icon}
											</span>
											<div>
												<DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
													{activeInsight.title}
												</DialogTitle>
												<DialogDescription className="text-xs text-muted-foreground mt-0.5">
													SEBI Regulatory Intelligence & Asset Allocation Playbook
												</DialogDescription>
											</div>
										</div>
										<Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs shrink-0">
											SEBI Compliant
										</Badge>
									</div>
								</DialogHeader>

								<ScrollArea className="flex-1 p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]">
									{/* Strategic Summary */}
									<div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-1.5">
										<div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
											<Sparkles className="h-3.5 w-3.5" />
											Strategic Rationale & Executive Summary
										</div>
										<p className="text-sm text-foreground leading-relaxed">
											{activeInsight.summary}
										</p>
									</div>

									{/* Key Metrics Grid */}
									{activeInsight.keyMetrics && Object.keys(activeInsight.keyMetrics).length > 0 && (
										<div>
											<h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
												<BarChart3 className="h-3.5 w-3.5 text-blue-400" />
												Key Financial & Regulatory Metrics
											</h4>
											<div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
												{Object.entries(activeInsight.keyMetrics).map(([key, val]) => (
													<div
														key={key}
														className="p-3 rounded-lg bg-card/60 border border-border space-y-1"
													>
														<p className="text-[11px] text-muted-foreground font-medium capitalize">
															{key.replace(/([A-Z])/g, " $1").trim()}
														</p>
														<p className="text-xs sm:text-sm font-semibold text-foreground">
															{String(val)}
														</p>
													</div>
												))}
											</div>
										</div>
									)}

									{/* Current Macro Trends */}
									{activeInsight.currentTrends && activeInsight.currentTrends.length > 0 && (
										<div>
											<h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
												<TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
												Current Macro Trends & Structural Drivers
											</h4>
											<div className="space-y-2.5">
												{activeInsight.currentTrends.map((t, idx) => (
													<div
														key={idx}
														className="p-3.5 rounded-lg bg-card/40 border border-border space-y-1.5"
													>
														<div className="flex items-center justify-between gap-2">
															<span className="text-sm font-semibold text-foreground">
																{t.trend}
															</span>
															<Badge
																variant="outline"
																className={
																	t.impact === "positive"
																		? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]"
																		: "bg-blue-500/10 text-blue-400 border-blue-500/30 text-[10px]"
																}
															>
																{t.impact ? t.impact.toUpperCase() : "NEUTRAL"}
															</Badge>
														</div>
														{t.description && (
															<p className="text-xs text-muted-foreground leading-relaxed">
																{t.description}
															</p>
														)}
													</div>
												))}
											</div>
										</div>
									)}

									{/* In-Depth Regulatory Framework & Taxation */}
									{activeInsight.detailedContent && (
										<div>
											<h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
												<FileCheck className="h-3.5 w-3.5 text-amber-400" />
												Regulatory Blueprint & Taxation Framework
											</h4>
											<div className="p-4 rounded-xl bg-card/30 border border-border text-xs sm:text-sm text-foreground/90 space-y-3 leading-relaxed whitespace-pre-line">
												{activeInsight.detailedContent}
											</div>
										</div>
									)}

									{/* Featured Products & Strategies */}
									{activeInsight.featuredProducts && activeInsight.featuredProducts.length > 0 && (
										<div>
											<h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
												<Layers className="h-3.5 w-3.5 text-purple-400" />
												Recommended Investment Strategies
											</h4>
											<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
												{activeInsight.featuredProducts.map((p, pIdx) => (
													<div
														key={pIdx}
														className="p-3.5 rounded-lg bg-card/60 border border-border space-y-2 flex flex-col justify-between"
													>
														<div>
															<div className="flex items-center justify-between gap-1 mb-1">
																<Badge variant="outline" className="text-[10px] text-muted-foreground">
																	{p.type || "Core Strategy"}
																</Badge>
																{p.minInv && (
																	<span className="text-[11px] text-emerald-400 font-medium">
																		Min: {p.minInv}
																	</span>
																)}
															</div>
															<p className="text-sm font-semibold text-foreground">
																{p.name}
															</p>
															{p.rationale && (
																<p className="text-xs text-muted-foreground mt-1 line-clamp-2">
																	{p.rationale}
																</p>
															)}
														</div>
													</div>
												))}
											</div>
										</div>
									)}

									{/* Action Links */}
									<div className="p-4 rounded-xl bg-card border border-border flex flex-col sm:flex-row items-center justify-between gap-3">
										<div>
											<p className="text-sm font-semibold text-foreground">
												Ready to deploy or advise clients?
											</p>
											<p className="text-xs text-muted-foreground">
												Explore filtered product cards or structured quant model portfolios
											</p>
										</div>
										<div className="flex items-center gap-2 w-full sm:w-auto">
											<Link
												href={`/agent/knowledge-hub/products?assetClass=${selectedAssetClassId}`}
												className="flex-1 sm:flex-none"
											>
												<Button size="sm" variant="outline" className="w-full text-xs border-border">
													View Products
													<ArrowRight className="h-3.5 w-3.5 ml-1" />
												</Button>
											</Link>
											<Link
												href={`/agent/model-portfolios?assetClass=${selectedAssetClassId}`}
												className="flex-1 sm:flex-none"
											>
												<Button size="sm" className="w-full text-xs bg-emerald-600 hover:bg-emerald-500 text-white">
													Model Portfolios
													<ExternalLink className="h-3.5 w-3.5 ml-1" />
												</Button>
											</Link>
										</div>
									</div>

									<p className="text-[11px] text-muted-foreground text-center pt-2">
										FASP-AI v1.0 Regulatory Notice: Institutional decision support intelligence only. No deterministic returns are guaranteed.
									</p>
								</ScrollArea>
							</>
						);
					})()}
				</DialogContent>
			</Dialog>
		</div>
	);
}
