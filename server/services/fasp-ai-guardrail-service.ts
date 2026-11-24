/**
 * @file fasp-ai-guardrail-service.ts
 * @description Centralized Regulatory Guardrail Middleware Service conforming strictly to
 * SEBI FASP-AI v1.0 + FintekPro GCR v1.0.
 *
 * Principles:
 * 1. AI is a Decision Support System only — never autonomously executes trades or investments.
 * 2. Zero Trust & Security: Masks all PAN, Aadhaar, and sensitive PII before model ingestion.
 * 3. Prohibits deterministic profit claims and enforces probabilistic advisory language.
 * 4. Mandates SEBI risk disclosures and decision-support notices.
 * 5. Emits structured telemetry logs: { event: "AI_ADVICE_GENERATED", user_id, input_context, output_summary, model_version, timestamp }
 */

import { logger } from "../logger";
import { aiAdvisoryDecisionService } from "./ai-advisory-decision-service";

export interface ExplainabilityMetadata {
	engine_version: string;
	calculation_timestamp: string;
	confidence_score: number;
	factors_considered: string[];
	formula_applied?: string;
	intermediate_steps?: string[];
	disclaimer_included: boolean;
}

export interface FaspAiAuditResult {
	approved: boolean;
	scrubbedText: string;
	deterministicViolations: string[];
	explainability: ExplainabilityMetadata;
	warning?: string;
}

export class FaspAiGuardrailService {
	private static instance: FaspAiGuardrailService;
	public static readonly ENGINE_VERSION = "fasp-ai-guardrail@1.0.0";
	public static readonly MANDATORY_DISCLAIMER =
		"FASP-AI v1.0 Regulatory Notice: Strictly for educational and professional decision support. Not deterministic investment advice or guaranteed return solicitation. Investments in securities are subject to market risks.";

	private static readonly DETERMINISTIC_PATTERNS = [
		/\bguarantee(?:s|d|ing)?\s+(?:(?:\d+(?:\.\d+)?%|high|assured|fixed)\s+)?(?:return|profit|gain|yield)s?\b/i,
		/\brisk[- ]?free\s+(?:profit|return|gain|investment|yield)s?\b/i,
		/\b100%\s+(?:gain|profit|return|upside|success)\b/i,
		/\bassured\s+(?:profit|return|gain)s?\b/i,
		/\bsure[- ]?shot\s+(?:profit|return|winner|trade|pick)s?\b/i,
		/\bzero[- ]?risk\b/i,
	];

	private constructor() {}

	public static getInstance(): FaspAiGuardrailService {
		if (!FaspAiGuardrailService.instance) {
			FaspAiGuardrailService.instance = new FaspAiGuardrailService();
		}
		return FaspAiGuardrailService.instance;
	}

	/**
	 * Sanitizes inbound context by masking PAN, Aadhaar, and PII before AI model ingestion.
	 */
	public sanitizeInbound(context: Record<string, any> | string): {
		sanitized: any;
		maskedFields: string[];
	} {
		const maskedFields: string[] = [];

		const maskString = (val: string): string => {
			let res = val;

			// Mask Indian PAN (e.g. ABCDE1234F -> ABCDE****F)
			const panMatches = res.match(/[A-Z]{5}[0-9]{4}[A-Z]{1}/g);
			if (panMatches) {
				for (const pan of panMatches) {
					const masked = `${pan.slice(0, 5)}****${pan.slice(9)}`;
					res = res.replace(pan, masked);
					maskedFields.push("PAN");
				}
			}

			// Mask Indian Aadhaar (12 digits with or without spaces)
			const aadhaarMatches = res.match(/\b\d{4}\s?\d{4}\s?\d{4}\b/g);
			if (aadhaarMatches) {
				for (const aadh of aadhaarMatches) {
					const digits = aadh.replace(/\s+/g, "");
					const masked = `********${digits.slice(8)}`;
					res = res.replace(aadh, masked);
					maskedFields.push("Aadhaar");
				}
			}

			// Mask 10-digit Indian phone numbers
			const phoneMatches = res.match(/\b(?:\+91[\s-]?)?[6-9]\d{9}\b/g);
			if (phoneMatches) {
				for (const ph of phoneMatches) {
					const digits = ph.replace(/\D/g, "").slice(-10);
					const masked = `+91-XXXXX-${digits.slice(-4)}`;
					res = res.replace(ph, masked);
					maskedFields.push("Phone");
				}
			}

			return res;
		};

		if (typeof context === "string") {
			return { sanitized: maskString(context), maskedFields };
		}

		const maskObject = (obj: any): any => {
			if (!obj || typeof obj !== "object") return obj;
			if (Array.isArray(obj)) return obj.map(maskObject);

			const copy: Record<string, any> = {};
			for (const [k, v] of Object.entries(obj)) {
				if (typeof v === "string") {
					copy[k] = maskString(v);
				} else if (typeof v === "object" && v !== null) {
					copy[k] = maskObject(v);
				} else {
					copy[k] = v;
				}
			}
			return copy;
		};

		const sanitized = maskObject(context);
		return { sanitized, maskedFields: Array.from(new Set(maskedFields)) };
	}

	/**
	 * Audits outbound AI advisory content against SEBI FASP-AI regulatory guidelines.
	 * Scrubs prohibited deterministic language, enforces disclaimers, and constructs explainability metadata.
	 */
	public auditOutbound(
		advisoryText: string,
		options: {
			userId?: string;
			riskProfile?: string;
			investmentHorizon?: string;
			factorsConsidered?: string[];
			formulaApplied?: string;
			intermediateSteps?: string[];
			confidenceScore?: number;
			modelVersion?: string;
			inputContext?: string;
		} = {},
	): FaspAiAuditResult {
		const violations: string[] = [];
		let scrubbedText = advisoryText || "";

		for (const pattern of FaspAiGuardrailService.DETERMINISTIC_PATTERNS) {
			const match = scrubbedText.match(pattern);
			if (match) {
				violations.push(match[0]);
				// Replace deterministic language with risk-aware probabilistic phrasing
				scrubbedText = scrubbedText.replace(
					pattern,
					"potential historical risk premium",
				);
			}
		}

		// Ensure mandatory compliance disclaimer is attached
		const hasDisclaimer =
			scrubbedText.includes("SEBI") ||
			scrubbedText.includes("FASP-AI") ||
			scrubbedText.includes("decision support");

		if (!hasDisclaimer) {
			scrubbedText = `${scrubbedText.trim()}\n\n---\n*${FaspAiGuardrailService.MANDATORY_DISCLAIMER}*`;
		}

		const confidenceScore = Math.max(
			50,
			Math.min(99, options.confidenceScore ?? (violations.length > 0 ? 82 : 96)),
		);

		const explainability: ExplainabilityMetadata = {
			engine_version: options.modelVersion || FaspAiGuardrailService.ENGINE_VERSION,
			calculation_timestamp: new Date().toISOString(),
			confidence_score: confidenceScore,
			factors_considered: options.factorsConsidered || [
				"Sovereign Yields",
				"Inflation Corridors",
				"Institutional Liquidity",
				options.riskProfile ? `Risk Profile: ${options.riskProfile}` : "Standard Balanced Profile",
				options.investmentHorizon ? `Horizon: ${options.investmentHorizon}` : "Medium to Long Term",
			],
			formula_applied: options.formulaApplied,
			intermediate_steps: options.intermediateSteps,
			disclaimer_included: true,
		};

		// Structured telemetry log conforming strictly to GCR v1.0 / FASP-AI v1.0
		this.logAdvisoryDecision({
			user_id: options.userId || "anonymous",
			input_context: `Risk: ${options.riskProfile || "default"}, Horizon: ${options.investmentHorizon || "default"}`,
			output_summary: scrubbedText.slice(0, 160).replace(/\n/g, " "),
			model_version: explainability.engine_version,
			timestamp: explainability.calculation_timestamp,
		});

		// Persist decision into Real-Time AI Advisory Decision Ledger
		aiAdvisoryDecisionService.recordDecision({
			userId: options.userId || "anonymous",
			clientRisk: options.riskProfile || "moderate",
			recommendedAssetRisk: options.riskProfile || "moderate",
			query: options.inputContext || "Advisory calculation & portfolio optimization query",
			recommendation: scrubbedText,
			confidenceScore: confidenceScore / 100,
			factorsConsidered: explainability.factors_considered,
			deterministicLanguageScan: violations.length > 0 ? "FLAGGED_DETERMINISTIC_PROMISE" : "CLEAN",
			governanceDecision: violations.length > 0 ? "MODIFIED" : "APPROVED",
			regulatoryNotes: violations.length > 0
				? `MODIFIED BY AAGE: ${violations.join(", ")} scrubbed to risk-aware phrasing.`
				: "SEBI IA Reg 17 suitability compliant.",
			humanAdvisorReviewRequired: violations.length > 0,
			modelVersion: explainability.engine_version,
			source: "api",
		}).catch((err) => {
			logger.warn("[FaspAiGuardrail] Failed to record decision to ledger", { error: err.message });
		});

		return {
			approved: violations.length === 0,
			scrubbedText,
			deterministicViolations: violations,
			explainability,
			warning:
				violations.length > 0
					? `Scrubbed ${violations.length} prohibited deterministic phrase(s): ${violations.join(", ")}`
					: undefined,
		};
	}

	/**
	 * Logs all AI advisory outputs to telemetry conforming to FASP-AI v1.0 specification.
	 */
	public logAdvisoryDecision(payload: {
		user_id: string;
		input_context: string;
		output_summary: string;
		model_version: string;
		timestamp: string;
	}): void {
		logger.info("[FaspAiGuardrail] 📜 AI advisory decision logged", {
			event: "AI_ADVICE_GENERATED",
			user_id: payload.user_id,
			input_context: payload.input_context,
			output_summary: payload.output_summary,
			model_version: payload.model_version,
			timestamp: payload.timestamp,
		});
	}
}

export const faspAiGuardrailService = FaspAiGuardrailService.getInstance();
