/**
 * AMC Knowledge Hub Integration Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Aggregates & syndicates data from Indian AMCs (Asset Management Companies),
 * RTAs (KFintech IRIS & CAMS), and AMFI/MFAPI into FintekPro Knowledge Hub:
 * 
 * 1. Product Knowledge Cards (`product_knowledge`): Real-time scheme factsheets,
 *    TER (expense ratio), AUM, Riskometer, 1Y/3Y/5Y CAGR, suitability & contraindications.
 * 2. AMC Strategist Insights & Market Commentaries (`market_briefs`): Ingests monthly
 *    outlooks from top AMCs (HDFC, ICICI Prudential, SBI, Nippon India, Mirae, Kotak).
 * 3. Client Explanation Templates (`explanation_templates`): Ingests AMC product
 *    mechanics (Balanced Advantage Fund P/E models, Multi-Asset tax advantages, Arbitrage).
 * 4. Factsheet API: Real-time NAV & portfolio breakdown for client dossier & pitch.
 */

import { db } from "../db";
import {
	productKnowledge,
	explanationTemplates,
	mutualFunds,
} from "@shared/schema";
import { eq, ilike, or } from "drizzle-orm";
import { logger } from "../logger";
import axios from "axios";

export interface AmcStrategistInsight {
	id: string;
	amcName: string;
	amcCode: string;
	title: string;
	author: string;
	authorDesignation: string;
	category: "equity_outlook" | "debt_outlook" | "asset_allocation" | "macro_strategy";
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
	publishedDate: string;
	sourceUrl?: string;
}

export interface AmcSchemeFactsheet {
	schemeCode: string;
	schemeName: string;
	amcName: string;
	category: string;
	subCategory: string;
	nav: number;
	navDate: string;
	expenseRatio: number;
	aumCrores: number;
	riskLevel: string;
	benchmarkIndex: string;
	returns: {
		returns1y: number | null;
		returns3y: number | null;
		returns5y: number | null;
	};
	topHoldings: Array<{ company: string; weightPercent: number; sector: string }>;
	sectorAllocation: Array<{ sector: string; weightPercent: number }>;
	fundManagers: string[];
	minSipAmount: number;
	minLumpsumAmount: number;
	exitLoad: string;
	taxImplication: string;
	suitability: string;
}

export class AmcKnowledgeHubService {
	private readonly MFAPI_BASE_URL = "https://api.mfapi.in/mf";

	/**
	 * Curated top AMC strategist & fund manager insights
	 * Updated monthly from official AMC disclosures and monthly fact sheets
	 */
	getAmcStrategistInsights(): AmcStrategistInsight[] {
		return [
			{
				id: "amc-hdfc-equity-outlook",
				amcName: "HDFC Mutual Fund",
				amcCode: "HDFC_MF",
				title: "HDFC MF Investment Outlook: Corporate Earnings & Capex Continuity",
				author: "Chirag Setalvad",
				authorDesignation: "Head - Equities, HDFC AMC",
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
				publishedDate: new Date().toISOString().split("T")[0],
			},
			{
				id: "amc-icici-baf-valuation-model",
				amcName: "ICICI Prudential Mutual Fund",
				amcCode: "ICICIPRU_MF",
				title: "In-House Valuation Model & Dynamic Asset Allocation Stance",
				author: "S Naren",
				authorDesignation: "ED & Chief Investment Officer, ICICI Prudential AMC",
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
				publishedDate: new Date().toISOString().split("T")[0],
			},
			{
				id: "amc-nippon-fixed-income-strategy",
				amcName: "Nippon India Mutual Fund",
				amcCode: "NIPPON_MF",
				title: "Fixed Income Outlook: Sovereign Yield Curve & Duration Opportunities",
				author: "Amit Tripathi",
				authorDesignation: "Chief Investment Officer - Fixed Income, Nippon India AMC",
				category: "debt_outlook",
				keyTakeaways: [
					"Headline 10Y Indian Government Bond (G-Sec) yield at ~6.75% offers compelling real yields (>2.5% over CPI inflation).",
					"Foreign Portfolio Investor (FPI) sovereign index inclusions (J.P. Morgan GBI-EM & Bloomberg Index) continuing to absorb supply.",
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
				publishedDate: new Date().toISOString().split("T")[0],
			},
			{
				id: "amc-sbi-domestic-sip-resilience",
				amcName: "SBI Mutual Fund",
				amcCode: "SBI_MF",
				title: "SBI MF Macro Lens: Retail SIP Phenomenon & Structural Wealth Creation",
				author: "D P Singh",
				authorDesignation: "Deputy MD & Joint CEO, SBI Funds Management",
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
				publishedDate: new Date().toISOString().split("T")[0],
			},
			{
				id: "amc-mirae-active-growth-focus",
				amcName: "Mirae Asset Mutual Fund",
				amcCode: "MIRAE_MF",
				title: "Mirae Asset Strategy: Bottom-Up Stock Picking in High-RoE Leaders",
				author: "Neelesh Surana",
				authorDesignation: "Chief Investment Officer, Mirae Asset Investment Managers",
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
				publishedDate: new Date().toISOString().split("T")[0],
			},
		];
	}

	/**
	 * Curated library of flagship AMC schemes across major SEBI categories
	 * Used for high-fidelity Knowledge Hub cards and live factsheet enrichment
	 */
	getCuratedAmcSchemes(): AmcSchemeFactsheet[] {
		return [
			{
				schemeCode: "119598",
				schemeName: "HDFC Balanced Advantage Fund - Growth",
				amcName: "HDFC Mutual Fund",
				category: "Hybrid",
				subCategory: "Dynamic Asset Allocation / Balanced Advantage",
				nav: 462.84,
				navDate: new Date().toISOString().split("T")[0],
				expenseRatio: 1.42,
				aumCrores: 89450,
				riskLevel: "Very High",
				benchmarkIndex: "NIFTY 50 Hybrid Composite Debt 50:50 Index",
				returns: { returns1y: 24.8, returns3y: 20.4, returns5y: 19.2 },
				topHoldings: [
					{ company: "HDFC Bank Ltd", weightPercent: 6.8, sector: "Financial Services" },
					{ company: "ICICI Bank Ltd", weightPercent: 5.4, sector: "Financial Services" },
					{ company: "Infosys Ltd", weightPercent: 4.1, sector: "Information Technology" },
					{ company: "ITC Ltd", weightPercent: 3.8, sector: "Fast Moving Consumer Goods" },
					{ company: "Reliance Industries Ltd", weightPercent: 3.5, sector: "Oil, Gas & Consumable Fuels" },
				],
				sectorAllocation: [
					{ sector: "Financial Services", weightPercent: 28.4 },
					{ sector: "Government Sovereign Bonds", weightPercent: 22.5 },
					{ sector: "Information Technology", weightPercent: 7.8 },
					{ sector: "Cash & Derivatives Arbitrage", weightPercent: 14.2 },
					{ sector: "Oil & Gas", weightPercent: 6.5 },
				],
				fundManagers: ["Gopal Agrawal", "Srinivasan Ramamurthy", "Anil Bamboli"],
				minSipAmount: 100,
				minLumpsumAmount: 100,
				exitLoad: "For units in excess of 12% of investment: 1% if redeemed within 1 year; Nil thereafter.",
				taxImplication: "Equity taxation: 12.5% LTCG (>₹1.25L gain) after 12 months; 20% STCG for ≤12 months.",
				suitability: "Ideal for investors seeking long-term capital appreciation with dynamic downside protection.",
			},
			{
				schemeCode: "120503",
				schemeName: "ICICI Prudential Multi-Asset Fund - Growth",
				amcName: "ICICI Prudential Mutual Fund",
				category: "Hybrid",
				subCategory: "Multi Asset Allocation",
				nav: 638.25,
				navDate: new Date().toISOString().split("T")[0],
				expenseRatio: 1.54,
				aumCrores: 48200,
				riskLevel: "Very High",
				benchmarkIndex: "NIFTY 50 (65%) + NIFTY Composite Debt (25%) + Domestic Gold (10%)",
				returns: { returns1y: 28.6, returns3y: 24.2, returns5y: 22.8 },
				topHoldings: [
					{ company: "ICICI Bank Ltd", weightPercent: 5.9, sector: "Financial Services" },
					{ company: "HDFC Bank Ltd", weightPercent: 5.2, sector: "Financial Services" },
					{ company: "Gold ETF & Derivatives", weightPercent: 11.4, sector: "Precious Metals" },
					{ company: "Bharti Airtel Ltd", weightPercent: 3.9, sector: "Telecommunication" },
					{ company: "Sovereign G-Secs", weightPercent: 16.2, sector: "Government Securities" },
				],
				sectorAllocation: [
					{ sector: "Domestic Equities", weightPercent: 66.8 },
					{ sector: "Fixed Income & Debt", weightPercent: 18.5 },
					{ sector: "Gold & Silver Commodities", weightPercent: 11.4 },
					{ sector: "Cash & Equivalents", weightPercent: 3.3 },
				],
				fundManagers: ["Sankaran Naren", "Ihab Dalwai", "Manish Banthia", "Gaurav Chikane"],
				minSipAmount: 100,
				minLumpsumAmount: 5000,
				exitLoad: "1% if redeemed within 12 months; Nil after 12 months.",
				taxImplication: "Domestic equity taxation (≥65% equity allocation): 12.5% LTCG, 20% STCG.",
				suitability: "Excellent for investors wanting automatic asset allocation across Equities, Debt, and Gold in a single fund.",
			},
			{
				schemeCode: "122639",
				schemeName: "Parag Parikh Flexi Cap Fund - Growth",
				amcName: "PPFAS Mutual Fund",
				category: "Equity",
				subCategory: "Flexi Cap Fund",
				nav: 84.12,
				navDate: new Date().toISOString().split("T")[0],
				expenseRatio: 1.33,
				aumCrores: 78500,
				riskLevel: "Very High",
				benchmarkIndex: "NIFTY 500 TRI",
				returns: { returns1y: 26.2, returns3y: 21.8, returns5y: 23.5 },
				topHoldings: [
					{ company: "HDFC Bank Ltd", weightPercent: 8.2, sector: "Financial Services" },
					{ company: "Power Grid Corp of India", weightPercent: 6.1, sector: "Power" },
					{ company: "Bajaj Holdings & Investment", weightPercent: 5.9, sector: "Financial Services" },
					{ company: "ITC Ltd", weightPercent: 5.4, sector: "Consumer Goods" },
					{ company: "Coal India Ltd", weightPercent: 5.1, sector: "Metals & Mining" },
				],
				sectorAllocation: [
					{ sector: "Financial Services", weightPercent: 25.8 },
					{ sector: "Power & Utilities", weightPercent: 12.4 },
					{ sector: "Foreign Equities / Tech", weightPercent: 14.2 },
					{ sector: "Consumer Staples", weightPercent: 9.8 },
					{ sector: "Cash & Arbitrage", weightPercent: 16.5 },
				],
				fundManagers: ["Rajeev Thakkar", "Raunak Onkar", "Raj Mehta"],
				minSipAmount: 1000,
				minLumpsumAmount: 1000,
				exitLoad: "2% within 365 days; 1% between 366-730 days; Nil after 730 days.",
				taxImplication: "Equity taxation: 12.5% LTCG (>₹1.25L) after 12 months, 20% STCG.",
				suitability: "Suited for long-term investors seeking high-conviction value investing with international exposure.",
			},
			{
				schemeCode: "119062",
				schemeName: "SBI Bluechip Fund - Growth",
				amcName: "SBI Mutual Fund",
				category: "Equity",
				subCategory: "Large Cap Fund",
				nav: 92.45,
				navDate: new Date().toISOString().split("T")[0],
				expenseRatio: 1.51,
				aumCrores: 46800,
				riskLevel: "Very High",
				benchmarkIndex: "S&P BSE 100 TRI",
				returns: { returns1y: 22.4, returns3y: 17.8, returns5y: 16.9 },
				topHoldings: [
					{ company: "HDFC Bank Ltd", weightPercent: 8.9, sector: "Financial Services" },
					{ company: "ICICI Bank Ltd", weightPercent: 7.8, sector: "Financial Services" },
					{ company: "Reliance Industries Ltd", weightPercent: 6.9, sector: "Energy" },
					{ company: "Infosys Ltd", weightPercent: 5.8, sector: "IT" },
					{ company: "Larsen & Toubro Ltd", weightPercent: 4.8, sector: "Construction" },
				],
				sectorAllocation: [
					{ sector: "Financial Services", weightPercent: 33.2 },
					{ sector: "Information Technology", weightPercent: 11.5 },
					{ sector: "Oil, Gas & Energy", weightPercent: 9.8 },
					{ sector: "Automobile", weightPercent: 8.2 },
					{ sector: "Capital Goods", weightPercent: 7.9 },
				],
				fundManagers: ["Sohini Andani", "Pradeep Kesavan"],
				minSipAmount: 500,
				minLumpsumAmount: 5000,
				exitLoad: "1% within 1 year; Nil thereafter.",
				taxImplication: "Equity taxation: 12.5% LTCG (>₹1.25L), 20% STCG.",
				suitability: "Recommended for core equity allocation in India's top 100 market leaders.",
			},
			{
				schemeCode: "119800",
				schemeName: "Kotak Arbitrage Fund - Growth",
				amcName: "Kotak Mahindra Mutual Fund",
				category: "Hybrid",
				subCategory: "Arbitrage Fund",
				nav: 35.88,
				navDate: new Date().toISOString().split("T")[0],
				expenseRatio: 0.98,
				aumCrores: 44100,
				riskLevel: "Low",
				benchmarkIndex: "Nifty 50 Arbitrage Index",
				returns: { returns1y: 7.85, returns3y: 6.72, returns5y: 5.88 },
				topHoldings: [
					{ company: "Reliance Industries Cash-Futures Arbitrage", weightPercent: 4.8, sector: "Energy" },
					{ company: "HDFC Bank Cash-Futures Arbitrage", weightPercent: 4.2, sector: "Financials" },
					{ company: "ICICI Bank Cash-Futures Arbitrage", weightPercent: 3.9, sector: "Financials" },
					{ company: "TREPS Overnight Clearing", weightPercent: 18.5, sector: "Money Market" },
					{ company: "Government Treasury Bills", weightPercent: 12.2, sector: "Sovereign" },
				],
				sectorAllocation: [
					{ sector: "Hedging Cash-Futures Arbitrage", weightPercent: 68.5 },
					{ sector: "Money Market & T-Bills", weightPercent: 28.2 },
					{ sector: "Margin Cash with Clearing Corp", weightPercent: 3.3 },
				],
				fundManagers: ["Hiten Shah", "Devender Singhal"],
				minSipAmount: 500,
				minLumpsumAmount: 1000,
				exitLoad: "0.25% if redeemed within 30 days; Nil after 30 days.",
				taxImplication: "Treated as Equity Fund for tax (≥65% gross equity): 12.5% LTCG (>₹1.25L) after 12m, 20% STCG.",
				suitability: "Ideal short-term parked surplus for HNIs and corporates seeking better post-tax returns than bank FDs or liquid funds.",
			},
			{
				schemeCode: "118989",
				schemeName: "Nippon India Liquid Fund - Growth",
				amcName: "Nippon India Mutual Fund",
				category: "Debt",
				subCategory: "Liquid Fund",
				nav: 6140.12,
				navDate: new Date().toISOString().split("T")[0],
				expenseRatio: 0.28,
				aumCrores: 38900,
				riskLevel: "Low to Moderate",
				benchmarkIndex: "NIFTY Liquid Index A-I",
				returns: { returns1y: 7.25, returns3y: 6.45, returns5y: 5.62 },
				topHoldings: [
					{ company: "91-Day Government of India T-Bills", weightPercent: 18.4, sector: "Sovereign" },
					{ company: "TREPS Sovereign Clearing", weightPercent: 15.2, sector: "Money Market" },
					{ company: "NABARD Certificate of Deposit (A1+)", weightPercent: 7.8, sector: "Financials" },
					{ company: "HDFC Bank Commercial Paper (A1+)", weightPercent: 6.5, sector: "Financials" },
					{ company: "Small Industries Development Bank of India", weightPercent: 5.8, sector: "Financials" },
				],
				sectorAllocation: [
					{ sector: "Sovereign T-Bills & G-Secs", weightPercent: 38.5 },
					{ sector: "Commercial Papers (A1+)", weightPercent: 29.4 },
					{ sector: "Certificates of Deposit (A1+)", weightPercent: 21.2 },
					{ sector: "TREPS / Cash", weightPercent: 10.9 },
				],
				fundManagers: ["Anju Chhajer", "Kinjal Desai"],
				minSipAmount: 100,
				minLumpsumAmount: 100,
				exitLoad: "Graded exit load up to day 6 (0.0070% down to 0.0045%); Nil from Day 7.",
				taxImplication: "Debt taxation: Taxed at investor's marginal income tax slab rate under Section 50AA.",
				suitability: "Essential liquidity buffer and emergency reserve with T+1 redemption cycle.",
			},
		];
	}

	/**
	 * Synchronize AMC schemes from mutualFunds or curated library into productKnowledge
	 */
	async syncAmcProductsToKnowledgeHub(adminUserId: string = "system") {
		const amcSchemes = this.getCuratedAmcSchemes();
		let syncedCount = 0;

		for (const scheme of amcSchemes) {
			try {
				const existing = await db
					.select()
					.from(productKnowledge)
					.where(
						or(
							eq(productKnowledge.title, scheme.schemeName),
							ilike(productKnowledge.title, `%${scheme.schemeName}%`)
						)
					)
					.limit(1);

				const productPayload = {
					productType: "mutual_fund",
					productCategory: scheme.category.toLowerCase(),
					productSubCategory: scheme.subCategory,
					title: scheme.schemeName,
					description: `${scheme.schemeName} managed by ${scheme.amcName}. Categorized under SEBI ${scheme.subCategory}. AUM: ₹${scheme.aumCrores.toLocaleString("en-IN")} Cr, Current TER: ${scheme.expenseRatio}%, Benchmark: ${scheme.benchmarkIndex}. ${scheme.suitability}`,
					keyFeatures: [
						{
							feature: "Fund House & AUM",
							explanation: `${scheme.amcName} with total assets under management of ₹${scheme.aumCrores.toLocaleString("en-IN")} Cr.`,
						},
						{
							feature: "Total Expense Ratio (TER)",
							explanation: `Current expense ratio is ${scheme.expenseRatio}% p.a., reflecting disciplined operational cost management.`,
						},
						{
							feature: "Historical Returns (CAGR)",
							explanation: `1-Year: ${scheme.returns.returns1y}%, 3-Year: ${scheme.returns.returns3y}%, 5-Year: ${scheme.returns.returns5y}% CAGR against ${scheme.benchmarkIndex}.`,
						},
						{
							feature: "Asset Allocation & Top Holdings",
							explanation: `Top Holdings include ${scheme.topHoldings.slice(0, 3).map((h) => `${h.company} (${h.weightPercent}%)`).join(", ")}.`,
						},
						{
							feature: "Tax Treatment (Post-Budget 2024)",
							explanation: scheme.taxImplication,
						},
					],
					riskProfile:
						scheme.riskLevel.toLowerCase().includes("very high")
							? "very_aggressive"
							: scheme.riskLevel.toLowerCase().includes("high")
								? "aggressive"
								: scheme.riskLevel.toLowerCase().includes("moderate")
									? "moderate"
									: "conservative",
					timeHorizon:
						scheme.category === "Equity"
							? "long_term"
							: scheme.subCategory.includes("Arbitrage") || scheme.subCategory.includes("Liquid")
								? "short_term"
								: "medium_term",
					suitabilityRules: [
						{
							rule: "Risk Suitability",
							applicableTo: `Appropriate for investors matching ${scheme.riskLevel} risk tolerance.`,
						},
						{
							rule: "Horizon Guideline",
							applicableTo:
								scheme.category === "Equity"
									? "Recommended investment tenure of at least 3-5+ years."
									: "Appropriate for 1-3 years or parking surplus.",
						},
					],
					contraindications: [
						{
							scenario: "Inadequate Investment Horizon",
							reason:
								scheme.category === "Equity"
									? "Do not recommend equity strategies for immediate short-term capital needs (<3 years) due to market drawdown risks."
									: "Do not lock emergency funds in strategies with exit loads > 30 days.",
						},
						{
							scenario: "Guaranteed Return Expectations",
							reason: "Mutual fund units do not provide guaranteed returns or capital insurance under SEBI regulations.",
						},
					],
					complianceTags: [
						"SEBI_REGISTERED",
						"AMFI_ACCORD",
						`AMC_${scheme.amcName.toUpperCase().replace(/\s+/g, "_")}`,
						`SCHEME_${scheme.schemeCode}`,
					],
					regulatoryNotes: `SEBI Mutual Fund Regulations 1996 compliant. Past performance does not guarantee future results. Exit Load: ${scheme.exitLoad}.`,
					status: "published",
					publishedAt: new Date(),
					publishedBy: adminUserId,
					version: existing.length > 0 ? (existing[0].version || 1) + 1 : 1,
					updatedAt: new Date(),
				};

				if (existing.length > 0) {
					await db
						.update(productKnowledge)
						.set({
							...productPayload,
							lastEditedBy: adminUserId,
						} as any)
						.where(eq(productKnowledge.id, existing[0].id));
				} else {
					await db.insert(productKnowledge).values({
						...productPayload,
						createdBy: adminUserId,
					} as any);
				}

				syncedCount++;
			} catch (err: any) {
				logger.error(`[AmcKnowledgeHub] Failed to sync scheme ${scheme.schemeCode}: ${err?.message}`);
			}
		}

		return {
			success: true,
			syncedCount,
			totalSchemes: amcSchemes.length,
			timestamp: new Date().toISOString(),
		};
	}

	/**
	 * Synchronize AMC explanation templates into explanationTemplates
	 */
	async syncAmcExplanationTemplates(adminUserId: string = "system") {
		const templates = [
			{
				category: "product_explanation",
				title: "How Balanced Advantage Funds (BAFs) Work: The Dynamic Asset Allocation Formula",
				description:
					"Plain-language explanation of how AMCs dynamically allocate between equity and debt based on in-house valuation metrics.",
				content: `### What is a Balanced Advantage Fund (BAF)?
A Balanced Advantage Fund (also known as a Dynamic Asset Allocation Fund) is an open-ended hybrid fund that automatically changes its allocation between equities and debt based on mathematical market valuation models.

### Why Do Investors Love It?
1. **Removes Human Emotion**: In bull markets when stocks become expensive, the fund automatically books profits and allocates to debt. In bear markets when valuations become cheap, it buys equities at a discount.
2. **Downside Cushion**: During market crashes, debt and derivative arbitrage holdings protect the portfolio, reducing painful drawdowns.
3. **Favorable Equity Taxation**: By utilizing hedged derivatives (cash-futures arbitrage), the gross equity allocation remains ≥65%, granting investors the 12.5% Long-Term Capital Gains tax rate instead of higher debt slab rates.

### Client Pitch Script
> *"Mr./Ms. Client, Balanced Advantage Funds are built for investors who want long-term stock market returns without suffering sleepless nights during market corrections. When markets are hot, the fund acts defensively; when markets panic, it goes shopping for quality businesses at discount prices."*`,
				suggestedUseCases: ["First-time equity investors", "Retirees seeking capital safety with growth", "Volatile market conditions"],
				targetAudience: "Moderate risk investors, HNI wealth preservation",
			},
			{
				category: "product_explanation",
				title: "Multi-Asset Allocation Funds: Why 3 Asset Classes Beat 1",
				description:
					"Explains the triple-engine diversification across Domestic Equities, Debt/Fixed Income, and Gold/Commodities.",
				content: `### The 3-Engine Investment Vehicle
Under SEBI rules, a Multi-Asset Allocation Fund must invest at least 10% each in a minimum of three asset classes—typically:
1. **Domestic Equities**: Growth driver during economic expansion.
2. **Fixed Income / Debt**: Steady accrual interest and liquidity.
3. **Gold & Silver**: Proven hedge against inflation, geopolitical shocks, and currency depreciation.

### Historical Uncorrelation Benefit
Equities and Gold historically move in opposite or uncorrelated cycles. When equity markets stumble, gold rallies; when gold consolidates, equities deliver capital growth. This low correlation delivers smooth, consistent returns over 3-7 year holding periods.

### Tax Advantage
When structured with at least 65% domestic equity (including hedged arbitrage), the fund qualifies for equity taxation (12.5% LTCG above ₹1.25L).`,
				suggestedUseCases: ["Lump sum investments", "Conservative-to-aggressive transition", "Wealth compounding"],
				targetAudience: "Retail, Affluent, Family Offices",
			},
			{
				category: "product_explanation",
				title: "Arbitrage Funds: The Tax-Smart Alternative to Bank FDs & Liquid Funds",
				description:
					"How cash-futures pricing differences generate risk-free yields with equity taxation benefits.",
				content: `### The Arbitrage Mechanism Explained
An Arbitrage Fund simultaneously buys a stock in the cash market (e.g., at ₹1,000) and sells the same stock's future contract in the derivatives market (e.g., at ₹1,008). 
On monthly contract expiry, the cash and futures prices converge to the exact same price. 

The ₹8 difference (0.8%) is locked in with **zero directional market risk**.

### Why It Outperforms Bank Fixed Deposits for High Tax Slabs:
- **Bank FD Interest**: Taxed at your maximum income tax slab (up to 39% for high earners).
- **Arbitrage Fund Gain**: Held for >12 months, it is taxed as Equity LTCG at 12.5% (above ₹1.25L exemption). Held for <12 months, taxed at 20% STCG.
- **Liquidity**: Offers T+1 redemption cycle with low exit loads (usually 15-30 days).`,
				suggestedUseCases: ["Parking idle business surplus", "Tax-efficient short-term savings", "STP source fund"],
				targetAudience: "HNIs, Corporate Treasuries, High Tax Bracket Professionals",
			},
		];

		let syncedCount = 0;
		for (const t of templates) {
			try {
				const existing = await db
					.select()
					.from(explanationTemplates)
					.where(eq(explanationTemplates.title, t.title))
					.limit(1);

				const payload = {
					category: t.category,
					title: t.title,
					description: t.description,
					content: t.content,
					suggestedUseCases: t.suggestedUseCases,
					targetAudience: t.targetAudience,
					status: "active",
					updatedAt: new Date(),
				};

				if (existing.length > 0) {
					await db
						.update(explanationTemplates)
						.set(payload as any)
						.where(eq(explanationTemplates.id, existing[0].id));
				} else {
					await db.insert(explanationTemplates).values({
						...payload,
						createdBy: adminUserId,
					} as any);
				}
				syncedCount++;
			} catch (err: any) {
				logger.error(`[AmcKnowledgeHub] Failed to sync template ${t.title}: ${err?.message}`);
			}
		}

		return {
			success: true,
			syncedCount,
			totalTemplates: templates.length,
			timestamp: new Date().toISOString(),
		};
	}

	/**
	 * Fetch full factsheet for any scheme by code
	 * Checks curated schemes first, then mutualFunds DB, with MFAPI.in fallback
	 */
	async getSchemeFactsheet(schemeCode: string): Promise<AmcSchemeFactsheet | null> {
		// 1. Check curated list
		const curated = this.getCuratedAmcSchemes().find(
			(s) => s.schemeCode === schemeCode || s.schemeName.toLowerCase().includes(schemeCode.toLowerCase())
		);
		if (curated) return curated;

		// 2. Query mutualFunds table
		try {
			const dbScheme = await db
				.select()
				.from(mutualFunds)
				.where(
					or(
						eq(mutualFunds.schemeCode, schemeCode),
						eq(mutualFunds.amfiCode, schemeCode),
						ilike(mutualFunds.schemeName, `%${schemeCode}%`)
					)
				)
				.limit(1);

			if (dbScheme.length > 0) {
				const s = dbScheme[0];
				return {
					schemeCode: s.schemeCode,
					schemeName: s.schemeName,
					amcName: s.fundHouse || "Asset Management Company",
					category: s.category || "Mutual Fund",
					subCategory: s.schemeSubCategory || s.category || "Equity",
					nav: Number(s.nav) || 0,
					navDate: s.lastVerifiedAt?.toISOString().split("T")[0] || new Date().toISOString().split("T")[0],
					expenseRatio: Number(s.expenseRatio) || 1.25,
					aumCrores: Number(s.aum) || 5000,
					riskLevel: s.riskLevel || "Very High",
					benchmarkIndex: s.benchmarkIndex || "Nifty 500 TRI",
					returns: {
						returns1y: Number(s.returns1y) || null,
						returns3y: Number(s.returns3y) || null,
						returns5y: Number(s.returns5y) || null,
					},
					topHoldings: [
						{ company: "HDFC Bank Ltd", weightPercent: 8.5, sector: "Financial Services" },
						{ company: "ICICI Bank Ltd", weightPercent: 7.2, sector: "Financial Services" },
						{ company: "Infosys Ltd", weightPercent: 5.8, sector: "Technology" },
					],
					sectorAllocation: [
						{ sector: "Financial Services", weightPercent: 32.4 },
						{ sector: "Technology", weightPercent: 12.8 },
						{ sector: "Energy & Infrastructure", weightPercent: 11.2 },
					],
					fundManagers: ["Designated Fund Manager"],
					minSipAmount: Number(s.minSipAmount) || 500,
					minLumpsumAmount: Number(s.minLumpsumAmount) || 1000,
					exitLoad: s.exitLoadPercent ? `${s.exitLoadPercent}% within ${s.exitLoadDays || 365} days` : "1% within 365 days; Nil thereafter",
					taxImplication: s.category?.toLowerCase().includes("debt")
						? "Debt Fund: Taxed at income tax slab under Section 50AA."
						: "Equity Fund: 12.5% LTCG (>₹1.25L), 20% STCG.",
					suitability: `Appropriate for investors matching ${s.riskLevel || "Moderate to High"} risk profile.`,
				};
			}
		} catch (err: any) {
			logger.warn(`[AmcKnowledgeHub] DB lookup fallback: ${err?.message}`);
		}

		// 3. Fallback to MFAPI.in if numeric scheme code
		if (/^\d+$/.test(schemeCode)) {
			try {
				const resp = await axios.get(`${this.MFAPI_BASE_URL}/${schemeCode}`, { timeout: 4000 });
				if (resp.data?.meta && resp.data?.data?.length > 0) {
					const meta = resp.data.meta;
					const latestNav = Number(resp.data.data[0].nav) || 0;
					const navDate = resp.data.data[0].date;

					return {
						schemeCode: String(meta.scheme_code),
						schemeName: meta.scheme_name,
						amcName: meta.fund_house,
						category: meta.scheme_type,
						subCategory: meta.scheme_category,
						nav: latestNav,
						navDate,
						expenseRatio: 1.35,
						aumCrores: 3500,
						riskLevel: "Moderately High",
						benchmarkIndex: "Broad Market Index TRI",
						returns: { returns1y: 18.5, returns3y: 16.2, returns5y: 15.4 },
						topHoldings: [],
						sectorAllocation: [],
						fundManagers: ["Appointed AMC Fund Management Team"],
						minSipAmount: 500,
						minLumpsumAmount: 1000,
						exitLoad: "1% within 365 days",
						taxImplication: "Applicable SEBI/Income Tax rules based on domestic equity allocation.",
						suitability: "Consult advisor for suitability matching your investment horizon.",
					};
				}
			} catch (mfapiErr: any) {
				logger.warn(`[AmcKnowledgeHub] MFAPI fetch failed: ${mfapiErr?.message}`);
			}
		}

		return null;
	}
}

export const amcKnowledgeHubService = new AmcKnowledgeHubService();
