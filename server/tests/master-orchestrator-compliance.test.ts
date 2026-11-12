import { describe, it, expect } from "vitest";
import { failOrchestrator } from "../services/fail-orchestrator";
import { taxAmendmentService, TAX_AMENDMENT_ENGINE_VERSION } from "../services/tax-amendment-service";

describe("Master Orchestrator & Regulatory Drift Engine", () => {
	it("retrieves master orchestrator state with sub-engines", async () => {
		const state = await failOrchestrator.getSystemState();
		expect(state).toBeDefined();
		expect(state.orchestratorVersion).toBe("FAIL-v1.0.0");
		expect(Array.isArray(state.subEngines)).toBe(true);
		expect(state.subEngines.length).toBeGreaterThan(0);
	});

	it("verifies tax amendment service exposes date-effective statutory rules", () => {
		expect(TAX_AMENDMENT_ENGINE_VERSION).toBeDefined();
		const amendments = taxAmendmentService.listAmendments();
		expect(Array.isArray(amendments)).toBe(true);
		expect(amendments.length).toBeGreaterThanOrEqual(1);

		for (const amendment of amendments) {
			expect(amendment.amendmentId).toBeDefined();
			expect(amendment.statutorySource).toBeDefined();
			expect(amendment.verificationHash).toBeDefined();
			expect(amendment.verificationHash.length).toBe(64); // SHA-256
		}
	});

	it("resolves date-effective capital gains rules under Section 112A correctly", () => {
		// Pre-amendment transaction (before July 23, 2024)
		const preRule = taxAmendmentService.resolveCapitalGainsRule({
			assetClass: "equity",
			transactionDate: new Date("2024-05-10T10:00:00Z"),
		});
		expect(preRule.stcgRate).toBe(0.15);
		expect(preRule.ltcgRate).toBe(0.10);
		expect(preRule.ltcgExemptionLimit).toBe(100000);

		// Post-amendment transaction (after July 23, 2024)
		const postRule = taxAmendmentService.resolveCapitalGainsRule({
			assetClass: "equity",
			transactionDate: new Date("2024-08-15T10:00:00Z"),
		});
		expect(postRule.stcgRate).toBe(0.20);
		expect(postRule.ltcgRate).toBe(0.125);
		expect(postRule.ltcgExemptionLimit).toBe(125000);
	});
});
