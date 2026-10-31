/**
 * server/services/screener-curated-data.ts
 *
 * Curated datasets for Thematic Smallcases and Indian Benchmark & Sectoral Indices.
 * Integrated directly with the Multi-Product Screener and Contextual AI Chat Copilot.
 */

export interface SmallcaseBasket {
	id: string;
	name: string;
	theme: string;
	macroSector: string;
	riskLevel: "Low" | "Moderate" | "High";
	minInvestment: number;
	cagr3y: number;
	returns1y: number;
	manager: string;
	holdingsCount: number;
	topHoldings: Array<{ symbol: string; weight: number; name: string }>;
	description: string;
}

export interface MarketIndexItem {
	indexCode: string;
	name: string;
	provider: "NSE" | "BSE";
	category: "Broad Market" | "Sectoral" | "Thematic";
	currentLevel: number;
	changePercent: number;
	peRatio: number;
	pbRatio: number;
	returns1y: number;
	returns3y: number;
	description: string;
	topConstituents: string[];
}

export const CURATED_SMALLCASES: SmallcaseBasket[] = [
	{
		id: "sc_all_weather",
		name: "All Weather Investing",
		theme: "Asset Allocation",
		macroSector: "Others",
		riskLevel: "Low",
		minInvestment: 5400,
		cagr3y: 14.8,
		returns1y: 18.2,
		manager: "Windmill Capital",
		holdingsCount: 4,
		topHoldings: [
			{ symbol: "NIFTYBEES", weight: 35, name: "Nippon India Nifty 50 ETF" },
			{ symbol: "JUNIORBEES", weight: 20, name: "Nippon India Nifty Next 50 ETF" },
			{ symbol: "GOLDBEES", weight: 25, name: "Nippon India Gold ETF" },
			{ symbol: "LIQUIDBEES", weight: 20, name: "Nippon India Liquid ETF" },
		],
		description:
			"Recession-proof asset allocation strategy combining Large-Cap Equities, Gold, and Liquid instruments for steady compounding with low drawdown.",
	},
	{
		id: "sc_top_100",
		name: "Top 100 Large & Mid Cap Leaders",
		theme: "Market Leaders",
		macroSector: "Banking & Finance",
		riskLevel: "Moderate",
		minInvestment: 12500,
		cagr3y: 19.4,
		returns1y: 23.1,
		manager: "FintekPro Wealth Research",
		holdingsCount: 12,
		topHoldings: [
			{ symbol: "HDFCBANK", weight: 14, name: "HDFC Bank Ltd." },
			{ symbol: "RELIANCE", weight: 12, name: "Reliance Industries Ltd." },
			{ symbol: "ICICIBANK", weight: 10, name: "ICICI Bank Ltd." },
			{ symbol: "INFY", weight: 8, name: "Infosys Ltd." },
			{ symbol: "LT", weight: 7, name: "Larsen & Toubro Ltd." },
			{ symbol: "TCS", weight: 6, name: "Tata Consultancy Services Ltd." },
		],
		description:
			"Core portfolio anchor tracking top bluechip companies commanding monopolistic balance sheets and robust ROCE across economic cycles.",
	},
	{
		id: "sc_it_tracker",
		name: "IT & Digital Disruption Tracker",
		theme: "Information Technology",
		macroSector: "Technology",
		riskLevel: "High",
		minInvestment: 18000,
		cagr3y: 21.6,
		returns1y: 27.4,
		manager: "Windmill Capital",
		holdingsCount: 8,
		topHoldings: [
			{ symbol: "TCS", weight: 22, name: "Tata Consultancy Services Ltd." },
			{ symbol: "INFY", weight: 20, name: "Infosys Ltd." },
			{ symbol: "HCLTECH", weight: 16, name: "HCL Technologies Ltd." },
			{ symbol: "WIPRO", weight: 12, name: "Wipro Ltd." },
			{ symbol: "PERSISTENT", weight: 10, name: "Persistent Systems Ltd." },
			{ symbol: "COFORGE", weight: 8, name: "Coforge Ltd." },
		],
		description:
			"Capitalize on global enterprise AI migration, cloud engineering, and multi-year IT services contracts driving superior free cash flows.",
	},
	{
		id: "sc_clean_energy",
		name: "Clean Energy & Mobility",
		theme: "Green Transition",
		macroSector: "Energy & Utilities",
		riskLevel: "High",
		minInvestment: 15000,
		cagr3y: 28.2,
		returns1y: 34.5,
		manager: "Wright Research",
		holdingsCount: 9,
		topHoldings: [
			{ symbol: "TATAMOTORS", weight: 18, name: "Tata Motors Ltd." },
			{ symbol: "TATAPOWER", weight: 16, name: "Tata Power Co. Ltd." },
			{ symbol: "JSWENERGY", weight: 14, name: "JSW Energy Ltd." },
			{ symbol: "EXIDEIND", weight: 12, name: "Exide Industries Ltd." },
			{ symbol: "OLECTRA", weight: 10, name: "Olectra Greentech Ltd." },
		],
		description:
			"Riding the multi-decade structural shift toward renewable generation, EV adoption, grid storage, and green hydrogen infrastructure.",
	},
	{
		id: "sc_pharma_tracker",
		name: "Pharma & Healthcare Innovators",
		theme: "Healthcare & Life Sciences",
		macroSector: "Healthcare & Pharma",
		riskLevel: "Moderate",
		minInvestment: 11000,
		cagr3y: 18.9,
		returns1y: 24.2,
		manager: "Windmill Capital",
		holdingsCount: 8,
		topHoldings: [
			{ symbol: "SUNPHARMA", weight: 22, name: "Sun Pharmaceutical Industries" },
			{ symbol: "CIPLA", weight: 18, name: "Cipla Ltd." },
			{ symbol: "DRREDDY", weight: 16, name: "Dr. Reddy's Laboratories" },
			{ symbol: "APOLLOHOSP", weight: 14, name: "Apollo Hospitals Enterprise" },
			{ symbol: "DIVISLAB", weight: 12, name: "Divi's Laboratories Ltd." },
		],
		description:
			"Defensive growth strategy capitalizing on US generic pricing stabilization, complex biosimilars pipeline, and expanding private healthcare in India.",
	},
	{
		id: "sc_banking_leaders",
		name: "Banking & Financials Leader",
		theme: "Credit Growth & Financialization",
		macroSector: "Banking & Finance",
		riskLevel: "Moderate",
		minInvestment: 14000,
		cagr3y: 17.5,
		returns1y: 21.8,
		manager: "FintekPro Wealth Research",
		holdingsCount: 7,
		topHoldings: [
			{ symbol: "HDFCBANK", weight: 25, name: "HDFC Bank Ltd." },
			{ symbol: "ICICIBANK", weight: 22, name: "ICICI Bank Ltd." },
			{ symbol: "SBIN", weight: 16, name: "State Bank of India" },
			{ symbol: "KOTAKBANK", weight: 14, name: "Kotak Mahindra Bank Ltd." },
			{ symbol: "BAJFINANCE", weight: 12, name: "Bajaj Finance Ltd." },
		],
		description:
			"Benefit from India's formal credit expansion, record low NPAs, and rising penetration of digital lending and wealth products.",
	},
	{
		id: "sc_infra_tracker",
		name: "Infra & Construction Track",
		theme: "National Infrastructure",
		macroSector: "Infrastructure & Construction",
		riskLevel: "High",
		minInvestment: 16500,
		cagr3y: 26.4,
		returns1y: 31.0,
		manager: "Windmill Capital",
		holdingsCount: 8,
		topHoldings: [
			{ symbol: "LT", weight: 28, name: "Larsen & Toubro Ltd." },
			{ symbol: "ULTRACEMCO", weight: 18, name: "UltraTech Cement Ltd." },
			{ symbol: "GRINFRA", weight: 12, name: "G R Infraprojects Ltd." },
			{ symbol: "PNCINFRA", weight: 10, name: "PNC Infratech Ltd." },
			{ symbol: "SIEMENS", weight: 14, name: "Siemens Ltd." },
		],
		description:
			"Direct beneficiary of government capex push across highways, high-speed rail corridors, water grids, and industrial manufacturing corridors.",
	},
	{
		id: "sc_fmcg_compounders",
		name: "FMCG Compounders",
		theme: "Consumer Staples",
		macroSector: "Consumer Goods & Retail",
		riskLevel: "Low",
		minInvestment: 9500,
		cagr3y: 15.2,
		returns1y: 17.6,
		manager: "Windmill Capital",
		holdingsCount: 6,
		topHoldings: [
			{ symbol: "ITC", weight: 28, name: "ITC Ltd." },
			{ symbol: "HINDUNILVR", weight: 24, name: "Hindustan Unilever Ltd." },
			{ symbol: "NESTLEIND", weight: 18, name: "Nestle India Ltd." },
			{ symbol: "BRITANNIA", weight: 14, name: "Britannia Industries Ltd." },
			{ symbol: "DABUR", weight: 10, name: "Dabur India Ltd." },
		],
		description:
			"High ROE consumer staple franchises commanding immense pricing power, distribution moat, and dividend compounding across economic cycles.",
	},
	{
		id: "sc_dividend_aristocrats",
		name: "Dividend Aristocrats",
		theme: "Cash Flow & Yield",
		macroSector: "Energy & Utilities",
		riskLevel: "Low",
		minInvestment: 8000,
		cagr3y: 16.8,
		returns1y: 22.4,
		manager: "FintekPro Wealth Research",
		holdingsCount: 7,
		topHoldings: [
			{ symbol: "COALINDIA", weight: 22, name: "Coal India Ltd." },
			{ symbol: "POWERGRID", weight: 20, name: "Power Grid Corp of India" },
			{ symbol: "REC", weight: 16, name: "REC Ltd." },
			{ symbol: "PFC", weight: 16, name: "Power Finance Corporation" },
			{ symbol: "VEDL", weight: 12, name: "Vedanta Ltd." },
		],
		description:
			"High dividend yield cohort generating reliable quarterly and annual income with stable cash reserves and low downside volatility.",
	},
	{
		id: "sc_rising_rural",
		name: "Rising Rural Demand",
		theme: "Rural Consumption",
		macroSector: "Manufacturing",
		riskLevel: "Moderate",
		minInvestment: 13000,
		cagr3y: 20.1,
		returns1y: 25.8,
		manager: "Wright Research",
		holdingsCount: 7,
		topHoldings: [
			{ symbol: "M&M", weight: 24, name: "Mahindra & Mahindra Ltd." },
			{ symbol: "HEROMOTOCO", weight: 20, name: "Hero MotoCorp Ltd." },
			{ symbol: "ESCORTS", weight: 16, name: "Escorts Kubota Ltd." },
			{ symbol: "COROMANDEL", weight: 14, name: "Coromandel International" },
			{ symbol: "MARICO", weight: 12, name: "Marico Ltd." },
		],
		description:
			"Tapping rural disposable income expansion, agricultural mechanization, two-wheeler recovery, and FMCG volume surges across Tier-2/3 India.",
	},
];

export const CURATED_INDICES: MarketIndexItem[] = [
	{
		indexCode: "NIFTY50",
		name: "NIFTY 50",
		provider: "NSE",
		category: "Broad Market",
		currentLevel: 24852.15,
		changePercent: 0.42,
		peRatio: 22.1,
		pbRatio: 3.8,
		returns1y: 23.4,
		returns3y: 15.2,
		description: "Benchmark Indian index comprising top 50 bluechip companies by free-float market cap on NSE.",
		topConstituents: ["HDFCBANK (13.4%)", "RELIANCE (9.8%)", "ICICIBANK (7.6%)", "INFY (5.8%)", "ITC (4.3%)"],
	},
	{
		indexCode: "NIFTY_NEXT50",
		name: "NIFTY Next 50",
		provider: "NSE",
		category: "Broad Market",
		currentLevel: 71240.8,
		changePercent: 0.58,
		peRatio: 26.5,
		pbRatio: 4.4,
		returns1y: 38.6,
		returns3y: 22.1,
		description: "Next 50 mega-cap candidates ranked 51-100 on NSE with high potential for graduating to Nifty 50.",
		topConstituents: ["BEL (4.2%)", "TRENT (4.0%)", "HAL (3.8%)", "VBL (3.7%)", "VEDL (3.5%)"],
	},
	{
		indexCode: "NIFTY_BANK",
		name: "NIFTY Bank",
		provider: "NSE",
		category: "Sectoral",
		currentLevel: 52380.4,
		changePercent: 0.65,
		peRatio: 16.2,
		pbRatio: 2.6,
		returns1y: 18.9,
		returns3y: 14.1,
		description: "Premier banking sector benchmark tracking 12 liquid private and public sector banking leaders.",
		topConstituents: ["HDFCBANK (28.4%)", "ICICIBANK (23.2%)", "SBIN (11.5%)", "KOTAKBANK (9.8%)", "AXISBANK (8.4%)"],
	},
	{
		indexCode: "NIFTY_IT",
		name: "NIFTY IT",
		provider: "NSE",
		category: "Sectoral",
		currentLevel: 38420.1,
		changePercent: -0.15,
		peRatio: 28.4,
		pbRatio: 6.9,
		returns1y: 26.8,
		returns3y: 16.7,
		description: "Tracks leading Indian technology service exporters driving cloud migration and enterprise AI transformation.",
		topConstituents: ["TCS (27.2%)", "INFY (25.8%)", "HCLTECH (12.4%)", "WIPRO (8.6%)", "TECHM (7.2%)"],
	},
	{
		indexCode: "NIFTY_AUTO",
		name: "NIFTY Auto",
		provider: "NSE",
		category: "Sectoral",
		currentLevel: 24150.8,
		changePercent: 0.88,
		peRatio: 24.6,
		pbRatio: 4.8,
		returns1y: 41.2,
		returns3y: 28.5,
		description: "Automobile sector index covering OEMs, two-wheelers, commercial vehicles, and auto components.",
		topConstituents: ["M&M (19.4%)", "TATAMOTORS (16.2%)", "MARUTI (15.8%)", "BAJAJ-AUTO (9.6%)", "EICHERMOT (7.1%)"],
	},
	{
		indexCode: "NIFTY_PHARMA",
		name: "NIFTY Pharma",
		provider: "NSE",
		category: "Sectoral",
		currentLevel: 21890.3,
		changePercent: 0.32,
		peRatio: 32.1,
		pbRatio: 4.5,
		returns1y: 34.6,
		returns3y: 19.2,
		description: "Healthcare benchmark reflecting pharmaceutical formulations, API manufacturing, and hospital chains.",
		topConstituents: ["SUNPHARMA (24.8%)", "CIPLA (13.6%)", "DRREDDY (12.1%)", "DIVISLAB (9.8%)", "LUPIN (7.4%)"],
	},
	{
		indexCode: "NIFTY_FMCG",
		name: "NIFTY FMCG",
		provider: "NSE",
		category: "Sectoral",
		currentLevel: 57620.5,
		changePercent: 0.1,
		peRatio: 38.5,
		pbRatio: 9.8,
		returns1y: 14.2,
		returns3y: 13.8,
		description: "Fast Moving Consumer Goods cohort reflecting household consumption and non-durable goods demand.",
		topConstituents: ["ITC (32.4%)", "HINDUNILVR (20.8%)", "NESTLEIND (8.9%)", "BRITANNIA (6.8%)", "TATACONSUM (6.2%)"],
	},
	{
		indexCode: "NIFTY_METAL",
		name: "NIFTY Metal",
		provider: "NSE",
		category: "Sectoral",
		currentLevel: 9240.75,
		changePercent: 1.15,
		peRatio: 14.8,
		pbRatio: 2.1,
		returns1y: 29.5,
		returns3y: 18.4,
		description: "Tracks mining, steel, aluminium, zinc, and commodity metal producers sensitive to global industrial demand.",
		topConstituents: ["TATASTEEL (22.8%)", "HINDALCO (18.6%)", "JSWSTEEL (17.4%)", "VEDL (12.1%)", "COALINDIA (11.8%)"],
	},
	{
		indexCode: "SENSEX",
		name: "BSE SENSEX",
		provider: "BSE",
		category: "Broad Market",
		currentLevel: 81420.3,
		changePercent: 0.38,
		peRatio: 23.0,
		pbRatio: 3.7,
		returns1y: 21.8,
		returns3y: 14.6,
		description: "Oldest Indian benchmark comprising 30 prominent and financially sound companies on BSE.",
		topConstituents: ["HDFCBANK (14.8%)", "RELIANCE (11.2%)", "ICICIBANK (8.9%)", "INFY (6.8%)", "ITC (4.9%)"],
	},
	{
		indexCode: "NIFTY_MIDCAP_150",
		name: "NIFTY Midcap 150",
		provider: "NSE",
		category: "Broad Market",
		currentLevel: 20410.6,
		changePercent: 0.55,
		peRatio: 29.8,
		pbRatio: 4.2,
		returns1y: 38.4,
		returns3y: 24.6,
		description: "150 companies ranked 101-250 by market cap; the primary engine of mid-stage compounding in India.",
		topConstituents: ["MAXHEALTH (2.1%)", "SUZLON (1.9%)", "INDIANB (1.8%)", "FEDERALBNK (1.7%)", "MPHASIS (1.6%)"],
	},
	{
		indexCode: "NIFTY_SMALLCAP_100",
		name: "NIFTY Smallcap 100",
		provider: "NSE",
		category: "Broad Market",
		currentLevel: 18340.25,
		changePercent: 0.72,
		peRatio: 26.4,
		pbRatio: 3.6,
		returns1y: 44.2,
		returns3y: 26.8,
		description: "High-growth small-cap enterprises positioned in niche segments and import-substitution sectors.",
		topConstituents: ["COCHINSHIP (2.4%)", "IRFC (2.1%)", "BSE (2.0%)", "EXIDEIND (1.9%)", "CASTROLIND (1.8%)"],
	},
];

// ─────────────────────────────────────────────────────────────────────────────
// SPECIALISED INVESTMENT FUNDS (SIF) — SEBI April 2025 Framework
// ─────────────────────────────────────────────────────────────────────────────
export interface CuratedSifFund {
	id: string;
	name: string;
	amc: string;
	strategy: "Equity Long-Short" | "Hybrid Long-Short" | "Dynamic Asset Allocation" | "Multi-Strategy";
	isin: string | null;
	riskLevel: "Moderate" | "Moderately High" | "High" | "Very High";
	minInvestment: number; // ₹10,00,000 (SEBI SIF mandatory minimum ticket)
	targetReturn: number;
	sharpeRatio: number;
	volatility: number;
	lockInMonths: number;
	portfolioPresence: string[];
	description: string;
}

export const CURATED_SIF_FUNDS: CuratedSifFund[] = [
	{
		id: "sif_icici_equity_ls",
		name: "ICICI Pru iSIF Equity Long-Short",
		amc: "ICICI Prudential AMC",
		strategy: "Equity Long-Short",
		isin: "INF109KC1LS1",
		riskLevel: "High",
		minInvestment: 1000000,
		targetReturn: 17.5,
		sharpeRatio: 1.42,
		volatility: 11.4,
		lockInMonths: 12,
		portfolioPresence: ["All Weather India", "Blue-Chip Growth", "HNI Alternatives"],
		description:
			"SEBI-regulated Specialised Investment Fund executing algorithmic market-neutral and long-short equity strategies for steady alpha generation with contained market beta.",
	},
	{
		id: "sif_sbi_equity_ls",
		name: "SBI SIF Equity Long-Short",
		amc: "SBI Funds Management",
		strategy: "Equity Long-Short",
		isin: "INF200KC1LS2",
		riskLevel: "High",
		minInvestment: 1000000,
		targetReturn: 16.8,
		sharpeRatio: 1.38,
		volatility: 10.8,
		lockInMonths: 12,
		portfolioPresence: ["All Weather India", "HNI Alternatives"],
		description:
			"Systematic equity long-short fund capitalizing on factor dispersion across NIFTY 200 constituents with rigorous downside stop-loss overlays.",
	},
	{
		id: "sif_kotak_infinity",
		name: "Kotak Infinity Hybrid Long-Short SIF",
		amc: "Kotak Mahindra AMC",
		strategy: "Hybrid Long-Short",
		isin: "INF174KC1LS3",
		riskLevel: "Moderate",
		minInvestment: 1000000,
		targetReturn: 16.2,
		sharpeRatio: 1.51,
		volatility: 9.6,
		lockInMonths: 12,
		portfolioPresence: ["All Weather India", "HNI Alternatives"],
		description:
			"Hybrid multi-asset SIF allocating dynamically between hedged equity pairs, structured credit, and gold arbitrage for asymmetric risk-reward.",
	},
	{
		id: "sif_mirae_platinum",
		name: "Mirae Asset Platinum Hybrid Long-Short",
		amc: "Mirae Asset Investment Managers",
		strategy: "Hybrid Long-Short",
		isin: "INF769KC1LS5",
		riskLevel: "High",
		minInvestment: 1000000,
		targetReturn: 17.0,
		sharpeRatio: 1.40,
		volatility: 10.2,
		lockInMonths: 12,
		portfolioPresence: ["HNI Alternatives", "Future Multibaggers"],
		description:
			"Tech and consumer-focused thematic long positions hedged with index futures and options collars to capture high alpha without full market drawdowns.",
	},
	{
		id: "sif_nippon_opp",
		name: "Nippon SIF Equity Opportunities",
		amc: "Nippon Life India AMC",
		strategy: "Equity Long-Short",
		isin: "INF204KC1LS4",
		riskLevel: "Very High",
		minInvestment: 1000000,
		targetReturn: 18.0,
		sharpeRatio: 1.35,
		volatility: 12.1,
		lockInMonths: 24,
		portfolioPresence: ["Emerging Leaders", "HNI Alternatives"],
		description:
			"Mid-and-small-cap growth opportunities paired against cyclical hedges, designed for high net-worth investors seeking superior risk-adjusted equity returns.",
	},
	{
		id: "sif_hdfc_dynamic",
		name: "HDFC SIF Dynamic Asset Allocation",
		amc: "HDFC AMC",
		strategy: "Dynamic Asset Allocation",
		isin: "INF179KC1LS6",
		riskLevel: "Moderate",
		minInvestment: 1000000,
		targetReturn: 15.5,
		sharpeRatio: 1.48,
		volatility: 8.9,
		lockInMonths: 12,
		portfolioPresence: ["All Weather India", "Retirement Shield"],
		description:
			"Model-driven macro allocator adjusting equity, duration, and commodities based on yield curve shifts and relative valuation percentiles.",
	},
	{
		id: "sif_axis_flexi",
		name: "Axis SIF Flexi Long-Short",
		amc: "Axis AMC",
		strategy: "Equity Long-Short",
		isin: "INF846KC1LS7",
		riskLevel: "High",
		minInvestment: 1000000,
		targetReturn: 16.5,
		sharpeRatio: 1.32,
		volatility: 11.8,
		lockInMonths: 12,
		portfolioPresence: ["HNI Alternatives"],
		description:
			"Multi-factor equity long-short targeting value anomalies and momentum trends with active beta management between 0.3 and 0.7.",
	},
	{
		id: "sif_tata_absolute",
		name: "Tata SIF Absolute Return Fund",
		amc: "Tata AMC",
		strategy: "Multi-Strategy",
		isin: "INF277KC1LS8",
		riskLevel: "Moderate",
		minInvestment: 1000000,
		targetReturn: 15.8,
		sharpeRatio: 1.45,
		volatility: 9.2,
		lockInMonths: 12,
		portfolioPresence: ["All Weather India", "Balanced Advantage"],
		description:
			"Absolute return multi-strategy vehicle blending fixed-income spread trades with covered calls and disciplined cash allocations.",
	},
];

// ─────────────────────────────────────────────────────────────────────────────
// CURATED REITS & INVITS — Fallback & Research Master
// ─────────────────────────────────────────────────────────────────────────────
export interface CuratedReitInvit {
	id: string;
	symbol: string;
	name: string;
	sponsor: string;
	trustType: "REIT" | "InvIT";
	category: "REIT" | "InvIT";
	sector: string;
	exchange: string;
	currentPrice: number;
	nav: number;
	premiumToNav: number;
	marketCap: number;
	distributionYield: number;
	lastDividend: number;
	returns1Y: number;
	occupancyRate: number;
	debtToEquity: number;
	riskLevel: "Low" | "Moderate" | "High";
	aiSignal: "BUY" | "ACCUMULATE" | "HOLD";
	aiConfidence: number;
	amfiCapCategory: string;
	isin: string;
	portfolioPresence: string[];
}

export const CURATED_REITS_INVITS: CuratedReitInvit[] = [
	{
		id: "reit_embassy",
		symbol: "EMBASSY",
		name: "Embassy Office Parks REIT",
		sponsor: "Blackstone Group & Embassy Group",
		trustType: "REIT",
		category: "REIT",
		sector: "Commercial Office",
		exchange: "NSE",
		currentPrice: 385.50,
		nav: 398.20,
		premiumToNav: -3.2,
		marketCap: 36540,
		distributionYield: 6.85,
		lastDividend: 5.45,
		returns1Y: 12.4,
		occupancyRate: 89.5,
		debtToEquity: 0.28,
		riskLevel: "Moderate",
		aiSignal: "BUY",
		aiConfidence: 0.88,
		amfiCapCategory: "Large Cap",
		isin: "INE041025011",
		portfolioPresence: ["All Weather India", "Dividend Harvest", "HNI Alternatives", "Retirement Shield"],
	},
	{
		id: "reit_mindspace",
		symbol: "MINDSPACE",
		name: "Mindspace Business Parks REIT",
		sponsor: "K Raheja Corp & Blackstone",
		trustType: "REIT",
		category: "REIT",
		sector: "Commercial Office",
		exchange: "NSE",
		currentPrice: 348.00,
		nav: 362.40,
		premiumToNav: -4.0,
		marketCap: 20620,
		distributionYield: 6.95,
		lastDividend: 4.80,
		returns1Y: 11.8,
		occupancyRate: 88.2,
		debtToEquity: 0.22,
		riskLevel: "Moderate",
		aiSignal: "BUY",
		aiConfidence: 0.85,
		amfiCapCategory: "Large Cap",
		isin: "INE0CCU25019",
		portfolioPresence: ["All Weather India", "Dividend Harvest", "HNI Alternatives"],
	},
	{
		id: "reit_nexus",
		symbol: "NEXUS",
		name: "Nexus Select Trust REIT",
		sponsor: "Blackstone Group",
		trustType: "REIT",
		category: "REIT",
		sector: "Retail & Malls",
		exchange: "NSE",
		currentPrice: 138.50,
		nav: 142.10,
		premiumToNav: -2.5,
		marketCap: 20980,
		distributionYield: 7.45,
		lastDividend: 2.15,
		returns1Y: 15.6,
		occupancyRate: 96.2,
		debtToEquity: 0.25,
		riskLevel: "Moderate",
		aiSignal: "BUY",
		aiConfidence: 0.91,
		amfiCapCategory: "Mid Cap",
		isin: "INE0NX225016",
		portfolioPresence: ["Dividend Harvest", "Bharat 2030"],
	},
	{
		id: "reit_brookfield",
		symbol: "BIRET",
		name: "Brookfield India Real Estate Trust",
		sponsor: "Brookfield Asset Management",
		trustType: "REIT",
		category: "REIT",
		sector: "Commercial Office",
		exchange: "NSE",
		currentPrice: 262.00,
		nav: 278.50,
		premiumToNav: -5.9,
		marketCap: 12850,
		distributionYield: 7.80,
		lastDividend: 4.60,
		returns1Y: 9.4,
		occupancyRate: 86.4,
		debtToEquity: 0.34,
		riskLevel: "Moderate",
		aiSignal: "ACCUMULATE",
		aiConfidence: 0.82,
		amfiCapCategory: "Mid Cap",
		isin: "INE0FDU25010",
		portfolioPresence: ["HNI Alternatives", "Dividend Harvest"],
	},
	{
		id: "invit_indigrid",
		symbol: "INDIGRID",
		name: "IndiGrid Infrastructure InvIT",
		sponsor: "Sterlite Power & KKR",
		trustType: "InvIT",
		category: "InvIT",
		sector: "Power Transmission",
		exchange: "NSE",
		currentPrice: 142.00,
		nav: 146.50,
		premiumToNav: -3.1,
		marketCap: 10650,
		distributionYield: 9.60,
		lastDividend: 3.55,
		returns1Y: 14.8,
		occupancyRate: 99.8,
		debtToEquity: 0.58,
		riskLevel: "Moderate",
		aiSignal: "BUY",
		aiConfidence: 0.92,
		amfiCapCategory: "Mid Cap",
		isin: "INE219X23014",
		portfolioPresence: ["All Weather India", "Dividend Harvest", "Retirement Shield"],
	},
	{
		id: "invit_pginvit",
		symbol: "PGINVIT",
		name: "Power Grid Corp InvIT",
		sponsor: "Power Grid Corporation of India",
		trustType: "InvIT",
		category: "InvIT",
		sector: "Power Transmission",
		exchange: "NSE",
		currentPrice: 102.50,
		nav: 104.20,
		premiumToNav: -1.6,
		marketCap: 9320,
		distributionYield: 9.85,
		lastDividend: 3.00,
		returns1Y: 13.2,
		occupancyRate: 99.9,
		debtToEquity: 0.45,
		riskLevel: "Low",
		aiSignal: "BUY",
		aiConfidence: 0.94,
		amfiCapCategory: "Mid Cap",
		isin: "INE0GGX23010",
		portfolioPresence: ["All Weather India", "Dividend Harvest"],
	},
	{
		id: "invit_irb",
		symbol: "IRBINVIT",
		name: "IRB Infrastructure InvIT Fund",
		sponsor: "IRB Infrastructure Developers",
		trustType: "InvIT",
		category: "InvIT",
		sector: "Roads & Highways",
		exchange: "NSE",
		currentPrice: 68.50,
		nav: 72.00,
		premiumToNav: -4.9,
		marketCap: 4020,
		distributionYield: 10.40,
		lastDividend: 2.05,
		returns1Y: 11.5,
		occupancyRate: 98.5,
		debtToEquity: 0.49,
		riskLevel: "Moderate",
		aiSignal: "ACCUMULATE",
		aiConfidence: 0.84,
		amfiCapCategory: "Small Cap",
		isin: "INE0GZ823018",
		portfolioPresence: ["Dividend Harvest", "HNI Alternatives"],
	},
];

// ─────────────────────────────────────────────────────────────────────────────
// CURATED BENCHMARK BONDS — Fallback & Research Master
// ─────────────────────────────────────────────────────────────────────────────
export interface CuratedBond {
	id: string;
	isin: string;
	name: string;
	issuer: string;
	bondType: "govt" | "corporate";
	couponRate: number;
	yieldToMaturity: number;
	maturityDate: string;
	tenorYears: number;
	currentPrice: number;
	faceValue: number;
	creditRating: string;
	taxStatus: "taxable" | "taxfree";
	minimumInvestment: number;
	securityType: string;
	tradingStatus: "active";
	portfolioPresence: string[];
}

export const CURATED_BENCHMARK_BONDS: CuratedBond[] = [
	{
		id: "gsec_718_2033",
		isin: "IN0020230085",
		name: "7.18% GS 2033 (10Y Benchmark G-Sec)",
		issuer: "Government of India",
		bondType: "govt",
		couponRate: 7.18,
		yieldToMaturity: 6.98,
		maturityDate: "2033-08-14",
		tenorYears: 7.8,
		currentPrice: 101.20,
		faceValue: 100,
		creditRating: "AAA",
		taxStatus: "taxable",
		minimumInvestment: 10000,
		securityType: "gsec",
		tradingStatus: "active",
		portfolioPresence: ["All Weather India", "Debt Long Duration", "Retirement Shield"],
	},
	{
		id: "gsec_726_2032",
		isin: "IN0020220011",
		name: "7.26% GS 2032 Sovereign Bond",
		issuer: "Government of India",
		bondType: "govt",
		couponRate: 7.26,
		yieldToMaturity: 7.02,
		maturityDate: "2032-02-06",
		tenorYears: 6.3,
		currentPrice: 101.40,
		faceValue: 100,
		creditRating: "AAA",
		taxStatus: "taxable",
		minimumInvestment: 10000,
		securityType: "gsec",
		tradingStatus: "active",
		portfolioPresence: ["Debt Long Duration", "Corp Treasury Strategic"],
	},
	{
		id: "corp_rec_2028",
		isin: "INE020B08DF5",
		name: "REC Limited 7.50% 2028 Bond",
		issuer: "REC Limited",
		bondType: "corporate",
		couponRate: 7.50,
		yieldToMaturity: 7.55,
		maturityDate: "2028-11-20",
		tenorYears: 3.1,
		currentPrice: 99.85,
		faceValue: 100000,
		creditRating: "AAA",
		taxStatus: "taxable",
		minimumInvestment: 100000,
		securityType: "corporate_bond",
		tradingStatus: "active",
		portfolioPresence: ["Debt Corporate Bond", "Corp Treasury Short", "Goal Senior Citizen"],
	},
	{
		id: "corp_pfc_2029",
		isin: "INE134E08MB6",
		name: "Power Finance Corp 7.58% 2029",
		issuer: "Power Finance Corporation",
		bondType: "corporate",
		couponRate: 7.58,
		yieldToMaturity: 7.62,
		maturityDate: "2029-06-15",
		tenorYears: 3.6,
		currentPrice: 99.90,
		faceValue: 100000,
		creditRating: "AAA",
		taxStatus: "taxable",
		minimumInvestment: 100000,
		securityType: "corporate_bond",
		tradingStatus: "active",
		portfolioPresence: ["Debt Corporate Bond", "Goal Child Education"],
	},
	{
		id: "corp_hdfc_2027",
		isin: "INE040A08435",
		name: "HDFC Bank 7.70% Senior Bond 2027",
		issuer: "HDFC Bank Ltd.",
		bondType: "corporate",
		couponRate: 7.70,
		yieldToMaturity: 7.72,
		maturityDate: "2027-09-24",
		tenorYears: 1.9,
		currentPrice: 100.10,
		faceValue: 100000,
		creditRating: "AAA",
		taxStatus: "taxable",
		minimumInvestment: 100000,
		securityType: "corporate_bond",
		tradingStatus: "active",
		portfolioPresence: ["Debt Short Duration", "Corp Treasury Active"],
	},
	{
		id: "sgb_2026_27",
		isin: "IN0020200057",
		name: "Sovereign Gold Bond 2026-27 Series",
		issuer: "Reserve Bank of India",
		bondType: "govt",
		couponRate: 2.50,
		yieldToMaturity: 8.20,
		maturityDate: "2027-02-28",
		tenorYears: 1.3,
		currentPrice: 7250.00,
		faceValue: 5100,
		creditRating: "AAA",
		taxStatus: "taxfree",
		minimumInvestment: 7250,
		securityType: "sgb",
		tradingStatus: "active",
		portfolioPresence: ["All Weather India", "Retirement Shield", "Goal Wedding Fund"],
	},
];

// ─────────────────────────────────────────────────────────────────────────────
// CURATED TOP ETFS — Fallback & Research Master
// ─────────────────────────────────────────────────────────────────────────────
export interface CuratedEtf {
	id: string;
	symbol: string;
	companyName: string;
	isin: string;
	sector: string;
	currentPrice: number;
	marketCap: number;
	exchange: string;
	etfCategory: "nifty" | "gold" | "sectoral" | "international";
	portfolioPresence: string[];
}

export const CURATED_TOP_ETFS: CuratedEtf[] = [
	{
		id: "etf_niftybees",
		symbol: "NIFTYBEES",
		companyName: "Nippon India ETF Nifty BeES",
		isin: "INF204KB12A6",
		sector: "Index ETF",
		currentPrice: 268.40,
		marketCap: 28540,
		exchange: "NSE",
		etfCategory: "nifty",
		portfolioPresence: ["All Weather India", "Blue-Chip Growth", "Nifty50 Index Alpha"],
	},
	{
		id: "etf_kotak_n50",
		symbol: "KOTAKNIFTY",
		companyName: "Kotak NIFTY 50 ETF",
		isin: "INF174K01Q03",
		sector: "Index ETF",
		currentPrice: 268.10,
		marketCap: 15420,
		exchange: "NSE",
		etfCategory: "nifty",
		portfolioPresence: ["All Weather India", "Blue-Chip Growth"],
	},
	{
		id: "etf_goldbees",
		symbol: "GOLDBEES",
		companyName: "Nippon India ETF Gold BeES",
		isin: "INF204KB1079",
		sector: "Precious Metals",
		currentPrice: 68.20,
		marketCap: 14210,
		exchange: "NSE",
		etfCategory: "gold",
		portfolioPresence: ["All Weather India", "Goal Wedding Fund", "Retirement Shield"],
	},
	{
		id: "etf_bankbees",
		symbol: "BANKBEES",
		companyName: "Nippon ETF Bank BeES",
		isin: "INF204KB1103",
		sector: "Banking & Financials",
		currentPrice: 532.80,
		marketCap: 12600,
		exchange: "NSE",
		etfCategory: "sectoral",
		portfolioPresence: ["Thematic BFSI"],
	},
	{
		id: "etf_defence",
		symbol: "DEFENCE",
		companyName: "Mirae Asset Nifty India Defence ETF",
		isin: "INF769K01KV8",
		sector: "Aerospace & Defence",
		currentPrice: 84.50,
		marketCap: 3820,
		exchange: "NSE",
		etfCategory: "sectoral",
		portfolioPresence: ["Thematic Defence"],
	},
	{
		id: "etf_consumption",
		symbol: "CONSUMBEES",
		companyName: "Nippon ETF Nifty India Consumption ETF",
		isin: "INF204KB1603",
		sector: "FMCG & Consumption",
		currentPrice: 112.40,
		marketCap: 4100,
		exchange: "NSE",
		etfCategory: "sectoral",
		portfolioPresence: ["Thematic Consumption"],
	},
	{
		id: "etf_mon100",
		symbol: "MON100",
		companyName: "Motilal Oswal Nasdaq 100 ETF",
		isin: "INF247L01024",
		sector: "International Technology",
		currentPrice: 164.20,
		marketCap: 6850,
		exchange: "NSE",
		etfCategory: "international",
		portfolioPresence: ["Future Multibaggers", "Global Diversifier"],
	},
	{
		id: "etf_mid150bees",
		symbol: "MID150BEES",
		companyName: "Nippon India ETF Nifty Midcap 150",
		isin: "INF204KB18X0",
		sector: "Mid Cap Index",
		currentPrice: 22.40,
		marketCap: 2940,
		exchange: "NSE",
		etfCategory: "nifty",
		portfolioPresence: ["Midcap Momentum", "Emerging Leaders"],
	},
];

// ─────────────────────────────────────────────────────────────────────────────
// MODEL PORTFOLIO HOLDINGS MAP — Cross-Asset Verification & Screener Badge Helper
// ─────────────────────────────────────────────────────────────────────────────
const _PORTFOLIO_PRESENCE_LOOKUP: Record<string, string[]> = {
	// Factor Alpha Stocks
	RELIANCE: ["Factor Alpha", "Bharat 2030", "Blue-Chip Growth"],
	BAJFINANCE: ["Factor Alpha", "Blue-Chip Growth", "Thematic BFSI"],
	TITAN: ["Factor Alpha", "Thematic Consumption", "Blue-Chip Growth"],
	PERSISTENT: ["Factor Alpha", "Emerging Leaders"],
	ETERNAL: ["Factor Alpha", "Future Multibaggers"],
	NAUKRI: ["Factor Alpha", "Emerging Leaders"],
	ANGELONE: ["Factor Alpha", "Thematic BFSI"],
	// Blue Chip / Core Stocks
	TCS: ["Blue-Chip Growth", "Bharat 2030", "ESG Sustainable"],
	INFY: ["Blue-Chip Growth", "Bharat 2030", "ESG Sustainable"],
	HDFCBANK: ["Blue-Chip Growth", "Bharat 2030", "Thematic BFSI"],
	ICICIBANK: ["Blue-Chip Growth", "Bharat 2030", "Thematic BFSI"],
	LT: ["Blue-Chip Growth", "Bharat 2030"],
	BHARTIARTL: ["Blue-Chip Growth", "Bharat 2030"],
	ITC: ["Blue-Chip Growth", "Dividend Harvest", "ESG Sustainable"],
	KOTAKBANK: ["Blue-Chip Growth", "Thematic BFSI"],
	AXISBANK: ["Blue-Chip Growth", "Thematic BFSI"],
	SBIN: ["Blue-Chip Growth", "Thematic BFSI"],
	// Mid & Small Caps
	BEL: ["Thematic Defence", "Bharat 2030"],
	HAL: ["Thematic Defence", "Bharat 2030"],
	COCHINSHIP: ["Thematic Defence"],
	TRENT: ["Emerging Leaders", "Thematic Consumption"],
	DIXON: ["Emerging Leaders", "Future Multibaggers"],
	// REITs & InvITs
	EMBASSY: ["All Weather India", "Dividend Harvest", "HNI Alternatives", "Retirement Shield"],
	MINDSPACE: ["All Weather India", "Dividend Harvest", "HNI Alternatives"],
	NEXUS: ["Dividend Harvest", "Bharat 2030"],
	BIRET: ["HNI Alternatives", "Dividend Harvest"],
	INDIGRID: ["All Weather India", "Dividend Harvest", "Retirement Shield"],
	PGINVIT: ["All Weather India", "Dividend Harvest"],
	IRBINVIT: ["Dividend Harvest", "HNI Alternatives"],
	// ETFs
	NIFTYBEES: ["All Weather India", "Blue-Chip Growth", "Nifty50 Index Alpha"],
	KOTAKNIFTY: ["All Weather India", "Blue-Chip Growth"],
	GOLDBEES: ["All Weather India", "Goal Wedding Fund", "Retirement Shield"],
	BANKBEES: ["Thematic BFSI"],
	DEFENCE: ["Thematic Defence"],
	CONSUMBEES: ["Thematic Consumption"],
	MON100: ["Future Multibaggers"],
	MID150BEES: ["Midcap Momentum", "Emerging Leaders"],
};

/**
 * Returns the names of FintekPro model portfolios that hold this instrument.
 * Matches against symbol, clean name, or ISIN.
 */
export function getModelPortfolioBadges(identifier: string | null | undefined): string[] {
	if (!identifier) return [];
	const clean = identifier.toUpperCase().trim();
	if (_PORTFOLIO_PRESENCE_LOOKUP[clean]) {
		return _PORTFOLIO_PRESENCE_LOOKUP[clean];
	}

	// SIF match
	const sifMatch = CURATED_SIF_FUNDS.find(
		(s) => s.isin?.toUpperCase() === clean || s.name.toUpperCase().includes(clean) || clean.includes(s.name.toUpperCase())
	);
	if (sifMatch) return sifMatch.portfolioPresence;

	// REIT/InvIT match
	const reitMatch = CURATED_REITS_INVITS.find(
		(r) => r.symbol.toUpperCase() === clean || r.isin?.toUpperCase() === clean || r.name.toUpperCase().includes(clean)
	);
	if (reitMatch) return reitMatch.portfolioPresence;

	// ETF match
	const etfMatch = CURATED_TOP_ETFS.find(
		(e) => e.symbol.toUpperCase() === clean || e.isin?.toUpperCase() === clean || e.companyName.toUpperCase().includes(clean)
	);
	if (etfMatch) return etfMatch.portfolioPresence;

	// Bond match
	const bondMatch = CURATED_BENCHMARK_BONDS.find(
		(b) => b.isin?.toUpperCase() === clean || b.name.toUpperCase().includes(clean)
	);
	if (bondMatch) return bondMatch.portfolioPresence;

	return [];
}

