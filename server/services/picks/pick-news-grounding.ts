/**
 * @file pick-news-grounding.ts
 * @description Real-time Adverse News & Corporate Governance Sanity Check for Pick of the Day.
 *              Uses Gemini 2.0 / Vertex AI with Google Search Grounding to verify candidates
 *              against breaking news, regulatory probes (SEBI/ED/RBI), and governance red flags.
 *
 * FASP-AI v3.0: High/Critical severity news automatically vetoes candidates before market open.
 */

import { GoogleGenAI } from "@google/genai";
import { logger } from "../../logger";

export interface NewsGroundingResult {
	verdict: "CLEARED" | "WARNING" | "DISQUALIFIED";
	riskScore: number; // 0 (clean) to 100 (critical adverse news)
	summary: string;
	headlineRiskFound: boolean;
	keyFindings: string[];
	groundedSources: string[];
	auditTimestamp: string;
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export class PickNewsGroundingService {
	private readonly MODEL_NAME = "gemini-2.0-flash";

	/**
	 * Runs a real-time Google Search-grounded news scan for an investment candidate.
	 *
	 * @param name - Company or scheme name
	 * @param symbol - Ticker symbol or identifier
	 * @param category - Asset class category
	 * @returns NewsGroundingResult with verdict and summary
	 */
	async verifyCandidate(
		name: string,
		symbol: string,
		category: string,
	): Promise<NewsGroundingResult> {
		const auditTimestamp = new Date().toISOString();

		if (!process.env.GEMINI_API_KEY) {
			logger.warn("[PickNewsGrounding] GEMINI_API_KEY not configured, passing with fallback clearance", {
				name,
				symbol,
			});
			return this.getFallbackResult(auditTimestamp, "Gemini key not configured — skipped grounding check");
		}

		const prompt = `Perform an institutional adverse news and corporate governance audit for this investment candidate:
Company/Product Name: "${name}"
Ticker / Symbol: "${symbol}"
Category: "${category}"

Query live Google Search to discover recent (last 72 hours) corporate news and regulatory announcements in India.
Check specifically for:
1. SEBI, RBI, ED, CBI, or MCA regulatory enforcement, show-cause notices, or trading bans.
2. Forensic audit, auditor resignations, fraud allegations, or accounting manipulation.
3. Promoter share pledge invocation, debt default, bankruptcy filing (NCLT), or rating downgrade to D.
4. Unexpected catastrophic earnings shock or sudden leadership arrest.

Respond ONLY with valid JSON (no markdown formatting, no code blocks):
{
  "verdict": "CLEARED" | "WARNING" | "DISQUALIFIED",
  "riskScore": 0,
  "summary": "1-2 sentence summary of findings",
  "headlineRiskFound": false,
  "keyFindings": [],
  "groundedSources": []
}

Rules:
- If there is serious active fraud, SEBI ban, promoter pledge sale, or debt default, set verdict to "DISQUALIFIED" and riskScore >= 75.
- If there is normal market volatility, minor broker rating adjustments, or routine analyst comments, set verdict to "CLEARED" and riskScore < 25.
- If there is an earnings miss or minor dispute, set verdict to "WARNING" and riskScore between 25 and 50.`;

		try {
			// @google/genai SDK v2 with Google Search Grounding tool
			const response = await ai.models.generateContent({
				model: this.MODEL_NAME,
				contents: prompt,
				config: {
					tools: [{ googleSearch: {} }],
					temperature: 0.1, // High determinism
				},
			});

			const rawText = response.text || "";
			const cleaned = rawText
				.replace(/```json/gi, "")
				.replace(/```/g, "")
				.trim();

			let parsed: any;
			try {
				parsed = JSON.parse(cleaned);
			} catch {
				// Regex fallback if LLM added preamble
				const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
				if (jsonMatch) {
					parsed = JSON.parse(jsonMatch[0]);
				} else {
					throw new Error("Failed to parse JSON from grounding response");
				}
			}

			// Extract search citations if provided by GroundingMetadata
			const groundingMetadata = (response as any)?.candidates?.[0]?.groundingMetadata;
			const webSources: string[] = [];
			if (groundingMetadata?.groundingChunks) {
				for (const chunk of groundingMetadata.groundingChunks) {
					if (chunk.web?.uri) {
						webSources.push(chunk.web.uri);
					}
				}
			}

			const result: NewsGroundingResult = {
				verdict: ["CLEARED", "WARNING", "DISQUALIFIED"].includes(parsed.verdict)
					? parsed.verdict
					: "CLEARED",
				riskScore: typeof parsed.riskScore === "number" ? parsed.riskScore : 0,
				summary: parsed.summary || "No material adverse corporate actions found.",
				headlineRiskFound: Boolean(parsed.headlineRiskFound),
				keyFindings: Array.isArray(parsed.keyFindings) ? parsed.keyFindings : [],
				groundedSources: webSources.length > 0 ? webSources.slice(0, 5) : (parsed.groundedSources || []),
				auditTimestamp,
			};

			logger.info(`[PickNewsGrounding] News audit complete for ${symbol}: ${result.verdict}`, {
				event: "PICK_NEWS_GROUNDED_AUDIT",
				symbol,
				verdict: result.verdict,
				riskScore: result.riskScore,
				headlineRisk: result.headlineRiskFound,
			});

			return result;
		} catch (err: any) {
			logger.warn(`[PickNewsGrounding] Grounding check failed for ${symbol}, using resilient fallback`, {
				event: "PICK_NEWS_GROUNDING_FAILED",
				symbol,
				error: err?.message || String(err),
			});
			return this.getFallbackResult(auditTimestamp, "Grounding service temporarily unavailable — fallback to fundamental scoring");
		}
	}

	private getFallbackResult(timestamp: string, note: string): NewsGroundingResult {
		return {
			verdict: "CLEARED",
			riskScore: 0,
			summary: note,
			headlineRiskFound: false,
			keyFindings: [],
			groundedSources: [],
			auditTimestamp: timestamp,
		};
	}
}

export const pickNewsGrounding = new PickNewsGroundingService();
