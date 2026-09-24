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
