import { describe, it, expect } from "vitest";
import { marketHolidayService } from "../services/market-holiday-service";

describe("Market Holiday Service - Special Sessions & Weekend Precedence", () => {
	it("correctly recognizes special sessions (Muhurat Trading) on partial holidays even if on a weekend", () => {
		// 2026-11-08 is Diwali Laxmi Pujan (Sunday) with Muhurat Trading 18:15 to 19:15
		expect(marketHolidayService.hasSpecialSession("2026-11-08", "NSE")).toBe(true);
		expect(marketHolidayService.isMarketSessionDay("2026-11-08", "NSE")).toBe(true);

		const special = marketHolidayService.getSpecialSession("2026-11-08", "NSE");
		expect(special).toBeDefined();
		expect(special?.name).toBe("Muhurat Trading");
		expect(special?.startTime).toBe("18:15");
		expect(special?.endTime).toBe("19:15");
	});

	it("prioritizes partial holiday special session metadata over default weekend closure in getMarketStatus", () => {
		const status = marketHolidayService.getMarketStatus("NSE");
		// Today is 2026-11-08 (Diwali Laxmi Pujan, Sunday)
		expect(status.isHoliday).toBe(true);
		expect(status.holidayName).toBe("Diwali (Laxmi Pujan)");
		expect(status.specialSession).toBeDefined();
		expect(status.specialSession?.name).toBe("Muhurat Trading");
		expect(status.tradingHours?.open).toBe("18:15");
		expect(status.tradingHours?.close).toBe("19:15");
		expect(status.reason).toContain("Muhurat Trading");
	});

	it("correctly marks normal non-holiday weekends as closed", () => {
		// 2026-11-15 is a regular Sunday without any holiday or special session
		expect(marketHolidayService.isWeekendDay("2026-11-15")).toBe(true);
		expect(marketHolidayService.isTradingDay("2026-11-15", "NSE")).toBe(false);
		expect(marketHolidayService.hasSpecialSession("2026-11-15", "NSE")).toBe(false);
		expect(marketHolidayService.isMarketSessionDay("2026-11-15", "NSE")).toBe(false);
	});

	it("correctly marks full holidays as non-trading days without special sessions", () => {
		// 2026-01-26 is Republic Day (full holiday)
		const holiday = marketHolidayService.getHoliday("2026-01-26", "NSE");
		expect(holiday).toBeDefined();
		expect(holiday?.type).toBe("full");
		expect(marketHolidayService.isTradingDay("2026-01-26", "NSE")).toBe(false);
		expect(marketHolidayService.hasSpecialSession("2026-01-26", "NSE")).toBe(false);
	});
});

