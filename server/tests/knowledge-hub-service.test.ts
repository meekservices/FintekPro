import { describe, it, expect } from "vitest";
import { knowledgeHubService } from "../services/knowledge-hub-service";

describe("Knowledge Hub Service - Market Brief & Fallback", () => {
	it("returns a comprehensive fallback market brief for India", () => {
		const brief = knowledgeHubService.getFallbackDailyBrief("india");
		expect(brief).toBeDefined();
		expect(brief.marketSnapshot).toContain("Nifty 50");
		expect(brief.whatChanged).toContain("RBI");
		expect(brief.topMovers.length).toBeGreaterThan(0);
		expect(brief.sectorHighlights.length).toBeGreaterThan(0);
		expect(brief.keyRisks).toBeDefined();
		expect(brief.agentTips).toBeDefined();
		expect(brief.version).toBe(1);
	});

	it("returns a valid market brief for US markets", () => {
		const brief = knowledgeHubService.getFallbackDailyBrief("us");
		expect(brief).toBeDefined();
		expect(brief.region).toBe("us");
		expect(brief.marketSnapshot).toContain("S&P 500");
		expect(brief.topMovers.some((m) => m.symbol === "AAPL" || m.name.includes("Apple"))).toBe(true);
	});

	it("guarantees getTodaysBrief returns a valid brief without crashing", async () => {
		const brief = await knowledgeHubService.getTodaysBrief("india");
		expect(brief).toBeDefined();
		expect(brief.marketSnapshot).toBeTruthy();
		expect(brief.whatChanged).toBeTruthy();
		expect(brief.keyRisks).not.toContain("74.8");
		expect(brief.keyRisks).not.toContain("74–78");
	});

	it("sanitizes legacy briefs containing $74.8/bbl across all explanation fields", async () => {
		const legacyBrief = {
			id: "legacy-test-1",
			date: "2026-10-29",
			region: "india",
			marketSnapshot: "Frontline indices held steady. Brent crude at $74.8/bbl in the domestic comfort band.",
			whatChanged: "Brent crude consolidated at $74.8/bbl within India's comfort threshold (<$80), reducing CAD and imported inflation risks.",
			keyRisks: "Crude oil volatility (Brent currently at $74.8/bbl), US Dollar Index (DXY) movements, and shifting foreign institutional (FPI) derivative positions.",
			commodityRadar: {
				crudeOilBreakevenStatus: {
					brentUsd: 110.21,
					inflationImpact: "Elevated",
				},
			},
		};

		const formatted = await knowledgeHubService.formatBriefForClient(legacyBrief);
		expect(formatted.keyRisks).not.toContain("74.8");
		expect(formatted.keyRisks).toContain("110.21");
		expect(formatted.keyRisks).toContain("Elevated crude oil volatility");
		expect(formatted.marketSnapshot).not.toContain("74.8");
		expect(formatted.whatChanged).not.toContain("74.8");
	});

	it("guarantees getDashboardStats returns hasTodaysBrief=true even for unauthenticated/guest users", async () => {
		const stats = await knowledgeHubService.getDashboardStats();
		expect(stats).toBeDefined();
		expect(stats.hasTodaysBrief).toBe(true);
		expect(stats.todaysBrief).toBeDefined();
		expect(stats.todaysBrief?.marketSnapshot).toBeTruthy();
	});

	it("returns active disclaimer with default fallback", async () => {
		const disclaimer = await knowledgeHubService.getActiveDisclaimer("market_brief");
		expect(disclaimer).toBeDefined();
		expect(disclaimer.content).toContain("FASP-AI v1.0 Regulatory Notice");
	});
});
