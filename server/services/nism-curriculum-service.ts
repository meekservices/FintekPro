/**
 * NISM Official Curriculum & Study Guide Service
 * 
 * Provides chapter-by-chapter curriculum notes, key formulas, high-yield examination tips,
 * and regulatory benchmarks. Enables advisors to study complete course content directly inside FintekPro.
 * 
 * Complies with FintekPro Global Coding Rules (GCR v1.0 + FASP-AI v1.0).
 */

import { DEFAULT_COURSES, type NismCourse } from "./nism-lms-service";
import { NISM_PRACTICE_BANK } from "./nism-question-bank";

export interface NismFormulaItem {
	name: string;
	formula: string;
	explanation: string;
}

export interface NismCurriculumChapter {
	chapterNumber: number;
	title: string;
	moduleNumber: number;
	moduleTitle: string;
	weightage: string;
	overview: string;
	keyConcepts: string[];
	formulas?: NismFormulaItem[];
	highYieldTips: string[];
}

export interface NismCurriculumModule {
	moduleNumber: number;
	title: string;
	weightagePercentage: number;
	chapters: NismCurriculumChapter[];
}

export interface NismCourseCurriculum {
	courseId: string;
	seriesCode: string;
	title: string;
	description: string;
	totalModules: number;
	totalChapters: number;
	totalQuestionsExam: number;
	examDurationMinutes: number;
	passingPercentage: number;
	negativeMarkingPercentage: number;
	modules: NismCurriculumModule[];
}

/**
 * NISM-Series-V-D: Mutual Fund - Specialized Investment Fund (SIF) Distributors Certification
 * Full 22-Chapter Curriculum blueprint officially effective from July 2026.
 */
export const NISM_VD_CURRICULUM: NismCourseCurriculum = {
	courseId: "nism-vd",
	seriesCode: "NISM-SERIES-V-D",
	title: "NISM Series V-D: Mutual Fund – Specialized Investment Fund (SIF) Distributors Certification",
	description: "SEBI consolidated certification covering Mutual Funds (45%), Equity Derivatives (35%), and Interest Rate Derivatives & Specialized Investment Funds (SIF) (20%). Authorizes distribution of standard mutual funds and specialized investment funds (₹10L minimum ticket).",
	totalModules: 3,
	totalChapters: 22,
	totalQuestionsExam: 150,
	examDurationMinutes: 180,
	passingPercentage: 60,
	negativeMarkingPercentage: 10, // 0.10 marks deducted per wrong answer
	modules: [
		{
			moduleNumber: 1,
			title: "Module 1: Mutual Funds Distribution",
			weightagePercentage: 45,
			chapters: [
				{
					chapterNumber: 1,
					moduleNumber: 1,
					moduleTitle: "Mutual Funds Distribution",
					title: "Investment Landscape",
					weightage: "3-4 Questions (~2.5%)",
					overview: "Covers investors, savings vs investments, asset allocation, inflation impact, real vs nominal returns, and personal financial life-cycle stages.",
					keyConcepts: [
						"Financial goals: Short term (cash/liquid), medium term (debt/hybrid), long term (equity)",
						"Real Rate of Return = Nominal Rate - Inflation Rate",
						"Asset classes: Equity (growth), Fixed Income (income/capital preservation), Real Estate, Gold, and Cash equivalents",
						"Risk-Return Tradeoff: Higher potential returns require bearing higher systematic & non-systematic risks",
						"Compounding: Future Value = PV * (1 + r)^n",
					],
					formulas: [
						{
							name: "Real Rate of Return",
							formula: "Real Return ≈ Nominal Return - Inflation Rate (Exact: [(1 + Nominal)/(1 + Inflation)] - 1)",
							explanation: "Calculates purchasing power growth after accounting for inflation.",
						},
					],
					highYieldTips: [
						"Remember: Real return can be negative if inflation exceeds the nominal interest rate.",
						"Equities are the primary asset class in India that historically beat CPI inflation over 10+ year horizons.",
					],
				},
				{
					chapterNumber: 2,
					moduleNumber: 1,
					moduleTitle: "Mutual Funds Distribution",
					title: "Concept and Role of a Mutual Fund",
					weightage: "4-5 Questions (~3%)",
					overview: "Structure of mutual funds as collective investment vehicles, benefits of diversification, professional management, liquidity, and history in India.",
					keyConcepts: [
						"Mutual Fund pools money from investors having common financial objectives and invests in capital market securities",
						"Unitization: Units represent fractional ownership of the underlying investment portfolio",
						"Key advantages: Professional fund management, portfolio diversification, economies of scale, liquidity, and SEBI regulatory transparency",
						"History: Phase I (1964-1987 UTI monopoly), Phase II (1987-1993 Public Sector banks/LIC/GIC), Phase III (1993 private sector entry & SEBI regulations), Phase IV (2003 UTI bifurcation into SUUTI & UTI AMC).",
					],
					highYieldTips: [
						"Mutual funds do NOT guarantee returns; investors bear the entire portfolio investment risk.",
						"SEBI introduced the initial Mutual Fund Regulations in 1993, comprehensively revamped as SEBI (Mutual Funds) Regulations, 1996.",
					],
				},
				{
					chapterNumber: 3,
					moduleNumber: 1,
					moduleTitle: "Mutual Funds Distribution",
					title: "Legal Structure of Mutual Funds in India",
					weightage: "4-5 Questions (~3%)",
					overview: "Three-tier trust structure in India: Sponsor, Trust & Trustees, Asset Management Company (AMC), Custodian, and Registrar & Transfer Agent (RTA).",
					keyConcepts: [
						"Mutual Fund is established as a Public Trust under the Indian Trusts Act, 1882",
						"Sponsor: Promotes the mutual fund; must have at least 5 years of financial services track record, positive net worth for preceding 5 years, and contribute at least 40% of the AMC net worth",
						"Trustees: Hold fund assets in trust for the benefit of unit holders; at least 50% of the trustee board must be independent of the Sponsor",
						"AMC: Floats and manages schemes; net worth must be at least ₹50 Crore; at least 50% of AMC board must be independent directors",
						"Custodian: Holds portfolio securities in safe custody; must be completely independent of the Sponsor (except under strict SEBI arms-length provisions); handles settlement of trades",
						"RTA: Processes investor applications, unit allotments, redemptions, dividend payouts, and account statements.",
					],
					highYieldTips: [
						"Trustees have a fiduciary duty to unit holders and must meet at least once every 2 months (6 times a year).",
						"AMC directors and trustees cannot invest in schemes without following strict insider trading disclosures.",
					],
				},
				{
					chapterNumber: 4,
					moduleNumber: 1,
					moduleTitle: "Mutual Funds Distribution",
					title: "Legal and Regulatory Framework",
					weightage: "5-6 Questions (~4%)",
					overview: "Role of SEBI, RBI, AMFI, Ministry of Finance, and key provisions of SEBI (Mutual Funds) Regulations, 1996.",
					keyConcepts: [
						"SEBI is the primary capital markets regulator safeguarding investor interests",
						"AMFI (Association of Mutual Funds in India): Industry body setting standards, code of conduct, and issuing AMFI Registration Numbers (ARN)",
						"RBI regulates money market instruments, foreign exchange flows, and bank-sponsored AMCs",
						"Investor Rights: Right to receive scheme information, right to receive redemption proceeds within statutory TAT (T+2 for equity, T+1 for liquid/debt), right to 75% majority vote for winding up schemes",
						"SEBI Categorization Circular (October 2017): Standardized mutual funds into 5 broad groups (Equity, Debt, Hybrid, Solution Oriented, Other).",
					],
					highYieldTips: [
						"If redemption proceeds are delayed beyond statutory limits, the AMC must pay penal interest at 15% p.a. to the investor for the period of delay.",
						"AMFI Code of Ethics enforces fair business practices, non-rebating of commissions, and client suitability.",
					],
				},
				{
					chapterNumber: 5,
					moduleNumber: 1,
					moduleTitle: "Mutual Funds Distribution",
					title: "Scheme Related Information",
					weightage: "4-5 Questions (~3%)",
					overview: "Key statutory offer documents: Scheme Information Document (SID), Statement of Additional Information (SAI), Key Information Memorandum (KIM), and Periodic Disclosures.",
					keyConcepts: [
						"SID: Scheme-specific information (investment objective, asset allocation pattern, fund manager profile, risk factors, fees & expenses, cut-off timings); updated annually",
						"SAI: Statutory and operational information of the AMC, Sponsor, Trustees, legal history; updated by end of June every year",
						"KIM: Abridged summary of SID and SAI; must accompany every application form given to an investor; updated at least once a year",
						"Factsheet: Monthly disclosure showing portfolio holdings, top 10 stocks, sector weights, AUM, NAV, fund manager, and risk ratios",
						"Portfolio Disclosures: Fortnightly portfolio disclosure on AMC website within 5 days; monthly disclosure within 10 days.",
					],
					highYieldTips: [
						"KIM must be updated at least once a year, and within 7 days in case of material changes.",
						"Material changes in fundamental attributes (investment pattern, fee increase) require 30 days exit window without exit load.",
					],
				},
				{
					chapterNumber: 6,
					moduleNumber: 1,
					moduleTitle: "Mutual Funds Distribution",
					title: "Fund Distribution and Channel Management Practices",
					weightage: "5-6 Questions (~4%)",
					overview: "Distributor channels (Individuals, NDs, Banks, FinTech platforms), ARN registration, EUIN mechanism, commission structures, and anti-rebating rules.",
					keyConcepts: [
						"Distribution channels: Individual MFDs, National Distributors (NDs), Banks, FinTech online aggregators, and Direct Plans (no distributor commission)",
						"ARN (AMFI Registration Number) & EUIN (Employee Unique Identification Number): EUIN is mandatory to track person interacting with the client and curb mis-selling",
						"Commission Structure: All mutual fund commissions must be strictly paid on a 'Trail-Only' basis; upfront commissions are banned by SEBI since October 2018",
						"Section 41 of Insurance Act & SEBI Code of Conduct: Prohibition of rebates — distributors cannot refund or share commissions with clients as an inducement to invest",
						"Nomination and Transmission: Facilities for transmission of units to nominee/legal heir without probate up to specified thresholds.",
					],
					highYieldTips: [
						"Upfront commission is completely prohibited in India; all distributor fees must be trail-based from the scheme expense ratio.",
						"EUIN must be quoted on every transaction form involving advice or interaction, even if execution-only (by signing execution-only declaration).",
					],
				},
				{
					chapterNumber: 7,
					moduleNumber: 1,
					moduleTitle: "Mutual Funds Distribution",
					title: "Net Asset Value (NAV), Total Expense Ratio (TER) and Pricing of Units",
					weightage: "7-8 Questions (~5%)",
					overview: "NAV computation, mark-to-market valuation, SEBI regulatory limits on TER, GST on management fees, cut-off timings, and swing pricing.",
					keyConcepts: [
						"NAV = (Total Assets - Total Liabilities) / Total Number of Outstanding Units",
						"Total Expense Ratio (TER): Expressed as a percentage of daily net assets; includes management fees, trustee fees, audit, custodian, RTA, and distributor trail commissions",
						"SEBI TER Slabs for Equity Funds: First ₹500 Cr (2.25%), Next ₹250 Cr (2.00%), Next ₹1,250 Cr (1.75%), Next ₹3,000 Cr (1.60%), Next ₹5,000 Cr (1.50%), Next ₹40,000 Cr (reduction by 0.05% for every ₹5,000 Cr), Balance AUM (1.05%)",
						"Direct Plan TER must be lower than Regular Plan TER by the exact amount of distributor commission and distribution expenses",
						"Cut-off Timings: Liquid/Overnight funds purchase (1:30 PM, subject to realization of funds); other funds purchase (3:00 PM, allotment on realization of funds across all ticket sizes); redemption (3:00 PM)",
						"Swing Pricing: Applied during market dislocation to prevent dilution of value for existing unitholders due to large outflows.",
					],
					formulas: [
						{
							name: "Net Asset Value (NAV)",
							formula: "NAV = (Market Value of Investments + Receivables + Other Assets - Accrued Expenses - Liabilities) / Outstanding Units",
							explanation: "Calculated up to 4 decimal places for liquid/debt funds, 2 decimal places for equity/hybrid funds.",
						},
						{
							name: "Total Expense Ratio (TER)",
							formula: "TER (%) = (Total Operating & Management Expenses in INR / Scheme Average Net Assets) * 100",
							explanation: "Deducted daily from the scheme's net assets before publishing NAV.",
						},
					],
					highYieldTips: [
						"Remember: Since Feb 2021, all purchase transactions (equity, debt, hybrid) get the NAV of the day when funds are realized in the AMC bank account before 3:00 PM.",
						"GST on AMC management fee is charged over and above the base TER but must remain within the overall SEBI TER cap.",
					],
				},
				{
					chapterNumber: 8,
					moduleNumber: 1,
					moduleTitle: "Mutual Funds Distribution",
					title: "Taxation of Mutual Funds",
					weightage: "7-8 Questions (~5%)",
					overview: "Taxation of equity, debt, and hybrid funds after Finance (No. 2) Act 2024. LTCG, STCG, STT, TDS on dividends and redemptions.",
					keyConcepts: [
						"Finance Act 2024 Equity Taxation (Holding > 12 Months = Long Term): LTCG taxed at 12.5% without indexation (exemption threshold raised to ₹1.25 Lakh per financial year)",
						"Finance Act 2024 Equity Short Term (Holding ≤ 12 Months): STCG taxed at 20% (increased from 15%)",
						"Securities Transaction Tax (STT): Applicable on delivery and redemption of equity mutual fund units at 0.001% (on equity-oriented funds)",
						"Debt Funds (Equity holding < 35% acquired on/after 1 April 2023): Classified as 'Specified Mutual Funds' under Section 50AA; all gains treated as short-term capital gains taxed at the investor's applicable income tax slab rates regardless of holding period",
						"Non-Equity Hybrid Funds (Equity between 35% and 65%): Long term holding period is 24 months (effective 23 July 2024), taxed at 12.5% without indexation",
						"Dividend / IDCW Taxation: Taxed in the hands of unit holders at their applicable slab rates; TDS @ 10% under Section 194K applies if total dividend paid exceeds ₹5,000 in a financial year for resident unitholders.",
					],
					formulas: [
						{
							name: "Capital Gain Calculation",
							formula: "Capital Gain = Full Value of Consideration - (Cost of Acquisition + Transfer Expenses)",
							explanation: "Indexation benefit is eliminated for all transfers on or after 23 July 2024.",
						},
					],
					highYieldTips: [
						"Exam Favorite: Finance Act 2024 raised the annual LTCG exemption limit from ₹1 Lakh to ₹1.25 Lakh, and the tax rate from 10% to 12.5% without indexation.",
						"Debt mutual funds with ≤35% equity acquired after 31 March 2023 have NO long-term capital gains status (Section 50AA slab taxation).",
					],
				},
				{
					chapterNumber: 9,
					moduleNumber: 1,
					moduleTitle: "Mutual Funds Distribution",
					title: "Investor Services",
					weightage: "5-6 Questions (~4%)",
					overview: "KYC process, CKYC, KRA, in-person verification (IPV), FATCA/CRS, transaction execution (SIP, STP, SWP, switch), demat vs physical units, and grievance redressal.",
					keyConcepts: [
						"KYC (Know Your Client): Mandatory for all investors; PAN is sole identifier; handled by KRAs (CVL, NDML, CAMS, Karvy, NSE)",
						"CKYC (Central KYC Records Registry): Managed by CERSAI; generates 14-digit KIN (KYC Identification Number)",
						"In-Person Verification (IPV): Mandatory for KYC; can be conducted by AMC, RTA, or AMFI registered distributor with valid EUIN",
						"Systematic Transactions: SIP (averaging purchase cost), STP (periodic transfer from debt to equity), SWP (periodic tax-efficient cash flow)",
						"FATCA & CRS: Mandatory declarations for tax residency outside India",
						"SEBI SCORES 2.0 platform: Investor grievance redressal within 21 calendar days.",
					],
					highYieldTips: [
						"Rupee Cost Averaging is the key mathematical benefit of SIP — more units are acquired when NAV is low, fewer when NAV is high.",
						"Power of Attorney (PoA) investors can transact, but redemption proceeds are ALWAYS credited only to the primary unit holder's verified bank account.",
					],
				},
				{
					chapterNumber: 10,
					moduleNumber: 1,
					moduleTitle: "Mutual Funds Distribution",
					title: "Risk, Return and Performance of Funds",
					weightage: "6-7 Questions (~4.5%)",
					overview: "Performance measurement, CAGR, XIRR, Rolling Returns, risk metrics (Standard Deviation, Beta), and risk-adjusted return ratios (Sharpe, Treynor, Sortino, Jensen's Alpha, Tracking Error).",
					keyConcepts: [
						"CAGR = (Ending Value / Beginning Value)^(1/n) - 1; used for point-to-point returns over periods > 1 year",
						"XIRR: Extended Internal Rate of Return; used for irregular cash flows (SIPs, STPs, multiple purchases/redemptions)",
						"Standard Deviation: Measures total risk (volatility) of returns around the mean",
						"Beta: Measures systematic (market) risk; Beta = 1 moves with market, Beta > 1 is more volatile, Beta < 1 is defensive",
						"Sharpe Ratio = (Fund Return - Risk Free Rate) / Standard Deviation (Measures excess return per unit of total risk)",
						"Treynor Ratio = (Fund Return - Risk Free Rate) / Beta (Measures excess return per unit of systematic risk)",
						"Jensen's Alpha = Fund Return - [Risk Free Rate + Beta * (Market Return - Risk Free Rate)]",
						"Sortino Ratio: Downside deviation ratio; penalizes only downside volatility below the minimum acceptable return",
						"Tracking Error: Standard deviation of excess returns of an index fund/ETF over its benchmark index.",
					],
					formulas: [
						{
							name: "Sharpe Ratio",
							formula: "Sharpe = (Rp - Rf) / σp",
							explanation: "Rp = Portfolio Return, Rf = Risk Free Rate (e.g. 91-day T-bill), σp = Standard Deviation of Portfolio.",
						},
						{
							name: "Treynor Ratio",
							formula: "Treynor = (Rp - Rf) / βp",
							explanation: "βp = Portfolio Beta relative to the benchmark market index.",
						},
						{
							name: "Jensen's Alpha",
							formula: "Alpha = Rp - [Rf + βp * (Rm - Rf)]",
							explanation: "Positive alpha indicates the fund manager generated excess return over CAPM expected return.",
						},
					],
					highYieldTips: [
						"When comparing diversified funds, use Sharpe Ratio (total risk). When comparing portfolios that will be added to an already well-diversified portfolio, use Treynor Ratio (systematic risk).",
						"Sortino is superior to Sharpe when returns are skewed or non-normally distributed.",
					],
				},
				{
					chapterNumber: 11,
					moduleNumber: 1,
					moduleTitle: "Mutual Funds Distribution",
					title: "Mutual Fund Scheme Selection",
					weightage: "5-6 Questions (~4%)",
					overview: "SEBI scheme categorization guidelines, equity schemes (Large, Mid, Small, Flexi, Multi, Sectoral), debt schemes (Liquid, Ultra Short, Corporate Bond, Gilt), hybrid schemes (Aggressive, Balanced Advantage, Multi Asset), solution and index/ETFs.",
					keyConcepts: [
						"Large Cap: Top 100 companies by market cap (minimum 80% in large caps)",
						"Mid Cap: 101st to 250th company by market cap (minimum 65% in mid caps)",
						"Small Cap: 251st company onwards (minimum 65% in small caps)",
						"Flexi Cap Fund: Minimum 65% in equity across large, mid, small caps with complete flexibility of allocation",
						"Multi Cap Fund: Minimum 25% each in Large, Mid, and Small Cap stocks (total min 75% equity)",
						"Balanced Advantage / Dynamic Asset Allocation Fund: Dynamically alters equity-debt allocation using quantitative valuation models (P/E, P/B)",
						"Overnight Fund (matures in 1 day), Liquid Fund (matures up to 91 days with graded exit load for 7 days)",
						"Gilt Fund: Minimum 80% in government securities, zero credit risk but subject to interest rate/duration risk.",
					],
					highYieldTips: [
						"Multi Cap funds MUST hold at least 25% in Large, 25% in Mid, and 25% in Small caps. Flexi Cap funds have no minimum cap restrictions.",
						"Liquid funds have a graded exit load up to Day 6 of investment; Day 7 onwards exit load is nil.",
					],
				},
				{
					chapterNumber: 12,
					moduleNumber: 1,
					moduleTitle: "Mutual Funds Distribution",
					title: "Mutual Fund Scheme Recommendation",
					weightage: "5-6 Questions (~4%)",
					overview: "Financial planning process, investor risk profiling (conservative, moderate, aggressive), goal planning, asset allocation, portfolio rebalancing, and behavioral biases.",
					keyConcepts: [
						"Financial Planning Process: Establish relationship -> Gather data -> Analyze financial status -> Develop plan -> Implement -> Review & rebalance",
						"Strategic vs Tactical Asset Allocation: Strategic sets long-term baseline; Tactical exploits short-term mispricings",
						"Rebalancing: Selling over-performing assets and buying under-performing assets to restore target asset allocation",
						"Behavioral Biases: Loss aversion (feeling pain of loss twice as much as joy of gain), mental accounting, recency bias, herd behavior",
						"SEBI Risk-o-meter: Updated monthly; 6 risk levels: Low, Low to Moderate, Moderate, Moderately High, High, Very High.",
					],
					highYieldTips: [
						"Distributors must always recommend schemes that strictly match the investor's risk profile and investment horizon (Suitability Rule).",
						"Periodic rebalancing enforces buying low and selling high in a disciplined, unemotional manner.",
					],
				},
			],
		},
		{
			moduleNumber: 2,
			title: "Module 2: Equity Derivatives",
			weightagePercentage: 35,
			chapters: [
				{
					chapterNumber: 13,
					moduleNumber: 2,
					moduleTitle: "Equity Derivatives",
					title: "Basics of Derivatives",
					weightage: "7-8 Questions (~5%)",
					overview: "Definition of derivatives, underlying assets, history in India, OTC vs exchange-traded derivatives, market participants (Hedgers, Speculators, Arbitrageurs), and clearing house role.",
					keyConcepts: [
						"A derivative is a financial contract whose value is derived from the value of an underlying asset (equities, bonds, currencies, commodities)",
						"Exchange Traded Derivatives (ETD): Standardized contracts, traded on recognized exchanges (NSE/BSE), novation by Clearing Corporation (NSCCL/ICCL), zero counterparty default risk",
						"Over The Counter (OTC) Derivatives: Bilateral contracts, customized terms, counterparty default risk, lack of transparency",
						"Market Participants: Hedgers (reduce price risk), Speculators (assume risk to profit from price movements), Arbitrageurs (exploit price differentials between markets without risk)",
						"Economic functions: Price discovery, risk reallocation, operational efficiency, and market liquidity.",
					],
					highYieldTips: [
						"In exchange-traded derivatives, the Clearing Corporation acts as the legal counterparty to every trade via the process of 'Novation'.",
						"Derivatives are zero-sum games in financial terms: one party's profit is exactly equal to the counterparty's loss (before transaction costs).",
					],
				},
				{
					chapterNumber: 14,
					moduleNumber: 2,
					moduleTitle: "Equity Derivatives",
					title: "Understanding Indices",
					weightage: "8-9 Questions (~5.5%)",
					overview: "Significance of stock market indices, index calculation methodologies (Market Cap weighted, Free-Float Market Cap), Nifty 50, Sensex, and derivatives on indices.",
					keyConcepts: [
						"Stock index acts as a market barometer and underlying for index futures and options contracts",
						"Free-Float Market Capitalization: Only shares available for public trading are considered; excludes promoter holdings, government stakes, strategic cross-holdings, and lock-in shares",
						"Index Construction: Selection criteria based on liquidity (impact cost), trading frequency, and market capitalization",
						"Impact Cost: The cost of executing a trade of specific size without moving the market price; measures stock liquidity (lower impact cost = higher liquidity)",
						"Attributes of Index Derivatives: Cannot be manipulated easily; diversified exposure; cash settled on expiry.",
					],
					formulas: [
						{
							name: "Free-Float Market Capitalization",
							formula: "Free Float Market Cap = Total Outstanding Shares * Market Price * Investible Weight Factor (IWF)",
							explanation: "IWF is the percentage of shares readily available to the public in the market.",
						},
					],
					highYieldTips: [
						"Index futures in India are ALWAYS cash settled, whereas single stock derivatives have physical delivery settlement upon expiry.",
						"Low impact cost is an absolute prerequisite for a stock to be eligible for the F&O segment and major indices.",
					],
				},
				{
					chapterNumber: 15,
					moduleNumber: 2,
					moduleTitle: "Equity Derivatives",
					title: "Introduction to Forwards and Futures",
					weightage: "11-12 Questions (~7.5%)",
					overview: "Forward contracts, Futures contract specifications, margins (SPAN margin, Extreme Loss Margin / ELM, Mark-to-Market / MTM), Cost of Carry model, basis, cash-and-carry and reverse cash-and-carry arbitrage.",
					keyConcepts: [
						"Futures Contract: Standardized agreement to buy or sell an asset at a predetermined price on a specified future date",
						"Margin Mechanism: Initial Margin (SPAN margin for worst-case portfolio loss + ELM for tail risk); MTM margin settled daily in cash",
						"Mark-to-Market (MTM): Daily settlement of profits and losses credited or debited to the trading account based on the daily closing settlement price",
						"Basis = Spot Price - Futures Price (Positive basis is normal; negative basis is inverted/backwardation)",
						"Cost of Carry Model: Futures Price = Spot Price * e^(r*t) or Spot Price * [1 + r*(t/365)] - Dividends",
						"Cash-and-Carry Arbitrage: When Futures Price > Fair Cost of Carry price; buy in spot market, sell in futures market, lock in riskless profit",
						"Reverse Cash-and-Carry Arbitrage: When Futures Price < Fair Cost of Carry price; short spot, buy futures.",
					],
					formulas: [
						{
							name: "Futures Fair Price (Cost of Carry)",
							formula: "Futures Price = Spot Price + Cost of Financing - Dividend Yield",
							explanation: "Reflects the interest cost of holding the physical security until expiry minus dividends received.",
						},
						{
							name: "Basis",
							formula: "Basis = Spot Price - Futures Price",
							explanation: "Basis converges to exactly ZERO at expiration of the contract.",
						},
					],
					highYieldTips: [
						"At contract expiration, the Futures price must equal the Spot price (Convergence Principle).",
						"If an investor fails to maintain maintenance margin, the broker initiates a margin call or liquidates the position.",
					],
				},
				{
					chapterNumber: 16,
					moduleNumber: 2,
					moduleTitle: "Equity Derivatives",
					title: "Introduction to Options",
					weightage: "13-14 Questions (~9%)",
					overview: "Option terminology, Call & Put options, Buyer vs Seller payoffs, Moneyness (ITM, ATM, OTM), Intrinsic Value, Time Value, Option Greeks (Delta, Gamma, Theta, Vega, Rho), Put-Call Ratio (PCR), and Black-Scholes pricing factors.",
					keyConcepts: [
						"Call Option gives the buyer the right (but not the obligation) to BUY; seller has the obligation to sell",
						"Put Option gives the buyer the right (but not the obligation) to SELL; seller has the obligation to buy",
						"Buyer has limited risk (premium paid) and unlimited upside; Seller has limited upside (premium received) and unlimited risk",
						"Option Premium = Intrinsic Value + Time Value",
						"Intrinsic Value: For Call = Max(0, Spot - Strike); For Put = Max(0, Strike - Spot). Intrinsic value can never be negative",
						"Time Value = Option Premium - Intrinsic Value (decays over time, reaching zero at expiration)",
						"Moneyness: In-the-Money (ITM has intrinsic value), At-the-Money (ATM Spot ≈ Strike), Out-of-the-Money (OTM intrinsic value = 0)",
						"Option Greeks: Delta (sensitivity to underlying price), Gamma (rate of change of Delta), Theta (time decay, negative for buyers), Vega (sensitivity to implied volatility), Rho (sensitivity to interest rates)",
						"Put-Call Ratio (PCR): PCR of Volume or Open Interest (OI = Total open contracts). High PCR (>1.2) suggests bullish sentiment/oversold market.",
					],
					formulas: [
						{
							name: "Call Payoff (Buyer)",
							formula: "Payoff = Max(0, St - K) - Premium Paid",
							explanation: "St = Spot Price at Expiry, K = Strike Price.",
						},
						{
							name: "Put Payoff (Buyer)",
							formula: "Payoff = Max(0, K - St) - Premium Paid",
							explanation: "Break-even price for Put buyer = Strike Price - Premium Paid.",
						},
						{
							name: "Delta",
							formula: "Delta = Change in Option Premium / Change in Underlying Asset Price",
							explanation: "Call Delta ranges from 0 to +1; Put Delta ranges from 0 to -1.",
						},
					],
					highYieldTips: [
						"European options can ONLY be exercised on the expiry date (all index and stock options in India are European style, indicated by CE and PE).",
						"Theta decay accelerates sharply in the final 30 days before expiration, heavily favoring option sellers.",
					],
				},
				{
					chapterNumber: 17,
					moduleNumber: 2,
					moduleTitle: "Equity Derivatives",
					title: "Strategies Using Equity Futures and Options",
					weightage: "12-13 Questions (~8%)",
					overview: "Hedging, trading and spread strategies: Covered Call, Protective Put, Bull Call Spread, Bear Put Spread, Long/Short Straddle, Strangle, Collar, and Beta hedging with index futures.",
					keyConcepts: [
						"Covered Call: Long Stock + Short OTM Call (Generates income in a neutral/mildly bullish market; caps upside)",
						"Protective Put: Long Stock + Long OTM Put (Provides downside price insurance while retaining upside)",
						"Collar: Long Stock + Long OTM Put (downside floor) + Short OTM Call (finances put cost)",
						"Bull Call Spread: Buy Lower Strike Call + Sell Higher Strike Call (moderately bullish, lower net debit)",
						"Bear Put Spread: Buy Higher Strike Put + Sell Lower Strike Put (moderately bearish, capped risk & reward)",
						"Long Straddle: Buy ATM Call + Buy ATM Put (profits from large breakout in either direction, high volatility play)",
						"Short Straddle: Sell ATM Call + Sell ATM Put (profits when market remains flat, range-bound, low volatility)",
						"Long Strangle: Buy OTM Call + Buy OTM Put (cheaper than straddle, requires larger price explosion to profit)",
						"Portfolio Beta Hedging: Number of index futures contracts to hedge = (Portfolio Value * Target Beta Change) / (Futures Contract Value).",
					],
					formulas: [
						{
							name: "Index Futures Hedge Ratio",
							formula: "Contracts to Short = (Portfolio Value * Portfolio Beta) / (Index Futures Price * Lot Size)",
							explanation: "Creates a delta-neutral portfolio where market loss is offset by futures gain.",
						},
						{
							name: "Bull Call Spread Max Profit",
							formula: "Max Profit = (Higher Strike - Lower Strike) - Net Premium Paid",
							explanation: "Max Loss is strictly limited to the Net Premium Paid.",
						},
					],
					highYieldTips: [
						"A Protective Put is equivalent to purchasing term insurance for your stock portfolio.",
						"Short Straddle has unlimited loss potential if a sudden large gap-up or gap-down occurs.",
					],
				},
			],
		},
		{
			moduleNumber: 3,
			title: "Module 3: Interest Rate Derivatives & SIF Products",
			weightagePercentage: 20,
			chapters: [
				{
					chapterNumber: 18,
					moduleNumber: 3,
					moduleTitle: "Interest Rate Derivatives & SIF",
					title: "Introduction to Interest Rates, Instruments and Fixed Income Markets",
					weightage: "6-7 Questions (~4%)",
					overview: "Money market vs debt market, G-Secs, Treasury bills, SDLs, corporate bonds, yield-to-maturity (YTM), clean vs dirty price, Macaulay duration, modified duration, convexity, and yield curve dynamics.",
					keyConcepts: [
						"Fixed Income Instruments: Treasury Bills (91, 182, 364 days; issued at discount, redeemed at par), Government Securities (G-Secs, coupon paying), State Development Loans (SDLs), Corporate Debentures",
						"Price-Yield Relationship: Bond prices and interest rate yields are INVERSELY related (when interest rates rise, bond prices fall)",
						"Yield to Maturity (YTM): The internal rate of return (IRR) earned by an investor who holds the bond until maturity and reinvests all coupon payments at the YTM",
						"Clean Price vs Dirty Price: Dirty Price = Clean Price + Accrued Interest. The invoice price paid by the buyer is the Dirty Price",
						"Macaulay Duration: Weighted average time to receive all bond cash flows; Modified Duration = Macaulay Duration / (1 + YTM/n)",
						"Modified Duration measures percentage change in bond price for a 100 bps (1%) change in interest rates",
						"Convexity: Second derivative of price with respect to yield; accounts for curvature in the price-yield relationship.",
					],
					formulas: [
						{
							name: "Modified Duration",
							formula: "Modified Duration = Macaulay Duration / (1 + YTM / m)",
							explanation: "% Change in Bond Price ≈ - Modified Duration * Change in Yield.",
						},
						{
							name: "Dirty Price",
							formula: "Dirty Price = Clean Price + Accrued Interest",
							explanation: "Accrued Interest = Coupon * (Days since last coupon / Days in coupon period).",
						},
					],
					highYieldTips: [
						"Zero-coupon bonds have Macaulay Duration exactly equal to their maturity period.",
						"Higher coupon bonds have LOWER duration (less interest rate risk) than lower coupon bonds of the same maturity.",
					],
				},
				{
					chapterNumber: 19,
					moduleNumber: 3,
					moduleTitle: "Interest Rate Derivatives & SIF",
					title: "Interest Rate Derivatives (IRDs)",
					weightage: "5-6 Questions (~3.5%)",
					overview: "Economic role of IRDs, Forward Rate Agreements (FRAs), Interest Rate Swaps (IRS), Overnight Indexed Swaps (OIS), and hedging balance sheet duration gaps.",
					keyConcepts: [
						"Interest Rate Derivatives (IRDs) allow banks, mutual funds, insurance companies, and corporations to hedge fluctuations in borrowing costs and portfolio values",
						"Forward Rate Agreement (FRA): An OTC contract determining the rate of interest to be paid on an agreed notional principal at a future date (e.g. 3x6 FRA)",
						"Interest Rate Swap (IRS): Plain vanilla swap where party A pays fixed and receives floating (e.g. MIBOR), and party B pays floating and receives fixed",
						"Overnight Indexed Swap (OIS): Floating leg is tied to the compounded overnight Mumbai Interbank Outright Rate (MIBOR); key liquidity benchmark in India",
						"Floating-to-Fixed Swap: Used by borrowers with floating-rate debt to lock in a fixed interest rate and protect against rising rates.",
					],
					formulas: [
						{
							name: "FRA Settlement Payment",
							formula: "Payment = [Notional * (Reference Rate - Agreed FRA Rate) * (Days / 360)] / [1 + Reference Rate * (Days / 360)]",
							explanation: "Discounted back to settlement date because payment occurs at the beginning of the loan period.",
						},
					],
					highYieldTips: [
						"In an IRS or OIS, only the net interest difference is exchanged between parties; the notional principal itself is NEVER exchanged.",
						"MIBOR (Mumbai Interbank Outright Rate) is administered by Financial Benchmarks India Pvt Ltd (FBIL).",
					],
				},
				{
					chapterNumber: 20,
					moduleNumber: 3,
					moduleTitle: "Interest Rate Derivatives & SIF",
					title: "Exchange Traded Interest Rate Futures (IRFs)",
					weightage: "6-7 Questions (~4%)",
					overview: "Contract specifications for 10-year G-Sec futures, tick size, lot size, Conversion Factor (CF), Cheapest-to-Deliver (CTD) bond calculation, and delivery settlement.",
					keyConcepts: [
						"Exchange Traded IRF: Standardized futures contract based on Government of India securities (G-Secs)",
						"Underlying: Standard 10-year GoI security with a notional coupon of 6% or 7% p.a. semi-annual",
						"Conversion Factor (CF): Equalizes bonds of varying maturities and coupons that can be delivered against the contract; calculated assuming a constant 6% yield curve",
						"Cheapest to Deliver (CTD) Bond: The specific deliverable G-Sec that maximizes the seller's profit or minimizes the cost of delivery",
						"Cost of Delivery / Net Basis = Bond Dirty Price - (Futures Settlement Price * Conversion Factor)",
						"Cash Settlement vs Physical Settlement: NSE IRF contracts on 10-year G-Sec can be settled in cash or via physical delivery of deliverable basket bonds.",
					],
					formulas: [
						{
							name: "Invoice Price for Deliverable Bond",
							formula: "Invoice Amount = (Futures Settlement Price * Conversion Factor) + Accrued Interest",
							explanation: "The amount the buyer pays to the seller upon delivery of the bond.",
						},
						{
							name: "Gross Basis of CTD Bond",
							formula: "Gross Basis = Spot Clean Price - (Futures Price * Conversion Factor)",
							explanation: "The bond with the lowest gross basis / net basis is the Cheapest-to-Deliver (CTD).",
						},
					],
					highYieldTips: [
						"The seller of the IRF contract has the legal choice of which deliverable bond to deliver (the Delivery Option).",
						"When market yields are above 6%, high coupon bonds tend to become the Cheapest-to-Deliver.",
					],
				},
				{
					chapterNumber: 21,
					moduleNumber: 3,
					moduleTitle: "Interest Rate Derivatives & SIF",
					title: "Exchange Traded Interest Rate Options (IROs)",
					weightage: "5-6 Questions (~3.5%)",
					overview: "Contract specifications of Interest Rate Options on G-Secs and 10-year benchmark bond, strike prices, European style exercise, valuation, and implied volatility.",
					keyConcepts: [
						"Exchange Traded Interest Rate Options (IROs) are options where the underlying is an interest rate or an eligible G-Sec bond",
						"Call Option on Bond: Gives the right to buy the bond at strike price; profits when interest rates FALL (bond prices rise)",
						"Put Option on Bond: Gives the right to sell the bond at strike price; profits when interest rates RISE (bond prices fall)",
						"Borrowers facing rising interest rates can hedge by buying Bond Put Options (or Interest Rate Call Options)",
						"European style options: Exercised only on expiration day; settled based on the weighted average price of the underlying G-Sec in the last trading session.",
					],
					highYieldTips: [
						"A Call Option on an Interest Rate is economically equivalent to a Put Option on a Bond price.",
						"IRO premiums are quoted in INR per ₹100 face value of the underlying security.",
					],
				},
				{
					chapterNumber: 22,
					moduleNumber: 3,
					moduleTitle: "Interest Rate Derivatives & SIF",
					title: "Strategies Using Interest Rate Derivatives & Specialized Investment Funds (SIF) Framework",
					weightage: "7-8 Questions (~5%)",
					overview: "Duration management, portfolio immunization, and the complete SEBI Specialized Investment Fund (SIF) / New Asset Class regulatory framework: ₹10 Lakhs minimum ticket, permissible strategies, unconstrained bond funds, long-short equity, inverse ETFs, risk disclosures, distributor eligibility, and comparison with MFs, PMS (₹50L), and AIFs (₹1 Cr).",
					keyConcepts: [
						"SEBI Specialized Investment Fund (SIF) / 'New Asset Class' (NAC) Framework: Created to bridge the gap between Mutual Funds (retail) and PMS (₹50L) / AIFs (₹1 Crore)",
						"Minimum Investment Threshold for SIF: Exactly ₹10 Lakhs per investor across investment strategies of the SIF offered by an AMC",
						"Permissible SIF Investment Strategies: Long-Short Equity Strategy, Inverse Exchange Traded Funds, Unconstrained Fixed Income Strategies, Sector Rotation with Derivative Overlays",
						"Derivative Overlays in SIF: SIFs are authorized to use derivatives for both hedging and non-hedging (leverage/alpha generation) purposes within strict gross exposure limits",
						"SIF Distributor Eligibility: Must possess valid NISM-Series-V-D certification; authorizes dual distribution of standard mutual funds and specialized investment funds",
						"Comparison Matrix: Mutual Funds (₹100-₹500 min, strict caps, retail), SIF (₹10 Lakhs min, derivative flexibility, HNIs), PMS (₹50 Lakhs min, managed separately), AIF Category I & II (₹1 Crore min, closed-ended, private equity/debt/real estate)",
						"Risk Profiling & Disclosures: SIF products must have transparent risk profiling, risk-o-meter disclosures, and clear warnings that capital is at risk due to derivative overlays",
						"Bond Portfolio Immunization: Setting portfolio duration equal to the investor's investment horizon so price risk and reinvestment risk exactly offset each other.",
					],
					formulas: [
						{
							name: "Target Duration Hedge with IRFs",
							formula: "Number of IRF Contracts = [(Target Duration - Current Duration) * Portfolio Value] / [Futures Duration * Futures Contract Value]",
							explanation: "Adjusts portfolio duration up or down instantly without buying or selling underlying bonds.",
						},
						{
							name: "SIF Ticket Size",
							formula: "Minimum SIF Investment = ₹10,00,000 (Ten Lakhs Rupees) per PAN",
							explanation: "Mandated by SEBI to prevent retail mis-selling while offering high-ticket flexibility.",
						},
					],
					highYieldTips: [
						"CRITICAL EXAM QUESTION: The minimum investment ticket size for a Specialized Investment Fund (SIF) is ₹10 Lakhs (NOT ₹50L like PMS, NOT ₹1 Cr like AIF).",
						"NISM-Series-V-D certification is the SOLE mandatory certification that clears distributors for both standard Mutual Funds and Specialized Investment Funds (SIF).",
						"SIF funds are allowed to use long-short equity and inverse strategies, which are strictly prohibited in standard mutual funds.",
					],
				},
			],
		},
	],
};


export const NISM_VA_CURRICULUM: NismCourseCurriculum = {
  "courseId": "nism-va",
  "seriesCode": "NISM-SERIES-V-A",
  "title": "NISM Series V-A: Mutual Fund Distributors Certification",
  "description": "SEBI mandated benchmark certification for all mutual fund distributors, independent financial advisors (IFAs), and wealth relationship managers. Comprehensive coverage across all 12 chapters.",
  "totalModules": 2,
  "totalChapters": 12,
  "totalQuestionsExam": 100,
  "examDurationMinutes": 120,
  "passingPercentage": 50,
  "negativeMarkingPercentage": 0,
  "modules": [
    {
      "moduleNumber": 1,
      "title": "Mutual Fund Principles, Structure & Regulations",
      "weightagePercentage": 55,
      "chapters": [
        {
          "chapterNumber": 1,
          "title": "Investment Landscape",
          "moduleNumber": 1,
          "moduleTitle": "Mutual Fund Principles, Structure & Regulations",
          "weightage": "8% (8 Qs)",
          "overview": "Investors' financial goals, role of savings, asset classes (equity, debt, gold, real estate), real vs nominal rate of return, power of compounding, and systemic risk.",
          "keyConcepts": [
            "Real Rate of Return = Nominal Rate - Inflation Rate",
            "Rule of 72: Doubling time = 72 / Annual Interest Rate",
            "Asset allocation is the primary determinant of long-term portfolio return variance",
            "Systematic Risk (Market risk, cannot be diversified away) vs Unsystematic Risk (Company/industry specific, diversifiable)"
          ],
          "formulas": [
            {
              "name": "Real Rate of Return",
              "formula": "r_real = r_nominal - inflation",
              "explanation": "Measures net purchasing power gain."
            },
            {
              "name": "Rule of 72",
              "formula": "Years to Double = 72 / CAGR(%)",
              "explanation": "Quick mental arithmetic for capital doubling."
            }
          ],
          "highYieldTips": [
            "Inflation erodes purchasing power; equity is historically the premier asset class for beating long-term inflation.",
            "Unsystematic risk can be eliminated via portfolio diversification across 20-30 stocks."
          ]
        },
        {
          "chapterNumber": 2,
          "title": "Concept and Role of a Mutual Fund",
          "moduleNumber": 1,
          "moduleTitle": "Mutual Fund Principles, Structure & Regulations",
          "weightage": "8% (8 Qs)",
          "overview": "Definition of mutual funds, benefits (professional management, liquidity, affordability, diversification), fund classification (open-ended, close-ended, interval), and direct vs regular plans.",
          "keyConcepts": [
            "Mutual fund is a trust that pools money from investors with a common financial objective",
            "Open-ended funds allow continuous purchase and repurchase at NAV-related prices",
            "Close-ended funds have a fixed maturity and must be listed on recognized stock exchanges",
            "Direct plans have lower TER due to absence of distributor commissions, leading to higher NAVs"
          ],
          "formulas": [
            {
              "name": "Net Asset Value (NAV)",
              "formula": "NAV = (Total Assets - Total Liabilities) / Outstanding Units",
              "explanation": "Calculated daily up to 4 decimal places for index/liquid and 2-4 decimals for equity."
            }
          ],
          "highYieldTips": [
            "Direct plan NAV is ALWAYS strictly greater than or equal to Regular plan NAV due to zero trail commission expense.",
            "Close-ended funds cannot issue fresh units post-NFO and must provide listing on stock exchanges."
          ]
        },
        {
          "chapterNumber": 3,
          "title": "Legal and Regulatory Framework",
          "moduleNumber": 1,
          "moduleTitle": "Mutual Fund Principles, Structure & Regulations",
          "weightage": "10% (10 Qs)",
          "overview": "Three-tier trust structure: Sponsor, Board of Trustees, Asset Management Company (AMC), Custodian, and Registrar & Transfer Agent (RTA). Role of SEBI, AMFI, and Code of Conduct.",
          "keyConcepts": [
            "Sponsor: Creator of the mutual fund; must hold at least 40% net worth of the AMC and have a 5-year track record",
            "Trustees: Fiduciary guardians of unitholders' funds; at least two-thirds (66.6%) of trustee directors must be independent",
            "AMC: Executes day-to-day fund management; at least 50% of AMC directors must be independent",
            "Custodian: Holds physical and demat securities in safe custody; must be completely independent of the AMC"
          ],
          "formulas": [],
          "highYieldTips": [
            "Trustees hold custody of property in trust for unitholders; AMC cannot be a trustee of any other mutual fund.",
            "SEBI requires 2/3rd of Trustees and 1/2 of AMC Board to be independent directors."
          ]
        },
        {
          "chapterNumber": 4,
          "title": "Scheme Related Information",
          "moduleNumber": 1,
          "moduleTitle": "Mutual Fund Principles, Structure & Regulations",
          "weightage": "8% (8 Qs)",
          "overview": "Mandatory offer documents: Scheme Information Document (SID), Statement of Additional Information (SAI), and Key Information Memorandum (KIM). Updating cycles and fundamental attribute changes.",
          "keyConcepts": [
            "SID: Contains scheme-specific details, investment objective, asset allocation pattern, and fees",
            "SAI: Contains statutory information about the Sponsor, AMC, Trustees, and legal procedures",
            "KIM: Abridged summary of SID and SAI; must be attached to every physical and digital application form",
            "Fundamental Attribute Change: Requires 30 days notice to unitholders with an exit window at prevailing NAV without exit load"
          ],
          "formulas": [],
          "highYieldTips": [
            "Every application form must mandatorily be accompanied by the Key Information Memorandum (KIM).",
            "Fundamental attribute change gives a 30-day load-free exit window to unitholders who disagree."
          ]
        },
        {
          "chapterNumber": 5,
          "title": "Fund Distribution and Channel Management Practices",
          "moduleNumber": 1,
          "moduleTitle": "Mutual Fund Principles, Structure & Regulations",
          "weightage": "7% (7 Qs)",
          "overview": "Distribution channels (individual IFAs, NDs, banks, fintech platforms), AMFI Registration Number (ARN), EUIN, commission model (trail only), code of conduct, and transaction charges.",
          "keyConcepts": [
            "ARN: Unique identifier issued by AMFI upon clearing NISM Series V-A; valid for 3 years",
            "EUIN: Employee Unique Identification Number for sales staff interacting with investors",
            "Upfront commission is completely banned by SEBI; all distributor remuneration is on a pure trail basis",
            "Transaction charge: \u20b9150 for first-time mutual fund investor, \u20b9100 for existing investor on subscriptions >= \u20b910,000"
          ],
          "formulas": [],
          "highYieldTips": [
            "No upfront commission is permitted in Indian mutual funds; only full trail commission is allowed.",
            "EUIN must be quoted even in execution-only trades to prevent unauthorized mis-selling."
          ]
        },
        {
          "chapterNumber": 6,
          "title": "Net Asset Value, Total Expense Ratio and Pricing of Units",
          "moduleNumber": 1,
          "moduleTitle": "Mutual Fund Principles, Structure & Regulations",
          "weightage": "14% (14 Qs)",
          "overview": "Daily NAV computation, valuation of listed and unlisted debt/equity securities, SEBI TER caps based on AUM slabs, additional 30 bps for B-30 cities, cut-off timings for liquid and equity funds.",
          "keyConcepts": [
            "TER Slabs: First \u20b9500 Cr (2.25% equity / 2.00% debt), decreasing in tiers as AUM grows",
            "Cut-off time for liquid/overnight funds: 1:30 PM (historical NAV applicable)",
            "Cut-off time for equity/debt other schemes: 3:00 PM with realization of funds prerequisite",
            "Realization Principle: All purchase transactions get the NAV of the day funds are realized in the AMC bank account before 3:00 PM"
          ],
          "formulas": [
            {
              "name": "Total Expense Ratio (TER)",
              "formula": "TER = (Total Operating Expenses / Average Daily Net Assets) * 100",
              "explanation": "SEBI capped annualized percentage deducted daily from scheme assets."
            }
          ],
          "highYieldTips": [
            "Fund realization before 3:00 PM is compulsory for all subscriptions irrespective of amount to get same-day NAV.",
            "Liquid and overnight funds have a 1:30 PM cut-off time."
          ]
        }
      ]
    },
    {
      "moduleNumber": 2,
      "title": "Taxation, Operations, Performance & Financial Planning",
      "weightagePercentage": 45,
      "chapters": [
        {
          "chapterNumber": 7,
          "title": "Taxation and Budget 2024 Updates",
          "moduleNumber": 2,
          "moduleTitle": "Taxation, Operations, Performance & Financial Planning",
          "weightage": "10% (10 Qs)",
          "overview": "Post-Budget 2024 capital gains regime: Equity LTCG (12.5% above \u20b91.25L exemption), Equity STCG (20%), Debt funds post-April 2023 (taxed at slab rate), Securities Transaction Tax (STT), TDS on NRI redemptions.",
          "keyConcepts": [
            "Equity-Oriented Fund: >= 65% in domestic listed equities",
            "Budget 2024 Equity LTCG: Holding > 12 months, taxed at 12.5% on gains exceeding \u20b91,25,000 per financial year",
            "Budget 2024 Equity STCG: Holding <= 12 months, taxed at flat 20%",
            "Debt Funds (>65% debt): Taxed as short-term capital gains at investor's slab rate without indexation"
          ],
          "formulas": [
            {
              "name": "Taxable Equity LTCG",
              "formula": "Tax = Max(0, Capital Gains - \u20b91,25,000) * 12.5%",
              "explanation": "Effective from July 23, 2024."
            }
          ],
          "highYieldTips": [
            "CRITICAL BUDGET 2024 EXAM UPDATE: Equity LTCG is now 12.5% with \u20b91.25L threshold (previously 10% above \u20b91L).",
            "Equity STCG is now 20% (previously 15%)."
          ]
        },
        {
          "chapterNumber": 8,
          "title": "Investor Services",
          "moduleNumber": 2,
          "moduleTitle": "Taxation, Operations, Performance & Financial Planning",
          "weightage": "7% (7 Qs)",
          "overview": "KYC processes (CKYC, KRA, eKYC), PAN mandate, nomination rules, bank mandate verification, power of attorney, transmission vs transfer of units, grievance redressal (SCORES 2.0).",
          "keyConcepts": [
            "KYC is mandatory for all mutual fund transactions; PAN is the sole universal identifier",
            "Nomination: Up to 3 nominees permitted with defined percentage allocation summing to 100%",
            "Transmission: Transfer of units to nominee/legal heir upon death of unitholder without triggering capital gains tax",
            "SEBI SCORES 2.0: Online complaint redressal platform; AMC must resolve within 21 calendar days"
          ],
          "formulas": [],
          "highYieldTips": [
            "Nominee is only a trustee of the estate, not the legal owner if a Will specifies otherwise.",
            "Transmission of units upon death does not attract capital gains tax until the recipient redeems."
          ]
        },
        {
          "chapterNumber": 9,
          "title": "Risk, Return and Performance of Funds",
          "moduleNumber": 2,
          "moduleTitle": "Taxation, Operations, Performance & Financial Planning",
          "weightage": "10% (10 Qs)",
          "overview": "Measures of return (Simple, CAGR, XIRR), risk metrics (Standard Deviation, Beta), risk-adjusted performance ratios (Sharpe, Treynor, Jensen's Alpha), Tracking Error, and benchmark comparison.",
          "keyConcepts": [
            "CAGR: Compound Annual Growth Rate for lump sum investments > 1 year",
            "XIRR: Extended Internal Rate of Return, standard for multiple irregular SIP cash flows",
            "Sharpe Ratio: Measures excess return per unit of Total Risk (Standard Deviation)",
            "Treynor Ratio: Measures excess return per unit of Systematic Risk (Beta)",
            "Alpha: Measure of fund manager outperformance relative to CAPM expected return"
          ],
          "formulas": [
            {
              "name": "Sharpe Ratio",
              "formula": "Sharpe = (R_p - R_f) / \\sigma_p",
              "explanation": "Higher is better. Uses total risk."
            },
            {
              "name": "Treynor Ratio",
              "formula": "Treynor = (R_p - R_f) / \\beta_p",
              "explanation": "Uses systematic risk (Beta)."
            },
            {
              "name": "Jensen's Alpha",
              "formula": "\\alpha = R_p - [R_f + \\beta_p * (R_m - R_f)]",
              "explanation": "Positive alpha indicates manager outperformance."
            }
          ],
          "highYieldTips": [
            "Sharpe uses Standard Deviation (total risk); Treynor uses Beta (systematic risk).",
            "For SIP returns, XIRR is the mandatory standard calculation metric."
          ]
        },
        {
          "chapterNumber": 10,
          "title": "Mutual Fund Scheme Selection",
          "moduleNumber": 2,
          "moduleTitle": "Taxation, Operations, Performance & Financial Planning",
          "weightage": "6% (6 Qs)",
          "overview": "Equity schemes (Large, Mid, Small, Flexi, Multi-cap, ELSS), Debt schemes (Liquid, Ultra-short, Short duration, Corporate bond, Gilt), Hybrid schemes (Aggressive, Balanced Advantage, Arbitrage), Solution schemes.",
          "keyConcepts": [
            "Large-Cap Fund: Minimum 80% in top 100 stocks by market cap",
            "Mid-Cap Fund: Minimum 65% in 101st to 250th stocks",
            "Small-Cap Fund: Minimum 65% in 251st stock onwards",
            "Flexi-Cap: Dynamic allocation across large, mid, small cap without fixed minimums",
            "ELSS: Equity Linked Savings Scheme with mandatory 3-year lock-in (qualifies for Section 80C under old tax regime)"
          ],
          "formulas": [],
          "highYieldTips": [
            "Flexi-Cap has 0% minimum in mid/small caps, whereas Multi-Cap has a strict 25% minimum in Large, 25% in Mid, and 25% in Small.",
            "Arbitrage funds hold long stock and short futures, qualifying for equity taxation with debt-like risk."
          ]
        },
        {
          "chapterNumber": 11,
          "title": "Financial Planning and Asset Allocation",
          "moduleNumber": 2,
          "moduleTitle": "Taxation, Operations, Performance & Financial Planning",
          "weightage": "6% (6 Qs)",
          "overview": "Life-cycle stages, goal setting (SMART goals), risk profiling (willingness vs ability to take risk), strategic vs tactical asset allocation, and systematic rebalancing.",
          "keyConcepts": [
            "Strategic Asset Allocation (SAA): Long-term policy portfolio based on investor risk profile and horizon",
            "Tactical Asset Allocation (TAA): Short-term opportunistic deviations to exploit market mispricings",
            "Risk tolerance is the lower of risk appetite (willingness) and risk capacity (ability)",
            "Rebalancing restores original asset weights, forcing investors to sell high and buy low"
          ],
          "formulas": [],
          "highYieldTips": [
            "If risk ability is Low but willingness is High, the advisor MUST prioritize ability (capacity) to safeguard financial solvency.",
            "Rebalancing enforces disciplined profit booking without emotional bias."
          ]
        },
        {
          "chapterNumber": 12,
          "title": "Helping Investors Choose the Right Schemes",
          "moduleNumber": 2,
          "moduleTitle": "Taxation, Operations, Performance & Financial Planning",
          "weightage": "6% (6 Qs)",
          "overview": "Mapping investor profile to scheme categories, evaluating fund performance against TRI benchmarks, analyzing risk-o-meter, avoiding recency bias, and ongoing portfolio monitoring.",
          "keyConcepts": [
            "Total Return Index (TRI): Mandatory benchmark that includes dividend payouts, giving realistic alpha comparison",
            "Risk-o-meter: 6 risk tiers (Low, Low to Moderate, Moderate, Moderately High, High, Very High) updated monthly",
            "Portfolio Overlap: Checking correlation between schemes to prevent false diversification",
            "Behavioral Biases: Loss aversion, herd mentality, anchoring, and recency bias"
          ],
          "formulas": [],
          "highYieldTips": [
            "SEBI mandates bench-marking against Total Returns Index (TRI), not Price Return Index (PRI).",
            "Risk-o-meter must be evaluated on a monthly basis by AMCs based on actual underlying portfolio risk."
          ]
        }
      ]
    }
  ]
};

export const NISM_IV_CURRICULUM: NismCourseCurriculum = {
  "courseId": "nism-iv",
  "seriesCode": "NISM-SERIES-IV",
  "title": "NISM Series IV: Interest Rate Derivatives Certification Examination",
  "description": "SEBI mandated benchmark certification for approved users and sales personnel of trading members in the Interest Rate Derivatives segment. Comprehensive coverage across all 10 official chapters.",
  "totalModules": 3,
  "totalChapters": 10,
  "totalQuestionsExam": 100,
  "examDurationMinutes": 120,
  "passingPercentage": 60,
  "negativeMarkingPercentage": 25,
  "modules": [
    {
      "moduleNumber": 1,
      "title": "Module 1: Fixed Income Markets & Money Market Instruments",
      "weightagePercentage": 30,
      "chapters": [
        {
          "chapterNumber": 1,
          "moduleNumber": 1,
          "moduleTitle": "Fixed Income Markets & Money Market Instruments",
          "title": "Introduction to Fixed Income Markets",
          "weightage": "10% (10 Qs)",
          "overview": "Structure of the Indian government securities market, G-Secs, SDLs, primary issuance on E-Kuber, secondary trading on NDS-OM, and CCIL clearing infrastructure.",
          "keyConcepts": [
            "Central Government dated securities and State Development Loans (SDLs)",
            "Primary auctions: Price-based (re-openings) vs Yield-based (new issuances)",
            "Non-competitive bidding facility reserves up to 5% of notified amount for retail investors",
            "Actual/Actual day count convention officially used for Indian sovereign debt",
            "Clean Market Price vs Dirty Price (Dirty Price = Clean Price + Accrued Interest)",
            "STRIPS separates coupon and principal cash flows into independent zero-coupon securities"
          ],
          "formulas": [
            {
              "name": "Dirty Price",
              "formula": "Dirty Price = Clean Market Price + Accrued Interest",
              "explanation": "Actual cash amount paid by bond buyer to bond seller at settlement."
            }
          ],
          "highYieldTips": [
            "SDLs trade at a positive yield spread of 30 to 70 bps above Central G-Secs due to state fiscal variances and lower secondary liquidity.",
            "CCIL acts as Central Counterparty (CCP) with legal novation for all trades on NDS-OM."
          ]
        },
        {
          "chapterNumber": 2,
          "moduleNumber": 1,
          "moduleTitle": "Fixed Income Markets & Money Market Instruments",
          "title": "Interest Rate Basics & Money Market Instruments",
          "weightage": "10% (10 Qs)",
          "overview": "Treasury bills (91D, 182D, 364D), Commercial Paper, Certificates of Deposit, Call/Notice/Term money, Triparty Repo (TREPS), and term structure theories.",
          "keyConcepts": [
            "T-Bills are zero-coupon instruments issued at a discount to par face value (\u20b9100)",
            "CP and CD minimum denomination is \u20b95 Lakhs and in multiples of \u20b95 Lakhs",
            "Money market tenors: Call Money (1 day/overnight), Notice Money (2-14 days), Term Money (>14 days)",
            "FBIL calculates and administers benchmark fixings including Overnight MIBOR",
            "Yield curve theories: Expectations Hypothesis, Liquidity Preference, Market Segmentation",
            "Yield curve shifts: Bear Flattening (short rates rise faster), Bull Steepening (short rates fall faster)"
          ],
          "formulas": [
            {
              "name": "T-Bill Annualized Yield",
              "formula": "Yield = [(Face Value - Price) / Price] * (365 / D) * 100",
              "explanation": "Calculates the annualized money market yield of a Treasury Bill on a 365-day basis."
            }
          ],
          "highYieldTips": [
            "Treasury bills are issued only in 91-day, 182-day, and 364-day tenors by the Government of India.",
            "Global markets transitioned from LIBOR to SOFR (Secured Overnight Financing Rate) based on overnight Treasury repo."
          ]
        },
        {
          "chapterNumber": 3,
          "moduleNumber": 1,
          "moduleTitle": "Fixed Income Markets & Money Market Instruments",
          "title": "Bond Valuation & Pricing Mechanics",
          "weightage": "10% (10 Qs)",
          "overview": "Discounted cash flow valuation, coupon vs YTM relationship, clean vs dirty price, Current Yield, Yield to Call (YTC), and spot curve bootstrapping.",
          "keyConcepts": [
            "When Coupon < YTM, bond trades at a Discount; when Coupon > YTM, bond trades at a Premium",
            "YTM assumes all intermediate coupons are reinvested at the same YTM until maturity",
            "Current Yield = (Annual Coupon / Clean Market Price) * 100",
            "Yield to Call (YTC) is the primary return metric when a callable bond trades at a high premium",
            "Bootstrapping recursively extracts spot discount rates from a sequence of coupon bond prices"
          ],
          "formulas": [
            {
              "name": "Accrued Interest",
              "formula": "Accrued Interest = (Annual Coupon / 2) * (Days Elapsed / Days in Period)",
              "explanation": "Calculates interest earned since the last semi-annual coupon date."
            },
            {
              "name": "Forward Rate Derivation",
              "formula": "(1 + s2)^2 = (1 + s1) * (1 + 1f1)",
              "explanation": "Calculates the forward rate between two spot rate maturities."
            }
          ],
          "highYieldTips": [
            "Price and yield have an inverse, convex relationship for all option-free sovereign bonds.",
            "Accrued interest resets to zero immediately upon coupon payment date."
          ]
        }
      ]
    },
    {
      "moduleNumber": 2,
      "title": "Module 2: Bond Risks, Valuation & OTC Derivatives",
      "weightagePercentage": 20,
      "chapters": [
        {
          "chapterNumber": 4,
          "moduleNumber": 2,
          "moduleTitle": "Bond Risks, Valuation & OTC Derivatives",
          "title": "Bond Risks, Duration & Convexity",
          "weightage": "10% (10 Qs)",
          "overview": "Macaulay Duration, Modified Duration, price sensitivity, DV01/PVBP, convexity, and negative convexity in callable bonds.",
          "keyConcepts": [
            "For a zero-coupon bond, Macaulay Duration is strictly equal to its term to maturity",
            "Modified Duration measures percentage price change for a 100 bps (1%) change in yield",
            "Higher coupon bonds have lower duration because cash flows are received earlier",
            "Positive convexity causes bond prices to rise more when yields drop than they fall when yields rise",
            "Callable bonds exhibit negative convexity at low yields due to the price ceiling of the call strike"
          ],
          "formulas": [
            {
              "name": "Modified Duration",
              "formula": "Modified Duration = Macaulay Duration / (1 + YTM / m)",
              "explanation": "Direct price percentage sensitivity per unit change in yield."
            },
            {
              "name": "Portfolio DV01",
              "formula": "DV01 = Market Value * Modified Duration * 0.0001",
              "explanation": "Rupee gain or loss for a 1 basis point (0.01%) shift in yield."
            }
          ],
          "highYieldTips": [
            "Modified duration underestimates bond price increases and overestimates bond price declines without convexity adjustment.",
            "DV01 is also known as PVBP (Price Value of a Basis Point)."
          ]
        },
        {
          "chapterNumber": 5,
          "moduleNumber": 2,
          "moduleTitle": "Bond Risks, Valuation & OTC Derivatives",
          "title": "OTC Interest Rate Derivatives (FRAs, IRS, OIS)",
          "weightage": "10% (10 Qs)",
          "overview": "Forward Rate Agreements (FRAs), plain-vanilla Interest Rate Swaps (IRS), Overnight Indexed Swaps (OIS), ISDA documentation, and CCIL trade reporting.",
          "keyConcepts": [
            "In an AxB FRA, agreement begins in A months and ends in B months (covering B - A months)",
            "FRA payoffs are settled upfront at start of loan period and must be discounted",
            "Payer Swap (Pay Fixed, Receive Floating) hedges against rising borrowing costs",
            "Receiver Swap (Pay Floating, Receive Fixed) locks in fixed yield in declining rate environments",
            "At inception, an IRS has a net present value of zero (fair swap rate)",
            "All OTC interest rate derivatives must be reported to the CCIL Trade Reporting Platform"
          ],
          "formulas": [
            {
              "name": "FRA Settlement Payoff",
              "formula": "Settlement = [Notional * (Reference - Fixed) * (d / 360)] / [1 + Reference * (d / 360)]",
              "explanation": "Cash settlement received by FRA buyer on effective start date."
            }
          ],
          "highYieldTips": [
            "Principal is never exchanged in a standard IRS; only periodic net interest differences are settled.",
            "ISDA Master Agreement standardizes bilateral OTC derivatives and close-out netting."
          ]
        }
      ]
    },
    {
      "moduleNumber": 3,
      "title": "Module 3: Exchange Traded IRF, Options, Strategies & Regulations",
      "weightagePercentage": 50,
      "chapters": [
        {
          "chapterNumber": 6,
          "moduleNumber": 3,
          "moduleTitle": "Exchange Traded IRF, Options, Strategies & Regulations",
          "title": "Exchange Traded Interest Rate Futures (IRF Specifications)",
          "weightage": "10% (10 Qs)",
          "overview": "Contract specifications of 10-Year GoI IRF and 91-Day T-Bill futures, contract size (\u20b92 Lakhs), tick size (\u20b90.0025), expiry cycles, and delivery settlement.",
          "keyConcepts": [
            "Contract value of 10-Year GoI IRF is \u20b92,00,000 (2,000 units of \u20b9100 face value)",
            "Tick size is \u20b90.0025, giving a tick value of \u20b95.00 per contract",
            "Trading hours: 9:00 AM to 5:00 PM on business days",
            "Expiry: Last Thursday of the expiry month (or preceding trading day if holiday)",
            "Underlying is a notional 10-year GoI bond with 6.00% p.a. semi-annual coupon",
            "Deliverable basket: Sovereign GoI bonds with residual maturity between 8 and 11 years"
          ],
          "formulas": [
            {
              "name": "Tick Value",
              "formula": "Tick Value = Tick Size (\u20b90.0025) * Contract Units (2,000) = \u20b95.00",
              "explanation": "Minimum rupee change in contract value per price tick."
            }
          ],
          "highYieldTips": [
            "91-Day T-Bill futures are quoted as (100 - Discount Yield).",
            "The short seller holds the Delivery Option (which bond to deliver and when during delivery window)."
          ]
        },
        {
          "chapterNumber": 7,
          "moduleNumber": 3,
          "moduleTitle": "Exchange Traded IRF, Options, Strategies & Regulations",
          "title": "Pricing & Valuation of Interest Rate Futures",
          "weightage": "10% (10 Qs)",
          "overview": "Cost of carry model, Conversion Factor (CF), Invoice Price, Gross Basis, Net Basis, Cheapest-to-Deliver (CTD) bond, and Implied Repo Rate (IRR).",
          "keyConcepts": [
            "Futures Price = Spot Clean Price + Financing Cost - Coupon Income",
            "Conversion Factor is the clean price of \u20b91 face value to yield 6% on delivery month start",
            "Invoice Price = (Futures Settlement Price * Conversion Factor) + Accrued Interest",
            "Gross Basis = Spot Clean Price - (Futures Price * Conversion Factor)",
            "CTD bond is the deliverable bond that maximizes IRR or minimizes Net Basis",
            "When yields > 6%, high coupon bonds tend to become CTD; when yields < 6%, low coupon bonds become CTD"
          ],
          "formulas": [
            {
              "name": "Invoice Price",
              "formula": "Invoice Price = (Futures Settlement Price * Conversion Factor) + Accrued Interest",
              "explanation": "Total cash paid per bond upon physical delivery."
            },
            {
              "name": "Gross Basis",
              "formula": "Gross Basis = Spot Price - (Futures Price * Conversion Factor)",
              "explanation": "Basis between cash bond and conversion-factor adjusted futures."
            }
          ],
          "highYieldTips": [
            "At contract expiration, the gross basis of the CTD bond converges to zero (Basis Convergence).",
            "When futures are overpriced (Futures > Theoretical Value), execute Cash-and-Carry Arbitrage."
          ]
        },
        {
          "chapterNumber": 8,
          "moduleNumber": 3,
          "moduleTitle": "Exchange Traded IRF, Options, Strategies & Regulations",
          "title": "Exchange Traded Interest Rate Options (IRO)",
          "weightage": "10% (10 Qs)",
          "overview": "Option contract specifications, European style exercise, Call & Put payoffs, Intrinsic value vs Time value, and option Greeks (Delta, Gamma, Vega, Theta, Rho).",
          "keyConcepts": [
            "Interest Rate Options in India follow European style exercise (exercised only on expiry)",
            "Call Option on Bond Price profits when interest rates fall (bond prices rise)",
            "Put Option on Bond Price profits when interest rates rise (economically equivalent to Call on Rate)",
            "Delta measures price sensitivity to underlying bond; Vega measures volatility sensitivity",
            "Theta measures time decay; option buyers experience daily time value erosion"
          ],
          "formulas": [
            {
              "name": "Call Intrinsic Value",
              "formula": "Call Intrinsic Value = Max(0, Spot Price - Strike Price)",
              "explanation": "Inherent value if exercised immediately."
            },
            {
              "name": "Put Intrinsic Value",
              "formula": "Put Intrinsic Value = Max(0, Strike Price - Spot Price)",
              "explanation": "Inherent value of put option."
            }
          ],
          "highYieldTips": [
            "A Bond Put Option is economically equivalent to an Interest Rate Call Option.",
            "Total Option Premium = Intrinsic Value + Extrinsic (Time) Value."
          ]
        },
        {
          "chapterNumber": 9,
          "moduleNumber": 3,
          "moduleTitle": "Exchange Traded IRF, Options, Strategies & Regulations",
          "title": "Trading, Hedging & Arbitrage Strategies",
          "weightage": "10% (10 Qs)",
          "overview": "Target duration hedging, Short Hedge, Long Hedge, DV01 matching, Basis Risk, Cross-Hedging, Curve Flattener, Curve Steepener, and Butterfly trades.",
          "keyConcepts": [
            "Short Hedge: Sells IRF contracts to protect existing bond portfolio against rising interest rates",
            "Long Hedge: Buys IRF contracts to lock in investment yields for future cash inflows",
            "Target Duration formula calculates exact number of IRF contracts to achieve portfolio duration goal",
            "Curve Flattener: Long long-term contracts, Short short-term contracts",
            "Curve Steepener: Short long-term contracts, Long short-term contracts",
            "Cross-hedging corporate bonds with G-Sec IRFs introduces Credit Spread risk"
          ],
          "formulas": [
            {
              "name": "Target Duration Contracts",
              "formula": "N = [(Target Duration - Portfolio Duration) * Portfolio Value] / [Futures Duration * Futures Value]",
              "explanation": "Calculates number of futures contracts needed to adjust portfolio duration."
            },
            {
              "name": "DV01 Hedge Ratio",
              "formula": "Hedge Ratio = (DV01_portfolio / DV01_ctd) * CF_ctd",
              "explanation": "Optimal contract ratio to match absolute rupee price sensitivity."
            }
          ],
          "highYieldTips": [
            "Basis risk occurs when spot-futures relationship changes unexpectedly over the hedge horizon.",
            "CTD switching occurs when yield movements shift the cheapest bond, changing futures duration."
          ]
        },
        {
          "chapterNumber": 10,
          "moduleNumber": 3,
          "moduleTitle": "Exchange Traded IRF, Options, Strategies & Regulations",
          "title": "Clearing, Settlement, Risk Management & Regulations",
          "weightage": "10% (10 Qs)",
          "overview": "Joint regulatory framework of RBI and SEBI, SPAN margining, Extreme Loss Margin (ELM), daily MTM cash settlement, position limits, FEMA guidelines, and code of conduct.",
          "keyConcepts": [
            "RBI regulates money markets & G-Secs; SEBI regulates exchange-traded derivatives",
            "SPAN calculates initial margin across 16 simulated market risk scenarios",
            "Extreme Loss Margin (ELM) covers tail risk beyond 99% SPAN confidence level",
            "Mark-to-market (MTM) margin is settled daily on a T+1 cash settlement basis",
            "Client position limits: 3% of total open interest or \u20b9200 Crores, whichever is higher",
            "Trading Member / MF scheme position limits: 10% of total open interest or \u20b91,200 Crores",
            "Front running is strictly prohibited under SEBI PFUTP regulations with severe penalties",
            "Intermediaries must preserve books and trade audit trails for a minimum of 5 years"
          ],
          "formulas": [
            {
              "name": "Client Position Limit",
              "formula": "Max Position = Max(3% of Total Open Interest, \u20b9200 Crores)",
              "explanation": "Statutory limit on gross open position for a single client."
            }
          ],
          "highYieldTips": [
            "Legal novation by NSCCL/ICCL ensures clearing corporation acts as CCP, eliminating bilateral credit risk.",
            "FPIs are permitted to participate in IRFs subject to overall aggregate debt ceilings monitored by RBI/SEBI."
          ]
        }
      ]
    }
  ]
};

class NismCurriculumService {
	private curriculumCache: Map<string, NismCourseCurriculum> = new Map();

	/**
	 * Retrieve curriculum and chapter study guide for any NISM course
	 */
	getCurriculum(courseId: string): NismCourseCurriculum | null {
		const cId = (courseId || "").toLowerCase().trim();
		if (cId === "nism-vd" || cId === "nism-series-v-d") {
			return NISM_VD_CURRICULUM;
		}
		if (cId === "nism-va" || cId === "nism-series-v-a") {
			return NISM_VA_CURRICULUM;
		}
		if (cId === "nism-iv" || cId === "nism-series-iv") {
			return NISM_IV_CURRICULUM;
		}

		if (this.curriculumCache.has(cId)) {
			return this.curriculumCache.get(cId)!;
		}

		// Match course from DEFAULT_COURSES
		const course = DEFAULT_COURSES.find(
			(c) =>
				c.id.toLowerCase() === cId ||
				c.seriesCode.toLowerCase() === cId ||
				c.seriesCode
					.toLowerCase()
					.replace(/nism-series-?/i, "")
					.replace(/-/g, "") ===
					cId
						.replace(/nism-series-?/i, "")
						.replace(/nism-?/i, "")
						.replace(/-/g, ""),
		);

		if (!course) {
			return null;
		}

		const synthesized = this.synthesizeCurriculumForCourse(course);
		this.curriculumCache.set(cId, synthesized);
		this.curriculumCache.set(course.id.toLowerCase(), synthesized);
		return synthesized;
	}

	/**
	 * Retrieve single chapter notes and exam guide
	 */
	getChapter(courseId: string, chapterNumber: number): NismCurriculumChapter | null {
		const curr = this.getCurriculum(courseId);
		if (!curr) return null;
		for (const mod of curr.modules) {
			const found = mod.chapters.find((ch) => ch.chapterNumber === chapterNumber);
			if (found) return found;
		}
		return null;
	}

	/**
	 * Synthesizes an accredited curriculum blueprint from questions & course metadata
	 */
	private synthesizeCurriculumForCourse(course: NismCourse): NismCourseCurriculum {
		const questions = NISM_PRACTICE_BANK.filter(
			(q) => q.courseId.toLowerCase() === course.id.toLowerCase(),
		);

		// Group questions by chapter
		const chapterMap = new Map<
			number,
			{
				title: string;
				topic: string;
				questions: typeof questions;
			}
		>();

		for (const q of questions) {
			const chNum = (q as any).chapter || (q as any).chapterNumber || 1;
			const topicName = (q as any).chapterTitle || q.topic || `Chapter ${chNum}`;
			if (!chapterMap.has(chNum)) {
				chapterMap.set(chNum, {
					title: topicName,
					topic: q.topic || topicName,
					questions: [],
				});
			}
			chapterMap.get(chNum)!.questions.push(q);
		}

		const chapters: NismCurriculumChapter[] = [];
		const sortedChapterNums = Array.from(chapterMap.keys()).sort((a, b) => a - b);

		if (sortedChapterNums.length > 0) {
			for (const chNum of sortedChapterNums) {
				const chData = chapterMap.get(chNum)!;
				const chQuestions = chData.questions;

				const keyConcepts: string[] = [];
				const formulas: NismFormulaItem[] = [];
				const highYieldTips: string[] = [];

				for (const q of chQuestions) {
					if (q.explanation && q.explanation.length > 15) {
						keyConcepts.push(q.explanation);
					}
					if (
						q.explanation &&
						(q.explanation.includes("=") ||
							q.explanation.includes("Ratio") ||
							q.explanation.includes("Margin") ||
							q.explanation.includes("Yield") ||
							q.explanation.includes("Basis") ||
							q.explanation.includes("Duration") ||
							q.explanation.includes("Value at Risk"))
					) {
						const parts = q.explanation.split(/[.;]/);
						formulas.push({
							name: `${chData.title} Principle`,
							formula: parts[0].trim(),
							explanation: q.explanation,
						});
					}
					if (
						q.explanation &&
						(q.explanation.includes("SEBI") ||
							q.explanation.includes("mandat") ||
							q.explanation.includes("penalt") ||
							q.explanation.includes("minimum") ||
							q.explanation.includes("maximum") ||
							q.explanation.includes("limit") ||
							q.explanation.includes("Rule") ||
							q.explanation.includes("Section"))
					) {
						highYieldTips.push(q.explanation);
					}
				}

				if (keyConcepts.length === 0) {
					keyConcepts.push(
						`Comprehensive regulatory framework and statutory standards for ${chData.title}.`,
						`Operational mechanisms, documentation, and compliance obligations.`,
						`Market best practices, investor risk disclosures, and ethical code of conduct.`,
					);
				}
				if (highYieldTips.length === 0) {
					highYieldTips.push(
						`Master the statutory cutoff timings, penalty thresholds, and mandatory SEBI circulars for ${chData.title}.`,
						`Pay close attention to numerical ratios, registration requirements, and exemption criteria.`,
					);
				}

				const moduleNumber = chNum <= 3 ? 1 : chNum <= 6 ? 2 : 3;
				const moduleTitle =
					moduleNumber === 1
						? "Module 1: Regulatory & Market Framework"
						: moduleNumber === 2
						? "Module 2: Products, Valuation & Operations"
						: "Module 3: Compliance, Risk Management & Code of Conduct";

				chapters.push({
					chapterNumber: chNum,
					title: chData.title,
					moduleNumber,
					moduleTitle,
					weightage: `${Math.round(100 / Math.max(1, sortedChapterNums.length))}% (~${Math.max(2, Math.round((course.totalPracticeQuestions || 100) / Math.max(1, sortedChapterNums.length)))} Qs)`,
					overview: `In-depth examination coverage of ${chData.title} under ${course.seriesCode}. Focuses on SEBI regulations, market execution mechanics, risk controls, and practical intermediary competencies.`,
					keyConcepts: Array.from(new Set(keyConcepts)).slice(0, 6),
					formulas: formulas.slice(0, 3),
					highYieldTips: Array.from(new Set(highYieldTips)).slice(0, 4),
				});
			}
		} else {
			// Fallback standard chapters based on course syllabus blueprint
			const defaultChapterTitles = [
				"Introduction to Market Structure & Regulatory Authorities",
				"Products, Instruments and Asset Class Characteristics",
				"Operational Processes, Clearing, Settlement & Depository Interface",
				"Risk Management, Surveillance, Margining & Investor Protection",
				"Legal Framework, Code of Conduct & SEBI Compliance Obligations",
			];

			defaultChapterTitles.forEach((title, idx) => {
				const chNum = idx + 1;
				const moduleNumber = chNum <= 2 ? 1 : chNum <= 4 ? 2 : 3;
				const moduleTitle =
					moduleNumber === 1
						? "Module 1: Regulatory & Market Framework"
						: moduleNumber === 2
						? "Module 2: Operations & Product Mechanics"
						: "Module 3: Risk, Compliance & Ethics";

				chapters.push({
					chapterNumber: chNum,
					title,
					moduleNumber,
					moduleTitle,
					weightage: `${Math.round(100 / defaultChapterTitles.length)}%`,
					overview: `Covers ${title} in alignment with official ${course.seriesCode} test objectives and SEBI regulatory standards.`,
					keyConcepts: [
						`Statutory framework and regulatory guidelines administered by SEBI and market infrastructure institutions.`,
						`Operational best practices and intermediary responsibilities.`,
						`Investor protection, risk mitigation, and fair dealing codes.`,
					],
					highYieldTips: [
						`Ensure thorough understanding of regulatory compliance guidelines and mandatory reporting timelines.`,
					],
				});
			});
		}

		// Group chapters into modules
		const moduleMap = new Map<number, NismCurriculumModule>();
		for (const ch of chapters) {
			if (!moduleMap.has(ch.moduleNumber)) {
				moduleMap.set(ch.moduleNumber, {
					moduleNumber: ch.moduleNumber,
					title: ch.moduleTitle,
					weightagePercentage: 0,
					chapters: [],
				});
			}
			moduleMap.get(ch.moduleNumber)!.chapters.push(ch);
		}

		const modules = Array.from(moduleMap.values());
		const totalChapters = chapters.length;
		for (const mod of modules) {
			mod.weightagePercentage = Math.round((mod.chapters.length / totalChapters) * 100);
		}

		return {
			courseId: course.id,
			seriesCode: course.seriesCode,
			title: course.title,
			description: course.description,
			totalModules: modules.length,
			totalChapters,
			totalQuestionsExam: course.totalPracticeQuestions || 100,
			examDurationMinutes: course.durationHours * 6 || 120,
			passingPercentage: course.passingPercentage || 60,
			negativeMarkingPercentage: course.negativeMarking ? course.negativeMarking * 100 : 25,
			modules,
		};
	}
}

export const nismCurriculumService = new NismCurriculumService();

