import { describe, it, expect } from "vitest";
import { multiExchangeMarketService } from "../services/multi-exchange-market-service";
import { amcResearchService } from "../services/amc-research-service";

describe("Multi-Exchange Market Service", () => {
	it("returns valid BSE, GIFT Nifty, Institutional Flows, and NCDEX data", async () => {
		const res = await multiExchangeMarketService.getMultiExchangeSnapshot();
		expect(res.success).toBe(true);
		expect(res.data).toBeDefined();

		const data = res.data;
		// BSE Breadth
		expect(data.bseBreadth).toBeDefined();
		expect(data.bseBreadth.advances).toBeGreaterThan(1000);
		expect(data.bseBreadth.declines).toBeGreaterThan(1000);
		expect(data.bseBreadth.advanceDeclineRatio).toBeGreaterThan(0.5);
		expect(data.bseBreadth.totalMarketCapLakhCr).toBeGreaterThan(400);

		// GIFT Nifty
		expect(data.giftNifty).toBeDefined();
		expect(data.giftNifty.lastPrice).toBeGreaterThan(20000);
		expect(data.giftNifty.exchange).toContain("GIFT City");

		// Institutional Flows
		expect(data.institutionalFlows).toBeDefined();
		expect(data.institutionalFlows.monthlyMfSipRunRateCr).toBeGreaterThan(20000);

		// NCDEX Agri Pulse
		expect(data.ncdexAgriPulse).toBeDefined();
		expect(data.ncdexAgriPulse.exchange).toBe("NCDEX");
		expect(data.ncdexAgriPulse.keyCommodityDrivers.length).toBeGreaterThanOrEqual(3);

		// Volatility Pulse
		expect(data.volatilityPulse).toBeDefined();
		expect(data.volatilityPulse.indiaVix).toBeGreaterThan(5);
		expect(data.volatilityPulse.cboeVix).toBeGreaterThan(5);
	});
});

describe("AMC Research & House Consensus Service", () => {
	it("synthesizes AMC morning notes into structured advisory consensus", async () => {
		const res = await amcResearchService.getAmcConsensus();
		expect(res.success).toBe(true);
		expect(res.data).toBeDefined();

		const data = res.data;
		// Contributing AMCs
		expect(data.contributingAmcs.length).toBeGreaterThanOrEqual(4);
		expect(data.contributingAmcs.some((amc) => amc.includes("HDFC"))).toBe(true);
		expect(data.contributingAmcs.some((amc) => amc.includes("ICICI"))).toBe(true);
		expect(data.contributingAmcs.some((amc) => amc.includes("SBI"))).toBe(true);

		// Valuation Context
		expect(data.valuationContext.niftyForwardPE).toBeGreaterThan(15);
		expect(data.valuationContext.tenYearHistoricalAvgPE).toBeGreaterThan(15);
		expect(data.valuationContext.valuationStatus).toBeDefined();

		// Fixed Income Stance
		expect(data.fixedIncomeStance.recommendedDurationBand).toBeDefined();
		expect(data.fixedIncomeStance.rationale).toContain("G-Sec");

		// Thematic Rotations
		expect(data.thematicRotations.length).toBeGreaterThanOrEqual(2);

		// Advisor Talking Points
		expect(data.advisorTalkingPoints.length).toBeGreaterThanOrEqual(3);
		expect(data.faspAiDisclaimer).toContain("FASP-AI v1.0 Regulatory Notice");
	});

	it("guarantees knowledgeHubService fallback brief includes multiExchangeData and amcConsensus", async () => {
		const { knowledgeHubService } = await import("../services/knowledge-hub-service");
		const fallback = knowledgeHubService.getFallbackDailyBrief("india");
		expect(fallback).toBeDefined();
		expect(fallback.multiExchangeData).toBeDefined();
		expect(fallback.multiExchangeData.bseBreadth).toBeDefined();
		expect(fallback.amcConsensus).toBeDefined();
		expect(fallback.amcConsensus.contributingAmcs.length).toBeGreaterThanOrEqual(4);
		expect(fallback.commodityRadar).toBeDefined();
		expect(fallback.commodityRadar.crudeOilBreakevenStatus.brentUsd).toBe(114.2);
	});
});
