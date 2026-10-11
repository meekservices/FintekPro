import { describe, it, expect } from "vitest";
import { commodityMarketService } from "../services/commodity-market-service";

describe("Commodity Market Service (MCX India & CMX / COMEX Benchmarks)", () => {
	it("returns valid multi-commodity benchmarks across MCX and CMX", async () => {
		const res = await commodityMarketService.getCommodityBenchmarks();
		expect(res.success).toBe(true);
		expect(res.data).toBeDefined();

		const data = res.data!;
		expect(data.commodities.length).toBeGreaterThanOrEqual(5);

		// Gold
		const gold = data.commodities.find((c) => c.id === "GOLD");
		expect(gold).toBeDefined();
		expect(gold!.mcxPrice).toBeGreaterThan(60000);
		expect(gold!.cmxPrice).toBeGreaterThan(2000);
		expect(gold!.mcxUnit).toContain("10g");

		// Silver
		const silver = data.commodities.find((c) => c.id === "SILVER");
		expect(silver).toBeDefined();
		expect(silver!.mcxPrice).toBeGreaterThan(70000);
		expect(silver!.cmxPrice).toBeGreaterThan(20);

		// Crude Oil
		const crude = data.commodities.find((c) => c.id === "CRUDE_OIL");
		expect(crude).toBeDefined();
		expect(crude!.mcxPrice).toBeGreaterThan(4000);
		expect(crude!.cmxPrice).toBeGreaterThan(50);

		// Copper
		const copper = data.commodities.find((c) => c.id === "COPPER");
		expect(copper).toBeDefined();
		expect(copper!.mcxPrice).toBeGreaterThan(600);

		// Crude oil inflation breakeven status
		expect(data.crudeOilBreakevenStatus).toBeDefined();
		expect(["Benign", "Moderate", "Elevated"]).toContain(data.crudeOilBreakevenStatus.inflationImpact);
		expect(data.goldSilverRatio).toBeGreaterThan(50);
	});

	it("generates structured advisor commodity commentary for the daily brief", async () => {
		const commentary = await commodityMarketService.getDailyCommodityBriefCommentary();
		expect(commentary).toBeDefined();
		expect(commentary.headline).toContain("Brent Crude");
		expect(commentary.headline).toContain("MCX Gold");
		expect(commentary.bulletPoints.length).toBeGreaterThanOrEqual(3);
		expect(commentary.brentCrudeUsd).toBeGreaterThan(50);
		expect(commentary.goldMcxInr).toBeGreaterThan(60000);
	});
});
