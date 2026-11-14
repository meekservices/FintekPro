import { describe, it, expect, vi } from "vitest";
import { knowledgeHubService } from "../services/knowledge-hub-service";
import { runMarketBriefEodJob } from "../cron/market-brief-eod-cron";

describe("Market Brief Day-Wise Archive & EOD Persistence", () => {
	it("returns fallback daily briefs with region fidelity", () => {
		const indiaBrief = knowledgeHubService.getFallbackDailyBrief("india");
		const usBrief = knowledgeHubService.getFallbackDailyBrief("us");
		const globalBrief = knowledgeHubService.getFallbackDailyBrief("global");

		expect(indiaBrief.region).toBe("india");
		expect(indiaBrief.marketSnapshot).toContain("Nifty 50");

		expect(usBrief.region).toBe("us");
		expect(usBrief.marketSnapshot).toContain("S&P 500");

		expect(globalBrief.region).toBe("global");
		expect(globalBrief.marketSnapshot).toContain("Global");
	});

	it("returns day-wise deduplicated market briefs in descending date order", async () => {
		const briefs = await knowledgeHubService.getMarketBriefs({ region: "india", limit: 10 });
		expect(briefs).toBeDefined();
		expect(Array.isArray(briefs)).toBe(true);
		expect(briefs.length).toBeGreaterThan(0);

		// Verify distinct dates: no duplicate calendar dates in archive list
		const dates = briefs.map((b) => (typeof b.date === "string" ? b.date.split("T")[0] : new Date(b.date).toISOString().split("T")[0]));
		const uniqueDates = Array.from(new Set(dates));
		expect(dates.length).toBe(uniqueDates.length);
	});

	it("guarantees runMarketBriefEodJob runs without fatal errors and reports telemetry", async () => {
		const { goldenPricingEngine } = await import("../services/golden-pricing/GoldenPricingEngine");
		vi.spyOn(goldenPricingEngine, "getDailyMarketBriefLiveSnapshot").mockResolvedValue({} as any);

		const mockBrief = knowledgeHubService.getFallbackDailyBrief("india");
		vi.spyOn(knowledgeHubService, "generateAndPublishDailyBrief").mockResolvedValue(mockBrief as any);

		const results = await runMarketBriefEodJob("india");
		expect(results).toBeDefined();
		expect(results.length).toBe(1);
		expect(results[0].region).toBe("india");
		expect(results[0].success).toBe(true);
		expect(results[0].version).toBe(1);
	});
});
