import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
	evaluateCrossAssetConcentration,
	resolveCrossAssetTheme,
	MAX_CROSS_ASSET_THEME_EXPOSURE,
} from "../services/picks/cross-asset-concentration-agent";
import { runBearCaseCritique } from "../services/picks/bear-case-critique-agent";
import type { DailyPickData } from "../services/pick-of-the-day-service";

function makePick(overrides: Partial<DailyPickData>): DailyPickData {
	return {
		category: "listed_stocks",
		instrumentId: "TEST-1",
		instrumentName: "Test Instrument",
		symbol: "TEST",
		recoDate: "2026-11-26",
		recoPrice: 100,
		targetPrice: 120,
		stoplossPrice: 90,
		currentPrice: 100,
		status: "live",
		expiryDate: "2026-12-26",
		rationale: "Test rationale",
		riskLevel: "medium",
		timeHorizon: "medium_term",
		confidenceScore: 80,
		sectorCategory: "General",
		keyMetrics: { signal: "strong_buy" },
		...overrides,
	};
}

describe("POTD Cross-Asset Concentration & Bear-Case Critique Agents", () => {
	it("allows up to MAX_CROSS_ASSET_THEME_EXPOSURE picks on the same theme and blocks excess", () => {
		const accepted: DailyPickData[] = [
			makePick({ category: "listed_stocks", instrumentName: "HDFC Bank", symbol: "HDFCBANK", sectorCategory: "Banking" }),
			makePick({ category: "etfs", instrumentName: "Nippon Bank BeES", symbol: "BANKBEES", sectorCategory: "Financials" }),
		];

		const thirdBanking = makePick({
			category: "mutual_funds",
			instrumentName: "SBI Banking & Financial Services Fund",
			symbol: "SBIBANKMF",
			sectorCategory: "Banking",
		});

		const res = evaluateCrossAssetConcentration(thirdBanking, accepted);
		expect(res.normalizedTheme).toBe("banking_financials");
		expect(res.existingThemeCount).toBe(MAX_CROSS_ASSET_THEME_EXPOSURE);
		expect(res.allowed).toBe(false);
		expect(res.reason).toContain("Cross-asset concentration cap");
	});

	it("exempts fixed-income categories (bonds / fixed_deposits) from equity/commodity theme blocking", () => {
		const accepted: DailyPickData[] = [
			makePick({ category: "listed_stocks", instrumentName: "HDFC Bank", symbol: "HDFCBANK", sectorCategory: "Banking" }),
			makePick({ category: "etfs", instrumentName: "Bank BeES", symbol: "BANKBEES", sectorCategory: "Banking" }),
		];
		const bondPick = makePick({
			category: "bonds",
			instrumentName: "HDFC Bank Tier-II Bond",
			symbol: "HDFCBOND",
			sectorCategory: "Banking",
		});

		const res = evaluateCrossAssetConcentration(bondPick, accepted);
		expect(res.allowed).toBe(true);
		expect(res.penaltyApplied).toBe(0);
	});

	it("normalizes precious metals across SGB and MCX commodities", () => {
		expect(resolveCrossAssetTheme(makePick({ category: "sgb", instrumentName: "SGB 2022-23 Series III", symbol: "SGB", sectorCategory: "Gold" }))).toBe("precious_metals");
		expect(resolveCrossAssetTheme(makePick({ category: "commodities", instrumentName: "Gold 24K (MCX LTP)", symbol: "GOLD", sectorCategory: "Precious Metals" }))).toBe("precious_metals");
	});

	it("prevents AMC brand names from falsely classifying broad index ETFs/Funds as banking", () => {
		const sbiSensexEtf = makePick({
			category: "etfs",
			instrumentName: "SBI BSE SENSEX ETF",
			symbol: "SBISENSETF",
			sectorCategory: "Equity - Large Cap",
		});
		expect(resolveCrossAssetTheme(sbiSensexEtf)).toBe("broad_index");

		const axisBondMf = makePick({
			category: "mutual_funds",
			instrumentName: "Axis Corporate Bond Fund - Regular Plan Growth",
			symbol: "141593",
			sectorCategory: "Debt Scheme - Corporate Bond Fund",
		});
		expect(resolveCrossAssetTheme(axisBondMf)).not.toBe("banking_financials");
	});

	it("treats delta-neutral option strategies as market-neutral and exempt from directional equity caps", () => {
		const acceptedWithTwoBanking: DailyPickData[] = [
			makePick({ category: "listed_stocks", instrumentName: "LIFE INSURA CORP OF INDIA", symbol: "LICI", sectorCategory: "Banking & Finance" }),
			makePick({ category: "listed_stocks", instrumentName: "HDFC Bank", symbol: "HDFCBANK", sectorCategory: "Banking" }),
		];

		const ironButterflyDerivative = makePick({
			category: "derivatives",
			instrumentName: "BANKNIFTY Iron Butterfly",
			symbol: "BANKNIFTY",
			sectorCategory: "Banking Index Derivatives",
			keyMetrics: {
				strategy: "Iron Butterfly",
				strategyType: "SELLER",
				outlook: "neutral",
			},
		});

		expect(resolveCrossAssetTheme(ironButterflyDerivative)).toBe("derivatives_market_neutral");

		const check = evaluateCrossAssetConcentration(ironButterflyDerivative, acceptedWithTwoBanking);
		expect(check.allowed).toBe(true);
		expect(check.normalizedTheme).toBe("derivatives_market_neutral");
	});

	it("downgrades strong_buy to buy and adjusts confidence when >= 2 bear-case flags trigger", async () => {
		const stretchedEquity = makePick({
			category: "listed_stocks",
			instrumentName: "Overvalued Tech Ltd",
			recoPrice: 1000,
			targetPrice: 1020, // 2% reward vs 2% SL -> 1.0x R:R (< 1.5x) + tight SL (< 2.5%)
			stoplossPrice: 980,
			confidenceScore: 82,
			keyMetrics: { signal: "strong_buy", peRatio: 62 },
		});

		const critique = await runBearCaseCritique(stretchedEquity, { useAi: false, minConfidenceFloor: 45 });
		expect(critique.flags.length).toBeGreaterThanOrEqual(3);
		expect(critique.downgradedSignal).toBe(true);
		expect(critique.finalSignal).toBe("buy");
		expect(critique.adjustedConfidence).toBeLessThan(82);
		expect(critique.engine_version).toBe("1.0.0");
		expect(critique.calculation_timestamp).toBeTruthy();
	});

	it("skips equity R:R and P/E checks for fixed-income instruments", async () => {
		const fdPick = makePick({
			category: "fixed_deposits",
			instrumentName: "PNB Housing Finance FD",
			recoPrice: 100,
			targetPrice: 108,
			stoplossPrice: 99,
			confidenceScore: 78,
			keyMetrics: { signal: "buy" },
		});

		const critique = await runBearCaseCritique(fdPick, { useAi: false });
		expect(critique.flags).toEqual([]);
		expect(critique.downgradedSignal).toBe(false);
		expect(critique.adjustedConfidence).toBe(78);
	});

	it("configures openai-direct as the final safety-net in AI fallback chains", () => {
		const aiServiceSrc = fs.readFileSync(
			path.resolve(process.cwd(), "server/services/ai-service.ts"),
			"utf8",
		);
		expect(aiServiceSrc).toContain('openaiDirect = process.env.OPENAI_API_KEY');
		expect(aiServiceSrc).toContain('{ provider: "openai-direct", model: "gpt-5-nano" }');
		expect(aiServiceSrc).toContain('{ provider: "openrouter", model: "nvidia/nemotron-3.5-lightning:free" }');
		expect(aiServiceSrc).toContain('{ provider: "groq", model: "qwen/qwen3.8-27b" }');
		expect(aiServiceSrc).toContain('{ provider: "gemini", model: "gemini-3.5-flash" }');
		expect(aiServiceSrc).toContain('{ provider: "gemini", model: "gemini-3.5-flash-lite" }');
	});

	it("enforces $20 OpenAI paid fallback budget guardrails and Iris-CFO pause/cap controls", async () => {
		const { aiService } = await import("../services/ai-service");
		const initial = aiService.getOpenAIBudgetStatus();
		expect(initial.totalCreditsUsd).toBe(20);
		expect(initial.freeTierFirstEnforced).toBe(true);
		expect(initial.fallbackModel).toBe("gpt-5-nano");
		expect(initial.canUsePaidFallback).toBe(true);

		const paused = aiService.updateOpenAIBudgetConfig({ paused: true, dailyCapUsd: 0.25 });
		expect(paused.paused).toBe(true);
		expect(paused.dailyCapUsd).toBe(0.25);
		expect(paused.canUsePaidFallback).toBe(false);
		expect(paused.blockReason).toContain("Paused");

		const resumed = aiService.updateOpenAIBudgetConfig({ paused: false, dailyCapUsd: 0.5 });
		expect(resumed.paused).toBe(false);
		expect(resumed.canUsePaidFallback).toBe(true);
	});
});
