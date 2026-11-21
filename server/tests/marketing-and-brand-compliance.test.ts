import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("FintekPro Brand, Trademark & SEBI Advertising Compliance (BT-AC v1.0)", () => {
	const rootDir = path.resolve(__dirname, "../..");
	const pricingPagePath = path.join(rootDir, "client/src/pages/pricing.tsx");
	const globalRulesPath = path.join(rootDir, "docs/FINTEKPRO_GLOBAL_CODING_RULES.md");
	const systemRulesPath = path.join(rootDir, "SYSTEM_RULES.md");
	const agentPolicyPath = path.join(rootDir, ".agents/rules/brand-and-marketing-compliance-policy.md");
	const standaloneDocPolicyPath = path.join(rootDir, "docs/BRAND_AND_MARKETING_COMPLIANCE_POLICY.md");
	const multiRegPolicyPath = path.join(rootDir, "ai-policy/multi_regulator_ai_compliance_policy.md");

	it("pricing page uses compliant 'Wall Street Analytics' badge and has zero 'Bloomberg Terminal' claims", () => {
		const content = fs.readFileSync(pricingPagePath, "utf-8");
		expect(content).toContain("Wall Street Analytics, Built for Indian Investors");
		expect(content).not.toContain("Bloomberg Terminal for Indian Investors");
		expect(content).not.toContain("Bloomberg Terminal");
	});

	it("ensures all client pages are free of unauthorized proprietary trademarks and deceptive claims", () => {
		const pagesDir = path.join(rootDir, "client/src/pages");
		const pageFiles = fs.readdirSync(pagesDir).filter((f) => f.endsWith(".tsx"));

		const prohibitedPatterns = [
			/Bloomberg\s+Terminal/i,
			/Reuters\s+Eikon\s+for/i,
			/FactSet\s+for\s+Indian/i,
			/Robinhood\s+of\s+India/i,
			/guaranteed\s+\d+%\s+returns/i,
			/sure-shot\s+profit/i,
			/risk-free\s+profit/i,
		];

		const violations: string[] = [];

		for (const file of pageFiles) {
			const filePath = path.join(pagesDir, file);
			const code = fs.readFileSync(filePath, "utf-8");
			for (const pattern of prohibitedPatterns) {
				if (pattern.test(code)) {
					violations.push(`${file} matches forbidden pattern: ${pattern}`);
				}
			}
		}

		expect(violations).toEqual([]);
	});

	it("verifies global coding rules mandate Section 8: Brand, Trademark & Advertising Compliance", () => {
		const content = fs.readFileSync(globalRulesPath, "utf-8");
		expect(content).toContain("## 8. Brand, Trademark & Advertising Compliance (GCR BT-AC v1.0)");
		expect(content).toContain("Zero Third-Party Trademark Appropriation");
		expect(content).toContain("Wall Street Analytics, Built for Indian Investors");
	});

	it("verifies SYSTEM_RULES.md defines Rule 34: Brand, Trademark & SEBI Advertising Compliance Policy", () => {
		const content = fs.readFileSync(systemRulesPath, "utf-8");
		expect(content).toContain("34. BRAND, TRADEMARK & SEBI ADVERTISING COMPLIANCE POLICY (BT-AC v1.0)");
		expect(content).toContain("NEVER appropriate proprietary commercial trademarks");
	});

	it("verifies .agents/rules/ and docs/ brand-and-marketing-compliance-policy.md exist with non-negotiable invariants", () => {
		expect(fs.existsSync(agentPolicyPath)).toBe(true);
		expect(fs.existsSync(standaloneDocPolicyPath)).toBe(true);
		const content = fs.readFileSync(standaloneDocPolicyPath, "utf-8");
		expect(content).toContain("BRAND-POLICY v1.0");
		expect(content).toContain("SEBI (Investment Advisers) Regulations");
		expect(content).toContain("Trade Marks Act, 1999");
	});

	it("verifies multi-regulator AI compliance framework has Section 2.4 trademark guardrail", () => {
		const content = fs.readFileSync(multiRegPolicyPath, "utf-8");
		expect(content).toContain("2.4 Brand, Trademark & Advertising Compliance Guardrail");
	});
});
