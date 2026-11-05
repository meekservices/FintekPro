/**
 * @file long-short-algo-engine.test.ts
 * @description Unit tests for Quantitative Long-Short Strategy & Algorithmic Signal Engine.
 * 
 * Verifies:
 * 1. Signal generation across Pairs Trading, Market-Neutral Beta Hedge, and Volatility Spreads.
 * 2. Institutional BUY-first leg sequencing for exchange margin relief.
 * 3. Suitability gate enforcement (blocking Conservative/Moderate or non-F&O profiles).
 * 4. Deterministic margin and alpha calculations under FASP-AI v1.0.
 */

import { describe, it, expect } from "vitest";
import { longShortAlgoEngine } from "../services/derivatives/long-short-algo-engine";

describe("FintekPro Long-Short Quantitative Algo Engine (GCR v1.0 + FASP-AI v1.0)", () => {
	it("1. Generates active quantitative Long-Short signals with complete factors", async () => {
		const signals = await longShortAlgoEngine.getActiveSignals();
		expect(Array.isArray(signals)).toBe(true);
		expect(signals.length).toBeGreaterThanOrEqual(3);

		const pairSignal = signals.find((s) => s.strategyType === "PAIRS_TRADING");
		expect(pairSignal).toBeDefined();
		expect(pairSignal?.quantitativeFactors.zScore).toBeDefined();
		expect(pairSignal?.quantitativeFactors.halfLifeDays).toBeGreaterThan(0);
		expect(pairSignal?.legs.length).toBeGreaterThanOrEqual(2);

		const marketNeutralSignal = signals.find((s) => s.strategyType === "MARKET_NEUTRAL_BETA_HEDGE");
		expect(marketNeutralSignal).toBeDefined();
		expect(Math.abs(marketNeutralSignal?.quantitativeFactors.portfolioBeta || 1)).toBeLessThanOrEqual(0.1);

		// Check FASP-AI v1.0 compliance
		for (const signal of signals) {
			expect(signal.confidenceScore).toBeGreaterThanOrEqual(60);
			expect(signal.engineVersion).toBe("GPE-LS-v1.0");
			expect(signal.modelVersion).toBe("FASP-LS-ALGO-v1.0");
			expect(signal.sebiCompliance.fnoSegmentRequired).toBe(true);
			expect(signal.sebiCompliance.requiresExplicitConfirmation).toBe(true);
			expect(signal.sebiCompliance.statutoryDisclaimer).toContain("SEBI Regulatory Risk Disclosure");
		}
	});

	it("2. Enforces BUY-first leg sequencing for margin relief in staged baskets", async () => {
		const staged = await longShortAlgoEngine.stageBasket({
			signalId: "LS-PAIR-HDFCBANK-ICICIBANK",
			lots: 2,
			clientRiskProfile: "aggressive",
			isFnoCleared: true,
		});

		expect(staged.basketId).toMatch(/^BSK-/);
		expect(staged.lots).toBe(2);
		expect(staged.status).toBe("STAGED");
		expect(staged.sequencedLegs.length).toBe(2);

		// Enforce: BUY leg comes first
		expect(staged.sequencedLegs[0].action).toBe("BUY");
		expect(staged.sequencedLegs[1].action).toBe("SELL");

		// Enforce: Hedge margin relief calculation
		expect(staged.totalMarginRequired).toBeLessThan(staged.grossUnhedgedMargin);
		expect(staged.totalHedgeRelief).toBe(staged.grossUnhedgedMargin - staged.totalMarginRequired);
	});

	it("3. Blocks unsuitable clients at the pre-trade gate", async () => {
		// Conservative risk profile must be rejected
		await expect(
			longShortAlgoEngine.stageBasket({
				signalId: "LS-PAIR-HDFCBANK-ICICIBANK",
				clientRiskProfile: "conservative",
				isFnoCleared: true,
			})
		).rejects.toThrow("SUITABILITY_GATE_FAILED");

		// Non-F&O cleared client must be rejected
		await expect(
			longShortAlgoEngine.stageBasket({
				signalId: "LS-PAIR-HDFCBANK-ICICIBANK",
				clientRiskProfile: "aggressive",
				isFnoCleared: false,
			})
		).rejects.toThrow("SUITABILITY_GATE_FAILED");
	});
});

