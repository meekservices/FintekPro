/**
 * @file fasp-ai-guardrail.test.ts
 * @description Unit tests for the FASP-AI Regulatory Guardrail Middleware Service.
 * Verifies PII masking, deterministic language scrubbing, mandatory disclaimers,
 * and structured telemetry logging.
 */

import { describe, it, expect } from "vitest";
import { faspAiGuardrailService } from "../services/fasp-ai-guardrail-service";

describe("FASP-AI Regulatory Guardrail Middleware Service (FASP-AI v1.0)", () => {
	it("masks Indian PAN, Aadhaar, and phone numbers in inbound context", () => {
		const rawContext = {
			clientName: "Rahul Sharma",
			pan: "ABCDE1234F",
			aadhaar: "1234 5678 9012",
			phone: "+91 9876543210",
			portfolioValue: 2500000,
		};

		const { sanitized, maskedFields } = faspAiGuardrailService.sanitizeInbound(rawContext);

		expect(sanitized.pan).toBe("ABCDE****F");
		expect(sanitized.aadhaar).toBe("********9012");
		expect(sanitized.phone).toContain("XXXXX-3210");
		expect(sanitized.portfolioValue).toBe(2500000);
		expect(maskedFields).toContain("PAN");
		expect(maskedFields).toContain("Aadhaar");
		expect(maskedFields).toContain("Phone");
	});

	it("detects and scrubs prohibited deterministic profit claims", () => {
		const rawAdvisory =
			"This momentum basket guarantees 25% return over the next 6 months with zero risk.";

		const audit = faspAiGuardrailService.auditOutbound(rawAdvisory, {
			riskProfile: "Aggressive",
			investmentHorizon: "1 Year",
		});

		expect(audit.approved).toBe(false);
		expect(audit.deterministicViolations.length).toBeGreaterThan(0);
		expect(audit.scrubbedText).not.toContain("guarantees 25% return");
		expect(audit.scrubbedText).toContain("potential historical risk premium");
		expect(audit.explainability.disclaimer_included).toBe(true);
	});

	it("attaches the mandatory SEBI FASP-AI Decision Support disclaimer if missing", () => {
		const cleanAdvisory =
			"Based on positive yield curve term spreads and resilient corporate balance sheets, multi-asset allocation remains constructive.";

		const audit = faspAiGuardrailService.auditOutbound(cleanAdvisory);

		expect(audit.approved).toBe(true);
		expect(audit.scrubbedText).toContain("FASP-AI v1.0 Regulatory Notice");
		expect(audit.scrubbedText).toContain("Strictly for educational and professional decision support");
		expect(audit.explainability.confidence_score).toBeGreaterThanOrEqual(90);
	});

	it("generates complete explainability layer with factors considered and timestamp", () => {
		const advisory = "Sovereign 10-year G-Sec at 6.79% offers attractive real yields.";
		const audit = faspAiGuardrailService.auditOutbound(advisory, {
			riskProfile: "Conservative",
			investmentHorizon: "3 Years",
			factorsConsidered: ["CCIL Sovereign Yields", "Headline CPI at 6.21%", "RBI Repo at 6.50%"],
		});

		expect(audit.explainability).toBeDefined();
		expect(audit.explainability.engine_version).toContain("fasp-ai");
		expect(audit.explainability.factors_considered).toContain("CCIL Sovereign Yields");
		expect(audit.explainability.factors_considered).toContain("Headline CPI at 6.21%");
		expect(audit.explainability.calculation_timestamp).toBeDefined();
	});
});
