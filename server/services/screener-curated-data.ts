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
