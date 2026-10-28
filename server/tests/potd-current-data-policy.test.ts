import { describe, it, expect } from "vitest";
import { toNseKey, toBseKey, SYMBOL_TO_ISIN } from "../services/upstox-market-data-service";
import { KNOWN_COMPANY_RENAMES } from "../services/instrument-lifecycle-manager";
import { pickOfTheDayService } from "../services/pick-of-the-day-service";

describe("POTD Current Data Policy & Corporate Action Tests", () => {
	it("correctly maps GRANULES to INE101D01020 in Upstox service and excludes Grasim", () => {
		expect(SYMBOL_TO_ISIN.GRANULES).toBe("INE101D01020");
		expect(toNseKey("GRANULES")).toBe("NSE_EQ|INE101D01020");
		expect(toBseKey("GRANULES")).toBe("BSE_EQ|INE101D01020");

		// Ensure it is NOT Grasim or M&M
		expect(SYMBOL_TO_ISIN.GRANULES).not.toBe("INE101A01026");
	});

	it("includes SABTNL and AQYLON in SYMBOL_TO_ISIN and KNOWN_COMPANY_RENAMES", () => {
		expect(SYMBOL_TO_ISIN.SABTNL).toBe("INE416A01044");
		expect(SYMBOL_TO_ISIN.AQYLON).toBe("INE416A01044");

		const sabtnlRename = KNOWN_COMPANY_RENAMES.find(
			(r) => r.isin === "INE416A01044" || r.symbol === "SABTNL",
		);
		expect(sabtnlRename).toBeDefined();
		expect(sabtnlRename?.newName).toBe("Aqylon Nexus Ltd");
	});

	it("transforms SABTNL pick to display current name 'Aqylon Nexus Ltd'", () => {
		const rawPick: any = {
			id: 2529,
			category: "listed_stocks",
			instrumentId: "sabtnl-id",
			instrumentName: "Sri Adhikari Brothers Television Network Limited",
			isin: "INE416A01044",
			symbol: "SABTNL",
			recoDate: "2026-01-10",
			recoPrice: "100.0000",
			targetPrice: "120.0000",
			stoplossPrice: "90.0000",
			currentPrice: "105.0000",
			status: "live",
			expiryDate: "2026-06-30",
			keyMetrics: {},
		};

		const transformed = (pickOfTheDayService as any).transformPick(rawPick);
		expect(transformed.instrumentName).toBe("Aqylon Nexus Ltd");
		expect(transformed.isin).toBe("INE416A01044");
	});

	it("sanitizes Granules India price and resets contaminated price > 2000", () => {
		const contaminatedPick: any = {
			id: 2530,
			category: "listed_stocks",
			instrumentId: "granules-id",
			instrumentName: "Granules India Ltd",
			isin: "INE101A01026", // old typo
			symbol: "GRANULES",
			recoDate: "2026-02-01",
			recoPrice: "2882.0000", // contaminated
			targetPrice: "3100.0000",
			stoplossPrice: "2700.0000",
			currentPrice: "2882.0000",
			status: "target_hit", // wrongly hit due to 2882
			expiryDate: "2026-06-30",
			keyMetrics: {},
		};

		const transformed = (pickOfTheDayService as any).transformPick(contaminatedPick);
		expect(transformed.isin).toBe("INE101D01020");
		expect(transformed.currentPrice).toBe(836);
		expect(transformed.recoPrice).toBe(836);
		expect(transformed.targetPrice).toBe(920);
		expect(transformed.stoplossPrice).toBe(795);
		expect(transformed.status).toBe("live");
	});
});
