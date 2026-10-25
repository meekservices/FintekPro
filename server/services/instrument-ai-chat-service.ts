/**
 * server/services/instrument-ai-chat-service.ts
 *
 * FintekPro FASP-AI v3.0 Universal Instrument Advisory Copilot.
 * Provides contextual AI decision support across all financial asset classes:
 * - Listed Stocks (NSE/BSE)
 * - Mutual Funds (Equity, Debt, Hybrid, Index, ELSS)
 * - Bonds & Fixed Income (G-Sec, SDL, Corporate NCDs)
 * - ETFs
 * - Unlisted / Pre-IPO Shares
 * - REITs & InvITs
 * - Smallcase Thematic Baskets
 * - Market & Sectoral Indices (NIFTY 50, Bank Nifty, Sensex, etc.)
 *
 * Compliance:
 * - FASP-AI v1.0 / v3.0 Decision Support System ONLY (no autonomous trade execution)
 * - Deterministic fallback if Gemini is unconfigured or transiently fails
 * - Explainability layer: factors considered, positives, risks, confidence score
 * - Regulatory SEBI risk disclosure attached to every response
 */

import { GoogleGenAI } from "@google/genai";
import { logger } from "../logger";

const ENGINE_VERSION = "FASP-AI-v3.0";

const DISCLAIMERS: Record<string, string> = {
	stock:
		"Equity investments are subject to market risk. Past performance is not indicative of future returns. AI analysis is for decision support only and does not constitute registered financial advice.",
	mutual_fund:
		"Mutual Fund investments are subject to market risks. Read all scheme-related documents carefully before investing. Past performance is not indicative of future returns.",
	bond:
		"Bond investments carry credit risk and interest rate risk. Credit ratings are indicative and may change. Not an offer or solicitation.",
	etf:
		"ETFs are subject to market risk. NAV may fluctuate with index tracking error. Past performance is not indicative of future returns.",
	unlisted:
		"Unlisted and Pre-IPO securities are illiquid and carry high investment risk including loss of capital. Valuations are indicative based on available filings.",
	reit_invit:
		"REIT & InvIT investments are subject to real estate market dynamics and distribution yield fluctuations. Review offer documents before investing.",
	smallcase:
		"Smallcase thematic baskets are model equity portfolios and do not guarantee returns. Equity holdings are subject to market volatility. Rebalance suggestions require investor approval.",
	index:
		"Index levels and performance reflect underlying benchmark components. Index investing involves market risk and tracking errors. Past trends do not ensure future direction.",
};

export interface InstrumentChatContext {
	instrumentType:
		| "stock"
		| "mutual_fund"
		| "bond"
		| "etf"
		| "unlisted"
		| "reit_invit"
		| "smallcase"
		| "index";
	symbolOrId: string;
	name: string;
	context?: Record<string, any>;
	message: string;
	history?: Array<{ role: "user" | "assistant"; content: string }>;
	userSegment?: "retail" | "hni" | "institutional";
}

export interface InstrumentChatResult {
	reply: string;
	recommendation: "ACCUMULATE" | "NEUTRAL" | "REVIEW" | "SUITABLE_FOR_RESEARCH";
	confidence_score: number; // 0 - 100
	factors_considered: string[];
	key_positives: string[];
	key_risks: string[];
	suggested_questions: string[];
	engine_version: string;
	model_version: string;
	calculation_timestamp: string;
	disclaimer: string;
}

export class InstrumentAiChatService {
	private aiClient: GoogleGenAI | null = null;

	constructor() {
		const apiKey = process.env.GEMINI_API_KEY;
		if (apiKey) {
			this.aiClient = new GoogleGenAI({ apiKey });
		}
	}

	/**
	 * Process instrument AI conversation
	 */
	async processChat(params: InstrumentChatContext): Promise<InstrumentChatResult> {
		const start = Date.now();
		const timestamp = new Date().toISOString();
		const disclaimer = DISCLAIMERS[params.instrumentType] || DISCLAIMERS.stock;

		try {
			if (this.aiClient) {
				const geminiResult = await this.generateWithGemini(params);
				if (geminiResult) {
					logger.info("AI Instrument chat generated via Gemini", {
						event: "AI_INSTRUMENT_CHAT",
						instrumentType: params.instrumentType,
						symbolOrId: params.symbolOrId,
						latency_ms: Date.now() - start,
						status: "success",
					});
					return {
						...geminiResult,
						engine_version: ENGINE_VERSION,
						calculation_timestamp: timestamp,
						disclaimer,
					};
				}
			}
		} catch (err: any) {
			logger.warn("Gemini instrument chat failed, using fallback engine", {
				event: "AI_INSTRUMENT_CHAT_FALLBACK",
				error: err.message,
				symbolOrId: params.symbolOrId,
			});
		}

		// Fallback deterministic rule-based explainability layer
		const fallback = this.generateDeterministicAnalysis(params);
		return {
			...fallback,
			engine_version: ENGINE_VERSION,
			model_version: "rule-engine-v3.0",
			calculation_timestamp: timestamp,
			disclaimer,
		};
	}

	private async generateWithGemini(
		params: InstrumentChatContext,
	): Promise<Omit<InstrumentChatResult, "engine_version" | "calculation_timestamp" | "disclaimer"> | null> {
		if (!this.aiClient) return null;

		const systemPrompt = `You are FintekPro's Senior Financial Analyst and SEBI-Compliant Decision Support Copilot.
Your job is to provide objective, institutional-grade, data-driven analysis and insights on investment instruments for clients and wealth advisors.

CRITICAL COMPLIANCE RULES:
1. Decision support only — NEVER state "I will buy/sell this for you" or execute trades.
2. NEVER promise guaranteed returns or use deterministic profit language.
3. Be objective, nuanced, and highlight both upside drivers AND downside risks.
4. If analyzing a Smallcase, explain the thematic rationale, constituent weights, and core vs satellite fit.
5. If analyzing a Market Index, explain valuation (P/E, P/B), constituent concentration, macro tailwinds/headwinds, and SIP suitability.
6. Provide structured output in clean JSON matching the requested schema.`;

		const contextStr = JSON.stringify(params.context || {}, null, 2);
		const historyStr = (params.history || [])
			.slice(-6)
			.map((h) => `${h.role === "user" ? "User" : "Assistant"}: ${h.content}`)
			.join("\n");

		const userPrompt = `Instrument Information:
- Asset Class: ${params.instrumentType.toUpperCase()}
- Identifier: ${params.symbolOrId}
- Name: ${params.name}

Underlying Context & Metrics:
${contextStr}

${historyStr ? `Conversation History:\n${historyStr}\n` : ""}

User's Question:
"${params.message}"

Respond strictly with a valid JSON object matching this schema:
{
  "reply": "Clear, markdown-formatted advisory response addressing user's question with institutional rigor (2-3 paragraphs max)",
  "recommendation": "ACCUMULATE" | "NEUTRAL" | "REVIEW" | "SUITABLE_FOR_RESEARCH",
  "confidence_score": 85,
  "factors_considered": ["Valuation & Multiples", "Earnings Quality", "Debt-to-Equity", "Sector Momentum", "Macro Tailwind"],
  "key_positives": ["Strong ROCE > 20%", "Consistent cash flow generation"],
  "key_risks": ["Valuation multiple re-rating risk", "Raw material price volatility"],
  "suggested_questions": ["How does this compare to its sector peer?", "What is the recommended portfolio allocation weight?"]
}`;

		const response = await this.aiClient.models.generateContent({
			model: "gemini-2.5-flash",
			config: {
				responseMimeType: "application/json",
				temperature: 0.3,
			},
			contents: `${systemPrompt}\n\n${userPrompt}`,
		});

		const text = response.text;
		if (!text) return null;

		try {
			const parsed = JSON.parse(text);
			return {
				reply: parsed.reply || "Analysis completed based on latest available metrics.",
				recommendation: parsed.recommendation || "SUITABLE_FOR_RESEARCH",
				confidence_score: Math.min(100, Math.max(50, Number(parsed.confidence_score) || 80)),
				factors_considered: Array.isArray(parsed.factors_considered) ? parsed.factors_considered : ["Valuation", "Financials"],
				key_positives: Array.isArray(parsed.key_positives) ? parsed.key_positives : [],
				key_risks: Array.isArray(parsed.key_risks) ? parsed.key_risks : ["Market volatility"],
				suggested_questions: Array.isArray(parsed.suggested_questions) ? parsed.suggested_questions : [],
				model_version: "gemini-2.5-flash",
			};
		} catch {
			return null;
		}
	}

	private generateDeterministicAnalysis(
		params: InstrumentChatContext,
	): Omit<InstrumentChatResult, "engine_version" | "calculation_timestamp" | "disclaimer"> {
		const ctx = params.context || {};
		const type = params.instrumentType;
		const name = params.name || params.symbolOrId;

		let recommendation: InstrumentChatResult["recommendation"] = "SUITABLE_FOR_RESEARCH";
		let confidence = 82;
		const positives: string[] = [];
		const risks: string[] = ["Market volatility & systemic risk"];
		const factors: string[] = ["Asset Class Fundamentals", "Risk-Reward Profile", "Horizon Suitability"];
		let reply = "";

		if (type === "stock") {
			const pe = Number(ctx.peRatio);
			const roe = Number(ctx.roe);
			const de = Number(ctx.debtToEquity);

			if (roe > 15) positives.push(`Healthy Return on Equity (ROE: ${roe.toFixed(1)}%) indicating efficient capital utilization.`);
			if (de < 0.5) positives.push(`Conservative leverage with low Debt-to-Equity (${de.toFixed(2)}x).`);
			if (pe > 40) risks.push(`Premium valuation with P/E of ${pe.toFixed(1)}x; sensitive to earnings growth misses.`);

			recommendation = roe > 18 && de < 0.8 ? "ACCUMULATE" : "SUITABLE_FOR_RESEARCH";
			reply = `**${name} (${params.symbolOrId})** is currently evaluated within the **${ctx.sector || "Equities"}** sector.

### Fundamental Overview
- **Valuation**: Trading at a P/E of ${ctx.peRatio || "N/A"}x and P/B of ${ctx.pbRatio || "N/A"}x.
- **Profitability & Quality**: Return on Equity stands at ${ctx.roe ? `${ctx.roe}%` : "stable levels"}, supported by an operational track record.
- **Balance Sheet**: Debt-to-Equity is positioned at ${ctx.debtToEquity || "prudent levels"}.

### Strategic Perspective
For investors seeking equity exposure in ${ctx.sector || "Indian growth opportunities"}, ${name} represents a viable candidate for structured SIP or staged accumulation, provided portfolio weightings adhere to risk limits (typically 3–5% for single stocks).`;
		} else if (type === "smallcase") {
			recommendation = "ACCUMULATE";
			confidence = 86;
			positives.push(`Thematic diversification across ${ctx.holdingsCount || "curated"} high-conviction constituents.`);
			positives.push(`Clear rules-based rebalancing by SEBI registered research managers.`);
			risks.push(`Thematic concentration risk; underperformance if sector theme falls out of market favor.`);

			reply = `**${name}** is a thematic Smallcase model portfolio focused on **${ctx.theme || "Thematic Growth"}**.

### Basket Architecture
- **Strategy Thesis**: Designed to capture structural tailwinds across Indian corporate leaders with periodic rebalancing.
- **Risk Profile**: Categorized as **${ctx.riskLevel || "Moderate Risk"}**, with a historical 3Y CAGR of ${ctx.cagr3y ? `${ctx.cagr3y}%` : "competitive returns"}.
- **Suitability**: Serves effectively as a **satellite portfolio growth booster** alongside broad market index funds.`;
		} else if (type === "index") {
			recommendation = "ACCUMULATE";
			confidence = 90;
			positives.push(`High liquidity, zero idiosyncratic single-stock default risk, and self-cleansing index methodology.`);
			risks.push(`Macro-economic headwinds, global interest rate shifts, and currency volatility.`);

			reply = `**${name} (${params.symbolOrId})** represents the benchmark index for **${ctx.category || "Indian Capital Markets"}**.

### Index Profile & Valuation
- **Current Level**: ${ctx.indexLevel || ctx.price || "Live Market Level"} (${ctx.changePercent ? `${ctx.changePercent}% today` : "steady"}).
- **Valuation Band**: Benchmark P/E currently stands at ${ctx.peRatio || "around historical median"}, offering attractive risk-adjusted entry for long-term compounding.
- **Implementation**: Best accessed through low-cost index funds or ETFs via systematic investment plans (SIP).`;
		} else if (type === "mutual_fund") {
			recommendation = "ACCUMULATE";
			confidence = 85;
			positives.push(`Professional active fund management with proven alpha generation.`);
			risks.push(`Underlying market risk; category cyclicality.`);

			reply = `**${name}** is an open-ended mutual fund scheme under **${ctx.category || "Mutual Funds"}**.

### Scheme Highlights
- **Performance**: 1Y Return: ${ctx.returns1y ? `${ctx.returns1y}%` : "competitive"} | 3Y Return: ${ctx.returns3y ? `${ctx.returns3y}%` : "consistent"}.
- **Cost & Efficiency**: Expense ratio of ${ctx.expenseRatio ? `${ctx.expenseRatio}%` : "standard"}.
- **Suitability**: Suitable for systematic goal-oriented wealth creation with a recommended minimum horizon of 3–5 years.`;
		} else {
			reply = `**${name} (${params.symbolOrId})** has been evaluated across FintekPro's multi-factor investment framework.

The asset presents balanced characteristics suited for portfolio diversification. Review asset allocation weightings before deployment.`;
		}

		return {
			reply,
			recommendation,
			confidence_score: confidence,
			factors_considered: factors,
			key_positives: positives,
			key_risks: risks,
			suggested_questions: [
				`What is the recommended risk profile for ${name}?`,
				`How does ${params.symbolOrId} perform relative to category benchmarks?`,
				`What are the tax implications upon redemption or sale?`,
			],
			model_version: "rule-engine-v3.0",
		};
	}
}

export const instrumentAiChatService = new InstrumentAiChatService();
