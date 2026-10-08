import { describe, it, expect } from "vitest";
import { blackLittermanEngine } from "../services/quant/black-litterman-engine";
import { checkRiskBudget } from "../services/portfolio-risk-guard";
import { driftPredictionEngine } from "../services/quant/drift-prediction-engine";

describe("Quant & Decision Support Engine Guardrails", () => {
	describe("1. Black-Litterman Engine Category Mapping & Clamping", () => {
		it("maps POTD categories (listed_stocks, bonds, sgb) to MVO asset classes and constructs views", () => {
			const potdPicks = [
				{
					instrumentName: "Reliance Industries",
					category: "listed_stocks",
					recoPrice: 2800,
					targetPrice: 3100,
					confidenceScore: 80,
				},
				{
					instrumentName: "HDFC 10Y Bond",
					category: "bonds",
					recoPrice: 1000,
					targetPrice: 1080,
					confidenceScore: 75,
				},
				{
					instrumentName: "SGB 2030",
					category: "sgb",
					recoPrice: 7000,
					targetPrice: 7700,
					confidenceScore: 85,
				},
			];

			const views = blackLittermanEngine.convertPotdToViews(potdPicks);
			expect(views.length).toBe(3);

			// MVO portfolio asset categories
			const mvoCategories = ["equity", "debt", "gold", "cash"];

			const { P, Q, Omega } = blackLittermanEngine.buildViewMatrices(views, mvoCategories);

			// Views should match: listed_stocks -> equity (idx 0), bonds -> debt (idx 1), sgb -> gold (idx 2)
			expect(P.length).toBe(3);
			expect(P[0][0]).toBe(1); // listed_stocks mapped to equity
			expect(P[1][1]).toBe(1); // bonds mapped to debt
			expect(P[2][2]).toBe(1); // sgb mapped to gold
			expect(Q.length).toBe(3);
			expect(Omega.length).toBe(3);
		});

		it("clamps view magnitude to 0.25 max to prevent mathematical explosion in posterior returns", () => {
			const extremePick = [
				{
					instrumentName: "Moonshot Unlisted",
					category: "listed_stocks",
					recoPrice: 100,
					targetPrice: 400, // 300% upside
					confidenceScore: 90,
				},
			];

			const views = blackLittermanEngine.convertPotdToViews(extremePick);
			expect(views[0].magnitude).toBeLessThanOrEqual(0.25); // clamped to 25% max annual alpha
			expect(views[0].magnitude).toBe(0.25);
		});
	});

	describe("2. Portfolio Risk Guard - Debt Beta & Conservative Profile", () => {
		it("approves 100% debt portfolio with null betas without false hard breach", () => {
			const debtHoldings = [
				{
					name: "HDFC Liquid Fund",
					weight: 25,
					beta: null, // null beta from DB
					type: "liquid",
					sector: "Money Market",
				},
				{
					name: "ICICI Prudential Corporate Bond Fund",
					weight: 25,
					beta: null, // null beta from DB
					type: "bond",
					sector: "Corporate Debt",
				},
				{
					name: "SBI Gilt Fund",
					weight: 25,
					beta: null, // null beta from DB
					type: "debt",
					sector: "Sovereign Debt",
				},
				{
					name: "Axis Banking & PSU Debt Fund",
					weight: 25,
					beta: null, // null beta from DB
					type: "debt",
					sector: "Banking & PSU",
				},
			];

			const report = checkRiskBudget("port-conservative-1", "conservative", debtHoldings);

			// Should default beta to 0.05 instead of 1.0, yielding weightedBeta ~0.05 <= 0.40 betaCeiling
			expect(report.metrics.weightedBeta).toBeLessThanOrEqual(0.40);
			expect(report.hardBreaches.length).toBe(0);
			expect(report.approved).toBe(true);
		});

		it("strictly blocks high-beta equity portfolio for conservative profile", () => {
			const aggressiveEquityHoldings = [
				{
					name: "Tata Motors",
					weight: 50,
					beta: 1.5,
					type: "equity",
					sector: "Auto",
				},
				{
					name: "Adani Enterprises",
					weight: 50,
					beta: 1.8,
					type: "equity",
					sector: "Metals",
				},
			];

			const report = checkRiskBudget("port-conservative-2", "conservative", aggressiveEquityHoldings);

			// Beta ~1.65 > 0.40 ceiling (exceeds 1.2x hard threshold 0.48)
			expect(report.approved).toBe(false);
			expect(report.hardBreaches.some(b => b.field === "weightedBeta")).toBe(true);
		});
	});

	describe("3. Drift Prediction Engine Breach Detection", () => {
		it("returns 1.0 breach probability when drift has already reached or exceeded tolerance band", () => {
			const features = {
				category: "equity",
				currentWeight: 0.65,
				targetWeight: 0.50,
				currentDrift: 15.0, // 15% drift!
				historicalDriftMean: 2.0,
				historicalDriftStd: 3.0,
				driftVelocity: 0.5,
				driftAcceleration: 0.1,
				categoryVolatility: 0.20,
				daysSinceLastRebalance: 45,
				marketRegime: "NORMAL" as const,
			};

			const toleranceBandPct = 5.0; // band is 5%

			// Call internal computeBreachProbability via engine instance
			const prob = (driftPredictionEngine as any).computeBreachProbability(
				features,
				16.0,
				toleranceBandPct,
				{ driftProbabilityTrigger: 0.7, lookbackDays: 90, emaAlpha: 0.1, volatilityMultiplier: 1.5 }
			);

			expect(prob).toBe(1.0); // Already breached must be 1.0 (not near zero)
		});
	});

	describe("4. Model Portfolio Auto-Rebalance & Weight Normalization Guardrails", () => {
		it("normalizes rebalanced weights to sum to exactly 100.0% without fractional drift", async () => {
			const { applyWeightRebalancing } = await import("../services/portfolio-rebalance-scheduler");
			const holdings = [
				{ name: "Asset A", weight: 45, targetWeight: 33.33, type: "debt" },
				{ name: "Asset B", weight: 35, targetWeight: 33.33, type: "debt" },
				{ name: "Asset C", weight: 20, targetWeight: 33.34, type: "debt" },
			];

			const res = applyWeightRebalancing(holdings, "NORMAL" as any);
			expect(res.corrected).toBeGreaterThan(0);
			const sum = res.updated.reduce((s: number, h: any) => s + Number(h.weight), 0);
			expect(Math.abs(sum - 100)).toBeLessThan(0.0001);
		});

		it("correctly identifies drawdown breaches to pause auto-rebalance", async () => {
			const { checkDrawdownCircuitBreaker } = await import("../services/model-portfolio-quant-service");

			// Conservative profile has 8% threshold (0.08)
			const safeDrawdown = checkDrawdownCircuitBreaker(-5.5, "conservative");
			expect(safeDrawdown.tripped).toBe(false);

			const breachedDrawdown = checkDrawdownCircuitBreaker(-12.4, "conservative");
			expect(breachedDrawdown.tripped).toBe(true);
			expect(breachedDrawdown.threshold).toBe(8);
			expect(breachedDrawdown.message).toContain("Auto-rebalance paused");
		});
	});
});
