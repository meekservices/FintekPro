/**
 * AMC Master Directory — Complete Registry of 52 SEBI & IFSCA Registered AMCs
 * FintekPro Partner Knowledge Hub & Asset Management Intelligence
 * 
 * Classifications:
 *   - mega_institutional: Top 10 Indian fund houses with systemic scale (>₹2.5 Lakh Cr AUM)
 *   - established_pillar: Proven multi-cycle compounders & veteran asset managers
 *   - alpha_boutique: High-conviction alpha specialists & focused wealth creators
 *   - fintech_passive: Low-cost passives, factor index innovators & tech-first AMCs
 *   - gift_city_ifsc: Offshore & cross-border dollar asset management entities in GIFT City IFSC
 */

export interface AmcMasterRecord {
	amcCode: string;
	amcName: string;
	shortName: string;
	tier: "mega_institutional" | "established_pillar" | "alpha_boutique" | "fintech_passive" | "gift_city_ifsc";
	rta: "CAMS" | "KFintech" | "IFSCA" | "In-house";
	aumBand: string;
	leadStrategist: string;
	strategistRole: string;
	title: string;
	category: "equity_outlook" | "debt_outlook" | "asset_allocation" | "macro_strategy" | "thematic_call";
	keyTakeaways: string[];
	sectorCalls: {
		overweight: string[];
		neutral: string[];
		underweight: string[];
	};
	macroIndicators: {
		gdpGrowthEstimate: string;
		rbiRateStance: string;
		tenYearGsecOutlook: string;
		crudeImpact: string;
	};
	advisoryTipForPartners: string;
	flagshipScheme?: {
		name: string;
		category: string;
		subCategory: string;
		benchmark: string;
	};
}

export const ALL_52_AMCS: AmcMasterRecord[] = [
	// ─── 1. MEGA INSTITUTIONAL (Top 10 Indian AMC Giants) ─────────────────────
	{
		amcCode: "SBI_MF",
		amcName: "SBI Mutual Fund",
		shortName: "SBI MF",
		tier: "mega_institutional",
		rta: "CAMS",
		aumBand: "₹10,50,000+ Cr (Rank 1)",
		leadStrategist: "D P Singh",
		strategistRole: "Deputy MD & Joint CEO, SBI Funds Management",
		title: "SBI MF Macro Lens: Retail SIP Phenomenon & Structural Wealth Creation",
		category: "macro_strategy",
		keyTakeaways: [
			"Indian mutual fund SIP monthly book sustaining over ₹26,000 Crores per month, acting as a structural anchor against global volatility.",
			"Financialization of domestic household savings continues to accelerate with increasing participation from B-30 (Beyond Top 30) cities.",
			"Long-term Systematic Transfer Plans (STPs) recommended for allocating large liquidity tranches over 6-12 months.",
		],
		sectorCalls: {
			overweight: ["Infrastructure & Defense", "Domestic Consumption", "Private Banks"],
			neutral: ["Energy & Petrochemicals"],
			underweight: ["Export-Heavy IT Services"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "7.0% FY26",
			rbiRateStance: "Neutral with growth focus",
			tenYearGsecOutlook: "Consolidating 6.70%-6.80%",
			crudeImpact: "Manageable within budgetary parameters.",
		},
		advisoryTipForPartners:
			"Demonstrate the power of 10-year SIP step-ups (+10% annually) to young wealth builder clients to showcase exponential corpus compounding.",
		flagshipScheme: {
			name: "SBI Bluechip Fund",
			category: "Equity",
			subCategory: "Large Cap Fund",
			benchmark: "S&P BSE 100 TRI",
		},
	},
	{
		amcCode: "ICICIPRU_MF",
		amcName: "ICICI Prudential Mutual Fund",
		shortName: "ICICI Pru",
		tier: "mega_institutional",
		rta: "CAMS",
		aumBand: "₹8,60,000+ Cr (Rank 2)",
		leadStrategist: "Sankaran Naren",
		strategistRole: "ED & Chief Investment Officer, ICICI Prudential AMC",
		title: "In-House Valuation Model & Dynamic Asset Allocation Stance",
		category: "asset_allocation",
		keyTakeaways: [
			"In-house Price-to-Book (P/B) and Dividend Yield Model indicates equity markets in 'fair-to-mildly elevated' zone.",
			"Balanced Advantage Fund (BAF) model maintains 60-65% net equity exposure with 35-40% in debt and derivative arbitrage.",
			"Multi-Asset Allocation strategy provides optimal risk-adjusted ballast by actively blending domestic equity, fixed income, and gold.",
		],
		sectorCalls: {
			overweight: ["Large-Cap Financials", "Telecom", "Electric Utilities"],
			neutral: ["IT Services", "Metals"],
			underweight: ["Unprofitable Consumer Tech", "Overleveraged Real Estate"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "6.7% Real GDP Growth",
			rbiRateStance: "Accommodative bias on durable inflation prints",
			tenYearGsecOutlook: "Yields attractive for 3-5 year duration lock-in",
			crudeImpact: "Supportive for Indian macros and fiscal deficit glide path.",
		},
		advisoryTipForPartners:
			"For conservative-to-moderate clients or retirees, position Balanced Advantage / Multi-Asset funds to curb drawdowns without sacrificing long-term equity compounding.",
		flagshipScheme: {
			name: "ICICI Prudential Multi-Asset Fund",
			category: "Hybrid",
			subCategory: "Multi Asset Allocation",
			benchmark: "NIFTY 50 (65%) + Debt (25%) + Gold (10%)",
		},
	},
	{
		amcCode: "HDFC_MF",
		amcName: "HDFC Mutual Fund",
		shortName: "HDFC MF",
		tier: "mega_institutional",
		rta: "CAMS",
		aumBand: "₹7,80,000+ Cr (Rank 3)",
		leadStrategist: "Chirag Setalvad",
		strategistRole: "Head - Equities, HDFC AMC",
		title: "HDFC MF Investment Outlook: Corporate Earnings & Capex Continuity",
		category: "equity_outlook",
		keyTakeaways: [
			"Indian corporate balance sheets remain at multi-decade low leverage ratios (<0.4x D/E), providing high earnings durability.",
			"Large-cap valuations trade near 10-year historical averages, whereas selective small-caps require strict earnings delivery verification.",
			"Domestic private capex cycle broadening from power & renewables to automotive and industrials.",
		],
		sectorCalls: {
			overweight: ["Banking & Financial Services", "Power & Capital Goods", "Healthcare & Pharma"],
			neutral: ["Information Technology", "Automobile"],
			underweight: ["Commodity Cyclicals", "High-Beta Consumer Discretionary"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "6.8% - 7.0% for FY26",
			rbiRateStance: "Neutral with calibrated liquidity easing",
			tenYearGsecOutlook: "Rangebound between 6.65% and 6.85%",
			crudeImpact: "Brent below $75/bbl provides healthy macro cushion for India's current account.",
		},
		advisoryTipForPartners:
			"Guide clients with >5 year horizons toward Large & Mid Cap or Flexi Cap strategies; avoid aggressive lump sums in single-sector momentum themes.",
		flagshipScheme: {
			name: "HDFC Balanced Advantage Fund",
			category: "Hybrid",
			subCategory: "Dynamic Asset Allocation / Balanced Advantage",
			benchmark: "NIFTY 50 Hybrid Composite Debt 50:50 Index",
		},
	},
	{
		amcCode: "NIPPON_MF",
		amcName: "Nippon India Mutual Fund",
		shortName: "Nippon India",
		tier: "mega_institutional",
		rta: "KFintech",
		aumBand: "₹5,60,000+ Cr (Rank 4)",
		leadStrategist: "Amit Tripathi",
		strategistRole: "Chief Investment Officer - Fixed Income, Nippon India AMC",
		title: "Fixed Income Outlook: Sovereign Yield Curve & Duration Opportunities",
		category: "debt_outlook",
		keyTakeaways: [
			"Headline 10Y Indian Government Bond (G-Sec) yield at ~6.75% offers compelling real yields (>2.5% over CPI inflation).",
			"Foreign Portfolio Investor (FPI) sovereign index inclusions continuing to absorb supply.",
			"High credit quality Banking & PSU debt and Corporate Bond funds offer superior risk-reward over low-rated credit.",
		],
		sectorCalls: {
			overweight: ["AAA Public Sector Undertakings", "Sovereign G-Sec (5-7Y duration)", "TREPS / Overnight"],
			neutral: ["State Development Loans (SDLs)"],
			underweight: ["Below-AA NBFC Papers"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "6.8% FY26",
			rbiRateStance: "Easing stance; liquidity conditions in surplus",
			tenYearGsecOutlook: "Expected to trend towards 6.60% over 12 months",
			crudeImpact: "Subdued imported inflation aiding debt markets.",
		},
		advisoryTipForPartners:
			"Encourage conservative corporate treasuries and retirees to lock in 3-5 year High Quality Corporate Bond or Target Maturity G-Sec funds before yield curves flatten.",
		flagshipScheme: {
			name: "Nippon India ETF Nifty 50 BeES",
			category: "Equity",
			subCategory: "Exchange Traded Fund (ETF)",
			benchmark: "NIFTY 50 TRI",
		},
	},
	{
		amcCode: "KOTAK_MF",
		amcName: "Kotak Mahindra Mutual Fund",
		shortName: "Kotak MF",
		tier: "mega_institutional",
		rta: "CAMS",
		aumBand: "₹4,80,000+ Cr (Rank 5)",
		leadStrategist: "Harsha Upadhyaya",
		strategistRole: "Chief Investment Officer - Equities, Kotak Mahindra AMC",
		title: "Kotak MF Perspective: Valuation Discipline & Capital Goods Super-Cycle",
		category: "equity_outlook",
		keyTakeaways: [
			"Mid and small-cap valuations trade at cyclic premiums to large-caps, warranting rigorous earnings-quality screening.",
			"Domestic private capex, transmission grids, and defense manufacturing backed by 3-5 year order visibility.",
			"Indian banking sector balance sheets are at multi-decade best health with record low non-performing assets.",
		],
		sectorCalls: {
			overweight: ["Capital Goods & Engineering", "Private Banks", "Auto Components"],
			neutral: ["Information Technology", "Pharmaceuticals"],
			underweight: ["Global Commodity Cyclicals", "High-Beta Story Stocks"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "6.9% FY26",
			rbiRateStance: "Neutral with growth support",
			tenYearGsecOutlook: "Consolidating in 6.70% - 6.80% band",
			crudeImpact: "Manageable within macro tolerance thresholds.",
		},
		advisoryTipForPartners:
			"For clients with moderate risk profiles, pivot incremental allocations into Large & Mid Cap or Multicap funds rather than unconstrained small caps.",
		flagshipScheme: {
			name: "Kotak Emerging Equity Fund",
			category: "Equity",
			subCategory: "Mid Cap Fund",
			benchmark: "NIFTY Midcap 150 TRI",
		},
	},
	{
		amcCode: "ABSL_MF",
		amcName: "Aditya Birla Sun Life Mutual Fund",
		shortName: "ABSL MF",
		tier: "mega_institutional",
		rta: "CAMS",
		aumBand: "₹3,90,000+ Cr (Rank 6)",
		leadStrategist: "Mahesh Patil",
		strategistRole: "Chief Investment Officer, Aditya Birla Sun Life AMC",
		title: "ABSL MF Outlook: India's Manufacturing Expansion & Fixed Income Duration",
		category: "macro_strategy",
		keyTakeaways: [
			"India's twin-balance-sheet advantage (deleveraged corporates + well-capitalized banks) creates conditions for sustained credit expansion.",
			"Production Linked Incentive (PLI) schemes driving private capex in electronics, solar cells, and automotive ancillaries.",
			"Fixed income duration strategies positioned for capital appreciation as the Reserve Bank approaches monetary easing.",
		],
		sectorCalls: {
			overweight: ["Banking & Financial Services", "Manufacturing & Industrials", "Consumer Discretionary"],
			neutral: ["Information Technology", "Pharma"],
			underweight: ["Commodity Metals", "Upstream Oil & Gas"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "7.0% FY26",
			rbiRateStance: "Accommodative policy stance expected",
			tenYearGsecOutlook: "10-Year yield expected to ease to 6.65%",
			crudeImpact: "Favorable for fiscal deficit glide path.",
		},
		advisoryTipForPartners:
			"Highlight Multi-Asset Allocation and Dynamic Asset Allocation strategies to risk-conscious clients seeking smoother investment journeys.",
		flagshipScheme: {
			name: "Aditya Birla Sun Life Frontline Equity Fund",
			category: "Equity",
			subCategory: "Large Cap Fund",
			benchmark: "NIFTY 100 TRI",
		},
	},
	{
		amcCode: "AXIS_MF",
		amcName: "Axis Mutual Fund",
		shortName: "Axis MF",
		tier: "mega_institutional",
		rta: "KFintech",
		aumBand: "₹3,20,000+ Cr (Rank 7)",
		leadStrategist: "Shreyash Devalkar",
		strategistRole: "Head of Equity, Axis AMC",
		title: "Axis MF Quality & Growth Blueprint: Cash Flow Compounding & Tech Modernization",
		category: "equity_outlook",
		keyTakeaways: [
			"Quality-growth investment philosophy: Anchoring portfolios to businesses with sustainable competitive moats and high free cash flow.",
			"Urban consumption and retail financialization creating multi-year secular expansion runways.",
			"Enterprise technology spending recovering as global hyperscalers scale cloud modernization and generative AI infrastructure.",
		],
		sectorCalls: {
			overweight: ["Private Sector Banks", "Digital & Telecom", "Healthcare Services"],
			neutral: ["Automobiles", "Cement & Building Materials"],
			underweight: ["Debt-Heavy Infrastructure", "Commodity PSUs"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "6.8% FY26",
			rbiRateStance: "Gradual easing as headline inflation stabilizes",
			tenYearGsecOutlook: "Attractive for medium-duration lock-in (~6.75%)",
			crudeImpact: "Subdued energy prices support corporate operating margins.",
		},
		advisoryTipForPartners:
			"Recommend quality-growth flexi cap and large-cap strategies to investors seeking lower drawdown volatility during market consolidations.",
		flagshipScheme: {
			name: "Axis Small Cap Fund",
			category: "Equity",
			subCategory: "Small Cap Fund",
			benchmark: "NIFTY Smallcap 250 TRI",
		},
	},
	{
		amcCode: "UTI_MF",
		amcName: "UTI Mutual Fund",
		shortName: "UTI MF",
		tier: "mega_institutional",
		rta: "KFintech",
		aumBand: "₹3,15,000+ Cr (Rank 8)",
		leadStrategist: "Vetri Subramaniam",
		strategistRole: "Chief Investment Officer, UTI AMC",
		title: "UTI MF Strategy: Multi-Cycle Valuation Discipline & Large-Cap Anchor",
		category: "equity_outlook",
		keyTakeaways: [
			"Long-term valuation mean reversion: Focusing on operating cash flows and return on invested capital (ROIC) over full business cycles.",
			"Large-cap frontline leaders provide superior risk-adjusted comfort given current valuation spreads against mid and small caps.",
			"India's formalization and digitization themes continuing to deliver compounding market share gains for organized sector leaders.",
		],
		sectorCalls: {
			overweight: ["Banking & Financial Services", "Information Technology", "Consumer Discretionary"],
			neutral: ["Healthcare & Pharma", "Automobiles"],
			underweight: ["High-Debt Real Estate", "Upstream Commodity Cyclicals"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "6.8% FY26",
			rbiRateStance: "Neutral with growth focus",
			tenYearGsecOutlook: "Stable near 6.75%",
			crudeImpact: "Manageable within budget comfort band.",
		},
		advisoryTipForPartners:
			"Position low-cost broad index funds (UTI Nifty 50 Index Fund) and disciplined large & mid cap funds as foundational core holdings.",
		flagshipScheme: {
			name: "UTI Nifty 50 Index Fund",
			category: "Equity",
			subCategory: "Index Fund",
			benchmark: "NIFTY 50 TRI",
		},
	},
	{
		amcCode: "TATA_MF",
		amcName: "Tata Mutual Fund",
		shortName: "Tata MF",
		tier: "mega_institutional",
		rta: "CAMS",
		aumBand: "₹1,85,000+ Cr (Rank 9)",
		leadStrategist: "Rahul Singh",
		strategistRole: "Chief Investment Officer - Equities, Tata Asset Management",
		title: "Tata MF Cyclical & Structural Playbook: Private Capex & Digital Adoption",
		category: "thematic_call",
		keyTakeaways: [
			"Dual engine of physical infrastructure capex and enterprise digital adoption driving broad-based earnings expansion.",
			"Balanced Advantage dynamic models taking timely profit off cyclical peaks and reinvesting in defensive fixed income.",
			"Specialty chemicals and healthcare experiencing inventory normalization and sequential EBITDA margin recovery.",
		],
		sectorCalls: {
			overweight: ["Capital Goods & Defense", "Power Transmission & Renewables", "Large Private Banks"],
			neutral: ["FMCG & Staples", "Metals"],
			underweight: ["Commodity Chemicals", "Tier-2 IT Services"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "6.8% FY26",
			rbiRateStance: "Neutral with balanced liquidity",
			tenYearGsecOutlook: "Stable near 6.75%",
			crudeImpact: "Manageable",
		},
		advisoryTipForPartners:
			"Recommend Balanced Advantage and Large & Mid Cap funds for first-time mutual fund investors to minimize volatility anxiety.",
		flagshipScheme: {
			name: "Tata Digital India Fund",
			category: "Equity",
			subCategory: "Sectoral / Thematic - Technology",
			benchmark: "BSE TeCK TRI",
		},
	},
	{
		amcCode: "DSP_MF",
		amcName: "DSP Mutual Fund",
		shortName: "DSP MF",
		tier: "mega_institutional",
		rta: "CAMS",
		aumBand: "₹1,72,000+ Cr (Rank 10)",
		leadStrategist: "Vinit Sambre",
		strategistRole: "Head - Equities, DSP Mutual Fund",
		title: "DSP MF Investment Compass: Margin of Safety & Small-Cap Prudence",
		category: "equity_outlook",
		keyTakeaways: [
			"Margin of safety principle: Prioritize corporate governance, high Return on Capital Employed (ROCE), and reasonable valuations over chasing momentum.",
			"Small-cap universe requires strict liquidity and debt-level sanity checks to avoid cyclic drawdowns.",
			"Healthcare, domestic diagnostics, and pharma formulations offer resilient structural tailwinds irrespective of global interest rates.",
		],
		sectorCalls: {
			overweight: ["Healthcare & Pharmaceuticals", "Specialized Manufacturing", "Retail Private Banks"],
			neutral: ["Consumer Staples", "Telecom"],
			underweight: ["Expensive Thematic Momentum Plays", "Government Cyclicals"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "6.7% FY26",
			rbiRateStance: "Gradual easing bias",
			tenYearGsecOutlook: "Rangebound 6.70% - 6.80%",
			crudeImpact: "Benign imported inflation.",
		},
		advisoryTipForPartners:
			"Advise clients to avoid FOMO in overheated sectoral themes and instead build core diversified equity portfolios via Systematic Investment Plans (SIPs).",
		flagshipScheme: {
			name: "DSP Healthcare Fund",
			category: "Equity",
			subCategory: "Sectoral / Thematic - Healthcare",
			benchmark: "BSE Healthcare TRI",
		},
	},

	// ─── 2. ESTABLISHED PILLARS (Proven Multi-Cycle Leaders) ──────────────────
	{
		amcCode: "MIRAE_MF",
		amcName: "Mirae Asset Mutual Fund",
		shortName: "Mirae Asset",
		tier: "established_pillar",
		rta: "KFintech",
		aumBand: "₹1,80,000+ Cr",
		leadStrategist: "Neelesh Surana",
		strategistRole: "Chief Investment Officer, Mirae Asset Investment Managers",
		title: "Mirae Asset Strategy: Bottom-Up Stock Picking in High-RoE Leaders",
		category: "equity_outlook",
		keyTakeaways: [
			"Focus remains strictly on high Return on Equity (RoE > 18%) businesses with sustained pricing power and clean governance.",
			"Mid-cap segment offers robust secular compounders, but stock selection must be anchored to free-cash-flow yield.",
			"Hybrid strategies (Aggressive Hybrid & BAF) provide great entry points for first-time mutual fund investors.",
		],
		sectorCalls: {
			overweight: ["Consumer Discretionary", "Financial Services", "Industrial Manufacturing"],
			neutral: ["Pharma & Chemicals"],
			underweight: ["Government Controlled Commodities"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "6.9% FY26",
			rbiRateStance: "Data-dependent",
			tenYearGsecOutlook: "Stable 6.75%",
			crudeImpact: "Neutral",
		},
		advisoryTipForPartners:
			"Emphasize 5-year rolling returns rather than point-to-point trailing returns when reviewing client portfolios.",
		flagshipScheme: {
			name: "Mirae Asset Large & Midcap Fund",
			category: "Equity",
			subCategory: "Large & Mid Cap Fund",
			benchmark: "NIFTY LargeMidcap 250 TRI",
		},
	},
	{
		amcCode: "BANDHAN_MF",
		amcName: "Bandhan Mutual Fund",
		shortName: "Bandhan MF",
		tier: "established_pillar",
		rta: "CAMS",
		aumBand: "₹1,62,000+ Cr",
		leadStrategist: "Suyash Choudhary",
		strategistRole: "Head - Fixed Income, Bandhan AMC",
		title: "Bandhan MF Compass: Sovereign Duration Sweet Spot & Contrarian Value",
		category: "debt_outlook",
		keyTakeaways: [
			"Fixed income sovereign yield curves offer exceptional real risk-free yields (>2.5% real spread over CPI inflation).",
			"Duration play: The 5-7 year sovereign bond segment represents the optimal risk-reward sweet spot for capital appreciation as RBI monetary easing approaches.",
			"Contrarian value equity approach: Disciplined allocation into unloved sectors with clean balance sheets and cyclically depressed earnings.",
		],
		sectorCalls: {
			overweight: ["Sovereign G-Secs (5-7Y)", "High-Quality AAA PSU Bonds", "Retail Private Banks"],
			neutral: ["Electric Utilities", "Energy"],
			underweight: ["Low-Rated Credit Spreads", "Speculative Unprofitable Tech"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "6.8% FY26",
			rbiRateStance: "Gradual easing as inflation prints align",
			tenYearGsecOutlook: "Expected to test 6.65% over 12 months",
			crudeImpact: "Benign imported inflation aiding bond yields.",
		},
		advisoryTipForPartners:
			"Recommend Target Maturity G-Sec funds and Banking & PSU debt funds to lock in yields for retirees and risk-averse corporate treasuries.",
		flagshipScheme: {
			name: "Bandhan Sterling Value Fund",
			category: "Equity",
			subCategory: "Value Fund",
			benchmark: "S&P BSE 500 TRI",
		},
	},
	{
		amcCode: "EDELWEISS_MF",
		amcName: "Edelweiss Mutual Fund",
		shortName: "Edelweiss MF",
		tier: "established_pillar",
		rta: "KFintech",
		aumBand: "₹1,45,000+ Cr",
		leadStrategist: "Radhika Gupta",
		strategistRole: "Managing Director & CEO, Edelweiss AMC",
		title: "Edelweiss MF Blueprint: Bharat Bond Fixed Income & Multi-Asset Resilience",
		category: "asset_allocation",
		keyTakeaways: [
			"Balanced Advantage and Multi-Asset strategies provide the ultimate vehicle for smooth retail investor journeys through volatile markets.",
			"Bharat Bond target maturity structure has democratized transparent, low-cost AAA corporate debt investing for retail Indian households.",
			"Mid-cap manufacturing, renewables, and defense supply chains represent secular decades-long compounding themes.",
		],
		sectorCalls: {
			overweight: ["Power Transmission & Renewables", "Manufacturing & Defense", "Private Sector Banks"],
			neutral: ["Fast Moving Consumer Goods"],
			underweight: ["Global Commodity Cyclicals", "Metals"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "7.0% FY26",
			rbiRateStance: "Accommodative policy stance expected",
			tenYearGsecOutlook: "Rangebound 6.70% - 6.75%",
			crudeImpact: "Favorable for corporate operating margins.",
		},
		advisoryTipForPartners:
			"Encourage clients who feel anxious about market all-time highs to use Balanced Advantage and Multi-Asset allocation funds rather than stopping SIPs.",
		flagshipScheme: {
			name: "Edelweiss Bharat Bond ETF - April 2033",
			category: "Debt",
			subCategory: "Target Maturity Gilt / AAA PSU Bond",
			benchmark: "Nifty Bharat Bond Index - April 2033",
		},
	},
	{
		amcCode: "PPFAS_MF",
		amcName: "PPFAS Mutual Fund",
		shortName: "Parag Parikh",
		tier: "established_pillar",
		rta: "CAMS",
		aumBand: "₹92,000+ Cr",
		leadStrategist: "Rajeev Thakkar",
		strategistRole: "Chief Investment Officer & Director, PPFAS AMC",
		title: "PPFAS Value Investing Philosophy: Moats, Cash Generation & Global Diversification",
		category: "asset_allocation",
		keyTakeaways: [
			"True unconstrained value investing: Concentrated portfolio of cash-generating companies with deep economic moats.",
			"International equity diversification provides currency hedge against Indian rupee depreciation while owning global tech leaders.",
			"High cash and arbitrage reserves maintained as strategic dry powder to deploy aggressively during market dislocations.",
		],
		sectorCalls: {
			overweight: ["Global Tech Platforms", "Indian Private Financials", "Energy & Utilities"],
			neutral: ["Fast Moving Consumer Goods"],
			underweight: ["Overhyped Pre-Profit IPOs", "Leveraged NBFCs"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "6.8% Real GDP Growth",
			rbiRateStance: "Prudent and data-dependent",
			tenYearGsecOutlook: "Stable sovereign clearing at 6.75%",
			crudeImpact: "Neutral with balanced current account deficit.",
		},
		advisoryTipForPartners:
			"Position Parag Parikh Flexi Cap as a cornerstone equity fund for clients who value disciplined capital preservation and international diversification.",
		flagshipScheme: {
			name: "Parag Parikh Flexi Cap Fund",
			category: "Equity",
			subCategory: "Flexi Cap Fund",
			benchmark: "NIFTY 500 TRI",
		},
	},
	{
		amcCode: "MOTILAL_MF",
		amcName: "Motilal Oswal Mutual Fund",
		shortName: "Motilal Oswal",
		tier: "established_pillar",
		rta: "KFintech",
		aumBand: "₹88,000+ Cr",
		leadStrategist: "Niket Shah",
		strategistRole: "Chief Investment Officer, Motilal Oswal AMC",
		title: "Motilal Oswal Strategy: QGLP High-Growth Alpha & Global Tech Exposure",
		category: "thematic_call",
		keyTakeaways: [
			"QGLP Investing Philosophy: Quality of business, Growth in earnings, Longevity of competitive advantage, and Price at a reasonable discount.",
			"High-conviction concentrated mid-cap portfolios have historically produced the highest long-term multibagger compounding outcomes.",
			"Global passive investing through NASDAQ 100 provides indispensable exposure to enterprise AI and world-dominating tech platforms.",
		],
		sectorCalls: {
			overweight: ["High-Growth Midcaps", "Global AI Tech Platforms", "Consumer Financial Services"],
			neutral: ["Pharmaceuticals & Life Sciences"],
			underweight: ["Low-Growth Capital Intensive Utilities", "Commodity PSUs"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "7.0% FY26",
			rbiRateStance: "Pro-growth with balanced liquidity",
			tenYearGsecOutlook: "Consolidating around 6.75%",
			crudeImpact: "Neutral with balanced macro current account.",
		},
		advisoryTipForPartners:
			"For aggressive, long-horizon clients (>7 years), suggest allocating 20-30% of equity into high-conviction midcap and global tech strategies.",
		flagshipScheme: {
			name: "Motilal Oswal Midcap Fund",
			category: "Equity",
			subCategory: "Mid Cap Fund",
			benchmark: "NIFTY Midcap 150 TRI",
		},
	},
	{
		amcCode: "FRANKLIN_MF",
		amcName: "Franklin Templeton Mutual Fund",
		shortName: "Franklin",
		tier: "established_pillar",
		rta: "CAMS",
		aumBand: "₹1,10,000+ Cr",
		leadStrategist: "Janakiraman Rengaraju",
		strategistRole: "CIO - Emerging Markets Equities, Franklin Templeton",
		title: "Franklin Templeton Outlook: 30-Year Bottom-Up Compounding & Discretionary Surge",
		category: "equity_outlook",
		keyTakeaways: [
			"Bottom-up fundamental stock picking backed by a 30+ year track record in India's mid and small-cap ecosystem.",
			"Focus on companies with proven capital allocation track records, high return on equity, and dominant domestic franchise power.",
			"India's rising per capita income inflection point will drive exponential non-linear growth in discretionary consumption and organized retail.",
		],
		sectorCalls: {
			overweight: ["Consumer Discretionary & Retail", "Industrial Automation", "Private Financials"],
			neutral: ["Telecommunications", "Information Technology"],
			underweight: ["High-Leverage Real Estate", "Unprofitable Pre-IPO Unicorns"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "6.9% FY26",
			rbiRateStance: "Data-dependent and pragmatic",
			tenYearGsecOutlook: "Stable near 6.75%",
			crudeImpact: "Neutral",
		},
		advisoryTipForPartners:
			"Recommend Franklin India Prima and Flexi Cap funds for clients seeking time-tested bottom-up compounders through multiple market cycles.",
		flagshipScheme: {
			name: "Franklin India Prima Fund",
			category: "Equity",
			subCategory: "Mid Cap Fund",
			benchmark: "NIFTY Midcap 150 TRI",
		},
	},
	{
		amcCode: "CANARA_ROBECO_MF",
		amcName: "Canara Robeco Mutual Fund",
		shortName: "Canara Robeco",
		tier: "established_pillar",
		rta: "KFintech",
		aumBand: "₹96,000+ Cr",
		leadStrategist: "Shridatta Bhandwaldar",
		strategistRole: "Head - Equities, Canara Robeco AMC",
		title: "Canara Robeco Prudence: Resilient Quality Growth Across Large & Emerging Leaders",
		category: "equity_outlook",
		keyTakeaways: [
			"Prudent growth at reasonable price (GARP): Avoiding extreme momentum in favour of steady compounders.",
			"Emerging Equities strategy blends large-cap stability with mid-cap growth for superior risk-adjusted alpha.",
			"Consumer trends and capital goods benefiting from rising capacity utilization levels (>75%).",
		],
		sectorCalls: {
			overweight: ["Private Banks & NBFCs", "Capital Goods", "Automobiles"],
			neutral: ["IT Services", "Chemicals"],
			underweight: ["Metals", "Speculative Micro-Caps"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "6.8% FY26",
			rbiRateStance: "Neutral with balanced stance",
			tenYearGsecOutlook: "Consolidating 6.75%",
			crudeImpact: "Manageable",
		},
		advisoryTipForPartners:
			"Position Canara Robeco Emerging Equities Fund for conservative-to-moderate equity investors seeking consistent risk-adjusted quartile-1 performance.",
		flagshipScheme: {
			name: "Canara Robeco Emerging Equities Fund",
			category: "Equity",
			subCategory: "Large & Mid Cap Fund",
			benchmark: "NIFTY LargeMidcap 250 TRI",
		},
	},
	{
		amcCode: "INVESCO_MF",
		amcName: "Invesco Mutual Fund",
		shortName: "Invesco MF",
		tier: "established_pillar",
		rta: "KFintech",
		aumBand: "₹82,000+ Cr",
		leadStrategist: "Taher Badshah",
		strategistRole: "Chief Investment Officer, Invesco Mutual Fund",
		title: "Invesco Global & Domestic View: Secular Earnings Expansion in High-ROCE Franchises",
		category: "equity_outlook",
		keyTakeaways: [
			"Category leadership with high Return on Capital Employed (ROCE) generates superior economic value added (EVA).",
			"Discretionary consumption and healthcare poised for cyclical tailwinds as real wage growth accelerates.",
			"Global offshore feeders provide calibrated access to US technology and clean energy themes.",
		],
		sectorCalls: {
			overweight: ["Financial Services", "Consumer Discretionary", "Healthcare"],
			neutral: ["Information Technology", "Commodities"],
			underweight: ["Overleveraged Infrastructure", "Real Estate"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "6.9% FY26",
			rbiRateStance: "Easing bias",
			tenYearGsecOutlook: "6.70% - 6.80%",
			crudeImpact: "Neutral",
		},
		advisoryTipForPartners:
			"Recommend Invesco India Contra Fund for value-conscious clients seeking contrarian re-rating upside in mispriced quality businesses.",
		flagshipScheme: {
			name: "Invesco India Contra Fund",
			category: "Equity",
			subCategory: "Contra Fund",
			benchmark: "S&P BSE 500 TRI",
		},
	},
	{
		amcCode: "HSBC_MF",
		amcName: "HSBC Mutual Fund",
		shortName: "HSBC MF",
		tier: "established_pillar",
		rta: "CAMS",
		aumBand: "₹1,20,000+ Cr",
		leadStrategist: "Venugopal Manghat",
		strategistRole: "Head - Equities, HSBC Asset Management India",
		title: "HSBC Global Lens: Structural Inflows into Indian Manufacturing & Financialization",
		category: "macro_strategy",
		keyTakeaways: [
			"Integration of L&T Mutual Fund business created a powerhouse across equity mid-caps, debt, and hybrid assets.",
			"Global emerging market allocations increasingly treating India as a standalone asset class with premium valuations.",
			"Fixed income credit spreads attractive in AAA and select AA+ corporate bond categories.",
		],
		sectorCalls: {
			overweight: ["Banking & Financial Services", "Capital Goods", "Pharma"],
			neutral: ["IT Services", "Energy"],
			underweight: ["Commodity Cyclicals", "Metals"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "6.8% FY26",
			rbiRateStance: "Neutral",
			tenYearGsecOutlook: "6.75%",
			crudeImpact: "Manageable",
		},
		advisoryTipForPartners:
			"Guide HNI clients with international portfolios to explore HSBC's global fund of funds alongside domestic midcap compounders.",
		flagshipScheme: {
			name: "HSBC Midcap Fund",
			category: "Equity",
			subCategory: "Mid Cap Fund",
			benchmark: "NIFTY Midcap 150 TRI",
		},
	},
	{
		amcCode: "BARODA_BNP_MF",
		amcName: "Baroda BNP Paribas Mutual Fund",
		shortName: "Baroda BNP",
		tier: "established_pillar",
		rta: "KFintech",
		aumBand: "₹42,000+ Cr",
		leadStrategist: "Sanjay Chawla",
		strategistRole: "Chief Investment Officer - Equities, Baroda BNP Paribas AMC",
		title: "Baroda BNP Paribas Perspective: Indo-European Synthesis & Corporate Capex",
		category: "equity_outlook",
		keyTakeaways: [
			"Joint venture combining Bank of Baroda's extensive domestic network with BNP Paribas' institutional risk management.",
			"High-conviction equity approach focused on cash conversion cycle and sustainable return on equity.",
			"Balanced Advantage models taking advantage of volatility to systematically rebalance.",
		],
		sectorCalls: {
			overweight: ["Automobiles", "Banking & Finance", "Healthcare"],
			neutral: ["Telecom", "IT Services"],
			underweight: ["Commodity Metals", "Real Estate"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "6.8% FY26",
			rbiRateStance: "Accommodative",
			tenYearGsecOutlook: "6.70% - 6.80%",
			crudeImpact: "Neutral",
		},
		advisoryTipForPartners:
			"Position Baroda BNP Paribas Balanced Advantage Fund for investors seeking international risk discipline with domestic growth.",
		flagshipScheme: {
			name: "Baroda BNP Paribas Balanced Advantage Fund",
			category: "Hybrid",
			subCategory: "Dynamic Asset Allocation",
			benchmark: "CRISIL Hybrid 50+50 Moderate Index",
		},
	},
	{
		amcCode: "SUNDARAM_MF",
		amcName: "Sundaram Mutual Fund",
		shortName: "Sundaram MF",
		tier: "established_pillar",
		rta: "CAMS",
		aumBand: "₹68,000+ Cr",
		leadStrategist: "Sunil Subramaniam",
		strategistRole: "Senior Advisor & Veteran Strategist, Sundaram Mutual Fund",
		title: "Sundaram MF Lens: Mid & Small-Cap Ecosystem Mastery & Southern Capex Hubs",
		category: "equity_outlook",
		keyTakeaways: [
			"Over two decades of proven domain expertise in identifying emerging mid and small-cap leaders early.",
			"Capex cycle in southern industrial corridors (auto, electronics, textiles) delivering robust earnings acceleration.",
			"Services and consumption themes continuing to expand addressable market size.",
		],
		sectorCalls: {
			overweight: ["Auto Ancillaries", "Capital Goods", "Private Banks"],
			neutral: ["Healthcare", "Information Technology"],
			underweight: ["Commodity Cyclicals", "Energy"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "7.0% FY26",
			rbiRateStance: "Pro-growth",
			tenYearGsecOutlook: "6.75%",
			crudeImpact: "Manageable",
		},
		advisoryTipForPartners:
			"Recommend Sundaram Mid Cap Fund for investors wanting authentic mid-market research and high corporate governance vetting.",
		flagshipScheme: {
			name: "Sundaram Mid Cap Fund",
			category: "Equity",
			subCategory: "Mid Cap Fund",
			benchmark: "NIFTY Midcap 150 TRI",
		},
	},

	// ─── 3. HIGH ALPHA & BOUTIQUE SPECIALISTS ────────────────────────────────
	{
		amcCode: "QUANT_MF",
		amcName: "Quant Mutual Fund",
		shortName: "Quant MF",
		tier: "alpha_boutique",
		rta: "KFintech",
		aumBand: "₹95,000+ Cr",
		leadStrategist: "Sandeep Tandon",
		strategistRole: "Founder & Chief Investment Officer, Quant Mutual Fund",
		title: "Quant MF Dynamic Lens: VLRT Predictive Analytics & Aggressive Sector Rotation",
		category: "thematic_call",
		keyTakeaways: [
			"VLRT Framework: Proprietary cross-asset predictive analytics modeling Valuation, Liquidity, Risk appetite, and Time horizon.",
			"Dynamic active sector rotation: Unapologetically pivoting capital into sectors experiencing strong liquidity inflows and momentum confirmation.",
			"Active risk management is executed via dynamic cash-futures hedging and aggressive sector reallocation rather than buy-and-hold passivity.",
		],
		sectorCalls: {
			overweight: ["Metals & Energy Cyclicals", "Defense & Infrastructure", "Public Sector Enterprises (PSEs)"],
			neutral: ["Private Sector Banks"],
			underweight: ["Traditional FMCG & Expensive Consumer Staples"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "7.1% FY26",
			rbiRateStance: "Growth-supportive",
			tenYearGsecOutlook: "Stable 6.75%",
			crudeImpact: "Volatile but offers tactical alpha opportunities.",
		},
		advisoryTipForPartners:
			"Suitable for high-risk, alpha-seeking investors who understand that Quant MF's active dynamic strategy involves higher volatility and portfolio turnover.",
		flagshipScheme: {
			name: "Quant Active Fund",
			category: "Equity",
			subCategory: "Multi Cap Fund",
			benchmark: "NIFTY 500 Multicap 50:25:25 TRI",
		},
	},
	{
		amcCode: "WHITEOAK_MF",
		amcName: "WhiteOak Capital Mutual Fund",
		shortName: "WhiteOak",
		tier: "alpha_boutique",
		rta: "CAMS",
		aumBand: "₹18,500+ Cr",
		leadStrategist: "Prashant Khemka",
		strategistRole: "Founder & CIO, WhiteOak Capital Management",
		title: "WhiteOak Capital Philosophy: Cash Flow Alpha & Outsized Op-Cash Yields",
		category: "equity_outlook",
		keyTakeaways: [
			"Performance-first stock selection: Focusing exclusively on business operations, corporate governance, and cash flow yield rather than macro forecasting.",
			"Balanced portfolio construction across cyclical, secular, defensive, and value buckets to minimize factor risk.",
			"Mid-cap and flexi-cap frameworks built with global institutional governance rigor.",
		],
		sectorCalls: {
			overweight: ["Private Financials", "Consumer Discretionary", "Specialty Manufacturing"],
			neutral: ["Information Technology", "Pharma"],
			underweight: ["Government Controlled Entities", "Capital-Destroying Commoditized Sectors"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "6.9% FY26",
			rbiRateStance: "Neutral",
			tenYearGsecOutlook: "6.75%",
			crudeImpact: "Neutral",
		},
		advisoryTipForPartners:
			"Ideal for sophisticated clients looking for bottom-up institutional stock picking that does not rely on single-sector concentration bets.",
		flagshipScheme: {
			name: "WhiteOak Capital Flexi Cap Fund",
			category: "Equity",
			subCategory: "Flexi Cap Fund",
			benchmark: "S&P BSE 500 TRI",
		},
	},
	{
		amcCode: "MAHINDRA_MF",
		amcName: "Mahindra Manulife Mutual Fund",
		shortName: "Mahindra Manulife",
		tier: "alpha_boutique",
		rta: "KFintech",
		aumBand: "₹24,000+ Cr",
		leadStrategist: "Krishna Sanghavi",
		strategistRole: "Chief Investment Officer - Equities, Mahindra Manulife",
		title: "Mahindra Manulife Lens: Rural-Urban Consumption Convergence & Credit Expansion",
		category: "equity_outlook",
		keyTakeaways: [
			"Uniting Mahindra's unmatched rural insights with Manulife's 130-year global asset management expertise.",
			"Rural income revival and monsoon consistency boosting farm mechanization and entry-level consumption.",
			"Multi-cap strategies positioned to capture economic formalization across Tier-2/3 India.",
		],
		sectorCalls: {
			overweight: ["Automotive & Rural Infra", "Banking & NBFCs", "Capital Goods"],
			neutral: ["Healthcare", "Information Technology"],
			underweight: ["Global Commodities", "Metals"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "7.0% FY26",
			rbiRateStance: "Accommodative",
			tenYearGsecOutlook: "6.70% - 6.80%",
			crudeImpact: "Favorable",
		},
		advisoryTipForPartners:
			"Position Mahindra Manulife Multi Cap Fund for clients seeking direct exposure to the resurgence of India's rural and semi-urban growth engines.",
		flagshipScheme: {
			name: "Mahindra Manulife Multi Cap Fund",
			category: "Equity",
			subCategory: "Multi Cap Fund",
			benchmark: "NIFTY 500 Multicap 50:25:25 TRI",
		},
	},
	{
		amcCode: "PGIM_MF",
		amcName: "PGIM India Mutual Fund",
		shortName: "PGIM India",
		tier: "alpha_boutique",
		rta: "KFintech",
		aumBand: "₹28,500+ Cr",
		leadStrategist: "Vinay Paharia",
		strategistRole: "Chief Investment Officer, PGIM India Asset Management",
		title: "PGIM India Framework: High-Conviction Value Discovery & Capital Discipline",
		category: "equity_outlook",
		keyTakeaways: [
			"Backed by PGIM, one of the world's top 10 asset managers with over $1.3 Trillion in global assets.",
			"Disciplined value discovery: Screening for high Return on Invested Capital (ROIC) combined with attractive margin of safety.",
			"Global Real Estate and Global Agribusiness feeder funds provide unique non-correlated dollar asset diversification.",
		],
		sectorCalls: {
			overweight: ["Healthcare & Life Sciences", "Private Financials", "Auto Ancillary"],
			neutral: ["Information Technology", "Consumer Staples"],
			underweight: ["Speculative Tech", "Overleveraged Real Estate"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "6.8% FY26",
			rbiRateStance: "Neutral",
			tenYearGsecOutlook: "6.75%",
			crudeImpact: "Manageable",
		},
		advisoryTipForPartners:
			"Highlight PGIM India Midcap Opportunities Fund and global feeder funds for HNI clients seeking differentiated asset classes.",
		flagshipScheme: {
			name: "PGIM India Midcap Opportunities Fund",
			category: "Equity",
			subCategory: "Mid Cap Fund",
			benchmark: "NIFTY Midcap 150 TRI",
		},
	},
	{
		amcCode: "UNION_MF",
		amcName: "Union Mutual Fund",
		shortName: "Union MF",
		tier: "alpha_boutique",
		rta: "CAMS",
		aumBand: "₹18,200+ Cr",
		leadStrategist: "Hardick Bora",
		strategistRole: "Co-Head of Equities, Union Asset Management",
		title: "Union MF Strategy: High-Quality Growth at Fair Valuation (Q-GARP)",
		category: "equity_outlook",
		keyTakeaways: [
			"Co-sponsored by Union Bank of India and Dai-ichi Life Holdings of Japan.",
			"Q-GARP investment philosophy: Emphasizing fundamental operating cash flow generation and prudent leverage ratios.",
			"Balanced equity-debt allocation models providing steady capital growth for retail and corporate depositors.",
		],
		sectorCalls: {
			overweight: ["Banking & Financial Services", "Capital Goods", "Pharma"],
			neutral: ["Automobiles", "IT Services"],
			underweight: ["Commodity Metals", "Real Estate"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "6.8% FY26",
			rbiRateStance: "Accommodative",
			tenYearGsecOutlook: "6.75%",
			crudeImpact: "Neutral",
		},
		advisoryTipForPartners:
			"Recommend Union Flexi Cap Fund for investors who prioritize conservative quality-growth screening over aggressive speculative momentum.",
		flagshipScheme: {
			name: "Union Flexi Cap Fund",
			category: "Equity",
			subCategory: "Flexi Cap Fund",
			benchmark: "S&P BSE 500 TRI",
		},
	},
	{
		amcCode: "ITI_MF",
		amcName: "ITI Mutual Fund",
		shortName: "ITI MF",
		tier: "alpha_boutique",
		rta: "KFintech",
		aumBand: "₹9,800+ Cr",
		leadStrategist: "Rajesh Bhatia",
		strategistRole: "Managing Director & CIO, ITI Mutual Fund",
		title: "ITI MF Bottom-Up Compass: SQL (Safety, Quality, Low Leverage) Framework",
		category: "equity_outlook",
		keyTakeaways: [
			"Proprietary SQL framework: Safety of capital, Quality of business management, and Low balance sheet leverage.",
			"Disciplined approach to small and mid-cap investing: Avoiding illiquid momentum traps.",
			"Banking and capital goods sectors positioned for sustained earnings acceleration.",
		],
		sectorCalls: {
			overweight: ["Capital Goods", "Private Sector Banks", "Healthcare"],
			neutral: ["Consumer Staples", "Telecom"],
			underweight: ["Commodity Cyclicals", "Metals"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "6.9% FY26",
			rbiRateStance: "Neutral",
			tenYearGsecOutlook: "6.75%",
			crudeImpact: "Manageable",
		},
		advisoryTipForPartners:
			"Position ITI Small Cap Fund for long-term investors seeking clean corporate balance sheets and low leverage in small-cap stocks.",
		flagshipScheme: {
			name: "ITI Small Cap Fund",
			category: "Equity",
			subCategory: "Small Cap Fund",
			benchmark: "NIFTY Smallcap 250 TRI",
		},
	},
	{
		amcCode: "SAMCO_MF",
		amcName: "Samco Mutual Fund",
		shortName: "Samco MF",
		tier: "alpha_boutique",
		rta: "KFintech",
		aumBand: "₹2,400+ Cr",
		leadStrategist: "Jimeet Modi",
		strategistRole: "Founder & Director, Samco Asset Management",
		title: "Samco MF Framework: HexaShield Tested High-ROCE Disruptors & Stress Testing",
		category: "equity_outlook",
		keyTakeaways: [
			"HexaShield framework: Stress testing companies across balance sheet strength, corporate governance, cash flows, and pricing power.",
			"Pioneered active momentum and low-beta factor strategies in India.",
			"Focus on businesses that generate high Return on Capital Employed (ROCE > 20%) through all market cycles.",
		],
		sectorCalls: {
			overweight: ["Specialty Pharma", "Tech Platforms", "Private Lending"],
			neutral: ["FMCG", "Power"],
			underweight: ["Leveraged Utilities", "Commodity Cyclicals"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "6.8% FY26",
			rbiRateStance: "Neutral",
			tenYearGsecOutlook: "6.75%",
			crudeImpact: "Neutral",
		},
		advisoryTipForPartners:
			"Suitable for alpha-seeking investors looking for disciplined, stress-tested high-ROCE momentum strategies.",
		flagshipScheme: {
			name: "Samco Flexi Cap Fund",
			category: "Equity",
			subCategory: "Flexi Cap Fund",
			benchmark: "NIFTY 500 TRI",
		},
	},
	{
		amcCode: "TRUST_MF",
		amcName: "Trust Mutual Fund",
		shortName: "Trust MF",
		tier: "alpha_boutique",
		rta: "KFintech",
		aumBand: "₹4,600+ Cr",
		leadStrategist: "Anand Nevatia",
		strategistRole: "Fund Manager - Fixed Income, Trust Asset Management",
		title: "Trust MF Fixed Income Lens: Terminal Yield Predictability & Structured Accrual",
		category: "debt_outlook",
		keyTakeaways: [
			"Institutional focus on fixed income and debt capital markets with zero credit dilution.",
			"Limited active duration risk: Focusing on high-yield terminal predictability and model-driven yield curve capture.",
			"Corporate bond and banking PSU strategies provide dependable quarterly and annual cash flows.",
		],
		sectorCalls: {
			overweight: ["AAA Corporate Debentures", "Sovereign G-Secs", "TREPS"],
			neutral: ["State Development Loans (SDLs)"],
			underweight: ["Credit Risk / Below-AA Papers"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "6.8% FY26",
			rbiRateStance: "Accommodative bias",
			tenYearGsecOutlook: "6.70% - 6.75%",
			crudeImpact: "Benign",
		},
		advisoryTipForPartners:
			"Recommend Trust Banking & PSU Debt Fund to family offices and treasuries seeking institutional credit quality and yield predictability.",
		flagshipScheme: {
			name: "Trust Banking & PSU Debt Fund",
			category: "Debt",
			subCategory: "Banking and PSU Fund",
			benchmark: "CRISIL Banking and PSU Debt Index",
		},
	},
	{
		amcCode: "JM_FINANCIAL_MF",
		amcName: "JM Financial Mutual Fund",
		shortName: "JM Financial",
		tier: "alpha_boutique",
		rta: "KFintech",
		aumBand: "₹8,400+ Cr",
		leadStrategist: "Satish Ramanathan",
		strategistRole: "Chief Investment Officer - Equities, JM Financial AMC",
		title: "JM Financial Alpha Perspective: Growth Inflection & Cash Flow Surprises",
		category: "equity_outlook",
		keyTakeaways: [
			"Specialized focus on companies at the cusp of fundamental earnings inflection.",
			"Aggressive alpha generation in mid and small caps backed by deep in-house balance sheet scrutiny.",
			"Capital goods, energy transition, and defense supply chains delivering multi-year earnings momentum.",
		],
		sectorCalls: {
			overweight: ["Capital Goods & Engineering", "Defense Electronics", "Private Financials"],
			neutral: ["Information Technology", "Consumer Staples"],
			underweight: ["Government Controlled Commodities", "Real Estate"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "7.0% FY26",
			rbiRateStance: "Pro-growth",
			tenYearGsecOutlook: "6.75%",
			crudeImpact: "Manageable",
		},
		advisoryTipForPartners:
			"Position JM Flexicap and JM Midcap funds for high-beta aggressive clients seeking benchmark-crushing upside during economic expansions.",
		flagshipScheme: {
			name: "JM Flexicap Fund",
			category: "Equity",
			subCategory: "Flexi Cap Fund",
			benchmark: "BSE 500 TRI",
		},
	},
	{
		amcCode: "QUANTUM_MF",
		amcName: "Quantum Mutual Fund",
		shortName: "Quantum MF",
		tier: "alpha_boutique",
		rta: "In-house",
		aumBand: "₹3,800+ Cr",
		leadStrategist: "Chirag Mehta",
		strategistRole: "Chief Investment Officer, Quantum Asset Management",
		title: "Quantum MF Value Ethos: Integrity, Margin of Safety & Disciplined Cash Holdings",
		category: "asset_allocation",
		keyTakeaways: [
			"Pioneer of direct, low-cost mutual fund investing in India with uncompromising ethical governance screening.",
			"Strict valuation discipline: Will gladly hold 20-30% cash in equity funds if stocks become overvalued.",
			"12-20-80 Asset Allocation Rule: Recommending 12 months emergency cash, 20% in Gold/Liquid, and 80% diversified across Equities.",
		],
		sectorCalls: {
			overweight: ["Private Banks & NBFCs", "Domestic Consumption", "Healthcare"],
			neutral: ["Automobiles", "IT Services"],
			underweight: ["PSU Banks", "Speculative Cyclicals"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "6.8% FY26",
			rbiRateStance: "Neutral",
			tenYearGsecOutlook: "6.75%",
			crudeImpact: "Neutral",
		},
		advisoryTipForPartners:
			"Essential recommendation for conservative value purists who refuse to chase market fads and demand strict margin of safety.",
		flagshipScheme: {
			name: "Quantum Long Term Equity Value Fund",
			category: "Equity",
			subCategory: "Value Fund",
			benchmark: "S&P BSE 500 TRI",
		},
	},
	{
		amcCode: "TAURUS_MF",
		amcName: "Taurus Mutual Fund",
		shortName: "Taurus MF",
		tier: "alpha_boutique",
		rta: "KFintech",
		aumBand: "₹1,200+ Cr",
		leadStrategist: "Anand Shah",
		strategistRole: "Head of Equities, Taurus Asset Management",
		title: "Taurus MF Outlook: Cyclical Inflection Points & Domestic Capex Playbook",
		category: "thematic_call",
		keyTakeaways: [
			"Focus on domestic infrastructure expansion and banking sector consolidation.",
			"Ethical and Shariah-compliant fund strategies tailored for specific retail and institutional mandates.",
			"Select mid-cap industrial compounders offering attractive risk-adjusted entry multiples.",
		],
		sectorCalls: {
			overweight: ["Infrastructure", "Financial Services", "Pharma"],
			neutral: ["Information Technology", "Auto"],
			underweight: ["Commodity Metals", "Real Estate"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "6.8% FY26",
			rbiRateStance: "Neutral",
			tenYearGsecOutlook: "6.75%",
			crudeImpact: "Neutral",
		},
		advisoryTipForPartners:
			"Recommend Taurus Ethical Fund for clients seeking strict ethical / Shariah-screened equity investments.",
		flagshipScheme: {
			name: "Taurus Ethical Fund",
			category: "Equity",
			subCategory: "Thematic - Ethical",
			benchmark: "S&P BSE 500 Shariah TRI",
		},
	},
	{
		amcCode: "SHRIRAM_MF",
		amcName: "Shriram Mutual Fund",
		shortName: "Shriram MF",
		tier: "alpha_boutique",
		rta: "CAMS",
		aumBand: "₹1,800+ Cr",
		leadStrategist: "Deepak Ramaraju",
		strategistRole: "Senior Fund Manager, Shriram Asset Management",
		title: "Shriram MF Strategy: Enhanced Factor Quant Investing & Financial Inclusion",
		category: "equity_outlook",
		keyTakeaways: [
			"Backed by the Shriram Group, India's largest retail non-banking financial conglomerate.",
			"Factor investing models blending Value, Momentum, Quality, and Low Volatility factors.",
			"Financial inclusion and semi-urban retail empowerment anchoring long-term distribution growth.",
		],
		sectorCalls: {
			overweight: ["Financial Services", "Consumer Durables", "Capital Goods"],
			neutral: ["IT Services", "Healthcare"],
			underweight: ["Metals", "Real Estate"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "6.9% FY26",
			rbiRateStance: "Accommodative",
			tenYearGsecOutlook: "6.75%",
			crudeImpact: "Manageable",
		},
		advisoryTipForPartners:
			"Explore Shriram Multi Asset Allocation Fund for retail investors seeking rules-based dynamic factor rebalancing.",
		flagshipScheme: {
			name: "Shriram Multi Asset Allocation Fund",
			category: "Hybrid",
			subCategory: "Multi Asset Allocation",
			benchmark: "NIFTY 50 Hybrid Composite Debt 50:50 Index",
		},
	},
	{
		amcCode: "LIC_MF",
		amcName: "LIC Mutual Fund",
		shortName: "LIC MF",
		tier: "established_pillar",
		rta: "KFintech",
		aumBand: "₹38,000+ Cr",
		leadStrategist: "Yogesh Patil",
		strategistRole: "Chief Investment Officer - Equities, LIC Mutual Fund",
		title: "LIC MF National Vision: Sovereign Stability & PSU Value Re-Rating",
		category: "macro_strategy",
		keyTakeaways: [
			"Integration of IDBI Mutual Fund expanded scheme suite across index, debt, and equity strategies.",
			"Public Sector Undertakings (PSUs) experiencing historic balance sheet transformation and dividend stability.",
			"Conservative risk management backed by Life Insurance Corporation of India's long-term fiduciary ethos.",
		],
		sectorCalls: {
			overweight: ["PSU Banks & Energy", "Defense Manufacturing", "Power Infrastructure"],
			neutral: ["Information Technology", "Automobiles"],
			underweight: ["High-Beta Story Tech", "Speculative Real Estate"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "6.9% FY26",
			rbiRateStance: "Neutral",
			tenYearGsecOutlook: "6.75%",
			crudeImpact: "Manageable",
		},
		advisoryTipForPartners:
			"Ideal for conservative retail and semi-urban clients seeking trusted PSU stability and dividend yield focus.",
		flagshipScheme: {
			name: "LIC MF Large Cap Fund",
			category: "Equity",
			subCategory: "Large Cap Fund",
			benchmark: "NIFTY 100 TRI",
		},
	},
	{
		amcCode: "BOI_MF",
		amcName: "Bank of India Mutual Fund",
		shortName: "Bank of India MF",
		tier: "established_pillar",
		rta: "KFintech",
		aumBand: "₹12,500+ Cr",
		leadStrategist: "Alok Singh",
		strategistRole: "Chief Investment Officer, Bank of India Investment Managers",
		title: "Bank of India MF View: Small & Mid-Cap Alpha in Manufacturing Revival",
		category: "equity_outlook",
		keyTakeaways: [
			"100% subsidiary of Bank of India, delivering focused asset management across equity and fixed income.",
			"Strong track record in small-cap and mid-cap equity alpha through thorough on-the-ground research.",
			"Corporate balance sheets and bank credit cycles poised to support double-digit earnings growth.",
		],
		sectorCalls: {
			overweight: ["Capital Goods", "Private Banks", "Chemicals"],
			neutral: ["Consumer Staples", "IT"],
			underweight: ["Commodity Metals", "Real Estate"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "6.8% FY26",
			rbiRateStance: "Accommodative",
			tenYearGsecOutlook: "6.75%",
			crudeImpact: "Manageable",
		},
		advisoryTipForPartners:
			"Consider Bank of India Small Cap Fund for aggressive alpha seekers looking for under-the-radar industrial champions.",
		flagshipScheme: {
			name: "Bank of India Small Cap Fund",
			category: "Equity",
			subCategory: "Small Cap Fund",
			benchmark: "NIFTY Smallcap 250 TRI",
		},
	},
	{
		amcCode: "360_ONE_MF",
		amcName: "360 ONE Mutual Fund",
		shortName: "360 ONE (IIFL)",
		tier: "alpha_boutique",
		rta: "CAMS",
		aumBand: "₹16,400+ Cr",
		leadStrategist: "Mayur Patel",
		strategistRole: "Fund Manager - Equities, 360 ONE Asset Management",
		title: "360 ONE High-Conviction Thesis: Secular Growth Compounders & Focused Alpha",
		category: "thematic_call",
		keyTakeaways: [
			"Formerly IIFL Mutual Fund, known for disciplined, highly concentrated high-conviction equity portfolios (typically 25-30 stocks).",
			"Specialized focus on high-quality companies with sustained competitive moats, pricing power, and superior ROCE.",
			"Pioneered early focused equity strategies that outperformed broad benchmarks across market cycles.",
		],
		sectorCalls: {
			overweight: ["Financial Services", "Consumer Discretionary", "Healthcare"],
			neutral: ["Information Technology", "Automobiles"],
			underweight: ["Commodity Cyclicals", "Capital-Intensive Utilities"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "6.9% FY26",
			rbiRateStance: "Neutral",
			tenYearGsecOutlook: "6.75%",
			crudeImpact: "Neutral",
		},
		advisoryTipForPartners:
			"Recommend 360 ONE Focused Equity Fund for affluent clients who want concentrated active equity bets without index-hugging dilution.",
		flagshipScheme: {
			name: "360 ONE Focused Equity Fund",
			category: "Equity",
			subCategory: "Focused Fund",
			benchmark: "S&P BSE 500 TRI",
		},
	},

	// ─── 4. FINTECH, PASSIVE & NEW-AGE ASSET MANAGERS ─────────────────────────
	{
		amcCode: "ZERODHA_MF",
		amcName: "Zerodha Fund House",
		shortName: "Zerodha",
		tier: "fintech_passive",
		rta: "CAMS",
		aumBand: "₹6,800+ Cr (100% Passive)",
		leadStrategist: "Vishal Jain",
		strategistRole: "CEO & Head of Investments, Zerodha Fund House",
		title: "Zerodha Fund House Philosophy: Ultra Low-Cost Passives & Index Transparency",
		category: "macro_strategy",
		keyTakeaways: [
			"100% rules-based, passive-only fund house: Zero active manager bias, zero style drift, ultra-low expense ratios.",
			"Pioneered the LargeMidCap 250 Index Fund and ELSS Tax Saver passives in India.",
			"Democratizing simple, transparent indexing for digital-first retail and millennial investors.",
		],
		sectorCalls: {
			overweight: ["Rules-Based Broad Market Passives (Nifty LargeMidcap 250)", "Gold & Silver ETFs"],
			neutral: ["Broad Sector Indices"],
			underweight: ["Expensive High-TER Active Funds"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "7.0% FY26",
			rbiRateStance: "Neutral",
			tenYearGsecOutlook: "6.75%",
			crudeImpact: "Neutral",
		},
		advisoryTipForPartners:
			"Ideal core allocation for cost-conscious clients who want pure market beta without paying high active management fees.",
		flagshipScheme: {
			name: "Zerodha Nifty LargeMidcap 250 Index Fund",
			category: "Equity",
			subCategory: "Index Fund",
			benchmark: "NIFTY LargeMidcap 250 TRI",
		},
	},
	{
		amcCode: "GROWW_MF",
		amcName: "Groww Mutual Fund",
		shortName: "Groww MF",
		tier: "fintech_passive",
		rta: "KFintech",
		aumBand: "₹5,400+ Cr",
		leadStrategist: "Varun Gupta",
		strategistRole: "CEO, Groww Asset Management",
		title: "Groww MF Digital Playbook: Simple, Tech-Driven Indexing & Systematic Investing",
		category: "macro_strategy",
		keyTakeaways: [
			"Acquisition of Indiabulls Mutual Fund transformed into a modern digital-first passive and rule-based fund manager.",
			"Deep integration with India's largest retail investment platform, driving millions of first-time SIP adopters.",
			"Focus on low-cost broad market indices, factor passives, and gold ETFs.",
		],
		sectorCalls: {
			overweight: ["Broad Market Indices (Nifty 500 / Nifty Non-Cyclical)", "Precious Metals"],
			neutral: ["Large Cap Indices"],
			underweight: ["Complex Derivative Structured Funds"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "7.0% FY26",
			rbiRateStance: "Neutral",
			tenYearGsecOutlook: "6.75%",
			crudeImpact: "Neutral",
		},
		advisoryTipForPartners:
			"Position Groww Nifty Non-Cyclical Consumer Index Fund for defensive, steady compounders looking for daily consumer essentials exposure.",
		flagshipScheme: {
			name: "Groww Nifty Total Market Index Fund",
			category: "Equity",
			subCategory: "Index Fund",
			benchmark: "NIFTY Total Market Index",
		},
	},
	{
		amcCode: "NAVI_MF",
		amcName: "Navi Mutual Fund",
		shortName: "Navi MF",
		tier: "fintech_passive",
		rta: "CAMS",
		aumBand: "₹6,200+ Cr (Passives & Global)",
		leadStrategist: "Sachin Bansal & Hari Shyamsunder",
		strategistRole: "Founder & Head of Mutual Funds, Navi Technologies",
		title: "Navi MF Vision: Disruptive Ultra-Low Expense Ratios & Global Tech Indexing",
		category: "macro_strategy",
		keyTakeaways: [
			"Disruptive cost architecture: Pioneered near-zero expense ratios (0.06% TER) on Indian and US index funds.",
			"Pioneered direct access to the US NASDAQ 100 Index Fund with the lowest total expense ratio in India.",
			"Committed to technology-first, automated execution with minimal tracking error.",
		],
		sectorCalls: {
			overweight: ["US Tech Megacaps (NASDAQ 100)", "Nifty 50 Broad Index", "Short-Duration Debt"],
			neutral: ["Midcap Indices"],
			underweight: ["Traditional High-Fee Active Funds"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "6.9% FY26",
			rbiRateStance: "Neutral",
			tenYearGsecOutlook: "6.75%",
			crudeImpact: "Neutral",
		},
		advisoryTipForPartners:
			"Recommend Navi US Total Stock Market and Navi NASDAQ 100 FoF to clients seeking ultra-low cost dollar asset diversification.",
		flagshipScheme: {
			name: "Navi NASDAQ 100 Fund of Fund",
			category: "Equity",
			subCategory: "Global / Index Feeder",
			benchmark: "NASDAQ 100 TRI (USD/INR)",
		},
	},
	{
		amcCode: "OLD_BRIDGE_MF",
		amcName: "Old Bridge Mutual Fund",
		shortName: "Old Bridge",
		tier: "alpha_boutique",
		rta: "KFintech",
		aumBand: "₹2,800+ Cr",
		leadStrategist: "Kenneth Andrade",
		strategistRole: "Founder & Chief Investment Officer, Old Bridge Asset Management",
		title: "Old Bridge Capital View: Capital Allocation, Low Leverage & Supply-Side Cycles",
		category: "equity_outlook",
		keyTakeaways: [
			"Led by veteran fund manager Kenneth Andrade (renowned for multi-decade compounding at IDFC MF).",
			"Supply-side investing ethos: Focusing on capital-efficient businesses emerging from industry consolidation.",
			"Strict discipline against overpaying: Investing when company capacity utilization is cyclically low but poised for multi-year cash generation.",
		],
		sectorCalls: {
			overweight: ["Manufacturing & Industrials", "Specialty Materials", "Corporate Lending"],
			neutral: ["Information Technology", "Consumer Staples"],
			underweight: ["Overhyped Consumer Tech", "Expensive Pre-Profit Plays"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "7.0% FY26",
			rbiRateStance: "Pro-growth",
			tenYearGsecOutlook: "6.75%",
			crudeImpact: "Manageable",
		},
		advisoryTipForPartners:
			"High-conviction recommendation for long-term investors (>5-7 years) who value authentic supply-side capital allocation discipline.",
		flagshipScheme: {
			name: "Old Bridge Focused Equity Fund",
			category: "Equity",
			subCategory: "Focused Fund",
			benchmark: "S&P BSE 500 TRI",
		},
	},
	{
		amcCode: "HELIOS_MF",
		amcName: "Helios Mutual Fund",
		shortName: "Helios MF",
		tier: "alpha_boutique",
		rta: "CAMS",
		aumBand: "₹3,400+ Cr",
		leadStrategist: "Samir Arora",
		strategistRole: "Founder & Fund Manager, Helios Capital",
		title: "Helios Capital Playbook: Elimination-First Investing & High-Conviction Compounders",
		category: "equity_outlook",
		keyTakeaways: [
			"Founded by pioneer fund manager Samir Arora, bringing 25+ years of offshore hedge fund track record into Indian retail mutual funds.",
			"Elimination-first strategy: Eliminating corporate governance laggards, debt-traps, and weak capital allocators before selecting portfolio champions.",
			"Flexi-cap framework actively capturing large, mid, and small cap growth opportunities.",
		],
		sectorCalls: {
			overweight: ["Private Financials", "Consumer Discretionary", "Tech & Digitization"],
			neutral: ["Healthcare", "Automobiles"],
			underweight: ["State-Run Utilities", "Commodity Cyclicals"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "7.0% FY26",
			rbiRateStance: "Neutral",
			tenYearGsecOutlook: "6.75%",
			crudeImpact: "Neutral",
		},
		advisoryTipForPartners:
			"Position Helios Flexi Cap Fund for investors who appreciate active, agile stock selection backed by proven global hedge fund discipline.",
		flagshipScheme: {
			name: "Helios Flexi Cap Fund",
			category: "Equity",
			subCategory: "Flexi Cap Fund",
			benchmark: "NIFTY 500 TRI",
		},
	},
	{
		amcCode: "BAJAJ_FINSERV_MF",
		amcName: "Bajaj Finserv Mutual Fund",
		shortName: "Bajaj Finserv",
		tier: "established_pillar",
		rta: "KFintech",
		aumBand: "₹18,500+ Cr",
		leadStrategist: "Nimesh Chandan",
		strategistRole: "Chief Investment Officer, Bajaj Finserv AMC",
		title: "Bajaj Finserv INQUBE Model: Behavioral Finance & Informational Edge",
		category: "equity_outlook",
		keyTakeaways: [
			"Proprietary INQUBE philosophy: Combines Informational edge, Quantitative models, and Behavioral finance discipline.",
			"Combats behavioral biases (greed at peaks, panic at bottoms) through systematic quantitative models.",
			"Rapid growth across Flexi Cap, Balanced Advantage, and Arbitrage categories.",
		],
		sectorCalls: {
			overweight: ["Banking & Financial Services", "Consumer Discretionary", "Healthcare"],
			neutral: ["Information Technology", "Industrials"],
			underweight: ["Commodity Cyclicals", "Metals"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "6.9% FY26",
			rbiRateStance: "Accommodative",
			tenYearGsecOutlook: "6.75%",
			crudeImpact: "Manageable",
		},
		advisoryTipForPartners:
			"Recommend Bajaj Finserv Flexi Cap Fund to clients seeking modern behavioral-finance-driven equity management.",
		flagshipScheme: {
			name: "Bajaj Finserv Flexi Cap Fund",
			category: "Equity",
			subCategory: "Flexi Cap Fund",
			benchmark: "S&P BSE 500 TRI",
		},
	},
	{
		amcCode: "NJ_MF",
		amcName: "NJ Mutual Fund",
		shortName: "NJ MF",
		tier: "fintech_passive",
		rta: "KFintech",
		aumBand: "₹6,800+ Cr (Rule-Based)",
		leadStrategist: "Rajiv Shastri",
		strategistRole: "Director & CEO, NJ Asset Management",
		title: "NJ MF Rule-Based Quantitative Factor Architecture: Emotion-Free Investing",
		category: "asset_allocation",
		keyTakeaways: [
			"Sponsored by NJ India Invest, India's largest mutual fund distribution network.",
			"100% rule-based and factor-driven investment process: Pure quantitative mathematical models with zero emotional interference.",
			"Pioneered Multi-Factor and Dynamic Asset Allocation funds driven strictly by macro data points.",
		],
		sectorCalls: {
			overweight: ["Quantitative Factor Model Leaders (High Momentum + Low Volatility)"],
			neutral: ["Broad Index Beta"],
			underweight: ["Subjective Discretionary Stock Picks"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "6.9% FY26",
			rbiRateStance: "Neutral",
			tenYearGsecOutlook: "6.75%",
			crudeImpact: "Neutral",
		},
		advisoryTipForPartners:
			"Ideal for partners looking for strictly algorithmic, rules-based factor allocation funds without human manager ego.",
		flagshipScheme: {
			name: "NJ Balanced Advantage Fund",
			category: "Hybrid",
			subCategory: "Dynamic Asset Allocation",
			benchmark: "NIFTY 50 Hybrid Composite Debt 50:50 Index",
		},
	},
	{
		amcCode: "CAPITALMIND_MF",
		amcName: "Capitalmind Mutual Fund",
		shortName: "Capitalmind",
		tier: "fintech_passive",
		rta: "CAMS",
		aumBand: "₹1,200+ Cr (Fintech / Factor)",
		leadStrategist: "Deepak Shenoy",
		strategistRole: "Founder & Chief Executive, Capitalmind Financial Services",
		title: "Capitalmind Quantitative Edge: Momentum Factor Alpha & Systematic Rebalancing",
		category: "thematic_call",
		keyTakeaways: [
			"Fintech innovator transitioning from SEBI PMS to Mutual Fund with a loyal digital community.",
			"Systematic quantitative momentum: Cutting losers ruthlessly and letting winning compounders run.",
			"Pioneers in transparent research, factor indexation, and data-driven risk management.",
		],
		sectorCalls: {
			overweight: ["Momentum Factor Outperformers", "High Relative Strength Sectors"],
			neutral: ["Market Beta"],
			underweight: ["Lagging Factor Underperformers"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "7.0% FY26",
			rbiRateStance: "Neutral",
			tenYearGsecOutlook: "6.75%",
			crudeImpact: "Neutral",
		},
		advisoryTipForPartners:
			"High-interest fund for modern, tech-savvy clients looking for rigorous quantitative factor investing and momentum strategies.",
		flagshipScheme: {
			name: "Capitalmind Momentum Factor Fund",
			category: "Equity",
			subCategory: "Factor Index / Thematic",
			benchmark: "Nifty200 Momentum 30 TRI",
		},
	},
	{
		amcCode: "UNIFI_MF",
		amcName: "Unifi Mutual Fund",
		shortName: "Unifi Capital",
		tier: "alpha_boutique",
		rta: "KFintech",
		aumBand: "₹2,500+ Cr",
		leadStrategist: "K Saravanan",
		strategistRole: "Chief Investment Officer, Unifi Capital",
		title: "Unifi Capital Niche Discovery: Corporate Spin-Offs, Consolidators & Deep Value",
		category: "thematic_call",
		keyTakeaways: [
			"Specialized niche investment house expanding from award-winning PMS/AIF into retail mutual funds.",
			"Event-driven themes: Corporate spin-offs, demergers, deep value restructuring, and green shoots.",
			"High margin of safety with deep forensic accounting and management integrity checks.",
		],
		sectorCalls: {
			overweight: ["Corporate Demergers & Spin-Offs", "Specialized Manufacturing", "Private NBFCs"],
			neutral: ["IT Services", "Pharma"],
			underweight: ["Commodities", "Government Utilities"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "6.9% FY26",
			rbiRateStance: "Neutral",
			tenYearGsecOutlook: "6.75%",
			crudeImpact: "Neutral",
		},
		advisoryTipForPartners:
			"Differentiated thematic allocation for sophisticated investors looking for corporate restructuring and demerger alpha.",
		flagshipScheme: {
			name: "Unifi High-Yield Equity Fund",
			category: "Equity",
			subCategory: "Flexi Cap Fund",
			benchmark: "S&P BSE 500 TRI",
		},
	},
	{
		amcCode: "JIO_BLACKROCK_MF",
		amcName: "Jio BlackRock Mutual Fund",
		shortName: "Jio BlackRock",
		tier: "fintech_passive",
		rta: "KFintech",
		aumBand: "Digital Enterprise / In-Launch",
		leadStrategist: "Rachel Lord & Jio Financial Leadership",
		strategistRole: "Joint Leadership, Jio BlackRock Asset Management",
		title: "Jio BlackRock Joint Venture: Aladdin Tech Analytics & Affordable Digital Scale",
		category: "macro_strategy",
		keyTakeaways: [
			"Joint venture between Jio Financial Services (50%) and BlackRock (50%), the world's largest asset manager ($10+ Trillion AUM).",
			"Deploying BlackRock's industry-standard Aladdin risk management platform to Indian retail investors at unprecedented low cost.",
			"Transformative digital distribution across Jio's 450+ million user telecom and payments ecosystem.",
		],
		sectorCalls: {
			overweight: ["Low-Cost Index & Digital Factor ETFs", "Broad Market Beta", "Digital Asset Class Solutions"],
			neutral: ["Sector Baskets"],
			underweight: ["High-Commission Legacy Products"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "7.2% FY26",
			rbiRateStance: "Pro-growth & digital inclusion",
			tenYearGsecOutlook: "6.70% - 6.75%",
			crudeImpact: "Neutral",
		},
		advisoryTipForPartners:
			"Prepare client portfolios for the entry of Jio BlackRock's hyper-affordable passive and rule-based digital offerings.",
		flagshipScheme: {
			name: "Jio BlackRock Digital Nifty 50 Index Fund",
			category: "Equity",
			subCategory: "Index Fund",
			benchmark: "NIFTY 50 TRI",
		},
	},

	// ─── 5. GIFT CITY (IFSC) CROSS-BORDER & OFFSHORE ENTITIES ────────────────
	{
		amcCode: "GIFT_HDFC_IFSC",
		amcName: "HDFC AMC International (IFSC)",
		shortName: "HDFC IFSC",
		tier: "gift_city_ifsc",
		rta: "IFSCA",
		aumBand: "GIFT City USD Funds",
		leadStrategist: "Rahul Baijal",
		strategistRole: "Head - International & IFSC Desks, HDFC AMC",
		title: "HDFC International (IFSC): Global AI, Semiconductors & USD Wealth Compounding",
		category: "thematic_call",
		keyTakeaways: [
			"Regulated under IFSCA (Fund Management) Regulations, 2022 in GIFT City, Gandhinagar.",
			"Direct USD feeder funds investing in global technology innovators (NVIDIA, TSMC, Broadcom, ASML).",
			"Indian resident investors deploy via RBI's $250,000 LRS route with zero GST and zero capital gains tax in GIFT City.",
		],
		sectorCalls: {
			overweight: ["AI Accelerators & Semiconductors", "Global Hyperscalers", "US Cloud Platforms"],
			neutral: ["Global Consumer Goods"],
			underweight: ["Emerging Market FX Volatility"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "US GDP: 2.2% | India: 6.8%",
			rbiRateStance: "US Fed Rate Easing Cycle",
			tenYearGsecOutlook: "US 10Y Treasury: 4.10% - 4.25%",
			crudeImpact: "Subdued USD energy prices support tech margins.",
		},
		advisoryTipForPartners:
			"Essential recommendation for HNI clients and family offices seeking USD asset accumulation and hedge against rupee depreciation.",
		flagshipScheme: {
			name: "HDFC International Global Semiconductor & AI Fund",
			category: "GIFT City (IFSC)",
			subCategory: "Global Feeder / Outbound Fund",
			benchmark: "NYSE Semiconductor Index (USD)",
		},
	},
	{
		amcCode: "GIFT_KOTAK_IFSC",
		amcName: "Kotak Mahindra Asset Management (IFSC)",
		shortName: "Kotak IFSC",
		tier: "gift_city_ifsc",
		rta: "IFSCA",
		aumBand: "GIFT City Inbound & AIF",
		leadStrategist: "Nilesh Shah & Devender Singhal",
		strategistRole: "Managing Director & Head - Offshore Investments, Kotak AMC",
		title: "Kotak GIFT City IFSC Inbound Thesis: Tax-Free Indian Equities for Global FPIs",
		category: "equity_outlook",
		keyTakeaways: [
			"Inbound Category III AIFs in GIFT City allowing foreign family offices and NRIs to invest into Indian equities tax-free.",
			"Section 47(viiab) of Indian Income Tax Act grants 0% capital gains tax for non-resident investors on securities traded in IFSC.",
			"Currency hedged USD tranches protecting foreign capital against emerging market currency drawdowns.",
		],
		sectorCalls: {
			overweight: ["Indian Private Banks", "Infrastructure & Defense", "Capital Goods"],
			neutral: ["Information Technology"],
			underweight: ["Commodity Metals"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "India Real GDP: 7.0%",
			rbiRateStance: "Neutral with growth support",
			tenYearGsecOutlook: "Sovereign clearing at 6.75%",
			crudeImpact: "Manageable",
		},
		advisoryTipForPartners:
			"Unrivaled tax-efficient gateway for NRI clients in Dubai, Singapore, the US, and UK to invest back into India.",
		flagshipScheme: {
			name: "Kotak India Inbound Opportunities Fund (IFSC Cat III AIF)",
			category: "GIFT City (IFSC)",
			subCategory: "Inbound FPI / Category III AIF",
			benchmark: "NIFTY 500 TRI (USD Hedged)",
		},
	},
	{
		amcCode: "GIFT_SBI_IFSC",
		amcName: "SBI Funds Management (IFSC)",
		shortName: "SBI IFSC",
		tier: "gift_city_ifsc",
		rta: "IFSCA",
		aumBand: "GIFT City Sovereign USD",
		leadStrategist: "D P Singh (Offshore Board)",
		strategistRole: "Director - Offshore Operations, SBI Funds Management",
		title: "SBI Funds IFSC Sovereign Desk: Dollar-Hedged Indian G-Secs & Global NRI Wealth",
		category: "debt_outlook",
		keyTakeaways: [
			"Offshore sovereign bond vehicles pooling dollar capital into Fully Accessible Route (FAR) Indian Government Securities.",
			"Offers global investors superior risk-adjusted real yields compared to developed market sovereign debt.",
			"Comprehensive digital onboarding for NRI investors across the GCC, Europe, and North America.",
		],
		sectorCalls: {
			overweight: ["Sovereign G-Secs (FAR Route)", "AAA PSU Debt (USD Hedged)"],
			neutral: ["Treasury Bills"],
			underweight: ["Unrated Emerging Market Sovereign Papers"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "India GDP: 7.0%",
			rbiRateStance: "Accommodative policy stance",
			tenYearGsecOutlook: "CCIL Sovereign clearing: 6.75%",
			crudeImpact: "Neutral",
		},
		advisoryTipForPartners:
			"Recommend SBI's IFSC sovereign bond strategies to non-resident clients seeking safe, sovereign-backed dollar yields.",
		flagshipScheme: {
			name: "SBI Global Indian Sovereign Bond Fund (IFSC)",
			category: "GIFT City (IFSC)",
			subCategory: "Offshore Sovereign Debt",
			benchmark: "CCIL Sovereign G-Sec Composite (USD Hedged)",
		},
	},
	{
		amcCode: "GIFT_MIRAE_IFSC",
		amcName: "Mirae Asset Global Investments (IFSC)",
		shortName: "Mirae IFSC",
		tier: "gift_city_ifsc",
		rta: "IFSCA",
		aumBand: "GIFT City Cross-Border",
		leadStrategist: "Swarup Mohanty",
		strategistRole: "Vice Chairman & CEO, Mirae Asset Global Investments (India)",
		title: "Mirae Asset IFSC: Asian Megatrends, Electric Vehicles & Cross-Border Outbound FoFs",
		category: "thematic_call",
		keyTakeaways: [
			"Leveraging Mirae Asset's $220+ Billion global investment platform spanning Seoul, New York, Hong Kong, and Gandhinagar.",
			"Cross-border thematic funds targeting electric mobility, battery technology, and global semiconductor clusters.",
			"Seamless LRS processing for resident Indian HNIs seeking true global multi-currency allocation.",
		],
		sectorCalls: {
			overweight: ["Electric Mobility & Batteries", "Global Semiconductor Foundries", "Asian Tech Champions"],
			neutral: ["Traditional Auto"],
			underweight: ["Legacy Fossil Fuels"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "Global GDP: 2.8%",
			rbiRateStance: "Neutral",
			tenYearGsecOutlook: "US 10Y: 4.15%",
			crudeImpact: "Energy transition accelerating.",
		},
		advisoryTipForPartners:
			"Position Mirae IFSC's thematic global funds for progressive clients wanting exposure to next-generation clean tech and AI hardware.",
		flagshipScheme: {
			name: "Mirae Asset Global Electric & Autonomous Fund (IFSC)",
			category: "GIFT City (IFSC)",
			subCategory: "Global Thematic Feeder",
			benchmark: "Solactive Autonomous & EV Index (USD)",
		},
	},
	{
		amcCode: "GIFT_NIPPON_IFSC",
		amcName: "Nippon Life India Asset Management (IFSC)",
		shortName: "Nippon IFSC",
		tier: "gift_city_ifsc",
		rta: "IFSCA",
		aumBand: "GIFT City Indo-Japan Desk",
		leadStrategist: "Sundeep Sikka",
		strategistRole: "ED & CEO, Nippon Life India Asset Management",
		title: "Nippon Life IFSC: The Indo-Japan Strategic Corridor & Global Institutional Capital",
		category: "macro_strategy",
		keyTakeaways: [
			"Strategic alignment with Nippon Life of Japan, one of the world's largest institutional life insurers ($700B+ assets).",
			"Channeling long-term Japanese institutional and retail pension capital into Indian manufacturing and infrastructure.",
			"GIFT City IFSC platform offering bilateral investment vehicles between Tokyo and Gandhinagar.",
		],
		sectorCalls: {
			overweight: ["Indian Manufacturing & PLI Champions", "Power Transmission", "Private Banks"],
			neutral: ["Information Technology"],
			underweight: ["Commodity Metals"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "India GDP: 6.9%",
			rbiRateStance: "Accommodative",
			tenYearGsecOutlook: "6.75%",
			crudeImpact: "Neutral",
		},
		advisoryTipForPartners:
			"Highlight Nippon's Indo-Japan institutional corridor when pitching to institutional investors and foreign corporate clients.",
		flagshipScheme: {
			name: "Nippon India Global Indo-Japan Fund (IFSC)",
			category: "GIFT City (IFSC)",
			subCategory: "Cross-Border Feeder",
			benchmark: "NIFTY 500 TRI (USD)",
		},
	},
	{
		amcCode: "GIFT_ICICI_IFSC",
		amcName: "ICICI Prudential AMC (IFSC)",
		shortName: "ICICI Pru IFSC",
		tier: "gift_city_ifsc",
		rta: "IFSCA",
		aumBand: "GIFT City Offshore",
		leadStrategist: "Nimesh Shah",
		strategistRole: "MD & CEO, ICICI Prudential AMC",
		title: "ICICI Prudential IFSC: Bespoke Global Multi-Asset & NRI Wealth Preservation",
		category: "asset_allocation",
		keyTakeaways: [
			"ICICI Group's international offshore wealth management flagship operating out of GIFT City IFSC.",
			"Multi-asset global portfolios blending US Treasuries, Gold, Indian Equities, and Global tech in a single USD structure.",
			"Tailored succession, estate planning, and tax-exempt offshore trusts for global Indian diaspora.",
		],
		sectorCalls: {
			overweight: ["Global Sovereign Debt", "Indian Bluechips", "Precious Metals"],
			neutral: ["European Equities"],
			underweight: ["High-Yield Junk Debt"],
		},
		macroIndicators: {
			gdpGrowthEstimate: "Global GDP: 2.6%",
			rbiRateStance: "Neutral",
			tenYearGsecOutlook: "US 10Y: 4.15%",
			crudeImpact: "Supportive",
		},
		advisoryTipForPartners:
			"The premier vehicle for NRI estate planning and global multi-asset capital preservation.",
		flagshipScheme: {
			name: "ICICI Prudential Global Multi-Asset Allocation Fund (IFSC)",
			category: "GIFT City (IFSC)",
			subCategory: "Global Multi-Asset",
			benchmark: "Global Balanced Composite (USD)",
		},
	},
];

/**
 * Returns all 52 registered AMCs, with optional filtering by tier or search query
 */
export function getAmcDirectory(filters: {
	tier?: string;
	search?: string;
} = {}): AmcMasterRecord[] {
	let results = [...ALL_52_AMCS];

	if (filters.tier && filters.tier !== "all") {
		results = results.filter((amc) => amc.tier === filters.tier);
	}

	if (filters.search && filters.search.trim().length > 0) {
		const q = filters.search.toLowerCase().trim();
		results = results.filter(
			(amc) =>
				amc.amcName.toLowerCase().includes(q) ||
				amc.shortName.toLowerCase().includes(q) ||
				amc.leadStrategist.toLowerCase().includes(q) ||
				amc.title.toLowerCase().includes(q) ||
				amc.rta.toLowerCase().includes(q) ||
				amc.aumBand.toLowerCase().includes(q),
		);
	}

	return results;
}

/**
 * Lookup an individual AMC profile by its normalized code
 */
export function getAmcProfileByCode(amcCode: string): AmcMasterRecord | undefined {
	return ALL_52_AMCS.find((a) => a.amcCode.toUpperCase() === amcCode.toUpperCase());
}

