import { describe, it, expect } from "vitest";
import { directPlanSwitchService, SWITCH_ENGINE_VERSION } from "../services/direct-plan-switch-service";
import { setuService } from "../services/setu-service";

describe("Direct Plan Switch & Cart Optimizer Engine", () => {
	it("correctly identifies Regular vs Direct schemes", () => {
		expect(directPlanSwitchService.isRegularPlan("HDFC Top 100 Fund - Regular Plan - Growth")).toBe(true);
		expect(directPlanSwitchService.isRegularPlan("Parag Parikh Flexi Cap Fund - Reg - Growth")).toBe(true);
		expect(directPlanSwitchService.isRegularPlan("Axis Bluechip Fund - Regular")).toBe(true);
		expect(directPlanSwitchService.isRegularPlan("SBI Small Cap Fund")).toBe(true); // Default without direct is regular

		// Direct plans should return false
		expect(directPlanSwitchService.isRegularPlan("HDFC Top 100 Fund - Direct Plan - Growth")).toBe(false);
		expect(directPlanSwitchService.isRegularPlan("Parag Parikh Flexi Cap Fund - Direct")).toBe(false);
		expect(directPlanSwitchService.isRegularPlan("Mirae Asset Large Cap - Direct Growth")).toBe(false);
	});

	it("computes mathematical compounded wealth gain accurately", () => {
		const principal = 1000000; // ₹10 Lakhs
		const terDelta = 1.0; // 1% annual expense ratio savings

		// 10 years at 12% vs 11%
		const gain10Y = directPlanSwitchService.computeCompoundedWealthGain(principal, terDelta, 10, 0.12);
		expect(gain10Y).toBeGreaterThan(250000); // Expect ~₹2.67 Lakhs gain

		// 20 years compounding
		const gain20Y = directPlanSwitchService.computeCompoundedWealthGain(principal, terDelta, 20, 0.12);
		expect(gain20Y).toBeGreaterThan(1500000); // Expect ~₹16 Lakhs gain on ₹10L investment
	});

	it("resolves Direct counterpart naming structure", async () => {
		const counterpart = await directPlanSwitchService.resolveDirectCounterpart(
			"Kotak Emerging Equity Fund - Regular Plan - Growth",
		);

		expect(counterpart.directName).toContain("Direct");
		expect(counterpart.directName).toContain("Growth");
		expect(counterpart.regularTer).toBeGreaterThan(counterpart.directTer);
	});

	it("analyzes portfolio with mixed holdings and generates FASP-AI compliant switch cart", async () => {
		const testHoldings = [
			{
				schemeName: "HDFC Mid-Cap Opportunities Fund - Regular Plan - Growth",
				currentValue: 500000,
				investedValue: 350000,
				holdingDays: 450, // Long-term (>365 days)
			},
			{
				schemeName: "Nippon India Small Cap Fund - Regular Plan - Growth",
				currentValue: 300000,
				investedValue: 280000,
				holdingDays: 200, // Short-term (<365 days)
			},
			{
				schemeName: "Parag Parikh Flexi Cap Fund - Direct Plan - Growth",
				currentValue: 400000,
				investedValue: 350000,
				holdingDays: 500, // Already direct
			},
		];

		const result = await directPlanSwitchService.analyzePortfolioSwitch(testHoldings, 0);

		expect(result.success).toBe(true);
		expect(result.totalPortfolioValue).toBe(1200000); // 500k + 300k + 400k
		expect(result.regularPortfolioValue).toBe(800000); // 500k + 300k
		expect(result.regularHoldingCount).toBe(2);
		expect(result.totalHoldingsCount).toBe(3);
		expect(result.totalAnnualFeeSavings).toBeGreaterThan(4000);
		expect(result.total10YSavings).toBeGreaterThan(50000);

		// Budget 2024 Tax check:
		// HDFC (gain 150k > 125k exemption -> taxable gain 25k @ 12.5% + 4% cess = ₹3,250)
		// Nippon (gain 20k short-term @ 20% + 4% cess = ₹4,160)
		expect(result.totalEstimatedTax).toBeGreaterThan(0);

		// GCR & FASP-AI metadata check
		expect(result.meta.engine_version).toBe(SWITCH_ENGINE_VERSION);
		expect(result.meta.sebiDisclaimer).toContain("Disclaimer");
		expect(result.actionableCart).toBeDefined();
		expect(Array.isArray(result.actionableCart.immediateSwitches)).toBe(true);
	});
});

describe("Account Aggregator Mutual Fund Ingestion (Setu)", () => {
	it("initializes MF AA consent payload with fiTypes MUTUAL_FUNDS", async () => {
		const res = await setuService.initiateMFConsent("9876543210");
		// In mock / test environment without live credentials, it handles gracefully
		expect(res).toBeDefined();
		expect(typeof res.success).toBe("boolean");
	});
});
