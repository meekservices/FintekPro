/**
 * NISM E-Learning LMS Integration Service (LTI 1.3 / xAPI / SCORM)
 * 
 * Complies with FintekPro Global Coding Rules (GCR v1.0):
 * - Layered Architecture: /services -> /data
 * - Zero Trust: Validates all xAPI statements and LTI requests
 * - Stateless & Resilient: Deterministic fallback and self-healing DB initialization
 * - Structured audit logging: { event, userId, latency_ms, status }
 */

import { db } from "../db";
import { sql } from "drizzle-orm";
import crypto from "crypto";
import { aiService, AICapability } from "./ai-service";
import { logger } from "../logger";

export interface NismCourse {
	id: string;
	seriesCode: string;
	title: string;
	description: string;
	cpeCredits: number;
	durationHours: number;
	passingPercentage: number;
	examFeeInr: number;
	category: string;
	syllabusUrl?: string;
	ltiResourceLinkId: string;
	isActive: boolean;
}

export interface AgentCourseProgress {
	courseId: string;
	seriesCode: string;
	title: string;
	category: string;
	cpeCredits: number;
	durationHours: number;
	passingPercentage?: number;
	examFeeInr?: number;
	syllabusUrl?: string;
	status: "unregistered" | "enrolled" | "in_progress" | "completed" | "certified";
	progressPercentage: number;
	lastScore?: number | null;
	cpeCreditsEarned: number;
	certificateUrl?: string | null;
	certificateNumber?: string | null;
	enrolledAt: string;
	completedAt?: string | null;
}

export interface LtiLaunchPayload {
	launchUrl: string;
	portalUrl: string;
	certificationsUrl: string;
	syllabusUrl?: string;
	idToken: string;
	state: string;
	courseTitle: string;
	seriesCode?: string;
	agentName?: string;
	agentEmail?: string;
	passingPercentage?: number;
	examFeeInr?: number;
	cpeCredits?: number;
	launchParams?: {
		id_token: string;
		state: string;
		lti_message_type: string;
		lti_version: string;
		target_link_uri: string;
	};
}

export interface XApiStatement {
	actor: {
		mbox?: string;
		account?: {
			homePage: string;
			name: string; // FintekPro agentId
		};
		name?: string;
	};
	verb: {
		id: string; // http://adlnet.gov/expapi/verbs/completed, passed, progressed
		display?: Record<string, string>;
	};
	object: {
		id: string; // Course URI containing series code
		definition?: {
			name?: Record<string, string>;
			description?: Record<string, string>;
		};
	};
	result?: {
		score?: {
			scaled?: number;
			raw?: number;
			min?: number;
			max?: number;
		};
		success?: boolean;
		completion?: boolean;
		duration?: string;
	};
	timestamp?: string;
}

const DEFAULT_COURSES: NismCourse[] = [
	{
		id: "nism-va",
		seriesCode: "NISM-SERIES-V-A",
		title: "NISM Series V-A: Mutual Fund Distributors Certification",
		description:
			"SEBI mandated certification for individuals distributing mutual fund schemes in India. Covers mutual fund structure, regulatory environment, and scheme evaluation.",
		cpeCredits: 6,
		durationHours: 25,
		passingPercentage: 50,
		examFeeInr: 1500,
		category: "Distribution",
		syllabusUrl: "https://www.nism.ac.in/mutual-fund-distributors",
		ltiResourceLinkId: "res-nism-va-2026",
		isActive: true,
	},
	{
		id: "nism-vd",
		seriesCode: "NISM-SERIES-V-D",
		title: "NISM Series V-D: Mutual Fund – Specialized Investment Fund (SIF) Distributors Certification",
		description:
			"SEBI mandated dual certification for distributors of Mutual Funds and Specialized Investment Funds (SIF). Authorizes distribution of both standard mutual fund schemes and specialized investment funds.",
		cpeCredits: 8,
		durationHours: 30,
		passingPercentage: 60,
		examFeeInr: 3000,
		category: "Distribution",
		syllabusUrl: "https://www.nism.ac.in/certification-exams/specialized-investment-fund-distributors",
		ltiResourceLinkId: "res-nism-vd-2026",
		isActive: true,
	},
	{
		id: "nism-viii",
		seriesCode: "NISM-SERIES-VIII",
		title: "NISM Series VIII: Equity Derivatives Certification",
		description:
			"Designed for approved users and sales personnel of trading members in the equity derivatives segment. Covers futures, options, and hedging strategies.",
		cpeCredits: 6,
		durationHours: 30,
		passingPercentage: 60,
		examFeeInr: 1500,
		category: "Trading",
		syllabusUrl: "https://www.nism.ac.in/equity-derivatives",
		ltiResourceLinkId: "res-nism-viii-2026",
		isActive: true,
	},
	{
		id: "nism-xiii",
		seriesCode: "NISM-SERIES-XIII",
		title: "NISM Series XIII: Common Derivatives Certification Examination",
		description:
			"Comprehensive SEBI mandated certification covering equity derivatives, currency derivatives, interest rate derivatives, and commodity derivatives segments under a single unified benchmark.",
		cpeCredits: 8,
		durationHours: 30,
		passingPercentage: 60,
		examFeeInr: 3000,
		category: "Trading",
		syllabusUrl: "https://www.nism.ac.in/common-derivatives-certification-examination",
		ltiResourceLinkId: "res-nism-xiii-2026",
		isActive: true,
	},
	{
		id: "nism-xa",
		seriesCode: "NISM-SERIES-X-A",
		title: "NISM Series X-A: Investment Adviser (Level 1) Certification",
		description:
			"SEBI RIA Level 1 certification establishing baseline competency in personal financial planning, asset allocation, and tax-efficient portfolio construction.",
		cpeCredits: 10,
		durationHours: 40,
		passingPercentage: 60,
		examFeeInr: 3000,
		category: "Advisory",
		syllabusUrl: "https://www.nism.ac.in/investment-adviser-level-1",
		ltiResourceLinkId: "res-nism-xa-2026",
		isActive: true,
	},
	{
		id: "nism-xb",
		seriesCode: "NISM-SERIES-X-B",
		title: "NISM Series X-B: Investment Adviser (Level 2) Certification",
		description:
			"Advanced SEBI RIA Level 2 certification covering complex estate planning, behavioral finance, portfolio rebalancing, and regulatory disclosures.",
		cpeCredits: 10,
		durationHours: 45,
		passingPercentage: 60,
		examFeeInr: 3000,
		category: "Advisory",
		syllabusUrl: "https://www.nism.ac.in/investment-advisors-level-2",
		ltiResourceLinkId: "res-nism-xb-2026",
		isActive: true,
	},
	{
		id: "nism-xv",
		seriesCode: "NISM-SERIES-XV",
		title: "NISM Series XV: Research Analyst Certification",
		description:
			"Mandatory qualification for registered Research Analysts (RA) and equity research associates preparing stock reports and target price valuations.",
		cpeCredits: 8,
		durationHours: 35,
		passingPercentage: 60,
		examFeeInr: 1500,
		category: "Research",
		syllabusUrl: "https://www.nism.ac.in/research-analyst-certification-examination",
		ltiResourceLinkId: "res-nism-xv-2026",
		isActive: true,
	},
	{
		id: "nism-xxia",
		seriesCode: "NISM-SERIES-XXI-A",
		title: "NISM Series XXI-A: Portfolio Management Services (PMS) Distributors",
		description:
			"Specialized certification for distributing discretionary and non-discretionary Portfolio Management Services (PMS) to HNIs under SEBI (PMS) Regulations.",
		cpeCredits: 6,
		durationHours: 20,
		passingPercentage: 60,
		examFeeInr: 1500,
		category: "Distribution",
		syllabusUrl: "https://www.nism.ac.in/about-portfolio-management-services-pms-distributors-certification-examination",
		ltiResourceLinkId: "res-nism-xxia-2026",
		isActive: true,
	},
	{
		id: "nism-cpe-mf",
		seriesCode: "NISM-CPE-MF-REFRESHER",
		title: "NISM Continuing Professional Education (CPE) – Mutual Funds",
		description:
			"One-day online CPE program for revalidation of NISM Series V-A certification prior to ARN expiry. Fast-track compliance renewal.",
		cpeCredits: 8,
		durationHours: 12,
		passingPercentage: 100,
		examFeeInr: 2500,
		category: "CPE Refresher",
		syllabusUrl: "https://www.nism.ac.in/cpe-programmes/",
		ltiResourceLinkId: "res-nism-cpemf-2026",
		isActive: true,
	},
];

export interface NismPracticeQuestion {
	id: string;
	courseId: string;
	question: string;
	options: string[];
	correctIndex: number;
	explanation: string;
	topic: string;
}

export interface NismPracticeQuestionClient {
	id: string;
	question: string;
	options: string[];
	topic: string;
}

export interface NismTopicDiagnostic {
	topic: string;
	total: number;
	correct: number;
	incorrect: number;
	unanswered: number;
	accuracyPercentage: number;
	status: "Proficient" | "Satisfactory" | "Needs Review";
}

export interface NismAiRemediationCapsule {
	generated: boolean;
	weakTopics: string[];
	summaryNotes: string;
	recommendedAction: string;
}

export interface NismPracticeTestResult {
	success: boolean;
	courseId: string;
	courseTitle: string;
	seriesCode: string;
	totalQuestions: number;
	correctCount: number;
	incorrectCount: number;
	unansweredCount: number;
	penaltyPerWrong: number;
	negativeMarksDeducted: number;
	grossScore: number;
	netRawScore: number;
	scorePercentage: number;
	passingPercentage: number;
	passed: boolean;
	empanelmentSynced?: boolean;
	topicDiagnostics: NismTopicDiagnostic[];
	aiCapsule: NismAiRemediationCapsule;
	reviews: Array<{
		id: string;
		question: string;
		options: string[];
		selectedOptionIndex: number | null;
		correctOptionIndex: number;
		isCorrect: boolean;
		explanation: string;
		topic: string;
	}>;
}

const NISM_PRACTICE_BANK: NismPracticeQuestion[] = [
	// ==========================================
	// NISM Series V-A: Mutual Fund Distributors (15 Questions)
	// ==========================================
	{
		id: "nism-va-q1",
		courseId: "nism-va",
		question: "Which entity acts as the primary legal custodian and holds the assets of a mutual fund scheme in trust for unit holders in India?",
		options: ["Asset Management Company (AMC)", "Custodian registered with SEBI", "Board of Trustees / Trustee Company", "Association of Mutual Funds in India (AMFI)"],
		correctIndex: 1,
		explanation: "Under SEBI (Mutual Funds) Regulations, the Custodian is responsible for the safekeeping of the fund's securities and assets, operating independently of the AMC.",
		topic: "Mutual Fund Structure & Regulation"
	},
	{
		id: "nism-va-q2",
		courseId: "nism-va",
		question: "What is the cut-off timing for receiving purchase applications in Liquid & Overnight Funds for applicable NAV of the same day?",
		options: ["1:30 PM", "3:00 PM", "1:00 PM", "2:30 PM"],
		correctIndex: 0,
		explanation: "As per SEBI guidelines, the cut-off timing for historical NAV applicability on subscriptions in Liquid and Overnight funds is 1:30 PM (provided funds are available in the bank before cut-off).",
		topic: "Operational Guidelines & NAV"
	},
	{
		id: "nism-va-q3",
		courseId: "nism-va",
		question: "Under the SEBI categorisation of mutual fund schemes, what is the minimum percentage of total assets that an Equity Linked Savings Scheme (ELSS) must invest in equity instruments?",
		options: ["65%", "80%", "75%", "90%"],
		correctIndex: 1,
		explanation: "ELSS schemes must invest at least 80% of total assets in equity and equity-related instruments, with a statutory 3-year lock-in period qualifying under Section 80C.",
		topic: "Scheme Categorisation"
	},
	{
		id: "nism-va-q4",
		courseId: "nism-va",
		question: "Which of the following risk profiling metrics evaluates how much portfolio return is achieved per unit of total risk (standard deviation)?",
		options: ["Treynor Ratio", "Sharpe Ratio", "Jensen's Alpha", "Beta"],
		correctIndex: 1,
		explanation: "The Sharpe Ratio measures excess return over the risk-free rate divided by total risk (Standard Deviation), whereas Treynor uses systematic risk (Beta).",
		topic: "Portfolio Performance & Risk"
	},
	{
		id: "nism-va-q5",
		courseId: "nism-va",
		question: "What is the maximum Total Expense Ratio (TER) permissible for an open-ended equity scheme for the first ₹500 crores of daily net assets under SEBI regulations?",
		options: ["2.25%", "2.00%", "1.75%", "2.50%"],
		correctIndex: 0,
		explanation: "SEBI limits the base TER for the first ₹500 crores of daily net assets of an open-ended equity-oriented scheme to 2.25% (plus additional allowances for B-30 cities and GST).",
		topic: "Mutual Fund Expenses & Accounting"
	},
	{
		id: "nism-va-q6",
		courseId: "nism-va",
		question: "Under Section 112A of the Income Tax Act, long-term capital gains (LTCG) on equity mutual funds exceeding ₹1.25 Lakh per financial year are taxed at what rate (post Budget 2024)?",
		options: ["10%", "12.5%", "15%", "20% with indexation"],
		correctIndex: 1,
		explanation: "Effective Budget 2024, Long Term Capital Gains (LTCG) on listed equity and equity mutual funds held for more than 12 months are taxed at 12.5% on gains exceeding ₹1.25 Lakhs per fiscal year.",
		topic: "Taxation of Mutual Funds"
	},
	{
		id: "nism-va-q7",
		courseId: "nism-va",
		question: "When an investor redeems units of an open-ended mutual fund scheme subject to an exit load, where does the collected exit load amount go under SEBI regulations?",
		options: ["Retained by the AMC as administrative revenue", "Credited directly back to the scheme to benefit remaining unit holders", "Paid to the distributing agent as trailing commission", "Transferred to SEBI Investor Protection and Education Fund"],
		correctIndex: 1,
		explanation: "SEBI regulations mandate that 100% of any exit load collected must be credited back to the scheme account to mitigate dilution for existing unit holders.",
		topic: "Mutual Fund Accounting & Expenses"
	},
	{
		id: "nism-va-q8",
		courseId: "nism-va",
		question: "How many risk levels are defined in the standardized SEBI Risk-o-meter for mutual fund scheme labels?",
		options: ["3 levels", "4 levels", "5 levels", "6 levels"],
		correctIndex: 3,
		explanation: "The SEBI Risk-o-meter depicts 6 levels of risk: Low, Low to Moderate, Moderate, Moderately High, High, and Very High.",
		topic: "Investor Protection & Suitability"
	},
	{
		id: "nism-va-q9",
		courseId: "nism-va",
		question: "Which transaction facility allows an investor to systematically transfer a fixed sum periodically from one mutual fund scheme to another scheme within the same AMC?",
		options: ["Systematic Investment Plan (SIP)", "Systematic Transfer Plan (STP)", "Systematic Withdrawal Plan (SWP)", "Dividend Transfer Plan (DTP)"],
		correctIndex: 1,
		explanation: "An STP (Systematic Transfer Plan) transfers a fixed amount periodically from a source scheme (usually liquid or overnight) to a target scheme (typically equity).",
		topic: "Investment Strategies & Products"
	},
	{
		id: "nism-va-q10",
		courseId: "nism-va",
		question: "How frequently must an Asset Management Company (AMC) update its Key Information Memorandum (KIM) under SEBI guidelines?",
		options: ["Every quarter", "At least once every year", "Every three years", "Only when scheme fundamentals change"],
		correctIndex: 1,
		explanation: "AMCs must update the Key Information Memorandum (KIM) at least once every financial year and make it available across all investor service centers.",
		topic: "Regulatory Disclosures"
	},
	{
		id: "nism-va-q11",
		courseId: "nism-va",
		question: "Under the SEBI mutual fund distributor remuneration model, which commission structure is exclusively permitted?",
		options: ["Full upfront commission model", "Full trail commission model only", "Combination of 50% upfront and 50% trail", "Discretionary fees negotiated directly with clients"],
		correctIndex: 1,
		explanation: "SEBI mandates an all-trail commission model for mutual fund distributors. Upfront commissions of any kind from AMCs are completely prohibited.",
		topic: "Code of Conduct & Distributor Regulations"
	},
	{
		id: "nism-va-q12",
		courseId: "nism-va",
		question: "What is the statutory minimum net worth requirement that an entity must maintain to operate as an Asset Management Company (AMC) in India?",
		options: ["₹10 Crores", "₹25 Crores", "₹50 Crores", "₹100 Crores"],
		correctIndex: 2,
		explanation: "Under SEBI (Mutual Funds) Regulations, an AMC must maintain a continuous minimum net worth of at least ₹50 Crores.",
		topic: "Mutual Fund Governance"
	},
	{
		id: "nism-va-q13",
		courseId: "nism-va",
		question: "What does Macaulay Duration measure in a debt mutual fund portfolio?",
		options: [
			"Credit risk of corporate bonds in the fund",
			"Weighted average time until all cash flows (coupons and principal) are received",
			"The fund's total tracking error against government bonds",
			"The ratio of corporate bonds to treasury bills"
		],
		correctIndex: 1,
		explanation: "Macaulay Duration measures the weighted average term to maturity of cash flows generated by a bond, reflecting sensitivity to interest rate fluctuations.",
		topic: "Debt Fund Evaluation"
	},
	{
		id: "nism-va-q14",
		courseId: "nism-va",
		question: "Under SEBI guidelines, which event explicitly triggers the creation of a 'Segregated Portfolio' (side-pocketing) in a debt mutual fund scheme?",
		options: [
			"A 5% drop in scheme NAV within a single day",
			"A credit rating downgrade of a debt or money market instrument to below investment grade (BBB-)",
			"High redemption pressure exceeding 10% of scheme AUM",
			"Insolvency filing of the AMC sponsor"
		],
		correctIndex: 1,
		explanation: "Side-pocketing (segregated portfolio creation) is triggered upon a credit event involving downgrade of debt instrument to below investment grade.",
		topic: "Risk Management & Valuation"
	},
	{
		id: "nism-va-q15",
		courseId: "nism-va",
		question: "Which of the following actions constitutes 'churning' by a mutual fund distributor under the AMFI Code of Ethics?",
		options: [
			"Advising a client to rebalance portfolio annually based on target asset allocation",
			"Unnecessary switching of a client between similar schemes solely to generate trail turnover without financial rationale",
			"Recommending liquid funds for emergency cash requirements",
			"Helping an investor complete periodic eKYC re-verification"
		],
		correctIndex: 1,
		explanation: "Churning refers to encouraging unnecessary transfers or redemptions between schemes with no demonstrable benefit to the client, which is strictly prohibited.",
		topic: "Ethics & Professional Standards"
	},

	// ==========================================
	// NISM Series VIII: Equity Derivatives (10 Questions)
	// ==========================================
	{
		id: "nism-viii-q1",
		courseId: "nism-viii",
		question: "A European Call Option gives the buyer which of the following rights?",
		options: [
			"The right to buy the underlying asset on or before the expiration date",
			"The right to buy the underlying asset only on the expiration date",
			"The obligation to buy the underlying asset on the expiration date",
			"The right to sell the underlying asset only on the expiration date"
		],
		correctIndex: 1,
		explanation: "European style options can only be exercised on the expiration date itself, unlike American style options which can be exercised at any time up to expiration.",
		topic: "Options Fundamentals"
	},
	{
		id: "nism-viii-q2",
		courseId: "nism-viii",
		question: "In the equity derivatives market, what does a high Open Interest (OI) accompanied by an increase in futures price typically indicate?",
		options: ["Short Covering", "Long Liquidation", "Long Buildup (Bullish)", "Short Buildup (Bearish)"],
		correctIndex: 2,
		explanation: "When price rises along with rising Open Interest, it signifies fresh capital entering the market to create new long positions, known as Long Buildup.",
		topic: "Derivatives Market Dynamics"
	},
	{
		id: "nism-viii-q3",
		courseId: "nism-viii",
		question: "Which Option Greek measures the sensitivity of an option's delta relative to a change in the price of the underlying asset?",
		options: ["Theta", "Vega", "Gamma", "Rho"],
		correctIndex: 2,
		explanation: "Gamma (Γ) measures the rate of change of Delta with respect to changes in the underlying asset's price, effectively measuring the curvature of the option value.",
		topic: "Option Greeks"
	},
	{
		id: "nism-viii-q4",
		courseId: "nism-viii",
		question: "Which Option Greek measures the rate of decay of an option premium due to the passage of time?",
		options: ["Delta", "Vega", "Theta", "Rho"],
		correctIndex: 2,
		explanation: "Theta (Θ) represents time decay — the loss in option value as time moves closer to expiration, typically negative for long option positions.",
		topic: "Option Greeks"
	},
	{
		id: "nism-viii-q5",
		courseId: "nism-viii",
		question: "Under what condition is an equity Put Option considered to be 'In-The-Money' (ITM)?",
		options: [
			"Spot Price is greater than Strike Price",
			"Strike Price is greater than Spot Price",
			"Spot Price is equal to Strike Price",
			"Implied Volatility is above historical volatility"
		],
		correctIndex: 1,
		explanation: "A Put Option is In-The-Money when the Strike Price is higher than the current Spot Price, giving intrinsic value.",
		topic: "Moneyness of Options"
	},
	{
		id: "nism-viii-q6",
		courseId: "nism-viii",
		question: "What are the core components of a classic Covered Call option trading strategy?",
		options: [
			"Long Stock + Short Call Option",
			"Long Stock + Long Put Option",
			"Short Stock + Long Call Option",
			"Long Call Option + Short Put Option"
		],
		correctIndex: 0,
		explanation: "A Covered Call involves owning underlying equity shares while selling an equivalent out-of-the-money Call option to generate income.",
		topic: "Option Trading Strategies"
	},
	{
		id: "nism-viii-q7",
		courseId: "nism-viii",
		question: "What is the primary function of the SPAN (Standard Portfolio Analysis of Risk) system in equity derivatives clearing?",
		options: [
			"Predicting tomorrow's opening index price",
			"Calculating portfolio-level margin requirements based on maximum likely single-day loss",
			"Determining dividend distribution dates for stocks",
			"Automating high-frequency arbitrage trading"
		],
		correctIndex: 1,
		explanation: "SPAN simulates worst-case portfolio loss scenarios across varying underlying prices and implied volatilities to determine margining.",
		topic: "Margining & Risk Management"
	},
	{
		id: "nism-viii-q8",
		courseId: "nism-viii",
		question: "If an equity stock has a Beta (β) of 1.5 relative to Nifty 50, what does this imply?",
		options: [
			"The stock is 50% less volatile than the benchmark index",
			"For every 1% move in the benchmark, the stock is expected to move by 1.5% in the same direction",
			"The stock has an alpha of 1.5% over the risk-free rate",
			"The stock cannot be hedged using index futures"
		],
		correctIndex: 1,
		explanation: "Beta reflects systematic market sensitivity: a Beta of 1.5 indicates 50% greater price fluctuation relative to index moves.",
		topic: "Systematic Risk & Hedging"
	},
	{
		id: "nism-viii-q9",
		courseId: "nism-viii",
		question: "What is the settlement mechanism for expiring stock derivatives contracts on Indian exchanges (NSE/BSE)?",
		options: [
			"Cash settlement based on closing price",
			"Mandatory physical delivery of underlying shares",
			"Automatic rollover to the next month contract",
			"Settlement in US Dollars via international depository"
		],
		correctIndex: 1,
		explanation: "SEBI mandates physical delivery settlement for all in-the-money stock futures and stock options contracts on expiration.",
		topic: "Settlement & Clearing"
	},
	{
		id: "nism-viii-q10",
		courseId: "nism-viii",
		question: "In derivatives market analysis, what is typically signified when the Put-Call Ratio (PCR) of Open Interest rises significantly above 1.3?",
		options: [
			"Extreme bearishness and imminent sell-off",
			"Bullish market sentiment with strong put writing acting as support",
			"Total absence of liquidity in call options",
			"Exchange technical failure"
		],
		correctIndex: 1,
		explanation: "A high PCR indicates heavy put writing by institutional players, which market participants view as strong downside support (bullish bias).",
		topic: "Derivatives Analytics"
	},

	// ==========================================
	// NISM Series X-A: Investment Adviser Level 1 (10 Questions)
	// ==========================================
	{
		id: "nism-xa-q1",
		courseId: "nism-xa",
		question: "Under the SEBI (Investment Advisers) Regulations, 2013, which of the following is mandatory for an individual RIA?",
		options: [
			"Segregation of advisory and distribution activities at client level",
			"Maintaining an ARN code under the same PAN for mutual fund distribution",
			"Charging both advisory fees and distribution commission from the same client",
			"Mandatory guarantee of capital protection in financial plans"
		],
		correctIndex: 0,
		explanation: "SEBI regulations enforce strict client-level segregation between investment advisory and distribution/execution services to prevent conflicts of interest.",
		topic: "SEBI RIA Regulations"
	},
	{
		id: "nism-xa-q2",
		courseId: "nism-xa",
		question: "Which of the following approaches is the foundational formula of Modern Portfolio Theory (MPT) developed by Harry Markowitz?",
		options: [
			"Maximizing expected return for a given level of risk or minimizing risk for a given level of expected return",
			"Purchasing only risk-free government securities and cash equivalents",
			"Focusing solely on individual stock price-to-earnings ratios",
			"Eliminating systematic market risk through stock diversification"
		],
		correctIndex: 0,
		explanation: "Markowitz Modern Portfolio Theory states that an investor can construct an efficient frontier portfolio that maximizes expected return for a given level of risk.",
		topic: "Portfolio Construction & Asset Allocation"
	},
	{
		id: "nism-xa-q3",
		courseId: "nism-xa",
		question: "What is the maximum annual fee that an individual SEBI-registered Investment Adviser (RIA) can charge under the Assets Under Advice (AUA) mechanism?",
		options: ["1.5% of AUA", "2.5% of AUA", "3.0% of AUA", "5.0% of AUA"],
		correctIndex: 1,
		explanation: "Under SEBI RIA guidelines, maximum fees charged under the AUA model cannot exceed 2.5% per annum of the client's Assets under Advice.",
		topic: "Advisory Fee Norms"
	},
	{
		id: "nism-xa-q4",
		courseId: "nism-xa",
		question: "In investor profiling, what is the crucial distinction between 'Risk Capacity' and 'Risk Tolerance'?",
		options: [
			"Capacity is psychological willingness; Tolerance is financial ability",
			"Capacity is objective financial ability to absorb losses; Tolerance is subjective emotional attitude toward risk",
			"Capacity is determined by credit score; Tolerance is determined by income tax slab",
			"Both terms denote identical regulatory metrics"
		],
		correctIndex: 1,
		explanation: "Risk capacity is the objective ability to absorb losses (net worth, time horizon), while risk tolerance is psychological willingness to handle market volatility.",
		topic: "Client Profiling & Suitability"
	},
	{
		id: "nism-xa-q5",
		courseId: "nism-xa",
		question: "In financial planning, what is the standard prudent sizing recommended for an individual's emergency contingency fund?",
		options: [
			"1 month of gross discretionary spending",
			"3 to 6 months of mandatory household and debt-servicing expenses",
			"1 year of total investments",
			"5 years of life insurance premiums"
		],
		correctIndex: 1,
		explanation: "An emergency fund should cover 3 to 6 months of committed living expenses, held in safe and liquid avenues like bank deposits or overnight/liquid funds.",
		topic: "Personal Financial Planning"
	},
	{
		id: "nism-xa-q6",
		courseId: "nism-xa",
		question: "When should an investment advisor trigger portfolio rebalancing for a client?",
		options: [
			"Whenever any individual stock declines by 2%",
			"When portfolio asset allocations drift significantly beyond predefined percentage tolerance bands from target allocation",
			"Every Monday morning regardless of market movements",
			"Only when the client changes their employer"
		],
		correctIndex: 1,
		explanation: "Rebalancing is disciplined: it is enacted when asset classes drift beyond target allocation bands (e.g. +/- 5%) due to market performance.",
		topic: "Asset Allocation & Rebalancing"
	},
	{
		id: "nism-xa-q7",
		courseId: "nism-xa",
		question: "What is the tax treatment of Sovereign Gold Bonds (SGB) held until their 8-year maturity by an individual investor in India?",
		options: [
			"Taxable at 20% with indexation benefit",
			"Entire capital gain upon redemption at maturity is 100% exempt from income tax",
			"Taxable at marginal income tax slab rates",
			"Taxable at flat 12.5% under Section 112A"
		],
		correctIndex: 1,
		explanation: "Under Section 47(viic) of the Income Tax Act, capital gains arising on redemption of Sovereign Gold Bonds by an individual at maturity are completely tax-exempt.",
		topic: "Taxation & Wealth Planning"
	},
	{
		id: "nism-xa-q8",
		courseId: "nism-xa",
		question: "Under the legal fiduciary duty owed by an RIA to their client, what is the core requirement?",
		options: [
			"Ensuring guaranteed annual capital appreciation",
			"Subordinating personal and institutional interests to the client's best interests at all times",
			"Recommending the products that yield the highest brokerage",
			"Refusing to execute transactions requested by the client"
		],
		correctIndex: 1,
		explanation: "Fiduciary duty requires an RIA to act strictly in the best interest of the client, maintaining independence and disclosing all potential conflicts of interest.",
		topic: "Code of Ethics"
	},
	{
		id: "nism-xa-q9",
		courseId: "nism-xa",
		question: "How does the Treynor Ratio differ from the Sharpe Ratio when evaluating investment portfolios?",
		options: [
			"Treynor uses Beta (systematic risk); Sharpe uses Standard Deviation (total risk)",
			"Treynor uses Standard Deviation; Sharpe uses Jensen's Alpha",
			"Treynor ignores risk-free return; Sharpe includes it",
			"Treynor applies only to real estate assets"
		],
		correctIndex: 0,
		explanation: "Treynor divides excess return by Beta (systematic risk), while Sharpe divides excess return by Standard Deviation (total risk).",
		topic: "Performance Measurement"
	},
	{
		id: "nism-xa-q10",
		courseId: "nism-xa",
		question: "For how long must a SEBI-registered Investment Adviser maintain client risk profiling records, financial plans, and correspondence under regulations?",
		options: ["1 year", "3 years", "At least 5 years", "10 years"],
		correctIndex: 2,
		explanation: "SEBI (Investment Advisers) Regulations mandate that all client agreements, advice records, risk profiling, and KYC documents must be preserved for at least 5 years.",
		topic: "Compliance & Record Keeping"
	},

	// ==========================================
	// NISM Series XV: Research Analyst (10 Questions)
	// ==========================================
	{
		id: "nism-xv-q1",
		courseId: "nism-xv",
		question: "Under SEBI (Research Analysts) Regulations, 2014, what is the mandatory quiet period for a research analyst before and after public appearances?",
		options: [
			"No trading in subject company securities 30 days prior to and 5 days after publishing a research report",
			"No trading in any equities for 1 year",
			"Trading allowed provided notice is given to the exchange within 24 hours",
			"No quiet period if disclosures are made verbally"
		],
		correctIndex: 0,
		explanation: "SEBI (Research Analysts) Regulations mandate that RAs and their associates shall not deal or trade in securities of the subject company within 30 days before and 5 days after publication of a research report.",
		topic: "Regulatory Code of Conduct"
	},
	{
		id: "nism-xv-q2",
		courseId: "nism-xv",
		question: "Under SEBI RA Regulations, what is the shareholding threshold in a subject company that requires mandatory disclosure in a research report?",
		options: [
			"Holding 0.1% or more of securities",
			"Holding 1% or more of securities of the subject company at the end of the month preceding publication",
			"Holding 5% or more under takeover regulations",
			"Any fractional holding regardless of amount"
		],
		correctIndex: 1,
		explanation: "An RA must disclose if the analyst, research entity, or associates hold financial interest of 1% or more of securities of the subject company.",
		topic: "Conflict of Interest Disclosures"
	},
	{
		id: "nism-xv-q3",
		courseId: "nism-xv",
		question: "What is the standard formula to compute the Enterprise Value (EV) of a listed corporate entity?",
		options: [
			"Market Capitalization + Total Debt - Cash and Cash Equivalents",
			"Market Capitalization - Total Debt + Cash and Cash Equivalents",
			"Book Value of Equity + Gross Revenue",
			"EBITDA multiplied by Total Shares"
		],
		correctIndex: 0,
		explanation: "Enterprise Value represents total company value: Equity Value (Market Cap) + Total Debt - Cash & Cash Equivalents.",
		topic: "Equity Valuation Methodologies"
	},
	{
		id: "nism-xv-q4",
		courseId: "nism-xv",
		question: "Why is the EV/EBITDA valuation multiple often preferred over the P/E multiple when comparing capital-intensive companies?",
		options: [
			"EV/EBITDA is unaffected by stock market crashes",
			"It is capital-structure neutral and removes distortions caused by differences in debt gearing and depreciation methods",
			"It is always a lower number than P/E",
			"It is only applicable to companies with zero tax liabilities"
		],
		correctIndex: 1,
		explanation: "EV/EBITDA is independent of leverage differences and depreciation/amortization policies, making it ideal for cross-firm comparisons.",
		topic: "Relative Valuation"
	},
	{
		id: "nism-xv-q5",
		courseId: "nism-xv",
		question: "What is the purpose of establishing a 'Chinese Wall' inside an investment banking and research firm?",
		options: [
			"Restricting internet access of junior research associates",
			"Preventing the flow of unpublished price-sensitive information (UPSI) between research and investment banking teams",
			"Ensuring that all reports are published in international time zones",
			"Preventing analysts from changing their price targets"
		],
		correctIndex: 1,
		explanation: "A Chinese Wall is an information barrier isolating investment banking and advisory operations from the research department to avoid conflicts of interest.",
		topic: "Governance & Information Barriers"
	},
	{
		id: "nism-xv-q6",
		courseId: "nism-xv",
		question: "If a research analyst inadvertently comes into possession of Unpublished Price Sensitive Information (UPSI), what is their legal obligation?",
		options: [
			"Immediately publish a research report incorporating the UPSI to assist retail investors",
			"Refrain from trading in the security, do not communicate the information, and notify the Compliance Officer",
			"Share the UPSI with preferred HNI advisory clients",
			"Purchase put options as a hedge"
		],
		correctIndex: 1,
		explanation: "Under SEBI (Prohibition of Insider Trading) Regulations, possessing UPSI requires absolute non-disclosure and strict abstinence from trading.",
		topic: "Insider Trading Prevention"
	},
	{
		id: "nism-xv-q7",
		courseId: "nism-xv",
		question: "What does a Price-to-Earnings to Growth (PEG) ratio of less than 1.0 generally indicate to a fundamental equity analyst?",
		options: [
			"The stock is severely overvalued and should be sold",
			"The company is growing slower than the inflation rate",
			"The stock may be undervalued relative to its expected earnings growth rate",
			"The company has negative net profit margin"
		],
		correctIndex: 2,
		explanation: "Peter Lynch's PEG ratio compares P/E to EPS growth rate: PEG < 1 indicates that earnings growth outpaces the valuation multiple, suggesting value.",
		topic: "Fundamental Analysis"
	},
	{
		id: "nism-xv-q8",
		courseId: "nism-xv",
		question: "Under SEBI RA Regulations, can a research analyst share a draft research report with the subject company prior to publication?",
		options: [
			"Yes, but only factual sections of the report to verify accuracy; target price and ratings must NOT be shared",
			"Yes, the subject company must sign off on the target price",
			"No, draft reports can never be shared under any circumstances",
			"Yes, provided the subject company pays for the research coverage"
		],
		correctIndex: 0,
		explanation: "Draft reports may only be shared with the subject company to verify factual accuracy; recommendations, ratings, and valuation summaries cannot be shared.",
		topic: "Research Process Integrity"
	},
	{
		id: "nism-xv-q9",
		courseId: "nism-xv",
		question: "In a Discounted Cash Flow (DCF) model, how is the Terminal Value (TV) calculated using the Gordon Growth Model?",
		options: [
			"TV = Final Year EBITDA × Industry Multiple",
			"TV = FCF × (1 + g) / (WACC - g)",
			"TV = Total Assets - Total Liabilities",
			"TV = Market Cap / Risk Free Rate"
		],
		correctIndex: 1,
		explanation: "Gordon Growth formula: TV = (Expected Cash Flow in Year n+1) / (WACC - Perpetual Growth Rate).",
		topic: "DCF Modeling"
	},
	{
		id: "nism-xv-q10",
		courseId: "nism-xv",
		question: "How long must a Research Analyst maintain records of research reports, public appearances, and research recommendations?",
		options: ["1 year", "3 years", "Minimum 5 years", "Permanent archival"],
		correctIndex: 2,
		explanation: "SEBI RA Regulations mandate that all research reports, rationale documents, recommendations, and public appearance transcripts be kept for at least 5 years.",
		topic: "Regulatory Compliance"
	},

	// ==========================================
	// NISM Series XXI-A: PMS Distributors (10 Questions)
	// ==========================================
	{
		id: "nism-xxia-q1",
		courseId: "nism-xxia",
		question: "What is the statutory minimum investment amount required from a client to open a Portfolio Management Services (PMS) account under SEBI regulations?",
		options: ["₹10 Lakhs", "₹25 Lakhs", "₹50 Lakhs", "₹1 Crore"],
		correctIndex: 2,
		explanation: "SEBI (Portfolio Managers) Regulations 2020 raised the minimum investment ticket size per client for PMS to ₹50 Lakhs.",
		topic: "PMS Regulatory Framework"
	},
	{
		id: "nism-xxia-q2",
		courseId: "nism-xxia",
		question: "What distinguishes a Discretionary PMS from a Non-Discretionary PMS?",
		options: [
			"In Discretionary PMS, the portfolio manager executes trades independently without seeking prior approval for each trade from the client",
			"In Discretionary PMS, the client must approve every individual buy and sell order before execution",
			"Non-Discretionary PMS does not require a SEBI registration",
			"Discretionary PMS can only invest in government securities"
		],
		correctIndex: 0,
		explanation: "Under Discretionary PMS, the portfolio manager holds full investment discretion. Under Non-Discretionary PMS, the manager advises but requires client consent for each trade.",
		topic: "Operating Models"
	},
	{
		id: "nism-xxia-q3",
		courseId: "nism-xxia",
		question: "Which return calculation methodology is mandatory for Portfolio Managers when reporting client portfolio performance under SEBI norms?",
		options: ["Simple Annual Return", "Internal Rate of Return (IRR)", "Time-Weighted Rate of Return (TWRR)", "Book Value Return"],
		correctIndex: 2,
		explanation: "SEBI mandates the Time-Weighted Rate of Return (TWRR) methodology to neutralize the distortionary impact of external cash inflows and outflows on performance.",
		topic: "Performance Calculation"
	},
	{
		id: "nism-xxia-q4",
		courseId: "nism-xxia",
		question: "What is the 'High Water Mark' principle in the context of PMS performance fee calculation?",
		options: [
			"Performance fee is charged only when portfolio returns exceed the fixed deposit rate",
			"Performance fee is charged only on the increase in portfolio value exceeding the highest historic NAV achieved in any previous performance fee calculation period",
			"The maximum percentage fee that can be levied on a client's capital",
			"A minimum reserve requirement kept with the Clearing Corporation"
		],
		correctIndex: 1,
		explanation: "The High Water Mark ensures that clients do not pay performance fees for recovering past losses; fees apply only above the highest previous peak.",
		topic: "Fee Structures"
	},
	{
		id: "nism-xxia-q5",
		courseId: "nism-xxia",
		question: "Under SEBI regulations, must a Portfolio Manager provide an option for clients to onboard directly without paying distributor commission?",
		options: [
			"Yes, direct onboarding without distributor fees is mandatory across all registered Portfolio Managers",
			"No, all clients must compulsorily come through registered distributors",
			"Only institutional clients with over ₹10 Crores can onboard directly",
			"Direct onboarding is optional at the discretion of the Portfolio Manager"
		],
		correctIndex: 0,
		explanation: "SEBI mandates that portfolio managers must provide a direct onboarding channel with zero distributor commission fees for prospective clients.",
		topic: "Investor Protection"
	},
	{
		id: "nism-xxia-q6",
		courseId: "nism-xxia",
		question: "What is the statutory minimum net worth requirement for an entity seeking registration as a Portfolio Manager with SEBI?",
		options: ["₹1 Crore", "₹2 Crores", "₹5 Crores", "₹10 Crores"],
		correctIndex: 2,
		explanation: "Under the SEBI (Portfolio Managers) Regulations, 2020, registered Portfolio Managers must maintain a continuous minimum net worth of ₹5 Crores.",
		topic: "Entity Governance"
	},
	{
		id: "nism-xxia-q7",
		courseId: "nism-xxia",
		question: "How frequently must client portfolio accounts in a PMS be audited by an independent Chartered Accountant?",
		options: ["Every quarter", "At least once every year", "Every three years", "Only when requested by SEBI"],
		correctIndex: 1,
		explanation: "SEBI rules require an annual independent audit of every client's portfolio account and internal controls by a practicing Chartered Accountant.",
		topic: "Audit & Verification"
	},
	{
		id: "nism-xxia-q8",
		courseId: "nism-xxia",
		question: "How are client securities custodied in a Portfolio Management Services arrangement?",
		options: [
			"Pooled in the portfolio manager's personal demat account",
			"Held in a segregated demat account opened in the name of the client with a SEBI-registered Custodian",
			"Deposited with the stock exchange guarantee fund",
			"Held as physical certificates in the portfolio manager's locker"
		],
		correctIndex: 1,
		explanation: "Client securities in PMS are segregated and held directly in demat accounts opened in the individual client's own name with an independent custodian.",
		topic: "Custody & Safekeeping"
	},
	{
		id: "nism-xxia-q9",
		courseId: "nism-xxia",
		question: "What is the regulatory limit on investment in unlisted securities by a Discretionary Portfolio Manager?",
		options: [
			"Unlisted investments are completely banned in discretionary PMS",
			"Up to a maximum of 25% of the client's portfolio AUM may be invested in unlisted securities",
			"Up to 50% without disclosure",
			"100% permitted if approved by the custodian"
		],
		correctIndex: 1,
		explanation: "SEBI permits discretionary portfolio managers to invest up to a maximum cap of 25% of the portfolio's total AUM in unlisted securities.",
		topic: "Portfolio Guidelines"
	},
	{
		id: "nism-xxia-q10",
		courseId: "nism-xxia",
		question: "When must the PMS Disclosure Document be provided to a prospective investor?",
		options: [
			"Within 30 days after executing the portfolio agreement",
			"At least two days prior to entering into the PMS agreement with the client",
			"Only when the client explicitly requests it in writing",
			"At the end of the first financial year"
		],
		correctIndex: 1,
		explanation: "SEBI regulations mandate that the Disclosure Document must be handed over to the client at least two days before signing the investment agreement.",
		topic: "Disclosures & Transparency"
	},

	// ==========================================
	// NISM Series V-D: SIF Distributors (10 Questions)
	// ==========================================
	{
		id: "nism-vd-q1",
		courseId: "nism-vd",
		question: "Under the SEBI regulatory framework, what distinguishes a Specialized Investment Fund (SIF) from a standard mutual fund scheme?",
		options: [
			"SIF schemes invest exclusively in sovereign gold bonds",
			"SIF caters to accredited and sophisticated investors with specialized asset classes, structured debt, or hybrid strategies and higher minimum commitment",
			"SIF does not require any regulatory disclosure or trustee oversight",
			"SIF schemes are exempt from income tax"
		],
		correctIndex: 1,
		explanation: "SIFs provide access to specialized alternative and hybrid investment opportunities with higher suitability criteria and bespoke risk profiles.",
		topic: "SIF Regulatory Framework"
	},
	{
		id: "nism-vd-q2",
		courseId: "nism-vd",
		question: "Why do Specialized Investment Funds maintain higher minimum ticket thresholds than retail mutual funds?",
		options: [
			"To maximize distributor trailing commissions",
			"To ensure investment suitability, financial sophistication, and risk-absorption capacity of participants",
			"To avoid paying stamp duty on contract notes",
			"Because SEBI does not permit retail investors to invest in mutual funds"
		],
		correctIndex: 1,
		explanation: "Higher investment commitments ensure that only sophisticated investors with adequate loss-absorption capacity participate in specialized fund strategies.",
		topic: "Investor Categorisation & Suitability"
	},
	{
		id: "nism-vd-q3",
		courseId: "nism-vd",
		question: "How frequently must illiquid or unlisted assets in a specialized fund portfolio be valued by an independent valuation agency?",
		options: [
			"Daily in real-time during market hours",
			"At least periodically (e.g. monthly or quarterly) by an independent SEBI-recognized valuation agency",
			"Once every five years",
			"Only upon fund liquidation"
		],
		correctIndex: 1,
		explanation: "Unlisted or illiquid instruments require periodic independent valuation by an accredited valuation agency to ensure fair NAV calculation.",
		topic: "Valuation Principles"
	},
	{
		id: "nism-vd-q4",
		courseId: "nism-vd",
		question: "What is the primary responsibility of the Scheme Investment Committee in specialized funds?",
		options: [
			"Deciding marketing slogans for fund roadshows",
			"Overseeing investment adherence, risk mandates, and approving investments in structured or illiquid securities",
			"Filing personal tax returns of unit holders",
			"Setting the exchange clearing fees"
		],
		correctIndex: 1,
		explanation: "The Investment Committee ensures that all transactions adhere strictly to the scheme's mandate, risk parameters, and regulatory exposure limits.",
		topic: "Scheme Governance"
	},
	{
		id: "nism-vd-q5",
		courseId: "nism-vd",
		question: "What is a key difference in liquidity management between a specialized fund and an open-ended liquid mutual fund?",
		options: [
			"Liquid funds offer daily redemptions at T+1, whereas specialized funds may incorporate defined liquidity windows or lock-in terms",
			"Specialized funds never allow redemptions under any circumstances",
			"Liquid funds require a 1-year notice for redemption",
			"Specialized funds settle redemptions in physical bullion"
		],
		correctIndex: 0,
		explanation: "Specialized funds manage liquidity through specified redemption intervals or lock-ins matching the duration of their underlying assets.",
		topic: "Liquidity Risk Management"
	},
	{
		id: "nism-vd-q6",
		courseId: "nism-vd",
		question: "Who qualifies as an 'Accredited Investor' under the SEBI regulatory framework?",
		options: [
			"Any individual with an active PAN card",
			"An individual with annual income ≥ ₹2 Crores OR net worth ≥ ₹7.5 Crores (with at least ₹3.75 Cr in financial assets)",
			"Any corporate entity regardless of balance sheet size",
			"An investor who has passed the NISM exam"
		],
		correctIndex: 1,
		explanation: "SEBI defines Accredited Investors by net worth or income thresholds (e.g. ₹2 Cr annual income or ₹7.5 Cr net worth for individuals).",
		topic: "Accredited Investor Norms"
	},
	{
		id: "nism-vd-q7",
		courseId: "nism-vd",
		question: "Are 'Side Letter' agreements offering preferential terms or fee discounts to select investors permitted in regulated specialized funds?",
		options: [
			"Yes, side letters can be secretly signed with large investors without disclosure",
			"No, SEBI prohibits side letters that provide differential rights or preferential liquidity that prejudices other unit holders",
			"Yes, permitted if the investment exceeds ₹10 Lakhs",
			"Permitted only for foreign institutional investors"
		],
		correctIndex: 1,
		explanation: "SEBI mandates fair and equitable treatment for all investors in a scheme; preferential side letters that undermine pari-passu rights are prohibited.",
		topic: "Fair Treatment of Investors"
	},
	{
		id: "nism-vd-q8",
		courseId: "nism-vd",
		question: "How must related-party transactions and conflict of interest scenarios be handled in specialized fund operations?",
		options: [
			"Hidden from the trustees to prevent delays",
			"Fully disclosed to trustees and unit holders, with independent valuations and adherence to arm's length standards",
			"Executed at a 50% discount to market rates",
			"Referred to the local police department"
		],
		correctIndex: 1,
		explanation: "Affiliate and related-party deals require prior committee/trustee review, arm's-length pricing, and transparent disclosure in scheme reports.",
		topic: "Code of Conduct"
	},
	{
		id: "nism-vd-q9",
		courseId: "nism-vd",
		question: "How should performance benchmarks be constructed for specialized or hybrid investment funds?",
		options: [
			"Using a fixed 15% arbitrary hurdle rate",
			"Using a transparent, publicly available index that accurately reflects the asset mix and investment strategy of the fund",
			"Benchmark choice is entirely prohibited for specialized funds",
			"Using the US S&P 500 index regardless of domestic portfolio assets"
		],
		correctIndex: 1,
		explanation: "Regulations mandate benchmarks that reflect the strategy, duration, and asset composition of the underlying specialized fund portfolio.",
		topic: "Performance Evaluation"
	},
	{
		id: "nism-vd-q10",
		courseId: "nism-vd",
		question: "What is the dual licensing benefit of holding the NISM Series V-D certification for financial intermediaries?",
		options: [
			"Authorizes the distribution of both standard mutual fund schemes and specialized investment funds (SIF) under a unified license",
			"Allows the advisor to trade international currency futures without an exchange broker",
			"Exempts the distributor from filing GST returns",
			"Guarantees automatic appointment as an AMC fund manager"
		],
		correctIndex: 0,
		explanation: "NISM Series V-D provides accreditation covering both traditional mutual funds and specialized investment funds under SEBI distribution guidelines.",
		topic: "SIF Regulatory Framework"
	}
];

export class NismLmsService {
	private initialized = false;
	private ltiSecret: string;
	private lmsBaseUrl: string;

	constructor() {
		this.ltiSecret = process.env.NISM_LTI_SECRET || "fintekpro_nism_lti_secret_2026_prod";
		this.lmsBaseUrl = process.env.NISM_LMS_BASE_URL || "https://online.nism.ac.in/nismlms";
	}

	/**
	 * Boot-time table and seed migration
	 */
	async ensureTables() {
		if (this.initialized) return;
		try {
			await db.execute(sql`
				CREATE TABLE IF NOT EXISTS nism_lms_courses (
					id VARCHAR(64) PRIMARY KEY,
					series_code VARCHAR(32) NOT NULL UNIQUE,
					title TEXT NOT NULL,
					description TEXT NOT NULL,
					cpe_credits INTEGER DEFAULT 0,
					duration_hours NUMERIC DEFAULT 0,
					passing_percentage INTEGER DEFAULT 60,
					exam_fee_inr NUMERIC DEFAULT 1500,
					category TEXT NOT NULL,
					syllabus_url TEXT,
					lti_resource_link_id TEXT,
					is_active BOOLEAN DEFAULT TRUE,
					created_at TIMESTAMPTZ DEFAULT NOW()
				);

				CREATE TABLE IF NOT EXISTS nism_course_enrolments (
					id SERIAL PRIMARY KEY,
					agent_id VARCHAR(255) NOT NULL,
					course_id VARCHAR(64) NOT NULL REFERENCES nism_lms_courses(id),
					status TEXT NOT NULL DEFAULT 'enrolled',
					progress_percentage INTEGER DEFAULT 0,
					last_score INTEGER,
					cpe_credits_earned INTEGER DEFAULT 0,
					certificate_url TEXT,
					certificate_number TEXT,
					enrolled_at TIMESTAMPTZ DEFAULT NOW(),
					completed_at TIMESTAMPTZ,
					last_synced_at TIMESTAMPTZ DEFAULT NOW(),
					CONSTRAINT unq_agent_nism_course UNIQUE (agent_id, course_id)
				);
			`);

			// Upsert default courses ensuring latest syllabus and new courses like Series V-D are seeded
			for (const c of DEFAULT_COURSES) {
				await db.execute(sql`
					INSERT INTO nism_lms_courses (
						id, series_code, title, description, cpe_credits, duration_hours,
						passing_percentage, exam_fee_inr, category, syllabus_url, lti_resource_link_id, is_active
					) VALUES (
						${c.id}, ${c.seriesCode}, ${c.title}, ${c.description}, ${c.cpeCredits}, ${c.durationHours},
						${c.passingPercentage}, ${c.examFeeInr}, ${c.category}, ${c.syllabusUrl ?? null}, ${c.ltiResourceLinkId}, ${c.isActive}
					) ON CONFLICT (id) DO UPDATE SET
						series_code = EXCLUDED.series_code,
						title = EXCLUDED.title,
						description = EXCLUDED.description,
						cpe_credits = EXCLUDED.cpe_credits,
						duration_hours = EXCLUDED.duration_hours,
						passing_percentage = EXCLUDED.passing_percentage,
						exam_fee_inr = EXCLUDED.exam_fee_inr,
						category = EXCLUDED.category,
						syllabus_url = EXCLUDED.syllabus_url,
						lti_resource_link_id = EXCLUDED.lti_resource_link_id,
						is_active = EXCLUDED.is_active;
				`).catch(() => {});
			}
			this.initialized = true;
		} catch (err: any) {
			logger.error("[NismLmsService] Table init error (non-fatal fallback): " + err.message);
		}
	}

	/**
	 * Retrieve all available NISM courses with agent enrollment info
	 */
	async getCoursesWithAgentStatus(agentId: string): Promise<AgentCourseProgress[]> {
		const startTime = Date.now();
		await this.ensureTables();

		try {
			const rows = await db.execute(sql`
				SELECT 
					c.id as course_id,
					c.series_code,
					c.title,
					c.category,
					c.cpe_credits,
					c.duration_hours,
					c.passing_percentage,
					c.exam_fee_inr,
					c.syllabus_url,
					COALESCE(e.status, 'unregistered') as status,
					COALESCE(e.progress_percentage, 0) as progress_percentage,
					e.last_score,
					COALESCE(e.cpe_credits_earned, 0) as cpe_credits_earned,
					e.certificate_url,
					e.certificate_number,
					COALESCE(e.enrolled_at, NOW()) as enrolled_at,
					e.completed_at
				FROM nism_lms_courses c
				LEFT JOIN nism_course_enrolments e ON e.course_id = c.id AND e.agent_id = ${agentId}
				WHERE c.is_active = TRUE
				ORDER BY c.cpe_credits DESC, c.series_code ASC
			`);

			const latencyMs = Date.now() - startTime;
			logger.info("NISM_LMS_FETCH_COURSES", {
				event: "NISM_LMS_FETCH_COURSES",
				userId: agentId,
				latency_ms: latencyMs,
				count: rows.rows.length,
				status: "SUCCESS"
			});

			return rows.rows.map((r: any) => ({
				courseId: r.course_id,
				seriesCode: r.series_code,
				title: r.title,
				category: r.category,
				cpeCredits: Number(r.cpe_credits),
				durationHours: Number(r.duration_hours),
				passingPercentage: Number(r.passing_percentage) || 60,
				examFeeInr: Number(r.exam_fee_inr) || 1500,
				syllabusUrl: r.syllabus_url || DEFAULT_COURSES.find(c => c.id === r.course_id)?.syllabusUrl,
				status: r.status as any,
				progressPercentage: Number(r.progress_percentage),
				lastScore: r.last_score ? Number(r.last_score) : null,
				cpeCreditsEarned: Number(r.cpe_credits_earned),
				certificateUrl: r.certificate_url,
				certificateNumber: r.certificate_number,
				enrolledAt: new Date(r.enrolled_at).toISOString(),
				completedAt: r.completed_at ? new Date(r.completed_at).toISOString() : null,
			}));
		} catch (err: any) {
			logger.warn("[NismLmsService] Query fallback: " + err.message);
			// Resilient fallback to default courses
			return DEFAULT_COURSES.map(c => ({
				courseId: c.id,
				seriesCode: c.seriesCode,
				title: c.title,
				category: c.category,
				cpeCredits: c.cpeCredits,
				durationHours: c.durationHours,
				passingPercentage: c.passingPercentage,
				examFeeInr: c.examFeeInr,
				syllabusUrl: c.syllabusUrl,
				status: "unregistered" as any,
				progressPercentage: 0,
				lastScore: null,
				cpeCreditsEarned: 0,
				enrolledAt: new Date().toISOString(),
			}));
		}
	}

	/**
	 * Enroll an agent into a course
	 */
	async enrollAgent(agentId: string, courseId: string): Promise<{ success: boolean; message: string }> {
		await this.ensureTables();
		try {
			await db.execute(sql`
				INSERT INTO nism_course_enrolments (agent_id, course_id, status, progress_percentage)
				VALUES (${agentId}, ${courseId}, 'enrolled', 0)
				ON CONFLICT (agent_id, course_id) DO NOTHING;
			`);

			return { success: true, message: "Enrolled in course successfully" };
		} catch (err: any) {
			logger.warn("[NismLmsService] Enrollment DB fallback: " + err.message);
			return { success: true, message: "Enrolled in course successfully (offline mode)" };
		}
	}

	/**
	 * Generate LTI 1.3 Launch Token & URL for single-click LMS redirection
	 */
	async generateLtiLaunch(agentId: string, courseId: string, agentName: string, agentEmail: string): Promise<LtiLaunchPayload> {
		await this.ensureTables();

		// Ensure enrolled first
		await this.enrollAgent(agentId, courseId);

		const matchedCourse = DEFAULT_COURSES.find(
			(c) => c.id.toLowerCase() === courseId.toLowerCase() || c.seriesCode.toLowerCase() === courseId.toLowerCase(),
		);

		const header = {
			alg: "HS256",
			typ: "JWT",
		};

		const now = Math.floor(Date.now() / 1000);
		const state = crypto.randomBytes(16).toString("hex");

		const payload = {
			iss: "https://agent.fintekpro.com",
			sub: agentId,
			aud: "nism-elearning-platform",
			exp: now + 3600, // 1 hour validity
			iat: now,
			nonce: crypto.randomBytes(8).toString("hex"),
			name: agentName,
			email: agentEmail,
			"https://purl.imsglobal.org/spec/lti/claim/message_type": "LtiResourceLinkRequest",
			"https://purl.imsglobal.org/spec/lti/claim/version": "1.3.0",
			"https://purl.imsglobal.org/spec/lti/claim/deployment_id": "fintekpro_dep_01",
			"https://purl.imsglobal.org/spec/lti/claim/target_link_uri": `${this.lmsBaseUrl}/course/${courseId}`,
			"https://purl.imsglobal.org/spec/lti/claim/resource_link": {
				id: matchedCourse?.ltiResourceLinkId || `res-${courseId}`,
				title: matchedCourse?.title || `NISM Course: ${courseId.toUpperCase()}`,
			},
			"https://purl.imsglobal.org/spec/lti/claim/roles": [
				"http://purl.imsglobal.org/vocab/lis/v2/membership#Learner",
			],
		};

		const b64Header = Buffer.from(JSON.stringify(header)).toString("base64url");
		const b64Payload = Buffer.from(JSON.stringify(payload)).toString("base64url");
		const signature = crypto
			.createHmac("sha256", this.ltiSecret)
			.update(`${b64Header}.${b64Payload}`)
			.digest("base64url");

		const idToken = `${b64Header}.${b64Payload}.${signature}`;

		const portalUrl = "https://online.nism.ac.in/nismlms/";
		const certificationsUrl = "https://cert.nism.ac.in/dashboard";
		const syllabusUrl = matchedCourse?.syllabusUrl || "https://www.nism.ac.in/certification-examinations/";

		return {
			launchUrl: `${this.lmsBaseUrl}/lti/launch?courseId=${courseId}&token=${idToken}&id_token=${idToken}&state=${state}`,
			portalUrl,
			certificationsUrl,
			syllabusUrl,
			idToken,
			state,
			courseTitle: matchedCourse?.title || courseId.toUpperCase(),
			seriesCode: matchedCourse?.seriesCode || courseId.toUpperCase(),
			agentName,
			agentEmail,
			passingPercentage: matchedCourse?.passingPercentage || 60,
			examFeeInr: matchedCourse?.examFeeInr || 1500,
			cpeCredits: matchedCourse?.cpeCredits || 6,
			launchParams: {
				id_token: idToken,
				state,
				lti_message_type: "LtiResourceLinkRequest",
				lti_version: "1.3.0",
				target_link_uri: `${this.lmsBaseUrl}/course/${courseId}`,
			},
		};
	}

	/**
	 * Ingest xAPI / TinCan learning statement from NISM LMS webhook
	 */
	async ingestXApiStatement(statement: XApiStatement): Promise<{ success: boolean; actionTaken: string }> {
		const startTime = Date.now();
		await this.ensureTables();

		const agentId = statement.actor?.account?.name || statement.actor?.mbox?.replace("mailto:", "");
		if (!agentId) {
			return { success: false, actionTaken: "Missing actor account name (agentId)" };
		}

		// Extract course series or id from object.id
		const objectId = statement.object?.id || "";
		const verbId = statement.verb?.id || "";

		// Match course from DB or in-memory fallback
		let course: { id: string; cpe_credits: number } | undefined;
		try {
			const courseRows = await db.execute(sql`
				SELECT id, cpe_credits FROM nism_lms_courses 
				WHERE ${objectId} ILIKE ('%' || id || '%') OR ${objectId} ILIKE ('%' || series_code || '%')
				LIMIT 1
			`);
			if (courseRows.rows.length > 0) {
				const r = courseRows.rows[0] as any;
				course = { id: r.id, cpe_credits: Number(r.cpe_credits) };
			}
		} catch (err: any) {
			logger.warn("[NismLmsService] DB lookup fallback for xAPI course: " + err.message);
		}

		if (!course) {
			const matched = DEFAULT_COURSES.find(
				(c) => objectId.toLowerCase().includes(c.id.toLowerCase()) || objectId.toUpperCase().includes(c.seriesCode.toUpperCase()),
			);
			if (matched) {
				course = { id: matched.id, cpe_credits: matched.cpeCredits };
			}
		}

		if (!course) {
			return { success: false, actionTaken: `No matching course found for object ${objectId}` };
		}

		const isCompleted = verbId.includes("completed") || verbId.includes("passed");
		const isProgress = verbId.includes("progressed") || verbId.includes("experienced");
		const rawScore = statement.result?.score?.raw ?? (statement.result?.score?.scaled ? Math.round(statement.result.score.scaled * 100) : null);
		const progressPct = isCompleted ? 100 : Math.min(99, rawScore ?? 50);

		if (isCompleted) {
			const certNumber = `NISM-CPE-${Date.now().toString(36).toUpperCase()}`;
			try {
				await db.execute(sql`
					UPDATE nism_course_enrolments
					SET status = 'completed',
						progress_percentage = 100,
						last_score = ${rawScore ?? 80},
						cpe_credits_earned = ${course.cpe_credits},
						certificate_number = ${certNumber},
						completed_at = NOW(),
						last_synced_at = NOW()
					WHERE agent_id = ${agentId} AND course_id = ${course.id}
				`);

				if (course.id === "nism-va") {
					await db.execute(sql`
						UPDATE agent_empanelments
						SET nism_certificate_number = COALESCE(nism_certificate_number, ${certNumber}),
							nism_certificate_type = 'Series V-A Mutual Funds',
							nism_verification_status = 'verified_lms',
							nism_verified_at = NOW(),
							updated_at = NOW()
						WHERE agent_id = ${agentId}
					`);
				}
			} catch (err: any) {
				logger.warn("[NismLmsService] Completion update DB fallback: " + err.message);
			}

			logger.info("NISM_LMS_COURSE_COMPLETED", {
				event: "NISM_LMS_COURSE_COMPLETED",
				userId: agentId,
				courseId: course.id,
				creditsEarned: course.cpe_credits,
				latency_ms: Date.now() - startTime,
				status: "SUCCESS"
			});

			return { success: true, actionTaken: `Marked course ${course.id} as completed (+${course.cpe_credits} CPE credits)` };
		}

		if (isProgress) {
			try {
				await db.execute(sql`
					UPDATE nism_course_enrolments
					SET status = 'in_progress',
						progress_percentage = GREATEST(progress_percentage, ${progressPct}),
						last_score = ${rawScore ?? null},
						last_synced_at = NOW()
					WHERE agent_id = ${agentId} AND course_id = ${course.id}
				`);
			} catch (err: any) {
				logger.warn("[NismLmsService] Progress update DB fallback: " + err.message);
			}

			return { success: true, actionTaken: `Updated course ${course.id} progress to ${progressPct}%` };
		}

		return { success: true, actionTaken: "Statement recorded" };
	}

	/**
	 * Get summary metrics for agent's NISM learning record
	 */
	async getAgentSummary(agentId: string): Promise<{
		totalEnrolled: number;
		totalCompleted: number;
		totalCpeCredits: number;
		certificationsCount: number;
	}> {
		await this.ensureTables();
		try {
			const rows = await db.execute(sql`
				SELECT 
					COUNT(*)::int as total_enrolled,
					COUNT(CASE WHEN status IN ('completed', 'certified') THEN 1 END)::int as total_completed,
					COALESCE(SUM(cpe_credits_earned), 0)::int as total_cpe_credits,
					COUNT(CASE WHEN certificate_number IS NOT NULL THEN 1 END)::int as certifications_count
				FROM nism_course_enrolments
				WHERE agent_id = ${agentId}
			`);

			const r = rows.rows[0] as any;
			return {
				totalEnrolled: r?.total_enrolled || 0,
				totalCompleted: r?.total_completed || 0,
				totalCpeCredits: r?.total_cpe_credits || 0,
				certificationsCount: r?.certifications_count || 0,
			};
		} catch {
			return {
				totalEnrolled: 0,
				totalCompleted: 0,
				totalCpeCredits: 0,
				certificationsCount: 0,
			};
		}
	}

		/**
	 * Helper to resolve at least 10-15 authentic practice questions for any course
	 */
	resolveQuestionsForCourse(courseId: string): NismPracticeQuestion[] {
		const cid = (courseId || "").toLowerCase().trim();
		const matchedCourse = DEFAULT_COURSES.find(
			(c) => c.id.toLowerCase() === cid || c.seriesCode.toLowerCase() === cid,
		) || DEFAULT_COURSES[0];

		// Questions specifically tagged for this course
		let matching = NISM_PRACTICE_BANK.filter(
			(q) => q.courseId.toLowerCase() === matchedCourse.id.toLowerCase(),
		);

		// If fewer than 10 questions exist, augment with core foundational regulatory/compliance questions
		if (matching.length < 10) {
			const generalPool = NISM_PRACTICE_BANK.filter(
				(q) => q.courseId === "nism-va" && !matching.some((m) => m.id === q.id),
			);
			matching = [...matching, ...generalPool].slice(0, 15);
		}

		return matching;
	}

	/**
	 * Retrieve practice test questions for a given NISM course
	 */
	getPracticeQuestions(courseId: string): {
		courseId: string;
		courseTitle: string;
		seriesCode: string;
		passingPercentage: number;
		durationMinutes: number;
		questions: NismPracticeQuestionClient[];
	} {
		const matchedCourse = DEFAULT_COURSES.find(
			(c) => c.id.toLowerCase() === courseId.toLowerCase() || c.seriesCode.toLowerCase() === courseId.toLowerCase(),
		) || DEFAULT_COURSES[0];

		const matching = this.resolveQuestionsForCourse(courseId);

		return {
			courseId: matchedCourse.id,
			courseTitle: matchedCourse.title,
			seriesCode: matchedCourse.seriesCode,
			passingPercentage: matchedCourse.passingPercentage,
			durationMinutes: Math.max(15, matching.length * 2),
			questions: matching.map((q) => ({
				id: q.id,
				question: q.question,
				options: q.options,
				topic: q.topic,
			})),
		};
	}

	/**
	 * Generate AI Remediation Notes for missed questions and weak topics (FASP-AI v1.0)
	 */
	async generateAiRemediationNotes(
		courseTitle: string,
		scorePercentage: number,
		passingPercentage: number,
		weakTopics: string[],
		missedQuestions: Array<{ question: string; correctOption: string; topic: string }>,
	): Promise<string> {
		try {
			const prompt = `You are a SEBI certification exam mentor for wealth managers and financial advisors in India.
The advisor took a practice mock exam for ${courseTitle} and scored ${scorePercentage}% (Passing threshold: ${passingPercentage}%).
Topics needing improvement: ${weakTopics.join(", ") || "Regulatory Compliance"}.

Top missed questions:
${missedQuestions.slice(0, 3).map((q, idx) => `${idx + 1}. ${q.question} -> Key Rule: ${q.correctOption}`).join("\n")}

Provide a high-yield, 3-bullet revision capsule summarizing the exact regulatory rules, statutory thresholds, and formulas to remember for the official exam. Keep each bullet point under 40 words and directly actionable.`;

			const response = await aiService.chat(
				[{ role: "user", content: prompt }],
				{
					capability: AICapability.STANDARD,
					temperature: 0.3,
					maxTokens: 350,
				},
			);

			return response?.content || this.getFallbackRemediationNotes(weakTopics);
		} catch (err: any) {
			logger.warn("[NismLmsService] AI Remediation fallback: " + err.message);
			return this.getFallbackRemediationNotes(weakTopics);
		}
	}

	private getFallbackRemediationNotes(_weakTopics: string[]): string {
		return `• Mutual Fund Cut-Off & NAV Rules: Liquid/Overnight funds have a 1:30 PM cut-off with realization principle; other equity/debt funds use 3:00 PM cut-off.
• Capital Gains & Taxation (Budget 2024): Equity mutual fund LTCG (>12 months) taxed at 12.5% above ₹1.25 Lakh exemption threshold. STCG is taxed at 20%.
• Regulatory Governance: Asset segregation between AMC and Custodian is mandatory; RIAs cannot charge distribution commissions from advisory clients.`;
	}

	/**
	 * Submit and score a practice test attempt with SEBI 0.25 negative marking, topic diagnostics & AI remediation
	 */
	async submitPracticeTest(
		courseId: string,
		answers: Record<string, number>,
		agentId?: string,
	): Promise<NismPracticeTestResult> {
		const startTime = Date.now();
		const matchedCourse = DEFAULT_COURSES.find(
			(c) => c.id.toLowerCase() === courseId.toLowerCase() || c.seriesCode.toLowerCase() === courseId.toLowerCase(),
		) || DEFAULT_COURSES[0];

		const questions = this.resolveQuestionsForCourse(courseId);

		let correctCount = 0;
		let incorrectCount = 0;
		let unansweredCount = 0;

		// Topic diagnostic accumulator
		const topicMap: Record<string, { total: number; correct: number; incorrect: number; unanswered: number }> = {};

		const reviews = questions.map((q) => {
			const selected = answers[q.id];
			const isAnswered = typeof selected === "number";
			const isCorrect = isAnswered && selected === q.correctIndex;

			if (!topicMap[q.topic]) {
				topicMap[q.topic] = { total: 0, correct: 0, incorrect: 0, unanswered: 0 };
			}
			topicMap[q.topic].total += 1;

			if (isCorrect) {
				correctCount++;
				topicMap[q.topic].correct += 1;
			} else if (isAnswered) {
				incorrectCount++;
				topicMap[q.topic].incorrect += 1;
			} else {
				unansweredCount++;
				topicMap[q.topic].unanswered += 1;
			}

			return {
				id: q.id,
				question: q.question,
				options: q.options,
				selectedOptionIndex: isAnswered ? selected : null,
				correctOptionIndex: q.correctIndex,
				isCorrect,
				explanation: q.explanation,
				topic: q.topic,
			};
		});

		// SEBI 0.25 Negative Marking Calculation
		const penaltyPerWrong = 0.25;
		const negativeMarksDeducted = Number((incorrectCount * penaltyPerWrong).toFixed(2));
		const grossScore = correctCount;
		const netRawScore = Math.max(0, Number((grossScore - negativeMarksDeducted).toFixed(2)));
		const scorePercentage = questions.length > 0 ? Math.max(0, Math.round((netRawScore / questions.length) * 100)) : 0;
		const passed = scorePercentage >= matchedCourse.passingPercentage;

		// Topic Diagnostics Calculation
		const topicDiagnostics: NismTopicDiagnostic[] = Object.entries(topicMap).map(([topic, stats]) => {
			const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
			let status: "Proficient" | "Satisfactory" | "Needs Review" = "Needs Review";
			if (accuracy >= 75) status = "Proficient";
			else if (accuracy >= 50) status = "Satisfactory";

			return {
				topic,
				total: stats.total,
				correct: stats.correct,
				incorrect: stats.incorrect,
				unanswered: stats.unanswered,
				accuracyPercentage: accuracy,
				status,
			};
		});

		// AI Remediation
		const weakTopics = topicDiagnostics
			.filter((t) => t.status === "Needs Review")
			.map((t) => t.topic);

		const missedQuestions = reviews
			.filter((r) => !r.isCorrect)
			.map((r) => ({
				question: r.question,
				correctOption: r.options[r.correctOptionIndex],
				topic: r.topic,
			}));

		let summaryNotes = "";
		if (missedQuestions.length > 0) {
			summaryNotes = await this.generateAiRemediationNotes(
				matchedCourse.title,
				scorePercentage,
				matchedCourse.passingPercentage,
				weakTopics,
				missedQuestions,
			);
		} else {
			summaryNotes = "Outstanding performance! You have mastered all tested topics with 100% accuracy. You are primed to clear the official NISM certification examination.";
		}

		const aiCapsule: NismAiRemediationCapsule = {
			generated: true,
			weakTopics,
			summaryNotes,
			recommendedAction: passed
				? "Ready for official exam slot booking at cert.nism.ac.in"
				: "Review weak chapters and retake practice mock before booking slot",
		};

		let empanelmentSynced = false;
		if (passed && agentId && agentId !== "guest-advisor") {
			try {
				await db.execute(sql`
					UPDATE agent_empanelments
					SET nism_certificate_type = COALESCE(nism_certificate_type, ${matchedCourse.seriesCode}),
						nism_verification_status = CASE 
							WHEN nism_verification_status IN ('verified_digilocker', 'verified_lms') THEN nism_verification_status 
							ELSE 'mock_cleared' 
						END,
						nism_score = ${`${scorePercentage}%`},
						updated_at = NOW()
					WHERE agent_id = ${agentId}
				`);

				await db.execute(sql`
					UPDATE nism_course_enrolments
					SET last_score = ${Math.max(0, netRawScore)},
						last_synced_at = NOW()
					WHERE agent_id = ${agentId} AND course_id = ${matchedCourse.id}
				`);
				empanelmentSynced = true;
			} catch (dbErr: any) {
				logger.warn("[NismLmsService] Empanelment sync DB fallback: " + dbErr.message);
			}
		}

		if (agentId) {
			logger.info("NISM_PRACTICE_TEST_SUBMITTED", {
				event: "NISM_PRACTICE_TEST_SUBMITTED",
				userId: agentId,
				courseId: matchedCourse.id,
				grossScore,
				negativeMarksDeducted,
				netRawScore,
				scorePercentage,
				passed,
				empanelmentSynced,
				weakTopicsCount: weakTopics.length,
				latency_ms: Date.now() - startTime,
				status: "SUCCESS"
			});
		}

		return {
			success: true,
			courseId: matchedCourse.id,
			courseTitle: matchedCourse.title,
			seriesCode: matchedCourse.seriesCode,
			totalQuestions: questions.length,
			correctCount,
			incorrectCount,
			unansweredCount,
			penaltyPerWrong,
			negativeMarksDeducted,
			grossScore,
			netRawScore,
			scorePercentage,
			passingPercentage: matchedCourse.passingPercentage,
			passed,
			empanelmentSynced,
			topicDiagnostics,
			aiCapsule,
			reviews,
		};
	}
}

export const nismLmsService = new NismLmsService();
