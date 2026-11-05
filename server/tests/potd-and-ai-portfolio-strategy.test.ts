import { describe, it, expect } from "vitest";
import { checkRiskBudget } from "../services/portfolio-risk-guard";
import {
	getRiskGuardLimits,
	computeGuardedPortfolioWeights,
} from "../../shared/portfolio-guardrails";

describe("POTD & AI Portfolio Strategy Engine Guardrail Verification", () => {
	describe("1. FASP-AI v3.0 / APRE §5.2 Guarded Portfolio Weights Calibration", () => {
		const sampleStocks = [
			{ id: "s1", symbol: "TCS", companyName: "Tata Consultancy Services", sector: "IT", confidence: 95 },
			{ id: "s2", symbol: "INFY", companyName: "Infosys Ltd", sector: "IT", confidence: 90 },
			{ id: "s3", symbol: "HDFCBANK", companyName: "HDFC Bank Ltd", sector: "Banking", confidence: 85 },
			{ id: "s4", symbol: "ICICIBANK", companyName: "ICICI Bank Ltd", sector: "Banking", confidence: 80 },
			{ id: "s5", symbol: "RELIANCE", companyName: "Reliance Industries", sector: "Energy", confidence: 75 },
		];

		it("correctly identifies risk guard limits by profile", () => {
			const consLimits = getRiskGuardLimits("conservative", 5);
			expect(consLimits.maxSingleWeight).toBe(30);
			expect(consLimits.maxSectorWeight).toBe(45);
			expect(consLimits.minFloor).toBe(5);

			const modLimits = getRiskGuardLimits("moderate", 5);
			expect(modLimits.maxSingleWeight).toBe(25);
			expect(modLimits.maxSectorWeight).toBe(40);
			expect(modLimits.minFloor).toBe(4);

			const aggLimits = getRiskGuardLimits("aggressive", 5);
			expect(aggLimits.maxSingleWeight).toBe(20);
			expect(aggLimits.maxSectorWeight).toBe(35);
			expect(aggLimits.minFloor).toBe(3);

			const highLimits = getRiskGuardLimits("high", 5);
			expect(highLimits.maxSingleWeight).toBe(15);
			expect(highLimits.maxSectorWeight).toBe(30);
			expect(highLimits.minFloor).toBe(2);
		});

		it("enforces conservative concentration caps and sums to exact 100.00%", () => {
			const weights = computeGuardedPortfolioWeights(sampleStocks, "conservative");
			const total = Object.values(weights).reduce((a, b) => a + b, 0);
			expect(Math.abs(total - 100)).toBeLessThan(0.001);

			// Every stock must be <= 30%
			for (const w of Object.values(weights)) {
				expect(w).toBeLessThanOrEqual(30.01);
				expect(w).toBeGreaterThanOrEqual(4.99); // min floor 5%
			}

			// IT sector (s1 + s2) must be <= 45%
			const itSectorTotal = (weights["s1"] || 0) + (weights["s2"] || 0);
			expect(itSectorTotal).toBeLessThanOrEqual(45.01);
		});

		it("enforces high risk profile single stock cap (15%) and sums to 100.00%", () => {
			const eightStocks = [
				...sampleStocks,
				{ id: "s6", symbol: "SBIN", sector: "Banking", confidence: 85 },
				{ id: "s7", symbol: "LT", sector: "Infrastructure", confidence: 90 },
				{ id: "s8", symbol: "ITC", sector: "FMCG", confidence: 80 },
			];
			const weights = computeGuardedPortfolioWeights(eightStocks, "high");
			const total = Object.values(weights).reduce((a, b) => a + b, 0);
			expect(Math.abs(total - 100)).toBeLessThan(0.001);

			for (const w of Object.values(weights)) {
				expect(w).toBeLessThanOrEqual(15.01);
			}
		});

		it("validates 5-stock AI portfolio strategy through checkRiskBudget", () => {
			const holdings = [
				{ name: "TCS", weight: 20, sector: "IT", type: "equity", currentReturn: 18 },
				{ name: "INFY", weight: 20, sector: "IT", type: "equity", currentReturn: 14 },
				{ name: "HDFCBANK", weight: 20, sector: "Banking", type: "equity", currentReturn: 12 },
				{ name: "ICICIBANK", weight: 20, sector: "Banking", type: "equity", currentReturn: 16 },
				{ name: "RELIANCE", weight: 20, sector: "Energy", type: "equity", currentReturn: 10 },
			];

			const report = checkRiskBudget("ai-strategy-test", "moderate", holdings);
			expect(report.approved).toBe(true);
			expect(report.hardBreaches.length).toBe(0);
			expect(report.metrics.maxSingleWeight).toBe(20);
			expect(report.metrics.maxSectorWeight).toBe(40);
			expect(report.riskScore).toBeLessThan(50);
		});

		it("blocks aggressive single-stock concentration exceeding budget ceiling", () => {
			const breachedHoldings = [
				{ name: "Penny Stock A", weight: 65, sector: "IT", type: "equity", beta: 1.8 },
				{ name: "Stock B", weight: 35, sector: "Energy", type: "equity", beta: 1.5 },
			];

			const report = checkRiskBudget("ai-strategy-breach", "conservative", breachedHoldings);
			expect(report.approved).toBe(false);
			expect(report.hardBreaches.some((b) => b.field === "maxSingleWeight")).toBe(true);
		});
	});
});
